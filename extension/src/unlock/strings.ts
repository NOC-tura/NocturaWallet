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
  continue: 'Continue',
  tryAgain: 'Try again',
  /**
   * Controller addition — confirmed by the owner 2026-10-01 (plan Scope 19, review L5): a hidden tab drops what
   * #5 held (§3.5's memory rule) — the password a [Try again] was holding included (§3.5's rule wins over E5's
   * "kept while this page stays open") — and #5 then says so.
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

/** #39 forgot-pin → "Forgot password?" (each step's changing copy; the cards' titles are static). */
export const FORGOT = {
  step: (n: 1 | 2 | 3): string => `${n} / 3`,
  title: {1: 'Forgot your password?', 2: 'Enter your words', 3: 'Set a new password'},
  lede: {
    1: 'Your recovery phrase is the only way back. Three steps to restore.',
    /** Controller addition — confirmed by the owner 2026-10-01 (plan 2): the design's "Pick from the BIP-39 wordlist. Type the first 3 letters…" describes a picker #8 does not have. */
    2: 'Type or paste the 12 or 24 words, in order.',
    3: "Once your phrase is verified against this wallet, you'll choose a new password (at least 12 characters). The old password stops working.",
  },
  card1: {
    1: "You'll need the 12 or 24 words you wrote down during setup. Make sure you have them on paper or steel — not on this computer.",
    2: 'Done — you confirmed you have your words.',
    3: 'Done.',
  },
  /** Controller addition — confirmed by the owner 2026-10-01 (plan 2): the cards' step copy, adapted from the design (spec §3.11 Differs). */
  card2: {
    1: "You'll be taken to the import screen. Type or paste your words.",
    2: "You'll be taken to the import screen. Type or paste your words.",
    3: 'Done — seed verified against your existing public key.',
  },
  card3: {
    1: "Once your phrase is verified against this wallet, you'll choose a new password (at least 12 characters). The old password stops working.",
    2: 'After your phrase is verified.',
    3: "You'll choose a new password. The old password stops working. A passkey is not carried over; you can add one again later.",
  },
  next: {1: 'Restore from seed', 2: 'Continue', 3: 'Continue to import'},
} as const;

/** #8 on #39's restore path (E5 with `replacement`). */
export const RESTORE = {
  checking: 'Checking this phrase against the wallet in this browser…',
  notThisWallet: 'This phrase does not belong to the wallet in this browser. Nothing was changed.',
  notThisWalletHelp: 'To replace that wallet without its password, remove Noctura from this browser and install it again.',
  tryAnother: 'Try another phrase',
  sendOpen: 'A transaction from this wallet is still pending. Wait until it confirms or expires — about two minutes — then try again.',
  busy: 'The wallet changed while you were typing. Start again.',
  /** Controller addition — confirmed by the owner 2026-10-01 (plan 2, carry 4): E5's `unlocked` — an unlock landed mid-forget. The `busy` line would say the wallet is locked, which is false here. */
  unlocked: 'The wallet was unlocked while this was running, so nothing was deleted. Start again.',
  /** Controller addition — confirmed by the owner 2026-10-01 (plan 2): the button the two "Start again" lines offer — back to #39. */
  startAgain: 'Start again',
  setUp: 'Set up a wallet',
} as const;

/** #8 on #40's "Try a different seed" path (D41, E5 with the unfunded guard, C6). */
export const RETRY = {
  funded: 'This wallet now holds funds. Nothing was changed.',
  unreachable: 'Balances could not be checked, so nothing was changed. Try again later.',
  /** The D26 banner text (§7.2). */
  refused: 'The server is not answering for now — try again in 10 minutes.',
  storeFailed: 'The new wallet was not saved. Try again.',
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
/** The helper line's fixed words, around its two `.noc-numeral` integers (view/cooldown.ts builds it from these). */
export const COOLDOWN_LABEL = {head: 'Cooldown · ', minutes: ' minutes ', tail: ' seconds remaining'} as const;
export const cooldownLabel = (seconds: number): string => `${COOLDOWN_LABEL.head}${Math.floor(seconds / 60)}${COOLDOWN_LABEL.minutes}${seconds % 60}${COOLDOWN_LABEL.tail}`;

/** #10 unlock-send (re-authentication). */
export const REAUTH = {
  loading: 'Reading the details…',
  undescribable: 'The details of this action could not be shown.',
  notUnlocked: 'The wallet locked while you were confirming. Unlock it and start the send again.',
  expired: 'This confirmation has expired. Start the send again from the Noctura icon.',
  checking: 'Checking…',
  cancelled: 'Send cancelled. Nothing was sent.',
  settingsConfirmed: 'Confirmed. You can close this tab.',
  aboutSend: 'You are about to send',
  aboutChange: 'You are about to change',
  to: 'To',
  cancelSend: 'Cancel send',
  /** Controller addition — confirmed by the owner 2026-10-01 (plan review H1): #10 could not tell which send to drop. */
  close: 'Close',
  /** Controller addition — confirmed by the owner 2026-10-01 (plan review H1): no "cancelled" the page cannot vouch for. */
  nothingSent: 'Nothing was sent. Start the send again from the Noctura icon.',
  /** Controller addition — confirmed by the owner 2026-10-01 (plan 2): a settings confirmation (B1b-2b) is not a send. */
  cancel: 'Cancel',
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
