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
 * Adding a host means writing why, and the two marked LIVE REQUEST are the only ones
 * that reach the network.
 */
const ALLOWED: Record<string, string> = {
  'noc-tura.io': 'ours — the referral link the website records',
  'www.w3.org': 'inert: React\'s XML namespace table (xmlns attribute values)',
  'feross.org': 'inert: the BSD licence header of the buffer package',
  'github.com': 'inert: text inside an error message about getRandomValues',
  'reactjs.org': 'inert: React\'s error-decoder URL, printed in messages',
  'localhost': 'inert: a default ws:// endpoint in a constructor we never call',
  'api.mainnet-beta.solana.com': 'inert: web3.js clusterApiUrl default; we pass our own endpoint',
  'solanamobile.com':
    'navigation, user-initiated: the Mobile Wallet Adapter modal sets window.location on a click',
  'fonts.googleapis.com':
    'LIVE REQUEST, known and unfixed: @solana-mobile/wallet-adapter-mobile injects a <link> when its embedded modal is CONSTRUCTED. Desktop never reaches it; a mobile user who opens that flow hands Google their IP. Decision recorded in src/wallet/WalletProviders.tsx — patch the dependency, drop MWA, or say so on the privacy page.',
  'fonts.gstatic.com': 'LIVE REQUEST, same injection as fonts.googleapis.com above',
};

it('the built bundle references no host outside the documented allowlist', () => {
  expect(existsSync('dist')).toBe(true);
  const files = [
    ...readdirSync('dist/assets').map(f => join('dist/assets', f)),
    'dist/index.html',
  ].filter(f => /\.(js|css|html)$/.test(f));

  const offenders = new Map<string, string>();
  for (const file of files) {
    for (const m of readFileSync(file, 'utf8').matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
      const host = (m[1] as string).toLowerCase();
      if (!(host in ALLOWED)) offenders.set(host, file);
    }
  }
  expect([...offenders.entries()]).toEqual([]);
});

it('every allowlist entry carries a reason (the gate guarding itself)', () => {
  for (const [host, reason] of Object.entries(ALLOWED)) {
    expect(reason.length, `${host} has no reason`).toBeGreaterThan(20);
  }
});
