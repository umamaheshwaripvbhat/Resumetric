import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from '../components/GlassCard';
import ProgressBar from '../components/ProgressBar';
import GradientButton from '../components/GradientButton';
import BackgroundGlow from '../components/BackgroundGlow';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../context/AppContext';

const AnimatedScore = ({ value, style }: { value: number; style: any }) => {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let start = 0;
    const interval = setInterval(() => {
      start += 1;
      setDisplay(start);
      // Failsafe for exactly matching target value
      if (start >= value) clearInterval(interval);
    }, 15);
    return () => clearInterval(interval);
  }, [value]);

  return <Text style={style}>{display}</Text>;
};

const inferRoleFromJobDescription = (jobDescription: string) => {
  const text = jobDescription.toLowerCase();
  if (/(electrical|electronics|eee|vlsi|embedded|circuit|power system|matlab|simulink|plc)/.test(text)) {
    return 'Electrical and Electronics Engineering';
  }
  if (/(computer science|cse|software|frontend|backend|full stack|react|python|java|api|data structure|algorithm)/.test(text)) {
    return 'Computer Science Engineering';
  }
  if (/(data|machine learning|ai|sql|analytics|model|nlp)/.test(text)) {
    return 'Data Science';
  }
  return 'Target Role';
};

export default function AnalysisDashboard() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const insets = useSafeAreaInsets();
  const { analysisResult, jobDesc } = useApp();
  
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.3);

  useEffect(() => {
    pulseScale.value = withRepeat(withTiming(1.1, { duration: 2000, easing: Easing.inOut(Easing.ease) }), -1, true);
    pulseOpacity.value = withRepeat(withTiming(0.4, { duration: 2000, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);

  const animatedPulse = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value
  }));

  const details = analysisResult?.details;
  const apiScores = details?.scores;
  const overallScore = Math.round(analysisResult?.overall_score ?? 0);
  const inferredRole = inferRoleFromJobDescription(jobDesc);
  const structureScore = apiScores?.structure_readability ?? apiScores?.structure ?? 0;
  const firstStrength = details?.strengths?.[0] ?? 'Resume analysis completed';
  const firstWeakness = details?.weaknesses?.[0] ?? details?.missing_keywords?.[0] ?? 'Add more role-specific evidence';
  const firstImprovement = typeof details?.improvements?.[0] === 'string'
    ? details?.improvements?.[0]
    : details?.improvements?.[0]?.improved;
  const expectationSummary = details?.recruiter_expectations?.slice(0, 3).join(' • ');

  const scores = [
    { label: 'Keyword Match', percentage: apiScores?.keyword_match ?? 0, icon: 'key-outline', desc: 'Alignment with the target job description' },
    { label: 'Impact & Metrics', percentage: apiScores?.impact_metrics ?? 0, icon: 'bar-chart-outline', desc: 'Use of measurable results and outcomes' },
    { label: 'Technical Relevance', percentage: apiScores?.technical_relevance ?? 0, icon: 'code-slash-outline', desc: 'Fit for the target role and stack' },
    { label: 'Structure', percentage: structureScore, icon: 'document-text-outline', desc: 'Resume format, clarity, and ATS readability' }
  ];

  return (
    <View style={styles.container}>
      <BackgroundGlow />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 80 }]}>
        
        {/* Step 6.7 Header Polish */}
        <Animated.View entering={FadeInDown.duration(800).springify()}>
          <View style={styles.topNavbarRow}>
             <Text style={styles.navLogo}>Resumetric</Text>
             <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('Home' as never)}>
               <Text style={styles.navLink}>Quit / Go Back</Text>
             </TouchableOpacity>
          </View>

        {/* Core AI Hero Centerpiece */}
        <View style={styles.heroSection}>
          <Animated.View style={[styles.pulseGlow, animatedPulse]}>
              <LinearGradient colors={['#3B82F6', '#A855F7']} style={StyleSheet.absoluteFill} />
          </Animated.View>
          
          <View style={styles.scoreCircleContainer}>
            <View style={styles.innerScoreCircle}>
              <AnimatedScore value={overallScore} style={styles.scoreText} />
              <Text style={styles.scoreLabel}>Overall Score</Text>
            </View>
          </View>

          <View style={styles.insightBadge}>
            <Ionicons name="trending-up" size={16} color="#22C55E" />
            <Text style={styles.insightBadgeText}>Analysis confidence <Text style={{color:'#FFFFFF', fontWeight:'800'}}>{details?.analysis_confidence ?? 0}%</Text></Text>
          </View>
        </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(800).delay(200).springify()}>
             <View style={styles.horizontalScroll}>
                <GlassCard style={[styles.highlightCard, { borderColor: 'rgba(34, 197, 94, 0.4)' }]}>
                   <Text style={{ fontSize: 20, marginBottom: 8 }}>💪</Text>
                   <Text style={[styles.highlightTitle, { color: '#22C55E' }]}>Strength</Text>
                   <Text style={styles.highlightDesc}>{firstStrength}</Text>
                </GlassCard>
                
                <GlassCard style={[styles.highlightCard, { borderColor: 'rgba(239, 68, 68, 0.4)' }]}>
                   <Text style={{ fontSize: 20, marginBottom: 8 }}>⚠</Text>
                   <Text style={[styles.highlightTitle, { color: '#EF4444' }]}>Weakness</Text>
                   <Text style={styles.highlightDesc}>{firstWeakness}</Text>
                </GlassCard>
                
                <GlassCard style={[styles.highlightCard, { borderColor: 'rgba(168, 85, 247, 0.4)' }]}>
                   <Text style={{ fontSize: 20, marginBottom: 8 }}>🚀</Text>
                   <Text style={[styles.highlightTitle, { color: '#A855F7' }]}>Quick Fix</Text>
                   <Text style={styles.highlightDesc}>{firstImprovement ?? 'Add role-specific keywords and measurable outcomes'}</Text>
                </GlassCard>
             </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(800).delay(400).springify()}>
            <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Detailed Breakdown</Text>
        </Animated.View>
        
        {scores.map((s, i) => (
          <Animated.View key={i} entering={FadeInDown.duration(600).delay(500 + (100 * i)).springify()}>
            <GlassCard style={styles.scoreCard}>
              <View style={styles.scoreTopRow}>
                <View style={styles.scoreIconContainer}>
                    <Ionicons name={s.icon as any} size={22} color="#5B8CFF" />
                </View>
                <View style={{ flex: 1, marginLeft: 16 }}>
                    <View style={styles.scoreHeader}>
                        <Text style={styles.scoreName}>{s.label}</Text>
                        <Text style={styles.scorePercent}>{s.percentage}%</Text>
                    </View>
                    <Text style={styles.scoreDesc}>{s.desc}</Text>
                    <ProgressBar progress={s.percentage} color={s.percentage > 85 ? '#22C55E' : s.percentage > 75 ? '#5B8CFF' : '#F59E0B'} />
                </View>
              </View>
            </GlassCard>
          </Animated.View>
        ))}

        {/* Step 5.5 - Score Improvement Hint */}
        <Animated.View entering={FadeInDown.duration(800).delay(900).springify()}>
            <GlassCard style={styles.hintCard} tint="none">
               <Text style={styles.hintText}>{details?.resume_verdict ?? 'Improve your resume by fixing the top suggestions.'}</Text>
               {expectationSummary && <Text style={styles.expectationText}>Companies expect: {expectationSummary}</Text>}
            </GlassCard>
        </Animated.View>

        {/* Step 5.6 - Confidence Feedback */}
        <Animated.View entering={FadeInDown.duration(800).delay(1000)}>
            <Text style={styles.confidenceText}>Analysis confidence: {details?.analysis_confidence ?? 0}% based on extracted resume text</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(800).delay(1050).springify()}>
          <GlassCard style={styles.debugCard}>
            <View style={styles.debugHeader}>
              <Ionicons name="bug-outline" size={18} color="#38BDF8" />
              <Text style={styles.debugTitle}>Extracted Resume Text Preview</Text>
            </View>
            <Text style={styles.debugText}>
              {details?.extracted_preview || details?.resume_text?.slice(0, 500) || 'No extracted text preview available.'}
            </Text>
          </GlassCard>
        </Animated.View>

        {/* Step 6.4 - Final CTAs */}
        <Animated.View entering={FadeInDown.duration(800).delay(1100).springify()} style={{ marginTop: 32 }}>
            <GradientButton 
               title="Improve My Resume 🚀" 
               onPress={() => navigation.navigate('Suggestions' as never)} 
            />
        </Animated.View>

        {/* Interview Prep + Mock Interview */}
        <Animated.View entering={FadeInDown.duration(800).delay(1200).springify()} style={{ flexDirection: 'row', gap: 12, marginTop: 12, marginBottom: 8 }}>
            <TouchableOpacity
                style={styles.interviewBtn}
                onPress={() => (navigation as any).navigate('InterviewPrep', {
                    weaknesses: details?.weaknesses ?? details?.missing_keywords ?? [],
                    role: inferredRole,
                    job_description: jobDesc,
                    resume_text: details?.resume_text ?? '',
                })}
                activeOpacity={0.8}
            >
                <Text style={styles.interviewBtnIcon}>🎤</Text>
                <Text style={styles.interviewBtnText}>Interview Prep</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.interviewBtn, { borderColor: 'rgba(167,139,250,0.35)', backgroundColor: 'rgba(167,139,250,0.08)' }]}
                onPress={() => (navigation as any).navigate('MockInterview', {
                    role: inferredRole,
                    job_description: jobDesc,
                    resume_text: details?.resume_text ?? '',
                })}
                activeOpacity={0.8}
            >
                <Text style={styles.interviewBtnIcon}>🎙️</Text>
                <Text style={styles.interviewBtnText}>Mock Interview</Text>
            </TouchableOpacity>
        </Animated.View>

        {/* Job Matching */}
        <Animated.View entering={FadeInDown.duration(800).delay(1300).springify()} style={{ marginTop: 4 }}>
            <TouchableOpacity
                style={[styles.interviewBtn, { borderColor: 'rgba(34,197,94,0.35)', backgroundColor: 'rgba(34,197,94,0.08)', paddingVertical: 14 }]}
                onPress={() => (navigation as any).navigate('JobMatch', {
                    resume_id: analysisResult?.id || 1,
                    role: inferredRole
                })}
                activeOpacity={0.8}
            >
                <Text style={styles.interviewBtnIcon}>💼</Text>
                <Text style={styles.interviewBtnText}>Find Matching Jobs</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.interviewBtn, { borderColor: 'rgba(234,179,8,0.35)', backgroundColor: 'rgba(234,179,8,0.08)', paddingVertical: 14, marginLeft: 12 }]}
                onPress={() => (navigation as any).navigate('CoverLetter')}
                activeOpacity={0.8}
            >
                <Text style={styles.interviewBtnIcon}>📝</Text>
                <Text style={styles.interviewBtnText}>Cover Letter</Text>
            </TouchableOpacity>
        </Animated.View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050811' },
  scroll: { paddingHorizontal: 24 },
  topNavbarRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, marginTop: 4, paddingHorizontal: 4 },
  navLogo: { color: '#F8FAFC', fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  navLink: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  heroSection: { alignItems: 'center', marginBottom: 44, marginTop: 10, justifyContent: 'center' },
  pulseGlow: { position: 'absolute', width: 220, height: 220, borderRadius: 110, opacity: 0.3, overflow: 'hidden' },
  scoreCircleContainer: { 
    width: 200, height: 200, borderRadius: 100, 
    backgroundColor: 'rgba(255,255,255,0.02)', 
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#5B8CFF', shadowOpacity: 0.2, shadowRadius: 20,
  },
  innerScoreCircle: { 
    width: 170, height: 170, borderRadius: 85, 
    borderWidth: 3, borderColor: '#5B8CFF', 
    alignItems: 'center', justifyContent: 'center', 
    backgroundColor: 'rgba(5, 8, 17, 0.8)' 
  },
  scoreText: { fontSize: 72, fontWeight: '800', color: '#FFFFFF', letterSpacing: -2 },
  scoreLabel: { fontSize: 13, color: '#94A3B8', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '700' },
  insightBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 24, paddingVertical: 8, paddingHorizontal: 16 },
  insightBadgeText: { color: '#94A3B8', fontSize: 15, marginLeft: 8 },
  sectionTitle: { fontSize: 15, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700', color: '#64748B', marginBottom: 16 },
  horizontalScroll: { flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  highlightCard: { flex: 1, padding: 16, borderWidth: 1.5 },
  highlightTitle: { fontWeight: '700', fontSize: 13, marginBottom: 8 },
  highlightDesc: { color: '#CBD5E1', fontSize: 12, lineHeight: 18 },
  scoreCard: { marginBottom: 16, padding: 20 },
  scoreTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  scoreIconContainer: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(91, 140, 255, 0.1)', alignItems: 'center', justifyContent: 'center' },
  scoreHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  scoreName: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  scorePercent: { color: '#CBD5E1', fontSize: 16, fontWeight: '700' },
  scoreDesc: { color: '#94A3B8', fontSize: 13, marginBottom: 12 },
  hintCard: { marginTop: 12, padding: 20, alignItems: 'center' },
  hintText: { color: '#CBD5E1', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  expectationText: { color: '#94A3B8', fontSize: 12, textAlign: 'center', lineHeight: 19, marginTop: 10 },
  confidenceText: { color: '#64748B', fontSize: 12, textAlign: 'center', marginTop: 16 },
  debugCard: {
    padding: 16,
    marginTop: 18,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.28)',
    backgroundColor: 'rgba(56,189,248,0.06)',
  },
  debugHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  debugTitle: { color: '#E0F2FE', fontSize: 14, fontWeight: '800', marginLeft: 8 },
  debugText: { color: '#CBD5E1', fontSize: 12, lineHeight: 18 },
  interviewBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.35)', backgroundColor: 'rgba(56,189,248,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  interviewBtnIcon: { fontSize: 20, marginBottom: 4 },
  interviewBtnText: { color: '#F8FAFC', fontSize: 13, fontWeight: '700' },
});
