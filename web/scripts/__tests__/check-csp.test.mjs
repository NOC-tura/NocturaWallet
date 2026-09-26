import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {checkHtml, checkJs, countStyleInjections, auditRuntimeStyleInjection} from '../check-csp.mjs';

const MARKER = 'mobile-wallet-adapter-embedded-modal-styles';
const REAL = [{marker: MARKER, count: 2, why: 'the real entry, used to test the real numbers'}];

// The default JS mirrors the shape our real bundle has since the mobile adapter left:
// no runtime style injection at all, and therefore an empty allowlist to satisfy.
const REALISTIC_JS = 'const a=1;el.style.color="red";';

/** A build directory holding one HTML and one JS file, so the run is never inconclusive. */
function buildDir({html = '<html><body><div id="root"></div></body></html>', js = REALISTIC_JS} = {}) {
  const d = mkdtempSync(join(tmpdir(), 'csp-'));
  mkdirSync(join(d, 'assets'));
  writeFileSync(join(d, 'index.html'), html);
  writeFileSync(join(d, 'assets', 'index.js'), js);
  return d;
}

function run(...dirs) {
  try {
    execFileSync(process.execPath, ['scripts/check-csp.mjs', ...dirs], {stdio: 'pipe'});
    return 0;
  } catch (e) {
    return e.status ?? -1;
  }
}

describe('HTML', () => {
  it('accepts the shape Vite actually emits (positive control — the gate can say yes)', () => {
    const emitted =
      '<!doctype html><html><head><script type="module" crossorigin src="/assets/index-x.js"></script>' +
      '<link rel="stylesheet" href="/assets/index-x.css"></head><body><div id="root"></div></body></html>';
    expect(checkHtml(emitted)).toEqual([]);
  });

  it.each([
    ['inline script', '<script>window.x=1</script>'],
    ['style element', '<style>body{color:red}</style>'],
    ['style attribute', '<div style="color:red"></div>'],
  ])('rejects %s', (_label, snippet) => {
    expect(checkHtml(`<html><body>${snippet}</body></html>`).length).toBe(1);
  });

  it('does not mistake an empty script tag pair for inline code', () => {
    // Vite emits <script src=…></script>; the closing tag is not inline content.
    expect(checkHtml('<script type="module" src="/a.js"></script>')).toEqual([]);
  });
});

describe('JavaScript', () => {
  it('accepts a bundle with neither construct (positive control)', () => {
    expect(checkJs('export const x = 1; el.style.color = "red";')).toEqual([]);
  });

  it.each([
    ['eval', 'const r = eval(src);'],
    ['new Function', 'const f = new Function("return 1");'],
  ])('rejects %s', (_label, source) => {
    expect(checkJs(source).length).toBe(1);
  });

  it.each([
    ['a method named safeEval', 'obj.safeEval(x);'],
    ['a property access', 'ctx.eval(x);'],
    ['an identifier ending in eval', 'const myeval = 1; myeval(x);'],
  ])('does not fire on %s (negative control — the eval rule is not a substring match)', (_l, source) => {
    expect(checkJs(source)).toEqual([]);
  });

  it.each([
    ['double quotes', 'document.createElement("style")'],
    ['single quotes', "document.createElement('style')"],
    ['backticks, as the minifier emits', 'document.createElement(`style`)'],
  ])('counts createElement with %s', (_label, source) => {
    expect(countStyleInjections(source)).toBe(1);
  });

  it('does not count createElement for other tags', () => {
    expect(countStyleInjections('document.createElement("div");document.createElement(`link`)')).toBe(0);
  });
});

describe('runtime style allowlist', () => {
  it('accepts exactly the count that was written down (positive control)', () => {
    const src = `${MARKER};createElement("style");createElement("style")`;
    expect(auditRuntimeStyleInjection([src], REAL)).toEqual([]);
  });

  it('rejects one more injection than the entry accounts for', () => {
    const src = `${MARKER};createElement("style");createElement("style");createElement("style")`;
    const [complaint] = auditRuntimeStyleInjection([src], REAL);
    expect(complaint).toMatch(/3 runtime style injections, 2 explained/);
  });

  it('rejects an injection from a library the allowlist never mentioned', () => {
    // The whole reason the entry carries a count: this file contains the allowlisted
    // marker, so marker-presence alone would have excused the new one.
    const src = `${MARKER};createElement("style");createElement("style");someOtherLib.createElement('style')`;
    expect(auditRuntimeStyleInjection([src], REAL).length).toBe(1);
  });

  it('rejects an entry whose marker has vanished from the build', () => {
    const [complaint] = auditRuntimeStyleInjection(['const a = 1;'], REAL);
    expect(complaint).toMatch(/no longer in the build/);
  });

  it('rejects a stale entry claiming more than the build does', () => {
    const [complaint] = auditRuntimeStyleInjection([`${MARKER};createElement("style")`], REAL);
    expect(complaint).toMatch(/allowlist claims 2/);
  });
});

describe('the gate as a process', () => {
  it('exits 0 on a build shaped like ours', () => {
    expect(run(buildDir())).toBe(0);
  });

  it('exits 1 on an inline script', () => {
    expect(run(buildDir({html: '<html><body><script>x=1</script></body></html>'}))).toBe(1);
  });

  it('exits 1 on eval in a bundle', () => {
    expect(run(buildDir({js: `${REALISTIC_JS} const r = eval(s);`}))).toBe(1);
  });

  it('exits 1 on a runtime style injection nobody wrote down', () => {
    // With the allowlist empty this is the live case: any dependency that starts
    // building a <style> element fails the build instead of failing on a phone.
    expect(run(buildDir({js: 'document.createElement("style");'}))).toBe(1);
  });

  it('exits 2 — not 0 — when there is nothing to inspect', () => {
    // The failure this prevents: a path typo, or a gate wired before the build step,
    // reporting success because it read no files at all.
    const d = mkdtempSync(join(tmpdir(), 'csp-empty-'));
    expect(run(d)).toBe(2);
  });

  it('exits 2 when the directory does not exist', () => {
    expect(run(join(tmpdir(), 'csp-absent-dir-that-was-never-built'))).toBe(2);
  });
});
