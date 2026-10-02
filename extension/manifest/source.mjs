// The one source for both browsers' manifests, as web/deploy/security-headers.mjs is for
// nginx: every permission and host is here once, with the reason a store reviewer and a
// user are owed. The permissions gate (scripts/check-permissions.mjs) compares the built
// manifests against these lists, so a permission cannot arrive by a hand edit.

export const PERMISSIONS = [
  {value: 'storage', reason: 'The encrypted vault (the local storage area) and the unlocked per-account signing keys (the session storage area, memory only).'},
  {value: 'alarms', reason: 'Auto-lock: the vault locks itself after the chosen idle time, default five minutes.'},
];

export const HOST_PERMISSIONS = [
  {value: 'https://api.noc-tura.io/*', reason: 'Reads through the coordinator RPC proxy, prices, the jurisdiction check and broadcast — readable without CORS.'},
  {value: 'https://wallet.noc-tura.io/*', reason: 'The passkey relying-party ID: an extension may claim an RP ID only for a host it has permission for.'},
];

// connect-src is the one runtime backstop for extension/scripts/check-rpc-methods.mjs's text-based
// checks: even a bypass that check misses cannot reach the network from an extension page or the
// background, because Chrome/Firefox enforce this at the fetch/XHR/WebSocket layer regardless of
// what the JS source says. Exactly the one host anything here ever fetches (the coordinator proxy
// — RPC reads, JSON reads, the broadcast route; see extension/src/background/deps.ts). No 'self':
// nothing fetches the extension's own origin (the kdf worker is loaded as a script, not fetched).
// No wallet.noc-tura.io: that host is the passkey relying-party ID only — a WebAuthn ceremony is
// not a fetch and is not governed by connect-src — never a fetch target.
//
// Controller hardening (2026-10-01): the browser keeps CSS off the vault page (the page holding the
// seed and the password). A stylesheet is an exfiltration surface there — an attribute selector on an
// input's value plus a url() reads the field one character at a time — and three review rounds of the
// text gates (scripts/check-vault-isolation.mjs) each found a new spelling that reached the built page.
// So: `style-src 'self'` (no inline <style>, no style="", no remote sheet; a CSSOM write such as React's
// style={{}} is not inline CSS and stays allowed), `img-src 'self' data:` and `font-src 'self'` (a
// url() can load nothing from elsewhere), `default-src 'self'` for every directive not named, and
// `base-uri`/`form-action`/`frame-ancestors 'none'` (no <base> rewrite, no form submission anywhere —
// every form is handled in script — and no page of ours can be framed). The text gates stay as the
// backstop. Never loosen this with 'unsafe-inline' or a wildcard: check-permissions.mjs pins every
// directive independently of this line.
export const EXTENSION_CSP =
  "default-src 'self'; script-src 'self'; object-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; " +
  "connect-src https://api.noc-tura.io; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

// The minimum browsers (plan: Chrome 122, Firefox 150). The permissions gate compares the built
// manifests against these, so a lowered floor cannot arrive by a hand edit either.
export const MIN_CHROME_VERSION = '122';
export const MIN_FIREFOX_VERSION = '150.0';

const VERSION = '0.1.0';

function base() {
  return {
    manifest_version: 3,
    name: 'Noctura',
    version: VERSION,
    description: 'Noctura wallet for Solana.',
    permissions: PERMISSIONS.map(p => p.value),
    host_permissions: HOST_PERMISSIONS.map(p => p.value),
    content_security_policy: {extension_pages: EXTENSION_CSP},
    action: {default_popup: 'popup.html', default_title: 'Noctura'},
  };
}

/** @param {'chrome' | 'firefox'} browser */
export function render(browser) {
  if (browser === 'chrome') {
    return {...base(), minimum_chrome_version: MIN_CHROME_VERSION, background: {service_worker: 'background.js', type: 'module'}};
  }
  if (browser === 'firefox') {
    return {
      ...base(),
      background: {scripts: ['background.js'], type: 'module'},
      browser_specific_settings: {
        gecko: {
          id: 'wallet@noc-tura.io',
          strict_min_version: MIN_FIREFOX_VERSION,
          // Truthful, per spec §5: public addresses and transactions go to the coordinator.
          // The exact category list is re-checked against AMO's current taxonomy in B1e,
          // before the first submission.
          data_collection_permissions: {required: ['financialAndPaymentInfo']},
        },
      },
    };
  }
  throw new Error(`unknown browser ${browser}`);
}
