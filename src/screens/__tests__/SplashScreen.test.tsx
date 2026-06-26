import React from 'react';
import {render, waitFor} from '@testing-library/react-native';
import {resolveSplashRoute, SplashScreen} from '../SplashScreen';
import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import * as versionCheck from '../../modules/appUpdate/versionCheck';

beforeEach(() => {
  mmkvPublic.clearAll();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SplashScreen force-update routing', () => {
  it('fires onForceUpdate (and NOT onRouteResolved) when update_required', async () => {
    jest
      .spyOn(versionCheck, 'checkAppVersion')
      .mockResolvedValue({status: 'update_required', storeUrl: 'https://s', message: 'm'});
    const onForceUpdate = jest.fn();
    const onRouteResolved = jest.fn();
    render(
      <SplashScreen onForceUpdate={onForceUpdate} onRouteResolved={onRouteResolved} />,
    );
    await waitFor(
      () =>
        expect(onForceUpdate).toHaveBeenCalledWith(
          expect.objectContaining({status: 'update_required'}),
        ),
      {timeout: 3000},
    );
    expect(onRouteResolved).not.toHaveBeenCalled();
  });

  it('fires onRouteResolved when status is ok', async () => {
    jest.spyOn(versionCheck, 'checkAppVersion').mockResolvedValue({status: 'ok'});
    const onForceUpdate = jest.fn();
    const onRouteResolved = jest.fn();
    render(
      <SplashScreen onForceUpdate={onForceUpdate} onRouteResolved={onRouteResolved} />,
    );
    await waitFor(() => expect(onRouteResolved).toHaveBeenCalled(), {timeout: 3000});
    expect(onForceUpdate).not.toHaveBeenCalled();
  });
});

describe('resolveSplashRoute', () => {
  it('returns Onboarding when no wallet exists', async () => {
    const route = await resolveSplashRoute();
    expect(route).toBe('Onboarding');
  });

  it('returns Onboarding when wallet exists but onboarding not completed', async () => {
    mmkvPublic.set(MMKV_KEYS.WALLET_EXISTS, 'true');
    const route = await resolveSplashRoute();
    expect(route).toBe('Onboarding');
  });

  it('returns Unlock when wallet exists and onboarding completed', async () => {
    mmkvPublic.set(MMKV_KEYS.WALLET_EXISTS, 'true');
    mmkvPublic.set(MMKV_KEYS.ONBOARDING_COMPLETED, 'true');
    const route = await resolveSplashRoute();
    expect(route).toBe('Unlock');
  });

  it('returns Unlock even with session timestamp in MMKV (session check is in-memory)', async () => {
    mmkvPublic.set(MMKV_KEYS.WALLET_EXISTS, 'true');
    mmkvPublic.set(MMKV_KEYS.ONBOARDING_COMPLETED, 'true');
    mmkvPublic.set(MMKV_KEYS.SESSION_LAST_ACTIVE, String(Date.now()));
    const route = await resolveSplashRoute();
    expect(route).toBe('Unlock');
  });
});
