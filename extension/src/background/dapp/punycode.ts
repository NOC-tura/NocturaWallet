/**
 * RFC 3492 Punycode, decoding only (spec §2.5: "own RFC 3492 decoder"): the classifier reads an `xn--` label's
 * Unicode form and nothing else. No dependency — the background takes no third-party code for this (D6).
 */
const BASE = 36;
const TMIN = 1;
const TMAX = 26;
const SKEW = 38;
const DAMP = 700;
const INITIAL_BIAS = 72;
const INITIAL_N = 128;
const MAXINT = 0x7fffffff;

function adapt(delta: number, points: number, first: boolean): number {
  let d = first ? Math.floor(delta / DAMP) : Math.floor(delta / 2);
  d += Math.floor(d / points);
  let k = 0;
  while (d > ((BASE - TMIN) * TMAX) >> 1) {
    d = Math.floor(d / (BASE - TMIN));
    k += BASE;
  }
  return k + Math.floor(((BASE - TMIN + 1) * d) / (d + SKEW));
}

/** A basic code point's digit value (0–35), or BASE when it is not a digit. */
function digitOf(c: number): number {
  if (c >= 0x30 && c <= 0x39) return c - 22;
  if (c >= 0x41 && c <= 0x5a) return c - 0x41;
  if (c >= 0x61 && c <= 0x7a) return c - 0x61;
  return BASE;
}

/** The Unicode string a Punycode string (without `xn--`) encodes, or null when it is not valid Punycode. */
export function decodePunycode(input: string): string | null {
  const output: number[] = [];
  const delimiter = input.lastIndexOf('-');
  const basic = delimiter < 0 ? 0 : delimiter;
  for (let j = 0; j < basic; j++) {
    const c = input.charCodeAt(j);
    if (c >= 0x80) return null;
    output.push(c);
  }
  let n = INITIAL_N;
  let bias = INITIAL_BIAS;
  let i = 0;
  for (let at = delimiter < 0 ? 0 : basic + 1; at < input.length; ) {
    const before = i;
    let w = 1;
    for (let k = BASE; ; k += BASE) {
      if (at >= input.length) return null;
      const d = digitOf(input.charCodeAt(at++));
      if (d >= BASE || d > Math.floor((MAXINT - i) / w)) return null;
      i += d * w;
      const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
      if (d < t) break;
      if (w > Math.floor(MAXINT / (BASE - t))) return null;
      w *= BASE - t;
    }
    const length = output.length + 1;
    bias = adapt(i - before, length, before === 0);
    if (Math.floor(i / length) > MAXINT - n) return null;
    n += Math.floor(i / length);
    i %= length;
    if (n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) return null;
    output.splice(i, 0, n);
    i += 1;
  }
  return String.fromCodePoint(...output);
}

/** A host label as Unicode: an `xn--` label decoded, any other returned as it is; null for an invalid `xn--` label. */
export function decodeLabel(label: string): string | null {
  return label.startsWith('xn--') ? decodePunycode(label.slice(4)) : label;
}
