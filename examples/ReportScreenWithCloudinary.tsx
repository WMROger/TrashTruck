import { auth, db } from '@/config/firebase';
import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection } from 'firebase/firestore';
import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CloudinaryImagePicker } from '../components/ImagePicker';
import { UploadResult } from '../services/cloudinaryService';

/**
 * Example of how to refactor your existing report screen to use Cloudinary
 * This replaces Firebase Storage with Cloudinary for image uploads
 */
export default function ReportScreenWithCloudinary() {
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
  
  // Cloudinary-specific state (much simpler than Firebase Storage!)
  const [uploadedImage, setUploadedImage] = useState<UploadResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const BARANGAYS = useMemo(() => [
    'Sambag 2',
  ], []);

  const LANDMARKS = useMemo(() => [
    'Barangay Hall', 'Market', 'Church', 'School', 'Park', 'Main Road',
  ], []);

  // Handle image upload with Cloudinary (much simpler!)
  const handleImageUpload = (result: UploadResult) => {
    if (result.success) {
      setUploadedImage(result);
      console.log('Image uploaded to Cloudinary:', result.url);
    } else {
      Alert.alert('Upload Failed', result.error || 'Failed to upload image');
    }
  };

  // Submit report - much cleaner without Firebase Storage complexity!
  const handleSendReport = async () => {
    if (!auth.currentUser?.uid) {
      Alert.alert('Error', 'You must be signed in to submit a report.');
      return;
    }
    if (!title.trim() || !barangay.trim() || !street.trim() || !description.trim()) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare report data
      const reportData = {
        title,
        barangay,
        street,
        landmark,
        description,
        // Cloudinary URL is ready to use immediately!
        imageURL: uploadedImage?.url || null,
        imagePublicId: uploadedImage?.publicId || null, // Store for future operations
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email || '',
        createdAt: new Date().toISOString(),
        status: 'pending',
      };

      console.log('Submitting report with Cloudinary image:', reportData);

      // Save to Firestore
      const docRef = await addDoc(collection(db, 'reports'), reportData);
      console.log('Report created with ID:', docRef.id);

      // Show success message
      Alert.alert('Success', 'Report submitted successfully!');

      // Reset form
      setTitle('');
      setBarangay('');
      setStreet('');
      setLandmark('');
      setDescription('');
      setUploadedImage(null);

    } catch (err) {
      console.error('Report submission error:', err);
      Alert.alert('Error', `Failed to submit report: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color="#234033" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report a Trash Pile (Cloudinary)</Text>
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

      {/* Cloudinary Image Upload - Much cleaner! */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Photo Evidence</Text>
        <Text style={styles.sublabel}>Upload a photo to help us understand the situation better.</Text>
        <CloudinaryImagePicker
          onImageSelected={handleImageUpload}
          folder="REPORTS"
          placeholder="Tap to add photo"
          currentImageUrl={uploadedImage?.url}
          showPreview={true}
          style={styles.imagePicker}
          disabled={isSubmitting}
        />
        {uploadedImage && (
          <Text style={styles.uploadSuccess}>
            ✅ Image uploaded successfully!
          </Text>
        )}
      </View>

      {/* Submit */}
      <TouchableOpacity 
        style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]} 
        activeOpacity={0.8} 
        onPress={handleSendReport}
        disabled={isSubmitting}
      >
        <Text style={styles.submitText}>
          {isSubmitting ? 'Submitting...' : 'Send report'}
        </Text>
      </TouchableOpacity>

      {/* Benefits Note */}
      <View style={styles.benefitsNote}>
        <Text style={styles.benefitsTitle}>Cloudinary Benefits:</Text>
        <Text style={styles.benefitsText}>
          • No CORS issues in development{'\n'}
          • Automatic image optimization{'\n'}
          • Built-in transformations{'\n'}
          • Reliable CDN delivery{'\n'}
          • Much simpler upload flow{'\n'}
          • Better error handling
        </Text>
      </View>
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

  imagePicker: {
    minHeight: 150,
  },
  uploadSuccess: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },

  submitBtn: {
    alignSelf: 'center',
    backgroundColor: '#4E6E58',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
    marginTop: 10,
  },
  submitBtnDisabled: {
    backgroundColor: '#A0A0A0',
    opacity: 0.6,
  },
  submitText: { color: 'white', fontWeight: '700' },

  benefitsNote: {
    backgroundColor: '#E8F5E8',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  benefitsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 8,
  },
  benefitsText: {
    fontSize: 12,
    color: '#388E3C',
    lineHeight: 18,
  },
});
