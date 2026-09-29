import {defineConfig} from 'vite';
import type {UserConfig} from 'vitest/config';
import {resolve} from 'node:path';

// core/ is imported by relative path and its bare imports must resolve to THIS package's
// node_modules — CI installs only extension/, exactly as web.yml does for web/.
const SHARED = ['@noble/curves', '@noble/hashes', '@scure/base', '@scure/bip39', 'micro-key-producer'];

export default defineConfig({
  base: './',
  resolve: {dedupe: SHARED},
  server: {fs: {allow: [resolve(__dirname, '..')]}},
  build: {
    outDir: 'dist/app',
    emptyOutDir: true,
    target: 'es2022',
    modulePreload: false,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.ts'),
        popup: resolve(__dirname, 'popup.html'),
        unlock: resolve(__dirname, 'unlock.html'),
      },
      output: {
        // The manifest names background.js; a hash there would change the manifest.
        entryFileNames: chunk => (chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  worker: {format: 'es'},
  test: {
    environment: 'node',
    globals: true,
    include: [
      'src/**/*.test.ts',
      'manifest/**/*.test.mjs',
      'scripts/**/*.test.mjs',
      '../core/keys/**/*.test.ts',
      '../core/solana/**/*.test.ts',
      '../core/fees/**/*.test.ts',
    ],
  },
} as UserConfig);
