import {RP_ID} from '../passkey';

// B1e §5.6 (N4, E17): the passkey RP ID is claimed through a host permission — "an extension may claim an RP ID only for
// a host it has permission for" — so dropping the seemingly unused `https://wallet.noc-tura.io/*` would silently break
// every enrolled passkey. The manifest source is plain JS (manifest/source.mjs): read through Vite's glob import and
// checked for shape here, so a change to its form fails instead of passing.
const source = Object.values(import.meta.glob('../../../manifest/source.mjs', {eager: true}))[0];
const hostPermissions = (): string[] => {
  const list = (source as {HOST_PERMISSIONS?: unknown} | undefined)?.HOST_PERMISSIONS;
  if (!Array.isArray(list)) throw new Error('manifest/source.mjs exports no HOST_PERMISSIONS list');
  return list.map(entry => {
    const value = (entry as {value?: unknown} | null)?.value;
    if (typeof value !== 'string') throw new Error('a HOST_PERMISSIONS entry has no string value');
    return value;
  });
};

// B1e §5.6 (E17), B1e-2: the owner's record of the frozen RP ID, `release/rp-id.json` — the file release:chrome's
// pre-upload gate reads (scripts/release-chrome.mjs `rpIdProblems`). Read here through Vite's JSON import; an absent file
// leaves the glob empty, which the reader refuses rather than skips.
const recorded = (): unknown => {
  const files = Object.values(import.meta.glob('../../../release/rp-id.json', {eager: true, import: 'default'}));
  if (files.length !== 1) throw new Error('release/rp-id.json is absent');
  return files[0];
};

describe('the passkey RP ID (B1e §5.6)', () => {
  it('is wallet.noc-tura.io, frozen by 1.0.0 (E17)', () => {
    expect(RP_ID).toBe('wallet.noc-tura.io');
  });

  it('is a host the manifest claims: `https://${RP_ID}/*` is a HOST_PERMISSIONS value', () => {
    expect(hostPermissions()).toContain(`https://${RP_ID}/*`);
  });

  it('equals the owner’s record: release/rp-id.json is exactly {rpId: RP_ID, confirmedBy: owner, decision: E17}', () => {
    expect(recorded()).toEqual({rpId: RP_ID, confirmedBy: 'owner', decision: 'E17'});
    expect(Object.keys(recorded() as object)).toEqual(['rpId', 'confirmedBy', 'decision']);
  });

  it('the pin reads the real list (positive control): the coordinator’s permission is in it, an invented host is not', () => {
    expect(hostPermissions()).toContain('https://api.noc-tura.io/*');
    expect(hostPermissions()).not.toContain('https://passkey.noc-tura.io/*');
  });
});
