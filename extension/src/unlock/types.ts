import type {EnvelopeV1} from '../vault/envelope';

/** runtime.sendMessage to the background, typed as src/ui/send.ts returns it. */
export type Send = (m: unknown) => Promise<{ok: boolean; error?: string; data?: unknown}>;

/**
 * The background's answer to vault.storeEnvelope (src/background/accountsStore.ts), plus 'failed'
 * for anything else: an error it does not name, or a message that never came back.
 */
export type StoreOutcome = 'stored' | 'busy' | 'wallet-exists' | 'stored-invalid' | 'malformed' | 'no-wallet' | 'send-open' | 'failed';

/**
 * The envelope in storage.local. The vault page reads it (shared/readLocal) and never writes it: the
 * background is v1_vault's one writer, and storeEnvelope asks it to compare-and-set.
 * `expectedRevision` is envelopeRevision(the envelope the flow OPENED) — never of what it
 * re-encrypted — or null for onboarding's first write, accepted only while no wallet is stored.
 */
export interface VaultStore {
  readEnvelope(): Promise<unknown>;
  storeEnvelope(expectedRevision: string | null, env: EnvelopeV1): Promise<StoreOutcome>;
}
