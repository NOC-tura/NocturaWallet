// @vitest-environment happy-dom
import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {WalletProvider} from '../WalletContext';
import {Send} from '../screens/Send';
import {SECOND, sendingReader, setupWallet, type Wallet} from './harness';
import {App} from '../App';
import {createEngine, type Intent} from '../engine';
import {CONFIRM_TEXT} from '../screens/Confirm';
import {REVIEW_TEXT} from '../screens/Review';
import {STATUS_TEXT} from '../screens/Status';
import {FAILED_TEXT} from '../screens/Failed';
import {STUCK_TEXT} from '../screens/Stuck';
import {CANCELLED_TEXT} from '../ui/CancelledToast';
import {KNOWN_RECIPIENTS_KEY} from '../../background/knownRecipients';
import {satisfyChallenge} from '../../background/reauthChallenges';
import {clearSession, setSession} from '../../background/session';
import {STATE_POLL_MS, type Surface} from '../WalletContext';
import {firstSignature} from '../../../../core/solana/broadcast';
import {ACCOUNT} from '../../background/__tests__/fixtures';
import {COUNTERPARTY, failedTx, sentSol, sig} from '../../../e2e/historyFixtures';
import type {SolanaReader} from '../../../../core/solana/rpc';
import {SEND_TEXT} from '../screens/Send';

// The send flow wired into the shell (spec §1.6, §4.5): the UI tab's resume route is #20 (D38), the popup resumes a
// waiting send on open, and every way between the flow's screens. One tap per broadcast, whatever opened #20.
const INTENT: Intent = {token: 'SOL', recipient: COUNTERPARTY, amount: 10_000_000n};
const RESUME = `#/send/resume?account=${ACCOUNT.publicKey}`;

async function app(
  o: {surface?: Surface; hash?: string; prepare?: boolean; prove?: boolean; known?: boolean; gate?: (type: string) => Promise<void> | void; reader?: Partial<SolanaReader>} = {},
): Promise<Wallet & {sent: string[]; sends: () => number}> {
  const sent: string[] = [];
  const w = await setupWallet({
    surface: o.surface,
    reader: sendingReader(o.reader),
    deps: {now: () => Date.now(), broadcast: async wire => firstSignature(wire)},
    before: async ext => {
      if (o.known === true) await ext.local.set(KNOWN_RECIPIENTS_KEY, [COUNTERPARTY]);
    },
  });
  if (o.prepare !== false) {
    const p = await w.engine.prepareSend(ACCOUNT.publicKey, INTENT);
    if (!p.ok) throw new Error(p.error);
    if (o.prove === true && p.data.reauth !== null) await satisfyChallenge(w.ext, Date.now(), p.data.reauth.challengeId);
  }
  const engine = createEngine(async m => {
    const type = (m as {type: string}).type;
    sent.push(type);
    await o.gate?.(type);
    return w.transport(m);
  }, async () => undefined);
  render(<App surface={o.surface ?? 'popup'} engine={engine} platform={w.platform} hash={o.hash ?? ''} />);
  return {...w, engine, sent, sends: () => sent.filter(t => t === 'wallet.send').length};
}
const sendButton = async () => (await screen.findByRole('button', {name: /^Send 0\.0100 SOL$/})) as HTMLButtonElement;

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('the UI tab’s resume route is #20 (D38)', () => {
  it('after #10: "Confirmed…", read through wallet.preparedFor only — no send in 10 s; one tap sends once and #21 tracks it', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await app({surface: 'tab', hash: RESUME, prove: true});
    expect(await screen.findByText(CONFIRM_TEXT.confirmed)).toBeTruthy();
    await sendButton();
    await act(async () => void vi.advanceTimersByTime(10_000));
    expect(w.sends()).toBe(0);
    // The quiet provider: the state, and what #20 reads itself — no cache, balances or ping on a hand-over route.
    expect([...new Set(w.sent)].sort()).toEqual(['wallet.pending', 'wallet.preparedFor', 'wallet.prices', 'wallet.state']);
    fireEvent.click(await sendButton());
    expect(await screen.findByText(STATUS_TEXT.broadcasting)).toBeTruthy();
    expect(w.sends()).toBe(1);
    // Left the hand-over route: the tab is a wallet surface now, and runs the open sequence.
    await waitFor(() => expect(w.sent).toEqual(expect.arrayContaining(['wallet.cached', 'wallet.balances'])));
  });

  it('a send with no re-authentication (reauth: null), resumed: no send until the tap', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await app({surface: 'tab', hash: RESUME, known: true});
    expect(await screen.findByText(CONFIRM_TEXT.resume)).toBeTruthy();
    // Nothing stands between #20 and a broadcast but the tap: no challenge to prove.
    const held = await w.engine.preparedFor(ACCOUNT.publicKey);
    expect(held.ok && held.data !== null ? held.data.reauth : 'none').toBeNull();
    await act(async () => void vi.advanceTimersByTime(10_000));
    expect(w.sends()).toBe(0);
    fireEvent.click(await sendButton());
    await waitFor(() => expect(w.sends()).toBe(1));
  });

  it('page events on the resume route (online, focus, input) read nothing more — the provider stays quiet', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await app({surface: 'tab', hash: RESUME, known: true});
    await sendButton();
    const before = new Set(w.sent);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      window.dispatchEvent(new Event('focus'));
      vi.setSystemTime(Date.now() + 31_000);
      fireEvent.pointerDown(document);
      fireEvent.keyDown(document, {key: 'a'});
    });
    await act(async () => void vi.advanceTimersByTime(50));
    expect(new Set(w.sent)).toEqual(before);
    expect(w.sent).not.toContain('activity.ping');
  });

  it('nothing to resume: the flow starts at #12; a hash whose account is not an address is #11 (the hash only chooses a screen)', async () => {
    await app({surface: 'tab', hash: RESUME, prepare: false});
    expect(await screen.findByText('Send', {selector: '.title'})).toBeTruthy();
    expect((screen.getByLabelText('Recipient') as HTMLInputElement).value).toBe('');
    cleanup();
    await app({surface: 'tab', hash: '#/send/resume?account=not-an-address'});
    expect(await screen.findByText('TOKENS')).toBeTruthy();
  });

  it('the resume route on a locked wallet is the locked screen; with no wallet, the no-wallet screen (§7.1)', async () => {
    const w = await setupWallet({surface: 'tab', unlocked: false});
    render(<App surface="tab" engine={w.engine} platform={w.platform} hash={RESUME} />);
    expect(await screen.findByText('Welcome back')).toBeTruthy();
    cleanup();
    const n = await setupWallet({surface: 'tab', wallet: false});
    render(<App surface="tab" engine={n.engine} platform={n.platform} hash={RESUME} />);
    expect(await screen.findByText('No wallet on this browser yet.')).toBeTruthy();
  });
});

describe('the popup resumes a waiting send (§1.6 step 3)', () => {
  it('opened with a live prepared send: #20 "You have a send waiting." — nothing sent; [Cancel] → #11 with the toast, and nothing left', async () => {
    const w = await app();
    expect(await screen.findByText(CONFIRM_TEXT.resume)).toBeTruthy();
    expect(w.sends()).toBe(0);
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(await screen.findByText(CANCELLED_TEXT)).toBeTruthy();
    expect(screen.getByText('TOKENS')).toBeTruthy();
    expect(await w.engine.preparedFor(ACCOUNT.publicKey)).toEqual({ok: true, data: null});
  });

  it('a user who moved on before preparedFor answered stays where they went: no #20 pushed over them', async () => {
    const w = await setupWallet({reader: sendingReader(), deps: {now: () => Date.now()}});
    expect((await w.engine.prepareSend(ACCOUNT.publicKey, INTENT)).ok).toBe(true);
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => (release = r));
    const asked: string[] = [];
    const engine = createEngine(async m => {
      const type = (m as {type: string}).type;
      if (type === 'wallet.preparedFor') {
        asked.push(type);
        await held;
      }
      return w.transport(m);
    }, async () => undefined);
    render(<App surface="popup" engine={engine} platform={w.platform} hash="" />);
    await waitFor(() => expect(asked).toHaveLength(1));
    fireEvent.click(await screen.findByRole('button', {name: 'Receive'}));
    release();
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });
    expect(screen.queryByText(CONFIRM_TEXT.resume)).toBeNull();
  });

  it('a lock while preparedFor was out drops its answer: no #20 pushed under the locked screen; unlocked again, #11', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await setupWallet({reader: sendingReader(), deps: {now: () => Date.now()}});
    expect((await w.engine.prepareSend(ACCOUNT.publicKey, INTENT)).ok).toBe(true);
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => (release = r));
    let asked = 0;
    const engine = createEngine(async m => {
      const r = await w.transport(m);
      // The answer (a live prepared send) is held, not the question: it lands after the lock.
      if ((m as {type: string}).type === 'wallet.preparedFor' && ++asked === 1) await held;
      return r;
    }, async () => undefined);
    render(<App surface="popup" engine={engine} platform={w.platform} hash="" />);
    await waitFor(() => expect(asked).toBe(1));
    await clearSession(w.ext);
    await act(async () => void vi.advanceTimersByTime(STATE_POLL_MS + 50));
    expect(await screen.findByText('Welcome back')).toBeTruthy();
    release();
    await act(async () => void vi.advanceTimersByTime(50));
    await setSession(w.ext, [ACCOUNT]);
    await act(async () => void vi.advanceTimersByTime(STATE_POLL_MS + 50));
    expect(await screen.findByText('TOKENS')).toBeTruthy();
    // Checked again for the unlocked session (the lock took the prepared send with it): nothing to resume.
    await waitFor(() => expect(asked).toBe(2));
    await act(async () => void vi.advanceTimersByTime(50));
    expect(screen.queryByText(CONFIRM_TEXT.title)).toBeNull();
    expect(screen.queryByText('Send', {selector: '.title'})).toBeNull();
  });

  it('opened with nothing prepared: #11, and preparedFor was asked once', async () => {
    const w = await app({prepare: false});
    expect(await screen.findByText('TOKENS')).toBeTruthy();
    await waitFor(() => expect(w.sent.filter(t => t === 'wallet.preparedFor')).toHaveLength(1));
    expect(screen.queryByText(CONFIRM_TEXT.title)).toBeNull();
  });

  it('#20’s back arrow from a resume goes to #19 for the intent, with #12 under it holding the draft', async () => {
    await app({known: true});
    expect(await screen.findByText(CONFIRM_TEXT.resume)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(await screen.findByText(REVIEW_TEXT.passed)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(await screen.findByText('Send', {selector: '.title'})).toBeTruthy();
    expect((screen.getByLabelText('Recipient') as HTMLInputElement).value).toBe(COUNTERPARTY);
    expect((screen.getByLabelText('Amount') as HTMLInputElement).value).toBe('0.01');
  });

  it('a send from the resumed #20 → #21; [Done] on success → #11', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await app({known: true});
    fireEvent.click(await sendButton());
    expect(await screen.findByText(STATUS_TEXT.broadcasting)).toBeTruthy();
    // The background confirms it.
    const records = (await w.ext.local.get('v1_pending')) as {state: string}[];
    await w.ext.local.set('v1_pending', records.map(r => ({...r, state: 'confirmed'})));
    await act(async () => void vi.advanceTimersByTime(2_000));
    fireEvent.click(await screen.findByRole('button', {name: STATUS_TEXT.done}));
    expect(await screen.findByText('TOKENS')).toBeTruthy();
    // Fix round 1: #11 after a broadcast never says "No fees charged".
    await act(async () => void vi.advanceTimersByTime(50));
    expect(screen.queryByText(CANCELLED_TEXT)).toBeNull();
  });
});

/** The pending records the background holds; a test moves them as the background's poller would. */
async function setRecords(w: Wallet, change: (r: Record<string, unknown>) => Record<string, unknown>): Promise<void> {
  const records = (await w.ext.local.get('v1_pending')) as Record<string, unknown>[];
  await w.ext.local.set('v1_pending', records.map(change));
}
const count = (w: {sent: string[]}, type: string) => w.sent.filter(t => t === type).length;

describe('the flow’s routes (Tasks 8–12 carries)', () => {
  /** From the resumed #20 back to #19, which shows the live prepared send again: the flow's own #19. */
  async function atReview(o: {gate?: (type: string) => Promise<void> | void} = {}) {
    const w = await app({known: true, ...o});
    expect(await screen.findByText(CONFIRM_TEXT.resume)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(await screen.findByText(REVIEW_TEXT.passed)).toBeTruthy();
    return w;
  }

  it('#19’s Continue opens #20 bound to the prepared send #19 showed (a flow entry: no resume line) — and nothing is sent untapped', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await atReview();
    const shown = await w.engine.preparedFor(ACCOUNT.publicKey);
    fireEvent.click(screen.getByRole('button', {name: REVIEW_TEXT.continue}));
    await sendButton();
    expect(screen.getByText(CONFIRM_TEXT.title)).toBeTruthy();
    expect(screen.queryByText(CONFIRM_TEXT.resume)).toBeNull();
    await act(async () => void vi.advanceTimersByTime(5_000));
    expect(w.sends()).toBe(0);
    // Still the one #19 showed: #20 did not prepare another.
    const now = await w.engine.preparedFor(ACCOUNT.publicKey);
    expect(now.ok && now.data !== null ? now.data.id : null).toBe(shown.ok && shown.data !== null ? shown.data.id : 'none');
  });

  it('a prepare that superseded #19’s before #20 read it: #20 refuses and pops back to #19, which reviews again — nothing shown or sent', async () => {
    let hold = 0;
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => (release = r));
    let reached = false;
    const w = await atReview({
      gate: type => {
        if (type !== 'wallet.preparedFor' || hold === 0) return;
        hold += 1;
        // The first after Continue is #19's own re-check; the second is #20's read — held while another prepare lands.
        if (hold === 3) {
          reached = true;
          return held;
        }
      },
    });
    const before = await w.engine.preparedFor(ACCOUNT.publicKey);
    hold = 1;
    fireEvent.click(screen.getByRole('button', {name: REVIEW_TEXT.continue}));
    await waitFor(() => expect(reached).toBe(true));
    const other = await w.engine.prepareSend(ACCOUNT.publicKey, INTENT);
    expect(other.ok && before.ok && before.data !== null && other.data.id !== before.data.id).toBe(true);
    hold = 0;
    release();
    expect(await screen.findByText(REVIEW_TEXT.passed)).toBeTruthy();
    expect(screen.queryByText(CONFIRM_TEXT.title)).toBeNull();
    expect(screen.queryByRole('button', {name: /^Send 0\.0100 SOL$/})).toBeNull();
    expect(w.sends()).toBe(0);
  });

  /** A send from the resumed #20: #21 tracks the pending id #20's onTrack handed it. */
  async function sent() {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await app({known: true});
    fireEvent.click(await sendButton());
    expect(await screen.findByText(STATUS_TEXT.broadcasting)).toBeTruthy();
    const records = (await w.ext.local.get('v1_pending')) as {id: string}[];
    expect(records).toHaveLength(1);
    return w;
  }

  it('#21 follows the record #20’s onTrack handed it, by id — not any record of this account made since the tap', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    let planted = false;
    let ext: Wallet['ext'] | null = null;
    const w = await app({
      known: true,
      // #21's first read: a settled record of this account, made after the tap, is listed first. Only the id tells
      // #21 which one is its send.
      gate: async type => {
        if (type !== 'wallet.pending' || planted || ext === null || w.sends() === 0) return;
        planted = true;
        const records = (await ext.local.get('v1_pending')) as Record<string, unknown>[];
        const real = records[0] ?? {};
        await ext.local.set('v1_pending', [{...real, id: 'ef'.repeat(16), signature: '1'.repeat(64), createdAt: Date.now(), state: 'confirmed'}, ...records]);
      },
    });
    ext = w.ext;
    fireEvent.click(await sendButton());
    expect(await screen.findByText(STATUS_TEXT.broadcasting)).toBeTruthy();
    await act(async () => void vi.advanceTimersByTime(2_000));
    expect(planted).toBe(true);
    expect(screen.queryByRole('button', {name: STATUS_TEXT.done})).toBeNull();
    expect(screen.getByText(STATUS_TEXT.broadcasting)).toBeTruthy();
    await setRecords(w, r => (r.id === 'ef'.repeat(16) ? r : {...r, state: 'confirmed'}));
    await act(async () => void vi.advanceTimersByTime(2_000));
    expect(await screen.findByRole('button', {name: STATUS_TEXT.done})).toBeTruthy();
  });

  it('#21 → #44 on failure; [Try again] is a fresh prepare at #19 — never wallet.resend', async () => {
    const w = await sent();
    await setRecords(w, r => ({...r, state: 'failed', failure: 'not-sent', detail: 'The network did not take it.'}));
    await act(async () => void vi.advanceTimersByTime(2_000));
    expect(await screen.findByText(FAILED_TEXT.notSentHead)).toBeTruthy();
    const prepares = count(w, 'wallet.prepareSend');
    fireEvent.click(screen.getByRole('button', {name: FAILED_TEXT.tryAgain}));
    expect(await screen.findByText(REVIEW_TEXT.passed)).toBeTruthy();
    expect(count(w, 'wallet.prepareSend')).toBe(prepares + 1);
    expect(w.sent).not.toContain('wallet.resend');
    expect(w.sends()).toBe(1);
  });

  it('#44 (blockhash expired) [Edit transaction] → #12 holding the draft', async () => {
    const w = await sent();
    await setRecords(w, r => ({...r, state: 'expired', detail: null}));
    await act(async () => void vi.advanceTimersByTime(2_000));
    fireEvent.click(await screen.findByRole('button', {name: FAILED_TEXT.edit}));
    expect(await screen.findByText('Send', {selector: '.title'})).toBeTruthy();
    expect((screen.getByLabelText('Recipient') as HTMLInputElement).value).toBe(COUNTERPARTY);
    expect((screen.getByLabelText('Amount') as HTMLInputElement).value).toBe('0.01');
  });

  it('#21 → #54 at 90 s by its 1 Hz clock over the 2 s record; expired there, [Try again] is a fresh prepare at #19', async () => {
    const w = await sent();
    expect(screen.queryByText(STUCK_TEXT.title)).toBeNull();
    await act(async () => void vi.advanceTimersByTime(91_000));
    expect(await screen.findByText(STUCK_TEXT.title)).toBeTruthy();
    const elapsed = () => document.querySelector('.pending-counter .time')?.textContent;
    expect(elapsed()).toMatch(/^\d+:\d\d$/);
    const first = elapsed();
    await act(async () => void vi.advanceTimersByTime(1_000));
    expect(elapsed()).not.toBe(first);
    await setRecords(w, r => ({...r, state: 'expired', detail: null}));
    await act(async () => void vi.advanceTimersByTime(2_000));
    expect(await screen.findByText(STUCK_TEXT.expiredHead)).toBeTruthy();
    const prepares = count(w, 'wallet.prepareSend');
    fireEvent.click(screen.getByRole('button', {name: STUCK_TEXT.tryAgain}));
    expect(await screen.findByText(REVIEW_TEXT.passed)).toBeTruthy();
    expect(count(w, 'wallet.prepareSend')).toBe(prepares + 1);
    expect(w.sent).not.toContain('wallet.resend');
  });
});

describe('fix round 1: the toast, a lock, another account, no account', () => {
  it('Cancel → #11 left at once → back to #11: the toast is gone, not shown again', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    await app();
    expect(await screen.findByText(CONFIRM_TEXT.resume)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(await screen.findByText(CANCELLED_TEXT)).toBeTruthy();
    // Within the toast's 1.8 s: Receive, then back.
    fireEvent.click(screen.getByRole('button', {name: 'Receive'}));
    expect(screen.queryByText(CANCELLED_TEXT)).toBeNull();
    fireEvent.click(await screen.findByRole('button', {name: 'Back'}));
    expect(await screen.findByText('TOKENS')).toBeTruthy();
    expect(screen.queryByText(CANCELLED_TEXT)).toBeNull();
    // A tab change that lands on #11 is another stack too.
    fireEvent.click(screen.getByRole('button', {name: /Activity/}));
    fireEvent.click(screen.getByRole('button', {name: /Home/}));
    expect(await screen.findByText('TOKENS')).toBeTruthy();
    expect(screen.queryByText(CANCELLED_TEXT)).toBeNull();
  });

  /** Lock (the session cleared, seen by the 5 s state poll), then unlock again. */
  async function lockAndUnlock(w: Wallet): Promise<void> {
    await clearSession(w.ext);
    await act(async () => void vi.advanceTimersByTime(STATE_POLL_MS + 50));
    expect(await screen.findByText('Welcome back')).toBeTruthy();
    await setSession(w.ext, [ACCOUNT, SECOND]);
    await act(async () => void vi.advanceTimersByTime(STATE_POLL_MS + 50));
  }

  it('§7.1: a lock at #19 — unlocked, #12 holds the draft; no #19, and nothing prepares by itself', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await app({known: true});
    expect(await screen.findByText(CONFIRM_TEXT.resume)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(await screen.findByText(REVIEW_TEXT.passed)).toBeTruthy();
    const prepares = count(w, 'wallet.prepareSend');
    const reads = count(w, 'wallet.preparedFor');
    await lockAndUnlock(w);
    expect(await screen.findByText('Send', {selector: '.title'})).toBeTruthy();
    expect((screen.getByLabelText('Recipient') as HTMLInputElement).value).toBe(COUNTERPARTY);
    expect((screen.getByLabelText('Amount') as HTMLInputElement).value).toBe('0.01');
    await act(async () => void vi.advanceTimersByTime(1_000));
    expect(screen.queryByText(REVIEW_TEXT.title)).toBeNull();
    expect(count(w, 'wallet.prepareSend')).toBe(prepares);
    expect(count(w, 'wallet.preparedFor')).toBe(reads);
  });

  it('§7.1: a lock at #20 (resumed, no draft) — unlocked, #11; no #20, nothing read or prepared for it', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await app({known: true});
    expect(await screen.findByText(CONFIRM_TEXT.resume)).toBeTruthy();
    const prepares = count(w, 'wallet.prepareSend');
    const reads = count(w, 'wallet.preparedFor');
    await lockAndUnlock(w);
    expect(await screen.findByText('TOKENS')).toBeTruthy();
    await act(async () => void vi.advanceTimersByTime(1_000));
    expect(screen.queryByText(CONFIRM_TEXT.title)).toBeNull();
    expect(count(w, 'wallet.prepareSend')).toBe(prepares);
    expect(count(w, 'wallet.preparedFor')).toBe(reads);
    expect(w.sends()).toBe(0);
  });

  it('another account selected in another window: #19 for the old account → #11', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await app({known: true});
    expect(await screen.findByText(CONFIRM_TEXT.resume)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(await screen.findByText(REVIEW_TEXT.passed)).toBeTruthy();
    expect((await w.engine.select(SECOND.index)).ok).toBe(true);
    await act(async () => void vi.advanceTimersByTime(STATE_POLL_MS + 50));
    expect(await screen.findByText('TOKENS')).toBeTruthy();
    expect(screen.queryByText(REVIEW_TEXT.title)).toBeNull();
  });

  it('another account selected in another window: #20 (resumed) → #11 — never B’s balance against A’s send', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await app({known: true});
    expect(await screen.findByText(CONFIRM_TEXT.resume)).toBeTruthy();
    expect((await w.engine.select(SECOND.index)).ok).toBe(true);
    await act(async () => void vi.advanceTimersByTime(STATE_POLL_MS + 50));
    expect(await screen.findByText('TOKENS')).toBeTruthy();
    expect(screen.queryByText(CONFIRM_TEXT.title)).toBeNull();
    expect(w.sends()).toBe(0);
  });

  it('another account selected while #21 follows a sent record: #21 stays', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await app({known: true});
    fireEvent.click(await sendButton());
    expect(await screen.findByText(STATUS_TEXT.broadcasting)).toBeTruthy();
    expect((await w.engine.select(SECOND.index)).ok).toBe(true);
    await act(async () => void vi.advanceTimersByTime(STATE_POLL_MS + 50));
    expect(screen.getByText(STATUS_TEXT.broadcasting)).toBeTruthy();
    expect(screen.queryByText('TOKENS')).toBeNull();
  });

  it('#12 with no account known yet: Continue is disabled (and stays so for a click), nothing is prepared', async () => {
    const w = await setupWallet({reader: sendingReader(), before: async ext => void (await ext.local.set(KNOWN_RECIPIENTS_KEY, [COUNTERPARTY]))});
    const asked: string[] = [];
    const engine = createEngine(async m => {
      const type = (m as {type: string}).type;
      asked.push(type);
      const r = (await w.transport(m)) as {ok: boolean; data?: Record<string, unknown>};
      return type === 'wallet.state' && r.ok ? {...r, data: {...r.data, selected: null}} : r;
    }, async () => undefined);
    const reviewed: unknown[] = [];
    render(
      <WalletProvider engine={engine} platform={w.platform} surface="popup">
        <Send draft={{token: 'SOL', recipient: COUNTERPARTY, amount: '0.01'}} notice={null} onBack={() => undefined} onReview={(d, i) => void reviewed.push([d, i])} onViewPending={() => undefined} />
      </WalletProvider>,
    );
    expect(await screen.findByText('Send', {selector: '.title'})).toBeTruthy();
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });
    const cta = document.querySelector('.sticky-bar button') as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
    // Rule 6's lesson: lift `disabled` so the click reaches the handler — it still refuses.
    cta.disabled = false;
    fireEvent.click(cta);
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });
    expect(reviewed).toEqual([]);
    expect(asked).not.toContain('wallet.prepareSend');
  });
});

// Task 14: plan 1's stand-ins removed — #11's Send, the pending strip, #26's PENDING rows and #27's [Try again], wired.
describe('#11’s Send, the pending strip, #26’s PENDING rows, #27’s [Try again]', () => {
  /** A send made through the flow (#20's one tap), then the popup closed (#21 has no way back) and opened again: #11, the open send in its strip. */
  async function openSendAtHome() {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await app({known: true});
    fireEvent.click(await sendButton());
    expect(await screen.findByText(STATUS_TEXT.broadcasting)).toBeTruthy();
    cleanup();
    render(<App surface="popup" engine={w.engine} platform={w.platform} hash="" />);
    expect(await screen.findByText('Sending 0.01 SOL · pending')).toBeTruthy();
    return w;
  }
  /** The popup opened again, at #11. */
  const reopen = (w: Wallet) => {
    cleanup();
    render(<App surface="popup" engine={w.engine} platform={w.platform} hash="" />);
  };

  it('#11’s Send opens #12; with nothing open, nothing is prepared until Continue', async () => {
    const w = await app({prepare: false});
    fireEvent.click(await screen.findByRole('button', {name: 'Send'}));
    expect(await screen.findByText('Send', {selector: '.title'})).toBeTruthy();
    expect(count(w, 'wallet.prepareSend')).toBe(0);
  });

  it('a send open for the account: #11’s Send opens #12, which refuses a second send and offers [View it] → #21', async () => {
    const w = await openSendAtHome();
    const prepares = count(w, 'wallet.prepareSend');
    fireEvent.click(screen.getByRole('button', {name: 'Send'}));
    expect(await screen.findByText(SEND_TEXT.pending)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'View it'}));
    expect(await screen.findByText(STATUS_TEXT.broadcasting)).toBeTruthy();
    expect(count(w, 'wallet.prepareSend')).toBe(prepares);
    expect(w.sends()).toBe(1);
  });

  it('the strip opens #21 while broadcasting; #26’s PENDING row opens it too', async () => {
    const w = await openSendAtHome();
    fireEvent.click(screen.getByText('Sending 0.01 SOL · pending'));
    expect(await screen.findByText(STATUS_TEXT.broadcasting)).toBeTruthy();
    reopen(w);
    fireEvent.click(await screen.findByRole('button', {name: /Activity/}));
    fireEvent.click(await screen.findByText('Sending 0.01 SOL'));
    expect(await screen.findByText(STATUS_TEXT.broadcasting)).toBeTruthy();
    expect(w.sends()).toBe(1);
  });

  it('the record says stuck: the strip reads "taking longer than usual" and opens #54', async () => {
    const w = await openSendAtHome();
    await setRecords(w, r => ({...r, state: 'stuck'}));
    reopen(w);
    fireEvent.click(await screen.findByText('Sending 0.01 SOL · taking longer than usual'));
    expect(await screen.findByText(STUCK_TEXT.title)).toBeTruthy();
  });

  it('a stale strip (the record failed since #11 last read it) opens #44 from the record, not #21 from the strip', async () => {
    const w = await openSendAtHome();
    await setRecords(w, r => ({...r, state: 'failed', failure: 'not-sent', detail: 'The network did not take it.'}));
    fireEvent.click(screen.getByText('Sending 0.01 SOL · pending'));
    expect(await screen.findByText(FAILED_TEXT.notSentHead)).toBeTruthy();
    expect(screen.queryByText(STATUS_TEXT.broadcasting)).toBeNull();
    expect(w.sent).not.toContain('wallet.resend');
  });

  it('#20 [Cancel] → #11 with the toast; Send → #12 → back: the toast is not shown again', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    await app();
    expect(await screen.findByText(CONFIRM_TEXT.resume)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(await screen.findByText(CANCELLED_TEXT)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Send'}));
    expect(await screen.findByText('Send', {selector: '.title'})).toBeTruthy();
    expect(screen.queryByText(CANCELLED_TEXT)).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(await screen.findByText('TOKENS')).toBeTruthy();
    expect(screen.queryByText(CANCELLED_TEXT)).toBeNull();
  });

  it('#26 → a failed send’s #27 → [Try again] → #19 for its recipient and amount, a fresh prepare — never a resend, nothing sent', async () => {
    const at = Math.floor(Date.now() / 1000);
    const w = await app({
      prepare: false,
      known: true,
      reader: {
        getSignaturesForAddress: async () => [{signature: sig(5), blockTime: at, err: {InstructionError: [0, 'Custom']}}],
        getTransaction: async () => failedTx(ACCOUNT.publicKey, at),
      },
    });
    fireEvent.click(await screen.findByRole('button', {name: /Activity/}));
    await waitFor(() => expect(document.querySelector('button.tx-row:not([data-pending])')).not.toBeNull());
    fireEvent.click(document.querySelector('button.tx-row:not([data-pending])') as HTMLButtonElement);
    expect(await screen.findByText('FAILED · SENT')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Try again'}));
    expect(await screen.findByText(REVIEW_TEXT.passed)).toBeTruthy();
    expect(document.body.textContent).toContain(COUNTERPARTY);
    expect(document.body.textContent).toContain('0.001');
    expect(count(w, 'wallet.prepareSend')).toBe(1);
    expect(w.sent).not.toContain('wallet.resend');
    expect(w.sends()).toBe(0);
    // Cancel at #19 → #12, holding the fresh draft of that intent.
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect((await screen.findByLabelText('Recipient') as HTMLInputElement).value).toBe(COUNTERPARTY);
    expect((screen.getByLabelText('Amount') as HTMLInputElement).value).toBe('0.001');
  });

  // Fix round 1 #1: #27 carries its owner; with another account selected it offers no [Try again] (and #27 stays).
  it('another account selected while a failed send’s #27 is open: #27 stays, no [Try again], nothing prepared', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const at = Math.floor(Date.now() / 1000);
    const w = await app({
      prepare: false,
      known: true,
      reader: {
        getSignaturesForAddress: async () => [{signature: sig(5), blockTime: at, err: {InstructionError: [0, 'Custom']}}],
        getTransaction: async () => failedTx(ACCOUNT.publicKey, at),
      },
    });
    fireEvent.click(await screen.findByRole('button', {name: /Activity/}));
    await waitFor(() => expect(document.querySelector('button.tx-row:not([data-pending])')).not.toBeNull());
    fireEvent.click(document.querySelector('button.tx-row:not([data-pending])') as HTMLButtonElement);
    expect(await screen.findByRole('button', {name: 'Try again'})).toBeTruthy();
    expect((await w.engine.select(SECOND.index)).ok).toBe(true);
    await act(async () => void vi.advanceTimersByTime(STATE_POLL_MS + 50));
    await waitFor(() => expect(screen.queryByRole('button', {name: 'Try again'})).toBeNull());
    expect(screen.getByText('FAILED · SENT')).toBeTruthy();
    expect(count(w, 'wallet.prepareSend')).toBe(0);
    expect(w.sends()).toBe(0);
  });
});

// Fix round 2: #27 opened from #21 reads the history of the account #21 follows (the route's owner), never the selected one.
describe('#27 from #21 reads its owner’s history', () => {
  /** A's send through the flow, confirmed; A's history lists its signature (B's lists nothing). Each history read's address is kept. */
  async function confirmedFromA(o: {gate?: (type: string) => Promise<void> | void} = {}) {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const asked: string[] = [];
    let sentSig: string | null = null;
    const at = Math.floor(Date.now() / 1000);
    const w = await app({
      known: true,
      gate: o.gate,
      reader: {
        getSignaturesForAddress: async address => {
          asked.push(address);
          return address === ACCOUNT.publicKey && sentSig !== null ? [{signature: sentSig, blockTime: at, err: null}] : [];
        },
        getTransaction: async () => sentSol(ACCOUNT.publicKey, COUNTERPARTY, 10_000_000, at),
      },
    });
    fireEvent.click(await sendButton());
    expect(await screen.findByText(STATUS_TEXT.broadcasting)).toBeTruthy();
    const records = (await w.ext.local.get('v1_pending')) as {signature: string}[];
    sentSig = records[0]?.signature ?? null;
    expect(sentSig).not.toBeNull();
    await setRecords(w, r => ({...r, state: 'confirmed'}));
    await act(async () => void vi.advanceTimersByTime(2_000));
    expect(await screen.findByRole('button', {name: STATUS_TEXT.details})).toBeTruthy();
    // Another account (B) selected in another window: #21 stays with A's send.
    expect((await w.engine.select(SECOND.index)).ok).toBe(true);
    await act(async () => void vi.advanceTimersByTime(STATE_POLL_MS + 50));
    return {w, asked};
  }
  /** #27 shows A's send as A's: SENT, the amount out, From = A's address, To = the counterparty. */
  const framedAsA = async () => {
    expect(await screen.findByText('SENT')).toBeTruthy();
    expect(screen.queryByText('RECEIVED')).toBeNull();
    expect(screen.getByText('−0.0100 SOL')).toBeTruthy();
    const groups = [...document.querySelectorAll('.addr-groups')].map(g => [...g.children].map(c => c.textContent).join(''));
    expect(groups.slice(0, 2)).toEqual([ACCOUNT.publicKey, COUNTERPARTY]);
  };

  it('A’s send, B selected: View details → #27 searches A’s history and frames the row as A’s send', async () => {
    const {asked} = await confirmedFromA();
    const before = asked.length;
    fireEvent.click(screen.getByRole('button', {name: STATUS_TEXT.details}));
    await framedAsA();
    expect(asked.length).toBeGreaterThan(before);
    expect(asked.slice(before).every(a => a === ACCOUNT.publicKey)).toBe(true);
    expect(screen.queryByText('This transaction is not in the recent history yet.')).toBeNull();
  });

  it('the account switches back mid-search: the search goes on for A — its answer lands, framed as A’s', async () => {
    let hold: (() => void) | null = null;
    let holding = false;
    const {w, asked} = await confirmedFromA({
      gate: type => {
        if (type !== 'wallet.history' || !holding) return;
        holding = false;
        return new Promise<void>(resolve => (hold = resolve));
      },
    });
    const before = asked.length;
    holding = true;
    fireEvent.click(screen.getByRole('button', {name: STATUS_TEXT.details}));
    await waitFor(() => expect(hold).not.toBeNull());
    // Mid-search: A selected again, then B — neither restarts nor redirects the search.
    expect((await w.engine.select(ACCOUNT.index)).ok).toBe(true);
    await act(async () => void vi.advanceTimersByTime(STATE_POLL_MS + 50));
    expect((await w.engine.select(SECOND.index)).ok).toBe(true);
    await act(async () => void vi.advanceTimersByTime(STATE_POLL_MS + 50));
    (hold as unknown as () => void)();
    await framedAsA();
    expect(asked.slice(before).every(a => a === ACCOUNT.publicKey)).toBe(true);
    expect(count(w, 'wallet.history')).toBe(1);
  });
});

