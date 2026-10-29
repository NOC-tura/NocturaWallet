import {execFileSync} from 'node:child_process';
import {cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  BOTH_BUILDS,
  CORE_PRESALE_ALLOWED,
  MARKERS,
  MUST_STAY,
  ON_BUILD,
  WEB_ALLOWED,
  checkNoPresale,
  decoderInstructionNames,
  featureViolations,
  markerViolations,
  missingModules,
  missingStrings,
  moduleIds,
  offModuleViolations,
} from '../check-no-presale.mjs';
import {PRESALE_ENTRIES} from '../presaleSwitch.mjs';
import {PRESALE_INSTRUCTIONS} from '../../src/background/dapp/decode/presaleIdl';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FIXTURE = JSON.parse(readFileSync(join(ROOT, 'scripts/__tests__/fixtures/app.modules.0b79442.json'), 'utf8'));
const map = ids => ({chunks: {'background.js': ids}});
const without = (m, id) => ({...m, chunks: Object.fromEntries(Object.entries(m.chunks).map(([f, ids]) => [f, ids.filter(i => i !== id)]))});
const SHARED = ['src/background/index.ts', 'src/background/intents.ts', 'src/background/geo/gate.ts', '../core/geo/fetch.ts', 'src/app/ui/regionName.ts', 'src/background/presaleRecordsKey.ts', '../core/presale/addresses.ts', '../core/presale/allocation.ts', '../core/presale/stagePrices.ts', '../core/solana/encoding.ts'];

// B1d §6.2 item 1 (C38, D15): the off build's module rule — an allowlist for core/presale/**, core/geo/** whole.
describe('the off-build module rule', () => {
  it('self-test: the map of commit 0b79442 (before B1d) fails naming exactly core/presale/buyInstructions.ts', () => {
    expect(Object.keys(FIXTURE)[0]).toBe('builtFrom');
    expect(FIXTURE.builtFrom).toMatch(/^commit 0b79442 /);
    const v = offModuleViolations(moduleIds([FIXTURE]));
    expect(v).toHaveLength(1);
    expect(v[0]).toMatch(/^off build carries core\/presale\/buyInstructions\.ts /);
  });

  it('self-test: and passes with that one entry removed', () => {
    expect(offModuleViolations(moduleIds([without(FIXTURE, '../core/presale/buyInstructions.ts')]))).toEqual([]);
  });

  it('allows exactly addresses, allocation and stagePrices of core/presale, and all of core/geo (D15)', () => {
    expect(CORE_PRESALE_ALLOWED).toEqual(['core/presale/addresses.ts', 'core/presale/allocation.ts', 'core/presale/stagePrices.ts']);
    const geo = ['../core/geo/fetch.ts', '../core/geo/freshness.ts', '../core/geo/classify.ts', '../core/geo/restrictedList.ts', 'src/background/geo/gate.ts'];
    expect(offModuleViolations(moduleIds([map([...SHARED, ...geo])]))).toEqual([]);
  });

  // Fix round 1 (review I1): an allowlist for ../web/ too, not a denylist — web/src/presale/** imports only erased
  // core/presale types, so no other branch of rule 1 would catch it.
  it('allows exactly web/src/ui/** and web/src/styles/** of ../web/, and nothing else under ../web/', () => {
    expect(WEB_ALLOWED).toEqual(['../web/src/ui/', '../web/src/styles/']);
    const web = ['../web/src/ui/AddressGroups.tsx', '../web/src/ui/Icon.tsx', '../web/src/styles/design-system.css'];
    expect(offModuleViolations(moduleIds([map([...SHARED, ...web])]))).toEqual([]);
  });

  it.each([
    'src/background/presale/api.ts',
    'src/background/presale/state.ts',
    'src/app/presale/index.ts',
    'src/app/presale/Presale.tsx',
    'src/unlock/presale.ts',
    '../core/referral/index.ts',
    '../core/presale/buyInstructions.ts',
    '../core/presale/limits.ts',
    '../core/presale/stats.ts',
    '../core/presale/purchaseGate.ts',
    '../core/presale/buyInstructions.ts?commonjs-proxy',
    'src/unlock/presale.ts?v=1',
    '../core/presale/limits.ts#x',
    '../web/src/presale/PresalePanel.tsx',
  ])('refuses %s in the off build', id => {
    expect(offModuleViolations(moduleIds([map([...SHARED, id])]))).toHaveLength(1);
  });

  it('reads every chunk of every map it is given, and a map without chunks is INCONCLUSIVE', () => {
    const two = [map(SHARED), {chunks: {'assets/x.js': ['src/x.ts'], 'assets/y.js': ['src/app/presale/index.ts']}}];
    expect(offModuleViolations(moduleIds(two))).toHaveLength(1);
    expect(() => moduleIds([{}])).toThrow(/INCONCLUSIVE/);
    expect(() => moduleIds([])).toThrow(/INCONCLUSIVE/);
    expect(() => moduleIds([{chunks: {}}])).toThrow(/INCONCLUSIVE/);
  });

  // Minor (fix round 1): a chunk's value must be an array — a string is iterable character by character and would
  // otherwise pass every rule silently (a bundler never writes this; hardening only).
  it('a chunk whose value is a string, not an array, is INCONCLUSIVE', () => {
    expect(() => moduleIds([{chunks: {'a.js': 'src/app/presale/index.ts'}}])).toThrow(/INCONCLUSIVE/);
  });

  it('a stub and a presale-named module outside the presale directories are not presale modules', () => {
    const ok = ['src/presale-off/background.ts', 'src/presale-off/app.ts', 'src/presale-off/unlock.ts', 'src/background/presaleHost.ts', 'src/background/dapp/decode/presaleIdl.ts'];
    expect(offModuleViolations(moduleIds([map([...SHARED, ...ok])]))).toEqual([]);
  });
});

// §6.2 item 1's positive control, staged per plan (review 2 M2): the lists only grow, and each plan's modules are named.
describe('the positive-control lists (staged: B1d-1a Task 2)', () => {
  it('the on build must carry the three on-path entries — the plugin maps something real — the program state (Task 5), the quote (B1d-1b Task 1), the purchase (Task 2), #23 (Task 4), #20’s purchase variant with the record slot (Task 5), #50b (Task 6), the purchase’s builder and referrer resolution from core/presale (Task 8), B1d-2’s record (Task 1) and #24’s background, core/referral and screen (Task 4)', () => {
    expect(ON_BUILD).toEqual([
      ...PRESALE_ENTRIES.map(e => e.entry),
      'src/background/presale/layouts.ts',
      'src/background/presale/state.ts',
      'core/presale/limits.ts',
      'src/background/presale/quote.ts',
      'src/background/presale/buy.ts',
      'src/app/presale/routes.tsx',
      'src/app/presale/Presale.tsx',
      'src/app/presale/client.ts',
      'src/app/presale/text.ts',
      'src/app/presale/PresaleConfirm.tsx',
      'src/app/presale/records.ts',
      'src/app/presale/Geo.tsx',
      'core/presale/buyInstructions.ts',
      'core/presale/referrer.ts',
      'src/background/presale/record.ts',
      'src/background/presale/referral.ts',
      'core/referral/index.ts',
      'src/app/presale/ReferFriend.tsx',
    ]);
  });

  it('both builds must carry the intent-kind registry (Task 3), the jurisdiction gate with its fetcher (Task 6, D15), the country name of #48’s F12 (B1d-1b Task 7) and the presale records’ key (B1d-2 Task 1)', () => {
    expect(BOTH_BUILDS).toEqual(['src/background/intents.ts', 'src/background/geo/gate.ts', 'core/geo/fetch.ts', 'src/app/ui/regionName.ts', 'src/background/presaleRecordsKey.ts']);
  });

  it('missingModules names each required module a map does not carry', () => {
    const on = moduleIds([map([...SHARED, ...ON_BUILD])]);
    expect(missingModules('on', on, ON_BUILD)).toEqual([]);
    const renamed = moduleIds([map([...SHARED, 'src/background/presale/index.ts', ...ON_BUILD.slice(1)])]);
    expect(missingModules('on', renamed, ON_BUILD)).toEqual(['on build does not carry src/background/presale/api.ts — renamed or moved? the positive control must name it']);
    expect(missingModules('off', moduleIds([map(['../core/geo/fetch.ts'])]), ['core/geo/fetch.ts'])).toEqual([]);
  });

  it('every ON_BUILD module is one the off build refuses (else its control proves nothing)', () => {
    for (const id of ON_BUILD) expect([id, offModuleViolations(new Set([id])).length]).toEqual([id, 1]);
  });

  it('every BOTH_BUILDS module is one the off build may carry (else the two rules contradict each other)', () => {
    for (const id of BOTH_BUILDS) expect([id, offModuleViolations(new Set([id])).length]).toEqual([id, 0]);
  });
});

describe('wiring', () => {
  it('npm run gates runs the gate once, off build first, and npm run verify runs the gates after building both', () => {
    const {scripts} = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    expect(scripts.gates.split(' && ').filter(c => c.includes('check-no-presale'))).toEqual(['node scripts/check-no-presale.mjs dist-nopresale dist']);
    expect(scripts.verify.split(' && ')).toEqual(expect.arrayContaining(['npm run build', 'npm run gates']));
    expect(scripts.build).toContain('node scripts/build.mjs --no-presale');
  });
});

describe('app.features.json', () => {
  it('must say what its directory is', () => {
    expect(featureViolations('dist-nopresale', {presale: false}, false)).toEqual([]);
    expect(featureViolations('dist', {presale: true}, true)).toEqual([]);
    expect(featureViolations('dist-nopresale', {presale: true}, false)).toHaveLength(1);
    expect(featureViolations('dist', {presale: false}, true)).toHaveLength(1);
    expect(featureViolations('dist', undefined, true)).toHaveLength(1);
    expect(featureViolations('dist', {presale: 'true'}, true)).toHaveLength(1);
    expect(featureViolations('dist', {presale: true, extra: 1}, true)).toHaveLength(1);
  });
});

// §6.2 items 2 and 3: markers stay out of the off build (each found in the on build), what both builds need stays in.
describe('strings', () => {
  const file = (path, text) => ({path, bytes: Buffer.from(text, 'utf8')});

  it('armed by B1d-1b: Task 1 adds its three presale message types (§6.2: "every presale.* message type"), Task 2 its prepare and the intent kind, Task 3 its four sign and resume types, Task 4 #23’s copy, Task 5 #20’s, #10’s and the record words, Task 6 #11’s and #50b’s (Q44’s label "Programs" is one bare word: its value is the marker); B1d-2 Task 1 the record’s message type and alarm, Task 2 the referral address’s type and #10’s referrer row, Task 3 #23a’s referral address (Q45, Q46 b–c, Q48), Task 4 #24’s type, #31’s row and #24’s copy, Task 5 #27’s Q34', () => {
    expect(MARKERS.slice(0, 9)).toEqual(['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy', 'presale.pending', 'presale.preparedFor', 'presale.buy', 'presale.discardPrepared', 'presale-buy']);
    // §6.2's named strings #23 shows, then Q01, Q02, Q04–Q06, Q11–Q16, Q19, Q40c, Q41c, Q41d, Q43, Q52 (each literal part ≥ 8 characters).
    expect(MARKERS.slice(9)).toEqual([
      'NOC presale',
      'YOU RECEIVE (EST.)',
      'Claimable after TGE',
      'Order pending',
      'Not available here',
      ' stage cap',
      ' · 1 SOL ≈ ',
      'Your allocation',
      'Waiting for confirmation. Claimable after TGE.',
      'You can close the popup — Noctura keeps watching this purchase. Funds are non-refundable per presale terms.',
      'Presale unavailable — try again later.',
      'The presale service refused this network.',
      'The presale is not open.',
      "This account can't buy in the presale.",
      'Price changed — review again',
      'The purchase could not be simulated.',
      'SOL price unavailable — pay with USDC or USDT, or try again later.',
      'Above your presale limit — you can buy up to ',
      ' is split across accounts — at most ',
      ' in one purchase',
      'Keep at least 0.00089088 SOL, or buy with less',
      'Your presale account changed — review again',
      'The presale is busy right now — try again.',
      // Task 5: §6.2's route name, then Q07, Q08, §4.2's receive label, Q09, Q10, Q44's two parts, Q57, Q58, Q17, Q18's
      // literal part, Q56, Q32's literal part, Q53, Q54 a and b, Q55.
      'presale-confirm',
      'Confirm purchase',
      'You are about to buy',
      'You receive (est.)',
      'Account setup (first purchase)',
      'Noctura presale',
      'Simulated at slot ',
      'Compute Budget · Noctura presale',
      'You have a purchase waiting.',
      'Confirmed. Review the fresh quote and buy.',
      'Re-auth required for your first presale purchase from this account.',
      'Confirm buying NOC with',
      'Purchase cancelled. Nothing was sent.',
      'Buying NOC with',
      'Buying NOC…',
      'Purchase confirmed',
      'The presale program rejected the purchase. Only the network fee was charged; your payment did not move and no NOC was bought.',
      // Task 6: #11's banner (its literal parts), Q33 a and b, then #50b — the design's lines §4.3 keeps, the approved
      // lines, Q20–Q30 (Q21 whole; Q26 and the approved subs are #50b's and #23's).
      'NOC Presale · Stage ',
      '% to next stage',
      'Buying NOC · pending',
      'Buying NOC · taking longer than usual',
      'NOC presale is open in your region',
      "NOC presale isn't open in your region",
      "The presale can't be opened right now",
      'Detected region: ',
      'Approximated from your IP. No GPS, no device location.',
      'Presale geofence active',
      'Checked by this wallet against the restricted-region list',
      'Region check required',
      'The presale opens only after a successful check against a current list',
      "Noctura's server did not answer requests from this network",
      'Why this matters',
      'Token sales are restricted by jurisdiction · this wallet checks before every purchase',
      'If the restricted-region list changes, this screen lifts on its own.',
      'Re-checked at every presale screen mount.',
      'What still works',
      'Send / Receive NOC',
      'View balances',
      "This wallet doesn't offer the presale in your region. You can still hold, send and receive any NOC you already have.",
      'The restricted-region list is out of date.',
      'Your region could not be determined from your IP.',
      'The region check is unavailable — try again later.',
      // B1d-2 Task 1: the record's message type and its alarm's name.
      'presale.unrecorded',
      'presale-record',
      // B1d-2 Task 2: the referral address's message type, then #10's referrer row (Q47: the label and its note).
      'presale.checkReferrer',
      'Referred by',
      "Saved to your presale account with this purchase. It can't be changed later.",
      'Referral address (optional)',
      'Solana address of the person who invited you',
      "You can't refer yourself or another account in this wallet",
      "This address has no presale allocation, so it can't receive a referral bonus",
      'This account can no longer take a referrer — review again',
      'presale.referral',
      'Refer a friend',
      'total joined',
      'NOC lifetime',
      'from your invites',
      'YOUR INVITE LINK',
      'Not used yet',
      'Used by ',
      'Copy invite link',
      'Share invite link',
      'Earn NOC when friends you invite buy in the presale.',
      'Referral payouts are subject to program terms. Self-referrals are detected and rejected.',
      'Recorded on chain; presale service not yet updated',
    ]);
  });

  // Task 8 (§6.2 item 2): every presale message type the background registers is a marker — read from api.ts, so a type
  // added later without its marker fails here.
  it('every presale.* message type of api.ts is a marker', () => {
    const api = readFileSync(join(ROOT, 'src/background/presale/api.ts'), 'utf8');
    const types = [...(/PRESALE_MESSAGE_TYPES: readonly string\[\] = \[([^\]]*)\]/.exec(api)?.[1] ?? '').matchAll(/'([^']+)'/g)].map(m => m[1]);
    expect(types).toHaveLength(11);
    for (const t of types) expect([t, MARKERS.includes(t)]).toEqual([t, true]);
  });

  it('a marker in any off-build file is a violation; each marker must be found in the on build', () => {
    const markers = ['NOC presale', 'v1_presale_records'];
    const off = [file('app/background.js', 'var a=1;'), file('chrome/assets/x.js', '"Buy in the NOC presale"')];
    const on = [file('app/background.js', '"v1_presale_records"'), file('app/assets/y.js', 'NOC presale')];
    expect(markerViolations(off, on, markers)).toEqual(['off build: chrome/assets/x.js contains the presale marker "NOC presale"']);
    expect(markerViolations([file('app/a.js', 'x')], on, markers)).toEqual([]);
    expect(markerViolations([file('app/a.js', 'x')], [file('app/a.js', 'NOC presale')], markers)).toEqual(['on build: no file contains the presale marker "v1_presale_records" — the marker does not describe the on build']);
  });

  it('refuses a marker shorter than 8 characters (it would match unrelated code)', () => {
    expect(() => markerViolations([], [file('app/a.js', 'presale')], ['presale'])).toThrow(/at least 8/);
  });

  it('refuses a marker that is one bare word — any shared string containing it would read as a leak (review 1 L1); a phrase passes', () => {
    for (const m of ['Purchased', 'Programs']) expect(() => markerViolations([], [file('app/a.js', m)], [m])).toThrow(/one bare word/);
    expect(markerViolations([], [file('app/a.js', 'Purchase confirmed presale-buy')], ['Purchase confirmed', 'presale-buy'])).toEqual([]);
    for (const m of MARKERS) expect([m, /^[A-Za-z]+$/.test(m)]).toEqual([m, false]);
  });

  it('must stay: B1b/B1c presale copy, Q42, F12’s Q49–Q51 and the decoder instruction names are found in the off build', () => {
    // Q42a (B1d §10, both builds): the generic pending row of a record the build cannot show (B1d-1a Task 4). Q42b
    // ("Transaction") is too short to mean anything as a string search; its screens are tested in both vitest runs.
    // B1d-1b Task 7: #48's F12 (D15 — the off build blocks a site's purchase exactly as the on build does).
    const q50a = "This transaction buys NOC in the presale, which this wallet doesn't allow from your region (";
    const q50b = "This transaction buys NOC in the presale. The wallet's region check did not succeed, so it can't be approved — try again later.";
    // B1d-2 Task 1: the presale records' key — a delete in the build without presale still wipes them.
    expect(MUST_STAY).toEqual(['Presale purchase', 'PRESALE PURCHASE', 'Transaction · pending', 'Transaction · taking longer than usual', 'Presale purchase blocked', q50a, q50b, 'Only Reject is available · no override', 'v1_presale_records']);
    const f12 = file('chrome/approve.js', `"Presale purchase blocked",regionSanctioned:e=>\`${q50a}\${e}).\`,regionClosed:${JSON.stringify(q50b)},regionMeta:"Only Reject is available · no override"`);
    const all = [file('app/a.js', '"Presale purchase"'), file('app/b.js', 'PRESALE PURCHASE'), file('app/c.js', '`Transaction · pending`,`Transaction · taking longer than usual`'), f12, file('app/background.js', 'const Y="v1_presale_records";')];
    expect(missingStrings('off', all, MUST_STAY)).toEqual([]);
    expect(missingStrings('off', [file('app/a.js', '"Presale purchase"')], MUST_STAY)).toEqual([
      'off build: no file contains "PRESALE PURCHASE" — the switch stripped what both builds need',
      'off build: no file contains "Transaction · pending" — the switch stripped what both builds need',
      'off build: no file contains "Transaction · taking longer than usual" — the switch stripped what both builds need',
      'off build: no file contains "Presale purchase blocked" — the switch stripped what both builds need',
      `off build: no file contains ${JSON.stringify(q50a)} — the switch stripped what both builds need`,
      `off build: no file contains ${JSON.stringify(q50b)} — the switch stripped what both builds need`,
      'off build: no file contains "Only Reject is available · no override" — the switch stripped what both builds need',
      'off build: no file contains "v1_presale_records" — the switch stripped what both builds need',
    ]);
  });

  it('the decoder names are read from presaleIdl.ts exactly as the module exports them', () => {
    const names = decoderInstructionNames(readFileSync(join(ROOT, 'src/background/dapp/decode/presaleIdl.ts'), 'utf8'));
    expect(names).toEqual(PRESALE_INSTRUCTIONS.map(i => i.name));
    expect(names).toContain('presale_purchase_with_sol');
    expect(decoderInstructionNames('export const X = 1;')).toEqual([]);
  });

  it('no marker overlaps a string that must stay', () => {
    for (const m of MARKERS) for (const s of MUST_STAY) expect([m, s, m.includes(s) || s.includes(m)]).toEqual([m, s, false]);
  });
});

// The whole gate over two directories, as `npm run gates` runs it — synthetic builds, each rule's red and green.
describe('checkNoPresale(offDir, onDir)', () => {
  let tmp;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'no-presale-'));
  });
  afterEach(() => rmSync(tmp, {recursive: true, force: true}));

  const ON_TEXT = MARKERS.map(m => JSON.stringify(m)).join(';');
  const STAY_TEXT = MUST_STAY.map(m => JSON.stringify(m)).join(';');
  const IDL = "{name: 'presale_purchase_with_sol', discriminator: [1]}, {name: 'register_referrer', discriminator: [2]}";
  const write = (dir, {presale, modules, text}) => {
    mkdirSync(join(tmp, dir), {recursive: true});
    writeFileSync(join(tmp, dir, 'app.features.json'), `${JSON.stringify({presale})}\n`);
    writeFileSync(join(tmp, dir, 'app.modules.json'), JSON.stringify(map(modules)));
    writeFileSync(join(tmp, dir, 'app.relay.modules.json'), JSON.stringify({chunks: {'relay.js': ['src/relay/index.ts']}}));
    for (const p of ['app', 'chrome', 'firefox']) {
      mkdirSync(join(tmp, dir, p, 'assets'), {recursive: true});
      writeFileSync(join(tmp, dir, p, 'background.js'), `${STAY_TEXT};"presale_purchase_with_sol";"register_referrer";${text}`);
    }
  };
  const good = () => {
    write('off', {presale: false, modules: [...SHARED, 'src/presale-off/background.ts'], text: ''});
    write('on', {presale: true, modules: [...SHARED, ...ON_BUILD], text: ON_TEXT});
  };
  const run = (o = {}) => checkNoPresale(join(tmp, 'off'), join(tmp, 'on'), {decoderSource: IDL, ...o});

  it('passes on a clean pair (positive control)', () => {
    good();
    expect(run()).toEqual([]);
  });

  it('fails when a presale module leaks into the off build — in any module map', () => {
    good();
    writeFileSync(join(tmp, 'off', 'app.relay.modules.json'), JSON.stringify({chunks: {'relay.js': ['src/relay/index.ts', '../core/presale/limits.ts']}}));
    expect(run()).toEqual([expect.stringMatching(/^off build carries core\/presale\/limits\.ts /)]);
  });

  it('fails when the on build lacks a positive-control module', () => {
    good();
    write('on', {presale: true, modules: [...SHARED, ...ON_BUILD.slice(1)], text: ON_TEXT});
    expect(run()).toEqual(['on build does not carry src/background/presale/api.ts — renamed or moved? the positive control must name it']);
  });

  it('fails when a marker is in the off build, in chrome/ or firefox/ alone too', () => {
    good();
    write('on', {presale: true, modules: [...SHARED, ...ON_BUILD], text: '"YOU RECEIVE (EST.)"'});
    expect(run({markers: ['YOU RECEIVE (EST.)']})).toEqual([]);
    writeFileSync(join(tmp, 'off', 'firefox', 'assets', 'p.js'), '"YOU RECEIVE (EST.)"');
    expect(run({markers: ['YOU RECEIVE (EST.)']})).toEqual(['off build: firefox/assets/p.js contains the presale marker "YOU RECEIVE (EST.)"']);
  });

  it('fails when a must-stay string or a decoder name is missing from the off build', () => {
    good();
    writeFileSync(join(tmp, 'off', 'app', 'background.js'), `${STAY_TEXT};"presale_purchase_with_sol"`);
    for (const p of ['chrome', 'firefox']) rmSync(join(tmp, 'off', p, 'background.js'));
    expect(run()).toEqual(['off build: no file contains "register_referrer" — the switch stripped what both builds need']);
  });

  it('is INCONCLUSIVE without the decoder names, a module map, a package directory or app.features.json — and with the directories swapped it fails', () => {
    good();
    expect(run({decoderSource: ''})).toEqual(['INCONCLUSIVE: no instruction names read from src/background/dapp/decode/presaleIdl.ts']);
    rmSync(join(tmp, 'off', 'app.modules.json'));
    expect(run()).toEqual([expect.stringMatching(/^INCONCLUSIVE: .*off.*app\.modules\.json/)]);
    good();
    rmSync(join(tmp, 'on', 'firefox'), {recursive: true});
    expect(run()).toEqual([expect.stringMatching(/^INCONCLUSIVE: .*on.*firefox/)]);
    good();
    rmSync(join(tmp, 'off', 'app.features.json'));
    expect(run()).toHaveLength(1);
    good();
    expect(checkNoPresale(join(tmp, 'on'), join(tmp, 'off'), {decoderSource: IDL}).length).toBeGreaterThan(2);
  });
});

// Fix round 1 (review I2): the CLI guard must actually run the gate, at any checkout path. The old
// `import.meta.url === \`file://${process.argv[1]}\`` compares a percent-encoded left side against a
// never-encoded right side, so it silently takes the else branch (prints nothing, exits 0) once the path contains
// a space or another reserved character — `npm run gates` would then report this gate green without it having
// run. `isMain` (pathToFileURL(argv[1]).href) must not have that hole, proven here by spawning the real CLI, not
// by calling checkNoPresale() in-process.
describe('the CLI, spawned as a real node process', () => {
  let tmp;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'no-presale-cli-'));
  });
  afterEach(() => rmSync(tmp, {recursive: true, force: true}));

  const DECODER_NAMES = PRESALE_INSTRUCTIONS.map(i => i.name);
  const writeCliBuild = (dir, {presale, modules}) => {
    mkdirSync(dir, {recursive: true});
    writeFileSync(join(dir, 'app.features.json'), `${JSON.stringify({presale})}\n`);
    writeFileSync(join(dir, 'app.modules.json'), JSON.stringify(map(modules)));
    const text = [...MUST_STAY, ...DECODER_NAMES, ...(presale ? MARKERS : [])].map(s => JSON.stringify(s)).join(';');
    for (const p of ['app', 'chrome', 'firefox']) {
      mkdirSync(join(dir, p), {recursive: true});
      writeFileSync(join(dir, p, 'background.js'), text);
    }
  };
  const buildGoodPair = () => {
    const off = join(tmp, 'off');
    const on = join(tmp, 'on');
    writeCliBuild(off, {presale: false, modules: [...SHARED, 'src/presale-off/background.ts']});
    writeCliBuild(on, {presale: true, modules: [...SHARED, ...ON_BUILD]});
    return {off, on};
  };
  const runCli = (scriptPath, args) => {
    try {
      return {status: 0, stdout: execFileSync('node', [scriptPath, ...args], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']})};
    } catch (e) {
      return {status: e.status, stdout: e.stdout ?? '', stderr: e.stderr ?? ''};
    }
  };
  // The real CLI's decoder read and must-stay check use the real presaleIdl.ts and the real on-repo path; only
  // scripts/check-no-presale.mjs, scripts/isMain.mjs and the decoder source need to exist at the copy.
  const copyToSpacePath = () => {
    const spaceDir = join(tmp, 'a directory with a space');
    mkdirSync(join(spaceDir, 'scripts'), {recursive: true});
    mkdirSync(join(spaceDir, 'src/background/dapp/decode'), {recursive: true});
    cpSync(join(ROOT, 'scripts/check-no-presale.mjs'), join(spaceDir, 'scripts/check-no-presale.mjs'));
    cpSync(join(ROOT, 'scripts/isMain.mjs'), join(spaceDir, 'scripts/isMain.mjs'));
    cpSync(join(ROOT, 'src/background/dapp/decode/presaleIdl.ts'), join(spaceDir, 'src/background/dapp/decode/presaleIdl.ts'));
    return join(spaceDir, 'scripts/check-no-presale.mjs');
  };

  it.each([
    ['its normal repository path', () => join(ROOT, 'scripts/check-no-presale.mjs')],
    ['a path containing a space (review I2)', copyToSpacePath],
  ])('passes a good pair (exit 0, the ok line) and fails a swapped one (exit 1), run from %s', (_label, scriptPathFor) => {
    const scriptPath = scriptPathFor();
    const {off, on} = buildGoodPair();
    const good = runCli(scriptPath, [off, on]);
    expect(good.status).toBe(0);
    expect(good.stdout).toMatch(/^no presale ok \(/);
    const swapped = runCli(scriptPath, [on, off]);
    expect(swapped.status).toBe(1);
  });
});

// Fix round 1 (review I2): every gate that has this CLI main-guard imports the shared helper — a gate whose guard
// never fires passes `npm run gates` without having run at all.
describe('every gate with a CLI main-guard imports isMain', () => {
  const GATE_FILES = [
    'check-no-presale.mjs',
    'check-classes.mjs',
    'check-fonts.mjs',
    'check-no-tge-date.mjs',
    'check-page-bundles.mjs',
    'check-permissions.mjs',
    'check-rpc-methods.mjs',
    'check-vault-isolation.mjs',
  ];

  it.each(GATE_FILES)('%s imports isMain from ./isMain.mjs and guards on isMain(import.meta.url)', file => {
    const source = readFileSync(join(ROOT, 'scripts', file), 'utf8');
    expect(source).toMatch(/import \{isMain\} from '\.\/isMain\.mjs';/);
    expect(source).toMatch(/if \(isMain\(import\.meta\.url\)\) \{/);
    expect(source).not.toMatch(/file:\/\/\$\{process\.argv\[1\]\}/);
  });
});
