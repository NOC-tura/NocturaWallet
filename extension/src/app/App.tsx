import {useEffect, useLayoutEffect, useReducer, useRef, useState} from 'react';
import {WalletProvider, useWallet, type Surface} from './WalletContext';
import {createEngine, type Engine, type HistoryItem, type Intent} from './engine';
import {browserPlatform, type Platform} from './platform';
import {FLOW, TAB_ONLY, firstRoute, routeReducer, type Route} from './router';
import {draftOf, type Draft} from './send/rules';
import {TabBar} from './ui/TabBar';
import {CancelledToast} from './ui/CancelledToast';
import {Home} from './screens/Home';
import {Locked} from './screens/Locked';
import {NoWallet} from './screens/NoWallet';
import {Switcher} from './screens/Switcher';
import {Receive} from './screens/Receive';
import {Activity} from './screens/Activity';
import {TxDetail} from './screens/TxDetail';
import {Settings} from './screens/Settings';
import {About} from './screens/About';
import {Passkey} from './screens/Passkey';
import {AccountsManager} from './screens/AccountsManager';
import {DeleteWallet} from './screens/DeleteWallet';
import {Security} from './screens/Security';
import {Created} from './screens/Created';
import {Imported} from './screens/Imported';
import {Send} from './screens/Send';
import {Review} from './screens/Review';
import {Confirm, type ConfirmEntry} from './screens/Confirm';
import {Status} from './screens/Status';

const HOME: Route = {screen: 'tab', tab: 'home'};

function Shell({first, onLeaveHandOver}: {first: Route[]; onLeaveHandOver: () => void}) {
  const m = useWallet();
  const [stack, go] = useReducer(routeReducer, first);
  const [accounts, setAccounts] = useState(false);
  const [txItems, setTxItems] = useState<Record<string, HistoryItem>>({});
  /**
   * #20's [Cancel] discarded the prepared send (E7): #11 shows "Transaction cancelled. No fees charged." — on the one
   * stack the cancel's reset made, and on no other (fix round 1): `reset` keeps the routes array it is given, so any
   * later stack change (a push, a tab, a return to #11 by another way, a send's Done) is another array and the toast
   * is gone for good.
   */
  const [cancelledOn, setCancelledOn] = useState<Route[] | null>(null);
  const route = stack[stack.length - 1] ?? HOME;
  const content = useRef<HTMLElement>(null);
  const stackRef = useRef(stack);
  stackRef.current = stack;

  // One scroller serves every route: a screen opened from a scrolled list would otherwise start
  // where the list was (#27 opened below its own top bar — Task 17 fix round 1). Every accepted push,
  // pop or tab change is a new stack array, so each one starts the new screen at the top, before paint.
  useLayoutEffect(() => {
    if (content.current !== null) content.current.scrollTop = 0;
  }, [stack]);

  // The UI tab leaves its hand-over screen (#20 after #10 → #21, #19 or #12): from then on it is a wallet surface
  // like the popup, and the provider runs its open sequence (it was quiet on the hand-over route).
  useEffect(() => {
    if (!TAB_ONLY.has(route.screen)) onLeaveHandOver();
  }, [route.screen, onLeaveHandOver]);

  // Esc goes back one step on a pushed screen (a sheet handles its own Esc; a flow screen its own step).
  useEffect(() => {
    if (stack.length < 2 || accounts || FLOW.has(route.screen)) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') go({type: 'pop'});
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [stack.length, accounts, route.screen]);

  // §7.1 ruling (fix round 1): a lock ends the flow. #19, #20 and #21 do not survive it — on unlock the app is at #12
  // holding the draft (the user's own text, from #12 or #19's intent), or at #11 when there is none. Nothing then
  // prepares by itself: #12 prepares only on Continue. Decided when the lock is seen, while the flow is not shown.
  useEffect(() => {
    if (m.phase !== 'locked') return;
    const now = stackRef.current;
    const top = now[now.length - 1];
    if (top === undefined || !FLOW.has(top.screen)) return;
    const at = [...now].reverse().find(r => r.screen === 'send' || r.screen === 'review');
    const draft = at?.screen === 'review' ? draftOf(at.intent) : at?.screen === 'send' ? at.draft : null;
    go({type: 'reset', routes: draft === null ? [HOME] : [HOME, {screen: 'send', draft, notice: null}]});
  }, [m.phase]);

  // Ruling (fix round 1): another account selected (here or in another window) ends a flow begun for the one before —
  // #12, #19 and #20 go back to #11, so #20 can never show one account's balance against another's send. #21 (and the
  // #54/#44 it grows into) stays: it follows a record already sent, and shows that record's own account.
  const lastSelected = useRef<string | null>(null);
  const selectedNow = m.account?.publicKey ?? null;
  useEffect(() => {
    if (selectedNow === null) return;
    const before = lastSelected.current;
    lastSelected.current = selectedNow;
    if (before === null || before === selectedNow) return;
    const now = stackRef.current;
    const top = now[now.length - 1];
    if (top !== undefined && (top.screen === 'send' || top.screen === 'review' || top.screen === 'confirm' || top.screen === 'resume')) go({type: 'reset', routes: [HOME]});
  }, [selectedNow]);

  // Spec §1.6 step 3: a popup opened while a prepared send waits shows #20 in resume mode — which reads it again
  // and waits for a tap (D38). Once per popup, and only while the user has not gone anywhere yet.
  const resumeChecked = useRef(false);
  const selected = m.account?.publicKey ?? null;
  const {engine, phase, surface} = m;
  useEffect(() => {
    if (surface !== 'popup' || phase !== 'unlocked' || selected === null || resumeChecked.current) return;
    resumeChecked.current = true;
    let alive = true;
    let answered = false;
    void engine.preparedFor(selected).then(r => {
      // Locked, another account selected, or unmounted while it read: the answer is dropped — it never pushes #20
      // under the locked screen or for an account no longer shown. The check runs again once unlocked.
      if (!alive) return;
      answered = true;
      const now = stackRef.current;
      if (r.ok && r.data !== null && now.length === 1 && now[0]?.screen === 'tab' && now[0].tab === 'home') {
        go({type: 'push', route: {screen: 'confirm', account: selected, entry: 'resume'}});
      }
    });
    return () => {
      alive = false;
      if (!answered) resumeChecked.current = false;
    };
  }, [surface, phase, selected, engine]);

  // The UI tab's resume hash names the account whose send #10 confirmed. Another account selected (here or in another
  // window, before or after the tab opened) ends that flow as an account switch does (final review M3, spec §1.6): #11,
  // and #20 never mounts for it — nothing read for the hash's account, nothing sent. Its prepared send is left as it is.
  const resumeElsewhere = route.screen === 'resume' && selected !== null && route.account !== selected;
  useEffect(() => {
    if (resumeElsewhere) go({type: 'reset', routes: [HOME]});
  }, [resumeElsewhere]);

  /** The send flow's ways between its screens (spec §4). #19 always sits on #12 holding the draft, so Cancel returns to it. */
  const toReview = (account: string, intent: Intent, notice: 'confirmation-expired' | null) =>
    go({type: 'reset', routes: [HOME, {screen: 'send', draft: draftOf(intent), notice: null}, {screen: 'review', account, intent, notice}]});
  const toStatus = (account: string, id: string | null, since: number) => go({type: 'reset', routes: [HOME, {screen: 'status', account, id, since}]});
  const toSend = (draft: Draft | null, notice: 'start-again' | null) => go({type: 'reset', routes: [HOME, {screen: 'send', draft, notice}]});
  /** #20: a flow entry bound to the prepared send #19 showed, by id (Task 8); a resume entry id-less (the hash, a reopened popup). */
  const confirmFor = (account: string, entry: ConfirmEntry) => (
    <Confirm
      {...entry}
      account={account}
      onBack={intent => {
        const below = stackRef.current[stackRef.current.length - 2];
        if (below?.screen === 'review') go({type: 'pop'});
        else toReview(account, intent, null);
      }}
      onCancelled={() => {
        const routes: Route[] = [HOME];
        setCancelledOn(routes);
        go({type: 'reset', routes});
      }}
      onTrack={(id, since) => toStatus(account, id, since)}
      onReview={(intent, notice) => toReview(account, intent, notice)}
      onStartAgain={draft => toSend(draft, draft === null ? null : 'start-again')}
      // #19's prepared send was superseded before #20 read it: back to #19 (always under a flow entry), which reviews again.
      onSuperseded={() => go({type: 'pop'})}
    />
  );

  if (m.phase === 'loading') return <div className="app-content" aria-busy="true" />;
  // The UI tab's hand-over screens show their own locked and no-wallet states (§3.7, §3.12, §7.1).
  if (route.screen === 'created' || route.screen === 'imported') {
    return <main className="app-content">{route.screen === 'created' ? <Created /> : <Imported />}</main>;
  }
  if (m.phase === 'no-wallet') return <NoWallet />;
  if (m.phase === 'locked') return <Locked />;

  let screen;
  if (route.screen === 'tab') {
    if (route.tab === 'home') {
      screen = (
        <Home
          onSend={() => go({type: 'push', route: {screen: 'send', draft: null, notice: null}})}
          onReceive={() => go({type: 'push', route: {screen: 'receive'}})}
          onPending={p => go({type: 'push', route: {screen: 'status', account: p.account, id: p.id, since: p.createdAt}})}
          onAccounts={() => setAccounts(true)}
        />
      );
    } else if (route.tab === 'activity') {
      screen = (
        <Activity
          onTx={item => {
            // #27 carries the owner: the account whose history Activity showed (fix round 1).
            if (selected === null) return;
            setTxItems(t => ({...t, [item.signature]: item}));
            go({type: 'push', route: {screen: 'tx', signature: item.signature, account: selected}});
          }}
          onReceive={() => go({type: 'push', route: {screen: 'receive'}})}
          onPending={p => go({type: 'push', route: {screen: 'status', account: p.account, id: p.id, since: p.createdAt}})}
        />
      );
    } else {
      // C16: #31's Profile opens the accounts manager; the switcher stays on #11's avatar.
      screen = (
        <Settings
          onProfile={() => go({type: 'push', route: {screen: 'accounts'}})}
          onSecurity={() => go({type: 'push', route: {screen: 'security'}})}
          onPasskey={() => go({type: 'push', route: {screen: 'passkey'}})}
          onDelete={() => go({type: 'push', route: {screen: 'delete'}})}
          onAbout={() => go({type: 'push', route: {screen: 'about'}})}
        />
      );
    }
  } else if (route.screen === 'receive') {
    screen = <Receive onBack={() => go({type: 'pop'})} />;
  } else if (route.screen === 'tx') {
    // [Try again] proposes the failed send again from the account that made it — only while that account is the one
    // selected (fix round 1): another account selected since #27 opened offers none, and a tap that raced it does nothing.
    const owner = route.account;
    screen = (
      <TxDetail
        signature={route.signature}
        account={owner}
        item={txItems[route.signature]}
        canRetry={owner === selected}
        onBack={() => go({type: 'pop'})}
        onTryAgain={intent => {
          if (owner === selected) toReview(owner, intent, null);
        }}
      />
    );
  } else if (route.screen === 'send') {
    screen = (
      <Send
        draft={route.draft}
        notice={route.notice}
        onBack={() => go({type: 'pop'})}
        onReview={(draft, intent) => {
          go({type: 'replace', route: {screen: 'send', draft, notice: null}});
          if (selected !== null) go({type: 'push', route: {screen: 'review', account: selected, intent, notice: null}});
        }}
        onViewPending={p => go({type: 'push', route: {screen: 'status', account: p.account, id: p.id, since: p.createdAt}})}
      />
    );
  } else if (route.screen === 'review') {
    const {account} = route;
    screen = (
      <Review
        account={account}
        intent={route.intent}
        notice={route.notice}
        onCancel={() => go({type: 'pop'})}
        onConfirm={preparedId => go({type: 'push', route: {screen: 'confirm', account, entry: 'flow', preparedId}})}
        onViewPending={p => go({type: 'push', route: {screen: 'status', account: p.account, id: p.id, since: p.createdAt}})}
      />
    );
  } else if (route.screen === 'confirm') {
    screen = confirmFor(route.account, route.entry === 'flow' ? {entry: 'flow', preparedId: route.preparedId} : {entry: 'resume'});
  } else if (route.screen === 'resume') {
    // The UI tab's hand-over (D38): the hash chose this screen and carries no data — #20 reads wallet.preparedFor.
    // Only for the selected account: until it is known, nothing; another one, the effect above ends the flow.
    screen = route.account === selected ? confirmFor(route.account, {entry: 'resume'}) : <div className="screen s-conf" aria-busy="true" />;
  } else if (route.screen === 'status') {
    // #21 follows its record's account whoever is selected; #44's and #54's [Try again] and [Edit transaction] start a
    // flow for that account, so — #27's owner rule (final review I1) — only while it is the one selected, and a tap
    // that raced another account's selection does nothing.
    const {account} = route;
    screen = (
      <Status
        account={account}
        id={route.id}
        since={route.since}
        canRetry={account === selected}
        onDone={() => go({type: 'reset', routes: [HOME]})}
        onDetails={signature => go({type: 'push', route: {screen: 'tx', signature, account}})}
        onActivity={() => go({type: 'tab', tab: 'activity'})}
        onTryAgain={intent => {
          if (account === selected) toReview(account, intent, null);
        }}
        onEdit={draft => {
          if (account === selected) toSend(draft, null);
        }}
      />
    );
  } else if (route.screen === 'security') {
    screen = (
      <Security
        onBack={() => go({type: 'pop'})}
        onPasskey={() => go({type: 'push', route: {screen: 'passkey'}})}
        onDelete={() => go({type: 'push', route: {screen: 'delete'}})}
      />
    );
  } else if (route.screen === 'delete') {
    screen = <DeleteWallet onBack={() => go({type: 'pop'})} />;
  } else if (route.screen === 'accounts') {
    screen = <AccountsManager onBack={() => go({type: 'pop'})} />;
  } else if (route.screen === 'passkey') {
    screen = <Passkey onBack={() => go({type: 'pop'})} />;
  } else {
    screen = <About onBack={() => go({type: 'pop'})} />;
  }

  return (
    <>
      {/* 44e: the content behind the cancelled toast is dimmed (app.css .app-toast-behind). */}
      <main className={cancelledOn === stack && route.screen === 'tab' ? 'app-content app-toast-behind' : 'app-content'} ref={content}>
        {screen}
      </main>
      {route.screen === 'tab' ? <TabBar active={route.tab} onChange={tab => go({type: 'tab', tab})} /> : null}
      {cancelledOn === stack && route.screen === 'tab' ? <CancelledToast onDone={() => setCancelledOn(null)} /> : null}
      {accounts ? <Switcher onClose={() => setAccounts(false)} /> : null}
    </>
  );
}

/** The popup (412 × 600) and the tab (wallet.html, a 412 px column) are one app (spec §1.1). */
export function App({surface, engine, platform = browserPlatform, hash = typeof location === 'undefined' ? '' : location.hash}: {surface: Surface; engine?: Engine; platform?: Platform; hash?: string}) {
  // One client for the life of the page: the provider's effects key on it.
  const [client] = useState<Engine>(() => engine ?? createEngine());
  // The first route is read once (§1.6): the tab's hash chooses a screen, and never acts.
  const [first] = useState<Route[]>(() => firstRoute(surface, hash));
  // The hand-over routes run a quiet provider (#7, #40, #20 after #10): the state only, plus what each screen
  // reads itself. Leaving them (the tab's #20 → #21, #19 or #12) makes the tab a wallet surface like the popup.
  const [handOver, setHandOver] = useState(() => TAB_ONLY.has(first[0]?.screen ?? ''));
  const [leave] = useState(() => () => setHandOver(false));
  return (
    <div className={`app app-${surface}`}>
      <WalletProvider engine={client} platform={platform} surface={surface} quiet={handOver}>
        <Shell first={first} onLeaveHandOver={leave} />
      </WalletProvider>
    </div>
  );
}
