import {AddressGroups} from '../../../../web/src/ui/AddressGroups';
import {useWallet} from '../WalletContext';
import {ExtIcon} from '../ui/ExtIcon';
import {LockedButton} from '../ui/LockedButton';
import {useCloseTab} from '../ui/useCloseTab';
import {useCopy} from '../ui/useCopy';
import {NoWallet} from './NoWallet';

/** D10, applied to #7 as to #40 (§11.8): a tab cannot reliably open the action popup. */
export const READY_LINE = 'Wallet is ready — open the Noctura icon';
/** The vault page's WELCOME.useIt, in English (the UI bundle does not import the vault page's strings). */
export const USE_IT_LINE = 'Open the Noctura icon to use it.';

/**
 * #7 onboard-success (spec §3.7), in the UI tab at `#/created` — where the vault page hands over after
 * #6. The address comes from wallet.state (the envelope's public part, there while locked too); nothing
 * else is read. A wallet whose keys did not reach the background is `created-locked`: "Wallet created.
 * Unlock it to use it." + [Unlock] → the vault page, which comes back here (`return=created`).
 */
export function Created() {
  const m = useWallet();
  const [copied, copy] = useCopy();
  const tab = useCloseTab(m.platform);
  if (m.phase === 'no-wallet') return <NoWallet />;
  const account = m.wallet?.accounts.find(a => a.index === 0) ?? m.wallet?.accounts[0] ?? null;
  if (m.phase === 'locked') {
    return (
      <div className="screen app-center">
        <p className="noc-body">Wallet created. Unlock it to use it.</p>
        <div className="app-center-actions">
          {/* Rule 6 (§7.6): one hand-over per tap. */}
          <LockedButton onPress={() => m.platform.navigate('unlock.html?mode=unlock&return=created')}>Unlock</LockedButton>
        </div>
      </div>
    );
  }
  if (account === null) {
    // Unlocked but no account to show: fail closed with the vault page's own neutral line (WELCOME.useIt)
    // — no address, no [Unlock] that would bring the user back here (Task 15 fix round 1, m-2).
    return (
      <div className="screen app-center">
        <p className="noc-body">{USE_IT_LINE}</p>
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
  const label = copied === 'copied' ? 'Copied' : copied === 'failed' ? 'Copy failed' : 'Copy address';
  return (
    <div className="screen s-success">
      <div className="hero">
        <div className="ring">
          <ExtIcon name="check" size={44} />
        </div>
        <div>
          <h1 className="noc-display app-onb-title">Wallet created</h1>
          <p className="noc-body app-muted app-onb-lede">Your Solana address is below. Receive funds at any time.</p>
        </div>
      </div>
      <div className="addr-card">
        <div className="noc-overline app-dim app-onb-eyebrow">Solana address</div>
        <div className="addr-row">
          <span className="noc-body addr-mono">
            <AddressGroups address={account.publicKey} />
          </span>
          <button type="button" className="copy-btn" aria-label={label} title={label} onClick={() => copy(account.publicKey)}>
            <ExtIcon name={copied === 'copied' ? 'check' : copied === 'failed' ? 'close' : 'copy'} size={20} />
          </button>
        </div>
        <div className="noc-caption app-dim app-onb-help">Copying puts the address on your clipboard. Noctura does not clear it afterwards.</div>
      </div>
      <div className="card app-onb-next">
        <div className="noc-overline app-dim app-onb-eyebrow">Next steps</div>
        <ul className="app-onb-steps">
          <li className="noc-body">
            <span className="app-onb-arrow">
              <ExtIcon name="arrow-right" size={18} />
            </span>
            Fund the wallet with SOL or NOC
          </li>
          <li className="noc-body">
            <span className="app-onb-arrow">
              <ExtIcon name="arrow-right" size={18} />
            </span>
            Pin Noctura to your browser toolbar so it is one click away
          </li>
        </ul>
      </div>
      <div className="app-onb-grow" />
      <div className="sticky-bar">
        <p className="noc-body app-center-text">{READY_LINE}</p>
        {tab.refused ? null : (
          <LockedButton className="btn btn-secondary" onPress={tab.close}>
            Close this tab
          </LockedButton>
        )}
      </div>
    </div>
  );
}
