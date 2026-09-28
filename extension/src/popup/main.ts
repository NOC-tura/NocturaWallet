import {send} from '../ui/send';

// B1a popup: locked/unlocked and the two buttons. The wallet screens arrive in B1b.
interface TabsLike {
  runtime: {getURL(p: string): string};
  tabs: {create(o: {url: string}): Promise<unknown>};
}
const g = globalThis as unknown as {browser?: TabsLike; chrome?: TabsLike};
const api = (g.browser ?? g.chrome) as TabsLike;
const state = document.getElementById('state') as HTMLParagraphElement;
const unlockBtn = document.getElementById('unlock') as HTMLButtonElement;
const lockBtn = document.getElementById('lock') as HTMLButtonElement;

async function refresh(): Promise<void> {
  const r = await send({type: 'vault.status'});
  const data = r.data as {unlocked: boolean; accounts: {publicKey: string}[]} | undefined;
  const unlocked = r.ok && data?.unlocked === true;
  state.textContent = unlocked ? `Unlocked · ${data?.accounts.length ?? 0} account(s)` : 'Locked';
  unlockBtn.hidden = unlocked;
  lockBtn.hidden = !unlocked;
  if (unlocked) void send({type: 'activity.ping'});
}

unlockBtn.addEventListener('click', () => {
  // Unlock happens in a tab: the vault page must survive a click elsewhere, and a passkey
  // prompt closes the popup (spec §2).
  void api.tabs.create({url: api.runtime.getURL('unlock.html')});
  window.close();
});
lockBtn.addEventListener('click', async () => {
  await send({type: 'vault.lock'});
  await refresh();
});
void refresh();
