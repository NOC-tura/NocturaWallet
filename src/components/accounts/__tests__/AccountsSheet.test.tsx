/** M1d spec §4.1: the Accounts sheet. The row balances and the prices are controlled here. */
import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import type {AccountList, WalletAccount} from '../../../modules/accounts/accountList';
import type {RowBalance} from '../../../hooks/useAccountRowBalances';

const mockRows: {current: Record<string, RowBalance>} = {current: {}};
const mockRowArgs: Array<{addresses: readonly string[]; active: boolean}> = [];
jest.mock('../../../hooks/useAccountRowBalances', () => ({
  ROW_WINDOW: 10,
  useAccountRowBalances: (addresses: readonly string[], active: boolean) => {
    mockRowArgs.push({addresses, active});
    return mockRows.current;
  },
}));
const mockPrices: {current: {prices: Record<string, {usd: number; change24h: null}>; havePrices: boolean}} = {current: {prices: {}, havePrices: false}};
jest.mock('../../../hooks/useResolvedPrices', () => ({useResolvedPrices: () => mockPrices.current}));
const mockFeatures = {shielded: true};
jest.mock('../../../constants/features', () => ({isShieldedEnabled: () => mockFeatures.shielded}));

import {AccountsSheet} from '../AccountsSheet';

const MAIN = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const A2 = '7WktogJEd2wQ9eH2oWusmcoFTgeYi6rS632UviTBJ2jm';
const A3 = '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const acc = (scheme: string, address: string, n: number, role: 'main' | 'fresh-exit', linked = false): WalletAccount => ({
  scheme, address, label: `Account ${n}`, number: n, role, isMain: role === 'main', linked,
});
const LIST: AccountList = {
  accounts: [acc('slip10:0', MAIN, 1, 'main'), acc('slip10:2', A2, 3, 'fresh-exit', true), acc('slip10:3', A3, 4, 'fresh-exit')],
  seed: [],
  walletKind: 'slip10',
  unreadable: false,
};
const sheet = (over: Partial<React.ComponentProps<typeof AccountsSheet>> = {}) => {
  const onSelect = jest.fn();
  const r = render(<AccountsSheet visible list={LIST} selectedScheme="slip10:3" hidden={false} onSelect={onSelect} onClose={jest.fn()} {...over} />);
  return {r, onSelect};
};

beforeEach(() => {
  mockRows.current = {};
  mockRowArgs.length = 0;
  mockPrices.current = {prices: {}, havePrices: false};
  mockFeatures.shielded = true;
});

it('title "Accounts"; rows in order with label, tags and the short address', () => {
  const {r} = sheet();
  expect(r.getByText('Accounts')).toBeTruthy();
  expect(r.getAllByRole('radio').map(x => x.props.testID)).toEqual(['accounts-row-slip10:0', 'accounts-row-slip10:2', 'accounts-row-slip10:3']);
  expect(r.getByTestId('accounts-row-slip10:0-tag-main')).toBeTruthy();
  expect(r.getByTestId('accounts-row-slip10:2-tag-exit')).toBeTruthy();
  expect(r.getByTestId('accounts-row-slip10:2-tag-linked')).toBeTruthy();
  expect(r.queryByTestId('accounts-row-slip10:3-tag-linked')).toBeNull();
  expect(r.getByTestId('accounts-row-slip10:3-address')).toHaveTextContent('3YqEpf…JXT94k');
  expect(r.getByText('Account 4')).toBeTruthy();
});

it('the selected row carries the check and checked state; the rows sit in a radiogroup', () => {
  const {r} = sheet();
  expect(r.getByTestId('accounts-row-slip10:3-check')).toBeTruthy();
  expect(r.queryByTestId('accounts-row-slip10:0-check')).toBeNull();
  expect(r.getByTestId('accounts-row-slip10:3').props.accessibilityState).toEqual({checked: true});
  expect(r.getByTestId('accounts-row-slip10:0').props.accessibilityState).toEqual({checked: false});
  // the group is a plain View (not an accessibility element itself, so each radio stays focusable): read its role
  expect(r.getByTestId('accounts-radiogroup').props.accessibilityRole).toBe('radiogroup');
});

it('a tap selects that row', () => {
  const {r, onSelect} = sheet();
  fireEvent.press(r.getByTestId('accounts-row-slip10:0'));
  expect(onSelect).toHaveBeenCalledWith('slip10:0');
});

it('Task 1 note: a tap on the already-selected row only closes the sheet — nothing is selected', () => {
  const onClose = jest.fn();
  const {r, onSelect} = sheet({onClose});
  fireEvent.press(r.getByTestId('accounts-row-slip10:3'));
  expect(onSelect).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('balances: read for every listed address while open; not checked yet / Balance unavailable / the token amounts', () => {
  mockRows.current = {
    [MAIN]: {state: 'ready', at: 1, data: {solBalance: '20000000', nocBalance: '0', tokenBalances: {[USDC]: '8990000'}, tokens: [{mint: USDC, symbol: 'USDC', name: 'USD Coin', decimals: 6, trust: 'core'}]}},
    [A2]: {state: 'failed'},
  };
  const {r} = sheet();
  expect(mockRowArgs[mockRowArgs.length - 1]).toEqual({addresses: [MAIN, A2, A3], active: true});
  expect(r.getByTestId('accounts-row-slip10:0-balance')).toHaveTextContent('8.99 USDC · 0.02 SOL');
  expect(r.getByTestId('accounts-row-slip10:2-balance')).toHaveTextContent('Balance unavailable');
  expect(r.getByTestId('accounts-row-slip10:3-balance')).toHaveTextContent('not checked yet');
});

it('USD where every held asset is priced', () => {
  mockPrices.current = {prices: {native: {usd: 150, change24h: null}}, havePrices: true};
  mockRows.current = {[MAIN]: {state: 'ready', at: 1, data: {solBalance: '20000000', nocBalance: '0', tokenBalances: {}, tokens: []}}};
  expect(sheet().r.getByTestId('accounts-row-slip10:0-balance')).toHaveTextContent('$3.00');
});

it('the footer for a slip10 wallet; a cli wallet lists its one account and no footer', () => {
  expect(sheet().r.getByTestId('accounts-footer')).toHaveTextContent('New accounts appear here when you make funds public to “A new account”.');
  const cli: AccountList = {accounts: [acc('cli', MAIN, 1, 'main')], seed: [], walletKind: 'cli', unreadable: false};
  const {r} = sheet({list: cli, selectedScheme: 'cli'});
  expect(r.getAllByRole('radio')).toHaveLength(1);
  expect(r.queryByTestId('accounts-footer')).toBeNull();
});

it('an unreadable registry: the main row and the line, never an empty sheet', () => {
  const l: AccountList = {accounts: [LIST.accounts[0]!], seed: [], walletKind: 'slip10', unreadable: true};
  const {r} = sheet({list: l, selectedScheme: 'slip10:0'});
  expect(r.getByTestId('accounts-unreadable')).toHaveTextContent("Other accounts can't be read right now.");
  expect(r.getAllByRole('radio')).toHaveLength(1);
});

it('plan A11 (ruling C1): a fresh exit\'s pool token is in its row — "8.99 TEST · 0.003 SOL"', () => {
  const TEST_MINT = 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs';
  mockRows.current = {
    [A3]: {
      state: 'ready',
      at: 1,
      data: {
        solBalance: '3000000',
        nocBalance: '0',
        tokenBalances: {[TEST_MINT]: '8990000000'},
        tokens: [{mint: TEST_MINT, symbol: 'TEST', name: 'Devnet test token', decimals: 9, trust: 'unknown'}],
      },
    },
  };
  expect(sheet().r.getByTestId('accounts-row-slip10:3-balance')).toHaveTextContent('8.99 TEST · 0.003 SOL');
});

it('review r1 m4: balances hidden on the dashboard → every row reads "•••"', () => {
  mockRows.current = {[MAIN]: {state: 'ready', at: 1, data: {solBalance: '20000000', nocBalance: '0', tokenBalances: {}, tokens: []}}};
  const {r} = sheet({hidden: true});
  expect(r.getByTestId('accounts-row-slip10:0-balance')).toHaveTextContent('•••');
  expect(r.getByTestId('accounts-row-slip10:3-balance')).toHaveTextContent('•••');
  expect(r.queryByText('0.02 SOL')).toBeNull();
});

it('review r1 I3: a build without private balances shows no footer (no "A new account" exists there)', () => {
  mockFeatures.shielded = false;
  expect(sheet().r.queryByTestId('accounts-footer')).toBeNull();
});

it('D6: no Add, no rename, no remove', () => {
  const {r} = sheet();
  expect(r.queryByText(/add account|rename|remove|delete/i)).toBeNull();
});

it('a closed sheet asks no balance', () => {
  sheet({visible: false});
  expect(mockRowArgs[mockRowArgs.length - 1]!.active).toBe(false);
});
