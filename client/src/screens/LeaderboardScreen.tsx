import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GlassCard from '../components/GlassCard';
import BackgroundGlow from '../components/BackgroundGlow';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function LeaderboardScreen() {
    const insets = useSafeAreaInsets();
    const [leaders, setLeaders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLeaderboard();
    }, []);

    const fetchLeaderboard = async () => {
        try {
            const res = await fetch('http://localhost:5000/leaderboard');
            const data = await res.json();
            setLeaders(data || []);
        } catch (e) {
            console.error('Failed to fetch leaderboard', e);
        } finally {
            setLoading(false);
        }
    };

    const renderBadge = (rankTitle: string) => {
        let color = '#5B8CFF';
        let icon = '⭐';
        if (rankTitle.includes('Legend')) { color = '#F59E0B'; icon = '🏆'; }
        else if (rankTitle.includes('Expert')) { color = '#A855F7'; icon = '💎'; }
        else if (rankTitle.includes('Rising')) { color = '#22C55E'; icon = '🚀'; }
        
        return (
            <View style={[styles.badge, { backgroundColor: `${color}20`, borderColor: `${color}50` }]}>
                <Text style={styles.badgeIcon}>{icon}</Text>
                <Text style={[styles.badgeText, { color }]}>{rankTitle}</Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <BackgroundGlow />
            <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 80 }]}>
                <Animated.View entering={FadeInDown.duration(800).springify()} style={styles.header}>
                    <Text style={styles.title}>Leaderboard</Text>
                    <Text style={styles.subtitle}>Top 50 contributors based on reputation points.</Text>
                </Animated.View>

                {loading ? (
                    <View style={{ padding: 40, alignItems: 'center' }}>
                        <ActivityIndicator size="large" color="#5B8CFF" />
                    </View>
                ) : (
                    <View>
                        {leaders.map((user, idx) => (
                            <Animated.View key={user.id} entering={FadeInDown.duration(600).delay(idx * 50).springify()}>
                                <GlassCard style={styles.userCard}>
                                    <View style={styles.rankContainer}>
                                        <Text style={[styles.rankNumber, idx < 3 && { color: '#F59E0B', fontSize: 24 }]}>
                                            #{user.rank}
                                        </Text>
                                    </View>
                                    
                                    {user.profile_photo ? (
                                        <Image source={{ uri: user.profile_photo }} style={styles.avatar} />
                                    ) : (
                                        <View style={styles.avatarPlaceholder}>
                                            <Text style={styles.avatarText}>{user.name?.[0] || user.username?.[0] || 'U'}</Text>
                                        </View>
                                    )}
                                    
                                    <View style={styles.userInfo}>
                                        <Text style={styles.userName} numberOfLines={1}>{user.name || user.username}</Text>
                                        <Text style={styles.pointsText}>{user.points} pts</Text>
                                    </View>
                                    
                                    <View style={styles.badgeWrapper}>
                                        {renderBadge(user.rank_title)}
                                    </View>
                                </GlassCard>
                            </Animated.View>
                        ))}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0B0F1A' },
    scroll: { paddingHorizontal: 20 },
    header: { marginBottom: 24, paddingHorizontal: 4 },
    title: { fontSize: 32, fontWeight: '800', color: '#F8FAFC', marginBottom: 8 },
    subtitle: { fontSize: 14, color: '#94A3B8' },
    userCard: { flexDirection: 'row', alignItems: 'center', padding: 16, marginBottom: 12 },
    rankContainer: { width: 40, alignItems: 'center', marginRight: 12 },
    rankNumber: { fontSize: 18, fontWeight: '800', color: '#64748B' },
    avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 16 },
    avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(91,140,255,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    avatarText: { fontSize: 20, fontWeight: '800', color: '#5B8CFF', textTransform: 'uppercase' },
    userInfo: { flex: 1 },
    userName: { fontSize: 16, fontWeight: '700', color: '#F8FAFC', marginBottom: 4 },
    pointsText: { fontSize: 13, color: '#94A3B8', fontWeight: '600' },
    badgeWrapper: { alignItems: 'flex-end', justifyContent: 'center' },
    badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
    badgeIcon: { fontSize: 12, marginRight: 4 },
    badgeText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }
});
