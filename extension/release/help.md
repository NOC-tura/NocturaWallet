# Help & support

Answers to common questions about the Noctura browser extension for Chrome, a Solana wallet. The names in quotes are the words you see in the extension. For anything not answered here, write to privacy@noc-tura.io.

## Your recovery phrase

Your recovery phrase is the 12 or 24 words shown when you create a wallet. It is the only backup of your wallet: anyone who has the words can spend everything in it, and Noctura never receives them, so Noctura cannot give them back to you.

- Write the words on paper, in order, and keep them off this computer.
- To see them again: Settings → "Recovery phrase" opens "Show your recovery phrase" in a new tab. Enter your password first; nothing is shown until you press and hold.
- To check your written copy: Security center → "Verify recovery phrase".
- If you forget your password: on the unlock screen, choose "Forgot password?" and enter your recovery phrase, then choose a new password. A passkey is not carried over; you can add one again later.
- To use your wallet in another browser: install Noctura there, choose "I have a wallet" and enter the phrase.
- Never type your recovery phrase into a website, a message or a form. Noctura never asks for it.

## The anti-phishing phrase

A website can draw a fake "Noctura" window inside its own page and ask for your password or an approval. The anti-phishing phrase is a few words you choose: "Noctura shows it on its unlock and approval windows. A window without it is not Noctura's." A website cannot read it.

- Set it when you create or import a wallet ("Set an anti-phishing phrase" — optional, you can skip it), or later in Security center → "Anti-phishing phrase". "A change or a removal asks for your password in a new tab."
- It shows on the unlock screen before you type your password, on the locked screen of the toolbar window, on every approval window (connecting a site, signing a message, approving a transaction) and on the tab where you confirm with your password.
- Two things it does not protect against: "Never type it into a website. Anyone who uses this browser profile can see it." A site that asks you to type or "confirm" your phrase is not Noctura. And the phrase is shown before you unlock, so anyone using this browser profile can see it — it tells Noctura's windows apart from a website's, not you from another person.
- If a window says "Anti-phishing phrase could not be read — don't type your password until it shows", do what it says: close the window and open Noctura again from its icon in your browser's toolbar.

## A damaged wallet

Noctura keeps your wallet in this browser's storage. If that stored data cannot be opened, the unlock screen shows one of two screens instead of the password field.

"Update Noctura to open this wallet" — "This version of Noctura can't open this wallet's data." The data may come from a newer version of Noctura. "Update Noctura (in Chrome: Extensions → Update)." If it is up to date, the data may have been changed. Nothing is removed, and this screen offers no way to remove the wallet: a newer version may still open it.

"Wallet data is damaged" — "This browser's copy of your wallet can't be read by this or any later version of Noctura." Your funds are on Solana: after you remove this copy, only your recovery phrase reaches them. Make sure you have the phrase first. "Remove damaged wallet" removes the wallet from this browser only, after you type DELETE and confirm; it waits while a transaction from the wallet is still pending.

On both screens, "Save the damaged data" downloads the stored data exactly as this browser holds it, before anything is removed. If it contains your encrypted wallet, anyone with the file and your password could try to open it, so keep the file to yourself and share it only with someone you trust to help you.

A third case: if your password is accepted but Noctura then says "This wallet's stored data is damaged.", your funds stay on Solana and your recovery phrase still controls them. To use them here, remove Noctura from this browser, install it again and import the phrase.

## Why does my passkey show as "wallet.noc-tura.io"?

If your passkeys sync, your passkey provider (for example Google Password Manager) stores the passkey; Noctura never receives it. In your passkey manager the passkey is listed under the name wallet.noc-tura.io.

The sites you connected, your address book and your anti-phishing phrase are stored only in this browser. Nothing is served at wallet.noc-tura.io and the extension never connects to it; the name exists only so that passkeys are bound to a name no website can use.

A passkey is a convenience: your password always unlocks the wallet too. To stop using it, open Settings → "Passkey" and choose "Remove passkey". It is still saved in your passkey manager (Google, Apple or your password manager). Delete it there if you no longer need it.

## Why is a transaction blocked?

Every transaction a site asks you to approve is simulated first, and the approval window shows what it would change. Some transactions are blocked until you confirm them on purpose; some cannot be approved at all.

- "Critical · Blocked transaction" — the transaction changes who controls one of your accounts (assigning your wallet account to a program, or giving an authority over an account you own to another address), or a step of a batch depends on an earlier step and could not be checked on its own. "Critical · Unlimited spend approval" and "Critical · Large spend approval" — the transaction lets another address move all, or nearly all, of a token you hold until you revoke it. Approve stays off until you type the word the window shows (ASSIGN, AUTHORITY, UNCHECKED, UNLIMITED, ALLOWANCE or the token's symbol); then "Approve anyway" (or "Approve unlimited") asks you to confirm with your password or passkey: "Re-auth required to override a blocked transaction." "Approving asks you to confirm with your password (or passkey) — you'll start it from the Noctura icon." If you did not expect any of this, reject the request.
- "Presale purchase blocked" — the transaction buys NOC in the presale and your region does not allow it, or the region check did not succeed. "Only Reject is available · no override".
- "Request blocked automatically" — a site you connected sent a transaction from a different origin than the one you connected. Noctura rejects it without showing Approve.
- "Couldn't simulate" or "Could not reach the Noctura server." — the simulation failed or the coordinator did not answer; only Reject is available. Ask the site to try again later. "This request has expired. Ask the site to try again."
- A site you blocked with "Block this site" or "Reject and report" gets every request declined at once, without a window. To allow it again: Settings → "Connected dApps" → "Blocked sites" → "Unblock".
- "Too many requests from sites in the last few minutes — some were declined without asking you." — sites sent more requests in a few minutes than Noctura accepts, and the rest were declined; ask the site to try again later.

## What does the coordinator see?

The extension reads Solana, simulates and submits transactions through the Noctura coordinator. In the privacy policy's own words:

- The extension itself connects to one server only: api.noc-tura.io, the Noctura coordinator.
- Every request to the coordinator carries your IP address and the standard headers your browser sends.
- The coordinator receives the public address of the account you are viewing and of the first ten accounts in your account list, including accounts you have not used, to read their balances, and the transaction history of the account you are viewing.
- When you import a recovery phrase, the coordinator receives the public addresses of up to six accounts derived from it, to find the ones that hold funds.
- Before you sign, the full contents of the transaction are sent to the coordinator to simulate it: your own sends, and every transaction a site asks you to sign, again every 30 seconds while the approval window shows it, and every 5 seconds after a simulation that fails. When you review one of your sends, the coordinator is also asked, before the simulation, about the address you are sending to: what kind of account it is and, for a token, whether that address already has an account for that token.
- Every transaction the wallet submits is sent to the coordinator, which broadcasts it to Solana: your own sends, and the transactions a site asks the wallet to sign and send. A transaction a site asks only to sign is returned to that site.
- The wallet reads prices for SOL, USDC and USDT, and the public presale statistics to price NOC; these requests carry no wallet data.
- Only when a site asks you to sign a transaction that contains a Noctura presale purchase does the wallet ask the coordinator which country your IP address is in: on each simulation of that transaction and again when you approve it. The wallet also reads the list of restricted countries, keeping a copy for up to 10 minutes.
- Your recovery phrase, private keys, password and anti-phishing phrase never leave this device through the extension.

What the coordinator keeps, for how long, and who else receives it is in the Privacy Policy: https://noc-tura.io/extension/privacy. Solana itself is public: anyone can read an account's balance and the transactions it took part in.

## Contact

Questions, problems, or a request to delete data the coordinator holds about you: privacy@noc-tura.io. Never send your recovery phrase or your password — Noctura never asks for them.
