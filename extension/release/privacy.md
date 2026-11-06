# Privacy Policy

This policy covers the Noctura browser extension for Chrome, a Solana wallet. It says what the
extension sends, to whom, and what the Noctura coordinator keeps. Solana is a public blockchain: anyone can read an
account's balance and the transactions it took part in.

## What the extension sends

The extension itself connects to one server only: api.noc-tura.io, the Noctura coordinator.

Every request to the coordinator carries your IP address and the standard headers your browser sends.

The coordinator receives the public address of the account you are viewing and of the first ten accounts in your account list, including accounts you have not used, to read their balances, and the transaction history of the account you are viewing.

When you import a recovery phrase, the coordinator receives the public addresses of up to six accounts derived from it, to find the ones that hold funds.

Before you sign, the full contents of the transaction are sent to the coordinator to simulate it: your own sends, and every transaction a site asks you to sign, again every 30 seconds while the approval window shows it, and every 5 seconds after a simulation that fails. When you review one of your sends, the coordinator is also asked, before the simulation, about the address you are sending to: what kind of account it is and, for a token, whether that address already has an account for that token.

Every transaction the wallet submits is sent to the coordinator, which broadcasts it to Solana: your own sends, and the transactions a site asks the wallet to sign and send. A transaction a site asks only to sign is returned to that site.

The wallet reads prices for SOL, USDC and USDT, and the public presale statistics to price NOC; these requests carry no wallet data.

Only when a site asks you to sign a transaction that contains a Noctura presale purchase does the wallet ask the coordinator which country your IP address is in: on each simulation of that transaction and again when you approve it. The wallet also reads the list of restricted countries, keeping a copy for up to 10 minutes.

When you open a transaction in the Solscan explorer, Solscan receives that transaction's signature, your IP address and your browser's standard headers; no referrer is sent.

When you open the Terms, Privacy Policy or Help page from the extension, noc-tura.io receives your IP address and your browser's standard headers, as any website you open does; no referrer is sent.

## What the extension does not send

Messages a site asks you to sign are signed on this device and are not sent anywhere by the wallet.

Your recovery phrase, private keys, password and anti-phishing phrase never leave this device through the extension.

If your passkeys sync, your passkey provider (for example Google Password Manager) stores the passkey; Noctura never receives it. In your passkey manager the passkey is listed under the name wallet.noc-tura.io.

The sites you connected, your address book and your anti-phishing phrase are stored only in this browser. Nothing is served at wallet.noc-tura.io and the extension never connects to it; the name exists only so that passkeys are bound to a name no website can use.

The extension reads nothing from the pages you visit; a site's own requests to the wallet are the only page data it handles.

The extension sends no analytics, telemetry or crash reports.

## What the coordinator keeps, for how long, and who else receives it

### The web server

The coordinator's web server writes every request to its access log: your IP address, the time, the method, the path including its query string (for example the token identifiers in a price request), the response status and size, and the Referer and User-Agent headers. It does not log request bodies, the Origin header or any other header.

The extension's requests carry no Referer header; their User-Agent is your browser's.

The access logs are rotated daily and deleted automatically: 14 rotated files are kept, so a request stays in them for about 15 days at most.

### The application log

The coordinator's application log records nothing about an RPC request it answers. When it refuses one, it records the reason and the name of the RPC method; when the Solana network provider cannot be reached, the method name. It never records the request's parameters, your IP address or your headers.

For each transaction submitted for broadcast, the application log records the transaction's signature and the HTTP status of the outcome, not the transaction itself, your IP address or your headers.

Price, presale statistics, region and restricted-country list requests are not recorded in the application log; only server errors are, with no data from the request.

On any route, an Origin header that is not on the coordinator's allow list is logged with its value, without your IP address.

The extension sends an Origin header only with its RPC and broadcast requests, and that Origin is the same for every user of the extension.

Application logs are rotated daily, and a daily job deletes those older than 14 days.

### Memory, the database and the region lookup

None of the extension's requests writes anything to the coordinator's database.

To enforce rate limits, the coordinator keeps your IP address in memory for a one-minute window; it is never written to disk.

The country of your IP address is looked up in a MaxMind GeoLite2 database file on the coordinator itself: the lookup never leaves the server, neither your IP address nor the result is stored, and the file's daily update sends no data about you.

### Abuse protection (CrowdSec)

The coordinator runs CrowdSec, which reads the access log to detect abuse. When requests match one of its attack scenarios, it stores an alert with the IP address, the scenario, the time, and the path, method, status and User-Agent of those requests, and the IP address may be blocked. Requests that match no scenario create no alert.

CrowdSec's local alerts are deleted after 7 days, or once more than 5,000 are stored.

For an IP address that triggered an alert, CrowdSec's central service receives the IP address, the scenario and the time, but no paths, methods, statuses or User-Agents; that data is held under CrowdSec's own privacy policy.

To decide whether to block a request, the coordinator asks only its own local CrowdSec.

### Outside services

The coordinator forwards RPC requests to its Solana network provider, Helius: Helius receives the body of each RPC request (the method and its parameters, which can include wallet addresses) and each signed transaction submitted for broadcast. Helius receives these from the coordinator's own IP address; your IP address, Origin, User-Agent and other headers are not forwarded.

Prices for SOL, USDC and USDT come from CoinGecko: the coordinator asks for them at most once a minute and answers the wallet from its own copy, so CoinGecko receives no data about you.

### Use and deletion

The coordinator uses this data only to answer requests, to protect the service from abuse (rate limits and CrowdSec) and to diagnose faults. It is not sold or shared for any other purpose.

To ask for data about you to be deleted, write to privacy@noc-tura.io.

## Contact

Questions about privacy: privacy@noc-tura.io.
