import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Pressable,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuthContext } from '@/components/AuthContext';
import { db } from '@/config/firebase';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  updateDoc,
  increment,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';

const FILTER_CATEGORIES = [
  'All',
  'General',
  'Schedule Change',
  'Service Update',
  'Emergency',
  'Maintenance',
  'Holiday Notice',
  'Policy Update'
];

export default function AnnouncementsPage() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthContext();
  const [allAnnouncements, setAllAnnouncements] = useState<any[]>([]);
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(5);
  const [likingId, setLikingId] = useState<string | null>(null);

  useEffect(() => {
    if (!db) return;
    const announcementsRef = collection(db, "announcements");
    const q = query(announcementsRef, where("isPublished", "==", true));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        data.sort((a: any, b: any) => {
          const timeA = a.createdAt?.toDate
            ? a.createdAt.toDate().getTime()
            : new Date(a.createdAt || 0).getTime();
          const timeB = b.createdAt?.toDate
            ? b.createdAt.toDate().getTime()
            : new Date(b.createdAt || 0).getTime();
          return timeB - timeA;
        });
        setAllAnnouncements(data);
      },
      (error) => {
        console.warn("Announcements snapshot warning:", error);
      }
    );
    return () => unsubscribe();
  }, []);

  const selectedAnnouncement = allAnnouncements.find(a => a.id === selectedAnnouncementId) || null;

  const handleToggleLike = async (announcement: any) => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to like announcements.');
      return;
    }

    if (!db || !announcement?.id) return;
    if (likingId === announcement.id) return;

    const announcementId = announcement.id;
    const likedByList: string[] = Array.isArray(announcement.likedBy) ? announcement.likedBy : [];
    const isCurrentlyLiked = likedByList.includes(user.uid);
    const currentCount = typeof announcement.likesCount === 'number'
      ? announcement.likesCount
      : likedByList.length;

    const nextLiked = !isCurrentlyLiked;
    const nextLikedBy = nextLiked
      ? [...likedByList, user.uid]
      : likedByList.filter((uid: string) => uid !== user.uid);
    const nextCount = Math.max(0, nextLiked ? currentCount + 1 : currentCount - 1);

    // Optimistic update
    setAllAnnouncements(prev =>
      prev.map(item =>
        item.id === announcementId
          ? { ...item, likedBy: nextLikedBy, likesCount: nextCount }
          : item
      )
    );

    setLikingId(announcementId);

    try {
      const docRef = doc(db, 'announcements', announcementId);
      if (nextLiked) {
        await updateDoc(docRef, {
          likedBy: arrayUnion(user.uid),
          likesCount: increment(1),
        });
      } else {
        await updateDoc(docRef, {
          likedBy: arrayRemove(user.uid),
          likesCount: increment(-1),
        });
      }
    } catch (error: any) {
      console.error('Error toggling like:', error);
      // Roll back optimistic update
      setAllAnnouncements(prev =>
        prev.map(item =>
          item.id === announcementId
            ? { ...item, likedBy: likedByList, likesCount: currentCount }
            : item
        )
      );
      Alert.alert('Unable to Like', error?.message || 'Could not update your like. Please try again.');
    } finally {
      setLikingId(null);
    }
  };

  const filteredAnnouncements = allAnnouncements.filter(announcement => {
    if (selectedFilter === 'All') return true;
    return announcement.category === selectedFilter;
  });

  const displayedAnnouncements = filteredAnnouncements.slice(0, displayCount);
  const hasMore = displayCount < filteredAnnouncements.length;

  // Selected announcement like status
  const isSelectedLiked = !!(
    selectedAnnouncement &&
    user?.uid &&
    Array.isArray(selectedAnnouncement.likedBy) &&
    selectedAnnouncement.likedBy.includes(user.uid)
  );

  const selectedLikesCount = selectedAnnouncement
    ? typeof selectedAnnouncement.likesCount === 'number'
      ? selectedAnnouncement.likesCount
      : (Array.isArray(selectedAnnouncement.likedBy) ? selectedAnnouncement.likedBy.length : 0)
    : 0;

  const formatFullDateTime = (dateVal: any) => {
    if (!dateVal) return 'Recent update';
    const d = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
    if (isNaN(d.getTime())) return 'Recent update';
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getPriorityBadgeStyle = (priority: string = 'Normal') => {
    const p = (priority || '').toLowerCase();
    if (p === 'urgent') return { bg: '#FEE2E2', text: '#DC2626', border: '#FCA5A5', icon: 'error' as const };
    if (p === 'high') return { bg: '#FEF3C7', text: '#D97706', border: '#FCD34D', icon: 'warning' as const };
    if (p === 'low') return { bg: '#F1F5F9', text: '#64748B', border: '#CBD5E1', icon: 'info' as const };
    return { bg: '#E0F2FE', text: '#0284C7', border: '#BAE6FD', icon: 'info' as const };
  };

  return (
    <View style={[styles.container, { backgroundColor: '#C8E6C9' }]}>
      <ScrollView 
        style={styles.scrollContent} 
        contentContainerStyle={{ paddingTop: Math.max(insets.top, 20), paddingBottom: Math.max(insets.bottom, 20) + 100 }}
      >
        {/* Header */}
        <View style={styles.statusBar}>
          <Text style={styles.timeText}>9:41</Text>
          <View style={styles.headerIcons}>
            <IconSymbol name="cellularbars" size={16} color="#000" />
            <IconSymbol name="wifi" size={16} color="#000" />
            <IconSymbol name="battery.100" size={16} color="#000" />
            <Text style={styles.timeTextRight}>9:41</Text>
          </View>
        </View>

        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Announcements</Text>
          <TouchableOpacity 
            style={styles.filterButton}
            onPress={() => setShowFilterModal(true)}
          >
            <IconSymbol name="line.3.horizontal.decrease" size={16} color="#4A6741" />
            <Text style={styles.filterText}>{selectedFilter === 'All' ? 'Filter' : selectedFilter}</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Dropdown Modal */}
        <Modal
          visible={showFilterModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowFilterModal(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowFilterModal(false)}
          >
            <View style={styles.dropdownMenu}>
              <Text style={styles.dropdownHeader}>Filter by Category</Text>
              {FILTER_CATEGORIES.map(category => (
                <TouchableOpacity
                  key={category}
                  style={[styles.dropdownItem, selectedFilter === category && styles.dropdownItemActive]}
                  onPress={() => {
                    setSelectedFilter(category);
                    setDisplayCount(5);
                    setShowFilterModal(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, selectedFilter === category && styles.dropdownItemTextActive]}>
                    {category}
                  </Text>
                  {selectedFilter === category && (
                    <IconSymbol name="checkmark" size={16} color="#4A6741" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Details Modal */}
        <Modal
          visible={!!selectedAnnouncement}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSelectedAnnouncementId(null)}
        >
          <View style={styles.modalOverlay}>
            <Pressable 
              style={StyleSheet.absoluteFill} 
              onPress={() => setSelectedAnnouncementId(null)} 
            />
            <View style={styles.detailsModalContent}>
              {selectedAnnouncement && (() => {
                const priorityCfg = getPriorityBadgeStyle(selectedAnnouncement.priority);
                const fullText = (
                  selectedAnnouncement.description ||
                  selectedAnnouncement.content ||
                  selectedAnnouncement.message ||
                  selectedAnnouncement.details ||
                  selectedAnnouncement.body ||
                  'No additional details provided.'
                );
                const hasImage = !!(selectedAnnouncement.imageUrl || selectedAnnouncement.imageURL);

                return (
                  <>
                    {/* Fixed Top Header */}
                    <View style={styles.detailsModalHeader}>
                      <View style={styles.detailsModalHeaderBadges}>
                        <View style={[styles.priorityPill, { backgroundColor: priorityCfg.bg, borderColor: priorityCfg.border }]}>
                          <MaterialIcons name={priorityCfg.icon} size={14} color={priorityCfg.text} />
                          <Text style={[styles.priorityPillText, { color: priorityCfg.text }]}>
                            {(selectedAnnouncement.priority || 'Normal').toUpperCase()}
                          </Text>
                        </View>
                        {selectedAnnouncement.category && (
                          <View style={styles.detailsModalCategoryBadge}>
                            <Text style={styles.detailsModalCategoryText}>{selectedAnnouncement.category}</Text>
                          </View>
                        )}
                      </View>
                      <TouchableOpacity 
                        onPress={() => setSelectedAnnouncementId(null)} 
                        style={styles.closeButton}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      >
                        <IconSymbol name="xmark" size={18} color="#6B7280" />
                      </TouchableOpacity>
                    </View>

                    {/* Scrollable Announcement Body - Displays Everything */}
                    <ScrollView 
                      style={styles.detailsModalScroll}
                      contentContainerStyle={styles.detailsModalScrollContent}
                      showsVerticalScrollIndicator={true}
                      bounces={true}
                    >
                      <Text style={styles.detailsModalTitle}>{selectedAnnouncement.title}</Text>

                      {/* Official Information Card */}
                      <View style={styles.detailsMetaCard}>
                        <View style={styles.detailsMetaItem}>
                          <MaterialIcons name="schedule" size={16} color="#64748B" />
                          <Text style={styles.detailsMetaText}>
                            {formatFullDateTime(selectedAnnouncement.createdAt)}
                          </Text>
                        </View>
                        <View style={styles.detailsMetaItem}>
                          <MaterialIcons name="account-balance" size={16} color="#64748B" />
                          <Text style={styles.detailsMetaText}>
                            Issued by: {selectedAnnouncement.author || selectedAnnouncement.authorRole || selectedAnnouncement.postedBy || 'CENRO Danao City'}
                          </Text>
                        </View>
                        {selectedAnnouncement.barangay && (
                          <View style={styles.detailsMetaItem}>
                            <MaterialIcons name="place" size={16} color="#64748B" />
                            <Text style={styles.detailsMetaText}>
                              Area: Barangay {selectedAnnouncement.barangay}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Attached Announcement Image if available */}
                      {hasImage && (
                        <Image 
                          source={{ uri: selectedAnnouncement.imageUrl || selectedAnnouncement.imageURL }} 
                          style={styles.detailsModalImage}
                          resizeMode="cover"
                        />
                      )}

                      {/* Complete Announcement Content */}
                      <Text style={styles.detailsModalDescription}>{fullText}</Text>

                      {/* Community Engagement Note */}
                      <View style={styles.detailsLikesNote}>
                        <MaterialIcons 
                          name={isSelectedLiked ? "favorite" : "favorite-border"} 
                          size={15} 
                          color={isSelectedLiked ? "#EF4444" : "#6B7280"} 
                        />
                        <Text style={styles.detailsLikesNoteText}>
                          {selectedLikesCount} {selectedLikesCount === 1 ? 'resident found' : 'residents found'} this announcement helpful
                        </Text>
                      </View>
                    </ScrollView>

                    {/* Fixed Modal Action Row: Close button on the left, Like button beside it */}
                    <View style={styles.detailsModalActionsRow}>
                      <TouchableOpacity 
                        style={styles.detailsModalCloseButton}
                        onPress={() => setSelectedAnnouncementId(null)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.detailsModalCloseButtonText}>Close</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={[
                          styles.detailsModalLikeButton,
                          isSelectedLiked && styles.detailsModalLikeButtonActive
                        ]}
                        onPress={() => handleToggleLike(selectedAnnouncement)}
                        activeOpacity={0.7}
                        disabled={likingId === selectedAnnouncement.id}
                      >
                        <MaterialIcons 
                          name={isSelectedLiked ? "favorite" : "favorite-border"} 
                          size={20} 
                          color={isSelectedLiked ? "#EF4444" : "#4A6741"} 
                        />
                        <Text style={[
                          styles.detailsModalLikeButtonText,
                          isSelectedLiked && styles.detailsModalLikeButtonTextActive
                        ]}>
                          {isSelectedLiked ? "Liked" : "Like"} ({selectedLikesCount})
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                );
              })()}
            </View>
          </View>
        </Modal>

        {/* Dynamic Announcements List */}
        {displayedAnnouncements.length > 0 ? (
          displayedAnnouncements.map((announcement) => {
            const isCardLiked = !!(
              user?.uid &&
              Array.isArray(announcement.likedBy) &&
              announcement.likedBy.includes(user.uid)
            );
            const cardLikesCount = typeof announcement.likesCount === 'number'
              ? announcement.likesCount
              : (Array.isArray(announcement.likedBy) ? announcement.likedBy.length : 0);
            const isThisLiking = likingId === announcement.id;
            const cardDescription = (
              announcement.description ||
              announcement.content ||
              announcement.message ||
              announcement.details ||
              announcement.body ||
              ''
            );

            return (
              <View key={announcement.id} style={styles.card}>
                <TouchableOpacity 
                  activeOpacity={0.8}
                  onPress={() => setSelectedAnnouncementId(announcement.id)}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <IconSymbol 
                        name={announcement.priority === "Urgent" || announcement.priority === "High" ? "exclamationmark.triangle" : "info.circle"} 
                        size={18} 
                        color={announcement.priority === "Urgent" || announcement.priority === "High" ? "#B56576" : "#4A6741"} 
                      />
                      <Text style={styles.cardDate}>
                        {new Date(announcement.createdAt?.toDate ? announcement.createdAt.toDate() : announcement.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </Text>
                    </View>
                    {(announcement.priority === "Urgent" || announcement.priority === "High") && (
                      <View style={styles.urgentBadge}>
                        <Text style={styles.urgentText}>{announcement.priority.toUpperCase()}</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.cardTitle}>{announcement.title}</Text>
                  
                  {/* Truncated Description Preview */}
                  <Text style={styles.cardDescription} numberOfLines={2} ellipsizeMode="tail">
                    {cardDescription}
                  </Text>
                  
                  <View style={styles.tagGroup}>
                    {announcement.category && (
                      <View style={[styles.tag, { backgroundColor: '#E8F5E9' }]}>
                        <Text style={[styles.tagText, { color: '#4A6741' }]}>{announcement.category}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>

                <View style={styles.cardDivider} />
                <View style={styles.cardFooter}>
                  {/* Dynamic Likes Counter & Interactive Button */}
                  <TouchableOpacity 
                    style={[
                      styles.cardLikeButton,
                      isCardLiked && styles.cardLikeButtonActive
                    ]}
                    onPress={() => handleToggleLike(announcement)}
                    activeOpacity={0.7}
                    disabled={isThisLiking}
                  >
                    <MaterialIcons 
                      name={isCardLiked ? "favorite" : "favorite-border"} 
                      size={18} 
                      color={isCardLiked ? "#EF4444" : "#4A6741"} 
                    />
                    <Text style={[styles.cardLikeText, isCardLiked && styles.cardLikeTextActive]}>
                      {cardLikesCount} {cardLikesCount === 1 ? 'like' : 'likes'}
                    </Text>
                  </TouchableOpacity>

                  {/* "More details" Button to view full post */}
                  <TouchableOpacity 
                    style={styles.detailsButton}
                    onPress={() => setSelectedAnnouncementId(announcement.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.detailsText}>More details</Text>
                    <IconSymbol name="arrow.right" size={14} color="#4A6741" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.card}>
             <Text style={styles.cardDescription}>
               {selectedFilter === 'All' ? 'No new announcements right now.' : `No announcements found for ${selectedFilter}.`}
             </Text>
          </View>
        )}

        {/* Show Older Updates Button */}
        {hasMore && (
          <TouchableOpacity 
            style={styles.olderButton}
            onPress={() => setDisplayCount(prev => prev + 5)}
          >
            <IconSymbol name="chevron.down" size={16} color="#4A6741" />
            <Text style={styles.olderButtonText}>Show Older Updates</Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  timeText: {
    fontSize: 15,
    fontWeight: '600',
  },
  timeTextRight: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 4,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A6741',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '80%',
    maxWidth: 320,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  dropdownHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6B7280',
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingBottom: 8,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  dropdownItemActive: {
    backgroundColor: '#F0FDF4',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#374151',
  },
  dropdownItemTextActive: {
    color: '#4A6741',
    fontWeight: '600',
  },
  detailsModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '92%',
    maxWidth: 500,
    maxHeight: '86%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
    display: 'flex',
    flexDirection: 'column',
  },
  detailsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  detailsModalHeaderBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    flex: 1,
  },
  priorityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  priorityPillText: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.4,
  },
  detailsModalCategoryBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  detailsModalCategoryText: {
    color: '#4A6741',
    fontSize: 11,
    fontWeight: '700',
  },
  closeButton: {
    padding: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    marginLeft: 8,
  },
  detailsModalScroll: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  detailsModalScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  detailsModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 10,
    lineHeight: 26,
  },
  detailsMetaCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginVertical: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailsMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailsMetaText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  detailsModalImage: {
    width: '100%',
    height: 190,
    borderRadius: 14,
    marginVertical: 12,
  },
  detailsModalDescription: {
    fontSize: 15,
    color: '#1F2937',
    lineHeight: 24,
    marginVertical: 8,
  },
  detailsLikesNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  detailsLikesNoteText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  detailsModalActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  detailsModalCloseButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsModalCloseButtonText: {
    color: '#4B5563',
    fontSize: 15,
    fontWeight: '600',
  },
  detailsModalLikeButton: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#A5D6A7',
    paddingVertical: 12,
    borderRadius: 14,
  },
  detailsModalLikeButtonActive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  detailsModalLikeButtonText: {
    color: '#4A6741',
    fontSize: 15,
    fontWeight: 'bold',
  },
  detailsModalLikeButtonTextActive: {
    color: '#EF4444',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E8F5E9',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardDate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  urgentBadge: {
    backgroundColor: '#B56576',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  urgentText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 6,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLikeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  cardLikeButtonActive: {
    backgroundColor: '#FEE2E2',
  },
  cardLikeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  cardLikeTextActive: {
    color: '#EF4444',
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailsText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4A6741',
  },
  tagGroup: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  olderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: '#4A6741',
    marginTop: 8,
  },
  olderButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4A6741',
  },
});


