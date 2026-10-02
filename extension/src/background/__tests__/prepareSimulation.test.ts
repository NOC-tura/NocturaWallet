import {base64} from '@scure/base';
import {VersionedTransaction} from '@solana/web3.js';
import {preparedFor, prepareSend, rentRefusal} from '../prepare';
import {handleWallet} from '../walletApi';
import {KNOWN_RECIPIENTS_KEY} from '../knownRecipients';
import {RpcMalformed, createForbiddenLatch, createRpc, solanaReader, type SimulationOutcome, type SolanaReader} from '../../../../core/solana/rpc';
import {WALLET_TOKENS} from '../../../../core/solana/balances';
import {fakeDeps} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, HOLDING_LARGE, RECIPIENT, SIMULATED_SLOT, consistentSimulation, sendReader, tokenAccountData, unlocked} from './fixtures';

// Spec B1b-2a E2: #19 shows what the simulation says the transaction does, and the engine refuses a
// simulation whose effect is not the transaction it built.
const SOL_INTENT = {token: 'SOL' as const, recipient: RECIPIENT, amount: '1000000'};
const NOC = WALLET_TOKENS.NOC.mint as string;
const NOC_INTENT = {token: 'NOC' as const, recipient: RECIPIENT, amount: '1000000'};
const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const nocHoldings = async () => [{pubkey: HOLDING_LARGE, mint: NOC, owner: ACCOUNT.publicKey, amount: 13_399_619n, decimals: 9}];

async function setup() {
  const ext = fakeExt();
  await unlocked(ext);
  await ext.local.set(KNOWN_RECIPIENTS_KEY, [RECIPIENT]);
  return ext;
}

/** sendReader whose simulation is the consistent one, then changed by `edit`. Records the addresses asked for. */
function editedReader(edit: (o: SimulationOutcome) => SimulationOutcome, overrides: Partial<SolanaReader> = {}) {
  const asked: (readonly string[])[] = [];
  const base = sendReader(overrides);
  const reader: SolanaReader = {
    ...base,
    simulateTransaction: async (tx, o) => {
      asked.push(o?.accounts ?? []);
      return edit(await consistentSimulation(base, tx, o?.accounts ?? []));
    },
  };
  return {reader, asked};
}
const withSenderLamports = (o: SimulationOutcome, lamports: bigint): SimulationOutcome => ({
  ...o,
  accounts: (o.accounts ?? []).map((a, i) => (i === 0 && a !== null ? {...a, lamports} : a)),
});

describe('prepareSend: the simulation (E2)', () => {
  it('a SOL send: the payer before and after, the programs, the recipient kind, the slot — and the addresses asked for', async () => {
    const ext = await setup();
    const {reader, asked} = editedReader(o => o);
    const view = await prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, SOL_INTENT);
    expect(asked).toEqual([[ACCOUNT.publicKey]]);
    // Fee not in the simulated state: after = 10 SOL − 1 000 000.
    expect(view.simulation).toEqual({
      slot: SIMULATED_SLOT,
      elapsedMs: 0,
      instructions: 3,
      programs: ['compute-budget', 'system'],
      recipient: 'wallet',
      sol: {before: '10000000000', after: '9999000000'},
      token: null,
    });
  });

  it('accepts the simulated state with the network fee included, exactly', async () => {
    const ext = await setup();
    // solRequired = 1 000 000 + 5 050.
    const {reader} = editedReader(o => withSenderLamports(o, 10_000_000_000n - 1_005_050n));
    expect((await prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, SOL_INTENT)).simulation.sol.after).toBe('9998994950');
  });

  it('one lamport off in either direction is simulation-mismatch, naming both numbers', async () => {
    const ext = await setup();
    for (const after of [10_000_000_000n - 1_000_001n, 10_000_000_000n - 999_999n, 10_000_000_000n - 1_005_051n]) {
      const {reader} = editedReader(o => withSenderLamports(o, after));
      await expect(prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, SOL_INTENT)).rejects.toMatchObject({code: 'simulation-mismatch'});
    }
  });

  it('a simulation that does not show the sender is simulation-mismatch', async () => {
    const ext = await setup();
    const {reader} = editedReader(o => ({...o, accounts: [null]}));
    await expect(prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, SOL_INTENT)).rejects.toMatchObject({code: 'simulation-mismatch'});
  });

  it('measures the simulate call with the engine clock', async () => {
    const ext = await setup();
    const deps = fakeDeps();
    const base = sendReader();
    const reader: SolanaReader = {
      ...base,
      simulateTransaction: async (tx, o) => {
        deps.clock.t += 412;
        return base.simulateTransaction(tx, o);
      },
    };
    expect((await prepareSend(ext, {...deps, reader}, ACCOUNT.publicKey, SOL_INTENT)).simulation.elapsedMs).toBe(412);
  });

  it('an SPL send: the source token account before and after, the ATA program when the recipient account is created', async () => {
    const ext = await setup();
    const {reader, asked} = editedReader(o => o, {getTokenAccountsByOwner: nocHoldings, getAccountExists: async () => false});
    const view = await prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, NOC_INTENT);
    expect(asked).toEqual([[ACCOUNT.publicKey, HOLDING_LARGE]]);
    expect(view.simulation.token).toEqual({symbol: 'NOC', before: '13399619', after: '12399619'});
    expect(view.simulation.programs).toEqual(['compute-budget', 'associated-token', 'token']);
    // The payer pays the recipient account's rent: 10 SOL − 2 039 280.
    expect(view.simulation.sol).toEqual({before: '10000000000', after: '9997960720'});
  });

  it('a token account with the wrong mint, the wrong owner or the wrong amount is simulation-mismatch', async () => {
    const ext = await setup();
    const tokenAt = (mint: string, owner: string, amount: bigint, program = TOKEN, length = 165) => (o: SimulationOutcome): SimulationOutcome => ({
      ...o,
      accounts: [o.accounts?.[0] ?? null, {lamports: 2_039_280n, owner: program, data: tokenAccountData(mint, owner, amount).slice(0, length)}],
    });
    const USDC = WALLET_TOKENS.USDC.mint as string;
    const SYSTEM = '11111111111111111111111111111111';
    for (const edit of [
      tokenAt(USDC, ACCOUNT.publicKey, 12_399_619n),
      tokenAt(NOC, RECIPIENT, 12_399_619n),
      tokenAt(NOC, ACCOUNT.publicKey, 12_399_620n),
      // Right bytes, but the account is not the token program's: not a token account.
      tokenAt(NOC, ACCOUNT.publicKey, 12_399_619n, SYSTEM),
      // One byte short of the amount's end: refused as a mismatch, not read past its end.
      tokenAt(NOC, ACCOUNT.publicKey, 12_399_619n, TOKEN, 71),
    ]) {
      const {reader} = editedReader(edit, {getTokenAccountsByOwner: nocHoldings});
      await expect(prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, NOC_INTENT)).rejects.toMatchObject({code: 'simulation-mismatch'});
    }
    // Positive control: the right mint, owner and amount pass.
    const {reader} = editedReader(tokenAt(NOC, ACCOUNT.publicKey, 12_399_619n), {getTokenAccountsByOwner: nocHoldings});
    expect((await prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, NOC_INTENT)).simulation.token?.after).toBe('12399619');
  });

  it('an SPL send: accepts the sender state simulated with the network fee included, exactly', async () => {
    const ext = await setup();
    const plain = await prepareSend(ext, fakeDeps({reader: editedReader(o => o, {getTokenAccountsByOwner: nocHoldings}).reader}), ACCOUNT.publicKey, NOC_INTENT);
    const network = BigInt(plain.fees.networkLamports);
    expect(network).toBeGreaterThan(0n);
    const withFee = 10_000_000_000n - BigInt(plain.solRequiredLamports);
    const {reader} = editedReader(o => withSenderLamports(o, withFee), {getTokenAccountsByOwner: nocHoldings});
    const view = await prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, NOC_INTENT);
    expect(view.simulation.sol).toEqual({before: '10000000000', after: withFee.toString()});
    expect(BigInt(plain.simulation.sol.after) - BigInt(view.simulation.sol.after)).toBe(network);
    expect(view.simulation.token).toEqual({symbol: 'NOC', before: '13399619', after: '12399619'});
  });

  it('the recipient kind: a missing account is "new"; a program or another owner is shown, never refused', async () => {
    const ext = await setup();
    for (const [kind, shown] of [['missing', 'new'], ['program', 'program'], ['other', 'other'], ['wallet', 'wallet']] as const) {
      const {reader} = editedReader(o => o, {getAccountKind: async () => kind});
      expect((await prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, SOL_INTENT)).simulation.recipient).toBe(shown);
    }
  });

  it('a SOL send reads the recipient once (getAccountKind answers rent and kind; review L4)', async () => {
    const ext = await setup();
    let kindReads = 0;
    const {reader} = editedReader(o => o, {
      getAccountKind: async () => (kindReads++, 'wallet'),
      getAccountExists: async () => {
        throw new Error('a SOL send must not read the recipient twice');
      },
    });
    await prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, SOL_INTENT);
    expect(kindReads).toBe(1);
  });

  it('wallet.preparedFor returns the same simulation', async () => {
    const ext = await setup();
    const deps = fakeDeps({reader: sendReader()});
    const view = await prepareSend(ext, deps, ACCOUNT.publicKey, SOL_INTENT);
    expect(view.simulation).toEqual(expect.objectContaining({slot: SIMULATED_SLOT, sol: {before: '10000000000', after: '9999000000'}}));
    expect((await preparedFor(ext, deps, ACCOUNT.publicKey))?.simulation).toEqual(view.simulation);
  });

  it('a malformed simulation reply is failed; a failed simulation (err, accounts: null) is simulation-failed — through the real reader', async () => {
    const ext = await setup();
    const realSimulate = (value: unknown) => {
      const rpc = createRpc({fetch: async () => ({status: 200, json: async () => ({jsonrpc: '2.0', id: 1, result: {context: {slot: 9}, value}})}), latch: createForbiddenLatch()});
      return solanaReader(rpc).simulateTransaction;
    };
    const failing = {...sendReader(), simulateTransaction: realSimulate({err: 'AccountNotFound', logs: [], accounts: null})};
    expect(await handleWallet(ext, fakeDeps({reader: failing}), 'wallet.prepareSend', {account: ACCOUNT.publicKey, intent: SOL_INTENT})).toEqual({
      ok: false,
      error: 'simulation-failed',
      data: {detail: '"AccountNotFound"'},
    });
    const malformed = {...sendReader(), simulateTransaction: realSimulate({err: null, logs: [], accounts: null})};
    expect(await handleWallet(ext, fakeDeps({reader: malformed}), 'wallet.prepareSend', {account: ACCOUNT.publicKey, intent: SOL_INTENT})).toEqual({ok: false, error: 'failed'});
    const thrown = {
      ...sendReader(),
      simulateTransaction: async () => {
        throw new RpcMalformed('simulateTransaction.context.slot');
      },
    };
    expect(await handleWallet(ext, fakeDeps({reader: thrown}), 'wallet.prepareSend', {account: ACCOUNT.publicKey, intent: SOL_INTENT})).toEqual({ok: false, error: 'failed'});
  });

  it('refuses simulation-mismatch through the message layer with the detail', async () => {
    const ext = await setup();
    const {reader} = editedReader(o => withSenderLamports(o, 1n));
    const r = await handleWallet(ext, fakeDeps({reader}), 'wallet.prepareSend', {account: ACCOUNT.publicKey, intent: SOL_INTENT});
    expect(r).toMatchObject({ok: false, error: 'simulation-mismatch'});
    expect((r as {data: {detail: string}}).data.detail).toContain('1005050');
  });
});

// Spec §11.5 (the coordinator's measured full-drain facts, plan 3 carry 2): a payer left with 1 … 890 879
// lamports gets err {InsufficientFundsForRent: {account_index: 0}}, every accounts entry null, and logs that
// read "success". The engine decides on err alone and gives it the rent refusal's own code (and so #19's own
// copy); an index that is neither the sender nor the recipient, or any other shape, stays simulation-failed.
describe('prepareSend: a simulation refused for rent (§11.5)', () => {
  /** A reader whose simulation answers `err(keys)` — keys are the transaction's own account keys — with accounts: null. */
  function refusing(err: (keys: string[]) => unknown, overrides: Partial<SolanaReader> = {}) {
    const base = sendReader(overrides);
    const reader: SolanaReader = {
      ...base,
      simulateTransaction: async tx => {
        const keys = VersionedTransaction.deserialize(base64.decode(tx)).message.staticAccountKeys.map(k => k.toBase58());
        return {err: err(keys), logs: ['Program 11111111111111111111111111111111 success'], unitsConsumed: 150, slot: SIMULATED_SLOT, accounts: null};
      },
    };
    return reader;
  }

  it('the sender’s index is sender-below-rent, whatever the logs say; the detail names the simulation', async () => {
    const ext = await setup();
    const reader = refusing(() => ({InsufficientFundsForRent: {account_index: 0}}));
    const r = await handleWallet(ext, fakeDeps({reader}), 'wallet.prepareSend', {account: ACCOUNT.publicKey, intent: SOL_INTENT});
    expect(r).toEqual({ok: false, error: 'sender-below-rent', data: {detail: 'the simulation refused it for rent: {"InsufficientFundsForRent":{"account_index":0}}'}});
  });

  it('the recipient’s index is recipient-below-rent when the recipient did not exist before the send', async () => {
    const ext = await setup();
    const reader = refusing(keys => ({InsufficientFundsForRent: {account_index: keys.indexOf(RECIPIENT)}}), {getAccountKind: async () => 'missing'});
    await expect(prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, SOL_INTENT)).rejects.toMatchObject({code: 'recipient-below-rent'});
  });

  // Review follow-up: an account that already existed before the send is never the "new account" case —
  // receiving funds does not create it, so the #19 "a new account needs at least…" copy would be false.
  // Such a refusal still happened (the node did refuse it, for some other reason this simulation cannot
  // name), so it falls through to the generic simulation-failed answer rather than a wrong rent copy.
  it('the recipient’s index, when the recipient already existed, falls through to simulation-failed', async () => {
    const ext = await setup();
    // sendReader's own default: getAccountKind resolves 'wallet' — the recipient already exists.
    const reader = refusing(keys => ({InsufficientFundsForRent: {account_index: keys.indexOf(RECIPIENT)}}));
    await expect(prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, SOL_INTENT)).rejects.toMatchObject({code: 'simulation-failed'});
  });

  // Review follow-up: the SPL path's fee payer is the sender too, at account index 0 (same as the SOL
  // path) — a rent refusal there must map the same way, regardless of which instructions the message holds.
  it('an SPL send: the sender is still the payer at index 0, so a rent refusal there is sender-below-rent', async () => {
    const ext = await setup();
    const reader = refusing(() => ({InsufficientFundsForRent: {account_index: 0}}), {getTokenAccountsByOwner: nocHoldings});
    await expect(prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, NOC_INTENT)).rejects.toMatchObject({code: 'sender-below-rent'});
  });

  it('any other index, an index past the keys, or another shape stays simulation-failed (negative controls)', async () => {
    const ext = await setup();
    for (const err of [
      (keys: string[]) => ({InsufficientFundsForRent: {account_index: keys.indexOf('11111111111111111111111111111111')}}),
      (keys: string[]) => ({InsufficientFundsForRent: {account_index: keys.length}}),
      () => ({InsufficientFundsForRent: {account_index: '0'}}),
      () => ({InsufficientFundsForRent: {account_index: -1}}),
      () => ({InsufficientFundsForRent: {account_index: 0}, InstructionError: [2, {Custom: 1}]}),
      () => 'InsufficientFundsForRent',
      () => ({InstructionError: [2, {Custom: 1}]}),
    ]) {
      await expect(prepareSend(ext, fakeDeps({reader: refusing(err)}), ACCOUNT.publicKey, SOL_INTENT)).rejects.toMatchObject({code: 'simulation-failed'});
    }
  });

  it('rentRefusal decides on err, the keys, and whether the recipient was new, only', () => {
    const keys = [ACCOUNT.publicKey, RECIPIENT, '11111111111111111111111111111111'];
    expect(rentRefusal({InsufficientFundsForRent: {account_index: 0}}, keys, ACCOUNT.publicKey, RECIPIENT, true)).toBe('sender-below-rent');
    // The sender's index is sender-below-rent whether or not the recipient was new — recipientMissing
    // only gates the recipient's own branch.
    expect(rentRefusal({InsufficientFundsForRent: {account_index: 0}}, keys, ACCOUNT.publicKey, RECIPIENT, false)).toBe('sender-below-rent');
    expect(rentRefusal({InsufficientFundsForRent: {account_index: 1}}, keys, ACCOUNT.publicKey, RECIPIENT, true)).toBe('recipient-below-rent');
    // Review follow-up: an existing recipient is not the "new account" case — null (simulation-failed).
    expect(rentRefusal({InsufficientFundsForRent: {account_index: 1}}, keys, ACCOUNT.publicKey, RECIPIENT, false)).toBeNull();
    expect(rentRefusal({InsufficientFundsForRent: {account_index: 2}}, keys, ACCOUNT.publicKey, RECIPIENT, true)).toBeNull();
    for (const err of [null, undefined, 7, [], {InsufficientFundsForRent: null}, {InsufficientFundsForRent: []}, {InsufficientFundsForRent: {account_index: 0.5}}]) {
      expect(rentRefusal(err, keys, ACCOUNT.publicKey, RECIPIENT, true)).toBeNull();
    }
  });

  it('a new recipient below 890 880 lamports is refused before anything is simulated', async () => {
    const ext = await setup();
    const reader = sendReader({
      getAccountKind: async () => 'missing',
      simulateTransaction: async () => {
        throw new Error('must not simulate');
      },
    });
    await expect(prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, {...SOL_INTENT, amount: '890879'})).rejects.toMatchObject({code: 'recipient-below-rent'});
  });
});
