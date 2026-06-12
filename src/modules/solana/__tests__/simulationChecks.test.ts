import {deriveTransferChecks} from '../simulationChecks';
import * as queries from '../queries';
import {PublicKey} from '@solana/web3.js';

jest.mock('../connection', () => ({getConnection: () => ({}) as never}));

const RECIPIENT = new PublicKey('HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk');

describe('deriveTransferChecks', () => {
  afterEach(() => jest.restoreAllMocks());

  it('all PASS for a regular-wallet recipient', async () => {
    jest.spyOn(queries, 'getAccountInfo').mockResolvedValue({exists: true, executable: false});
    const rows = await deriveTransferChecks(RECIPIENT);
    expect(rows.map(r => r.status)).toEqual(['ok', 'ok', 'ok']);
    expect(rows[2].title).toContain('regular wallet');
  });

  it('WARNs when the recipient is an executable (program) account', async () => {
    jest.spyOn(queries, 'getAccountInfo').mockResolvedValue({exists: true, executable: true});
    const rows = await deriveTransferChecks(RECIPIENT);
    expect(rows[2].status).toBe('warn');
  });

  it("WARNs \"couldn't verify\" when the lookup fails", async () => {
    jest.spyOn(queries, 'getAccountInfo').mockRejectedValue(new Error('rpc down'));
    const rows = await deriveTransferChecks(RECIPIENT);
    expect(rows[2].status).toBe('warn');
    expect(rows[2].title).toMatch(/couldn.t verify/i);
  });
});
