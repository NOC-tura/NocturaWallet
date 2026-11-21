/** spec §3.3: "To: {selected} · Change"; three options with one-line descriptions; the warning always visible. */
import React from 'react';
import {Text} from 'react-native';
import {render, fireEvent} from '@testing-library/react-native';
import {DestinationRow} from '../DestinationRow';
import type {DestinationRowProps} from '../DestinationRow';

const REASON =
  'A new account is not available yet: the relayer cannot send it SOL for its own fees, and funding it from your other accounts would link them.';

function props(over: Partial<DestinationRowProps> = {}): DestinationRowProps {
  return {
    testID: 'dest',
    choice: 'fresh',
    onChoose: jest.fn(),
    disabled: false,
    fresh: {available: true, sub: 'A new account of this wallet receives it.'},
    mainSub: 'AbCdEf…uVwXyZ',
    mainMono: true,
    freshReason: null,
    warning: null,
    ...over,
  };
}
const summary = (r: ReturnType<typeof render>) => r.getByTestId('dest-summary').props.children;

describe('DestinationRow', () => {
  it('collapsed: "To: A new account (recommended)" and Change; the options are not rendered', () => {
    const r = render(<DestinationRow {...props()} />);
    expect(summary(r)).toBe('To: A new account (recommended)');
    expect(r.getByText('Change')).toBeTruthy();
    expect(r.queryByTestId('dest-options')).toBeNull();
    expect(r.getByTestId('dest-change').props.accessibilityState).toMatchObject({expanded: false, disabled: false});
  });

  it('the summary names the selected destination; nothing chosen yet → "To: Choose a destination"', () => {
    const r = render(<DestinationRow {...props({choice: 'main'})} />);
    expect(summary(r)).toBe('To: My main account');
    r.rerender(<DestinationRow {...props({choice: 'external'})} />);
    expect(summary(r)).toBe('To: Another address');
    r.rerender(<DestinationRow {...props({choice: null})} />);
    expect(summary(r)).toBe('To: Choose a destination'); // owner decision A1
  });

  it('Change opens the three options with their one-line descriptions; a pick calls onChoose and collapses', () => {
    const p = props();
    const r = render(<DestinationRow {...p} />);
    fireEvent.press(r.getByTestId('dest-change'));
    expect(r.getByTestId('dest-change').props.accessibilityState).toMatchObject({expanded: true});
    expect(r.getByTestId('dest-fresh-sub').props.children).toBe('A new account of this wallet receives it.');
    expect(r.getByTestId('dest-main-sub').props.children).toBe('AbCdEf…uVwXyZ');
    expect(r.getByTestId('dest-external-sub').props.children).toBe('A wallet address outside this wallet');
    expect(r.getByTestId('dest-fresh').props.accessibilityState).toMatchObject({selected: true});
    fireEvent.press(r.getByTestId('dest-main'));
    expect(p.onChoose).toHaveBeenCalledWith('main');
    expect(r.queryByTestId('dest-options')).toBeNull();
  });

  it('an unavailable fresh account: its reason shows under the COLLAPSED row (once — not repeated while open); its option is disabled and a tap chooses nothing', () => {
    const p = props({choice: null, fresh: {available: false, sub: REASON}, freshReason: REASON});
    const r = render(<DestinationRow {...p} />);
    expect(summary(r)).toBe('To: Choose a destination');
    expect(r.getByTestId('dest-fresh-reason').props.children).toBe(REASON);
    fireEvent.press(r.getByTestId('dest-change'));
    expect(r.queryByTestId('dest-fresh-reason')).toBeNull(); // review M-5: the option's own sub says it
    expect(r.getAllByText(REASON)).toHaveLength(1);
    expect(r.getByTestId('dest-fresh').props.accessibilityState).toMatchObject({disabled: true, selected: false});
    fireEvent.press(r.getByTestId('dest-fresh'));
    expect(p.onChoose).not.toHaveBeenCalled();
  });

  it('disabled (no quote yet): Change does nothing', () => {
    const r = render(<DestinationRow {...props({disabled: true, choice: null})} />);
    expect(r.getByTestId('dest-change').props.accessibilityState).toMatchObject({disabled: true});
    fireEvent.press(r.getByTestId('dest-change'));
    expect(r.queryByTestId('dest-options')).toBeNull();
  });

  it('the warning is always visible, collapsed and open — never behind Change', () => {
    const w = {testID: 'dest-warning-main', text: 'This links your exit to your deposit: your main account made the deposit.'};
    const r = render(<DestinationRow {...props({choice: 'main', warning: w})} />);
    expect(r.getByTestId('dest-warning-main').props.children).toBe(w.text);
    fireEvent.press(r.getByTestId('dest-change'));
    expect(r.getByTestId('dest-warning-main')).toBeTruthy();
  });

  it('carry 1a / Review Focus 1: nothing chosen → all three options unselected; onChoose is called neither on mount nor by Change', () => {
    const p = props({choice: null, fresh: {available: false, sub: REASON}, freshReason: REASON});
    const r = render(<DestinationRow {...p} />);
    expect(p.onChoose).not.toHaveBeenCalled();
    fireEvent.press(r.getByTestId('dest-change'));
    expect(p.onChoose).not.toHaveBeenCalled();
    for (const id of ['dest-fresh', 'dest-main', 'dest-external']) {
      expect(r.getByTestId(id).props.accessibilityState).toMatchObject({selected: false});
    }
    fireEvent.press(r.getByTestId('dest-change')); // closing chooses nothing either
    expect(p.onChoose).not.toHaveBeenCalled();
  });

  it('carry 1b: the options are a radiogroup, the warning is a polite live region, Change is labelled "Change destination"', () => {
    const w = {testID: 'dest-warning-main', text: 'This links your exit to your deposit: your main account made the deposit.'};
    const r = render(<DestinationRow {...props({choice: 'main', warning: w})} />);
    expect(r.getByTestId('dest-change').props.accessibilityLabel).toBe('Change destination');
    expect(r.getByTestId('dest-warning-main').props.accessibilityLiveRegion).toBe('polite');
    fireEvent.press(r.getByTestId('dest-change'));
    expect(r.getByTestId('dest-options').props.accessibilityRole).toBe('radiogroup');
  });

  it('carry 1c: open, then disabled (the quote went away) → the options are not rendered', () => {
    const r = render(<DestinationRow {...props()} />);
    fireEvent.press(r.getByTestId('dest-change'));
    expect(r.getByTestId('dest-options')).toBeTruthy();
    r.rerender(<DestinationRow {...props({disabled: true})} />);
    expect(r.queryByTestId('dest-options')).toBeNull();
  });

  it('carry 1d: picking the fresh or the external option hands over exactly that choice', () => {
    const p = props({choice: 'main'});
    const r = render(<DestinationRow {...p} />);
    fireEvent.press(r.getByTestId('dest-change'));
    fireEvent.press(r.getByTestId('dest-fresh'));
    expect(p.onChoose).toHaveBeenLastCalledWith('fresh');
    fireEvent.press(r.getByTestId('dest-change'));
    fireEvent.press(r.getByTestId('dest-external'));
    expect(p.onChoose).toHaveBeenLastCalledWith('external');
    expect(p.onChoose).toHaveBeenCalledTimes(2);
  });

  it('children render below the row (the address input lives there)', () => {
    const r = render(
      <DestinationRow {...props({choice: 'external'})}>
        <Text>address input</Text>
      </DestinationRow>,
    );
    expect(r.getByText('address input')).toBeTruthy();
  });
});
