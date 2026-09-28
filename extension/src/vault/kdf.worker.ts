import {argon2idKdf} from './kdf';
import type {KdfParams} from './envelope';

self.onmessage = async (e: MessageEvent<{password: string; salt: Uint8Array; params: KdfParams}>) => {
  try {
    const key = await argon2idKdf(e.data.password, e.data.salt, e.data.params);
    self.postMessage({key});
  } catch (err) {
    self.postMessage({error: err instanceof Error ? err.message : 'kdf failed'});
  }
};
