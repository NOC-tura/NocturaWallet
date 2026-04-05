import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {QuickActions} from '../QuickActions';

describe('QuickActions', () => {
  it('renders Send, Receive, Stake, Swap buttons', () => {
    const {getByText} = render(
      <QuickActions
        onSend={jest.fn()}
        onReceive={jest.fn()}
        onStake={jest.fn()}
      />,
    );
    expect(getByText('Send')).toBeTruthy();
    expect(getByText('Receive')).toBeTruthy();
    expect(getByText('Stake')).toBeTruthy();
    expect(getByText('Swap')).toBeTruthy();
  });

  it('calls onSend when Send pressed', () => {
    const onSend = jest.fn();
    const {getByText} = render(
      <QuickActions
        onSend={onSend}
        onReceive={jest.fn()}
        onStake={jest.fn()}
      />,
    );
    fireEvent.press(getByText('Send'));
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('calls onReceive when Receive pressed', () => {
    const onReceive = jest.fn();
    const {getByText} = render(
      <QuickActions
        onSend={jest.fn()}
        onReceive={onReceive}
        onStake={jest.fn()}
      />,
    );
    fireEvent.press(getByText('Receive'));
    expect(onReceive).toHaveBeenCalledTimes(1);
  });

  it('calls onStake when Stake pressed', () => {
    const onStake = jest.fn();
    const {getByText} = render(
      <QuickActions
        onSend={jest.fn()}
        onReceive={jest.fn()}
        onStake={onStake}
      />,
    );
    fireEvent.press(getByText('Stake'));
    expect(onStake).toHaveBeenCalledTimes(1);
  });

  it('shows "Coming Soon" text when Swap pressed', () => {
    const {getByText, queryByText} = render(
      <QuickActions
        onSend={jest.fn()}
        onReceive={jest.fn()}
        onStake={jest.fn()}
      />,
    );
    expect(queryByText(/coming soon/i)).toBeNull();
    fireEvent.press(getByText('Swap'));
    expect(getByText(/coming soon/i)).toBeTruthy();
  });

  it('Send is disabled when isOffline is true', () => {
    const onSend = jest.fn();
    const {getByText} = render(
      <QuickActions
        onSend={onSend}
        onReceive={jest.fn()}
        onStake={jest.fn()}
        isOffline={true}
      />,
    );
    fireEvent.press(getByText('Send'));
    expect(onSend).not.toHaveBeenCalled();
  });
});
