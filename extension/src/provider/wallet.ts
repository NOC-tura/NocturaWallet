import {ReadonlyWalletAccount} from '@wallet-standard/wallet';
import type {IdentifierString, Wallet, WalletAccount} from '@wallet-standard/base';
import {NocturaError, type Bridge} from './bridge';
import {addressBytes, fromBase64, signatureBytes, toBase64} from './codec';
import {ICON} from './icon';

/**
 * The one Wallet Standard wallet "Noctura" (spec §1.1, §3; D6). It advertises only what it implements —
 * `standard:connect`, `standard:disconnect`, `standard:events`, `solana:signMessage` (plan 1) and, from B1c-2,
 * `solana:signTransaction` and `solana:signAndSendTransaction` (legacy and v0) — so wallet-adapter dApps find it
 * (`isWalletAdapterCompatibleStandardWallet` needs a transaction feature; header, D10). `solana:mainnet` only. The
 * accounts are the ones the background last sent (Wallet Standard needs them synchronously); the background decides
 * everything — the provider only refuses what it can see is not this wallet's to answer (another account, another
 * chain) before asking.
 */
export const CHAINS = ['solana:mainnet'] as const;
const ACCOUNT_FEATURES = ['solana:signMessage', 'solana:signTransaction', 'solana:signAndSendTransaction'] as const;
const TX_VERSIONS = ['legacy', 0] as const;

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
/** @solana/wallet-standard-features' SolanaSignTransactionInput / SolanaSignAndSendTransactionInput, as far as this wallet reads them. */
interface TransactionInput {
  account: WalletAccount;
  transaction: Uint8Array;
  chain?: IdentifierString;
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
      'solana:signTransaction': {version: '1.0.0' as const, supportedTransactionVersions: TX_VERSIONS, signTransaction: this.#signTransaction},
      'solana:signAndSendTransaction': {version: '1.0.0' as const, supportedTransactionVersions: TX_VERSIONS, signAndSendTransaction: this.#signAndSendTransaction},
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

  /** Only this wallet's account (the one connected), only solana:mainnet — refused here before anything is posted. */
  #checked(inputs: readonly TransactionInput[]): string {
    // Plan 2 review 1 L8: an input without an account (a hostile or broken caller) is invalid-request, never a TypeError.
    const first = inputs[0]?.account?.address;
    if (typeof first !== 'string' || !inputs.every(i => i?.account?.address === first)) throw new NocturaError('invalid-request');
    if (!this.#accounts.some(a => a.address === first)) throw new NocturaError('unauthorized');
    if (inputs.some(i => i.chain !== undefined && i.chain !== CHAINS[0])) throw new NocturaError('invalid-request');
    return first;
  }

  /** One request for every input (a batch, §3.3: shown and approved as a whole; more than five refused by the background, D8). */
  #signTransaction = async (...inputs: TransactionInput[]): Promise<{signedTransaction: Uint8Array}[]> => {
    if (inputs.length === 0) return [];
    const account = this.#checked(inputs);
    const r = await this.#bridge.request('page.signTransaction', {account, transactions: inputs.map(i => toBase64(i.transaction)), chain: CHAINS[0]});
    const signed = r.signed;
    if (!Array.isArray(signed) || signed.length !== inputs.length || !signed.every(s => typeof s === 'string')) throw new NocturaError('invalid-request');
    return (signed as string[]).map(s => ({signedTransaction: fromBase64(s)}));
  };

  /** One request per input, one after another (each is its own approval). */
  #signAndSendTransaction = async (...inputs: TransactionInput[]): Promise<{signature: Uint8Array}[]> => {
    const out: {signature: Uint8Array}[] = [];
    for (const input of inputs) {
      const account = this.#checked([input]);
      const r = await this.#bridge.request('page.signAndSendTransaction', {account, transaction: toBase64(input.transaction), chain: CHAINS[0]});
      const signature = typeof r.signature === 'string' ? signatureBytes(r.signature) : null;
      if (signature === null) throw new NocturaError('invalid-request');
      out.push({signature});
    }
    return out;
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
