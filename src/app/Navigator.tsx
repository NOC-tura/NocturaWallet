import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp, NativeStackScreenProps} from '@react-navigation/native-stack';
import {DashboardScreen} from '../screens/dashboard/DashboardScreen';
import {SendScreen as SendScreenImpl} from '../screens/transparent/SendScreen';
import {TxSimulateScreen} from '../screens/transparent/TxSimulateScreen';
import {TxConfirmScreen} from '../screens/transparent/TxConfirmScreen';
import {TransactionStatusScreen} from '../screens/transparent/TransactionStatusScreen';
import {SplashScreen} from '../screens/SplashScreen';
import {UnlockScreen} from '../screens/UnlockScreen';
import {WelcomeScreen} from '../screens/onboarding/WelcomeScreen';
import {SecurityIntroScreen} from '../screens/onboarding/SecurityIntroScreen';
import {CreateWalletScreen} from '../screens/onboarding/CreateWalletScreen';
import {SeedPhraseScreen} from '../screens/onboarding/SeedPhraseScreen';
import {ConfirmSeedScreen} from '../screens/onboarding/ConfirmSeedScreen';
import {ImportSeedScreen} from '../screens/onboarding/ImportSeedScreen';
import {SelectAccountScreen} from '../screens/onboarding/SelectAccountScreen';
import {SyncWalletScreen} from '../screens/onboarding/SyncWalletScreen';
import {SetPinScreen} from '../screens/onboarding/SetPinScreen';
import {BiometricSetupScreen} from '../screens/onboarding/BiometricSetupScreen';
import {SuccessScreen} from '../screens/onboarding/SuccessScreen';
import {PresaleScreen} from '../screens/PresaleScreen';
import {PresaleBuyConfirmScreen} from '../screens/presale/PresaleBuyConfirmScreen';
import {PresaleBuyStatusScreen} from '../screens/presale/PresaleBuyStatusScreen';
import {ShieldedExplainerScreen} from '../screens/shielded/ShieldedExplainerScreen';
import {ZkProofScreen} from '../screens/shielded/ZkProofScreen';
import {ShieldSimulateScreen} from '../screens/shielded/ShieldSimulateScreen';
import {ShieldConfirmScreen} from '../screens/shielded/ShieldConfirmScreen';
import {ShieldStatusScreen} from '../screens/shielded/ShieldStatusScreen';
import {UnshieldRunScreen} from '../screens/shielded/unshield/UnshieldRunScreen';
import {formatTokenAmount} from '../utils/parseTokenAmount';
import {A0_DEPOSIT_FEE_LAMPORTS, A0_RHO_MARKER_RENT_LAMPORTS} from '../modules/shielded/a0/screenSupport';
import type {ShieldIntent} from '../types/shield';
import {StakingScreen} from '../screens/staking/StakingScreen';
import {OnboardingProvider, useOnboarding} from '../contexts/OnboardingContext';
import {useWalletStore} from '../store/zustand/walletStore';
import {ReceiveScreen} from '../screens/transparent/ReceiveScreen';
import {TransactionHistoryScreen as TransactionHistoryScreenImpl} from '../screens/transparent/TransactionHistoryScreen';
import {TransactionDetailScreen as TransactionDetailScreenImpl} from '../screens/transparent/TransactionDetailScreen';
import {ReferralScreen as ReferralScreenImpl} from '../screens/referral/ReferralScreen';
import {GeoBlockedScreen as GeoBlockedScreenImpl} from '../screens/compliance/GeoBlockedScreen';
import {TokenDetailScreen} from '../screens/transparent/TokenDetailScreen';
import {isShieldedEnabled} from '../constants/features';
import {isPresaleEnabled} from '../constants/chain';
import type {
  RootStackParamList,
  OnboardingStackParamList,
  DashboardStackParamList,
  SendStackParamList,
  SettingsStackParamList,
  MainTabsParamList,
} from '../types/navigation';

// Screen placeholders (replaced in later implementation steps)
import {SettingsScreen} from '../screens/settings/SettingsScreen';
import {PinProbeScreen} from '../screens/debug/PinProbeScreen';
import {SecuritySettingsScreen} from '../screens/settings/SecuritySettingsScreen';
import {ChangePinScreen} from '../screens/settings/ChangePinScreen';
import {BackupSettingsScreen} from '../screens/settings/BackupSettingsScreen';
import {NotificationSettingsScreen} from '../screens/settings/NotificationSettingsScreen';
import {WipeWalletScreen} from '../screens/settings/WipeWalletScreen';
import {AppUpdateModal} from '../components/AppUpdateModal';
import {approveAuth, awaitUserAuth, cancelAuth} from '../modules/session/pendingAuth';
import {Home, PieChart, Grid3x3, User} from 'lucide-react-native';
import {PortfolioScreen} from '../screens/portfolio/PortfolioScreen';
import {NftsScreen} from '../screens/nfts/NftsScreen';
import {NotificationsScreen} from '../screens/notifications/NotificationsScreen';
import {ScanScreen} from '../screens/scan/ScanScreen';
import {AddressBookScreen} from '../screens/addressBook/AddressBookScreen';
import {selectContact, cancelContactSelection} from '../modules/session/pendingContactSelect';
import {ShieldUnshieldScreen} from '../screens/shielded/ShieldUnshieldScreen';
import {SwapScreen} from '../screens/transparent/SwapScreen';
import {Alert} from 'react-native';
import Config from 'react-native-config';

// Wrapper components that wire screens to navigation
function SplashScreenNav() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <SplashScreen
      onRouteResolved={route => {
        if (route === 'Unlock') {
          navigation.replace('Unlock', {reason: 'app_foreground'});
        } else {
          navigation.replace(route as 'Onboarding' | 'MainTabs');
        }
      }}
      onForceUpdate={result => {
        // A required update must take the user to the (non-dismissable) update
        // screen — NOT leave them stuck on the splash. Without this, an
        // update_required response was a silent no-op → frozen splash.
        navigation.replace('AppUpdateModal', {
          storeUrl: result.storeUrl ?? '',
          message: result.message,
        });
      }}
    />
  );
}

function UnlockScreenNav() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <UnlockScreen
      onUnlock={() => navigation.replace('MainTabs')}
      onRestore={() => navigation.replace('Onboarding')}
    />
  );
}

function UnlockSendScreenNav() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const raw = (route.params ?? {}) as Record<string, unknown>;
  const amount = typeof raw.amount === 'string' ? raw.amount : '0';
  const ticker = typeof raw.ticker === 'string' ? raw.ticker : 'SOL';
  const recipient = typeof raw.recipient === 'string' ? raw.recipient : '';
  const networkFee = typeof raw.networkFee === 'string' ? raw.networkFee : undefined;

  return (
    <UnlockScreen
      onUnlock={() => {
        approveAuth();
        navigation.goBack();
      }}
      onCancel={() => {
        cancelAuth();
        navigation.goBack();
      }}
      onRestore={() => {
        cancelAuth();
        navigation.replace('Onboarding');
      }}
      sendIntent={{amount, ticker, recipient, networkFee}}
    />
  );
}

// Onboarding screen wrappers — navigation wired in subsequent integration step
function WelcomeScreenNav() {
  const {setIsImport} = useOnboarding();
  const navigation = useNavigation<NativeStackNavigationProp<OnboardingStackParamList>>();
  return (
    <WelcomeScreen
      onCreate={() => {
        setIsImport(false);
        navigation.navigate('SecurityIntro');
      }}
      onImport={() => {
        setIsImport(true);
        navigation.navigate('SecurityIntro'); // Import also requires SecurityIntro (App Store compliance)
      }}
    />
  );
}

function SecurityIntroScreenNav() {
  const {isImport} = useOnboarding();
  const navigation = useNavigation<NativeStackNavigationProp<OnboardingStackParamList>>();
  return (
    <SecurityIntroScreen
      onContinue={() =>
        navigation.navigate(isImport ? 'ImportSeed' : 'CreateWallet')
      }
      onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
    />
  );
}

function CreateWalletScreenNav() {
  const {setMnemonic} = useOnboarding();
  const navigation = useNavigation<NativeStackNavigationProp<OnboardingStackParamList>>();
  return (
    <CreateWalletScreen
      onMnemonicGenerated={mnemonic => {
        setMnemonic(mnemonic);
        navigation.navigate('SeedPhrase');
      }}
    />
  );
}

function SeedPhraseScreenNav() {
  const {mnemonic} = useOnboarding();
  const navigation = useNavigation<NativeStackNavigationProp<OnboardingStackParamList>>();
  return (
    <SeedPhraseScreen
      mnemonic={mnemonic ?? ''}
      onConfirm={() => navigation.navigate('ConfirmSeed')}
    />
  );
}

function ConfirmSeedScreenNav() {
  const {mnemonic} = useOnboarding();
  const navigation = useNavigation<NativeStackNavigationProp<OnboardingStackParamList>>();
  return (
    <ConfirmSeedScreen
      mnemonic={mnemonic ?? ''}
      onSuccess={() => navigation.navigate('SyncWallet')}
      onBackToSeed={() => navigation.navigate('SeedPhrase')}
      onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
    />
  );
}

function ImportSeedScreenNav() {
  const {setMnemonic} = useOnboarding();
  const navigation = useNavigation<NativeStackNavigationProp<OnboardingStackParamList>>();
  return (
    <ImportSeedScreen
      onMnemonicValidated={mnemonic => {
        setMnemonic(mnemonic);
        navigation.navigate('SelectAccount');
      }}
      onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
    />
  );
}

function SelectAccountScreenNav() {
  const {mnemonic, setScheme} = useOnboarding();
  const navigation = useNavigation<NativeStackNavigationProp<OnboardingStackParamList>>();
  return (
    <SelectAccountScreen
      mnemonic={mnemonic ?? ''}
      onSelect={scheme => {
        setScheme(scheme);
        navigation.navigate('SyncWallet');
      }}
      onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
    />
  );
}

function SyncWalletScreenNav() {
  const {mnemonic, scheme} = useOnboarding();
  const navigation = useNavigation<NativeStackNavigationProp<OnboardingStackParamList>>();
  return (
    <SyncWalletScreen
      mnemonic={mnemonic ?? ''}
      scheme={scheme}
      onSyncComplete={() => navigation.navigate('SetPin')}
    />
  );
}

function SetPinScreenNav() {
  const navigation = useNavigation<NativeStackNavigationProp<OnboardingStackParamList>>();
  return (
    <SetPinScreen
      onPinSet={() => navigation.navigate('BiometricSetup')}
      onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
    />
  );
}

function BiometricSetupScreenNav() {
  const navigation = useNavigation<NativeStackNavigationProp<OnboardingStackParamList>>();
  return (
    <BiometricSetupScreen
      onEnable={() => navigation.navigate('Success')}
      onSkip={() => navigation.navigate('Success')}
      onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
    />
  );
}

function SuccessScreenNav() {
  const {mnemonic, scheme, clearMnemonic} = useOnboarding();
  const navigation = useNavigation<NativeStackNavigationProp<OnboardingStackParamList>>();
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <SuccessScreen
      mnemonic={mnemonic ?? ''}
      scheme={scheme}
      onComplete={() => {
        clearMnemonic();
        // Presale exists on mainnet only (S13): the devnet build goes straight to the wallet.
        if (isPresaleEnabled()) {
          navigation.navigate('Presale');
        } else {
          rootNavigation.replace('MainTabs');
        }
      }}
    />
  );
}

function PresaleScreenOnboarding() {
  // Use root navigator to escape OnboardingStack → MainTabs
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const goToMainTabs = () => rootNavigation.replace('MainTabs');
  return (
    <PresaleScreen
      isOnboarding
      onSkip={goToMainTabs}
      onComplete={goToMainTabs}
    />
  );
}

function DashboardScreenNav() {
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const dashNav = useNavigation<NativeStackNavigationProp<DashboardStackParamList>>();
  const tabNav = useNavigation();
  // Presale (and its Buy entry, banner and routes) exists on mainnet only (S13).
  const presale = isPresaleEnabled();
  return (
    <DashboardScreen
      // The shielded transfer is HIDDEN until its plan lands (spec §12): no route exists for it, and
      // the dashboard shows no Send action in shielded mode — Send is always the transparent send.
      onSend={() => rootNav.navigate('SendModal')}
      // Receive is the transparent address only: no valid shielded receive address exists until
      // M2 (I9), so the dashboard offers no Receive in shielded mode and this route has no
      // shielded variant.
      onReceive={() => rootNav.navigate('ReceiveModal')}
      onShield={() => {
        if (isShieldedEnabled()) {
          rootNav.navigate('ShieldUnshieldModal', {direction: 'private'});
        }
      }}
      // UX-A 7 (an owner-approved departure from the design's shielded dashboard): "Make public" opens
      // #16 on the unshield side. Passed only where that route is registered (the same gate as the
      // route itself); in-app navigation creates a route with no link `path`, so #16's I-1 guard
      // honours `direction: 'public'` here and still refuses it from a deep link.
      onMakePublic={
        isShieldedEnabled() ? () => rootNav.navigate('ShieldUnshieldModal', {direction: 'public'}) : undefined
      }
      onSwap={() => rootNav.navigate('SwapModal')}
      onBuy={presale ? () => dashNav.navigate('Presale') : undefined}
      onScan={() => rootNav.navigate('ScanModal')}
      onNotifications={() => rootNav.navigate('NotificationsModal')}
      onProfileTap={() => tabNav.getParent()?.navigate('ProfileTab' as never)}
      onPresale={presale ? () => dashNav.navigate('Presale') : undefined}
      onFirstShieldedToggle={() => {
        if (isShieldedEnabled()) {
          rootNav.navigate('ShieldedExplainer');
        }
      }}
      onTokenTap={mint => rootNav.navigate('TokenDetailModal', {mint})}
    />
  );
}

function ScanScreenNav() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return <ScanScreen onBack={() => navigation.goBack()} />;
}

function NotificationsScreenNav() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return <NotificationsScreen onBack={() => navigation.goBack()} />;
}

// #16 — both sides (M1c Task 8). `direction: 'public'` opens the unshield side ONLY on a route
// that in-app navigation created: React Navigation copies a deep link's query into the params and
// marks such a route with the `path` it came from, so a linked route always opens "Make private"
// (fix round 1, I-1; deepLinkConfig also pins the param). Each focus bumps `focusKey`: the unshield
// CTA, disabled on tap, is enabled again when the user comes back.
function ShieldUnshieldScreenNav({navigation, route}: NativeStackScreenProps<RootStackParamList, 'ShieldUnshieldModal'>) {
  const [focusKey, setFocusKey] = React.useState(0);
  React.useEffect(() => navigation.addListener('focus', () => setFocusKey(k => k + 1)), [navigation]);
  const fromInsideTheApp = route.path === undefined;
  return (
    <ShieldUnshieldScreen
      initialDirection={fromInsideTheApp && route.params?.direction === 'public' ? 'public' : 'private'}
      focusKey={focusKey}
      onBack={() => navigation.goBack()}
      onShield={amount => navigation.navigate('ZkProofModal', {amount})}
      onUnshield={r => navigation.navigate('UnshieldRun', r)}
    />
  );
}

function AddressBookScreenNav() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <AddressBookScreen
      onBack={() => {
        // Cancel any pending contact selection on backwards dismiss
        cancelContactSelection();
        navigation.goBack();
      }}
      onSelect={contact => {
        selectContact(contact);
        navigation.goBack();
      }}
      onAddContact={() => {
        // Add-contact sheet is deferred per design baseline — show guidance.
        Alert.alert(
          'Add contact',
          'Contact creation flow is coming. For now, send to an address — Noctura will offer to save it after the transaction confirms.',
          [{text: 'OK'}],
        );
      }}
    />
  );
}

function StakingScreenNav() {
  return <StakingScreen />;
}

// #13 Receive — the TRANSPARENT address only, whatever the params say (a stale or deep-linked
// `shielded` is ignored). The shielded option is hidden until M2 (spec §11 "Deferred", §12 I9):
// no valid A0 receive address exists yet, and the v1 noc1… address it used to show is gone.
function ReceiveScreenNav() {
  const publicKey = useWalletStore().publicKey;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {mmkvPublic} = require('../store/mmkv/instances');
  const {MMKV_KEYS} = require('../constants/mmkvKeys');
  // Prefer walletStore, fall back to mmkvPublic if zustand hasn't hydrated the publicKey yet
  // (e.g., cold launch into a Receive deeplink).
  const address = publicKey ?? mmkvPublic.getString(MMKV_KEYS.WALLET_PUBLIC_KEY) ?? '';
  return <ReceiveScreen address={address} onBack={() => navigation.goBack()} />;
}

function TokenDetailScreenNav() {
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'TokenDetailModal'>>();
  return (
    <TokenDetailScreen
      mint={route.params.mint}
      onBack={() => rootNav.goBack()}
      onSend={mint => rootNav.navigate('SendModal', {initialMint: mint})}
      onReceive={() => rootNav.navigate('ReceiveModal')}
      onSwap={mint => rootNav.navigate('SwapModal', {initialFromMint: mint})}
    />
  );
}

function SwapScreenNav() {
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'SwapModal'>>();
  return (
    <SwapScreen
      initialFromMint={route.params?.initialFromMint}
      onBack={() => rootNav.goBack()}
      onDone={() => rootNav.goBack()}
    />
  );
}

function PresaleScreenDashboard() {
  return <PresaleScreen onSkip={() => {}} onComplete={() => {}} />;
}

function PresaleBuyConfirmNav() {
  const navigation = useNavigation<NativeStackNavigationProp<DashboardStackParamList>>();
  const route = useRoute<RouteProp<DashboardStackParamList, 'PresaleBuyConfirm'>>();
  const {paymentToken, amountBaseUnits} = route.params;
  return (
    <PresaleBuyConfirmScreen
      paymentToken={paymentToken}
      amountBaseUnits={amountBaseUnits}
      onAuthorized={() =>
        navigation.navigate('PresaleBuyStatus', {paymentToken, amountBaseUnits})
      }
      onCancel={() => navigation.goBack()}
    />
  );
}

function PresaleBuyStatusNav() {
  const navigation = useNavigation<NativeStackNavigationProp<DashboardStackParamList>>();
  const route = useRoute<RouteProp<DashboardStackParamList, 'PresaleBuyStatus'>>();
  const {paymentToken, amountBaseUnits} = route.params;
  return (
    <PresaleBuyStatusScreen
      paymentToken={paymentToken}
      amountBaseUnits={amountBaseUnits}
      onDashboard={() => navigation.navigate('Dashboard')}
      // TransactionDetail is not in DashboardStackParamList; the screen falls
      // back to Linking.openURL(explorerUrl) when onViewDetails is undefined.
      onViewDetails={undefined}
    />
  );
}

function ShieldedExplainerScreenNav(
  props: NativeStackScreenProps<RootStackParamList, 'ShieldedExplainer'>,
) {
  return <ShieldedExplainerScreen {...props} />;
}

// #18 → #19 → #20 → #21 for the A0 deposit (the ShieldIntent chain; types/shield.ts).
function ZkProofScreenNav({navigation, route}: NativeStackScreenProps<RootStackParamList, 'ZkProofModal'>) {
  const onReady = React.useCallback(
    (intent: ShieldIntent) => navigation.replace('ShieldSimulate', {intent}),
    [navigation],
  );
  return <ZkProofScreen amount={route.params.amount} onReady={onReady} onCancel={() => navigation.goBack()} />;
}

function ShieldSimulateScreenNav({navigation, route}: NativeStackScreenProps<RootStackParamList, 'ShieldSimulate'>) {
  return (
    <ShieldSimulateScreen
      intent={route.params.intent}
      onContinue={intent => navigation.navigate('ShieldConfirm', {intent})}
      onCancel={() => navigation.goBack()}
    />
  );
}

function ShieldConfirmScreenNav({navigation, route}: NativeStackScreenProps<RootStackParamList, 'ShieldConfirm'>) {
  return (
    <ShieldConfirmScreen
      intent={route.params.intent}
      requestAuth={intent => {
        // The existing re-auth (#10): open UnlockSend BEFORE awaiting, as TxConfirmScreen does.
        const auth = awaitUserAuth();
        navigation.navigate('UnlockSend', {
          amount: formatTokenAmount(BigInt(intent.amount), intent.decimals),
          ticker: intent.tokenSymbol,
          recipient: 'Pool',
          networkFee: `${formatTokenAmount(A0_DEPOSIT_FEE_LAMPORTS + A0_RHO_MARKER_RENT_LAMPORTS, 9)} SOL`,
        });
        return auth;
      }}
      onAuthorized={intent => navigation.replace('ShieldStatus', {intent})}
      onCancel={() => navigation.goBack()}
    />
  );
}

function ShieldStatusScreenNav({navigation, route}: NativeStackScreenProps<RootStackParamList, 'ShieldStatus'>) {
  return (
    <ShieldStatusScreen
      intent={route.params.intent}
      onDone={() => navigation.navigate('MainTabs', {screen: 'HomeTab'} as never)}
    />
  );
}

// #18 → #21 for the A0 unshield: one screen owns the one unshieldA0 call (M1c Task 8).
function UnshieldRunScreenNav({navigation, route}: NativeStackScreenProps<RootStackParamList, 'UnshieldRun'>) {
  return (
    <UnshieldRunScreen
      request={route.params}
      onDone={() => navigation.navigate('MainTabs', {screen: 'HomeTab'} as never)}
      onBack={() => navigation.goBack()}
    />
  );
}

function SendScreenNav() {
  const navigation = useNavigation<NativeStackNavigationProp<SendStackParamList>>();
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<SendStackParamList, 'Send'>>();
  return (
    <SendScreenImpl
      onReview={intent => navigation.navigate('TxSimulate', {intent})}
      onBack={() => rootNav.goBack()}
      initialMint={route.params?.initialMint}
    />
  );
}

function TxSimulateScreenNav() {
  const navigation = useNavigation<NativeStackNavigationProp<SendStackParamList>>();
  const route = useRoute<RouteProp<SendStackParamList, 'TxSimulate'>>();
  return (
    <TxSimulateScreen
      intent={route.params.intent}
      onContinue={intent => navigation.navigate('TxConfirm', {intent})}
      onCancel={() => navigation.goBack()}
    />
  );
}

function TxConfirmScreenNav() {
  const navigation = useNavigation<NativeStackNavigationProp<SendStackParamList>>();
  const route = useRoute<RouteProp<SendStackParamList, 'TxConfirm'>>();
  return (
    <TxConfirmScreen
      intent={route.params.intent}
      onBroadcast={intent => navigation.navigate('TransactionStatus', {intent})}
      onCancel={() => navigation.goBack()}
    />
  );
}

function TransactionStatusScreenNav() {
  const route = useRoute<RouteProp<SendStackParamList, 'TransactionStatus'>>();
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const sendNav = useNavigation<NativeStackNavigationProp<SendStackParamList>>();
  return (
    <TransactionStatusScreen
      intent={route.params.intent}
      onDashboard={() => {
        // Dismiss SendModal stack then ensure Home tab is active. Passing
        // {screen: 'HomeTab'} prevents landing on whichever tab was last
        // selected before the user opened Send.
        rootNav.navigate('MainTabs', {screen: 'HomeTab'} as never);
      }}
      onViewDetails={sig => {
        // Navigate to TransactionDetail if it exists in the SendStack
        sendNav.navigate('TransactionDetail', {signature: sig});
      }}
    />
  );
}

function TransactionHistoryScreenNav() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <TransactionHistoryScreenImpl
      onSelectTx={(signature: string) => {
        // Dismiss the modal first, then navigate into SendModal > TransactionDetail
        navigation.goBack();
        setTimeout(() => {
          navigation.navigate('SendModal', {
            screen: 'TransactionDetail',
            params: {signature},
          } as never);
        }, 100);
      }}
      onBack={() => navigation.goBack()}
    />
  );
}

function TransactionDetailScreenNav() {
  const navigation = useNavigation();
  const route = useRoute();
  const raw = (route.params ?? {}) as Record<string, unknown>;
  const signature = typeof raw.signature === 'string' ? raw.signature : '';
  return (
    <TransactionDetailScreenImpl
      signature={signature}
      onBack={() => navigation.goBack()}
    />
  );
}

function ReferralScreenNav() {
  const navigation = useNavigation();
  return (
    <ReferralScreenImpl
      onBack={() => navigation.goBack()}
    />
  );
}

function GeoBlockedNav() {
  const navigation = useNavigation<NativeStackNavigationProp<DashboardStackParamList>>();
  const route = useRoute<RouteProp<DashboardStackParamList, 'GeoBlocked'>>();
  return (
    <GeoBlockedScreenImpl
      countryCode={route.params?.countryCode}
      presaleBlocked={route.params?.presaleBlocked}
      onDismiss={() => navigation.goBack()}
      onClose={() => navigation.popToTop()}
    />
  );
}

function AppUpdateModalScreenNav() {
  const route = useRoute();
  const raw = (route.params ?? {}) as Record<string, unknown>;
  const storeUrl = typeof raw.storeUrl === 'string' ? raw.storeUrl : '';
  const message = typeof raw.message === 'string' ? raw.message : undefined;
  return <AppUpdateModal visible={true} storeUrl={storeUrl} message={message} />;
}

const defaultScreenOptions = {
  headerShown: false,
  animation: 'slide_from_right' as const,
  contentStyle: {backgroundColor: '#0C0C14'},
  gestureEnabled: true,
};

const modalScreenOptions = {
  presentation: 'modal' as const,
  animation: 'slide_from_bottom' as const,
  gestureEnabled: true,
  gestureDirection: 'vertical' as const,
  headerShown: false,
};


// Onboarding Stack
const OnboardingNav = createNativeStackNavigator<OnboardingStackParamList>();
function OnboardingStack() {
  return (
    <OnboardingProvider>
      <OnboardingNav.Navigator screenOptions={defaultScreenOptions}>
        <OnboardingNav.Screen name="Welcome" component={WelcomeScreenNav} />
        <OnboardingNav.Screen name="SecurityIntro" component={SecurityIntroScreenNav} />
        <OnboardingNav.Screen name="CreateWallet" component={CreateWalletScreenNav} />
        <OnboardingNav.Screen name="SeedPhrase" component={SeedPhraseScreenNav} />
        <OnboardingNav.Screen name="ConfirmSeed" component={ConfirmSeedScreenNav} />
        <OnboardingNav.Screen name="ImportSeed" component={ImportSeedScreenNav} />
        <OnboardingNav.Screen name="SelectAccount" component={SelectAccountScreenNav} />
        <OnboardingNav.Screen name="SyncWallet" component={SyncWalletScreenNav} />
        <OnboardingNav.Screen name="SetPin" component={SetPinScreenNav} />
        <OnboardingNav.Screen name="BiometricSetup" component={BiometricSetupScreenNav} />
        <OnboardingNav.Screen name="Success" component={SuccessScreenNav} />
        {isPresaleEnabled() ? (
          <OnboardingNav.Screen name="Presale" component={PresaleScreenOnboarding} />
        ) : null}
      </OnboardingNav.Navigator>
    </OnboardingProvider>
  );
}

// Dashboard Stack
const DashboardNav = createNativeStackNavigator<DashboardStackParamList>();
function DashboardStack() {
  return (
    <DashboardNav.Navigator screenOptions={defaultScreenOptions}>
      <DashboardNav.Screen name="Dashboard" component={DashboardScreenNav} />
      {/* The Phase 1 program's screens — presale, its purchase geo gate, staking — exist on
          mainnet only (S13): the ROUTES are gated, so the devnet build cannot reach them by name
          or by deep link (deepLinkConfig drops their paths too). */}
      {isPresaleEnabled() ? (
        <>
          <DashboardNav.Screen name="Presale" component={PresaleScreenDashboard} />
          <DashboardNav.Screen name="PresaleBuyConfirm" component={PresaleBuyConfirmNav} />
          <DashboardNav.Screen name="PresaleBuyStatus" component={PresaleBuyStatusNav} />
          <DashboardNav.Screen name="Staking" component={StakingScreenNav} />
          <DashboardNav.Screen name="GeoBlocked" component={GeoBlockedNav} />
        </>
      ) : null}
    </DashboardNav.Navigator>
  );
}

// Send Stack
const SendNav = createNativeStackNavigator<SendStackParamList>();
function SendStack() {
  const route = useRoute<RouteProp<RootStackParamList, 'SendModal'>>();
  return (
    <SendNav.Navigator screenOptions={defaultScreenOptions}>
      <SendNav.Screen
        name="Send"
        component={SendScreenNav}
        initialParams={{initialMint: route.params?.initialMint}}
      />
      <SendNav.Screen name="TxSimulate" component={TxSimulateScreenNav} />
      <SendNav.Screen name="TxConfirm" component={TxConfirmScreenNav} />
      <SendNav.Screen name="TransactionStatus" component={TransactionStatusScreenNav} />
      <SendNav.Screen name="TransactionDetail" component={TransactionDetailScreenNav} />
    </SendNav.Navigator>
  );
}

// Settings Stack
const SettingsNav = createNativeStackNavigator<SettingsStackParamList>();
function SettingsStack() {
  return (
    <SettingsNav.Navigator screenOptions={defaultScreenOptions}>
      <SettingsNav.Screen name="Settings" component={SettingsScreen} />
      {/* The presale referral (mainnet only, S13). */}
      {isPresaleEnabled() ? <SettingsNav.Screen name="Referral" component={ReferralScreenNav} /> : null}
      <SettingsNav.Screen name="SecuritySettings" component={SecuritySettingsScreen} />
      <SettingsNav.Screen name="ChangePin" component={ChangePinScreen} />
      <SettingsNav.Screen name="BackupSettings" component={BackupSettingsScreen} />
      <SettingsNav.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
      <SettingsNav.Screen name="WipeWallet" component={WipeWalletScreen} />
      {/* Dev-only: gate the ROUTE, not only the Settings row — a registered route
          stays navigable by name (and by deep link) even with its entry point hidden. */}
      {__DEV__ || Config.PIN_PROBE === 'true' ? (
        <SettingsNav.Screen name="PinProbe" component={PinProbeScreen} />
      ) : null}
    </SettingsNav.Navigator>
  );
}

// Main Tabs (4 tabs) · Phase 3 chrome · per /home/user/Downloads/index.html §s11
// Design baseline: Home · Portfolio · NFTs · Profile (NOT Home/Send/Receive/Settings).
// Send and Receive are now root-level modal routes triggered from Dashboard quick
// actions, not bottom-tab destinations. Settings lives inside ProfileTab.
//
// Visual: 80dp bar, bg-base background, bg-surface-2 hairline border-top,
// fg-tertiary inactive, accent-transparent (violet) active, 11px Geist labels.
const Tabs = createBottomTabNavigator<MainTabsParamList>();
function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0A0A0A',
          borderTopColor: '#17171A',
          borderTopWidth: 1,
          height: 80,
          paddingTop: 6,
          paddingBottom: 12,
        },
        tabBarActiveTintColor: '#B084FC',
        tabBarInactiveTintColor: '#6E727A',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}>
      <Tabs.Screen
        name="HomeTab"
        component={DashboardStack}
        options={{
          title: 'Home',
          tabBarIcon: ({color}) => <Home size={22} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="PortfolioTab"
        component={PortfolioScreen}
        options={{
          title: 'Portfolio',
          tabBarIcon: ({color}) => <PieChart size={22} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="NftsTab"
        component={NftsScreen}
        options={{
          title: 'NFTs',
          tabBarIcon: ({color}) => <Grid3x3 size={22} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="ProfileTab"
        component={SettingsStack}
        options={{
          title: 'Profile',
          tabBarIcon: ({color}) => <User size={22} color={color} strokeWidth={1.75} />,
        }}
      />
    </Tabs.Navigator>
  );
}

// Root Stack
const RootNav = createNativeStackNavigator<RootStackParamList>();
export function RootNavigator() {
  return (
    <RootNav.Navigator screenOptions={defaultScreenOptions}>
      <RootNav.Screen name="Splash" component={SplashScreenNav} />
      <RootNav.Screen name="Unlock" component={UnlockScreenNav} />
      <RootNav.Screen name="UnlockSend" component={UnlockSendScreenNav} options={modalScreenOptions} />
      <RootNav.Screen name="Onboarding" component={OnboardingStack} />
      <RootNav.Screen name="MainTabs" component={MainTabs} />
      <RootNav.Screen name="SendModal" component={SendStack} options={modalScreenOptions} />
      <RootNav.Screen name="ReceiveModal" component={ReceiveScreenNav} options={modalScreenOptions} />
      <RootNav.Screen name="TokenDetailModal" component={TokenDetailScreenNav} options={modalScreenOptions} />
      <RootNav.Screen name="SwapModal" component={SwapScreenNav} options={modalScreenOptions} />
      <RootNav.Screen name="ScanModal" component={ScanScreenNav} options={modalScreenOptions} />
      <RootNav.Screen name="NotificationsModal" component={NotificationsScreenNav} options={modalScreenOptions} />
      <RootNav.Screen name="AddressBookModal" component={AddressBookScreenNav} options={modalScreenOptions} />
      <RootNav.Screen name="TransactionHistory" component={TransactionHistoryScreenNav} options={modalScreenOptions} />
      {/* Shielded (the devnet build only): #17, #16 (both sides), #18 → #21 for the A0 deposit, and
          the unshield run (#18 → #21 for the A0 unshield, M1c). The ROUTES are gated, not only their
          entry points: a route that is not registered cannot be reached by name or by deep link.
          Still hidden (spec §12): the shielded transfer — no route; the v1 ShieldedTransfer,
          ShieldedBalance and Deposit screens are gone. */}
      {isShieldedEnabled() ? (
        <>
          <RootNav.Screen name="ShieldedExplainer" component={ShieldedExplainerScreenNav} options={modalScreenOptions} />
          <RootNav.Screen name="ShieldUnshieldModal" component={ShieldUnshieldScreenNav} options={modalScreenOptions} />
          <RootNav.Screen
            name="ZkProofModal"
            component={ZkProofScreenNav}
            options={{...modalScreenOptions, gestureEnabled: false}}
          />
          <RootNav.Screen name="ShieldSimulate" component={ShieldSimulateScreenNav} options={modalScreenOptions} />
          <RootNav.Screen name="ShieldConfirm" component={ShieldConfirmScreenNav} options={modalScreenOptions} />
          <RootNav.Screen
            name="ShieldStatus"
            component={ShieldStatusScreenNav}
            options={{...modalScreenOptions, gestureEnabled: false}}
          />
          <RootNav.Screen
            name="UnshieldRun"
            component={UnshieldRunScreenNav}
            options={{...modalScreenOptions, gestureEnabled: false}}
          />
        </>
      ) : null}
      <RootNav.Screen name="AppUpdateModal" component={AppUpdateModalScreenNav} options={{...modalScreenOptions, gestureEnabled: false}} />
    </RootNav.Navigator>
  );
}
