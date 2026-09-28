import {argon2idAsync} from '@noble/hashes/argon2.js';
import type {Kdf} from './envelope';

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
