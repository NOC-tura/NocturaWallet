import {PublicKey} from '@solana/web3.js';
import {getConnection} from './connection';
import {getAccountInfo} from './queries';

export type CheckStatus = 'ok' | 'warn' | 'danger';

export interface TransferCheck {
  status: CheckStatus;
  title: string;
  meta: string;
}

/**
 * Risk rows for a self-built SOL/SPL transfer. The instruction set is known
 * (only SystemProgram / SPL-Token / ComputeBudget / ATA are ever built), so the
 * first two rows are static PASS. The third checks the recipient on-chain.
 */
export async function deriveTransferChecks(
  recipient: PublicKey,
): Promise<TransferCheck[]> {
  const rows: TransferCheck[] = [
    {
      status: 'ok',
      title: 'No interactions with unknown contracts',
      meta: 'SystemProgram / SPL-Token transfer only',
    },
    {
      status: 'ok',
      title: 'No token approvals granted',
      meta: 'Transfer only · zero allowances changed',
    },
  ];

  try {
    const info = await getAccountInfo(getConnection(), recipient);
    rows.push(
      info.executable
        ? {
            status: 'warn',
            title: 'Recipient is a program account',
            meta: `executable account at ${recipient.toBase58()}`,
          }
        : {
            status: 'ok',
            title: 'Recipient is a regular wallet',
            meta: `no executable account at ${recipient.toBase58()}`,
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
