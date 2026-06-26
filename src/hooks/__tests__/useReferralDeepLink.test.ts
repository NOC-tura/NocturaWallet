import {renderHook} from '@testing-library/react-native';
import {Linking} from 'react-native';
import {useReferralDeepLink} from '../useReferralDeepLink';
import {useReferralCaptureStore} from '../../store/zustand/referralCaptureStore';
import {useWalletStore} from '../../store/zustand/walletStore';

const ADDR = '6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd';

beforeEach(() => {
  useReferralCaptureStore.getState().clearCapturedReferrer();
  // Reset publicKey so the self-referral test does not leak into the others.
  useWalletStore.setState({publicKey: null} as never);
  jest
    .spyOn(Linking, 'addEventListener')
    .mockReturnValue({remove: jest.fn()} as never);
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('captures ?ref= from the initial URL', async () => {
  jest
    .spyOn(Linking, 'getInitialURL')
    .mockResolvedValue(`https://noc-tura.io/wallet/presale?ref=${ADDR}`);
  renderHook(() => useReferralDeepLink());
  await new Promise(r => setTimeout(r, 0));
  expect(useReferralCaptureStore.getState().capturedReferrer).toBe(ADDR);
});

it('ignores a URL with no ref', async () => {
  jest
    .spyOn(Linking, 'getInitialURL')
    .mockResolvedValue('https://noc-tura.io/wallet/presale');
  renderHook(() => useReferralDeepLink());
  await new Promise(r => setTimeout(r, 0));
  expect(useReferralCaptureStore.getState().capturedReferrer).toBeNull();
});

it('ignores self-referral (== own publicKey)', async () => {
  useWalletStore.setState({publicKey: ADDR} as never);
  jest
    .spyOn(Linking, 'getInitialURL')
    .mockResolvedValue(`noctura://presale?ref=${ADDR}`);
  renderHook(() => useReferralDeepLink());
  await new Promise(r => setTimeout(r, 0));
  expect(useReferralCaptureStore.getState().capturedReferrer).toBeNull();
});
