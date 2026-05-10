import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import GlassCard from '../components/GlassCard';
import BackgroundGlow from '../components/BackgroundGlow';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function JobMatchScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { resume_id, role } = (route.params as any) || { resume_id: 1, role: 'Software Engineer' };

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await fetch(`http://localhost:5000/jobs/match?resume_id=${resume_id}&job_title=${encodeURIComponent(role)}`);
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (e) {
      console.error('Failed to fetch jobs', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <BackgroundGlow />
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Matching Jobs</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#5B8CFF" />
          <Text style={{ color: '#94A3B8', marginTop: 12 }}>Finding the best matches...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {jobs.map((job, idx) => (
            <Animated.View key={idx} entering={FadeInDown.duration(600).delay(idx * 100).springify()}>
              <GlassCard style={styles.jobCard}>
                <View style={styles.jobTop}>
                  <View style={styles.iconContainer}>
                    <Ionicons name="briefcase-outline" size={24} color="#A855F7" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 16 }}>
                    <Text style={styles.jobTitle}>{job.job_title}</Text>
                    <Text style={styles.companyName}>{job.employer_name}</Text>
                  </View>
                </View>
                <View style={styles.jobBottom}>
                  <View style={styles.salaryTag}>
                    <Text style={styles.salaryText}>
                      ${(job.job_min_salary / 1000).toFixed(0)}k - ${(job.job_max_salary / 1000).toFixed(0)}k
                    </Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.applyBtn}
                    onPress={() => Linking.openURL(job.job_apply_link)}
                  >
                    <Text style={styles.applyBtnText}>Apply Now</Text>
                  </TouchableOpacity>
                </View>
              </GlassCard>
            </Animated.View>
          ))}
          {jobs.length === 0 && (
            <Text style={{ color: '#94A3B8', textAlign: 'center', marginTop: 40 }}>No jobs found matching your skills.</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F1A' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 20, zIndex: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#F8FAFC' },
  scroll: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 60 },
  jobCard: { padding: 20, marginBottom: 16, borderColor: 'rgba(168, 85, 247, 0.3)' },
  jobTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  iconContainer: { width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(168, 85, 247, 0.1)', alignItems: 'center', justifyContent: 'center' },
  jobTitle: { fontSize: 18, fontWeight: '700', color: '#F8FAFC', marginBottom: 4 },
  companyName: { fontSize: 14, color: '#CBD5E1' },
  jobBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 16 },
  salaryTag: { backgroundColor: 'rgba(34, 197, 94, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  salaryText: { color: '#22C55E', fontWeight: '700', fontSize: 13 },
  applyBtn: { backgroundColor: '#5B8CFF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  applyBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 }
});
