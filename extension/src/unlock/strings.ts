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

/** #1 welcome. */
export const WELCOME = {
  useIt: 'Open the Noctura icon to use it.',
} as const;

/** #3 seed-display. */
export const SEED = {
  lede: '24 words. Write them down on paper, in order. This is the only backup.',
  ledeConfirmed: 'Phrase locked in. Tap continue to verify a few words.',
  holdTitle: 'Press and hold to reveal',
  holdBody: 'Make sure no one is looking over your shoulder. Hold for 2 seconds. Auto re-blurs after 20 s for safety.',
  stillTitle: 'Still looking?',
  stillBody: 'Press and hold again to keep viewing. Releasing now is fine — your hand is remembering enough.',
  written: "I've written it down",
  continue: 'Continue',
  chip: (seconds: number): string => `${seconds} s`,
  chipTail: '· auto-blur',
  chipLate: '— still memorizing?',
  /**
   * What a blurred cell holds instead of its word (Task 4 carry: the blur is CSS only, so the words are in
   * the DOM only while revealed). Never read: the blur draws it as the design's blurred term, and the grid
   * is one role="button" whose children assistive technology does not read. One fixed length, so the DOM
   * says nothing about the words' lengths either.
   */
  blurredTerm: 'xxxxxx',
} as const;

/** #4 seed-confirm. */
export const CONFIRM = {
  lede: 'Tap the correct word for each position.',
  wrongLede: "That's not the right word — let's start over.",
  slot: (position: number): string => `Word #${position}`,
  select: '— select —',
  wrongHelper: (position: number): string => `Word #${position} was wrong. Slots will reset in a moment.`,
  confirm: 'Confirm',
  continue: 'Continue',
} as const;

/** #5 create password (D7). */
export const PASSWORD = {
  longEnough: 'Long enough',
  lengthOf: (n: number): string => `${n} of 12 characters`,
  onboarding: 'Onboarding',
  recovery: 'Recovery',
  stepCreate: '4 / 5',
  stepImport: 'Import · 2 / 2',
  stepRestore: 'Restore · 2 / 2',
  enterTitle: 'Create a password',
  enterLede: "At least 12 characters. You'll need it to unlock the wallet and to confirm risky sends.",
  enterHelper: 'Choose something long and memorable — a few unrelated words work well.',
  confirmTitle: 'Confirm your password',
  confirmLede: 'Enter the same password to verify.',
  mismatch: "Passwords don't match — try again.",
  show: 'Show password',
  hide: 'Hide password',
  /**
   * Controller addition — confirmed by the owner 2026-10-01 (plan Scope 19, review L5): a hidden tab drops what
   * #5 held (§3.5's memory rule), and #5 then says so.
   */
  newPasswordToRetry: 'Enter a new password to try again.',
  /** finishOnboarding's outcomes (the B1b-1 strings). */
  exists: 'A wallet already exists in this browser. Nothing was changed.',
  weak: 'The password must be at least 12 characters.',
  invalid: 'That is not a valid 12- or 24-word recovery phrase.',
  failed: 'Something went wrong. Nothing was saved.',
} as const;

/** #8 import. */
export const IMPORT = {
  idleTitle: (seconds: number): string => `Auto-clearing in ${seconds} s`,
  count: (n: number, of: number): string => `${n} of ${of} words entered.`,
  valid: (n: number): string => `Valid ${n}-word BIP-39 phrase · checksum OK`,
  checking: 'Checking which addresses hold funds…',
  bothFunded: 'Both address types on this phrase hold funds. Choose the one to use.',
  unresolved: 'Balances could not be checked. Choose the address type to use.',
  invalid: 'That is not a valid 12- or 24-word recovery phrase.',
  /**
   * Controller addition — NOT yet confirmed by the owner (Task 9 fix round 1, review item 5): what the screen-reader
   * live region says once when the idle timer wipes the field (the banner's per-second countdown is not announced).
   */
  wipedLive: 'The phrase was wiped from this field.',
} as const;

/** #6 biometric-setup → passkey (D9). */
export const PASSKEY = {
  adding: 'Waiting for your passkey…',
  added: 'Passkey added.',
  unsupported: 'This device cannot unlock the wallet with a passkey; your password still works.',
  failed: 'Something went wrong. Your password still works.',
} as const;

/** #9 unlock (D7, D11). */
export const UNLOCK = {
  unlocking: 'Unlocking…',
  wrong: 'That did not unlock the wallet.',
  failed: 'Unlock failed. Try again.',
  unlocked: 'Unlocked.',
  openIcon: 'Open the Noctura icon to continue.',
  unavailable: 'This device cannot unlock the wallet with a passkey; your password still works.',
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
