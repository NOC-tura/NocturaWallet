import {createHash} from 'crypto';
import {readFileSync} from 'fs';
import {join} from 'path';

import {
  REQUIRED_MUT_VERIFIED,
  validateZkManifest,
  ZkManifestError,
} from '../zkManifest';

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf8'));

/** A well-formed manifest: the deployed one with the duplicate id disambiguated. */
const wellFormed = (): Record<string, unknown> =>
  fixture('negative-test-manifest.wellformed.json') as Record<string, unknown>;

type Case = {id: string; kind: string; status: string | null; ok: boolean; name: string; circuit: string};
const casesOf = (m: Record<string, unknown>): Case[] => m.cases as Case[];

describe('validateZkManifest — integrity, before any row is trusted', () => {
  it('accepts a well-formed manifest', () => {
    expect(() => validateZkManifest(wellFormed())).not.toThrow();
  });

  it('rejects a non-object', () => {
    expect(() => validateZkManifest(null)).toThrow(ZkManifestError);
    expect(() => validateZkManifest('{}')).toThrow(ZkManifestError);
  });

  it('rejects an unknown schema — a v2 manifest must not be read as v1', () => {
    const m = wellFormed();
    m.schema = 'noctura.zk.negative-test-manifest/2';
    expect(() => validateZkManifest(m)).toThrow(/schema/i);
  });

  it('rejects when cases.length disagrees with summary.byKind — a truncated download', () => {
    const m = wellFormed();
    m.cases = casesOf(m).slice(0, -1);
    expect(() => validateZkManifest(m)).toThrow(/case count/i);
  });

  it('rejects duplicate ids — they would silently collapse a by-id lookup', () => {
    const m = wellFormed();
    const cs = casesOf(m);
    cs[1].id = cs[0].id;
    expect(() => validateZkManifest(m)).toThrow(/duplicate/i);
  });

  it('rejects an empty case list', () => {
    const m = wellFormed();
    m.cases = [];
    (m.summary as {byKind: Record<string, number>}).byKind = {};
    // Asserting the MESSAGE, not merely that it throws: with byKind emptied to
    // match, an empty list would otherwise fall through and fail later on a
    // missing required row, and the guard under test would go unexercised.
    expect(() => validateZkManifest(m)).toThrow(/no cases/i);
  });

  it('rejects a case whose own ok flag is false, even when summary.failing says 0', () => {
    const m = wellFormed();
    casesOf(m)[3].ok = false;
    expect(() => validateZkManifest(m)).toThrow(/not ok/i);
  });

  it('rejects summary.failing > 0', () => {
    const m = wellFormed();
    (m.summary as {failing: number}).failing = 1;
    expect(() => validateZkManifest(m)).toThrow(/failing/i);
  });
});

describe('validateZkManifest — the constraints the wallet depends on', () => {
  it.each(REQUIRED_MUT_VERIFIED)('rejects when %s is absent', id => {
    const m = wellFormed();
    m.cases = casesOf(m).filter(c => c.id !== id);
    (m.summary as {byKind: Record<string, number>}).byKind = countKinds(casesOf(m));
    expect(() => validateZkManifest(m)).toThrow(new RegExp(id));
  });

  it.each(REQUIRED_MUT_VERIFIED)('rejects when %s stops being MUT-VERIFIED', id => {
    const m = wellFormed();
    const target = casesOf(m).find(c => c.id === id);
    if (!target) throw new Error(`fixture is missing ${id} — the test is not testing what it claims`);
    target.status = 'TOOLING:NO-OP';
    expect(() => validateZkManifest(m)).toThrow(new RegExp(id));
  });

  it('does not accept a required row on the strength of a duplicate id', () => {
    // If the row lookup collapsed duplicates, a second `conservation` row with a
    // good status could mask a first one that regressed. Uniqueness is checked
    // first, so this must be rejected as a duplicate rather than accepted.
    const m = wellFormed();
    const cs = casesOf(m);
    const good = cs.find(c => c.id === 'conservation');
    if (!good) throw new Error('fixture is missing conservation');
    good.status = 'TOOLING:NO-OP';
    cs.push({...good, status: 'MUT-VERIFIED'});
    (m.summary as {byKind: Record<string, number>}).byKind = countKinds(cs);
    expect(() => validateZkManifest(m)).toThrow(/duplicate/i);
  });
});

describe('the manifest actually deployed at api.noc-tura.io', () => {
  // A pinned copy of what the coordinator serves. It is deliberately a SEPARATE
  // file from the well-formed fixture the mutation tests above are built on:
  // that one is ours to hold still, so a case added upstream cannot quietly move
  // the ground under every negative test.
  //
  // History worth keeping: the first deployed manifest used `out_range` as the id
  // of two different cases (25 cases, 24 unique ids), so a by-id gate would have
  // reported on 24 of them and silently dropped a value-minting check. This suite
  // asserted the rejection until the coordinator fixed it; the second case is now
  // `out_range_eliminated` and their generator refuses to emit duplicate ids.
  const DEPLOYED_SHA256 = '220aa4fb0874ada57c955d3772bb85e7e9baf2ba79fee27c783e4e24d76fa041';

  it('is accepted, with every constraint the wallet depends on still MUT-VERIFIED', () => {
    expect(() => validateZkManifest(fixture('negative-test-manifest.deployed.json'))).not.toThrow();
  });

  it('is the artifact we recorded — provenance, not the assertion', () => {
    // Pinning the hash of our OWN copy, so a fixture updated without updating this
    // line fails. Deliberately not a check against the live file: that changes on
    // any upstream line and would make this suite fail on unrelated edits. The
    // live artifact is checked by zkManifest.live.test.ts, on the rows.
    const raw = readFileSync(
      join(__dirname, 'fixtures', 'negative-test-manifest.deployed.json'),
    );
    expect(createHash('sha256').update(raw).digest('hex')).toBe(DEPLOYED_SHA256);
  });

  it('no longer carries the duplicate id it shipped with', () => {
    const ids = casesOf(fixture('negative-test-manifest.deployed.json') as Record<string, unknown>).map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(['out_range', 'out_range_eliminated']));
  });
});

function countKinds(cs: Case[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of cs) out[c.kind] = (out[c.kind] ?? 0) + 1;
  return out;
}
