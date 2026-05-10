import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import GradientButton from '../components/GradientButton';
import BackgroundGlow from '../components/BackgroundGlow';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ResumePreviewScreen() {
  const insets = useSafeAreaInsets();
  const [showOriginal, setShowOriginal] = useState(false);
  
  return (
    <View style={styles.container}>
      <BackgroundGlow />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 80 }]}>
        <Animated.View entering={FadeInDown.duration(800).springify()}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Live Preview</Text>
            
            <View style={styles.toggleContainer}>
               <TouchableOpacity 
                 activeOpacity={0.8}
                 onPress={() => setShowOriginal(true)}
                 style={[styles.toggleBtn, showOriginal ? styles.toggleBtnActive : null]}>
                 <Ionicons name="document-text-outline" size={16} color={showOriginal ? "#0B0F1A" : "#64748B"} />
                 <Text style={[styles.toggleText, showOriginal ? styles.toggleTextActive : null]}> Original</Text>
               </TouchableOpacity>
               <TouchableOpacity 
                 activeOpacity={0.8}
                 onPress={() => setShowOriginal(false)}
                 style={[styles.toggleBtn, !showOriginal ? styles.toggleBtnActiveAI : null]}>
                 <Ionicons name="sparkles" size={16} color={!showOriginal ? "#FFFFFF" : "#64748B"} />
                 <Text style={[styles.toggleText, !showOriginal ? styles.toggleTextActiveAI : null]}> AI Mode</Text>
               </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(800).delay(200).springify()}>
          <View style={styles.documentWrapper}>
            <View style={styles.document}>
              <Text style={styles.name}>John Doe</Text>
              <Text style={styles.contact}>johndoe@email.com • github.com/johndoe</Text>
              
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Summary</Text>
                <Text style={styles.bodyText}>
                  Frontend developer with 3+ years of experience building scalable web applications using React and React Native.
                </Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Experience</Text>
                <Text style={styles.jobTitle}>Software Engineer • TechCorp</Text>
                
                {showOriginal ? (
                  <Text style={styles.bodyText}>• Worked on frontend tickets and fixed bugs.</Text>
                ) : (
                  <Text style={styles.highlightedText}>
                    • Developed 15+ frontend features in React and resolved 40+ critical UI bugs, reducing crash rate by 12%.
                  </Text>
                )}
                
                <Text style={styles.bodyText}>
                  • Integrated REST APIs to dynamically render user data dashboards, decreasing load times by 200ms.
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeIn.duration(800).delay(400)}>
          <GradientButton title="⬇ Export Updated Resume" onPress={() => {}} style={{ marginTop: 32 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050811' },
  scroll: { paddingHorizontal: 24 },
  header: { marginBottom: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#F8FAFC', letterSpacing: -1 },
  toggleContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 4 },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16 },
  toggleBtnActive: { backgroundColor: '#F8FAFC' },
  toggleBtnActiveAI: { backgroundColor: '#5B8CFF', shadowColor: '#5B8CFF', shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width:0, height:2 } },
  toggleText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  toggleTextActive: { color: '#0B0F1A' },
  toggleTextActiveAI: { color: '#FFFFFF' },
  documentWrapper: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.8, shadowRadius: 20, shadowOffset: { width:0, height:10 } },
  document: { padding: 16 },
  name: { fontSize: 24, fontWeight: '800', color: '#0F172A', textAlign: 'center', letterSpacing: 1 },
  contact: { fontSize: 12, color: '#64748B', textAlign: 'center', marginBottom: 32, marginTop: 4 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A', borderBottomWidth: 2, borderBottomColor: '#E2E8F0', paddingBottom: 6, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1.5 },
  jobTitle: { fontSize: 15, fontWeight: '700', color: '#334155', marginBottom: 12 },
  bodyText: { fontSize: 14, color: '#475569', lineHeight: 22, marginBottom: 10 },
  highlightedText: { fontSize: 14, color: '#166534', lineHeight: 22, marginBottom: 10, fontWeight: '600', backgroundColor: '#DCFCE7', paddingVertical: 4, paddingHorizontal: 6, borderRadius: 4, overflow: 'hidden' }
});
