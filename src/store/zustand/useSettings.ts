import {usePublicSettingsStore} from './publicSettingsStore';
import {useSecureSettingsStore} from './secureSettingsStore';

/**
 * Convenience hook that merges all public + secure settings.
 *
 * PERFORMANCE NOTE: This subscribes to ALL fields of both stores.
 * Any change to any setting triggers a re-render in all consumers.
 * For performance-sensitive components (e.g., token rows, lists),
 * use individual store hooks with selectors instead:
 *
 *   const hideBalances = usePublicSettingsStore(s => s.hideBalances);
 *   const timeout = useSecureSettingsStore(s => s.sessionTimeoutMinutes);
 */
export function useSettings() {
  const publicSettings = usePublicSettingsStore();
  const secureSettings = useSecureSettingsStore();
  return {...publicSettings, ...secureSettings};
}
