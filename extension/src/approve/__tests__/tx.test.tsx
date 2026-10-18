// @vitest-environment happy-dom
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import {ed25519} from '@noble/curves/ed25519.js';
import {base64} from '@scure/base';
import {PublicKey, VersionedTransaction} from '@solana/web3.js';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {handleMessage} from '../../background/messages';
import {setSession} from '../../background/session';
import {readDappSession} from '../../background/dapp/store';
import {GRANTS_KEY} from '../../background/dapp/grants';
import {openPage} from '../../background/dapp/__tests__/pageHarness';
import {ACCOUNT, RECIPIENT} from '../../background/__tests__/fixtures';
import {ME, TO, assign, ataCreate, coSigned, mintTo, setAuthorityToNone, tokenApprove, tokenTransfer, transfer, v0} from '../../background/dapp/__tests__/txHarness';
import {U64_MAX, tokenAccountBytes, usdcLikeMint} from '../../background/dapp/__tests__/tokenBytes';
import {ATA_PROGRAM, TOKEN_2022_PROGRAM, TOKEN_PROGRAM} from '../../background/dapp/decode/decode';
import {dependsOnStep, pendingOf, type Flag, type RequestView} from '../client';
import {POLL_MS} from '../Approve';
import {Tx} from '../Tx';
import {ARM_MS, FLAG_HOLD_MS} from '../useArmed';
import {CONFIRM_DELAY_MS} from '../ui';
import {SECOND, acted, elapse, onHarnessClock, openWindow, settled} from './windowHarness';

const SELECTORS = selectorsOf(UI_SHEETS);
const text = (sel: string) => document.querySelector(sel)?.textContent ?? null;
const texts = (sel: string) => [...document.querySelectorAll(sel)].map(e => e.textContent);
const cta = (name: string | RegExp) => screen.getByRole('button', {name}) as HTMLButtonElement;
const unstyled = () => unstyledClasses(document.querySelector('.app-approve')!, SELECTORS);
/** A rule's declarations in the hand-written app.css (its exact selector), for the values the design draws. */
const cssRule = (selector: string): string => {
  const css = readFileSync(join(__dirname, '..', '..', 'app', 'app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
  const at = css.split('}').find(r => r.split('{')[0]?.split(',').some(sel => sel.trim() === selector));
  return at === undefined ? '' : (at.split('{')[1] ?? '').replace(/\s+/g, ' ').trim();
};
/** The recipient is known (no first-send re-authentication) unless a test says otherwise. */
const known = (w: Awaited<ReturnType<typeof openWindow>>) => w.ext.local.set('v1_known_recipients', [{address: RECIPIENT, at: 1}]);
onHarnessClock();
/**
 * The window learns by polling (§2.3): its first read starts the simulation (the background runs it outside the read);
 * this waits — deterministically, on the background's own state — until the simulation is stored, then gives the window
 * the read it would make on its next poll (a focus, as a user returning to the window), and waits for it to render.
 */
async function simulated(w: Awaited<ReturnType<typeof openWindow>>, shows: string): Promise<void> {
  await settled(async () => expect((await readDappSession(w.ext)).queue[0]?.sim ?? null).not.toBeNull());
  await acted(() => window.dispatchEvent(new Event('focus')));
  await settled(() => screen.getAllByText(shows));
}

/**
 * Review 2 L11: the file's cold start — its module graph's first evaluation and the window's first renders — runs once
 * here, in a hook of its own (vitest's hook budget), not inside the first test's 5 s. A plain transfer to a known
 * recipient, shown until it is simulated and then unmounted: no assertion of any test depends on it, and each test still
 * opens its own window against its own fresh background. It runs before the file's clock is faked (beforeEach), on real
 * timers, and waits only on what the window renders (`settled`, a count of real turns).
 */
beforeAll(async () => {
  const w = await openWindow();
  await known(w);
  await w.signTx('https://jup.ag', [v0([transfer(1_000_000)])]);
  w.show();
  await simulated(w, 'Balance changes (post-simulation)');
  cleanup();
});

// Spec B1c §3.3, #48 (index.html ix:18261-18705), against the real background.
describe('#48 dapp-tx-approval', () => {
  it('simulating-blocking, then simulated: the banner and skeleton, Approve disabled; then the changes beside the decoded instructions, the fee, the origin pill — Approve held 500 ms, then signed', async () => {
    const w = await openWindow();
    await known(w);
    // The simulation answers only when released: the blocking state is held, never slept through.
    const reader = w.deps.reader;
    let release!: () => void;
    const gate = new Promise<void>(r => (release = r));
    const simulate = reader.simulateTransaction;
    reader.simulateTransaction = async (...a) => {
      await gate;
      return simulate(...a);
    };
    // 0.001 SOL to a known recipient: no re-authentication rule fires (under 5 %, under $100).
    const {page, requestId} = await w.signTx('https://jup.ag', [v0([transfer(1_000_000)])]);
    w.show();
    await settled(() => screen.getByText('Simulating transaction…'));
    expect([text('.top-bar .title'), text('.s9-sim-banner .meta')]).toEqual(['Approve transaction', 'Noctura server · simulateTransaction']);
    expect(text('.s9-bal-card .label')).toBe('Balance changes (waiting…)');
    expect(document.querySelector('.s9-bal-card')?.className).toBe('s9-bal-card app-busy-dim');
    // The instructions are shown while simulating (decoded locally).
    expect(texts('.s9-payload-card > .app-tx-ix .row .k')).toEqual(['Program 1', 'instruction', 'from', 'to', 'lamports']);
    // Fix round 1 (promoted minor 3, R5): Compute units / Network fee are computed locally — shown while still
    // simulating too (the limit and the fee do not need a live answer; only "consumed" does, so it reads "—").
    expect(texts('.s9-payload-card > .row .k')).toEqual(['Compute units', 'Network fee']);
    expect(texts('.s9-payload-card > .row .v')).toEqual(['— / 200 000', '0.000005 SOL']);
    expect(text('.app-tx-caption')).toBe('Simulation runs against the current slot before you see Approve. This is mandatory — no skip.');
    // Review 1 L7: who broadcasts — for signTransaction, the site.
    expect(text('.app-tx-sends')).toBe('The site sends this transaction itself after you approve.');
    const pending = cta(/Approve/);
    expect([pending.textContent, pending.disabled]).toEqual(['Approve· simulating', true]);
    // Final review MUST-FIX 2: drawn at .4 while simulating (ix:18318) — its own class, only in this state.
    expect(pending.className).toBe('btn btn-primary app-cta-wide app-cta-simulating');
    // ✕ disabled during the simulation, as drawn; Reject open.
    expect([cta('Close').disabled, cta('Reject').disabled]).toEqual([true, false]);
    expect(unstyled()).toEqual([]);
    release();
    await simulated(w, 'Balance changes (post-simulation)');
    expect(cta('Approve').className).toBe('btn btn-primary app-cta-wide');
    expect(texts('.s9-bal-row .pri')).toEqual(['SOL']);
    expect(texts('.s9-bal-row .delta')).toEqual(['−0.001005']);
    expect(texts('.s9-bal-row .fiat')).toEqual(['$0.15']);
    expect(texts('.s9-payload-card .row .k')).toEqual(['Program 1', 'instruction', 'from', 'to', 'lamports', 'Compute units', 'Network fee']);
    expect(text('.s9-payload-card .app-tx-addr-label')).toBe('Your account: Main');
    expect(texts('.s9-payload-card > .row .v')).toEqual(['450 / 200 000', '0.000005 SOL']);
    expect(text('.s9-origin-pill .body')).toBe('Request from jup.ag · matches active session');
    expect(document.querySelector('.s9-sim-banner')).toBeNull();
    expect(unstyled()).toEqual([]);
    expect(cta('Approve').disabled).toBe(true);
    await elapse(ARM_MS);
    fireEvent.click(cta('Approve'));
    await settled(() => expect(w.closed.n).toBe(1));
    const signed = (page.answersFor(requestId)[0]?.result as {signed: string[]}).signed;
    const tx = VersionedTransaction.deserialize(base64.decode(signed[0] ?? ''));
    expect(ed25519.verify(tx.signatures[0] ?? new Uint8Array(), tx.message.serialize(), ME.toBytes())).toBe(true);
    // The harness's closed window reads nothing more (rev 2 dry run): a later focus never counts a second close.
    await acted(() => window.dispatchEvent(new Event('focus')));
    expect(w.closed.n).toBe(1);
  });

  it('a batch: each transaction’s section on one screen, approved as a whole; a co-signer’s fee is not this account’s', async () => {
    const w = await openWindow();
    await known(w);
    await w.signTx('https://jup.ag', [v0([transfer(1)]), coSigned()]);
    w.show();
    await simulated(w, 'Balance changes (post-simulation)');
    expect(texts('.app-tx-batch')).toEqual(['Transaction 1 of 2', 'Transaction 2 of 2']);
    // The co-signed one: the dApp pays the fee — no Network fee row in its section.
    const sections = [...document.querySelectorAll('.app-tx-item')];
    expect(sections.map(sec => [...sec.querySelectorAll('.s9-payload-card > .row .k')].map(k => k.textContent))).toEqual([
      ['Compute units', 'Network fee'],
      ['Compute units'],
    ]);
    expect(unstyled()).toEqual([]);
  });

  it('couldn’t simulate, an unreachable proxy, an expired blockhash (Q21): the reason, and only Reject', async () => {
    for (const [err, down, head, line] of [
      [{InstructionError: [0, {Custom: 1}]}, false, "Couldn't simulate", '{"InstructionError":[0,{"Custom":1}]}'],
      [null, true, "Couldn't simulate", 'Could not reach the Noctura server.'],
      ['BlockhashNotFound', false, 'This request has expired. Ask the site to try again.', null],
    ] as const) {
      cleanup();
      const w = await openWindow();
      w.chain.err = err;
      w.chain.down = down;
      await w.signTx('https://jup.ag', [v0()]);
      w.show();
      await simulated(w, head);
      if (line !== null) expect(texts('.s9-flag-banner.danger .body, .s9-flag-banner.danger .meta')).toEqual([line]);
      expect(screen.queryByRole('button', {name: /Approve/})).toBeNull();
      expect(cta('Reject').disabled).toBe(false);
      expect(document.querySelector('.s9-bal-card')).toBeNull();
      expect(unstyled()).toEqual([]);
    }
  });

  it('re-authentication (B1b’s rules, D11): the line before Approve; Approve asks, the window points to the toolbar, Approve waits; proven → it signs', async () => {
    const w = await openWindow();
    const {page, requestId} = await w.signTx('https://jup.ag', [v0([transfer(1_000_000)])]);
    w.show();
    await simulated(w, "Approving asks you to confirm with your password (or passkey) — you'll start it from the Noctura icon.");
    await elapse(ARM_MS);
    fireEvent.click(cta('Approve'));
    await settled(() => screen.getByText("Confirm it's you"));
    expect(text('.s9-flag-banner.warn .body')).toBe("Click the Noctura icon in your browser's toolbar and confirm with your password (or passkey). This request will wait here.");
    // The window never links into the vault page: no link, no input of any kind.
    expect(document.querySelectorAll('a, input, select, textarea')).toHaveLength(0);
    await elapse(ARM_MS);
    expect(cta('Approve').disabled).toBe(true);
    const challengeId = String((await readDappSession(w.ext)).queue[0]?.challengeId);
    await handleMessage(w.ext, {type: 'vault.reauthOk', challengeId}, {id: w.ext.runtimeId, origin: w.ext.extensionOrigin, url: `${w.ext.extensionOrigin}/unlock.html`}, w.deps);
    await acted(() => document.dispatchEvent(new Event('visibilitychange')));
    await settled(() => expect(screen.queryByText("Confirm it's you")).toBeNull());
    await elapse(ARM_MS);
    fireEvent.click(cta('Approve'));
    await settled(() => expect(w.closed.n).toBe(1));
    expect(page.answersFor(requestId)).toHaveLength(1);
  });

  it('a lookalike origin: no origin pill, the banner, [Reject and report] primary, "Approve anyway (not recommended)" → the 2-second confirm → signed', async () => {
    const w = await openWindow();
    await known(w);
    const {page, requestId} = await w.signTx('https://tensr.trade', [v0()]);
    w.show();
    await simulated(w, 'Balance changes (post-simulation)');
    expect(text('.top-bar .title')).toBe('Suspicious origin');
    expect(document.querySelector('.s9-origin-pill')).toBeNull();
    expect(text('.s9-domain-warn .body b')).toBe('This domain is not tensor.trade');
    expect(cta('Reject and report').className).toBe('btn btn-destructive');
    await elapse(ARM_MS);
    fireEvent.click(cta('Approve anyway (not recommended)'));
    const sheet = await settled(() => screen.getByRole('dialog', {name: 'We strongly recommend rejecting. Continue?'}));
    // The 2-second confirm itself (Task 9 fix round 1, I1): C15's hold is long past at 1 999 ms, so only the delay holds it.
    await elapse(CONFIRM_DELAY_MS - 1);
    expect((within(sheet).getByRole('button', {name: 'I understand the risk'}) as HTMLButtonElement).disabled).toBe(true);
    await elapse(1);
    fireEvent.click(within(sheet).getByRole('button', {name: 'I understand the risk'}));
    await settled(() => expect(w.closed.n).toBe(1));
    expect((page.answersFor(requestId)[0]?.result as {signed: string[]}).signed).toHaveLength(1);
    expect(unstyled()).toEqual([]);
  });

  it('signAndSendTransaction: "Noctura sends this transaction as soon as you approve." under the origin (review 1 L7)', async () => {
    const w = await openWindow();
    await known(w);
    await w.signTx('https://jup.ag', [v0()], {send: true});
    w.show();
    await simulated(w, 'Balance changes (post-simulation)');
    expect(text('.app-tx-sends')).toBe('Noctura sends this transaction as soon as you approve.');
    expect(unstyled()).toEqual([]);
  });

  it('no balance change of the account’s: "No SOL or token balance changes — review the instructions below." (review 1 L3)', async () => {
    const w = await openWindow();
    await known(w);
    // The dApp pays the fee; the account signs a transfer of nothing.
    await w.signTx('https://jup.ag', [coSigned([transfer(0, ME)])]);
    w.show();
    await simulated(w, 'Balance changes (post-simulation)');
    expect(text('.app-tx-none')).toBe('No SOL or token balance changes — review the instructions below.');
    expect(texts('.s9-bal-row')).toEqual([]);
  });

  it('a refresh that lands between the read and the click (stale): the line says why, the new effects are shown, Approve is held again (review 1 L4)', async () => {
    const STALE = 'The transaction changed while you were reviewing. Review it again before approving.';
    const w = await openWindow();
    await known(w);
    const {page, requestId} = await w.signTx('https://jup.ag', [v0()]);
    w.show();
    await simulated(w, 'Balance changes (post-simulation)');
    await elapse(ARM_MS);
    const first = (await readDappSession(w.ext)).queue[0]?.sim;
    w.deps.clock.t += 30_000;
    // The window's read starts the refresh in the background; the window still shows the first simulation.
    await acted(() => document.dispatchEvent(new Event('visibilitychange')));
    await settled(async () => expect((await readDappSession(w.ext)).queue[0]?.sim).not.toEqual(first));
    expect(screen.queryByText(STALE)).toBeNull();
    fireEvent.click(cta('Approve'));
    await settled(() => screen.getByText(STALE));
    expect(page.answersFor(requestId)).toEqual([]);
    expect(cta('Approve').disabled).toBe(true);
    expect(unstyled()).toEqual([]);
    // The next click (after the hold) approves the simulation now shown, and the line goes.
    await elapse(ARM_MS);
    fireEvent.click(cta('Approve'));
    await settled(() => expect(w.closed.n).toBe(1));
    expect(page.answersFor(requestId)).toHaveLength(1);
  });

  // Final review I3: a simulation that is merely SIM_VALID_MS old (its refresh has not landed — the proxy is slow) is
  // refused `out-of-date`, and the window says so truthfully — never "the transaction changed". The line goes once the
  // refreshed simulation is shown; that one then approves.
  it('the newest simulation grown old while its refresh is slow (out-of-date): its own line, never the “changed” one; the refresh lands, the line goes, Approve signs', async () => {
    const STALE = 'The transaction changed while you were reviewing. Review it again before approving.';
    const OLD = 'This simulation is out of date. Wait a moment for it to refresh.';
    const w = await openWindow();
    await known(w);
    const {page, requestId} = await w.signTx('https://jup.ag', [v0()]);
    w.show();
    await simulated(w, 'Balance changes (post-simulation)');
    await elapse(ARM_MS);
    const first = (await readDappSession(w.ext)).queue[0]?.sim;
    // The refresh is held (a slow proxy): the stored simulation stays the first one while the clock passes 40 s.
    let release!: () => void;
    const gate = new Promise<void>(r => (release = r));
    const simulate = w.deps.reader.simulateTransaction;
    w.deps.reader.simulateTransaction = async (...a) => {
      await gate;
      return simulate(...a);
    };
    w.deps.clock.t += 40_000;
    fireEvent.click(cta('Approve'));
    await settled(() => screen.getByText(OLD));
    expect(screen.queryByText(STALE)).toBeNull();
    expect(page.answersFor(requestId)).toEqual([]);
    expect((await readDappSession(w.ext)).queue[0]?.sim).toEqual(first);
    expect(unstyled()).toEqual([]);
    // The window's read starts the (held) refresh; it lands; the window's next read shows it: the line goes, Approve
    // is held, then signs.
    await acted(() => document.dispatchEvent(new Event('visibilitychange')));
    release();
    await settled(async () => expect((await readDappSession(w.ext)).queue[0]?.sim).not.toEqual(first));
    await acted(() => window.dispatchEvent(new Event('focus')));
    await settled(() => expect(screen.queryByText(OLD)).toBeNull());
    expect(screen.queryByText(STALE)).toBeNull();
    await elapse(ARM_MS);
    fireEvent.click(cta('Approve'));
    await settled(() => expect(w.closed.n).toBe(1));
    expect(page.answersFor(requestId)).toHaveLength(1);
  });

  it('C15: a new simulation re-holds Approve; Enter never approves', async () => {
    const w = await openWindow();
    await known(w);
    const {page, requestId} = await w.signTx('https://jup.ag', [v0()]);
    w.show();
    await simulated(w, 'Balance changes (post-simulation)');
    await elapse(ARM_MS);
    expect(cta('Approve').disabled).toBe(false);
    fireEvent.keyDown(cta('Approve'), {key: 'Enter'});
    expect(page.answersFor(requestId)).toEqual([]);
    // A refresh lands (its id changes): the window's next read shows it, and Approve is held again in that render.
    const first = (await readDappSession(w.ext)).queue[0]?.sim;
    w.deps.clock.t += 30_000;
    // The window's read (a visibilitychange: no re-hold of its own) starts the refresh in the background.
    await acted(() => document.dispatchEvent(new Event('visibilitychange')));
    await settled(async () => expect((await readDappSession(w.ext)).queue[0]?.sim).not.toEqual(first));
    // A read that is not a focus (focus alone re-holds, C15): the window's own poll, run now.
    expect(cta('Approve').disabled).toBe(false);
    await acted(() => document.dispatchEvent(new Event('visibilitychange')));
    await settled(() => expect(cta('Approve').disabled).toBe(true));
  });

  it('approving: "Approving", the body at .65, "Approving…" with the ring, every CTA and ✕ disabled', async () => {
    const w = await openWindow();
    await known(w);
    await w.signTx('https://jup.ag', [v0()]);
    const send = w.client.decide;
    w.client.decide = () => new Promise(() => undefined);
    w.show();
    await simulated(w, 'Balance changes (post-simulation)');
    await elapse(ARM_MS);
    fireEvent.click(cta('Approve'));
    await settled(() => screen.getByRole('button', {name: 'Approving…'}));
    expect(text('.top-bar .title')).toBe('Approving');
    expect(document.querySelector('.app-approve-scroll')?.className).toContain('app-tx-busy');
    expect([cta('Approving…').disabled, cta('Reject').disabled, cta('Close').disabled]).toEqual([true, true, true]);
    expect(unstyled()).toEqual([]);
    w.client.decide = send;
  });

  it('can no longer be signed (the account left the session): Q26 and only Reject', async () => {
    const w = await openWindow();
    await w.signTx('https://jup.ag', [v0()]);
    // The granted account leaves the unlocked session (the other account stays): its detail cannot be built.
    await setSession(w.ext, [SECOND]);
    w.show();
    await settled(() => screen.getByText('This request can no longer be signed. Reject it and ask the site to try again.'));
    expect(screen.getAllByRole('button').map(b => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Close', 'Reject']);
    // Final review MUST-FIX 2: Q26 is a danger flag banner, as Q21 is — never a plain lede.
    expect([text('.s9-flag-banner.danger .head'), document.querySelector('.s9-flag-banner.danger')?.getAttribute('role')]).toEqual(['This request can no longer be signed. Reject it and ask the site to try again.', 'alert']);
    expect(document.querySelector('.app-approve-lede')).toBeNull();
    expect(unstyled()).toEqual([]);
  });

  // Final review MUST-FIX 2 (design binding): the origin tile of a verified site in the brand gradient the design draws
  // for it (#48 ix:18283 Jupiter, #46/#47 Magic Eden, Tensor; #49's own for Drift and Kamino); any other verified site
  // keeps the accent tile, and an unknown or lookalike host never gets a brand's colours (nothing vouches for it).
  // B1c-3 (plan 3 Task 9): one window per test — five windows against the real background in one test outran vitest's 5 s
  // budget on a CPU-starved runner (the work of five tests in one).
  it.each([
    ['https://jup.ag', 'ico app-ico-verified app-brand-jupiter'],
    ['https://tensor.trade', 'ico app-ico-verified app-brand-tensor'],
    ['https://raydium.io', 'ico app-ico-verified'],
    ['https://tensr.trade', 'ico app-ico-lookalike'],
    ['https://dapp.test', 'ico app-ico-unknown'],
  ] as const)('origin tiles: %s → %s (Jupiter in its drawn gradient; another verified site the accent tile; a lookalike no brand)', async (origin, cls) => {
    const w = await openWindow();
    await known(w);
    await w.signTx(origin, [v0()]);
    w.show();
    await simulated(w, 'Balance changes (post-simulation)');
    expect(document.querySelector('.s9-origin-card .ico')?.className).toBe(cls);
    expect(unstyled()).toEqual([]);
  });

  it('origin tiles: the brand rules — Jupiter’s drawn gradient, Tensor in one colour', () => {
    expect(cssRule('.s9-origin-card .ico.app-brand-jupiter')).toContain('linear-gradient(135deg, #FFC800, #FF7A00)');
    // B1c-3 (R9, controller): Tensor in one colour — #49's (the design's latest), on #46/#47/#48's tile too, never the
    // window mockups' cyan; #49's own two tiles keep it.
    const tensor = 'background: linear-gradient(135deg, oklch(72% 0.18 295), oklch(65% 0.16 320));';
    expect([cssRule('.s9-origin-card .ico.app-brand-tensor'), cssRule('.s10-sheet .head-row .ico.app-tile-tensor')]).toEqual([tensor, tensor]);
    const ext = readFileSync(join(__dirname, '..', '..', 'styles', 'design-ext.css'), 'utf8');
    expect(ext).toContain(`.s10-app-row .ico.tensor { ${tensor} }`);
    expect(cssRule('.s9-origin-card .ico.app-brand-tensor')).not.toContain('#00DBFF');
  });

  it('the design minors’ own rules: Approve at .4 while simulating; "I understand the risk" never wraps', async () => {
    expect(cssRule('.sticky-bar .btn.app-cta-simulating[disabled]')).toContain('opacity: 0.4');
    expect(cssRule('.app-risk-actions .btn.app-nowrap')).toContain('white-space: nowrap');
    const w = await openWindow();
    await known(w);
    await w.signTx('https://tensr.trade', [v0()]);
    w.show();
    await simulated(w, 'Balance changes (post-simulation)');
    await elapse(ARM_MS);
    fireEvent.click(cta('Approve anyway (not recommended)'));
    const sheet = await settled(() => screen.getByRole('dialog', {name: 'We strongly recommend rejecting. Continue?'}));
    expect(within(sheet).getByRole('button', {name: 'I understand the risk'}).className).toBe('btn btn-destructive app-nowrap');
  });

  // Fix round 1, I1: `{kind: 'none'}` (a legitimate protocol-level absence) used to be rejected by the window's own
  // parser (it only knew `{kind: 'address', value: null}`), so pendingOf returned null and the window stayed blank
  // (aria-busy) forever for any setAuthority-to-None, Token-2022 transfer-hook init/update, or similar instruction.
  it('a setAuthority to None renders — the window’s own "none" field is not an unresolved address (I1)', async () => {
    const w = await openWindow();
    await known(w);
    await w.signTx('https://jup.ag', [v0([setAuthorityToNone()])]);
    w.show();
    await simulated(w, 'Balance changes (post-simulation)');
    expect(texts('.s9-payload-card .row .k')).toEqual(['Program 1', 'instruction', 'account', 'currentAuthority', 'authorityType', 'newAuthority', 'Compute units', 'Network fee']);
    expect(text('.s9-payload-card .row:last-of-type .v')).not.toBeNull();
    const rows = [...document.querySelectorAll('.s9-payload-card .row')];
    const newAuthorityRow = rows.find(r => r.querySelector('.k')?.textContent === 'newAuthority');
    expect(newAuthorityRow?.querySelector('.v')?.textContent).toBe('—');
    expect(cta('Reject').disabled).toBe(false);
    expect(unstyled()).toEqual([]);
  });

  // Negative control (I1): a field value of a kind the parser does not recognize at all is still refused — the fix
  // for `none` did not loosen the fail-closed default branch next to it.
  it('a malformed field value (an unrecognized kind) is still refused — pendingOf fails closed (I1 negative control)', () => {
    const request = {
      requestId: 'x',
      type: 'signTransaction',
      origin: 'https://jup.ag',
      host: 'jup.ag',
      site: {kind: 'verified', name: 'Jupiter', imitates: null, rule: null, idn: null, international: false},
      offerBlock: false,
      connect: null,
      sign: null,
      mismatch: null,
      tx: {
        kind: 'signTransaction',
        account: {index: 0, name: 'Main', publicKey: ACCOUNT.publicKey},
        simulation: {status: 'simulating'},
        reauth: null,
        labels: [],
        transactions: [
          {
            version: 'legacy',
            feePayer: ACCOUNT.publicKey,
            unitLimit: null,
            feeLamports: null,
            outcome: null,
            flags: null,
            instructions: [{programId: null, program: null, name: null, fields: [{name: 'x', value: {kind: 'bogus'}}]}],
          },
        ],
      },
    };
    // B1c-3: a transaction detail the window cannot read is no detail — Q26 and only Reject, never a blank window.
    const read = pendingOf({state: 'request', waiting: 0, windowNotice: false, request});
    expect(read?.state === 'request' ? read.request.tx : 'unread').toBeNull();
  });

  // B1c-3: the window's own list of re-authentication reasons (one of the four places a reason is named), the
  // dependent step's outcome (F10) and every red flag — read strictly, like everything else the background sends; a
  // detail it cannot read is refused whole (Q26, only Reject), never shown with a flag or a reason dropped.
  const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  const ok = {ok: true, changes: [], unitsConsumed: 1, unitLimit: 200_000, feeLamports: '5000'};
  const dependentOutcome = {ok: false, error: 'dependent', on: 1, detail: '{"InstructionError":[0,"InvalidAccountData"]}'};
  const DEPENDENT = {kind: 'dependent', severity: 'block', word: 'UNCHECKED', at: null, step: 1};
  /** Every kind redFlagsOf gives, as the background's view sends it (signTx.ts txDetail). */
  const EVERY_FLAG = [
    {kind: 'assign', severity: 'block', word: 'ASSIGN', at: 0, instructions: [{index: 0, program: 'system', name: 'assign'}], chain: {owner: RECIPIENT, space: 0}},
    {kind: 'set-authority', severity: 'block', word: 'AUTHORITY', at: 1, instructions: [{index: 1, program: 'token', account: RECIPIENT, owned: 'token-account', authorityType: 'accountOwner', newAuthority: null}], chain: [{account: RECIPIENT, change: 'owner', from: ACCOUNT.publicKey, to: RECIPIENT}]},
    {kind: 'unlimited-approve', severity: 'block', word: 'USDC', at: 2, approvals: [{at: 2, source: RECIPIENT, mint: USDC_MINT, symbol: 'USDC', decimals: 6, delegate: RECIPIENT, amount: '18446744073709551615', balance: '5'}]},
    {kind: 'unlimited-approve', severity: 'block', word: 'ALLOWANCE', at: null, approvals: [{at: null, source: RECIPIENT, mint: null, symbol: null, decimals: null, delegate: null, amount: '5', balance: '5'}]},
    {kind: 'unknown-program', severity: 'warn', word: null, at: 0, programs: [RECIPIENT, null]},
    {kind: 'non-transfer', severity: 'warn', word: null, at: 0, instructions: [{index: 0, program: 'system', name: 'assign'}, {index: 3, program: 'token', name: null}]},
    {kind: 'bounded-approve', severity: 'warn', word: null, at: 2, approvals: [{at: 2, source: RECIPIENT, mint: RECIPIENT, symbol: null, decimals: 0, delegate: RECIPIENT, amount: '4', balance: '5'}]},
    {kind: 'token-2022', severity: 'warn', word: null, at: null, mint: RECIPIENT, settings: {freezeAuthority: RECIPIENT, permanentDelegate: null, transferHookProgram: RECIPIENT}},
    {kind: 'token-2022', severity: 'warn', word: null, at: 4, mint: USDC_MINT, settings: null},
    {kind: 'durable-nonce', severity: 'warn', word: null, at: 0},
    {kind: 'whole-balance', severity: 'warn', word: null, at: null},
  ];
  /** A two-step batch: step 1 as given, step 2 (dependent on step 1 unless said otherwise) with its flags. */
  const batchView = (o: {reasons?: unknown[]; first?: unknown; second?: unknown; outcome?: unknown; firstOutcome?: unknown}) => ({
    state: 'request',
    waiting: 0,
    windowNotice: false,
    request: {
      requestId: 'x',
      type: 'signTransaction',
      origin: 'https://jup.ag',
      host: 'jup.ag',
      site: {kind: 'verified', name: 'Jupiter', imitates: null, rule: null, idn: null, international: false},
      offerBlock: false,
      connect: null,
      sign: null,
      mismatch: null,
      tx: {
        kind: 'signTransaction',
        account: {index: 0, name: 'Main', publicKey: ACCOUNT.publicKey},
        simulation: {status: 'ok', id: 'AAAAAAAAAAAAAAAAAAAAAA', slot: 1, elapsedMs: 1, at: 1},
        reauth: {reasons: o.reasons ?? ['first-send', 'override'], state: 'needed'},
        labels: [],
        transactions: [
          {version: 0, feePayer: ACCOUNT.publicKey, unitLimit: null, feeLamports: null, outcome: 'firstOutcome' in o ? o.firstOutcome : ok, instructions: [], flags: 'first' in o ? o.first : []},
          {version: 0, feePayer: ACCOUNT.publicKey, unitLimit: null, feeLamports: null, outcome: 'outcome' in o ? o.outcome : dependentOutcome, instructions: [], flags: 'second' in o ? o.second : [DEPENDENT]},
        ],
      },
    },
  });
  const txOf = (x: unknown) => {
    const read = pendingOf(x);
    return read?.state === 'request' ? read.request.tx : 'unread';
  };

  it('pendingOf: `override`, a dependent step’s outcome and every kind of flag are read exactly; dependsOnStep names the 1-based step', () => {
    const tx = txOf(batchView({first: EVERY_FLAG}));
    expect(tx === null || tx === 'unread' ? null : [tx.reauth?.reasons, tx.transactions.map(t => t.outcome), tx.transactions.map(t => t.flags)]).toEqual([
      ['first-send', 'override'],
      [ok, dependentOutcome],
      [EVERY_FLAG, [DEPENDENT]],
    ]);
    expect(tx === null || tx === 'unread' ? null : tx.transactions.map(dependsOnStep)).toEqual([null, 1]);
    // While simulating: no outcome, no flags.
    expect(txOf(batchView({first: null, firstOutcome: null, second: null, outcome: null}))).toMatchObject({transactions: [{flags: null}, {flags: null}]});
  });

  it('pendingOf refuses the whole detail (tx null → Q26) for an unknown reason, an unknown flag kind, a key more or less, a block’s wrong word, or a dependent step that disagrees with its outcome or names no earlier step', () => {
    const assign = EVERY_FLAG[0] as Record<string, unknown>;
    for (const bad of [
      batchView({reasons: ['overrides']}),
      batchView({first: [{kind: 'drain', severity: 'warn', word: null, at: 0}]}),
      batchView({first: [{...assign, extra: 1}]}),
      batchView({first: [Object.fromEntries(Object.entries(assign).filter(([k]) => k !== 'chain'))]}),
      batchView({first: [{...assign, word: 'assign'}]}),
      batchView({first: [{...assign, severity: 'warn'}]}),
      batchView({first: [{...(EVERY_FLAG[2] as Record<string, unknown>), word: 'BONK'}]}),
      batchView({first: [{...(EVERY_FLAG[4] as Record<string, unknown>), word: 'X'}]}),
      // Review 3 L14: UNLIMITED only when an approval is u64::MAX, ALLOWANCE only when none is.
      batchView({first: [{...(EVERY_FLAG[3] as Record<string, unknown>), word: 'UNLIMITED'}]}),
      batchView({first: [{...(EVERY_FLAG[2] as Record<string, unknown>), word: 'ALLOWANCE'}]}),
      batchView({first: [{...(EVERY_FLAG[9] as Record<string, unknown>), at: null}]}),
      batchView({first: [{...(EVERY_FLAG[7] as Record<string, unknown>), settings: {freezeAuthority: 'x'}}]}),
      batchView({first: 'none'}),
      batchView({second: [{...DEPENDENT, on: 0}]}),
      batchView({second: [{...DEPENDENT, step: 2}]}),
      batchView({second: []}),
      batchView({second: [DEPENDENT], outcome: ok}),
      batchView({second: [DEPENDENT, DEPENDENT]}),
      batchView({outcome: {...dependentOutcome, on: 2}}),
      batchView({outcome: {...dependentOutcome, on: 0}}),
      batchView({outcome: {ok: false, error: 'dependent', detail: 'x'}}),
      batchView({first: [{...DEPENDENT}], firstOutcome: {...dependentOutcome}}),
      batchView({second: null}),
      batchView({first: [], firstOutcome: null}),
    ]) {
      expect([bad, txOf(bad)]).toEqual([bad, null]);
    }
  });

  it('a detail refused for an unknown flag kind: Q26 and only Reject — never the request with the flag dropped', () => {
    const read = pendingOf(batchView({first: [{kind: 'drain', severity: 'warn', word: null, at: 0}]}));
    if (read?.state !== 'request') throw new Error('unread');
    render(<Tx request={read.request} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} />);
    expect(screen.getByText('This request can no longer be signed. Reject it and ask the site to try again.')).toBeTruthy();
    expect(screen.getAllByRole('button').map(b => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Close', 'Reject']);
  });

  // Fix round 1, I2: the sheet is for exactly the simulation it opened on; a refresh landing while it is open must
  // close it (or, if a captured click still slips in, the background refuses it `stale`) — never sign effects the
  // user never saw.
  it('a lookalike’s risk-confirm sheet closes when a refresh lands while it is open — nothing signed (I2)', async () => {
    const w = await openWindow();
    await known(w);
    const {page, requestId} = await w.signTx('https://tensr.trade', [v0()]);
    w.show();
    await simulated(w, 'Balance changes (post-simulation)');
    await elapse(ARM_MS);
    fireEvent.click(cta('Approve anyway (not recommended)'));
    await settled(() => screen.getByRole('dialog', {name: 'We strongly recommend rejecting. Continue?'}));
    // A refresh lands while the sheet is open (the window's own read starts it in the background).
    const first = (await readDappSession(w.ext)).queue[0]?.sim;
    w.deps.clock.t += 30_000;
    await acted(() => document.dispatchEvent(new Event('visibilitychange')));
    await settled(async () => expect((await readDappSession(w.ext)).queue[0]?.sim).not.toEqual(first));
    // The window reads it on its next poll (B1c-3 Task 9: on the harness's clock).
    expect(screen.queryByRole('dialog', {name: 'We strongly recommend rejecting. Continue?'})).not.toBeNull();
    await elapse(POLL_MS);
    await settled(() => expect(screen.queryByRole('dialog', {name: 'We strongly recommend rejecting. Continue?'})).toBeNull());
    expect(page.answersFor(requestId)).toEqual([]);
    expect(w.closed.n).toBe(0);
  });

  // Fix round 1, I3 (controller ruling, overrides plan R2's display): a known program's instruction the decoder
  // names but does not decode the fields of must never look fully decoded.
  it('mintTo (a known tag outside the decoded list): named, but marked "not decoded" (I3)', async () => {
    const w = await openWindow();
    await known(w);
    await w.signTx('https://jup.ag', [v0([mintTo()])]);
    w.show();
    await simulated(w, 'Balance changes (post-simulation)');
    expect(texts('.app-tx-ix .row .v')[1]).toBe('mintTo · Details not decoded — check them on the site before approving.');
    expect(texts('.s9-payload-card .row .k')).toEqual(['Program 1', 'instruction', 'Compute units', 'Network fee']);
  });

  // Fix round 1 (promoted minor 2): a v0 transaction whose lookup table is not yet resolved used to make the whole
  // instructions card vanish; it now says why, instead.
  it('a v0 transaction whose lookup table is not yet resolved: the card says why, instead of vanishing (promoted minor 2)', () => {
    const request: RequestView = {
      requestId: 'p',
      type: 'signTransaction',
      origin: 'https://jup.ag',
      host: 'jup.ag',
      site: {kind: 'verified', name: 'Jupiter', imitates: null, rule: null, idn: null, international: false},
      offerBlock: false,
      connect: null,
      sign: null,
      mismatch: null,
      tx: {
        kind: 'signTransaction',
        account: {index: 0, name: 'Main', publicKey: ACCOUNT.publicKey},
        simulation: {status: 'simulating'},
        reauth: null,
        labels: [],
        transactions: [{version: 0, feePayer: ACCOUNT.publicKey, instructions: null, unitLimit: null, feeLamports: null, outcome: null, flags: null}],
      },
    };
    render(<Tx request={request} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} />);
    expect(screen.getByText('Instructions appear once the transaction is simulated.')).toBeTruthy();
  });

  // Fix round 2 (Rules of Hooks): the I2 effect used to sit after the early `detail === null` return. `Tx` is keyed
  // by `requestId` (Approve.tsx) — the SAME mounted instance sees its `tx` go null → non-null or back, on the head's
  // own account leaving or rejoining the session (Q26), never a remount — so a hook after that return threw
  // "Rendered fewer/more hooks than expected" the moment it did, with nothing under src/approve to catch it: a blank
  // window. `rerender` on the same instance (never a fresh `render`) is what actually exercises this.
  it('the same <Tx> instance’s tx going non-null → null and back: no "Rendered fewer/more hooks" throw (fix round 2)', () => {
    const withTx: RequestView = {
      requestId: 'q26',
      type: 'signTransaction',
      origin: 'https://jup.ag',
      host: 'jup.ag',
      site: {kind: 'verified', name: 'Jupiter', imitates: null, rule: null, idn: null, international: false},
      offerBlock: false,
      connect: null,
      sign: null,
      mismatch: null,
      tx: {
        kind: 'signTransaction',
        account: {index: 0, name: 'Main', publicKey: ACCOUNT.publicKey},
        simulation: {status: 'simulating'},
        reauth: null,
        labels: [],
        transactions: [{version: 0, feePayer: ACCOUNT.publicKey, instructions: null, unitLimit: null, feeLamports: null, outcome: null, flags: null}],
      },
    };
    const withoutTx: RequestView = {...withTx, tx: null};
    const view = render(<Tx request={withTx} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} />);
    expect(screen.getByText('Simulating transaction…')).toBeTruthy();
    expect(() => view.rerender(<Tx request={withoutTx} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} />)).not.toThrow();
    expect(screen.getByText('This request can no longer be signed. Reject it and ask the site to try again.')).toBeTruthy();
    expect(() => view.rerender(<Tx request={withTx} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} />)).not.toThrow();
    expect(screen.getByText('Simulating transaction…')).toBeTruthy();
  });
});

// #48 "origin-mismatch · auto-reject" (ix:18484-18521).
describe('#48 origin-mismatch · auto-reject', () => {
  it('the design’s hero, banner and detail rows; [OK, return to dApp] only dismisses; no Approve; the page was answered unauthorized', async () => {
    const w = await openWindow();
    // jup.ag holds the grant; dapp.test asks to sign with that account.
    await w.ext.local.set(GRANTS_KEY, [{origin: 'https://jup.ag', account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: 1, lastUsedAt: 1, recent: []}]);
    const page = openPage(w.ext, w.deps, 'https://dapp.test', {tab: {id: 99}});
    expect(await page.ask({type: 'page.signTransaction', id: 'm', account: ACCOUNT.publicKey, transactions: [v0()]})).toEqual({id: 'm', error: 'unauthorized'});
    w.show();
    await settled(() => screen.getByText('Request blocked automatically'));
    expect([text('.top-bar .title'), document.querySelector('.top-bar .title')?.className]).toEqual(['Auto-rejected · Origin mismatch', 'title noc-overline noc-danger']);
    expect(text('.s9-fail-hero .sub')).toBe('A transaction came from a different origin than the one you connected. We rejected it without showing Approve.');
    expect(text('.s9-flag-banner .head')).toBe('Origin mismatch · auto-reject');
    expect(text('.s9-flag-banner .body')).toBe('A connected session for jup.ag received a transaction request from dapp.test. This is almost always a man-in-the-middle attempt. The request was dropped without prompting.');
    expect(texts('.s9-payload-card .row .k')).toEqual(['Active session', 'Request origin', 'Match', 'Action']);
    expect(texts('.s9-payload-card .row .v')).toEqual(['jup.ag', 'dapp.test', 'false', 'REJECT_NO_PROMPT']);
    expect(text('.app-tx-caption')).toBe('If you believe this is legitimate, disconnect the existing jup.ag session in Settings → Connected dApps and reconnect through the new domain explicitly. Never approve cross-origin transactions.');
    expect(screen.queryByRole('button', {name: /Approve|Review session/})).toBeNull();
    expect(unstyled()).toEqual([]);
    fireEvent.click(cta('OK, return to dApp'));
    await settled(() => expect(w.closed.n).toBe(1));
  });
});

// B1c-3 (spec §3.3 rev 3.6; index.html #48 state 2 "unlimited-spend · typed-confirm", ix:18325-18396): the background's
// red flags in each transaction's section, the typed fields, the red CTAs, the 1.5 s hold — against the real background.
describe('#48 red flags (B1c-3)', () => {
  const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  const SRC = new PublicKey(new Uint8Array(32).fill(81));
  const DELEGATE = new PublicKey(new Uint8Array(32).fill(82));
  const X = new PublicKey(new Uint8Array(32).fill(83));
  const Y = new PublicKey(new Uint8Array(32).fill(84));
  type W = Awaited<ReturnType<typeof openWindow>>;
  /** The account holds 250 USDC in SRC (a classic token account, owner field = the account); the USDC mint reads 6 decimals. */
  const holdUsdc = (w: W) => {
    w.chain.accounts.set(SRC.toBase58(), {lamports: 2_039_280n, owner: TOKEN_PROGRAM, data: tokenAccountBytes({mint: USDC, owner: ACCOUNT.publicKey, amount: 250_000_000n})});
    w.chain.accounts.set(USDC, {lamports: 1_461_600n, owner: TOKEN_PROGRAM, data: usdcLikeMint()});
  };
  const decided = (w: W) => w.sent.filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null && (m as {type?: unknown}).type === 'dapp.decide');
  const field = (word: string) => screen.getByLabelText(`Type ${word} to enable Approve`) as HTMLInputElement;
  const type = (word: string, value: string) => fireEvent.change(field(word), {target: {value}});
  const heads = (root: ParentNode = document) => [...root.querySelectorAll('.s9-flag-banner .head')].map(e => e.textContent);
  const sections = () => [...document.querySelectorAll('.app-tx-item')];
  /** A batch whose later step fails on an account an earlier one creates (F10's attribution, Task 3). */
  const dependentOn = (created: PublicKey) => (keys: string[]) => (keys.includes(created.toBase58()) && !keys.includes(ATA_PROGRAM) ? {InstructionError: [0, 'InvalidAccountData']} : null);

  it('an unlimited USDC approve (the design’s state 2): the eyebrow, the danger banner with the design’s copy, the delegated row, the typed field — exact, case-sensitive, never focused — "Approve unlimited" gated, then held 1.5 s; the words go with the approval, then #10, then signed', async () => {
    const w = await openWindow();
    holdUsdc(w);
    const {page, requestId} = await w.signTx('https://jup.ag', [v0([tokenApprove(SRC, DELEGATE, U64_MAX)])]);
    w.show();
    await simulated(w, 'Unlimited USDC spend approval');
    expect([text('.top-bar .title'), document.querySelector('.top-bar .title')?.className]).toEqual(['Critical · Unlimited spend approval', 'title noc-overline noc-danger']);
    // One banner, as the design draws it, in the transaction's section: F5 names the approve, so F2 does not repeat it
    // (the controller's ruling, plan 3 Task 6).
    expect([...document.querySelectorAll('.app-tx-item .s9-flag-banner')].map(b => b.className)).toEqual(['s9-flag-banner danger']);
    expect(heads()).toEqual(['Unlimited USDC spend approval']);
    const danger = document.querySelector('.s9-flag-banner.danger') as HTMLElement;
    expect(within(danger).getByText(/This transaction includes/).textContent).toBe(
      'This transaction includes a spl_token::Approve instruction with amount = u64::MAX (~18.4 quintillion units). Even verified dApps can be exploited; this lets the program move all your USDC, now and in the future, until you revoke.',
    );
    expect([...danger.querySelectorAll('.body code')].map(c => c.textContent)).toEqual(['spl_token::Approve', 'amount = u64::MAX']);
    expect(danger.querySelector('.body i')?.textContent).toBe('all your USDC');
    expect(danger.querySelector('.meta')?.textContent).toBe(`delegate: ${DELEGATE.toBase58()} · token: USDC mint ${USDC} · scope: u64::MAX`);
    // The synthesized row first (an approve changes no balance), then the simulation's own (the fee).
    expect(texts('.s9-bal-row .pri')).toEqual(['USDC delegated', 'SOL']);
    expect(texts('.s9-bal-row .delta')).toEqual(['unlimited', '−0.000005']);
    expect(texts('.s9-bal-row .fiat')[0]).toBe('≈ all current + future');
    expect(document.querySelector('.app-tx-none')).toBeNull();
    // The typed field, in the section, after the instructions: the word in its true case, the attributes, #37's helper.
    expect(text('.app-tx-item .s9-typed-confirm .label')).toBe('Type USDC to enable Approve');
    expect(text('.s9-typed-confirm .label code')).toBe('USDC');
    expect(text('.s9-typed-confirm .app-typed-help')).toBe('Case-sensitive · must match exactly.');
    const input = field('USDC');
    expect(['autocapitalize', 'autocomplete', 'autocorrect', 'spellcheck'].map(a => input.getAttribute(a))).toEqual(['off', 'off', 'off', 'false']);
    expect([input.value, input.className, input.form]).toEqual(['', 'input', null]);
    // No control is focused at open — the typed field included.
    expect(document.activeElement).toBe(document.body);
    const gated = cta('Approve unlimited');
    expect([gated.className, gated.disabled, gated.querySelector('svg') !== null]).toEqual(['btn btn-destructive app-cta-wide app-cta-gated', true, true]);
    expect(unstyled()).toEqual([]);
    // Exact and case-sensitive: no trimming, no case folding — past the hold, so only the match gates.
    await elapse(FLAG_HOLD_MS);
    for (const wrong of ['usdc', 'USDC ', ' USDC', 'USD', 'USDCC']) {
      type('USDC', wrong);
      expect([wrong, field('USDC').className, cta('Approve unlimited').className, cta('Approve unlimited').disabled]).toEqual([wrong, 'input', 'btn btn-destructive app-cta-wide app-cta-gated', true]);
    }
    type('USDC', 'USDC');
    expect([field('USDC').className, cta('Approve unlimited').className, cta('Approve unlimited').disabled]).toEqual(['input match', 'btn btn-destructive app-cta-wide', true]);
    expect(unstyled()).toEqual([]);
    await elapse(FLAG_HOLD_MS - 1);
    expect(cta('Approve unlimited').disabled).toBe(true);
    await elapse(1);
    expect(cta('Approve unlimited').disabled).toBe(false);
    // Enter never confirms: neither in the field nor on the CTA.
    fireEvent.keyDown(field('USDC'), {key: 'Enter'});
    fireEvent.keyDown(cta('Approve unlimited'), {key: 'Enter'});
    expect(decided(w)).toEqual([]);
    fireEvent.click(cta('Approve unlimited'));
    // The override re-authenticates (Q33, O1): the words went with the approval; the window points to the toolbar.
    await settled(() => screen.getByText("Confirm it's you"));
    expect(decided(w).map(m => m.overrides)).toEqual([[{tx: 0, word: 'USDC'}]]);
    const challengeId = String((await readDappSession(w.ext)).queue[0]?.challengeId);
    await handleMessage(w.ext, {type: 'vault.reauthOk', challengeId}, {id: w.ext.runtimeId, origin: w.ext.extensionOrigin, url: `${w.ext.extensionOrigin}/unlock.html`}, w.deps);
    await acted(() => document.dispatchEvent(new Event('visibilitychange')));
    await settled(() => expect(screen.queryByText("Confirm it's you")).toBeNull());
    await elapse(FLAG_HOLD_MS);
    fireEvent.click(cta('Approve unlimited'));
    await settled(() => expect(w.closed.n).toBe(1));
    expect(decided(w).map(m => m.overrides)).toEqual([[{tx: 0, word: 'USDC'}], [{tx: 0, word: 'USDC'}]]);
    expect((page.answersFor(requestId)[0]?.result as {signed: string[]}).signed).toHaveLength(1);
  });

  it('O9: an approve of nearly the whole balance below u64::MAX — its own head (Q56), "Critical · Large spend approval" (Q57), "Approve anyway" (Q34) without the alert icon, the body "all or nearly all" (Q42); "unlimited" nowhere', async () => {
    const w = await openWindow();
    holdUsdc(w);
    await w.signTx('https://jup.ag', [v0([tokenApprove(SRC, DELEGATE, 248_000_000n)])]);
    w.show();
    await simulated(w, 'Spend approval for nearly all your USDC');
    expect(text('.top-bar .title')).toBe('Critical · Large spend approval');
    expect(heads()[0]).toBe('Spend approval for nearly all your USDC');
    const danger = document.querySelector('.s9-flag-banner.danger') as HTMLElement;
    expect(danger.querySelector('.body')?.textContent).toBe(
      "This transaction includes a spl_token::Approve instruction for amount = 248000000, all or nearly all of this account's balance. Even verified dApps can be exploited; this lets the program move all or nearly all your USDC until you revoke.",
    );
    expect(texts('.s9-bal-row .delta')[0]).toBe('248');
    expect(text('.s9-typed-confirm .label')).toBe('Type USDC to enable Approve');
    const anyway = cta('Approve anyway');
    expect([anyway.className, anyway.querySelector('svg')]).toEqual(['btn btn-destructive app-cta-wide app-cta-gated', null]);
    expect(document.querySelector('.app-approve')?.textContent).not.toMatch(/unlimited/i);
  });

  it('holds (fake timers, the real background): any flag holds the CTA 1.49 s, enables it at 1.5 s — after a match change, a focus, a new simulation (which empties the field: the word typed again); Reject never held; an unflagged screen 500 ms (negative control)', async () => {
    const w = await openWindow();
    holdUsdc(w);
    await w.signTx('https://jup.ag', [v0([tokenApprove(SRC, DELEGATE, U64_MAX)])]);
    w.show();
    await simulated(w, 'Unlimited USDC spend approval');
    const held = async () => {
      await elapse(FLAG_HOLD_MS - 10);
      expect([cta('Approve unlimited').disabled, cta('Reject').disabled]).toEqual([true, false]);
      await elapse(10);
      expect(cta('Approve unlimited').disabled).toBe(false);
    };
    // A match change (the field now matches): held from here.
    await acted(() => type('USDC', 'USDC'));
    expect([cta('Approve unlimited').disabled, cta('Reject').disabled]).toEqual([true, false]);
    await held();
    // A focus re-holds.
    await acted(() => window.dispatchEvent(new Event('focus')));
    expect(cta('Approve unlimited').disabled).toBe(true);
    await held();
    // The match lost, then regained: held again from the regain.
    await acted(() => type('USDC', 'USDCx'));
    await elapse(FLAG_HOLD_MS * 2);
    expect(cta('Approve unlimited').disabled).toBe(true);
    await acted(() => type('USDC', 'USDC'));
    expect(cta('Approve unlimited').disabled).toBe(true);
    await held();
    // A new simulation (the 30 s refresh): the background stores it; the window's next read (no focus) re-holds.
    const first = (await readDappSession(w.ext)).queue[0]?.sim;
    w.deps.clock.t += 30_000;
    await acted(() => document.dispatchEvent(new Event('visibilitychange')));
    await settled(async () => expect((await readDappSession(w.ext)).queue[0]?.sim).not.toEqual(first));
    await acted(() => document.dispatchEvent(new Event('visibilitychange')));
    expect([field('USDC').value, cta('Approve unlimited').disabled]).toEqual(['', true]);
    await elapse(FLAG_HOLD_MS * 2);
    expect(cta('Approve unlimited').disabled).toBe(true);
    await acted(() => type('USDC', 'USDC'));
    expect(cta('Approve unlimited').disabled).toBe(true);
    await held();
    // Negative control: a screen with no flag keeps C15's 500 ms.
    cleanup();
    const plain = await openWindow();
    await known(plain);
    await plain.signTx('https://jup.ag', [v0()]);
    plain.show();
    await simulated(plain, 'Balance changes (post-simulation)');
    await acted(() => window.dispatchEvent(new Event('focus')));
    await elapse(ARM_MS - 10);
    expect(cta('Approve').disabled).toBe(true);
    await elapse(10);
    expect(cta('Approve').disabled).toBe(false);
  });

  it('a new simulation empties every typed field (review 1 L1) — the word is typed again for what the screen now shows; a focus or another render keeps it (negative control)', async () => {
    const w = await openWindow();
    holdUsdc(w);
    await w.signTx('https://jup.ag', [v0([tokenApprove(SRC, DELEGATE, U64_MAX)])]);
    w.show();
    await simulated(w, 'Unlimited USDC spend approval');
    type('USDC', 'USDC');
    // Negative control: a focus and a read of the same simulation keep the word.
    await acted(() => window.dispatchEvent(new Event('focus')));
    await acted(() => document.dispatchEvent(new Event('visibilitychange')));
    await elapse(FLAG_HOLD_MS);
    expect([field('USDC').value, field('USDC').className, cta('Approve unlimited').disabled]).toEqual(['USDC', 'input match', false]);
    // A new simulation (the 30 s refresh) lands: the field is empty again and the CTA gated.
    const first = (await readDappSession(w.ext)).queue[0]?.sim;
    w.deps.clock.t += 30_000;
    await acted(() => document.dispatchEvent(new Event('visibilitychange')));
    await settled(async () => expect((await readDappSession(w.ext)).queue[0]?.sim).not.toEqual(first));
    await acted(() => document.dispatchEvent(new Event('visibilitychange')));
    await settled(() => expect(field('USDC').value).toBe(''));
    expect([field('USDC').className, cta('Approve unlimited').className, cta('Approve unlimited').disabled]).toEqual(['input', 'btn btn-destructive app-cta-wide app-cta-gated', true]);
    type('USDC', 'USDC');
    await elapse(FLAG_HOLD_MS);
    expect(cta('Approve unlimited').disabled).toBe(false);
    // Review 1 I1: a two-field screen — both words typed, a new simulation lands (both fields empty, as above), then
    // only ONE is typed again. The other field must stay empty and unmatched, not read back the word typed against the
    // simulation before this one (`setTypedFor`'s merge must drop every word that is not for `simId`, not just add).
    cleanup();
    const two = await openWindow();
    holdUsdc(two);
    await two.signTx('https://jup.ag', [v0([assign(), tokenApprove(SRC, DELEGATE, U64_MAX)])]);
    two.show();
    await simulated(two, 'Assign / Allocate on your wallet account');
    type('ASSIGN', 'ASSIGN');
    type('USDC', 'USDC');
    await elapse(FLAG_HOLD_MS);
    expect([field('ASSIGN').value, field('USDC').value, cta('Approve anyway').disabled]).toEqual(['ASSIGN', 'USDC', false]);
    const firstTwo = (await readDappSession(two.ext)).queue[0]?.sim;
    two.deps.clock.t += 30_000;
    await acted(() => document.dispatchEvent(new Event('visibilitychange')));
    await settled(async () => expect((await readDappSession(two.ext)).queue[0]?.sim).not.toEqual(firstTwo));
    await acted(() => document.dispatchEvent(new Event('visibilitychange')));
    await settled(() => expect(field('ASSIGN').value).toBe(''));
    expect([field('ASSIGN').value, field('USDC').value, cta('Approve anyway').disabled]).toEqual(['', '', true]);
    // Only ASSIGN is typed again — USDC must not silently read back as matched from the old simulation's word.
    type('ASSIGN', 'ASSIGN');
    await elapse(FLAG_HOLD_MS);
    expect([field('ASSIGN').className, field('USDC').value, field('USDC').className, cta('Approve anyway').disabled]).toEqual(['input match', '', 'input', true]);
  });

  it('an unlimited approve beside an ATA create for another wallet: F5’s banner, and F2’s naming only the create; the account’s own ATA (O7) is no F2', async () => {
    const w = await openWindow();
    holdUsdc(w);
    await w.signTx('https://jup.ag', [v0([tokenApprove(SRC, DELEGATE, U64_MAX), ataCreate(X, TO, new PublicKey(USDC))])]);
    w.show();
    await simulated(w, 'Unlimited USDC spend approval');
    expect(heads()).toEqual(['Unlimited USDC spend approval', 'Instructions that are not transfers']);
    expect(texts('.s9-flag-banner.warn .meta')).toEqual(['#2 spl_associated_token_account::CreateIdempotent']);
    expect(unstyled()).toEqual([]);
    // O7: the account's own ATA, created and paid by the account — rent only, no F2 banner beside F5's.
    cleanup();
    const own = await openWindow();
    holdUsdc(own);
    await own.signTx('https://jup.ag', [v0([tokenApprove(SRC, DELEGATE, U64_MAX), ataCreate(X, ME, new PublicKey(USDC))])]);
    own.show();
    await simulated(own, 'Unlimited USDC spend approval');
    expect(heads()).toEqual(['Unlimited USDC spend approval']);
  });

  // B1c-3 (the final review's carried minors): a non-Checked amount with the mint's decimals, from the background's
  // read of its source account (the window computes none); an ATA create's token program named.
  it('instruction rows: a non-Checked approve with the mint’s decimals, a transfer from an unreadable account in base units; an ATA create names its token program', async () => {
    const w = await openWindow();
    holdUsdc(w);
    const unread = new PublicKey(new Uint8Array(32).fill(86));
    const odd = new PublicKey(new Uint8Array(32).fill(87));
    const usdc = new PublicKey(USDC);
    await w.signTx('https://jup.ag', [
      v0([tokenApprove(SRC, DELEGATE, 1_500_000n), tokenTransfer(X, unread, 1_500_000n), ataCreate(X, ME, usdc), ataCreate(Y, ME, usdc, new PublicKey(TOKEN_2022_PROGRAM)), ataCreate(odd, ME, usdc, DELEGATE)]),
    ]);
    w.show();
    await simulated(w, 'USDC spend approval');
    const values = (name: string) => [...document.querySelectorAll('.s9-payload-card .app-tx-field')].filter(r => r.querySelector('.k')?.textContent === name).map(r => r.querySelector('.v'));
    expect(values('amount').map(v => v?.textContent)).toEqual(['1.5', '1500000']);
    expect(values('tokenProgram').map(v => [v?.querySelector('.addr-groups')?.textContent, v?.querySelector('.app-tx-addr-label')?.textContent ?? null])).toEqual([
      [TOKEN_PROGRAM, 'spl_token'],
      [TOKEN_2022_PROGRAM, 'spl_token_2022'],
      [DELEGATE.toBase58(), null],
    ]);
    expect(unstyled()).toEqual([]);
  });

  it('System assign of the wallet account (F3) and an unlimited approve in one transaction: "Critical · Blocked transaction", both banners, one field per block — "Approve anyway" only when both match; the L3 line replaced beside an authority flag', async () => {
    const w = await openWindow();
    holdUsdc(w);
    await w.signTx('https://jup.ag', [v0([assign(), tokenApprove(SRC, DELEGATE, U64_MAX)])]);
    w.show();
    await simulated(w, 'Assign / Allocate on your wallet account');
    expect(text('.top-bar .title')).toBe('Critical · Blocked transaction');
    expect(heads()).toEqual(['Assign / Allocate on your wallet account', 'Unlimited USDC spend approval']);
    expect(texts('.s9-flag-banner.danger .body')[0]).toBe("This changes your wallet account itself. Assigned to another program, it is that program's to control; given data, it can no longer pay fees or send SOL.");
    expect(texts('.s9-flag-banner .meta')).toEqual(['#1 system_program::Assign', `delegate: ${DELEGATE.toBase58()} · token: USDC mint ${USDC} · scope: u64::MAX`]);
    expect(texts('.s9-typed-confirm .label')).toEqual(['Type ASSIGN to enable Approve', 'Type USDC to enable Approve']);
    const anyway = () => cta('Approve anyway');
    expect([anyway().className, anyway().querySelector('svg')]).toEqual(['btn btn-destructive app-cta-wide app-cta-gated', null]);
    expect(screen.queryByRole('button', {name: 'Approve unlimited'})).toBeNull();
    type('ASSIGN', 'ASSIGN');
    await elapse(FLAG_HOLD_MS);
    expect([anyway().className, anyway().disabled]).toEqual(['btn btn-destructive app-cta-wide app-cta-gated', true]);
    type('USDC', 'USDC');
    await elapse(FLAG_HOLD_MS);
    expect([anyway().className, anyway().disabled]).toEqual(['btn btn-destructive app-cta-wide', false]);
    expect(unstyled()).toEqual([]);
    fireEvent.click(anyway());
    await settled(() => screen.getByText("Confirm it's you"));
    expect(decided(w).map(m => m.overrides)).toEqual([[{tx: 0, word: 'ASSIGN'}, {tx: 0, word: 'USDC'}]]);
    // The assign alone, paid by the dApp: nothing of the account's moves — L3's line is replaced (Q54).
    cleanup();
    const solo = await openWindow();
    await solo.signTx('https://jup.ag', [coSigned([assign()])]);
    solo.show();
    await simulated(solo, 'Assign / Allocate on your wallet account');
    expect([texts('.s9-bal-row'), text('.app-tx-none')]).toEqual([[], 'No SOL or token balance changes — but this transaction changes who controls an account of yours (above).']);
    expect(unstyled()).toEqual([]);
  });

  it('a dependent step (F10): step 3 of a batch depending on step 2 — its own section with Q32 (step 2, never 1 or 3), effects unknown, the field UNCHECKED there only; no "Couldn’t simulate"; the word goes with tx 2', async () => {
    const w = await openWindow();
    w.chain.errFor = dependentOn(Y);
    await w.signTx('https://jup.ag', [v0([ataCreate(X)]), v0([ataCreate(Y)]), v0([tokenTransfer(Y)])]);
    w.show();
    await simulated(w, 'This step depends on step 2 and could not be checked on its own.');
    expect(screen.queryByText("Couldn't simulate")).toBeNull();
    expect(text('.top-bar .title')).toBe('Critical · Blocked transaction');
    const [one, two, three] = sections();
    expect([heads(one), heads(two)]).toEqual([
      ['Instructions that are not transfers', "Could not read this token's settings"],
      ['Instructions that are not transfers', "Could not read this token's settings"],
    ]);
    expect(heads(three)).toEqual(['This step depends on step 2 and could not be checked on its own.']);
    expect([...(three?.querySelectorAll('.s9-flag-banner .body, .s9-flag-banner .meta') ?? [])].map(e => e.textContent)).toEqual([
      'Its effects are unknown: it was simulated without the changes step 2 makes, which it needs. Approving it may move any of your balances.',
      '{"InstructionError":[0,"InvalidAccountData"]}',
    ]);
    expect([three?.querySelector('.s9-bal-card .label')?.textContent, three?.querySelector('.s9-bal-card .app-tx-none')?.textContent, three?.querySelectorAll('.s9-bal-row').length]).toEqual([
      'Balance changes (unknown)',
      'This step was not simulated on its own, so its effects are unknown.',
      0,
    ]);
    expect(sections().map(sec => [...sec.querySelectorAll('.s9-typed-confirm .label')].map(l => l.textContent))).toEqual([[], [], ['Type UNCHECKED to enable Approve']]);
    expect(unstyled()).toEqual([]);
    type('UNCHECKED', 'UNCHECKED');
    await elapse(FLAG_HOLD_MS);
    fireEvent.click(cta('Approve anyway'));
    await settled(() => screen.getByText("Confirm it's you"));
    expect(decided(w).map(m => m.overrides)).toEqual([[{tx: 2, word: 'UNCHECKED'}]]);
  });

  it('a lookalike origin with a block: both gates — the typed field first (the demoted "Approve anyway (not recommended)" stays disabled until it matches), then the 2-second confirm (held 1.5 s on a focus); the words go with the approval', async () => {
    const w = await openWindow();
    await w.signTx('https://tensr.trade', [coSigned([assign()])]);
    w.show();
    await simulated(w, 'Assign / Allocate on your wallet account');
    expect(text('.s9-domain-warn .body b')).toBe('This domain is not tensor.trade');
    expect(text('.top-bar .title')).toBe('Critical · Blocked transaction');
    expect(document.querySelector('.s9-origin-pill')).toBeNull();
    const demoted = () => cta('Approve anyway (not recommended)');
    await elapse(FLAG_HOLD_MS);
    expect(demoted().disabled).toBe(true);
    fireEvent.click(demoted());
    expect(screen.queryByRole('dialog')).toBeNull();
    type('ASSIGN', 'ASSIGN');
    await elapse(FLAG_HOLD_MS);
    fireEvent.click(demoted());
    const sheet = await settled(() => screen.getByRole('dialog', {name: 'We strongly recommend rejecting. Continue?'}));
    const understand = () => within(sheet).getByRole('button', {name: 'I understand the risk'}) as HTMLButtonElement;
    // The 2-second confirm itself (Task 9 fix round 1, I1): the red-flag screen's 1.5 s hold is past at 1 999 ms, so only the delay holds it.
    await elapse(CONFIRM_DELAY_MS - 1);
    expect(understand().disabled).toBe(true);
    await elapse(1);
    expect(understand().disabled).toBe(false);
    // C15 inside the sheet, at the red-flag screen's 1.5 s: still held 1 s after a focus (500 ms would have released it).
    await acted(() => window.dispatchEvent(new Event('focus')));
    await elapse(FLAG_HOLD_MS - 1);
    expect(understand().disabled).toBe(true);
    await elapse(1);
    expect(understand().disabled).toBe(false);
    fireEvent.click(understand());
    await settled(() => screen.getByText("Confirm it's you"));
    expect(decided(w).map(m => m.overrides)).toEqual([[{tx: 0, word: 'ASSIGN'}]]);
    expect(unstyled()).toEqual([]);
  });

  /** One transaction carrying every kind of flag (as the background sends them), rendered from its view. */
  const P1 = new PublicKey(new Uint8Array(32).fill(91)).toBase58();
  const MINT = new PublicKey(new Uint8Array(32).fill(92)).toBase58();
  const AUTH = new PublicKey(new Uint8Array(32).fill(93)).toBase58();
  const ix = (program: 'system' | 'token' | 'token-2022' | null, name: string | null) => ({programId: program === null ? P1 : AUTH, program, name, fields: []});
  const flagged = (flags: Flag[], changes: {mint: string | null; amount: string; decimals: number | null; usdMicros: string | null}[] = []): RequestView => ({
    requestId: 'f',
    type: 'signTransaction',
    origin: 'https://jup.ag',
    host: 'jup.ag',
    site: {kind: 'verified', name: 'Jupiter', imitates: null, rule: null, idn: null, international: false},
    offerBlock: false,
    connect: null,
    sign: null,
    mismatch: null,
    tx: {
      kind: 'signTransaction',
      account: {index: 0, name: 'Main', publicKey: ACCOUNT.publicKey},
      simulation: {status: 'ok', id: 'AAAAAAAAAAAAAAAAAAAAAA', slot: 1, elapsedMs: 1, at: 1},
      reauth: {reasons: ['override'], state: 'needed'},
      labels: [],
      transactions: [
        {
          version: 0,
          feePayer: ACCOUNT.publicKey,
          unitLimit: null,
          feeLamports: null,
          outcome: {ok: true, changes, unitsConsumed: 1, unitLimit: 200_000, feeLamports: null},
          instructions: [ix('system', 'advanceNonceAccount'), ix('system', 'assign'), ix('token', 'setAuthority'), ix('token', 'approve'), ix('token-2022', 'approveChecked'), ix(null, null), ix('token', null)],
          flags,
        },
      ],
    },
  });
  const approval = (o: Partial<{at: number | null; symbol: 'USDC' | null; decimals: number | null; mint: string | null; amount: string}>) => ({
    at: 3,
    source: SRC.toBase58(),
    mint: USDC,
    symbol: 'USDC' as const,
    decimals: 6,
    delegate: DELEGATE.toBase58(),
    amount: U64_MAX.toString(),
    balance: '250000000',
    ...o,
  });

  it('every kind of flag: its banner’s head, body and meta (the copy of spec §10), blocks before warnings, every address whole; the synthesized rows', () => {
    const flags: Flag[] = [
      {kind: 'durable-nonce', severity: 'warn', word: null, at: 0},
      {kind: 'assign', severity: 'block', word: 'ASSIGN', at: 1, instructions: [{index: 1, program: 'system', name: 'assign'}], chain: {owner: P1, space: 8}},
      {kind: 'set-authority', severity: 'block', word: 'AUTHORITY', at: 2, instructions: [{index: 2, program: 'token', account: SRC.toBase58(), owned: 'token-account', authorityType: 'accountOwner', newAuthority: null}], chain: [{account: SRC.toBase58(), change: 'close-authority', from: null, to: AUTH}]},
      {kind: 'unlimited-approve', severity: 'block', word: 'UNLIMITED', at: 3, approvals: [approval({}), approval({at: 4, symbol: null, decimals: null, mint: MINT, amount: '250000000'}), approval({at: null, symbol: null, mint: null})]},
      {kind: 'bounded-approve', severity: 'warn', word: null, at: 3, approvals: [approval({amount: '5000000'})]},
      {kind: 'unknown-program', severity: 'warn', word: null, at: 5, programs: [P1, null]},
      {kind: 'non-transfer', severity: 'warn', word: null, at: 0, instructions: [{index: 0, program: 'system', name: 'advanceNonceAccount'}, {index: 6, program: 'token', name: null}]},
      {kind: 'token-2022', severity: 'warn', word: null, at: null, mint: MINT, settings: {freezeAuthority: AUTH, permanentDelegate: null, transferHookProgram: P1}},
      {kind: 'token-2022', severity: 'warn', word: null, at: 4, mint: USDC, settings: null},
      {kind: 'whole-balance', severity: 'warn', word: null, at: null},
    ];
    render(<Tx request={flagged(flags)} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} />);
    const banners = [...document.querySelectorAll('.s9-flag-banner')].map(b => ({
      tone: b.className.replace('s9-flag-banner ', ''),
      head: b.querySelector('.head')?.textContent,
      body: [...b.querySelectorAll('.body')].map(e => e.textContent),
      meta: [...b.querySelectorAll('.meta')].map(e => e.textContent),
    }));
    const src = SRC.toBase58();
    const del = DELEGATE.toBase58();
    expect(banners).toEqual([
      {tone: 'danger', head: 'Assign / Allocate on your wallet account', body: ["This changes your wallet account itself. Assigned to another program, it is that program's to control; given data, it can no longer pay fees or send SOL."], meta: ['#2 system_program::Assign', `post-simulation · owner: ${P1} · space: 8`]},
      {
        tone: 'danger',
        head: 'SetAuthority on an account you own',
        body: ['This gives an authority over an account you own to another address, or removes it. You cannot take it back yourself.'],
        meta: [`#3 spl_token::SetAuthority · authorityType: accountOwner · account: ${src} · newAuthority: —`, `post-simulation · close-authority: — → ${AUTH} · account: ${src}`],
      },
      {
        tone: 'danger',
        head: 'Unlimited token spend approval',
        body: [
          'This transaction includes a spl_token::Approve instruction with amount = u64::MAX (~18.4 quintillion units). Even verified dApps can be exploited; this lets the program move all your USDC, now and in the future, until you revoke.',
          "This transaction includes a spl_token_2022::ApproveChecked instruction for amount = 250000000, all or nearly all of this account's balance. Even verified dApps can be exploited; this lets the program move all or nearly all of this token until you revoke.",
          'The simulation shows a program call — not an instruction listed here — that lets a delegate move all of this token, now and in the future, until you revoke. Even verified dApps can be exploited.',
        ],
        meta: [`delegate: ${del} · token: USDC mint ${USDC} · scope: u64::MAX`, `delegate: ${del} · token: mint ${MINT} · scope: 250000000`, `delegate: ${del} · token: mint — · scope: u64::MAX`],
      },
      {tone: 'warn', head: 'This transaction does not expire.', body: [], meta: ['#1 system_program::AdvanceNonceAccount']},
      {tone: 'warn', head: 'USDC spend approval', body: ['This lets a delegate move up to 5 of your USDC until you revoke.'], meta: [`delegate: ${del} · token: USDC mint ${USDC} · scope: 5 USDC`]},
      {tone: 'warn', head: 'Unknown program', body: ['The wallet cannot decode what this program does — only the simulation shows its effects.'], meta: [P1, 'a program the transaction does not name in its own keys']},
      {tone: 'warn', head: 'Instructions that are not transfers', body: ['Each can do more than move a balance. Check what it does before approving.'], meta: ['#1 system_program::AdvanceNonceAccount', '#7 spl_token::unknown instruction']},
      {
        tone: 'warn',
        head: 'Token-2022 settings on a token you hold',
        body: ['Freeze authority — the issuer can freeze your account of this token.', 'Transfer hook — a program that runs on every transfer of this token.'],
        meta: [`mint: ${MINT}`, `freezeAuthority: ${AUTH}`, `transferHookProgram: ${P1}`],
      },
      {tone: 'warn', head: "Could not read this token's settings", body: [], meta: [`mint: ${USDC}`]},
      {tone: 'warn', head: 'Whole balance to a first-time address', body: ['All or nearly all of a balance goes to an address you have not sent to before.'], meta: []},
    ]);
    // The synthesized rows (an approve moves no balance): unlimited at u64::MAX, else the amount.
    expect(texts('.s9-bal-row .pri')).toEqual(['USDC delegated', `${MINT.slice(0, 4)}…${MINT.slice(-4)} delegated`, `${src.slice(0, 4)}…${src.slice(-4)} delegated`, 'USDC delegated']);
    expect(texts('.s9-bal-row .delta')).toEqual(['unlimited', '250000000', 'unlimited', '5']);
    expect(texts('.s9-bal-row .fiat')).toEqual(['≈ all current + future', '≈ all current + future']);
    expect(document.querySelector('.app-tx-none')).toBeNull();
    // One field per block kind, in the flag order.
    expect(texts('.s9-typed-confirm .label')).toEqual(['Type ASSIGN to enable Approve', 'Type AUTHORITY to enable Approve', 'Type UNLIMITED to enable Approve']);
    expect(unstyledClasses(document.querySelector('.app-approve')!, SELECTORS)).toEqual([]);
  });

  it('L14 (review 3): a token the wallet cannot name, nearly all of it below u64::MAX — its head says "of this token", the word to type is ALLOWANCE (Q58), never UNLIMITED', () => {
    const flags: Flag[] = [{kind: 'unlimited-approve', severity: 'block', word: 'ALLOWANCE', at: null, approvals: [approval({at: null, symbol: null, decimals: null, mint: MINT, amount: '995'})]}];
    render(<Tx request={flagged(flags)} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} />);
    expect(text('.top-bar .title')).toBe('Critical · Large spend approval');
    expect(text('.s9-flag-banner.danger .head')).toBe('Spend approval for nearly all of this token');
    expect(text('.s9-typed-confirm .label')).toBe('Type ALLOWANCE to enable Approve');
    expect(document.querySelector('.app-approve')?.textContent).not.toMatch(/unlimited/i);
  });

  it('fix round 1 Minor 1: F6’s body (Q45) never doubles the symbol — a named token says the bare amount, an unnamed one "of this token"', () => {
    const named: Flag[] = [{kind: 'bounded-approve', severity: 'warn', word: null, at: null, approvals: [approval({symbol: 'USDC', decimals: 6, amount: '5000000'})]}];
    render(<Tx request={flagged(named)} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} />);
    expect(text('.s9-flag-banner.warn .body')).toBe('This lets a delegate move up to 5 of your USDC until you revoke.');
    cleanup();
    const unnamed: Flag[] = [{kind: 'bounded-approve', severity: 'warn', word: null, at: null, approvals: [approval({symbol: null, decimals: null, mint: MINT, amount: '5000000'})]}];
    render(<Tx request={flagged(unnamed)} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} />);
    expect(text('.s9-flag-banner.warn .body')).toBe('This lets a delegate move up to 5000000 of this token until you revoke.');
  });

  it('the design’s typed-confirm and flag-banner rules, as extracted (design-ext.css), and the hand-written ones (app.css)', () => {
    const designRule = (selector: string): string => {
      const css = readFileSync(join(__dirname, '..', '..', 'styles', 'design-ext.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
      const at = css.split('}').find(r => r.split('{')[0]?.split(',').some(sel => sel.trim() === selector));
      return at === undefined ? '' : (at.split('{')[1] ?? '').replace(/\s+/g, ' ').trim();
    };
    expect(designRule('.s9-typed-confirm')).toContain('background: var(--bg-surface-2)');
    expect(designRule('.s9-typed-confirm .label')).toContain('text-transform: uppercase');
    expect(designRule('.s9-typed-confirm .input')).toContain('border: 1px solid color-mix(in oklab, var(--danger) 32%, transparent)');
    expect(designRule('.s9-typed-confirm .input.match')).toBe('border-color: var(--success);');
    expect(designRule('.s9-flag-banner.danger')).toContain('border: 1px solid color-mix(in oklab, var(--danger) 40%, transparent)');
    expect(designRule('.s9-flag-banner.warn')).toContain('border-left: 3px solid var(--warning)');
    expect(designRule('.s9-flag-banner .meta')).toContain('word-break: break-all');
    expect(cssRule('.s9-typed-confirm .label code')).toContain('text-transform: none');
    expect(cssRule('.s9-flag-banner.danger .body code')).toContain('color: var(--danger)');
    expect(cssRule('.btn.app-cta-gated:disabled')).toContain('background: var(--bg-surface-3)');
    expect(cssRule('.btn.app-cta-gated:disabled')).toContain('opacity: 1');
  });
});
