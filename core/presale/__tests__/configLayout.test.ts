import {PublicKey} from '@solana/web3.js';
import {
  readSolTreasury,
  CONFIG_SOL_TREASURY_OFFSET,
  CONFIG_ACCOUNT_LENGTH,
  CONFIG_TGE_TIMESTAMP_OFFSET,
} from '../allocation';
import {MAINNET_ADMIN_ADDRESS, MAINNET_NOC_MINT} from '../addresses';

const TREASURY = '6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd';

/** A Config account as the program lays it out, so the offsets are exercised for real. */
function config({
  admin = MAINNET_ADMIN_ADDRESS,
  saleToken = MAINNET_NOC_MINT,
  treasury = TREASURY,
  length = CONFIG_ACCOUNT_LENGTH,
} = {}): Uint8Array {
  const data = new Uint8Array(length);
  data.set(new PublicKey(admin).toBytes(), 8);
  data.set(new PublicKey(saleToken).toBytes(), 40);
  if (length >= CONFIG_SOL_TREASURY_OFFSET + 32) {
    data.set(new PublicKey(treasury).toBytes(), CONFIG_SOL_TREASURY_OFFSET);
  }
  return data;
}

describe('the Config offsets', () => {
  it('reads the treasury from a well-formed account (positive control)', () => {
    expect(readSolTreasury(config()).toBase58()).toBe(TREASURY);
  });

  it('places sol_treasury as the LAST field: 338 + 32 === 370', () => {
    // Suggested by the program side. It is a statement about OUR two constants, not about
    // the chain — which is why the layout check below exists as well.
    expect(CONFIG_SOL_TREASURY_OFFSET + 32).toBe(CONFIG_ACCOUNT_LENGTH);
    expect(CONFIG_TGE_TIMESTAMP_OFFSET).toBeLessThan(CONFIG_SOL_TREASURY_OFFSET);
  });

  it('refuses an account too short to hold the field', () => {
    expect(() => readSolTreasury(config({length: 300}))).toThrow(/needs at least 370/);
  });

  it('refuses when the layout moved under it — admin is no longer at 8', () => {
    // A field INSERTED mid-struct shifts every offset. The byte count cannot tell that
    // apart from a field appended at the end, which is harmless; reading a known value at
    // a known offset can.
    expect(() => readSolTreasury(config({admin: TREASURY}))).toThrow(/layout check failed/);
  });

  it('refuses when sale_token is no longer at 40', () => {
    expect(() => readSolTreasury(config({saleToken: TREASURY}))).toThrow(/layout check failed/);
  });

  it('still accepts an account that merely grew at the end', () => {
    // The case that must NOT fail: appending a field leaves 8, 40 and 338 valid. Failing
    // here would brick every installed wallet over a harmless program change.
    expect(readSolTreasury(config({length: CONFIG_ACCOUNT_LENGTH + 64})).toBase58()).toBe(TREASURY);
  });
});
