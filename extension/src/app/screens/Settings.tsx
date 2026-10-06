import {useEffect, useState} from 'react';
import {useWallet} from '../WalletContext';
import {PASSWORD_TOAST_KEY, readPref, writePref} from '../prefs';
import type {ExtensionPage} from '../platform';
import {ListRow} from '../ui/ListRow';
import {LockedButton} from '../ui/LockedButton';
import {ExtIcon, type ExtIconName} from '../ui/ExtIcon';
import {securityTasks} from './Security';
import type {Settings as StoredSettings} from '../engine';

/** #31's copy (B1b-2b §4.1): the design's strings adapted where marked, 2a's, and O42–O46. */
export const SETTINGS_TEXT = {
  title: 'Settings',
  tipLead: 'Tip',
  tipBody: ' — add a passkey to unlock with your fingerprint, face or security key. Your password always works too.',
  account: 'Account',
  profile: 'Profile',
  security: 'Security',
  securityCenter: 'Security center',
  toDo: (n: number) => `${n} to do`,
  allDone: 'All done',
  passkey: 'Passkey',
  on: 'On',
  off: 'Off',
  changePassword: 'Change password',
  justUpdated: 'Just updated',
  passwordUpdated: 'Password updated',
  recoveryPhrase: 'Recovery phrase',
  notVerified: 'Not verified',
  verified: 'Verified',
  lockNow: 'Lock now',
  lockFailed: 'Could not lock the wallet. Try again.',
  advanced: 'Advanced',
  // Named deleteTitle: the source gate in the unlock tests allows the engine call's name in two files only.
  deleteTitle: 'Delete wallet',
  about: 'About',
  aboutNoctura: 'About Noctura',
} as const;

/** C10: 36e shows on #31's next open within this long of the change, once per change. */
export const PASSWORD_TOAST_WINDOW_MS = 10 * 60_000;

/**
 * #31 settings (spec B1b-2b §4.1; D7, D22, C10, C16) — the popup's Settings tab root (2a §6.1: no back arrow). Account:
 * Profile → the accounts manager (meta: the selected account's name). Security: Security center (meta: the tasks left,
 * from #35's facts), Passkey (On / Off), Change password and Recovery phrase (vault-tab pages; the popup closes), and 2a's
 * Lock now. Advanced: Delete wallet → #37. About. The tip (O42) is a passkey suggestion shown only while there is none
 * (D22). 36e (C10): within ten minutes of a change the background recorded (`passwordChangedAt`), the first open shows
 * the "Password updated" toast (1.8 s) and the row's "Just updated" decoration (5 s), once per change (a UI pref keeps
 * the timestamp shown). Every row that opens a page is a LockedButton (rule 6). The rows #31 draws and the extension does
 * not have are omitted (D22; the spec's Differs list).
 */
export function Settings({
  onProfile,
  onSecurity,
  onPasskey,
  onDelete,
  onAbout,
  toastMs = 1_800,
  decorateMs = 5_000,
}: {
  onProfile: () => void;
  onSecurity: () => void;
  onPasskey: () => void;
  onDelete: () => void;
  onAbout: () => void;
  toastMs?: number;
  decorateMs?: number;
}) {
  const m = useWallet();
  const [lockFailed, setLockFailed] = useState(false);
  const [stored, setStored] = useState<StoredSettings | null>(null);
  const [toast, setToast] = useState(false);
  const [decorated, setDecorated] = useState(false);
  const passkey = m.wallet?.passkey === true;

  useEffect(() => {
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    void m.engine.settings().then(r => {
      // Gone (unmounted, a new engine) while it read: nothing is set, toasted or remembered.
      if (!alive) return;
      // A failed read (the engine's only refusal here) leaves the metas empty; nothing is toasted.
      if (!r.ok) return;
      setStored(r.data);
      const at = r.data.passwordChangedAt;
      if (at === null || m.now() - at > PASSWORD_TOAST_WINDOW_MS || readPref(PASSWORD_TOAST_KEY) === String(at)) return;
      writePref(PASSWORD_TOAST_KEY, String(at));
      setToast(true);
      setDecorated(true);
      timers.push(setTimeout(() => alive && setToast(false), toastMs));
      timers.push(setTimeout(() => alive && setDecorated(false), decorateMs));
    });
    return () => {
      alive = false;
      for (const t of timers) clearTimeout(t);
    };
  }, [m.engine]);

  // Rule 7, a controller ruling (2a review fix round 1 #6): Lock now never fails silently.
  const lockNow = async () => {
    setLockFailed(false);
    if (!(await m.lock())) setLockFailed(true);
  };
  const open = (page: ExtensionPage) => {
    m.platform.openPage(page);
    if (m.surface === 'popup') m.platform.closeWindow();
  };
  const tasks = stored === null ? null : securityTasks(passkey, stored.phraseVerifiedAt).length;
  const pageRow = (icon: ExtIconName, title: string, page: ExtensionPage, meta: {text: string; tone: 'warning' | 'success' | null} | null, justUpdated = false) => (
    <LockedButton className={justUpdated ? 's7-row app-just-updated' : 's7-row'} onPress={() => open(page)}>
      <span className="s7-glyph">
        <ExtIcon name={icon} size={20} />
      </span>
      <span className="s7-title">{title}</span>
      <span className={meta?.tone === 'warning' ? 's7-meta noc-warning' : meta?.tone === 'success' ? 's7-meta noc-success' : 's7-meta'}>{meta?.text ?? ''}</span>
      <span className="s7-chev">
        <ExtIcon name="chevron-right" size={16} />
      </span>
    </LockedButton>
  );

  return (
    <div className="screen">
      <div className="s-vi-top">
        <div className="left">
          <h1 className="noc-h1">{SETTINGS_TEXT.title}</h1>
        </div>
      </div>
      <div className="app-settings-body">
        {m.wallet !== null && !passkey ? (
          <div className="s7-tip">
            <ExtIcon name="info" size={18} />
            <p>
              <b>{SETTINGS_TEXT.tipLead}</b>
              {SETTINGS_TEXT.tipBody}
            </p>
          </div>
        ) : null}
        <div className="s7-group-label">{SETTINGS_TEXT.account}</div>
        <div className="s7-list">
          <ListRow icon="user" title={SETTINGS_TEXT.profile} meta={m.account?.name ?? ''} onPress={onProfile} />
        </div>
        <div className="s7-group-label">{SETTINGS_TEXT.security}</div>
        <div className="s7-list">
          <ListRow
            icon="shield-check"
            title={SETTINGS_TEXT.securityCenter}
            meta={tasks === null ? '' : tasks === 0 ? SETTINGS_TEXT.allDone : SETTINGS_TEXT.toDo(tasks)}
            tone={tasks === null ? undefined : tasks === 0 ? 'success' : 'warning'}
            onPress={onSecurity}
          />
          <ListRow icon="fingerprint" title={SETTINGS_TEXT.passkey} meta={passkey ? SETTINGS_TEXT.on : SETTINGS_TEXT.off} tone={passkey ? undefined : 'warning'} onPress={onPasskey} />
          {pageRow('key', SETTINGS_TEXT.changePassword, 'unlock.html?mode=password', decorated ? {text: SETTINGS_TEXT.justUpdated, tone: 'success'} : null, decorated)}
          {pageRow(
            'database',
            SETTINGS_TEXT.recoveryPhrase,
            'unlock.html?mode=reveal',
            stored === null ? null : stored.phraseVerifiedAt === null ? {text: SETTINGS_TEXT.notVerified, tone: 'warning'} : {text: SETTINGS_TEXT.verified, tone: null},
          )}
          {/* Rule 6 (§7.6): "Lock now" is a LockedButton — one lock per tap, 500 ms floor. */}
          <LockedButton className="s7-row" onPress={lockNow}>
            <span className="s7-glyph">
              <ExtIcon name="lock" size={20} />
            </span>
            <span className="s7-title">{SETTINGS_TEXT.lockNow}</span>
            <span className="s7-meta" />
            <span className="s7-chev">
              <ExtIcon name="chevron-right" size={16} />
            </span>
          </LockedButton>
        </div>
        {lockFailed ? (
          <p className="field-msg noc-danger" role="alert">
            {SETTINGS_TEXT.lockFailed}
          </p>
        ) : null}
        <div className="s7-group-label">{SETTINGS_TEXT.advanced}</div>
        <div className="s7-list">
          <ListRow icon="trash" title={SETTINGS_TEXT.deleteTitle} onPress={onDelete} danger />
        </div>
        <div className="s7-group-label">{SETTINGS_TEXT.about}</div>
        <div className="s7-list">
          <ListRow icon="info" title={SETTINGS_TEXT.aboutNoctura} meta={<span className="noc-mono noc-caption">v{m.platform.version()}</span>} onPress={onAbout} />
        </div>
      </div>
      {toast ? (
        <div className="s7-toast app-settings-toast" role="status" aria-live="polite">
          <ExtIcon name="check" size={16} />
          <span>{SETTINGS_TEXT.passwordUpdated}</span>
        </div>
      ) : null}
    </div>
  );
}
