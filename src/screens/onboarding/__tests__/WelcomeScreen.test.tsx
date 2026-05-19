import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {WelcomeScreen} from '../WelcomeScreen';

function withSafeArea(node: React.ReactElement) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        insets: {top: 0, bottom: 0, left: 0, right: 0},
        frame: {x: 0, y: 0, width: 0, height: 0},
      }}>
      {node}
    </SafeAreaProvider>
  );
}

describe('WelcomeScreen', () => {
  const onCreate = jest.fn();
  const onImport = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows "Noctura" wordmark', () => {
    const {getByText} = render(
      withSafeArea(<WelcomeScreen onCreate={onCreate} onImport={onImport} />),
    );
    expect(getByText('Noctura')).toBeTruthy();
  });

  it('shows "Create new wallet" button', () => {
    const {getByText} = render(
      withSafeArea(<WelcomeScreen onCreate={onCreate} onImport={onImport} />),
    );
    expect(getByText('Create new wallet')).toBeTruthy();
  });

  it('shows "I have a wallet" button', () => {
    const {getByText} = render(
      withSafeArea(<WelcomeScreen onCreate={onCreate} onImport={onImport} />),
    );
    expect(getByText('I have a wallet')).toBeTruthy();
  });

  it('calls onCreate when create pressed', () => {
    const {getByTestId} = render(
      withSafeArea(<WelcomeScreen onCreate={onCreate} onImport={onImport} />),
    );
    fireEvent.press(getByTestId('create-wallet-button'));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('calls onImport when import pressed', () => {
    const {getByTestId} = render(
      withSafeArea(<WelcomeScreen onCreate={onCreate} onImport={onImport} />),
    );
    fireEvent.press(getByTestId('import-wallet-button'));
    expect(onImport).toHaveBeenCalledTimes(1);
  });
});
