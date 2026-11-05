import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {argon2idKdf} from '../../vault/kdf';
import {decryptMnemonic, unlockWithPassword, unlockWithPrf, type EnvelopeV1} from '../../vault/envelope';
import {envelopeShape, vaultReading as backgroundReading} from '../../background/accountsStore';
import {storedVault, vaultReading as pageReading} from '../../unlock/stored';
import {unreadableV1} from '../unreadable';
import {base64} from '@scure/base';
import {DELETABLE, F, F_WALLETS, PASSWORD, breadth, edited, firstEncoder, type Json} from './vaultControls';

// B1e §2.1, §2.6: the frozen predicate, and the readings both sides build on it.

const SOURCE = readFileSync(new URL('../unreadable.ts', import.meta.url), 'utf8');

/** Every module specifier a TypeScript source names: static and type imports, re-exports, dynamic import(), require(). */
function specifiers(source: string): string[] {
  const out: string[] = [];
  for (const re of [/\bfrom\s*['"]([^'"]+)['"]/g, /\bimport\s*['"]([^'"]+)['"]/g, /\bimport\s*\(\s*['"`]([^'"`]+)['"`]/g, /\brequire\s*\(\s*['"`]([^'"`]+)['"`]/g]) {
    for (const m of source.matchAll(re)) out.push(m[1] ?? '');
  }
  return out;
}

const kinds = (raw: unknown) => [backgroundReading(raw).kind, pageReading(raw).kind];

describe('unreadable.ts is frozen and stands alone', () => {
  it('imports exactly @scure/base, and nothing else', () => {
    expect(specifiers(SOURCE)).toEqual(['@scure/base']);
  });

  it('the import scan sees every form of import (negative control)', () => {
    const planted = [
      "import {ENVELOPE_KDF_MIN} from './envelopeRules';",
      "import type {EnvelopeV1} from '../vault/envelope';",
      "export {MAX_ACCOUNTS} from './envelopeRules';",
      "import './side-effect';",
      "const m = await import('./envelopeRules');",
      "const r = require('./envelopeRules');",
    ];
    for (const line of planted) expect(specifiers(`${SOURCE}\n${line}\n`)).not.toEqual(['@scure/base']);
  });

  it('says it is frozen, and names its constants FROZEN_*', () => {
    expect(SOURCE).toContain('Frozen at B1e rev 2; never edited — a later envelope format gets its own rule in a new module; tightening the');
    expect(SOURCE).toContain("opener's policy never touches this file.");
    const consts = [...SOURCE.matchAll(/^const ([A-Z_]+) = /gm)].map(m => m[1]);
    expect(consts.length).toBeGreaterThan(0);
    for (const c of consts) expect(c).toMatch(/^FROZEN_/);
  });
});

// The controls stand on two committed files: a swapped or edited fixture must fail here, not move the controls.
const FIXTURE_SHA256: readonly (readonly [string, string])[] = [
  ['envelope-v1.json', 'e143c9943b15bdcef88f7472d38ae6370936ebb1299b462f5a9d9b6690baaed0'],
  ['envelope-v1-458dfcd.json', 'ac827eea0975e4c6240b0cefc3a5105b4d0d6f173375764552004a44d314d905'],
];

describe('the fixtures the controls read are pinned', () => {
  it.each(FIXTURE_SHA256)('%s has its committed sha256', (name, sha256) => {
    const bytes = readFileSync(new URL(`../../vault/__tests__/fixtures/${name}`, import.meta.url));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(sha256);
  });
});

describe('unreadableV1 (§2.1 U1–U3)', () => {
  it('is false for undefined: no wallet is not a damaged one', () => {
    expect(unreadableV1(undefined)).toBe(false);
    expect(kinds(undefined)).toEqual(['none', 'none']);
  });

  it.each(DELETABLE)('%s → unreadable', (_, raw) => {
    expect(unreadableV1(raw)).toBe(true);
  });

  it.each(F)('%s → readable (never deletable)', (_, raw) => {
    expect(unreadableV1(raw)).toBe(false);
  });

  it('every readable F control is a wallet (F0, F1, F9–F12, F18) or refused by this version (F2–F8, F13–F17), the same on both sides', () => {
    for (const [name, raw] of F) {
      const expected = F_WALLETS.includes(name.split(' ')[0] ?? '') ? 'wallet' : 'refused';
      expect([name, ...kinds(raw)]).toEqual([name, expected, expected]);
    }
  });

  it('a later version is never judged: v ≥ 2 is readable whatever its structure, and refused', () => {
    for (const raw of [{v: 2}, {v: 3, scheme: 1, kdf: 'x'}, edited(e => ((e.v = 2), delete e.seed)), {v: Number.MAX_SAFE_INTEGER}]) {
      expect(unreadableV1(raw)).toBe(false);
      expect(kinds(raw)).toEqual(['refused', 'refused']);
    }
  });

  it('what is policy, not structure, is readable: a KDF cost of any safe integer, an unknown scheme string, an empty publicKey, duplicate indexes', () => {
    const readable = [
      edited(e => ((e.kdf as Json).m = 0)),
      edited(e => ((e.kdf as Json).t = -5)),
      edited(e => ((e.kdf as Json).p = Number.MAX_SAFE_INTEGER)),
      edited(e => (e.scheme = '')),
      edited(e => ((e.accounts as Json[])[0] = {index: 0, name: 'Account 1', publicKey: ''})),
      edited(e => (e.accounts = [...(e.accounts as Json[]), ...(e.accounts as Json[])])),
    ];
    for (const raw of readable) {
      expect(unreadableV1(raw)).toBe(false);
      expect(kinds(raw)).toEqual(['refused', 'refused']);
    }
  });
});

describe('the partition (§2.1): the four readings never overlap', () => {
  it.each(DELETABLE)('%s is refused by both openers: envelopeShape null, storedVault damaged — read as unreadable on both sides', (_, raw) => {
    expect(envelopeShape(raw)).toBeNull();
    expect(storedVault(raw).kind).toBe('damaged');
    expect(kinds(raw)).toEqual(['unreadable', 'unreadable']);
  });

  it('every wallet both openers accept is readable (positive control of the partition)', () => {
    for (const [name, raw] of F.filter(([n]) => F_WALLETS.includes(n.split(' ')[0] ?? ''))) {
      expect([name, envelopeShape(raw) !== null, storedVault(raw).kind, unreadableV1(raw)]).toEqual([name, true, 'wallet', false]);
    }
  });
});

describe('breadth (§2.6, review 2 Minor 4): everything a v1 writer ever produced is readable and accepted', () => {
  it('the real encoder: cli, 100 accounts, the KDF cap, odd names, rewrapPassword, reencryptForAccounts, passkeys of 1, 64 and 1023 bytes, the shortest and the longest seed, the largest account index', async () => {
    const all = await breadth();
    expect(all).toHaveLength(13);
    for (const [name, raw] of all) {
      expect([name, unreadableV1(raw), envelopeShape(raw) !== null, storedVault(raw).kind, ...kinds(raw)]).toEqual([name, false, true, 'wallet', 'wallet', 'wallet']);
    }
  }, 60_000);

  it('the extreme controls sit at the extremes of the open-ended clauses (fix rounds 1 and 2, review I1 and I1b)', async () => {
    const len = (x: unknown): number => base64.decode(String(x)).length;
    const maxIndex = (raw: Json): number => Math.max(...(raw.accounts as Json[]).map(a => Number(a.index)));
    const byName = new Map<string, Json>([...F, ...(await breadth())]);
    const at = (name: string): Json => {
      const raw = byName.get(name);
      if (raw === undefined) throw new Error(`no control named ${name}`);
      return raw;
    };
    expect([
      len((at('F10 seed.ct of exactly 17 bytes (the smallest v1 ciphertext)').seed as Json).ct),
      len((at('createEnvelope 12 three-letter words (seed.ct 63 bytes)').seed as Json).ct),
      len((at('createEnvelope 24 eight-letter words (seed.ct 231 bytes)').seed as Json).ct),
      len((at('F11 a credentialId of 1023 bytes (the WebAuthn maximum)').passkey as Json).credentialId),
      len((at('addPasskeyWrap, a 1023-byte credential ID').passkey as Json).credentialId),
      maxIndex(at('after reencryptForAccounts (account 2^31 - 1 added, the largest index E13 reaches)')),
      maxIndex(at('F12 a second account at index Number.MAX_SAFE_INTEGER')),
      String(at('F13 scheme: a 64-character name (a later scheme)').scheme).length,
      (at('F14 kdf.p = 0').kdf as Json).p,
      (at('F15 kdf.m = Number.MAX_SAFE_INTEGER').kdf as Json).m,
      (at('F16 kdf.t = Number.MAX_SAFE_INTEGER').kdf as Json).t,
      (at('F17 1000 accounts').accounts as Json[]).length,
      len((at('F18 seed.ct of 65536 bytes').seed as Json).ct),
    ]).toEqual([17, 63, 231, 1023, 1023, 2 ** 31 - 1, Number.MAX_SAFE_INTEGER, 64, 0, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 1000, 65536]);
  }, 60_000);

  it('the first encoder (458dfcd), with and without a passkey', () => {
    for (const [name, raw] of firstEncoder()) {
      expect([name, unreadableV1(raw), envelopeShape(raw) !== null, storedVault(raw).kind, ...kinds(raw)]).toEqual([name, false, true, 'wallet', 'wallet', 'wallet']);
    }
  });

  it('the 458dfcd fixture is that encoder’s real output: its password and its passkey unwrap one data key, and the seed it wrote predates the header binding', async () => {
    const [[, created], [, withPasskey]] = firstEncoder() as [[string, Json], [string, Json]];
    const byPassword = await unlockWithPassword(created as unknown as EnvelopeV1, PASSWORD, argon2idKdf);
    const byPasskey = await unlockWithPrf(withPasskey as unknown as EnvelopeV1, Uint8Array.from({length: 32}, (_, i) => 0xa0 + i));
    expect(byPasskey).toEqual(byPassword);
    // The first encoder sealed the seed without additionalData: today's opener reads it as a wallet whose seed then
    // fails AES-GCM (§2.1 "out of the predicate") — readable, so never deletable without a password.
    await expect(decryptMnemonic(created as unknown as EnvelopeV1, byPassword)).rejects.toThrow();
  }, 60_000);
});
