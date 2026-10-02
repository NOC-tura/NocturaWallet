import {MAX_RECORDS, inFlightFor, isOpen, readPending, updatePending, viewOf, type PendingRecord} from '../pendingStore';
import {PENDING_KEY} from '../pendingStore';
import {fakeExt} from './fakeExt';
import {pendingRecord as record} from './fixtures';

describe('pendingStore', () => {
  it('reads nothing from an empty or garbage store; records live in storage.local, never session', async () => {
    const ext = fakeExt();
    expect(await readPending(ext)).toEqual([]);
    await ext.local.set(PENDING_KEY, 'x');
    expect(await readPending(ext)).toEqual([]);
    await updatePending(ext, () => [record()]);
    expect(await ext.local.get(PENDING_KEY)).toHaveLength(1);
    expect(await ext.session.get(PENDING_KEY)).toBeUndefined();
  });

  it('open means pending or stuck; one open record per account is "in flight"', () => {
    expect(['pending', 'stuck', 'confirmed', 'failed', 'expired'].map(state => isOpen(record({state: state as PendingRecord['state']})))).toEqual([true, true, false, false, false]);
    expect(inFlightFor([record({state: 'expired'}), record({id: 'r2', state: 'stuck'})], 'A')?.id).toBe('r2');
    expect(inFlightFor([record({state: 'confirmed'})], 'A')).toBeUndefined();
  });

  it('drops stored elements that are not a record, so nothing downstream throws on them', async () => {
    const ext = fakeExt();
    const good = record({account: 'A', state: 'stuck'});
    const junk = [null, 7, 'x', [], {}, {...good, state: 'bogus'}, {...good, id: 1}, {...good, createdAt: 'x'}, {...good, intent: null}, {...good, detail: 3}];
    await ext.local.set(PENDING_KEY, [...junk, good]);
    const read = await readPending(ext);
    expect(read).toEqual([good]);
    expect(() => inFlightFor(read, 'A')).not.toThrow();
    expect(inFlightFor(read, 'A')?.id).toBe('r1');
  });

  it('keeps every open record, even past MAX_RECORDS, appended in order', async () => {
    const ext = fakeExt();
    const open = Array.from({length: MAX_RECORDS + 3}, (_, i) => record({id: `o${i}`, account: `A${i}`}));
    await updatePending(ext, () => open.slice(0, 1));
    const after = await updatePending(ext, rs => [...rs, ...open.slice(1), record({id: 'closed', state: 'failed'})]);
    expect(after.map(r => r.id)).toEqual(open.map(r => r.id));
  });

  it('the view carries no signed bytes', () => {
    expect('wire' in viewOf(record())).toBe(false);
  });

  it('keeps every open record and only the newest closed ones', async () => {
    const ext = fakeExt();
    const closed = Array.from({length: MAX_RECORDS + 5}, (_, i) => record({id: `c${i}`, state: 'confirmed'}));
    const after = await updatePending(ext, () => [record({id: 'open'}), ...closed]);
    expect(after).toHaveLength(MAX_RECORDS);
    expect(after[0]?.id).toBe('open');
    expect(after.at(-1)?.id).toBe(`c${MAX_RECORDS + 4}`);
  });
});

// Plan 3: the fee a record pays is a display field, in two parts (network, markup). A record from before it, or
// one whose value is not exactly two digit strings, reads with fee null — and is kept: a pending send must never
// be hidden.
describe('PendingRecord.fee (plan 3)', () => {
  it('missing or malformed reads as null and the record is kept; two digit strings read as they are', async () => {
    const ext = fakeExt();
    const {fee: _drop, ...before} = record({id: 'old'});
    const bad = (id: string, fee: unknown) => record({id, fee: fee as PendingRecord['fee']});
    const fee = {networkLamports: '5050', markupLamports: '20000'};
    await ext.local.set(PENDING_KEY, [
      before,
      bad('sum', '25050'),
      bad('num', {networkLamports: 5050, markupLamports: '0'}),
      bad('word', {networkLamports: '5050', markupLamports: 'lots'}),
      bad('half', {networkLamports: '5050'}),
      bad('neg', {networkLamports: '-1', markupLamports: '0'}),
      bad('arr', ['5050', '0']),
      record({id: 'ok', fee}),
    ]);
    expect((await readPending(ext)).map(r => [r.id, r.fee])).toEqual([
      ['old', null],
      ['sum', null],
      ['num', null],
      ['word', null],
      ['half', null],
      ['neg', null],
      ['arr', null],
      ['ok', fee],
    ]);
    expect(viewOf((await readPending(ext))[7]!).fee).toEqual(fee);
  });
});
