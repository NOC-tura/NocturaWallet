import React, {useState, useCallback, useMemo, useRef} from 'react';
import {
  View,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  ArrowLeft,
  ChevronDown,
  ScanLine,
  ClipboardPaste,
  X,
  AlertTriangle,
  Check,
  Lock,
  BookUser,
} from 'lucide-react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {Text} from '../../components/ui';
import {validateRecipientInput} from '../../utils/validateAddress';
import {parseTokenAmount, formatTokenAmount} from '../../utils/parseTokenAmount';
import {useWalletStore} from '../../store/zustand/walletStore';
import {addressBook} from '../../modules/addressBook/addressBookModule';
import type {Contact} from '../../modules/addressBook/types';
import {formatAddress} from '../../utils/formatAddress';
import {awaitContactSelection} from '../../modules/session/pendingContactSelect';
import type {RootStackParamList} from '../../types/navigation';
import {NOC_MINT, NOC_DECIMALS} from '../../constants/programs';
import {cn} from '../../utils/cn';
import {TokenPickerSheet} from '../../components/TokenPickerSheet';

const SOLANA_LOGO = require('../../assets/tokens/solana-sol-logo.png');
const NOC_LOGO = require('../../assets/tokens/noc-logo.png');

// ── Fee constants (lamports) ────────────────────────────────────────────────
//
// Solana fee model:
//   • Base transaction fee = 5,000 lamports per signature (fixed network fee)
//   • Priority fee = `compute_unit_price (µLamports) × compute_units_used`,
//     converted to lamports (÷ 1,000,000). Optional, paid to the leader to
//     boost ordering during congestion.
//   • Rent (account creation) = separate, calculated per-account by runtime.
//
// Priority tiers below are tuned for typical non-congested mainnet conditions
// using the standard 200,000 CU compute budget:
//
//   normal  → 0 µLamports/CU       → 0 priority fee (base only)
//   fast    → ~75,000 µLamports/CU → ~15,000 lamports = 0.000015 SOL
//   urgent  → ~250,000 µLamports/CU → ~50,000 lamports = 0.00005 SOL
//
// These match Phantom/Solflare default tiers + the design baseline values
// in /home/user/Downloads/index.html §s12 (Normal "base fee" · Fast +0.000015
// SOL · Instant +0.00005 SOL). Real-time priority fee estimation via
// `getPriorityFee()` RPC should land here in a follow-up for adaptive pricing.
//
// NO Noctura markup — fees are pure Solana network values, transparent to the
// user. (Earlier draft had a 20,000-lamport markup; design baseline shows no
// markup in the fee row, so we match design.)
const BASE_FEE_LAMPORTS = 5_000n;

const PRIORITY_FEE_LAMPORTS: Record<PriorityLevel, bigint> = {
  normal: 0n,
  fast: 15_000n,
  urgent: 50_000n,
};

function getTotalNetworkFee(level: PriorityLevel): bigint {
  return BASE_FEE_LAMPORTS + PRIORITY_FEE_LAMPORTS[level];
}

const SOL_DECIMALS = 9;
const SOL_MINT = 'native';

type PriorityLevel = 'normal' | 'fast' | 'urgent';

interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
}

const SOL_TOKEN: TokenInfo = {mint: SOL_MINT, symbol: 'SOL', name: 'Solana', decimals: SOL_DECIMALS};

export interface SendScreenProps {
  onReview: (intent: import('../../types/transfer').TransferIntent) => void;
  onBack?: () => void;
  initialMint?: string;
}

/**
 * #12 Send — input form only.
 *
 * Collects token, recipient, amount, priority; validates; then calls
 * onReview(intent) to hand off to TxSimulateScreen (#19) → TxConfirmScreen (#20).
 *
 * Visual states implemented:
 *   - idle (empty form)
 *   - invalid-recipient (red border + helper)
 *   - insufficient-balance (red amount + helper)
 *
 * Deferred (separate migrations):
 *   - Shielded variant (#12.2 — privacy meter + ZK fee row)
 *   - First-time recipient banner + checksum highlight
 *   - QR scanner integration (#14 still placeholder)
 *   - Bottom-sheet token picker (TokenPickerSheet)
 */
export function SendScreen({onReview, onBack, initialMint}: SendScreenProps) {
  const {solBalance, nocBalance, tokens: storeTokens, tokenBalances} = useWalletStore();
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Default token list: ALWAYS include SOL + NOC even if not in the dynamic
  // storeTokens array. Matches Dashboard's default-tokens pattern — primary
  // native + wallet's own token always pinned. Other SPL tokens (USDC, BONK,
  // etc.) appear when actually held on-chain.
  const availableTokens: TokenInfo[] = useMemo(() => {
    const splTokens: TokenInfo[] = storeTokens.map(t => ({
      mint: t.mint,
      symbol: t.symbol,
      name: t.name,
      decimals: t.decimals,
    }));
    const hasNoc = splTokens.some(t => t.mint === NOC_MINT);
    if (!hasNoc) {
      splTokens.unshift({
        mint: NOC_MINT,
        symbol: 'NOC',
        name: 'Noctura',
        decimals: NOC_DECIMALS,
      });
    }
    return [SOL_TOKEN, ...splTokens];
  }, [storeTokens]);

  // Debounce ref — cardinal rule #6: 500ms minimum on send/sign buttons
  const lastTapRef = useRef(0);

  const [recipient, setRecipient] = useState('');
  const [recipientError, setRecipientError] = useState('');
  const [suggestions, setSuggestions] = useState<Contact[]>([]);
  const [selectedMint, setSelectedMint] = useState(initialMint ?? SOL_MINT);
  const [amount, setAmount] = useState('');
  const [priorityLevel, setPriorityLevel] = useState<PriorityLevel>('normal');
  const [pickerVisible, setPickerVisible] = useState(false);

  const selectedToken = useMemo(
    () => availableTokens.find(t => t.mint === selectedMint) ?? SOL_TOKEN,
    [availableTokens, selectedMint],
  );

  const selectedBalance = useMemo<bigint>(() => {
    if (selectedMint === SOL_MINT) {
      try {
        return BigInt(solBalance);
      } catch {
        return 0n;
      }
    }
    const raw = tokenBalances[selectedMint] ?? '0';
    try {
      return BigInt(raw);
    } catch {
      return 0n;
    }
  }, [selectedMint, solBalance, tokenBalances]);

  const handleMaxAmount = useCallback(() => {
    if (selectedMint === SOL_MINT) {
      const available = selectedBalance - getTotalNetworkFee(priorityLevel);
      const safeAmount = available > 0n ? available : 0n;
      setAmount(formatTokenAmount(safeAmount, SOL_DECIMALS));
    } else {
      setAmount(formatTokenAmount(selectedBalance, selectedToken.decimals));
    }
  }, [selectedMint, selectedBalance, selectedToken.decimals, priorityLevel]);

  const handleRecipientChange = useCallback(
    (text: string) => {
      setRecipient(text);
      if (recipientError) setRecipientError('');
      if (text.trim().length >= 1) {
        try {
          const matches = addressBook.findByName(text).slice(0, 3);
          setSuggestions(matches);
        } catch {
          setSuggestions([]);
        }
      } else {
        setSuggestions([]);
      }
    },
    [recipientError],
  );

  const handleSelectSuggestion = useCallback((contact: Contact) => {
    setRecipient(contact.address);
    setSuggestions([]);
    setRecipientError('');
  }, []);

  const handleRecipientBlur = useCallback(() => {
    if (!recipient) {
      setRecipientError('');
      return;
    }
    const result = validateRecipientInput(recipient);
    if (result.type === 'invalid' || result.type === 'non_solana') {
      setRecipientError(result.error ?? 'Invalid recipient address');
    } else if (result.type === 'shielded') {
      setRecipientError('Use Shielded Transfer for private addresses');
    } else {
      setRecipientError('');
      if (result.type === 'solana_pay' && result.address) {
        setRecipient(result.address);
        if (result.amount) setAmount(result.amount);
      }
    }
  }, [recipient]);

  const handlePaste = useCallback(async () => {
    try {
      const clip = await Clipboard.getString();
      if (clip) handleRecipientChange(clip.trim());
    } catch {
      // best-effort
    }
  }, [handleRecipientChange]);

  const handleClearRecipient = useCallback(() => {
    setRecipient('');
    setRecipientError('');
    setSuggestions([]);
  }, []);

  const handleQrScan = useCallback(() => {
    rootNav.navigate('ScanModal');
  }, [rootNav]);

  const handleOpenAddressBook = useCallback(async () => {
    const promise = awaitContactSelection();
    rootNav.navigate('AddressBookModal');
    const contact = await promise;
    if (contact) {
      handleRecipientChange(contact.address);
    }
  }, [rootNav, handleRecipientChange]);

  // Insufficient balance check
  const insufficientBalance = useMemo(() => {
    if (!amount.trim()) return false;
    try {
      const parsed = parseTokenAmount(amount, selectedToken.decimals);
      if (parsed <= 0n) return false;
      if (selectedMint === SOL_MINT) {
        return parsed + getTotalNetworkFee(priorityLevel) > selectedBalance;
      }
      return parsed > selectedBalance;
    } catch {
      return false;
    }
  }, [amount, selectedToken.decimals, selectedMint, selectedBalance, priorityLevel]);

  const shortBy = useMemo<bigint>(() => {
    if (!insufficientBalance) return 0n;
    try {
      const parsed = parseTokenAmount(amount, selectedToken.decimals);
      const needed =
        selectedMint === SOL_MINT
          ? parsed + getTotalNetworkFee(priorityLevel)
          : parsed;
      return needed - selectedBalance;
    } catch {
      return 0n;
    }
  }, [amount, insufficientBalance, selectedMint, selectedToken.decimals, selectedBalance, priorityLevel]);

  const canReview = useMemo(() => {
    if (!recipient.trim() || !amount.trim()) return false;
    if (insufficientBalance) return false;
    const validation = validateRecipientInput(recipient);
    if (
      validation.type === 'invalid' ||
      validation.type === 'non_solana' ||
      validation.type === 'shielded'
    ) {
      return false;
    }
    try {
      const parsed = parseTokenAmount(amount, selectedToken.decimals);
      if (parsed <= 0n) return false;
    } catch {
      return false;
    }
    return true;
  }, [recipient, amount, selectedToken.decimals, insufficientBalance]);

  const handleReview = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 500) return;
    lastTapRef.current = now;
    if (!canReview) return;
    onReview({
      mode: 'transparent',
      recipient,
      amount,
      tokenMint: selectedMint,
      tokenSymbol: selectedToken.symbol,
      decimals: selectedToken.decimals,
      priorityLevel,
      createAta: selectedMint !== SOL_MINT,
    });
  }, [canReview, recipient, amount, selectedMint, selectedToken.symbol, selectedToken.decimals, priorityLevel, onReview]);

  const networkFeeDisplay = useMemo(() => {
    const feeSOL = formatTokenAmount(getTotalNetworkFee(priorityLevel), SOL_DECIMALS);
    return `${feeSOL} SOL`;
  }, [priorityLevel]);

  const validation = recipient ? validateRecipientInput(recipient) : null;
  const validRecipient =
    validation !== null &&
    validation.type !== 'invalid' &&
    validation.type !== 'non_solana' &&
    validation.type !== 'shielded';

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      className="flex-1 bg-bg-base">
      {/* Top bar */}
      <View className="flex-row items-center px-4 py-3 min-h-touch-min">
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="w-12 h-12 items-center justify-center -ml-2">
          <ArrowLeft size={22} color="#A8ACB5" strokeWidth={1.75} />
        </Pressable>
        <Text variant="h1" className="ml-1 flex-1">
          Send
        </Text>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pb-6"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Token picker */}
          <View className="mb-4">
            <Text variant="overline" className="mb-2">
              Token
            </Text>
            <Pressable
              onPress={() => setPickerVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={`Token ${selectedToken.symbol}, tap to change`}
              testID="token-picker"
              className="flex-row items-center gap-3 p-4 rounded-md bg-bg-surface-1 border border-bg-surface-3 active:bg-bg-surface-2">
              <TokenLogo symbol={selectedToken.symbol} mint={selectedToken.mint} />
              <Text variant="body-lg" className="flex-1 text-fg-primary">
                {selectedToken.symbol}
              </Text>
              <ChevronDown size={18} color="#A8ACB5" strokeWidth={1.75} />
            </Pressable>
          </View>

          {/* Recipient */}
          <View className="mb-4">
            <Text
              variant="overline"
              className={cn('mb-2', recipientError && 'text-danger')}>
              Recipient
            </Text>
            <View
              className={cn(
                'rounded-md border bg-bg-surface-1 p-4 gap-2',
                recipientError && 'border-danger',
                !recipientError && validRecipient && 'border-success',
                !recipientError && !validRecipient && 'border-bg-surface-3',
              )}>
              <TextInput
                testID="recipient-input"
                value={recipient}
                onChangeText={handleRecipientChange}
                onBlur={handleRecipientBlur}
                placeholder="Solana address or .sol domain"
                placeholderTextColor="#6E727A"
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                accessibilityLabel="Recipient address"
                className="font-geist-mono text-body-sm text-fg-primary"
                style={{minHeight: 22}}
              />
              <View className="flex-row items-center gap-1">
                {recipient ? (
                  <Pressable
                    onPress={handleClearRecipient}
                    accessibilityRole="button"
                    accessibilityLabel="Clear"
                    className="w-9 h-9 items-center justify-center rounded-pill active:bg-bg-surface-2">
                    <X size={18} color="#A8ACB5" strokeWidth={1.75} />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={handlePaste}
                    accessibilityRole="button"
                    accessibilityLabel="Paste"
                    className="w-9 h-9 items-center justify-center rounded-pill active:bg-bg-surface-2">
                    <ClipboardPaste size={18} color="#A8ACB5" strokeWidth={1.75} />
                  </Pressable>
                )}
                <Pressable
                  onPress={handleQrScan}
                  accessibilityRole="button"
                  accessibilityLabel="Scan QR"
                  testID="qr-scan-button"
                  className="w-9 h-9 items-center justify-center rounded-pill active:bg-bg-surface-2">
                  <ScanLine size={18} color="#A8ACB5" strokeWidth={1.75} />
                </Pressable>
                <Pressable
                  onPress={handleOpenAddressBook}
                  accessibilityRole="button"
                  accessibilityLabel="Address book"
                  testID="address-book-button"
                  className="w-9 h-9 items-center justify-center rounded-pill active:bg-bg-surface-2">
                  <BookUser size={18} color="#A8ACB5" strokeWidth={1.75} />
                </Pressable>
              </View>
            </View>
            {recipientError ? (
              <View className="flex-row items-center gap-2 mt-2">
                <AlertTriangle size={12} color="#FF5C6A" strokeWidth={2} />
                <Text variant="caption" className="text-danger flex-1">
                  {recipientError}
                </Text>
              </View>
            ) : validRecipient && recipient.length > 0 ? (
              <View className="flex-row items-center gap-2 mt-2">
                <Check size={12} color="#3FD68B" strokeWidth={2.5} />
                <Text variant="caption" className="text-success flex-1">
                  Valid address
                </Text>
              </View>
            ) : null}

            {/* Address book suggestions */}
            {suggestions.length > 0 ? (
              <View className="mt-2 rounded-md bg-bg-surface-1 border border-bg-surface-3 overflow-hidden">
                {suggestions.map(s => (
                  <Pressable
                    key={s.id}
                    onPress={() => handleSelectSuggestion(s)}
                    testID="address-suggestion"
                    className="px-4 py-3 active:bg-bg-surface-2 border-b border-bg-surface-3 last:border-b-0">
                    <Text variant="body-sm" className="text-fg-primary">
                      {s.name}
                    </Text>
                    <Text variant="caption" mono className="text-fg-tertiary mt-0.5">
                      {formatAddress(s.address)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          {/* Amount */}
          <View className="mb-4">
            <Text
              variant="overline"
              className={cn('mb-2', insufficientBalance && 'text-danger')}>
              Amount
            </Text>
            <View
              className={cn(
                'rounded-md border bg-bg-surface-1 p-4',
                insufficientBalance && 'border-danger',
                !insufficientBalance && 'border-bg-surface-3',
              )}>
              <View className="flex-row items-baseline gap-3">
                <TextInput
                  testID="amount-input"
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.000000"
                  placeholderTextColor="#6E727A"
                  keyboardType="decimal-pad"
                  accessibilityLabel="Amount"
                  className={cn(
                    'flex-1 font-geist text-balance-lg',
                    insufficientBalance ? 'text-danger' : 'text-fg-primary',
                  )}
                />
                <Pressable
                  onPress={handleMaxAmount}
                  accessibilityRole="button"
                  accessibilityLabel="Max"
                  testID="max-button"
                  className="px-3 py-1.5 rounded-pill bg-accent-transparent-tint active:opacity-80">
                  <Text
                    variant="overline"
                    className="text-accent-transparent">
                    MAX
                  </Text>
                </Pressable>
              </View>
              <View className="flex-row items-center mt-2">
                <Text variant="body-sm" className="text-fg-secondary">
                  Available{' '}
                </Text>
                <Text variant="body-sm" numeral className="font-geist-semibold text-fg-primary">
                  {formatTokenAmount(selectedBalance, selectedToken.decimals)} {selectedToken.symbol}
                </Text>
              </View>
            </View>
            {insufficientBalance ? (
              <View className="flex-row items-center gap-2 mt-2">
                <AlertTriangle size={12} color="#FF5C6A" strokeWidth={2} />
                <Text variant="caption" className="text-danger flex-1">
                  Insufficient balance — short by{' '}
                  <Text variant="caption" numeral className="text-danger">
                    {formatTokenAmount(shortBy, selectedToken.decimals)} {selectedToken.symbol}
                  </Text>
                </Text>
              </View>
            ) : null}
          </View>

          {/* Priority chips */}
          <View className="mb-4">
            <Text variant="overline" className="mb-2">
              Speed · priority fee
            </Text>
            <View className="flex-row gap-2">
              <PriorityChip
                level="normal"
                label="Normal"
                eta="~30 s"
                delta="base fee"
                active={priorityLevel === 'normal'}
                onPress={() => setPriorityLevel('normal')}
              />
              <PriorityChip
                level="fast"
                label="Fast"
                eta="~10 s"
                delta="+0.000015 SOL"
                active={priorityLevel === 'fast'}
                onPress={() => setPriorityLevel('fast')}
              />
              <PriorityChip
                level="urgent"
                label="Instant"
                eta="~3 s"
                delta="+0.00005 SOL"
                active={priorityLevel === 'urgent'}
                onPress={() => setPriorityLevel('urgent')}
              />
            </View>
          </View>

          {/* Fee row */}
          <View className="rounded-md bg-bg-surface-1 border border-bg-surface-3 p-4 gap-2 mb-4">
            <View className="flex-row items-center justify-between">
              <Text variant="body-sm" className="text-fg-secondary">
                Network fee
              </Text>
              <Text variant="body-sm" numeral className="text-fg-primary">
                {networkFeeDisplay}
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text variant="body-sm" className="text-fg-tertiary">
                Priority
              </Text>
              <Text variant="body-sm" className="text-fg-secondary">
                {priorityLevel === 'normal'
                  ? 'Normal · base fee'
                  : priorityLevel === 'fast'
                  ? 'Fast · +0.000015 SOL'
                  : 'Instant · +0.00005 SOL'}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Sticky CTA */}
        <View className="px-6 pb-8 pt-2 bg-bg-base border-t border-bg-surface-2">
          <Pressable
            onPress={handleReview}
            disabled={!canReview}
            accessibilityRole="button"
            testID="review-button"
            accessibilityLabel={`Send ${selectedToken.symbol}`}
            className={cn(
              'min-h-touch-rec rounded-pill items-center justify-center flex-row gap-2',
              canReview ? 'bg-accent-transparent active:opacity-90' : 'bg-bg-surface-3',
            )}>
            {!canReview && recipient && amount ? (
              <Lock
                size={18}
                color={canReview ? '#0A0A0A' : '#6E727A'}
                strokeWidth={2}
              />
            ) : null}
            <Text
              variant="body-lg"
              className={cn(
                'font-geist-semibold',
                canReview ? 'text-bg-base' : 'text-fg-disabled',
              )}>
              {amount.trim() && canReview
                ? `Send ${amount} ${selectedToken.symbol}`
                : `Send ${selectedToken.symbol}`}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <TokenPickerSheet
        visible={pickerVisible}
        title="Select token"
        tokens={availableTokens}
        selectedMint={selectedMint}
        balances={{native: solBalance, [NOC_MINT]: nocBalance, ...tokenBalances}}
        onSelect={mint => {
          setSelectedMint(mint);
          setAmount('');
          setPickerVisible(false);
        }}
        onClose={() => setPickerVisible(false)}
      />
    </SafeAreaView>
  );
}

// ── Token logo helper ──────────────────────────────────────────────────────

function TokenLogo({symbol, mint}: {symbol: string; mint: string}) {
  if (symbol === 'SOL' || mint === SOL_MINT) {
    return (
      <View className="w-9 h-9 rounded-pill items-center justify-center bg-bg-surface-2 overflow-hidden">
        <Image
          source={SOLANA_LOGO}
          style={{width: 20, height: 20}}
          resizeMode="contain"
          accessibilityLabel="Solana logo"
        />
      </View>
    );
  }
  if (mint === NOC_MINT) {
    return (
      <View className="w-9 h-9 rounded-pill items-center justify-center bg-bg-surface-2 overflow-hidden">
        <Image
          source={NOC_LOGO}
          style={{width: 26, height: 26}}
          resizeMode="contain"
          accessibilityLabel="Noctura logo"
        />
      </View>
    );
  }
  return (
    <View className="w-9 h-9 rounded-pill items-center justify-center bg-bg-surface-2">
      <Text variant="body-sm" className="font-geist-semibold text-fg-primary">
        {symbol.charAt(0)}
      </Text>
    </View>
  );
}

// ── Priority chip ──────────────────────────────────────────────────────────

interface PriorityChipProps {
  level: PriorityLevel;
  label: string;
  eta: string;
  delta: string;
  active: boolean;
  onPress: () => void;
}

function PriorityChip({label, eta, delta, active, onPress}: PriorityChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{selected: active}}
      className={cn(
        'flex-1 rounded-md p-3 border items-center gap-1',
        active
          ? 'bg-bg-surface-3 border-accent-transparent'
          : 'bg-bg-surface-1 border-bg-surface-3 active:bg-bg-surface-2',
      )}>
      <Text
        variant="body-sm"
        className={cn(
          'font-geist-semibold',
          active ? 'text-fg-primary' : 'text-fg-secondary',
        )}>
        {label}
      </Text>
      <Text variant="caption" numeral className="text-fg-tertiary">
        {eta}
      </Text>
      <Text variant="caption" numeral className="text-fg-tertiary">
        {delta}
      </Text>
    </Pressable>
  );
}
