/**
 * Strip query strings out of any URL appearing in free text.
 *
 * The wallet's RPC endpoint carries its Helius API key as `?api-key=…`, and
 * upstream errors are not ours to shape: some fetch implementations format a
 * failure as `request to <full url> failed`. That text is returned from
 * `forceSync` into app state and shown to the user in an Alert, so a key could
 * reach a screenshot or a support chat without ever touching a log.
 *
 * Not confirmed to happen with the current @solana/web3.js on React Native — the
 * usual message there is `Network request failed`, with no URL. That is a
 * property of a dependency we do not control and did not choose, which is reason
 * enough to redact rather than to check once and assume.
 *
 * The whole query goes, not the parameters that sound like secrets. The
 * coordinator's own key leak (2026-02 → 08) was a logger that redacted
 * "key-sounding" params and let the rest through.
 */

const URL_WITH_QUERY = /\b(?:https?|wss?):\/\/[^\s"'<>]+/gi;

export function redactUrlSecrets(text: string): string {
  return text.replace(URL_WITH_QUERY, match => {
    // Trailing punctuation belongs to the sentence, not the URL.
    const trailing = /[.,;:)\]]+$/.exec(match)?.[0] ?? '';
    const url = match.slice(0, match.length - trailing.length);
    const q = url.indexOf('?');
    if (q === -1) return match;
    return `${url.slice(0, q)}?<redacted>${trailing}`;
  });
}
