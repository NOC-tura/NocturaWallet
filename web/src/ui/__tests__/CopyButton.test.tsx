import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {CopyButton} from '../CopyButton';

function clipboard(writeText: (v: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {value: {writeText}, configurable: true});
}

describe('CopyButton', () => {
  it('writes the exact value and then says so', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    clipboard(writeText);
    render(<CopyButton value="abc" label="Copy address" />);
    fireEvent.click(screen.getByRole('button', {name: 'Copy address'}));
    expect(writeText).toHaveBeenCalledWith('abc');
    await waitFor(() => expect(screen.getByRole('button', {name: 'Copied'})).toBeTruthy());
  });

  it('never claims a copy the clipboard refused', async () => {
    clipboard(vi.fn().mockRejectedValue(new Error('denied')));
    render(<CopyButton value="abc" label="Copy address" />);
    fireEvent.click(screen.getByRole('button', {name: 'Copy address'}));
    await waitFor(() => expect(screen.getByRole('button', {name: 'Copy failed'})).toBeTruthy());
    expect(screen.queryByRole('button', {name: 'Copied'})).toBeNull();
  });

  it('says failed, not copied, where there is no clipboard at all', async () => {
    Object.defineProperty(navigator, 'clipboard', {value: undefined, configurable: true});
    render(<CopyButton value="abc" label="Copy address" />);
    fireEvent.click(screen.getByRole('button', {name: 'Copy address'}));
    await waitFor(() => expect(screen.getByRole('button', {name: 'Copy failed'})).toBeTruthy());
  });
});
