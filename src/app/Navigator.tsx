import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {makePlaceholder} from '../screens/PlaceholderScreen';
import {DashboardScreen} from '../screens/dashboard/DashboardScreen';
import {SendScreen as SendScreenImpl} from '../screens/transparent/SendScreen';
import {TransactionStatusScreen} from '../screens/transparent/TransactionStatusScreen';
import {SplashScreen} from '../screens/SplashScreen';
import {UnlockScreen} from '../screens/UnlockScreen';
import {WelcomeScreen} from '../screens/onboarding/WelcomeScreen';
import {SecurityIntroScreen} from '../screens/onboarding/SecurityIntroScreen';
import {CreateWalletScreen} from '../screens/onboarding/CreateWalletScreen';
import {SeedPhraseScreen} from '../screens/onboarding/SeedPhraseScreen';
import {ConfirmSeedScreen} from '../screens/onboarding/ConfirmSeedScreen';
import {ImportSeedScreen} from '../screens/onboarding/ImportSeedScreen';
import {SyncWalletScreen} from '../screens/onboarding/SyncWalletScreen';
import {SetPinScreen} from '../screens/onboarding/SetPinScreen';
import {BiometricSetupScreen} from '../screens/onboarding/BiometricSetupScreen';
import {SuccessScreen} from '../screens/onboarding/SuccessScreen';
import {PresaleScreen} from '../screens/PresaleScreen';
import {PrivacyExplainerScreen} from '../screens/PrivacyExplainerScreen';
import {StakingScreen} from '../screens/staking/StakingScreen';
import {OnboardingProvider, useOnboarding} from '../contexts/OnboardingContext';
import {useWalletStore} from '../store/zustand/walletStore';
import {ReceiveScreen} from '../screens/transparent/ReceiveScreen';
import {TransactionHistoryScreen as TransactionHistoryScreenImpl} from '../screens/transparent/TransactionHistoryScreen';
import {TransactionDetailScreen as TransactionDetailScreenImpl} from '../screens/transparent/TransactionDetailScreen';
import {ReferralScreen as ReferralScreenImpl} from '../screens/referral/ReferralScreen';
import type {
  RootStackParamList,
  OnboardingStackParamList,
  DashboardStackParamList,
  SendStackParamList,
  SettingsStackParamList,
  MainTabsParamList,
} from '../types/navigation';

// Screen placeholders (replaced in later implementation steps)
const SettingsScreen = makePlaceholder('Settings');
const SecuritySettingsScreen = makePlaceholder('SecuritySettings');
const ChangePinScreen = makePlaceholder('ChangePin');
const ExportViewKeyScreen = makePlaceholder('ExportViewKey');
const BackupSettingsScreen = makePlaceholder('BackupSettings');
const NotificationSettingsScreen = makePlaceholder('NotificationSettings');
const WipeWalletScreen = makePlaceholder('WipeWallet');
const ShieldedBalanceScreen = makePlaceholder('ShieldedBalance');
import {DepositScreen} from '../screens/shielded/DepositScreen';
import {ShieldedTransferScreen} from '../screens/shielded/ShieldedTransferScreen';
import {WithdrawScreen} from '../screens/shielded/WithdrawScreen';
const AppUpdateModalScreen = makePlaceholder('AppUpdateModal');

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
        navigation.navigate('SyncWallet');
      }}
    />
  );
}

function SyncWalletScreenNav() {
  const {mnemonic} = useOnboarding();
  const navigation = useNavigation<NativeStackNavigationProp<OnboardingStackParamList>>();
  return (
    <SyncWalletScreen
      mnemonic={mnemonic ?? ''}
      onSyncComplete={() => navigation.navigate('SetPin')}
    />
  );
}

function SetPinScreenNav() {
  const navigation = useNavigation<NativeStackNavigationProp<OnboardingStackParamList>>();
  return <SetPinScreen onPinSet={() => navigation.navigate('BiometricSetup')} />;
}

function BiometricSetupScreenNav() {
  const navigation = useNavigation<NativeStackNavigationProp<OnboardingStackParamList>>();
  return (
    <BiometricSetupScreen
      onEnable={() => navigation.navigate('Success')}
      onSkip={() => navigation.navigate('Success')}
    />
  );
}

function SuccessScreenNav() {
  const {mnemonic, clearMnemonic} = useOnboarding();
  const navigation = useNavigation<NativeStackNavigationProp<OnboardingStackParamList>>();
  return (
    <SuccessScreen
      mnemonic={mnemonic ?? ''}
      onComplete={() => {
        clearMnemonic();
        navigation.navigate('Presale');
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
  return <DashboardScreen />;
}

function StakingScreenNav() {
  return <StakingScreen />;
}

function ReceiveScreenNav() {
  const publicKey = useWalletStore().publicKey;
  return <ReceiveScreen address={publicKey ?? ''} />;
}

function PresaleScreenDashboard() {
  return <PresaleScreen onSkip={() => {}} onComplete={() => {}} />;
}

function PrivacyExplainerScreenNav() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return <PrivacyExplainerScreen onDismiss={() => navigation.goBack()} />;
}

function SendScreenNav() {
  const navigation = useNavigation<NativeStackNavigationProp<SendStackParamList>>();
  return (
    <SendScreenImpl
      onTransactionSent={params => {
        navigation.navigate('TransactionStatus', params);
      }}
    />
  );
}

function TransactionStatusScreenNav() {
  const route = useRoute();
  const navigation = useNavigation();
  const params = route.params as {signature: string; amount: string; recipient: string; token: string};
  return (
    <TransactionStatusScreen
      signature={params.signature}
      amount={params.amount}
      recipient={params.recipient}
      token={params.token}
      onDashboard={() => navigation.getParent()?.navigate('HomeTab')}
      onRetry={() => navigation.goBack()}
    />
  );
}

function TransactionHistoryScreenNav() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <TransactionHistoryScreenImpl
      onSelectTx={(signature: string) => {
        // Dismiss modal, then navigate to TransactionDetail in SendStack
        navigation.goBack();
        // Navigation to detail is handled by the parent — for now log the signature
        // Full cross-stack navigation will be wired when the tab navigator supports it
      }}
      onBack={() => navigation.goBack()}
    />
  );
}

function TransactionDetailScreenNav() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params as {signature: string};
  return (
    <TransactionDetailScreenImpl
      signature={params.signature}
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
        <OnboardingNav.Screen name="SyncWallet" component={SyncWalletScreenNav} />
        <OnboardingNav.Screen name="SetPin" component={SetPinScreenNav} />
        <OnboardingNav.Screen name="BiometricSetup" component={BiometricSetupScreenNav} />
        <OnboardingNav.Screen name="Success" component={SuccessScreenNav} />
        <OnboardingNav.Screen name="Presale" component={PresaleScreenOnboarding} />
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
      <DashboardNav.Screen name="Presale" component={PresaleScreenDashboard} />
      <DashboardNav.Screen name="Staking" component={StakingScreenNav} />
      <DashboardNav.Screen name="Referral" component={ReferralScreenNav} />
    </DashboardNav.Navigator>
  );
}

// Send Stack
const SendNav = createNativeStackNavigator<SendStackParamList>();
function SendStack() {
  return (
    <SendNav.Navigator screenOptions={defaultScreenOptions}>
      <SendNav.Screen name="Send" component={SendScreenNav} />
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
      <SettingsNav.Screen name="SecuritySettings" component={SecuritySettingsScreen} />
      <SettingsNav.Screen name="ChangePin" component={ChangePinScreen} />
      <SettingsNav.Screen name="ExportViewKey" component={ExportViewKeyScreen} />
      <SettingsNav.Screen name="BackupSettings" component={BackupSettingsScreen} />
      <SettingsNav.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
      <SettingsNav.Screen name="WipeWallet" component={WipeWalletScreen} />
    </SettingsNav.Navigator>
  );
}

// Main Tabs (4 tabs)
const Tabs = createBottomTabNavigator<MainTabsParamList>();
function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0C0C14',
          borderTopColor: 'rgba(255,255,255,0.06)',
          height: 80,
        },
        tabBarActiveTintColor: '#6C47FF',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.35)',
      }}>
      <Tabs.Screen name="HomeTab" component={DashboardStack} options={{title: 'Home'}} />
      <Tabs.Screen name="SendTab" component={SendStack} options={{title: 'Send'}} />
      <Tabs.Screen name="ReceiveTab" component={ReceiveScreenNav} options={{title: 'Receive'}} />
      <Tabs.Screen name="SettingsTab" component={SettingsStack} options={{title: 'Settings'}} />
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
      <RootNav.Screen name="Onboarding" component={OnboardingStack} />
      <RootNav.Screen name="MainTabs" component={MainTabs} />
      <RootNav.Screen name="TransactionHistory" component={TransactionHistoryScreenNav} options={modalScreenOptions} />
      <RootNav.Screen name="ShieldedBalance" component={ShieldedBalanceScreen} options={modalScreenOptions} />
      <RootNav.Screen name="Deposit" component={DepositScreen} options={modalScreenOptions} />
      <RootNav.Screen name="ShieldedTransfer" component={ShieldedTransferScreen} options={modalScreenOptions} />
      <RootNav.Screen name="Withdraw" component={WithdrawScreen} options={modalScreenOptions} />
      <RootNav.Screen name="PrivacyExplainer" component={PrivacyExplainerScreenNav} options={modalScreenOptions} />
      <RootNav.Screen name="AppUpdateModal" component={AppUpdateModalScreen} options={{...modalScreenOptions, gestureEnabled: false}} />
    </RootNav.Navigator>
  );
}
