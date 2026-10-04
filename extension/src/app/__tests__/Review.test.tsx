// @vitest-environment happy-dom
import {useEffect} from 'react';
import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {renderInWallet, sendingReader, setupWallet, type Wallet, type WalletOptions} from './harness';
import {REVIEW_TEXT, Review} from '../screens/Review';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {REFUSED_TEXT} from '../ui/Banner';
import {KNOWN_RECIPIENTS_KEY} from '../../background/knownRecipients';
import {BALANCE_CACHE_KEY} from '../../background/balanceCache';
import {PENDING_KEY} from '../../background/pendingStore';
import {RequestUnreachable, RpcForbidden, type SimulationOutcome} from '../../../../core/solana/rpc';
import {ACCOUNT, RECIPIENT, consistentSimulation, pendingRecord} from '../../background/__tests__/fixtures';
import {COUNTERPARTY} from '../../../e2e/historyFixtures';
import {createEngine, type Intent} from '../engine';
import {WalletProvider, useWallet} from '../WalletContext';

// Spec §4.4 (#19): the engine's prepare is this screen (E2). The harness wallet sends from Main: 62.4821 SOL,
// 4 200 NOC, 740.21 USDC; quiet fees (50 000 µlamports/CU), so a SOL send pays 5 000 + 50 lamports.
const SELECTORS = selectorsOf(UI_SHEETS);
const SOL: Intent = {token: 'SOL', recipient: COUNTERPARTY, amount: 10_000_000n};
const NOC: Intent = {token: 'NOC', recipient: COUNTERPARTY, amount: 12_000_000_000n};
const nav = {onCancel: vi.fn(), onConfirm: vi.fn(), onViewPending: vi.fn()};
const knownRecipient = async (ext: Wallet['ext']) => ext.local.set(KNOWN_RECIPIENTS_KEY, [COUNTERPARTY]);

/** #19 for `intent`, every message recorded (type, and the challengeId a prepare carried). */
async function renderReview(intent: Intent, o: WalletOptions & {notice?: 'confirmation-expired' | null} = {}) {
  const sent: {type: string; challengeId?: unknown}[] = [];
  const w = await renderInWallet(<Review account={ACCOUNT.publicKey} intent={intent} notice={o.notice ?? null} {...nav} />, {
    reader: sendingReader(),
    before: knownRecipient,
    ...o,
    gate: async m => {
      const msg = m as {type: string; challengeId?: unknown};
      sent.push({type: msg.type, challengeId: msg.challengeId});
      await o.gate?.(m);
    },
  });
  return {...w, sent, prepares: () => sent.filter(x => x.type === 'wallet.prepareSend')};
}
const ready = () => screen.findByText(REVIEW_TEXT.passed);
const rows = (card: string) => [...document.querySelectorAll(`.${card} .delta-row`)].map(r => [r.querySelector('.lbl')?.textContent, r.querySelector('.val')?.textContent ?? null]);
/** The re-review can land before React renders the simulating state: the same Continue, still inside its 500 ms lock (rule 6). */
const continueEnabled = () => waitFor(() => expect((screen.getByRole('button', {name: REVIEW_TEXT.continue}) as HTMLButtonElement).disabled).toBe(false));
const failing = (code: () => never) => sendingReader({simulateTransaction: async () => code()});

afterEach(() => vi.clearAllMocks());

describe('#19 tx-simulate', () => {
  it('simulating: the intent with the recipient in groups of four, the live "Building call", the skeleton, "Simulating…" disabled, Cancel', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => (release = r));
    await renderReview(SOL, {gate: m => ((m as {type: string}).type === 'wallet.prepareSend' ? held : undefined)});
    expect(await screen.findByText(REVIEW_TEXT.simulating)).toBeTruthy();
    expect(screen.getByText('Review transfer')).toBeTruthy();
    expect(screen.getByText('3 of 4')).toBeTruthy();
    expect(document.querySelector('.intent-card .amount')?.textContent).toBe('0.0100 SOL');
    expect([...document.querySelectorAll('.intent-card .to .addr-groups > span')].map(s => s.textContent)).toEqual(COUNTERPARTY.match(/.{1,4}/g));
    expect(document.querySelector('.step-pill')?.textContent).toMatch(/^Building call · \d+ ms$/);
    expect(document.querySelector('.m3-prog')).not.toBeNull();
    expect(screen.getByText(REVIEW_TEXT.simulatingFooter)).toBeTruthy();
    expect((screen.getByRole('button', {name: 'Simulating…'}) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeTruthy();
    expect(screen.queryByText(REVIEW_TEXT.continue)).toBeNull();
    expect(unstyledClasses(document.querySelector('.s-sim')!, SELECTORS)).toEqual([]);
    await act(async () => release());
    await ready();
  });

  it('ready, SOL: "Simulation passed", the three checks, the balance delta from the engine’s fee rows, After, the slot, Continue', async () => {
    const {ext} = await renderReview(SOL);
    await ready();
    expect(document.querySelector('.step-pill.is-ready')?.textContent).toBe('Ready · 0 ms');
    const checks = [...document.querySelectorAll('.check-row')].map(r => [r.className, r.querySelector('.ttl')?.textContent, r.querySelector('.meta')?.textContent, r.querySelector('.badge')?.textContent]);
    expect(checks).toEqual([
      ['check-row ok', 'No interactions with unknown contracts', 'SystemProgram · transfer only', 'PASS'],
      ['check-row ok', 'No token approvals granted', 'Native SOL transfer · zero allowances changed', 'PASS'],
      ['check-row ok', 'Recipient is a regular wallet', `no executable account at ${COUNTERPARTY.slice(0, 4)}…${COUNTERPARTY.slice(-4)}`, 'PASS'],
    ]);
    expect(rows('delta-card')).toEqual([
      ['Sending', '− 0.0100 SOL'],
      ['Network fee', '− 0.000005 SOL'],
      ['Priority', '− 0.00000005 SOL'],
      ['No Noctura fee (status unknown)', null],
      ['After', '62.47209495 SOL'],
    ]);
    // Spec §4.5: the SOL rows sum to solRequiredLamports, and before − solRequired is the After shown.
    const prepared = await ext.session.get('v1_prepared');
    const shown = (prepared as {shown: {solRequiredLamports: string}}[])[0]!.shown;
    expect(10_000_000n + 5_000n + 50n).toBe(BigInt(shown.solRequiredLamports));
    expect(62_482_100_000n - BigInt(shown.solRequiredLamports)).toBe(62_472_094_950n);
    expect(screen.getByText('271 408 921').closest('.footer-meta')?.textContent).toBe('Simulated against slot 271 408 921 · result valid for 30 s');
    expect(unstyledClasses(document.querySelector('.s-sim')!, SELECTORS)).toEqual([]);
  });

  it('ready, an SPL send creating the recipient’s token account: the token checks, the rent row, both Afters', async () => {
    await renderReview(NOC, {reader: sendingReader({getAccountExists: async () => false})});
    await ready();
    expect([...document.querySelectorAll('.check-row .meta')].slice(0, 2).map(m => m.textContent)).toEqual(["Token Program · transfer · creates the recipient's token account", 'Token transfer · zero allowances changed']);
    expect(rows('delta-card')).toEqual([
      ['Sending', '− 12.0000 NOC'],
      ['Network fee', '− 0.000005 SOL'],
      ['Priority', '− 0.00000325 SOL'],
      ['New token account', '− 0.00203928 SOL'],
      ['No Noctura fee (status unknown)', null],
      ['After', '62.48005247 SOL'],
      ['After', '4,188.0000 NOC'],
    ]);
  });

  it.each([
    ['missing', 'check-row ok', 'Recipient is a new address', 'no account exists yet — this transfer creates it', 'PASS'],
    ['program', 'check-row warn', 'Recipient is a program, not a wallet', 'funds sent to a program address may not be recoverable', 'WARNING'],
    ['other', 'check-row warn', 'Recipient is not a regular wallet', 'this address is owned by a program', 'WARNING'],
  ] as const)('the recipient kind %s: its own check row, never a refusal', async (kind, cls, ttl, meta, badge) => {
    await renderReview(SOL, {reader: sendingReader({getAccountKind: async () => kind})});
    await ready();
    const row = [...document.querySelectorAll('.check-row')][2]!;
    expect([row.className, row.querySelector('.ttl')?.textContent, row.querySelector('.meta')?.textContent, row.querySelector('.badge')?.textContent]).toEqual([cls, ttl, meta, badge]);
    expect(screen.getByRole('button', {name: REVIEW_TEXT.continue})).toBeTruthy();
  });

  const failedSim = (o: SimulationOutcome) => ({...o, err: {InstructionError: [2, {Custom: 1}]}, accounts: null});
  it.each<[string, Partial<Parameters<typeof sendingReader>[0]>, string, string | null, boolean]>([
    ['simulation-failed', {simulateTransaction: async () => failedSim({err: null, logs: [], unitsConsumed: 0, slot: 1, accounts: null})}, 'The network would reject this transfer', '{"InstructionError":[2,{"Custom":1}]}', true],
    ['simulation-mismatch', {simulateTransaction: async () => ({err: null, logs: [], unitsConsumed: 0, slot: 1, accounts: [{lamports: 1n, owner: '11111111111111111111111111111111', data: new Uint8Array(0)}]})}, 'Your balance changed while this was being checked', 'Review it again.', true],
    ['insufficient-sol', {getBalance: async () => 1_000_000n}, 'Not enough SOL for the network fee', '10005050 lamports needed, 1000000 held', false],
    ['sender-below-rent', {getBalance: async () => 10_100_000n}, REVIEW_TEXT.senderBelowRent, null, false],
    ['recipient-below-rent (a new account)', {getAccountKind: async () => 'missing'}, REVIEW_TEXT.recipientBelowRent, null, false],
    ['failed', {getLatestBlockhash: async () => Promise.reject(new Error('boom'))}, 'Something went wrong while checking this transfer.', null, true],
  ])('failed — %s: "Couldn\'t simulate", its banner, Retry only where a retry can help, never a way on', async (_name, over, title, line, retry) => {
    const intent = _name.startsWith('recipient-below-rent') ? {...SOL, amount: 890_879n} : SOL;
    await renderReview(intent, {reader: sendingReader(over)});
    expect(await screen.findByText(title)).toBeTruthy();
    expect(document.querySelector('.intent-card .eyebrow')?.textContent).toBe("Couldn't simulate");
    expect(document.querySelector('.banner.danger .banner-line')?.textContent ?? null).toBe(line);
    expect(screen.queryByRole('button', {name: REVIEW_TEXT.retry}) !== null).toBe(retry);
    // Review L6's negative control: no Continue in any failed state, enabled or not.
    expect(screen.queryByText(REVIEW_TEXT.continue)).toBeNull();
    expect(screen.queryByText(/Continue anyway|proceed at your own risk/)).toBeNull();
    expect(unstyledClasses(document.querySelector('.s-sim')!, SELECTORS)).toEqual([]);
  });

  it('failed — split-balance: "Send at most" the largest holding; insufficient-token names the token', async () => {
    const split = sendingReader({
      getTokenAccountsByOwner: async owner => [
        {pubkey: 'FpV5mr137k3GfLJqqWnZer12v2KxZfEEQzxXb6sJLABU', mint: 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW', owner, amount: 7_000_000_000n, decimals: 9},
        {pubkey: '4G8U5nQtNciNaEL7Zimb4DhqeanDMevXp7MLtFvUojwF', mint: 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW', owner, amount: 6_000_000_000n, decimals: 9},
      ],
    });
    await renderReview(NOC, {reader: split});
    expect(await screen.findByText('This token is spread across several accounts in your wallet. Send at most 7.0000 NOC, or move it into one account first.')).toBeTruthy();
    expect(screen.queryByRole('button', {name: REVIEW_TEXT.retry})).toBeNull();
    cleanup();
    // A holding above 2^53 base units: N is read as a BigInt, every unit exact (a Number would read …992).
    const huge = 9_007_199_254_740_993n;
    await renderReview(
      {...NOC, amount: huge + 1n},
      {
        reader: sendingReader({
          getTokenAccountsByOwner: async owner => [
            {pubkey: 'FpV5mr137k3GfLJqqWnZer12v2KxZfEEQzxXb6sJLABU', mint: 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW', owner, amount: huge, decimals: 9},
            {pubkey: '4G8U5nQtNciNaEL7Zimb4DhqeanDMevXp7MLtFvUojwF', mint: 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW', owner, amount: 6_000_000_000n, decimals: 9},
          ],
        }),
      },
    );
    expect(await screen.findByText('This token is spread across several accounts in your wallet. Send at most 9,007,199.254740993 NOC, or move it into one account first.')).toBeTruthy();
    cleanup();
    // More than the 4 200 NOC held in all: insufficient, naming the token.
    await renderReview({...NOC, amount: 5_000_000_000_000n});
    expect(await screen.findByText('Not enough NOC in this account.')).toBeTruthy();
    expect(screen.queryByRole('button', {name: REVIEW_TEXT.retry})).toBeNull();
    expect(screen.queryByText(REVIEW_TEXT.continue)).toBeNull();
  });

  it('failed — unreachable: the server line (never "offline" while the browser is online), the last known state from the cache, Retry', async () => {
    const at = Date.now() - 9 * 60_000;
    await renderReview(SOL, {
      reader: failing(() => {
        throw new RequestUnreachable('u', 'no answer');
      }),
      before: async ext => {
        await knownRecipient(ext);
        await ext.local.set(BALANCE_CACHE_KEY, {[ACCOUNT.publicKey]: {sol: '62482100000', noc: '0', usdc: '0', usdt: '0', at}});
      },
    });
    expect(await screen.findByText('No answer from the Noctura server within 20 s.')).toBeTruthy();
    expect(document.querySelector('.intent-card .eyebrow')?.textContent).toBe('Could not reach the Noctura server');
    expect(await screen.findByText('Last known state · 9 min ago')).toBeTruthy();
    expect(screen.getByText('Showing balance from cache · 62.4821 SOL')).toBeTruthy();
    expect(screen.getByText('Cannot verify recipient type')).toBeTruthy();
    expect(screen.getAllByText(/^(CACHED|UNKNOWN)$/).map(b => b.textContent)).toEqual(['CACHED', 'UNKNOWN']);
    expect(screen.getByRole('button', {name: REVIEW_TEXT.retry})).toBeTruthy();
  });

  it('failed — coordinator-refused: the D26 banner, Retry disabled', async () => {
    await renderReview(SOL, {
      reader: failing(() => {
        throw new RpcForbidden('simulateTransaction');
      }),
    });
    expect(await screen.findByText(REFUSED_TEXT)).toBeTruthy();
    expect((screen.getByRole('button', {name: REVIEW_TEXT.retry}) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each([
    ['coordinator-refused', () => new RpcForbidden('simulateTransaction'), ['refused']],
    ['unreachable', () => new RequestUnreachable('u', 'no answer'), ['unreachable', 'reconnecting']],
  ] as const)('a %s prepare goes through m.report: the whole app’s net state follows (review M4)', async (_code, error, mode) => {
    // Every mode the provider renders: its own balance read succeeds meanwhile, which takes an unreachable state on
    // to `reconnecting` in the same batch — a state only a report gets to from `online` (`reached` leaves online alone).
    const seen: string[] = [];
    function Net() {
      const mode = useWallet().net.mode;
      if (seen[seen.length - 1] !== mode) seen.push(mode);
      return null;
    }
    await renderInWallet(
      <>
        <Review account={ACCOUNT.publicKey} intent={SOL} notice={null} {...nav} />
        <Net />
      </>,
      {
        reader: failing(() => {
          throw error();
        }),
        before: knownRecipient,
      },
    );
    await screen.findByText(REVIEW_TEXT.retry);
    await waitFor(() => expect(seen.filter(x => x !== 'online')).not.toEqual([]));
    expect(seen.filter(x => x !== 'online').every(x => (mode as readonly string[]).includes(x))).toBe(true);
    expect(screen.queryByText('The network would reject this transfer')).toBeNull();
  });

  it('the D26 banner only for a coordinator-refused refusal: a refused net mode does not hide another refusal’s copy', async () => {
    function Refuse() {
      const {report} = useWallet();
      useEffect(() => report('coordinator-refused'), [report]);
      return null;
    }
    await renderInWallet(
      <>
        <Refuse />
        <Review account={ACCOUNT.publicKey} intent={SOL} notice={null} {...nav} />
      </>,
      {reader: sendingReader({getLatestBlockhash: async () => Promise.reject(new Error('boom'))}), before: knownRecipient},
    );
    expect(await screen.findByText('Something went wrong while checking this transfer.')).toBeTruthy();
    expect(screen.queryByText(REFUSED_TEXT)).toBeNull();
    // The app is in the D26 state: Retry offered (a retry can help this refusal) but disabled.
    expect((screen.getByRole('button', {name: REVIEW_TEXT.retry}) as HTMLButtonElement).disabled).toBe(true);
  });

  it('failed — in-flight: #12’s pending banner with [View it], no Retry', async () => {
    const record = pendingRecord({id: 'p1', account: ACCOUNT.publicKey, signature: '5'.repeat(88), createdAt: Date.now(), intent: {token: 'SOL', recipient: COUNTERPARTY, amount: '1'}});
    await renderReview(SOL, {
      before: async ext => {
        await knownRecipient(ext);
        await ext.local.set(PENDING_KEY, [record]);
      },
    });
    fireEvent.click(await screen.findByRole('button', {name: 'View it'}));
    expect(screen.getByText(REVIEW_TEXT.pending)).toBeTruthy();
    expect(nav.onViewPending).toHaveBeenCalledWith(expect.objectContaining({id: 'p1'}));
    expect(screen.queryByRole('button', {name: REVIEW_TEXT.retry})).toBeNull();
  });

  it('Retry prepares again — once per tap (rule 6, with `disabled` lifted)', async () => {
    let calls = 0;
    const flaky = sendingReader({
      getLatestBlockhash: async () => {
        calls += 1;
        if (calls === 1) throw new Error('first time');
        return {blockhash: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk', lastValidBlockHeight: 1000};
      },
    });
    const {prepares} = await renderReview(SOL, {reader: flaky});
    const retry = (await screen.findByRole('button', {name: REVIEW_TEXT.retry})) as HTMLButtonElement;
    fireEvent.click(retry);
    retry.disabled = false;
    fireEvent.click(retry);
    await ready();
    expect(prepares()).toHaveLength(2);
  });

  it('Continue hands over to #20 — once per tap (rule 6)', async () => {
    await renderReview(SOL);
    await ready();
    const go = screen.getByRole('button', {name: REVIEW_TEXT.continue}) as HTMLButtonElement;
    fireEvent.click(go);
    go.disabled = false;
    fireEvent.click(go);
    await waitFor(() => expect(nav.onConfirm).toHaveBeenCalledTimes(1));
    await new Promise(r => setTimeout(r, 50));
    expect(nav.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('Continue hands #20 the id of the prepared send it showed (the binding #20 checks)', async () => {
    const w = await renderReview(SOL);
    await ready();
    const held = await w.engine.preparedFor(ACCOUNT.publicKey);
    const id = held.ok ? held.data?.id : undefined;
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    fireEvent.click(screen.getByRole('button', {name: REVIEW_TEXT.continue}));
    await waitFor(() => expect(nav.onConfirm).toHaveBeenCalledWith(id));
  });

  it('Continue after the same intent was prepared again elsewhere: the newer send is shown, then handed over by its own id', async () => {
    const w = await renderReview(SOL);
    await ready();
    const shown = await w.engine.preparedFor(ACCOUNT.publicKey);
    const again = await w.engine.prepareSend(ACCOUNT.publicKey, SOL);
    const [oldId, newId] = [shown.ok ? shown.data?.id : undefined, again.ok ? again.data.id : undefined];
    expect(newId).not.toBe(oldId);
    fireEvent.click(screen.getByRole('button', {name: REVIEW_TEXT.continue}));
    await new Promise(r => setTimeout(r, 20));
    expect(nav.onConfirm).not.toHaveBeenCalled();
    // The live one of this intent is shown again, not prepared anew (the two: #19's first and the test's own).
    expect(w.prepares()).toHaveLength(2);
    await continueEnabled();
    fireEvent.click(screen.getByRole('button', {name: REVIEW_TEXT.continue}));
    await waitFor(() => expect(nav.onConfirm).toHaveBeenCalledWith(newId));
    expect(nav.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('Continue past the prepared send’s 30 s life: reviewed again (prepared anew), never handed to #20 expired', async () => {
    const w = await renderReview(SOL);
    await ready();
    w.deps.clock.t += 30_000;
    fireEvent.click(screen.getByRole('button', {name: REVIEW_TEXT.continue}));
    await waitFor(() => expect(w.prepares()).toHaveLength(2));
    await ready();
    expect(nav.onConfirm).not.toHaveBeenCalled();
    const fresh = await w.engine.preparedFor(ACCOUNT.publicKey);
    await continueEnabled();
    fireEvent.click(screen.getByRole('button', {name: REVIEW_TEXT.continue}));
    await waitFor(() => expect(nav.onConfirm).toHaveBeenCalledWith(fresh.ok ? fresh.data?.id : 'none'));
  });

  it('Continue hands over only the prepared send shown: one the background replaced since is reviewed again, never passed to #20', async () => {
    const w = await renderReview(SOL);
    await ready();
    // Another prepare of this account (a late one from an abandoned review) lands after this one.
    expect((await w.engine.prepareSend(ACCOUNT.publicKey, NOC)).ok).toBe(true);
    fireEvent.click(screen.getByRole('button', {name: REVIEW_TEXT.continue}));
    await waitFor(() => expect(w.prepares()).toHaveLength(2));
    await ready();
    expect(nav.onConfirm).not.toHaveBeenCalled();
    const now = await w.engine.preparedFor(ACCOUNT.publicKey);
    expect(now.ok && now.data?.intent).toEqual(SOL);
    await continueEnabled();
    fireEvent.click(screen.getByRole('button', {name: REVIEW_TEXT.continue}));
    await waitFor(() => expect(nav.onConfirm).toHaveBeenCalledTimes(1));
  });

  /** One press of each way back: only that press, nothing else that could discard. */
  const press = (leave: 'Cancel' | 'Back' | 'Escape') => {
    if (leave === 'Escape') fireEvent.keyDown(document, {key: 'Escape'});
    else fireEvent.click(screen.getByRole('button', {name: leave}));
  };
  it.each(['Cancel', 'Back', 'Escape'] as const)('%s alone discards the prepared send first (E7), then goes back to #12', async leave => {
    let discarded = false;
    const w = await renderReview(SOL);
    await ready();
    nav.onCancel.mockImplementation(() => {
      // Back to #12 only once the discard has answered.
      discarded = w.sent.some(x => x.type === 'wallet.discardPrepared');
    });
    press(leave);
    await waitFor(() => expect(nav.onCancel).toHaveBeenCalledTimes(1));
    expect(discarded).toBe(true);
    expect(w.sent.filter(x => x.type === 'wallet.discardPrepared')).toHaveLength(1);
    expect(await w.engine.preparedFor(ACCOUNT.publicKey)).toEqual({ok: true, data: null});
    nav.onCancel.mockReset();
  });

  it('a double press of the ways back leaves once: one discard, one #12 (rule 6)', async () => {
    const w = await renderReview(SOL);
    await ready();
    press('Cancel');
    press('Cancel');
    press('Back');
    press('Escape');
    await waitFor(() => expect(nav.onCancel).toHaveBeenCalledTimes(1));
    await new Promise(r => setTimeout(r, 20));
    expect(nav.onCancel).toHaveBeenCalledTimes(1);
    expect(w.sent.filter(x => x.type === 'wallet.discardPrepared')).toHaveLength(1);
  });

  it('a discard that fails keeps the user on #19 with a line, never back to #12 with the prepared send left behind; trying again leaves', async () => {
    let failures = 2; // the engine retries a thrown transport once
    const w = await renderReview(SOL, {
      gate: m => {
        if ((m as {type: string}).type !== 'wallet.discardPrepared' || failures === 0) return undefined;
        failures -= 1;
        return Promise.reject(new Error('service worker restarting'));
      },
    });
    await ready();
    press('Cancel');
    expect(await screen.findByText(REVIEW_TEXT.leaveFailed)).toBeTruthy();
    expect(nav.onCancel).not.toHaveBeenCalled();
    expect(screen.getByText(REVIEW_TEXT.passed)).toBeTruthy();
    press('Back');
    await waitFor(() => expect(nav.onCancel).toHaveBeenCalledTimes(1));
    expect(await w.engine.preparedFor(ACCOUNT.publicKey)).toEqual({ok: true, data: null});
  });

  it('a discard that fails while simulating: the cut-off simulation starts again, so the screen is never stuck', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => (release = r));
    let first = true;
    let failures = 2;
    await renderReview(SOL, {
      gate: m => {
        const type = (m as {type: string}).type;
        if (type === 'wallet.discardPrepared' && failures > 0) {
          failures -= 1;
          return Promise.reject(new Error('service worker restarting'));
        }
        if (type !== 'wallet.prepareSend' || !first) return undefined;
        first = false;
        return held;
      },
    });
    await screen.findByText(REVIEW_TEXT.simulating);
    press('Cancel');
    expect(await screen.findByText(REVIEW_TEXT.leaveFailed)).toBeTruthy();
    await ready();
    await act(async () => release());
    expect(nav.onCancel).not.toHaveBeenCalled();
  });

  it('a prepare that lands after the screen was left is discarded too: nothing outlives the review', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => (release = r));
    let first = true;
    const w = await renderReview(SOL, {
      gate: m => {
        if ((m as {type: string}).type !== 'wallet.prepareSend' || !first) return undefined;
        first = false;
        return held;
      },
    });
    await screen.findByText(REVIEW_TEXT.simulating);
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    await waitFor(() => expect(nav.onCancel).toHaveBeenCalledTimes(1));
    await act(async () => release());
    await waitFor(() => expect(w.sent.filter(x => x.type === 'wallet.discardPrepared')).toHaveLength(2));
    expect(await w.engine.preparedFor(ACCOUNT.publicKey)).toEqual({ok: true, data: null});
  });

  it('back from #20: a live prepared send of the same intent is shown again, not prepared anew; an expired one carries its challenge (D39)', async () => {
    // A first-time recipient: the prepare issues a challenge.
    const w = await renderReview(SOL, {before: async () => undefined});
    await ready();
    const first = await w.engine.preparedFor(ACCOUNT.publicKey);
    const challengeId = first.ok ? first.data?.reauth?.challengeId : undefined;
    expect(challengeId).toMatch(/^[0-9a-f]{32}$/);
    const again = async () => {
      cleanup();
      const sent: {type: string; challengeId?: unknown}[] = [];
      const engine = createEngine(async m => {
        const msg = m as {type: string; challengeId?: unknown};
        sent.push({type: msg.type, challengeId: msg.challengeId});
        return w.transport(m);
      }, async () => undefined);
      render(
        <WalletProvider engine={engine} platform={w.platform} surface="popup">
          <Review account={ACCOUNT.publicKey} intent={SOL} notice={null} {...nav} />
        </WalletProvider>,
      );
      await ready();
      return sent.filter(x => x.type === 'wallet.prepareSend');
    };
    // Within the 30 s prepared life: shown again, nothing prepared.
    expect(await again()).toEqual([]);
    // Past it: prepared again, carrying the challenge, so the proof (if any) carries over.
    w.deps.clock.t += 30_000;
    expect(await again()).toEqual([{type: 'wallet.prepareSend', challengeId}]);
  });

  it('the notice from #20 (R2-M3): "Your confirmation expired — review again"', async () => {
    await renderReview(SOL, {notice: 'confirmation-expired'});
    expect(await screen.findByText(REVIEW_TEXT.confirmationExpired)).toBeTruthy();
    await ready();
    expect(screen.getByText(REVIEW_TEXT.confirmationExpired)).toBeTruthy();
  });

  describe('a late reply never becomes the state of a newer review (alive / generation after each await)', () => {
    /** #19 mounted directly, so a test can re-render it with a new draft or account; every message's type and intent recorded. */
    async function mount(gate: (m: {type: string}) => Promise<void> | void, reader = sendingReader()) {
      const sent: {type: string; intent?: {amount: string}; account?: string}[] = [];
      const w = await setupWallet({
        reader,
        before: knownRecipient,
        gate: async m => {
          sent.push(m as (typeof sent)[number]);
          await gate(m as {type: string});
        },
      });
      const view = (account: string, intent: Intent) => (
        <WalletProvider engine={w.engine} platform={w.platform} surface="popup">
          <Review account={account} intent={intent} notice={null} {...nav} />
        </WalletProvider>
      );
      const r = render(view(ACCOUNT.publicKey, SOL));
      return {w, sent, rerender: (account: string, intent: Intent) => r.rerender(view(account, intent))};
    }
    const holdFirst = (type: string) => {
      let release: () => void = () => undefined;
      const held = new Promise<void>(r => (release = r));
      let first = true;
      const gate = (m: {type: string}) => {
        if (m.type !== type || !first) return undefined;
        first = false;
        return held;
      };
      return {gate, release: () => act(async () => release())};
    };
    const amountShown = () => document.querySelector('.intent-card .amount')?.textContent;

    it('a new draft while the old one prepares: the old prepare, landing last, never shows; Continue re-reviews the new one', async () => {
      const h = holdFirst('wallet.prepareSend');
      const {w, sent, rerender} = await mount(h.gate);
      await screen.findByText(REVIEW_TEXT.simulating);
      const B: Intent = {...SOL, amount: 20_000_000n};
      rerender(ACCOUNT.publicKey, B);
      await ready();
      expect(amountShown()).toBe('0.0200 SOL');
      await h.release();
      await waitFor(async () => {
        const held = await w.engine.preparedFor(ACCOUNT.publicKey);
        expect(held.ok && held.data?.intent.amount).toBe(10_000_000n);
      });
      // The old draft's prepared send landed last in the background; the screen still shows the new draft — its
      // intent, and what the engine prepared for it: B's delta, B's After (A's would read 62.47209495) …
      expect(amountShown()).toBe('0.0200 SOL');
      expect(screen.getByText(REVIEW_TEXT.passed)).toBeTruthy();
      expect(rows('delta-card')).toEqual([
        ['Sending', '− 0.0200 SOL'],
        ['Network fee', '− 0.000005 SOL'],
        ['Priority', '− 0.00000005 SOL'],
        ['No Noctura fee (status unknown)', null],
        ['After', '62.46209495 SOL'],
      ]);
      // … and Continue does not hand the old one to #20: it prepares the new draft again.
      fireEvent.click(screen.getByRole('button', {name: REVIEW_TEXT.continue}));
      await waitFor(() => expect(sent.filter(x => x.type === 'wallet.prepareSend').map(x => x.intent?.amount)).toEqual(['10000000', '20000000', '20000000']));
      await ready();
      expect(nav.onConfirm).not.toHaveBeenCalled();
      await continueEnabled();
      fireEvent.click(screen.getByRole('button', {name: REVIEW_TEXT.continue}));
      await waitFor(() => expect(nav.onConfirm).toHaveBeenCalledTimes(1));
    });

    it('a new draft while preparedFor is in flight: the old run prepares nothing', async () => {
      const h = holdFirst('wallet.preparedFor');
      const {sent, rerender} = await mount(h.gate);
      await screen.findByText(REVIEW_TEXT.simulating);
      rerender(ACCOUNT.publicKey, NOC);
      await ready();
      await h.release();
      await new Promise(r => setTimeout(r, 20));
      expect(sent.filter(x => x.type === 'wallet.prepareSend').map(x => x.intent?.amount)).toEqual(['12000000000']);
      expect(amountShown()).toBe('12.0000 NOC');
    });

    it('an account switch while preparing: the old account’s late prepare never shows, and is discarded', async () => {
      const h = holdFirst('wallet.prepareSend');
      const {w, sent, rerender} = await mount(h.gate);
      await screen.findByText(REVIEW_TEXT.simulating);
      rerender(RECIPIENT, SOL);
      await ready();
      await h.release();
      await waitFor(() => expect(sent.filter(x => x.type === 'wallet.discardPrepared').map(x => x.account)).toEqual([ACCOUNT.publicKey]));
      expect(await w.engine.preparedFor(ACCOUNT.publicKey)).toEqual({ok: true, data: null});
      const savings = await w.engine.preparedFor(RECIPIENT);
      expect(savings.ok && savings.data?.intent).toEqual(SOL);
      expect(screen.getByText(REVIEW_TEXT.passed)).toBeTruthy();
    });

    it('a new draft while the cache is read for an unreachable prepare: the old failure never shows', async () => {
      // Every wallet.cached once a prepare was sent is held: #19's own, and any the provider sends meanwhile (its
      // open sequence reads the cache too, and may do so while the prepare is in flight).
      let release: () => void = () => undefined;
      const held = new Promise<void>(r => (release = r));
      let prepared = false;
      let holding = 0;
      const h = {
        gate: (m: {type: string}) => {
          if (m.type === 'wallet.prepareSend') prepared = true;
          if (m.type !== 'wallet.cached' || !prepared) return undefined;
          holding += 1;
          return held;
        },
        release: () => act(async () => release()),
      };
      const base = sendingReader();
      let calls = 0;
      const reader = {
        ...base,
        simulateTransaction: async (tx: string, opts?: {accounts?: readonly string[]}) => {
          calls += 1;
          if (calls === 1) throw new RequestUnreachable('u', 'no answer');
          return consistentSimulation(base, tx, opts?.accounts ?? []);
        },
      } as typeof base;
      const {rerender} = await mount(h.gate, reader);
      await waitFor(() => expect(calls).toBe(1));
      await new Promise(r => setTimeout(r, 20));
      expect(holding).toBeGreaterThan(0);
      // Still simulating: the unreachable refusal waits on #19's cache read.
      expect(screen.getByText(REVIEW_TEXT.simulating)).toBeTruthy();
      rerender(ACCOUNT.publicKey, NOC);
      await ready();
      await h.release();
      await new Promise(r => setTimeout(r, 20));
      expect(screen.queryByText('No answer from the Noctura server within 20 s.')).toBeNull();
      expect(screen.getByText(REVIEW_TEXT.passed)).toBeTruthy();
    });

    it('a parent re-rendering the same intent (a new object, the same values) starts no new prepare', async () => {
      const {sent, rerender} = await mount(() => undefined);
      await ready();
      rerender(ACCOUNT.publicKey, {...SOL});
      rerender(ACCOUNT.publicKey, {token: 'SOL', recipient: COUNTERPARTY, amount: 10_000_000n});
      await new Promise(r => setTimeout(r, 20));
      expect(sent.filter(x => x.type === 'wallet.prepareSend' || x.type === 'wallet.preparedFor').map(x => x.type)).toEqual(['wallet.preparedFor', 'wallet.prepareSend']);
      expect(screen.getByText(REVIEW_TEXT.passed)).toBeTruthy();
    });

    it('unmounted while preparing (a lock, the popup closed): the late reply changes nothing', async () => {
      const h = holdFirst('wallet.prepareSend');
      const {w} = await mount(h.gate);
      await screen.findByText(REVIEW_TEXT.simulating);
      const errors = vi.spyOn(console, 'error');
      cleanup();
      await h.release();
      await new Promise(r => setTimeout(r, 20));
      expect(errors).not.toHaveBeenCalled();
      // Not left by Cancel / Back / Esc: the prepared send stays for #20's resume (a popup closed mid-review).
      const kept = await w.engine.preparedFor(ACCOUNT.publicKey);
      expect(kept.ok && kept.data?.intent).toEqual(SOL);
      errors.mockRestore();
    });
  });
});
