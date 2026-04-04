import {usePublicSettingsStore} from './publicSettingsStore';
import {useSecureSettingsStore} from './secureSettingsStore';

export function useSettings() {
  const publicSettings = usePublicSettingsStore();
  const secureSettings = useSecureSettingsStore();
  return {...publicSettings, ...secureSettings};
}
