// @vitest-environment happy-dom
import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {sendingReader, setupWallet, type Wallet} from '../../__tests__/harness';
import {App} from '../../App';
import {createEngine} from '../../engine';
import {CONFIRM_TEXT} from '../../screens/Confirm';
import {STATE_POLL_MS} from '../../WalletContext';
import {STATUS_TEXT} from '../../screens/Status';
import {PENDING_KEY, type PendingRecord} from '../../../background/pendingStore';
import {satisfyChallenge} from '../../../background/reauthChallenges';
import {registerPresale} from '../../../background/presale/api';
import {registerPresaleHandler} from '../../../background/messages';
import {fakeDeps} from '../../../background/__tests__/fakeDeps';
import {fakeExt} from '../../../background/__tests__/fakeExt';
import {ACCOUNT} from '../../../background/presale/__tests__/chain';
import {COUNTERPARTY} from '../../../../e2e/historyFixtures';
import {BOUGHT_BEFORE, preparePurchase, purchaseWorld, type PurchaseWorld} from './world';

registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler, alarm: () => undefined});

// B1d §4.2 "Resume paths" (review M5; Task 3's ruling moved the popup half here): a purchase whose #10 was proven with
// the popup closed resumes — the popup's hook (App.tsx) asks presale.preparedFor when wallet.preparedFor holds nothing,
// and the UI tab's hand-over (`#/send/resume?account=`, where #10 goes once proven) asks it first — and pushes #20's
// purchase variant (`presale-confirm`, `resume`), where one tap signs with no second proof. A send resumes as before.
const RESUME = `#/send/resume?account=${ACCOUNT}`;

async function app(w: PurchaseWorld, o: {surface?: 'popup' | 'tab'; hash?: string; purchase?: {currency: 'SOL' | 'USDC' | 'USDT'; amount: string}; prove?: boolean; send?: boolean} = {}): Promise<Wallet & {sent: string[]}> {
  const sent: string[] = [];
  // A send needs B1b's world (its simulation is a transfer's, not the program's).
  const wallet = await setupWallet({...w.options, surface: o.surface, ...(o.send === true ? {reader: sendingReader()} : {})});
  if (o.purchase !== undefined) {
    const view = await preparePurchase(wallet, o.purchase);
    if (o.prove === true && view.reauth !== null) expect(await satisfyChallenge(wallet.ext, w.now(), view.reauth.challengeId)).toBe(true);
  }
  if (o.send === true) {
    const p = await wallet.engine.prepareSend(ACCOUNT, {token: 'SOL', recipient: COUNTERPARTY, amount: 10_000_000n});
    if (!p.ok) throw new Error(p.error);
  }
  const engine = createEngine(m => {
    sent.push((m as {type: string}).type);
    return wallet.transport(m);
  }, async () => undefined);
  render(<App surface={o.surface ?? 'popup'} engine={engine} platform={wallet.platform} hash={o.hash ?? ''} />);
  return {...wallet, engine, sent};
}
const buy = async () => (await screen.findByRole('button', {name: 'Buy NOC'})) as HTMLButtonElement;
const records = async (w: Wallet): Promise<PendingRecord[]> => ((await w.ext.local.get(PENDING_KEY)) as PendingRecord[] | undefined) ?? [];

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('the popup resumes a waiting purchase (§4.2)', () => {
  it('opened with a prepared purchase: #20’s purchase variant, Q57 — nothing signed until the tap; one tap signs, #21 follows it as a purchase', async () => {
    const w = purchaseWorld({chain: BOUGHT_BEFORE});
    const a = await app(w, {purchase: {currency: 'SOL', amount: '100000000'}});
    expect(await screen.findByText('You have a purchase waiting.')).toBeTruthy();
    expect(screen.getByText('Confirm purchase')).toBeTruthy();
    // The send's check first, then the presale entry's — once each.
    expect(a.sent.filter(t => t === 'wallet.preparedFor' || t === 'presale.preparedFor').slice(0, 2)).toEqual(['wallet.preparedFor', 'presale.preparedFor']);
    expect(a.sent).not.toContain('presale.buy');
    fireEvent.click(await buy());
    expect(await screen.findByText('Buying NOC…')).toBeTruthy();
    expect(document.querySelector('.top-bar .status-pill')?.textContent).toBe('Presale');
    expect(a.sent.filter(t => t === 'presale.buy')).toHaveLength(1);
    expect(w.broadcasts).toHaveLength(1);
  });

  it('a first purchase whose #10 was proven with the popup closed: Q58, and one tap signs — no second proof, #10 not opened again', async () => {
    const w = purchaseWorld();
    const a = await app(w, {purchase: {currency: 'SOL', amount: '2000000000'}, prove: true});
    expect(await screen.findByText('Confirmed. Review the fresh quote and buy.')).toBeTruthy();
    fireEvent.click(await buy());
    await waitFor(() => expect(w.broadcasts).toHaveLength(1));
    expect(a.platform.opened).toEqual([]);
    expect(a.platform.closed).toBe(0);
    expect((await records(a))[0]?.extra?.kind).toBe('presale-buy');
  });

  it('the purchase’s #21: confirmed, Done → #23 (C17), not #11', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = purchaseWorld({chain: BOUGHT_BEFORE});
    const a = await app(w, {purchase: {currency: 'SOL', amount: '100000000'}});
    fireEvent.click(await buy());
    expect(await screen.findByText('Buying NOC…')).toBeTruthy();
    const [record] = await records(a);
    if (record === undefined) throw new Error('no record');
    await a.ext.local.set(PENDING_KEY, [{...record, state: 'confirmed'}]);
    await act(async () => void vi.advanceTimersByTime(2_000));
    fireEvent.click(await screen.findByRole('button', {name: STATUS_TEXT.done}));
    expect(await screen.findByText('NOC presale')).toBeTruthy();
    expect(screen.queryByText('TOKENS')).toBeNull();
  });

  it('Esc on #20’s purchase variant is its own (back to #23 with the amount kept) — never also the shell’s pop to #11', async () => {
    const w = purchaseWorld({chain: BOUGHT_BEFORE});
    await app(w, {purchase: {currency: 'SOL', amount: '100000000'}});
    await buy();
    fireEvent.keyDown(document, {key: 'Escape'});
    expect(await screen.findByText('NOC presale')).toBeTruthy();
    expect(((await screen.findByLabelText('YOU PAY')) as HTMLInputElement).value).toBe('0.1');
    expect(screen.queryByText('TOKENS')).toBeNull();
  });

  it('the purchase’s #21 for an account no longer selected: Done → #11, not that account’s #23 (as [Try again]’s owner rule)', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = purchaseWorld({chain: BOUGHT_BEFORE});
    const a = await app(w, {purchase: {currency: 'SOL', amount: '100000000'}});
    fireEvent.click(await buy());
    expect(await screen.findByText('Buying NOC…')).toBeTruthy();
    expect((await a.engine.select(1)).ok).toBe(true);
    await act(async () => void vi.advanceTimersByTime(STATE_POLL_MS + 50));
    const [record] = await records(a);
    if (record === undefined) throw new Error('no record');
    await a.ext.local.set(PENDING_KEY, [{...record, state: 'confirmed'}]);
    await act(async () => void vi.advanceTimersByTime(2_000));
    fireEvent.click(await screen.findByRole('button', {name: STATUS_TEXT.done}));
    expect(await screen.findByText('TOKENS')).toBeTruthy();
    expect(screen.queryByText('NOC presale')).toBeNull();
  });

  it('a waiting send resumes at B1b’s #20, and the presale entry is not asked (positive control: one entry per account)', async () => {
    const w = purchaseWorld({chain: BOUGHT_BEFORE});
    const a = await app(w, {send: true});
    expect(await screen.findByText(CONFIRM_TEXT.resume)).toBeTruthy();
    expect(screen.queryByText('Confirm purchase')).toBeNull();
    expect(a.sent).not.toContain('presale.preparedFor');
  });

  it('nothing waiting: #11, each entry asked once', async () => {
    const w = purchaseWorld();
    const a = await app(w);
    expect(await screen.findByText('TOKENS')).toBeTruthy();
    await waitFor(() => expect(a.sent.filter(t => t === 'presale.preparedFor')).toHaveLength(1));
    expect(a.sent.filter(t => t === 'wallet.preparedFor')).toHaveLength(1);
    expect(screen.queryByText('Confirm purchase')).toBeNull();
  });

  it('a user who moved on before the presale entry answered stays where they went: no #20 pushed over them', async () => {
    const w = purchaseWorld({chain: BOUGHT_BEFORE});
    const wallet = await setupWallet(w.options);
    await preparePurchase(wallet, {currency: 'SOL', amount: '100000000'});
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => (release = r));
    const asked: string[] = [];
    const engine = createEngine(async m => {
      const type = (m as {type: string}).type;
      if (type === 'presale.preparedFor') {
        asked.push(type);
        await held;
      }
      return wallet.transport(m);
    }, async () => undefined);
    render(<App surface="popup" engine={engine} platform={wallet.platform} hash="" />);
    await waitFor(() => expect(asked).toHaveLength(1));
    fireEvent.click(await screen.findByRole('button', {name: 'Receive'}));
    release();
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });
    expect(screen.queryByText('Confirm purchase')).toBeNull();
  });
});

describe('the UI tab’s hand-over after #10 resumes a purchase (§4.2)', () => {
  it('#/send/resume for a proven purchase: #20’s purchase variant (Q58); one tap signs, no second proof, and #21 follows it', async () => {
    const w = purchaseWorld();
    const a = await app(w, {surface: 'tab', hash: RESUME, purchase: {currency: 'SOL', amount: '2000000000'}, prove: true});
    expect(await screen.findByText('Confirmed. Review the fresh quote and buy.')).toBeTruthy();
    // The send's #20 never mounted for it (it would have found no send and gone to #12).
    expect(screen.queryByText(CONFIRM_TEXT.title)).toBeNull();
    expect(a.sent).not.toContain('wallet.preparedFor');
    fireEvent.click(await buy());
    expect(await screen.findByText('Buying NOC…')).toBeTruthy();
    expect(a.platform.navigated).toEqual([]);
    expect(w.broadcasts).toHaveLength(1);
  });

  it('#/send/resume for a send: B1b’s #20 as before (positive control)', async () => {
    const w = purchaseWorld({chain: BOUGHT_BEFORE});
    await app(w, {surface: 'tab', hash: RESUME, send: true});
    expect(await screen.findByText(CONFIRM_TEXT.resume)).toBeTruthy();
    expect(screen.queryByText('Confirm purchase')).toBeNull();
    cleanup();
  });
});
