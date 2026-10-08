import type {ReactNode} from 'react';
import {ExtIcon, type ExtIconName} from './ExtIcon';
import {LockedButton} from './LockedButton';

/**
 * The design's settings row (`.s7-row`, 56 px): glyph, title, meta, chevron — one button. `tone`: the meta in
 * --warning or --success where the design tints it (#31, #35); `danger`: the design's destructive row (#31c). Every row
 * opens something, so it is a LockedButton (rule 6, spec §7): a second tap inside 500 ms pushes nothing twice.
 */
export function ListRow({
  icon,
  title,
  meta,
  onPress,
  danger = false,
  tone,
}: {
  icon: ExtIconName;
  title: string;
  meta?: ReactNode;
  onPress: () => void;
  danger?: boolean;
  tone?: 'warning' | 'success';
}) {
  return (
    <LockedButton className={danger ? 's7-row danger' : 's7-row'} onPress={onPress}>
      <span className="s7-glyph">
        <ExtIcon name={icon} size={20} />
      </span>
      <span className="s7-title">{title}</span>
      <span className={tone === 'warning' ? 's7-meta noc-warning' : tone === 'success' ? 's7-meta noc-success' : 's7-meta'}>{meta}</span>
      <span className="s7-chev">
        <ExtIcon name="chevron-right" size={16} />
      </span>
    </LockedButton>
  );
}
