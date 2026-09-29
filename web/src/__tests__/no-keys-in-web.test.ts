import {execFileSync} from 'node:child_process';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, join, relative, resolve, sep} from 'node:path';

// vitest runs with web/ as the working directory.
const WEB = process.cwd();
const CORE_KEYS = resolve(WEB, '../core/keys');
const SELF = resolve(WEB, 'src/__tests__/no-keys-in-web.test.ts');

it('no web source imports core/keys', () => {
  let out = '';
  try {
    out = execFileSync('grep', ['-rln', 'core/keys', 'src'], {encoding: 'utf8'});
  } catch {
    out = ''; // grep exits 1 when nothing matches — the passing case
  }
  expect(out.split('\n').filter(l => l && !l.endsWith('no-keys-in-web.test.ts'))).toEqual([]);
});

// The grep above only sees web/src, and only the literal "core/keys". web also compiles and
// bundles core/ directories (tsconfig include), where the same import is spelled relatively
// ('../keys/transparent') — so every included root is walked and every module reference is
// resolved against its file.
const SPECIFIERS = [
  /\b(?:import|export)\s+(?:type\s+)?[^'"`;]*?\bfrom\s*(['"`])([^'"`]+)\1/g,
  /\bimport\s*(['"`])([^'"`]+)\1/g,
  /\bimport\s*\(\s*(['"`])([^'"`$]+)/g,
  /\brequire\s*\(\s*(['"`])([^'"`$]+)/g,
];

/** The module references in `text` (a file at `file`) that land in core/keys. */
function keyImports(file: string, text: string): string[] {
  const hits: string[] = [];
  for (const re of SPECIFIERS) {
    for (const m of text.matchAll(re)) {
      const spec = m[2] ?? '';
      const target = spec.startsWith('.') ? resolve(dirname(file), spec) : null;
      const inKeys = target !== null ? target === CORE_KEYS || target.startsWith(CORE_KEYS + sep) : /(^|[/@])core\/keys(\/|$)/.test(spec);
      if (inKeys) hits.push(spec);
    }
  }
  return hits;
}

function walk(p: string, out: string[]): void {
  if (statSync(p).isFile()) {
    if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(p)) out.push(p);
    return;
  }
  for (const e of readdirSync(p)) {
    if (e === 'node_modules' || e === 'dist' || e.startsWith('.')) continue;
    walk(join(p, e), out);
  }
}

const tsInclude = (JSON.parse(readFileSync(join(WEB, 'tsconfig.json'), 'utf8')) as {include: string[]}).include;

describe('no core/keys anywhere web compiles', () => {
  it('finds a relative core/keys import from inside core/ (positive control)', () => {
    const f = resolve(WEB, '../core/solana/x.ts');
    expect(keyImports(f, "import {deriveKeypair} from '../keys/transparent';")).toEqual(['../keys/transparent']);
    expect(keyImports(f, "export * from '../keys';")).toEqual(['../keys']);
    expect(keyImports(f, "const k = await import('../keys/transparent');")).toEqual(['../keys/transparent']);
    expect(keyImports(resolve(WEB, 'src/a.ts'), "import {x} from '../../core/keys/transparent';")).toEqual(['../../core/keys/transparent']);
    expect(keyImports(resolve(WEB, 'src/a.ts'), "import {x} from '@noctura/core/keys';")).toEqual(['@noctura/core/keys']);
  });

  it('does not mistake a sibling that merely starts with "keys" (negative control)', () => {
    const f = resolve(WEB, '../core/solana/x.ts');
    expect(keyImports(f, "import {x} from '../keystore/a';")).toEqual([]);
    expect(keyImports(f, "import {x} from './keys';")).toEqual([]);
  });

  it('covers every core directory the web tests run (vite.config test.include ⊆ tsconfig include)', () => {
    const vite = readFileSync(join(WEB, 'vite.config.ts'), 'utf8');
    const brace = /'\.\.\/core\/\{([^}]+)\}\/\*\*/.exec(vite);
    expect(brace).not.toBeNull();
    for (const dir of (brace?.[1] ?? '').split(',')) expect(tsInclude).toContain(`../core/${dir.trim()}`);
  });

  it('no file under any tsconfig include root imports core/keys', () => {
    const roots = tsInclude.map(r => resolve(WEB, r));
    expect(roots.filter(r => r.startsWith(resolve(WEB, '../core'))).length).toBeGreaterThan(0);
    expect(roots).not.toContain(CORE_KEYS);
    const files: string[] = [];
    for (const r of roots) walk(r, files);
    const bad = files
      .filter(f => f !== SELF)
      .flatMap(f => keyImports(f, readFileSync(f, 'utf8')).map(spec => `${relative(WEB, f)}: ${spec}`));
    expect(bad).toEqual([]);
  });
});
