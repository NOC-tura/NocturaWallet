jest.mock('react-native', () => ({
  NativeModules: {
    NocturaProver: {
      isSupported: jest.fn(),
      keysOpen: jest.fn(),
      keysClose: jest.fn(),
      depositRho: jest.fn(),
      matchSpent: jest.fn(),
      commitment: jest.fn(),
      prove: jest.fn(),
      confirmUnshield: jest.fn(),
    },
  },
}));

import {NativeModules} from 'react-native';
import {
  a0Commitment,
  a0ConfirmUnshield,
  a0DepositRho,
  a0KeysClose,
  a0KeysOpen,
  a0MatchSpent,
  a0Prove,
  isProverSupported,
  type A0Handle,
} from '../nativeProverBridge';

const mockNative = NativeModules.NocturaProver;
const H = '7' as A0Handle;
const RHO = '12d576a44d29fa15379dfda30a5cce14c828f6a2d2789d9a0730c47f62d7518e';

beforeEach(() => jest.clearAllMocks());

it('isProverSupported reflects the native module', () => {
  mockNative.isSupported.mockReturnValue(true);
  expect(isProverSupported()).toBe(true);
  mockNative.isSupported.mockReturnValue(false);
  expect(isProverSupported()).toBe(false);
});

describe('a0KeysOpen — the seed crosses as bytes (spec §3, C3)', () => {
  const seedValues = Array.from({length: 64}, (_, i) => (i * 37 + 11) % 256);

  it('hands native a number[] copy, then zero-fills that array AND the caller’s Uint8Array', async () => {
    let atCall: number[] = [];
    let passed: number[] | undefined;
    mockNative.keysOpen.mockImplementation(async (arr: number[]) => {
      passed = arr;
      atCall = [...arr];
      return '42';
    });
    const seed = Uint8Array.from(seedValues);
    await expect(a0KeysOpen(seed)).resolves.toBe('42');
    expect(atCall).toEqual(seedValues);
    expect(Array.isArray(passed)).toBe(true);
    expect(passed!.every(b => b === 0)).toBe(true);
    expect(seed.every(b => b === 0)).toBe(true);
  });

  it('zero-fills both when native rejects', async () => {
    let passed: number[] | undefined;
    mockNative.keysOpen.mockImplementation(async (arr: number[]) => {
      passed = arr;
      throw Object.assign(new Error('seed must be 64 bytes, got 63'), {code: 'E_A0_SEED_LENGTH'});
    });
    const seed = Uint8Array.from(seedValues.slice(0, 63));
    await expect(a0KeysOpen(seed)).rejects.toMatchObject({code: 'E_A0_SEED_LENGTH'});
    expect(passed!.length).toBe(63);
    expect(passed!.every(b => b === 0)).toBe(true);
    expect(seed.every(b => b === 0)).toBe(true);
  });

  it('zero-fills both when the native call throws synchronously', async () => {
    let passed: number[] | undefined;
    mockNative.keysOpen.mockImplementation((arr: number[]) => {
      passed = arr;
      throw new Error('bridge');
    });
    const seed = Uint8Array.from(seedValues);
    await expect(a0KeysOpen(seed)).rejects.toThrow('bridge');
    expect(passed!.every(b => b === 0)).toBe(true);
    expect(seed.every(b => b === 0)).toBe(true);
  });
});

it('the other A0 calls forward their arguments in the bridge forms', async () => {
  mockNative.keysClose.mockResolvedValue(null);
  mockNative.depositRho.mockResolvedValue(RHO);
  mockNative.matchSpent.mockResolvedValue([0, 2]);
  mockNative.commitment.mockResolvedValue('ab'.repeat(32));
  mockNative.prove.mockResolvedValue({proofBytes: 'cd'.repeat(256), publicInputs: ['01']});

  await expect(a0KeysClose(H)).resolves.toBeUndefined();
  expect(mockNative.keysClose).toHaveBeenCalledWith('7');

  await expect(a0DepositRho(H, 18446744073709551615n)).resolves.toBe(RHO);
  expect(mockNative.depositRho).toHaveBeenCalledWith('7', '18446744073709551615');

  await expect(a0MatchSpent(H, ['aa'], [RHO, 'bb'])).resolves.toEqual([0, 2]);
  expect(mockNative.matchSpent).toHaveBeenCalledWith('7', ['aa'], [RHO, 'bb']);

  await expect(a0Commitment(H, 1000000000n, RHO)).resolves.toBe('ab'.repeat(32));
  expect(mockNative.commitment).toHaveBeenCalledWith('7', '1000000000', RHO);

  const out = await a0Prove(H, 'withdraw_change', '{"rho":"…"}', null, '/z', '/w');
  expect(out).toEqual({proofBytes: 'cd'.repeat(256), publicInputs: ['01']});
  expect(mockNative.prove).toHaveBeenCalledWith('7', 'withdraw_change', '{"rho":"…"}', null, '/z', '/w');
  await a0Prove(H, 'deposit', '{}', 'ef'.repeat(16), '/z', '/w');
  expect(mockNative.prove).toHaveBeenLastCalledWith('7', 'deposit', '{}', 'ef'.repeat(16), '/z', '/w');
});

it('a negative amount or index never reaches native', async () => {
  await expect(a0DepositRho(H, -1n)).rejects.toThrow(RangeError);
  await expect(a0Commitment(H, -1n, RHO)).rejects.toThrow(RangeError);
  expect(mockNative.depositRho).not.toHaveBeenCalled();
  expect(mockNative.commitment).not.toHaveBeenCalled();
});

describe('a0ConfirmUnshield — the native confirmation (spec §4)', () => {
  const OWNER = 'GoBAmZzHvD6F4KHLNmBFh2wZAGE1dwwufeTbifSHEYfd';
  const ATA = '9hZSf8jMxBdqcvnYzj6EkQ2gPoZCoX2GcF8f1dgkyLsn';
  const AUTH = '0123456789abcdef0123456789abcdef';

  it('passes the handle, the owner and the amounts as decimal strings, and returns the approval', async () => {
    mockNative.confirmUnshield.mockResolvedValue({authId: AUTH, owner: OWNER, ata: ATA});
    await expect(a0ConfirmUnshield(H, OWNER, 18446744073709551615n, 10000n)).resolves.toEqual({
      authId: AUTH,
      owner: OWNER,
      ata: ATA,
    });
    expect(mockNative.confirmUnshield).toHaveBeenCalledWith('7', OWNER, '18446744073709551615', '10000');
  });

  it.each([
    ['not an object', 'x'],
    ['null', null],
    ['an array', [AUTH, OWNER, ATA]],
    ['a key missing', {authId: AUTH, owner: OWNER}],
    ['a key more', {authId: AUTH, owner: OWNER, ata: ATA, amount: '5'}],
    ['an uppercase authId', {authId: AUTH.toUpperCase(), owner: OWNER, ata: ATA}],
    ['a 15-byte authId', {authId: AUTH.slice(2), owner: OWNER, ata: ATA}],
    ['a non-base58 owner', {authId: AUTH, owner: `${OWNER.slice(0, 43)}0`, ata: ATA}],
    ['a numeric token account', {authId: AUTH, owner: OWNER, ata: 5}],
  ])('refuses a malformed answer: %s', async (_what, answer) => {
    mockNative.confirmUnshield.mockResolvedValue(answer);
    await expect(a0ConfirmUnshield(H, OWNER, 1n, 0n)).rejects.toMatchObject({code: 'E_A0_CONFIRM_RESULT'});
  });

  it('passes a native refusal through with its code', async () => {
    mockNative.confirmUnshield.mockRejectedValue(Object.assign(new Error('busy'), {code: 'E_A0_CONFIRM_BUSY'}));
    await expect(a0ConfirmUnshield(H, OWNER, 1n, 0n)).rejects.toMatchObject({code: 'E_A0_CONFIRM_BUSY'});
  });

  it('a negative amount or fee never reaches native', async () => {
    await expect(a0ConfirmUnshield(H, OWNER, -1n, 0n)).rejects.toThrow(RangeError);
    await expect(a0ConfirmUnshield(H, OWNER, 1n, -1n)).rejects.toThrow(RangeError);
    expect(mockNative.confirmUnshield).not.toHaveBeenCalled();
  });
});
