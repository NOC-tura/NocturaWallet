# M1c checkpoint — the owner's checklist (Task 1: the `pinnedFetch` gate)

Spec: `docs/superpowers/specs/2026-11-08-shielded-a0-m1-design.md` §6.0 and §16 "Checkpoints · M1c". This file is
Task 1's part: **the gate before any unshield outcome logic is written.** Task 9 adds the two unshield checkpoints,
the wipe and restore, and the production launch to this same directory.

**What the gate proves, on your phone:** the relayer client's transport (`pinnedFetch`, then
`src/modules/shielded/a0/relayerTransport.ts`) hands an HTTP error answer back to the app as an answer, with its
status, instead of an exception that has lost the status. Jest proves the JavaScript half against the library's
source; only the phone proves the compiled native module, our certificate pins against the live
`api.noc-tura.io`, and the relayer's real answer.

**How:** the desk sends the deep link `noctura://a0-pinned-control` to the **devnet** app. The app (devnet build
only — the code is in the production app too, but its gate is closed there and it sends nothing) makes three
requests and writes one `NOCTURA-A0-READOUT` log line for each. Only public values are in those lines: the URL,
the HTTP status, the relayer's outcome word, whether the request threw, and the relayer's public quote.

1. a deliberately malformed `POST …/relayer/submit` (`{"kind":"noctura-m1c-pinned-control"}`). It must come back
   as **HTTP 400, outcome `invalid_request`, not thrown**. The relayer refuses it before it touches its key, its
   budget or the chain, so it costs nothing.
2. `GET …/relayer/quote`: **HTTP 200**, the quote of the A0 pool (`FeGSS…` / `8VMe…` / `ERkp…`) from the relayer
   fee payer `3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe`.
3. the **negative control**: request 1 again, but through a copy of `pinnedFetch` that handles errors the old,
   broken way. It **must throw with the status lost**. If it does not, line 1 proves nothing (the library would
   not be rejecting error answers at all), and the gate fails.

The desk judges the lines (`M1c.P0`–`P3`). It never contacts `noc-tura.io` itself. The phone does.

## Before you start

- [ ] **The phone** is reachable over adb: USB, or wireless (`adb pair <ip:port>` once, then `adb connect
      <ip:port>`). `adb devices` must list exactly one `device`, or pass `--serial <ip:port>` to every command.
      **Wireless adb drops when the phone locks.** If a command says "expected exactly one device", unlock the phone
      and pair again.
- [ ] **`.env.devnet`** is M1b's (see `scripts/m1b-checkpoint/README.md` "Before you start"). This step also
      needs `API_BASE=https://api.noc-tura.io/api/v1`. It already ends in `/v1`, and the app appends
      `/relayer/quote` and `/relayer/submit` to it. `build-apks.sh` refuses an `API_BASE` that does not end in
      `/v1`.
- [ ] The phone is **unlocked with the screen on** when you run `pinned-control`. Android does not start an
      activity behind the lock screen. The wallet itself does **not** need to be unlocked: the control sends
      nothing of the wallet.

## Steps

```bash
# 1. both APKs from ONE commit (≈ 30 min; never at the same time as Jest or cargo)
ANDROID_NDK_HOME=~/Android/Sdk/ndk/27.1.12297006 scripts/m1c-checkpoint/build-apks.sh
#    → build/m1c-checkpoint/apks/{devnet.apk,production.apk,COMMIT,SHA256SUMS,CONFIG.json}
#    and the BuildConfig check (it also runs at the end of build-apks.sh):
node scripts/m1c-checkpoint/m1c-checkpoint.mjs check-apks --apks build/m1c-checkpoint/apks
#    PASS M1c.A1 (the devnet APK has the readout gate open), M1c.A2 (the production APK has it closed),
#    M1c.A3 (the devnet API_BASE ends in exactly one /v1), and "control OK".

# 2. install the devnet APK. This uses M1a's install.mjs unchanged: the installed signer of BOTH packages is
#    checked, rollback copies are pulled, and anything unexpected is a STOP (exit 3). It never uninstalls and
#    never clears data. The production APK is NOT installed in this step.
node scripts/m1c-checkpoint/m1c-checkpoint.mjs install --apks build/m1c-checkpoint/apks

# 3. the gate (≤ 150 s)
node scripts/m1c-checkpoint/m1c-checkpoint.mjs pinned-control --apks build/m1c-checkpoint/apks
#    exit 0 + "GATE PASSED" → Tasks 3 onward may write the outcome logic.
#    The record: build/m1c-checkpoint/{readouts.jsonl,pinned-control.json}
#    pinned-control.json's "judgedRun" is the run key that was ACTUALLY judged (review C1: never a
#    stale earlier run on record) — null means every line FAILED because no new run appeared.
```

Run `pinned-control` **at most twice a minute**. Each run sends two submits, and the relayer allows 5 submits per
minute from one IP address. A third quick run gets HTTP 429 from the rate limiter, and P1 fails. To judge the
recorded lines again without sending anything: `… pinned-control --apks … --judge-only`.

## Reading a FAIL

| line | what you see in its detail | what it means / what to do |
|---|---|---|
| P1 | `threw true … pinFailure true` | our certificate pins did not match `api.noc-tura.io` (an E004 pin failure). **Stop.** Report it. Do not "fix" it by removing a pin. |
| P1 | `threw true … pinFailure false` | network or DNS failure, or the JS deadline. Check the phone's connection and run again. |
| P1 | `status 503 outcome transfer_disabled` / `relayer_disabled` | the relayer is switched off. Ask the program side. |
| P1 | `status 429` | rate limited. Wait one minute and run again. |
| P1 | `status 400 outcome unrecognised` or `null` | the relayer answered without the contract's outcome. Report it to the program side (contract §1). |
| P2 | another `feePayer` / `programId` / `pool` / `mint` | the relayer serves another key or pool than the pinned one. **Stop.** Report it. |
| P3 | `threw false … status 400` | the installed library RESOLVED the error answer, so P1 proves nothing. **Stop.** Report it. The transport's assumptions are wrong. |
| P0 | another URL | the devnet APK's `API_BASE` is not what `check-apks` read, or the app doubled `/v1`. Rebuild from a clean commit. |
| all | "no NEW complete run after the trigger" | `pinned-control` judges ONLY the run it just triggered, never a stale earlier run already on record (review C1). This means the app did not start on the link (check `adb devices`, the phone unlocked), the installed devnet app is older than this commit (install again) — **or it crashed partway through the three requests**, which looks identical from the log alone. Check the crash buffer: `adb logcat -d -b crash` (and `-b all` if that is empty). Re-run `pinned-control` once the phone is confirmed up; it sends a fresh link either way. |
| all | "no complete pinned-control run recorded" | only from `--judge-only`: nothing judgeable is on record yet. Run `pinned-control` (without `--judge-only`) first. |

## What is not proven here

- The unshield itself, the confirmation dialog and the relayed transaction (Tasks 6 and 7, checkpoint Task 9).
- The production app: its gate is read off its APK (`M1c.A2`) and tested in Jest. Its launch with "no readout
  line" is Task 9's step. This step never installs it.
