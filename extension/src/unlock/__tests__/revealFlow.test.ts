import {argon2idAsync} from '@noble/hashes/argon2.js';
import {createEnvelope, type Kdf} from '../../vault/envelope';
import * as envelopeModule from '../../vault/envelope';
import {deriveSessionAccounts} from '../../vault/accounts';
import {recordVerified, runReveal} from '../revealFlow';
import {envelopeRevision} from '../../shared/envelopeRevision';
import type {Send} from '../types';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const OTHER = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const PASSWORD = 'correct horse battery';
const kdf: Kdf = (pw, salt) => argon2idAsync(pw, salt, {m: 64, t: 1, p: 1, dkLen: 32});

async function setup(sessionMnemonic: string | null) {
  const session = sessionMnemonic === null ? [] : await deriveSessionAccounts(sessionMnemonic, 'slip10', [0]);
  const env = await createEnvelope({mnemonic: MNEMONIC, password: PASSWORD, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'}], kdf});
  const sent: {type: string}[] = [];
  const send: Send = async m => {
    const msg = m as {type: string};
    sent.push(msg);
    if (msg.type === 'vault.status') return {ok: true, data: {unlocked: sessionMnemonic !== null, accounts: session.map(a => ({index: a.index, publicKey: a.publicKey}))}};
    return {ok: true};
  };
  return {deps: {readEnvelope: async () => env, send}, sent};
}

describe('runReveal (spec §2: the phrase, only after a proof, only in the vault page)', () => {
  it('shows the words after a proof — and tells the background nothing (positive control)', async () => {
    const {deps, sent} = await setup(MNEMONIC);
    // m7: with the revision of the envelope it proved against (what vault.phraseVerified binds the fact to).
    const revision = envelopeRevision((await deps.readEnvelope()) as envelopeModule.EnvelopeV1);
    expect(await runReveal(deps, {password: PASSWORD, kdf})).toEqual({outcome: 'shown', words: MNEMONIC.split(' '), revision});
    expect(sent.map(m => m.type)).toEqual(['vault.status']);
    // Nothing of the phrase in any message.
    expect(JSON.stringify(sent)).not.toContain('abandon');
  });

  it('zeroes the data key it unwrapped', async () => {
    const {deps} = await setup(MNEMONIC);
    let captured: Uint8Array | undefined;
    const original = envelopeModule.unlockWithPassword;
    const spy = vi.spyOn(envelopeModule, 'unlockWithPassword').mockImplementation(async (...args) => {
      captured = await original(...args);
      return captured;
    });
    try {
      expect((await runReveal(deps, {password: PASSWORD, kdf})).outcome).toBe('shown');
      expect(captured?.every(b => b === 0)).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it('a wrong password shows nothing; a mismatch locks the vault; a locked vault shows nothing', async () => {
    expect((await runReveal((await setup(MNEMONIC)).deps, {password: 'nope nope nope nope', kdf})).outcome).toBe('wrong');
    const foreign = await setup(OTHER);
    expect(await runReveal(foreign.deps, {password: PASSWORD, kdf})).toEqual({outcome: 'mismatch-locked'});
    expect(foreign.sent.map(m => m.type)).toEqual(['vault.status', 'vault.lock']);
    expect(await runReveal((await setup(null)).deps, {password: PASSWORD, kdf})).toEqual({outcome: 'not-unlocked'});
  });

  it('B1b-2b E16 (D23): a passkey factor cast past the type is refused — failed, nothing read or sent, the PRF output zeroed', async () => {
    const {deps, sent} = await setup(MNEMONIC);
    let reads = 0;
    const prfOutput = crypto.getRandomValues(new Uint8Array(32));
    const factor = {prfOutput} as unknown as {password: string; kdf: Kdf};
    expect(await runReveal({...deps, readEnvelope: async () => (reads++, deps.readEnvelope())}, factor)).toEqual({outcome: 'failed'});
    expect(prfOutput.every(b => b === 0)).toBe(true);
    expect(reads).toBe(0);
    expect(sent).toEqual([]);
    // Even beside a password: any prfOutput refuses.
    const both = {password: PASSWORD, kdf, prfOutput: crypto.getRandomValues(new Uint8Array(32))};
    expect(await runReveal(deps, both)).toEqual({outcome: 'failed'});
    expect(both.prfOutput.every(b => b === 0)).toBe(true);
  });

  it('fix round 1 (I1): refused on the key, not its value — prfOutput: undefined, and a getter read once', async () => {
    const {deps, sent} = await setup(MNEMONIC);
    let reads = 0;
    const counted = {...deps, readEnvelope: async () => (reads++, deps.readEnvelope())};
    // (a) the key present, its value undefined.
    expect(await runReveal(counted, {password: PASSWORD, kdf, prfOutput: undefined} as unknown as {password: string; kdf: Kdf})).toEqual({outcome: 'failed'});
    // (b) a getter that answers undefined first and the PRF after: read once, refused, nothing opened.
    const prf = crypto.getRandomValues(new Uint8Array(32));
    let gets = 0;
    const sly = {password: 'not the password', kdf};
    Object.defineProperty(sly, 'prfOutput', {enumerable: true, get: () => (gets++ === 0 ? undefined : prf)});
    expect(await runReveal(counted, sly)).toEqual({outcome: 'failed'});
    expect(gets).toBe(1);
    // (c) the same getter the other way round: the bytes it handed over are zeroed.
    const prf2 = crypto.getRandomValues(new Uint8Array(32));
    let gets2 = 0;
    const sly2 = {password: PASSWORD, kdf};
    Object.defineProperty(sly2, 'prfOutput', {enumerable: true, get: () => (gets2++ === 0 ? prf2 : undefined)});
    expect(await runReveal(counted, sly2)).toEqual({outcome: 'failed'});
    expect(prf2.every(b => b === 0)).toBe(true);
    expect(reads).toBe(0);
    expect(sent).toEqual([]);
  });

  it('fix round 1 (I1): openProven gets a fresh password factor — a proxy whose `has` answers later cannot pick the passkey path', async () => {
    const {deps} = await setup(MNEMONIC);
    const prf = crypto.getRandomValues(new Uint8Array(32));
    // A spy on the PRF path: it must never be chosen.
    const spy = vi.spyOn(envelopeModule, 'unlockWithPrf').mockImplementation(async () => {
      throw new Error('the passkey path was chosen');
    });
    let has = 0;
    const proxy = new Proxy({password: 'not the password', kdf} as Record<string, unknown>, {
      has: (t, k) => (k === 'prfOutput' ? has++ > 0 : k in t),
      get: (t, k) => (k === 'prfOutput' ? prf : t[k as string]),
    });
    try {
      expect(await runReveal(deps, proxy as unknown as {password: string; kdf: Kdf})).toEqual({outcome: 'wrong'});
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('recordVerified: sends only the fact and the proven revision (no word of the phrase); true when the background says so', async () => {
    const {deps, sent} = await setup(MNEMONIC);
    const revision = 'a'.repeat(64);
    expect(await recordVerified(deps.send, revision)).toBe(true);
    expect(sent).toEqual([{type: 'vault.phraseVerified', expectedRevision: revision}]);
    expect(await recordVerified(async () => ({ok: false, error: 'locked'}), revision)).toBe(false);
    expect(await recordVerified(async () => ({ok: false, error: 'busy'}), revision)).toBe(false);
    expect(
      await recordVerified(async () => {
        throw new Error('gone');
      }, revision),
    ).toBe(false);
  });

  it('no wallet, and a damaged envelope, show nothing', async () => {
    const {deps} = await setup(MNEMONIC);
    expect(await runReveal({...deps, readEnvelope: async () => undefined}, {password: PASSWORD, kdf})).toEqual({outcome: 'no-wallet'});
    const env = (await deps.readEnvelope()) as envelopeModule.EnvelopeV1;
    expect(await runReveal({...deps, readEnvelope: async () => ({...env, kdf: {...env.kdf, m: 8}})}, {password: PASSWORD, kdf})).toEqual({outcome: 'damaged'});
  });
});
