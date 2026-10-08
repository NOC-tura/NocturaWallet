import {argon2idAsync} from '@noble/hashes/argon2.js';
import * as envelopeModule from '../../vault/envelope';
import {addPasskeyWrap, createEnvelope, unlockWithPassword, type EnvelopeV1, type Kdf} from '../../vault/envelope';
import {deriveSessionAccounts} from '../../vault/accounts';
import {runReauth, sessionKeys} from '../reauthFlow';
import type {Send} from '../types';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const OTHER = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const PASSWORD = 'correct horse battery';
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const kdf: Kdf = (pw, salt) => argon2idAsync(pw, salt, {m: 64, t: 1, p: 1, dkLen: 32});
const ID = 'cd'.repeat(16);

async function setup(sessionMnemonic: string | null, reply: (type: string) => {ok: boolean; error?: string} = () => ({ok: true})) {
  const session = sessionMnemonic === null ? [] : await deriveSessionAccounts(sessionMnemonic, 'slip10', [0]);
  const env: EnvelopeV1 = await createEnvelope({mnemonic: MNEMONIC, password: PASSWORD, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: K0}], kdf});
  const sent: {type: string; challengeId?: string}[] = [];
  const send: Send = async m => {
    const msg = m as {type: string};
    sent.push(msg);
    if (msg.type === 'vault.status') return {ok: true, data: {unlocked: sessionMnemonic !== null, accounts: session.map(a => ({index: a.index, publicKey: a.publicKey}))}};
    return reply(msg.type);
  };
  return {deps: {readEnvelope: async () => env, send}, sent, env};
}

describe('runReauth (the vault page proves the factor, the background is told)', () => {
  it("confirmed: proves against the session's public keys, then sends vault.reauthOk (positive control)", async () => {
    const {deps, sent} = await setup(MNEMONIC);
    expect(await runReauth(deps, ID, {password: PASSWORD, kdf})).toBe('confirmed');
    expect(sent.map(m => m.type)).toEqual(['vault.status', 'vault.reauthOk']);
    expect(sent[1]?.challengeId).toBe(ID);
  });

  it('a wrong password tells the background nothing', async () => {
    const {deps, sent} = await setup(MNEMONIC);
    expect(await runReauth(deps, ID, {password: 'nope nope nope nope', kdf})).toBe('wrong');
    expect(sent.map(m => m.type)).toEqual(['vault.status']);
  });

  it('a proof mismatch locks the vault (spec §2)', async () => {
    const {deps, sent} = await setup(OTHER);
    expect(await runReauth(deps, ID, {password: PASSWORD, kdf})).toBe('mismatch-locked');
    expect(sent.map(m => m.type)).toEqual(['vault.status', 'vault.lock']);
  });

  it('a mismatch whose lock the background refuses is not reported as locked', async () => {
    const {deps, sent} = await setup(OTHER, () => ({ok: false}));
    expect(await runReauth(deps, ID, {password: PASSWORD, kdf})).toBe('failed');
    expect(sent.map(m => m.type)).toEqual(['vault.status', 'vault.lock']);
  });

  it('a locked vault cannot be re-authenticated, and a passkey output is always zeroed', async () => {
    const {deps} = await setup(null);
    const prfOutput = crypto.getRandomValues(new Uint8Array(32));
    expect(await runReauth(deps, ID, {prfOutput})).toBe('not-unlocked');
    expect(prfOutput.every(b => b === 0)).toBe(true);
  });

  it('a passkey confirms, and its output is zeroed after the proof too', async () => {
    const {deps, env, sent} = await setup(MNEMONIC);
    const prf = crypto.getRandomValues(new Uint8Array(32));
    const dk = await unlockWithPassword(env, PASSWORD, kdf);
    const withPasskey = await addPasskeyWrap(env, dk, prf, new Uint8Array([1, 2, 3]), crypto.getRandomValues(new Uint8Array(32)));
    dk.fill(0);
    const prfOutput = prf.slice();
    expect(await runReauth({...deps, readEnvelope: async () => withPasskey}, ID, {prfOutput})).toBe('confirmed');
    expect(prfOutput.every(b => b === 0)).toBe(true);
    expect(sent.map(m => m.type)).toEqual(['vault.status', 'vault.reauthOk']);
  });

  it('a reauthOk refused without a named reason is `refused` (B1b-2b: the proof held, nothing was applied)', async () => {
    const {deps} = await setup(MNEMONIC, type => ({ok: type !== 'vault.reauthOk'}));
    expect(await runReauth(deps, ID, {password: PASSWORD, kdf})).toBe('refused');
  });

  it("B1b-2b E9: {ok: true, data: {applied: 'settings'}} is 'applied'; {ok: true} with no data stays 'confirmed' (a send)", async () => {
    const applied = await setup(MNEMONIC, type => (type === 'vault.reauthOk' ? ({ok: true, data: {applied: 'settings'}} as {ok: boolean}) : {ok: true}));
    expect(await runReauth(applied.deps, ID, {password: PASSWORD, kdf})).toBe('applied');
    const other = await setup(MNEMONIC, type => (type === 'vault.reauthOk' ? ({ok: true, data: {applied: 'send'}} as {ok: boolean}) : {ok: true}));
    expect(await runReauth(other.deps, ID, {password: PASSWORD, kdf})).toBe('confirmed');
    const plain = await setup(MNEMONIC);
    expect(await runReauth(plain.deps, ID, {password: PASSWORD, kdf})).toBe('confirmed');
  });

  // D39 (plan-1 carry): the challenge expired while the password was typed — #10 says "expired", never
  // "failed"; a lock between the status read and the confirmation is "not-unlocked".
  it("vault.reauthOk answered unknown-challenge is 'expired'; locked is 'not-unlocked'; any other refusal 'refused'", async () => {
    const expired = await setup(MNEMONIC, type => (type === 'vault.reauthOk' ? {ok: false, error: 'unknown-challenge'} : {ok: true}));
    expect(await runReauth(expired.deps, ID, {password: PASSWORD, kdf})).toBe('expired');
    const locked = await setup(MNEMONIC, type => (type === 'vault.reauthOk' ? {ok: false, error: 'locked'} : {ok: true}));
    expect(await runReauth(locked.deps, ID, {password: PASSWORD, kdf})).toBe('not-unlocked');
    const other = await setup(MNEMONIC, type => (type === 'vault.reauthOk' ? {ok: false, error: 'malformed'} : {ok: true}));
    expect(await runReauth(other.deps, ID, {password: PASSWORD, kdf})).toBe('refused');
  });

  it('a damaged envelope is named, and the background is told nothing — not even the status read (stored.ts)', async () => {
    const {deps, env, sent} = await setup(MNEMONIC);
    const damaged = {...env, password: {wrapped: 'AAAA'}};
    expect(await runReauth({...deps, readEnvelope: async () => damaged}, ID, {password: PASSWORD, kdf})).toBe('damaged');
    expect(sent).toEqual([]);
  });

  it('zeroes the data key it unwrapped', async () => {
    const {deps} = await setup(MNEMONIC);
    const keys: Uint8Array[] = [];
    const original = envelopeModule.unlockWithPassword;
    const spy = vi.spyOn(envelopeModule, 'unlockWithPassword').mockImplementation(async (...args) => {
      const k = await original(...args);
      keys.push(k);
      return k;
    });
    try {
      expect(await runReauth(deps, ID, {password: PASSWORD, kdf})).toBe('confirmed');
      expect(keys).toHaveLength(1);
      expect(keys[0]?.every(b => b === 0)).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it('no wallet', async () => {
    const {sent, deps} = await setup(MNEMONIC);
    expect(await runReauth({...deps, readEnvelope: async () => undefined}, ID, {password: PASSWORD, kdf})).toBe('no-wallet');
    expect(sent).toHaveLength(0);
  });
});

describe('sessionKeys', () => {
  const reply = (data: unknown): Send => async () => ({ok: true, data});
  it("reads the session's public keys, and nothing but index and publicKey", async () => {
    expect(await sessionKeys(reply({unlocked: true, accounts: [{index: 0, publicKey: K0, secretKey: 'x'}]}))).toEqual([{index: 0, publicKey: K0}]);
  });
  it('is null while locked, for an empty session and for anything malformed', async () => {
    expect(await sessionKeys(reply({unlocked: false, accounts: []}))).toBeNull();
    expect(await sessionKeys(reply({unlocked: true, accounts: []}))).toBeNull();
    expect(await sessionKeys(reply({unlocked: true, accounts: [{index: '0', publicKey: K0}]}))).toBeNull();
    expect(await sessionKeys(reply({unlocked: true, accounts: [null]}))).toBeNull();
    expect(await sessionKeys(async () => ({ok: false}))).toBeNull();
  });
});
