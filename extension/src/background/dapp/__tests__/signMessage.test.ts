import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {Keypair, SystemProgram, Transaction, TransactionMessage, VersionedTransaction, PublicKey} from '@solana/web3.js';
import {handleMessage} from '../../messages';
import {setSession} from '../../session';
import {lock} from '../../autolock';
import {VAULT_KEY} from '../../accountsStore';
import {GRANTS_KEY, type Grant} from '../grants';
import {runUnlockHook} from '../queue';
import {DAPP_SESSION_KEY, readDappSession} from '../store';
import {runtimeFor} from '../ports';
import {MAX_MESSAGE_BYTES, checkMessage, checkSiws, homoglyphRanges, keywordIn} from '../signMessage';
import {fakeExt} from '../../__tests__/fakeExt';
import {fakeDeps} from '../../__tests__/fakeDeps';
import {ACCOUNT, BLOCKHASH, PUB, RECIPIENT} from '../../__tests__/fixtures';
import {openPage} from './pageHarness';

const enc = (s: string) => new TextEncoder().encode(s);
const DAPP = 'https://dapp.test';
const grant = (origin: string, over: Partial<Grant> = {}): Grant => ({origin, account: ACCOUNT.publicKey, scope: 'session', connectedAt: 1, lastUsedAt: 1, recent: [], ...over});
const siws = (domain: string, address: string, eol = '\n') =>
  [`${domain} wants you to sign in with your Solana account:`, address, '', 'Sign in to the test dApp.', '', `URI: https://${domain}`, 'Version: 1', 'Chain ID: solana:mainnet', 'Nonce: 4f3a92ceb1d8', 'Issued At: 2026-10-10T09:40:23Z'].join(eol);

/**
 * The required artifact (§3.2 rule 2): printable, valid UTF-8, no control or format character — and a legacy Message
 * that deserializes. Header "!!!", 32 printable keys, a printable blockhash, 32 printable instructions (3 205 bytes).
 */
function printableLegacyMessage(): Uint8Array {
  const parts: Uint8Array[] = [enc('!!!'), Uint8Array.of(0x20), new Uint8Array(32 * 32).fill(0x4b), new Uint8Array(32).fill(0x42), Uint8Array.of(0x20)];
  for (let i = 0; i < 32; i++) parts.push(Uint8Array.of(0x21, 0x20), new Uint8Array(32).fill(0x22), Uint8Array.of(0x20), new Uint8Array(32).fill(0x61));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

function transactionBytes(): {legacy: Uint8Array; versioned: Uint8Array} {
  const from = new PublicKey(PUB);
  const ix = SystemProgram.transfer({fromPubkey: from, toPubkey: new PublicKey(RECIPIENT), lamports: 1});
  const legacy = new Transaction({feePayer: from, recentBlockhash: BLOCKHASH}).add(ix);
  const message = new TransactionMessage({payerKey: from, recentBlockhash: BLOCKHASH, instructions: [ix]}).compileToV0Message();
  return {legacy: legacy.serialize({requireAllSignatures: false, verifySignatures: false}), versioned: new VersionedTransaction(message).serialize()};
}

// Spec §3.2 rule 2: each refusal asserts its REASON, so a later rule cannot mask an earlier one (review M5).
describe('signMessage rule 2 — the bytes, in order', () => {
  it('positive controls: a plain sentence, a canonical SIWS message, CRLF line ends, a tab', () => {
    expect(checkMessage(enc('Sign in to the test dApp.'))).toEqual({text: 'Sign in to the test dApp.'});
    expect(checkMessage(enc(siws('dapp.test', ACCOUNT.publicKey)))).toHaveProperty('text');
    expect(checkMessage(enc(siws('dapp.test', ACCOUNT.publicKey, '\r\n')))).toHaveProperty('text');
    expect(checkMessage(enc('a\tb\n'))).toHaveProperty('text');
    expect(checkMessage(enc('a'.repeat(MAX_MESSAGE_BYTES)))).toHaveProperty('text');
  });

  it('too-long: more than 4 KiB (before anything else is read)', () => {
    expect(checkMessage(enc('a'.repeat(MAX_MESSAGE_BYTES + 1)))).toEqual({refused: 'too-long'});
  });

  // Review Focus 5: the limit is bytes, not characters — 2 048 two-byte characters fit, one more byte does not.
  it('the 4 KiB limit counts UTF-8 bytes: 2 048 × "é" (4 096 bytes) passes, one byte more is too-long', () => {
    expect(checkMessage(enc('é'.repeat(2048)))).toEqual({text: 'é'.repeat(2048)});
    expect(checkMessage(enc(`${'é'.repeat(2048)}a`))).toEqual({refused: 'too-long'});
  });

  it('transaction: the printable legacy-message artifact is refused BECAUSE it deserializes; so are real transaction bytes', () => {
    const artifact = printableLegacyMessage();
    expect(artifact.length).toBe(3205);
    // It passes every other rule: printable ASCII, valid UTF-8, no control or format character.
    const text = new TextDecoder('utf-8', {fatal: true}).decode(artifact);
    expect(/^[\x20-\x7e]+$/.test(text)).toBe(true);
    expect(checkMessage(artifact)).toEqual({refused: 'transaction'});
    const {legacy, versioned} = transactionBytes();
    expect(checkMessage(legacy)).toEqual({refused: 'transaction'});
    expect(checkMessage(versioned)).toEqual({refused: 'transaction'});
  });

  it('offchain: the \\xffsolana offchain prefix — refused as offchain, not as invalid UTF-8 (the order)', () => {
    expect(checkMessage(Uint8Array.from([0xff, ...enc('solana offchain message')]))).toEqual({refused: 'offchain'});
  });

  it('utf8: not valid UTF-8 (fatal decoding) — D9: no hex preview', () => {
    expect(checkMessage(Uint8Array.of(0x68, 0xc3, 0x28))).toEqual({refused: 'utf8'});
  });

  it('control: a control character other than \\n, \\t and \\r before \\n — a lone \\r is refused', () => {
    expect(checkMessage(enc('a\u0007b'))).toEqual({refused: 'control'});
    expect(checkMessage(enc('a\rb'))).toEqual({refused: 'control'});
    expect(checkMessage(enc('a\u0085b'))).toEqual({refused: 'control'});
  });

  it('format: any \\p{Cf} — a zero-width joiner inside a keyword, a BOM, a soft hyphen, a bidi override (review 2 L6)', () => {
    for (const s of ['appr\u200Dove', '\uFEFFhello', 'per\u00ADmit', 'abc\u202Edef']) expect([s, checkMessage(enc(s))]).toEqual([s, {refused: 'format'}]);
  });
});

describe('signMessage rule 3 — Sign-In-With-Solana', () => {
  it('the second line must be the account; the domain must be the origin’s authority — host, or host:port with a port', () => {
    expect(checkSiws(siws('dapp.test', ACCOUNT.publicKey), DAPP, ACCOUNT.publicKey)).toEqual({siws: true, domain: 'dapp.test', addressOk: true, domainOk: true});
    expect(checkSiws(siws('dapp.test', ACCOUNT.publicKey, '\r\n'), DAPP, ACCOUNT.publicKey)).toEqual({siws: true, domain: 'dapp.test', addressOk: true, domainOk: true});
    expect(checkSiws(siws('dapp.test', RECIPIENT), DAPP, ACCOUNT.publicKey)).toMatchObject({addressOk: false});
    expect(checkSiws(siws('jup.ag', ACCOUNT.publicKey), 'https://www.jup.ag', ACCOUNT.publicKey)).toMatchObject({domain: 'jup.ag', domainOk: false});
    expect(checkSiws(siws('dapp.test:8443', ACCOUNT.publicKey), 'https://dapp.test:8443', ACCOUNT.publicKey)).toMatchObject({domainOk: true});
    expect(checkSiws(siws('dapp.test', ACCOUNT.publicKey), 'https://dapp.test:8443', ACCOUNT.publicKey)).toMatchObject({domainOk: false});
    expect(checkSiws('Just a sentence.', DAPP, ACCOUNT.publicKey)).toEqual({siws: false});
  });
});

describe('signMessage rule 6 — structured-approval keywords; step 5 — homoglyph marks', () => {
  it('fires on "approve", "Permit", "spending" as whole words; not on "approved" or "transference"', () => {
    expect(keywordIn('jup.ag asks you to approve the terms')?.word).toBe('approve');
    // A word is a maximal run of ASCII letters: "Permit2" holds the word "Permit".
    expect(keywordIn('Permit2 signature')?.word).toBe('permit');
    expect(keywordIn('A Permit for X')?.word).toBe('permit');
    expect(keywordIn('your spending limit')?.word).toBe('spending');
    expect(keywordIn('You approved this. A transference.')).toBeNull();
    expect(keywordIn('approve, then approve again')?.ranges).toEqual([
      {start: 0, end: 7},
      {start: 14, end: 21},
    ]);
    // The stated limit: a Cyrillic homoglyph inside the word is not detected.
    expect(keywordIn('\u0430pprove')).toBeNull();
  });

  it('marks every character outside ASCII that skel maps to Latin', () => {
    expect(homoglyphRanges('Domain: ph\u0430ntom.app')).toEqual([{start: 10, end: 11}]);
    expect(homoglyphRanges('plain ascii')).toEqual([]);
  });
});

async function setup(o: {grant?: Grant | null} = {}) {
  const ext = fakeExt();
  const deps = fakeDeps();
  await ext.local.set(VAULT_KEY, {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: ACCOUNT.publicKey}]});
  await setSession(ext, [ACCOUNT]);
  await runUnlockHook(ext, deps);
  if (o.grant !== null) await ext.local.set(GRANTS_KEY, [grant(DAPP, {scope: 'persistent', ...o.grant})]);
  const approve = {id: ext.runtimeId, origin: ext.extensionOrigin, url: `${ext.extensionOrigin}/approve.html`};
  const page = openPage(ext, deps, DAPP);
  const sign = (id: string, message: Uint8Array | string, account = ACCOUNT.publicKey) =>
    page.ask({type: 'page.signMessage', id, account, message: typeof message === 'string' ? base64.encode(enc(message)) : base64.encode(message)});
  const decide = (m: Record<string, unknown>) => handleMessage(ext, {type: 'dapp.decide', ...m}, approve, deps);
  const pend = async () => ((await handleMessage(ext, {type: 'dapp.pending'}, approve, deps)) as {data: {state: string; request: {sign: Record<string, unknown> | null}}}).data;
  return {ext, deps, page, sign, decide, pend};
}

describe('page.signMessage → #46 → the signature (§3.2 steps 1, 4, 7)', () => {
  it('rule 1: unauthorized without a grant, for another account than the granted one, and while locked', async () => {
    const none = await setup({grant: null});
    expect(await none.sign('s1', 'hello')).toEqual({id: 's1', error: 'unauthorized'});
    const c = await setup();
    expect(await c.sign('s2', 'hello', RECIPIENT)).toEqual({id: 's2', error: 'unauthorized'});
    await lock(c.ext);
    expect(await c.sign('s3', 'hello')).toEqual({id: 's3', error: 'unauthorized'});
    expect(c.ext.approval.created).toEqual([]);
  });

  it('rule 2 and 3 refusals open no window: a transaction as a message, SIWS for another address, malformed base64', async () => {
    const c = await setup();
    expect(await c.sign('t', printableLegacyMessage())).toEqual({id: 't', error: 'invalid-request'});
    expect(await c.sign('a', siws('dapp.test', RECIPIENT))).toEqual({id: 'a', error: 'invalid-request'});
    expect(await c.page.ask({type: 'page.signMessage', id: 'b', account: ACCOUNT.publicKey, message: '%%%'})).toEqual({id: 'b', error: 'invalid-request'});
    expect(c.ext.approval.created).toEqual([]);
    expect((await readDappSession(c.ext)).queue).toEqual([]);
  });

  it('a SIWS message for another domain: queued, #46 says which (Q20), and Sign is refused in the background — only Reject', async () => {
    const c = await setup();
    const r = await c.sign('m', siws('jup.ag', ACCOUNT.publicKey));
    expect(r).toMatchObject({accepted: true});
    expect((await c.pend()).request.sign).toMatchObject({siwsMismatch: 'jup.ag'});
    expect(await c.decide({requestId: r?.requestId, decision: 'approve', account: ACCOUNT.publicKey})).toEqual({ok: false, error: 'siws-mismatch'});
    expect(await c.decide({requestId: r?.requestId, decision: 'reject'})).toEqual({ok: true});
  });

  it('#46’s view: the text as text, its length in characters, the keyword and its marks, the account', async () => {
    const c = await setup();
    await c.sign('k', 'jup.ag asks you to approve the following terms.');
    expect((await c.pend()).request.sign).toEqual({
      account: {index: 0, name: 'Main', publicKey: ACCOUNT.publicKey},
      text: 'jup.ag asks you to approve the following terms.',
      chars: 47,
      keyword: 'approve',
      marks: [{start: 19, end: 26}],
      siwsMismatch: null,
    });
  });

  it('Sign: an ed25519 signature over the exact bytes, verifiable; recorded on the grant; exactly one answer', async () => {
    const c = await setup();
    const text = siws('dapp.test', ACCOUNT.publicKey);
    const r = await c.sign('s', text);
    const requestId = String(r?.requestId);
    expect(await c.decide({requestId, decision: 'approve', account: ACCOUNT.publicKey})).toEqual({ok: true});
    const answers = c.page.answersFor(requestId);
    expect(answers).toHaveLength(1);
    const {signature, signedMessage} = answers[0]?.result as {signature: string; signedMessage: string};
    expect(signedMessage).toBe(base64.encode(enc(text)));
    expect(ed25519.verify(base64.decode(signature), enc(text), base58.decode(ACCOUNT.publicKey))).toBe(true);
    expect(((await c.ext.local.get(GRANTS_KEY)) as Grant[])[0]?.recent).toEqual([{type: 'signMessage', at: c.deps.clock.t, outcome: 'approved'}]);
  });

  it('two decides racing for one request: one signature (the deciding state, C17)', async () => {
    const c = await setup();
    const r = await c.sign('s', 'hello');
    const requestId = String(r?.requestId);
    const both = await Promise.all([
      c.decide({requestId, decision: 'approve', account: ACCOUNT.publicKey}),
      c.decide({requestId, decision: 'approve', account: ACCOUNT.publicKey}),
    ]);
    expect(both).toEqual([{ok: true}, {ok: false, error: 'not-head'}]);
    expect(c.page.answersFor(requestId)).toHaveLength(1);
  });

  it('a worker restart between deciding and answered: rejected — nothing left the extension, no signature, never re-signed', async () => {
    const c = await setup();
    const r = await c.sign('s', 'hello');
    const requestId = String(r?.requestId);
    const s = await readDappSession(c.ext);
    await c.ext.session.set(DAPP_SESSION_KEY, {...s, queue: s.queue.map(e => ({...e, state: 'deciding', decidedBy: 'the-dead-instance', decidingAt: c.deps.clock.t, decision: {kind: 'approve', account: ACCOUNT.publicKey, scope: null}}))});
    expect(runtimeFor(c.ext).instance).not.toBe('the-dead-instance');
    expect(await c.page.ask({type: 'page.resume', requestIds: [requestId]})).toEqual({resume: [{requestId, error: 'rejected'}]});
    expect(await c.decide({requestId, decision: 'approve', account: ACCOUNT.publicKey})).toEqual({ok: false, error: 'not-head'});
    expect(c.page.answersFor(requestId).filter(a => 'result' in a)).toEqual([]);
  });

  it('a lock between deciding and the signature: the page gets rejected only — the signature is never delivered', async () => {
    const c = await setup();
    const r = await c.sign('s', 'hello');
    const requestId = String(r?.requestId);
    // The decision arms the auto-lock between the deciding section and the signing: a lock lands right there.
    c.ext.alarms.create = () => lock(c.ext);
    expect(await c.decide({requestId, decision: 'approve', account: ACCOUNT.publicKey})).toEqual({ok: true});
    expect(c.page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);
  });

  it('a lock and an unlock while the key is read: the second section sees an unlocked wallet, and still delivers nothing (M6j)', async () => {
    const c = await setup();
    const r = await c.sign('s', 'hello');
    const requestId = String(r?.requestId);
    // The lock above answers before finishSign's first section. This one lands after that section, during the key read
    // (the read outside any section), and the user unlocks again before the second section: the entry is answered
    // `rejected` by the lock, the session is back, and only the deciding check keeps the signature in.
    const get = c.ext.session.get;
    let fired = false;
    c.ext.session.get = async (k: string) => {
      const inFinishSign = (new Error().stack ?? '').split('\n')[3]?.includes('finishSign') === true;
      const v = await get(k);
      if (!fired && k === 'v1_session' && inFinishSign) {
        fired = true;
        await lock(c.ext);
        await setSession(c.ext, [ACCOUNT]);
      }
      return v;
    };
    expect(await c.decide({requestId, decision: 'approve', account: ACCOUNT.publicKey})).toEqual({ok: true});
    expect(fired).toBe(true);
    expect(await c.ext.session.get('v1_session')).toBeDefined();
    expect(c.page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);
  });

  it('an account removed while its key is read: the signature computed is dropped, the page gets rejected (review 1 M4)', async () => {
    const c = await setup();
    const r = await c.sign('s', 'hello');
    const requestId = String(r?.requestId);
    const get = c.ext.session.get;
    let fired = false;
    c.ext.session.get = async (k: string) => {
      const inFinishSign = (new Error().stack ?? '').split('\n')[3]?.includes('finishSign') === true;
      const v = await get(k);
      if (!fired && k === 'v1_session' && inFinishSign) {
        fired = true;
        // The key is read; the account leaves the session before the answer's section (vault.storeEnvelope's removal).
        await setSession(c.ext, [{index: 1, publicKey: RECIPIENT, secretKey: ACCOUNT.secretKey}]);
      }
      return v;
    };
    expect(await c.decide({requestId, decision: 'approve', account: ACCOUNT.publicKey})).toEqual({ok: true});
    expect(fired).toBe(true);
    expect(c.page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);
  });

  it('a host in cooldown (three rejections in ten minutes): the next sign request is rejected with no queue entry and no window (review 1 M2, C14)', async () => {
    const c = await setup();
    for (let i = 0; i < 3; i++) {
      const r = await c.sign(`r${i}`, `hello ${i}`);
      // Positive control: each of the three was queued (the grant and the checks hold).
      expect(r).toMatchObject({accepted: true});
      expect(await c.decide({requestId: String(r?.requestId), decision: 'reject'})).toEqual({ok: true});
    }
    const windowsBefore = c.ext.approval.created.length;
    expect(await c.sign('r3', 'hello 3')).toEqual({id: 'r3', error: 'rejected'});
    expect((await readDappSession(c.ext)).queue.filter(e => e.state !== 'answered')).toEqual([]);
    expect(c.ext.approval.created.length).toBe(windowsBefore);
  });

  it('decide rows for a sign request: the grant no longer held, another account (review 2 M9)', async () => {
    const c = await setup();
    const r = await c.sign('s', 'hello');
    const requestId = String(r?.requestId);
    expect(await c.decide({requestId, decision: 'approve', account: RECIPIENT})).toEqual({ok: false, error: 'unknown-account'});
    await setSession(c.ext, [ACCOUNT, {index: 1, publicKey: Keypair.fromSeed(new Uint8Array(32).fill(2)).publicKey.toBase58(), secretKey: ACCOUNT.secretKey}]);
    const other = Keypair.fromSeed(new Uint8Array(32).fill(2)).publicKey.toBase58();
    expect(await c.decide({requestId, decision: 'approve', account: other})).toEqual({ok: false, error: 'account'});
    await c.ext.local.set(GRANTS_KEY, []);
    expect(await c.decide({requestId, decision: 'approve', account: ACCOUNT.publicKey})).toEqual({ok: false, error: 'no-grant'});
  });

  it('a revoke answers the origin’s queued sign request rejected (review 2 M9)', async () => {
    const c = await setup();
    const r = await c.sign('s', 'hello');
    const popup = {id: c.ext.runtimeId, origin: c.ext.extensionOrigin, url: `${c.ext.extensionOrigin}/popup.html`};
    await handleMessage(c.ext, {type: 'dapp.grants.revoke', origin: DAPP}, popup, c.deps);
    expect(c.page.answersFor(String(r?.requestId))).toEqual([{requestId: r?.requestId, error: 'rejected'}]);
  });
});
