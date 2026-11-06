# Chrome Web Store submission checklist — Noctura 1.0.0

For the owner (B1e spec §7, with §5.1, §5.3, §5.5, §5.6). Every command runs in `extension/` of a clean checkout of
`main` (`git status --porcelain` empty — untracked files count; `release:chrome` refuses otherwise). Steps are in order;
a step that says "before" is a gate, not a suggestion.

## Open before the release (owner / ICO)

- [ ] **ICO: P1 — the automatic OFAC refresh of `/geo/restricted-list`.** The store build runs the region check (F12) and
      fails closed on a stale list; ICO confirms the refresh runs in production (spec §6.2, inherited from B1d §6.5).
- [ ] **ICO: is `chrome-extension://<the store ID>` on the coordinator's Origin allow list?** Either way the published
      sentence R7 is true (if it is not, every RPC and broadcast request logs that one value, no IP); ask once the store
      has assigned the ID (step 7), and tell us if the answer changes a sentence.
- [ ] **The Terms need a lawyer** (owner decision E4): `release/terms.md` is a DRAFT; its first note lists the open points
      (provider's legal name and address, governing law and courts, eligibility, liability wording and EU consumer law,
      notice of changes). The approved text goes to ICO without the DRAFT note.
- [ ] **ICO: `wallet.noc-tura.io` serves nothing, and stays so (owner decision E25) — a gate before upload.** The passkey
      RP ID (E17) is a name on ICO's domain, and a passkey bound to it can be asked for by any HTTPS page at that name
      or at any name under it (`<anything>.wallet.noc-tura.io`): such a page could prompt a store user's synced Noctura
      passkey and obtain its PRF output, the secret that unwraps the vault. **Ask ICO first** whether a certificate in
      use today covers `*.noc-tura.io`: a wildcard covers `wallet.noc-tura.io` (one label under noc-tura.io), so (2)
      below cannot hold while it is in use, and the answer may cost ICO a certificate change (certificates that name
      each host they serve instead of the wildcard). Whether to ask ICO for that change is your decision, taken before
      the rest of this item. Then ICO confirms in writing, recorded in `noc-ops`: (1) `wallet.noc-tura.io` and every name under it have no DNS record — or resolve only to a host that
      refuses HTTPS — and noc-tura.io has no wildcard record; (2) no certificate covers them: none for
      `wallet.noc-tura.io` or `*.wallet.noc-tura.io`, and no wildcard `*.noc-tura.io`; (3) ICO tells us **before** any
      record, certificate or service is ever added for those names. You check it yourself without opening any Noctura
      page (a DNS query goes to resolvers and noc-tura.io's name servers, never to a web server — and never open
      https://wallet.noc-tura.io to look):
      `dig +short wallet.noc-tura.io A`, `dig +short wallet.noc-tura.io AAAA`, `dig +short wallet.noc-tura.io CNAME`
      and `dig +short e25-check-$(date +%s).noc-tura.io A` (an invented name: an answer means a wildcard record) each
      print nothing; then, in a browser, the Certificate Transparency search https://crt.sh/?q=%25.noc-tura.io lists no
      unexpired certificate naming `wallet.noc-tura.io`, `*.wallet.noc-tura.io` or `*.noc-tura.io`. A record or a
      certificate found is a stop: no upload until ICO removes it. Re-check before every later upload.
      (`walletapp.noc-tura.io` exists and is not covered by the rule: a passkey for `wallet.noc-tura.io` is never
      offered to it.)
- [ ] **ICO publishes the three pages** exactly as written: `release/privacy.md` at https://noc-tura.io/extension/privacy,
      `release/terms.md` (approved) at https://noc-tura.io/extension/terms, `release/help.md` at
      https://noc-tura.io/extension/help — each answering 200 with no redirect.

## 1. Developer account

- [ ] Chrome Web Store developer account: the 5 USD registration fee, 2-step verification on the Google account, a
      verified contact e-mail, and the EU trader / non-trader declaration.

## 2. The texts are live, and the live check passes

- [ ] ICO's retention answer is recorded: `release/ico-retention.md` (received 2026-11-01), turned into R1–R21 of
      `release/privacySentences.mjs` — done in B1e-2. P1 (above) confirmed.
- [ ] The three pages published (above). The live check is part of `release:chrome` only (step 3) and runs **twice**
      (owner decision E26): a pre-check before `verify`, so a page that is not live stops the run in seconds with
      nothing built, and the final check after `verify` and the RP-ID record, just before the zip — three GETs to
      noc-tura.io each time, one page at a time, six per run; 15 s each, no redirect followed, no retry, no flag to skip
      it. It needs every sentence of `privacySentences.mjs` on the privacy page, and "Terms of Service" / "Help &
      support" with privacy@noc-tura.io on the other two (the Terms page without the DRAFT note). Until ICO publishes,
      `release:chrome` stops at the pre-check and writes nothing (rev 1's dry run, 2026-11-05, which had one check after
      verify: all three pages answered 404).
- [ ] **Every later version, before its upload:** read every sentence of `release/privacySentences.mjs` against the
      extension's changes since the last release (`git diff <last release commit>..HEAD -- extension/src extension/manifest`)
      — a change that keeps every pinned constant can still make a sentence untrue (a new field on an existing route); a
      sentence it made untrue is corrected and republished by ICO first. Then `release:chrome` runs the live check again
      that day: the pages are checked when a version is packed, not in between.

## 3. Pack and upload

- [ ] **Re-confirm the passkey RP ID (E17, spec §5.6).** `release/rp-id.json` records
      `{"rpId": "wallet.noc-tura.io", "confirmedBy": "owner", "decision": "E17"}` (committed in B1e-2 from your written
      decision of 2026-10-30). 1.0.0 freezes it: every passkey a store user enrols is bound to that name for good, and
      changing it later orphans them all. If it must change, it changes now — `src/vault/passkey.ts`, the host
      permission, the record, the privacy sentences P12 / P13 and the listing together — never after upload.
      `release:chrome` refuses to pack unless the record is exactly that and equals `RP_ID` in `src/vault/passkey.ts`.
      The name is safe to freeze only while nothing is served at it — the ICO gate above (E25).
- [ ] **No `NODE_ENV` in your shell:** `echo "${NODE_ENV-unset}"` prints `unset` (if not: `unset NODE_ENV`, or prefix
      the command below with `env -u NODE_ENV`). A `NODE_ENV` of development or test makes Vite build React's
      development bundle, and every step would agree on it; `release:chrome` refuses any `NODE_ENV`, and `build.mjs`
      any but `production`.
- [ ] `npm ci --ignore-scripts && npm run release:chrome` (as CI installs: only `extension/`, no dependency's install
      script; Node 22.12 or later — the zip is byte-identical on any Node, spec §5.4). It runs, in order, stopping at the
      first refusal with nothing written: the preflight (no `NODE_ENV`, a clean tree, this version not packed yet, no
      `.partial` file an interrupted run left — any under `release/out/`, this version's notes' — named, the lockfile
      present); the live pre-check; `npm run verify`; a third store build whose `chrome/` digest must equal
      verify's `dist-nopresale/chrome`; the RP-ID record; the final live check; the zip made twice with one sha256, read
      back, its entries one for one the witnessed files. Then it writes `release/out/noctura-chrome-1.0.0.zip`
      (git-ignored — upload this file) and `release/notes-1.0.0.md` (the version; the zip's bytes, entry count and
      sha256; the package's file digest; the commit; the lockfile's sha256; `NODE_ENV: unset`; the RP ID; Node), each
      under a temporary name first, moved into place when both are written. If it ever says "the write failed
      part-way", remove the files it names before running again. Commit the notes:
      `git add release/notes-1.0.0.md && git commit -m "release(extension): Chrome 1.0.0 notes"`.
- [ ] Upload `release/out/noctura-chrome-1.0.0.zip` in the developer dashboard.
- [ ] Store listing: paste `release/listing.md` field by field (each `## ` heading is the dashboard field). The summary
      is not pasted: the store reads it from the package's manifest `description`; `listing.md` shows the same string.
      The category is yours to pick. Permission justifications: the five `### ` entries under "Permission justifications".
      Remote code: "No".
- [ ] Privacy practices: tick the answers of `release/data-usage.md` ("The form": Financial and payment information,
      Location and Website content **Yes**, the rest **No**), the three certifications (on R20 — read the file's notes on
      what ICO's answer does and does not name), the privacy policy URL https://noc-tura.io/extension/privacy. Check the
      dashboard's certification wording against the file's; a difference is a text edit.
- [ ] Screenshots: `npm run screenshots` (right after `release:chrome`, which leaves verify's store build in place; on a
      fresh checkout run `npm run build` first). It writes five 1280 × 800 PNGs to `release/screenshots/out/`
      (git-ignored); upload them in this order: `1-home.png`, `2-send-review.png`, `3-site-request.png`,
      `4-wallet-tab.png`, `5-security.png`. Look at them and at `release/screenshots/backdrop.html` first (the visual
      pass); flagged for you there: the NOC row's "estimate · not in total" (E23), #19's second check line clipped at 412 px, the test
      site shown "Unknown", the sample phrase "Violet otter 19" and amounts.
- [ ] Submit for review **with publishing deferred** (you publish by hand after approval). This may happen before step 4
      (E14); nothing is distributed until step 6.

## 4. The independent external security review — before step 6

- [ ] B1 release gate 2 (vendor and cost are yours): done **before the Unlisted listing, i.e. before any distribution**
      (E14). Its findings are fixed, or accepted in writing, first.

## 5. Record the permission strings and the version

- [ ] `unzip -q release/out/noctura-chrome-1.0.0.zip -d <an empty directory>`; in a clean Chrome profile,
      chrome://extensions → Developer mode → Load unpacked → that directory. An unpacked load shows no install dialog,
      so record the permission strings from the item's Details → Permissions, and the version on #38 (Settings → "About Noctura":
      "v1.0.0"). Expected: Chrome's all-sites warning ("Read and change all your data on all websites"); `storage` and
      `alarms` carry none.
- [ ] The install dialog itself is recorded by a tester at the first Unlisted install (step 6).

## 6. Visibility

- [ ] **Unlisted** for a few days with known testers, then **Public** (recommended); you decide at submission.

## 7. After the store assigns the ID

- [ ] Record the ID and the item's public key in `release/store-key.json`, in a follow-up commit:

      {"id": "<32 letters a–p>", "key": "<the public key: one line of base64, without the BEGIN / END lines>"}

      The file must be exactly these two fields; the key canonical base64 of the DER public key (the dashboard shows it
      as PEM: drop the armour lines and join the rest); the id must be the one Chrome derives from that key, or the
      file is refused (`scripts/storeKey.mjs`). Then confirm:
      `node scripts/build.mjs <outDir> --dev-key --no-presale && node scripts/check-permissions.mjs --dev-key <outDir>`
      prints `… chrome carries the recorded store key (id <id>), firefox none`, and `npm test` now runs the
      "once recorded" rows of `storeKey.test.mjs` and `check-permissions.test.mjs` instead of skipping them.
- [ ] Re-run the "no existing users" evidence below and put its output in the follow-up commit's message.
- [ ] Ask ICO the Origin question (above) with the ID.

**Development note.** An unpacked install built with `node scripts/build.mjs <outDir> --dev-key` has the store's ID, so it
and the store install cannot coexist in one Chrome profile (B1e §5.3). `--dev-key` builds only into a directory named on
the command line, never `dist/`, `dist-nopresale/` or anything under them (and
`check-permissions.mjs --dev-key` refuses the same directories); the store package never carries a `key`.

## "No existing users" — the evidence (spec §5.5)

The B1c §6.5 update gate (an update that adds `<all_urls>` content scripts disables the extension for existing users)
does not apply to 1.0.0: it carries `<all_urls>` from its first store version, and there are no existing users. Run in
the repository root on 2026-11-06, at `99cfd9b` with all 28 refs (re-run by B1e-2's Task 7; rev 1 ran it on
2026-11-05 at `c92fd09`, 27 refs, and counted 2 sideload lines — the B1e-2 plan, committed since, adds three):

```
$ git log --all --oneline -- '*.zip' '*.crx' | wc -l
0
$ git tag -l | wc -l
0
$ git log --all --diff-filter=A --format='%h %ad' --date=short -- 'extension/release/*' | tail -1
3b509af 2026-11-03
$ git grep -n -i sideload HEAD -- . | grep -i -c 'extension\|crx\|chrome'
5
```

No `*.zip` or `*.crx` in any commit of any branch; no tag; the first file under `extension/release/` is B1e-1's
(`3b509af`); of the five sideload lines that name the extension, two are spec §5.5's own sentence and three are the
B1e-2 plan quoting this evidence (this file adds its own once committed); every other sideload note is the Android APK. The owner's unpacked installs and the E2E profiles are not users. The gate applies to every later
update that adds a permission.
