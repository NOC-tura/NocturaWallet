import type {EnvelopeV1} from '../../vault/envelope';
import {VAULT_KEY, storeEnvelope, type StoreResult} from '../../background/accountsStore';
import {fakeExt} from '../../background/__tests__/fakeExt';
import type {VaultStore} from '../types';

/**
 * The vault page's store against the REAL background rule (accountsStore.storeEnvelope over an
 * in-memory storage.local): compare-and-set on the revision, the first-write rule, the shape and
 * same-wallet refusals, stored names kept. The envelope crosses as JSON, as a runtime message does.
 * `writes` is what storage held after each accepted store; `calls` is every store's answer.
 * `beforeStore` runs before each store, with the call's number (0-based) — how a test lets
 * "another tab" land a change between the flow's read and its store.
 */
export async function memoryVault(initial?: unknown) {
  const ext = fakeExt();
  if (initial !== undefined) await ext.local.set(VAULT_KEY, initial);
  const writes: EnvelopeV1[] = [];
  const calls: {expectedRevision: string | null; outcome: StoreResult}[] = [];
  let beforeStore: (call: number) => Promise<void> = async () => undefined;
  const store: VaultStore = {
    readEnvelope: () => ext.local.get(VAULT_KEY),
    storeEnvelope: async (expectedRevision, env) => {
      await beforeStore(calls.length);
      const outcome = await storeEnvelope(ext, expectedRevision, JSON.parse(JSON.stringify(env)));
      calls.push({expectedRevision, outcome});
      if (outcome === 'stored') writes.push((await ext.local.get(VAULT_KEY)) as EnvelopeV1);
      return outcome;
    },
  };
  return {
    ...store,
    ext,
    writes,
    calls,
    setBeforeStore(f: (call: number) => Promise<void>) {
      beforeStore = f;
    },
    stored: async () => (await ext.local.get(VAULT_KEY)) as EnvelopeV1 | undefined,
  };
}
