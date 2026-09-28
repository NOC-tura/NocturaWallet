// The one source for both browsers' manifests, as web/deploy/security-headers.mjs is for
// nginx: every permission and host is here once, with the reason a store reviewer and a
// user are owed. The permissions gate (scripts/check-permissions.mjs) compares the built
// manifests against these lists, so a permission cannot arrive by a hand edit.

export const PERMISSIONS = [
  {value: 'storage', reason: 'The encrypted vault (storage.local) and the unlocked per-account signing keys (storage.session, memory only).'},
  {value: 'alarms', reason: 'Auto-lock: the vault locks itself after the chosen idle time, default five minutes.'},
];

export const HOST_PERMISSIONS = [
  {value: 'https://api.noc-tura.io/*', reason: 'Reads through the coordinator RPC proxy, prices, the jurisdiction check and broadcast — readable without CORS.'},
  {value: 'https://wallet.noc-tura.io/*', reason: 'The passkey relying-party ID: an extension may claim an RP ID only for a host it has permission for.'},
];

export const EXTENSION_CSP = "script-src 'self'; object-src 'self'";

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
