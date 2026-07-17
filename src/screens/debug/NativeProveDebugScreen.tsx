/**
 * DEV-ONLY on-device native-prover test. NOT built to the index.html design — this
 * is a developer tool (Stage 1 of on-device proving), reachable only when
 * Config.NATIVE_PROVER_DEBUG === 'true' (devnet build). It runs the full native
 * proving chain (ensureCircuitAssets download+verify -> native witness+prove) for a
 * fixed deposit input and compares publicInputs against the hosted prover.
 */
import React, {useState} from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {PublicKey} from '@solana/web3.js';
import {localProver} from '../../modules/zkProver/localProver';
import {proveShielded} from '../../modules/zkProver/zkProverModule';
import {buildDepositNote} from '../../modules/shielded/depositWitness';
import {SHIELDED_DEVNET_MINT} from '../../constants/programs';

const TEST_SEED = new Uint8Array(64).fill(7);
const TEST_AMOUNT = 1_000_000_000n; // 1 token (9 decimals)
const DEVNET_MINT = SHIELDED_DEVNET_MINT || 'AtjVK2z561wDYo5EvougJKAo9AJ4KdduxSbiF173aiAe';

export function NativeProveDebugScreen() {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('idle');
  const [log, setLog] = useState<string[]>([]);

  const run = async () => {
    setRunning(true);
    setStatus('running');
    const lines: string[] = [];
    const add = (s: string) => {
      lines.push(s);
      setLog([...lines]);
    };
    try {
      add(`native supported: ${localProver.supported}`);
      const {params} = buildDepositNote(
        TEST_SEED,
        TEST_AMOUNT,
        new PublicKey(DEVNET_MINT),
      );
      add('built deposit input; proving on-device…');

      const t0 = Date.now();
      const native = await localProver.prove('deposit', params);
      add(`native prove OK in ${Date.now() - t0}ms`);
      add(`proofBytes: ${native.proofBytes.length / 2} bytes`);
      add(`publicInputs: ${JSON.stringify(native.publicInputs)}`);

      add('proving on hosted for comparison…');
      const hosted = await proveShielded('deposit', params);
      const match =
        JSON.stringify(native.publicInputs) ===
        JSON.stringify(hosted.publicInputs);
      add(`publicInputs match hosted: ${match ? '✓' : '✗'}`);
      setStatus(match ? 'PASS ✓' : 'MISMATCH ✗');
    } catch (e) {
      add(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
      setStatus('FAIL ✗');
    } finally {
      setRunning(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Native prover — deposit test</Text>
      <Text style={styles.subtitle}>
        Runs ensureCircuitAssets → native witness+prove, then compares to hosted.
      </Text>

      <TouchableOpacity
        style={[styles.button, running && styles.buttonDisabled]}
        onPress={run}
        disabled={running}
        accessibilityLabel="Run native deposit prove test">
        {running ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Test native deposit prove</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.status}>status: {status}</Text>

      <View style={styles.logBox}>
        {log.map((line, i) => (
          <Text key={i} style={styles.logLine}>
            {line}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0B0F14'},
  content: {padding: 20},
  title: {color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 6},
  subtitle: {color: '#8A94A6', fontSize: 13, marginBottom: 20},
  button: {
    backgroundColor: '#5BE3C2',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {opacity: 0.5},
  buttonText: {color: '#0B0F14', fontSize: 16, fontWeight: '700'},
  status: {color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 12},
  logBox: {backgroundColor: '#12181F', borderRadius: 10, padding: 12},
  logLine: {color: '#B9C2D0', fontSize: 12, fontFamily: 'monospace', marginBottom: 4},
});
