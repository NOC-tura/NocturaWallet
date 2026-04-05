import {Platform} from 'react-native';
import Config from 'react-native-config';
import {pinnedFetch} from '../sslPinning/pinnedFetch';
import {version as APP_VERSION} from '../../../package.json';

export type VersionCheckStatus = 'ok' | 'update_available' | 'update_required';

export interface VersionCheckResult {
  status: VersionCheckStatus;
  storeUrl?: string;
  message?: string;
  latestVersion?: string;
}

const VALID_STATUSES: VersionCheckStatus[] = [
  'ok',
  'update_available',
  'update_required',
];

/**
 * Checks the backend for the current app version status.
 * On ANY error (network, SSL, malformed response) → returns {status: 'ok'}
 * to ensure we never block the user from accessing the app.
 */
export async function checkAppVersion(): Promise<VersionCheckResult> {
  try {
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const url = `${Config.API_BASE}/v1/app/version-check?platform=${platform}&version=${APP_VERSION}`;

    const response = await pinnedFetch(url, {method: 'GET'});
    const data = (await response.json()) as Record<string, unknown>;

    const status = data?.status as string;

    // Validate status is one of our known values
    if (!VALID_STATUSES.includes(status as VersionCheckStatus)) {
      return {status: 'ok'};
    }

    const result: VersionCheckResult = {
      status: status as VersionCheckStatus,
    };

    if (typeof data.storeUrl === 'string') {
      result.storeUrl = data.storeUrl;
    }
    if (typeof data.message === 'string') {
      result.message = data.message;
    }
    if (typeof data.latestVersion === 'string') {
      result.latestVersion = data.latestVersion;
    }

    return result;
  } catch {
    // Never block the app on any error
    return {status: 'ok'};
  }
}
