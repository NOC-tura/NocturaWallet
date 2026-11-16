/**
 * Route-level gating of the shielded screens (spec §12 "Hidden until its plan lands"; M1b screens
 * task). Between M1b and M1c, #16's unshield side and the shielded transfer are HIDDEN — not a
 * hidden button: no route is registered for them, so neither `navigate(name)` nor a deep link can
 * reach them. This suite renders the REAL RootNavigator (only the splash is stubbed) and reads the
 * registered route names, and resolves the real deep-link config with React Navigation's own
 * `getStateFromPath`.
 */
import React from 'react';
import {render, act} from '@testing-library/react-native';
import {NavigationContainer, createNavigationContainerRef, getStateFromPath} from '@react-navigation/native';
import {RootNavigator} from '../Navigator';
import type {LinkingOptions} from '@react-navigation/native';

jest.mock('../../screens/SplashScreen', () => ({SplashScreen: () => null}));

type Flags = {shielded: boolean; shieldedTransfer: boolean};
let mockFlags: Flags = {shielded: false, shieldedTransfer: false};
jest.mock('../../constants/features', () => {
  const actual = jest.requireActual('../../constants/features');
  return {
    ...actual,
    isShieldedEnabled: () => mockFlags.shielded,
    isShieldedTransferEnabled: () => mockFlags.shielded && mockFlags.shieldedTransfer,
  };
});

/** The shield flow M1b registers in the devnet build. */
const SHIELD_FLOW = ['ShieldedExplainer', 'ShieldUnshieldModal', 'ZkProofModal', 'ShieldSimulate', 'ShieldConfirm', 'ShieldStatus'];
/** Hidden until M1c (and the v1 screens they replaced). */
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
function routeNames(f: Flags): {names: string[]; ref: ReturnType<typeof createNavigationContainerRef>} {
  mockFlags = f;
  const ref = createNavigationContainerRef();
  render(
    <NavigationContainer ref={ref}>
      <RootNavigator />
    </NavigationContainer>,
  );
  return {names: (ref.getRootState()?.routeNames ?? []) as string[], ref};
}

describe('shielded routes (route-level gating)', () => {
  it('devnet build (shielded on): the shield flow is registered; the unshield side and the transfer are not — even with SHIELDED_TRANSFER=true', () => {
    const {names} = routeNames({shielded: true, shieldedTransfer: true});
    expect(names).toEqual(expect.arrayContaining(SHIELD_FLOW));
    for (const h of HIDDEN) {
      expect(names).not.toContain(h);
    }
  });

  it('production build (shielded off): no shielded route at all (positive control: the core routes are there)', () => {
    const {names} = routeNames({shielded: false, shieldedTransfer: false});
    expect(names).toEqual(expect.arrayContaining(['MainTabs', 'SendModal', 'ReceiveModal']));
    for (const r of [...SHIELD_FLOW, ...HIDDEN]) {
      expect(names).not.toContain(r);
    }
  });

  it('navigating to a hidden route by name goes nowhere (the route does not exist); a shield route does', () => {
    const {ref} = routeNames({shielded: true, shieldedTransfer: true});
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
    expect(resolve({shielded: true, shieldedTransfer: true}, 'deposit')).toEqual(['ShieldUnshieldModal']);
    for (const p of ['withdraw', 'transfer', 'unshield']) {
      const names = resolve({shielded: true, shieldedTransfer: true}, p);
      for (const r of [...SHIELD_FLOW, ...HIDDEN]) {
        expect(names).not.toContain(r);
      }
    }
  });

  it('devnet: the config has no entry for a hidden screen', () => {
    const links = loadLinks({shielded: true, shieldedTransfer: true});
    const screens = (links.deepLinkConfig.config as {screens: Record<string, unknown>}).screens;
    for (const h of HIDDEN) {
      expect(screens[h]).toBeUndefined();
    }
    expect(screens.ShieldUnshieldModal).toBe('deposit');
  });

  it('production: deposit is not a shielded link', () => {
    expect(resolve({shielded: false, shieldedTransfer: false}, 'deposit')).not.toContain('ShieldUnshieldModal');
  });
});

