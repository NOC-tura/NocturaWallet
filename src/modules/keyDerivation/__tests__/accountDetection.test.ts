import {detectFundedAccounts} from '../accountDetection';
import {mnemonicToSeed} from '../mnemonicUtils';
import * as queries from '../../solana/queries';

jest.mock('../../solana/connection', () => ({getConnection: () => ({}) as never}));

const ABANDON =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

// @solana/web3.js is mocked: new PublicKey(bytes).toBase58() === 'mock-pubkey-<first4bytesHex>'.
// Derivation itself is NOT mocked, so each scheme maps to a deterministic mock address.
// The cli pubkey for the ABANDON seed is hex c5785e18… → 'mock-pubkey-c5785e18'.
const CLI_MOCK_ADDR = 'mock-pubkey-c5785e18';

describe('detectFundedAccounts', () => {
  it('flags the cli account as funded and returns all candidates', async () => {
    const seed = await mnemonicToSeed(ABANDON);
    jest
      .spyOn(queries, 'getBalance')
      .mockImplementation(async (_c, pk) =>
        pk.toBase58() === CLI_MOCK_ADDR ? 17_000_000_000n : 0n,
      );
    jest.spyOn(queries, 'getTokenAccounts').mockResolvedValue([]);

    const result = await detectFundedAccounts(seed);

    const cli = result.find(c => c.scheme.kind === 'cli');
    expect(cli?.address).toBe(CLI_MOCK_ADDR);
    expect(cli?.lamports).toBe(17_000_000_000n);
    expect(cli?.funded).toBe(true);
    // funded candidate sorts first
    expect(result[0].scheme.kind).toBe('cli');
    // all 6 candidates returned (slip10 0..4 + cli)
    expect(result).toHaveLength(6);
    expect(
      result.some(c => c.scheme.kind === 'slip10' && c.scheme.account === 0),
    ).toBe(true);
  });
});
