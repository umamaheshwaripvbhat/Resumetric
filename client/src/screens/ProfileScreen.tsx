import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BackgroundGlow from '../components/BackgroundGlow';
import GlassCard from '../components/GlassCard';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../config/api';

import { useRoute } from '@react-navigation/native';

const TABS = ['My Posts', 'Saved Posts', 'Liked Posts', 'My Comments'];

export default function ProfileScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const route = useRoute();
    const { user, logout, setUser } = useApp();
    
    const profileId = (route.params as any)?.userId || user?.id;
    const isOwnProfile = profileId === user?.id;
    const [profile, setProfile] = useState<any>(null);
    const [activity, setActivity] = useState<any>({ posts: [], saved: [], liked: [], comments: [], points_history: [] });
    const [activeTab, setActiveTab] = useState('My Posts');
    const [loading, setLoading] = useState(true);
    const [editOpen, setEditOpen] = useState(false);
    const [editBio, setEditBio] = useState('');
    const [editName, setEditName] = useState('');

    const fetchProfile = async () => {
        if (!profileId) return;
        try {
            const [profileRes, activityRes] = await Promise.all([
                apiFetch(`/profile/${profileId}`),
                apiFetch(`/profile/${profileId}/activity`),
            ]);
            const profileData = await profileRes.json();
            const activityData = await activityRes.json();
            setProfile(profileData);
            setActivity(activityData);
            setEditName(profileData?.name || '');
            setEditBio(profileData?.bio || '');
        } catch (e) {
            console.error('Failed to fetch profile', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, [profileId]);

    const saveProfile = async () => {
        if (!user?.id) return;
        const res = await apiFetch(`/profile/${user.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: editName, bio: editBio.slice(0, 150) }),
        });
        const data = await res.json();
        if (data.user) setUser({ ...user, ...data.user });
        setEditOpen(false);
        fetchProfile();
    };

    const tabItems = activeTab === 'My Posts'
        ? activity.posts
        : activeTab === 'Saved Posts'
        ? activity.saved
        : activeTab === 'Liked Posts'
        ? activity.liked
        : activity.comments;

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center' }]}>
                <BackgroundGlow />
                <ActivityIndicator size="large" color="#5B8CFF" />
            </View>
        );
    }

    const org = profile?.occupation === 'Student'
        ? profile?.college || profile?.college_sem || 'Student'
        : profile?.company || 'Working Professional';

    return (
        <View style={styles.container}>
            <BackgroundGlow />
            <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: 100 }]}>
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color="#CBD5E1" /></TouchableOpacity>
                    {isOwnProfile && (
                        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                            <TouchableOpacity onPress={() => navigation.navigate('Settings' as never)}>
                                <Ionicons name="settings-outline" size={24} color="#CBD5E1" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={logout}><Text style={styles.logoutText}>Logout</Text></TouchableOpacity>
                        </View>
                    )}
                </View>

                <Animated.View entering={FadeInDown.duration(650)} style={styles.profileHeader}>
                    <View style={styles.avatarWrap}>
                        <View style={styles.avatar}>
                            {profile?.profile_photo
                                ? React.createElement('img', { src: profile.profile_photo, style: styles.avatarImage as any })
                                : <Text style={styles.avatarText}>{profile?.name?.[0] || 'U'}</Text>}
                        </View>
                        <TouchableOpacity style={styles.editPhotoBtn}><Ionicons name="camera-outline" size={16} color="#FFFFFF" /></TouchableOpacity>
                    </View>

                    <View style={styles.identityBlock}>
                        <Text style={styles.userName}>{profile?.name || 'Resumetric User'}</Text>
                        <Text style={styles.handle}>@{profile?.username || profile?.email?.split('@')[0]}</Text>
                        <View style={styles.badgeRow}>
                            <Text style={styles.occupationBadge}>{profile?.occupation === 'Student' ? 'Student' : 'Professional'}</Text>
                            <Text style={styles.pointsBadge}>{profile?.points || 0} pts</Text>
                            <Text style={styles.repBadge}>{profile?.reputation_level || 'Newcomer'}</Text>
                        </View>
                        <Text style={styles.orgText}>{org}</Text>
                        <Text style={styles.bio}>{profile?.bio || 'Building a stronger career profile with Resumetric.'}</Text>
                    </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(100).duration(650)} style={styles.statsRow}>
                    <Stat label="Posts" value={profile?.posts_count || 0} />
                    <Stat label="Followers" value={profile?.followers_count || 0} />
                    <Stat label="Following" value={profile?.following_count || 0} />
                </Animated.View>

                {isOwnProfile ? (
                    <TouchableOpacity style={styles.editProfileBtn} onPress={() => setEditOpen(true)}>
                        <Ionicons name="create-outline" size={18} color="#E0F2FE" />
                        <Text style={styles.editProfileText}>Edit Profile</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={[styles.editProfileBtn, { backgroundColor: '#5B8CFF', borderColor: '#5B8CFF' }]}>
                        <Ionicons name="person-add-outline" size={18} color="#FFF" />
                        <Text style={[styles.editProfileText, { color: '#FFF' }]}>Follow</Text>
                    </TouchableOpacity>
                )}

                <View style={styles.tabs}>
                    {TABS.map(tab => (
                        <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
                            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.grid}>
                    {tabItems.length ? tabItems.map((item: any) => (
                        <GlassCard key={`${activeTab}-${item.id}`} style={styles.itemCard}>
                            <Text style={styles.itemTitle}>{item.post_type || (item.parent_id ? 'Comment' : 'Post')}</Text>
                            <Text style={styles.itemText}>{item.question || item.content}</Text>
                            {!!item.company_name && <Text style={styles.itemMeta}>{item.company_name} {item.role_tag ? `- ${item.role_tag}` : ''}</Text>}
                        </GlassCard>
                    )) : (
                        <GlassCard style={styles.emptyCard}><Text style={styles.emptyText}>Nothing here yet.</Text></GlassCard>
                    )}
                </View>

                <GlassCard style={styles.pointsCard}>
                    <Text style={styles.pointsTitle}>Points History</Text>
                    {activity.points_history?.length ? activity.points_history.map((entry: any) => (
                        <View key={entry.id} style={styles.pointsRow}>
                            <Text style={styles.pointsReason}>{entry.reason}</Text>
                            <Text style={styles.pointsDelta}>+{entry.points}</Text>
                        </View>
                    )) : <Text style={styles.emptyText}>Earn points by posting, commenting, and helping others.</Text>}
                </GlassCard>
            </ScrollView>

            <Modal visible={editOpen} transparent animationType="fade">
                <View style={styles.modalBackdrop}>
                    <View style={styles.editModal}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Edit Profile</Text>
                            <TouchableOpacity onPress={() => setEditOpen(false)}><Ionicons name="close" size={24} color="#94A3B8" /></TouchableOpacity>
                        </View>
                        <TextInput style={styles.input} placeholder="Display name" placeholderTextColor="#64748B" value={editName} onChangeText={setEditName} />
                        <TextInput style={[styles.input, styles.bioInput]} placeholder="Bio, 150 chars max" placeholderTextColor="#64748B" value={editBio} onChangeText={text => setEditBio(text.slice(0, 150))} multiline />
                        <Text style={styles.charCount}>{editBio.length}/150</Text>
                        <TouchableOpacity style={styles.saveBtn} onPress={saveProfile}><Text style={styles.saveText}>Save Profile</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

function Stat({ label, value }: { label: string; value: number }) {
    return (
        <View style={styles.statItem}>
            <Text style={styles.statNumber}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#050811' },
    scroll: { paddingHorizontal: 22 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 26 },
    logoutText: { color: '#F87171', fontWeight: '700', fontSize: 14 },
    profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
    avatarWrap: { width: 118, height: 118, marginRight: 22 },
    avatar: { width: 112, height: 112, borderRadius: 56, backgroundColor: '#0B0F1A', borderWidth: 3, borderColor: '#5B8CFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    avatarImage: { width: '100%', height: '100%', objectFit: 'cover' },
    avatarText: { color: '#FFFFFF', fontSize: 42, fontWeight: '900' },
    editPhotoBtn: { position: 'absolute', right: 4, bottom: 4, width: 34, height: 34, borderRadius: 17, backgroundColor: '#5B8CFF', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#050811' },
    identityBlock: { flex: 1 },
    userName: { color: '#F8FAFC', fontSize: 28, fontWeight: '900' },
    handle: { color: '#38BDF8', fontSize: 15, fontWeight: '800', marginTop: 3 },
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    occupationBadge: { color: '#D1FAE5', fontWeight: '900', fontSize: 11, paddingVertical: 5, paddingHorizontal: 9, borderRadius: 999, backgroundColor: 'rgba(34,197,94,0.12)', overflow: 'hidden' },
    pointsBadge: { color: '#FDE68A', fontWeight: '900', fontSize: 11, paddingVertical: 5, paddingHorizontal: 9, borderRadius: 999, backgroundColor: 'rgba(251,191,36,0.12)', overflow: 'hidden' },
    repBadge: { color: '#DDD6FE', fontWeight: '900', fontSize: 11, paddingVertical: 5, paddingHorizontal: 9, borderRadius: 999, backgroundColor: 'rgba(168,85,247,0.14)', overflow: 'hidden' },
    orgText: { color: '#CBD5E1', fontSize: 14, marginTop: 10, fontWeight: '700' },
    bio: { color: '#94A3B8', fontSize: 13, lineHeight: 19, marginTop: 8, maxWidth: 560 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 16 },
    statItem: { alignItems: 'center', minWidth: 90 },
    statNumber: { color: '#F8FAFC', fontSize: 20, fontWeight: '900' },
    statLabel: { color: '#64748B', fontSize: 12, marginTop: 4, fontWeight: '700' },
    editProfileBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 13, borderRadius: 10, backgroundColor: 'rgba(56,189,248,0.12)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.25)', marginBottom: 20 },
    editProfileText: { color: '#E0F2FE', fontWeight: '900', marginLeft: 8 },
    tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    tab: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.05)' },
    tabActive: { backgroundColor: '#5B8CFF' },
    tabText: { color: '#CBD5E1', fontSize: 12, fontWeight: '900' },
    tabTextActive: { color: '#FFFFFF' },
    grid: { marginBottom: 18 },
    itemCard: { padding: 16, marginBottom: 12 },
    itemTitle: { color: '#38BDF8', fontWeight: '900', fontSize: 12, marginBottom: 8 },
    itemText: { color: '#CBD5E1', fontSize: 14, lineHeight: 20 },
    itemMeta: { color: '#94A3B8', fontSize: 12, marginTop: 8, fontWeight: '800' },
    emptyCard: { padding: 20, alignItems: 'center' },
    emptyText: { color: '#94A3B8', fontSize: 13 },
    pointsCard: { padding: 18, marginBottom: 18 },
    pointsTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '900', marginBottom: 12 },
    pointsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 9, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
    pointsReason: { color: '#CBD5E1', flex: 1, fontSize: 13, lineHeight: 18 },
    pointsDelta: { color: '#4ADE80', fontWeight: '900' },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', padding: 20 },
    editModal: { width: '100%', maxWidth: 520, backgroundColor: '#0B0F1A', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 22 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    modalTitle: { color: '#F8FAFC', fontSize: 20, fontWeight: '900' },
    input: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 13, color: '#FFFFFF', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', fontSize: 14 },
    bioInput: { minHeight: 100, textAlignVertical: 'top' },
    charCount: { color: '#64748B', textAlign: 'right', marginTop: -6, marginBottom: 12, fontSize: 12 },
    saveBtn: { backgroundColor: '#5B8CFF', padding: 15, borderRadius: 10, alignItems: 'center' },
    saveText: { color: '#FFFFFF', fontWeight: '900' },
});
