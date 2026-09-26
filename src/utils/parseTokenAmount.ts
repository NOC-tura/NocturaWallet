/**
 * Moved to `core/util/parseTokenAmount.ts` so the web app can use the same
 * implementation. Re-exported here because many screens import from this path, and
 * because `parseTokenAmount.test.ts` is what proves the move changed nothing.
 */
export {
  parseTokenAmount,
  groupInteger,
  formatTokenAmount,
  formatBalanceForDisplay,
} from '../../core/util/parseTokenAmount';
