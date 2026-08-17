import { useRouter } from "expo-router";
import React from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

export default function AdminSplashScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;

  const handleAdminLogin = () => {
    router.replace("/admin/login");
  };

  const handleBackToApp = () => {
    router.replace("/");
  };

  return (
    <View style={styles.container}>
      {/* Background Graphic (Desktop/Tablet) */}
      {!isMobile && (
        <Image
          source={require("@/assets/images/splash_admin_bg.png")}
          style={styles.backgroundImage}
          resizeMode="cover"
        />
      )}

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isMobile ? styles.scrollContentMobile : styles.scrollContentDesktop,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Left / Top Info Section */}
        <View
          style={[styles.infoSection, isMobile && styles.infoSectionMobile]}
        >
          <View style={styles.logoRow}>
            <Image
              source={require("@/assets/images/trashtrack_logo_driver.png")}
              style={[styles.logo, isMobile && styles.logoMobile]}
              resizeMode="contain"
            />
          </View>

          <Text style={[styles.title, isMobile && styles.titleMobile]}>
            TrashTrack
          </Text>
          <Text style={[styles.subtitle, isMobile && styles.subtitleMobile]}>
            Admin Portal for Comprehensive Waste Management Oversight
          </Text>

          {/* Illustration on Mobile (placed inline) */}
          {isMobile && (
            <View style={styles.illustrationMobileWrapper}>
              <Image
                source={require("@/assets/images/splash_admin.png")}
                style={styles.illustrationMobile}
                resizeMode="contain"
              />
            </View>
          )}

          {/* Action Buttons */}
          <View
            style={[
              styles.buttonContainer,
              isMobile && styles.buttonContainerMobile,
            ]}
          >
            <TouchableOpacity
              style={[
                styles.signInButton,
                isMobile && styles.signInButtonMobile,
              ]}
              onPress={handleAdminLogin}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.signInButtonText,
                  isMobile && styles.signInButtonTextMobile,
                ]}
              >
                Admin Sign In
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Right Illustration Section (Desktop / Tablet) */}
        {!isMobile && (
          <View style={styles.illustrationDesktopWrapper}>
            <Image
              source={require("@/assets/images/splash_admin.png")}
              style={styles.illustrationDesktop}
              resizeMode="contain"
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ECFEE5",
  },
  backgroundImage: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: "70%",
    height: "100%",
    opacity: 0.8,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  scrollContentDesktop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: "8%",
    paddingVertical: 40,
  },
  scrollContentMobile: {
    flexDirection: "column",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 40,
    justifyContent: "space-between",
  },
  infoSection: {
    maxWidth: 520,
    zIndex: 10,
  },
  infoSectionMobile: {
    maxWidth: "100%",
    width: "100%",
    alignItems: "center",
    textAlign: "center",
  },
  logoRow: {
    marginBottom: 16,
  },
  logo: {
    width: 180,
    height: 100,
  },
  logoMobile: {
    width: 140,
    height: 80,
    alignSelf: "center",
  },
  title: {
    fontSize: 54,
    fontWeight: "800",
    color: "#2D5A3D",
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  titleMobile: {
    fontSize: 36,
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 20,
    color: "#2D5A3D",
    fontWeight: "400",
    lineHeight: 28,
    marginBottom: 32,
  },
  subtitleMobile: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 20,
  },
  illustrationMobileWrapper: {
    width: "100%",
    height: 220,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 16,
  },
  illustrationMobile: {
    width: "100%",
    height: "100%",
    maxHeight: 220,
  },
  illustrationDesktopWrapper: {
    flex: 1,
    maxWidth: 600,
    height: 480,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 5,
  },
  illustrationDesktop: {
    width: "100%",
    height: "100%",
  },
  buttonContainer: {
    alignItems: "flex-start",
    gap: 16,
  },
  buttonContainerMobile: {
    width: "100%",
    alignItems: "center",
    marginTop: 12,
  },
  signInButton: {
    backgroundColor: "#4E6C50",
    borderRadius: 25,
    paddingVertical: 14,
    paddingHorizontal: 36,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  signInButtonMobile: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 16,
  },
  signInButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 20,
  },
  signInButtonTextMobile: {
    fontSize: 17,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonText: {
    color: "#4E6C50",
    fontSize: 14,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
