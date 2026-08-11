import { httpsCallable } from 'firebase/functions';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { functions } from '../../config/firebase';
import ErrorModal from '../ErrorModal';

const CreateDriverTab: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [errorModal, setErrorModal] = useState({
    visible: false,
    title: 'Error',
    message: '',
    type: 'error' as 'error' | 'warning' | 'info' | 'success',
  });

  // Show error modal
  const showError = (message: string, title = 'Error', type: 'error' | 'warning' | 'info' | 'success' = 'error') => {
    setErrorModal({
      visible: true,
      title,
      message,
      type,
    });
  };

  // Close error modal
  const closeErrorModal = () => {
    setErrorModal(prev => ({ ...prev, visible: false }));
  };

  const handleCreate = async () => {
    const trimmedUsername = (username || '').trim();
    const trimmedPassword = (password || '').trim();
    if (!trimmedUsername || !trimmedPassword || !fullName.trim() || !employeeId.trim() || !licenseNumber.trim()) {
      showError('Email, full name, password, employee ID, and license number are required.', 'Missing Fields', 'warning');
      return;
    }
    if (!functions) {
      showError('Cloud Functions are not available in this environment.', 'Service Unavailable', 'error');
      return;
    }
    try {
      setIsBusy(true);
      const callable = httpsCallable(functions, 'provisionDriver');
      const res: any = await callable({
        mode: 'create',
        email: trimmedUsername,
        password: trimmedPassword,
        fullName: fullName.trim(),
        employeeId: employeeId.trim(),
        licenseNumber: licenseNumber.trim(),
      });
      const email = res?.data?.email;
      showError(`Driver account created: ${email || trimmedUsername}`, 'Success', 'success');
      setUsername('');
      setPassword('');
      setFullName('');
      setEmployeeId('');
      setLicenseNumber('');
    } catch (e: any) {
      const message = e?.message || 'Failed to create driver account';
      showError(message, 'Creation Error', 'error');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Driver Account</Text>
      <View style={styles.field}> 
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="e.g. juan.driver@example.com"
          autoCapitalize="none"
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Full Name</Text>
        <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Juan Dela Cruz" />
      </View>
      <View style={styles.field}> 
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="At least 12 characters"
          secureTextEntry
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Employee ID</Text>
        <TextInput style={styles.input} value={employeeId} onChangeText={setEmployeeId} placeholder="CENRO-2026-001" autoCapitalize="characters" />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>License Number</Text>
        <TextInput style={styles.input} value={licenseNumber} onChangeText={setLicenseNumber} placeholder="N01-23-456789" autoCapitalize="characters" />
      </View>
      <TouchableOpacity
        onPress={handleCreate}
        disabled={isBusy}
        style={[styles.button, isBusy && styles.buttonDisabled]}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>{isBusy ? 'Creating...' : 'Create Driver'}</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>The protected server workflow creates the account, reserves the employee ID, and assigns the driver role.</Text>

      {/* Error Modal */}
      <ErrorModal
        visible={errorModal.visible}
        title={errorModal.title}
        message={errorModal.message}
        type={errorModal.type}
        onClose={closeErrorModal}
        autoClose={true}
        autoCloseDelay={4000}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#E3F0E3',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#8FB497',
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#242E21',
    marginBottom: 12,
  },
  field: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: '#234033',
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dfe9df',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  button: {
    backgroundColor: '#234033',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    color: '#4A5A49',
    marginTop: 10,
  },
});

export default CreateDriverTab;


