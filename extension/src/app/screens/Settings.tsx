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
  return (
    <div className="screen">
      <div className="s-vi-top">
        <div className="left">
          <h1 className="noc-h1">Settings</h1>
        </div>
      </div>
      <div className="app-settings-body">
        <p className="s7-group-label">Account</p>
        <div className="s7-list">
          <ListRow icon="settings" title="Accounts" meta={`${n} ${n === 1 ? 'account' : 'accounts'}`} onPress={onAccounts} />
        </div>
        <p className="s7-group-label">Security</p>
        <div className="s7-list">
          {/* Rule 6 (§7.6): "Lock now" is a LockedButton — one lock per tap, 500 ms floor. Its failure
              UI is the state itself: m.lock() re-reads wallet.state after vault.lock, so a lock that
              did not happen leaves this screen (the button re-enabled) and one that did shows the
              locked screen. vault.lock fails only when the message itself fails (§1.5); the spec
              gives that no line of its own. */}
          <LockedButton className="s7-row" onPress={() => m.lock()}>
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
        <p className="s7-group-label">About</p>
        <div className="s7-list">
          <ListRow icon="info" title="About Noctura" meta={<span className="noc-mono">v{m.platform.version()}</span>} onPress={onAbout} />
        </div>
      </div>
    </div>
  );
}
