import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, TextInput, ScrollView,
    KeyboardAvoidingView, Platform, TouchableOpacity,
    NativeSyntheticEvent, TextInputKeyPressEventData
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from '../components/GlassCard';
import BackgroundGlow from '../components/BackgroundGlow';
import Animated, { FadeIn, FadeOut, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiFetch } from '../config/api';

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2: Extract current line from cursor position (exact spec)
// ─────────────────────────────────────────────────────────────────────────────
const getCurrentLine = (text: string, cursorPosition: number): string => {
    const lines = text.split('\n');
    let charCount = 0;
    for (const line of lines) {
        if (cursorPosition <= charCount + line.length) return line;
        charCount += line.length + 1;
    }
    return '';
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3: Extract last 8 words before cursor
// ─────────────────────────────────────────────────────────────────────────────
const getCursorContext = (text: string, cursorPosition: number): string => {
    const beforeCursor = text.slice(0, cursorPosition);
    const words = beforeCursor.split(' ');
    return words.slice(-8).join(' ');
};

// Detect sentence end — triggers ghost immediately (0ms delay)
const isSentenceEnd = (text: string): boolean => /[.!?]\s*$/.test(text.trimEnd());

const SCORE_COLOR = (s: number) => s >= 75 ? '#4ADE80' : s >= 50 ? '#FBBF24' : '#F87171';
const BORDER_COLOR: Record<string, string> = {
    weak: 'rgba(248,113,113,0.35)',
    average: 'rgba(251,191,36,0.35)',
    strong: 'rgba(74,222,128,0.35)',
};

const ROLES = ['Frontend Developer', 'Backend Engineer', 'Data Scientist'];
const TONES = ['strong', 'formal', 'technical', 'concise'];
const MODES = [
    { key: 'line_edit', label: 'Improve Line' },
    { key: 'section_improve', label: 'Improve Section' },
    { key: 'rewrite', label: 'Full Rewrite' },
];

const MOCK_SUGGESTIONS = [
    { ghost_text: 'reducing response time by 35%',       improved_line: 'Reduced API response time by 35% across 50k+ daily users via caching and query optimization.' },
    { ghost_text: 'achieving 99.9% uptime on production', improved_line: 'Maintained 99.9% uptime on production infrastructure through proactive monitoring and incident response.' },
    { ghost_text: 'cutting bundle size by 42%',           improved_line: 'Decreased JavaScript bundle size by 42% through code-splitting, lazy loading, and tree-shaking.' },
    { ghost_text: 'mentoring 3 junior engineers',         improved_line: 'Onboarded and mentored 3 junior engineers, reducing ramp-up time by 40%.' },
];

export default function LiveEditorScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();

    // STEP 1: Track cursor position (exact spec)
    const [text,      setText]      = useState('');
    const [selection, setSelection] = useState({ start: 0, end: 0 });
    const [ghostText, setGhostText] = useState('');         // STEP 7
    const [copilot,   setCopilot]   = useState<any>(null);  // deep analysis card
    const [role,      setRole]      = useState('Frontend Developer');
    const [tone,      setTone]      = useState('strong');
    const [mode,      setMode]      = useState('line_edit');
    const ghostRef = useRef('');
    useEffect(() => { ghostRef.current = ghostText; }, [ghostText]);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 4: Combine getCurrentLine + getCursorContext
    // ─────────────────────────────────────────────────────────────────────────
    const handleCursorLogic = () => {
        const cursorPos  = selection.start;
        const currentLine = getCurrentLine(text, cursorPos);
        const context    = getCursorContext(text, cursorPos);
        return { currentLine, context, cursorPos };
    };

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 5: Call AI  →  POST /inline-suggest
    // ─────────────────────────────────────────────────────────────────────────
    const callAI = async () => {
        const { currentLine, context } = handleCursorLogic();
        try {
            // ── LIVE ────────────────────────────────────────────────────────
            const res = await apiFetch('/inline-suggest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    full_text:      text,
                    current_line:   currentLine,
                    cursor_context: context,
                    role,
                    tone,
                }),
            });
            const data = await res.json();
            
            if (data.error) {
                console.warn('[inline-suggest] Error:', data.error);
                return;
            }

            setGhostText(data.ghost_text || '');
            if (data.improved_line) {
                setCopilot((prev: any) => ({ 
                    ...(prev ?? {}), 
                    improved_line: data.improved_line, 
                    confidence: data.confidence || 'high',
                    type: data.type || 'improvement'
                }));
            }
        } catch (e) {
            console.error('[inline-suggest] Failed:', e);
            setGhostText('');
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 6: Debounce — 700ms pause OR sentence end triggers immediately
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (text.length <= 20) { setGhostText(''); return; }

        const sentenceEnd = isSentenceEnd(text.slice(0, selection.start));
        const delay = sentenceEnd ? 0 : 700;

        const timeout = setTimeout(() => { callAI(); }, delay);
        return () => clearTimeout(timeout);
    }, [text, selection]);   // re-runs on both text change AND cursor move (spec §6)

    // Deep analysis — independent 900ms timer
    useEffect(() => {
        if (text.length <= 20) { setCopilot(null); return; }
        const t = setTimeout(() => {
            const score = Math.min(95, 50 + Math.round(text.length / 7));
            setCopilot((prev: any) => ({
                ...(prev ?? {}),
                section_score:    score,
                highlight_type:   score >= 75 ? 'strong' : score >= 50 ? 'average' : 'weak',
                improvement_hint: 'Add a measurable outcome to strengthen ATS scoring.',
            }));
        }, 900);
        return () => clearTimeout(t);
    }, [text]);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 8: Accept suggestion — append at cursor (or Tab key on hardware kb)
    // ─────────────────────────────────────────────────────────────────────────
    const applySuggestion = () => {
        if (!ghostRef.current) return;
        const pos    = selection.start;
        const before = text.slice(0, pos);
        const after  = text.slice(pos);
        const sep    = before.endsWith(' ') ? '' : ' ';
        setText(before + sep + ghostRef.current + after);
        setGhostText('');
    };

    const onKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
        if (e.nativeEvent.key === 'Tab' && ghostRef.current) {
            e.preventDefault?.();
            applySuggestion();
        }
    };

    const applyImproved = (line: string) => { setText(line); setCopilot(null); setGhostText(''); };

    const scoreColor   = copilot?.section_score ? SCORE_COLOR(copilot.section_score) : '#64748B';
    const ghostVisible = ghostText.length > 0 && selection.start >= text.length;

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <BackgroundGlow />

            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={20} color="#CBD5E1" />
                    <Text style={styles.navLink}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.navTitle}>Live AI Editor</Text>
                {copilot?.section_score ? (
                    <Animated.View entering={FadeIn.duration(300)} style={[styles.scoreBadge, { borderColor: scoreColor }]}>
                        <Text style={[styles.scoreBadgeNum, { color: scoreColor }]}>{copilot.section_score}</Text>
                        <Text style={styles.scoreBadgeLabel}>Score</Text>
                    </Animated.View>
                ) : <View style={{ width: 52 }} />}
            </View>

            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

                {/* Mode / Tone / Role pills */}
                <View style={{ marginBottom: 20 }}>
                    <Text style={styles.sectionLabel}>Mode</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                        {MODES.map(m => (
                            <TouchableOpacity key={m.key} style={[styles.pill, mode === m.key && styles.pillOn]} onPress={() => setMode(m.key)}>
                                <Text style={[styles.pillTxt, mode === m.key && styles.pillTxtOn]}>{m.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    <Text style={styles.sectionLabel}>Tone · Role</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {TONES.map(t => (
                            <TouchableOpacity key={t} style={[styles.pill, tone === t && styles.pillOn]} onPress={() => setTone(t)}>
                                <Text style={[styles.pillTxt, tone === t && styles.pillTxtOn]}>{t}</Text>
                            </TouchableOpacity>
                        ))}
                        <View style={styles.pillDivider} />
                        {ROLES.map(r => (
                            <TouchableOpacity key={r} style={[styles.pill, role === r && styles.pillOn]} onPress={() => setRole(r)}>
                                <Text style={[styles.pillTxt, role === r && styles.pillTxtOn]}>{r}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* ── STEP 1 + 7: Editor with ghost text overlay ─────────── */}
                <View style={[
                    styles.editorArea,
                    copilot?.highlight_type && { borderColor: BORDER_COLOR[copilot.highlight_type] ?? 'rgba(255,255,255,0.08)' }
                ]}>
                    {/*
                      Ghost text overlay technique:
                      - absoluteFill <Text> behind the TextInput
                      - typed text rendered transparent (keeps layout identical)
                      - ghost continuation rendered in dimmed gray/purple
                      - TextInput floats above, transparent background when ghost active
                    */}
                    <View style={StyleSheet.absoluteFill} pointerEvents="none">
                        <Text style={styles.ghostOverlay}>
                            <Text style={{ color: 'transparent' }}>{text}</Text>
                            {ghostVisible && (
                                // STEP 7: ghost text — gray, opacity 0.5 (exact spec)
                                <Text style={styles.ghostSpan}>{ghostText}</Text>
                            )}
                        </Text>
                    </View>

                    <TextInput
                        style={[styles.textInput, ghostVisible && { backgroundColor: 'transparent' }]}
                        multiline
                        placeholder="Start typing your resume bullet points here…"
                        placeholderTextColor="#475569"
                        value={text}
                        onChangeText={v => { setText(v); setGhostText(''); }}
                        // STEP 1: track selection/cursor
                        onSelectionChange={e => setSelection(e.nativeEvent.selection)}
                        // STEP 8: Tab key on hardware keyboard
                        onKeyPress={onKeyPress}
                        textAlignVertical="top"
                    />

                    {/* Mobile accept bar (Tab rarely fires on touchscreen) */}
                    {ghostVisible && (
                        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.acceptBar}>
                            <Ionicons name="flash-outline" size={13} color="#A78BFA" style={{ marginRight: 5 }} />
                            <Text style={styles.acceptHint} numberOfLines={1}>{ghostText}</Text>
                            <TouchableOpacity style={styles.acceptBtn} onPress={applySuggestion}>
                                <Text style={styles.acceptBtnTxt}>Accept ↵</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    )}
                </View>

                {/* Deep Copilot Card */}
                {copilot?.improved_line && (
                    <Animated.View entering={FadeInDown.duration(500).springify()}>
                        {copilot.improvement_hint && (
                            <View style={styles.hintRow}>
                                <Ionicons name="bulb-outline" size={14} color="#FBBF24" style={{ marginRight: 6 }} />
                                <Text style={styles.hintText}>{copilot.improvement_hint}</Text>
                                {copilot.confidence && (
                                    <View style={[styles.confBadge, {
                                        backgroundColor: copilot.confidence === 'high' ? 'rgba(74,222,128,0.15)' : 'rgba(251,191,36,0.15)'
                                    }]}>
                                        <Text style={[styles.confText, {
                                            color: copilot.confidence === 'high' ? '#4ADE80' : '#FBBF24'
                                        }]}>{copilot.confidence}</Text>
                                    </View>
                                )}
                            </View>
                        )}
                        <GlassCard style={styles.copilotCard}>
                            <Text style={styles.improvedLabel}>✨ Improved Line</Text>
                            <View style={styles.improvedBox}>
                                <Text style={styles.improvedText}>{copilot.improved_line}</Text>
                            </View>
                            <TouchableOpacity style={styles.applyBtn} onPress={() => applyImproved(copilot.improved_line)} activeOpacity={0.8}>
                                <Ionicons name="flash" size={15} color="#0F172A" style={{ marginRight: 6 }} />
                                <Text style={styles.applyBtnText}>Apply ✨</Text>
                            </TouchableOpacity>
                        </GlassCard>
                    </Animated.View>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#050811' },

    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 20 },
    backBtn: { flexDirection: 'row', alignItems: 'center' },
    navLink: { color: '#CBD5E1', fontSize: 16, fontWeight: '600', marginLeft: 8 },
    navTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '800' },

    scoreBadge: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center', justifyContent: 'center' },
    scoreBadgeNum: { fontSize: 17, fontWeight: '900', lineHeight: 19 },
    scoreBadgeLabel: { fontSize: 9, color: '#64748B', fontWeight: '700', textTransform: 'uppercase' },

    scroll: { paddingHorizontal: 24, paddingBottom: 60 },
    sectionLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '700', color: '#475569', marginBottom: 10 },

    pill: { backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    pillOn: { backgroundColor: 'rgba(56,189,248,0.15)', borderColor: 'rgba(56,189,248,0.45)' },
    pillTxt: { color: '#64748B', fontSize: 13, fontWeight: '600' },
    pillTxtOn: { color: '#38BDF8', fontWeight: '800' },
    pillDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 8 },

    editorArea: {
        backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        borderRadius: 18, minHeight: 220, padding: 20, marginBottom: 20, overflow: 'hidden',
    },
    // Ghost overlay (behind TextInput)
    ghostOverlay: {
        fontSize: 17, lineHeight: 28, position: 'absolute', top: 20, left: 20, right: 20,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    // STEP 7: gray, opacity 0.5 (spec)
    ghostSpan: { color: '#9CA3AF', opacity: 0.5, fontStyle: 'italic' },
    textInput: { color: '#F8FAFC', fontSize: 17, lineHeight: 28, flex: 1, zIndex: 1 },

    // Tap-to-accept bar (mobile)
    acceptBar: {
        flexDirection: 'row', alignItems: 'center',
        borderTopWidth: 1, borderTopColor: 'rgba(167,139,250,0.2)',
        marginTop: 12, paddingTop: 10, gap: 8,
    },
    acceptHint: { color: '#A78BFA', fontSize: 13, fontStyle: 'italic', opacity: 0.75, flex: 1 },
    acceptBtn: { backgroundColor: 'rgba(167,139,250,0.2)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(167,139,250,0.4)' },
    acceptBtnTxt: { color: '#C4B5FD', fontWeight: '800', fontSize: 12 },

    hintRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, paddingHorizontal: 4 },
    hintText: { color: '#94A3B8', fontSize: 13, fontWeight: '500', flex: 1 },
    confBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginLeft: 8 },
    confText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },

    copilotCard: { padding: 20 },
    improvedLabel: { color: '#22C55E', fontWeight: '800', fontSize: 14, marginBottom: 12 },
    improvedBox: { backgroundColor: 'rgba(34,197,94,0.06)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)', borderRadius: 12, padding: 14, marginBottom: 18 },
    improvedText: { color: '#A7F3D0', fontSize: 15, lineHeight: 24, fontWeight: '500' },
    applyBtn: { backgroundColor: '#22C55E', paddingVertical: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    applyBtnText: { color: '#0F172A', fontWeight: '900', fontSize: 15 },
});
