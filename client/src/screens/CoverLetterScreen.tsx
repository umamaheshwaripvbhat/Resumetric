import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Clipboard } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from '../components/GlassCard';
import GradientButton from '../components/GradientButton';
import BackgroundGlow from '../components/BackgroundGlow';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';

export default function CoverLetterScreen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { userId, analysisResult } = useApp();

    const [form, setForm] = useState({ jobTitle: '', companyName: '', jobDescription: '' });
    const [loading, setLoading] = useState(false);
    const [letter, setLetter] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!form.jobTitle || !form.companyName) {
            alert('Please fill out Job Title and Company Name');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('http://localhost:5000/cover-letter/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId || 1,
                    job_title: form.jobTitle,
                    company_name: form.companyName,
                    job_description: form.jobDescription,
                    resume_text: analysisResult?.details?.resume_text || ''
                })
            });
            const data = await res.json();
            if (data.cover_letter) setLetter(data.cover_letter);
            else alert('Failed to generate cover letter');
        } catch (e) {
            alert('Error generating cover letter');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        if (letter) {
            Clipboard.setString(letter);
            alert('Copied to clipboard!');
        }
    };

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <BackgroundGlow />
            <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Cover Letter AI</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                {!letter ? (
                    <Animated.View entering={FadeInDown.duration(800).springify()}>
                        <Text style={styles.instructions}>Fill out the details below and let AI write a tailored cover letter based on your uploaded resume.</Text>
                        
                        <Text style={styles.label}>Job Title *</Text>
                        <GlassCard style={styles.inputCard}>
                            <TextInput 
                                style={styles.input}
                                placeholder="e.g. Frontend Engineer"
                                placeholderTextColor="#64748B"
                                value={form.jobTitle}
                                onChangeText={(t) => setForm({...form, jobTitle: t})}
                            />
                        </GlassCard>

                        <Text style={styles.label}>Company Name *</Text>
                        <GlassCard style={styles.inputCard}>
                            <TextInput 
                                style={styles.input}
                                placeholder="e.g. Acme Corp"
                                placeholderTextColor="#64748B"
                                value={form.companyName}
                                onChangeText={(t) => setForm({...form, companyName: t})}
                            />
                        </GlassCard>

                        <Text style={styles.label}>Job Description (Optional but recommended)</Text>
                        <GlassCard style={styles.inputCard}>
                            <TextInput 
                                style={[styles.input, { height: 120 }]}
                                placeholder="Paste key requirements..."
                                placeholderTextColor="#64748B"
                                multiline
                                textAlignVertical="top"
                                value={form.jobDescription}
                                onChangeText={(t) => setForm({...form, jobDescription: t})}
                            />
                        </GlassCard>

                        <GradientButton 
                            title={loading ? "Generating..." : "Generate Cover Letter"} 
                            onPress={handleGenerate}
                            disabled={loading}
                        />
                    </Animated.View>
                ) : (
                    <Animated.View entering={FadeInDown.duration(800).springify()}>
                        <View style={styles.resultHeader}>
                            <Text style={styles.label}>Generated Letter</Text>
                            <TouchableOpacity onPress={copyToClipboard} style={styles.copyBtn}>
                                <Ionicons name="copy-outline" size={16} color="#5B8CFF" />
                                <Text style={styles.copyBtnText}>Copy</Text>
                            </TouchableOpacity>
                        </View>
                        <GlassCard style={styles.resultCard}>
                            <TextInput 
                                style={styles.resultText}
                                multiline
                                value={letter}
                                onChangeText={setLetter}
                            />
                        </GlassCard>
                        
                        <GradientButton 
                            title="Generate Another" 
                            onPress={() => setLetter(null)}
                        />
                    </Animated.View>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0B0F1A' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 20, zIndex: 10 },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#F8FAFC' },
    scroll: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 60 },
    instructions: { color: '#CBD5E1', fontSize: 14, marginBottom: 24, lineHeight: 22 },
    label: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700', color: '#64748B', marginBottom: 8 },
    inputCard: { padding: 4, marginBottom: 20 },
    input: { color: '#F8FAFC', fontSize: 16, paddingHorizontal: 16, paddingVertical: 14, height: 50 },
    resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    copyBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(91, 140, 255, 0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    copyBtnText: { color: '#5B8CFF', marginLeft: 6, fontWeight: '700', fontSize: 12 },
    resultCard: { padding: 4, marginBottom: 24 },
    resultText: { color: '#F8FAFC', fontSize: 15, lineHeight: 24, padding: 16, minHeight: 300 }
});
