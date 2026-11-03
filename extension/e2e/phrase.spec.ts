import {test, expect, type BrowserContext, type Locator, type Page, type Worker} from '@playwright/test';
import {base58} from '@scure/base';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {contained, launchPopup, type Harness} from './popupHarness';
import {EXT, EXT_NOPRESALE} from './launch';
import {E2E_ACCOUNTS, E2E_MNEMONIC, E2E_PASSWORD, makeEnvelope} from './makeEnvelope';
import {pastePhrase, setPassword, unlockWith} from './vaultPage';
import {DAPP_HOSTS, adapter, approvalWindow, connect, openDapp, serveDapp, sign, windowClosed, type DappServer} from './dappPage';
import {SOL_TREASURY, solPurchaseIx} from './presaleChain';
import {installPresale, watchCsp} from './presaleHelpers';

declare const chrome: {
  runtime: {sendMessage(m: unknown): Promise<unknown>};
  storage: {local: {set(o: object): Promise<void>; get(k: string): Promise<Record<string, unknown>>; remove(k: string): Promise<void>}; session: {remove(k: string): Promise<void>}};
};

// B1e §1.2, §1.3, §1.6 through the real extension, in both builds: the anti-phishing phrase on the six screens — the
// popup's locked screen, the vault page's unlock (#9, before the password field), #47, #46, #48 (a transfer, and F12's
// Reject-only purchase with the region gate closed), the locked approval window and #10 — as text (a phrase that looks
// like markup makes no element); nothing when none is set; R9's line when the read fails (the `phrase` field stripped
// from the answer inside the page: the real background always sends a valid one). And how it is set: onboarding's step
// after the wallet is stored (it survives the first write), #35 set-when-none at once, change and remove through #10
// (which shows the CURRENT phrase and never the new one). Contained as every spec: the fake coordinator, the dApp's
// hosts, no CSP violation.
const ACCOUNT = E2E_ACCOUNTS[0];
const DAPP = 'https://dapp.test';
const BLOCKHASH = base58.encode(new Uint8Array(32).fill(7));
const LAMPORTS = 100_000_000n;
const MARKUP = '<b>Blue</b> horse 42';
const GREEN = 'Green fox 7';
const LINE = (phrase: string) => `Anti-phishing phrase: ${phrase}`;
const R9 = "Anti-phishing phrase could not be read — don't type your password until it shows";
const RETURNING = {totalBase: 1_998_667_554_963n, spentCents: 30_000n, count: 2};

const local = (sw: Worker, key: string) => sw.evaluate(async k => (await chrome.storage.local.get(k))[k], key);
const lock = (sw: Worker) => sw.evaluate(() => chrome.storage.session.remove('v1_session'));
/** The dApp limits reset (C14): this spec rejects more requests in a minute than the cooldown allows, by design of the spec. */
const fresh = (sw: Worker) => sw.evaluate(() => chrome.storage.local.set({v1_dapp_limits: {rejections: [], cooldowns: [], windows: [], notice: false}}));
/** An init script (before the page's own): the named answer's `phrase` field removed — a read this side cannot trust. */
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
const stripPage = (p: Page, type: string, path: string) => p.addInitScript(stripScript, {type, path});
const stripContext = (ctx: BrowserContext, type: string, path: string) => ctx.addInitScript(stripScript, {type, path});

/** The popup's (or a window's) line: exactly one, its text, no element made of the phrase. */
async function popupLine(p: Page, phrase: string): Promise<void> {
  const line = p.locator('.app-phrase-line');
  await expect(line).toHaveCount(1, {timeout: 30_000});
  await expect(line).toHaveText(LINE(phrase));
  await expect(line.locator('.copy')).toHaveText(phrase);
  expect(await line.locator('.copy').evaluate(e => e.childElementCount)).toBe(0);
  await expect(line.locator('svg')).toHaveCount(1);
}
/** A fresh vault-page tab on #9. */
async function unlockPage(h: Harness, o: {strip?: boolean} = {}): Promise<Page> {
  const p = await h.ctx.newPage();
  if (o.strip === true) await stripPage(p, 'vault.status', '/unlock.html');
  await p.goto(`chrome-extension://${h.id}/unlock.html`);
  await expect(p.locator('#unl-password')).toBeVisible({timeout: 60_000});
  return p;
}
/** #9's line: shown with the phrase as text, above the password field. */
async function vaultLine(p: Page, phrase: string): Promise<void> {
  await expect(p.locator('#unl-phrase')).toBeVisible();
  await expect(p.locator('#unl-phrase')).toHaveText(LINE(phrase));
  await expect(p.locator('#unl-phrase-text')).toHaveText(phrase);
  expect(await p.locator('#unl-phrase-text').evaluate(e => e.childElementCount)).toBe(0);
  await expect(p.locator('#unl-phrase-failed')).toBeHidden();
  const line = await p.locator('#unl-phrase').boundingBox();
  const field = await p.locator('#unl-password').boundingBox();
  expect((line?.y ?? Infinity) + (line?.height ?? 0)).toBeLessThanOrEqual(field?.y ?? -Infinity);
}

/** A fresh popup on #35, its anti-phishing row saying `meta`. */
async function phraseRow(h: Harness, meta: 'On' | 'Off'): Promise<Locator> {
  const popup = await h.openPopup();
  await expect(popup.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
  await popup.getByRole('button', {name: 'Settings'}).click();
  await popup.locator('.s7-title', {hasText: 'Security center'}).click();
  const row = popup.locator('.s7-row', {hasText: 'Anti-phishing phrase'});
  await expect(row.locator('.s7-meta')).toHaveText(meta);
  return row;
}
/** #10, opened by the card's `button`: a tab on ?mode=reauth with a challenge. */
async function reauthTab(h: Harness, popup: Page, button: string): Promise<Page> {
  const [tab] = await Promise.all([h.ctx.waitForEvent('page'), popup.getByRole('button', {name: button}).click()]);
  await expect(tab).toHaveURL(/unlock\.html\?mode=reauth&challenge=[0-9a-f]{32}$/);
  return tab;
}
/** The password given on #10: the settings kind's end state. */
async function confirmed(tab: Page): Promise<void> {
  await tab.locator('#ra-password').fill(E2E_PASSWORD);
  await tab.locator('#ra-confirm').click();
  await expect(tab.locator('#ra-notice-line')).toHaveText('Confirmed. The change is saved — you can close this tab.', {timeout: 60_000});
  await tab.close();
}

async function scene(prefix: string, ext: string): Promise<{h: Harness; server: DappServer; csp: string[]}> {
  const h = await launchPopup(prefix, {hosts: DAPP_HOSTS, ext});
  const server = await serveDapp(h.ctx);
  const csp = await watchCsp(h.ctx);
  installPresale(h, {allocation: RETURNING});
  await h.sw.evaluate(({env, treasury}) => chrome.storage.local.set({v1_vault: env, v1_known_recipients: [{address: treasury, at: Date.now()}]}), {env: await makeEnvelope(), treasury: SOL_TREASURY});
  return {h, server, csp};
}

for (const [name, ext, presale] of [
  ['on (dist)', EXT, true],
  ['off (dist-nopresale)', EXT_NOPRESALE, false],
] as const) {
  test(`phrase · ${name}: none → no line; set → the popup's locked screen, #9 before the field, #47, #46, #48, #48 F12 Reject-only, the locked window — as text; R9 where the read fails`, async () => {
    test.setTimeout(300_000);
    expect(JSON.parse(readFileSync(join(dirname(ext), 'app.features.json'), 'utf8'))).toEqual({presale});
    const {h, server, csp} = await scene(`noctura-e2e-phrase-screens-${presale ? 'on' : 'off'}-`, ext);
    try {
      // None set: no line anywhere, the screens as before.
      let popup = await h.openPopup();
      await expect(popup.getByText('Welcome back')).toBeVisible({timeout: 30_000});
      await expect(popup.locator('.app-phrase-line')).toHaveCount(0);
      await popup.close();
      let vault = await unlockPage(h);
      await expect(vault.locator('#unl-phrase')).toBeHidden();
      await expect(vault.locator('#unl-phrase-failed')).toBeHidden();
      await vault.close();

      // Set (by the background's key, as #35 or the step would leave it): a phrase that looks like markup.
      await h.sw.evaluate(p => chrome.storage.local.set({v1_phishing_phrase: p}), MARKUP);
      popup = await h.openPopup();
      await expect(popup.getByText('Welcome back')).toBeVisible({timeout: 30_000});
      await popupLine(popup, MARKUP);
      await popup.close();
      vault = await unlockPage(h);
      await vaultLine(vault, MARKUP);
      await vault.close();
      await unlockWith(await h.ctx.newPage(), h.id, E2E_PASSWORD);

      // The approval windows, unlocked: #47 (connect), #46 (sign a message), #48 (a transfer).
      popup = await h.openPopup();
      await expect(popup.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
      await expect(popup.locator('.app-phrase-line')).toHaveCount(0);
      const page = await openDapp(h.ctx, DAPP);
      let c!: Promise<unknown>;
      let win = await approvalWindow(h.ctx, () => (c = adapter.connect(page)));
      await expect(win.getByRole('button', {name: 'Connect for this session'})).toBeVisible({timeout: 15_000});
      await popupLine(win, MARKUP);
      await win.getByRole('checkbox', {name: 'I understand this domain is not on the verified list'}).click();
      await win.getByRole('checkbox', {name: /I've read these permissions/}).click();
      await win.getByRole('button', {name: 'Connect for this session'}).click();
      expect(await c).toEqual({ok: true, value: ACCOUNT});
      await windowClosed(win);

      let request!: Promise<unknown>;
      await fresh(h.sw);
      win = await approvalWindow(h.ctx, () => (request = sign(page, 'Sign in to the test dApp')));
      await expect(win.getByText('Sign in to the test dApp')).toBeVisible({timeout: 15_000});
      await popupLine(win, MARKUP);
      await win.getByRole('button', {name: 'Reject'}).click();
      expect(((await request) as {ok: boolean}).ok).toBe(false);
      await windowClosed(win);

      await fresh(h.sw);
      win = await approvalWindow(h.ctx, () => (request = adapter.sign(page, BLOCKHASH)));
      await expect(win.getByText('Balance changes (post-simulation)').first()).toBeVisible({timeout: 15_000});
      await popupLine(win, MARKUP);
      await win.getByRole('button', {name: 'Reject'}).click();
      expect(((await request) as {ok: boolean}).ok).toBe(false);
      await windowClosed(win);

      // #48 F12: a presale purchase with the region gate closed — Reject only, and the line on it.
      h.fake.geo.check = {countryCode: 'KP', isVpn: false};
      await fresh(h.sw);
      win = await approvalWindow(h.ctx, () => (request = adapter.customSign(page, BLOCKHASH, [solPurchaseIx(ACCOUNT, LAMPORTS)])));
      await expect(win.locator('.s9-flag-banner.danger .head')).toHaveText('Presale purchase blocked', {timeout: 15_000});
      expect(await win.locator('.sticky-bar button').allTextContents()).toEqual(['Reject']);
      await popupLine(win, MARKUP);
      await win.getByRole('button', {name: 'Reject'}).click();
      expect(((await request) as {ok: boolean}).ok).toBe(false);
      await windowClosed(win);
      expect(h.fake.broadcasts).toEqual([]);

      // Locked: the locked window (a site that asks to connect) carries the line.
      await lock(h.sw);
      const other = await openDapp(h.ctx, 'https://jup.ag');
      await fresh(h.sw);
      win = await approvalWindow(h.ctx, () => (request = connect(other)));
      await expect(win.getByText('Noctura is locked')).toBeVisible({timeout: 15_000});
      await popupLine(win, MARKUP);
      await win.getByRole('button', {name: 'Reject'}).click();
      expect(((await request) as {ok: boolean}).ok).toBe(false);
      await windowClosed(win);

      // R9: the field missing from the answer → the warning line, never silence and never the phrase.
      popup = await h.ctx.newPage();
      await popup.setViewportSize({width: 412, height: 600});
      await stripPage(popup, 'wallet.state', '/popup.html');
      await popup.goto(`chrome-extension://${h.id}/popup.html`);
      await expect(popup.getByText('Welcome back')).toBeVisible({timeout: 30_000});
      await expect(popup.locator('.app-phrase-line')).toHaveText(R9);
      await expect(popup.locator('.app-phrase-line.warning')).toHaveCount(1);
      await popup.close();
      vault = await unlockPage(h, {strip: true});
      await expect(vault.locator('#unl-phrase-failed')).toHaveText(R9);
      await expect(vault.locator('#unl-phrase')).toBeHidden();
      await vault.close();
      await stripContext(h.ctx, 'dapp.pending', '/approve.html');
      await fresh(h.sw);
      win = await approvalWindow(h.ctx, () => (request = connect(other)));
      await expect(win.getByText('Noctura is locked')).toBeVisible({timeout: 15_000});
      await expect(win.locator('.app-phrase-line')).toHaveText(R9);
      await expect(win.locator('.app-phrase-line.warning')).toHaveCount(1);
      await win.getByRole('button', {name: 'Reject'}).click();
      expect(((await request) as {ok: boolean}).ok).toBe(false);
      await windowClosed(win);

      expect(csp).toEqual([]);
      contained(h);
      expect(server.unexpected).toEqual([]);
    } finally {
      await h.close();
    }
  });

  test(`phrase · ${name}: set in onboarding's step (it survives the first write) → #9; #35 On; a change and a removal through #10 (the current phrase shown, never the new one); set again at once; R9 on #10`, async () => {
    test.setTimeout(300_000);
    const {h, server, csp} = await scene(`noctura-e2e-phrase-set-${presale ? 'on' : 'off'}-`, ext);
    try {
      await h.sw.evaluate(() => chrome.storage.local.remove('v1_vault'));
      // Onboarding (a plain import): the step comes once the wallet is stored; [Set phrase] writes it.
      const v = await h.ctx.newPage();
      await v.goto(`chrome-extension://${h.id}/unlock.html?mode=import`);
      await pastePhrase(v, E2E_MNEMONIC);
      await v.locator('#imp-continue').click();
      // The fake funds both address types of this phrase: the run asks which (the standard one, the wallet's account).
      await expect(v.getByText('Both address types on this phrase hold funds. Choose the one to use.')).toBeVisible({timeout: 30_000});
      await v.locator('#imp-choose-slip10').click();
      await expect(v.locator('#pw-step')).toHaveText('Import · 2 / 2', {timeout: 30_000});
      await setPassword(v, E2E_PASSWORD);
      await expect(v.locator('#v-anti-phishing')).toBeVisible({timeout: 60_000});
      expect(await local(h.sw, 'v1_vault')).toBeDefined();
      expect(await local(h.sw, 'v1_phishing_phrase')).toBeUndefined();
      await v.locator('#ap-field').fill(MARKUP);
      await v.locator('#ap-set').click();
      await v.waitForURL(/\/wallet\.html#\/imported$/, {timeout: 60_000});
      expect(await local(h.sw, 'v1_phishing_phrase')).toBe(MARKUP);
      await v.close();
      await lock(h.sw);
      let vault = await unlockPage(h);
      await vaultLine(vault, MARKUP);
      await unlockWith(vault, h.id, E2E_PASSWORD);
      await vault.close();

      // #35: On; the card never shows the stored phrase. A change → #10 (the popup closes itself once the tab opens).
      let row = await phraseRow(h, 'On');
      const input = row.page().getByRole('textbox', {name: 'New anti-phishing phrase'});
      await row.click();
      await expect(input).toHaveValue('');
      await input.fill(GREEN);
      let tab = await reauthTab(h, row.page(), 'Change phrase');
      await expect(tab.locator('#ra-rows')).toHaveText('Change the anti-phishing phrase', {timeout: 60_000});
      await expect(tab.locator('#ra-phrase-text')).toHaveText(MARKUP);
      expect(await tab.locator('body').innerText()).not.toContain(GREEN);
      expect(await local(h.sw, 'v1_phishing_phrase')).toBe(MARKUP);
      await confirmed(tab);
      expect(await local(h.sw, 'v1_phishing_phrase')).toBe(GREEN);

      // A removal → #10, showing the phrase now stored.
      row = await phraseRow(h, 'On');
      await row.click();
      tab = await reauthTab(h, row.page(), 'Remove phrase');
      await expect(tab.locator('#ra-rows')).toHaveText('Remove the anti-phishing phrase', {timeout: 60_000});
      await expect(tab.locator('#ra-phrase-text')).toHaveText(GREEN);
      await confirmed(tab);
      expect(await local(h.sw, 'v1_phishing_phrase')).toBeUndefined();

      // Set when none is set: written at once, no tab.
      row = await phraseRow(h, 'Off');
      const pages = h.ctx.pages().length;
      await row.click();
      await row.page().getByRole('textbox', {name: 'Anti-phishing phrase'}).fill(GREEN);
      await row.page().getByRole('button', {name: 'Set phrase'}).click();
      await expect(row.locator('.s7-meta')).toHaveText('On', {timeout: 30_000});
      expect(await local(h.sw, 'v1_phishing_phrase')).toBe(GREEN);
      expect(h.ctx.pages().length).toBe(pages);
      await row.page().close();

      // R9 on #10: the field stripped from vault.status in the tab the change opens; nothing applied.
      await stripContext(h.ctx, 'vault.status', '/unlock.html');
      row = await phraseRow(h, 'On');
      await row.click();
      await row.page().getByRole('textbox', {name: 'New anti-phishing phrase'}).fill(MARKUP);
      tab = await reauthTab(h, row.page(), 'Change phrase');
      await expect(tab.locator('#ra-phrase-failed')).toHaveText(R9, {timeout: 60_000});
      await expect(tab.locator('#ra-phrase')).toBeHidden();
      await tab.close();
      expect(await local(h.sw, 'v1_phishing_phrase')).toBe(GREEN);

      // The new phrase on the locked popup.
      await lock(h.sw);
      vault = await h.ctx.newPage();
      await vault.goto(`chrome-extension://${h.id}/popup.html`);
      await popupLine(vault, GREEN);
      await vault.close();

      expect(csp).toEqual([]);
      contained(h);
      expect(server.unexpected).toEqual([]);
    } finally {
      await h.close();
    }
  });
  // Rev 2.6 (the final review's Minor 1, its probe P1): one reading of "a wallet is stored" on the phrase path. A vault
  // this version refuses (§2.1: here a KDF cost below today's floor — what a later release raising the floor makes of
  // every older wallet) with a phrase stored: the popup's locked screen draws no line, as the approval window draws none
  // and #9 shows the update screen without one. Positive control: the same store with the wallet put back draws it on
  // both surfaces.
  test(`phrase · ${name}: a vault this version refuses — no line on the popup's locked screen, none on the locked window, none on #9; the wallet put back → both draw it`, async () => {
    test.setTimeout(300_000);
    const {h, server, csp} = await scene(`noctura-e2e-phrase-refused-${presale ? 'on' : 'off'}-`, ext);
    try {
      const wallet = await local(h.sw, 'v1_vault');
      const refused = {...(wallet as Record<string, unknown>), kdf: {...((wallet as {kdf: Record<string, unknown>}).kdf), m: 32768}};
      await h.sw.evaluate(({v, p}) => chrome.storage.local.set({v1_vault: v, v1_phishing_phrase: p}), {v: refused, p: MARKUP});
      const other = await openDapp(h.ctx, 'https://jup.ag');
      let request!: Promise<unknown>;
      for (const [vault, drawn] of [[refused, false], [wallet, true]] as const) {
        await h.sw.evaluate(v => chrome.storage.local.set({v1_vault: v}), vault);
        const popup = await h.openPopup();
        await expect(popup.getByText('Welcome back')).toBeVisible({timeout: 30_000});
        if (drawn) await popupLine(popup, MARKUP);
        else {
          // The answer has arrived (the screen is the locked one, routed by hasWallet) and carries no phrase.
          expect(await popup.evaluate(() => chrome.runtime.sendMessage({type: 'wallet.state'}))).toMatchObject({ok: true, data: {hasWallet: true, phrase: null}});
          await expect(popup.locator('.app-phrase-line')).toHaveCount(0);
        }
        await popup.close();
        await fresh(h.sw);
        const win = await approvalWindow(h.ctx, () => (request = connect(other)));
        await expect(win.getByText('Noctura is locked')).toBeVisible({timeout: 15_000});
        if (drawn) await popupLine(win, MARKUP);
        else await expect(win.locator('.app-phrase-line')).toHaveCount(0);
        await win.getByRole('button', {name: 'Reject'}).click();
        expect(((await request) as {ok: boolean}).ok).toBe(false);
        await windowClosed(win);
        if (!drawn) {
          const v = await h.ctx.newPage();
          await v.goto(`chrome-extension://${h.id}/unlock.html`);
          await expect(v.getByText('Update Noctura to open this wallet')).toBeVisible({timeout: 60_000});
          await expect(v.locator('#unl-phrase')).toBeHidden();
          await expect(v.locator('#unl-phrase-failed')).toBeHidden();
          await v.close();
        }
      }
      expect(await local(h.sw, 'v1_phishing_phrase')).toBe(MARKUP);
      // The wallet put back opens with its password, and the popup reads its balances through the fake coordinator.
      await unlockWith(await h.ctx.newPage(), h.id, E2E_PASSWORD);
      const popup = await h.openPopup();
      await expect(popup.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
      await popup.close();
      expect(csp).toEqual([]);
      contained(h);
      expect(server.unexpected).toEqual([]);
    } finally {
      await h.close();
    }
  });
}
