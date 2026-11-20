/**
 * Shielded UX part B, spec §3.1 / §6: none of the banned words (Shield, Unshield, Shielded,
 * Transparent, Vault) in any user-visible string of src/screens/** or src/components/**, plus the
 * module copy those screens render. Read from the sources with the TypeScript compiler
 * (`copyScan.ts`), so a test id, a class name, a comparison or a comment is not copy.
 */
import * as fs from 'fs';
import * as path from 'path';
import {bannedStrings, forbiddenClaims, walkSources} from '../__testing__/copyScan';

const ROOT = path.resolve(__dirname, '../../..');

/** Files outside src/screens and src/components whose strings reach the user as they are (plan A3, review I-3). */
const EXTRA = [
  'src/modules/shielded/a0/unshieldCheck.ts',
  'src/hooks/useA0Shielded.ts',
  'src/app/Navigator.tsx',
  'src/constants/errors.ts',
  'src/modules/geoFence/geoFenceModule.ts',
];

function sources(): Array<{file: string; text: string}> {
  return [
    ...walkSources(path.join(ROOT, 'src/screens')),
    ...walkSources(path.join(ROOT, 'src/components')),
    ...EXTRA.map(f => path.join(ROOT, f)),
  ].map(p => ({file: path.relative(ROOT, p), text: fs.readFileSync(p, 'utf8')}));
}

/**
 * THE RATCHET (part B, Tasks 1 → 5): each file not yet swapped and its EXACT number of banned
 * strings on the day Task 1 landed. The task that swaps a file deletes its line here in the same
 * commit (Task 3: #16; Task 4: the run screens; Task 5: the rest, and the map with it). Exact, not
 * "at most": a file that gains a banned string fails, and a swapped file whose line was left fails.
 */
const NOT_YET_SWAPPED: Record<string, number> = {
  'src/screens/dashboard/DashboardScreen.tsx': 15,
  'src/screens/onboarding/SuccessScreen.tsx': 1,
  'src/screens/portfolio/PortfolioScreen.tsx': 1,
  'src/screens/shielded/ShieldConfirmScreen.tsx': 7,
  'src/screens/shielded/ShieldSimulateScreen.tsx': 7,
  'src/screens/shielded/ShieldStatusScreen.tsx': 10,
  'src/screens/shielded/ShieldUnshieldScreen.tsx': 11,
  'src/screens/shielded/ShieldedExplainerScreen.tsx': 4,
  'src/screens/shielded/ZkProofScreen.tsx': 1,
  'src/screens/shielded/unshield/UnshieldRunScreen.tsx': 18,
  'src/screens/shielded/unshield/UnshieldSide.tsx': 7,
  'src/screens/shielded/unshield/unshieldCopy.ts': 8,
  'src/screens/transparent/ReceiveScreen.tsx': 11,
  'src/screens/transparent/SendScreen.tsx': 1,
  'src/screens/transparent/TransactionHistoryScreen.tsx': 1,
  'src/screens/transparent/TxSimulateScreen.tsx': 3,
  'src/modules/shielded/a0/unshieldCheck.ts': 3,
  'src/hooks/useA0Shielded.ts': 1,
  'src/app/Navigator.tsx': 1,
  'src/constants/errors.ts': 4,
  'src/modules/geoFence/geoFenceModule.ts': 2,
};

const FIXTURE = [
  "import {X} from './ShieldStatusScreen';",
  '// Shielded mode, a comment',
  "const on = mode === 'shielded';",
  "const k = {kind: 'shield'};",
  'const uri = `noctura+shielded:${on}`;',
  'export const C = () => (',
  '  <Text testID="shielded-line" className="text-accent-shielded">Unshield</Text>',
  ');',
].join('\n');

describe('the banned words (spec §2) are out of every user-visible string', () => {
  it('positive control: "Unshield" in JSX text is caught, and only it', () => {
    expect(bannedStrings('fixture.tsx', FIXTURE).map(s => s.text)).toEqual(['Unshield']);
    expect(bannedStrings('fixture.tsx', FIXTURE.replace('>Unshield<', '>Make public<'))).toEqual([]);
  });

  it.each(['Shield', 'Unshield', 'Shielded', 'Transparent', 'Vault', 'shielding', 'vault balance'])(
    'positive control: "%s" in an accessibility label is copy, and caught',
    w => {
      expect(bannedStrings('f.tsx', `const a = <Text accessibilityLabel="${w} TEST" />;`)).toHaveLength(1);
    },
  );

  it('review M-1: JSX text is copy even as a lower-case fragment between expressions', () => {
    expect(bannedStrings('f.tsx', 'const C = () => <Text>Move into the {x} vault</Text>;').map(s => s.text)).toEqual(['vault']);
  });

  it('negative controls: a test id, a class name, a comparison, an object value token, an import, a comment, a URI scheme are not copy', () => {
    const only = FIXTURE.replace('>Unshield<', '><');
    expect(bannedStrings('fixture.tsx', only)).toEqual([]);
  });

  it('review M-1 (fix round 1): hyphenated copy counts, a Tailwind utility with spaces does not', () => {
    expect(bannedStrings('f.tsx', "const a = 'Shielded-only mode';")).toHaveLength(1);
    expect(bannedStrings('f.tsx', "const a = 'Go non-shielded now';")).toHaveLength(1);
    expect(bannedStrings('f.tsx', "const a = 'border border-accent-transparent';")).toEqual([]);
    expect(bannedStrings('f.tsx', "const a = 'rounded bg-accent-shielded-tint p-2';")).toEqual([]);
  });

  // One row per exclusion rule, each isolated: the banned phrase sits ONLY behind that rule (review M-2).
  it('each exclusion rule is isolated (a hit when the rule does not apply, none when it does)', () => {
    expect(bannedStrings('f.tsx', 'const a = <Row subtitle="Shielded NOC" />;')).toHaveLength(1);
    expect(bannedStrings('f.tsx', 'const a = <Row testID="Shielded NOC" />;')).toEqual([]);
    expect(bannedStrings('f.tsx', 'const a = <Row className="Shielded NOC" />;')).toEqual([]);
    expect(bannedStrings('f.tsx', "const a = f('Shielded pool');")).toHaveLength(1);
    expect(bannedStrings('f.tsx', "const a = cn('Shielded pool');")).toEqual([]);
    expect(bannedStrings('f.tsx', "const a = x == 'Shielded pool';")).toHaveLength(1);
    expect(bannedStrings('f.tsx', "const a = x === 'Shielded pool';")).toEqual([]);
    expect(bannedStrings('f.tsx', "switch (x) { case 'Shielded pool': break; }")).toEqual([]);
    expect(bannedStrings('f.tsx', "const a = {'Shielded pool': 1};")).toEqual([]);
    expect(bannedStrings('f.tsx', "const a = {label: 'Shielded pool'};")).toHaveLength(1);
    expect(bannedStrings('f.tsx', "import {x} from 'Shielded pool';")).toEqual([]);
  });

  it('stated limit (review M-3): a lower-case single word outside JSX text is a token, not copy', () => {
    expect(bannedStrings('f.tsx', "const a = {label: 'shielded'};")).toEqual([]);
    expect(bannedStrings('f.tsx', 'const a = <Text>{x} shielded</Text>;')).toHaveLength(1); // JSX text is always copy
  });

  it('review I-1 (fix round 1): a phrase wrapped across lines inside JSX text is still caught', () => {
    expect(forbiddenClaims('f.tsx', 'const C = () => (\n<Text>\n  Your wallet is fully\n   private here.\n</Text>);')).toEqual(['fully private']);
    expect(forbiddenClaims('f.tsx', 'const C = () => (\n<Text>\n  Amounts stay private\n   on-chain.\n</Text>);')).toEqual(['stays? private on-?chain']);
    expect(forbiddenClaims('f.tsx', 'const C = () => (\n<Text>\n  No one\n   can see it.\n</Text>);')).toEqual(['no one can see']);
  });

  it('review M-2 (fix round 1): copy-like props are scanned for forbidden claims', () => {
    expect(forbiddenClaims('f.tsx', 'const a = <Row name="Fully private wallet" />;')).toEqual(['fully private']);
    expect(forbiddenClaims('f.tsx', 'const a = <Row accessibilityLabel="Anonymous send" />;')).toEqual(['anonymous']);
  });

  it('the scan reads every screen and component (positive control)', () => {
    const files = sources().map(s => s.file);
    expect(files.length).toBeGreaterThanOrEqual(80);
    expect(files).toEqual(
      expect.arrayContaining([
        'src/screens/dashboard/DashboardScreen.tsx',
        'src/screens/shielded/ShieldUnshieldScreen.tsx',
        'src/screens/shielded/unshield/UnshieldRunScreen.tsx',
        'src/screens/onboarding/SelectAccountScreen.tsx',
        'src/components/CheckAgainLink.tsx',
        'src/modules/shielded/a0/unshieldCheck.ts',
        'src/app/Navigator.tsx',
        'src/constants/errors.ts',
      ]),
    );
    expect(files.some(f => f.includes('__tests__'))).toBe(false);
  });

  it('every ratchet line names a file in scope (a stale line fails)', () => {
    const files = new Set(sources().map(s => s.file));
    for (const f of Object.keys(NOT_YET_SWAPPED)) {
      expect(files.has(f)).toBe(true);
    }
  });

  it.each(sources().map(s => [s.file, s.text] as const))('%s: exactly its ratchet count of banned strings', (file, text) => {
    const hits = bannedStrings(file, text).map(s => `${s.line}: ${s.text}`);
    expect(hits).toHaveLength(NOT_YET_SWAPPED[file] ?? 0);
  });

  it.each(sources().map(s => [s.file, s.text] as const))('%s: no forbidden phrase (spec §2)', (file, text) => {
    expect(forbiddenClaims(file, text)).toEqual([]);
  });
});
