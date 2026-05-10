import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import BackgroundGlow from '../components/BackgroundGlow';
import Animated, { FadeInDown, FadeOutUp, useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';

export default function AnalyzingScreen() {
  const navigation = useNavigation();
  const { analysisResult, analysisError, isAnalyzing } = useApp();
  const [currentStep, setCurrentStep] = useState(0);
  const pulseScale = useSharedValue(1);

  const steps = [
    { label: "Parsing document structure...", icon: "document-text-outline" },
    { label: "Extracting semantic keywords...", icon: "key-outline" },
    { label: "Evaluating impact & metrics...", icon: "bar-chart-outline" },
    { label: "Generating recruiter suggestions...", icon: "sparkles-outline" },
    { label: "Finalizing analysis report...", icon: "shield-checkmark-outline" }
  ];

  useEffect(() => {
    pulseScale.value = withRepeat(withTiming(1.15, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);

    const interval = setInterval(() => {
      setCurrentStep(step => (step + 1) % steps.length);
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (analysisResult) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Dashboard' } as never],
      });
    }
  }, [analysisResult, navigation]);

  useEffect(() => {
    if (!isAnalyzing && analysisError) {
      pulseScale.value = withTiming(1, { duration: 200 });
    }
  }, [analysisError, isAnalyzing, navigation]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }]
  }));
  const isDeclinedResume = typeof analysisError === 'string' && analysisError.toLowerCase().includes('declined');
  const isApiKeyError = typeof analysisError === 'string' && (analysisError.toLowerCase().includes('api key') || analysisError.toLowerCase().includes('401'));
  const isLimitError = typeof analysisError === 'string' && analysisError.toLowerCase().includes('limit_reached');
  
  const errorTitle = isLimitError ? 'Free Tier Limit' : isDeclinedResume ? 'Resume Declined' : isApiKeyError ? 'API Key Required' : 'Analysis Failed';
  const errorIcon = isLimitError ? 'lock-closed-outline' : isApiKeyError ? 'key-outline' : 'alert-circle';
  const errorIconBg = isLimitError ? { backgroundColor: '#A855F7', shadowColor: '#A855F7' } : isApiKeyError ? { backgroundColor: '#F59E0B', shadowColor: '#F59E0B' } : styles.errorIcon;

  return (
    <View style={styles.container}>
      <BackgroundGlow />
      <View style={styles.center}>
        <Animated.View entering={FadeInDown.springify()} style={styles.loaderContainer}>
          {analysisError ? (
            <>
              <View style={[styles.iconWrapper, errorIconBg]}>
                <Ionicons name={errorIcon as any} size={50} color="#F8FAFC" />
              </View>
              <Text style={styles.title}>{errorTitle}</Text>
              <Text style={styles.errorText}>
                  {isLimitError ? 'You have used your 5 free resume analyses. Upgrade to Resumetric Professional to unlock unlimited scans!' : 
                   isApiKeyError ? 'Please set the OPENAI_API_KEY environment variable on the server and restart it.' : 
                   analysisError}
              </Text>
              
              {isLimitError ? (
                  <TouchableOpacity
                    style={[styles.backButton, { backgroundColor: '#A855F7' }]}
                    onPress={() => navigation.navigate('Profile' as never)}
                  >
                    <Text style={styles.backButtonText}>View Upgrade Plans</Text>
                  </TouchableOpacity>
              ) : (
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Home' } as never] })}
                  >
                    <Text style={styles.backButtonText}>Back to Upload</Text>
                  </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              <Animated.View style={[styles.iconWrapper, pulseStyle]}>
                <Ionicons name={steps[currentStep].icon as any} size={50} color="#F8FAFC" />
              </Animated.View>
              <Text style={styles.title}>AI Engine Active</Text>
              
              <View style={styles.stepContainer}>
                <Animated.Text key={currentStep} entering={FadeInDown.duration(400)} exiting={FadeOutUp.duration(400)} style={styles.subtitle}>
                  {steps[currentStep].label}
                </Animated.Text>
              </View>
            </>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050811' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loaderContainer: { alignItems: 'center' },
  iconWrapper: { 
    width: 100, height: 100, borderRadius: 50, 
    backgroundColor: '#5B8CFF', alignItems: 'center', justifyContent: 'center', 
    marginBottom: 32,
    shadowColor: '#5B8CFF', shadowOpacity: 0.8, shadowRadius: 30, shadowOffset: { width:0, height:0 }
  },
  errorIcon: { backgroundColor: '#EF4444', shadowColor: '#EF4444' },
  title: { fontSize: 32, fontWeight: '800', color: '#F8FAFC', marginBottom: 16, letterSpacing: -1 },
  stepContainer: { height: 40, justifyContent: 'center', overflow: 'hidden' },
  subtitle: { fontSize: 16, color: '#5B8CFF', fontWeight: '600' },
  errorText: { color: '#CBD5E1', fontSize: 15, lineHeight: 23, textAlign: 'center', maxWidth: 360, marginBottom: 22 },
  backButton: { backgroundColor: '#5B8CFF', borderRadius: 8, paddingVertical: 13, paddingHorizontal: 20 },
  backButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 }
});
