// @vitest-environment happy-dom
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {renderInWallet, setupWallet, walletReader, type WalletOptions} from './harness';
import {STUCK_TEXT, Stuck, mmss} from '../screens/Stuck';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {REFUSED_TEXT} from '../ui/Banner';
import {WalletProvider, useWallet, type WalletModel} from '../WalletContext';
import {PENDING_KEY} from '../../background/pendingStore';
import {COOLING_AGAIN_DETAIL, FORBIDDEN_DETAIL} from '../../background/sendTypes';
import {RpcCoolingDown, RpcForbidden} from '../../../../core/solana/rpc';
import {firstSignature} from '../../../../core/solana/broadcast';
import {base64} from '@scure/base';
import {ACCOUNT, RECIPIENT, pendingRecord, signedWire} from '../../background/__tests__/fixtures';
import type {Engine, Pending} from '../engine';

// Spec §4.8 (#54, D23): the design's layout, only the levers differ — "Send again" re-sends the same signed bytes.
const SELECTORS = selectorsOf(UI_SHEETS);
const nav = {onClose: vi.fn(), onActivity: vi.fn(), onTryAgain: vi.fn()};
const WIRE = signedWire(2_480_000_000n);
const SIGNATURE = firstSignature(WIRE);
const CREATED = 1_000_000_000_000;
const stored = (over: Partial<ReturnType<typeof pendingRecord>> = {}) =>
  pendingRecord({id: 'r1', account: ACCOUNT.publicKey, signature: SIGNATURE, wire: base64.encode(WIRE), createdAt: CREATED, lastSentAt: CREATED, state: 'stuck', lastValidBlockHeight: 1150, intent: {token: 'SOL', recipient: RECIPIENT, amount: '2480000000'}, ...over});
/** The view #21 hands #54: the stored record as wallet.pending answers it. */
const view = (over: Partial<Pending> = {}): Pending => ({
  id: 'r1',
  account: ACCOUNT.publicKey,
  signature: SIGNATURE,
  lastValidBlockHeight: 1150,
  createdAt: CREATED,
  lastSentAt: CREATED,
  state: 'stuck',
  detail: null,
  intent: {token: 'SOL', recipient: RECIPIENT, amount: 2_480_000_000n},
  expiryNullSeenAt: null,
  failure: null,
  fee: {networkLamports: 5_000n, markupLamports: 50n},
  ...over,
});

async function renderStuck(p: Pending, o: WalletOptions = {}, now = CREATED + 94_000) {
  const broadcasts: string[] = [];
  const w = await renderInWallet(<Stuck record={p} now={now} {...nav} />, {
    before: ext => ext.local.set(PENDING_KEY, [stored({state: p.state})]),
    deps: {
      now: () => CREATED + 94_000,
      broadcast: async wire => {
        broadcasts.push(base64.encode(wire));
        return firstSignature(wire);
      },
    },
    ...o,
  });
  return {...w, broadcasts};
}

type ResendReply = Awaited<ReturnType<Engine['resend']>>;
/** The provider's model as the screen sees it, and its net mode on screen. */
const probe: {m: WalletModel | null} = {m: null};
function Spy() {
  probe.m = useWallet();
  return <span data-testid="net">{probe.m.net.mode}</span>;
}

/**
 * #54 inside the real provider and background, with `wallet.resend` answered by the test (held until `answer`) — the
 * replies the real background gives only on a fault (a 403 or no answer at the transport, a shape it cannot read) —
 * and `show` to hand the same screen another record, or none (it unmounts; the provider stays).
 */
async function mountStuck(p: Pending, o: WalletOptions = {}) {
  let answer: (r: ResendReply) => void = () => undefined;
  const asked: string[] = [];
  const w = await setupWallet({before: ext => ext.local.set(PENDING_KEY, [stored()]), ...o});
  const engine: Engine = {
    ...w.engine,
    resend: id => {
      asked.push(id);
      return new Promise<ResendReply>(r => (answer = r));
    },
  };
  const tree = (rec: Pending | null) => (
    <WalletProvider engine={engine} platform={w.platform} surface="popup">
      <Spy />
      {rec === null ? null : <Stuck record={rec} now={CREATED + 94_000} {...nav} />}
    </WalletProvider>
  );
  const r = render(tree(p));
  await screen.findByText('online');
  return {...w, asked, answer: (x: ResendReply) => act(async () => answer(x)), show: (rec: Pending | null) => r.rerender(tree(rec))};
}

/** No claim that nothing was sent (the stuck card's own "tells you no funds moved" is about expiry, lower-case). */
function expectNoNothingSent() {
  expect(document.body.textContent).not.toMatch(/[Nn]othing (was )?sent|[Nn]ot sent|No funds moved/);
  expect(screen.queryByText(STUCK_TEXT.expiredHead)).toBeNull();
}

afterEach(() => vi.clearAllMocks());

describe('#54 stuck-tx — the safe variant', () => {
  it('stuck: the 90 s chip, "Pending for 01:34", the honest banner, the original’s card, the two cards, Send again and Close', async () => {
    await renderStuck(view());
    expect(await screen.findByText(STUCK_TEXT.title)).toBeTruthy();
    expect(screen.getByText(STUCK_TEXT.chip)).toBeTruthy();
    expect(screen.getByText(STUCK_TEXT.pendingFor)).toBeTruthy();
    expect(document.querySelector('.pending-counter .time')?.textContent).toBe('01:34');
    expect(document.querySelector('.warn-banner .body')?.textContent).toBe(`${STUCK_TEXT.bannerBold}${STUCK_TEXT.bannerLine}`);
    const rows = [...document.querySelectorAll('.orig-card .row')].map(r => [r.querySelector('.k')?.textContent, r.querySelector('.v')?.textContent]);
    expect(rows).toEqual([
      ['Amount', '2.4800 SOL'],
      ['Recipient', RECIPIENT],
      ['Tx hash', `${SIGNATURE.slice(0, 4)}…${SIGNATURE.slice(-4)}Copy`],
      ['Valid until block', '1150'],
    ]);
    expect([...document.querySelectorAll('.orig-card .addr-groups > span')].map(s => s.textContent)).toEqual(RECIPIENT.match(/.{1,4}/g));
    expect([...document.querySelectorAll('.recovery-card .name')].map(n => n.textContent)).toEqual([STUCK_TEXT.againName, STUCK_TEXT.waitName]);
    expect(screen.getByText(STUCK_TEXT.recommended)).toBeTruthy();
    expect(screen.getByText(STUCK_TEXT.againWhat)).toBeTruthy();
    expect(screen.getByText(STUCK_TEXT.waitWhat)).toBeTruthy();
    expect(screen.getByRole('button', {name: STUCK_TEXT.sendAgain})).toBeTruthy();
    expect(screen.getAllByRole('button', {name: 'Close'})).toHaveLength(2);
    // Not built (D23): a higher-fee copy and a 0 SOL self-transfer are new transactions while this one can land.
    expect(document.body.textContent).not.toMatch(/Speed up|Cancel with replacement|priority fee|µ-lamports|NOT moved/);
    expect(unstyledClasses(document.querySelector('.s-stuck')!, SELECTORS)).toEqual([]);
  });

  it('Send again re-sends the SAME bytes: sending again → "Sent again", the same hash, Watching; once per tap (rule 6, `disabled` lifted)', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => (release = r));
    const sentWires: string[] = [];
    const w = await renderStuck(view(), {
      before: ext => ext.local.set(PENDING_KEY, [stored()]),
      deps: {
        now: () => CREATED + 94_000,
        broadcast: async wire => {
          sentWires.push(base64.encode(wire));
          await held;
          return firstSignature(wire);
        },
      },
    });
    const again = (await screen.findByRole('button', {name: STUCK_TEXT.sendAgain})) as HTMLButtonElement;
    fireEvent.click(again);
    again.disabled = false;
    fireEvent.click(again);
    expect(await screen.findByText(STUCK_TEXT.sendingLine)).toBeTruthy();
    expect(screen.getByText(STUCK_TEXT.sendingTitle)).toBeTruthy();
    expect(screen.getByText('01:34 elapsed')).toBeTruthy();
    expect(screen.getByText(STUCK_TEXT.stillPending)).toBeTruthy();
    expect((screen.getByRole('button', {name: STUCK_TEXT.sendAgain}) as HTMLButtonElement).disabled).toBe(true);
    expect(unstyledClasses(document.querySelector('.s-stuck')!, SELECTORS)).toEqual([]);
    await act(async () => release());
    expect(await screen.findByText(STUCK_TEXT.sentLine)).toBeTruthy();
    expect(screen.getAllByText(STUCK_TEXT.sentTitle).length).toBeGreaterThan(0);
    expect(screen.getByText(STUCK_TEXT.watching)).toBeTruthy();
    expect(unstyledClasses(document.querySelector('.s-stuck')!, SELECTORS)).toEqual([]);
    // Exactly one broadcast — of the stored bytes (the cardinal failure the design's #54 note names is a double one).
    expect(sentWires).toEqual([base64.encode(WIRE)]);
    // One resend reached the background; the record's lastSentAt moved, its signature did not.
    const records = (await w.ext.local.get(PENDING_KEY)) as {signature: string; lastSentAt: number}[];
    expect(records.map(r => [r.signature, r.lastSentAt])).toEqual([[SIGNATURE, CREATED + 94_000]]);
    fireEvent.click(screen.getByRole('button', {name: STUCK_TEXT.viewActivity}));
    fireEvent.click(screen.getByRole('button', {name: STUCK_TEXT.done}));
    expect(nav.onActivity).toHaveBeenCalledTimes(1);
    expect(nav.onClose).toHaveBeenCalledTimes(1);
  });

  it('a second press the engine would NOT refuse (its clock moves 5 s per read, past the 2 s rule): only the lock stops it — one broadcast (review M3)', async () => {
    let t = CREATED + 94_000;
    const sentWires: string[] = [];
    await renderStuck(view(), {
      before: ext => ext.local.set(PENDING_KEY, [stored()]),
      deps: {
        now: () => (t += 5_000),
        broadcast: async wire => {
          sentWires.push(base64.encode(wire));
          return firstSignature(wire);
        },
      },
    });
    const again = (await screen.findByRole('button', {name: STUCK_TEXT.sendAgain})) as HTMLButtonElement;
    // Both presses inside one act(): React renders nothing between them, so neither the button's `disabled`
    // nor the screen's own "sending" layout can stop the second — only LockedButton's synchronous lock does.
    act(() => {
      again.click();
      again.click();
    });
    expect(await screen.findByText(STUCK_TEXT.sentLine)).toBeTruthy();
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });
    expect(sentWires).toEqual([base64.encode(WIRE)]);
  });

  it('the engine refuses too soon (2 s): "Wait a moment before sending again." and the stuck layout stays', async () => {
    await renderStuck(view(), {before: ext => ext.local.set(PENDING_KEY, [stored({lastSentAt: CREATED + 93_500})])});
    fireEvent.click(await screen.findByRole('button', {name: STUCK_TEXT.sendAgain}));
    expect(await screen.findByText(STUCK_TEXT.tooSoon)).toBeTruthy();
    expect(screen.getByText(STUCK_TEXT.pendingFor)).toBeTruthy();
  });

  it('a record no longer tracked: "This transaction is no longer tracked." and [Open Activity]', async () => {
    await renderStuck(view(), {before: async () => undefined});
    fireEvent.click(await screen.findByRole('button', {name: STUCK_TEXT.sendAgain}));
    expect(await screen.findByText(STUCK_TEXT.untracked)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: STUCK_TEXT.openActivity}));
    expect(nav.onActivity).toHaveBeenCalledTimes(1);
  });

  it('expired: "Not confirmed — no funds moved." and why; [Try again] the same intent (a fresh prepare); [Done]', async () => {
    await renderStuck(view({state: 'expired', detail: 'Not confirmed — no funds moved.'}));
    expect(await screen.findByText(STUCK_TEXT.expiredHead)).toBeTruthy();
    expect(screen.getByText(STUCK_TEXT.expiredLine)).toBeTruthy();
    expect(screen.queryByRole('button', {name: STUCK_TEXT.sendAgain})).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: STUCK_TEXT.tryAgain}));
    await waitFor(() => expect(nav.onTryAgain).toHaveBeenCalledWith({token: 'SOL', recipient: RECIPIENT, amount: 2_480_000_000n}));
    fireEvent.click(screen.getByRole('button', {name: STUCK_TEXT.done}));
    expect(nav.onClose).toHaveBeenCalledTimes(1);
    expect(unstyledClasses(document.querySelector('.s-stuck')!, SELECTORS)).toEqual([]);
  });

  it('expired is the engine’s word, never the screen’s: a stuck record long past its block and clock stays stuck; an expired one is expired however young', async () => {
    const {broadcasts} = await renderStuck(view({lastValidBlockHeight: 1, expiryNullSeenAt: CREATED}), {}, CREATED + 10 * 60 * 60_000);
    expect(await screen.findByText(STUCK_TEXT.pendingFor)).toBeTruthy();
    expect(screen.queryByText(STUCK_TEXT.expiredHead)).toBeNull();
    expect(screen.getByRole('button', {name: STUCK_TEXT.sendAgain})).toBeTruthy();
    expect(broadcasts).toEqual([]);
  });

  it('[Try again] on an expired record is a fresh prepare, never a re-send: nothing reaches wallet.resend or the network', async () => {
    const types: unknown[] = [];
    const {broadcasts} = await renderStuck(view({state: 'expired', detail: null, expiryNullSeenAt: null}), {gate: msg => void types.push((msg as {type?: unknown}).type)}, CREATED + 1_000);
    expect(await screen.findByText(STUCK_TEXT.expiredHead)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: STUCK_TEXT.tryAgain}));
    await waitFor(() => expect(nav.onTryAgain).toHaveBeenCalledTimes(1));
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });
    expect(broadcasts).toEqual([]);
    expect(types).not.toContain('wallet.resend');
    expect(types).toContain('wallet.state');
  });

  it('no fee is ever shown as paid: not on stuck, not on sent-again, not on expired (feePaidLamports is null for all three)', async () => {
    const fee = /Fee|0\.000005|5[\s,.]?050/;
    await renderStuck(view());
    expect(await screen.findByText(STUCK_TEXT.title)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(fee);
    fireEvent.click(screen.getByRole('button', {name: STUCK_TEXT.sendAgain}));
    expect(await screen.findByText(STUCK_TEXT.sentLine)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(fee);
    document.body.innerHTML = '';
    await renderStuck(view({state: 'expired'}));
    expect(await screen.findByText(STUCK_TEXT.expiredHead)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(fee);
  });

  it('the engine’s detail shows under the banner; the 403 cool-down (D26) disables Send again', async () => {
    await renderStuck(view({detail: 'Not sent again: cooling down after an earlier HTTP 403; still watching the first copy.'}), {
      reader: walletReader({
        getBalance: async () => {
          throw new RpcForbidden('getBalance');
        },
      }),
    });
    expect(await screen.findByText(REFUSED_TEXT)).toBeTruthy();
    expect(screen.getByText('Not sent again: cooling down after an earlier HTTP 403; still watching the first copy.')).toBeTruthy();
    expect((screen.getByRole('button', {name: STUCK_TEXT.sendAgain}) as HTMLButtonElement).disabled).toBe(true);
  });

  for (const [name, error] of [
    ['HTTP 403', new RpcForbidden('sendTransaction')],
    ['the cool-down after one', new RpcCoolingDown('sendTransaction')],
  ] as const) {
    it(`a re-send the coordinator refused (${name}) is never "Sent again": the engine's words, the D26 state through m.report, Send again disabled`, async () => {
      await renderStuck(view(), {
        deps: {
          now: () => CREATED + 94_000,
          broadcast: async () => {
            throw error;
          },
        },
      });
      fireEvent.click(await screen.findByRole('button', {name: STUCK_TEXT.sendAgain}));
      expect(await screen.findByText(REFUSED_TEXT)).toBeTruthy();
      expect(screen.getByText(error instanceof RpcCoolingDown ? COOLING_AGAIN_DETAIL : FORBIDDEN_DETAIL)).toBeTruthy();
      expect(screen.queryByText(STUCK_TEXT.sentLine)).toBeNull();
      expect(screen.getByText(STUCK_TEXT.pendingFor)).toBeTruthy();
      await act(async () => {
        await new Promise(r => setTimeout(r, 600));
      });
      expect((screen.getByRole('button', {name: STUCK_TEXT.sendAgain}) as HTMLButtonElement).disabled).toBe(true);
    });
  }

  it('a re-send not acknowledged (no answer from the route) stays on #54 with the engine’s words — never "Sent again", never "nothing sent"', async () => {
    await renderStuck(view(), {
      deps: {
        now: () => CREATED + 94_000,
        broadcast: async () => {
          throw new Error('socket hang up');
        },
      },
    });
    fireEvent.click(await screen.findByRole('button', {name: STUCK_TEXT.sendAgain}));
    expect(await screen.findByText('Not acknowledged yet; still watching. "Send again" re-sends the same transaction.')).toBeTruthy();
    expect(screen.queryByText(STUCK_TEXT.sentLine)).toBeNull();
    expect(screen.getByText(STUCK_TEXT.pendingFor)).toBeTruthy();
    expect(screen.queryByText(REFUSED_TEXT)).toBeNull();
    expectNoNothingSent();
  });

  it('the resend replies the background gives only on a fault: 403 → D26, unreachable → #42 (both through m.report), failed → #54 stays; none says "nothing sent"', async () => {
    const w = await mountStuck(view());
    fireEvent.click(screen.getByRole('button', {name: STUCK_TEXT.sendAgain}));
    await w.answer({ok: false, error: 'unreachable'});
    expect(screen.getByTestId('net').textContent).toBe('unreachable');
    expect(screen.getByText(STUCK_TEXT.pendingFor)).toBeTruthy();
    expect(screen.queryByText(STUCK_TEXT.sentLine)).toBeNull();
    expectNoNothingSent();
    await act(async () => {
      await new Promise(r => setTimeout(r, 600));
    });
    fireEvent.click(screen.getByRole('button', {name: STUCK_TEXT.sendAgain}));
    await w.answer({ok: false, error: 'failed'});
    expect(screen.getByText(STUCK_TEXT.pendingFor)).toBeTruthy();
    expect(screen.queryByText(STUCK_TEXT.sentLine)).toBeNull();
    expectNoNothingSent();
    await act(async () => {
      await new Promise(r => setTimeout(r, 600));
    });
    fireEvent.click(screen.getByRole('button', {name: STUCK_TEXT.sendAgain}));
    await w.answer({ok: false, error: 'coordinator-refused'});
    expect(screen.getByTestId('net').textContent).toBe('refused');
    expect(screen.getByText(REFUSED_TEXT)).toBeTruthy();
    await act(async () => {
      await new Promise(r => setTimeout(r, 600));
    });
    expect((screen.getByRole('button', {name: STUCK_TEXT.sendAgain}) as HTMLButtonElement).disabled).toBe(true);
    expect(w.asked).toEqual(['r1', 'r1', 'r1']);
  });

  it('every await checks its generation — unmounted while the resend was out: its answer reports nothing', async () => {
    const w = await mountStuck(view());
    fireEvent.click(screen.getByRole('button', {name: STUCK_TEXT.sendAgain}));
    expect(await screen.findByText(STUCK_TEXT.sendingLine)).toBeTruthy();
    w.show(null);
    await w.answer({ok: false, error: 'coordinator-refused'});
    expect(screen.getByTestId('net').textContent).toBe('online');
  });

  it('every await checks its generation — the account switched while the resend was out: its answer is dropped, #54 is back to stuck', async () => {
    const w = await mountStuck(view());
    fireEvent.click(screen.getByRole('button', {name: STUCK_TEXT.sendAgain}));
    expect(await screen.findByText(STUCK_TEXT.sendingLine)).toBeTruthy();
    expect((await w.engine.select(1)).ok).toBe(true);
    await act(async () => {
      await probe.m!.reload();
    });
    await waitFor(() => expect(probe.m!.account?.publicKey).toBe(RECIPIENT));
    expect(await screen.findByText(STUCK_TEXT.pendingFor)).toBeTruthy();
    await w.answer({ok: true, data: view({lastSentAt: CREATED + 94_000})});
    expect(screen.queryByText(STUCK_TEXT.sentLine)).toBeNull();
    expect(screen.getByText(STUCK_TEXT.pendingFor)).toBeTruthy();
  });

  it('every await checks its generation — the record changed while the resend was out: the old answer never lands on the new record', async () => {
    const w = await mountStuck(view());
    fireEvent.click(screen.getByRole('button', {name: STUCK_TEXT.sendAgain}));
    expect(await screen.findByText(STUCK_TEXT.sendingLine)).toBeTruthy();
    const other = firstSignature(signedWire(7n));
    w.show(view({id: 'r2', signature: other}));
    expect(await screen.findByText(STUCK_TEXT.pendingFor)).toBeTruthy();
    await w.answer({ok: true, data: view({lastSentAt: CREATED + 94_000})});
    expect(screen.queryByText(STUCK_TEXT.sentLine)).toBeNull();
    expect(screen.getByText(`${other.slice(0, 4)}…${other.slice(-4)}`, {exact: false})).toBeTruthy();
    // ... and its state changing (stuck → expired) mid-resend: the engine's expired layout, not the old answer's.
    fireEvent.click(screen.getByRole('button', {name: STUCK_TEXT.sendAgain}));
    expect(await screen.findByText(STUCK_TEXT.sendingLine)).toBeTruthy();
    w.show(view({id: 'r2', signature: other, state: 'expired'}));
    await w.answer({ok: true, data: view({id: 'r2', signature: other})});
    expect(screen.getByText(STUCK_TEXT.expiredHead)).toBeTruthy();
    expect(screen.queryByText(STUCK_TEXT.sentLine)).toBeNull();
  });

  it('the counter: minutes and seconds since the send was made', () => {
    expect(mmss(CREATED, CREATED + 94_000)).toEqual({mm: '01', ss: '34'});
    expect(mmss(CREATED, CREATED + 12 * 60_000 + 5_000)).toEqual({mm: '12', ss: '05'});
    expect(mmss(CREATED, CREATED - 5)).toEqual({mm: '00', ss: '00'});
  });
});
