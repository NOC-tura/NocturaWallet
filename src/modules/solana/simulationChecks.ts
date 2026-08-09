import {PublicKey} from '@solana/web3.js';
import {getConnection} from './connection';
import {getAccountInfo} from './queries';
import {checkInstructions, type InspectableInstruction} from './instructionChecks';
import {isOnCurveAddress} from '../../utils/isOnCurveAddress';

export type CheckStatus = 'ok' | 'warn' | 'danger';

export interface TransferCheck {
  status: CheckStatus;
  title: string;
  meta: string;
}

/**
 * Risk rows for a self-built SOL/SPL transfer.
 *
 * The first two rows used to be static `ok` on the reasoning that "the
 * instruction set is known". That reasoning describes what the builders are
 * SUPPOSED to emit, not what this transaction contains — the function never
 * received the transaction at all, so it rendered PASS for any instruction
 * list, including one granting a delegate authority over the user's tokens.
 * They are now derived from the actual instructions; pass them in.
 *
 * Callers that genuinely cannot supply the instructions get an inconclusive
 * row rather than a green one.
 */
export async function deriveTransferChecks(
  recipient: PublicKey,
  instructions: InspectableInstruction[] = [],
): Promise<TransferCheck[]> {
  const rows: TransferCheck[] = [...checkInstructions(instructions)];

  // Off-curve first: it needs no RPC and it is the case that loses funds
  // outright. `executable` alone never caught a PDA, and a PDA cannot sign, so
  // SOL sent there is unrecoverable unless the owning program can withdraw it.
  const address = recipient.toBase58();
  if (!isOnCurveAddress(address)) {
    rows.push({
      status: 'danger',
      title: 'Recipient cannot receive funds',
      meta: `${address} is not a wallet address (off-curve or wrong length)`,
    });
    return rows;
  }

  try {
    const info = await getAccountInfo(getConnection(), recipient);
    rows.push(
      info.executable
        ? {
            status: 'warn',
            title: 'Recipient is a program account',
            meta: `executable account at ${address}`,
          }
        : {
            status: 'ok',
            title: 'Recipient is a regular wallet',
            meta: `no executable account at ${address}`,
          },
    );
  } catch {
    rows.push({
      status: 'warn',
      title: "Couldn't verify the recipient",
      meta: 'account lookup failed — proceed with care',
    });
  }

  return rows;
}
