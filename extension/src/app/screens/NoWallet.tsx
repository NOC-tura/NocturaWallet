import {useWallet} from '../WalletContext';

/**
 * No wallet yet (§1.6 step 1). The popup has already opened the welcome page and asked to close;
 * this is what shows for that moment. The tab (wallet.html) does not close itself: it offers the
 * same page with a button (#9's no-wallet words).
 */
export function NoWallet() {
  const {surface, platform} = useWallet();
  if (surface === 'popup') {
    return (
      <div className="screen app-center">
        <p className="noc-body app-muted" role="status">
          Opening setup in a new tab…
        </p>
      </div>
    );
  }
  return (
    <div className="screen app-center">
      <p className="noc-body">No wallet on this browser yet.</p>
      <div className="app-center-actions">
        <button type="button" className="btn btn-primary" onClick={() => platform.openPage('unlock.html?mode=welcome')}>
          Set up a wallet
        </button>
      </div>
    </div>
  );
}
