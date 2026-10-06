import type {PageMode} from './mode';
import type {PageDeps} from './page';
import {mountAccounts} from './screens/accounts';
import {mountChangePassword} from './screens/changePassword';
import {mountDelete} from './screens/delete';
import {mountPasskeyManage} from './screens/passkeyManage';
import {createCreateRun} from './screens/createRun';
import {mountForgot} from './screens/forgot';
import {createImportRun} from './screens/importRun';
import {mountPassword} from './screens/password';
import {mountReauth} from './screens/reauth';
import {createRestoreRun} from './screens/restoreRun';
import {createRetryRun} from './screens/retryRun';
import {mountReveal} from './screens/reveal';
import {mountUnlock} from './screens/unlock';

/**
 * unlock.html?mode=… → the one run this page shows (spec B1b-2a §1.2). Each screen is mounted once per
 * page; the welcome → create → import runs share one page (and #5 and the page's store tracker), so a new
 * phrase never crosses a navigation. The vault page renders only its own fixed strings (strings.ts,
 * unlock.html), the user's own words and, on #10, the re-validated challenge fields; it never touches the
 * network (the background reads, for public keys only) and never writes storage (the background is
 * v1_vault's one writer). Every screen uses the page's one busy gate (PageDeps.gate, cardinal rule 6).
 */
export function startMode(mode: PageMode, deps: PageDeps): void {
  switch (mode.mode) {
    case 'welcome':
    case 'create':
    case 'import': {
      // #39's restore (Task 12) and #40's "Try a different seed" (Task 13): the two E5 paths on #8.
      if (mode.mode === 'import' && mode.source === 'forgot') {
        void createRestoreRun(deps, {password: mountPassword(deps)}).show();
        return;
      }
      if (mode.mode === 'import' && mode.source === 'retry') {
        void createRetryRun(deps, {password: mountPassword(deps)}).show();
        return;
      }
      const password = mountPassword(deps);
      const create = createCreateRun(deps, {password, importRun: () => imports.show()});
      const imports = createImportRun(deps, {password, back: () => create.start('welcome'), storing: create.storing});
      if (mode.mode === 'import') imports.show();
      else create.start(mode.mode === 'welcome' ? 'welcome' : 'intro');
      return;
    }
    case 'forgot':
      mountForgot(deps).show();
      return;
    case 'reauth':
      void mountReauth(deps).show(mode.challengeId);
      return;
    case 'accounts':
      mountAccounts(deps).show();
      return;
    case 'reveal':
      mountReveal(deps).show();
      return;
    case 'passkey':
      void mountPasskeyManage(deps).show(mode.op);
      return;
    case 'delete':
      void mountDelete(deps).show();
      return;
    case 'password':
      mountChangePassword(deps).show();
      return;
    case 'unlock':
      void mountUnlock(deps).show(mode.returnTo);
      return;
    default:
      // Every PageMode has its screen: a new mode without one does not compile.
      return mode satisfies never;
  }
}
