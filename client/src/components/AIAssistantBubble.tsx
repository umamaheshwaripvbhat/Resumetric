import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function AIAssistantBubble({ visible = true, onPress }: { visible?: boolean; onPress: () => void }) {
  if (!visible) {
    return null;
  }

  return (
    <TouchableOpacity
      style={styles.fab}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <Ionicons name="sparkles" size={24} color="#FFFFFF" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 88,
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#5B8CFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5B8CFF',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    zIndex: 50,
  },
});
