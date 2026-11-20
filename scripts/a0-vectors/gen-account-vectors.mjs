#!/usr/bin/env node
/**
 * Offline generator of the account vectors the A0 account registry is tested against (spec
 * 2026-11-08 shielded A0 M1 §10 "Derivation", §14 "multi-account derivation equal to the
 * extension's for slip10:0..3"; M1c Task 2).
 *
 * THE ANTI-CIRCULARITY BOUNDARY. The app and the extension derive `slip10:n` with ONE piece of code,
 * `core/keys/transparent.ts` (micro-key-producer/slip10 + @noble/curves). Nothing here imports it,
 * nor micro-key-producer, nor @noble, nor any base58 library: every value is computed by Node's own
 * crypto (OpenSSL) and a few lines below —
 *   - the BIP-39 seed: PBKDF2-HMAC-SHA512, 2048 rounds, salt "mnemonic" (+ empty passphrase);
 *   - SLIP-0010 ed25519 (hardened only): master = HMAC-SHA512("ed25519 seed", seed), child =
 *     HMAC-SHA512(c, 0x00 || k || ser32(i + 2^31)), path m/44'/501'/n'/0';
 *   - the `cli` scheme: the first 32 bytes of the seed, no derivation (`solana-keygen new`);
 *   - the Ed25519 public key: OpenSSL's, through a PKCS#8 private key → SPKI export;
 *   - base58: the Bitcoin alphabet, by BigInt division.
 * Before anything is written the script holds itself to two facts it did not compute:
 *   - slip10:0 of "abandon … about" is HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk (the address
 *     Phantom / Solflare show for that phrase, and the extension's published test vector,
 *     extension/src/vault/__tests__/accounts.test.ts);
 *   - each mnemonic's seed equals the seed of the same mnemonic in the A0 key vectors
 *     (native/noctura-prover/tests/fixtures/a0-key-vectors.json, written by @scure/bip39).
 * A mismatch stops the script. No network.
 *
 * Run by hand from the repository root:
 *   node scripts/a0-vectors/gen-account-vectors.mjs           write the fixture
 *   node scripts/a0-vectors/gen-account-vectors.mjs --check   regenerate and compare, write nothing
 */
import {createHmac, createPrivateKey, createPublicKey, pbkdf2Sync} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'src/modules/shielded/a0/__tests__/fixtures/a0-account-vectors.json');
const KEY_VECTORS = join(ROOT, 'native/noctura-prover/tests/fixtures/a0-key-vectors.json');
const OUT_REL = relative(ROOT, OUT);

const fail = msg => {
  console.error(`gen-account-vectors: ${msg}`);
  process.exit(1);
};

const MNEMONICS = [
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong',
];
/** The accounts §14 names (0..3) and the highest index the registry accepts (2^31 − 1). */
const INDICES = [0, 1, 2, 3, 2 ** 31 - 1];
const ANCHOR = {mnemonic: MNEMONICS[0], scheme: 'slip10:0', address: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'};

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

const keyVectors = JSON.parse(readFileSync(KEY_VECTORS, 'utf8'));
const seeds = MNEMONICS.map(mnemonic => {
  const seed = seedOf(mnemonic);
  const known = keyVectors.seeds.find(s => s.mnemonic === mnemonic);
  if (!known) fail(`${relative(ROOT, KEY_VECTORS)} has no seed for "${mnemonic}"`);
  if (known.seed !== seed.toString('hex')) fail(`the seed of "${mnemonic}" differs from ${relative(ROOT, KEY_VECTORS)}`);
  const accounts = [{scheme: 'cli', address: base58(ed25519Public(seed.subarray(0, 32)))}];
  for (const n of INDICES) {
    accounts.push({scheme: `slip10:${n}`, address: base58(ed25519Public(slip10Ed25519(seed, [44, 501, n, 0])))});
  }
  return {mnemonic, seed: seed.toString('hex'), accounts};
});

const anchor = seeds.find(s => s.mnemonic === ANCHOR.mnemonic).accounts.find(a => a.scheme === ANCHOR.scheme);
if (anchor.address !== ANCHOR.address) fail(`slip10:0 of the anchor mnemonic is ${anchor.address}, not ${ANCHOR.address}`);
const all = seeds.flatMap(s => s.accounts.map(a => a.address));
if (new Set(all).size !== all.length) fail('two vectors share an address');

const doc = {
  description:
    'Transparent account addresses per TransparentScheme (spec §10): slip10:n = SLIP-0010 ed25519 m/44\'/501\'/n\'/0\', cli = ed25519 of seed[0..32]. ' +
    'Written by scripts/a0-vectors/gen-account-vectors.mjs from Node crypto (PBKDF2, HMAC-SHA512, OpenSSL Ed25519) and its own base58; it imports neither core/keys/transparent.ts nor micro-key-producer nor @noble. ' +
    `Anchored to ${ANCHOR.address} (slip10:0 of the first mnemonic, the extension's test vector) and to the seeds of a0-key-vectors.json. Rerun: node scripts/a0-vectors/gen-account-vectors.mjs [--check].`,
  anchor: ANCHOR,
  seeds,
};
const text = `${JSON.stringify(doc, null, 2)}\n`;

if (process.argv.includes('--check')) {
  const current = readFileSync(OUT, 'utf8');
  if (current !== text) fail(`${OUT_REL} differs from a fresh run`);
  console.log(`gen-account-vectors: ${OUT_REL} matches (${seeds.length} seeds × ${seeds[0].accounts.length} schemes)`);
} else {
  writeFileSync(OUT, text);
  console.log(`gen-account-vectors: wrote ${OUT_REL} (${seeds.length} seeds × ${seeds[0].accounts.length} schemes)`);
}
