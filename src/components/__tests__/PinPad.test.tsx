import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {PinPad} from '../PinPad';

describe('PinPad', () => {
  it('renders 10 digit buttons (0-9)', () => {
    const {getByText} = render(
      <PinPad onComplete={jest.fn()} maxLength={6} />,
    );

    for (let i = 0; i <= 9; i++) {
      expect(getByText(String(i))).toBeTruthy();
    }
  });

  it('renders delete button (⌫)', () => {
    const {getByText} = render(
      <PinPad onComplete={jest.fn()} maxLength={6} />,
    );

    expect(getByText('⌫')).toBeTruthy();
  });

  it("calls onComplete when maxLength digits entered (enter '123456' → onComplete('123456'))", async () => {
    const onComplete = jest.fn();
    const {getByText} = render(
      <PinPad onComplete={onComplete} maxLength={6} />,
    );

    fireEvent.press(getByText('1'));
    fireEvent.press(getByText('2'));
    fireEvent.press(getByText('3'));
    fireEvent.press(getByText('4'));
    fireEvent.press(getByText('5'));
    fireEvent.press(getByText('6'));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith('123456');
    });
  });

  it('renders dot indicators (testID="pin-dot", 6 dots)', () => {
    const {getAllByTestId} = render(
      <PinPad onComplete={jest.fn()} maxLength={6} />,
    );

    const dots = getAllByTestId('pin-dot');
    expect(dots).toHaveLength(6);
  });

  it('shows error state (error="Wrong PIN" renders the text)', () => {
    const {getByText} = render(
      <PinPad onComplete={jest.fn()} maxLength={6} error="Wrong PIN" />,
    );

    expect(getByText('Wrong PIN')).toBeTruthy();
  });

  it('disables input when disabled prop (presses do not trigger onComplete)', async () => {
    const onComplete = jest.fn();
    const {getByText} = render(
      <PinPad onComplete={onComplete} maxLength={6} disabled={true} />,
    );

    fireEvent.press(getByText('1'));
    fireEvent.press(getByText('2'));
    fireEvent.press(getByText('3'));
    fireEvent.press(getByText('4'));
    fireEvent.press(getByText('5'));
    fireEvent.press(getByText('6'));

    // Wait a tick then confirm onComplete was never called
    await waitFor(() => {
      expect(onComplete).not.toHaveBeenCalled();
    });
  });
});
