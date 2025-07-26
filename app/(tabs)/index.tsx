import { Image } from 'expo-image';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';

export default function AuthenticationPage() {
  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/splash-icon.png')} 
        style={styles.backgroundImage}
        contentFit="cover"
        blurRadius={1}
      />
      <View style={styles.overlay} />
      <View style={styles.content}>
        <Text style={styles.slogan}>Know the Waste, Clean with Haste.</Text>
        <Image
          source={require('@/assets/images/icon.png')} 
          style={styles.logo}
        />
        <View style={styles.buttonGroup}>
          <TouchableOpacity style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Login</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Create an account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101010',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    zIndex: 0,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.5)',
    zIndex: 1,
  },
  content: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end', // Move content to the top
    paddingBottom: 180, // Add top padding
    zIndex: 2,
  },
  slogan: {
    color: '#5B7C67',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'left',
    alignSelf: 'flex-start',
    marginLeft: 32,
    marginBottom: 24,
  },
  logo: {
    width: 260,
    height: 100,
    resizeMode: 'contain',
    marginBottom: 32,
  },
  buttonGroup: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  primaryButton: {
    backgroundColor: '#A9D6B5',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '80%',
    alignItems: 'center',
    marginBottom: 0,
  },
  primaryButtonText: {
    color: '#222',
    fontWeight: 'bold',
    fontSize: 16,
  },
  secondaryButton: {
    borderColor: '#A9D6B5',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '80%',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    color: '#222',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
