import {useEffect, useRef, useState} from 'react';
import {useWallet} from '../WalletContext';
import {formatAmount} from '../../shared/amount';
import {reauthPage, type ExtensionPage} from '../platform';
import {TopBar} from '../ui/TopBar';
import {ExtIcon, type ExtIconName} from '../ui/ExtIcon';
import {LockedButton} from '../ui/LockedButton';
import {Picker} from '../ui/Picker';
import type {Settings} from '../engine';

/** #35's copy (B1b-2b §4.2): the design's strings adapted where marked, D2/D4/D5's, and O47–O51. */
export const SECURITY_TEXT = {
  title: 'Security center',
  improve: 'Improve your security',
  outstanding: (n: number) => (n === 1 ? '1 outstanding task.' : `${n} outstanding tasks.`),
  great: 'Looks great',
  allPass: 'All checks pass.',
  tasks: 'Outstanding tasks',
  taskWrite: 'Write down your recovery phrase',
  taskVerify: 'Verify recovery phrase',
  taskPasskey: 'Add a passkey',
  protections: 'Active protections',
  autoLock: 'Auto-lock',
  passkey: 'Passkey',
  verified: 'Recovery phrase verified',
  yes: 'Yes',
  on: 'On',
  off: 'Off',
  locks: 'Locks',
  autoLockCaption: 'When idle, lock the wallet after',
  autoLockNote: 'A longer time asks for your password in a new tab.',
  appLock: 'Locks when the browser closes',
  threshold: 'Re-authentication threshold',
  thresholdCaption: 'Ask for your password before sends worth more than',
  thresholdNote: 'A higher amount asks for your password in a new tab.',
  changePassword: 'Change password',
  saveFailed: 'Could not save the setting. Try again.',
  danger: 'Danger zone',
  deleteTitle: 'Delete this wallet',
  deleteBody: "Removes the encrypted keys and local data from this browser. To restore, you'll need your recovery phrase.",
  deleteButton: 'Delete wallet',
  minutes: (n: number) => `${n} min`,
} as const;

/** D1: 1 / 5 / 15 / 60 minutes — no "Never" (the engine's range is 1–60, and a short lock is one of B1's few limits). */
export const AUTOLOCK_OPTIONS = [1, 5, 15, 60].map(value => ({value, label: SECURITY_TEXT.minutes(value)}));
/** D5: $50 / $100 / $500 / $1,000, in cents. */
export const THRESHOLD_OPTIONS = [5_000, 10_000, 50_000, 100_000].map(value => ({value, label: dollars(value)}));

/** "$100", "$1,000", "$12.50" — cents, exactly (no float). */
export function dollars(cents: number): string {
  return `$${formatAmount(BigInt(cents), 2, cents % 100 === 0 ? {min: 0, max: 0} : {min: 2, max: 2})}`;
}

/** The outstanding tasks, from real facts only (D3, D4, C8): the phrase not verified (both phrase rows), no passkey. */
export type SecurityTask = 'write' | 'verify' | 'passkey';
export function securityTasks(passkey: boolean, phraseVerifiedAt: number | null): SecurityTask[] {
  return [...(phraseVerifiedAt === null ? (['write', 'verify'] as const) : []), ...(passkey ? [] : (['passkey'] as const))];
}

/**
 * #35 security center (spec B1b-2b §4.2; D1–D5, C8, C15) in the popup. No score, no ring (D3, C15): the card says whether
 * anything is left to do. Outstanding tasks (35a) or Active protections (35b, the all-clear state only — review L7, as
 * drawn); Locks with the auto-lock and threshold pickers (35c: the row opens its card) and the static app-lock row (D2);
 * the danger zone (35d) → #37. A picker value BELOW the current one is written at once; one ABOVE weakens the wallet and
 * answers `reauth-required` — the vault tab's #10 confirms it and the background applies it (E9); the popup closes and
 * never shows a choice still waiting for #10: every open reads the stored value. Rule 6: LockedButton on every option,
 * every row that opens a page (35b's "Recovery phrase verified" too — pre-flight F9) and [Delete wallet]. A settings.set
 * answered after the screen went or after a lock meanwhile sets, opens and shows nothing.
 */
export function Security({onBack, onPasskey, onDelete}: {onBack: () => void; onPasskey: () => void; onDelete: () => void}) {
  const m = useWallet();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [open, setOpen] = useState<'auto-lock' | 'threshold' | null>(null);
  const [failed, setFailed] = useState(false);
  const passkey = m.wallet?.passkey === true;

  /** False once unmounted. */
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  // The live phase (WalletContext's netRef pattern): kept current every render, read after each await.
  const phase = useRef(m.phase);
  phase.current = m.phase;
  /** Still here and unlocked. */
  const here = (): boolean => alive.current && phase.current === 'unlocked';

  useEffect(() => {
    let alive = true;
    void m.engine.settings().then(r => {
      if (alive && r.ok) setSettings(r.data);
    });
    return () => {
      alive = false;
    };
  }, [m.engine]);

  const openPage = (page: ExtensionPage | NonNullable<ReturnType<typeof reauthPage>>) => {
    m.platform.openPage(page);
    if (m.surface === 'popup') m.platform.closeWindow();
  };
  /** A picker choice: a strengthening is written; a weakening goes to #10 (E9, C1); anything else says so (O51). */
  const pick = async (key: 'autoLockMinutes' | 'reauthUsdCents', value: number) => {
    if (settings === null || settings[key] === value) return;
    setFailed(false);
    const r = await m.engine.settingsSet({[key]: value});
    if (!here()) return;
    if (r.ok) return setSettings(r.data);
    if (r.error === 'reauth-required') {
      const id = (r.data as {challengeId?: unknown} | undefined)?.challengeId;
      const page = typeof id === 'string' ? reauthPage(id) : null;
      if (page !== null) return openPage(page);
    }
    if (r.error === 'locked') return m.reload();
    setFailed(true);
  };

  if (settings === null) return <div className="screen" aria-busy="true" />;
  const tasks = securityTasks(passkey, settings.phraseVerifiedAt);
  const row = (icon: ExtIconName, title: string, meta: string | null, tone: 'warning' | 'success' | null, onPress: () => void, expanded?: boolean) => (
    <button type="button" className="s7-row" onClick={onPress} aria-expanded={expanded}>
      <span className="s7-glyph">
        <ExtIcon name={icon} size={20} />
      </span>
      <span className="s7-title">{title}</span>
      <span className={tone === 'warning' ? 's7-meta noc-warning' : tone === 'success' ? 's7-meta noc-success' : 's7-meta'}>{meta}</span>
      <span className="s7-chev">
        <ExtIcon name="chevron-right" size={16} />
      </span>
    </button>
  );
  const pageRow = (icon: ExtIconName, title: string, page: ExtensionPage, meta: string | null = null, tone: 'success' | null = null) => (
    <LockedButton className="s7-row" onPress={() => openPage(page)}>
      <span className="s7-glyph">
        <ExtIcon name={icon} size={20} />
      </span>
      <span className="s7-title">{title}</span>
      <span className={tone === 'success' ? 's7-meta noc-success' : 's7-meta'}>{meta}</span>
      <span className="s7-chev">
        <ExtIcon name="chevron-right" size={16} />
      </span>
    </LockedButton>
  );
  const task = (icon: ExtIconName, label: string, onPress: () => void) => (
    <button type="button" className="s7-task" onClick={onPress}>
      <ExtIcon name={icon} size={20} />
      <span className="label">{label}</span>
      <span className="chev">
        <ExtIcon name="chevron-right" size={16} />
      </span>
    </button>
  );

  return (
    <div className="screen">
      <TopBar title={SECURITY_TEXT.title} onBack={onBack} />
      <div className="app-security-body">
        <div className="s7-score-card no-ring">
          <div>
            <h3 className="noc-h3">{tasks.length === 0 ? SECURITY_TEXT.great : SECURITY_TEXT.improve}</h3>
            <p className="noc-body-sm app-muted">{tasks.length === 0 ? SECURITY_TEXT.allPass : SECURITY_TEXT.outstanding(tasks.length)}</p>
          </div>
        </div>

        {tasks.length > 0 ? (
          <>
            <p className="noc-overline app-dim app-overline">{SECURITY_TEXT.tasks}</p>
            <div className="s7-list">
              {tasks.includes('write') ? <LockedButtonTask icon="database" label={SECURITY_TEXT.taskWrite} onPress={() => openPage('unlock.html?mode=reveal')} /> : null}
              {tasks.includes('verify') ? <LockedButtonTask icon="shield-check" label={SECURITY_TEXT.taskVerify} onPress={() => openPage('unlock.html?mode=verify')} /> : null}
              {tasks.includes('passkey') ? task('fingerprint', SECURITY_TEXT.taskPasskey, onPasskey) : null}
            </div>
          </>
        ) : (
          <>
            <p className="noc-overline app-dim app-overline">{SECURITY_TEXT.protections}</p>
            <div className="s7-list app-protections">
              {row('lock', SECURITY_TEXT.autoLock, SECURITY_TEXT.minutes(settings.autoLockMinutes), 'success', () => setOpen(open === 'auto-lock' ? null : 'auto-lock'))}
              {row('fingerprint', SECURITY_TEXT.passkey, SECURITY_TEXT.on, 'success', onPasskey)}
              {pageRow('shield-check', SECURITY_TEXT.verified, 'unlock.html?mode=verify', SECURITY_TEXT.yes, 'success')}
            </div>
          </>
        )}

        <p className="noc-overline app-dim app-overline">{SECURITY_TEXT.locks}</p>
        <div className="s7-list">
          {row('lock', SECURITY_TEXT.autoLock, SECURITY_TEXT.minutes(settings.autoLockMinutes), null, () => setOpen(open === 'auto-lock' ? null : 'auto-lock'), open === 'auto-lock')}
          {open === 'auto-lock' ? (
            <div className="app-picker-card">
              <div className="app-picker-head">
                <span className="s7-glyph">
                  <ExtIcon name="lock" size={20} />
                </span>
                <div>
                  <div className="noc-body">{SECURITY_TEXT.autoLock}</div>
                  <div className="noc-caption app-dim">{SECURITY_TEXT.autoLockCaption}</div>
                </div>
              </div>
              <Picker label={SECURITY_TEXT.autoLock} options={AUTOLOCK_OPTIONS} value={settings.autoLockMinutes} onPick={v => pick('autoLockMinutes', v)} />
              <p className="noc-caption app-dim">{SECURITY_TEXT.autoLockNote}</p>
            </div>
          ) : null}
          <div className="s7-row app-static app-no-chev">
            <span className="s7-glyph">
              <ExtIcon name="zap" size={20} />
            </span>
            <span className="s7-title">{SECURITY_TEXT.appLock}</span>
          </div>
          {row('alert', SECURITY_TEXT.threshold, dollars(settings.reauthUsdCents), null, () => setOpen(open === 'threshold' ? null : 'threshold'), open === 'threshold')}
          {open === 'threshold' ? (
            <div className="app-picker-card">
              <div className="app-picker-head">
                <span className="s7-glyph">
                  <ExtIcon name="alert" size={20} />
                </span>
                <div>
                  <div className="noc-body">{SECURITY_TEXT.threshold}</div>
                  <div className="noc-caption app-dim">{SECURITY_TEXT.thresholdCaption}</div>
                </div>
              </div>
              <Picker label={SECURITY_TEXT.threshold} options={THRESHOLD_OPTIONS} value={settings.reauthUsdCents} onPick={v => pick('reauthUsdCents', v)} />
              <p className="noc-caption app-dim">{SECURITY_TEXT.thresholdNote}</p>
            </div>
          ) : null}
          {row('fingerprint', SECURITY_TEXT.passkey, passkey ? SECURITY_TEXT.on : SECURITY_TEXT.off, passkey ? 'success' : 'warning', onPasskey)}
          {pageRow('key', SECURITY_TEXT.changePassword, 'unlock.html?mode=password')}
        </div>
        {failed ? (
          <p className="field-msg noc-danger" role="alert">
            {SECURITY_TEXT.saveFailed}
          </p>
        ) : null}

        <p className="noc-overline noc-danger app-overline app-danger-overline">{SECURITY_TEXT.danger}</p>
        <div className="app-danger-card">
          <div className="app-danger-head">
            <ExtIcon name="alert-triangle" size={20} />
            <h3 className="noc-h3 noc-danger">{SECURITY_TEXT.deleteTitle}</h3>
          </div>
          <p className="noc-body-sm app-muted">{SECURITY_TEXT.deleteBody}</p>
          <LockedButton className="btn btn-secondary app-danger-btn" onPress={onDelete}>
            <ExtIcon name="trash" size={18} />
            {SECURITY_TEXT.deleteButton}
          </LockedButton>
        </div>
      </div>
    </div>
  );
}

/** An outstanding task that opens a vault page: a LockedButton (rule 6) in `.s7-task`'s chrome. */
function LockedButtonTask({icon, label, onPress}: {icon: ExtIconName; label: string; onPress: () => void}) {
  return (
    <LockedButton className="s7-task" onPress={onPress}>
      <ExtIcon name={icon} size={20} />
      <span className="label">{label}</span>
      <span className="chev">
        <ExtIcon name="chevron-right" size={16} />
      </span>
    </LockedButton>
  );
}
