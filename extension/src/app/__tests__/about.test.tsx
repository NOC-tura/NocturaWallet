// @vitest-environment happy-dom
import {fireEvent, screen, within} from '@testing-library/react';
import {ABOUT_TEXT} from '../screens/About';
import {LICENCES_PAGE, NOCTURA_PAGES} from '../../shared/links';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {renderApp} from './appHarness';

// B1e §4.1, §4.4: #38's rows as drawn (index.html #38 — Legal: Terms of Service, Privacy Policy, Open-source licenses;
// Resources: Help & support, then noc-tura.io as text). Every link opens a new tab — `target="_blank"`,
// `rel="noopener noreferrer"` — and nothing in the popup fetches it.
const SELECTORS = selectorsOf(UI_SHEETS);
const openAbout = async () => {
  const w = await renderApp();
  fireEvent.click(await screen.findByRole('button', {name: 'Settings'}));
  fireEvent.click(await screen.findByText('About Noctura'));
  await screen.findByText('© 2026 Noctura');
  return w;
};
const linkRow = (title: string) => screen.getByRole('link', {name: `${title}${ABOUT_TEXT.newTab}`});

describe('#38 about: the legal and help rows (B1e §4.1)', () => {
  it('Legal then Resources, the rows in the design’s order, each a link but noc-tura.io', async () => {
    await openAbout();
    expect([...document.querySelectorAll('.app-about-body > .noc-overline')].map(o => o.textContent)).toEqual([ABOUT_TEXT.legal, ABOUT_TEXT.resources]);
    const lists = [...document.querySelectorAll('.app-about-body > .s7-list')];
    expect(lists.map(l => [...l.querySelectorAll('.s7-row')].map(r => r.firstElementChild?.nextElementSibling?.firstChild?.textContent))).toEqual([
      ['Terms of Service', 'Privacy Policy', 'Open-source licenses'],
      ['Help & support', 'noc-tura.io'],
    ]);
    expect(screen.getAllByRole('link')).toHaveLength(4);
    expect(within(lists[1] as HTMLElement).getByText('noc-tura.io').closest('a')).toBeNull();
    expect(unstyledClasses(document.querySelector('.screen') as HTMLElement, SELECTORS)).toEqual([]);
  });

  it.each([
    [ABOUT_TEXT.terms, NOCTURA_PAGES.terms, 'https://noc-tura.io/extension/terms'],
    [ABOUT_TEXT.privacy, NOCTURA_PAGES.privacy, 'https://noc-tura.io/extension/privacy'],
    [ABOUT_TEXT.help, NOCTURA_PAGES.help, 'https://noc-tura.io/extension/help'],
    [ABOUT_TEXT.licences, LICENCES_PAGE, 'licenses.html'],
  ])('%s opens %s in a new tab, noopener noreferrer', async (title, href, literal) => {
    await openAbout();
    const a = linkRow(title);
    expect(href).toBe(literal);
    expect(a.getAttribute('href')).toBe(literal);
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('the external rows carry the drawn arrow-up-right, the licences row the in-app chevron', async () => {
    await openAbout();
    const chev = (title: string) => linkRow(title).querySelector('.s7-chev polyline')?.getAttribute('points') ?? linkRow(title).querySelector('.s7-chev path')?.getAttribute('d');
    const arrow = chev(ABOUT_TEXT.terms);
    expect(chev(ABOUT_TEXT.privacy)).toBe(arrow);
    expect(chev(ABOUT_TEXT.help)).toBe(arrow);
    expect(chev(ABOUT_TEXT.licences)).toBe('9 18 15 12 9 6');
    expect(arrow).not.toBe('9 18 15 12 9 6');
  });

  it('a click is the browser’s own: the app neither handles it (not prevented, no message, no page opened) nor fetches', async () => {
    const sent: unknown[] = [];
    const w = await renderApp({spy: m => sent.push(m)});
    fireEvent.click(await screen.findByRole('button', {name: 'Settings'}));
    fireEvent.click(await screen.findByText('About Noctura'));
    await screen.findByText('© 2026 Noctura');
    const before = sent.length;
    // The browser's default action (a new tab) is what follows; happy-dom would instead fetch the href, so the test
    // records whether the app prevented it, then prevents it itself, last of all listeners.
    const seen: boolean[] = [];
    const last = (e: Event) => {
      seen.push(e.defaultPrevented);
      e.preventDefault();
    };
    window.addEventListener('click', last);
    try {
      for (const title of [ABOUT_TEXT.terms, ABOUT_TEXT.privacy, ABOUT_TEXT.licences, ABOUT_TEXT.help]) fireEvent.click(linkRow(title));
    } finally {
      window.removeEventListener('click', last);
    }
    expect(seen).toEqual([false, false, false, false]);
    expect(sent.slice(before)).toEqual([]);
    expect(w.platform.opened).toEqual([]);
  });
});
