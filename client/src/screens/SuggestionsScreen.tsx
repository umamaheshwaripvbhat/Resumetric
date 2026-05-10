import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Modal, KeyboardAvoidingView,
  TouchableOpacity, Animated as RNAnimated, Dimensions, Platform,
} from 'react-native';
import GlassCard from '../components/GlassCard';
import SuggestionCard from '../components/SuggestionCard';
import GradientButton from '../components/GradientButton';
import BackgroundGlow from '../components/BackgroundGlow';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function SuggestionsScreen() {
  const insets = useSafeAreaInsets();
  const { analysisResult } = useApp();
  const [showSummary, setShowSummary] = useState(false);
  const fadeAnim = useRef(new RNAnimated.Value(0)).current;
  const scaleAnim = useRef(new RNAnimated.Value(0.85)).current;

  const improvements = analysisResult?.details.improvements ?? [];
  const overallScore = analysisResult?.overall_score ?? 0;
  const matchedKeywords = analysisResult?.details.matched_keywords ?? [];
  const missingKeywords = analysisResult?.details.missing_keywords ?? [];
  const totalKeywords = matchedKeywords.length + missingKeywords.length;
  const keywordMatch = totalKeywords > 0 ? Math.round((matchedKeywords.length / totalKeywords) * 100) : 0;
  const scores = analysisResult?.details.scores;

  const handleApplyAll = () => {
    setShowSummary(true);
    RNAnimated.parallel([
      RNAnimated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      RNAnimated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start();
  };

  const handleClose = () => {
    RNAnimated.parallel([
      RNAnimated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      RNAnimated.timing(scaleAnim, { toValue: 0.9, duration: 200, useNativeDriver: true }),
    ]).start(() => setShowSummary(false));
  };

  const getScoreColor = (s: number) => s >= 75 ? '#34D399' : s >= 50 ? '#FBBF24' : '#F87171';

  return (
    <View style={styles.container}>
      <BackgroundGlow />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 }]}>

        <Animated.View entering={FadeInDown.duration(800).springify()}>
          <GlassCard style={styles.headerGlass}>
            <Text style={styles.aiTitle}>🤖 AI Resume Coach</Text>
            <Text style={styles.aiSub}>I analyzed your resume and found {improvements.length} areas to improve.</Text>
          </GlassCard>
        </Animated.View>

        <View style={styles.chatContainer}>
          <Animated.View entering={FadeInDown.duration(800).delay(200).springify()} style={styles.aiMessageRow}>
            <View style={styles.aiAvatar}>
              <Text style={{ fontSize: 20 }}>🤖</Text>
            </View>
            <GlassCard style={styles.bubbleGlass}>
              <Text style={styles.bubbleText}>
                {improvements.length
                  ? 'These upgrades are based on the resume you uploaded and the job description you pasted.'
                  : 'No rewrite suggestions were returned for this resume. Try a more detailed job description for sharper feedback.'}
              </Text>
            </GlassCard>
          </Animated.View>

          {improvements.map((item, index) => {
            const original = typeof item === 'string' ? 'Resume bullet or section needs strengthening.' : item.original;
            const improved = typeof item === 'string' ? item : item.improved;
            const reason = typeof item === 'string' ? undefined : item.reason;
            const expectedByCompanies = typeof item === 'string' ? undefined : item.expected_by_companies;
            return (
              <Animated.View key={`${index}-${improved}`} entering={FadeInDown.duration(800).delay(350 + index * 120).springify()} style={{ marginLeft: 52 }}>
                <SuggestionCard original={original} improved={improved} reason={reason} expectedByCompanies={expectedByCompanies} />
              </Animated.View>
            );
          })}
        </View>

        {improvements.length > 0 && (
          <Animated.View entering={FadeInDown.duration(800).delay(1200).springify()} style={{ marginTop: 40 }}>
            <GradientButton
              title="Apply All Improvements 🚀"
              onPress={handleApplyAll}
            />
          </Animated.View>
        )}
      </ScrollView>

      {/* ── Improvements Summary Modal ── */}
      <Modal visible={showSummary} transparent animationType="none" onRequestClose={handleClose}>
        <RNAnimated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
          <RNAnimated.View style={[styles.modalSheet, { transform: [{ scale: scaleAnim }] }]}>

            {/* Fixed close button */}
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <Ionicons name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>

            {/* Scrollable content */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              bounces={true}
            >
              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={styles.successBadge}>
                  <Ionicons name="checkmark-circle" size={42} color="#34D399" />
                </View>
                <Text style={styles.modalTitle}>All Improvements Applied!</Text>
                <Text style={styles.modalSubtitle}>{improvements.length} changes made to your resume</Text>
              </View>

              {/* Score + Keyword row */}
              <View style={styles.metricsRow}>
                <View style={styles.metricCard}>
                  <View style={[styles.scoreCircle, { borderColor: getScoreColor(overallScore) }]}>
                    <Text style={[styles.scoreNumber, { color: getScoreColor(overallScore) }]}>{overallScore}</Text>
                    <Text style={styles.scoreLabel}>/ 100</Text>
                  </View>
                  <Text style={styles.metricTitle}>Overall Score</Text>
                  <Text style={[styles.metricPill, { backgroundColor: `${getScoreColor(overallScore)}22`, color: getScoreColor(overallScore) }]}>
                    {overallScore >= 75 ? '🟢 Strong' : overallScore >= 50 ? '🟡 Good' : '🔴 Needs Work'}
                  </Text>
                </View>
                <View style={styles.metricCard}>
                  <View style={[styles.scoreCircle, { borderColor: getScoreColor(keywordMatch) }]}>
                    <Text style={[styles.scoreNumber, { color: getScoreColor(keywordMatch) }]}>{keywordMatch}%</Text>
                  </View>
                  <Text style={styles.metricTitle}>Keyword Match</Text>
                  <Text style={styles.metricDetail}>{matchedKeywords.length}/{totalKeywords} matched</Text>
                </View>
              </View>

              {/* Sub-scores */}
              {scores && (
                <View style={styles.subScoresSection}>
                  <Text style={styles.sectionLabel}>Score Breakdown</Text>
                  {Object.entries({
                    'Keyword Match': scores.keyword_match,
                    'Impact Metrics': scores.impact_metrics,
                    'Technical Fit': scores.technical_relevance,
                    'Structure': scores.structure_readability ?? scores.structure,
                    'Experience Depth': scores.experience_depth,
                    'Consistency': scores.consistency,
                  }).filter(([, v]) => v !== undefined).map(([label, value]) => (
                    <View key={label} style={styles.subScoreRow}>
                      <Text style={styles.subScoreLabel}>{label}</Text>
                      <View style={styles.subScoreBarBg}>
                        <View style={[styles.subScoreBarFill, { width: `${value}%` as any, backgroundColor: getScoreColor(value!) }]} />
                      </View>
                      <Text style={[styles.subScoreVal, { color: getScoreColor(value!) }]}>{value}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Changes list */}
              <Text style={styles.sectionLabel}>Changes Applied</Text>
              {improvements.map((item, i) => {
                const improved = typeof item === 'string' ? item : item.improved;
                const original = typeof item === 'string' ? '' : item.original;
                return (
                  <View key={i} style={styles.changeItem}>
                    <View style={styles.changeIndex}>
                      <Text style={styles.changeIndexText}>{i + 1}</Text>
                    </View>
                    <View style={styles.changeContent}>
                      {original ? (
                        <Text style={styles.changeOriginal}>❌ {original}</Text>
                      ) : null}
                      <Text style={styles.changeImproved}>✅ {improved}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            {/* Fixed Done button */}
            <View style={styles.doneBtnWrapper}>
              <TouchableOpacity style={styles.doneBtn} onPress={handleClose}>
                <Text style={styles.doneBtnText}>Done ✓</Text>
              </TouchableOpacity>
            </View>

          </RNAnimated.View>
        </RNAnimated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050811' },
  scroll: { paddingHorizontal: 24 },
  headerGlass: { marginBottom: 32, paddingVertical: 20, paddingHorizontal: 24, borderColor: 'rgba(91, 140, 255, 0.3)' },
  aiTitle: { fontSize: 20, fontWeight: '800', color: '#F8FAFC', marginBottom: 4 },
  aiSub: { fontSize: 14, color: '#94A3B8' },
  chatContainer: { paddingTop: 6 },
  aiMessageRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  aiAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(91, 140, 255, 0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: '#5B8CFF', shadowColor: '#5B8CFF', shadowOpacity: 0.6, shadowRadius: 15, shadowOffset: { width: 0, height: 0 } },
  bubbleGlass: { flex: 1, padding: 16, backgroundColor: 'rgba(255,255,255,0.03)', borderTopLeftRadius: 4 },
  bubbleText: { color: '#CBD5E1', fontSize: 15, lineHeight: 22 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#0D1526', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 16,
    height: height * 0.9,
    borderTopWidth: 1, borderColor: 'rgba(91,140,255,0.25)',
    shadowColor: '#5B8CFF', shadowOpacity: 0.3, shadowRadius: 30, shadowOffset: { width: 0, height: -10 },
  },
  modalScrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  modalHeader: { alignItems: 'center', marginBottom: 24 },
  successBadge: { marginBottom: 10 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#F8FAFC', marginBottom: 4, textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: '#64748B', textAlign: 'center' },
  closeBtn: { position: 'absolute', top: 12, right: 16, padding: 8, zIndex: 10 },

  // Metrics
  metricsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 24 },
  metricCard: { alignItems: 'center', flex: 1 },
  scoreCircle: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 3, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', marginBottom: 8,
    shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
  },
  scoreNumber: { fontSize: 26, fontWeight: '800' },
  scoreLabel: { fontSize: 11, color: '#64748B' },
  metricTitle: { fontSize: 12, color: '#94A3B8', fontWeight: '600', marginBottom: 4 },
  metricPill: { fontSize: 11, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  metricDetail: { fontSize: 11, color: '#64748B' },

  // Sub scores
  subScoresSection: { marginBottom: 20 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#5B8CFF', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  subScoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  subScoreLabel: { width: 110, fontSize: 12, color: '#94A3B8' },
  subScoreBarBg: { flex: 1, height: 5, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, marginHorizontal: 8, overflow: 'hidden' },
  subScoreBarFill: { height: 5, borderRadius: 3 },
  subScoreVal: { width: 28, fontSize: 12, fontWeight: '700', textAlign: 'right' },

  // Changes list
  changeItem: { flexDirection: 'row', marginBottom: 14, gap: 10 },
  changeIndex: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(91,140,255,0.2)', alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0 },
  changeIndexText: { fontSize: 11, fontWeight: '800', color: '#5B8CFF' },
  changeContent: { flex: 1 },
  changeOriginal: { fontSize: 12, color: '#F87171', marginBottom: 4, textDecorationLine: 'line-through', opacity: 0.7, lineHeight: 17 },
  changeImproved: { fontSize: 12, color: '#34D399', lineHeight: 18 },

  // Done button
  doneBtnWrapper: {
    paddingHorizontal: 24, paddingBottom: 20, paddingTop: 12,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#0D1526',
  },
  doneBtn: {
    backgroundColor: '#5B8CFF', borderRadius: 14, paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#5B8CFF', shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 4 },
  },
  doneBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
