import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';

export default defineConfig({
  plugins: [react()],
  // core/ lives outside web/, so the dev server must be allowed to read it.
  server: {fs: {allow: [resolve(__dirname, '..')]}},
  // core/ is imported by relative path, so a bare import inside it resolves from the
  // REPO ROOT node_modules, not web/'s. dedupe pins both to web/'s copy: two copies of
  // web3.js give two Connection classes, and Connection has private members, so tsc
  // rejects passing one where the other is expected.
  resolve: {dedupe: ['@solana/web3.js', 'react', 'react-dom', 'buffer']},
  test: {
    environment: 'jsdom',
    globals: true,
    // ../core is outside this project root, so it is listed explicitly: without it
    // `vitest run` finds no core tests at all and every core suite is silently skipped.
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'scripts/**/*.test.mjs', '../core/**/*.test.ts'],
  },
});
