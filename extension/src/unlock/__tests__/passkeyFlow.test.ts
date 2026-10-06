import {addPasskeyWrap, createEnvelope, unlockWithPassword, type EnvelopeV1} from '../../vault/envelope';
import {deriveSessionAccounts} from '../../vault/accounts';
import {VAULT_KEY} from '../../background/accountsStore';
import {setSession} from '../../background/session';
import {removePasskey} from '../passkeyFlow';
import type {Send} from '../types';
import {harness, testKdf} from './pageHarness';

// B1b-2b E12: removing the passkey from the vault page, against the REAL background.
const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const OTHER = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const PW = 'correct horse battery';
const PRF = crypto.getRandomValues(new Uint8Array(32));

async function setup(o: {session?: string | null; passkey?: boolean; send?: (inner: Send) => Send} = {}) {
  let env: EnvelopeV1 = await createEnvelope({mnemonic: M, password: PW, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: K0}], kdf: testKdf});
  if (o.passkey !== false) env = await addPasskeyWrap(env, await unlockWithPassword(env, PW, testKdf), PRF.slice(), crypto.getRandomValues(new Uint8Array(16)), crypto.getRandomValues(new Uint8Array(32)));
  const h = await harness({vault: env, ...(o.send === undefined ? {} : {send: o.send})});
  const session = o.session === undefined ? M : o.session;
  if (session !== null) await setSession(h.ext, await deriveSessionAccounts(session, 'slip10', [0]));
  return {h, env, deps: {readEnvelope: h.deps.store.readEnvelope, send: h.deps.send}};
}
const stored = async (h: {ext: {local: {get(k: string): Promise<unknown>}}}) => (await h.ext.local.get(VAULT_KEY)) as EnvelopeV1;

describe('removePasskey (E12)', () => {
  it('by password: removed; the envelope keeps every other field; the message carries only the revision', async () => {
    const {h, env, deps} = await setup();
    expect(await removePasskey(deps, {password: PW, kdf: testKdf})).toBe('removed');
    const {passkey: _p, ...rest} = env;
    expect(await stored(h)).toEqual(rest);
    const msg = h.sent.find(m => m.type === 'vault.removePasskey');
    expect(Object.keys(msg ?? {}).sort()).toEqual(['expectedRevision', 'type']);
  });

  it('by the passkey itself: removed, and the PRF output is zeroed', async () => {
    const {h, deps} = await setup();
    const prfOutput = PRF.slice();
    expect(await removePasskey(deps, {prfOutput})).toBe('removed');
    expect(prfOutput.every(b => b === 0)).toBe(true);
    expect((await stored(h)).passkey).toBeUndefined();
  });

  it('a mismatch locks the vault and removes nothing', async () => {
    const {h, deps} = await setup({session: OTHER});
    expect(await removePasskey(deps, {password: PW, kdf: testKdf})).toBe('mismatch-locked');
    expect((await stored(h)).passkey).toBeDefined();
    expect(h.sent.map(m => m.type)).toContain('vault.lock');
  });

  it('wrong, not-unlocked, no-passkey; the PRF output zeroed on a refusal too', async () => {
    expect(await removePasskey((await setup()).deps, {password: 'nope nope nope nope', kdf: testKdf})).toBe('wrong');
    const locked = await setup({session: null});
    const prfOutput = PRF.slice();
    expect(await removePasskey(locked.deps, {prfOutput})).toBe('not-unlocked');
    expect(prfOutput.every(b => b === 0)).toBe(true);
    expect(await removePasskey((await setup({passkey: false})).deps, {password: PW, kdf: testKdf})).toBe('no-passkey');
  });

  it('busy once: the whole flow runs again (a fresh read and proof); busy twice is `busy`', async () => {
    let busy = 1;
    const once = await setup({send: inner => async m => ((m as {type: string}).type === 'vault.removePasskey' && busy-- > 0 ? {ok: false, error: 'busy'} : inner(m))});
    expect(await removePasskey(once.deps, {password: PW, kdf: testKdf})).toBe('removed');
    expect(once.h.sent.filter(m => m.type === 'vault.status')).toHaveLength(2);
    const always = await setup({send: inner => async m => ((m as {type: string}).type === 'vault.removePasskey' ? {ok: false, error: 'busy'} : inner(m))});
    expect(await removePasskey(always.deps, {password: PW, kdf: testKdf})).toBe('busy');
    expect((await stored(always.h)).passkey).toBeDefined();
  });

  // Task 4 review carry: the passkey factor survives the busy retry (one prompt, two proofs) and is zeroed only at the end.
  it('busy once by the passkey: the retry proves with the same PRF output — removed — and it is zeroed afterwards', async () => {
    let busy = 1;
    const once = await setup({send: inner => async m => ((m as {type: string}).type === 'vault.removePasskey' && busy-- > 0 ? {ok: false, error: 'busy'} : inner(m))});
    const prfOutput = PRF.slice();
    expect(await removePasskey(once.deps, {prfOutput})).toBe('removed');
    expect(once.h.sent.filter(m => m.type === 'vault.status')).toHaveLength(2);
    expect(prfOutput.every(b => b === 0)).toBe(true);
    expect((await stored(once.h)).passkey).toBeUndefined();
  });

  it('no-wallet and damaged from the read (nothing sent); the PRF output zeroed', async () => {
    const send: Send = async () => {
      throw new Error('must not send');
    };
    const prfOutput = PRF.slice();
    expect(await removePasskey({readEnvelope: async () => undefined, send}, {prfOutput})).toBe('no-wallet');
    expect(prfOutput.every(b => b === 0)).toBe(true);
    expect(await removePasskey({readEnvelope: async () => null, send}, {password: PW, kdf: testKdf})).toBe('damaged');
  });

  it("the background's refusals map to outcomes: locked → not-unlocked, stored-invalid → damaged, no-passkey, no-wallet, anything else → failed", async () => {
    const cases: [string, string][] = [
      ['locked', 'not-unlocked'],
      ['stored-invalid', 'damaged'],
      ['no-passkey', 'no-passkey'],
      ['no-wallet', 'no-wallet'],
      ['malformed', 'failed'],
      ['forbidden', 'failed'],
    ];
    for (const [error, outcome] of cases) {
      const {h, deps} = await setup({send: inner => async m => ((m as {type: string}).type === 'vault.removePasskey' ? {ok: false, error} : inner(m))});
      expect(await removePasskey(deps, {password: PW, kdf: testKdf})).toBe(outcome);
      expect((await stored(h)).passkey).toBeDefined();
    }
  });

  it('a send that throws is failed, and the PRF output is zeroed; a mismatch by passkey zeroes it too', async () => {
    const thrower = await setup({
      send: inner => async m => {
        if ((m as {type: string}).type === 'vault.removePasskey') throw new Error('port closed');
        return inner(m);
      },
    });
    const prfOutput = PRF.slice();
    expect(await removePasskey(thrower.deps, {prfOutput})).toBe('failed');
    expect(prfOutput.every(b => b === 0)).toBe(true);
    const mismatch = await setup({session: OTHER});
    const again = PRF.slice();
    expect(await removePasskey(mismatch.deps, {prfOutput: again})).toBe('mismatch-locked');
    expect(again.every(b => b === 0)).toBe(true);
    expect((await stored(mismatch.h)).passkey).toBeDefined();
  });
});
