import React from 'react';
import {View, Image} from 'react-native';
import {Text} from './ui';

const SOLANA_LOGO = require('../assets/tokens/solana-sol-logo.png');
const NOC_LOGO = require('../assets/tokens/noc-logo.png');
const USDC_LOGO = require('../assets/tokens/usdc-logo.png');
const USDT_LOGO = require('../assets/tokens/usdt-logo.png');

export interface TokenLogoProps {
  symbol: string;
  isNoc: boolean;
  logoUri?: string;
}

export function TokenLogo({symbol, isNoc, logoUri}: TokenLogoProps) {
  const [failed, setFailed] = React.useState(false);

  if (symbol === 'SOL') {
    return (
      <View className="w-10 h-10 rounded-pill items-center justify-center bg-bg-surface-2 overflow-hidden">
        <Image
          source={SOLANA_LOGO}
          style={{width: 22, height: 22}}
          resizeMode="contain"
          accessibilityLabel="Solana logo"
        />
      </View>
    );
  }
  if (isNoc) {
    return (
      <View className="w-10 h-10 rounded-pill items-center justify-center bg-bg-surface-2 overflow-hidden">
        <Image
          source={NOC_LOGO}
          style={{width: 28, height: 28}}
          resizeMode="contain"
          accessibilityLabel="Noctura logo"
        />
      </View>
    );
  }
  if (symbol === 'USDC') {
    return (
      <View className="w-10 h-10 rounded-pill items-center justify-center bg-bg-surface-2 overflow-hidden">
        <Image
          source={USDC_LOGO}
          style={{width: 26, height: 26}}
          resizeMode="contain"
          accessibilityLabel="USD Coin logo"
        />
      </View>
    );
  }
  if (symbol === 'USDT') {
    return (
      <View className="w-10 h-10 rounded-pill items-center justify-center bg-bg-surface-2 overflow-hidden">
        <Image
          source={USDT_LOGO}
          style={{width: 26, height: 26}}
          resizeMode="contain"
          accessibilityLabel="Tether USD logo"
        />
      </View>
    );
  }
  if (logoUri && !failed) {
    return (
      <View className="w-10 h-10 rounded-pill items-center justify-center bg-bg-surface-2 overflow-hidden">
        <Image
          source={{uri: logoUri}}
          style={{width: 40, height: 40}}
          resizeMode="cover"
          onError={() => setFailed(true)}
          accessibilityLabel={`${symbol} logo`}
        />
      </View>
    );
  }

  // BONK and other SPL tokens — use the first letter
  return (
    <View className="w-10 h-10 rounded-pill items-center justify-center bg-bg-surface-2">
      <Text
        variant="body-sm"
        numberOfLines={1}
        className="font-geist-semibold text-fg-primary">
        {symbol.charAt(0)}
      </Text>
    </View>
  );
}
