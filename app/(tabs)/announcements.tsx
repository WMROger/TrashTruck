import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { db } from '@/config/firebase';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';

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
  const [allAnnouncements, setAllAnnouncements] = useState<any[]>([]);
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [displayCount, setDisplayCount] = useState(5);

  useEffect(() => {
    if (!db) return;
    const announcementsRef = collection(db, "announcements");
    const q = query(announcementsRef, where("isPublished", "==", true), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllAnnouncements(data);
    });
    return () => unsubscribe();
  }, []);

  const filteredAnnouncements = allAnnouncements.filter(announcement => {
    if (selectedFilter === 'All') return true;
    return announcement.category === selectedFilter;
  });

  const displayedAnnouncements = filteredAnnouncements.slice(0, displayCount);
  const hasMore = displayCount < filteredAnnouncements.length;

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
          <TouchableOpacity style={styles.filterButton}>
            <IconSymbol name="line.3.horizontal.decrease" size={16} color="#4A6741" />
            <Text style={styles.filterText}>Most Recent</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer} contentContainerStyle={styles.chipsContent}>
          {FILTER_CATEGORIES.map(category => (
            <TouchableOpacity 
              key={category}
              style={[styles.chip, selectedFilter === category && styles.chipActive]}
              onPress={() => {
                setSelectedFilter(category);
                setDisplayCount(5); // Reset display count on filter change
              }}
            >
              <Text style={[styles.chipText, selectedFilter === category && styles.chipTextActive]}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Dynamic Announcements List */}
        {displayedAnnouncements.length > 0 ? (
          displayedAnnouncements.map((announcement) => (
            <View key={announcement.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <IconSymbol 
                    name={announcement.priority === "Urgent" || announcement.priority === "High" ? "exclamationmark.triangle" : "info.circle"} 
                    size={18} 
                    color={announcement.priority === "Urgent" || announcement.priority === "High" ? "#B56576" : "#4A6741"} 
                  />
                  <Text style={styles.cardDate}>
                    {new Date(announcement.createdAt?.toDate ? announcement.createdAt.toDate() : announcement.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                {(announcement.priority === "Urgent" || announcement.priority === "High") && (
                  <View style={styles.urgentBadge}>
                    <Text style={styles.urgentText}>{announcement.priority.toUpperCase()}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardTitle}>{announcement.title}</Text>
              <Text style={styles.cardDescription}>{announcement.description}</Text>
              
              <View style={styles.tagGroup}>
                {announcement.category && (
                  <View style={[styles.tag, { backgroundColor: '#E8F5E9' }]}>
                    <Text style={[styles.tagText, { color: '#4A6741' }]}>{announcement.category}</Text>
                  </View>
                )}
              </View>

              <View style={styles.cardDivider} />
              <View style={styles.cardFooter}>
                <View style={styles.avatarGroup}>
                  <View style={[styles.avatarBubble, { backgroundColor: '#4A6741', zIndex: 3 }]} />
                  <View style={[styles.avatarBubble, { backgroundColor: '#A5D6A7', marginLeft: -8, zIndex: 2 }]} />
                  <View style={[styles.avatarBubble, { backgroundColor: '#B56576', marginLeft: -8, zIndex: 1 }]}>
                    <Text style={styles.avatarMoreText}>+12</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.detailsButton}>
                  <Text style={styles.detailsText}>Details</Text>
                  <IconSymbol name="arrow.right" size={14} color="#4A6741" />
                </TouchableOpacity>
              </View>
            </View>
          ))
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
  chipsContainer: {
    flexGrow: 0,
    marginBottom: 20,
  },
  chipsContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  chipActive: {
    backgroundColor: '#4A6741',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A6741',
  },
  chipTextActive: {
    color: '#FFFFFF',
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
    marginBottom: 12,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
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
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
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
  avatarGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMoreText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
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
    marginTop: 12,
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
