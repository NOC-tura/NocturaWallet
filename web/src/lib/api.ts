import {API_BASE} from '../config';
import type {JsonGetter} from '../../../core/ports';

/**
 * Fail closed. A non-200 throws, and so does a body that is not JSON. The envelope
 * check lives in core, next to the reader that depends on it.
 *
 * The coordinator's RPC route answers 403 for a method outside its allowlist. That is
 * a bug in our code, never a transient, so nothing here retries.
 */
export const json: JsonGetter = {
  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`);
    if (res.status !== 200) {
      throw new Error(`${path} returned HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  },
};

/** POST a bare path with a JSON body. Used for best-effort writes. */
export const post = {
  async post(path: string, body: unknown): Promise<void> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify(body),
    });
    if (res.status !== 200) {
      throw new Error(`${path} returned HTTP ${res.status}`);
    }
  },
};
