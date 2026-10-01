import {ExtIcon} from './ExtIcon';

export type Tab = 'home' | 'activity' | 'settings';
const TABS: {tab: Tab; text: string; icon: 'home' | 'trend-up' | 'settings'}[] = [
  {tab: 'home', text: 'Home', icon: 'home'},
  {tab: 'activity', text: 'Activity', icon: 'trend-up'},
  {tab: 'settings', text: 'Settings', icon: 'settings'},
];

/** D3: Home / Activity / Settings, 80 px, the design's `.tab-bar`; Activity's glyph is the design's #i-trend-up (index.html #s26). */
export function TabBar({active, onChange}: {active: Tab; onChange: (t: Tab) => void}) {
  return (
    <nav className="tab-bar app-tab-bar" aria-label="Main">
      {TABS.map(t => (
        <button key={t.tab} type="button" className={`item${t.tab === active ? ' is-active' : ''}`} aria-current={t.tab === active ? 'page' : undefined} onClick={() => onChange(t.tab)}>
          <ExtIcon name={t.icon} size={22} />
          {t.text}
        </button>
      ))}
    </nav>
  );
}
