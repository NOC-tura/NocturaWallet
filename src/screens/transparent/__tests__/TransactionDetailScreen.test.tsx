/**
 * #27 (history spec 2026-11-26 §4.6, §8 "#27"): the detail against REAL responses (the fixtures of
 * modules/solana/__tests__), read through a scripted `useParsedTx`. The hero is what `classifyActivity`
 * says for the account the detail was opened from; From / To show only when the parsed transfer agrees
 * with it. A DERIVED case names exactly what it changed.
 */
import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {readFileSync} from 'fs';
import {join} from 'path';
import Clipboard from '@react-native-clipboard/clipboard';
import {TransactionDetailScreen} from '../TransactionDetailScreen';
import {classifyActivity} from '../../../modules/solana/activity';
import {heroAmount} from '../../../modules/solana/activityView';
import {dropHistorySessions, historySession} from '../../../modules/solana/historySession';
import {NETWORK} from '../../../constants/programs';
import {VALUE_HIDDEN, VALUE_HIDDEN_SPOKEN} from '../../../copy/accounts';
import type {ActivityContext} from '../../../modules/solana/activity';
import type {RawParsedTx} from '../../../modules/solana/txDetail';

// ── Module mocks (jest.mock is hoisted above all imports) ─────────────────────

const mockParsed: {raw: RawParsedTx | undefined; isLoading: boolean; notFound: boolean} = {raw: undefined, isLoading: false, notFound: false};
jest.mock('../../../hooks/useParsedTx', () => ({useParsedTx: jest.fn(() => mockParsed)}));

// owner, Q2: the dashboard's hide-balances setting, controlled here (the store's one field this screen reads)
const mockHide = {current: false};
jest.mock('../../../store/zustand/publicSettingsStore', () => ({
  usePublicSettingsStore: (sel: (s: {hideBalances: boolean}) => unknown) => sel({hideBalances: mockHide.current}),
}));

const mockPrices: {current: Record<string, {usd: number; change24h: null}>} = {current: {}};
jest.mock('../../../hooks/useResolvedPrices', () => ({useResolvedPrices: () => ({prices: mockPrices.current, havePrices: true})}));

// the symbol source and the classifier's constants are the devnet build's (the jest Config mock is mainnet)
jest.mock('../../../modules/tokens/trustedSymbol', () => ({
  trustedSymbol: (mint: string) => (mint === 'native' ? 'SOL' : mint === 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs' ? 'TEST' : `${mint.slice(0, 6)}…${mint.slice(-4)}`),
}));
jest.mock('../../../modules/solana/activityContext', () => ({
  activityContext: (own?: ReadonlySet<string>) => ({
    symbolOf: (mint: string) => (mint === 'native' ? 'SOL' : mint === 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs' ? 'TEST' : `${mint.slice(0, 6)}…${mint.slice(-4)}`),
    cluster: 'devnet',
    a0: {cluster: 'devnet', mint: 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs'},
    feeTreasury: 'TreasuryXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    relayerFeePayer: '3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe',
    jupiterProgramId: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
    ownTokenAccounts: own ?? new Set<string>(),
  }),
}));

jest.mock('../../../store/mmkv/instances', () => ({
  mmkvPublic: {
    set: jest.fn(),
    getString: jest.fn(),
    getBoolean: jest.fn().mockReturnValue(false),
    getAllKeys: jest.fn().mockReturnValue([]),
    remove: jest.fn(),
  },
  mmkvSecure: jest.fn().mockReturnValue(null),
  initSecureMmkv: jest.fn(),
  onSecureMmkvReady: jest.fn(),
  onSecureMmkvReset: jest.fn(),
}));

jest.mock('../../../store/zustand/shieldedStore', () => ({
  useShieldedStore: jest.fn((selector: (s: {mode: string}) => unknown) => selector({mode: 'transparent'})),
}));

jest.mock('../../../utils/explorerUrl', () => ({
  getExplorerUrl: jest.fn((sig: string) => `https://solscan.io/tx/${sig}`),
}));

jest.mock('../../../modules/addressBook/addressBookModule', () => ({
  addressBook: {
    addContact: jest.fn(),
    findByAddress: jest.fn().mockReturnValue(null),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const load = (name: string): RawParsedTx =>
  (JSON.parse(readFileSync(join(__dirname, '../../../modules/solana/__tests__/fixtures', name), 'utf8')) as {result: RawParsedTx}).result;

const MAIN = 'Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B';
const ACC_2 = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
const ACC_3 = '5H8T9XjLHXL3hUtHo5hKNvgHkWKny484GdVEVxg2rZF7';
const OUTSIDE = 'EfHSPxjapWuecfjRp6eRL2PR3YjpKbk86jm5kqmwXGgk';
const TEST_MINT = 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs';
const SELLER = '4wK1vV3d1ZoZvYED9RafrDAS1XvsvkYJuLN3XxSHTpd5';
const WRAPPER = 'G1k6vgWH6REJUYHQBDri9r6KPryX61keqTgHfp8Exb8n';
const SIG = 'SIG12345678ABCDEFGHIJ';

function screen(fixture: string | RawParsedTx, account: string | null) {
  mockParsed.raw = typeof fixture === 'string' ? load(fixture) : fixture;
  return render(
    <SafeAreaProvider initialMetrics={{insets: {top: 0, bottom: 0, left: 0, right: 0}, frame: {x: 0, y: 0, width: 0, height: 0}}}>
      <TransactionDetailScreen signature={SIG} account={account} onBack={jest.fn()} />
    </SafeAreaProvider>,
  );
}
const changes = (r: ReturnType<typeof screen>): string[] =>
  r.queryAllByTestId(/^tx-detail-change-\d+$/).map(x => (Array.isArray(x.props.children) ? x.props.children.join('') : String(x.props.children)));

beforeEach(() => {
  mockParsed.raw = undefined;
  mockParsed.isLoading = false;
  mockParsed.notFound = false;
  mockPrices.current = {};
  mockHide.current = false;
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('states', () => {
  // D1
  it('loading', () => {
    mockParsed.isLoading = true;
    const r = render(
      <SafeAreaProvider initialMetrics={{insets: {top: 0, bottom: 0, left: 0, right: 0}, frame: {x: 0, y: 0, width: 0, height: 0}}}>
        <TransactionDetailScreen signature={SIG} account={ACC_2} onBack={jest.fn()} />
      </SafeAreaProvider>,
    );
    expect(r.getByText('Loading transaction…')).toBeTruthy();
  });

  // D2
  it('not indexed yet: "Couldn\'t load this transaction", with the explorer and Back', () => {
    mockParsed.notFound = true;
    const onBack = jest.fn();
    const r = render(
      <SafeAreaProvider initialMetrics={{insets: {top: 0, bottom: 0, left: 0, right: 0}, frame: {x: 0, y: 0, width: 0, height: 0}}}>
        <TransactionDetailScreen signature={SIG} account={ACC_2} onBack={onBack} />
      </SafeAreaProvider>,
    );
    expect(r.getByText("Couldn't load this transaction")).toBeTruthy();
    expect(r.getByText('View on explorer')).toBeTruthy();
    fireEvent.press(r.getByText('Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  // D3
  it('ready: the top bar, status, hash, block and the exact network fee', () => {
    const r = screen('tx-test-to-main.json', ACC_2);
    expect(r.getAllByText('Transaction').length).toBeGreaterThanOrEqual(1); // the top bar
    expect(r.getAllByText('Confirmed').length).toBeGreaterThanOrEqual(1);
    expect(r.getByText('Hash')).toBeTruthy();
    expect(r.getByText('525080588')).toBeTruthy();
    expect(r.getByText('0.000007 SOL')).toBeTruthy();
    fireEvent.press(r.getByLabelText('Go back'));
  });
});

describe('the hero is the row (§4.6)', () => {
  // D4
  it('a token send opened from the sender (QAgzVzY6…): "Sent", "0.0002 TEST" without a sign, From / To = the two wallets', () => {
    const r = screen('tx-test-to-main.json', ACC_2);
    expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Sent');
    expect(r.getAllByText('Sent')).toHaveLength(2); // the eyebrow and the Type row say the same word
    expect(r.getByTestId('tx-detail-amount')).toHaveTextContent('0.0002 TEST');
    expect(r.getByTestId('tx-detail-from')).toHaveTextContent(/^9Y7Ftt/);
    expect(r.getByTestId('tx-detail-to')).toHaveTextContent(/^Da83cA/); // the wallet, never the token account
    expect(r.getByTestId('tx-detail-to')).not.toHaveTextContent(/A3hWoQ/);
    expect(r.queryByText('Authorized by')).toBeNull();
    expect(r.queryByText('Fee payer')).toBeNull();
    expect(r.queryByTestId('tx-detail-changes')).toBeNull();
    expect(r.getByText('Save to address book')).toBeTruthy();
  });

  // D5 (R9)
  it('the same transaction opened from main reads "Received"; one\'s own account is not offered as a contact', () => {
    const r = screen('tx-test-to-main.json', MAIN);
    expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Received');
    expect(r.getByTestId('tx-detail-amount')).toHaveTextContent('0.0002 TEST');
    expect(r.getByTestId('tx-detail-from')).toHaveTextContent(/^9Y7Ftt/);
    expect(r.getByTestId('tx-detail-to')).toHaveTextContent(/^Da83cA/);
    expect(r.queryByText('Save to address book')).toBeNull();
  });

  // D6
  it('the hero equals the #26 row for the same fixture and account', () => {
    const cases: Array<[string, string]> = [
      ['tx-test-to-main.json', MAIN],
      ['tx-sol-transfer.json', ACC_3],
      ['tx-deposit-3d31ATap.json', MAIN],
      ['tx-unshield-relayed-54J9kjQ8.json', ACC_3],
      ['tx-jupiter-token-to-sol-2FSgk4Ge.json', SELLER],
      ['tx-wrap-existing-33qVTEpP.json', WRAPPER],
    ];
    const {activityContext} = jest.requireMock('../../../modules/solana/activityContext') as {activityContext: () => ActivityContext};
    for (const [fixture, account] of cases) {
      const row = classifyActivity(load(fixture), account, 'confirmed', activityContext());
      const r = screen(fixture, account);
      expect(r.getByTestId('tx-detail-amount')).toHaveTextContent(heroAmount(row)!);
      r.unmount();
    }
  });

  // D7
  it('a third party, and no account (a deep link): "Transaction", no amount line, the fee payer, no contact', () => {
    for (const account of [OUTSIDE, null]) {
      const r = screen('tx-test-to-main.json', account);
      expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Transaction');
      expect(r.queryByTestId('tx-detail-amount')).toBeNull();
      expect(r.queryByText('From')).toBeNull();
      expect(r.queryByText('To')).toBeNull();
      expect(r.getByText('Fee payer')).toBeTruthy();
      expect(r.queryByTestId('tx-detail-changes')).toBeNull();
      expect(r.queryByText('Save to address book')).toBeNull();
      r.unmount();
    }
  });

  // D8 — DERIVED from QAgzVzY6…: `meta.err` is set
  it('a failed transaction: "Failed", the Failed pill, no amount, no From / To', () => {
    const tx = load('tx-test-to-main.json');
    tx.meta!.err = {InstructionError: [2, 'Custom']};
    const r = screen(tx, ACC_2);
    expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Failed');
    expect(r.queryByText('Sent')).toBeNull();
    expect(r.queryByTestId('tx-detail-amount')).toBeNull();
    expect(r.queryByText('From')).toBeNull();
    expect(r.getByText('Fee payer')).toBeTruthy();
  });

  // D9
  it('a swap (2FSgk4Ge…): "Swapped", "{out} {sym} → {in} {sym}", and the balance changes in place of From / To', () => {
    const r = screen('tx-jupiter-token-to-sol-2FSgk4Ge.json', SELLER);
    expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Swapped');
    expect(r.getByTestId('tx-detail-amount')).toHaveTextContent('135,435.988491 3gmFG4…pump → 0.00466848 SOL');
    expect(r.queryByText('From')).toBeNull();
    expect(r.getByText('Fee payer')).toBeTruthy();
    expect(r.getByText('Balance changes')).toBeTruthy();
    expect(changes(r)).toEqual(['−135,435.988491 3gmFG4…pump', '+0.00466848 SOL']);
  });

  // D10
  it('a deposit (3d31ATap…): "Made private", the token; the rho rent is labelled', () => {
    const r = screen('tx-deposit-3d31ATap.json', MAIN);
    expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Made private');
    expect(r.getByTestId('tx-detail-amount')).toHaveTextContent('0.0001 TEST');
    expect(changes(r)).toEqual(['−0.0001 TEST', '−0.00069596 SOL · account rent']);
    expect(r.queryByText('To')).toBeNull();
  });

  // D11
  it('the relayed unshield (54J9kjQ8…): "Made public", the token; the gas grant is labelled; the relayer is the fee payer', () => {
    const r = screen('tx-unshield-relayed-54J9kjQ8.json', ACC_3);
    expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Made public');
    expect(r.getByTestId('tx-detail-amount')).toHaveTextContent('0.00001 TEST');
    expect(changes(r)).toEqual(['+0.00001 TEST', '+0.003 SOL · gas grant']);
    expect(r.queryByText('From')).toBeNull();
  });

  // D12
  it('a wrap (33qVTEpP…): "Wrapped SOL" and the SOL amount — never "Sent" to one\'s own token account', () => {
    const r = screen('tx-wrap-existing-33qVTEpP.json', WRAPPER);
    expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Wrapped SOL');
    expect(r.getByTestId('tx-detail-amount')).toHaveTextContent('59.167663567 SOL');
    expect(r.queryByText('Save to address book')).toBeNull();
    expect(r.queryByText('To')).toBeNull();
  });

  // D13
  it("creating one's own token account (pXiTRFpg…): \"Transaction\", the rent as the amount and as a labelled change", () => {
    const r = screen('tx-ata-own-pXiTRFpg.json', 'BUpWiWy8Tqed4jy86dr7ZpoaE747DpQsrGnwmtpMwfBr');
    expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Transaction');
    expect(r.getByTestId('tx-detail-amount')).toHaveTextContent('0.00151384 SOL');
    expect(changes(r)).toEqual(['−0.00151384 SOL · account rent']);
  });

  // D21 (plan review r1 m6; spec §4.6, r3 m-f) — DERIVED from pXiTRFpg… as the classifier's test A37 is: a second,
  // owner-less token entry is added at account key 4
  it("opened from #26, the history session's token accounts reach the classifier: an incomplete row is not shown as account setup", async () => {
    const OWNER = 'BUpWiWy8Tqed4jy86dr7ZpoaE747DpQsrGnwmtpMwfBr';
    const KEY_4 = '6rRptDJnoTGfZzCpFqERAkNt6kCjXzTJcdwtCPYppump';
    const derived = (): RawParsedTx => {
      const tx = load('tx-ata-own-pXiTRFpg.json');
      tx.meta!.postTokenBalances!.push({accountIndex: 4, mint: 'M', uiTokenAmount: {amount: '1', decimals: 6}});
      return tx;
    };
    dropHistorySessions();
    // control — no session (the detail opened from #21): the entry is not known to be this account's
    const without = screen(derived(), OWNER);
    expect(without.getByTestId('tx-detail-amount')).toHaveTextContent('0.00151384 SOL');
    without.unmount();
    // #26 was open for this account, and its session reads KEY_4 as one of the account's token accounts
    const session = historySession(NETWORK, OWNER, {
      listSources: async () => ({sources: [OWNER, KEY_4], tokenAccounts: [KEY_4], tokenAccountsTotal: 1}),
      fetchSignatures: async () => [],
    });
    await session.loadNextPage();
    const r = screen(derived(), OWNER);
    expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Transaction');
    expect(r.queryByTestId('tx-detail-amount')).toBeNull(); // unattributed: no figure is claimed
    dropHistorySessions();
  });
});

describe('From / To only when the transfer agrees with the row (§4.6, r2 N7)', () => {
  // D14 — DERIVED from 5i53q9tR…: a second recipient entry (another owner, +100) is added
  it('a send to two recipients shows no To: the fee payer and the balance changes instead', () => {
    const tx = load('tx-test-to-outside.json');
    const second = {accountIndex: 3, mint: TEST_MINT, owner: MAIN, uiTokenAmount: {amount: '0', decimals: 9}};
    tx.meta!.preTokenBalances!.push(second);
    tx.meta!.postTokenBalances!.push({...second, uiTokenAmount: {amount: '100', decimals: 9}});
    const r = screen(tx, ACC_2);
    expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Sent');
    expect(r.queryByText('To')).toBeNull();
    expect(r.queryByText('From')).toBeNull();
    expect(r.getByText('Fee payer')).toBeTruthy();
    expect(changes(r)).toEqual(['−0.0005 TEST']);
    expect(r.queryByText('Save to address book')).toBeNull();
  });

  // D15 — DERIVED from 5i53q9tR…: the recipient's entries lose their `owner` (R11)
  it('the recipient wallet unknown: a token account is never shown as To, and is not offered as a contact', () => {
    const tx = load('tx-test-to-outside.json');
    delete tx.meta!.preTokenBalances![1]!.owner;
    delete tx.meta!.postTokenBalances![1]!.owner;
    const r = screen(tx, ACC_2);
    expect(r.queryByText('To')).toBeNull();
    expect(r.queryByText('token account')).toBeNull();
    expect(changes(r)).toEqual(['−0.0005 TEST']);
    expect(r.queryByText('Save to address book')).toBeNull();
  });

  // D16 — DERIVED from QAgzVzY6…: the transfer's `authority` is another key (a delegate)
  it('a delegated transfer keeps From = the owner and adds "Authorized by" (27f)', () => {
    const DELEGATE = 'DLGTxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
    const tx = load('tx-test-to-main.json');
    const ix = (tx.transaction!.message!.instructions as Array<{parsed?: {type?: string; info?: Record<string, unknown>}}>).find(x => x.parsed?.type === 'transferChecked')!;
    ix.parsed!.info!.authority = DELEGATE;
    const r = screen(tx, MAIN);
    expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Received');
    expect(r.getByTestId('tx-detail-from')).toHaveTextContent(/^9Y7Ftt/);
    expect(r.getByText('Authorized by')).toBeTruthy();
    expect(r.getByTestId('tx-detail-authority')).toHaveTextContent(/^DLGTxx/);
  });

  // D17 — DERIVED from QAgzVzY6…: the sender's entries lose their `owner` (the sender wallet is not named)
  it('a null From never shows "From —": the balance-changes form shows instead (r3 m-e)', () => {
    const tx = load('tx-test-to-main.json');
    delete tx.meta!.preTokenBalances![0]!.owner;
    delete tx.meta!.postTokenBalances![0]!.owner;
    const r = screen(tx, MAIN);
    expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Received');
    expect(r.queryByText('From')).toBeNull();
    expect(r.queryByText('Authorized by')).toBeNull();
    expect(changes(r)).toEqual(['+0.0002 TEST']);
  });
});

describe('hide balances (owner, Q2)', () => {
  // D22
  it('every figure reads "•••": the hero, today\'s value, each balance change, the fee — words and addresses stay', () => {
    mockPrices.current = {native: {usd: 150, change24h: null}};
    mockHide.current = true;
    const hidden = screen('tx-sol-to-empty-2bGSoVSG.json', MAIN); // main sent 0.001 SOL
    expect(hidden.getByTestId('tx-detail-direction')).toHaveTextContent('Sent');
    // exact: "•••" and nothing else (a substring match would also pass on a longer mask)
    expect(hidden.getByTestId('tx-detail-amount')).toHaveTextContent(VALUE_HIDDEN, {exact: true});
    expect(hidden.getByTestId('tx-detail-usd')).toHaveTextContent(VALUE_HIDDEN, {exact: true});
    expect(hidden.getAllByText(VALUE_HIDDEN)).toHaveLength(3); // the hero, today's value, and the network fee
    expect(hidden.queryByText(/SOL|\$/)).toBeNull(); // no figure anywhere: not the hero, not the value, not the fee
    // ruling C: a screen reader says "Hidden" for every masked figure, never the mask
    expect(hidden.getByTestId('tx-detail-amount').props.accessibilityLabel).toBe(VALUE_HIDDEN_SPOKEN);
    expect(hidden.getByTestId('tx-detail-usd').props.accessibilityLabel).toBe(VALUE_HIDDEN_SPOKEN);
    const feeMask = hidden.getAllByText(VALUE_HIDDEN).filter(n => n.props.testID === undefined);
    expect(feeMask).toHaveLength(1);
    expect(feeMask[0]!.props.accessibilityLabel).toBe(VALUE_HIDDEN_SPOKEN);
    expect(hidden.getByText('Network fee')).toBeTruthy();
    expect(hidden.getByText('From')).toBeTruthy();
    expect(hidden.getAllByText('Confirmed').length).toBeGreaterThanOrEqual(1);
    hidden.unmount();
    const changesHidden = screen('tx-unshield-relayed-54J9kjQ8.json', ACC_3);
    expect(changesHidden.getByTestId('tx-detail-direction')).toHaveTextContent('Made public');
    expect(changes(changesHidden)).toEqual([VALUE_HIDDEN, `${VALUE_HIDDEN} · gas grant`]);
    expect(changesHidden.queryAllByTestId(/^tx-detail-change-\d+$/).map(x => x.props.accessibilityLabel)).toEqual([
      VALUE_HIDDEN_SPOKEN,
      `${VALUE_HIDDEN_SPOKEN} · gas grant`,
    ]);
    changesHidden.unmount();
    // a row with no amount has no line to mask
    const none = screen('tx-test-to-main.json', OUTSIDE);
    expect(none.queryByTestId('tx-detail-amount')).toBeNull();
    none.unmount();
    mockHide.current = false; // control: the same transaction, shown
    const shown = screen('tx-sol-to-empty-2bGSoVSG.json', MAIN);
    expect(shown.getByTestId('tx-detail-amount')).toHaveTextContent('0.001 SOL');
    expect(shown.getByTestId('tx-detail-usd')).toHaveTextContent("≈ $0.15 at today's price");
    expect(shown.getAllByText(/ SOL$/).length).toBeGreaterThanOrEqual(2); // the hero and the fee
    expect(shown.getByTestId('tx-detail-amount').props.accessibilityLabel).toBeUndefined(); // unmasked: read as written
  });
});

describe('"at today\'s price" (H7)', () => {
  // D18
  it('appears only with a price for the hero asset, and says whose price it is', () => {
    const none = screen('tx-sol-to-empty-2bGSoVSG.json', MAIN);
    expect(none.queryByTestId('tx-detail-usd')).toBeNull();
    none.unmount();
    mockPrices.current = {native: {usd: 150, change24h: null}};
    const priced = screen('tx-sol-to-empty-2bGSoVSG.json', MAIN); // 0.001 SOL
    expect(priced.getByTestId('tx-detail-usd')).toHaveTextContent("≈ $0.15 at today's price");
    priced.unmount();
    // a price for another asset is not this asset's
    const other = screen('tx-test-to-main.json', MAIN);
    expect(other.queryByTestId('tx-detail-usd')).toBeNull();
  });

  // D19
  it('a large value is grouped; a value under half a cent reads "<$0.01", never "$0.00"', () => {
    mockPrices.current = {native: {usd: 150, change24h: null}};
    const wrap = screen('tx-wrap-existing-33qVTEpP.json', WRAPPER);
    expect(wrap.getByTestId('tx-detail-usd')).toHaveTextContent("≈ $8,875.15 at today's price");
    wrap.unmount();
    const tiny = screen('tx-sol-transfer.json', ACC_3); // 0.000005 SOL
    expect(tiny.getByTestId('tx-detail-usd')).toHaveTextContent("≈ <$0.01 at today's price");
  });

  // D20
  it('no account: no price line (there is no hero amount)', () => {
    mockPrices.current = {native: {usd: 150, change24h: null}};
    expect(screen('tx-sol-to-empty-2bGSoVSG.json', null).queryByTestId('tx-detail-usd')).toBeNull();
  });
});

describe('Task 8 review fixes (controller 2026-11-27)', () => {
  const OWN_UNREADABLE = {accountIndex: 1, mint: 'M', owner: MAIN, uiTokenAmount: {amount: '1'}}; // no decimals: unreadable

  // I1 — DERIVED from 2bGSoVSG…: one own token entry whose decimals cannot be read (the classifier: `incomplete`)
  it('I1: an incomplete row is marked on the hero and the changes, and has no price line; the control has neither', () => {
    mockPrices.current = {native: {usd: 150, change24h: null}};
    const control = screen('tx-sol-to-empty-2bGSoVSG.json', MAIN);
    expect(control.getByTestId('tx-detail-usd')).toBeTruthy();
    expect(control.queryByTestId('tx-detail-incomplete')).toBeNull();
    expect(control.queryByText('incomplete')).toBeNull();
    control.unmount();
    const tx = load('tx-sol-to-empty-2bGSoVSG.json');
    tx.meta!.preTokenBalances!.push(OWN_UNREADABLE);
    tx.meta!.postTokenBalances!.push(OWN_UNREADABLE);
    const r = screen(tx, MAIN);
    expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Sent');
    expect(r.getByTestId('tx-detail-amount')).toHaveTextContent('0.001 SOL');
    expect(r.queryByTestId('tx-detail-usd')).toBeNull();
    expect(r.getByTestId('tx-detail-incomplete')).toHaveTextContent('incomplete', {exact: true});
    expect(r.getByTestId('tx-detail-changes-incomplete')).toHaveTextContent('incomplete', {exact: true});
    expect(changes(r)).toEqual(['−0.001 SOL']); // the lines themselves are unchanged
  });

  // I2
  it('I2: From / To AND every other balance change — the rent a send paid is never hidden (4M9L6DFb…)', () => {
    const r = screen('tx-send-new-ata-4M9L6DFb.json', 'BxrXKJrpxyshyFdZwojGzRD2PL3ujf51tCJw7aYHSuwi');
    expect(r.getByTestId('tx-detail-from')).toBeTruthy();
    expect(r.getByTestId('tx-detail-to')).toBeTruthy();
    expect(changes(r)).toEqual(['−48.288911 Es9vMF…wNYB', '−0.00148844 SOL · account rent']); // the mocked symbol source knows no USDT
    expect(r.getByText('Balance changes')).toBeTruthy();
    expect(r.queryByText('Fee payer')).toBeNull();
  });

  // Date row
  it('the Date row: the block time in the device zone, "—" when unknown', () => {
    const r = screen('tx-test-to-main.json', MAIN);
    expect(r.getByText('Date')).toBeTruthy();
    expect(r.getByTestId('tx-detail-date')).toHaveTextContent(/^\d{1,2} [A-Z][a-z]{2} \d{4} · \d{2}:\d{2}$/);
    r.unmount();
    const tx = load('tx-test-to-main.json');
    tx.blockTime = null;
    const none = screen(tx, MAIN);
    expect(none.getByTestId('tx-detail-date')).toHaveTextContent('—', {exact: true});
  });

  // Copy on From / To / Authorized by / Hash. The 30 s clipboard clear is CAPTURED, never scheduled (no fake timers,
  // nothing left pending after the test); every other delay passes through.
  function withCapturedClears(body: (clears: Array<{id: number; fn: () => void}>, cleared: unknown[]) => void) {
    const clears: Array<{id: number; fn: () => void}> = [];
    const cleared: unknown[] = [];
    const realSet = global.setTimeout;
    const realClear = global.clearTimeout;
    const setSpy = jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void, ms?: number, ...rest: unknown[]) => {
      if (ms === 30_000) {
        const id = 9000 + clears.length;
        clears.push({id, fn});
        return id as unknown as ReturnType<typeof setTimeout>;
      }
      return (realSet as unknown as (...a: unknown[]) => ReturnType<typeof setTimeout>)(fn, ms, ...rest);
    }) as typeof setTimeout);
    const clearSpy = jest.spyOn(global, 'clearTimeout').mockImplementation(((id?: unknown) => {
      cleared.push(id);
      if (typeof id !== 'number' || id < 9000) {
        (realClear as (i?: unknown) => void)(id);
      }
    }) as typeof clearTimeout);
    try {
      body(clears, cleared);
    } finally {
      setSpy.mockRestore();
      clearSpy.mockRestore();
    }
  }

  function delegated(): RawParsedTx {
    const DELEGATE = 'DLGTxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
    const tx = load('tx-test-to-main.json');
    const ix = (tx.transaction!.message!.instructions as Array<{parsed?: {type?: string; info?: Record<string, unknown>}}>).find(x => x.parsed?.type === 'transferChecked')!;
    ix.parsed!.info!.authority = DELEGATE;
    return tx;
  }

  it('Copy on From, To, Authorized by and Hash: the full value on the clipboard, and one clear at 30 s that sets ""', () => {
    withCapturedClears(clears => {
      const r = screen(delegated(), MAIN);
      const set = Clipboard.setString as jest.Mock;
      for (const [id, full] of [
        ['from', ACC_2],
        ['to', MAIN],
        ['authority', 'DLGTxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'],
        ['hash', SIG],
      ] as const) {
        set.mockClear();
        const before = clears.length;
        fireEvent.press(r.getByTestId(`tx-detail-copy-${id}`));
        expect(set).toHaveBeenCalledTimes(1);
        expect(set).toHaveBeenCalledWith(full);
        expect(clears).toHaveLength(before + 1); // exactly one clear scheduled, at 30 000 ms
        set.mockClear();
        clears[clears.length - 1]!.fn();
        expect(set).toHaveBeenCalledWith('');
      }
    });
  });

  // N2: a later copy cancels the earlier clear — From, then To, leaves only the latest pending (never wipes the new copy early)
  it('a second copy cancels the first clear: only the latest is pending', () => {
    withCapturedClears((clears, cleared) => {
      const r = screen(delegated(), MAIN);
      fireEvent.press(r.getByTestId('tx-detail-copy-from'));
      expect(cleared).toHaveLength(0); // nothing earlier to cancel
      fireEvent.press(r.getByTestId('tx-detail-copy-to'));
      expect(clears).toHaveLength(2);
      expect(cleared).toEqual([clears[0]!.id]); // the first clear is cancelled, the second stays
      r.unmount();
      expect(cleared).toEqual([clears[0]!.id]); // leaving the screen does not cancel it: the clipboard is still wiped at 30 s
    });
  });
});
