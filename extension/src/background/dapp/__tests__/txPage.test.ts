import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {PublicKey, SystemProgram, Transaction, TransactionInstruction, TransactionMessage, VersionedTransaction} from '@solana/web3.js';
import {setSession} from '../../session';
import {lock} from '../../autolock';
import {VAULT_KEY} from '../../accountsStore';
import {BLOCKED_KEY} from '../blocked';
import {GRANTS_KEY, type Grant} from '../grants';
import {LIMITS_KEY, WINDOW_BUDGET, limitsOf} from '../limits';
import {MAX_OPEN, REQUEST_TTL_MS, runUnlockHook} from '../queue';
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
  it('a request naming an account granted to ANOTHER origin: unauthorized at once, and a notice entry queued for the window to show (once one exists — fix round 3: alone, it opens none)', async () => {
    const c = await setup({grant: null, others: [grant(OTHER)]});
    expect(await c.signTx('m', [v0()])).toEqual({id: 'm', error: 'unauthorized'});
    const [notice] = await c.queue();
    expect(notice).toMatchObject({type: 'mismatch', pageId: '', origin: DAPP, account: ACCOUNT.publicKey, granted: OTHER, transactions: null, state: 'queued'});
    expect(c.ext.approval.created).toEqual([]);
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
    // Fix round 3: with no real request ever queued alongside it, nothing ever writes LIMITS_KEY in this flow at
    // all (no window opens, so WINDOW_BUDGET's own write never runs either) — `limitsOf` normalizes "nothing
    // stored" the same way the background itself reads it, rather than assuming the key exists.
    expect(limitsOf(await c.ext.local.get(LIMITS_KEY), c.deps.clock.t).rejections).toEqual([]);
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

  // Fix round 3, controller ruling (STRUCTURAL): a mismatch notice never by itself opens a window — only a REAL
  // request does, identically whether or not a notice happens to be queued too. (a) a follow-up real request from
  // the same page opens its own focused window, whether or not the preceding signTransaction matched a grant held
  // elsewhere.
  it('a follow-up real request opens its own focused window, identically whether an earlier signTransaction on the same page matched or not', async () => {
    for (const matched of [true, false]) {
      const c = await setup(matched ? {grant: null, others: [grant(OTHER)]} : {grant: null});
      expect(await c.signTx('m', [v0()])).toEqual({id: 'm', error: 'unauthorized'});
      // No window yet — a notice (matched or not) never opens one by itself.
      expect(c.ext.approval.created).toEqual([]);
      expect(await c.page.ask({type: 'page.connect', id: 'c1', silent: false})).toMatchObject({accepted: true});
      expect(c.ext.approval.created).toEqual([{page: 'approve.html', width: WINDOW_WIDTH, height: WINDOW_HEIGHT}]);
    }
  });

  // (b) with the real window budget already spent, a second tab's genuinely real connect is rejected (Q24), with no
  // window — identically whether an earlier tab's signTransaction matched a grant held elsewhere or not. Before the
  // structural fix, a notice-headed open skipped this gate entirely, making the outcome depend on the match.
  it('with the real window budget spent, a second tabs real connect is rejected (Q24) with no window, identically whether an earlier tabs signTransaction matched or not', async () => {
    for (const matched of [true, false]) {
      const c = await setup(matched ? {grant: null, others: [grant(OTHER)]} : {grant: null});
      await c.ext.local.set(LIMITS_KEY, {rejections: [], cooldowns: [], windows: Array.from({length: WINDOW_BUDGET}, () => c.deps.clock.t), notice: false});
      // tab1: a signTransaction naming X — never opens a window, matched or not.
      expect(await c.signTx('m', [v0()])).toEqual({id: 'm', error: 'unauthorized'});
      expect(c.ext.approval.created).toEqual([]);
      // tab2: a genuinely real connect — accepted inline, then rejected once the budget gate runs; no window.
      const tab2 = openPage(c.ext, c.deps, DAPP, {tab: {id: TAB + 1}, documentId: 'doc-tab2'});
      const r = await tab2.ask({type: 'page.connect', id: 'c1', silent: false});
      expect(r).toMatchObject({accepted: true});
      expect(c.ext.approval.created).toEqual([]);
      expect(tab2.answersFor(String(r?.requestId))).toEqual([{requestId: r?.requestId, error: 'rejected'}]);
      expect(((await c.ext.local.get(LIMITS_KEY)) as {notice: boolean}).notice).toBe(true);
    }
  });

  // (c) a mismatch notice alone — nothing else ever queued — never opens a window.
  it('a mismatch notice alone never opens a window', async () => {
    const c = await setup({grant: null, others: [grant(OTHER)]});
    expect(await c.signTx('m', [v0()])).toEqual({id: 'm', error: 'unauthorized'});
    expect((await c.queue()).filter(e => e.type === 'mismatch')).toHaveLength(1);
    expect(c.ext.approval.created).toEqual([]);
  });

  // (d) a notice queued while a real request's window is already open rides along in it (shown in FIFO turn,
  // dismiss-only) — it never opens a second window, and dismissing it changes nothing about the first.
  it('a notice queued while a real requests window is already open rides along in it, in turn, and stays dismissable', async () => {
    const c = await setup({grant: null, others: [grant(OTHER)]});
    const real = await c.page.ask({type: 'page.connect', id: 'real', silent: false});
    expect(real).toMatchObject({accepted: true});
    expect(c.ext.approval.created).toHaveLength(1);
    // A different page (different host/tab — the real connect's own host/tab is already open, which would itself
    // cap a notice) sends a signTransaction naming the same account X, granted to OTHER.
    const visitor = openPage(c.ext, c.deps, 'https://evil.test', {tab: {id: TAB + 5}, documentId: 'doc-visitor'});
    expect(await visitor.ask({type: 'page.signTransaction', id: 'm', account: ACCOUNT.publicKey, transactions: [v0()]})).toEqual({id: 'm', error: 'unauthorized'});
    // Still just the one window — the notice rode along; no second one opened for it.
    expect(c.ext.approval.created).toHaveLength(1);
    const notice = (await c.queue()).find(e => e.type === 'mismatch');
    expect(notice).toBeDefined();
    const approve = {id: c.ext.runtimeId, origin: c.ext.extensionOrigin, url: `${c.ext.extensionOrigin}/approve.html`};
    const {handleMessage} = await import('../../messages');
    // FIFO: the real connect was queued first, so it is head — dismiss it first, which makes the notice head.
    expect(await handleMessage(c.ext, {type: 'dapp.decide', requestId: String(real?.requestId), decision: 'reject'}, approve, c.deps)).toEqual({ok: true});
    expect(await handleMessage(c.ext, {type: 'dapp.decide', requestId: String(notice?.requestId), decision: 'reject'}, approve, c.deps)).toEqual({ok: true});
    expect((await c.queue()).find(e => e.requestId === notice?.requestId)).toMatchObject({state: 'answered', answer: {error: 'rejected'}});
    // Dismissing it never opened (or needed) a second window.
    expect(c.ext.approval.created).toHaveLength(1);
  });

  // (e) a notice with no real request ever queued is never shown, and simply expires at C4 (REQUEST_TTL_MS) like any
  // undecided entry — no window, nothing special on timeout (the page already got `unauthorized` synchronously).
  it('a mismatch notice with no real request ever queued expires silently at C4, no window at any point', async () => {
    const c = await setup({grant: null, others: [grant(OTHER)]});
    expect(await c.signTx('m', [v0()])).toEqual({id: 'm', error: 'unauthorized'});
    const notice = (await c.queue()).find(e => e.type === 'mismatch');
    expect(notice).toBeDefined();
    expect(c.ext.approval.created).toEqual([]);
    c.deps.clock.t += REQUEST_TTL_MS;
    await runUnlockHook(c.ext, c.deps);
    expect((await c.queue()).find(e => e.requestId === notice?.requestId)).toMatchObject({state: 'answered', answer: {error: 'timeout'}});
    expect(c.ext.approval.created).toEqual([]);
  });

  // Fix round 4, controller ruling 1 (probe P1): a notice never calls ensureWindow. ensureWindow opens a window for ANY
  // real entry left without one — here tab2's connect, whose windows.create failed — so calling it on a notice opened
  // a focused, budget-charged window (or, with the budget spent, ran rejectQueued + Q24 on tab2's entry) only when X
  // was granted elsewhere. Every observable here must be identical, matched or not, with the budget free or spent.
  it('a stranded real entry (its windows.create failed): a later signTransaction naming X changes nothing observable, identically whether X is granted elsewhere or not', async () => {
    for (const spent of [false, true]) {
      const seen: unknown[] = [];
      for (const matched of [true, false]) {
        const c = await setup(matched ? {grant: null, others: [grant(OTHER)]} : {grant: null});
        const tab2 = openPage(c.ext, c.deps, 'https://second.test', {tab: {id: TAB + 1}, documentId: 'doc-tab2'});
        c.ext.approval.failNext = true;
        await expect(tab2.ask({type: 'page.connect', id: 'c2', silent: false})).rejects.toThrow('windows.create failed');
        const stranded = (await c.queue()).find(e => e.type === 'connect');
        expect(stranded).toMatchObject({state: 'queued'});
        expect((await readDappSession(c.ext)).window).toBeNull();
        if (spent) await c.ext.local.set(LIMITS_KEY, {rejections: [], cooldowns: [], windows: Array.from({length: WINDOW_BUDGET}, () => c.deps.clock.t), notice: false});
        expect(await c.signTx('m', [v0()])).toEqual({id: 'm', error: 'unauthorized'});
        // The precondition that makes the pair meaningful: a notice was queued only in the matched case.
        expect((await c.queue()).filter(e => e.type === 'mismatch')).toHaveLength(matched ? 1 : 0);
        const limits = limitsOf(await c.ext.local.get(LIMITS_KEY), c.deps.clock.t);
        const obs = {
          created: c.ext.approval.created.length,
          window: (await readDappSession(c.ext)).window,
          budget: {windows: limits.windows.length, notice: limits.notice},
          stranded: (await c.queue()).find(e => e.requestId === stranded?.requestId)?.state,
          tab2: tab2.port.posted.filter(x => !('accepted' in x)),
          page: c.page.port.posted.filter(x => x.id !== 'm'),
        };
        expect(obs).toMatchObject({created: 0, window: null, stranded: 'queued', tab2: [], page: []});
        seen.push(obs);
      }
      expect(seen[0]).toEqual(seen[1]);
    }
  });

  // Fix round 4, controller ruling 2: deliver never posts a notice's answer to any port — not on its dismissal, not
  // at its C4 timeout. Positive control: the same page's real request, rejected the same way, is delivered.
  it('a notice answer is never posted to any port (dismissed or timed out); positive control: a real request of the same page is', async () => {
    const c = await setup({grant: null, others: [grant(OTHER)]});
    expect(await c.signTx('m', [v0()])).toEqual({id: 'm', error: 'unauthorized'});
    const real = await c.page.ask({type: 'page.connect', id: 'c1', silent: false});
    expect(real).toMatchObject({accepted: true});
    const notice = (await c.queue()).find(e => e.type === 'mismatch');
    expect(notice).toMatchObject({tabId: TAB, origin: DAPP});
    const approve = {id: c.ext.runtimeId, origin: c.ext.extensionOrigin, url: `${c.ext.extensionOrigin}/approve.html`};
    const {handleMessage} = await import('../../messages');
    expect(await handleMessage(c.ext, {type: 'dapp.decide', requestId: String(notice?.requestId), decision: 'reject'}, approve, c.deps)).toEqual({ok: true});
    expect((await c.queue()).find(e => e.requestId === notice?.requestId)).toMatchObject({state: 'answered', answer: {error: 'rejected'}});
    expect(c.page.answersFor(String(notice?.requestId))).toEqual([]);
    expect(await handleMessage(c.ext, {type: 'dapp.decide', requestId: String(real?.requestId), decision: 'reject'}, approve, c.deps)).toEqual({ok: true});
    expect(c.page.answersFor(String(real?.requestId))).toEqual([{requestId: real?.requestId, error: 'rejected'}]);

    const expired = await setup({grant: null, others: [grant(OTHER)]});
    expect(await expired.signTx('m', [v0()])).toEqual({id: 'm', error: 'unauthorized'});
    const late = (await expired.queue()).find(e => e.type === 'mismatch');
    expired.deps.clock.t += REQUEST_TTL_MS;
    await runUnlockHook(expired.ext, expired.deps);
    expect((await expired.queue()).find(e => e.requestId === late?.requestId)).toMatchObject({state: 'answered', answer: {error: 'timeout'}});
    expect(expired.page.answersFor(String(late?.requestId))).toEqual([]);
    expect(expired.page.port.posted.filter(x => x.id !== 'm')).toEqual([]);
  });
});
