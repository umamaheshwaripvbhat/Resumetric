import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import GlassCard from '../components/GlassCard';
import GradientButton from '../components/GradientButton';
import BackgroundGlow from '../components/BackgroundGlow';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';

export default function ResumeBuilderScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { userId } = useApp();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    personal_info: '',
    work_experience: '',
    education: '',
    skills: '',
    projects: ''
  });

  const steps = [
    { title: 'Personal Info', key: 'personal_info', placeholder: "John Doe\nSoftware Engineer\njohn@example.com\n+1 234 567 8900" },
    { title: 'Work Experience', key: 'work_experience', placeholder: "Software Engineer at Tech Corp\nJan 2020 - Present\n- Developed web applications..." },
    { title: 'Education', key: 'education', placeholder: "BS Computer Science\nUniversity of Technology\n2016 - 2020" },
    { title: 'Skills', key: 'skills', placeholder: "Python, React, TypeScript, Node.js" },
    { title: 'Projects', key: 'projects', placeholder: "E-commerce Platform\n- Built a scalable platform using React and Node.js..." }
  ];

  const handleNext = () => {
    if (step < steps.length) setStep(step + 1);
    else submitResume();
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
    else navigation.goBack();
  };

  const updateField = (value: string) => {
    setFormData(prev => ({ ...prev, [steps[step - 1].key]: value }));
  };

  const importFromLinkedIn = async () => {
    try {
      setLoading(true);
      // 1. Get Authorization URL from backend
      const urlRes = await fetch('http://localhost:5000/auth/linkedin/url');
      const urlData = await urlRes.json();
      
      if (urlData.url === 'mock') {
         // Fallback to mock behavior if no Client ID is set in .env
         const res = await fetch('http://localhost:5000/auth/linkedin/callback?code=mockcode');
         const data = await res.json();
         if (data.profile) {
           setFormData({
             personal_info: `${data.profile.name}\n${data.profile.headline}`,
             work_experience: data.profile.experience,
             education: data.profile.education,
             skills: data.profile.skills,
             projects: ''
           });
         }
         alert('Imported from LinkedIn (Mock Mode)!');
      } else {
         // 2. Open real LinkedIn OAuth page
         alert('Opening LinkedIn. After authorizing, return to the app.');
         Linking.openURL(urlData.url);
      }
    } catch (e) {
      alert('Failed to initiate LinkedIn import');
    } finally {
      setLoading(false);
    }
  };

  const submitResume = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:5000/resume/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId || 1, // fallback to 1 if no user context
          ...formData
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert('Resume built successfully! PDF generated.');
        navigation.goBack();
      } else {
        alert(data.error || 'Failed to build resume');
      }
    } catch (e) {
      alert('Error building resume');
    } finally {
      setLoading(false);
    }
  };

  const currentStepData = steps[step - 1];

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <BackgroundGlow />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Resume Builder</Text>
        <TouchableOpacity onPress={importFromLinkedIn} style={styles.linkedinBtn} disabled={loading}>
          <Ionicons name="logo-linkedin" size={20} color="#fff" />
          <Text style={styles.linkedinText}>Import</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Animated.View entering={FadeInDown.duration(600).springify()}>
          <View style={styles.progressContainer}>
            {steps.map((s, i) => (
              <View key={i} style={[styles.progressDot, i + 1 <= step && styles.progressDotActive]} />
            ))}
          </View>
          
          <Text style={styles.stepTitle}>Step {step} of {steps.length}</Text>
          <Text style={styles.sectionTitle}>{currentStepData.title}</Text>

          <GlassCard style={styles.inputCard}>
            <TextInput
              style={styles.input}
              placeholder={currentStepData.placeholder}
              placeholderTextColor="#64748B"
              multiline
              textAlignVertical="top"
              value={formData[currentStepData.key as keyof typeof formData]}
              onChangeText={updateField}
            />
          </GlassCard>

          <GradientButton 
            title={loading ? "Processing..." : (step === steps.length ? "Finish & Generate PDF" : "Next Step")} 
            onPress={handleNext}
            disabled={loading}
          />
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F1A' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 20, zIndex: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#F8FAFC' },
  linkedinBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0A66C2', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  linkedinText: { color: '#fff', fontWeight: '700', marginLeft: 6, fontSize: 13 },
  scroll: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 60 },
  progressContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 30, gap: 8 },
  progressDot: { width: 40, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)' },
  progressDotActive: { backgroundColor: '#5B8CFF' },
  stepTitle: { fontSize: 14, color: '#64748B', fontWeight: '700', textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' },
  sectionTitle: { fontSize: 32, fontWeight: '800', color: '#F8FAFC', marginBottom: 24, textAlign: 'center' },
  inputCard: { padding: 4, marginBottom: 32 },
  input: { color: '#F8FAFC', fontSize: 16, lineHeight: 24, padding: 20, minHeight: 250 }
});
