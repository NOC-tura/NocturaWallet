// @vitest-environment happy-dom
import {fireEvent, screen, within} from '@testing-library/react';
import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {DAPP_SESSION_KEY, readDappSession} from '../../background/dapp/store';
import {runtimeFor} from '../../background/dapp/ports';
import {ACCOUNT} from '../../background/__tests__/fixtures';
import {POLL_MS} from '../Approve';
import {ARM_MS} from '../useArmed';
import {CONFIRM_DELAY_MS} from '../ui';
import {elapse, nextTimer, onHarnessClock, openWindow, settled} from './windowHarness';

const SELECTORS = selectorsOf(UI_SHEETS);
const text = (sel: string) => document.querySelector(sel)?.textContent ?? null;
const cta = (name: string | RegExp) => screen.getByRole('button', {name});
const siws = (domain: string) =>
  [`${domain} wants you to sign in with your Solana account:`, ACCOUNT.publicKey, '', 'Sign in to Jupiter.', '', `URI: https://${domain}`, 'Version: 1', 'Chain ID: solana:mainnet', 'Nonce: 4f3a92ceb1d8', 'Issued At: 2026-10-10T09:40:23Z'].join('\n');
onHarnessClock();

// Spec §3.2 steps 4–7 (#46, index.html ix:17442-17686) and C15, against the real background.
describe('#46 sign-message', () => {
  it('idle · verified: every drawn string, the message as text in mono; Sign held 500 ms, then an ed25519 signature over the exact bytes', async () => {
    const w = await openWindow();
    const message = siws('jup.ag');
    const {page, requestId} = await w.sign('https://jup.ag', message);
    w.show();
    await settled(() => screen.getByText('Sign this message?'));
    expect([text('.top-bar .title'), document.querySelector('.top-bar .title')?.className]).toEqual(['Signature request', 'title noc-overline app-dim']);
    expect(text('.app-approve-lede')).toBe('A signature proves you control this wallet. It does not move funds and does not broadcast a transaction.');
    expect([text('.s9-origin-card .name'), text('.s9-origin-card .dom'), text('.s9-origin-card .badge')]).toEqual(['Jupiter', 'jup.ag', 'Verified']);
    expect(text('.s9-msg-card .label')).toBe(`Message · UTF-8 (${[...message].length} chars)`);
    expect(text('.s9-msg-preview')).toBe(message);
    expect(document.querySelector('.s9-msg-preview mark')).toBeNull();
    expect(text('.s9-disclaimer p')).toBe("This won't broadcast or move funds. Jupiter will use the signature only to verify you own this wallet.");
    expect(document.querySelector('.s9-struct-alert')).toBeNull();
    expect(unstyledClasses(document.querySelector('.app-approve')!, SELECTORS)).toEqual([]);
    const sign = cta('Sign');
    expect([sign.className, (sign as HTMLButtonElement).disabled, sign.querySelector('svg') !== null]).toEqual(['btn btn-primary app-cta-wide', true, true]);
    // On the harness's clock (B1c-3 Task 9): held to the millisecond, a click inside the hold signs nothing.
    await elapse(ARM_MS - 1);
    fireEvent.click(cta('Sign'));
    expect([(cta('Sign') as HTMLButtonElement).disabled, page.answersFor(requestId)]).toEqual([true, []]);
    await elapse(1);
    fireEvent.click(cta('Sign'));
    await settled(() => expect(w.closed.n).toBe(1));
    const [answer] = page.answersFor(requestId);
    const {signature, signedMessage} = answer?.result as {signature: string; signedMessage: string};
    expect(signedMessage).toBe(base64.encode(new TextEncoder().encode(message)));
    expect(ed25519.verify(base64.decode(signature), new TextEncoder().encode(message), base58.decode(ACCOUNT.publicKey))).toBe(true);
  });

  it('a structured-approval keyword: the design’s alert, the word marked, the label with the flag (rule 6)', async () => {
    const w = await openWindow();
    await w.sign('https://jup.ag', 'jup.ag asks you to approve the following terms.');
    w.show();
    await settled(() => screen.getByText('This message includes an authorization'));
    expect(text('.s9-struct-alert .body')).toBe("Detected keyword: approve. Even though signing won't broadcast, the dApp may use this signature off-chain to authorize a future action. Read the full message before signing.");
    expect(text('.s9-struct-alert code')).toBe('approve');
    expect(text('.s9-msg-card .label')).toBe('Message · with structured-approval flag');
    expect([...document.querySelectorAll('.s9-msg-preview mark')].map(m => m.textContent)).toEqual(['approve']);
    expect(text('.s9-msg-preview')).toBe('jup.ag asks you to approve the following terms.');
    expect(unstyledClasses(document.querySelector('.app-approve')!, SELECTORS)).toEqual([]);
  });

  it('an unknown origin: the Unknown card, and the disclaimer names its own label', async () => {
    const w = await openWindow();
    await w.sign('https://dapp.test', 'Sign in to the test dApp.');
    w.show();
    await settled(() => screen.getByText('Sign this message?'));
    expect([text('.s9-origin-card .name'), text('.s9-origin-card .badge')]).toEqual(['dapp', 'Unknown']);
    expect(text('.s9-disclaimer p')).toBe("This won't broadcast or move funds. dapp will use the signature only to verify you own this wallet.");
  });

  it('lookalike: "Suspicious origin", the short lede, the banner, "Message preview" with the homoglyph marked; Sign anyway → 2 s → I understand the risk signs', async () => {
    const w = await openWindow();
    const {page, requestId} = await w.sign('https://tensr.trade', 'Welcome back!\nDomain: ph\u0430ntom.app');
    w.show();
    await settled(() => screen.getByText('Sign this message?'));
    expect([text('.top-bar .title'), document.querySelector('.top-bar .title')?.className]).toEqual(['Suspicious origin', 'title noc-overline noc-danger']);
    expect(text('.app-approve-lede')).toBe('A signature proves you control this wallet.');
    expect(text('.s9-domain-warn .body')).toBe('This domain is not tensor.tradeIt looks like tensor.trade but is a different site.');
    expect(text('.s9-msg-card .label')).toBe('Message preview');
    expect([...document.querySelectorAll('.s9-msg-preview mark')].map(m => m.textContent)).toEqual(['\u0430']);
    // Controller ruling (task 9): btn-destructive, not the duplicate app-btn-danger (deleted — see Connect's "Reject
    // and report" assertion, fix round 1 M1).
    expect(cta('Reject and report').className).toBe('btn btn-destructive');
    expect(screen.queryByRole('button', {name: 'Sign'})).toBeNull();
    // Fix round 1, item 1: the lookalike phone never carries the disclaimer — it must not vouch that a phishing
    // origin "will use the signature only to verify you own this wallet" (the idle·verified and unknown-origin
    // tests above are the positive control: the same disclaimer does show there).
    expect(document.querySelector('.s9-disclaimer')).toBeNull();
    expect(unstyledClasses(document.querySelector('.app-approve')!, SELECTORS)).toEqual([]);
    await elapse(ARM_MS);
    fireEvent.click(cta('Sign anyway (not recommended)'));
    const sheet = await settled(() => screen.getByRole('dialog', {name: 'We strongly recommend rejecting. Continue?'}));
    const understand = within(sheet).getByRole('button', {name: 'I understand the risk'}) as HTMLButtonElement;
    expect(understand.disabled).toBe(true);
    await elapse(CONFIRM_DELAY_MS);
    fireEvent.click(within(sheet).getByRole('button', {name: 'I understand the risk'}));
    await settled(() => expect(w.closed.n).toBe(1));
    expect(page.answersFor(requestId)[0]).toHaveProperty('result');
  });

  it('a sign-in message for another domain: Q20 and no Sign — only [Reject] (rule 3)', async () => {
    const w = await openWindow();
    const {page, requestId} = await w.sign('https://dapp.test', siws('jup.ag'));
    w.show();
    expect(await settled(() => screen.getByText('This sign-in message names jup.ag, not this site (dapp.test).'))).toBeTruthy();
    expect(screen.getAllByRole('button').map(b => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Close', 'Reject']);
    fireEvent.click(cta('Reject'));
    await settled(() => expect(w.closed.n).toBe(1));
    expect(page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);
  });

  // Fix round 1, item 5: the SIWS-mismatch Reject must be disabled while busy too, like every other CTA — forced
  // into `deciding` directly (as the signing-in-progress test below does), since the real decide() flow never
  // routes a reject/report through `deciding` on its own; this is the defensive invariant, not the common path.
  it('a sign-in message for another domain, forced into deciding: Reject (and ✕) are disabled too', async () => {
    const w = await openWindow();
    const {requestId} = await w.sign('https://dapp.test', siws('jup.ag'));
    const s = await readDappSession(w.ext);
    await w.ext.session.set(DAPP_SESSION_KEY, {...s, queue: s.queue.map(e => (e.requestId === requestId ? {...e, state: 'deciding', decidedBy: runtimeFor(w.ext).instance, decidingAt: w.deps.clock.t} : e))});
    w.show();
    await settled(() => screen.getByText('This sign-in message names jup.ag, not this site (dapp.test).'));
    expect((cta('Reject') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', {name: 'Close'}) as HTMLButtonElement).disabled).toBe(true);
  });

  // Fix round 1, item 4 (promoted): a lookalike origin signing a SIWS message for yet another domain — both
  // warnings fire at once. The lookalike bar must win, not the mismatch-only bar: [Reject and report] primary,
  // plain [Reject], and never a Sign or a Sign-anyway escape hatch.
  it('lookalike AND a SIWS domain mismatch together: the Q20 banner stays, and the bar is still the lookalike one', async () => {
    const w = await openWindow();
    const {page, requestId} = await w.sign('https://tensr.trade', siws('jup.ag'));
    w.show();
    await settled(() => screen.getByText('Sign this message?'));
    // Both banners show (the lookalike's own, then Q20) — neither one silently wins over the other.
    expect([...document.querySelectorAll('.s9-domain-warn .body')].map(e => e.textContent)).toEqual([
      'This domain is not tensor.tradeIt looks like tensor.trade but is a different site.',
      'This sign-in message names jup.ag, not this site (tensr.trade).',
    ]);
    expect(cta('Reject and report').className).toBe('btn btn-destructive');
    expect(cta('Reject')).toBeTruthy();
    expect(screen.queryByRole('button', {name: 'Sign'})).toBeNull();
    expect(screen.queryByRole('button', {name: 'Sign anyway (not recommended)'})).toBeNull();
    expect(unstyledClasses(document.querySelector('.app-approve')!, SELECTORS)).toEqual([]);
    fireEvent.click(cta('Reject and report'));
    await settled(() => expect(w.closed.n).toBe(1));
    expect(page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);
  });

  // Fix round 1, item 2 (promoted): the account held this request is unlocked no more — decide.ts's viewOf leaves
  // `sign` null while the request itself is still live (the wallet is not fully locked: another account still is).
  it('request.sign === null (the account unlocked no more): the bare top bar and a Reject-only exit, never a blank window', async () => {
    const w = await openWindow();
    const {page, requestId} = await w.sign('https://jup.ag', 'hello');
    const {setSession} = await import('../../background/session');
    const {SECOND} = await import('./windowHarness');
    await setSession(w.ext, [SECOND]);
    w.show();
    await settled(() => screen.getByText('Sign this message?'));
    expect(screen.getAllByRole('button').map(b => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Close', 'Reject']);
    expect(document.querySelector('.s9-msg-preview')).toBeNull();
    // Rev 3.2 (Q26, owner-delegated 2026-10-12), drawn as #48 draws it (B1c-3, the carried visual item): a danger flag
    // banner under the title, the alert icon, the role — never the lede's plain line.
    const why = document.querySelector('.app-approve-title + .s9-flag-banner');
    expect([why?.className, why?.getAttribute('role'), why?.querySelector('.head')?.textContent, why?.querySelectorAll('svg').length]).toEqual([
      's9-flag-banner danger app-tx-block',
      'alert',
      'This request can no longer be signed. Reject it and ask the site to try again.',
      1,
    ]);
    expect(document.querySelector('.app-approve-lede')).toBeNull();
    expect(unstyledClasses(document.querySelector('.app-approve')!, SELECTORS)).toEqual([]);
    fireEvent.click(cta('Reject'));
    await settled(() => expect(w.closed.n).toBe(1));
    expect(page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);
  });

  // Fix round 1, item 3 (promoted): the message renders as text, never HTML — React's string child already
  // guarantees this, but it is the exact invariant a future refactor (e.g. reaching for dangerouslySetInnerHTML)
  // could break, so it is pinned here.
  it('the message renders as text, never HTML: a script-looking message stays inert', async () => {
    const w = await openWindow();
    const message = '<img src=x onerror=alert(1)>';
    await w.sign('https://jup.ag', message);
    w.show();
    await settled(() => screen.getByText('Sign this message?'));
    const preview = document.querySelector('.s9-msg-preview')!;
    expect([...preview.children].every(el => el.tagName === 'MARK')).toBe(true);
    expect(preview.querySelector('img')).toBeNull();
    expect(preview.textContent).toBe(message);
  });

  it('signing-in-progress: "Signing", "Signing…" with the ring, the card at .55 and the message at .7, every CTA and ✕ disabled', async () => {
    const w = await openWindow();
    const {requestId} = await w.sign('https://jup.ag', 'jup.ag asks you to approve the following terms.');
    const s = await readDappSession(w.ext);
    await w.ext.session.set(DAPP_SESSION_KEY, {...s, queue: s.queue.map(e => (e.requestId === requestId ? {...e, state: 'deciding', decidedBy: runtimeFor(w.ext).instance, decidingAt: w.deps.clock.t} : e))});
    w.show();
    const busy = await settled(() => screen.getByRole('button', {name: 'Signing…'}));
    expect(text('.top-bar .title')).toBe('Signing');
    expect([(busy as HTMLButtonElement).disabled, busy.querySelector('.app-ring-spinner') !== null]).toEqual([true, true]);
    expect((cta('Reject') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', {name: 'Close'}) as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelector('.app-origin-slot')?.className).toBe('app-origin-slot app-busy-dim');
    expect(document.querySelector('.s9-msg-card')?.className).toBe('s9-msg-card app-busy-dim-msg');
    expect(document.querySelector('.app-approve-lede')).toBeNull();
    expect(document.querySelector('.s9-disclaimer')).toBeNull();
    expect(document.querySelector('.s9-struct-alert')).not.toBeNull();
    expect(unstyledClasses(document.querySelector('.app-approve')!, SELECTORS)).toEqual([]);
  });

  it('✕ and [Reject] reject; the window moves on', async () => {
    const w = await openWindow();
    const a = await w.sign('https://jup.ag', 'one');
    const b = await w.sign('https://dapp.test', 'two');
    w.show();
    await settled(() => screen.getByText('Sign this message?'));
    fireEvent.click(screen.getByRole('button', {name: 'Close'}));
    await settled(() => expect(text('.s9-msg-preview')).toBe('two'));
    fireEvent.click(cta('Reject'));
    await settled(() => expect(w.closed.n).toBe(1));
    expect([a.page.answersFor(a.requestId), b.page.answersFor(b.requestId)]).toEqual([[{requestId: a.requestId, error: 'rejected'}], [{requestId: b.requestId, error: 'rejected'}]]);
  });
});

// Controller ruling for this task (a): the C15 armed key folds in busy/in-progress for Sign too, so a stale poll that
// clears busy (without the user doing anything) can never leave Sign already armed from before the busy window.
describe('controller ruling (a): busy is in the C15 key for #46', () => {
  it('Sign goes disabled the instant a stale poll clears busy; armed again only after a fresh 500 ms hold', async () => {
    const w = await openWindow();
    const {requestId} = await w.sign('https://jup.ag', 'hello');
    w.show();
    await settled(() => screen.getByText('Sign this message?'));
    await elapse(ARM_MS);
    expect((cta('Sign') as HTMLButtonElement).disabled).toBe(false);
    const s = await readDappSession(w.ext);
    await w.ext.session.set(DAPP_SESSION_KEY, {...s, queue: s.queue.map(e => (e.requestId === requestId ? {...e, state: 'deciding', decidedBy: runtimeFor(w.ext).instance, decidingAt: w.deps.clock.t} : e))});
    await elapse(POLL_MS);
    await settled(() => screen.getByRole('button', {name: 'Signing…'}));
    // The stale poll: the background's own state goes back to a plain request (not deciding) with no action from the
    // user — exactly what a slow, outdated `dapp.pending` resolving late would show. Assert the instant the button
    // reappears (not after a further sleep): the 500 ms re-arm must not have had time to finish by then.
    await w.ext.session.set(DAPP_SESSION_KEY, s);
    // B1c-3 Task 9: the window's own next poll (its only timer left), on the harness's clock.
    await nextTimer();
    // Fix round 2: useArmed derives `armed` by comparing the current key to the key the hold last finished for, so
    // the busy→false key change disarms in the SAME render as the commit. Mutation M9e (busy dropped from the key)
    // turns this red, but this window-level check is NOT the proof of the same-render disarm: the check runs after
    // React has flushed, so FR2-M1 (the old effect-only reset) turned it red only about 1 run in 10 on the wall clock
    // (task 9 report) and never on the harness's clock (B1c-3 plan 3 Task 9: 0 of 3 runs). The deterministic proof is useArmed.test.tsx, which FR2-M1 turns red every run (8/8); this test
    // pins the outcome the window must keep — disabled at once, then re-armed after the hold.
    const sign = await settled(() => screen.getByRole('button', {name: 'Sign'}));
    expect((sign as HTMLButtonElement).disabled).toBe(true);
    await elapse(ARM_MS - 1);
    expect((cta('Sign') as HTMLButtonElement).disabled).toBe(true);
    await elapse(1);
    expect((cta('Sign') as HTMLButtonElement).disabled).toBe(false);
  });
});
