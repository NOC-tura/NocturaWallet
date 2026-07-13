import {zkeyAsset, type CircuitId} from '../../constants/provingAssets';

/** Injected filesystem/download/hash boundary (real impl wraps react-native-fs;
 *  tests mock it). Kept an interface so the pure download/verify/cache logic is
 *  fully unit-testable without native FS. */
export interface AssetIO {
  exists(path: string): Promise<boolean>;
  download(url: string, path: string): Promise<void>;
  sha256(path: string): Promise<string>;
  remove(path: string): Promise<void>;
  cachePath(id: string): string;
}

/**
 * Return a local path to the circuit's proving key, guaranteed to match the pinned
 * SHA-256. Downloads on first use; re-verifies the cached copy on every call so
 * cache tampering is caught. A mismatch deletes the file and throws — proving never
 * proceeds on an unverified key.
 */
export async function ensureZkey(id: CircuitId, io: AssetIO): Promise<string> {
  const {url, sha256} = zkeyAsset(id);
  const path = io.cachePath(id);
  if (!(await io.exists(path))) {
    await io.download(url, path);
  }
  const actual = await io.sha256(path);
  if (actual !== sha256) {
    await io.remove(path);
    throw new Error(`zkey SHA-256 mismatch for '${id}' — rejected`);
  }
  return path;
}
