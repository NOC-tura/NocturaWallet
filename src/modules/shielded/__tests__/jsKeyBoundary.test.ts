/**
 * The JS side of the key boundary (spec 2026-11-08 shielded A0 M1 §14 "Boundary", the JS source
 * test — tagged M1b; Fable review R1-I3 with its R2 amendments N3 / N4).
 *
 * The A0 keys (sk, nk, ivk, d_self, addrField) are derived from the seed inside the Rust core and
 * never leave it (spec §3, INV-NK). After M1b no JS module derives BLS12-381 key material at all:
 * the one permitted importer of `deriveSeedTree`, `keyDerivation/shielded.ts`, is deleted with the
 * v1 view key (Task 6), so the rule is now "no JS module imports `deriveSeedTree`" (spec rev 3.3).
 *
 * Scope: every JS/TS file under `src/`, `core/`, `extension/src/` and `web/src/` — NOT `scripts/`
 * (I-6: M1a's offline vector generator calls `micro-key-producer/bls.js` there on purpose, to
 * produce the vectors the Rust core is checked against).
 *
 * Refused:
 *  1. a module SPECIFIER naming `bls.js` (any `…/bls` or `…/bls.js`, e.g. `micro-key-producer/bls.js`)
 *     or the removed module `keyDerivation/shielded` — in `import … from`, `export … from`, a bare
 *     `import '…'`, `import(…)`, `require(…)` and `jest.mock / doMock / requireActual (…)`.
 *     Specifiers, not text: comments in `paths.ts` and `a0/__testing__/offlineA0.ts` NAME bls.js
 *     to say where a vector came from, which is not an import (R2 N3);
 *  2. an import (ES import list or a destructured require) of `deriveSeedTree` or
 *     `deriveShieldedViewKey`;
 *  3. the string `12381/371/1` (the spend path) anywhere outside `src/modules/keyDerivation/paths.ts`,
 *     which keeps it as a documentation constant;
 *  4. any reference to `SHIELDED_PATHS.spend` (nothing references it; the constant is documentation).
 *
 * This file excludes itself; `v1Removed.test.ts` is allowed rule 1 and 2 only (its patterns and
 * its positive controls name the removed module and function in string literals), and a test below
 * shows that allowance is still needed. Positive controls (a synthetic source importing bls.js is
 * flagged, each rule fires) and negative controls (`paths.ts`, `offlineA0.ts`, a comment naming
 * bls.js, the view path) are below.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../../..');
const SELF = path.relative(ROOT, __filename);
const PATHS_FILE = 'src/modules/keyDerivation/paths.ts';

const TREES = ['src', 'core', 'extension/src', 'web/src'];
const SKIP_DIRS = new Set(['node_modules', 'build', 'dist', 'coverage', 'fixtures']);
const JS = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

type Rule = 'a bls.js import' | 'a removed key module import' | 'a key derivation import' | 'the spend path string' | 'SHIELDED_PATHS.spend';

/** The files allowed to break one named rule, each with its reason. Nothing else is exempt. */
const ALLOWED: Record<string, Rule[]> = {
  // its FORBIDDEN patterns and its positive controls name the removed module and function in
  // string literals (`"import {x} from '../../modules/keyDerivation/shielded';"`)
  'src/modules/shielded/__tests__/v1Removed.test.ts': ['a removed key module import'],
};

/** Every module specifier a file names (import / export … from / bare import / import() / require / jest.*). */
function specifiers(text: string): string[] {
  const re =
    /(?:\bfrom\s+|\bimport\s+|\brequire\(\s*|\bjest\.(?:mock|doMock|requireActual|requireMock|unmock)\(\s*|\bimport\(\s*)['"`]([^'"`]+)['"`]/g;
  return [...text.matchAll(re)].map(m => m[1]!);
}

/** A specifier that names a `bls` / `bls.js` module (a package subpath or a local file). */
const BLS_SPEC = /(?:^|\/)bls(?:\.js)?$/;
/** The removed v1 view-key module, by any relative or alias path. */
const KEY_MODULE_SPEC = /(?:^|\/|@\/)(?:modules\/)?keyDerivation\/shielded(?:\.tsx?|\.js)?$/;

function resolvesToRemovedKeyModule(file: string, spec: string): boolean {
  if (KEY_MODULE_SPEC.test(spec)) {
    return true;
  }
  if (spec.startsWith('.')) {
    const target = path.normalize(path.join(path.dirname(file), spec)).replace(/\.(ts|tsx|js)$/, '');
    return target === 'src/modules/keyDerivation/shielded';
  }
  return false;
}

/** The key-derivation names refused as imports (ES import lists and destructured requires). */
const KEY_NAMES = ['deriveSeedTree', 'deriveShieldedViewKey'];
function importsKeyName(text: string): boolean {
  const lists = [
    ...text.matchAll(/\bimport\s+(?:type\s+)?(?:[\w$]+\s*,\s*)?\{([^}]*)\}\s*from\b/g),
    ...text.matchAll(/\bexport\s+(?:type\s+)?\{([^}]*)\}\s*from\b/g),
    ...text.matchAll(/\{([^}]*)\}\s*=\s*(?:await\s+)?(?:require|jest\.requireActual|import)\(/g),
  ].map(m => m[1]!);
  return lists.some(l => KEY_NAMES.some(n => new RegExp(`\\b${n}\\b`).test(l)));
}

const SPEND_PATH = /12381\/371\/1(?!\d)/;
const SPEND_REF = /\bSHIELDED_PATHS\s*(?:\??\.\s*spend\b|\[\s*['"`]spend['"`]\s*\])|\{[^}]*\bspend\b[^}]*\}\s*=\s*SHIELDED_PATHS\b/;

function boundaryFindings(file: string, text: string): Rule[] {
  const out: Rule[] = [];
  const specs = specifiers(text);
  if (specs.some(s => BLS_SPEC.test(s))) {
    out.push('a bls.js import');
  }
  if (specs.some(s => resolvesToRemovedKeyModule(file, s))) {
    out.push('a removed key module import');
  }
  if (importsKeyName(text)) {
    out.push('a key derivation import');
  }
  if (file !== PATHS_FILE && SPEND_PATH.test(text)) {
    out.push('the spend path string');
  }
  if (SPEND_REF.test(text)) {
    out.push('SHIELDED_PATHS.spend');
  }
  return out;
}

function walk(rel: string, out: string[]): void {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    return;
  }
  if (fs.statSync(abs).isFile()) {
    if (JS.test(rel) && rel !== SELF) {
      out.push(rel);
    }
    return;
  }
  for (const name of fs.readdirSync(abs)) {
    if (!SKIP_DIRS.has(name)) {
      walk(path.join(rel, name), out);
    }
  }
}

const files: string[] = [];
TREES.forEach(t => walk(t, files));
const read = (f: string): string => fs.readFileSync(path.join(ROOT, f), 'utf8');

describe('§14 the JS key boundary (M1b): no JS module derives BLS key material', () => {
  it('reads the four trees it claims to, and not scripts/ or itself (non-vacuous)', () => {
    expect(files.length).toBeGreaterThan(400);
    for (const tree of TREES) {
      expect(files.some(f => f.startsWith(`${tree}/`))).toBe(true);
    }
    for (const known of [
      PATHS_FILE,
      'src/modules/shielded/a0/__testing__/offlineA0.ts',
      'src/modules/zkProver/nativeProverBridge.ts',
      'src/modules/shielded/__tests__/v1Removed.test.ts',
    ]) {
      expect(files).toContain(known);
    }
    expect(files.some(f => f.startsWith('scripts/'))).toBe(false);
    expect(files).not.toContain(SELF);
  });

  it('no file breaks a rule (outside the listed allowance)', () => {
    const hits = files
      .map(f => {
        const allowed = ALLOWED[f] ?? [];
        return {f, rules: boundaryFindings(f, read(f)).filter(r => !allowed.includes(r))};
      })
      .filter(h => h.rules.length > 0);
    expect(hits).toEqual([]);
  });

  it('every allowance is still needed (a stale allowance would hide an import)', () => {
    for (const [f, rules] of Object.entries(ALLOWED)) {
      const found = boundaryFindings(f, read(f));
      for (const r of rules) {
        expect(`${f}: ${found.includes(r) ? r : 'unused'}`).toBe(`${f}: ${r}`);
      }
    }
  });
});

describe('the boundary reader can fail (positive controls) and does not over-fire (negative controls)', () => {
  it('positive: a synthetic source importing bls.js is flagged, in every import form', () => {
    const F = 'src/modules/shielded/a0/synthetic.ts';
    expect(boundaryFindings(F, "import {deriveSeedTree} from 'micro-key-producer/bls.js';")).toEqual([
      'a bls.js import',
      'a key derivation import',
    ]);
    expect(boundaryFindings(F, "import * as bls from 'micro-key-producer/bls.js';")).toEqual(['a bls.js import']);
    expect(boundaryFindings(F, "const bls = require('micro-key-producer/bls');")).toEqual(['a bls.js import']);
    expect(boundaryFindings(F, "jest.mock('micro-key-producer/bls.js', () => ({}));")).toEqual(['a bls.js import']);
    expect(boundaryFindings(F, "const m = await import('micro-key-producer/bls.js');")).toEqual(['a bls.js import']);
    expect(boundaryFindings(F, "export {deriveSeedTree} from './bls.js';")).toEqual(['a bls.js import', 'a key derivation import']);
  });

  it('positive: the removed key module, the derivation names, the spend path and SHIELDED_PATHS.spend', () => {
    expect(boundaryFindings('src/screens/onboarding/SuccessScreen.tsx', "import {x} from '../../modules/keyDerivation/shielded';")).toEqual([
      'a removed key module import',
    ]);
    expect(boundaryFindings('src/modules/keyDerivation/other.ts', "import {x} from './shielded';")).toEqual(['a removed key module import']);
    expect(boundaryFindings('src/x.ts', "jest.mock('@/modules/keyDerivation/shielded')")).toEqual(['a removed key module import']);
    expect(boundaryFindings('src/x.ts', "import {deriveShieldedViewKey} from '../keys';")).toEqual(['a key derivation import']);
    expect(boundaryFindings('src/x.ts', "const {deriveSeedTree} = require('some-bls-lib');")).toEqual(['a key derivation import']);
    expect(boundaryFindings('src/x.ts', "derive(seed, 'm/12381/371/1/0')")).toEqual(['the spend path string']);
    expect(boundaryFindings('src/x.ts', 'derive(seed, SHIELDED_PATHS.spend)')).toEqual(['SHIELDED_PATHS.spend']);
    expect(boundaryFindings('src/x.ts', "derive(seed, SHIELDED_PATHS['spend'])")).toEqual(['SHIELDED_PATHS.spend']);
    expect(boundaryFindings('src/x.ts', 'const {spend} = SHIELDED_PATHS;')).toEqual(['SHIELDED_PATHS.spend']);
  });

  it('negative: paths.ts and offlineA0.ts (comments naming bls.js, the documented spend path) are not flagged', () => {
    expect(read(PATHS_FILE)).toMatch(/bls\.js/); // it does name bls.js and the spend path …
    expect(read(PATHS_FILE)).toMatch(SPEND_PATH);
    expect(boundaryFindings(PATHS_FILE, read(PATHS_FILE))).toEqual([]); // … in comments and a constant only
    const offline = 'src/modules/shielded/a0/__testing__/offlineA0.ts';
    expect(read(offline)).toMatch(/bls\.js/);
    expect(boundaryFindings(offline, read(offline))).toEqual([]);
  });

  it('negative: a comment naming bls.js, the view path, other `bls`-named packages and the A0 names', () => {
    const F = 'src/x.ts';
    expect(boundaryFindings(F, '// written from micro-key-producer/bls.js by scripts/a0-vectors')).toEqual([]);
    expect(boundaryFindings(F, 'derive(seed, SHIELDED_PATHS.view)')).toEqual([]);
    expect(boundaryFindings(F, "const p = 'm/12381/371/10/0';")).toEqual([]);
    expect(boundaryFindings(F, "import {bls12_381} from '@noble/curves/bls12-381';")).toEqual([]);
    expect(boundaryFindings(F, "import {a0DepositRho} from '../../zkProver/nativeProverBridge';")).toEqual([]);
    expect(boundaryFindings(F, "import {deriveSecureStorageKey} from '../keychain/secureStorageKey';")).toEqual([]);
  });
});
