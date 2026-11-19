/**
 * Route-level gating of the shielded screens (spec §12 "Hidden until its plan lands"; M1b screens
 * task). The shielded transfer is HIDDEN — not a hidden button: no route is registered for it, so
 * neither `navigate(name)` nor a deep link can reach it. M1c Task 8 adds the unshield run
 * (`UnshieldRun`), registered in the shielded build only and reachable by NO deep link. This
 * suite renders the REAL RootNavigator (only the splash is stubbed) and reads the
 * registered route names, and resolves the real deep-link config with React Navigation's own
 * `getStateFromPath`.
 */
import React from 'react';
import {render, act} from '@testing-library/react-native';
import {NavigationContainer, createNavigationContainerRef, getStateFromPath} from '@react-navigation/native';
import {RootNavigator} from '../Navigator';
import type {LinkingOptions} from '@react-navigation/native';

jest.mock('../../screens/SplashScreen', () => ({SplashScreen: () => null}));

type Flags = {shielded: boolean};
let mockFlags: Flags = {shielded: false};
jest.mock('../../constants/features', () => {
  const actual = jest.requireActual('../../constants/features');
  return {...actual, isShieldedEnabled: () => mockFlags.shielded};
});
// #13 Receive, stubbed: records the props the route hands it.
const mockReceiveProps: Array<{address: string; shielded?: boolean}> = [];
jest.mock('../../screens/transparent/ReceiveScreen', () => ({
  ReceiveScreen: (p: {address: string; shielded?: boolean}) => {
    mockReceiveProps.push(p);
    return null;
  },
}));

/** The shield flow M1b registers in the devnet build, and M1c's unshield run (Task 8). */
const SHIELD_FLOW = [
  'ShieldedExplainer',
  'ShieldUnshieldModal',
  'ZkProofModal',
  'ShieldSimulate',
  'ShieldConfirm',
  'ShieldStatus',
  'UnshieldRun',
];
/** Still hidden: the shielded transfer (M1c does not land it) and the v1 screens they replaced. */
const HIDDEN = ['ShieldedTransfer', 'ShieldedBalance', 'Deposit', 'Withdraw'];

/** The deep-link config is built at import: load it under `f` in a fresh registry. */
function loadLinks(f: Flags): typeof import('../deepLinkConfig') {
  mockFlags = f;
  let links: typeof import('../deepLinkConfig') | null = null;
  jest.isolateModules(() => {
    links = require('../deepLinkConfig');
  });
  return links!;
}

/** RootNavigator reads the flags while rendering: render it under `f`. */
function routeNames(f: Flags): {
  names: string[];
  ref: ReturnType<typeof createNavigationContainerRef>;
  r: ReturnType<typeof render>;
} {
  mockFlags = f;
  const ref = createNavigationContainerRef();
  const r = render(
    <NavigationContainer ref={ref}>
      <RootNavigator />
    </NavigationContainer>,
  );
  return {names: (ref.getRootState()?.routeNames ?? []) as string[], ref, r};
}

describe('shielded routes (route-level gating)', () => {
  it('devnet build (shielded on): the shield flow and the unshield run are registered; the transfer is not', () => {
    const {names} = routeNames({shielded: true});
    expect(names).toEqual(expect.arrayContaining(SHIELD_FLOW));
    for (const h of HIDDEN) {
      expect(names).not.toContain(h);
    }
  });

  it('production build (shielded off): no shielded route at all (positive control: the core routes are there)', () => {
    const {names} = routeNames({shielded: false});
    expect(names).toEqual(expect.arrayContaining(['MainTabs', 'SendModal', 'ReceiveModal']));
    for (const r of [...SHIELD_FLOW, ...HIDDEN]) {
      expect(names).not.toContain(r);
    }
  });

  it('navigating to a hidden route by name goes nowhere (the route does not exist); a shield route does', () => {
    const {ref} = routeNames({shielded: true});
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    const before = ref.getRootState()?.routes.map(r => r.name);
    act(() => {
      (ref.navigate as (n: string, p?: object) => void)('ShieldedTransfer', {});
    });
    expect(ref.getRootState()?.routes.map(r => r.name)).toEqual(before);
    // positive control: a registered shield route IS reachable by name, under the same render
    act(() => {
      (ref.navigate as (n: string, p?: object) => void)('ShieldUnshieldModal', {direction: 'private'});
    });
    expect(ref.getRootState()?.routes.map(r => r.name)).toEqual([...(before ?? []), 'ShieldUnshieldModal']);
    err.mockRestore();
  });
});

describe('#16 both sides (M1c Task 8)', () => {
  it('{direction: "public"} opens the unshield side; {direction: "private"} (and none) the shield side', async () => {
    const {ref, r} = routeNames({shielded: true});
    await act(async () => {
      (ref.navigate as (n: string, p?: object) => void)('ShieldUnshieldModal', {direction: 'public'});
    });
    expect(r.queryByTestId('unshield-cta')).not.toBeNull();
    expect(r.queryByTestId('shield-cta')).toBeNull();
    await act(async () => {
      ref.goBack();
    });
    await act(async () => {
      (ref.navigate as (n: string, p?: object) => void)('ShieldUnshieldModal', {direction: 'private'});
    });
    expect(r.queryByTestId('shield-cta')).not.toBeNull();
    expect(r.queryByTestId('unshield-cta')).toBeNull();
  });
});

describe('shielded deep links', () => {
  const resolve = (f: Flags, path: string): string[] => {
    const links = loadLinks(f);
    const state = getStateFromPath(path, (links.deepLinkConfig as LinkingOptions<object>).config);
    const names: string[] = [];
    const walk = (s: {routes: {name: string; state?: unknown}[]} | undefined) =>
      s?.routes.forEach(r => {
        names.push(r.name);
        walk(r.state as {routes: {name: string; state?: unknown}[]} | undefined);
      });
    walk(state as {routes: {name: string; state?: unknown}[]} | undefined);
    return names;
  };

  it('devnet: noctura://deposit opens #16 (the shield side); withdraw / transfer reach no shielded screen', () => {
    expect(resolve({shielded: true}, 'deposit')).toEqual(['ShieldUnshieldModal']);
    for (const p of ['withdraw', 'transfer', 'unshield', 'UnshieldRun', 'unshield-run']) {
      const names = resolve({shielded: true}, p);
      for (const r of [...SHIELD_FLOW, ...HIDDEN]) {
        expect(names).not.toContain(r);
      }
    }
  });

  it('devnet: the config has no entry for a hidden screen', () => {
    const links = loadLinks({shielded: true});
    const screens = (links.deepLinkConfig.config as {screens: Record<string, unknown>}).screens;
    for (const h of HIDDEN) {
      expect(screens[h]).toBeUndefined();
    }
    expect(screens.ShieldUnshieldModal).toBe('deposit');
  });

  it('production: deposit is not a shielded link', () => {
    expect(resolve({shielded: false}, 'deposit')).not.toContain('ShieldUnshieldModal');
  });
});

describe('#13 Receive: transparent only until M2 (spec §12 I9)', () => {
  it('a ReceiveModal opened with {shielded: true} (stale or deep-linked) still shows the transparent address, never a shielded one', () => {
    const {ref} = routeNames({shielded: true});
    mockReceiveProps.length = 0;
    act(() => {
      (ref.navigate as (n: string, p?: object) => void)('ReceiveModal', {shielded: true});
    });
    expect(mockReceiveProps.length).toBeGreaterThan(0); // non-vacuous: the route rendered
    for (const p of mockReceiveProps) {
      expect(p.shielded).toBeUndefined();
    }
  });
});
