/**
 * The shared #18 / #21 pieces (M1c Task 8 fix round 1, I-2 / M-6): the deposit's #18, its #21 and
 * the unshield run all draw them, so their states are held here once.
 */
import React from 'react';
import {render} from '@testing-library/react-native';
import {ProofHeroRing, StageRow, shortSignature} from '../shieldedParts';

describe('the shared shielded parts', () => {
  it('StageRow: a done row shows the check in its disc, never its number; a pending or active row shows the number', () => {
    const done = render(<StageRow testID="s" num={3} title="Prove" status="done" meta="done · 1.0 s" mark="✓" />);
    expect(done.queryByText('3')).toBeNull();
    expect(done.getByTestId('s-check').children).toHaveLength(1); // the glyph itself, not an empty wrapper
    for (const status of ['pending', 'active'] as const) {
      const r = render(<StageRow testID="s" num={3} title="Prove" status={status} meta="—" mark="·" />);
      expect(r.getByText('3')).toBeTruthy();
      expect(r.queryByTestId('s-check')).toBeNull();
    }
    expect(done.getByTestId('s-meta').props.children).toBe('done · 1.0 s');
  });

  it('ProofHeroRing: the CPU glyph while busy only; ready and failed draw their own', () => {
    expect(render(<ProofHeroRing tone="busy" testID="h" />).getByTestId('h-cpu').children).toHaveLength(1); // the glyph drawn
    expect(render(<ProofHeroRing tone="ready" testID="h" />).queryByTestId('h-cpu')).toBeNull();
    expect(render(<ProofHeroRing tone="failed" testID="h" />).queryByTestId('h-cpu')).toBeNull();
  });

  it('shortSignature: first 6 + last 4; a short string unchanged', () => {
    expect(shortSignature('4Hq7MbX1n2sV9pLr6TzKc3uYdW8eFa5G')).toBe('4Hq7Mb…Fa5G');
    expect(shortSignature('abc')).toBe('abc');
  });
});
