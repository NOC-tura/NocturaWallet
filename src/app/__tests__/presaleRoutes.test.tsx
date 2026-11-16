/**
 * Presale is DISABLED in the devnet build (spec S13): presale — and the rest of the Phase 1
 * program's surfaces, staking, the purchase geo gate and the presale referral — exists on mainnet
 * only, so in a build whose chain is devnet their ROUTES are not registered (unreachable by name
 * or by deep link), onboarding goes straight to the wallet, and the deep-link config has no path
 * for them. The REAL RootNavigator renders (its screens stubbed); the nested stacks' route names
 * are read after navigating into them. Every case runs both ways (mainnet = the positive control).
 */
import React from 'react';
import {render, act} from '@testing-library/react-native';
import {NavigationContainer, createNavigationContainerRef, getStateFromPath} from '@react-navigation/native';
import type {LinkingOptions, NavigationState, PartialState} from '@react-navigation/native';
import {RootNavigator} from '../Navigator';

jest.mock('../../screens/SplashScreen', () => ({SplashScreen: () => null}));
jest.mock('../../screens/dashboard/DashboardScreen', () => ({DashboardScreen: () => null}));
jest.mock('../../screens/onboarding/WelcomeScreen', () => ({WelcomeScreen: () => null}));
jest.mock('../../screens/settings/SettingsScreen', () => ({SettingsScreen: () => null}));
jest.mock('../../screens/PresaleScreen', () => ({PresaleScreen: () => null}));
// Success completes on mount, so the test sees where onboarding goes next.
jest.mock('../../screens/onboarding/SuccessScreen', () => ({
  SuccessScreen: ({onComplete}: {onComplete: () => void}) => {
    const R = jest.requireActual('react') as typeof React;
    R.useEffect(() => onComplete(), [onComplete]);
    return null;
  },
}));

let mockPresale = true;
jest.mock('../../constants/chain', () => {
  const actual = jest.requireActual('../../constants/chain');
  return {...actual, isPresaleEnabled: () => mockPresale};
});

/** The Phase 1 program's routes (mainnet only). */
const DASHBOARD_PRESALE = ['Presale', 'PresaleBuyConfirm', 'PresaleBuyStatus', 'Staking', 'GeoBlocked'];

type AnyState = NavigationState | PartialState<NavigationState> | undefined;
function findNested(state: AnyState, name: string): AnyState {
  for (const r of state?.routes ?? []) {
    if (r.name === name) {
      return r.state as AnyState;
    }
    const inner = findNested(r.state as AnyState, name);
    if (inner) {
      return inner;
    }
  }
  return undefined;
}

function mount(presale: boolean) {
  mockPresale = presale;
  const ref = createNavigationContainerRef();
  render(
    <NavigationContainer ref={ref}>
      <RootNavigator />
    </NavigationContainer>,
  );
  const go = (name: string, params?: object) =>
    act(() => {
      (ref.navigate as (n: string, p?: object) => void)(name, params);
    });
  return {ref, go};
}

describe('presale routes follow the chain (S13)', () => {
  it.each([
    [false, 'devnet'],
    [true, 'mainnet'],
  ])('dashboard stack, presale=%s (%s)', (presale) => {
    const {ref, go} = mount(presale);
    go('MainTabs');
    const home = findNested(ref.getRootState(), 'HomeTab');
    const names = (home?.routeNames ?? []) as string[];
    expect(names).toContain('Dashboard'); // non-vacuous: the stack was read
    for (const r of DASHBOARD_PRESALE) {
      expect(names.includes(r)).toBe(presale);
    }
  });

  it.each([
    [false, 'devnet'],
    [true, 'mainnet'],
  ])('settings stack: the presale referral, presale=%s (%s)', (presale) => {
    const {ref, go} = mount(presale);
    go('MainTabs', {screen: 'ProfileTab'});
    const profile = findNested(ref.getRootState(), 'ProfileTab');
    const names = (profile?.routeNames ?? []) as string[];
    expect(names).toContain('Settings');
    expect(names.includes('Referral')).toBe(presale);
    // the removed screens have no route in any build
    expect(names).not.toContain('ExportViewKey');
    expect(names).not.toContain('NativeProveDebug');
  });

  it.each([
    [false, 'devnet'],
    [true, 'mainnet'],
  ])('onboarding stack: the Presale step, presale=%s (%s)', (presale) => {
    const {ref, go} = mount(presale);
    go('Onboarding');
    const names = (findNested(ref.getRootState(), 'Onboarding')?.routeNames ?? []) as string[];
    expect(names).toContain('Welcome');
    expect(names.includes('Presale')).toBe(presale);
  });

  it('devnet: onboarding has no Presale step and Success goes straight to the wallet', () => {
    const {ref, go} = mount(false);
    go('Onboarding', {screen: 'Success'});
    const root = ref.getRootState();
    expect(root?.routes[root.index ?? 0]?.name).toBe('MainTabs');
    expect(findNested(root, 'Onboarding')).toBeUndefined(); // replaced, not stacked
  });

  it('mainnet (control): Success goes to the Presale step', () => {
    const {ref, go} = mount(true);
    go('Onboarding', {screen: 'Success'});
    const onboarding = findNested(ref.getRootState(), 'Onboarding');
    expect(onboarding?.routeNames).toContain('Presale');
    const routes = (onboarding?.routes ?? []).map(r => r.name);
    expect(routes[routes.length - 1]).toBe('Presale');
  });

  it('devnet: navigating to Presale by name goes nowhere (positive control: Dashboard is there)', () => {
    const {ref, go} = mount(false);
    go('MainTabs');
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    go('Presale');
    go('Staking');
    const home = findNested(ref.getRootState(), 'HomeTab');
    expect((home?.routes ?? []).map(r => r.name)).toEqual(['Dashboard']);
    err.mockRestore();
  });
});

describe('presale deep links follow the chain (S13)', () => {
  const resolve = (presale: boolean, path: string): string[] => {
    mockPresale = presale;
    let links: typeof import('../deepLinkConfig') | null = null;
    jest.isolateModules(() => {
      links = require('../deepLinkConfig');
    });
    const state = getStateFromPath(path, (links!.deepLinkConfig as LinkingOptions<object>).config);
    const names: string[] = [];
    const walk = (s: AnyState) =>
      s?.routes.forEach(r => {
        names.push(r.name);
        walk(r.state as AnyState);
      });
    walk(state as AnyState);
    return names;
  };

  it.each([
    ['presale', 'Presale'],
    ['stake', 'Staking'],
    ['referral', 'Referral'],
  ])('%s → %s on mainnet, and no such screen on devnet', (path, screen) => {
    expect(resolve(true, path)).toContain(screen);
    expect(resolve(false, path)).not.toContain(screen);
  });

  it('devnet keeps the other links (control): dashboard, receive', () => {
    expect(resolve(false, 'dashboard')).toContain('Dashboard');
    expect(resolve(false, 'receive')).toContain('ReceiveModal');
  });
});
