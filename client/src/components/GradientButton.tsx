import React from 'react';
import { Text, StyleSheet, ViewStyle, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

export default function GradientButton({
  title,
  onPress,
  style,
  icon,
  disabled = false,
}: {
  title: string,
  onPress: () => void,
  style?: ViewStyle,
  icon?: React.ReactNode,
  disabled?: boolean
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  const handlePressIn = () => {
    if (!disabled) scale.value = withSpring(0.95);
  };
  const handlePressOut = () => { scale.value = withSpring(1); };

  return (
    <Animated.View style={[styles.container, disabled ? styles.containerDisabled : null, style, animatedStyle]}>
      <Pressable disabled={disabled} onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} style={styles.pressable}>
        <LinearGradient colors={disabled ? ['#475569', '#334155'] : ['#5B8CFF', '#8B5CF6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
          {icon}
          <Text style={styles.text}>{title}</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    shadowColor: '#5B8CFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  containerDisabled: {
    shadowOpacity: 0.15,
    elevation: 2,
  },
  pressable: {
      borderRadius: 20, overflow: 'hidden'
  },
  gradient: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  }
});
