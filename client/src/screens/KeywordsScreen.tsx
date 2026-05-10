import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import GlassCard from '../components/GlassCard';
import Tag from '../components/Tag';
import BackgroundGlow from '../components/BackgroundGlow';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';

export default function KeywordsScreen() {
  const insets = useSafeAreaInsets();
  const { analysisResult } = useApp();
  const matched = analysisResult?.details.matched_keywords ?? [];
  const missing = analysisResult?.details.missing_keywords ?? [];
  const keywordScore = analysisResult?.details.scores.keyword_match ?? 0;

  return (
    <View style={styles.container}>
      <BackgroundGlow />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 80 }]}>
        
        {/* Step 5.1 & 5.3 - Base Analytics Header */}
        <Animated.View entering={FadeInDown.duration(800).springify()}>
          <GlassCard style={{ marginBottom: 32, padding: 24 }}>
            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 12}}>
                <Text style={{fontSize: 22}}>🔍</Text>
                <Text style={styles.headerTitle}>Keyword Analysis</Text>
            </View>
            <Text style={{color: '#94A3B8', fontSize: 14, marginBottom: 20}}>These keywords come from your uploaded resume and target job description.</Text>
            
            {/* Keyword Strength Bar */}
            <View>
              <Text style={{color: '#64748B', fontSize: 12, marginBottom: 8, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1}}>Keyword Strength</Text>
              <View style={{height: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden'}}>
                  <View style={{height: 8, backgroundColor: '#A855F7', borderRadius: 4, width: `${keywordScore}%` as any}} />
              </View>
            </View>
          </GlassCard>
        </Animated.View>

        {/* Missing Keywords */}
        <Animated.View entering={FadeInDown.duration(800).delay(200).springify()}>
          <View style={styles.section}>
            <Text style={styles.missingTitle}>Missing Keywords</Text>
            <View style={styles.tagsContainer}>
              {missing.length ? missing.map((kw, i) => <Tag key={i} label={kw} type="red" />) : <Text style={styles.emptyText}>No major missing keywords found.</Text>}
            </View>
          </View>
        </Animated.View>

        {/* Step 5.2 - Smart Impact Message */}
        <Animated.View entering={FadeInDown.duration(800).delay(350).springify()}>
            <Text style={styles.impactMessage}>Add only the missing keywords you can honestly support with projects, tools, or coursework.</Text>
        </Animated.View>

        {/* Matched Keywords */}
        <Animated.View entering={FadeInDown.duration(800).delay(500).springify()}>
          <View style={[styles.section, {marginTop: 32}]}>
            <Text style={styles.matchedTitle}>Matched Keywords</Text>
            <View style={styles.tagsContainer}>
              {matched.length ? matched.map((kw, i) => <Tag key={i} label={kw} type="green" />) : <Text style={styles.emptyText}>No matched keywords found yet.</Text>}
            </View>
          </View>
        </Animated.View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050811' },
  scroll: { paddingHorizontal: 24 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#F8FAFC', marginLeft: 8 },
  section: { marginBottom: 12 },
  missingTitle: { fontSize: 15, color: '#EF4444', fontWeight: '700', marginBottom: 16 },
  matchedTitle: { fontSize: 15, color: '#22C55E', fontWeight: '700', marginBottom: 16 },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  emptyText: { color: '#94A3B8', fontSize: 14, lineHeight: 22 },
  impactMessage: { color: '#A855F7', fontSize: 14, marginTop: 12, lineHeight: 22, fontWeight: '500' }
});
