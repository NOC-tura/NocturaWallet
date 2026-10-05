// @vitest-environment happy-dom
import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sendingReader, setupWallet, type Wallet, type WalletOptions} from './harness';
import {CONFIRM_TEXT, Confirm, type ConfirmEntry} from '../screens/Confirm';
import {createEngine, type Intent} from '../engine';
import {showLamports} from '../send/rules';
import {PENDING_POLL_MS, WalletProvider, type Surface} from '../WalletContext';
import {REVIEW_TEXT} from '../screens/Review';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {CONFIRM_STRIKE_KEY} from '../prefs';
import {REFUSED_TEXT} from '../ui/Banner';
import {KNOWN_RECIPIENTS_KEY} from '../../background/knownRecipients';
import {PENDING_KEY} from '../../background/pendingStore';
import {PREPARED_KEY} from '../../background/session';
import {CHALLENGE_MAX_LIFE_MS, satisfyChallenge} from '../../background/reauthChallenges';
import {firstSignature} from '../../../../core/solana/broadcast';
import {ACCOUNT, RECIPIENT, pendingRecord} from '../../background/__tests__/fixtures';
import {COUNTERPARTY} from '../../../e2e/historyFixtures';

// Spec §4.5 (#20): one tap per broadcast (D38), the quote's life (D39, C5), the loop guard, R2-M2 and R2-M3.
// The background is the real one (handleMessage over an in-memory Ext) on the real clock, so the prepared send's
// 30 s life and the screen's countdown read the same time; fake timers move both.
const SELECTORS = selectorsOf(UI_SHEETS);
const SMALL: Intent = {token: 'SOL', recipient: COUNTERPARTY, amount: 10_000_000n};
const LARGE: Intent = {token: 'SOL', recipient: COUNTERPARTY, amount: 4_000_000_000n};
const nav = {onBack: vi.fn(), onCancelled: vi.fn(), onTrack: vi.fn(), onReview: vi.fn(), onStartAgain: vi.fn(), onSuperseded: vi.fn()};

interface Setup {
  intent?: Intent;
  known?: boolean;
  prove?: boolean;
  entry?: 'flow' | 'resume';
  surface?: Surface;
  prepare?: boolean;
  before?: WalletOptions['before'];
  /** After the prepare, before #20 is shown (a pending send written then would have refused the prepare). */
  afterPrepare?: (ext: Wallet['ext']) => Promise<void>;
  /** The background's broadcast (default: answers at once with the transaction's signature). */
  broadcast?: (wire: Uint8Array) => Promise<string>;
  /** A flow entry's handed-over id (default: the id of the prepare above, as #19's Continue hands it). */
  preparedId?: string;
  /** Sees every message #20's client sends before the background does; may hold it. */
  gate?: (m: {type: string}) => Promise<void> | void;
  /** The UI tab's quiet provider (the hand-over route): it reads no pending of its own, so every read is #20's. */
  quiet?: boolean;
}
/** A wallet whose background holds a prepared send of `intent` (proven if asked), and #20 shown on it. */
async function renderConfirm(o: Setup = {}): Promise<Wallet & {sent: string[]; sends: () => number; challengeId: string | null; preparedId: string}> {
  const sent: string[] = [];
  const w = await setupWallet({
    reader: sendingReader(),
    deps: {now: () => Date.now(), broadcast: o.broadcast ?? (async wire => firstSignature(wire))},
    before: async ext => {
      if (o.known !== false) await ext.local.set(KNOWN_RECIPIENTS_KEY, [COUNTERPARTY]);
      await o.before?.(ext);
    },
  });
  let challengeId: string | null = null;
  let preparedId = 'f'.repeat(32);
  if (o.prepare !== false) {
    const p = await w.engine.prepareSend(ACCOUNT.publicKey, o.intent ?? SMALL);
    if (!p.ok) throw new Error(`prepare: ${p.error}`);
    challengeId = p.data.reauth?.challengeId ?? null;
    preparedId = p.data.id;
    if (o.prove === true && challengeId !== null) await satisfyChallenge(w.ext, Date.now(), challengeId);
  }
  await o.afterPrepare?.(w.ext);
  const engine = createEngine(async m => {
    sent.push((m as {type: string}).type);
    await o.gate?.(m as {type: string});
    return w.transport(m);
  }, async () => undefined);
  render(
    <WalletProvider engine={engine} platform={w.platform} surface={o.surface ?? 'popup'} quiet={o.quiet === true}>
      <Confirm account={ACCOUNT.publicKey} {...entryOf(o.entry ?? 'flow', o.preparedId ?? preparedId)} {...nav} />
    </WalletProvider>,
  );
  return {...w, engine, sent, sends: () => sent.filter(t => t === 'wallet.send').length, challengeId, preparedId};
}
/** #20's entry props: a flow entry carries the id #19 handed over (Task 8 ruling); a resume carries none. */
const entryOf = (entry: 'flow' | 'resume', preparedId: string): ConfirmEntry => (entry === 'flow' ? {entry, preparedId} : {entry});
const sendButton = async () => (await screen.findByRole('button', {name: /^Send /})) as HTMLButtonElement;

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  localStorage.clear();
});

describe('#20 tx-confirm — what it shows', () => {
  it('default: headline, review card, From/To in full, Network, the fee rows with dollars and the Total, the quote; Send, Cancel', async () => {
    const w = await renderConfirm();
    const send = await sendButton();
    expect(screen.getByText('4 of 4')).toBeTruthy();
    // index.html #s20: the top bar's title and step are the design's plain `.title` and `.step` (no type class: a
    // `.noc-h1` title wrapped and clipped on #54, a `.noc-overline` step read "4 OF 4") — Task 17 visual pass.
    expect(document.querySelector('.top-bar .title')?.className).toBe('title');
    expect(document.querySelector('.top-bar .step')?.className).toBe('step');
    const headline = document.querySelector('.headline') as HTMLElement;
    expect(headline.textContent).toBe(`Send 0.0100 SOL to ${COUNTERPARTY.match(/.{1,4}/g)?.join('')}`);
    expect(document.querySelector('.review-card .eyebrow')?.textContent).toBe(CONFIRM_TEXT.about);
    expect(document.querySelector('.review-card .fiat')?.textContent).toBe('≈ $1.50 USD');
    const detail = [...document.querySelectorAll('.detail-row')].map(r => [r.querySelector('.lbl')?.textContent, r.querySelector('.val')?.textContent]);
    expect(detail).toEqual([
      ['From', `Main${ACCOUNT.publicKey}`],
      ['To', COUNTERPARTY],
      ['Network', CONFIRM_TEXT.network],
    ]);
    const fees = [...document.querySelectorAll('.fee-row')].map(r => [...r.children].map(c => c.textContent));
    expect(fees).toEqual([
      ['Network fee', '0.000005 SOL', '$0.0007'],
      ['Priority', '0.00000005 SOL', '< $0.0001'],
      ['No Noctura fee (status unknown)', '', ''],
      ['Total', '0.01000505 SOL', '$1.50'],
    ]);
    // Spec §4.5: the SOL rows and the amount add up to the engine's own total.
    const prepared = await w.engine.preparedFor(ACCOUNT.publicKey);
    expect(prepared.ok && prepared.data?.solRequiredLamports).toBe(10_000_000n + 5_000n + 50n);
    // …and so do the rows as RENDERED (review L4): a dropped or mis-shown row fails here, not only on #19.
    const lamports = (sol: string) => {
      const [whole, frac = ''] = sol.replace(/ SOL$/, '').split('.');
      return BigInt(whole ?? '0') * 1_000_000_000n + BigInt(frac.padEnd(9, '0'));
    };
    const rendered = [...document.querySelectorAll('.fee-row:not(.total) .val')].map(v => v.textContent ?? '').filter(t => t !== '');
    const shownAmount = lamports((document.querySelector('.review-card .head .amount')?.textContent ?? '') + ' SOL');
    expect(rendered.reduce((sum, t) => sum + lamports(t), shownAmount)).toBe(prepared.ok ? prepared.data?.solRequiredLamports : -1n);
    expect(document.querySelector('.app-quote')?.textContent).toMatch(/^Quote valid (29|30) s · slot 271 408 921$/);
    expect(send.textContent).toBe('Send 0.0100 SOL');
    expect(send.disabled).toBe(false);
    expect(send.className).toBe('btn btn-primary');
    // index.html #s20's headline label, the whole address in groups of four.
    expect(headline.getAttribute('aria-label')).toBe(`Send 0.0100 SOL to recipient address ${COUNTERPARTY.match(/.{1,4}/g)?.join(' ')}`);
    expect(document.querySelector('.high-value-banner')).toBeNull();
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeTruthy();
    // Removed by decision: priority chips (D15), "Save as / Add to address book" (B1b-2b), typed CONFIRM (D22), DIRECT.
    expect(document.body.textContent).not.toMatch(/Normal|Fast|Instant|Save as|address book|Type CONFIRM|DIRECT|mainnet-beta/);
    expect(screen.queryByText(CONFIRM_TEXT.opensTab)).toBeNull();
    expect(unstyledClasses(document.querySelector('.s-conf')!, SELECTORS)).toEqual([]);
  });

  it('first-time recipient: its banner; under the CTA, "Confirmation opens in a new tab."', async () => {
    await renderConfirm({known: false});
    await sendButton();
    expect(screen.getByText(CONFIRM_TEXT.firstTitle)).toBeTruthy();
    expect(screen.getByText(CONFIRM_TEXT.firstLine)).toBeTruthy();
    expect(screen.getByText(CONFIRM_TEXT.opensTab)).toBeTruthy();
    expect(document.querySelector('.review-card')?.classList.contains('high-value')).toBe(false);
    expect(unstyledClasses(document.querySelector('.s-conf')!, SELECTORS)).toEqual([]);
  });

  it('high-value: the red card, "High-value transfer", the share of the balance, the password line in place of the typed field', async () => {
    await renderConfirm({intent: LARGE});
    await sendButton();
    expect(document.querySelector('.review-card')?.classList.contains('high-value')).toBe(true);
    expect(document.querySelector('.review-card .eyebrow')?.textContent).toBe(CONFIRM_TEXT.highValue);
    // 4 SOL × $150; 4 of 62.4821 SOL = 6 %.
    expect(document.querySelector('.review-card .fiat')?.textContent).toBe('≈ $600.00 USD · 6 % of your balance');
    expect(screen.getByText(CONFIRM_TEXT.reauthLine)).toBeTruthy();
    expect(screen.getByText(CONFIRM_TEXT.opensTab)).toBeTruthy();
    // The design's warning, kept beside the password line; "cancel now" in --danger; the CTA destructive, as drawn.
    expect(document.querySelector('.high-value-banner .help')?.textContent).toBe(`${CONFIRM_TEXT.reauthLine} If you didn't initiate this — cancel now.`);
    expect(document.querySelector('.high-value-banner .help .app-danger')?.textContent).toBe('cancel now');
    expect(document.querySelector('.headline')?.getAttribute('aria-label')).toBe(`High-value transfer: Send 4.0000 SOL to recipient address ${COUNTERPARTY.match(/.{1,4}/g)?.join(' ')}`);
    expect((await sendButton()).className).toBe('btn btn-destructive');
    expect((await sendButton()).disabled).toBe(false);
    expect(unstyledClasses(document.querySelector('.s-conf')!, SELECTORS)).toEqual([]);
  });

  it('high-value with the proof already made: the warning stays, the password line goes', async () => {
    await renderConfirm({intent: LARGE, known: false, prove: true, entry: 'resume'});
    await sendButton();
    expect(document.querySelector('.high-value-banner .help')?.textContent).toBe("If you didn't initiate this — cancel now.");
    expect(screen.queryByText(CONFIRM_TEXT.reauthLine)).toBeNull();
    expect(document.querySelector('.headline')?.getAttribute('aria-label')).toBe(`High-value transfer: Send 4.0000 SOL to first-time recipient address ${COUNTERPARTY.match(/.{1,4}/g)?.join(' ')}`);
  });

  it('in the UI tab, the proof is taken in this tab: the lines say so (controller addition)', async () => {
    await renderConfirm({intent: LARGE, surface: 'tab'});
    await sendButton();
    expect(screen.getByText(CONFIRM_TEXT.reauthLineTab)).toBeTruthy();
    expect(screen.getByText(CONFIRM_TEXT.opensHere)).toBeTruthy();
  });

  it('confirmed (a proven re-authentication): "Confirmed. Review the fresh quote and send." and no proof line; resume (unproven): "You have a send waiting."', async () => {
    await renderConfirm({known: false, prove: true, entry: 'resume'});
    await sendButton();
    expect(screen.getByText(CONFIRM_TEXT.confirmed)).toBeTruthy();
    expect(screen.queryByText(CONFIRM_TEXT.opensTab)).toBeNull();
    cleanup();
    await renderConfirm({known: false, entry: 'resume'});
    await sendButton();
    expect(screen.getByText(CONFIRM_TEXT.resume)).toBeTruthy();
  });

  it('pending + the quote’s end: no automatic re-prepare (the engine would say in-flight) — #20 stays, untouched (review L1)', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const record = pendingRecord({id: 'p1', account: ACCOUNT.publicKey, signature: '5'.repeat(88), createdAt: Date.now(), intent: {token: 'SOL', recipient: RECIPIENT, amount: '1'}});
    const w = await renderConfirm({afterPrepare: ext => ext.local.set(PENDING_KEY, [record])});
    expect(await screen.findByText(CONFIRM_TEXT.pending)).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(31_000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(w.sent.filter(t => t === 'wallet.prepareSend')).toEqual([]);
    expect(nav.onReview).not.toHaveBeenCalled();
    expect(screen.getByText(CONFIRM_TEXT.pending)).toBeTruthy();
  });

  it('pending: a send from this account is open → Send disabled, and its press does nothing even with `disabled` lifted', async () => {
    const record = pendingRecord({id: 'p1', account: ACCOUNT.publicKey, signature: '5'.repeat(88), createdAt: Date.now(), intent: {token: 'SOL', recipient: RECIPIENT, amount: '1'}});
    const w = await renderConfirm({afterPrepare: ext => ext.local.set(PENDING_KEY, [record])});
    expect(await screen.findByText(CONFIRM_TEXT.pending)).toBeTruthy();
    const send = await sendButton();
    expect(send.disabled).toBe(true);
    send.disabled = false;
    fireEvent.click(send);
    await act(async () => undefined);
    expect(w.sends()).toBe(0);
  });

  it('Send is never focused, and Enter does nothing — default, confirmed and resume (R2-L4)', async () => {
    for (const o of [{}, {known: false, prove: true, entry: 'resume' as const}, {entry: 'resume' as const}]) {
      cleanup();
      const w = await renderConfirm(o);
      const send = await sendButton();
      expect(document.activeElement).not.toBe(send);
      fireEvent.keyDown(document.activeElement ?? document.body, {key: 'Enter'});
      fireEvent.keyDown(document, {key: 'Enter'});
      await act(async () => undefined);
      expect(w.sends()).toBe(0);
    }
  });

  it('C5: at the quote’s end it re-prepares once by itself ("Updated…"), then, untouched, "Quote expired" [Refresh] — the stale banner gone, and no further prepare', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await renderConfirm();
    await sendButton();
    const prepares = () => w.sent.filter(t => t === 'wallet.prepareSend').length;
    await act(async () => void vi.advanceTimersByTime(30_000));
    await waitFor(() => expect(prepares()).toBe(1));
    expect(await screen.findByText(CONFIRM_TEXT.updated)).toBeTruthy();
    await act(async () => void vi.advanceTimersByTime(31_000));
    // Owner, 2026-10-05: once expired again, the line reads "Quote expired" + [Refresh] (no doubled "refresh"),
    // and the stale "Updated…" banner from the first auto re-prepare is gone — not replaced by any other banner.
    await waitFor(() => expect(document.querySelector('.app-quote')?.textContent).toBe(`${CONFIRM_TEXT.quoteExpired} ${CONFIRM_TEXT.refresh}`));
    expect(screen.queryByText(CONFIRM_TEXT.updated)).toBeNull();
    expect(document.querySelector('.banner')).toBeNull();
    expect((await sendButton()).disabled).toBe(true);
    await act(async () => void vi.advanceTimersByTime(120_000));
    expect(prepares()).toBe(1);
    expect(w.sends()).toBe(0);
    // [Refresh] is a tap: one prepare, and an activity.ping.
    fireEvent.click(screen.getByRole('button', {name: CONFIRM_TEXT.refresh}));
    await waitFor(() => expect(prepares()).toBe(2));
    expect(w.sent).toContain('activity.ping');
    await waitFor(() => expect(document.querySelector('.app-quote')?.textContent).toMatch(/^Quote valid/));
  });

  it('owner, 2026-10-05: the "Updated…" banner stays visible while the refreshed quote is still valid, before it expires again', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await renderConfirm();
    await sendButton();
    const prepares = () => w.sent.filter(t => t === 'wallet.prepareSend').length;
    await act(async () => void vi.advanceTimersByTime(30_000));
    await waitFor(() => expect(prepares()).toBe(1));
    expect(await screen.findByText(CONFIRM_TEXT.updated)).toBeTruthy();
    // Short of a second expiry: the banner stays, and the quote is not shown as expired yet.
    await act(async () => void vi.advanceTimersByTime(10_000));
    expect(screen.queryByText(CONFIRM_TEXT.updated)).toBeTruthy();
    expect(screen.queryByText(CONFIRM_TEXT.quoteExpired, {exact: false})).toBeNull();
  });

  it('any input since the automatic re-prepare allows one more (C5: "with no input since")', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await renderConfirm();
    await sendButton();
    const prepares = () => w.sent.filter(t => t === 'wallet.prepareSend').length;
    await act(async () => void vi.advanceTimersByTime(30_000));
    await waitFor(() => expect(prepares()).toBe(1));
    fireEvent.pointerDown(document.body);
    await act(async () => void vi.advanceTimersByTime(31_000));
    await waitFor(() => expect(prepares()).toBe(2));
    expect(screen.queryByText(CONFIRM_TEXT.quoteExpired, {exact: false})).toBeNull();
  });

  it('a resumed send whose quote expired is prepared again carrying its challenge (D39) — then shown', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await setupWallet({reader: sendingReader(), deps: {now: () => Date.now()}});
    const first = await w.engine.prepareSend(ACCOUNT.publicKey, SMALL);
    const challengeId = first.ok ? first.data.reauth?.challengeId : null;
    vi.advanceTimersByTime(31_000);
    const asked: unknown[] = [];
    const engine = createEngine(m => {
      if ((m as {type: string}).type === 'wallet.prepareSend') asked.push((m as {challengeId?: unknown}).challengeId);
      return w.transport(m);
    }, async () => undefined);
    render(
      <WalletProvider engine={engine} platform={w.platform} surface="tab">
        <Confirm account={ACCOUNT.publicKey} entry="resume" {...nav} />
      </WalletProvider>,
    );
    await sendButton();
    expect(asked).toEqual([challengeId]);
    expect(challengeId).toMatch(/^[0-9a-f]{32}$/);
  });

  it('[Cancel] while the quote’s end prepares it again (C5): the send that prepare makes is discarded too (E7) — nothing left', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await setupWallet({reader: sendingReader(), deps: {now: () => Date.now()}, before: ext => ext.local.set(KNOWN_RECIPIENTS_KEY, [COUNTERPARTY])});
    const handed = await w.engine.prepareSend(ACCOUNT.publicKey, SMALL);
    if (!handed.ok) throw new Error('prepare');
    let holding = false;
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => (release = r));
    const asked: string[] = [];
    const engine = createEngine(async m => {
      if ((m as {type: string}).type === 'wallet.prepareSend' && holding) {
        asked.push('prepareSend');
        await held;
      }
      return w.transport(m);
    }, async () => undefined);
    render(
      <WalletProvider engine={engine} platform={w.platform} surface="popup">
        <Confirm account={ACCOUNT.publicKey} entry="flow" preparedId={handed.data.id} {...nav} />
      </WalletProvider>,
    );
    await sendButton();
    holding = true;
    await act(async () => {
      vi.advanceTimersByTime(31_000);
    });
    await waitFor(() => expect(asked).toEqual(['prepareSend']));
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    await waitFor(() => expect(nav.onCancelled).toHaveBeenCalledTimes(1));
    release();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    await waitFor(async () => expect(await w.engine.preparedFor(ACCOUNT.publicKey)).toEqual({ok: true, data: null}));
  });

  it('a resume whose challenge passed C5’s 10-minute cap (the send itself young): prepared again with a fresh challenge, the tap opens #10 for THAT one — once, no loop, nothing sent (review M1)', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await setupWallet({reader: sendingReader(), deps: {now: () => Date.now()}});
    const start = Date.now();
    const first = await w.engine.prepareSend(ACCOUNT.publicKey, SMALL);
    const old = first.ok ? (first.data.reauth?.challengeId ?? '') : '';
    await satisfyChallenge(w.ext, Date.now(), old);
    // Kept alive by re-prepares carrying it (each rebases it), the last 10 s before the cap.
    while (Date.now() + 100_000 < start + CHALLENGE_MAX_LIFE_MS - 10_000) {
      vi.advanceTimersByTime(100_000);
      expect((await w.engine.prepareSend(ACCOUNT.publicKey, SMALL, old)).ok).toBe(true);
    }
    vi.advanceTimersByTime(start + CHALLENGE_MAX_LIFE_MS - 10_000 - Date.now());
    expect((await w.engine.prepareSend(ACCOUNT.publicKey, SMALL, old)).ok).toBe(true);
    vi.advanceTimersByTime(20_000);
    const asked: unknown[] = [];
    const sent: string[] = [];
    const engine = createEngine(m => {
      const type = (m as {type: string}).type;
      sent.push(type);
      if (type === 'wallet.prepareSend') asked.push((m as {challengeId?: unknown}).challengeId);
      return w.transport(m);
    }, async () => undefined);
    render(
      <WalletProvider engine={engine} platform={w.platform} surface="popup">
        <Confirm account={ACCOUNT.publicKey} entry="resume" {...nav} />
      </WalletProvider>,
    );
    const send = await sendButton();
    expect(asked).toEqual([old]);
    const now = await w.engine.preparedFor(ACCOUNT.publicKey);
    const fresh = now.ok ? now.data?.reauth?.challengeId : undefined;
    expect(fresh).toMatch(/^[0-9a-f]{32}$/);
    expect(fresh).not.toBe(old);
    expect(screen.queryByText(CONFIRM_TEXT.confirmed)).toBeNull();
    fireEvent.click(send);
    await waitFor(() => expect(w.platform.opened).toEqual([`unlock.html?mode=reauth&challenge=${fresh}`]));
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(asked).toEqual([old]);
    expect(sent.filter(t => t === 'wallet.send')).toEqual([]);
  });

  it('nothing to resume (discarded, or gone with its challenge): the flow starts at #12', async () => {
    await renderConfirm({prepare: false, entry: 'resume'});
    await waitFor(() => expect(nav.onStartAgain).toHaveBeenCalledWith(null));
  });

  it('[Cancel] discards the prepared send and its challenge (E7), then #11 — once; the back arrow and Esc keep it', async () => {
    const w = await renderConfirm({known: false});
    await sendButton();
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    await waitFor(() => expect(nav.onCancelled).toHaveBeenCalledTimes(1));
    expect(await w.engine.preparedFor(ACCOUNT.publicKey)).toEqual({ok: true, data: null});
    cleanup();
    const v = await renderConfirm();
    await sendButton();
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(nav.onBack).toHaveBeenCalledWith(SMALL);
    fireEvent.keyDown(document, {key: 'Escape'});
    expect(nav.onBack).toHaveBeenCalledTimes(1);
    expect((await v.engine.preparedFor(ACCOUNT.publicKey)).ok).toBe(true);
    expect(v.sent.filter(t => t === 'wallet.discardPrepared')).toEqual([]);
  });
});

// Final whole-branch review (plan 3): M1 — #20's [Cancel] handles a failed discard as #19 does; M4 — a pending send
// that settles while #20 is shown lifts its block without leaving the screen.
describe('#20 — a failed discard, and a pending send settling while shown (final review)', () => {
  /** The discard's transport throws twice (the engine retries a thrown transport once): `failed`. */
  const failingDiscard = () => {
    let failures = 2;
    return (m: {type: string}) => {
      if (m.type !== 'wallet.discardPrepared' || failures === 0) return undefined;
      failures -= 1;
      return Promise.reject(new Error('service worker restarting'));
    };
  };

  it('M1: [Cancel] whose discard fails stays on #20 with the line (as #19 does) — no toast over a prepared send left behind; [Cancel] again cancels', async () => {
    const w = await renderConfirm({gate: failingDiscard()});
    await sendButton();
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(await screen.findByText(REVIEW_TEXT.leaveFailed)).toBeTruthy();
    expect(nav.onCancelled).not.toHaveBeenCalled();
    expect((await w.engine.preparedFor(ACCOUNT.publicKey)).ok).toBe(true);
    expect(screen.getByText(CONFIRM_TEXT.title)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    await waitFor(() => expect(nav.onCancelled).toHaveBeenCalledTimes(1));
    expect(await w.engine.preparedFor(ACCOUNT.publicKey)).toEqual({ok: true, data: null});
  });

  it('M1: after a failed discard the screen is live again: the back arrow goes back, one tap sends once', async () => {
    const w = await renderConfirm({gate: failingDiscard()});
    await sendButton();
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(await screen.findByText(REVIEW_TEXT.leaveFailed)).toBeTruthy();
    fireEvent.click(await sendButton());
    await waitFor(() => expect(nav.onTrack).toHaveBeenCalledTimes(1));
    expect(w.sends()).toBe(1);
    expect(nav.onCancelled).not.toHaveBeenCalled();
    cleanup();
    vi.clearAllMocks();
    await renderConfirm({gate: failingDiscard()});
    await sendButton();
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(await screen.findByText(REVIEW_TEXT.leaveFailed)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(nav.onBack).toHaveBeenCalledWith(SMALL);
  });

  it('M1: unmounted while the discard is out (a lock, another account): the late answer navigates nothing', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => (release = r));
    await renderConfirm({gate: m => (m.type === 'wallet.discardPrepared' ? held : undefined)});
    await sendButton();
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    cleanup();
    await act(async () => release());
    await act(async () => new Promise(r => setTimeout(r, 50)));
    expect(nav.onCancelled).not.toHaveBeenCalled();
  });

  const open = () => pendingRecord({id: 'p1', account: ACCOUNT.publicKey, signature: '5'.repeat(88), createdAt: Date.now(), intent: {token: 'SOL', recipient: RECIPIENT, amount: '1'}});

  it('M4: the open send settles while #20 is shown — the next pending read lifts the block: the line goes, Send is enabled and sends on a tap', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const record = open();
    const w = await renderConfirm({afterPrepare: ext => ext.local.set(PENDING_KEY, [record])});
    expect(await screen.findByText(CONFIRM_TEXT.pending)).toBeTruthy();
    // The re-read's interval is set in an effect: flushed before the clock moves.
    await act(async () => undefined);
    expect((await sendButton()).disabled).toBe(true);
    await w.ext.local.set(PENDING_KEY, [{...record, state: 'confirmed'}]);
    await act(async () => void vi.advanceTimersByTime(PENDING_POLL_MS + 50));
    await waitFor(() => expect(screen.queryByText(CONFIRM_TEXT.pending)).toBeNull());
    await waitFor(async () => expect((await sendButton()).disabled).toBe(false));
    // Only #20's own reads: no prepare by itself while the quote is live.
    expect(w.sent.filter(t => t === 'wallet.prepareSend')).toEqual([]);
    fireEvent.click(await sendButton());
    await waitFor(() => expect(w.sends()).toBe(1));
  });

  it('M4: while it stays open the block stays, and the re-reads stop once #20 is gone', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await renderConfirm({afterPrepare: ext => ext.local.set(PENDING_KEY, [open()])});
    expect(await screen.findByText(CONFIRM_TEXT.pending)).toBeTruthy();
    // The re-read's interval is set in an effect: flushed before the clock moves.
    await act(async () => undefined);
    const reads = () => w.sent.filter(t => t === 'wallet.pending').length;
    const first = reads();
    await act(async () => void vi.advanceTimersByTime(PENDING_POLL_MS * 2 + 50));
    expect(reads()).toBeGreaterThan(first);
    expect(screen.getByText(CONFIRM_TEXT.pending)).toBeTruthy();
    expect((await sendButton()).disabled).toBe(true);
    cleanup();
    const gone = reads();
    await act(async () => void vi.advanceTimersByTime(PENDING_POLL_MS * 3));
    expect(reads()).toBe(gone);
  });

  it('M4: a re-read still out when the block lifted lands on nothing — a newer "open" answer after it never puts it back', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const record = open();
    let reads = 0;
    const releases: (() => void)[] = [];
    // The UI tab's quiet provider: every wallet.pending is #20's. The first (at mount) answers; the next two re-reads
    // are held, each until released, and answer what the background holds then.
    const w = await renderConfirm({
      surface: 'tab',
      quiet: true,
      afterPrepare: ext => ext.local.set(PENDING_KEY, [record]),
      gate: m => {
        if (m.type !== 'wallet.pending') return undefined;
        reads += 1;
        return reads === 2 || reads === 3 ? new Promise<void>(r => void releases.push(r)) : undefined;
      },
    });
    expect(await screen.findByText(CONFIRM_TEXT.pending)).toBeTruthy();
    // The re-read's interval is set in an effect: flushed before the clock moves.
    await act(async () => undefined);
    await act(async () => void vi.advanceTimersByTime(PENDING_POLL_MS * 2 + 50));
    expect(releases).toHaveLength(2);
    // The older re-read answers first: settled — the block lifts.
    await w.ext.local.set(PENDING_KEY, [{...record, state: 'confirmed'}]);
    await act(async () => releases[0]?.());
    await waitFor(() => expect(screen.queryByText(CONFIRM_TEXT.pending)).toBeNull());
    // The newer one, still out when the block lifted, answers "open": it lands on nothing.
    await w.ext.local.set(PENDING_KEY, [record]);
    await act(async () => releases[1]?.());
    await act(async () => void vi.advanceTimersByTime(50));
    expect(screen.queryByText(CONFIRM_TEXT.pending)).toBeNull();
    expect((await sendButton()).disabled).toBe(false);
  });
});

describe('#20 — one tap per broadcast (D38) and every answer of wallet.send', () => {
  it('reauth null: one tap → one wallet.send → #21 on that record; a second press inside the lock does nothing (rule 6, `disabled` lifted)', async () => {
    const w = await renderConfirm();
    const send = await sendButton();
    const before = Date.now();
    fireEvent.click(send);
    send.disabled = false;
    fireEvent.click(send);
    await waitFor(() => expect(nav.onTrack).toHaveBeenCalledTimes(1));
    expect(w.sends()).toBe(1);
    const [id, tapAt] = nav.onTrack.mock.calls[0] as [string, number];
    const pending = await w.engine.pending();
    expect(pending.ok && pending.data.map(p => [p.id, p.state])).toEqual([[id, 'pending']]);
    expect(tapAt).toBeGreaterThanOrEqual(before);
    expect(localStorage.getItem(CONFIRM_STRIKE_KEY) ?? '').toBe('');
  });

  it('while the tap’s send is in flight, [Cancel], the back arrow and Esc do nothing — pressed in the same act() as the tap (before any re-render: the guard itself), then again on the disabled Cancel', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => (release = r));
    const w = await renderConfirm({
      broadcast: async wire => {
        await held;
        return firstSignature(wire);
      },
    });
    const sendNow = await sendButton();
    const cancel = screen.getByRole('button', {name: 'Cancel'}) as HTMLButtonElement;
    // One act(): React has not re-rendered Cancel as disabled yet, so these reach cancel()/back() themselves.
    act(() => {
      fireEvent.click(sendNow);
      fireEvent.click(cancel);
      fireEvent.click(screen.getByRole('button', {name: 'Back'}));
      fireEvent.keyDown(document, {key: 'Escape'});
    });
    await waitFor(() => expect(w.sends()).toBe(1));
    expect(nav.onCancelled).not.toHaveBeenCalled();
    expect(nav.onBack).not.toHaveBeenCalled();
    // Re-rendered: Cancel is disabled (React drops a click on it even with the DOM attribute lifted).
    await waitFor(() => expect(cancel.disabled).toBe(true));
    cancel.disabled = false;
    fireEvent.click(cancel);
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    fireEvent.keyDown(document, {key: 'Escape'});
    release();
    await waitFor(() => expect(nav.onTrack).toHaveBeenCalledTimes(1));
    expect(nav.onCancelled).not.toHaveBeenCalled();
    expect(nav.onBack).not.toHaveBeenCalled();
    expect(w.sent.filter(t => t === 'wallet.discardPrepared')).toEqual([]);
  });

  it('the cancelled toast cannot follow a send (Task 11 carry): once a tap\'s send has answered and moved on, [Cancel] reports no cancel and discards nothing', async () => {
    const w = await renderConfirm();
    fireEvent.click(await sendButton());
    await waitFor(() => expect(nav.onTrack).toHaveBeenCalledTimes(1));
    // Still mounted here (the navigation is a spy): the press reaches cancel() itself.
    const cancel = screen.getByRole('button', {name: 'Cancel'}) as HTMLButtonElement;
    cancel.disabled = false;
    fireEvent.click(cancel);
    await act(async () => new Promise(r => setTimeout(r, 50)));
    expect(w.sends()).toBe(1);
    expect(nav.onCancelled).not.toHaveBeenCalled();
    expect(w.sent.filter(t => t === 'wallet.discardPrepared')).toEqual([]);
  });

  it('[Send] after [Cancel] while the discard is still out sends nothing, and the cancel completes (review fix 1): pressed in one act(), and one microtask apart', async () => {
    for (const order of ['one act()', 'one microtask apart'] as const) {
      cleanup();
      vi.clearAllMocks();
      let release: () => void = () => undefined;
      const held = new Promise<void>(r => (release = r));
      const w = await renderConfirm({gate: async m => (m.type === 'wallet.discardPrepared' ? held : undefined)});
      const send = await sendButton();
      const cancel = screen.getByRole('button', {name: 'Cancel'});
      if (order === 'one act()') {
        act(() => {
          fireEvent.click(cancel);
          fireEvent.click(send);
        });
      } else {
        fireEvent.click(cancel);
        await Promise.resolve();
        send.disabled = false;
        fireEvent.click(send);
      }
      await act(async () => new Promise(r => setTimeout(r, 50)));
      release();
      await waitFor(() => expect(nav.onCancelled).toHaveBeenCalledTimes(1));
      await act(async () => new Promise(r => setTimeout(r, 50)));
      expect(w.sends()).toBe(0);
      expect(nav.onTrack).not.toHaveBeenCalled();
    }
  });

  it('an unproven challenge: the tap opens #10 for it — a new tab from the popup (which closes), this tab in the UI tab — and sends nothing', async () => {
    const w = await renderConfirm({known: false});
    fireEvent.click(await sendButton());
    await waitFor(() => expect(w.platform.opened).toEqual([`unlock.html?mode=reauth&challenge=${w.challengeId}`]));
    expect(w.platform.closed).toBe(1);
    expect(w.sends()).toBe(0);
    cleanup();
    const t = await renderConfirm({known: false, surface: 'tab'});
    fireEvent.click(await sendButton());
    await waitFor(() => expect(t.platform.navigated).toEqual([`unlock.html?mode=reauth&challenge=${t.challengeId}`]));
    expect(t.platform.opened).toEqual([]);
    expect(t.sends()).toBe(0);
  });

  it('a stale unproven view (proven from another surface since #20 read it): the one tap re-reads, then sends — no second #10 (review L2)', async () => {
    const w = await renderConfirm({known: false});
    const send = await sendButton();
    expect(screen.queryByText(CONFIRM_TEXT.confirmed)).toBeNull();
    await satisfyChallenge(w.ext, Date.now(), w.challengeId ?? '');
    fireEvent.click(send);
    await waitFor(() => expect(nav.onTrack).toHaveBeenCalledTimes(1));
    expect(w.sends()).toBe(1);
    expect(w.platform.opened).toEqual([]);
  });

  it('a proven challenge: the tap sends — no second re-authentication', async () => {
    const w = await renderConfirm({known: false, prove: true, entry: 'resume'});
    fireEvent.click(await sendButton());
    await waitFor(() => expect(nav.onTrack).toHaveBeenCalledTimes(1));
    expect(w.sends()).toBe(1);
    expect(w.platform.opened).toEqual([]);
  });

  it('no resume sends before a tap: reauth null, proven, resumed after expiry, opened as the tab — 10 s untouched, zero wallet.send', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    for (const o of [{entry: 'resume' as const}, {known: false, prove: true, entry: 'resume' as const}, {entry: 'resume' as const, surface: 'tab' as const}]) {
      cleanup();
      const w = await renderConfirm(o);
      await sendButton();
      await act(async () => void vi.advanceTimersByTime(10_000));
      expect(w.sends()).toBe(0);
      fireEvent.click(await sendButton());
      await waitFor(() => expect(w.sends()).toBe(1));
    }
  });

  it('prepared-expired after the tap: fresh values and "Updated with a fresh network quote — review and send" — and no second send without a second tap', async () => {
    const w = await renderConfirm({known: false, prove: true});
    const send = await sendButton();
    // The quote ends between the tap and the engine taking it: the background's clock is 30 s on.
    const offset = {ms: 0};
    w.deps.now = () => Date.now() + offset.ms;
    offset.ms = 30_000;
    fireEvent.click(send);
    expect(await screen.findByText(CONFIRM_TEXT.updatedReview)).toBeTruthy();
    expect(w.sends()).toBe(1);
    expect(w.sent.filter(t => t === 'wallet.prepareSend').length).toBe(1);
    await act(async () => new Promise(r => setTimeout(r, 600)));
    expect(w.sends()).toBe(1);
    fireEvent.click(await sendButton());
    await waitFor(() => expect(nav.onTrack).toHaveBeenCalledTimes(1));
    expect(w.sends()).toBe(2);
  });

  it('reauth-required WITH a challengeId (the proof lapsed): "did not carry over", the next tap opens #10; the same strike twice → #12 with the draft', async () => {
    const w = await renderConfirm({known: false, prove: true, entry: 'resume'});
    const send = await sendButton();
    // The proof lapses: the challenge is no longer satisfied when the tap reaches the engine.
    const store = (await w.ext.session.get('v1_reauth')) as Record<string, {satisfied: boolean}>;
    await w.ext.session.set('v1_reauth', Object.fromEntries(Object.entries(store).map(([k, c]) => [k, {...c, satisfied: false}])));
    fireEvent.click(send);
    expect(await screen.findByText(CONFIRM_TEXT.notCarried)).toBeTruthy();
    // The send answered: [Cancel] is live again (it is disabled only while a send is out).
    expect((screen.getByRole('button', {name: 'Cancel'}) as HTMLButtonElement).disabled).toBe(false);
    expect(localStorage.getItem(CONFIRM_STRIKE_KEY)).toBe(w.challengeId);
    expect(w.platform.opened).toEqual([]);
    await act(async () => new Promise(r => setTimeout(r, 600)));
    fireEvent.click(await sendButton());
    await waitFor(() => expect(w.platform.opened).toEqual([`unlock.html?mode=reauth&challenge=${w.challengeId}`]));
    expect(w.sends()).toBe(1);
    // Back from #10 (a new #20), and the same confirmation does not carry over again: stop, #12 with the draft.
    cleanup();
    await satisfyChallenge(w.ext, Date.now(), w.challengeId ?? '');
    const engine = createEngine(m => w.transport(m), async () => undefined);
    render(
      <WalletProvider engine={engine} platform={w.platform} surface="tab">
        <Confirm account={ACCOUNT.publicKey} entry="resume" {...nav} />
      </WalletProvider>,
    );
    const again = await sendButton();
    const s2 = (await w.ext.session.get('v1_reauth')) as Record<string, {satisfied: boolean}>;
    await w.ext.session.set('v1_reauth', Object.fromEntries(Object.entries(s2).map(([k, c]) => [k, {...c, satisfied: false}])));
    fireEvent.click(again);
    await waitFor(() => expect(nav.onStartAgain).toHaveBeenCalledWith({token: 'SOL', recipient: COUNTERPARTY, amount: '0.01'}));
    expect(localStorage.getItem(CONFIRM_STRIKE_KEY)).toBe('');
  });

  it('reauth-required WITHOUT a challengeId (the engine consumed the send against a proof past its life, R2-M3): back to #19 with "Your confirmation expired"', async () => {
    const w = await renderConfirm({known: false, prove: true});
    const send = await sendButton();
    // The real background, driven by its state (review M5): the proof holds when sendPrepared peeks; the moment
    // takePrepared removes the prepared send — between the peek and consumeChallenge — the challenge's life ends.
    const area = w.ext.session;
    const write = area.set.bind(area);
    let armed = true;
    area.set = async (key, value) => {
      await write(key, value);
      if (key !== PREPARED_KEY || !armed) return;
      armed = false;
      const store = (await area.get('v1_reauth')) as Record<string, {expiresAt: number}>;
      await write('v1_reauth', Object.fromEntries(Object.entries(store).map(([k, c]) => [k, {...c, expiresAt: Date.now() - 1}])));
    };
    fireEvent.click(send);
    await waitFor(() => expect(nav.onReview).toHaveBeenCalledWith(SMALL, 'confirmation-expired'));
    expect(await w.engine.pending()).toEqual({ok: true, data: []});
  });

  it('check-pending (recorded, maybe broadcast): #21 tracks the record it names — never "nothing sent"', async () => {
    const w = await renderConfirm();
    const send = await sendButton();
    let writes = 0;
    const set = w.ext.local.set;
    w.ext.local.set = async (k, v) => {
      if (k === PENDING_KEY && ++writes >= 2) throw new Error('storage hiccup');
      return set(k, v);
    };
    fireEvent.click(send);
    await waitFor(() => expect(nav.onTrack).toHaveBeenCalledTimes(1));
    const [id] = nav.onTrack.mock.calls[0] as [string | null, number];
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('failed (nothing could be recorded, or nothing read back): #21 looks for this account’s record from the tap on', async () => {
    const w = await renderConfirm();
    const send = await sendButton();
    w.ext.local.set = async () => {
      throw new Error('storage down');
    };
    fireEvent.click(send);
    await waitFor(() => expect(nav.onTrack).toHaveBeenCalledWith(null, expect.any(Number)));
  });

  it('unknown-prepared after a tap with a record made since #20 was shown (another window sent it): #21 on that record, not #19 (R2-M2)', async () => {
    const w = await renderConfirm();
    const send = await sendButton();
    const other = await w.engine.preparedFor(ACCOUNT.publicKey);
    const elsewhere = other.ok && other.data !== null ? await w.engine.send(other.data.id) : null;
    fireEvent.click(send);
    await waitFor(() => expect(nav.onTrack).toHaveBeenCalledTimes(1));
    expect(nav.onTrack.mock.calls[0]?.[0]).toBe(elsewhere?.ok ? elsewhere.data.id : 'none');
    expect(nav.onReview).not.toHaveBeenCalled();
  });

  it('unknown-prepared with no record (discarded elsewhere): back to #19 for a fresh prepare', async () => {
    const w = await renderConfirm();
    const send = await sendButton();
    await w.engine.discardPrepared(ACCOUNT.publicKey);
    fireEvent.click(send);
    await waitFor(() => expect(nav.onReview).toHaveBeenCalledWith(SMALL, null));
    expect(nav.onTrack).not.toHaveBeenCalled();
  });
});

describe('#20 — the prepared send #19 handed over (Task 8 ruling), and answers that arrive after the screen went', () => {
  it('flow entry: a superseding prepare landed between #19’s Continue and #20 — #20 refuses, back to #19, shows and sends nothing', async () => {
    for (const other of [SMALL, LARGE]) {
      cleanup();
      vi.clearAllMocks();
      const sent: string[] = [];
      const w = await setupWallet({reader: sendingReader(), deps: {now: () => Date.now()}, before: ext => ext.local.set(KNOWN_RECIPIENTS_KEY, [COUNTERPARTY])});
      const shown = await w.engine.prepareSend(ACCOUNT.publicKey, SMALL);
      // #19 showed `shown` and its Continue handed over that id; then an abandoned review's prepare landed.
      const later = await w.engine.prepareSend(ACCOUNT.publicKey, other);
      if (!shown.ok || !later.ok) throw new Error('prepare');
      const engine = createEngine(m => {
        sent.push((m as {type: string}).type);
        return w.transport(m);
      }, async () => undefined);
      render(
        <WalletProvider engine={engine} platform={w.platform} surface="popup">
          <Confirm account={ACCOUNT.publicKey} entry="flow" preparedId={shown.data.id} {...nav} />
        </WalletProvider>,
      );
      await waitFor(() => expect(nav.onSuperseded).toHaveBeenCalledTimes(1));
      await act(async () => new Promise(r => setTimeout(r, 50)));
      expect(screen.queryByRole('button', {name: /^Send /})).toBeNull();
      expect(document.querySelector('.review-card')).toBeNull();
      expect(sent.filter(t => t === 'wallet.send' || t === 'wallet.prepareSend' || t === 'wallet.discardPrepared')).toEqual([]);
      expect(nav.onStartAgain).not.toHaveBeenCalled();
      expect(nav.onTrack).not.toHaveBeenCalled();
      // The superseding send is #19's to review again: left as it is.
      const held = await w.engine.preparedFor(ACCOUNT.publicKey);
      expect(held.ok && held.data?.id).toBe(later.data.id);
    }
  });

  it('flow entry: the handed-over send is gone (discarded elsewhere) — back to #19, not #12; nothing sent', async () => {
    const w = await renderConfirm({afterPrepare: async ext => ext.session.set(PREPARED_KEY, [])});
    await waitFor(() => expect(nav.onSuperseded).toHaveBeenCalledTimes(1));
    expect(nav.onStartAgain).not.toHaveBeenCalled();
    expect(w.sends()).toBe(0);
  });

  it('flow entry, the id matches: shown; the resume entry stays id-less and reads only preparedFor', async () => {
    const w = await renderConfirm();
    await sendButton();
    expect(nav.onSuperseded).not.toHaveBeenCalled();
    expect(w.sent[0]).toBe('wallet.preparedFor');
    cleanup();
    const r = await renderConfirm({entry: 'resume', preparedId: 'e'.repeat(32)});
    await sendButton();
    expect(nav.onSuperseded).not.toHaveBeenCalled();
    expect(r.sent[0]).toBe('wallet.preparedFor');
  });

  it('#20’s own C5 re-prepare moves the expected id: proven elsewhere after it, the one tap re-reads and sends (no #10)', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await renderConfirm({known: false});
    await sendButton();
    const prepares = () => w.sent.filter(t => t === 'wallet.prepareSend').length;
    await act(async () => void vi.advanceTimersByTime(30_000));
    await waitFor(() => expect(prepares()).toBe(1));
    expect(await screen.findByText(CONFIRM_TEXT.updated)).toBeTruthy();
    const now = await w.engine.preparedFor(ACCOUNT.publicKey);
    const id = now.ok ? now.data?.id : undefined;
    expect(id).not.toBe(w.preparedId);
    await satisfyChallenge(w.ext, Date.now(), now.ok ? (now.data?.reauth?.challengeId ?? '') : '');
    fireEvent.click(await sendButton());
    await waitFor(() => expect(nav.onTrack).toHaveBeenCalledTimes(1));
    expect(w.sends()).toBe(1);
    expect(w.platform.opened).toEqual([]);
  });

  it('the quote ends while #20’s own tap’s send is out (fix round 1 probe): no re-prepare, no #19 — the answer reaches #21', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => (release = r));
    const w = await renderConfirm({
      broadcast: async wire => {
        await held;
        return firstSignature(wire);
      },
    });
    await sendButton();
    await act(async () => void vi.advanceTimersByTime(25_000));
    fireEvent.click(await sendButton());
    await waitFor(() => expect(w.sends()).toBe(1));
    await act(async () => void vi.advanceTimersByTime(8_000));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(w.sent.filter(t => t === 'wallet.prepareSend')).toEqual([]);
    // [Refresh] is not offered over a send in flight either (Send's quote line stays).
    expect(screen.queryByRole('button', {name: CONFIRM_TEXT.refresh})).toBeNull();
    release();
    await waitFor(() => expect(nav.onTrack).toHaveBeenCalledTimes(1));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(40_000);
    });
    expect(nav.onReview).not.toHaveBeenCalled();
    expect(w.sent.filter(t => t === 'wallet.prepareSend')).toEqual([]);
    // Nothing left behind: the one prepared send went out, and no re-prepare made another.
    expect(await w.engine.preparedFor(ACCOUNT.publicKey)).toEqual({ok: true, data: null});
  });

  it('C5 with new fees: the re-prepare’s rows are shown, and the next tap sends THAT prepared send (its id, its fee)', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    let priced = false;
    const ids: string[] = [];
    const w = await renderConfirm({
      gate: m => {
        if (m.type === 'wallet.send') ids.push((m as unknown as {id: string}).id);
      },
    });
    // From now on the network asks for a priority fee: the re-prepare's quote differs from the first.
    w.deps.reader.getRecentPrioritizationFees = async () => {
      priced = true;
      return Array.from({length: 20}, () => ({prioritizationFee: 1_000_000}));
    };
    await sendButton();
    const before = [...document.querySelectorAll('.fee-row')].map(r => r.textContent);
    await act(async () => void vi.advanceTimersByTime(30_000));
    expect(await screen.findByText(CONFIRM_TEXT.updated)).toBeTruthy();
    expect(priced).toBe(true);
    const now = await w.engine.preparedFor(ACCOUNT.publicKey);
    if (!now.ok || now.data === null) throw new Error('no prepared send');
    const fresh = now.data;
    expect(fresh.id).not.toBe(w.preparedId);
    expect(fresh.fees.priorityLamports).not.toBe(50n);
    const rows = [...document.querySelectorAll('.fee-row')].map(r => [...r.children].map(c => c.textContent));
    expect(rows[1]?.slice(0, 2)).toEqual(['Priority', `${showLamports(fresh.fees.priorityLamports)} SOL`]);
    expect(rows[3]?.slice(0, 2)).toEqual(['Total', `${showLamports(fresh.solRequiredLamports)} SOL`]);
    expect([...document.querySelectorAll('.fee-row')].map(r => r.textContent)).not.toEqual(before);
    fireEvent.click(await sendButton());
    await waitFor(() => expect(nav.onTrack).toHaveBeenCalledTimes(1));
    expect(ids).toEqual([fresh.id]);
    const pending = await w.engine.pending();
    expect(pending.ok && pending.data[0]?.fee).toEqual({networkLamports: fresh.fees.networkLamports, markupLamports: fresh.fees.markupLamports});
  });

  it('a double tap inside one act(): exactly one wallet.send (rule 6, `disabled` lifted between)', async () => {
    const w = await renderConfirm();
    const send = await sendButton();
    act(() => {
      fireEvent.click(send);
      send.disabled = false;
      fireEvent.click(send);
      send.disabled = false;
      fireEvent.click(send);
    });
    await waitFor(() => expect(nav.onTrack).toHaveBeenCalledTimes(1));
    await act(async () => new Promise(r => setTimeout(r, 600)));
    expect(w.sends()).toBe(1);
  });

  it('unmounted while the send is out: the late answer navigates nothing and is handled once — the send itself is recorded', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => (release = r));
    const w = await renderConfirm({
      broadcast: async wire => {
        await held;
        return firstSignature(wire);
      },
    });
    fireEvent.click(await sendButton());
    await waitFor(() => expect(w.sends()).toBe(1));
    cleanup();
    release();
    await act(async () => new Promise(r => setTimeout(r, 50)));
    for (const f of Object.values(nav)) expect(f).not.toHaveBeenCalled();
    const pending = await w.engine.pending();
    expect(pending.ok && pending.data.map(p => p.state)).toEqual(['pending']);
  });

  it('another account shown while the send is out: the old answer does not move the new screen to #21', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => (release = r));
    const w = await setupWallet({
      reader: sendingReader(),
      deps: {
        now: () => Date.now(),
        broadcast: async wire => {
          await held;
          return firstSignature(wire);
        },
      },
      before: ext => ext.local.set(KNOWN_RECIPIENTS_KEY, [COUNTERPARTY]),
    });
    expect((await w.engine.prepareSend(ACCOUNT.publicKey, SMALL)).ok).toBe(true);
    const sent: string[] = [];
    const engine = createEngine(m => {
      sent.push((m as {type: string}).type);
      return w.transport(m);
    }, async () => undefined);
    const ui = (account: string) => (
      <WalletProvider engine={engine} platform={w.platform} surface="popup">
        <Confirm account={account} entry="resume" {...nav} />
      </WalletProvider>
    );
    const {rerender} = render(ui(ACCOUNT.publicKey));
    fireEvent.click(await sendButton());
    await waitFor(() => expect(sent.filter(t => t === 'wallet.send')).toHaveLength(1));
    rerender(ui(RECIPIENT));
    release();
    await act(async () => new Promise(r => setTimeout(r, 50)));
    expect(nav.onTrack).not.toHaveBeenCalled();
    expect(nav.onReview).not.toHaveBeenCalled();
  });

  it('unmounted during the tap’s re-read of an unproven view: no #10 opens, the popup stays', async () => {
    let hold = false;
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => (release = r));
    const w = await renderConfirm({
      known: false,
      gate: async m => {
        if (hold && m.type === 'wallet.preparedFor') await held;
      },
    });
    const send = await sendButton();
    hold = true;
    fireEvent.click(send);
    await waitFor(() => expect(w.sent.filter(t => t === 'wallet.preparedFor')).toHaveLength(2));
    cleanup();
    release();
    await act(async () => new Promise(r => setTimeout(r, 50)));
    expect(w.platform.opened).toEqual([]);
    expect(w.platform.navigated).toEqual([]);
    expect(w.platform.closed).toBe(0);
  });

  it('unmounted while an unknown-prepared answer looks for a record: nothing navigates', async () => {
    let hold = false;
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => (release = r));
    const w = await renderConfirm({
      gate: async m => {
        if (hold && m.type === 'wallet.pending') await held;
      },
    });
    const send = await sendButton();
    await w.engine.discardPrepared(ACCOUNT.publicKey);
    hold = true;
    fireEvent.click(send);
    await waitFor(() => expect(w.sends()).toBe(1));
    await waitFor(() => expect(w.sent.filter(t => t === 'wallet.pending').length).toBeGreaterThanOrEqual(2));
    cleanup();
    release();
    await act(async () => new Promise(r => setTimeout(r, 50)));
    expect(nav.onReview).not.toHaveBeenCalled();
    expect(nav.onTrack).not.toHaveBeenCalled();
  });

  it('a send answered `unreachable` (no answer in time): reported, and #21 looks for the record — never "nothing sent"; `coordinator-refused`: reported (D26), #20 stays', async () => {
    for (const error of ['unreachable', 'coordinator-refused'] as const) {
      cleanup();
      vi.clearAllMocks();
      const w = await setupWallet({reader: sendingReader(), deps: {now: () => Date.now()}, before: ext => ext.local.set(KNOWN_RECIPIENTS_KEY, [COUNTERPARTY])});
      const p = await w.engine.prepareSend(ACCOUNT.publicKey, SMALL);
      if (!p.ok) throw new Error('prepare');
      const engine = createEngine(async m => ((m as {type: string}).type === 'wallet.send' ? {ok: false, error} : w.transport(m)), async () => undefined);
      render(
        <WalletProvider engine={engine} platform={w.platform} surface="popup">
          <Confirm account={ACCOUNT.publicKey} entry="flow" preparedId={p.data.id} {...nav} />
        </WalletProvider>,
      );
      fireEvent.click(await sendButton());
      if (error === 'unreachable') {
        await waitFor(() => expect(nav.onTrack).toHaveBeenCalledWith(null, expect.any(Number)));
      } else {
        expect(await screen.findByText(REFUSED_TEXT)).toBeTruthy();
        await waitFor(async () => expect((await sendButton()).disabled).toBe(true));
        expect(nav.onTrack).not.toHaveBeenCalled();
        expect(nav.onReview).not.toHaveBeenCalled();
      }
    }
  });
});

// Carry 6 (D38): #20's tap() is the only caller of engine.send in the UI, and tap is wired to one Send button —
// a source backstop beside the behavioural tests above (which an auto-send effect fails).
// The backstop, not the proof (the behaviour tests and mutations above are): over the WHOLE of src/ (tests aside),
// a `send` member — called (`x.send(`, `x?.send(`, `x['send'](`), taken (`const f = x.send`) or destructured
// (`const {send} = x`) — other than the vault page's own `deps.send` appears only in #20's tap(), and the message
// name `wallet.send` — in any quote, as an object-literal value, bare, or as two literals joined — only in the
// background and in the UI engine's one client method. Not a security gate on its own (review M2): string assembly
// beyond a plain join would defeat any scan, and a regex literal holding a quote or `//` can fool the lexing below.
const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
/** Comments out, string literals kept: a `//` or `/*` inside a string is not a comment (it would hide the rest). */
const LEXEME = /('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`)|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;
const strip = (t: string) => t.replace(LEXEME, (_all, str: string | undefined) => str ?? ' ');
/** …and the insides of strings blanked too, so a message name ('wallet.send') is not a `.send` member — a template's `${…}` kept: it is code. */
const unquote = (t: string) =>
  strip(t)
    .replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, q => `${q[0]}${q[0]}`)
    .replace(/`(?:\\.|[^`\\])*`/g, q => `\`${[...q.matchAll(/\$\{([^{}`]*)\}/g)].map(m => `\${${m[1] ?? ''}}`).join('')}\``);
function sendSites(files: {path: string; text: string}[]): string[] {
  const out: string[] = [];
  for (const {path, text} of files) {
    const code = strip(text);
    const bare = unquote(text);
    const vault = path.startsWith('unlock/');
    const members = [...bare.matchAll(/(\w+)?\s*(?:\?\.|\.)\s*send\b(\s*\()?/g), ...code.matchAll(/(\w+)?\s*(?:\?\.)?\s*\[\s*['"`]send['"`]\s*\](\s*\()?/g)].filter(m => !(vault && m[1] === 'deps'));
    // `const {send} = x` and a parameter `({send}) =>` / `function f({send})`.
    const destructured = !vault && (/\{[^{}]*\bsend\b[^{}]*\}\s*=(?![=>])/.test(bare) || /\(\s*\{[^{}]*\bsend\b[^{}]*\}/.test(bare));
    if (path !== 'app/screens/Confirm.tsx') {
      if (members.some(m => m[2] !== undefined)) out.push(`${path}: a send( call`);
      else if (members.length > 0 || destructured) out.push(`${path}: takes send off an object`);
    }
    const named = /wallet\.send\b/.test(code) || /['"`]wallet\.?['"`]\s*\+\s*['"`]\.?send['"`]/.test(code);
    if (named && !path.startsWith('background/') && path !== 'app/engine.ts') out.push(`${path}: names wallet.send`);
  }
  return out;
}

describe('one caller of wallet.send (source backstop over all of src/)', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap(e => {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) return e === '__tests__' ? [] : files(p);
      return /\.(ts|tsx|mts|cts|mjs|cjs|js|jsx)$/.test(e) ? [p] : [];
    });
  it('fixtures: each form outside its two homes is caught; the vault page’s deps.send, the background and comments are not', () => {
    expect(sendSites([{path: 'unlock/screens/x.ts', text: "await deps.send({type:'wallet.send', id})"}])).toEqual(['unlock/screens/x.ts: names wallet.send']);
    expect(sendSites([{path: 'app/screens/Home.tsx', text: 'void engine.send(id);'}])).toEqual(['app/screens/Home.tsx: a send( call']);
    expect(sendSites([{path: 'app/screens/Home.tsx', text: "void engine['send'](id);"}])).toEqual(['app/screens/Home.tsx: a send( call']);
    expect(sendSites([{path: 'app/ui/x.tsx', text: 'chrome.runtime.sendMessage({type: "wallet.send", id})'}])).toEqual(['app/ui/x.tsx: names wallet.send']);
    expect(sendSites([{path: 'shared/x.ts', text: 'const t = `wallet.send`;'}])).toEqual(['shared/x.ts: names wallet.send']);
    // Every other shape of a send call, outside Confirm.tsx (Task 9 carry).
    for (const text of ['void engine?.send(id);', 'void engine . send (id);', 'void m.engine.send(id);', 'void engine["send"](id);', "void engine?.['send'](id);", 'await deps.send(x);', 'void engine\n  .send(id);']) {
      expect(sendSites([{path: 'app/screens/Home.tsx', text}])).toEqual(['app/screens/Home.tsx: a send( call']);
    }
    // In the background too: only the vault page's `deps` is its message channel.
    expect(sendSites([{path: 'background/x.ts', text: 'ws.send(data);'}])).toEqual(['background/x.ts: a send( call']);
    // send taken off an object, then called by another name.
    for (const text of ['const f = engine.send; void f(id);', 'const {send} = engine;', 'const {send: go} = useWallet().engine;', '[engine.send].map(f => f(id));', 'const go = ({send}: Engine) => send(id);', 'function go({send}: Engine) { void send(id); }', 'const t = `${engine.send}`;']) {
      expect(sendSites([{path: 'app/screens/Home.tsx', text}])).toEqual(['app/screens/Home.tsx: takes send off an object']);
    }
    // A string holding `//` or `/*` does not comment out the call after it (the old line-comment strip did).
    expect(sendSites([{path: 'app/screens/Home.tsx', text: "const s = ' //'; void engine.send(id);"}])).toEqual(['app/screens/Home.tsx: a send( call']);
    expect(sendSites([{path: 'app/screens/Home.tsx', text: "const s = '/*'; void engine.send(id); const t = '*/';"}])).toEqual(['app/screens/Home.tsx: a send( call']);
    // The message name in every quote and object-literal form, and as two literals joined.
    for (const text of ["send({type: 'wallet.send', id});", '({type: "wallet.send"});', "({'type': 'wallet.send'});", '({type: `wallet.send`});', "const T = {go: 'wallet.send'} as const;", "const t = 'wallet' + '.send';", "const t = 'wallet.' + 'send';"]) {
      expect(sendSites([{path: 'app/screens/Home.tsx', text}])).toEqual(['app/screens/Home.tsx: names wallet.send']);
    }
    expect(sendSites([{path: 'unlock/screens/y.ts', text: "void runtime({type: 'wallet.send', id});"}])).toEqual(['unlock/screens/y.ts: names wallet.send']);
    expect(sendSites([{path: 'app/engine.tsx', text: "({type: 'wallet.send'});"}])).toEqual(['app/engine.tsx: names wallet.send']);
    // Bare (not a string): a member and the name both.
    expect(sendSites([{path: 'app/screens/Home.tsx', text: 'if (t === wallet.send) go();'}])).toEqual(['app/screens/Home.tsx: takes send off an object', 'app/screens/Home.tsx: names wallet.send']);
    // Negative controls.
    expect(sendSites([{path: 'unlock/reauthFlow.ts', text: "const r = await deps.send({type: 'vault.reauthOk', challengeId});"}])).toEqual([]);
    expect(sendSites([{path: 'unlock/screens/restoreRun.ts', text: 'const out = await restoreWallet({send: deps.send, kdf: deps.kdf}, held, password); const {send} = deps;'}])).toEqual([]);
    expect(sendSites([{path: 'background/walletApi.ts', text: "case 'wallet.send': {"}])).toEqual([]);
    expect(sendSites([{path: 'app/engine.ts', text: "import {send as runtimeSend} from '../ui/send';\nsend: id => call({type: 'wallet.send', id}, SEND, pendingOf),"}])).toEqual([]);
    expect(sendSites([{path: 'app/screens/Home.tsx', text: '// never wallet.send here; engine.send(x) is #20’s\n/* engine.send(y) */'}])).toEqual([]);
    expect(sendSites([{path: 'app/screens/Home.tsx', text: "chrome.runtime.sendMessage(m); const a = 'wallet.resend'; const b = {type: 'wallet.sendMessage'}; const c = 'press .send now';"}])).toEqual([]);
    expect(sendSites([{path: 'app/screens/Home.tsx', text: 'const u = `https://x ${a.b}`; if (a === b) go(); const kind = {send: 1}.send2;'}])).toEqual([]);
  });

  it('the real tree: engine.send( only in screens/Confirm.tsx inside tap(), tap only the Send button’s onPress; wallet.send named only in background/ and app/engine.ts', () => {
    const all = files(SRC).map(p => ({path: relative(SRC, p), text: readFileSync(p, 'utf8')}));
    // Positive control: the walk reads the real tree, the vault page and the background included.
    expect(all.map(f => f.path)).toEqual(expect.arrayContaining(['app/screens/Confirm.tsx', 'app/engine.ts', 'unlock/reauthFlow.ts', 'background/walletApi.ts']));
    expect(sendSites(all)).toEqual([]);
    const confirm = strip(readFileSync(resolve(SRC, 'app/screens/Confirm.tsx'), 'utf8'));
    expect([...confirm.matchAll(/\.send\(/g)]).toHaveLength(1);
    // Every `send(` in #20 (fix round 1): engine.send(view.id) and the two send(view, tapAt) — no third, however
    // spelled; no bracket form; and the name `send` (outside strings) only those three and `const send`.
    const code = unquote(readFileSync(resolve(SRC, 'app/screens/Confirm.tsx'), 'utf8'));
    expect([...code.matchAll(/\bsend\s*\(/g)]).toHaveLength(3);
    expect([...confirm.matchAll(/\[\s*['"`]send['"`]\s*\]/g)]).toHaveLength(0);
    expect([...code.matchAll(/\bsend\b/g)]).toHaveLength(4);
    const body = confirm.slice(confirm.indexOf('const tap = async () => {'), confirm.indexOf('const refused ='));
    expect(body).toContain('engine.send(view.id)');
    // engine.send sits in `send`, which only tap() calls (twice: the proven-now path and the plain one).
    const tapBody = confirm.slice(confirm.indexOf('const tap = async () => {'), confirm.indexOf('const send = async'));
    expect([...confirm.matchAll(/\bsend\(view, tapAt\)/g)].length).toBe(2);
    expect([...tapBody.matchAll(/\bsend\(view, tapAt\)/g)].length).toBe(2);
    expect([...confirm.matchAll(/\btap\b/g)].length).toBe(2);
    expect(confirm).toContain('onPress={tap}');
  });
});
