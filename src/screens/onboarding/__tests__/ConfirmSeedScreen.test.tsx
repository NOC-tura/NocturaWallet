import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {ConfirmSeedScreen} from '../ConfirmSeedScreen';
import {mmkvPublic} from '../../../store/mmkv/instances';
import {MMKV_KEYS} from '../../../constants/mmkvKeys';

const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

beforeEach(() => {
  mmkvPublic.clearAll();
  jest.clearAllMocks();
  jest.spyOn(Math, 'random').mockRestore();
});

// Helper: pick the 3 indices that the component chose (they appear in the instruction text)
function getChosenIndices(instructionText: string): number[] {
  // Instruction format: "Select word #X, #Y, #Z"
  const matches = instructionText.match(/#(\d+)/g);
  if (!matches) return [];
  return matches.map(m => parseInt(m.slice(1), 10)); // 1-indexed
}

describe('ConfirmSeedScreen', () => {
  const onSuccess = jest.fn();
  const onBackToSeed = jest.fn();

  it('shows instruction text with word positions to verify', () => {
    const {getByText} = render(
      <ConfirmSeedScreen
        mnemonic={TEST_MNEMONIC}
        onSuccess={onSuccess}
        onBackToSeed={onBackToSeed}
      />,
    );
    // Instruction must mention 3 positions (e.g. "Select word #1, #3, #7")
    const instruction = getByText(/Select word #\d+, #\d+, #\d+/);
    expect(instruction).toBeTruthy();
  });

  it('shows a grid of shuffled words', () => {
    const words = TEST_MNEMONIC.split(' ');
    const uniqueWords = Array.from(new Set(words));
    const {getAllByText, getByText} = render(
      <ConfirmSeedScreen
        mnemonic={TEST_MNEMONIC}
        onSuccess={onSuccess}
        onBackToSeed={onBackToSeed}
      />,
    );
    // All unique words must appear on screen; duplicates show multiple times
    uniqueWords.forEach(word => {
      const occurrences = words.filter(w => w === word).length;
      if (occurrences > 1) {
        expect(getAllByText(word).length).toBe(occurrences);
      } else {
        expect(getByText(word)).toBeTruthy();
      }
    });
  });

  it('correct selection in order calls onSuccess and sets MMKV flag', () => {
    const {getByText, getAllByText} = render(
      <ConfirmSeedScreen
        mnemonic={TEST_MNEMONIC}
        onSuccess={onSuccess}
        onBackToSeed={onBackToSeed}
      />,
    );

    const instruction = getByText(/Select word #\d+, #\d+, #\d+/);
    const indices = getChosenIndices(instruction.props.children ?? '');
    // indices are 1-based; words array is 0-based
    const words = TEST_MNEMONIC.split(' ');

    // Tap each required word in order. For duplicate words (e.g., "abandon" x11),
    // pick the first non-confirmed match by iterating past already-pressed elements.
    const pressedElements = new Set<number>();
    indices.forEach(pos => {
      const word = words[pos - 1];
      const matches = getAllByText(word);
      // Find first match we haven't pressed yet
      let idx = 0;
      while (pressedElements.has(idx) && idx < matches.length) idx++;
      pressedElements.add(idx);
      fireEvent.press(matches[idx] ?? matches[0]);
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(mmkvPublic.getString(MMKV_KEYS.ONBOARDING_SEED_CONFIRMED)).toBe('true');
  });

  it('incorrect selection shows error message', () => {
    const {getByText, getAllByText, queryByText} = render(
      <ConfirmSeedScreen
        mnemonic={TEST_MNEMONIC}
        onSuccess={onSuccess}
        onBackToSeed={onBackToSeed}
      />,
    );

    const instruction = getByText(/Select word #\d+, #\d+, #\d+/);
    const indices = getChosenIndices(instruction.props.children ?? '');
    const words = TEST_MNEMONIC.split(' ');

    // Find a word that is NOT the first required word
    const firstRequiredWord = words[indices[0] - 1];
    // "about" is always a valid non-"abandon" word in our test mnemonic
    const wrongWord = firstRequiredWord === 'about' ? 'abandon' : 'about';

    const wrongMatches = getAllByText(wrongWord);
    fireEvent.press(wrongMatches[0]);

    expect(queryByText(/Incorrect/i)).toBeTruthy();
  });

  it('after 3 failures calls onBackToSeed', () => {
    const {getByText, getAllByText} = render(
      <ConfirmSeedScreen
        mnemonic={TEST_MNEMONIC}
        onSuccess={onSuccess}
        onBackToSeed={onBackToSeed}
      />,
    );

    const instruction = getByText(/Select word #\d+, #\d+, #\d+/);
    const indices = getChosenIndices(instruction.props.children ?? '');
    const words = TEST_MNEMONIC.split(' ');
    const firstRequiredWord = words[indices[0] - 1];
    const wrongWord = firstRequiredWord === 'about' ? 'abandon' : 'about';

    // Fail 3 times
    for (let i = 0; i < 3; i++) {
      const wrongMatches = getAllByText(wrongWord);
      fireEvent.press(wrongMatches[0]);
    }

    expect(onBackToSeed).toHaveBeenCalledTimes(1);
  });
});
