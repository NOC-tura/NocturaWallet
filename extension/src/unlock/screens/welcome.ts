import type {PageDeps} from '../page';
import {storedVault} from '../stored';
import {COMMON, WELCOME} from '../strings';
import {byId, setText, showScreen, shown} from '../view/dom';

/**
 * #1 welcome (spec §3.1): create or import. What is stored decides first — the page never offers to
 * set up over a wallet (the engine would refuse the write anyway):
 *  - nothing stored → the CTAs;
 *  - a wallet → `exists`: "A wallet already exists in this browser. Nothing was changed." + "Open the
 *    Noctura icon to use it." — no CTAs;
 *  - a damaged vault (null included: the background calls it stored-invalid) → the damaged line and
 *    what still holds, no CTAs; repairing it is #37's (B1b-2b).
 */
export function mountWelcome(deps: PageDeps, next: {create(): void; import(): void}): {show(): Promise<void>} {
  byId('wel-create').addEventListener('click', next.create);
  byId('wel-import').addEventListener('click', next.import);
  const notice = (line: string, help: string) => {
    setText(byId('wel-notice-line'), line);
    setText(byId('wel-notice-help'), help);
    shown(byId('wel-notice'), true);
  };
  return {
    async show() {
      showScreen('v-welcome');
      shown(byId('wel-actions'), false);
      shown(byId('wel-notice'), false);
      let raw: unknown;
      try {
        raw = await deps.store.readEnvelope();
      } catch {
        notice(COMMON.unreadable, '');
        return;
      }
      const stored = storedVault(raw);
      if (stored.kind === 'none') shown(byId('wel-actions'), true);
      else if (stored.kind === 'wallet') notice(COMMON.exists, WELCOME.useIt);
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
