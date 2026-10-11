import {getWallets} from '@wallet-standard/app';
import type {Wallet, WalletAccount} from '@wallet-standard/base';

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
};
(window as unknown as {dapp: typeof dapp}).dapp = dapp;
