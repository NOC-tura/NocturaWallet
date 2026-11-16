/**
 * The A0 key files as the app gets them (spec §1 "A0 proving keys", R4): the JS pins are the Rust
 * pins (read from native/noctura-prover/src/a0/keyfiles.rs — the control native enforces), every
 * URL is content-addressed under /h/<sha256>/a0/<file>, and a file whose sha256 is not its pin is
 * deleted and refused.
 */
import {readFileSync} from 'fs';
import {join} from 'path';
import {A0_KEY_ASSETS, A0_NPUBLIC, ensureA0KeyFiles} from '../keyAssets';
import type {AssetIO} from '../../../zkProver/provingAssets';

const RUST = readFileSync(join(__dirname, '../../../../../native/noctura-prover/src/a0/keyfiles.rs'), 'utf8');
/** `const DEPOSIT: CircuitPins = … zkey: Pin { file: "…", sha256: "…", … }` per circuit. */
function rustPins(name: 'DEPOSIT' | 'WITHDRAW_CHANGE') {
  const block = new RegExp(`const ${name}: CircuitPins = CircuitPins \\{([\\s\\S]*?)\\n\\};`).exec(RUST)![1]!;
  const pin = (kind: string) => {
    const m = new RegExp(`${kind}: Pin \\{ file: "([^"]+)", sha256: "([0-9a-f]{64})"`).exec(block)!;
    return {file: m[1]!, sha256: m[2]!};
  };
  return {zkey: pin('zkey'), wasm: pin('wasm')};
}

describe('the JS pins are the Rust pins', () => {
  it.each([
    ['deposit', 'DEPOSIT'],
    ['withdraw_change', 'WITHDRAW_CHANGE'],
  ] as const)('%s', (circuit, rust) => {
    const r = rustPins(rust);
    for (const kind of ['zkey', 'wasm'] as const) {
      const a = A0_KEY_ASSETS[circuit][kind];
      expect(a.sha256).toBe(r[kind].sha256);
      expect(a.url).toBe(`https://api.noc-tura.io/api/v1/zk-assets/h/${r[kind].sha256}/a0/${r[kind].file}`);
    }
  });
  it('the spec\'s digest prefixes (§1)', () => {
    expect(A0_KEY_ASSETS.deposit.zkey.sha256).toMatch(/^fef08f02.*3fe9$/);
    expect(A0_KEY_ASSETS.deposit.wasm.sha256).toMatch(/^1d69d7f8.*dfff1$/);
    expect(A0_KEY_ASSETS.withdraw_change.zkey.sha256).toMatch(/^ec55bdbb.*d756f2$/);
    expect(A0_KEY_ASSETS.withdraw_change.wasm.sha256).toMatch(/^01b0ec1f.*45e0b9$/);
    expect(A0_NPUBLIC).toEqual({deposit: 4, withdraw_change: 7});
  });
  it('negative control: the reader sees a one-character change', () => {
    const tampered = RUST.replace('fef08f02', 'fef08f03');
    const m = /zkey: Pin \{ file: "deposit_final.zkey", sha256: "([0-9a-f]{64})"/.exec(tampered)!;
    expect(m[1]).not.toBe(A0_KEY_ASSETS.deposit.zkey.sha256);
  });
});

function memoryIO(contents: Record<string, string> = {}) {
  const files = new Map(Object.entries(contents));
  const log: string[] = [];
  const io: AssetIO = {
    cachePath: (id, kind) => `/c/noctura-${id}.${kind}`,
    exists: async p => files.has(p),
    download: async (url, p) => {
      log.push(`download ${url}`);
      files.set(p, /\/h\/([0-9a-f]{64})\//.exec(url)![1]!);
    },
    sha256: async p => files.get(p)!,
    remove: async p => {
      log.push(`remove ${p}`);
      files.delete(p);
    },
  };
  return {io, files, log};
}

describe('ensureA0KeyFiles', () => {
  it('downloads the missing pair by digest, verifies both, returns the a0-<circuit> cache paths', async () => {
    const m = memoryIO();
    await expect(ensureA0KeyFiles('deposit', m.io)).resolves.toEqual({
      zkeyPath: '/c/noctura-a0-deposit.zkey',
      wasmPath: '/c/noctura-a0-deposit.wasm',
    });
    expect(m.log).toEqual([`download ${A0_KEY_ASSETS.deposit.zkey.url}`, `download ${A0_KEY_ASSETS.deposit.wasm.url}`]);
  });
  it('a cached file is re-verified on every call, not re-downloaded', async () => {
    const m = memoryIO({
      '/c/noctura-a0-deposit.zkey': A0_KEY_ASSETS.deposit.zkey.sha256,
      '/c/noctura-a0-deposit.wasm': A0_KEY_ASSETS.deposit.wasm.sha256,
    });
    await ensureA0KeyFiles('deposit', m.io);
    expect(m.log).toEqual([]);
  });
  it('a cached file whose digest is not the pin is deleted and refused', async () => {
    const m = memoryIO({'/c/noctura-a0-deposit.zkey': '0'.repeat(64)});
    await expect(ensureA0KeyFiles('deposit', m.io)).rejects.toThrow(/SHA-256 mismatch/);
    expect(m.log).toEqual(['remove /c/noctura-a0-deposit.zkey']);
  });
  it('the A0 cache never shares a path with the v1 set (noctura-deposit.zkey)', async () => {
    const m = memoryIO({'/c/noctura-deposit.zkey': 'v1'});
    await ensureA0KeyFiles('deposit', m.io);
    expect(m.files.get('/c/noctura-deposit.zkey')).toBe('v1');
  });
});
