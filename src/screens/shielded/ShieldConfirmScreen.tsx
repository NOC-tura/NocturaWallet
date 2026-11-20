import React, {useCallback, useRef, useState} from 'react';
import {View, Pressable, ScrollView} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ArrowLeft, ShieldCheck, Shield} from 'lucide-react-native';
import {Text, Button, Card} from '../../components/ui';
import {cn} from '../../utils/cn';
import {formatTokenAmount} from '../../utils/parseTokenAmount';
import {formatChecksumParts} from '../../modules/solana/transferRisk';
import {A0} from '../../modules/shielded/a0/constants';
import {
  A0_DEPOSIT_FEE_LAMPORTS,
  A0_RHO_MARKER_RENT_LAMPORTS,
  SOL_DECIMALS,
  displayAmount,
  preparedA0Deposit,
} from '../../modules/shielded/a0/screenSupport';
import {PRIVATE_MARK, makePrivateCta} from '../../copy/modes';
import type {ShieldIntent} from '../../types/shield';

/**
 * #20 tx-confirm for the A0 deposit — mirror /home/user/Downloads/index.html §s20, its SHIELDED
 * variant (state 4: "SHIELDED Confirm", the "You are about to send privately" card, From / To /
 * Anonymity / Network rows, Fees with the ZK proof row, the mint CTA with the shield glyph).
 *
 * Adapted to what a deposit is (D27 copy; part B words): "You are about to make this private"; From = your main account
 * (checksum first-6 / last-6 highlighted, screen.md's convention) — it signs and pays; To = the
 * shielded pool (its address, devnet); Network = Solana devnet; fees = network fee, deposit record
 * rent, ZK proof none. The design's "Anonymity · Pool of N notes" row is #16's measured number and is
 * not repeated here; "PRIVATE" / "SHIELDED" pills are not drawn on a public deposit.
 *
 * The CTA runs the existing re-auth (#10 UnlockSend through `awaitUserAuth`, supplied by the
 * Navigator as `requestAuth`) and then hands over to #21, which owns the send. Debounced and
 * disabled while the auth is open (cardinal rule 6). No first-time-recipient callout and no
 * high-value gate: there is no recipient — the circuit binds the note to this wallet (§5.5).
 */

interface ShieldConfirmScreenProps {
  intent: ShieldIntent;
  /** the re-auth (#10); resolves true when approved */
  requestAuth: (intent: ShieldIntent) => Promise<boolean>;
  onAuthorized: (intent: ShieldIntent) => void;
  onCancel: () => void;
}

export function ShieldConfirmScreen({intent, requestAuth, onAuthorized, onCancel}: ShieldConfirmScreenProps) {
  const [busy, setBusy] = useState(false);
  const lastTapRef = useRef(0);
  const held = preparedA0Deposit(intent.preparedId) !== null;
  const amount = `${displayAmount(BigInt(intent.amount), intent.decimals)} ${intent.tokenSymbol}`;
  const figure = displayAmount(BigInt(intent.amount), intent.decimals);
  const headline = makePrivateCta(figure, intent.tokenSymbol);

  const handleShield = useCallback(async () => {
    const now = Date.now();
    if (now - lastTapRef.current < 500) return;
    lastTapRef.current = now;
    if (busy || !held) return;
    setBusy(true);
    const approved = await requestAuth(intent);
    if (!approved) {
      setBusy(false);
      return;
    }
    onAuthorized(intent);
  }, [busy, held, requestAuth, onAuthorized, intent]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-bg-base">
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
          <Text variant="h2">Confirm</Text>
        </View>
        <Text variant="caption" className="text-fg-tertiary">
          4 of 4
        </Text>
      </View>

      <ScrollView contentContainerClassName="p-5 pb-4 gap-4">
        <Text variant="h1" className="text-center" testID="shield-confirm-headline">
          {headline}
        </Text>

        <View className="rounded-lg p-5 border border-[rgba(91,227,194,0.45)] bg-bg-surface-1">
          <Text variant="overline" className="text-accent-shielded mb-2">
            You are about to make this private
          </Text>
          <Text variant="balance-lg" numeral className="text-fg-primary">
            {amount}
          </Text>
        </View>

        {!held ? (
          <View className="rounded-lg p-4 bg-bg-surface-2 border-l-2 border-l-warning" testID="shield-confirm-missing">
            <Text variant="body-sm" className="text-fg-secondary">
              This deposit is no longer prepared. Go back and start again.
            </Text>
          </View>
        ) : null}

        <Card className="gap-3">
          <Row label="From">
            <Checksum address={intent.depositor} />
          </Row>
          <Row label="To">
            <Text variant="body-sm" className="text-accent-shielded">
              {`Pool · ${A0.pool.slice(0, 4)}…${A0.pool.slice(-4)}`}
            </Text>
          </Row>
          <Row label="Signs">
            <Text variant="body-sm" className="text-fg-primary">
              Your main account
            </Text>
          </Row>
          <Row label="Network">
            <Text variant="body-sm" className="text-fg-primary">
              Solana devnet
            </Text>
          </Row>
        </Card>

        <Card className="gap-3">
          <Text variant="overline">Fees</Text>
          <Row label="ZK proof fee" zk>
            <Text variant="body-sm" className="text-fg-primary">
              None · on this device
            </Text>
          </Row>
          <Row label="Network fee">
            <Text variant="body-sm" numeral className="text-fg-primary">
              {`${formatTokenAmount(A0_DEPOSIT_FEE_LAMPORTS, SOL_DECIMALS)} SOL`}
            </Text>
          </Row>
          <Row label="Deposit record rent">
            <Text variant="body-sm" numeral className="text-fg-primary">
              {`≈ ${formatTokenAmount(A0_RHO_MARKER_RENT_LAMPORTS, SOL_DECIMALS)} SOL`}
            </Text>
          </Row>
        </Card>

        <Text variant="caption" className="text-fg-tertiary text-center px-2">
          The amount, the time and your main account are public in this deposit.
        </Text>
      </ScrollView>

      <View className="px-5 pb-8 pt-3 gap-3 border-t border-bg-surface-2">
        <Pressable
          onPress={() => {
            void handleShield();
          }}
          disabled={busy || !held}
          accessibilityRole="button"
          accessibilityState={{disabled: busy || !held}}
          accessibilityLabel={headline}
          testID="shield-confirm-send"
          className={cn(
            'min-h-touch-rec rounded-pill items-center justify-center flex-row gap-2',
            busy || !held ? 'bg-bg-surface-3' : 'bg-accent-shielded active:opacity-90',
          )}>
          <Shield size={18} color={busy || !held ? '#6E727A' : '#0A0A0A'} strokeWidth={2} />
          <Text variant="body-lg" className={cn('font-geist-semibold', busy || !held ? 'text-fg-disabled' : 'text-bg-base')}>
            {headline}
          </Text>
        </Pressable>
        <Button label="Cancel" variant="tertiary" disabled={busy} testID="shield-confirm-cancel" onPress={onCancel} />
      </View>
    </SafeAreaView>
  );
}

function Row({label, children, zk}: {label: string; children: React.ReactNode; zk?: boolean}) {
  return (
    <View className="flex-row items-start justify-between gap-3">
      <Text variant="overline" className={cn('pt-0.5', zk ? 'text-accent-shielded' : 'text-fg-tertiary')}>
        {label}
      </Text>
      <View className="flex-1 items-end">{children}</View>
    </View>
  );
}

function Checksum({address}: {address: string}) {
  const {head, tail} = formatChecksumParts(address);
  if (!tail) {
    return (
      <Text variant="body-sm" mono className="text-fg-primary">
        {head}
      </Text>
    );
  }
  return (
    <Text variant="body-sm" mono className="text-fg-primary text-right" testID="shield-confirm-from">
      <Text variant="body-sm" mono className="text-accent-shielded">
        {head}
      </Text>
      {address.slice(6, -6)}
      <Text variant="body-sm" mono className="text-accent-shielded">
        {tail}
      </Text>
    </Text>
  );
}
