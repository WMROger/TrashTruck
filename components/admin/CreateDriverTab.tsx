import { getAuth } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db, functions } from '../../config/firebase';

const CreateDriverTab: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const handleCreate = async () => {
    const trimmedUsername = (username || '').trim();
    const trimmedPassword = (password || '').trim();
    if (!trimmedUsername || !trimmedPassword) {
      Alert.alert('Missing fields', 'Please provide both username and password.');
      return;
    }
    if (!functions) {
      Alert.alert('Unavailable', 'Cloud Functions are not available in this environment.');
      return;
    }
    try {
      setIsBusy(true);
      let uid: string | undefined;
      let email: string | undefined;
      try {
        const callable = httpsCallable(functions, 'createDriverAccount');
        const res: any = await callable({ username: trimmedUsername, password: trimmedPassword });
        uid = res?.data?.uid;
        email = res?.data?.email;
      } catch (err) {
        // Fallback to HTTP endpoint with ID token
        const auth = getAuth();
        const token = await auth?.currentUser?.getIdToken?.();
        const resp = await fetch('https://us-central1-trashtruck-swu-98ce9.cloudfunctions.net/createDriverAccountHttp', {
          method: 'POST',
          mode: 'cors',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ username: trimmedUsername, password: trimmedPassword }),
        });
        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(text || 'HTTP fallback failed');
        }
        const data = await resp.json();
        uid = data?.uid;
        email = data?.email;
      }
      if (db && uid) {
        try {
          await setDoc(doc(db, 'users', uid), {
            uid,
            email: email || `${trimmedUsername}@driver.com`,
            role: 'driver',
            provider: 'password',
            verified: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }, { merge: true });
        } catch {}
      }
      Alert.alert('Success', `Driver account created: ${email || trimmedUsername}`);
      setUsername('');
      setPassword('');
    } catch (e: any) {
      const message = e?.message || 'Failed to create driver account';
      Alert.alert('Error', message);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Driver Account</Text>
      <View style={styles.field}> 
        <Text style={styles.label}>Username</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="e.g. juan.driver"
          autoCapitalize="none"
        />
      </View>
      <View style={styles.field}> 
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Enter password"
          secureTextEntry
        />
      </View>
      <TouchableOpacity
        onPress={handleCreate}
        disabled={isBusy}
        style={[styles.button, isBusy && styles.buttonDisabled]}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>{isBusy ? 'Creating...' : 'Create Driver'}</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>The account will be created with role "driver". Login with the same username at the normal login screen.</Text>
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


