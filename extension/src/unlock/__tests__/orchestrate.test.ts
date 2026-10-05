import {
  attemptPasskeyUnlock,
  attemptUnlock,
  createWrongBackoff,
  runExclusive,
  wrongDelayMs,
  MAX_WRONG_DELAY_MS,
  type BusyGate,
  type Outcome,
} from '../orchestrate';
import {base64} from '@scure/base';
import type {EnvelopeV1} from '../../vault/envelope';

// Well-formed (checkEnvelope accepts it: production Argon2id, every byte string its length), so the
// read is a wallet; unlockFlow is a stub, so nothing here is decrypted.
const bytes = (n: number) => base64.encode(new Uint8Array(n));
const FAKE_ENV: EnvelopeV1 = {
  v: 1,
  scheme: 'slip10',
  kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: bytes(16)},
  seed: {iv: bytes(12), ct: bytes(48)},
  password: {wrapped: bytes(40)},
  accounts: [{index: 0, name: 'A', publicKey: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'}],
};

describe('attemptUnlock — the caller-owned prfOutput is zeroed on every path', () => {
  it('zeroes prfOutput when nothing is stored (no wallet on this browser)', async () => {
    const prfOutput = new Uint8Array(32).fill(7);
    const r = await attemptUnlock({readEnvelope: async () => undefined, send: async () => ({ok: true}), unlockFlow: async () => 'unlocked'}, {prfOutput});
    expect(r).toBe('no-wallet');
    expect(Array.from(prfOutput)).toEqual(new Array(32).fill(0));
  });

  // Plan-1 carry: the background calls a stored null (or any non-envelope) stored-invalid; the page
  // used to call it "no wallet" and offer setup over it. It is damaged, never sent to unlockFlow.
  // An object table, not a bare array: it.each spreads a row that is itself an array (e.g. `[]`) into
  // zero title arguments, printing "undefined" for that case (Fable review, fix round 1 item 6) — a
  // named `$label` field sidesteps that rather than relying on the row's own shape.
  it.each([
    {label: 'null', stored: null},
    {label: '[]', stored: []},
    {label: '"v1"', stored: 'v1'},
    {label: 'an envelope with no accounts', stored: {...FAKE_ENV, accounts: []}},
  ])('a stored $label is damaged, not "no wallet", and zeroes prfOutput', async ({stored}) => {
    const prfOutput = new Uint8Array(32).fill(7);
    const unlockFlow = vi.fn(async () => 'unlocked' as const);
    expect(await attemptUnlock({readEnvelope: async () => stored, send: async () => ({ok: true}), unlockFlow}, {prfOutput})).toBe('damaged');
    expect(unlockFlow).not.toHaveBeenCalled();
    expect(Array.from(prfOutput)).toEqual(new Array(32).fill(0));
  });

  it('zeroes prfOutput when the envelope read rejects (e.g. extension context invalidated mid-prompt)', async () => {
    const prfOutput = new Uint8Array(32).fill(9);
    expect(
      await attemptUnlock(
        {
          readEnvelope: async () => {
            throw new Error('Extension context invalidated.');
          },
          send: async () => ({ok: true}),
          unlockFlow: async () => 'unlocked',
        },
        {prfOutput},
      ),
    ).toBe('failed');
    expect(Array.from(prfOutput)).toEqual(new Array(32).fill(0));
  });

  it('calls unlockFlow with the envelope and returns its outcome when a wallet exists', async () => {
    let sawEnv: EnvelopeV1 | undefined;
    const r = await attemptUnlock(
      {
        readEnvelope: async () => FAKE_ENV,
        send: async () => ({ok: true}),
        unlockFlow: async deps => {
          sawEnv = deps.env;
          return 'wrong';
        },
      },
      {prfOutput: new Uint8Array(32).fill(1)},
    );
    expect(r).toBe('wrong');
    expect(sawEnv).toBe(FAKE_ENV);
  });

  it('leaves a password factor alone (nothing to zero)', async () => {
    const r = await attemptUnlock(
      {readEnvelope: async () => FAKE_ENV, send: async () => ({ok: true}), unlockFlow: async () => 'unlocked'},
      {password: 'correct horse battery', kdf: async () => new Uint8Array(32)},
    );
    expect(r).toBe('unlocked');
  });
});

describe('attemptPasskeyUnlock', () => {
  it('reports unavailable, without calling unlockFlow, when evaluatePrf yields no output', async () => {
    let called = false;
    const r = await attemptPasskeyUnlock({
      evaluatePrf: async () => null,
      readEnvelope: async () => FAKE_ENV,
      send: async () => ({ok: true}),
      unlockFlow: async () => {
        called = true;
        return 'unlocked';
      },
    });
    expect(r).toBe('unavailable');
    expect(called).toBe(false);
  });

  it('reports unavailable when evaluatePrf throws (the platform prompt was cancelled)', async () => {
    const r = await attemptPasskeyUnlock({
      evaluatePrf: async () => {
        throw new Error('NotAllowedError');
      },
      readEnvelope: async () => FAKE_ENV,
      send: async () => ({ok: true}),
      unlockFlow: async () => 'unlocked',
    });
    expect(r).toBe('unavailable');
  });

  it('zeroes the PRF output evaluatePrf produced even when nothing is stored', async () => {
    let captured: Uint8Array | undefined;
    const r = await attemptPasskeyUnlock({
      evaluatePrf: async () => {
        captured = new Uint8Array(32).fill(3);
        return captured;
      },
      readEnvelope: async () => undefined,
      send: async () => ({ok: true}),
      unlockFlow: async () => 'unlocked',
    });
    expect(r).toBe('no-wallet');
    expect(captured).toBeDefined();
    expect(Array.from(captured ?? [])).toEqual(new Array(32).fill(0));
  });

  it('unlocks end-to-end when the PRF output and the envelope are both good', async () => {
    const r = await attemptPasskeyUnlock({
      evaluatePrf: async () => new Uint8Array(32).fill(1),
      readEnvelope: async () => FAKE_ENV,
      send: async () => ({ok: true}),
      unlockFlow: async () => 'unlocked',
    });
    expect(r).toBe('unlocked');
  });
});

describe('runExclusive — one in-flight guard for the whole page', () => {
  function fakeGate(): BusyGate {
    let busy = false;
    return {isBusy: () => busy, setBusy: b => (busy = b)};
  }

  it('ignores a second action while the first is still in flight, and never calls it', async () => {
    const gate = fakeGate();
    let resolveFirst: (() => void) | undefined;
    const first = new Promise<void>(resolve => {
      resolveFirst = resolve;
    });

    const firstResult = runExclusive(gate, async () => {
      await first;
      return 'first-done';
    });
    // The gate is busy synchronously — before `first` (or anything else) has a chance to
    // resolve — which is what makes it safe to check from a synchronous click handler.
    expect(gate.isBusy()).toBe(true);

    let secondCalled = false;
    const secondResult = await runExclusive(gate, async () => {
      secondCalled = true;
      return 'second-done';
    });
    expect(secondResult).toBe('busy');
    expect(secondCalled).toBe(false);

    resolveFirst?.();
    expect(await firstResult).toBe('first-done');
    expect(gate.isBusy()).toBe(false);
  });

  it('frees the gate in a finally even when the action throws', async () => {
    const gate = fakeGate();
    await expect(
      runExclusive(gate, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(gate.isBusy()).toBe(false);
  });

  it('runs a later action once the gate has freed up', async () => {
    const gate = fakeGate();
    expect(await runExclusive(gate, async () => 'a')).toBe('a');
    expect(await runExclusive(gate, async () => 'b')).toBe('b');
  });
});

describe('wrong-password backoff (spec §2: an increasing delay on top of the Argon2id cost)', () => {
  function recordingSleep() {
    const slept: number[] = [];
    return {slept, sleep: async (ms: number) => void slept.push(ms)};
  }

  it('grows 0, 1 s, 2 s, 4 s, 8 s, 16 s and caps at 30 s', () => {
    const seq = [1, 2, 3, 4, 5, 6, 7, 8, 50].map(wrongDelayMs);
    expect(seq).toEqual([0, 1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
    expect(MAX_WRONG_DELAY_MS).toBe(30000);
  });

  it('sleeps the growing delay after each consecutive wrong outcome, and shows the wait once per sleep', async () => {
    const {slept, sleep} = recordingSleep();
    const backoff = createWrongBackoff(sleep);
    let waits = 0;
    for (let i = 0; i < 5; i++) await backoff.run(async () => 'wrong' as Outcome, () => waits++);
    expect(slept).toEqual([1000, 2000, 4000, 8000]);
    expect(waits).toBe(4);
  });

  // #9's cooldown card counts the wait down: the page is told its length (B1b-2a §3.9).
  it('tells onWait how long the wait is', async () => {
    const backoff = createWrongBackoff(async () => undefined);
    const told: number[] = [];
    for (let i = 0; i < 4; i++) await backoff.run(async () => 'wrong' as Outcome, ms => told.push(ms));
    expect(told).toEqual([1000, 2000, 4000]);
  });

  // Fix round 1 item 3: a throwing onWait (a page bug in the countdown UI) must never skip the
  // delay itself — that would let a broken display defeat the backoff.
  it('still sleeps the full delay when onWait throws', async () => {
    const {slept, sleep} = recordingSleep();
    const backoff = createWrongBackoff(sleep);
    // The first consecutive wrong has no delay (ms === 0, §2) — onWait is not even called — so the
    // throwing onWait has to be the second, where wrongDelayMs(2) === 1000.
    await backoff.run(async () => 'wrong' as Outcome, () => undefined);
    await expect(
      backoff.run(async () => 'wrong' as Outcome, () => {
        throw new Error('countdown UI bug');
      }),
    ).rejects.toThrow('countdown UI bug');
    expect(slept).toEqual([1000]);
  });

  it("resets on #40's factor proof ('proven'), as on unlocked", async () => {
    const {slept, sleep} = recordingSleep();
    const backoff = createWrongBackoff(sleep);
    await backoff.run(async () => 'wrong', () => undefined);
    await backoff.run(async () => 'wrong', () => undefined);
    await backoff.run(async () => 'proven', () => undefined);
    await backoff.run(async () => 'wrong', () => undefined);
    await backoff.run(async () => 'wrong', () => undefined);
    expect(slept).toEqual([1000, 1000]);
  });

  it.each(['applied', 'refused'])("B1b-2b: resets on #10's '%s' (the proof held, as 'confirmed')", async proven => {
    const {slept, sleep} = recordingSleep();
    const backoff = createWrongBackoff(sleep);
    await backoff.run(async () => 'wrong', () => undefined);
    await backoff.run(async () => 'wrong', () => undefined);
    await backoff.run(async () => proven, () => undefined);
    await backoff.run(async () => 'wrong', () => undefined);
    await backoff.run(async () => 'wrong', () => undefined);
    expect(slept).toEqual([1000, 1000]);
  });

  it('resets on unlocked', async () => {
    const {slept, sleep} = recordingSleep();
    const backoff = createWrongBackoff(sleep);
    await backoff.run(async () => 'wrong' as Outcome, () => undefined);
    await backoff.run(async () => 'wrong' as Outcome, () => undefined);
    await backoff.run(async () => 'wrong' as Outcome, () => undefined);
    await backoff.run(async () => 'unlocked' as Outcome, () => undefined);
    await backoff.run(async () => 'wrong' as Outcome, () => undefined);
    await backoff.run(async () => 'wrong' as Outcome, () => undefined);
    expect(slept).toEqual([1000, 2000, 1000]);
  });

  it('neither resets nor grows on failed / unavailable / no-wallet', async () => {
    const {slept, sleep} = recordingSleep();
    const backoff = createWrongBackoff(sleep);
    await backoff.run(async () => 'wrong' as Outcome, () => undefined);
    await backoff.run(async () => 'failed' as Outcome, () => undefined);
    await backoff.run(async () => 'unavailable' as Outcome | 'unavailable', () => undefined);
    await backoff.run(async () => 'no-wallet' as Outcome, () => undefined);
    await backoff.run(async () => 'wrong' as Outcome, () => undefined);
    expect(slept).toEqual([1000]);
  });

  it('neither resets nor grows on damaged (a corrupt envelope is not a guess)', async () => {
    const {slept, sleep} = recordingSleep();
    const backoff = createWrongBackoff(sleep);
    let waits = 0;
    await backoff.run(async () => 'wrong' as Outcome, () => waits++);
    await backoff.run(async () => 'wrong' as Outcome, () => waits++);
    for (let i = 0; i < 3; i++) expect(await backoff.run(async () => 'damaged' as Outcome, () => waits++)).toBe('damaged');
    await backoff.run(async () => 'wrong' as Outcome, () => waits++);
    expect(slept).toEqual([1000, 2000]);
    expect(waits).toBe(2);
  });

  it('returns the outcome unchanged', async () => {
    const backoff = createWrongBackoff(async () => undefined);
    expect(await backoff.run(async () => 'wrong' as Outcome, () => undefined)).toBe('wrong');
    expect(await backoff.run(async () => 'unlocked' as Outcome, () => undefined)).toBe('unlocked');
  });

  it('keeps the busy gate held for the whole delay', async () => {
    let busy = false;
    const gate: BusyGate = {isBusy: () => busy, setBusy: b => (busy = b)};
    let release: (() => void) | undefined;
    const sleeps: number[] = [];
    const backoff = createWrongBackoff(ms => {
      sleeps.push(ms);
      return new Promise<void>(resolve => {
        release = resolve;
      });
    });
    await runExclusive(gate, () => backoff.run(async () => 'wrong' as Outcome, () => undefined));
    const second = runExclusive(gate, () => backoff.run(async () => 'wrong' as Outcome, () => undefined));
    // Let the action reach the sleep.
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(sleeps).toEqual([1000]);
    expect(gate.isBusy()).toBe(true);
    let thirdCalled = false;
    expect(
      await runExclusive(gate, async () => {
        thirdCalled = true;
        return 'x';
      }),
    ).toBe('busy');
    expect(thirdCalled).toBe(false);
    release?.();
    expect(await second).toBe('wrong');
    expect(gate.isBusy()).toBe(false);
  });
});

describe('the wrong-password backoff also serves re-authentication, accounts and the reveal', () => {
  it.each(['confirmed', 'done', 'done-locked', 'done-not-locked', 'shown'])("a proven '%s' ends the streak, like 'unlocked'", async success => {
    const sleeps: number[] = [];
    const backoff = createWrongBackoff(async ms => void sleeps.push(ms));
    const run = (o: string) => backoff.run(async () => o, () => undefined);
    await run('wrong');
    await run('wrong');
    await run(success);
    await run('wrong');
    expect(sleeps).toEqual([1000]);
  });

  it.each(['failed', 'damaged', 'mismatch-locked', 'not-unlocked', 'added'])("'%s' leaves the streak as it is (negative control): never charged, never a reset", async other => {
    const sleeps: number[] = [];
    const backoff = createWrongBackoff(async ms => void sleeps.push(ms));
    const run = (o: string) => backoff.run(async () => o, () => undefined);
    await run('wrong');
    await run('wrong');
    await run(other);
    await run('wrong');
    expect(sleeps).toEqual([1000, 2000]);
  });
});
