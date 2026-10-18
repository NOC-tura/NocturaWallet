import {test, expect, type Locator, type Page} from '@playwright/test';
import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {contained, launchPopup, type Harness} from './popupHarness';
import {E2E_ACCOUNTS, E2E_PASSWORD, makeEnvelope} from './makeEnvelope';
import {unlockWith} from './vaultPage';
import {DAPP_HOSTS, adapter, approvalWindow, connect, features, noWindow, openDapp, rawSignTx, relayed, sendTx, serveDapp, signTx, windowClosed, type DappServer, type RawIx} from './dappPage';
import {ATA_PROGRAM, TOKEN_2022_PROGRAM, TOKEN_PROGRAM, mintData, parseV0, type FakeCoordinator} from './fakeCoordinator';

// Spec B1c §6.3 (B1c-2), §3.3, §1.4: the transaction features against the real extension — the provider, the relay,
// the background's decoder and simulation (through the fake coordinator's proxy), #48 in the approval window, the
// broadcast route — with the test dApp's own @solana/web3.js transactions, driven raw and through
// @solana/wallet-adapter's StandardWalletAdapter (review-1 M1). Titles "B1c-NN · " as B1c-1's. Chromium only (B1c-1's
// note: Firefox's port.sender.origin is a line of B1e's manual run).
declare const chrome: {
  storage: {local: {set(o: object): Promise<void>; get(k: string): Promise<Record<string, unknown>>}};
  runtime: {sendMessage(m: unknown): Promise<unknown>};
};

const ACCOUNT = E2E_ACCOUNTS[0];
const DAPP = 'https://dapp.test';
/** The test dApp's recipient (e2e/fixtures/dapp/page.ts). */
const RECIPIENT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
/** Any 32 bytes serve as the dApp's blockhash: the fake's simulation reads none of it. */
const BLOCKHASH = base58.encode(new Uint8Array(32).fill(7));

async function scene(prefix: string, o: {knownRecipient?: boolean} = {}): Promise<{h: Harness; server: DappServer}> {
  const h = await launchPopup(prefix, {hosts: DAPP_HOSTS});
  const server = await serveDapp(h.ctx);
  await h.sw.evaluate(env => chrome.storage.local.set({v1_vault: env}), await makeEnvelope());
  // B1b's first-send rule asks for a re-authentication unless the recipient was sent to before (B1c-28 is about that).
  if (o.knownRecipient !== false) await h.sw.evaluate(r => chrome.storage.local.set({v1_known_recipients: [{address: r, at: Date.now()}]}), RECIPIENT);
  const vault = await h.ctx.newPage();
  await unlockWith(vault, h.id, E2E_PASSWORD);
  await vault.close();
  return {h, server};
}
function done(h: Harness, server: DappServer): void {
  contained(h);
  expect(server.unexpected).toEqual([]);
}
async function popup(h: Harness): Promise<Page> {
  const p = await h.openPopup();
  await expect(p.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
  return p;
}
/** A connected page (47b's two gates). */
async function connected(h: Harness, origin = DAPP): Promise<Page> {
  const page = await openDapp(h.ctx, origin);
  const win = await approvalWindow(h.ctx, () => connect(page));
  await win.getByRole('checkbox', {name: 'I understand this domain is not on the verified list'}).click();
  await win.getByRole('checkbox', {name: /I've read these permissions/}).click();
  await win.getByRole('button', {name: 'Connect for this session'}).click();
  await windowClosed(win);
  return page;
}
/** A signed wire's message bytes (past the shortvec and the signatures) and its signatures. */
function wireParts(wire: Uint8Array): {message: Uint8Array; signatures: Uint8Array[]} {
  const n = wire[0] ?? 0;
  return {message: wire.subarray(1 + 64 * n), signatures: Array.from({length: n}, (_, i) => wire.subarray(1 + 64 * i, 1 + 64 * (i + 1)))};
}
const signedBy = (wireB64: string, slot = 0): boolean => {
  const {message, signatures} = wireParts(base64.decode(wireB64));
  return ed25519.verify(signatures[slot] ?? new Uint8Array(64), message, base58.decode(ACCOUNT));
};
/**
 * Review fix I3: asserts the signed wire carries EXACTLY the page's own message bytes (not merely a validly-signed
 * one), with exactly one signature slot (every transaction here has exactly one signer, the fee payer — a second
 * slot would mean the wallet or the adapter altered what the page asked it to sign).
 */
function expectOwnMessage(signedB64: string, expectedMessageB64: string): void {
  const {message, signatures} = wireParts(base64.decode(signedB64));
  expect(base64.encode(message)).toBe(expectedMessageB64);
  expect(signatures).toHaveLength(1);
}
/** #48 simulated (the balance changes shown), then Approve — held 500 ms by C15, which Playwright waits out. */
async function approve(win: Page): Promise<void> {
  await expect(win.getByText('Balance changes (post-simulation)').first()).toBeVisible({timeout: 10_000});
  await win.getByRole('button', {name: 'Approve', exact: true}).click();
}
/**
 * Review fix I2 (round 2 minor): waits for pending.ts's background poller to actually poll THIS signature's status —
 * a real event the fake coordinator records (`fake.hits`'s `rpcMethod`), not a fixed sleep. `sinceIndex` is the
 * `hits.length` captured right after the broadcast, so a getSignatureStatuses hit recorded anywhere after it proves
 * the poller ran at least once since the send — the point of re-asserting exactly-once broadcast afterward.
 */
async function pollerRan(fake: FakeCoordinator, sinceIndex: number): Promise<void> {
  await expect.poll(() => fake.hits.slice(sinceIndex).some(x => x.rpcMethod === 'getSignatureStatuses'), {timeout: 15_000}).toBe(true);
}

test('B1c-25 · signTransaction: the six features; one transaction → #48 → Approve → signed; a batch of five on one screen → five signed; six refused with no window', async () => {
  test.setTimeout(240_000);
  const {h, server} = await scene('noctura-e2e-dapptx-sign-');
  try {
    await popup(h);
    const page = await connected(h);
    // D10: B1c-2 advertises the two transaction features beside plan 1's four.
    expect(await features(page)).toEqual(['solana:signAndSendTransaction', 'solana:signMessage', 'solana:signTransaction', 'standard:connect', 'standard:disconnect', 'standard:events']);
    let one!: Promise<unknown>;
    const win = await approvalWindow(h.ctx, () => (one = signTx(page, 1, BLOCKHASH)));
    await expect(win.locator('.top-bar .title')).toHaveText('Approve transaction');
    await expect(win.locator('.s9-payload-card .row .v.mono').first()).toHaveText('1111…1111 · system_program');
    await approve(win);
    const r1 = (await one) as {ok: true; value: {items: {signed: string; message: string}[]; walletCount: number}};
    expect(r1.ok).toBe(true);
    // Review fix minor (round 2): `items.length` alone is tautological (the page's own map always produces exactly
    // 1/5 regardless of what the wallet returned) — `walletCount` is the wallet's own `out.length`.
    expect(r1.value.walletCount).toBe(1);
    expect(r1.value.items).toHaveLength(1);
    expect(signedBy(r1.value.items[0]?.signed ?? '')).toBe(true);
    // Review fix I3: the wallet signed exactly the page's own message bytes.
    expectOwnMessage(r1.value.items[0]?.signed ?? '', r1.value.items[0]?.message ?? '');
    // The simulation the window showed asked the proxy for the account and the transaction's writable accounts.
    expect(h.fake.simulations.at(-1)).toEqual([ACCOUNT, RECIPIENT]);
    await windowClosed(win);

    let five!: Promise<unknown>;
    const w5 = await approvalWindow(h.ctx, () => (five = signTx(page, 5, BLOCKHASH)));
    await expect(w5.locator('.app-tx-batch')).toHaveText(['Transaction 1 of 5', 'Transaction 2 of 5', 'Transaction 3 of 5', 'Transaction 4 of 5', 'Transaction 5 of 5']);
    await approve(w5);
    const r5 = (await five) as {ok: true; value: {items: {signed: string; message: string}[]; walletCount: number}};
    expect(r5.value.walletCount).toBe(5);
    expect(r5.value.items).toHaveLength(5);
    expect(r5.value.items.every(w => signedBy(w.signed))).toBe(true);
    // Review fix I3: every item in the batch, not only its signature — its own message, unmixed with any other's.
    for (const item of r5.value.items) expectOwnMessage(item.signed, item.message);
    await windowClosed(w5);
    // D8: more than five is refused in the background, before any window.
    expect(await noWindow(h.ctx, () => signTx(page, 6, BLOCKHASH))).toEqual({ok: false, code: 'invalid-request', message: 'The request is not valid.'});
    done(h, server);
  } finally {
    await h.close();
  }
});

test('B1c-26 · signAndSendTransaction: #48 → Approve → the route gets the signed bytes once; the page gets their signature; #26 badges the row "Dapp · simulated"', async () => {
  test.setTimeout(240_000);
  const {h, server} = await scene('noctura-e2e-dapptx-send-');
  try {
    const p = await popup(h);
    const page = await connected(h);
    let sent!: Promise<unknown>;
    const win = await approvalWindow(h.ctx, () => (sent = sendTx(page, BLOCKHASH, 2_000_000)));
    await approve(win);
    const r = (await sent) as {ok: true; value: {signature: string; message: string}};
    expect(r.ok).toBe(true);
    const signature = base58.encode(base64.decode(r.value.signature));
    const hitsAtBroadcast = h.fake.hits.length;
    expect(h.fake.broadcasts).toStrictEqual([signature]);
    const wire = h.fake.broadcastWires[0] ?? '';
    expect(signedBy(wire)).toBe(true);
    expect(parseV0(base64.decode(wire)).keys).toEqual([ACCOUNT, RECIPIENT, '11111111111111111111111111111111']);
    // Review fix I3: the broadcast wire's message is the page's own bytes, exactly.
    expectOwnMessage(wire, r.value.message);
    // The pending record, the dApp's (B1b's v1_pending pattern) — the popup's own pending list omits it.
    const pending = (await h.sw.evaluate(() => chrome.storage.local.get('v1_pending'))).v1_pending as {signature: string; origin: string | null; intent: unknown}[];
    expect(pending.map(x => [x.signature, x.origin, x.intent])).toEqual([[signature, DAPP, null]]);
    // The transaction lands in the account's history: #26 badges it. A second, unrelated signature with no dApp
    // record (review fix minor: the negative control) is the "wallet-sent" look — it must carry no badge at all.
    const WALLET_SIG = '4'.repeat(88);
    h.fake.history.set(ACCOUNT, [
      {signature, tx: {blockTime: Math.floor(Date.now() / 1000), meta: {err: null, fee: 5000, preBalances: [10_000_000_000, 0, 1], postBalances: [9_997_995_000, 2_000_000, 1], preTokenBalances: [], postTokenBalances: []}, transaction: {message: {accountKeys: [{pubkey: ACCOUNT, signer: true, writable: true}, {pubkey: RECIPIENT, signer: false, writable: true}, {pubkey: '11111111111111111111111111111111', signer: false, writable: false}], instructions: [{programId: '11111111111111111111111111111111', parsed: {type: 'transfer', info: {source: ACCOUNT, destination: RECIPIENT, lamports: 2_000_000}}, program: 'system'}]}}}},
      {signature: WALLET_SIG, tx: {blockTime: Math.floor(Date.now() / 1000) - 5, meta: {err: null, fee: 5000, preBalances: [9_997_995_000, 0, 1], postBalances: [9_993_990_000, 3_000_000, 1], preTokenBalances: [], postTokenBalances: []}, transaction: {message: {accountKeys: [{pubkey: ACCOUNT, signer: true, writable: true}, {pubkey: RECIPIENT, signer: false, writable: true}, {pubkey: '11111111111111111111111111111111', signer: false, writable: false}], instructions: [{programId: '11111111111111111111111111111111', parsed: {type: 'transfer', info: {source: ACCOUNT, destination: RECIPIENT, lamports: 3_000_000}}, program: 'system'}]}}}},
    ]);
    await p.getByRole('button', {name: 'Activity'}).click();
    const rows = p.locator('.tx-row', {hasText: 'Sent SOL'});
    const dappRow = rows.filter({hasText: 'Dapp · simulated'});
    const walletRow = rows.filter({hasNotText: 'Dapp · simulated'});
    await expect(dappRow.locator('.origin-badge')).toHaveText('Dapp · simulated');
    await expect(dappRow.locator('.origin-badge')).toHaveAttribute('aria-label', 'dApp-originated transaction · simulated');
    // Negative control (review fix minor): a row whose signature has no dApp record carries no badge at all.
    await expect(walletRow).toHaveCount(1);
    await expect(walletRow.locator('.origin-badge')).toHaveCount(0);
    // Review fix I2: re-assert exactly-once broadcast AFTER the badge assertion, having waited for the background's
    // pending poller to actually poll this signature's status (not a fixed sleep) — proves it never re-broadcasts
    // behind the UI's back once the row is confirmed and shown.
    await pollerRan(h.fake, hitsAtBroadcast);
    expect(h.fake.broadcasts).toStrictEqual([signature]);
    expect(h.fake.broadcastWires).toHaveLength(1);
    done(h, server);
  } finally {
    await h.close();
  }
});

test('B1c-27 · through StandardWalletAdapter: compatible; connect; signTransaction; signAllTransactions of five, of six refused; sendTransaction', async () => {
  test.setTimeout(300_000);
  const {h, server} = await scene('noctura-e2e-dapptx-adapter-');
  try {
    await popup(h);
    const page = await openDapp(h.ctx, DAPP);
    // The adapter's own predicate (review-1 M1): plan 1 alone was not compatible; B1c-2 is.
    expect(await adapter.compatible(page)).toBe(true);
    let c!: Promise<unknown>;
    const w47 = await approvalWindow(h.ctx, () => (c = adapter.connect(page)));
    await w47.getByRole('checkbox', {name: 'I understand this domain is not on the verified list'}).click();
    await w47.getByRole('checkbox', {name: /I've read these permissions/}).click();
    await w47.getByRole('button', {name: 'Connect for this session'}).click();
    expect(await c).toEqual({ok: true, value: ACCOUNT});
    await windowClosed(w47);

    let one!: Promise<unknown>;
    const w1 = await approvalWindow(h.ctx, () => (one = adapter.sign(page, BLOCKHASH)));
    await approve(w1);
    const r1 = (await one) as {ok: true; value: {signed: string; message: string}};
    expect(signedBy(r1.value.signed)).toBe(true);
    // Review fix I3: the adapter's own signed bytes carry the page's exact message.
    expectOwnMessage(r1.value.signed, r1.value.message);
    await windowClosed(w1);

    let all!: Promise<unknown>;
    const w5 = await approvalWindow(h.ctx, () => (all = adapter.signAll(page, 5, BLOCKHASH)));
    await expect(w5.locator('.app-tx-batch')).toHaveCount(5);
    await approve(w5);
    const r5 = (await all) as {ok: true; value: {signed: string[]; messages: string[]}};
    expect(r5.value.signed).toHaveLength(5);
    expect(r5.value.signed.every(w => signedBy(w))).toBe(true);
    r5.value.signed.forEach((wire, i) => expectOwnMessage(wire, r5.value.messages[i] ?? ''));
    await windowClosed(w5);
    // Six: the background refuses (D8) — the adapter reports its own WalletSignTransactionError, nothing opens.
    const six = (await noWindow(h.ctx, () => adapter.signAll(page, 6, BLOCKHASH))) as {ok: false; message: string; name: string | undefined};
    expect(six.ok).toBe(false);
    expect(six.message).toBe('The request is not valid.');
    // Review fix minor: the adapter's own error TYPE, not only its message string.
    expect(six.name).toBe('WalletSignTransactionError');

    let send!: Promise<unknown>;
    const ws = await approvalWindow(h.ctx, () => (send = adapter.send(page, BLOCKHASH)));
    await approve(ws);
    const rs = (await send) as {ok: true; value: {signature: string; message: string}};
    expect(rs.ok).toBe(true);
    const hitsAtBroadcast = h.fake.hits.length;
    expect(h.fake.broadcasts).toStrictEqual([rs.value.signature]);
    // Review fix minor: run signedBy/parseV0 on the adapter's own broadcast wire too (B1c-26 already does for the
    // raw path) — and the message is the page's exact bytes.
    const sendWire = h.fake.broadcastWires[0] ?? '';
    expect(signedBy(sendWire)).toBe(true);
    expect(parseV0(base64.decode(sendWire)).keys).toEqual([ACCOUNT, RECIPIENT, '11111111111111111111111111111111']);
    expectOwnMessage(sendWire, rs.value.message);
    // Through signAndSendTransaction — the dApp's record (the adapter's fallback, signTransaction then its own
    // Connection, would leave none and reach the dApp's RPC, which done() refuses).
    const pending = (await h.sw.evaluate(() => chrome.storage.local.get('v1_pending'))).v1_pending as {signature: string; origin: string | null}[];
    expect(pending.map(x => [x.signature, x.origin])).toStrictEqual([[rs.value.signature, DAPP]]);
    // Review fix I2: re-assert exactly-once broadcast after waiting for the background's pending poller to actually
    // poll this signature's status (not a fixed sleep).
    await pollerRan(h.fake, hitsAtBroadcast);
    expect(h.fake.broadcasts).toStrictEqual([rs.value.signature]);
    expect(h.fake.broadcastWires).toHaveLength(1);
    done(h, server);
  } finally {
    await h.close();
  }
});

test('B1c-28 · re-authentication through the toolbar (D11): a first send → Approve → the window points to the icon → the popup’s strip → #10 → the window signs; a mismatch notice', async () => {
  test.setTimeout(300_000);
  const {h, server} = await scene('noctura-e2e-dapptx-reauth-', {knownRecipient: false});
  try {
    await popup(h);
    const page = await connected(h);
    const other = await openDapp(h.ctx, 'https://jup.ag');

    // Review fix I1, round 2 (controller ruling — the real E2E path). Round 1's form fired the raw mismatch request
    // with no window open at all and asserted `noWindow` — but ensureWindow is never even CALLED on that path
    // (pageApi.ts only calls it after an ACCEPTED request; a mismatch is answered `unauthorized` and queued with no
    // call to ensureWindow at all), so that assertion never actually ran window.ts:49's gate — mutating the gate's
    // mismatch exclusion (confirmed: removing `&& e.type !== 'mismatch'`, rebuilding, re-running) left B1c-28 green.
    // The one path that DOES call ensureWindow with a notice-only queue is onApprovalWindowRemoved's "reopen for
    // what remains": close the approval window (✕) while it is showing a REAL request that is still `queued` (not
    // yet decided) → the real request is rejected, and — since other extension windows (this context's own tabs)
    // are still open — ensureWindow runs again with ONLY the mismatch notice left in the queue. That run must NOT
    // open a window (the notice has no window of its own to ride in now that the real request is gone).
    let disposable!: Promise<unknown>;
    const w0 = await approvalWindow(h.ctx, () => (disposable = signTx(page, 1, BLOCKHASH)));
    await expect(w0.getByText("Approving asks you to confirm with your password (or passkey) — you'll start it from the Noctura icon.")).toBeVisible({timeout: 10_000});
    // The mismatch notice, queued BEHIND this real request (w0's window is already open and showing it) — answered
    // `unauthorized` at once, no window of its own, exactly as a notice queued behind an open real request should be.
    const refused = await noWindow(h.ctx, () => rawSignTx(other, ACCOUNT, BLOCKHASH));
    expect(refused).toEqual({error: 'unauthorized'});
    // ✕ while the real request is still queued (never approved): rejects it, then re-opens for "what remains" — a
    // notice-only queue. Asserts that reopen attempt opens NO window (the mutation's target), over the bounded,
    // event-driven wait `noWindow` already gives: the disposable request's own promise settling (the background's
    // rejection section, which runs — and so IS guaranteed complete — strictly before the ensureWindow call this
    // is testing) plus noWindow's trailing 1 s with no new 'page' event.
    const afterClose = await noWindow(h.ctx, async () => {
      await w0.close();
      return await disposable;
    });
    expect(afterClose).toEqual({ok: false, code: 4001, message: 'The user rejected the request.'});
    // The dApp's own page still saw exactly one relay reply throughout — the notice sat quietly the whole time.
    expect(await relayed(other)).toHaveLength(1);

    // The notice, still queued, now rides along in the NEXT real request's window — shown FIRST, dismiss-only
    // (window.ts fix round 4: "a mismatch notice rides along in a real request's window").
    let pending!: Promise<unknown>;
    const win = await approvalWindow(h.ctx, () => (pending = signTx(page, 1, BLOCKHASH)));
    await expect(win.getByText('Request blocked automatically')).toBeVisible();
    await expect(win.locator('.s9-payload-card .row .v')).toHaveText(['dapp.test', 'jup.ag', 'false', 'REJECT_NO_PROMPT']);
    await win.getByRole('button', {name: 'OK, return to dApp'}).click();

    // Dismissing it reveals the real request behind it, in the SAME window (it never closed — the notice rode
    // along rather than opening one of its own).
    await expect(win.getByText("Approving asks you to confirm with your password (or passkey) — you'll start it from the Noctura icon.")).toBeVisible({timeout: 10_000});
    await win.getByRole('button', {name: 'Approve', exact: true}).click();
    await expect(win.getByText("Confirm it's you")).toBeVisible();
    await expect(win.locator('a, input, select, textarea')).toHaveCount(0);
    await expect(win.getByRole('button', {name: 'Approve', exact: true})).toBeDisabled();
    // The toolbar: the popup offers #10 for the site's transaction.
    const toolbar = await h.openPopup();
    const strip = toolbar.getByRole('button', {name: 'A transaction from dapp.test waits for your confirmation'});
    const [tab] = await Promise.all([h.ctx.waitForEvent('page', {predicate: p => /unlock\.html/.test(p.url())}), strip.click()]);
    await expect(tab).toHaveURL(/unlock\.html\?mode=reauth&challenge=[0-9a-f]{32}$/);
    await expect(tab.locator('#ra-about')).toHaveText('You are about to approve');
    await tab.locator('#ra-password').fill(E2E_PASSWORD);
    await tab.locator('#ra-confirm').click();
    await expect(tab.locator('#ra-notice-line')).toHaveText('Confirmed. Go back to the approval window and approve the transaction.', {timeout: 60_000});
    // Review fix I4: poll the background's own state (dapp.reauth's `data`, null once the challenge is consumed) —
    // never a UI assertion bounded by the window's 1 s wall-clock poll — then give the window an explicit reason to
    // re-read it (a focus event) before asserting, rather than racing its own timer. Sent from `toolbar` (an
    // ordinary extension page, stays open throughout), never `h.sw` directly: by this point in the test the service
    // worker may have gone idle and restarted (B1c-24), and a direct `Worker` handle to the old one answers "Could
    // not establish connection" rather than waking the new one the way chrome.runtime's own messaging does.
    await expect
      .poll(async () => {
        const reply = (await toolbar.evaluate(() => chrome.runtime.sendMessage({type: 'dapp.reauth'}))) as {ok: true; data: unknown} | {ok: false; error: string};
        return reply.ok ? reply.data : 'not-ok';
      })
      .toBeNull();
    await win.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(win.getByText("Confirm it's you")).toHaveCount(0);
    await win.getByRole('button', {name: 'Approve', exact: true}).click();
    const r = (await pending) as {ok: true; value: {items: {signed: string; message: string}[]; walletCount: number}};
    expect(signedBy(r.value.items[0]?.signed ?? '')).toBe(true);
    // Review fix minor (round 2): the final signed wire's message is the page's own bytes too.
    expectOwnMessage(r.value.items[0]?.signed ?? '', r.value.items[0]?.message ?? '');
    await windowClosed(win);
    done(h, server);
  } finally {
    await h.close();
  }
});

// Final review I2: a site whose host is URL-legal but outside the old SITE shape (an underscore). Before the fix, Approve
// made issueChallenge throw and `dapp.decide` answer `internal` — the click did nothing and the request could only be
// rejected. Now: the challenge is issued, the window points to the icon, the popup's strip names the site exactly as
// Chrome serialised the page's origin, #10 describes it, and the window then signs.
test('B1c-29 · an underscore host (my_site.test): a first send → Approve → the strip names the site → #10 describes it → the window signs', async () => {
  test.setTimeout(240_000);
  const site = 'my_site.test';
  const {h, server} = await scene('noctura-e2e-dapptx-underscore-', {knownRecipient: false});
  try {
    await popup(h);
    const page = await connected(h, `https://${site}`);
    let pending!: Promise<unknown>;
    const win = await approvalWindow(h.ctx, () => (pending = signTx(page, 1, BLOCKHASH)));
    await expect(win.getByText("Approving asks you to confirm with your password (or passkey) — you'll start it from the Noctura icon.")).toBeVisible({timeout: 10_000});
    await win.getByRole('button', {name: 'Approve', exact: true}).click();
    await expect(win.getByText("Confirm it's you")).toBeVisible();
    const toolbar = await h.openPopup();
    const strip = toolbar.getByRole('button', {name: `A transaction from ${site} waits for your confirmation`});
    const [tab] = await Promise.all([h.ctx.waitForEvent('page', {predicate: p => /unlock\.html/.test(p.url())}), strip.click()]);
    await expect(tab.locator('#ra-about')).toHaveText('You are about to approve');
    await expect(tab.locator('#ra-rows .intent-row').first()).toHaveText(`Site${site}`);
    await tab.locator('#ra-password').fill(E2E_PASSWORD);
    await tab.locator('#ra-confirm').click();
    await expect(tab.locator('#ra-notice-line')).toHaveText('Confirmed. Go back to the approval window and approve the transaction.', {timeout: 60_000});
    await expect
      .poll(async () => {
        const reply = (await toolbar.evaluate(() => chrome.runtime.sendMessage({type: 'dapp.reauth'}))) as {ok: true; data: unknown} | {ok: false; error: string};
        return reply.ok ? reply.data : 'not-ok';
      })
      .toBeNull();
    await win.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(win.getByText("Confirm it's you")).toHaveCount(0);
    await win.getByRole('button', {name: 'Approve', exact: true}).click();
    const r = (await pending) as {ok: true; value: {items: {signed: string; message: string}[]; walletCount: number}};
    expect(r.ok).toBe(true);
    expect(signedBy(r.value.items[0]?.signed ?? '')).toBe(true);
    expectOwnMessage(r.value.items[0]?.signed ?? '', r.value.items[0]?.message ?? '');
    await windowClosed(win);
    done(h, server);
  } finally {
    await h.close();
  }
});

// Review fix minor — the positive control for this file's own containment counter (the pattern containment.spec.ts
// already uses for Solscan/noc-tura.io: "a zero means nothing was asked only if a request, when made, IS counted").
// serveDapp's DAPP_RPC_HOST route (dappPage.ts) answers the test dApp's own RPC host by aborting and pushing to
// `server.unexpected` — this proves that recording actually happens, so every other test's empty `server.unexpected`
// (asserted by `done()`) means what it claims. Deliberately does not call `done()`: `server.unexpected` is non-empty
// by design here.
test('containment positive control · a request to the test dApp\'s own RPC host is recorded as unexpected', async () => {
  test.setTimeout(60_000);
  const {h, server} = await scene('noctura-e2e-dapptx-rpc-control-');
  try {
    await popup(h);
    const page = await openDapp(h.ctx, DAPP);
    const url = 'https://api.mainnet-beta.solana.com/';
    const outcome = await page.evaluate(u => fetch(u).then(() => 'resolved', (e: unknown) => String(e)), url);
    expect(outcome).not.toBe('resolved');
    expect(server.unexpected).toEqual([url]);
    contained(h);
  } finally {
    await h.close();
  }
});

// ——— B1c-3 (spec §3.3 rev 3.6, B1 §3's red-flag table): the flags computed in the background from the decoded
// instructions and the fake node's pre/post state, rendered on #48, the blocks overridden only by the exact typed word
// AND a re-authentication through the toolbar (O1, D11), each through StandardWalletAdapter as a wallet-adapter dApp
// sends it. The background is the gate (C13): every block is also asked of it directly — the window's own dapp.decide,
// sent from the window's page — without the word, with a wrong one, and with the right one before #10.

const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const RECENT_BLOCKHASHES = 'SysvarRecentB1ockHashes11111111111111111111';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const U64_MAX = 2n ** 64n - 1n;
/** Fixed, distinct keys (a byte fill, as BLOCKHASH): the accounts and authorities of B1c-30 … B1c-34. */
const key = (fill: number): string => base58.encode(new Uint8Array(32).fill(fill));
const OWN_USDC = key(31);
const DELEGATE = key(32);
const T22_MINT = key(33);
const OWN_T22 = key(34);
const ISSUER = key(35);
const FREEZER = key(36);
const PERMANENT_DELEGATE = key(37);
const HOOK_AUTHORITY = key(38);
const NEW_ATA = key(39);
const RECIPIENT_USDC = key(40);
const NONCE = key(41);
const DAPP_PROGRAM = key(42);
const OWN_EMPTY = key(43);
/** B1 §3: Confirm held 1.5 s on any red-flag screen; C15's 500 ms elsewhere. */
const FLAG_HOLD_MS = 1_500;

const u64le = (n: bigint): number[] => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, n, true);
  return Array.from(b);
};
const signer = (pubkey: string, isWritable = true) => ({pubkey, isSigner: true, isWritable});
const writable = (pubkey: string) => ({pubkey, isSigner: false, isWritable: true});
const readonly = (pubkey: string) => ({pubkey, isSigner: false, isWritable: false});
const ix = {
  /** SPL Token ApproveChecked (13): source, mint, delegate, owner; amount, decimals. */
  approveChecked: (source: string, mint: string, delegate: string, amount: bigint, decimals: number): RawIx => ({programId: TOKEN_PROGRAM, keys: [writable(source), readonly(mint), readonly(delegate), signer(ACCOUNT, false)], data: [13, ...u64le(amount), decimals]}),
  /** SPL Token TransferChecked (12): source, mint, destination, owner; amount, decimals. */
  transferChecked: (source: string, mint: string, destination: string, amount: bigint, decimals: number): RawIx => ({programId: TOKEN_PROGRAM, keys: [writable(source), readonly(mint), writable(destination), signer(ACCOUNT, false)], data: [12, ...u64le(amount), decimals]}),
  /** SPL Token CloseAccount (9): account, destination (the wallet account by default), owner. */
  closeAccount: (account: string, destination: string = ACCOUNT): RawIx => ({programId: TOKEN_PROGRAM, keys: [writable(account), writable(destination), signer(ACCOUNT, false)], data: [9]}),
  /** System Assign (1) of the wallet account to `owner`. */
  assign: (owner: string): RawIx => ({programId: SYSTEM_PROGRAM, keys: [signer(ACCOUNT)], data: [1, 0, 0, 0, ...base58.decode(owner)]}),
  /** System Transfer (2) from the wallet account. */
  transfer: (to: string, lamports: bigint): RawIx => ({programId: SYSTEM_PROGRAM, keys: [signer(ACCOUNT), writable(to)], data: [2, 0, 0, 0, ...u64le(lamports)]}),
  /** System AdvanceNonceAccount (4): nonce account, the recent-blockhashes sysvar, the nonce authority. */
  advanceNonce: (nonce: string): RawIx => ({programId: SYSTEM_PROGRAM, keys: [writable(nonce), readonly(RECENT_BLOCKHASHES), signer(ACCOUNT, false)], data: [4, 0, 0, 0]}),
  /** ATA Create (no data) / CreateIdempotent (1): payer, account, wallet, mint, System, the token program — six accounts. */
  ataCreate: (account: string, wallet: string, mint: string, tokenProgram: string, idempotent: boolean): RawIx => ({
    programId: ATA_PROGRAM,
    keys: [signer(ACCOUNT), writable(account), readonly(wallet), readonly(mint), readonly(SYSTEM_PROGRAM), readonly(tokenProgram)],
    data: idempotent ? [1] : [],
  }),
};

/** The wallet holds 740.21 USDC in a (classic) token account; the USDC mint reads as Circle's does: 6 decimals, a mint and a freeze authority. */
function holdUsdc(fake: FakeCoordinator, more: {pubkey: string; mint: string; amount: string; decimals: number; program?: 'token' | 'token-2022'}[] = []): void {
  fake.tokenAccounts.set(ACCOUNT, [{pubkey: OWN_USDC, mint: USDC_MINT, amount: '740210000', decimals: 6}, ...more]);
  fake.mints.set(USDC_MINT, {program: 'token', data: mintData({decimals: 6, mintAuthority: ISSUER, freezeAuthority: FREEZER})});
}
/** A page connected through StandardWalletAdapter (its own connect → #47b's two gates). */
async function adapterConnected(h: Harness): Promise<Page> {
  const page = await openDapp(h.ctx, DAPP);
  let c!: Promise<unknown>;
  const w47 = await approvalWindow(h.ctx, () => (c = adapter.connect(page)));
  await w47.getByRole('checkbox', {name: 'I understand this domain is not on the verified list'}).click();
  await w47.getByRole('checkbox', {name: /I've read these permissions/}).click();
  await w47.getByRole('button', {name: 'Connect for this session'}).click();
  expect(await c).toEqual({ok: true, value: ACCOUNT});
  await windowClosed(w47);
  return page;
}
/**
 * The window's own dapp.decide, sent from the window's page (approve.html, the one sender the background takes it from)
 * for the request it shows — an approval of the simulation it shows, with `extra` (the typed words). What the
 * background answers is the gate's own word, whatever the window's buttons allow.
 */
async function decideRaw(win: Page, extra: {overrides?: {tx: number; word: string}[]}): Promise<unknown> {
  return win.evaluate(async x => {
    const view = (await chrome.runtime.sendMessage({type: 'dapp.pending'})) as {data: {request: {requestId: string; tx: {account: {publicKey: string}; simulation: {id?: string}}}}};
    const r = view.data.request;
    return chrome.runtime.sendMessage({type: 'dapp.decide', requestId: r.requestId, decision: 'approve', account: r.tx.account.publicKey, simulation: r.tx.simulation.id, ...x});
  }, extra);
}
/**
 * How long `cta` stays disabled from now (polled every 50 ms) — called the moment a state is seen, so it measures the
 * hold that state's render started, less the time it took to see it (0 when it was already enabled).
 */
async function heldFor(cta: Locator): Promise<number> {
  const from = Date.now();
  await expect.poll(() => cta.isEnabled(), {intervals: [50], timeout: 10_000}).toBe(true);
  return Date.now() - from;
}
/**
 * The re-authentication (D11) a block always needs: the window asks for it, the popup's strip opens #10, which names
 * what is overridden (`rows`) and why (`reasons`); the password; then the window, told by a focus (B1c-28's I4: the
 * background's own state polled first, never the window's 1 s timer), no longer waits.
 */
async function reauthFromToolbar(h: Harness, win: Page, rows: string[], reasons: string[]): Promise<void> {
  await expect(win.getByText("Confirm it's you")).toBeVisible();
  const toolbar = await h.openPopup();
  const strip = toolbar.getByRole('button', {name: 'A transaction from dapp.test waits for your confirmation'});
  const [tab] = await Promise.all([h.ctx.waitForEvent('page', {predicate: p => /unlock\.html/.test(p.url())}), strip.click()]);
  await expect(tab.locator('#ra-about')).toHaveText('You are about to approve');
  for (const r of rows) await expect(tab.locator('#ra-rows .intent-row', {hasText: r})).toHaveCount(1);
  await expect(tab.locator('#ra-reasons p')).toHaveText(reasons);
  await tab.locator('#ra-password').fill(E2E_PASSWORD);
  await tab.locator('#ra-confirm').click();
  await expect(tab.locator('#ra-notice-line')).toHaveText('Confirmed. Go back to the approval window and approve the transaction.', {timeout: 60_000});
  await expect
    .poll(async () => {
      const reply = (await toolbar.evaluate(() => chrome.runtime.sendMessage({type: 'dapp.reauth'}))) as {ok: true; data: unknown} | {ok: false; error: string};
      return reply.ok ? reply.data : 'not-ok';
    })
    .toBeNull();
  await win.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(win.getByText("Confirm it's you")).toHaveCount(0);
  await toolbar.close();
}
/**
 * Every Content Security Policy line any page of the context logs — the approval windows, #10's tab, the popup — with
 * each document's `securitypolicyviolation` events logged to the same channel (csp.spec.ts watches the vault page the
 * same two ways; B1c-34 ends with this watch's own positive control). Asserted empty by each B1c-3 test.
 */
async function watchCsp(h: Harness): Promise<string[]> {
  const lines: string[] = [];
  h.ctx.on('console', m => {
    if (/Content Security Policy|Content-Security-Policy/i.test(m.text())) lines.push(m.text());
  });
  await h.ctx.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', e => console.error(`Content Security Policy violation: ${e.effectiveDirective} ${e.blockedURI}`));
  });
  return lines;
}
const APPROVAL_LINE = 'Re-auth required to approve a token allowance.';
const OVERRIDE_LINE = 'Re-auth required to override a blocked transaction.';

test('B1c-30 · unlimited approve (F5, USDC): blocked — the typed symbol, exact, case-sensitive, then #10 through the toolbar; the background refuses without the word, with a wrong one, and without the proof', async () => {
  test.setTimeout(300_000);
  const {h, server} = await scene('noctura-e2e-dapptx-unlimited-');
  try {
    const csp = await watchCsp(h);
    holdUsdc(h.fake);
    await popup(h);
    const page = await adapterConnected(h);
    let signed!: Promise<unknown>;
    const win = await approvalWindow(h.ctx, () => (signed = adapter.customSign(page, BLOCKHASH, [ix.approveChecked(OWN_USDC, USDC_MINT, DELEGATE, U64_MAX, 6)])));
    let answered = false;
    // (A rejection is the test's teardown closing the page — never this test's verdict.)
    void signed.then(
      () => (answered = true),
      () => undefined,
    );
    // The design's state 2: the eyebrow, ONE danger banner (Task 6: F2 does not repeat the approve), the synthesized row.
    await expect(win.locator('.top-bar .title')).toHaveText('Critical · Unlimited spend approval', {timeout: 10_000});
    const banner = win.locator('.s9-flag-banner.danger');
    await expect(banner).toHaveCount(1);
    await expect(banner.locator('.head')).toHaveText('Unlimited USDC spend approval');
    await expect(banner.locator('.body')).toContainText('spl_token::ApproveChecked');
    await expect(banner.locator('.body')).toContainText('amount = u64::MAX');
    await expect(banner.locator('.meta')).toContainText(DELEGATE);
    await expect(banner.locator('.meta')).toContainText(USDC_MINT);
    await expect(win.locator('.s9-flag-banner.warn')).toHaveCount(0);
    await expect(win.getByText('USDC delegated')).toBeVisible();
    // Approve unlimited: red, gated (#37's look) and disabled until the field matches.
    const cta = win.getByRole('button', {name: 'Approve unlimited'});
    const field = win.getByLabel('Type USDC to enable Approve');
    await expect(field).toHaveValue('');
    await expect(field).not.toBeFocused();
    await expect(cta).toHaveClass(/app-cta-gated/);
    await expect(cta).toBeDisabled();
    // The background, asked directly: no word → override-missing; a wrong case → override-mismatch. Nothing is issued.
    expect(await decideRaw(win, {})).toEqual({ok: false, error: 'override-missing'});
    expect(await decideRaw(win, {overrides: [{tx: 0, word: 'usdc'}]})).toEqual({ok: false, error: 'override-mismatch'});
    // The wrong case, then a trailing space: still gated — and still disabled once the 1.5 s hold has passed, so it is
    // the match that keeps it disabled, not the hold.
    for (const wrong of ['usdc', 'USDC ']) {
      await field.fill(wrong);
      await expect(field).not.toHaveClass(/\bmatch\b/);
      await expect(cta).toHaveClass(/app-cta-gated/);
      await win.waitForTimeout(FLAG_HOLD_MS + 500);
      await expect(cta).toBeDisabled();
    }
    // The exact symbol: the match, the red CTA un-gated, held 1.5 s again (a match change re-holds), then enabled.
    await field.fill('USDC');
    await expect(field).toHaveClass(/\bmatch\b/);
    await expect(cta).not.toHaveClass(/app-cta-gated/);
    await expect(cta).toBeEnabled();
    // Enter in the field submits nothing, and the page has no answer.
    await field.press('Enter');
    await cta.click();
    // The word alone is not enough: the background asks for #10 (the `override` reason), and the page still waits.
    await expect(win.getByText("Confirm it's you")).toBeVisible();
    expect(await decideRaw(win, {overrides: [{tx: 0, word: 'USDC'}]})).toEqual({ok: false, error: 'reauth-required'});
    expect(answered).toBe(false);
    await reauthFromToolbar(h, win, ['Sitedapp.test', 'Unlimited USDC spend approval'], [APPROVAL_LINE, OVERRIDE_LINE]);
    expect(answered).toBe(false);
    await cta.click();
    const r = (await signed) as {ok: true; value: {signed: string; message: string}};
    expect(r.ok).toBe(true);
    expect(signedBy(r.value.signed)).toBe(true);
    expectOwnMessage(r.value.signed, r.value.message);
    await windowClosed(win);
    expect(csp).toEqual([]);
    done(h, server);
  } finally {
    await h.close();
  }
});

test('B1c-31 · Assign of the wallet account (F3): blocked, "ASSIGN" overrides it end to end; a lone closeAccount to another address is a warning only — held 1.5 s, no typed field; closed to the account itself (O7) and a plain transfer are held only C15’s 500 ms', async () => {
  test.setTimeout(300_000);
  const {h, server} = await scene('noctura-e2e-dapptx-assign-');
  try {
    const csp = await watchCsp(h);
    holdUsdc(h.fake, [{pubkey: OWN_EMPTY, mint: USDC_MINT, amount: '0', decimals: 6}]);
    await popup(h);
    const page = await adapterConnected(h);
    let assigned!: Promise<unknown>;
    const win = await approvalWindow(h.ctx, () => (assigned = adapter.customSign(page, BLOCKHASH, [ix.assign(DAPP_PROGRAM)])));
    await expect(win.locator('.top-bar .title')).toHaveText('Critical · Blocked transaction', {timeout: 10_000});
    const banner = win.locator('.s9-flag-banner.danger');
    await expect(banner).toHaveCount(1);
    await expect(banner.locator('.head')).toHaveText('Assign / Allocate on your wallet account');
    // The decoded instruction AND the fake node's post-state (the wallet account now owned by the dApp's program).
    await expect(banner.locator('.meta').first()).toHaveText('#1 system_program::Assign');
    await expect(banner.locator('.meta').nth(1)).toHaveText(`post-simulation · owner: ${DAPP_PROGRAM} · space: 0`);
    const cta = win.getByRole('button', {name: 'Approve anyway'});
    const field = win.getByLabel('Type ASSIGN to enable Approve');
    await expect(cta).toBeDisabled();
    expect(await decideRaw(win, {})).toEqual({ok: false, error: 'override-missing'});
    await field.fill('Assign');
    await expect(cta).toHaveClass(/app-cta-gated/);
    await field.fill('ASSIGN');
    await expect(cta).not.toHaveClass(/app-cta-gated/);
    await cta.click();
    await reauthFromToolbar(h, win, ['Sitedapp.test', 'Assign / Allocate on your wallet account'], [OVERRIDE_LINE]);
    await cta.click();
    const r = (await assigned) as {ok: true; value: {signed: string; message: string}};
    expect(signedBy(r.value.signed)).toBe(true);
    expectOwnMessage(r.value.signed, r.value.message);
    await windowClosed(win);

    // A lone closeAccount of the wallet's empty USDC account, its rent to another address: F2's warning names it;
    // nothing to type, no #10.
    let closed!: Promise<unknown>;
    const wc = await approvalWindow(h.ctx, () => (closed = adapter.customSign(page, BLOCKHASH, [ix.closeAccount(OWN_EMPTY, RECIPIENT)])));
    const warn = wc.locator('.s9-flag-banner.warn');
    await expect(warn).toHaveCount(1, {timeout: 10_000});
    const approveClose = wc.getByRole('button', {name: 'Approve', exact: true});
    expect(await heldFor(approveClose)).toBeGreaterThanOrEqual(1_000);
    await expect(warn.locator('.head')).toHaveText('Instructions that are not transfers');
    await expect(warn.locator('.meta')).toHaveText('#1 spl_token::CloseAccount');
    await expect(wc.locator('.top-bar .title')).toHaveText('Approve transaction');
    await expect(wc.locator('.s9-flag-banner.danger, .s9-typed-confirm, input')).toHaveCount(0);
    await approveClose.click();
    const rc = (await closed) as {ok: true; value: {signed: string; message: string}};
    expect(signedBy(rc.value.signed)).toBe(true);
    expectOwnMessage(rc.value.signed, rc.value.message);
    await windowClosed(wc);

    // O7: the same close with the rent back to the account itself is rent only — no flag, C15's 500 ms only.
    let selfClosed!: Promise<unknown>;
    const ws = await approvalWindow(h.ctx, () => (selfClosed = adapter.customSign(page, BLOCKHASH, [ix.closeAccount(OWN_EMPTY)])));
    await expect(ws.getByText('Balance changes (post-simulation)')).toBeVisible({timeout: 10_000});
    expect(await heldFor(ws.getByRole('button', {name: 'Approve', exact: true}))).toBeLessThan(1_000);
    await expect(ws.locator('.s9-flag-banner')).toHaveCount(0);
    await ws.getByRole('button', {name: 'Approve', exact: true}).click();
    expect(((await selfClosed) as {ok: boolean}).ok).toBe(true);
    await windowClosed(ws);

    // The negative control of that measure: a plain transfer to a known recipient has no flag — C15's 500 ms only.
    let plain!: Promise<unknown>;
    const wp = await approvalWindow(h.ctx, () => (plain = adapter.sign(page, BLOCKHASH)));
    await expect(wp.getByText('Balance changes (post-simulation)')).toBeVisible({timeout: 10_000});
    expect(await heldFor(wp.getByRole('button', {name: 'Approve', exact: true}))).toBeLessThan(1_000);
    await expect(wp.locator('.s9-flag-banner')).toHaveCount(0);
    await wp.getByRole('button', {name: 'Approve', exact: true}).click();
    expect(((await plain) as {ok: boolean}).ok).toBe(true);
    await windowClosed(wp);
    expect(csp).toEqual([]);
    done(h, server);
  } finally {
    await h.close();
  }
});

test('B1c-32 · Token-2022 (F7): a held mint with a permanent delegate and a freeze authority is named; classic USDC with a freeze authority is not (O3)', async () => {
  test.setTimeout(240_000);
  const {h, server} = await scene('noctura-e2e-dapptx-t22-');
  try {
    const csp = await watchCsp(h);
    holdUsdc(h.fake, [{pubkey: OWN_T22, mint: T22_MINT, amount: '1000000', decimals: 6, program: 'token-2022'}]);
    // PYUSD's shape: a mint and a freeze authority, a permanent delegate, a transfer hook whose program is unset.
    h.fake.mints.set(T22_MINT, {program: 'token-2022', data: mintData({decimals: 6, mintAuthority: ISSUER, freezeAuthority: FREEZER, extensions: {permanentDelegate: PERMANENT_DELEGATE, transferHook: {authority: HOOK_AUTHORITY, program: null}}})});
    await popup(h);
    const page = await adapterConnected(h);
    let signed!: Promise<unknown>;
    // A dApp's usual preamble: its token accounts made sure of (CreateIdempotent of accounts that exist — nothing moves).
    const win = await approvalWindow(h.ctx, () => (signed = adapter.customSign(page, BLOCKHASH, [ix.ataCreate(OWN_T22, ACCOUNT, T22_MINT, TOKEN_2022_PROGRAM, true), ix.ataCreate(OWN_USDC, ACCOUNT, USDC_MINT, TOKEN_PROGRAM, true)])));
    await expect(win.getByText('Balance changes (post-simulation)')).toBeVisible({timeout: 10_000});
    const t22 = win.locator('.s9-flag-banner.warn', {hasText: 'Token-2022 settings on a token you hold'});
    await expect(t22).toHaveCount(1);
    await expect(t22.locator('.body')).toHaveText(['Freeze authority — the issuer can freeze your account of this token.', 'Permanent delegate — an address that can move or burn this token from any account, yours included.']);
    await expect(t22.locator('.meta')).toHaveText([`mint: ${T22_MINT}`, `freezeAuthority: ${FREEZER}`, `permanentDelegate: ${PERMANENT_DELEGATE}`]);
    // The negative controls: no transfer-hook line (its program is unset), and USDC's freeze authority is no flag.
    await expect(win.getByText(/Transfer hook/)).toHaveCount(0);
    await expect(win.locator('.s9-flag-banner', {hasText: USDC_MINT})).toHaveCount(0);
    await expect(win.locator('.s9-flag-banner', {hasText: FREEZER})).toHaveCount(1);
    // O7: the two creates are the account's own token accounts, paid by it — rent only, no F2 banner; F7's warning
    // only: no block, no field — Approve after the 1.5 s hold.
    await expect(win.locator('.s9-flag-banner.warn', {hasText: 'Instructions that are not transfers'})).toHaveCount(0);
    await expect(win.locator('.s9-flag-banner')).toHaveCount(1);
    await expect(win.locator('.s9-flag-banner.danger, .s9-typed-confirm')).toHaveCount(0);
    await win.getByRole('button', {name: 'Approve', exact: true}).click();
    const r = (await signed) as {ok: true; value: {signed: string; message: string}};
    expect(signedBy(r.value.signed)).toBe(true);
    expectOwnMessage(r.value.signed, r.value.message);
    await windowClosed(win);
    expect(csp).toEqual([]);
    done(h, server);
  } finally {
    await h.close();
  }
});

test('B1c-33 · a dependent batch (O2): create an account, then transfer into it — step 2 "depends on step 1", UNCHECKED + #10 → both signed; an unrelated failure in step 2 stays Reject only', async () => {
  test.setTimeout(300_000);
  const {h, server} = await scene('noctura-e2e-dapptx-dependent-');
  try {
    const csp = await watchCsp(h);
    holdUsdc(h.fake);
    h.fake.tokenAccounts.set(RECIPIENT, [{pubkey: RECIPIENT_USDC, mint: USDC_MINT, amount: '1000000', decimals: 6}]);
    await popup(h);
    const page = await adapterConnected(h);
    const create = ix.ataCreate(NEW_ATA, RECIPIENT, USDC_MINT, TOKEN_PROGRAM, false);
    let both!: Promise<unknown>;
    const win = await approvalWindow(h.ctx, () => (both = adapter.customSignAll(page, BLOCKHASH, [[create], [ix.transferChecked(OWN_USDC, USDC_MINT, NEW_ATA, 500_000n, 6)]])));
    await expect(win.locator('.top-bar .title')).toHaveText('Critical · Blocked transaction', {timeout: 10_000});
    const step2 = win.locator('section.app-tx-item').nth(1);
    // The fake node simulated step 2 on its own: the account step 1 creates does not exist yet.
    await expect(step2.locator('.s9-flag-banner.danger .head')).toHaveText('This step depends on step 1 and could not be checked on its own.');
    await expect(step2.locator('.s9-flag-banner.danger .meta')).toHaveText('{"InstructionError":[0,"UninitializedAccount"]}');
    await expect(step2.getByText('Balance changes (unknown)')).toBeVisible();
    await expect(win.getByText("Couldn't simulate")).toHaveCount(0);
    // One field, in step 2's section.
    await expect(win.locator('.s9-typed-confirm')).toHaveCount(1);
    const field = step2.getByLabel('Type UNCHECKED to enable Approve');
    const cta = win.getByRole('button', {name: 'Approve anyway'});
    expect(await decideRaw(win, {})).toEqual({ok: false, error: 'override-missing'});
    expect(await decideRaw(win, {overrides: [{tx: 0, word: 'UNCHECKED'}]})).toEqual({ok: false, error: 'override-mismatch'});
    await field.fill('unchecked');
    await expect(cta).toHaveClass(/app-cta-gated/);
    await field.fill('UNCHECKED');
    await cta.click();
    await reauthFromToolbar(h, win, ['Sitedapp.test', 'Transactions2', 'Depends on step 1 — not checked on its ownTransaction 2 of 2'], ['Re-auth required for the first send to a new address.', OVERRIDE_LINE]);
    await cta.click();
    const r = (await both) as {ok: true; value: {signed: string[]; messages: string[]}};
    expect(r.ok).toBe(true);
    expect(r.value.signed).toHaveLength(2);
    r.value.signed.forEach((wire, i) => {
      expect(signedBy(wire)).toBe(true);
      expectOwnMessage(wire, r.value.messages[i] ?? '');
    });
    await windowClosed(win);

    // Step 2 fails for a reason of its own (more USDC than the wallet holds, into an account that exists): no account
    // step 1 creates is in its failing instruction — a plain failure, Reject only, and the background refuses the word.
    let failed!: Promise<unknown>;
    const wf = await approvalWindow(h.ctx, () => (failed = adapter.customSignAll(page, BLOCKHASH, [[create], [ix.transferChecked(OWN_USDC, USDC_MINT, RECIPIENT_USDC, 10_000_000_000n, 6)]])));
    await expect(wf.getByText("Couldn't simulate")).toBeVisible({timeout: 10_000});
    await expect(wf.locator('.s9-flag-banner.danger .meta')).toHaveText('Transaction 2 of 2: {"InstructionError":[0,{"Custom":1}]}');
    await expect(wf.locator('.s9-typed-confirm')).toHaveCount(0);
    await expect(wf.locator('.sticky-bar button')).toHaveText(['Reject']);
    expect(await decideRaw(wf, {overrides: [{tx: 1, word: 'UNCHECKED'}]})).toEqual({ok: false, error: 'simulation-failed'});
    await wf.getByRole('button', {name: 'Reject', exact: true}).click();
    expect(await failed).toEqual({ok: false, message: 'The user rejected the request.', name: 'WalletSignTransactionError'});
    await windowClosed(wf);
    expect(csp).toEqual([]);
    done(h, server);
  } finally {
    await h.close();
  }
});

test('B1c-34 · durable nonce (F8): signTransaction shows "This transaction does not expire." and signs after the hold; signAndSendTransaction is still refused with no window (R12)', async () => {
  test.setTimeout(240_000);
  const {h, server} = await scene('noctura-e2e-dapptx-nonce-');
  try {
    const csp = await watchCsp(h);
    await popup(h);
    const page = await adapterConnected(h);
    const ixs = [ix.advanceNonce(NONCE), ix.transfer(RECIPIENT, 5n)];
    let signed!: Promise<unknown>;
    const win = await approvalWindow(h.ctx, () => (signed = adapter.customSign(page, BLOCKHASH, ixs)));
    const nonce = win.locator('.s9-flag-banner.warn');
    await expect(nonce).toHaveCount(1, {timeout: 10_000});
    const cta = win.getByRole('button', {name: 'Approve', exact: true});
    expect(await heldFor(cta)).toBeGreaterThanOrEqual(1_000);
    await expect(nonce.locator('.head')).toHaveText('This transaction does not expire.');
    await expect(nonce.locator('.meta')).toHaveText('#1 system_program::AdvanceNonceAccount');
    await expect(win.locator('.s9-flag-banner.danger, .s9-typed-confirm')).toHaveCount(0);
    await cta.click();
    const r = (await signed) as {ok: true; value: {signed: string; message: string}};
    expect(signedBy(r.value.signed)).toBe(true);
    expectOwnMessage(r.value.signed, r.value.message);
    await windowClosed(win);
    // The same transaction through sendTransaction (the wallet's signAndSendTransaction): refused at the page, no window,
    // nothing broadcast — and the adapter does not fall back to its own Connection (done() checks the dApp's RPC).
    expect(await noWindow(h.ctx, () => adapter.customSend(page, BLOCKHASH, ixs))).toEqual({ok: false, message: 'The request is not valid.', name: 'WalletSendTransactionError'});
    expect(h.fake.broadcasts).toEqual([]);
    expect(csp).toEqual([]);
    // The watch's positive control: an inline <style> added to an extension page (the popup) is refused and heard.
    const p = await h.openPopup();
    await p.evaluate(() => {
      const style = document.createElement('style');
      style.textContent = 'body { outline: 0 }';
      document.head.append(style);
    });
    await expect.poll(() => csp.length).toBeGreaterThan(0);
    done(h, server);
  } finally {
    await h.close();
  }
});
