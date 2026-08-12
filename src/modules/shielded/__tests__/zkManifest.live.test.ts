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

  /**
   * Three attempts, because the coordinator's host has now been unreachable from
   * GitHub's runners twice (2026-08-10 ~14:50Z, 2026-08-11 ~16:24Z) while
   * answering normally from a workstation. A single blip must not redden the
   * build — but this still FAILS CLOSED, because "we could not check" is not
   * "it is fine".
   *
   * The distinction that matters is made in the workflow: a reachability failure
   * and a contract violation are both one red tick here, and only the second is
   * a finding about the manifest.
   */
  const fetchWithRetry = async (): Promise<Response> => {
    let last: unknown;
    const attemptedAt: string[] = [];
    for (let attempt = 1; attempt <= 3; attempt++) {
      attemptedAt.push(new Date().toISOString());
      try {
        return await fetch(MANIFEST_URL);
      } catch (e) {
        last = e;
        await new Promise(r => setTimeout(r, attempt * 2000));
      }
    }
    // The timestamps are the point, not decoration. The coordinator runs a
    // rotating tcpdump for SYNs on :443 and needs the exact UTC minute to line
    // up against it — "no SYN in the capture" closes the question at their
    // provider, "SYN with no reply" reopens everything. Printing them here means
    // nobody has to go digging in a CI log to answer that.
    throw new Error(
      `UNREACHABLE: ${MANIFEST_URL} did not answer in 3 attempts — ${String(last)}. ` +
        'This is a reachability failure, not a manifest violation. ' +
        `ATTEMPTED_AT_UTC=${attemptedAt.join(',')}`,
    );
  };

  it('is served, well-formed, and still mutation-verifies every constraint the wallet depends on', async () => {
    const res = await fetchWithRetry();
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
