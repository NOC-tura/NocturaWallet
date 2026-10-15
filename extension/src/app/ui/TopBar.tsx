import type {ReactNode} from 'react';
import {ExtIcon} from './ExtIcon';

/**
 * The design's `.top-bar` (56 px): back, title, and an optional trailing control. `titleClass` is the title's type
 * class as the screen's mockup draws it (`.noc-h1` on #12; none on #19 and #20, whose title is the plain `.title`).
 */
export function TopBar({title, onBack, trailing, titleClass = 'noc-h1', badge}: {title: string; onBack?: () => void; trailing?: ReactNode; titleClass?: string; badge?: ReactNode}) {
  return (
    <div className="top-bar">
      {onBack === undefined ? null : (
        <button type="button" className="icon-btn" aria-label="Back" onClick={onBack}>
          <ExtIcon name="back" size={22} />
        </button>
      )}
      {/* B1c-2: #27b's OriginBadge sits in the title, 8 px after the word (ix:12163). */}
      <div className={`${titleClass === '' ? 'title' : `title ${titleClass}`}${badge === undefined ? '' : ' app-title-badge'}`}>
        {title}
        {badge}
      </div>
      {trailing}
    </div>
  );
}
