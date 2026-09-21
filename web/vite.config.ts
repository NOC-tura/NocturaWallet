import {defineConfig, loadEnv} from 'vite';
import type {UserConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';

// The origin the coordinator allowlists. The dev server rewrites Origin to this:
// Vite picks the next free port when 5173 is taken, and a request from :5174 would
// come back without CORS headers and be blocked by the browser — a failure that
// looks like the API is down. CORS is not an authorization boundary here (the
// method allowlist and the rate limits are), so asserting the production origin
// from a local proxy costs nothing and removes a trap.
const PROD_ORIGIN = 'https://wallet.noc-tura.io';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, __dirname, '');
  const coordinator = env.COORDINATOR_ORIGIN || 'https://api.noc-tura.io';
  const setOrigin = (proxy: {on: (e: string, cb: (req: {setHeader: (k: string, v: string) => void}) => void) => void}) => {
    proxy.on('proxyReq', proxyReq => proxyReq.setHeader('origin', PROD_ORIGIN));
  };

  return {
    plugins: [react()],
    server: {
      fs: {allow: [resolve(__dirname, '..')]},
      proxy: {
        '/api': {target: coordinator, changeOrigin: true, secure: true, configure: setOrigin},
        // Since 2026-09-20 the coordinator serves a method-allowlisted RPC route, so
        // development needs no Helius key and has the same shape as production.
        '/rpc': {
          target: `${coordinator}/api/v1/rpc`,
          changeOrigin: true,
          secure: true,
          ignorePath: true,
          configure: setOrigin,
        },
      },
    },
    resolve: {dedupe: ['@solana/web3.js', 'react', 'react-dom', 'buffer']},
    test: {
      environment: 'jsdom',
      globals: true,
      include: ['src/**/*.{test,spec}.{ts,tsx}', 'scripts/**/*.test.mjs', '../core/**/*.test.ts'],
      // core/ holds no DOM code, and jsdom actively breaks it: jsdom runs in its own
      // realm, so `instanceof Uint8Array` fails across it and @noble/hashes rejects a
      // seed with "Uint8Array expected" — PublicKey.isOnCurve then answers true for
      // everything and findProgramAddressSync can find no viable nonce. A real browser
      // has one realm and does not have this problem; the node environment is both
      // faster here and closer to the truth.
      environmentMatchGlobs: [['../core/**', 'node']],
    },
  } as UserConfig;
});
