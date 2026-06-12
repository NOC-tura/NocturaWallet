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

/**
 * Import account picker. After the seed is validated, derive candidate
 * addresses (SLIP-0010 accounts 0-4 + the solana-keygen "cli" scheme), query
 * on-chain SOL + NOC balances, and let the user select the funded account.
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

const securityManager = new ScreenSecurityManager();
const SOL_DECIMALS = 9;
const NOC_DECIMALS = 9;

export function SelectAccountScreen({
  mnemonic,
  onSelect,
  onBack,
}: SelectAccountScreenProps) {
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<AccountCandidate[]>([]);
  const [detectFailed, setDetectFailed] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string>(
    schemeToString(DEFAULT_TRANSPARENT_SCHEME),
  );
  const selectedSchemeRef = useRef<TransparentScheme>(DEFAULT_TRANSPARENT_SCHEME);

  useEffect(() => {
    void securityManager.enableSecureScreen();
    return () => {
      void securityManager.disableSecureScreen();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!mnemonic) {
        setDetectFailed(true);
        setLoading(false);
        return;
      }
      try {
        const seed = await mnemonicToSeed(mnemonic);
        const found = await detectFundedAccounts(seed);
        zeroize(seed);
        if (cancelled) return;
        setCandidates(found);
        // Pre-select the first funded candidate, else standard account 0.
        const preferred =
          found.find(c => c.funded)?.scheme ?? DEFAULT_TRANSPARENT_SCHEME;
        selectedSchemeRef.current = preferred;
        setSelectedKey(schemeToString(preferred));
      } catch {
        if (!cancelled) setDetectFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [mnemonic]);

  const handlePick = useCallback((scheme: TransparentScheme) => {
    selectedSchemeRef.current = scheme;
    setSelectedKey(schemeToString(scheme));
  }, []);

  const handleContinue = useCallback(() => {
    onSelect(selectedSchemeRef.current);
  }, [onSelect]);

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
        <Text variant="h2" className="ml-1 flex-1">
          Choose account
        </Text>
      </View>

      <ScrollView
        contentContainerClassName="flex-grow pb-4"
        showsVerticalScrollIndicator={false}>
        <View className="px-5 mb-4">
          <Text variant="body" className="text-fg-secondary">
            We checked this recovery phrase for on-chain balances. Pick the
            account you want to use.
          </Text>
        </View>

        {loading ? (
          <View className="px-5 py-10 items-center gap-3">
            <ActivityIndicator size="small" color="#B084FC" />
            <Text variant="body-sm" className="text-fg-tertiary">
              Looking for your accounts…
            </Text>
          </View>
        ) : (
          <View className="px-5 gap-2">
            {detectFailed ? (
              <View className="mb-2 p-4 rounded-md bg-bg-surface-2 border-l-2 border-l-warning">
                <Text variant="body-sm" className="text-fg-primary">
                  Couldn't check balances right now. You can continue with the
                  standard account and switch later.
                </Text>
              </View>
            ) : null}

            {candidates.map(c => {
              const key = schemeToString(c.scheme);
              const selected = key === selectedKey;
              return (
                <Pressable
                  key={key}
                  onPress={() => handlePick(c.scheme)}
                  accessibilityRole="button"
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
                        <Text
                          variant="caption"
                          mono
                          className="text-fg-tertiary mt-0.5">
                          {formatAddress(c.address)}
                        </Text>
                        {!detectFailed ? (
                          <Text
                            variant="caption"
                            className="text-fg-secondary mt-1">
                            {formatTokenAmount(c.lamports, SOL_DECIMALS)} SOL
                            {c.nocAmount > 0n
                              ? ` · ${formatTokenAmount(c.nocAmount, NOC_DECIMALS)} NOC`
                              : ''}
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
            })}
          </View>
        )}

        <View className="flex-1" />
      </ScrollView>

      {/* Sticky CTA */}
      <View className="px-6 pb-8 pt-2">
        <Button
          label="Continue"
          variant="primary"
          onPress={handleContinue}
          disabled={loading}
          testID="select-account-continue"
        />
      </View>
    </SafeAreaView>
  );
}
