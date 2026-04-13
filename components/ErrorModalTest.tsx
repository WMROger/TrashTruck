import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import ErrorModal from './ErrorModal';

export default function ErrorModalTest() {
  const [errorModal, setErrorModal] = useState({
    visible: false,
    title: 'Error',
    message: '',
    type: 'error' as 'error' | 'warning' | 'info' | 'success',
  });

  const showError = (message: string, title = 'Error', type: 'error' | 'warning' | 'info' | 'success' = 'error') => {
    setErrorModal({
      visible: true,
      title,
      message,
      type,
    });
  };

  const closeErrorModal = () => {
    setErrorModal(prev => ({ ...prev, visible: false }));
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Error Modal Test</Text>
        <Text style={styles.subtitle}>Test different types of error modals</Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.errorButton]}
            onPress={() => showError('This is an error message', 'Error', 'error')}
          >
            <Ionicons name="alert-circle" size={20} color="white" />
            <Text style={styles.buttonText}>Show Error</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.warningButton]}
            onPress={() => showError('This is a warning message', 'Warning', 'warning')}
          >
            <Ionicons name="warning" size={20} color="white" />
            <Text style={styles.buttonText}>Show Warning</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.infoButton]}
            onPress={() => showError('This is an info message', 'Information', 'info')}
          >
            <Ionicons name="information-circle" size={20} color="white" />
            <Text style={styles.buttonText}>Show Info</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.successButton]}
            onPress={() => showError('This is a success message', 'Success', 'success')}
          >
            <Ionicons name="checkmark-circle" size={20} color="white" />
            <Text style={styles.buttonText}>Show Success</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.longMessageButton]}
            onPress={() => showError(
              'This is a very long error message that demonstrates how the modal handles longer text content. It should wrap properly and maintain good readability.',
              'Long Message Test',
              'error'
            )}
          >
            <Ionicons name="document-text" size={20} color="white" />
            <Text style={styles.buttonText}>Show Long Message</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.actionButton]}
            onPress={() => setErrorModal({
              visible: true,
              title: 'Action Required',
              message: 'This modal has an action button. What would you like to do?',
              type: 'warning',
            })}
          >
            <Ionicons name="settings" size={20} color="white" />
            <Text style={styles.buttonText}>Show with Action</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Error Modal */}
      <ErrorModal
        visible={errorModal.visible}
        title={errorModal.title}
        message={errorModal.message}
        type={errorModal.type}
        onClose={closeErrorModal}
        autoClose={true}
        autoCloseDelay={4000}
        actionButton={errorModal.title === 'Action Required' ? {
          text: 'Take Action',
          onPress: () => {
            closeErrorModal();
            showError('Action completed!', 'Success', 'success');
          }
        } : undefined}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F5E8',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2f3a31',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b6b6b',
    textAlign: 'center',
    marginBottom: 40,
  },
  buttonContainer: {
    gap: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 12,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  errorButton: {
    backgroundColor: '#EF4444',
  },
  warningButton: {
    backgroundColor: '#F59E0B',
  },
  infoButton: {
    backgroundColor: '#3B82F6',
  },
  successButton: {
    backgroundColor: '#10B981',
  },
  longMessageButton: {
    backgroundColor: '#8B5CF6',
  },
  actionButton: {
    backgroundColor: '#6B7280',
  },
});
