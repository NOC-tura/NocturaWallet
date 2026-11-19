import React, {useCallback, useEffect, useRef, useState} from 'react';
import {View, Pressable, ScrollView, Alert, BackHandler} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ArrowLeft, ShieldCheck, RefreshCw} from 'lucide-react-native';
import {Text} from '../../components/ui';
import {ScreenSecurityManager} from '../../modules/screenSecurity/screenSecurityModule';
import {prepareA0Deposit} from '../../modules/shielded/a0/depositFlow';
import type {A0PrepareStage, A0PreparedDeposit} from '../../modules/shielded/a0/depositFlow';
import {A0_TOKEN, a0ErrorText, holdPreparedA0Deposit} from '../../modules/shielded/a0/screenSupport';
import {keychainManager} from '../../modules/keychain/keychainModule';
import {mnemonicToSeed} from '../../modules/keyDerivation/mnemonicUtils';
import {getConnection} from '../../modules/solana/connection';
import type {ShieldIntent} from '../../types/shield';
import {ProofHeroRing, StageRow} from './shieldedParts';
import type {StageRowStatus} from './shieldedParts';

/**
 * #18 zk-proof — mirror /home/user/Downloads/index.html §s18 (+ screen.md #18), for the A0 deposit
 * (spec §5 steps 2–4, §11 "#18 zk-proof, with real stages").
 *
 * REAL STAGES, NO FIXED PERCENTAGES. The four rows of the design are driven by
 * `prepareA0Deposit`'s `onStage` — nothing is timed or animated to look like progress:
 *   1 Build witness   ← checking (amount, prover, store, cluster, token account) → keyFiles
 *                        (the pinned A0 key files) → precheck (the deposit counter's rho PDA; repeats
 *                        on a hit) → commitment (Rust's commitment(amount, rho));
 *   2 Prove           ← proving (the Groth16 prover in the Rust core, on this device);
 *   3 Verify locally  ← verifying (the proof's four public inputs against this deposit's values);
 *   4 Ready           ← the prepared deposit returned.
 * Each row shows its MEASURED time ("running · 2.1 s" from a clock while it runs, "done · 4.2 s"
 * after), not a percentage: no stage reports a fraction, so the design's "42 %" is not drawn
 * (deviation, said loudly). A failure marks the row it happened in and shows the E_A0_* code.
 *
 * NO HOSTED PROVER. The design's failed state offers "Use Noctura hosted prover" and its disclosure
 * sheet, and the "Local prover slow?" link leads there. A0 has no hosted proving (spec §1: `/zk/prove`
 * answers 410; the witness never leaves the device), so the failed state has one action, "Retry on
 * this device", and neither the link nor the sheet exists (deviation, said loudly).
 *
 * The seed is read from the keychain (biometric) once per attempt and consumed by the prepare.
 * Ready → 400 ms → #19 (replace: back from #19 returns to #16, as the design's Cancel does).
 */

const ACCENT = '#5BE3C2';
const securityManager = new ScreenSecurityManager();

interface ZkProofScreenProps {
  /** base units, decimal string */
  amount: string;
  onReady: (intent: ShieldIntent) => void;
  onCancel: () => void;
}

type Row = 1 | 2 | 3 | 4;

const ROW_OF: Record<A0PrepareStage, Row> = {
  checking: 1,
  keyFiles: 1,
  precheck: 1,
  commitment: 1,
  proving: 2,
  verifying: 3,
};

const SUBSTEP: Record<A0PrepareStage, string> = {
  checking: 'checking the network and your account',
  keyFiles: 'loading the proving key files',
  precheck: 'checking the deposit counter on chain',
  commitment: 'computing the note commitment',
  proving: 'running the Groth16 prover',
  verifying: 'comparing the public inputs',
};

type Phase =
  | {kind: 'auth'}
  | {kind: 'running'; stage: A0PrepareStage}
  | {kind: 'ready'}
  | {kind: 'failed'; row: Row; code: string | null; message: string};

const TITLES: Record<Row, string> = {1: 'Build witness', 2: 'Prove', 3: 'Verify locally', 4: 'Ready'};

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

export function ZkProofScreen({amount, onReady, onCancel}: ZkProofScreenProps) {
  const [phase, setPhase] = useState<Phase>({kind: 'auth'});
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const rowStart = useRef<Partial<Record<Row, number>>>({});
  const rowDone = useRef<Partial<Record<Row, number>>>({});
  const lastTapRef = useRef(0);
  // The latest callback, read when the proof is ready: a new callback identity from a re-render
  // must never restart the prepare (it would make a second proof).
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    void securityManager.enableSecureScreen();
    return () => {
      void securityManager.disableSecureScreen();
    };
  }, []);

  // A clock for the running row's elapsed time — display only, it drives no stage.
  const running = phase.kind === 'running' || phase.kind === 'auth';
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    let cancelled = false;
    rowStart.current = {};
    rowDone.current = {};
    setPhase({kind: 'auth'});
    let current: Row = 1;

    const onStage = (stage: A0PrepareStage) => {
      if (cancelled) return;
      const row = ROW_OF[stage];
      const t = Date.now();
      if (row !== current) {
        rowDone.current[current] = t;
        current = row;
      }
      rowStart.current[row] ??= t;
      setNow(t);
      setPhase({kind: 'running', stage});
    };

    (async () => {
      let prepared: A0PreparedDeposit;
      try {
        const seed = await mnemonicToSeed(await keychainManager.retrieveSeed());
        if (cancelled) {
          seed.fill(0);
          return;
        }
        prepared = await prepareA0Deposit(getConnection(), seed, BigInt(amount), {onStage});
      } catch (e) {
        if (cancelled) return;
        setPhase({kind: 'failed', row: current, ...a0ErrorText(e)});
        return;
      }
      if (cancelled) return;
      const t = Date.now();
      rowDone.current[current] = t;
      rowStart.current[4] = t;
      rowDone.current[4] = t;
      setNow(t);
      setPhase({kind: 'ready'});
      const preparedId = holdPreparedA0Deposit(prepared);
      setTimeout(() => {
        if (cancelled) return;
        onReadyRef.current({
          kind: 'shield',
          preparedId,
          amount,
          tokenSymbol: A0_TOKEN.symbol,
          decimals: A0_TOKEN.decimals,
          depositor: prepared.depositor,
        });
      }, 400);
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt, amount]);

  const handleBack = useCallback(() => {
    if (phase.kind === 'auth' || phase.kind === 'running') {
      Alert.alert('Cancel proof generation?', 'Nothing has been sent. The proof is discarded.', [
        {text: 'Continue proving', style: 'cancel'},
        {text: 'Cancel', style: 'destructive', onPress: onCancel},
      ]);
      return true;
    }
    onCancel();
    return true;
  }, [phase.kind, onCancel]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', handleBack);
    return () => sub.remove();
  }, [handleBack]);

  const handleRetry = () => {
    const t = Date.now();
    if (t - lastTapRef.current < 500) return;
    lastTapRef.current = t;
    setAttempt(a => a + 1);
  };

  const hero = heroOf(phase);
  const rows = ([1, 2, 3, 4] as Row[]).map(r => rowOf(r, phase, rowStart.current, rowDone.current, now));

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

      <ScrollView style={{flex: 1}} contentContainerStyle={{paddingHorizontal: 20, paddingBottom: 24}}>
        <View
          className={`items-center mt-4 p-5 rounded-lg border ${
            phase.kind === 'failed' ? 'border-[rgba(255,92,106,0.32)]' : 'border-[rgba(91,227,194,0.32)]'
          }`}>
          <ProofHeroRing tone={phase.kind === 'failed' ? 'failed' : phase.kind === 'ready' ? 'ready' : 'busy'} />
          <Text
            variant="h2"
            testID="zk-hero"
            className={`mt-4 text-center ${
              phase.kind === 'failed' ? 'text-danger' : phase.kind === 'ready' ? 'text-accent-shielded' : 'text-fg-primary'
            }`}>
            {hero.label}
          </Text>
          <Text
            variant="body-sm"
            testID="zk-hero-sub"
            className={`mt-2 text-center max-w-xs ${phase.kind === 'failed' ? 'text-danger' : 'text-fg-secondary'}`}>
            {hero.sub}
          </Text>
        </View>

        <View className="mt-6 gap-3">
          {rows.map(r => (
            <StageRow key={r.num} testID={`zk-stage-${r.num}`} {...r} />
          ))}
        </View>
      </ScrollView>

      <View className="flex-row items-center justify-center gap-2 px-5 mb-3">
        <ShieldCheck size={14} color={ACCENT} strokeWidth={1.75} />
        <Text variant="body-sm" className="text-accent-shielded">
          FLAG_SECURE · screenshots blocked
        </Text>
      </View>

      {phase.kind === 'failed' ? (
        <View className="px-5 pb-4">
          <Pressable
            testID="retry-local-button"
            onPress={handleRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry on this device"
            className="h-14 rounded-pill bg-accent-shielded items-center justify-center flex-row gap-2 active:opacity-90">
            <RefreshCw size={18} color="#0A0A0A" strokeWidth={2} />
            <Text variant="body-lg" className="font-geist-semibold text-bg-base">
              Retry on this device
            </Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function heroOf(phase: Phase): {label: string; sub: string} {
  switch (phase.kind) {
    case 'auth':
      return {
        label: 'Preparing proof',
        sub: 'Unlock with your fingerprint or passcode. The proof is generated on this device.',
      };
    case 'running': {
      const row = ROW_OF[phase.stage];
      const label = row === 1 ? 'Building witness' : row === 2 ? 'Proving' : 'Verifying';
      const sub =
        row === 2
          ? 'Running the Groth16 prover on this device.'
          : row === 3
            ? "Checking the proof's public inputs against this deposit."
            : `Building the deposit: ${SUBSTEP[phase.stage]}.`;
      return {label, sub};
    }
    case 'ready':
      return {label: 'Proof ready', sub: 'Continuing to transaction preview…'};
    case 'failed':
      return {label: 'Proof failed', sub: phase.code ? `${phase.code} · ${phase.message}` : phase.message};
  }
}

interface RowView {
  num: Row;
  title: string;
  status: StageRowStatus;
  meta: string;
  mark: string;
}

function rowOf(
  num: Row,
  phase: Phase,
  start: Partial<Record<Row, number>>,
  done: Partial<Record<Row, number>>,
  now: number,
): RowView {
  const title = TITLES[num];
  const s = start[num];
  const d = done[num];
  if (phase.kind === 'failed') {
    if (num < phase.row && s !== undefined && d !== undefined) {
      return {num, title, status: 'done', meta: `done · ${seconds(d - s)}`, mark: '✓'};
    }
    if (num === phase.row) {
      return {num, title, status: 'errored', meta: `failed · ${phase.code ?? 'error'}`, mark: 'ERR'};
    }
    return {num, title, status: 'skipped', meta: '— · skipped', mark: '·'};
  }
  if (d !== undefined && s !== undefined) {
    return {num, title, status: 'done', meta: num === 4 ? 'ready' : `done · ${seconds(d - s)}`, mark: '✓'};
  }
  if (phase.kind === 'running' && ROW_OF[phase.stage] === num && s !== undefined) {
    return {num, title, status: 'active', meta: `${SUBSTEP[phase.stage]} · ${seconds(now - s)}`, mark: '…'};
  }
  if (phase.kind === 'auth' && num === 1) {
    return {num, title, status: 'active', meta: 'waiting for you to unlock', mark: '…'};
  }
  return {num, title, status: 'pending', meta: '— · pending', mark: '·'};
}
