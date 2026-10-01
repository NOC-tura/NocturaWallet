import {KNOWN_RECIPIENTS_KEY, MAX_KNOWN_RECIPIENTS, addKnownRecipient, knownRecipients} from '../knownRecipients';
import {fakeExt} from './fakeExt';

describe('known recipients', () => {
  it('starts empty, remembers an address once, and survives garbage in storage', async () => {
    const ext = fakeExt();
    expect((await knownRecipients(ext)).size).toBe(0);
    await addKnownRecipient(ext, 'A', 1);
    await addKnownRecipient(ext, 'A', 1);
    expect([...(await knownRecipients(ext))]).toEqual(['A']);
    await ext.local.set(KNOWN_RECIPIENTS_KEY, 'garbage');
    expect((await knownRecipients(ext)).size).toBe(0);
  });

  it('keeps at most MAX_KNOWN_RECIPIENTS, dropping the oldest', async () => {
    const ext = fakeExt();
    await ext.local.set(KNOWN_RECIPIENTS_KEY, Array.from({length: MAX_KNOWN_RECIPIENTS}, (_, i) => `r${i}`));
    await addKnownRecipient(ext, 'newest', 2);
    const set = await knownRecipients(ext);
    expect(set.size).toBe(MAX_KNOWN_RECIPIENTS);
    expect(set.has('r0')).toBe(false);
    expect(set.has('newest')).toBe(true);
  });
});
