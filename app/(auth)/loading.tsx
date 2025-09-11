import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

const { width, height } = Dimensions.get('window');

export default function LoadingPage() {
  const router = useRouter();
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));
  const [loadingText, setLoadingText] = useState('Initializing...');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Simulate loading progress
    const loadingSteps = [
      { text: 'Verifying credentials...', duration: 1000 },
      { text: 'Loading your profile...', duration: 1200 },
      { text: 'Preparing dashboard...', duration: 1000 },
      { text: 'Almost ready...', duration: 800 },
    ];

    let currentStep = 0;
    let currentProgress = 0;

    const progressInterval = setInterval(() => {
      currentProgress += 2;
      setProgress(Math.min(currentProgress, 100));

      if (currentStep < loadingSteps.length && currentProgress >= (currentStep + 1) * 25) {
        setLoadingText(loadingSteps[currentStep].text);
        currentStep++;
      }
    }, 50);

    // Navigate to tabs after loading is complete
    const navigationTimeout = setTimeout(() => {
      router.replace('/home' as any);
    }, 4000);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(navigationTimeout);
    };
  }, [router, fadeAnim, scaleAnim]);

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* App Icon/Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoBackground}>
            <Ionicons name="trash" size={60} color="#4f6b4f" />
          </View>
        </View>

        {/* App Name */}
        <Text style={styles.appName}>TrashTrack</Text>
        <Text style={styles.welcomeText}>Welcome back!</Text>

        {/* Loading Animation */}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4f6b4f" />
          <Text style={styles.loadingText}>{loadingText}</Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>{progress}%</Text>
        </View>

        {/* Loading Dots Animation */}
        <View style={styles.dotsContainer}>
          <Animated.View style={[styles.dot, styles.dot1]} />
          <Animated.View style={[styles.dot, styles.dot2]} />
          <Animated.View style={[styles.dot, styles.dot3]} />
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F5E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logoContainer: {
    marginBottom: 30,
  },
  logoBackground: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#2f3a31',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 16,
    color: '#6b6b6b',
    marginBottom: 40,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  loadingText: {
    fontSize: 16,
    color: '#4f6b4f',
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 30,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(79, 107, 79, 0.2)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4f6b4f',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    color: '#4f6b4f',
    fontWeight: '600',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4f6b4f',
    marginHorizontal: 4,
  },
  dot1: {
    opacity: 0.4,
  },
  dot2: {
    opacity: 0.7,
  },
  dot3: {
    opacity: 1,
  },
});
