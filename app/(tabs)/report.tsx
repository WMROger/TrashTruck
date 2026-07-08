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
        contentContainerStyle={styles.content}
      >
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Report a Trash Pile</Text>
        </View>

        <Text style={styles.helperText}>
          Help us keep our barangay clean, healthy, and safe! Use this form to
          report any uncollected trash or illegal dumping in your area.
        </Text>

        {/* Title */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>
            Title <Text style={styles.required}>*</Text>
          </Text>
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
            <Text style={styles.label}>
              Barangay <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.inputField}
              onPress={() => {
                setShowBarangay(!showBarangay);
                if (!showBarangay) {
                  setShowLandmark(false); // Close landmark dropdown when opening barangay
                }
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.inputText,
                  barangay ? undefined : styles.placeholder,
                ]}
              >
                {barangay || "Barangay"}
              </Text>
              <Ionicons
                name={showBarangay ? "chevron-up" : "chevron-down"}
                size={18}
                color="#4B5F4F"
              />
            </TouchableOpacity>
            {showBarangay && BARANGAYS && BARANGAYS.length > 0 && (
              <>
                <TouchableOpacity
                  style={styles.dropdownBackdrop}
                  onPress={() => setShowBarangay(false)}
                  activeOpacity={1}
                />
                <View style={styles.dropdownPanelBarangay}>
                  {BARANGAYS.map((b, index) => (
                    <TouchableOpacity
                      key={`barangay-${index}-${b}`}
                      style={[
                        styles.dropdownItem,
                        index === BARANGAYS.length - 1 &&
                          styles.dropdownItemLast,
                      ]}
                      onPress={() => {
                        setBarangay(b);
                        setShowBarangay(false);
                      }}
                    >
                      <Text style={styles.dropdownText}>{b}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>

          {/* Street input */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              Street <Text style={styles.required}>*</Text>
            </Text>
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
            <TouchableOpacity
              style={styles.inputField}
              onPress={() => {
                setShowLandmark(!showLandmark);
                if (!showLandmark) {
                  setShowBarangay(false); // Close barangay dropdown when opening landmark
                }
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.inputText,
                  landmark ? undefined : styles.placeholder,
                ]}
              >
                {landmark || "Nearby landmarks"}
              </Text>
              <Ionicons
                name={showLandmark ? "chevron-up" : "chevron-down"}
                size={18}
                color="#4B5F4F"
              />
            </TouchableOpacity>
            {showLandmark && LANDMARKS && LANDMARKS.length > 0 && (
              <>
                <TouchableOpacity
                  style={styles.dropdownBackdrop}
                  onPress={() => setShowLandmark(false)}
                  activeOpacity={1}
                />
                <View style={styles.dropdownPanelLandmark}>
                  {LANDMARKS.map((l, index) => (
                    <TouchableOpacity
                      key={`landmark-${index}-${l}`}
                      style={[
                        styles.dropdownItem,
                        index === LANDMARKS.length - 1 &&
                          styles.dropdownItemLast,
                      ]}
                      onPress={() => {
                        setLandmark(l);
                        setShowLandmark(false);
                      }}
                    >
                      <Text style={styles.dropdownText}>{l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>
        </View>

        {/* Description */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>
            Description of Trash <Text style={styles.required}>*</Text>
          </Text>
          <Text style={styles.sublabel}>
            What do you see? Please describe the type and amount of trash.
          </Text>
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
            <Image
              source={{ uri: imageUri }}
              style={{ width: 100, height: 100, borderRadius: 12 }}
            />
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

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, isUploading && styles.submitBtnDisabled]}
          activeOpacity={0.8}
          onPress={handleSendReport}
          disabled={isUploading}
        >
          <Text style={styles.submitText}>
            {isUploading ? "Submitting..." : "Send report"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, backgroundColor: "#ECF8ED" },
  content: { padding: 26, paddingBottom: 10, paddingTop: 45 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DDEEDB",
    borderWidth: 1,
    borderColor: "#C8D8CA",
    marginRight: 8,
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#234033" },
  helperText: { fontSize: 12, color: "#4B5F4F", marginBottom: 12 },

  fieldGroup: { marginBottom: 14, position: "relative" },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#234033",
    marginBottom: 6,
  },
  label: { fontSize: 12, fontWeight: "700", color: "#234033" },
  sublabel: { fontSize: 10, color: "#4B5F4F", marginBottom: 6 },
  required: { color: "#FF4444", fontWeight: "700" },

  inputField: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7FBF7",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#C8D8CA",
    marginTop: 6,
  },
  inputText: { flex: 1, fontSize: 12, color: "#234033" },
  placeholder: { color: "#7C8E80" },

  dropdownPanel: {
    position: "absolute",
    top: 68,
    left: 0,
    right: 0,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#C8D8CA",
    borderRadius: 8,
    overflow: "hidden",
    zIndex: 1000,
    elevation: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    pointerEvents: "auto",
    maxHeight: 200,
  },
  dropdownPanelBarangay: {
    position: "absolute",
    top: 68,
    left: 0,
    right: 0,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#C8D8CA",
    borderRadius: 8,
    overflow: "hidden",
    zIndex: 10000,
    elevation: 10000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    pointerEvents: "auto",
    maxHeight: 200,
  },
  dropdownPanelLandmark: {
    position: "absolute",
    top: 68,
    left: 0,
    right: 0,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#C8D8CA",
    borderRadius: 8,
    overflow: "hidden",
    zIndex: 10000,
    elevation: 10000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    pointerEvents: "auto",
    maxHeight: 200,
  },
  dropdownPanelPortal: {
    position: "fixed",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#C8D8CA",
    borderRadius: 8,
    overflow: "hidden",
    zIndex: 2147483647,
    boxShadow: "0 6px 12px rgba(0,0,0,0.15)",
  } as any,
  dropdownPanelPortalNative: {
    position: "absolute",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#C8D8CA",
    borderRadius: 8,
    overflow: "hidden",
    zIndex: 2147483647,
    elevation: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF3EE",
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  dropdownText: { fontSize: 12, color: "#234033" },
  dropdownBackdrop: {
    position: "absolute",
    top: 0,
    left: -1000,
    right: -1000,
    bottom: -1000,
    zIndex: 9999,
    elevation: 9999,
  },

  textArea: {
    backgroundColor: "#F7FBF7",
    borderRadius: 8,
    padding: 12,
    minHeight: 88,
    borderWidth: 1,
    borderColor: "#C8D8CA",
    marginTop: 6,
    position: "relative",
    zIndex: 0,
  },
  textAreaInput: { fontSize: 12, color: "#234033" },

  photoCard: {
    alignItems: "center",
    justifyContent: "center",
    height: 120,
    borderRadius: 12,
    backgroundColor: "#F0F6F0",
    borderWidth: 1,
    borderColor: "#C8D8CA",
    marginBottom: 14,
    position: "relative",
    zIndex: 0,
  },
  photoText: {
    marginTop: 8,
    fontSize: 12,
    color: "#234033",
    fontWeight: "600",
  },

  submitBtn: {
    alignSelf: "center",
    backgroundColor: "#4E6E58",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
  },
  submitBtnDisabled: {
    backgroundColor: "#A0A0A0",
    opacity: 0.6,
  },
  submitText: { color: "white", fontWeight: "700" },

  progressContainer: {
    marginBottom: 16,
    paddingHorizontal: 20,
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
