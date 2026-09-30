import {preparedFor, prepareSend} from '../prepare';
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
    const tokenAt = (mint: string, owner: string, amount: bigint) => (o: SimulationOutcome): SimulationOutcome => ({
      ...o,
      accounts: [o.accounts?.[0] ?? null, {lamports: 2_039_280n, owner: TOKEN, data: tokenAccountData(mint, owner, amount)}],
    });
    const USDC = WALLET_TOKENS.USDC.mint as string;
    for (const edit of [tokenAt(USDC, ACCOUNT.publicKey, 12_399_619n), tokenAt(NOC, RECIPIENT, 12_399_619n), tokenAt(NOC, ACCOUNT.publicKey, 12_399_620n)]) {
      const {reader} = editedReader(edit, {getTokenAccountsByOwner: nocHoldings});
      await expect(prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, NOC_INTENT)).rejects.toMatchObject({code: 'simulation-mismatch'});
    }
    // Positive control: the right mint, owner and amount pass.
    const {reader} = editedReader(tokenAt(NOC, ACCOUNT.publicKey, 12_399_619n), {getTokenAccountsByOwner: nocHoldings});
    expect((await prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, NOC_INTENT)).simulation.token?.after).toBe('12399619');
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
