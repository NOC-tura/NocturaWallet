#!/usr/bin/env node
/**
 * Mutation sweep: proves a test would FAIL if the guard it names were removed.
 *
 * A passing test shows the code accepts what it should. Only mutation shows the
 * test would have rejected what it shouldn't — and those are different claims.
 *
 * This file exists because the first sweep of `zkManifest.ts` was run once in a
 * shell and thrown away. Its result ("8 of 9 guards load-bearing") then lived in
 * a code comment and a PR description, reproducible by nobody. That is the
 * unfalsifiable category: not wrong, just impossible for anyone who might
 * disagree to check. A result nobody can re-run is a claim.
 *
 * THREE CONTROLS ON THE SWEEP ITSELF, each earned by a failure:
 *
 *   1. BASELINE GREEN. If the suite is already red, every mutant looks "caught"
 *      for a reason that has nothing to do with it.
 *   2. A NO-OP MUTANT MUST SURVIVE. If a semantically identical edit is reported
 *      as caught, the harness is reacting to noise and its verdicts are worthless.
 *   3. EVERY MUTATION MUST BE PROVEN TO APPLY — asserted by an exact-occurrence
 *      count, not by "the string was found somewhere". An edit that silently did
 *      nothing is indistinguishable from a test that failed to detect it, and it
 *      reports as SURVIVED. Both repos hit this on the same day.
 *
 *      Note the asymmetry, because it says where this control is load-bearing:
 *      for "mutate the input to something bad, assert the tool REJECTS it" a
 *      no-op leaves the input good and the assertion fails — safe by
 *      construction. It is THIS direction — remove the guard, assert the test
 *      now fails — where a no-op is silent.
 *   4. THE SOURCE MUST BE RESTORED BYTE-IDENTICALLY between mutants, verified
 *      rather than intended: otherwise a later mutant runs against already-mutated
 *      source and its verdict concerns a file nobody has read.
 *
 * And the result is a GATE, not a report: `expectedSurvivors` is declared, and any
 * difference fails. Mutation results decay — a guard added without a test, or a
 * reordering that makes one mutant unreachable, changes the set. Silence about
 * that is how a sweep becomes a historical claim instead of a measurement.
 *
 * Usage:  node scripts/mutation-sweep.mjs [target]
 */
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';

/**
 * A survivor is not automatically a failure. It is a failure unless it is
 * declared here WITH a reason, so that "no test covers this" and "no test CAN
 * cover this" stay distinguishable — the local form of N/A-BY-CONSTRUCTION.
 */
const TARGETS = {
  zkManifest: {
    file: 'src/modules/shielded/zkManifest.ts',
    testPattern: 'zkManifest.test',
    noop: [
      'const seen = new Set<string>();',
      'const seen: Set<string> = new Set<string>();',
    ],
    mutants: {
      schema: ['if (raw.schema !== ZK_MANIFEST_SCHEMA) {', 'if (false) {'],
      'cases-present': [
        'if (!Array.isArray(raw.cases) || raw.cases.length === 0) {',
        'if (!Array.isArray(raw.cases)) {',
      ],
      count: ['if (declared !== cases.length) {', 'if (false) {'],
      uniqueness: ['if (seen.has(c.id)) {', 'if (false) {'],
      'row-ok': ['if (!c.ok) {', 'if (false) {'],
      failing: ['if (summary.failing !== 0) {', 'if (false) {'],
      'row-absent': ['if (matches.length === 0) {', 'if (false) {'],
      'row-duplicate': ['if (matches.length > 1) {', 'if (false) {'],
      'row-status': ["if (matches[0].status !== 'MUT-VERIFIED') {", 'if (false) {'],
    },
    expectedSurvivors: {
      'row-duplicate':
        'Unreachable from the public API: the uniqueness check runs first and rejects ' +
        'an ambiguous id before this is consulted. Deliberate redundancy for the case ' +
        'where uniqueness is one day removed — removing it already fails three tests.',
    },
  },

  // The MerkleTree account is parsed at a HARDCODED byte offset, and the A0
  // program change will alter that layout. These two guards exist to break at
  // that moment rather than mis-parse: without them a longer or reordered
  // account returns 64 entirely plausible 32-byte values read from the wrong
  // place, and the failure surfaces downstream as "our root is not in the ring".
  merkleSyncAccountGuards: {
    file: 'src/modules/shielded/merkleSync.ts',
    testPattern: 'merkleSync.test',
    noop: ['const roots: string[] = [];', 'const roots: Array<string> = [];'],
    mutants: {
      discriminator: [
        'if (data.length < 8 || disc !== MERKLE_TREE_DISCRIMINATOR) {',
        'if (false) {',
      ],
      'exact-size': ['if (data.length !== MERKLE_TREE_SIZE) {', 'if (false) {'],
    },
    expectedSurvivors: {},
  },
};

/**
 * CONTROL 4 (the coordinator's, adopted): restoring in a `finally` is an
 * intention, not a fact. If a restore ever wrote something subtly different, the
 * next mutant would be applied to already-mutated source and every verdict after
 * it would concern a file nobody has read. Verified byte-for-byte instead.
 */
const restoreVerified = (file, original) => {
  writeFileSync(file, original);
  if (readFileSync(file, 'utf8') !== original) {
    throw new Error(
      `${file} was NOT restored byte-identically — every later verdict would concern a file nobody has read`,
    );
  }
};

const runTests = pattern => {
  try {
    execFileSync('npx', ['jest', `--testPathPattern=${pattern}`, '--silent'], {
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
};

const occurrences = (haystack, needle) => haystack.split(needle).length - 1;

function sweep(name, t) {
  const original = readFileSync(t.file, 'utf8');
  const restore = () => restoreVerified(t.file, original);

  try {
    process.stdout.write(`baseline… `);
    if (!runTests(t.testPattern)) {
      throw new Error(
        'the suite is RED before any mutation. Every mutant would look caught for an unrelated reason.',
      );
    }
    console.log('green');

    process.stdout.write('no-op mutant (must SURVIVE)… ');
    const [from, to] = t.noop;
    if (occurrences(original, from) !== 1) {
      throw new Error(`the no-op anchor occurs ${occurrences(original, from)} times, expected exactly 1`);
    }
    writeFileSync(t.file, original.replace(from, to));
    const noopSurvived = runTests(t.testPattern);
    restore();
    if (!noopSurvived) {
      throw new Error(
        'a semantically identical edit was reported as CAUGHT. The harness is reacting to noise; no verdict below can be trusted.',
      );
    }
    console.log('survived\n');

    const survivors = [];
    for (const [mutant, [a, b]] of Object.entries(t.mutants)) {
      // CONTROL 3: prove the edit applies, and applies to exactly one place.
      // A replacement that matched nothing reports as SURVIVED and looks like a
      // test that failed to detect. A replacement matching several places mutates
      // an arbitrary one.
      const n = occurrences(original, a);
      if (n !== 1) {
        throw new Error(
          `mutant '${mutant}' anchors on a string occurring ${n} times, expected exactly 1 — ` +
            'the mutation would not have applied, or would have applied somewhere unintended.',
        );
      }
      writeFileSync(t.file, original.replace(a, b));
      const caught = !runTests(t.testPattern);
      restore();
      console.log(`  ${mutant.padEnd(16)} ${caught ? 'CAUGHT' : 'SURVIVED'}`);
      if (!caught) survivors.push(mutant);
    }

    const expected = Object.keys(t.expectedSurvivors).sort();
    const actual = survivors.sort();
    const unexpected = actual.filter(s => !expected.includes(s));
    const missing = expected.filter(s => !actual.includes(s));

    console.log();
    for (const [s, why] of Object.entries(t.expectedSurvivors)) {
      console.log(`  declared survivor '${s}': ${why}`);
    }
    if (unexpected.length) {
      console.error(
        `\n${name}: ${unexpected.join(', ')} survived without being declared — ` +
          'no test proves the guard does anything. Add a test, or declare it with a reason.',
      );
      return false;
    }
    if (missing.length) {
      console.error(
        `\n${name}: ${missing.join(', ')} was declared a survivor but is now CAUGHT. ` +
          'Good news, but the declaration is stale — remove it so the next reader is not misled.',
      );
      return false;
    }
    console.log(
      `\n${name}: ${Object.keys(t.mutants).length - actual.length} of ${
        Object.keys(t.mutants).length
      } guards demonstrated load-bearing; ${actual.length} declared unreachable.`,
    );
    return true;
  } finally {
    restore();
  }
}

const only = process.argv[2];
let ok = true;
for (const [name, t] of Object.entries(TARGETS)) {
  if (only && only !== name) continue;
  console.log(`\n── ${name} (${t.file})\n`);
  if (!sweep(name, t)) ok = false;
}
process.exit(ok ? 0 : 1);
