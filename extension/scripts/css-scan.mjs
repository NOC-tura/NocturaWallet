// A small CSS reader for the vault page's stylesheet gates (Task 5, fix round 4). It replaces the
// patterns rounds 1–3 used, which a reviewer escaped twice: a quote inside the other quotes
// (`url("https://x/a'b")` — the pattern stopped at the inner quote and saw no url) and a comment inside a
// name (`ur/**/l(` — comments were replaced by a space, so no `url(` was seen; the minifier joins it).
//
// What it does, and only that:
// - a comment is removed to NOTHING, so a comment inside a name or an at-keyword hides nothing;
// - a string ('…' or "…") is read whole, a backslash escape inside it included, and is never read as code
//   (a comment opener or `url(` inside a string is text);
// - an unquoted `url(` body is read raw up to `)`, as CSS reads it (a comment inside it is part of the URL);
// - any backslash anywhere is reported (`escapes`): an escape can spell `url(` or `@import` (`\75rl(`), and
//   the vault page's sheets have none.
// The gates use what it returns: every url() target, every @import target, every other function that
// loads a URL without url() (image-set(), image(), cross-fade(), src()), and whether there is a backslash.
// The browser's own boundary is the extension CSP (style-src/img-src/font-src 'self'); this is the backstop.

/** Every CSS language Vite compiles into a stylesheet (its CSS plugin's list). */
export const CSS_LANGUAGE = ['css', 'pcss', 'postcss', 'scss', 'sass', 'less', 'styl', 'stylus', 'sss'];
const STYLESHEET = new RegExp(`\\.(?:${CSS_LANGUAGE.join('|')})$`, 'i');

/** Is this path (a query or hash dropped) a stylesheet in any CSS language Vite compiles? */
export function isStylesheet(path) {
  return STYLESHEET.test(path.replace(/[?#].*$/, ''));
}

// A function that loads a URL from a string, without url(). Matched on the code with comments removed.
const LOADER = /(?:^|[^\w-])((?:-webkit-|-moz-)?(?:image-set|image|cross-fade|src))\s*\(/gi;

/**
 * @param {string} text a stylesheet's source or built text
 * @returns {{imports: string[], urls: string[], loaders: string[], escapes: boolean}}
 */
export function scanCss(text) {
  const strings = [];
  // The code: the text with comments removed and every string or url() body replaced by "<index>".
  let code = '';
  const n = text.length;
  let i = 0;
  while (i < n) {
    const c = text[i];
    if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end < 0 ? n : end + 2;
      continue;
    }
    if (c === '"' || c === "'") {
      let value = '';
      let j = i + 1;
      while (j < n && text[j] !== c && text[j] !== '\n') {
        if (text[j] === '\\' && j + 1 < n) {
          value += text[j + 1];
          j += 2;
        } else {
          value += text[j];
          j += 1;
        }
      }
      strings.push(value);
      code += `"${strings.length - 1}"`;
      i = j + 1;
      continue;
    }
    if (c === '(' && /url$/i.test(code)) {
      code += '(';
      let j = i + 1;
      while (j < n && /\s/.test(text[j])) j += 1;
      if (j < n && (text[j] === '"' || text[j] === "'")) {
        i = j;
        continue;
      }
      const end = text.indexOf(')', j);
      strings.push(text.slice(j, end < 0 ? n : end).trim());
      code += `"${strings.length - 1}")`;
      i = end < 0 ? n : end + 1;
      continue;
    }
    code += c;
    i += 1;
  }
  const value = index => strings[Number(index)] ?? '';
  const urls = [...code.matchAll(/url\(\s*"(\d+)"/gi)].map(m => value(m[1]));
  // A `url(` the reader could not pair with a body (none today) still counts, as an empty target.
  const opened = (code.match(/url\(/gi) ?? []).length;
  for (let k = urls.length; k < opened; k += 1) urls.push('');
  const imports = [...code.matchAll(/@import\b\s*(?:url\(\s*)?(?:"(\d+)")?/gi)].map(m => (m[1] === undefined ? '' : value(m[1])));
  const loaders = [...code.matchAll(LOADER)].map(m => m[1].toLowerCase());
  return {imports, urls, loaders, escapes: text.includes('\\')};
}
