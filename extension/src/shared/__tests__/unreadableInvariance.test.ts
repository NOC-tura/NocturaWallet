import {DELETABLE, F, breadth, firstEncoder, type Json} from './vaultControls';

// B1e §2.6 invariance: the opener's policy tightened (the KDF floor doubled, one account at most, every account list
// refused) leaves every verdict of the frozen predicate as it was. The controls are built first with the real modules;
// then envelopeRules is mocked and the modules are loaded again under the mock. Its own positive control: under the
// same mock, envelopeShape and storedVault now refuse F0 — the mock took, so the invariance means something.

const positive = async (): Promise<(readonly [string, Json])[]> => [...F, ...(await breadth()), ...firstEncoder()];

describe('unreadableV1 does not move when the opener’s policy is tightened', () => {
  afterEach(() => {
    vi.doUnmock('../envelopeRules');
    vi.resetModules();
  });

  it('every control keeps its verdict; the mock demonstrably bit', async () => {
    const readable = await positive();
    const real = await import('../../background/accountsStore');
    expect(real.envelopeShape(F[0]?.[1])).not.toBeNull();

    vi.resetModules();
    vi.doMock('../envelopeRules', async (orig: () => Promise<typeof import('../envelopeRules')>) => ({
      ...(await orig()),
      ENVELOPE_KDF_MIN: {m: 131072, t: 3, p: 1},
      MAX_ACCOUNTS: 1,
      accountsPolicyOk: () => false,
    }));
    const rules = await import('../envelopeRules');
    const {envelopeShape} = await import('../../background/accountsStore');
    const {storedVault} = await import('../../unlock/stored');
    const {unreadableV1} = await import('../unreadable');

    expect([rules.ENVELOPE_KDF_MIN.m, rules.MAX_ACCOUNTS]).toEqual([131072, 1]);
    expect(envelopeShape(F[0]?.[1])).toBeNull();
    expect(storedVault(F[0]?.[1]).kind).toBe('damaged');

    for (const [name, raw] of readable) expect([name, unreadableV1(raw)]).toEqual([name, false]);
    for (const [name, raw] of DELETABLE) expect([name, unreadableV1(raw)]).toEqual([name, true]);
  }, 60_000);
});
