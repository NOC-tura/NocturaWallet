import {argon2idAsync} from '@noble/hashes/argon2.js';
import {assertArrayBufferBacked} from './bytes';
import type {Kdf, KdfParams} from './envelope';

/** Argon2id on the calling thread. In the extension this runs only inside kdf.worker.ts. */
export const argon2idKdf: Kdf = (password, salt, params) =>
  argon2idAsync(password, salt, {m: params.m, t: params.t, p: params.p, dkLen: 32});

/**
 * Argon2id in a Web Worker owned by the vault page. At the production parameters it takes
 * about 3.4 s on a fast laptop; on the page's main thread it would freeze the window, and in
 * the background it would block every message (spec §2).
 */
export const workerKdf: Kdf = (password, salt, params) =>
  new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./kdf.worker.ts', import.meta.url), {type: 'module'});
    worker.onmessage = (e: MessageEvent<{key?: Uint8Array; error?: string}>) => {
      worker.terminate();
      if (e.data.key) resolve(e.data.key);
      else reject(new Error(e.data.error ?? 'kdf failed'));
    };
    worker.onerror = e => {
      worker.terminate();
      reject(new Error(e.message));
    };
    worker.postMessage({password, salt, params});
  });

export interface KdfRequest {
  password: string;
  salt: Uint8Array;
  params: KdfParams;
}
export type KdfReply = {key: Uint8Array} | {error: string};

/**
 * The worker's whole job, taking its `postMessage` as a parameter so it runs in a test. The
 * key's buffer is TRANSFERRED, not copied: after the post, the worker's own view of it is
 * detached, so no copy of the password key stays behind in the worker's heap.
 */
export async function runKdfRequest(kdf: Kdf, req: KdfRequest, post: (reply: KdfReply, transfer: ArrayBuffer[]) => void): Promise<void> {
  try {
    const key = await kdf(req.password, req.salt, req.params);
    assertArrayBufferBacked(key);
    post({key}, [key.buffer]);
  } catch (err) {
    post({error: err instanceof Error ? err.message : 'kdf failed'}, []);
  }
}
