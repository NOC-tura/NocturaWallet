# Deploying `app.noc-tura.io`

Everything here is a step taken on the VPS or at the registrar, and each one is the owner's
decision. Nothing in this repository deploys itself. The first deployment (2026-09-26/27) was
carried out by Claude over SSH **at the owner's explicit request**, one step at a time, with
`nginx -t` and a rollback before every reload; the account steps in §6 stayed with the owner.

The repository side is done and gated:

| §6 requirement | how it is checked | command |
|---|---|---|
| 6.1 no authority in the page | grep gate over `web/` and `core/`, allowlist empty | `npm run scan` |
| 6.2 no third-party code or telemetry | host allowlist over the built bundle, every entry with a reason, stale entries fail | `npm run test:bundle` |
| 6.3 reproducible build, published hash | two builds compared byte for byte; digest in `sha256sum` format | `npm run reproducible`, `npm run manifest` |
| 6.4 CSP needs no `unsafe-*` | built output read for inline script/style, `eval`, `new Function`, runtime `<style>` | `npm run csp` |
| 6.4 the headers themselves | nginx config generated from one source; a hand edit fails | `npm run nginx:check` |
| 6.5 separate origin | its own server block, its own cert, `/api` and `/rpc` proxied so they are same-origin | this file |

`npm run verify` runs all of them. Measured on 2026-09-21: 205 unit tests plus 3 bundle gates, no inline script or
style, no `eval`, two builds identical.

---

## 1. DNS

Point the host at the VPS that already serves `api.noc-tura.io`.

```
app.noc-tura.io.  A  <the coordinator VPS address>
```

Verified 2026-09-21: neither `app.noc-tura.io` nor `wallet.noc-tura.io` resolved, so nothing
was replaced. **Done 2026-09-26:** `app.noc-tura.io A 76.13.7.226`, Cloudflare **DNS only**
(not proxied — certbot and the digest comparison both talk to the VPS directly), no AAAA.

**`app.` and not `wallet.`**, decided 2026-09-21. This page is not a wallet — it holds no key
and creates none — and `walletapp.noc-tura.io` already exists on this domain as a devnet
sandbox. `wallet.` beside `walletapp.` is a pair no user can be expected to tell apart, which
on a wallet brand is a gift to whoever clones one of them. The name stays free for the thing
that will genuinely be a wallet: the browser extension, or the S2 vault origin. Do **not**
create `wallet.noc-tura.io` as a redirect — that puts the confusable pair back.

## 2. The certificate — read this before running certbot

**First, the port-80 block alone.** The full server block names the certificate files, so
`nginx -t` refuses it until the certificate exists — and certbot's webroot challenge needs a
server block for this name to answer on port 80. The VPS's `000-default-reject` otherwise
closes the connection for any unknown host. Install only the first `server { listen 80; … }`
block of the generated file, as the same path, and reload:

```bash
install -d /var/www/certbot
# /etc/nginx/sites-available/app.noc-tura.io.conf containing ONLY the port-80 server block
ln -s /etc/nginx/sites-available/app.noc-tura.io.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

`/var/www/certbot` is this host's own webroot; the existing lineages renew through
`/var/www/html`, so the two never touch. Then `--dry-run` the command below before the real one.

**Issue a NEW, SEPARATE lineage. Do not expand an existing one.**

```bash
certbot certonly --webroot -w /var/www/certbot \
  -d app.noc-tura.io \
  --cert-name app.noc-tura.io \
  --key-type ecdsa --reuse-key
```

`--cert-name` is what keeps this out of the existing certificates. If `app.noc-tura.io` were
added as a SAN to the `api.noc-tura.io` lineage instead, that certificate would be reissued with
a new key — and **every installed Android wallet would stop working**, because the app pins that
key and has no fallback path by design. The whole point of the September split was to stop the
api certificate being renewed for reasons that have nothing to do with the wallet. Adding a
wallet host to it would be exactly that, on the first day.

Verified on the live hosts, 2026-09-21:

```
api.noc-tura.io   SAN: api.noc-tura.io                            SPKI sha256/FbxrIC2k…nmQ8=
noc-tura.io       SAN: api.noc-tura.io, noc-tura.io, www.…        SPKI sha256/r6OlpjBV…f9Y8=
```

So the api cutover has already happened: `api.noc-tura.io` serves the single-SAN lineage, whose
key is pin `[1]` in the shipped app. The apex still serves the old shared certificate, which
still carries `api.noc-tura.io` in its SAN list — dropping that SAN is the last move of the pin
transition and is unrelated to this deployment.

## 3. Install the server block

Once the certificate exists, replace the port-80-only file with the full generated one:

```bash
cp web/deploy/nginx/app.noc-tura.io.conf /etc/nginx/sites-available/
nginx -t && systemctl reload nginx
```

Keep the previous file until `nginx -t` passes; if it fails, put the old one back and reload,
so `api.noc-tura.io` on the same nginx never sees a broken configuration.

The file is generated from `web/deploy/security-headers.mjs`. **Do not edit it on the server.**
Edit the source, run `npm run nginx`, commit, and copy it up again — `npm run nginx:check` fails
the build when the two disagree, which is the only thing keeping the served headers and the
tested headers the same headers.

Two things in it are worth knowing before you touch it:

- Every `add_header` sits at server level, and `Cache-Control` is chosen by a `map`. nginx's
  `add_header` does not merge: one `add_header` inside a `location` block **discards every
  header inherited from the server block**. A per-location cache header would have served the
  bundle with no CSP and no HSTS, and nothing would have reported it. A test parses the config
  and fails if an `add_header` appears inside any location.
- On `/api` and `/rpc` the coordinator's own copies of our security headers are hidden
  (`proxy_hide_header`, generated from the same list), so each header arrives once. Without
  it they arrived two or three times, and a browser honours the first HSTS — the
  coordinator's 180 days, not ours.
- There is no SPA fallback. S0 has no client-side router, so every real URL is a real file and
  unknown paths return 404 rather than a page that looks like it worked.

## 4. Publish the build

The `web` workflow builds from a clean checkout and prints the digest (job summary and log);
it does **not** upload `dist/`. So the files are built again from the same commit, under the
same toolchain as CI — Node 22.12.0, npm 11.6.2, `npm ci` — and the digest is what proves they
are the same bytes CI built. The build is reproducible across Node versions (22.12 and 24 give
the same digest), which is what makes this sound.

```bash
# anywhere: a clean copy of the merged commit
git archive <commit> web core | tar -x -C /tmp/release && cd /tmp/release/web
npm ci && npm run build && npm run manifest     # prints: digest sha256:…
# compare with the digest in the web workflow's run for that commit — they must be equal

# on the VPS
install -d -o www-data -g www-data /var/www/app.noc-tura.io
# copy dist/ into it, then:
cd /var/www/app.noc-tura.io
find . -type f ! -name build-manifest.json -printf '%P\n' | LC_ALL=C sort | xargs sha256sum | sha256sum
```

That number must equal the digest in the job summary. It is the same pipeline the digest was
computed with, deliberately: anyone — including someone who does not trust the host — can run it
against a downloaded copy of the served site and get the same answer.

## 5. Tell the coordinator

`https://app.noc-tura.io` must be on the coordinator's Origin allowlist, and `/api/v1/rpc`
must accept it. Both were agreed on 2026-09-20; confirm before the host goes live rather than
after, because the failure looks like the API being down.

Note for later: if this app is ever packaged (Capacitor, Tauri, a WebView) its Origin becomes
`capacitor://`, `file://` or nothing at all. Tell the coordinator before that ships.

## 6. Domain hardening (§6.9)

The app pins certificates. **A browser cannot.** These records are what the web has instead, and
they are weaker — do not describe them as equivalent.

State as of 2026-09-27. Registrar, DNS, CAA and DNSSEC are all in **one Cloudflare account**,
which makes that account the single thing whose takeover undoes everything below.

### Inventory first

Every control here applies to every name under the domain, so it starts from the zone export
(Cloudflare → DNS → Records → Export), not from memory. On 2026-09-26 it held:

| name | points at | HTTPS |
|---|---|---|
| `noc-tura.io`, `www`, `api`, `app`, `dao` | 76.13.7.226, DNS only | Let's Encrypt, http → https |
| `srv` | 76.13.7.226 — the VPS's own hostname, serves no site | nothing on 80 or 443 |
| `walletapp` | CNAME `nocturawallet.netlify.app` (devnet sandbox) | Let's Encrypt, http → https |

plus Google Workspace mail (MX, SPF, DKIM, DMARC `p=reject`), which none of this affects.

Two third-party verification records were also there and were **deleted**:
`_cf-custom-hostname` (a Cloudflare-for-SaaS claim: it lets a *different* Cloudflare account
serve a name under this domain and get certificates for it) and `subdomain-owner-verification`.
Nothing in the zone pointed at an outside service, so nothing depended on them. A leftover claim
like that is a phishing host waiting to be used.

### CAA — live since 2026-09-27

```
noc-tura.io.  CAA  0 issue "letsencrypt.org"
noc-tura.io.  CAA  0 issuewild ";"
noc-tura.io.  CAA  0 iodef "mailto:privacy@noc-tura.io"
```

Set on the apex only; subdomains inherit it.

**This document used to say no certificate for the domain was a wildcard. That was wrong.**
Cloudflare **Universal SSL** was issuing `*.noc-tura.io` certificates on its own — from Let's
Encrypt and from Google Trust Services, the last on 2026-09-07 — even though no record is
proxied and none of them was ever served. With Universal SSL on, adding CAA makes Cloudflare
silently add permissions for its own CAs, wildcards included, and the two lines above stop
meaning what they say. **Universal SSL was disabled first** (SSL/TLS → Edge Certificates);
it only affects proxied names, of which there are none. After adding the records, verify that
exactly these three are published (`dig +short CAA noc-tura.io` at several resolvers and at
the Cloudflare nameservers) — any extra `issue` line means Universal SSL is back.

Proven, not assumed: after the records landed, `certbot renew --dry-run` on the VPS succeeded
for all four lineages (`api`, `app`, `dao`, `noc-tura.io`) — Let's Encrypt checks CAA on the
staging run too — and the `api` SPKI was unchanged. If a wildcard is ever wanted, the
`issuewild` line has to change first, visibly.

### DNSSEC — active since 2026-09-27

With Cloudflare as the registrar the DS record is managed for you: DNS → Settings → Enable
DNSSEC, and Cloudflare publishes the DS at `.io` itself (it said "pending", and the DS
appeared within the hour). Zone signed with algorithm 13 (ECDSA P-256), KSK tag 2371.

Check it end to end rather than trusting the dashboard:

```bash
dig +short DS noc-tura.io @a0.nic.io                 # the parent has it
delv @1.1.1.1 noc-tura.io A                          # "; fully validated"
dig +dnssec A noc-tura.io @8.8.8.8 | grep flags      # 'ad' set
```

and recompute the DS from the KSK (`dig DNSKEY … | dnssec-dsfromkey -2`) — it must equal what
the parent publishes. For the first hour some resolvers keep serving their cached "no DS";
that is expiry, not failure.

### HSTS preload — submitted 2026-09-27, status `pending`

hstspreload.org reported the domain eligible with no errors or warnings, and the owner
submitted `noc-tura.io`. Status: `curl https://hstspreload.org/api/v2/status?domain=noc-tura.io`.

What that commits to, permanently: **every** name under `noc-tura.io`, including any added
later, must serve valid HTTPS — a vendor "custom domain" that only speaks HTTP would simply be
unreachable. The apex must keep sending
`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, or the domain is
dropped from the list. Removal takes months and old browsers keep the entry longer.

### Certificate Transparency monitoring — live since 2026-09-27

Two layers, deliberately unequal in who they trust:

- **Independent:** `NOC-tura/noc-ops` → `scripts/ct-watch.mjs`, run daily by
  `.github/workflows/ct-watch.yml`. It asks SSLMate's Cert Spotter (crt.sh was missing the api
  and app certificates when checked, and must not be relied on) and **fails** — so GitHub
  emails the owner — on any certificate in the last three days that is not Let's Encrypt, is a
  wildcard, or names a host outside apex/`www`/`api`/`app`/`dao`/`walletapp`. Every run first
  self-tests that the judge can both pass and fail. It trusts neither Cloudflare nor the VPS.
- **Cloudflare's own** CT Monitoring (SSL/TLS → Edge Certificates), mailing the account's
  address. Convenient, but it lives inside the account an attacker would have to take first.

**A new subdomain has to be added to `POLICY.names` in `ct-watch.mjs`** before its first
certificate, or that certificate raises the alarm. That is intended: every new name should be a
decision someone made. The first run also surfaced `pin-test.noc-tura.io` (a certificate on
2026-09-18, no DNS record today) — left out of the allowed names on purpose.

### Account security — the part only the owner can do

**Registry lock** with out-of-band verification, and **hardware security keys — not SMS** — on
the Cloudflare account, which now holds the registrar, DNS, CAA and DNSSEC together. A frontend
served from a hijacked domain is indistinguishable from the real one to every other control in
§6; this is the layer that makes the hijack hard rather than detectable afterwards.

As of 2026-09-27 the account uses TOTP from an app — better than SMS against SIM swap, but a
TOTP code can still be typed into a convincing fake login page. Two security keys (one kept as
a spare) close that. Review who else is a member of the account: each of them can change DNS.

## 7. Verify what is actually served

```bash
curl -sI https://app.noc-tura.io/ | grep -iE 'content-security|strict-transport|referrer|permissions|x-frame|x-content|cross-origin|cache-control'
curl -sI https://app.noc-tura.io/assets/  # immutable caching on the hashed assets
curl -s  https://app.noc-tura.io/build-manifest.json | head
curl -sI https://app.noc-tura.io/nothing-here   # must be 404, not the app
```

Then open the site with the browser console visible and connect a wallet. A CSP violation prints
there and nowhere else — and the connect dialog is where one would show up, because the wallet
icons are `data:` URIs and the policy has to allow exactly those and nothing more.
