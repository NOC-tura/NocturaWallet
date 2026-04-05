import {mmkvPublic} from '../store/mmkv/instances';
import {MMKV_KEYS} from '../constants/mmkvKeys';
import {useNetworkStatus} from './useNetworkStatus';
import {useState, useCallback} from 'react';

interface DashboardBanners {
  showBackupBanner: boolean;
  showOfflineBanner: boolean;
  showUpdateBanner: boolean;
  canDismissBackup: boolean;
  dismissBackup: () => void;
}

export function useDashboardBanners(updateAvailable: boolean = false): DashboardBanners {
  const {isOnline} = useNetworkStatus();
  // Initialize from MMKV so dismiss persists across re-mounts within same session
  const [dismissed, setDismissed] = useState(
    () => mmkvPublic.getString(MMKV_KEYS.BACKUP_DISMISSED_SESSION) === 'true',
  );

  // Backup needed check
  const onboardingCompleted = mmkvPublic.getString(MMKV_KEYS.ONBOARDING_COMPLETED) === 'true';
  const seedConfirmed = mmkvPublic.getString(MMKV_KEYS.ONBOARDING_SEED_CONFIRMED) === 'true';
  const backupNeeded = onboardingCompleted && !seedConfirmed;

  // Dismiss count
  const dismissCountStr = mmkvPublic.getString(MMKV_KEYS.BACKUP_DISMISSED_COUNT);
  const dismissCount = dismissCountStr ? parseInt(dismissCountStr, 10) : 0;
  const canDismissBackup = dismissCount < 3;

  const dismissBackup = useCallback(() => {
    setDismissed(true);
    mmkvPublic.set(MMKV_KEYS.BACKUP_DISMISSED_SESSION, 'true');
    mmkvPublic.set(MMKV_KEYS.BACKUP_DISMISSED_COUNT, String(dismissCount + 1));
  }, [dismissCount]);

  // Priority: backup > offline > update (never 2 simultaneously)
  const showBackupBanner = backupNeeded && !dismissed;
  const showOfflineBanner = !isOnline && !showBackupBanner;
  const showUpdateBanner = updateAvailable && !showBackupBanner && !showOfflineBanner;

  return {showBackupBanner, showOfflineBanner, showUpdateBanner, canDismissBackup, dismissBackup};
}
