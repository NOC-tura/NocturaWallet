import {pageMode} from '../mode';

describe('pageMode', () => {
  const id = 'ab'.repeat(16);
  it('reads the mode from the query string; anything unknown is the unlock page', () => {
    expect(pageMode('')).toEqual({mode: 'unlock', returnTo: null});
    expect(pageMode('?mode=welcome')).toEqual({mode: 'welcome'});
    expect(pageMode('?mode=create')).toEqual({mode: 'create'});
    expect(pageMode('?mode=import')).toEqual({mode: 'import', source: null});
    expect(pageMode('?mode=forgot')).toEqual({mode: 'forgot'});
    expect(pageMode('?mode=accounts')).toEqual({mode: 'accounts'});
    expect(pageMode('?mode=reveal')).toEqual({mode: 'reveal'});
    expect(pageMode('?mode=export')).toEqual({mode: 'unlock', returnTo: null});
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

  it('unlock takes return=created|imported; anything else hands over nowhere', () => {
    expect(pageMode('?mode=unlock&return=created')).toEqual({mode: 'unlock', returnTo: 'created'});
    expect(pageMode('?mode=unlock&return=imported')).toEqual({mode: 'unlock', returnTo: 'imported'});
    expect(pageMode('?return=created')).toEqual({mode: 'unlock', returnTo: 'created'});
    for (const r of ['send', 'home', 'wallet.html#/send', '//evil.example']) expect(pageMode(`?mode=unlock&return=${encodeURIComponent(r)}`)).toEqual({mode: 'unlock', returnTo: null});
  });
});
