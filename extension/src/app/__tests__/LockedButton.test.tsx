// @vitest-environment happy-dom
import {act, fireEvent, render, screen} from '@testing-library/react';
import {LOCK_MS, LockedButton} from '../ui/LockedButton';

// Cardinal rule 6 / spec §7.6: disabled synchronously on the click; back no earlier than 500 ms after
// it AND not before the action settles.
describe('LockedButton', () => {
  function setup(action: () => Promise<unknown>) {
    let release: () => void = () => undefined;
    const wait = () => new Promise<void>(r => (release = r));
    const onPress = vi.fn(action);
    render(
      <LockedButton onPress={onPress} wait={wait}>
        Save
      </LockedButton>,
    );
    return {onPress, button: screen.getByRole('button', {name: 'Save'}) as HTMLButtonElement, floor: () => act(async () => release())};
  }

  it('a second click inside 500 ms does nothing', async () => {
    const {onPress, button, floor} = setup(async () => undefined);
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);
    await floor();
    fireEvent.click(button);
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('a second click after 500 ms but before the action settles does nothing', async () => {
    let settle: () => void = () => undefined;
    const {onPress, button, floor} = setup(() => new Promise<void>(r => (settle = r)));
    fireEvent.click(button);
    await floor();
    fireEvent.click(button);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);
    await act(async () => settle());
    expect(button.disabled).toBe(false);
  });

  it('two clicks in the same frame, before React re-renders the button disabled: the second does nothing', async () => {
    const {onPress, button, floor} = setup(async () => undefined);
    act(() => {
      button.click();
      button.click();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
    await floor();
  });

  it('holds for LOCK_MS = 500 by default', () => {
    expect(LOCK_MS).toBe(500);
  });
});
