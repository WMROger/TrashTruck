import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Image as ExpoImage } from 'expo-image';
import React, { useRef, useState } from 'react';
import {
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface CarouselItem {
  id: number;
  title: string;
  subtitle: string;
  image: any;
  backgroundColor: string;
}

const carouselData: CarouselItem[] = [
  {
    id: 1,
    title: 'Welcome to TrashTrack',
    subtitle: 'Here\'s a good place for a brief overview of the app or its key features.',
    image: require('@/assets/images/splash-icon.png'),
    backgroundColor: '#E8F5E8',
  },
  {
    id: 2,
    title: 'Smart Waste Management',
    subtitle: 'Track your waste, optimize collection routes, and contribute to a cleaner environment.',
    image: require('@/assets/images/icon.png'),
    backgroundColor: '#F0F8F0',
  },
  {
    id: 3,
    title: 'Know the Waste, Clean with Haste',
    subtitle: 'Join thousands of users making a difference in waste management.',
    image: require('@/assets/images/splash-icon.png'),
    backgroundColor: '#E8F5E8',
  },
];

export default function SplashScreen({ onGetStarted }: { onGetStarted: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const handleScroll = (event: any) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / screenWidth);
    setCurrentIndex(index);
  };

  const handleDotPress = (index: number) => {
    scrollViewRef.current?.scrollTo({
      x: index * screenWidth,
      animated: true,
    });
    setCurrentIndex(index);
  };

  const handleGetStarted = () => {
    onGetStarted();
  };

  const isLastSlide = currentIndex === carouselData.length - 1;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
      >
        {carouselData.map((item, index) => (
          <View key={item.id} style={[styles.slide, { width: screenWidth }]}>
            <View style={[styles.slideContent, { backgroundColor: item.backgroundColor }]}>
              <View style={styles.imageContainer}>
                <ExpoImage
                  source={item.image}
                  style={styles.slideImage}
                  contentFit="contain"
                />
              </View>
              <View style={styles.textContainer}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>
                  {item.title}
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {item.subtitle}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Pagination Dots */}
      <View style={styles.paginationContainer}>
        {carouselData.map((_, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor: index === currentIndex ? colors.primary : colors.border,
              },
            ]}
            onPress={() => handleDotPress(index)}
          />
        ))}
      </View>

      {/* Get Started Button - Only show on last slide */}
      {isLastSlide && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.getStartedButton, { backgroundColor: colors.primary }]}
            onPress={handleGetStarted}
          >
            <Text style={[styles.getStartedText, { color: colors.surface }]}>
              Get Started
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  slide: {
    flex: 1,
    width: screenWidth,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideContent: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    maxHeight: screenHeight * 0.4,
  },
  slideImage: {
    width: Math.min(screenWidth * 0.6, 250),
    height: Math.min(screenWidth * 0.6, 250),
    maxHeight: screenHeight * 0.3,
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: Math.min(screenWidth * 0.06, 28),
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: Math.min(screenWidth * 0.07, 34),
  },
  subtitle: {
    fontSize: Math.min(screenWidth * 0.04, 16),
    textAlign: 'center',
    lineHeight: Math.min(screenWidth * 0.05, 24),
    paddingHorizontal: 20,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  buttonContainer: {
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  getStartedButton: {
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  getStartedText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
}); 