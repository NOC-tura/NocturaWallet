import {detectFundedAccounts} from '../accountDetection';
import {mnemonicToSeed} from '../mnemonicUtils';
import * as queries from '../../solana/queries';
import {NOC_MINT} from '../../../constants/programs';

jest.mock('../../solana/connection', () => ({getConnection: () => ({}) as never}));

const ABANDON =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

// @solana/web3.js is mocked: new PublicKey(bytes).toBase58() === 'mock-pubkey-<first4bytesHex>'.
// Derivation itself is NOT mocked, so each scheme maps to a deterministic mock address.
// The cli pubkey for the ABANDON seed is hex c5785e18… → 'mock-pubkey-c5785e18'.
const CLI_MOCK_ADDR = 'mock-pubkey-c5785e18';

// candidateSchemes order: slip10:0,1,2,3,4 then cli → cli is index 5.
const CLI_INDEX = 5;

describe('detectFundedAccounts', () => {
  it('flags the cli account as funded and returns all candidates', async () => {
    const seed = await mnemonicToSeed(ABANDON);
    jest
      .spyOn(queries, 'getMultipleBalances')
      .mockImplementation(async (_c, pks) =>
        pks.map((_pk, i) => (i === CLI_INDEX ? 17_000_000_000n : 0n)),
      );
    jest.spyOn(queries, 'getTokenAccounts').mockResolvedValue([]);

    const result = await detectFundedAccounts(seed);

    expect(result.balancesResolved).toBe(true);
    expect(result.nocResolved).toBe(true); // part B Task 7 fix round 1 (review I-2)
    expect(result.candidates).toHaveLength(6);

    const cli = result.candidates.find(c => c.scheme.kind === 'cli');
    expect(cli?.address).toBe(CLI_MOCK_ADDR);
    expect(cli?.lamports).toBe(17_000_000_000n);
    expect(cli?.funded).toBe(true);
    // funded candidate sorts first
    expect(result.candidates[0].scheme.kind).toBe('cli');
    expect(
      result.candidates.some(
        c => c.scheme.kind === 'slip10' && c.scheme.account === 0,
      ),
    ).toBe(true);
  });

  it('surfaces an RPC failure but still returns derived addresses', async () => {
    const seed = await mnemonicToSeed(ABANDON);
    jest
      .spyOn(queries, 'getMultipleBalances')
      .mockRejectedValue(new Error('HTTP 401'));
    jest.spyOn(queries, 'getTokenAccounts').mockResolvedValue([]);

    const result = await detectFundedAccounts(seed);

    expect(result.balancesResolved).toBe(false);
    expect(result.nocResolved).toBe(false); // no NOC lookup ran, so NOC is not known either
    expect(result.candidates).toHaveLength(6);
    expect(result.candidates.every(c => c.funded === false)).toBe(true);
    // addresses are still locally derived & valid for a manual pick
    expect(
      result.candidates.some(c => c.address === CLI_MOCK_ADDR),
    ).toBe(true);
  });

  it('part B Task 7 fix round 1 (review I-2): one failed NOC lookup → nocResolved false; SOL and the other NOC amounts are kept', async () => {
    const seed = await mnemonicToSeed(ABANDON);
    jest
      .spyOn(queries, 'getMultipleBalances')
      .mockImplementation(async (_c, pks) => pks.map(() => 0n));
    let call = 0;
    jest.spyOn(queries, 'getTokenAccounts').mockImplementation(async () => {
      call += 1;
      if (call === 2) throw new Error('HTTP 429');
      return [{mint: NOC_MINT, amount: '5'}] as never;
    });

    const result = await detectFundedAccounts(seed);

    expect(result.balancesResolved).toBe(true); // SOL is still the primary signal
    expect(result.nocResolved).toBe(false);
    expect(result.candidates.filter(c => c.nocAmount === 5n)).toHaveLength(5);
    expect(result.candidates.filter(c => c.funded)).toHaveLength(5);
  });

  it('part B Task 7 fix round 1: every NOC lookup succeeded → nocResolved true (negative control)', async () => {
    const seed = await mnemonicToSeed(ABANDON);
    jest
      .spyOn(queries, 'getMultipleBalances')
      .mockImplementation(async (_c, pks) => pks.map(() => 0n));
    jest.spyOn(queries, 'getTokenAccounts').mockResolvedValue([]);

    const result = await detectFundedAccounts(seed);

    expect(result.balancesResolved).toBe(true);
    expect(result.nocResolved).toBe(true);
  });
});
