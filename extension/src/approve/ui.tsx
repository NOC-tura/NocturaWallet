import {useEffect, useState, type ReactNode} from 'react';
import {ExtIcon} from '../app/ui/ExtIcon';
import {LockedButton} from '../app/ui/LockedButton';
import {Sheet} from '../app/ui/Sheet';
import type {Site} from './client';
import {WINDOW_TEXT} from './strings';
import {useArmed} from './useArmed';

/**
 * The approval window's shared pieces (spec §3.1, §3.2, §4.3): the top bar (✕ = Reject), the origin card, the lookalike
 * banner, a confirming CTA (C15), the 2-second confirm, and the queue's two lines (Q12, Q24). All on the design's own
 * classes (#46, #47: `.s9-origin-card`, `.s9-domain-warn`, `.top-bar`, `.sticky-bar`).
 */

/** The top bar: ✕ is Reject (C4); its overline names the state, coloured by tier (`--fg-tertiary` → `--warning` → `--danger`). */
export function WindowTop({overline, tone, onClose, disabled}: {overline: string; tone: 'neutral' | 'warning' | 'danger'; onClose: () => void; disabled: boolean}) {
  return (
    <div className="top-bar">
      <LockedButton className="icon-btn" label={WINDOW_TEXT.close} onPress={onClose} disabled={disabled}>
        <ExtIcon name="close" size={22} />
      </LockedButton>
      <span className={tone === 'danger' ? 'title noc-overline noc-danger' : tone === 'warning' ? 'title noc-overline noc-warning' : 'title noc-overline app-dim'}>{overline}</span>
      <span />
    </div>
  );
}

/**
 * What the origin card shows (§2.5 Display, review 1 L5, R35): the host, with the port when the origin has an explicit
 * one — `https://dapp.test` and `https://dapp.test:8443` are two grants (C8) and must not look alike.
 */
export function siteLabel(origin: string, host: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return host;
  }
}

/** The name's first character (C6: no favicon — the domain's initial; "?" for an unknown origin, as 47b draws it). */
const initial = (name: string): string => (Array.from(name)[0] ?? '?').toUpperCase();

/**
 * The origin card (§2.5 Display, C7): the name the background chose (the list's for a verified host, else the host's
 * second-level label — never the imitated brand's), and the host exactly as the browser reports it, in mono.
 */
export function OriginCard({site, origin, host}: {site: Site; origin: string; host: string}) {
  return (
    <div className={site.kind === 'verified' ? 's9-origin-card' : site.kind === 'unknown' ? 's9-origin-card app-origin-unknown' : 's9-origin-card app-origin-lookalike'}>
      <div className={site.kind === 'verified' ? 'ico app-ico-verified' : site.kind === 'unknown' ? 'ico app-ico-unknown' : 'ico app-ico-lookalike'} aria-hidden="true">
        {site.kind === 'unknown' ? '?' : initial(site.name)}
      </div>
      <div className="app-origin-text">
        <div className="name">{site.name}</div>
        <div className="dom">{siteLabel(origin, host)}</div>
      </div>
      <div className={site.kind === 'verified' ? 'badge verified' : site.kind === 'unknown' ? 'badge unknown' : 'badge danger'}>
        <ExtIcon name={site.kind === 'verified' ? 'shield-check' : 'alert-triangle'} size={12} />
        {site.kind === 'verified' ? WINDOW_TEXT.badge.verified : site.kind === 'unknown' ? WINDOW_TEXT.badge.unknown : WINDOW_TEXT.badge.lookalike}
      </div>
    </div>
  );
}

/**
 * The lookalike banner (§3.1): "This domain is not <listed domain>", then rule a's sentence — the character, its script
 * and code point, the Latin one it imitates, and the Punycode form — or Q05 for rules b–d. The decoded Unicode appears
 * here only (§2.5 Display: the background stripped every format character from it).
 */
export function LookalikeBanner({site, host}: {site: Site; host: string}) {
  const idn = site.rule === 'idn' ? site.idn : null;
  return (
    <div className="s9-domain-warn" role="alert">
      <ExtIcon name="alert-triangle" size={20} />
      <div className="body">
        <b>{WINDOW_TEXT.notThis(site.imitates ?? '')}</b>
        <br />
        {idn !== null ? (
          <>
            {WINDOW_TEXT.idnLead}
            <code>{idn.char}</code>
            {WINDOW_TEXT.idnIs(idn.script, idn.codePoint)}
            {idn.latin}
            {WINDOW_TEXT.idnNot(idn.latinCodePoint)}
            <code className="noc-danger">{host}</code>.
          </>
        ) : (
          WINDOW_TEXT.looksLike(site.imitates ?? '')
        )}
      </div>
    </div>
  );
}

/**
 * A confirming CTA (C15, rule 6): a LockedButton held until `armed`, and neither Enter nor Space ever confirms — the
 * key's default action (a click, on either key for a `<button>`) is prevented while focus is on it (fix round 1, M3:
 * Space was left open). Reject does not use this: it is never held. Task 9's controller ruling (b): a button's Space activation
 * fires its click on keyup, not keydown — the HTML spec's activation behaviour, in every engine, not only Gecko — so
 * Space is refused on keyup too; Enter's click fires on keydown in every engine.
 */
export function ConfirmButton({armed, onPress, className, children}: {armed: boolean; onPress: () => Promise<unknown> | void; className: string; children: ReactNode}) {
  return (
    <span
      className="app-confirm-wrap"
      onKeyDownCapture={e => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') e.preventDefault();
      }}
      onKeyUpCapture={e => {
        if (e.key === ' ' || e.key === 'Spacebar') e.preventDefault();
      }}
    >
      <LockedButton className={className} disabled={!armed} onPress={onPress}>
        {children}
      </LockedButton>
    </span>
  );
}

/** The design's 2-second confirm (#46 E; §3.1, §3.2 step 5): only "I understand the risk" proceeds, enabled after 2 s. */
export const CONFIRM_DELAY_MS = 2_000;
export function RiskConfirm({onCancel, onProceed, delay = CONFIRM_DELAY_MS}: {onCancel: () => void; onProceed: () => Promise<unknown> | void; delay?: number}) {
  const [ready, setReady] = useState(false);
  // C15 inside the sheet too (review 1 L4): held 500 ms again whenever the window regains focus.
  const armed = useArmed('risk-confirm');
  useEffect(() => {
    const t = setTimeout(() => setReady(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <Sheet title={WINDOW_TEXT.confirmTitle} onClose={onCancel} focusControl={false}>
      {/* Fix round 1, C1: not `.sticky-bar row` — `.s8-sheet .row` (the generic 3-column list row, ix:18845) and
          `.sticky-bar` (its own --bg-base band + border-top) both have the same two-class specificity as
          `.sticky-bar.row` itself and land later in the sheet, so inside a sheet they silently win: the row
          became a 3-column grid and a darker band. `.app-risk-actions` is its own rule, matching the design's
          `.sticky-bar.row .btn` layout (ix:17669: two equal flex:1 buttons) without colliding with either. */}
      <div className="app-risk-actions">
        <LockedButton className="btn btn-secondary" onPress={onCancel}>
          {WINDOW_TEXT.cancel}
        </LockedButton>
        <ConfirmButton armed={ready && armed} className="btn btn-destructive" onPress={onProceed}>
          {WINDOW_TEXT.understand}
        </ConfirmButton>
      </div>
    </Sheet>
  );
}

/** Q24, once, above the request; Q12 above the sticky bar while more wait. */
export function BudgetNotice() {
  return (
    <div className="banner warning app-approve-notice" role="status">
      <ExtIcon name="alert-triangle" size={18} />
      <span className="banner-line">{WINDOW_TEXT.budgetNotice}</span>
    </div>
  );
}
export function Waiting({n}: {n: number}) {
  return n > 0 ? <p className="noc-caption app-dim app-approve-waiting">{WINDOW_TEXT.waiting(n)}</p> : null;
}

/** C14's third request: [Block this site] (Q17) above the sticky bar. */
export function BlockSite({onBlock}: {onBlock: () => Promise<unknown>}) {
  return (
    <div className="app-approve-block">
      <LockedButton className="btn btn-tertiary noc-danger" onPress={onBlock}>
        {WINDOW_TEXT.blockSite}
      </LockedButton>
    </div>
  );
}

/** The ring spinner of the design's in-progress state (#46 "signing-in-progress"). */
export const Spinner = () => <span className="app-ring-spinner" aria-hidden="true" />;
