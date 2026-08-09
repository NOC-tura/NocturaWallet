import type {CheckStatus, TransferCheck} from './simulationChecks';

/**
 * Programs a Noctura-built transfer is ever allowed to touch.
 *
 * Exported so the risk panel and the transaction builders cannot drift: if a
 * builder starts using a new program, the check goes red until this list is
 * updated deliberately.
 */
export const KNOWN_PROGRAM_IDS: readonly string[] = [
  '11111111111111111111111111111111', // System
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // SPL Token
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', // Associated Token Account
  'ComputeBudget111111111111111111111111111111', // ComputeBudget
];

/**
 * SPL Token instructions that hand authority to someone else. None of these
 * appear in a transfer; their presence means the transaction does more than it
 * claims. Opcodes per the SPL Token instruction enum.
 */
const AUTHORITY_GRANTING_OPCODES = new Map<number, string>([
  [4, 'Approve'],
  [6, 'SetAuthority'],
  [9, 'CloseAccount'],
  [13, 'ApproveChecked'],
]);

const SPL_TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

export interface InspectableInstruction {
  programId: string;
  data: Uint8Array;
}

/**
 * Risk rows derived from the instructions actually built.
 *
 * These two rows used to be hardcoded `ok` — `deriveTransferChecks(recipient)`
 * took only the recipient and never saw the transaction, so it rendered
 * "No interactions with unknown contracts / No token approvals granted · PASS"
 * for any instruction list whatsoever, including one that granted a delegate
 * authority over the user's token account. The UI badged that as verified.
 */
export function checkInstructions(instructions: InspectableInstruction[]): TransferCheck[] {
  if (instructions.length === 0) {
    return [
      {
        status: 'warn',
        title: "Couldn't inspect the transaction",
        meta: 'no instructions to check — do not read this as a pass',
      },
    ];
  }

  const unknown = instructions
    .map(i => i.programId)
    .filter(id => !KNOWN_PROGRAM_IDS.includes(id));

  const granting = instructions
    .filter(i => i.programId === SPL_TOKEN && i.data.length > 0)
    .map(i => AUTHORITY_GRANTING_OPCODES.get(i.data[0]!))
    .filter((name): name is string => name !== undefined);

  const contractsRow: TransferCheck =
    unknown.length === 0
      ? {
          status: 'ok',
          title: 'No interactions with unknown contracts',
          meta: `${instructions.length} instruction(s), all known programs`,
        }
      : {
          status: 'danger' as CheckStatus,
          title: 'Interacts with an unknown contract',
          meta: `unrecognised program: ${[...new Set(unknown)].join(', ')}`,
        };

  const approvalsRow: TransferCheck =
    granting.length === 0
      ? {
          status: 'ok',
          title: 'No token approvals granted',
          meta: 'no Approve / SetAuthority / CloseAccount instruction',
        }
      : {
          status: 'danger' as CheckStatus,
          title: 'Grants authority over your tokens',
          meta: `${[...new Set(granting)].join(', ')} — this is not part of a transfer`,
        };

  return [contractsRow, approvalsRow];
}
