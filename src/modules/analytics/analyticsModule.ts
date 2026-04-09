import {Platform} from 'react-native';
import {pinnedFetch} from '../sslPinning/pinnedFetch';
import {API_BASE} from '../../constants/programs';
import {usePublicSettingsStore} from '../../store/zustand/publicSettingsStore';
import type {AnalyticsEvent, AnalyticsPayload} from './types';

const APP_VERSION = '1.0.0';
const BATCH_SIZE = 50;

export class AnalyticsManager {
  private _queue: AnalyticsPayload[] = [];

  /**
   * Track an analytics event.
   * No-op if the user has opted out of analytics.
   */
  track(event: AnalyticsEvent): void {
    if (this.isOptedOut()) {
      return;
    }

    const platform = Platform.OS === 'ios' ? 'ios' : 'android';

    const payload: AnalyticsPayload = {
      event,
      timestamp_utc: Date.now(),
      app_version: APP_VERSION,
      platform,
    };

    this._queue.push(payload);
  }

  /**
   * Flush the event queue by POSTing batches of up to 50 events.
   * If the queue is empty, returns immediately without making any network call.
   */
  async flush(): Promise<void> {
    if (this._queue.length === 0) {
      return;
    }

    const toSend = this._queue.splice(0, this._queue.length);

    for (let i = 0; i < toSend.length; i += BATCH_SIZE) {
      const batch = toSend.slice(i, i + BATCH_SIZE);
      try {
        await pinnedFetch(`${API_BASE}/v1/analytics/event`, {
          method: 'POST',
          body: JSON.stringify({events: batch}),
        });
      } catch {
        // Re-add unsent events (this batch + remaining) back to queue for retry
        const unsent = toSend.slice(i);
        this._queue.unshift(...unsent);
        return;
      }
    }
  }

  /**
   * Returns true if the user has opted out of analytics.
   */
  isOptedOut(): boolean {
    return usePublicSettingsStore.getState().analyticsOptOut;
  }

  /**
   * Number of events currently in the queue. Intended for testing.
   */
  get queueSize(): number {
    return this._queue.length;
  }

  /**
   * Clears the internal queue. Intended for testing.
   */
  _resetQueue(): void {
    this._queue = [];
  }
}

export const analyticsManager = new AnalyticsManager();
