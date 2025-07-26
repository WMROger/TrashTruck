import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Image } from 'react-native';
const Swiper = require('react-native-swiper').default;
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');

const slides = [
  {
    key: 'slide1',
    title: 'Welcome to TrashTrack',
    text: "Here's a good place for a brief overview of the app or its key features.",
    image: require('@/assets/images/splash-icon.png'),
  },
  {
    key: 'slide2',
    title: 'Track Your Waste',
    text: 'Monitor and manage your waste efficiently with our easy-to-use tools.',
    image: require('@/assets/images/partial-react-logo.png'),
  },
  {
    key: 'slide3',
    title: 'Join the Clean Movement',
    text: 'Be a part of the solution. Clean with haste, know your waste!',
    image: require('@/assets/images/react-logo.png'),
  },
];

export default function SplashScreen() {
  const router = useRouter();
  const swiperRef = useRef(null);
  const [activeIndex, setActiveIndex] = React.useState(0);

  return (
    <View style={styles.container}>
      <Swiper
        ref={swiperRef}
        loop={false}
        showsPagination={true}
        onIndexChanged={setActiveIndex}
        activeDotColor={'#5B7C67'}
        dotColor={'#A9D6B5'}
      >
        {slides.map((slide, idx) => (
          <View style={styles.slide} key={slide.key}>
            <Image source={slide.image} style={styles.image} />
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.text}>{slide.text}</Text>
            {idx === slides.length - 1 && (
              <TouchableOpacity
                style={styles.button}
                onPress={() => router.replace('/')}
              >
                <Text style={styles.buttonText}>Continue</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </Swiper>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6FBF7',
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  image: {
    width: width * 0.7,
    height: height * 0.35,
    resizeMode: 'contain',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 16,
    textAlign: 'center',
  },
  text: {
    fontSize: 16,
    color: '#5B7C67',
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#5B7C67',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
}); 