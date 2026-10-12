import {test, expect, type Page} from '@playwright/test';
import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {contained, launchPopup, type Harness} from './popupHarness';
import {E2E_ACCOUNTS, E2E_PASSWORD, makeEnvelope} from './makeEnvelope';
import {unlockWith} from './vaultPage';
import {DAPP_HOSTS, approvalWindow, changes, connect, features, names, noWindow, openDapp, relayed, serveDapp, sign, windowClosed, type DappServer} from './dappPage';

// Spec B1c §6.3: E2E B1c-19 … B1c-24 against the real extension — the MAIN-world provider, the relay, the background
// and the approval window — with a real test dApp (e2e/fixtures/dapp/page.ts: @wallet-standard/app's getWallets()) served
// through ctx.route at https://dapp.test, https://jup.ag (a verified host), https://tensr.trade (a lookalike) and an xn--
// host. Titles carry "B1c-NN · " (B1b's spec 19 already owns "19 · "): run one with -g 'B1c-19 · '. Every spec ends
// contained: the coordinator route saw the popup's reads, nothing unexpected, Solscan and noc-tura.io untouched, the dApp
// route served only its own paths. Chromium only: Firefox's port.sender.origin for a content-script port — which the
// whole PAGE partition keys on — is a line of B1e's manual Firefox run (review 1 L9), not exercised here.
declare const chrome: {
  runtime: {sendMessage(m: unknown): Promise<unknown>; getContexts(filter: object): Promise<{contextId: string}[]>};
  storage: {local: {set(o: object): Promise<void>}};
};

const ACCOUNT = E2E_ACCOUNTS[0];
const DAPP = 'https://dapp.test';
const JUP = 'https://jup.ag';
const siws = (domain: string) => [`${domain} wants you to sign in with your Solana account:`, ACCOUNT, '', 'Sign in to the test dApp.', '', `URI: https://${domain}`, 'Version: 1', 'Chain ID: solana:mainnet', 'Nonce: 4f3a92ceb1d8', 'Issued At: 2026-10-10T09:40:23Z'].join('\n');

/** The browser, the real wallet (makeEnvelope, unlocked through the vault page), and the dApp's route. */
async function scene(prefix: string): Promise<{h: Harness; server: DappServer}> {
  const h = await launchPopup(prefix, {hosts: DAPP_HOSTS});
  const server = await serveDapp(h.ctx);
  await h.sw.evaluate(env => chrome.storage.local.set({v1_vault: env}), await makeEnvelope());
  const vault = await h.ctx.newPage();
  await unlockWith(vault, h.id, E2E_PASSWORD);
  await vault.close();
  return {h, server};
}
function done(h: Harness, server: DappServer): void {
  contained(h);
  expect(server.unexpected).toEqual([]);
}
/** The popup on #11 (its reads are what contained() counts), then a message from it. */
async function popup(h: Harness): Promise<Page> {
  const p = await h.openPopup();
  await expect(p.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
  return p;
}
const lockWallet = async (p: Page) => p.evaluate(() => chrome.runtime.sendMessage({type: 'vault.lock'}));
/** #47b's two gates, then "Connect for this session" (held 500 ms by C15: Playwright waits for it to be enabled). */
async function connectUnknown(win: Page): Promise<void> {
  await win.getByRole('checkbox', {name: 'I understand this domain is not on the verified list'}).click();
  await win.getByRole('checkbox', {name: /I've read these permissions/}).click();
  await win.getByRole('button', {name: 'Connect for this session'}).click();
}

test('B1c-19 · connect: Noctura found → #47b → both gates → the account; persistent survives a reload, session not a lock; lock → change []; locked → the locked window (no password) → unlock from the toolbar → #47', async () => {
  test.setTimeout(240_000);
  const {h, server} = await scene('noctura-e2e-dapp-connect-');
  try {
    const p = await popup(h);
    const page = await openDapp(h.ctx, DAPP);
    expect(await names(page)).toContain('Noctura');
    // D10: plan 1 advertises exactly what it implements.
    expect(await features(page)).toEqual(['solana:signMessage', 'standard:connect', 'standard:disconnect', 'standard:events']);
    // A silent connect never opens a window.
    expect(await connect(page, true)).toEqual({ok: true, value: []});
    let pending!: Promise<unknown>;
    const win = await approvalWindow(h.ctx, () => (pending = connect(page)));
    await expect(win.getByText('Connect to this app?')).toBeVisible();
    await expect(win.locator('.s9-origin-card .dom')).toHaveText('dapp.test');
    // C15: nothing focused when the window opens; Enter on a focused Connect never confirms.
    expect(await win.evaluate(() => document.activeElement === document.body)).toBe(true);
    await connectUnknown(win);
    expect(await pending).toEqual({ok: true, value: [ACCOUNT]});
    await windowClosed(win);

    // A verified origin, "Until I revoke".
    const jup = await openDapp(h.ctx, JUP);
    let pj!: Promise<unknown>;
    let pjSettled = false;
    const win2 = await approvalWindow(h.ctx, () => (pj = connect(jup)));
    pj.then(
      () => (pjSettled = true),
      () => (pjSettled = true),
    );
    await expect(win2.getByText('Connect to Jupiter?')).toBeVisible();
    await win2.getByRole('checkbox').click();
    await win2.getByRole('radio', {name: /Until I revoke/}).click();
    const connectBtn = win2.getByRole('button', {name: 'Connect', exact: true});
    await expect(connectBtn).toBeEnabled();
    await connectBtn.focus();
    await win2.keyboard.press('Enter');
    await win2.waitForTimeout(700);
    // M2: Enter leaving the window open isn't enough — the request itself must still be unanswered.
    expect(pjSettled).toBe(false);
    expect(await win2.isClosed()).toBe(false);
    await connectBtn.click();
    expect(await pj).toEqual({ok: true, value: [ACCOUNT]});

    // Reload: both silent connects answer.
    await page.reload();
    await jup.reload();
    expect(await connect(page, true)).toEqual({ok: true, value: [ACCOUNT]});
    expect(await connect(jup, true)).toEqual({ok: true, value: [ACCOUNT]});

    // Lock: change [] to both granted pages; afterwards the session grant is gone, the persistent one only hidden (D5).
    await lockWallet(p);
    await expect.poll(() => changes(page)).toContainEqual([]);
    await expect.poll(() => changes(jup)).toContainEqual([]);
    expect(await connect(jup, true)).toEqual({ok: true, value: []});

    // Locked + an explicit connect: the window's locked screen, no password field; unlock from the toolbar → #47.
    let pl!: Promise<unknown>;
    const locked = await approvalWindow(h.ctx, () => (pl = connect(page)));
    await expect(locked.getByText('Noctura is locked')).toBeVisible();
    await expect(locked.getByText("Click the Noctura icon in your browser's toolbar and unlock. This request will wait here.")).toBeVisible();
    await expect(locked.locator('input, select, textarea')).toHaveCount(0);
    const toolbar = await h.openPopup();
    const [tab] = await Promise.all([h.ctx.waitForEvent('page'), toolbar.getByRole('button', {name: 'Unlock'}).click()]);
    await tab.locator('#unl-password').fill(E2E_PASSWORD);
    await tab.locator('#unl-submit').click();
    // §2.3: the window polls every second (E2E allows two after the unlock lands).
    await expect(tab.locator('#unl-notice-line')).toHaveText('Unlocked.', {timeout: 60_000});
    await expect(locked.getByText('Connect to this app?')).toBeVisible({timeout: 2_000});
    // I2: the persistent grant re-announces exactly once more — the exact sequence, not merely "contains the
    // account" (which was already true before the unlock and so proved nothing).
    await expect.poll(() => changes(jup)).toEqual([[ACCOUNT], [], [ACCOUNT]]);
    // I3: the session grant does NOT survive the lock — no re-announce for it, and an explicit connect still finds
    // it gone. Both checked before connectUnknown(locked), which would grant `page` a brand-new session grant.
    expect(await changes(page)).toEqual([[ACCOUNT], []]);
    expect(await connect(page, true)).toEqual({ok: true, value: []});
    await connectUnknown(locked);
    expect(await pl).toEqual({ok: true, value: [ACCOUNT]});
    done(h, server);
  } finally {
    await h.close();
  }
});

test('B1c-20 · signMessage: a SIWS message signed and verified with ed25519; a transaction’s bytes as a message refused with no window', async () => {
  test.setTimeout(180_000);
  const {h, server} = await scene('noctura-e2e-dapp-sign-');
  try {
    await popup(h);
    const page = await openDapp(h.ctx, DAPP);
    const win = await approvalWindow(h.ctx, () => connect(page));
    await connectUnknown(win);
    await expect.poll(() => page.evaluate(() => (window as unknown as {dapp: {accounts(): string[]}}).dapp.accounts())).toEqual([ACCOUNT]);
    const message = siws('dapp.test');
    let pending!: Promise<unknown>;
    const w46 = await approvalWindow(h.ctx, () => (pending = sign(page, message)));
    await expect(w46.getByText('Sign this message?')).toBeVisible();
    await expect(w46.locator('.s9-msg-preview')).toHaveText(message);
    await w46.getByRole('button', {name: 'Sign', exact: true}).click();
    const r = (await pending) as {ok: true; value: {signature: string; signedMessage: string}};
    expect(r.ok).toBe(true);
    expect(base64.decode(r.value.signedMessage)).toEqual(new TextEncoder().encode(message));
    expect(ed25519.verify(base64.decode(r.value.signature), new TextEncoder().encode(message), base58.decode(ACCOUNT))).toBe(true);

    // A printable legacy Message (3 205 bytes that deserialize): refused before any window (§3.2 rule 2).
    const parts = [new TextEncoder().encode('!!!'), Uint8Array.of(0x20), new Uint8Array(1024).fill(0x4b), new Uint8Array(32).fill(0x42), Uint8Array.of(0x20)];
    for (let i = 0; i < 32; i++) parts.push(Uint8Array.of(0x21, 0x20), new Uint8Array(32).fill(0x22), Uint8Array.of(0x20), new Uint8Array(32).fill(0x61));
    const tx = new Uint8Array(parts.reduce((n, x) => n + x.length, 0));
    let at = 0;
    for (const x of parts) {
      tx.set(x, at);
      at += x.length;
    }
    await windowClosed(w46);
    expect(await noWindow(h.ctx, () => sign(page, base64.encode(tx), {base64: true}))).toEqual({ok: false, code: 'invalid-request', message: 'The request is not valid.'});
    done(h, server);
  } finally {
    await h.close();
  }
});

test('B1c-21 · lookalike: tensr.trade → "Reject and report" → the next connect is rejected with no window → #49 Unblock → #47 again', async () => {
  test.setTimeout(180_000);
  const {h, server} = await scene('noctura-e2e-dapp-lookalike-');
  try {
    const p = await popup(h);
    const page = await openDapp(h.ctx, 'https://tensr.trade');
    let pending!: Promise<unknown>;
    const win = await approvalWindow(h.ctx, () => (pending = connect(page)));
    await expect(win.locator('.top-bar .title')).toHaveText('Suspicious origin');
    await expect(win.locator('.s9-domain-warn .body')).toHaveText('This domain is not tensor.tradeIt looks like tensor.trade but is a different site.');
    await expect(win.locator('.s9-origin-card .name')).toHaveText('tensr');
    await win.getByRole('button', {name: 'Reject and report'}).click();
    expect(await pending).toEqual({ok: false, code: 4001, message: 'The user rejected the request.'});
    // Blocked: answered at once, no window.
    await windowClosed(win);
    expect(await noWindow(h.ctx, () => connect(page))).toEqual({ok: false, code: 4001, message: 'The user rejected the request.'});
    // #31 → #49 → Blocked sites → Unblock.
    await p.getByRole('button', {name: 'Settings'}).click();
    await p.locator('.s7-title', {hasText: 'Connected dApps'}).click();
    await expect(p.getByText('Blocked sites')).toBeVisible();
    const row = p.locator('.s10-app-row', {hasText: 'tensr.trade'});
    await expect(row.locator('.meta')).toContainText('Looked like tensor.trade');
    await row.getByRole('button', {name: 'Unblock'}).click();
    await expect(p.getByText('Blocked sites')).toHaveCount(0);
    let last!: Promise<unknown>;
    const again = await approvalWindow(h.ctx, () => (last = connect(page)));
    await expect(again.locator('.top-bar .title')).toHaveText('Suspicious origin');
    await again.getByRole('button', {name: 'Close'}).click();
    expect(await last).toEqual({ok: false, code: 4001, message: 'The user rejected the request.'});
    done(h, server);
  } finally {
    await h.close();
  }
});

test('B1c-22 · revoke: Revoke → UNDO → still connected; Revoke → five seconds → the page has change [] and stays disconnected', async () => {
  test.setTimeout(180_000);
  const {h, server} = await scene('noctura-e2e-dapp-revoke-');
  try {
    const p = await popup(h);
    const page = await openDapp(h.ctx, DAPP);
    const win = await approvalWindow(h.ctx, () => connect(page));
    await connectUnknown(win);
    await expect.poll(() => connect(page, true)).toEqual({ok: true, value: [ACCOUNT]});
    await p.getByRole('button', {name: 'Settings'}).click();
    await expect(p.locator('.s7-row', {hasText: 'Connected dApps'}).locator('.s7-meta')).toHaveText('1 connected');
    await p.locator('.s7-title', {hasText: 'Connected dApps'}).click();
    const row = p.locator('.s10-app-row', {hasText: 'dapp.test'});
    await row.getByRole('button', {name: 'Revoke'}).click();
    await expect(p.getByText('dapp revoked')).toBeVisible();
    await expect.poll(() => changes(page)).toEqual([[ACCOUNT], []]);
    await p.getByRole('button', {name: 'UNDO'}).click();
    await expect(row).toBeVisible();
    await expect.poll(() => changes(page)).toEqual([[ACCOUNT], [], [ACCOUNT]]);
    expect(await connect(page, true)).toEqual({ok: true, value: [ACCOUNT]});
    await row.getByRole('button', {name: 'Revoke'}).click();
    await expect.poll(() => changes(page)).toEqual([[ACCOUNT], [], [ACCOUNT], []]);
    await expect(p.getByText('dapp revoked')).toBeHidden({timeout: 7_000});
    expect(await connect(page, true)).toEqual({ok: true, value: []});
    await expect(p.getByText('No connected apps')).toBeVisible();
    done(h, server);
  } finally {
    await h.close();
  }
});

test('B1c-23 · iframe: the page in an iframe sees no Noctura (no injection, all_frames false); the top frame does', async () => {
  test.setTimeout(120_000);
  const {h, server} = await scene('noctura-e2e-dapp-iframe-');
  try {
    await popup(h);
    const page = await openDapp(h.ctx, DAPP, '/framed.html');
    const inner = page.frames().find(f => f.url().endsWith('/inner.html'));
    expect(inner).toBeDefined();
    await inner!.waitForFunction(() => typeof (window as unknown as {dapp?: unknown}).dapp === 'object');
    expect(await names(page)).toEqual(['Noctura']);
    expect(await inner!.evaluate(() => (window as unknown as {dapp: {names(): string[]}}).dapp.names())).toEqual([]);
    done(h, server);
  } finally {
    await h.close();
  }
});

test('B1c-24 · restart: #46 shown → the service worker is stopped (CDP) → Sign → the page gets exactly one signature', async () => {
  test.setTimeout(180_000);
  const {h, server} = await scene('noctura-e2e-dapp-restart-');
  try {
    const p = await popup(h);
    const page = await openDapp(h.ctx, DAPP);
    const win = await approvalWindow(h.ctx, () => connect(page));
    await connectUnknown(win);
    await expect.poll(() => connect(page, true)).toEqual({ok: true, value: [ACCOUNT]});
    let pending!: Promise<unknown>;
    const w46 = await approvalWindow(h.ctx, () => (pending = sign(page, 'Sign in to the test dApp.')));
    await expect(w46.getByText('Sign this message?')).toBeVisible();
    // The worker's identity, as the extension itself reports it (runtime.getContexts, Chrome 116+).
    const workers = () => p.evaluate(() => chrome.runtime.getContexts({contextTypes: ['BACKGROUND']}).then(c => c.map(x => x.contextId)));
    const [before] = await workers();
    expect(before).toBeDefined();
    const beforeId = before as string;
    // review 2 L11: stop the worker by closing its CDP target (ServiceWorker.stopAllWorkers from a page session left it
    // running in the dry run), from a plain tab's session.
    const tab = await h.ctx.newPage();
    const cdp = await h.ctx.newCDPSession(tab);
    const target = (await cdp.send('Target.getTargets')).targetInfos.find(t => t.type === 'service_worker');
    expect(await cdp.send('Target.closeTarget', {targetId: target!.targetId})).toEqual({success: true});
    // Positive control: the OLD worker is gone (not "no worker at all" — the approval window's own 1 s poll can
    // restart one within ~1 s, racing a `toEqual([])` check and making it flaky by construction — review fix I1).
    await expect.poll(async () => (await workers()).includes(beforeId)).toBe(false);
    await w46.getByRole('button', {name: 'Sign', exact: true}).click();
    const r = (await pending) as {ok: boolean; value: {signature: string}};
    expect(r.ok).toBe(true);
    expect(ed25519.verify(base64.decode(r.value.signature), new TextEncoder().encode('Sign in to the test dApp.'), base58.decode(ACCOUNT))).toBe(true);
    // Another worker answered it, and the page heard exactly one signature.
    const after = await workers();
    expect(after).toHaveLength(1);
    expect(after).not.toContain(before);
    await page.waitForTimeout(2_000);
    const answers = ((await relayed(page)) as {result?: {signature?: string}}[]).filter(m => typeof m.result?.signature === 'string');
    expect(answers).toHaveLength(1);
    done(h, server);
  } finally {
    await h.close();
  }
});
