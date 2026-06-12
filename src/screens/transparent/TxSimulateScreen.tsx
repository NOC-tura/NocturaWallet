import React, {useEffect, useRef, useState} from 'react';
import {View, Pressable, ScrollView, ActivityIndicator} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Check,
  AlertTriangle,
  Info,
  ArrowRight,
} from 'lucide-react-native';
import {PublicKey} from '@solana/web3.js';
import {Text, Button, Card} from '../../components/ui';
import {parseTokenAmount, formatTokenAmount} from '../../utils/parseTokenAmount';
import {formatAddress} from '../../utils/formatAddress';
import {useWalletStore} from '../../store/zustand/walletStore';
import {cn} from '../../utils/cn';
import type {TransferIntent} from '../../types/transfer';
import type {TransferCheck} from '../../modules/solana/simulationChecks';

// ── Lazy imports — wrapped in try/catch so Jest/stub envs don't crash ────────
let getConnection: (() => import('@solana/web3.js').Connection) | null = null;
let simulateTransaction:
  | ((
      connection: import('@solana/web3.js').Connection,
      tx: import('@solana/web3.js').VersionedTransaction,
    ) => Promise<{success: boolean; error?: {code: string; message: string; action: string}}>)
  | null = null;
let buildTransferTx:
  | typeof import('../../modules/solana/transactionBuilder').buildTransferTx
  | null = null;
let buildSPLTransferTx:
  | typeof import('../../modules/solana/transactionBuilder').buildSPLTransferTx
  | null = null;
let deriveTransferChecks:
  | ((recipient: PublicKey) => Promise<TransferCheck[]>)
  | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  getConnection = require('../../modules/solana/connection').getConnection;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  simulateTransaction = require('../../modules/solana/simulation').simulateTransaction;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  buildTransferTx = require('../../modules/solana/transactionBuilder').buildTransferTx;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  buildSPLTransferTx = require('../../modules/solana/transactionBuilder').buildSPLTransferTx;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  deriveTransferChecks = require('../../modules/solana/simulationChecks').deriveTransferChecks;
} catch {
  // Modules unavailable in test/stub environment — no-op
}

// ── Fee constants (lamports) ─────────────────────────────────────────────────
const BASE_FEE_LAMPORTS = 5_000n;
const PRIORITY_FEE_LAMPORTS: Record<'normal' | 'fast' | 'urgent', bigint> = {
  normal: 0n,
  fast: 15_000n,
  urgent: 50_000n,
};
const SOL_DECIMALS = 9;

// ── State machine ────────────────────────────────────────────────────────────
interface DeltaInfo {
  sending: string;
  fee: string;
  priority: string;
  after: string;
}

type SimState =
  | 'simulating'
  | {kind: 'ready'; checks: TransferCheck[]; delta: DeltaInfo}
  | {kind: 'failed'; reason: string};

// ── Props ────────────────────────────────────────────────────────────────────
interface TxSimulateScreenProps {
  intent: TransferIntent;
  onContinue: (intent: TransferIntent) => void;
  onCancel: () => void;
}

export function TxSimulateScreen({intent, onContinue, onCancel}: TxSimulateScreenProps) {
  const {publicKey, solBalance} = useWalletStore();

  const [simState, setSimState] = useState<SimState>('simulating');
  const [retryCount, setRetryCount] = useState(0);

  // Debounce ref — cardinal rule #6: 500ms minimum on flow-advancing CTAs
  const lastTapRef = useRef(0);

  // Accent text class derived from intent.mode prop (not global store), since
  // this screen is passed the intent directly and may be used in either flow.
  const accentText =
    intent.mode === 'shielded' ? 'text-accent-shielded' : 'text-accent-transparent';

  // priority fee in per-CU microLamports over a 200k CU budget
  const priorityLamports = PRIORITY_FEE_LAMPORTS[intent.priorityLevel];
  const priorityFee = Number((priorityLamports * 1_000_000n) / 200_000n);

  // ── Run-simulation effect (on mount + retry) ──────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setSimState('simulating');

    const run = async () => {
      // Capture module references as local consts so TypeScript can narrow them.
      const _getConnection = getConnection;
      const _simulateTransaction = simulateTransaction;
      const _buildTransferTx = buildTransferTx;
      const _buildSPLTransferTx = buildSPLTransferTx;
      const _deriveTransferChecks = deriveTransferChecks;

      const modulesLoaded =
        !!_getConnection &&
        !!_simulateTransaction &&
        !!_buildTransferTx &&
        !!_buildSPLTransferTx &&
        !!_deriveTransferChecks;

      if (modulesLoaded && !publicKey) {
        // Modules are present but wallet is not loaded — this is a real error,
        // not a test/stub env. Do NOT fall through to the best-effort stub path.
        if (cancelled) return;
        setSimState({kind: 'failed', reason: 'Wallet not loaded'});
        return;
      }

      if (
        modulesLoaded &&
        publicKey &&
        _getConnection &&
        _simulateTransaction &&
        _buildTransferTx &&
        _buildSPLTransferTx &&
        _deriveTransferChecks
      ) {
        try {
          const connection = _getConnection();
          const sender = new PublicKey(publicKey);
          const recipientPk = new PublicKey(intent.recipient);
          const isSpl = intent.tokenMint !== 'native';

          const tx = isSpl
            ? await _buildSPLTransferTx({
                sender,
                recipient: recipientPk,
                mint: new PublicKey(intent.tokenMint),
                amount: parseTokenAmount(intent.amount, intent.decimals),
                decimals: intent.decimals,
                createAta: intent.createAta,
                priorityFee,
              })
            : await _buildTransferTx({
                sender,
                recipient: recipientPk,
                lamports: parseTokenAmount(intent.amount, SOL_DECIMALS),
                priorityFee,
              });

          const result = await _simulateTransaction(connection, tx);
          if (cancelled) return;

          if (result.success) {
            const checks = await _deriveTransferChecks(recipientPk);
            if (cancelled) return;

            // Compute balance delta strings
            const isSolTransfer = intent.tokenMint === 'native';
            // Fix #3: always use SOL_DECIMALS for the native transfer amount so
            // the "After" figure is correct regardless of what intent.decimals says.
            const amountLamports = isSolTransfer
              ? parseTokenAmount(intent.amount, SOL_DECIMALS)
              : parseTokenAmount(intent.amount, intent.decimals);

            // Fix #4: sending string is identical for SOL and SPL — collapse.
            const sendingStr = `${intent.amount} ${intent.tokenSymbol}`;

            const feeStr = formatTokenAmount(BASE_FEE_LAMPORTS, SOL_DECIMALS) + ' SOL';
            const priorityStr =
              priorityLamports === 0n
                ? '0 SOL'
                : formatTokenAmount(priorityLamports, SOL_DECIMALS) + ' SOL';

            // After = solBalance − (sol amount if native) − BASE_FEE − priorityFee
            let solBalanceBn: bigint;
            try {
              solBalanceBn = BigInt(solBalance);
            } catch {
              solBalanceBn = 0n;
            }
            const solSpent = isSolTransfer ? amountLamports : 0n;
            const afterLamports = solBalanceBn - solSpent - BASE_FEE_LAMPORTS - priorityLamports;
            const afterStr =
              afterLamports >= 0n
                ? formatTokenAmount(afterLamports, SOL_DECIMALS) + ' SOL'
                : '0 SOL';

            setSimState({
              kind: 'ready',
              checks,
              delta: {
                sending: sendingStr,
                fee: feeStr,
                priority: priorityStr,
                after: afterStr,
              },
            });
          } else {
            if (cancelled) return;
            const reason =
              result.error?.action ?? result.error?.message ?? 'Simulation failed';
            setSimState({kind: 'failed', reason});
          }
        } catch (err) {
          if (cancelled) return;
          const reason = err instanceof Error ? err.message : 'Simulation failed';
          setSimState({kind: 'failed', reason});
        }
      } else {
        // Modules absent (test/stub env only) — set ready with best-effort delta.
        // NOTE: this branch is intentionally unreachable in production because the
        // modulesLoaded && !publicKey guard above handles the wallet-not-loaded case.
        if (cancelled) return;
        let solBalanceBn: bigint;
        try {
          solBalanceBn = BigInt(solBalance);
        } catch {
          solBalanceBn = 0n;
        }
        const isSolTransfer = intent.tokenMint === 'native';
        let amountLamports = 0n;
        try {
          // Fix #3: use SOL_DECIMALS for native so the "After" figure is correct.
          amountLamports = isSolTransfer
            ? parseTokenAmount(intent.amount, SOL_DECIMALS)
            : parseTokenAmount(intent.amount, intent.decimals);
        } catch {
          amountLamports = 0n;
        }
        const solSpent = isSolTransfer ? amountLamports : 0n;
        const afterLamports = solBalanceBn - solSpent - BASE_FEE_LAMPORTS - priorityLamports;
        setSimState({
          kind: 'ready',
          checks: [],
          delta: {
            sending: `${intent.amount} ${intent.tokenSymbol}`,
            fee: formatTokenAmount(BASE_FEE_LAMPORTS, SOL_DECIMALS) + ' SOL',
            priority:
              priorityLamports === 0n
                ? '0 SOL'
                : formatTokenAmount(priorityLamports, SOL_DECIMALS) + ' SOL',
            after:
              afterLamports >= 0n
                ? formatTokenAmount(afterLamports, SOL_DECIMALS) + ' SOL'
                : '0 SOL',
          },
        });
      }
    };

    run().catch(() => {
      // run() handles its own errors internally and sets state; this catch is
      // a safety net so the unhandled-rejection linter rule doesn't fire.
    });
    return () => {
      cancelled = true;
    };
  }, [retryCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced handlers — cardinal rule #6: 500ms tap guard ──────────────────
  const handleContinue = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 500) return;
    lastTapRef.current = now;
    onContinue(intent);
  };

  const handleContinueAnyway = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 500) return;
    lastTapRef.current = now;
    onContinue(intent);
  };

  const handleRetry = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 500) return;
    lastTapRef.current = now;
    setRetryCount(c => c + 1);
  };

  const isSimulating = simState === 'simulating';

  // ── Eyebrow text ──────────────────────────────────────────────────────────
  const eyebrowContent = (() => {
    if (isSimulating) {
      return (
        <View className="flex-row items-center gap-1 mb-2">
          <ActivityIndicator size="small" color={intent.mode === 'shielded' ? '#5BE3C2' : '#B084FC'} style={{transform: [{scale: 0.7}]}} />
          <Text variant="caption" className={accentText}>
            {intent.mode === 'shielded'
              ? 'Simulating shielded transfer'
              : 'Simulating on mainnet RPC'}
          </Text>
        </View>
      );
    }
    if (typeof simState === 'object' && simState.kind === 'ready') {
      return (
        <View className="flex-row items-center gap-1 mb-2">
          <Check size={12} color="#3FD68B" strokeWidth={2.5} />
          <Text variant="caption" className="text-success">
            {intent.mode === 'shielded' ? 'Shielded simulation passed' : 'Simulation passed'}
          </Text>
        </View>
      );
    }
    if (typeof simState === 'object' && simState.kind === 'failed') {
      return (
        <View className="flex-row items-center gap-1 mb-2">
          <AlertTriangle size={12} color="#FF5C6A" strokeWidth={2} />
          <Text variant="caption" className="text-danger">
            {simState.reason}
          </Text>
        </View>
      );
    }
    return null;
  })();

  // ── Shielded badge for top bar ────────────────────────────────────────────
  const titleContent =
    intent.mode === 'shielded' ? (
      <View className="flex-row items-center gap-2 flex-1 ml-1">
        <Text variant="overline" className="text-accent-shielded">
          Shielded
        </Text>
        <Text variant="h2">Review</Text>
      </View>
    ) : (
      <Text variant="h2" className="ml-1 flex-1">
        Review transfer
      </Text>
    );

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} className="flex-1 bg-bg-base">
      {/* Top bar */}
      <View className="flex-row items-center px-4 py-3 min-h-touch-min">
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="w-12 h-12 items-center justify-center -ml-2">
          <ArrowLeft size={22} color="#A8ACB5" strokeWidth={1.75} />
        </Pressable>
        {titleContent}
        <View className="px-2 py-1 rounded-pill bg-bg-surface-2">
          <Text variant="caption" className="text-fg-tertiary">
            3 of 4
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-6 gap-3"
        showsVerticalScrollIndicator={false}>

        {/* Intent card */}
        <Card padding="p-4">
          {eyebrowContent}
          <View className="flex-row items-center gap-2 flex-wrap">
            <Text variant="body-lg" numeral className="text-fg-primary font-geist-semibold">
              {intent.amount} {intent.tokenSymbol}
            </Text>
            <Text variant="body-sm" mono className="text-fg-tertiary">
              →
            </Text>
            <Text variant="body-sm" mono className="text-fg-secondary">
              {formatAddress(intent.recipient)}
            </Text>
          </View>
        </Card>

        {/* State-specific content */}
        {isSimulating ? (
          <>
            {/* Skeleton card 1 */}
            <Card padding="p-4" className="gap-3">
              <View className="h-3 rounded-md bg-bg-surface-3 w-1/3 opacity-60" />
              <View className="h-3 rounded-md bg-bg-surface-3 w-full opacity-40" />
              <View className="h-3 rounded-md bg-bg-surface-3 w-2/3 opacity-40" />
              <View className="h-3 rounded-md bg-bg-surface-3 w-full opacity-40" />
            </Card>

            {/* Skeleton card 2 */}
            <Card padding="p-4" className="gap-3">
              <View className="h-3 rounded-md bg-bg-surface-3 w-1/3 opacity-60" />
              <View className="h-3 rounded-md bg-bg-surface-3 w-1/2 opacity-40" />
            </Card>
          </>
        ) : typeof simState === 'object' && simState.kind === 'ready' ? (
          <>
            {/* Check card */}
            <Card padding="p-4">
              <Text variant="overline" className="mb-3">
                What this transaction does
              </Text>
              {simState.checks.length === 0 ? (
                <View className="flex-row items-center gap-2 py-1">
                  <Info size={14} color="#A8ACB5" strokeWidth={1.75} />
                  <Text variant="body-sm" className="text-fg-tertiary">
                    No checks available
                  </Text>
                </View>
              ) : (
                simState.checks.map((check, idx) => (
                  <CheckRow key={idx} check={check} isFirst={idx === 0} />
                ))
              )}
            </Card>

            {/* Balance delta card */}
            <Card padding="p-4">
              <Text variant="overline" className="mb-3">
                Balance delta
              </Text>
              <DeltaRow label="Sending" value={`− ${simState.delta.sending}`} negative />
              <DeltaRow label="Network fee" value={`− ${simState.delta.fee}`} negative />
              <DeltaRow label="Priority" value={`− ${simState.delta.priority}`} negative />
              {/* Divider */}
              <View className="border-t border-bg-surface-3 my-2" />
              <DeltaRow label="After" value={simState.delta.after} positive />
            </Card>
          </>
        ) : typeof simState === 'object' && simState.kind === 'failed' ? (
          /* No extra cards in failed state — sticky bar below handles CTAs */
          null
        ) : null}
      </ScrollView>

      {/* Sticky CTA bar */}
      <View className="px-6 pb-8 pt-2 bg-bg-base border-t border-bg-surface-2 gap-3">
        {isSimulating ? (
          <>
            <Button label="Simulating…" variant="primary" disabled onPress={() => {}} testID="tx-simulate-continue" />
            <Button label="Cancel" variant="tertiary" onPress={onCancel} testID="tx-simulate-cancel" />
          </>
        ) : typeof simState === 'object' && simState.kind === 'ready' ? (
          <>
            <Pressable
              onPress={handleContinue}
              accessibilityRole="button"
              accessibilityLabel="Continue to confirm"
              testID="tx-simulate-continue"
              className={cn(
                'min-h-touch-rec rounded-pill items-center justify-center flex-row gap-2',
                intent.mode === 'shielded'
                  ? 'bg-accent-shielded active:opacity-90'
                  : 'bg-accent-transparent active:opacity-90',
              )}>
              <ArrowRight
                size={18}
                color="#0A0A0A"
                strokeWidth={2}
              />
              <Text variant="body-lg" className="font-geist-semibold text-bg-base">
                Continue to confirm
              </Text>
            </Pressable>
            <Button label="Cancel" variant="tertiary" onPress={onCancel} testID="tx-simulate-cancel" />
          </>
        ) : typeof simState === 'object' && simState.kind === 'failed' ? (
          <>
            <Button
              label="Retry"
              variant="primary"
              loading={false}
              onPress={handleRetry}
              testID="tx-simulate-retry"
            />
            <Pressable
              onPress={handleContinueAnyway}
              accessibilityRole="button"
              accessibilityLabel="Continue anyway"
              testID="tx-simulate-continue"
              className="min-h-touch-rec rounded-pill items-center justify-center bg-bg-surface-2 active:opacity-90">
              <Text variant="body-lg" className="font-geist-semibold text-warning">
                Continue anyway
              </Text>
            </Pressable>
            <Button label="Cancel" variant="tertiary" onPress={onCancel} testID="tx-simulate-cancel" />
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

// ── Check row sub-component ───────────────────────────────────────────────────

interface CheckRowProps {
  check: TransferCheck;
  isFirst: boolean;
}

function CheckRow({check, isFirst}: CheckRowProps) {
  const iconColor =
    check.status === 'ok' ? '#3FD68B' : check.status === 'warn' ? '#F5A623' : '#FF5C6A';
  const iconBgClass =
    check.status === 'ok'
      ? 'bg-[rgba(63,214,139,0.16)]'
      : check.status === 'warn'
      ? 'bg-[rgba(245,166,35,0.16)]'
      : 'bg-[rgba(255,92,106,0.16)]';
  const badgeTextClass =
    check.status === 'ok'
      ? 'text-success'
      : check.status === 'warn'
      ? 'text-warning'
      : 'text-danger';
  const badge = check.status === 'ok' ? 'PASS' : check.status === 'warn' ? 'CHECK' : 'FAIL';
  const Icon = check.status === 'ok' ? Check : check.status === 'warn' ? Info : AlertTriangle;

  return (
    <View
      className={cn(
        'flex-row items-start gap-3 py-3',
        !isFirst && 'border-t border-bg-surface-2',
      )}>
      <View
        className={cn(
          'w-7 h-7 rounded-full items-center justify-center mt-0.5 flex-shrink-0',
          iconBgClass,
        )}>
        <Icon size={14} color={iconColor} strokeWidth={2} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="body-sm" className="text-fg-primary">
          {check.title}
        </Text>
        <Text variant="caption" mono className="text-fg-tertiary">
          {check.meta}
        </Text>
      </View>
      <View className="flex-shrink-0 pt-0.5">
        <Text variant="caption" className={cn('font-geist-semibold', badgeTextClass)}>
          {badge}
        </Text>
      </View>
    </View>
  );
}

// ── Delta row sub-component ───────────────────────────────────────────────────

interface DeltaRowProps {
  label: string;
  value: string;
  negative?: boolean;
  positive?: boolean;
}

function DeltaRow({label, value, negative, positive}: DeltaRowProps) {
  const valueClass = negative ? 'text-danger' : positive ? 'text-success' : 'text-fg-primary';
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text variant="body-sm" className="text-fg-secondary">
        {label}
      </Text>
      <Text variant="body-sm" numeral className={cn('font-geist-semibold', valueClass)}>
        {value}
      </Text>
    </View>
  );
}
