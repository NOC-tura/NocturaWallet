import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {PublicKey, SystemProgram, Transaction, TransactionInstruction, TransactionMessage, VersionedTransaction} from '@solana/web3.js';
import {setSession} from '../../session';
import {lock} from '../../autolock';
import {VAULT_KEY} from '../../accountsStore';
import {BLOCKED_KEY} from '../blocked';
import {GRANTS_KEY, type Grant} from '../grants';
import {LIMITS_KEY, NOTICE_WINDOW_BUDGET, budgetLeft} from '../limits';
import {MAX_OPEN, runUnlockHook} from '../queue';
import {readDappSession} from '../store';
import {WINDOW_HEIGHT, WINDOW_WIDTH} from '../window';
import {MAX_TX_BYTES} from '../decode/wire';
import {fakeExt} from '../../__tests__/fakeExt';
import {fakeDeps} from '../../__tests__/fakeDeps';
import {ACCOUNT, BLOCKHASH, RECIPIENT} from '../../__tests__/fixtures';
import {TAB, openPage} from './pageHarness';

const DAPP = 'https://dapp.test';
const OTHER = 'https://jup.ag';
const ME = new PublicKey(ACCOUNT.publicKey);
const TO = new PublicKey(RECIPIENT);
/** A co-signer (a dApp's own key): a real keypair, 32 × 0x03. */
const CO_SEED = new Uint8Array(32).fill(3);
const CO = new PublicKey(ed25519.getPublicKey(CO_SEED));
const grant = (origin: string, over: Partial<Grant> = {}): Grant => ({origin, account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: 1, lastUsedAt: 1, recent: [], ...over});

const message = (instructions: TransactionInstruction[], payer = ME) => new TransactionMessage({payerKey: payer, recentBlockhash: BLOCKHASH, instructions}).compileToV0Message();
const transfer = (lamports = 1, from = ME) => SystemProgram.transfer({fromPubkey: from, toPubkey: TO, lamports});
const v0 = (instructions: TransactionInstruction[] = [transfer()], payer = ME): string => base64.encode(new VersionedTransaction(message(instructions, payer)).serialize());
/** A v0 transaction the co-signer pays for and signs; the account signs too (a required signer). */
function coSigned(o: {sign?: boolean; corrupt?: boolean} = {}): string {
  const tx = new VersionedTransaction(message([transfer(1, ME)], CO));
  if (o.sign !== false) {
    const sig = ed25519.sign(tx.message.serialize(), CO_SEED);
    if (o.corrupt === true) sig[0] = (sig[0] ?? 0) ^ 1;
    tx.addSignature(CO, sig);
  }
  return base64.encode(tx.serialize());
}

async function setup(o: {grant?: Grant | null; others?: Grant[]} = {}) {
  const ext = fakeExt();
  const deps = fakeDeps();
  await ext.local.set(VAULT_KEY, {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: ACCOUNT.publicKey}]});
  await setSession(ext, [ACCOUNT]);
  await runUnlockHook(ext, deps);
  await ext.local.set(GRANTS_KEY, [...(o.grant === null ? [] : [o.grant ?? grant(DAPP)]), ...(o.others ?? [])]);
  const page = openPage(ext, deps, DAPP);
  const signTx = (id: string, transactions: unknown, over: Record<string, unknown> = {}) => page.ask({type: 'page.signTransaction', id, account: ACCOUNT.publicKey, transactions, ...over});
  const send = (id: string, transaction: unknown, over: Record<string, unknown> = {}) => page.ask({type: 'page.signAndSendTransaction', id, account: ACCOUNT.publicKey, transaction, ...over});
  const queue = async () => (await readDappSession(ext)).queue;
  return {ext, deps, page, signTx, send, queue};
}

// Spec B1c §1.4, §3.3: the two transaction requests, each refusal by its reason and in its order, before any window.
describe('page.signTransaction and page.signAndSendTransaction — the page side', () => {
  it('positive controls: a single transaction, a batch of five, a legacy one, a sign-and-send — queued with the bytes as sent, one window', async () => {
    const c = await setup();
    const one = await c.signTx('t1', [v0()]);
    expect(one).toEqual({id: 't1', accepted: true, requestId: expect.stringMatching(/^[A-Za-z0-9_-]{22}$/)});
    expect((await c.queue())[0]).toMatchObject({type: 'signTransaction', account: ACCOUNT.publicKey, transactions: [v0()], state: 'queued', tabId: TAB, origin: DAPP});
    expect(c.ext.approval.created).toHaveLength(1);
    // The same request re-sent (its accepted lost with the port): the same entry (C9).
    expect(await c.signTx('t1', [v0()])).toEqual(one);
    const batch = await setup();
    expect(await batch.signTx('b', [1, 2, 3, 4, 5].map(n => v0([transfer(n)])))).toMatchObject({accepted: true});
    expect((await batch.queue())[0]?.transactions).toHaveLength(5);
    const legacy = await setup();
    const bytes = new Transaction({feePayer: ME, recentBlockhash: BLOCKHASH}).add(transfer()).serialize({requireAllSignatures: false, verifySignatures: false});
    expect(await legacy.signTx('l', [base64.encode(bytes)])).toMatchObject({accepted: true});
    const send = await setup();
    expect(await send.send('s', v0(), {options: {skipPreflight: true}})).toMatchObject({accepted: true});
    expect((await send.queue())[0]).toMatchObject({type: 'signAndSendTransaction', transactions: [v0()]});
  });

  it('invalid-request before the grant is read (§9): six transactions, none, not a list, one over 1 232 bytes, trailing bytes, another chain, a bad account', async () => {
    for (const grant of [undefined, null]) {
      const c = await setup(grant === null ? {grant: null} : {});
      const filler = (n: number) => v0([new TransactionInstruction({programId: TO, keys: [{pubkey: ME, isSigner: true, isWritable: true}], data: Buffer.alloc(n)})]);
      let n = 900;
      while (base64.decode(filler(n)).length <= MAX_TX_BYTES) n++;
      const cases: [string, unknown, Record<string, unknown>][] = [
        ['six', [1, 2, 3, 4, 5, 6].map(i => v0([transfer(i)])), {}],
        ['none', [], {}],
        ['not-a-list', v0(), {}],
        ['too-long', [filler(n)], {}],
        ['trailing', [base64.encode(Uint8Array.of(...base64.decode(v0()), 0))], {}],
        ['chain', [v0()], {chain: 'solana:devnet'}],
        ['account', [v0()], {account: 'not-a-key'}],
        ['garbage', ['%%%'], {}],
      ];
      for (const [id, txs, over] of cases) expect([id, await c.signTx(id, txs, over)]).toEqual([id, {id, error: 'invalid-request'}]);
      expect(await c.send('opts', v0(), {options: 'skip'})).toEqual({id: 'opts', error: 'invalid-request'});
      expect(c.ext.approval.created).toEqual([]);
      expect(await c.queue()).toEqual([]);
    }
  });

  it('unauthorized: no grant, a grant for another account, while locked — and the chain may be named', async () => {
    const none = await setup({grant: null});
    expect(await none.signTx('a', [v0()])).toEqual({id: 'a', error: 'unauthorized'});
    const other = await setup({grant: grant(DAPP, {account: RECIPIENT})});
    expect(await other.signTx('b', [v0()])).toEqual({id: 'b', error: 'unauthorized'});
    const locked = await setup();
    await lock(locked.ext);
    expect(await locked.send('c', v0())).toEqual({id: 'c', error: 'unauthorized'});
    const ok = await setup();
    expect(await ok.signTx('d', [v0()], {chain: 'solana:mainnet'})).toMatchObject({accepted: true});
  });

  it('the account must sign every transaction (fee payer or a required signer): one it does not sign is invalid-request', async () => {
    const c = await setup();
    expect(await c.signTx('x', [v0(), v0([transfer(1, TO)], TO)])).toEqual({id: 'x', error: 'invalid-request'});
    // A required signer that is not the fee payer is enough.
    expect(await c.signTx('y', [coSigned({sign: false})])).toMatchObject({accepted: true});
  });

  it('signAndSend: every other signature present and valid, no durable nonce; positive control: a co-signed one is queued', async () => {
    const c = await setup();
    expect(await c.send('unsigned', coSigned({sign: false}))).toEqual({id: 'unsigned', error: 'invalid-request'});
    expect(await c.send('corrupt', coSigned({corrupt: true}))).toEqual({id: 'corrupt', error: 'invalid-request'});
    const nonce = v0([SystemProgram.nonceAdvance({noncePubkey: TO, authorizedPubkey: ME}), transfer()]);
    expect(await c.send('nonce', nonce)).toEqual({id: 'nonce', error: 'invalid-request'});
    // signTransaction signs a durable-nonce transaction (the dApp sends it).
    expect(await c.signTx('nonce-sign', [nonce])).toMatchObject({accepted: true});
    const d = await setup();
    expect(await d.send('ok', coSigned())).toMatchObject({accepted: true});
  });

  it('signAndSend: the same message while the first is unanswered is rejected (§3.3) — from another tab of another granted origin too', async () => {
    const c = await setup({others: [grant(OTHER)]});
    expect(await c.send('s1', v0())).toMatchObject({accepted: true});
    const second = openPage(c.ext, c.deps, OTHER, {tab: {id: TAB + 1}, documentId: 'doc-9'});
    expect(await second.ask({type: 'page.signAndSendTransaction', id: 's2', account: ACCOUNT.publicKey, transaction: v0()})).toEqual({id: 's2', error: 'rejected'});
    // Another message from that tab is admitted (positive control: the rule is the message, not the tab).
    expect(await second.ask({type: 'page.signAndSendTransaction', id: 's3', account: ACCOUNT.publicKey, transaction: v0([transfer(2)])})).toMatchObject({accepted: true});
  });

  it('a blocked or cooling-down host is rejected with no entry; C3: a second open request from the host is request-pending', async () => {
    const blocked = await setup();
    await blocked.ext.local.set(BLOCKED_KEY, [{host: 'dapp.test', blockedAt: 1, imitates: null}]);
    // A restore keeps a block and a lingering grant (D3): rejected, as signMessage — no entry, no window.
    expect(await blocked.signTx('a', [v0()])).toEqual({id: 'a', error: 'rejected'});
    expect(await blocked.queue()).toEqual([]);
    const cooling = await setup();
    await cooling.ext.local.set(LIMITS_KEY, {rejections: [], cooldowns: [{key: 'host:dapp.test', until: cooling.deps.clock.t + 60_000}], windows: [], notice: false});
    expect(await cooling.signTx('b', [v0()])).toEqual({id: 'b', error: 'rejected'});
    expect(await cooling.queue()).toEqual([]);
    const c = await setup();
    expect(await c.signTx('c', [v0()])).toMatchObject({accepted: true});
    expect(await c.send('d', v0([transfer(3)]))).toEqual({id: 'd', error: 'request-pending'});
  });
});

// #48 "origin-mismatch · auto-reject" (B1 §3: no override): the account another origin was granted.
describe('the origin-mismatch notice', () => {
  it('a request naming an account granted to ANOTHER origin: unauthorized at once, and a notice entry the window shows', async () => {
    const c = await setup({grant: null, others: [grant(OTHER)]});
    expect(await c.signTx('m', [v0()])).toEqual({id: 'm', error: 'unauthorized'});
    const [notice] = await c.queue();
    expect(notice).toMatchObject({type: 'mismatch', pageId: '', origin: DAPP, account: ACCOUNT.publicKey, granted: OTHER, transactions: null, state: 'queued'});
    expect(c.ext.approval.created).toHaveLength(1);
    // The page is never answered from it: a re-send of the same id is a new request (unauthorized again), not the notice.
    expect(await c.signTx('m', [v0()])).toEqual({id: 'm', error: 'unauthorized'});
    expect(c.page.answersFor(String(notice?.requestId))).toEqual([]);
  });

  it('negative controls — no notice: an account granted to nobody, an account not in the session, while locked, a blocked host, a cooling host, C3', async () => {
    const nobody = await setup({grant: null});
    expect(await nobody.signTx('a', [v0()])).toEqual({id: 'a', error: 'unauthorized'});
    expect(await nobody.queue()).toEqual([]);
    const stranger = await setup({grant: null, others: [grant(OTHER, {account: RECIPIENT})]});
    const tx = base64.encode(new VersionedTransaction(message([transfer(1, TO)], TO)).serialize());
    expect(await stranger.signTx('b', [tx], {account: RECIPIENT})).toEqual({id: 'b', error: 'unauthorized'});
    expect(await stranger.queue()).toEqual([]);
    const locked = await setup({grant: null, others: [grant(OTHER)]});
    await lock(locked.ext);
    expect(await locked.signTx('c', [v0()])).toEqual({id: 'c', error: 'unauthorized'});
    expect((await locked.queue()).filter(e => e.state === 'queued')).toEqual([]);
    const blocked = await setup({grant: null, others: [grant(OTHER)]});
    await blocked.ext.local.set(BLOCKED_KEY, [{host: 'dapp.test', blockedAt: 1, imitates: null}]);
    expect(await blocked.signTx('d', [v0()])).toEqual({id: 'd', error: 'unauthorized'});
    expect(await blocked.queue()).toEqual([]);
    const blockedGrant = await setup({grant: null, others: [grant(OTHER)]});
    await blockedGrant.ext.local.set(BLOCKED_KEY, [{host: 'jup.ag', blockedAt: 1, imitates: null}]);
    expect(await blockedGrant.signTx('e', [v0()])).toEqual({id: 'e', error: 'unauthorized'});
    expect(await blockedGrant.queue()).toEqual([]);
    const cooling = await setup({grant: null, others: [grant(OTHER)]});
    await cooling.ext.local.set(LIMITS_KEY, {rejections: [], cooldowns: [{key: `tab:${TAB}`, until: cooling.deps.clock.t + 60_000}], windows: [], notice: false});
    expect(await cooling.signTx('h', [v0()])).toEqual({id: 'h', error: 'unauthorized'});
    expect(await cooling.queue()).toEqual([]);
    const capped = await setup({grant: null, others: [grant(OTHER)]});
    expect(await capped.signTx('f', [v0()])).toEqual({id: 'f', error: 'unauthorized'});
    expect(await capped.signTx('g', [v0()])).toEqual({id: 'g', error: 'unauthorized'});
    expect((await capped.queue()).filter(e => e.type === 'mismatch')).toHaveLength(1);
  });

  it('a notice is only ever dismissed: approve, report and block are refused; reject answers it, and records NO rejection (fix round 1: the cooldown would leak the same bit after a user action)', async () => {
    const c = await setup({grant: null, others: [grant(OTHER)]});
    await c.signTx('m', [v0()]);
    const requestId = String((await c.queue())[0]?.requestId);
    const approve = {id: c.ext.runtimeId, origin: c.ext.extensionOrigin, url: `${c.ext.extensionOrigin}/approve.html`};
    const {handleMessage} = await import('../../messages');
    for (const decision of ['approve', 'report', 'block']) {
      expect(await handleMessage(c.ext, {type: 'dapp.decide', requestId, decision, account: ACCOUNT.publicKey}, approve, c.deps)).toEqual({ok: false, error: 'malformed'});
    }
    expect(await handleMessage(c.ext, {type: 'dapp.decide', requestId, decision: 'reject'}, approve, c.deps)).toEqual({ok: true});
    expect((await c.queue())[0]).toMatchObject({state: 'answered', answer: {error: 'rejected'}});
    expect(((await c.ext.local.get(LIMITS_KEY)) as {rejections: unknown[]}).rejections).toEqual([]);
    expect(base58.decode(ACCOUNT.publicKey)).toHaveLength(32);
  });

  // Fix round 1, controller ruling: a mismatch notice is a two-message oracle otherwise — admit() must never count it
  // against the host's own real requests, or a site could learn (from a later request-pending) that its named
  // account is held elsewhere.
  it('a queued notice never blocks a later request from this host: an explicit connect after it is accepted, exactly as when there was no notice at all', async () => {
    const withNotice = await setup({grant: null, others: [grant(OTHER)]});
    expect(await withNotice.signTx('m', [v0()])).toEqual({id: 'm', error: 'unauthorized'});
    expect((await withNotice.queue()).filter(e => e.type === 'mismatch')).toHaveLength(1);
    const afterNotice = await withNotice.page.ask({type: 'page.connect', id: 'c1', silent: false});
    expect(afterNotice).toMatchObject({accepted: true});
    const noNotice = await setup({grant: null});
    expect(await noNotice.signTx('m', [v0()])).toEqual({id: 'm', error: 'unauthorized'});
    expect(await noNotice.queue()).toEqual([]);
    const baseline = await noNotice.page.ask({type: 'page.connect', id: 'c1', silent: false});
    expect(baseline).toMatchObject({accepted: true});
    // Identical shape either way — the notice changed nothing a page can observe.
    expect(Object.keys(afterNotice ?? {}).sort()).toEqual(Object.keys(baseline ?? {}).sort());
  });

  // Fix round 1: the notice gets its OWN cap (any type, this host or tab; and the global window budget) — it never
  // borrows admit()'s (now mismatch-excluding) count, or it could stack past the budget unnoticed.
  it('the notice cap: the global window budget still bounds it (admit now excludes a mismatch from its own checks, but the notice carries its own cap)', async () => {
    const c = await setup({grant: null, others: [grant(OTHER)]});
    for (let i = 0; i < MAX_OPEN; i++) {
      const filler = openPage(c.ext, c.deps, `https://filler${i}.test`, {tab: {id: 100 + i}, documentId: `doc-f${i}`});
      expect(await filler.ask({type: 'page.connect', id: `f${i}`, silent: false})).toMatchObject({accepted: true});
    }
    expect((await c.queue()).length).toBe(MAX_OPEN);
    // X is granted to OTHER — ordinarily a notice — but the budget is already spent: silent, no entry at all.
    expect(await c.signTx('capped-budget', [v0()])).toEqual({id: 'capped-budget', error: 'unauthorized'});
    expect((await c.queue()).filter(e => e.type === 'mismatch')).toEqual([]);
  });

  // Fix round 2, controller ruling, Minor test gap: the "any type" clause of the notice's own cap (pageApi.ts, the
  // `open.some(e => e.host === live.host || e.tabId === live.tabId)` line) must count a REAL open entry too, not
  // only another notice — otherwise a site with one real request already open could still stack a notice beside it.
  it('the notice cap counts an open entry of ANY type for this host or tab: a real request already open blocks a new notice too', async () => {
    const c = await setup({grant: null, others: [grant(OTHER)]});
    expect(await c.page.ask({type: 'page.connect', id: 'real', silent: false})).toMatchObject({accepted: true});
    // X is granted to OTHER — ordinarily a notice — but this host/tab already has an open entry (the connect above).
    expect(await c.signTx('m', [v0()])).toEqual({id: 'm', error: 'unauthorized'});
    expect((await c.queue()).filter(e => e.type === 'mismatch')).toEqual([]);
  });

  // Fix round 2, controller ruling channel 1: a window opened BECAUSE a mismatch notice is the head is created
  // unfocused — the page must never learn, from a focus change right after its `unauthorized` reply, that its
  // request was the one that opened a window (only true when the named account is held elsewhere). A window for a
  // real request stays focused, exactly as before.
  it('a window opened because of a mismatch notice is unfocused; the window for a real request stays focused', async () => {
    const real = await setup({grant: null});
    expect(await real.page.ask({type: 'page.connect', id: 'c1', silent: false})).toMatchObject({accepted: true});
    expect(real.ext.approval.created).toEqual([{page: 'approve.html', width: WINDOW_WIDTH, height: WINDOW_HEIGHT, focused: true}]);

    const notice = await setup({grant: null, others: [grant(OTHER)]});
    expect(await notice.signTx('m', [v0()])).toEqual({id: 'm', error: 'unauthorized'});
    expect(notice.ext.approval.created).toEqual([{page: 'approve.html', width: WINDOW_WIDTH, height: WINDOW_HEIGHT, focused: false}]);
  });

  // Fix round 2, controller ruling channel 2: the notice has its OWN window budget (3 per ten minutes), entirely
  // apart from the real WINDOW_BUDGET a genuine request's window draws from — so a page cannot spend that shared
  // budget (meant for real requests) by triggering notices the user dismisses. Exhausting it is silent: no new
  // notice entry at all, never the `rejected`-with-Q24 behaviour a spent WINDOW_BUDGET uses.
  it('the notice has its own window budget, separate from WINDOW_BUDGET: a 4th notice within ten minutes is silently not queued, and none of it ever touches the real budget', async () => {
    const c = await setup({grant: null, others: [grant(OTHER)]});
    // Ten distinct origins (and tabs), each a would-be notice for the same account X, all within the same instant.
    for (let i = 0; i < 10; i++) {
      const site = openPage(c.ext, c.deps, `https://notice${i}.test`, {tab: {id: 300 + i}, documentId: `doc-n${i}`});
      expect(await site.ask({type: 'page.signTransaction', id: `m${i}`, account: ACCOUNT.publicKey, transactions: [v0()]})).toEqual({id: `m${i}`, error: 'unauthorized'});
    }
    // Only NOTICE_WINDOW_BUDGET became real entries — the rest were silently refused (no entry, no extra error).
    expect((await c.queue()).filter(e => e.type === 'mismatch')).toHaveLength(NOTICE_WINDOW_BUDGET);
    // Exactly one window ever opened (the first notice; later ones found one already open) — and it is unfocused.
    expect(c.ext.approval.created).toEqual([{page: 'approve.html', width: WINDOW_WIDTH, height: WINDOW_HEIGHT, focused: false}]);
    // None of this spent the real window budget: it reads back empty, and a real request's budget is still full.
    const stored = (await c.ext.local.get(LIMITS_KEY)) as {windows: unknown[]};
    expect(stored.windows).toEqual([]);
    expect(budgetLeft({rejections: [], cooldowns: [], windows: stored.windows as number[], noticeWindows: [], notice: false}, c.deps.clock.t)).toBe(true);
  });
});
