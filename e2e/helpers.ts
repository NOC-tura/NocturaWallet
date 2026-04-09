/**
 * E2E test helpers for Detox.
 *
 * IMPORTANT: These tests assume a wallet is already set up.
 * Before running E2E tests, either:
 * 1. Run the onboarding E2E test first (creates wallet state)
 * 2. Pre-seed the device keychain with a test wallet
 *
 * The navigateToDashboard helper waits for the dashboard to be visible
 * after app launch (handles Splash → Unlock → Dashboard flow).
 */
import {by, element, expect, waitFor} from 'detox';

/** Wait for dashboard to be visible (handles splash/unlock flow) */
export async function waitForDashboard(): Promise<void> {
  await waitFor(element(by.id('dashboard-screen')))
    .toBeVisible()
    .withTimeout(10000);
}

/** Navigate to a specific tab */
export async function navigateToTab(tabName: string): Promise<void> {
  await waitForDashboard();
  await element(by.text(tabName)).tap();
}

/** Navigate to Settings > specific sub-screen */
export async function navigateToSettings(subScreen?: string): Promise<void> {
  await navigateToTab('Settings');
  if (subScreen) {
    await element(by.text(subScreen)).tap();
  }
}
