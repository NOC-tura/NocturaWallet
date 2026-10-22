import {defineConfig, type Plugin} from 'vite';
import type {UserConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
import {writeFileSync} from 'node:fs';
import {relative, resolve, sep} from 'node:path';
import {isStylesheet, scanCss} from './scripts/css-scan.mjs';
import {presaleFlag} from './scripts/presaleFlag.mjs';
import {presaleSwitch} from './scripts/presaleSwitch.mjs';

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
//   cssRefs: stylesheet module → its RAW source as scripts/css-scan.mjs reads it (@import and url() targets,
//            other URL-loading functions, whether it has a backslash), read before Vite's CSS plugin inlines
//            an @import (an @import'ed file never becomes a module of its own). Every CSS language Vite
//            compiles counts as a stylesheet (fix round 4), not only .css.
const CHUNK_MODULES = new Map<string, string[]>();
const CSS_SOURCES = new Map<string, string[]>();
const CHUNK_CSS = new Map<string, string[]>();
const CSS_REFS = new Map<string, {imports: string[]; urls: string[]; loaders: string[]; escapes: boolean}>();
const moduleId = (id: string) => (id.startsWith('\0') ? id : relative(__dirname, id).split(sep).join('/'));
const sorted = <T,>(m: Map<string, T>) => Object.fromEntries([...m].sort(([a], [b]) => a.localeCompare(b)));
function chunkModules(write: boolean): Plugin {
  return {
    name: 'noctura:chunk-modules',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      const path = id.replace(/[?#].*$/, '');
      if (!isStylesheet(path)) return null;
      CSS_REFS.set(moduleId(path), scanCss(code));
      return null;
    },
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'chunk') continue;
        const ids = file.moduleIds.map(moduleId);
        CHUNK_MODULES.set(file.fileName, [...ids].sort());
        const css = [...(file.viteMetadata?.importedCss ?? [])].sort();
        CHUNK_CSS.set(file.fileName, css);
        const sheets = ids.filter(m => isStylesheet(m)).sort();
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

/**
 * B1d §1.1: the build without presale is this config with NOCTURA_PRESALE=0 (scripts/build.mjs --no-presale); both
 * mechanisms — the plugin and the constant — follow the one flag here, in the worker build too, exactly as in
 * vite.content.config.ts (the parity test, scripts/__tests__/presaleSwitch.test.mjs, imports both factories).
 */
export function appConfig(env: Record<string, string | undefined>): UserConfig {
  const presale = presaleFlag(env);
  return {
    base: './',
    // CI repro fix: pin the oxc transform's tsconfig to this package's own file. Left unpinned, a file whose own
    // directory's tsconfig.json does not list it in `include` (this file, among extension/'s own config files)
    // falls through to the auto-discovered NEAREST covering tsconfig — which walks up past extension/'s and finds
    // the repo root's, `extends`ing `@react-native/typescript-config`: present in a full local install (masking
    // the bug) but absent when CI installs only web/ and extension/. Pinning here is transform-only — it does not
    // change what `npx tsc --noEmit` type-checks (a separate, unrelated resolution), so tsconfig.json's own
    // `include` stays untouched (adding these config files there surfaces real pre-existing strict-mode errors
    // in them, unrelated to this bug).
    tsconfig: resolve(__dirname, 'tsconfig.json'),
    define: {__NOCTURA_PRESALE__: JSON.stringify(presale)},
    plugins: [sharedResolvesFromHere(), presaleSwitch(presale), react(), chunkModules(true)],
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
          // B1c §1.7: the approval window.
          approve: resolve(__dirname, 'approve.html'),
        },
        output: {
          // The manifest names background.js; a hash there would change the manifest.
          entryFileNames: chunk => (chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
    worker: {format: 'es', plugins: () => [presaleSwitch(presale), chunkModules(false)]},
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
        '../core/geo/**/*.test.ts',
        // Final review Minor 3: core/presale/limits.ts is an ON_BUILD module the extension ships (the only funds
        // arithmetic in 1a) — its own test must run through the extension's runner too, not only web's.
        '../core/presale/**/*.test.ts',
      ],
    },
  };
}

export default defineConfig(appConfig(process.env));
