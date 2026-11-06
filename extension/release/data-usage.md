# Chrome Web Store data-usage form — Noctura

The answers to the dashboard's data-usage questions for the first release (B1e spec §6.3, owner decision E13), for the store build (owner decision E2). The first three columns are §6.3's table as the spec writes it; the fourth names the sentences of the Privacy Policy (`privacySentences.mjs`, published in `privacy.md`) that say the same to users. Questions: privacy@noc-tura.io.

## The form

| CWS category | answer | why (code) | Privacy Policy sentences |
|---|---|---|---|
| Personally identifiable information | **No** | nothing names a person; addresses are disclosed under Financial | P3, P4 |
| Health information | **No** | — | — |
| Financial and payment information | **Yes** | wallet addresses, transaction contents (simulation), signed transactions (broadcast): P3–P6 | P3, P4, P5, P6 |
| Authentication information | **No** | password, seed and keys stay in the vault page / session (vault isolation); the passkey ceremony is the browser's (P11, P12) | P11, P12 |
| Personal communications | **No** | messages to sign are signed locally (P10) | P10 |
| Location | **Yes** | the IP address with every request (P2); a country derived from it for a site's presale purchase (P8) | P2, P8, R12 |
| Web history | **No** | connected-site hostnames stay in `v1_dapp_grants` (P13) | P13, P14 |
| User activity | **No** | no clicks, keystrokes or analytics leave (P15) | P15 |
| Website content | **Yes** (E13) | the transaction bytes a site hands the wallet go to simulation, and to broadcast for sign-and-send (P5, P6) | P5, P6 |

## Certifications

Each is ticked: §6.3 allowed it only after ICO's §6.2 answer confirmed it for the coordinator, and that answer (received 2026-11-01, `ico-retention.md`, part 5) is Privacy Policy sentence R20: "The coordinator uses this data only to answer requests, to protect the service from abuse (rate limits and CrowdSec) and to diagnose faults. It is not sold or shared for any other purpose."

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases — confirmed by R20. The two recipients outside the coordinator are within those uses: Helius receives RPC requests and signed transactions to answer and broadcast them (R17, R18), and CrowdSec's central service receives an alerting IP address for abuse protection (R15).
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose — confirmed by R20 (answering requests, abuse protection, fault diagnosis).
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes — confirmed by R20: those three uses are the only ones; ICO's answer does not name creditworthiness or lending separately.

## Remote code

**None.** The extension pages' content security policy is `script-src 'self'` with no `wasm-unsafe-eval` (`EXTENSION_CSP`, pinned by `scripts/check-permissions.mjs` `REQUIRED_CSP`); every script is in the package.

## Privacy policy

https://noc-tura.io/extension/privacy

## Not in the Chrome manifest

`data_collection_permissions` is AMO's (Firefox, `browser_specific_settings.gecko`); the Chrome manifest carries none (spec §6.3, Minor 11, §8).
