// Mirror the REAL library's export shape: named exports only, NO default export
// (the real index.js does `export { fetch, getCookies, removeCookieByName }`).
// A default-export mock previously masked a default-vs-named import bug in
// pinnedFetch — keep this matching reality so tests catch that class of bug.
//
// It must also mirror the library's BEHAVIOUR, and the non-obvious half is:
// **the real fetch REJECTS on every non-2xx.** The native module invokes its
// callback with the response as the ERROR argument whenever
// `!okHttpResponse.isSuccessful()` (RNSslPinningModule.java:238-241), and the JS
// wrapper then does `deferred.reject(data)` with a plain object (index.js:43).
//
// A mock that resolved for every status let 17 relayerSubmit error-path tests
// pass against a control flow that could not execute on a device — the same
// class of bug as the export-shape one above, one layer down. Use
// `__setResponse({status})` to drive a non-2xx and get the real rejection.

interface MockResponse {
  status: number;
  headers: Record<string, string>;
  bodyString: string;
}

let nextResponse: MockResponse = {status: 200, headers: {}, bodyString: ''};

/** Queue the response the native layer will produce for the next call(s). */
export function __setResponse(partial: Partial<MockResponse>): void {
  nextResponse = {status: 200, headers: {}, bodyString: '', ...partial};
}

async function defaultFetch(_url: string, _options?: Record<string, unknown>) {
  const {status, headers, bodyString} = nextResponse;
  const payload = {
    status,
    headers,
    bodyString,
    json: async () => (bodyString ? JSON.parse(bodyString) : {}),
    text: async () => bodyString,
  };
  // The real library rejects with the response object on any non-2xx.
  if (status < 200 || status >= 300) {
    throw payload;
  }
  return payload;
}

export const fetch = jest.fn(defaultFetch);

export const getCookies = jest.fn(async () => ({}));
export const removeCookieByName = jest.fn(async () => undefined);

export function __reset(): void {
  // mockClear alone leaves a mockRejectedValue/mockResolvedValue from a previous
  // test installed, so one test's override silently leaks into the next.
  // Reinstate the real behaviour, not just an empty call log.
  fetch.mockReset();
  fetch.mockImplementation(defaultFetch);
  nextResponse = {status: 200, headers: {}, bodyString: ''};
}
