import type {EnvelopeV1} from '../../vault/envelope';
import type {Send} from '../types';
import {backgroundVaultStore} from '../vaultStore';

const ENV = {v: 1} as unknown as EnvelopeV1;
const REV = 'ab'.repeat(32);

describe('backgroundVaultStore (the background is the one writer of v1_vault)', () => {
  it('reads with the reader it is given, and stores by sending vault.storeEnvelope', async () => {
    const sent: unknown[] = [];
    const send: Send = async m => (sent.push(m), {ok: true});
    const store = backgroundVaultStore(send, async () => 'stored-thing');
    expect(await store.readEnvelope()).toBe('stored-thing');
    expect(await store.storeEnvelope(REV, ENV)).toBe('stored');
    expect(await store.storeEnvelope(null, ENV)).toBe('stored');
    expect(sent).toEqual([
      {type: 'vault.storeEnvelope', expectedRevision: REV, envelope: ENV},
      {type: 'vault.storeEnvelope', expectedRevision: null, envelope: ENV},
    ]);
  });

  it.each(['busy', 'wallet-exists', 'stored-invalid', 'malformed', 'no-wallet'] as const)("passes the background's '%s' through", async error => {
    expect(await backgroundVaultStore(async () => ({ok: false, error}), async () => undefined).storeEnvelope(REV, ENV)).toBe(error);
  });

  it("anything else — a refusal it does not know, no error, a thrown send — is 'failed'", async () => {
    const read = async () => undefined;
    expect(await backgroundVaultStore(async () => ({ok: false, error: 'forbidden'}), read).storeEnvelope(REV, ENV)).toBe('failed');
    expect(await backgroundVaultStore(async () => ({ok: false}), read).storeEnvelope(REV, ENV)).toBe('failed');
    expect(await backgroundVaultStore(async () => ({ok: false, error: 'constructor'}), read).storeEnvelope(REV, ENV)).toBe('failed');
    const thrown: Send = async () => {
      throw new Error('Extension context invalidated');
    };
    expect(await backgroundVaultStore(thrown, read).storeEnvelope(REV, ENV)).toBe('failed');
  });
});
