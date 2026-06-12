import React from 'react';
import {render} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {TxSimulateScreen} from '../TxSimulateScreen';

function withSafeArea(node: React.ReactElement) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        insets: {top: 0, bottom: 0, left: 0, right: 0},
        frame: {x: 0, y: 0, width: 0, height: 0},
      }}>
      {node}
    </SafeAreaProvider>
  );
}

// Mock walletStore to avoid persist side effects
jest.mock('../../../store/zustand/walletStore', () => ({
  useWalletStore: jest.fn().mockReturnValue({
    publicKey: null,
    solBalance: '1000000000',
  }),
}));

// Mock the shieldedStore used by useMode → useShieldedStore
jest.mock('../../../store/zustand/shieldedStore', () => ({
  useShieldedStore: jest.fn((selector: (s: {mode: string}) => unknown) =>
    selector({mode: 'transparent'}),
  ),
}));

// Mock MMKV instances to avoid native module requirements
jest.mock('../../../store/mmkv/instances', () => ({
  mmkvPublic: {
    set: jest.fn(),
    getString: jest.fn(),
    getBoolean: jest.fn().mockReturnValue(false),
  },
  mmkvSecure: jest.fn().mockReturnValue(null),
  initSecureMmkv: jest.fn(),
  onSecureMmkvReady: jest.fn(),
}));

const intent = {
  mode: 'transparent' as const,
  recipient: 'Gabc',
  amount: '0.001',
  tokenMint: 'native',
  tokenSymbol: 'SOL',
  decimals: 9,
  priorityLevel: 'normal' as const,
  createAta: false,
};

it('renders the review-transfer header', () => {
  const {getByText} = render(
    withSafeArea(
      <TxSimulateScreen intent={intent} onContinue={jest.fn()} onCancel={jest.fn()} />,
    ),
  );
  expect(getByText('Review transfer')).toBeTruthy();
});
