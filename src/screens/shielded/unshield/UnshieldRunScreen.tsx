import React, {useCallback, useEffect, useRef, useState} from 'react';
import {View, Pressable, ScrollView, Alert, BackHandler} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import {AlertTriangle, Check, Copy, ShieldCheck, ArrowLeft} from 'lucide-react-native';
import {Text} from '../../../components/ui';
import {cn} from '../../../utils/cn';
import {formatTokenAmount} from '../../../utils/parseTokenAmount';
import {ScreenSecurityManager} from '../../../modules/screenSecurity/screenSecurityModule';
import {unshieldA0} from '../../../modules/shielded/a0/unshieldFlow';
import {takeA0SubmitHold} from '../../../modules/shielded/a0/submitHold';
import type {
  A0OwnAccountRefused,
  A0UnshieldDestination,
  A0UnshieldOutcome,
  A0UnshieldStage,
} from '../../../modules/shielded/a0/unshieldFlow';
import {A0_TOKEN, SOL_DECIMALS, a0ErrorText, displayAmount} from '../../../modules/shielded/a0/screenSupport';
import {keychainManager} from '../../../modules/keychain/keychainModule';
import {mnemonicToSeed} from '../../../modules/keyDerivation/mnemonicUtils';
import {getConnection} from '../../../modules/solana/connection';
import {a0PrivateBalanceNow, useA0Shielded} from '../../../hooks/useA0Shielded';
import {a0CheckCaption, a0UnshieldDecisionFor} from '../../../modules/shielded/a0/unshieldCheck';
import type {A0UnshieldCheck} from '../../../modules/shielded/a0/unshieldCheck';
import {freshExitAccountOf, pendingFreshSchemeOf} from '../../../modules/accounts/receivedBy';
import {shortAccountAddress} from '../../../modules/accounts/accountList';
import {RECEIVED_BY, accountWithAddress} from '../../../copy/accounts';
import {CheckAgainLink} from '../../../components/CheckAgainLink';
import {A0_OWN_ACCOUNT_REFUSAL_COPY, a0RefusalLoudText, a0UnshieldRefusalSentence} from './unshieldCopy';
import {MetaRow, ProofHeroRing, StageRow, StatusRing, shortSignature} from '../shieldedParts';
import {DetailsDisclosure} from '../../../components/private';
import {LEFT_IN_THIS_NOTE, MAKE_PUBLIC, MAKING_PUBLIC, NOW_PUBLIC, PRIVATE_MARK, yourPrivateBalanceIsNow} from '../../../copy/modes';
import type {StageRowStatus, StatusTone} from '../shieldedParts';

/**
 * The A0 unshield run: #18 zk-proof and #21 tx-status for the unshield (spec §6 steps 3–8, §11;
 * M1c Task 8). ONE `unshieldA0` call per mount owns everything secret about the unshield (Task
 * 7's rule), so ONE screen hosts it from the first stage to the outcome and draws two designs:
 *
 *   - #18's layout (mirror index.html §s18, the deposit's #18 as built in M1b) while the stage is
 *     before the submit — four rows driven by the flow's `onStage`, each with its MEASURED time
 *     ("running · 2.1 s", "done · 4.2 s"), never a percentage:
 *       Check the pool ← sync · Relayer fee ← quote · Your approval ← approval (the NATIVE
 *       confirmation dialog, Kotlin, Task 6 — it is the human's step, so its row says "waiting for
 *       you", and its time is the time the human took) · Make the proof ← proof;
 *   - #21's layout (mirror index.html §s21) from the submit on: the spinner while the relayer
 *     submits ("submit") and the wallet reads the landed tx back and verifies it ("confirm"), then
 *     the outcome.
 * A stage the flow enters again restarts its row (the re-quote after the proof, the re-sync after a
 * `relay_failed` that sent nothing); a NEW approval (the terms changed, or the pool's root left the
 * 64-root ring) also restarts the proof, and the hero says a new confirmation is needed (at most 3).
 *
 * THE OUTCOMES, said as what they are:
 *   - spent → "Now public": the destination got the amount, the change note's position; the grant
 *     the new account received, or LOUDLY "no SOL" (`destinationWithoutSol`);
 *   - landed-unverified → LOUD, danger: "Landed, but failed verification: <code> · <what the code
 *     means>" (`a0LandedUnverifiedText` fed from the CODE only — the verifier's `detail` names keys
 *     of this seed and is never rendered or logged, carry 4), whether the note is spent or still
 *     pending, whether the change was recorded, and `linked` when a key of this wallet signed it;
 *     never retried (no retry button);
 *   - pending → "Not confirmed yet" with the relayer's reason and "Check again" (the
 *     reconciliation decides from the chain; never "failed") — EVERY pending reason, a
 *     signature-less `relay_failed` / `unknown` included (carry 2); only the outcome `not-sent`
 *     says not sent;
 *   - not-sent → "Not sent": the relayer's outcome, nothing left the private balance;
 *   - a throw → its code (`a0ErrorText`). A throw once the round reached `submit` (or the re-sync
 *     that follows a submit, before the flow's revert is proven by a NEW approval) is "Not
 *     confirmed yet" + "Check again", whatever its code (carry 9; E_A0_STORE_CHANGED is "Not in
 *     this wallet"); only a throw before the submit says nothing was sent — the native
 *     confirmation's `E_A0_CONFIRM_*` as the refused dialog (carry 6), "Another address" being an
 *     account of this wallet as the flow's own refusal naming its role (carry 3, from the error's
 *     `ownAccount` field). Where a code exists the screen says the code and a fixed sentence, never
 *     the error's message (final review M-4); a message only when there is no code;
 *   - "Check again" decided (final review I-1) → an undecided outcome above becomes "Now public",
 *     "Not sent" (reverted: the note is back) or the loud refusal, and PENDING / "Check again" go.
 *
 * DEPARTURES FROM THE DESIGN (listed for the owner's visual pass): no #19 / #20 for the unshield
 * (the approval is the native dialog — S4: a JS review screen before it would be a second,
 * weaker confirmation of terms the flow re-fetches anyway; #16 shows the amount line and the fee
 * before the tap); #18's rows are the unshield's real stages, not "Building witness → Proving →
 * Verifying → Ready" (the flow's public-input compare is inside its proof stage and has no time
 * of its own); back is LOCKED for the whole run, #18 included (the flow cannot be cancelled once
 * the call started — closing the dialog is the cancel); no "Local prover slow?" / hosted prover
 * (A0 has none); no ~90 s stuck-tx redirect to #54; and the design's [View details] (→ #27) is
 * "Copy signature" (owner-approved 2026-11-20, UX-A 6): it copies the FULL signature (cleared from
 * the clipboard after 30 s, never on background) and says "Copied". NOTHING on this screen opens
 * the public explorer — loading the unshield's tx in it from this device would tell the
 * explorer's RPC which exit is ours. The deposit's #21 (ShieldStatusScreen) keeps its explorer
 * link: a deposit is signed by the main account and public by design.
 * part B (spec 2026-11-20 §4): the header "PRIVATE · Make public"; the tx hash and the change position
 * behind "Details ▾"; the stage labels in plain words (plan A7).
 * Owner phone pass 2, 2026-11-21: "Now public" says the wallet's private balance AFTER the exit
 * ("Your private balance is now {total} {sym}.", item 1 — the deposit's sentence, directly under
 * the title; after a "Check again" settle, on its own line under the settled text: fix round 1,
 * I-1) from the dashboard's own source
 * (`a0PrivateBalanceNow`, read when the outcome is spent, or when "Check again" settled this note)
 * — never the spent note's change, which only shows in Details ("Left in this note"); no sentence
 * when the total is not known. The sub-line "The destination received …" is gone (item 7): the card
 * says it.
 */

/** how long "Copied" replaces "Copy signature" */
const COPIED_FEEDBACK_MS = 2_000;
/** the clipboard is cleared this long after a copy (the project's 30 s rule) */
const CLIPBOARD_CLEAR_MS = 30_000;

const ACCENT = '#5BE3C2';
const DANGER = '#FF5C6A';
const securityManager = new ScreenSecurityManager();

const ORDER: readonly A0UnshieldStage[] = ['sync', 'quote', 'approval', 'proof', 'submit', 'confirm'];
const PROOF_ROWS: readonly A0UnshieldStage[] = ['sync', 'quote', 'approval', 'proof'];
const BEFORE_SUBMIT = new Set<A0UnshieldStage>(PROOF_ROWS);

/** part B (spec §4 "#18 … stage labels in plain words"; plan A7) — each row keeps its measured time */
const ROW_TITLE: Record<A0UnshieldStage, string> = {
  sync: 'Check the pool',
  quote: 'Relayer fee',
  approval: 'Your approval',
  proof: 'Make the proof',
  submit: 'Submit',
  confirm: 'Confirm',
};

const ROW_ACTIVE: Record<A0UnshieldStage, string> = {
  sync: 'checking the pool on the chain',
  quote: 'asking the relayer for its fee',
  approval: 'waiting for you in the confirmation dialog',
  proof: 'making the proof on this device',
  submit: 'the relayer is submitting it',
  confirm: 'reading it back from the chain',
};

export interface UnshieldRunRequest {
  destination: A0UnshieldDestination;
  /** base units, decimal string */
  amount: string;
}

interface UnshieldRunScreenProps {
  request: UnshieldRunRequest;
  onDone: () => void;
  /** back to #16 (the form kept) — offered when nothing was sent */
  onBack: () => void;
}

type Phase =
  | {kind: 'auth'}
  | {kind: 'running'; stage: A0UnshieldStage}
  | {kind: 'done'; outcome: A0UnshieldOutcome}
  /**
   * a throw; `recorded`: the round reached `submit` and no NEW approval followed (the pending unshield
   * may stand); `ownAccount`: the flow's own-account refusal names the role in this field
   */
  | {kind: 'refused'; code: string | null; message: string; recorded: boolean; ownAccount?: A0OwnAccountRefused};

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

export function UnshieldRunScreen({request, onDone, onBack}: UnshieldRunScreenProps) {
  const [phase, setPhase] = useState<Phase>({kind: 'auth'});
  const [now, setNow] = useState(() => Date.now());
  const [round, setRound] = useState(1);
  const start = useRef<Partial<Record<A0UnshieldStage, number>>>({});
  const done = useRef<Partial<Record<A0UnshieldStage, number>>>({});
  const started = useRef(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      // only the "Copied" feedback stops with the screen; a pending clipboard clear still runs
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );
  const {checkAgain} = useA0Shielded();
  // re-review N-1: this run's note (named by the flow at its pending write) and the first decision
  // a "Check again" made about THAT note — latched: a later check that no longer lists it (it is
  // settled) or decides another pending note never changes what this #21 says
  const [ownRho, setOwnRho] = useState<string | null>(null);
  const [ownDecision, setOwnDecision] = useState<A0UnshieldCheck | null>(null);
  /** owner phone pass 2, item 1: the private balance after this exit (the dashboard's source), null = not known */
  const [balanceAfter, setBalanceAfter] = useState<bigint | null>(null);
  /** M1d (spec §4.3, plan A14): the scheme reserved for THIS run's fresh exit, read at onPending */
  const [freshScheme, setFreshScheme] = useState<string | null>(null);
  const checkReport = checkAgain.report;
  useEffect(() => {
    if (ownRho === null || !checkReport) return;
    const d = a0UnshieldDecisionFor(checkReport, ownRho);
    if (d !== null && d.kind !== 'pending') setOwnDecision(prev => prev ?? d);
  }, [checkReport, ownRho]);
  // "Check again" settled THIS note: the store is reconciled, so the balance is read again then
  useEffect(() => {
    if (ownDecision?.kind === 'settled') setBalanceAfter(readBalanceNow());
  }, [ownDecision]);

  let amount: bigint | null = null;
  try {
    amount = BigInt(request.amount);
  } catch {
    amount = null;
  }

  useEffect(() => {
    if (started.current) return; // one unshield per mount, whatever re-renders
    started.current = true;
    const at: {stage: A0UnshieldStage | null} = {stage: null};
    let recorded = false;
    let approvals = 0;

    const onStage = (stage: A0UnshieldStage) => {
      const t = Date.now();
      const current = at.stage;
      if (current !== null && done.current[current] === undefined) done.current[current] = t;
      if (start.current[stage] !== undefined) {
        // a stage entered again restarts its row; a NEW approval also restarts everything after it
        // (the proof of the earlier round was discarded), while a re-quote that keeps the terms
        // leaves the proof row done (the same proof is submitted)
        const reset = stage === 'approval' ? ORDER.slice(ORDER.indexOf(stage)) : [stage];
        for (const s of reset) {
          delete start.current[s];
          delete done.current[s];
        }
      }
      start.current[stage] = t;
      at.stage = stage;
      // carry 9: from the submit on, the pending unshield may stand. Only a NEW approval proves the
      // flow reverted it (R3-N4's re-sync comes BEFORE its revert, so `sync` proves nothing)
      // Known over-statement, kept (review M-1, the safe direction): a throw AFTER the flow already
      // reverted — E_A0_RELAYER_URL at the submit, E_A0_UNSHIELD_NOTE_LEAF from the new path, or
      // E_A0_UNSHIELD_ROUNDS at the loop top after a proven-dead round — still reads "kept pending";
      // "Check again" then finds nothing pending. Never the other way round.
      if (stage === 'submit') recorded = true;
      if (stage === 'approval') recorded = false;
      if (stage === 'approval') {
        approvals += 1;
        setRound(approvals);
      }
      setNow(t);
      setPhase({kind: 'running', stage});
    };

    (async () => {
      if (amount === null) {
        setPhase({kind: 'refused', code: 'E_A0_UNSHIELD_AMOUNT', message: 'the amount is not a number of base units', recorded: false});
        return;
      }
      let seed: Uint8Array;
      try {
        seed = await mnemonicToSeed(await keychainManager.retrieveSeed());
      } catch (e) {
        setPhase({kind: 'refused', ...a0ErrorText(e), recorded: false});
        return;
      }
      try {
        // the devnet checkpoint's one-shot submit hold enters the flow ONLY here, through holdMs
        // (submitHold.ts; always 0 in production — the readout gate is closed there)
        const outcome = await unshieldA0(
          getConnection(),
          seed,
          {destination: request.destination, amount},
          {
            onStage,
            holdMs: () => takeA0SubmitHold(),
            onPending: rho => {
              setOwnRho(rho);
              // M1d: the pending intent holds the reserved scheme now; the settled note will not
              if (request.destination.kind === 'fresh') setFreshScheme(pendingFreshSchemeOf(rho));
            },
          },
        );
        const t = Date.now();
        const current = at.stage;
        if (current !== null && done.current[current] === undefined) done.current[current] = t;
        setNow(t);
        // spent: the change note is stored and the note spent before the flow returns — read the total now
        if (outcome.status === 'spent') setBalanceAfter(readBalanceNow());
        setPhase({kind: 'done', outcome});
      } catch (e) {
        const err = a0ErrorText(e);
        const own = (e as {ownAccount?: unknown} | null)?.ownAccount;
        const ownAccount = own === 'main' || own === 'other' ? own : undefined;
        setPhase({kind: 'refused', ...err, recorded, ...(ownAccount ? {ownAccount} : {})});
      }
    })();
    // one run per mount: the request is the route's, fixed for this mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const running = phase.kind === 'auth' || phase.kind === 'running';
  const proofLayout = phase.kind === 'auth' || (phase.kind === 'running' && BEFORE_SUBMIT.has(phase.stage));

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [running]);

  // #18's privacy posture (screenshots blocked) while the proof part shows; #21 is not FLAG_SECURE
  useEffect(() => {
    if (!proofLayout) return;
    securityManager.enableSecureScreen().catch(() => undefined);
    return () => {
      securityManager.disableSecureScreen().catch(() => undefined);
    };
  }, [proofLayout]);

  const handleBack = useCallback(() => {
    if (running) {
      Alert.alert(
        MAKING_PUBLIC,
        'Leaving does not stop it. Close the confirmation dialog to cancel before you approve; after that the result is recorded on this device either way.',
      );
      return true;
    }
    onDone();
    return true;
  }, [running, onDone]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', handleBack);
    return () => sub.remove();
  }, [handleBack]);

  const sym = A0_TOKEN.symbol;
  const amountText = amount === null ? '—' : `${displayAmount(amount, A0_TOKEN.decimals)} ${sym}`;
  // M1d (spec §4.3): where a fresh exit landed — the registry's fresh-exit entry, so the sheet can show it
  const receivedBy =
    phase.kind === 'done' && phase.outcome.status === 'spent' && request.destination.kind === 'fresh'
      ? freshExitAccountOf(freshScheme)
      : null;

  if (proofLayout) {
    const stage = phase.kind === 'running' ? phase.stage : null;
    const hero = proofHero(stage, round);
    return (
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} className="flex-1 bg-bg-base">
        <View className="flex-row items-center justify-between px-5 h-12">
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            testID="back-button"
            className="w-12 h-12 items-center justify-center -ml-3">
            <ArrowLeft size={22} color="#A8ACB5" strokeWidth={1.75} />
          </Pressable>
          <View className="flex-row items-center gap-2">
            <ShieldCheck size={12} color={ACCENT} strokeWidth={2} />
            <Text variant="overline" className="text-accent-shielded">
              {PRIVATE_MARK}
            </Text>
            <Text variant="body-sm" className="font-geist-semibold text-fg-primary" testID="unshield-proof-title">
              {MAKING_PUBLIC}
            </Text>
          </View>
          <Text variant="overline" className="text-fg-tertiary">
            ZK
          </Text>
        </View>
        <ScrollView className="flex-1" contentContainerClassName="px-5 pb-6">
          <View className="items-center mt-4 p-5 rounded-lg border border-[rgba(91,227,194,0.32)]">
            <ProofHeroRing tone="busy" testID="unshield-hero-ring" />
            <Text variant="h2" testID="unshield-hero" className="mt-4 text-center text-fg-primary">
              {hero.label}
            </Text>
            <Text variant="body-sm" testID="unshield-hero-sub" className="mt-2 text-center max-w-xs text-fg-secondary">
              {hero.sub}
            </Text>
            <Text variant="caption" numeral className="mt-2 text-fg-tertiary">
              {amountText}
            </Text>
          </View>
          <View className="mt-6 gap-3">
            {PROOF_ROWS.map((s, i) => (
              <StageRow
                key={s}
                testID={`unshield-stage-${s}`}
                num={i + 1}
                title={ROW_TITLE[s]}
                {...rowOf(s, phase, start.current, done.current, now)}
              />
            ))}
          </View>
        </ScrollView>
        <View className="flex-row items-center justify-center gap-2 px-5 mb-3">
          <ShieldCheck size={14} color={ACCENT} strokeWidth={1.75} />
          <Text variant="body-sm" className="text-accent-shielded">
            FLAG_SECURE · screenshots blocked
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const signature =
    phase.kind === 'done' && 'signature' in phase.outcome && phase.outcome.signature ? phase.outcome.signature : null;
  const undecided =
    (phase.kind === 'done' && (phase.outcome.status === 'pending' || (phase.outcome.status === 'landed-unverified' && phase.outcome.note === 'pending'))) ||
    (phase.kind === 'refused' && phase.recorded && phase.code !== 'E_A0_STORE_CHANGED'); // M-5: not this wallet's to check
  // final review I-1 + re-review N-1: what "Check again" decided about THIS run's note (by its rho —
  // another pending unshield's result is not this one's) replaces "Not confirmed yet"
  const decided = undecided && ownDecision !== null && ownDecision.kind !== 'pending' ? ownDecision : null;
  // N-3: a landed-unverified first outcome keeps its loud line after the decision
  const firstLoud = phase.kind === 'done' && phase.outcome.status === 'landed-unverified' ? a0RefusalLoudText(phase.outcome.code) : null;
  const shown = decided ? decidedView(decided, amountText, firstLoud) : statusView(phase, start.current, now);
  // item 1 + fix round 1 (I-1): "Now public" (spent, or settled by "Check again") says the balance
  // after it, when known — as the sub when there is none (spent), else on its own line under it
  const landed = (phase.kind === 'done' && phase.outcome.status === 'spent' && !decided) || decided?.kind === 'settled';
  const balanceSentence =
    landed && balanceAfter !== null ? yourPrivateBalanceIsNow(displayAmount(balanceAfter, A0_TOKEN.decimals), sym) : null;
  const view = shown.sub === '' && balanceSentence !== null ? {...shown, sub: balanceSentence} : shown;
  const balanceLine = shown.sub !== '' ? balanceSentence : null;
  const pending = undecided && decided === null;
  // the caption: this note's decision; while it is undecided, a done check says "still not confirmed"
  // whatever it decided about other notes; an error / busy check says its own text
  const caption = decided
    ? a0CheckCaption(decided)
    : checkReport
      ? a0CheckCaption({kind: 'pending'})
      : (checkAgain.note ?? 'Pending · decided from the chain');
  const nothingSent =
    (phase.kind === 'done' && phase.outcome.status === 'not-sent') || (phase.kind === 'refused' && !phase.recorded);

  const copySig = () => {
    if (!signature) return;
    try {
      Clipboard.setString(signature);
      setTimeout(() => Clipboard.setString(''), CLIPBOARD_CLEAR_MS);
    } catch {
      return; // clipboard unavailable: nothing was copied, so no "Copied"
    }
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <View className="flex-row items-center px-4 py-3 gap-2">
        <ShieldCheck size={12} color={ACCENT} strokeWidth={2} />
        <Text variant="overline" className="text-accent-shielded">
          {PRIVATE_MARK}
        </Text>
        <Text variant="overline" className="text-fg-tertiary">
          ·
        </Text>
        <Text variant="h2" className="flex-1" testID="unshield-status-header">
          {running ? MAKING_PUBLIC : MAKE_PUBLIC}
        </Text>
        {view.badge ? (
          <Text
            variant="overline"
            testID="unshield-status-badge"
            className={view.tone === 'ok' ? 'text-accent-shielded' : view.tone === 'bad' ? 'text-danger' : 'text-warning'}>
            {view.badge}
          </Text>
        ) : null}
      </View>

      <ScrollView contentContainerClassName="flex-grow items-center px-5 pb-8">
        <View className="items-center justify-center py-8 gap-5 w-full">
          <StatusRing tone={view.tone} okIcon="check" />
          <Text
            variant="h1"
            testID="unshield-status-title"
            className={cn(
              'text-center',
              view.tone === 'ok'
                ? 'text-accent-shielded'
                : view.tone === 'bad'
                  ? 'text-danger'
                  : view.tone === 'warn'
                    ? 'text-warning'
                    : '',
            )}>
            {view.title}
          </Text>
          {view.sub ? (
            <Text variant="body-sm" className="text-center text-fg-secondary max-w-[320px]" testID="unshield-status-sub">
              {view.sub}
            </Text>
          ) : null}
          {balanceLine ? (
            <Text variant="body-sm" className="text-center text-fg-secondary max-w-[320px] -mt-3" testID="unshield-status-balance">
              {balanceLine}
            </Text>
          ) : null}
        </View>

        {view.loud ? (
          <View
            className="w-full rounded-md bg-[rgba(255,92,106,0.08)] border border-danger p-4 mb-3 flex-row gap-3"
            testID="unshield-status-loud">
            <AlertTriangle size={18} color={DANGER} strokeWidth={2} />
            <Text variant="body-sm" className="flex-1 text-danger font-geist-semibold">
              {view.loud}
            </Text>
          </View>
        ) : null}

        <View className="w-full rounded-2xl p-5 items-center gap-2 border border-bg-surface-3 bg-bg-surface-1">
          <Text variant="overline" className="text-fg-tertiary">
            Destination receives
          </Text>
          <Text variant="balance-lg" numeral className="text-fg-primary">
            {amountText}
          </Text>
          {view.lines.map(l => (
            <Text key={l.id} variant="caption" className={cn('text-center', l.warn ? 'text-warning' : 'text-fg-tertiary')} testID={`unshield-line-${l.id}`}>
              {l.text}
            </Text>
          ))}
        </View>

        {signature ? (
          <View className="w-full bg-bg-surface-1 rounded-lg px-5 mt-3">
            <DetailsDisclosure testID="unshield-details">
              <MetaRow label="Tx hash" value={shortSignature(signature)} onCopy={copySig} />
              {phase.kind === 'done' && phase.outcome.status === 'spent' ? (
                <>
                  <MetaRow label="Change" value={`#${phase.outcome.changeLeafIndex} in the pool`} />
                  {/* item 1: the spent note's change, as a plain row — not the balance */}
                  <MetaRow label={LEFT_IN_THIS_NOTE} value={`${displayAmount(phase.outcome.changeAmount, A0_TOKEN.decimals)} ${sym}`} />
                  {receivedBy ? (
                    <MetaRow
                      label={RECEIVED_BY}
                      value={accountWithAddress(receivedBy.label, shortAccountAddress(receivedBy.address), false)}
                    />
                  ) : null}
                </>
              ) : null}
            </DetailsDisclosure>
          </View>
        ) : null}

        {pending || decided ? (
          <View className="w-full flex-row items-center justify-between mt-4 px-1">
            <Text variant="caption" className={cn('flex-1', pending ? 'text-warning' : 'text-fg-tertiary')} testID="unshield-check-caption">
              {caption}
            </Text>
            {pending ? <CheckAgainLink checkAgain={checkAgain} testID="unshield-check-again" /> : null}
          </View>
        ) : null}
      </ScrollView>

      <View className="px-6 pb-2 pt-2 gap-2">
        {running ? (
          <View className="min-h-touch-rec rounded-pill items-center justify-center bg-bg-surface-3">
            <Text variant="body-lg" className="font-geist-semibold text-fg-disabled">
              Don't close · waiting for the relayer
            </Text>
          </View>
        ) : (
          <View className="flex-row gap-2">
            {signature ? (
              <Pressable
                testID="unshield-status-copy"
                onPress={copySig}
                accessibilityRole="button"
                accessibilityLabel="Copy signature"
                className="flex-1 min-h-touch-rec rounded-pill items-center justify-center flex-row gap-2 bg-bg-surface-1">
                {copied ? (
                  <Check size={16} color={ACCENT} strokeWidth={2} />
                ) : (
                  <Copy size={16} color="#E7E9EE" strokeWidth={1.75} />
                )}
                <Text variant="body-lg" className={cn('font-geist-semibold', copied ? 'text-accent-shielded' : 'text-fg-primary')}>
                  {copied ? 'Copied' : 'Copy signature'}
                </Text>
              </Pressable>
            ) : null}
            {nothingSent ? (
              <Pressable
                testID="unshield-status-back"
                onPress={onBack}
                accessibilityRole="button"
                accessibilityLabel={`Back to ${MAKE_PUBLIC}`}
                className="flex-1 min-h-touch-rec rounded-pill items-center justify-center bg-bg-surface-1">
                <Text variant="body-lg" className="font-geist-semibold text-fg-primary">
                  {`Back to ${MAKE_PUBLIC}`}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              testID="unshield-status-done"
              onPress={onDone}
              accessibilityRole="button"
              accessibilityLabel="Done"
              className="flex-1 min-h-touch-rec rounded-pill items-center justify-center flex-row gap-2 bg-accent-shielded active:opacity-90">
              <Check size={18} color="#0A0A0A" strokeWidth={2} />
              <Text variant="body-lg" className="font-geist-semibold text-bg-base">
                Done
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

/** The dashboard's total (null = not known); a throw is "not known" too, never a screen error. */
function readBalanceNow(): bigint | null {
  try {
    return a0PrivateBalanceNow();
  } catch {
    return null;
  }
}

// ── #18: the proof part ──────────────────────────────────────────────────────

function proofHero(stage: A0UnshieldStage | null, round: number): {label: string; sub: string} {
  const again =
    round > 1 ? ` The relayer's terms changed or the pool moved on, so this is a new confirmation (${round} of 3).` : '';
  switch (stage) {
    case null:
      return {label: 'Preparing', sub: 'Unlock with your fingerprint or passcode. The proof is generated on this device.'};
    case 'sync':
      return {label: 'Checking the pool', sub: "Checking the pool on the chain and your note's place in it."};
    case 'quote':
      return {label: 'Asking the relayer', sub: 'The relayer pays for and submits the transaction; it states its fee first.'};
    case 'approval':
      return {
        label: 'Approve in the dialog',
        sub: `Check the destination and the amounts the dialog shows, then confirm it is you.${again}`,
      };
    default:
      return {label: 'Making the proof', sub: `Making the proof on this device.${again}`};
  }
}

interface RowView {
  status: StageRowStatus;
  meta: string;
  mark: string;
}

function rowOf(
  s: A0UnshieldStage,
  phase: Phase,
  start: Partial<Record<A0UnshieldStage, number>>,
  done: Partial<Record<A0UnshieldStage, number>>,
  now: number,
): RowView {
  const a = start[s];
  const d = done[s];
  if (a !== undefined && d !== undefined) {
    return {status: 'done', meta: `done · ${seconds(d - a)}`, mark: '✓'};
  }
  if (phase.kind === 'running' && phase.stage === s && a !== undefined) {
    return {status: 'active', meta: `${ROW_ACTIVE[s]} · ${seconds(now - a)}`, mark: '…'};
  }
  if (phase.kind === 'auth' && s === 'sync') {
    return {status: 'active', meta: 'waiting for you to unlock', mark: '…'};
  }
  return {status: 'pending', meta: '— · pending', mark: '·'};
}

// ── #21: the status part ─────────────────────────────────────────────────────

type Tone = StatusTone;

interface StatusView {
  title: string;
  sub: string;
  tone: Tone;
  badge: string | null;
  /** the loud line (a landed tx the verifier refused) */
  loud: string | null;
  lines: {id: string; text: string; warn?: boolean}[];
}

const KEPT =
  'Your note is kept pending on this device and is decided from the chain: the next time the wallet starts, or when you tap Check again. Nothing is sent twice.';

const PENDING_WHY: Record<'unconfirmed' | 'already_spent' | 'relay_failed' | 'unknown' | 'not-in-sync', string> = {
  unconfirmed: 'The relayer sent it, but it was not confirmed in time.',
  already_spent: 'The relayer says this note is already spent.',
  // carry 2: a signature-less relay_failed is NOT proven unsent (R3-N4): never failure copy
  relay_failed: "The relayer's answer does not say whether it sent it.",
  unknown: "The relayer's answer could not be read.",
  'not-in-sync': "The relayer reports it confirmed, but the pool's history does not list it yet.",
};

function statusView(
  phase: Phase,
  start: Partial<Record<A0UnshieldStage, number>>,
  now: number,
): StatusView {
  const base = {badge: null, loud: null, lines: []};
  switch (phase.kind) {
    case 'auth':
    case 'running': {
      const stage = phase.kind === 'running' ? phase.stage : 'submit';
      const since = start[stage];
      const t = since === undefined ? '' : ` · ${seconds(now - since)}`;
      return stage === 'confirm'
        ? {...base, title: 'Confirming…', sub: `The relayer reports it landed · reading it back from the chain and verifying it${t}.`, tone: 'busy'}
        : {...base, title: 'Submitting…', sub: `The relayer pays for and submits it · waiting for its answer${t}.`, tone: 'busy'};
    }
    case 'refused': {
      // final review M-4: where a code exists, the code and a fixed sentence; the raw message only
      // when there is no code (an error's message may carry the RPC URL and its API key)
      const head = phase.code ? `${phase.code} · ` : `${phase.message}. `;
      if (phase.recorded && phase.code === 'E_A0_STORE_CHANGED') {
        return {
          ...base,
          title: 'Not in this wallet',
          sub: 'E_A0_STORE_CHANGED · The wallet on this device was replaced while this transfer to public was in flight. It was sent from the earlier wallet; restoring that wallet from its recovery phrase recovers its result.',
          tone: 'warn',
        };
      }
      if (phase.recorded) {
        return {
          ...base,
          title: 'Not confirmed yet',
          sub: `${head}It may have been sent, but this device could not record its result. ${KEPT}`,
          tone: 'warn',
          badge: 'PENDING',
        };
      }
      if (phase.code === 'E_A0_CONFIRM_CANCELLED') {
        return {...base, title: 'Not sent', sub: 'You cancelled the confirmation. Nothing was sent.', tone: 'bad'};
      }
      if (phase.code !== null && phase.code.startsWith('E_A0_CONFIRM_')) {
        // carry 6: the native confirmation refused this attempt (Task 6 / 7) — never pending
        return {
          ...base,
          title: 'Not sent',
          sub: `The confirmation did not complete (${phase.code}): nothing was approved and nothing was sent.`,
          tone: 'bad',
        };
      }
      if (phase.code === null) {
        return {...base, title: 'Not sent', sub: `${head}Nothing was sent.`, tone: 'bad'};
      }
      // carry 3: the own-account refusal names the account's role — from the error's field (M-7: no prefix match)
      const why =
        phase.code === 'E_A0_UNSHIELD_DESTINATION' && phase.ownAccount
          ? A0_OWN_ACCOUNT_REFUSAL_COPY[phase.ownAccount]
          : a0UnshieldRefusalSentence(phase.code);
      return {...base, title: 'Not sent', sub: `${head}${why} Nothing was sent.`, tone: 'bad'};
    }
    case 'done': {
      const o = phase.outcome;
      switch (o.status) {
        case 'spent': {
          const lines: StatusView['lines'] = [];
          if (o.grantLamports !== null) {
            lines.push({id: 'grant', text: `The relayer also sent the new account ${formatTokenAmount(o.grantLamports, SOL_DECIMALS)} SOL for its own fees.`});
          }
          if (o.destinationWithoutSol) {
            lines.push({
              id: 'no-sol',
              text: 'The new account holds no SOL: it cannot pay for its own transactions until it receives some, and funding it from your other accounts would link them.',
              warn: true,
            });
          }
          // item 1: the change line is gone (it is the note's, not the balance — in Details now); item 7:
          // no sub-line — the card already says what the destination receives
          return {
            ...base,
            title: NOW_PUBLIC,
            sub: '',
            tone: 'ok',
            badge: 'CONFIRMED',
            lines,
          };
        }
        case 'landed-unverified': {
          const lines: StatusView['lines'] = [
            {
              id: 'note',
              text:
                o.note === 'spent'
                  ? 'The transaction spends your note on chain, so the note is spent.'
                  : 'The transaction does not spend your note as far as this wallet can tell, so the note stays pending.',
              warn: true,
            },
            {
              id: 'change',
              text: o.changeRecorded
                ? 'Your change note was recorded: it is the one the transaction inserted.'
                : 'No change note was recorded: the transaction did not insert yours.',
              warn: !o.changeRecorded,
            },
          ];
          if (o.linked) {
            lines.push({id: 'linked', text: 'A key of this wallet signed it: the new account is now linked to this wallet.', warn: true});
          }
          return {
            ...base,
            title: 'Landed, but failed verification',
            sub: 'The relayer landed a transaction for this transfer to public that does not match what you approved. It is not retried.',
            tone: 'bad',
            badge: 'UNVERIFIED',
            // carry 4: from the CODE only — the verifier's detail names keys of this seed; the outcome does not carry it (M-3)
            loud: a0RefusalLoudText(o.code),
            lines,
          };
        }
        case 'pending':
          return {
            ...base,
            title: 'Not confirmed yet',
            // the sync error's text (`o.detail`) is not shown: an RPC error may carry the endpoint's URL
            sub: `${PENDING_WHY[o.reason]} ${KEPT}`,
            tone: 'warn',
            badge: 'PENDING',
          };
        case 'not-sent':
          return {
            ...base,
            title: 'Not sent',
            sub: `The relayer did not send it (${o.outcome}). Nothing left your private balance.`,
            tone: 'bad',
          };
      }
    }
  }
}

/**
 * #21 once "Check again" decided this run's undecided outcome (final review I-1, re-review N-1).
 * `firstLoud` (N-3): the loud line of a landed-unverified first outcome, kept.
 */
function decidedView(decided: Exclude<A0UnshieldCheck, {kind: 'pending'}>, amountText: string, firstLoud: string | null): StatusView {
  const base = {badge: null, loud: firstLoud, lines: []};
  switch (decided.kind) {
    case 'settled':
      // N-4: a settle by recovery's rules (no approved terms stored) is not "verified"
      return decided.verified
        ? {
            ...base,
            title: NOW_PUBLIC,
            sub: `Checked again: it landed on Solana devnet and was verified · the destination received ${amountText}.`,
            tone: 'ok',
            badge: 'CONFIRMED',
          }
        : {
            ...base,
            title: NOW_PUBLIC,
            sub: "Checked again: it landed on Solana devnet · settled from the chain's record; this device held no approved terms to check it against.",
            tone: 'ok',
          };
    case 'reverted':
      return {
        ...base,
        title: 'Not sent',
        sub: 'Checked again: it did not land in time, so it can no longer land. Your note is back in your private balance.',
        tone: 'bad',
      };
    case 'unverified':
      return {
        ...base,
        title: 'Landed, but failed verification',
        sub: 'Checked again: the relayer landed a transaction for this transfer to public that does not match what you approved. It is not retried.',
        tone: 'bad',
        badge: 'UNVERIFIED',
        loud: [firstLoud, a0RefusalLoudText(decided.code)].filter((x): x is string => x !== null).join('\n'),
      };
  }
}
