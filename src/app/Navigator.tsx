import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {makePlaceholder} from '../screens/PlaceholderScreen';
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
import {OnboardingProvider, useOnboarding} from '../contexts/OnboardingContext';
import type {
  RootStackParamList,
  OnboardingStackParamList,
  DashboardStackParamList,
  SendStackParamList,
  SettingsStackParamList,
  MainTabsParamList,
} from '../types/navigation';

// Screen placeholders (replaced in later implementation steps)
const DashboardScreen = makePlaceholder('Dashboard');
const StakingScreen = makePlaceholder('Staking');
const ReferralScreen = makePlaceholder('Referral');
const SendScreen = makePlaceholder('Send');
const TransactionStatusScreen = makePlaceholder('TransactionStatus');
const TransactionDetailScreen = makePlaceholder('TransactionDetail');
const ReceiveScreen = makePlaceholder('Receive');
const SettingsScreen = makePlaceholder('Settings');
const SecuritySettingsScreen = makePlaceholder('SecuritySettings');
const ChangePinScreen = makePlaceholder('ChangePin');
const ExportViewKeyScreen = makePlaceholder('ExportViewKey');
const BackupSettingsScreen = makePlaceholder('BackupSettings');
const NotificationSettingsScreen = makePlaceholder('NotificationSettings');
const WipeWalletScreen = makePlaceholder('WipeWallet');
const TransactionHistoryScreen = makePlaceholder('TransactionHistory');
const ShieldedBalanceScreen = makePlaceholder('ShieldedBalance');
const DepositScreen = makePlaceholder('Deposit');
const ShieldedTransferScreen = makePlaceholder('ShieldedTransfer');
const WithdrawScreen = makePlaceholder('Withdraw');
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

function PresaleScreenDashboard() {
  return <PresaleScreen onSkip={() => {}} onComplete={() => {}} />;
}

function PrivacyExplainerScreenNav() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return <PrivacyExplainerScreen onDismiss={() => navigation.goBack()} />;
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
      <DashboardNav.Screen name="Dashboard" component={DashboardScreen} />
      <DashboardNav.Screen name="Presale" component={PresaleScreenDashboard} />
      <DashboardNav.Screen name="Staking" component={StakingScreen} />
      <DashboardNav.Screen name="Referral" component={ReferralScreen} />
    </DashboardNav.Navigator>
  );
}

// Send Stack
const SendNav = createNativeStackNavigator<SendStackParamList>();
function SendStack() {
  return (
    <SendNav.Navigator screenOptions={defaultScreenOptions}>
      <SendNav.Screen name="Send" component={SendScreen} />
      <SendNav.Screen name="TransactionStatus" component={TransactionStatusScreen} />
      <SendNav.Screen name="TransactionDetail" component={TransactionDetailScreen} />
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
      <Tabs.Screen name="ReceiveTab" component={ReceiveScreen} options={{title: 'Receive'}} />
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
      <RootNav.Screen name="TransactionHistory" component={TransactionHistoryScreen} options={modalScreenOptions} />
      <RootNav.Screen name="ShieldedBalance" component={ShieldedBalanceScreen} options={modalScreenOptions} />
      <RootNav.Screen name="Deposit" component={DepositScreen} options={modalScreenOptions} />
      <RootNav.Screen name="ShieldedTransfer" component={ShieldedTransferScreen} options={modalScreenOptions} />
      <RootNav.Screen name="Withdraw" component={WithdrawScreen} options={modalScreenOptions} />
      <RootNav.Screen name="PrivacyExplainer" component={PrivacyExplainerScreenNav} options={modalScreenOptions} />
      <RootNav.Screen name="AppUpdateModal" component={AppUpdateModalScreen} options={{...modalScreenOptions, gestureEnabled: false}} />
    </RootNav.Navigator>
  );
}
