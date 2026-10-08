import {reauthPage, removeAccountPage} from '../platform';

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

// B1b-2b §1.3 (C14): the accounts manager's remove page — the envelope's 0-based index, checked, never a name.
describe('removeAccountPage', () => {
  it('a safe integer in 0 … 2^31 − 1: the remove page for that index', () => {
    expect(removeAccountPage(0)).toBe('unlock.html?mode=accounts&op=remove&index=0');
    expect(removeAccountPage(2 ** 31 - 1)).toBe(`unlock.html?mode=accounts&op=remove&index=${2 ** 31 - 1}`);
  });

  it('anything else: null — no page', () => {
    for (const index of [-1, 1.5, 2 ** 31, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 2]) expect(removeAccountPage(index)).toBeNull();
  });
});
