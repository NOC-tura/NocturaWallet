/**
 * A full address in groups of four, every group the same weight.
 *
 * The desktop redesign brightened the first and last four characters "so a buyer can check
 * the ends". An address-poisoning account seen against this project in 2026-09 matches the
 * Squads vault on exactly those eight characters — 6Zia…o6Vd both ways — so emphasis there
 * would train a reader to check the part that was forged. Groups make the MIDDLE readable
 * instead, which is the only part a poisoner cannot cheaply match.
 *
 * The gap between groups is CSS, not a space character, so selecting and copying yields
 * the exact address.
 */
export function AddressGroups({address}: {address: string}) {
  const groups = address.match(/.{1,4}/g) ?? [];
  return (
    <span className="addr-groups noc-mono">
      {groups.map((g, i) => (
        <span key={i}>{g}</span>
      ))}
    </span>
  );
}
