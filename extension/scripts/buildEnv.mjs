// B1e-2 (Task 7 fix round 1, review I1): what besides NODE_ENV makes Vite build React's development bundle. Vite 8
// copies a NODE_ENV it finds in an env file (`.env`, `.env.local`, `.env.<mode>`, `.env.<mode>.local`) into
// VITE_USER_NODE_ENV and, when NODE_ENV itself is unset — the state the release requires — turns
// VITE_USER_NODE_ENV=development into NODE_ENV=development. Env files are git-ignored (the repository's `.env*`), so a
// clean tree does not show one. The extension's two Vite configs read no env file (`envDir: false`); build.mjs and the
// release's preflight refuse both doors anyway, so neither depends on that one line.
import {existsSync, readdirSync} from 'node:fs';

/** The environment variable Vite turns into NODE_ENV=development. */
export const VITE_NODE_ENV_VAR = 'VITE_USER_NODE_ENV';

/** Every name Vite could read as an env file in a directory — `.env` and `.env.<anything>`. */
export const ENV_FILE = /^\.env(\..*)?$/;

/** The env-file names directly in `dir`, sorted; [] for an absent directory. */
export const envFilesIn = dir => (existsSync(dir) ? readdirSync(dir).filter(name => ENV_FILE.test(name)).sort() : []);
