import React, { useState } from 'react';
import * as Sentry from '@sentry/react-native';
import { PostHogProvider } from 'posthog-react-native';
import { AppProvider } from './src/context/AppContext';
import { NavigationContainer, DarkTheme, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from './src/screens/HomeScreen';
import AnalysisDashboard from './src/screens/AnalysisDashboard';
import SuggestionsScreen from './src/screens/SuggestionsScreen';
import KeywordsScreen from './src/screens/KeywordsScreen';
import AnalyzingScreen from './src/screens/AnalyzingScreen';
import AuthScreen from './src/screens/AuthScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import LiveEditorScreen from './src/screens/LiveEditorScreen';
import InterviewPrepScreen from './src/screens/InterviewPrepScreen';
import MockInterviewScreen from './src/screens/MockInterviewScreen';
import VoiceInterviewScreen from './src/screens/VoiceInterviewScreen';
import InterviewModeScreen from './src/screens/InterviewModeScreen';
import AIAssistantBubble from './src/components/AIAssistantBubble';
import AIAssistantScreen from './src/screens/AIAssistantScreen';
import CommunityScreen from './src/screens/CommunityScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ResumeBuilderScreen from './src/screens/ResumeBuilderScreen';
import JobMatchScreen from './src/screens/JobMatchScreen';
import VersionHistoryScreen from './src/screens/VersionHistoryScreen';
import CoverLetterScreen from './src/screens/CoverLetterScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

// --- SENTRY SETUP ---
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
  enableInExpoDevelopment: true,
  debug: false,
});

function DashboardTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }: any) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Home Page') iconName = focused ? 'pie-chart' : 'pie-chart-outline';
          else if (route.name === 'Keywords') iconName = focused ? 'key' : 'key-outline';
          else if (route.name === 'Community') iconName = focused ? 'people' : 'people-outline';
          else if (route.name === 'Leaderboard') iconName = focused ? 'trophy' : 'trophy-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          else if (route.name === 'Interview') iconName = focused ? 'mic' : 'mic-outline';
          return <Ionicons name={iconName as any} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#5B8CFF',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          backgroundColor: '#0B0F1A',
          borderTopColor: 'rgba(255,255,255,0.1)',
          paddingTop: 5,
          height: 60,
          paddingBottom: 8
        },
        headerStyle: {
          backgroundColor: '#0B0F1A',
          shadowColor: 'transparent',
        },
        headerTintColor: '#F8FAFC',
        headerTitleStyle: { fontWeight: '600' },
        headerLeft: () => (
          <Ionicons
            name="arrow-back"
            size={24}
            color="#F8FAFC"
            style={{ marginLeft: 16 }}
            onPress={() => {
              const parent = navigation.getParent();
              if (parent) {
                parent.navigate('Home');
              } else {
                navigation.navigate('Home' as never);
              }
            }}
          />
        ),
      })}
    >
      <Tab.Screen name="Home Page" component={AnalysisDashboard} options={{ headerTitle: 'Dashboard' }} />
      <Tab.Screen name="Keywords" component={KeywordsScreen} />
      <Tab.Screen name="Community" component={CommunityScreen} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Tab.Screen name="Interview" component={InterviewPrepScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [currentRouteName, setCurrentRouteName] = useState('Auth');
  const MyTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: '#0B0F1A',
      card: '#0B0F1A',
      text: '#F8FAFC',
      border: 'rgba(255,255,255,0.1)',
    },
  };

  return (
    <PostHogProvider apiKey={process.env.EXPO_PUBLIC_POSTHOG_API_KEY || ''} options={{ host: process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com' }}>
    <AppProvider>
    <NavigationContainer
      ref={navigationRef}
      theme={MyTheme}
      onReady={() => {
        setCurrentRouteName(navigationRef.getCurrentRoute()?.name ?? 'Auth');
      }}
      onStateChange={() => {
        setCurrentRouteName(navigationRef.getCurrentRoute()?.name ?? 'Auth');
      }}
    >
      <StatusBar style="light" />
      <Stack.Navigator initialRouteName="Auth" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="History" component={HistoryScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="LiveEditor" component={LiveEditorScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="InterviewPrep" component={InterviewPrepScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="MockInterview" component={MockInterviewScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="VoiceInterview" component={VoiceInterviewScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="InterviewMode" component={InterviewModeScreen} options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="AIAssistant" component={AIAssistantScreen} />
        <Stack.Screen name="Analyzing" component={AnalyzingScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="Dashboard" component={DashboardTabs} />
        <Stack.Screen name="Community" component={CommunityScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="ResumeBuilder" component={ResumeBuilderScreen} />
        <Stack.Screen name="JobMatch" component={JobMatchScreen} />
        <Stack.Screen name="VersionHistory" component={VersionHistoryScreen} />
        <Stack.Screen name="CoverLetter" component={CoverLetterScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
      <AIAssistantBubble
        visible={currentRouteName !== 'AIAssistant'}
        onPress={() => {
          if (navigationRef.isReady()) {
            navigationRef.navigate('AIAssistant' as never);
          }
        }}
      />
    </NavigationContainer>
    </AppProvider>
    </PostHogProvider>
  );
}
