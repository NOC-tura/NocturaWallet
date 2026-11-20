/** spec §3.2: "Details ▾", collapsed by default, no persisted state, a button with its expanded state. */
import React from 'react';
import {Text} from 'react-native';
import {render, fireEvent} from '@testing-library/react-native';
import {DetailsDisclosure} from '../DetailsDisclosure';

const panel = () => (
  <DetailsDisclosure testID="d">
    <Text>Network fee</Text>
  </DetailsDisclosure>
);

describe('DetailsDisclosure', () => {
  it('collapsed by default: the children are not rendered; "Details ▾"', () => {
    const r = render(panel());
    expect(r.queryByText('Network fee')).toBeNull();
    expect(r.queryByTestId('d-body')).toBeNull();
    expect(r.getByText('Details ▾')).toBeTruthy();
  });

  it('a press shows the children and turns the arrow; a second press hides them', () => {
    const r = render(panel());
    fireEvent.press(r.getByTestId('d-toggle'));
    expect(r.getByText('Network fee')).toBeTruthy();
    expect(r.getByText('Details ▴')).toBeTruthy();
    fireEvent.press(r.getByTestId('d-toggle'));
    expect(r.queryByText('Network fee')).toBeNull();
  });

  it('accessibility: a button labelled "Details" whose expanded state follows the panel', () => {
    const r = render(panel());
    const t = r.getByTestId('d-toggle');
    expect(t.props.accessibilityRole).toBe('button');
    expect(t.props.accessibilityLabel).toBe('Details');
    expect(t.props.accessibilityState).toMatchObject({expanded: false});
    fireEvent.press(t);
    expect(r.getByTestId('d-toggle').props.accessibilityState).toMatchObject({expanded: true});
  });

  it('no persisted state: a new mount starts collapsed even after one was opened', () => {
    const first = render(panel());
    fireEvent.press(first.getByTestId('d-toggle'));
    expect(first.getByText('Network fee')).toBeTruthy();
    first.unmount();
    expect(render(panel()).queryByText('Network fee')).toBeNull();
  });
});
