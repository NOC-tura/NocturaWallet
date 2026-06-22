// Mirror the REAL library's export shape: named exports only, NO default export
// (the real index.js does `export { fetch, getCookies, removeCookieByName }`).
// A default-export mock previously masked a default-vs-named import bug in
// pinnedFetch — keep this matching reality so tests catch that class of bug.
export const fetch = jest.fn(
  async (_url: string, _options?: Record<string, unknown>) => ({
    status: 200,
    headers: {},
    bodyString: '',
    json: async () => ({}),
    text: async () => '',
  }),
);

export const getCookies = jest.fn(async () => ({}));
export const removeCookieByName = jest.fn(async () => undefined);

export function __reset(): void {
  fetch.mockClear();
}
