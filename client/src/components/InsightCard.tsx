import React from 'react';
import { Text, StyleSheet, Pressable, ViewStyle } from 'react-native';
import GlassCard from './GlassCard';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

interface InsightCardProps {
  title: string;
  subtitle: string;
  icon: any;
  iconColor: string;
  style?: ViewStyle;
}

export default function InsightCard({ title, subtitle, icon, iconColor, style }: InsightCardProps) {
  const scale = useSharedValue(1);
  const handlePressIn = () => { scale.value = withSpring(0.96); };
  const handlePressOut = () => { scale.value = withSpring(1); };

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[style, animatedStyle]}>
      <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <GlassCard style={styles.card}>
           <Ionicons name={icon} size={28} color={iconColor} style={{marginBottom: 12}} />
           <Text style={styles.insightTitle}>{title}</Text>
           <Text style={styles.insightSub}>{subtitle}</Text>
        </GlassCard>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20 },
  insightTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  insightSub: { color: '#94A3B8', fontSize: 13, lineHeight: 20 }
});
