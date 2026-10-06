import {useWallet} from '../WalletContext';
import type {ExtensionPage} from '../platform';
import {TopBar} from '../ui/TopBar';
import {ExtIcon} from '../ui/ExtIcon';
import {LockedButton} from '../ui/LockedButton';

/** The passkey screen's copy (B1b-2b §4.4): 2a's #6 strings, D13's and the owner-confirmed O62/O63. */
export const PASSKEY_TEXT = {
  title: 'Passkey',
  offTitle: 'Unlock Noctura with a passkey',
  offLede: 'Adds convenience. Your password always works too — keep it safe.',
  fasterTitle: 'Faster unlock',
  fasterBody: 'Use your fingerprint, face or security key instead of typing your password.',
  stillTitle: 'Password still works',
  stillBody: 'If the passkey is unavailable, your password unlocks the wallet and confirms everything.',
  livesTitle: 'Where your passkey lives',
  livesBody: "A passkey synced to Google, Apple or a password manager keeps its secret in that provider's cloud. Other extensions allowed on wallet.noc-tura.io can ask for it too.",
  tip: 'Your password always works too.',
  add: 'Add a passkey',
  onTitle: 'Passkey is on',
  onLede: 'You can unlock and confirm with it. A wallet has one passkey: a new one replaces this one.',
  replace: 'Replace passkey',
  remove: 'Remove passkey',
  removeNote: 'Removing it here does not delete it from your passkey manager.',
  opensTab: 'Confirmation opens in a new tab.',
} as const;

/**
 * The passkey screen — #6's "manage" variant (spec B1b-2b §4.4, D12, D13): referenced by the design (ix:13616, 14659,
 * 14663), never drawn, so derived from #6's chrome. `off`: #6's offer, [Add a passkey]. `on`: "Passkey is on", the one-slot
 * rule, [Replace passkey] and [Remove passkey]. Every action is a proof, so each opens the vault tab (`passkey&op=…`) and
 * the popup closes; the screen itself reads only `wallet.state.passkey` (E12), and shows nothing until it is known.
 * Rule 6: LockedButton.
 */
export function Passkey({onBack}: {onBack: () => void}) {
  const m = useWallet();
  const open = (page: ExtensionPage) => {
    m.platform.openPage(page);
    if (m.surface === 'popup') m.platform.closeWindow();
  };
  const feature = (icon: 'check' | 'shield-lock' | 'info', title: string, body: string) => (
    <div className="feature-row">
      <div className="icon">
        <ExtIcon name={icon} size={18} />
      </div>
      <div>
        <div className="noc-body-lg">{title}</div>
        <div className="noc-body-sm app-muted">{body}</div>
      </div>
    </div>
  );
  // Before the wallet's state arrives neither state is known: nothing is shown, never `off` as a guess (fix round 1, M4).
  // Shell renders this screen only once unlocked, which the provider sets with the state; the guard keeps the
  // component honest on its own.
  if (m.wallet === null) return <div className="screen s-bio" aria-busy="true" />;
  const on = m.wallet.passkey;
  return (
    <div className="screen s-bio">
      <TopBar title={PASSKEY_TEXT.title} onBack={onBack} />
      <div className="hero-icon">
        <ExtIcon name="key" size={56} />
      </div>
      <div className="app-bio-head">
        <h1 className="noc-h1">{on ? PASSKEY_TEXT.onTitle : PASSKEY_TEXT.offTitle}</h1>
        <p className="noc-body app-muted">{on ? PASSKEY_TEXT.onLede : PASSKEY_TEXT.offLede}</p>
      </div>
      <div className="app-bio-features">
        {on ? null : feature('check', PASSKEY_TEXT.fasterTitle, PASSKEY_TEXT.fasterBody)}
        {on ? null : feature('shield-lock', PASSKEY_TEXT.stillTitle, PASSKEY_TEXT.stillBody)}
        {feature('info', PASSKEY_TEXT.livesTitle, PASSKEY_TEXT.livesBody)}
      </div>
      <div className="s7-tip app-bio-tip">
        <ExtIcon name="info" size={18} />
        <p>{PASSKEY_TEXT.tip}</p>
      </div>
      <div className="app-grow" />
      <div className="sticky-bar">
        {on ? (
          <>
            <LockedButton onPress={() => open('unlock.html?mode=passkey&op=add')}>{PASSKEY_TEXT.replace}</LockedButton>
            <LockedButton className="btn btn-secondary" onPress={() => open('unlock.html?mode=passkey&op=remove')}>
              {PASSKEY_TEXT.remove}
            </LockedButton>
            <p className="noc-caption app-muted app-center-text">{PASSKEY_TEXT.removeNote}</p>
          </>
        ) : (
          <LockedButton onPress={() => open('unlock.html?mode=passkey&op=add')}>{PASSKEY_TEXT.add}</LockedButton>
        )}
        <p className="noc-caption app-muted app-center-text">{PASSKEY_TEXT.opensTab}</p>
      </div>
    </div>
  );
}
