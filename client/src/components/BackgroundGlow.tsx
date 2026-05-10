import React, { useEffect } from 'react';
import { StyleSheet, View, Image } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, withSequence } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

export default function BackgroundGlow() {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);

  useEffect(() => {
    // Mimics the CSS @keyframes float 12s ease-in-out infinite
    translateY.value = withRepeat(
      withSequence(
        withTiming(-20, { duration: 6000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 6000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    translateX.value = withRepeat(
      withSequence(
        withTiming(20, { duration: 6000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 6000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }]
  }));

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#020617' }]} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, floatStyle]}>
        
        {/* Blob 1: Blue (20% 30%) */}
        <View style={[styles.blob, { top: '10%', left: '-10%', width: 500, height: 500 }]}>
          <LinearGradient colors={['rgba(59,130,246,0.25)', 'transparent']} style={styles.gradientFill} />
        </View>

        {/* Blob 2: Purple (80% 70%) */}
        <View style={[styles.blob, { bottom: '10%', right: '-20%', width: 600, height: 600 }]}>
          <LinearGradient colors={['rgba(168,85,247,0.25)', 'transparent']} style={styles.gradientFill} />
        </View>

        {/* Blob 3: Indigo (50% 50%) */}
        <View style={[styles.blob, { top: '35%', left: '15%', width: 450, height: 450 }]}>
           <LinearGradient colors={['rgba(99,102,241,0.15)', 'transparent']} style={styles.gradientFill} />
        </View>

      </Animated.View>

      {/* Grain Texture Overlay */}
      <Image 
        source={{ uri: 'https://www.transparenttextures.com/patterns/noise.png' }} 
        style={styles.grain} 
        resizeMode="repeat" 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  blob: { position: 'absolute', borderRadius: 1000 },
  gradientFill: { flex: 1, borderRadius: 1000 },
  grain: { 
    ...StyleSheet.absoluteFillObject, 
    opacity: 0.08, 
    width: '100%', 
    height: '100%' 
  }
});
