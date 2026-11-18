/**
 * The desk's trigger for the M1c `pinnedFetch` control (useA0PinnedControlLink.ts; spec §6.0):
 * the exact link runs the control, nothing else does, a closed gate adds no listener at all, and
 * the link navigates nowhere (it has no entry in deepLinkConfig).
 */
import {renderHook} from '@testing-library/react-native';
import {Linking} from 'react-native';
// the function NavigationContainer's linking uses (@react-navigation/native re-exports it from core)
import {getStateFromPath} from '@react-navigation/core';

jest.mock('../../modules/shielded/a0/pinnedControl', () => ({
  ...jest.requireActual('../../modules/shielded/a0/pinnedControl'),
  runA0PinnedControl: jest.fn(async () => null),
}));

import {deepLinkConfig} from '../../app/deepLinkConfig';
import {A0_PINNED_CONTROL_LINK, runA0PinnedControl} from '../../modules/shielded/a0/pinnedControl';
import {useA0PinnedControlLink} from '../useA0PinnedControlLink';

const run = runA0PinnedControl as jest.MockedFunction<typeof runA0PinnedControl>;
const tick = () => new Promise(r => setTimeout(r, 0));
let listener: ((e: {url: string}) => void) | undefined;

beforeEach(() => {
  run.mockClear();
  listener = undefined;
  jest.spyOn(Linking, 'addEventListener').mockImplementation(((_t: string, h: (e: {url: string}) => void) => {
    listener = h;
    return {remove: jest.fn()};
  }) as never);
});
afterEach(() => {
  jest.clearAllMocks(); // restoring alone keeps a spy's calls when the same method is spied again
  jest.restoreAllMocks();
});

it('the link is noctura://a0-pinned-control and React Navigation resolves it to no state (no navigation)', () => {
  expect(A0_PINNED_CONTROL_LINK).toBe('noctura://a0-pinned-control');
  expect(getStateFromPath('a0-pinned-control', deepLinkConfig.config)).toBeUndefined();
  // control: a configured path does resolve
  expect(getStateFromPath('pay', deepLinkConfig.config)).toBeDefined();
});

it('gate open: the link as the launching URL runs the control once', async () => {
  jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(A0_PINNED_CONTROL_LINK);
  renderHook(() => useA0PinnedControlLink(true));
  await tick();
  expect(run).toHaveBeenCalledTimes(1);
  expect(run).toHaveBeenCalledWith({enabled: true});
});

it('gate open: the link arriving while running runs it; any other URL does not', async () => {
  jest.spyOn(Linking, 'getInitialURL').mockResolvedValue('noctura://dashboard');
  renderHook(() => useA0PinnedControlLink(true));
  await tick();
  expect(run).not.toHaveBeenCalled();
  listener!({url: `${A0_PINNED_CONTROL_LINK}?x=1`});
  listener!({url: 'noctura://a0-pinned-control/'});
  expect(run).not.toHaveBeenCalled();
  listener!({url: A0_PINNED_CONTROL_LINK});
  expect(run).toHaveBeenCalledTimes(1);
});

it('gate closed (the production build): no listener, the initial URL never read, the control never run', async () => {
  const initial = jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(A0_PINNED_CONTROL_LINK);
  renderHook(() => useA0PinnedControlLink(false));
  await tick();
  expect(Linking.addEventListener).not.toHaveBeenCalled();
  expect(initial).not.toHaveBeenCalled();
  expect(run).not.toHaveBeenCalled();
});

it('the default gate under Jest\'s production config is closed', async () => {
  jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(A0_PINNED_CONTROL_LINK);
  renderHook(() => useA0PinnedControlLink());
  await tick();
  expect(Linking.addEventListener).not.toHaveBeenCalled();
  expect(run).not.toHaveBeenCalled();
});

it('App mounts the hook at the root (beside the referral link)', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../../app/App.tsx'), 'utf8') as string;
  expect(src).toMatch(/useReferralDeepLink\(\);\n\s*useA0PinnedControlLink\(\);/);
});
