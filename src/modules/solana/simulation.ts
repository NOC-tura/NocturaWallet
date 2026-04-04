import {Connection, VersionedTransaction} from '@solana/web3.js';
import {ERROR_CODES} from '../../constants/errors';
import type {SimulationResult} from './types';

function mapSimulationError(err: unknown): SimulationResult['error'] {
  const errStr = typeof err === 'string' ? err : JSON.stringify(err);

  if (errStr.includes('InsufficientFundsForRent')) {
    return ERROR_CODES.INSUFFICIENT_RENT;
  }
  if (errStr.includes('InsufficientFunds')) {
    return ERROR_CODES.INSUFFICIENT_SOL;
  }
  if (errStr.includes('AccountNotFound')) {
    return ERROR_CODES.INVALID_ADDRESS;
  }
  if (errStr.includes('ProgramFailedToComplete')) {
    return ERROR_CODES.TX_SIMULATION_FAILED;
  }
  return ERROR_CODES.TX_SIMULATION_FAILED;
}

export async function simulateTransaction(
  connection: Connection,
  tx: VersionedTransaction,
): Promise<SimulationResult> {
  try {
    const response = await connection.simulateTransaction(tx);
    const {err, logs, unitsConsumed} = response.value;

    if (err === null) {
      const result: SimulationResult = {success: true};
      if (logs !== undefined) {
        result.logs = logs;
      }
      if (unitsConsumed !== undefined) {
        result.unitsConsumed = unitsConsumed;
      }
      return result;
    }

    return {
      success: false,
      error: mapSimulationError(err),
      logs: logs ?? [],
    };
  } catch {
    return {
      success: false,
      error: ERROR_CODES.TX_SIMULATION_FAILED,
    };
  }
}
