import { MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface AdminSidebarProps {
  activeTab: string;
  onTabPress: (tab: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const SIDEBAR_WIDTH = 256;
const BREAKPOINT = 900;

const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeTab,
  onTabPress,
  isOpen = false,
  onClose,
}) => {
  const [windowWidth, setWindowWidth] = useState(
    Dimensions.get("window").width,
  );
  const slideAnim = useState(new Animated.Value(-SIDEBAR_WIDTH))[0];
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {
      "CORE OPERATIONS": true,
      "FLEET & DRIVERS": true,
      "SYSTEM & COMMUNICATIONS": true,
    },
  );

  const isNarrow = windowWidth < BREAKPOINT;

  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setWindowWidth(window.width);
      if (window.width >= BREAKPOINT && onClose) {
        onClose();
      }
    });
    return () => subscription?.remove();
  }, [onClose]);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOpen ? 0 : -SIDEBAR_WIDTH,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [isOpen, slideAnim]);

  const navigationGroups = [
    {
      title: "CORE OPERATIONS",
      items: [
        {
          id: "dashboard",
          label: "DASHBOARD",
          icon: "grid-view",
        },
        {
          id: "driver-accounts",
          label: "ACCOUNTS DIRECTORY",
          icon: "recent-actors",
        },
        {
          id: "collection-scheduler",
          label: "COLLECTION SCHEDULES",
          icon: "event-note",
        },
        {
          id: "truck-inventory",
          label: "FLEET INVENTORY",
          icon: "local-shipping",
        },
        {
          id: "trash-reports",
          label: "TRASH REPORTS",
          icon: "assignment",
        },
        {
          id: "route-optimization",
          label: "ROUTE",
          icon: "route",
        },
        {
          id: "fleet-monitoring",
          label: "FLEET MONITORING",
          icon: "location-searching",
        },

        { id: "announcements", label: "ANNOUNCEMENTS", icon: "campaign" },
        {
          id: "operational-overrides",
          label: "SYSTEM OVERRIDES",
          icon: "report-problem",
        },
        {
          id: "service-feedback",
          label: "SERVICE FEEDBACK",
          icon: "rate-review",
        },
        { id: "analytics", label: "ANALYTICS", icon: "bar-chart" },
      ],
    },
  ];

  const handleItemPress = (id: string) => {
    onTabPress(id);
    if (isNarrow && onClose) onClose();
  };

  const sidebarContent = (
    <>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>CENRO Civic Steward</Text>
      </View>

      <ScrollView style={styles.navigation} showsVerticalScrollIndicator={true}>
        {navigationGroups.map((group, groupIndex) => {
          const isExpanded = expandedGroups[group.title] !== false; // default true
          return (
            <View
              key={group.title}
              style={groupIndex > 0 ? { marginTop: 8 } : {}}
            >
              <TouchableOpacity
                style={styles.navGroupHeader}
                onPress={() =>
                  setExpandedGroups((prev) => ({
                    ...prev,
                    [group.title]: !isExpanded,
                  }))
                }
                activeOpacity={0.7}
              >
                <Text style={styles.navGroupTitle}>{group.title}</Text>
                <MaterialIcons
                  name={
                    isExpanded ? "keyboard-arrow-down" : "keyboard-arrow-right"
                  }
                  size={16}
                  color="#9CA3AF"
                />
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.navGroupItems}>
                  {group.items.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.navItem,
                          isActive && styles.activeNavItem,
                        ]}
                        onPress={() => handleItemPress(item.id)}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons
                          name={item.icon as any}
                          size={18}
                          color={isActive ? "#FFFFFF" : "#6B7280"}
                        />
                        <Text
                          style={[
                            styles.navText,
                            isActive && styles.activeNavText,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.bottomSection}>

        <TouchableOpacity
          style={[
            styles.bottomNavBtn,
            activeTab === "dict-commands" && styles.activeBottomNavBtn,
          ]}
          onPress={() => handleItemPress("dict-commands")}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name="forum"
            size={20}
            color={activeTab === "dict-commands" ? "#1B4D3E" : "#4B5563"}
          />
          <Text
            style={[
              styles.bottomNavText,
              activeTab === "dict-commands" && styles.activeBottomNavText,
            ]}
          >
            DICT COMMAND & CHAT
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomNavBtn}
          onPress={() =>
            Alert.alert(
              "CENRO Support",
              "For account or operational assistance, contact the designated TrashTrack system administrator.",
            )
          }
        >
          <MaterialIcons name="help-outline" size={20} color="#4B5563" />
          <Text style={styles.bottomNavText}>SUPPORT</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.bottomNavBtn,
            activeTab === "operational-overrides" && styles.activeBottomNavBtn,
          ]}
          onPress={() => handleItemPress("operational-overrides")}
        >
          <MaterialIcons
            name="history"
            size={20}
            color={
              activeTab === "operational-overrides" ? "#1B4D3E" : "#4B5563"
            }
          />
          <Text
            style={[
              styles.bottomNavText,
              activeTab === "operational-overrides" &&
              styles.activeBottomNavText,
            ]}
          >
            LOGS
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );

  // Wide screen: normal fixed sidebar
  if (!isNarrow) {
    return <View style={styles.sidebar}>{sidebarContent}</View>;
  }

  // Narrow screen: animated drawer overlay
  return (
    <>
      {/* Overlay backdrop */}
      {isOpen && <Pressable style={styles.overlay} onPress={onClose} />}

      {/* Sliding drawer */}
      <Animated.View
        style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}
      >
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <MaterialIcons name="close" size={24} color="#4B5563" />
        </TouchableOpacity>
        {sidebarContent}
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: "#F3F4F6",
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
    justifyContent: "space-between",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1F2937",
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: "700",
    color: "#15803D",
    letterSpacing: 0.8,
  },
  navigation: {
    flex: 1,
    paddingHorizontal: 12,
  },
  navGroupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  navGroupTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9CA3AF",
    letterSpacing: 1,
  },
  navGroupItems: {
    paddingLeft: 4,
    marginBottom: 8,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  activeNavItem: {
    backgroundColor: "#4b6354",
  },
  navText: {
    fontSize: 11,
    marginLeft: 12,
    fontWeight: "600",
    color: "#4B5563",
    letterSpacing: 0.5,
  },
  activeNavText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  bottomSection: {
    padding: 24,
    paddingBottom: 40,
  },
  statusBlock: {
    backgroundColor: "#E5E7EB",
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#4b6354",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2E8B57",
  },
  statusText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "500",
  },
  bottomNavBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  activeBottomNavBtn: {
    backgroundColor: "#E6F4EA",
  },
  bottomNavText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4B5563",
    letterSpacing: 0.5,
  },
  activeBottomNavText: {
    color: "#1B4D3E",
    fontWeight: "800",
  },

  // Responsive / narrow screen styles
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    zIndex: 998,
  },
  drawer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: "#F3F4F6",
    zIndex: 999,
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
    justifyContent: "space-between",
    ...(Platform.OS === "web"
      ? { boxShadow: "4px 0 16px rgba(0,0,0,0.15)" }
      : {}),
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 4,
  },
});

export default AdminSidebar;
