/**
 * Every string the vault page sets at run time (spec B1b-2a §1.2 item 3). The only other text it ever
 * shows is the user's own words (#3, #4, #8) and, on #10, the challenge fields the background
 * describes — re-validated against a closed alphabet first (challenge.ts). Static copy lives in
 * unlock.html's markup. Stand-alone: this module may import nothing (scripts/check-vault-isolation.mjs
 * STANDALONE), so no UI code can reach the vault page through it. A function here only formats a
 * number the page computed itself.
 */

/** Shared lines (the B1b-1 vault words, kept). */
export const COMMON = {
  damaged: "This wallet's stored data is damaged.",
  /**
   * Controller addition — confirmed by the owner 2026-10-01 (plan 2, carry 3; its next step per the plan-2 review): what the
   * page says beside `damaged` where nothing can repair it yet (#37 is B1b-2b).
   */
  damagedHelp: 'Your funds stay on Solana; your recovery phrase still controls them. To use them here, remove Noctura from this browser, install it again and import the phrase.',
  noWallet: 'No wallet on this browser yet.',
  exists: 'A wallet already exists in this browser. Nothing was changed.',
  wrongConfirm: 'That did not confirm it.',
  waitConfirm: 'That did not confirm it. Wait a moment before trying again.',
  mismatchLocked: 'That did not match this wallet, so the wallet has been locked.',
  failedTryAgain: 'Something went wrong. Try again.',
  unreadable: "This wallet's stored data could not be read. Reload this page.",
  passkeyUnavailableConfirm: 'This device cannot confirm with a passkey; your password still works.',
} as const;

/** #5 create password (D7). */
export const PASSWORD = {
  longEnough: 'Long enough',
  lengthOf: (n: number): string => `${n} of 12 characters`,
} as const;

/** #9's cooldown card (and #10's, which reuses it): "0:12", and the design's helper line. */
export const clockText = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
export const cooldownLabel = (seconds: number): string => `Cooldown · ${Math.floor(seconds / 60)} minutes ${seconds % 60} seconds remaining`;

/** #10 unlock-send (re-authentication). */
export const REAUTH = {
  loading: 'Reading the details…',
  undescribable: 'The details of this action could not be shown.',
  notUnlocked: 'The wallet locked while you were confirming. Unlock it and start the send again.',
  expired: 'This confirmation has expired. Start the send again from the Noctura icon.',
  checking: 'Checking…',
  cancelled: 'Send cancelled. Nothing was sent.',
  settingsConfirmed: 'Confirmed. You can close this tab.',
  networkFee: 'Network fee',
  nocturaFee: 'Noctura fee',
  newTokenAccount: 'New token account',
  /** The carried rule: a zero Noctura fee always says why. */
  feeReason: {
    'pre-tge': 'No Noctura fee before TGE',
    'zero-fee-eligible': 'No Noctura fee (zero-fee eligible)',
    'status-unknown': 'No Noctura fee (status unknown)',
  },
  reason: {
    'over-5-percent': 'Re-auth required for transactions over 5 % of balance.',
    'first-send': 'Re-auth required for the first send to a new address.',
    'whole-balance-to-new': 'Re-auth required to send your whole balance to a new address.',
  },
  overUsd: (dollars: string): string => `Re-auth required for transactions over $${dollars}.`,
  autoLock: (minutes: number): string => `Auto-lock → ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`,
  threshold: (dollars: string): string => `Re-authentication threshold → $${dollars}`,
} as const;
