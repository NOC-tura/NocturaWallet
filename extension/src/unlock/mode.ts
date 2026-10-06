/** #8's two E5 paths (spec B1b-2a §1.2): #39's restore (seed proof) and #40's "Try a different seed" (password first). */
export type ImportSource = 'forgot' | 'retry';
/** Where a finished unlock hands over (#7, #40): a UI-tab route, never a URL. */
export type ReturnTo = 'created' | 'imported';

export type PageMode =
  | {mode: 'unlock'; returnTo: ReturnTo | null}
  | {mode: 'welcome'}
  | {mode: 'create'}
  | {mode: 'import'; source: ImportSource | null}
  | {mode: 'forgot'}
  | {mode: 'accounts'}
  | {mode: 'reveal'}
  | {mode: 'reauth'; challengeId: string}
  /** B1b-2b §1.2: #36 change password (unlocked session, password only, D8). */
  | {mode: 'password'}
  /** B1b-2b §1.2: #37's proof — no session needed (E5's factor proof), bound to the wallet it shows (C17). */
  | {mode: 'delete'}
  /** B1b-2b §1.2: #6 "manage" — add (or replace, C4) by password; remove by password or passkey (E12). */
  | {mode: 'passkey'; op: 'add' | 'remove'}
  /** B1b-2b §3.5: the verify check (unlocked session, password only, D23). `reveal` is the designed #3 (§3.4). */
  | {mode: 'verify'};

const SOURCES: readonly string[] = ['forgot', 'retry'];
const RETURNS: readonly string[] = ['created', 'imported'];

/**
 * unlock.html?mode=…; anything unknown or malformed is the plain unlock page. `source` and `return`
 * are closed enums: an unknown value is dropped (a plain import, an unlock with no hand-over), never
 * followed — no parameter names a URL, and none can start a destructive path by itself (§1.2).
 */
export function pageMode(search: string): PageMode {
  const p = new URLSearchParams(search);
  const m = p.get('mode');
  if (m === 'welcome' || m === 'create' || m === 'forgot' || m === 'accounts' || m === 'reveal' || m === 'password' || m === 'delete' || m === 'verify') return {mode: m};
  if (m === 'import') {
    const source = p.get('source') ?? '';
    return {mode: 'import', source: SOURCES.includes(source) ? (source as ImportSource) : null};
  }
  if (m === 'passkey') return {mode: 'passkey', op: p.get('op') === 'remove' ? 'remove' : 'add'};
  if (m === 'reauth') {
    const id = p.get('challenge') ?? '';
    return /^[0-9a-f]{32}$/.test(id) ? {mode: 'reauth', challengeId: id} : {mode: 'unlock', returnTo: null};
  }
  const back = p.get('return') ?? '';
  return {mode: 'unlock', returnTo: RETURNS.includes(back) ? (back as ReturnTo) : null};
}
