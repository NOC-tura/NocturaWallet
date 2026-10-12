import {classify, decodedForDisplay, editDistance, siteName, skel} from '../classify';
import {KNOWN_DOMAINS} from '../knownList';

const kind = (h: string) => classify(h).kind;
const imitates = (h: string) => {
  const c = classify(h);
  return c.kind === 'lookalike' ? [c.rule, c.imitates] : [c.kind];
};

// Spec §2.5 and §6.1 "Classifier": a table, each rule with its positive and its negative controls.
describe('the origin classifier', () => {
  it('the known list is the owner-approved fifteen (D2)', () => {
    expect(KNOWN_DOMAINS.map(k => k.domain)).toEqual([
      'noc-tura.io', 'jup.ag', 'raydium.io', 'orca.so', 'meteora.ag', 'magiceden.io', 'tensor.trade', 'drift.trade',
      'marinade.finance', 'kamino.finance', 'jito.network', 'phantom.app', 'solflare.com', 'solscan.io', 'pump.fun',
    ]);
  });

  it('verified: a listed domain and any subdomain of it — the list name, never a page-supplied one (C7)', () => {
    expect(classify('app.noc-tura.io')).toEqual({kind: 'verified', name: 'Noctura', domain: 'noc-tura.io'});
    expect(classify('www.jup.ag')).toEqual({kind: 'verified', name: 'Jupiter', domain: 'jup.ag'});
    expect(classify('magiceden.io')).toEqual({kind: 'verified', name: 'Magic Eden', domain: 'magiceden.io'});
    expect(siteName('www.jup.ag')).toBe('Jupiter');
    // Rule 1 wins: an IDN subdomain of a listed domain is verified (review 2 L13).
    expect(kind('xn--ww-t2s.jup.ag')).toBe('verified');
    // Not a suffix trick: the dot is required.
    expect(kind('notjup.ag')).not.toBe('verified');
  });

  it('lookalike rule a (IDN): the Cyrillic ph\u0430ntom alone and as a label pair inside another host; a combining-mark j\u00F9p', () => {
    expect(imitates('xn--phntom-4nf.app')).toEqual(['idn', 'phantom.app']);
    expect(imitates('xn--phntom-4nf.app.evil.com')).toEqual(['idn', 'phantom.app']);
    expect(imitates('xn--jp-oka.ag')).toEqual(['idn', 'jup.ag']);
    expect(imitates('xn--rydium-3nf.io')).toEqual(['idn', 'raydium.io']);
    const c = classify('xn--phntom-4nf.app');
    expect(c.kind === 'lookalike' ? c.idn : null).toEqual({char: '\u0430', codePoint: 'U+0430', script: 'Cyrillic', latin: 'a', latinCodePoint: 'U+0061'});
    const mark = classify('xn--jp-oka.ag');
    expect(mark.kind === 'lookalike' ? mark.idn : null).toEqual({char: '\u00F9', codePoint: 'U+00F9', script: 'Latin', latin: 'u', latinCodePoint: 'U+0075'});
  });

  it('the design’s xn--phntom-ezv.app is NOT a Cyrillic ph\u0430ntom: it decodes to "phnt\u0F58om" (U+0F58, Tibetan) — unknown, international', () => {
    expect(decodedForDisplay('xn--phntom-ezv.app')).toBe('phnt\u0F58om.app');
    expect(classify('xn--phntom-ezv.app')).toEqual({kind: 'unknown', international: true});
  });

  it('lookalike rule b (edit distance ≤ 1 to a listed label of 4+ characters; distance 0 under another TLD counts)', () => {
    expect(imitates('tensr.trade')).toEqual(['edit', 'tensor.trade']);
    expect(imitates('orcaa.so')).toEqual(['edit', 'orca.so']);
    expect(imitates('orca.io')).toEqual(['edit', 'orca.so']);
    expect(imitates('magiceden.us')).toEqual(['edit', 'magiceden.io']);
    expect(imitates('jito.wtf')).toEqual(['edit', 'jito.network']);
    expect(imitates('n0c-tura.io')).toEqual(['edit', 'noc-tura.io']);
    expect(imitates('drfit.trade')).toEqual(['edit', 'drift.trade']); // an adjacent swap is one edit
  });

  it('lookalike rule c (embedded, on the whole host string)', () => {
    expect(imitates('jup.ag.evil.com')).toEqual(['embedded', 'jup.ag']);
    expect(imitates('jup-ag.io')).toEqual(['embedded', 'jup.ag']);
    expect(imitates('app-noc-tura-io.com')).toEqual(['embedded', 'noc-tura.io']);
    // Stated, accepted false positive (§2.5): a click on "Connect anyway".
    expect(imitates('jup.agency.com')).toEqual(['embedded', 'jup.ag']);
  });

  it('lookalike rule d (swaps 0→o, 1→l, rn→m, vv→w on the second-level label)', () => {
    expect(imitates('rnagiceden.io')).toEqual(['swap', 'magiceden.io']);
    expect(imitates('so1f1are.com')).toEqual(['swap', 'solflare.com']);
    // No swap applied, no rule d: every jup.* stays unknown (the 4-character floor's reason, review 2 M4).
    expect(kind('jup.io')).toBe('unknown');
  });

  it('fix round 1 (controller ruling): rules b, c, d also run on the skeleton, not only the raw host', () => {
    // xn--phntom-4nf.com decodes to ph\u0430ntom.com (Cyrillic \u0430): too far from any known label on the raw
    // string, but edit distance 0 on the skeleton against phantom.app's own skeleton.
    expect(imitates('xn--phntom-4nf.com')).toEqual(['edit', 'phantom.app']);
    // xn--jp-ag-1ua.io decodes to j\u00F9p-ag.io (combining-mark \u00F9): the skeleton collapses the mark, and the
    // hyphenated skeleton of jup.ag is then embedded in it.
    expect(imitates('xn--jp-ag-1ua.io')).toEqual(['embedded', 'jup.ag']);
    // xn--phntom-app-0qi.com decodes to ph\u0430ntom-app.com: the hyphenated skeleton of phantom.app is embedded.
    expect(imitates('xn--phntom-app-0qi.com')).toEqual(['embedded', 'phantom.app']);
  });

  it('lookalike rule e (rev 3.2, owner-delegated 2026-10-12): a listed brand as a subdomain label, left of the last two labels', () => {
    // Free hosting: the brand is the whole subdomain label (equality).
    expect(imitates('phantom.vercel.app')).toEqual(['subdomain', 'phantom.app']);
    expect(imitates('raydium.pages.dev')).toEqual(['subdomain', 'raydium.io']);
    // Equality reaches a 3-character label (jup): the 4-character floor is rule b's and only gates the edit distance.
    expect(imitates('jup.netlify.app')).toEqual(['subdomain', 'jup.ag']);
    // A swap (0→o) or one edit on a 4+-character listed label, under someone else's domain.
    expect(imitates('phant0m.app.evil.com')).toEqual(['subdomain', 'phantom.app']);
    expect(imitates('tensr.trade.evil.com')).toEqual(['subdomain', 'tensor.trade']);
    // Every label left of the last two is checked, not only the leftmost.
    expect(imitates('login.kamino.example.com')).toEqual(['subdomain', 'kamino.finance']);
    // On the skeleton too for an xn-- label (the Task 1 ruling): xn--rydium-3nf decodes to r + Cyrillic a + ydium.
    expect(imitates('xn--rydium-3nf.vercel.app')).toEqual(['subdomain', 'raydium.io']);
    // Rule d's swaps on a subdomain label (rn→m): two edits from magiceden, so only the swap clause reaches it.
    expect(imitates('rnagiceden.vercel.app')).toEqual(['subdomain', 'magiceden.io']);
    // A homoglyph AND one edit: xn--mgicedem-16g decodes to m + Cyrillic a + gicedem. Its skeleton (rnagicedern) is one
    // edit from magiceden's own skeleton (rnagiceden) — and from nothing else — so only that comparison reaches it.
    expect(decodedForDisplay('xn--mgicedem-16g.vercel.app')).toBe('m\u0430gicedem.vercel.app');
    expect(imitates('xn--mgicedem-16g.vercel.app')).toEqual(['subdomain', 'magiceden.io']);
    // Rule 1 still wins first: a listed domain's own subdomains stay verified.
    expect(kind('app.noc-tura.io')).toBe('verified');
    expect(kind('www.jup.ag')).toBe('verified');
    expect(kind('phantom.phantom.app')).toBe('verified');
    // Stated, accepted false positive (spec §2.5): a two-label public suffix puts the brand left of the last two labels.
    expect(imitates('orca.co.uk')).toEqual(['subdomain', 'orca.so']);
  });

  it('rule e is whole-label: a brand inside a longer label, or past the 1-edit reach, stays unknown', () => {
    for (const h of ['example.vercel.app', 'mydrift-notes.com', 'mydrift-notes.vercel.app', 'drift-notes.vercel.app', 'phantomwallet.vercel.app', 'jupi.netlify.app', 'www.example.com', 'app.dapp.test']) {
      expect([h, classify(h)]).toEqual([h, {kind: 'unknown', international: false}]);
    }
    // The label LEFT of the TLD is rule b's, not rule e's: a 2-label host never reaches rule e.
    expect(kind('orchard.so')).toBe('unknown');
    expect(classify('xn--bcher-kva.vercel.app')).toEqual({kind: 'unknown', international: true});
  });

  it('a very long label is answered at once (unknown): rules b and e compare lengths before any edit distance', () => {
    const long = 'a'.repeat(10_000);
    const t0 = performance.now();
    expect(classify(`${long}.${long}.example.com`)).toEqual({kind: 'unknown', international: false});
    expect(classify(`${long}.com`)).toEqual({kind: 'unknown', international: false});
    expect(performance.now() - t0).toBeLessThan(50);
  });

  it('unknown: everything else — including jupp.ag (the 4-character floor)', () => {
    for (const h of ['example.com', 'solana-mint-hub.xyz', 'jupiter.com', 'orchard.so', 'notcoin.io', 'jupp.ag', 'dapp.test']) {
      expect([h, classify(h)]).toEqual([h, {kind: 'unknown', international: false}]);
    }
    expect(siteName('solana-mint-hub.xyz')).toBe('solana-mint-hub');
  });

  it('an unknown host with an xn-- label is international (Q18); an invalid punycode label is unknown, no throw', () => {
    expect(classify('xn--bcher-kva.example')).toEqual({kind: 'unknown', international: true});
    expect(() => classify('xn--a!b.example')).not.toThrow();
    expect(classify('xn--a!b.example')).toEqual({kind: 'unknown', international: true});
  });

  it('a lookalike is named by its own second-level label, never the brand it imitates (C7, §9)', () => {
    expect(siteName('tensr.trade')).toBe('tensr');
    expect(siteName('xn--phntom-4nf.app')).toBe('xn--phntom-4nf');
  });

  it('display strips every bidi and format control from the decoded form (§2.5 Display)', () => {
    // A format character never survives into what is shown, nor into a skeleton (a ZWJ or an RLO cannot split a lookalike).
    expect(decodedForDisplay('xn--phntom-4nf.app')).toBe('ph\u0430ntom.app');
    // xn--phntom-4nf8718cpia encodes "ph" RLO "\u0430" ZWJ "ntom": shown without the two, still the phantom lookalike.
    expect(decodedForDisplay('xn--phntom-4nf8718cpia.app')).toBe('ph\u0430ntom.app');
    expect(imitates('xn--phntom-4nf8718cpia.app')).toEqual(['idn', 'phantom.app']);
    expect(skel('ph\u202E\u0430\u200Dntom.app')).toBe(skel('phantom.app'));
    expect(/[\u202A-\u202E\u2066-\u2069\u200B-\u200F]/u.test(decodedForDisplay('xn--phntom-4nf.app'))).toBe(false);
  });

  it('skel and the edit distance', () => {
    expect(skel('ph\u0430ntom.app')).toBe(skel('phantom.app'));
    expect(skel('xn--phntom-4nf.app')).toBe('phantorn.app');
    expect(editDistance('tensr', 'tensor')).toBe(1);
    expect(editDistance('drfit', 'drift')).toBe(1);
    expect(editDistance('rnagiceden', 'magiceden')).toBe(2);
    expect(editDistance('', 'abc')).toBe(3);
  });
});
