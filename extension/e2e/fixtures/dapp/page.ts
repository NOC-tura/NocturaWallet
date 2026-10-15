import {getWallets} from '@wallet-standard/app';
import type {Wallet, WalletAccount} from '@wallet-standard/base';
import {isWalletAdapterCompatibleStandardWallet, type WalletAdapterCompatibleStandardWallet} from '@solana/wallet-adapter-base';
import {StandardWalletAdapter} from '@solana/wallet-standard-wallet-adapter-base';
import {Connection, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction} from '@solana/web3.js';

/**
 * The test dApp (B1c §6.3): the script of the page E2E serves at https://dapp.test (and the other fixture hosts) through
 * ctx.route. It finds wallets the way a real dApp does — `@wallet-standard/app`'s getWallets() — and drives "Noctura"
 * through its standard features only. Built into one classic script by e2e/dappPage.ts; never part of the extension.
 */
type Result = {ok: true; value: unknown} | {ok: false; code: unknown; message: string};
interface Connect {
  connect(input?: {silent?: boolean}): Promise<{accounts: readonly WalletAccount[]}>;
}
interface Disconnect {
  disconnect(): Promise<void>;
}
interface Events {
  on(event: 'change', listener: (p: {accounts?: readonly WalletAccount[]}) => void): () => void;
}
interface SignMessage {
  signMessage(...inputs: {account: WalletAccount; message: Uint8Array}[]): Promise<{signature: Uint8Array; signedMessage: Uint8Array}[]>;
}

const wallets = getWallets();
const changes: string[][] = [];
/** Every message the relay posted to this window (source noctura-relay): E2E 24 counts the answers. */
const relayed: unknown[] = [];
window.addEventListener('message', e => {
  const d = e.data as {source?: unknown} | null;
  if (e.source === window && d !== null && typeof d === 'object' && d.source === 'noctura-relay') relayed.push(d);
});
let listening = false;

function noctura(): Wallet {
  const w = wallets.get().find(x => x.name === 'Noctura');
  if (w === undefined) throw new Error('no Noctura wallet');
  if (!listening) {
    listening = true;
    (w.features['standard:events'] as Events).on('change', p => void changes.push((p.accounts ?? []).map(a => a.address)));
  }
  return w;
}

async function run(f: () => Promise<unknown>): Promise<Result> {
  try {
    return {ok: true, value: await f()};
  } catch (e) {
    const err = e as {code?: unknown; message?: unknown};
    return {ok: false, code: err.code, message: String(err.message)};
  }
}

interface SignTransaction {
  signTransaction(...inputs: {account: WalletAccount; transaction: Uint8Array; chain?: string}[]): Promise<{signedTransaction: Uint8Array}[]>;
}
interface SignAndSend {
  signAndSendTransaction(...inputs: {account: WalletAccount; transaction: Uint8Array; chain?: string}[]): Promise<{signature: Uint8Array}[]>;
}

/**
 * B1c-2: a v0 transfer from the connected account — `lamports` to `to` (default: a fixed test recipient), at the
 * blockhash the test hands over (the fake coordinator's), the account its fee payer.
 */
const RECIPIENT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
function transferTx(from: string, blockhash: string, lamports: number, to = RECIPIENT): VersionedTransaction {
  const payer = new PublicKey(from);
  const message = new TransactionMessage({payerKey: payer, recentBlockhash: blockhash, instructions: [SystemProgram.transfer({fromPubkey: payer, toPubkey: new PublicKey(to), lamports})]}).compileToV0Message();
  return new VersionedTransaction(message);
}

/** The wallet-adapter dApp's view (spec review-1 M1): the adapter over the same Wallet Standard wallet. */
let adapter: StandardWalletAdapter | null = null;
function theAdapter(): StandardWalletAdapter {
  if (adapter === null) {
    const w = noctura();
    if (!isWalletAdapterCompatibleStandardWallet(w)) throw new Error('not adapter-compatible');
    adapter = new StandardWalletAdapter({wallet: w as WalletAdapterCompatibleStandardWallet});
  }
  return adapter;
}
/** A mainnet Connection object: the adapter reads its endpoint (the chain); nothing is fetched for a v0 transaction. */
const CONNECTION = new Connection('https://api.mainnet-beta.solana.com');

const b64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string): Uint8Array => Uint8Array.from(atob(s), c => c.charCodeAt(0));

const dapp = {
  names: (): string[] => wallets.get().map(w => w.name),
  features: (): string[] => Object.keys(noctura().features).sort(),
  accounts: (): string[] => noctura().accounts.map(a => a.address),
  changes: (): string[][] => changes,
  relayed: (): unknown[] => relayed,
  connect: (silent: boolean): Promise<Result> => run(async () => (await (noctura().features['standard:connect'] as Connect).connect({silent})).accounts.map(a => a.address)),
  disconnect: (): Promise<Result> => run(() => (noctura().features['standard:disconnect'] as Disconnect).disconnect()),
  /** Signs the UTF-8 text (or, with `base64`, these exact bytes) with the first account; answers both as base64. */
  sign: (text: string, o: {base64?: boolean} = {}): Promise<Result> =>
    run(async () => {
      const w = noctura();
      const account = w.accounts[0];
      if (account === undefined) throw new Error('not connected');
      const message = o.base64 === true ? unb64(text) : new TextEncoder().encode(text);
      const [out] = await (w.features['solana:signMessage'] as SignMessage).signMessage({account, message});
      return {signature: b64(out?.signature ?? new Uint8Array()), signedMessage: b64(out?.signedMessage ?? new Uint8Array())};
    }),
  /** B1c-2: `count` transfers (1 + i lamports each) in ONE signTransaction call; the signed bytes, base64. */
  signTx: (count: number, blockhash: string): Promise<Result> =>
    run(async () => {
      const w = noctura();
      const account = w.accounts[0];
      if (account === undefined) throw new Error('not connected');
      const inputs = Array.from({length: count}, (_, i) => ({account, chain: 'solana:mainnet', transaction: transferTx(account.address, blockhash, 1 + i).serialize()}));
      const out = await (w.features['solana:signTransaction'] as SignTransaction).signTransaction(...inputs);
      return out.map(o => b64(o.signedTransaction));
    }),
  /** B1c-2: one transfer through signAndSendTransaction; the signature's 64 bytes, base64. */
  send: (blockhash: string, lamports: number): Promise<Result> =>
    run(async () => {
      const w = noctura();
      const account = w.accounts[0];
      if (account === undefined) throw new Error('not connected');
      const [out] = await (w.features['solana:signAndSendTransaction'] as SignAndSend).signAndSendTransaction({account, chain: 'solana:mainnet', transaction: transferTx(account.address, blockhash, lamports).serialize()});
      return b64(out?.signature ?? new Uint8Array());
    }),
  /**
   * B1c-2: a request posted straight to the relay, as any script on a page can (spec §1.1's stated limit) — past the
   * provider's own checks; the relay's reply for it (`{result}` or `{error}`).
   */
  raw: (type: string, payload: Record<string, unknown>): Promise<unknown> =>
    new Promise(resolve => {
      const id = `raw${Math.random().toString(36).slice(2)}`;
      const on = (e: MessageEvent) => {
        const d = e.data as {source?: unknown; id?: unknown; error?: unknown; result?: unknown} | null;
        if (e.source !== window || d === null || typeof d !== 'object' || d.source !== 'noctura-relay' || d.id !== id) return;
        window.removeEventListener('message', on);
        resolve('error' in d ? {error: d.error} : {result: d.result});
      };
      window.addEventListener('message', on);
      window.postMessage({source: 'noctura-provider', id, type, payload}, location.origin);
    }),
  /** A v0 transfer of 3 lamports from `account`, base64 — for `raw`. */
  rawTx: (account: string, blockhash: string): string => b64(transferTx(account, blockhash, 3).serialize()),
  /** B1c-2 through @solana/wallet-adapter: the compatibility predicate, and the adapter's own calls. */
  adapterCompatible: (): boolean => isWalletAdapterCompatibleStandardWallet(noctura()),
  adapterConnect: (): Promise<Result> =>
    run(async () => {
      const a = theAdapter();
      await a.connect();
      return a.publicKey?.toBase58() ?? null;
    }),
  adapterSign: (blockhash: string): Promise<Result> =>
    run(async () => {
      const a = theAdapter();
      const from = a.publicKey?.toBase58();
      if (from === undefined) throw new Error('not connected');
      // The adapter offers signTransaction only for a wallet that has the feature (it does: B1c-2).
      if (a.signTransaction === undefined) throw new Error('no signTransaction');
      const signed = await a.signTransaction(transferTx(from, blockhash, 7));
      return b64(signed.serialize());
    }),
  adapterSignAll: (count: number, blockhash: string): Promise<Result> =>
    run(async () => {
      const a = theAdapter();
      const from = a.publicKey?.toBase58();
      if (from === undefined) throw new Error('not connected');
      if (a.signAllTransactions === undefined) throw new Error('no signAllTransactions');
      const signed = await a.signAllTransactions(Array.from({length: count}, (_, i) => transferTx(from, blockhash, 10 + i)));
      return signed.map(t => b64(t.serialize()));
    }),
  adapterSend: (blockhash: string): Promise<Result> =>
    run(async () => {
      const a = theAdapter();
      const from = a.publicKey?.toBase58();
      if (from === undefined) throw new Error('not connected');
      return a.sendTransaction(transferTx(from, blockhash, 9), CONNECTION);
    }),
};
(window as unknown as {dapp: typeof dapp}).dapp = dapp;
