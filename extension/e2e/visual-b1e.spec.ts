import {test, expect, type BrowserContext, type Locator, type Page, type Worker} from '@playwright/test';
import {base58} from '@scure/base';
import {mkdirSync} from 'node:fs';
import {contained, launchPopup, seedUnlockedWallet, type Harness} from './popupHarness';
import {EXT_NOPRESALE} from './launch';
import {E2E_ACCOUNTS, E2E_MNEMONIC, E2E_PASSWORD, makeEnvelope} from './makeEnvelope';
import {pastePhrase, setPassword, unlockWith} from './vaultPage';
import {DAPP_HOSTS, adapter, approvalWindow, connect, openDapp, serveDapp, sign, windowClosed} from './dappPage';
import {SOL_TREASURY, solPurchaseIx} from './presaleChain';
import {installPresale, watchCsp} from './presaleHelpers';
import {DIR} from './visualTab';

declare const chrome: {
  runtime: {sendMessage(m: unknown): Promise<unknown>};
  storage: {local: {set(o: object): Promise<void>; remove(k: string): Promise<void>}; session: {remove(k: string): Promise<void>}};
};

// B1e §9 (B1e-1 Task 7): the visual pass of every element index.html does not draw, rendered by the real extension — the
// store build (`--no-presale`, E2) — at its real frame: the popup at 412 × 600, the vault page at 412 × 916, the approval
// window at 412 × 720 (its windows.create size). The anti-phishing line on every screen that shows it and R9's line, the
// onboarding step, #35's row and card; the two damaged states, the removal and "Save the damaged data"; #37's and the
// removal's checkbox directly above the button; #1's terms line and #38's link rows. Every shot asserts its own copy
// first, then that it is wholly in the frame and clear of the pinned bars, and that the screen draws exactly the expected
// number of sticky bars, each with every control in it wholly in the frame. Saved for the review against the design
// system and the binding design — compared on rendered images, never by copying the design's text. Not a pixel diff.
const ACCOUNT = E2E_ACCOUNTS[0];
const BLUE = 'Blue horse 42';
const LONG = 'Moonlit harbour, seven lanterns!';
const GREEN = 'Green fox 7';
const R9 = "Anti-phishing phrase could not be read — don't type your password until it shows";
const UNDERSTOOD = 'I understand this permanently removes this wallet from this browser';
const BLOCKHASH = base58.encode(new Uint8Array(32).fill(7));
const RETURNING = {totalBase: 1_998_667_554_963n, spentCents: 30_000n, count: 2};

const set = (sw: Worker, o: object) => sw.evaluate(x => chrome.storage.local.set(x), o);
const lock = (sw: Worker) => sw.evaluate(() => chrome.storage.session.remove('v1_session'));
const fresh = (sw: Worker) => set(sw, {v1_dapp_limits: {rejections: [], cooldowns: [], windows: [], notice: false}});
const msg = async (page: Page, m: unknown) => (await page.evaluate(x => chrome.runtime.sendMessage(x), m)) as {ok: boolean; error?: string; data?: unknown};
/** An init script: the named answer's `phrase` field removed inside the page — the read R9 is for. */
function stripScript(t: {type: string; path: string}): void {
  if (location.pathname !== t.path) return;
  const rt = (globalThis as unknown as {chrome: {runtime: {sendMessage(m: unknown): Promise<unknown>}}}).chrome.runtime;
  const send = rt.sendMessage.bind(rt);
  rt.sendMessage = async (m: unknown) => {
    const r = (await send(m)) as {ok?: boolean; data?: Record<string, unknown>};
    if ((m as {type?: string}).type !== t.type || r?.ok !== true || r.data === undefined) return r;
    const data = {...r.data};
    delete data.phrase;
    return {...r, data};
  };
}
const stripContext = (ctx: BrowserContext, type: string, path: string) => ctx.addInitScript(stripScript, {type, path});

/** Exactly `count` visible sticky bars (a bar that lost its class fails here, not silently); each, and every control and label in it, wholly in the frame. */
async function wholeBar(p: Page, name: string, count: number): Promise<void> {
  const bar = p.locator('.sticky-bar').filter({visible: true});
  await expect(bar, `${name}: ${count} sticky bar(s)`).toHaveCount(count);
  for (const b of await bar.all()) {
    await expect(b, `${name}: the sticky bar wholly in the frame`).toBeInViewport({ratio: 1});
    for (const c of await b.locator('button, a, input, label').filter({visible: true}).all()) await expect(c, `${name}: a bar control wholly in the frame`).toBeInViewport({ratio: 1});
  }
}
/**
 * A shot from the screen as it stands: `copy` visible, wholly in the frame and clear of every pinned bar it is not part of
 * (scrolled to the middle of the frame only when it is not, as a person would scroll to it), `bars` sticky bars wholly in
 * the frame, `ready` awaited enabled, the pointer off the column.
 */
async function frame(p: Page, name: string, copy: Locator, o: {bars: 0 | 1; ready?: Locator}): Promise<void> {
  await expect(copy).toBeVisible({timeout: 30_000});
  const pinned = p.locator('.sticky-bar, .top-bar').filter({visible: true});
  const vh = p.viewportSize()?.height ?? 0;
  const under = async (): Promise<string | null> => {
    const box = await copy.boundingBox();
    if (box === null) return 'no box';
    if (box.y < 0 || box.y + box.height > vh) return 'outside the frame';
    const el = await copy.elementHandle();
    for (const bar of await pinned.all()) {
      const b = await bar.boundingBox();
      if (b === null || (await bar.evaluate((e, x) => e.contains(x), el))) continue;
      if (box.y < b.y + b.height && b.y < box.y + box.height) return await bar.evaluate(e => e.className);
    }
    return null;
  };
  if ((await under()) !== null) await copy.evaluate(e => e.scrollIntoView({block: 'center'}));
  await expect(copy, `${name}: the copy wholly in the frame`).toBeInViewport({ratio: 1});
  expect(await under(), `${name}: the copy clear of the pinned bars`).toBeNull();
  await wholeBar(p, name, o.bars);
  if (o.ready !== undefined) await expect(o.ready).toBeEnabled();
  await p.mouse.move(0, 0);
  mkdirSync(DIR, {recursive: true});
  await p.screenshot({path: `${DIR}/${name}.png`});
}
/** The anti-phishing line as drawn: the shield banner, its icon, the phrase as text after a screen-reader label. */
async function phraseLine(line: Locator, phrase: string): Promise<void> {
  await expect(line).toHaveText(`Anti-phishing phrase: ${phrase}`);
  await expect(line).toHaveClass(/\bbanner\b/);
  await expect(line).toHaveClass(/\bshield\b/);
  await expect(line.locator('svg')).toHaveCount(1);
  await expect(line.locator('.copy')).toHaveText(phrase);
}
/** R9's line as drawn: the warning banner with its icon. */
async function failedLine(line: Locator): Promise<void> {
  await expect(line).toHaveText(R9);
  await expect(line).toHaveClass(/\bwarning\b/);
  await expect(line.locator('svg')).toHaveCount(1);
}
/** The checkbox directly above the button it unlocks, inside the same bar, both wholly in the frame. */
async function boxAbove(box: Locator, button: Locator): Promise<void> {
  const b = await box.boundingBox();
  const c = await button.boundingBox();
  expect(b, 'the checkbox row').not.toBeNull();
  expect(c, 'the button').not.toBeNull();
  expect((b?.y ?? Infinity) + (b?.height ?? 0), 'the checkbox row ends above the button').toBeLessThanOrEqual(c?.y ?? -Infinity);
  expect(await box.evaluate((e, x) => e.parentElement === x?.parentElement && e.nextElementSibling === x, await button.elementHandle()), 'the box is the button\'s previous sibling in the bar').toBe(true);
}
/** A vault-page tab at its frame (412 × 916). */
async function tab(h: Harness, path: string): Promise<Page> {
  const p = await h.ctx.newPage();
  await p.setViewportSize({width: 412, height: 916});
  await p.goto(`chrome-extension://${h.id}/${path}`);
  return p;
}
/** The approval window at its windows.create size. */
async function windowFor(h: Harness, ask: () => unknown): Promise<Page> {
  await fresh(h.sw);
  const win = await approvalWindow(h.ctx, ask);
  await win.setViewportSize({width: 412, height: 720});
  return win;
}
/** Rejects the window's request and waits for it to close. */
async function reject(win: Page, request: Promise<unknown>): Promise<void> {
  await win.getByRole('button', {name: 'Reject'}).click();
  expect(((await request) as {ok: boolean}).ok).toBe(false);
  await windowClosed(win);
}

test('visual · B1e popup (412 × 600): the locked screen with the phrase, a 32-unit phrase, R9; #35 row Off / On and its card; #37 the checkbox above the CTA; #38 the link rows', async () => {
  test.setTimeout(300_000);
  const h = await launchPopup('noctura-e2e-visual-b1e-popup-', {ext: EXT_NOPRESALE});
  try {
    await seedUnlockedWallet(h.sw);
    let p = await h.openPopup();
    await expect(p.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
    await p.close();

    // The popup's locked screen: the line under the header, before the lede; a long phrase wraps; R9.
    await lock(h.sw);
    await set(h.sw, {v1_phishing_phrase: BLUE});
    p = await h.openPopup();
    const line = p.locator('.app-phrase-line');
    await expect(p.getByText('Welcome back')).toBeVisible({timeout: 30_000});
    await phraseLine(line, BLUE);
    expect(await line.evaluate(e => e.previousElementSibling?.textContent === 'Welcome back' && e.nextElementSibling?.classList.contains('noc-body') === true)).toBe(true);
    await frame(p, 'b1e-popup-locked-phrase', line, {bars: 0});
    await set(h.sw, {v1_phishing_phrase: LONG});
    await p.reload();
    await phraseLine(line, LONG);
    await frame(p, 'b1e-popup-locked-long', line, {bars: 0});
    await p.close();
    await stripContext(h.ctx, 'wallet.state', '/popup.html');
    p = await h.openPopup();
    await expect(p.getByText('Welcome back')).toBeVisible({timeout: 30_000});
    await failedLine(p.locator('.app-phrase-line'));
    await frame(p, 'b1e-popup-locked-failed', p.locator('.app-phrase-line'), {bars: 0});
    await p.close();
  } finally {
    await h.close();
  }

  // #35, #37 and #38 in a context without the stripping script.
  const u = await launchPopup('noctura-e2e-visual-b1e-popup-2-', {ext: EXT_NOPRESALE});
  try {
    await seedUnlockedWallet(u.sw);
    const p = await u.openPopup();
    await expect(p.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
    await p.getByRole('button', {name: 'Settings'}).click();
    await p.locator('.s7-title', {hasText: 'Security center'}).click();
    const row = p.locator('.s7-row', {hasText: 'Anti-phishing phrase'});
    await expect(row.locator('.s7-meta')).toHaveText('Off');
    await frame(p, 'b1e-35-row-off', row, {bars: 0});
    await row.click();
    const card = p.locator('.app-phrase-card');
    await p.getByRole('textbox', {name: 'Anti-phishing phrase'}).fill(BLUE);
    await expect(card.getByRole('button', {name: 'Set phrase'})).toBeEnabled();
    await expect(card.getByRole('button', {name: 'Remove phrase'})).toHaveCount(0);
    await expect(card).toContainText('3–32 characters: letters, numbers, symbols and simple emoji.');
    await expect(card).toContainText('Never type it into a website. Anyone who uses this browser profile can see it.');
    await frame(p, 'b1e-35-card-set', card.getByRole('button', {name: 'Set phrase'}), {bars: 0});
    await card.getByRole('button', {name: 'Set phrase'}).click();
    await expect(row.locator('.s7-meta')).toHaveText('On', {timeout: 30_000});
    await frame(p, 'b1e-35-row-on', row, {bars: 0});
    await row.click();
    await expect(p.getByRole('textbox', {name: 'New anti-phishing phrase'})).toHaveValue('');
    await p.getByRole('textbox', {name: 'New anti-phishing phrase'}).fill(GREEN);
    await expect(card).toContainText('A change or a removal asks for your password in a new tab.');
    await frame(p, 'b1e-35-card-change', card.getByRole('button', {name: 'Remove phrase'}), {bars: 0});
    await card.locator('.app-picker-head').click();

    // #37: DELETE typed — the checkbox directly above the hold; checked — the CTA is one activation.
    await p.getByRole('button', {name: 'Back'}).click();
    await p.locator('.s7-title', {hasText: 'Delete wallet'}).click();
    await expect(p.getByText('Delete this wallet?')).toBeVisible();
    await p.getByRole('textbox', {name: 'Type DELETE here'}).fill('DELETE');
    const box = p.getByRole('checkbox', {name: UNDERSTOOD});
    const ack = p.locator('.sticky-bar .app-understood');
    await expect(box).not.toBeChecked();
    await boxAbove(ack, p.locator('.sticky-bar .app-hold'));
    await frame(p, 'b1e-37-matched', ack, {bars: 1});
    await box.check();
    const cta = p.getByRole('button', {name: 'Delete wallet'});
    await expect(cta).toBeEnabled();
    await boxAbove(ack, cta);
    await frame(p, 'b1e-37-understood', ack, {bars: 1, ready: cta});
    await box.uncheck();

    // #38: Legal (Terms of Service, Privacy Policy, Open-source licenses), Resources (Help & support).
    await p.getByRole('button', {name: 'Back'}).click();
    await p.getByText('About Noctura').click();
    const terms = p.getByRole('link', {name: 'Terms of Service (opens in a new tab)'});
    await expect(p.getByRole('link', {name: 'Privacy Policy (opens in a new tab)'})).toBeVisible();
    await frame(p, 'b1e-38-legal', terms, {bars: 0});
    const help = p.getByRole('link', {name: 'Help & support (opens in a new tab)'});
    await frame(p, 'b1e-38-help', help, {bars: 0});
    contained(u);
  } finally {
    await u.close();
  }
});

test('visual · B1e vault page (412 × 916): #1 with the terms line; #9 with the phrase and R9; the onboarding step (empty, typed, refused); #10 change / remove; the damaged states, Save, the removal and its checkbox', async () => {
  test.setTimeout(300_000);
  const h = await launchPopup('noctura-e2e-visual-b1e-vault-', {ext: EXT_NOPRESALE});
  try {
    // #1: the terms line above the two buttons, its two links.
    let p = await tab(h, 'unlock.html?mode=welcome');
    const terms = p.locator('#wel-terms');
    await expect(terms).toHaveText('By continuing you agree to the Terms and Privacy Policy.');
    expect(await terms.evaluate(e => e.nextElementSibling?.id)).toBe('wel-actions');
    await frame(p, 'b1e-01-terms', terms, {bars: 1, ready: p.locator('#wel-create')});

    // The onboarding step, through a plain import (the fake funds both address types: the standard one is chosen).
    await p.goto(`chrome-extension://${h.id}/unlock.html?mode=import`);
    await pastePhrase(p, E2E_MNEMONIC);
    await p.locator('#imp-continue').click();
    await p.locator('#imp-choose-slip10').click();
    await expect(p.locator('#pw-step')).toHaveText('Import · 2 / 2', {timeout: 30_000});
    await setPassword(p, E2E_PASSWORD);
    await expect(p.locator('#v-anti-phishing')).toBeVisible({timeout: 60_000});
    await expect(p.locator('#v-anti-phishing h1')).toHaveText('Set an anti-phishing phrase');
    await expect(p.locator('#v-anti-phishing .top-bar .noc-overline')).toHaveText('Optional');
    await expect(p.locator('#ap-helper')).toHaveText('3–32 characters: letters, numbers, symbols and simple emoji.');
    await expect(p.locator('#ap-help')).toHaveText('Never type it into a website. Anyone who uses this browser profile can see it.');
    await expect(p.locator('#ap-set')).toBeDisabled();
    await frame(p, 'b1e-step-empty', p.locator('#ap-field'), {bars: 1, ready: p.locator('#ap-skip')});
    await p.locator('#ap-field').fill(BLUE);
    await frame(p, 'b1e-step-typed', p.locator('#ap-field'), {bars: 1, ready: p.locator('#ap-set')});
    await p.evaluate(() => {
      const rt = (globalThis as unknown as {chrome: {runtime: {sendMessage(m: unknown): Promise<unknown>}}}).chrome.runtime;
      const send = rt.sendMessage.bind(rt);
      rt.sendMessage = async (m: unknown) => ((m as {type?: string}).type === 'settings.phrase' ? {ok: false, error: 'failed'} : send(m));
    });
    await p.locator('#ap-set').click();
    await expect(p.locator('#ap-line')).toBeVisible();
    await frame(p, 'b1e-step-refused', p.locator('#ap-line'), {bars: 1, ready: p.locator('#ap-skip')});
    await p.locator('#ap-skip').click();
    await p.waitForURL(/\/wallet\.html#\/imported$/, {timeout: 60_000});

    // #10: a change and a removal of the phrase (challenges from an extension page; the CURRENT phrase on the line).
    await set(h.sw, {v1_phishing_phrase: BLUE});
    for (const [phrase, about, name] of [
      [GREEN, 'Change the anti-phishing phrase', 'b1e-10-change'],
      [null, 'Remove the anti-phishing phrase', 'b1e-10-remove'],
    ] as const) {
      const r = await msg(p, {type: 'settings.phrase', phrase});
      expect(r.error).toBe('reauth-required');
      const id = (r.data as {challengeId: string}).challengeId;
      const v = await tab(h, `unlock.html?mode=reauth&challenge=${id}`);
      await expect(v.locator('#ra-rows')).toHaveText(about, {timeout: 60_000});
      await phraseLine(v.locator('#ra-phrase'), BLUE);
      expect(await v.locator('body').innerText()).not.toContain(GREEN);
      await frame(v, name, v.locator('#ra-phrase'), {bars: 1, ready: v.locator('#ra-confirm')});
      await v.close();
    }

    // #9: the line above the password field; a long phrase; R9.
    await lock(h.sw);
    p = await tab(h, 'unlock.html');
    await expect(p.locator('#unl-password')).toBeVisible({timeout: 60_000});
    await phraseLine(p.locator('#unl-phrase'), BLUE);
    await frame(p, 'b1e-09-phrase', p.locator('#unl-phrase'), {bars: 1, ready: p.locator('#unl-submit')});
    await set(h.sw, {v1_phishing_phrase: LONG});
    await p.reload();
    await expect(p.locator('#unl-password')).toBeVisible({timeout: 60_000});
    await phraseLine(p.locator('#unl-phrase'), LONG);
    await frame(p, 'b1e-09-long', p.locator('#unl-phrase'), {bars: 1, ready: p.locator('#unl-submit')});
    await p.close();
    await stripContext(h.ctx, 'vault.status', '/unlock.html');
    p = await tab(h, 'unlock.html');
    await expect(p.locator('#unl-password')).toBeVisible({timeout: 60_000});
    await failedLine(p.locator('#unl-phrase-failed'));
    await frame(p, 'b1e-09-failed', p.locator('#unl-phrase-failed'), {bars: 1, ready: p.locator('#unl-submit')});
    await p.close();
  } finally {
    await h.close();
  }

  // The damaged states, Save and the removal, in a context without the stripping script.
  const d = await launchPopup('noctura-e2e-visual-b1e-damaged-', {ext: EXT_NOPRESALE});
  try {
    const env = await makeEnvelope();
    await set(d.sw, {v1_vault: {...env, password: {wrapped: 'AAAA'}}});
    const p = await tab(d, 'unlock.html');
    const save = p.locator('#dmg-save');
    await expect(p.locator('#dmg-unreadable')).toHaveText('Wallet data is damaged', {timeout: 60_000});
    await expect(save).toHaveText('Save the damaged data');
    await expect(save).toHaveAttribute('download', /^noctura-damaged-wallet-[0-9a-f]{8}\.json$/);
    await expect(save).toHaveCSS('text-decoration-line', 'none');
    expect(await save.evaluate(e => e.nextElementSibling?.id)).toBe('dmg-remove');
    await frame(p, 'b1e-09-unreadable', p.locator('#dmg-unreadable'), {bars: 1, ready: p.locator('#dmg-remove')});
    await p.goto(`chrome-extension://${d.id}/unlock.html?mode=welcome`);
    await expect(p.locator('#dmg-unreadable')).toHaveText('Wallet data is damaged', {timeout: 60_000});
    await frame(p, 'b1e-01-unreadable', p.locator('#dmg-unreadable'), {bars: 1, ready: p.locator('#dmg-remove')});
    await set(d.sw, {v1_vault: {...env, v: 2}});
    await p.goto(`chrome-extension://${d.id}/unlock.html`);
    // E19: the short heading, the sentence that says why as the body's first line — both in the frame.
    await expect(p.locator('#dmg-refused')).toHaveText('Update Noctura to open this wallet', {timeout: 60_000});
    await expect(p.locator('#dmg-refused-body p').first()).toHaveText("This version of Noctura can't open this wallet's data.");
    await expect(p.locator('#dmg-remove')).toBeHidden();
    await expect(save).toHaveCSS('text-decoration-line', 'none');
    await frame(p, 'b1e-09-refused', p.locator('#dmg-refused'), {bars: 1, ready: save});
    await expect(p.locator('#dmg-refused-body p').first()).toBeInViewport({ratio: 1});

    // The removal: idle, DELETE typed (the checkbox directly above the hold), checked (one activation).
    await set(d.sw, {v1_vault: {...env, password: {wrapped: 'AAAA'}}});
    await p.goto(`chrome-extension://${d.id}/unlock.html?mode=remove-damaged`);
    await expect(p.locator('#rd-entry')).toBeVisible({timeout: 60_000});
    await expect(p.locator('#rd-save')).toHaveCSS('text-decoration-line', 'none');
    await frame(p, 'b1e-rd-idle', p.locator('#rd-save'), {bars: 1, ready: p.locator('#rd-cancel')});
    await p.locator('#rd-word').fill('DELETE');
    const row = p.locator('#rd-understood-row');
    await expect(row).toHaveText(UNDERSTOOD);
    await boxAbove(row, p.locator('#rd-hold'));
    await frame(p, 'b1e-rd-matched', row, {bars: 1, ready: p.locator('#rd-hold')});
    await p.getByRole('checkbox', {name: UNDERSTOOD}).check();
    await expect(p.getByRole('button', {name: 'Remove damaged wallet'})).toBeEnabled();
    await expect(p.locator('#rd-caption')).toBeHidden();
    await boxAbove(row, p.locator('#rd-hold'));
    await frame(p, 'b1e-rd-understood', row, {bars: 1, ready: p.locator('#rd-hold')});
  } finally {
    await d.close();
  }
});

test('visual · B1e approval window (412 × 720): the phrase on #47, #46, #48, #48 F12 Reject-only and the locked window; R9 there', async () => {
  test.setTimeout(300_000);
  const h = await launchPopup('noctura-e2e-visual-b1e-window-', {hosts: DAPP_HOSTS, ext: EXT_NOPRESALE});
  const server = await serveDapp(h.ctx);
  const csp = await watchCsp(h.ctx);
  try {
    installPresale(h, {allocation: RETURNING});
    await set(h.sw, {v1_vault: await makeEnvelope(), v1_known_recipients: [{address: SOL_TREASURY, at: Date.now()}], v1_phishing_phrase: BLUE});
    await unlockWith(await h.ctx.newPage(), h.id, E2E_PASSWORD);
    const popup = await h.openPopup();
    await expect(popup.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
    const page = await openDapp(h.ctx, 'https://dapp.test');

    let c!: Promise<unknown>;
    let win = await windowFor(h, () => (c = adapter.connect(page)));
    await expect(win.getByRole('button', {name: 'Connect for this session'})).toBeVisible({timeout: 15_000});
    await phraseLine(win.locator('.app-phrase-line'), BLUE);
    expect(await win.locator('.app-phrase-line').evaluate(e => e.previousElementSibling?.classList.contains('top-bar') === true)).toBe(true);
    await frame(win, 'b1e-47-phrase', win.locator('.app-phrase-line'), {bars: 1});
    await win.getByRole('checkbox', {name: 'I understand this domain is not on the verified list'}).click();
    await win.getByRole('checkbox', {name: /I've read these permissions/}).click();
    await win.getByRole('button', {name: 'Connect for this session'}).click();
    expect(await c).toEqual({ok: true, value: ACCOUNT});
    await windowClosed(win);

    let request!: Promise<unknown>;
    win = await windowFor(h, () => (request = sign(page, 'Sign in to the test dApp')));
    await expect(win.getByText('Sign in to the test dApp')).toBeVisible({timeout: 15_000});
    await phraseLine(win.locator('.app-phrase-line'), BLUE);
    await frame(win, 'b1e-46-phrase', win.locator('.app-phrase-line'), {bars: 1});
    await reject(win, request);

    win = await windowFor(h, () => (request = adapter.sign(page, BLOCKHASH)));
    await expect(win.getByText('Balance changes (post-simulation)').first()).toBeVisible({timeout: 15_000});
    await phraseLine(win.locator('.app-phrase-line'), BLUE);
    await frame(win, 'b1e-48-phrase', win.locator('.app-phrase-line'), {bars: 1});
    await reject(win, request);

    h.fake.geo.check = {countryCode: 'KP', isVpn: false};
    win = await windowFor(h, () => (request = adapter.customSign(page, BLOCKHASH, [solPurchaseIx(ACCOUNT, 100_000_000n)])));
    await expect(win.locator('.s9-flag-banner.danger .head')).toHaveText('Presale purchase blocked', {timeout: 15_000});
    expect(await win.locator('.sticky-bar button').allTextContents()).toEqual(['Reject']);
    await phraseLine(win.locator('.app-phrase-line'), BLUE);
    await frame(win, 'b1e-48-f12-phrase', win.locator('.app-phrase-line'), {bars: 1});
    await reject(win, request);

    await lock(h.sw);
    const other = await openDapp(h.ctx, 'https://jup.ag');
    win = await windowFor(h, () => (request = connect(other)));
    await expect(win.getByText('Noctura is locked')).toBeVisible({timeout: 15_000});
    await phraseLine(win.locator('.app-phrase-line'), BLUE);
    await frame(win, 'b1e-window-locked-phrase', win.locator('.app-phrase-line'), {bars: 1});
    await reject(win, request);

    await stripContext(h.ctx, 'dapp.pending', '/approve.html');
    win = await windowFor(h, () => (request = connect(other)));
    await expect(win.getByText('Noctura is locked')).toBeVisible({timeout: 15_000});
    await failedLine(win.locator('.app-phrase-line'));
    await frame(win, 'b1e-window-locked-failed', win.locator('.app-phrase-line'), {bars: 1});
    await reject(win, request);

    expect(csp).toEqual([]);
    contained(h);
    expect(server.unexpected).toEqual([]);
  } finally {
    await h.close();
  }
});
