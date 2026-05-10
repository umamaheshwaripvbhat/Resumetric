import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from '../components/GlassCard';
import BackgroundGlow from '../components/BackgroundGlow';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';

export default function SettingsScreen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { userId, user } = useApp();
    
    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [password, setPassword] = useState('');
    const [notifications, setNotifications] = useState(true);
    const [isPrivate, setIsPrivate] = useState(false);
    const [loading, setLoading] = useState(false);

    const saveSettings = async () => {
        setLoading(true);
        try {
            const res = await fetch('http://localhost:5000/user/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId || 1,
                    name,
                    email,
                    password: password ? password : null,
                    notifications_enabled: notifications,
                    is_private: isPrivate
                })
            });
            if (res.ok) Alert.alert('Success', 'Settings updated');
            else Alert.alert('Error', 'Failed to update settings');
        } catch (e) {
            Alert.alert('Error', 'Network error');
        } finally {
            setLoading(false);
            setPassword('');
        }
    };

    const confirmDelete = () => {
        Alert.alert(
            "Delete Account",
            "Are you sure you want to delete your account? This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: deleteAccount }
            ]
        );
    };

    const deleteAccount = async () => {
        try {
            await fetch(`http://localhost:5000/user/account?user_id=${userId || 1}`, { method: 'DELETE' });
            Alert.alert('Account Deleted', 'You have been logged out.');
            navigation.navigate('Auth' as never);
        } catch (e) {
            Alert.alert('Error', 'Failed to delete account');
        }
    };

    return (
        <View style={styles.container}>
            <BackgroundGlow />
            <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                <Text style={styles.sectionTitle}>Account Information</Text>
                <GlassCard style={styles.card}>
                    <Text style={styles.label}>Name</Text>
                    <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor="#64748B" />
                    <View style={styles.divider} />
                    <Text style={styles.label}>Email</Text>
                    <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" placeholderTextColor="#64748B" />
                    <View style={styles.divider} />
                    <Text style={styles.label}>New Password (Optional)</Text>
                    <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Enter new password" placeholderTextColor="#64748B" />
                </GlassCard>

                <Text style={styles.sectionTitle}>Preferences</Text>
                <GlassCard style={styles.card}>
                    <View style={styles.toggleRow}>
                        <View>
                            <Text style={styles.toggleTitle}>Email Notifications</Text>
                            <Text style={styles.toggleDesc}>Daily reminders and alerts</Text>
                        </View>
                        <TouchableOpacity onPress={() => setNotifications(!notifications)} style={[styles.toggleBtn, notifications && styles.toggleActive]}>
                            <View style={[styles.toggleThumb, notifications && styles.toggleThumbActive]} />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.toggleRow}>
                        <View>
                            <Text style={styles.toggleTitle}>Private Profile</Text>
                            <Text style={styles.toggleDesc}>Hide from leaderboard</Text>
                        </View>
                        <TouchableOpacity onPress={() => setIsPrivate(!isPrivate)} style={[styles.toggleBtn, isPrivate && styles.toggleActive]}>
                            <View style={[styles.toggleThumb, isPrivate && styles.toggleThumbActive]} />
                        </TouchableOpacity>
                    </View>
                </GlassCard>

                <TouchableOpacity style={styles.saveBtn} onPress={saveSettings} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save Changes</Text>}
                </TouchableOpacity>

                <Text style={[styles.sectionTitle, { color: '#EF4444', marginTop: 40 }]}>Danger Zone</Text>
                <GlassCard style={[styles.card, { borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
                    <TouchableOpacity onPress={confirmDelete} style={{ paddingVertical: 8 }}>
                        <Text style={{ color: '#EF4444', fontSize: 16, fontWeight: '700', textAlign: 'center' }}>Delete Account</Text>
                    </TouchableOpacity>
                </GlassCard>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0B0F1A' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 20 },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#F8FAFC' },
    scroll: { paddingHorizontal: 20, paddingBottom: 60 },
    sectionTitle: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700', color: '#64748B', marginBottom: 12, marginTop: 24, marginLeft: 4 },
    card: { padding: 16, marginBottom: 16 },
    label: { fontSize: 13, color: '#94A3B8', marginBottom: 6 },
    input: { color: '#F8FAFC', fontSize: 16, marginBottom: 4 },
    divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 12 },
    toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
    toggleTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '600' },
    toggleDesc: { color: '#64748B', fontSize: 12, marginTop: 2 },
    toggleBtn: { width: 50, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', padding: 2 },
    toggleActive: { backgroundColor: '#5B8CFF' },
    toggleThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#CBD5E1' },
    toggleThumbActive: { backgroundColor: '#fff', transform: [{ translateX: 22 }] },
    saveBtn: { backgroundColor: '#5B8CFF', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 20 },
    saveText: { color: '#fff', fontSize: 16, fontWeight: '700' }
});
