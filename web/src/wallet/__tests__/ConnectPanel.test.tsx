import {render, screen} from '@testing-library/react';
import {ConnectPanel} from '../ConnectPanel';

const connect = vi.fn();
const signMessage = vi.fn();
const signTransaction = vi.fn();

// The vendor button is stubbed: this file tests OUR component, and the label below is
// the one the real WalletMultiButton was measured to render with no wallet connected.
vi.mock('@solana/wallet-adapter-react-ui', () => ({
  WalletMultiButton: () => <button type="button">Select Wallet</button>,
}));
vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({publicKey: null, connected: false, connect, signMessage, signTransaction}),
}));

describe('ConnectPanel', () => {
  beforeEach(() => {
    connect.mockClear();
    signMessage.mockClear();
    signTransaction.mockClear();
  });

  it('renders the wallet button', () => {
    render(<ConnectPanel />);
    expect(screen.getByRole('button', {name: /select wallet/i})).toBeTruthy();
  });

  it('requests no connection and no signature on mount', () => {
    render(<ConnectPanel />);
    expect(connect).not.toHaveBeenCalled();
    expect(signMessage).not.toHaveBeenCalled();
    expect(signTransaction).not.toHaveBeenCalled();
    // Positive control: these spies do register a call, so the assertions above can
    // fail for the right reason rather than because nothing is wired to them.
    connect();
    signMessage();
    expect(connect).toHaveBeenCalledTimes(1);
    expect(signMessage).toHaveBeenCalledTimes(1);
  });

  it('states that the recovery phrase is never requested', () => {
    render(<ConnectPanel />);
    expect(screen.getByText(/never ask for your recovery phrase/i)).toBeTruthy();
  });

  it('offers no field that a recovery phrase could be typed into', () => {
    const {container} = render(<ConnectPanel />);
    expect(container.querySelectorAll('input, textarea').length).toBe(0);
  });
});
