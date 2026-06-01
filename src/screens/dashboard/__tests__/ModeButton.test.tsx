import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {ModeButton} from '../DashboardScreen';

describe('ModeButton', () => {
  it('calls onPress when enabled', () => {
    const onPress = jest.fn();
    const {getByText} = render(
      <ModeButton label="Transparent" isActive mode="transparent" onPress={onPress} />,
    );
    fireEvent.press(getByText('Transparent'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders a "soon" label and does NOT call onPress when comingSoon', () => {
    const onPress = jest.fn();
    const {getByText, queryByText} = render(
      <ModeButton
        label="Shielded"
        isActive={false}
        mode="shielded"
        onPress={onPress}
        withShieldIcon
        comingSoon
      />,
    );
    expect(getByText('Shielded · soon')).toBeTruthy();
    expect(queryByText('Shielded')).toBeNull();
    fireEvent.press(getByText('Shielded · soon'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
