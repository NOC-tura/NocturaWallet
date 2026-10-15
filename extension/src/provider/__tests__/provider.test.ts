import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {createBridge, NocturaError} from '../bridge';
import {addressBytes, signatureBytes} from '../codec';
import {ICON} from '../icon';
import {NocturaWallet} from '../wallet';

const ORIGIN = 'https://dapp.test';
const A = base58.encode(ed25519.getPublicKey(new Uint8Array(32).fill(1)));
const B = base58.encode(ed25519.getPublicKey(new Uint8Array(32).fill(2)));

/** A window as the provider sees it: an EventTarget with location.origin, crypto and postMessage (recorded). */
function fakeWindow(origin: string = ORIGIN) {
  const target = new EventTarget();
  const posted: {m: Record<string, unknown>; to: string}[] = [];
  const win = Object.assign(target, {
    location: {origin},
    crypto: globalThis.crypto,
    postMessage: (m: Record<string, unknown>, to: string) => {
      // Review 1 IMPORTANT: compliant browsers throw a SyntaxError for postMessage's targetOrigin when it is the
      // literal string 'null' (an opaque origin's serialization) rather than a parseable URL.
      if (to === 'null') throw new DOMException('Invalid target origin', 'SyntaxError');
      posted.push({m, to});
    },
  });
  /** A message event as the browser dispatches one (window.postMessage from this window: source = window). */
  const dispatch = (data: unknown, o: {source?: unknown; origin?: string} = {}) =>
    target.dispatchEvent(Object.assign(new Event('message'), {data, origin: o.origin ?? ORIGIN, source: 'source' in o ? o.source : win}));
  return {win: win as unknown as Window, posted, dispatch};
}

/** The relay's answer to the last request the provider posted. */
const answerLast = (w: ReturnType<typeof fakeWindow>, body: Record<string, unknown>) => {
  const last = w.posted[w.posted.length - 1]?.m;
  w.dispatch({source: 'noctura-relay', id: last?.id, ...body});
};
const flush = () => new Promise(r => setTimeout(r, 0));

// Spec §1.1, D6, D10 — the MAIN-world provider: one wallet "Noctura", only plan 1's features, no state but the accounts.
describe('the Noctura wallet (Wallet Standard)', () => {
  it('name, version, chains solana:mainnet only, and exactly the six features it implements — B1c-2 adds the two transaction features (D10)', () => {
    const wallet = new NocturaWallet(createBridge(fakeWindow().win));
    expect([wallet.name, wallet.version, wallet.chains]).toEqual(['Noctura', '1.0.0', ['solana:mainnet']]);
    expect(Object.fromEntries(Object.entries(wallet.features).map(([k, v]) => [k, v.version]))).toEqual({
      'standard:connect': '1.0.0',
      'standard:disconnect': '1.0.0',
      'standard:events': '1.0.0',
      'solana:signMessage': '1.1.0',
      'solana:signTransaction': '1.0.0',
      'solana:signAndSendTransaction': '1.0.0',
    });
    expect(wallet.features['solana:signTransaction'].supportedTransactionVersions).toEqual(['legacy', 0]);
    expect(wallet.features['solana:signAndSendTransaction'].supportedTransactionVersions).toEqual(['legacy', 0]);
    expect(wallet.accounts).toEqual([]);
  });

  it('the icon is the owner’s mark, web/public/noc-mark.png, as a data URL (generated, never edited)', () => {
    expect(ICON.startsWith('data:image/png;base64,')).toBe(true);
    const png = readFileSync(join(__dirname, '..', '..', '..', '..', 'web', 'public', 'noc-mark.png'));
    expect(Buffer.from(base64.decode(ICON.slice('data:image/png;base64,'.length))).equals(png)).toBe(true);
  });

  it('connect posts page.connect to this origin only, and takes the accounts the background sent; one change event', async () => {
    const w = fakeWindow();
    const wallet = new NocturaWallet(createBridge(w.win));
    const changes: unknown[] = [];
    wallet.features['standard:events'].on('change', p => void changes.push(p.accounts?.map(a => a.address)));
    const pending = wallet.features['standard:connect'].connect();
    expect(w.posted).toEqual([{m: {source: 'noctura-provider', id: expect.stringMatching(/^[0-9a-f]{24}$/), type: 'page.connect', payload: {silent: false}}, to: ORIGIN}]);
    answerLast(w, {result: {accounts: [A]}});
    const r = await pending;
    expect(r.accounts.map(a => a.address)).toEqual([A]);
    expect(Array.from(r.accounts[0]?.publicKey ?? [])).toEqual(Array.from(base58.decode(A)));
    expect(r.accounts[0]?.features).toEqual(['solana:signMessage', 'solana:signTransaction', 'solana:signAndSendTransaction']);
    expect(changes).toEqual([[A]]);
    // A silent connect says so.
    void wallet.features['standard:connect'].connect({silent: true});
    expect(w.posted[1]?.m.payload).toEqual({silent: true});
  });

  it('ignores a message from another window, another origin, or with another source tag', async () => {
    const w = fakeWindow();
    const wallet = new NocturaWallet(createBridge(w.win));
    const pending = wallet.features['standard:connect'].connect();
    const id = w.posted[0]?.m.id;
    w.dispatch({source: 'noctura-relay', id, result: {accounts: [B]}}, {source: {}});
    w.dispatch({source: 'noctura-relay', id, result: {accounts: [B]}}, {origin: 'https://evil.test'});
    w.dispatch({source: 'noctura-provider', id, result: {accounts: [B]}});
    await flush();
    expect(wallet.accounts).toEqual([]);
    w.dispatch({source: 'noctura-relay', id, result: {accounts: [A]}});
    expect((await pending).accounts.map(a => a.address)).toEqual([A]);
  });

  // Review 1 IMPORTANT: an opaque-origin page's postMessage(data, 'null') throws a raw SyntaxError in real browsers —
  // the provider must turn this into a NocturaError, never let the DOMException itself reach the dApp.
  it('an opaque-origin page: connect rejects unauthorized instead of a raw DOMException, and nothing is sent', async () => {
    const w = fakeWindow('null');
    const wallet = new NocturaWallet(createBridge(w.win));
    await expect(wallet.features['standard:connect'].connect()).rejects.toMatchObject({name: 'NocturaError', code: 4100});
    expect(w.posted).toEqual([]);
  });

  it('a refusal becomes an Error with a stable code and a fixed English message (C10); an unknown code is invalid-request', async () => {
    const w = fakeWindow();
    const wallet = new NocturaWallet(createBridge(w.win));
    const one = wallet.features['standard:connect'].connect();
    answerLast(w, {error: 'rejected'});
    await expect(one).rejects.toMatchObject({name: 'NocturaError', code: 4001, message: 'The user rejected the request.'});
    const two = wallet.features['standard:connect'].connect();
    answerLast(w, {error: 'Internal: stack trace …'});
    await expect(two).rejects.toMatchObject({code: 'invalid-request'});
    expect(new NocturaError('unauthorized').code).toBe(4100);
  });

  // B1c-2 (spec §1.6, rev 3.3): a broadcast the user approved that never reached the network has its own code.
  it('send-failed: its own code and fixed message, "The transaction could not be sent." — not invalid-request', async () => {
    const w = fakeWindow();
    const wallet = new NocturaWallet(createBridge(w.win));
    const c = wallet.features['standard:connect'].connect();
    answerLast(w, {result: {accounts: [A]}});
    const [account] = (await c).accounts;
    const s = wallet.features['solana:signAndSendTransaction'].signAndSendTransaction({account: account!, transaction: Uint8Array.of(1)});
    answerLast(w, {error: 'send-failed'});
    await expect(s).rejects.toMatchObject({name: 'NocturaError', code: 'send-failed', message: 'The transaction could not be sent.'});
  });

  it('signMessage: refused for an account it was not given (no message posted); for the connected one, the bytes come back', async () => {
    const w = fakeWindow();
    const wallet = new NocturaWallet(createBridge(w.win));
    const c = wallet.features['standard:connect'].connect();
    answerLast(w, {result: {accounts: [A]}});
    const [account] = (await c).accounts;
    const stranger = {...account!, address: B, publicKey: base58.decode(B)};
    await expect(wallet.features['solana:signMessage'].signMessage({account: stranger, message: new Uint8Array([1])})).rejects.toMatchObject({code: 4100});
    expect(w.posted).toHaveLength(1);
    const message = new TextEncoder().encode('Sign in to the test dApp.');
    const sig = new Uint8Array(64).fill(7);
    const s = wallet.features['solana:signMessage'].signMessage({account: account!, message});
    expect(w.posted[1]?.m).toMatchObject({type: 'page.signMessage', payload: {account: A, message: base64.encode(message)}});
    answerLast(w, {result: {signature: base64.encode(sig), signedMessage: base64.encode(message)}});
    expect(await s).toEqual([{signedMessage: message, signature: sig, signatureType: 'ed25519'}]);
  });

  // B1c-2 (spec §1.4, §3.3): a batch is one request; each sign-and-send is its own.
  it('signTransaction: one page.signTransaction for every input (base64, the chain named), the signed bytes back in order', async () => {
    const w = fakeWindow();
    const wallet = new NocturaWallet(createBridge(w.win));
    const c = wallet.features['standard:connect'].connect();
    answerLast(w, {result: {accounts: [A]}});
    const [account] = (await c).accounts;
    const txs = [Uint8Array.of(1, 2), Uint8Array.of(3), Uint8Array.of(4, 5, 6)];
    const s = wallet.features['solana:signTransaction'].signTransaction(...txs.map(transaction => ({account: account!, transaction, chain: 'solana:mainnet' as const})));
    expect(w.posted[1]?.m).toMatchObject({type: 'page.signTransaction', payload: {account: A, transactions: txs.map(t => base64.encode(t)), chain: 'solana:mainnet'}});
    answerLast(w, {result: {signed: [base64.encode(Uint8Array.of(9)), base64.encode(Uint8Array.of(8)), base64.encode(Uint8Array.of(7))]}});
    expect(await s).toEqual([{signedTransaction: Uint8Array.of(9)}, {signedTransaction: Uint8Array.of(8)}, {signedTransaction: Uint8Array.of(7)}]);
    expect(await wallet.features['solana:signTransaction'].signTransaction()).toEqual([]);
    expect(w.posted).toHaveLength(2);
  });

  it('signTransaction: refused before posting — an account it was not given, two accounts in one batch, another chain, an input with no account; a reply of the wrong length', async () => {
    const w = fakeWindow();
    const wallet = new NocturaWallet(createBridge(w.win));
    const c = wallet.features['standard:connect'].connect();
    answerLast(w, {result: {accounts: [A]}});
    const [account] = (await c).accounts;
    const stranger = {...account!, address: B, publicKey: base58.decode(B)};
    const sign = wallet.features['solana:signTransaction'].signTransaction;
    await expect(sign({account: stranger, transaction: Uint8Array.of(1)})).rejects.toMatchObject({code: 4100});
    await expect(sign({account: account!, transaction: Uint8Array.of(1)}, {account: stranger, transaction: Uint8Array.of(1)})).rejects.toMatchObject({code: 'invalid-request'});
    await expect(sign({account: account!, transaction: Uint8Array.of(1), chain: 'solana:devnet'})).rejects.toMatchObject({code: 'invalid-request'});
    // Review 1 L8: an input with no account is a NocturaError (invalid-request), never a TypeError.
    const noAccount = {transaction: Uint8Array.of(1)} as unknown as Parameters<typeof sign>[0];
    await expect(sign(noAccount)).rejects.toMatchObject({name: 'NocturaError', code: 'invalid-request'});
    await expect(sign({account: account!, transaction: Uint8Array.of(1)}, noAccount)).rejects.toMatchObject({name: 'NocturaError', code: 'invalid-request'});
    await expect(wallet.features['solana:signAndSendTransaction'].signAndSendTransaction(noAccount)).rejects.toMatchObject({name: 'NocturaError', code: 'invalid-request'});
    // Fix round 1, Minor 1 (promoted): an input with no transaction bytes (or of the wrong type) is a NocturaError
    // too, never a bare TypeError out of toBase64 once #checked returns.
    const noTransaction = {account: account!} as unknown as Parameters<typeof sign>[0];
    await expect(sign(noTransaction)).rejects.toMatchObject({name: 'NocturaError', code: 'invalid-request'});
    const wrongType = {account: account!, transaction: 'not-bytes'} as unknown as Parameters<typeof sign>[0];
    await expect(sign(wrongType)).rejects.toMatchObject({name: 'NocturaError', code: 'invalid-request'});
    await expect(wallet.features['solana:signAndSendTransaction'].signAndSendTransaction(noTransaction)).rejects.toMatchObject({name: 'NocturaError', code: 'invalid-request'});
    expect(w.posted).toHaveLength(1);
    const s = sign({account: account!, transaction: Uint8Array.of(1)});
    answerLast(w, {result: {signed: []}});
    await expect(s).rejects.toMatchObject({code: 'invalid-request'});
  });

  it('signAndSendTransaction: one request per input, in turn; the base58 signature comes back as its 64 bytes; anything else is invalid-request', async () => {
    const w = fakeWindow();
    const wallet = new NocturaWallet(createBridge(w.win));
    const c = wallet.features['standard:connect'].connect();
    answerLast(w, {result: {accounts: [A]}});
    const [account] = (await c).accounts;
    const sig = new Uint8Array(64).fill(5);
    const s = wallet.features['solana:signAndSendTransaction'].signAndSendTransaction({account: account!, transaction: Uint8Array.of(1)}, {account: account!, transaction: Uint8Array.of(2)});
    expect(w.posted[1]?.m).toMatchObject({type: 'page.signAndSendTransaction', payload: {account: A, transaction: base64.encode(Uint8Array.of(1)), chain: 'solana:mainnet'}});
    expect(w.posted).toHaveLength(2);
    answerLast(w, {result: {signature: base58.encode(sig)}});
    await flush();
    expect(w.posted[2]?.m).toMatchObject({type: 'page.signAndSendTransaction', payload: {transaction: base64.encode(Uint8Array.of(2))}});
    answerLast(w, {result: {signature: base58.encode(sig)}});
    expect(await s).toEqual([{signature: sig}, {signature: sig}]);
    const bad = wallet.features['solana:signAndSendTransaction'].signAndSendTransaction({account: account!, transaction: Uint8Array.of(3)});
    answerLast(w, {result: {signature: A}});
    await expect(bad).rejects.toMatchObject({code: 'invalid-request'});
  });

  it('a change event from the background updates the accounts; the same accounts again announce nothing; off() stops the listener', async () => {
    const w = fakeWindow();
    const wallet = new NocturaWallet(createBridge(w.win));
    const seen: string[][] = [];
    const off = wallet.features['standard:events'].on('change', p => void seen.push((p.accounts ?? []).map(a => a.address)));
    w.dispatch({source: 'noctura-relay', event: 'change', accounts: [A]});
    w.dispatch({source: 'noctura-relay', event: 'change', accounts: [A]});
    w.dispatch({source: 'noctura-relay', event: 'change', accounts: []});
    off();
    w.dispatch({source: 'noctura-relay', event: 'change', accounts: [B]});
    expect(seen).toEqual([[A], []]);
    expect(wallet.accounts.map(a => a.address)).toEqual([B]);
    expect(wallet.features['standard:events'].on('other' as 'change', () => undefined)()).toBeUndefined();
  });

  it('disconnect asks the background (C2: it removes the grant), then clears the accounts', async () => {
    const w = fakeWindow();
    const wallet = new NocturaWallet(createBridge(w.win));
    w.dispatch({source: 'noctura-relay', event: 'change', accounts: [A]});
    const d = wallet.features['standard:disconnect'].disconnect();
    expect(w.posted[0]?.m).toMatchObject({type: 'page.disconnect', payload: {}});
    answerLast(w, {result: {}});
    await d;
    expect(wallet.accounts).toEqual([]);
  });

  it('signatureBytes: 64 bytes for a signature, null for an address or anything else', () => {
    const sig = new Uint8Array(64).fill(200);
    expect(signatureBytes(base58.encode(sig))).toEqual(sig);
    for (const bad of ['', A, `${base58.encode(sig)}1`, 'not a signature']) expect(signatureBytes(bad)).toBeNull();
  });

  it('addressBytes: 32 bytes for an address, null for anything else', () => {
    expect(Array.from(addressBytes(A) ?? [])).toEqual(Array.from(base58.decode(A)));
    expect(addressBytes('11111111111111111111111111111111')).toEqual(new Uint8Array(32));
    for (const bad of ['', 'not an address', A.slice(0, 20), `${A}0`]) expect(addressBytes(bad)).toBeNull();
  });
});
