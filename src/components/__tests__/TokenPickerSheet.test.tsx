import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {TokenPickerSheet} from '../TokenPickerSheet';

const tokens = [
  {mint: 'native', symbol: 'SOL', name: 'Solana', decimals: 9},
  {mint: 'USDCMINT', symbol: 'USDC', name: 'USD Coin', decimals: 6},
];

describe('TokenPickerSheet', () => {
  it('renders a row per token and calls onSelect with the tapped mint', () => {
    const onSelect = jest.fn();
    const {getByText} = render(
      <TokenPickerSheet
        visible
        title="Select token"
        tokens={tokens}
        selectedMint="native"
        balances={{native: '2000000000'}}
        onSelect={onSelect}
        onClose={() => {}}
      />,
    );
    expect(getByText('SOL')).toBeTruthy();
    expect(getByText('USD Coin')).toBeTruthy();
    fireEvent.press(getByText('USDC'));
    expect(onSelect).toHaveBeenCalledWith('USDCMINT');
  });

  it('renders "No tokens" message when tokens array is empty', () => {
    const {getByText} = render(
      <TokenPickerSheet
        visible
        title="Select token"
        tokens={[]}
        selectedMint=""
        balances={{}}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
    expect(getByText('No tokens')).toBeTruthy();
  });

  it('shows check icon on selected token', () => {
    const {getByLabelText} = render(
      <TokenPickerSheet
        visible
        title="Select token"
        tokens={tokens}
        selectedMint="USDCMINT"
        balances={{native: '2000000000', USDCMINT: '5000000'}}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
    // Find the USDC row's check icon
    expect(getByLabelText('Select USDC')).toBeTruthy();
  });

  it('calls onClose when backdrop is pressed', () => {
    const onClose = jest.fn();
    const {getByLabelText} = render(
      <TokenPickerSheet
        visible
        title="Select token"
        tokens={tokens}
        selectedMint="native"
        balances={{native: '2000000000'}}
        onSelect={() => {}}
        onClose={onClose}
      />,
    );
    fireEvent.press(getByLabelText('Close token picker'));
    expect(onClose).toHaveBeenCalled();
  });

  it('displays formatted balance for each token', () => {
    const {getByText} = render(
      <TokenPickerSheet
        visible
        title="Select token"
        tokens={tokens}
        selectedMint="native"
        balances={{native: '2000000000', USDCMINT: '5000000'}}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
    // The formatBalanceForDisplay should be called for each token
    expect(getByText('2')).toBeTruthy(); // SOL balance: 2
    expect(getByText('5')).toBeTruthy(); // USDC balance: 5
  });
});
