import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image, Modal, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../../../config/firebase';

interface Feedback {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  photoURL?: string;
  rating: string;
  title: string;
  message: string;
  createdAt: any;
  street?: string;
}

export default function ServiceFeedbackTab() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'loved it' | 'good' | 'bad' | 'terrible'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const itemsPerPage = 10;

  useEffect(() => {
    if (!db) return;

    const feedbacksRef = collection(db, 'feedback');
    const q = query(feedbacksRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const feedbacksData: Feedback[] = [];
      const userCache = new Map<string, any>();

      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        let userName = 'User';
        let userEmail = data.userEmail || '';
        let photoURL: string | undefined = undefined;

        // Resolve user info
        try {
          if (data.userId && !userCache.has(data.userId)) {
            const userDoc = await getDoc(doc(db, 'users', data.userId));
            if (userDoc.exists()) userCache.set(data.userId, userDoc.data());
          }
          const userData = data.userId ? userCache.get(data.userId) : null;
          if (userData) {
            userName = userData.displayName || userData.email?.split('@')[0] || 'User';
            userEmail = userData.email || userEmail;
            photoURL = userData.photoURL || undefined;
          } else {
            userName = userEmail?.split('@')[0] || 'User';
          }
        } catch {
          userName = userEmail?.split('@')[0] || 'User';
        }

        feedbacksData.push({
          id: docSnapshot.id,
          userId: data.userId || '',
          userEmail,
          userName,
          photoURL,
          rating: data.rating || 'Good',
          title: data.title || '',
          message: data.description || data.message || '',
          createdAt: data.createdAt,
          street: data.street || '',
        });
      }

      setFeedbacks(feedbacksData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Stats
  const totalCount = feedbacks.length;
  const lovedCount = feedbacks.filter(f => f.rating.toLowerCase() === 'loved it').length;
  const goodCount = feedbacks.filter(f => f.rating.toLowerCase() === 'good').length;
  const badCount = feedbacks.filter(f => f.rating.toLowerCase() === 'bad').length;
  const terribleCount = feedbacks.filter(f => f.rating.toLowerCase() === 'terrible').length;
  const positiveRate = totalCount > 0 ? Math.round(((lovedCount + goodCount) / totalCount) * 100) : 0;

  const getRatingEmoji = (rating: string) => {
    switch (rating.toLowerCase()) {
      case 'loved it': return '😍';
      case 'good': return '😊';
      case 'bad': return '😕';
      case 'terrible': return '😣';
      default: return '😐';
    }
  };

  const getRatingColor = (rating: string) => {
    switch (rating.toLowerCase()) {
      case 'loved it': return { text: '#059669', bg: '#ECFDF5' };
      case 'good': return { text: '#2563EB', bg: '#EFF6FF' };
      case 'bad': return { text: '#D97706', bg: '#FFFBEB' };
      case 'terrible': return { text: '#DC2626', bg: '#FEF2F2' };
      default: return { text: '#6B7280', bg: '#F3F4F6' };
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Unknown';
    }
  };

  const formatDateFull = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Unknown';
    }
  };

  // Filtering
  const filtered = feedbacks.filter(f => {
    const matchesSearch = searchText === '' ||
      f.userName.toLowerCase().includes(searchText.toLowerCase()) ||
      f.message.toLowerCase().includes(searchText.toLowerCase()) ||
      f.userEmail.toLowerCase().includes(searchText.toLowerCase());
    const matchesFilter = selectedFilter === 'all' || f.rating.toLowerCase() === selectedFilter;
    return matchesSearch && matchesFilter;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginatedFeedbacks = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getRatingBarWidth = (rating: string) => {
    if (totalCount === 0) return 0;
    const count = feedbacks.filter(f => f.rating.toLowerCase() === rating.toLowerCase()).length;
    return Math.round((count / totalCount) * 100);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E8B57" />
        <Text style={styles.loadingText}>Loading feedback...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Service Feedback</Text>
          <Text style={styles.headerDesc}>Monitor citizen satisfaction and service quality ratings.</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.outlineBtn}>
            <MaterialIcons name="file-download" size={18} color="#374151" />
            <Text style={styles.outlineBtnText}>Export</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <View style={[styles.summaryIconBg, { backgroundColor: '#EFF6FF' }]}>
            <MaterialIcons name="chat-bubble-outline" size={22} color="#2563EB" />
          </View>
          <Text style={styles.summaryValue}>{totalCount}</Text>
          <Text style={styles.summaryLabel}>Total Feedback</Text>
        </View>
        <View style={styles.summaryCard}>
          <View style={[styles.summaryIconBg, { backgroundColor: '#ECFDF5' }]}>
            <MaterialIcons name="thumb-up" size={22} color="#059669" />
          </View>
          <Text style={styles.summaryValue}>{positiveRate}%</Text>
          <Text style={styles.summaryLabel}>Positive Rate</Text>
        </View>
        <View style={styles.summaryCard}>
          <View style={[styles.summaryIconBg, { backgroundColor: '#ECFDF5' }]}>
            <MaterialIcons name="sentiment-very-satisfied" size={22} color="#059669" />
          </View>
          <Text style={styles.summaryValue}>{lovedCount}</Text>
          <Text style={styles.summaryLabel}>Loved It</Text>
        </View>
        <View style={styles.summaryCard}>
          <View style={[styles.summaryIconBg, { backgroundColor: '#FEF2F2' }]}>
            <MaterialIcons name="sentiment-very-dissatisfied" size={22} color="#DC2626" />
          </View>
          <Text style={styles.summaryValue}>{terribleCount}</Text>
          <Text style={styles.summaryLabel}>Terrible</Text>
        </View>
      </View>

      {/* Rating Breakdown */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Rating Breakdown</Text>
        {['Loved it', 'Good', 'Bad', 'Terrible'].map((rating) => {
          const color = getRatingColor(rating);
          const width = getRatingBarWidth(rating);
          const count = feedbacks.filter(f => f.rating.toLowerCase() === rating.toLowerCase()).length;
          return (
            <View key={rating} style={styles.ratingBarRow}>
              <Text style={styles.ratingBarEmoji}>{getRatingEmoji(rating)}</Text>
              <Text style={[styles.ratingBarLabel, { width: 70 }]}>{rating}</Text>
              <View style={styles.ratingBarBg}>
                <View style={[styles.ratingBarFill, { width: `${width}%`, backgroundColor: color.text }]} />
              </View>
              <Text style={styles.ratingBarCount}>{count}</Text>
              <Text style={styles.ratingBarPercent}>{width}%</Text>
            </View>
          );
        })}
      </View>

      {/* Feedback List */}
      <View style={styles.card}>
        {/* Filters */}
        <View style={styles.filtersRow}>
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={20} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, email, message..."
              placeholderTextColor="#9CA3AF"
              value={searchText}
              onChangeText={(text) => { setSearchText(text); setCurrentPage(1); }}
            />
          </View>

          <View style={styles.filterChips}>
            {(['all', 'loved it', 'good', 'bad', 'terrible'] as const).map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterChip,
                  selectedFilter === filter && styles.filterChipActive,
                ]}
                onPress={() => { setSelectedFilter(filter); setCurrentPage(1); }}
              >
                <Text style={[
                  styles.filterChipText,
                  selectedFilter === filter && styles.filterChipTextActive,
                ]}>
                  {filter === 'all' ? 'All' : filter === 'loved it' ? '😍 Loved' : filter === 'good' ? '😊 Good' : filter === 'bad' ? '😕 Bad' : '😣 Terrible'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Table */}
        <View style={styles.tableHead}>
          <Text style={[styles.th, { flex: 2 }]}>USER</Text>
          <Text style={[styles.th, { flex: 1 }]}>RATING</Text>
          <Text style={[styles.th, { flex: 3 }]}>MESSAGE</Text>
          <Text style={[styles.th, { flex: 1 }]}>DATE</Text>
          <Text style={[styles.th, { flex: 0.5, textAlign: 'center' }]}>ACTIONS</Text>
        </View>

        {paginatedFeedbacks.length === 0 ? (
          <View style={styles.emptyRow}>
            <MaterialIcons name="inbox" size={40} color="#D1D5DB" />
            <Text style={styles.emptyText}>No feedback found</Text>
          </View>
        ) : (
          paginatedFeedbacks.map((feedback) => {
            const ratingColor = getRatingColor(feedback.rating);
            return (
              <TouchableOpacity
                key={feedback.id}
                style={styles.tableRow}
                onPress={() => { setSelectedFeedback(feedback); setShowDetailModal(true); }}
              >
                <View style={[styles.td, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                  <View style={styles.avatarPlaceholder}>
                    {feedback.photoURL ? (
                      <Image source={{ uri: feedback.photoURL }} style={styles.avatarImage} />
                    ) : (
                      <MaterialIcons name="person" size={20} color="#9CA3AF" />
                    )}
                  </View>
                  <View>
                    <Text style={styles.userName}>{feedback.userName}</Text>
                    <Text style={styles.userEmail}>{feedback.userEmail}</Text>
                  </View>
                </View>
                <View style={[styles.td, { flex: 1 }]}>
                  <View style={[styles.ratingBadge, { backgroundColor: ratingColor.bg }]}>
                    <Text style={{ fontSize: 14 }}>{getRatingEmoji(feedback.rating)}</Text>
                    <Text style={[styles.ratingBadgeText, { color: ratingColor.text }]}>
                      {feedback.rating}
                    </Text>
                  </View>
                </View>
                <View style={[styles.td, { flex: 3 }]}>
                  <Text style={styles.messageText} numberOfLines={2}>
                    {feedback.message}
                  </Text>
                </View>
                <Text style={[styles.td, { flex: 1, color: '#6B7280', fontSize: 13 }]}>
                  {formatDate(feedback.createdAt)}
                </Text>
                <View style={[styles.td, { flex: 0.5, alignItems: 'center' }]}>
                  <TouchableOpacity onPress={() => { setSelectedFeedback(feedback); setShowDetailModal(true); }}>
                    <MaterialIcons name="visibility" size={20} color="#6B7280" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <View style={styles.paginationRow}>
            <Text style={styles.paginationInfo}>
              Showing {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} feedback
            </Text>
            <View style={styles.paginationButtons}>
              <TouchableOpacity
                style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
                disabled={currentPage === 1}
                onPress={() => setCurrentPage(p => p - 1)}
              >
                <MaterialIcons name="chevron-left" size={20} color={currentPage === 1 ? '#D1D5DB' : '#374151'} />
              </TouchableOpacity>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const page = i + 1;
                return (
                  <TouchableOpacity
                    key={page}
                    style={[styles.pageBtn, currentPage === page && styles.pageBtnActive]}
                    onPress={() => setCurrentPage(page)}
                  >
                    <Text style={[styles.pageBtnText, currentPage === page && styles.pageBtnTextActive]}>
                      {page}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]}
                disabled={currentPage === totalPages}
                onPress={() => setCurrentPage(p => p + 1)}
              >
                <MaterialIcons name="chevron-right" size={20} color={currentPage === totalPages ? '#D1D5DB' : '#374151'} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Detail Modal */}
      <Modal visible={showDetailModal} transparent animationType="fade" onRequestClose={() => setShowDetailModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedFeedback && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Feedback Details</Text>
                  <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                    <MaterialIcons name="close" size={24} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                  {/* User Info */}
                  <View style={styles.detailUserRow}>
                    <View style={styles.detailAvatarBg}>
                      {selectedFeedback.photoURL ? (
                        <Image source={{ uri: selectedFeedback.photoURL }} style={styles.detailAvatarImage} />
                      ) : (
                        <MaterialIcons name="person" size={32} color="#9CA3AF" />
                      )}
                    </View>
                    <View>
                      <Text style={styles.detailUserName}>{selectedFeedback.userName}</Text>
                      <Text style={styles.detailUserEmail}>{selectedFeedback.userEmail}</Text>
                      {selectedFeedback.street ? (
                        <Text style={styles.detailUserStreet}>
                          <MaterialIcons name="location-on" size={12} color="#9CA3AF" /> {selectedFeedback.street}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {/* Rating */}
                  <View style={styles.detailRatingRow}>
                    <Text style={{ fontSize: 36 }}>{getRatingEmoji(selectedFeedback.rating)}</Text>
                    <View>
                      <Text style={styles.detailRatingLabel}>Rating</Text>
                      <Text style={[styles.detailRatingValue, { color: getRatingColor(selectedFeedback.rating).text }]}>
                        {selectedFeedback.rating}
                      </Text>
                    </View>
                  </View>

                  {/* Message */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionLabel}>Message</Text>
                    <Text style={styles.detailMessage}>{selectedFeedback.message}</Text>
                  </View>

                  {/* Date */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionLabel}>Submitted</Text>
                    <Text style={styles.detailDate}>{formatDateFull(selectedFeedback.createdAt)}</Text>
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 24 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  loadingText: { marginTop: 12, color: '#6B7280', fontSize: 14 },

  // Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 4 },
  headerDesc: { fontSize: 14, color: '#6B7280' },
  headerActions: { flexDirection: 'row', gap: 10 },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#FFFFFF' },
  outlineBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },

  // Summary cards
  summaryRow: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  summaryCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  summaryIconBg: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  summaryValue: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 2 },
  summaryLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', letterSpacing: 0.3 },

  // Rating breakdown card
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 24 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 16 },
  ratingBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  ratingBarEmoji: { fontSize: 18, width: 24 },
  ratingBarLabel: { fontSize: 13, color: '#374151', fontWeight: '500' },
  ratingBarBg: { flex: 1, height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  ratingBarFill: { height: '100%', borderRadius: 4 },
  ratingBarCount: { width: 28, textAlign: 'right', fontSize: 13, fontWeight: '700', color: '#374151' },
  ratingBarPercent: { width: 36, textAlign: 'right', fontSize: 12, color: '#9CA3AF' },

  // Filters
  filtersRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, height: 40, minWidth: 240 },
  searchInput: { flex: 1, fontSize: 13, color: '#374151', marginLeft: 8, outlineStyle: 'none' as any },
  filterChips: { flexDirection: 'row', gap: 6 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  filterChipActive: { backgroundColor: '#4b6354', borderColor: '#4b6354' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  filterChipTextActive: { color: '#FFFFFF' },

  // Table
  tableHead: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 12, marginBottom: 4 },
  th: { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 0.5, textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  td: { justifyContent: 'center' },
  avatarPlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImage: { width: 36, height: 36, borderRadius: 18 },
  userName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  userEmail: { fontSize: 12, color: '#9CA3AF' },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  ratingBadgeText: { fontSize: 12, fontWeight: '600' },
  messageText: { fontSize: 13, color: '#374151', lineHeight: 18 },

  // Empty
  emptyRow: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: '#9CA3AF' },

  // Pagination
  paginationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  paginationInfo: { fontSize: 13, color: '#6B7280' },
  paginationButtons: { flexDirection: 'row', gap: 4 },
  pageBtn: { width: 32, height: 32, borderRadius: 6, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  pageBtnActive: { backgroundColor: '#2E8B57', borderColor: '#2E8B57' },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  pageBtnTextActive: { color: '#FFFFFF' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 16, width: '90%', maxWidth: 520, maxHeight: '80%', overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalBody: { padding: 20 },

  // Detail modal contents
  detailUserRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
  detailAvatarBg: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  detailAvatarImage: { width: 56, height: 56, borderRadius: 28 },
  detailUserName: { fontSize: 18, fontWeight: '700', color: '#111827' },
  detailUserEmail: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  detailUserStreet: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  detailRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#F9FAFB', padding: 16, borderRadius: 12, marginBottom: 20 },
  detailRatingLabel: { fontSize: 12, color: '#6B7280', fontWeight: '600', letterSpacing: 0.5 },
  detailRatingValue: { fontSize: 20, fontWeight: '800', marginTop: 2 },
  detailSection: { marginBottom: 20 },
  detailSectionLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
  detailMessage: { fontSize: 15, color: '#374151', lineHeight: 22, backgroundColor: '#F9FAFB', padding: 16, borderRadius: 10 },
  detailDate: { fontSize: 14, color: '#374151' },
});
