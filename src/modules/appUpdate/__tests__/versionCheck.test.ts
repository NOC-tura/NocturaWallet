import {checkAppVersion} from '../versionCheck';
import {pinnedFetch} from '../../sslPinning/pinnedFetch';

jest.mock('../../sslPinning/pinnedFetch');

const mockPinnedFetch = pinnedFetch as jest.MockedFunction<typeof pinnedFetch>;

function makeMockResponse(data: unknown, status = 200) {
  return {
    status,
    headers: {},
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

describe('checkAppVersion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns ok when API says ok', async () => {
    mockPinnedFetch.mockResolvedValueOnce(
      makeMockResponse({status: 'ok', latestVersion: '1.0.0'}),
    );

    const result = await checkAppVersion();

    expect(result.status).toBe('ok');
  });

  it('returns update_available with storeUrl', async () => {
    mockPinnedFetch.mockResolvedValueOnce(
      makeMockResponse({
        status: 'update_available',
        storeUrl: 'https://apps.apple.com/app/noctura',
        latestVersion: '1.2.0',
      }),
    );

    const result = await checkAppVersion();

    expect(result.status).toBe('update_available');
    expect(result.storeUrl).toBe('https://apps.apple.com/app/noctura');
  });

  it('returns update_required with storeUrl and message', async () => {
    mockPinnedFetch.mockResolvedValueOnce(
      makeMockResponse({
        status: 'update_required',
        storeUrl: 'https://play.google.com/store/apps/noctura',
        message: 'Critical security update required.',
        latestVersion: '2.0.0',
      }),
    );

    const result = await checkAppVersion();

    expect(result.status).toBe('update_required');
    expect(result.storeUrl).toBe('https://play.google.com/store/apps/noctura');
    expect(result.message).toBe('Critical security update required.');
  });

  it('returns ok on network error (never block app)', async () => {
    mockPinnedFetch.mockRejectedValueOnce(new Error('Network request failed'));

    const result = await checkAppVersion();

    expect(result.status).toBe('ok');
  });

  it('returns ok on malformed response', async () => {
    mockPinnedFetch.mockResolvedValueOnce(
      makeMockResponse({unexpected: 'garbage', foo: 42}),
    );

    const result = await checkAppVersion();

    expect(result.status).toBe('ok');
  });
});
