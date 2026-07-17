import {circuitAssets, type CircuitId} from '../../constants/provingAssets';

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
 * Return local paths to the circuit's proving key AND witness wasm, each guaranteed
 * to match its pinned SHA-256. Downloads on first use; re-verifies cached copies on
 * every call so tampering is caught. A mismatch deletes the file and throws —
 * proving never proceeds on an unverified artifact. BOTH are downloaded (the wasm is
 * NOT bundled) so the circuit set can rotate without an app-store release.
 */
export async function ensureCircuitAssets(
  id: CircuitId,
  io: AssetIO,
): Promise<{zkeyPath: string; wasmPath: string}> {
  const {zkey, wasm} = circuitAssets(id);
  const zkeyPath = await ensureOne(zkey.url, zkey.sha256, io.cachePath(id, 'zkey'), io);
  const wasmPath = await ensureOne(wasm.url, wasm.sha256, io.cachePath(id, 'wasm'), io);
  return {zkeyPath, wasmPath};
}
