import React, {useState, useCallback, useRef} from 'react';
import {View, Pressable, ScrollView, TextInput, StyleSheet} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ArrowLeft} from 'lucide-react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Text, Button, Card} from '../../components/ui';
import {formatAddress} from '../../utils/formatAddress';
import {formatTokenAmount} from '../../utils/parseTokenAmount';
import {addressBook} from '../../modules/addressBook/addressBookModule';
import {useWalletStore} from '../../store/zustand/walletStore';
import {awaitUserAuth} from '../../modules/session/pendingAuth';
import type {RootStackParamList} from '../../types/navigation';
import type {TransferIntent} from '../../types/transfer';
import {
  isHighValueTransfer,
  formatChecksumParts,
  TYPED_CONFIRM_SENTINEL,
} from '../../modules/solana/transferRisk';

// ── Fee constants (lamports) ──────────────────────────────────────────────────
const BASE_FEE_LAMPORTS = 5_000n;
const PRIORITY_FEE_LAMPORTS: Record<'normal' | 'fast' | 'urgent', bigint> = {
  normal: 0n,
  fast: 15_000n,
  urgent: 50_000n,
};
const SOL_DECIMALS = 9;

// ── Module-scope helpers ──────────────────────────────────────────────────────
function safeBigInt(v: string | undefined): bigint {
  try {
    return v ? BigInt(v) : 0n;
  } catch {
    return 0n;
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface TxConfirmScreenProps {
  intent: TransferIntent;
  onBroadcast: (intent: TransferIntent) => void;
  onCancel: () => void;
}

export function TxConfirmScreen({intent, onBroadcast, onCancel}: TxConfirmScreenProps) {
  const {publicKey, solBalance, tokenBalances} = useWalletStore();
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [sending, setSending] = useState(false);
  const [typedConfirm, setTypedConfirm] = useState('');
  const [firstTimeDismissed, setFirstTimeDismissed] = useState(false);
  const lastTapRef = useRef(0);

  const {highValue, percentOfBalance} = isHighValueTransfer(intent, {
    solBalance: safeBigInt(solBalance),
    tokenBalances: Object.fromEntries(
      Object.entries(tokenBalances).map(([k, v]) => [k, safeBigInt(v)]),
    ),
  });

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

  const sendDisabled = sending || (highValue && typedConfirm !== TYPED_CONFIRM_SENTINEL);

  const handleSend = useCallback(async () => {
    const now = Date.now();
    if (now - lastTapRef.current < 500) return;
    lastTapRef.current = now;
    if (sending) return;
    setSending(true);

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

    // Auth approved — hand off to TransactionStatusScreen (#21) which owns broadcast.
    onBroadcast(intent);
  }, [sending, intent, rootNav, onBroadcast]);

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
          {`Send ${intent.amount} ${intent.tokenSymbol} to `}
          <ChecksumAddress address={intent.recipient} />
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
          {/* To row rendered inline to use ChecksumAddress */}
          <View className="flex-row items-center justify-between">
            <Text variant="body-sm" className="text-fg-secondary">
              To
            </Text>
            <ChecksumAddress address={intent.recipient} style={styles.toValue} />
          </View>
        </Card>

        {/* First-time-recipient warning callout */}
        {isFirstTimeRecipient && !firstTimeDismissed && (
          <View style={styles.firstTimeCard}>
            <Text style={styles.firstTimeText}>
              This address is not in your contacts. Double-check before sending.
            </Text>
            <View style={styles.inlineRow}>
              <Pressable
                testID="tx-confirm-add-contact"
                onPress={() => {
                  try {
                    addressBook.addContact({
                      name: formatAddress(intent.recipient),
                      address: intent.recipient,
                      addressType: 'transparent',
                      lastUsedAt: Date.now(),
                    });
                  } catch {
                    // non-critical
                  }
                  setFirstTimeDismissed(true);
                }}>
                <Text style={styles.addLink}>Add</Text>
              </Pressable>
              <Pressable
                testID="tx-confirm-skip-contact"
                onPress={() => setFirstTimeDismissed(true)}>
                <Text style={styles.skipLink}>Skip</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* High-value typed-confirm gate */}
        {highValue && (
          <View style={styles.highValueCard} testID="tx-confirm-highvalue">
            <Text style={styles.highValueHead}>High-value transfer</Text>
            <Text style={styles.highValueBody}>
              This sends {percentOfBalance}% of your balance. Type {TYPED_CONFIRM_SENTINEL} to proceed.
            </Text>
            <TextInput
              testID="tx-confirm-typed-input"
              value={typedConfirm}
              onChangeText={setTypedConfirm}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder={TYPED_CONFIRM_SENTINEL}
              placeholderTextColor="#6E727A"
              style={styles.typedInput}
            />
          </View>
        )}
      </ScrollView>

      {/* Sticky bottom bar */}
      <View className="px-5 pb-8 pt-3 gap-3 border-t border-bg-surface-2">
        <Button
          label={`Send ${intent.amount} ${intent.tokenSymbol}`}
          variant="primary"
          loading={sending}
          disabled={sendDisabled}
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

// ── Private helpers ───────────────────────────────────────────────────────────
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

function ChecksumAddress({address, style}: {address: string; style?: object}) {
  const {head, tail} = formatChecksumParts(address);
  if (!tail) return <Text style={style}>{head}</Text>;
  return (
    <Text style={style}>
      <Text style={styles.ckAccent}>{head}</Text>
      <Text>…</Text>
      <Text style={styles.ckAccent}>{tail}</Text>
    </Text>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  toValue: {fontSize: 13, color: '#E7E9EE', fontWeight: '500'},
  ckAccent: {color: '#B084FC', fontWeight: '700'},
  firstTimeCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    backgroundColor: 'rgba(245,158,11,0.10)',
    borderLeftWidth: 2,
    borderLeftColor: '#F59E0B',
  },
  firstTimeText: {fontSize: 13, color: '#E7E9EE', lineHeight: 18},
  inlineRow: {flexDirection: 'row', gap: 20, marginTop: 10},
  addLink: {fontSize: 14, fontWeight: '700', color: '#B084FC'},
  skipLink: {fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.6)'},
  highValueCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(248,113,113,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.5)',
  },
  highValueHead: {fontSize: 13, fontWeight: '700', color: '#F87171'},
  highValueBody: {fontSize: 13, color: '#E7E9EE', lineHeight: 18, marginTop: 4},
  typedInput: {
    marginTop: 12,
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 2,
  },
});
