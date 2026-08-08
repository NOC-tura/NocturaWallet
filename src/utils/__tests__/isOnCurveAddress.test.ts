import {isOnCurveAddress} from '../isOnCurveAddress';

// Fixtures computed with the REAL @solana/web3.js (PublicKey.isOnCurve), not the
// jest mock — see the comment in isOnCurveAddress.ts for why we can't use it here.
const ON_CURVE = 'So11111111111111111111111111111111111111112';
const NOC_MINT = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';
const SYSTEM_PROGRAM = '11111111111111111111111111111111';
/** findProgramAddressSync([b'noctura-test'], SystemProgram) — a genuine PDA. */
const OFF_CURVE_PDA = 'E4E6ZBCXe3s5tBjEwTfXm2NthmxLQBZiPyTVoc2E8HNw';

describe('isOnCurveAddress', () => {
  it('accepts real on-curve ed25519 addresses', () => {
    expect(isOnCurveAddress(ON_CURVE)).toBe(true);
    expect(isOnCurveAddress(NOC_MINT)).toBe(true);
    expect(isOnCurveAddress(SYSTEM_PROGRAM)).toBe(true);
  });

  it('rejects an off-curve program-derived address', () => {
    // SOL sent to a PDA is unrecoverable unless the owning program can withdraw.
    expect(isOnCurveAddress(OFF_CURVE_PDA)).toBe(false);
  });

  it('rejects base58 that decodes to the wrong byte length', () => {
    // Both pass the old 32-44 char regex but are not 32-byte keys:
    expect(isOnCurveAddress('2'.repeat(32))).toBe(false); // decodes to 23 bytes
    expect(isOnCurveAddress('z'.repeat(44))).toBe(false); // decodes to 33 bytes
  });

  it('rejects non-base58 and empty input', () => {
    expect(isOnCurveAddress('')).toBe(false);
    expect(isOnCurveAddress('0OIl'.repeat(10))).toBe(false);
    expect(isOnCurveAddress('not an address')).toBe(false);
  });
});
