jest.mock('react-native', () => ({
  NativeModules: {
    NocturaProver: {
      isSupported: jest.fn(),
      prove: jest.fn(),
    },
  },
}));

import {NativeModules} from 'react-native';
import {isProverSupported, nativeProve} from '../nativeProverBridge';

const mockNative = NativeModules.NocturaProver;

beforeEach(() => jest.clearAllMocks());

it('isProverSupported reflects the native module', () => {
  mockNative.isSupported.mockReturnValue(true);
  expect(isProverSupported()).toBe(true);
  mockNative.isSupported.mockReturnValue(false);
  expect(isProverSupported()).toBe(false);
});

it('nativeProve forwards zkeyPath AND wasmPath to native.prove and returns its result', async () => {
  mockNative.prove.mockResolvedValue({proofBytes: 'ab'.repeat(256), publicInputs: ['1', '2']});
  const res = await nativeProve('transfer', '{"x":1}', '/cache/transfer.zkey', '/cache/transfer.wasm');
  expect(mockNative.prove).toHaveBeenCalledWith(
    'transfer',
    '{"x":1}',
    '/cache/transfer.zkey',
    '/cache/transfer.wasm',
  );
  expect(res.proofBytes).toBe('ab'.repeat(256));
});
