import React, {useCallback, useEffect, useRef, useState} from 'react';
import {View, Pressable, ScrollView, ActivityIndicator} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ArrowLeft, Check, Wallet} from 'lucide-react-native';
import {Text, Button, Card} from '../../components/ui';
import {ScreenSecurityManager} from '../../modules/screenSecurity/screenSecurityModule';
import {mnemonicToSeed} from '../../modules/keyDerivation/mnemonicUtils';
import {
  detectFundedAccounts,
  type AccountCandidate,
} from '../../modules/keyDerivation/accountDetection';
import {
  schemeLabel,
  schemeToString,
  DEFAULT_TRANSPARENT_SCHEME,
  type TransparentScheme,
} from '../../modules/keyDerivation/transparent';
import {zeroize} from '../../modules/session/zeroize';
import {formatAddress} from '../../utils/formatAddress';
import {formatTokenAmount} from '../../utils/parseTokenAmount';
import {cn} from '../../utils/cn';
import {
  ACCOUNT_BALANCES_UNCHECKED,
  ACCOUNT_CHECK_FAILED,
  ACCOUNT_DIFFERENT,
  ACCOUNT_FOUND,
  ACCOUNT_NONE_FUNDED,
} from '../../copy/modes';

/**
 * Import account picker. After the seed is validated, derive candidate
 * addresses (SLIP-0010 accounts 0-4 + the solana-keygen "cli" scheme), query
 * on-chain SOL + NOC balances, and let the user confirm the account to use.
 *
 * Shielded UX part B, decision B-6 (spec 2026-11-20 §4) — the smart choice:
 *   - exactly one funded → "We found your wallet", its address and balance,
 *     Continue, and "Use a different account" (the full list);
 *   - more than one funded → the funded ones only, plus the same link;
 *   - none funded (balances resolved) → standard account 0, "No funds found
 *     yet. You can receive to this address.", and the link;
 *   - a balance could not be read (the SOL RPC failed, a NOC lookup failed,
 *     detection threw, or no mnemonic) → the warning + Retry and the full
 *     list, with NOTHING selected: Continue stays disabled until the person
 *     taps an account (fix round 1, review I-1; spec §4 "never silently
 *     auto-picks").
 * It never picks silently: the account Continue uses is on screen before the
 * tap. The detection gained one flag (`nocResolved`, fix round 1, review I-2);
 * nothing else in it changed.
 *
 * Shown ONLY in the import flow. The create flow never visits this screen, so
 * new wallets keep the default standard scheme (SLIP-0010 account 0).
 *
 * FLAG_SECURE is enabled because candidate addresses are derived from the seed
 * held in memory while this screen is mounted.
 */
interface SelectAccountScreenProps {
  mnemonic: string;
  onSelect: (scheme: TransparentScheme) => void;
  onBack?: () => void;
}

export type AccountChoiceView = 'loading' | 'one' | 'funded' | 'none' | 'all';

/** decision B-6: which view the account choice shows. Pure. */
export function accountChoiceView(
  loading: boolean,
  detectFailed: boolean,
  showAll: boolean,
  candidates: readonly AccountCandidate[],
): AccountChoiceView {
  if (loading) return 'loading';
  if (detectFailed || showAll) return 'all';
  const funded = candidates.filter(c => c.funded).length;
  return funded === 1 ? 'one' : funded > 1 ? 'funded' : 'none';
}

const securityManager = new ScreenSecurityManager();
const SOL_DECIMALS = 9;
const NOC_DECIMALS = 9;

function balanceText(c: AccountCandidate): string {
  const noc = c.nocAmount > 0n ? ` · ${formatTokenAmount(c.nocAmount, NOC_DECIMALS)} NOC` : '';
  return `${formatTokenAmount(c.lamports, SOL_DECIMALS)} SOL${noc}`;
}

export function SelectAccountScreen({
  mnemonic,
  onSelect,
  onBack,
}: SelectAccountScreenProps) {
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<AccountCandidate[]>([]);
  const [detectFailed, setDetectFailed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  // null = nothing chosen: Continue is disabled (review I-1). Written only together with the ref.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selectedSchemeRef = useRef<TransparentScheme | null>(null);

  useEffect(() => {
    void securityManager.enableSecureScreen();
    return () => {
      void securityManager.disableSecureScreen();
    };
  }, []);

  const runDetection = useCallback(async () => {
    // A new run (Retry, or a changed mnemonic) starts from nothing: no stale
    // candidates and no stale pick (review M-7).
    setCandidates(prev => (prev.length === 0 ? prev : []));
    selectedSchemeRef.current = null;
    setSelectedKey(null);
    if (!mnemonic) {
      setDetectFailed(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setDetectFailed(false);
    setShowAll(false); // Review Focus 4: a Retry starts from the smart view again
    let seed: Uint8Array | undefined;
    try {
      seed = await mnemonicToSeed(mnemonic);
      const found = await detectFundedAccounts(seed);
      setCandidates(found.candidates);
      // A failed balance RPC (SOL, or any NOC lookup) still returns the
      // (locally-derived) addresses; flag it so the user sees the warning +
      // retry and chooses, rather than a silent wrong pick.
      const resolved = found.balancesResolved && found.nocResolved;
      setDetectFailed(!resolved);
      if (resolved) {
        // Pre-select the first funded candidate, else standard account 0 —
        // shown on screen by the smart view before Continue is tapped.
        const preferred =
          found.candidates.find(c => c.funded)?.scheme ??
          DEFAULT_TRANSPARENT_SCHEME;
        selectedSchemeRef.current = preferred;
        setSelectedKey(schemeToString(preferred));
      }
    } catch {
      setDetectFailed(true);
    } finally {
      // Zeroize the seed on EVERY path (success or throw) — it's sensitive.
      if (seed) {
        zeroize(seed);
      }
      setLoading(false);
    }
  }, [mnemonic]);

  useEffect(() => {
    void runDetection();
  }, [runDetection]);

  const handlePick = useCallback((scheme: TransparentScheme) => {
    selectedSchemeRef.current = scheme;
    setSelectedKey(schemeToString(scheme));
  }, []);

  const handleContinue = useCallback(() => {
    const scheme = selectedSchemeRef.current;
    if (scheme === null) return; // nothing chosen (the button is disabled too)
    onSelect(scheme);
  }, [onSelect]);

  const view = accountChoiceView(loading, detectFailed, showAll, candidates);
  const funded = candidates.filter(c => c.funded);
  const standard =
    candidates.find(c => schemeToString(c.scheme) === schemeToString(DEFAULT_TRANSPARENT_SCHEME)) ?? null;
  const listed = view === 'funded' ? funded : candidates;
  const different = (
    <Pressable
      onPress={() => setShowAll(true)}
      accessibilityRole="button"
      accessibilityLabel={ACCOUNT_DIFFERENT}
      testID="select-account-different"
      hitSlop={8}
      className="min-h-touch-min justify-center">
      <Text variant="body-sm" className="text-accent-transparent font-geist-semibold">
        {ACCOUNT_DIFFERENT}
      </Text>
    </Pressable>
  );

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      className="flex-1 bg-bg-base">
      {/* Top bar */}
      <View className="flex-row items-center px-4 py-3 min-h-touch-min">
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="w-12 h-12 items-center justify-center -ml-2">
            <ArrowLeft size={22} color="#A8ACB5" strokeWidth={1.75} />
          </Pressable>
        ) : (
          <View className="w-12 h-12" />
        )}
        <Text variant="h2" accessibilityRole="header" className="ml-1 flex-1">
          Choose account
        </Text>
      </View>

      <ScrollView
        contentContainerClassName="flex-grow pb-4"
        showsVerticalScrollIndicator={false}>
        {view === 'loading' ? (
          <View className="px-5 py-10 items-center gap-3">
            <ActivityIndicator size="small" color="#B084FC" />
            <Text variant="body-sm" className="text-fg-tertiary">
              Looking for your accounts…
            </Text>
          </View>
        ) : view === 'one' ? (
          <View className="px-5 gap-3" testID="select-account-found">
            <Text variant="h3">{ACCOUNT_FOUND}</Text>
            <Card padding="p-4">
              <Text variant="body" className="text-fg-primary">
                {schemeLabel(funded[0]!.scheme)}
              </Text>
              <Text variant="caption" mono className="text-fg-tertiary mt-0.5" testID="select-account-found-address">
                {formatAddress(funded[0]!.address)}
              </Text>
              <Text variant="caption" className="text-fg-secondary mt-1" testID="select-account-found-balance">
                {balanceText(funded[0]!)}
              </Text>
            </Card>
            {different}
          </View>
        ) : view === 'none' ? (
          <View className="px-5 gap-3" testID="select-account-none">
            <Text variant="body" className="text-fg-primary">
              {ACCOUNT_NONE_FUNDED}
            </Text>
            {standard ? (
              <Card padding="p-4">
                <Text variant="body" className="text-fg-primary">
                  {schemeLabel(standard.scheme)}
                </Text>
                {/* the full address: the person is asked to receive to it (review M-4) */}
                <Text variant="caption" mono className="text-fg-tertiary mt-0.5" testID="select-account-none-address">
                  {standard.address}
                </Text>
              </Card>
            ) : null}
            {different}
          </View>
        ) : (
          <>
            {/* Final review M-1: the intro says the balances were checked, so only when they were. */}
            {!detectFailed ? (
              <View className="px-5 mb-4">
                <Text variant="body" className="text-fg-secondary">
                  We checked this recovery phrase for on-chain balances. Pick the
                  account you want to use.
                </Text>
              </View>
            ) : null}
            <View className="px-5 gap-2">
              {detectFailed ? (
                <View className="mb-2 p-4 rounded-md bg-bg-surface-2 border-l-2 border-l-warning gap-3">
                  <Text variant="body-sm" className="text-fg-primary">
                    {/* Final review M-2: no candidates (detection threw, or no phrase) → nothing to pick */}
                    {candidates.length === 0 ? ACCOUNT_CHECK_FAILED : ACCOUNT_BALANCES_UNCHECKED}
                  </Text>
                  <Button
                    label="Try again"
                    variant="secondary"
                    onPress={() => void runDetection()}
                    testID="select-account-retry"
                  />
                </View>
              ) : null}

              {listed.map(c => (
                <CandidateCard
                  key={schemeToString(c.scheme)}
                  candidate={c}
                  selected={schemeToString(c.scheme) === selectedKey}
                  balanceKnown={!detectFailed}
                  onPick={handlePick}
                />
              ))}
              {view === 'funded' ? different : null}
            </View>
          </>
        )}

        <View className="flex-1" />
      </ScrollView>

      {/* Sticky CTA */}
      <View className="px-6 pb-8 pt-2">
        <Button
          label="Continue"
          variant="primary"
          onPress={handleContinue}
          disabled={loading || selectedKey === null}
          testID="select-account-continue"
        />
      </View>
    </SafeAreaView>
  );
}

function CandidateCard({
  candidate: c,
  selected,
  balanceKnown,
  onPick,
}: {
  candidate: AccountCandidate;
  selected: boolean;
  balanceKnown: boolean;
  onPick: (scheme: TransparentScheme) => void;
}) {
  const key = schemeToString(c.scheme);
  return (
    <Pressable
      onPress={() => onPick(c.scheme)}
      accessibilityRole="radio"
      accessibilityState={{selected}}
      testID={`account-candidate-${key}`}>
      <Card padding="p-4">
        <View className="flex-row items-center gap-3">
          <View
            className={cn(
              'w-10 h-10 rounded-full items-center justify-center',
              selected ? 'bg-[rgba(176,132,252,0.18)]' : 'bg-bg-surface-2',
            )}>
            {selected ? (
              <Check size={20} color="#B084FC" strokeWidth={2.25} />
            ) : (
              <Wallet size={18} color="#A8ACB5" strokeWidth={1.75} />
            )}
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text variant="body" className="text-fg-primary">
                {schemeLabel(c.scheme)}
              </Text>
              {c.funded ? (
                <View className="px-2 py-0.5 rounded-pill bg-[rgba(63,214,139,0.16)]">
                  <Text variant="caption" className="text-success">
                    Funded
                  </Text>
                </View>
              ) : null}
            </View>
            <Text variant="caption" mono className="text-fg-tertiary mt-0.5">
              {formatAddress(c.address)}
            </Text>
            {balanceKnown ? (
              <Text variant="caption" className="text-fg-secondary mt-1">
                {balanceText(c)}
              </Text>
            ) : (
              <Text variant="caption" className="text-fg-tertiary mt-1">
                Balance unavailable
              </Text>
            )}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
