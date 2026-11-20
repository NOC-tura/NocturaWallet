#!/usr/bin/env node
/**
 * Reads the recorded wire bytes of a landed relayed `withdraw_with_change` (a `fetch-devnet-tx.mjs`
 * fixture, `encoding: 'base64'`) WITHOUT the wallet's code and without @solana/web3.js, and prints
 * the facts the post-landing verifier's positive controls expect (M1c Task 4): the signers, every
 * top-level instruction's program and its first accounts, the create-ATA-idempotent accounts, the
 * grant transfer, and the withdraw's destination / fee payer / fee destination / nullifier / amount /
 * change commitment / fee (§1 layout: disc 8 | merkle_root 32 | nullifier 32 | amount u64 LE |
 * change_commitment 32 | fee u64 LE | u32 256 | proof). Legacy messages only (the fixtures are).
 *
 * The literals in `src/modules/shielded/a0/__tests__/landedVerifier.test.ts` for 5F8Ks5qa… and
 * 5sKiWZTv… are this script's output. Offline; no network. Run from the repository root:
 *   node scripts/a0-fixtures/read-landed-withdraw.mjs <fixture.json> [...]
 */
import { readFileSync } from 'node:fs';

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58(bytes) {
  let n = BigInt(`0x${Buffer.from(bytes).toString('hex') || '0'}`);
  let s = '';
  while (n > 0n) {
    s = B58[Number(n % 58n)] + s;
    n /= 58n;
  }
  for (const x of bytes) {
    if (x !== 0) break;
    s = `1${s}`;
  }
  return s;
}
function shortvec(b, i) {
  let v = 0;
  let shift = 0;
  for (;;) {
    const x = b[i++];
    v |= (x & 0x7f) << shift;
    shift += 7;
    if (x < 0x80) return [v, i];
  }
}
const u64le = (b, at) => Buffer.from(b.subarray(at, at + 8)).readBigUInt64LE(0);
const hex = b => Buffer.from(b).toString('hex');

const SYSTEM = '11111111111111111111111111111111';
const ATA = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const POOL_PROGRAM = 'FeGSSsJtmA7GnMgnpj33JsiceSk1NyFopff2FtQFsMuH';

function read(path) {
  const fx = JSON.parse(readFileSync(path, 'utf8'));
  const raw = Buffer.from(fx.result.transaction[0], 'base64');
  let [n, i] = shortvec(raw, 0);
  const signature = b58(raw.subarray(i, i + 64));
  i += 64 * n;
  const msg = raw.subarray(i);
  if (msg[0] & 0x80) throw new Error(`${path}: not a legacy message`);
  const header = [msg[0], msg[1], msg[2]];
  let j = 3;
  let nk;
  [nk, j] = shortvec(msg, j);
  const keys = [];
  for (let k = 0; k < nk; k++) keys.push(b58(msg.subarray(j + 32 * k, j + 32 * k + 32)));
  j += 32 * nk + 32; // keys, recent blockhash
  let ni;
  [ni, j] = shortvec(msg, j);
  const out = { signature, signers: keys.slice(0, header[0]), programs: [], createAta: [], transfers: [], withdraw: null };
  for (let x = 0; x < ni; x++) {
    const program = keys[msg[j++]];
    let na;
    [na, j] = shortvec(msg, j);
    const acc = [...msg.subarray(j, j + na)].map(a => keys[a]);
    j += na;
    let dl;
    [dl, j] = shortvec(msg, j);
    const data = msg.subarray(j, j + dl);
    j += dl;
    out.programs.push(program);
    if (program === ATA && dl === 1 && data[0] === 1) {
      out.createAta.push({ payer: acc[0], ata: acc[1], owner: acc[2], mint: acc[3] });
    } else if (program === SYSTEM && dl === 12 && data.readUInt32LE(0) === 2) {
      out.transfers.push({ from: acc[0], to: acc[1], lamports: u64le(data, 4).toString() });
    } else if (program === POOL_PROGRAM) {
      out.withdraw = {
        destination: acc[3],
        feePayer: acc[5],
        feeDestination: acc[6],
        nullifier: hex(data.subarray(40, 72)),
        amount: u64le(data, 72).toString(),
        changeCommitment: hex(data.subarray(80, 112)),
        fee: u64le(data, 112).toString(),
      };
    }
  }
  return out;
}

for (const p of process.argv.slice(2)) {
  console.log(JSON.stringify(read(p), null, 2));
}
