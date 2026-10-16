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
/** Review fix I3 minor, scoped (NOT the shared Result — a real provider rejection's own `.name` is a defined
 * `'NocturaError'`, so adding this to `run()`'s shared catch broke every other call's strict-equality assertion that
 * never expected a `name` field at all): only `adapterSignAll` below needs the wallet-adapter's own error TYPE
 * (`WalletSignTransactionError`, not the provider's `NocturaError` it wraps). */
type NamedFailure = {ok: false; message: string; name: string | undefined};
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
  /**
   * B1c-2: `count` transfers (1 + i lamports each) in ONE signTransaction call. Review fix I3: returns, per
   * transaction, both the signed wire (base64) AND the exact message bytes the page itself built (base64, from the
   * same `VersionedTransaction` before signing) — so a caller can assert the wallet preserved the page's own bytes
   * byte for byte, rather than merely that SOME valid signature came back. Review fix minor (round 2): also returns
   * `walletCount`, the wallet's own `out.length` — `txs.map((t, i) => ...)` always produces exactly `count` items
   * regardless of what the wallet actually returned (a missing `out[i]` silently falls back to an empty array, and
   * anything past `txs.length` is silently dropped), so `items`'s own length is tautological; `walletCount` is the
   * one number that actually reflects what the wallet handed back.
   */
  signTx: (count: number, blockhash: string): Promise<Result> =>
    run(async () => {
      const w = noctura();
      const account = w.accounts[0];
      if (account === undefined) throw new Error('not connected');
      const txs = Array.from({length: count}, (_, i) => transferTx(account.address, blockhash, 1 + i));
      const inputs = txs.map(t => ({account, chain: 'solana:mainnet', transaction: t.serialize()}));
      const out = await (w.features['solana:signTransaction'] as SignTransaction).signTransaction(...inputs);
      return {items: txs.map((t, i) => ({signed: b64(out[i]?.signedTransaction ?? new Uint8Array()), message: b64(t.message.serialize())})), walletCount: out.length};
    }),
  /**
   * B1c-2: one transfer through signAndSendTransaction; the signature's 64 bytes, base64, AND (review fix I3) the
   * exact message bytes this page built, base64, for the same byte-for-byte check as `signTx`.
   */
  send: (blockhash: string, lamports: number): Promise<Result> =>
    run(async () => {
      const w = noctura();
      const account = w.accounts[0];
      if (account === undefined) throw new Error('not connected');
      const tx = transferTx(account.address, blockhash, lamports);
      const [out] = await (w.features['solana:signAndSendTransaction'] as SignAndSend).signAndSendTransaction({account, chain: 'solana:mainnet', transaction: tx.serialize()});
      return {signature: b64(out?.signature ?? new Uint8Array()), message: b64(tx.message.serialize())};
    }),
  /**
   * B1c-2: a request posted straight to the relay, as any script on a page can (spec §1.1's stated limit) — past the
   * provider's own checks; the relay's reply for it (`{result}` or `{error}`). Review fix minor: a bounded timeout
   * that rejects with a named reason — an unanswered raw request used to hang this promise forever, so a real
   * regression surfaced only as the whole test's own blunt timeout, with nothing saying why.
   */
  raw: (type: string, payload: Record<string, unknown>): Promise<unknown> =>
    new Promise((resolve, reject) => {
      const id = `raw${Math.random().toString(36).slice(2)}`;
      const timer = setTimeout(() => {
        window.removeEventListener('message', on);
        reject(new Error(`raw ${type} (${id}) got no relay reply within 15s`));
      }, 15_000);
      const on = (e: MessageEvent) => {
        const d = e.data as {source?: unknown; id?: unknown; error?: unknown; result?: unknown} | null;
        if (e.source !== window || d === null || typeof d !== 'object' || d.source !== 'noctura-relay' || d.id !== id) return;
        clearTimeout(timer);
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
  /** Review fix I3: returns the original message bytes (base64) alongside the signed wire, as `signTx` does. */
  adapterSign: (blockhash: string): Promise<Result> =>
    run(async () => {
      const a = theAdapter();
      const from = a.publicKey?.toBase58();
      if (from === undefined) throw new Error('not connected');
      // The adapter offers signTransaction only for a wallet that has the feature (it does: B1c-2).
      if (a.signTransaction === undefined) throw new Error('no signTransaction');
      const tx = transferTx(from, blockhash, 7);
      const signed = await a.signTransaction(tx);
      return {signed: b64(signed.serialize()), message: b64(tx.message.serialize())};
    }),
  /**
   * Review fix I3: one message per transaction, in the same order as the signed wires. Review fix minor: unlike
   * every other call here, its failure path does NOT go through the shared `run()` — it returns the adapter's own
   * thrown error's `name` (e.g. `WalletSignTransactionError`, the TYPE the adapter reports, distinct from the
   * provider's own `NocturaError` it wraps), which only this one assertion (B1c-27's six-refused) needs.
   */
  adapterSignAll: async (count: number, blockhash: string): Promise<Result | NamedFailure> => {
    try {
      const a = theAdapter();
      const from = a.publicKey?.toBase58();
      if (from === undefined) throw new Error('not connected');
      if (a.signAllTransactions === undefined) throw new Error('no signAllTransactions');
      const txs = Array.from({length: count}, (_, i) => transferTx(from, blockhash, 10 + i));
      const signed = await a.signAllTransactions(txs);
      return {ok: true, value: {signed: signed.map(t => b64(t.serialize())), messages: txs.map(t => b64(t.message.serialize()))}};
    } catch (e) {
      const err = e as {message?: unknown; name?: unknown};
      return {ok: false, message: String(err.message), name: typeof err.name === 'string' ? err.name : undefined};
    }
  },
  /** Review fix I3: the signature AND the original message bytes (base64) this page built before sending. */
  adapterSend: (blockhash: string): Promise<Result> =>
    run(async () => {
      const a = theAdapter();
      const from = a.publicKey?.toBase58();
      if (from === undefined) throw new Error('not connected');
      const tx = transferTx(from, blockhash, 9);
      const signature = await a.sendTransaction(tx, CONNECTION);
      return {signature, message: b64(tx.message.serialize())};
    }),
};
(window as unknown as {dapp: typeof dapp}).dapp = dapp;
