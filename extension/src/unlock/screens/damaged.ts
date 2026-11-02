import {exclusive, type PageDeps} from '../page';
import {COMMON} from '../strings';
import {byId, setText, showScreen, shown} from '../view/dom';
import {fillSaveLink} from '../view/saveDamaged';

export type DamagedKind = 'unreadable' | 'refused';

export interface DamagedScreen {
  /** Shows the state the page read (`raw`: the value it read, which "Save the damaged data" carries). */
  show(kind: DamagedKind, raw: unknown): void;
}

/**
 * B1e §2.2 (E9, R4): the two damaged states, shown by #9 and #1 from their own read of v1_vault (stored.ts vaultReading).
 * `unreadable` (the frozen predicate: no version of Noctura can read it): "Save the damaged data" and "Remove damaged
 * wallet" → the removal screen, which reads and judges again. `refused` (this version's policy refuses it): "update the
 * extension", "Save the damaged data", and no removal at all — the button is hidden and its listener acts only while the
 * state shown is `unreadable`.
 */
export function mountDamaged(deps: PageDeps): DamagedScreen {
  const remove = byId<HTMLButtonElement>('dmg-remove');
  let kind: DamagedKind | null = null;
  const render = () => {
    remove.disabled = kind !== 'unreadable' || deps.gate.isBusy();
  };
  deps.gate.onIdle(render);
  setText(byId('dmg-help'), COMMON.damagedHelp);
  remove.addEventListener('click', () => {
    if (kind === 'unreadable') void exclusive(deps, render, async () => deps.go('unlock.html?mode=remove-damaged'));
  });
  return {
    show(next, raw) {
      kind = next;
      fillSaveLink(byId<HTMLAnchorElement>('dmg-save'), raw);
      for (const id of ['dmg-unreadable', 'dmg-unreadable-body']) shown(byId(id), next === 'unreadable');
      for (const id of ['dmg-refused', 'dmg-refused-body']) shown(byId(id), next === 'refused');
      shown(remove, next === 'unreadable');
      render();
      showScreen('v-damaged');
    },
  };
}
