import React, {useEffect, useRef, useState} from 'react';
import {View, Pressable, ScrollView, ActivityIndicator} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ArrowLeft, Check, AlertTriangle, Info, ArrowRight, ShieldCheck, Eye} from 'lucide-react-native';
import {Text, Button, Card} from '../../components/ui';
import {cn} from '../../utils/cn';
import {formatAddress} from '../../utils/formatAddress';
import {formatTokenAmount} from '../../utils/parseTokenAmount';
import {simulateA0Deposit} from '../../modules/shielded/a0/depositFlow';
import {
  A0_DEPOSIT_FEE_LAMPORTS,
  A0_RHO_MARKER_RENT_LAMPORTS,
  SOL_DECIMALS,
  a0ErrorText,
  displayAmount,
  preparedA0Deposit,
} from '../../modules/shielded/a0/screenSupport';
import {getConnection} from '../../modules/solana/connection';
import type {TransferCheck} from '../../modules/solana/simulationChecks';
import type {ShieldIntent} from '../../types/shield';
import {
  CHECK_KNOWN_PROGRAMS_BODY,
  CHECK_KNOWN_PROGRAMS_TITLE,
  CHECK_NO_ACCESS_BODY,
  CHECK_NO_ACCESS_TITLE,
  DETAIL_APPROVALS,
  DETAIL_COMPUTE_UNITS,
  DETAIL_PROGRAMS,
  PRIVATE_MARK,
  PROOF_FEE,
  PROOF_FEE_NONE,
  SIMULATION_PASSED,
  YOUR_BALANCE_CHANGES,
} from '../../copy/modes';
import {DetailsDisclosure} from '../../components/private';

/**
 * #19 tx-simulate for the A0 deposit — mirror /home/user/Downloads/index.html §s19, its SHIELDED
 * variant (states 4–5: "SHIELDED Review", mint accents, "Privacy & risk" + "Balance delta" cards),
 * plus the design's failed state (state 3).
 *
 * The simulation is `simulateA0Deposit`: the exact deposit transaction, unsigned, simulated on
 * chain — the program verifies the proof in it, so a bad proof fails HERE, before any fee. The risk
 * rows are its `checks` (`checkInstructions` over the compiled instructions: FeGSS… and the compute
 * budget program are known; anything else is a row that says so).
 *
 * Copy (D27, spec §11): the privacy row says what is public — the deposit is signed by your main
 * account and its amount and time are on chain — instead of the design's "Privacy preserved" row
 * (a claim about the sender that this deposit does not deliver; privacyClaims.test refuses it).
 *
 * NO "Continue anyway" (deviation from the design's failed state, said loudly): the deposit is sent
 * with preflight ON (Task 4), so a transaction whose simulation fails is refused by the RPC — the
 * button could only burn the deposit counter and leave a pending note. Failed = Retry or Cancel.
 *
 * A stale or forged intent (no held deposit under its id) shows that state and cannot continue.
 *
 * Plain words by default (owner phone pass 2, 2026-11-21, item 4): "Simulation passed" without the
 * compute units; the two PASSING instruction checks in plain words ("Only known programs", "No one
 * gets access to your tokens"); "Your balance changes"; "Proof fee". The technical lines (compute
 * units, the instruction count, the authority instruction names) sit behind "Details ▾". A check
 * that does NOT pass keeps its own title and meta, visible, with its badge — never in Details.
 * This screen is the deposit's own (#19 for transparent sends / dApp signing is TxSimulateScreen,
 * unchanged).
 */

/**
 * The two passing rows `checkInstructions` returns for a clean deposit, by their exact title
 * (src/modules/solana/instructionChecks.ts) → the plain words. Only an `ok` row is re-worded; its
 * technical meta goes to Details under `detailLabel`. ShieldTxFlow.test feeds the REAL rows, so a
 * changed title there shows as the technical title here, never as a hidden check.
 */
const PLAIN_PASSING: Record<string, {title: string; body: string; detailLabel: string}> = {
  'No interactions with unknown contracts': {title: CHECK_KNOWN_PROGRAMS_TITLE, body: CHECK_KNOWN_PROGRAMS_BODY, detailLabel: DETAIL_PROGRAMS},
  'No token approvals granted': {title: CHECK_NO_ACCESS_TITLE, body: CHECK_NO_ACCESS_BODY, detailLabel: DETAIL_APPROVALS},
};

interface ShownCheck {
  status: TransferCheck['status'];
  title: string;
  body: string;
  /** the technical line for Details, or null when the row shows it itself */
  detail: {label: string; value: string} | null;
}

/** A check as #19 shows it for a deposit: plain words for a known passing row; anything else as it is. */
export function depositCheckView(check: TransferCheck): ShownCheck {
  const plain = check.status === 'ok' && Object.prototype.hasOwnProperty.call(PLAIN_PASSING, check.title) ? PLAIN_PASSING[check.title] : undefined;
  if (plain) {
    return {status: check.status, title: plain.title, body: plain.body, detail: {label: plain.detailLabel, value: check.meta}};
  }
  return {status: check.status, title: check.title, body: check.meta, detail: null};
}

type SimState =
  | {kind: 'simulating'}
  | {kind: 'ready'; checks: TransferCheck[]; units: number | null}
  | {kind: 'failed'; reason: string}
  | {kind: 'missing'};

interface ShieldSimulateScreenProps {
  intent: ShieldIntent;
  onContinue: (intent: ShieldIntent) => void;
  onCancel: () => void;
}

export function ShieldSimulateScreen({intent, onContinue, onCancel}: ShieldSimulateScreenProps) {
  const [sim, setSim] = useState<SimState>({kind: 'simulating'});
  const [attempt, setAttempt] = useState(0);
  const lastTapRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const prepared = preparedA0Deposit(intent.preparedId);
    if (!prepared) {
      setSim({kind: 'missing'});
      return;
    }
    setSim({kind: 'simulating'});
    simulateA0Deposit(getConnection(), prepared)
      .then(({simulation, checks}) => {
        if (cancelled) return;
        if (simulation.success) {
          setSim({kind: 'ready', checks, units: simulation.unitsConsumed ?? null});
        } else {
          setSim({
            kind: 'failed',
            reason: simulation.error?.action ?? simulation.error?.message ?? 'Simulation failed',
          });
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const {code, message} = a0ErrorText(e);
        setSim({kind: 'failed', reason: code ? `${code} · ${message}` : message});
      });
    return () => {
      cancelled = true;
    };
  }, [intent.preparedId, attempt]);

  const tap = (fn: () => void) => () => {
    const now = Date.now();
    if (now - lastTapRef.current < 500) return; // cardinal rule 6
    lastTapRef.current = now;
    fn();
  };

  const amount = `${displayAmount(BigInt(intent.amount), intent.decimals)} ${intent.tokenSymbol}`;

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} className="flex-1 bg-bg-base">
      <View className="flex-row items-center px-4 py-3 min-h-touch-min">
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="w-12 h-12 items-center justify-center -ml-2">
          <ArrowLeft size={22} color="#A8ACB5" strokeWidth={1.75} />
        </Pressable>
        <View className="flex-row items-center gap-2 flex-1 ml-1">
          <ShieldCheck size={12} color="#5BE3C2" strokeWidth={2} />
          <Text variant="overline" className="text-accent-shielded">
            {PRIVATE_MARK}
          </Text>
          <Text variant="h2">Review</Text>
        </View>
        <Text variant="caption" className="text-fg-tertiary">
          3 of 4
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-6 gap-3" showsVerticalScrollIndicator={false}>
        <Card padding="p-4">
          <Eyebrow sim={sim} />
          <View className="flex-row items-center gap-2 flex-wrap">
            <Text variant="body-lg" numeral className="text-fg-primary font-geist-semibold" testID="shield-sim-amount">
              {amount}
            </Text>
            <Text variant="body-sm" mono className="text-fg-tertiary">
              →
            </Text>
            <Text variant="body-sm" mono className="text-accent-shielded">
              the pool
            </Text>
          </View>
          <Text variant="caption" mono className="text-fg-tertiary mt-1">
            {`from ${formatAddress(intent.depositor)} · your main account`}
          </Text>
        </Card>

        {sim.kind === 'simulating' ? (
          <Card padding="p-4" className="gap-3">
            <View className="h-3 rounded-md bg-bg-surface-3 w-1/3 opacity-60" />
            <View className="h-3 rounded-md bg-bg-surface-3 w-full opacity-40" />
            <View className="h-3 rounded-md bg-bg-surface-3 w-2/3 opacity-40" />
          </Card>
        ) : null}

        {sim.kind === 'failed' ? (
          <View className="rounded-lg p-4 bg-[rgba(255,92,106,0.10)] border border-[rgba(255,92,106,0.5)]" testID="shield-sim-failed">
            <View className="flex-row items-center gap-2 mb-1">
              <AlertTriangle size={16} color="#FF5C6A" strokeWidth={2} />
              <Text variant="body" className="text-fg-primary">
                Couldn't simulate this deposit
              </Text>
            </View>
            <Text variant="body-sm" className="text-fg-secondary">
              {`${sim.reason}. Nothing was sent. A deposit that fails its simulation is refused by the network, so it cannot be sent anyway.`}
            </Text>
          </View>
        ) : null}

        {sim.kind === 'missing' ? (
          <View className="rounded-lg p-4 bg-bg-surface-2 border-l-2 border-l-warning" testID="shield-sim-missing">
            <Text variant="body-sm" className="text-fg-secondary">
              This deposit is no longer prepared. Go back and start again.
            </Text>
          </View>
        ) : null}

        {sim.kind === 'ready' ? (
          <>
            <Card padding="p-4">
              <Text variant="overline" className="mb-3">
                Privacy & risk
              </Text>
              <PublicRow />
              {sim.checks.map(depositCheckView).map((c, i) => (
                <CheckRow key={i} check={c} />
              ))}
              <DetailsDisclosure testID="shield-sim-details">
                {sim.units !== null ? <DetailRow label={DETAIL_COMPUTE_UNITS} value={`${sim.units.toLocaleString('en-US')} CU`} /> : null}
                {sim.checks
                  .map(depositCheckView)
                  .map(c => c.detail)
                  .filter((d): d is {label: string; value: string} => d !== null)
                  .map(d => (
                    <DetailRow key={d.label} label={d.label} value={d.value} />
                  ))}
              </DetailsDisclosure>
            </Card>
            <Card padding="p-4">
              <Text variant="overline" className="mb-3">
                {YOUR_BALANCE_CHANGES}
              </Text>
              <DeltaRow label="Making private" value={`− ${amount}`} />
              <DeltaRow label={PROOF_FEE} value={PROOF_FEE_NONE} zk />
              <DeltaRow label="Network fee" value={`− ${formatTokenAmount(A0_DEPOSIT_FEE_LAMPORTS, SOL_DECIMALS)} SOL`} />
              <DeltaRow
                label="Deposit record rent"
                value={`− ≈ ${formatTokenAmount(A0_RHO_MARKER_RENT_LAMPORTS, SOL_DECIMALS)} SOL`}
              />
            </Card>
          </>
        ) : null}
      </ScrollView>

      <View className="px-6 pb-8 pt-2 bg-bg-base border-t border-bg-surface-2 gap-3">
        {sim.kind === 'ready' ? (
          <Pressable
            onPress={tap(() => onContinue(intent))}
            accessibilityRole="button"
            accessibilityLabel="Continue to confirm"
            testID="shield-sim-continue"
            className="min-h-touch-rec rounded-pill items-center justify-center flex-row gap-2 bg-accent-shielded active:opacity-90">
            <ArrowRight size={18} color="#0A0A0A" strokeWidth={2} />
            <Text variant="body-lg" className="font-geist-semibold text-bg-base">
              Continue to confirm
            </Text>
          </Pressable>
        ) : sim.kind === 'failed' ? (
          <Button label="Retry simulation" variant="primary" onPress={tap(() => setAttempt(a => a + 1))} testID="shield-sim-retry" />
        ) : sim.kind === 'simulating' ? (
          <Button label="Simulating…" variant="primary" disabled onPress={() => {}} testID="shield-sim-continue" />
        ) : null}
        <Button label="Cancel" variant="tertiary" onPress={onCancel} testID="shield-sim-cancel" />
      </View>
    </SafeAreaView>
  );
}

function Eyebrow({sim}: {sim: SimState}) {
  if (sim.kind === 'simulating') {
    return (
      <View className="flex-row items-center gap-1 mb-2">
        <ActivityIndicator size="small" color="#5BE3C2" style={{transform: [{scale: 0.7}]}} />
        <Text variant="caption" className="text-accent-shielded">
          Simulating the deposit
        </Text>
      </View>
    );
  }
  if (sim.kind === 'ready') {
    return (
      <View className="flex-row items-center gap-1 mb-2">
        <Check size={12} color="#3FD68B" strokeWidth={2.5} />
        <Text variant="caption" className="text-success">
          {SIMULATION_PASSED}
        </Text>
      </View>
    );
  }
  return (
    <View className="flex-row items-center gap-1 mb-2">
      <AlertTriangle size={12} color="#FF5C6A" strokeWidth={2} />
      <Text variant="caption" className="text-danger">
        {sim.kind === 'missing' ? 'Nothing to review' : "Couldn't simulate"}
      </Text>
    </View>
  );
}

/** The privacy row: what this deposit makes public (D27 copy; nothing claims unlinkability). */
function PublicRow() {
  return (
    <View className="flex-row items-start gap-3 py-3" testID="shield-sim-public-row">
      <View className="w-7 h-7 rounded-full items-center justify-center mt-0.5 bg-[rgba(245,166,35,0.16)]">
        <Eye size={14} color="#F5A623" strokeWidth={2} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="body-sm" className="text-fg-primary">
          A public deposit
        </Text>
        <Text variant="caption" className="text-fg-tertiary">
          Your main account signs it. Its amount and time are visible on chain.
        </Text>
      </View>
      <Text variant="caption" className="font-geist-semibold text-warning pt-0.5">
        PUBLIC
      </Text>
    </View>
  );
}

function CheckRow({check}: {check: ShownCheck}) {
  const color = check.status === 'ok' ? '#3FD68B' : check.status === 'warn' ? '#F5A623' : '#FF5C6A';
  const bg =
    check.status === 'ok'
      ? 'bg-[rgba(63,214,139,0.16)]'
      : check.status === 'warn'
        ? 'bg-[rgba(245,166,35,0.16)]'
        : 'bg-[rgba(255,92,106,0.16)]';
  const badge = check.status === 'ok' ? 'PASS' : check.status === 'warn' ? 'CHECK' : 'FAIL';
  const badgeCls = check.status === 'ok' ? 'text-success' : check.status === 'warn' ? 'text-warning' : 'text-danger';
  const Icon = check.status === 'ok' ? Check : check.status === 'warn' ? Info : AlertTriangle;
  return (
    <View className="flex-row items-start gap-3 py-3 border-t border-bg-surface-2">
      <View className={cn('w-7 h-7 rounded-full items-center justify-center mt-0.5', bg)}>
        <Icon size={14} color={color} strokeWidth={2} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="body-sm" className="text-fg-primary">
          {check.title}
        </Text>
        <Text variant="caption" className="text-fg-tertiary">
          {check.body}
        </Text>
      </View>
      <Text variant="caption" className={cn('font-geist-semibold pt-0.5', badgeCls)}>
        {badge}
      </Text>
    </View>
  );
}

function DetailRow({label, value}: {label: string; value: string}) {
  return (
    <View className="flex-row items-start justify-between gap-3 py-1">
      <Text variant="caption" className="text-fg-tertiary">
        {label}
      </Text>
      <Text variant="caption" mono className="flex-1 text-right text-fg-secondary">
        {value}
      </Text>
    </View>
  );
}

function DeltaRow({label, value, zk}: {label: string; value: string; zk?: boolean}) {
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text variant="body-sm" className={zk ? 'text-accent-shielded' : 'text-fg-secondary'}>
        {label}
      </Text>
      <Text variant="body-sm" numeral className={cn('font-geist-semibold', zk ? 'text-fg-secondary' : 'text-danger')}>
        {value}
      </Text>
    </View>
  );
}
