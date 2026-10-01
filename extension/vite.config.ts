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

// What each built chunk and stylesheet carries, for the vault-isolation gate (Task 5 review I1(b), N1):
// the authoritative answer to "what did the bundler put in the vault page", whatever spelling imported
// it. Written NEXT TO the build directory (dist/app.modules.json), never inside it: it is not an
// extension resource and no package (dist/chrome, dist/firefox) carries it. The worker build feeds the
// same map. Shape:
//   chunks:  JS chunk file → the modules it carries (package-relative)
//   css:     CSS asset file → the stylesheet modules it was built from (the chunk whose importedCss it is)
//   chunkCss: JS chunk file → the CSS assets it loads
//   cssRefs: stylesheet module → the @import and url() targets in its RAW source, read before Vite's CSS
//            plugin inlines an @import (an @import'ed file never becomes a module of its own)
const CHUNK_MODULES = new Map<string, string[]>();
const CSS_SOURCES = new Map<string, string[]>();
const CHUNK_CSS = new Map<string, string[]>();
const CSS_REFS = new Map<string, {imports: string[]; urls: string[]}>();
const moduleId = (id: string) => (id.startsWith('\0') ? id : relative(__dirname, id).split(sep).join('/'));
const sorted = <T,>(m: Map<string, T>) => Object.fromEntries([...m].sort(([a], [b]) => a.localeCompare(b)));
function chunkModules(write: boolean): Plugin {
  return {
    name: 'noctura:chunk-modules',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      const path = id.replace(/[?#].*$/, '');
      if (!path.endsWith('.css')) return null;
      const css = code.replace(/\/\*[\s\S]*?\*\//g, ' ');
      const imports = [...css.matchAll(/@import\s+(?:url\(\s*)?(['"]?)([^'")\s;]*)\1/gi)].map(m => m[2] ?? '');
      const urls = [...css.matchAll(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi)].map(m => m[2] ?? '');
      CSS_REFS.set(moduleId(path), {imports, urls});
      return null;
    },
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'chunk') continue;
        const ids = file.moduleIds.map(moduleId);
        CHUNK_MODULES.set(file.fileName, [...ids].sort());
        const css = [...(file.viteMetadata?.importedCss ?? [])].sort();
        CHUNK_CSS.set(file.fileName, css);
        const sheets = ids.filter(m => m.replace(/[?#].*$/, '').endsWith('.css')).sort();
        // A chunk's importedCss is the stylesheet built from its own CSS modules (one per chunk).
        for (const asset of css) CSS_SOURCES.set(asset, [...(CSS_SOURCES.get(asset) ?? []), ...sheets].sort());
      }
    },
    writeBundle(options) {
      if (!write || options.dir === undefined) return;
      const out = {chunks: sorted(CHUNK_MODULES), css: sorted(CSS_SOURCES), chunkCss: sorted(CHUNK_CSS), cssRefs: sorted(CSS_REFS)};
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
