import { IconSymbol } from "@/components/ui/IconSymbol";
import { UPLOAD_PRESETS } from "@/config/cloudinary";
import { auth, db, storage } from "@/config/firebase";
import {
  cloudinaryService,
  UPLOAD_FOLDERS,
} from "@/services/cloudinaryService";
import { analyzeWasteImage, WasteAnalysisResult } from "@/services/wasteAIService";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { addDoc, collection, doc, getDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import React, { useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker } from "@/components/MapView";

export default function ReportScreen() {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [barangay, setBarangay] = useState("");
  const [street, setStreet] = useState("");
  const [landmark, setLandmark] = useState("");
  const [description, setDescription] = useState("");
  const [showBarangay, setShowBarangay] = useState(false);
  const [showLandmark, setShowLandmark] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [locationAddress, setLocationAddress] = useState<string>("Locating...");
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [aiResult, setAiResult] = useState<WasteAnalysisResult | null>(null);
  const [userProfileBarangay, setUserProfileBarangay] = useState("");
  const MAX_FIRESTORE_FIELD_BYTES = 1000000; // ~1MB safe cap

  React.useEffect(() => {
    const fetchUserProfile = async () => {
      if (auth.currentUser) {
        try {
          const userRef = doc(db, 'users', auth.currentUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.barangay) {
              setUserProfileBarangay(data.barangay);
              setBarangay(data.barangay); // Initialize input with profile barangay
            }
          }
        } catch (err) {
          console.error("Error fetching user profile:", err);
        }
      }
    };
    fetchUserProfile();
  }, []);

  // Debug function to check Firebase configuration
  const checkFirebaseConfig = () => {
    console.log("=== Firebase Configuration Check ===");
    console.log("Auth available:", !!auth);
    console.log("DB available:", !!db);
    console.log("Storage available:", !!storage);
    console.log("Current user:", auth?.currentUser?.uid);
    console.log(
      "Storage bucket:",
      storage?._delegate?._host || "Not available"
    );
    console.log("=====================================");
  };

  // Enhanced error handling for Firestore operations
  const handleFirestoreError = (error: any, operation: string) => {
    console.error(`Firestore ${operation} error:`, error);

    if (error?.code === "unavailable") {
      Alert.alert(
        "Connection Error",
        "Unable to connect to the server. Please check your internet connection and try again.",
        [{ text: "OK" }]
      );
    } else if (error?.code === "permission-denied") {
      Alert.alert(
        "Permission Error",
        "You don't have permission to perform this action. Please contact support.",
        [{ text: "OK" }]
      );
    } else if (
      error?.message?.includes("QUIC") ||
      error?.message?.includes("protocol")
    ) {
      Alert.alert(
        "Network Error",
        "Network connection issue detected. Please try again in a moment.",
        [{ text: "OK" }]
      );
    } else {
      Alert.alert(
        "Error",
        `Failed to ${operation}: ${error?.message || "Unknown error"}`,
        [{ text: "OK" }]
      );
    }
  };

  // Test function to verify Firebase Storage
  const testStorageConnection = async () => {
    if (!storage || !auth.currentUser) {
      Alert.alert("Error", "Firebase Storage or user not available");
      return;
    }

    try {
      console.log("Testing Firebase Storage connection...");
      const testRef = ref(storage, `test/${auth.currentUser.uid}/test.txt`);
      const testBlob = new Blob(["test"], { type: "text/plain" });

      await uploadBytes(testRef, testBlob);
      const downloadURL = await getDownloadURL(testRef);

      console.log("Storage test successful!", downloadURL);
      Alert.alert("Success", "Firebase Storage is working correctly!");
    } catch (error) {
      console.error("Storage test failed:", error);

      // Check if it's a CORS error
      if (error instanceof Error && error.message.includes("CORS")) {
        Alert.alert(
          "CORS Error",
          "Firebase Storage is blocked by CORS policy. This is common in development. Reports will be saved without images for now.",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert(
          "Error",
          `Storage test failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }
  };

  const BARANGAYS = useMemo(() => ["Sambag 2"], []);

  const LANDMARKS = useMemo(
    () => ["Barangay Hall", "Market", "Church", "School", "Park", "Main Road"],
    []
  );

  // Retry mechanism for Firestore operations
  const retryFirestoreOperation = async (
    operation: () => Promise<any>,
    maxRetries = 3,
    delay = 1000
  ) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        console.log(`Firestore operation attempt ${attempt} failed:`, error);

        if (attempt === maxRetries) {
          throw error;
        }

        // Check if it's a network-related error that might benefit from retry
        if (
          error?.message?.includes("QUIC") ||
          error?.message?.includes("protocol") ||
          error?.code === "unavailable"
        ) {
          console.log(`Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        } else {
          throw error; // Don't retry for non-network errors
        }
      }
    }
  };

  const handleSendReport = async () => {
    // Debug Firebase configuration
    checkFirebaseConfig();

    if (!auth.currentUser?.uid) {
      Alert.alert("Error", "You must be signed in to submit a report.");
      return;
    }
    if (!geoCoords) {
      Alert.alert("Location Required", "Please wait for your GPS location to be fetched before submitting.");
      return;
    }

    if (
      !title.trim() ||
      !barangay.trim() ||
      !street.trim() ||
      !description.trim()
    ) {
      Alert.alert("Error", "Please fill in all required fields.");
      return;
    }

    if (!imageUri) {
      Alert.alert("Photo Required", "Please take a photo of the waste before submitting.");
      return;
    }
    
    if (isAnalyzingAI) {
      Alert.alert("Please Wait", "The AI is currently analyzing your photo. Please wait a moment before submitting.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      let imageURL = null;

      // Upload image to Cloudinary if available
      if (imageUri) {
        try {
          setUploadProgress(25);
          const uploadResult = await cloudinaryService.uploadImage(imageUri, {
            folder: UPLOAD_FOLDERS.REPORTS,
            preset: UPLOAD_PRESETS.REPORTS,
          });
          if (uploadResult.success && uploadResult.url) {
            imageURL = uploadResult.url;
            setUploadProgress(75);
            console.log("Image uploaded to Cloudinary:", imageURL);
          } else {
            console.warn(
              "Image upload failed, proceeding without image:",
              uploadResult.error
            );
            Alert.alert(
              "Upload Issue",
              "Image upload failed. Your report will be submitted without the photo.",
              [{ text: "OK" }]
            );
            imageURL = null;
          }
        } catch (uploadError) {
          console.warn(
            "Image upload exception, proceeding without image:",
            uploadError
          );
          Alert.alert(
            "Upload Issue",
            "Image upload failed. Your report will be submitted without the photo.",
            [{ text: "OK" }]
          );
          imageURL = null;
        }
      } else {
        imageURL = null;
      }

      // Submit the report with or without image URL
      console.log("Submitting report to Firestore...");
      console.log("Image URL to be saved:", imageURL);
      console.log("Current user UID:", auth.currentUser.uid);
      console.log("DB available:", !!db);
      console.log("Proceeding with report submission...");

      const reportData = {
        title,
        barangay,
        street,
        landmark,
        description,
        imageURL: imageURL || null, // Always include imageURL field, even if null
        location: geoCoords,
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email || "",
        createdAt: new Date().toISOString(),
        status: "pending", // Add status for admin management
        aiAnalysis: aiResult ? {
          wasteType: aiResult.wasteType,
          estimatedWeight: aiResult.estimatedWeight,
          confidence: aiResult.confidence,
          details: aiResult.details,
        } : null,
      };

      console.log("Report data to be saved:", reportData);
      console.log(
        "User ID matches auth UID:",
        reportData.userId === auth.currentUser.uid
      );

      try {
        const docRef = await retryFirestoreOperation(async () => {
          return await addDoc(collection(db, "reports"), reportData);
        });
        console.log("Report created with ID:", docRef.id);
      } catch (firestoreError) {
        console.error("Firestore error:", firestoreError);
        handleFirestoreError(firestoreError, "submit report");
        throw firestoreError;
      }

      setUploadProgress(100);
      console.log("Report submitted successfully!");

      // Show success message
      Alert.alert("Success", "Report submitted successfully!");

      // Reset form
      setTitle("");
      setBarangay("");
      setStreet("");
      setLandmark("");
      setDescription("");
      setImageUri(null);
      setImageDataUrl(null);
      setGeoCoords(null);
      setAiResult(null);
    } catch (err) {
      console.error("Report submission error:", err);
      Alert.alert(
        "Error",
        `Failed to submit report: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Helper function to submit report without image
  const submitReportWithoutImage = async () => {
    try {
      await retryFirestoreOperation(async () => {
        return await addDoc(collection(db, "reports"), {
          title,
          barangay,
          street,
          landmark,
          description,
          imageURL: null,
          location: geoCoords,
          userId: auth.currentUser?.uid,
          userEmail: auth.currentUser?.email || "",
          createdAt: new Date().toISOString(),
          status: "pending",
        });
      });

      Alert.alert("Success", "Report submitted successfully without image!");

      // Reset form
      setTitle("");
      setBarangay("");
      setStreet("");
      setLandmark("");
      setDescription("");
      setImageUri(null);
      setGeoCoords(null);
    } catch (err) {
      console.error("Report submission error:", err);
      handleFirestoreError(err, "submit report");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number } | null>(null);

  const handleTakePhoto = async () => {
    try {
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      if (cameraStatus !== 'granted') {
        Alert.alert(
          "Permission Denied",
          "Camera permission is required to capture the trash pile."
        );
        return;
      }

      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      if (locationStatus !== 'granted') {
        Alert.alert(
          "Permission Denied",
          "Location permission is required to geotag your report."
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const capturedUri = result.assets[0].uri;
        const capturedBase64 = result.assets[0].base64;
        setImageUri(capturedUri);

        // Trigger AI analysis in parallel with location fetching
        setIsAnalyzingAI(true);
        setAiResult(null);
        analyzeWasteImage(capturedUri, capturedBase64)
          .then((analysis) => {
            setAiResult(analysis);
            console.log('🤖 AI analysis result:', analysis);
          })
          .catch((err) => {
            console.error('🤖 AI analysis error:', err);
            setAiResult({
              wasteType: 'Analysis failed',
              estimatedWeight: '—',
              confidence: 'none',
              details: 'Could not analyze the image.',
            });
          })
          .finally(() => setIsAnalyzingAI(false));
        setIsFetchingLocation(true);
        
        try {
          let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
          setGeoCoords({
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          });
          const geocode = await Location.reverseGeocodeAsync({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
          if (geocode && geocode.length > 0) {
            const place = geocode[0];
            const addressStr = [place.street, place.city, place.region].filter(Boolean).join(', ');
            setLocationAddress(addressStr || "Unknown Location");
            setBarangay(place.district || place.city || place.subregion || 'Unknown Area');
            setStreet(place.street || place.name || `${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`);
          } else {
            setLocationAddress("Unknown Location");
            setBarangay('Unknown Area');
            setStreet(`${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`);
          }
        } catch (locErr) {
          console.warn("Failed to get current location, trying last known:", locErr);
          try {
            let loc = await Location.getLastKnownPositionAsync();
            if (loc) {
              setGeoCoords({
                lat: loc.coords.latitude,
                lng: loc.coords.longitude,
              });
              const geocode = await Location.reverseGeocodeAsync({
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
              });
              if (geocode && geocode.length > 0) {
                const place = geocode[0];
                const addressStr = [place.street, place.city, place.region].filter(Boolean).join(', ');
                setLocationAddress(addressStr || "Unknown Location");
                // If user has a barangay in their profile, use it. Otherwise try district first, then subregion, fallback to city
                if (userProfileBarangay) {
                  setBarangay(userProfileBarangay);
                } else {
                  setBarangay(place.district || place.subregion || place.city || '');
                }
                setStreet(place.street || place.name || '');
              } else {
                setLocationAddress("Unknown Location");
                if (userProfileBarangay) {
                  setBarangay(userProfileBarangay);
                }
              }
            } else {
              throw new Error("No last known location");
            }
          } catch (fallbackErr) {
            console.warn("Failed to get fallback location:", fallbackErr);
            Alert.alert("Location Error", "Could not get your exact location. Are you on an emulator? Please set a mock location in the emulator settings.");
          }
        } finally {
          setIsFetchingLocation(false);
        }
      }
    } catch (err) {
      console.error("Error capturing photo or location:", err);
      Alert.alert("Error", "Failed to capture photo.");
      setIsFetchingLocation(false);
    }
  };

  // Helper functions for AI waste type display
  const getWasteTypeIcon = (wasteType: string): string => {
    if (wasteType.includes('Solid')) return 'cube.fill';
    if (wasteType.includes('Liquid')) return 'drop.fill';
    if (wasteType.includes('Organic')) return 'leaf.fill';
    if (wasteType.includes('Recyclable')) return 'arrow.triangle.2.circlepath';
    if (wasteType.includes('Hazardous')) return 'exclamationmark.triangle.fill';
    if (wasteType.includes('Cannot determine')) return 'questionmark.circle.fill';
    if (wasteType.includes('Not waste')) return 'xmark.circle.fill';
    if (wasteType.includes('Temporarily')) return 'clock.fill';
    return 'sparkles';
  };

  const getWasteTypeColor = (wasteType: string): string => {
    if (wasteType.includes('Solid')) return '#2563EB';
    if (wasteType.includes('Liquid')) return '#0891B2';
    if (wasteType.includes('Organic')) return '#059669';
    if (wasteType.includes('Recyclable')) return '#D97706';
    if (wasteType.includes('Hazardous')) return '#DC2626';
    if (wasteType.includes('Cannot determine')) return '#9CA3AF';
    if (wasteType.includes('Not waste')) return '#EF4444';
    if (wasteType.includes('Temporarily')) return '#6B7280';
    return '#4A6741';
  };

  // Check if the current AI result allows submission
  const canSubmitReport = useMemo(() => {
    // No AI result yet — block submission
    if (!aiResult) return false;
    // Not waste — block submission
    if (aiResult.wasteType === 'Not waste') return false;
    // Temporarily unavailable — block submission
    if (aiResult.wasteType === 'Temporarily unavailable') return false;
    // Unable to determine (fallback) — block submission
    if (aiResult.wasteType === 'Unable to determine') return false;
    return true;
  }, [aiResult]);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 30), paddingBottom: Math.max(insets.bottom + 20, 100) }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headerTitle}>Report a Trash Pile</Text>

        {/* Photo upload placeholder */}
        <TouchableOpacity style={styles.photoCard} onPress={handleTakePhoto} disabled={isFetchingLocation}>
          {imageUri ? (
            <View style={{ width: "100%", height: "100%", position: 'relative' }}>
              <Image
                source={{ uri: imageUri }}
                style={{ width: "100%", height: "100%", borderRadius: 12 }}
              />
              {isFetchingLocation && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center', borderRadius: 12 }}>
                  <ActivityIndicator size="large" color="#4A6741" />
                  <Text style={{ marginTop: 8, color: '#4A6741', fontWeight: 'bold' }}>Acquiring GPS...</Text>
                </View>
              )}
              {geoCoords && !isFetchingLocation && (
                <View style={{ position: 'absolute', bottom: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                  <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>
                    {geoCoords.lat.toFixed(5)}, {geoCoords.lng.toFixed(5)}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.photoPlaceholder}>
              <IconSymbol name="camera.fill" size={36} color="#4A6741" />
              <Text style={styles.photoTextMain}>Capture Trash Pile</Text>
              <Text style={styles.photoTextSub}>Tap to take a Geo-Photo</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* AI Suggestions */}
        <View style={styles.aiSectionHeader}>
          <IconSymbol name="sparkles" size={16} color="#4A6741" />
          <Text style={styles.aiSectionTitle}>AI SUGGESTIONS</Text>
          {aiResult?.confidence && aiResult.confidence !== 'none' && (
            <View style={[
              styles.confidenceBadge,
              { backgroundColor: aiResult.confidence === 'high' ? '#D1FAE5' : aiResult.confidence === 'medium' ? '#FEF3C7' : '#FEE2E2' }
            ]}>
              <Text style={[
                styles.confidenceText,
                { color: aiResult.confidence === 'high' ? '#065F46' : aiResult.confidence === 'medium' ? '#92400E' : '#991B1B' }
              ]}>
                {aiResult.confidence.toUpperCase()} CONFIDENCE
              </Text>
            </View>
          )}
        </View>

        {isAnalyzingAI ? (
          <View style={styles.aiLoadingContainer}>
            <ActivityIndicator size="small" color="#4A6741" />
            <Text style={styles.aiLoadingText}>Analyzing waste with AI...</Text>
          </View>
        ) : aiResult ? (
          <>
            <View style={styles.aiRow}>
              <View style={styles.aiCard}>
                <Text style={styles.aiCardLabel}>Waste Type</Text>
                <View style={styles.aiCardValueRow}>
                  <IconSymbol
                    name={getWasteTypeIcon(aiResult.wasteType)}
                    size={18}
                    color={getWasteTypeColor(aiResult.wasteType)}
                  />
                  <Text style={[styles.aiCardValue, { color: getWasteTypeColor(aiResult.wasteType) }]}>
                    {aiResult.wasteType}
                  </Text>
                </View>
              </View>
              <View style={styles.aiCard}>
                <Text style={styles.aiCardLabel}>Estimated Weight</Text>
                <View style={styles.aiCardValueRow}>
                  <IconSymbol name="scalemass.fill" size={18} color="#4A6741" />
                  <Text style={styles.aiCardValue}>{aiResult.estimatedWeight}</Text>
                </View>
              </View>
            </View>
            {aiResult.details && (
              <View style={styles.aiDetailsCard}>
                <IconSymbol name="info.circle.fill" size={14} color="#6B7280" />
                <Text style={styles.aiDetailsText}>{aiResult.details}</Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.aiEmptyContainer}>
            <IconSymbol name="camera.fill" size={20} color="#9CA3AF" />
            <Text style={styles.aiEmptyText}>Take a photo to get AI analysis</Text>
          </View>
        )}

        {/* Title */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Report Title</Text>
          <View style={styles.inputField}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="What are you reporting?"
              placeholderTextColor="#7C8E80"
              style={styles.inputText}
            />
          </View>
          <View style={styles.tagsRow}>
            <TouchableOpacity style={styles.tagBadge} onPress={() => setTitle("Illegal Dumping")}>
              <Text style={styles.tagText}>Illegal Dumping</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tagBadge} onPress={() => setTitle("Missed Pickup")}>
              <Text style={styles.tagText}>Missed Pickup</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Location Map */}
        <View style={styles.mapContainer}>
          {geoCoords ? (
            <View style={{ height: 180, borderRadius: 16, overflow: 'hidden', position: 'relative' }}>
              <MapView
                style={{ width: '100%', height: '100%' }}
                initialRegion={{
                  latitude: geoCoords.lat,
                  longitude: geoCoords.lng,
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                }}
                region={{
                  latitude: geoCoords.lat,
                  longitude: geoCoords.lng,
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                }}
              >
                <Marker coordinate={{ latitude: geoCoords.lat, longitude: geoCoords.lng }} />
              </MapView>
              <View style={styles.mapAddressBadge}>
                <IconSymbol name="location.fill" size={14} color="#4A6741" />
                <Text style={styles.mapAddressText} numberOfLines={1}>{locationAddress}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.mockMapBg}>
              <View style={styles.mockMapPinContainer}>
                 <IconSymbol name="mappin.circle.fill" size={48} color="#4A6741" />
              </View>
              <View style={styles.mapAddressBadge}>
                <IconSymbol name="location.fill" size={14} color="#4A6741" />
                <Text style={styles.mapAddressText}>Location will appear here</Text>
              </View>
            </View>
          )}
        </View>

        {/* Barangay & Street Inputs (Auto-filled but Editable) */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Barangay</Text>
            <View style={[styles.inputField, { paddingVertical: 12, paddingHorizontal: 12 }]}>
              <TextInput
                value={barangay}
                onChangeText={setBarangay}
                placeholder="e.g. Sambag 2"
                placeholderTextColor="#7C8E80"
                style={styles.inputText}
              />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Street</Text>
            <View style={[styles.inputField, { paddingVertical: 12, paddingHorizontal: 12 }]}>
              <TextInput
                value={street}
                onChangeText={setStreet}
                placeholder="e.g. V. Rama Ave"
                placeholderTextColor="#7C8E80"
                style={styles.inputText}
              />
            </View>
          </View>
        </View>

        {/* Description */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Additional Notes</Text>
          <View style={styles.textArea}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Any specific instructions for the pickup crew?"
              placeholderTextColor="#7C8E80"
              style={styles.textAreaInput}
              multiline
            />
          </View>
        </View>

        {/* Upload Progress */}
        {isUploading && (
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              {uploadProgress < 25
                ? "Preparing..."
                : uploadProgress < 75
                ? "Uploading image..."
                : "Submitting report..."}
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${uploadProgress}%` }]}
              />
            </View>
          </View>
        )}

        {/* Points Badge & Submit */}
        <View style={styles.submitSection}>
          <View style={styles.pointsBadgeSubmit}>
             <IconSymbol name="star.circle.fill" size={16} color="#4A6741" />
             <Text style={styles.pointsBadgeText}>+50 POINTS FOR THIS REPORT</Text>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, (isUploading || !canSubmitReport) && styles.submitBtnDisabled]}
            activeOpacity={0.8}
            onPress={handleSendReport}
            disabled={isUploading || !canSubmitReport}
          >
            <Text style={styles.submitText}>
              {isUploading ? "Submitting..." : "Submit Report"}
            </Text>
            <IconSymbol name="paperplane.fill" size={16} color="white" />
          </TouchableOpacity>
          {!canSubmitReport && !isUploading && (
            <Text style={{ color: '#DC2626', fontSize: 12, textAlign: 'center', marginTop: 6 }}>
              {!aiResult
                ? '📸 Take a photo first so the AI can classify the waste'
                : aiResult.wasteType === 'Not waste'
                ? '🚫 This photo does not contain waste — please retake'
                : '⚠️ AI could not determine waste type — please retake the photo'}
            </Text>
          )}
          <Text style={styles.submitFooterText}>
            By submitting, you&apos;ll earn 50 Community Points and help reach the &quot;Cleanest Quarter&quot; goal!
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#E8F5E9" },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, paddingTop: 60 },
  headerTitle: { fontSize: 24, fontWeight: "700", color: "#234033", marginBottom: 20 },
  
  photoCard: {
    height: 180,
    borderRadius: 16,
    backgroundColor: "#F0F6F0",
    borderWidth: 2,
    borderColor: "#C8D8CA",
    borderStyle: 'dashed',
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    overflow: 'hidden',
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoTextMain: {
    marginTop: 12,
    fontSize: 16,
    color: "#4A6741",
    fontWeight: "700",
  },
  photoTextSub: {
    marginTop: 4,
    fontSize: 13,
    color: "#7C8E80",
  },

  aiSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  aiSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4A6741',
    letterSpacing: 1,
  },
  aiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  aiCard: {
    flex: 1,
    backgroundColor: '#E2EFE3',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  aiCardLabel: {
    fontSize: 11,
    color: '#6B8C72',
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  aiCardValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  aiCardValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#234033',
    flexShrink: 1,
  },

  fieldGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "700", color: "#4A6741", marginBottom: 8 },
  
  inputField: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#C8D8CA",
  },
  inputText: { fontSize: 15, color: "#234033" },
  
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  tagBadge: {
    backgroundColor: '#C8E6C9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    color: '#2E7D32',
    fontSize: 13,
    fontWeight: '600',
  },

  mapContainer: {
    marginBottom: 20,
  },
  mockMapBg: {
    backgroundColor: '#7C8E80',
    height: 140,
    borderRadius: 16,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mockMapPinContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  mapAddressBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: 'white',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapAddressText: {
    fontSize: 13,
    color: '#234033',
    fontWeight: '500',
  },

  textArea: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    minHeight: 100,
    borderWidth: 1,
    borderColor: "#C8D8CA",
  },
  textAreaInput: { fontSize: 15, color: "#234033", textAlignVertical: 'top' },

  submitSection: {
    alignItems: 'center',
    marginTop: 10,
  },
  pointsBadgeSubmit: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C8E6C9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    marginBottom: 16,
  },
  pointsBadgeText: {
    color: '#2E7D32',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: "#4A6741",
    paddingVertical: 16,
    width: '100%',
    borderRadius: 12,
    marginBottom: 16,
  },
  submitBtnDisabled: {
    backgroundColor: "#A0A0A0",
  },
  submitText: { color: "white", fontWeight: "700", fontSize: 16 },
  submitFooterText: {
    textAlign: 'center',
    color: '#4B5F4F',
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 20,
  },

  progressContainer: {
    marginBottom: 16,
  },
  progressText: {
    fontSize: 12,
    color: "#4B5F4F",
    textAlign: "center",
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: "#E0E0E0",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#4E6E58",
    borderRadius: 2,
  },

  // AI Analysis styles
  aiLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F7F2',
    padding: 20,
    borderRadius: 12,
    marginBottom: 8,
    gap: 10,
  },
  aiLoadingText: {
    color: '#4A6741',
    fontSize: 14,
    fontWeight: '500',
  },
  aiEmptyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    padding: 20,
    borderRadius: 12,
    marginBottom: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  aiEmptyText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  aiDetailsCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    gap: 8,
  },
  aiDetailsText: {
    color: '#6B7280',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 'auto',
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
