import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {ImportSeedScreen} from '../ImportSeedScreen';

/**
 * #7 ImportSeed · the word counter and the CTA gate.
 *
 * Written 2026-09-18 after a real transcription failure on device: a phrase
 * proven correct on the desktop went red at the 23rd word, and the message said
 * "24 words · checksum failed — check word spelling and order". The spelling was
 * fine. The keyboard had added a token the user never typed (Gboard turns a
 * double space into ". "), so the field held 24 words while 23 had been entered.
 *
 * The counter must report what will actually be validated, not the raw field.
 */

// The canonical all-zero-entropy 24-word vector: 23x abandon + art.
const VALID_24 = `${Array(23).fill('abandon').join(' ')} art`;

function renderScreen(onMnemonicValidated = jest.fn()) {
  const utils = render(
    <SafeAreaProvider
      initialMetrics={{
        frame: {x: 0, y: 0, width: 400, height: 800},
        insets: {top: 0, left: 0, right: 0, bottom: 0},
      }}>
      <ImportSeedScreen onMnemonicValidated={onMnemonicValidated} />
    </SafeAreaProvider>,
  );
  return {...utils, onMnemonicValidated};
}

function type(utils: ReturnType<typeof renderScreen>, text: string) {
  fireEvent.changeText(utils.getByLabelText('Recovery phrase input'), text);
}

describe('ImportSeedScreen — word counter', () => {
  it('counts 23 typed words as 23, not 24 (control)', () => {
    const utils = renderScreen();
    type(utils, VALID_24.split(' ').slice(0, 23).join(' '));
    expect(utils.getByText('23 of 24 words entered')).toBeTruthy();
  });

  it('is not derailed by a keyboard-inserted period', () => {
    const utils = renderScreen();
    // 23 words typed; Gboard turned the space after word 22 into ". ", so the
    // period rides on the preceding word and makes it a non-wordlist token.
    const words = VALID_24.split(' ').slice(0, 23);
    const withPeriod = `${words.slice(0, 22).join(' ')}. ${words[22]}`;
    expect(withPeriod.split(/\s+/)).toHaveLength(23);
    expect(withPeriod.split(/\s+/)[21]).toBe('abandon.'); // the damaged token
    type(utils, withPeriod);
    expect(utils.getByText('23 of 24 words entered')).toBeTruthy();
  });

  it('counts an extra token the user did not type — the counter runs ahead', () => {
    // What normalization CANNOT repair: a stray space splitting a word, or a
    // predicted word inserted by the keyboard. Nothing can recover the intent.
    // The counter must at least say so: 23 words typed, 24 counted, red at 23.
    const utils = renderScreen();
    const words = VALID_24.split(' ').slice(0, 23);
    type(utils, `${words.slice(0, 22).join(' ')} aban don`);
    expect(
      utils.getByText('24 words · checksum failed — check word spelling and order'),
    ).toBeTruthy();
  });

  it('accepts a correct 24-word phrase carrying keyboard artifacts', () => {
    const utils = renderScreen();
    type(utils, `Abandon${VALID_24.slice(7)}.`);
    expect(utils.getByText(/Valid 24-word BIP-39 phrase/)).toBeTruthy();
  });

  it('hands the canonical phrase downstream, never the raw field', () => {
    const utils = renderScreen();
    type(utils, `  ${VALID_24.toUpperCase()}.  `);
    fireEvent.press(utils.getByText('Continue'));
    expect(utils.onMnemonicValidated).toHaveBeenCalledWith(VALID_24);
  });

  it('still rejects a genuinely misspelled word', () => {
    const utils = renderScreen();
    type(utils, VALID_24.replace(' art', ' arm'));
    expect(
      utils.getByText('24 words · checksum failed — check word spelling and order'),
    ).toBeTruthy();
  });
});
