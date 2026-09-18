import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {PinProbeScreen} from '../PinProbeScreen';
import {pinnedFetch, SSLPinningError} from '../../../modules/sslPinning/pinnedFetch';

jest.mock('../../../modules/sslPinning/pinnedFetch', () => {
  const actual = jest.requireActual('../../../modules/sslPinning/pinnedFetch');
  return {...actual, pinnedFetch: jest.fn()};
});

const mockPinnedFetch = pinnedFetch as jest.MockedFunction<typeof pinnedFetch>;

/**
 * The probe exists to produce evidence, so what it must guarantee is narrow:
 * it calls the SHIPPED pinnedFetch (not a copy), and it shows the error CODE —
 * an E004 is the proof that pinning rejected the chain, while any other failure
 * (DNS, timeout, 500) proves nothing about pinning and must be distinguishable.
 */
describe('PinProbeScreen', () => {
  beforeEach(() => mockPinnedFetch.mockReset());

  it('sends the positive probe to pin-test through pinnedFetch', async () => {
    mockPinnedFetch.mockResolvedValue({
      status: 200,
      headers: {},
      json: async () => ({ok: true}),
      text: async () => '{"ok":true}',
    });
    const {getByLabelText, getByTestId} = render(<PinProbeScreen />);
    fireEvent.press(getByLabelText('Run positive probe'));
    await waitFor(() => expect(getByTestId('probe-result')).toBeTruthy());
    expect(mockPinnedFetch).toHaveBeenCalledWith(
      'https://pin-test.noc-tura.io/',
      expect.objectContaining({timeoutMs: 15000}),
    );
    expect(String(getByTestId('probe-result').props.children)).toContain('HTTP 200');
  });

  it('shows E004 when the negative probe is rejected by pinning', async () => {
    mockPinnedFetch.mockRejectedValue(
      new SSLPinningError('SSL certificate pinning failed', new Error('pin mismatch')),
    );
    const {getByLabelText, getByTestId} = render(<PinProbeScreen />);
    fireEvent.press(getByLabelText('Run negative probe'));
    await waitFor(() => expect(getByTestId('probe-result')).toBeTruthy());
    expect(mockPinnedFetch).toHaveBeenCalledWith(
      'https://dao.noc-tura.io/vote',
      expect.anything(),
    );
    const shown = String(getByTestId('probe-result').props.children);
    expect(shown).toContain('SSLPinningError');
    expect(shown).toContain('E004');
  });

  it('distinguishes a non-pinning failure — it must not read as proof', async () => {
    mockPinnedFetch.mockRejectedValue(new Error('Network request failed'));
    const {getByLabelText, getByTestId} = render(<PinProbeScreen />);
    fireEvent.press(getByLabelText('Run negative probe'));
    await waitFor(() => expect(getByTestId('probe-result')).toBeTruthy());
    const shown = String(getByTestId('probe-result').props.children);
    expect(shown).not.toContain('E004');
    expect(shown).toContain('Network request failed');
  });
});
