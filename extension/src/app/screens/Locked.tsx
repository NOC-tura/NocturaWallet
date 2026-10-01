import {useWallet} from '../WalletContext';
import {ExtIcon} from '../ui/ExtIcon';

/**
 * The popup's locked screen (spec §4.1, derived from #9): no password field — the password only ever
 * exists in the vault page (D12), so [Unlock] opens it in a tab, and "Forgot password?" opens #39 there.
 */
export function Locked() {
  const {platform, surface} = useWallet();
  // The popup closes once the vault page opens; the tab (wallet.html) is the page the user is looking
  // at and stays open (§7.1 only opens ?mode=unlock; review fix round 1 #5, a ruling).
  const open = (page: 'unlock.html?mode=unlock' | 'unlock.html?mode=forgot') => () => {
    platform.openPage(page);
    if (surface === 'popup') platform.closeWindow();
  };
  return (
    <div className="screen app-center">
      <div className="app-lock-tile" aria-hidden="true">
        <ExtIcon name="lock" size={28} />
      </div>
      <h1 className="noc-h1">Welcome back</h1>
      <p className="noc-body app-muted">Unlock Noctura to continue. Unlocking opens in a new tab.</p>
      <div className="app-center-actions">
        <button type="button" className="btn btn-primary" onClick={open('unlock.html?mode=unlock')}>
          Unlock
        </button>
        <button type="button" className="btn btn-tertiary" onClick={open('unlock.html?mode=forgot')}>
          Forgot password?
        </button>
      </div>
    </div>
  );
}
