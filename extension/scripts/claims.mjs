// B1e §6.1, §6.4 (B1e-2 Task 6): the ONE list of claims the extension does not keep, read by every check that reads
// words a user or a reviewer sees — the UI-claims guard (scripts/check-ui-claims.mjs: the source tier in its test, the
// built packages in its gate), the store texts (scripts/__tests__/storeTexts.test.mjs: terms, help, listing,
// data-usage) and the privacy policy (scripts/__tests__/privacy.test.mjs: privacy.md). A check may add words of its own
// (storeTexts adds TGE and the written forms of its date); none may read fewer. It lives in scripts/, not release/,
// because release/'s files are themselves read by gates.
//
// The published policy (release/privacySentences.mjs) is exact: the coordinator receives the public addresses (P3, P4),
// the transactions (P5, P6) and the IP address (P2); and the extension is a transparent wallet (memory "shielded privacy
// guarantee"). So no text may call it private, anonymous, untraceable, unlinkable, confidential, end-to-end encrypted,
// zero-knowledge or shielded, nor say that something stays on this device, never leaves it, is never received or seen,
// or (review 2 M1) is never sent, transmitted, uploaded or shared — except by the exact true sentences below, each with
// its verdict and the surfaces (tiers) it is true on (P11's "never leave this device" is the one allowed sending form).
//
// This is a word list: a review aid, not a proof. What it cannot read is a sentence assembled at run time from pieces
// (`'never ' + verb`, a template's `${…}`, an array joined), text from data (token names, a site's strings, the
// coordinator's answers) and CSS `content:` — each piece is read alone, so a claim split across pieces passes.

const DASH = '[\\s\\-\\u2010\\u2011\\u2013\\u2014]';
const PLACE = '(?:this|your|the)\\s+(?:device|browser|computer|machine|phone|extension)';
const re = source => new RegExp(source, 'i');

/** The claims refused, case-insensitive, in this order. "private key(s)", "Privacy Policy", the policy's URL path and the contact address are names. */
export const CLAIMS = Object.freeze(
  [
    {id: 'private', pattern: /\bprivate(?!\s+keys?\b)/i},
    {id: 'privacy', pattern: /(?<!\/)\bprivacy\b(?!\s+policy\b|@|\.md\b)/i},
    {id: 'anonymous', pattern: /anonym/i},
    {id: 'untraceable', pattern: /untraceab/i},
    {id: 'unlinkable', pattern: /unlinkab/i},
    {id: 'confidential', pattern: /\bconfidential(?:ly|ity)?\b/i},
    {id: 'e2e', pattern: /\be2e\b/i},
    {id: 'end-to-end', pattern: re(`end${DASH}to${DASH}end`)},
    {id: 'encrypted in transit', pattern: /\bencrypted\s+in\s+transit\b/i},
    {id: 'zero-knowledge', pattern: re(`zero${DASH}knowledge`)},
    {id: 'shielded', pattern: /shielded/i},
    {id: 'incognito', pattern: /\bincognito\b/i},
    {id: 'hidden', pattern: /\b(?:is|are|stays?|remains?|kept|keeps?\s+\w+)\s+hidden\b|\bhidden\s+from\b|\bhides\s+(?:your|you)\b/i},
    {id: 'never see', pattern: /\bnever\s+sees?\b/i},
    {id: "can't see", pattern: /\b(?:can['’]?t|cannot|can not)\s+see\b/i},
    {id: 'no one can see', pattern: /\bno\s*(?:one|body)\s+(?:else\s+)?(?:knows?|sees?|can\s+(?:see|know|tell|track|trace|link|read))\b/i},
    {
      id: "we don't see",
      pattern:
        /\b(?:we|noctura|the\s+coordinator|our\s+servers?)\s+(?:do\s+not|don['’]?t|does\s+not|doesn['’]?t|cannot|can['’]?t|can\s+not|will\s+not|won['’]?t|never)\s+(?:ever\s+)?(?:see|know|receive|get|store|keep|log|track|collect|record|read|access|share|sell|send|transmit|upload)\b/i,
    },
    // Fix round 1 (task review I1): the passive ("is never logged / stored / tracked / collected …") and the bare past
    // participle ("Never stored, never logged.") are the same claim. Not the bare "never received": #40's true "a fresh
    // seed — never received any tokens" is the account's history, not a claim about Noctura.
    {
      id: 'never receive',
      pattern:
        /\bnever\s+(?:receives?|gets?|collects?|stores?|logs?|tracks?|records?|shares?|sells?|knows?)\b|\b(?:is|are|was|were|be|been|gets?)\s+never\s+(?:ever\s+)?(?:stored|logged|tracked|collected|recorded|kept|saved|sold|seen|received)\b|\bnever\s+(?:ever\s+)?(?:be|been|gets?|got)\s+(?:stored|logged|tracked|collected|recorded|kept|saved|sold|seen|received)\b|\bnever\s+(?:ever\s+)?(?:stored|logged|tracked|collected|recorded)\b/i,
    },
    // Review 2 M1: a sending claim needs no subject — "the wallet never sends …", "… is never uploaded", "never shared".
    // The third person and the passive only: the imperative ("Never send your recovery phrase …", help.md's advice) and
    // the user's own history ("Never sent here before", "You have never sent to this address") are true and pass.
    {
      id: 'never send',
      pattern:
        /\bnever\s+(?:ever\s+)?(?:sends|transmits|uploads|transmitted|uploaded|shared)\b|\b(?:is|are|was|were|gets?)\s+never\s+(?:ever\s+)?sent\b|\bnever\s+(?:ever\s+)?(?:be|been|gets?|got)\s+(?:sent|transmitted|uploaded|shared)\b/i,
    },
    {id: 'never leave', pattern: /\bnever\s+(?:ever\s+)?(?:leaves?|left)\b/i},
    {
      id: 'nothing leaves',
      // Fix round 1 (I1): "transmitted", and "no data / information leaves …" as the same claim as "nothing leaves".
      pattern:
        /\bnothing\s+(?:ever\s+)?(?:leaves|is\s+(?:ever\s+)?(?:sent|shared|stored|logged|tracked|collected|uploaded|transmitted))\b|\bno\s+(?:personal\s+)?(?:data|information|info)\s+(?:ever\s+)?(?:leaves|is\s+(?:ever\s+)?(?:sent|shared|stored|logged|tracked|collected|uploaded|transmitted))\b/i,
    },
    {id: 'stays on this device', pattern: re(`\\b(?:stay|stays|staying|remain|remains|kept|is\\s+kept|are\\s+kept)\\s+(?:only\\s+)?(?:on|in)\\s+${PLACE}\\b|\\bstays?\\s+local\\b`)},
    {id: 'only on this device', pattern: re(`\\b(?:only|solely|exclusively)\\s+(?:on|in)\\s+${PLACE}\\b`)},
    {id: 'local-only', pattern: re(`\\blocal(?:ly)?${DASH}?only\\b|\\b(?:fully|entirely|completely|purely|100%)\\s+local\\b`)},
    {id: 'offline-only', pattern: re(`\\boffline${DASH}only\\b`)},
    {
      id: 'offline',
      pattern: /\b(?:works?|working|runs?|stays?|kept|fully|completely|entirely|100%)\s+offline\b|\boffline\s+(?:wallet|signing|vault|storage|keys?)\b|\bair[\s-]?gapped\b|\bcold\s+(?:storage|wallet)\b/i,
    },
    {id: 'no server', pattern: /\bno\s+(?:servers?|backend|cloud)\b|\bserver[\s-]?less\b|\bwithout\s+(?:a\s+|any\s+)?servers?\b/i},
    {id: 'no tracking', pattern: /\bno\s+(?:tracking|trackers?|logs?|logging)\b|\bzero[\s-](?:logs?|tracking)\b|\bnot\s+(?:tracked|logged)\b/i},
    {id: 'bank-grade', pattern: /\bsecure\s+as\s+a\s+bank\b|\b(?:bank|military)[\s\-\u2010\u2011]?grade\b/i},
  ].map(c => Object.freeze(c)),
);

/**
 * Where a text is read — each check names its own; an allowance holds only on the tiers it lists:
 * 'source' — the extension's HTML entries and src/ without tests (check-ui-claims.test.mjs);
 * 'built'  — the built packages, chrome/ and firefox/, both builds (the gate): the source's words plus the bundled ../core
 *            and libraries, so an allowance true of a screen lists both 'source' and 'built';
 * 'store'  — terms.md, help.md, listing.md, data-usage.md (storeTexts.test.mjs);
 * 'policy' — privacy.md (privacy.test.mjs).
 */
export const TIERS = Object.freeze(['source', 'built', 'store', 'policy']);

/** The privacy policy's sentence `id`, as written (the allowances that quote the policy are its exact words). */
const P11 = 'Your recovery phrase, private keys, password and anti-phishing phrase never leave this device through the extension.';
const P12 = 'Noctura never receives it.';
const P13 = 'The sites you connected, your address book and your anti-phishing phrase are stored only in this browser.';

/** True sentences that hold a refused word, by their exact words (a substring of a unit, whitespace collapsed), each with its verdict. */
export const ALLOWED = Object.freeze(
  [
    {
      text: 'Move to a private place.',
      tiers: ['source', 'built'],
      verdict: 'true — advice to the user (the pre-reveal modal, unlock.html and SEED.gateBody), not a property of the wallet',
    },
    {
      text: 'keep it private.',
      tiers: ['source', 'built'],
      verdict: "true — advice about the damaged wallet's saved file (#1 damaged states, unlock.html dmg-save-note and the remove-damaged page)",
    },
    {
      text: 'Accounts after the first one exist only in this extension until the phone app supports more than one account.',
      tiers: ['source', 'built'],
      verdict: "true — #8's banner (E24): the phone app derives one account from the phrase, so the second and later live only here",
    },
    {
      text: '${} · cannot see your seed or private key',
      tiers: ['source', 'built'],
      verdict: "true — #47 dapp-connect, a site not verified: connecting gives it the public address only (src/approve/strings.ts seeAddressSecUnknown)",
    },
    {
      text: 'A non-custodial Solana wallet. Your keys stay on this device.',
      tiers: ['source', 'built'],
      verdict: "true — #1's tagline: the keys are created and kept in this browser's vault (P11); the addresses are not keys",
    },
    {
      text: 'your keys stay on this device.',
      tiers: ['source', 'built'],
      verdict: "true — #38 About's line, the same fact as #1's tagline (P11)",
    },
    {
      text: 'Your recovery phrase and password never leave this device.',
      tiers: ['source', 'built'],
      verdict: "true — #39's footer, the first sentence: P11's own words for the phrase and the password; the next sentence says what is sent",
    },
    {
      text: 'Access to shielded features is unavailable in your jurisdiction.',
      tiers: ['built'],
      verdict: "never shown — core/geo/classify.ts's message; the extension's gate (src/background/geo/gate.ts) passes on a reason, never this text",
    },
    {text: 'VPN or proxy detected. Shielded features may be limited.', tiers: ['built'], verdict: 'never shown — core/geo/classify.ts, as above'},
    {text: 'Shielded features may have limited availability in your region.', tiers: ['built'], verdict: 'never shown — core/geo/classify.ts, as above'},
    {text: 'Private accessor was defined without a getter', tiers: ['built'], verdict: "never shown — tslib's class-field helper in a bundled library (TypeError text)"},
    {text: 'Cannot read private member from an object whose class did not declare it', tiers: ['built'], verdict: "never shown — tslib's helper, as above"},
    {text: 'Private accessor was defined without a setter', tiers: ['built'], verdict: "never shown — tslib's helper, as above"},
    {text: 'Private method is not writable', tiers: ['built'], verdict: "never shown — tslib's helper, as above"},
    {text: 'Cannot write private member to an object whose class did not declare it', tiers: ['built'], verdict: "never shown — tslib's helper, as above"},
    {
      text: 'prison private prize',
      tiers: ['built'],
      verdict: 'never shown as a claim — three neighbouring words of the BIP-39 English wordlist (@scure/bip39), which #5 / #8 check a phrase against',
    },
    {text: '<anonymous>', tiers: ['built'], verdict: "never shown — React's stack-frame name in its development warnings"},
    {text: P11, tiers: ['store', 'policy'], verdict: 'true — P11, the policy\'s sentence (help.md restates it verbatim): the vault isolation gate and the routes'},
    {text: P12, tiers: ['store', 'policy'], verdict: "true — P12: the passkey is the browser's and the provider's; no route carries it (help.md restates P12)"},
    {text: P13, tiers: ['store', 'policy'], verdict: 'true — P13: grants, contacts and the phrase key are in storage.local, no storage.sync (help.md restates P13)'},
    {
      text: 'the lookup never leaves the server',
      tiers: ['policy'],
      verdict: "true — R12, ICO's answer: the GeoLite2 lookup runs on the coordinator itself",
    },
    {
      text: "It never records the request's parameters, your IP address or any other header.",
      tiers: ['policy'],
      verdict: "true — R4, ICO's answer 1–2 on the coordinator's application log; \"other\": the Origin header R4 excepts (R7), and R1 says what the access log does record",
    },
    {text: 'Questions about privacy:', tiers: ['policy'], verdict: 'P16, the contact line (owner decision E8) — a topic, not a claim'},
    {
      text: 'and Noctura never receives them, so Noctura cannot give them back to you.',
      tiers: ['store'],
      verdict: "true — help.md's recovery phrase topic: the phrase never leaves the vault page (P11)",
    },
    {
      text: 'Noctura never receives them, never holds your funds',
      tiers: ['store'],
      verdict: 'true — terms.md, non-custodial software: the phrase and keys stay in the vault (P11); no route moves funds',
    },
    {
      text: 'Your keys stay on this device. The recovery phrase and keys are stored in this browser, encrypted with your password; Noctura never receives them.',
      tiers: ['store'],
      verdict: "true — listing.md's description: P11, the vault (Argon2id-derived key)",
    },
  ].map(a => Object.freeze({...a, tiers: Object.freeze(a.tiers)})),
);

const collapse = s => s.replace(/\s+/g, ' ').trim();

function tierOf(tier) {
  if (!TIERS.includes(tier)) throw new Error(`claimViolations: tier must be one of ${TIERS.join(', ')} (got ${String(tier)})`);
  return tier;
}

/**
 * Every refused claim in `units` ({where, text}) read on `tier`, as 'where: "id" in “unit”'. Only the allowances that
 * list `tier` apply; each removes exactly its own words before the claims are matched; `used` (a Set) collects the
 * texts of those that were found.
 */
export function claimViolations(units, {tier, claims = CLAIMS, allowed = ALLOWED, used = new Set()} = {}) {
  const t = tierOf(tier);
  const mine = allowed.filter(a => a.tiers.includes(t));
  const out = [];
  for (const {where, text} of units) {
    let rest = collapse(text);
    for (const a of mine) {
      if (rest.includes(a.text)) {
        used.add(a.text);
        rest = rest.split(a.text).join(' ');
      }
    }
    for (const c of claims) if (c.pattern.test(rest)) out.push(`${where}: "${c.id}" in “${collapse(text)}”`);
  }
  return out;
}

/** The allowances listing `tier` that no unit read on it needed (stale: fail — a stale entry would let its words back in). */
export function unusedAllowances(used, tier, allowed = ALLOWED) {
  const t = tierOf(tier);
  return allowed.filter(a => a.tiers.includes(t) && !used.has(a.text)).map(a => `allowance not used by any ${t} text: “${a.text}”`);
}

/** A markdown text as units: one per paragraph (blank-line separated), so a refusal quotes the paragraph, not the file. */
export function markdownUnits(md, where) {
  return md
    .split(/\n\s*\n/)
    .map(collapse)
    .filter(t => t !== '')
    .map(text => ({where, text}));
}
