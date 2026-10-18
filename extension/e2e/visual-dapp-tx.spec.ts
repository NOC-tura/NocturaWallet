import {test, expect, type Locator, type Page, type Worker} from '@playwright/test';
import {base58} from '@scure/base';
import {contained, launchPopup, seedUnlockedWallet, MAIN, SAVINGS, type Harness} from './popupHarness';
import {DAPP_HOSTS, adapter, approvalWindow, connect, customSignTx, noWindow, openDapp, rawSignTx, sendTx, serveDapp, signTx, type DappServer, type RawIx} from './dappPage';
import {ATA_PROGRAM, TOKEN_2022_PROGRAM, mintData} from './fakeCoordinator';
import {gateClear, shot} from './visualTab';

// Spec B1c §6.4 (B1c-2): every #48 state B1c-2 builds, the origin-mismatch notice, the popup's re-authentication strip
// (D11), #10 for a site's transaction, and #26/#27's "Dapp · simulated" badge — saved for the opus-tier review against
// index.html (#48 ix:18261-18705, #26b ix:11813, #27b ix:12163). The approval window at 412 × 720, the popup at
// 412 × 600, the vault page at 412 × 916. Every state asserts its own copy before its shot; transient states are held
// by the test (the coordinator's answers held, a dapp.decide held), never slept through. B1c-3 (spec §3.3 rev 3.6, the
// design's state 2 ix:18325-18396): every red-flag state — the unlimited approve's typed field empty, in the wrong case
// and matched, each other block, a batch with one blocked transaction, every warning's banner, the dependent step, a
// lookalike with a block, #10 for an override — and the carried B1c-2 items (#11's pending-send strip, Tensor's tile on
// #47/#48 beside #49's). A flagged screen's CTA is held 1.5 s: a shot with an enabled CTA awaits it; a gated one is
// shot once that hold has passed, so the drawn state is the gate's, not the hold's.
declare const chrome: {storage: {local: {set(o: object): Promise<void>; remove(k: string): Promise<void>}; session: {set(o: object): Promise<void>; get(k: string): Promise<Record<string, unknown>>}}};

const RECIPIENT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
const BLOCKHASH = base58.encode(new Uint8Array(32).fill(7));
const set = (sw: Worker, o: object) => sw.evaluate(x => chrome.storage.local.set(x), o);
const fresh = (sw: Worker) => set(sw, {v1_dapp_limits: {rejections: [], cooldowns: [], windows: [], notice: false}});
const grant = (origin: string) => ({origin, account: MAIN.publicKey, scope: 'persistent', connectedAt: Date.now() - 86_400_000, lastUsedAt: Date.now(), recent: []});

// Fix round 1 (I1): fixed, deterministic addresses for the decoder's own-safety-relevant shots — the same style as
// BLOCKHASH above (a fixed byte fill, never a randomly generated string that might not decode as a pubkey).
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const NOC_MINT = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';
const UNKNOWN_PROGRAM = base58.encode(new Uint8Array(32).fill(6));
const MINT_ADDR = base58.encode(new Uint8Array(32).fill(3));
const SOURCE_TOKEN_ACCT = base58.encode(new Uint8Array(32).fill(4));
const DEST_TOKEN_ACCT = base58.encode(new Uint8Array(32).fill(5));
/** An instruction's amount field, 8 bytes little-endian (SPL Token's own layout). */
const u64le = (n: bigint): number[] => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, n, true);
  return Array.from(b);
};
/** Tx.tsx's own MINUS (U+2212, not a hyphen) — built from its code point, never typed literally. */
const MINUS = String.fromCharCode(0x2212);

/**
 * A window state: its own copy first, every sticky-bar button wholly in the 412 × 720 viewport (fix round 1, I2:
 * every window shot, not only some), then the shot (the pointer off the column; `ready`, a held CTA, awaited
 * enabled).
 */
async function still(win: Page, name: string, visible: Locator, ready?: Locator): Promise<void> {
  await expect(visible).toBeVisible();
  await barInView(win);
  await win.mouse.move(0, 0);
  await shot(win, name, {fullPage: false, ...(ready === undefined ? {} : {ready})});
}
async function windowFor(h: Harness, ask: () => unknown): Promise<Page> {
  const win = await approvalWindow(h.ctx, ask);
  await win.setViewportSize({width: 412, height: 720});
  return win;
}
/** Answers the window's request with its ✕ (= Reject, C4; the mismatch notice's dismissal) and waits for it to close. */
async function dismiss(win: Page): Promise<void> {
  const closed = win.waitForEvent('close');
  await win.getByRole('button', {name: 'Close'}).click();
  await closed;
}
/**
 * A popup shot clear of the pinned bars (B1c-1's `pop`, visual-dapp.spec.ts): the state's element in the viewport and
 * not under the top bar, the action bar or the tab bar.
 */
async function pop(page: Page, name: string, visible: Locator): Promise<void> {
  const bars = page.locator('main.app-content > .screen > .top-bar, main.app-content > .screen > .sticky-bar, nav.app-tab-bar');
  const under = async (): Promise<string | null> => {
    const box = await visible.boundingBox();
    if (box === null) return 'no box';
    const el = await visible.elementHandle();
    for (const bar of await bars.all()) {
      const b = await bar.boundingBox();
      if (b === null || (await bar.evaluate((e, x) => e.contains(x), el))) continue;
      if (box.y < b.y + b.height && b.y < box.y + box.height) return await bar.evaluate(e => e.className);
    }
    return null;
  };
  if ((await under()) !== null) await visible.evaluate(e => e.scrollIntoView({block: 'center'}));
  await expect(visible).toBeInViewport();
  expect(await under(), `${name}: the state's element clear of the pinned bars`).toBeNull();
  await shot(page, name, {fullPage: false});
}
/** No control of the window is clipped at 412 × 720: every button of the sticky bar inside the viewport. */
async function barInView(win: Page): Promise<void> {
  for (const b of await win.locator('.sticky-bar button').all()) await expect(b).toBeInViewport({ratio: 1});
}

async function scene(): Promise<{h: Harness; server: DappServer}> {
  const h = await launchPopup('noctura-e2e-visual-dapptx-', {hosts: DAPP_HOSTS});
  const server = await serveDapp(h.ctx);
  await seedUnlockedWallet(h.sw);
  await set(h.sw, {v1_dapp_grants: [grant('https://jup.ag'), grant('https://dapp.test'), grant('https://tensr.trade')], v1_known_recipients: [{address: RECIPIENT, at: Date.now()}]});
  // A decision held open (the approving state): approve.html's dapp.decide waits while window.__holdDecide is set.
  await h.ctx.addInitScript(() => {
    if (location.pathname !== '/approve.html') return;
    const rt = (globalThis as unknown as {chrome: {runtime: {sendMessage(m: unknown): Promise<unknown>}}}).chrome.runtime;
    const send = rt.sendMessage.bind(rt);
    const w = window as unknown as {__holdDecide?: boolean};
    rt.sendMessage = (m: unknown) => ((m as {type?: string}).type === 'dapp.decide' && w.__holdDecide === true ? new Promise(() => undefined) : send(m));
  });
  return {h, server};
}
/** A granted page, its provider holding the account (a silent connect). */
async function granted(h: Harness, origin: string): Promise<Page> {
  const page = await openDapp(h.ctx, origin);
  await expect.poll(() => connect(page, true)).toEqual({ok: true, value: [MAIN.publicKey]});
  return page;
}

test('visual · #48: simulating, simulated, a batch, re-authentication, approving, couldn’t simulate, unreachable, expired (Q21), lookalike, the request that can no longer be signed; the mismatch notice', async () => {
  test.setTimeout(420_000);
  const {h, server} = await scene();
  try {
    const p = await h.openPopup();
    await expect(p.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
    const jup = await granted(h, 'https://jup.ag');

    // simulating-blocking: the coordinator's answers held — the banner, the skeleton, "Approve · simulating".
    await fresh(h.sw);
    let release = h.fake.hold();
    let win = await windowFor(h, () => signTx(jup, 1, BLOCKHASH));
    await expect(win.getByRole('button', {name: /Approve/})).toHaveText('Approve· simulating');
    await expect(win.getByRole('button', {name: /Approve/})).toBeDisabled();
    await still(win, '48-simulating', win.getByText('Simulating transaction…'));
    release();
    // simulated: the changes, the decoded instructions, the fee, the origin pill.
    await expect(win.getByText('Balance changes (post-simulation)')).toBeVisible({timeout: 10_000});
    await still(win, '48-simulated', win.getByText('Balance changes (post-simulation)'), win.getByRole('button', {name: 'Approve', exact: true}));
    await win.locator('.s9-origin-pill').evaluate(e => e.scrollIntoView({block: 'end'}));
    // Fix round 1 (minor): the origin pill is below the fold in 48-simulated (`toBeVisible` does not require the
    // viewport); asserted here, scrolled into view, where it is actually part of the shot.
    await expect(win.getByText('Request from jup.ag · matches active session')).toBeInViewport();
    await still(win, '48-simulated-instructions', win.getByText('Network fee'));
    // approving: the decision held.
    await win.evaluate(() => void ((window as unknown as {__holdDecide: boolean}).__holdDecide = true));
    await win.getByRole('button', {name: 'Approve', exact: true}).click();
    await expect(win.getByRole('button', {name: 'Approving…'})).toBeDisabled();
    await still(win, '48-approving', win.locator('.top-bar .title', {hasText: 'Approving'}));
    await win.close();

    // A batch of three.
    await fresh(h.sw);
    win = await windowFor(h, () => signTx(jup, 3, BLOCKHASH));
    await expect(win.getByText('Transaction 3 of 3')).toBeAttached({timeout: 10_000});
    await expect(win.getByText('Balance changes (post-simulation)').first()).toBeVisible({timeout: 10_000});
    await still(win, '48-batch', win.getByText('Transaction 1 of 3'), win.getByRole('button', {name: 'Approve', exact: true}));
    await dismiss(win);

    // Re-authentication: an unknown recipient (a first send) — the line, then the toolbar instruction.
    await set(h.sw, {v1_known_recipients: []});
    await fresh(h.sw);
    win = await windowFor(h, () => signTx(jup, 1, BLOCKHASH));
    const line = win.getByText("Approving asks you to confirm with your password (or passkey) — you'll start it from the Noctura icon.");
    await expect(line).toBeVisible({timeout: 10_000});
    await expect(line).toBeInViewport();
    await still(win, '48-reauth-needed', line, win.getByRole('button', {name: 'Approve', exact: true}));
    await win.getByRole('button', {name: 'Approve', exact: true}).click();
    const waiting = win.getByText("Confirm it's you");
    await expect(waiting).toBeVisible();
    await expect(win.locator('.s9-flag-banner.warn')).toBeInViewport({ratio: 1});
    await still(win, '48-reauth-waiting', waiting);
    // The popup's strip (D11: the password is typed only after clicking the Noctura icon), and #10 for it.
    const toolbar = await h.openPopup();
    const strip = toolbar.getByRole('button', {name: 'A transaction from jup.ag waits for your confirmation'});
    await expect(toolbar.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
    // Final review MUST-FIX 2: the strip and its chevron wholly inside the popup (it ran past the right edge before).
    await expect(strip.locator('.app-strip-chev')).toBeInViewport({ratio: 1});
    await expect(strip).toBeInViewport({ratio: 1});
    await pop(toolbar, '11-dapp-reauth-strip', strip);
    const [tab] = await Promise.all([h.ctx.waitForEvent('page'), strip.click()]);
    await tab.setViewportSize({width: 412, height: 916});
    await expect(tab.locator('#ra-about')).toHaveText('You are about to approve');
    await expect(tab.locator('#ra-rows')).toContainText('jup.ag');
    // Final review MUST-FIX 2: the intent card's headline amount (#10 ix:6061-6064) — what leaves the account; B1c-3:
    // unsigned, as the design's send headline (the minus stays on the rows).
    await expect(tab.locator('#ra-amount-row')).toBeVisible();
    await expect(tab.locator('#ra-amount')).toHaveText(/^0\.\d+$/);
    await expect(tab.locator('#ra-symbol')).toHaveText('SOL');
    await shot(tab, '10-dapp', {fullPage: false});
    await tab.close();
    await dismiss(win);
    await set(h.sw, {v1_known_recipients: [{address: RECIPIENT, at: Date.now()}]});

    // couldn't simulate; an expired blockhash (Q21).
    h.fake.simulateError = true;
    await fresh(h.sw);
    win = await windowFor(h, () => signTx(jup, 1, BLOCKHASH));
    await expect(win.getByText("Couldn't simulate")).toBeVisible({timeout: 10_000});
    await still(win, '48-couldnt-simulate', win.getByText('{"InstructionError":[2,{"Custom":1}]}'));
    await dismiss(win);
    h.fake.simulateErr = 'BlockhashNotFound';
    await fresh(h.sw);
    win = await windowFor(h, () => signTx(jup, 1, BLOCKHASH));
    await still(win, '48-expired', win.getByText('This request has expired. Ask the site to try again.'));
    await dismiss(win);
    h.fake.simulateError = false;

    // The proxy unreachable while the window simulates.
    await fresh(h.sw);
    release = h.fake.hold();
    win = await windowFor(h, () => signTx(jup, 1, BLOCKHASH));
    await expect(win.getByText('Simulating transaction…')).toBeVisible();
    h.fake.network = 'unreachable';
    release();
    await still(win, '48-unreachable', win.getByText('Could not reach the Noctura server.'));
    h.fake.network = 'ok';
    await dismiss(win);

    // The decoder's most safety-relevant displays (fix round 1, I1): an unknown program, a known program's
    // instruction with no decoded fields, an SPL token transfer, a transaction moving no SOL or token balance at
    // all, signAndSendTransaction's own copy, the Q17 "Block this site" offer, and a lookalike whose simulation
    // failed.
    const tensr = await granted(h, 'https://tensr.trade');

    // An unknown program (B1 §3): the whole address in groups of four, "unknown program".
    await fresh(h.sw);
    win = await windowFor(h, () => customSignTx(jup, BLOCKHASH, MAIN.publicKey, [{programId: UNKNOWN_PROGRAM, keys: [{pubkey: MAIN.publicKey, isSigner: true, isWritable: true}], data: [9, 9, 9, 9]}]));
    await expect(win.getByText('Balance changes (post-simulation)')).toBeVisible({timeout: 10_000});
    // B1c-3: the instruction row's own "· unknown program" — F1's warning banner ("Unknown program") now stands above it.
    const unknownProgram = win.getByText('· unknown program');
    await expect(unknownProgram).toBeVisible();
    await expect(win.locator('.s9-flag-banner.warn .head')).toHaveText('Unknown program');
    await still(win, '48-unknown-program', unknownProgram, win.getByRole('button', {name: 'Approve', exact: true}));
    await dismiss(win);

    // A known program's instruction the decoder names but does not decode the fields of (fix round 1, I3: mintTo).
    await fresh(h.sw);
    win = await windowFor(h, () =>
      customSignTx(jup, BLOCKHASH, MAIN.publicKey, [
        {programId: TOKEN_PROGRAM, keys: [{pubkey: MINT_ADDR, isSigner: false, isWritable: true}, {pubkey: DEST_TOKEN_ACCT, isSigner: false, isWritable: true}, {pubkey: MAIN.publicKey, isSigner: true, isWritable: false}], data: [7]},
      ]),
    );
    await expect(win.getByText('Balance changes (post-simulation)')).toBeVisible({timeout: 10_000});
    const notDecoded = win.getByText('Details not decoded — check them on the site before approving.');
    await expect(notDecoded).toBeVisible();
    await still(win, '48-not-decoded', notDecoded, win.getByRole('button', {name: 'Approve', exact: true}));
    await dismiss(win);

    // An SPL token transfer: the token row, its known decimals (NOC).
    await fresh(h.sw);
    h.fake.tokenAccounts.set(MAIN.publicKey, [{pubkey: SOURCE_TOKEN_ACCT, mint: NOC_MINT, amount: '5000000000', decimals: 9}]);
    h.fake.tokenAccounts.set(RECIPIENT, [{pubkey: DEST_TOKEN_ACCT, mint: NOC_MINT, amount: '1000000000', decimals: 9}]);
    win = await windowFor(h, () =>
      customSignTx(jup, BLOCKHASH, MAIN.publicKey, [
        {programId: TOKEN_PROGRAM, keys: [{pubkey: SOURCE_TOKEN_ACCT, isSigner: false, isWritable: true}, {pubkey: DEST_TOKEN_ACCT, isSigner: false, isWritable: true}, {pubkey: MAIN.publicKey, isSigner: true, isWritable: false}], data: [3, ...u64le(1_000_000_000n)]},
      ]),
    );
    await expect(win.getByText('Balance changes (post-simulation)')).toBeVisible({timeout: 10_000});
    const nocRow = win.locator('.s9-bal-row', {hasText: 'NOC'});
    // Fix round 2 (minor): the row's own delta, not merely that a row naming NOC exists.
    await expect(nocRow).toContainText(`${MINUS}1`);
    await still(win, '48-token-transfer', nocRow, win.getByRole('button', {name: 'Approve', exact: true}));
    await dismiss(win);

    // No SOL or token balance change at all (R2, owner-delegated; fix round 2, controller ruling: never an
    // approve here — see 48-approval-reauth below for why): an unknown-program instruction, paid for by another
    // signer — the connected account only co-signs, so its own balance holds still.
    await fresh(h.sw);
    win = await windowFor(h, () => customSignTx(jup, BLOCKHASH, SAVINGS.publicKey, [{programId: UNKNOWN_PROGRAM, keys: [{pubkey: MAIN.publicKey, isSigner: true, isWritable: false}], data: [1]}]));
    const noChanges = win.getByText('No SOL or token balance changes — review the instructions below.');
    await expect(noChanges).toBeVisible({timeout: 10_000});
    await still(win, '48-no-balance-change', noChanges, win.getByRole('button', {name: 'Approve', exact: true}));
    await dismiss(win);

    // Fix round 2, IMPORTANT (controller ruling): an approve that moves no SOL or token balance STILL sets a new
    // or raised delegate on chain — simulate.ts's own `approvalFromChain` reads exactly that from the
    // post-simulation account data and re-authenticates it (the "Approving asks you to confirm…" line), the same
    // as any other claim-raising instruction. The fake now models Approve's resulting delegate (fakeCoordinator.ts,
    // `tokenAccountData`/`approvals`) so this shot — "No SOL or token balance changes" TOGETHER with the
    // re-authentication line — is what the product actually renders for an approve, never the misleadingly quiet
    // screen a delegate-blind fake drew before. Another signer (`SAVINGS`) pays, as 48-no-balance-change does —
    // MAIN only co-signs, so the SOL side genuinely holds still too; the delegate comes from chain state alone.
    await fresh(h.sw);
    win = await windowFor(h, () =>
      customSignTx(jup, BLOCKHASH, SAVINGS.publicKey, [
        {programId: TOKEN_PROGRAM, keys: [{pubkey: SOURCE_TOKEN_ACCT, isSigner: false, isWritable: true}, {pubkey: RECIPIENT, isSigner: false, isWritable: false}, {pubkey: MAIN.publicKey, isSigner: true, isWritable: false}], data: [4, ...u64le(500_000_000n)]},
      ]),
    );
    // B1c-3: a bounded approve is F6 — its warning banner, and the design's synthesized "<SYM> delegated · <amount>" row
    // in place of L3's "No SOL or token balance changes" line (spec §3.3 rev 3.6); still re-authenticated.
    const delegatedRow = win.locator('.s9-bal-row', {hasText: 'NOC delegated'});
    const reauthLine = win.getByText("Approving asks you to confirm with your password (or passkey) — you'll start it from the Noctura icon.");
    await expect(delegatedRow).toBeVisible({timeout: 10_000});
    await expect(delegatedRow).toContainText('0.5');
    await expect(win.getByText('No SOL or token balance changes — review the instructions below.')).toHaveCount(0);
    await expect(win.locator('.s9-flag-banner.warn .head')).toHaveText(['NOC spend approval']);
    await expect(reauthLine).toBeVisible();
    await still(win, '48-approval-reauth', delegatedRow, win.getByRole('button', {name: 'Approve', exact: true}));
    await dismiss(win);

    // signAndSendTransaction's own copy: Noctura broadcasts, never the site.
    await fresh(h.sw);
    win = await windowFor(h, () => sendTx(jup, BLOCKHASH, 5));
    const sendsNoctura = win.getByText('Noctura sends this transaction as soon as you approve.');
    await expect(sendsNoctura).toBeVisible({timeout: 10_000});
    await still(win, '48-sign-and-send', sendsNoctura, win.getByRole('button', {name: 'Approve', exact: true}));
    await dismiss(win);

    // Q17: "Block this site", offered on the third request after two rejections from this host.
    await fresh(h.sw);
    win = await windowFor(h, () => signTx(jup, 1, BLOCKHASH));
    await expect(win.getByText('Balance changes (post-simulation)')).toBeVisible({timeout: 10_000});
    await dismiss(win);
    win = await windowFor(h, () => signTx(jup, 1, BLOCKHASH));
    await expect(win.getByText('Balance changes (post-simulation)')).toBeVisible({timeout: 10_000});
    await dismiss(win);
    win = await windowFor(h, () => signTx(jup, 1, BLOCKHASH));
    const blockOffer = win.getByRole('button', {name: 'Block this site'});
    await expect(blockOffer).toBeVisible({timeout: 10_000});
    await still(win, '48-block-offer', blockOffer, win.getByRole('button', {name: 'Approve', exact: true}));
    await dismiss(win);

    // A lookalike whose simulation failed: Reject and report + Reject only — never Approve anyway. (The earlier
    // Q21 block left `simulateErr` at 'BlockhashNotFound' — reset to the default failure here, or this reads as
    // expired, not failed.)
    h.fake.simulateErr = {InstructionError: [2, {Custom: 1}]};
    h.fake.simulateError = true;
    await fresh(h.sw);
    win = await windowFor(h, () => signTx(tensr, 1, BLOCKHASH));
    await expect(win.getByText("Couldn't simulate")).toBeVisible({timeout: 10_000});
    await expect(win.getByText('It looks like tensor.trade but is a different site.')).toBeVisible();
    await expect(win.getByRole('button', {name: 'Approve anyway (not recommended)'})).toHaveCount(0);
    await still(win, '48-lookalike-sim-failed', win.getByRole('button', {name: 'Reject and report'}));
    await dismiss(win);
    h.fake.simulateError = false;

    // A lookalike origin (granted through "Connect anyway"): the banner, the flipped bar, the confirm.
    await fresh(h.sw);
    win = await windowFor(h, () => signTx(tensr, 1, BLOCKHASH));
    await expect(win.getByText('Balance changes (post-simulation)')).toBeVisible({timeout: 10_000});
    await still(win, '48-lookalike', win.getByText('It looks like tensor.trade but is a different site.'), win.getByRole('button', {name: 'Approve anyway (not recommended)'}));
    await win.getByRole('button', {name: 'Approve anyway (not recommended)'}).click();
    await still(win, '48-lookalike-confirm', win.getByRole('dialog', {name: 'We strongly recommend rejecting. Continue?'}));
    await win.getByRole('button', {name: 'Cancel'}).click();
    await dismiss(win);

    // The request that can no longer be signed (Q26): the granted account leaves the unlocked session.
    await fresh(h.sw);
    win = await windowFor(h, () => sendTx(jup, BLOCKHASH, 5));
    await expect(win.getByText('Balance changes (post-simulation)')).toBeVisible({timeout: 10_000});
    await h.sw.evaluate(s => chrome.storage.session.set({v1_session: {accounts: [s]}}), {index: SAVINGS.index, publicKey: SAVINGS.publicKey, secretKey: SAVINGS.secretKey});
    await still(win, '48-cannot-sign', win.getByText('This request can no longer be signed. Reject it and ask the site to try again.'));
    await dismiss(win);
    await seedUnlockedWallet(h.sw);

    // The origin-mismatch notice: a page with no grant names MAIN (granted to jup.ag and others). Controller
    // ruling: staged as B1c-28 does (dappTx.spec.ts) — the notice never opens a window of its own (window.ts,
    // STRUCTURAL: ensureWindow opens only for a REAL, non-mismatch open entry). A disposable REAL request (jup.ag,
    // still granted) opens this window first; the raw mismatch request, fired while that window is open, queues
    // silently behind it (`noWindow`: answered `unauthorized` at once, no window of its own — exactly as a notice
    // queued behind an open real request should be); rejecting the disposable request through the sticky bar's own
    // Reject button leaves the notice as the only entry left, which rides along in the SAME window (window.ts fix
    // round 4: "a mismatch notice rides along in a real request's window") rather than opening a new one.
    await set(h.sw, {v1_dapp_grants: [grant('https://jup.ag')]});
    const stranger = await openDapp(h.ctx, 'https://dapp.test');
    await fresh(h.sw);
    let disposable!: Promise<unknown>;
    win = await windowFor(h, () => (disposable = signTx(jup, 1, BLOCKHASH)));
    await expect(win.getByText('Balance changes (post-simulation)')).toBeVisible({timeout: 10_000});
    const refused = await noWindow(h.ctx, () => rawSignTx(stranger, MAIN.publicKey, BLOCKHASH));
    expect(refused).toEqual({error: 'unauthorized'});
    await win.getByRole('button', {name: 'Reject', exact: true}).click();
    await expect(disposable).resolves.toEqual({ok: false, code: 4001, message: 'The user rejected the request.'});
    await expect(win.getByText('Request blocked automatically')).toBeVisible({timeout: 10_000});
    // The detail's tones in a real browser (the card's own `.v` colour must not win): the session green, the request red.
    const tone = (i: number) => win.locator('.s9-payload-card .row .v').nth(i).evaluate(e => getComputedStyle(e).color);
    // The design-system's own tones, read from a probe element of each class (positive references).
    const reference = (cls: string) =>
      win.evaluate(c => {
        const probe = document.createElement('span');
        probe.className = c;
        document.body.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      }, cls);
    const [success, danger] = [await reference('noc-success'), await reference('noc-danger')];
    expect(success).not.toBe(danger);
    expect([await tone(0), await tone(1), await tone(2), await tone(3)]).toEqual([success, danger, danger, danger]);
    await still(win, '48-origin-mismatch', win.getByText('Request blocked automatically'), win.getByRole('button', {name: 'OK, return to dApp'}));
    await win.locator('.app-tx-caption').evaluate(e => e.scrollIntoView({block: 'end'}));
    await still(win, '48-origin-mismatch-detail', win.getByText('REJECT_NO_PROMPT'));
    await dismiss(win);
    contained(h);
    expect(server.unexpected).toEqual([]);
  } finally {
    await h.close();
  }
});

// ——— B1c-3: the red flags (spec §3.3 rev 3.6), the background's, as #48 draws them. The instructions are B1c-30 … B1c-34's
// (dappTx.spec.ts), signed by MAIN: jup.ag (verified — the design's own state 2 origin) asks through the provider's
// signTransaction, a batch through StandardWalletAdapter's signAllTransactions.
const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const RECENT_BLOCKHASHES = 'SysvarRecentB1ockHashes11111111111111111111';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const U64_MAX = 2n ** 64n - 1n;
/** Fixed, distinct keys (a byte fill, as BLOCKHASH), the same fills as dappTx.spec.ts's B1c-3 keys. */
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
const NONCE = key(41);
const DAPP_PROGRAM = key(42);
const OWN_EMPTY = key(43);
const STRANGER = key(44);
const HOOK_PROGRAM = key(45);
const UNREAD_MINT = key(46);
const OWN_UNREAD = key(47);
const NEW_OWNER = key(48);
/** B1 §3: Confirm held 1.5 s on any red-flag screen (useArmed.ts FLAG_HOLD_MS). */
const FLAG_HOLD_MS = 1_500;
const signer = (pubkey: string, isWritable = true) => ({pubkey, isSigner: true, isWritable});
const writable = (pubkey: string) => ({pubkey, isSigner: false, isWritable: true});
const readonly = (pubkey: string) => ({pubkey, isSigner: false, isWritable: false});
const ix = {
  /** SPL Token ApproveChecked (13): source, mint, delegate, owner; amount, decimals. */
  approveChecked: (source: string, mint: string, delegate: string, amount: bigint, decimals: number): RawIx => ({programId: TOKEN_PROGRAM, keys: [writable(source), readonly(mint), readonly(delegate), signer(MAIN.publicKey, false)], data: [13, ...u64le(amount), decimals]}),
  /** SPL Token TransferChecked (12): source, mint, destination, owner; amount, decimals. */
  transferChecked: (source: string, mint: string, destination: string, amount: bigint, decimals: number): RawIx => ({programId: TOKEN_PROGRAM, keys: [writable(source), readonly(mint), writable(destination), signer(MAIN.publicKey, false)], data: [12, ...u64le(amount), decimals]}),
  /** SPL Token SetAuthority (6) of a token account: AccountOwner (2) to `to`. */
  setOwner: (account: string, to: string): RawIx => ({programId: TOKEN_PROGRAM, keys: [writable(account), signer(MAIN.publicKey, false)], data: [6, 2, 1, ...base58.decode(to)]}),
  /** SPL Token CloseAccount (9): account, destination, owner. */
  closeAccount: (account: string, destination: string): RawIx => ({programId: TOKEN_PROGRAM, keys: [writable(account), writable(destination), signer(MAIN.publicKey, false)], data: [9]}),
  /** System Assign (1) of the wallet account to `owner`. */
  assign: (owner: string): RawIx => ({programId: SYSTEM_PROGRAM, keys: [signer(MAIN.publicKey)], data: [1, 0, 0, 0, ...base58.decode(owner)]}),
  /** System Transfer (2) from the wallet account. */
  transfer: (to: string, lamports: bigint): RawIx => ({programId: SYSTEM_PROGRAM, keys: [signer(MAIN.publicKey), writable(to)], data: [2, 0, 0, 0, ...u64le(lamports)]}),
  /** System AdvanceNonceAccount (4): nonce account, the recent-blockhashes sysvar, the nonce authority. */
  advanceNonce: (nonce: string): RawIx => ({programId: SYSTEM_PROGRAM, keys: [writable(nonce), readonly(RECENT_BLOCKHASHES), signer(MAIN.publicKey, false)], data: [4, 0, 0, 0]}),
  /** ATA Create (no data) / CreateIdempotent (1): payer, account, wallet, mint, System, the token program. */
  ataCreate: (account: string, wallet: string, mint: string, tokenProgram: string, idempotent: boolean): RawIx => ({
    programId: ATA_PROGRAM,
    keys: [signer(MAIN.publicKey), writable(account), readonly(wallet), readonly(mint), readonly(SYSTEM_PROGRAM), readonly(tokenProgram)],
    data: idempotent ? [1] : [],
  }),
};
/** The flagged screen's 1.5 s hold, passed — a gated CTA shot after it shows the gate, not the hold. */
async function pastHold(win: Page, cta: Locator): Promise<void> {
  await win.waitForTimeout(FLAG_HOLD_MS);
  await expect(cta).toBeDisabled();
}
/** A section of the scroll area brought into view under the window's top bar (its own `scrollIntoView`, re-checked). */
async function into(l: Locator, block: 'start' | 'center' | 'end' = 'center'): Promise<void> {
  await l.evaluate((e, b) => e.scrollIntoView({block: b}), block);
  await expect(l).toBeInViewport();
}
const OVERRIDE_LINE = 'Re-auth required to override a blocked transaction.';
/** How many lines an element's text takes, read from its text nodes' own boxes (an icon beside it is not a line). */
const lines = (l: Locator) =>
  l.evaluate(e => {
    const tops = new Set<number>();
    const walk = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n !== null; n = walk.nextNode()) {
      const r = document.createRange();
      r.selectNodeContents(n);
      for (const box of r.getClientRects()) if (box.width > 0) tops.add(Math.round(box.top));
    }
    return tops.size;
  });
/** The visual pass's findings, asserted where they were seen: the CTA's label on one line, inside its box. */
async function oneLine(cta: Locator): Promise<void> {
  expect(await lines(cta)).toBe(1);
  expect(await cta.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
}
/** An address in a banner's meta flows in the meta's own 11 px line (the design's ix:18353), not as a block of its own. */
async function metaInline(banner: Locator): Promise<void> {
  const groups = banner.locator('.meta .addr-groups').first();
  expect(await groups.evaluate(e => [getComputedStyle(e).display, getComputedStyle(e).fontSize])).toEqual(['inline', '11px']);
}

test('visual · #48 (B1c-3): an unlimited approve typed empty, wrong case, matched, and #10 for it; Assign and SetAuthority blocked, "Approve anyway"; a batch with one blocked transaction; every warning; the dependent step; a lookalike with a block', async () => {
  test.setTimeout(420_000);
  const {h, server} = await scene();
  try {
    // The wallet holds 740.21 USDC, an empty USDC account and two Token-2022 accounts; USDC's mint reads as Circle's.
    h.fake.tokenAccounts.set(MAIN.publicKey, [
      {pubkey: OWN_USDC, mint: USDC_MINT, amount: '740210000', decimals: 6},
      {pubkey: OWN_EMPTY, mint: USDC_MINT, amount: '0', decimals: 6},
      {pubkey: OWN_T22, mint: T22_MINT, amount: '1000000', decimals: 6, program: 'token-2022'},
      {pubkey: OWN_UNREAD, mint: UNREAD_MINT, amount: '1000000', decimals: 6, program: 'token-2022'},
    ]);
    h.fake.mints.set(USDC_MINT, {program: 'token', data: mintData({decimals: 6, mintAuthority: ISSUER, freezeAuthority: FREEZER})});
    // A Token-2022 mint with all three settings B1 §3 names (UNREAD_MINT stays unlisted: the wallet cannot read it, Q36).
    h.fake.mints.set(T22_MINT, {program: 'token-2022', data: mintData({decimals: 6, mintAuthority: ISSUER, freezeAuthority: FREEZER, extensions: {permanentDelegate: PERMANENT_DELEGATE, transferHook: {authority: HOOK_AUTHORITY, program: HOOK_PROGRAM}}})});
    const p = await h.openPopup();
    await expect(p.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
    const jup = await granted(h, 'https://jup.ag');
    // StandardWalletAdapter on the same granted page: its connect is answered without a window (the grant exists).
    expect(await adapter.connect(jup)).toEqual({ok: true, value: MAIN.publicKey});

    // F5 (O1): the design's state 2 — the eyebrow, ONE danger banner, the synthesized row, the field empty and the red
    // CTA greyed (#37's gated look) and disabled.
    await fresh(h.sw);
    let win = await windowFor(h, () => customSignTx(jup, BLOCKHASH, MAIN.publicKey, [ix.approveChecked(OWN_USDC, USDC_MINT, DELEGATE, U64_MAX, 6)]));
    await expect(win.locator('.top-bar .title')).toHaveText('Critical · Unlimited spend approval', {timeout: 10_000});
    const unlimited = win.locator('.s9-flag-banner.danger');
    await expect(unlimited).toHaveCount(1);
    await expect(unlimited.locator('.head')).toHaveText('Unlimited USDC spend approval');
    await expect(unlimited.locator('.body')).toHaveText(
      'This transaction includes a spl_token::ApproveChecked instruction with amount = u64::MAX (~18.4 quintillion units). Even verified dApps can be exploited; this lets the program move all your USDC, now and in the future, until you revoke.',
    );
    await expect(unlimited.locator('.meta')).toHaveText(`delegate: ${DELEGATE} · token: USDC mint ${USDC_MINT} · scope: u64::MAX`);
    await expect(win.locator('.s9-flag-banner.warn')).toHaveCount(0);
    const delegated = win.locator('.s9-bal-row', {hasText: 'USDC delegated'});
    await expect(delegated).toContainText('unlimited');
    await expect(delegated).toContainText('≈ all current + future');
    const approveUnlimited = win.getByRole('button', {name: 'Approve unlimited'});
    const usdcField = win.getByLabel('Type USDC to enable Approve');
    await expect(usdcField).toHaveValue('');
    await expect(usdcField).not.toBeFocused();
    await expect(approveUnlimited).toHaveClass(/app-cta-gated/);
    await pastHold(win, approveUnlimited);
    await oneLine(approveUnlimited);
    await metaInline(unlimited);
    await still(win, '48-unlimited', unlimited);
    const usdcConfirm = win.locator('.s9-typed-confirm');
    await into(usdcConfirm);
    await expect(usdcConfirm.locator('.label')).toHaveText('Type USDC to enable Approve');
    await expect(usdcConfirm.getByText('Case-sensitive · must match exactly.')).toBeVisible();
    await still(win, '48-unlimited-typed-empty', usdcConfirm);
    // The wrong case: no match border, still gated once the hold has passed.
    await usdcField.fill('usdc');
    await expect(usdcField).not.toHaveClass(/\bmatch\b/);
    await expect(approveUnlimited).toHaveClass(/app-cta-gated/);
    await pastHold(win, approveUnlimited);
    await still(win, '48-unlimited-typed-wrong-case', usdcConfirm);
    // Matched: the success border, the red CTA with its icon, enabled after the hold (the shot awaits it).
    await usdcField.fill('USDC');
    await expect(usdcField).toHaveClass(/\bmatch\b/);
    await expect(approveUnlimited).not.toHaveClass(/app-cta-gated/);
    await still(win, '48-unlimited-typed-matched', usdcConfirm, approveUnlimited);
    await oneLine(approveUnlimited);
    // #10 for the override (D11): the window asks for it; the popup's strip opens #10, which names it and both reasons.
    await approveUnlimited.click();
    await expect(win.getByText("Confirm it's you")).toBeVisible();
    const toolbar = await h.openPopup();
    const strip = toolbar.getByRole('button', {name: 'A transaction from jup.ag waits for your confirmation'});
    const [tab] = await Promise.all([h.ctx.waitForEvent('page', {predicate: pg => /unlock\.html/.test(pg.url())}), strip.click()]);
    await tab.setViewportSize({width: 412, height: 916});
    await expect(tab.locator('#ra-about')).toHaveText('You are about to approve');
    await expect(tab.locator('#ra-rows .intent-row', {hasText: 'Unlimited USDC spend approval'})).toHaveCount(1);
    await expect(tab.locator('#ra-reasons p')).toHaveText(['Re-auth required to approve a token allowance.', OVERRIDE_LINE]);
    // An approve moves no balance: no headline amount.
    await expect(tab.locator('#ra-amount-row')).toBeHidden();
    await shot(tab, '10-dapp-override', {fullPage: false});
    await tab.close();
    await toolbar.close();
    await dismiss(win);

    // F5 below u64::MAX (O9, rev 2.1): 740 of the 740.21 USDC — its own head (Q56), "Critical · Large spend approval"
    // (Q57), Q42's "all or nearly all", the amount as the delegated row, and "Approve anyway" (Q34) without the icon.
    await fresh(h.sw);
    win = await windowFor(h, () => customSignTx(jup, BLOCKHASH, MAIN.publicKey, [ix.approveChecked(OWN_USDC, USDC_MINT, DELEGATE, 740_000_000n, 6)]));
    await expect(win.locator('.top-bar .title')).toHaveText('Critical · Large spend approval', {timeout: 10_000});
    const large = win.locator('.s9-flag-banner.danger');
    await expect(large.locator('.head')).toHaveText('Spend approval for nearly all your USDC');
    await expect(large.locator('.body')).toHaveText(
      "This transaction includes a spl_token::ApproveChecked instruction for amount = 740000000, all or nearly all of this account's balance. Even verified dApps can be exploited; this lets the program move all or nearly all your USDC until you revoke.",
    );
    await expect(win.locator('.s9-bal-row', {hasText: 'USDC delegated'})).toContainText('740');
    await expect(win.getByText(/unlimited/i)).toHaveCount(0);
    const largeAnyway = win.getByRole('button', {name: 'Approve anyway', exact: true});
    await expect(largeAnyway.locator('svg')).toHaveCount(0);
    await pastHold(win, largeAnyway);
    await oneLine(largeAnyway);
    await still(win, '48-large-approval', large);
    await dismiss(win);

    // F3: an Assign of the wallet account — Q35's eyebrow, the banner with the instruction and the node's post-state.
    await fresh(h.sw);
    win = await windowFor(h, () => customSignTx(jup, BLOCKHASH, MAIN.publicKey, [ix.assign(DAPP_PROGRAM)]));
    await expect(win.locator('.top-bar .title')).toHaveText('Critical · Blocked transaction', {timeout: 10_000});
    const assign = win.locator('.s9-flag-banner.danger');
    await expect(assign.locator('.head')).toHaveText('Assign / Allocate on your wallet account');
    await expect(assign.locator('.meta')).toHaveText(['#1 system_program::Assign', `post-simulation · owner: ${DAPP_PROGRAM} · space: 0`]);
    const approveAnyway = win.getByRole('button', {name: 'Approve anyway', exact: true});
    await expect(approveAnyway).toHaveClass(/app-cta-gated/);
    await pastHold(win, approveAnyway);
    await still(win, '48-assign', assign);
    const assignConfirm = win.locator('.s9-typed-confirm');
    await into(assignConfirm);
    await expect(assignConfirm.locator('.label')).toHaveText('Type ASSIGN to enable Approve');
    await still(win, '48-assign-typed-empty', assignConfirm);
    // "Approve anyway" (Q34): the word matched, the red CTA without the icon, enabled after the hold.
    await win.getByLabel('Type ASSIGN to enable Approve').fill('ASSIGN');
    await expect(approveAnyway).not.toHaveClass(/app-cta-gated/);
    await expect(approveAnyway.locator('svg')).toHaveCount(0);
    await still(win, '48-approve-anyway', assignConfirm, approveAnyway);
    await dismiss(win);

    // F4: SetAuthority (AccountOwner) of the wallet's own USDC account.
    await fresh(h.sw);
    win = await windowFor(h, () => customSignTx(jup, BLOCKHASH, MAIN.publicKey, [ix.setOwner(OWN_USDC, NEW_OWNER)]));
    await expect(win.locator('.top-bar .title')).toHaveText('Critical · Blocked transaction', {timeout: 10_000});
    const authority = win.locator('.s9-flag-banner.danger');
    await expect(authority.locator('.head')).toHaveText('SetAuthority on an account you own');
    await expect(authority.locator('.body')).toHaveText('This gives an authority over an account you own to another address, or removes it. You cannot take it back yourself.');
    await expect(authority.locator('.meta')).toHaveText(`#1 spl_token::SetAuthority · authorityType: accountOwner · account: ${OWN_USDC} · newAuthority: ${NEW_OWNER}`);
    await expect(win.getByLabel('Type AUTHORITY to enable Approve')).toHaveValue('');
    await pastHold(win, win.getByRole('button', {name: 'Approve anyway', exact: true}));
    await metaInline(authority);
    await still(win, '48-set-authority', authority);
    await dismiss(win);

    // A batch of three, the second an unlimited approve: its banner and its field in its own section only.
    await fresh(h.sw);
    win = await windowFor(h, () => adapter.customSignAll(jup, BLOCKHASH, [[ix.transfer(RECIPIENT, 5n)], [ix.approveChecked(OWN_USDC, USDC_MINT, DELEGATE, U64_MAX, 6)], [ix.transfer(RECIPIENT, 6n)]]));
    await expect(win.locator('.top-bar .title')).toHaveText('Critical · Unlimited spend approval', {timeout: 10_000});
    const sections = win.locator('section.app-tx-item');
    await expect(sections).toHaveCount(3);
    await expect(sections.nth(0).locator('.s9-flag-banner, .s9-typed-confirm')).toHaveCount(0);
    await expect(sections.nth(2).locator('.s9-flag-banner, .s9-typed-confirm')).toHaveCount(0);
    await expect(sections.nth(1).locator('.s9-flag-banner.danger .head')).toHaveText('Unlimited USDC spend approval');
    await expect(sections.nth(1).locator('.s9-typed-confirm')).toHaveCount(1);
    await pastHold(win, win.getByRole('button', {name: 'Approve unlimited'}));
    await still(win, '48-batch-one-blocked', win.getByText('Transaction 1 of 3'));
    await into(sections.nth(1).locator('.app-tx-batch'), 'start');
    await still(win, '48-batch-one-blocked-section', sections.nth(1).locator('.s9-flag-banner.danger'));
    await dismiss(win);

    // F2: a lone closeAccount, its rent to another address (to the account itself it is O7's rent only) — a warning
    // only, no field; Approve after the 1.5 s hold.
    await fresh(h.sw);
    win = await windowFor(h, () => customSignTx(jup, BLOCKHASH, MAIN.publicKey, [ix.closeAccount(OWN_EMPTY, RECIPIENT)]));
    const nonTransfer = win.locator('.s9-flag-banner.warn');
    await expect(nonTransfer.locator('.head')).toHaveText('Instructions that are not transfers', {timeout: 10_000});
    await expect(nonTransfer.locator('.body')).toHaveText('Each can do more than move a balance. Check what it does before approving.');
    await expect(nonTransfer.locator('.meta')).toHaveText('#1 spl_token::CloseAccount');
    await expect(win.locator('.top-bar .title')).toHaveText('Approve transaction');
    await expect(win.locator('.s9-typed-confirm')).toHaveCount(0);
    await still(win, '48-warn-non-transfer', nonTransfer, win.getByRole('button', {name: 'Approve', exact: true}));
    await dismiss(win);

    // F7 (O3): two Token-2022 accounts' mints — one with a freeze authority, a permanent delegate and a transfer hook,
    // one the wallet cannot read (Q36); the two creates are the account's own, paid by it — no F2 (O7).
    await fresh(h.sw);
    win = await windowFor(h, () => customSignTx(jup, BLOCKHASH, MAIN.publicKey, [ix.ataCreate(OWN_T22, MAIN.publicKey, T22_MINT, TOKEN_2022_PROGRAM, true), ix.ataCreate(OWN_UNREAD, MAIN.publicKey, UNREAD_MINT, TOKEN_2022_PROGRAM, true)]));
    const t22 = win.locator('.s9-flag-banner.warn', {hasText: 'Token-2022 settings on a token you hold'});
    await expect(t22.locator('.body')).toHaveText(
      ['Freeze authority — the issuer can freeze your account of this token.', 'Permanent delegate — an address that can move or burn this token from any account, yours included.', 'Transfer hook — a program that runs on every transfer of this token.'],
      {timeout: 10_000},
    );
    await expect(t22.locator('.meta')).toHaveText([`mint: ${T22_MINT}`, `freezeAuthority: ${FREEZER}`, `permanentDelegate: ${PERMANENT_DELEGATE}`, `transferHookProgram: ${HOOK_PROGRAM}`]);
    const unreadable = win.locator('.s9-flag-banner.warn', {hasText: "Could not read this token's settings"});
    await expect(unreadable.locator('.meta')).toHaveText(`mint: ${UNREAD_MINT}`);
    await expect(win.locator('.s9-flag-banner.danger, .s9-typed-confirm')).toHaveCount(0);
    await expect(win.locator('.s9-flag-banner')).toHaveCount(2);
    await metaInline(t22);
    // "Program 1" on one line beside the associated-token program's long value (its value wraps instead).
    expect(await lines(win.locator('.app-tx-ix > .row > .k').first())).toBe(1);
    await still(win, '48-warn-token-2022', t22, win.getByRole('button', {name: 'Approve', exact: true}));
    await into(unreadable);
    await still(win, '48-warn-token-2022-unreadable', unreadable, win.getByRole('button', {name: 'Approve', exact: true}));
    await dismiss(win);

    // F8: a durable nonce — B1 §3's line alone.
    await fresh(h.sw);
    win = await windowFor(h, () => customSignTx(jup, BLOCKHASH, MAIN.publicKey, [ix.advanceNonce(NONCE), ix.transfer(RECIPIENT, 5n)]));
    const nonce = win.locator('.s9-flag-banner.warn');
    await expect(nonce.locator('.head')).toHaveText('This transaction does not expire.', {timeout: 10_000});
    await expect(nonce.locator('.meta')).toHaveText('#1 system_program::AdvanceNonceAccount');
    await still(win, '48-warn-nonce', nonce, win.getByRole('button', {name: 'Approve', exact: true}));
    await dismiss(win);

    // F9: 9.95 of the 10 SOL to an address never sent to — the warning and B1b's re-authentication line.
    await fresh(h.sw);
    win = await windowFor(h, () => customSignTx(jup, BLOCKHASH, MAIN.publicKey, [ix.transfer(STRANGER, 9_950_000_000n)]));
    const whole = win.locator('.s9-flag-banner.warn');
    await expect(whole.locator('.head')).toHaveText('Whole balance to a first-time address', {timeout: 10_000});
    await expect(whole.locator('.body')).toHaveText('All or nearly all of a balance goes to an address you have not sent to before.');
    await expect(win.getByText("Approving asks you to confirm with your password (or passkey) — you'll start it from the Noctura icon.")).toBeVisible();
    await still(win, '48-warn-whole-balance', whole, win.getByRole('button', {name: 'Approve', exact: true}));
    await dismiss(win);

    // F10 (O2): create the recipient's USDC account, then transfer into it — step 2 depends on step 1.
    await fresh(h.sw);
    win = await windowFor(h, () => adapter.customSignAll(jup, BLOCKHASH, [[ix.ataCreate(NEW_ATA, RECIPIENT, USDC_MINT, TOKEN_PROGRAM, false)], [ix.transferChecked(OWN_USDC, USDC_MINT, NEW_ATA, 500_000n, 6)]]));
    await expect(win.locator('.top-bar .title')).toHaveText('Critical · Blocked transaction', {timeout: 10_000});
    const step2 = win.locator('section.app-tx-item').nth(1);
    const dependent = step2.locator('.s9-flag-banner.danger');
    await expect(dependent.locator('.head')).toHaveText('This step depends on step 1 and could not be checked on its own.');
    await expect(dependent.locator('.body')).toHaveText('Its effects are unknown: it was simulated without the changes step 1 makes, which it needs. Approving it may move any of your balances.');
    await expect(dependent.locator('.meta')).toHaveText('{"InstructionError":[0,"UninitializedAccount"]}');
    await expect(step2.getByText('Balance changes (unknown)')).toBeVisible();
    await expect(step2.getByText('This step was not simulated on its own, so its effects are unknown.')).toBeVisible();
    await expect(win.getByText("Couldn't simulate")).toHaveCount(0);
    await expect(step2.getByLabel('Type UNCHECKED to enable Approve')).toHaveValue('');
    await pastHold(win, win.getByRole('button', {name: 'Approve anyway', exact: true}));
    await into(step2.locator('.app-tx-batch'), 'start');
    await still(win, '48-dependent', dependent);
    await into(step2.locator('.s9-typed-confirm'));
    await still(win, '48-dependent-typed-empty', step2.locator('.s9-typed-confirm'));
    await dismiss(win);

    // A lookalike (tensr.trade, granted through "Connect anyway") with a block: the word first, then the demoted
    // "Approve anyway (not recommended)" opens the 2-second confirm.
    const tensr = await granted(h, 'https://tensr.trade');
    await fresh(h.sw);
    win = await windowFor(h, () => customSignTx(tensr, BLOCKHASH, MAIN.publicKey, [ix.assign(DAPP_PROGRAM)]));
    await expect(win.locator('.top-bar .title')).toHaveText('Critical · Blocked transaction', {timeout: 10_000});
    await expect(win.getByText('It looks like tensor.trade but is a different site.')).toBeVisible();
    await expect(win.locator('.s9-flag-banner.danger .head')).toHaveText('Assign / Allocate on your wallet account');
    const anywayLookalike = win.getByRole('button', {name: 'Approve anyway (not recommended)'});
    await pastHold(win, anywayLookalike);
    await still(win, '48-lookalike-block', win.getByText('It looks like tensor.trade but is a different site.'));
    const lookalikeConfirm = win.locator('.s9-typed-confirm');
    await win.getByLabel('Type ASSIGN to enable Approve').fill('ASSIGN');
    await into(lookalikeConfirm);
    await still(win, '48-lookalike-block-typed', lookalikeConfirm, anywayLookalike);
    await anywayLookalike.click();
    await still(win, '48-lookalike-block-confirm', win.getByRole('dialog', {name: 'We strongly recommend rejecting. Continue?'}), win.getByRole('button', {name: 'I understand the risk'}));
    await win.getByRole('button', {name: 'Cancel'}).click();
    await dismiss(win);
    contained(h);
    expect(server.unexpected).toEqual([]);
  } finally {
    await h.close();
  }
});

// ——— B1c-3: the carried B1c-2 visual items — #11's pending-send strip (B1b's) on the dApp strip's gutter with its
// chevron, and Tensor's tile, one colour on #47, #48 and #49 (R9: #49's, the design's latest). #46's Q26 banner is shot
// in visual-dapp.spec.ts (46-sign-null), #10's unsigned headline above (10-dapp).
test('visual · carried (B1c-3): #11’s pending-send strip inside the popup; Tensor’s tile on #47, #48 and #49', async () => {
  test.setTimeout(240_000);
  const {h, server} = await scene();
  try {
    // An open send of 0.01 SOL from MAIN (B1b's record, as visual-settings.spec.ts writes it).
    await set(h.sw, {
      v1_pending: [{id: 'ef'.repeat(16), account: MAIN.publicKey, signature: '5'.repeat(88), wire: 'AQ==', lastValidBlockHeight: 1150, createdAt: Date.now(), lastSentAt: Date.now(), state: 'pending', detail: null, detailCode: null, intent: {token: 'SOL', recipient: RECIPIENT, amount: '10000000'}, expiryNullSeenAt: null, failure: null, fee: null}],
    });
    const p = await h.openPopup();
    await expect(p.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
    const pending = p.getByRole('button', {name: 'Sending 0.01 SOL · pending'});
    await expect(pending.locator('.app-strip-chev')).toBeInViewport({ratio: 1});
    await expect(pending).toBeInViewport({ratio: 1});
    // On the dApp strip's gutter (the hero's own --space-5): the strip's sides inside the popup's 412 px by 20 px each.
    const box = await pending.boundingBox();
    expect(box === null ? null : [Math.round(box.x), Math.round(412 - box.x - box.width)]).toEqual([20, 20]);
    await pop(p, '11-pending-strip', pending);
    await p.close();
    await h.sw.evaluate(() => chrome.storage.local.remove('v1_pending'));

    const tile = (page: Page, sel: string) => page.locator(sel).first().evaluate(e => getComputedStyle(e).backgroundImage);
    // #47a for the verified tensor.trade (no grant yet): the origin card's tile.
    const tensor = await openDapp(h.ctx, 'https://tensor.trade');
    await fresh(h.sw);
    let connected!: Promise<unknown>;
    let win = await windowFor(h, () => (connected = connect(tensor)));
    await expect(win.locator('.s9-origin-card .name')).toHaveText('Tensor');
    const on47 = await tile(win, '.s9-origin-card .ico');
    await gateClear(win);
    await still(win, '47a-tensor', win.getByText('0 of 1 acknowledgments'), win.getByRole('button', {name: 'Reject'}));
    await win.getByRole('checkbox').click();
    await win.getByRole('button', {name: 'Connect', exact: true}).click();
    expect(await connected).toEqual({ok: true, value: [MAIN.publicKey]});
    // #48 for its transaction.
    await fresh(h.sw);
    win = await windowFor(h, () => signTx(tensor, 1, BLOCKHASH));
    await expect(win.getByText('Balance changes (post-simulation)')).toBeVisible({timeout: 10_000});
    await expect(win.locator('.s9-origin-card .name')).toHaveText('Tensor');
    const on48 = await tile(win, '.s9-origin-card .ico');
    await still(win, '48-tensor', win.locator('.s9-origin-card'), win.getByRole('button', {name: 'Approve', exact: true}));
    await dismiss(win);
    // #49's row for the same grant.
    const s = await h.openPopup();
    await expect(s.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
    await s.getByRole('button', {name: 'Settings'}).click();
    await s.locator('.s7-row', {hasText: 'Connected dApps'}).click();
    const row = s.locator('.s10-app-row', {hasText: 'tensor.trade'});
    await expect(row).toBeVisible({timeout: 10_000});
    const on49 = await row.locator('.ico').evaluate(e => getComputedStyle(e).backgroundImage);
    await pop(s, '49-tensor', row);
    expect(on49).toMatch(/^linear-gradient/);
    expect([on47, on48]).toEqual([on49, on49]);
    contained(h);
    expect(server.unexpected).toEqual([]);
  } finally {
    await h.close();
  }
});

test('visual · #26 and #27: a site’s transaction badged "Dapp · simulated"', async () => {
  test.setTimeout(240_000);
  const {h, server} = await scene();
  try {
    const p = await h.openPopup();
    await expect(p.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
    const jup = await granted(h, 'https://jup.ag');
    await fresh(h.sw);
    let sent!: Promise<unknown>;
    const win = await windowFor(h, () => (sent = sendTx(jup, BLOCKHASH, 2_000_000)));
    await expect(win.getByText('Balance changes (post-simulation)')).toBeVisible({timeout: 10_000});
    await win.getByRole('button', {name: 'Approve', exact: true}).click();
    const r = (await sent) as {ok: true; value: string};
    const signature = h.fake.broadcasts[0] ?? '';
    expect(r.ok).toBe(true);
    const now = Math.floor(Date.now() / 1000);
    h.fake.history.set(MAIN.publicKey, [
      {signature, tx: {blockTime: now, meta: {err: null, fee: 5000, preBalances: [10_000_000_000, 0, 1], postBalances: [9_997_995_000, 2_000_000, 1], preTokenBalances: [], postTokenBalances: []}, transaction: {message: {accountKeys: [{pubkey: MAIN.publicKey, signer: true, writable: true}, {pubkey: RECIPIENT, signer: false, writable: true}, {pubkey: '11111111111111111111111111111111', signer: false, writable: false}], instructions: [{programId: '11111111111111111111111111111111', parsed: {type: 'transfer', info: {source: MAIN.publicKey, destination: RECIPIENT, lamports: 2_000_000}}, program: 'system'}]}}}},
    ]);
    await p.getByRole('button', {name: 'Activity'}).click();
    const row = p.locator('.tx-row', {has: p.locator('.origin-badge')});
    await expect(row.locator('.origin-badge')).toHaveText('Dapp · simulated');
    await pop(p, '26-dapp-badge', row);
    await row.click();
    await expect(p.locator('.top-bar .title .origin-badge')).toHaveText('Dapp · simulated');
    await shot(p, '27-dapp-badge', {fullPage: false});
    contained(h);
    expect(server.unexpected).toEqual([]);
  } finally {
    await h.close();
  }
});
