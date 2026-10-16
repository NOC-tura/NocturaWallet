/**
 * A site as the approval window, #10 and the popup's strip show it: `new URL(origin).host` of an `https:` origin
 * (ports.ts pageOrigin accepts any origin the URL parser serialises back exactly). One shape for the three sides that
 * check it — the background's challenge store (reauthChallenges.ts), #10 (unlock/challenge.ts) and the popup's client
 * (app/engine.ts) — so a site one side issues is never one another side refuses (final review I2: an underscore host,
 * `my_site.example.com`, made issueChallenge throw and `dapp.decide` answer `internal`).
 *
 * The characters: what the WHATWG host parser leaves in a domain (letters — lower case after the parser, A–Z kept
 * harmless — digits, `-` `.` and the domain code points it does not forbid: `! " $ & ' ( ) * + , ; = _ \` { } ~`;
 * non-ASCII arrives as punycode `xn--`), `%` for a browser that percent-escapes a code point in a host rather than
 * refusing it, `[` `]` `:` for an IPv6 literal, and `:` with digits for a port. Never a space, `/`, `?`, `#`, `@`, `\`,
 * `<`, `>`, `^`, `|` or a control character: the parser refuses each in a host, so none can be a site. 262 = a
 * 253-character name, `:` and a five-digit port, with room for an IPv6 literal's brackets.
 */
export const SITE = /^[A-Za-z0-9.\-[\]:!"$%&'()*+,;=_`{}~]{1,262}$/;
