import {Platform} from 'react-native';
import {pinnedFetch} from '../sslPinning/pinnedFetch';
import {API_BASE} from '../../constants/programs';
import {useSecureSettingsStore} from '../../store/zustand/secureSettingsStore';
import {
  ALL_NOTIFICATION_TYPES,
  NOTIFICATION_ROUTES,
  type NotificationPayload,
  type NotificationType,
} from './types';

type NavigationRef = {
  navigate: (screen: string) => void;
} | null;

let _navigationRef: NavigationRef = null;

export function setNavigationRef(ref: NavigationRef): void {
  _navigationRef = ref;
}

/**
 * Maps each notification type to its store getter key and setter name.
 * Privacy-safe: all notification types default to false (opt-in only).
 */
const STORE_KEYS: Record<
  NotificationType,
  {
    getter: 'notifIncomingTx' | 'notifStakingReward' | 'notifTxConfirmed' | 'notifSecurityAlert';
    setter:
      | 'setNotifIncomingTx'
      | 'setNotifStakingReward'
      | 'setNotifTxConfirmed'
      | 'setNotifSecurityAlert';
  }
> = {
  incoming_tx: {getter: 'notifIncomingTx', setter: 'setNotifIncomingTx'},
  staking_reward: {getter: 'notifStakingReward', setter: 'setNotifStakingReward'},
  tx_confirmed: {getter: 'notifTxConfirmed', setter: 'setNotifTxConfirmed'},
  security_alert: {getter: 'notifSecurityAlert', setter: 'setNotifSecurityAlert'},
};

export class NotificationManager {
  private deviceToken: string | null = null;

  /**
   * Requests OS-level notification permission.
   * Returns true when permission is granted or already held.
   * Stub implementation — real integration requires @notifee/react-native or
   * react-native-push-notification-ios native setup.
   */
  async requestPermission(): Promise<boolean> {
    return true;
  }

  /**
   * Returns whether the user has opted into a specific notification type.
   * Reads directly from the secure settings store (opt-in defaults to false).
   */
  isEnabled(type: NotificationType): boolean {
    const state = useSecureSettingsStore.getState();
    return state[STORE_KEYS[type].getter];
  }

  /**
   * Toggles a notification type on or off in the secure settings store.
   */
  setEnabled(type: NotificationType, enabled: boolean): void {
    const state = useSecureSettingsStore.getState();
    state[STORE_KEYS[type].setter](enabled);
  }

  /**
   * Returns the list of notification types the user has opted into.
   */
  getEnabledTypes(): NotificationType[] {
    return ALL_NOTIFICATION_TYPES.filter(type => this.isEnabled(type));
  }

  /**
   * Registers the device push token with the Noctura backend.
   * Only submits the types the user has enabled — privacy-safe: server never
   * learns which types the user rejected.
   *
   * POST /v1/notifications/register
   * Body: { token, platform, types }
   */
  async registerToken(): Promise<void> {
    const enabledTypes = this.getEnabledTypes();
    if (enabledTypes.length === 0) return;
    const token = this.deviceToken ?? 'stub-device-token';

    await pinnedFetch(`${API_BASE}/v1/notifications/register`, {
      method: 'POST',
      body: JSON.stringify({
        token,
        platform: Platform.OS,
        types: enabledTypes,
      }),
    });
  }

  /**
   * Removes the device push token from the Noctura backend.
   * Called on wallet wipe or sign-out.
   *
   * DELETE /v1/notifications/unregister
   * Body: { token }
   */
  async unregisterToken(): Promise<void> {
    const token = this.deviceToken ?? 'stub-device-token';

    await pinnedFetch(`${API_BASE}/v1/notifications/unregister`, {
      method: 'DELETE',
      body: JSON.stringify({token}),
    });
  }

  /**
   * Handles an incoming push notification payload by navigating to the
   * appropriate screen. No-ops silently if navigation ref is not set.
   */
  handleNotification(payload: NotificationPayload): void {
    if (_navigationRef === null) {
      return;
    }
    const route = NOTIFICATION_ROUTES[payload.type];
    _navigationRef.navigate(route);
  }
}

export const notificationManager = new NotificationManager();
