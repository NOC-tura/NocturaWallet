import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {Clipboard, Share} from 'react-native';
import {ReceiveScreen} from '../ReceiveScreen';

const MOCK_ADDRESS = '7EYnhQoR9YM3N7UoaKRoA44Uy8JeaZV3qyouov87awMs';

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.Clipboard = {
    setString: jest.fn(),
  };
  RN.Share = {
    share: jest.fn().mockResolvedValue({action: 'sharedAction'}),
  };
  return RN;
});

describe('ReceiveScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the wallet address text', () => {
    const {getAllByText} = render(<ReceiveScreen address={MOCK_ADDRESS} />);
    expect(getAllByText(MOCK_ADDRESS).length).toBeGreaterThan(0);
  });

  it('shows "Copy" button', () => {
    const {getByText} = render(<ReceiveScreen address={MOCK_ADDRESS} />);
    expect(getByText('Copy')).toBeTruthy();
  });

  it('shows "Share" button', () => {
    const {getByText} = render(<ReceiveScreen address={MOCK_ADDRESS} />);
    expect(getByText('Share')).toBeTruthy();
  });

  it('shows QR code placeholder area', () => {
    const {getByTestId} = render(<ReceiveScreen address={MOCK_ADDRESS} />);
    expect(getByTestId('qr-area')).toBeTruthy();
  });

  it('shows note about same address for all tokens', () => {
    const {getByText} = render(<ReceiveScreen address={MOCK_ADDRESS} />);
    expect(getByText('Your address works for all SPL tokens on Solana')).toBeTruthy();
  });

  it('shows token selector with SOL, NOC, USDC, USDT', () => {
    const {getByText} = render(<ReceiveScreen address={MOCK_ADDRESS} />);
    expect(getByText('SOL')).toBeTruthy();
    expect(getByText('NOC')).toBeTruthy();
    expect(getByText('USDC')).toBeTruthy();
    expect(getByText('USDT')).toBeTruthy();
  });

  it('copies address to clipboard when Copy pressed', () => {
    const {getByText} = render(<ReceiveScreen address={MOCK_ADDRESS} />);
    fireEvent.press(getByText('Copy'));
    expect(Clipboard.setString).toHaveBeenCalledWith(MOCK_ADDRESS);
  });

  it('shows "Copied!" feedback after pressing Copy', () => {
    const {getByText} = render(<ReceiveScreen address={MOCK_ADDRESS} />);
    fireEvent.press(getByText('Copy'));
    expect(getByText('Copied!')).toBeTruthy();
  });

  it('calls Share.share when Share pressed', () => {
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({action: 'sharedAction', activityType: undefined});
    const {getByText} = render(<ReceiveScreen address={MOCK_ADDRESS} />);
    fireEvent.press(getByText('Share'));
    expect(shareSpy).toHaveBeenCalledWith({
      message: MOCK_ADDRESS,
      title: 'My Solana Address',
    });
    shareSpy.mockRestore();
  });
});
