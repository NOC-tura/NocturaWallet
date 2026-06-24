import {parseReferralInput} from '../referralInput';

const ADDR = '6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd';

describe('parseReferralInput', () => {
  it('accepts a bare base58 address', () => {
    expect(parseReferralInput(ADDR)).toBe(ADDR);
  });

  it('extracts ?ref= from a link', () => {
    expect(parseReferralInput(`https://noc-tura.io?ref=${ADDR}`)).toBe(ADDR);
  });

  it('extracts ref= followed by another param', () => {
    expect(parseReferralInput(`https://noc-tura.io?ref=${ADDR}&x=1`)).toBe(ADDR);
  });

  it('trims whitespace', () => {
    expect(parseReferralInput(`  ${ADDR}  `)).toBe(ADDR);
  });

  it('rejects junk', () => {
    expect(parseReferralInput('hello')).toBeNull();
    expect(parseReferralInput('')).toBeNull();
  });
});
