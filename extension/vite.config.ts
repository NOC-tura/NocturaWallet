import {defineConfig, type Plugin} from 'vite';
import type {UserConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
import {writeFileSync} from 'node:fs';
import {relative, resolve, sep} from 'node:path';

// core/ and web/src/ui/ are imported by relative path, and a bare import in one of their files would
// otherwise resolve upwards from there — to web/node_modules or the repository root's node_modules
// locally (a second React: hooks break), and to nothing in CI, which installs only extension/. This
// resolves every bare import made BY a core/ or web/src/ui/ file as if it were made from this package,
// and touches nothing else: a dependency's own imports (@solana/web3.js 1.x needs @noble v1, this
// package has v2) resolve normally, next to it.
const SHARED = [resolve(__dirname, '../core'), resolve(__dirname, '../web/src/ui')];
const HERE = resolve(__dirname, 'package.json');
function sharedResolvesFromHere(): Plugin {
  return {
    name: 'noctura:shared-resolves-from-extension',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (importer === undefined || !SHARED.some(dir => importer.startsWith(dir + sep))) return null;
      if (source.startsWith('.') || source.startsWith('/') || source.startsWith('\0')) return null;
      return this.resolve(source, HERE, {...options, skipSelf: true});
    },
  };
}

// Which source modules each built chunk carries, for the vault-isolation gate (Task 5 review I1(b)): the
// authoritative answer to "what did the bundler put in the vault page", whatever spelling imported it.
// Written NEXT TO the build directory (dist/app.modules.json), never inside it: it is not an extension
// resource and no package (dist/chrome, dist/firefox) carries it. The worker build feeds the same map.
const CHUNK_MODULES = new Map<string, string[]>();
const moduleId = (id: string) => (id.startsWith('\0') ? id : relative(__dirname, id).split(sep).join('/'));
function chunkModules(write: boolean): Plugin {
  return {
    name: 'noctura:chunk-modules',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) if (file.type === 'chunk') CHUNK_MODULES.set(file.fileName, file.moduleIds.map(moduleId).sort());
    },
    writeBundle(options) {
      if (!write || options.dir === undefined) return;
      const out = Object.fromEntries([...CHUNK_MODULES].sort(([a], [b]) => a.localeCompare(b)));
      writeFileSync(`${options.dir}.modules.json`, `${JSON.stringify(out, null, 2)}\n`);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [sharedResolvesFromHere(), react(), chunkModules(true)],
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
        wallet: resolve(__dirname, 'wallet.html'),
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
  worker: {format: 'es', plugins: () => [chunkModules(false)]},
  test: {
    // node by default; the component tests say `// @vitest-environment happy-dom` on their first line
    // (vitest 5 has no environmentMatchGlobs).
    environment: 'node',
    globals: true,
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'manifest/**/*.test.mjs',
      'scripts/**/*.test.mjs',
      '../core/keys/**/*.test.ts',
      '../core/solana/**/*.test.ts',
      '../core/fees/**/*.test.ts',
      '../core/portfolio/**/*.test.ts',
    ],
  },
} as UserConfig);
