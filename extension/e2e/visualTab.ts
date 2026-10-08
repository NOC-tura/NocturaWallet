import {expect, type Locator, type Page} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import type {Harness} from './popupHarness';

// The visual specs' shared helpers (B1b-2a plan 2's, moved here unchanged for B1b-2b's visual-settings.spec.ts).
export const DIR = 'test-results/visual';
/**
 * The whole column (`fullPage`), except while #3 is held: a full-page capture resizes the view under the
 * pressed pointer, which the page reads as a release (pointerleave) — those shots are the 412 × 916
 * viewport, which holds the whole grid.
 *
 * `ready`: a control the state shows enabled, awaited first — a click runs through the page's one busy
 * gate with its 500 ms floor (rule 6), and a shot taken inside that floor draws every button disabled,
 * which is not the state (Task 18 visual pass: 03-pre-reveal-modal, 39's steps and others were). A
 * full-page shot also moves the pointer off the column first, so no button is drawn hovered.
 */
export async function shot(page: Page, name: string, o: {fullPage?: boolean; ready?: Locator} = {}): Promise<void> {
  if (o.ready !== undefined) await expect(o.ready).toBeEnabled();
  const fullPage = o.fullPage ?? true;
  if (fullPage) await page.mouse.move(0, 0);
  mkdirSync(DIR, {recursive: true});
  await page.screenshot({path: `${DIR}/${name}.png`, fullPage});
}

/**
 * A vault-page tab at the mockups' size, with the clock installed (it follows real time until paused)
 * and the Argon2id worker's answer holdable: `holdKdf()` keeps the next KDF result back until
 * `releaseKdf()` — a test-only wrapper around this page's Worker, so "Creating your wallet…" and
 * "Waiting for your passkey…" stay on screen while they are asserted and shot.
 */
export async function vaultTab(h: Harness, path: string, o: {passkeyCreate?: 'null'} = {}): Promise<Page> {
  const page = await h.ctx.newPage();
  await page.setViewportSize({width: 412, height: 916});
  // A settled blank document first: installing the clock into a page still being created failed once
  // ("Cannot read properties of undefined (reading 'controller')", fix round 1 run).
  await page.goto('about:blank');
  await page.clock.install();
  await page.addInitScript(stub => {
    type Held = {hold: boolean; queue: (() => void)[]};
    const state: Held = {hold: false, queue: []};
    const w = window as unknown as {__kdf: Held; Worker: typeof Worker};
    w.__kdf = state;
    const Native = w.Worker;
    w.Worker = class extends Native {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        let handler: ((e: MessageEvent) => void) | null = null;
        super.onmessage = (e: MessageEvent) => {
          if (state.hold) state.queue.push(() => handler?.(e));
          else handler?.(e);
        };
        Object.defineProperty(this, 'onmessage', {set: (f: (e: MessageEvent) => void) => void (handler = f), get: () => handler});
      }
    } as typeof Worker;
    if (stub === 'null') Object.defineProperty(navigator, 'credentials', {value: {create: async () => null, get: async () => null}});
  }, o.passkeyCreate ?? '');
  await page.goto(`chrome-extension://${h.id}/${path}`);
  return page;
}
export const holdKdf = (p: Page) => p.evaluate(() => void ((window as unknown as {__kdf: {hold: boolean}}).__kdf.hold = true));
export const releaseKdf = async (p: Page) => {
  // The hold relies on kdf.ts assigning `worker.onmessage`. Were it to use addEventListener, nothing
  // would be held and the "creating" / "adding" shots would race the answer — so the held answer must
  // be there before it is released, and the spec fails loudly otherwise (plan-2 review L6).
  await expect.poll(() => p.evaluate(() => (window as unknown as {__kdf: {queue: unknown[]}}).__kdf.queue.length), {timeout: 60_000}).toBe(1);
  await p.evaluate(() => {
    const k = (window as unknown as {__kdf: {hold: boolean; queue: (() => void)[]}}).__kdf;
    k.hold = false;
    k.queue.splice(0).forEach(f => f());
  });
};
