/** One pinned file: its download URL and the lowercase hex SHA-256 it must hash to. */
export interface PinnedAsset {
  url: string;
  sha256: string;
}

/** A circuit's proving key and witness wasm, each pinned. */
export interface CircuitAssets {
  zkey: PinnedAsset;
  wasm: PinnedAsset;
}

/** Injected filesystem/download/hash boundary (real impl wraps react-native-fs;
 *  tests mock it). Kept an interface so the pure download/verify/cache logic is
 *  fully unit-testable without native FS. `cachePath` is keyed by circuit AND kind
 *  so the zkey and wasm cache to distinct files. */
export interface AssetIO {
  exists(path: string): Promise<boolean>;
  download(url: string, path: string): Promise<void>;
  sha256(path: string): Promise<string>;
  remove(path: string): Promise<void>;
  cachePath(id: string, kind: 'zkey' | 'wasm'): string;
}

/** Download-if-missing → re-verify SHA-256 → return path. A mismatch deletes the
 *  file and throws — never returns an unverified artifact. */
async function ensureOne(
  url: string,
  sha256: string,
  path: string,
  io: AssetIO,
): Promise<string> {
  if (!(await io.exists(path))) {
    await io.download(url, path);
  }
  const actual = await io.sha256(path);
  if (actual !== sha256) {
    await io.remove(path);
    throw new Error(`SHA-256 mismatch for '${path}' — rejected`);
  }
  return path;
}

/**
 * Return local paths to a pinned zkey AND witness wasm, each guaranteed to match its SHA-256.
 * Downloads on first use; re-verifies cached copies on every call so tampering is caught. A
 * mismatch deletes the file and throws — proving never proceeds on an unverified file. The pins
 * are compiled into the binary (the A0 set: `shielded/a0/keyAssets.ts`) and must be: pins fetched
 * at run time would let a compromised host serve any zkey with a matching hash. `cacheId` names
 * the cache files (`io.cachePath(cacheId, kind)`).
 */
export async function ensurePinnedAssets(
  cacheId: string,
  {zkey, wasm}: CircuitAssets,
  io: AssetIO,
): Promise<{zkeyPath: string; wasmPath: string}> {
  const zkeyPath = await ensureOne(zkey.url, zkey.sha256, io.cachePath(cacheId, 'zkey'), io);
  const wasmPath = await ensureOne(wasm.url, wasm.sha256, io.cachePath(cacheId, 'wasm'), io);
  return {zkeyPath, wasmPath};
}

/**
 * A pinned URL must NAME the bytes it points at (`/h/<sha256>/`). The pin sets build their URLs
 * from the digest, so this catches a literal written by hand later — a mutable pointer under an
 * immutable promise. Run at import by each pin set.
 */
export function assertContentAddressed(assets: Readonly<Record<string, CircuitAssets>>): void {
  for (const [id, circuit] of Object.entries(assets)) {
    for (const [kind, asset] of Object.entries(circuit) as Array<[string, PinnedAsset]>) {
      if (!asset.url.includes(`/h/${asset.sha256}/`)) {
        throw new Error(`${id}.${kind} is pinned to a URL that does not name its digest: ${asset.url}`);
      }
    }
  }
}
