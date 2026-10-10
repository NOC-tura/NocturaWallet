import {base58} from '@scure/base';
import {CONTACTS_KEY, MAX_CONTACTS, nameKey, readContacts} from '../contacts';
import {handleWallet} from '../walletApi';
import {handleMessage} from '../messages';
import {VAULT_KEY} from '../accountsStore';
import {addKnownRecipient, isKnownRecipient} from '../knownRecipients';
import {prepareSend} from '../prepare';
import {getSession, setSession} from '../session';
import {lock} from '../autolock';
import {MAINNET_FEE_TREASURY} from '../../../../core/fees/transferMarkup';
import {fakeDeps} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, RECIPIENT, sendReader} from './fixtures';

// B1b-2b E17 (D18–D20, C12, C19): the address book — a label, never trust.
const OTHER = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const SECOND = {index: 1, publicKey: OTHER, secretKey: ACCOUNT.secretKey};
const ENV = {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: ACCOUNT.publicKey}, {index: 1, name: 'Savings', publicKey: OTHER}]};
/** The n-th distinct, canonical address (32 bytes, the first byte n + 1). */
const addr = (n: number): string => base58.encode(Uint8Array.from({length: 32}, (_, j) => (j === 0 ? n + 1 : 7)));
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const popup = {id: 'abcdefghijklmnopabcdefghijklmnop', origin: ORIGIN, url: `${ORIGIN}/popup.html`};
const web = {id: 'abcdefghijklmnopabcdefghijklmnop', origin: 'https://evil.example', url: 'https://evil.example/', tab: {}, frameId: 0};

async function setup(o: {unlocked?: boolean} = {}) {
  const ext = fakeExt();
  await ext.local.set(VAULT_KEY, ENV);
  if (o.unlocked !== false) await setSession(ext, [ACCOUNT, SECOND]);
  return ext;
}
type Ext = Awaited<ReturnType<typeof setup>>;
const call = (ext: Ext, type: 'contacts.list' | 'contacts.set' | 'contacts.remove', msg: Record<string, unknown> = {}) => handleWallet(ext, fakeDeps(), type, msg);
const list = async (ext: Ext) => ((await call(ext, 'contacts.list')).data as {contacts: {address: string; name: string; lastSentAt: number | null; known: boolean}[]}).contacts;

describe('contacts.set / contacts.list / contacts.remove (E17)', () => {
  it('a new contact goes first; the list carries lastSentAt and known from E6, and max 200', async () => {
    const ext = await setup();
    await addKnownRecipient(ext, addr(2), 1_700_000_000_000);
    expect(await call(ext, 'contacts.set', {address: addr(1), name: 'Marko · Mom'})).toEqual({ok: true, data: {created: true}});
    expect(await call(ext, 'contacts.set', {address: addr(2), name: '  Bistro  '})).toEqual({ok: true, data: {created: true}});
    expect(await call(ext, 'contacts.list')).toEqual({
      ok: true,
      data: {
        contacts: [
          {address: addr(2), name: 'Bistro', lastSentAt: 1_700_000_000_000, known: true},
          {address: addr(1), name: 'Marko · Mom', lastSentAt: null, known: false},
        ],
        max: 200,
      },
    });
    // Stored as {address, name} only — nothing else reaches storage.
    expect(await ext.local.get(CONTACTS_KEY)).toEqual([{address: addr(2), name: 'Bistro'}, {address: addr(1), name: 'Marko · Mom'}]);
  });

  it('one contact per address: a set for a saved address renames it in place (its position kept), created false', async () => {
    const ext = await setup();
    for (const n of [1, 2, 3]) await call(ext, 'contacts.set', {address: addr(n), name: `C${n}`});
    expect(await call(ext, 'contacts.set', {address: addr(2), name: 'Renamed'})).toEqual({ok: true, data: {created: false}});
    expect((await list(ext)).map(c => c.name)).toEqual(['C3', 'Renamed', 'C1']);
  });

  it('the 201st address is full and writes nothing; renaming one of the 200 still works', async () => {
    const ext = await setup();
    await ext.local.set(CONTACTS_KEY, Array.from({length: MAX_CONTACTS}, (_, i) => ({address: addr(i), name: `C${i}`})));
    const before = JSON.stringify(await ext.local.get(CONTACTS_KEY));
    expect(await call(ext, 'contacts.set', {address: addr(MAX_CONTACTS), name: 'One more'})).toEqual({ok: false, error: 'full'});
    expect(JSON.stringify(await ext.local.get(CONTACTS_KEY))).toBe(before);
    expect(await call(ext, 'contacts.set', {address: addr(5), name: 'Still fine'})).toEqual({ok: true, data: {created: false}});
  });

  it('malformed: not an address, a name cleanName refuses (C19 included) — nothing written', async () => {
    const ext = await setup();
    for (const [address, name] of [
      ['nope', 'Name'],
      [addr(1).slice(0, -1), 'Name'],
      [42, 'Name'],
      [addr(1), ''],
      [addr(1), '   '],
      [addr(1), 'x'.repeat(33)],
      [addr(1), 'Mo\u200Bm'],
      [addr(1), 'a\u202eb'],
      [addr(1), 7],
    ] as const) {
      expect(await call(ext, 'contacts.set', {address, name})).toEqual({ok: false, error: 'malformed'});
    }
    expect(await call(ext, 'contacts.remove', {address: 'nope'})).toEqual({ok: false, error: 'malformed'});
    expect(await ext.local.get(CONTACTS_KEY)).toBeUndefined();
  });

  it('remove: ok whether or not it was saved; nothing written for an absent address', async () => {
    const ext = await setup();
    expect(await call(ext, 'contacts.remove', {address: addr(1)})).toEqual({ok: true});
    expect(await ext.local.get(CONTACTS_KEY)).toBeUndefined();
    await call(ext, 'contacts.set', {address: addr(1), name: 'A'});
    await call(ext, 'contacts.set', {address: addr(2), name: 'B'});
    expect(await call(ext, 'contacts.remove', {address: addr(1)})).toEqual({ok: true});
    expect(await ext.local.get(CONTACTS_KEY)).toEqual([{address: addr(2), name: 'B'}]);
  });

  it('C12: all three are refused while locked, and nothing is written', async () => {
    const ext = await setup({unlocked: false});
    await ext.local.set(CONTACTS_KEY, [{address: addr(1), name: 'A'}]);
    expect(await call(ext, 'contacts.list')).toEqual({ok: false, error: 'locked'});
    expect(await call(ext, 'contacts.set', {address: addr(2), name: 'B'})).toEqual({ok: false, error: 'locked'});
    expect(await call(ext, 'contacts.remove', {address: addr(1)})).toEqual({ok: false, error: 'locked'});
    expect(await ext.local.get(CONTACTS_KEY)).toEqual([{address: addr(1), name: 'A'}]);
  });

  // Review R3: a real race, not lock-then-set. The lock is held mid-clear (its storage.session.clear parked on a gate)
  // while the set is issued; the set must wait for the whole lock and then answer `locked`. A session check made
  // outside the sessionMutex section would read the not-yet-cleared session and write after the lock.
  it('a lock in flight when a set arrives wins: the set waits for it, answers locked and writes nothing', async () => {
    const ext = await setup();
    let release = (): void => undefined;
    const gate = new Promise<void>(r => {
      release = r;
    });
    const clear = ext.session.clear;
    ext.session.clear = async () => {
      await gate;
      await clear();
    };
    const locking = lock(ext);
    const setting = call(ext, 'contacts.set', {address: addr(1), name: 'A'});
    for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r, 0));
    // Observe, then release before any assertion: a failed expect must not leave the module's mutexes held.
    const midLock = (await getSession(ext)) !== null;
    release();
    await locking;
    const result = await setting;
    expect(midLock).toBe(true); // the lock had not cleared yet: the set was parked behind it
    expect(result).toEqual({ok: false, error: 'locked'});
    expect(await ext.local.get(CONTACTS_KEY)).toBeUndefined();
  });

  // The converse ordering: a set already inside its section when a lock arrives finishes first (wholly before the lock).
  it('a set in flight when a lock arrives finishes first: the lock waits for the write', async () => {
    const ext = await setup();
    let release = (): void => undefined;
    const gate = new Promise<void>(r => {
      release = r;
    });
    const set = ext.local.set;
    ext.local.set = async (k, v) => {
      if (k === CONTACTS_KEY) await gate;
      await set(k, v);
    };
    const setting = call(ext, 'contacts.set', {address: addr(1), name: 'A'});
    for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r, 0));
    let locked = false;
    const locking = lock(ext).then(() => {
      locked = true;
    });
    for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r, 0));
    const lockedMidWrite = locked;
    release();
    const result = await setting;
    await locking;
    expect(lockedMidWrite).toBe(false); // the lock was parked behind the set's sessionMutex section
    expect(result).toEqual({ok: true, data: {created: true}});
    expect(await getSession(ext)).toBeNull();
    expect(await ext.local.get(CONTACTS_KEY)).toEqual([{address: addr(1), name: 'A'}]);
  });

  // Review R4: this pins the outcome only. sessionMutex already wraps each whole read-modify-write, so the test cannot
  // fail with the contacts mutex removed — the mutex is kept because the spec asks for one (E17), not because this proves it.
  it('two sets at once both land (the outcome; not a proof of the contacts mutex — sessionMutex alone serialises it)', async () => {
    const ext = await setup();
    await Promise.all([call(ext, 'contacts.set', {address: addr(1), name: 'A'}), call(ext, 'contacts.set', {address: addr(2), name: 'B'})]);
    expect((await list(ext)).map(c => c.name).sort()).toEqual(['A', 'B']);
  });

  it('a read keeps only valid entries: bad address, bad name, a later duplicate of an address, beyond 200 — dropped, never repaired', async () => {
    const ext = await setup();
    for (const junk of ['x', 7, null, {}]) {
      await ext.local.set(CONTACTS_KEY, junk);
      expect(await readContacts(ext)).toEqual([]);
    }
    await ext.local.set(CONTACTS_KEY, [
      {address: addr(1), name: 'A'},
      {address: 'nope', name: 'B'},
      {address: addr(2), name: 'Mo\u200Bm'},
      {address: addr(3), name: 42},
      'string',
      {address: addr(1), name: 'A again'},
      {address: addr(4), name: '  D  '},
    ]);
    expect(await readContacts(ext)).toEqual([{address: addr(1), name: 'A'}, {address: addr(4), name: 'D'}]);
    await ext.local.set(CONTACTS_KEY, Array.from({length: MAX_CONTACTS + 5}, (_, i) => ({address: addr(i), name: `C${i}`})));
    expect(await readContacts(ext)).toHaveLength(MAX_CONTACTS);
    expect((await ext.local.get(CONTACTS_KEY)) as unknown[]).toHaveLength(MAX_CONTACTS + 5);
  });

  it('contacts.* are privileged: refused from a web page, answered from the popup', async () => {
    const ext = await setup();
    for (const m of [{type: 'contacts.list'}, {type: 'contacts.set', address: addr(1), name: 'A'}, {type: 'contacts.remove', address: addr(1)}]) {
      expect(await handleMessage(ext, m, web, fakeDeps())).toEqual({ok: false, error: 'forbidden'});
    }
    expect(await ext.local.get(CONTACTS_KEY)).toBeUndefined();
    expect(await handleMessage(ext, {type: 'contacts.set', address: addr(1), name: 'A'}, popup, fakeDeps())).toEqual({ok: true, data: {created: true}});
  });
});

describe('C19: two contacts may not share a name (NFKC + case-folding)', () => {
  it('"Binance" then "binance", "BINANCE" or the NFKC-equal fullwidth "Ｂｉｎａｎｃｅ" for another address → duplicate-name', async () => {
    const ext = await setup();
    expect(await call(ext, 'contacts.set', {address: addr(1), name: 'Binance'})).toMatchObject({ok: true});
    for (const name of ['binance', 'BINANCE', ' Binance ', 'Ｂｉｎａｎｃｅ']) {
      expect(await call(ext, 'contacts.set', {address: addr(2), name})).toEqual({ok: false, error: 'duplicate-name'});
    }
    expect((await list(ext)).map(c => c.address)).toEqual([addr(1)]);
  });

  it('renaming a contact to its own name, in another case too, is fine', async () => {
    const ext = await setup();
    await call(ext, 'contacts.set', {address: addr(1), name: 'Binance'});
    expect(await call(ext, 'contacts.set', {address: addr(1), name: 'Binance'})).toEqual({ok: true, data: {created: false}});
    expect(await call(ext, 'contacts.set', {address: addr(1), name: 'BINANCE'})).toEqual({ok: true, data: {created: false}});
  });

  it('the fold: Straße and STRASSE are one name; nameKey is NFKC then case-folded', () => {
    expect(nameKey('Straße')).toBe(nameKey('STRASSE'));
    expect(nameKey('Ｍｏｍ')).toBe('mom');
  });

  // Fix round 1, M1: upper-then-lower is not idempotent — the capital ẞ (U+1E9E) upper-cases to itself and lower-cases to
  // ß, never to "ss". Lower, upper, lower reaches one key for all three spellings.
  it('the fold is idempotent: "Straße", "STRASSE" and "STRAẞE" are one name, and a second contact cannot take it', async () => {
    expect(new Set(['Straße', 'STRASSE', 'STRA\u1E9EE', 'strasse'].map(nameKey))).toEqual(new Set(['strasse']));
    expect(nameKey(nameKey('STRA\u1E9EE'))).toBe(nameKey('STRA\u1E9EE'));
    const ext = await setup();
    expect(await call(ext, 'contacts.set', {address: addr(1), name: 'Straße'})).toEqual({ok: true, data: {created: true}});
    for (const name of ['STRASSE', 'STRA\u1E9EE']) expect(await call(ext, 'contacts.set', {address: addr(2), name})).toEqual({ok: false, error: 'duplicate-name'});
  });

  // Rev 3, review L4 — the stated limit, pinned so a change is a decision: a cross-script look-alike is another name.
  it('limit: "Вinance" (Cyrillic В) is accepted beside "Binance" — the full address in pick rows is the defence', async () => {
    const ext = await setup();
    await call(ext, 'contacts.set', {address: addr(1), name: 'Binance'});
    expect(await call(ext, 'contacts.set', {address: addr(2), name: '\u0412inance'})).toEqual({ok: true, data: {created: true}});
  });
});

describe('D19: a contact is a label, never trust', () => {
  it('contacts.list `known` is isKnownRecipient — an own account, a recipient sent to, and a stranger', async () => {
    const ext = await setup();
    await addKnownRecipient(ext, addr(2), 5);
    for (const [n, address] of [[0, OTHER], [1, addr(2)], [2, addr(3)]] as const) await call(ext, 'contacts.set', {address, name: `C${n}`});
    const session = (await getSession(ext)) ?? [];
    for (const c of await list(ext)) expect([c.address, c.known]).toEqual([c.address, await isKnownRecipient(ext, session, c.address)]);
    expect((await list(ext)).map(c => c.known)).toEqual([false, true, true]);
  });

  it('parity: saving a contact never changes recipientInfo.known nor prepare’s first-send reason', async () => {
    for (const [recipient, sentBefore] of [[RECIPIENT, false], [RECIPIENT, true], [OTHER, false], [MAINNET_FEE_TREASURY, false]] as const) {
      const ext = await setup();
      if (sentBefore) await addKnownRecipient(ext, recipient, 5);
      const ask = async () => ((await handleWallet(ext, fakeDeps(), 'wallet.recipientInfo', {account: ACCOUNT.publicKey, recipient})).data as {known: boolean}).known;
      const firstSend = async () => {
        const view = await prepareSend(ext, fakeDeps({reader: sendReader()}), ACCOUNT.publicKey, {token: 'SOL', recipient, amount: '1000000'});
        return (view.reauth?.reasons ?? []).includes('first-send');
      };
      const before = [await ask(), await firstSend()];
      expect(await call(ext, 'contacts.set', {address: recipient, name: 'Saved'})).toMatchObject({ok: true});
      expect([recipient, await ask(), await firstSend()]).toEqual([recipient, ...before]);
    }
  });

  // The threat model, end to end: address poisoning. The user has paid RECIPIENT; a dusting look-alike (same first four
  // and last four characters) is saved — #27c's "Save sender" — under a friendly name. Every surface that says "known"
  // must still treat the look-alike as a stranger: recipientInfo, contacts.list and prepare's first-send re-auth.
  it('poisoning: a saved look-alike of a paid address is never known — recipientInfo, contacts.list, first-send all agree', async () => {
    const LOOKALIKE: string = '9Y7FtteLhCKABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
    expect([LOOKALIKE.slice(0, 4), LOOKALIKE.slice(-4), LOOKALIKE === RECIPIENT]).toEqual([RECIPIENT.slice(0, 4), RECIPIENT.slice(-4), false]);
    const ext = await setup();
    await addKnownRecipient(ext, RECIPIENT, 5);
    expect(await call(ext, 'contacts.set', {address: RECIPIENT, name: 'Bistro'})).toMatchObject({ok: true});
    expect(await call(ext, 'contacts.set', {address: LOOKALIKE, name: 'Bistro (new)'})).toEqual({ok: true, data: {created: true}});
    const info = async (recipient: string) => (await handleWallet(ext, fakeDeps(), 'wallet.recipientInfo', {account: ACCOUNT.publicKey, recipient})).data;
    expect(await info(LOOKALIKE)).toEqual({known: false, lastSentAt: null, label: {kind: 'contact', name: 'Bistro (new)'}, self: false});
    expect(await info(RECIPIENT)).toMatchObject({known: true, lastSentAt: 5});
    expect((await list(ext)).map(c => [c.address, c.known])).toEqual([
      [LOOKALIKE, false],
      [RECIPIENT, true],
    ]);
    const reasons = async (recipient: string) => (await prepareSend(ext, fakeDeps({reader: sendReader()}), ACCOUNT.publicKey, {token: 'SOL', recipient, amount: '1000000'})).reauth?.reasons ?? [];
    expect(await reasons(LOOKALIKE)).toContain('first-send');
    expect(await reasons(RECIPIENT)).not.toContain('first-send');
    expect(await isKnownRecipient(ext, (await getSession(ext)) ?? [], LOOKALIKE)).toBe(false);
  });
});
