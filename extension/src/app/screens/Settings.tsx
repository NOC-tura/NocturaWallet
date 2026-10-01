import {useState} from 'react';
import {useWallet} from '../WalletContext';
import {ListRow} from '../ui/ListRow';
import {LockedButton} from '../ui/LockedButton';
import {ExtIcon} from '../ui/ExtIcon';

/**
 * The minimal Settings tab (spec §6.1): Accounts, Lock now, About. Everything else on #31 is
 * B1b-2b's by the owner's decision (profile, currency, notifications, security centre, passkeys,
 * change password, backup, RPC, connections, advanced, delete wallet).
 */
export function Settings({onAccounts, onAbout}: {onAccounts: () => void; onAbout: () => void}) {
  const m = useWallet();
  const n = m.wallet?.accounts.length ?? 0;
  const [lockFailed, setLockFailed] = useState(false);
  // Rule 7, a controller ruling (review fix round 1 #6): Lock now never fails silently. The line awaits
  // the owner's copy (spec §6.1). On success this screen is replaced by the locked one.
  const lockNow = async () => {
    setLockFailed(false);
    if (!(await m.lock())) setLockFailed(true);
  };
  return (
    <div className="screen">
      <div className="s-vi-top">
        <div className="left">
          <h1 className="noc-h1">Settings</h1>
        </div>
      </div>
      <div className="app-settings-body">
        <div className="s7-group-label">Account</div>
        <div className="s7-list">
          <ListRow icon="settings" title="Accounts" meta={`${n} ${n === 1 ? 'account' : 'accounts'}`} onPress={onAccounts} />
        </div>
        <div className="s7-group-label">Security</div>
        <div className="s7-list">
          {/* Rule 6 (§7.6): "Lock now" is a LockedButton — one lock per tap, 500 ms floor. */}
          <LockedButton className="s7-row" onPress={lockNow}>
            <span className="s7-glyph">
              <ExtIcon name="lock" size={20} />
            </span>
            <span className="s7-title">Lock now</span>
            <span className="s7-meta" />
            <span className="s7-chev">
              <ExtIcon name="chevron-right" size={16} />
            </span>
          </LockedButton>
        </div>
        {lockFailed ? (
          <p className="field-msg noc-danger" role="alert">
            Could not lock the wallet. Try again.
          </p>
        ) : null}
        <div className="s7-group-label">About</div>
        <div className="s7-list">
          <ListRow icon="info" title="About Noctura" meta={<span className="noc-mono">v{m.platform.version()}</span>} onPress={onAbout} />
        </div>
      </div>
    </div>
  );
}
