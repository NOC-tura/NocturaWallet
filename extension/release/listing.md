# Chrome Web Store listing — Noctura

The texts to paste into the Chrome Web Store developer dashboard for the first release (B1e spec §6.4, §7 step 3). Each permission's justification is the reason `manifest/source.mjs` gives (`PERMISSIONS`, `HOST_PERMISSIONS`, `CONTENT_SCRIPTS.reason`); the data-usage answers are in `data-usage.md`. The extension is a transparent Solana wallet: nothing here claims more than the build keeps.

## Name

Noctura

## Summary (short description)

A non-custodial Solana wallet: hold, send and receive SOL and tokens, and approve requests from Solana sites.

## Category

The owner picks it at submission.

## Single purpose

A Solana wallet: hold, send and receive SOL and tokens, and approve requests from Solana sites.

## Detailed description

Noctura is a Solana wallet for your browser. Create a wallet or import one with a 12- or 24-word recovery phrase, hold SOL and tokens, send and receive them, and approve requests from Solana sites.

Your keys stay on this device. The recovery phrase and keys are stored in this browser, encrypted with your password; Noctura never receives them.

What it does:

- Several accounts in one wallet, an address book, and each account's activity with a link to the Solscan explorer.
- Sites find the wallet through Wallet Standard. Every connection, message signature and transaction asks for your approval in its own window.
- Every transaction is simulated before you approve it; the window shows the balance changes and the decoded instructions.
- Unlimited spend approvals, a change of who controls one of your accounts, and steps that cannot be checked on their own are blocked until you type a confirmation word and confirm with your password or passkey.
- Lookalike domains are flagged, and a transaction from a different origin than the connected site is rejected automatically.
- An anti-phishing phrase you choose appears on Noctura's unlock and approval windows, so a fake window drawn by a website can be told apart.
- The wallet locks itself after an idle time you choose (1 to 60 minutes, five by default), and can unlock with a passkey as well as your password.

Solana is a public blockchain: anyone can read an account's balance and the transactions it took part in. Noctura does not hide them.

The extension reads Solana, simulates and submits your transactions through the Noctura coordinator, api.noc-tura.io. What the coordinator receives and keeps is in the privacy policy: https://noc-tura.io/extension/privacy. Questions: privacy@noc-tura.io.

## Permission justifications

### `storage`

The encrypted vault (the local storage area) and the unlocked per-account signing keys (the session storage area, memory only).

### `alarms`

Auto-lock: the vault locks itself after the chosen idle time, default five minutes.

### `https://api.noc-tura.io/*`

Reads through the coordinator RPC proxy, prices, the jurisdiction check and broadcast — readable without CORS.

### `https://wallet.noc-tura.io/*`

The passkey relying-party ID: an extension may claim an RP ID only for a host it has permission for.

No page is served at this host and the extension never connects to it (its content security policy allows connections to one other host only). The permission exists only so the passkey is bound to a name no website can use; passkeys appear under this name in the user's passkey manager.

### Content scripts (`<all_urls>`)

Sites find the wallet through Wallet Standard, which must be present on every page; the scripts read nothing from the page and send nothing unless the site asks the wallet.

## Remote code

**No.** Every script the extension runs is in its package. Its pages' content security policy is `script-src 'self'`, with no `unsafe-eval` and no `wasm-unsafe-eval`, so no page of the extension can load or evaluate code from anywhere else; the permissions gate (`scripts/check-permissions.mjs`, `REQUIRED_CSP`) fails the build if that changes.

## Data usage

The form's answers and certifications: `data-usage.md` (B1e spec §6.3). Privacy policy URL: https://noc-tura.io/extension/privacy
