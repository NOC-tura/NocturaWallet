import {attemptPasskeyUnlock, attemptUnlock, runExclusive, type BusyGate} from '../orchestrate';
import type {EnvelopeV1} from '../../vault/envelope';

const FAKE_ENV: EnvelopeV1 = {
  v: 1,
  scheme: 'slip10',
  kdf: {alg: 'argon2id', m: 1, t: 1, p: 1, salt: ''},
  seed: {iv: '', ct: ''},
  password: {wrapped: ''},
  accounts: [],
};

describe('attemptUnlock — the caller-owned prfOutput is zeroed on every path', () => {
  it('zeroes prfOutput when the envelope read resolves null (no wallet on this browser)', async () => {
    const prfOutput = new Uint8Array(32).fill(7);
    const r = await attemptUnlock({envelope: async () => null, send: async () => ({ok: true}), unlockFlow: async () => 'unlocked'}, {prfOutput});
    expect(r).toBe('no-wallet');
    expect(Array.from(prfOutput)).toEqual(new Array(32).fill(0));
  });

  it('zeroes prfOutput when the envelope read rejects (e.g. extension context invalidated mid-prompt)', async () => {
    const prfOutput = new Uint8Array(32).fill(9);
    await expect(
      attemptUnlock(
        {
          envelope: async () => {
            throw new Error('Extension context invalidated.');
          },
          send: async () => ({ok: true}),
          unlockFlow: async () => 'unlocked',
        },
        {prfOutput},
      ),
    ).rejects.toThrow('Extension context invalidated.');
    expect(Array.from(prfOutput)).toEqual(new Array(32).fill(0));
  });

  it('calls unlockFlow with the envelope and returns its outcome when a wallet exists', async () => {
    let sawEnv: EnvelopeV1 | undefined;
    const r = await attemptUnlock(
      {
        envelope: async () => FAKE_ENV,
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
      {envelope: async () => FAKE_ENV, send: async () => ({ok: true}), unlockFlow: async () => 'unlocked'},
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
      envelope: async () => FAKE_ENV,
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
      envelope: async () => FAKE_ENV,
      send: async () => ({ok: true}),
      unlockFlow: async () => 'unlocked',
    });
    expect(r).toBe('unavailable');
  });

  it('zeroes the PRF output evaluatePrf produced even when the envelope read comes back null', async () => {
    let captured: Uint8Array | undefined;
    const r = await attemptPasskeyUnlock({
      evaluatePrf: async () => {
        captured = new Uint8Array(32).fill(3);
        return captured;
      },
      envelope: async () => null,
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
      envelope: async () => FAKE_ENV,
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
