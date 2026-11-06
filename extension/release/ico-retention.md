# ICO's answer to B1e spec §6.2 (precondition P-R): what the coordinator records, keeps and shares

- **Received:** 2026-11-01, from ICO (the coordinator's maintainer), pasted by the owner.
- **ICO's commits:** 67bcec0, 6c68431, c803bc1 — deployed, the statements measured on production on 2026-11-01.
- **The question asked:** spec §6.2, verbatim (the six routes the extension calls; (1) what is recorded, (2) where,
  (3) for how long, (4) who receives it outside the coordinator, (5) whether it is sold or used for anything but
  answering, (6) a contact for deletion requests).
- **Turned into:** sentences R1–R21 of `release/privacySentences.mjs` (R2 and R8 are the extension's own measured
  headers, not ICO's), published in `release/privacy.md`. ICO will tell us before any change to logging, the nginx
  format, CrowdSec sharing or upstream forwarding; such a change makes the R-sentences a finding to re-derive.
- **Not reproduced below:** the answer's closing "Also:" paragraph (the B4 Telegram checks and an EVM ingestion
  outage) — it answers no part of §6.2's question.

The answer, verbatim (lines 4–17 of the owner's paste):

Changes made for the statements to be true: app logs now rotate daily, deleted after 14 days (older deleted); CrowdSec alert-context forwarding to its console OFF; GeoLite2 now updates daily (was stale since 2026-06-24); upstream RPC key redacted from every log line/alert (existing lines cleaned); contact page now says privacy@noc-tura.io. ICO will tell us before any change to logging, nginx format, CrowdSec sharing or upstream forwarding.

1–2 Recorded / where:
- nginx access log, every request: client IP, time, method, path incl. query string (e.g. token ids on /wallet/prices), response status and size, Referer and User-Agent. Not: request bodies, Origin, other headers.
- App log (info): /rpc — nothing for an answered request; on refusal the reason + JSON-RPC method name; upstream unreachable → method name; never params, IPs, headers. /tx/broadcast — transaction signature + outcome HTTP status; not the transaction, IP or headers. /wallet/prices, /stats, /geo/check, /geo/restricted-list — nothing per request; server errors only, with no request data. Any route: a non-allow-listed Origin value is logged, without the IP.
- PostgreSQL: none of the six routes writes anything.
- Memory only: IP as rate-limit key (app memory + nginx shared memory), one-minute window, never on disk.
- /geo/check: IP looked up in a local GeoLite2 file; neither IP nor result stored.
- CrowdSec local: agent reads the nginx access log; on a scenario match stores an alert (IP, scenario, time, path, method, status, User-Agent of the triggering requests); bouncer enforces bans. No scenario → no alert.
- CrowdSec central: enrolled in Central API + console with signal sharing: for a triggering IP CrowdSec receives IP, scenario, time — no paths, methods, statuses, User-Agents. The bouncer only queries the local API.
3 Retention: nginx logs rotate daily, 14 rotated files kept (≈ 15 days max), auto-deleted; app logs daily, >14 days deleted by a daily job; CrowdSec local alerts deleted after 7 days or once >5 000; central data under CrowdSec's privacy policy.
4 Outside recipients: Helius (upstream RPC) receives the JSON-RPC body for /rpc (method + params, can include wallet addresses) and the signed transaction for /tx/broadcast, from the server's IP — client IP, Origin, User-Agent, other headers NOT forwarded. CoinGecko: server requests SOL/USDC/USDT prices at most once a minute, clients served from cache, CoinGecko receives no client data. GeoLite2: local MaxMind file, lookups never leave the server; daily download sends no client data. CrowdSec as above.
5 Use: only to answer requests, protect from abuse (rate limits, CrowdSec), diagnose faults. Not sold or shared for any other purpose.
6 Deletion requests: privacy@noc-tura.io.
