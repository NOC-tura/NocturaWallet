/**
 * B1e §4.1 (E4): the pages on noc-tura.io the extension links to — Terms and Privacy on #1 (unlock.html, as static
 * markup) and #38, Help on #38. Each opens in a new tab, `<a target="_blank" rel="noopener noreferrer">`; nothing ever
 * fetches them (connect-src admits only the coordinator; scripts/check-links.mjs pins the strings).
 */
export const NOCTURA_PAGES = {
  terms: 'https://noc-tura.io/extension/terms',
  privacy: 'https://noc-tura.io/extension/privacy',
  help: 'https://noc-tura.io/extension/help',
} as const;

/** B1e §4.2: the licence page inside the package (scripts/licences.mjs writes it), opened in a new tab. */
export const LICENCES_PAGE = 'licenses.html';
