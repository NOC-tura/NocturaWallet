import {createWrongBackoff} from '../orchestrate';
import {exclusive, type PageDeps} from '../page';
import {runReveal} from '../revealFlow';
import {COMMON, REVEAL} from '../strings';
import {byId, h, setText, showScreen} from '../view/dom';

export interface RevealScreen {
  show(): void;
  /**
   * What the screen still references: the phrase (its words in the list — the module keeps no other copy)
   * and a typed password (the field, or one taken at the click and not yet handed to the proof).
   */
  holds(): {phrase: boolean; password: boolean};
}

/**
 * The B1b-1 reveal form (spec §1.2 `reveal`), restyled with the tokens only — B1b-2b builds the
 * designed screen. The phrase is shown after a proof (runReveal: re-authentication, the data key zeroed
 * at once, a passkey's PRF output zeroed on every path), as text, one list item per word. It leaves the
 * DOM — never only CSS-hidden — on [Hide], when the tab is hidden, on `pagehide` and when the screen is
 * left (anything that hides #v-reveal): it comes back only with a new proof. A proof that settles after
 * one of those renders nothing (`gen`), so a phrase never lands in a hidden tab.
 *
 * The password leaves the field at the click and is handed to the proof in the same turn; a hidden tab
 * or `pagehide` empties the field (§3.5). Rule 6: the page's one `exclusive()` gate.
 */
export function mountReveal(deps: PageDeps): RevealScreen {
  const section = byId('v-reveal');
  const field = byId<HTMLInputElement>('rev-password');
  const showBtn = byId<HTMLButtonElement>('rev-show');
  const list = byId('rev-words');
  const backoff = createWrongBackoff(deps.sleep);
  const say = (text: string) => setText(byId('rev-helper'), text);
  /** The typed password between the click and the proof taking it (the same turn). */
  let typed: string | null = null;
  /** Bumped whenever the phrase is dropped: a proof started before it shows nothing. */
  let gen = 0;
  const drop = () => {
    gen += 1;
    list.replaceChildren();
    field.value = '';
    say('');
  };
  const render = () => {
    showBtn.disabled = deps.gate.isBusy();
    field.disabled = deps.gate.isBusy();
  };
  const reveal = () =>
    void exclusive(deps, render, async () => {
      typed = field.value;
      field.value = '';
      list.replaceChildren();
      say(REVEAL.checking);
      const mine = gen;
      const outcome = await backoff.run(async () => {
        const password = typed ?? '';
        typed = null;
        const r = await runReveal({readEnvelope: deps.store.readEnvelope, send: deps.send}, {password, kdf: deps.kdf});
        if (r.outcome === 'shown' && mine === gen) list.replaceChildren(...r.words.map(w => h('li', '', w)));
        return r.outcome;
      }, () => say(COMMON.waitConfirm));
      // Dropped while the proof ran: the phrase was never put in the DOM, and the helper says nothing of it.
      say(outcome === 'shown' && mine !== gen ? '' : REVEAL.outcome[outcome]);
    });
  deps.gate.onIdle(render);
  showBtn.addEventListener('click', reveal);
  byId('rev-form').addEventListener('submit', e => {
    e.preventDefault();
    reveal();
  });
  byId('rev-hide').addEventListener('click', drop);
  // Leaving the page (closing the tab, navigating, the back/forward cache) or hiding it (another tab, a
  // minimised window) drops the words and the typed password.
  deps.onLeave(drop);
  // Leaving the screen: whatever hides #v-reveal (showScreen of another screen) drops the words too.
  new MutationObserver(() => {
    if (section.hidden) drop();
  }).observe(section, {attributes: true, attributeFilter: ['hidden']});
  return {
    show() {
      showScreen('v-reveal');
      render();
      field.focus();
    },
    holds: () => ({phrase: list.childElementCount > 0, password: typed !== null || field.value !== ''}),
  };
}
