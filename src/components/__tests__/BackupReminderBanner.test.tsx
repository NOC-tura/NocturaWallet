import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {BackupReminderBanner} from '../BackupReminderBanner';

describe('BackupReminderBanner', () => {
  it('renders nothing when not visible', () => {
    const {queryByText} = render(
      <BackupReminderBanner
        visible={false}
        onBackup={jest.fn()}
        onDismiss={jest.fn()}
        canDismiss={true}
      />,
    );
    expect(queryByText(/back up your wallet/i)).toBeNull();
  });

  it('renders banner with "Back up your wallet" and "Your funds are at risk" when visible', () => {
    const {getByText} = render(
      <BackupReminderBanner
        visible={true}
        onBackup={jest.fn()}
        onDismiss={jest.fn()}
        canDismiss={true}
      />,
    );
    expect(getByText(/back up your wallet/i)).toBeTruthy();
    expect(getByText(/your funds are at risk/i)).toBeTruthy();
  });

  it('calls onBackup when banner tapped', () => {
    const onBackup = jest.fn();
    const {getByText} = render(
      <BackupReminderBanner
        visible={true}
        onBackup={onBackup}
        onDismiss={jest.fn()}
        canDismiss={true}
      />,
    );
    fireEvent.press(getByText(/back up your wallet/i));
    expect(onBackup).toHaveBeenCalledTimes(1);
  });

  it('shows dismiss button (✕) when canDismiss is true', () => {
    const {getByText} = render(
      <BackupReminderBanner
        visible={true}
        onBackup={jest.fn()}
        onDismiss={jest.fn()}
        canDismiss={true}
      />,
    );
    expect(getByText('✕')).toBeTruthy();
  });

  it('hides dismiss button when canDismiss is false (3+ dismisses)', () => {
    const {queryByText} = render(
      <BackupReminderBanner
        visible={true}
        onBackup={jest.fn()}
        onDismiss={jest.fn()}
        canDismiss={false}
      />,
    );
    expect(queryByText('✕')).toBeNull();
  });

  it('calls onDismiss when ✕ pressed', () => {
    const onDismiss = jest.fn();
    const {getByText} = render(
      <BackupReminderBanner
        visible={true}
        onBackup={jest.fn()}
        onDismiss={onDismiss}
        canDismiss={true}
      />,
    );
    fireEvent.press(getByText('✕'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
