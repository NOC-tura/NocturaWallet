const {packagesFromSourcemap, shippedAdvisories} = require('../audit-shipped');

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
      'bigint-buffer': {severity: 'high', via: [{title: 'Buffer Overflow via toBigIntLE'}], fixAvailable: true},
      metro: {severity: 'high', via: ['metro-config'], fixAvailable: true},
      'some-lib': {severity: 'low', via: [{title: 'minor thing'}], fixAvailable: false},
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
});
