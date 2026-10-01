import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fontViolations, vaultPageFontViolations} from '../check-fonts.mjs';

describe('the font gate', () => {
  let dir;
  const write = (rel, text) => {
    mkdirSync(join(dir, rel, '..'), {recursive: true});
    writeFileSync(join(dir, rel), text);
  };
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'fonts-'));
    write('fonts/Geist-Variable.woff2', 'x');
    write('fonts/GeistMono-Variable.woff2', 'x');
    write('assets/mount-1.css', "@font-face{src:url(/fonts/Geist-Variable.woff2) format('woff2-variations')}@font-face{src:url('/fonts/GeistMono-Variable.woff2')}");
  });
  afterEach(() => rmSync(dir, {recursive: true, force: true}));

  it('passes both files, loaded from /fonts/ or — as Vite rewrites it with base ./ — ../fonts/', () => {
    expect(fontViolations(dir)).toEqual([]);
    write('assets/mount-1.css', '@font-face{src:url(../fonts/Geist-Variable.woff2)}@font-face{src:url(../fonts/GeistMono-Variable.woff2)}');
    expect(fontViolations(dir)).toEqual([]);
  });

  it('fails a missing file, and a font loaded from anywhere else', () => {
    rmSync(join(dir, 'fonts/GeistMono-Variable.woff2'));
    write('assets/mount-1.css', '@font-face{src:url(/fonts/Geist-Variable.woff2)}@font-face{src:url(https://fonts.example/x.woff2)}');
    expect(fontViolations(dir)).toEqual([
      'fonts/GeistMono-Variable.woff2 is missing from the build',
      'assets/mount-1.css loads a font from https://fonts.example/x.woff2 — only a bundled fonts/ file is allowed',
    ]);
    write('assets/mount-1.css', '@font-face{src:url(../../fonts/Geist-Variable.woff2)}');
    expect(fontViolations(dir)).toContain('INCONCLUSIVE: no built CSS loads fonts/Geist-Variable.woff2');
  });
});

describe('the font gate: the vault page (plan 2)', () => {
  let dir;
  const write = (rel, text) => {
    mkdirSync(join(dir, rel, '..'), {recursive: true});
    writeFileSync(join(dir, rel), text);
  };
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'fonts-vault-'));
  });
  afterEach(() => rmSync(dir, {recursive: true, force: true}));

  it('passes when a stylesheet unlock.html links names fonts/Geist-Variable.woff2', () => {
    write('unlock.html', '<head><link rel="stylesheet" crossorigin href="./assets/unlock-1.css"></head>');
    write('assets/unlock-1.css', '@font-face{src:url(../fonts/Geist-Variable.woff2)}');
    expect(vaultPageFontViolations(dir)).toEqual([]);
  });

  it('fails a vault page with no stylesheet, or one that loads no Geist', () => {
    write('unlock.html', '<head></head>');
    expect(vaultPageFontViolations(dir)).toHaveLength(1);
    write('unlock.html', '<head><link rel="stylesheet" href="./assets/unlock-1.css"></head>');
    write('assets/unlock-1.css', '.x{color:red}');
    expect(vaultPageFontViolations(dir)).toEqual(['unlock.html loads no stylesheet that names fonts/Geist-Variable.woff2 — the vault page would render in a fallback font']);
    // Another bundled face is not Geist: the mono face alone still fails.
    write('assets/unlock-1.css', '@font-face{src:url(../fonts/GeistMono-Variable.woff2)}');
    expect(vaultPageFontViolations(dir)).toHaveLength(1);
  });
});
