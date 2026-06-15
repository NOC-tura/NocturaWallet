import {formatUsd, formatUsdString} from '../formatUsd';
describe('formatUsd', () => {
  it('splits whole + cents with grouping', () => {
    expect(formatUsd(14881.19)).toEqual({whole: '$14,881', cents: '.19'});
    expect(formatUsd(0)).toEqual({whole: '$0', cents: '.00'});
  });
  it('formatUsdString concatenates', () => {
    expect(formatUsdString(9872.4)).toBe('$9,872.40');
  });
});
