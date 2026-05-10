import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import GlassCard from '../components/GlassCard';
import GradientButton from '../components/GradientButton';
import InsightCard from '../components/InsightCard';
import BackgroundGlow from '../components/BackgroundGlow';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';

export default function HomeScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { file, setFile, jobDesc, setJobDesc, submitAnalysis, validate, validateUpload, analysisError, uploadValidation } = useApp();
  const [isFocused, setIsFocused] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const dropZoneRef = useRef<any>(null);

  const isSupportedResumeFile = (selected: File) => {
    const name = selected.name.toLowerCase();
    return name.endsWith('.pdf') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png');
  };

  // ──────────────────────────────────────────────
  // Drag & Drop support (web only)
  // ──────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web' || !dropZoneRef.current) return;
    const el = dropZoneRef.current;

    const prevent = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); };

    const handleDragEnter = (e: DragEvent) => { prevent(e); setIsDragOver(true); };
    const handleDragOver  = (e: DragEvent) => { prevent(e); setIsDragOver(true); };
    const handleDragLeave = (e: DragEvent) => { prevent(e); setIsDragOver(false); };
    const handleDrop = async (e: DragEvent) => {
      prevent(e);
      setIsDragOver(false);
      const droppedFile = e.dataTransfer?.files?.[0];
      if (droppedFile) {
        if (!isSupportedResumeFile(droppedFile)) {
          setUploadError('Accepted formats: PDF, JPG, JPEG, PNG.');
          return;
        }
        setUploadError(null);
        setFile(droppedFile);
        await validateUpload(droppedFile);
      }
    };

    el.addEventListener('dragenter', handleDragEnter);
    el.addEventListener('dragover', handleDragOver);
    el.addEventListener('dragleave', handleDragLeave);
    el.addEventListener('drop', handleDrop);

    return () => {
      el.removeEventListener('dragenter', handleDragEnter);
      el.removeEventListener('dragover', handleDragOver);
      el.removeEventListener('dragleave', handleDragLeave);
      el.removeEventListener('drop', handleDrop);
    };
  }, []);

  // ──────────────────────────────────────────────
  // File input change handler
  // ──────────────────────────────────────────────
  const onFileSelected = async (e: any) => {
    const selected = e?.target?.files?.[0];
    if (!selected) return;
    if (!isSupportedResumeFile(selected)) {
      setUploadError('Accepted formats: PDF, JPG, JPEG, PNG.');
      return;
    }
    setUploadError(null);
    setFile(selected);
    await validateUpload(selected);
  };

  // ──────────────────────────────────────────────
  // Analyze handler – sends file to backend
  // ──────────────────────────────────────────────
  const handleAnalyze = async () => {

    const errors = validate();
    if (errors.length) {
      alert(errors[0].message);
      return;
    }

    // Navigate to loading screen immediately
    navigation.navigate('Analyzing' as never);

    // Fire the analysis in context (validates, sends, stores result)
    await submitAnalysis();
  };

  const inputAnimatedStyle = useAnimatedStyle(() => ({
    height: withSpring(isFocused ? 180 : 120, { damping: 20, stiffness: 200 }),
    backgroundColor: withTiming(isFocused ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)'),
    borderColor: withTiming(isFocused ? '#5B8CFF' : 'rgba(255, 255, 255, 0.2)'),
  }));

  // ──────────────────────────────────────────────
  // Upload zone visual state
  // ──────────────────────────────────────────────
  const hasFile = !!file;
  const validationAccepted = uploadValidation.status === 'accepted';
  const validationDeclined = uploadValidation.status === 'declined';
  const validationPending = uploadValidation.status === 'validating';
  const canAnalyze = validationAccepted && uploadValidation.canAnalyze !== false;
  const needsTextPdf = validationAccepted && !canAnalyze;
  const accentColor = hasFile ? '#22C55E' : isDragOver ? '#A855F7' : '#5B8CFF';
  const borderColor = hasFile
    ? 'rgba(34, 197, 94, 0.5)'
    : isDragOver
    ? 'rgba(168, 85, 247, 0.6)'
    : 'rgba(91, 140, 255, 0.4)';
  const bgColor = hasFile
    ? 'rgba(34, 197, 94, 0.06)'
    : isDragOver
    ? 'rgba(168, 85, 247, 0.08)'
    : 'rgba(91, 140, 255, 0.05)';

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <BackgroundGlow />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 60 }]} keyboardShouldPersistTaps="handled">
        
        <Animated.View entering={FadeInDown.duration(800).springify()} style={styles.header}>
          <Text style={styles.title}>Resumetric</Text>
          <Text style={styles.subtitle}>AI-powered resume intelligence to precisely align you with systems.</Text>
          
          <TouchableOpacity 
            style={{ marginTop: 24, paddingVertical: 12, paddingHorizontal: 20, backgroundColor: 'rgba(91, 140, 255, 0.1)', borderRadius: 20, borderWidth: 1, borderColor: '#5B8CFF', flexDirection: 'row', alignItems: 'center' }}
            onPress={() => navigation.navigate('ResumeBuilder' as never)}
          >
            <Ionicons name="document-text" size={18} color="#5B8CFF" />
            <Text style={{ marginLeft: 8, color: '#5B8CFF', fontWeight: '700' }}>Build Resume from Scratch</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* ─── UPLOAD ZONE ─── */}
        <Animated.View entering={FadeInDown.duration(800).delay(150).springify()}>
          {Platform.OS === 'web' ? (
            <View ref={dropZoneRef}>
              {/* 
                KEY FIX: We use a native <label> linked to the <input> via htmlFor/id.
                The browser natively opens the file dialog when a label is clicked.
                No .click() JS call needed — bypasses all gesture handler issues.
              */}
              {React.createElement('input', {
                id: 'resume-file-input',
                type: 'file',
                accept: '.pdf,.jpg,.jpeg,.png',
                style: { display: 'none' },
                onChange: onFileSelected,
              })}
              {React.createElement('label', {
                htmlFor: 'resume-file-input',
                style: {
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '48px 24px',
                  marginBottom: 32,
                  borderStyle: 'dashed',
                  borderWidth: 2,
                  borderColor: borderColor,
                  borderRadius: 24,
                  backgroundColor: bgColor,
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                },
              },
                React.createElement('div', {
                  style: {
                    width: 88, height: 88, borderRadius: 44,
                    backgroundColor: hasFile ? 'rgba(34,197,94,0.1)' : 'rgba(91,140,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 20,
                  }
                },
                  React.createElement(Ionicons as any, { name: 'cloud-upload', size: 42, color: accentColor })
                ),
                React.createElement('span', {
                  style: { fontSize: 18, fontWeight: '700', color: '#F8FAFC', marginBottom: 6, textAlign: 'center' }
                }, hasFile ? file.name : 'Drop your resume here'),
                React.createElement('span', {
                  style: { fontSize: 14, color: hasFile ? '#22C55E' : '#64748B', textAlign: 'center' }
                }, hasFile ? 'File uploaded. We now verify whether it is really a resume.' : 'Click to browse or drag & drop'),
                uploadError && React.createElement('span', {
                  style: { fontSize: 13, color: '#F87171', fontWeight: '700', marginTop: 12, textAlign: 'center' }
                }, uploadError),
                validationPending && React.createElement('span', {
                  style: { fontSize: 13, color: '#F8FAFC', fontWeight: '700', marginTop: 12, textAlign: 'center' }
                }, 'Checking file contents... this can take up to 10 seconds.'),
                validationAccepted && React.createElement('span', {
                  style: { fontSize: 13, color: '#22C55E', fontWeight: '700', marginTop: 12, textAlign: 'center' }
                }, uploadValidation.message),
                validationDeclined && React.createElement('span', {
                  style: { fontSize: 13, color: '#F87171', fontWeight: '700', marginTop: 12, textAlign: 'center' }
                }, uploadValidation.message)
              )}
            </View>
          ) : (
            /* Fallback for native mobile (non-web) */
            <GlassCard style={[styles.uploadCard, { borderColor }]}>
              <View style={styles.uploadIconContainer}>
                <Ionicons name="cloud-upload" size={42} color={accentColor} />
              </View>
              <Text style={styles.uploadTitle}>Upload not available on this platform</Text>
            </GlassCard>
          )}
        </Animated.View>

        {hasFile && (
          <Animated.View entering={FadeInDown.duration(600).delay(220).springify()}>
            <GlassCard style={styles.debugCard}>
              <View style={styles.debugHeader}>
                <Ionicons name="bug-outline" size={18} color="#38BDF8" />
                <Text style={styles.debugTitle}>PDF Extraction Debug</Text>
              </View>
              <Text style={styles.debugMeta}>
                Method: {uploadValidation.extractionMethod || 'pending'} | Characters: {uploadValidation.extractedCharacterCount ?? 0}
              </Text>
              <Text style={styles.debugText}>
                {uploadValidation.extractedPreview || (validationPending ? 'Extracting text...' : 'No extracted text returned yet.')}
              </Text>
            </GlassCard>
          </Animated.View>
        )}

        {/* ─── JOB DESCRIPTION ─── */}
        <Animated.View entering={FadeInDown.duration(800).delay(300).springify()} style={styles.inputSection}>
          <Text style={styles.sectionTitle}>Target Job Description</Text>
          <Animated.View style={[styles.inputWrapper, inputAnimatedStyle]}>
            <TextInput 
              style={styles.input}
              placeholder="Paste the job description you want to target here..."
              placeholderTextColor="#64748B"
              multiline
              textAlignVertical="top"
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              value={jobDesc}
              onChangeText={setJobDesc}
            />
          </Animated.View>
        </Animated.View>

        {/* ─── CTA ─── */}
        <Animated.View entering={FadeInDown.duration(800).delay(450).springify()}>
          {needsTextPdf && (
            <GlassCard style={styles.helperCard}>
              <View style={styles.helperHeader}>
                <Ionicons name="alert-circle-outline" size={18} color="#FBBF24" />
                <Text style={styles.helperTitle}>Scanned Resume Detected</Text>
              </View>
              <Text style={styles.helperText}>
                This file was accepted as a resume, but it does not contain machine-readable text yet.
              </Text>
              <Text style={styles.helperSteps}>
                Export it again as a text-based PDF from Word, Google Docs, Canva, or your resume builder, then upload the new file.
              </Text>
            </GlassCard>
          )}
          <GradientButton 
            title={needsTextPdf ? '📄 Upload Text-Based PDF To Continue' : '✨ Start AI Analysis'} 
            onPress={handleAnalyze} 
            disabled={!validationAccepted || validationPending}
            style={styles.cta}
          />
          {analysisError && <Text style={styles.analysisError}>{analysisError}</Text>}
        </Animated.View>

        {/* ─── INSIGHTS ─── */}
        <Animated.View entering={FadeInDown.duration(800).delay(600).springify()}>
           <Text style={styles.sectionTitle}>Why your resume matters</Text>
           <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.insightsScroll}>
              <InsightCard icon="time-outline" iconColor="#5B8CFF" title="6 Seconds" subtitle="Average time a recruiter spends on a resume." style={{ width: 220, marginRight: 16 }} />
              <InsightCard icon="server-outline" iconColor="#22C55E" title="75% Rejected" subtitle="Resumes are never seen by a human due to ATS filtering." style={{ width: 220, marginRight: 16 }} />
           </ScrollView>
        </Animated.View>

        {/* ─── HISTORY ─── */}
        <Animated.View entering={FadeInDown.duration(800).delay(750).springify()} style={{marginTop: 16}}>
          <Text style={styles.sectionTitle}>History Tracking</Text>
          <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('VersionHistory' as never)}>
            <GlassCard style={styles.historyCard}>
              <View style={styles.historyRow}>
                 <Text style={styles.historyJob}>Frontend Engineer @ Stripe</Text>
                 <View style={styles.badgeImproved}><Text style={styles.badgeText}>88%</Text></View>
              </View>
              <Text style={styles.historyDiff}>↑ +14% since original version</Text>
              
              <View style={[styles.historyRow, { marginTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 16 }]}>
                 <Text style={styles.historyJob}>React Native Developer</Text>
                 <View style={styles.badgeNeutral}><Text style={[styles.badgeText, { color: '#F59E0B' }]}>64%</Text></View>
              </View>
              <Text style={styles.historyDiff}>Needs ATS optimization adjustments</Text>
            </GlassCard>
          </TouchableOpacity>
        </Animated.View>
        
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050811' },
  scroll: { paddingHorizontal: 24 },
  header: { alignItems: 'flex-start', marginBottom: 40 },
  title: { fontSize: 44, fontWeight: '800', color: '#F8FAFC', letterSpacing: -1.5, marginBottom: 12 },
  subtitle: { fontSize: 16, color: '#CBD5E1', lineHeight: 24, paddingRight: 20 },
  uploadCard: { alignItems: 'center', paddingVertical: 48, marginBottom: 32, borderStyle: 'dashed', borderWidth: 2, borderColor: 'rgba(91, 140, 255, 0.4)', backgroundColor: 'rgba(91, 140, 255, 0.05)' },
  uploadIconContainer: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(91, 140, 255, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  uploadTitle: { fontSize: 18, fontWeight: '700', color: '#F8FAFC', marginBottom: 6 },
  uploadSub: { fontSize: 14, color: '#64748B' },
  inputSection: { marginBottom: 36 },
  sectionTitle: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '700', color: '#64748B', marginBottom: 16 },
  inputWrapper: { borderRadius: 24, overflow: 'hidden', borderWidth: 1 },
  input: { color: '#F8FAFC', flex: 1, padding: 20, fontSize: 16, lineHeight: 24 },
  cta: { marginBottom: 44 },
  helperCard: {
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.35)',
    backgroundColor: 'rgba(251,191,36,0.08)',
  },
  helperHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  helperTitle: {
    color: '#FDE68A',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
  },
  helperText: {
    color: '#F8FAFC',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
  },
  helperSteps: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 19,
  },
  debugCard: {
    padding: 16,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.28)',
    backgroundColor: 'rgba(56,189,248,0.06)',
  },
  debugHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  debugTitle: {
    color: '#E0F2FE',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
  },
  debugMeta: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 10,
  },
  debugText: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 18,
  },
  analysisError: { color: '#F87171', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: -28, marginBottom: 28, fontWeight: '700' },
  insightsScroll: { paddingBottom: 20 },
  historyCard: { padding: 20 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  historyJob: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  badgeImproved: { backgroundColor: 'rgba(34, 197, 94, 0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeNeutral: { backgroundColor: 'rgba(245, 158, 11, 0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#22C55E', fontWeight: '800', fontSize: 13 },
  historyDiff: { color: '#94A3B8', fontSize: 13 }
});
