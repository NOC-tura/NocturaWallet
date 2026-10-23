import {existsSync} from 'node:fs';
import {dirname, join, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * B1d §1.1 (C4): the three entry modules through which presale code joins the shared code, and the stub each resolves
 * to when presale is off — outside every presale directory. Shared code imports the entries unconditionally; nothing
 * else under a presale directory may be imported by shared code (the off-build gate proves it on the module maps).
 */
export const PRESALE_ENTRIES = [
  {entry: 'src/background/presale/api.ts', stub: 'src/presale-off/background.ts'},
  {entry: 'src/app/presale/index.ts', stub: 'src/presale-off/app.ts'},
  {entry: 'src/unlock/presale.ts', stub: 'src/presale-off/unlock.ts'},
];

/**
 * The Vite plugin that removes presale code from the off build: its `resolveId` resolves each entry, however it is
 * spelled (a query or a hash included), to its stub, so the entry's module — and every module only it imports, with
 * whatever their top level does — never enters the bundle. A guarded call site could not do that, and the background is
 * a module service worker, where an import cannot sit in an `if` and `import()` throws. On, it resolves nothing, and
 * every module under `src/background/presale/` is kept whole (`moduleSideEffects: 'no-treeshake'`): the on build
 * carries each presale background module the entry imports, whether or not a caller uses it yet, so the module maps —
 * the off-build gate's positive control (§6.2) — say what the build really holds, not what tree-shaking left of it.
 * `api.presale` says which mode it is in (the configs' parity test reads it).
 */
export function presaleSwitch(on, root = ROOT) {
  if (typeof on !== 'boolean') throw new Error(`presaleSwitch: the flag must be a boolean, not ${JSON.stringify(on)}`);
  const stubs = new Map();
  for (const {entry, stub} of PRESALE_ENTRIES) {
    if (!existsSync(join(root, stub))) throw new Error(`presaleSwitch: the stub ${stub} is missing`);
    stubs.set(join(root, entry), join(root, stub));
  }
  const keptWhole = join(root, 'src', 'background', 'presale') + sep;
  return {
    name: 'noctura:presale-switch',
    enforce: 'pre',
    api: {presale: on},
    async resolveId(source, importer, options) {
      if (on) return null;
      const resolved = await this.resolve(source, importer, {...options, skipSelf: true});
      if (resolved === null || resolved.external) return null;
      return stubs.get(resolved.id.replace(/[?#].*$/, '')) ?? null;
    },
    transform(code, id) {
      if (!on || !id.replace(/[?#].*$/, '').startsWith(keptWhole)) return null;
      return {code, map: null, moduleSideEffects: 'no-treeshake'};
    },
  };
}
