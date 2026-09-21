/**
 * The host and the response headers it serves, in one place, because they exist in several:
 * the nginx config that is deployed, the Vite dev proxy that impersonates the production
 * Origin, and the tests that check both. Two copies of a policy is one policy and one
 * decoration, and the decoration is always the one that stays right.
 *
 * `scripts/gen-nginx-conf.mjs` renders these into deploy/nginx/<host>.conf, and a test
 * re-renders and compares, so an edit to the served file that skipped this one fails.
 *
 * Every entry carries why. Several of these headers have a stricter setting that we did not
 * take, and the reason for stopping where we did is the part worth keeping.
 */

/**
 * The public host. `app.` rather than `wallet.`, decided 2026-09-21 and worth the note:
 *
 *  - this page is not a wallet. It holds no key, creates none, and asks one you already
 *    control to sign. A hostname that promises custody it does not offer is a lie told
 *    before the page has loaded.
 *  - `walletapp.noc-tura.io` already exists — a devnet sandbox on Netlify. `wallet.` beside
 *    `walletapp.` is a pair no user can be expected to tell apart, and on a wallet brand a
 *    pair of confusable hostnames is a gift to whoever clones one of them.
 *  - it keeps `wallet.` free for the thing that will genuinely be a wallet: the browser
 *    extension, or the S2 vault origin. Spending the name on this page spends it on the
 *    wrong product.
 *
 * Changing it later costs a redirect, a second certificate, a second Origin allowlist entry
 * at the coordinator and every link already published. Nothing is deployed yet, which is why
 * this was decided now.
 */
export const PROD_HOST = 'app.noc-tura.io';
export const PROD_ORIGIN = `https://${PROD_HOST}`;

/**
 * CSP, as directives rather than a string, so tests can assert one of them without parsing.
 *
 * Everything unlisted inherits `default-src 'none'` — deliberately, and that covers more
 * than it looks: no fonts (the built CSS has no @font-face and no url(), measured), no
 * workers, no media, no frames, no manifest, no objects. Adding a directive here LOOSENS
 * the policy; it never tightens it.
 */
export const CSP_DIRECTIVES = {
  'default-src': "'none'",

  // One module script, emitted by Vite with a src attribute. The build has no inline
  // script and no eval — scripts/check-csp.mjs refuses to pass a build that gains one.
  'script-src': "'self'",

  // One stylesheet, ours. This is the directive that cost the Mobile Wallet Adapter its
  // place in the bundle: its modal built <style> elements at run time.
  'style-src': "'self'",

  // data: is not decoration. The Wallet Standard requires a wallet's icon to be a data
  // URI (`data:image/svg+xml;base64,…`), so Phantom's and Solflare's icons in the connect
  // dialog are data URIs and nothing else. Without this the wallet list renders blank.
  'img-src': "'self' data:",

  // 'self' alone, because /api/v1 and /rpc are served from this origin by the proxy below.
  // Measured rather than assumed: every fetch in the app goes through API_BASE = '/api/v1',
  // and the RPC endpoint is `${window.location.origin}/rpc`. No WebSocket — balances are
  // polled precisely so no wss:// endpoint has to exist (src/portfolio/useBalances.ts).
  'connect-src': "'self'",

  // A <base> tag injected by an XSS can redirect every relative URL on the page, including
  // the module script. There is no <base> in our HTML and there is no reason to allow one.
  'base-uri': "'none'",

  // The page has no form. An injected one that posts elsewhere is a phishing primitive on a
  // wallet surface, so the browser refuses the submission rather than the reviewer catching it.
  'form-action': "'none'",

  // Clickjacking: an invisible frame over a real signing surface. X-Frame-Options below says
  // the same thing for browsers that predate this directive.
  'frame-ancestors': "'none'",

  'upgrade-insecure-requests': '',
};

export function csp(directives = CSP_DIRECTIVES) {
  return Object.entries(directives)
    .map(([name, value]) => (value === '' ? name : `${name} ${value}`))
    .join('; ');
}

export const SECURITY_HEADERS = [
  {
    name: 'Content-Security-Policy',
    value: csp(),
    why: 'the policy above; the build gate proves the bundle needs no exception to it',
  },
  {
    name: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains',
    why:
      'Two years, subdomains included. NOT preload, and that is a decision rather than an ' +
      'omission: preload is submitted for the apex, applies to every *.noc-tura.io at once, ' +
      'and removal takes months. It requires every subdomain to be HTTPS-only first — api., ' +
      'dao., walletapp. — so it is an apex-level step to take deliberately, not a header to ' +
      'add here. Until then this host is protected and the preload list is not involved. ' +
      'Note what HSTS is NOT: the app pins certificates, a browser cannot. HSTS and a CAA ' +
      'record are what the web has instead, and they are weaker. Do not claim otherwise.',
  },
  {
    name: 'X-Content-Type-Options',
    value: 'nosniff',
    why: 'stops a response being re-interpreted as script because its bytes looked like some',
  },
  {
    name: 'Referrer-Policy',
    value: 'no-referrer',
    why:
      'nothing outbound should carry where the user was. On a wallet the path can name an ' +
      'address, and the referral link carries one in the query string.',
  },
  {
    name: 'X-Frame-Options',
    value: 'DENY',
    why: "frame-ancestors 'none' for browsers that do not implement it",
  },
  {
    name: 'Cross-Origin-Opener-Policy',
    value: 'same-origin-allow-popups',
    why:
      'severs the opener relationship with anything cross-origin, but keeps popups WE open ' +
      "usable. Not plain 'same-origin': some wallets complete a connection through a popup " +
      'that talks back through window.opener, and breaking that would look like our bug.',
  },
  {
    name: 'Cross-Origin-Resource-Policy',
    value: 'same-origin',
    why: 'our assets are not for other sites to embed',
  },
  {
    name: 'Permissions-Policy',
    value: [
      'accelerometer=()',
      'autoplay=()',
      'camera=()',
      'display-capture=()',
      'encrypted-media=()',
      'geolocation=()',
      'gyroscope=()',
      'magnetometer=()',
      'microphone=()',
      'midi=()',
      'payment=()',
      'publickey-credentials-get=()',
      'screen-wake-lock=()',
      'serial=()',
      'usb=()',
      'xr-spatial-tracking=()',
    ].join(', '),
    why:
      'deny everything the app does not use. Two are worth naming: geolocation, because the ' +
      'compliance gate is decided server-side from the IP and the page must never be able to ' +
      'ask the browser instead; and publickey-credentials-get, because the S2 passkey vault ' +
      'would need it — denying it now means enabling it later is a visible change in a diff.',
  },
];

/**
 * Cross-Origin-Embedder-Policy is deliberately absent. require-corp needs every subresource
 * to opt in, buys nothing without SharedArrayBuffer, and would matter only if WASM proving
 * arrives — which §6.4 already marks as its own decision.
 */
export const OMITTED = [
  {
    name: 'Cross-Origin-Embedder-Policy',
    why: 'no SharedArrayBuffer and no cross-origin subresources; revisit only with WASM proving',
  },
];

/**
 * index.html and the manifest must revalidate or a release does not reach anyone, and the
 * digest we publish stops describing what is served. Everything under /assets/ carries a
 * content hash in its name, so it can be cached forever by definition.
 */
export const CACHE_RULES = [
  {match: '/assets/', value: 'public, max-age=31536000, immutable'},
  {match: '/index.html', value: 'no-cache'},
  {match: '/build-manifest.json', value: 'no-cache'},
];
