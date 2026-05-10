import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from '../components/GlassCard';
import BackgroundGlow from '../components/BackgroundGlow';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { LineChart } from 'react-native-chart-kit';

export default function VersionHistoryScreen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { userId } = useApp();
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const res = await fetch(`http://localhost:5000/resume/history?user_id=${userId || 1}`);
            const data = await res.json();
            setHistory(data || []);
        } catch (e) {
            console.error('Failed to fetch history', e);
        } finally {
            setLoading(false);
        }
    };

    // Prepare chart data
    const chartData = {
        labels: history.length > 0 ? history.map((_, i) => `v${i+1}`) : ['v1'],
        datasets: [
            {
                data: history.length > 0 ? history.map(h => h.score) : [0],
                color: (opacity = 1) => `rgba(91, 140, 255, ${opacity})`,
                strokeWidth: 2
            }
        ]
    };

    return (
        <View style={styles.container}>
            <BackgroundGlow />
            <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}>
                
                <Animated.View entering={FadeInDown.duration(800).springify()}>
                    <View style={styles.topNavbarRow}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="arrow-back" size={20} color="#CBD5E1" />
                        </TouchableOpacity>
                        <Text style={styles.navTitle}>Version History</Text>
                        <View style={{width: 20}} />
                    </View>
                </Animated.View>

                {loading ? (
                    <View style={{ padding: 40, alignItems: 'center' }}>
                        <ActivityIndicator size="large" color="#5B8CFF" />
                        <Text style={{ color: '#94A3B8', marginTop: 12 }}>Loading history...</Text>
                    </View>
                ) : (
                    <>
                        {history.length > 0 ? (
                            <Animated.View entering={FadeInDown.duration(800).delay(100).springify()}>
                                <Text style={styles.sectionTitle}>Score Over Time</Text>
                                <GlassCard style={styles.chartCard}>
                                    <LineChart
                                        data={chartData}
                                        width={Dimensions.get('window').width - 80}
                                        height={220}
                                        yAxisSuffix="%"
                                        chartConfig={{
                                            backgroundColor: 'transparent',
                                            backgroundGradientFrom: 'transparent',
                                            backgroundGradientTo: 'transparent',
                                            backgroundGradientFromOpacity: 0,
                                            backgroundGradientToOpacity: 0,
                                            decimalPlaces: 0,
                                            color: (opacity = 1) => `rgba(91, 140, 255, ${opacity})`,
                                            labelColor: (opacity = 1) => `rgba(203, 213, 225, ${opacity})`,
                                            style: { borderRadius: 16 },
                                            propsForDots: { r: "4", strokeWidth: "2", stroke: "#5B8CFF" }
                                        }}
                                        bezier
                                        style={{ marginVertical: 8, borderRadius: 16 }}
                                    />
                                </GlassCard>
                            </Animated.View>
                        ) : (
                            <View style={{ padding: 40, alignItems: 'center' }}>
                                <Text style={{ color: '#94A3B8', textAlign: 'center' }}>No version history found.</Text>
                            </View>
                        )}

                        <View style={{ marginTop: 24 }}>
                            <Text style={styles.sectionTitle}>Changelog</Text>
                            {history.map((h, i) => (
                                <Animated.View key={h.id} entering={FadeInDown.duration(800).delay(200 + i * 100).springify()}>
                                    <GlassCard style={styles.historyCard}>
                                        <View style={styles.row}>
                                            <View>
                                                <Text style={styles.versionText}>Version {i + 1}</Text>
                                                <Text style={styles.dateText}>{new Date(h.created_at).toLocaleDateString()}</Text>
                                            </View>
                                            <Text style={styles.scoreText}>{h.score}%</Text>
                                        </View>
                                        <Text style={styles.summaryText}>{h.feedback_summary || 'No feedback summary provided.'}</Text>
                                    </GlassCard>
                                </Animated.View>
                            ))}
                        </View>
                    </>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0B0F1A' },
    scroll: { paddingHorizontal: 24 },
    topNavbarRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    navTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '800' },
    sectionTitle: { fontSize: 14, color: '#64748B', fontWeight: '700', textTransform: 'uppercase', marginBottom: 12, marginTop: 8 },
    chartCard: { padding: 16, marginBottom: 24, alignItems: 'center' },
    historyCard: { padding: 16, marginBottom: 16 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    versionText: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
    dateText: { color: '#64748B', fontSize: 12, marginTop: 2 },
    scoreText: { color: '#5B8CFF', fontSize: 24, fontWeight: '800' },
    summaryText: { color: '#CBD5E1', fontSize: 13, lineHeight: 20 }
});
