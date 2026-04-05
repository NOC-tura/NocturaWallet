import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {Linking} from 'react-native';
import {AppUpdateModal} from '../AppUpdateModal';

jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);

describe('AppUpdateModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when not visible', () => {
    const {queryByText} = render(
      <AppUpdateModal
        visible={false}
        storeUrl="https://apps.apple.com/app/noctura"
      />,
    );

    expect(queryByText(/update required/i)).toBeNull();
    expect(queryByText(/update now/i)).toBeNull();
  });

  it('renders blocking overlay when visible (shows "Update required" + "Update now")', () => {
    const {getByText} = render(
      <AppUpdateModal
        visible={true}
        storeUrl="https://apps.apple.com/app/noctura"
      />,
    );

    expect(getByText(/update required/i)).toBeTruthy();

    const updateBtn = getByText(/update now/i);
    expect(updateBtn).toBeTruthy();

    fireEvent.press(updateBtn);
    expect(Linking.openURL).toHaveBeenCalledWith(
      'https://apps.apple.com/app/noctura',
    );
  });

  it('shows custom message when provided', () => {
    const customMsg = 'Critical security update required.';
    const {getByText} = render(
      <AppUpdateModal
        visible={true}
        storeUrl="https://apps.apple.com/app/noctura"
        message={customMsg}
      />,
    );

    expect(getByText(customMsg)).toBeTruthy();
  });
});
