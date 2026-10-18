import {test, expect, type Locator, type Page, type Worker} from '@playwright/test';
import {base58} from '@scure/base';
import {contained, launchPopup, seedUnlockedWallet, MAIN, SAVINGS, type Harness} from './popupHarness';
import {DAPP_HOSTS, approvalWindow, connect, customSignTx, noWindow, openDapp, rawSignTx, sendTx, serveDapp, signTx, type DappServer} from './dappPage';
import {shot} from './visualTab';

// Spec B1c §6.4 (B1c-2): every #48 state B1c-2 builds, the origin-mismatch notice, the popup's re-authentication strip
// (D11), #10 for a site's transaction, and #26/#27's "Dapp · simulated" badge — saved for the opus-tier review against
// index.html (#48 ix:18261-18705, #26b ix:11813, #27b ix:12163). The approval window at 412 × 720, the popup at
// 412 × 600, the vault page at 412 × 916. Every state asserts its own copy before its shot; transient states are held
// by the test (the coordinator's answers held, a dapp.decide held), never slept through. B1c-3's states (red flags,
// the typed-confirm override, unlimited spend) are not B1c-2's and are not shot.
declare const chrome: {storage: {local: {set(o: object): Promise<void>}; session: {set(o: object): Promise<void>; get(k: string): Promise<Record<string, unknown>>}}};

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
