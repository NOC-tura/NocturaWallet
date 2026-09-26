/**
 * Moved to `core/solana/priorityFee.ts` so the web app inherits the same clamp. The
 * ceiling is the point: the price comes straight from the RPC, and an unbounded value
 * lets a malicious or compromised RPC drain the balance through fees without ever
 * needing the signing key. A copy with the clamp dropped would be a copy without the
 * control.
 */
import type {Connection} from '@solana/web3.js';
import {estimatePriorityFee as coreEstimatePriorityFee, type PriorityLevel} from '../../../core/solana/priorityFee';

export {
  MAX_COMPUTE_UNITS,
  MAX_PRIORITY_FEE_LAMPORTS,
  CEILING,
  type PriorityLevel,
} from '../../../core/solana/priorityFee';

export const estimatePriorityFee = (connection: Connection, level: PriorityLevel) =>
  coreEstimatePriorityFee(connection, level);
