// B1d §1.1 (D2): the one build input. scripts/build.mjs sets NOCTURA_PRESALE in the environment of every vite build it
// runs; both Vite configs read it here and nowhere else. '1' or unset → presale on (the default for B1d builds), '0' →
// off. Anything else throws: a typo must never pick a build.
export function presaleFlag(env) {
  const v = env.NOCTURA_PRESALE;
  if (v === undefined || v === '1') return true;
  if (v === '0') return false;
  throw new Error(`NOCTURA_PRESALE must be '1', '0' or unset, not ${JSON.stringify(v)}`);
}
