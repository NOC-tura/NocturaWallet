// @vitest-environment happy-dom
import {cleanup, fireEvent, screen, waitFor} from '@testing-library/react';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {GRANTS_KEY} from '../../background/dapp/grants';
import {LIMITS_KEY} from '../../background/dapp/limits';
import {ACCOUNT} from '../../background/__tests__/fixtures';
import {openWindow} from './windowHarness';

const SELECTORS = selectorsOf(UI_SHEETS);
/** §2.3's second, and the two E2E B1c-19 allows — a literal: a deadline derived from POLL_MS would widen with a slower poll. */
const WITHIN_MS = 2_000;
afterEach(() => cleanup());

// Spec §4.3 and D11 (review M2): no password field in a window a site triggered; the request waits in the queue and the
// window switches to it when the unlock lands (it polls every second — E2E 19 allows two).
describe('the locked window (D11)', () => {
  it('Noctura mark, Q22, Q23, the request’s origin card and [Reject] — no input of any kind, no link', async () => {
    const w = await openWindow({unlocked: false});
    await w.connect('https://dapp.test');
    w.show();
    expect(await screen.findByText('Noctura is locked')).toBeTruthy();
    expect(screen.getByText("Click the Noctura icon in your browser's toolbar and unlock. This request will wait here.")).toBeTruthy();
    expect(document.querySelector('.s7-wordmark')?.textContent).toBe('noctura.');
    expect(document.querySelector('.s9-origin-card .dom')?.textContent).toBe('dapp.test');
    expect(document.querySelectorAll('input, select, textarea, a')).toHaveLength(0);
    expect(screen.getAllByRole('button').map(b => b.textContent)).toEqual(['Reject']);
    expect(unstyledClasses(document.querySelector('.app-approve')!, SELECTORS)).toEqual([]);
  });

  it('the unlock lands: within a poll the window shows #47 for the request', async () => {
    const w = await openWindow({unlocked: false});
    await w.connect('https://dapp.test');
    w.show();
    await screen.findByText('Noctura is locked');
    expect(await w.unlock()).toEqual({ok: true});
    expect(await screen.findByText('Connect to this app?', {}, {timeout: WITHIN_MS})).toBeTruthy();
  });

  it('a persistent grant: the unlock answers the request itself, and the window closes', async () => {
    const w = await openWindow({unlocked: false});
    await w.ext.local.set(GRANTS_KEY, [{origin: 'https://jup.ag', account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: 1, lastUsedAt: 1, recent: []}]);
    const {page, requestId} = await w.connect('https://jup.ag');
    w.show();
    await screen.findByText('Noctura is locked');
    await w.unlock();
    await waitFor(() => expect(w.closed.n).toBe(1), {timeout: WITHIN_MS});
    expect(page.answersFor(requestId)).toEqual([{requestId, result: {accounts: [ACCOUNT.publicKey]}}]);
  });

  it('[Reject] while locked rejects the request', async () => {
    const w = await openWindow({unlocked: false});
    const {page, requestId} = await w.connect('https://dapp.test');
    w.show();
    fireEvent.click(await screen.findByRole('button', {name: 'Reject'}));
    await waitFor(() => expect(w.closed.n).toBe(1));
    expect(page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);
  });

  // Fix round 1, I1: the background clears its one-shot notice flag on the very read that first sees it, locked or
  // not (decide.ts's `pending`) — the window must latch it, so it is not lost to the screen the user cannot act on.
  it('Q24 shows on the locked screen too, and survives into the unlocked screen once it does', async () => {
    const w = await openWindow({unlocked: false});
    await w.connect('https://dapp.test');
    await w.ext.local.set(LIMITS_KEY, {rejections: [], cooldowns: [], windows: [], notice: true});
    w.show();
    await screen.findByText('Noctura is locked');
    expect(screen.getByText('Too many requests from sites in the last few minutes — some were declined without asking you.')).toBeTruthy();
    expect(await w.unlock()).toEqual({ok: true});
    await screen.findByText('Connect to this app?', {}, {timeout: WITHIN_MS});
    expect(screen.getByText('Too many requests from sites in the last few minutes — some were declined without asking you.')).toBeTruthy();
  });
});
