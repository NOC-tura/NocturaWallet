import type {ReactNode} from 'react';
import {ExtIcon} from './ExtIcon';

/**
 * The design's `.top-bar` (56 px): back, title, and an optional trailing control. `titleClass` is the title's type
 * class as the screen's mockup draws it (`.noc-h1` on #12; none on #19 and #20, whose title is the plain `.title`).
 */
export function TopBar({title, onBack, trailing, titleClass = 'noc-h1'}: {title: string; onBack?: () => void; trailing?: ReactNode; titleClass?: string}) {
  return (
    <div className="top-bar">
      {onBack === undefined ? null : (
        <button type="button" className="icon-btn" aria-label="Back" onClick={onBack}>
          <ExtIcon name="back" size={22} />
        </button>
      )}
      <div className={titleClass === '' ? 'title' : `title ${titleClass}`}>{title}</div>
      {trailing}
    </div>
  );
}
