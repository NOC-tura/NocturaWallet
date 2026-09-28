import {argon2idKdf, runKdfRequest} from '../kdf';

const hex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');

describe('argon2idKdf', () => {
  it('is deterministic and 32 bytes', async () => {
    const salt = new Uint8Array(16).fill(7);
    const a = await argon2idKdf('password', salt, {m: 64, t: 1, p: 1});
    const b = await argon2idKdf('password', salt, {m: 64, t: 1, p: 1});
    expect(a.length).toBe(32);
    expect(hex(a)).toBe(hex(b));
  });

  it('depends on every input', async () => {
    const salt = new Uint8Array(16).fill(7);
    const base = hex(await argon2idKdf('password', salt, {m: 64, t: 1, p: 1}));
    expect(hex(await argon2idKdf('passwore', salt, {m: 64, t: 1, p: 1}))).not.toBe(base);
    expect(hex(await argon2idKdf('password', new Uint8Array(16).fill(8), {m: 64, t: 1, p: 1}))).not.toBe(base);
    expect(hex(await argon2idKdf('password', salt, {m: 128, t: 1, p: 1}))).not.toBe(base);
    expect(hex(await argon2idKdf('password', salt, {m: 64, t: 2, p: 1}))).not.toBe(base);
  });
});

describe('runKdfRequest (the KDF worker body)', () => {
  it('transfers the key buffer to the page, leaving the worker its detached view only', async () => {
    const {port1, port2} = new MessageChannel();
    let produced: Uint8Array | undefined;
    const received = new Promise<Uint8Array>(resolve => {
      port2.onmessage = (e: MessageEvent<{key: Uint8Array}>) => resolve(e.data.key);
    });
    await runKdfRequest(
      async (pw, salt, p) => {
        produced = await argon2idKdf(pw, salt, p);
        return produced;
      },
      {password: 'password', salt: new Uint8Array(16).fill(7), params: {m: 64, t: 1, p: 1}},
      (reply, transfer) => port1.postMessage(reply, transfer),
    );
    const key = await received;
    port1.close();
    port2.close();
    expect(key.length).toBe(32);
    expect(hex(key)).toBe(hex(await argon2idKdf('password', new Uint8Array(16).fill(7), {m: 64, t: 1, p: 1})));
    // Detached: the worker-side array no longer owns any bytes.
    expect(produced?.buffer.byteLength).toBe(0);
    expect(produced?.length).toBe(0);
  });

  it('reports a KDF failure as an error message, transferring nothing', async () => {
    const posts: [unknown, ArrayBuffer[]][] = [];
    await runKdfRequest(
      async () => {
        throw new Error('out of memory');
      },
      {password: 'x', salt: new Uint8Array(16), params: {m: 64, t: 1, p: 1}},
      (reply, transfer) => posts.push([reply, transfer]),
    );
    expect(posts).toEqual([[{error: 'out of memory'}, []]]);
  });
});
