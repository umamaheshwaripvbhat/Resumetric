import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import GradientButton from '../components/GradientButton';
import BackgroundGlow from '../components/BackgroundGlow';
import Animated, { FadeInDown } from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

const SLIDES = [
    {
        id: '1',
        title: "Upload your resume and get an AI score",
        subtitle: "Find out how ATS-friendly your resume truly is. Discover your strengths and fix critical weaknesses before recruiters see them.",
        icon: "document-text"
    },
    {
        id: '2',
        title: "Practice interviews tailored to your resume",
        subtitle: "Stop using generic questions. Let our AI mock interviewer grill you on your exact projects and skills.",
        icon: "mic"
    },
    {
        id: '3',
        title: "Join a community of job seekers",
        subtitle: "Share questions, build reputation, and grow your network. Get answers from verified professionals.",
        icon: "people"
    }
];

export default function OnboardingScreen() {
    const navigation = useNavigation();
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);

    const completeOnboarding = async () => {
        try {
            await AsyncStorage.setItem('@onboarding_completed', 'true');
            navigation.navigate('Home' as never);
        } catch (e) {
            console.error('Failed to save onboarding state', e);
            navigation.navigate('Home' as never);
        }
    };

    const nextSlide = () => {
        if (currentIndex < SLIDES.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
        } else {
            completeOnboarding();
        }
    };

    const renderItem = ({ item, index }: any) => {
        return (
            <View style={styles.slide}>
                <Animated.View entering={FadeInDown.duration(800).delay(200).springify()} style={styles.iconContainer}>
                    <Ionicons name={item.icon as any} size={80} color="#5B8CFF" />
                </Animated.View>
                <Animated.View entering={FadeInDown.duration(800).delay(400).springify()}>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.subtitle}>{item.subtitle}</Text>
                </Animated.View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <BackgroundGlow />
            
            <TouchableOpacity onPress={completeOnboarding} style={styles.skipBtn}>
                <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>

            <FlatList
                ref={flatListRef}
                data={SLIDES}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                onMomentumScrollEnd={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
                    setCurrentIndex(idx);
                }}
            />

            <View style={styles.footer}>
                <View style={styles.pagination}>
                    {SLIDES.map((_, i) => (
                        <View key={i} style={[styles.dot, currentIndex === i && styles.activeDot]} />
                    ))}
                </View>

                <GradientButton 
                    title={currentIndex === SLIDES.length - 1 ? "Get Started" : "Continue"} 
                    onPress={nextSlide} 
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0B0F1A' },
    skipBtn: { position: 'absolute', top: 60, right: 24, zIndex: 10, padding: 8 },
    skipText: { color: '#94A3B8', fontSize: 16, fontWeight: '600' },
    slide: { width, height: height * 0.7, justifyContent: 'center', alignItems: 'center', padding: 24 },
    iconContainer: { width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(91, 140, 255, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 40 },
    title: { fontSize: 32, fontWeight: '800', color: '#F8FAFC', textAlign: 'center', marginBottom: 16, lineHeight: 40 },
    subtitle: { fontSize: 16, color: '#CBD5E1', textAlign: 'center', lineHeight: 24, paddingHorizontal: 20 },
    footer: { position: 'absolute', bottom: 40, left: 24, right: 24 },
    pagination: { flexDirection: 'row', justifyContent: 'center', marginBottom: 32 },
    dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 6 },
    activeDot: { backgroundColor: '#5B8CFF', width: 24 }
});
