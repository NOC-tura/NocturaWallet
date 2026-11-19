/**
 * The M1c desk's OWN reading of the chain (spec §16 M1c: "the desk script, from each signature,
 * asserts every §6.8 condition"; R1-I6 the wchange_vk read from chain; the controller's R1′ the
 * deployed binary's digest). Pure functions over RPC answers; m1c-checkpoint.mjs does the I/O.
 *
 * THE ANTI-CIRCULARITY BOUNDARY. Nothing here imports the app (src/) — not its verifier
 * (`landedVerifier.ts`), not its sync (`syncedTx.ts`), not web3.js. The relayed transaction is read
 * from its WIRE BYTES (`getTransaction` with `encoding: 'base64'`): the legacy message layout,
 * the instruction layouts and the event layouts are the program side's facts (spec §1, the IDL
 * `shielded-pool-a0-idl.json`: `withdraw_with_change` = 6cf44379ecf67997 | merkle_root 32 |
 * nullifier 32 | amount u64 LE | change_commitment 32 | fee u64 LE | u32 len 256 | proof = 380 B,
 * its 10 accounts in IDL order; `Withdraw` = c0f1c9d946965af7 + nullifier 32; `LeafInserted` =
 * 59f3d408d7bfbb98 + commitment 32 + leaf_index u64 LE + root 32), read here by a decoder of our
 * own; the token deltas come from the RPC's pre/postTokenBalances, the grant's pre-balance from its
 * preBalances. Program-derived addresses (the ATA, `wchange_vk`, the programData account) are
 * derived here with @noble/hashes sha256 and @noble/curves ed25519 (the on-curve test) — the
 * Solana rule, not web3.js. Held in chain.test.mjs to the two relayed withdraws recorded from
 * devnet (5F8Ks5qa… with the grant, 5sKiWZTv… without) and to a mutation of each field.
 */
import { createHash } from 'node:crypto';
import { base58, base64 } from '@scure/base';
import { ed25519 } from '@noble/curves/ed25519.js';

/** spec §1 — the deployed devnet A0 pool (facts), and the programs the relayed shape may call. */
export const A0 = {
  programId: 'FeGSSsJtmA7GnMgnpj33JsiceSk1NyFopff2FtQFsMuH',
  pool: '8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT',
  mint: 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs',
  merkleTree: '5URdh1uLKXPh28AbcXBK1oWYGpQjVbMSjrKiAkt1q1Gc',
};
export const PROGRAMS = {
  system: '11111111111111111111111111111111',
  computeBudget: 'ComputeBudget111111111111111111111111111111',
  ata: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
  token: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  bpfUpgradeable: 'BPFLoaderUpgradeab1e11111111111111111111111',
};
/** The relayer's fee payer, pinned (controller ruling 9; = lib.mjs RELAYER_FEE_PAYER). */
export const RELAYER_FEE_PAYER = '3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe';
/**
 * The deployed binary since 2026-11-17 (the program side's upgrade 25h52FQX…, f3f8eff; the
 * controller's R1′): sha256 of the ELF the programData account holds.
 */
export const DEPLOYED_BINARY_SHA256 = 'b0054981ab0019ff5af81ed46d5443a6e6467f23aff5b506fc661b73d5d65d1b';

export const WITHDRAW_CHANGE = {
  disc: '6cf44379ecf67997',
  dataBytes: 8 + 32 + 32 + 8 + 32 + 8 + 4 + 256,
  accounts: [
    'pool',
    'merkle_tree',
    'vault',
    'destination_token_account',
    'nullifier_record',
    'fee_payer',
    'fee_destination_token_account',
    'wchange_vk',
    'token_program',
    'system_program',
  ],
};
const WITHDRAW_EVENT = { disc: 'c0f1c9d946965af7', bytes: 40 };
const LEAF_EVENT = { disc: '59f3d408d7bfbb98', bytes: 80 };
/** `WithdrawChangeVkAccount`: 8 disc | authority 32 | pool 32 | bump 1 | pad 7 | written u32 | pad 4 | vk 960. */
export const WCHANGE_VK_LAYOUT = { size: 8 + 32 + 32 + 1 + 7 + 4 + 4 + 960, pool: 40, written: 80, vk: 88, vkBytes: 960 };

const hex = b => Buffer.from(b).toString('hex');
const sha256 = (...parts) => {
  const h = createHash('sha256');
  for (const p of parts) {
    h.update(p);
  }
  return new Uint8Array(h.digest());
};
const u64le = (b, at) => Buffer.from(b.subarray(at, at + 8)).readBigUInt64LE(0);
const u32le = (b, at) => Buffer.from(b.subarray(at, at + 4)).readUInt32LE(0);

// --------------------------------------------------------------------------- keys and PDAs

/** Whether a 32-byte key is a point on Ed25519 (Solana's `is_on_curve`: it decompresses). */
export function isOnCurve(address) {
  try {
    ed25519.Point.fromBytes(base58.decode(address));
    return true;
  } catch {
    return false;
  }
}

/** `find_program_address`: the first bump from 255 down whose hash is OFF the curve. */
export function findPda(seeds, programId) {
  const program = base58.decode(programId);
  for (let bump = 255; bump >= 0; bump--) {
    const h = sha256(...seeds, Uint8Array.of(bump), program, new TextEncoder().encode('ProgramDerivedAddress'));
    const address = base58.encode(h);
    if (!isOnCurve(address)) {
      return { address, bump };
    }
  }
  throw new Error('no bump');
}

/** The associated token account of (owner, mint) — seeds [owner, token program, mint] under the ATA program. */
export function ataOf(owner, mint = A0.mint) {
  return findPda([base58.decode(owner), base58.decode(PROGRAMS.token), base58.decode(mint)], PROGRAMS.ata).address;
}

/** The `wchange_vk` account of a pool: seeds ["wchange_vk", pool] under the A0 program (spec R1-I6). */
export function wchangeVkAddress(pool = A0.pool) {
  return findPda([new TextEncoder().encode('wchange_vk'), base58.decode(pool)], A0.programId).address;
}

// --------------------------------------------------------------------------- the wire

function shortvec(b, i) {
  let v = 0;
  let shift = 0;
  for (;;) {
    const x = b[i++];
    if (x === undefined) {
      throw new Error('truncated');
    }
    v |= (x & 0x7f) << shift;
    shift += 7;
    if (x < 0x80) {
      return [v, i];
    }
  }
}

/** A wire transaction (legacy message only — every relayed tx is one): signatures, keys, instructions. */
export function decodeWire(raw) {
  let [n, i] = shortvec(raw, 0);
  const signatures = [];
  for (let k = 0; k < n; k++) {
    signatures.push(base58.encode(raw.subarray(i, i + 64)));
    i += 64;
  }
  const msg = raw.subarray(i);
  if (msg[0] & 0x80) {
    return { versioned: true, signatures };
  }
  const header = { required: msg[0], readonlySigned: msg[1], readonlyUnsigned: msg[2] };
  let j = 3;
  let nk;
  [nk, j] = shortvec(msg, j);
  const keys = [];
  for (let k = 0; k < nk; k++) {
    keys.push(base58.encode(msg.subarray(j, j + 32)));
    j += 32;
  }
  j += 32; // the recent blockhash
  let ni;
  [ni, j] = shortvec(msg, j);
  const instructions = [];
  for (let x = 0; x < ni; x++) {
    const program = keys[msg[j++]];
    let na;
    [na, j] = shortvec(msg, j);
    const accounts = [...msg.subarray(j, j + na)].map(a => keys[a]);
    j += na;
    let dl;
    [dl, j] = shortvec(msg, j);
    const data = Uint8Array.from(msg.subarray(j, j + dl));
    j += dl;
    instructions.push({ program, accounts, data });
  }
  if (j !== msg.length) {
    throw new Error(`${msg.length - j} bytes after the instructions`);
  }
  return { versioned: false, signatures, header, keys, instructions };
}

/** The `Program data:` events the A0 program emitted in its OWN top-level frame (invoke stack exactly [FeGSS…]). */
function frameEvents(logs) {
  const out = [];
  const stack = [];
  for (const line of logs ?? []) {
    let m = /^Program (\S+) invoke \[(\d+)\]$/.exec(line);
    if (m) {
      stack.push(m[1]);
      continue;
    }
    if (/^Program (\S+) (success|failed: .*)$/.test(line)) {
      stack.pop();
      continue;
    }
    m = /^Program data: (\S+)$/.exec(line);
    if (m && stack.length === 1 && stack[0] === A0.programId) {
      out.push(base64.decode(m[1]));
    }
  }
  return out;
}

/**
 * A `getTransaction(sig, {encoding: 'base64', maxSupportedTransactionVersion: 0})` result decoded
 * for the §6.8 checks (null for null). Every top-level instruction of the four programs the
 * relayed shape uses is read by its layout; anything else is listed in `foreign`.
 */
export function decodeRelayedTx(result) {
  if (!result) {
    return null;
  }
  const raw = base64.decode(result.transaction[0]);
  const w = decodeWire(raw);
  const meta = result.meta ?? {};
  const base = { slot: result.slot, blockTime: result.blockTime, ok: meta.err === null, err: meta.err ?? null, signature: w.signatures[0] };
  if (w.versioned) {
    return { ...base, versioned: true };
  }
  const keys = w.keys;
  const signers = keys.slice(0, w.header.required);
  const programs = w.instructions.map(x => x.program);
  const withdraws = [];
  const createAta = [];
  const system = [];
  const foreign = [];
  for (const x of w.instructions) {
    if (x.program === A0.programId) {
      if (hex(x.data.subarray(0, 8)) !== WITHDRAW_CHANGE.disc || x.data.length !== WITHDRAW_CHANGE.dataBytes || x.accounts.length !== WITHDRAW_CHANGE.accounts.length) {
        withdraws.push({ malformed: true, disc: hex(x.data.subarray(0, 8)), dataBytes: x.data.length, accounts: x.accounts.length });
        continue;
      }
      const d = x.data;
      withdraws.push({
        ...Object.fromEntries(WITHDRAW_CHANGE.accounts.map((n, k) => [n, x.accounts[k]])),
        merkleRoot: hex(d.subarray(8, 40)),
        nullifier: hex(d.subarray(40, 72)),
        amount: u64le(d, 72),
        changeCommitment: hex(d.subarray(80, 112)),
        fee: u64le(d, 112),
        proofLength: u32le(d, 120),
      });
    } else if (x.program === PROGRAMS.ata) {
      createAta.push({ idempotent: x.data.length === 1 && x.data[0] === 1, accounts: x.accounts });
    } else if (x.program === PROGRAMS.system) {
      const transfer = x.data.length === 12 && u32le(x.data, 0) === 2 && x.accounts.length === 2;
      system.push(transfer ? { transfer: true, from: x.accounts[0], to: x.accounts[1], lamports: u64le(x.data, 4) } : { transfer: false, dataBytes: x.data.length });
    } else if (x.program !== PROGRAMS.computeBudget) {
      foreign.push(x.program);
    }
  }
  const withdrawEvents = [];
  const leafInserted = [];
  for (const b of frameEvents(meta.logMessages)) {
    const disc = hex(b.subarray(0, 8));
    if (disc === WITHDRAW_EVENT.disc) {
      withdrawEvents.push(b.length === WITHDRAW_EVENT.bytes ? { nullifier: hex(b.subarray(8, 40)) } : { malformed: true });
    } else if (disc === LEAF_EVENT.disc) {
      leafInserted.push(
        b.length === LEAF_EVENT.bytes ? { commitment: hex(b.subarray(8, 40)), leafIndex: Number(u64le(b, 40)), root: hex(b.subarray(48, 80)) } : { malformed: true },
      );
    }
  }
  const index = a => keys.indexOf(a);
  const lamports = (which, a) => (index(a) < 0 ? null : BigInt(meta[which]?.[index(a)] ?? 0));
  const tokens = (which, a) => {
    const e = (meta[which] ?? []).find(t => t.accountIndex === index(a) && t.mint === A0.mint);
    return e ? BigInt(e.uiTokenAmount.amount) : null;
  };
  return {
    ...base,
    versioned: false,
    signers,
    feePayer: keys[0],
    keys,
    programs,
    withdraws,
    createAta,
    system,
    foreign,
    withdrawEvents,
    leafInserted,
    preLamports: a => lamports('preBalances', a),
    postLamports: a => lamports('postBalances', a),
    preTokens: a => tokens('preTokenBalances', a),
    postTokens: a => tokens('postTokenBalances', a),
  };
}

/**
 * The (destination ATA, amount, fee) of a decoded tx's ONE well-formed FeGSS `withdraw_with_change`
 * — the key a landing is joined to the phone's `unshield-submitting` line by (R2-I1 / R3) — or null
 * for anything else (no tx, a versioned message, no or several A0 withdraws, another program's tx,
 * a P2 `transfer`). Never throws.
 */
export function relayedWithdrawKey(tx) {
  if (!tx || tx.versioned || !Array.isArray(tx.withdraws)) {
    return null;
  }
  const wd = tx.withdraws.filter(x => !x.malformed);
  if (wd.length !== 1 || tx.withdraws.length !== 1) {
    return null;
  }
  return { ata: wd[0].destination_token_account, amount: wd[0].amount, fee: wd[0].fee };
}

/** `decodeRelayedTx` that answers null instead of throwing (a fee payer's listing holds any tx). */
export function decodeAnyTx(result) {
  try {
    return decodeRelayedTx(result);
  } catch {
    return null;
  }
}

/**
 * Every §6.8 condition on ONE relayed unshield, from the chain alone, against what the phone said
 * it submitted (`sub`, the `unshield-submitting` readout: owner, ata, amount, fee, feePayer,
 * gasGrantLamports — plus `seedKeys`, the desk's seed-key set for that line: the session's
 * `startup-accounts` seed keys ∪ the line's registry, R2-N3) and its outcome (`out`:
 * changeLeafIndex, grantLamports). Returns `{checks: [{name, pass, detail}], grant: {lamports,
 * ownerPreLamports} | null, ownerPreLamports, ataPreTokens, ataPostTokens}`. A check never passes
 * on a missing value — except the phone's own two comparisons (R2-I1): when no readout carries
 * `changeLeafIndex` / `grantLamports` (`out` null — a landing named only by a reconcile — or an
 * outcome without them), that comparison is "n/a" and the chain half of the check still decides.
 */
export function judgeRelayedUnshield({ tx, sub, out }) {
  const checks = [];
  const add = (name, pass, detail) => checks.push({ name, pass: Boolean(pass), detail });
  if (!tx) {
    add('landed', false, 'not found on devnet (getTransaction answered null)');
    return { checks, grant: null, ownerPreLamports: null, ataPreTokens: null, ataPostTokens: null };
  }
  add('landed', tx.ok && !tx.versioned, `slot ${tx.slot}, err ${JSON.stringify(tx.err)}${tx.versioned ? ', a versioned message (not the relayed shape)' : ''}`);
  if (tx.versioned) {
    return { checks, grant: null, ownerPreLamports: null, ataPreTokens: null, ataPostTokens: null };
  }
  const fp = RELAYER_FEE_PAYER;
  const allowed = new Set([PROGRAMS.computeBudget, PROGRAMS.ata, PROGRAMS.system, A0.programId]);
  const wd = tx.withdraws.filter(x => !x.malformed);
  const w = wd.length === 1 && tx.withdraws.length === 1 ? wd[0] : null;
  add(
    'program',
    w && tx.foreign.length === 0 && tx.programs.every(p => allowed.has(p)),
    `top level: ${tx.programs.map(p => p.slice(0, 6)).join(', ')}; withdraw_with_change ${wd.length} of ${tx.withdraws.length} FeGSS instruction(s)${tx.foreign.length ? `; FOREIGN ${tx.foreign.join(',')}` : ''}`,
  );
  if (!w) {
    return { checks, grant: null, ownerPreLamports: null, ataPreTokens: null, ataPostTokens: null };
  }
  const vault = ataOf(A0.pool);
  add(
    'pool',
    w.pool === A0.pool && w.merkle_tree === A0.merkleTree && w.vault === vault && w.wchange_vk === wchangeVkAddress() && w.token_program === PROGRAMS.token && w.system_program === PROGRAMS.system,
    `pool ${w.pool}, tree ${w.merkle_tree}, vault ${w.vault} (ATA(pool) ${vault}), wchange_vk ${w.wchange_vk}`,
  );
  const we = tx.withdrawEvents;
  add('withdraw-event', we.length === 1 && we[0].nullifier === w.nullifier, `${we.length} Withdraw event(s) in FeGSS's frame; nullifier = the instruction's: ${we[0]?.nullifier === w.nullifier}`);
  const li = tx.leafInserted.filter(l => !l.malformed);
  const phoneLeaf = out !== null && out !== undefined && 'changeLeafIndex' in out;
  add(
    'change-leaf',
    tx.leafInserted.length === 1 &&
      li.length === 1 &&
      li[0].commitment === w.changeCommitment &&
      (!phoneLeaf || (Number.isInteger(out.changeLeafIndex) && li[0].leafIndex === out.changeLeafIndex)),
    `LeafInserted ${li.map(l => `${l.commitment.slice(0, 12)}… leaf ${l.leafIndex}`).join(', ') || 'none'}; instruction change ${w.changeCommitment.slice(0, 12)}…; the phone's change leaf ${phoneLeaf ? out.changeLeafIndex ?? 'none' : 'n/a (no readout carries it)'}`,
  );
  add(
    'fee-payer',
    tx.signers.length === 1 && tx.signers[0] === fp && tx.feePayer === fp && w.fee_payer === fp && sub.feePayer === fp,
    `signers [${tx.signers.join(', ')}], tx fee payer ${tx.feePayer}, instruction fee_payer ${w.fee_payer}, the quote's ${sub.feePayer} (pinned ${fp})`,
  );
  const feeAta = ataOf(fp);
  const feeDelta = tx.postTokens(feeAta) !== null ? tx.postTokens(feeAta) - (tx.preTokens(feeAta) ?? 0n) : null;
  add('fee-destination', w.fee_destination_token_account === feeAta, `${w.fee_destination_token_account} (ATA(fee payer) ${feeAta})`);
  add('fee', w.fee === BigInt(sub.fee) && feeDelta === BigInt(sub.fee), `instruction fee ${w.fee}, the fee destination's token delta ${feeDelta}, ours ${sub.fee}`);
  const ownAta = ataOf(sub.owner);
  const ataPre = tx.preTokens(ownAta);
  const ataPost = tx.postTokens(ownAta);
  const destDelta = ataPost !== null ? ataPost - (ataPre ?? 0n) : null;
  const vaultDelta = tx.postTokens(vault) !== null && tx.preTokens(vault) !== null ? tx.postTokens(vault) - tx.preTokens(vault) : null;
  add(
    'destination',
    w.destination_token_account === sub.ata && sub.ata === ownAta && w.amount === BigInt(sub.amount) && destDelta === BigInt(sub.amount) && vaultDelta === -(BigInt(sub.amount) + BigInt(sub.fee)),
    `instruction destination ${w.destination_token_account}, ours ${sub.ata} (ATA(${sub.owner}) ${ownAta}); amount ${w.amount}, its token delta ${destDelta}, ours ${sub.amount}; vault delta ${vaultDelta}`,
  );
  const transfers = tx.system.filter(s => s.transfer);
  const ownerPre = tx.preLamports(sub.owner);
  const phoneGrant = out !== null && out !== undefined && 'grantLamports' in out;
  const sawGrant = phoneGrant ? out.grantLamports : 'n/a (no readout carries it)';
  let grant = null;
  let grantOk;
  let grantDetail;
  if (tx.system.length !== transfers.length) {
    grantOk = false;
    grantDetail = 'a top-level System instruction that is not a transfer';
  } else if (transfers.length > 1) {
    grantOk = false;
    grantDetail = `${transfers.length} top-level transfers`;
  } else if (transfers.length === 1) {
    const t = transfers[0];
    grant = { lamports: t.lamports, ownerPreLamports: ownerPre };
    grantOk =
      sub.gasGrantLamports !== null &&
      t.lamports === BigInt(sub.gasGrantLamports) &&
      t.from === fp &&
      t.to === sub.owner &&
      ownerPre === 0n &&
      isOnCurve(sub.owner) &&
      (!phoneGrant || out.grantLamports === t.lamports.toString());
    grantDetail = `one top-level transfer of ${t.lamports} from ${t.from} to ${t.to} (quote ${sub.gasGrantLamports}, owner pre-balance ${ownerPre}, on curve ${isOnCurve(sub.owner)}, the phone saw ${sawGrant})`;
  } else {
    grantOk = !phoneGrant || out.grantLamports === null;
    grantDetail = `no top-level transfer (owner pre-balance ${ownerPre}; the phone saw ${sawGrant})`;
  }
  add('grant', grantOk, grantDetail);
  const ca = tx.createAta;
  const want = [fp, sub.ata, sub.owner, A0.mint, PROGRAMS.system, PROGRAMS.token];
  add(
    'create-ata',
    ca.length === 1 && ca[0].idempotent && ca[0].accounts.length === want.length && want.every((k, i) => ca[0].accounts[i] === k),
    ca.length ? ca.map(c => `${c.idempotent ? 'CreateIdempotent' : 'NOT idempotent'} (${c.accounts.join(', ')})`).join('; ') : 'no create-ATA-idempotent (the uniform shape requires one)',
  );
  const seed = new Set(sub.seedKeys ?? []);
  const seedSigners = tx.signers.filter(k => seed.has(k));
  const seedInTx = tx.keys.filter(k => seed.has(k));
  add(
    'no-seed-signer',
    Array.isArray(sub.seedKeys) && sub.seedKeys.length >= 1 && seedSigners.length === 0 && seedInTx.every(k => k === sub.owner),
    `${sub.seedKeys?.length ?? 0} seed keys read out; seed keys among the signers: ${seedSigners.join(',') || 'none'}; in the tx: ${seedInTx.join(',') || 'none'} (allowed: only the destination owner)`,
  );
  return { checks, grant, ownerPreLamports: ownerPre, ataPreTokens: ataPre, ataPostTokens: ataPost };
}

// --------------------------------------------------------------------------- the deployed binary

/**
 * The ELF an upgradeable program's programData account holds: the account is
 * `u32 tag 3 | u64 slot | Option<Pubkey> authority (1 + 32)` = 45 bytes, then the ELF, then zero
 * padding up to the allocated length. The ELF's length is read from its OWN header (section
 * headers last: e_shoff + e_shnum × e_shentsize — trailing zero bytes are part of a real ELF,
 * so the padding cannot be found by stripping zeros), and everything after it must be zero.
 * Returns `{sha256, elfBytes, paddingBytes, authority}` or `{error}`.
 */
export function programDataBinary(data) {
  if (data.length < 45 + 64 || u32le(data, 0) !== 3) {
    return { error: `not a programData account (${data.length} bytes, tag ${data.length >= 4 ? u32le(data, 0) : 'none'})` };
  }
  const authority = data[12] === 1 ? base58.encode(data.subarray(13, 45)) : null;
  const elf = data.subarray(45);
  if (hex(elf.subarray(0, 4)) !== '7f454c46' || elf[4] !== 2 || elf[5] !== 1) {
    return { error: 'the program bytes are not a 64-bit little-endian ELF' };
  }
  const b = Buffer.from(elf);
  const shoff = Number(b.readBigUInt64LE(0x28));
  const shentsize = b.readUInt16LE(0x3a);
  const shnum = b.readUInt16LE(0x3c);
  const phoff = Number(b.readBigUInt64LE(0x20));
  const phentsize = b.readUInt16LE(0x36);
  const phnum = b.readUInt16LE(0x38);
  const elfBytes = Math.max(shoff + shnum * shentsize, phoff + phnum * phentsize);
  if (elfBytes > elf.length || shentsize !== 64) {
    return { error: `the ELF header says ${elfBytes} bytes (shentsize ${shentsize}); the account holds ${elf.length}` };
  }
  const padding = elf.subarray(elfBytes);
  if (padding.some(x => x !== 0)) {
    return { error: `${padding.length} bytes after the ELF are not all zero` };
  }
  return { sha256: hex(sha256(elf.subarray(0, elfBytes))), elfBytes, paddingBytes: padding.length, authority };
}

/** The program account of an upgradeable program: `u32 tag 2 | programData pubkey`. */
export function programDataAddressOf(programAccountData) {
  if (programAccountData.length !== 36 || u32le(programAccountData, 0) !== 2) {
    return null;
  }
  return base58.encode(programAccountData.subarray(4, 36));
}

// --------------------------------------------------------------------------- the wchange_vk

const be32 = dec => {
  const h = BigInt(dec).toString(16).padStart(64, '0');
  if (h.length !== 64) {
    throw new Error('a coordinate above 2^256');
  }
  return Buffer.from(h, 'hex');
};
/**
 * A snarkjs verifying key (vk.json) written in the program's byte encoding — EIP-197: a G1 point
 * x‖y big-endian, a G2 point x.c1‖x.c0‖y.c1‖y.c0 (snarkjs writes G2 as [c0, c1]) — alpha 64 |
 * beta 128 | gamma 128 | delta 128 | IC n×64. Our own writer; the chain's bytes are compared with it.
 */
export function vkBytesFromSnarkjs(vk) {
  if (vk.protocol !== 'groth16' || vk.curve !== 'bn128' || vk.IC.length !== vk.nPublic + 1) {
    throw new Error('not a groth16 / bn128 verifying key with nPublic + 1 IC points');
  }
  const g1 = p => {
    if (p[2] !== '1') {
      throw new Error('a G1 point is not affine');
    }
    return Buffer.concat([be32(p[0]), be32(p[1])]);
  };
  const g2 = p => {
    if (p[2][0] !== '1' || p[2][1] !== '0') {
      throw new Error('a G2 point is not affine');
    }
    return Buffer.concat([be32(p[0][1]), be32(p[0][0]), be32(p[1][1]), be32(p[1][0])]);
  };
  return Buffer.concat([g1(vk.vk_alpha_1), g2(vk.vk_beta_2), g2(vk.vk_gamma_2), g2(vk.vk_delta_2), ...vk.IC.map(g1)]);
}

/** Anchor's account discriminator: sha256("account:<Name>")[0..8]. */
export const accountDiscriminator = name => hex(sha256(new TextEncoder().encode(`account:${name}`)).subarray(0, 8));

/**
 * The `wchange_vk` account (getAccountInfo, base64) against the pinned withdraw_change VK:
 * owner = the A0 program, its address = PDA(["wchange_vk", pool]), the discriminator
 * `account:WithdrawChangeVkAccount`, its pool = 8VMe…, `written` = all 960 bytes, and the 960 VK
 * bytes = the pinned vk.json in the program's encoding. One `{pass, detail}` per check.
 */
export function judgeWchangeVk({ address, account, pinnedVk }) {
  const checks = [];
  const add = (name, pass, detail) => checks.push({ name, pass: Boolean(pass), detail });
  const expected = wchangeVkAddress();
  add('address', address === expected, `${address} (PDA ["wchange_vk", pool] ${expected})`);
  if (!account) {
    add('account', false, 'no account at that address');
    return checks;
  }
  const data = Buffer.from(base64.decode(account.data[0]));
  add('owner', account.owner === A0.programId, `owner ${account.owner}`);
  add('layout', data.length === WCHANGE_VK_LAYOUT.size && hex(data.subarray(0, 8)) === accountDiscriminator('WithdrawChangeVkAccount'), `${data.length} bytes (a WithdrawChangeVkAccount is ${WCHANGE_VK_LAYOUT.size}), discriminator ${hex(data.subarray(0, 8))}`);
  if (data.length !== WCHANGE_VK_LAYOUT.size) {
    return checks;
  }
  const pool = base58.encode(data.subarray(WCHANGE_VK_LAYOUT.pool, WCHANGE_VK_LAYOUT.pool + 32));
  const written = data.readUInt32LE(WCHANGE_VK_LAYOUT.written);
  add('pool', pool === A0.pool, `pool ${pool}`);
  add('written', written === WCHANGE_VK_LAYOUT.vkBytes, `written ${written} of ${WCHANGE_VK_LAYOUT.vkBytes} bytes`);
  const onChain = data.subarray(WCHANGE_VK_LAYOUT.vk, WCHANGE_VK_LAYOUT.vk + WCHANGE_VK_LAYOUT.vkBytes);
  const pinned = vkBytesFromSnarkjs(pinnedVk);
  const firstDiff = [...onChain].findIndex((x, i) => x !== pinned[i]);
  add('vk', pinned.length === onChain.length && firstDiff < 0, firstDiff < 0 && pinned.length === onChain.length ? `the 960 VK bytes on chain = withdraw_change_vk.json (alpha, beta, gamma, delta, 8 IC points)` : `differs from withdraw_change_vk.json at byte ${firstDiff} (pinned ${pinned.length} bytes)`);
  return checks;
}
