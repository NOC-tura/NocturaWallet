import {base64} from '@scure/base';
import {VersionedMessage} from '@solana/web3.js';
import {PREPARED_TTL_MS, parseIntent, peekPrepared, prepareSend, takePrepared} from '../prepare';
import {PREPARED_KEY, REAUTH_KEY, SESSION_KEY, clearSession, getSession, setSession} from '../session';
import {PENDING_KEY} from '../pendingStore';
import {KNOWN_RECIPIENTS_KEY} from '../knownRecipients';
import {challengeSatisfied} from '../reauthChallenges';
import {digestOf} from '../digest';
import {WALLET_TOKENS} from '../../../../core/solana/balances';
import {SPL_TOKEN_PROGRAM_ID} from '../../../../core/solana/transfer';
import {RpcForbidden} from '../../../../core/solana/rpc';
import {fakeDeps, fakeReader} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, BLOCKHASH, HOLDING_LARGE, HOLDING_SMALL, RECIPIENT, sendReader, unlocked} from './fixtures';
import {pendingRecord as record} from './fixtures';

const SOL_INTENT = {token: 'SOL' as const, recipient: RECIPIENT, amount: '1000000'};
const NOC = WALLET_TOKENS.NOC.mint as string;

async function knownSetup() {
  const ext = fakeExt();
  await unlocked(ext);
  await ext.local.set(KNOWN_RECIPIENTS_KEY, [RECIPIENT]);
  return ext;
}

describe('parseIntent', () => {
  it('accepts a wallet token, a base58 address and a positive integer amount up to u64', () => {
    expect(parseIntent(SOL_INTENT)).toEqual(SOL_INTENT);
    expect(parseIntent({...SOL_INTENT, amount: '18446744073709551615'})).not.toBeNull();
  });

  it('refuses anything else', () => {
    for (const bad of [
      null, {...SOL_INTENT, token: 'BONK'}, {...SOL_INTENT, recipient: '0OIl'}, {...SOL_INTENT, recipient: 'abc'},
      {...SOL_INTENT, amount: '0'}, {...SOL_INTENT, amount: '01'}, {...SOL_INTENT, amount: '1.5'}, {...SOL_INTENT, amount: '-1'},
      {...SOL_INTENT, amount: '18446744073709551616'}, {...SOL_INTENT, amount: 5},
    ]) {
      expect(parseIntent(bad)).toBeNull();
    }
  });
});

describe('prepareSend', () => {
  it('a small SOL send to a known address: network fee, no markup (status unknown), no re-auth (positive control)', async () => {
    const ext = await knownSetup();
    const view = await prepareSend(ext, fakeDeps({reader: sendReader()}), ACCOUNT.publicKey, SOL_INTENT);
    // 5 000 per signature + ceil(50 000 µlamports × 1 000 CU / 1e6) = 5 050 lamports.
    expect(view.fees).toEqual({networkLamports: '5050', priorityLamports: '50', rentLamports: '0', markupLamports: '0', markupReason: 'status-unknown'});
    expect(view.solRequiredLamports).toBe('1005050');
    expect(view.reauth).toBeNull();
    const stored = (await ext.session.get(PREPARED_KEY)) as {id: string; lastValidBlockHeight: number}[];
    expect(stored.map(p => p.id)).toEqual([view.id]);
    expect(stored[0]?.lastValidBlockHeight).toBe(1000);
  });

  it('stores an unsigned v0 message paid by the account, for this blockhash and recipient', async () => {
    const ext = await knownSetup();
    const view = await prepareSend(ext, fakeDeps({reader: sendReader()}), ACCOUNT.publicKey, SOL_INTENT);
    const msg = VersionedMessage.deserialize(base64.decode((await peekPrepared(ext, view.id))!.message));
    expect(msg.staticAccountKeys[0]?.toBase58()).toBe(ACCOUNT.publicKey);
    expect(msg.recentBlockhash).toBe(BLOCKHASH);
    expect(msg.staticAccountKeys.map(k => k.toBase58())).toContain(RECIPIENT);
  });

  it('a first send to a new address issues a challenge bound to this prepared send', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    const deps = fakeDeps({reader: sendReader()});
    const view = await prepareSend(ext, deps, ACCOUNT.publicKey, SOL_INTENT);
    expect(view.reauth?.reasons).toEqual(['first-send']);
    const p = await peekPrepared(ext, view.id);
    expect(p?.challengeId).toBe(view.reauth?.challengeId);
    expect(await challengeSatisfied(ext, deps.now(), view.reauth!.challengeId, p!.digest)).toBe(false);
  });

  it('sending to the account itself is not a first send', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    const view = await prepareSend(ext, fakeDeps({reader: sendReader()}), ACCOUNT.publicKey, {...SOL_INTENT, recipient: ACCOUNT.publicKey});
    expect(view.reauth).toBeNull();
  });

  it('a missing price counts as above the dollar threshold', async () => {
    const ext = await knownSetup();
    const deps = fakeDeps({
      reader: sendReader(),
      prices: async () => {
        throw new Error('prices down');
      },
    });
    expect((await prepareSend(ext, deps, ACCOUNT.publicKey, SOL_INTENT)).reauth?.reasons).toEqual(['over-usd-threshold']);
  });

  it('an SPL send spends from the largest holding, creates the recipient account and shows its rent up front', async () => {
    const ext = await knownSetup();
    const reader = sendReader({
      getTokenAccountsByOwner: async () => [
        {pubkey: HOLDING_SMALL, mint: NOC, owner: ACCOUNT.publicKey, amount: 5n, decimals: 9},
        {pubkey: HOLDING_LARGE, mint: NOC, owner: ACCOUNT.publicKey, amount: 13_399_619n, decimals: 9},
      ],
      getAccountExists: async () => false,
    });
    const view = await prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, {token: 'NOC', recipient: RECIPIENT, amount: '1000000'});
    // 65 000 CU with the create: priority ceil(50 000 × 65 000 / 1e6) = 3 250; network 8 250; rent 2 039 280.
    expect(view.fees).toMatchObject({rentLamports: '2039280', priorityLamports: '3250', networkLamports: '8250'});
    expect(view.solRequiredLamports).toBe('2047530');
    const msg = VersionedMessage.deserialize(base64.decode((await peekPrepared(ext, view.id))!.message));
    const keys = msg.staticAccountKeys.map(k => k.toBase58());
    const transferChecked = msg.compiledInstructions.find(ix => keys[ix.programIdIndex] === SPL_TOKEN_PROGRAM_ID.toBase58() && ix.data[0] === 12);
    expect(keys[transferChecked!.accountKeyIndexes[0]!]).toBe(HOLDING_LARGE);
  });

  it('NOC is valued at the presale stage price for the dollar rule (owner decision B)', async () => {
    const ext = await knownSetup();
    const reader = sendReader({
      getTokenAccountsByOwner: async () => [{pubkey: HOLDING_LARGE, mint: NOC, owner: ACCOUNT.publicKey, amount: 10_000_000_000_000n, decimals: 9}],
      getAccountExists: async () => true,
    });
    // 100 NOC × $0.1501 = $15.01: under $100, and 1 % of the holding.
    const intent = {token: 'NOC' as const, recipient: RECIPIENT, amount: '100000000000'};
    expect((await prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, intent)).reauth).toBeNull();
    const noStage = fakeDeps({
      reader,
      stagePrice: async () => {
        throw new Error('stats down');
      },
    });
    expect((await prepareSend(ext, noStage, ACCOUNT.publicKey, intent)).reauth?.reasons).toEqual(['over-usd-threshold']);
    // /stats answered without a usable currentStage: the stage price is null → re-auth required.
    const missingStage = fakeDeps({reader, stagePrice: async () => null});
    expect((await prepareSend(ext, missingStage, ACCOUNT.publicKey, intent)).reauth?.reasons).toEqual(['over-usd-threshold']);
    const forbidden = fakeDeps({
      reader,
      stagePrice: async () => {
        throw new RpcForbidden('/stats');
      },
    });
    await expect(prepareSend(ext, forbidden, ACCOUNT.publicKey, intent)).rejects.toBeInstanceOf(RpcForbidden);
  });

  it('refuses a send that would leave the sender below the rent-exempt minimum — but not one that empties it', async () => {
    const ext = await knownSetup();
    // 10 SOL; 1 SOL − 5 050 fee − 500 000 left would remain.
    const leaves = (10_000_000_000n - 500_000n - 5_050n).toString();
    await expect(prepareSend(ext, fakeDeps({reader: sendReader()}), ACCOUNT.publicKey, {...SOL_INTENT, amount: leaves})).rejects.toMatchObject({code: 'sender-below-rent'});
    const everything = (10_000_000_000n - 5_050n).toString();
    expect((await prepareSend(ext, fakeDeps({reader: sendReader()}), ACCOUNT.publicKey, {...SOL_INTENT, amount: everything})).solRequiredLamports).toBe('10000000000');
  });

  it('refuses less than the rent-exempt minimum to a brand-new recipient account', async () => {
    const ext = await knownSetup();
    const reader = sendReader({getAccountExists: async () => false});
    await expect(prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, {...SOL_INTENT, amount: '890879'})).rejects.toMatchObject({code: 'recipient-below-rent'});
    expect((await prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, {...SOL_INTENT, amount: '890880'})).id).toMatch(/^[0-9a-f]{32}$/);
    expect((await prepareSend(ext, fakeDeps({reader: sendReader()}), ACCOUNT.publicKey, {...SOL_INTENT, amount: '1000'})).id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('refuses a balance split across accounts, before simulating', async () => {
    const ext = await knownSetup();
    const reader = sendReader({
      getTokenAccountsByOwner: async () => [
        {pubkey: HOLDING_SMALL, mint: NOC, owner: ACCOUNT.publicKey, amount: 100n, decimals: 9},
        {pubkey: HOLDING_LARGE, mint: NOC, owner: ACCOUNT.publicKey, amount: 60n, decimals: 9},
      ],
      simulateTransaction: async () => {
        throw new Error('must not simulate');
      },
    });
    await expect(prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, {token: 'NOC', recipient: RECIPIENT, amount: '160'})).rejects.toMatchObject({code: 'split-balance'});
  });

  it('refuses when SOL cannot cover the amount and the fees', async () => {
    const ext = await knownSetup();
    const reader = sendReader({getBalance: async () => 1_000_000n});
    await expect(prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, SOL_INTENT)).rejects.toMatchObject({code: 'insufficient-sol'});
  });

  it('refuses a transaction whose simulation fails', async () => {
    const ext = await knownSetup();
    const reader = sendReader({simulateTransaction: async () => ({err: {InstructionError: [2, {Custom: 1}]}, logs: [], unitsConsumed: null})});
    await expect(prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, SOL_INTENT)).rejects.toMatchObject({code: 'simulation-failed', detail: '{"InstructionError":[2,{"Custom":1}]}'});
  });

  it('refuses while a send from the account is in flight — without a single network call', async () => {
    const ext = await knownSetup();
    await ext.local.set(PENDING_KEY, [record({account: ACCOUNT.publicKey, state: 'stuck'})]);
    await expect(prepareSend(ext, fakeDeps({reader: fakeReader()}), ACCOUNT.publicKey, SOL_INTENT)).rejects.toMatchObject({code: 'in-flight'});
  });

  it('refuses when locked, and for an account the session does not hold', async () => {
    await expect(prepareSend(fakeExt(), fakeDeps(), ACCOUNT.publicKey, SOL_INTENT)).rejects.toMatchObject({code: 'locked'});
    const ext = await knownSetup();
    await expect(prepareSend(ext, fakeDeps(), RECIPIENT, SOL_INTENT)).rejects.toMatchObject({code: 'unknown-account'});
  });

  it('a 403 from the coordinator surfaces as RpcForbidden, not as a refusal to retry', async () => {
    const ext = await knownSetup();
    const reader = sendReader({
      getLatestBlockhash: async () => {
        throw new RpcForbidden('getLatestBlockhash');
      },
    });
    await expect(prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, SOL_INTENT)).rejects.toBeInstanceOf(RpcForbidden);
  });

  it('a lock while the send is being prepared leaves nothing behind — no prepared send, no challenge', async () => {
    for (const known of [true, false]) {
      const ext = known ? await knownSetup() : fakeExt();
      if (!known) await unlocked(ext);
      const reader = sendReader({
        simulateTransaction: async () => {
          await clearSession(ext);
          return {err: null, logs: [], unitsConsumed: 450};
        },
      });
      await expect(prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, SOL_INTENT)).rejects.toMatchObject({code: 'locked'});
      expect(await ext.session.get(PREPARED_KEY)).toBeUndefined();
      expect(await ext.session.get(REAUTH_KEY)).toBeUndefined();
    }
  });

  it('an unlock arriving while prepare handles a mid-prepare lock is not wiped (fix round 1)', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    const get = ext.session.get.bind(ext.session);
    let locked = false;
    let unlockDone: Promise<void> | undefined;
    ext.session.get = async key => {
      const v = await get(key);
      // prepare's in-section getSession has read "locked"; the user unlocks before it acts on it.
      if (key === SESSION_KEY && locked && unlockDone === undefined) unlockDone = setSession(ext, [ACCOUNT]);
      return v;
    };
    const reader = sendReader({
      simulateTransaction: async () => {
        await clearSession(ext);
        locked = true;
        return {err: null, logs: [], unitsConsumed: 450};
      },
    });
    await expect(prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, SOL_INTENT)).rejects.toMatchObject({code: 'locked'});
    expect(unlockDone).toBeDefined();
    await unlockDone;
    expect(await getSession(ext)).toEqual([ACCOUNT]);
    expect(await get(PREPARED_KEY)).toBeUndefined();
    expect(await get(REAUTH_KEY)).toBeUndefined();
  });

  it('the lock branch removes only the orphaned challenge — it never clears the whole area', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    const clear = vi.spyOn(ext.session, 'clear');
    const remove = vi.spyOn(ext.session, 'remove');
    const reader = sendReader({
      simulateTransaction: async () => {
        await clearSession(ext);
        clear.mockClear();
        return {err: null, logs: [], unitsConsumed: 450};
      },
    });
    await expect(prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, SOL_INTENT)).rejects.toMatchObject({code: 'locked'});
    expect(clear).not.toHaveBeenCalled();
    expect(remove.mock.calls).toEqual([[REAUTH_KEY]]);
  });

  it('a lock racing the write of the prepared send is never undone by it', async () => {
    const ext = await knownSetup();
    const get = ext.session.get.bind(ext.session);
    let lockDone: Promise<void> | undefined;
    ext.session.get = async key => {
      const v = await get(key);
      // The lock arrives while prepareSend holds the prepared list it read: it must wait for the write.
      if (key === PREPARED_KEY && lockDone === undefined) lockDone = clearSession(ext);
      return v;
    };
    await prepareSend(ext, fakeDeps({reader: sendReader()}), ACCOUNT.publicKey, SOL_INTENT);
    expect(lockDone).toBeDefined();
    await lockDone;
    expect(await get(PREPARED_KEY)).toBeUndefined();
  });

  it('issuing a challenge while preparing does not deadlock on the session mutex', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    const view = await prepareSend(ext, fakeDeps({reader: sendReader()}), ACCOUNT.publicKey, SOL_INTENT);
    expect(view.reauth?.reasons).toEqual(['first-send']);
    expect(await peekPrepared(ext, view.id)).not.toBeNull();
  }, 2_000);

  it('the challenge is bound to the digest of this exact send', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    const view = await prepareSend(ext, fakeDeps({reader: sendReader()}), ACCOUNT.publicKey, SOL_INTENT);
    const p = (await peekPrepared(ext, view.id))!;
    const {account, token, recipient, amount} = {account: p.account, ...p.intent};
    expect(p.digest).toBe(digestOf('send', {account, token, recipient, amount, message: p.message}));
    const stored = (await ext.session.get(REAUTH_KEY)) as Record<string, {digest: string}>;
    expect(stored[view.reauth!.challengeId]?.digest).toBe(p.digest);
  });

  it('a newer prepare replaces the older one; taking is single use; an expired one is refused as prepared-expired', async () => {
    const ext = await knownSetup();
    const deps = fakeDeps({reader: sendReader()});
    const first = await prepareSend(ext, deps, ACCOUNT.publicKey, SOL_INTENT);
    const second = await prepareSend(ext, deps, ACCOUNT.publicKey, SOL_INTENT);
    expect(await peekPrepared(ext, first.id)).toBeNull();
    expect((await takePrepared(ext, deps, second.id)).id).toBe(second.id);
    await expect(takePrepared(ext, deps, second.id)).rejects.toMatchObject({code: 'unknown-prepared'});
    const third = await prepareSend(ext, deps, ACCOUNT.publicKey, SOL_INTENT);
    deps.clock.t += PREPARED_TTL_MS;
    await expect(takePrepared(ext, deps, third.id)).rejects.toMatchObject({code: 'prepared-expired'});
  });
});
