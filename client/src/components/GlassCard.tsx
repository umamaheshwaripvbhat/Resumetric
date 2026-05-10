import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tint?: 'blue' | 'purple' | 'none';
  onPress?: () => void;
}

export default function GlassCard({ children, style, tint = 'none', onPress }: GlassCardProps) {
  const isHoveredOrPressed = useSharedValue(false);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: withSpring(isHoveredOrPressed.value ? -4 : 0, { damping: 15, stiffness: 200 }) },
        { scale: withSpring(isHoveredOrPressed.value ? 1.01 : 1, { damping: 15, stiffness: 200 }) }
      ],
      shadowOpacity: withTiming(isHoveredOrPressed.value ? 0.6 : 0.5, { duration: 200 }),
      shadowRadius: withTiming(isHoveredOrPressed.value ? 40 : 32, { duration: 200 }),
      shadowOffset: { width: 0, height: withTiming(isHoveredOrPressed.value ? 12 : 8, { duration: 200 }) },
      // Elevate the glass shadow slightly on hover, glowing if tinted
      elevation: isHoveredOrPressed.value ? 15 : 10,
    };
  });

  const getTintColor = () => {
    if (tint === 'blue') return 'rgba(59, 130, 246, 0.08)';
    if (tint === 'purple') return 'rgba(168, 85, 247, 0.08)';
    return 'rgba(255, 255, 255, 0.05)';
  };

  const innerCardNode = (
    <Animated.View style={[styles.wrapper, { backgroundColor: getTintColor() }, animatedStyle, style]}>
      {/* Base Blur Filter (18px specified) */}
      <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />

      {/* Depth & Inner Reflection Glow (linear-gradient overlay) */}
      <LinearGradient 
        colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']} 
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill} 
        pointerEvents="none"
      />

      {/* Fake inner inset box-shadow using top border layer */}
      <View style={styles.insetShadow} pointerEvents="none" />
      
      {/* Content respects the wide padding rule */}
      <View style={styles.content}>
        {children}
      </View>
    </Animated.View>
  );

  if (onPress) {
    return (
      <Pressable 
        onPressIn={() => isHoveredOrPressed.value = true} 
        onPressOut={() => isHoveredOrPressed.value = false}
        onPress={onPress}
      >
        {innerCardNode}
      </Pressable>
    );
  }

  return (
    // We add a generic transparent press layer to support mobile scrolling without triggering hover prematurely
    <Pressable
        onPressIn={() => isHoveredOrPressed.value = true}
        onPressOut={() => isHoveredOrPressed.value = false}
        delayLongPress={150}
    >
        {innerCardNode}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000', // Base fallback
  },
  insetShadow: {
    ...StyleSheet.absoluteFillObject,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 20,
  },
  content: {
    padding: 24, // Fix Spacing requirement: 20px-30px padding internally across all glass blocks
  }
});
