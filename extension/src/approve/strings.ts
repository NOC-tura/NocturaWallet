/**
 * Every string the approval window shows (spec §3.1, §3.2, §4.3, §10): the design's own (index.html #46 ix:17442-17686,
 * #47 ix:17686-18261), as the spec quotes them, the owner-confirmed Q01–Q24 and the owner-delegated Q26 (rev 3.2).
 * Nothing else is shown.
 */
export const WINDOW_TEXT = {
  close: 'Close',
  reject: 'Reject',
  rejectAndReport: 'Reject and report',
  /** Q17. */
  blockSite: 'Block this site',
  /** Q12. */
  waiting: (n: number): string => (n === 1 ? '1 more request waiting' : `${n} more requests waiting`),
  /** Q24. */
  budgetNotice: 'Too many requests from sites in the last few minutes — some were declined without asking you.',
  badge: {verified: 'Verified', unknown: 'Unknown', lookalike: 'Lookalike'},
  /** The lookalike banner (§3.1): its head, rule a's line, rules b–e's line (Q05). */
  notThis: (domain: string): string => `This domain is not ${domain}`,
  idnLead: 'The "',
  idnIs: (script: string | null, codePoint: string): string => `" in this URL is ${script === null ? 'a non-Latin' : /^[AEIOU]/.test(script) ? `an ${script}` : `a ${script}`} letter (${codePoint}), not a Latin "`,
  idnNot: (latinCodePoint: string): string => `" (${latinCodePoint}). The Punycode form is `,
  looksLike: (domain: string): string => `It looks like ${domain} but is a different site.`,
  /** The design's 2-second confirm (#46 E, review M10.1). */
  confirmTitle: 'We strongly recommend rejecting. Continue?',
  cancel: 'Cancel',
  understand: 'I understand the risk',
  /** Q22, Q23: the locked window (D11) — no password field, no link into the vault page. */
  lockedTitle: 'Noctura is locked',
  lockedBody: "Click the Noctura icon in your browser's toolbar and unlock. This request will wait here.",
} as const;

export const CONNECT_TEXT = {
  overline: {verified: 'Connection request', unknown: 'Unknown origin', lookalike: 'Suspicious origin'},
  title: (name: string): string => `Connect to ${name}?`,
  titleUnknown: 'Connect to this app?',
  lede: 'Connecting lets the dApp see your public address. It does not move funds. Every transaction will still ask for your approval.',
  /** The lookalike state's short lede: the first sentence, as #46's lookalike state shortens its own. */
  ledeShort: 'Connecting lets the dApp see your public address.',
  ledeUnknown: "We don't recognize this domain. That doesn't always mean it's bad — but proceed with care.",
  ledeUnknownDone: ['Both gates cleared. Connect is enabled ', 'for this session only', ' — the persisted-scope path stays locked out for unknown domains.'],
  permsVerified: (name: string): string => `${name} will be able to`,
  permsUnknown: 'If you connect, the dApp can',
  seeAddress: 'See your public address',
  seeAddressSec: (short: string): string => `${short} — never your seed or private key`,
  seeAddressSecUnknown: (short: string): string => `${short} · cannot see your seed or private key`,
  signTx: 'Request transaction signatures',
  signTxSec: 'You will approve each transaction individually',
  signMsg: 'Request message signatures',
  signMsgSec: 'You will approve each signature individually',
  automatic: 'AUTOMATIC',
  withPrompt: 'WITH PROMPT',
  ack: "I've read these permissions",
  ackSec: 'Tap to acknowledge · gates the Connect button',
  ackSecUnknown: 'Tap to acknowledge · second gate for unknown domain',
  ackSecFinal: 'Final gate — tap to enable Connect',
  acked: 'Permissions acknowledged',
  ackedSec: 'Connect is now enabled',
  ackedSecUnknown: 'Connect is now enabled · session-only scope',
  notListed: "This domain isn't on the verified list",
  /** Q04. */
  domainAck: 'I understand this domain is not on the verified list',
  domainAcked: 'Acknowledged — new domain',
  /** Q18. */
  international: (host: string): string => `This address uses international characters: ${host}`,
  /** Q01. */
  account: 'Account',
  stay: 'Stay connected',
  recommended: 'Recommended for unknown',
  session: 'For this session only',
  /** Q02. */
  sessionSec: 'Disconnects when the wallet locks or the browser closes',
  /** Q19. */
  sessionSecUnknown: 'Connection ends when the wallet locks · safest option for unknown domains',
  persistent: 'Until I revoke',
  /** Q03. */
  persistentSec: 'Saved in Settings → Connected dApps · revoke any time',
  persistentSecUnknown: 'Discouraged for unknown domains — re-grant per session instead',
  gate: (done: number, of: number): string => `${done} of ${of} acknowledgments`,
  ready: 'Ready to connect',
  readySession: 'Ready to connect · for this session',
  connect: 'Connect',
  connectSession: 'Connect for this session',
  connecting: 'Connecting…',
  hint: 'Read the permissions above before connecting',
  hintUnknown: 'Acknowledge both gates to connect',
  /** Q06. */
  connectAnyway: 'Connect anyway (not recommended)',
  /** Q16. */
  cap: 'You have 200 connected apps. Revoke one in Settings first.',
} as const;

export const SIGN_TEXT = {
  overline: 'Signature request',
  overlineLookalike: 'Suspicious origin',
  overlineSigning: 'Signing',
  title: 'Sign this message?',
  lede: 'A signature proves you control this wallet. It does not move funds and does not broadcast a transaction.',
  ledeShort: 'A signature proves you control this wallet.',
  label: (chars: number): string => `Message · UTF-8 (${chars} chars)`,
  labelLookalike: 'Message preview',
  labelKeyword: 'Message · with structured-approval flag',
  disclaimer: (name: string): string => `This won't broadcast or move funds. ${name} will use the signature only to verify you own this wallet.`,
  alertHead: 'This message includes an authorization',
  alertLead: 'Detected keyword: ',
  alertTail: ". Even though signing won't broadcast, the dApp may use this signature off-chain to authorize a future action. Read the full message before signing.",
  /** Q20. */
  siwsMismatch: (domain: string, host: string): string => `This sign-in message names ${domain}, not this site (${host}).`,
  sign: 'Sign',
  signing: 'Signing…',
  signAnyway: 'Sign anyway (not recommended)',
  /** Q26 (rev 3.2): `request.sign === null` — the Reject-only exit says why. */
  cannotSign: 'This request can no longer be signed. Reject it and ask the site to try again.',
} as const;

/**
 * #48 dapp-tx-approval (index.html ix:18261-18705): the design's own strings as drawn, B1 §3's ("unknown program"),
 * B1b's (#19's "Couldn't simulate" and its server line, #20's address labels), Q21 and Q26 — and the controller's
 * lines the design does not draw, each flagged for the owner in the plan's Scope (R-numbers there).
 */
export const TX_TEXT = {
  overline: 'Approve transaction',
  overlineApproving: 'Approving',
  overlineLookalike: 'Suspicious origin',
  simulating: 'Simulating transaction…',
  /** #19's own server line (B1b-2a §4.4): what answers, as the design's meta names its RPC. */
  simulatingMeta: 'Noctura server · simulateTransaction',
  balanceWaiting: 'Balance changes (waiting…)',
  balancePost: 'Balance changes (post-simulation)',
  /**
   * Owner-delegated (controller, 2026-10-15; plan 2 review 1 L3): a simulation that moves nothing of this account's — it
   * points at the instructions, since an instruction that moves no balance (an authority change, an allowance) can still
   * matter; B1c-3 replaces the line on a screen with such an instruction.
   */
  noChanges: 'No SOL or token balance changes — review the instructions below.',
  /** Owner-delegated (controller, 2026-10-15; review 1 L7): who broadcasts — page.signTransaction / page.signAndSendTransaction. */
  sendsSite: 'The site sends this transaction itself after you approve.',
  sendsNoctura: 'Noctura sends this transaction as soon as you approve.',
  /** Owner-delegated (controller, 2026-10-15; review 1 L4): an approval refused `stale` — a refresh landed between the read and the click. */
  stale: 'The transaction changed while you were reviewing. Review it again before approving.',
  /**
   * Controller copy (final review I3, 2026-10-16; flagged to the owner): an approval refused `out-of-date` — the window
   * named the newest simulation, but it is 40 s old and its refresh has not landed (a slow proxy). Nothing changed, so
   * the `stale` line above would be untrue.
   */
  outOfDate: 'This simulation is out of date. Wait a moment for it to refresh.',
  instructions: 'Instructions',
  /** Fix round 1 (promoted minor 2): a v0 transaction whose lookup table is not yet resolved — instructions decode only once the first simulation answers. */
  instructionsPending: 'Instructions appear once the transaction is simulated.',
  program: (n: number): string => `Program ${n}`,
  /** B1 §3: "a program not in the decoded set → unknown program". */
  unknownProgram: 'unknown program',
  /** Controller (owner copy): an instruction of a decoded program whose tag the wallet does not know. */
  unknownInstruction: 'unknown instruction',
  /** Fix round 1, I3 (controller ruling, overrides plan R2's display): a known program's instruction the decoder names but
   * does not decode the fields of (mintTo, initializeMint, initializeNonceAccount, withdrawNonceAccount, Token-2022
   * extension instructions, recoverNested, …) must never look fully decoded. */
  notDecoded: 'Details not decoded — check them on the site before approving.',
  computeUnits: 'Compute units',
  networkFee: 'Network fee',
  mandatory: 'Simulation runs against the current slot before you see Approve. This is mandatory — no skip.',
  approve: 'Approve',
  approveSimulating: '· simulating',
  approving: 'Approving…',
  /** Controller (owner copy, as #46's and #47's): a lookalike origin's demoted path. */
  approveAnyway: 'Approve anyway (not recommended)',
  /** #19's (B1b): the simulation's own refusal, and a proxy that did not answer. */
  couldNot: "Couldn't simulate",
  unreachable: 'Could not reach the Noctura server.',
  /** Q21. */
  expired: 'This request has expired. Ask the site to try again.',
  originPill: (host: string): [string, string, string] => ['Request from ', host, ' · matches active session'],
  /** Controller (owner copy): a batch's section, B1 §3 "shown on one screen with each transaction's effects". */
  batchItem: (i: number, n: number): string => `Transaction ${i} of ${n}`,
  /** Controller (owner copy), D11: re-authentication is reached from the Noctura icon, never from this window. */
  reauthNeeded: "Approving asks you to confirm with your password (or passkey) — you'll start it from the Noctura icon.",
  reauthHead: "Confirm it's you",
  reauthWaiting: "Click the Noctura icon in your browser's toolbar and confirm with your password (or passkey). This request will wait here.",
  /** #20's labels (B1b; spec §3 "with a label where known"). */
  ownAccount: (name: string): string => `Your account: ${name}`,
} as const;

/**
 * B1c-3 (spec §3.3 rev 3.6 "The typed field", "Banners"; §10): #48's red flags — the design's own strings (state 2
 * "unlimited-spend · typed-confirm", ix:18325-18396), #37's helper, B1 §3's ("This transaction does not expire."),
 * screen.md §48's ("Unknown program"), Q32, Q34–Q39 and the controller's Q41–Q55 (each flagged to the owner in §10).
 */
export const FLAG_TEXT = {
  /** The design's eyebrow (ix:18335). */
  overlineUnlimited: 'Critical · Unlimited spend approval',
  /** Q35. */
  overlineBlocked: 'Critical · Blocked transaction',
  /** Q57 (O9): every block an F5 below u64::MAX — 99 % of the balance up to the whole of it. */
  overlineLarge: 'Critical · Large spend approval',
  /** The design's red CTA (ix:18390). */
  approveUnlimited: 'Approve unlimited',
  /** Q34. */
  approveBlocked: 'Approve anyway',
  /** The design's label (ix:18379): the word between, in a code span, in its true case. */
  typed: ['Type ', ' to enable Approve'],
  /** #37's helper (ix:~15000). */
  typedHelp: 'Case-sensitive · must match exactly.',
  /** F5 head: the design's (ix:18351); Q39's "token" when the wallet's table names no symbol. */
  unlimitedHead: (symbol: string | null): string => (symbol === null ? 'Unlimited token spend approval' : `Unlimited ${symbol} spend approval`),
  /** Q56 (O9): F5's head below u64::MAX ("unlimited" only for u64::MAX) — #10's row the same. */
  nearlyAllHead: (symbol: string | null): string => (symbol === null ? 'Spend approval for nearly all of this token' : `Spend approval for nearly all your ${symbol}`),
  /** The design's "all your USDC" (ix:18352); Q41: "all of this token" when the wallet's table names no symbol. */
  all: (symbol: string | null): string => (symbol === null ? 'all of this token' : `all your ${symbol}`),
  /** Q42, Q43 below u64::MAX (O5: 99 % of the balance or more): "all or nearly all". */
  nearlyAll: (symbol: string | null): string => (symbol === null ? 'all or nearly all of this token' : `all or nearly all your ${symbol}`),
  /** F5, a decoded approve of u64::MAX: the design's body (ix:18352), the code span the real instruction (Q41). */
  unlimitedMax: ['This transaction includes a ', ' instruction with ', 'amount = u64::MAX', ' (~18.4 quintillion units). Even verified dApps can be exploited; this lets the program move ', ', now and in the future, until you revoke.'],
  /** Q42: F5, a decoded approve below u64::MAX of 99 % or more of the account's balance (O5). */
  unlimitedWhole: ['This transaction includes a ', ' instruction for ', ", all or nearly all of this account's balance. Even verified dApps can be exploited; this lets the program move ", ' until you revoke.'],
  /** Q43: F5 seen only in the simulation's chain state (a program call, no instruction listed). */
  unlimitedChain: ['The simulation shows a program call — not an instruction listed here — that lets a delegate move ', ', now and in the future, until you revoke.', ' until you revoke.', ' Even verified dApps can be exploited.'],
  /** Q44: F6's head. */
  boundedHead: (symbol: string | null): string => (symbol === null ? 'Token spend approval' : `${symbol} spend approval`),
  /** Q45: F6's body. */
  bounded: (amount: string, symbol: string | null): string => `This lets a delegate move up to ${amount} ${symbol === null ? 'of this token' : `of your ${symbol}`} until you revoke.`,
  /** The design's meta (ix:18353) — every address whole, in groups (Q55). */
  meta: {delegate: 'delegate: ', token: ' · token: ', mint: 'mint ', scope: ' · scope: ', max: 'u64::MAX'},
  /** The design's synthesized balance row (ix:18361-18363); a bounded amount as spec §3.3 says. */
  delegated: (name: string): string => `${name} delegated`,
  unlimited: 'unlimited',
  allFuture: '≈ all current + future',
  /** Q37 (F3's #10 row, reused as the banner head) and Q46. */
  assignHead: 'Assign / Allocate on your wallet account',
  assign: "This changes your wallet account itself. Assigned to another program, it is that program's to control; given data, it can no longer pay fees or send SOL.",
  /** Q38 (F4's #10 row, reused as the banner head) and Q47. */
  authorityHead: 'SetAuthority on an account you own',
  authority: 'This gives an authority over an account you own to another address, or removes it. You cannot take it back yourself.',
  /** Q32: F10's head. */
  dependsOn: (step: number): string => `This step depends on step ${step} and could not be checked on its own.`,
  /** Q48: F10's body. */
  dependent: (step: number): string => `Its effects are unknown: it was simulated without the changes step ${step} makes, which it needs. Approving it may move any of your balances.`,
  /** Q49: F10's balance card. */
  balanceUnknown: 'Balance changes (unknown)',
  balanceUnknownLine: 'This step was not simulated on its own, so its effects are unknown.',
  /** screen.md §48 ("Unknown program") and Q50. */
  unknownHead: 'Unknown program',
  unknown: 'The wallet cannot decode what this program does — only the simulation shows its effects.',
  unknownNull: 'a program the transaction does not name in its own keys',
  /** Q51: F2. */
  nonTransferHead: 'Instructions that are not transfers',
  nonTransfer: 'Each can do more than move a balance. Check what it does before approving.',
  /** Q52: F7, per mint; Q36 when the mint cannot be read. */
  token2022Head: 'Token-2022 settings on a token you hold',
  freeze: 'Freeze authority — the issuer can freeze your account of this token.',
  permanentDelegate: 'Permanent delegate — an address that can move or burn this token from any account, yours included.',
  transferHook: 'Transfer hook — a program that runs on every transfer of this token.',
  unreadable: "Could not read this token's settings",
  /** B1 §3 ("this transaction does not expire", capitalised). */
  nonce: 'This transaction does not expire.',
  /** Q53: F9. */
  wholeHead: 'Whole balance to a first-time address',
  whole: 'All or nearly all of a balance goes to an address you have not sent to before.',
  /** Q54: L3's line, replaced beside an authority flag (F3, F4) when nothing else moves. */
  noChangesAuthority: 'No SOL or token balance changes — but this transaction changes who controls an account of yours (above).',
  /** Q55: the banners' meta — the instruction (`#<n> <program>::<Instruction>`), the simulation's chain state. */
  postSimulation: 'post-simulation',
} as const;

/** #48's origin-mismatch · auto-reject (ix:18484-18521), as drawn — "Settings → dApps" reads Settings → Connected dApps (Q03, D1). */
export const MISMATCH_TEXT = {
  overline: 'Auto-rejected · Origin mismatch',
  head: 'Request blocked automatically',
  sub: 'A transaction came from a different origin than the one you connected. We rejected it without showing Approve.',
  flagHead: 'Origin mismatch · auto-reject',
  flagBody: (session: string, request: string): [string, string, string, string, string] => [
    'A connected session for ',
    session,
    ' received a transaction request from ',
    request,
    '. This is almost always a man-in-the-middle attempt. The request was dropped without prompting.',
  ],
  detail: 'Mismatch detail',
  activeSession: 'Active session',
  requestOrigin: 'Request origin',
  match: 'Match',
  matchValue: 'false',
  action: 'Action',
  actionValue: 'REJECT_NO_PROMPT',
  caption: (session: string): [string, string, string] => ['If you believe this is legitimate, disconnect the existing ', session, ' session in Settings → Connected dApps and reconnect through the new domain explicitly. Never approve cross-origin transactions.'],
  ok: 'OK, return to dApp',
} as const;
