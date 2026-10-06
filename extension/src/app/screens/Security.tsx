import {useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode} from 'react';
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
  /** A failed settings read: the existing approved line (Review's leaveFailed) and button (Failed's / Stuck's). */
  readFailed: 'Something went wrong. Try again.',
  tryAgain: 'Try again',
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

/**
 * The outstanding tasks, from real facts only (D3, D4, C8): no passkey, the phrase not verified (both phrase rows) — in
 * the design's order (35a, ix:14417-14419: biometric → passkey, then backup → write down, then verify).
 */
export type SecurityTask = 'write' | 'verify' | 'passkey';
export function securityTasks(passkey: boolean, phraseVerifiedAt: number | null): SecurityTask[] {
  return [...(passkey ? [] : (['passkey'] as const)), ...(phraseVerifiedAt === null ? (['write', 'verify'] as const) : [])];
}

/**
 * #35 security center (spec B1b-2b §4.2; D1–D5, C8, C15) in the popup. No score, no ring (D3, C15): the card says whether
 * anything is left to do. Outstanding tasks (35a) or Active protections (35b, the all-clear state only — review L7, as
 * drawn); Locks with the auto-lock and threshold pickers (35c: the row opens its card) and the static app-lock row (D2);
 * the danger zone (35d) → #37. A picker value BELOW the current one is written at once; one ABOVE weakens the wallet and
 * answers `reauth-required` — the vault tab's #10 confirms it and the background applies it (E9); the popup closes and
 * never shows a choice still waiting for #10: every open reads the stored value. Rule 6: LockedButton on every option,
 * every row that opens a page (35b's "Recovery phrase verified" too — pre-flight F9), every row and task that pushes the
 * passkey screen (the final review's m6) and [Delete wallet]. The tab reads the settings again when shown again. A settings.set
 * answered after the screen went or after a lock meanwhile sets, opens and shows nothing.
 */
export function Security({onBack, onPasskey, onDelete}: {onBack: () => void; onPasskey: () => void; onDelete: () => void}) {
  const m = useWallet();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [readFailed, setReadFailed] = useState(false);
  const [open, setOpen] = useState<Card>(null);
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

  /** The settings read: only the newest one counts — an unmount or a new engine (the effect's cleanup) retires it. */
  const reads = useRef(0);
  const read = useCallback(async () => {
    const n = ++reads.current;
    setReadFailed(false);
    const r = await m.engine.settings();
    if (n !== reads.current) return;
    if (r.ok) setSettings(r.data);
    else setReadFailed(true);
  }, [m.engine]);
  useEffect(() => {
    void read();
    // The final review's m5 (as #31, Task 17 m1): the popup reads on every open; the tab stays open, so it reads again
    // whenever it is shown again (a weakening #10 applied in another tab meanwhile). Only the newest read counts.
    const again = () => {
      if (document.visibilityState === 'visible') void read();
    };
    if (m.surface === 'tab') {
      document.addEventListener('visibilitychange', again);
      window.addEventListener('focus', again);
    }
    return () => {
      reads.current++;
      document.removeEventListener('visibilitychange', again);
      window.removeEventListener('focus', again);
    };
  }, [read, m.surface]);

  // 35c: an open card replaces its row in place and is scrolled into view (the 35b row stays where it is, so the tap visibly
  // does something); a focus lost with the replaced row (or the collapsed card) goes to what took its place.
  const card = useRef<HTMLDivElement>(null);
  const cardHead = useRef<HTMLButtonElement>(null);
  const rows = useRef<Record<Exclude<Card, null>, HTMLButtonElement | null>>({'auto-lock': null, threshold: null});
  const wasOpen = useRef<Card>(null);
  useLayoutEffect(() => {
    const was = wasOpen.current;
    wasOpen.current = open;
    const lost = document.activeElement === null || document.activeElement === document.body;
    if (open !== null) {
      card.current?.scrollIntoView({block: 'nearest'});
      if (lost) cardHead.current?.focus();
    } else if (was !== null && lost) rows.current[was]?.focus();
  }, [open]);
  const toggle = (which: Exclude<Card, null>) => setOpen(open === which ? null : which);

  const openPage = (page: ExtensionPage | NonNullable<ReturnType<typeof reauthPage>>) => {
    m.platform.openPage(page);
    if (m.surface === 'popup') m.platform.closeWindow();
  };
  /**
   * A picker choice: a strengthening is written; a weakening goes to #10 (E9, C1) and the screen keeps the STORED value
   * (M6: nothing is shown as chosen until #10 applies it); anything else — a challenge id that is no id included — says so
   * (O51).
   */
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

  if (settings === null) {
    return (
      <div className="screen">
        <TopBar title={SECURITY_TEXT.title} onBack={onBack} />
        {readFailed ? (
          <div className="app-security-body">
            <p className="field-msg noc-danger" role="alert">
              {SECURITY_TEXT.readFailed}
            </p>
            <LockedButton className="btn btn-secondary" onPress={read}>
              {SECURITY_TEXT.tryAgain}
            </LockedButton>
          </div>
        ) : (
          <div className="app-security-body" aria-busy="true" />
        )}
      </div>
    );
  }
  const tasks = securityTasks(passkey, settings.phraseVerifiedAt);
  const rowInner = (icon: ExtIconName, title: string, meta: string | null, tone: 'warning' | 'success' | null) => (
    <>
      <span className="s7-glyph">
        <ExtIcon name={icon} size={20} />
      </span>
      <span className="s7-title">{title}</span>
      <span className={tone === 'warning' ? 's7-meta noc-warning' : tone === 'success' ? 's7-meta noc-success' : 's7-meta'}>{meta}</span>
      <span className="s7-chev">
        <ExtIcon name="chevron-right" size={16} />
      </span>
    </>
  );
  /** A row that opens its card in place (35c): a plain toggle, nothing is pushed. */
  const row = (icon: ExtIconName, title: string, meta: string | null, tone: 'warning' | 'success' | null, onPress: () => void, expanded?: boolean, ref?: (b: HTMLButtonElement | null) => void) => (
    <button type="button" className="s7-row" onClick={onPress} aria-expanded={expanded} ref={ref}>
      {rowInner(icon, title, meta, tone)}
    </button>
  );
  /** The Passkey rows push the passkey screen: rule 6 (the final review's m6) — a double tap pushes it once. */
  const passkeyRow = (meta: string, tone: 'warning' | 'success') => (
    <LockedButton className="s7-row" onPress={onPasskey}>
      {rowInner('fingerprint', SECURITY_TEXT.passkey, meta, tone)}
    </LockedButton>
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
  /** 35c's inline card (ix:14516-14530): its head collapses it again (the row it replaced comes back). */
  const pickerCard = (which: Exclude<Card, null>, icon: ExtIconName, title: string, caption: string, picker: ReactNode, note: string) => (
    <div className="app-picker-card" ref={card}>
      <button type="button" className="app-picker-head" aria-expanded="true" ref={cardHead} onClick={() => toggle(which)}>
        <span className="s7-glyph">
          <ExtIcon name={icon} size={20} />
        </span>
        <span>
          <span className="noc-body">{title}</span>
          <span className="noc-caption app-dim">{caption}</span>
        </span>
      </button>
      {picker}
      <p className="noc-caption app-dim">{note}</p>
    </div>
  );
  const taskRow = (t: SecurityTask) =>
    t === 'passkey' ? (
      <LockedButtonTask key={t} icon="fingerprint" label={SECURITY_TEXT.taskPasskey} onPress={onPasskey} />
    ) : t === 'write' ? (
      <LockedButtonTask key={t} icon="database" label={SECURITY_TEXT.taskWrite} onPress={() => openPage('unlock.html?mode=reveal')} />
    ) : (
      <LockedButtonTask key={t} icon="shield-check" label={SECURITY_TEXT.taskVerify} onPress={() => openPage('unlock.html?mode=verify')} />
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
            <div className="s7-list">{tasks.map(taskRow)}</div>
          </>
        ) : (
          <>
            <p className="noc-overline app-dim app-overline">{SECURITY_TEXT.protections}</p>
            <div className="s7-list app-protections">
              {row('lock', SECURITY_TEXT.autoLock, SECURITY_TEXT.minutes(settings.autoLockMinutes), 'success', () => toggle('auto-lock'), open === 'auto-lock')}
              {passkeyRow(SECURITY_TEXT.on, 'success')}
              {pageRow('shield', SECURITY_TEXT.verified, 'unlock.html?mode=verify', SECURITY_TEXT.yes, 'success')}
            </div>
          </>
        )}

        <p className="noc-overline app-dim app-overline app-overline-next">{SECURITY_TEXT.locks}</p>
        <div className="s7-list">
          {open === 'auto-lock'
            ? pickerCard(
                'auto-lock',
                'lock',
                SECURITY_TEXT.autoLock,
                SECURITY_TEXT.autoLockCaption,
                <Picker label={SECURITY_TEXT.autoLock} options={AUTOLOCK_OPTIONS} value={settings.autoLockMinutes} onPick={v => pick('autoLockMinutes', v)} />,
                SECURITY_TEXT.autoLockNote,
              )
            : row('lock', SECURITY_TEXT.autoLock, SECURITY_TEXT.minutes(settings.autoLockMinutes), null, () => toggle('auto-lock'), false, b => void (rows.current['auto-lock'] = b))}
          <div className="s7-row app-static app-no-chev">
            <span className="s7-glyph">
              <ExtIcon name="zap" size={20} />
            </span>
            <span className="s7-title">{SECURITY_TEXT.appLock}</span>
          </div>
          {open === 'threshold'
            ? pickerCard(
                'threshold',
                'alert',
                SECURITY_TEXT.threshold,
                SECURITY_TEXT.thresholdCaption,
                <Picker label={SECURITY_TEXT.threshold} options={THRESHOLD_OPTIONS} value={settings.reauthUsdCents} onPick={v => pick('reauthUsdCents', v)} />,
                SECURITY_TEXT.thresholdNote,
              )
            : row('alert', SECURITY_TEXT.threshold, dollars(settings.reauthUsdCents), null, () => toggle('threshold'), false, b => void (rows.current.threshold = b))}
          {passkeyRow(passkey ? SECURITY_TEXT.on : SECURITY_TEXT.off, passkey ? 'success' : 'warning')}
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

/** Which inline picker card is open (35c): at most one. */
type Card = 'auto-lock' | 'threshold' | null;

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
