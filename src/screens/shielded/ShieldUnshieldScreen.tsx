import React, {useCallback, useEffect, useRef, useState} from 'react';
import {View, Pressable, TextInput, ScrollView} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ArrowLeft, AlertTriangle, Shield, RefreshCw} from 'lucide-react-native';
import {Text} from '../../components/ui';
import {AmountLimitHint, DetailsDisclosure, overLimit} from '../../components/private';
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
import {UnshieldSide} from './unshield/UnshieldSide';
import {a0RefusalLoudText} from './unshield/unshieldCopy';
import {BalanceRow} from './shieldedParts';
import {
  DEPOSIT_PUBLIC_SENTENCE,
  MAKE_PRIVATE,
  MAKE_PUBLIC,
  PUBLIC_BALANCE,
  SUMMARY,
  makePrivateCta,
  makePrivateCtaIdle,
} from '../../copy/modes';
import type {A0VerifyRefusal} from '../../modules/shielded/a0/landedVerifier';
import type {A0UnshieldDestination} from '../../modules/shielded/a0/unshieldFlow';

/**
 * #16 "Make private" / "Make public" — mirror /home/user/Downloads/index.html §s16 (+ screen.md #16):
 * both sides on the A0 pool (spec §5 step 1, §6 steps 1–2, §11).
 *
 * TWO SCREENS, NO TABS (owner phone pass 2026-11-21, a loud departure from the design's two-tab pill
 * and from spec 2026-11-20's "Private ⇄ Public" title): the dashboard's two buttons already make
 * the choice, so the direction is fixed by the route param (`initialDirection`) for the life of the
 * screen — nothing on it switches sides; the user goes Back and presses the other button. The
 * top-bar title is the action (`MAKE_PRIVATE` / `MAKE_PUBLIC`), a header. A missing or unknown
 * direction opens Make private.
 *
 * Shielded UX part B (spec 2026-11-20 §4): one vocabulary (`src/copy/modes.ts`); ONE balance line
 * per side (decision B-2) — "Public balance" here, "Private balance" on Make public — so the old
 * private balance line above the card is now only the STATUS (the startup states, a refusal, the
 * pending sum and "Check again"); the technical fee rows and the pool-size row behind "Details ▾"
 * (decision B-3); the limit through `AmountLimitHint` (decision B-4).
 *
 * THE MAKE PUBLIC SIDE (M1c Task 8): `./unshield/UnshieldSide.tsx`. The route exists only in the
 * devnet build and no deep link opens this side: `noctura://deposit` opens "Make private" whatever
 * its query says (`deepLinkConfig` pins `direction`; the Navigator honours `initialDirection:
 * 'public'` only on a route in-app navigation created — fix round 1, I-1).
 *
 * THE FEES ARE WHAT THE A0 DEPOSIT COSTS: the network fee (one signature, 0.000005 SOL), the ZK
 * proof fee — none: the proof is made on this device — and the rent of the deposit's rho marker
 * account. All three are SOL; the token amount moves exactly ("You'll make private" = the amount).
 *
 * Deviations from the design, said loudly: no USD lines (the devnet test token has no price); the
 * pool-size line is the pool's note count read from the chain, a number without the 5-bar meter
 * (spec I4: a measure, not a yes/no), now inside Details; the token chip is the pool's single
 * token, not a selector. The amount is BigInt end to end (cardinal rule 2).
 */

interface ShieldUnshieldScreenProps {
  onBack: () => void;
  /** CTA → #18 with the amount in base units */
  onShield: (amountBaseUnits: string) => void;
  /** the Make public CTA → its run (#18 → #21), the amount in base units */
  onUnshield?: (request: {destination: A0UnshieldDestination; amount: string}) => void;
  /** which screen this is, fixed for its life (default "Make private"; owner phone pass 2026-11-21) */
  initialDirection?: 'private' | 'public';
  /** changes each time the screen regains focus (the Make public CTA's tap-disable ends there) */
  focusKey?: number;
}

type Direction = 'private' | 'public';

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

export function ShieldUnshieldScreen({onBack, onShield, onUnshield, initialDirection, focusKey}: ShieldUnshieldScreenProps) {
  const {tokenBalances, solBalance} = useWalletStore();
  // fixed for the life of the screen: no setter, a later prop does not flip it (owner phone pass 2026-11-21)
  const [direction] = useState<Direction>(initialDirection === 'public' ? 'public' : 'private');
  const {view, checkAgain, refusal} = useA0Shielded();
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
  const insufficient = overLimit(hasAmount ? units : null, available);
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
    // final review M-4: the code and a fixed sentence; the raw message only without a code
    if (s.phase === 'error') setRetryError(s.code ? `${s.code} · Retry again in a moment.` : s.message);
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
        <Text variant="h2" className="ml-1 flex-1" accessibilityRole="header" testID="shield-unshield-title">
          {direction === 'public' ? MAKE_PUBLIC : MAKE_PRIVATE}
        </Text>
        <Text variant="caption" className="text-fg-tertiary">
          {sym}
        </Text>
      </View>

      {direction === 'public' ? (
        <UnshieldSide
          view={view}
          focusKey={focusKey}
          onUnshield={r => onUnshield?.(r)}
          shieldedLine={
            <ShieldedLine view={view} retrying={retrying} retryError={retryError} onRetry={handleRetry} checkAgain={checkAgain} refusal={refusal} />
          }
        />
      ) : (
        <>
          <ScrollView
            className="flex-1"
            contentContainerClassName="px-5 pb-6"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <ShieldedLine view={view} retrying={retrying} retryError={retryError} onRetry={handleRetry} checkAgain={checkAgain} refusal={refusal} />

            {/* Amount card — its one balance line is the PUBLIC balance (decision B-2) */}
            <View
              className={cn(
                'rounded-lg bg-bg-surface-1 border p-5 mb-4',
                insufficient ? 'border-danger' : 'border-bg-surface-3',
              )}>
              <BalanceRow label={PUBLIC_BALANCE} value={`${displayAmount(available, A0_TOKEN.decimals)} ${sym}`} testID="shield-balance" />
              {/* UX-A 3 (the design's .amount-line: baseline, gap 8, centred): the input is sized to
                  its content — no min width — so the symbol sits right after the figure */}
              <View className="flex-row items-baseline justify-center gap-2 mb-3" testID="shield-amount-row">
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  placeholderTextColor="#6E727A"
                  keyboardType="decimal-pad"
                  accessibilityLabel="Amount"
                  testID="shield-amount-input"
                  className={cn('font-geist text-balance-xl shrink p-0', insufficient ? 'text-danger' : 'text-fg-primary')}
                />
                <Text
                  variant="h2"
                  className={cn(insufficient ? 'text-danger' : 'text-fg-secondary')}
                  testID="shield-amount-symbol">
                  {sym}
                </Text>
              </View>
              <View className="items-center">
                {insufficient ? (
                  <AmountLimitHint
                    amount={hasAmount ? units : null}
                    max={available}
                    message={`Insufficient balance · max ${displayAmount(available, A0_TOKEN.decimals)} ${sym}`}
                    testID="shield-over-max"
                  />
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

            {/* Summary card — the total visible; the rows behind Details (decision B-3; heading: owner phone pass 2, item 3) */}
            <View
              className={cn(
                'rounded-lg bg-bg-surface-1 border border-bg-surface-3 p-4 mb-4',
                insufficient && 'opacity-50',
              )}>
              <Text variant="overline" className="mb-3">
                {SUMMARY}
              </Text>
              <View className="flex-row items-center justify-between">
                <Text variant="body-sm" className="text-fg-secondary">
                  You'll make private
                </Text>
                <Text variant="balance-md" numeral className="text-fg-primary" testID="shield-net">
                  {`${hasAmount && !insufficient ? displayAmount(units, A0_TOKEN.decimals) : '—'} ${sym}`}
                </Text>
              </View>
              <DetailsDisclosure testID="shield-details">
                <View className="h-px bg-bg-surface-3 my-3" />
                <FeeRow
                  label="Network fee"
                  value={hasAmount ? `${formatTokenAmount(A0_DEPOSIT_FEE_LAMPORTS, SOL_DECIMALS)} SOL` : '—'}
                />
                <FeeRow label="ZK proof fee" value={hasAmount ? 'None · made on this device' : '—'} zk />
                <FeeRow
                  label="Deposit record rent"
                  value={hasAmount ? `≈ ${formatTokenAmount(A0_RHO_MARKER_RENT_LAMPORTS, SOL_DECIMALS)} SOL` : '—'}
                />
                {/* The pool's size — a number, never a yes/no (spec I4); a technical row (ambiguity A6) */}
                {hasAmount && !insufficient && poolNotes !== null ? (
                  <View className="flex-row items-center justify-between mt-1">
                    <Text variant="body-sm" className="text-fg-secondary">
                      Notes in the pool after this deposit
                    </Text>
                    <Text variant="body-sm" numeral className="text-accent-shielded font-geist-semibold" testID="pool-notes">
                      {groupInteger(String(poolNotes + 1))}
                    </Text>
                  </View>
                ) : null}
              </DetailsDisclosure>
            </View>

            {solShort ? (
              <View className="rounded-md bg-bg-surface-2 border-l-2 border-l-warning p-4 mb-4 flex-row gap-3">
                <AlertTriangle size={16} color="#F2B53B" strokeWidth={1.75} />
                <Text variant="caption" className="flex-1 text-fg-secondary">
                  {`Not enough SOL: this deposit needs about ${formatTokenAmount(SOL_NEEDED, SOL_DECIMALS)} SOL for the network fee and the deposit record.`}
                </Text>
              </View>
            ) : null}

            {/* The honest deposit sentence (spec §2): ALWAYS visible, with or without an amount (Task 3 fix round 1) */}
            <Text variant="caption" className="text-fg-tertiary text-center px-2 mt-1" testID="shield-deposit-public">
              {DEPOSIT_PUBLIC_SENTENCE}
            </Text>
          </ScrollView>

          {/* Sticky CTA */}
          <View className="px-6 pb-8 pt-2 border-t border-bg-surface-2 bg-bg-base">
            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityState={{disabled: !canSubmit}}
              testID="shield-cta"
              accessibilityLabel={makePrivateCtaIdle(sym)}
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
                {canSubmit ? makePrivateCta(displayAmount(units, A0_TOKEN.decimals), sym) : makePrivateCtaIdle(sym)}
              </Text>
            </Pressable>
          </View>
        </>
      )}

    </SafeAreaView>
  );
}

// ── The private side's STATUS (undrawn: the A0 startup states, a refusal, the pending sum) ─────

function ShieldedLine({
  view,
  retrying,
  retryError,
  onRetry,
  checkAgain,
  refusal,
}: {
  view: A0ShieldedView;
  retrying: boolean;
  retryError: string | null;
  onRetry: () => void;
  checkAgain: A0CheckAgain;
  /** final review I-1: a verifier refusal of a landed unshield found this session (undrawn) */
  refusal?: A0VerifyRefusal | null;
}) {
  const sym = A0_TOKEN.symbol;
  if (view.kind === 'ready') {
    // part B, decision B-2: the balance figure is each side's BalanceRow; this is only the status
    if (!refusal && view.pending === 0n && !checkAgain.note) {
      return null;
    }
    return (
      <View className="px-1 mb-3">
        {refusal ? (
          <Banner tone="danger" testID="shielded-refusal">
            {a0RefusalLoudText(refusal)}
          </Banner>
        ) : null}
        {view.pending > 0n ? (
          <Text variant="caption" numeral className="text-fg-secondary" testID="shielded-line-pending">
            {`${displayAmount(view.pending, A0_TOKEN.decimals)} ${sym} pending`}
          </Text>
        ) : null}
        {view.pending > 0n ? (
          <View className="flex-row items-center justify-between mt-1">
            <Text variant="caption" className="text-warning flex-1">
              {checkAgain.note ?? 'Pending · not confirmed yet'}
            </Text>
            <CheckAgainLink checkAgain={checkAgain} testID="shielded-check-again" />
          </View>
        ) : checkAgain.note ? (
          // re-review N-2: the last pending item was decided — the check's caption stays, without the link
          <Text variant="caption" className="text-fg-tertiary mt-1" testID="shielded-check-caption">
            {checkAgain.note}
          </Text>
        ) : null}
      </View>
    );
  }
  if (view.kind === 'running') {
    return (
      <Banner tone="info" testID="shielded-line">
        Restoring your private balance from the chain. Make private is available when it finishes.
      </Banner>
    );
  }
  if (view.kind === 'unsupported') {
    return (
      <Banner tone="warn" testID="shielded-line">
        Your private balance needs the on-device prover, which this device does not have (64-bit ARM phones only).
      </Banner>
    );
  }
  const head =
    view.kind === 'error'
      ? `Your private balance could not be restored · ${view.code ?? 'error'}`
      : 'Your private balance is not loaded yet.';
  return (
    <Banner tone={view.kind === 'error' ? 'danger' : 'warn'} testID="shielded-line">
      {head}
      {view.kind === 'error' && view.code === null ? `\n${view.message}` : ''}
      {retryError ? `\n${retryError}` : ''}
      {'\n'}
      <Text
        variant="body-sm"
        className="text-accent-shielded font-geist-semibold"
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Retry restoring your private balance"
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
