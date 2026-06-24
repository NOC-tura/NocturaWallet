import {useReferralCaptureStore} from '../referralCaptureStore';

describe('referralCaptureStore', () => {
  it('sets and clears the captured referrer', () => {
    useReferralCaptureStore.getState().setCapturedReferrer('Abc123');
    expect(useReferralCaptureStore.getState().capturedReferrer).toBe('Abc123');
    useReferralCaptureStore.getState().clearCapturedReferrer();
    expect(useReferralCaptureStore.getState().capturedReferrer).toBeNull();
  });
});
