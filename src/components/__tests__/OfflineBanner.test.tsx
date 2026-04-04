import React from 'react';
import {render} from '@testing-library/react-native';
import {OfflineBanner} from '../OfflineBanner';

describe('OfflineBanner', () => {
  it('renders nothing when online', () => {
    const {queryByText} = render(
      <OfflineBanner isOnline={true} lastSyncedAt={null} />,
    );
    expect(queryByText(/offline/i)).toBeNull();
  });

  it('renders offline message when not online', () => {
    const {getByText} = render(
      <OfflineBanner isOnline={false} lastSyncedAt={null} />,
    );
    expect(getByText(/offline/i)).toBeTruthy();
  });

  it('shows last synced date when available', () => {
    const syncTime = new Date('2026-04-04T12:00:00Z').getTime();
    const {getByText} = render(
      <OfflineBanner isOnline={false} lastSyncedAt={syncTime} />,
    );
    // Should contain some date representation
    expect(getByText(/showing data from/i)).toBeTruthy();
  });

  it('shows generic message when no sync date', () => {
    const {getByText} = render(
      <OfflineBanner isOnline={false} lastSyncedAt={null} />,
    );
    expect(getByText(/offline/i)).toBeTruthy();
  });
});
