import {exclusive, type PageDeps} from '../page';
import {storedVault} from '../stored';
import {COMMON, WELCOME} from '../strings';
import {byId, setText, showScreen, shown} from '../view/dom';

/**
 * #1 welcome (spec §3.1): create or import. What is stored decides first — the page never offers to
 * set up over a wallet (the engine would refuse the write anyway):
 *  - nothing stored → the terms line and the CTAs;
 *  - a wallet → `exists`: "A wallet already exists in this browser. Nothing was changed." + "Open the
 *    Noctura icon to use it." — no CTAs;
 *  - a damaged vault (null included: the background calls it stored-invalid) → the damaged line and
 *    what still holds, no CTAs; repairing it is #37's (B1b-2b);
 *  - unreadable (the store itself throws) → COMMON.unreadable, no help line, no CTAs.
 *
 * Fix round 1 item 1 (spec §7.6, rule 6): Create and Import run through the page's one `exclusive()`
 * gate — a second click on either inside the 500 ms floor does nothing, same as every other button on
 * this page. Task 8's callers (`next.create`/`next.import`) need no gate of their own.
 */
export function mountWelcome(deps: PageDeps, next: {create(): void; import(): void}): {show(): Promise<void>} {
  const createBtn = byId<HTMLButtonElement>('wel-create');
  const importBtn = byId<HTMLButtonElement>('wel-import');
  // Fix round 1 item 3: whether the CTAs are offered this show() at all — a hidden parent stops a
  // real pointer click, but nothing stopped a bound listener from still running one; `offered` is the
  // real guard a test (and a stray event) can't bypass, independent of `hidden`/`disabled`.
  let offered = false;
  const render = () => {
    const disabled = !offered || deps.gate.isBusy();
    createBtn.disabled = disabled;
    importBtn.disabled = disabled;
  };
  // Scope 15: show() may run while another screen's action holds the page gate (#3's Cancel → #2 → back
  // inside #3's 500 ms floor); the gate's release then re-renders the CTAs.
  deps.gate.onIdle(render);
  createBtn.addEventListener('click', () => {
    if (offered) void exclusive(deps, render, async () => next.create());
  });
  importBtn.addEventListener('click', () => {
    if (offered) void exclusive(deps, render, async () => next.import());
  });
  // Fix round 1 item 4: an empty help line is hidden, not rendered empty — an empty <p> still takes a
  // line's worth of height even after the margin/padding reset (item 2), which would leave a gap the
  // design never draws (the unreadable state has no help line at all).
  const notice = (line: string, help: string) => {
    setText(byId('wel-notice-line'), line);
    const helpEl = byId('wel-notice-help');
    setText(helpEl, help);
    shown(helpEl, help !== '');
    shown(byId('wel-notice'), true);
  };
  const showCtas = (on: boolean) => {
    shown(byId('wel-terms'), on);
    shown(byId('wel-actions'), on);
  };
  return {
    async show() {
      showScreen('v-welcome');
      offered = false;
      showCtas(false);
      shown(byId('wel-notice'), false);
      render();
      let raw: unknown;
      try {
        raw = await deps.store.readEnvelope();
      } catch {
        notice(COMMON.unreadable, '');
        return;
      }
      const stored = storedVault(raw);
      if (stored.kind === 'none') {
        offered = true;
        showCtas(true);
        render();
      } else if (stored.kind === 'wallet') notice(COMMON.exists, WELCOME.useIt);
      else notice(COMMON.damaged, COMMON.damagedHelp);
    },
  };
}

/** #2 security-intro (spec §3.2): three layers; Continue → #3, back → #1. Static copy only. */
export function mountIntro(next: {back(): void; continue(): void}): {show(): void} {
  byId('int-back').addEventListener('click', next.back);
  byId('int-continue').addEventListener('click', next.continue);
  return {show: () => showScreen('v-intro')};
}
