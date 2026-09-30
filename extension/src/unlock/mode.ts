export type PageMode = {mode: 'unlock'} | {mode: 'welcome'} | {mode: 'create'} | {mode: 'import'} | {mode: 'accounts'} | {mode: 'reveal'} | {mode: 'reauth'; challengeId: string};

/** unlock.html?mode=…; anything unknown or malformed is the plain unlock page. */
export function pageMode(search: string): PageMode {
  const p = new URLSearchParams(search);
  const m = p.get('mode');
  if (m === 'welcome' || m === 'create' || m === 'import' || m === 'accounts' || m === 'reveal') return {mode: m};
  if (m === 'reauth') {
    const id = p.get('challenge') ?? '';
    return /^[0-9a-f]{32}$/.test(id) ? {mode: 'reauth', challengeId: id} : {mode: 'unlock'};
  }
  return {mode: 'unlock'};
}
