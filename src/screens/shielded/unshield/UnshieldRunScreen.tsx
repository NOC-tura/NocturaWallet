import React, {useCallback, useEffect, useRef, useState} from 'react';
import {View, Pressable, ScrollView, Alert, BackHandler, Linking} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import {AlertTriangle, Check, FileText, ShieldCheck, ArrowLeft} from 'lucide-react-native';
import {Text} from '../../../components/ui';
import {cn} from '../../../utils/cn';
import {formatTokenAmount} from '../../../utils/parseTokenAmount';
import {ScreenSecurityManager} from '../../../modules/screenSecurity/screenSecurityModule';
import {a0LandedUnverifiedText, unshieldA0} from '../../../modules/shielded/a0/unshieldFlow';
import {takeA0SubmitHold} from '../../../modules/shielded/a0/submitHold';
import type {
  A0UnshieldDestination,
  A0UnshieldOutcome,
  A0UnshieldStage,
} from '../../../modules/shielded/a0/unshieldFlow';
import {A0_TOKEN, SOL_DECIMALS, a0ErrorText, displayAmount} from '../../../modules/shielded/a0/screenSupport';
import {A0} from '../../../modules/shielded/a0/constants';
import {keychainManager} from '../../../modules/keychain/keychainModule';
import {mnemonicToSeed} from '../../../modules/keyDerivation/mnemonicUtils';
import {getConnection} from '../../../modules/solana/connection';
import {explorerTxUrl} from '../../../constants/chain';
import {useA0Shielded} from '../../../hooks/useA0Shielded';
import {CheckAgainLink} from '../../../components/CheckAgainLink';
import {A0_VERIFY_REFUSAL_COPY} from './unshieldCopy';
import {MetaRow, ProofHeroRing, StageRow, StatusRing, shortSignature} from '../shieldedParts';
import type {StageRowStatus, StatusTone} from '../shieldedParts';

/**
 * The A0 unshield run: #18 zk-proof and #21 tx-status for the unshield (spec §6 steps 3–8, §11;
 * M1c Task 8). ONE `unshieldA0` call per mount owns everything secret about the unshield (Task
 * 7's rule), so ONE screen hosts it from the first stage to the outcome and draws two designs:
 *
 *   - #18's layout (mirror index.html §s18, the deposit's #18 as built in M1b) while the stage is
 *     before the submit — four rows driven by the flow's `onStage`, each with its MEASURED time
 *     ("running · 2.1 s", "done · 4.2 s"), never a percentage:
 *       Sync the pool ← sync · Relayer quote ← quote · Your approval ← approval (the NATIVE
 *       confirmation dialog, Kotlin, Task 6 — it is the human's step, so its row says "waiting for
 *       you", and its time is the time the human took) · Prove ← proof;
 *   - #21's layout (mirror index.html §s21) from the submit on: the spinner while the relayer
 *     submits ("submit") and the wallet reads the landed tx back and verifies it ("confirm"), then
 *     the outcome.
 * A stage the flow enters again restarts its row (the re-quote after the proof, the re-sync after a
 * `relay_failed` that sent nothing); a NEW approval (the terms changed, or the pool's root left the
 * 64-root ring) also restarts the proof, and the hero says a new confirmation is needed (at most 3).
 *
 * THE OUTCOMES, said as what they are:
 *   - spent → "Unshielded": the destination got the amount, the change note's position; the grant
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
 *   - not-sent → "Not sent": the relayer's outcome, nothing left the shielded balance;
 *   - a throw → its code (`a0ErrorText`). A throw once the round reached `submit` (or the re-sync
 *     that follows a submit, before the flow's revert is proven by a NEW approval) is "Not
 *     confirmed yet" + "Check again", whatever its code (carry 9; E_A0_STORE_CHANGED is "Not in
 *     this wallet"); only a throw before the submit says nothing was sent — the native
 *     confirmation's `E_A0_CONFIRM_*` as the refused dialog (carry 6), "Another address" being an
 *     account of this wallet as the flow's own refusal naming its role (carry 3).
 *
 * DEPARTURES FROM THE DESIGN (listed for the owner's visual pass): no #19 / #20 for the unshield
 * (the approval is the native dialog — S4: a JS review screen before it would be a second,
 * weaker confirmation of terms the flow re-fetches anyway; #16 shows the amount line and the fee
 * before the tap); #18's rows are the unshield's real stages, not "Building witness → Proving →
 * Verifying → Ready" (the flow's public-input compare is inside its proof stage and has no time
 * of its own); back is LOCKED for the whole run, #18 included (the flow cannot be cancelled once
 * the call started — closing the dialog is the cancel); no "Local prover slow?" / hosted prover
 * (A0 has none); "View details" is the explorer, not #27; no ~90 s stuck-tx redirect to #54.
 */

const ACCENT = '#5BE3C2';
const DANGER = '#FF5C6A';
const securityManager = new ScreenSecurityManager();

const ORDER: readonly A0UnshieldStage[] = ['sync', 'quote', 'approval', 'proof', 'submit', 'confirm'];
const PROOF_ROWS: readonly A0UnshieldStage[] = ['sync', 'quote', 'approval', 'proof'];
const BEFORE_SUBMIT = new Set<A0UnshieldStage>(PROOF_ROWS);

const ROW_TITLE: Record<A0UnshieldStage, string> = {
  sync: 'Sync the pool',
  quote: 'Relayer quote',
  approval: 'Your approval',
  proof: 'Prove',
  submit: 'Submit',
  confirm: 'Confirm',
};

const ROW_ACTIVE: Record<A0UnshieldStage, string> = {
  sync: "verifying the pool's tree from the chain",
  quote: 'asking the relayer for its fee',
  approval: 'waiting for you in the confirmation dialog',
  proof: 'running the Groth16 prover on this device',
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
  /** a throw; `recorded`: the round reached `submit` and no NEW approval followed (the pending unshield may stand) */
  | {kind: 'refused'; code: string | null; message: string; recorded: boolean};

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

function capitalised(text: string): string {
  return text.length > 0 ? `${text[0]!.toUpperCase()}${text.slice(1)}` : text;
}

export function UnshieldRunScreen({request, onDone, onBack}: UnshieldRunScreenProps) {
  const [phase, setPhase] = useState<Phase>({kind: 'auth'});
  const [now, setNow] = useState(() => Date.now());
  const [round, setRound] = useState(1);
  const start = useRef<Partial<Record<A0UnshieldStage, number>>>({});
  const done = useRef<Partial<Record<A0UnshieldStage, number>>>({});
  const started = useRef(false);
  const {checkAgain} = useA0Shielded();

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
          {onStage, holdMs: () => takeA0SubmitHold()},
        );
        const t = Date.now();
        const current = at.stage;
        if (current !== null && done.current[current] === undefined) done.current[current] = t;
        setNow(t);
        setPhase({kind: 'done', outcome});
      } catch (e) {
        const err = a0ErrorText(e);
        setPhase({kind: 'refused', ...err, recorded});
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
        'Unshield in progress',
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
              SHIELDED
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
              {`Unshield ${amountText}`}
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

  const view = statusView(phase, amountText, start.current, now);
  const signature =
    phase.kind === 'done' && 'signature' in phase.outcome && phase.outcome.signature ? phase.outcome.signature : null;
  const pending =
    (phase.kind === 'done' && (phase.outcome.status === 'pending' || (phase.outcome.status === 'landed-unverified' && phase.outcome.note === 'pending'))) ||
    (phase.kind === 'refused' && phase.recorded && phase.code !== 'E_A0_STORE_CHANGED'); // M-5: not this wallet's to check
  const nothingSent =
    (phase.kind === 'done' && phase.outcome.status === 'not-sent') || (phase.kind === 'refused' && !phase.recorded);

  const copySig = () => {
    if (!signature) return;
    try {
      Clipboard.setString(signature);
      setTimeout(() => Clipboard.setString(''), 30_000);
    } catch {
      // clipboard unavailable — no-op
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <View className="flex-row items-center px-4 py-3 gap-2">
        <ShieldCheck size={12} color={ACCENT} strokeWidth={2} />
        <Text variant="overline" className="text-accent-shielded">
          Shielded
        </Text>
        <Text variant="h2" className="flex-1">
          {running ? 'Unshielding…' : 'Unshield'}
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
          <Text variant="body-sm" className="text-center text-fg-secondary max-w-[320px]" testID="unshield-status-sub">
            {view.sub}
          </Text>
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
            <MetaRow label="Tx hash" value={shortSignature(signature)} onCopy={copySig} />
            {phase.kind === 'done' && phase.outcome.status === 'spent' ? (
              <MetaRow label="Change" value={`#${phase.outcome.changeLeafIndex} in the pool`} />
            ) : null}
          </View>
        ) : null}

        {pending ? (
          <View className="w-full flex-row items-center justify-between mt-4 px-1">
            <Text variant="caption" className="text-warning flex-1">
              {checkAgain.note ?? 'Pending · decided from the chain'}
            </Text>
            <CheckAgainLink checkAgain={checkAgain} testID="unshield-check-again" />
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
                testID="unshield-status-details"
                onPress={() => {
                  Linking.openURL(explorerTxUrl(signature, 'solanaexplorer', A0.cluster)).catch(() => {});
                }}
                accessibilityRole="button"
                accessibilityLabel="View details"
                className="flex-1 min-h-touch-rec rounded-pill items-center justify-center flex-row gap-2 bg-bg-surface-1">
                <FileText size={16} color="#E7E9EE" strokeWidth={1.75} />
                <Text variant="body-lg" className="font-geist-semibold text-fg-primary">
                  View details
                </Text>
              </Pressable>
            ) : null}
            {nothingSent ? (
              <Pressable
                testID="unshield-status-back"
                onPress={onBack}
                accessibilityRole="button"
                accessibilityLabel="Back to unshield"
                className="flex-1 min-h-touch-rec rounded-pill items-center justify-center bg-bg-surface-1">
                <Text variant="body-lg" className="font-geist-semibold text-fg-primary">
                  Back to unshield
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

// ── #18: the proof part ──────────────────────────────────────────────────────

function proofHero(stage: A0UnshieldStage | null, round: number): {label: string; sub: string} {
  const again =
    round > 1 ? ` The relayer's terms changed or the pool moved on, so this is a new confirmation (${round} of 3).` : '';
  switch (stage) {
    case null:
      return {label: 'Preparing unshield', sub: 'Unlock with your fingerprint or passcode. The proof is generated on this device.'};
    case 'sync':
      return {label: 'Syncing the pool', sub: "Verifying the pool's tree from the chain and your note's place in it."};
    case 'quote':
      return {label: 'Asking the relayer', sub: 'The relayer pays for and submits the transaction; it states its fee first.'};
    case 'approval':
      return {
        label: 'Approve in the dialog',
        sub: `Check the destination and the amounts the dialog shows, then confirm it is you.${again}`,
      };
    default:
      return {label: 'Proving', sub: `Running the Groth16 prover on this device.${again}`};
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

/** The start of `unshieldFlow`'s own-account refusals (`ownAccountRefusal`: "your main account", "an account of this wallet"). */
const OWN_ACCOUNT_REFUSAL = 'that address is ';

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
  amountText: string,
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
      const head = phase.code ? `${phase.code} · ` : '';
      if (phase.recorded && phase.code === 'E_A0_STORE_CHANGED') {
        return {
          ...base,
          title: 'Not in this wallet',
          sub: 'E_A0_STORE_CHANGED · The wallet on this device was replaced while this unshield was in flight. It was sent from the earlier wallet; restoring that wallet from its recovery phrase recovers its result.',
          tone: 'warn',
        };
      }
      if (phase.recorded) {
        return {
          ...base,
          title: 'Not confirmed yet',
          sub: `${head}${phase.message}. It may have been sent, but this device could not record its result. ${KEPT}`,
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
      if (phase.code === 'E_A0_UNSHIELD_DESTINATION' && phase.message.startsWith(OWN_ACCOUNT_REFUSAL)) {
        // carry 3: the flow's own-account refusal (it names the account's role), said as it is, the
        // code kept (M-7); any other destination refusal takes the generic form below
        return {...base, title: 'Not sent', sub: `${head}${capitalised(phase.message)}. Nothing was sent.`, tone: 'bad'};
      }
      return {...base, title: 'Not sent', sub: `${head}${phase.message}. Nothing was sent.`, tone: 'bad'};
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
          lines.push({id: 'change', text: `Your change, ${displayAmount(o.changeAmount, A0_TOKEN.decimals)} ${A0_TOKEN.symbol}, stays shielded.`});
          return {
            ...base,
            title: 'Unshielded',
            sub: `Landed on Solana devnet and verified · the destination received ${amountText}.`,
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
            sub: 'The relayer landed a transaction for this unshield that does not match what you approved. It is not retried.',
            tone: 'bad',
            badge: 'UNVERIFIED',
            // carry 4: from the CODE only — `o.detail` names keys of this seed and is never shown
            loud: a0LandedUnverifiedText(o.code, A0_VERIFY_REFUSAL_COPY[o.code]),
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
            sub: `The relayer did not send it (${o.outcome}). Nothing left your shielded balance.`,
            tone: 'bad',
          };
      }
    }
  }
}
