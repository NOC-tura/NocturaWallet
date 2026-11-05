import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * B1e §4.2 (R7, E16): the bare specifier `rpc-websockets` (LGPL-3.0-only, imported by @solana/web3.js's browser build)
 * resolves to a local stub in every build — a precaution: the package renders 0 bytes today. vite.config.ts uses this
 * alias; scripts/__tests__/rpcWebsockets.test.mjs bundles web3.js under the same one.
 */
export const RPC_WEBSOCKETS_STUB = 'src/shared/rpcWebsocketsStub.ts';
export const rpcWebsocketsAlias = (root = ROOT) => [{find: /^rpc-websockets$/, replacement: resolve(root, RPC_WEBSOCKETS_STUB)}];
