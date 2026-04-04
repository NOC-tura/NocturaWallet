const SSLPinning = {
  fetch: jest.fn(async (url: string, options?: Record<string, unknown>) => ({
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
