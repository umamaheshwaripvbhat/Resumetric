import React, { useRef, useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
    Alert, Dimensions, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from '../components/GlassCard';
import BackgroundGlow from '../components/BackgroundGlow';
import Animated, { 
    FadeInDown, FadeIn, useSharedValue, useAnimatedStyle, 
    withRepeat, withTiming, withSequence, withSpring 
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { apiFetch } from '../config/api';

const { width } = Dimensions.get('window');

// High-fidelity Score Ring Component
const ScoreRing = ({ score, label, color }: { score: number, label: string, color: string }) => {
    const progress = useSharedValue(0);
    
    useEffect(() => {
        progress.value = withSpring(score / 100, { damping: 15 });
    }, [score]);

    return (
        <View style={styles.ringContainer}>
            <View style={[styles.ringBase, { borderColor: 'rgba(255,255,255,0.05)' }]}>
                <Text style={[styles.ringScore, { color }]}>{score}</Text>
                <Text style={styles.ringLabel}>{label}</Text>
            </View>
        </View>
    );
};

// Simulated Pulse Animation for Recording
const VoicePulse = ({ isRecording }: { isRecording: boolean }) => {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(0.5);

    useEffect(() => {
        if (isRecording) {
            scale.value = withRepeat(withTiming(1.5, { duration: 1000 }), -1, true);
            opacity.value = withRepeat(withTiming(0, { duration: 1000 }), -1, true);
        } else {
            scale.value = withSpring(1);
            opacity.value = withSpring(0.5);
        }
    }, [isRecording]);

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    return (
        <View style={styles.pulseContainer}>
            <Animated.View style={[styles.pulseCircle, pulseStyle]} />
            <View style={styles.recordButtonInner}>
                <Ionicons name={isRecording ? "stop" : "mic"} size={32} color="#FFFFFF" />
            </View>
        </View>
    );
};

export default function VoiceInterviewScreen({ navigation, route }: any) {
    const insets = useSafeAreaInsets();
    const role = route?.params?.role ?? 'Software Engineer';
    const question = route?.params?.question ?? "Tell me about your most challenging technical project.";

    const [isRecording, setIsRecording] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [transcript, setTranscript] = useState("");
    const recognitionRef = useRef<any>(null);
    const transcriptRef = useRef("");

    const startRecording = () => {
        setTranscript("");
        transcriptRef.current = "";
        setResult(null);
        setIsRecording(true);

        if (Platform.OS === 'web') {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (!SpeechRecognition) {
                setIsRecording(false);
                Alert.alert("Voice not supported", "Your browser does not support speech recognition. Try Chrome, or use the text mock interview.");
                return;
            }

            const recognition = new SpeechRecognition();
            recognition.lang = "en-US";
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.onresult = (event: any) => {
                let combined = "";
                for (let i = 0; i < event.results.length; i += 1) {
                    combined += event.results[i][0].transcript;
                }
                transcriptRef.current = combined.trim();
                setTranscript(transcriptRef.current);
            };
            recognition.onerror = () => {
                setIsRecording(false);
                Alert.alert("Voice error", "I could not catch your words. Please check microphone permission and try again.");
            };
            recognitionRef.current = recognition;
            recognition.start();
        } else {
            setIsRecording(false);
            Alert.alert("Voice setup needed", "Native mobile voice capture needs expo-av or device speech-to-text integration. Web voice capture is enabled.");
        }
    };

    const stopRecording = async () => {
        setIsRecording(false);
        setLoading(true);

        try {
            recognitionRef.current?.stop?.();
            await new Promise(r => setTimeout(r, 350));

            const capturedTranscript = transcriptRef.current.trim();
            if (!capturedTranscript) {
                Alert.alert("No speech detected", "I could not catch any words. Please hold the mic button while speaking and allow microphone permission.");
                return;
            }

            const res = await apiFetch('/voice-interview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question,
                    transcript: capturedTranscript,
                    role
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setResult(data);

        } catch (e) {
            Alert.alert("Error", "Failed to analyze voice input.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <BackgroundGlow />
            <ScrollView 
                contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}
                showsVerticalScrollIndicator={false}
            >
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#64748B" />
                </TouchableOpacity>

                <Animated.View entering={FadeInDown.duration(600).springify()}>
                    <Text style={styles.title}>🎙️ Voice Interview</Text>
                    <Text style={styles.subtitle}>Practice your verbal delivery for {role} roles.</Text>
                </Animated.View>

                {/* Question Info */}
                <GlassCard style={styles.questionCard}>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>CURRENT QUESTION</Text>
                    </View>
                    <Text style={styles.questionText}>{question}</Text>
                </GlassCard>

                {/* Recording Interface */}
                {!result && !loading && (
                    <View style={styles.recordSection}>
                        <TouchableOpacity 
                            onPressIn={startRecording}
                            onPressOut={stopRecording}
                            activeOpacity={0.9}
                        >
                            <VoicePulse isRecording={isRecording} />
                        </TouchableOpacity>
                        <Text style={styles.recordHint}>
                            {isRecording ? "Listening..." : "Hold to Talk"}
                        </Text>
                    </View>
                )}

                {loading && (
                    <View style={styles.loadingSection}>
                        <ActivityIndicator size="large" color="#3B82F6" />
                        <Text style={styles.loadingText}>Analyzing your delivery...</Text>
                    </View>
                )}

                {/* Analysis Results */}
                {result && (
                    <Animated.View entering={FadeIn.duration(800)}>
                        <View style={styles.scoresRow}>
                            <ScoreRing score={result.score} label="OVERALL" color="#3B82F6" />
                            <ScoreRing score={result.communication_score} label="COMM" color="#A855F7" />
                            <ScoreRing score={result.technical_score} label="TECH" color="#F59E0B" />
                        </View>

                        <GlassCard style={styles.resultCard}>
                            <Text style={styles.sectionTitle}>What you said</Text>
                            <Text style={styles.transcriptText}>"{transcript}"</Text>
                        </GlassCard>

                        <GlassCard style={styles.resultCard}>
                            <Text style={[styles.sectionTitle, { color: '#F87171' }]}>Identified Issues</Text>
                            {result.issues.map((item: string, i: number) => (
                                <View key={i} style={styles.bulletRow}>
                                    <View style={[styles.bullet, { backgroundColor: '#F87171' }]} />
                                    <Text style={styles.bulletText}>{item}</Text>
                                </View>
                            ))}
                        </GlassCard>

                        <GlassCard style={styles.resultCard}>
                            <Text style={[styles.sectionTitle, { color: '#34D399' }]}>Speaking Tips</Text>
                            {result.speaking_tips.map((tip: string, i: number) => (
                                <View key={i} style={styles.bulletRow}>
                                    <Ionicons name="bulb-outline" size={16} color="#34D399" style={{ marginRight: 8 }} />
                                    <Text style={styles.bulletText}>{tip}</Text>
                                </View>
                            ))}
                        </GlassCard>

                        <TouchableOpacity 
                            style={styles.retryBtn}
                            onPress={() => setResult(null)}
                        >
                            <Text style={styles.retryBtnText}>Retry Answer</Text>
                        </TouchableOpacity>
                    </Animated.View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#050811' },
    scroll: { paddingHorizontal: 24 },
    backBtn: { marginBottom: 20 },
    title: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', letterSpacing: -1 },
    subtitle: { fontSize: 16, color: '#64748B', marginTop: 4, marginBottom: 32 },
    
    questionCard: { padding: 24, marginBottom: 40 },
    badge: { 
        backgroundColor: 'rgba(59, 130, 246, 0.1)', 
        paddingHorizontal: 8, paddingVertical: 4, 
        borderRadius: 4, alignSelf: 'flex-start', marginBottom: 16,
        borderColor: 'rgba(59, 130, 246, 0.3)', borderWidth: 1
    },
    badgeText: { color: '#3B82F6', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    questionText: { color: '#F8FAFC', fontSize: 18, lineHeight: 28, fontWeight: '600' },

    recordSection: { alignItems: 'center', marginTop: 20 },
    pulseContainer: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center' },
    pulseCircle: { 
        position: 'absolute', width: 100, height: 100, 
        borderRadius: 50, backgroundColor: '#3B82F6' 
    },
    recordButtonInner: { 
        width: 80, height: 80, borderRadius: 40, 
        backgroundColor: '#3B82F6', alignItems: 'center', 
        justifyContent: 'center', elevation: 10, shadowColor: '#3B82F6', 
        shadowOpacity: 0.5, shadowRadius: 20 
    },
    recordHint: { color: '#94A3B8', marginTop: 24, fontSize: 14, fontWeight: '600' },

    loadingSection: { alignItems: 'center', marginTop: 40 },
    loadingText: { color: '#94A3B8', marginTop: 16, fontSize: 15 },

    scoresRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
    ringContainer: { alignItems: 'center' },
    ringBase: { 
        width: 80, height: 80, borderRadius: 40, 
        borderWidth: 6, alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.02)'
    },
    ringScore: { fontSize: 24, fontWeight: '900' },
    ringLabel: { fontSize: 9, color: '#64748B', fontWeight: '800' },

    resultCard: { padding: 20, marginBottom: 16 },
    sectionTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 1, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 12 },
    transcriptText: { color: '#CBD5E1', fontSize: 15, lineHeight: 24, fontStyle: 'italic' },
    bulletRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    bullet: { width: 6, height: 6, borderRadius: 3, marginRight: 12 },
    bulletText: { color: '#CBD5E1', fontSize: 14, flex: 1, lineHeight: 20 },

    retryBtn: { 
        backgroundColor: 'rgba(255,255,255,0.05)', 
        paddingVertical: 16, borderRadius: 12, 
        alignItems: 'center', marginTop: 20,
        borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1
    },
    retryBtnText: { color: '#FFFFFF', fontWeight: '700' }
});
