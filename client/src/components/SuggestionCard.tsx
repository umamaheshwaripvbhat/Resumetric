import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import GlassCard from './GlassCard';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

export default function SuggestionCard({ original, improved, reason, expectedByCompanies, onApply }: { original: string, improved: string, reason?: string, expectedByCompanies?: string, onApply?: () => void }) {
  const [applied, setApplied] = useState(false);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const handlePressIn = () => { scale.value = withSpring(0.97); };
  const handlePressOut = () => { scale.value = withSpring(1); };

  const animatedStyle = useAnimatedStyle(() => ({ 
    transform: [{ scale: scale.value }], 
    opacity: opacity.value 
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <GlassCard style={[styles.chatBubble, applied ? styles.chatBubbleApplied : null]}>
          <Text style={styles.chatLabel}>Before (Original):</Text>
          <View style={styles.beforeBubble}>
            <Ionicons name="close-circle" size={18} color="#EF4444" style={{marginTop:2, marginRight:10}} />
            <Text style={styles.originalText}>{original}</Text>
          </View>
          
          <View style={styles.connector}>
              <View style={styles.line} />
              <Ionicons name="git-merge" size={26} color="#5B8CFF" style={{marginHorizontal:12}} />
              <View style={styles.line} />
          </View>

          <Text style={styles.chatLabel}>After (Improved):</Text>
          <View style={[styles.afterBubble, applied ? styles.afterBubbleApplied : null]}>
            <Ionicons name="checkmark-circle" size={18} color="#22C55E" style={{marginTop:2, marginRight:10}} />
            <Text style={styles.improvedText}>{improved}</Text>
          </View>

          {(reason || expectedByCompanies) && (
            <View style={styles.reasonBox}>
              {reason && <Text style={styles.reasonText}>Why this matters: {reason}</Text>}
              {expectedByCompanies && <Text style={styles.reasonText}>What companies expect: {expectedByCompanies}</Text>}
            </View>
          )}
          
          <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.regenBtn} activeOpacity={0.7} onPress={() => {
                  opacity.value = withTiming(0.4, { duration: 150 }, () => opacity.value = withTiming(1, { duration: 300 }));
              }}>
                <Ionicons name="refresh" size={16} color="#94A3B8" style={{marginRight:6}} />
                <Text style={styles.regenText}>Regenerate</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.applyBtn, applied ? styles.applyBtnSuccess : null]} activeOpacity={0.7} onPress={() => { setApplied(true); if(onApply) onApply(); }}>
                <Ionicons name={applied ? "checkmark-done" : "flash"} size={16} color="#FFFFFF" style={{marginRight:6}} />
                <Text style={styles.applyText}>{applied ? "Applied" : "Apply Change"}</Text>
              </TouchableOpacity>
          </View>
        </GlassCard>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chatBubble: { marginBottom: 24, paddingVertical: 24 },
  chatBubbleApplied: { borderColor: 'rgba(34, 197, 94, 0.5)', shadowColor: 'rgba(34, 197, 94, 0.4)' },
  chatLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#64748B', fontWeight: '700', marginBottom: 8 },
  beforeBubble: { flexDirection: 'row', backgroundColor: 'rgba(239, 68, 68, 0.05)', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' },
  afterBubble: { flexDirection: 'row', backgroundColor: 'rgba(34, 197, 94, 0.05)', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.2)' },
  afterBubbleApplied: { backgroundColor: 'rgba(34, 197, 94, 0.15)', borderColor: 'rgba(34, 197, 94, 0.5)' },
  originalText: { flex: 1, color: '#CBD5E1', fontSize: 15, lineHeight: 24 },
  improvedText: { flex: 1, color: '#F8FAFC', fontSize: 15, lineHeight: 24, fontWeight: '600' },
  reasonBox: { backgroundColor: 'rgba(91, 140, 255, 0.08)', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(91, 140, 255, 0.2)', marginTop: 14 },
  reasonText: { color: '#CBD5E1', fontSize: 13, lineHeight: 20, marginBottom: 6 },
  connector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 12 },
  line: { height: 1, flex: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, gap: 12 },
  regenBtn: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  regenText: { color: '#CBD5E1', fontWeight: '600', fontSize: 14 },
  applyBtn: { flex: 1, flexDirection: 'row', backgroundColor: '#5B8CFF', padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: '#5B8CFF', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width:0, height:4 } },
  applyBtnSuccess: { backgroundColor: '#22C55E', shadowColor: '#22C55E' },
  applyText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 }
});
