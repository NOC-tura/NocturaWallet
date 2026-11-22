/** M1d spec §4.3 (plan A14): where a fresh exit landed — read from storage only, never a guess. */
const mockNotes: {current: unknown[]; throws: boolean} = {current: [], throws: false};
jest.mock('../../shielded/a0/noteStore', () => ({
  loadA0NoteStore: () => {
    if (mockNotes.throws) throw new Error('E_A0_STORE_LOCKED');
    return {notes: mockNotes.current, nextDepositIndex: 0n};
  },
}));
const mockRegistry: {current: unknown[] | null; throws: boolean} = {current: null, throws: false};
jest.mock('../../shielded/a0/accountRegistry', () => ({
  ...jest.requireActual('../../shielded/a0/accountRegistry'),
  loadA0AccountRegistry: () => {
    if (mockRegistry.throws) throw new Error('E_A0_ACCOUNTS_CORRUPT');
    return mockRegistry.current;
  },
}));

import {freshExitAccountOf, pendingFreshSchemeOf} from '../receivedBy';

const A3 = '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k';

beforeEach(() => {
  mockNotes.current = [];
  mockNotes.throws = false;
  mockRegistry.current = null;
  mockRegistry.throws = false;
});

it('pendingFreshSchemeOf: the reserved scheme of THIS rho\'s pending fresh exit', () => {
  mockNotes.current = [
    {rho: 'r1', status: 'pending', unshield: {destination: 'fresh', scheme: 'slip10:3'}},
    {rho: 'r2', status: 'pending', unshield: {destination: 'main'}},
  ];
  expect(pendingFreshSchemeOf('r1')).toBe('slip10:3');
  expect(pendingFreshSchemeOf('r2')).toBeNull(); // not a fresh exit
  expect(pendingFreshSchemeOf('r9')).toBeNull(); // no such note
  mockNotes.throws = true;
  expect(pendingFreshSchemeOf('r1')).toBeNull(); // a store that cannot be read is no answer
});

it('freshExitAccountOf: only a fresh-exit entry of that scheme; its label and stored address', () => {
  mockRegistry.current = [
    {scheme: 'slip10:0', role: 'main', address: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'},
    {scheme: 'slip10:3', role: 'fresh-exit', address: A3},
    {scheme: 'slip10:4', role: 'fresh-pending', address: 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb'},
  ];
  expect(freshExitAccountOf('slip10:3')).toEqual({label: 'Account 4', address: A3});
  expect(freshExitAccountOf('slip10:4')).toBeNull(); // not landed (yet)
  expect(freshExitAccountOf('slip10:7')).toBeNull();
  expect(freshExitAccountOf(null)).toBeNull();
  mockRegistry.throws = true;
  expect(freshExitAccountOf('slip10:3')).toBeNull();
});
