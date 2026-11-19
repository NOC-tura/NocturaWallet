# M1b checkpoint — the owner's checklist

Spec: `docs/superpowers/specs/2026-11-08-shielded-a0-m1-design.md` §16, "Checkpoints · M1b":

> shield an amount from the main account (deposit signed by it); the note shows `unspent` with the leaf index of its
> `LeafInserted`. Wipe the app, restore from the phrase: the shielded balance returns from the chain. (That the
> restore made no note-specific RPC request is not observable on a phone; it is the recording-`Connection` JS test of
> §14, I-3, which must pass at this checkpoint.) The restore's tree-transaction count and its duration on the phone are
> recorded against R13's trigger (5,000 transactions, 60 s). Kill the app between the deposit's submit and its
> confirmation once: at the next start the note is reconciled, not lost.

and "each checkpoint also builds the production APK of the same commit and launches it".

## What is what

| piece | where | who |
|---|---|---|
| the deposit (#16 → #18 → #19 → #20 → #21), the unlocks, the import of the phrase, looking at the screens | the phone, the **devnet app** ("Noctura devnet") | **you, by hand** |
| the readout: one log line after each deposit submit / outcome and each startup step, ONLY public values (signature, main account, amount, commitment, leaf index, counts, durations, error codes) | `src/modules/shielded/a0/checkpointReadout.ts` — **devnet build only** (gate: `FEATURES_SHIELDED=true` and `NETWORK=devnet`) | the app |
| installs (M1a's rules), the kill, the wipe, collecting the readout, the launches | `scripts/m1b-checkpoint/m1b-checkpoint.mjs` (+ `device.mjs`, `lib.mjs`, M1a's `install.mjs`) | this laptop, over adb |
| the judgement: every readout value against devnet (`getTransaction` of each signature, the tree's signature list), the I-3 Jest test, the APKs' BuildConfig | `m1b-checkpoint.mjs verify` | this laptop |
| the build | `scripts/m1b-checkpoint/build-apks.sh` | this laptop |
| the desk's own tests | `node --test scripts/m1b-checkpoint/*.test.mjs` (also in CI) | no phone, no network |

The phone reports values; the desk decides. Nothing the phone says is believed without the chain: the deposit's
signers, amount and commitment come from its devnet transaction, the leaf index from the `LeafInserted` the pool
program emitted in its own frame, the restore's tree-transaction count from the desk's own walk of `5URd…`'s
signatures.

## Before you start

- [ ] **The phone** is reachable over adb from this laptop — USB, or wireless: `adb pair <ip:port>` once, then
      `adb connect <ip:port>`. `adb devices` lists exactly one `device` (or pass `--serial <ip:port>` to every command).
- [ ] **`.env.devnet`** at the repository root has exactly these keys (Task 6; the API key is yours):
      ```
      HELIUS_RPC_URL=https://devnet.helius-rpc.com/?api-key=<the devnet key>
      HELIUS_WS_URL=wss://devnet.helius-rpc.com/?api-key=<the devnet key>
      NETWORK=devnet
      API_BASE=https://api.noc-tura.io/api/v1
      SENTRY_DSN=
      FEATURES_SHIELDED=true
      LOCAL_PROVING=true
      APP_ID_SUFFIX=.devnet
      APP_LABEL=Noctura devnet
      ```
      With `NETWORK=mainnet-beta` the devnet build **refuses to start** (deliberate, Task 6) — the first thing to check
      if the devnet app does not open. `.env.production` is unchanged (`NETWORK=mainnet-beta`, no `FEATURES_SHIELDED`).

      **Your `.env.devnet` is not this file yet** (as of Task 6 it still has `NETWORK=mainnet-beta`,
      `SHIELDED_RELAYER=true`, `NATIVE_PROVER_DEBUG=true` and `SHIELDED_DEVNET_MINT=AtjVK…`). Edit it yourself — the
      scripts and the agents never touch your env files:
      - `NETWORK=mainnet-beta` → `NETWORK=devnet` (**required**: `build-apks.sh` refuses to build without it);
      - delete `SHIELDED_RELAYER`, `NATIVE_PROVER_DEBUG` and `SHIELDED_DEVNET_MINT` (the app no longer reads them);
      - delete the comment block "NETWORK=mainnet-beta ON PURPOSE … TODO_DEVNET_*" (no longer true);
      - keep your devnet Helius key in the two URL lines (shown above as `<the devnet key>`; never commit it).
      `.env.production` must not gain `FEATURES_SHIELDED=true` (`build-apks.sh` refuses that too).
- [ ] **The devnet app's recovery phrase is on paper.** Step 5 WIPES the devnet app (`pm clear
      com.nocturawallet.devnet`) and you restore it from that phrase — the app can never show it again (memory: the
      seed-reveal gap). If the devnet app holds a wallet whose phrase you do NOT have: that wallet is devnet-only, but
      decide first — either accept losing it, or stop here. A fresh devnet wallet (Create, phrase written down) is the
      clean start; then its main account is the one to fund.
- [ ] **The production wallet's recovery phrase is at hand.** Step 6 installs the production APK of this commit
      *over* the installed wallet (`adb install -r`, its data kept). Nothing is uninstalled; `com.nocturawallet` is
      never wiped.
- [ ] **Know the rollbacks** — exactly M1a's: before the first install every installed APK of both apps is pulled into
      `build/m1b-checkpoint/rollback-<package>-<sha>/` and the restore command printed; a rollback is never
      overwritten; keep the FIRST one (`installs.log.jsonl`'s earliest entry names it).
- [ ] The commit to check is checked out and the tree is clean (`git status`).

### Test tokens and SOL (devnet)

The deposit needs the pool's mint `ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs` (the devnet test token "TEST", 9
decimals) in the devnet app's main account, and devnet SOL for the fees and the rho-marker rent (≈ 0.0007 SOL per
deposit). After step 2, read the main account off the devnet app (Receive) and run:

```bash
node scripts/m1b-checkpoint/m1b-checkpoint.mjs fund --main <main account>
```

It reads (devnet only) the SOL and TEST balances and says what is missing. The checkpoint uses two deposits:
1,000,000 base units (0.001 TEST) and 500,000 (0.0005 TEST).

- **SOL:** the public devnet faucet (`https://faucet.solana.com`, network devnet), 1 SOL to the main account.
- **TEST:** there is no faucet for a custom mint. Its mint authority is `GoBAmZzHvD6F4KHLNmBFh2wZAGE1dwwufeTbifSHEYfd`
  — the program side's dedicated devnet key (read from devnet at slot 522688040: mint authority GoBAm…, no freeze
  authority, supply 9,000,000 base units). **Ask the program side** with exactly this message:

  > Please mint 10,000,000 base units (0.01 TEST) of the devnet A0 test mint ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs
  > to the devnet wallet `<main account>` (its associated token account, created idempotently, paid by
  > GoBAmZzHvD6F4KHLNmBFh2wZAGE1dwwufeTbifSHEYfd). Devnet only, for the wallet's M1b checkpoint. Reply with the signature.

  *The alternative, your decision:* that devnet key's file is on this laptop (`~/.config/solana/devnet-a0.json`; the
  program side's acceptance scripts use it). If you choose to mint yourself — devnet only, never with any other key:
  ```bash
  K=~/.config/solana/devnet-a0.json; U=https://api.devnet.solana.com
  solana-keygen pubkey $K        # must print GoBAmZzHvD6F4KHLNmBFh2wZAGE1dwwufeTbifSHEYfd — else STOP
  spl-token --url $U create-account ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs --owner <main account> --fee-payer $K
  spl-token --url $U mint ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs 0.01 --recipient-owner <main account> --mint-authority $K --fee-payer $K
  ```
  The checkpoint script itself never signs anything and never reads a key file.

- [ ] `fund` ends with exit 0 (no `NEED …` line).

## 1. Build the two APKs (one commit)

```bash
ANDROID_NDK_HOME=~/Android/Sdk/ndk/27.1.12297006 scripts/m1b-checkpoint/build-apks.sh
```

- [ ] It ends with `PASS M1b.A1` (devnet.apk: `APPLICATION_ID=com.nocturawallet.devnet … FEATURES_SHIELDED=true
      LOCAL_PROVING=true NETWORK=devnet`), `PASS M1b.A2` (production.apk: `NETWORK=mainnet-beta`, no
      `FEATURES_SHIELDED`), `control OK: the production check refuses the devnet APK`, and the two sha256 sums. The
      APKs are in `build/m1b-checkpoint/apks/` with `COMMIT`, `SHA256SUMS`, `CONFIG.json`.

## 2. Install the devnet app

```bash
node scripts/m1b-checkpoint/m1b-checkpoint.mjs install --apks build/m1b-checkpoint/apks
```

Before any install it runs M1a's preflight for **both** packages (signer of every installed APK vs the new APK's,
two agreeing readings of "installed", the rollback pull — any doubt is a STOP, exit 3, before anything is installed);
then it installs `devnet.apk` over the devnet app (data kept) and cold-launches it: `PASS M1b.8`.

**`install` runs the production preflight too, by design (R1-m8):** if `com.nocturawallet` is not found on the phone
(two agreeing readings), it prints `NO WALLET INSTALLED` and STOPs (exit 3) before installing anything — even though
this step installs only the devnet app. Most likely the wrong phone or user profile. Only if a fresh production app is
really what you want, re-run with `--allow-fresh-production` (M1a's rule).

- [ ] Open the devnet app and unlock it (or Create a new devnet wallet — phrase on paper). **The first unlock after
      this build restores from the chain** (no A0 record yet): the dashboard's shielded hero shows "Restoring from the
      chain…" and then the balance. Expected — it is a first R13 measurement, recorded but not the one judged.
- [ ] **If devnet's RPC rate-limits (HTTP 429) or times out** (R1-m5): the startup step ends as an error — the
      dashboard's shielded line says it could not be loaded / restored, with its code and **Retry** (never a 0
      balance), and the watch prints `readout … startup error`. Tap Retry. The restore's retries and backoff are part
      of its measured duration, so a throttled run shows a longer R13 `durationMs` — note it if it happens on the
      judged restore (step 5).
- [ ] Note the main account (Receive), then the funding above.

In a second terminal, keep the log recorded from now on:

```bash
node scripts/m1b-checkpoint/m1b-checkpoint.mjs watch
```

(each readout prints a `readout <id> <event> …` line; `collect` does the same from a one-off log dump.)

## 3. The deposit (by hand)

Dashboard → **Shielded** → **Shield** (#16) → amount **0.001** → #18 (unlock; the four rows with measured times) →
#19 (simulation; "A public deposit · PUBLIC") → #20 (unlock to sign) → #21.

- [ ] #21 ends on "Shielded · your note is at position #N in the pool". Note N.
- [ ] The watch printed `readout … deposit-submitted` and `readout … deposit-outcome unspent leaf N`.
- [ ] The dashboard's shielded balance shows 0.001 TEST more.

## 4. The kill (between submit and confirmation)

Stop the watch (Ctrl-C) and start it with the kill:

```bash
node scripts/m1b-checkpoint/m1b-checkpoint.mjs watch --kill-after-submit
```

Make a second deposit of **0.0005** the same way. The moment the app reports the send accepted, the desk runs `adb
shell am force-stop com.nocturawallet.devnet` (the process dies; no data touched) and prints `KILLED …` (→
`kill.json`). #21 disappears with the app.

The watch first records what is already in the phone's log (a `collect`): `adb logcat` replays its buffer, which
still holds step 3's `deposit-submitted`, and an already-recorded readout never triggers the kill — only a readout
that is new on the live stream does. Start the watch **before** you tap through the second deposit.

- [ ] Reopen the devnet app and unlock it. The watch prints `readout … startup ready` — the reconciliation ran.
- [ ] The dashboard shows the second deposit in the balance (it landed), or — rare: if it did not land — no pending
      line after ~4 minutes and a restart (dropped once its blockhash expired and a further 300-block safety margin
      passed — the final review's I-2; nothing left the account).
- [ ] If the watch printed `deposit-outcome` for the killed signature BEFORE the kill, the kill came too late (the app
      had already settled it) — `verify` says so; repeat this step with a third deposit.

## 5. Wipe and restore from the phrase

```bash
node scripts/m1b-checkpoint/m1b-checkpoint.mjs wipe --apks build/m1b-checkpoint/apks --confirm-wipe com.nocturawallet.devnet
```

**This is the one clear the checkpoint ever sends: `pm clear com.nocturawallet.devnet` — the DEVNET app's data,
its devnet wallet. Never `com.nocturawallet`.** It first records the log (`collect`), then refuses unless the package
is exactly `com.nocturawallet.devnet`, you typed that name after `--confirm-wipe`, and the installed devnet app is
signed by this checkpoint's `devnet.apk` key (an app under another key is not the one this checkpoint installed — STOP).
It prints a `WIPING …` banner and waits 10 s (Ctrl-C stops it), clears, clears the log, and writes `wipe.json`.

- [ ] Open the devnet app: onboarding. **Import** the phrase (the same one), set the unlock. The dashboard's shielded
      hero: "Restoring from the chain…", then the balance — both deposits (0.0015 TEST).
- [ ] `node scripts/m1b-checkpoint/m1b-checkpoint.mjs collect` prints `readout … startup ready restored (no-record)`.
      (A running `watch` records it too.)

### 5b. (Optional) the second restore case: in-app Wipe wallet → import (R1-C1)

`pm clear` above is the judged wipe (`M1b.3` reads the first startup after `wipe.json`). The other way a user loses
the local wallet is the app's own **Settings → Wipe wallet**, followed by an import **in the same process** (no app
restart) — the case R1-C1 fixed (before it, the earlier wallet's "ready" state stuck and the imported wallet did not
restore). If you want to see it on the phone, do it here, after step 5 and before step 6:

- [ ] Devnet app → Settings → **Wipe wallet** (its warning names the recovery phrase and the shielded notes) →
      onboarding → **Import** the same phrase, set the unlock — without closing the app.
- [ ] The shielded hero shows "Restoring from the chain…", then both deposits (0.0015 TEST) again.
- [ ] `collect` prints a second `readout … startup ready restored (no-record)`.

It is recorded in `readouts.jsonl` but **not judged** by `verify` (no line depends on it); if it shows anything
else — the old balance without a restore, an error, a 0 — note it and tell the developer: that is R1-C1 failing on
a phone.

## 6. The production APK of the same commit

```bash
node scripts/m1b-checkpoint/m1b-checkpoint.mjs prod --apks build/m1b-checkpoint/apks
```

It force-stops the devnet app (so only the production app can write to the log), re-runs the preflight for
`com.nocturawallet`, installs `production.apk` over your wallet (data kept), clears the log, cold-launches it:
`PASS M1b.9` = started, alive after 10 s, clean crash buffer, **no readout line**.

- [ ] **Unlock the production wallet** (do not open the devnet app in between): your balances are there. The unlock is
      where the A0 modules load in every build (Task 4: the import at unlock is not gated) — this is that check.
      In particular `src/modules/shielded/a0/startup.ts` registers its wipe/reset hook (`onSecureMmkvReset`) at module
      load, and that module now loads on the unlock path of the PRODUCTION build too (it never runs the A0 startup
      there: shielded is off). No desk test can show that this import is harmless in the production release app;
      `M1b.9` (launch) and `M1b.10` (after your unlock: alive, no crash, no readout line) are the check that covers it.
- [ ] `node scripts/m1b-checkpoint/m1b-checkpoint.mjs prod-check` → `PASS M1b.10` (alive, no crash, no readout line
      since the launch, the devnet app not running).

## 7. Verify

```bash
node scripts/m1b-checkpoint/m1b-checkpoint.mjs verify --main <main account> --apks build/m1b-checkpoint/apks
```

It runs the I-3 test (`npx jest src/modules/shielded/a0/__tests__/restoreRequests.test.ts`) at this commit, reads
(devnet, genesis-checked, `api.devnet.solana.com`) every signature the readouts name and the whole signature list of
`5URd…`, and prints:

```
PASS  M1b.1   a deposit from the main account landed on devnet, signed by it (the only signer, the fee payer, the deposit's depositor)
PASS  M1b.2   the note shows unspent with the leaf index of its LeafInserted (readout = chain: commitment, leaf index, root)
PASS  M1b.3   wipe: ONLY the devnet app's data cleared (pm clear com.nocturawallet.devnet), restored from the phrase: the next start found no record and restored
PASS  M1b.4   the shielded balance returns from the chain: every deposit of this checkpoint that landed is unspent again at its chain leaf
PASS  M1b.5   R13 recorded: the restore's tree-transaction count and duration on the phone, against the trigger (5000 txs, 60 s)
PASS  M1b.6   killed between the deposit's submit and its confirmation: at the next start the note is reconciled, not lost
PASS  M1b.7   I-3: the recording-Connection test (restoreRequests.test.ts) passes at this commit
PASS  M1b.A1  the devnet APK is the shielded devnet build (the readout gate open: FEATURES_SHIELDED=true, NETWORK=devnet)
PASS  M1b.A2  the production APK cannot read out (FEATURES_SHIELDED not true, NETWORK=mainnet-beta): the gate is closed there
PASS  M1b.A3  the APKs are of the commit checked (apks/COMMIT = HEAD, tree clean)
PASS  M1b.8   the devnet release APK launches on the phone
PASS  M1b.9   the production APK of the same commit launches on the phone; no readout line in its log
PASS  M1b.10  the production app after the owner's unlock (the A0 modules loaded): alive, no crash, no readout line
CHECKPOINT PASSED
```

- [ ] Every line `PASS`, the last `CHECKPOINT PASSED` (exit 0).
- [ ] **R13:** copy `M1b.5`'s detail — `<N> tree txs, <T> ms` — into the checkpoint record. If the banner
      `R13 TRIGGER REACHED … PRE-MAINNET` is printed, the coordinator tree indexer becomes a pre-mainnet item (§13):
      record that too. `M1b.5` passes either way (it is a measurement); it fails only when the phone's numbers are
      not consistent with the chain's list.
- [ ] **The gap limit (R1-m4, S15):** `M1b.5`'s detail also carries `<K> counters tried, highest counter hit <H> (gap
      limit 100)` — copy it too. The restore walks the deposit counters 0, 1, 2, … and stops after **100 consecutive
      counters with no deposit on chain**; a counter is never handed back, so a deposit that expired (never landed) or
      was front-run still uses one up. **100 consecutive expired or front-run deposits therefore hide every later
      deposit of this wallet from a restore from the phrase** (the funds are on chain, the app does not find them).
      You decided it (S15, "gap limit 100"): the limit is 100 (was 20) from M1c on. For a devnet wallet that made
      only this checkpoint's two deposits, expect `highest counter hit 1` and `102 counters tried` (`0` / `101` if
      the killed deposit never landed).
- [ ] **Then clear the phone's log** (R1-m6): `adb logcat -c`. The readout lines stay in the phone's log buffer
      until it rotates, and together they are this devnet wallet's note set (public values each, but a full list of
      its deposits, commitments and leaf indices). A bug report (`adb bugreport`, or one taken from the phone's
      developer options) taken on this phone while the devnet app has been used carries them: clear the log before
      you take or share one.

## Record it

- [ ] Keep `build/m1b-checkpoint/` — `readouts.jsonl`, `kill.json`, `wipe.json`, `chain.json` (the devnet reads, with
      the RPC host and time), `i3-jest.json`, `launches.json`, `installs.json` / `installs.log.jsonl`, every
      `rollback-*/`, `apks/COMMIT`, `apks/SHA256SUMS`, `apks/CONFIG.json` — and paste the PASS lines, the commit, the two
      deposit signatures, their leaf indices and R13's two numbers into the checkpoint record.

## The rules (fail closed)

- Installs: exactly M1a's (`../m1a-checkpoint/README.md` "The install rules"): never an uninstall; the signer read and
  compared before every install; absence only by two agreeing readings; no wallet installed → `NO WALLET INSTALLED`
  and STOP unless `--allow-fresh-production`; a failed pull, an existing rollback with other contents or an
  `INSTALL_FAILED_*` → STOP (exit 3) with no further adb call.
- The wipe: `pm clear com.nocturawallet.devnet` only, from `wipe` only (a frozen argument list; every other adb call
  goes through the guard that refuses any `clear`), only with `--confirm-wipe com.nocturawallet.devnet`, only for an
  installed devnet app signed by this checkpoint's key. Nothing else is ever cleared.
- The kill and every cold start: `am force-stop` — a process stop, no data touched.
- The network: devnet only (the genesis hash is checked in every batch); never `*.noc-tura.io`, `solscan.io` or mainnet.

## If a line fails

| line | means | look at |
|---|---|---|
| M1b.1 | the deposit is not on devnet, failed, or was signed / paid / deposited by another account than `--main` | `chain.json` → `txs`, the `--main` you passed |
| M1b.2 | the app's leaf index or root is not the `LeafInserted`'s — **stop**: the app would build wrong paths | the readout and the tx's logs |
| M1b.3 | no wipe, another package, or the next start found a record (the wipe did not clear the encrypted store) | `wipe.json`, the first `startup` readout after it |
| M1b.4 | a landed deposit did not come back, or came back at another leaf / amount | the `startup` readout's `notes` |
| M1b.5 | the phone's count is not within the chain's list (more than listed, or fewer than listed a minute before its run) | `chain.json` → `tree` |
| M1b.6 | no kill, too late, not reconciled, or still pending (then: wait ~4 min — the blockhash expiry + the 300-block margin —, restart the app, `collect`, `verify`) | `kill.json`, the `startup` readout after it |
| M1b.7 | the I-3 test failed or ran at another commit | `i3-jest.json` |
| M1b.A1–A3 | the APKs are not the devnet / production builds of this commit | `apks/CONFIG.json`, `apks/COMMIT` |
| M1b.8–10 | a launch failed, crashed, or the production app wrote a readout line (**the gate leaked** — stop) | `launches.json`, `crash-*.txt` |
| `STOP: …` (exit 3) | an install or the wipe was not safe to make | the message, `installs.json` |
| `INVALID readout …` | a line that is not the app's format | the raw log |

## What only the phone proves

The desk tests (`node --test scripts/m1b-checkpoint/*.test.mjs`) and the app's Jest suites run everything against
recorded devnet data. Only this run on the phone shows: that the release app's `console.info` reaches the log (the
readout's channel), the real deposit's proof accepted by the program, its leaf, the restore's real count and duration
on this phone (R13), that `pm clear` really empties the encrypted store and keychain so the next start restores, that
a force-stop between submit and confirm leaves a pending note the next start reconciles, and that both release APKs
of this commit start — the production one with its unlock — without a crash and without a readout line.

## Your visual pass — EVERY design departure (Tasks 5 and 6)

Your design (`index.html` + `screen.md`) is the source of truth; these are all the places where the devnet build
departs from it, said loudly so that nothing is silently missing. Look at each on the phone; any of them you do not
accept is a change request.

**Across #16–#21**
- No hosted-prover button, sheet or "Local prover slow?" link anywhere (A0 has no hosted proving).
- No USD figures (the devnet test token has no price).
- The design's privacy-claim copy on #19–#21 is refused by the privacy-claims guard and replaced (a deposit is public).

**#16 (Shield)**
1. One tab, "Make private", full width; "Make public" and the unshield side (states 2 and 5) are hidden until M1c (no
   route parameter, no deep link).
2. The token is the pool's single token "TEST", not a selector; the caption is D27 copy.
3. Undrawn row "Deposit record rent ≈ 0.00069596 SOL"; "ZK proof fee · None · made on this device".
4. No 5-bar anonymity meter: "Notes in the pool after this deposit" is a number (the chain's count + 1, spec I4).
5. The CTA amount is the token amount, nothing subtracted.
6. Undrawn: the shielded-balance line and its four banners (restoring / not loaded + Retry / could not be restored ·
   code + Retry / no prover); the "Not enough SOL" warning; the malformed-amount helper; the "Pending · not confirmed
   yet" caption with "Check again" / "Checking…" and its result note.

**#18 (proof)**
7. No "%": the stage rows show measured times and row 1's live sub-step; the hero sub-lines say what is happening; the
   active-row shimmer is not animated.
8. The failed state has one CTA, "Retry on this device", with the E_A0 code.
9. Undrawn: the auth state "waiting for you to unlock".

**#19 (simulate)**
10. "Privacy preserved" is replaced by "A public deposit · PUBLIC"; the eyebrow pills are one CU line.
11. No "Continue anyway" on a failed simulation; no "LAST KNOWN STATE" card; undrawn "Nothing to review" for a stale
    intent.
12. **No "Network fee + priority breakdown":** the deposit sets no compute-unit price, so there is no priority part
    to show (Task 5 review — undeclared until now). "Priority · none" would be truthful if you want the row.

**#20 (confirm)**
13. FROM / TO / SIGNS / NETWORK ("Solana devnet") rows and the caption; no USD line, no ANONYMITY row, no PRIVATE /
    SHIELDED pills on a public deposit, no first-recipient / high-value cards; undrawn stale state.
14. **No "Priority" row** (same reason as 12; Task 5 review — undeclared until now).

**#21 (status)**
15. "Shielded · your note is at position #N in the pool" instead of the refused sender-privacy copy; the Position and
    Fees rows; no POOL ROOT row; TO is "the pool".
16. **"View details" opens the explorer** (`explorer.solana.com/tx/<sig>?cluster=devnet`), **not #27** (R1-m2).
17. **No ~90 s stuck-tx redirect to #54** (R1-m2): a pending deposit belongs to the reconciliation — the next start,
    or "Check again".
18. **The predictive-back lock is a plain `Alert('Shield in progress', …)`**, not the design's "Tx in progress ·
    returning here on completion" modal, and it does **not** auto-dismiss when the tx settles (Task 5 review —
    undeclared until now).
19. Undrawn states: "Not confirmed yet" (PENDING, its copy mentions "Check again"), "Not shielded", "Not sent",
    "Nothing to send", "Not in this wallet" (the wallet was wiped and replaced while the deposit was in flight).

**#11 (dashboard — M1d's screen; only the minimum to be truthful)**
20. The token-amount hero and its four state lines; "Anonymity set · N" from A0; one asset row with the pending line
    and "Check again"; the footer banner's new copy.
21. In the devnet build: no Send in shielded mode, no shielded Receive (Receive is transparent only until M2), no Buy,
    no presale banner, no "Refer a friend" (presale, staking, the purchase geo gate and the presale referral are off
    on devnet — widened by ruling, you may narrow it).

**The transparent send and onboarding in the devnet build (Task 6, S13)**
22. The transparent send's #20 says "Network · Solana devnet", #21 "Confirmed on Solana devnet", and its "View
    details" opens the block explorer you chose with `?cluster=devnet` (Solscan by default; a Solana FM choice opens the
    Solana Explorer on devnet).
23. Onboarding ends on the dashboard, not on the presale screen (presale is off on devnet).

**Settings**
24. "Export view key" disabled, "Not available in this version."; Wipe wallet warns about shielded notes (it names the
    recovery phrase).

**One behaviour to see once (safe, but you should expect it)**
- [ ] **A session lock during #18 or #21** (the app's session timeout locking it — e.g. you leave the app in the
      background past the timeout while the proof or the send runs) resets the app to **Unlock**. The proof or the submit keeps running in the background, but **#21's result screen
      is never shown**: after unlocking you land on the dashboard with the deposit as **"pending" + "Check again"**
      (for #18: the prepared deposit is simply replaced by the next one; nothing was sent). Tap Check again (or
      restart) and it settles. Nothing is sent twice and nothing is lost.
