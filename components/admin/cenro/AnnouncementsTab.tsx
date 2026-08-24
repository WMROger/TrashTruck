import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';

interface Announcement {
  id: string;
  title: string;
  category: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  description: string;
  isPublished: boolean;
  createdAt: any;
}

export const ANNOUNCEMENT_CATEGORIES = [
  { label: 'General', icon: 'info', color: '#475569', desc: 'General community bulletins & notices' },
  { label: 'Emergency', icon: 'warning', color: '#DC2626', desc: 'Severe weather, hazards & emergency stops' },
  { label: 'Maintenance', icon: 'build', color: '#D97706', desc: 'Truck repairs & facility downtime' },
  { label: 'Schedule Change', icon: 'event', color: '#2563EB', desc: 'Route time or collection day adjustments' },
  { label: 'Service Update', icon: 'campaign', color: '#059669', desc: 'New barangay routes & guidelines' },
  { label: 'Holiday Notice', icon: 'celebration', color: '#7C3AED', desc: 'Public holidays & adjusted schedules' },
  { label: 'Policy Update', icon: 'policy', color: '#0F766E', desc: 'Waste segregation & city ordinances' },
];

export default function AnnouncementsTab() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('General');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('Medium');
  const [description, setDescription] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);

  // Table Filter & Search
  const [tableFilter, setTableFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list: Announcement[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Announcement);
      });
      setAnnouncements(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handlePublish = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Validation Error', 'Title and Description are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newDocRef = doc(collection(db, 'announcements'));
      await setDoc(newDocRef, {
        title: title.trim(),
        category,
        priority,
        description: description.trim(),
        isPublished: true,
        createdAt: serverTimestamp(),
      });

      Alert.alert('Success', 'Announcement published successfully.');
      setTitle('');
      setCategory('General');
      setPriority('Medium');
      setDescription('');
      setShowCategoryDropdown(false);
      setShowPriorityDropdown(false);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to publish announcement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Announcement',
      'Are you sure you want to remove this announcement?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'announcements', id));
            } catch (e) {
              console.error(e);
              Alert.alert('Error', 'Failed to delete announcement.');
            }
          },
        },
      ]
    );
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'Urgent':
        return { bg: '#FEE2E2', text: '#DC2626' };
      case 'High':
        return { bg: '#FEF3C7', text: '#D97706' };
      case 'Medium':
        return { bg: '#E0F2FE', text: '#0284C7' };
      case 'Low':
        return { bg: '#F3F4F6', text: '#4B5563' };
      default:
        return { bg: '#F3F4F6', text: '#4B5563' };
    }
  };

  const getCategoryConfig = (catLabel: string) => {
    return (
      ANNOUNCEMENT_CATEGORIES.find((c) => c.label.toLowerCase() === (catLabel || '').toLowerCase()) || {
        label: catLabel || 'General',
        icon: 'info',
        color: '#475569',
        desc: '',
      }
    );
  };

  const filteredAnnouncements = announcements.filter((item) => {
    const matchesFilter = tableFilter === 'All' || item.category === tableFilter;
    const matchesSearch =
      searchQuery.trim() === '' ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const selectedCategoryConfig = getCategoryConfig(category);

  return (
    <ScrollView style={[styles.container, isMobile && { padding: 16 }]} showsVerticalScrollIndicator={false}>
      <Text style={styles.headerSubtitle}>COMMUNICATIONS & CITIZEN BROADCASTS</Text>
      <Text style={styles.headerTitle}>Announcement Creator</Text>

      {/* Creator Card */}
      <View style={[styles.card, isMobile && { padding: 16 }]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <MaterialIcons name="campaign" size={22} color="#2E8B57" style={styles.cardIcon} />
            <Text style={styles.cardTitle}>New Municipal Announcement</Text>
          </View>
        </View>

        <View style={[styles.formGrid, isMobile && { flexDirection: 'column' }]}>
          {/* Title */}
          <View style={[styles.formGroup, { width: '100%' }]}>
            <Text style={styles.label}>ANNOUNCEMENT TITLE</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Danao City Holiday Collection Schedule"
              placeholderTextColor="#94A3B8"
              value={title}
              onChangeText={setTitle}
            />
          </View>

          {/* Category Dropdown */}
          <View style={[styles.formGroup, isMobile && { width: '100%' }, { zIndex: 30 }]}>
            <Text style={styles.label}>CATEGORY</Text>
            <View style={{ position: 'relative' }}>
              <TouchableOpacity
                style={[styles.dropdown, showCategoryDropdown && styles.dropdownOpen]}
                onPress={() => {
                  setShowCategoryDropdown(!showCategoryDropdown);
                  setShowPriorityDropdown(false);
                }}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.catIconBox, { backgroundColor: `${selectedCategoryConfig.color}15` }]}>
                    <MaterialIcons name={selectedCategoryConfig.icon as any} size={18} color={selectedCategoryConfig.color} />
                  </View>
                  <Text style={styles.dropdownText}>{category}</Text>
                </View>
                <MaterialIcons
                  name={showCategoryDropdown ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>

              {showCategoryDropdown && (
                <View style={styles.dropdownMenuScroll}>
                  <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={true} nestedScrollEnabled={true}>
                    {ANNOUNCEMENT_CATEGORIES.map((c) => {
                      const isSelected = category === c.label;
                      return (
                        <TouchableOpacity
                          key={c.label}
                          style={[styles.categoryDropdownItem, isSelected && styles.categoryDropdownItemSelected]}
                          onPress={() => {
                            setCategory(c.label);
                            setShowCategoryDropdown(false);
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                            <View style={[styles.catIconBox, { backgroundColor: `${c.color}15` }]}>
                              <MaterialIcons name={c.icon as any} size={16} color={c.color} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.categoryItemLabel,
                                  isSelected && { color: '#1B4D3E', fontWeight: '800' },
                                ]}
                              >
                                {c.label}
                              </Text>
                              <Text style={styles.categoryItemDesc} numberOfLines={1}>
                                {c.desc}
                              </Text>
                            </View>
                          </View>
                          {isSelected && <MaterialIcons name="check" size={18} color="#1B4D3E" />}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>
          </View>

          {/* Priority Dropdown */}
          <View style={[styles.formGroup, isMobile && { width: '100%' }, { zIndex: 20 }]}>
            <Text style={styles.label}>PRIORITY LEVEL</Text>
            <View style={{ position: 'relative' }}>
              <TouchableOpacity
                style={[styles.dropdown, showPriorityDropdown && styles.dropdownOpen]}
                onPress={() => {
                  setShowPriorityDropdown(!showPriorityDropdown);
                  setShowCategoryDropdown(false);
                }}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View
                    style={[
                      styles.priorityDot,
                      { backgroundColor: getPriorityColor(priority).text },
                    ]}
                  />
                  <Text style={[styles.dropdownText, { color: getPriorityColor(priority).text, fontWeight: '700' }]}>
                    {priority}
                  </Text>
                </View>
                <MaterialIcons
                  name={showPriorityDropdown ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>

              {showPriorityDropdown && (
                <View style={styles.dropdownMenu}>
                  {(['Low', 'Medium', 'High', 'Urgent'] as const).map((p) => {
                    const isSelected = priority === p;
                    const pColor = getPriorityColor(p);
                    return (
                      <TouchableOpacity
                        key={p}
                        style={[styles.priorityDropdownItem, isSelected && styles.categoryDropdownItemSelected]}
                        onPress={() => {
                          setPriority(p);
                          setShowPriorityDropdown(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={[styles.priorityDot, { backgroundColor: pColor.text }]} />
                          <Text style={[styles.dropdownItemText, { color: pColor.text, fontWeight: isSelected ? '800' : '600' }]}>
                            {p}
                          </Text>
                        </View>
                        {isSelected && <MaterialIcons name="check" size={18} color={pColor.text} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </View>

          {/* Content */}
          <View style={[styles.formGroup, { width: '100%', zIndex: 1 }]}>
            <Text style={styles.label}>MESSAGE CONTENT</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Type the full announcement message here..."
              placeholderTextColor="#94A3B8"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.primaryBtn, isMobile && { width: '100%', justifyContent: 'center' }]}
            onPress={handlePublish}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="send" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>Publish to Mobile App</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* History Table Card */}
      <View style={[styles.card, isMobile && { padding: 14 }, { zIndex: 1 }]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <MaterialIcons name="history" size={20} color="#1B4D3E" />
            <Text style={styles.cardTitle}>Published Announcements</Text>
          </View>
          <Text style={styles.cardCountBadge}>{filteredAnnouncements.length} Total</Text>
        </View>

        {/* Category Filters */}
        <ScrollView
          horizontal={true}
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, marginBottom: 16 }}
          contentContainerStyle={styles.filterPillsRow}
        >
          {['All', ...ANNOUNCEMENT_CATEGORIES.map((c) => c.label)].map((cat) => {
            const isActive = tableFilter === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.filterPill, isActive && styles.filterPillActive]}
                onPress={() => setTableFilter(cat)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Table Content */}
        <ScrollView
          horizontal={isMobile}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, minWidth: '100%' }}
          style={{ width: '100%' }}
        >
          <View style={{ minWidth: isMobile ? 650 : '100%', width: '100%' }}>
            <View style={styles.tableHead}>
              <Text style={[styles.th, { flex: 2 }]}>TITLE</Text>
              <Text style={[styles.th, { flex: 1.2 }]}>CATEGORY</Text>
              <Text style={[styles.th, { flex: 0.9 }]}>PRIORITY</Text>
              <Text style={[styles.th, { flex: 1.4 }]}>DATE</Text>
              <Text style={[styles.th, { flex: 0.5, textAlign: 'right' }]}>ACTION</Text>
            </View>

            {loading ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#2E8B57" />
              </View>
            ) : filteredAnnouncements.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <MaterialIcons name="campaign" size={36} color="#CBD5E1" />
                <Text style={{ color: '#64748B', marginTop: 8, fontWeight: '600', fontSize: 13 }}>
                  No announcements found matching filter.
                </Text>
              </View>
            ) : (
              filteredAnnouncements.map((row) => {
                const pColor = getPriorityColor(row.priority);
                const catCfg = getCategoryConfig(row.category);
                const dateStr = row.createdAt?.toDate
                  ? row.createdAt.toDate().toLocaleString()
                  : 'Just now';

                return (
                  <View key={row.id} style={styles.tableRow}>
                    <View style={{ flex: 2 }}>
                      <Text style={styles.rowTitle}>{row.title}</Text>
                      <Text style={styles.rowDesc} numberOfLines={1}>
                        {row.description}
                      </Text>
                    </View>
                    <View style={{ flex: 1.2, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={[styles.catBadge, { backgroundColor: `${catCfg.color}15`, borderColor: `${catCfg.color}30` }]}>
                        <MaterialIcons name={catCfg.icon as any} size={12} color={catCfg.color} />
                        <Text style={[styles.catBadgeText, { color: catCfg.color }]}>{row.category || 'General'}</Text>
                      </View>
                    </View>
                    <View style={{ flex: 0.9 }}>
                      <View style={[styles.badge, { backgroundColor: pColor.bg }]}>
                        <Text style={[styles.badgeText, { color: pColor.text }]}>{row.priority}</Text>
                      </View>
                    </View>
                    <Text style={[styles.td, { flex: 1.4, color: '#64748B', fontSize: 12 }]}>{dateStr}</Text>
                    <View style={{ flex: 0.5, alignItems: 'flex-end' }}>
                      <TouchableOpacity onPress={() => handleDelete(row.id)} style={styles.deleteBtn} activeOpacity={0.7}>
                        <MaterialIcons name="delete-outline" size={20} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 32,
  },
  headerSubtitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 24,
    letterSpacing: -0.5,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'visible',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardIcon: {
    marginRight: 2,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardCountBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1B4D3E',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },

  formGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  formGroup: {
    width: '48%',
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 13.5,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  textArea: {
    minHeight: 110,
  },

  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  dropdownOpen: {
    borderColor: '#1B4D3E',
    backgroundColor: '#F8FAFC',
  },
  dropdownText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#0F172A',
  },
  catIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 999,
    overflow: 'hidden',
  },
  dropdownMenuScroll: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 999,
    overflow: 'hidden',
  },
  categoryDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  categoryDropdownItemSelected: {
    backgroundColor: '#F0FDF4',
  },
  categoryItemLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  categoryItemDesc: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1,
  },
  priorityDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dropdownItemText: {
    fontSize: 13,
    fontWeight: '600',
  },

  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 8,
    backgroundColor: '#1B4D3E',
    shadowColor: '#1B4D3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },

  filterPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
    height: 38,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterPillActive: {
    backgroundColor: '#1B4D3E',
    borderColor: '#1B4D3E',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  th: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  td: {
    fontSize: 13,
  },
  rowTitle: {
    fontWeight: '700',
    color: '#0F172A',
    fontSize: 13.5,
    marginBottom: 2,
  },
  rowDesc: {
    color: '#64748B',
    fontSize: 11.5,
  },

  catBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  catBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  deleteBtn: {
    padding: 6,
    borderRadius: 6,
  },
});
