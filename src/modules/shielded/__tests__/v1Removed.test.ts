/**
 * The v1 shielded path is gone and stays gone (spec 2026-11-08 shielded A0 M1 §12, every removal
 * tagged M1b): the NPkc… pool, its instruction builders, flows, witnesses, note schema, note
 * scanning, view session and identity, the v1 asset set and the hosted-proof client, the v1 native
 * prover (its JS call, its React method, its JNI binding, its Rust code and its examples), the
 * self-relay and transfer flags, the v1 lookup-table relayer client, the Export View Key and native
 * prover debug screens, the devnet presale placeholders (S13), and the v1 view key (its EIP-2333
 * derivation in JS and its keychain entry — the A0 keys are derived inside the Rust core).
 *
 * Read three ways, like M1a's keyModuleRemoved guard:
 *  1. the removed FILES do not exist;
 *  2. no code file IMPORTS a removed module — every relative import / require / jest.mock / import()
 *     specifier under the code trees is resolved against its file and compared with the removed
 *     paths (so `a0/noteStore` stays legal while the v1 `shielded/noteStore` is caught);
 *  3. no code file NAMES a removed symbol — a list of patterns over the whole text, comments
 *     included (a comment naming a removed call is how a removal starts to be reverted).
 * Markdown (history, plans, specs) is not code and is not read. Each reading has a positive control.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../../..');
const SELF = path.relative(ROOT, __filename);

/** The removed files (§12 M1b), extension included. */
const REMOVED_FILES = [
  ...[
    'depositEvents', 'depositFlow', 'depositWitness', 'fieldCodec', 'leafResolver', 'merkleSync',
    'merkleTreeAccount', 'noteCiphertextEvents', 'noteCrypto', 'noteScan', 'noteSelect', 'noteStore',
    'poolInstructions', 'poolPdas', 'poolState', 'poolTokens', 'poolTx', 'privacyMeter',
    'relayerSubmit', 'shieldedAddressCodec', 'shieldedBalances', 'shieldedIdentity',
    'shieldedViewSession', 'transferFlow', 'transferWitness', 'types', 'withdrawChangeWitness',
    'withdrawFlow', 'withdrawWitness',
  ].map(m => `src/modules/shielded/${m}.ts`),
  'src/modules/zkProver/zkProverModule.ts',
  'src/modules/zkProver/proofQueue.ts',
  'src/modules/zkProver/localProver.ts',
  'src/modules/zkProver/types.ts',
  'src/constants/provingAssets.ts',
  'src/modules/solana/relayer.ts',
  'src/screens/debug/NativeProveDebugScreen.tsx',
  'src/screens/settings/ExportViewKeyScreen.tsx',
  'src/components/PrivacyMeter.tsx',
  'src/components/ShieldedAddressInput.tsx',
  'src/components/ProofProgressOverlay.tsx',
  'native/noctura-prover/src/prover.rs',
  'native/noctura-prover/tests/prove_to_bytes.rs',
  'native/noctura-prover/examples/deposit_prove.rs',
  'native/noctura-prover/examples/onchain_format_check.rs',
  'native/noctura-prover/examples/zkey_check.rs',
  'native/noctura-prover/artifacts/deposit_input.json',
  'android/app/src/test/java/com/nocturawallet/prover/ProveV1RemovedTest.kt',
  // the v1 view-key path (controller ruling on Task 6 concern 4)
  'src/modules/keyDerivation/shielded.ts',
];
const REMOVED_MODULES = new Set(
  REMOVED_FILES.filter(f => /\.(ts|tsx)$/.test(f)).map(f => f.replace(/\.(ts|tsx)$/, '')),
);

/** Names of removed things. Comments count: see the header. */
const FORBIDDEN: Array<[string, RegExp]> = [
  ['the v1 pool program', /NPkc/],
  ['the v1 spend secret', /noteSecret/],
  ['the v1 native prove', /\bnativeProve\b|\bproveV1\b|E_V1_REMOVED|prove_to_bytes|crate::prover\b|\bprover::prove/],
  ['the v1 prover RNG', /seed_from_u64\(0\)/],
  ['a removed flag', /SHIELDED_RELAYER|shieldedRelayer|SHIELDED_TRANSFER|shieldedTransfer|isShieldedTransferEnabled|NATIVE_PROVER_DEBUG|SHIELDED_DEVNET_MINT/],
  ['a removed screen', /NativeProveDebug|\bExportViewKey(Screen)?\b/],
  ['the v1 state', /shieldedBalances|primeViewSession|ShieldedViewSession|SHIELDED_ADDRESS_HRP|SHIELDED_POOL_PROGRAM_ID|SHIELDED_POOL_MINTS/],
  ['the v1 asset set / hosted proving', /ZKEY_ASSETS\b|ensureCircuitAssets|constants\/provingAssets|proveShielded|warmProver/],
  ['a devnet placeholder', /TODO_DEVNET/],
  ['the v1 view key', /deriveShieldedViewKey|deriveDisclosureKey|storeViewKey|retrieveViewKey|keyDerivation\/shielded\b/],
];

/**
 * The files allowed to carry one named pattern, each with its reason. Nothing else is exempt.
 *  - noteEncryption is KEPT (spec §12 "Kept but unused in M1": M2 revalidates its v1 payload);
 *  - the A0 store's tests assert that no `noteSecret` field is stored and that a v1 record is cleared;
 *  - the route tests assert that the removed screens have no route.
 */
const ALLOWED: Record<string, string[]> = {
  'src/modules/shielded/noteEncryption.ts': ['the v1 spend secret'],
  'src/modules/shielded/__tests__/noteEncryption.test.ts': ['the v1 spend secret'],
  'src/modules/shielded/__tests__/noteEncryption.golden.test.ts': ['the v1 spend secret'],
  'src/modules/shielded/a0/__tests__/noteStore.test.ts': ['the v1 spend secret'],
  'src/app/__tests__/presaleRoutes.test.tsx': ['a removed screen'],
};

const TREES = ['src', 'android', 'native/noctura-prover', 'scripts', '.github', '__mocks__', 'index.js', 'globalBuffer.js', 'package.json', 'jest.config.js'];
const SKIP_DIRS = new Set(['node_modules', 'build', '.gradle', '.cxx', 'Pods', 'target', 'artifacts', 'jniLibs', '.kotlin', 'fixtures']);
const CODE = /\.(ts|tsx|js|mjs|cjs|json|kt|kts|java|gradle|properties|rs|toml|map|sh|txt|yml|yaml|xml|pro)$/;

function walk(rel: string, out: string[]): void {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    return;
  }
  const st = fs.statSync(abs);
  if (st.isFile()) {
    if (CODE.test(path.basename(rel)) && rel !== SELF) {
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

function findings(text: string): string[] {
  return FORBIDDEN.filter(([, re]) => re.test(text)).map(([what]) => what);
}

/** Every module specifier a JS/TS file names (import, export … from, require, jest.mock, import()). */
function specifiers(text: string): string[] {
  const re = /(?:\bfrom\s+|\bimport\s+|\brequire\(\s*|\bjest\.(?:mock|doMock|requireActual|requireMock)\(\s*|\bimport\(\s*)['"]([^'"]+)['"]/g;
  return [...text.matchAll(re)].map(m => m[1]!);
}

/** The repo-relative module a specifier names (extension and /index stripped), or null if external. */
function resolveModule(fromFile: string, spec: string): string | null {
  let target: string;
  if (spec.startsWith('.')) {
    target = path.normalize(path.join(path.dirname(fromFile), spec));
  } else if (spec.startsWith('@/')) {
    target = path.normalize(path.join('src', spec.slice(2)));
  } else {
    return null;
  }
  return target.replace(/\.(ts|tsx|js|mjs)$/, '').replace(/\/index$/, '');
}

function removedImports(file: string, text: string): string[] {
  return specifiers(text)
    .map(s => resolveModule(file, s))
    .filter((m): m is string => m !== null && REMOVED_MODULES.has(m));
}

const files: string[] = [];
TREES.forEach(t => walk(t, files));
const JS = files.filter(f => /\.(ts|tsx|js|mjs|cjs)$/.test(f));

describe('the v1 shielded path (§12 M1b) is removed', () => {
  it('reads the trees it claims to (non-vacuous)', () => {
    expect(files.length).toBeGreaterThan(300);
    for (const known of [
      'src/modules/shielded/a0/noteStore.ts',
      'src/modules/shielded/a0/depositFlow.ts',
      'src/modules/zkProver/nativeProverBridge.ts',
      'native/noctura-prover/src/android.rs',
      'native/noctura-prover/jni-exports.txt',
      'android/app/src/main/java/com/nocturawallet/prover/NocturaProverModule.kt',
      '.github/workflows/native-prover.yml',
      'scripts/mutation-sweep.mjs',
    ]) {
      expect(files).toContain(known);
    }
  });

  it('its files are gone', () => {
    const present = REMOVED_FILES.filter(f => fs.existsSync(path.join(ROOT, f)));
    expect(present).toEqual([]);
  });

  it('no code file imports a removed module (resolved, so a0/noteStore is not v1 noteStore)', () => {
    const hits = JS.map(f => ({f, m: removedImports(f, fs.readFileSync(path.join(ROOT, f), 'utf8'))})).filter(h => h.m.length > 0);
    expect(hits).toEqual([]);
  });

  it('no code file names a removed thing (outside the listed exceptions)', () => {
    const hits = files
      .map(f => {
        const allowed = ALLOWED[f] ?? [];
        return {f, what: findings(fs.readFileSync(path.join(ROOT, f), 'utf8')).filter(w => !allowed.includes(w))};
      })
      .filter(h => h.what.length > 0);
    expect(hits).toEqual([]);
  });

  it('every exception is still needed (a stale exception would hide a reference)', () => {
    for (const [f, labels] of Object.entries(ALLOWED)) {
      const found = findings(fs.readFileSync(path.join(ROOT, f), 'utf8'));
      for (const l of labels) {
        expect(`${f}: ${found.includes(l) ? l : 'unused'}`).toBe(`${f}: ${l}`);
      }
    }
  });
});

describe('the readers can fail (positive controls)', () => {
  it('the import resolver catches a v1 import from inside and outside shielded/, and not the A0 namesakes', () => {
    expect(removedImports('src/modules/shielded/eventLogs.ts', "import {x} from './noteStore';")).toEqual(['src/modules/shielded/noteStore']);
    expect(removedImports('src/screens/dashboard/DashboardScreen.tsx', "import {scanIncomingNotes} from '../../modules/shielded/noteScan';")).toEqual([
      'src/modules/shielded/noteScan',
    ]);
    expect(removedImports('src/store/zustand/sessionStore.ts', "jest.mock('../../modules/shielded/shieldedViewSession')")).toEqual([
      'src/modules/shielded/shieldedViewSession',
    ]);
    expect(removedImports('src/x.ts', "const m = require('./constants/provingAssets.ts');")).toEqual(['src/constants/provingAssets']);
    expect(removedImports('src/x.ts', "import('@/modules/zkProver/zkProverModule')")).toEqual(['src/modules/zkProver/zkProverModule']);
    // not removed: the A0 store / flow, the kept modules
    expect(removedImports('src/modules/shielded/a0/startup.ts', "import {x} from './noteStore';")).toEqual([]);
    expect(removedImports('src/modules/shielded/a0/startup.ts', "import {x} from './depositFlow';")).toEqual([]);
    expect(removedImports('src/modules/shielded/a0/syncedTx.ts', "import {poolLeafBlobs} from '../eventLogs';")).toEqual([]);
    expect(removedImports('src/x.ts', "import {Connection} from '@solana/web3.js';")).toEqual([]);
  });

  it('the name patterns flag each kind', () => {
    expect(findings("const SHIELDED_POOL_PROGRAM_ID = 'NPkcpUdnm1JZhndur3ggQZwo86yWgcU6Ry28T3zHfES';")).toEqual(['the v1 pool program', 'the v1 state']);
    expect(findings('note.noteSecret')).toEqual(['the v1 spend secret']);
    expect(findings('export async function nativeProve(')).toEqual(['the v1 native prove']);
    expect(findings('fun proveV1(')).toEqual(['the v1 native prove']);
    expect(findings('let out = crate::prover::prove_to_bytes(&cid, &wj, &zk, &wp)?;')).toEqual(['the v1 native prove']);
    expect(findings('StdRng::seed_from_u64(0)')).toEqual(['the v1 prover RNG']);
    expect(findings("shieldedRelayer: Config.SHIELDED_RELAYER === 'true'")).toEqual(['a removed flag']);
    expect(findings("navigation.navigate('ExportViewKey')")).toEqual(['a removed screen']);
    expect(findings('const {shieldedBalances} = useWalletStore();')).toEqual(['the v1 state']);
    expect(findings('await ensureCircuitAssets(id, io)')).toEqual(['the v1 asset set / hosted proving']);
    expect(findings("? 'TODO_DEVNET_MINT'")).toEqual(['a devnet placeholder']);
    expect(findings('const viewKey = deriveShieldedViewKey(seed);')).toEqual(['the v1 view key']);
    expect(findings('await keychainManager.storeViewKey(viewKeyRef.current);')).toEqual(['the v1 view key']);
    expect(removedImports('src/screens/onboarding/SuccessScreen.tsx', "import {x} from '../../modules/keyDerivation/shielded';")).toEqual([
      'src/modules/keyDerivation/shielded',
    ]);
    // not references: the A0 names, the disabled row's label, the seeded test RNGs
    expect(findings('a0Prove(handle, circuit, witnessJson, null, z, w)')).toEqual([]);
    expect(findings('label="Export View Key"')).toEqual([]);
    expect(findings('StdRng::seed_from_u64(7)')).toEqual([]);
    expect(findings("Java_com_nocturawallet_prover_NocturaProverModule_nativeIsSupported")).toEqual([]);
    expect(findings('await keychainManager.dropV1ViewKey();')).toEqual([]);
  });
});
