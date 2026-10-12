import {defineConfig, type Plugin} from 'vite';
import {writeFileSync} from 'node:fs';
import {relative, resolve, sep} from 'node:path';

/**
 * B1c §1.7: the two content scripts, built one at a time as classic scripts (an IIFE — a content script cannot be an
 * ES module) into the main build's output directory: `NOCTURA_CONTENT=provider` → provider.js (MAIN world),
 * `NOCTURA_CONTENT=relay` → relay.js (isolated world). Each build writes what it carries next to the output
 * (`dist/app.<name>.modules.json`), for the page-bundle gate (scripts/check-page-bundles.mjs): a content script runs in
 * every page, so it may carry only its own sources and @wallet-standard.
 */
const NAME = process.env.NOCTURA_CONTENT;
if (NAME !== 'provider' && NAME !== 'relay') throw new Error('NOCTURA_CONTENT must be provider or relay');

const moduleId = (id: string) => (id.startsWith('\0') ? id : relative(__dirname, id).split(sep).join('/'));
function contentModules(name: string): Plugin {
  const chunks = new Map<string, string[]>();
  return {
    name: 'noctura:content-modules',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) if (file.type === 'chunk') chunks.set(file.fileName, file.moduleIds.map(moduleId).sort());
    },
    writeBundle(options) {
      if (options.dir === undefined) return;
      writeFileSync(`${options.dir}.${name}.modules.json`, `${JSON.stringify({chunks: Object.fromEntries([...chunks].sort(([a], [b]) => a.localeCompare(b)))}, null, 2)}\n`);
    },
  };
}

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [contentModules(NAME)],
  build: {
    outDir: 'dist/app',
    emptyOutDir: false,
    target: 'es2022',
    modulePreload: false,
    copyPublicDir: false,
    lib: {entry: resolve(__dirname, `src/${NAME}/index.ts`), formats: ['iife'], name: `noctura_${NAME}`, fileName: () => `${NAME}.js`},
  },
});
