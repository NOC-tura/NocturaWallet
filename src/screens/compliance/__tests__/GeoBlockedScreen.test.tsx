import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {GeoBlockedScreen} from '../GeoBlockedScreen';

describe('GeoBlockedScreen (#50)', () => {
  it('renders the detected region via regionDisplay (Slovenia · EU)', () => {
    const {getByText} = render(
      <GeoBlockedScreen
        countryCode="SI"
        onDismiss={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    getByText('Slovenia · EU');
  });

  it('renders the three reason rows', () => {
    const {getByText} = render(
      <GeoBlockedScreen
        countryCode="SI"
        onDismiss={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    getByText(/Token swaps/i);
    getByText(/NOC presale/i);
    getByText(/on-ramp/i);
  });

  it('lists what still works', () => {
    const {getByText} = render(
      <GeoBlockedScreen
        countryCode="SI"
        onDismiss={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    getByText(/what still works/i);
    getByText('Send');
    getByText('Receive');
    getByText('Stake');
  });

  it('shows the coarse-geo disclosure', () => {
    const {getByText} = render(
      <GeoBlockedScreen
        countryCode="SI"
        onDismiss={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    getByText('Based on your network — no GPS, no device location.');
  });

  it('falls back to the raw code (no EU tag) for an unknown region', () => {
    const {getByText, queryByText} = render(
      <GeoBlockedScreen onDismiss={jest.fn()} onClose={jest.fn()} />,
    );
    getByText('UNKNOWN');
    expect(queryByText(/· EU/)).toBeNull();
  });

  it('[Got it] calls onDismiss', () => {
    const onDismiss = jest.fn();
    const {getByText} = render(
      <GeoBlockedScreen
        countryCode="SI"
        onDismiss={onDismiss}
        onClose={jest.fn()}
      />,
    );
    fireEvent.press(getByText('Got it'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('the X button calls onClose', () => {
    const onClose = jest.fn();
    const {getByLabelText} = render(
      <GeoBlockedScreen
        countryCode="SI"
        onDismiss={jest.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.press(getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
