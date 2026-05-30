import React, {useEffect, useReducer, useRef, useState, useCallback} from 'react';
import {View, Pressable, ScrollView, Alert, Modal, BackHandler} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ArrowLeft, ShieldCheck, Cpu, AlertTriangle, Check} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Text} from '../../components/ui';
import {zkProver} from '../../modules/zkProver/zkProverModule';
import {ScreenSecurityManager} from '../../modules/screenSecurity/screenSecurityModule';
import type {ProofWitness, ZKProof} from '../../modules/zkProver/types';
import type {RootStackParamList} from '../../types/navigation';

const ACCENT = '#5BE3C2';
const DANGER = '#FF5C6A';
const securityManager = new ScreenSecurityManager();

const SEES_ITEMS = ['Pedersen-hashed commitments', 'Network fee', 'Anonymity set ID'];
const CANT_SEE_ITEMS = ['Spend key', 'Recipient address', 'Amount in clear'];

type Props = NativeStackScreenProps<RootStackParamList, 'ZkProofModal'>;

type StageNum = 1 | 2 | 3 | 4;
type StageStatus = 'pending' | 'active' | 'done' | 'errored';

type ChainResult =
  | {kind: 'pending'}
  | {kind: 'success'; proof: ZKProof}
  | {kind: 'failed'; reason: string};

type ZkUiState =
  | {kind: 'idle'}
  | {kind: 'building'; pct: number}
  | {kind: 'proving'; pct: number}
  | {kind: 'verifying'; pct: number}
  | {kind: 'ready'; proof: ZKProof}
  | {kind: 'failed'; erroredStage: 1 | 2 | 3; reason: string; hostedBanner?: string}
  | {kind: 'sheet'; savedFailure: {erroredStage: 1 | 2 | 3; reason: string; hostedBanner?: string}}
  | {kind: 'hosted-proving'};

type Action =
  | {type: 'START_BUILDING'}
  | {type: 'TICK'; pct: number}
  | {type: 'ADVANCE_TO_PROVING'}
  | {type: 'ADVANCE_TO_VERIFYING'}
  | {type: 'ADVANCE_TO_READY'; proof: ZKProof}
  | {type: 'FAIL'; erroredStage: 1 | 2 | 3; reason: string; hostedBanner?: string}
  | {type: 'OPEN_SHEET'}
  | {type: 'CLOSE_SHEET'}
  | {type: 'START_HOSTED'}
  | {type: 'RESET'};

function reducer(state: ZkUiState, action: Action): ZkUiState {
  switch (action.type) {
    case 'START_BUILDING':
      return {kind: 'building', pct: 0};
    case 'TICK':
      if (
        state.kind === 'building' ||
        state.kind === 'proving' ||
        state.kind === 'verifying'
      ) {
        return {...state, pct: action.pct};
      }
      return state;
    case 'ADVANCE_TO_PROVING':
      return {kind: 'proving', pct: 0};
    case 'ADVANCE_TO_VERIFYING':
      return {kind: 'verifying', pct: 0};
    case 'ADVANCE_TO_READY':
      return {kind: 'ready', proof: action.proof};
    case 'FAIL':
      return {
        kind: 'failed',
        erroredStage: action.erroredStage,
        reason: action.reason,
        hostedBanner: action.hostedBanner,
      };
    case 'OPEN_SHEET':
      if (state.kind === 'failed') {
        return {
          kind: 'sheet',
          savedFailure: {
            erroredStage: state.erroredStage,
            reason: state.reason,
            hostedBanner: state.hostedBanner,
          },
        };
      }
      return state;
    case 'CLOSE_SHEET':
      if (state.kind === 'sheet') {
        return {kind: 'failed', ...state.savedFailure};
      }
      return state;
    case 'START_HOSTED':
      return {kind: 'hosted-proving'};
    case 'RESET':
      return {kind: 'idle'};
    default:
      return state;
  }
}

function buildMockWitness(params: Props['route']['params']): ProofWitness {
  // Zero-filled values matching ProofWitness shape. Real values flow in once
  // shielded send pipes amount/recipient into proof generation end-to-end.
  const zeroHex = '0x' + '0'.repeat(64);
  return {
    noteCommitment: zeroHex,
    merklePath: [],
    merklePathIndices: [],
    nullifier: zeroHex,
    amount: params.amount,
    recipientAddress: params.recipient,
    noteSecret: zeroHex,
  };
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function ZkProofScreen({navigation, route}: Props) {
  const [state, dispatch] = useReducer(reducer, {kind: 'idle'} as ZkUiState);
  const chainResultRef = useRef<ChainResult>({kind: 'pending'});
  const [retryCounter, setRetryCounter] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isProceeding, setIsProceeding] = useState(false);
  const guardTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  // FLAG_SECURE on mount, off on unmount
  useEffect(() => {
    void securityManager.enableSecureScreen();
    return () => {
      void securityManager.disableSecureScreen();
    };
  }, []);

  // Clear all pending guard timers on unmount to prevent setState-on-unmounted warnings.
  useEffect(() => {
    return () => {
      guardTimersRef.current.forEach(clearTimeout);
      guardTimersRef.current = [];
    };
  }, []);

  // Chain effect — runs on mount + every retry. Resets chainResultRef and
  // kicks off zkProver.prove() in the background. Result lands in the ref.
  useEffect(() => {
    let cancelled = false;
    chainResultRef.current = {kind: 'pending'};

    async function runChain() {
      try {
        const witness = buildMockWitness(route.params);
        const proofType = route.params.direction === 'private' ? 'deposit' : 'withdraw';
        const proof = await zkProver.prove(proofType, witness);
        if (cancelled) return;
        chainResultRef.current = {kind: 'success', proof};
      } catch (err) {
        if (cancelled) return;
        chainResultRef.current = {kind: 'failed', reason: extractErrorMessage(err)};
      }
    }

    void runChain();
    return () => {
      cancelled = true;
    };
  }, [retryCounter, route.params]);

  // Mount + retry → kick off the state machine
  useEffect(() => {
    dispatch({type: 'START_BUILDING'});
  }, [retryCounter]);

  // Stage timer — runs once per stage transition (building/proving/verifying).
  // At end of each stage, reads chainResultRef.current and dispatches:
  //   - success → ADVANCE_TO_READY (fast-forward)
  //   - failed  → FAIL (with current stage as erroredStage)
  //   - pending → next stage (or finalize if we're in verifying)
  useEffect(() => {
    if (
      state.kind !== 'building' &&
      state.kind !== 'proving' &&
      state.kind !== 'verifying'
    ) {
      return;
    }

    const duration =
      state.kind === 'building' ? 2000 : state.kind === 'proving' ? 3000 : 2000;
    const totalTicks = Math.floor(duration / 200);
    let tick = 0;

    const interval = setInterval(() => {
      tick++;
      if (tick < totalTicks) {
        dispatch({type: 'TICK', pct: Math.round((tick / totalTicks) * 100)});
      }
    }, 200);

    const timeout = setTimeout(() => {
      const result = chainResultRef.current;
      const currentStage: 1 | 2 | 3 =
        state.kind === 'building' ? 1 : state.kind === 'proving' ? 2 : 3;

      if (result.kind === 'success') {
        dispatch({type: 'ADVANCE_TO_READY', proof: result.proof});
      } else if (result.kind === 'failed') {
        dispatch({type: 'FAIL', erroredStage: currentStage, reason: result.reason});
      } else if (state.kind === 'building') {
        dispatch({type: 'ADVANCE_TO_PROVING'});
      } else if (state.kind === 'proving') {
        dispatch({type: 'ADVANCE_TO_VERIFYING'});
      }
      // If we're in verifying and chain still pending: fall through to
      // the polling effect below.
    }, duration);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [state.kind]);

  // Polling fallback — if chain still hasn't returned when verifying ends,
  // poll every 200ms until it does. Rare in practice (would mean total
  // animation time of 7s elapsed without hosted/local resolving).
  //
  // Gated on pct === 100 so the chain race rule (min 2 s visible per stage)
  // is preserved. Previously the polling ran throughout the 2 s animation
  // and could early-skip it when chain succeeded mid-stage.
  useEffect(() => {
    if (state.kind !== 'verifying') return;
    if (state.pct < 100) return; // wait for animation to elapse
    const interval = setInterval(() => {
      const result = chainResultRef.current;
      if (result.kind === 'success') {
        clearInterval(interval);
        dispatch({type: 'ADVANCE_TO_READY', proof: result.proof});
      } else if (result.kind === 'failed') {
        clearInterval(interval);
        dispatch({type: 'FAIL', erroredStage: 3, reason: result.reason});
      }
    }, 200);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kind, 'pct' in state ? state.pct : 0]);

  // Ready → 400ms hold → Alert → popToTop
  useEffect(() => {
    if (state.kind !== 'ready') return;
    const t = setTimeout(() => {
      Alert.alert(
        'Proof ready',
        'Transaction simulation (#19) not yet wired — returning to dashboard.',
        [{text: 'OK', onPress: () => navigation.popToTop()}],
      );
    }, 400);
    return () => clearTimeout(t);
  }, [state.kind, navigation]);

  // Hosted-proving — retry with explicit consent. Calls zkProver.prove() again.
  // The module's chain (hosted-first → local → queue) means the user-visible
  // semantics are "another attempt with the user's explicit awareness". A
  // future module refactor will introduce proveHostedOnly().
  useEffect(() => {
    if (state.kind !== 'hosted-proving') return;
    let cancelled = false;
    async function runHosted() {
      try {
        const witness = buildMockWitness(route.params);
        const proofType = route.params.direction === 'private' ? 'deposit' : 'withdraw';
        const proof = await zkProver.prove(proofType, witness);
        if (cancelled) return;
        dispatch({type: 'ADVANCE_TO_READY', proof});
      } catch (err) {
        if (cancelled) return;
        dispatch({
          type: 'FAIL',
          erroredStage: 2,
          reason: "Couldn't generate proof",
          hostedBanner: `Hosted prover also failed: ${extractErrorMessage(err)}`,
        });
      }
    }
    void runHosted();
    return () => {
      cancelled = true;
    };
  // Note: route.params is intentionally NOT in deps. The hosted-proving
  // flow is state-triggered (user tapped Proceed in the sheet), not
  // param-triggered, so re-firing on a stale params reference would
  // cancel an in-flight hosted proof for no reason.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kind]);

  // Android hardware back — confirm during proof, otherwise dismiss/close sheet
  const handleBack = useCallback(() => {
    const midProof =
      state.kind === 'building' ||
      state.kind === 'proving' ||
      state.kind === 'verifying' ||
      state.kind === 'hosted-proving';
    if (midProof) {
      Alert.alert('Cancel proof generation?', 'Your transaction will not be sent.', [
        {text: 'Continue proving', style: 'cancel'},
        {text: 'Cancel', style: 'destructive', onPress: () => navigation.goBack()},
      ]);
      return true;
    }
    if (state.kind === 'sheet') {
      dispatch({type: 'CLOSE_SHEET'});
      return true;
    }
    navigation.goBack();
    return true;
  }, [state.kind, navigation]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', handleBack);
    return () => sub.remove();
  }, [handleBack]);

  function handleRetryLocal() {
    if (isRetrying) return;
    setIsRetrying(true);
    setRetryCounter(c => c + 1);
    dispatch({type: 'RESET'});
    const t = setTimeout(() => setIsRetrying(false), 500);
    guardTimersRef.current.push(t);
  }

  function handleOpenSheet() {
    dispatch({type: 'OPEN_SHEET'});
  }

  function handleCloseSheet() {
    dispatch({type: 'CLOSE_SHEET'});
  }

  function handleProceedHosted() {
    if (isProceeding) return;
    setIsProceeding(true);
    dispatch({type: 'START_HOSTED'});
    const t = setTimeout(() => setIsProceeding(false), 500);
    guardTimersRef.current.push(t);
  }

  const stages = computeStages(state);
  const hero = computeHero(state);

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      className="flex-1 bg-bg-base">
      {/* Top bar */}
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
          <Text variant="overline" className="text-accent-shielded">SHIELDED</Text>
        </View>
        <Text variant="overline" className="text-fg-tertiary">ZK</Text>
      </View>

      <ScrollView
        style={{flex: 1}}
        contentContainerStyle={{paddingHorizontal: 20, paddingBottom: 24}}>
        {/* Hero */}
        <View className="items-center mt-6">
          <View
            className="rounded-full items-center justify-center border border-accent-shielded"
            style={{
              width: 88,
              height: 88,
              shadowColor: ACCENT,
              shadowOpacity: hero.spinning ? 0.5 : 0.25,
              shadowRadius: 16,
              shadowOffset: {width: 0, height: 0},
              elevation: 6,
            }}>
            <Cpu size={44} color={ACCENT} strokeWidth={1.75} />
          </View>
          <Text variant="h2" className="text-fg-primary mt-4 text-center">
            {hero.label}
          </Text>
          <Text variant="body-sm" className="text-fg-secondary mt-2 text-center max-w-xs">
            {hero.sub}
          </Text>
        </View>

        {/* Hosted banner (only on failed with hostedBanner) */}
        {state.kind === 'failed' && state.hostedBanner ? (
          <View className="bg-[rgba(255,92,106,0.12)] border border-[rgba(255,92,106,0.32)] rounded-md p-3 mt-6">
            <Text variant="body-sm" className="text-fg-primary">
              {state.hostedBanner}
            </Text>
          </View>
        ) : null}

        {/* Stages */}
        <View className="mt-8 gap-3">
          {stages.map(stage => (
            <StageRow key={stage.num} stage={stage} />
          ))}
        </View>

        {/* "Local prover slow?" hint — visible during active stages. Static
            informational text per spec §G (out of scope: tap action deferred
            to v0.3 docs WebView, same as #17 Learn more). Rendered as View
            (not Pressable) so accessibility doesn't falsely promise an action. */}
        {state.kind === 'building' ||
        state.kind === 'proving' ||
        state.kind === 'verifying' ? (
          <View className="mt-4 self-center">
            <Text variant="body-sm" className="text-accent-shielded">
              Local prover slow?
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Footer note (always visible above sticky bar) */}
      <View className="flex-row items-center gap-2 px-5 mb-3">
        <ShieldCheck size={14} color={ACCENT} strokeWidth={1.75} />
        <Text variant="body-sm" className="text-accent-shielded">
          FLAG_SECURE · screenshots blocked
        </Text>
      </View>

      {/* Sticky bar — only on failed state */}
      {state.kind === 'failed' ? (
        <View className="px-5 pb-4 gap-3">
          <Pressable
            testID="retry-local-button"
            onPress={handleRetryLocal}
            disabled={isRetrying}
            accessibilityRole="button"
            accessibilityLabel="Retry locally"
            className={`h-14 rounded-pill ${isRetrying ? 'bg-accent-shielded opacity-60' : 'bg-accent-shielded'} items-center justify-center active:opacity-90`}>
            <Text variant="body-lg" className="font-geist-semibold text-bg-base">
              Retry locally
            </Text>
          </Pressable>
          <Pressable
            testID="use-hosted-button"
            onPress={handleOpenSheet}
            accessibilityRole="button"
            accessibilityLabel="Use Noctura hosted prover"
            className="h-14 rounded-pill bg-bg-surface-1 items-center justify-center active:opacity-90 border border-bg-surface-3">
            <Text variant="body-lg" className="font-geist-semibold text-fg-primary">
              Use Noctura hosted prover
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Hosted prover sheet (Modal) */}
      <Modal
        visible={state.kind === 'sheet'}
        animationType="slide"
        transparent
        onRequestClose={handleCloseSheet}>
        <View className="flex-1 bg-[rgba(0,0,0,0.5)] justify-end">
          <View className="bg-bg-surface-1 rounded-t-lg p-5">
            {/* Grabber */}
            <View className="self-center w-10 h-1 rounded-pill bg-fg-tertiary mb-4" />
            <Text variant="h2" className="text-fg-primary mb-4">
              Use Noctura hosted prover
            </Text>
            <View className="flex-row gap-3 mb-4">
              <DisclosureCard accent="warn" title="Server SEES" items={SEES_ITEMS} />
              <DisclosureCard
                accent="shield"
                title="Server CAN'T SEE"
                items={CANT_SEE_ITEMS}
              />
            </View>
            <Text variant="body-sm" className="text-accent-shielded mb-4">
              By proceeding you opt in to a one-time hosted proof. You'll be asked again on the next failure.
            </Text>
            <Pressable
              testID="cancel-hosted-button"
              onPress={handleCloseSheet}
              accessibilityRole="button"
              accessibilityLabel="Cancel hosted proof"
              className="h-12 rounded-pill bg-bg-surface-2 items-center justify-center active:opacity-90 mb-3 border border-bg-surface-3">
              <Text variant="body-lg" className="font-geist-semibold text-fg-primary">
                Cancel
              </Text>
            </Pressable>
            <Pressable
              testID="proceed-hosted-button"
              onPress={handleProceedHosted}
              disabled={isProceeding}
              accessibilityRole="button"
              accessibilityLabel="Proceed with hosted proof"
              className={`h-14 rounded-pill ${isProceeding ? 'bg-accent-shielded opacity-60' : 'bg-accent-shielded'} items-center justify-center active:opacity-90`}>
              <Text variant="body-lg" className="font-geist-semibold text-bg-base">
                Proceed with hosted proof
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── StageRow ─────────────────────────────────────────────────────────────
interface StageRowProps {
  stage: {
    num: StageNum;
    title: string;
    status: StageStatus;
    meta: string;
    statusDisplay: string;
  };
}

function StageRow({stage}: StageRowProps) {
  const isActive = stage.status === 'active';
  const isDone = stage.status === 'done';
  const isErrored = stage.status === 'errored';
  const containerCls = isActive
    ? 'bg-[rgba(91,227,194,0.08)] border border-[rgba(91,227,194,0.32)]'
    : isErrored
    ? 'bg-[rgba(255,92,106,0.08)] border border-[rgba(255,92,106,0.32)]'
    : 'bg-bg-surface-1';
  const discCls = isDone || isActive ? 'bg-accent-shielded-tint' : 'bg-bg-surface-2';
  const numTextColor = isActive ? 'text-accent-shielded' : 'text-fg-tertiary';
  return (
    <View className={`flex-row items-center gap-3 p-3 rounded-md ${containerCls}`}>
      <View
        className={`w-7 h-7 rounded-full items-center justify-center ${discCls}`}>
        {isDone ? (
          <Check size={14} color={ACCENT} strokeWidth={2} />
        ) : isErrored ? (
          <AlertTriangle size={14} color={DANGER} strokeWidth={2} />
        ) : (
          <Text variant="body-sm" mono numeral className={numTextColor}>
            {stage.num}
          </Text>
        )}
      </View>
      <View className="flex-1">
        <Text variant="body-sm" className="text-fg-primary">
          {stage.title}
        </Text>
        <Text variant="caption" className="text-fg-tertiary">
          {stage.meta}
        </Text>
      </View>
      <Text
        variant="body-sm"
        mono
        numeral
        className={isErrored ? 'text-danger' : 'text-fg-tertiary'}>
        {stage.statusDisplay}
      </Text>
    </View>
  );
}

// ── DisclosureCard ───────────────────────────────────────────────────────
interface DisclosureCardProps {
  accent: 'warn' | 'shield';
  title: string;
  items: string[];
}

function DisclosureCard({accent, title, items}: DisclosureCardProps) {
  const tintBg =
    accent === 'warn' ? 'bg-[rgba(255,184,77,0.12)]' : 'bg-[rgba(91,227,194,0.12)]';
  const tintBorder =
    accent === 'warn' ? 'border-[rgba(255,184,77,0.32)]' : 'border-[rgba(91,227,194,0.32)]';
  const titleColor = accent === 'warn' ? 'text-warning' : 'text-accent-shielded';
  return (
    <View className={`flex-1 p-3 rounded-md border ${tintBg} ${tintBorder}`}>
      <Text variant="overline" className={`${titleColor} mb-2`}>
        {title}
      </Text>
      {items.map(item => (
        <Text key={item} variant="body-sm" className="text-fg-secondary mb-1">
          {item}
        </Text>
      ))}
    </View>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────
function computeHero(state: ZkUiState): {label: string; sub: string; spinning: boolean} {
  switch (state.kind) {
    case 'idle':
      return {
        label: 'Preparing proof',
        sub: 'Securely generating a zero-knowledge proof of ownership for this transfer. Stays on-device.',
        spinning: false,
      };
    case 'building':
      return {
        label: 'Building witness',
        sub: 'Loading commitment tree and constructing the witness. About 4 seconds.',
        spinning: true,
      };
    case 'proving':
      return {
        label: 'Proving',
        sub: 'Running the Plonk prover. About 6 seconds.',
        spinning: true,
      };
    case 'verifying':
      return {
        label: 'Verifying',
        sub: 'Sanity-checking the proof on-device before broadcast.',
        spinning: true,
      };
    case 'ready':
      return {
        label: 'Proof ready',
        sub: 'Proof generated. Submitting to the network.',
        spinning: false,
      };
    case 'failed':
      return {label: "Couldn't generate proof", sub: state.reason, spinning: false};
    case 'sheet':
      return {
        label: "Couldn't generate proof",
        sub: state.savedFailure.reason,
        spinning: false,
      };
    case 'hosted-proving':
      return {
        label: 'Generating on hosted prover',
        sub: 'Connecting to the Noctura proving service.',
        spinning: true,
      };
  }
}

function computeStages(
  state: ZkUiState,
): Array<{
  num: StageNum;
  title: string;
  status: StageStatus;
  meta: string;
  statusDisplay: string;
}> {
  const titles: Record<StageNum, string> = {
    1: 'Build witness',
    2: 'Prove',
    3: 'Verify locally',
    4: 'Ready',
  };
  const row = (num: StageNum, status: StageStatus, meta: string, statusDisplay: string) => ({
    num,
    title: titles[num],
    status,
    meta,
    statusDisplay,
  });

  if (state.kind === 'idle' || state.kind === 'hosted-proving') {
    return ([1, 2, 3, 4] as StageNum[]).map(n => row(n, 'pending', '— · pending', '·'));
  }
  if (state.kind === 'building') {
    return [
      row(1, 'active', 'running · 2.0 s', `${state.pct} %`),
      row(2, 'pending', '— · pending', '·'),
      row(3, 'pending', '— · pending', '·'),
      row(4, 'pending', '— · pending', '·'),
    ];
  }
  if (state.kind === 'proving') {
    return [
      row(1, 'done', 'done · 2.0 s', '✓'),
      row(2, 'active', 'running · 3.0 s', `${state.pct} %`),
      row(3, 'pending', '— · pending', '·'),
      row(4, 'pending', '— · pending', '·'),
    ];
  }
  if (state.kind === 'verifying') {
    return [
      row(1, 'done', 'done · 2.0 s', '✓'),
      row(2, 'done', 'done · 3.0 s', '✓'),
      row(3, 'active', 'running · 2.0 s', `${state.pct} %`),
      row(4, 'pending', '— · pending', '·'),
    ];
  }
  if (state.kind === 'ready') {
    return [
      row(1, 'done', 'done · 2.0 s', '✓'),
      row(2, 'done', 'done · 3.0 s', '✓'),
      row(3, 'done', 'done · 2.0 s', '✓'),
      row(4, 'done', 'ready', '✓'),
    ];
  }
  // failed or sheet
  const failure = state.kind === 'failed' ? state : state.savedFailure;
  // Hosted-proving failures: no local stages ran, so show all 4 as pending
  // with stage 4 marked errored. The hostedBanner above the stages list
  // already explains what happened — no need to falsely imply local progress.
  if (failure.hostedBanner) {
    return ([1, 2, 3, 4] as StageNum[]).map(n => {
      if (n === 4) return row(n, 'errored', 'hosted attempt · failed', '!');
      return row(n, 'pending', '— · pending', '·');
    });
  }
  return ([1, 2, 3, 4] as StageNum[]).map(n => {
    if (n < failure.erroredStage) return row(n, 'done', 'done', '✓');
    if (n === failure.erroredStage) return row(n, 'errored', `error · ${failure.reason}`, '!');
    return row(n, 'pending', '— · pending', '·');
  });
}
