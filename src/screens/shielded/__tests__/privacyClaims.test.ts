import * as fs from 'fs';
import * as path from 'path';

/**
 * The shielded screens must not claim a privacy property the scheme does not deliver today: with one
 * transparent key and a self-relayed exit, a deposit and its withdrawal can be linked by reading two
 * transactions (memory: shielded privacy guarantee). The questionnaire answer of 2026-11-05 lists the
 * claims that were removed; this test keeps them out. Its regexes are never relaxed (spec §11);
 * M1c widens only its scope.
 */
const UNSUPPORTED = [
  /won't be linked/i,
  /unlinkable/i,
  /not even Noctura/i,
  /onward is private/i,
  /untraceable/i,
  /fully anonymous/i,
  /Plonk/i,
];

const ROOT = path.resolve(__dirname, '../../../..');

/**
 * M1c Task 8 (spec §11 "The guard … its scope grows to every file carrying M1 copy"): every
 * `.ts` / `.tsx` under `src/screens/shielded/` at ANY depth (the new `unshield/` directory: #16's
 * unshield side, the destination choice and its warnings, the unshield run #18 → #21, the copy
 * module), outside `__tests__`; plus the M1 copy that lives outside it (the "Check again" link).
 */
function walk(dir: string): string[] {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

const EXTRA_COPY = [
  path.join(ROOT, 'src/components/CheckAgainLink.tsx'),
  // Shielded UX part A: the dashboard carries shielded copy too (its "Make public" action, the
  // "pending · not confirmed yet" caption, the shielded asset lines).
  path.join(ROOT, 'src/screens/dashboard/DashboardScreen.tsx'),
  // Shielded UX part B (spec §2 "Widened"): the one vocabulary module.
  path.join(ROOT, 'src/copy/modes.ts'),
  // part B: copy a screen shows as it is (the "Check again" captions, the unavailable message, #10's recipient)
  path.join(ROOT, 'src/modules/shielded/a0/unshieldCheck.ts'),
  path.join(ROOT, 'src/hooks/useA0Shielded.ts'),
  path.join(ROOT, 'src/app/Navigator.tsx'),
  // part B: every file that changed copy
  path.join(ROOT, 'src/screens/transparent/ReceiveScreen.tsx'),
  path.join(ROOT, 'src/screens/transparent/SendScreen.tsx'),
  path.join(ROOT, 'src/screens/transparent/TransactionHistoryScreen.tsx'),
  path.join(ROOT, 'src/screens/transparent/TxSimulateScreen.tsx'),
  path.join(ROOT, 'src/screens/onboarding/SuccessScreen.tsx'),
  path.join(ROOT, 'src/screens/portfolio/PortfolioScreen.tsx'),
  path.join(ROOT, 'src/constants/errors.ts'),
  path.join(ROOT, 'src/modules/geoFence/geoFenceModule.ts'),
];

/**
 * Shielded UX part B Task 6 (controller carry): the scope is ALL of `src/screens/**` and
 * `src/components/**` outside `__tests__` (it was `screens/shielded` + `components/private`), so a
 * claim added to any screen or shared component is read. The regexes above are unchanged.
 */
const ALL_SCREENS = path.join(ROOT, 'src/screens');
const ALL_COMPONENTS = path.join(ROOT, 'src/components');

function screenSources(): Array<{file: string; text: string}> {
  return [...walk(ALL_SCREENS), ...walk(ALL_COMPONENTS), ...EXTRA_COPY].map(p => ({
    file: path.relative(ROOT, p),
    text: fs.readFileSync(p, 'utf8'),
  }));
}

/** Every Android string resource of the app (`res/values*\/*.xml` with a <string>): the Kotlin side. */
const RES = path.join(ROOT, 'android/app/src/main/res');
function androidStringResources(): Array<{file: string; text: string}> {
  return fs
    .readdirSync(RES, {withFileTypes: true})
    .filter(d => d.isDirectory() && d.name.startsWith('values'))
    .flatMap(d =>
      fs
        .readdirSync(path.join(RES, d.name))
        .filter(f => f.endsWith('.xml'))
        .map(f => path.join(RES, d.name, f)),
    )
    .map(p => ({file: path.relative(ROOT, p), text: fs.readFileSync(p, 'utf8')}))
    .filter(r => r.text.includes('<string '));
}

/**
 * The native unshield confirmation's strings (spec §4: "The dialog's strings live in an Android
 * resource covered by the privacy-claims guard"; M1c Task 6). Its text is what a user reads at the
 * moment of approving an exit, so it is held to the same list.
 */
const NATIVE_STRINGS = path.resolve(__dirname, '../../../../android/app/src/main/res/values/a0_confirm_strings.xml');

export function unsupportedClaims(text: string): string[] {
  return UNSUPPORTED.filter(re => re.test(text)).map(re => re.source);
}

describe('shielded screens make no unsupported privacy claim', () => {
  it('reads every shielded screen (positive control: the scan is not empty)', () => {
    expect(screenSources().length).toBeGreaterThanOrEqual(5);
  });

  it('M1c: the scope reaches the new unshield directory and the M1 copy outside it (positive control)', () => {
    const files = screenSources().map(s => s.file);
    expect(files).toEqual(
      expect.arrayContaining([
        'src/screens/shielded/ShieldUnshieldScreen.tsx',
        'src/screens/shielded/unshield/UnshieldSide.tsx',
        'src/screens/shielded/unshield/UnshieldRunScreen.tsx',
        'src/screens/shielded/unshield/unshieldCopy.ts',
        'src/components/CheckAgainLink.tsx',
        'src/components/private/DestinationRow.tsx',
        'src/screens/dashboard/DashboardScreen.tsx',
        'src/copy/modes.ts',
        'src/modules/shielded/a0/unshieldCheck.ts',
        'src/hooks/useA0Shielded.ts',
        'src/app/Navigator.tsx',
        'src/screens/transparent/ReceiveScreen.tsx',
        // part B Task 6: the widened scope reaches screens outside the shielded directory
        'src/screens/settings/WipeWalletScreen.tsx',
        'src/screens/staking/StakingScreen.tsx',
      ]),
    );
    // the scope is wide, not just the shielded directory
    expect(files.length).toBeGreaterThan(40);
    // the dashboard is read as text: its shielded caption is in what the guard sees
    const dash = screenSources().find(s => s.file === 'src/screens/dashboard/DashboardScreen.tsx')!;
    expect(dash.text).toContain('pending · not confirmed yet');
    expect(files.some(f => f.includes('__tests__'))).toBe(false);
    // the copy module is read as text: §11's relayed-unshield sentence is in what the guard sees
    const copy = screenSources().find(s => s.file.endsWith('unshield/unshieldCopy.ts'))!;
    expect(copy.text).toContain('so no key of yours signs it. Amounts and timing are public.');
    // part B: the vocabulary module is read as text; its honest sentence is in what the guard sees
    const vocab = screenSources().find(s => s.file === 'src/copy/modes.ts')!;
    expect(vocab.text).toContain('Deposits are public on chain.');
  });

  it('M1c: the scope reaches every Android string resource (the Kotlin strings.xml and the dialog resource)', () => {
    const files = androidStringResources().map(r => r.file);
    expect(files).toEqual(
      expect.arrayContaining([
        'android/app/src/main/res/values/strings.xml',
        'android/app/src/main/res/values/a0_confirm_strings.xml',
      ]),
    );
    // styles.xml holds no <string>: it is not a copy file (negative control on the filter)
    expect(files).not.toContain('android/app/src/main/res/values/styles.xml');
  });

  it.each(androidStringResources().map(r => [r.file, r.text] as const))('%s carries none of them', (_file, text) => {
    expect(unsupportedClaims(text)).toEqual([]);
  });

  it('positive control: a planted "unlinkable" in strings.xml is flagged', () => {
    const xml = androidStringResources().find(r => r.file.endsWith('values/strings.xml'))!.text;
    const planted = xml.replace('<string name="app_name">', '<string name="a0_planted">Your exit is unlinkable</string>\n    <string name="app_name">');
    expect(planted).not.toBe(xml);
    expect(unsupportedClaims(xml)).toEqual([]);
    expect(unsupportedClaims(planted)).toEqual(['unlinkable']);
  });

  it('flags each unsupported phrase (negative control)', () => {
    expect(unsupportedClaims("Recipients won't be linked to your public address.")).toEqual(["won't be linked"]);
    expect(unsupportedClaims('Sender and amount are unlinkable on-chain.')).toEqual(['unlinkable']);
    expect(unsupportedClaims('a Plonk-style proof')).toEqual(['Plonk']);
    expect(unsupportedClaims('Deposits and withdrawals are public and can be linked to your address.')).toEqual([]);
  });

  it.each(screenSources().map(s => [s.file, s.text] as const))('%s carries none of them', (_file, text) => {
    expect(unsupportedClaims(text)).toEqual([]);
  });

  it('the native confirmation strings resource carries none of them', () => {
    const xml = fs.readFileSync(NATIVE_STRINGS, 'utf8');
    // positive control: this is the dialog's resource, not an empty file
    expect(xml).toContain('name="a0_confirm_amount_line"');
    expect(xml).toContain('taken from your private balance'); // part B: the wording, not the guard, changed
    expect(unsupportedClaims(xml)).toEqual([]);
    // negative control: a planted claim in the same resource is flagged
    const planted = xml.replace('Confirm making public', 'Confirm your unlinkable exit');
    expect(planted).not.toBe(xml);
    expect(unsupportedClaims(planted)).toEqual(['unlinkable']);
  });
});
