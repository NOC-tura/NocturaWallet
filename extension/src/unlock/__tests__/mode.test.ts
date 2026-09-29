import {pageMode} from '../mode';

describe('pageMode', () => {
  const id = 'ab'.repeat(16);
  it('reads the mode from the query string; anything unknown is the unlock page', () => {
    expect(pageMode('')).toEqual({mode: 'unlock'});
    expect(pageMode('?mode=create')).toEqual({mode: 'create'});
    expect(pageMode('?mode=import')).toEqual({mode: 'import'});
    expect(pageMode('?mode=accounts')).toEqual({mode: 'accounts'});
    expect(pageMode('?mode=reveal')).toEqual({mode: 'reveal'});
    expect(pageMode('?mode=export')).toEqual({mode: 'unlock'});
  });

  it('re-authentication needs a well-formed challenge id', () => {
    expect(pageMode(`?mode=reauth&challenge=${id}`)).toEqual({mode: 'reauth', challengeId: id});
    expect(pageMode('?mode=reauth&challenge=<b>')).toEqual({mode: 'unlock'});
    expect(pageMode('?mode=reauth')).toEqual({mode: 'unlock'});
  });
});
