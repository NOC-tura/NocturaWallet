import type {ReactNode} from 'react';
import {ExtIcon, type ExtIconName} from './ExtIcon';

/** The design's `.banner` (info | warning | danger), icon + title + optional line. */
export function Banner({tone, title, children, icon}: {tone: 'info' | 'warning' | 'danger'; title: string; children?: ReactNode; icon?: ExtIconName}) {
  return (
    <div className={`banner ${tone}`} role={tone === 'info' ? 'status' : 'alert'}>
      <ExtIcon name={icon ?? (tone === 'info' ? 'info' : 'alert-triangle')} size={18} />
      <div>
        <div className="noc-body-sm banner-title">{title}</div>
        {children === undefined ? null : <div className="noc-caption banner-line">{children}</div>}
      </div>
    </div>
  );
}

/** Spec §7.2 (D26): the one line for the coordinator's 403 cool-down, on whatever screen is showing. */
export const REFUSED_TEXT = 'The server is not answering for now — try again in 10 minutes.';

export function RefusedBanner() {
  return <Banner tone="warning" title={REFUSED_TEXT} />;
}
