/**
 * History spec §5.3: the test run's time zone is pinned, so no test depends on the machine it runs on
 * (CI is UTC; a developer's laptop is not). Set before the workers start: they inherit it.
 */
module.exports = async () => {
  process.env.TZ = 'UTC';
};
