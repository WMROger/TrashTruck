import { IconSymbol } from "@/components/ui/IconSymbol";
import { UPLOAD_PRESETS } from "@/config/cloudinary";
import { auth, db, storage } from "@/config/firebase";
import {
  cloudinaryService,
  UPLOAD_FOLDERS,
} from "@/services/cloudinaryService";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { addDoc, collection } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import React, { useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActionSheetIOS,
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
  const MAX_FIRESTORE_FIELD_BYTES = 1000000; // ~1MB safe cap

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
    if (
      !title.trim() ||
      !barangay.trim() ||
      !street.trim() ||
      !description.trim()
    ) {
      Alert.alert("Error", "Please fill in all required fields.");
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
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email || "",
        createdAt: new Date().toISOString(),
        status: "pending", // Add status for admin management
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
    } catch (err) {
      console.error("Report submission error:", err);
      handleFirestoreError(err, "submit report");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleImageSelection = async (useCamera: boolean) => {
    try {
      // Request permissions
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission Denied",
            "Camera permission is required to take photos."
          );
          return;
        }
      } else {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission Denied",
            "Gallery permission is required to select photos."
          );
          return;
        }
      }

      const mediaTypes = (ImagePicker as any).MediaType
        ? [(ImagePicker as any).MediaType.image]
        : (ImagePicker as any).MediaTypeOptions?.Images ??
          ImagePicker.MediaTypeOptions.Images;

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: mediaTypes as any,
            allowsEditing: true,
            quality: 0.5,
            aspect: [4, 3],
            base64: Platform.OS === "web",
          } as any)
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: mediaTypes as any,
            allowsEditing: true,
            quality: 0.5,
            aspect: [4, 3],
            base64: Platform.OS === "web",
          } as any);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0] as any;
        setImageUri(asset.uri);
        const mime = (asset as any).mimeType || "image/jpeg";
        setImageMimeType(mime);
        if (asset.base64) {
          setImageDataUrl(`data:${mime};base64,${asset.base64}`);
        } else {
          setImageDataUrl(null);
        }
      }
    } catch (error) {
      console.error("Error selecting image:", error);
      Alert.alert("Error", "Failed to select image. Please try again.");
    }
  };

  const pickImage = () => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Take Photo", "Choose from Gallery"],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleImageSelection(true); // Camera
          } else if (buttonIndex === 2) {
            handleImageSelection(false); // Gallery
          }
        }
      );
    } else {
      // For Android and Web, show Alert dialog
      Alert.alert(
        "Add Photo",
        "Choose an option",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Take Photo",
            onPress: () => handleImageSelection(true),
          },
          {
            text: "Choose from Gallery",
            onPress: () => handleImageSelection(false),
          },
        ],
        { cancelable: true }
      );
    }
  };
  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 30), paddingBottom: Math.max(insets.bottom + 20, 100) }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headerTitle}>Report a Trash Pile</Text>

        {/* Photo upload placeholder */}
        <TouchableOpacity style={styles.photoCard} onPress={pickImage}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={{ width: "100%", height: "100%", borderRadius: 12 }}
            />
          ) : (
            <View style={styles.photoPlaceholder}>
              <IconSymbol name="camera.fill" size={36} color="#4A6741" />
              <Text style={styles.photoTextMain}>Capture Trash Pile</Text>
              <Text style={styles.photoTextSub}>Tap to take a photo or upload</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* AI Suggestions (Mocked) */}
        <View style={styles.aiSectionHeader}>
          <IconSymbol name="sparkles" size={16} color="#4A6741" />
          <Text style={styles.aiSectionTitle}>AI SUGGESTIONS</Text>
        </View>

        <View style={styles.aiRow}>
          <View style={styles.aiCard}>
            <Text style={styles.aiCardLabel}>Waste Type</Text>
            <View style={styles.aiCardValueRow}>
              <IconSymbol name="leaf.fill" size={18} color="#4A6741" />
              <Text style={styles.aiCardValue}>Biodegradable</Text>
            </View>
          </View>
          <View style={styles.aiCard}>
            <Text style={styles.aiCardLabel}>Estimated Weight</Text>
            <View style={styles.aiCardValueRow}>
              <IconSymbol name="scalemass.fill" size={18} color="#4A6741" />
              <Text style={styles.aiCardValue}>12.5 <Text style={{fontWeight: '400', fontSize: 14}}>kg</Text></Text>
            </View>
          </View>
        </View>

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
          <View style={styles.mockMapBg}>
            <View style={styles.mockMapPinContainer}>
               <IconSymbol name="mappin.circle.fill" size={48} color="#4A6741" />
            </View>
            <View style={styles.mapAddressBadge}>
              <IconSymbol name="location.fill" size={14} color="#4A6741" />
              <Text style={styles.mapAddressText}>Oak Street, near Market Center</Text>
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
            style={[styles.submitBtn, isUploading && styles.submitBtnDisabled]}
            activeOpacity={0.8}
            onPress={handleSendReport}
            disabled={isUploading}
          >
            <Text style={styles.submitText}>
              {isUploading ? "Submitting..." : "Submit Report"}
            </Text>
            <IconSymbol name="paperplane.fill" size={16} color="white" />
          </TouchableOpacity>
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
    gap: 12,
    marginBottom: 24,
  },
  aiCard: {
    flex: 1,
    backgroundColor: '#E2EFE3',
    borderRadius: 12,
    padding: 16,
  },
  aiCardLabel: {
    fontSize: 12,
    color: '#4A6741',
    fontWeight: '600',
    marginBottom: 8,
  },
  aiCardValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiCardValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#234033',
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
});
