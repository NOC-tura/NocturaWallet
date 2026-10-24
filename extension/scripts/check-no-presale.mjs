#!/usr/bin/env node
// B1d §6.2 (C38, D15): the off-build gate — `node scripts/check-no-presale.mjs <offDir> <onDir>` (npm run gates:
// dist-nopresale dist). Each directory's app.features.json must say what it is. Then three rules, each with its control:
//  1. Modules: the off build's module maps (every *.modules.json next to its packages) carry nothing under
//     src/background/presale/, src/app/presale/, src/unlock/presale.ts or core/referral/, and of core/presale/ only
//     CORE_PRESALE_ALLOWED; core/geo/ is allowed whole (D15). Of ../web/ (fix round 1, review I1) only WEB_ALLOWED —
//     web/src/presale/** imports only erased core/presale types, so a denylist would miss it; only an allowlist closes
//     it, same as core/presale/. Positive control: the on build carries every ON_BUILD module and both carry every
//     BOTH_BUILDS module, so a renamed or moved module fails instead of passing silently.
//     The maps are the evidence, not the packages: the two packages were byte-identical through B1d-1a's Task 4; from
//     Task 5 the on build carries the presale background modules, so the maps — not the files — remain the evidence.
//  2. Strings: no file of the off build's app/, chrome/, firefox/ contains a MARKER; each marker is found in the on build.
//  3. Must stay: B1b/B1c's presale copy and the decoder's instruction names are found in the off build.
// ON_BUILD, BOTH_BUILDS, MARKERS and MUST_STAY are staged per plan (review 2 M2): each plan extends them, never loosens them.
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isMain} from './isMain.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES = ['app', 'chrome', 'firefox'];
const DECODER = 'src/background/dapp/decode/presaleIdl.ts';

export const OFF_FORBIDDEN = ['src/background/presale/', 'src/app/presale/', 'src/unlock/presale.ts', 'core/referral/'];
export const CORE_PRESALE_ALLOWED = ['core/presale/addresses.ts', 'core/presale/allocation.ts', 'core/presale/stagePrices.ts'];
// Fix round 1 (review I1): of `../web/`, only its shared UI and stylesheets — never `web/src/presale/**`, whose
// modules can import nothing but erased `core/presale` types and so are never caught by rule 1's other branches.
export const WEB_ALLOWED = ['../web/src/ui/', '../web/src/styles/'];

// B1d-1a: the three on-path entries (§1.1), the program state presale/{layouts,state}.ts and core/presale/limits.ts
// (§2.1); 1b adds presale/quote.ts (Task 1), presale/buy.ts (Task 2), #23's popup modules (Task 4) and #20's purchase
// variant with the record slot (Task 5); B1d-2 adds presale/{record,referral}.ts and core/referral/index.ts.
export const ON_BUILD = [
  'src/background/presale/api.ts',
  'src/app/presale/index.ts',
  'src/unlock/presale.ts',
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
];
// The intent-kind registry (C19 — both builds sign and read through it); the jurisdiction gate and its fetcher (D15:
// the off build did not lose the gate); the country's name #48's F12 banner shows (B1d-1b Task 7, §3.6).
export const BOTH_BUILDS = ['src/background/intents.ts', 'src/background/geo/gate.ts', 'core/geo/fetch.ts', 'src/app/ui/regionName.ts'];
// Armed by B1d-1b (1a shipped none — Q42 is "both"): Task 1's three presale message types (§6.2: "every presale.*
// message type"), Task 2's prepare and the purchase's intent kind, Task 3's four sign and resume types, Task 4's #23
// copy (§6.2's named strings and the §10 rows #23 shows whose source is new / approved and whose build is on — each
// literal part of 8 characters or more), Task 5's route and the copy of #20's purchase variant, #10's description and
// the record words of #21, #44 and #54 (Q31 "Presale" is shorter than a marker; Q54a "Purchased" is one ordinary word,
// so Q54 is armed by "Purchase confirmed"), Task 6's #11 banner, pending row and #50b; later tasks add theirs. A marker
// is never one bare word (review 1 L1): a shared string that merely contains it would fail the off build as a leak that
// is not one.
export const MARKERS = [
  'presale.view',
  'presale.banner',
  'presale.quote',
  'presale.prepareBuy',
  'presale.pending',
  'presale.preparedFor',
  'presale.buy',
  'presale.discardPrepared',
  'presale-buy',
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
  'Buying NOC with ',
  'Buying NOC…',
  'Purchase confirmed',
  'The presale program returned an error. The network fee was charged; no NOC was bought.',
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
];
// Q42a (B1d-1a: the generic pending row, both builds); 1b adds F12's Q49–Q51. Q42b ("Transaction") is too short to
// be a string search. The decoder's instruction names are read from its source (DECODER).
// B1d-1b Task 7: #48's F12 copy, Q49–Q51 (§6.2 item 3 — "both"; Q50a's literal part before its country).
export const MUST_STAY = [
  'Presale purchase',
  'PRESALE PURCHASE',
  'Transaction · pending',
  'Transaction · taking longer than usual',
  'Presale purchase blocked',
  "This transaction buys NOC in the presale, which this wallet doesn't allow from your region (",
  "This transaction buys NOC in the presale. The wallet's region check did not succeed, so it can't be approved — try again later.",
  'Only Reject is available · no override',
];

const MIN_MARKER = 8;
const BARE_WORD = /^[A-Za-z]+$/;

/** A module id as the maps write it (package-relative: `../core/…`), without query or hash, rooted at the repository's `core/`. */
const normalize = id => String(id).replace(/[?#].*$/, '').replace(/^\.\.\/(?=core\/)/, '');

/** Every module of the given parsed module maps; throws INCONCLUSIVE when there is none to read, or a chunk's module list is not an array (a string is iterable character by character and would otherwise pass silently). */
export function moduleIds(maps) {
  const out = new Set();
  for (const m of maps) {
    if (m === null || typeof m !== 'object' || m.chunks === null || typeof m.chunks !== 'object') throw new Error('INCONCLUSIVE: a module map has no chunks');
    for (const ids of Object.values(m.chunks)) {
      if (!Array.isArray(ids)) throw new Error(`INCONCLUSIVE: a chunk's module list is not an array (${JSON.stringify(ids)})`);
      for (const id of ids) out.add(normalize(id));
    }
  }
  if (out.size === 0) throw new Error('INCONCLUSIVE: the module maps carry no module');
  return out;
}

/** §6.2 item 1: every module the off build may not carry. */
export function offModuleViolations(ids) {
  const out = [];
  for (const id of [...ids].sort()) {
    if (OFF_FORBIDDEN.some(f => (f.endsWith('/') ? id.startsWith(f) : id === f))) out.push(`off build carries ${id} — a presale module (${OFF_FORBIDDEN.join(', ')})`);
    else if (id.startsWith('core/presale/') && !CORE_PRESALE_ALLOWED.includes(id)) out.push(`off build carries ${id} — of core/presale/ it may carry only ${CORE_PRESALE_ALLOWED.join(', ')}`);
    else if (id.startsWith('../web/') && !WEB_ALLOWED.some(w => id.startsWith(w))) out.push(`off build carries ${id} — of ../web/ it may carry only ${WEB_ALLOWED.join(', ')}`);
  }
  return out;
}

export function missingModules(build, ids, required) {
  return required.filter(id => !ids.has(id)).map(id => `${build} build does not carry ${id} — renamed or moved? the positive control must name it`);
}

export function featureViolations(dir, features, presale) {
  const ok = features !== null && typeof features === 'object' && Object.keys(features).length === 1 && features.presale === presale;
  return ok ? [] : [`${dir}/app.features.json must be {"presale":${presale}} — the directory is not the build the gate reads it as`];
}

/** §6.2 item 2: `files` are {path, bytes}; a marker in an off-build file is a violation, a marker in no on-build file too. */
export function markerViolations(offFiles, onFiles, markers) {
  for (const m of markers) if (m.length < MIN_MARKER) throw new Error(`a marker must be at least ${MIN_MARKER} characters (${JSON.stringify(m)})`);
  for (const m of markers) if (BARE_WORD.test(m)) throw new Error(`a marker must not be one bare word (${JSON.stringify(m)}) — arm the string by a longer part`);
  const out = [];
  for (const m of markers) {
    const b = Buffer.from(m, 'utf8');
    for (const f of offFiles) if (f.bytes.includes(b)) out.push(`off build: ${f.path} contains the presale marker ${JSON.stringify(m)}`);
    if (!onFiles.some(f => f.bytes.includes(b))) out.push(`on build: no file contains the presale marker ${JSON.stringify(m)} — the marker does not describe the on build`);
  }
  return out;
}

/** §6.2 item 3. */
export function missingStrings(build, files, strings) {
  return strings
    .filter(s => !files.some(f => f.bytes.includes(Buffer.from(s, 'utf8'))))
    .map(s => `${build} build: no file contains ${JSON.stringify(s)} — the switch stripped what both builds need`);
}

/** The names of PRESALE_INSTRUCTIONS, read from the decoder's source (the table is generated, one `{name: '…', discriminator:` per row). */
export function decoderInstructionNames(source) {
  return [...source.matchAll(/\{name: '(\w+)', discriminator:/g)].map(m => m[1]);
}

const filesUnder = (dir, base = dir) =>
  readdirSync(dir, {withFileTypes: true}).flatMap(e =>
    e.isDirectory() ? filesUnder(join(dir, e.name), base) : [{path: relative(base, join(dir, e.name)).split(sep).join('/'), bytes: readFileSync(join(dir, e.name))}],
  );

/** Reads one build directory: its features, its module ids, its packages' files — each `problems` entry INCONCLUSIVE. */
function readBuild(dir, label) {
  const problems = [];
  const featuresFile = join(dir, 'app.features.json');
  const features = existsSync(featuresFile) ? JSON.parse(readFileSync(featuresFile, 'utf8')) : undefined;
  let ids;
  if (!existsSync(join(dir, 'app.modules.json'))) problems.push(`INCONCLUSIVE: the ${label} build ${dir} has no app.modules.json`);
  else {
    try {
      ids = moduleIds(
        readdirSync(dir)
          .filter(f => f.endsWith('.modules.json'))
          .sort()
          .map(f => JSON.parse(readFileSync(join(dir, f), 'utf8'))),
      );
    } catch (e) {
      problems.push(`${e.message} (${label} build ${dir})`);
    }
  }
  const missing = PACKAGES.filter(p => !existsSync(join(dir, p)));
  if (missing.length > 0) problems.push(`INCONCLUSIVE: the ${label} build ${dir} has no ${missing.join(', ')}`);
  const files = missing.length > 0 ? undefined : PACKAGES.flatMap(p => filesUnder(join(dir, p), dir));
  return {features, ids, files, problems};
}

export function checkNoPresale(offDir, onDir, o = {}) {
  const {markers = MARKERS, mustStay = MUST_STAY, onBuild = ON_BUILD, bothBuilds = BOTH_BUILDS} = o;
  const decoderSource = o.decoderSource ?? readFileSync(join(ROOT, DECODER), 'utf8');
  const off = readBuild(offDir, 'off');
  const on = readBuild(onDir, 'on');
  const out = [...off.problems, ...on.problems];
  out.push(...featureViolations(offDir, off.features, false), ...featureViolations(onDir, on.features, true));
  if (off.ids !== undefined) out.push(...offModuleViolations(off.ids), ...missingModules('off', off.ids, bothBuilds));
  if (on.ids !== undefined) out.push(...missingModules('on', on.ids, [...onBuild, ...bothBuilds]));
  const names = decoderInstructionNames(decoderSource);
  if (names.length === 0) out.push(`INCONCLUSIVE: no instruction names read from ${DECODER}`);
  if (off.files !== undefined && on.files !== undefined) out.push(...markerViolations(off.files, on.files, markers));
  if (off.files !== undefined) out.push(...missingStrings('off', off.files, [...mustStay, ...names]));
  return out;
}

if (isMain(import.meta.url)) {
  const [offArg, onArg] = process.argv.slice(2);
  if (offArg === undefined || onArg === undefined) {
    console.error('usage: node scripts/check-no-presale.mjs <offDir> <onDir>');
    process.exit(1);
  }
  const problems = checkNoPresale(resolve(ROOT, offArg), resolve(ROOT, onArg));
  if (problems.length > 0) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }
  console.log(
    `no presale ok (${offArg} off, ${onArg} on): the off build's module maps carry no presale module and of core/presale/ only ${CORE_PRESALE_ALLOWED.length} allowed; the on build carries ${ON_BUILD.length + BOTH_BUILDS.length} required modules; ${MARKERS.length} markers (none in the off build, each in the on build); ${MUST_STAY.length} strings and the decoder's instruction names stay in the off build`,
  );
}
