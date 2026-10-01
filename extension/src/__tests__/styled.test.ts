// @vitest-environment happy-dom
import {UI_SHEETS, VAULT_PAGE_SHEETS, selectorsOf, unstyledClasses} from './styled';

describe('ancestor-aware class coverage (plan-1 lesson: the class gate ignores ancestor context)', () => {
  const sels = ['.s8-success-hero .ring', '.banner', '.banner.info svg', '.btn:hover', '.copy-btn::before'];
  const html = (markup: string) => {
    const root = document.createElement('div');
    root.innerHTML = markup;
    return root;
  };

  it('a class styled only under an ancestor passes inside it and fails outside it', () => {
    expect(unstyledClasses(html('<div class="s8-success-hero"><div class="ring"></div></div>').firstElementChild!, ['.s8-success-hero', ...sels])).toEqual([]);
    expect(unstyledClasses(html('<div class="s-success"><div class="ring"></div></div>').firstElementChild!, ['.s-success', ...sels])).toEqual(['div.ring: .ring matches no rule in place']);
    // A second, styled class on the same element does not style the first (review I3): the rule must NAME
    // the class it is counted for.
    expect(unstyledClasses(html('<div class="s-success"><div class="ring banner"></div></div>').firstElementChild!, ['.s-success', ...sels])).toEqual([
      'div.ring.banner: .ring matches no rule in place',
    ]);
  });

  it('a scope class counts when a rule it scopes matches inside it — and not when nothing inside matches', () => {
    expect(unstyledClasses(html('<section class="s8-success-hero"><i class="ring"></i></section>').firstElementChild!, sels)).toEqual([]);
    expect(unstyledClasses(html('<section class="s8-success-hero"><i></i></section>').firstElementChild!, sels)).toEqual(['section.s8-success-hero: .s8-success-hero matches no rule in place']);
  });

  it('sibling combinators match as written (".ring + .timer")', () => {
    const root = html('<div class="cooldown-card"><div class="ring"></div><div class="timer"></div></div>').firstElementChild!;
    expect(unstyledClasses(root, ['.cooldown-card', '.cooldown-card .ring', '.cooldown-card .ring + .timer'])).toEqual([]);
    const apart = html('<div class="cooldown-card"><div class="ring"></div><i></i><div class="timer"></div></div>').firstElementChild!;
    expect(unstyledClasses(apart, ['.cooldown-card', '.cooldown-card .ring', '.cooldown-card .ring + .timer'])).toEqual(['div.timer: .timer matches no rule in place']);
  });

  it('pseudo-classes and pseudo-elements count as styling the element', () => {
    expect(unstyledClasses(html('<button class="btn"></button>').firstElementChild!, sels)).toEqual([]);
    expect(unstyledClasses(html('<i class="copy-btn"></i>').firstElementChild!, sels)).toEqual([]);
  });

  it('reads the real stylesheets: the design classes the vault page and the UI rely on are there', () => {
    const vault = selectorsOf(VAULT_PAGE_SHEETS);
    expect(vault).toEqual(expect.arrayContaining(['.s-seed .seed-grid .word', '.cooldown-card .ring', '.vlt-col']));
    const ui = selectorsOf(UI_SHEETS);
    expect(ui).toEqual(expect.arrayContaining(['.s8-success-hero .ring', '.s-success .addr-card']));
    expect(vault.some(s => s.startsWith('@') || s === 'from')).toBe(false);
  });
});
