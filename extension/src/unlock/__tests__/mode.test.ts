import {pageMode} from '../mode';

describe('pageMode', () => {
  const id = 'ab'.repeat(16);
  it('reads the mode from the query string; anything unknown is the unlock page', () => {
    expect(pageMode('')).toEqual({mode: 'unlock', returnTo: null});
    expect(pageMode('?mode=welcome')).toEqual({mode: 'welcome'});
    expect(pageMode('?mode=create')).toEqual({mode: 'create'});
    expect(pageMode('?mode=import')).toEqual({mode: 'import', source: null});
    expect(pageMode('?mode=forgot')).toEqual({mode: 'forgot'});
    expect(pageMode('?mode=accounts')).toEqual({mode: 'accounts', op: 'add'});
    expect(pageMode('?mode=reveal')).toEqual({mode: 'reveal'});
    expect(pageMode('?mode=verify')).toEqual({mode: 'verify'});
    expect(pageMode('?mode=password')).toEqual({mode: 'password'});
    expect(pageMode('?mode=delete')).toEqual({mode: 'delete'});
    expect(pageMode('?mode=export')).toEqual({mode: 'unlock', returnTo: null});
  });

  // B1b-2b §1.2 (L2): `index` is the envelope's own 0-based index; one that does not parse, or above 2^31 − 1, is null —
  // the page names no account and offers nothing. `op` is a closed enum (anything else is add).
  it('accounts: op=add|remove; index ^\\d{1,10}$ within the hardened limit', () => {
    expect(pageMode('?mode=accounts&op=add')).toEqual({mode: 'accounts', op: 'add'});
    expect(pageMode('?mode=accounts&op=forget')).toEqual({mode: 'accounts', op: 'add'});
    expect(pageMode('?mode=accounts&op=remove&index=0')).toEqual({mode: 'accounts', op: 'remove', index: 0});
    expect(pageMode('?mode=accounts&op=remove&index=2147483647')).toEqual({mode: 'accounts', op: 'remove', index: 2 ** 31 - 1});
    for (const index of ['2147483648', '-1', '1.5', '', 'x', '12345678901', '0x10']) {
      expect(pageMode(`?mode=accounts&op=remove&index=${index}`)).toEqual({mode: 'accounts', op: 'remove', index: null});
    }
    expect(pageMode('?mode=accounts&op=remove')).toEqual({mode: 'accounts', op: 'remove', index: null});
  });

  it('re-authentication needs a well-formed challenge id', () => {
    expect(pageMode(`?mode=reauth&challenge=${id}`)).toEqual({mode: 'reauth', challengeId: id});
    expect(pageMode('?mode=reauth&challenge=<b>')).toEqual({mode: 'unlock', returnTo: null});
    expect(pageMode('?mode=reauth')).toEqual({mode: 'unlock', returnTo: null});
  });

  // Spec §1.2: `source` and `return` are closed enums, never URLs.
  it('import takes source=forgot|retry; anything else is a plain import', () => {
    expect(pageMode('?mode=import&source=forgot')).toEqual({mode: 'import', source: 'forgot'});
    expect(pageMode('?mode=import&source=retry')).toEqual({mode: 'import', source: 'retry'});
    for (const s of ['', 'FORGOT', 'delete', 'https://evil.example', 'forgot%20']) expect(pageMode(`?mode=import&source=${s}`)).toEqual({mode: 'import', source: null});
  });

  // Fix round 1 item 5 (reviewer mutation M5): URLSearchParams#get already returns the FIRST
  // occurrence of a repeated key — pinned here so a future rewrite (e.g. to getAll()) cannot
  // silently start honouring a later, attacker-appended ?source=.
  it('a duplicated source: the first value wins', () => {
    expect(pageMode('?mode=import&source=forgot&source=retry')).toEqual({mode: 'import', source: 'forgot'});
    expect(pageMode('?mode=import&source=retry&source=forgot')).toEqual({mode: 'import', source: 'retry'});
  });

  it('unlock takes return=created|imported; anything else hands over nowhere', () => {
    expect(pageMode('?mode=unlock&return=created')).toEqual({mode: 'unlock', returnTo: 'created'});
    expect(pageMode('?mode=unlock&return=imported')).toEqual({mode: 'unlock', returnTo: 'imported'});
    expect(pageMode('?return=created')).toEqual({mode: 'unlock', returnTo: 'created'});
    // Fix round 1 item 5 (reviewer mutation M4): the enum compare is case-sensitive — 'CREATED' is
    // not 'created'.
    for (const r of ['send', 'home', 'wallet.html#/send', '//evil.example', 'CREATED']) expect(pageMode(`?mode=unlock&return=${encodeURIComponent(r)}`)).toEqual({mode: 'unlock', returnTo: null});
  });
});
