import {useWallet} from '../WalletContext';
import {ExtIcon} from '../ui/ExtIcon';
import {LockedButton} from '../ui/LockedButton';
import {PhraseLine} from '../ui/PhraseLine';

/**
 * The popup's locked screen (spec §4.1, derived from #9): no password field — the password only ever
 * exists in the vault page (D12), so [Unlock] opens it in a tab, and "Forgot password?" opens #39 there.
 * Both are LockedButtons (cardinal rule 6): a double click opens one tab. B1e §1.2: the anti-phishing phrase under the
 * header, from `wallet.state` (nothing when none is set; R9's line when it could not be read) — and only for a stored
 * wallet: after the accepted apply-vs-delete race (§1.4) `wallet.state` can carry a phrase with `hasWallet: false`, and
 * the no-wallet state draws no line (§1.2; Task 4 review M3).
 */
export function Locked() {
  const {platform, surface, wallet} = useWallet();
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
      {wallet === null || !wallet.hasWallet ? null : <PhraseLine phrase={wallet.phrase} />}
      <p className="noc-body app-muted">Unlock Noctura to continue. Unlocking opens in a new tab.</p>
      <div className="app-center-actions">
        <LockedButton className="btn btn-primary" onPress={open('unlock.html?mode=unlock')}>
          Unlock
        </LockedButton>
        <LockedButton className="btn btn-tertiary" onPress={open('unlock.html?mode=forgot')}>
          Forgot password?
        </LockedButton>
      </div>
    </div>
  );
}
