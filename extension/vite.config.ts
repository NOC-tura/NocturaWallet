import {defineConfig, type Plugin} from 'vite';
import type {UserConfig} from 'vitest/config';
import {resolve, sep} from 'node:path';

// core/ is imported by relative path, and a bare import in a core/ file would otherwise resolve
// upwards from core/ — to the repository root's node_modules (the app's copies) locally, and to
// nothing in CI, which installs only extension/. This resolves every bare import made BY a core/
// file as if it were made from this package, and touches nothing else: a dependency's own imports
// (@solana/web3.js 1.x needs @noble v1, this package has v2) resolve normally, next to it.
const CORE = resolve(__dirname, '../core');
const HERE = resolve(__dirname, 'package.json');
function coreResolvesFromHere(): Plugin {
  return {
    name: 'noctura:core-resolves-from-extension',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (importer === undefined || !importer.startsWith(CORE + sep)) return null;
      if (source.startsWith('.') || source.startsWith('/') || source.startsWith('\0')) return null;
      return this.resolve(source, HERE, {...options, skipSelf: true});
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [coreResolvesFromHere()],
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
      '../core/portfolio/**/*.test.ts',
    ],
  },
} as UserConfig);
