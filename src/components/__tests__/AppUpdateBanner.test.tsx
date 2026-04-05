import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {Linking} from 'react-native';
import {AppUpdateBanner} from '../AppUpdateBanner';

jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);

describe('AppUpdateBanner', () => {
  const onDismiss = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when not visible', () => {
    const {queryByText} = render(
      <AppUpdateBanner
        visible={false}
        storeUrl="https://apps.apple.com/app/noctura"
        onDismiss={onDismiss}
      />,
    );

    expect(queryByText(/new version available/i)).toBeNull();
  });

  it('renders banner when visible ("New version available — tap to update")', () => {
    const {getByText} = render(
      <AppUpdateBanner
        visible={true}
        storeUrl="https://apps.apple.com/app/noctura"
        onDismiss={onDismiss}
      />,
    );

    expect(getByText(/new version available — tap to update/i)).toBeTruthy();
  });

  it('calls onDismiss when X pressed', () => {
    const {getByTestId} = render(
      <AppUpdateBanner
        visible={true}
        storeUrl="https://apps.apple.com/app/noctura"
        onDismiss={onDismiss}
      />,
    );

    fireEvent.press(getByTestId('app-update-banner-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
