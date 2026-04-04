import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {makePlaceholder} from '../screens/PlaceholderScreen';
import type {
  RootStackParamList,
  OnboardingStackParamList,
  DashboardStackParamList,
  SendStackParamList,
  SettingsStackParamList,
  MainTabsParamList,
} from '../types/navigation';

// Screen placeholders (replaced in later implementation steps)
const SplashScreen = makePlaceholder('Splash');
const UnlockScreen = makePlaceholder('Unlock');
const WelcomeScreen = makePlaceholder('Welcome');
const SecurityIntroScreen = makePlaceholder('SecurityIntro');
const CreateWalletScreen = makePlaceholder('CreateWallet');
const SeedPhraseScreen = makePlaceholder('SeedPhrase');
const ConfirmSeedScreen = makePlaceholder('ConfirmSeed');
const ImportSeedScreen = makePlaceholder('ImportSeed');
const SyncWalletScreen = makePlaceholder('SyncWallet');
const SetPinScreen = makePlaceholder('SetPin');
const BiometricSetupScreen = makePlaceholder('BiometricSetup');
const SuccessScreen = makePlaceholder('Success');
const PresaleScreen = makePlaceholder('Presale');
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
const PrivacyExplainerScreen = makePlaceholder('PrivacyExplainer');
const AppUpdateModalScreen = makePlaceholder('AppUpdateModal');

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
    <OnboardingNav.Navigator screenOptions={defaultScreenOptions}>
      <OnboardingNav.Screen name="Welcome" component={WelcomeScreen} />
      <OnboardingNav.Screen name="SecurityIntro" component={SecurityIntroScreen} />
      <OnboardingNav.Screen name="CreateWallet" component={CreateWalletScreen} />
      <OnboardingNav.Screen name="SeedPhrase" component={SeedPhraseScreen} />
      <OnboardingNav.Screen name="ConfirmSeed" component={ConfirmSeedScreen} />
      <OnboardingNav.Screen name="ImportSeed" component={ImportSeedScreen} />
      <OnboardingNav.Screen name="SyncWallet" component={SyncWalletScreen} />
      <OnboardingNav.Screen name="SetPin" component={SetPinScreen} />
      <OnboardingNav.Screen name="BiometricSetup" component={BiometricSetupScreen} />
      <OnboardingNav.Screen name="Success" component={SuccessScreen} />
      <OnboardingNav.Screen name="Presale" component={PresaleScreen} />
    </OnboardingNav.Navigator>
  );
}

// Dashboard Stack
const DashboardNav = createNativeStackNavigator<DashboardStackParamList>();
function DashboardStack() {
  return (
    <DashboardNav.Navigator screenOptions={defaultScreenOptions}>
      <DashboardNav.Screen name="Dashboard" component={DashboardScreen} />
      <DashboardNav.Screen name="Presale" component={PresaleScreen} />
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
      <RootNav.Screen name="Splash" component={SplashScreen} />
      <RootNav.Screen name="Unlock" component={UnlockScreen} />
      <RootNav.Screen name="Onboarding" component={OnboardingStack} />
      <RootNav.Screen name="MainTabs" component={MainTabs} />
      <RootNav.Screen name="TransactionHistory" component={TransactionHistoryScreen} options={modalScreenOptions} />
      <RootNav.Screen name="ShieldedBalance" component={ShieldedBalanceScreen} options={modalScreenOptions} />
      <RootNav.Screen name="Deposit" component={DepositScreen} options={modalScreenOptions} />
      <RootNav.Screen name="ShieldedTransfer" component={ShieldedTransferScreen} options={modalScreenOptions} />
      <RootNav.Screen name="Withdraw" component={WithdrawScreen} options={modalScreenOptions} />
      <RootNav.Screen name="PrivacyExplainer" component={PrivacyExplainerScreen} options={modalScreenOptions} />
      <RootNav.Screen name="AppUpdateModal" component={AppUpdateModalScreen} options={{...modalScreenOptions, gestureEnabled: false}} />
    </RootNav.Navigator>
  );
}
