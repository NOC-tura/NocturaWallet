import {useWallet} from '../WalletContext';
import {ExtIcon} from '../ui/ExtIcon';

/**
 * The popup's locked screen (spec §4.1, derived from #9): no password field — the password only ever
 * exists in the vault page (D12), so [Unlock] opens it in a tab. "Forgot password?" arrives with #39 in
 * plan 2 (the `forgot` vault mode does not exist yet; linking it now would open the plain unlock page).
 */
export function Locked() {
  const {platform} = useWallet();
  const unlock = () => {
    platform.openPage('unlock.html?mode=unlock');
    platform.closeWindow();
  };
  return (
    <div className="screen app-center">
      <div className="app-lock-tile" aria-hidden="true">
        <ExtIcon name="lock" size={28} />
      </div>
      <h1 className="noc-h1">Welcome back</h1>
      <p className="noc-body app-muted">Unlock Noctura to continue. Unlocking opens in a new tab.</p>
      <div className="app-center-actions">
        <button type="button" className="btn btn-primary" onClick={unlock}>
          Unlock
        </button>
      </div>
    </div>
  );
}
