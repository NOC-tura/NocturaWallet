import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {Share} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {ReceiveScreen} from '../ReceiveScreen';

const MOCK_ADDRESS = '7EYnhQoR9YM3N7UoaKRoA44Uy8JeaZV3qyouov87awMs';

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
  getString: jest.fn().mockResolvedValue(''),
}));
import Clipboard from '@react-native-clipboard/clipboard';

// react-native-qrcode-svg renders SVG via react-native-svg — stub to a plain
// View so tests don't pull in the SVG renderer chain.
jest.mock('react-native-qrcode-svg', () => 'QRCode');

function renderScreen(props: React.ComponentProps<typeof ReceiveScreen>) {
  return render(
    <SafeAreaProvider initialMetrics={{insets: {top: 0, bottom: 0, left: 0, right: 0}, frame: {x: 0, y: 0, width: 0, height: 0}}}>
      <ReceiveScreen {...props} />
    </SafeAreaProvider>,
  );
}

describe('ReceiveScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the wallet address text', () => {
    const {getAllByText} = renderScreen({address: MOCK_ADDRESS});
    expect(getAllByText(MOCK_ADDRESS).length).toBeGreaterThan(0);
  });

  it('renders the "Copy address" sticky CTA in plain-address mode', () => {
    const {getByText} = renderScreen({address: MOCK_ADDRESS});
    expect(getByText('Copy address')).toBeTruthy();
  });

  it('renders the "Share" sticky CTA in plain-address mode', () => {
    const {getByText} = renderScreen({address: MOCK_ADDRESS});
    expect(getByText('Share')).toBeTruthy();
  });

  it('renders mode strip eyebrow', () => {
    const {getByText} = renderScreen({address: MOCK_ADDRESS});
    expect(getByText('Transparent · public address')).toBeTruthy();
  });

  it('copies address to clipboard when address card tapped', () => {
    const {getByTestId} = renderScreen({address: MOCK_ADDRESS});
    fireEvent.press(getByTestId('copy-address-card'));
    expect(Clipboard.setString).toHaveBeenCalledWith(MOCK_ADDRESS);
  });

  it('flips overline to "Copied to clipboard" after copy', () => {
    const {getByTestId, getByText} = renderScreen({address: MOCK_ADDRESS});
    fireEvent.press(getByTestId('copy-address-card'));
    expect(getByText('Copied to clipboard')).toBeTruthy();
  });

  it('calls Share.share with the bare address in plain-address mode', () => {
    const shareSpy = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({action: 'sharedAction', activityType: undefined});
    const {getByText} = renderScreen({address: MOCK_ADDRESS});
    fireEvent.press(getByText('Share'));
    expect(shareSpy).toHaveBeenCalledWith({
      message: MOCK_ADDRESS,
      title: 'My Solana address',
    });
    shareSpy.mockRestore();
  });

  it('shows empty-state guard when address is missing', () => {
    const {getByText} = renderScreen({address: ''});
    expect(getByText('No wallet address')).toBeTruthy();
  });
});
