import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function ChangePasswordScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Change Password</Text>
      <Text style={styles.subtitle}>This feature is coming soon!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});
