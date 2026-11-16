import {explorerTxUrl, type Explorer} from '../constants/chain';

/** A transaction's explorer link on this build's chain (`?cluster=devnet` on devnet — S13). */
export function getExplorerUrl(signature: string, explorer: Explorer = 'solscan'): string {
  return explorerTxUrl(signature, explorer);
}
