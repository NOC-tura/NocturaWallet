/**
 * B1e §4.2 (R7, E16): what the bare specifier `rpc-websockets` resolves to in every build (scripts/rpcWebsockets.mjs).
 * @solana/web3.js's browser build imports `CommonClient` and `WebSocket` from it and declares
 * `class RpcWebSocketClient extends CommonClient` at its top level, so `CommonClient` must be a class; only
 * `Connection`'s constructor makes a socket client, and nothing the extension bundles constructs a `Connection`. The
 * package (LGPL-3.0-only) is tree-shaken to 0 bytes today; this keeps it out should a later web3.js keep it, and the
 * licence gate (scripts/check-licences.mjs) fails if this stub ever renders.
 */
const refused = (): never => {
  throw new Error('rpc-websockets is not part of Noctura: the extension opens no WebSocket');
};

export class CommonClient {
  constructor() {
    refused();
  }
}

export function WebSocket(): never {
  return refused();
}
