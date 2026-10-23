/**
 * B1d §1.1: the vault page's presale entry — #10's description of a challenge whose kind is none of the shared ones
 * (challenge.ts `describeChallenge` asks it last). The build without presale resolves it to
 * `src/presale-off/unlock.ts`. B1d-1a: it describes nothing, so #10 shows such a challenge as one it cannot describe
 * (only Cancel); B1d-1b describes a `presale-buy` challenge here.
 */
export function describePresale(about: Readonly<Record<string, unknown>>): null {
  return null;
}
