import { IconSymbol } from '@/components/ui/IconSymbol';
import { auth, db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { useRouter } from 'expo-router';
import { addDoc, collection } from 'firebase/firestore';
import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function FeedbackScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const colors = Colors[theme ?? 'light'];
  const [selected, setSelected] = useState<number | null>(null);
  const [text, setText] = useState('');

  const sentiments = [
    { label: 'Terrible', emoji: '😣' },
    { label: 'Bad', emoji: '😕' },
    { label: 'Good', emoji: '😊' },
    { label: 'Loved it', emoji: '😍' },
  ];

  // Upload feedback to Firestore
  const handleSendFeedback = async () => {
    if (selected === null || !text.trim()) {
      alert('Please select a rating and enter your feedback.');
      return;
    }
    const rating = sentiments[selected].label;
    try {
      await addDoc(collection(db, 'feedback'), {
        rating,
        description: text,
        userId: auth.currentUser?.uid,
        createdAt: new Date().toISOString(),
      });
      alert('Thank you for your feedback!');
      setSelected(null);
      setText('');
    } catch (err) {
      alert('Failed to send feedback. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.curveHeader}>
        {/* Header with back button */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={24} color="#666" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Feedback and Rating</Text>
        </View>
        
        {/* Main content - no card, blends with background */}
        <View style={styles.content}>
          <Text style={styles.title}>Send us your feedback</Text>
          <Text style={styles.subtitle}>
            Do you know have a suggestion or had any problem?{'\n'}
            Let us know in the fields below.
          </Text>

          {/* Wave container for question and reactions */}
          <View style={styles.waveSection}>
            <Text style={styles.question}>How was your experience?</Text>

            <View style={styles.row}> 
              {sentiments.map((s, idx) => {
                const active = selected === idx;
                return (
                  <TouchableOpacity
                    key={s.label}
                    style={[styles.reaction, active && styles.reactionActive]}
                    onPress={() => setSelected(idx)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.reactionEmoji}>{s.emoji}</Text>
                    <Text style={styles.reactionLabel}>{s.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              placeholder="Please leave your feedback below"
              placeholderTextColor="#999"
              style={styles.input}
            />

            <TouchableOpacity
              style={styles.button}
              onPress={handleSendFeedback}
            >
              <Text style={styles.buttonText}>Send feedback</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F5E8',
  },
  curveHeader: {
    flex: 1,
    backgroundColor: '#E8F5E8',
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 15,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  waveSection: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
    marginTop: 40,
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    textAlign: 'left',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'left',
    lineHeight: 20,
    marginBottom: 20,
  },
  question: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 40,
    paddingHorizontal: 10,
  },
  reaction: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 70,
  },
  reactionActive: {
    backgroundColor: '#F0F8F0',
    borderColor: '#4CAF50',
  },
  reactionEmoji: {
    fontSize: 32,
    marginBottom: 6,
  },
  reactionLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  input: {
    height: 120,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 15,
    marginBottom: 30,
    textAlignVertical: 'top',
    backgroundColor: '#FFFFFF',
    fontSize: 14,
    color: '#333',
  },
  button: {
    height: 50,
    backgroundColor: '#6B8E6B',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});


