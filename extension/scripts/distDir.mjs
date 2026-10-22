// B1d §1.1: which build a gate reads, package-relative — `dist` (presale on, the default) or `dist-nopresale` (off).
// `npm run gates` runs every gate once per build, selecting it with NOCTURA_DIST; anything else throws.
export const DIST_DIRS = ['dist', 'dist-nopresale'];

export function distDir(env = process.env) {
  const d = env.NOCTURA_DIST ?? 'dist';
  if (!DIST_DIRS.includes(d)) throw new Error(`NOCTURA_DIST must be one of ${DIST_DIRS.join(', ')}, not ${JSON.stringify(d)}`);
  return d;
}
