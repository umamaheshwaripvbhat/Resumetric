import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from '../components/GlassCard';
import BackgroundGlow from '../components/BackgroundGlow';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiFetch } from '../config/api';
import { useApp } from '../context/AppContext';

// Category metadata
const CATEGORIES = [
    { key: 'technical',    label: 'Technical',      icon: 'code-slash',      color: '#38BDF8', bg: 'rgba(56,189,248,0.12)',  border: 'rgba(56,189,248,0.3)'  },
    { key: 'behavioral',   label: 'Behavioral',     icon: 'people',          color: '#A78BFA', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.3)' },
    { key: 'resume_based', label: 'Resume Deep Dive', icon: 'document-text', color: '#FBBF24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)'  },
    { key: 'gap_based',    label: 'Gap Analysis',   icon: 'warning',         color: '#F87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)' },
    { key: 'company_style', label: 'Company Style', icon: 'business',        color: '#34D399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.3)'  },
    { key: 'coding',       label: 'Coding Challenge', icon: 'terminal',      color: '#FB923C', bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.3)'  },
    { key: 'mcq',          label: 'MCQ',            icon: 'help-circle',     color: '#E879F9', bg: 'rgba(232,121,249,0.12)', border: 'rgba(232,121,249,0.3)' },
] as const;

type InterviewQuestion = string | { question: string };

// Realistic mock data — 6 per open category, 4 coding, 10 MCQ
const MOCK: Record<string, InterviewQuestion[]> = {
    technical: [
        "Walk me through how you'd architect a scalable REST API for 1M+ concurrent users — what tradeoffs at the infrastructure level?",
        "Your React app has a severe re-rendering issue in a large list component. How would you diagnose and fix it?",
        "Explain the difference between optimistic and pessimistic UI updates and when you'd choose each.",
        "How does React's reconciliation algorithm work and what are its performance implications for deeply nested trees?",
        "Explain the CAP theorem and give a real example of a system choosing between consistency and availability.",
        "How would you implement a rate limiter for a public API endpoint that handles 50k requests per minute?",
    ],
    behavioral: [
        "Tell me about a time you had to push back on a product decision. What was the outcome?",
        "Describe a situation where you had to deliver a critical feature under an unrealistic deadline.",
        "Tell me about a production incident you personally caused. What did you do and what changed afterwards?",
        "Give me an example of a time you had to learn a completely new technology in a short time.",
        "Describe a conflict with a teammate on a technical decision. How did you resolve it?",
        "Tell me about a time you improved a process or tool that had a measurable impact on the team.",
    ],
    resume_based: [
        "You mention improving performance — walk me through exactly what you changed and how you measured the result.",
        "You built a real-time feature — what strategy did you use and what made you choose it over alternatives?",
        "Explain the most complex state management decision you made and what you'd do differently today.",
        "Walk me through the architecture of the most complex project on your resume.",
        "What was the hardest bug you fixed in one of your listed projects and how did you find it?",
        "You list a specific tech on your resume — explain a key architectural tradeoff that technology forced you to make.",
    ],
    gap_based: [
        "Your resume shows limited backend experience — how would you design a DB schema for a multi-tenant SaaS app?",
        "You haven't listed Docker/Kubernetes — how would you containerise and deploy what you've built?",
        "Walk me through how you'd implement auth at the API gateway level using JWT with refresh token rotation.",
        "Which skill in the job description do you feel weakest on? How are you actively closing that gap?",
        "If you were given a project requiring a technology you've never used, walk me through your 2-week ramp-up plan.",
        "Describe a mistake you made due to a knowledge gap and how you prevented it from happening again.",
    ],
    company_style: [
        "Google-style: Explain the hardest technical tradeoff in one of your projects and how you measured the result.",
        "Amazon-style: Tell me about a time you owned a project end-to-end and what you did when the first approach failed.",
        "Microsoft-style: Design a maintainable solution for a feature from your resume and explain how you'd test it.",
        "Meta-style: How would you A/B test a new feature to ensure it doesn't negatively impact key metrics?",
        "Stripe-style: Walk me through how you would ensure the correctness and reliability of a payment flow.",
        "Atlassian-style: Describe how you would mentor a junior developer who is struggling with async code.",
    ],
    coding: [
        "Write a function that returns all unique pairs in an array that sum to a given target value.",
        "Implement a basic debounce function in JavaScript.",
        "Write a function to find the longest substring without repeating characters.",
        "Implement a simple LRU cache using a dictionary and a doubly linked list.",
    ],
    mcq: [
        "What is the time complexity of binary search? [A] O(n)  [B] O(log n)  [C] O(n²)  [D] O(1)",
        "Which HTTP status code means 'Not Found'? [A] 200  [B] 401  [C] 404  [D] 500",
        "What does REST stand for? [A] Remote Execution State Transfer  [B] Representational State Transfer  [C] Resource Entity State Transfer  [D] Realistic Server Transfer",
        "Which sorting algorithm has O(n log n) in all cases? [A] QuickSort  [B] Bubble Sort  [C] Merge Sort  [D] Insertion Sort",
        "In SQL, which clause filters rows AFTER grouping? [A] WHERE  [B] HAVING  [C] GROUP BY  [D] ORDER BY",
    ],
};


interface QuestionCardProps {
    question: string;
    index: number;
    color: string;
    bg: string;
    border: string;
    practiced: boolean;
    onToggle: () => void;
    onPractice: () => void;   // ← launches MockInterview with this question
    onVoicePractice: () => void;   // ← launches VoiceInterview
    delay: number;
}

function QuestionCard({ question, index, color, bg, border, practiced, onToggle, onPractice, onVoicePractice, delay }: QuestionCardProps) {
    return (
        <Animated.View entering={FadeInDown.duration(500).delay(delay).springify()}>
            <TouchableOpacity
                style={[styles.qCard, { backgroundColor: bg, borderColor: practiced ? 'rgba(74,222,128,0.4)' : border }]}
                onPress={onToggle}
                activeOpacity={0.85}
            >
                <View style={styles.qHeader}>
                    <View style={[styles.qNum, { backgroundColor: practiced ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.06)' }]}>
                        <Text style={[styles.qNumText, { color: practiced ? '#4ADE80' : color }]}>
                            {practiced ? '✓' : `${index + 1}`}
                        </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.qText, practiced && styles.qTextPracticed]}>{question}</Text>
                    </View>
                </View>

                {/* Bottom action row */}
                <View style={styles.qActions}>
                    {practiced && (
                        <Text style={styles.practicedBadge}>✓ Practiced</Text>
                    )}
                    <TouchableOpacity style={[styles.practiceBtn, { borderColor: color }]} onPress={e => { e.stopPropagation?.(); onPractice(); }}>
                        <Ionicons name="document-text-outline" size={12} color={color} style={{ marginRight: 4 }} />
                        <Text style={[styles.practiceBtnText, { color }]}>Text</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.practiceBtn, { borderColor: '#A855F7', marginLeft: 8 }]} 
                        onPress={e => { e.stopPropagation?.(); onVoicePractice(); }}
                    >
                        <Ionicons name="mic-outline" size={12} color="#A855F7" style={{ marginRight: 4 }} />
                        <Text style={[styles.practiceBtnText, { color: '#A855F7' }]}>Voice</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
}

export default function InterviewPrepScreen({ navigation, route }: any) {
    const insets = useSafeAreaInsets();
    const { analysisResult, jobDesc: contextJobDesc } = useApp();

    // Accept pre-filled data from AnalysisDashboard (weaknesses, role)
    // Fall back to AppContext when navigated from bottom tab directly
    const resumeText  = route?.params?.resume_text     || analysisResult?.details?.resume_text     || '';
    const jobDesc     = route?.params?.job_description || contextJobDesc                            || '';
    const weaknesses  = route?.params?.weaknesses      || analysisResult?.details?.weaknesses       || [];
    const role        = route?.params?.role            || 'Software Engineer';

    const [questions,  setQuestions]  = useState<Record<string, InterviewQuestion[]>>(MOCK);
    const [practiced,  setPracticed]  = useState<Set<string>>(new Set());
    const [loading,    setLoading]    = useState(false);
    const [activeTab,  setActiveTab]  = useState<string>('technical');
    const [error, setError] = useState<string | null>(null);

    const totalPracticed = practiced.size;
    const totalQuestions = Object.values(questions).flat().length;

    const togglePracticed = (key: string) => {
        setPracticed(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const generateMore = async () => {
        setLoading(true);
        setError(null);
        try {
            if (!resumeText.trim() || !jobDesc.trim()) {
                setQuestions(MOCK);
                setError('Upload a resume and job description first to generate personalized questions.');
                return;
            }

            const res = await apiFetch('/interview-prep', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resume_text: resumeText, job_description: jobDesc, weaknesses, role }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setQuestions(data);
            setPracticed(new Set());
        } catch (e: any) {
            setError(e.message || 'Could not generate interview questions.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        generateMore();
    }, []);

    const activeCat = CATEGORIES.find(c => c.key === activeTab)!;
    const activeQuestions = questions[activeTab] ?? [];

    return (
        <View style={styles.container}>
            <BackgroundGlow />
            <ScrollView
                contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <Animated.View entering={FadeInDown.duration(600).springify()}>
                    <View style={styles.topRow}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                            <Ionicons name="arrow-back" size={20} color="#CBD5E1" />
                            <Text style={styles.navLink}>Back</Text>
                        </TouchableOpacity>
                        <View />
                    </View>

                    <Text style={styles.title}>🎤 Interview Prep</Text>
                    <Text style={styles.subtitle}>{role} — Personalized questions</Text>
                    {error && <Text style={styles.errorText}>{error}</Text>}

                    {/* Progress bar */}
                    <View style={styles.progressRow}>
                        <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, { width: `${(totalPracticed / Math.max(totalQuestions, 1)) * 100}%` as any }]} />
                        </View>
                        <Text style={styles.progressLabel}>{totalPracticed}/{totalQuestions} practiced</Text>
                    </View>
                </Animated.View>

                {/* Category tabs */}
                <Animated.View entering={FadeInDown.duration(600).delay(100).springify()}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
                        {CATEGORIES.map(cat => (
                            <TouchableOpacity
                                key={cat.key}
                                style={[styles.tab, activeTab === cat.key && { backgroundColor: cat.bg, borderColor: cat.border }]}
                                onPress={() => setActiveTab(cat.key)}
                            >
                                <Ionicons name={cat.icon as any} size={14} color={activeTab === cat.key ? cat.color : '#64748B'} style={{ marginRight: 5 }} />
                                <Text style={[styles.tabText, activeTab === cat.key && { color: cat.color, fontWeight: '800' }]}>
                                    {cat.label}
                                </Text>
                                <View style={[styles.tabCount, { backgroundColor: activeTab === cat.key ? cat.border : 'rgba(255,255,255,0.06)' }]}>
                                    <Text style={[styles.tabCountText, activeTab === cat.key && { color: cat.color }]}>
                                        {questions[cat.key]?.length ?? 0}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </Animated.View>

                {/* Questions for active tab */}
                <View style={{ marginTop: 8 }}>
                    {activeQuestions.map((q, i) => {
                        const key = `${activeTab}-${i}`;
                        const qText = typeof q === 'string' ? q : q.question;
                        return (
                            <QuestionCard
                                key={key}
                                question={qText}
                                index={i}
                                color={activeCat.color}
                                bg={activeCat.bg}
                                border={activeCat.border}
                                practiced={practiced.has(key)}
                                onToggle={() => togglePracticed(key)}
                                onPractice={() => navigation.navigate('MockInterview', {
                                    resume_text: resumeText, job_description: jobDesc,
                                    role, question: qText,
                                })}
                                onVoicePractice={() => navigation.navigate('VoiceInterview', {
                                    role, question: qText,
                                })}
                                delay={i * 80}
                            />
                        );
                    })}
                </View>

                {/* Generate more CTA */}
                <Animated.View entering={FadeInDown.duration(600).delay(400).springify()} style={{ marginTop: 24 }}>
                    <GlassCard style={styles.generateCard}>
                        <Text style={styles.generateTitle}>Need more questions?</Text>
                        <Text style={styles.generateSub}>AI will generate a fresh set based on your resume and target role.</Text>
                        <TouchableOpacity
                            style={[styles.generateBtn, loading && { opacity: 0.6 }]}
                            onPress={generateMore}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#0F172A" />
                            ) : (
                                <>
                                    <Ionicons name="refresh" size={16} color="#0F172A" style={{ marginRight: 8 }} />
                                    <Text style={styles.generateBtnText}>Generate More</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </GlassCard>
                </Animated.View>

                {/* Mock Interview launch — pass full questions to MockInterview */}
                <Animated.View entering={FadeInDown.duration(600).delay(500).springify()} style={{ marginTop: 12 }}>
                    <TouchableOpacity
                        style={styles.mockBtn}
                        onPress={() => navigation.navigate('MockInterview', {
                            resume_text: resumeText,
                            job_description: jobDesc,
                            role,
                            all_questions: questions,
                        })}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="mic" size={18} color="#0F172A" style={{ marginRight: 8 }} />
                        <Text style={styles.mockBtnText}>🎙️ Start Mock Interview</Text>
                    </TouchableOpacity>
                </Animated.View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#050811' },
    scroll: { paddingHorizontal: 24 },

    topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
    backBtn: { flexDirection: 'row', alignItems: 'center' },
    navLink: { color: '#CBD5E1', fontSize: 16, fontWeight: '600', marginLeft: 8 },

    title: { fontSize: 32, fontWeight: '900', color: '#F8FAFC', letterSpacing: -1, marginBottom: 6 },
    subtitle: { fontSize: 15, color: '#64748B', fontWeight: '500', marginBottom: 24 },
    errorText: { color: '#F87171', fontSize: 13, lineHeight: 20, marginBottom: 16 },

    progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 28 },
    progressTrack: { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#4ADE80', borderRadius: 2 },
    progressLabel: { color: '#64748B', fontSize: 12, fontWeight: '700', minWidth: 80, textAlign: 'right' },

    // Category tabs
    tabScroll: { marginBottom: 20 },
    tab: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, marginRight: 8,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    tabText: { color: '#64748B', fontSize: 13, fontWeight: '600', marginRight: 6 },
    tabCount: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
    tabCountText: { color: '#64748B', fontSize: 11, fontWeight: '800' },

    // Question cards — tap to toggle practiced
    qCard: {
        borderRadius: 14, padding: 18, marginBottom: 12,
        borderWidth: 1,
    },
    qHeader: { flexDirection: 'row', gap: 14 },
    qNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
    qNumText: { fontSize: 13, fontWeight: '900' },
    qText: { color: '#E2E8F0', fontSize: 15, lineHeight: 23, fontWeight: '500' },
    qTextPracticed: { color: '#94A3B8', textDecorationLine: 'line-through' },
    practicedBadge: { color: '#4ADE80', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginTop: 10, marginLeft: 42 },

    // Per-question practice button
    qActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginLeft: 42 },
    practiceBtn: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1,
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    practiceBtnText: { fontSize: 11, fontWeight: '800' },

    // Generate more card
    generateCard: { padding: 24 },
    generateTitle: { color: '#F8FAFC', fontSize: 17, fontWeight: '800', marginBottom: 6 },
    generateSub: { color: '#64748B', fontSize: 14, lineHeight: 20, marginBottom: 20 },
    generateBtn: {
        backgroundColor: '#22C55E', paddingVertical: 14, borderRadius: 12,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    },
    generateBtnText: { color: '#0F172A', fontWeight: '900', fontSize: 15 },

    // Mock Interview launch button
    mockBtn: {
        backgroundColor: '#A78BFA', paddingVertical: 15, borderRadius: 14,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        marginBottom: 8,
    },
    mockBtnText: { color: '#0F172A', fontWeight: '900', fontSize: 15 },
});
