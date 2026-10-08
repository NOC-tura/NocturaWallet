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
  /** #3's lede; the count adapted to the phrase (B1b-2b §3.4: 12 or 24 — import accepts both). */
  lede: (n: number): string => `${n} words. Write them down on paper, in order. This is the only backup.`,
  /** The pre-reveal modal's body, the count adapted the same way. */
  gateBody: (n: number): string => `Move to a private place. Anyone who sees these ${n} words can spend everything in this wallet, forever.`,
  onboarding: 'Onboarding',
  step: '2 / 5',
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
  onboarding: 'Onboarding',
  step: '3 / 5',
  verifiedTitle: 'Phrase verified',
  verifiedBody: 'All three words matched. Now lock the wallet with a password.',
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
   * Controller addition — confirmed by the owner 2026-10-02 (Task 9 fix round 1, review item 5): what the screen-reader
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
  /**
   * Controller addition — confirmed by the owner 2026-10-01 (plan 2): steps 1 and 2, the cards' step copy adapted
   * from the design (spec §3.11 Differs). Step 3 is NOT: see its own note.
   */
  card2: {
    1: "You'll be taken to the import screen. Type or paste your words.",
    2: "You'll be taken to the import screen. Type or paste your words.",
    /**
     * Owner decision 2026-10-02 (spec §3.11 Differs): the design's "Done — seed verified…" read as false at step 3 —
     * nothing is verified until #8 runs the seed proof — so the line says what happens next.
     */
    3: 'Next — your seed is checked against your existing public key.',
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

/** The accounts mode (B1b-2b §3.6; the B1b-1 words kept). */
export const ACCOUNTS = {
  adding: 'Adding an account…',
  removing: 'Removing the account…',
  /** O33. */
  addTitle: 'Add an account',
  /** O38: N is the envelope index + 1 (index=0 → "Remove Account 1?", review L2). */
  removeTitle: (n: number): string => `Remove Account ${n}?`,
  /** 2a's buttons. */
  add: 'Add an account',
  remove: 'Remove the account',
  outcome: {
    done: 'Done. The accounts are updated.',
    'done-locked': 'The accounts were changed, and the wallet has been locked. Unlock it to use them.',
    'done-not-locked': 'The accounts were changed, but the wallet could not be locked. Lock it now from the Noctura menu.',
    wrong: 'That did not confirm it.',
    'mismatch-locked': 'That did not match this wallet, so the wallet has been locked.',
    damaged: "This wallet's stored data is damaged.",
    'not-unlocked': 'The wallet is locked. Unlock it first, then try again.',
    'no-wallet': 'No wallet on this browser yet.',
    'cli-single': 'A Solana CLI wallet has exactly one account.',
    'last-account': 'The last account cannot be removed.',
    'no-such-account': 'There is no account with that number.',
    'too-many-accounts': 'This wallet already has the most accounts it can hold.',
    /** O37 (B1b-2b E13). */
    'bad-index': 'That is not an account number.',
    /** O36 (B1b-2b E13). */
    'index-taken': 'That account is already in this wallet.',
    /** B1b-2b C5: RESTORE `sendOpen` (2a) → adapted, "wallet" → "account" (§3.6). */
    'send-open': 'A transaction from this account is still pending. Wait until it confirms or expires — about two minutes — then try again.',
    failed: 'Something went wrong.',
  },
} as const;

/** The reveal and verify modes (B1b-2b §3.4, §3.5, D14, D15, D23, C9). */
export const PHRASE = {
  /** 2a's top bar, now the #3/#4 eyebrow in place of "Onboarding · 2 / 5" (→ adapted). */
  eyebrow: 'Recovery phrase',
  /** O27. */
  revealTitle: 'Show your recovery phrase',
  /** O28. */
  revealLede: 'Enter your password first. Nothing is shown until you press and hold.',
  /** O30. */
  verifyTitle: 'Verify your recovery phrase',
  /** O31. */
  verifyLede: 'Enter your password, then pick three words from your written copy.',
  /** O29: the pre-reveal modal's Cancel when the browser keeps the tab open. */
  nothingShown: 'Nothing is shown. You can close this tab.',
  /** → adapted (ix:5162 "Phrase verified"; the approved design's wording). */
  verifiedTitle: 'Recovery phrase verified',
  /** → adapted (ix:5163 without "Now lock the wallet with a PIN.") + O05. */
  verifiedBody: 'All three words matched. You can close this tab.',
  /** O32 (`success-not-recorded`). */
  notRecorded: 'All three words matched, but this could not be saved. Try again later.',
  /** 2a's button. */
  closeTab: 'Close this tab',
} as const;

/** The reveal proof's outcomes (the B1b-1 words, kept). */
export const REVEAL = {
  checking: 'Checking…',
  outcome: {
    'not-unlocked': 'The wallet is locked. Unlock it first, then try again.',
    'mismatch-locked': 'That did not match this wallet, so the wallet has been locked.',
    damaged: "This wallet's stored data is damaged.",
    'no-wallet': 'No wallet on this browser yet.',
    failed: 'Something went wrong. Try again.',
  },
} as const;

/** #6 biometric-setup → passkey (D9). */
export const PASSKEY = {
  adding: 'Waiting for your passkey…',
  added: 'Passkey added.',
  unsupported: 'This device cannot unlock the wallet with a passkey; your password still works.',
  failed: 'Something went wrong. Your password still works.',
} as const;

/**
 * #36 change-pin → change password (B1b-2b §3.1, D8, C20). Adapted from the design's PIN copy (2a-D7); O-numbers are
 * the owner-confirmed controller additions (spec §12).
 */
export const CHANGE = {
  stepOf: (n: 1 | 2 | 3): string => `Step ${n} of 3`,
  title: {1: 'Enter current password', 2: 'Choose a new password', 3: 'Confirm new password'},
  lede: {
    1: "Verify it's you before changing your password.",
    2: 'At least 12 characters. A few unrelated words work well.',
    3: 'Enter the same password again.',
  },
  /** O01. */
  continue: 'Continue',
  /** O03. */
  change: 'Change password',
  checking: 'Checking…',
  /** O02 (step-2 `same`). */
  same: 'That is your current password. Choose a new one.',
  /** 36d, adapted ("PINs don't match — try again"). */
  mismatch: "Passwords don't match — try again",
  /** 36e, adapted ("PIN updated"). */
  updated: 'Password updated.',
  /** O05. */
  closeTab: 'You can close this tab.',
  /** O06. */
  passkeyStillWorks: 'Your passkey still works.',
  /** O07. */
  failed: 'Something went wrong. Your password was not changed.',
  /** O10 (`dropped`: the page was left, or the 5-minute TTL ran out, C20). */
  dropped: 'Enter your current password again.',
} as const;

/** #37's proof in the vault tab (B1b-2b §3.2, E11, C17). */
export const DELETE = {
  /** O13. */
  deleting: 'Deleting…',
  /** O14 (`changed`, C17): the wallet under the tab is not the one it showed — nothing proven, nothing sent. */
  changed: 'The wallet in this browser changed. Check the address and try again.',
  /** O15 (after `send-open`: E5 locked the wallet). */
  lockedNothingDeleted: 'The wallet has been locked. Nothing was deleted.',
  /** O16. */
  failed: 'Something went wrong. Nothing was deleted.',
} as const;

/** #6 "manage" in the vault tab: add, replace, remove (B1b-2b §3.3, E12, D12, D13, C3, C4). */
export const MANAGE = {
  addTitle: 'Unlock Noctura with a passkey',
  addLede: 'Adds convenience. Your password always works too — keep it safe.',
  /** O17. */
  replaceTitle: 'Replace your passkey',
  /** O18. */
  replaceLede: 'The new passkey replaces the one this wallet uses now. The old one stays in your passkey manager until you delete it there.',
  /** O20. */
  removeTitle: 'Remove your passkey',
  /** O21. */
  removeLede: 'Confirm with your password or with the passkey itself. Your password keeps working.',
  add: 'Add a passkey',
  /** D13. */
  replace: 'Replace passkey',
  /** D13. */
  remove: 'Remove passkey',
  /** O19. */
  replaced: 'Passkey replaced.',
  /** O22. */
  removing: 'Removing the passkey…',
  /** O23. */
  removed: 'Passkey removed.',
  /** O24. */
  removedHelp: 'It is still saved in your passkey manager (Google, Apple or your password manager). Delete it there if you no longer need it.',
  /** O25. */
  noPasskey: 'This wallet has no passkey. Nothing was changed.',
  /** O26. */
  failed: 'Something went wrong. Nothing was changed.',
  /** O05. */
  closeTab: 'You can close this tab.',
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
/** One piece of the helper line: fixed words, or an integer the view sets in a `.noc-numeral` span. */
export type CooldownPart = string | number;
/**
 * The helper line in order, its fixed words around its integers (view/cooldown.ts builds it from these):
 * "Cooldown · 12 seconds remaining", "Cooldown · 1 minute 5 seconds remaining". **Controller adjustment
 * (Task 18 ruling):** the design's template ("2 minutes 45 seconds") is pluralised — "1 minute", "1 second" —
 * a zero-minute part is left out, and so is a zero-second part after a minute ("1 minute remaining").
 */
export const cooldownParts = (seconds: number): CooldownPart[] => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const out: CooldownPart[] = ['Cooldown · '];
  if (m > 0) out.push(m, m === 1 ? ' minute' : ' minutes');
  if (m === 0 || s > 0) out.push(...(m > 0 ? [' '] : []), s, s === 1 ? ' second' : ' seconds');
  out.push(' remaining');
  return out;
};
export const cooldownLabel = (seconds: number): string => cooldownParts(seconds).join('');

/** #10 unlock-send (re-authentication). */
export const REAUTH = {
  loading: 'Reading the details…',
  undescribable: 'The details of this action could not be shown.',
  notUnlocked: 'The wallet locked while you were confirming. Unlock it and start the send again.',
  expired: 'This confirmation has expired. Start the send again from the Noctura icon.',
  checking: 'Checking…',
  cancelled: 'Send cancelled. Nothing was sent.',
  /** O39 (B1b-2b E9, §3.7): the background applied the setting on this proof — replaces 2a's "Confirmed. You can close this tab." */
  settingsApplied: 'Confirmed. The change is saved — you can close this tab.',
  /** The approved design §3: a settings proof that outlived its challenge (§3.7 `settings-expired`). */
  settingsExpired: 'Took too long — try again',
  /** O40. */
  settingsExpiredHelp: 'Nothing was changed. Choose the setting again in Security center.',
  /** O41 (`settings-not-unlocked`). */
  settingsNotUnlocked: 'The wallet locked while you were confirming. Nothing was changed. Unlock it and choose the setting again.',
  /** O26 (`settings-failed`). */
  settingsFailed: 'Something went wrong. Nothing was changed.',
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
  /** Plan 3 (carry 1): the priority as its own row, as on #19 and #20 (spec §4.5's fee rows). */
  priority: 'Priority',
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
