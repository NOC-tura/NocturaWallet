import React from 'react';
import {Modal, View, Pressable, ScrollView} from 'react-native';
import {Check} from 'lucide-react-native';
import {Text} from './ui';
import {TokenLogo} from './TokenLogo';
import {formatBalanceForDisplay} from '../utils/parseTokenAmount';
import {NOC_MINT} from '../constants/programs';

export interface PickerToken {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
}

interface TokenPickerSheetProps {
  visible: boolean;
  title: string;
  tokens: readonly PickerToken[];
  selectedMint: string;
  balances: Record<string, string>;
  onSelect: (mint: string) => void;
  onClose: () => void;
}

/**
 * Bottom-sheet token picker (replaces the native Alert.alert pickers). A row
 * per token: logo + symbol + name + balance, with a check on the selected one.
 */
export function TokenPickerSheet({
  visible,
  title,
  tokens,
  selectedMint,
  balances,
  onSelect,
  onClose,
}: TokenPickerSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        className="flex-1 bg-black/60 justify-end"
        onPress={onClose}
        accessibilityLabel="Close token picker">
        {/* Inner press stops the backdrop tap from closing when tapping the sheet. */}
        <Pressable onPress={() => {}} className="bg-bg-surface-1 rounded-t-2xl pt-2 pb-8">
          <View className="items-center py-2">
            <View className="w-10 h-1 rounded-pill bg-fg-tertiary" />
          </View>
          <Text variant="overline" className="text-fg-secondary px-5 pt-1 pb-2">
            {title}
          </Text>
          <ScrollView style={{maxHeight: 384}}>
            {tokens.length === 0 ? (
              <Text variant="body-sm" className="text-fg-tertiary px-5 py-4">
                No tokens
              </Text>
            ) : (
              tokens.map(t => (
                <Pressable
                  key={t.mint}
                  onPress={() => onSelect(t.mint)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${t.symbol}`}
                  className="flex-row items-center px-5 py-3 active:bg-bg-surface-2"
                  style={{minHeight: 56}}>
                  <TokenLogo symbol={t.symbol} isNoc={t.mint === NOC_MINT} />
                  <View className="flex-1 ml-3">
                    <Text variant="body-lg" className="text-fg-primary">
                      {t.symbol}
                    </Text>
                    <Text variant="body-sm" className="text-fg-secondary">
                      {t.name}
                    </Text>
                  </View>
                  <Text variant="body-sm" numeral className="text-fg-secondary mr-2">
                    {formatBalanceForDisplay(balances[t.mint] ?? '0', t.decimals)}
                  </Text>
                  {t.mint === selectedMint ? <Check size={18} color="#B084FC" /> : null}
                </Pressable>
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
