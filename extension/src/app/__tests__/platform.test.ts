import {reauthPage} from '../platform';

// #20's one extension page built from data (spec §4.5 step 2): only 32 lowercase hex characters make a page.
describe('reauthPage', () => {
  it('a challenge id the background issues: the re-authentication page for it', () => {
    expect(reauthPage('0123456789abcdef0123456789abcdef')).toBe('unlock.html?mode=reauth&challenge=0123456789abcdef0123456789abcdef');
  });

  it('anything else: null — no page', () => {
    for (const id of [
      '0123456789ABCDEF0123456789ABCDEF',
      '0123456789abcdef0123456789abcde',
      '0123456789abcdef0123456789abcdef0',
      '0123456789abcdeg0123456789abcdef',
      '../../../wallet.html#/x/abcdefabcd',
      '0123456789abcdef0123456789abcdef&return=x',
      '0123456789abcdef0123456789abcde\n',
      '',
    ]) {
      expect(reauthPage(id)).toBeNull();
    }
  });
});
