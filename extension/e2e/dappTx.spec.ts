import {test, expect, type Page} from '@playwright/test';
import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {contained, launchPopup, type Harness} from './popupHarness';
import {E2E_ACCOUNTS, E2E_PASSWORD, makeEnvelope} from './makeEnvelope';
import {unlockWith} from './vaultPage';
import {DAPP_HOSTS, adapter, approvalWindow, connect, features, noWindow, openDapp, rawSignTx, sendTx, serveDapp, signTx, windowClosed, type DappServer} from './dappPage';
import {parseV0} from './fakeCoordinator';

// Spec B1c §6.3 (B1c-2), §3.3, §1.4: the transaction features against the real extension — the provider, the relay,
// the background's decoder and simulation (through the fake coordinator's proxy), #48 in the approval window, the
// broadcast route — with the test dApp's own @solana/web3.js transactions, driven raw and through
// @solana/wallet-adapter's StandardWalletAdapter (review-1 M1). Titles "B1c-NN · " as B1c-1's. Chromium only (B1c-1's
// note: Firefox's port.sender.origin is a line of B1e's manual run).
declare const chrome: {storage: {local: {set(o: object): Promise<void>; get(k: string): Promise<Record<string, unknown>>}}};

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
/** #48 simulated (the balance changes shown), then Approve — held 500 ms by C15, which Playwright waits out. */
async function approve(win: Page): Promise<void> {
  await expect(win.getByText('Balance changes (post-simulation)').first()).toBeVisible({timeout: 10_000});
  await win.getByRole('button', {name: 'Approve', exact: true}).click();
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
    const r1 = (await one) as {ok: true; value: string[]};
    expect(r1.ok).toBe(true);
    expect(r1.value).toHaveLength(1);
    expect(signedBy(r1.value[0] ?? '')).toBe(true);
    // The simulation the window showed asked the proxy for the account and the transaction's writable accounts.
    expect(h.fake.simulations.at(-1)).toEqual([ACCOUNT, RECIPIENT]);
    await windowClosed(win);

    let five!: Promise<unknown>;
    const w5 = await approvalWindow(h.ctx, () => (five = signTx(page, 5, BLOCKHASH)));
    await expect(w5.locator('.app-tx-batch')).toHaveText(['Transaction 1 of 5', 'Transaction 2 of 5', 'Transaction 3 of 5', 'Transaction 4 of 5', 'Transaction 5 of 5']);
    await approve(w5);
    const r5 = (await five) as {ok: true; value: string[]};
    expect(r5.value).toHaveLength(5);
    expect(r5.value.every(w => signedBy(w))).toBe(true);
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
    const r = (await sent) as {ok: true; value: string};
    expect(r.ok).toBe(true);
    const signature = base58.encode(base64.decode(r.value));
    expect(h.fake.broadcasts).toStrictEqual([signature]);
    const wire = h.fake.broadcastWires[0] ?? '';
    expect(signedBy(wire)).toBe(true);
    expect(parseV0(base64.decode(wire)).keys).toEqual([ACCOUNT, RECIPIENT, '11111111111111111111111111111111']);
    // The pending record, the dApp's (B1b's v1_pending pattern) — the popup's own pending list omits it.
    const pending = (await h.sw.evaluate(() => chrome.storage.local.get('v1_pending'))).v1_pending as {signature: string; origin: string | null; intent: unknown}[];
    expect(pending.map(x => [x.signature, x.origin, x.intent])).toEqual([[signature, DAPP, null]]);
    // The transaction lands in the account's history: #26 badges it.
    h.fake.history.set(ACCOUNT, [{signature, tx: {blockTime: Math.floor(Date.now() / 1000), meta: {err: null, fee: 5000, preBalances: [10_000_000_000, 0, 1], postBalances: [9_997_995_000, 2_000_000, 1], preTokenBalances: [], postTokenBalances: []}, transaction: {message: {accountKeys: [{pubkey: ACCOUNT, signer: true, writable: true}, {pubkey: RECIPIENT, signer: false, writable: true}, {pubkey: '11111111111111111111111111111111', signer: false, writable: false}], instructions: [{programId: '11111111111111111111111111111111', parsed: {type: 'transfer', info: {source: ACCOUNT, destination: RECIPIENT, lamports: 2_000_000}}, program: 'system'}]}}}}]);
    await p.getByRole('button', {name: 'Activity'}).click();
    const row = p.locator('.tx-row', {hasText: 'Sent SOL'});
    await expect(row.locator('.origin-badge')).toHaveText('Dapp · simulated');
    await expect(row.locator('.origin-badge')).toHaveAttribute('aria-label', 'dApp-originated transaction · simulated');
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
    const r1 = (await one) as {ok: true; value: string};
    expect(signedBy(r1.value)).toBe(true);
    await windowClosed(w1);

    let all!: Promise<unknown>;
    const w5 = await approvalWindow(h.ctx, () => (all = adapter.signAll(page, 5, BLOCKHASH)));
    await expect(w5.locator('.app-tx-batch')).toHaveCount(5);
    await approve(w5);
    const r5 = (await all) as {ok: true; value: string[]};
    expect(r5.value).toHaveLength(5);
    expect(r5.value.every(w => signedBy(w))).toBe(true);
    await windowClosed(w5);
    // Six: the background refuses (D8) — the adapter reports its own WalletSignTransactionError, nothing opens.
    const six = (await noWindow(h.ctx, () => adapter.signAll(page, 6, BLOCKHASH))) as {ok: false; message: string};
    expect(six.ok).toBe(false);
    expect(six.message).toBe('The request is not valid.');

    let send!: Promise<unknown>;
    const ws = await approvalWindow(h.ctx, () => (send = adapter.send(page, BLOCKHASH)));
    await approve(ws);
    const rs = (await send) as {ok: true; value: string};
    expect(rs.ok).toBe(true);
    expect(h.fake.broadcasts).toStrictEqual([rs.value]);
    // Through signAndSendTransaction — the dApp's record (the adapter's fallback, signTransaction then its own
    // Connection, would leave none and reach the dApp's RPC, which done() refuses).
    const pending = (await h.sw.evaluate(() => chrome.storage.local.get('v1_pending'))).v1_pending as {signature: string; origin: string | null}[];
    expect(pending.map(x => [x.signature, x.origin])).toStrictEqual([[rs.value, DAPP]]);
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
    let pending!: Promise<unknown>;
    const win = await approvalWindow(h.ctx, () => (pending = signTx(page, 1, BLOCKHASH)));
    await expect(win.getByText("Approving asks you to confirm with your password (or passkey) — you'll start it from the Noctura icon.")).toBeVisible({timeout: 10_000});

    // ADAPTATION (review fix round 3/4, controller ruling — window.ts's ensureWindow and pageApi.ts's mismatchNotice):
    // a mismatch notice never opens a window of its own; it only ever rides along inside a real request's ALREADY
    // open window, shown once the real request ahead of it in the queue is answered — or, with no real request ever
    // queued, it expires silently. The brief's original form (its own approvalWindow()) assumed the notice opened a
    // window by itself; it is fired here instead, queued behind `win`'s still-open real request (so it sits behind it
    // in FIFO order), and asserted to open no window of its own (noWindow) while `win` is the one already showing.
    const other = await openDapp(h.ctx, 'https://jup.ag');
    // A site asking with the account dapp.test holds: refused at once, and the ALREADY-OPEN window (once it gets to
    // this entry) says what was refused. The provider itself refuses an account it was not given; a script posting
    // straight to the relay is what reaches the background (§1.1: every script on the page has the page's authority
    // over the provider).
    const refused = await noWindow(h.ctx, () => rawSignTx(other, ACCOUNT, BLOCKHASH));
    expect(refused).toEqual({error: 'unauthorized'});

    await win.getByRole('button', {name: 'Approve', exact: true}).click();
    await expect(win.getByText("Confirm it's you")).toBeVisible();
    await expect(win.locator('a, input, select, textarea')).toHaveCount(0);
    await expect(win.getByRole('button', {name: 'Approve', exact: true})).toBeDisabled();
    // The toolbar: the popup offers #10 for the site's transaction.
    const toolbar = await h.openPopup();
    const strip = toolbar.getByRole('button', {name: 'A transaction from dapp.test waits for your confirmation'});
    const [tab] = await Promise.all([h.ctx.waitForEvent('page'), strip.click()]);
    await expect(tab).toHaveURL(/unlock\.html\?mode=reauth&challenge=[0-9a-f]{32}$/);
    await expect(tab.locator('#ra-about')).toHaveText('You are about to approve');
    await tab.locator('#ra-password').fill(E2E_PASSWORD);
    await tab.locator('#ra-confirm').click();
    await expect(tab.locator('#ra-notice-line')).toHaveText('Confirmed. Go back to the approval window and approve the transaction.', {timeout: 60_000});
    // The window learns it on its next poll (one a second).
    await expect(win.getByText("Confirm it's you")).toHaveCount(0, {timeout: 3_000});
    await win.getByRole('button', {name: 'Approve', exact: true}).click();
    const r = (await pending) as {ok: true; value: string[]};
    expect(signedBy(r.value[0] ?? '')).toBe(true);

    // The window does NOT close here: the mismatch notice queued behind the real request is shown next, in the SAME
    // window (it rode along rather than opening one of its own).
    await expect(win.getByText('Request blocked automatically')).toBeVisible();
    await expect(win.locator('.s9-payload-card .row .v')).toHaveText(['dapp.test', 'jup.ag', 'false', 'REJECT_NO_PROMPT']);
    await win.getByRole('button', {name: 'OK, return to dApp'}).click();
    await windowClosed(win);
    done(h, server);
  } finally {
    await h.close();
  }
});
