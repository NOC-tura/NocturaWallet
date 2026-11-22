/** M1d spec §4.3 (D1; plan A13): Swap, presale and referral stay on main — said whenever another account is selected. */
import React from 'react';
import {render} from '@testing-library/react-native';

type Acc = {scheme: string; address: string; label: string; isMain: boolean};
const MAIN: Acc = {scheme: 'slip10:0', address: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk', label: 'Account 1', isMain: true};
const A3: Acc = {scheme: 'slip10:3', address: '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k', label: 'Account 4', isMain: false};
const mockMla: {selected: Acc | null; main: Acc} = {selected: MAIN, main: MAIN};
jest.mock('../../../hooks/useSelectedAccount', () => ({
  useSelectedAccount: () => mockMla.selected,
  useAccountList: () => ({accounts: [mockMla.main], seed: [], walletKind: 'slip10', unreadable: false}),
}));

import {MainAccountLine} from '../MainAccountLine';

beforeEach(() => {
  mockMla.selected = MAIN;
  mockMla.main = MAIN;
});

it('the main account selected → nothing', () => {
  expect(render(<MainAccountLine variant="from" testID="x" />).queryByTestId('x')).toBeNull();
});

it('review I1: with main selected nothing at all is mounted (no wrapper, no spacing for the 100% case)', () => {
  expect(render(<MainAccountLine variant="from" testID="x" className="mb-2" />).toJSON()).toBeNull();
});

it('review I1: the caller\'s spacing class goes onto the line itself', () => {
  mockMla.selected = A3;
  expect(render(<MainAccountLine variant="uses" testID="y" className="mb-3" />).getByTestId('y').props.className).toContain('mb-3');
});

it('another account selected → "From: Account 1 (main)" / "Uses your main account"', () => {
  mockMla.selected = A3;
  expect(render(<MainAccountLine variant="from" testID="x" />).getByTestId('x')).toHaveTextContent('From: Account 1 (main)');
  expect(render(<MainAccountLine variant="uses" testID="y" />).getByTestId('y')).toHaveTextContent('Uses your main account');
});

it('plan A13: the main account\'s own label — a slip10:3 main is "Account 4"', () => {
  mockMla.main = {...A3, isMain: true};
  mockMla.selected = {scheme: 'slip10:0', address: MAIN.address, label: 'Account 1', isMain: false};
  expect(render(<MainAccountLine variant="from" testID="x" />).getByTestId('x')).toHaveTextContent('From: Account 4 (main)');
});

it('no wallet → nothing', () => {
  mockMla.selected = null;
  expect(render(<MainAccountLine variant="uses" testID="x" />).queryByTestId('x')).toBeNull();
});
