import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {SendScreen} from '../SendScreen';

jest.mock('../../../modules/solana/simulation', () => ({
  simulateTransaction: jest.fn().mockResolvedValue({success: true}),
}));
jest.mock('../../../modules/solana/connection', () => ({
  getConnection: jest.fn(() => ({})),
}));
jest.mock('../../../modules/solana/transactionBuilder', () => ({
  buildTransferTx: jest.fn().mockResolvedValue({}),
}));

// Mock the wallet store
jest.mock('../../../store/zustand/walletStore', () => ({
  useWalletStore: jest.fn(() => ({
    publicKey: 'So11111111111111111111111111111111111111112',
    solBalance: '1000000000',
    tokens: [],
    tokenBalances: {},
  })),
}));

describe('SendScreen', () => {
  it('shows recipient input field', () => {
    const {getByPlaceholderText} = render(<SendScreen />);
    expect(getByPlaceholderText(/recipient|address/i)).toBeTruthy();
  });

  it('shows amount input field', () => {
    const {getByPlaceholderText} = render(<SendScreen />);
    expect(getByPlaceholderText(/amount/i)).toBeTruthy();
  });

  it('shows token selector', () => {
    const {getByText} = render(<SendScreen />);
    expect(getByText('SOL')).toBeTruthy();
  });

  it('shows Review button', () => {
    const {getByText} = render(<SendScreen />);
    expect(getByText('Review')).toBeTruthy();
  });

  it('shows error when address is invalid', async () => {
    const {getByPlaceholderText, findByText} = render(<SendScreen />);
    const recipientInput = getByPlaceholderText(/recipient|address/i);
    fireEvent.changeText(recipientInput, 'abc');
    fireEvent(recipientInput, 'blur');
    const error = await findByText(/invalid|address/i);
    expect(error).toBeTruthy();
  });

  it('Review button is disabled when fields are empty', () => {
    const {getByText} = render(<SendScreen />);
    const button = getByText('Review');
    expect(button).toBeTruthy();
    // Verify disabled state: button should be disabled when no recipient or amount
    // We check by attempting to press and verifying no navigation/simulation occurs
    fireEvent.press(button);
    // If not disabled, simulation would be called — it should not be called
    const {simulateTransaction} = require('../../../modules/solana/simulation');
    expect(simulateTransaction).not.toHaveBeenCalled();
  });
});
