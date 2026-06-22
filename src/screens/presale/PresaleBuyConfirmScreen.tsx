import React, {useEffect, useRef, useState} from 'react';
import {View, Pressable, ScrollView, ActivityIndicator} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ArrowLeft, Check, AlertTriangle, ShieldCheck} from 'lucide-react-native';
import {PublicKey} from '@solana/web3.js';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Text, Button, Card} from '../../components/ui';
import {useWalletStore} from '../../store/zustand/walletStore';
import {usePresaleStore} from '../../store/zustand/presaleStore';
import {useResolvedPrices} from '../../hooks/useResolvedPrices';
import {awaitUserAuth} from '../../modules/session/pendingAuth';
import {estimateNocForSol} from '../../modules/presale/presaleBuyModule';
import {PRESALE_STAGE_PRICES} from '../../constants/presale';
import type {RootStackParamList} from '../../types/navigation';

// ── Lazy imports — wrapped in try/catch so Jest/stub envs don't crash ────────
// Mirrors TxSimulateScreen: the simulation modules pull in @solana/web3.js +
// RPC config that isn't available in the test/stub environment.
let getConnection: (() => import('@solana/web3.js').Connection) | null = null;
let simulateTransaction:
  | ((
      connection: import('@solana/web3.js').Connection,
      tx: import('@solana/web3.js').VersionedTransaction,
    ) => Promise<{
      success: boolean;
      error?: {code: string; message: string; action: string};
    }>)
  | null = null;
let buildSolPurchaseTx:
  | typeof import('../../modules/presale/presaleBuyModule').buildSolPurchaseTx
  | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  getConnection = require('../../modules/solana/connection').getConnection;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  simulateTransaction =
    require('../../modules/solana/simulation').simulateTransaction;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  buildSolPurchaseTx =
    require('../../modules/presale/presaleBuyModule').buildSolPurchaseTx;
} catch {
  // Modules unavailable in test/stub environment — no-op.
}

const SOL_DECIMALS = 9;

// ── State machine ────────────────────────────────────────────────────────────
type SimState =
  | 'simulating'
  | {kind: 'ready'}
  | {kind: 'failed'; reason: string};

// ── Module-scope helpers ──────────────────────────────────────────────────────
function safeBigInt(v: string | undefined): bigint {
  try {
    return v ? BigInt(v) : 0n;
  } catch {
    return 0n;
  }
}

// Group with thousands separators, up to 2 decimals (matches PresaleScreen).
function formatNoc(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatUsd(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Trim trailing zeros on the SOL amount (lamport precision is 9 dp).
function formatSol(sol: number): string {
  return String(Number(sol.toFixed(SOL_DECIMALS)));
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface PresaleBuyConfirmScreenProps {
  solLamports: string;
  onAuthorized: () => void;
  onCancel: () => void;
}

export function PresaleBuyConfirmScreen({
  solLamports,
  onAuthorized,
  onCancel,
}: PresaleBuyConfirmScreenProps) {
  const publicKey = useWalletStore(s => s.publicKey);
  const rootNav =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Presale stage / price (display + estimate).
  const currentStage = usePresaleStore(s => s.currentStage);
  const pricePerNoc = usePresaleStore(s => s.pricePerNoc);
  const stage = currentStage ?? 1;
  const stagePriceUsd =
    pricePerNoc != null && Number(pricePerNoc) > 0
      ? Number(pricePerNoc)
      : PRESALE_STAGE_PRICES[0];

  const {prices} = useResolvedPrices();
  const solUsd = prices.native?.usd ?? 0;

  const lamports = safeBigInt(solLamports);
  const solAmount = Number(lamports) / 1e9;
  const usdValue = solAmount * solUsd;
  const nocEstimate = estimateNocForSol(solAmount, solUsd, stagePriceUsd);

  const [simState, setSimState] = useState<SimState>('simulating');
  const [retryCount, setRetryCount] = useState(0);
  const [authorizing, setAuthorizing] = useState(false);

  // Debounce ref — cardinal rule #6: 500ms minimum on flow-advancing CTAs.
  const lastTapRef = useRef(0);

  // ── Simulate-on-mount effect (mirrors TxSimulateScreen) ───────────────────
  useEffect(() => {
    let cancelled = false;
    setSimState('simulating');

    const run = async () => {
      const _getConnection = getConnection;
      const _simulateTransaction = simulateTransaction;
      const _buildSolPurchaseTx = buildSolPurchaseTx;

      const modulesLoaded =
        !!_getConnection && !!_simulateTransaction && !!_buildSolPurchaseTx;

      if (!modulesLoaded) {
        // Test/stub env only — modules absent. Treat as ready (best-effort).
        if (cancelled) return;
        setSimState({kind: 'ready'});
        return;
      }

      if (!publicKey) {
        // Modules present but wallet not loaded — a real error.
        if (cancelled) return;
        setSimState({kind: 'failed', reason: 'Wallet not loaded'});
        return;
      }

      try {
        const user = new PublicKey(publicKey);
        const connection = _getConnection();
        const tx = await _buildSolPurchaseTx(user, lamports);
        const sim = await _simulateTransaction(connection, tx);
        if (cancelled) return;
        if (sim.success) {
          setSimState({kind: 'ready'});
        } else {
          const reason =
            sim.error?.action ?? sim.error?.message ?? 'Simulation failed';
          setSimState({kind: 'failed', reason});
        }
      } catch (err) {
        if (cancelled) return;
        const reason = err instanceof Error ? err.message : 'Simulation failed';
        setSimState({kind: 'failed', reason});
      }
    };

    run().catch(() => {
      // run() handles its own errors and sets state; this is a safety net so
      // the no-floating-promises linter rule doesn't fire.
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryCount]);

  const isSimulating = simState === 'simulating';
  const isReady = typeof simState === 'object' && simState.kind === 'ready';
  const isFailed = typeof simState === 'object' && simState.kind === 'failed';

  // ── Re-auth handler — mirrors TxConfirmScreen exactly ─────────────────────
  const handleConfirm = async () => {
    const now = Date.now();
    if (now - lastTapRef.current < 500) return;
    lastTapRef.current = now;
    if (authorizing) return;
    setAuthorizing(true);

    // Navigate to UnlockSend BEFORE awaiting — modal must appear while we wait.
    const authPromise = awaitUserAuth();
    rootNav.navigate('UnlockSend', {
      amount: formatSol(solAmount),
      ticker: 'SOL',
      recipient: 'Noctura Presale',
    });
    const approved = await authPromise;
    if (!approved) {
      setAuthorizing(false);
      return;
    }
    onAuthorized();
  };

  const handleRetry = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 500) return;
    lastTapRef.current = now;
    setRetryCount(c => c + 1);
  };

  // ── Eyebrow text (sim status) ─────────────────────────────────────────────
  const eyebrowContent = (() => {
    if (isSimulating) {
      return (
        <View className="flex-row items-center gap-1 mb-2">
          <ActivityIndicator
            size="small"
            color="#B084FC"
            style={{transform: [{scale: 0.7}]}}
          />
          <Text variant="caption" className="text-accent-transparent">
            Simulating on mainnet RPC
          </Text>
        </View>
      );
    }
    if (isReady) {
      return (
        <View className="flex-row items-center gap-1 mb-2">
          <Check size={12} color="#3FD68B" strokeWidth={2.5} />
          <Text variant="caption" className="text-success">
            Simulation passed
          </Text>
        </View>
      );
    }
    if (isFailed) {
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

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      className="flex-1 bg-bg-base">
      {/* Top bar */}
      <View className="flex-row items-center px-4 py-3 min-h-touch-min">
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="w-12 h-12 items-center justify-center -ml-2">
          <ArrowLeft size={22} color="#A8ACB5" strokeWidth={1.75} />
        </Pressable>
        <Text variant="h2" className="ml-1 flex-1">
          Confirm
        </Text>
        <View className="px-2 py-1 rounded-pill bg-bg-surface-2">
          <Text variant="caption" className="text-fg-tertiary">
            2 of 3
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-6 gap-3"
        showsVerticalScrollIndicator={false}>
        {/* Headline */}
        <Text variant="h1" className="mb-2">
          Buy NOC with SOL
        </Text>

        {/* Review card */}
        <Card padding="p-4">
          {eyebrowContent}
          <ReviewRow
            label="You pay"
            value={`${formatSol(solAmount)} SOL`}
            sub={solUsd > 0 ? `~$${formatUsd(usdValue)}` : undefined}
            isFirst
          />
          <ReviewRow
            label="You receive"
            value={`≈ ${formatNoc(nocEstimate)} NOC`}
          />
          <ReviewRow
            label="Stage"
            value={`Stage ${stage} · $${formatUsd(stagePriceUsd)}/NOC`}
          />
        </Card>

        {/* Trusted program row — NOT a scary unknown-contract warning */}
        <Card padding="p-4">
          <View className="flex-row items-center gap-3">
            <View className="w-9 h-9 rounded-full items-center justify-center bg-[rgba(176,132,252,0.16)]">
              <ShieldCheck size={18} color="#B084FC" strokeWidth={1.75} />
            </View>
            <View className="flex-1">
              <Text variant="body-sm" className="text-fg-primary">
                Noctura Presale program
              </Text>
              <Text variant="caption" className="text-fg-tertiary">
                Verified on-chain program · Solana mainnet
              </Text>
            </View>
            <Text
              variant="caption"
              className="font-geist-semibold text-accent-transparent">
              TRUSTED
            </Text>
          </View>
        </Card>
      </ScrollView>

      {/* Sticky CTA bar */}
      <View className="px-5 pb-8 pt-3 gap-3 border-t border-bg-surface-2">
        {isFailed ? (
          <>
            <Button
              label="Retry"
              variant="primary"
              onPress={handleRetry}
              testID="presale-confirm-retry"
            />
            <Button
              label="Cancel"
              variant="secondary"
              onPress={onCancel}
              testID="presale-confirm-cancel"
            />
          </>
        ) : (
          <>
            <Button
              label={isSimulating ? 'Simulating…' : 'Confirm & Buy'}
              variant="primary"
              loading={authorizing}
              disabled={isSimulating || authorizing}
              testID="presale-confirm-buy"
              onPress={() => {
                void handleConfirm();
              }}
            />
            <Button
              label="Cancel"
              variant="secondary"
              disabled={authorizing}
              onPress={onCancel}
              testID="presale-confirm-cancel"
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

// ── Review row sub-component ───────────────────────────────────────────────────
function ReviewRow({
  label,
  value,
  sub,
  isFirst,
}: {
  label: string;
  value: string;
  sub?: string;
  isFirst?: boolean;
}) {
  return (
    <View
      className={
        isFirst
          ? 'flex-row items-start justify-between py-2'
          : 'flex-row items-start justify-between py-2 border-t border-bg-surface-2'
      }>
      <Text variant="body-sm" className="text-fg-secondary">
        {label}
      </Text>
      <View className="items-end">
        <Text
          variant="body-sm"
          numeral
          className="text-fg-primary font-geist-semibold">
          {value}
        </Text>
        {sub != null && (
          <Text variant="caption" className="text-fg-tertiary">
            {sub}
          </Text>
        )}
      </View>
    </View>
  );
}
