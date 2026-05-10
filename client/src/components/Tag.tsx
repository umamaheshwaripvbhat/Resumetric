import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function Tag({ label, type = 'neutral' }: { label: string, type?: 'green' | 'red' | 'neutral' | 'blue' }) {
  const getColors = () => {
    switch(type) {
      case 'green': return { bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.3)', text: '#22C55E' };
      case 'red': return { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)', text: '#EF4444' };
      case 'blue': return { bg: 'rgba(91, 140, 255, 0.15)', border: 'rgba(91, 140, 255, 0.3)', text: '#5B8CFF' };
      default: return { bg: 'rgba(255, 255, 255, 0.1)', border: 'rgba(255, 255, 255, 0.2)', text: '#CBD5E1' };
    }
  };

  const colors = getColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginRight: 8,
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
  }
});
