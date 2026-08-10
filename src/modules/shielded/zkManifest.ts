/**
 * Validation of the coordinator's negative-test manifest.
 *
 * The manifest records which circuit constraints have been *mutation-verified* —
 * shown to reject a witness that violates them, rather than merely present in the
 * source. It is served from the same base the proving artifacts come from:
 *
 *   https://api.noc-tura.io/api/v1/zk-assets/v1/negative-test-manifest.json
 *
 * Two deliberate choices, both learned the hard way:
 *
 * 1. **We do not gate on the file's hash.** It changes on any line — a new test,
 *    a reordered case, a shifted circom template line number — so a hash gate
 *    would fail on every unrelated coordinator edit and degrade into noise until
 *    someone deleted it. We assert the rows we actually depend on. The hash is
 *    provenance, not the assertion.
 *
 * 2. **Integrity is checked before any row is trusted.** The deployed manifest
 *    uses `out_range` as the id of two different cases, so the obvious
 *    implementation — a Map from id to case — holds 24 entries for 25 cases and
 *    silently drops a value-minting check. A gate that reports on a subset of an
 *    artifact, without saying so, is the defect this file exists to catch.
 */

export const ZK_MANIFEST_SCHEMA = 'noctura.zk.negative-test-manifest/1';

/**
 * The constraints the wallet's own correctness rests on. Each must be present
 * exactly once and mutation-verified.
 *
 * - `nullifier_bind` / `wc_nullifier` — the nullifier is H(TAG_NULL, nk, rho).
 *   The wallet derives it that way; if the circuit stopped enforcing it, a note
 *   could be double-spent under a nullifier of the prover's choosing.
 * - `promote_rho` / `wc_promote_rho` — the output/change rho is derived, not
 *   chosen. A prover-chosen rho breaks the uniqueness the pool relies on.
 * - `promote_change` / `wc_promote_change` — change cannot be redirected to a
 *   foreign addrField, i.e. a relayer cannot steal the change output.
 * - `conservation` — Σin = Σout + fee. Without it, value can be minted.
 */
export const REQUIRED_MUT_VERIFIED = [
  'nullifier_bind',
  'promote_rho',
  'promote_change',
  'conservation',
  'wc_nullifier',
  'wc_promote_change',
  'wc_promote_rho',
] as const;

export interface ZkManifestCase {
  id: string;
  circuit: string;
  kind: string;
  status: string | null;
  ok: boolean;
  name: string;
}

export interface ZkManifest {
  schema: string;
  summary: {
    byKind: Record<string, number>;
    failing: number;
  };
  cases: ZkManifestCase[];
}

export class ZkManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZkManifestError';
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function readCase(v: unknown, index: number): ZkManifestCase {
  if (!isRecord(v)) {
    throw new ZkManifestError(`case ${index} is not an object`);
  }
  const {id, circuit, kind, status, ok, name} = v;
  if (typeof id !== 'string' || id.length === 0) {
    throw new ZkManifestError(`case ${index} has no id`);
  }
  if (typeof kind !== 'string' || typeof circuit !== 'string' || typeof name !== 'string') {
    throw new ZkManifestError(`case '${id}' is missing circuit/kind/name`);
  }
  if (status !== null && typeof status !== 'string') {
    throw new ZkManifestError(`case '${id}' has a non-string status`);
  }
  if (typeof ok !== 'boolean') {
    throw new ZkManifestError(`case '${id}' has no boolean ok`);
  }
  return {id, circuit, kind, status, ok, name};
}

/**
 * Parse and validate a manifest. Throws `ZkManifestError` on anything that would
 * make a later assertion mean less than it appears to. Returns the parsed
 * manifest so a caller can report on it.
 */
export function validateZkManifest(raw: unknown): ZkManifest {
  if (!isRecord(raw)) {
    throw new ZkManifestError('manifest is not a JSON object');
  }
  if (raw.schema !== ZK_MANIFEST_SCHEMA) {
    throw new ZkManifestError(
      `unknown manifest schema ${JSON.stringify(raw.schema)} — expected '${ZK_MANIFEST_SCHEMA}'. ` +
        'Refusing to read it as v1; the field names may have moved.',
    );
  }

  if (!Array.isArray(raw.cases) || raw.cases.length === 0) {
    throw new ZkManifestError('manifest has no cases');
  }
  const cases = raw.cases.map(readCase);

  const summary = raw.summary;
  if (!isRecord(summary) || !isRecord(summary.byKind) || typeof summary.failing !== 'number') {
    throw new ZkManifestError('manifest summary is missing byKind or failing');
  }

  // Truncation check: a partial download or a half-written file would otherwise
  // pass every row assertion below simply by not containing the failing row.
  let declared = 0;
  for (const n of Object.values(summary.byKind)) {
    if (typeof n !== 'number') {
      throw new ZkManifestError('summary.byKind holds a non-number');
    }
    declared += n;
  }
  if (declared !== cases.length) {
    throw new ZkManifestError(
      `case count disagrees with the summary: ${cases.length} cases, summary.byKind totals ${declared}`,
    );
  }

  // Uniqueness FIRST. Every row assertion below is keyed by id, and duplicate
  // ids make "the row with this id" ambiguous — one silently masking the other.
  const seen = new Set<string>();
  for (const c of cases) {
    if (seen.has(c.id)) {
      throw new ZkManifestError(
        `duplicate case id '${c.id}' — ids must be unique or a by-id gate reports on a subset ` +
          `(${cases.length} cases, ${new Set(cases.map(x => x.id)).size} unique ids)`,
      );
    }
    seen.add(c.id);
  }

  // Check the rows before the summary that claims to describe them: `failing`
  // is the coordinator's count, `ok` is the evidence for it.
  for (const c of cases) {
    if (!c.ok) {
      throw new ZkManifestError(`case '${c.id}' is not ok: ${c.name}`);
    }
  }
  if (summary.failing !== 0) {
    throw new ZkManifestError(`manifest reports ${summary.failing} failing case(s)`);
  }

  for (const id of REQUIRED_MUT_VERIFIED) {
    // Deliberately a filter, not a lookup map: if the uniqueness check above were
    // ever removed, this still refuses to resolve an ambiguous id rather than
    // quietly taking whichever row happened to come last.
    //
    // Mutation-swept 2026-08-10: 8 of the 9 guards in this function are
    // demonstrated load-bearing — neutralise any one and a named test fails. The
    // ninth is `matches.length > 1` below, which SURVIVES, and must: the
    // uniqueness check runs first, so it is unreachable from the public API.
    // That is redundancy on purpose, not missing coverage, and it cannot be
    // isolated by a test — removing uniqueness is what makes it reachable, and
    // the sweep shows that removal already fails three tests.
    const matches = cases.filter(c => c.id === id);
    if (matches.length === 0) {
      throw new ZkManifestError(
        `required constraint '${id}' is absent from the manifest — the wallet depends on it`,
      );
    }
    if (matches.length > 1) {
      throw new ZkManifestError(`required constraint '${id}' appears ${matches.length} times`);
    }
    if (matches[0].status !== 'MUT-VERIFIED') {
      throw new ZkManifestError(
        `required constraint '${id}' is ${JSON.stringify(matches[0].status)}, not MUT-VERIFIED — ` +
          'it is no longer demonstrated load-bearing',
      );
    }
  }

  return {schema: raw.schema, summary: {byKind: summary.byKind as Record<string, number>, failing: summary.failing}, cases};
}
