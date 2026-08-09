import {checkInstructions, KNOWN_PROGRAM_IDS} from '../instructionChecks';

const SYSTEM = '11111111111111111111111111111111';
const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const COMPUTE_BUDGET = 'ComputeBudget111111111111111111111111111111';
const UNKNOWN = 'EViL1111111111111111111111111111111111111111';

const ix = (programId: string, data: number[] = []) => ({
  programId,
  data: Uint8Array.from(data),
});

describe('checkInstructions — the rows that used to be hardcoded PASS', () => {
  it('passes a plain SOL transfer', () => {
    const rows = checkInstructions([ix(COMPUTE_BUDGET, [2]), ix(SYSTEM, [2])]);
    expect(rows.every(r => r.status === 'ok')).toBe(true);
  });

  it('FLAGS an instruction from a program outside the known set', () => {
    // "No interactions with unknown contracts" was a static `ok` row that never
    // saw the transaction, so it read PASS for any instruction list at all.
    const rows = checkInstructions([ix(SYSTEM, [2]), ix(UNKNOWN, [0])]);
    const unknown = rows.find(r => /unknown/i.test(r.title));
    expect(unknown?.status).toBe('danger');
    expect(unknown?.meta).toContain(UNKNOWN);
  });

  it('FLAGS an SPL Token Approve (delegation)', () => {
    // "No token approvals granted" was also static. SPL Token Approve is
    // instruction 4 and hands a delegate authority over the account.
    const rows = checkInstructions([ix(TOKEN, [4, 0, 0, 0])]);
    const approvals = rows.find(r => /approval|authority/i.test(r.title));
    expect(approvals?.status).toBe('danger');
  });

  it('FLAGS ApproveChecked, SetAuthority and CloseAccount too', () => {
    for (const opcode of [13, 6, 9]) {
      const rows = checkInstructions([ix(TOKEN, [opcode])]);
      expect(rows.find(r => /approval|authority/i.test(r.title))?.status).toBe('danger');
    }
  });

  it('does not flag TransferChecked, which is what a send actually does', () => {
    const rows = checkInstructions([ix(TOKEN, [12, 0, 0, 0, 0, 0, 0, 0, 0, 9])]);
    expect(rows.every(r => r.status === 'ok')).toBe(true);
  });

  it('treats an empty instruction list as inconclusive rather than passing', () => {
    // A build failure must not render as a green risk panel.
    const rows = checkInstructions([]);
    expect(rows.some(r => r.status !== 'ok')).toBe(true);
  });

  it('exposes the allowlist so the send path and the checks cannot drift', () => {
    expect(KNOWN_PROGRAM_IDS).toContain(SYSTEM);
    expect(KNOWN_PROGRAM_IDS).toContain(TOKEN);
    expect(KNOWN_PROGRAM_IDS).toContain(COMPUTE_BUDGET);
    expect(KNOWN_PROGRAM_IDS).not.toContain(UNKNOWN);
  });
});
