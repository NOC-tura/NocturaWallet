// @vitest-environment happy-dom
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {renderInWallet, setupWallet, walletReader, type WalletOptions} from './harness';
import {createEngine} from '../engine';
import {WalletProvider, useWallet} from '../WalletContext';
import {SEND_TEXT, Send} from '../screens/Send';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {REFUSED_TEXT} from '../ui/Banner';
import {KNOWN_RECIPIENTS_KEY} from '../../background/knownRecipients';
import {BALANCE_CACHE_KEY} from '../../background/balanceCache';
import {PENDING_KEY} from '../../background/pendingStore';
import {RpcForbidden} from '../../../../core/solana/rpc';
import {MAINNET_FEE_TREASURY} from '../../../../core/fees/transferMarkup';
import {ACCOUNT, RECIPIENT, pendingRecord} from '../../background/__tests__/fixtures';
import {COUNTERPARTY} from '../../../e2e/historyFixtures';
import type {Draft} from '../send/rules';

// Spec §4.2 (#12) and §4.3 (#43, opened from it). The harness wallet: Main (ACCOUNT) sending, Savings
// (RECIPIENT) its own second account; 62.4821 SOL, 4 200 NOC, 740.21 USDC; SOL $150.
const SELECTORS = selectorsOf(UI_SHEETS);
const nav = {onBack: vi.fn(), onReview: vi.fn(), onViewPending: vi.fn()};
const DAY = 86_400_000;

function renderSend(o: WalletOptions & {draft?: Draft | null; notice?: 'start-again' | null} = {}) {
  return renderInWallet(<Send draft={o.draft ?? null} notice={o.notice ?? null} {...nav} />, o);
}
const field = (name: string) => screen.getByLabelText(name) as HTMLInputElement;
const type = (name: string, value: string) => fireEvent.change(field(name), {target: {value}});
const cta = () => document.querySelector('.sticky-bar button') as HTMLButtonElement;
/** Waits for the provider's balance read: the Available line names the balance. */
const loaded = () => screen.findByText('62.4821 SOL');
const known = (address: string, at: number | null) => ({before: async (ext: Parameters<NonNullable<WalletOptions['before']>>[0]) => ext.local.set(KNOWN_RECIPIENTS_KEY, [{address, at}])});

afterEach(() => vi.clearAllMocks());

describe('#12 send', () => {
  it('idle: the title, the three eyebrows, the SOL chip, the placeholders, Available, the two fee rows, "Send SOL" disabled', async () => {
    await renderSend();
    await loaded();
    expect(screen.getByText('Send', {selector: '.title'})).toBeTruthy();
    expect([...document.querySelectorAll('.row .lbl')].map(l => l.textContent)).toEqual(['Token', 'Recipient', 'Amount']);
    expect(screen.getByRole('button', {name: 'Token: SOL'})).toBeTruthy();
    expect(field('Recipient').placeholder).toBe('Solana address');
    expect(field('Amount').placeholder).toBe('0.000000');
    expect(document.querySelector('.available')?.textContent).toBe('Available 62.4821 SOL');
    const fees = [...document.querySelectorAll('.fee-row .line')].map(l => [l.querySelector('.l')?.textContent, l.querySelector('.r')?.textContent]);
    expect(fees).toEqual([
      ['Network fee', '~0.000005 SOL'],
      ['Priority', 'Set automatically — shown on the next step'],
    ]);
    expect(cta().textContent).toBe('Send SOL');
    expect(cta().disabled).toBe(true);
    // Removed by decision: priority chips (D15), .sol (D16), scan (D13), the address book (B1b-2b), shielded (D4).
    for (const gone of [/\.sol/, /Normal|Fast|Instant/, /Scan|Address book|shielded|private/i]) expect(document.body.textContent).not.toMatch(gone);
    expect(screen.queryByRole('button', {name: /Scan|Address book/})).toBeNull();
    expect(unstyledClasses(document.querySelector('.s-send')!, SELECTORS)).toEqual([]);
  });

  it('invalid recipient: the danger line, the fee "—", the rows behind it dimmed, the CTA disabled', async () => {
    await renderSend();
    await loaded();
    type('Recipient', '7xKXtgZASfW87dQQQbadinput123');
    expect(screen.getByRole('alert').textContent).toBe(` ${SEND_TEXT.invalid}`);
    expect(document.querySelector('.recipient-row')?.classList.contains('app-row-error')).toBe(true);
    expect(document.querySelector('.recipient-row .input')?.classList.contains('invalid')).toBe(true);
    expect(document.querySelector('.fee-row .line .r')?.textContent).toBe('—');
    expect(document.querySelector('.amount-row')?.classList.contains('app-row-dim')).toBe(true);
    expect(cta().disabled).toBe(true);
    expect(unstyledClasses(document.querySelector('.s-send')!, SELECTORS)).toEqual([]);
  });

  it('insufficient balance: "short by" the exact BigInt difference, the CTA disabled', async () => {
    await renderSend(known(COUNTERPARTY, null));
    await loaded();
    type('Recipient', COUNTERPARTY);
    type('Amount', '75');
    expect(await screen.findByText(/^Insufficient balance — short by/)).toBeTruthy();
    expect(document.querySelector('.amount-row .helper.error')?.textContent).toBe(' Insufficient balance — short by 12.5179 SOL');
    expect(document.querySelector('.amount-row')?.classList.contains('app-row-error')).toBe(true);
    expect(cta().textContent).toBe('Send 75 SOL');
    expect(cta().disabled).toBe(true);
  });

  it('SPL with less SOL than the base fee: "Not enough SOL for the network fee."', async () => {
    await renderSend({...known(COUNTERPARTY, null), reader: walletReader({getBalance: async () => 4_999n})});
    await waitFor(() => expect(document.querySelector('.available')?.textContent).toBe('Available 0.0000 SOL'));
    fireEvent.click(screen.getByRole('button', {name: 'Token: SOL'}));
    fireEvent.click(within(screen.getByRole('dialog', {name: 'Choose a token'})).getByText('USD Coin'));
    type('Recipient', COUNTERPARTY);
    type('Amount', '1');
    expect(await screen.findByText(SEND_TEXT.feeWarning, {exact: false})).toBeTruthy();
    expect(cta().disabled).toBe(true);
  });

  it('sent before (E6): "Verified · sent before · last 12 days ago"; with no date, "Verified · sent before"', async () => {
    await renderSend(known(COUNTERPARTY, Date.now() - 12 * DAY));
    await loaded();
    type('Recipient', COUNTERPARTY);
    expect((await screen.findByText(/Verified · sent before/)).textContent?.trim()).toBe('Verified · sent before · last 12 days ago');
    expect(screen.queryByText(SEND_TEXT.firstTitle)).toBeNull();
    type('Amount', '0.01');
    await waitFor(() => expect(cta().disabled).toBe(false));
    expect(cta().textContent).toBe('Send 0.01 SOL');
  });

  it('an own account reads its label, the fee treasury "Noctura treasury"; the sending account itself is refused', async () => {
    await renderSend(known(MAINNET_FEE_TREASURY, null));
    await loaded();
    type('Recipient', RECIPIENT);
    expect(await screen.findByText('Your account: Savings')).toBeTruthy();
    type('Recipient', MAINNET_FEE_TREASURY);
    expect(await screen.findByText('Noctura treasury')).toBeTruthy();
    type('Recipient', ACCOUNT.publicKey);
    expect(await screen.findByText(SEND_TEXT.self, {exact: false})).toBeTruthy();
    type('Amount', '0.01');
    expect(cta().disabled).toBe(true);
  });

  it('first-time recipient (design state 6): the banner, the address in groups of four, "Never sent here before", the re-auth amount line and CTA', async () => {
    await renderSend();
    await loaded();
    type('Recipient', COUNTERPARTY);
    type('Amount', '12');
    expect(await screen.findByText(SEND_TEXT.firstTitle)).toBeTruthy();
    expect(screen.getByText(SEND_TEXT.firstLine)).toBeTruthy();
    expect(screen.getByText(SEND_TEXT.neverSent, {exact: false})).toBeTruthy();
    const groups = [...document.querySelectorAll('.app-send-addr .addr-groups > span')].map(s => s.textContent);
    expect(groups).toEqual(COUNTERPARTY.match(/.{1,4}/g));
    // 12 SOL × $150 = $1,800.00; 12 of 62.4821 SOL = 19 %.
    expect(document.querySelector('.available')?.textContent).toBe('≈ $1,800.00 · 19% of balance — re-auth required');
    expect(cta().textContent).toBe(`\u00a0${SEND_TEXT.reviewUnlock}`);
    expect(cta().disabled).toBe(false);
    expect(unstyledClasses(document.querySelector('.s-send')!, SELECTORS)).toEqual([]);
  });

  it('a known recipient but over 5 % of the balance: the same re-auth line and CTA (the 5 % rule, predicted)', async () => {
    await renderSend(known(COUNTERPARTY, null));
    await loaded();
    type('Recipient', COUNTERPARTY);
    type('Amount', '4');
    await screen.findByText(/Verified · sent before/);
    expect(document.querySelector('.available')?.textContent).toBe('≈ $600.00 · 6% of balance — re-auth required');
    expect(cta().textContent).toBe(`\u00a0${SEND_TEXT.reviewUnlock}`);
  });

  it('pending: an open send of this account → the banner, [View it] opens it, the CTA disabled', async () => {
    const record = pendingRecord({id: 'p1', account: ACCOUNT.publicKey, signature: '5'.repeat(88), createdAt: Date.now(), intent: {token: 'SOL', recipient: RECIPIENT, amount: '1'}});
    await renderSend({
      before: async ext => {
        await ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: COUNTERPARTY, at: null}]);
        await ext.local.set(PENDING_KEY, [record]);
      },
    });
    fireEvent.click(await screen.findByRole('button', {name: 'View it'}));
    expect(screen.getByText(SEND_TEXT.pending)).toBeTruthy();
    expect(nav.onViewPending).toHaveBeenCalledWith(expect.objectContaining({id: 'p1'}));
    type('Recipient', COUNTERPARTY);
    type('Amount', '0.01');
    await screen.findByText(/Verified · sent before/);
    expect(cta().disabled).toBe(true);
  });

  it('stale: balances from the cache → "Available … · last synced N ago" in --warning', async () => {
    const at = Date.now() - 120_000;
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => (release = r));
    const reader = walletReader({
      getBalance: async () => {
        await held;
        return 62_482_100_000n;
      },
    });
    await renderSend({reader, before: async ext => ext.local.set(BALANCE_CACHE_KEY, {[ACCOUNT.publicKey]: {sol: '62482100000', noc: '0', usdc: '0', usdt: '0', at}})});
    const line = await screen.findByText(/last synced/, {selector: '.available'});
    expect(line.textContent).toBe('Available 62.4821 SOL · last synced 2 min ago');
    expect(line.classList.contains('app-warning')).toBe(true);
    await act(async () => release());
  });

  it('MAX: SOL keeps the worst fee and the rent minimum and says so; a token sends its whole balance', async () => {
    await renderSend();
    await loaded();
    fireEvent.click(screen.getByRole('button', {name: 'MAX'}));
    // 62.4821 SOL − (5 000 + 20 000 + 20 000) − 890 880 lamports.
    expect(field('Amount').value).toBe('62.48116412');
    expect(screen.getByText(SEND_TEXT.maxHelper)).toBeTruthy();
    type('Amount', '1');
    expect(screen.queryByText(SEND_TEXT.maxHelper)).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: 'Token: SOL'}));
    fireEvent.click(within(screen.getByRole('dialog', {name: 'Choose a token'})).getByText('Noctura'));
    fireEvent.click(screen.getByRole('button', {name: 'MAX'}));
    expect(field('Amount').value).toBe('4200');
    expect(screen.queryByText(SEND_TEXT.maxHelper)).toBeNull();
  });

  it('#43 from the chip: "Choose a token", four rows with balances and NOC "at stage price"; Esc closes only the sheet', async () => {
    await renderSend();
    await loaded();
    fireEvent.click(screen.getByRole('button', {name: 'Token: SOL'}));
    const sheet = screen.getByRole('dialog', {name: 'Choose a token'});
    expect([...sheet.querySelectorAll('.pri')].map(p => p.textContent)).toEqual(['SOL', 'NOC', 'USDC', 'USDT']);
    // 4 200 NOC × $0.1501 (the stage price), outside the market total.
    expect(within(sheet).getByText('$630.42 at stage price')).toBeTruthy();
    expect(sheet.querySelector('.sel .pri')?.textContent).toBe('SOL');
    fireEvent.keyDown(document, {key: 'Escape'});
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(nav.onBack).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: 'Token: SOL'}));
    fireEvent.click(within(screen.getByRole('dialog', {name: 'Choose a token'})).getByText('USD Coin'));
    expect(screen.getByRole('button', {name: 'Token: USDC'})).toBeTruthy();
    expect(document.querySelector('.available')?.textContent).toBe('Available 740.21 USDC');
  });

  it('the CTA hands #19 the draft and the intent in base units — once per tap (rule 6, the lock held with `disabled` lifted)', async () => {
    await renderSend(known(COUNTERPARTY, null));
    await loaded();
    type('Recipient', ` ${COUNTERPARTY} `);
    type('Amount', '0.01');
    await waitFor(() => expect(cta().disabled).toBe(false));
    fireEvent.click(cta());
    cta().disabled = false;
    fireEvent.click(cta());
    expect(nav.onReview).toHaveBeenCalledTimes(1);
    expect(nav.onReview).toHaveBeenCalledWith({token: 'SOL', recipient: COUNTERPARTY, amount: '0.01'}, {token: 'SOL', recipient: COUNTERPARTY, amount: 10_000_000n});
  });

  it('mid-typing "1." the CTA reads "Send 1 SOL", never "Send 1. SOL" (review L6); "1.50" stays as typed', async () => {
    // A $1 000 threshold, so 1 SOL ($150 at the test price, under 5 % of 62.48) predicts no re-authentication.
    await renderSend({
      before: async ext => {
        await ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: COUNTERPARTY, at: null}]);
        await ext.local.set('v1_settings', {autoLockMinutes: 5, reauthUsdCents: 100_000, selectedAccount: 0});
      },
    });
    await loaded();
    type('Recipient', COUNTERPARTY);
    type('Amount', '1.');
    await waitFor(() => expect(cta().textContent).toBe('Send 1 SOL'));
    type('Amount', '1.50');
    await waitFor(() => expect(cta().textContent).toBe('Send 1.50 SOL'));
  });

  it('Esc and the back arrow go back to #11', async () => {
    await renderSend();
    await loaded();
    fireEvent.keyDown(document, {key: 'Escape'});
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(nav.onBack).toHaveBeenCalledTimes(2);
  });

  it('paste fills the field; a refused clipboard says how to paste instead', async () => {
    await renderSend();
    await loaded();
    Object.defineProperty(navigator, 'clipboard', {value: {readText: async () => ` ${COUNTERPARTY}\n`}, configurable: true});
    fireEvent.click(screen.getByRole('button', {name: 'Paste'}));
    await waitFor(() => expect(field('Recipient').value).toBe(COUNTERPARTY));
    fireEvent.click(screen.getByRole('button', {name: 'Clear recipient'}));
    Object.defineProperty(navigator, 'clipboard', {value: {readText: async () => Promise.reject(new Error('NotAllowedError'))}, configurable: true});
    fireEvent.click(screen.getByRole('button', {name: 'Paste'}));
    expect(await screen.findByText(SEND_TEXT.pasteRefused)).toBeTruthy();
  });

  it('a recipientInfo reply for an address the field no longer holds is dropped (the generation check)', async () => {
    let releaseFirst: () => void = () => undefined;
    const held = new Promise<void>(r => (releaseFirst = r));
    const w = await setupWallet(known(COUNTERPARTY, null));
    // RECIPIENT's answer ("Your account: Savings") is held until COUNTERPARTY's has been shown.
    const engine = createEngine(async m => {
      const msg = m as {type?: string; recipient?: string};
      if (msg.type === 'wallet.recipientInfo' && msg.recipient === RECIPIENT) await held;
      return w.transport(m);
    }, async () => undefined);
    render(
      <WalletProvider engine={engine} platform={w.platform} surface="popup">
        <Send draft={null} notice={null} {...nav} />
      </WalletProvider>,
    );
    await loaded();
    type('Recipient', RECIPIENT);
    type('Recipient', COUNTERPARTY);
    expect(await screen.findByText(/Verified · sent before/)).toBeTruthy();
    await act(async () => releaseFirst());
    expect(screen.queryByText('Your account: Savings')).toBeNull();
    expect(screen.getByText(/Verified · sent before/)).toBeTruthy();
  });

  // Controller carry (plan 3): the same generation check across an account switch and an unmount.
  it('a recipientInfo reply for the account switched away from is dropped', async () => {
    let releaseMain: () => void = () => undefined;
    const held = new Promise<void>(r => (releaseMain = r));
    const w = await setupWallet();
    // From Main, Savings is "Your account: Savings"; from Savings itself, it is the sending account. Main's answer is held.
    const engine = createEngine(async m => {
      const msg = m as {type?: string; account?: string};
      if (msg.type === 'wallet.recipientInfo' && msg.account === ACCOUNT.publicKey) await held;
      return w.transport(m);
    }, async () => undefined);
    function SwitchTo1() {
      const m = useWallet();
      return (
        <button
          type="button"
          onClick={() =>
            void (async () => {
              await m.engine.select(1);
              await m.reload();
            })()
          }
        >
          switch
        </button>
      );
    }
    render(
      <WalletProvider engine={engine} platform={w.platform} surface="popup">
        <Send draft={null} notice={null} {...nav} />
        <SwitchTo1 />
      </WalletProvider>,
    );
    await loaded();
    type('Recipient', RECIPIENT);
    fireEvent.click(screen.getByRole('button', {name: 'switch'}));
    expect(await screen.findByText(SEND_TEXT.self, {exact: false})).toBeTruthy();
    await act(async () => releaseMain());
    expect(screen.queryByText('Your account: Savings')).toBeNull();
    expect(screen.getByText(SEND_TEXT.self, {exact: false})).toBeTruthy();
  });

  it('a recipientInfo reply that lands after #12 left does nothing (no reload from a screen that is gone)', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => (release = r));
    const w = await setupWallet();
    const seen: string[] = [];
    const engine = createEngine(async m => {
      const msg = m as {type?: string};
      seen.push(msg.type ?? '');
      if (msg.type === 'wallet.recipientInfo') {
        await held;
        return {ok: false, error: 'locked'};
      }
      return w.transport(m);
    }, async () => undefined);
    const tree = (shown: boolean) => (
      <WalletProvider engine={engine} platform={w.platform} surface="popup">
        {shown ? <Send draft={null} notice={null} {...nav} /> : <div>gone</div>}
      </WalletProvider>
    );
    const {rerender} = render(tree(true));
    await loaded();
    type('Recipient', COUNTERPARTY);
    await waitFor(() => expect(seen).toContain('wallet.recipientInfo'));
    rerender(tree(false));
    const before = seen.length;
    await act(async () => release());
    // A live screen would answer 'locked' with reload() → wallet.state; a screen that left must not.
    expect(seen.slice(before)).not.toContain('wallet.state');
  });

  it('refused (D26): the banner, and the CTA stays disabled', async () => {
    await renderSend({
      ...known(COUNTERPARTY, null),
      reader: walletReader({
        getBalance: async () => {
          throw new RpcForbidden('getBalance');
        },
      }),
    });
    expect(await screen.findByText(REFUSED_TEXT)).toBeTruthy();
    type('Recipient', COUNTERPARTY);
    type('Amount', '0.01');
    await screen.findByText(/Verified · sent before/);
    expect(cta().disabled).toBe(true);
  });

  it('a draft from #19 is restored as typed; the start-again notice (§4.5 loop guard) shows on top', async () => {
    await renderSend({draft: {token: 'USDC', recipient: COUNTERPARTY, amount: '12.5'}, notice: 'start-again'});
    expect(await screen.findByText(SEND_TEXT.startAgain)).toBeTruthy();
    expect(field('Recipient').value).toBe(COUNTERPARTY);
    expect(field('Amount').value).toBe('12.5');
    expect(screen.getByRole('button', {name: 'Token: USDC'})).toBeTruthy();
  });
});
