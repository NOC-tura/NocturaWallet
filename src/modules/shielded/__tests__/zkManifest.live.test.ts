/**
 * Fetches the coordinator's manifest from the live endpoint and validates it.
 *
 * Off by default: `npm run verify` must not depend on a third-party host being
 * up. CI turns it on with ZK_MANIFEST_LIVE=1 in its own workflow, which
 * fail-closes on an outage and can be re-run — see .github/workflows/zk-manifest.yml,
 * where a control asserts this test actually EXECUTED rather than skipped.
 *
 * A skipped test and a passing test are both green, which is exactly why the
 * workflow checks for the passing line by name.
 */
import {validateZkManifest} from '../zkManifest';

const MANIFEST_URL =
  'https://api.noc-tura.io/api/v1/zk-assets/v1/negative-test-manifest.json';

const live = process.env.ZK_MANIFEST_LIVE === '1';

(live ? describe : describe.skip)('the live ZK negative-test manifest', () => {
  jest.setTimeout(60_000);

  it('is served, well-formed, and still mutation-verifies every constraint the wallet depends on', async () => {
    const res = await fetch(MANIFEST_URL);
    expect(res.ok).toBe(true);
    const body: unknown = await res.json();

    // Throws with a message naming what failed — schema, case count, a duplicate
    // id, a case that is not ok, or a required constraint that stopped being
    // MUT-VERIFIED. The message is the report; there is nothing else to print.
    const manifest = validateZkManifest(body);

    expect(manifest.summary.failing).toBe(0);
    expect(manifest.cases.length).toBeGreaterThan(0);
  });
});
