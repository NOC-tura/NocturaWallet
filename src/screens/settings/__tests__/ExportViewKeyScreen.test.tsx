import React from 'react';
import {render} from '@testing-library/react-native';
import {ExportViewKeyScreen} from '../ExportViewKeyScreen';

jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn().mockResolvedValue({password: 'aa'.repeat(32)}),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({goBack: jest.fn()}),
}));

describe('ExportViewKeyScreen', () => {
  it('shows warning text initially', () => {
    const {getByText} = render(<ExportViewKeyScreen />);
    expect(getByText(/Your view key/i)).toBeTruthy();
  });

  it('shows "Export View Key" button', () => {
    const {getByTestId} = render(<ExportViewKeyScreen />);
    expect(getByTestId('export-button')).toBeTruthy();
  });

  it('warning text mentions "view key"', () => {
    const {getAllByText} = render(<ExportViewKeyScreen />);
    const els = getAllByText(/view key/i);
    expect(els.length).toBeGreaterThan(0);
  });

  it('export button is present and enabled', () => {
    const {getByTestId} = render(<ExportViewKeyScreen />);
    const btn = getByTestId('export-button');
    expect(btn.props.accessibilityState?.disabled).toBeFalsy();
  });

  it('screen renders without crashing', () => {
    expect(() => render(<ExportViewKeyScreen />)).not.toThrow();
  });
});
