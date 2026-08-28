import { db } from "@/config/firebase";
import { resolveScheduleBarangays } from "@/constants/danaoBarangays";
import { MaterialIcons } from "@expo/vector-icons";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
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

  // Details Inspector & Editing Modal State
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [availableBarangays, setAvailableBarangays] = useState<string[]>([]);
  const [isEditingBarangay, setIsEditingBarangay] = useState(false);
  const [editBarangayValue, setEditBarangayValue] = useState("");
  const [isSavingBarangay, setIsSavingBarangay] = useState(false);
  const [editBarangayDropdownOpen, setEditBarangayDropdownOpen] = useState(false);
  const [editBarangaySearch, setEditBarangaySearch] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  // Compute map of taken barangays -> active coordinator info
  const takenCoordinatorBarangaysMap = useMemo(() => {
    const map: { [barangay: string]: { id: string; name: string } } = {};
    users.forEach((u) => {
      if (u.role === "coordinator") {
        const b = (u.assignedBarangay || u.barangay || "").trim();
        if (b) {
          map[b] = { id: u.id, name: u.displayName || u.email };
        }
      }
    });
    return map;
  }, [users]);

  // Listen to collection schedules for dynamically configured barangays
  useEffect(() => {
    if (!db) return;
    const unsubSchedules = onSnapshot(collection(db, "barangay_schedules"), (snap) => {
      const scheduleNames = new Set<string>();
      snap.forEach((d) => {
        const data = d.data();
        if (data.barangayName && typeof data.barangayName === "string" && data.barangayName.trim()) {
          scheduleNames.add(data.barangayName.trim());
        }
      });
      setAvailableBarangays(resolveScheduleBarangays(Array.from(scheduleNames)));
    });
    return () => unsubSchedules();
  }, []);

  // Reset editing state whenever selected user changes
  useEffect(() => {
    if (selectedUser) {
      setIsEditingBarangay(false);
      setEditBarangayValue(selectedUser.assignedBarangay || selectedUser.barangay || "");
      setEditError(null);
      setEditSuccess(null);
      setEditBarangayDropdownOpen(false);
      setEditBarangaySearch("");
    }
  }, [selectedUser]);

  const handleSaveBarangay = async () => {
    if (!selectedUser || !db) return;
    setEditError(null);
    setEditSuccess(null);

    // If coordinator, check 1-coordinator-per-barangay policy
    if (selectedUser.role === "coordinator" && editBarangayValue) {
      const existing = takenCoordinatorBarangaysMap[editBarangayValue];
      if (existing && existing.id !== selectedUser.id) {
        setEditError(
          `Brgy. ${editBarangayValue} already has an active coordinator (${existing.name}). 1 Coordinator per Barangay policy enforced.`
        );
        return;
      }
    }

    setIsSavingBarangay(true);
    try {
      const userRef = doc(db, "users", selectedUser.id);
      await updateDoc(userRef, {
        assignedBarangay: editBarangayValue.trim(),
        barangay: editBarangayValue.trim(),
        updatedAt: serverTimestamp(),
      });

      setSelectedUser((prev) =>
        prev
          ? {
              ...prev,
              assignedBarangay: editBarangayValue.trim(),
              barangay: editBarangayValue.trim(),
            }
          : null
      );
      setEditSuccess("Barangay assignment updated successfully!");
      setIsEditingBarangay(false);
      setEditBarangayDropdownOpen(false);
    } catch (err: any) {
      console.error("Error updating barangay assignment:", err);
      setEditError(err?.message || "Failed to update barangay assignment.");
    } finally {
      setIsSavingBarangay(false);
    }
  };

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
        // CENRO cannot see CICTO or Admin accounts in the operational directory
        if (
          role === "cicto" ||
          role === "admin" ||
          String(data.email || "")
            .toLowerCase()
            .includes("cicto@")
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
    if (role === "cicto") return "CICTO";
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
    if (role === "cicto")
      return (
        <View
          style={[
            styles.roleBadge,
            { backgroundColor: "#F5F3FF", borderColor: "#DDD6FE" },
          ]}
        >
          <Text style={[styles.roleText, { color: "#6D28D9" }]}>CICTO</Text>
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
      u.role !== "cicto" && u.role !== "admin" && matchesSearch && matchesRole
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
                  {/* Jurisdiction / Barangay (Editable for Driver & Coordinator only) */}
                  {(() => {
                    const canEditBarangay =
                      selectedUser.role === "driver" ||
                      selectedUser.role === "coordinator";

                    if (!isEditingBarangay) {
                      return (
                        <View style={styles.detailInfoBox}>
                          <View style={styles.detailInfoIcon}>
                            <MaterialIcons
                              name="location-on"
                              size={18}
                              color="#1B4D3E"
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                              }}
                            >
                              <Text style={styles.detailCardLabel}>
                                ASSIGNED BARANGAY / JURISDICTION
                              </Text>
                              {canEditBarangay && (
                                <TouchableOpacity
                                  onPress={() => {
                                    setIsEditingBarangay(true);
                                    setEditBarangayValue(
                                      selectedUser.assignedBarangay ||
                                        selectedUser.barangay ||
                                        ""
                                    );
                                    setEditError(null);
                                    setEditSuccess(null);
                                  }}
                                  style={styles.editBarangayPillBtn}
                                  activeOpacity={0.7}
                                >
                                  <MaterialIcons
                                    name="edit"
                                    size={12}
                                    color="#1B4D3E"
                                  />
                                  <Text style={styles.editBarangayPillText}>
                                    Change
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                            <Text style={styles.detailCardValue}>
                              {selectedUser.assignedBarangay ||
                              selectedUser.barangay
                                ? `Brgy. ${selectedUser.assignedBarangay || selectedUser.barangay}`
                                : "No Barangay Assigned"}
                            </Text>
                            {editSuccess && (
                              <View style={styles.editSuccessBanner}>
                                <MaterialIcons
                                  name="check-circle"
                                  size={14}
                                  color="#059669"
                                />
                                <Text style={styles.editSuccessText}>
                                  {editSuccess}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    }

                    return (
                      <View
                        style={[
                          styles.detailInfoBox,
                          styles.detailInfoBoxEditing,
                        ]}
                      >
                        <View style={styles.detailInfoIcon}>
                          <MaterialIcons
                            name="edit-location"
                            size={18}
                            color="#1B4D3E"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginBottom: 8,
                            }}
                          >
                            <Text style={styles.detailCardLabel}>
                              EDIT BARANGAY ASSIGNMENT
                            </Text>
                            <TouchableOpacity
                              onPress={() => {
                                setIsEditingBarangay(false);
                                setEditBarangayDropdownOpen(false);
                                setEditError(null);
                              }}
                              style={styles.editCancelPillBtn}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.editCancelPillText}>
                                Cancel
                              </Text>
                            </TouchableOpacity>
                          </View>

                          {/* Dropdown trigger */}
                          <TouchableOpacity
                            style={styles.editDropdownTrigger}
                            onPress={() =>
                              setEditBarangayDropdownOpen(
                                !editBarangayDropdownOpen
                              )
                            }
                            activeOpacity={0.8}
                          >
                            <Text
                              style={[
                                styles.editDropdownTriggerText,
                                !editBarangayValue && { color: "#9CA3AF" },
                              ]}
                            >
                              {editBarangayValue
                                ? `Brgy. ${editBarangayValue}`
                                : "Select operational barangay..."}
                            </Text>
                            <MaterialIcons
                              name={
                                editBarangayDropdownOpen
                                  ? "keyboard-arrow-up"
                                  : "keyboard-arrow-down"
                              }
                              size={18}
                              color="#6B7280"
                            />
                          </TouchableOpacity>

                          {/* Dropdown menu */}
                          {editBarangayDropdownOpen && (
                            <View style={styles.editDropdownMenu}>
                              <View style={styles.editDropdownSearchContainer}>
                                <MaterialIcons
                                  name="search"
                                  size={14}
                                  color="#6B7280"
                                />
                                <TextInput
                                  value={editBarangaySearch}
                                  onChangeText={setEditBarangaySearch}
                                  placeholder="Filter barangays..."
                                  placeholderTextColor="#9CA3AF"
                                  style={styles.editDropdownSearchInput}
                                />
                                {editBarangaySearch.length > 0 && (
                                  <TouchableOpacity
                                    onPress={() => setEditBarangaySearch("")}
                                  >
                                    <MaterialIcons
                                      name="close"
                                      size={14}
                                      color="#6B7280"
                                    />
                                  </TouchableOpacity>
                                )}
                              </View>

                              <ScrollView
                                nestedScrollEnabled
                                style={{ maxHeight: 180 }}
                                keyboardShouldPersistTaps="handled"
                              >
                                {/* Option to clear/unassign */}
                                <TouchableOpacity
                                  style={[
                                    styles.editDropdownItem,
                                    !editBarangayValue &&
                                      styles.editDropdownItemSelected,
                                  ]}
                                  onPress={() => {
                                    setEditBarangayValue("");
                                    setEditBarangayDropdownOpen(false);
                                    setEditError(null);
                                  }}
                                >
                                  <Text
                                    style={[
                                      styles.editDropdownItemText,
                                      !editBarangayValue && {
                                        fontWeight: "700",
                                        color: "#1B4D3E",
                                      },
                                    ]}
                                  >
                                    (No Barangay Assigned / Clear)
                                  </Text>
                                </TouchableOpacity>

                                {availableBarangays
                                  .filter(
                                    (b) =>
                                      !editBarangaySearch.trim() ||
                                      b
                                        .toLowerCase()
                                        .includes(
                                          editBarangaySearch
                                            .trim()
                                            .toLowerCase()
                                        )
                                  )
                                  .map((b) => {
                                    const isSelected = editBarangayValue === b;
                                    const coordinatorOccupant =
                                      selectedUser.role === "coordinator"
                                        ? takenCoordinatorBarangaysMap[b]
                                        : null;
                                    const isOccupiedByOther =
                                      coordinatorOccupant &&
                                      coordinatorOccupant.id !==
                                        selectedUser.id;

                                    return (
                                      <TouchableOpacity
                                        key={b}
                                        style={[
                                          styles.editDropdownItem,
                                          isSelected &&
                                            styles.editDropdownItemSelected,
                                          isOccupiedByOther && { opacity: 0.6 },
                                        ]}
                                        onPress={() => {
                                          if (isOccupiedByOther) {
                                            setEditError(
                                              `Brgy. ${b} is already assigned to coordinator ${coordinatorOccupant.name}.`
                                            );
                                            return;
                                          }
                                          setEditBarangayValue(b);
                                          setEditBarangayDropdownOpen(false);
                                          setEditError(null);
                                        }}
                                      >
                                        <View
                                          style={{
                                            flex: 1,
                                            flexDirection: "row",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                          }}
                                        >
                                          <Text
                                            style={[
                                              styles.editDropdownItemText,
                                              isSelected && {
                                                fontWeight: "700",
                                                color: "#1B4D3E",
                                              },
                                            ]}
                                          >
                                            {b}
                                          </Text>
                                          {isOccupiedByOther ? (
                                            <View style={styles.takenBadgeMini}>
                                              <Text
                                                style={styles.takenBadgeMiniText}
                                              >
                                                Assigned
                                              </Text>
                                            </View>
                                          ) : (
                                            <View
                                              style={styles.scheduledBadgeMini}
                                            >
                                              <Text
                                                style={
                                                  styles.scheduledBadgeMiniText
                                                }
                                              >
                                                Available
                                              </Text>
                                            </View>
                                          )}
                                        </View>
                                      </TouchableOpacity>
                                    );
                                  })}
                              </ScrollView>
                            </View>
                          )}

                          {editError && (
                            <View style={styles.editErrorBanner}>
                              <MaterialIcons
                                name="error-outline"
                                size={14}
                                color="#B91C1C"
                              />
                              <Text style={styles.editErrorText}>
                                {editError}
                              </Text>
                            </View>
                          )}

                          {/* Action Buttons */}
                          <View
                            style={{
                              flexDirection: "row",
                              gap: 8,
                              marginTop: 10,
                            }}
                          >
                            <TouchableOpacity
                              style={styles.editSaveBtn}
                              onPress={handleSaveBarangay}
                              disabled={isSavingBarangay}
                              activeOpacity={0.8}
                            >
                              {isSavingBarangay ? (
                                <ActivityIndicator
                                  size="small"
                                  color="#FFFFFF"
                                />
                              ) : (
                                <>
                                  <MaterialIcons
                                    name="save"
                                    size={14}
                                    color="#FFFFFF"
                                  />
                                  <Text style={styles.editSaveBtnText}>
                                    Save Assignment
                                  </Text>
                                </>
                              )}
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.editCancelBtn}
                              onPress={() => {
                                setIsEditingBarangay(false);
                                setEditBarangayDropdownOpen(false);
                                setEditError(null);
                              }}
                              disabled={isSavingBarangay}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.editCancelBtnText}>
                                Cancel
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    );
                  })()}

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
  editBarangayPillBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: "#C8E6C9",
  },
  editBarangayPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1B4D3E",
  },
  editCancelPillBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  editCancelPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  detailInfoBoxEditing: {
    backgroundColor: "#F0FDF4",
    borderColor: "#86EFAC",
    borderWidth: 1.5,
  },
  editDropdownTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  editDropdownTriggerText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
  },
  editDropdownMenu: {
    marginTop: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  editDropdownSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  editDropdownSearchInput: {
    flex: 1,
    fontSize: 12,
    color: "#0F172A",
    paddingVertical: 2,
  },
  editDropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  editDropdownItemSelected: {
    backgroundColor: "#DCFCE7",
  },
  editDropdownItemText: {
    fontSize: 12.5,
    color: "#334155",
  },
  takenBadgeMini: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  takenBadgeMiniText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#991B1B",
  },
  scheduledBadgeMini: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  scheduledBadgeMiniText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#166534",
  },
  editErrorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginTop: 8,
  },
  editErrorText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "600",
    color: "#991B1B",
  },
  editSuccessBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
  },
  editSuccessText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },
  editSaveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1B4D3E",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 7,
  },
  editSaveBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  editCancelBtn: {
    justifyContent: "center",
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 7,
  },
  editCancelBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
});
