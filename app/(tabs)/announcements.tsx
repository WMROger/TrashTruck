import { useAuthContext } from "@/components/AuthContext";
import { db } from "@/config/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import { SafeAreaView } from "react-native-safe-area-context";

interface Announcement {
  id: string;
  title: string;
  description: string;
  datePosted: string;
  priority: "Low" | "Medium" | "High" | "Urgent";
  category: string;
  createdAt: any;
  publishedAt?: any;
}

interface Comment {
  id: string;
  announcementId: string;
  userId: string;
  userDisplayName: string;
  userPhotoURL?: string;
  comment: string;
  createdAt: any;
}

export default function AnnouncementsScreen() {
  const { user, isAuthenticated } = useAuthContext();
  const params = useLocalSearchParams();
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] =
    useState<Announcement | null>(null);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [hasHandledDeepLink, setHasHandledDeepLink] = useState(false);
  const [visibleCommentsCount, setVisibleCommentsCount] = useState(3);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 5;

  const priorityItems = [
    { label: "All Priority", value: null },
    { label: "Low", value: "Low" },
    { label: "Medium", value: "Medium" },
    { label: "Urgent", value: "Urgent" },
  ];

  const categoryItems = [
    { label: "All Category", value: null },
    { label: "General", value: "General" },
    { label: "Schedule Change", value: "Schedule Change" },
    { label: "Service Update", value: "Service Update" },
    { label: "Emergency", value: "Emergency" },
    { label: "Maintenance", value: "Maintenance" },
    { label: "Holiday Notice", value: "Holiday Notice" },
    { label: "Policy Update", value: "Policy Update" },
  ];

  // Fetch published announcements from Firestore
  useEffect(() => {
    if (!db) {
      setError("Firebase not initialized");
      setLoading(false);
      return;
    }

    console.log("Setting up announcements listener...");

    const announcementsRef = collection(db, "announcements");
    const q = query(announcementsRef, where("isPublished", "==", true));
    const openCommentModal = (announcement: Announcement) => {
      setSelectedAnnouncement(announcement);
      setCommentModalVisible(true);
      setCommentText("");
      setHasHandledDeepLink(false);
      setVisibleCommentsCount(3); // Reset on open
    };

    const closeCommentModal = () => {
      setCommentModalVisible(false);
      setSelectedAnnouncement(null);
      setCommentText("");
      setHasHandledDeepLink(false);
      setVisibleCommentsCount(3); // Reset on close
    };
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log(
          "Announcements snapshot received:",
          snapshot.docs.length,
          "documents"
        );

        const announcementsData: Announcement[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || "",
            description: data.description || "",
            datePosted: data.datePosted || "",
            priority: data.priority || "Medium",
            category: data.category || "General",
            createdAt: data.createdAt,
            publishedAt: data.publishedAt,
          };
        });

        // Sort by creation date (newest first) on the client side
        announcementsData.sort((a, b) => {
          const dateA = a.createdAt?.toDate
            ? a.createdAt.toDate()
            : new Date(a.createdAt);
          const dateB = b.createdAt?.toDate
            ? b.createdAt.toDate()
            : new Date(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        });

        console.log("Processed announcements:", announcementsData.length);
        setAnnouncements(announcementsData);
        setLoading(false);
        setError(null);
      },
      (error) => {
        console.error("Error fetching announcements:", error);
        setError("Failed to fetch announcements");
        setLoading(false);
      }
    );

    return () => {
      console.log("Cleaning up announcements listener");
      unsubscribe();
    };
  }, []);

  // Fetch comments for all announcements
  useEffect(() => {
    if (!db || announcements.length === 0) return;

    console.log("Setting up comments listener...");

    const commentsRef = collection(db, "comments");

    // Try to fetch comments, but handle permission errors gracefully
    const q = query(
      commentsRef,
      where(
        "announcementId",
        "in",
        announcements.map((a) => a.id)
      ),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log(
          "Comments snapshot received:",
          snapshot.docs.length,
          "documents"
        );

        const commentsData: Comment[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            announcementId: data.announcementId || "",
            userId: data.userId || "",
            userDisplayName: data.userDisplayName || "Anonymous",
            userPhotoURL: data.userPhotoURL || "",
            comment: data.comment || "",
            createdAt: data.createdAt,
          };
        });

        console.log("Processed comments:", commentsData.length);
        setComments(commentsData);
      },
      (error) => {
        console.error("Error fetching comments:", error);
        // If it's a permission error, show a helpful message
        if (error.code === "permission-denied") {
          console.warn(
            "Comments feature requires Firestore rules to be updated. Please deploy the updated firestore.rules file."
          );
          setError(
            "Comments feature is not available. Please contact administrator to update database permissions."
          );
        }
      }
    );

    return () => {
      console.log("Cleaning up comments listener");
      unsubscribe();
    };
  }, [announcements]);

  // Handle deep linking to open specific announcement modal
  useEffect(() => {
    if (
      params.openModal === "true" &&
      params.announcementId &&
      announcements.length > 0 &&
      !hasHandledDeepLink
    ) {
      const announcement = announcements.find(
        (a) => a.id === params.announcementId
      );
      if (announcement) {
        setSelectedAnnouncement(announcement);
        setCommentModalVisible(true);
        setCommentText("");
        setHasHandledDeepLink(true);

        // Clear the parameters from the URL
        router.replace("/(tabs)/announcements");
      }
    }
  }, [params, announcements, hasHandledDeepLink, router]);

  // Reset deep link handling when component unmounts
  useEffect(() => {
    return () => {
      setHasHandledDeepLink(false);
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    // The real-time listener will automatically update the data
    setTimeout(() => setRefreshing(false), 1000);
  };

  const submitComment = async () => {
    if (!isAuthenticated || !user || !selectedAnnouncement) {
      Alert.alert("Login Required", "Please log in to post comments.");
      return;
    }

    const comment = commentText.trim();
    if (!comment) {
      Alert.alert("Empty Comment", "Please enter a comment before submitting.");
      return;
    }

    if (!db) {
      Alert.alert("Error", "Database not available. Please try again later.");
      return;
    }

    setSubmittingComment(true);

    try {
      await addDoc(collection(db, "comments"), {
        announcementId: selectedAnnouncement.id,
        userId: user.uid,
        userDisplayName: user.displayName || "Anonymous",
        userPhotoURL: user.photoURL || "",
        comment,
        createdAt: serverTimestamp(),
      });

      // Clear the comment text
      setCommentText("");

      console.log("Comment submitted successfully");
    } catch (error: any) {
      console.error("Error submitting comment:", error);

      if (error.code === "permission-denied") {
        Alert.alert(
          "Permission Denied",
          "Comments feature is not available. Please contact administrator to update database permissions."
        );
      } else {
        Alert.alert("Error", "Failed to submit comment. Please try again.");
      }
    } finally {
      setSubmittingComment(false);
    }
  };

  const openCommentModal = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    setCommentModalVisible(true);
    setCommentText("");
    setHasHandledDeepLink(false);
  };

  const closeCommentModal = () => {
    setCommentModalVisible(false);
    setSelectedAnnouncement(null);
    setCommentText("");
    setHasHandledDeepLink(false);
    setVisibleCommentsCount(3); // Reset to 3 when modal closes
  };

  const getCommentsForAnnouncement = (announcementId: string) => {
    return comments
      .filter((comment) => comment.announcementId === announcementId)
      .sort((a, b) => {
        // Sort by most recent first (newest comments at the top)
        const dateA = a.createdAt?.toDate
          ? a.createdAt.toDate()
          : new Date(a.createdAt);
        const dateB = b.createdAt?.toDate
          ? b.createdAt.toDate()
          : new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "Urgent":
        return "#EF4444";
      case "High":
        return "#F97316";
      case "Medium":
        return "#EAB308";
      case "Low":
        return "#22C55E";
      default:
        return "#6B7280";
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "Urgent":
        return "alert-circle";
      case "High":
        return "warning";
      case "Medium":
        return "information-circle";
      case "Low":
        return "checkmark-circle";
      default:
        return "ellipse";
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case "general":
        return "#22C55E"; // Green
      case "schedule change":
        return "#F59E42"; // Orange
      case "service update":
        return "#3B82F6"; // Blue
      case "emergency":
        return "#EF4444"; // Red
      case "maintenance":
        return "#6366F1"; // Indigo
      case "holiday notice":
        return "#FBBF24"; // Yellow
      case "policy update":
        return "#6B7280"; // Gray
      default:
        return "#9CA3AF"; // Light gray for unknown
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Unknown date";

    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Invalid date";
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#22C55E" />
          <Text style={styles.loadingText}>Loading announcements...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setError(null);
              setLoading(true);
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Announcements</Text>
        <Text style={styles.subtitle}>Stay updated with the latest news</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#22C55E"]}
              tintColor="#22C55E"
            />
          }
        >
          {/* Filter Dropdowns */}
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
            <DropDownPicker
              open={priorityOpen}
              value={priorityFilter}
              items={priorityItems}
              setOpen={setPriorityOpen}
              setValue={setPriorityFilter}
              setItems={() => {}}
              style={{ flex: 1, minHeight: 40 }}
              containerStyle={{ flex: 1 }}
              placeholder="Select Priority"
            />
            <DropDownPicker
              open={categoryOpen}
              value={categoryFilter}
              items={categoryItems}
              setOpen={setCategoryOpen}
              setValue={setCategoryFilter}
              setItems={() => {}}
              style={{ flex: 1, minHeight: 40 }}
              containerStyle={{ flex: 1 }}
              placeholder="Select Category"
            />
          </View>

          {announcements.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="megaphone-outline" size={64} color="#9CA3AF" />
              <Text style={styles.emptyText}>No announcements yet</Text>
              <Text style={styles.emptySubtext}>
                Check back later for updates
              </Text>
            </View>
          ) : (
            (() => {
              let filtered = announcements;
              if (priorityFilter) {
                filtered = filtered.filter((a) => a.priority === priorityFilter);
              }
              if (categoryFilter) {
                filtered = filtered.filter((a) => a.category === categoryFilter);
              }
              const paged = filtered.slice(0, page * PAGE_SIZE);

              if (paged.length === 0) {
                return (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="megaphone-outline" size={64} color="#9CA3AF" />
                    <Text style={styles.emptyText}>No announcements found</Text>
                    <Text style={styles.emptySubtext}>
                      Try changing your filters.
                    </Text>
                  </View>
                );
              }

              return (
                <FlatList
                  data={paged}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => {
                    const announcementComments = getCommentsForAnnouncement(item.id);

                    return (
                      <View key={item.id} style={styles.announcementCard}>
                        <View style={styles.announcementHeader}>
                          <View style={styles.priorityContainer}>
                            <Ionicons
                              name={getPriorityIcon(item.priority)}
                              size={20}
                              color={getPriorityColor(item.priority)}
                            />
                            <Text
                              style={[
                                styles.priorityText,
                                { color: getPriorityColor(item.priority) },
                              ]}
                            >
                              {item.priority}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.categoryText,
                              {
                                backgroundColor: getCategoryColor(item.category),
                                color: "#fff",
                              },
                            ]}
                          >
                            {item.category}
                          </Text>
                        </View>

                        <Text style={styles.announcementTitle}>{item.title}</Text>
                        <Text style={styles.announcementDescription}>
                          {item.description}
                        </Text>

                        <View style={styles.announcementFooter}>
                          <Text style={styles.dateText}>
                            {formatDate(
                              item.publishedAt || item.createdAt
                            )}
                          </Text>
                          <TouchableOpacity
                            style={styles.commentsButton}
                            onPress={() => openCommentModal(item)}
                          >
                            <Ionicons
                              name="chatbubbles-outline"
                              size={16}
                              color="#6B7280"
                            />
                            <Text style={styles.commentsButtonText}>
                              {announcementComments.length}{" "}
                              {announcementComments.length === 1
                                ? "comment"
                                : "comments"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  }}
                  ListHeaderComponent={
                    <View>
                      {/* Place your filter dropdowns here */}
                    </View>
                  }
                  ListFooterComponent={
                    announcements.length > page * PAGE_SIZE ? (
                      <TouchableOpacity
                        style={{
                          alignItems: "center",
                          padding: 12,
                          marginBottom: 16,
                          backgroundColor: "#22C55E",
                          borderRadius: 8,
                        }}
                        onPress={() => setPage(page + 1)}
                      >
                        <Text style={{ color: "#fff", fontWeight: "600" }}>
                          Load More
                        </Text>
                      </TouchableOpacity>
                    ) : null
                  }
                  contentContainerStyle={{ paddingBottom: 24 }}
                />
              );
            })()
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Comment Modal */}
      <Modal
        visible={commentModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeCommentModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={closeCommentModal}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Comments</Text>
            <View style={styles.placeholder} />
          </View>

          {selectedAnnouncement && (
            <>
              {/* Announcement Preview */}
              <View style={styles.announcementPreview}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Ionicons
                      name={getPriorityIcon(selectedAnnouncement.priority)}
                      size={18}
                      color={getPriorityColor(selectedAnnouncement.priority)}
                    />
                    <Text
                      style={{
                        marginLeft: 6,
                        fontSize: 12,
                        fontWeight: "600",
                        color: getPriorityColor(selectedAnnouncement.priority),
                        textTransform: "uppercase",
                      }}
                    >
                      {selectedAnnouncement.priority}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.categoryText,
                      {
                        backgroundColor: getCategoryColor(
                          selectedAnnouncement.category
                        ),
                        color: "#fff",
                        fontWeight: "600",
                        textTransform: "capitalize",
                      },
                    ]}
                  >
                    {selectedAnnouncement.category}
                  </Text>
                </View>
                <Text style={styles.announcementPreviewTitle}>
                  {selectedAnnouncement.title}
                </Text>
                <Text
                  style={styles.announcementPreviewDescription}
                  numberOfLines={2}
                >
                  {selectedAnnouncement.description}
                </Text>
                <Text style={[styles.dateText, { marginTop: 8 }]}>
                  {formatDate(
                    selectedAnnouncement.publishedAt ||
                      selectedAnnouncement.createdAt
                  )}
                </Text>
              </View>

              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.modalContent}
              >
                {/* Comment Input */}
                {isAuthenticated && (
                  <View style={styles.modalCommentInputContainer}>
                    <TextInput
                      style={styles.modalCommentInput}
                      placeholder="Write a comment..."
                      placeholderTextColor="#9CA3AF"
                      value={commentText}
                      onChangeText={setCommentText}
                      multiline
                      maxLength={500}
                    />
                    <TouchableOpacity
                      style={[
                        styles.modalSubmitButton,
                        (!commentText.trim() || submittingComment) &&
                          styles.modalSubmitButtonDisabled,
                      ]}
                      onPress={submitComment}
                      disabled={!commentText.trim() || submittingComment}
                    >
                      {submittingComment ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Ionicons name="send" size={16} color="white" />
                      )}
                    </TouchableOpacity>
                  </View>
                )}
                {/* Comments List */}
                <ScrollView style={styles.modalCommentsList}>
                  {selectedAnnouncement &&
                    (() => {
                      const announcementComments = getCommentsForAnnouncement(
                        selectedAnnouncement.id
                      );
                      if (announcementComments.length === 0) {
                        return (
                          <View style={styles.modalNoCommentsContainer}>
                            <Ionicons
                              name="chatbubbles-outline"
                              size={48}
                              color="#9CA3AF"
                            />
                            <Text style={styles.modalNoCommentsText}>
                              No comments yet
                            </Text>
                            <Text style={styles.modalNoCommentsSubtext}>
                              Be the first to comment!
                            </Text>
                          </View>
                        );
                      }
                      return (
                        <>
                          <View style={styles.modalCommentsHeader}>
                            <Text style={styles.modalCommentsHeaderText}>
                              {announcementComments.length}{" "}
                              {announcementComments.length === 1
                                ? "comment"
                                : "comments"}
                            </Text>
                          </View>
                          {announcementComments
                            .slice(0, visibleCommentsCount)
                            .map((comment) => (
                              <View
                                key={comment.id}
                                style={styles.modalCommentItem}
                              >
                                <View style={styles.modalCommentHeader}>
                                  <View style={styles.modalCommentUserInfo}>
                                    <View style={styles.modalCommentAvatar}>
                                      <Text
                                        style={styles.modalCommentAvatarText}
                                      >
                                        {comment.userDisplayName
                                          .charAt(0)
                                          .toUpperCase()}
                                      </Text>
                                    </View>
                                    <View>
                                      <Text style={styles.modalCommentUserName}>
                                        {comment.userDisplayName}
                                      </Text>
                                      <Text style={styles.modalCommentDate}>
                                        {formatDate(comment.createdAt)}
                                      </Text>
                                    </View>
                                  </View>
                                </View>
                                <Text style={styles.modalCommentText}>
                                  {comment.comment}
                                </Text>
                              </View>
                            ))}
                          {announcementComments.length >
                            visibleCommentsCount && (
                            <TouchableOpacity
                              style={{
                                alignItems: "center",
                                padding: 12,
                              }}
                              onPress={() =>
                                setVisibleCommentsCount((prev) => prev + 3)
                              }
                            >
                              <Text
                                style={{ color: "#2563EB", fontWeight: "600" }}
                              >
                                Load More
                              </Text>
                            </TouchableOpacity>
                          )}
                        </>
                      );
                    })()}
                </ScrollView>
              </KeyboardAvoidingView>
            </>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0FDF4",
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6B7280",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: "#EF4444",
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: "#22C55E",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "600",
    color: "#6B7280",
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
  },
  announcementCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  announcementHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  priorityContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  priorityText: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 6,
    textTransform: "uppercase",
  },
  categoryText: {
    fontSize: 12,
    color: "#6B7280",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  announcementTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 8,
    lineHeight: 24,
  },
  announcementDescription: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
    marginBottom: 16,
  },
  announcementFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  dateText: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  // Comment-related styles
  commentsButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "#F3F4F6",
  },
  commentsButtonText: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 4,
  },
  commentsSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  commentInputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  commentInput: {
    flex: 1,
    fontSize: 14,
    color: "#1F2937",
    maxHeight: 100,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "white",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    marginRight: 8,
  },
  submitCommentButton: {
    backgroundColor: "#22C55E",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 40,
  },
  submitCommentButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  commentsList: {
    marginTop: 8,
  },
  commentsHeader: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  commentsHeaderText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  noCommentsText: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    fontStyle: "italic",
    paddingVertical: 16,
  },
  commentItem: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  commentHeader: {
    marginBottom: 8,
  },
  commentUserInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#22C55E",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  commentAvatarText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  commentUserName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
  commentDate: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  commentText: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: "#F0FDF4",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  closeButton: {
    padding: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
  },
  placeholder: {
    width: 40,
  },
  announcementPreview: {
    backgroundColor: "white",
    padding: 16,
    marginHorizontal: 20,
    marginVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  announcementPreviewTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 8,
  },
  announcementPreviewDescription: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  modalCommentInputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "white",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  modalCommentInput: {
    flex: 1,
    fontSize: 14,
    color: "#1F2937",
    maxHeight: 100,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    marginRight: 8,
  },
  modalSubmitButton: {
    backgroundColor: "#22C55E",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 40,
  },
  modalSubmitButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  modalCommentsList: {
    flex: 1,
  },
  modalNoCommentsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  modalNoCommentsText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "600",
    color: "#6B7280",
  },
  modalNoCommentsSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
  },
  modalCommentsHeader: {
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalCommentsHeaderText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  modalCommentItem: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  modalCommentHeader: {
    marginBottom: 8,
  },
  modalCommentUserInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  modalCommentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#22C55E",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  modalCommentAvatarText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  modalCommentUserName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  modalCommentDate: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  modalCommentText: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
});
