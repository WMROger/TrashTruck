import { db } from "@/config/firebase";
import { MaterialIcons } from "@expo/vector-icons";
import {
  collection,
  onSnapshot,
  orderBy,
  query
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View
} from "react-native";
import CoordinatorOnboardingTab from "./CoordinatorOnboardingTab";
import DriverOnboardingTab from "./DriverOnboardingTab";

interface UserAccount {
  id: string;
  displayName: string;
  email: string;
  role: string;
  employeeId?: string;
  licenseNumber?: string;
  assignedBarangay?: string;
  barangay?: string;
  phoneNumber?: string;
  contactInfo?: string;
  currentTruckId?: string;
  currentTruckPlate?: string;
  zone?: string;
  status?: string;
  createdAt: any;
}

type SortField = "name" | "role" | "credentials" | "assignment";
type SortDirection = "asc" | "desc";

export default function DriverAccountsTab({
  initialSubTab = "all",
  initialOpenOnboarding = false,
}: {
  initialSubTab?: string;
  initialOpenOnboarding?: boolean;
}) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const normalizedInitialTab =
    initialSubTab === "coordinators" || initialSubTab === "coordinator"
      ? "coordinator"
      : initialSubTab === "drivers" || initialSubTab === "driver"
        ? "driver"
        : initialSubTab === "users" || initialSubTab === "user"
          ? "user"
          : "all";
  const [activeTab, setActiveTab] = useState<
    "all" | "user" | "driver" | "coordinator"
  >(normalizedInitialTab as any);
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(
    initialOpenOnboarding,
  );
  const [isOnboardCoordinatorModalOpen, setIsOnboardCoordinatorModalOpen] =
    useState(false);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Sorting State (Default: Employee / License in ascending order)
  const [sortField, setSortField] = useState<SortField>("credentials");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Read-only Details Inspector Modal State
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);

  const handleHeaderSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsubUsers = onSnapshot(q, (snap) => {
      const userList: UserAccount[] = [];
      snap.forEach((d) => {
        const data = d.data();
        const role = String(data.role || "user").toLowerCase();
        // CENRO cannot see DICT or Admin accounts in the operational directory
        if (
          role === "dict" ||
          role === "admin" ||
          String(data.email || "")
            .toLowerCase()
            .includes("dict@")
        ) {
          return;
        }
        userList.push({
          id: d.id,
          displayName: data.displayName || data.name || "Unknown Name",
          email: data.email || "No email",
          role: data.role || "user",
          employeeId: data.employeeId || "",
          licenseNumber: data.licenseNumber || "",
          assignedBarangay: data.assignedBarangay || data.barangay || "",
          barangay: data.barangay || "",
          phoneNumber: data.phoneNumber || data.contactInfo || "",
          contactInfo: data.contactInfo || "",
          currentTruckId: data.currentTruckId || null,
          currentTruckPlate: data.currentTruckPlate || null,
          zone: data.zone || "",
          status: data.status || "active",
          createdAt: data.createdAt,
        });
      });
      setUsers(userList);
      setLoading(false);
    });

    const unsubTrucks = onSnapshot(collection(db, "trucks"), (snap) => {
      const truckList: any[] = [];
      snap.forEach((d) => {
        truckList.push({ id: d.id, ...d.data() });
      });
      setTrucks(truckList);
    });

    return () => {
      unsubUsers();
      unsubTrucks();
    };
  }, []);

  const handleOpenDetails = (user: UserAccount) => {
    setSelectedUser(user);
  };

  const getRoleLabel = (role: string) => {
    if (role === "admin") return "Admin";
    if (role === "dict") return "DICT";
    if (role === "coordinator") return "Coordinator";
    if (role === "driver") return "Driver";
    return "Resident";
  };

  const getRoleBadge = (role: string) => {
    if (role === "admin")
      return (
        <View
          style={[
            styles.roleBadge,
            { backgroundColor: "#FEE2E2", borderColor: "#FCA5A5" },
          ]}
        >
          <Text style={[styles.roleText, { color: "#B91C1C" }]}>Admin</Text>
        </View>
      );
    if (role === "dict")
      return (
        <View
          style={[
            styles.roleBadge,
            { backgroundColor: "#F5F3FF", borderColor: "#DDD6FE" },
          ]}
        >
          <Text style={[styles.roleText, { color: "#6D28D9" }]}>DICT</Text>
        </View>
      );
    if (role === "driver")
      return (
        <View
          style={[
            styles.roleBadge,
            { backgroundColor: "#E0F2FE", borderColor: "#BAE6FD" },
          ]}
        >
          <Text style={[styles.roleText, { color: "#0369A1" }]}>Driver</Text>
        </View>
      );
    if (role === "coordinator")
      return (
        <View
          style={[
            styles.roleBadge,
            { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" },
          ]}
        >
          <Text style={[styles.roleText, { color: "#92400E" }]}>
            Coordinator
          </Text>
        </View>
      );
    return (
      <View
        style={[
          styles.roleBadge,
          { backgroundColor: "#F3F4F6", borderColor: "#E5E7EB" },
        ]}
      >
        <Text style={[styles.roleText, { color: "#4B5563" }]}>Resident</Text>
      </View>
    );
  };

  const getCredentialsSortKey = (u: UserAccount) => {
    if (u.role === "driver") {
      return (u.employeeId || u.licenseNumber || "Not set").toUpperCase();
    }
    if (u.role === "coordinator") {
      return (
        u.employeeId || (u.zone ? `Zone ${u.zone}` : "Not set")
      ).toUpperCase();
    }
    return "Resident Account";
  };

  const userCount = useMemo(
    () =>
      users.filter((u) => u.role === "user" || !u.role || u.role === "resident")
        .length,
    [users],
  );
  const driverCount = useMemo(
    () => users.filter((u) => u.role === "driver").length,
    [users],
  );
  const coordinatorCount = useMemo(
    () => users.filter((u) => u.role === "coordinator").length,
    [users],
  );
  const allCount = users.length;

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.assignedBarangay || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      (u.employeeId || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.licenseNumber || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole =
      activeTab === "all" ||
      u.role === activeTab ||
      (activeTab === "user" &&
        (u.role === "user" || !u.role || u.role === "resident"));

    return (
      u.role !== "dict" && u.role !== "admin" && matchesSearch && matchesRole
    );
  });

  const sortedUsers = useMemo(() => {
    return [...filteredUsers].sort((a, b) => {
      let comparison = 0;

      if (sortField === "role") {
        const roleA = getRoleLabel(a.role).toLowerCase();
        const roleB = getRoleLabel(b.role).toLowerCase();
        comparison = roleA.localeCompare(roleB, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      } else if (sortField === "credentials") {
        const credA = getCredentialsSortKey(a).toLowerCase();
        const credB = getCredentialsSortKey(b).toLowerCase();
        comparison = credA.localeCompare(credB, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      } else if (sortField === "assignment") {
        const assignA = (
          a.assignedBarangay ||
          a.barangay ||
          "No Barangay"
        ).toLowerCase();
        const assignB = (
          b.assignedBarangay ||
          b.barangay ||
          "No Barangay"
        ).toLowerCase();
        comparison = assignA.localeCompare(assignB, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      } else {
        // Default: sort by name
        const nameA = (a.displayName || a.email || "").toLowerCase();
        const nameB = (b.displayName || b.email || "").toLowerCase();
        comparison = nameA.localeCompare(nameB, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      }

      // Tie breaker: sort by display name
      if (comparison === 0) {
        comparison = (a.displayName || "").localeCompare(b.displayName || "");
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredUsers, sortField, sortDirection]);

  return (
    <ScrollView style={[styles.container, isMobile && { padding: 14 }]}>
      {/* Header with Title and + Onboard New Driver Action Button */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: isMobile ? "flex-start" : "center",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <View>
          <Text style={styles.headerSubtitle}>ADMINISTRATIVE MANAGEMENT</Text>
          <Text style={styles.headerTitle}>Accounts Directory</Text>
        </View>

        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          <TouchableOpacity
            style={styles.onboardBtn}
            onPress={() => setIsOnboardModalOpen(true)}
            activeOpacity={0.85}
          >
            <MaterialIcons
              name="person-add"
              size={18}
              color="#FFFFFF"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.onboardBtnText}>Add Driver</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.onboardCoordBtn}
            onPress={() => setIsOnboardCoordinatorModalOpen(true)}
            activeOpacity={0.85}
          >
            <MaterialIcons
              name="supervised-user-circle"
              size={18}
              color="#FFFFFF"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.onboardBtnText}>Add Coordinator</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Controls Bar: Tabs on Left, Search Bar on Right */}
      <View
        style={[
          styles.controlsRow,
          isMobile && {
            flexDirection: "column-reverse",
            gap: 12,
            alignItems: "stretch",
          },
        ]}
      >
        {/* Left: Role Tabs (All, Users, Drivers, Coordinators) */}
        <View
          style={[
            styles.subTabContainer,
            { marginBottom: 0, flexWrap: "wrap" },
          ]}
        >
          {[
            { id: "all" as const, label: `All (${allCount})`, icon: "people" },
            {
              id: "user" as const,
              label: `Users (${userCount})`,
              icon: "person",
            },
            {
              id: "driver" as const,
              label: `Drivers (${driverCount})`,
              icon: "local-shipping",
            },
            {
              id: "coordinator" as const,
              label: `Coordinators (${coordinatorCount})`,
              icon: "supervised-user-circle",
            },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.subTabBtn,
                activeTab === tab.id && styles.subTabBtnActive,
              ]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name={tab.icon as any}
                size={17}
                color={activeTab === tab.id ? "#1B4D3E" : "#64748B"}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.subTabBtnText,
                  activeTab === tab.id && styles.subTabBtnTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Right: Search Box */}
        <View
          style={[
            styles.searchBox,
            {
              maxWidth: isMobile ? "100%" : 340,
              width: isMobile ? "100%" : 340,
            },
          ]}
        >
          <MaterialIcons
            name="search"
            size={18}
            color="#94A3B8"
            style={{ marginRight: 8 }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name, email, ID..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <MaterialIcons name="close" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Main Table Card */}
      <View
        style={[styles.card, isMobile && { padding: 14 }, { marginTop: 14 }]}
      >
        <ScrollView
          horizontal={isMobile}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, minWidth: "100%" }}
          style={{ width: "100%" }}
        >
          <View
            style={{
              minWidth: isMobile ? 720 : "100%",
              width: "100%",
            }}
          >
            <View style={styles.tableHead}>
              {/* Column 1: Employee / License */}
              <TouchableOpacity
                style={[styles.thBtn, { flex: 2.0 }]}
                onPress={() => handleHeaderSort("credentials")}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.th,
                    sortField === "credentials" && styles.thActive,
                  ]}
                >
                  EMPLOYEE / LICENSE
                </Text>
                <MaterialIcons
                  name={
                    sortField === "credentials"
                      ? sortDirection === "asc"
                        ? "arrow-upward"
                        : "arrow-downward"
                      : "unfold-more"
                  }
                  size={14}
                  color={sortField === "credentials" ? "#1B4D3E" : "#94A3B8"}
                />
              </TouchableOpacity>

              {/* Column 2: User Name & Email */}
              <TouchableOpacity
                style={[styles.thBtn, { flex: 2.6 }]}
                onPress={() => handleHeaderSort("name")}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.th, sortField === "name" && styles.thActive]}
                >
                  USER NAME & EMAIL
                </Text>
                <MaterialIcons
                  name={
                    sortField === "name"
                      ? sortDirection === "asc"
                        ? "arrow-upward"
                        : "arrow-downward"
                      : "unfold-more"
                  }
                  size={14}
                  color={sortField === "name" ? "#1B4D3E" : "#94A3B8"}
                />
              </TouchableOpacity>

              {/* Column 3: Barangay & Vehicle */}
              <TouchableOpacity
                style={[styles.thBtn, { flex: 1.8 }]}
                onPress={() => handleHeaderSort("assignment")}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.th,
                    sortField === "assignment" && styles.thActive,
                  ]}
                >
                  BARANGAY & VEHICLE
                </Text>
                <MaterialIcons
                  name={
                    sortField === "assignment"
                      ? sortDirection === "asc"
                        ? "arrow-upward"
                        : "arrow-downward"
                      : "unfold-more"
                  }
                  size={14}
                  color={sortField === "assignment" ? "#1B4D3E" : "#94A3B8"}
                />
              </TouchableOpacity>

              {/* Column 4: Role (next to Actions) */}
              <TouchableOpacity
                style={[styles.thBtn, { flex: 1.2 }]}
                onPress={() => handleHeaderSort("role")}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.th, sortField === "role" && styles.thActive]}
                >
                  ROLE
                </Text>
                <MaterialIcons
                  name={
                    sortField === "role"
                      ? sortDirection === "asc"
                        ? "arrow-upward"
                        : "arrow-downward"
                      : "unfold-more"
                  }
                  size={14}
                  color={sortField === "role" ? "#1B4D3E" : "#94A3B8"}
                />
              </TouchableOpacity>

              {/* Column 5: Actions */}
              <View
                style={{
                  flex: 1.1,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={styles.th}>ACTIONS</Text>
              </View>
            </View>

            {loading ? (
              <View style={{ padding: 40, alignItems: "center" }}>
                <ActivityIndicator size="large" color="#1B4D3E" />
                <Text style={{ marginTop: 10, color: "#64748B", fontSize: 13 }}>
                  Loading accounts directory…
                </Text>
              </View>
            ) : sortedUsers.length === 0 ? (
              <View style={{ padding: 40, alignItems: "center" }}>
                <Text style={{ color: "#6B7280", fontSize: 13 }}>
                  No matching user accounts found.
                </Text>
              </View>
            ) : (
              sortedUsers.map((row) => (
                <View key={row.id} style={styles.tableRow}>
                  {/* Column 1: Employee / License */}
                  <View style={{ flex: 2.0 }}>
                    {row.role === "driver" ? (
                      <>
                        <Text
                          style={{
                            color: "#0F172A",
                            fontSize: 12,
                            fontWeight: "700",
                          }}
                        >
                          ID: {row.employeeId || "Not set"}
                        </Text>
                        <Text
                          style={{
                            color: "#64748B",
                            fontSize: 11,
                            marginTop: 1,
                          }}
                        >
                          Lic: {row.licenseNumber || "Not set"}
                        </Text>
                      </>
                    ) : row.role === "coordinator" ? (
                      <>
                        <Text
                          style={{
                            color: "#0F172A",
                            fontSize: 12,
                            fontWeight: "700",
                          }}
                        >
                          ID: {row.employeeId || "Not set"}
                        </Text>
                        {row.zone ? (
                          <Text
                            style={{
                              color: "#64748B",
                              fontSize: 11,
                              marginTop: 1,
                            }}
                          >
                            Zone: {row.zone}
                          </Text>
                        ) : null}
                      </>
                    ) : (
                      <Text
                        style={{
                          color: "#94A3B8",
                          fontSize: 12,
                          fontStyle: "italic",
                        }}
                      >
                        Resident Account
                      </Text>
                    )}
                  </View>

                  {/* Column 2: User Name & Email */}
                  <View
                    style={{
                      flex: 2.6,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <View
                      style={[
                        styles.avatarBadge,
                        row.role === "driver" && {
                          backgroundColor: "#E0F2FE",
                        },
                        row.role === "coordinator" && {
                          backgroundColor: "#FEF3C7",
                        },
                        row.role === "admin" && {
                          backgroundColor: "#FEE2E2",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.avatarText,
                          row.role === "driver" && { color: "#0369A1" },
                          row.role === "coordinator" && { color: "#92400E" },
                          row.role === "admin" && { color: "#B91C1C" },
                        ]}
                      >
                        {row.displayName.substring(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userName} numberOfLines={1}>
                        {row.displayName}
                      </Text>
                      <Text style={styles.userEmail} numberOfLines={1}>
                        {row.email}
                      </Text>
                    </View>
                  </View>

                  {/* Column 3: Barangay & Vehicle */}
                  <View style={{ flex: 1.8 }}>
                    {row.assignedBarangay ? (
                      <Text
                        style={{
                          color: "#047857",
                          fontSize: 12,
                          fontWeight: "700",
                        }}
                      >
                        Brgy. {row.assignedBarangay}
                      </Text>
                    ) : row.barangay ? (
                      <Text
                        style={{
                          color: "#047857",
                          fontSize: 12,
                          fontWeight: "700",
                        }}
                      >
                        Brgy. {row.barangay}
                      </Text>
                    ) : (
                      <Text
                        style={{
                          color: "#94A3B8",
                          fontSize: 12,
                          fontStyle: "italic",
                        }}
                      >
                        No Barangay
                      </Text>
                    )}
                    {row.role === "driver" &&
                      (row.currentTruckPlate ? (
                        <View style={[styles.truckBadge, { marginTop: 3 }]}>
                          <Text style={styles.truckBadgeText}>
                            🚚 {row.currentTruckPlate}
                          </Text>
                        </View>
                      ) : (
                        <Text
                          style={{
                            color: "#9CA3AF",
                            fontSize: 11,
                            fontStyle: "italic",
                            marginTop: 2,
                          }}
                        >
                          No Truck
                        </Text>
                      ))}
                  </View>

                  {/* Column 4: Role (next to Actions) */}
                  <View
                    style={{
                      flex: 1.2,
                      alignItems: "flex-start",
                      justifyContent: "center",
                    }}
                  >
                    {getRoleBadge(row.role)}
                  </View>

                  {/* Column 5: Actions */}
                  <View
                    style={{
                      flex: 1.1,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => handleOpenDetails(row)}
                      style={styles.actionEyeBtn}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons
                        name="visibility"
                        size={17}
                        color="#1B4D3E"
                      />
                      <Text style={styles.actionEyeText}>Details</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>

      {/* Account Details & Information Inspector Modal (Read-Only) */}
      {selectedUser && (
        <Modal visible={true} transparent={true} animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    flex: 1,
                  }}
                >
                  <View
                    style={[
                      styles.modalAvatar,
                      selectedUser.role === "driver" && {
                        backgroundColor: "#E0F2FE",
                      },
                      selectedUser.role === "coordinator" && {
                        backgroundColor: "#FEF3C7",
                      },
                      selectedUser.role === "admin" && {
                        backgroundColor: "#FEE2E2",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalAvatarText,
                        selectedUser.role === "driver" && { color: "#0369A1" },
                        selectedUser.role === "coordinator" && {
                          color: "#92400E",
                        },
                        selectedUser.role === "admin" && { color: "#B91C1C" },
                      ]}
                    >
                      {selectedUser.displayName.substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalUserName}>
                      {selectedUser.displayName || "No Name"}
                    </Text>
                    <Text style={styles.modalUserEmail}>
                      {selectedUser.email}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setSelectedUser(null)}
                  style={styles.modalCloseBtn}
                >
                  <MaterialIcons name="close" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Modal Body: Read-only Profile Information */}
              <ScrollView
                style={styles.modalBody}
                showsVerticalScrollIndicator={false}
              >
                {/* Role & Status Overview */}
                <View style={styles.detailRoleStatusCard}>
                  <View>
                    <Text style={styles.detailCardLabel}>ACCOUNT ROLE</Text>
                    <View style={{ marginTop: 4 }}>
                      {getRoleBadge(selectedUser.role)}
                    </View>
                  </View>

                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.detailCardLabel}>ACCOUNT STATUS</Text>
                    <View style={styles.activeStatusBadge}>
                      <View style={styles.activeDot} />
                      <Text style={styles.activeStatusText}>Active</Text>
                    </View>
                  </View>
                </View>

                {/* Details List */}
                <View style={{ gap: 10 }}>
                  {/* Jurisdiction / Barangay */}
                  <View style={styles.detailInfoBox}>
                    <View style={styles.detailInfoIcon}>
                      <MaterialIcons
                        name="location-on"
                        size={18}
                        color="#1B4D3E"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailCardLabel}>
                        ASSIGNED BARANGAY / JURISDICTION
                      </Text>
                      <Text style={styles.detailCardValue}>
                        {selectedUser.assignedBarangay || selectedUser.barangay
                          ? `Brgy. ${selectedUser.assignedBarangay || selectedUser.barangay}`
                          : "No Barangay Assigned"}
                      </Text>
                    </View>
                  </View>

                  {/* Driver Specific Credentials */}
                  {selectedUser.role === "driver" && (
                    <View style={styles.detailInfoBox}>
                      <View style={styles.detailInfoIcon}>
                        <MaterialIcons name="badge" size={18} color="#0284C7" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.detailCardLabel}>
                          DRIVER CREDENTIALS
                        </Text>
                        <Text style={styles.detailCardValue}>
                          Employee ID:{" "}
                          <Text style={{ fontWeight: "800", color: "#0F172A" }}>
                            {selectedUser.employeeId || "Not set"}
                          </Text>
                        </Text>
                        <Text
                          style={[
                            styles.detailCardValue,
                            { marginTop: 2, fontSize: 12, color: "#64748B" },
                          ]}
                        >
                          LTO License: {selectedUser.licenseNumber || "Not set"}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Coordinator Specific Credentials */}
                  {selectedUser.role === "coordinator" && (
                    <View style={styles.detailInfoBox}>
                      <View style={styles.detailInfoIcon}>
                        <MaterialIcons
                          name="supervised-user-circle"
                          size={18}
                          color="#D97706"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.detailCardLabel}>
                          COORDINATOR DESIGNATION
                        </Text>
                        <Text style={styles.detailCardValue}>
                          Coordinator ID:{" "}
                          <Text style={{ fontWeight: "800", color: "#0F172A" }}>
                            {selectedUser.employeeId || "Not set"}
                          </Text>
                        </Text>
                        {selectedUser.zone ? (
                          <Text
                            style={[
                              styles.detailCardValue,
                              { marginTop: 2, fontSize: 12, color: "#64748B" },
                            ]}
                          >
                            Sector / Zone: {selectedUser.zone}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  )}

                  {/* Truck Assignment (Driver only) */}
                  {selectedUser.role === "driver" && (
                    <View style={styles.detailInfoBox}>
                      <View style={styles.detailInfoIcon}>
                        <MaterialIcons
                          name="local-shipping"
                          size={18}
                          color="#059669"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.detailCardLabel}>
                          ASSIGNED TRUCK / COMPACTOR
                        </Text>
                        <Text style={styles.detailCardValue}>
                          {selectedUser.currentTruckPlate
                            ? `🚚 ${selectedUser.currentTruckPlate}`
                            : "No Truck Assigned"}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Contact Info */}
                  <View style={styles.detailInfoBox}>
                    <View style={styles.detailInfoIcon}>
                      <MaterialIcons name="phone" size={18} color="#475569" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailCardLabel}>
                        CONTACT PHONE NUMBER
                      </Text>
                      <Text style={styles.detailCardValue}>
                        {selectedUser.phoneNumber ||
                          selectedUser.contactInfo ||
                          "Not Provided"}
                      </Text>
                    </View>
                  </View>

                  {/* Registration Date */}
                  <View style={styles.detailInfoBox}>
                    <View style={styles.detailInfoIcon}>
                      <MaterialIcons
                        name="calendar-today"
                        size={18}
                        color="#64748B"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailCardLabel}>
                        ACCOUNT REGISTERED
                      </Text>
                      <Text style={styles.detailCardValue}>
                        {selectedUser.createdAt?.toDate
                          ? selectedUser.createdAt
                              .toDate()
                              .toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })
                          : "Active Account"}
                      </Text>
                    </View>
                  </View>
                </View>
              </ScrollView>

              {/* Modal Footer (Read-Only) */}
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCloseDoneBtn}
                  onPress={() => setSelectedUser(null)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.modalCloseDoneBtnText}>
                    Close Details
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Onboard New Driver Modal */}
      {isOnboardModalOpen && (
        <Modal
          visible={isOnboardModalOpen}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsOnboardModalOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.onboardModalContainer,
                isMobile && { width: "95%", height: "92%" },
              ]}
            >
              <DriverOnboardingTab
                onClose={() => setIsOnboardModalOpen(false)}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Onboard New Coordinator Modal (1 Coordinator per Barangay) */}
      {isOnboardCoordinatorModalOpen && (
        <Modal
          visible={isOnboardCoordinatorModalOpen}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsOnboardCoordinatorModalOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.onboardModalContainer,
                isMobile && { width: "95%", height: "92%" },
              ]}
            >
              <CoordinatorOnboardingTab
                onClose={() => setIsOnboardCoordinatorModalOpen(false)}
              />
            </View>
          </View>
        </Modal>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC", padding: 24 },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#059669",
    letterSpacing: 1,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 18,
  },

  subTabContainer: { flexDirection: "row", gap: 10, marginBottom: 18 },
  subTabBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
  },
  subTabBtnActive: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#1B4D3E",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  subTabBtnText: { fontSize: 13, fontWeight: "700", color: "#64748B" },
  subTabBtnTextActive: { color: "#1B4D3E", fontWeight: "800" },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },

  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: 440,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  searchInput: { flex: 1, fontSize: 13, color: "#0F172A", padding: 0 },

  roleFilterPills: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  rolePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  rolePillActive: { backgroundColor: "#1B4D3E", borderColor: "#1B4D3E" },
  rolePillText: { fontSize: 11, fontWeight: "700", color: "#64748B" },
  rolePillTextActive: { color: "#FFFFFF" },

  tableHead: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 6,
  },
  thBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  th: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  thActive: { color: "#1B4D3E", fontWeight: "900" },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },

  avatarBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 12, fontWeight: "800", color: "#166534" },
  userName: { fontWeight: "800", color: "#0F172A", fontSize: 13.5 },
  userEmail: { color: "#64748B", fontSize: 11.5, marginTop: 1 },

  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  roleText: { fontSize: 10.5, fontWeight: "800", textTransform: "uppercase" },

  truckBadge: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  truckBadgeText: { fontSize: 11, fontWeight: "700", color: "#047857" },

  actionEyeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionEyeText: { fontSize: 11.5, fontWeight: "800", color: "#1B4D3E" },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "90%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    backgroundColor: "#F8FAFC",
  },
  modalAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  modalAvatarText: { fontSize: 14, fontWeight: "800", color: "#166534" },
  modalUserName: { fontSize: 15, fontWeight: "800", color: "#0F172A" },
  modalUserEmail: { fontSize: 12, color: "#64748B", marginTop: 1 },
  modalCloseBtn: { padding: 6, borderRadius: 6 },

  modalBody: { padding: 18 },
  modalSectionTitle: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#334155",
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: "uppercase",
  },

  rolePickerRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  roleSelectBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  roleSelectBtnActive: { backgroundColor: "#1B4D3E", borderColor: "#1B4D3E" },
  roleSelectBtnText: { fontSize: 12, fontWeight: "700", color: "#475569" },
  roleSelectBtnTextActive: { color: "#FFFFFF" },

  fieldLabel: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  modalInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: "#0F172A",
    marginBottom: 12,
  },

  modalDropdown: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modalDropdownText: { fontSize: 13, fontWeight: "600", color: "#0F172A" },
  modalDropdownMenu: {
    position: "absolute",
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 100,
  },
  modalDropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  modalDropdownItemText: { fontSize: 12.5, color: "#334155" },

  roleSpecificBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  roleSpecificTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1B4D3E",
    marginBottom: 10,
  },

  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    backgroundColor: "#F8FAFC",
  },
  modalCloseDoneBtn: {
    backgroundColor: "#1B4D3E",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  modalCloseDoneBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  detailRoleStatusCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
  },
  activeStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 6,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#059669",
  },
  activeStatusText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#065F46",
  },
  detailInfoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  detailInfoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  detailCardLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  detailCardValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },

  onboardBtn: {
    backgroundColor: "#1B4D3E",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: "#1B4D3E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  onboardCoordBtn: {
    backgroundColor: "#0D9488",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: "#0D9488",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  onboardBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  onboardModalContainer: {
    width: 900,
    maxWidth: "96%",
    height: "90%",
    maxHeight: 850,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
});
