import {useEffect, useReducer, useState} from 'react';
import {WalletProvider, useWallet, type Surface} from './WalletContext';
import {createEngine, type Engine, type HistoryItem} from './engine';
import {browserPlatform, type Platform} from './platform';
import {firstRoute, routeReducer} from './router';
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

function Shell() {
  const m = useWallet();
  const [stack, go] = useReducer(routeReducer, undefined, firstRoute);
  const [accounts, setAccounts] = useState(false);
  const [txItems, setTxItems] = useState<Record<string, HistoryItem>>({});
  const route = stack[stack.length - 1] ?? {screen: 'tab', tab: 'home'};

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
      <main className="app-content">{screen}</main>
      {route.screen === 'tab' ? <TabBar active={route.tab} onChange={tab => go({type: 'tab', tab})} /> : null}
      {accounts ? <Switcher onClose={() => setAccounts(false)} /> : null}
    </>
  );
}

/** The popup (412 × 600) and the tab (wallet.html, a 412 px column) are one app (spec §1.1). */
export function App({surface, engine, platform = browserPlatform}: {surface: Surface; engine?: Engine; platform?: Platform}) {
  // One client for the life of the page: the provider's effects key on it.
  const [client] = useState<Engine>(() => engine ?? createEngine());
  return (
    <div className={`app app-${surface}`}>
      <WalletProvider engine={client} platform={platform} surface={surface}>
        <Shell />
      </WalletProvider>
    </div>
  );
}
