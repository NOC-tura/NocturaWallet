import {defineConfig, type Plugin, type UserConfig} from 'vite';
import {writeFileSync} from 'node:fs';
import {relative, resolve, sep} from 'node:path';
import {presaleFlag} from './scripts/presaleFlag.mjs';
import {presaleSwitch} from './scripts/presaleSwitch.mjs';

/**
 * B1c §1.7: the two content scripts, built one at a time as classic scripts (an IIFE — a content script cannot be an
 * ES module) into the main build's output directory: `NOCTURA_CONTENT=provider` → provider.js (MAIN world),
 * `NOCTURA_CONTENT=relay` → relay.js (isolated world). Each build writes what it carries next to the output
 * (`dist/app.<name>.modules.json`), for the page-bundle gate (scripts/check-page-bundles.mjs): a content script runs in
 * every page, so it may carry only its own sources and @wallet-standard.
 */
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

/**
 * B1d §1.1: the same flag, the same two mechanisms as vite.config.ts — a content script imports no presale entry
 * today, and the parity test (scripts/__tests__/presaleSwitch.test.mjs) keeps it so should one ever do.
 */
export function contentConfig(env: Record<string, string | undefined>): UserConfig {
  const name = env.NOCTURA_CONTENT;
  if (name !== 'provider' && name !== 'relay') throw new Error('NOCTURA_CONTENT must be provider or relay');
  const presale = presaleFlag(env);
  return {
    base: './',
    // CI repro fix, mirrors vite.config.ts: pin the oxc transform's tsconfig to this package's own file so it is
    // never auto-discovered up to the repo root's (which `extends @react-native/typescript-config`, absent when
    // CI installs only web/ and extension/).
    tsconfig: resolve(__dirname, 'tsconfig.json'),
    publicDir: false,
    define: {__NOCTURA_PRESALE__: JSON.stringify(presale)},
    plugins: [presaleSwitch(presale), contentModules(name)],
    build: {
      outDir: 'dist/app',
      emptyOutDir: false,
      target: 'es2022',
      modulePreload: false,
      copyPublicDir: false,
      lib: {entry: resolve(__dirname, `src/${name}/index.ts`), formats: ['iife'], name: `noctura_${name}`, fileName: () => `${name}.js`},
    },
  };
}

export default defineConfig(() => contentConfig(process.env));
