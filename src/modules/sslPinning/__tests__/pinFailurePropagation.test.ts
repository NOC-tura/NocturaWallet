import {readFileSync, readdirSync} from 'fs';
import {join} from 'path';

/**
 * Reads the SOURCE, not the call sites.
 *
 * On 2026-08-09 the bare `catch` around `pinnedFetch` was narrowed in
 * coordinatorClient.ts so that a pin failure propagates instead of silently
 * downgrading. Measured on 2026-09-16: that fix had reached ONE of seventeen call
 * sites. The two most-used screens still swallowed the failure and fell back to a
 * third-party host, which is why a stale backup pin went unnoticed from 19 July to
 * 15 September — the alarm had nothing to report, because nothing reached it.
 *
 * A test that exercises call sites cannot find the site it does not call. This one
 * asserts a property of every file instead, and carries the two parts that make such
 * a test mean anything:
 *
 *   - the DENOMINATOR. Without it, renaming a directory yields an empty set and a
 *     green tick. "No swallowers" and "nothing was examined" are the same result.
 *   - COMMENTS STRIPPED. This very file describes the pattern it searches for, and
 *     so does the helper's doc comment. Without stripping, the scan finds its own
 *     documentation and passes on it.
 */

const SRC = join(__dirname, '..', '..', '..');
const CALL_SITES_AT_LEAST = 13;

function tsFiles(dir: string): string[] {
  return readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : tsFiles(full);
    }
    return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [full] : [];
  });
}

/** Blank out comments, preserving line count so any reported position stays usable. */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, '');
}

const callers = tsFiles(SRC)
  .filter(f => !f.includes(`${'sslPinning'}${require('path').sep}pinnedFetch.ts`))
  .filter(f => codeOnly(readFileSync(f, 'utf8')).includes('pinnedFetch('));

describe('a pin failure is never swallowed', () => {
  it('examines the whole set of pinnedFetch callers', () => {
    // The denominator. If this drops, the assertion below is passing on nothing.
    expect(callers.length).toBeGreaterThanOrEqual(CALL_SITES_AT_LEAST);
  });

  it('every caller that catches also decides about SSLPinningError', () => {
    const swallowing = callers.filter(f => {
      const src = codeOnly(readFileSync(f, 'utf8'));
      const catches = /\bcatch\s*[({]/.test(src);
      return catches && !src.includes('SSLPinningError');
    });
    // A file with no catch at all is fine: the error propagates on its own.
    expect(swallowing.map(f => f.replace(SRC, 'src'))).toEqual([]);
  });

  it('the guard the callers rely on still exists and still throws', () => {
    const helper = codeOnly(readFileSync(join(SRC, 'modules', 'sslPinning', 'pinnedFetch.ts'), 'utf8'));
    // Renaming or gutting the helper must fail here rather than quietly voiding
    // every call site that imports it.
    expect(helper).toContain('export function rethrowIfSSLPinningError');
    expect(helper).toMatch(/rethrowIfSSLPinningError[\s\S]{0,200}instanceof SSLPinningError[\s\S]{0,80}throw/);
  });
});
