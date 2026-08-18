import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export type LegalTabType = "consent" | "privacy";

interface TermsAndConsentModalProps {
  visible: boolean;
  initialTab?: LegalTabType;
  onClose: () => void;
  onAccept?: () => void;
}

export default function TermsAndConsentModal({
  visible,
  initialTab = "consent",
  onClose,
  onAccept,
}: TermsAndConsentModalProps) {
  const [activeTab, setActiveTab] = useState<LegalTabType>(initialTab);

  React.useEffect(() => {
    if (visible) {
      setActiveTab(initialTab);
    }
  }, [visible, initialTab]);

  const handleAccept = () => {
    if (onAccept) {
      onAccept();
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="shield-checkmark" size={22} color="#4A6B48" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>Legal & Privacy Notice</Text>
                <Text style={styles.headerSubtitle}>TrashTrack • Danao City</Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Tab Selector */}
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === "consent" && styles.tabButtonActive]}
                onPress={() => setActiveTab("consent")}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="document-text-outline"
                  size={16}
                  color={activeTab === "consent" ? "#FFFFFF" : "#6B7280"}
                />
                <Text
                  style={[styles.tabButtonText, activeTab === "consent" && styles.tabButtonTextActive]}
                >
                  Informed Consent
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabButton, activeTab === "privacy" && styles.tabButtonActive]}
                onPress={() => setActiveTab("privacy")}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={16}
                  color={activeTab === "privacy" ? "#FFFFFF" : "#6B7280"}
                />
                <Text
                  style={[styles.tabButtonText, activeTab === "privacy" && styles.tabButtonTextActive]}
                >
                  Data Privacy Terms
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Scrollable Content */}
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={true}
          >
            {activeTab === "consent" ? (
              /* INFORMED CONSENT CONTENT */
              <View>
                <View style={styles.badgeBanner}>
                  <Ionicons name="checkmark-done-circle" size={18} color="#059669" />
                  <Text style={styles.badgeBannerText}>
                    Republic Act No. 10173 (Data Privacy Act of 2012)
                  </Text>
                </View>

                <Text style={styles.sectionTitle}>Informed Consent for TrashTrack</Text>
                <Text style={styles.paragraph}>
                  By creating an account and checking the consent box, you freely, voluntarily, and expressly authorize <Text style={styles.boldText}>TrashTrack</Text>, in collaboration with the <Text style={styles.boldText}>City Environment and Natural Resources Office (CENRO)</Text> of Danao City, to collect, process, and store your personal information.
                </Text>

                <View style={styles.card}>
                  <Text style={styles.cardHeader}>1. Information We Collect</Text>
                  <Text style={styles.cardItem}>• <Text style={styles.boldText}>Identity Data:</Text> Full name (First name, Last name, Middle Initial).</Text>
                  <Text style={styles.cardItem}>• <Text style={styles.boldText}>Locational Information:</Text> Your assigned barangay within Danao City, Cebu.</Text>
                  <Text style={styles.cardItem}>• <Text style={styles.boldText}>Contact Information:</Text> Email address and optional mobile phone number.</Text>
                  <Text style={styles.cardItem}>• <Text style={styles.boldText}>Service Evidence:</Text> Geo-tagged photos and GPS coordinates when submitting waste incident reports or verification requests.</Text>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardHeader}>2. Purpose of Data Processing</Text>
                  <Text style={styles.cardItem}>• Coordinating and optimizing scheduled residential garbage collection routes.</Text>
                  <Text style={styles.cardItem}>• Dispatching municipal waste collection trucks to reported uncollected or unsegregated waste.</Text>
                  <Text style={styles.cardItem}>• Crediting eco-rewards and points for verified sustainable waste disposal.</Text>
                  <Text style={styles.cardItem}>• Sending collection schedule updates, weather-related delays, and public advisories.</Text>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardHeader}>3. Voluntary Participation & Withdrawal</Text>
                  <Text style={styles.cardText}>
                    Providing your data is voluntary. You retain the right to withdraw your consent or request account deactivation at any time via Profile Settings or by contacting the Danao City CENRO Helpdesk.
                  </Text>
                </View>
              </View>
            ) : (
              /* DATA PRIVACY TERMS CONTENT */
              <View>
                <View style={styles.badgeBanner}>
                  <Ionicons name="shield-half" size={18} color="#059669" />
                  <Text style={styles.badgeBannerText}>
                    Privacy Policy & Governance
                  </Text>
                </View>

                <Text style={styles.sectionTitle}>Data Privacy & Terms of Service</Text>
                <Text style={styles.paragraph}>
                  TrashTrack is committed to protecting your privacy in compliance with the National Privacy Commission (NPC) standards.
                </Text>

                <View style={styles.card}>
                  <Text style={styles.cardHeader}>1. Data Security & Storage</Text>
                  <Text style={styles.cardText}>
                    Your personal information is protected using industry-standard TLS encryption during transmission and encrypted Firestore storage at rest. Access is governed by strict Role-Based Access Control (RBAC) restricted to verified municipal waste administrators and dispatched drivers.
                  </Text>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardHeader}>2. Non-Disclosure & Third Parties</Text>
                  <Text style={styles.cardText}>
                    TrashTrack does not sell, rent, trade, or monetize your personal data. Data is used strictly for municipal waste management operations and legitimate city environmental public services.
                  </Text>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardHeader}>3. Resident Rights (RA 10173)</Text>
                  <Text style={styles.cardItem}>• <Text style={styles.boldText}>Right to be Informed:</Text> Knowing how your data is collected and used.</Text>
                  <Text style={styles.cardItem}>• <Text style={styles.boldText}>Right to Access:</Text> Viewing your stored profile and submission history.</Text>
                  <Text style={styles.cardItem}>• <Text style={styles.boldText}>Right to Rectification:</Text> Updating incorrect name, phone, or barangay data.</Text>
                  <Text style={styles.cardItem}>• <Text style={styles.boldText}>Right to Erasure:</Text> Requesting removal of personal records upon account termination.</Text>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardHeader}>4. Contact & Inquiries</Text>
                  <Text style={styles.cardText}>
                    For data protection inquiries or requests, contact:{"\n"}
                    <Text style={styles.boldText}>City Environment and Natural Resources Office (CENRO)</Text>{"\n"}
                    Danao City Hall, F. Ralota St., Danao City, Cebu 6004
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.closeModalButtonText}>Close</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.acceptButton}
              onPress={handleAccept}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.acceptButtonText}>I Agree & Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    minHeight: "75%",
    flexDirection: "column",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1F2937",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 1,
  },
  closeButton: {
    padding: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 10,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: "#5C7C54",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  tabButtonTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: 20,
    paddingBottom: 10,
  },
  badgeBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  badgeBannerText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#065F46",
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 13,
    lineHeight: 20,
    color: "#4B5563",
    marginBottom: 14,
  },
  boldText: {
    fontWeight: "700",
    color: "#1F2937",
  },
  card: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
  },
  cardItem: {
    fontSize: 13,
    lineHeight: 19,
    color: "#4B5563",
    marginBottom: 6,
  },
  cardText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#4B5563",
  },
  footer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 24 : 16,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    gap: 12,
    backgroundColor: "#FFFFFF",
  },
  closeModalButton: {
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  closeModalButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
  },
  acceptButton: {
    flex: 1,
    backgroundColor: "#5C7C54",
    paddingVertical: 13,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#5C7C54",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
