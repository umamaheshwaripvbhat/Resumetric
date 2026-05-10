import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../config/api';

export default function AIAssistantScreen({ navigation }: any) {
  const { analysisResult, jobDesc } = useApp();
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<any>(null);
  const inputRef = useRef<TextInput | null>(null);

  const analysisSummary = useMemo(() => {
    if (!analysisResult) return '';
    const details = analysisResult.details;
    return JSON.stringify({
      score: analysisResult.overall_score,
      missing_keywords: details.missing_keywords,
      matched_keywords: details.matched_keywords,
      weaknesses: details.weaknesses,
      strengths: details.strengths,
      recruiter_expectations: details.recruiter_expectations,
      resume_verdict: details.resume_verdict,
    });
  }, [analysisResult]);

  const queryAssistant = async (promptOverride?: string) => {
    const prompt = (promptOverride ?? question).trim();
    if (prompt.length < 3) return;

    setLoading(true);
    setAnswer(null);
    if (promptOverride) setQuestion(promptOverride);

    try {
      const res = await apiFetch('/site-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: prompt,
          page: 'Resumetric AI page',
          resume_context: analysisResult?.details.resume_text ?? '',
          job_description: jobDesc,
          analysis_summary: analysisSummary,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAnswer(data);
    } catch (e: any) {
      setAnswer({
        answer: e.message || 'I could not answer that right now.',
        answer_correctness_percentage: 78,
        reasoning: 'The assistant request failed, so the local fallback message was shown.',
        suggested_next_action: 'Try again after the backend is running.',
      });
    } finally {
      setLoading(false);
    }
  };

  const openOther = () => {
    setQuestion('');
    setAnswer(null);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={22} color="#F8FAFC" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Resumetric AI</Text>
            <Text style={styles.subtitle}>Ask about your score, resume edits, ATS strength, career direction, or interview prep.</Text>
          </View>
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction} activeOpacity={0.85} onPress={() => queryAssistant('✨ Enhance My Resume')}>
            <Text style={styles.quickActionTitle}>✨ Enhance My Resume</Text>
            <Text style={styles.quickActionText}>Get stronger bullets, ATS improvements, and impact-focused rewrite ideas.</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickAction} activeOpacity={0.85} onPress={() => queryAssistant('💼 Most Asked Interview Questions')}>
            <Text style={styles.quickActionTitle}>💼 Most Asked Interview Questions</Text>
            <Text style={styles.quickActionText}>Generate tailored interview questions based on your resume and target role.</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickAction} activeOpacity={0.85} onPress={openOther}>
            <Text style={styles.quickActionTitle}>💬 Other</Text>
            <Text style={styles.quickActionText}>Ask anything about your resume, career, or interview prep.</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="Ask me anything about your resume, career, or interview prep..."
          placeholderTextColor="#64748B"
          multiline
          value={question}
          onChangeText={setQuestion}
        />

        <TouchableOpacity style={[styles.askBtn, loading && { opacity: 0.6 }]} onPress={() => queryAssistant()} disabled={loading}>
          {loading ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.askBtnText}>Ask AI</Text>}
        </TouchableOpacity>

        {answer && (
          <View style={styles.answerBox}>
            <Text style={styles.scoreText}>Confidence: {answer.answer_correctness_percentage}%</Text>
            <Text style={styles.answerText}>{answer.answer}</Text>
            <Text style={styles.reasonText}>{answer.reasoning}</Text>
            <Text style={styles.nextText}>Next: {answer.suggested_next_action}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050811' },
  scroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40, flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24 },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginRight: 14,
  },
  title: { color: '#F8FAFC', fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#94A3B8', fontSize: 14, lineHeight: 21 },
  quickActions: { gap: 10, marginBottom: 18 },
  quickAction: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 16 },
  quickActionTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '800', marginBottom: 6 },
  quickActionText: { color: '#94A3B8', fontSize: 12, lineHeight: 18 },
  input: {
    minHeight: 120,
    color: '#F8FAFC',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: 14,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  askBtn: { marginTop: 14, backgroundColor: '#22C55E', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  askBtnText: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  answerBox: {
    marginTop: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  scoreText: { color: '#38BDF8', fontSize: 13, fontWeight: '800', marginBottom: 10 },
  answerText: { color: '#F8FAFC', fontSize: 15, lineHeight: 23, marginBottom: 12 },
  reasonText: { color: '#CBD5E1', fontSize: 13, lineHeight: 20, marginBottom: 10 },
  nextText: { color: '#A7F3D0', fontSize: 13, lineHeight: 20, fontWeight: '700' },
});
