import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';

/**
 * Spec 6.2: everything is served from our own origin. A stray CDN link is both a
 * privacy leak and an unreviewed path into the signing surface, and it is invisible in
 * review.
 *
 * Excluded from the default `npm test` set and run only by `verify`, after
 * `rm -rf dist && build`: in the default set it would fail every run that had not
 * built, and against a stale dist/ it would report on yesterday's bundle.
 *
 * Every entry below carries the reason it is acceptable. An allowlist without reasons
 * is how this gate rots into decoration — the next person adds a line to make it green.
 *
 * There is still no LIVE REQUEST entry: every host here is either a string the bundle
 * carries and no code fetches, or — in exactly one case — the target of a link a person
 * has to click. The two that did reach the network — fonts.googleapis
 * and fonts.gstatic, injected by the Mobile Wallet Adapter's embedded modal — left with the
 * adapter itself (src/wallet/mobileAdapterStub.ts), and `localhost`, `feross.org` and
 * `solanamobile.com` left with it.
 */
const ALLOWED: Record<string, string> = {
  'noc-tura.io': 'ours — the referral link the website records',
  'www.w3.org': "inert: React's XML namespace table (xmlns attribute values)",
  'github.com': 'inert: text inside an error message about getRandomValues',
  'reactjs.org': "inert: React's error-decoder URL, printed in messages",
  'api.mainnet-beta.solana.com': 'inert: web3.js clusterApiUrl default; we pass our own endpoint',
  'explorer.solana.com':
    'NAVIGATION, user-initiated, and the only outbound link on the page: each purchase row links its signature to the explorer so a buyer can check our claim against a source we do not control. The page fetches nothing from it — no script, no image, no request of any kind — and Referrer-Policy: no-referrer means it is told nothing about where the click came from. §6.10 says the site sends you nowhere, and that rule exists against being sent somewhere to INSTALL something, which is the shape of a phishing page; this is the opposite of that.',
};

function hostsInBundle(): Set<string> {
  const files = [
    ...readdirSync('dist/assets').map(f => join('dist/assets', f)),
    'dist/index.html',
  ].filter(f => /\.(js|css|html)$/.test(f));

  const hosts = new Set<string>();
  for (const file of files) {
    for (const m of readFileSync(file, 'utf8').matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
      hosts.add((m[1] as string).toLowerCase());
    }
  }
  return hosts;
}

it('the built bundle references no host outside the documented allowlist', () => {
  expect(existsSync('dist')).toBe(true);
  const offenders = [...hostsInBundle()].filter(h => !(h in ALLOWED));
  expect(offenders).toEqual([]);
});

it('no allowlist entry outlives the host it excuses', () => {
  // Without this the list only ever grows: a host leaves the bundle, its line stays, and
  // years later it silently pre-approves the same host arriving again for a new reason.
  // This is what let fonts.googleapis.com read as a settled decision instead of an open one.
  expect(existsSync('dist')).toBe(true);
  const present = hostsInBundle();
  const stale = Object.keys(ALLOWED).filter(h => !present.has(h));
  expect(stale).toEqual([]);
});

it('every allowlist entry carries a reason (the gate guarding itself)', () => {
  for (const [host, reason] of Object.entries(ALLOWED)) {
    expect(reason.length, `${host} has no reason`).toBeGreaterThan(20);
  }
});
