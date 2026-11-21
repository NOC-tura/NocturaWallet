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
import {useWalletStore} from '../../store/zustand/walletStore';
import type {LinkingOptions} from '@react-navigation/native';

jest.mock('../../screens/SplashScreen', () => ({SplashScreen: () => null}));
// the relayer quote (#16's unshield side asks it when that side opens): counted, answered by the real client
const mockQuoteCalls: unknown[] = [];
jest.mock('../../modules/shielded/a0/relayerClient', () => {
  const actual = jest.requireActual('../../modules/shielded/a0/relayerClient');
  return {
    ...actual,
    fetchA0RelayerQuote: (...a: unknown[]) => {
      mockQuoteCalls.push(a);
      return actual.fetchA0RelayerQuote(...a);
    },
  };
});

type Flags = {shielded: boolean};
let mockFlags: Flags = {shielded: false};
jest.mock('../../constants/features', () => {
  const actual = jest.requireActual('../../constants/features');
  return {...actual, isShieldedEnabled: () => mockFlags.shielded};
});
// #13 Receive, stubbed: records the props the route hands it.
const mockReceiveProps: Array<{address: string; shielded?: boolean; accountLabel?: string}> = []; // M1d: the route now passes the account's name
jest.mock('../../screens/transparent/ReceiveScreen', () => ({
  ReceiveScreen: (p: {address: string; shielded?: boolean; accountLabel?: string}) => { // M1d: the route now passes the account's name
    mockReceiveProps.push(p);
    return null;
  },
}));

// M1d: the route reads the selected account (null = not known yet → the stored main key, as before)
const mockRouteSelected: {current: {address: string; label: string} | null} = {current: null};
jest.mock('../../hooks/useSelectedAccount', () => ({
  useSelectedAccount: () => mockRouteSelected.current,
  useAccountList: () => null,
  useAccounts: () => null,
  useSelectAccount: () => () => true,
  useRefreshAccounts: () => () => undefined,
}));

// #11, stubbed: records the props DashboardScreenNav hands it (UX-A 7: the "Make public" entry).
const mockDashboardProps: Array<{onMakePublic?: () => void; onShield?: () => void}> = [];
jest.mock('../../screens/dashboard/DashboardScreen', () => ({
  DashboardScreen: (p: {onMakePublic?: () => void; onShield?: () => void}) => {
    mockDashboardProps.push(p);
    return null;
  },
}));

// #19 → #20, stubbed: records the requestAuth the route hands #20 (Task 6 carry: #10's recipient in a deposit)
const mockConfirmProps: Array<{requestAuth: (i: unknown) => Promise<boolean>}> = [];
jest.mock('../../screens/shielded/ShieldConfirmScreen', () => ({
  ShieldConfirmScreen: (p: {requestAuth: (i: unknown) => Promise<boolean>}) => {
    mockConfirmProps.push(p);
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

describe('UX-A 7: the dashboard\'s "Make public" opens #16 on the unshield side by IN-APP navigation', () => {
  it('shielded build: onMakePublic navigates to ShieldUnshieldModal {direction: "public"} — a route with no link path, so the I-1 guard opens "Make public"', async () => {
    mockDashboardProps.length = 0;
    mockQuoteCalls.length = 0;
    const {ref, r} = routeNames({shielded: true});
    await act(async () => {
      (ref.navigate as (n: string, p?: object) => void)('MainTabs');
    });
    const props = mockDashboardProps[mockDashboardProps.length - 1];
    expect(props?.onMakePublic).toBeInstanceOf(Function);
    await act(async () => {
      props!.onMakePublic!();
    });
    const route = ref.getCurrentRoute() as {name?: string; path?: string; params?: {direction?: string}} | undefined;
    expect(route?.name).toBe('ShieldUnshieldModal');
    expect(route?.params).toEqual({direction: 'public'});
    expect(route?.path).toBeUndefined();
    expect(r.getByTestId('shield-unshield-title').props.children).toBe('Make public'); // owner phone pass 2026-11-21: the title, not a selected tab
    expect(r.queryByTestId('unshield-cta')).not.toBeNull();
    expect(mockQuoteCalls.length).toBeGreaterThan(0);
  });

  it('M1d (D5): the dashboard is handed no Profile navigation — the avatar opens the Accounts sheet', async () => {
    mockDashboardProps.length = 0;
    const {ref} = routeNames({shielded: true});
    await act(async () => {
      (ref.navigate as (n: string, p?: object) => void)('MainTabs');
    });
    expect(mockDashboardProps.length).toBeGreaterThan(0);
    for (const p of mockDashboardProps) {
      expect('onProfileTap' in (p as Record<string, unknown>)).toBe(false);
    }
  });

  it('production build (no unshield route): the dashboard gets no onMakePublic (positive control: onShield is still passed)', async () => {
    mockDashboardProps.length = 0;
    const {ref} = routeNames({shielded: false});
    await act(async () => {
      (ref.navigate as (n: string, p?: object) => void)('MainTabs');
    });
    const props = mockDashboardProps[mockDashboardProps.length - 1];
    expect(props?.onShield).toBeInstanceOf(Function);
    expect(props?.onMakePublic).toBeUndefined();
  });
});

describe('fix round 1 I-1: no deep link opens the unshield side', () => {
  it('the real config: deposit?direction=public resolves to #16 with direction "private" (noctura:// and https)', () => {
    const links = loadLinks({shielded: true});
    const config = (links.deepLinkConfig as LinkingOptions<object>).config;
    for (const path of ['deposit?direction=public', 'deposit?direction=PUBLIC']) {
      const state = getStateFromPath(path, config) as {routes: {name: string; path?: string; params?: Record<string, unknown>}[]};
      expect(state.routes[0]!.name).toBe('ShieldUnshieldModal');
      expect(state.routes[0]!.params?.direction).toBe('private');
      expect(state.routes[0]!.path).toBe(path); // the route carries the link it came from
    }
    // a repeated key arrives as an ARRAY, which `parse` does not see: the screen side must not trust
    // a linked route's params at all (the next row renders it)
    const twice = getStateFromPath('deposit?direction=public&direction=public', config) as {routes: {path?: string}[]};
    expect(twice.routes[0]!.path).toBe('deposit?direction=public&direction=public');
  });

  it.each([
    'noctura://deposit?direction=public',
    'https://noc-tura.io/deposit?direction=public',
    'noctura://deposit?direction=public&direction=public',
  ])('%s, opened through the REAL linking: the shield side ("Make private"), no relayer quote', async URL_PUBLIC => {
    const links = loadLinks({shielded: true});
    mockQuoteCalls.length = 0;
    const ref = createNavigationContainerRef();
    const linking = {
      ...(links.deepLinkConfig as LinkingOptions<object>),
      getInitialURL: async () => URL_PUBLIC,
      subscribe: () => () => undefined,
    };
    const r = render(
      <NavigationContainer ref={ref} linking={linking}>
        <RootNavigator />
      </NavigationContainer>,
    );
    await act(async () => {});
    await act(async () => {});
    expect((ref.getCurrentRoute() as {name?: string} | undefined)?.name).toBe('ShieldUnshieldModal'); // non-vacuous: the link landed on #16
    expect(r.getByTestId('shield-unshield-title').props.children).toBe('Make private'); // owner phone pass 2026-11-21: the title, not a selected tab
    expect(r.queryAllByRole('tab')).toHaveLength(0);
    expect(r.queryByTestId('shield-cta')).not.toBeNull();
    expect(r.queryByTestId('unshield-cta')).toBeNull();
    expect(mockQuoteCalls).toHaveLength(0);
  });

  it('the Navigator alone holds it: the same link through the real config with its `parse` REMOVED still opens "Make private"', async () => {
    const links = loadLinks({shielded: true});
    const base = links.deepLinkConfig as LinkingOptions<object>;
    const screens = {...(base.config as {screens: Record<string, unknown>}).screens, ShieldUnshieldModal: 'deposit'};
    mockQuoteCalls.length = 0;
    const ref = createNavigationContainerRef();
    const linking = {
      ...base,
      config: {...base.config, screens} as LinkingOptions<object>['config'],
      getInitialURL: async () => 'noctura://deposit?direction=public',
      subscribe: () => () => undefined,
    };
    // control on the stripped config: the link DOES carry direction "public" into the params
    expect((getStateFromPath('deposit?direction=public', linking.config) as {routes: {params?: {direction?: string}}[]}).routes[0]!.params?.direction).toBe('public');
    const r = render(
      <NavigationContainer ref={ref} linking={linking}>
        <RootNavigator />
      </NavigationContainer>,
    );
    await act(async () => {});
    await act(async () => {});
    expect((ref.getCurrentRoute() as {name?: string} | undefined)?.name).toBe('ShieldUnshieldModal');
    expect(r.getByTestId('shield-unshield-title').props.children).toBe('Make private'); // owner phone pass 2026-11-21
    expect(r.queryByTestId('unshield-cta')).toBeNull();
    expect(mockQuoteCalls).toHaveLength(0);
  });

  it('positive control: in-app navigation with {direction: "public"} does open the unshield side and asks the quote', async () => {
    mockQuoteCalls.length = 0;
    const {ref, r} = routeNames({shielded: true});
    await act(async () => {
      (ref.navigate as (n: string, p?: object) => void)('ShieldUnshieldModal', {direction: 'public'});
    });
    expect(r.queryByTestId('unshield-cta')).not.toBeNull();
    expect(r.getByTestId('shield-unshield-title').props.children).toBe('Make public'); // owner phone pass 2026-11-21
    expect(mockQuoteCalls.length).toBeGreaterThan(0);
  });

  it('owner phone pass 2026-11-21: in-app navigation with NO direction opens Make private (today\'s default), no quote', async () => {
    mockQuoteCalls.length = 0;
    const {ref, r} = routeNames({shielded: true});
    await act(async () => {
      (ref.navigate as (n: string, p?: object) => void)('ShieldUnshieldModal');
    });
    expect((ref.getCurrentRoute() as {name?: string} | undefined)?.name).toBe('ShieldUnshieldModal'); // non-vacuous
    expect(r.getByTestId('shield-unshield-title').props.children).toBe('Make private');
    expect(r.queryByTestId('shield-cta')).not.toBeNull();
    expect(r.queryByTestId('unshield-cta')).toBeNull();
    expect(mockQuoteCalls).toHaveLength(0);
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
    expect(screens.ShieldUnshieldModal).toMatchObject({path: 'deposit'});
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

  it('M1d (spec §4.2): ReceiveModal shows the SELECTED account\'s address and name', () => {
    mockRouteSelected.current = {address: '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k', label: 'Account 4'};
    useWalletStore.setState({publicKey: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'}); // the main key is set, so the selection must beat it
    const {ref} = routeNames({shielded: true});
    mockReceiveProps.length = 0;
    act(() => {
      (ref.navigate as (n: string, p?: object) => void)('ReceiveModal');
    });
    expect(mockReceiveProps.length).toBeGreaterThan(0);
    const last = mockReceiveProps[mockReceiveProps.length - 1]!;
    expect(last.address).toBe('3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k');
    expect(last.accountLabel).toBe('Account 4');
    mockRouteSelected.current = null;
    useWalletStore.setState({publicKey: null});
  });
});

describe('Shielded UX part B Task 6 carry: #10 names the pool by its plain word during a deposit', () => {
  it('ShieldConfirm\'s requestAuth opens UnlockSend with recipient "Pool" (and the SOL network fee)', async () => {
    mockConfirmProps.length = 0;
    const {ref} = routeNames({shielded: true});
    const intent = {kind: 'shield', preparedId: 'p1', amount: '1000000000', tokenSymbol: 'TEST', decimals: 9, depositor: 'D'};
    await act(async () => {
      (ref.navigate as (n: string, p?: object) => void)('ShieldConfirm', {intent});
    });
    expect(mockConfirmProps.length).toBeGreaterThan(0);
    // the pending auth promise never settles here; only the navigation it triggers is read
    mockConfirmProps[mockConfirmProps.length - 1]!.requestAuth(intent).catch(() => {});
    await act(async () => {});
    const route = ref.getCurrentRoute() as {name?: string; params?: {recipient?: string; ticker?: string; networkFee?: string}} | undefined;
    expect(route?.name).toBe('UnlockSend');
    expect(route?.params?.recipient).toBe('Pool');
    expect(route?.params?.ticker).toBe('TEST');
    expect(route?.params?.networkFee).toMatch(/ SOL$/);
  });
});
