/**
 * The one storage call the vault page makes: read a key from the local area. Its own module, with
 * no imports, so the vault page's bundle carries nothing of src/ext.ts (the session area where the
 * keys live, and its access pin). scripts/check-vault-isolation.mjs holds this file to reading the
 * local area only, lets only the vault page import it, and checks the built vault page reaches no
 * session-area code.
 */
interface LocalReader {
  storage: {local: {get(key: string): Promise<Record<string, unknown>>}};
}

export async function readLocal(key: string): Promise<unknown> {
  const g = globalThis as unknown as {browser?: LocalReader; chrome?: LocalReader};
  const b = g.browser ?? g.chrome;
  if (!b) throw new Error('not running in an extension');
  return (await b.storage.local.get(key))[key];
}
