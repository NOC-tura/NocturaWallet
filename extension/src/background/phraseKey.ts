/**
 * B1e §1.4: storage.local `v1_phishing_phrase` — the anti-phishing phrase, plain text, written only by the background
 * (phrase.ts; scripts/check-vault-isolation.mjs BACKGROUND_OWNED_KEYS). The key lives alone here because accountsStore's
 * WALLET_DATA_KEYS names it: a delete and a first write wipe it, a restore keeps it.
 */
export const PHRASE_KEY = 'v1_phishing_phrase';
