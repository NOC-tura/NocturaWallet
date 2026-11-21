/** spec §3.4: nothing while the amount is ≤ max; above it the line in the danger tone. BigInt boundary. */
import React from 'react';
import {render} from '@testing-library/react-native';
import {AmountLimitHint, overLimit} from '../AmountLimitHint';

const MSG = 'You can make up to 1.99999 TEST public at once.';

describe('AmountLimitHint', () => {
  it.each([
    ['no amount', null],
    ['below the max', 1_999_989_999n],
    ['exactly the max', 1_999_990_000n],
  ])('%s → renders nothing', (_n, amount) => {
    const r = render(<AmountLimitHint amount={amount} max={1_999_990_000n} message={MSG} testID="hint" />);
    expect(r.toJSON()).toBeNull();
  });

  it('one base unit over the max → the message, danger tone', () => {
    const r = render(<AmountLimitHint amount={1_999_990_001n} max={1_999_990_000n} message={MSG} testID="hint" />);
    expect(r.getByTestId('hint').props.children).toBe(MSG);
    expect(r.getByTestId('hint').props.className).toMatch(/(^|\s)text-danger(\s|$)/);
    expect(r.getByTestId('hint-row')).toBeTruthy();
  });

  it('a zero max: any amount is over it', () => {
    expect(overLimit(1n, 0n)).toBe(true);
    expect(overLimit(0n, 0n)).toBe(false);
    expect(overLimit(null, 0n)).toBe(false);
  });
});
