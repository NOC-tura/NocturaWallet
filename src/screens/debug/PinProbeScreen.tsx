/**
 * DEV-ONLY TLS pin probe. NOT built to the index.html design — a developer tool,
 * reachable only when Config.PIN_PROBE === 'true'.
 *
 * Purpose: prove on a real device that certificate pinning is ENFORCED, not merely
 * that a pinned call can succeed. A call that succeeds proves nothing on its own —
 * OkHttp's CertificatePinner returns without checking anything when no pin is
 * registered for the host, so "it worked" and "pinning is off" look the same from
 * here. Hence two probes, and the negative one is the one that carries the proof:
 *
 *   positive  https://pin-test.noc-tura.io/   → 200, chain carries a pinned SPKI
 *   negative  https://dao.noc-tura.io/vote    → MUST fail with E004 (SSLPinningError)
 *
 * The negative host is the same server, same issuer, same roots — only the key
 * differs, so it isolates exactly the variable under test.
 *
 * It calls the SHIPPED pinnedFetch. A probe with its own copy of the request code
 * would test the copy, not the wallet.
 */
import React, {useState} from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import {pinnedFetch, SSL_PINS, SSLPinningError} from '../../modules/sslPinning/pinnedFetch';

const POSITIVE_URL = 'https://pin-test.noc-tura.io/';
const NEGATIVE_URL = 'https://dao.noc-tura.io/vote';

type Outcome =
  | {kind: 'idle'}
  | {kind: 'running'}
  | {kind: 'response'; status: number; body: string}
  | {kind: 'error'; name: string; code: string; message: string};

export function PinProbeScreen() {
  const [url, setUrl] = useState(POSITIVE_URL);
  const [outcome, setOutcome] = useState<Outcome>({kind: 'idle'});

  const run = async (target: string) => {
    setUrl(target);
    setOutcome({kind: 'running'});
    try {
      const res = await pinnedFetch(target, {timeoutMs: 15_000});
      const body = await res.text();
      setOutcome({kind: 'response', status: res.status, body: body.slice(0, 400)});
    } catch (e) {
      const err = e as Error & {code?: string};
      setOutcome({
        kind: 'error',
        name: err.name ?? 'Error',
        // E004 is what a pin failure reports since 2026-09-16; anything else here
        // means the call failed for a different reason and proves nothing about pinning.
        code: e instanceof SSLPinningError ? e.code : (err.code ?? '—'),
        message: err.message ?? String(e),
      });
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>TLS pin probe</Text>
      <Text style={styles.note}>
        A successful call alone proves nothing — pinning that is switched off looks
        exactly like pinning that passed. The negative probe is the evidence.
      </Text>

      <Text style={styles.label}>Pins this build enforces</Text>
      {SSL_PINS.map(p => (
        <Text key={p} style={styles.mono} numberOfLines={1}>
          {p}
        </Text>
      ))}

      <Text style={styles.label}>URL</Text>
      <TextInput
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
        accessibilityLabel="Probe URL"
      />

      <TouchableOpacity
        style={styles.btn}
        onPress={() => run(POSITIVE_URL)}
        accessibilityLabel="Run positive probe">
        <Text style={styles.btnText}>Positive · pin-test (expect 200)</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.btn}
        onPress={() => run(NEGATIVE_URL)}
        accessibilityLabel="Run negative probe">
        <Text style={styles.btnText}>Negative · dao/vote (expect E004)</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.btn, styles.btnAlt]}
        onPress={() => run(url)}
        accessibilityLabel="Run the URL above">
        <Text style={styles.btnText}>Call the URL above</Text>
      </TouchableOpacity>

      <Text style={styles.label}>Result</Text>
      {outcome.kind === 'running' ? <ActivityIndicator /> : null}
      {outcome.kind === 'idle' ? <Text style={styles.mono}>idle</Text> : null}
      {outcome.kind === 'response' ? (
        <Text style={styles.mono} testID="probe-result">
          {`HTTP ${outcome.status}\n\n${outcome.body}`}
        </Text>
      ) : null}
      {outcome.kind === 'error' ? (
        <Text style={styles.mono} testID="probe-result">
          {`${outcome.name} · code ${outcome.code}\n\n${outcome.message}`}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#0B0D10'},
  content: {padding: 20, gap: 8},
  title: {color: '#F5F6F7', fontSize: 20, fontWeight: '600', marginBottom: 4},
  note: {color: '#9BA1A8', fontSize: 12, marginBottom: 12, lineHeight: 17},
  label: {color: '#9BA1A8', fontSize: 12, marginTop: 16, marginBottom: 4},
  mono: {color: '#D7DBE0', fontFamily: 'monospace', fontSize: 11},
  input: {
    color: '#F5F6F7',
    backgroundColor: '#15181D',
    borderRadius: 8,
    padding: 12,
    fontFamily: 'monospace',
    fontSize: 12,
  },
  btn: {backgroundColor: '#1E2530', borderRadius: 8, padding: 14, marginTop: 8},
  btnAlt: {backgroundColor: '#15181D'},
  btnText: {color: '#F5F6F7', fontSize: 13, textAlign: 'center'},
});
