import { auth, db, storage } from '@/config/firebase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { addDoc, collection } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Alert, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function ReportScreen() {
  const [title, setTitle] = useState('');
  const [barangay, setBarangay] = useState('');
  const [street, setStreet] = useState('');
  const [landmark, setLandmark] = useState('');
  const [description, setDescription] = useState('');
  const [showBarangay, setShowBarangay] = useState(false);
  const [showLandmark, setShowLandmark] = useState(false);
  const brgyAnchorRef = useRef<any>(null);
  const landmarkAnchorRef = useRef<any>(null);
  const [brgyPortalRect, setBrgyPortalRect] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const [landmarkPortalRect, setLandmarkPortalRect] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Debug function to check Firebase configuration
  const checkFirebaseConfig = () => {
    console.log('=== Firebase Configuration Check ===');
    console.log('Auth available:', !!auth);
    console.log('DB available:', !!db);
    console.log('Storage available:', !!storage);
    console.log('Current user:', auth?.currentUser?.uid);
    console.log('Storage bucket:', storage?._delegate?._host || 'Not available');
    console.log('=====================================');
  };

  // Test function to verify Firebase Storage
  const testStorageConnection = async () => {
    if (!storage || !auth.currentUser) {
      Alert.alert('Error', 'Firebase Storage or user not available');
      return;
    }

    try {
      console.log('Testing Firebase Storage connection...');
      const testRef = ref(storage, `test/${auth.currentUser.uid}/test.txt`);
      const testBlob = new Blob(['test'], { type: 'text/plain' });
      
      await uploadBytes(testRef, testBlob);
      const downloadURL = await getDownloadURL(testRef);
      
      console.log('Storage test successful!', downloadURL);
      Alert.alert('Success', 'Firebase Storage is working correctly!');
    } catch (error) {
      console.error('Storage test failed:', error);
      
      // Check if it's a CORS error
      if (error instanceof Error && error.message.includes('CORS')) {
        Alert.alert(
          'CORS Error', 
          'Firebase Storage is blocked by CORS policy. This is common in development. Reports will be saved without images for now.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', `Storage test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };
  
  const BARANGAYS = useMemo(() => [
    'Sambag 2',
  ], []);

  const LANDMARKS = useMemo(() => [
    'Barangay Hall', 'Market', 'Church', 'School', 'Park', 'Main Road',
  ], []);

  // Function to upload image to Firebase Storage
  const uploadImageToStorage = async (uri: string): Promise<string | null> => {
    if (!storage) {
      console.error('Firebase Storage not available');
      throw new Error('Firebase Storage not available');
    }
    
    if (!auth.currentUser) {
      console.error('User not authenticated');
      throw new Error('User not authenticated');
    }

    try {
      console.log('Uploading image with URI:', uri);
      
      // Create a unique filename
      const timestamp = Date.now();
      const filename = `reports/${auth.currentUser.uid}/${timestamp}.jpg`;
      console.log('Uploading to path:', filename);
      
      // Create a reference to the file
      const imageRef = ref(storage, filename);
      
      // Convert URI to blob for upload
      console.log('Fetching image data...');
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      
      const blob = await response.blob();
      console.log('Image blob size:', blob.size, 'bytes');
      
      // Check if image is too large (Firestore field limit is ~1MB)
      if (blob.size > 1000000) { // 1MB limit
        throw new Error('Image too large. Please choose a smaller image.');
      }
      
      // Upload the file with timeout
      console.log('Uploading to Firebase Storage...');
      const uploadPromise = uploadBytes(imageRef, blob);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Upload timeout')), 10000)
      );
      
      const uploadTask = await Promise.race([uploadPromise, timeoutPromise]) as any;
      console.log('Upload completed:', uploadTask.metadata);
      
      // Get the download URL
      console.log('Getting download URL...');
      const downloadURL = await getDownloadURL(uploadTask.ref);
      console.log('Download URL obtained:', downloadURL);
      
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      
      // Check if it's a CORS error or timeout
      if (error instanceof Error && (
        error.message.includes('CORS') || 
        error.message.includes('Access to XMLHttpRequest') ||
        error.message.includes('preflight request') ||
        error.message.includes('ERR_FAILED') ||
        error.message.includes('blocked by CORS policy') ||
        error.message.includes('Upload timeout')
      )) {
        console.warn('CORS or timeout error detected - Firebase Storage blocked in development');
        throw new Error('CORS_ERROR');
      }
      
      throw error;
    }
  };
  
  const handleSendReport = async () => {
    // Debug Firebase configuration
    checkFirebaseConfig();
    
    if (!auth.currentUser?.uid) {
      Alert.alert('Error', 'You must be signed in to submit a report.');
      return;
    }
    if (!title.trim() || !barangay.trim() || !street.trim() || !description.trim()) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      let imageURL = null;
      
      // Upload image to Firebase Storage if available
      if (imageUri) {
        try {
          console.log('Uploading image to Firebase Storage...');
          setUploadProgress(25);
          
          // Check if we're in development mode (web) and skip upload
          if (Platform.OS === 'web' && window.location.hostname === 'localhost') {
            console.warn('Skipping image upload in development mode due to CORS restrictions');
            Alert.alert(
              'Development Mode', 
              'Image upload is disabled in development mode due to CORS restrictions. Your report will be submitted without the photo.',
              [{ text: 'OK' }]
            );
            imageURL = null;
            setUploadProgress(75);
          } else {
            imageURL = await uploadImageToStorage(imageUri);
            setUploadProgress(75);
            console.log('Image uploaded successfully:', imageURL);
          }
        } catch (uploadError) {
          console.warn('Image upload failed, proceeding without image:', uploadError);
          
          // Show user-friendly error message for specific cases
          if (uploadError instanceof Error) {
            if (uploadError.message.includes('too large')) {
              Alert.alert(
                'Image Too Large', 
                'The selected image is too large. Please choose a smaller image or submit without a photo.',
                [
                  { text: 'Submit Without Photo', onPress: () => {} },
                  { text: 'Choose Different Image', onPress: () => pickImage() }
                ]
              );
            } else if (uploadError.message.includes('CORS_ERROR') || 
                      uploadError.message.includes('CORS') || 
                      uploadError.message.includes('ERR_FAILED') ||
                      uploadError.message.includes('blocked by CORS policy')) {
              Alert.alert(
                'Upload Issue', 
                'Image upload is not available in development mode. Your report will be submitted without the photo.',
                [{ text: 'OK' }]
              );
            } else {
              // Generic error message for other upload failures
              Alert.alert(
                'Upload Issue', 
                'Image upload failed. Your report will be submitted without the photo.',
                [{ text: 'OK' }]
              );
            }
          }
          
          // If upload fails, proceed without image rather than failing the entire report
          imageURL = null;
        }
      } else {
        imageURL = null;
      }

      // Submit the report with or without image URL
      console.log('Submitting report to Firestore...');
      console.log('Image URL to be saved:', imageURL);
      console.log('Current user UID:', auth.currentUser.uid);
      console.log('DB available:', !!db);
      console.log('Proceeding with report submission...');
      
      const reportData = {
        title,
        barangay,
        street,
        landmark,
        description,
        imageURL: imageURL || null, // Always include imageURL field, even if null
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email || '',
        createdAt: new Date().toISOString(),
        status: 'pending', // Add status for admin management
      };
      
      console.log('Report data to be saved:', reportData);
      console.log('User ID matches auth UID:', reportData.userId === auth.currentUser.uid);
      
      try {
        const docRef = await addDoc(collection(db, 'reports'), reportData);
        console.log('Report created with ID:', docRef.id);
      } catch (firestoreError) {
        console.error('Firestore error:', firestoreError);
        throw firestoreError;
      }

      setUploadProgress(100);
      console.log('Report submitted successfully!');
      
      // Show success message
      Alert.alert('Success', 'Report submitted successfully!');
      
      // Reset form
      setTitle('');
      setBarangay('');
      setStreet('');
      setLandmark('');
      setDescription('');
      setImageUri(null);
      
    } catch (err) {
      console.error('Report submission error:', err);
      Alert.alert('Error', `Failed to submit report: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Helper function to submit report without image
  const submitReportWithoutImage = async () => {
    try {
      await addDoc(collection(db, 'reports'), {
        title,
        barangay,
        street,
        landmark,
        description,
        imageURL: null,
        userId: auth.currentUser?.uid,
        userEmail: auth.currentUser?.email || '',
        createdAt: new Date().toISOString(),
        status: 'pending',
      });

      Alert.alert('Success', 'Report submitted successfully without image!');
      
      // Reset form
      setTitle('');
      setBarangay('');
      setStreet('');
      setLandmark('');
      setDescription('');
      setImageUri(null);
      
    } catch (err) {
      console.error('Report submission error:', err);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5, // Reduced quality to reduce file size
      aspect: [4, 3], // Fixed aspect ratio for consistency
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };


  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color="#234033" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report a Trash Pile</Text>
      </View>

      <Text style={styles.helperText}>
        Help us keep our barangay clean, healthy, and safe! Use this form to report any uncollected trash or illegal dumping in your area.
      </Text>

      {/* Title */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Title <Text style={styles.required}>*</Text></Text>
        <Text style={styles.sublabel}>What you're reporting?</Text>
        <View style={styles.inputField}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Title"
            placeholderTextColor="#7C8E80"
            style={styles.inputText}
          />
        </View>
      </View>

      {/* Location */}
      <View style={styles.fieldGroup}>
        <Text style={styles.sectionTitle}>Location of the Trash Pile</Text>

        {/* Barangay dropdown */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Barangay <Text style={styles.required}>*</Text></Text>
          <View style={[styles.dropdownContainer, showBarangay ? styles.dropdownContainerOpen : null]} ref={brgyAnchorRef}>
            <TouchableOpacity
              style={styles.inputField}
              onPress={() => {
                const next = !showBarangay;
                setShowBarangay(next);
                if (Platform.OS === 'web' && next && brgyAnchorRef.current?.getBoundingClientRect) {
                  const rect = brgyAnchorRef.current.getBoundingClientRect();
                  setBrgyPortalRect({ top: rect.bottom, left: rect.left, width: rect.width });
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.inputText, barangay ? undefined : styles.placeholder]}>
                {barangay || 'Barangay'}
              </Text>
              <Ionicons name={showBarangay ? 'chevron-up' : 'chevron-down'} size={18} color="#4B5F4F" />
            </TouchableOpacity>
            {showBarangay && (
              Platform.OS === 'web'
                ? createPortal(
                    <View style={[styles.dropdownPanelPortal, { top: brgyPortalRect.top, left: brgyPortalRect.left, width: brgyPortalRect.width }] }>
                      {BARANGAYS.map((b) => (
                        <TouchableOpacity key={b} style={styles.dropdownItem} onPress={() => { setBarangay(b); setShowBarangay(false); }}>
                          <Text style={styles.dropdownText}>{b}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>,
                    document.body
                  )
                : (
                  <View style={styles.dropdownPanel}>
                    {BARANGAYS.map((b) => (
                      <TouchableOpacity key={b} style={styles.dropdownItem} onPress={() => { setBarangay(b); setShowBarangay(false); }}>
                        <Text style={styles.dropdownText}>{b}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )
            )}
          </View>
        </View>

        {/* Street input */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Street <Text style={styles.required}>*</Text></Text>
          <View style={styles.inputField}>
            <TextInput
              value={street}
              onChangeText={setStreet}
              placeholder="Street name or purok/sitio"
              placeholderTextColor="#7C8E80"
              style={styles.inputText}
            />
          </View>
        </View>

        {/* Landmark dropdown */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Landmark</Text>
          <View style={[styles.dropdownContainer, showLandmark ? styles.dropdownContainerOpen : null]} ref={landmarkAnchorRef}>
            <TouchableOpacity
              style={styles.inputField}
              onPress={() => {
                const next = !showLandmark;
                setShowLandmark(next);
                if (Platform.OS === 'web' && next && landmarkAnchorRef.current?.getBoundingClientRect) {
                  const rect = landmarkAnchorRef.current.getBoundingClientRect();
                  setLandmarkPortalRect({ top: rect.bottom, left: rect.left, width: rect.width });
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.inputText, landmark ? undefined : styles.placeholder]}>
                {landmark || 'Nearby landmarks'}
              </Text>
              <Ionicons name={showLandmark ? 'chevron-up' : 'chevron-down'} size={18} color="#4B5F4F" />
            </TouchableOpacity>
            {showLandmark && (
              Platform.OS === 'web'
                ? createPortal(
                    <View style={[styles.dropdownPanelPortal, { top: landmarkPortalRect.top, left: landmarkPortalRect.left, width: landmarkPortalRect.width }] }>
                      {LANDMARKS.map((l) => (
                        <TouchableOpacity key={l} style={styles.dropdownItem} onPress={() => { setLandmark(l); setShowLandmark(false); }}>
                          <Text style={styles.dropdownText}>{l}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>,
                    document.body
                  )
                : (
                  <View style={styles.dropdownPanel}>
                    {LANDMARKS.map((l) => (
                      <TouchableOpacity key={l} style={styles.dropdownItem} onPress={() => { setLandmark(l); setShowLandmark(false); }}>
                        <Text style={styles.dropdownText}>{l}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )
            )}
          </View>
        </View>
      </View>

      {/* Description */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Description of Trash <Text style={styles.required}>*</Text></Text>
        <Text style={styles.sublabel}>What do you see? Please describe the type and amount of trash.</Text>
        <View style={styles.textArea}>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder=""
            placeholderTextColor="#7C8E80"
            style={styles.textAreaInput}
            multiline
          />
        </View>
      </View>

      {/* Photo upload placeholder */}
      <TouchableOpacity style={styles.photoCard} onPress={pickImage}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={{ width: 100, height: 100, borderRadius: 12 }} />
      ) : (
        <>
          <Ionicons name="camera" size={28} color="#234033" />
          <Text style={styles.photoText}>Add photo</Text>
        </>
      )}
      </TouchableOpacity>


      {/* Upload Progress */}
      {isUploading && (
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            {uploadProgress < 25 ? 'Preparing...' : 
             uploadProgress < 75 ? 'Uploading image...' : 
             'Submitting report...'}
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
          </View>
        </View>
      )}

      {/* Submit */}
      <TouchableOpacity 
        style={[styles.submitBtn, isUploading && styles.submitBtnDisabled]} 
        activeOpacity={0.8} 
        onPress={handleSendReport}
        disabled={isUploading}
      >
        <Text style={styles.submitText}>
          {isUploading ? 'Submitting...' : 'Send report'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ECF8ED' },
  content: { padding: 26, paddingBottom: 24, paddingTop: 64 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DDEEDB',
    borderWidth: 1,
    borderColor: '#C8D8CA',
    marginRight: 8,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#234033' },
  helperText: { fontSize: 12, color: '#4B5F4F', marginBottom: 12 },

  fieldGroup: { marginBottom: 14, position: 'relative', zIndex: 0 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#234033', marginBottom: 6 },
  label: { fontSize: 12, fontWeight: '700', color: '#234033' },
  sublabel: { fontSize: 10, color: '#4B5F4F', marginBottom: 6 },
  required: { color: '#FF4444', fontWeight: '700' },

  inputField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7FBF7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#C8D8CA',
    marginTop: 6,
  },
  inputText: { flex: 1, fontSize: 12, color: '#234033' },
  placeholder: { color: '#7C8E80' },

  dropdownPanel: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#C8D8CA',
    borderRadius: 8,
    overflow: 'hidden',
    zIndex: 2147483647,
    elevation: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    pointerEvents: 'auto',
  },
  dropdownPanelPortal: {
    position: 'fixed',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#C8D8CA',
    borderRadius: 8,
    overflow: 'hidden',
    zIndex: 2147483647,
    boxShadow: '0 6px 12px rgba(0,0,0,0.15)'
  } as any,
  dropdownContainer: { position: 'relative' },
  dropdownContainerOpen: { zIndex: 2147483647, elevation: 100 },
  dropdownItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEF3EE' },
  dropdownText: { fontSize: 12, color: '#234033' },

  textArea: {
    backgroundColor: '#F7FBF7',
    borderRadius: 8,
    padding: 12,
    minHeight: 88,
    borderWidth: 1,
    borderColor: '#C8D8CA',
    marginTop: 6,
    position: 'relative',
    zIndex: 0,
  },
  textAreaInput: { fontSize: 12, color: '#234033' },

  photoCard: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
    borderRadius: 12,
    backgroundColor: '#F0F6F0',
    borderWidth: 1,
    borderColor: '#C8D8CA',
    marginBottom: 14,
    position: 'relative',
    zIndex: 0,
  },
  photoText: { marginTop: 8, fontSize: 12, color: '#234033', fontWeight: '600' },

  submitBtn: {
    alignSelf: 'center',
    backgroundColor: '#4E6E58',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
  },
  submitBtnDisabled: {
    backgroundColor: '#A0A0A0',
    opacity: 0.6,
  },
  submitText: { color: 'white', fontWeight: '700' },
  
  progressContainer: {
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  progressText: {
    fontSize: 12,
    color: '#4B5F4F',
    textAlign: 'center',
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4E6E58',
    borderRadius: 2,
  },
});


