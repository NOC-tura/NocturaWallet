const SSLPinning = {
  fetch: jest.fn(async (_url: string, _options?: Record<string, unknown>) => ({
    status: 200,
    headers: {},
    json: async () => ({}),
    text: async () => '',
    bodyString: '',
  })),

  __reset() {
    SSLPinning.fetch.mockClear();
  },
};

export default SSLPinning;
