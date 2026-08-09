import {deriveTransferChecks} from '../simulationChecks';
import * as queries from '../queries';
import {PublicKey} from '@solana/web3.js';

jest.mock('../connection', () => ({getConnection: () => ({}) as never}));

const RECIPIENT = new PublicKey('HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk');
/** findProgramAddressSync([b'noctura-test'], SystemProgram) — a genuine PDA. */
const OFF_CURVE = new PublicKey('E4E6ZBCXe3s5tBjEwTfXm2NthmxLQBZiPyTVoc2E8HNw');

/** A plain SOL transfer: compute-budget + SystemProgram.transfer. */
const SOL_TRANSFER_IX = [
  {programId: 'ComputeBudget111111111111111111111111111111', data: Uint8Array.from([2])},
  {programId: '11111111111111111111111111111111', data: Uint8Array.from([2])},
];

describe('deriveTransferChecks', () => {
  afterEach(() => jest.restoreAllMocks());

  it('all PASS for a regular-wallet recipient', async () => {
    jest.spyOn(queries, 'getAccountInfo').mockResolvedValue({exists: true, executable: false});
    const rows = await deriveTransferChecks(RECIPIENT, SOL_TRANSFER_IX);
    expect(rows.map(r => r.status)).toEqual(['ok', 'ok', 'ok']);
    expect(rows[2].title).toContain('regular wallet');
  });

  it('WARNs when the recipient is an executable (program) account', async () => {
    jest.spyOn(queries, 'getAccountInfo').mockResolvedValue({exists: true, executable: true});
    const rows = await deriveTransferChecks(RECIPIENT, SOL_TRANSFER_IX);
    expect(rows[2].status).toBe('warn');
  });

  it("WARNs \"couldn't verify\" when the lookup fails", async () => {
    jest.spyOn(queries, 'getAccountInfo').mockRejectedValue(new Error('rpc down'));
    const rows = await deriveTransferChecks(RECIPIENT, SOL_TRANSFER_IX);
    expect(rows[2].status).toBe('warn');
    expect(rows[2].title).toMatch(/couldn.t verify/i);
  });

  it('does NOT pass when the caller supplies no instructions', async () => {
    // The two contract/approval rows used to be static `ok`, so a caller that
    // never showed the transaction still got a green panel. Absence of evidence
    // must not render as evidence of absence.
    jest.spyOn(queries, 'getAccountInfo').mockResolvedValue({exists: true, executable: false});
    const rows = await deriveTransferChecks(RECIPIENT);
    expect(rows.some(r => r.status !== 'ok')).toBe(true);
    expect(rows[0].title).toMatch(/couldn.t inspect/i);
  });

  it('DANGERs an off-curve recipient without needing an RPC call', async () => {
    const spy = jest
      .spyOn(queries, 'getAccountInfo')
      .mockResolvedValue({exists: false, executable: false});
    const rows = await deriveTransferChecks(OFF_CURVE, SOL_TRANSFER_IX);
    const recipientRow = rows[rows.length - 1]!;
    expect(recipientRow.status).toBe('danger');
    expect(recipientRow.title).toMatch(/cannot receive/i);
    expect(spy).not.toHaveBeenCalled();
  });

  it('DANGERs a transaction that grants a delegate authority', async () => {
    jest.spyOn(queries, 'getAccountInfo').mockResolvedValue({exists: true, executable: false});
    const rows = await deriveTransferChecks(RECIPIENT, [
      ...SOL_TRANSFER_IX,
      {programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', data: Uint8Array.from([4])},
    ]);
    expect(rows.some(r => r.status === 'danger')).toBe(true);
  });
});
