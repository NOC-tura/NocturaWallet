// B1e §5.3: the store's public key for the extension, recorded after the Chrome Web Store assigns the ID at the first
// upload (§7 step 7) in release/store-key.json as exactly {id, key}. Only `node scripts/build.mjs <outDir> --dev-key`
// and `node scripts/check-permissions.mjs --dev-key <outDir>` read it: an unpacked install that carries the key has
// the store's ID (so a passkey or an allowlist bound to that ID can be tried before release). `verify`, the E2E builds
// and the release never pass a key — the store package never carries one.
//
// The file is refused unless it is exactly what the store gave:
// - `key`: the manifest form of the public key — canonical base64 of a DER SubjectPublicKeyInfo, one line, no PEM
//   armour, no whitespace (the dashboard shows it as PEM: strip the BEGIN / END lines and the line breaks);
// - `id`: 32 letters a–p, and equal to the ID Chrome derives from `key` — the first 16 bytes of the sha256 of the DER
//   bytes, each hex digit 0–f written as a–p (observed: Chromium 153 loads an unpacked extension carrying a fresh key
//   under exactly this ID — scripts/__tests__/fixtures/chrome-id-vector.json). A key pasted from elsewhere, or an ID
//   copied from another item, fails here, not after a build that silently has another ID.
import {createHash, createPublicKey} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** Package-relative, as the spec and the checklist name it. */
export const STORE_KEY = 'release/store-key.json';
/** The one path the build and the gate read. */
export const STORE_KEY_PATH = join(ROOT, STORE_KEY);

const ID = /^[a-p]{32}$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** The extension ID Chrome derives from a public key's DER bytes. */
export function extensionId(der) {
  return [...createHash('sha256').update(der).digest().subarray(0, 16).toString('hex')].map(c => String.fromCharCode(97 + Number.parseInt(c, 16))).join('');
}

/** Every reason `value` (a parsed store-key.json) is not exactly {id, key} as §5.3 records it; [] when it is. */
export function storeKeyProblems(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return ['must be a JSON object {id, key}'];
  const names = Object.keys(value).sort();
  if (names.join(',') !== 'id,key') return [`must hold exactly the fields id and key, has ${names.length ? names.join(', ') : 'none'}`];
  const {id, key} = value;
  const problems = [];
  if (typeof id !== 'string' || !ID.test(id)) problems.push(`id must be 32 letters a–p, is ${JSON.stringify(id)}`);
  if (typeof key !== 'string' || !BASE64.test(key) || Buffer.from(key, 'base64').toString('base64') !== key) {
    problems.push('key must be the public key as one line of canonical base64 (no PEM BEGIN / END lines, no line breaks)');
    return problems;
  }
  const der = Buffer.from(key, 'base64');
  try {
    createPublicKey({key: der, format: 'der', type: 'spki'});
  } catch {
    problems.push('key is not a DER SubjectPublicKeyInfo public key');
    return problems;
  }
  if (problems.length === 0 && extensionId(der) !== id) problems.push(`id ${id} is not the ID of this key (${extensionId(der)})`);
  return problems;
}

/** Reads and checks the store key at `path`; throws, naming the file and every problem, unless it is exactly {id, key}. */
export function readStoreKey(path = STORE_KEY_PATH) {
  if (!existsSync(path)) {
    throw new Error(`${path}: absent — the store assigns the ID at the first upload; record {id, key} then (B1e §5.3, §7 step 7)`);
  }
  let value;
  try {
    value = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new Error(`${path}: unreadable or not JSON (${e.message})`);
  }
  const problems = storeKeyProblems(value);
  if (problems.length) throw new Error(`${path}: ${problems.join('; ')}`);
  return {id: value.id, key: value.key};
}
