# M1a checkpoint — the owner's checklist

Spec: `docs/superpowers/specs/2026-11-08-shielded-a0-m1-design.md` §16, "Checkpoints · M1a":

> on the phone, through a harness that is not in the devnet APK's release variant: `keysOpen` with the repo's test
> seed, `depositRho(0)`, `commitment()`, and a deposit proof whose public inputs equal the desk values and verify
> against the deposit VK read from chain; a `withdraw_change` prove without an `authId` refuses. `isSupported()` true
> on the phone. Each checkpoint also builds the production APK of the same commit and launches it on the phone.

## What is what

| piece | where | runs on |
|---|---|---|
| the sequence | `android/app/src/m1aCheckpoint/java/…/M1aCheckpoint.kt` | phone and desktop (a source dir of the two **test** source sets only) |
| the phone run | `android/app/src/androidTest/…/M1aCheckpointTest.kt` → `devnet-androidTest.apk` | the phone, inside the installed devnet **release** app (`testBuildType "release"`) |
| the desktop rehearsal | `android/app/src/test/…/M1aCheckpointHostTest.kt` | this laptop, over the `jni-host` library |
| the build | `scripts/m1a-checkpoint/build-apks.sh` | this laptop |
| "not in release" | `scripts/m1a-checkpoint/check-release-apk.sh` | this laptop, on the built APKs |
| the desk | `scripts/m1a-checkpoint/m1a-checkpoint.mjs` (+ `lib.mjs`, `install.mjs`; tested by `lib.test.mjs`, `install.test.mjs` — `node --test scripts/m1a-checkpoint/*.test.mjs`, also in CI) | this laptop, phone on USB |

The phone reports values; the desk decides. The desk computes the deposit's `rho(0)`, commitment and public inputs from
the test mnemonic itself (bls.js + poseidon-lite, no native code), reads the deposit VK out of the devnet `Pool`
account (one request to `api.devnet.solana.com`; never `noc-tura.io`, never mainnet — it checks devnet's genesis hash),
compares it with the pinned `deposit_vk.json`, and verifies the phone's proof against **the chain's** VK with an
independent pairing check (`@noble/curves`, not the arkworks code that proved).

The key files reach the phone **inside the test APK** (copied at build time from `NOCTURA_A0_KEYS_DIR`); the phone makes
no network request for the checkpoint, and `libnoctura_prover` re-checks each file's sha256 before it parses it.

## Before you start

- [ ] The phone: arm64, USB debugging on, this laptop authorized (`adb devices` lists exactly one `device`).
- [ ] **The production wallet's recovery phrase is at hand.** Step 3 installs the production APK of this commit
      *over* the installed wallet (`adb install -r`: same package, same key, its data is kept). Nothing is uninstalled
      or wiped — but the app can never show the phrase again, so have it before any install over a real wallet.
- [ ] **Know the rollback.** Before the first install the script `adb pull`s EVERY APK of each installed app
      (`base.apk`, and any `split_*.apk` of a split install) into `build/m1a-checkpoint/rollback-<package>-<sha256 of
      base.apk, 16 hex>/`, and prints the exact restore command — `adb install -r <dir>/base.apk` for one APK,
      `adb install-multiple -r <dir>/base.apk <dir>/split_….apk …` for a split install (add `-s <serial>` if you
      used `--serial`; the script's printed command already has it). Each run's paths and sha256s are in
      `installs.json`, and every run is appended to `installs.log.jsonl`. If any pull fails, the script STOPs and
      installs nothing.
- [ ] **Your wallet must be found.** If the phone reports NO `com.nocturawallet` installed, the script prints, between
      two lines of `!`,
      `NO WALLET INSTALLED for com.nocturawallet — this run installs it fresh; if you expected your wallet here, STOP (Ctrl-C) now`
      and STOPs (exit 3) before any install. An absent wallet is most likely the wrong phone or the wrong user profile
      (adb reads user 0; a wallet in a work or secondary profile is invisible to it). Only if a fresh install of the
      production app is really what you want, re-run with `--allow-fresh-production`: the line is printed again, then
      again right before the production install, with 15 s to press Ctrl-C.
- [ ] **Keep the FIRST rollback** — the one taken before any branch APK was installed: it is the wallet you had. A
      rollback directory is never overwritten (a re-run after the checkpoint installed this commit's production APK
      pulls *that* APK into a second directory); the earliest entry of `installs.log.jsonl` that lists a rollback for
      `com.nocturawallet` names it.
- [ ] The commit to check is checked out and the tree is clean (`git status`); `build-apks.sh` warns otherwise.
- [ ] On this laptop: `android/keystore.properties` (or `NOCTURA_KEYSTORE_FILE` …), `.env.devnet`, `.env.production`,
      the NDK `27.1.12297006`, and the program side's repository (for `zk/keys/v2/`).

## 1. Build the three APKs (one commit)

```bash
ANDROID_NDK_HOME=~/Android/Sdk/ndk/27.1.12297006 \
NOCTURA_A0_KEYS_DIR=<program side repo>/zk/keys/v2 \
  scripts/m1a-checkpoint/build-apks.sh
```

- [ ] It ends with `release APK clean: …` for **devnet.apk** and **production.apk**, `control OK: the reading finds the
      harness in devnet-androidTest.apk` (entries, key-file sizes, dex names, the instrumentation), and the three
      sha256 sums. The APKs are in `build/m1a-checkpoint/apks/` with `COMMIT` and `SHA256SUMS`.

## 2. Rehearse on the desk (optional, no phone)

```bash
(cd native/noctura-prover && cargo build --release --locked --features jni-host)
cd android && NOCTURA_A0_HOST_LIB_DIR=<cargo target>/release NOCTURA_A0_KEYS_DIR=<…>/zk/keys/v2 \
  NOCTURA_M1A_REPORT_OUT=$PWD/../build/m1a-checkpoint/host-report.json \
  ENVFILE=.env.devnet ./gradlew :app:testDebugUnitTest --tests 'com.nocturawallet.prover.M1aCheckpointHostTest'
cd .. && node scripts/m1a-checkpoint/m1a-checkpoint.mjs vk
node scripts/m1a-checkpoint/m1a-checkpoint.mjs verify --rehearsal --report build/m1a-checkpoint/host-report.json
```

- [ ] `REHEARSAL PASSED (not a checkpoint: no phone)`, with `S16.0` / `S16.1` as `N/A (phone only)`.

## 3. The checkpoint (phone on USB)

```bash
node scripts/m1a-checkpoint/m1a-checkpoint.mjs all --apks build/m1a-checkpoint/apks
```

It reads the VK from devnet; then, **before any install**, for each of the three packages it reads the installed app's
signer (every pulled APK through `apksigner verify --print-certs`) and compares it with the new APK's. A package
counts as not installed (a first install, allowed) only when two readings agree: the full `pm list packages` (which
must look like a package list — `package:android` in it) does not name it, and `pm path <package>` answers "unknown"
(a non-zero exit, no path). Any other combination STOPs. For the production wallet "not installed" is a STOP of its
own unless you passed `--allow-fresh-production` (see "Your wallet must be found" above). It installs `devnet.apk` and
the test APK, runs the checkpoint on the phone (two proofs — a few minutes; the screen stays as it is), installs
`production.apk` over the installed wallet, launches the devnet app and then the production app (10 s each), and
prints:

```
PASS  S16.0   the report comes from the phone (ART, aarch64), not a rehearsal
PASS  S16.1   isSupported() is true on the phone
PASS  S16.2   keysOpen with the repo's test seed returns a handle (and Kotlin's seed copy is zero-filled)
PASS  S16.3   depositRho(0) equals the desk value
PASS  S16.4   commitment(10^9, rho(0)) equals the desk value
PASS  S16.5   the deposit proof's public inputs equal the desk values (commitment, amount, mintHash, rho)
PASS  S16.6   the deposit VK read from chain equals the pinned deposit_vk.json
PASS  S16.7   the deposit proof verifies against the deposit VK read from chain
PASS  S16.8   a withdraw_change prove without an authId refuses (E_A0_AUTH_ABSENT)
PASS  C8.a    control: the same withdraw_change call, approved, proves — … verifies (pinned withdraw_change_vk.json)
PASS  C8.b    control: the used authId is refused the second time
PASS  C8.c    control: keysClose ends the handle
PASS  S16.D   the device-side assertions of the checkpoint test passed
PASS  S16.10  the devnet release APK launches on the phone
PASS  S16.9   the production APK of the same commit launches on the phone
CHECKPOINT PASSED
```

- [ ] Every line `PASS` and the last line `CHECKPOINT PASSED` (exit code 0).
- [ ] **The script force-stops each app before it launches it** (`adb shell am force-stop <package>`, so the launch
      is a cold start) — for `com.nocturawallet` that is your wallet: if it is open, it closes and restarts. It is a
      restart only; no data is touched.
- [ ] **Look at the phone** during the two launches: the devnet app ("Noctura devnet") opens to its screen, then the
      production wallet opens to its lock screen / dashboard — no crash dialog, no blank screen. Unlock the production
      wallet once: your balances are there (its data was kept).
- [ ] Note the times: `S16.7`'s and `C8.a`'s detail give the deposit and withdraw_change proving times on the phone
      (M1c needs the second).

### The install rules (fail closed)

The checkpoint **never uninstalls anything and never wipes app data** (no `adb uninstall`, no `pm clear` — the script
refuses to send either). It prints `STOP: …` and exits **3** — before installing, with no further adb call — when:

| STOP | means |
|---|---|
| `<package> is installed under ANOTHER signing key — installed <sha256>, new <sha256>` | the app on the phone was signed with another key (the September inventory records a **debug-signed devnet build**); `adb install -r` would fail, and the only "fix" is to remove it with its data |
| `the installed app's signer is UNREADABLE` / `pm path lists no single base.apk` / `the signer of <apk> is unreadable` | a signer could not be read — not compared, so not installed |
| `pm list packages gave an unrecognised answer` / `pm path gave an unrecognised answer` / `the phone's two readings disagree` | the script could not establish whether the app is installed — it does not guess "not installed" |
| `com.nocturawallet: no wallet is installed … re-run with --allow-fresh-production` (after the `NO WALLET INSTALLED` line) | both readings agree the production wallet is absent — most likely the wrong phone or user profile; a fresh install only with the flag |
| `adb pull of the installed <apk> failed` | no complete rollback copy — no install over that app |
| `a rollback … already exists with other contents` | a rollback directory would have to be overwritten — it never is |
| `adb install answered INSTALL_FAILED_…` (e.g. `INSTALL_FAILED_UPDATE_INCOMPATIBLE`) | the installer refused; nothing more is sent to the phone |

### If an install STOPs

The script will not resolve it — **you decide**. Nothing has been removed: the phone is as it was before that install,
and the pulled APKs are in `build/m1a-checkpoint/rollback-*/`. For the devnet app signed with another key: if (and only if)
nothing in it is needed — it holds a devnet wallet, so check you have that wallet's phrase too — you may remove it
yourself and re-run; that is your command, never the script's. For the production wallet (`com.nocturawallet`):
**never remove it to make the checkpoint pass** — stop and ask; a production APK of another key is the wrong APK.

## 4. Record it

- [ ] Keep `build/m1a-checkpoint/` — `chain-pool.json` (the VK read: slot, RPC host, the raw account),
      `phone-report.json`, `launches.json`, `instrument.txt`, `installs.json` / `installs.log.jsonl` (the signers compared,
      the rollback copies' paths, sha256s and restore commands), every `rollback-*/` directory, `apks/COMMIT`, `apks/SHA256SUMS` — and paste the PASS
      lines, the commit and the slot into the checkpoint record.
- [ ] Optional: remove the test app — `adb uninstall com.nocturawallet.devnet.test`. That removes ONLY the
      instrumentation APK `com.nocturawallet.devnet.test` (it holds no user data); the devnet and production apps stay.
      It is the one removal this checklist ever names, it is yours to run by hand, and nothing else is ever
      uninstalled.

## If a line fails

| line | means | look at |
|---|---|---|
| S16.0 / S16.1 | not the phone, or `isSupported()` false: the ABI gate (`A0Abi`) or the library failed to load | `phone-report.json` → `platform` (`osArch`, `isSupportedThrew`) |
| S16.2 | `keysOpen` refused / the fixture is not the test seed | `keysOpen.error` |
| S16.3 – S16.5 | the native derivation disagrees with the desk (the fixtures agreed on the desktop) | the `phone=` / `desk=` values |
| S16.6 | the chain's deposit VK is not the pinned one — **stop**: the pool was re-keyed or it is not the pinned pool | `chain-pool.json` |
| S16.7 | the proof does not verify against the chain's VK | `depositProof` |
| S16.8 | a withdraw_change proved (or refused for another reason) without an approval — **a security failure** | `withdrawWithoutAuthId` |
| C8.a – C8.c | the refusal is not specific / an approval was reusable / a handle outlived `keysClose` | the named entries |
| S16.D | the phone's own assertions failed | `instrument.txt` |
| S16.9 / S16.10 | an APK did not launch, or crashed (the libc++ lesson) | `launches.json`, `crash-<package>.txt` |
| `STOP: …` (exit 3) | an install was not safe to make — see "The install rules" above | the message, `installs.json` |

## What only the phone shows

The desktop rehearsal runs the same sequence over the host library; it cannot show `isSupported()` through the React
module on ART, the `aarch64` ABI gate, the version-scripted arm64 library loading inside the installed release app,
the proving thread's stack on Android, the proving times on the phone, or that the APKs launch.
