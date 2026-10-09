import {useEffect, useState} from 'react';
import {useWallet} from '../WalletContext';
import {PASSWORD_TOAST_KEY, readPref, writePref} from '../prefs';
import type {ExtensionPage} from '../platform';
import {ListRow} from '../ui/ListRow';
import {LockedButton} from '../ui/LockedButton';
import {ExtIcon, type ExtIconName} from '../ui/ExtIcon';
import {securityTasks} from './Security';
import {contactsCount} from '../addressBook';
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
  /** ix:13550: the group the address book row sits in (plan 2; Connected dApps and Air-gap omitted, D22). */
  connections: 'Connections',
  addressBook: 'Address book',
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
 * the timestamp shown; a future stamp shows nothing). The tab reads the facts again when shown again. Every row that opens a page is a LockedButton (rule 6). The rows #31 draws and the extension does
 * not have are omitted (D22; the spec's Differs list). Plan 2: Connections › Address book (ix:13552), meta "N contacts"
 * from contacts.list — a refusal leaves the meta empty; the row still opens #15.
 */
export function Settings({
  onProfile,
  onSecurity,
  onPasskey,
  onDelete,
  onAbout,
  onContacts,
  toastMs = 1_800,
  decorateMs = 5_000,
}: {
  onProfile: () => void;
  onSecurity: () => void;
  onPasskey: () => void;
  onDelete: () => void;
  onAbout: () => void;
  /** Plan 2: Connections › Address book → #15 (standalone). */
  onContacts: () => void;
  toastMs?: number;
  decorateMs?: number;
}) {
  const m = useWallet();
  const [lockFailed, setLockFailed] = useState(false);
  const [stored, setStored] = useState<StoredSettings | null>(null);
  const [toast, setToast] = useState(false);
  const [decorated, setDecorated] = useState(false);
  /** The book's size for the Address book meta; null until read, or when the read was refused (no meta then). */
  const [contacts, setContacts] = useState<number | null>(null);
  const passkey = m.wallet?.passkey === true;

  useEffect(() => {
    let alive = true;
    /** Only the newest read counts: a slower, older answer sets nothing. */
    let reads = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let contactReads = 0;
    const read = () => {
      const c = ++contactReads;
      void m.engine.contacts().then(r => {
        if (alive && c === contactReads) setContacts(r.ok ? r.data.contacts.length : null);
      });
      const n = ++reads;
      void m.engine.settings().then(r => {
        // Gone (unmounted, a new engine) or overtaken by a newer read while it read: nothing is set, toasted or remembered.
        if (!alive || n !== reads) return;
        // A failed read (the engine's only refusal here) leaves the metas empty; nothing is toasted.
        if (!r.ok) return;
        setStored(r.data);
        const at = r.data.passwordChangedAt;
        if (at === null) return;
        const age = m.now() - at;
        // A stamp from the future (a clock set back since) is no recent change: no toast (fix round 1, m4).
        if (age < 0 || age > PASSWORD_TOAST_WINDOW_MS || readPref(PASSWORD_TOAST_KEY) === String(at)) return;
        writePref(PASSWORD_TOAST_KEY, String(at));
        for (const t of timers.splice(0)) clearTimeout(t);
        setToast(true);
        setDecorated(true);
        timers.push(setTimeout(() => alive && setToast(false), toastMs));
        timers.push(setTimeout(() => alive && setDecorated(false), decorateMs));
      });
    };
    read();
    // Fix round 1 (m1): the popup reads its facts on every open; the tab stays open, so it reads them again whenever it
    // is shown again (a passkey added, the phrase verified or the password changed in the vault tab meanwhile).
    const again = () => {
      if (document.visibilityState === 'visible') read();
    };
    if (m.surface === 'tab') {
      document.addEventListener('visibilitychange', again);
      window.addEventListener('focus', again);
    }
    return () => {
      alive = false;
      for (const t of timers) clearTimeout(t);
      document.removeEventListener('visibilitychange', again);
      window.removeEventListener('focus', again);
    };
  }, [m.engine, m.surface]);

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
          {/* No wallet state yet (fix round 1, m5): no meta rather than an "Off" that may be false. */}
          <ListRow
            icon="fingerprint"
            title={SETTINGS_TEXT.passkey}
            meta={m.wallet === null ? '' : passkey ? SETTINGS_TEXT.on : SETTINGS_TEXT.off}
            tone={m.wallet === null || passkey ? undefined : 'warning'}
            onPress={onPasskey}
          />
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
        <div className="s7-group-label">{SETTINGS_TEXT.connections}</div>
        <div className="s7-list">
          <ListRow icon="link" title={SETTINGS_TEXT.addressBook} meta={contacts === null ? '' : contactsCount(contacts)} onPress={onContacts} />
        </div>
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
