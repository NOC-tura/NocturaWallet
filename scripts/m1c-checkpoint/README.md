# M1c checkpoint — the owner's checklist (both checkpoints)

Spec: `docs/superpowers/specs/2026-11-08-shielded-a0-m1-design.md` §6.0 and §16 "Checkpoints · M1c":

> **First checkpoint:** unshield part of the deposit through the relayer to "Another address" (a devnet address
> outside this seed), and once to "My main account" after its warning. The desk script, from each signature, asserts
> every §6.8 condition — above all, no signer of the tx is a key of this seed […]. Wipe and restore: the change notes
> come back. The owner's visual pass of the destination choice, the warnings and the native dialog. (A `cli` wallet's
> unshield to "Another address" is exercised once with a second phrase.)
>
> **Second checkpoint (once P1 is live):** unshield to a fresh account. The desk script asserts every §6.8 condition,
> that the owner's pre-balance was 0, that exactly one grant of `gasGrantLamports` from the relayer's fee payer
> reached it, and that the fresh account holds the token amount. A second unshield started while the first was
> pending picked the next index (`fresh-pending`). Wipe and restore: the change note and the fresh account come back.

and "each checkpoint also builds the production APK of the same commit and launches it". P1 and P2 are live on
devnet (coordinator 37ad673), so **both checkpoints run in one phone session**, in the order Another → Main → Fresh.
Two lines of the spec read differently since P1 is live (controller ruling 4, a spec rev 3.4 line):
- the first checkpoint's "no grant was given (no P1 yet)" — the relayer now grants a fresh 0-SOL owner, so the
  "Another address" you use must **hold devnet SOL** (then it gets no grant), and "My main account" holds SOL anyway;
- "the fresh-account option is visible, disabled, with its reason" cannot be seen any more (the quote carries the
  grant): **the fresh account is PRESELECTED** on #16 "Make public". For CP1 you deliberately tap another row. The
  disabled state is proven in Jest against a grant-less quote (Task 7 / Task 8 rows), not here.

## What is what

| piece | where | who |
|---|---|---|
| the unshields (#16 "Make public" → the destination → amount → **two prompts** → #18 → #21), the deposits, the unlocks, the imports of the phrases, looking at the screens | the phone, the **devnet app** ("Noctura devnet") | **you, by hand** |
| the readout: one log line per unshield before its submit (`unshield-submitting`: owner, token account, amount, fee, the quote's fee payer and grant, the wallet's kind, the registry's addresses and roles, the hold) and after it (`unshield-outcome`), the pending unshields' reconciliation (`unshield-reconcile`), after each start the registry, **the seed's public keys** and the restore's counters (`startup-accounts`, once per start), the hold (`submit-hold` armed / taken / expired) — **public values only**: no index, no rho, no nullifier, no amount of a change note, never the app verifier's detail text | `src/modules/shielded/a0/checkpointReadout.ts` — **devnet build only** | the app |
| the one-shot **submit hold** (CP2b): the desk's link `noctura://a0-hold-next-submit` makes the NEXT unshield wait 30 s after its pending write, so the desk can kill the app before anything is sent. **The arm lapses after 10 minutes** (the next unshield then reads out `submit-hold expired` and is not held) | `src/modules/shielded/a0/submitHold.ts`, entering the flow only through the run screen's `holdMs` — devnet build only (the gate is the readout's) | the app |
| installs (M1a's `install.mjs`, unchanged), the hold + kill, the wipe (or recording yours), the launches, the phone's API level, the instrumented window test | `scripts/m1c-checkpoint/m1c-checkpoint.mjs` (+ `device.mjs`) | this laptop, over adb |
| the judgement: EVERY signature a readout names (each `unshield-outcome`, whatever its status, and each `unshield-reconcile` settled one) read from devnet by the desk's OWN decoder (`chain.mjs`, wire bytes + the IDL layouts; not the app's verifier) for every §6.8 condition; the relayer fee payer's own signature list for the session, so that a landing NO readout names is seen; the held account's history; the deployed binary's sha256; `wchange_vk` against the pinned VK | `m1c-checkpoint.mjs verify` | this laptop |
| the desk's own tests | `node --test scripts/m1c-checkpoint/*.test.mjs` (also in CI) | no phone, no network |

**The phone reports, the chain decides.** The desk never holds a seed: "no signer is a key of this seed" is checked
as *the signers are exactly `[3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe]`* (the pinned relayer fee payer) **and**
*none of the seed's public keys the app read out is a signer, and the only one in the tx at all is the destination
owner* (controller ruling 5). The seed's public keys are those of the `startup-accounts` line of the SAME app start
(the registry, the `cli` key and `slip10:0`), joined with the registry on the unshield's own line; an unshield whose
start read out no keys fails (the check passes only on a set it read). The desk never signs or sends anything.

**What the restore's counters on `startup-accounts` count** (they are information, no line is judged on them):
`changeNotes` — change notes the restore imported; `unmatchedChangeLeaves` — spends of your notes whose change was not
imported (three cases in one count: a Withdraw event without its instruction, a change below zero, a change commitment
that is not yours); `attributionCalls` — the local `matchSpent` calls that attributed spends (no network request);
`accountIndicesTried` — the `slip10` accounts the account walk derived; `exitAccounts` — the accounts the walk matched
to an exit, **your main included** when an unshield went to it (it is not a count of fresh accounts).

**Two prompts per unshield (expected).** First the app's keychain (fingerprint / device credential — as for a deposit):
it unlocks the keys. Then the **native confirmation dialog** (Kotlin, not React Native) shows the full destination,
its token account, the amount, the relayer fee and the pool, and asks its own BiometricPrompt: that is the approval
(S4). Merging the two would put the approval outside the native boundary.

## Before you start

- [ ] **The phone** (OnePlus 9 Pro LE2123) is reachable over adb — USB, or wireless (`adb pair <ip:port>` once, then
      `adb connect <ip:port>`; `adb devices` lists exactly one `device`, or pass `--serial <ip:port>` everywhere).
      **Keep the phone UNLOCKED with the screen on for the whole session** (Settings → Display → screen timeout 10 min,
      or "Stay awake" in Developer options while charging): wireless adb drops when the phone locks, and `am start`
      does not start an activity behind the lock screen. If a command says "expected exactly one device": unlock,
      Developer options → Wireless debugging → note the new port → `adb connect <ip:port>` (after a reboot or a
      Wi-Fi change: "Pair device with pairing code" → `adb pair <ip:port>` again). The readout lines stay in the
      phone's log buffer while adb is gone — `collect` picks them up after the reconnect.
- [ ] **`.env.devnet`** is M1b's (`scripts/m1b-checkpoint/README.md` "Before you start") with
      `API_BASE=https://api.noc-tura.io/api/v1` (Task 1's gate). The scripts never touch your env files.
- [ ] **The devnet app's recovery phrase ("the primary phrase") is on paper.** The wipe destroys the devnet wallet
      and you restore it from that phrase (the app can never show it again — memory: the seed-reveal gap).
- [ ] **A SECOND phrase, a `cli` wallet** (S9: the solana-keygen derivation, no fresh accounts). Make it on this laptop:
      ```bash
      solana-keygen new --no-outfile --no-bip39-passphrase --word-count 12
      ```
      Write down the 12 words and the printed `pubkey:` — call it **CLI_MAIN**. It is a devnet-only test wallet.
- [ ] **The production wallet's recovery phrase is at hand** (step 9 installs the production APK over it, data kept).
- [ ] **The rollbacks** — exactly M1a's (every installed APK pulled into `build/m1c-checkpoint/rollback-<pkg>-<sha>/`
      before the first install; keep the FIRST one, `installs.log.jsonl`'s earliest entry).
- [ ] The commit to check is checked out and the tree is clean (`git status`).

### SOL, test tokens and notes (devnet)

```bash
node scripts/m1c-checkpoint/m1c-checkpoint.mjs balances --address <PRIMARY_MAIN> --address <CLI_MAIN>
```
(PRIMARY_MAIN: the devnet app's main account, its Receive screen.)

- [ ] **CLI_MAIN holds devnet SOL** before CP1a (the public faucet `https://faucet.solana.com`, devnet, 1 SOL). It is
      CP1a's "Another address" — a 0-SOL owner would be granted 3,000,000 lamports by the relayer, and C1 judges the
      no-grant shape — and it pays its own deposit in CP1c.
- [ ] **The primary wallet holds at least TWO unspent notes** — CP2b pends one note while the next unshield spends
      another (one unshield per process; a pending note is never a source). After M1b's checkpoint it holds two
      (1,000,000 and 500,000 base units). `collect` after an unlock prints the `startup` line; its `notes.unspent` is
      the count. If it is below 2: shield one more deposit first (M1b README step 3).
- [ ] The relayer fee is 10,000 base units per unshield (the quote's `minFee.withdraw_change`); the amounts below are
      small on purpose.

## 1. Build the APKs (one commit)

```bash
ANDROID_NDK_HOME=~/Android/Sdk/ndk/27.1.12297006 \
NOCTURA_A0_KEYS_DIR=<program side>/zk/keys/v2 \
  scripts/m1c-checkpoint/build-apks.sh
```
(≈ 40 min; never at the same time as Jest or cargo.) With `NOCTURA_A0_KEYS_DIR` it also builds
`devnet-androidTest.apk` (Task 6's instrumented `A0ConfirmWindowTest`, step 10) and checks with M1a's reading that
the harness is in neither release APK.

- [ ] It ends with `PASS M1c.A1`, `PASS M1c.A2`, `PASS M1c.A3`, `control OK …`, the sha256 sums. The APKs are in
      `build/m1c-checkpoint/apks/` with `COMMIT`, `SHA256SUMS`, `CONFIG.json`.

## 2. Install the devnet app, and Task 1's gate

```bash
node scripts/m1c-checkpoint/m1c-checkpoint.mjs install --apks build/m1c-checkpoint/apks
node scripts/m1c-checkpoint/m1c-checkpoint.mjs pinned-control --apks build/m1c-checkpoint/apks
#    The record: build/m1c-checkpoint/{readouts.jsonl,pinned-control.json}
#    pinned-control.json's "judgedRun" is the run key that was ACTUALLY judged (review C1: never a
#    stale earlier run on record) — null means every line FAILED because no new run appeared.
```
- [ ] `PASS M1c.L1` (launch), and `GATE PASSED` (M1c.P0–P3, Task 1's section below). Open the devnet app and unlock.

In a second terminal keep the log recorded from now on (each readout prints a `readout <id> <event> …` line):
```bash
node scripts/m1c-checkpoint/m1c-checkpoint.mjs watch
```

## 3. CP1a — "Another address"

Dashboard → Shielded → **Make public** (#16). The destination card shows **"A new account" PRESELECTED** (P1 is live).
**Tap "Another address"** and paste **CLI_MAIN** (it is outside the primary seed, and it holds SOL).
- [ ] Its warning says it is a payment to someone else. Amount **0.0001** (100,000 base units). The fee row and the
      amount line show the 10,000-unit relayer fee coming out of the shielded balance.
- [ ] Tap Make public: **prompt 1** (the keychain), then **the native dialog** — read it: the full CLI_MAIN, "token
      account" with its full address, "Destination receives exactly 0.0001 TEST", "Relayer fee 0.00001 TEST taken from
      your shielded balance", the pool — and **prompt 2**. #18's rows (sync, quote, approval, proof), then #21
      "Unshielded" with its CONFIRMED line, the change line.
- [ ] The watch printed `unshield-submitting external` and `unshield-outcome external spent`.

## 4. CP1b — "My main account" (after its warning)

Make public again → **tap "My main account"** → read its warning ("this links your exit to your deposit") → amount
**0.0001** → the two prompts → #21 "Unshielded".
- [ ] The watch printed `unshield-outcome main spent`. No grant (the main holds SOL); its token account existed, so
      the relayer's create-ATA is a no-op — `verify` checks both on the chain.

## 5. CP2a — the fresh account

Make public → leave **"A new account"** selected (its caption names the SOL the relayer grants) → amount **0.00001**
(10,000) → the two prompts → #21 "Unshielded" with the grant line.
- [ ] The watch printed `unshield-outcome fresh spent`.

## 6. CP2b — a second unshield while the first is pending

Stop the watch (Ctrl-C) and run:
```bash
node scripts/m1c-checkpoint/m1c-checkpoint.mjs hold-kill
```
It records the log, sends `noctura://a0-hold-next-submit` to the devnet app (the app comes to the front) and waits for
`ARMED`. Then, on the phone: Make public → "A new account" → **0.00001** → the two prompts → the proof. Right after
the proof the app writes its pending unshield and **holds the submit for 30 s**; the desk sees the held
`unshield-submitting` line and force-stops the devnet app at once (`KILLED …`, → `kill.json`). **Nothing was sent.**

- [ ] **Within 5 minutes:** reopen the devnet app and unlock. The startup's reconciliation finds the unshield pending
      in its window (`readout … unshield-reconcile`) and keeps its fresh account reserved (`fresh-pending`).
- [ ] Start the **second** unshield at once: Make public → "A new account" → **0.00001** → the two prompts → #21
      "Unshielded". It reserved the NEXT fresh account (the first one is still reserved) and spent your OTHER note.
- [ ] Restart `watch` (or `collect` now and then).
- [ ] **Wait at least 5 minutes after the kill** (the chain's clock must pass the submit + 300 s), then tap
      **"Check again"** (dashboard or #16). The pending unshield is put back: the balance includes its note again,
      `readout … unshield-reconcile` with `reverted 1, released 1`. If it says still pending, wait a minute, tap again.

If `verify`'s M1c.F2 says the held unshield read out an outcome before the kill, or the second did not see the first
reserved (you were slower than 5 minutes), repeat this step — a hold costs nothing. **The arm lapses after 10
minutes:** if you start the unshield more than 10 minutes after `ARMED`, the app reads out `submit-hold expired`, does
NOT hold it, and the desk does not kill it (it is an ordinary unshield) — run `hold-kill` again and start the unshield
at once.

## 7. Wipe and restore (the primary wallet)

- [ ] First **close and reopen the devnet app, and unlock** (the `startup` readout of the notes before the wipe — the
      desk compares the restore with it; `verify` refuses a wipe made before it).

**The wipe: `pm clear` where the phone allows it — your OnePlus does NOT.** On it `adb shell pm clear` answers
`java.lang.SecurityException: … CLEAR_APP_USER_DATA`, the desk STOPs (exit 3, nothing cleared) and tells you to wipe by
hand. So on this phone use the **manual** wipe — the desk sends no clear at all, prints your steps, waits for you,
and records exactly what you did:

```bash
node scripts/m1c-checkpoint/m1c-checkpoint.mjs wipe --apks build/m1c-checkpoint/apks \
  --confirm-wipe com.nocturawallet.devnet --manual clear-data
```
`clear-data` = Android Settings → Apps → **"Noctura devnet"** (`com.nocturawallet.devnet`, NOT "Noctura") → Storage →
Clear storage. (`--manual in-app` = the devnet app's Settings → Wipe wallet; `--manual reinstall` = uninstall
"Noctura devnet" by hand, then `install` again.) Press Enter in the terminal **as soon as the wipe is done, before you
import**. It writes `wipe.json` with `"answer": "manual: clear-data"`; the restore is judged by the FIRST start after
it, which must report `restoredBecause: no-record` (a wallet record that survived your wipe makes that line fail).
On a phone that allows it, the same command without `--manual` sends M1b's one `pm clear` (exact package, typed
confirmation, the checkpoint's signer).

- [ ] Open the devnet app: onboarding → **Import** the primary phrase → unlock. "Restoring from the chain…", then the
      balance: the change notes are back.
- [ ] `collect` prints `readout … startup ready restored (no-record)` and `readout … startup-accounts …` (the
      registry: your main and the fresh accounts of steps 5 and 6 as `fresh-exit`; the held one is not there — it
      never touched the chain).

## 8. CP1c — the `cli` wallet (the second phrase)

```bash
node scripts/m1c-checkpoint/m1c-checkpoint.mjs wipe --apks build/m1c-checkpoint/apks \
  --confirm-wipe com.nocturawallet.devnet --manual clear-data --label cli
```
(`--label cli`: this wipe is recorded in `wipe-cli.json`; the judged wipe of step 7 stays `wipe.json`.)
- [ ] Import the **second** phrase; on "Select account" choose the account whose address is **CLI_MAIN** (the
      solana-keygen one — it holds SOL, so it is listed first). Unlock.
- [ ] Shield **0.00005** from it (#16 Make private → #18 → #19 → #20 → #21 — CP1a's tokens).
- [ ] Make public: **no "A new account" option** — the card says why (a cli wallet has no fresh accounts, S9);
      nothing is preselected. Tap "Another address", paste **PRIMARY_MAIN** (it holds SOL), amount **0.00002** → the
      two prompts → #21 "Unshielded".
- [ ] (Optional) wipe again with `--label back` and import the primary phrase, so the devnet app holds your primary
      wallet again.

## 9. The production APK of the same commit

```bash
node scripts/m1c-checkpoint/m1c-checkpoint.mjs prod --apks build/m1c-checkpoint/apks
```
- [ ] `PASS M1c.L2` (started, alive after 10 s, clean crash buffer, **no readout line**). Then **unlock the production
      wallet** (do not open the devnet app) — the A0 modules load at unlock in every build — and:
```bash
node scripts/m1c-checkpoint/m1c-checkpoint.mjs prod-check
```
- [ ] `PASS M1c.L3`.

## 10. The phone: its API level and the confirmation window

```bash
node scripts/m1c-checkpoint/m1c-checkpoint.mjs phone --apks build/m1c-checkpoint/apks --instrument
```
It records the model and `ro.build.version.sdk` (→ `phone.json`): **the API level decides which row of Task 6's
authenticator matrix your unshields proved** — API 30 and up: `BIOMETRIC_STRONG | DEVICE_CREDENTIAL` (the prompt
offers your PIN too); 24–29: `BIOMETRIC_STRONG` only. With `--instrument` it installs `devnet-androidTest.apk`
(M1a's rules) and runs `A0ConfirmWindowTest` (≈ 1 min, keep the phone unlocked): FLAG_SECURE on the dialog,
overlay hiding on API 31+, an obscured tap dropped, a partly obscured one ignored, a null activity, a second request,
a recreation and a timeout refused. (The test APK `com.nocturawallet.devnet.test` holds no user data; removing it
later is your own command, never the desk's.)
- [ ] `… API <n>: <row>; A0ConfirmWindowTest: PASS OK (6 tests)`.

## 11. Verify

```bash
node scripts/m1c-checkpoint/m1c-checkpoint.mjs verify --apks build/m1c-checkpoint/apks
```
It reads from devnet (genesis-checked, `api.devnet.solana.com`, one request at a time — the public RPC refuses
batched account reads with 429): the transaction (`encoding: base64`) of every signature a readout names — an
`unshield-outcome` of any status (a tx that landed after the app said "Not confirmed yet" included) and every one an
`unshield-reconcile` settled —, the relayer fee payer's signature list from 2 minutes before your first unshield on
(and each of its transactions), the held fresh account's signature list, the A0 program's programData and
`wchange_vk`; then prints:

```
PASS  M1c.P0–P3  (Task 1's gate, judged again on the recorded lines)
PASS  M1c.V    EVERY relayed unshield the phone recorded passes every §6.8 condition on its own devnet transaction (the desk's decoder), above all: the only signer is the pinned relayer fee payer and no key of this seed signed
PASS  M1c.C1   CP1: an unshield to "Another address" (a devnet address outside this seed): every §6.8 condition, the address is no key of this seed, no grant (it holds SOL)
PASS  M1c.C2   CP1: an unshield to "My main account" (after its warning): every §6.8 condition, the owner is the registry's main, no grant, the create-ATA a no-op (its token account existed)
PASS  M1c.C3   CP1: the cli wallet (a second phrase) unshields to "Another address": every §6.8 condition; its registry is the main alone (no fresh accounts, S9)
PASS  M1c.F1   CP2: an unshield to a fresh account: every §6.8 condition; the owner's pre-balance 0; exactly one grant of gasGrantLamports from the relayer's fee payer reached it; its token account holds the amount; reserved fresh-pending, then fresh-exit
PASS  M1c.F2   CP2: a second unshield started while the first was pending picked the next index — its fresh account is a new one, reserved while the first's was still fresh-pending (the readout carries no index, by design)
PASS  M1c.F3   CP2: the held unshield never reached the chain: its fresh account has no history on devnet, and once the chain's clock passed submit + 300 s the reconciliation put the note back (reverted) and released the reservation
PASS  M1c.R1   wipe and restore: ONLY the devnet app's wallet wiped (pm clear com.nocturawallet.devnet, or by the owner's hand, recorded), then the first start found no record and restored from the phrase
PASS  M1c.R2   wipe and restore: the change notes come back — the restored unspent notes are exactly those before the wipe (commitment, leaf, amount), among them the change leaves of this checkpoint's unshields
PASS  M1c.R3   wipe and restore: the fresh accounts come back — every fresh account an unshield of this checkpoint landed on is fresh-exit in the restored registry, and nothing is fresh-pending
PASS  M1c.K1   the deployed A0 program: the programData's ELF has sha256 b0054981ab0019ff… (the upgrade of 2026-11-17, R1′)
PASS  M1c.K2   the withdraw_change VK read from chain (wchange_vk, PDA ["wchange_vk", pool]) equals the pinned withdraw_change_vk.json (R1-I6)
PASS  M1c.A1–A4, M1c.L1–L3, M1c.N1, M1c.N2
CHECKPOINT PASSED
```
- [ ] Every line `PASS`, the last `CHECKPOINT PASSED` (exit 0). `chain-facts` alone reads K1 / K2 at any time.
- [ ] **Then clear the phone's log** (as M1b, R1-m6): `adb logcat -c`. The `startup-accounts` lines list this devnet
      wallet's public keys together (that is what the no-seed-signer check needs) and the unshield lines its registry —
      public values each, but together they say which addresses are one wallet's. **A bug report taken before
      `adb logcat -c` carries that linkage**: clear the log before you take or share one.

## Reading a FAIL

| line | what it means / what to do | look at |
|---|---|---|
| M1c.V | a landed unshield is not what the phone said, or a §6.8 condition fails on the chain — the detail names the check (`program`, `pool`, `withdraw-event`, `change-leaf`, `fee-payer`, `fee-destination`, `fee`, `destination`, `grant`, `create-ata`, `no-seed-signer`). **`fee-payer` or `no-seed-signer`: STOP and report** — a key of this seed may have signed (or, with "0 seed keys read out", the app start before that unshield read out no `startup-accounts` keys: `collect` missed it — the log of that start is gone, so repeat the unshield after a fresh start) | `chain.json` → `txs` |
| M1c.V `UNACCOUNTED landing <sig>` | the relayer landed a withdraw to a token account, amount and fee you submitted, and NO readout names its signature (the app may have shown "Not confirmed yet" and never learned the result). **Report it with the signature.** `collect`, tap "Check again" in the devnet app, `collect` and `verify` again: a reconcile that settles it names it | `chain.json` → `feePayerTxs` |
| M1c.V `named by a reconcile: no unshield-submitting line before it` / `named by an unshield-outcome …: no unshield-submitting line` | the app settled (or reported) a signature the desk cannot join to an unshield it saw submitted: a readout is missing from `readouts.jsonl` (`collect` ran too late — logcat's buffer rolled) or something the phone did not report landed. **Report it** | `readouts.jsonl` |
| M1c.V `the relayer fee payer's signatures were not read` | `verify` could not list them (network) — run it again | |
| M1c.V `NOT READ <sig>` / `… devnet answered null to its read` / `… its read is null` | devnet answered null to a transaction the desk needed (a signature the relayer fee payer listed, one the app settled, or one the app said was pending). A null read is "not read", never "did not land": run `verify` again (the public RPC lags or drops a read) | `chain.json` |
| (detail, not a FAIL) `named, not on devnet: <sig>` | the app said "Not confirmed yet" with a signature that never landed: its tx FAILED on chain, or the relayer fee payer's own list (read) does not hold it. Nothing to do — the reconcile reverts it | |
| (banner) `THE APP'S VERIFIER REFUSED` | the app showed "Landed, but failed verification" (#21, loud): report the signature and the code; never repeat that unshield | the readout's `code` |
| M1c.C1 | the "Another address" got a grant (it held no SOL — fund it and repeat CP1a), or it is a key of this seed | its detail |
| M1c.C2 | the owner was not the registry's main, or a grant / a created token account | its detail |
| M1c.C3 | no cli unshield, or the cli wallet's registry holds more than its main | step 8 |
| M1c.F1 | no grant / another amount / the owner had SOL before / the token account existed / the role did not go fresh-pending → fresh-exit | its detail |
| M1c.F2 | no kill, the kill too late, no pending at the next start, or the second unshield not started while the first was reserved — repeat step 6 | `kill.json`, the readouts |
| M1c.F3 | the held account HAS history (**stop: something was sent**), or no revert yet (wait, "Check again", `collect`) | `chain.json` → `histories` |
| M1c.R1 | no wipe record, another package, or the first start after it found a record (the wipe did not clear the wallet) | `wipe.json` |
| M1c.R2 | the restart before the wipe is missing / older than the last unshield (reopen, unlock, wipe again), or a note did not come back | the two `startup` readouts |
| M1c.R3 | a fresh account did not come back as `fresh-exit` (or a `fresh-pending` came back) | the `startup-accounts` readout after the wipe |
| M1c.K1 | the deployed binary is not `b0054981…` — the program changed; **stop**, ask the program side | `chain.json` → `facts` |
| M1c.K2 | the chain's `wchange_vk` is not the pinned key — **stop**: every proof the app makes would fail, or a different circuit is live | `chain.json` → `facts.vk` |
| M1c.A*, L*, N* | as M1b; N2: the window test failed — read `instrument-confirm.txt`; if only the overlay row failed, read `adb shell dumpsys window windows` for the dialog's `pfl=` before calling it a product failure (Task 6) | |
| `STOP: …` (exit 3) | an install or the wipe was not safe to make (the OnePlus `pm clear` refusal included — use `--manual`) | the message |

## What only the phone proves (and what it does not)

Only this run shows: the relayer landing OUR proofs (the program verifying them against the chain's `wchange_vk`), the
grant reaching a fresh 0-SOL owner, the native dialog and the BiometricPrompt on this phone's OEM build (if the
prompt paused the activity, every confirmation would fail closed with `E_A0_CONFIRM_INTERRUPTED` — visible at once),
FLAG_SECURE / overlay hiding on a real window, a kill inside the hold reconciled at the next start, a wipe + restore
bringing the change notes and the fresh accounts back from the chain, and both release APKs of this commit starting.

Not proven here (and where it is): the fresh option *disabled* without a grant (Jest, Tasks 7 / 8 — the quote now
grants); the I-3 "no note-specific request" property of the restore (M1b's `restoreRequests.test.ts`, at this commit in
CI); "picked the next index" as a NUMBER (the readout carries no index by design — the desk proves a new account,
reserved while the first was still reserved; the index rule is Task 2's / Task 7's Jest rows); a real overlay drawn
by another app; the relayer's behaviour on mainnet (no grant on mainnet, §0).

## Your visual pass — EVERY design departure still open

Your design (`index.html` + `screen.md`) is the source of truth. Everything below departs from it or is not drawn in
it; look at each on the phone. Any you do not accept is a change request.

**The native confirmation dialog (Task 6) — UNDRAWN in `index.html`:** built from platform widgets
(`android.app.AlertDialog`, text views, two buttons, monospace addresses, nothing truncated), not the design system;
its words are the resource's (`a0_confirm_strings.xml`) and §4's; the token is "TEST" on devnet; the system
BiometricPrompt follows it (two prompts per unshield, above).

**The unshield screens (Task 8) — undrawn, built from the design system:**
1. the **destination card** on #16 "Make public": "Destination" and three rows (icon disc + title + caption + radio):
   "A new account" (the grant in SOL, or the disabled reason), "My main account" (first 6 + last 6, mono), "Another
   address" (opens a mono input with an inline danger helper);
2. the **per-destination warnings** inside the design's "Privacy decreases on public withdraw" banner (its heading
   kept, its body replaced — see departure 5): the main-account warning, the payment warning, the relayed sentence;
3. the **relayer quote states**: "Asking the relayer for its fee…" and "The relayer's quote was refused · <code>" + Retry;
4. the **one-note limit line**, the "no note can pay the relayer fee" warning, the **amount line** under the fee card;
5. the unshield run's **#18 rows** (Sync the pool / Relayer quote / Your approval / Prove), "Approve in the dialog",
   "new confirmation (n of 3)";
6. the **#21 unshield states**: "Unshielded" (CONFIRMED, the grant line, the change line, "Change #n in the pool"),
   "Landed, but failed verification" (UNVERIFIED in danger, a loud box with the code), "Not confirmed yet" (PENDING,
   "Check again"), "Not sent" (+ "Back to unshield"), "Not in this wallet";
7. the parked #21 **deposit** copy: another deposit at this note's number after our confirmed send;
8. **#16's CTA on "Make public"** (m-9): the sticky bottom bar under the scroll area (a top border on the base
   background), the pill button reading **`Unshield TEST`** with no amount and **`Unshield <amount> TEST`** once a
   valid amount is entered (e.g. `Unshield 0.0001 TEST`), grey and disabled until the form is complete; a tap is
   debounced 500 ms and disables it (one unshield per tap);
9. the refused-confirmation copy on #21 ("The confirmation did not complete (<code>): nothing was approved and
   nothing was sent");
10. the own-account refusal on the run screen's #21 layout (a typed address of this wallet): `E_A0_UNSHIELD_DESTINATION
    · That address is …` naming the account's role, "Nothing was sent", "Back to unshield";
11. the loud box of "Landed, but failed verification": the code and one sentence of what it means (never the
    verifier's detail text);
12. the caption **"Unshield <amount> TEST"** under #18's hero sub on the unshield run (the design has no caption there).

**Changed in Task 8's fix round (look at these too):**
- #18's **hero ring** is now drawn on the unshield run, as on the deposit's #18 (the CPU glyph in the shielded-accent
  ring; check, X at the end);
- #21's **dashed warn ring** ("Not confirmed yet" and the other warn states) is now drawn by classes (1.5 px, dashed,
  `#F2B53B`), on BOTH the deposit's and the unshield's #21 — check it matches the design's ring;
- the entered amount is what the destination RECEIVES, with the relayer fee on top; the design's state 5 is gross with
  "You'll receive" below it (5.00 entered → 4.99778 received);
- on "Make public" the shielded-balance line sits above the amount card, beside the design's "Vault balance" row;
- the tab icon is `ShieldCheck`, against the design's `i-shield-lock` (from M1b).

**Departures from what the design draws (Task 8):**
1. no #19 / #20 for the unshield — the native dialog is the confirmation (S4);
2. #18's rows are the unshield's real stages, not "Building witness → Proving → Verifying → Ready";
3. one screen draws #18 and #21 (`UnshieldRun`); FLAG_SECURE on the #18 part, released for #21;
4. back is locked for the whole run (closing the native dialog is the cancel);
5. the withdraw banner's body ("…associated with your transparent address from this point forward") is replaced by
   the destination's §11 warning + the relayed sentence;
6. "You'll receive" → "Destination receives"; the fee rows are A0's (Relayer fee in the token; Network fee — Paid by
   the relayer; ZK proof fee — None · made on this device); no USD lines;
7. no ~90 s stuck redirect to #54; "View details" is the explorer, not #27;
8. the token is TEST on devnet, NOC elsewhere — on every surface, the native dialog included;
9. "(Account N+1)" is dropped from the fresh-account default (the index is known only at the reservation).

**M1b's list (`scripts/m1b-checkpoint/README.md`, Tasks 5 and 6) — still open, except its #16 item 1** ("Make public"
hidden until M1c), which M1c closes in the devnet build:
- across #16–#21: no hosted-prover button / sheet / "Local prover slow?"; no USD figures; the design's privacy-claim
  copy refused by the guard and replaced;
- #16: the single token "TEST" (no selector), D27 caption; "Deposit record rent ≈ 0.00069596 SOL" and "ZK proof fee ·
  None"; no 5-bar meter ("Notes in the pool after this deposit"); the CTA amount is the token amount; undrawn: the
  shielded-balance line and its four banners, "Not enough SOL", the malformed-amount helper, the "Pending · not
  confirmed yet" caption with Check again;
- #18: no "%", measured times, unanimated shimmer; one failure CTA "Retry on this device"; undrawn "waiting for you
  to unlock";
- #19: "A public deposit · PUBLIC"; no "Continue anyway", no "LAST KNOWN STATE", undrawn "Nothing to review"; no
  priority breakdown;
- #20: FROM / TO / SIGNS / NETWORK rows, no USD / ANONYMITY / PRIVATE pills / first-recipient cards; no Priority row;
- #21: "Shielded · your note is at position #N"; Position and Fees rows, no POOL ROOT; "View details" → the explorer;
  no #54 redirect; the back lock is a plain Alert that does not auto-dismiss; undrawn "Not confirmed yet", "Not
  shielded", "Not sent", "Nothing to send", "Not in this wallet";
- #11 (M1d's screen): the token-amount hero and its state lines, "Anonymity set · N", one asset row with the pending
  line and Check again, the footer banner's copy; in the devnet build no shielded Send / Receive, no Buy, no presale
  banner, no "Refer a friend";
- the transparent send and onboarding on devnet: "Network · Solana devnet", the explorer with `?cluster=devnet`;
  onboarding ends on the dashboard;
- Settings: "Export view key" disabled; Wipe wallet warns about shielded notes;
- once: a session lock during #18 / #21 resets to Unlock and #21's result is never shown — the dashboard's pending
  line + Check again settle it.

## The rules (fail closed)

- Installs: exactly M1a's (`../m1a-checkpoint/README.md` "The install rules") through its unchanged `install.mjs`:
  never an uninstall; the signer read and compared before every install; absence only by two agreeing readings; no
  production wallet installed → `NO WALLET INSTALLED` and STOP unless `--allow-fresh-production`; a failed pull, an
  existing rollback with other contents or an `INSTALL_FAILED_*` → STOP (exit 3) with no further adb call.
- The wipe: `pm clear com.nocturawallet.devnet` only (M1b's `clearDevnetAppData`, frozen arguments, typed confirmation,
  the checkpoint's signer); with `--manual` the desk sends **no** clear — you wipe the DEVNET app by hand and the
  desk records it as `manual: <how>`. Never `com.nocturawallet`. Every other adb call goes through the guard that
  refuses any `clear`, `uninstall` or `rm`.
- The kill: `am force-stop` of the devnet app, only on a HELD `unshield-submitting` line (an ordinary unshield is
  never cut).
- The network: the desk reads devnet only (the genesis hash checked first); never `*.noc-tura.io`, `solscan.io` or
  mainnet. The phone talks to the relayer; the desk never does, and never signs or sends a transaction.

## Task 1's gate (`pinned-control`, M1c.P0–P3)

The relayer client's transport hands an HTTP error answer back to the app as an answer, with its status. The desk
sends `noctura://a0-pinned-control`; the devnet app makes three requests and writes one readout line each: a
deliberately malformed `POST …/relayer/submit` (`{"kind":"noctura-m1c-pinned-control"}` — must come back **HTTP 400,
outcome `invalid_request`, not thrown**), `GET …/relayer/quote` (**200**, the A0 pool's quote from
`3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe`), and the **negative control** (request 1 through the pre-fix error
mapping: it **must throw with the status lost**). Run it **at most twice a minute** (two submits per run; the relayer
allows 5 per minute per IP). `--judge-only` judges the recorded lines again.

| line | detail | meaning |
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

