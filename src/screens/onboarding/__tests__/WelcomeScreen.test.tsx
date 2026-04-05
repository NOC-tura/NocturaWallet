import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {WelcomeScreen} from '../WelcomeScreen';

describe('WelcomeScreen', () => {
  const onCreate = jest.fn();
  const onImport = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows "Welcome to Noctura"', () => {
    const {getByText} = render(
      <WelcomeScreen onCreate={onCreate} onImport={onImport} />,
    );
    expect(getByText('Welcome to Noctura')).toBeTruthy();
  });

  it('shows "Create new wallet" button', () => {
    const {getByText} = render(
      <WelcomeScreen onCreate={onCreate} onImport={onImport} />,
    );
    expect(getByText('Create new wallet')).toBeTruthy();
  });

  it('shows "Import existing wallet" button', () => {
    const {getByText} = render(
      <WelcomeScreen onCreate={onCreate} onImport={onImport} />,
    );
    expect(getByText('Import existing wallet')).toBeTruthy();
  });

  it('calls onCreate when create pressed', () => {
    const {getByText} = render(
      <WelcomeScreen onCreate={onCreate} onImport={onImport} />,
    );
    fireEvent.press(getByText('Create new wallet'));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('calls onImport when import pressed', () => {
    const {getByText} = render(
      <WelcomeScreen onCreate={onCreate} onImport={onImport} />,
    );
    fireEvent.press(getByText('Import existing wallet'));
    expect(onImport).toHaveBeenCalledTimes(1);
  });
});
