import {render, screen, act} from '@testing-library/react';
import {ConnectPanel} from '../ConnectPanel';
import {SETTLE_MS} from '../useWalletAvailability';

const connect = vi.fn();
const signMessage = vi.fn();
const signTransaction = vi.fn();

type Wallets = {adapter: {name: string}}[];
let publicKey: {toBase58: () => string} | null = null;
let wallets: Wallets = [];

// The vendor button is stubbed: this file tests OUR component, and the label below is
// the one the real WalletMultiButton was measured to render with no wallet connected.
vi.mock('@solana/wallet-adapter-react-ui', () => ({
  WalletMultiButton: () => <button type="button">Select Wallet</button>,
}));
vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({publicKey, wallets, connected: publicKey !== null, connect, signMessage, signTransaction}),
}));

/** Render and let the availability window elapse, so the component reaches a settled state. */
function renderSettled() {
  const result = render(<ConnectPanel />);
  act(() => {
    vi.advanceTimersByTime(SETTLE_MS + 1);
  });
  return result;
}

describe('ConnectPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    publicKey = null;
    wallets = [];
    connect.mockClear();
    signMessage.mockClear();
    signTransaction.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('always, in every state', () => {
    it('requests no connection and no signature on mount', () => {
      renderSettled();
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

    it.each([
      ['no wallet detected', [] as Wallets],
      ['a wallet detected', [{adapter: {name: 'Phantom'}}] as Wallets],
    ])('states that the recovery phrase is never requested — %s', (_label, detected) => {
      wallets = detected;
      renderSettled();
      expect(screen.getByText(/never ask for your recovery phrase/i)).toBeTruthy();
    });

    it('offers no field that a recovery phrase could be typed into', () => {
      const {container} = renderSettled();
      expect(container.querySelectorAll('input, textarea').length).toBe(0);
    });

    it('leaves a way to open the wallet dialog even when it found nothing', () => {
      // If detection is wrong — a wallet that registered after the window, or one this
      // build does not recognise — the user must not be stranded on advice.
      renderSettled();
      expect(screen.getByRole('button', {name: /select wallet/i})).toBeTruthy();
    });
  });

  describe('before anything has registered', () => {
    it('says it is still looking, rather than that nothing is there', () => {
      // The defect this prevents: telling a Phantom user to install Phantom because the
      // extension had not answered yet on the first paint.
      render(<ConnectPanel />);
      expect(screen.getByRole('heading', {name: /looking for a wallet/i})).toBeTruthy();
      expect(screen.queryByRole('heading', {name: /you’ll need a solana wallet/i})).toBeNull();
    });
  });

  describe('with a wallet available', () => {
    beforeEach(() => {
      wallets = [{adapter: {name: 'Phantom'}}, {adapter: {name: 'Solflare'}}];
    });

    it('asks for the connection and says what connecting costs', () => {
      renderSettled();
      expect(screen.getByRole('heading', {name: /connect your solana wallet/i})).toBeTruthy();
      expect(screen.getByText(/asks for no signature/i)).toBeTruthy();
    });

    it('names what it actually found, rather than a generic list', () => {
      renderSettled();
      expect(screen.getByText(/Phantom, Solflare/)).toBeTruthy();
    });

    it('gives no install advice to someone who already has a wallet', () => {
      renderSettled();
      expect(screen.queryByText(/extension store/i)).toBeNull();
    });
  });

  describe('with no wallet at all — the state that was a dead end', () => {
    it('explains that there is nothing to create here', () => {
      renderSettled();
      expect(screen.getByRole('heading', {name: /you’ll need a solana wallet/i})).toBeTruthy();
      expect(screen.getByText(/holds no keys of its own/i)).toBeTruthy();
    });

    it('names wallets that work with this page', () => {
      renderSettled();
      for (const name of ['Phantom', 'Solflare', 'Backpack']) {
        expect(screen.getByText(name)).toBeTruthy();
      }
    });

    it('links to none of them, and says why', () => {
      // §6.10: the site sends you nowhere. It also keeps the bundle free of external
      // hosts, which the build gate now enforces — so a link added here would fail CI.
      const {container} = renderSettled();
      expect(container.querySelectorAll('a').length).toBe(0);
      expect(screen.getByText(/shape a phishing page takes/i)).toBeTruthy();
    });

    it('sets the Android note apart, because it is for a different reader', () => {
      const {container} = renderSettled();
      expect(container.querySelector('.no-wallet-aside')?.textContent).toMatch(
        /^Using Noctura for Android\?/,
      );
    });

    it('tells an Android user to buy in the app instead of connecting here', () => {
      // The honest version of "install Noctura": that app is a direct download and is not
      // a Wallet Standard provider, so it cannot connect to this page at all. Pointing a
      // wallet-less visitor at it as a way to use THIS page would point them at nothing.
      renderSettled();
      expect(screen.getByText(/can’t connect to this page/i)).toBeTruthy();
      expect(screen.getByText(/buy in the app instead/i)).toBeTruthy();
    });
  });

  describe('connected', () => {
    it('shows the address it is acting for', () => {
      publicKey = {toBase58: () => 'KnZ5bRuaCb3JEAYgt9CJ69eWQ7i5dp5cASbTmLj39qr'};
      wallets = [{adapter: {name: 'Phantom'}}];
      renderSettled();
      expect(screen.getByText('KnZ5bRuaCb3JEAYgt9CJ69eWQ7i5dp5cASbTmLj39qr')).toBeTruthy();
    });

    it('offers the full address to copy, and keeps the recovery-phrase line in the card', () => {
      publicKey = {toBase58: () => 'KnZ5bRuaCb3JEAYgt9CJ69eWQ7i5dp5cASbTmLj39qr'};
      const {container} = renderSettled();
      expect(screen.getByRole('button', {name: 'Copy address'})).toBeTruthy();
      const card = container.querySelector('.wallet-card');
      expect(card?.classList.contains('is-connected')).toBe(true);
      expect(card?.textContent).toMatch(/never ask for your recovery phrase/i);
      expect(card?.querySelector('.addr-field')?.textContent).toBe(
        'KnZ5bRuaCb3JEAYgt9CJ69eWQ7i5dp5cASbTmLj39qr',
      );
    });

    it('stops asking a connected user to connect', () => {
      publicKey = {toBase58: () => 'KnZ5bRuaCb3JEAYgt9CJ69eWQ7i5dp5cASbTmLj39qr'};
      renderSettled();
      expect(screen.queryByRole('heading', {name: /connect your solana wallet/i})).toBeNull();
      expect(screen.queryByText(/extension store/i)).toBeNull();
    });
  });
});
