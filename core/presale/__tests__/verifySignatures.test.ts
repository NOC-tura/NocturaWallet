import {
  isPlausibleSignature,
  verifySignatures,
  MAX_SIGNATURES_PER_CALL,
  type SignatureStatusReader,
} from '../verifySignatures';

const SIG_A = '5fUCBTqKY12ChRgktmUM7Ad4NWbysmk44WKfQkVNWfJgLpuZz9pXiwx7NoqHBrF3UVfind9ZbzYdLDZVB1baJqwS';
const SIG_B = '27BRB9fcLBHhdcwYZg3HaPjTvpZrnSULt5eRxZxs6QNQeUzNakgRGrk2h9j8sPgWn2cuMjiWvzUdzQmESVA9PtWv';
const SIG_C = '75fvgBVd7oRWLYxQ9CqXymWyqEHpCcN7f9qzYQm4nUJvZPPXnFN6SPHXJKFfmyBtBFaNR34qkfjLwCbG9HUVXG81';

const reader = (fn: (s: string[]) => Promise<Array<{err: unknown} | null>>): SignatureStatusReader => ({
  getSignatureStatuses: fn,
});

describe('verifySignatures', () => {
  it('maps the three answers the chain can give', async () => {
    const v = await verifySignatures(
      reader(async () => [{err: null}, null, {err: {InstructionError: [0, 'x']}}]),
      [SIG_A, SIG_B, SIG_C],
    );
    expect(v[SIG_A]).toBe('confirmed');
    expect(v[SIG_B]).toBe('missing');
    expect(v[SIG_C]).toBe('failed');
  });

  it('reports UNKNOWN, never missing, when the read itself fails', async () => {
    // THE test. `missing` on screen says "this purchase does not exist"; saying that
    // because our own RPC was down accuses us of having taken money for nothing.
    const v = await verifySignatures(
      reader(async () => {
        throw new Error('502 from the RPC proxy');
      }),
      [SIG_A, SIG_B],
    );
    expect(v[SIG_A]).toBe('unknown');
    expect(v[SIG_B]).toBe('unknown');
    expect(Object.values(v)).not.toContain('missing');
  });

  it('treats a short status array as ignorance, not as a no', async () => {
    const v = await verifySignatures(reader(async () => [{err: null}]), [SIG_A, SIG_B]);
    expect(v[SIG_A]).toBe('confirmed');
    expect(v[SIG_B]).toBe('unknown');
  });

  it('never lets one malformed row poison the batch', async () => {
    // A malformed signature makes the RPC reject the entire call, which would turn every
    // other row on the page into `unknown`. It is filtered out before asking.
    const asked: string[][] = [];
    const v = await verifySignatures(
      reader(async s => {
        asked.push(s);
        return s.map(() => ({err: null}));
      }),
      ['not-a-signature', SIG_A],
    );
    expect(asked).toEqual([[SIG_A]]);
    expect(v['not-a-signature']).toBe('missing');
    expect(v[SIG_A]).toBe('confirmed');
  });

  it('asks about a repeated signature once', async () => {
    const fn = vi.fn(async (s: string[]) => s.map(() => ({err: null})));
    await verifySignatures(reader(fn), [SIG_A, SIG_A, SIG_A]);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0]?.[0]).toEqual([SIG_A]);
  });

  it('splits past the RPC batch limit instead of silently truncating', async () => {
    // 257 distinct plausible signatures, built by varying one character.
    const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const many = Array.from({length: MAX_SIGNATURES_PER_CALL + 1}, (_, i) => {
      const a = alphabet[i % alphabet.length] as string;
      const b = alphabet[Math.floor(i / alphabet.length) % alphabet.length] as string;
      return `${a}${b}${SIG_A.slice(2)}`;
    });
    expect(new Set(many).size).toBe(MAX_SIGNATURES_PER_CALL + 1);

    const sizes: number[] = [];
    const v = await verifySignatures(
      reader(async s => {
        sizes.push(s.length);
        return s.map(() => ({err: null}));
      }),
      many,
    );
    expect(sizes).toEqual([MAX_SIGNATURES_PER_CALL, 1]);
    expect(Object.keys(v)).toHaveLength(MAX_SIGNATURES_PER_CALL + 1);
  });

  it('does not throw when there is nothing to ask', async () => {
    const fn = vi.fn();
    await expect(verifySignatures(reader(fn as never), [])).resolves.toEqual({});
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('isPlausibleSignature', () => {
  it('accepts the real signatures this page renders', () => {
    for (const s of [SIG_A, SIG_B, SIG_C]) expect(isPlausibleSignature(s)).toBe(true);
  });

  it('rejects what a broken row looks like', () => {
    // The negative control. Without it the regex could be /.*/ and every test above
    // would still pass.
    for (const s of ['', 'pending', SIG_A.slice(0, 40), `${SIG_A}${SIG_A}`, `0O${SIG_A.slice(2)}`]) {
      expect(isPlausibleSignature(s), s).toBe(false);
    }
  });
});
