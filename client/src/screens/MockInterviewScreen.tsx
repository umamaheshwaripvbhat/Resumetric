import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, TextInput, ScrollView,
    TouchableOpacity, ActivityIndicator, KeyboardAvoidingView,
    Platform, Animated as RNAnimated, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from '../components/GlassCard';
import BackgroundGlow from '../components/BackgroundGlow';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiFetch } from '../config/api';
import { useApp } from '../context/AppContext';

const { width, height } = Dimensions.get('window');
const MIN_PASS_SCORE = 40;

// ─────────────────────────────────────────────────────────
// Category config
// ─────────────────────────────────────────────────────────
const CATEGORIES = [
    { key: 'technical',    label: 'Technical',      icon: 'code-slash',      color: '#38BDF8' },
    { key: 'behavioral',   label: 'Behavioral',     icon: 'people',          color: '#A78BFA' },
    { key: 'resume_based', label: 'Resume Deep Dive', icon: 'document-text', color: '#FBBF24' },
    { key: 'gap_based',    label: 'Gap Analysis',   icon: 'warning',         color: '#F87171' },
    { key: 'company_style',label: 'Company Style',  icon: 'business',        color: '#34D399' },
    { key: 'coding',       label: 'Coding Challenge', icon: 'terminal',      color: '#FB923C' },
    { key: 'mcq',          label: 'MCQ',            icon: 'help-circle',     color: '#E879F9' },
];

const scoreColor = (s: number) => s >= 75 ? '#4ADE80' : s >= MIN_PASS_SCORE ? '#FBBF24' : '#F87171';
const scoreBg    = (s: number) => s >= 75 ? 'rgba(74,222,128,0.12)' : s >= MIN_PASS_SCORE ? 'rgba(251,191,36,0.12)' : 'rgba(248,113,113,0.12)';

// ─────────────────────────────────────────────────────────
// Fallback question pools per category
// ─────────────────────────────────────────────────────────
const FALLBACK: Record<string, any[]> = {
    technical: [
        "Walk me through how you'd architect a scalable REST API for 1M+ concurrent users.",
        "Explain the difference between optimistic and pessimistic UI updates.",
    ],
    behavioral: [
        "Describe a time you had to deliver under an unrealistic deadline. How did you handle trade-offs?",
        "Tell me about a production issue you caused and what you changed afterwards.",
    ],
    resume_based: [
        "Walk me through the most impactful project on your resume. What was your specific contribution?",
        "Explain the most complex technical decision you made and what you'd do differently today.",
    ],
    gap_based: [
        "Which skill from the job description do you feel you're weakest on? How are you addressing it?",
        "Walk me through how you'd upskill on a technology you haven't used before.",
    ],
    company_style: [
        "Google-style: Design a URL shortener. What are the key tradeoffs at scale?",
        "Amazon-style: Describe a time you owned a project end-to-end and what happened when the first approach failed.",
    ],
    coding: [
        { question: "Write a function to find the two numbers in an array that sum to a target value.", language: "Python", hint: "Think about using a hash map for O(n) time complexity.", sample_solution: "def two_sum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        diff = target - n\n        if diff in seen:\n            return [seen[diff], i]\n        seen[n] = i" },
        { question: "Reverse a linked list iteratively.", language: "Python", hint: "Use three pointers: prev, current, next.", sample_solution: "def reverse_list(head):\n    prev = None\n    curr = head\n    while curr:\n        nxt = curr.next\n        curr.next = prev\n        prev = curr\n        curr = nxt\n    return prev" },
    ],
    mcq: [
        { question: "What is the time complexity of a binary search?", options: ["O(n)", "O(log n)", "O(n²)", "O(1)"], correct_index: 1, explanation: "Binary search halves the search space each step, giving O(log n)." },
        { question: "Which HTTP status code means 'Not Found'?", options: ["200", "401", "404", "500"], correct_index: 2, explanation: "404 is the standard response code for resources not found on a server." },
        { question: "What does REST stand for?", options: ["Realistic State Transfer", "Representational State Transfer", "Remote Execution Standard Transfer", "Resource Entity State Transfer"], correct_index: 1, explanation: "REST = Representational State Transfer, an architectural style for APIs." },
        { question: "Which sorting algorithm is O(n log n) in the average case?", options: ["Bubble Sort", "Insertion Sort", "Merge Sort", "Selection Sort"], correct_index: 2, explanation: "Merge Sort consistently achieves O(n log n) in all cases." },
        { question: "In SQL, which clause filters rows after grouping?", options: ["WHERE", "HAVING", "GROUP BY", "ORDER BY"], correct_index: 1, explanation: "HAVING filters groups created by GROUP BY; WHERE filters individual rows before grouping." },
    ],
};

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────
interface EvalResult { score: number; strengths: string[]; weaknesses: string[]; missing_points: string[]; improved_answer: string; feedback: string; }
interface CodingQ { question: string; language: string; hint: string; sample_solution: string; }
interface MCQ { question: string; options: string[]; correct_index: number; explanation: string; }
interface QuizEntry { category: string; question: string; answer: string; score: number; eval?: EvalResult; mcqCorrect?: boolean; }

// ─────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────
function ProgressDots({ total, current, catColors }: { total: number; current: number; catColors: string[] }) {
    return (
        <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
            {Array.from({ length: total }).map((_, i) => (
                <View key={i} style={{
                    width: 10, height: 10, borderRadius: 5,
                    backgroundColor: i < current ? catColors[i] ?? '#4ADE80' : i === current ? '#F8FAFC' : 'rgba(255,255,255,0.12)',
                    borderWidth: i === current ? 2 : 0,
                    borderColor: '#F8FAFC',
                }} />
            ))}
        </View>
    );
}

function EvalCard({ ev }: { ev: EvalResult }) {
    const sc = ev.score;
    return (
        <Animated.View entering={FadeInDown.duration(500).springify()}>
            <View style={styles.scoreRow}>
                <View style={[styles.scoreRing, { borderColor: scoreColor(sc), backgroundColor: scoreBg(sc) }]}>
                    <Text style={[styles.scoreNum, { color: scoreColor(sc) }]}>{sc}</Text>
                    <Text style={styles.scoreLabel}>/ 100</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 16 }}>
                    <Text style={[styles.scoreVerdict, { color: scoreColor(sc) }]}>
                        {sc >= 75 ? '🟢 Strong' : sc >= MIN_PASS_SCORE ? '🟡 Acceptable' : '🔴 Weak — Try Again'}
                    </Text>
                    <Text style={styles.feedbackText}>{ev.feedback}</Text>
                </View>
            </View>
            {ev.strengths.length > 0 && (
                <GlassCard style={[styles.section, { borderColor: 'rgba(74,222,128,0.25)' }]}>
                    <Text style={[styles.sectionTitle, { color: '#4ADE80' }]}>✅ Strengths</Text>
                    {ev.strengths.map((s, i) => <Text key={i} style={styles.bulletGreen}>• {s}</Text>)}
                </GlassCard>
            )}
            <GlassCard style={[styles.section, { borderColor: 'rgba(248,113,113,0.25)' }]}>
                <Text style={[styles.sectionTitle, { color: '#F87171' }]}>❌ Weaknesses</Text>
                {ev.weaknesses.map((w, i) => <Text key={i} style={styles.bulletRed}>• {w}</Text>)}
            </GlassCard>
            {ev.missing_points.length > 0 && (
                <GlassCard style={[styles.section, { borderColor: 'rgba(251,191,36,0.25)' }]}>
                    <Text style={[styles.sectionTitle, { color: '#FBBF24' }]}>⚠️ Missing Points</Text>
                    {ev.missing_points.map((p, i) => <Text key={i} style={styles.bulletYellow}>• {p}</Text>)}
                </GlassCard>
            )}
            {ev.improved_answer ? (
                <GlassCard style={[styles.section, { borderColor: 'rgba(56,189,248,0.25)' }]}>
                    <Text style={[styles.sectionTitle, { color: '#38BDF8' }]}>✨ Model Answer</Text>
                    <Text style={styles.improvedText}>{ev.improved_answer}</Text>
                </GlassCard>
            ) : null}
        </Animated.View>
    );
}

// ─────────────────────────────────────────────────────────
// Final Quiz Summary Screen
// ─────────────────────────────────────────────────────────
function QuizSummary({ history, onRestart, insets }: { history: QuizEntry[]; onRestart: () => void; insets: any }) {
    const totalScore = history.reduce((sum, h) => sum + h.score, 0);
    const maxPossible = history.length * 100;
    const avgScore = Math.round(totalScore / Math.max(history.length, 1));
    const mcqEntries = history.filter(h => h.category === 'mcq');
    const mcqCorrect = mcqEntries.filter(h => h.mcqCorrect).length;
    const openEntries = history.filter(h => h.category !== 'mcq');
    const allMissing = openEntries.flatMap(h => h.eval?.missing_points ?? []).filter(Boolean);
    const passed = history.filter(h => h.score >= MIN_PASS_SCORE).length;

    const getScoreColor = (s: number) => s >= 75 ? '#34D399' : s >= 50 ? '#FBBF24' : '#F87171';

    return (
        <ScrollView contentContainerStyle={[styles.summaryScroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}>
            {/* Hero */}
            <View style={styles.summaryHero}>
                <Text style={styles.summaryEmoji}>{avgScore >= 75 ? '🏆' : avgScore >= 50 ? '📈' : '🔄'}</Text>
                <Text style={styles.summaryTitle}>Quiz Complete!</Text>
                <Text style={styles.summarySubtitle}>{history.length} questions answered</Text>
            </View>

            {/* Big score */}
            <View style={styles.summaryMetrics}>
                <View style={styles.summaryMetricCard}>
                    <View style={[styles.bigScoreCircle, { borderColor: getScoreColor(avgScore) }]}>
                        <Text style={[styles.bigScoreNum, { color: getScoreColor(avgScore) }]}>{avgScore}</Text>
                        <Text style={styles.bigScoreLabel}>avg / 100</Text>
                    </View>
                    <Text style={styles.metricLabel}>Overall Score</Text>
                </View>
                <View style={styles.summaryMetricCard}>
                    <View style={[styles.bigScoreCircle, { borderColor: getScoreColor((passed / history.length) * 100) }]}>
                        <Text style={[styles.bigScoreNum, { color: getScoreColor((passed / history.length) * 100) }]}>{passed}/{history.length}</Text>
                    </View>
                    <Text style={styles.metricLabel}>Passed (≥{MIN_PASS_SCORE})</Text>
                </View>
                {mcqEntries.length > 0 && (
                    <View style={styles.summaryMetricCard}>
                        <View style={[styles.bigScoreCircle, { borderColor: getScoreColor((mcqCorrect / mcqEntries.length) * 100) }]}>
                            <Text style={[styles.bigScoreNum, { color: getScoreColor((mcqCorrect / mcqEntries.length) * 100) }]}>{mcqCorrect}/{mcqEntries.length}</Text>
                        </View>
                        <Text style={styles.metricLabel}>MCQ Correct</Text>
                    </View>
                )}
            </View>

            {/* Per question breakdown */}
            <Text style={styles.summarySection}>Question-by-Question Breakdown</Text>
            {history.map((h, i) => {
                const cat = CATEGORIES.find(c => c.key === h.category);
                return (
                    <View key={i} style={[styles.breakdownRow, { borderColor: `${cat?.color ?? '#5B8CFF'}33` }]}>
                        <View style={[styles.breakdownNum, { backgroundColor: `${cat?.color ?? '#5B8CFF'}22` }]}>
                            <Text style={[styles.breakdownNumText, { color: cat?.color ?? '#5B8CFF' }]}>{i + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.breakdownCat}>{cat?.label ?? h.category}</Text>
                            <Text style={styles.breakdownQ} numberOfLines={2}>{h.question}</Text>
                            {(h.eval?.missing_points ?? []).length > 0 && (
                                <Text style={styles.breakdownMissing}>⚠️ Missed: {(h.eval?.missing_points ?? []).slice(0, 2).join(', ')}</Text>
                            )}
                            {h.category === 'mcq' && (
                                <Text style={[styles.breakdownMissing, { color: h.mcqCorrect ? '#34D399' : '#F87171' }]}>
                                    {h.mcqCorrect ? '✅ Correct' : '❌ Wrong'}
                                </Text>
                            )}
                        </View>
                        <Text style={[styles.breakdownScore, { color: scoreColor(h.score) }]}>{h.score}</Text>
                    </View>
                );
            })}

            {/* Key missing points */}
            {allMissing.length > 0 && (
                <View style={{ marginTop: 24 }}>
                    <Text style={styles.summarySection}>Key Topics to Study</Text>
                    {[...new Set(allMissing)].slice(0, 8).map((m, i) => (
                        <View key={i} style={styles.missingItem}>
                            <Ionicons name="bookmark-outline" size={14} color="#FBBF24" style={{ marginRight: 8, marginTop: 2 }} />
                            <Text style={styles.missingText}>{m}</Text>
                        </View>
                    ))}
                </View>
            )}

            {/* Restart */}
            <TouchableOpacity style={styles.restartBtn} onPress={onRestart} activeOpacity={0.8}>
                <Ionicons name="refresh" size={16} color="#0F172A" style={{ marginRight: 8 }} />
                <Text style={styles.restartBtnText}>Retake Interview</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

// ─────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────
export default function MockInterviewScreen({ navigation, route }: any) {
    const insets = useSafeAreaInsets();
    const { jobDesc: contextJobDesc, analysisResult } = useApp();

    const resumeText = route?.params?.resume_text     ?? analysisResult?.details?.resume_text ?? '';
    const jobDesc    = route?.params?.job_description ?? contextJobDesc ?? '';
    const role       = route?.params?.role            ?? 'Software Engineer';

    // Build question list: 2 per category (open + coding + mcq)
    const [allQuestions, setAllQuestions] = useState<any[]>([]);
    const [loading, setLoading]     = useState(true);
    const [qIdx, setQIdx]           = useState(0);
    const [answer, setAnswer]       = useState('');
    const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
    const [evaluating, setEvaluating] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [quizHistory, setQuizHistory] = useState<QuizEntry[]>([]);
    const [showSummary, setShowSummary] = useState(false);
    const [mcqSelected, setMcqSelected] = useState<number | null>(null);
    const [showHint, setShowHint]   = useState(false);
    const [showSolution, setShowSolution] = useState(false);

    // Build structured flat question list from AI response
    const buildQuestions = (data: any) => {
        const list: any[] = [];
        for (const cat of ['technical', 'behavioral', 'resume_based', 'gap_based', 'company_style']) {
            const qs: string[] = data[cat] ?? FALLBACK[cat] ?? [];
            qs.slice(0, 2).forEach(q => list.push({ type: 'open', category: cat, question: q }));
        }
        const codingQs: CodingQ[] = data.coding ?? FALLBACK.coding ?? [];
        codingQs.slice(0, 2).forEach(q => list.push({ type: 'coding', category: 'coding', ...q }));
        const mcqQs: MCQ[] = data.mcq ?? FALLBACK.mcq ?? [];
        mcqQs.slice(0, 5).forEach(q => list.push({ type: 'mcq', category: 'mcq', ...q }));
        return list;
    };

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                if (route?.params?.all_questions) {
                    setAllQuestions(buildQuestions(route.params.all_questions));
                } else if (resumeText.trim() && jobDesc.trim()) {
                    const res = await apiFetch('/interview-prep', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            resume_text: resumeText,
                            job_description: jobDesc,
                            weaknesses: analysisResult?.details?.weaknesses ?? [],
                            role,
                        }),
                    });
                    const data = await res.json();
                    if (data.error) throw new Error(data.error);
                    setAllQuestions(buildQuestions(data));
                } else {
                    setAllQuestions(buildQuestions(FALLBACK));
                }
            } catch {
                setAllQuestions(buildQuestions(FALLBACK));
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const currentQ = allQuestions[qIdx];
    const catConfig = CATEGORIES.find(c => c.key === currentQ?.category);
    const catColors = allQuestions.map(q => CATEGORIES.find(c => c.key === q.category)?.color ?? '#5B8CFF');
    const isLastQ = qIdx === allQuestions.length - 1;

    const handleSubmitOpen = async () => {
        if (answer.trim().length < 30) return;
        setEvaluating(true);
        setEvalResult(null);
        try {
            const res = await apiFetch('/mock-interview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resume_text: resumeText, job_description: jobDesc, role, question: currentQ.question, answer }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setEvalResult(data);
            setSubmitted(true);
        } catch {
            setEvalResult({ score: 0, strengths: [], weaknesses: ['Could not evaluate — check backend.'], missing_points: [], improved_answer: '', feedback: 'Evaluation failed.' });
            setSubmitted(true);
        } finally {
            setEvaluating(false);
        }
    };

    const handleSubmitCoding = () => {
        if (answer.trim().length < 10) return;
        const score = answer.trim().length > 80 ? 70 : 45;
        setEvalResult({ score, strengths: ['Attempt submitted'], weaknesses: [], missing_points: [], improved_answer: currentQ.sample_solution, feedback: 'Compare your answer with the model solution above.' });
        setSubmitted(true);
    };

    const handleMCQSelect = (idx: number) => {
        if (submitted) return;
        setMcqSelected(idx);
    };

    const handleSubmitMCQ = () => {
        if (mcqSelected === null) return;
        const correct = mcqSelected === currentQ.correct_index;
        const score = correct ? 100 : 0;
        setEvalResult({ score, strengths: correct ? ['Correct answer!'] : [], weaknesses: correct ? [] : [`Wrong — correct answer: ${currentQ.options[currentQ.correct_index]}`], missing_points: [], improved_answer: '', feedback: currentQ.explanation });
        setSubmitted(true);
    };

    const handleNext = () => {
        if (!submitted) return;
        const score = evalResult?.score ?? 0;
        const entry: QuizEntry = {
            category: currentQ.category,
            question: currentQ.question,
            answer,
            score,
            eval: currentQ.type !== 'mcq' ? evalResult ?? undefined : undefined,
            mcqCorrect: currentQ.type === 'mcq' ? mcqSelected === currentQ.correct_index : undefined,
        };
        const newHistory = [...quizHistory, entry];
        setQuizHistory(newHistory);

        if (isLastQ) {
            setShowSummary(true);
        } else {
            setQIdx(i => i + 1);
            setAnswer('');
            setEvalResult(null);
            setSubmitted(false);
            setMcqSelected(null);
            setShowHint(false);
            setShowSolution(false);
        }
    };

    const handleRestart = () => {
        setQIdx(0);
        setAnswer('');
        setEvalResult(null);
        setSubmitted(false);
        setMcqSelected(null);
        setQuizHistory([]);
        setShowSummary(false);
        setShowHint(false);
        setShowSolution(false);
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <BackgroundGlow />
                <ActivityIndicator size="large" color="#A78BFA" />
                <Text style={{ color: '#94A3B8', marginTop: 16, fontSize: 15 }}>Generating personalized questions...</Text>
            </View>
        );
    }

    if (showSummary) {
        return (
            <View style={styles.container}>
                <BackgroundGlow />
                <QuizSummary history={quizHistory} onRestart={handleRestart} insets={insets} />
            </View>
        );
    }

    const canAdvance = submitted && (evalResult?.score ?? 0) >= MIN_PASS_SCORE;

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <BackgroundGlow />
            <ScrollView
                contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 48 }]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.topRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={20} color="#CBD5E1" />
                        <Text style={styles.navLink}>Back</Text>
                    </TouchableOpacity>
                    <View style={[styles.roleBadge, { borderColor: catConfig?.color ? `${catConfig.color}55` : '#5B8CFF55' }]}>
                        <Text style={[styles.roleText, { color: catConfig?.color ?? '#A78BFA' }]}>{catConfig?.label ?? role}</Text>
                    </View>
                </View>

                <Text style={styles.title}>🎙️ Mock Interview</Text>
                <Text style={styles.subtitle}>Score ≥{MIN_PASS_SCORE} to advance • {qIdx + 1}/{allQuestions.length}</Text>

                {/* Progress dots */}
                <ProgressDots total={allQuestions.length} current={qIdx} catColors={catColors} />

                {/* Question card */}
                <Animated.View entering={FadeInDown.duration(400).springify()}>
                    <GlassCard style={[styles.qCard, { borderColor: `${catConfig?.color ?? '#5B8CFF'}44` }]}>
                        <View style={styles.qMeta}>
                            <Ionicons name={(catConfig?.icon ?? 'help-circle') as any} size={14} color={catConfig?.color ?? '#A78BFA'} style={{ marginRight: 6 }} />
                            <Text style={[styles.qMetaText, { color: catConfig?.color ?? '#A78BFA' }]}>{catConfig?.label ?? ''} — Q{qIdx + 1} of {allQuestions.length}</Text>
                        </View>
                        <Text style={styles.qText}>{currentQ?.question}</Text>

                        {/* Coding — show hint/solution toggles */}
                        {currentQ?.type === 'coding' && (
                            <View style={{ marginTop: 12, gap: 8 }}>
                                <View style={styles.langBadge}>
                                    <Ionicons name="terminal-outline" size={12} color="#FB923C" style={{ marginRight: 4 }} />
                                    <Text style={styles.langText}>{currentQ.language}</Text>
                                </View>
                                <TouchableOpacity onPress={() => setShowHint(h => !h)} style={styles.hintBtn}>
                                    <Ionicons name="bulb-outline" size={13} color="#FBBF24" style={{ marginRight: 6 }} />
                                    <Text style={styles.hintBtnText}>{showHint ? 'Hide Hint' : 'Show Hint'}</Text>
                                </TouchableOpacity>
                                {showHint && <Text style={styles.hintText}>💡 {currentQ.hint}</Text>}
                            </View>
                        )}
                    </GlassCard>
                </Animated.View>

                {/* MCQ Options */}
                {currentQ?.type === 'mcq' && (
                    <View style={{ marginBottom: 12 }}>
                        {currentQ.options.map((opt: string, i: number) => {
                            const isSelected = mcqSelected === i;
                            const isCorrect = submitted && i === currentQ.correct_index;
                            const isWrong = submitted && isSelected && i !== currentQ.correct_index;
                            return (
                                <TouchableOpacity
                                    key={i}
                                    style={[
                                        styles.mcqOption,
                                        isSelected && !submitted && { borderColor: '#A78BFA', backgroundColor: 'rgba(167,139,250,0.12)' },
                                        isCorrect && { borderColor: '#4ADE80', backgroundColor: 'rgba(74,222,128,0.12)' },
                                        isWrong && { borderColor: '#F87171', backgroundColor: 'rgba(248,113,113,0.12)' },
                                    ]}
                                    onPress={() => handleMCQSelect(i)}
                                    disabled={submitted}
                                    activeOpacity={0.8}
                                >
                                    <View style={[styles.mcqBullet, isCorrect && { backgroundColor: '#4ADE80' }, isWrong && { backgroundColor: '#F87171' }]}>
                                        <Text style={styles.mcqBulletText}>{String.fromCharCode(65 + i)}</Text>
                                    </View>
                                    <Text style={[styles.mcqText, isCorrect && { color: '#4ADE80' }, isWrong && { color: '#F87171' }]}>{opt}</Text>
                                    {isCorrect && <Ionicons name="checkmark-circle" size={18} color="#4ADE80" />}
                                    {isWrong && <Ionicons name="close-circle" size={18} color="#F87171" />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {/* Open / Coding Answer Input */}
                {(currentQ?.type === 'open' || currentQ?.type === 'coding') && !submitted && (
                    <Animated.View entering={FadeInDown.duration(400).delay(100).springify()}>
                        <Text style={styles.inputLabel}>YOUR ANSWER</Text>
                        <TextInput
                            style={[styles.textInput, currentQ.type === 'coding' && { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13 }]}
                            value={answer}
                            onChangeText={setAnswer}
                            multiline
                            placeholder={currentQ.type === 'coding' ? 'Write your code here...' : 'Type your answer...'}
                            placeholderTextColor="#334155"
                            textAlignVertical="top"
                        />
                        <Text style={[styles.charCount, { color: answer.length < 30 ? '#F87171' : '#64748B' }]}>
                            {answer.length} chars {answer.length < 30 ? `(${30 - answer.length} more needed)` : '✓'}
                        </Text>
                    </Animated.View>
                )}

                {/* Submit buttons */}
                {!submitted && (
                    <Animated.View entering={FadeInDown.duration(400).delay(150).springify()}>
                        {currentQ?.type === 'mcq' ? (
                            <TouchableOpacity
                                style={[styles.submitBtn, { opacity: mcqSelected === null ? 0.4 : 1 }]}
                                onPress={handleSubmitMCQ}
                                disabled={mcqSelected === null}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="checkmark" size={16} color="#0F172A" style={{ marginRight: 8 }} />
                                <Text style={styles.submitBtnText}>Confirm Answer</Text>
                            </TouchableOpacity>
                        ) : currentQ?.type === 'coding' ? (
                            <TouchableOpacity
                                style={[styles.submitBtn, { backgroundColor: '#FB923C', opacity: answer.trim().length < 10 ? 0.4 : 1 }]}
                                onPress={handleSubmitCoding}
                                disabled={answer.trim().length < 10}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="code-slash" size={16} color="#0F172A" style={{ marginRight: 8 }} />
                                <Text style={styles.submitBtnText}>Submit Code</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={[styles.submitBtn, { opacity: answer.trim().length < 30 ? 0.4 : 1 }]}
                                onPress={handleSubmitOpen}
                                disabled={answer.trim().length < 30 || evaluating}
                                activeOpacity={0.8}
                            >
                                {evaluating ? <ActivityIndicator size="small" color="#0F172A" /> : (
                                    <>
                                        <Ionicons name="send" size={16} color="#0F172A" style={{ marginRight: 8 }} />
                                        <Text style={styles.submitBtnText}>Submit Answer</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}
                    </Animated.View>
                )}

                {/* Evaluation result */}
                {evalResult && <EvalCard ev={evalResult} />}

                {/* Coding solution reveal */}
                {submitted && currentQ?.type === 'coding' && (
                    <TouchableOpacity onPress={() => setShowSolution(s => !s)} style={styles.hintBtn}>
                        <Ionicons name="eye-outline" size={13} color="#FB923C" style={{ marginRight: 6 }} />
                        <Text style={[styles.hintBtnText, { color: '#FB923C' }]}>{showSolution ? 'Hide Solution' : 'View Model Solution'}</Text>
                    </TouchableOpacity>
                )}
                {showSolution && currentQ?.type === 'coding' && (
                    <GlassCard style={[styles.section, { borderColor: 'rgba(251,146,60,0.3)' }]}>
                        <Text style={[styles.sectionTitle, { color: '#FB923C' }]}>📋 Model Solution ({currentQ.language})</Text>
                        <Text style={[styles.improvedText, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13 }]}>{currentQ.sample_solution}</Text>
                    </GlassCard>
                )}

                {/* Next / Gate */}
                {submitted && (
                    <Animated.View entering={FadeIn.duration(400).delay(200)} style={{ marginTop: 8 }}>
                        {canAdvance || currentQ?.type === 'mcq' || currentQ?.type === 'coding' ? (
                            <TouchableOpacity style={[styles.nextBtn, isLastQ && { backgroundColor: '#34D399' }]} onPress={handleNext} activeOpacity={0.8}>
                                <Ionicons name={isLastQ ? 'trophy-outline' : 'arrow-forward'} size={16} color="#0F172A" style={{ marginRight: 8 }} />
                                <Text style={styles.nextBtnText}>{isLastQ ? 'View Summary 🏆' : 'Next Question →'}</Text>
                            </TouchableOpacity>
                        ) : (
                            <>
                                <View style={styles.retryBlock}>
                                    <Ionicons name="close-circle" size={20} color="#F87171" style={{ marginRight: 10 }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.retryTitle}>Score too low — {evalResult?.score ?? 0}/100</Text>
                                        <Text style={styles.retrySubtext}>You need ≥{MIN_PASS_SCORE} to advance. Study the model answer and try again.</Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={styles.retryBtn}
                                    onPress={() => { setEvalResult(null); setSubmitted(false); setAnswer(''); }}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="refresh" size={15} color="#F8FAFC" style={{ marginRight: 8 }} />
                                    <Text style={styles.retryBtnText}>Try Again</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </Animated.View>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

// ─────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#050811' },
    scroll: { paddingHorizontal: 22 },

    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    backBtn: { flexDirection: 'row', alignItems: 'center' },
    navLink: { color: '#CBD5E1', fontSize: 16, fontWeight: '600', marginLeft: 8 },
    roleBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.04)' },
    roleText: { fontSize: 12, fontWeight: '700' },

    title: { fontSize: 28, fontWeight: '900', color: '#F8FAFC', letterSpacing: -0.5, marginBottom: 4 },
    subtitle: { fontSize: 13, color: '#64748B', marginBottom: 16 },

    qCard: { padding: 20, marginBottom: 16 },
    qMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    qMetaText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
    qText: { color: '#F8FAFC', fontSize: 16, fontWeight: '600', lineHeight: 24 },

    langBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(251,146,60,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(251,146,60,0.3)' },
    langText: { color: '#FB923C', fontSize: 11, fontWeight: '700' },
    hintBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 4 },
    hintBtnText: { color: '#FBBF24', fontSize: 13, fontWeight: '600' },
    hintText: { color: '#FDE68A', fontSize: 13, lineHeight: 19, fontStyle: 'italic', marginTop: 4 },

    // MCQ
    mcqOption: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)', marginBottom: 8, gap: 12 },
    mcqBullet: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    mcqBulletText: { color: '#F8FAFC', fontSize: 12, fontWeight: '800' },
    mcqText: { flex: 1, color: '#E2E8F0', fontSize: 14, lineHeight: 20 },

    // Open answer
    inputLabel: { color: '#5B8CFF', fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
    textInput: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(91,140,255,0.3)', borderRadius: 14, color: '#F8FAFC', fontSize: 15, padding: 16, minHeight: 130, marginBottom: 6 },
    charCount: { fontSize: 12, fontWeight: '600', marginBottom: 12 },

    // Buttons
    submitBtn: { backgroundColor: '#A78BFA', paddingVertical: 15, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    submitBtnText: { color: '#0F172A', fontWeight: '900', fontSize: 15 },
    nextBtn: { backgroundColor: '#38BDF8', paddingVertical: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    nextBtnText: { color: '#0F172A', fontWeight: '900', fontSize: 15 },
    retryBlock: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: 'rgba(248,113,113,0.1)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', borderRadius: 14, padding: 14, marginBottom: 10 },
    retryTitle: { color: '#F87171', fontWeight: '800', fontSize: 14, marginBottom: 3 },
    retrySubtext: { color: '#FCA5A5', fontSize: 13, lineHeight: 18 },
    retryBtn: { backgroundColor: '#1E293B', borderWidth: 1, borderColor: 'rgba(248,113,113,0.4)', paddingVertical: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    retryBtnText: { color: '#F8FAFC', fontWeight: '700', fontSize: 14 },

    // Eval result
    scoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginTop: 8 },
    scoreRing: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    scoreNum: { fontSize: 24, fontWeight: '900' },
    scoreLabel: { color: '#64748B', fontSize: 10, fontWeight: '700' },
    scoreVerdict: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
    feedbackText: { color: '#94A3B8', fontSize: 13, lineHeight: 18 },
    section: { padding: 16, marginBottom: 10 },
    sectionTitle: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
    bulletGreen: { color: '#A7F3D0', fontSize: 13, lineHeight: 20, marginBottom: 3 },
    bulletRed:   { color: '#FCA5A5', fontSize: 13, lineHeight: 20, marginBottom: 3 },
    bulletYellow: { color: '#FDE68A', fontSize: 13, lineHeight: 20, marginBottom: 3 },
    improvedText: { color: '#BAE6FD', fontSize: 13, lineHeight: 21, fontStyle: 'italic' },

    // Summary
    summaryScroll: { paddingHorizontal: 22 },
    summaryHero: { alignItems: 'center', marginBottom: 28 },
    summaryEmoji: { fontSize: 52, marginBottom: 8 },
    summaryTitle: { fontSize: 28, fontWeight: '900', color: '#F8FAFC', marginBottom: 4 },
    summarySubtitle: { fontSize: 14, color: '#64748B' },
    summaryMetrics: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 28, flexWrap: 'wrap', gap: 12 },
    summaryMetricCard: { alignItems: 'center' },
    bigScoreCircle: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)', marginBottom: 6 },
    bigScoreNum: { fontSize: 22, fontWeight: '900' },
    bigScoreLabel: { color: '#64748B', fontSize: 10 },
    metricLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
    summarySection: { color: '#5B8CFF', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginTop: 8 },
    breakdownRow: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8, gap: 10, backgroundColor: 'rgba(255,255,255,0.02)' },
    breakdownNum: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    breakdownNumText: { fontSize: 11, fontWeight: '900' },
    breakdownCat: { fontSize: 10, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
    breakdownQ: { color: '#E2E8F0', fontSize: 12, lineHeight: 17 },
    breakdownMissing: { color: '#FBBF24', fontSize: 11, marginTop: 3 },
    breakdownScore: { fontSize: 18, fontWeight: '900', alignSelf: 'center', minWidth: 32, textAlign: 'right' },
    missingItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
    missingText: { color: '#FDE68A', fontSize: 13, lineHeight: 19, flex: 1 },
    restartBtn: { backgroundColor: '#5B8CFF', paddingVertical: 15, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24 },
    restartBtnText: { color: '#0F172A', fontWeight: '900', fontSize: 15 },
});
