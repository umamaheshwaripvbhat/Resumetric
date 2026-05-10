import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, TextInput, ScrollView,
    TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, 
    Platform, Dimensions, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from '../components/GlassCard';
import BackgroundGlow from '../components/BackgroundGlow';
import ProgressBar from '../components/ProgressBar';
import Animated, { 
    FadeInDown, FadeIn, FadeOut, 
    useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing 
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

type Phase = 'START' | 'QUESTION' | 'FEEDBACK' | 'SUMMARY';

export default function InterviewModeScreen({ navigation, route }: any) {
    const insets = useSafeAreaInsets();
    
    // Config
    const resumeText = route?.params?.resume_text ?? '';
    const jobDesc    = route?.params?.job_description ?? '';
    const initialRole = route?.params?.role ?? 'Software Engineer';
    const initialQuestions = route?.params?.questions ?? [
        "Explain the CAP theorem and how it influences your choice of database.",
        "Tell me about a time you had to deal with a difficult stakeholder.",
        "How do you optimize React applications for performance?",
        "What is the difference between synchronous and asynchronous programming?"
    ];

    // Session State
    const [phase, setPhase] = useState<Phase>('START');
    const [role, setRole] = useState(initialRole);
    const [currentQIdx, setCurrentQIdx] = useState(0);
    const [answers, setAnswers] = useState<string[]>([]);
    const [evaluations, setEvaluations] = useState<any[]>([]);
    const [sessionScore, setSessionScore] = useState(0);

    // Current Question State
    const [currentAnswer, setCurrentAnswer] = useState('');
    const [loading, setLoading] = useState(false);
    const [timer, setTimer] = useState(0);
    const [isRecording, setIsRecording] = useState(false);

    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Start Phase Logic
    const startInterview = () => {
        setPhase('QUESTION');
        setTimer(0);
        startTimer();
    };

    const startTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setTimer(t => t + 1);
        }, 1000);
    };

    const stopTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    // Question Submission
    const submitAnswer = async () => {
        if (currentAnswer.trim().length < 15) {
            Alert.alert("Short Answer", "Please provide a more detailed response to get a fair evaluation.");
            return;
        }
        
        stopTimer();
        setLoading(true);

        try {
            // Mocking API call for evaluation
            await new Promise(r => setTimeout(r, 2000));
            
            const score = Math.min(95, Math.max(40, 50 + Math.round(currentAnswer.length / 10)));
            const mockEval = {
                score,
                strengths: ["Clear logical flow", "Good use of technical terminology"],
                weaknesses: ["Could provide more specific examples", "Omitted trade-off discussion"],
                improved_answer: "A more comprehensive answer would include specific metrics and a brief mention of alternative architectural patterns to show breadth of knowledge.",
                feedback: score > 80 ? "Excellent verbal clarity and technical depth." : "Solid foundation but needs more industry-standard detail."
            };

            const updatedEvals = [...evaluations, mockEval];
            setEvaluations(updatedEvals);
            setAnswers([...answers, currentAnswer]);
            setPhase('FEEDBACK');
        } catch (e) {
            Alert.alert("Error", "Failed to evaluate answer.");
            startTimer();
        } finally {
            setLoading(false);
        }
    };

    const nextQuestion = () => {
        if (currentQIdx < initialQuestions.length - 1) {
            setCurrentQIdx(currentQIdx + 1);
            setCurrentAnswer('');
            setTimer(0);
            setPhase('QUESTION');
            startTimer();
        } else {
            // Calculate final session score
            const total = evaluations.reduce((acc, curr) => acc + curr.score, 0);
            setSessionScore(Math.round(total / evaluations.length));
            setPhase('SUMMARY');
        }
    };

    const retryQuestion = () => {
        const newEvals = [...evaluations];
        newEvals.pop();
        setEvaluations(newEvals);

        const newAnswers = [...answers];
        newAnswers.pop();
        setAnswers(newAnswers);

        setPhase('QUESTION');
        startTimer();
    };

    // Sub-renders
    const renderStart = () => (
        <Animated.View entering={FadeInDown.duration(800).springify()} style={styles.phaseContainer}>
            <View style={styles.startHero}>
                <View style={styles.iconCircle}>
                    <Ionicons name="terminal" size={40} color="#A78BFA" />
                </View>
                <Text style={styles.heroTitle}>Interview Mode</Text>
                <Text style={styles.heroSub}>Sharpen your skills with a {initialQuestions.length}-question simulate session.</Text>
            </View>

            <GlassCard style={styles.roleCard}>
                <Text style={styles.inputLabel}>TARGET ROLE</Text>
                <TextInput 
                    style={styles.roleInput}
                    value={role}
                    onChangeText={setRole}
                    placeholder="e.g. Senior Frontend Engineer"
                    placeholderTextColor="#475569"
                />
            </GlassCard>

            <TouchableOpacity style={styles.primaryBtn} onPress={startInterview}>
                <LinearGradient 
                    colors={['#A78BFA', '#8B5CF6']} 
                    start={{x:0, y:0}} end={{x:1, y:0}} 
                    style={styles.gradientFill} 
                />
                <Text style={styles.primaryBtnText}>Start Mock Interview</Text>
                <Ionicons name="rocket-outline" size={20} color="#0F172A" style={{marginLeft: 8}} />
            </TouchableOpacity>
        </Animated.View>
    );

    const renderQuestion = () => (
        <Animated.View entering={FadeInDown.duration(600)} style={styles.phaseContainer}>
            <View style={styles.headerRow}>
                <View>
                    <Text style={styles.progressText}>QUESTION {currentQIdx + 1} OF {initialQuestions.length}</Text>
                    <View style={{width: 120, marginTop: 6}}>
                        <ProgressBar progress={((currentQIdx + 1) / initialQuestions.length) * 100} color="#A78BFA" />
                    </View>
                </View>
                <View style={styles.timerBadge}>
                    <Ionicons name="time-outline" size={14} color="#94A3B8" style={{marginRight: 4}} />
                    <Text style={styles.timerText}>{formatTime(timer)}</Text>
                </View>
            </View>

            <Text style={styles.questionTextLarge}>{initialQuestions[currentQIdx]}</Text>

            <View style={styles.inputWrapper}>
                <GlassCard style={styles.answerInputGlass}>
                    <TextInput 
                        style={styles.answerInput}
                        multiline
                        placeholder="Type your answer or use voice recording..."
                        placeholderTextColor="#475569"
                        value={currentAnswer}
                        onChangeText={setCurrentAnswer}
                    />
                </GlassCard>
                
                <View style={styles.actionRow}>
                    <TouchableOpacity 
                        style={[styles.voiceCircle, isRecording && {backgroundColor: '#F87171'}]}
                        onPressIn={() => setIsRecording(true)}
                        onPressOut={() => setIsRecording(false)}
                    >
                        <Ionicons name={isRecording ? "mic" : "mic-outline"} size={24} color="#FFF" />
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.submitCircle, (!currentAnswer.trim() || loading) && {opacity: 0.5}]}
                        onPress={submitAnswer}
                        disabled={!currentAnswer.trim() || loading}
                    >
                        {loading ? <ActivityIndicator color="#FFF" /> : <Ionicons name="send" size={20} color="#FFF" />}
                    </TouchableOpacity>
                </View>
            </View>
        </Animated.View>
    );

    const renderFeedback = () => {
        const ev = evaluations[currentQIdx];
        return (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <Animated.View entering={FadeInDown.duration(800).springify()}>
                    <View style={styles.scoreHeader}>
                        <View style={styles.scoreCircleLarge}>
                            <Text style={styles.scoreValue}>{ev.score}</Text>
                            <Text style={styles.scoreLabelSmall}>SCORE</Text>
                        </View>
                        <View style={{flex: 1, marginLeft: 20}}>
                            <Text style={styles.verdictText}>{ev.score > 80 ? 'Exceptional!' : ev.score > 60 ? 'Solid Response' : 'Keep Practicing'}</Text>
                            <Text style={styles.briefFeedback}>{ev.feedback}</Text>
                        </View>
                    </View>

                    <GlassCard style={styles.feedbackCard}>
                        <Text style={styles.feedbackTitle}>✅ STRENGTHS</Text>
                        {ev.strengths.map((s: string, i: number) => (
                            <Text key={i} style={styles.bulletItem}>• {s}</Text>
                        ))}
                    </GlassCard>

                    <GlassCard style={[styles.feedbackCard, {borderColor: 'rgba(239, 68, 68, 0.2)'}]}>
                        <Text style={[styles.feedbackTitle, {color: '#F87171'}]}>⚠️ WEAKNESSES</Text>
                        {ev.weaknesses.map((w: string, i: number) => (
                            <Text key={i} style={styles.bulletItem}>• {w}</Text>
                        ))}
                    </GlassCard>

                    <GlassCard style={styles.feedbackCard}>
                        <Text style={[styles.feedbackTitle, {color: '#38BDF8'}]}>✨ IMPROVED ANSWER</Text>
                        <Text style={styles.improvedText}>{ev.improved_answer}</Text>
                    </GlassCard>

                    <View style={styles.btnColumn}>
                        <TouchableOpacity style={styles.nextBtn} onPress={nextQuestion}>
                            <Text style={styles.nextBtnText}>
                                {currentQIdx === initialQuestions.length - 1 ? 'Finish Interview' : 'Next Question'}
                            </Text>
                            <Ionicons name="arrow-forward" size={18} color="#0F172A" />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.retryBtn} onPress={retryQuestion}>
                            <Ionicons name="refresh-outline" size={16} color="#94A3B8" />
                            <Text style={styles.retryBtnText}>Retry this question</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </ScrollView>
        );
    };

    const renderSummary = () => (
        <Animated.View entering={FadeInDown.duration(800).springify()} style={styles.phaseContainer}>
            <View style={styles.summaryHero}>
                <Text style={styles.summaryLabel}>INTERVIEW COMPLETE</Text>
                <Text style={styles.finalScore}>{sessionScore}</Text>
                <Text style={styles.finalLabel}>OVERALL RATING</Text>
            </View>

            <View style={styles.statContainer}>
                <View style={styles.statBox}>
                    <Text style={styles.statVal}>{initialQuestions.length}</Text>
                    <Text style={styles.statLab}>Questions</Text>
                </View>
                <View style={[styles.statBox, {borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.05)'}]}>
                    <Text style={styles.statVal}>{formatTime(answers.reduce((acc, _, i) => acc + (evaluations[i]?.timer ?? 30), 0))}</Text>
                    <Text style={styles.statLab}>Pace</Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={styles.statVal}>{sessionScore > 75 ? 'Top 10%' : 'Top 30%'}</Text>
                    <Text style={styles.statLab}>Percentile</Text>
                </View>
            </View>

            <GlassCard style={styles.suggestionCard}>
                <Ionicons name="analytics" size={24} color="#A78BFA" style={{marginBottom: 12}} />
                <Text style={styles.suggestTitle}>Performance Insights</Text>
                <Text style={styles.suggestDesc}>
                    You show strong command over {role} concepts. Focus on elaborating on specific metrics and system architecture trade-offs to reach the "Expert" tier.
                </Text>
            </GlassCard>

            <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Home')}>
                <Text style={styles.primaryBtnText}>Back to Dashboard</Text>
            </TouchableOpacity>
        </Animated.View>
    );

    return (
        <View style={styles.container}>
            <BackgroundGlow />
            <KeyboardAvoidingView 
                style={{flex: 1}} 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <View style={[styles.navbar, {paddingTop: insets.top + 10}]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
                        <Ionicons name="close" size={24} color="#64748B" />
                    </TouchableOpacity>
                    {phase !== 'START' && phase !== 'SUMMARY' && (
                        <Text style={styles.navTitle}>Interview Live</Text>
                    )}
                    <View style={{width: 40}} />
                </View>

                <View style={styles.content}>
                    {phase === 'START' && renderStart()}
                    {phase === 'QUESTION' && renderQuestion()}
                    {phase === 'FEEDBACK' && renderFeedback()}
                    {phase === 'SUMMARY' && renderSummary()}
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#050811' },
    navbar: { 
        flexDirection: 'row', justifyContent: 'space-between', 
        alignItems: 'center', paddingHorizontal: 20, paddingBottom: 15,
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)'
    },
    navTitle: { color: '#F8FAFC', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 13 },
    closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    content: { flex: 1, paddingHorizontal: 24 },
    phaseContainer: { flex: 1, paddingTop: 20 },
    scrollContent: { paddingTop: 20, paddingBottom: 40 },

    // Start Phase
    startHero: { alignItems: 'center', marginVertical: 40 },
    iconCircle: { 
        width: 80, height: 80, borderRadius: 40, 
        backgroundColor: 'rgba(167, 139, 250, 0.1)', 
        alignItems: 'center', justifyContent: 'center', marginBottom: 20,
        borderWidth: 1, borderColor: 'rgba(167, 139, 250, 0.2)'
    },
    heroTitle: { fontSize: 32, fontWeight: '900', color: '#FFF', letterSpacing: -1 },
    heroSub: { fontSize: 16, color: '#64748B', textAlign: 'center', marginTop: 10, lineHeight: 24 },
    roleCard: { padding: 20, marginBottom: 30 },
    inputLabel: { fontSize: 10, fontWeight: '900', color: '#94A3B8', letterSpacing:1.5, marginBottom: 8 },
    roleInput: { fontSize: 18, color: '#F8FAFC', fontWeight: '600' },
    
    // Primary Button
    primaryBtn: { 
        height: 60, borderRadius: 16, overflow: 'hidden', 
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        shadowColor: '#A78BFA', shadowOpacity: 0.3, shadowRadius: 15, elevation: 5
    },
    gradientFill: { ...StyleSheet.absoluteFillObject },
    primaryBtnText: { color: '#0F172A', fontSize: 16, fontWeight: '900' },

    // Question Phase
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 },
    progressText: { fontSize: 11, fontWeight: '900', color: '#94A3B8', letterSpacing: 1 },
    timerBadge: { 
        flexDirection: 'row', alignItems: 'center', 
        backgroundColor: 'rgba(255,255,255,0.05)', 
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 
    },
    timerText: { color: '#94A3B8', fontSize: 13, fontWeight: '700' },
    questionTextLarge: { fontSize: 24, fontWeight: '700', color: '#F8FAFC', lineHeight: 36, marginBottom: 40 },
    inputWrapper: { flex: 1, justifyContent: 'flex-end', paddingBottom: 40 },
    answerInputGlass: { padding: 20, minHeight: 180, marginBottom: 20 },
    answerInput: { fontSize: 16, color: '#F8FAFC', lineHeight: 24, flex: 1 },
    actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    voiceCircle: { 
        width: 60, height: 60, borderRadius: 30, backgroundColor: '#38BDF8', 
        alignItems: 'center', justifyContent: 'center' 
    },
    submitCircle: { 
        width: 60, height: 60, borderRadius: 30, backgroundColor: '#A78BFA', 
        alignItems: 'center', justifyContent: 'center' 
    },

    // Feedback Phase
    scoreHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
    scoreCircleLarge: { 
        width: 100, height: 100, borderRadius: 50, 
        borderWidth: 6, borderColor: '#A78BFA', 
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(167, 139, 250, 0.05)'
    },
    scoreValue: { fontSize: 36, fontWeight: '900', color: '#A78BFA' },
    scoreLabelSmall: { fontSize: 10, fontWeight: '900', color: '#64748B' },
    verdictText: { fontSize: 22, fontWeight: '800', color: '#F8FAFC', marginBottom: 4 },
    briefFeedback: { fontSize: 14, color: '#94A3B8', lineHeight: 20 },
    feedbackCard: { padding: 18, marginBottom: 12 },
    feedbackTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1, color: '#34D399', marginBottom: 12 },
    bulletItem: { color: '#CBD5E1', fontSize: 14, lineHeight: 22, marginBottom: 6 },
    improvedText: { color: '#BAE6FD', fontSize: 14, lineHeight: 22, fontStyle: 'italic' },
    btnColumn: { marginTop: 20 },
    nextBtn: { 
        backgroundColor: '#A78BFA', paddingVertical: 18, borderRadius: 16, 
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12
    },
    nextBtnText: { color: '#0F172A', fontSize: 16, fontWeight: '900', marginRight: 8 },
    retryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
    retryBtnText: { color: '#64748B', fontSize: 14, fontWeight: '700', marginLeft: 6 },

    // Summary Phase
    summaryHero: { alignItems: 'center', marginVertical: 40 },
    summaryLabel: { fontSize: 12, fontWeight: '900', color: '#94A3B8', letterSpacing: 4, marginBottom: 16 },
    finalScore: { fontSize: 120, fontWeight: '900', color: '#FFF', letterSpacing: -5 },
    finalLabel: { fontSize: 14, fontWeight: '800', color: '#64748B', letterSpacing: 2 },
    statContainer: { flexDirection: 'row', marginBottom: 40 },
    statBox: { flex: 1, alignItems: 'center' },
    statVal: { fontSize: 24, fontWeight: '800', color: '#F8FAFC', marginBottom: 4 },
    statLab: { fontSize: 12, color: '#64748B', fontWeight: '600' },
    suggestionCard: { padding: 24, marginBottom: 40 },
    suggestTitle: { fontSize: 18, fontWeight: '800', color: '#F8FAFC', marginBottom: 8 },
    suggestDesc: { fontSize: 14, color: '#94A3B8', lineHeight: 22 },
});
