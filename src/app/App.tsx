import React from 'react';
import {StatusBar} from 'react-native';
import {AppProviders} from './AppProviders';
import {RootNavigator} from './Navigator';

export default function App() {
  return (
    <AppProviders>
      <StatusBar barStyle="light-content" backgroundColor="#0C0C14" />
      <RootNavigator />
    </AppProviders>
  );
}
