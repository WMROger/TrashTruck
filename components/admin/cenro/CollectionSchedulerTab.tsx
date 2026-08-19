import React, { useState, useEffect, createElement, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  doc,
  updateDoc,
  arrayUnion,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { DANAO_CITY_BARANGAYS } from '@/constants/danaoBarangays';
import { BARANGAY_COLLECTION_ROUTES } from '@/constants/barangaySimulationRoutes';
import AnalogTimePicker from './AnalogTimePicker';

const WebDatePicker = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) => {
  if (Platform.OS !== 'web') return null;

  const today = new Date().toLocaleDateString('en-CA');

  return createElement('input', {
    type: 'date',
    value: value,
    min: today,
    onChange: (e: any) => onChange(e.target.value),
    style: {
      padding: '12px 16px',
      borderRadius: '8px',
      border: '1px solid #D1D5DB',
      width: '100%',
      fontSize: '14px',
      height: '48px',
      backgroundColor: '#F9FAFB',
      color: '#111827',
      outline: 'none',
      fontFamily: 'inherit',
      boxSizing: 'border-box',
    },
  }) as any;
};

const DAYS_OF_WEEK = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

const CATEGORIES = [
  { name: 'BIODEGRADABLE', color: '#22C55E', icon: 'eco' },
  { name: 'NON-BIODEGRADABLE', color: '#2563EB', icon: 'delete-outline' },
  { name: 'RECYCLABLE', color: '#EAB308', icon: 'autorenew' },
  { name: 'RESIDUAL', color: '#6B7280', icon: 'restore-from-trash' },
  { name: 'HAZARDOUS', color: '#EF4444', icon: 'warning' },
  { name: 'SPECIAL/BULK', color: '#A855F7', icon: 'inventory-2' },
];

const SORT_OPTIONS = [
  { id: 'name_asc', label: 'Barangay (A - Z)' },
  { id: 'name_desc', label: 'Barangay (Z - A)' },
  { id: 'routes_count', label: 'Most Routes / Streets' },
  { id: 'newest', label: 'Recently Added' },
  { id: 'oldest', label: 'Oldest Added' },
];

export default function CollectionSchedulerTab() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isNarrow = width < 1024;

  const [schedules, setSchedules] = useState<any[]>([]);
  const [trucksList, setTrucksList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search State
  const [selectedBarangayFilter, setSelectedBarangayFilter] = useState('ALL');
  const [selectedDayFilter, setSelectedDayFilter] = useState('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name_asc');

  // Dropdown Open States
  const [isBarangayFilterOpen, setIsBarangayFilterOpen] = useState(false);
  const [isDayFilterOpen, setIsDayFilterOpen] = useState(false);
  const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false);
  const [isSortFilterOpen, setIsSortFilterOpen] = useState(false);
  const [barangaySearchFilterText, setBarangaySearchFilterText] = useState('');

  // Add / Edit Schedule Modal State
  const [isModalVisible, setModalVisible] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Form Fields
  const [barangayName, setBarangayName] = useState('');
  const [zone, setZone] = useState('');
  const [streetName, setStreetName] = useState('');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [truckName, setTruckName] = useState('');
  const [wasteCategory, setWasteCategory] = useState('BIODEGRADABLE');
  const [modalTimeStr, setModalTimeStr] = useState('06:00 AM');
  const [showModalAnalogTimePicker, setShowModalAnalogTimePicker] = useState(false);
  const [barangaySuggestionsOpen, setBarangaySuggestionsOpen] = useState(false);
  const [streetSuggestionsOpen, setStreetSuggestionsOpen] = useState(false);
  const [truckPickerOpen, setTruckPickerOpen] = useState(false);

  // Details Modal State (for specific date/time pickups)
  const [selectedBarangay, setSelectedBarangay] = useState<any>(null);
  const [isDetailsModalVisible, setDetailsModalVisible] = useState(false);
  const [isSavingDetail, setIsSavingDetail] = useState(false);
  const [specificCategory, setSpecificCategory] = useState('BIODEGRADABLE');
  const [isDeleting, setIsDeleting] = useState(false);

  // Accordion State
  const [expandedBarangay, setExpandedBarangay] = useState<string | null>(null);
  const [expandedStreet, setExpandedStreet] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Web-friendly date/time states for specific pickups
  const [webDateStr, setWebDateStr] = useState('');
  const [webTimeStr, setWebTimeStr] = useState('00:00');
  const [dateObj, setDateObj] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showAnalogTimePicker, setShowAnalogTimePicker] = useState(false);

  // 1. Subscribe to 'barangay_schedules' in Firestore
  useEffect(() => {
    const q = query(
      collection(db, 'barangay_schedules'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setSchedules(docs);

        // Keep selected schedule in sync if modal is currently open
        if (selectedBarangay) {
          const updated = docs.find((d) => d.id === selectedBarangay.id);
          if (updated) setSelectedBarangay(updated);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching schedules:', err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [selectedBarangay?.id]);

  // 2. Subscribe to active trucks in Firestore
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'trucks'),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setTrucksList(list);
      },
      (e) => console.log('Truck fetch warning:', e)
    );
    return () => unsub();
  }, []);

  // 3. Extract unique dynamic barangays purely from 'barangay_schedules'
  const dynamicBarangays = useMemo(() => {
    const set = new Set<string>();
    schedules.forEach((s) => {
      if (s.barangayName && typeof s.barangayName === 'string' && s.barangayName.trim()) {
        set.add(s.barangayName.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [schedules]);

  // List of hardcoded Danao City barangays that DO NOT exist in backend 'barangay_schedules' yet
  const availableUnregisteredDanaoBarangays = useMemo(() => {
    const existingLower = new Set(
      dynamicBarangays.map((b) => b.trim().toLowerCase())
    );
    // If editing, allow the current barangay being edited
    const editingLower = editingScheduleId
      ? (schedules.find((s) => s.id === editingScheduleId)?.barangayName || '').trim().toLowerCase()
      : null;
    return DANAO_CITY_BARANGAYS.filter((b) => {
      const lower = b.trim().toLowerCase();
      if (editingLower && lower === editingLower) return true;
      return !existingLower.has(lower);
    });
  }, [dynamicBarangays, editingScheduleId, schedules]);

  // Suggested unadded barangays matching typed text
  const suggestedUnregisteredBarangays = useMemo(() => {
    const queryText = barangayName.trim().toLowerCase();
    if (!queryText) {
      return availableUnregisteredDanaoBarangays.slice(0, 10);
    }
    return availableUnregisteredDanaoBarangays.filter((b) =>
      b.toLowerCase().includes(queryText)
    );
  }, [availableUnregisteredDanaoBarangays, barangayName]);

  // Check if current typed barangay name is already registered
  const isAlreadyRegistered = useMemo(() => {
    const name = barangayName.trim().toLowerCase();
    if (!name) return false;
    const editingLower = editingScheduleId
      ? (schedules.find((s) => s.id === editingScheduleId)?.barangayName || '').trim().toLowerCase()
      : null;
    if (editingLower && name === editingLower) return false;
    return dynamicBarangays.some((b) => b.trim().toLowerCase() === name);
  }, [barangayName, dynamicBarangays, editingScheduleId, schedules]);

  // Suggested streets / route sectors for the chosen barangay
  const suggestedStreetsForBarangay = useMemo(() => {
    const bName = barangayName.trim();
    const knownWaypoints = BARANGAY_COLLECTION_ROUTES[bName] || [];
    const set = new Set<string>();
    set.add('Whole Barangay');
    knownWaypoints.forEach((w) => {
      if (w.name && !w.name.includes('Depot') && !w.name.includes('Transfer Station')) {
        set.add(w.name);
      }
    });
    set.add('Purok 1');
    set.add('Purok 2');
    set.add('Purok 3');
    set.add('Main Highway Sector');
    const all = Array.from(set);
    const q = streetName.trim().toLowerCase();
    if (!q) return all.slice(0, 8);
    return all.filter((s) => s.toLowerCase().includes(q));
  }, [barangayName, streetName]);

  // Filtered list of barangays for the filter dropdown
  const filteredBarangayDropdownList = useMemo(() => {
    if (!barangaySearchFilterText.trim()) return dynamicBarangays;
    const q = barangaySearchFilterText.toLowerCase().trim();
    return dynamicBarangays.filter((b) => b.toLowerCase().includes(q));
  }, [dynamicBarangays, barangaySearchFilterText]);

  // 4. Filtering and Sorting Pipeline
  const { filteredGroups, sortedBarangayKeys, totalFilteredSchedules } = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const filtered = schedules.filter((s) => {
      // Barangay filter
      if (selectedBarangayFilter !== 'ALL' && s.barangayName !== selectedBarangayFilter) {
        return false;
      }

      // Day filter
      if (selectedDayFilter !== 'ALL') {
        const days = Array.isArray(s.days) ? s.days : [];
        const hasDay = days.some(
          (d: string) =>
            d.toUpperCase().includes(selectedDayFilter.toUpperCase()) ||
            selectedDayFilter.toUpperCase().includes(d.toUpperCase())
        );
        if (!hasDay) return false;
      }

      // Category filter
      if (selectedCategoryFilter !== 'ALL' && s.wasteCategory !== selectedCategoryFilter) {
        return false;
      }

      // Free-text Search Query
      if (q) {
        const bName = (s.barangayName || '').toLowerCase();
        const street = (s.streetName || '').toLowerCase();
        const trk = (s.truck || '').toLowerCase();
        const cat = (s.wasteCategory || '').toLowerCase();
        const zoneText = (s.zone || '').toLowerCase();
        const daysStr = (s.days || []).join(' ').toLowerCase();

        if (
          !bName.includes(q) &&
          !street.includes(q) &&
          !trk.includes(q) &&
          !cat.includes(q) &&
          !zoneText.includes(q) &&
          !daysStr.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });

    // Group by Barangay -> Street
    const groups: Record<string, Record<string, any[]>> = {};
    filtered.forEach((s) => {
      const b = s.barangayName || 'Unassigned Barangay';
      const street = s.streetName || 'Whole Barangay';
      if (!groups[b]) groups[b] = {};
      if (!groups[b][street]) groups[b][street] = [];
      groups[b][street].push(s);
    });

    // Sort Barangay Groups
    let bKeys = Object.keys(groups);
    if (sortBy === 'name_asc') {
      bKeys.sort((a, b) => a.localeCompare(b));
    } else if (sortBy === 'name_desc') {
      bKeys.sort((a, b) => b.localeCompare(a));
    } else if (sortBy === 'routes_count') {
      bKeys.sort(
        (a, b) =>
          Object.keys(groups[b]).length - Object.keys(groups[a]).length ||
          a.localeCompare(b)
      );
    } else if (sortBy === 'newest' || sortBy === 'oldest') {
      bKeys.sort((a, b) => {
        const aScheds = Object.values(groups[a]).flat();
        const bScheds = Object.values(groups[b]).flat();
        const aTime = Math.max(...aScheds.map((s) => s.createdAt?.seconds || 0));
        const bTime = Math.max(...bScheds.map((s) => s.createdAt?.seconds || 0));
        return sortBy === 'newest' ? bTime - aTime : aTime - bTime;
      });
    }

    return {
      filteredGroups: groups,
      sortedBarangayKeys: bKeys,
      totalFilteredSchedules: filtered.length,
    };
  }, [
    schedules,
    selectedBarangayFilter,
    selectedDayFilter,
    selectedCategoryFilter,
    searchQuery,
    sortBy,
  ]);

  // Paginated Barangay Keys
  const totalPages = Math.max(1, Math.ceil(sortedBarangayKeys.length / itemsPerPage));
  const paginatedBarangayKeys = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedBarangayKeys.slice(start, start + itemsPerPage);
  }, [sortedBarangayKeys, currentPage, itemsPerPage]);

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
    if (formErrors.selectedDays) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next.selectedDays;
        return next;
      });
    }
  };

  const handleSelectAllDays = () => {
    if (selectedDays.length === DAYS_OF_WEEK.length) {
      setSelectedDays([]);
    } else {
      setSelectedDays([...DAYS_OF_WEEK]);
    }
    if (formErrors.selectedDays) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next.selectedDays;
        return next;
      });
    }
  };

  // Open modal for Create New Barangay & Schedule
  const handleOpenAddModal = (presetBarangayName?: string) => {
    setEditingScheduleId(null);
    setBarangayName(presetBarangayName || '');
    setZone('');
    setStreetName('');
    setSelectedDays(['MON', 'WED', 'FRI']);
    setTruckName('');
    setWasteCategory('BIODEGRADABLE');
    setModalTimeStr('06:00 AM');
    setShowModalAnalogTimePicker(false);
    setFormErrors({});
    setBarangaySuggestionsOpen(false);
    setStreetSuggestionsOpen(false);
    setTruckPickerOpen(false);
    setModalVisible(true);
  };

  // Open modal for Editing an existing schedule
  const handleOpenEditModal = (schedule: any) => {
    setEditingScheduleId(schedule.id);
    setBarangayName(schedule.barangayName || '');
    setZone(schedule.zone || '');
    setStreetName(schedule.streetName || '');
    setSelectedDays(schedule.days || []);
    setTruckName(schedule.truck || '');
    setWasteCategory(schedule.wasteCategory || 'BIODEGRADABLE');
    setModalTimeStr(schedule.time || schedule.timeText || schedule.collectionTime || '06:00 AM');
    setShowModalAnalogTimePicker(false);
    setFormErrors({});
    setBarangaySuggestionsOpen(false);
    setStreetSuggestionsOpen(false);
    setTruckPickerOpen(false);
    setModalVisible(true);
  };

  // Save or Update Schedule
  const handleSaveSchedule = async () => {
    const errors: { [key: string]: string } = {};

    if (!barangayName.trim()) {
      errors.barangayName = 'Barangay name is required.';
    }
    if (!streetName.trim()) {
      errors.streetName = 'Street or route sector is required (e.g., Whole Barangay).';
    }
    if (selectedDays.length === 0) {
      errors.selectedDays = 'Select at least one regular collection day.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const chosenTime = modalTimeStr || '06:00 AM';

      const schedulePayload = {
        barangayName: barangayName.trim(),
        zone: zone.trim(),
        streetName: streetName.trim(),
        days: selectedDays,
        truck: truckName.trim(),
        wasteCategory: wasteCategory,
        time: chosenTime,
        timeText: chosenTime,
        collectionTime: chosenTime,
        updatedAt: serverTimestamp(),
      };

      if (editingScheduleId) {
        // Update existing schedule doc
        const docRef = doc(db, 'barangay_schedules', editingScheduleId);
        await updateDoc(docRef, schedulePayload);
      } else {
        // Create new schedule doc
        await addDoc(collection(db, 'barangay_schedules'), {
          ...schedulePayload,
          createdAt: serverTimestamp(),
        });
      }

      setModalVisible(false);
      setEditingScheduleId(null);
      setBarangayName('');
      setZone('');
      setStreetName('');
      setSelectedDays([]);
      setTruckName('');
      setWasteCategory('BIODEGRADABLE');
      setFormErrors({});
    } catch (error: any) {
      console.error('Error saving schedule:', error);
      Alert.alert('Error', error.message || 'Could not save the schedule.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Schedule
  const handleDeleteSchedule = async (scheduleId: string) => {
    const doDelete = async () => {
      setIsDeleting(true);
      try {
        await deleteDoc(doc(db, 'barangay_schedules', scheduleId));
        if (selectedBarangay?.id === scheduleId) {
          setDetailsModalVisible(false);
        }
      } catch (err: any) {
        console.error('Error deleting:', err);
        Alert.alert('Error', 'Could not delete schedule.');
      } finally {
        setIsDeleting(false);
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        'Are you sure you want to remove this schedule? This will immediately remove it from the citizen and driver schedules.'
      );
      if (confirmed) await doDelete();
    } else {
      Alert.alert(
        'Delete Schedule',
        'Are you sure you want to remove this schedule? This will immediately remove it from citizen and driver schedules.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  // Add Specific Date/Time Pickup
  const formattedDate =
    Platform.OS === 'web'
      ? webDateStr
        ? `${webDateStr.split('-')[1]}/${webDateStr.split('-')[2]}`
        : ''
      : `${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj
          .getDate()
          .toString()
          .padStart(2, '0')}`;

  const formatTime = (d: Date) => {
    let h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12;
    return `${h.toString().padStart(2, '0')}:${m} ${ampm}`;
  };

  const formattedTime =
    Platform.OS === 'web'
      ? webTimeStr
        ? (function () {
            const [hours, mins] = webTimeStr.split(':');
            let h = parseInt(hours, 10);
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12;
            h = h ? h : 12;
            return `${h.toString().padStart(2, '0')}:${mins} ${ampm}`;
          })()
        : ''
      : formatTime(dateObj);

  const handleSaveSpecificSchedule = async () => {
    if (!selectedBarangay) return;

    if (Platform.OS === 'web' && !webDateStr) {
      Alert.alert('Date Required', 'Please select a valid date.');
      return;
    }

    setIsSavingDetail(true);
    try {
      const docRef = doc(db, 'barangay_schedules', selectedBarangay.id);
      const newEntry = {
        date: formattedDate,
        time: formattedTime,
        category: specificCategory,
        createdAt: new Date().toISOString(),
      };

      await updateDoc(docRef, {
        specificSchedules: arrayUnion(newEntry),
      });

      setSelectedBarangay({
        ...selectedBarangay,
        specificSchedules: [...(selectedBarangay.specificSchedules || []), newEntry],
      });

      const resetDate = new Date();
      resetDate.setHours(0, 0, 0, 0);
      setDateObj(resetDate);
      if (Platform.OS === 'web') {
        setWebTimeStr('00:00');
        setWebDateStr('');
      }
      setSpecificCategory('BIODEGRADABLE');
    } catch (error: any) {
      console.error('Error adding specific schedule:', error);
      Alert.alert('Error', 'Failed to save specific schedule.');
    } finally {
      setIsSavingDetail(false);
    }
  };

  const handleDeleteSpecificSchedule = async (scheduleIndex: number) => {
    if (!selectedBarangay || !selectedBarangay.specificSchedules) return;

    const doDeleteSpecific = async () => {
      setIsDeleting(true);
      try {
        const updatedSchedules = [...selectedBarangay.specificSchedules];
        updatedSchedules.splice(scheduleIndex, 1);

        const docRef = doc(db, 'barangay_schedules', selectedBarangay.id);
        await updateDoc(docRef, {
          specificSchedules: updatedSchedules,
        });

        setSelectedBarangay({
          ...selectedBarangay,
          specificSchedules: updatedSchedules,
        });
      } catch (error) {
        console.error('Error deleting specific schedule:', error);
        Alert.alert('Error', 'Could not delete specific schedule.');
      } finally {
        setIsDeleting(false);
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to remove this specific pickup?');
      if (confirmed) await doDeleteSpecific();
    } else {
      Alert.alert('Delete Pickup', 'Are you sure you want to remove this specific pickup?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDeleteSpecific },
      ]);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    try {
      const rows = [
        ['Barangay', 'Zone', 'Street/Route', 'Collection Days', 'Assigned Truck', 'Category'],
      ];
      schedules.forEach((s) => {
        rows.push([
          `"${s.barangayName || ''}"`,
          `"${s.zone || ''}"`,
          `"${s.streetName || 'Whole Barangay'}"`,
          `"${(s.days || []).join(', ')}"`,
          `"${s.truck || ''}"`,
          `"${s.wasteCategory || ''}"`,
        ]);
      });

      const csvContent = rows.map((e) => e.join(',')).join('\n');
      if (Platform.OS === 'web') {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Collection_Schedules_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        Alert.alert('Exported', `${schedules.length} schedules prepared for export.`);
      }
    } catch (err) {
      console.error('CSV Export Error:', err);
      Alert.alert('Export Failed', 'Unable to generate schedule export.');
    }
  };

  return (
    <ScrollView
      style={[styles.container, isMobile && { padding: 14 }]}
      contentContainerStyle={{ paddingBottom: 40 }}
      nestedScrollEnabled
    >
      {/* Header */}
      <View style={[styles.headerRow, isMobile && { flexDirection: 'column', gap: 12 }]}>
        <View>
          <Text style={styles.headerTitle}>Collection Schedules</Text>
          <Text style={styles.headerDesc}>
            Manage waste collection days, assigned trucks, and regular routes across all dynamic barangays.
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.outlineBtn} onPress={handleExportCSV} activeOpacity={0.8}>
            <MaterialIcons name="file-download" size={18} color="#374151" />
            <Text style={styles.outlineBtnText}>Export CSV</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Interactive Controls & Filters Bar */}
      <View style={[styles.controlsBar, isNarrow && { flexDirection: 'column', alignItems: 'stretch', gap: 14 }]}>
        <View style={[styles.filtersRow, isNarrow && { flexWrap: 'wrap', width: '100%', gap: 10 }]}>
          {/* Free-text Search */}
          <View style={[styles.searchBox, isMobile && { width: '100%' }]}>
            <MaterialIcons name="search" size={18} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search barangay, route, truck..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={(t) => {
                setSearchQuery(t);
                setCurrentPage(1);
              }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialIcons name="close" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Barangay Filter Dropdown */}
          <View style={[styles.filterDropdownWrapper, isMobile && { flex: 1, minWidth: '48%' }]}>
            <TouchableOpacity
              style={[
                styles.filterDropdownBtn,
                selectedBarangayFilter !== 'ALL' && styles.filterDropdownBtnActive,
              ]}
              onPress={() => {
                setIsBarangayFilterOpen(!isBarangayFilterOpen);
                setIsDayFilterOpen(false);
                setIsSortFilterOpen(false);
                setIsCategoryFilterOpen(false);
              }}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name="location-on"
                size={16}
                color={selectedBarangayFilter !== 'ALL' ? '#059669' : '#64748B'}
              />
              <Text
                style={[
                  styles.filterDropdownBtnText,
                  selectedBarangayFilter !== 'ALL' && { color: '#059669', fontWeight: '800' },
                ]}
                numberOfLines={1}
              >
                {selectedBarangayFilter === 'ALL'
                  ? 'All Barangays'
                  : `Brgy. ${selectedBarangayFilter}`}
              </Text>
              <MaterialIcons
                name={isBarangayFilterOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                size={18}
                color="#64748B"
              />
            </TouchableOpacity>

            {isBarangayFilterOpen && (
              <View style={styles.dropdownPopup}>
                <View style={styles.dropdownSearchHeader}>
                  <MaterialIcons name="search" size={14} color="#94A3B8" />
                  <TextInput
                    style={styles.dropdownSearchInput}
                    placeholder="Filter barangays..."
                    placeholderTextColor="#94A3B8"
                    value={barangaySearchFilterText}
                    onChangeText={setBarangaySearchFilterText}
                  />
                  {barangaySearchFilterText.length > 0 && (
                    <TouchableOpacity onPress={() => setBarangaySearchFilterText('')}>
                      <MaterialIcons name="close" size={14} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>
                <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                  <TouchableOpacity
                    style={[
                      styles.dropdownPopupItem,
                      selectedBarangayFilter === 'ALL' && styles.dropdownPopupItemSelected,
                    ]}
                    onPress={() => {
                      setSelectedBarangayFilter('ALL');
                      setIsBarangayFilterOpen(false);
                      setCurrentPage(1);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownPopupItemText,
                        selectedBarangayFilter === 'ALL' && { color: '#059669', fontWeight: '800' },
                      ]}
                    >
                      All Barangays ({dynamicBarangays.length})
                    </Text>
                  </TouchableOpacity>

                  {filteredBarangayDropdownList.map((b) => (
                    <TouchableOpacity
                      key={b}
                      style={[
                        styles.dropdownPopupItem,
                        selectedBarangayFilter === b && styles.dropdownPopupItemSelected,
                      ]}
                      onPress={() => {
                        setSelectedBarangayFilter(b);
                        setIsBarangayFilterOpen(false);
                        setCurrentPage(1);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownPopupItemText,
                          selectedBarangayFilter === b && { color: '#059669', fontWeight: '800' },
                        ]}
                      >
                        {b}
                      </Text>
                      {selectedBarangayFilter === b && (
                        <MaterialIcons name="check" size={16} color="#059669" />
                      )}
                    </TouchableOpacity>
                  ))}

                  {filteredBarangayDropdownList.length === 0 && (
                    <View style={{ padding: 12, alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, color: '#94A3B8' }}>No barangays found</Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Day of Week Filter Dropdown */}
          <View style={[styles.filterDropdownWrapper, isMobile && { flex: 1, minWidth: '48%' }]}>
            <TouchableOpacity
              style={[
                styles.filterDropdownBtn,
                selectedDayFilter !== 'ALL' && styles.filterDropdownBtnActive,
              ]}
              onPress={() => {
                setIsDayFilterOpen(!isDayFilterOpen);
                setIsBarangayFilterOpen(false);
                setIsSortFilterOpen(false);
                setIsCategoryFilterOpen(false);
              }}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name="event"
                size={16}
                color={selectedDayFilter !== 'ALL' ? '#059669' : '#64748B'}
              />
              <Text
                style={[
                  styles.filterDropdownBtnText,
                  selectedDayFilter !== 'ALL' && { color: '#059669', fontWeight: '800' },
                ]}
                numberOfLines={1}
              >
                {selectedDayFilter === 'ALL' ? 'Any Day' : selectedDayFilter}
              </Text>
              <MaterialIcons
                name={isDayFilterOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                size={18}
                color="#64748B"
              />
            </TouchableOpacity>

            {isDayFilterOpen && (
              <View style={styles.dropdownPopup}>
                <TouchableOpacity
                  style={[
                    styles.dropdownPopupItem,
                    selectedDayFilter === 'ALL' && styles.dropdownPopupItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedDayFilter('ALL');
                    setIsDayFilterOpen(false);
                    setCurrentPage(1);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownPopupItemText,
                      selectedDayFilter === 'ALL' && { color: '#059669', fontWeight: '800' },
                    ]}
                  >
                    Any Day of the Week
                  </Text>
                </TouchableOpacity>
                {DAYS_OF_WEEK.map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.dropdownPopupItem,
                      selectedDayFilter === d && styles.dropdownPopupItemSelected,
                    ]}
                    onPress={() => {
                      setSelectedDayFilter(d);
                      setIsDayFilterOpen(false);
                      setCurrentPage(1);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownPopupItemText,
                        selectedDayFilter === d && { color: '#059669', fontWeight: '800' },
                      ]}
                    >
                      {d}
                    </Text>
                    {selectedDayFilter === d && (
                      <MaterialIcons name="check" size={16} color="#059669" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Sort Dropdown */}
          <View style={[styles.filterDropdownWrapper, isMobile && { flex: 1, minWidth: '48%' }]}>
            <TouchableOpacity
              style={styles.filterDropdownBtn}
              onPress={() => {
                setIsSortFilterOpen(!isSortFilterOpen);
                setIsBarangayFilterOpen(false);
                setIsDayFilterOpen(false);
                setIsCategoryFilterOpen(false);
              }}
              activeOpacity={0.8}
            >
              <MaterialIcons name="sort" size={16} color="#64748B" />
              <Text style={styles.filterDropdownBtnText} numberOfLines={1}>
                {SORT_OPTIONS.find((s) => s.id === sortBy)?.label || 'Sort'}
              </Text>
              <MaterialIcons
                name={isSortFilterOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                size={18}
                color="#64748B"
              />
            </TouchableOpacity>

            {isSortFilterOpen && (
              <View style={styles.dropdownPopup}>
                {SORT_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      styles.dropdownPopupItem,
                      sortBy === opt.id && styles.dropdownPopupItemSelected,
                    ]}
                    onPress={() => {
                      setSortBy(opt.id);
                      setIsSortFilterOpen(false);
                      setCurrentPage(1);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownPopupItemText,
                        sortBy === opt.id && { color: '#059669', fontWeight: '800' },
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {sortBy === opt.id && (
                      <MaterialIcons name="check" size={16} color="#059669" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Action Button: Add New Barangay */}
        <View style={styles.buttonsRow}>
          <TouchableOpacity
            style={[styles.primaryBtn, isMobile && { width: '100%', justifyContent: 'center' }]}
            onPress={() => handleOpenAddModal()}
            activeOpacity={0.8}
          >
            <MaterialIcons name="add" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Add New Barangay</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Table Card */}
      <View style={[styles.card, isMobile && { padding: 12 }]}>
        <ScrollView
          horizontal={isMobile}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, minWidth: '100%' }}
          style={{ width: '100%' }}
        >
          <View style={{ minWidth: isMobile ? 700 : '100%', width: '100%' }}>
            {/* Table Header */}
            <View style={styles.tableHead}>
              <Text style={[styles.th, { flex: 2.5 }]}>BARANGAY NAME</Text>
              <Text style={[styles.th, { flex: 3.5 }]}>RECURRING COLLECTION SCHEDULE</Text>
              <Text style={[styles.th, { flex: 1.5, textAlign: 'right', paddingRight: 24 }]}>ACTIONS</Text>
            </View>

            {loading ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#059669" />
                <Text style={{ color: '#64748B', fontSize: 13, marginTop: 12 }}>
                  Loading collection schedules...
                </Text>
              </View>
            ) : sortedBarangayKeys.length === 0 ? (
              <View style={{ padding: 48, alignItems: 'center' }}>
                <MaterialIcons name="event-busy" size={48} color="#CBD5E1" />
                <Text style={{ color: '#0F172A', fontWeight: '700', fontSize: 16, marginTop: 12 }}>
                  No barangay schedules found
                </Text>
                <Text style={{ color: '#64748B', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                  {schedules.length === 0
                    ? "Click '+ Add New Barangay' above to register your first barangay and collection route."
                    : 'No schedules match the active filters or search term.'}
                </Text>
                {selectedBarangayFilter !== 'ALL' || selectedDayFilter !== 'ALL' || searchQuery ? (
                  <TouchableOpacity
                    style={styles.clearFiltersBtn}
                    onPress={() => {
                      setSelectedBarangayFilter('ALL');
                      setSelectedDayFilter('ALL');
                      setSelectedCategoryFilter('ALL');
                      setSearchQuery('');
                    }}
                  >
                    <Text style={styles.clearFiltersBtnText}>Reset All Filters</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              paginatedBarangayKeys.map((bName) => {
                const streetsInBarangay = filteredGroups[bName] || {};
                const streetCount = Object.keys(streetsInBarangay).length;
                const allSchedsInBarangay = Object.values(streetsInBarangay).flat();
                const isExpanded = expandedBarangay === bName;

                return (
                  <View key={bName} style={styles.accordionContainer}>
                    {/* Barangay Header Row */}
                    <TouchableOpacity
                      style={[styles.tableRow, isExpanded && styles.tableRowActive]}
                      onPress={() => setExpandedBarangay(isExpanded ? null : bName)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.td,
                          {
                            flex: 2.5,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 12,
                          },
                        ]}
                      >
                        <View style={styles.avatarBadge}>
                          <Text style={styles.avatarText}>
                            {(bName || 'BR').substring(0, 2).toUpperCase()}
                          </Text>
                        </View>
                        <View>
                          <Text style={styles.brgyName}>{bName}</Text>
                          <Text style={styles.brgyDesc}>
                            {streetCount} {streetCount === 1 ? 'Route / Sector' : 'Routes / Sectors'}
                          </Text>
                        </View>
                      </View>

                      {/* Quick Days summary preview */}
                      <View
                        style={[
                          styles.td,
                          {
                            flex: 3.5,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            flexWrap: 'wrap',
                          },
                        ]}
                      >
                        {Array.from(
                          new Set(allSchedsInBarangay.flatMap((s) => s.days || []))
                        )
                          .slice(0, 5)
                          .map((d, dIdx) => (
                            <View key={dIdx} style={styles.dayBadge}>
                              <Text style={styles.dayText}>{d}</Text>
                            </View>
                          ))}
                        <View style={styles.activeStatusBadge}>
                          <View style={styles.activeStatusDot} />
                          <Text style={styles.activeStatusText}>Active Route</Text>
                        </View>
                      </View>

                      {/* Expand / Collapse Icon */}
                      <View style={[styles.td, { flex: 1.5, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingRight: 16 }]}>
                        <MaterialIcons
                          name={isExpanded ? 'expand-less' : 'expand-more'}
                          size={24}
                          color="#64748B"
                        />
                      </View>
                    </TouchableOpacity>

                    {/* Accordion Body: List of Routes/Streets in this Barangay */}
                    {isExpanded && (
                      <View style={styles.accordionBody}>
                        {Object.keys(streetsInBarangay).map((streetNameKey) => {
                          const routeSchedules = streetsInBarangay[streetNameKey] || [];
                          const fullStreetId = `${bName}-${streetNameKey}`;
                          const isStreetExpanded =
                            expandedStreet === fullStreetId || Object.keys(streetsInBarangay).length === 1;

                          return (
                            <View key={streetNameKey} style={styles.streetContainer}>
                              {/* Route / Sector Header */}
                              <TouchableOpacity
                                style={styles.streetRow}
                                onPress={() => {
                                  setExpandedStreet(
                                    expandedStreet === fullStreetId ? null : fullStreetId
                                  );
                                }}
                                activeOpacity={0.8}
                              >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                  <MaterialIcons name="route" size={18} color="#059669" />
                                  <Text style={styles.streetNameText}>{streetNameKey}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                  <Text style={styles.streetDescText}>
                                    {routeSchedules.length}{' '}
                                    {routeSchedules.length === 1 ? 'Schedule' : 'Schedules'}
                                  </Text>
                                  <MaterialIcons
                                    name={isStreetExpanded ? 'expand-less' : 'expand-more'}
                                    size={20}
                                    color="#64748B"
                                  />
                                </View>
                              </TouchableOpacity>

                              {/* Schedules List for this route */}
                              {isStreetExpanded && (
                                <View style={styles.schedulesBody}>
                                  {routeSchedules.map((row) => (
                                    <View key={row.id} style={styles.scheduleItemRow}>
                                      {/* Days & Time Column */}
                                      <View
                                        style={{
                                          flex: 1,
                                          flexDirection: 'column',
                                          gap: 6,
                                        }}
                                      >
                                        <View
                                          style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 6,
                                            flexWrap: 'wrap',
                                          }}
                                        >
                                          {(row.days || []).map((day: string, dIdx: number) => (
                                            <View key={`d-${dIdx}`} style={styles.dayBadge}>
                                              <Text style={styles.dayText}>{day}</Text>
                                            </View>
                                          ))}
                                          <View
                                            style={[
                                              styles.dayBadge,
                                              {
                                                backgroundColor: '#F0FDF4',
                                                borderColor: '#BBF7D0',
                                                borderWidth: 1,
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                gap: 3,
                                              },
                                            ]}
                                          >
                                            <MaterialIcons name="access-time" size={11} color="#166534" />
                                            <Text style={[styles.dayText, { color: '#166534', fontWeight: '800' }]}>
                                              {row.time || row.timeText || row.collectionTime || '06:00 AM'}
                                            </Text>
                                          </View>
                                        </View>

                                        {/* Specific Pickups */}
                                        {(row.specificSchedules || []).length > 0 && (
                                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                                            {(row.specificSchedules || []).map((ss: any, idx: number) => (
                                              <View
                                                key={`ss-${idx}`}
                                                style={[
                                                  styles.dayBadge,
                                                  {
                                                    backgroundColor: '#EEF2FF',
                                                    borderColor: '#C7D2FE',
                                                    borderWidth: 1,
                                                  },
                                                ]}
                                              >
                                                <Text style={[styles.dayText, { color: '#4338CA', fontWeight: '700' }]}>
                                                  {ss.date} {ss.time}
                                                </Text>
                                              </View>
                                            ))}
                                          </View>
                                        )}
                                      </View>

                                      {/* Action Buttons */}
                                      <View
                                        style={{
                                          flexDirection: 'row',
                                          alignItems: 'center',
                                          gap: 8,
                                        }}
                                      >
                                        {/* Specific Pickups */}
                                        <TouchableOpacity
                                          onPress={() => {
                                            setSelectedBarangay(row);
                                            setDetailsModalVisible(true);
                                          }}
                                          style={styles.actionIconBtn}
                                          activeOpacity={0.7}
                                        >
                                          <MaterialIcons
                                            name="calendar-today"
                                            size={16}
                                            color="#059669"
                                          />
                                        </TouchableOpacity>

                                        {/* Edit Schedule */}
                                        <TouchableOpacity
                                          onPress={() => handleOpenEditModal(row)}
                                          style={styles.actionIconBtn}
                                          activeOpacity={0.7}
                                        >
                                          <MaterialIcons name="edit" size={16} color="#475569" />
                                        </TouchableOpacity>

                                        {/* Delete Schedule */}
                                        <TouchableOpacity
                                          onPress={() => handleDeleteSchedule(row.id)}
                                          style={[styles.actionIconBtn, styles.actionIconBtnDanger]}
                                          activeOpacity={0.7}
                                        >
                                          <MaterialIcons
                                            name="delete-outline"
                                            size={16}
                                            color="#EF4444"
                                          />
                                        </TouchableOpacity>
                                      </View>
                                    </View>
                                  ))}
                                </View>
                              )}
                            </View>
                          );
                        })}

                        {/* Button to add another route/sector to this specific Barangay */}
                        <TouchableOpacity
                          style={styles.addStreetBtn}
                          onPress={() => handleOpenAddModal(bName)}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons name="add-circle-outline" size={18} color="#059669" />
                          <Text style={styles.addStreetBtnText}>
                            Add Route / Sector to {bName}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>

        {/* Pagination Footer */}
        {sortedBarangayKeys.length > 0 && (
          <View style={styles.pagination}>
            <Text style={styles.pageInfo}>
              Showing {sortedBarangayKeys.length} {sortedBarangayKeys.length === 1 ? 'Barangay' : 'Barangays'} •{' '}
              {totalFilteredSchedules} {totalFilteredSchedules === 1 ? 'Schedule' : 'Schedules'} Total
            </Text>
            {totalPages > 1 && (
              <View style={styles.pageControls}>
                <TouchableOpacity
                  style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
                  onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <MaterialIcons
                    name="chevron-left"
                    size={20}
                    color={currentPage === 1 ? '#CBD5E1' : '#1E293B'}
                  />
                </TouchableOpacity>
                <Text style={styles.pageNum}>
                  Page {currentPage} of {totalPages}
                </Text>
                <TouchableOpacity
                  style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]}
                  onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <MaterialIcons
                    name="chevron-right"
                    size={20}
                    color={currentPage === totalPages ? '#CBD5E1' : '#1E293B'}
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      {/* ========================================================================= */}
      {/* ADD / EDIT BARANGAY SCHEDULE MODAL                                       */}
      {/* ========================================================================= */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isMobile && { width: '95%', padding: 18 }]}>
            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingScheduleId ? 'Edit Barangay Schedule' : 'Add New Barangay & Schedule'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Register dynamic barangay routes and waste collection operational parameters.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.modalCloseBtn}
                activeOpacity={0.7}
              >
                <MaterialIcons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: 520 }}
              contentContainerStyle={{ paddingVertical: 6 }}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {/* SECTION 1: Barangay Identification */}
              <View style={styles.modalSectionCard}>
                <View style={styles.modalSectionHeader}>
                  <View style={styles.modalSectionBadge}>
                    <MaterialIcons name="location-city" size={16} color="#059669" />
                  </View>
                  <Text style={styles.modalSectionTitle}>1. Administrative Barangay</Text>
                </View>

                {/* Barangay Name Input */}
                <View style={{ marginBottom: 14 }}>
                  <Text style={styles.inputLabel}>
                    BARANGAY NAME <Text style={styles.requiredAsterisk}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      formErrors.barangayName && styles.inputErrorBorder,
                    ]}
                    placeholder="e.g., Poblacion, Maslog, Guinsay, Suba"
                    placeholderTextColor="#94A3B8"
                    value={barangayName}
                    onChangeText={(t) => {
                      setBarangayName(t);
                      setBarangaySuggestionsOpen(t.trim().length > 0);
                      if (formErrors.barangayName) {
                        setFormErrors((prev) => {
                          const next = { ...prev };
                          delete next.barangayName;
                          return next;
                        });
                      }
                    }}
                  />
                  {formErrors.barangayName ? (
                    <Text style={styles.fieldError}>{formErrors.barangayName}</Text>
                  ) : null}

                  {/* Suggestions from unadded Danao City Barangays */}
                  {barangaySuggestionsOpen && (
                    <View style={styles.suggestionsContainer}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={styles.suggestionsLabel}>
                          Available Danao City Barangays ({availableUnregisteredDanaoBarangays.length} unassigned):
                        </Text>
                        <TouchableOpacity onPress={() => setBarangaySuggestionsOpen(false)}>
                          <MaterialIcons name="close" size={14} color="#64748B" />
                        </TouchableOpacity>
                      </View>
                      {suggestedUnregisteredBarangays.length > 0 ? (
                        <ScrollView style={{ maxHeight: 130 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                          {suggestedUnregisteredBarangays.map((b) => (
                            <TouchableOpacity
                              key={b}
                              style={styles.suggestionItem}
                              onPress={() => {
                                setBarangayName(b);
                                setBarangaySuggestionsOpen(false);
                                if (formErrors.barangayName) {
                                  setFormErrors((prev) => {
                                    const next = { ...prev };
                                    delete next.barangayName;
                                    return next;
                                  });
                                }
                              }}
                            >
                              <MaterialIcons name="add-location-alt" size={14} color="#059669" />
                              <Text style={styles.suggestionItemText}>{b}</Text>
                              <Text style={{ fontSize: 10, color: '#059669', fontWeight: '800', marginLeft: 'auto' }}>
                                Select
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      ) : (
                        <View style={{ paddingVertical: 6 }}>
                          <Text style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic' }}>
                            {isAlreadyRegistered
                              ? `Barangay '${barangayName.trim()}' already exists in collection schedules.`
                              : 'No matching unassigned Danao City barangays.'}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Warning if typed barangay is already registered */}
                  {isAlreadyRegistered && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 }}>
                      <MaterialIcons name="error-outline" size={14} color="#EF4444" />
                      <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '700' }}>
                        Barangay '{barangayName.trim()}' already has a collection schedule registered.
                      </Text>
                    </View>
                  )}
                </View>

                {/* Zone and Street/Route row */}
                <View style={styles.formGrid}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>ZONE / DISTRICT (OPTIONAL)</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. Zone 1 - Coastal"
                      placeholderTextColor="#94A3B8"
                      value={zone}
                      onChangeText={setZone}
                    />
                  </View>
                  <View style={{ flex: 1.2 }}>
                    <Text style={styles.inputLabel}>
                      STREET / ROUTE SECTOR <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        formErrors.streetName && styles.inputErrorBorder,
                      ]}
                      placeholder="e.g. Rizal St. or Whole Barangay"
                      placeholderTextColor="#94A3B8"
                      value={streetName}
                      onFocus={() => setStreetSuggestionsOpen(true)}
                      onChangeText={(t) => {
                        setStreetName(t);
                        setStreetSuggestionsOpen(true);
                        if (formErrors.streetName) {
                          setFormErrors((prev) => {
                            const next = { ...prev };
                            delete next.streetName;
                            return next;
                          });
                        }
                      }}
                    />
                    {formErrors.streetName ? (
                      <Text style={styles.fieldError}>{formErrors.streetName}</Text>
                    ) : null}

                    {/* Street suggestions dropdown */}
                    {streetSuggestionsOpen && suggestedStreetsForBarangay.length > 0 && (
                      <View style={styles.suggestionsContainer}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={styles.suggestionsLabel}>Suggested Routes / Sectors:</Text>
                          <TouchableOpacity onPress={() => setStreetSuggestionsOpen(false)}>
                            <MaterialIcons name="close" size={14} color="#64748B" />
                          </TouchableOpacity>
                        </View>
                        <ScrollView style={{ maxHeight: 110 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                          {suggestedStreetsForBarangay.map((s) => (
                            <TouchableOpacity
                              key={s}
                              style={styles.suggestionItem}
                              onPress={() => {
                                setStreetName(s);
                                setStreetSuggestionsOpen(false);
                                if (formErrors.streetName) {
                                  setFormErrors((prev) => {
                                    const next = { ...prev };
                                    delete next.streetName;
                                    return next;
                                  });
                                }
                              }}
                            >
                              <MaterialIcons name="alt-route" size={14} color="#059669" />
                              <Text style={styles.suggestionItemText}>{s}</Text>
                              <Text style={{ fontSize: 10, color: '#059669', fontWeight: '800', marginLeft: 'auto' }}>
                                Select
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* SECTION 2: Collection Parameters */}
              <View style={styles.modalSectionCard}>
                <View style={styles.modalSectionHeader}>
                  <View style={styles.modalSectionBadge}>
                    <MaterialIcons name="schedule" size={16} color="#059669" />
                  </View>
                  <Text style={styles.modalSectionTitle}>2. Collection Schedule & Fleet</Text>
                </View>

                {/* Regular Collection Days */}
                <View style={{ marginBottom: 16 }}>
                  <View style={styles.labelRow}>
                    <Text style={styles.inputLabel}>
                      REGULAR COLLECTION DAYS <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <TouchableOpacity
                      onPress={handleSelectAllDays}
                      style={styles.quickDayBtn}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.quickDayBtnText}>
                        {selectedDays.length === DAYS_OF_WEEK.length
                          ? 'Clear All'
                          : 'Daily Service'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.modalDaysRow}>
                    {DAYS_OF_WEEK.map((day) => {
                      const selected = selectedDays.includes(day);
                      return (
                        <TouchableOpacity
                          key={day}
                          style={[styles.modalDay, selected && styles.modalDaySelected]}
                          onPress={() => toggleDay(day)}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.modalDayText,
                              selected && styles.modalDayTextSelected,
                            ]}
                          >
                            {day}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {formErrors.selectedDays ? (
                    <Text style={styles.fieldError}>{formErrors.selectedDays}</Text>
                  ) : null}
                </View>

                {/* Regular Collection Time */}
                <View style={{ marginBottom: 16 }}>
                  <View style={styles.labelRow}>
                    <Text style={styles.inputLabel}>
                      REGULAR COLLECTION TIME <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <TouchableOpacity
                      onPress={() => setShowModalAnalogTimePicker(true)}
                      style={styles.quickDayBtn}
                    >
                      <MaterialIcons name="schedule" size={14} color="#059669" />
                      <Text style={[styles.quickDayBtnText, { marginLeft: 4 }]}>Open Clock Picker</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Current Selected Time Banner */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: '#F0FDF4',
                      borderColor: '#BBF7D0',
                      borderWidth: 1.5,
                      borderRadius: 10,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      marginBottom: 10,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: '#DCFCE7',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <MaterialIcons name="alarm" size={20} color="#166534" />
                      </View>
                      <View>
                        <Text style={{ fontSize: 11, color: '#166534', fontWeight: '700', textTransform: 'uppercase' }}>
                          Standard Daily Pickup Time
                        </Text>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: '#14532D' }}>
                          {modalTimeStr}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={() => setShowModalAnalogTimePicker(true)}
                      style={{
                        backgroundColor: '#059669',
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 8,
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12 }}>Change Time</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Quick Preset Time Chips */}
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {['05:00 AM', '06:00 AM', '07:00 AM', '08:00 AM', '01:00 PM', '05:00 PM'].map((t) => {
                      const isSel = modalTimeStr === t;
                      return (
                        <TouchableOpacity
                          key={t}
                          style={[
                            styles.dayBadge,
                            {
                              paddingHorizontal: 12,
                              paddingVertical: 6,
                              backgroundColor: isSel ? '#059669' : '#FFFFFF',
                              borderColor: isSel ? '#059669' : '#CBD5E1',
                              borderWidth: 1,
                            },
                          ]}
                          onPress={() => setModalTimeStr(t)}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.dayText,
                              {
                                color: isSel ? '#FFFFFF' : '#334155',
                                fontWeight: isSel ? '800' : '600',
                              },
                            ]}
                          >
                            {t}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Waste Category Selection */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.inputLabel}>
                    WASTE CATEGORY <Text style={styles.requiredAsterisk}>*</Text>
                  </Text>
                  <View style={styles.categoryGrid}>
                    {CATEGORIES.map((cat) => {
                      const isSelected = wasteCategory === cat.name;
                      return (
                        <TouchableOpacity
                          key={cat.name}
                          style={[
                            styles.catBtn,
                            isSelected && {
                              backgroundColor: cat.color,
                              borderColor: cat.color,
                            },
                          ]}
                          onPress={() => setWasteCategory(cat.name)}
                          activeOpacity={0.8}
                        >
                          <MaterialIcons
                            name={cat.icon as any}
                            size={16}
                            color={isSelected ? '#FFFFFF' : cat.color}
                          />
                          <Text
                            style={[
                              styles.catBtnText,
                              isSelected && { color: '#FFFFFF', fontWeight: '800' },
                            ]}
                          >
                            {cat.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Assigned Truck / Driver */}
                <View style={{ marginBottom: 8 }}>
                  <View style={styles.labelRow}>
                    <Text style={styles.inputLabel}>ASSIGNED TRUCK / UNIT (OPTIONAL)</Text>
                    {trucksList.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setTruckPickerOpen(!truckPickerOpen)}
                        style={styles.quickDayBtn}
                      >
                        <Text style={styles.quickDayBtnText}>
                          {truckPickerOpen ? 'Hide Fleet' : 'Select from Fleet'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <TextInput
                    style={styles.textInput}
                    value={truckName}
                    onChangeText={setTruckName}
                    placeholder="e.g. Compactor #101, Truck 04 (Optional)"
                    placeholderTextColor="#94A3B8"
                  />

                  {/* Truck quick selection chips */}
                  {truckPickerOpen && (
                    <View style={styles.truckSuggestions}>
                      {trucksList.map((t) => {
                        const label = t.plateNumber || t.truckNumber || t.name || t.id;
                        return (
                          <TouchableOpacity
                            key={t.id}
                            style={[
                              styles.truckChip,
                              truckName === label && styles.truckChipActive,
                            ]}
                            onPress={() => {
                              setTruckName(label);
                              setTruckPickerOpen(false);
                            }}
                          >
                            <MaterialIcons
                              name="local-shipping"
                              size={14}
                              color={truckName === label ? '#FFFFFF' : '#059669'}
                            />
                            <Text
                              style={[
                                styles.truckChipText,
                                truckName === label && { color: '#FFFFFF' },
                              ]}
                            >
                              {label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setModalVisible(false)}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveSchedule}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>
                    {editingScheduleId ? 'Update Schedule' : 'Save & Register Barangay'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Regular Schedule Analog Clock Modal */}
        <AnalogTimePicker
          visible={showModalAnalogTimePicker}
          onClose={() => setShowModalAnalogTimePicker(false)}
          initialHours24={(() => {
            const [timePart, ampm] = modalTimeStr.split(' ');
            if (!timePart) return 6;
            let [h] = timePart.split(':').map(Number);
            if (ampm === 'PM' && h !== 12) h += 12;
            if (ampm === 'AM' && h === 12) h = 0;
            return h || 6;
          })()}
          initialMinutes={(() => {
            const [timePart] = modalTimeStr.split(' ');
            if (!timePart) return 0;
            const [, m] = timePart.split(':').map(Number);
            return m || 0;
          })()}
          onSelect={(hours24, minutes) => {
            const ampm = hours24 >= 12 ? 'PM' : 'AM';
            let h12 = hours24 % 12;
            if (h12 === 0) h12 = 12;
            const mStr = minutes.toString().padStart(2, '0');
            const formatted = `${h12.toString().padStart(2, '0')}:${mStr} ${ampm}`;
            setModalTimeStr(formatted);
          }}
        />
      </Modal>

      {/* ========================================================================= */}
      {/* SPECIFIC PICKUP DATES & TIMES MODAL                                       */}
      {/* ========================================================================= */}
      <Modal
        visible={isDetailsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isMobile && { width: '95%', padding: 18 }]}>
            {selectedBarangay && (
              <>
                <View style={styles.modalHeaderRow}>
                  <View>
                    <Text style={styles.modalTitle}>
                      {selectedBarangay.barangayName} Specific Pickups
                    </Text>
                    <Text style={styles.modalSubtitle}>
                      {selectedBarangay.streetName || 'Whole Barangay'} • Special dates and times
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => handleDeleteSchedule(selectedBarangay.id)}
                      style={[styles.actionIconBtn, styles.actionIconBtnDanger]}
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <ActivityIndicator size="small" color="#EF4444" />
                      ) : (
                        <MaterialIcons name="delete-outline" size={20} color="#EF4444" />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setDetailsModalVisible(false)}
                      style={styles.modalCloseBtn}
                      disabled={isDeleting}
                    >
                      <MaterialIcons name="close" size={20} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Existing Specific Pickups List */}
                <ScrollView style={{ maxHeight: 180, marginBottom: 16 }}>
                  {(selectedBarangay.specificSchedules || []).length === 0 ? (
                    <View style={{ padding: 16, alignItems: 'center' }}>
                      <Text style={{ color: '#94A3B8', fontSize: 13, fontStyle: 'italic' }}>
                        No specific date/times scheduled yet.
                      </Text>
                    </View>
                  ) : (
                    (selectedBarangay.specificSchedules || []).map((ss: any, idx: number) => (
                      <View key={idx} style={styles.specificScheduleCard}>
                        <View>
                          <Text style={{ fontWeight: '700', color: '#0F172A', fontSize: 14 }}>
                            {ss.date} at {ss.time}
                          </Text>
                          <Text
                            style={{
                              fontSize: 11,
                              color:
                                CATEGORIES.find((c) => c.name === ss.category)?.color || '#059669',
                              fontWeight: '800',
                              marginTop: 2,
                            }}
                          >
                            {ss.category}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleDeleteSpecificSchedule(idx)}
                          style={[styles.actionIconBtn, styles.actionIconBtnDanger]}
                          disabled={isDeleting}
                        >
                          <MaterialIcons name="close" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </ScrollView>

                <View style={styles.modalDivider} />

                {/* Form to add a specific pickup */}
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 12 }}>
                  Add Special Pickup Date
                </Text>

                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>
                      PICKUP DATE <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    {Platform.OS === 'web' ? (
                      <WebDatePicker value={webDateStr} onChange={setWebDateStr} />
                    ) : (
                      <TouchableOpacity
                        style={[styles.textInput, { justifyContent: 'center' }]}
                        onPress={() => setShowDatePicker(true)}
                      >
                        <Text style={{ color: '#0F172A' }}>{formattedDate}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>
                      PICKUP TIME <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    {Platform.OS === 'web' ? (
                      <TouchableOpacity
                        style={[
                          styles.textInput,
                          { justifyContent: 'center', height: 48, boxSizing: 'border-box' as any },
                        ]}
                        onPress={() => setShowAnalogTimePicker(true)}
                      >
                        <Text style={{ color: '#0F172A' }}>{formattedTime}</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[
                          styles.textInput,
                          { justifyContent: 'center', height: 48, boxSizing: 'border-box' as any },
                        ]}
                        onPress={() => setShowTimePicker(true)}
                      >
                        <Text style={{ color: '#0F172A' }}>{formattedTime}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {Platform.OS === 'web' && (
                  <AnalogTimePicker
                    visible={showAnalogTimePicker}
                    onClose={() => setShowAnalogTimePicker(false)}
                    initialHours24={webTimeStr ? parseInt(webTimeStr.split(':')[0], 10) : 0}
                    initialMinutes={webTimeStr ? parseInt(webTimeStr.split(':')[1], 10) : 0}
                    onSelect={(h, m) => {
                      setWebTimeStr(
                        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
                      );
                    }}
                  />
                )}

                {Platform.OS !== 'web' && (showDatePicker || showTimePicker) && (
                  <DateTimePicker
                    value={dateObj}
                    mode={showDatePicker ? 'date' : 'time'}
                    display="default"
                    minimumDate={new Date()}
                    onChange={(event, selectedDate) => {
                      if (Platform.OS !== 'ios') {
                        setShowDatePicker(false);
                        setShowTimePicker(false);
                      }
                      if (selectedDate) {
                        setDateObj(selectedDate);
                      }
                    }}
                  />
                )}

                <Text style={styles.inputLabel}>
                  WASTE CATEGORY <Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <View style={styles.categoryGrid}>
                  {CATEGORIES.map((cat) => {
                    const isSelected = specificCategory === cat.name;
                    return (
                      <TouchableOpacity
                        key={cat.name}
                        style={[
                          styles.catBtn,
                          isSelected && {
                            backgroundColor: cat.color,
                            borderColor: cat.color,
                          },
                        ]}
                        onPress={() => setSpecificCategory(cat.name)}
                      >
                        <Text
                          style={[
                            styles.catBtnText,
                            isSelected && { color: '#FFFFFF', fontWeight: '800' },
                          ]}
                        >
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalSaveBtn}
                    onPress={handleSaveSpecificSchedule}
                    disabled={isSavingDetail}
                  >
                    {isSavingDetail ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.modalSaveText}>Add Pickup</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 28,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 4,
  },
  headerDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 20,
    maxWidth: 620,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },

  // Controls & Filters Bar
  controlsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    zIndex: 100,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    flex: 1,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minWidth: 220,
    gap: 8,
  },
  searchInput: {
    fontSize: 13,
    color: '#0F172A',
    flex: 1,
    padding: 0,
  },
  filterDropdownWrapper: {
    position: 'relative',
    zIndex: 200,
  },
  filterDropdownBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
    minWidth: 140,
  },
  filterDropdownBtnActive: {
    borderColor: '#059669',
    backgroundColor: '#ECFDF5',
  },
  filterDropdownBtnText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
    flex: 1,
  },
  dropdownPopup: {
    position: 'absolute',
    top: 44,
    left: 0,
    minWidth: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 1000,
    overflow: 'hidden',
  },
  dropdownSearchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
    gap: 6,
  },
  dropdownSearchInput: {
    fontSize: 12,
    color: '#0F172A',
    flex: 1,
    padding: 0,
  },
  dropdownPopupItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  dropdownPopupItemSelected: {
    backgroundColor: '#ECFDF5',
  },
  dropdownPopupItemText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },

  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  outlineBtnText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 13,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#1B4D3E',
    shadowColor: '#1B4D3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },

  // Table Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  th: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  tableRowActive: {
    backgroundColor: '#F0FDF4',
  },
  td: {
    justifyContent: 'center',
  },

  avatarBadge: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#059669',
  },
  brgyName: {
    fontWeight: '800',
    color: '#0F172A',
    fontSize: 14,
  },
  brgyDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },

  dayBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  dayText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#047857',
  },

  truckName: {
    fontWeight: '600',
    color: '#334155',
    fontSize: 13,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  activeStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  activeStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
  },
  activeStatusText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#047857',
  },

  actionIconBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconBtnDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
  },

  clearFiltersBtn: {
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  clearFiltersBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
  },

  // Accordion inside table
  accordionContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  accordionBody: {
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  streetContainer: {
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  streetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F1F5F9',
  },
  streetNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  streetDescText: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
  },
  schedulesBody: {
    padding: 8,
  },
  scheduleItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  addStreetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#059669',
    borderStyle: 'dashed',
    borderRadius: 8,
    marginTop: 6,
    backgroundColor: '#ECFDF5',
  },
  addStreetBtnText: {
    color: '#059669',
    fontWeight: '800',
    fontSize: 13,
  },

  // Pagination
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  pageInfo: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  pageControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pageBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pageBtnDisabled: {
    opacity: 0.5,
  },
  pageNum: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 24,
    width: '100%',
    maxWidth: 580,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },

  modalSectionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 14,
  },
  modalSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  modalSectionBadge: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },

  formGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 5,
    letterSpacing: 0.5,
  },
  requiredAsterisk: {
    color: '#EF4444',
    fontWeight: '900',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  inputErrorBorder: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  fieldError: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },

  suggestionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 6,
    padding: 8,
  },
  suggestionsLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  suggestionItemText: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '600',
  },

  modalDaysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  modalDay: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  modalDaySelected: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  modalDayText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  modalDayTextSelected: {
    color: '#FFFFFF',
  },
  quickDayBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#ECFDF5',
  },
  quickDayBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#059669',
  },

  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  catBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  catBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },

  truckSuggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  truckChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  truckChipActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  truckChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },

  modalDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 14,
  },
  specificScheduleCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 6,
  },

  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 14,
  },
  modalCancelBtn: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  modalCancelText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 13,
  },
  modalSaveBtn: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#1B4D3E',
    minWidth: 120,
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
});

