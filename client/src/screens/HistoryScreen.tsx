import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from '../components/GlassCard';
import BackgroundGlow from '../components/BackgroundGlow';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../config/api';

export default function HistoryScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const { user, setHistory } = useApp();
    const [history, setLocalHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    useEffect(() => {
        const fetchHistory = async () => {
            if (!user?.id) {
                setLoading(false);
                return;
            }
            try {
                const res = await apiFetch(`/history?user_id=${user.id}`);
                const data = await res.json();
                setLocalHistory(data);
                setHistory(data);
            } catch (e: any) {
                setError(e.message || 'Failed to fetch history');
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [user?.id]);

    return (
        <View style={styles.container}>
            <BackgroundGlow />
            <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}>
                
                <Animated.View entering={FadeInDown.duration(800).springify()}>
                    <View style={styles.topNavbarRow}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="arrow-back" size={20} color="#CBD5E1" />
                            <Text style={styles.navLink}>Back</Text>
                        </TouchableOpacity>
                        <Text style={styles.navTitle}>Analysis History</Text>
                        <View style={{width: 50}} />
                    </View>
                </Animated.View>

                {loading && (
                    <View style={{ padding: 40, alignItems: 'center' }}>
                        <ActivityIndicator size="large" color="#5B8CFF" />
                        <Text style={{ color: '#94A3B8', marginTop: 12 }}>Loading your history...</Text>
                    </View>
                )}

                {error && (
                    <View style={{ padding: 40, alignItems: 'center' }}>
                        <Ionicons name="alert-circle-outline" size={32} color="#F87171" />
                        <Text style={{ color: '#F87171', marginTop: 12, textAlign: 'center' }}>{error}</Text>
                    </View>
                )}

                {!loading && !error && history.length === 0 && (
                    <View style={{ padding: 40, alignItems: 'center' }}>
                        <Text style={{ color: '#94A3B8', textAlign: 'center' }}>No history found. Upload a resume to start analyzing.</Text>
                    </View>
                )}

                {/* Score Version Tracking */}
                {history.map((h, i) => (
                    <Animated.View key={h.id} entering={FadeInDown.duration(800).delay(150 + i * 150).springify()}>
                        <GlassCard style={styles.historyCard} onPress={() => navigation.navigate('Home' as never)}>
                            <View style={styles.row}>
                                <View>
                                    <Text style={styles.jobText}>Resume Analysis</Text>
                                    <Text style={styles.dateText}>{h.date}</Text>
                                </View>
                                <View style={{alignItems: 'flex-end'}}>
                                    <Text style={styles.scoreText}>{h.score}%</Text>
                                    {h.diff > 0 ? (
                                        <Text style={styles.diffUp}>↑ +{h.diff}% Score</Text>
                                    ) : h.diff < 0 ? (
                                        <Text style={[styles.diffUp, { color: '#F87171' }]}>↓ {h.diff}% Score</Text>
                                    ) : (
                                        <Text style={styles.diffNeutral}>Initial Baseline</Text>
                                    )}
                                </View>
                            </View>
                        </GlassCard>
                    </Animated.View>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#050811' },
    scroll: { paddingHorizontal: 24 },
    topNavbarRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 36, marginTop: 4 },
    navLink: { color: '#CBD5E1', fontSize: 16, fontWeight: '600', marginLeft: 8 },
    navTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '800' },
    historyCard: { padding: 20, marginBottom: 16 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    jobText: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginBottom: 6 },
    dateText: { color: '#64748B', fontSize: 13, fontWeight: '500' },
    scoreText: { color: '#F8FAFC', fontSize: 26, fontWeight: '800' },
    diffUp: { color: '#22C55E', fontSize: 13, fontWeight: '700', marginTop: 4 },
    diffNeutral: { color: '#64748B', fontSize: 13, marginTop: 4, fontWeight: '500' }
});
