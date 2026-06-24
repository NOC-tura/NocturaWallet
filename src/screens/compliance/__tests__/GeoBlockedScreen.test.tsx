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

  it('does NOT claim presale is geofenced for a non-blocked EU region', () => {
    // SI (EU), presaleBlocked defaults to false → presale is available, swaps
    // (MiCA) + fiat are the only restrictions, presale is under "what works".
    const {getByText, queryByText, getAllByText} = render(
      <GeoBlockedScreen
        countryCode="SI"
        onDismiss={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    getByText(/Token swaps/i); // EU → MiCA reason shown
    getByText(/on-ramp/i);
    expect(queryByText(/Geofenced in your region/i)).toBeNull(); // not falsely blocked
    // presale appears exactly once — in "what still works", not as a restriction
    expect(getAllByText('NOC presale')).toHaveLength(1);
  });

  it('shows presale as restricted ONLY when actually blocked (sanctioned)', () => {
    const {getByText, queryByText} = render(
      <GeoBlockedScreen
        countryCode="KP"
        presaleBlocked
        onDismiss={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    getByText('North Korea');
    getByText(/Geofenced in your region/i); // presale restriction shown
    getByText(/on-ramp/i);
    expect(queryByText(/Token swaps/i)).toBeNull(); // KP is not EU → no MiCA row
  });

  it('lists what still works (incl. presale when not blocked)', () => {
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
    getByText('NOC presale'); // available → listed under what works
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
