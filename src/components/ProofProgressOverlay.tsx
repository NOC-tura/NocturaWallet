import React from 'react';
import {View, Text, ActivityIndicator, Modal, StyleSheet} from 'react-native';
import type {ConsolidationProgress} from '../modules/shielded/types';

interface ProofProgressOverlayProps {
  visible: boolean;
  message?: string;
  consolidation?: ConsolidationProgress;
}

export function ProofProgressOverlay({visible, message = 'Securing transaction...', consolidation}: ProofProgressOverlayProps) {
  const displayMessage = consolidation
    ? `Optimizing your private balance... (step ${consolidation.currentStep}/${consolidation.totalSteps})`
    : message;

  return (
    <Modal visible={visible} transparent animationType="fade" testID="proof-overlay">
      <View style={styles.backdrop}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.messageText} testID="proof-overlay-message">
          {displayMessage}
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 24,
    textAlign: 'center',
  },
});
