const {packagesFromSourcemap, shippedAdvisories, transitiveOnly} = require('../audit-shipped');

/**
 * The gate exists because `npm audit --omit=dev` answers the wrong question for a
 * React Native app. Both halves are tested in both directions: a shipped package's
 * advisory must be reported, and an identical advisory for a package that only builds
 * the app must not be — otherwise the gate is either blind or permanently red.
 */
describe('packagesFromSourcemap', () => {
  it('finds scoped and unscoped packages', () => {
    const s = packagesFromSourcemap([
      'node_modules/@solana/web3.js/lib/index.js',
      'node_modules/bs58/index.js',
    ]);
    expect([...s].sort()).toEqual(['@solana/web3.js', 'bs58']);
  });

  it('attributes a nested install to the innermost package — that is whose code ships', () => {
    const s = packagesFromSourcemap([
      'node_modules/@solana/web3.js/node_modules/@solana/codecs-numbers/dist/index.native.mjs',
    ]);
    expect([...s]).toEqual(['@solana/codecs-numbers']);
  });

  it('ignores our own source (negative control)', () => {
    expect(packagesFromSourcemap(['src/modules/presale/presaleBuyModule.ts', 'index.js']).size).toBe(0);
  });

  it('survives an empty or malformed sources list', () => {
    expect(packagesFromSourcemap([]).size).toBe(0);
    expect(packagesFromSourcemap(undefined).size).toBe(0);
    expect(packagesFromSourcemap([null, 42, 'node_modules/']).size).toBe(0);
  });
});

describe('shippedAdvisories', () => {
  const audit = {
    vulnerabilities: {
      'bigint-buffer': {
        severity: 'high',
        via: [{source: 1, name: 'bigint-buffer', title: 'Buffer Overflow via toBigIntLE', severity: 'high'}],
        fixAvailable: true,
      },
      metro: {severity: 'high', via: ['metro-config'], fixAvailable: true},
      'some-lib': {
        severity: 'low',
        via: [{source: 2, name: 'some-lib', title: 'minor thing', severity: 'low'}],
        fixAvailable: false,
      },
    },
  };
  const shipped = new Set(['bigint-buffer', 'some-lib']);

  it('reports an advisory in a package that ships', () => {
    const hits = shippedAdvisories(audit, shipped, 'high');
    expect(hits.map(h => h.name)).toEqual(['bigint-buffer']);
    expect(hits[0].title).toMatch(/toBigIntLE/);
  });

  it('does NOT report the build toolchain — metro is high, and never runs on a phone', () => {
    expect(shippedAdvisories(audit, shipped, 'high').map(h => h.name)).not.toContain('metro');
  });

  it('respects the threshold in both directions', () => {
    expect(shippedAdvisories(audit, shipped, 'high').map(h => h.name)).not.toContain('some-lib');
    expect(shippedAdvisories(audit, shipped, 'low').map(h => h.name)).toContain('some-lib');
  });

  it('is empty when nothing shipped is affected (positive control — the gate can pass)', () => {
    expect(shippedAdvisories(audit, new Set(['react']), 'high')).toEqual([]);
  });

  it('refuses an unknown severity rather than silently passing everything', () => {
    expect(() => shippedAdvisories(audit, shipped, 'catastrophic')).toThrow(/unknown severity/);
  });

  it('reports a high carried by an advisory object that names its package even under another key', () => {
    // npm keys an entry by package and names the carrier in the object; they agree in
    // practice, but the object is the authority — it is what the advisory was filed against.
    const odd = {vulnerabilities: {x: {severity: 'high', via: [{source: 9, name: 'bigint-buffer', title: 't', severity: 'high'}]}}};
    expect(shippedAdvisories(odd, shipped, 'high').map(h => h.name)).toEqual(['bigint-buffer']);
  });
});

/**
 * The 2026-10-05 shape, copied from the real `npm audit --json`: react-native is rated
 * high, but its `via` is only package NAMES — the advisories sit on build-time leaves
 * (braces under Metro's micromatch). Counting the parent made a bundler advisory fail the
 * shipped gate, which is the exact noise this gate exists to remove.
 */
describe('transitive ratings', () => {
  const audit = {
    vulnerabilities: {
      'react-native': {
        severity: 'high',
        via: ['@react-native/community-cli-plugin', 'babel-jest', 'jest-environment-node'],
        fixAvailable: false,
      },
      '@react-native/community-cli-plugin': {severity: 'high', via: ['metro'], fixAvailable: false},
      metro: {severity: 'high', via: ['metro-file-map'], fixAvailable: false},
      micromatch: {severity: 'high', via: ['braces'], fixAvailable: false},
      braces: {
        severity: 'high',
        via: [{source: 1240992, name: 'braces', title: 'braces stack-exhaustion DoS', url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm', severity: 'high', range: '<=3.0.3'}],
        fixAvailable: false,
      },
      ws: {
        severity: 'high',
        via: [
          {source: 3, name: 'ws', title: 'a moderate one', severity: 'moderate'},
          {source: 4, name: 'ws', title: 'a high one', severity: 'high'},
        ],
        fixAvailable: true,
      },
      'some-sdk': {severity: 'high', via: ['ws'], fixAvailable: true},
    },
  };

  it('does NOT fail on a shipped package that is vulnerable only through a dependency that does not ship', () => {
    expect(shippedAdvisories(audit, new Set(['react-native']), 'high')).toEqual([]);
  });

  it('still names that package as an info line, with the dependencies that rate it', () => {
    expect(transitiveOnly(audit, new Set(['react-native']), 'high')).toEqual([
      {name: 'react-native', severity: 'high', via: ['@react-native/community-cli-plugin', 'babel-jest', 'jest-environment-node']},
    ]);
  });

  it('FAILS on a vulnerable leaf that ships, even when it is only reached transitively', () => {
    // ws ships only because some-sdk pulls it in; it is the carrier, so it is reported.
    const hits = shippedAdvisories(audit, new Set(['some-sdk', 'ws']), 'high');
    expect(hits.map(h => h.name)).toEqual(['ws']);
    expect(hits[0].title).toBe('a high one');
    // …and the parent that only depends on it is info, not a second failure.
    expect(transitiveOnly(audit, new Set(['some-sdk', 'ws']), 'high').map(p => p.name)).toEqual(['some-sdk']);
  });

  it('fails on braces itself the moment braces ships', () => {
    const hits = shippedAdvisories(audit, new Set(['react-native', 'braces']), 'high');
    expect(hits.map(h => [h.name, h.url])).toEqual([['braces', 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm']]);
  });

  it('judges each advisory at its own severity, not the entry\'s worst-of-all rating', () => {
    expect(shippedAdvisories(audit, new Set(['ws']), 'high').map(h => h.title)).toEqual(['a high one']);
    expect(shippedAdvisories(audit, new Set(['ws']), 'moderate').map(h => h.title).sort()).toEqual(['a high one', 'a moderate one']);
  });
});
