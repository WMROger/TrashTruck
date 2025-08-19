import { Colors } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function FeedbackScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme ?? 'light'];
  const [selected, setSelected] = useState<number | null>(null);
  const [text, setText] = useState('');

  const sentiments = [
    { label: 'Terrible', emoji: '😠' },
    { label: 'Bad', emoji: '🙁' },
    { label: 'Good', emoji: '🙂' },
    { label: 'Loved it', emoji: '😍' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      {/* Curved header mimic */}
      <View style={styles.curveHeader} />
      <View style={styles.content}> 
        <Text style={[styles.title, { color: colors.textPrimary }]}>Send us your feedback</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Do you have suggestions or had any problem?</Text>

        <Text style={[styles.question, { color: colors.textSecondary }]}>How was your experience?</Text>

        <View style={styles.row}> 
          {sentiments.map((s, idx) => {
            const active = selected === idx;
            return (
              <TouchableOpacity
                key={s.label}
                style={[styles.reaction, active && { borderColor: colors.primary, backgroundColor: colors.surface }]}
                onPress={() => setSelected(idx)}
                activeOpacity={0.8}
              >
                <Text style={styles.reactionEmoji}>{s.emoji}</Text>
                <Text style={[styles.reactionLabel, { color: colors.textSecondary }]}>{s.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          placeholder="Please leave your feedback below"
          placeholderTextColor={colors.textTertiary}
          style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surface }]}
        />

        <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]}>
          <Text style={styles.buttonText}>Send feedback</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  curveHeader: {
    height: 180,
    backgroundColor: '#CFE7CF',
    borderBottomLeftRadius: 80,
    borderBottomRightRadius: 80,
  },
  content: {
    marginTop: -60,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 4,
  },
  question: {
    marginTop: 24,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  reaction: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  reactionEmoji: {
    fontSize: 26,
  },
  reactionLabel: {
    marginTop: 4,
    fontSize: 12,
  },
  input: {
    height: 120,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    textAlignVertical: 'top',
  },
  button: {
    marginTop: 16,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
});


