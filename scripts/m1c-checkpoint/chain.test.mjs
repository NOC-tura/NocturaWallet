/**
 * The M1c desk's own chain reading (chain.mjs): every §6.8 condition on a relayed unshield, the
 * deployed binary's digest, the wchange_vk against the pinned VK — held to what the CHAIN wrote,
 * never to the app's code:
 *   - the two relayed withdraws recorded once from devnet (src/modules/shielded/a0/__tests__/
 *     fixtures/landed-withdraw-{5F8Ks5qa,5sKiWZTv}.json, scripts/a0-fixtures/fetch-devnet-tx.mjs):
 *     5F8Ks5qa… is the fresh-owner shape with the 3,000,000-lamport grant, 5sKiWZTv… the
 *     existing-owner shape without; their PDAs (the vault, the fee destination, the destination
 *     ATA, wchange_vk) are the accounts the program itself accepted — the positive controls of
 *     `findPda` / `ataOf`;
 *   - the wchange_vk account recorded once (fixtures/devnet-chain-facts.json, `chain-facts
 *     --record`, slot 523482591) against native/noctura-prover's pinned withdraw_change_vk.json;
 *   - the programData reading on a synthetic ELF built here field by field, and — when
 *     NOCTURA_A0_PROGRAM_SO names the program side's built shielded_pool.so — on the real binary
 *     (skipped LOUDLY otherwise).
 * Each check is shown to FAIL on a one-field mutation of the recorded transaction (or the phone's
 * readout). No network, no device: node --test scripts/m1c-checkpoint/*.test.mjs
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { base58, base64 } from '@scure/base';
import * as C from './chain.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../..');
const fixture = sig => JSON.parse(readFileSync(join(ROOT, `src/modules/shielded/a0/__tests__/fixtures/landed-withdraw-${sig}.json`), 'utf8'));
const FACTS = JSON.parse(readFileSync(join(HERE, 'fixtures/devnet-chain-facts.json'), 'utf8'));
const PINNED_VK = JSON.parse(readFileSync(join(ROOT, 'native/noctura-prover/tests/fixtures/a0-vk/withdraw_change_vk.json'), 'utf8'));
const FP = '3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe';

// the recorded facts (read-landed-withdraw.mjs's output; the tx logs) — written out, not computed here
const FRESH = {
  sig: '5F8Ks5qa',
  sub: { owner: 'AgPYn4odQNKwWBjvCtgG8G1supmLKaFHtbDVHmMT2KtP', ata: '2ot2kwhs7gFFPHAYNwkuNsUsfZp8hWAgzHpNQLx9pASu', amount: '400000', fee: '10000', feePayer: FP, gasGrantLamports: '3000000', seedKeys: ['AgPYn4odQNKwWBjvCtgG8G1supmLKaFHtbDVHmMT2KtP', 'DaiWcqhB9YpdqXUypDAF97WTAEY9bEdwjfX4eDFp9yNc'] },
  out: { changeLeafIndex: 20, grantLamports: '3000000' },
};
const EXISTING = {
  sig: '5sKiWZTv',
  sub: { owner: 'GoBAmZzHvD6F4KHLNmBFh2wZAGE1dwwufeTbifSHEYfd', ata: '9hZSf8jMxBdqcvnYzj6EkQ2gPoZCoX2GcF8f1dgkyLsn', amount: '400000', fee: '10000', feePayer: FP, gasGrantLamports: '3000000', seedKeys: ['DaiWcqhB9YpdqXUypDAF97WTAEY9bEdwjfX4eDFp9yNc'] },
  out: { changeLeafIndex: 22, grantLamports: null },
};
const decoded = (c, edit = r => r) => C.decodeRelayedTx(edit(structuredClone(fixture(c.sig).result)));
const failing = ({ c, sub = {}, out = {}, edit }) =>
  C.judgeRelayedUnshield({ tx: decoded(c, edit), sub: { ...c.sub, ...sub }, out: { ...c.out, ...out } })
    .checks.filter(x => !x.pass)
    .map(x => x.name);

/** Re-encode the recorded wire transaction after editing its decoded message (keys / instruction data). */
function editWire(result, f) {
  const raw = Buffer.from(base64.decode(result.transaction[0]));
  const w = C.decodeWire(raw);
  f(w);
  const sv = n => {
    const out = [];
    do {
      let b = n & 0x7f;
      n >>= 7;
      if (n) {
        b |= 0x80;
      }
      out.push(b);
    } while (n);
    return out;
  };
  const sigEnd = 1 + 64 * w.signatures.length;
  const blockhash = raw.subarray(sigEnd + 3 + sv(w.keys.length).length + 32 * w.keys.length, sigEnd + 3 + sv(w.keys.length).length + 32 * w.keys.length + 32);
  const parts = [raw.subarray(0, sigEnd), Buffer.from([w.header.required, w.header.readonlySigned, w.header.readonlyUnsigned]), Buffer.from(sv(w.keys.length))];
  for (const k of w.keys) {
    parts.push(Buffer.from(base58.decode(k)));
  }
  parts.push(blockhash, Buffer.from(sv(w.instructions.length)));
  for (const x of w.instructions) {
    parts.push(Buffer.from([w.keys.indexOf(x.program)]), Buffer.from(sv(x.accounts.length)), Buffer.from(x.accounts.map(a => w.keys.indexOf(a))), Buffer.from(sv(x.data.length)), Buffer.from(x.data));
  }
  result.transaction[0] = base64.encode(Buffer.concat(parts));
  return result;
}

test('the wire reader round-trips the recorded transactions byte for byte (the editor below is faithful)', () => {
  for (const c of [FRESH, EXISTING]) {
    const r = fixture(c.sig).result;
    assert.equal(editWire(structuredClone(r), () => undefined).transaction[0], r.transaction[0]);
  }
});

test('positive controls: both recorded relayed withdraws pass every §6.8 check', () => {
  for (const c of [FRESH, EXISTING]) {
    const j = C.judgeRelayedUnshield({ tx: decoded(c), sub: c.sub, out: c.out });
    assert.deepEqual(j.checks.map(x => [x.name, x.pass]), [
      ['landed', true], ['program', true], ['pool', true], ['withdraw-event', true], ['change-leaf', true], ['fee-payer', true],
      ['fee-destination', true], ['fee', true], ['destination', true], ['grant', true], ['create-ata', true], ['no-seed-signer', true],
    ], c.sig);
  }
  const f = C.judgeRelayedUnshield({ tx: decoded(FRESH), sub: FRESH.sub, out: FRESH.out });
  assert.deepEqual([f.grant.lamports, f.grant.ownerPreLamports, f.ataPreTokens, f.ataPostTokens], [3000000n, 0n, null, 400000n]);
  const e = C.judgeRelayedUnshield({ tx: decoded(EXISTING), sub: EXISTING.sub, out: EXISTING.out });
  assert.deepEqual([e.grant, e.ownerPreLamports, e.ataPreTokens, e.ataPostTokens], [null, 3466370962n, 3500000n, 3900000n]);
});

test('the PDAs the program accepted: the vault, wchange_vk, the fee destination and both destination ATAs', () => {
  const t = decoded(FRESH).withdraws[0];
  assert.equal(C.ataOf('8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT'), t.vault);
  assert.equal(C.wchangeVkAddress(), t.wchange_vk);
  assert.equal(C.ataOf(FP), t.fee_destination_token_account);
  assert.equal(C.ataOf(FRESH.sub.owner), t.destination_token_account);
  assert.equal(C.ataOf(EXISTING.sub.owner), decoded(EXISTING).withdraws[0].destination_token_account);
  // the on-curve test: wallet keys are points, PDAs are not
  assert.equal(C.isOnCurve(FRESH.sub.owner), true);
  assert.equal(C.isOnCurve(FP), true);
  assert.equal(C.isOnCurve(t.vault), false);
  assert.equal(C.isOnCurve(t.wchange_vk), false);
});

test('each §6.8 check FAILS on a one-field mutation (the recorded tx or the phone\'s readout)', () => {
  const cases = [
    ['landed', { c: FRESH, edit: r => ({ ...r, meta: { ...r.meta, err: { InstructionError: [3, { Custom: 6001 }] } } }) }],
    ['grant', { c: FRESH, out: { grantLamports: null } }],
    ['grant', { c: FRESH, sub: { gasGrantLamports: '2000000' } }],
    ['grant', { c: FRESH, sub: { gasGrantLamports: null } }],
    ['grant', { c: FRESH, edit: r => ({ ...r, meta: { ...r.meta, preBalances: r.meta.preBalances.map((b, i) => (i === 5 ? 1 : b)) } }) }],
    ['grant', { c: EXISTING, out: { grantLamports: '3000000' } }],
    ['change-leaf', { c: FRESH, out: { changeLeafIndex: 21 } }],
    ['change-leaf', { c: FRESH, out: { changeLeafIndex: undefined } }],
    ['fee-payer', { c: FRESH, sub: { feePayer: 'GoBAmZzHvD6F4KHLNmBFh2wZAGE1dwwufeTbifSHEYfd' } }],
    ['fee', { c: FRESH, sub: { fee: '10001' } }],
    ['destination', { c: FRESH, sub: { amount: '400001' } }],
    ['destination', { c: FRESH, sub: { ata: EXISTING.sub.ata } }],
    ['no-seed-signer', { c: FRESH, sub: { seedKeys: [...FRESH.sub.seedKeys, FP] } }],
    ['no-seed-signer', { c: FRESH, sub: { seedKeys: [...FRESH.sub.seedKeys, '9643JXJm5ZZwv8yaTozQ2qMeVw6xHQWhquGsD87knME9'] } }],
    ['no-seed-signer', { c: FRESH, sub: { seedKeys: [] } }],
    ['withdraw-event', { c: FRESH, edit: r => ({ ...r, meta: { ...r.meta, logMessages: r.meta.logMessages.filter(l => !l.startsWith('Program data: wPHJ')) } }) }],
  ];
  for (const [name, m] of cases) {
    assert.ok(failing(m).includes(name), `${name}: ${JSON.stringify({ ...m, edit: Boolean(m.edit) })} → ${failing(m)}`);
  }
  // the fee destination: another token account in the instruction's slot 6
  assert.ok(failing({ c: FRESH, edit: r => editWire(r, w => {
    const k = w.keys.indexOf('9643JXJm5ZZwv8yaTozQ2qMeVw6xHQWhquGsD87knME9');
    w.keys[k] = '2ot2kwhs7gFFPHAYNwkuNsUsfZp8hWAgzHpNQLx9pASu';
    for (const x of w.instructions) {
      x.accounts = x.accounts.map(a => (a === '9643JXJm5ZZwv8yaTozQ2qMeVw6xHQWhquGsD87knME9' ? '2ot2kwhs7gFFPHAYNwkuNsUsfZp8hWAgzHpNQLx9pASu' : a));
    }
  }) }).includes('fee-destination'));
});

test('the shape rules: a foreign pool, two transfers, a non-transfer System call, a missing or other create-ATA, a foreign program, a second signer', () => {
  const withIx = (c, f) => failing({ c, edit: r => editWire(r, f) });
  const pool = '8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT';
  assert.ok(withIx(FRESH, w => {
    w.keys[w.keys.indexOf(pool)] = 'GoBAmZzHvD6F4KHLNmBFh2wZAGE1dwwufeTbifSHEYfd';
    for (const x of w.instructions) {
      x.accounts = x.accounts.map(a => (a === pool ? 'GoBAmZzHvD6F4KHLNmBFh2wZAGE1dwwufeTbifSHEYfd' : a));
    }
  }).includes('pool'));
  const sys = w => w.instructions.find(x => x.program === C.PROGRAMS.system);
  assert.ok(withIx(FRESH, w => w.instructions.splice(2, 0, { ...sys(w), data: Uint8Array.from(sys(w).data) })).includes('grant')); // two transfers
  assert.ok(withIx(FRESH, w => { sys(w).data = Uint8Array.of(0, 0, 0, 0); }).includes('grant')); // not a transfer
  assert.ok(withIx(FRESH, w => { w.instructions = w.instructions.filter(x => x.program !== C.PROGRAMS.ata); }).includes('create-ata'));
  assert.ok(withIx(FRESH, w => { w.instructions.find(x => x.program === C.PROGRAMS.ata).data = Uint8Array.of(0); }).includes('create-ata')); // Create, not idempotent
  assert.ok(withIx(EXISTING, w => {
    const a = w.instructions.find(x => x.program === C.PROGRAMS.ata);
    a.accounts = [a.accounts[0], a.accounts[1], FP, ...a.accounts.slice(3)]; // another owner
  }).includes('create-ata'));
  assert.ok(withIx(FRESH, w => { w.instructions.find(x => x.program === C.PROGRAMS.computeBudget).program = C.PROGRAMS.token; }).includes('program'));
  assert.ok(withIx(FRESH, w => { w.instructions.push({ ...w.instructions.find(x => x.program === C.A0.programId) }); }).includes('program'));
  assert.ok(withIx(FRESH, w => { w.header.required = 2; }).includes('fee-payer')); // a second signer
  assert.ok(withIx(FRESH, w => {
    const x = w.instructions.find(i => i.program === C.A0.programId);
    x.data = Uint8Array.from([...x.data.subarray(0, 120), 0, 1, 0, 0, ...x.data.subarray(124)]).subarray(0, 379); // 379 bytes
  }).includes('program'));
});

test('only the A0 program\'s OWN top-level frame counts: its events from an inner invocation are not the withdraw\'s', () => {
  const inject = r => {
    const logs = r.meta.logMessages;
    const leaf = logs.find(l => l.startsWith('Program data: WfPU'));
    const i = logs.indexOf('Program ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL invoke [1]');
    logs.splice(i + 1, 0, `Program ${C.A0.programId} invoke [2]`, leaf, 'Program data: wPHJ2UaWWvcLIBiy5SC7+UIGSNOJp2qq16NLTGPpr79/Hy6ZeIh2LQ==', `Program ${C.A0.programId} success`);
    return r;
  };
  const t = decoded(FRESH, inject);
  assert.equal(t.leafInserted.length, 1);
  assert.equal(t.withdrawEvents.length, 1);
  assert.deepEqual(failing({ c: FRESH, edit: inject }), []);
  // control: the same lines in the top-level frame are counted — two LeafInserted, two Withdraw → refused
  const top = r => {
    const logs = r.meta.logMessages;
    const end = logs.lastIndexOf(`Program ${C.A0.programId} success`);
    logs.splice(end, 0, logs.find(l => l.startsWith('Program data: WfPU')), logs.find(l => l.startsWith('Program data: wPHJ')));
    return r;
  };
  assert.deepEqual(failing({ c: FRESH, edit: top }), ['withdraw-event', 'change-leaf']);
});

test('R2-I1: a landing no readout gives the phone\'s values for (out null — named only by a reconcile) is judged on the chain alone; the chain half still fails', () => {
  for (const c of [FRESH, EXISTING]) {
    const j = C.judgeRelayedUnshield({ tx: decoded(c), sub: c.sub, out: null });
    assert.deepEqual(j.checks.filter(x => !x.pass).map(x => x.name), [], c.sig);
    assert.match(j.checks.find(x => x.name === 'change-leaf').detail, /n\/a \(no readout carries it\)/);
    assert.match(j.checks.find(x => x.name === 'grant').detail, /n\/a \(no readout carries it\)/);
  }
  const chainOnly = edit => C.judgeRelayedUnshield({ tx: decoded(FRESH, edit), sub: FRESH.sub, out: null }).checks.filter(x => !x.pass).map(x => x.name);
  // the owner held lamports before: no grant to a 0-lamport owner, whatever the phone said or not
  assert.ok(chainOnly(r => ({ ...r, meta: { ...r.meta, preBalances: r.meta.preBalances.map((b, i) => (i === 5 ? 1 : b)) } })).includes('grant'));
  // no LeafInserted in FeGSS's frame: no change leaf, phone or not
  assert.ok(chainOnly(r => ({ ...r, meta: { ...r.meta, logMessages: r.meta.logMessages.filter(l => !l.startsWith('Program data: WfPU')) } })).includes('change-leaf'));
  // the quote's grant is the line's, always compared
  assert.ok(C.judgeRelayedUnshield({ tx: decoded(FRESH), sub: { ...FRESH.sub, gasGrantLamports: '2000000' }, out: null }).checks.some(x => x.name === 'grant' && !x.pass));
});

test('a missing pre/post balance is no value — never read as 0 (fix round 1, minor)', () => {
  const noPre = r => { const m = { ...r.meta }; delete m.preBalances; return { ...r, meta: m }; };
  for (const out of [FRESH.out, null]) {
    const j = C.judgeRelayedUnshield({ tx: decoded(FRESH, noPre), sub: FRESH.sub, out });
    assert.equal(j.ownerPreLamports, null);
    assert.ok(j.checks.some(x => x.name === 'grant' && !x.pass), String(out));
  }
});

test('relayedWithdrawKey: the (ATA, amount, fee) of the ONE FeGSS withdraw_with_change, or null; decodeAnyTx never throws', () => {
  assert.deepEqual(C.relayedWithdrawKey(decoded(FRESH)), { ata: FRESH.sub.ata, amount: 400000n, fee: 10000n });
  assert.deepEqual(C.relayedWithdrawKey(decoded(EXISTING)), { ata: EXISTING.sub.ata, amount: 400000n, fee: 10000n });
  assert.equal(C.relayedWithdrawKey(null), null);
  // another program's tx (the FeGSS instruction moved to another program id) and an A0 instruction of another kind
  assert.equal(C.relayedWithdrawKey(decoded(FRESH, r => editWire(r, w => { w.instructions = w.instructions.filter(x => x.program !== C.A0.programId); }))), null);
  assert.equal(C.relayedWithdrawKey(decoded(FRESH, r => editWire(r, w => {
    const x = w.instructions.find(i => i.program === C.A0.programId);
    x.data = Uint8Array.from([0xa3, 0x34, 0xc8, 0xe7, 0x8c, 0x03, 0x45, 0xba, ...x.data.subarray(8)]); // another discriminator (a P2 transfer's slot)
  }))), null);
  const r = fixture(FRESH.sig).result;
  assert.equal(C.decodeAnyTx({ ...r, transaction: [r.transaction[0].slice(0, 40), 'base64'] }), null); // truncated
  assert.equal(C.decodeAnyTx(null), null);
  assert.notEqual(C.decodeAnyTx(r), null); // control
});

test('a missing tx or a versioned message is not judged as landed', () => {
  assert.deepEqual(C.judgeRelayedUnshield({ tx: null, sub: FRESH.sub, out: FRESH.out }).checks.map(c => [c.name, c.pass]), [['landed', false]]);
  const r = fixture(FRESH.sig).result;
  const raw = Buffer.from(base64.decode(r.transaction[0]));
  raw[65] |= 0x80; // the message's first byte: a version prefix
  const v = C.decodeRelayedTx({ ...r, transaction: [base64.encode(raw), 'base64'] });
  assert.equal(v.versioned, true);
  assert.deepEqual(C.judgeRelayedUnshield({ tx: v, sub: FRESH.sub, out: FRESH.out }).checks.map(c => [c.name, c.pass]), [['landed', false]]);
});

// ------------------------------------------------------------------ the deployed binary

/** A minimal 64-bit LE ELF of `size` bytes whose section headers END it (the last 8 bytes zero, as a real .so's). */
function syntheticElf(size, shnum = 3) {
  const b = Buffer.alloc(size, 0xab);
  b.write('7f454c46', 0, 'hex');
  b[4] = 2; // ELFCLASS64
  b[5] = 1; // little-endian
  const shoff = size - shnum * 64;
  b.writeBigUInt64LE(64n, 0x20); // e_phoff
  b.writeBigUInt64LE(BigInt(shoff), 0x28); // e_shoff
  b.writeUInt16LE(56, 0x36); // e_phentsize
  b.writeUInt16LE(1, 0x38); // e_phnum
  b.writeUInt16LE(64, 0x3a); // e_shentsize
  b.writeUInt16LE(shnum, 0x3c); // e_shnum
  b.fill(0, size - 8); // the last section header's sh_entsize = 0
  return b;
}
const programData = (elf, padding, authority = 'GoBAmZzHvD6F4KHLNmBFh2wZAGE1dwwufeTbifSHEYfd') => {
  const head = Buffer.alloc(45);
  head.writeUInt32LE(3, 0);
  head.writeBigUInt64LE(523346473n, 4);
  head[12] = 1;
  Buffer.from(base58.decode(authority)).copy(head, 13);
  return Buffer.concat([head, elf, Buffer.alloc(padding)]);
};

test('programData: the ELF is cut by its own header (its trailing zeros kept), the padding must be zero', () => {
  const elf = syntheticElf(4096);
  const sha = createHash('sha256').update(elf).digest('hex');
  const r = C.programDataBinary(programData(elf, 1000));
  assert.deepEqual(r, { sha256: sha, elfBytes: 4096, paddingBytes: 1000, authority: 'GoBAmZzHvD6F4KHLNmBFh2wZAGE1dwwufeTbifSHEYfd' });
  // negative controls: stripping trailing zeros would give ANOTHER digest; a non-zero padding byte, a
  // truncated ELF, another tag refuse
  assert.notEqual(createHash('sha256').update(elf.subarray(0, 4088)).digest('hex'), sha);
  const dirty = programData(elf, 1000);
  dirty[dirty.length - 1] = 1;
  assert.match(C.programDataBinary(dirty).error, /not all zero/);
  assert.match(C.programDataBinary(programData(elf, 0).subarray(0, 45 + 4000)).error, /the ELF header says 4096/);
  const tag = programData(elf, 0);
  tag.writeUInt32LE(2, 0);
  assert.match(C.programDataBinary(tag).error, /not a programData account/);
  // the program account's pointer: tag 2 + the programData key — the recorded FeGSS account
  const p = base64.decode(FACTS.program.answer.value.data[0]);
  assert.equal(C.programDataAddressOf(p), FACTS.programData.address);
  assert.equal(C.findPda([base58.decode(C.A0.programId)], C.PROGRAMS.bpfUpgradeable).address, FACTS.programData.address);
});

const SO = process.env.NOCTURA_A0_PROGRAM_SO;
test('programData of the REAL binary: the program side\'s built shielded_pool.so reads as b0054981…', { skip: SO && existsSync(SO) ? false : 'SKIPPED LOUDLY: set NOCTURA_A0_PROGRAM_SO=<program side>/target/deploy/shielded_pool.so to run it on the real ELF' }, () => {
  const so = readFileSync(SO);
  const r = C.programDataBinary(programData(so, 15712));
  assert.equal(r.sha256, C.DEPLOYED_BINARY_SHA256);
  assert.equal(r.elfBytes, so.length);
});

// ------------------------------------------------------------------ the wchange_vk

test('wchange_vk: the recorded account equals the pinned withdraw_change_vk.json (sha256 43dafca7…); each field can fail', () => {
  assert.equal(createHash('sha256').update(readFileSync(join(ROOT, 'native/noctura-prover/tests/fixtures/a0-vk/withdraw_change_vk.json'))).digest('hex'), '43dafca79a0523fcffb4a9719f67b4a260cbce2047b9a00c9abff0223134e5cd');
  const account = FACTS.wchangeVk.answer.value;
  const ok = C.judgeWchangeVk({ address: FACTS.wchangeVk.address, account, pinnedVk: PINNED_VK });
  assert.deepEqual(ok.map(c => [c.name, c.pass]), [['address', true], ['owner', true], ['layout', true], ['pool', true], ['written', true], ['vk', true]]);
  const flip = at => {
    const d = Buffer.from(base64.decode(account.data[0]));
    d[at] ^= 1;
    return { ...account, data: [base64.encode(d), 'base64'] };
  };
  const failed = (o = {}) => C.judgeWchangeVk({ address: FACTS.wchangeVk.address, account, pinnedVk: PINNED_VK, ...o }).filter(c => !c.pass).map(c => c.name);
  assert.deepEqual(failed({ account: flip(88 + 959) }), ['vk']); // the last IC byte
  assert.deepEqual(failed({ account: flip(88) }), ['vk']); // alpha's first byte
  assert.deepEqual(failed({ account: flip(80) }), ['written']);
  assert.deepEqual(failed({ account: flip(40) }), ['pool']);
  assert.deepEqual(failed({ account: flip(0) }), ['layout']);
  assert.deepEqual(failed({ account: { ...account, owner: C.PROGRAMS.system } }), ['owner']);
  assert.deepEqual(failed({ address: FACTS.programData.address }), ['address']);
  assert.deepEqual(failed({ pinnedVk: { ...PINNED_VK, vk_delta_2: PINNED_VK.vk_gamma_2 } }), ['vk']);
  // G2's coordinate order matters: c0/c1 swapped in beta is another key
  const swapped = { ...PINNED_VK, vk_beta_2: [[PINNED_VK.vk_beta_2[0][1], PINNED_VK.vk_beta_2[0][0]], PINNED_VK.vk_beta_2[1], PINNED_VK.vk_beta_2[2]] };
  assert.deepEqual(failed({ pinnedVk: swapped }), ['vk']);
  assert.deepEqual(failed({ account: null }).slice(-1), ['account']);
});
