import type {ReactNode} from 'react';
import {ExtIcon, type ExtIconName} from './ExtIcon';

/** The design's settings row (`.s7-row`, 56 px): glyph, title, meta, chevron — one button. */
export function ListRow({icon, title, meta, onPress, danger = false}: {icon: ExtIconName; title: string; meta?: ReactNode; onPress: () => void; danger?: boolean}) {
  return (
    <button type="button" className={`s7-row${danger ? ' danger' : ''}`} onClick={onPress}>
      <span className="s7-glyph">
        <ExtIcon name={icon} size={20} />
      </span>
      <span className="s7-title">{title}</span>
      <span className="s7-meta">{meta}</span>
      <span className="s7-chev">
        <ExtIcon name="chevron-right" size={16} />
      </span>
    </button>
  );
}
