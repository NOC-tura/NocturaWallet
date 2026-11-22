# M1d checkpoint — the owner's checklist

Spec: `docs/superpowers/specs/2026-11-08-shielded-a0-m1-design.md` §16 "Checkpoints · M1d":

> switch to the fresh account and send from it to a devnet address outside this seed, paying only from the granted
> SOL. The desk script asserts the fresh account's history is exactly {the relayed unshield, this send} and that no
> transaction connects it to another account of the seed. The linking warning appears when a send from it to the main
> account is started (and is cancelled, not sent). The owner's visual pass of the account switcher, #11 and #17.

and `docs/superpowers/specs/2026-11-21-shielded-m1d-accounts-design.md` §6 (the visual pass also covers #12 with the
warning, #19/#20, #21). **The phone reports, the chain decides.** The desk never holds a seed and never signs: "another
account of the seed" is the key set the app itself read out at its start (M1c's `startup-accounts` readout).

## Before you start

- [ ] M1c's second checkpoint passed: a **fresh account** exists (an unshield to "A new account" landed, with the
      relayer's SOL grant), and **nothing else** was ever done with it. Its address is in the Accounts sheet
      ("Account N · exit"); its unshield's signature is on that unshield's #21 (Details → Tx hash) and in
      `build/m1c-checkpoint/readouts.jsonl`.
- [ ] A devnet **address outside this seed** — the M1c "Another address" (it already holds devnet SOL). Never an
      address of this phrase.
- [ ] The phone reachable over adb, unlocked, screen on (M1c README "Before you start").

## 1. Build the APKs (one commit)

```bash
ANDROID_NDK_HOME=~/Android/Sdk/ndk/27.1.12297006 scripts/m1c-checkpoint/build-apks.sh build/m1d-checkpoint/apks
node scripts/m1c-checkpoint/m1c-checkpoint.mjs check-apks --apks build/m1d-checkpoint/apks --out build/m1d-checkpoint
```

## 2. Install the devnet app (its data kept)

```bash
node scripts/m1c-checkpoint/m1c-checkpoint.mjs install --apks build/m1d-checkpoint/apks --out build/m1d-checkpoint
```

## 3. Start, unlock, collect the seed's keys

Open the devnet app and unlock it (the start writes the `startup-accounts` readout). Then:

```bash
node scripts/m1c-checkpoint/m1c-checkpoint.mjs collect --out build/m1d-checkpoint
```

`build/m1d-checkpoint/readouts.jsonl` now holds the seed's keys. (If the fresh account's unshield is not in this
file — it ran in the M1c session — `verify` takes it with `--unshield SIG`.)

## 4. The sheet and the switch (on the phone)

- [ ] Tap the avatar (top left of #11): **Accounts** opens. "Account 1 · main" first, then your fresh account
      "Account N · exit" with its short address and balance; no "pending" account; the footer "New accounts appear
      here when you make funds public to “A new account”."; no Add / rename / remove.
- [ ] Tap the fresh account: the sheet closes, the avatar shows **N**, Public mode shows that account's balance —
      the TEST the exit received and the granted SOL — and the line under the toggle reads
      "Public <x> TEST, 0.003 SOL · Private …".
- [ ] Receive shows the fresh account's address with its name; the history shows one transaction (the unshield).
- [ ] Swap and Referral show "From: Account 1 (main)" / "Uses your main account".

## 5. The send (paid only from the granted SOL)

- [ ] Send → token **TEST** → recipient = the outside address (it already has a TEST token account from M1c, so
      no account is created) → amount: part of the exit's TEST (e.g. **0.5**) → #19 reads "From: Account N · …",
      #20's From row "Account N · …" → approve → #21 "Sent successfully". The network fee comes out of the granted
      SOL — the fresh account holds no other SOL. Copy the signature (#21 Tx hash).
      #20 will show its typed-CONFIRM high-value gate for 0.5 TEST; this is expected — type CONFIRM to continue.

## 6. The linking warning (cancelled, not sent)

- [ ] Send again (still from Account N) → recipient = **your main account's address** (Accounts sheet / Receive
      on Account 1). The warning appears under the recipient: "Sending between your own accounts links them on
      chain." Tap the CTA **once**: it reads "Tap again to send anyway". **Do not tap again.** Back out of Send.

## 7. Verify (the desk)

```bash
node scripts/m1d-checkpoint/m1d-checkpoint.mjs verify --fresh <fresh address> --send <step 5 signature> \
  --external <outside address> [--unshield <the fresh unshield's signature>]
```

Wait about 30 s after step 6 first: the signature lists are read at `finalized`, so a send not yet finalized shows as
missing (D1) — run again.

Expected: `PASS` on M1d.D0 … M1d.D6 and `M1d desk: every line PASSED` (exit 0); `build/m1d-checkpoint/verify.json`
is the record.

## 8. The production APK of the same commit

```bash
node scripts/m1c-checkpoint/m1c-checkpoint.mjs prod --apks build/m1d-checkpoint/apks --out build/m1d-checkpoint
```

then unlock the production wallet and run `node scripts/m1c-checkpoint/m1c-checkpoint.mjs prod-check --out build/m1d-checkpoint`.

## Your visual pass

The Accounts sheet (§4); #11 in both modes with the avatar number and the combined line, with balances hidden
("Public ••• · Private •••") and while a non-main account loads ("Public — · …", e.g. in airplane mode); #12 with
the warning and the second tap; #19 / #20 "From"; #21 "Received by" (shown on the NEXT Make public to "A new
account" — optional here); #17's "Who sees what"; Swap / Referral's main-account lines (presale #23 does not exist in the devnet build (S13) — its main-account line is proven in Jest only).
Also check: the pool token TEST now appears on the **main** account's devnet dashboard too; Swap and
Referral with a **non-main** account selected (the "From: Account 1 (main)" / "Uses your main account" line and its
spacing); the combined line "Public … · Private …" fits on one line on the phone; with **TalkBack** on, the linking
warning under the recipient on #12 is read out.
The cli wallet's one-row sheet and the unreadable-registry line are proven in Jest, not on the phone.

## Reading a FAIL

- **D0** — the inputs: the fresh address is not in the app's seed set, is the main account, or the recipient IS a
  key of this seed. Check the addresses you passed.
- **D1** — (the history is the account plus its TEST token account only, not its token accounts of other mints.) The fresh account's history is not exactly the two: a third transaction names it (a stranger's dust, or
  a send you did not intend) or the send is missing (not confirmed yet — wait and run again).
- **D2** — the unshield is not the relayed one that funded an empty account.
- **D3** — the send was not signed and paid by the fresh account alone, did not reach the recipient (or its TEST token account), or failed on chain.
- **D4** — the account held SOL that did not come from the unshield when the send started.
- **D5** — another account of this seed (or its token account) appears in a transaction: the accounts are linked
  on chain. This is the line the whole checkpoint exists for.
- **D6** — the main account appears: the cancelled send was not cancelled.
