# Deploying `wallet.noc-tura.io`

Everything here is a step a **person** takes on the VPS or at the registrar. Nothing in this
repository deploys itself, and nothing below should be run by an agent on your behalf.

The repository side is done and gated:

| §6 requirement | how it is checked | command |
|---|---|---|
| 6.1 no authority in the page | grep gate over `web/` and `core/`, allowlist empty | `npm run scan` |
| 6.2 no third-party code or telemetry | host allowlist over the built bundle, every entry with a reason, stale entries fail | `npm run test:bundle` |
| 6.3 reproducible build, published hash | two builds compared byte for byte; digest in `sha256sum` format | `npm run reproducible`, `npm run manifest` |
| 6.4 CSP needs no `unsafe-*` | built output read for inline script/style, `eval`, `new Function`, runtime `<style>` | `npm run csp` |
| 6.4 the headers themselves | nginx config generated from one source; a hand edit fails | `npm run nginx:check` |
| 6.5 separate origin | its own server block, its own cert, `/api` and `/rpc` proxied so they are same-origin | this file |

`npm run verify` runs all of them. Measured on 2026-09-21: 179 tests, no inline script or
style, no `eval`, two builds identical.

---

## 1. DNS

Point the host at the VPS that already serves `api.noc-tura.io`.

```
wallet.noc-tura.io.  A  <the coordinator VPS address>
```

Verified 2026-09-21: `wallet.noc-tura.io` does not resolve yet, so nothing is being replaced.

## 2. The certificate — read this before running certbot

**Issue a NEW, SEPARATE lineage. Do not expand an existing one.**

```bash
certbot certonly --webroot -w /var/www/certbot \
  -d wallet.noc-tura.io \
  --cert-name wallet.noc-tura.io \
  --key-type ecdsa --reuse-key
```

`--cert-name` is what keeps this out of the existing certificates. If `wallet.noc-tura.io` were
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

```bash
cp web/deploy/nginx/wallet.noc-tura.io.conf /etc/nginx/sites-available/
ln -s /etc/nginx/sites-available/wallet.noc-tura.io.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

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
- There is no SPA fallback. S0 has no client-side router, so every real URL is a real file and
  unknown paths return 404 rather than a page that looks like it worked.

## 4. Publish the build

Build in CI, not on a laptop (§6.3). The workflow prints the digest to the job summary.

```bash
# on the VPS
install -d -o www-data -g www-data /var/www/wallet.noc-tura.io
# copy the CI artifact's dist/ into it, then:
cd /var/www/wallet.noc-tura.io
find . -type f ! -name build-manifest.json -printf '%P\n' | LC_ALL=C sort | xargs sha256sum | sha256sum
```

That number must equal the digest in the job summary. It is the same pipeline the digest was
computed with, deliberately: anyone — including someone who does not trust the host — can run it
against a downloaded copy of the served site and get the same answer.

## 5. Tell the coordinator

`https://wallet.noc-tura.io` must be on the coordinator's Origin allowlist, and `/api/v1/rpc`
must accept it. Both were agreed on 2026-09-20; confirm before the host goes live rather than
after, because the failure looks like the API being down.

Note for later: if this app is ever packaged (Capacitor, Tauri, a WebView) its Origin becomes
`capacitor://`, `file://` or nothing at all. Tell the coordinator before that ships.

## 6. Domain hardening (§6.9)

The app pins certificates. **A browser cannot.** These records are what the web has instead, and
they are weaker — do not describe them as equivalent.

Verified 2026-09-21, and both are missing today:

```
$ dig +short CAA noc-tura.io     → (nothing: any CA in the world may issue for this domain)
$ dig +short DS  noc-tura.io     → (nothing: DNSSEC is not enabled)
```

**CAA.** Checked before recommending: all four live hosts — apex, `api`, `dao` and `walletapp` —
are issued by Let's Encrypt, and none of the certificates is a wildcard. So this restriction
breaks nothing that exists today:

```
noc-tura.io.  CAA  0 issue "letsencrypt.org"
noc-tura.io.  CAA  0 issuewild ";"
noc-tura.io.  CAA  0 iodef "mailto:<an address someone actually reads>"
```

`issuewild ";"` forbids wildcard certificates outright, which is correct while every host has
its own. If a wildcard is ever wanted, that line has to change first — visibly.

⚠️ CAA applies to **every** issuance under the domain, including the `api.noc-tura.io` renewal
that the pin transition is waiting on. Add it while the next renewal is not imminent, and watch
the first renewal after it lands.

**DNSSEC.** Enable at the DNS provider and publish the DS record at the registrar. Without it,
CAA and every other DNS-based control can be stripped by anyone who can answer for the zone.

**Registry lock** at the registrar, with out-of-band verification for changes, and **hardware
security keys — not SMS** — on the registrar and DNS accounts. A frontend served from a hijacked
domain is indistinguishable from the real one to every other control in §6. This is the layer
that makes the hijack hard rather than detectable afterwards.

**Certificate Transparency monitoring** for any unexpected certificate on `*.noc-tura.io`. The
api certificate carries its own SCTs, so publication is provable from the certificate itself —
crt.sh ran two months behind for this domain in September, so do not rely on it alone.

## 7. Verify what is actually served

```bash
curl -sI https://wallet.noc-tura.io/ | grep -iE 'content-security|strict-transport|referrer|permissions|x-frame|x-content|cross-origin|cache-control'
curl -sI https://wallet.noc-tura.io/assets/  # immutable caching on the hashed assets
curl -s  https://wallet.noc-tura.io/build-manifest.json | head
curl -sI https://wallet.noc-tura.io/nothing-here   # must be 404, not the app
```

Then open the site with the browser console visible and connect a wallet. A CSP violation prints
there and nowhere else — and the connect dialog is where one would show up, because the wallet
icons are `data:` URIs and the policy has to allow exactly those and nothing more.
