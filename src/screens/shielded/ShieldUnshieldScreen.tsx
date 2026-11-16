import React, {useCallback, useEffect, useRef, useState} from 'react';
import {View, Pressable, TextInput, ScrollView} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ArrowLeft, ShieldCheck, AlertTriangle, Shield, RefreshCw} from 'lucide-react-native';
import {Text} from '../../components/ui';
import {useWalletStore} from '../../store/zustand/walletStore';
import {cn} from '../../utils/cn';
import {parseTokenAmount, formatTokenAmount, groupInteger} from '../../utils/parseTokenAmount';
import {
  A0_TOKEN,
  A0_DEPOSIT_FEE_LAMPORTS,
  A0_RHO_MARKER_RENT_LAMPORTS,
  SOL_DECIMALS,
  displayAmount,
} from '../../modules/shielded/a0/screenSupport';
import {readA0PoolNoteCount} from '../../modules/shielded/a0/poolSize';
import {getConnection} from '../../modules/solana/connection';
import {useA0Shielded, retryA0Startup} from '../../hooks/useA0Shielded';
import type {A0CheckAgain, A0ShieldedView} from '../../hooks/useA0Shielded';
import {CheckAgainLink} from '../../components/CheckAgainLink';

/**
 * #16 Shield / Unshield — mirror /home/user/Downloads/index.html §s16 (+ screen.md #16), the
 * SHIELD SIDE on the A0 pool (spec §5 step 1, §11).
 *
 * HIDDEN UNTIL M1c (spec §12 "Hidden until its plan lands"): the "Make public" tab and the whole
 * unshield side. They are not rendered, the screen has no public mode, and the route takes no
 * direction (Navigator) — a deep link or a stale `{direction: 'public'}` lands on this shield side.
 *
 * Built from the design's states 1 (idle), 3 (amount entered + fees) and 4 (insufficient), plus the
 * states the A0 flow adds (undrawn, for the owner's visual pass): the shielded balance line and its
 * startup states (restoring / error + Retry / unsupported device), the SOL-short warning, and the
 * deposit-record rent row. The amount is BigInt end to end (cardinal rule 2).
 *
 * THE FEES ARE WHAT THE A0 DEPOSIT COSTS: the network fee (one signature, 0.000005 SOL), the ZK
 * proof fee — none: the proof is made on this device — and the rent of the deposit's rho marker
 * account. All three are SOL; the token amount is shielded exactly ("You'll shield" = the amount).
 *
 * Deviations from the design, said loudly (Task notes): no USD lines (the devnet test token has no
 * price; the old figures were fixed mock values); the anonymity line is the pool's note count read
 * from the chain, a number without the 5-bar meter (spec I4: a measure, not a yes/no); the
 * token chip is the pool's single token, not a selector.
 */

interface ShieldUnshieldScreenProps {
  onBack: () => void;
  /** CTA → #18 with the amount in base units */
  onShield: (amountBaseUnits: string) => void;
}

const SOL_NEEDED = A0_DEPOSIT_FEE_LAMPORTS + A0_RHO_MARKER_RENT_LAMPORTS;

function safeBigInt(v: string | undefined): bigint {
  try {
    return v ? BigInt(v) : 0n;
  } catch {
    return 0n;
  }
}

type Parsed = {kind: 'empty'} | {kind: 'invalid'} | {kind: 'ok'; units: bigint};

function parseAmount(text: string): Parsed {
  if (text.trim() === '') return {kind: 'empty'};
  try {
    const units = parseTokenAmount(text, A0_TOKEN.decimals);
    return units > 0n ? {kind: 'ok', units} : {kind: 'invalid'};
  } catch {
    return {kind: 'invalid'};
  }
}

export function ShieldUnshieldScreen({onBack, onShield}: ShieldUnshieldScreenProps) {
  const {tokenBalances, solBalance} = useWalletStore();
  const {view, checkAgain} = useA0Shielded();
  const [amount, setAmount] = useState('');
  const [poolNotes, setPoolNotes] = useState<number | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const lastTapRef = useRef(0);

  const available = safeBigInt(tokenBalances[A0_TOKEN.mint]);
  const sol = safeBigInt(solBalance);

  useEffect(() => {
    let alive = true;
    readA0PoolNoteCount(getConnection())
      .then(r => {
        if (alive && r.status === 'ok') setPoolNotes(r.count);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const parsed = parseAmount(amount);
  const hasAmount = parsed.kind === 'ok';
  const units = parsed.kind === 'ok' ? parsed.units : 0n;
  const insufficient = hasAmount && units > available;
  const solShort = sol < SOL_NEEDED;
  const ready = view.kind === 'ready';
  const canSubmit = ready && hasAmount && !insufficient && !solShort;

  const handleMax = useCallback(() => {
    if (available <= 0n) return;
    setAmount(formatTokenAmount(available, A0_TOKEN.decimals));
  }, [available]);

  const handleSubmit = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 500) return; // cardinal rule 6
    lastTapRef.current = now;
    if (!canSubmit) return;
    onShield(units.toString());
  }, [canSubmit, onShield, units]);

  const handleRetry = useCallback(async () => {
    if (retrying) return;
    setRetrying(true);
    setRetryError(null);
    const s = await retryA0Startup();
    if (s.phase === 'error') setRetryError(s.code ? `${s.code}: ${s.message}` : s.message);
    setRetrying(false);
  }, [retrying]);

  const sym = A0_TOKEN.symbol;

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} className="flex-1 bg-bg-base">
      {/* Top bar */}
      <View className="flex-row items-center px-4 py-3 min-h-touch-min">
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="w-12 h-12 items-center justify-center -ml-2">
          <ArrowLeft size={22} color="#A8ACB5" strokeWidth={1.75} />
        </Pressable>
        <Text variant="h2" className="ml-1 flex-1">
          Shield / Unshield
        </Text>
        <Text variant="caption" className="text-fg-tertiary">
          {sym}
        </Text>
      </View>

      {/* Direction tabs — the shield side only until M1c (spec §12) */}
      <View className="px-5 mb-4">
        <View className="flex-row bg-bg-surface-2 rounded-pill p-1">
          <View
            accessibilityRole="tab"
            accessibilityState={{selected: true}}
            className="flex-1 flex-row items-center justify-center gap-2 py-2 rounded-pill bg-accent-shielded">
            <ShieldCheck size={16} color="#0A0A0A" strokeWidth={1.75} />
            <Text variant="body-sm" className="font-geist-semibold text-bg-base">
              Make private
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-6"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <ShieldedLine view={view} retrying={retrying} retryError={retryError} onRetry={handleRetry} checkAgain={checkAgain} />

        {/* Amount card */}
        <View
          className={cn(
            'rounded-lg bg-bg-surface-1 border p-5 mb-4',
            insufficient ? 'border-danger' : 'border-bg-surface-3',
          )}>
          <View className="flex-row items-center justify-between mb-3">
            <Text variant="body-sm" className="text-fg-secondary">
              Available
            </Text>
            <Text variant="body-sm" numeral className="font-geist-semibold text-fg-primary">
              {`${displayAmount(available, A0_TOKEN.decimals)} ${sym}`}
            </Text>
          </View>
          <View className="flex-row items-baseline justify-center gap-2 mb-3">
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor="#6E727A"
              keyboardType="decimal-pad"
              accessibilityLabel="Amount"
              testID="shield-amount-input"
              className={cn(
                'font-geist text-balance-xl text-center min-w-[80px]',
                insufficient ? 'text-danger' : 'text-fg-primary',
              )}
              style={{minWidth: 120}}
            />
            <Text variant="h2" className={cn(insufficient ? 'text-danger' : 'text-fg-secondary')}>
              {sym}
            </Text>
          </View>
          <View className="items-center">
            {insufficient ? (
              <View className="flex-row items-center gap-2">
                <AlertTriangle size={12} color="#FF5C6A" strokeWidth={2} />
                <Text variant="caption" className="text-danger">
                  {`Insufficient balance · max ${displayAmount(available, A0_TOKEN.decimals)} ${sym}`}
                </Text>
              </View>
            ) : parsed.kind === 'invalid' ? (
              <Text variant="caption" className="text-danger">
                {`Enter an amount of ${sym} (up to ${A0_TOKEN.decimals} decimals)`}
              </Text>
            ) : hasAmount ? null : (
              <Pressable
                onPress={handleMax}
                accessibilityRole="button"
                accessibilityLabel="Max"
                disabled={available <= 0n}
                className={cn(
                  'px-3 py-1.5 rounded-pill',
                  available > 0n ? 'bg-[rgba(91,227,194,0.16)] active:opacity-80' : 'bg-bg-surface-3',
                )}>
                <Text
                  variant="overline"
                  className={available > 0n ? 'text-accent-shielded' : 'text-fg-disabled'}>
                  MAX
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Fees card */}
        <View
          className={cn(
            'rounded-lg bg-bg-surface-1 border border-bg-surface-3 p-4 mb-4',
            insufficient && 'opacity-50',
          )}>
          <Text variant="overline" className="mb-3">
            Fees
          </Text>
          <FeeRow
            label="Network fee"
            value={hasAmount ? `${formatTokenAmount(A0_DEPOSIT_FEE_LAMPORTS, SOL_DECIMALS)} SOL` : '—'}
          />
          <FeeRow label="ZK proof fee" value={hasAmount ? 'None · made on this device' : '—'} zk />
          <FeeRow
            label="Deposit record rent"
            value={hasAmount ? `≈ ${formatTokenAmount(A0_RHO_MARKER_RENT_LAMPORTS, SOL_DECIMALS)} SOL` : '—'}
          />
          <View className="h-px bg-bg-surface-3 my-3" />
          <View className="flex-row items-center justify-between">
            <Text variant="body-sm" className="text-fg-secondary">
              You'll shield
            </Text>
            <Text variant="balance-md" numeral className="text-fg-primary" testID="shield-net">
              {`${hasAmount && !insufficient ? displayAmount(units, A0_TOKEN.decimals) : '—'} ${sym}`}
            </Text>
          </View>
        </View>

        {solShort ? (
          <View className="rounded-md bg-bg-surface-2 border-l-2 border-l-warning p-4 mb-4 flex-row gap-3">
            <AlertTriangle size={16} color="#F2B53B" strokeWidth={1.75} />
            <Text variant="caption" className="flex-1 text-fg-secondary">
              {`Not enough SOL: this deposit needs about ${formatTokenAmount(SOL_NEEDED, SOL_DECIMALS)} SOL for the network fee and the deposit record.`}
            </Text>
          </View>
        ) : null}

        {/* The pool's size (Make private + amount) — a number, never a yes/no (spec I4) */}
        {hasAmount && !insufficient && poolNotes !== null ? (
          <View className="rounded-lg bg-bg-surface-1 border border-bg-surface-3 p-4 mb-4">
            <View className="flex-row items-center justify-between">
              <Text variant="body-sm" className="text-fg-secondary">
                Notes in the pool after this deposit
              </Text>
              <Text variant="body-sm" numeral className="text-accent-shielded font-geist-semibold" testID="pool-notes">
                {groupInteger(String(poolNotes + 1))}
              </Text>
            </View>
          </View>
        ) : null}

        {!hasAmount ? (
          <Text variant="caption" className="text-fg-tertiary text-center px-2 mt-1">
            Your main account signs this deposit. The amount, the time and your address are public on chain, and a later withdrawal to this wallet can be linked to it.
          </Text>
        ) : null}
      </ScrollView>

      {/* Sticky CTA */}
      <View className="px-6 pb-8 pt-2 border-t border-bg-surface-2 bg-bg-base">
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityState={{disabled: !canSubmit}}
          testID="shield-cta"
          accessibilityLabel={`Shield ${sym}`}
          className={cn(
            'min-h-touch-rec rounded-pill items-center justify-center flex-row gap-2',
            canSubmit ? 'bg-accent-shielded active:opacity-90' : 'bg-bg-surface-3',
          )}>
          <Shield
            size={18}
            color={canSubmit ? '#0A0A0A' : '#6E727A'}
            strokeWidth={2}
            fill={canSubmit ? '#0A0A0A' : 'transparent'}
          />
          <Text
            variant="body-lg"
            className={cn('font-geist-semibold', canSubmit ? 'text-bg-base' : 'text-fg-disabled')}>
            {canSubmit ? `Shield ${displayAmount(units, A0_TOKEN.decimals)} ${sym}` : `Shield ${sym}`}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ── The shielded balance line (undrawn: the A0 startup states) ─────────────────

function ShieldedLine({
  view,
  retrying,
  retryError,
  onRetry,
  checkAgain,
}: {
  view: A0ShieldedView;
  retrying: boolean;
  retryError: string | null;
  onRetry: () => void;
  checkAgain: A0CheckAgain;
}) {
  const sym = A0_TOKEN.symbol;
  if (view.kind === 'ready') {
    return (
      <View className="px-1 mb-3">
        <View className="flex-row items-center justify-between" testID="shielded-line">
          <Text variant="body-sm" className="text-fg-secondary">
            Shielded balance
          </Text>
          <Text variant="body-sm" numeral className="text-accent-shielded font-geist-semibold">
            {`${displayAmount(view.unspent, A0_TOKEN.decimals)} ${sym}`}
            {view.pending > 0n ? ` · ${displayAmount(view.pending, A0_TOKEN.decimals)} ${sym} pending` : ''}
          </Text>
        </View>
        {view.pending > 0n ? (
          <View className="flex-row items-center justify-between mt-1">
            <Text variant="caption" className="text-warning flex-1">
              {checkAgain.note ?? 'Pending · not confirmed yet'}
            </Text>
            <CheckAgainLink checkAgain={checkAgain} testID="shielded-check-again" />
          </View>
        ) : null}
      </View>
    );
  }
  if (view.kind === 'running') {
    return (
      <Banner tone="info" testID="shielded-line">
        Restoring your shielded notes from the chain. Shielding is available when it finishes.
      </Banner>
    );
  }
  if (view.kind === 'unsupported') {
    return (
      <Banner tone="warn" testID="shielded-line">
        Shielding needs the on-device prover, which this device does not have (64-bit ARM phones only).
      </Banner>
    );
  }
  const head =
    view.kind === 'error'
      ? `Your shielded notes could not be restored · ${view.code ?? 'error'}`
      : 'Your shielded notes are not loaded yet.';
  return (
    <Banner tone={view.kind === 'error' ? 'danger' : 'warn'} testID="shielded-line">
      {head}
      {view.kind === 'error' ? `\n${view.message}` : ''}
      {retryError ? `\n${retryError}` : ''}
      {'\n'}
      <Text
        variant="body-sm"
        className="text-accent-shielded font-geist-semibold"
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Retry restoring shielded notes"
        testID="shielded-retry">
        {retrying ? 'Retrying…' : 'Retry'}
      </Text>
    </Banner>
  );
}

function Banner({
  tone,
  children,
  testID,
}: {
  tone: 'info' | 'warn' | 'danger';
  children: React.ReactNode;
  testID?: string;
}) {
  const border = tone === 'danger' ? 'border-l-danger' : tone === 'warn' ? 'border-l-warning' : 'border-l-accent-shielded';
  const Icon = tone === 'info' ? RefreshCw : AlertTriangle;
  const color = tone === 'danger' ? '#FF5C6A' : tone === 'warn' ? '#F2B53B' : '#5BE3C2';
  return (
    <View className={cn('rounded-md bg-bg-surface-2 border-l-2 p-4 mb-4 flex-row gap-3', border)} testID={testID}>
      <Icon size={16} color={color} strokeWidth={1.75} />
      <Text variant="caption" className="flex-1 text-fg-secondary">
        {children}
      </Text>
    </View>
  );
}

// ── Fee row ─────────────────────────────────────────────────────────────────

function FeeRow({label, value, zk}: {label: string; value: string; zk?: boolean}) {
  return (
    <View className="flex-row items-center justify-between mb-2">
      <View className="flex-row items-center gap-2 flex-1">
        {zk ? (
          <View className="w-5 h-5 rounded-pill items-center justify-center bg-[rgba(91,227,194,0.16)]">
            <Shield size={12} color="#5BE3C2" strokeWidth={2} />
          </View>
        ) : null}
        <Text variant="body-sm" className={cn(zk ? 'text-accent-shielded' : 'text-fg-secondary')}>
          {label}
        </Text>
      </View>
      <Text variant="body-sm" numeral className="text-fg-primary">
        {value}
      </Text>
    </View>
  );
}
