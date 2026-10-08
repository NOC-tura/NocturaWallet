import type {EnvelopeV1} from '../vault/envelope';
import type {Send, StoreOutcome, VaultStore} from './types';

const NAMED: readonly StoreOutcome[] = ['busy', 'wallet-exists', 'stored-invalid', 'malformed', 'no-wallet', 'send-open'];

/**
 * The vault page's VaultStore: reads with the reader it is given, stores by sending
 * vault.storeEnvelope to the background. The background's refusals pass through by name; anything
 * else (an error it does not name, a send that throws) is 'failed'.
 */
export function backgroundVaultStore(send: Send, read: () => Promise<unknown>): VaultStore {
  return {
    readEnvelope: read,
    storeEnvelope: async (expectedRevision: string | null, envelope: EnvelopeV1): Promise<StoreOutcome> => {
      try {
        const r = await send({type: 'vault.storeEnvelope', expectedRevision, envelope});
        if (r.ok) return 'stored';
        return NAMED.find(n => n === r.error) ?? 'failed';
      } catch {
        return 'failed';
      }
    },
  };
}
