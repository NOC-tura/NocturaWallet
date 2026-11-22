import React from 'react';
import {Image} from 'react-native';
import {render} from '@testing-library/react-native';
import {TokenLogo} from '../TokenLogo';

describe('TokenLogo', () => {
  it('renders a remote Image when a non-core logoUri is given', () => {
    const {UNSAFE_getAllByType} = render(
      <TokenLogo symbol="BONK" isNoc={false} logoUri="https://cdn.helius-rpc.com/b" />,
    );
    const imgs = UNSAFE_getAllByType(Image);
    expect(imgs.some(i => JSON.stringify(i.props.source).includes('cdn.helius-rpc.com'))).toBe(true);
  });

  it('falls back to a letter when no logoUri and not a core token', () => {
    const {getByText} = render(<TokenLogo symbol="WIF" isNoc={false} />);
    expect(getByText('W')).toBeTruthy();
  });

  it('R7: "wSOL" gets the Solana logo (not the letter "w")', () => {
    const {UNSAFE_getAllByType, queryByText} = render(<TokenLogo symbol="wSOL" isNoc={false} />);
    expect(UNSAFE_getAllByType(Image)).toHaveLength(1);
    expect(queryByText('w')).toBeNull();
  });
});
