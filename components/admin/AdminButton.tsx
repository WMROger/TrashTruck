import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

interface AdminButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}

export default function AdminButton({ title, onPress, variant = 'primary' }: AdminButtonProps) {
  return (
    <TouchableOpacity 
      style={[styles.button, variant === 'primary' ? styles.primaryButton : styles.secondaryButton]} 
      onPress={onPress}
    >
      <Text style={[styles.buttonText, variant === 'primary' ? styles.primaryButtonText : styles.secondaryButtonText]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 25,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#6B8E23',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#6B8E23',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  primaryButtonText: {
    color: 'white',
  },
  secondaryButtonText: {
    color: '#6B8E23',
  },
}); 