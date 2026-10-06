import {LockedButton} from './LockedButton';

/**
 * #35's inline pill-picker (index.html #s35c: `.s7-picker` > `.opt`, the current one `.sel`). Each option is a
 * LockedButton (rule 6) with aria-pressed; a stored value that is no option selects none (§4.2 `value not a preset`).
 * The options are 32 px to the eye and 48 px to the pointer (ix:14647; app.css `.app-picker-opt`).
 */
export function Picker({options, value, onPick, label}: {options: readonly {value: number; label: string}[]; value: number; onPick: (v: number) => Promise<void>; label: string}) {
  return (
    <div className="s7-picker" role="group" aria-label={label}>
      {options.map(o => (
        <LockedButton key={o.value} className={o.value === value ? 'opt sel app-picker-opt' : 'opt app-picker-opt'} pressed={o.value === value} keepFocus onPress={() => onPick(o.value)}>
          {o.label}
        </LockedButton>
      ))}
    </div>
  );
}
