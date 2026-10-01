/** The design's `.chip-row` of filter chips (#26): one active, each a 48 px target. */
export function ChipRow<T extends string>({options, active, onChange, label}: {options: readonly {value: T; text: string}[]; active: T; onChange: (v: T) => void; label: string}) {
  return (
    <div className="chip-row" role="tablist" aria-label={label}>
      {options.map(o => (
        <span key={o.value} className="chip-shell">
          <button type="button" role="tab" aria-selected={o.value === active} className="chip" data-active={o.value === active ? 'true' : undefined} onClick={() => onChange(o.value)}>
            {o.text}
          </button>
        </span>
      ))}
    </div>
  );
}
