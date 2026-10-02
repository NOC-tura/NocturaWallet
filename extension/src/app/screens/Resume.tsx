import {useWallet} from '../WalletContext';
import {LockedButton} from '../ui/LockedButton';
import {useCloseTab} from '../ui/useCloseTab';
import {NoWallet} from './NoWallet';

/**
 * `wallet.html#/send/resume?account=…` — where #10 hands over after a proven re-authentication (D38).
 * PLAN-2 STAND-IN (spec §12): until plan 3 makes this route #20 with a fresh preview and its one-tap
 * Send, it only says where to go. It reads nothing, prepares nothing and sends nothing; the prepared
 * send stays in the background for #20 (or expires there).
 */
export function Resume() {
  const {platform, phase} = useWallet();
  const tab = useCloseTab(platform);
  // No wallet on this browser: nothing to continue — the tab's no-wallet screen, as on #7 (fix round 1, m-3).
  if (phase === 'no-wallet') return <NoWallet />;
  return (
    <div className="screen app-center">
      <p className="noc-body">Open the Noctura icon to continue.</p>
      <div className="app-center-actions">
        {tab.refused ? null : (
          <LockedButton className="btn btn-secondary" onPress={tab.close}>
            Close this tab
          </LockedButton>
        )}
      </div>
    </div>
  );
}
