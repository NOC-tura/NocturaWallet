import React, {useState, useCallback, useRef} from 'react';
import {View, Pressable, ScrollView, Alert} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ArrowLeft, AlertTriangle} from 'lucide-react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {PublicKey} from '@solana/web3.js';
import {Text, Button, Card} from '../../components/ui';
import {formatAddress} from '../../utils/formatAddress';
import {parseTokenAmount, formatTokenAmount} from '../../utils/parseTokenAmount';
import {addressBook} from '../../modules/addressBook/addressBookModule';
import {useWalletStore} from '../../store/zustand/walletStore';
import {awaitUserAuth} from '../../modules/session/pendingAuth';
import type {RootStackParamList} from '../../types/navigation';
import type {TransferIntent} from '../../types/transfer';

// ── Fee constants (lamports) ──────────────────────────────────────────────────
const BASE_FEE_LAMPORTS = 5_000n;
const PRIORITY_FEE_LAMPORTS: Record<'normal' | 'fast' | 'urgent', bigint> = {
  normal: 0n,
  fast: 15_000n,
  urgent: 50_000n,
};
const SOL_DECIMALS = 9;

// ── Lazy imports — wrapped in try/catch so Jest/stub envs don't crash ─────────
let sendTransparentTransfer:
  | typeof import('../../modules/solana/sendTransaction').sendTransparentTransfer
  | null = null;
let loadTransparentScheme:
  | typeof import('../../modules/keyDerivation/derivationScheme').loadTransparentScheme
  | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  sendTransparentTransfer = require('../../modules/solana/sendTransaction').sendTransparentTransfer;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  loadTransparentScheme = require('../../modules/keyDerivation/derivationScheme').loadTransparentScheme;
} catch {
  // Modules unavailable in test/stub environment — no-op
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface TxConfirmScreenProps {
  intent: TransferIntent;
  onSent: (params: {signature: string; amount: string; recipient: string; token: string}) => void;
  onCancel: () => void;
}

export function TxConfirmScreen({intent, onSent, onCancel}: TxConfirmScreenProps) {
  const {publicKey} = useWalletStore();
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [sending, setSending] = useState(false);
  const lastTapRef = useRef(0);

  // Resolve whether recipient is a new contact (for the warning callout)
  let isFirstTimeRecipient = false;
  try {
    const existing = addressBook.findByAddress(intent.recipient);
    isFirstTimeRecipient = existing == null;
  } catch {
    // addressBook lookup failed — show the first-time callout (cautious default)
    isFirstTimeRecipient = true;
  }

  const priorityLamports = PRIORITY_FEE_LAMPORTS[intent.priorityLevel];

  const handleSend = useCallback(async () => {
    const now = Date.now();
    if (now - lastTapRef.current < 500) return;
    lastTapRef.current = now;
    if (sending) return;
    setSending(true);

    try {
      const feeSOL = formatTokenAmount(
        BASE_FEE_LAMPORTS + PRIORITY_FEE_LAMPORTS[intent.priorityLevel],
        SOL_DECIMALS,
      );
      // Navigate to UnlockSend BEFORE awaiting — modal must appear while we wait.
      const authPromise = awaitUserAuth();
      rootNav.navigate('UnlockSend', {
        amount: intent.amount,
        ticker: intent.tokenSymbol,
        recipient: intent.recipient,
        networkFee: `${feeSOL} SOL`,
      });
      const approved = await authPromise;
      if (!approved) {
        setSending(false);
        return;
      }

      let signature: string;
      try {
        if (!sendTransparentTransfer || !loadTransparentScheme) {
          throw new Error('Send module unavailable');
        }
        const scheme = loadTransparentScheme();
        const recipientPk = new PublicKey(intent.recipient);
        // Priority tiers are expressed as a target lamport amount; convert to a
        // per-compute-unit price (microLamports) for setComputeUnitPrice over the
        // standard 200k CU budget. normal=0, fast≈75k µLam/CU, urgent≈250k µLam/CU.
        const priorityFee = Number((PRIORITY_FEE_LAMPORTS[intent.priorityLevel] * 1_000_000n) / 200_000n);

        if (intent.tokenMint === 'native') {
          const lamports = parseTokenAmount(intent.amount, SOL_DECIMALS);
          const res = await sendTransparentTransfer({
            kind: 'sol',
            recipient: recipientPk,
            lamports,
            priorityFee,
            scheme,
          });
          signature = res.signature;
        } else {
          const splAmount = parseTokenAmount(intent.amount, intent.decimals);
          const res = await sendTransparentTransfer({
            kind: 'spl',
            recipient: recipientPk,
            mint: new PublicKey(intent.tokenMint),
            amount: splAmount,
            decimals: intent.decimals,
            createAta: intent.createAta,
            priorityFee,
            scheme,
          });
          signature = res.signature;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Transaction failed';
        Alert.alert('Send failed', msg);
        setSending(false);
        return;
      }

      onSent({
        signature,
        amount: intent.amount,
        recipient: intent.recipient,
        token: intent.tokenSymbol,
      });

      try {
        const existing = addressBook.findByAddress(intent.recipient);
        if (!existing) {
          const defaultName = formatAddress(intent.recipient);
          Alert.alert('Add to contacts?', `Save ${defaultName} to your address book?`, [
            {text: 'Skip', style: 'cancel'},
            {
              text: 'Save',
              onPress: () => {
                try {
                  addressBook.addContact({
                    name: defaultName,
                    address: intent.recipient,
                    addressType: 'transparent',
                    lastUsedAt: Date.now(),
                  });
                } catch {
                  // non-critical
                }
              },
            },
          ]);
        }
      } catch {
        // non-critical
      }
    } finally {
      setSending(false);
    }
  }, [sending, intent, rootNav, onSent]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-bg-base">
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
      </View>

      <ScrollView contentContainerClassName="p-5 pb-4" keyboardShouldPersistTaps="handled">
        {/* Headline */}
        <Text variant="h1" className="mb-6">
          {`Send ${intent.amount} ${intent.tokenSymbol} to ${formatAddress(intent.recipient)}`}
        </Text>

        {/* Detail rows */}
        <Card className="mb-4 gap-3">
          <DetailRow label="Network" value="Solana mainnet" />
          <DetailRow
            label="Fee"
            value={`${formatTokenAmount(BASE_FEE_LAMPORTS, SOL_DECIMALS)} SOL`}
          />
          <DetailRow
            label="Priority"
            value={`${formatTokenAmount(priorityLamports, SOL_DECIMALS)} SOL`}
          />
          <DetailRow label="From" value={formatAddress(publicKey ?? '')} />
          <DetailRow label="To" value={formatAddress(intent.recipient)} />
        </Card>

        {/* First-time-recipient warning callout */}
        {isFirstTimeRecipient && (
          <Card
            surface="surface-2"
            className="mb-4 flex-row gap-3 items-start border border-warning">
            <AlertTriangle size={18} color="#F59E0B" strokeWidth={1.75} className="mt-0.5" />
            <Text variant="body-sm" className="flex-1 text-fg-secondary">
              This address is not in your contacts. Double-check before sending.
            </Text>
          </Card>
        )}
      </ScrollView>

      {/* Sticky bottom bar */}
      <View className="px-5 pb-8 pt-3 gap-3 border-t border-bg-surface-2">
        <Button
          label={`Send ${intent.amount} ${intent.tokenSymbol}`}
          variant="primary"
          loading={sending}
          disabled={sending}
          testID="tx-confirm-send"
          onPress={() => {
            void handleSend();
          }}
        />
        <Button
          label="Cancel"
          variant="secondary"
          disabled={sending}
          testID="tx-confirm-cancel"
          onPress={onCancel}
        />
      </View>
    </SafeAreaView>
  );
}

// ── Private helper ────────────────────────────────────────────────────────────
function DetailRow({label, value}: {label: string; value: string}) {
  return (
    <View className="flex-row items-center justify-between">
      <Text variant="body-sm" className="text-fg-secondary">
        {label}
      </Text>
      <Text variant="body-sm" className="text-fg-primary font-geist-medium">
        {value}
      </Text>
    </View>
  );
}
