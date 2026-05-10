import React, { useState, useRef, useEffect } from 'react';
import { 
    View, Text, StyleSheet, TextInput, KeyboardAvoidingView, 
    Platform, TouchableOpacity, ScrollView, Alert, ActivityIndicator 
} from 'react-native';
import GlassCard from '../components/GlassCard';
import GradientButton from '../components/GradientButton';
import BackgroundGlow from '../components/BackgroundGlow';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AuthScreen({ navigation }: any) {
    const { setUser } = useApp();
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Common Fields
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // Sign Up Fields
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [occupation, setOccupation] = useState<'Student' | 'Working'>('Student');
    const [semester, setSemester] = useState('');
    const [company, setCompany] = useState('');
    const [role, setRole] = useState('');
    const [experience, setExperience] = useState('');

    // Refs for cursor focus orchestration
    const emailRef = useRef<TextInput>(null);
    const passwordRef = useRef<TextInput>(null);

    useEffect(() => {
        // Requirement 1: Cursor should be present in email on open
        setTimeout(() => emailRef.current?.focus(), 500);
    }, []);

    const validateEmail = (e: string) => {
        // Requirement 3: Must contain @gmail.com or official domain logic
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(e) && (e.includes('gmail.com') || e.includes('.com'));
    };

    const validatePassword = (p: string) => {
        // Requirement 2: 1 capital, 8+ chars
        const regex = /^(?=.*[A-Z]).{8,}$/;
        return regex.test(p);
    };

    const handleAuth = async () => {
        setError(null);

        if (!validateEmail(email)) {
            setError("Please enter a valid email (e.g. name@gmail.com)");
            return;
        }

        if (!validatePassword(password)) {
            setError("Password: Min 8 chars, at least 1 capital letter.");
            return;
        }

        if (isLogin) {
            setLoading(true);
            try {
                const formData = new FormData();
                formData.append('email', email);
                formData.append('password', password);
                const res = await apiFetch("/login-check", {
                    method: "POST",
                    body: formData
                });
                const data = await res.json();
                setLoading(false);
                if (data.error) {
                    setError(data.error);
                } else {
                    setUser({
                        ...(data.user || {}),
                        id: data.user_id,
                        email: data.user?.email || email,
                        name: data.user?.name || email.split('@')[0],
                        token: data.token,
                    });
                    
                    const hasOnboarded = await AsyncStorage.getItem('@onboarding_completed');
                    if (hasOnboarded) {
                        navigation.navigate('Home');
                    } else {
                        navigation.navigate('Onboarding');
                    }
                }
            } catch(e) {
                setLoading(false);
                setError("Network error. Is backend running?");
            }
        } else {
            // Register Logic
            if (!name || !phone) {
                setError("Please fill all contact details.");
                return;
            }
            if (occupation === 'Student' && !semester) {
                setError("Please specify your semester.");
                return;
            }
            if (occupation === 'Working' && (!company || !role || !experience)) {
                setError("Please fill your work details.");
                return;
            }

            setLoading(true);
            try {
                const formData = new FormData();
                formData.append('email', email);
                formData.append('password', password);
                formData.append('name', name);
                formData.append('phone', phone);
                formData.append('occupation', occupation);
                if (semester) formData.append('semester', semester);
                if (company) formData.append('company', company);
                if (role) formData.append('role', role);
                if (experience) formData.append('experience', experience);
                
                const res = await apiFetch("/register", { method: "POST", body: formData });
                const data = await res.json();
                setLoading(false);
                if (data.error) {
                    setError(data.error);
                } else {
                    Alert.alert("Success", "Account created! Please sign in.");
                    setIsLogin(true);
                }
            } catch(e) {
                setLoading(false);
                setError("Network error. Is backend running?");
            }
        }
    };

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <BackgroundGlow />
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Animated.View entering={FadeInDown.duration(800).springify()} style={styles.header}>
                    <Text style={styles.title}>Resumetric</Text>
                    <Text style={styles.sub}>{isLogin ? "Sign in to continue" : "Create your professional profile"}</Text>
                </Animated.View>

                <Animated.View entering={FadeInDown.duration(800).delay(200).springify()}>
                    <GlassCard style={styles.formCard}>
                        {/* EMAIL (Requirement 1 & 3) */}
                        <Text style={styles.label}>Email Address</Text>
                        <TextInput 
                            ref={emailRef}
                            style={styles.input} 
                            placeholder="you@gmail.com" 
                            placeholderTextColor="#64748B" 
                            autoCapitalize="none"
                            value={email}
                            onChangeText={setEmail}
                            onSubmitEditing={() => passwordRef.current?.focus()} // Requirement 1: go to password on return
                            returnKeyType="next"
                        />

                        {/* PASSWORD (Requirement 2) */}
                        <Text style={[styles.label, {marginTop: 20}]}>Password</Text>
                        <TextInput 
                            ref={passwordRef}
                            style={styles.input} 
                            placeholder="At least 8 chars + 1 capital" 
                            placeholderTextColor="#64748B" 
                            secureTextEntry
                            value={password}
                            onChangeText={setPassword}
                            onSubmitEditing={handleAuth}
                            returnKeyType="done"
                        />

                        {/* SIGN UP EXTRA FIELDS (Requirement 5) */}
                        {!isLogin && (
                            <Animated.View entering={FadeInDown.duration(400)} layout={Layout.springify()}>
                                <Text style={[styles.label, {marginTop: 20}]}>Full Name</Text>
                                <TextInput 
                                    style={styles.input} 
                                    placeholder="John Doe" 
                                    placeholderTextColor="#64748B" 
                                    value={name}
                                    onChangeText={setName}
                                />

                                <Text style={[styles.label, {marginTop: 20}]}>Phone Number</Text>
                                <TextInput 
                                    style={styles.input} 
                                    placeholder="+1 234 567 890" 
                                    placeholderTextColor="#64748B" 
                                    keyboardType="phone-pad"
                                    value={phone}
                                    onChangeText={setPhone}
                                />

                                <Text style={[styles.label, {marginTop: 20}]}>Occupation</Text>
                                <View style={styles.toggleRow}>
                                    <TouchableOpacity 
                                        style={[styles.toggleBtn, occupation === 'Student' && styles.toggleBtnActive]} 
                                        onPress={() => setOccupation('Student')}
                                    >
                                        <Text style={[styles.toggleBtnText, occupation === 'Student' && styles.toggleBtnTextActive]}>Student</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        style={[styles.toggleBtn, occupation === 'Working' && styles.toggleBtnActive]} 
                                        onPress={() => setOccupation('Working')}
                                    >
                                        <Text style={[styles.toggleBtnText, occupation === 'Working' && styles.toggleBtnTextActive]}>Working</Text>
                                    </TouchableOpacity>
                                </View>

                                {occupation === 'Student' ? (
                                    <View>
                                        <Text style={[styles.label, {marginTop: 20}]}>Semester</Text>
                                        <TextInput 
                                            style={styles.input} 
                                            placeholder="e.g. 6th Semester" 
                                            placeholderTextColor="#64748B" 
                                            value={semester}
                                            onChangeText={setSemester}
                                        />
                                    </View>
                                ) : (
                                    <View>
                                        <Text style={[styles.label, {marginTop: 20}]}>Company Name</Text>
                                        <TextInput 
                                            style={styles.input} 
                                            placeholder="e.g. Google" 
                                            placeholderTextColor="#64748B" 
                                            value={company}
                                            onChangeText={setCompany}
                                        />
                                        <Text style={[styles.label, {marginTop: 20}]}>Role</Text>
                                        <TextInput 
                                            style={styles.input} 
                                            placeholder="e.g. Senior Dev" 
                                            placeholderTextColor="#64748B" 
                                            value={role}
                                            onChangeText={setRole}
                                        />
                                        <Text style={[styles.label, {marginTop: 20}]}>Working Experience</Text>
                                        <TextInput 
                                            style={styles.input} 
                                            placeholder="e.g. 5 Years" 
                                            placeholderTextColor="#64748B" 
                                            value={experience}
                                            onChangeText={setExperience}
                                        />
                                    </View>
                                )}
                            </Animated.View>
                        )}

                        <GradientButton 
                            title={loading ? "Processing..." : (isLogin ? "Sign In" : "Create Account")} 
                            onPress={handleAuth} 
                            style={{marginTop: 32, marginBottom: 16}} 
                        />

                        <TouchableOpacity onPress={() => { setIsLogin(!isLogin); setError(null); }} style={{alignItems: 'center', padding: 8}}>
                            <Text style={styles.toggleText}>{isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}</Text>
                        </TouchableOpacity>

                        {/* ERROR MESSAGE (Requirement 4) */}
                        {error && (
                            <Text style={styles.errorTextBottom}>{error}</Text>
                        )}
                    </GlassCard>
                </Animated.View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#050811' },
    scroll: { paddingHorizontal: 24, paddingVertical: 60, flexGrow: 1, justifyContent: 'center' },
    header: { alignItems: 'center', marginBottom: 32 },
    title: { fontSize: 48, fontWeight: '900', color: '#F8FAFC', letterSpacing: -2 },
    sub: { fontSize: 16, color: '#94A3B8', marginTop: 8 },
    formCard: { padding: 24 },
    label: { color: '#64748B', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1.5 },
    input: { backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingVertical: 14, paddingHorizontal: 18, borderRadius: 14, color: '#F8FAFC', fontSize: 16 },
    toggleText: { color: '#94A3B8', fontWeight: '500', fontSize: 14 },
    errorTextBottom: { color: '#F87171', fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: 12, textTransform: 'lowercase' },
    toggleRow: { flexDirection: 'row', gap: 10 },
    toggleBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' },
    toggleBtnActive: { backgroundColor: 'rgba(167, 139, 250, 0.1)', borderColor: '#A78BFA' },
    toggleBtnText: { color: '#64748B', fontWeight: '700' },
    toggleBtnTextActive: { color: '#A78BFA' }
});
