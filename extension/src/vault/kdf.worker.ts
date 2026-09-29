import {argon2idKdf, runKdfRequest, type KdfRequest} from './kdf';

self.onmessage = (e: MessageEvent<KdfRequest>) => {
  void runKdfRequest(argon2idKdf, e.data, (reply, transfer) => self.postMessage(reply, {transfer}));
};
