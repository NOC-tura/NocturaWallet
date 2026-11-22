/**
 * M1d (spec 2026-11-21-shielded-m1d-accounts-design.md §4, M1 spec §10 / §11 R11): the accounts
 * copy, verbatim. Every expected string is the spec's text typed out here, never read back from
 * the module.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as c from '../accounts';
import {bannedStrings, forbiddenClaims, userVisibleStrings} from '../__testing__/copyScan';

const FILE = path.resolve(__dirname, '../accounts.ts');
const SRC = fs.readFileSync(FILE, 'utf8');

describe('src/copy/accounts.ts — the M1d strings', () => {
  it('the sheet, the rows and the public states (spec §3.1, §3.4, §4.1)', () => {
    expect(c.ACCOUNTS_TITLE).toBe('Accounts');
    expect(c.TAG_MAIN).toBe('main');
    expect(c.TAG_EXIT).toBe('exit');
    expect(c.TAG_LINKED).toBe('linked');
    expect(c.ACCOUNTS_FOOTER).toBe('New accounts appear here when you make funds public to “A new account”.');
    expect(c.ACCOUNTS_UNREADABLE).toBe("Other accounts can't be read right now.");
    expect(c.ROW_NOT_CHECKED).toBe('not checked yet');
    expect(c.ROW_UNAVAILABLE).toBe('Balance unavailable');
    expect(c.PUBLIC_LOADING).toBe('Loading balances…');
    expect(c.PUBLIC_UNAVAILABLE).toBe('Balance unavailable · pull to refresh');
  });

  it('review M5/M2: #21\'s refusals and the refresh alert, with their codes first', () => {
    expect(c.sendSchemeError('foo:1')).toBe('E_SEND_SCHEME: foo:1 is not an account this wallet can sign for; nothing was signed.');
    expect(c.sendSignerMismatchError('ADDR')).toBe("E_SEND_SIGNER_MISMATCH: this account's key does not derive ADDR; nothing was signed.");
    expect(c.REFRESH_FAILED_TITLE).toBe('Could not refresh balance');
    expect(c.REFRESH_ACCOUNT_FAILED).toBe("This account's balance could not be read. Pull down to try again.");
  });

  it('the linking warning (spec §4.4, M1 spec §10 C2)', () => {
    expect(c.LINK_WARNING_TITLE).toBe('Sending between your own accounts links them on chain.');
    expect(c.LINK_WARNING_BODY).toBe('Anyone can see that these two accounts belong to the same person.');
    expect(c.LINK_TAP_AGAIN).toBe('Tap again to send anyway');
  });

  it('From, the main-only lines, Received by, the avatar (spec §4.1–§4.3; plan A7, A13, A19)', () => {
    expect(c.fromLine('Account 4', '3YqEpf…JXT94k', false)).toBe('From: Account 4 · 3YqEpf…JXT94k');
    expect(c.fromLine('Account 1', 'HAgk14…3DKpqk', true)).toBe('From: Account 1 (main) · HAgk14…3DKpqk');
    expect(c.accountWithAddress('Account 4', '3YqEpf…JXT94k', false)).toBe('Account 4 · 3YqEpf…JXT94k');
    expect(c.accountWithAddress('Account 1', 'HAgk14…3DKpqk', true)).toBe('Account 1 (main) · HAgk14…3DKpqk');
    expect(c.fromMainLine('Account 1')).toBe('From: Account 1 (main)');
    expect(c.fromMainLine('Account 4')).toBe('From: Account 4 (main)');
    expect(c.USES_MAIN_ACCOUNT).toBe('Uses your main account');
    expect(c.RECEIVED_BY).toBe('Received by');
    expect(c.avatarA11y('Account 3')).toBe('Account 3, switch account');
  });

  it('the split row (spec §4.5, 2026-11-22 addendum): the mode words, "+N more", the a11y label', () => {
    expect(c.SPLIT_PUBLIC).toBe('Public');
    expect(c.SPLIT_PRIVATE).toBe('Private');
    expect(c.VALUE_UNKNOWN).toBe('—');
    expect(c.VALUE_HIDDEN).toBe('•••');
    expect(c.moreAssets(1)).toBe('+1 more');
    expect(c.splitA11y('Public', '$12.40', true)).toBe('Public, $12.40');
    expect(c.splitA11y('Private', '1.0038 TEST', false)).toBe('Private, 1.0038 TEST, switch to Private');
    expect(c.splitA11y('Public', '—', false)).toBe('Public, not known yet, switch to Public'); // review Task 5 m8
    expect('combinedLine' in c).toBe(false); // r1-7: the old line's copy is gone
  });

  it('#17 who sees what (M1 spec §11 R11; plan A15: only the banned word is reworded)', () => {
    expect(c.WHO_SEES_WHAT).toBe('Who sees what');
    expect(c.WHO_SEES_RELAYER).toBe(
      'When you make tokens public, the relayer that sends them sees the request: the destination, the amount, the time and the network address it came from. The proof does not tell it which deposit is spent, but amounts and timing can hint at it. Otherwise it sees what anyone sees on chain.',
    );
    expect(c.WHO_SEES_RPC).toBe(
      'The RPC provider the app uses sees every request the app makes, including the balances of all your accounts.',
    );
    expect(c.WHO_SEES_CHAIN).toBe('On chain, amounts and timing are public.');
  });
});

describe('src/copy/accounts.ts — honesty', () => {
  it('the scan reads the module (positive control: it is not empty)', () => {
    expect(userVisibleStrings('src/copy/accounts.ts', SRC).length).toBeGreaterThanOrEqual(20);
  });
  it('no banned word, no forbidden claim', () => {
    expect(bannedStrings('src/copy/accounts.ts', SRC)).toEqual([]);
    expect(forbiddenClaims('src/copy/accounts.ts', SRC)).toEqual([]);
  });
});
