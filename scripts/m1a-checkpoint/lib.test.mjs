/**
 * The desk logic's own tests (node:test — `node --test scripts/m1a-checkpoint/*.test.mjs`, by hand
 * and in the native-prover workflow; Jest does not collect .mjs). Every check has its negative
 * control: a verifier that accepts everything, a VK decoder that reads the wrong limb order, a
 * judge that passes a missing line —
 * each would make the checkpoint print PASS for a phone that proved nothing.
 *
 * Inputs: the committed offline fixtures (native/noctura-prover/tests/fixtures), the RECORDED
 * devnet read of the Pool account (fixtures/devnet-pool-520213277.json, written by `vk` — the
 * tests never touch the network) and the desktop rehearsal's report
 * (fixtures/host-rehearsal-report.json, written by M1aCheckpointHostTest over the jni-host
 * library). The rehearsal report is an INPUT here — what decides its proofs are valid is the
 * pairing equation, and what decides its values are right is deskValues().
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { join } from 'node:path';
import * as L from './lib.mjs';

const here = join(L.ROOT, 'scripts/m1a-checkpoint/fixtures');
const chain = L.readJson(join(here, 'devnet-pool-520213277.json'));
const hostReport = L.readJson(join(here, 'host-rehearsal-report.json'));
const proves = L.fixture('a0-prove-vectors.json');
const keys = L.fixture('a0-key-vectors.json');
const pinned = {
  deposit: L.vkFromSnarkjs(L.fixture('a0-vk/deposit_vk.json')),
  withdrawChange: L.vkFromSnarkjs(L.fixture('a0-vk/withdraw_change_vk.json')),
};
const poolData = () => Buffer.from(chain.dataBase64, 'base64');
const chainVk = () =>
  L.vkFromBlob(
    L.decodePoolAccount({ owner: chain.owner, data: poolData() }).blob,
  );
const clone = o => JSON.parse(JSON.stringify(o));
const flipHex = (h, i = 63) =>
  h.slice(0, i) + (parseInt(h[i], 16) ^ 1).toString(16) + h.slice(i + 1);

test('the desk values equal the offline fixtures (deposit scenario, key vectors note 0)', () => {
  const d = L.deskValues();
  assert.equal(d.seedHex, keys.seeds[0].seed);
  const n0 = keys.seeds[0].notes.find(n => n.depositIndex === '0');
  assert.equal(d.rho, n0.rho);
  assert.equal(
    d.commitment,
    n0.commitments.find(c => c.amount === '1000000000').commitment,
  );
  assert.equal(d.mintHash, keys.constants.mintHash);
  assert.deepEqual(d.publicInputs, proves.scenarios[0].publicInputs);
  // negative control: another index gives another rho (the comparison can fail)
  assert.notEqual(
    keys.seeds[0].notes.find(n => n.depositIndex === '1').rho,
    d.rho,
  );
});

test('the recorded Pool account decodes to the pinned deposit VK', () => {
  const p = L.decodePoolAccount({ owner: chain.owner, data: poolData() });
  assert.deepEqual(p.errs, []);
  assert.equal(p.blob.length, 768);
  assert.equal(p.maxFee, '100000');
  assert.deepEqual(L.vkDiff(L.vkFromBlob(p.blob), pinned.deposit), []);
  // negative controls: one VK byte changed; G2 read c0-first; the withdraw_change VK
  const d = poolData();
  d[L.POOL_LAYOUT.depositVk + 448 + 64 * 4 + 63] ^= 1; // last IC point's y
  assert.deepEqual(
    L.vkDiff(
      L.vkFromBlob(L.decodePoolAccount({ owner: chain.owner, data: d }).blob),
      pinned.deposit,
    ),
    ['ic[4][1]'],
  );
  const wrongOrder = L.vkFromBlob(p.blob);
  wrongOrder.beta = wrongOrder.beta.map(([c0, c1]) => [c1, c0]);
  assert.deepEqual(L.vkDiff(wrongOrder, pinned.deposit), [
    'beta[0][0]',
    'beta[0][1]',
    'beta[1][0]',
    'beta[1][1]',
  ]);
  assert.ok(L.vkDiff(pinned.withdrawChange, pinned.deposit).length > 0);
});

test('decodePoolAccount refuses another owner, size, discriminator, mint or tree', () => {
  const ok = { owner: chain.owner, data: poolData() };
  assert.match(
    L.decodePoolAccount({ ...ok, owner: L.DEVNET.pool }).errs[0],
    /not the A0 program/,
  );
  assert.match(
    L.decodePoolAccount({ ...ok, data: poolData().subarray(0, 927) }).errs[0],
    /927 bytes/,
  );
  for (const [at, re] of [
    [0, /discriminator/],
    [L.POOL_LAYOUT.mint, /mint/],
    [L.POOL_LAYOUT.merkleTree, /merkle_tree/],
  ]) {
    const d = poolData();
    d[at] ^= 1;
    assert.match(L.decodePoolAccount({ ...ok, data: d }).errs.join(), re);
  }
  assert.equal(
    L.accountDiscriminator('Pool'),
    poolData().subarray(0, 8).toString('hex'),
  );
});

test('verifyGroth16: the two LANDED withdraw_with_change proofs verify against the pinned VK', () => {
  assert.equal(proves.landed.length, 2);
  for (const l of proves.landed) {
    assert.deepEqual(
      L.verifyGroth16(pinned.withdrawChange, l.proofBytes, l.publicInputs),
      { ok: true },
    );
  }
});

test('verifyGroth16 refuses: a changed public input, A not negated, G2 c0-first, another VK, bad encodings', () => {
  const l = proves.landed[0];
  const vk = pinned.withdrawChange;
  const pubs = l.publicInputs.map((p, i) => (i === 2 ? flipHex(p) : p));
  assert.equal(L.verifyGroth16(vk, l.proofBytes, pubs).ok, false);
  const b = Buffer.from(l.proofBytes, 'hex');
  const y = BigInt('0x' + b.subarray(32, 64).toString('hex'));
  const unNeg = Buffer.from(b);
  Buffer.from(((L.P - y) % L.P).toString(16).padStart(64, '0'), 'hex').copy(
    unNeg,
    32,
  );
  assert.equal(
    L.verifyGroth16(vk, unNeg.toString('hex'), l.publicInputs).ok,
    false,
  );
  const c0first = Buffer.from(b);
  for (const o of [64, 128]) {
    b.copy(c0first, o, o + 32, o + 64);
    b.copy(c0first, o + 32, o, o + 32);
  }
  assert.equal(
    L.verifyGroth16(vk, c0first.toString('hex'), l.publicInputs).ok,
    false,
  );
  assert.match(
    L.verifyGroth16(pinned.deposit, l.proofBytes, l.publicInputs).reason,
    /7 public inputs for a VK with 4/,
  );
  assert.match(
    L.verifyGroth16(vk, l.proofBytes.toUpperCase(), l.publicInputs).reason,
    /lowercase hex/,
  );
  const big = [...l.publicInputs];
  big[0] = 'f'.repeat(64);
  assert.match(L.verifyGroth16(vk, l.proofBytes, big).reason, /not < r/);
});

test("the rehearsal's deposit proof verifies against the deposit VK recorded from chain, and not with a changed input", () => {
  const dp = hostReport.depositProof;
  assert.deepEqual(L.verifyGroth16(chainVk(), dp.proofBytes, dp.publicInputs), {
    ok: true,
  });
  assert.equal(
    L.verifyGroth16(
      chainVk(),
      dp.proofBytes,
      dp.publicInputs.map((p, i) => (i === 1 ? flipHex(p) : p)),
    ).ok,
    false,
  );
});

const judgeWith = (report, extra = {}) =>
  L.judge({
    report,
    desk: L.deskValues(),
    chainVk: chainVk(),
    chainVkSource: 'recorded',
    pinned,
    withdrawScenario: proves.scenarios.find(
      s => s.label === report.withdrawScenario,
    ),
    ...extra,
  });
const failing = lines => lines.filter(l => !l.pass).map(l => l.id);
const asPhone = r => {
  const p = clone(r);
  p.platform = {
    where: 'phone',
    javaVmName: 'Dalvik',
    osArch: 'aarch64',
    supportedAbis: ['arm64-v8a'],
  };
  p.isSupported = true;
  return p;
};
const launched = [
  { id: 'S16.D', text: 'device test', pass: true },
  { id: 'S16.10', text: 'devnet launch', pass: true },
  { id: 'S16.9', text: 'production launch', pass: true },
];

test('judge: the rehearsal passes every desk line and fails exactly the phone-only ones', () => {
  assert.deepEqual(failing(judgeWith(hostReport, { rehearsal: true })), [
    'S16.0',
    'S16.1',
  ]);
  assert.deepEqual(failing(judgeWith(hostReport)), ['S16.0', 'S16.1', 'S16.9']);
  for (const id of ['S16.0', 'S16.1', 'S16.9', 'S16.10']) {
    assert.ok(L.PHONE_ONLY.has(id));
  }
});

test('judge: a phone report with launches passes every line (positive control of the whole judge)', () => {
  const lines = judgeWith(asPhone(hostReport), { launches: launched });
  assert.deepEqual(failing(lines), []);
  assert.deepEqual(
    lines.map(l => l.id),
    [
      'S16.0',
      'S16.1',
      'S16.2',
      'S16.3',
      'S16.4',
      'S16.5',
      'S16.6',
      'S16.7',
      'S16.8',
      'C8.a',
      'C8.b',
      'C8.c',
      'S16.D',
      'S16.10',
      'S16.9',
    ],
  );
});

test('judge: each defect fails its own line', () => {
  const base = asPhone(hostReport);
  const cases = [
    [r => (r.isSupported = false), ['S16.1']],
    [r => (r.platform.osArch = 'x86_64'), ['S16.0', 'S16.1']],
    [r => (r.seedCopyZeroFilled = false), ['S16.2']],
    [r => (r.depositRho.ok = flipHex(r.depositRho.ok)), ['S16.3']],
    [r => (r.commitment.ok = flipHex(r.commitment.ok)), ['S16.4']],
    [
      r =>
        (r.depositProof.publicInputs[3] = flipHex(
          r.depositProof.publicInputs[3],
        )),
      ['S16.5', 'S16.7'],
    ],
    [
      r =>
        (r.depositProof.proofBytes = flipHex(r.depositProof.proofBytes, 300)),
      ['S16.7'],
    ],
    [
      r => (r.depositProof = { error: 'E_A0_KEY_FILE_PIN' }),
      ['S16.5', 'S16.7'],
    ],
    [
      r => (r.withdrawWithoutAuthId = { ok: true, withAuthId: false }),
      ['S16.8'],
    ],
    [r => (r.withdrawWithoutAuthId.withAuthId = true), ['S16.8']],
    // refused, but for another reason (a key file): not the refusal the checkpoint asks for
    [r => (r.withdrawWithoutAuthId.error = 'E_A0_KEY_FILE_READ'), ['S16.8']],
    [
      r =>
        (r.withdrawWithAuthId.publicInputs[2] = flipHex(
          r.withdrawWithAuthId.publicInputs[2],
        )),
      ['C8.a'],
    ],
    [r => (r.withdrawReusedAuthId = { ok: true }), ['C8.b']],
    [r => (r.depositRhoAfterClose = { ok: 'x' }), ['C8.c']],
  ];
  for (const [mutate, want] of cases) {
    const r = clone(base);
    mutate(r);
    assert.deepEqual(
      failing(judgeWith(r, { launches: launched })),
      want,
      mutate.toString(),
    );
  }
  // the chain VK: absent, or one coordinate off
  assert.deepEqual(
    failing(judgeWith(base, { launches: launched, chainVk: null })),
    ['S16.6', 'S16.7'],
  );
  const off = chainVk();
  off.ic[2][0] ^= 1n;
  assert.deepEqual(
    failing(judgeWith(base, { launches: launched, chainVk: off })),
    ['S16.6', 'S16.7'],
  );
  // a failed launch
  assert.deepEqual(
    failing(
      judgeWith(base, {
        launches: launched.map(l => ({ ...l, pass: l.id !== 'S16.9' })),
      }),
    ),
    ['S16.9'],
  );
});

test('the report is read from am instrument -r output, or reassembled from logcat chunks', () => {
  const json = JSON.stringify(hostReport);
  const inst = `INSTRUMENTATION_STATUS: class=x\nINSTRUMENTATION_STATUS: m1a-report=${json}\nINSTRUMENTATION_STATUS_CODE: 7\nOK (1 test)\n`;
  assert.deepEqual(L.reportFromInstrumentOutput(inst), hostReport);
  const parts = [json.slice(0, 1000), json.slice(1000, 2000), json.slice(2000)];
  const log = parts.map(
    (p, i) => `11-09 01:00:00.000 I M1aCheckpoint: M1A-REPORT ${i + 1}/3 ${p}`,
  );
  assert.deepEqual(
    L.reportFromInstrumentOutput([log[2], log[0], log[1]].join('\n')),
    hostReport,
  );
  assert.equal(L.reportFromLogcat([log[0], log[2]].join('\n')), null);
  assert.equal(L.reportFromInstrumentOutput('INSTRUMENTATION_FAILED: x'), null);
});

test('the RPC guard: devnet over https only, never noc-tura.io, solscan.io or mainnet', () => {
  assert.equal(L.rpcRefusal('https://api.devnet.solana.com'), null);
  assert.equal(L.rpcRefusal('https://devnet.helius-rpc.com/?api-key=x'), null);
  for (const bad of [
    'http://api.devnet.solana.com',
    'https://api.noc-tura.io/rpc',
    'https://noc-tura.io',
    'https://api.mainnet-beta.solana.com',
    'https://mainnet.helius-rpc.com/?api-key=x',
    'https://public-api.solscan.io',
    'not a url',
  ]) {
    assert.ok(L.rpcRefusal(bad), bad);
  }
});
