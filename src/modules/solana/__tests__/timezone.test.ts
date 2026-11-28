/** History spec §5.3: the jest run is pinned to UTC (jest.globalSetup.js), whatever the machine's zone is. */
it('the test run is in UTC', () => {
  expect(process.env.TZ).toBe('UTC');
  expect(new Date(2026, 0, 15, 12).getTimezoneOffset()).toBe(0);
  expect(new Date(2026, 6, 15, 12).getTimezoneOffset()).toBe(0);
});
