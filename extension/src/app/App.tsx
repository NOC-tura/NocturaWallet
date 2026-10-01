import {useEffect, useLayoutEffect, useReducer, useRef, useState} from 'react';
import {WalletProvider, useWallet, type Surface} from './WalletContext';
import {createEngine, type Engine, type HistoryItem} from './engine';
import {browserPlatform, type Platform} from './platform';
import {TAB_ONLY, firstRoute, routeReducer, type Route} from './router';
import {TabBar} from './ui/TabBar';
import {Home} from './screens/Home';
import {Locked} from './screens/Locked';
import {NoWallet} from './screens/NoWallet';
import {Switcher} from './screens/Switcher';
import {Receive} from './screens/Receive';
import {Activity} from './screens/Activity';
import {TxDetail} from './screens/TxDetail';
import {Settings} from './screens/Settings';
import {About} from './screens/About';
import {Created} from './screens/Created';
import {Resume} from './screens/Resume';

function Shell({first}: {first: Route[]}) {
  const m = useWallet();
  const [stack, go] = useReducer(routeReducer, first);
  const [accounts, setAccounts] = useState(false);
  const [txItems, setTxItems] = useState<Record<string, HistoryItem>>({});
  const route = stack[stack.length - 1] ?? {screen: 'tab', tab: 'home'};
  const content = useRef<HTMLElement>(null);

  // One scroller serves every route: a screen opened from a scrolled list would otherwise start
  // where the list was (#27 opened below its own top bar — Task 17 fix round 1). Every accepted push,
  // pop or tab change is a new stack array, so each one starts the new screen at the top, before paint.
  useLayoutEffect(() => {
    if (content.current !== null) content.current.scrollTop = 0;
  }, [stack]);

  // Esc goes back one step on a pushed screen (a sheet handles its own Esc).
  useEffect(() => {
    if (stack.length < 2 || accounts) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') go({type: 'pop'});
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [stack.length, accounts]);

  if (m.phase === 'loading') return <div className="app-content" aria-busy="true" />;
  // The UI tab's hand-over screens show their own locked and no-wallet states (§3.7, §3.12).
  if (route.screen === 'created' || route.screen === 'resume') {
    return <main className="app-content">{route.screen === 'created' ? <Created /> : <Resume />}</main>;
  }
  if (m.phase === 'no-wallet') return <NoWallet />;
  if (m.phase === 'locked') return <Locked />;

  let screen;
  if (route.screen === 'tab') {
    if (route.tab === 'home') {
      screen = <Home onReceive={() => go({type: 'push', route: {screen: 'receive'}})} onActivity={() => go({type: 'tab', tab: 'activity'})} onAccounts={() => setAccounts(true)} />;
    } else if (route.tab === 'activity') {
      screen = (
        <Activity
          onTx={item => {
            setTxItems(t => ({...t, [item.signature]: item}));
            go({type: 'push', route: {screen: 'tx', signature: item.signature}});
          }}
          onReceive={() => go({type: 'push', route: {screen: 'receive'}})}
        />
      );
    } else {
      screen = <Settings onAccounts={() => setAccounts(true)} onAbout={() => go({type: 'push', route: {screen: 'about'}})} />;
    }
  } else if (route.screen === 'receive') {
    screen = <Receive onBack={() => go({type: 'pop'})} />;
  } else if (route.screen === 'tx') {
    screen = <TxDetail signature={route.signature} item={txItems[route.signature]} onBack={() => go({type: 'pop'})} />;
  } else {
    screen = <About onBack={() => go({type: 'pop'})} />;
  }

  return (
    <>
      <main className="app-content" ref={content}>
        {screen}
      </main>
      {route.screen === 'tab' ? <TabBar active={route.tab} onChange={tab => go({type: 'tab', tab})} /> : null}
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
  const handOver = TAB_ONLY.has(first[0]?.screen ?? '');
  return (
    <div className={`app app-${surface}`}>
      <WalletProvider engine={client} platform={platform} surface={surface} quiet={handOver}>
        <Shell first={first} />
      </WalletProvider>
    </div>
  );
}
