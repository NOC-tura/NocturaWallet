import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CONTENT_SCRIPTS, EXTENSION_CSP, HOST_PERMISSIONS, PERMISSIONS, render} from '../../manifest/source.mjs';
import {PRIVACY_SENTENCES} from '../../release/privacySentences.mjs';
import {CONTACT, LIVE_PAGES, TERMS_DRAFT_MARKERS, liveCheck, pageProblems} from '../live-check.mjs';
import {forbiddenForms} from '../check-no-tge-date.mjs';
import {claimViolations, markdownUnits, unusedAllowances} from '../claims.mjs';
import {NOCTURA_PAGES} from '../../src/shared/links';
import {RP_ID} from '../../src/vault/passkey';
import {ALLOWANCE_WORD, OVERRIDE_WORDS} from '../../src/background/dapp/redFlags';
import {FLAG_TEXT, MISMATCH_TEXT, TX_TEXT, WINDOW_TEXT} from '../../src/approve/strings';
import {MANAGE, PHRASE, REAUTH} from '../../src/unlock/strings';
import {SECURITY_TEXT} from '../../src/app/screens/Security';
import {SETTINGS_TEXT} from '../../src/app/screens/Settings';
import {CONNECTED_TEXT} from '../../src/app/screens/ConnectedApps';
import {PHRASE_TEXT} from '../../src/app/ui/PhraseLine';

// B1e §6.3, §6.4 (Task 4 of B1e-2): the texts for the Chrome Web Store and for noc-tura.io — release/terms.md,
// release/help.md, release/listing.md, release/data-usage.md — read as a reviewer would: the store reasons verbatim from
// manifest/source.mjs, the spec's own sentences verbatim, the privacy sentences verbatim where a text restates them, the
// UI's real labels, the titles and contact the live check asks for, and no claim the build does not keep. Every helper
// below returns what is wrong (an empty list = right), so each check runs on the real file AND on a planted mistake.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = rel => readFileSync(resolve(ROOT, rel), 'utf8');
const TERMS = read('release/terms.md');
const HELP = read('release/help.md');
const LISTING = read('release/listing.md');
const DATA_USAGE = read('release/data-usage.md');
const PRIVACY_MD = read('release/privacy.md');
const LICENSE = read('../LICENSE');
const SPEC = read('../docs/superpowers/specs/2026-10-30-extension-b1e-chrome-release-design.md');
const UNLOCK_HTML = read('unlock.html');
const TEXTS = {terms: TERMS, help: HELP, listing: LISTING, 'data-usage': DATA_USAGE};
/** terms.md as the lawyer hands it back for publishing: its DRAFT note (line 3, one blockquote line) and the blank line after it removed. */
const withoutDraftNote = md => md.replace(/^> \*\*DRAFT for the owner's lawyer[^\n]*\n\n/m, '');
const sentence = id => {
  const s = PRIVACY_SENTENCES.find(x => x.id === id);
  if (s === undefined) throw new Error(`no privacy sentence ${id}`);
  return s.text;
};

/** The single-purpose statement and the E17 paragraph, as spec §6.4 writes them (each also asserted to be in the spec). */
const SINGLE_PURPOSE = 'A Solana wallet: hold, send and receive SOL and tokens, and approve requests from Solana sites.';
const E17_PARAGRAPH =
  'No page is served at this host and the extension never connects to it (its content security policy allows connections to one other host only). The permission exists only so the passkey is bound to a name no website can use; passkeys appear under this name in the user\'s passkey manager.';
const CONTENT_SCRIPTS_HEADING = '### Content scripts (`<all_urls>`)';

/** The text under `heading` (an exact heading line) up to the next heading of the same or a higher level; null when absent. */
function section(md, heading) {
  const lines = md.split('\n');
  const at = lines.indexOf(heading);
  if (at < 0) return null;
  const level = /^#+/.exec(heading)[0].length;
  const end = lines.findIndex((l, i) => i > at && /^#+ /.test(l) && /^#+/.exec(l)[0].length <= level);
  return lines.slice(at + 1, end < 0 ? undefined : end).join('\n');
}

/** Every store reason that is not, verbatim, under its own heading in the listing (`### \`value\``; the content scripts under theirs). */
function reasonProblems(listing, permissions = PERMISSIONS, hosts = HOST_PERMISSIONS, contentScripts = CONTENT_SCRIPTS) {
  const out = [];
  for (const {value, reason} of [...permissions, ...hosts]) {
    const body = section(listing, `### \`${value}\``);
    if (body === null) out.push(`${value}: no section`);
    else if (!body.includes(reason)) out.push(`${value}: reason not verbatim`);
  }
  const cs = section(listing, CONTENT_SCRIPTS_HEADING);
  if (cs === null) out.push('content scripts: no section');
  else if (!cs.includes(contentScripts.reason)) out.push('content scripts: reason not verbatim');
  return out;
}

/** The justification headings the listing has that the manifest does not ask for (a permission the build does not hold). */
function extraJustifications(listing) {
  const want = new Set([...PERMISSIONS, ...HOST_PERMISSIONS].map(p => `### \`${p.value}\``).concat(CONTENT_SCRIPTS_HEADING));
  const body = section(listing, '## Permission justifications') ?? '';
  return body.split('\n').filter(l => /^### /.test(l) && !want.has(l));
}

/** CWS's summary: at most 132 characters (code points), not empty, one line. */
const summaryProblems = s => [
  ...(s.length === 0 ? ['empty'] : []),
  ...([...s].length > 132 ? [`${[...s].length} characters, at most 132`] : []),
  ...(/\n/.test(s) ? ['more than one line'] : []),
];

/**
 * Claims the extension does not keep (spec §6.4; memory "shielded privacy guarantee": the extension is transparent):
 * scripts/claims.mjs's list, read on its 'store' tier (the store texts' own true sentences allowed by their exact words;
 * `used` collects them), plus this check's own: "TGE" and every written form of its date.
 */
function forbiddenClaims(text, used = new Set()) {
  const lower = text.toLowerCase();
  return [
    ...claimViolations(markdownUnits(text, 'text'), {tier: 'store', used}),
    ...[...text.matchAll(/\bTGE\b/g)].map(m => m[0]),
    ...forbiddenForms().filter(f => lower.includes(f.toLowerCase())).map(() => '<the TGE date>'),
  ];
}

/** Lines that name the presale without being one of the allowed statements of fact (the store build's F12 and P7 / P8). */
const PRESALE_ALLOWED = () => [sentence('P7'), sentence('P8'), FLAG_TEXT.regionHead, FLAG_TEXT.regionClosed, "a country derived from it for a site's presale purchase"];
function presaleLines(text, allowed = PRESALE_ALLOWED()) {
  return text.split('\n').filter(l => /presale/i.test(l) && !allowed.some(a => l.includes(a)));
}

/** A .md as a site would publish it (privacy.test.mjs's rendering): paragraphs as <p>, headings as <h1>–<h3>, escaped. */
function asHtml(md) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return md
    .split(/\n{2,}/)
    .map(block => {
      const h = /^(#{1,3}) (.*)$/.exec(block);
      return h ? `<h${h[1].length}>${esc(h[2])}</h${h[1].length}>` : `<p>${esc(block)}</p>`;
    })
    .join('\n');
}

/** Help's sections, in order: §6.4's topics (the recovery phrase … the contact), each with the UI words it must use. */
function helpTopics() {
  return [
    {heading: '## Your recovery phrase', must: [SETTINGS_TEXT.recoveryPhrase, PHRASE.revealTitle, SECURITY_TEXT.taskVerify, 'Forgot password?', 'I have a wallet']},
    {
      heading: '## The anti-phishing phrase',
      must: ['Set an anti-phishing phrase', SECURITY_TEXT.phrase, SECURITY_TEXT.phraseCaption, SECURITY_TEXT.phraseHelp, SECURITY_TEXT.phraseNote, PHRASE_TEXT.failed],
    },
    {
      heading: '## A damaged wallet',
      must: [
        'Update Noctura to open this wallet',
        "This version of Noctura can't open this wallet's data.",
        'Update Noctura (in Chrome: Extensions → Update).',
        'Wallet data is damaged',
        "This browser's copy of your wallet can't be read by this or any later version of Noctura.",
        'Save the damaged data',
        'Remove damaged wallet',
        'DELETE',
        "This wallet's stored data is damaged.",
      ],
    },
    {heading: '## Why does my passkey show as "wallet.noc-tura.io"?', must: [sentence('P12'), sentence('P13'), RP_ID, MANAGE.remove, MANAGE.removedHelp]},
    {
      heading: '## Why is a transaction blocked?',
      must: [
        FLAG_TEXT.overlineBlocked,
        FLAG_TEXT.overlineUnlimited,
        FLAG_TEXT.overlineLarge,
        FLAG_TEXT.approveBlocked,
        FLAG_TEXT.approveUnlimited,
        ...Object.values(OVERRIDE_WORDS),
        ALLOWANCE_WORD,
        REAUTH.override,
        TX_TEXT.reauthNeeded,
        FLAG_TEXT.regionHead,
        FLAG_TEXT.regionMeta,
        MISMATCH_TEXT.head,
        TX_TEXT.couldNot,
        TX_TEXT.unreachable,
        TX_TEXT.expired,
        WINDOW_TEXT.blockSite,
        WINDOW_TEXT.rejectAndReport,
        CONNECTED_TEXT.blocked,
        CONNECTED_TEXT.unblock,
        SETTINGS_TEXT.connectedDapps,
        WINDOW_TEXT.budgetNotice,
      ],
    },
    {heading: '## What does the coordinator see?', must: [...['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P11'].map(sentence), NOCTURA_PAGES.privacy]},
    {heading: '## Contact', must: [CONTACT]},
  ];
}
function helpProblems(help, topics = helpTopics()) {
  const out = [];
  let last = -1;
  for (const t of topics) {
    const body = section(help, t.heading);
    if (body === null) {
      out.push(`${t.heading}: missing`);
      continue;
    }
    const at = help.split('\n').indexOf(t.heading);
    if (at < last) out.push(`${t.heading}: out of order`);
    last = at;
    for (const m of t.must) if (!body.includes(m)) out.push(`${t.heading}: missing "${m}"`);
  }
  return out;
}

/** §6.3's table rows as the spec writes them: [category, answer, why]. */
function specRows(spec = SPEC) {
  const from = spec.indexOf('### 6.3 ');
  const to = spec.indexOf('Certifications:', from);
  return tableRows(spec.slice(from, to));
}
/** A markdown table's body rows (header and separator dropped), each split into trimmed cells. */
function tableRows(md) {
  const rows = md.split('\n').filter(l => /^\|.*\|$/.test(l.trim()));
  return rows.slice(2).map(l => l.trim().slice(1, -1).split(' | ').map(c => c.trim()));
}
/** Which privacy sentences back each row: the fourth column's ids (or "—"). The ids are the code's judgement, pinned here. */
const BACKING = {
  'Personally identifiable information': ['P3', 'P4'],
  'Health information': [],
  'Financial and payment information': ['P3', 'P4', 'P5', 'P6'],
  'Authentication information': ['P11', 'P12'],
  'Personal communications': ['P10'],
  Location: ['P2', 'P8', 'R12'],
  'Web history': ['P13', 'P14'],
  'User activity': ['P15'],
  'Website content': ['P5', 'P6'],
};
function dataUsageProblems(md, rows = specRows()) {
  const out = [];
  const mine = tableRows(section(md, '## The form') ?? '');
  if (mine.length !== rows.length) out.push(`${mine.length} rows, §6.3 has ${rows.length}`);
  rows.forEach((want, i) => {
    const got = mine[i] ?? [];
    if (JSON.stringify(got.slice(0, 3)) !== JSON.stringify(want)) out.push(`row ${i + 1} (${want[0]}) differs from §6.3`);
    const ids = got[3] === '—' ? [] : (got[3] ?? '').split(', ');
    if (JSON.stringify(ids) !== JSON.stringify(BACKING[want[0]])) out.push(`row ${i + 1} (${want[0]}) backed by ${got[3]}`);
    for (const id of ids) if (!PRIVACY_SENTENCES.some(s => s.id === id)) out.push(`row ${i + 1}: no sentence ${id}`);
  });
  return out;
}

describe('the store and noc-tura.io texts (B1e §6.3, §6.4)', () => {
  it('the spec carries the single-purpose statement and the E17 paragraph this test pins (verbatim)', () => {
    const spec = SPEC.replace(/\n\s*/g, ' ');
    expect(spec).toContain(`("${SINGLE_PURPOSE}")`);
    expect(spec).toContain(`E17: "${E17_PARAGRAPH}"`);
  });

  it('listing: every permission, host and content-script reason verbatim from manifest/source.mjs, under its own heading — control: one changed word, a source reason changed, a section dropped', () => {
    expect(reasonProblems(LISTING)).toEqual([]);
    expect(extraJustifications(LISTING)).toEqual([]);
    expect(PERMISSIONS.map(p => p.value)).toEqual(['storage', 'alarms']);
    expect(reasonProblems(LISTING.replace('default five minutes', 'default ten minutes'))).toEqual(['alarms: reason not verbatim']);
    const changedSource = PERMISSIONS.map(p => (p.value === 'storage' ? {...p, reason: `${p.reason} And more.`} : p));
    expect(reasonProblems(LISTING, changedSource)).toEqual(['storage: reason not verbatim']);
    expect(reasonProblems(LISTING, PERMISSIONS, HOST_PERMISSIONS, {...CONTENT_SCRIPTS, reason: CONTENT_SCRIPTS.reason.replace('nothing', 'little')})).toEqual(['content scripts: reason not verbatim']);
    expect(reasonProblems(LISTING.replace('### `https://api.noc-tura.io/*`', '### api'))).toEqual(['https://api.noc-tura.io/*: no section']);
    expect(extraJustifications(LISTING.replace('## Remote code', '### `tabs`\n\nNot held.\n\n## Remote code'))).toEqual(['### `tabs`']);
  });

  it('listing: the wallet.noc-tura.io section adds the E17 paragraph verbatim; the RP ID is that host — control: the paragraph moved to the coordinator\'s section', () => {
    const wallet = `### \`https://${RP_ID}/*\``;
    expect(section(LISTING, wallet)).toContain(E17_PARAGRAPH);
    expect(section(LISTING, '### `https://api.noc-tura.io/*`')).not.toContain(E17_PARAGRAPH);
    const moved = LISTING.replace(E17_PARAGRAPH, '').replace('### `https://api.noc-tura.io/*`\n', `### \`https://api.noc-tura.io/*\`\n\n${E17_PARAGRAPH}\n`);
    expect(section(moved, wallet)).not.toContain(E17_PARAGRAPH);
  });

  it('listing: name and summary are the manifest\'s (CWS reads the summary from it), at most 132 characters — controls: 132 passes, 133 fails', () => {
    const manifest = render('chrome');
    expect(section(LISTING, '## Name')?.trim()).toBe(manifest.name);
    const summary = section(LISTING, '## Summary (short description)')?.trim() ?? '';
    expect(summary).toBe(manifest.description);
    expect(summaryProblems(summary)).toEqual([]);
    expect(summaryProblems('a'.repeat(132))).toEqual([]);
    expect(summaryProblems('a'.repeat(133))).toEqual(['133 characters, at most 132']);
    expect(summaryProblems('')).toEqual(['empty']);
  });

  it('listing: the single purpose verbatim, the category left to the owner, remote code none with its reason, the privacy policy URL', () => {
    expect(section(LISTING, '## Single purpose')?.trim()).toBe(SINGLE_PURPOSE);
    expect(section(LISTING, '## Category')).toContain('The owner picks it at submission');
    const remote = section(LISTING, '## Remote code') ?? '';
    expect(remote).toMatch(/^\s*\*\*No\.\*\*/);
    expect(remote).toContain("`script-src 'self'`");
    expect(EXTENSION_CSP).toContain("script-src 'self';");
    expect(EXTENSION_CSP).not.toMatch(/unsafe-eval|wasm-unsafe-eval|unsafe-inline/);
    expect(LISTING).toContain(NOCTURA_PAGES.privacy);
    expect(DATA_USAGE).toContain(NOCTURA_PAGES.privacy);
  });

  it('no claim the build does not keep, in all four texts — controls: each planted word is caught, "private keys" is not', () => {
    const used = new Set();
    for (const [name, text] of Object.entries(TEXTS)) expect(forbiddenClaims(text, used), name).toEqual([]);
    // Every store allowance is still needed by one of the four texts (a stale one would let its words back in).
    expect(unusedAllowances(used, 'store')).toEqual([]);
    expect(forbiddenClaims('Your private keys are yours.')).toEqual([]);
    expect(forbiddenClaims('Read the Privacy Policy or write to privacy@noc-tura.io.')).toEqual([]);
    for (const planted of [
      'A private wallet.',
      'Send privately.',
      'Anonymous payments.',
      'Untraceable.',
      'Privacy-first.',
      'Shielded sends.',
      'As secure as a bank.',
      'Bank-grade security.',
      'Free until TGE.',
      // Review 1 I3's blind spots, now in the shared list.
      'Your address never leaves this device.',
      'We do not see your transactions.',
      'Your activity stays on this device.',
      'A local-only wallet.',
      'Confidential transfers.',
      'No tracking.',
      'Works offline.',
      // Review 2 M1: a sending claim with no subject.
      'The wallet never sends your phrase anywhere',
      'Your phrase is never uploaded.',
      // A sentence allowed on the source tier (#39's footer) is not allowed here: the tiers do not leak.
      'Your recovery phrase and password never leave this device.',
    ]) {
      expect(forbiddenClaims(planted).length, planted).toBe(1);
    }
    expect(forbiddenClaims(`On ${forbiddenForms()[0]}.`)).toEqual(['<the TGE date>']);
  });

  it('nothing presale in the listing or the Terms; in Help and the data-usage form only the store build\'s F12 and P7 / P8 — control: a planted line is caught', () => {
    for (const text of [LISTING, TERMS]) {
      expect(text).not.toMatch(/presale/i);
      expect(text).not.toMatch(/\bNOC\b/);
    }
    expect(presaleLines(HELP)).toEqual([]);
    expect(presaleLines(DATA_USAGE)).toEqual([]);
    expect(presaleLines(`${HELP}\nBuy NOC in the presale from the wallet.\n`)).toEqual(['Buy NOC in the presale from the wallet.']);
  });

  it('Terms and Help: the live check\'s title and contact, published as plain HTML (Terms without its DRAFT note) — control: the contact dropped fails', () => {
    for (const name of ['terms', 'help']) {
      const page = LIVE_PAGES.find(p => p.name === name);
      const md = name === 'terms' ? withoutDraftNote(TERMS) : TEXTS[name];
      expect(md.startsWith(`# ${page.title}\n`), name).toBe(true);
      expect(pageProblems(page, asHtml(md)), name).toEqual([]);
      expect(pageProblems(page, asHtml(md.replaceAll(CONTACT, 'the address above'))), name).toEqual([`${name}: missing the contact ${CONTACT}`]);
    }
    expect(LISTING).toContain(CONTACT);
    expect(DATA_USAGE).toContain(CONTACT);
  });

  it('Terms: the live check refuses the draft as written (its DRAFT note) and passes it with the note removed — controls: the markers are the note\'s own words and only its, a typographic apostrophe is caught', async () => {
    const terms = LIVE_PAGES.find(p => p.name === 'terms');
    expect(terms.mustNot).toBe(TERMS_DRAFT_MARKERS);
    expect(LIVE_PAGES.filter(p => p.mustNot !== undefined).map(p => p.name)).toEqual(['terms']);
    // The negative control is real: the committed file carries the note, each marker is in it, and in nothing else.
    const note = TERMS.split('\n')[2];
    expect(withoutDraftNote(TERMS)).toBe(TERMS.replace(`${note}\n\n`, ''));
    expect(withoutDraftNote(TERMS).length).toBe(TERMS.length - note.length - 2);
    for (const m of TERMS_DRAFT_MARKERS) {
      expect(note, m).toContain(m);
      expect(withoutDraftNote(TERMS), m).not.toContain(m);
    }
    const refused = TERMS_DRAFT_MARKERS.map(m => `terms: carries "${m}" — the draft's note, which is not published`);
    expect(pageProblems(terms, asHtml(TERMS))).toEqual(refused);
    expect(pageProblems(terms, asHtml(withoutDraftNote(TERMS)))).toEqual([]);
    // As the release runs it: the three pages served as plain HTML, Terms as written → not ok, naming the note; without it → ok.
    const serve = termsMd => async url => {
      const md = url === terms.url ? termsMd : url === NOCTURA_PAGES.privacy ? PRIVACY_MD : url === NOCTURA_PAGES.help ? HELP : null;
      return md === null ? {status: 404, text: async () => ''} : {status: 200, text: async () => asHtml(md)};
    };
    expect(await liveCheck({fetch: serve(TERMS)})).toEqual({ok: false, problems: refused});
    expect(await liveCheck({fetch: serve(withoutDraftNote(TERMS))})).toEqual({ok: true, problems: []});
    // Folded like the rest of the comparison: "owner’s lawyer" (U+2019, or &rsquo;) is the same marker.
    const typographic = `${asHtml(withoutDraftNote(TERMS))}\n<p>Checked by the owner&rsquo;s lawyer.</p>`;
    expect(pageProblems(terms, typographic)).toEqual([`terms: carries "owner's lawyer" — the draft's note, which is not published`]);
  });

  it('Terms: a DRAFT for the owner\'s lawyer, said first; the BSL 1.1 change date and licence are LICENSE\'s — control: another date fails', () => {
    expect(TERMS.split('\n')[2]).toMatch(/^> \*\*DRAFT for the owner's lawyer/);
    const field = (text, name) => new RegExp(`^${name}:\\s+(.+)$`, 'm').exec(text)?.[1].trim();
    expect(LICENSE.startsWith('Business Source License 1.1\n')).toBe(true);
    const licence = {date: field(LICENSE, 'Change Date'), to: field(LICENSE, 'Change License')};
    expect(licence).toEqual({date: '2034-01-01', to: 'MIT License'});
    const says = text => text.includes('Business Source License 1.1') && text.includes(`on ${licence.date}`) && text.includes(`the ${licence.to}`);
    expect(says(TERMS)).toBe(true);
    expect(says(TERMS.replace(licence.date, '2030-01-01'))).toBe(false);
    for (const topic of ['## Non-custodial software', '## Your responsibility', '## Not financial advice', '## No warranty', '## Licence', '## Contact']) {
      expect(section(TERMS, topic), topic).not.toBeNull();
    }
  });

  it('Help: §6.4\'s topics in order, each in the UI\'s own words — controls: a topic dropped, a label the UI changed', () => {
    expect(helpProblems(HELP)).toEqual([]);
    expect(helpProblems(HELP.replace('## A damaged wallet', '## Damage'))).toEqual(['## A damaged wallet: missing']);
    const renamed = helpTopics().map(t => (t.heading === '## The anti-phishing phrase' ? {...t, must: t.must.map(m => (m === SECURITY_TEXT.phraseHelp ? 'Never type it anywhere.' : m))} : t));
    expect(helpProblems(HELP, renamed)).toEqual(['## The anti-phishing phrase: missing "Never type it anywhere."']);
    // The damaged screens' words are unlock.html's (the vault page's static copy), not Help's own.
    for (const line of helpTopics()[2].must.slice(0, 7)) expect(UNLOCK_HTML, line).toContain(line);
  });

  it('Help restates the coordinator\'s view only as the privacy sentences themselves — control: P5 with one number changed is found', () => {
    const body = section(HELP, '## What does the coordinator see?');
    const p5 = sentence('P5');
    expect(body).toContain(p5);
    const changed = HELP.replace(p5, p5.replace('every 5 seconds', 'every 10 seconds'));
    expect(helpProblems(changed)).toEqual([`## What does the coordinator see?: missing "${p5}"`]);
    for (const id of ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P11', 'P12', 'P13']) expect(PRIVACY_MD, id).toContain(sentence(id));
  });

  it('data-usage: §6.3\'s table row for row, each row backed by its privacy sentences — controls: a flipped answer, a wrong backing', () => {
    expect(specRows().map(r => r[0])).toEqual(Object.keys(BACKING));
    expect(dataUsageProblems(DATA_USAGE)).toEqual([]);
    expect(dataUsageProblems(DATA_USAGE.replace('| Location | **Yes** |', '| Location | **No** |'))).toEqual(['row 6 (Location) differs from §6.3']);
    expect(dataUsageProblems(DATA_USAGE.replace('| P15 |', '| P14 |'))).toEqual(['row 8 (User activity) backed by P14']);
  });

  it('data-usage: the three certifications, each confirmed by R20 (ICO §6.2 answer 5); remote code none — control: R20\'s text is the answer\'s', () => {
    const certs = section(DATA_USAGE, '## Certifications') ?? '';
    for (const c of [
      'I do not sell or transfer user data to third parties, outside of the approved use cases',
      'I do not use or transfer user data for purposes that are unrelated to my item\'s single purpose',
      'I do not use or transfer user data to determine creditworthiness or for lending purposes',
    ]) {
      const line = certs.split('\n').find(l => l.includes(c));
      expect(line, c).toBeDefined();
      expect(line, c).toContain('R20');
    }
    const r20 = PRIVACY_SENTENCES.find(s => s.id === 'R20');
    expect(r20.source).toBe('ICO §6.2 answer 5');
    expect(certs).toContain(r20.text);
    expect(read('release/ico-retention.md')).toContain('5 Use: only to answer requests, protect from abuse (rate limits, CrowdSec), diagnose faults. Not sold or shared for any other purpose.');
    expect(section(DATA_USAGE, '## Remote code')).toMatch(/^\s*\*\*None\.\*\*/);
  });
});
