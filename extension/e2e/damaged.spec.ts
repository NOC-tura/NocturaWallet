import {test, expect, type Page, type Worker} from '@playwright/test';
import {createHash} from 'node:crypto';
import {readFileSync, rmSync} from 'node:fs';
import {makeEnvelope} from './makeEnvelope';
import {containNocTura, containSolscan, expectContained, launchContained} from './launch';
import {shot} from './visualTab';

// B1e §2.2–§2.4 through the real extension: the unreadable state on #9 and #1, "Save the damaged data" read back from
// Playwright's download, the removal (typed DELETE + the 1 s hold) and its refusal for a vault refused by this version
// and for a wallet. Each state is shot at the vault page's size (412 × 916) for the visual check.
declare const chrome: {storage: {local: {set(o: object): Promise<void>; get(k: string | null): Promise<Record<string, unknown>>; remove(k: string): Promise<void>}}};

const HOLD_MS = 1_000;
const sha256 = (b: Buffer): string => createHash('sha256').update(b).digest('hex');
const storedText = (sw: Worker): Promise<string | undefined> => sw.evaluate(async () => JSON.stringify((await chrome.storage.local.get('v1_vault')).v1_vault));

async function vaultPage(ctx: Awaited<ReturnType<typeof launchContained>>['ctx'], id: string, path: string): Promise<Page> {
  const page = await ctx.newPage();
  await page.setViewportSize({width: 412, height: 916});
  await page.goto('about:blank');
  await page.clock.install();
  await page.goto(`chrome-extension://${id}/${path}`);
  return page;
}
/** Saves through the link and returns the file's bytes and name. */
async function save(page: Page, selector: string): Promise<{bytes: Buffer; name: string}> {
  const [download] = await Promise.all([page.waitForEvent('download'), page.click(selector)]);
  return {bytes: readFileSync(await download.path()), name: download.suggestedFilename()};
}
/** Holds the removal's button for the full second on the page's paused clock. */
async function hold(page: Page, ms: number): Promise<void> {
  await page.locator('#rd-hold').hover();
  await page.mouse.down();
  await page.clock.runFor(ms);
  await page.mouse.up();
}

test('damaged vaults: the unreadable state, its saved bytes, the removal; a refused vault and a wallet are never removed', async () => {
  const {ctx, profile} = await launchContained('noctura-e2e-damaged-');
  const nocTura = await containNocTura(ctx);
  const solscan = await containSolscan(ctx);
  try {
    await expectContained(ctx);
    const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
    const id = new URL(sw.url()).host;
    const env = await makeEnvelope();

    // Unreadable (U3: a 3-byte password wrap), with the wallet's settings, address book and anti-phishing phrase beside it.
    await sw.evaluate(v => chrome.storage.local.set({v1_vault: v, v1_settings: {autoLockMinutes: 5}, v1_contacts: [{address: 'x', name: 'y'}], v1_phishing_phrase: 'Blue horse 42'}), {...env, password: {wrapped: 'AAAA'}});
    const text = await storedText(sw);
    let p = await vaultPage(ctx, id, 'unlock.html');
    await expect(p.locator('#dmg-unreadable')).toHaveText('Wallet data is damaged', {timeout: 60_000});
    await expect(p.locator('#unl-password')).toBeHidden();
    await expect(p.locator('#dmg-remove')).toBeVisible();
    await shot(p, 'damaged-09-unreadable', {ready: p.locator('#dmg-remove')});
    const fromState = await save(p, '#dmg-save');
    expect(fromState.bytes.toString('utf8')).toBe(text);
    expect(fromState.name).toBe(`noctura-damaged-wallet-${sha256(fromState.bytes).slice(0, 8)}.json`);
    await p.goto(`chrome-extension://${id}/unlock.html?mode=welcome`);
    await expect(p.locator('#dmg-unreadable')).toHaveText('Wallet data is damaged');
    await expect(p.locator('#wel-create')).toBeHidden();
    await shot(p, 'damaged-01-unreadable', {ready: p.locator('#dmg-remove')});

    await p.click('#dmg-remove');
    await expect(p).toHaveURL(/unlock\.html\?mode=remove-damaged$/);
    await expect(p.locator('#rd-entry')).toBeVisible();
    await expect(p.locator('#rd-address')).toHaveText('HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk');
    await expect(p.locator('#rd-hold')).toBeDisabled();
    await shot(p, 'damaged-remove-idle', {ready: p.locator('#rd-cancel')});
    const fromRemoval = await save(p, '#rd-save');
    expect(fromRemoval.bytes.equals(fromState.bytes)).toBe(true);
    await p.fill('#rd-word', 'DEL');
    await shot(p, 'damaged-remove-partial', {ready: p.locator('#rd-cancel')});
    await p.fill('#rd-word', 'DELETE');
    await expect(p.locator('#rd-matched')).toBeVisible();
    await shot(p, 'damaged-remove-matched', {ready: p.locator('#rd-hold')});
    // Released before the full second: nothing removed. The clock then runs on past the full second — a hold still
    // counting would complete now — and the button is still armed: a confirmation disables it in the same tick, before
    // the removal is sent, so this is the signal that none happened (storage alone could be read before a removal lands).
    await hold(p, HOLD_MS - 300);
    await p.clock.runFor(HOLD_MS);
    await expect(p.locator('#rd-hold')).toBeEnabled();
    expect(await storedText(sw)).toBe(text);
    expect((await sw.evaluate(() => chrome.storage.local.get('v1_phishing_phrase'))).v1_phishing_phrase).toBe('Blue horse 42');
    // Held mid-way: the count and the fill, shot under the paused clock.
    await p.locator('#rd-hold').hover();
    await p.mouse.down();
    await p.clock.runFor(600);
    await expect(p.locator('#rd-hold')).toContainText('Hold to delete · 0.');
    await shot(p, 'damaged-remove-holding', {fullPage: false});
    await p.clock.runFor(HOLD_MS);
    await p.mouse.up();
    await expect(p).toHaveURL(/unlock\.html\?mode=welcome$/, {timeout: 30_000});
    await expect(p.locator('#wel-create')).toBeVisible();
    const left = await sw.evaluate(() => chrome.storage.local.get(null));
    expect(Object.keys(left).filter(k => ['v1_vault', 'v1_settings', 'v1_contacts', 'v1_phishing_phrase'].includes(k))).toEqual([]);

    // Refused by this version (v: 2): the state says "update", offers Save and no removal; the removal URL offers none.
    const refused = {...env, v: 2};
    await sw.evaluate(v => chrome.storage.local.set({v1_vault: v}), refused);
    p = await vaultPage(ctx, id, 'unlock.html');
    await expect(p.locator('#dmg-refused')).toHaveText('Update Noctura to open this wallet', {timeout: 60_000});
    await expect(p.locator('#dmg-refused-body p').first()).toHaveText("This version of Noctura can't open this wallet's data.");
    await expect(p.locator('#dmg-remove')).toBeHidden();
    await shot(p, 'damaged-09-refused');
    expect((await save(p, '#dmg-save')).bytes.toString('utf8')).toBe(await storedText(sw));
    await p.goto(`chrome-extension://${id}/unlock.html?mode=remove-damaged`);
    await expect(p.locator('#dmg-refused')).toBeVisible();
    await expect(p.locator('#rd-entry')).toBeHidden();
    expect(JSON.parse((await storedText(sw)) ?? 'null')).toEqual(JSON.parse(JSON.stringify(refused)));

    // A wallet: the removal URL says one exists and offers nothing.
    await sw.evaluate(v => chrome.storage.local.set({v1_vault: v}), env);
    await p.goto(`chrome-extension://${id}/unlock.html?mode=remove-damaged`);
    await expect(p.locator('#rd-notice-line')).toHaveText('A wallet already exists in this browser. Nothing was changed.');
    await expect(p.locator('#rd-hold')).toBeHidden();
    await shot(p, 'damaged-remove-wallet');
    expect(JSON.parse((await storedText(sw)) ?? 'null')).toEqual(JSON.parse(JSON.stringify(env)));

    // No readable address (a stored null).
    await sw.evaluate(() => chrome.storage.local.set({v1_vault: null}));
    await p.goto(`chrome-extension://${id}/unlock.html?mode=remove-damaged`);
    await expect(p.locator('#rd-no-address')).toHaveText("The address can't be read");
    await shot(p, 'damaged-remove-no-address', {ready: p.locator('#rd-cancel')});

    expect(nocTura.hits).toEqual([]);
    expect(solscan.hits).toEqual([]);
  } finally {
    await ctx.close();
    rmSync(profile, {recursive: true, force: true});
  }
});

test('the removal without holding (B1e §3, E11): DELETE, the checkbox by the keyboard (Enter on it nothing, Space checks it), one click removes; unchecked again a click removes nothing', async () => {
  const {ctx, profile} = await launchContained('noctura-e2e-damaged-checkbox-');
  const nocTura = await containNocTura(ctx);
  const solscan = await containSolscan(ctx);
  try {
    await expectContained(ctx);
    const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
    const id = new URL(sw.url()).host;
    const env = await makeEnvelope();
    await sw.evaluate(v => chrome.storage.local.set({v1_vault: v}), {...env, password: {wrapped: 'AAAA'}});
    const text = await storedText(sw);
    const p = await vaultPage(ctx, id, 'unlock.html?mode=remove-damaged');
    await expect(p.locator('#rd-entry')).toBeVisible({timeout: 60_000});
    const box = p.getByRole('checkbox', {name: 'I understand this permanently removes this wallet from this browser'});
    await expect(box).toBeHidden();
    await p.fill('#rd-word', 'DELETE');
    await expect(box).toBeVisible();
    await expect(box).not.toBeChecked();
    const button = p.locator('#rd-hold');
    // Unchecked: a click is not a hold. A confirmation would have disabled the button inside the click's own handler.
    await expect(p.getByRole('button', {name: 'Hold to delete'})).toBeEnabled();
    await button.click();
    await expect(button).toBeEnabled();
    await expect(p.locator('#rd-word')).toHaveValue('DELETE');
    // Keys on the checkbox: Enter changes nothing and removes nothing; Space checks it.
    await box.focus();
    await p.keyboard.press('Enter');
    await expect(box).not.toBeChecked();
    await expect(button).toBeEnabled();
    await p.keyboard.press(' ');
    await expect(box).toBeChecked();
    await expect(button).toBeEnabled();
    await expect(p.getByRole('button', {name: 'Remove damaged wallet'})).toBeEnabled();
    await expect(p.locator('#rd-caption')).toBeHidden();
    // The box comes before the button in tab order: Tab from the box lands on it.
    await p.keyboard.press('Tab');
    await expect(button).toBeFocused();
    await box.focus();
    await shot(p, 'damaged-remove-understood', {ready: p.locator('#rd-cancel')});
    // Unchecked again: the hold is back, a click removes nothing.
    await p.keyboard.press(' ');
    await expect(box).not.toBeChecked();
    await expect(p.getByRole('button', {name: 'Hold to delete'})).toBeEnabled();
    await expect(p.locator('#rd-caption')).toBeVisible();
    await button.click();
    await expect(button).toBeEnabled();
    expect(await storedText(sw)).toBe(text);
    // Checked: one click removes it.
    await box.check();
    await p.getByRole('button', {name: 'Remove damaged wallet'}).click();
    await expect(p).toHaveURL(/unlock\.html\?mode=welcome$/, {timeout: 30_000});
    expect(await storedText(sw)).toBeUndefined();

    expect(nocTura.hits).toEqual([]);
    expect(solscan.hits).toEqual([]);
  } finally {
    await ctx.close();
    rmSync(profile, {recursive: true, force: true});
  }
});
