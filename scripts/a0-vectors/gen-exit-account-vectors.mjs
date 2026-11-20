#!/usr/bin/env node
/**
 * Offline generator of the exit-account vectors the A0 restore's account walk is tested against
 * (spec 2026-11-08 shielded A0 M1 §7 "Accounts": "each recovered unshield's destination token
 * account is compared with ATA(slip10:n, mint) for n = 0, 1, 2, …"; M1c Task 5).
 *
 * THE ANTI-CIRCULARITY BOUNDARY. The app derives `slip10:n` with core/keys/transparent.ts
 * (micro-key-producer/slip10 + @noble/curves) and the ATA with @solana/web3.js
 * `findProgramAddressSync` (relayerClient.ts `a0AtaOf`). Nothing here imports either, nor any
 * base58 or curve library: every value comes from Node's own crypto (OpenSSL) and the few lines
 * below —
 *   - the BIP-39 seed: PBKDF2-HMAC-SHA512, 2048 rounds, salt "mnemonic";
 *   - SLIP-0010 ed25519 (hardened only), path m/44'/501'/n'/0'; the public key through OpenSSL
 *     (PKCS#8 private key → SPKI export) — as gen-account-vectors.mjs (Task 2) does;
 *   - the ATA: the program-derived address of [owner, TOKEN_PROGRAM_ID, mint] under the associated
 *     token program — SHA-256(seeds ‖ [bump] ‖ program id ‖ "ProgramDerivedAddress"), bump from
 *     255 down, the first candidate that is NOT an Ed25519 point. "Is a point" is curve25519-dalek's
 *     `CompressedEdwardsY::decompress().is_some()` (what Solana's `is_on_curve` calls): y = the 255
 *     low bits little-endian (mod p), u = y² − 1, v = d·y² + 1, and u/v must be a square mod p
 *     (Euler's criterion, 0 included) — with BigInt arithmetic here;
 *   - base58: the Bitcoin alphabet, by BigInt division.
 * Before anything is written the script holds itself to facts it did not compute:
 *   - slip10:0 of "abandon … about" is HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk (the extension's
 *     published vector; also a0-account-vectors.json), and slip10:0..3 of both mnemonics equal
 *     a0-account-vectors.json (Task 2's independent run);
 *   - three ATAs the program side and the chain published: ATA(relayer fee payer 3jvhiz…FaGe) =
 *     9643JXJm…knME9 (the relayer's fee destination, src/modules/shielded/a0/constants.ts
 *     A0_RELAYER.feeDestination), ATA(pool 8VMe…, an off-curve owner) = 3A7JjFg4…juYC (the pool's
 *     vault, A0.vault) and ATA(HV996…ZxdJR) = DzU8HkTy…67Zt (the destination the relayer created
 *     in the landed 3UfCx5TD…, recorded in fixtures/devnet-tree-5URd.json).
 *
 * Output: src/modules/shielded/a0/__tests__/fixtures/a0-exit-account-vectors.json — for both
 * mnemonics, slip10:0 … slip10:30 with address and ATA. Run by hand from the repository root:
 *   node scripts/a0-vectors/gen-exit-account-vectors.mjs           write the fixture
 *   node scripts/a0-vectors/gen-exit-account-vectors.mjs --check   regenerate and compare, write nothing
 */
import {createHash, createHmac, createPrivateKey, createPublicKey, pbkdf2Sync} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'src/modules/shielded/a0/__tests__/fixtures/a0-exit-account-vectors.json');
const ACCOUNT_VECTORS = join(ROOT, 'src/modules/shielded/a0/__tests__/fixtures/a0-account-vectors.json');
const OUT_REL = relative(ROOT, OUT);

const fail = msg => {
  console.error(`gen-exit-account-vectors: ${msg}`);
  process.exit(1);
};

const MNEMONICS = [
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong',
];
const LAST_INDEX = 30;
const MINT = 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs';
const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const ASSOCIATED_TOKEN_PROGRAM_ID = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const ANCHOR_ACCOUNT = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const ANCHOR_ATAS = [
  {owner: '3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe', ata: '9643JXJm5ZZwv8yaTozQ2qMeVw6xHQWhquGsD87knME9', what: 'the relayer fee destination'},
  {owner: '8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT', ata: '3A7JjFg4ZbZrEsvAZReSaWxjCvi5NZUTAyAZaLfQjuYC', what: 'the pool vault'},
  {owner: 'HV996fcQT193sXfh3fgCEDjxsWwWxQC6cVdb1EyZxdJR', ata: 'DzU8HkTy7b5jK8LvahytrsgimF9Navxc9HgzA7y167Zt', what: '3UfCx5TD…\'s destination'},
];

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58(bytes) {
  let n = BigInt(`0x${Buffer.from(bytes).toString('hex') || '0'}`);
  let out = '';
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = `1${out}`;
  }
  return out;
}
function unbase58(s) {
  let n = 0n;
  for (const ch of s) {
    const v = B58.indexOf(ch);
    if (v < 0) fail(`not base58: ${s}`);
    n = n * 58n + BigInt(v);
  }
  let hex = n.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  const body = n === 0n ? Buffer.alloc(0) : Buffer.from(hex, 'hex');
  let zeros = 0;
  while (s[zeros] === '1') zeros++;
  const out = Buffer.concat([Buffer.alloc(zeros), body]);
  if (out.length !== 32) fail(`${s} is ${out.length} bytes, not 32`);
  return out;
}

const seedOf = mnemonic => pbkdf2Sync(Buffer.from(mnemonic.normalize('NFKD')), Buffer.from('mnemonic'), 2048, 64, 'sha512');

function slip10Ed25519(seed, path) {
  let I = createHmac('sha512', 'ed25519 seed').update(seed).digest();
  let k = I.subarray(0, 32);
  let c = I.subarray(32);
  for (const i of path) {
    const data = Buffer.alloc(37);
    k.copy(data, 1);
    data.writeUInt32BE((i + 0x80000000) >>> 0, 33);
    I = createHmac('sha512', c).update(data).digest();
    k = I.subarray(0, 32);
    c = I.subarray(32);
  }
  return Buffer.from(k);
}

const PKCS8_ED25519 = Buffer.from('302e020100300506032b657004220420', 'hex');
function ed25519Public(privateKey32) {
  const priv = createPrivateKey({key: Buffer.concat([PKCS8_ED25519, privateKey32]), format: 'der', type: 'pkcs8'});
  const spki = createPublicKey(priv).export({format: 'der', type: 'spki'});
  if (spki.length !== 44) fail(`unexpected SPKI length ${spki.length}`);
  return spki.subarray(12);
}

// ---- Ed25519 "is a point" (curve25519-dalek CompressedEdwardsY::decompress), BigInt
const P = 2n ** 255n - 19n;
const D = (((-121665n * modPow(121666n, P - 2n)) % P) + P) % P;
function modPow(b, e) {
  let r = 1n;
  b %= P;
  while (e > 0n) {
    if (e & 1n) r = (r * b) % P;
    b = (b * b) % P;
    e >>= 1n;
  }
  return r;
}
function isOnCurve(bytes32) {
  const le = Buffer.from(bytes32).reverse();
  const y = (BigInt(`0x${le.toString('hex')}`) & ((1n << 255n) - 1n)) % P;
  const yy = (y * y) % P;
  const u = (yy - 1n + P) % P;
  const v = (D * yy + 1n) % P;
  const ratio = (u * modPow(v, P - 2n)) % P;
  if (ratio === 0n) return true;
  return modPow(ratio, (P - 1n) / 2n) === 1n;
}
if (D !== 37095705934669439343138083508754565189542113879843219016388785533085940283555n) fail('d is wrong');

function ataOf(ownerBase58) {
  const seeds = [unbase58(ownerBase58), unbase58(TOKEN_PROGRAM_ID), unbase58(MINT)];
  const program = unbase58(ASSOCIATED_TOKEN_PROGRAM_ID);
  for (let bump = 255; bump >= 0; bump--) {
    const h = createHash('sha256');
    for (const s of seeds) h.update(s);
    h.update(Buffer.from([bump])).update(program).update(Buffer.from('ProgramDerivedAddress'));
    const candidate = h.digest();
    if (!isOnCurve(candidate)) return base58(candidate);
  }
  fail(`no bump for ${ownerBase58}`);
}

for (const a of ANCHOR_ATAS) {
  const got = ataOf(a.owner);
  if (got !== a.ata) fail(`ATA(${a.owner}) is ${got}, not ${a.ata} (${a.what})`);
}

const accountVectors = JSON.parse(readFileSync(ACCOUNT_VECTORS, 'utf8'));
const seeds = MNEMONICS.map(mnemonic => {
  const seed = seedOf(mnemonic);
  const known = accountVectors.seeds.find(s => s.mnemonic === mnemonic);
  if (!known || known.seed !== seed.toString('hex')) fail(`the seed of "${mnemonic}" differs from a0-account-vectors.json`);
  const accounts = [];
  for (let n = 0; n <= LAST_INDEX; n++) {
    const address = base58(ed25519Public(slip10Ed25519(seed, [44, 501, n, 0])));
    const k = known.accounts.find(a => a.scheme === `slip10:${n}`);
    if (k && k.address !== address) fail(`slip10:${n} of "${mnemonic}" differs from a0-account-vectors.json`);
    accounts.push({scheme: `slip10:${n}`, address, ata: ataOf(address)});
  }
  return {mnemonic, accounts};
});
if (seeds[0].accounts[0].address !== ANCHOR_ACCOUNT) fail(`slip10:0 is ${seeds[0].accounts[0].address}, not ${ANCHOR_ACCOUNT}`);
const all = seeds.flatMap(s => s.accounts.flatMap(a => [a.address, a.ata]));
if (new Set(all).size !== all.length) fail('two vectors share an address');

const doc = {
  description:
    `slip10:n (SLIP-0010 ed25519 m/44'/501'/n'/0') addresses and their associated token accounts for the A0 mint ${MINT}, n = 0..${LAST_INDEX} (spec §7 "Accounts"). ` +
    'Written by scripts/a0-vectors/gen-exit-account-vectors.mjs from Node crypto (PBKDF2, HMAC-SHA512, OpenSSL Ed25519, SHA-256), its own Ed25519 decompression check and its own base58; it imports neither core/keys/transparent.ts nor @solana/web3.js nor micro-key-producer nor @noble. ' +
    'Anchored to the extension\'s slip10:0 vector, to a0-account-vectors.json and to three published ATAs (relayer fee destination, pool vault, 3UfCx5TD…\'s destination). Rerun: node scripts/a0-vectors/gen-exit-account-vectors.mjs [--check].',
  mint: MINT,
  seeds,
};
const text = `${JSON.stringify(doc, null, 2)}\n`;

if (process.argv.includes('--check')) {
  const current = readFileSync(OUT, 'utf8');
  if (current !== text) fail(`${OUT_REL} differs from a fresh run`);
  console.log(`gen-exit-account-vectors: ${OUT_REL} matches (${seeds.length} seeds × ${seeds[0].accounts.length} accounts)`);
} else {
  writeFileSync(OUT, text);
  console.log(`gen-exit-account-vectors: wrote ${OUT_REL} (${seeds.length} seeds × ${seeds[0].accounts.length} accounts)`);
}
