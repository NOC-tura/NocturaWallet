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
  // Pinned copy of what the coordinator serves today, byte-identical to
  // sha256 41dc8fb8a7b04788e7a51ddbd80c480ba03a3953ed28a13ea8485ffb51e5e48b.
  // It carries a real defect: `out_range` is the id of TWO different cases, so a
  // by-id gate would report on 24 of 25 and silently drop the value-minting one.
  // This test documents that, and will fail loudly when they fix it — at which
  // point the expectation flips to `not.toThrow()`.
  it('is REJECTED, because out_range is used twice', () => {
    expect(() => validateZkManifest(fixture('negative-test-manifest.deployed.json'))).toThrow(
      /duplicate.*out_range/i,
    );
  });

  it('is otherwise identical to the well-formed fixture', () => {
    const deployed = fixture('negative-test-manifest.deployed.json') as Record<string, unknown>;
    const fixed = wellFormed();
    expect(casesOf(deployed).map(c => c.name)).toEqual(casesOf(fixed).map(c => c.name));
    expect(deployed.summary).toEqual(fixed.summary);
  });
});

function countKinds(cs: Case[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of cs) out[c.kind] = (out[c.kind] ?? 0) + 1;
  return out;
}
