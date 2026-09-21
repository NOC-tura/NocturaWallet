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
//
// Imported rather than repeated: the same origin is baked into the nginx config and
// asserted in its tests, and a dev proxy quietly claiming a host we no longer serve
// would fail as a CORS rejection that looks like the API being down.
import {PROD_ORIGIN} from './deploy/security-headers.mjs';

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
    resolve: {
      dedupe: ['@solana/web3.js', 'react', 'react-dom', 'buffer', '@scure/base'],
      alias: {
        // @solana/wallet-adapter-react imports the mobile adapter unconditionally, and it
        // drags @solana-mobile/wallet-standard-mobile in behind it. Both build a <style>
        // element at run time and one of them requests a Google font — see the reasoning
        // in src/wallet/mobileAdapterStub.ts. Replaced rather than removed, because the
        // import is in a dependency we do not control.
        //
        // If a future version of wallet-adapter-react imports a symbol the stub does not
        // export, the BUILD fails on the missing export. That is the failure we want: loud,
        // in CI, rather than a modal that quietly stops working on phones.
        '@solana-mobile/wallet-adapter-mobile': resolve(__dirname, 'src/wallet/mobileAdapterStub.ts'),
      },
    },
    test: {
      // happy-dom rather than jsdom: jsdom runs in its own realm, so `instanceof
      // Uint8Array` fails across it and @noble rejects every seed — PDA derivation and
      // transaction building both break with errors that look like our bugs. Measured:
      // the same code passes under node and under happy-dom.
      environment: 'happy-dom',
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
