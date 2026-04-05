import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Pressable,
} from 'react-native';

interface QuickActionsProps {
  onSend: () => void;
  onReceive: () => void;
  onStake: () => void;
  isOffline?: boolean;
}

export function QuickActions({
  onSend,
  onReceive,
  onStake,
  isOffline = false,
}: QuickActionsProps) {
  const [swapModalVisible, setSwapModalVisible] = useState(false);

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity
          style={[styles.button, isOffline && styles.disabledButton]}
          onPress={isOffline ? undefined : onSend}
          activeOpacity={isOffline ? 1 : 0.7}
          disabled={isOffline}>
          <Text style={styles.buttonIcon}>↑</Text>
          <Text style={[styles.buttonLabel, isOffline && styles.disabledLabel]}>
            Send
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={onReceive}
          activeOpacity={0.7}>
          <Text style={styles.buttonIcon}>↓</Text>
          <Text style={styles.buttonLabel}>Receive</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={onStake}
          activeOpacity={0.7}>
          <Text style={styles.buttonIcon}>⚡</Text>
          <Text style={styles.buttonLabel}>Stake</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.swapButton]}
          onPress={() => setSwapModalVisible(true)}
          activeOpacity={0.7}>
          <Text style={styles.buttonIcon}>🔒</Text>
          <Text style={styles.buttonLabel}>Swap</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={swapModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSwapModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSwapModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Token Swap — Coming Soon</Text>
            <Text style={styles.modalBody}>Available in Phase 4.</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setSwapModalVisible(false)}
              activeOpacity={0.8}>
              <Text style={styles.modalButtonText}>Got it</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 20,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingVertical: 14,
    marginHorizontal: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  disabledButton: {
    opacity: 0.5,
  },
  swapButton: {
    opacity: 0.5,
  },
  buttonIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  buttonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  disabledLabel: {
    color: 'rgba(255,255,255,0.5)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    padding: 28,
    marginHorizontal: 40,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(108,71,255,0.3)',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
  },
  modalBody: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: '#6C47FF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 36,
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
