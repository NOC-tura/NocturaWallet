import {argon2idAsync} from '@noble/hashes/argon2.js';
import {createEnvelope, type Kdf} from '../../vault/envelope';
import * as envelopeModule from '../../vault/envelope';
import {deriveSessionAccounts} from '../../vault/accounts';
import {runReveal} from '../revealFlow';
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
    expect(await runReveal(deps, {password: PASSWORD, kdf})).toEqual({outcome: 'shown', words: MNEMONIC.split(' ')});
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
    const prfOutput = crypto.getRandomValues(new Uint8Array(32));
    expect(await runReveal((await setup(null)).deps, {prfOutput})).toEqual({outcome: 'not-unlocked'});
    expect(prfOutput.every(b => b === 0)).toBe(true);
  });

  it('no wallet, and a damaged envelope, show nothing', async () => {
    const {deps} = await setup(MNEMONIC);
    expect(await runReveal({...deps, readEnvelope: async () => undefined}, {password: PASSWORD, kdf})).toEqual({outcome: 'no-wallet'});
    const env = (await deps.readEnvelope()) as envelopeModule.EnvelopeV1;
    expect(await runReveal({...deps, readEnvelope: async () => ({...env, kdf: {...env.kdf, m: 8}})}, {password: PASSWORD, kdf})).toEqual({outcome: 'damaged'});
  });
});
