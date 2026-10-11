import {ReadonlyWalletAccount} from '@wallet-standard/wallet';
import type {IdentifierString, Wallet, WalletAccount} from '@wallet-standard/base';
import {NocturaError, type Bridge} from './bridge';
import {addressBytes, fromBase64, toBase64} from './codec';
import {ICON} from './icon';

/**
 * The one Wallet Standard wallet "Noctura" (spec §1.1, §3; D6). Plan 1 advertises only what it implements —
 * `standard:connect`, `standard:disconnect`, `standard:events` and `solana:signMessage` (header, D10); B1c-2 adds the
 * two transaction features. `solana:mainnet` only. The accounts are the ones the background last sent (Wallet Standard
 * needs them synchronously); the background decides everything.
 */
export const CHAINS = ['solana:mainnet'] as const;
const ACCOUNT_FEATURES = ['solana:signMessage'] as const;

type ChangeListener = (properties: {accounts?: readonly WalletAccount[]}) => void;
interface SignMessageInput {
  account: WalletAccount;
  message: Uint8Array;
}
interface SignMessageOutput {
  signedMessage: Uint8Array;
  signature: Uint8Array;
  signatureType: 'ed25519';
}

export class NocturaWallet implements Wallet {
  readonly version = '1.0.0' as const;
  readonly name = 'Noctura';
  readonly icon = ICON;
  readonly chains: IdentifierString[] = [...CHAINS];
  #accounts: ReadonlyWalletAccount[] = [];
  readonly #listeners = new Set<ChangeListener>();
  readonly #bridge: Bridge;

  constructor(bridge: Bridge) {
    this.#bridge = bridge;
    bridge.onChange(accounts => this.#set(accounts));
  }

  get accounts(): readonly WalletAccount[] {
    return this.#accounts.slice();
  }

  get features() {
    return {
      'standard:connect': {version: '1.0.0' as const, connect: this.#connect},
      'standard:disconnect': {version: '1.0.0' as const, disconnect: this.#disconnect},
      'standard:events': {version: '1.0.0' as const, on: this.#on},
      'solana:signMessage': {version: '1.1.0' as const, signMessage: this.#signMessage},
    };
  }

  /** The accounts the background sent; a change (and only a change) is announced. */
  #set(addresses: readonly string[]): void {
    const next: ReadonlyWalletAccount[] = [];
    for (const address of addresses) {
      const publicKey = addressBytes(address);
      if (publicKey !== null) next.push(new ReadonlyWalletAccount({address, publicKey, chains: [...CHAINS], features: [...ACCOUNT_FEATURES]}));
    }
    if (next.length === this.#accounts.length && next.every((a, i) => a.address === this.#accounts[i]?.address)) return;
    this.#accounts = next;
    for (const l of this.#listeners) l({accounts: this.accounts});
  }

  #connect = async (input?: {silent?: boolean}): Promise<{accounts: readonly WalletAccount[]}> => {
    const r = await this.#bridge.request('page.connect', {silent: input?.silent === true});
    const accounts = Array.isArray(r.accounts) ? (r.accounts as unknown[]).filter((a): a is string => typeof a === 'string') : [];
    this.#set(accounts);
    return {accounts: this.accounts};
  };

  #disconnect = async (): Promise<void> => {
    await this.#bridge.request('page.disconnect', {});
    this.#set([]);
  };

  #on = (event: string, listener: ChangeListener): (() => void) => {
    if (event !== 'change') return () => undefined;
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  #signMessage = async (...inputs: SignMessageInput[]): Promise<SignMessageOutput[]> => {
    const out: SignMessageOutput[] = [];
    for (const input of inputs) {
      if (!this.#accounts.some(a => a.address === input.account.address)) throw new NocturaError('unauthorized');
      const r = await this.#bridge.request('page.signMessage', {account: input.account.address, message: toBase64(input.message)});
      if (typeof r.signature !== 'string' || typeof r.signedMessage !== 'string') throw new NocturaError('invalid-request');
      out.push({signedMessage: fromBase64(r.signedMessage), signature: fromBase64(r.signature), signatureType: 'ed25519'});
    }
    return out;
  };
}
