import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
// Web-only portal to ensure dropdown overlays escape ScrollView clipping
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - only resolved on web
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { createPortal } from 'react-dom';
import { auth, db } from '../../config/firebase';
import ErrorModal from '../ErrorModal';

const ScheduleTab: React.FC = () => {
  const [scheduleMode, setScheduleMode] = useState<'add' | 'edit'>('add');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [timeText, setTimeText] = useState('');
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  const [selectedStreet, setSelectedStreet] = useState('');
  const [frequency, setFrequency] = useState('');
  const [duration, setDuration] = useState('');
  const [wasteCategory, setWasteCategory] = useState('');
  const [truck, setTruck] = useState('');
  const [driver, setDriver] = useState('');
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{ id: string; text: string }>>([]);
  const [showStreetDropdown, setShowStreetDropdown] = useState(false);
  const timeAnchorRef = useRef<any>(null);
  const streetAnchorRef = useRef<any>(null);
  const [timePortalRect, setTimePortalRect] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const [streetPortalRect, setStreetPortalRect] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const freqAnchorRef = useRef<any>(null);
  const wasteAnchorRef = useRef<any>(null);
  const truckAnchorRef = useRef<any>(null);
  const [showFrequencyDropdown, setShowFrequencyDropdown] = useState(false);
  const [showDurationDropdown, setShowDurationDropdown] = useState(false);
  const [showWasteDropdown, setShowWasteDropdown] = useState(false);
  const [showTruckDropdown, setShowTruckDropdown] = useState(false);
  const [freqPortalRect, setFreqPortalRect] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const [durationPortalRect, setDurationPortalRect] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const [wastePortalRect, setWastePortalRect] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const [truckPortalRect, setTruckPortalRect] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const driverAnchorRef = useRef<any>(null);
  const durationAnchorRef = useRef<any>(null);
  const [showDriverDropdown, setShowDriverDropdown] = useState(false);
  const [driverPortalRect, setDriverPortalRect] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const [showStatusDropdown, setShowStatusDropdown] = useState<boolean>(false);
  const [statusPortalRect, setStatusPortalRect] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const statusAnchorRef = useRef<any>(null);
  
  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteTargetInfo, setDeleteTargetInfo] = useState<{ date: string; time: string; street: string; category: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [busyText, setBusyText] = useState('');
  const [drivers, setDrivers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [errorModal, setErrorModal] = useState({
    visible: false,
    title: 'Error',
    message: '',
    type: 'error' as 'error' | 'warning' | 'info' | 'success',
  });

  const FREQUENCY_OPTIONS = useMemo(() => ['One-time', 'Daily', 'Weekly', 'Monthly' ], []);
  const getDurationOptions = (freq: string) => {
    const unit = freq.toLowerCase();
    const options = [];
    for (let i = 1; i <= 30; i++) {
      if (unit === 'daily') {
        options.push(`${i} ${i > 1 ? 'days' : 'day'}`);
      } else if (unit === 'weekly') {
        options.push(`${i} ${i > 1 ? 'weeks' : 'week'}`);
      } else if (unit === 'monthly') {
        options.push(`${i} ${i > 1 ? 'months' : 'month'}`);
      }
    }
    return options;
  };
  const WASTE_OPTIONS = useMemo(
    () => [
      { label: 'Biodegradable', color: '#22C55E' },
      { label: 'Non-Biodegradable', color: '#2563EB' },
      { label: 'Recyclable', color: '#EAB308' },
      { label: 'Residual', color: '#111827' },
      { label: 'Hazardous', color: '#EF4444' },
      { label: 'Special/Bulk', color: '#A855F7' },
    ],
    []
  );
  const TRUCK_OPTIONS = useMemo(() => ['Truck #1', 'Truck #2', 'Truck #3'], []);
  const DRIVER_OPTIONS = useMemo(() => drivers.map(driver => driver.name), [drivers]);

  // Category color mapping for calendar coloring
  const CATEGORY_COLORS: Record<string, string> = useMemo(() => ({
    'Biodegradable': '#22C55E',
    'Non-Biodegradable': '#2563EB',
    'Recyclable': '#EAB308',
    'Residual': '#6B7280',
    'Hazardous': '#EF4444',
    'Special/Bulk': '#A855F7',
  }), []);

  // Show error modal
  const showError = (message: string, title = 'Error', type: 'error' | 'warning' | 'info' | 'success' = 'error') => {
    setErrorModal({
      visible: true,
      title,
      message,
      type,
    });
  };

  // Close error modal
  const closeErrorModal = () => {
    setErrorModal(prev => ({ ...prev, visible: false }));
  };

  const closeAllDropdowns = () => {
    setShowTimeDropdown(false);
    setShowStreetDropdown(false);
    setShowFrequencyDropdown(false);
    setShowDurationDropdown(false);
    setShowWasteDropdown(false);
    setShowTruckDropdown(false);
    setShowDriverDropdown(false);
    setShowStatusDropdown(false);
  };

  const showDeleteConfirmation = (id: string, info: { date: string; time: string; street: string; category: string }) => {
    setDeleteTargetId(id);
    setDeleteTargetInfo(info);
    setShowDeleteModal(true);
  };

  const hideDeleteConfirmation = () => {
    setShowDeleteModal(false);
    setDeleteTargetId(null);
    setDeleteTargetInfo(null);
  };

  // Mock streets around Sambag 2, Cebu City for local suggestions
  const MOCK_STREETS = useMemo(
    () => [
      'J. Alcantara Street',
      'V. Rama Avenue',
      'B. Rodriguez Street',
      'Tres de Abril Street',
      'M. Velez Street',
      'Sambag 2 Barangay Hall Road',
    ],
    []
  );
  const openStreetDropdown = () => {
    setSuggestions(MOCK_STREETS.map((s) => ({ id: s, text: s })));
    // Ensure only one dropdown is open at a time
    setShowTimeDropdown(false);
    setShowStreetDropdown(true);
    if (Platform.OS === 'web' && streetAnchorRef.current && streetAnchorRef.current.getBoundingClientRect) {
      const rect = streetAnchorRef.current.getBoundingClientRect();
      setStreetPortalRect({ top: rect.bottom, left: rect.left, width: rect.width });
    }
  };
  const closeStreetDropdown = () => setShowStreetDropdown(false);

  const resetForm = () => {
    setSelectedId(null);
    setSelectedDate(null);
    setTimeText('');
    setSelectedStreet('');
    setFrequency('');
    setDuration('');
    setWasteCategory('');
    setTruck('');
    setDriver('');
    setStatus('');
    setNote('');
    setSuggestions([]);
    setShowStreetDropdown(false);
  };

  const handleAdd = async () => {
    const currentUser = auth?.currentUser;
    if (!currentUser) {
      showError('You must be logged in to add a schedule', 'Authentication Required', 'warning');
      return;
    }
    if (!selectedDate || !timeText) { 
      showError('Please select a future date and time', 'Validation Error', 'warning'); 
      return; 
    }
    if (!selectedStreet.trim()) { 
      showError('Please choose a street', 'Validation Error', 'warning'); 
      return; 
    }
    if (!frequency) { 
      showError('Please select frequency', 'Validation Error', 'warning'); 
      return; 
    }
    if (!wasteCategory) { 
      showError('Please choose waste category', 'Validation Error', 'warning'); 
      return; 
    }
    if (!truck) { 
      showError('Please select assigned truck', 'Validation Error', 'warning'); 
      return; 
    }
    if (!driver) { 
      showError('Please choose driver', 'Validation Error', 'warning'); 
      return; 
    }
    
    // Validate duration for recurring schedules
    if (['Daily', 'Weekly', 'Monthly'].includes(frequency) && !duration) {
      showError('Please select duration for recurring schedules', 'Validation Error', 'warning');
      return;
    }
    
    const when = combineDateTime(selectedDate, timeText);
    if (!isFutureDateTime(when)) {
      showError('Selected date/time must be in the future', 'Validation Error', 'warning');
      return;
    }
    
    try {
      setBusyText('Saving schedule...');
      setIsBusy(true);
      if (!db) {
        showError('Database not available. Cannot save schedule.', 'Database Error', 'error');
        return;
      }
      
      // For recurring schedules, create multiple instances based on duration
      if (['Daily', 'Weekly', 'Monthly'].includes(frequency) && duration) {
        const durationCount = parseInt(duration.split(' ')[0]);
        const schedules = [];
        
        for (let i = 0; i < durationCount; i++) {
          let scheduleDate = new Date(selectedDate);
          
          // Calculate the date for this instance based on frequency
          switch (frequency) {
            case 'Daily':
              scheduleDate.setDate(selectedDate.getDate() + i);
              break;
            case 'Weekly':
              scheduleDate.setDate(selectedDate.getDate() + (i * 7));
              break;
            case 'Monthly':
              scheduleDate.setMonth(selectedDate.getMonth() + i);
              break;
          }
          
          const payload = {
            id: `${Date.now()}_${i}`,
            userId: currentUser.uid,
            dateText: formatDate(scheduleDate),
            timeText,
            street: selectedStreet,
            frequency: 'One-time', // Each instance is a one-time schedule
            duration: `${durationCount} consecutive ${frequency.toLowerCase()}`, // Store original duration info
            wasteCategory,
            truck,
            driver,
            note,
            createdAt: serverTimestamp(),
          };
          
          schedules.push(payload);
        }
        
        // Add all schedules to Firestore
        for (const schedule of schedules) {
          await addDoc(collection(db, 'schedules'), schedule);
        }
        
        showError(`Schedule created successfully! ${durationCount} consecutive ${frequency.toLowerCase()} instances added.`, 'Success', 'success');
      } else {
        // For one-time schedules, create single instance
        const payload = {
          id: Date.now().toString(),
          userId: currentUser.uid,
          dateText: formatDate(selectedDate),
          timeText,
          street: selectedStreet,
          frequency,
          wasteCategory,
          truck,
          driver,
          note,
          createdAt: serverTimestamp(),
        };
        
        await addDoc(collection(db, 'schedules'), payload);
        showError('Schedule saved successfully!', 'Success', 'success');
      }
      
      resetForm();
    } catch (error) {
      console.error('Failed to add schedule:', error);
      showError('Failed to save schedule. Please try again.', 'Save Error', 'error');
    } finally {
      setIsBusy(false);
      setBusyText('');
    }
  };

  const handleSaveEdit = () => {
    if (!selectedId) return;
    if (!selectedDate || !timeText) { 
      showError('Please select a future date and time', 'Validation Error', 'warning'); 
      return; 
    }
    if (!selectedStreet.trim()) { 
      showError('Please choose a street', 'Validation Error', 'warning'); 
      return; 
    }
    if (!frequency) { 
      showError('Please select frequency', 'Validation Error', 'warning'); 
      return; 
    }
    if (!wasteCategory) { 
      showError('Please choose waste category', 'Validation Error', 'warning'); 
      return; 
    }
    if (!truck) { 
      showError('Please select assigned truck', 'Validation Error', 'warning'); 
      return; 
    }
    if (!driver) { 
      showError('Please choose driver', 'Validation Error', 'warning'); 
      return; 
    }
    
    // Validate duration for recurring schedules
    if (['Daily', 'Weekly', 'Monthly'].includes(frequency) && !duration) {
      showError('Please select duration for recurring schedules', 'Validation Error', 'warning');
      return;
    }
    
    // Skip future date validation for edit mode - allow editing existing schedules
    // const when = combineDateTime(selectedDate, timeText);
    // if (!isFutureDateTime(when)) {
    //   showError('Selected date/time must be in the future', 'Validation Error', 'warning');
    //   return;
    // }
    
    const payload: any = {
      dateText: formatDate(selectedDate),
      timeText,
      street: selectedStreet,
      frequency,
      duration,
      wasteCategory,
      truck,
      driver,
      status,
      note,
    };
    (async () => {
      try {
        setBusyText('Updating schedule...');
        setIsBusy(true);
        if (!db) {
          showError('Database not available. Cannot update schedule.', 'Database Error', 'error');
          return;
        } else {
          await updateDoc(doc(db, 'schedules', selectedId), payload);
          showError('Schedule updated successfully!', 'Success', 'success');
        }
        resetForm();
        setScheduleMode('add');
      } catch (e) {
        console.error('Update failed', e);
        showError('Failed to update schedule. Please try again.', 'Update Error', 'error');
      } finally {
        setIsBusy(false);
        setBusyText('');
      }
    })();
  };

  const handleDelete = async (id?: string) => {
    const targetId = id || selectedId;
    if (!targetId) return;
    try {
      setBusyText('Deleting schedule...');
      setIsBusy(true);
      if (!db) {
        showError('Database not available. Cannot delete schedule.', 'Database Error', 'error');
        return;
      }
      // Debug: log current user UID and schedule userId
      const currentUserUid = auth?.currentUser?.uid;
      const scheduleDocRef = doc(db, 'schedules', targetId);
      const { getDoc } = await import('firebase/firestore');
      const scheduleSnap = await getDoc(scheduleDocRef);
      const scheduleData = scheduleSnap.exists() ? scheduleSnap.data() : null;
      console.log('Attempting delete:', {
        currentUserUid,
        targetId,
        scheduleUserId: scheduleData?.userId,
        isAdmin: auth?.currentUser?.admin,
      });
      await deleteDoc(scheduleDocRef);
      showError('Schedule deleted successfully!', 'Success', 'success');
      resetForm();
      setScheduleMode('add');
      hideDeleteConfirmation();
    } catch (e: any) {
      console.error('Delete failed', e);
      showError('Failed to delete schedule. Please try again.', 'Delete Error', 'error');
    } finally {
      setIsBusy(false);
      setBusyText('');
    }
  };

  const confirmDelete = () => {
    if (deleteTargetId) {
      handleDelete(deleteTargetId);
    }
  };

  // Helpers
  const formatMonthYear = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const startOfWeekIndex = (d: Date) => {
    const day = new Date(d.getFullYear(), d.getMonth(), 1).getDay(); // 0 Su - 6 Sa
    return day === 0 ? 6 : day - 1; // convert to Mon=0
  };
  const daysInMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const buildMonthDays = (d: Date): Array<Date | null> => {
    const leading = startOfWeekIndex(d);
    const total = daysInMonth(d);
    const cells: Array<Date | null> = [];
    for (let i = 0; i < leading; i++) cells.push(null);
    for (let i = 1; i <= total; i++) cells.push(new Date(d.getFullYear(), d.getMonth(), i));
    return cells;
  };
  const isSameDate = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const isPastDate = (d: Date) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const cmp = new Date(d);
    cmp.setHours(0,0,0,0);
    return cmp < today;
  };
  const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const combineDateTime = (d: Date, t: string) => {
    const [hStr, mStr] = t.split(':');
    const result = new Date(d);
    result.setHours(parseInt(hStr, 10), parseInt(mStr, 10), 0, 0);
    return result;
  };
  const isFutureDateTime = (dt: Date) => dt.getTime() > Date.now();
  const generateTimeSlots = (date: Date | null) => {
    const slots: string[] = [];
    const now = new Date();
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const hh = h.toString().padStart(2, '0');
        const mm = m.toString().padStart(2, '0');
        const label = `${hh}:${mm}`;
        if (!date) { slots.push(label); continue; }
        const dt = combineDateTime(date, label);
        if (dt.getTime() > now.getTime()) slots.push(label);
      }
    }
    return slots;
  };

  // Firestore schedules state
  type RawSchedule = {
    id: string; // custom id field
    userId: string;
    dateText: string;
    timeText: string;
    street: string;
    frequency: string;
    duration?: string;
    wasteCategory: string;
    truck: string;
    driver: string;
    status?: string;
    note?: string;
    docId: string; // Firestore document ID
  };

  const [rawSchedules, setRawSchedules] = useState<RawSchedule[]>([]);
  const [monthScheduleDates, setMonthScheduleDates] = useState<Record<string, RawSchedule[]>>({});

  // Subscribe to schedules
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, 'schedules'), (snap) => {
      const rows: RawSchedule[] = [];
      snap.forEach((docSnap) => {
        const d: any = docSnap.data();
        rows.push({ ...d, docId: docSnap.id });
      });
      setRawSchedules(rows);
    });
    return () => unsub();
  }, [db]);

  // Fetch drivers from users collection
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'driver')),
      (snap) => {
        const driverList: Array<{ id: string; name: string; email: string }> = [];
        snap.forEach((doc) => {
          const data = doc.data();
          driverList.push({
            id: doc.id,
            name: data.displayName || data.email || 'Unknown Driver',
            email: data.email || ''
          });
        });
        setDrivers(driverList);
      },
      (error) => {
        console.error('Error fetching drivers:', error);
        showError('Failed to load drivers. Please refresh the page.', 'Loading Error', 'error');
      }
    );
    return () => unsub();
  }, [db]);

  // Recompute expanded month occurrences when currentMonth or rawSchedules change
  useEffect(() => {
    const mapping: Record<string, RawSchedule[]> = {};
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysIn = (new Date(year, month + 1, 0)).getDate();

    const push = (d: Date, sched: RawSchedule) => {
      const key = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
      if (!mapping[key]) mapping[key] = [];
      mapping[key].push(sched);
    };

    for (const s of rawSchedules) {
      const [monthStr, dayStr, yearStr] = new Date(s.dateText).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).split('/');
      const base = new Date(parseInt(yearStr,10), parseInt(monthStr,10)-1, parseInt(dayStr,10));

      const isOwner = auth?.currentUser?.uid && s.userId === auth.currentUser.uid;

      switch ((s.frequency || 'One-time').toLowerCase()) {
        case 'daily': {
          if (isOwner) {
            for (let d = 1; d <= daysIn; d++) push(new Date(year, month, d), s);
          } else {
            if (base.getFullYear() === year && base.getMonth() === month) push(base, s);
          }
          break;
        }
        case 'weekly': {
          if (isOwner) {
            const targetDow = base.getDay();
            for (let d = 1; d <= daysIn; d++) {
              const date = new Date(year, month, d);
              if (date.getDay() === targetDow) push(date, s);
            }
          } else {
            if (base.getFullYear() === year && base.getMonth() === month) push(base, s);
          }
          break;
        }
        case 'monthly': {
          const targetDom = base.getDate();
          const date = new Date(year, month, Math.min(targetDom, daysIn));
          push(date, s);
          break;
        }
        default: { // one-time
          if (base.getFullYear() === year && base.getMonth() === month) push(base, s);
        }
      }
    }
    setMonthScheduleDates(mapping);
  }, [currentMonth, rawSchedules]);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.mainSection}>
        <Text style={styles.title}>Schedule Management</Text>
        
        {/* Top row: badges left, actions right */}
        <View style={styles.topRow}>
          <View style={styles.badgesContainer}>
            <View style={[styles.badge, { backgroundColor: '#2563EB' }]}>
              <Text style={styles.badgeText}>Non-biodegradable</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: '#EAB308' }]}>
              <Text style={styles.badgeText}>Recyclable</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: '#22C55E' }]}>
              <Text style={styles.badgeText}>Biodegradable</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: '#FF0000' }]}>
              <Text style={styles.badgeText}>Hazardous</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: '#A855F7' }]}>
              <Text style={styles.badgeText}>Special / Bulk Collection</Text>
            </View>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.compactButton, styles.addButton]}
              onPress={() => setScheduleMode('add')}
              activeOpacity={0.8}
            >
              <MaterialIcons name="add" size={18} color="#234033" style={styles.buttonIcon} />
              <Text style={[styles.compactButtonText, { color: '#234033' }]}>Add Schedule</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.compactButton, styles.editButton]}
              onPress={() => setScheduleMode('edit')}
              activeOpacity={0.8}
            >
              <MaterialIcons name="edit" size={16} color="#234033" style={styles.buttonIcon} />
              <Text style={[styles.compactButtonText, { color: '#234033' }]}>Edit Schedule</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Two Column Layout */}
        <View style={styles.columnsContainer}>
          {/* Left Column - Calendar */}
          <View style={styles.leftColumn}>
            <View style={styles.calendarCard}>
              <View style={styles.calendarHeader}>
                <TouchableOpacity style={styles.calendarButton} onPress={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>
                  <MaterialIcons name="chevron-left" size={20} color="#333" />
                </TouchableOpacity>
                <Text style={styles.calendarTitle}>{formatMonthYear(currentMonth)}</Text>
                <TouchableOpacity style={styles.calendarButton} onPress={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>
                  <MaterialIcons name="chevron-right" size={20} color="#333" />
                </TouchableOpacity>
              </View>
              <View style={styles.calendarGrid}>
                {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day) => (
                  <Text key={day} style={styles.dayHeader}>{day}</Text>
                ))}
                {buildMonthDays(currentMonth).map((cell, idx) => {
                  if (!cell) return <View key={`e-${idx}`} style={styles.calendarEmpty} />;
                  const isToday = isSameDate(cell, new Date());
                  const isPast = isPastDate(cell);
                  const isSelected = selectedDate && isSameDate(cell, selectedDate);
                  const key = `${cell.getFullYear()}-${(cell.getMonth()+1).toString().padStart(2,'0')}-${cell.getDate().toString().padStart(2,'0')}`;
                  const items = monthScheduleDates[key] || [];
                  const color = items.length > 0 ? (CATEGORY_COLORS[items[0].wasteCategory] || '#2563EB') : null;
                  return (
                    <TouchableOpacity
                      key={cell.toISOString()}
                      disabled={isPast}
                      onPress={() => setSelectedDate(cell)}
                      style={[
                        styles.calendarDate,
                        color ? { backgroundColor: color } : null,
                        isSelected && { borderWidth: 2, borderColor: '#1E40AF' },
                        isToday && !isSelected && { borderWidth: 1, borderColor: '#2563EB' },
                        isPast && { opacity: 0.35 }
                      ]}
                    >
                      <Text style={[styles.dateText, (color || isSelected) ? styles.highlightedDateText : null]}>{cell.getDate()}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Right Column - Schedule Form */}
          <View style={[styles.rightColumn, (showTimeDropdown || showStreetDropdown) ? styles.raiseLayer : null]}>
            <View style={[styles.formCard, (showTimeDropdown || showStreetDropdown) ? styles.raiseLayer : null]}>
              <Text style={styles.formTitle}>
                {scheduleMode === 'add' ? 'Add Schedule' : 'Edit Schedule'}
              </Text>
              
              <View style={styles.formRow}>
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>Set date<Text style={{ color: '#EF4444' }}> *</Text></Text>
                  <TouchableOpacity style={styles.inputField}>
                    <Text style={styles.inputText}>{selectedDate ? formatDate(selectedDate) : 'Set date'}</Text>
                    <MaterialIcons name="event" size={18} color="#4B5F4F" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>Set time<Text style={{ color: '#EF4444' }}> *</Text></Text>
                  <View style={[styles.dropdownContainer, showTimeDropdown ? styles.dropdownContainerOpen : null]} ref={timeAnchorRef}>
                    <TouchableOpacity style={styles.inputField} onPress={() => { setShowStreetDropdown(false); const next = !showTimeDropdown; setShowTimeDropdown(next); if (Platform.OS === 'web' && next && timeAnchorRef.current && timeAnchorRef.current.getBoundingClientRect) { const rect = timeAnchorRef.current.getBoundingClientRect(); setTimePortalRect({ top: rect.bottom, left: rect.left, width: rect.width }); } }}>
                      <Text style={styles.inputText}>{timeText || 'Set time'}</Text>
                      <MaterialIcons name={showTimeDropdown ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={18} color="#4B5F4F" />
                    </TouchableOpacity>
                    {showTimeDropdown && (
                      Platform.OS === 'web'
                        ? createPortal(
                            <View style={[styles.suggestionPanelPortal, { top: timePortalRect.top, left: timePortalRect.left, width: timePortalRect.width, pointerEvents: 'auto' }]}>
                              <ScrollView style={styles.suggestionScroll} nestedScrollEnabled>
                                {generateTimeSlots(selectedDate).map((t) => (
                                  <TouchableOpacity key={t} style={styles.suggestionItem} onPress={() => { setTimeText(t); setShowTimeDropdown(false); }}>
                                    <MaterialIcons name="access-time" size={16} color="#4B5F4F" />
                                    <Text style={styles.suggestionText}>{t}</Text>
                                  </TouchableOpacity>
                                ))}
                              </ScrollView>
                            </View>,
                            document.body
                          )
                        : (
                      <View style={[styles.suggestionPanel, { pointerEvents: 'auto' }]}>
                        <ScrollView style={styles.suggestionScroll} nestedScrollEnabled>
                          {generateTimeSlots(selectedDate).map((t) => (
                            <TouchableOpacity key={t} style={styles.suggestionItem} onPress={() => { setTimeText(t); setShowTimeDropdown(false); }}>
                              <MaterialIcons name="access-time" size={16} color="#4B5F4F" />
                              <Text style={styles.suggestionText}>{t}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                          )
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Barangay Street<Text style={{ color: '#EF4444' }}> *</Text></Text>
                <View style={[
                  styles.dropdownContainer,
                  showStreetDropdown ? styles.dropdownContainerOpen : null
                ]} ref={streetAnchorRef}>
                  <TouchableOpacity style={styles.inputField} onPress={showStreetDropdown ? closeStreetDropdown : openStreetDropdown}>
                    <Text style={styles.inputText}>{selectedStreet || 'Choose street'}</Text>
                    <MaterialIcons name={showStreetDropdown ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={18} color="#4B5F4F" />
                  </TouchableOpacity>
                  {showStreetDropdown && (
                    Platform.OS === 'web'
                      ? createPortal(
                          <View style={[styles.suggestionPanelPortal, { top: streetPortalRect.top, left: streetPortalRect.left, width: streetPortalRect.width, pointerEvents: 'auto' }]}>
                            <ScrollView style={styles.suggestionScroll} nestedScrollEnabled>
                              {suggestions.map((s) => (
                                <TouchableOpacity
                                  key={s.id}
                                  style={styles.suggestionItem}
                                  onPress={() => {
                                    setSelectedStreet(s.text);
                                    setSuggestions([]);
                                    setShowStreetDropdown(false);
                                  }}
                                >
                                  <MaterialIcons name="location-on" size={16} color="#4B5F4F" />
                                  <Text style={styles.suggestionText}>{s.text}</Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          </View>,
                          document.body
                        )
                      : (
                    <View style={[styles.suggestionPanel, { pointerEvents: 'auto' }]}>
                      <ScrollView style={styles.suggestionScroll} nestedScrollEnabled>
                        {suggestions.map((s) => (
                          <TouchableOpacity
                            key={s.id}
                            style={styles.suggestionItem}
                            onPress={() => {
                              setSelectedStreet(s.text);
                              setSuggestions([]);
                              setShowStreetDropdown(false);
                            }}
                          >
                            <MaterialIcons name="location-on" size={16} color="#4B5F4F" />
                            <Text style={styles.suggestionText}>{s.text}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                        )
                  )}
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>Frequency<Text style={{ color: '#EF4444' }}> *</Text></Text>
                  <View style={[styles.dropdownContainer, showFrequencyDropdown ? styles.dropdownContainerOpen : null]} ref={freqAnchorRef}>
                    <TouchableOpacity
                      style={styles.inputField}
                      onPress={() => {
                        const next = !showFrequencyDropdown;
                        closeAllDropdowns();
                        setShowFrequencyDropdown(next);
                        if (Platform.OS === 'web' && next && freqAnchorRef.current?.getBoundingClientRect) {
                          const rect = freqAnchorRef.current.getBoundingClientRect();
                          setFreqPortalRect({ top: rect.bottom, left: rect.left, width: rect.width });
                        }
                      }}
                    >
                      <Text style={styles.inputText}>{frequency || 'Frequency'}</Text>
                      <MaterialIcons name={showFrequencyDropdown ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={18} color="#4B5F4F" />
                    </TouchableOpacity>
                    {showFrequencyDropdown && (
                      Platform.OS === 'web'
                        ? createPortal(
                            <View style={[styles.suggestionPanelPortal, { top: freqPortalRect.top, left: freqPortalRect.left, width: freqPortalRect.width, pointerEvents: 'auto' }]}>
                              <ScrollView style={styles.suggestionScroll} nestedScrollEnabled>
                                {FREQUENCY_OPTIONS.map((opt) => (
                                  <TouchableOpacity key={opt} style={styles.suggestionItem} onPress={() => { setFrequency(opt); setShowFrequencyDropdown(false); }}>
                                    <Text style={styles.suggestionText}>{opt}</Text>
                                  </TouchableOpacity>
                                ))}
                              </ScrollView>
                            </View>,
                            document.body
                          )
                        : (
                            <View style={[styles.suggestionPanel, { pointerEvents: 'auto' }]}>
                              <ScrollView style={styles.suggestionScroll} nestedScrollEnabled>
                                {FREQUENCY_OPTIONS.map((opt) => (
                                  <TouchableOpacity key={opt} style={styles.suggestionItem} onPress={() => { setFrequency(opt); setShowFrequencyDropdown(false); }}>
                                    <Text style={styles.suggestionText}>{opt}</Text>
                  </TouchableOpacity>
                                ))}
                              </ScrollView>
                            </View>
                          )
                    )}
                  </View>
                </View>
                
                {/* Duration dropdown - only show for recurring schedules */}
                {['Daily', 'Weekly', 'Monthly'].includes(frequency) && (
                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>Duration (consecutive {frequency.toLowerCase()})<Text style={{ color: '#EF4444' }}> *</Text></Text>
                    <View style={[styles.dropdownContainer, showDurationDropdown ? styles.dropdownContainerOpen : null]} ref={durationAnchorRef}>
                      <TouchableOpacity
                        style={styles.inputField}
                        onPress={() => {
                          const next = !showDurationDropdown;
                          closeAllDropdowns();
                          setShowDurationDropdown(next);
                          if (Platform.OS === 'web' && next && durationAnchorRef.current?.getBoundingClientRect) {
                            const rect = durationAnchorRef.current.getBoundingClientRect();
                            setDurationPortalRect({ top: rect.bottom, left: rect.left, width: rect.width });
                          }
                        }}
                      >
                        <Text style={styles.inputText}>{duration || 'Select duration'}</Text>
                        <MaterialIcons name={showDurationDropdown ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={18} color="#4B5F4F" />
                      </TouchableOpacity>
                      {showDurationDropdown && (
                        Platform.OS === 'web'
                          ? createPortal(
                              <View style={[styles.suggestionPanelPortal, { top: durationPortalRect.top, left: durationPortalRect.left, width: durationPortalRect.width, pointerEvents: 'auto' }]}>
                                <ScrollView style={styles.suggestionScroll} nestedScrollEnabled>
                                  {getDurationOptions(frequency).map((opt) => (
                                    <TouchableOpacity key={opt} style={styles.suggestionItem} onPress={() => { setDuration(opt); setShowDurationDropdown(false); }}>
                                      <Text style={styles.suggestionText}>{opt}</Text>
                                    </TouchableOpacity>
                                  ))}
                                </ScrollView>
                              </View>,
                              document.body
                            )
                          : (
                              <View style={[styles.suggestionPanel, { pointerEvents: 'auto' }]}>
                                <ScrollView style={styles.suggestionScroll} nestedScrollEnabled>
                                  {getDurationOptions(frequency).map((opt) => (
                                    <TouchableOpacity key={opt} style={styles.suggestionItem} onPress={() => { setDuration(opt); setShowDurationDropdown(false); }}>
                                      <Text style={styles.suggestionText}>{opt}</Text>
                                    </TouchableOpacity>
                                  ))}
                                </ScrollView>
                              </View>
                            )
                      )}
                    </View>
                  </View>
                )}
                
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>Waste Category<Text style={{ color: '#EF4444' }}> *</Text></Text>
                  <View style={[styles.dropdownContainer, showWasteDropdown ? styles.dropdownContainerOpen : null]} ref={wasteAnchorRef}>
                    <TouchableOpacity
                      style={styles.inputField}
                      onPress={() => {
                        const next = !showWasteDropdown;
                        closeAllDropdowns();
                        setShowWasteDropdown(next);
                        if (Platform.OS === 'web' && next && wasteAnchorRef.current?.getBoundingClientRect) {
                          const rect = wasteAnchorRef.current.getBoundingClientRect();
                          setWastePortalRect({ top: rect.bottom, left: rect.left, width: rect.width });
                        }
                      }}
                    >
                      <Text style={styles.inputText}>{wasteCategory || 'Waste Category'}</Text>
                      <MaterialIcons name={showWasteDropdown ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={18} color="#4B5F4F" />
                    </TouchableOpacity>
                    {showWasteDropdown && (
                      Platform.OS === 'web'
                        ? createPortal(
                            <View style={[styles.suggestionPanelPortal, { top: wastePortalRect.top, left: wastePortalRect.left, width: wastePortalRect.width, pointerEvents: 'auto' }]}>
                              <ScrollView style={styles.suggestionScroll} nestedScrollEnabled>
                                {WASTE_OPTIONS.map((opt) => (
                                  <TouchableOpacity key={opt.label} style={styles.suggestionItem} onPress={() => { setWasteCategory(opt.label); setShowWasteDropdown(false); }}>
                                    <View style={[styles.colorDot, { backgroundColor: opt.color }]} />
                                    <Text style={styles.suggestionText}>{opt.label}</Text>
                                  </TouchableOpacity>
                                ))}
                              </ScrollView>
                            </View>,
                            document.body
                          )
                        : (
                            <View style={[styles.suggestionPanel, { pointerEvents: 'auto' }]}>
                              <ScrollView style={styles.suggestionScroll} nestedScrollEnabled>
                                {WASTE_OPTIONS.map((opt) => (
                                  <TouchableOpacity key={opt.label} style={styles.suggestionItem} onPress={() => { setWasteCategory(opt.label); setShowWasteDropdown(false); }}>
                                    <View style={[styles.colorDot, { backgroundColor: opt.color }]} />
                                    <Text style={styles.suggestionText}>{opt.label}</Text>
                  </TouchableOpacity>
                                ))}
                              </ScrollView>
                            </View>
                          )
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>Assigned Truck<Text style={{ color: '#EF4444' }}> *</Text></Text>
                  <View style={[styles.dropdownContainer, showTruckDropdown ? styles.dropdownContainerOpen : null]} ref={truckAnchorRef}>
                    <TouchableOpacity
                      style={styles.inputField}
                      onPress={() => {
                        const next = !showTruckDropdown;
                        closeAllDropdowns();
                        setShowTruckDropdown(next);
                        if (Platform.OS === 'web' && next && truckAnchorRef.current?.getBoundingClientRect) {
                          const rect = truckAnchorRef.current.getBoundingClientRect();
                          setTruckPortalRect({ top: rect.bottom, left: rect.left, width: rect.width });
                        }
                      }}
                    >
                      <Text style={styles.inputText}>{truck || 'Assigned Truck'}</Text>
                      <MaterialIcons name={showTruckDropdown ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={18} color="#4B5F4F" />
                    </TouchableOpacity>
                    {showTruckDropdown && (
                      Platform.OS === 'web'
                        ? createPortal(
                            <View style={[styles.suggestionPanelPortal, { top: truckPortalRect.top, left: truckPortalRect.left, width: truckPortalRect.width, pointerEvents: 'auto' }]}>
                              <ScrollView style={styles.suggestionScroll} nestedScrollEnabled>
                                {TRUCK_OPTIONS.map((opt) => (
                                  <TouchableOpacity key={opt} style={styles.suggestionItem} onPress={() => { setTruck(opt); setShowTruckDropdown(false); }}>
                                    <Text style={styles.suggestionText}>{opt}</Text>
                                  </TouchableOpacity>
                                ))}
                              </ScrollView>
                            </View>,
                            document.body
                          )
                        : (
                            <View style={[styles.suggestionPanel, { pointerEvents: 'auto' }]}>
                              <ScrollView style={styles.suggestionScroll} nestedScrollEnabled>
                                {TRUCK_OPTIONS.map((opt) => (
                                  <TouchableOpacity key={opt} style={styles.suggestionItem} onPress={() => { setTruck(opt); setShowTruckDropdown(false); }}>
                                    <Text style={styles.suggestionText}>{opt}</Text>
                  </TouchableOpacity>
                                ))}
                              </ScrollView>
                            </View>
                          )
                    )}
                  </View>
                </View>
                
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>Choose Driver<Text style={{ color: '#EF4444' }}> *</Text></Text>
                  <View style={[styles.dropdownContainer, showDriverDropdown ? styles.dropdownContainerOpen : null]} ref={driverAnchorRef}>
                    <TouchableOpacity
                      style={[styles.inputField, drivers.length === 0 && styles.disabledField]}
                      onPress={() => {
                        if (drivers.length === 0) return;
                        const next = !showDriverDropdown;
                        closeAllDropdowns();
                        setShowDriverDropdown(next);
                        if (Platform.OS === 'web' && next && driverAnchorRef.current?.getBoundingClientRect) {
                          const rect = driverAnchorRef.current.getBoundingClientRect();
                          setDriverPortalRect({ top: rect.bottom, left: rect.left, width: rect.width });
                        }
                      }}
                    >
                      <Text style={styles.inputText}>{driver || (drivers.length === 0 ? 'Loading drivers...' : 'Choose Driver')}</Text>
                      <MaterialIcons name={showDriverDropdown ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={18} color="#4B5F4F" />
                    </TouchableOpacity>
                    {showDriverDropdown && (
                      Platform.OS === 'web'
                        ? createPortal(
                            <View style={[styles.suggestionPanelPortal, { top: driverPortalRect.top, left: driverPortalRect.left, width: driverPortalRect.width, pointerEvents: 'auto' }]}>
                              <ScrollView style={styles.suggestionScroll} nestedScrollEnabled>
                                {drivers.map((driver) => (
                                  <TouchableOpacity key={driver.id} style={styles.suggestionItem} onPress={() => { setDriver(driver.name); setShowDriverDropdown(false); }}>
                                    <MaterialIcons name="person" size={16} color="#4B5F4F" />
                                    <Text style={styles.suggestionText}>{driver.name}</Text>
                                  </TouchableOpacity>
                                ))}
                              </ScrollView>
                            </View>,
                            document.body
                          )
                        : (
                            <View style={[styles.suggestionPanel, { pointerEvents: 'auto' }]}>
                              <ScrollView style={styles.suggestionScroll} nestedScrollEnabled>
                                {drivers.map((driver) => (
                                  <TouchableOpacity key={driver.id} style={styles.suggestionItem} onPress={() => { setDriver(driver.name); setShowDriverDropdown(false); }}>
                                    <MaterialIcons name="person" size={16} color="#4B5F4F" />
                                    <Text style={styles.suggestionText}>{driver.name}</Text>
                                  </TouchableOpacity>
                                ))}
                              </ScrollView>
                            </View>
                          )
                    )}
                  </View>
                </View>
              </View>

              {scheduleMode === 'edit' && (
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>Status</Text>
                  <View style={[styles.dropdownContainer, showStatusDropdown ? styles.dropdownContainerOpen : null]} ref={statusAnchorRef}>
                    <TouchableOpacity
                      style={styles.inputField}
                      onPress={() => {
                        const next = !showStatusDropdown;
                        closeAllDropdowns();
                        setShowStatusDropdown(next);
                        if (Platform.OS === 'web' && next && statusAnchorRef.current?.getBoundingClientRect) {
                          const rect = statusAnchorRef.current.getBoundingClientRect();
                          setStatusPortalRect({ top: rect.bottom, left: rect.left, width: rect.width });
                        }
                      }}
                    >
                      <Text style={styles.inputText}>{status || 'Select Status'}</Text>
                      <MaterialIcons name={showStatusDropdown ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={18} color="#4B5F4F" />
                    </TouchableOpacity>
                    {showStatusDropdown && (
                      Platform.OS === 'web'
                        ? createPortal(
                            <View style={[styles.suggestionPanelPortal, { top: statusPortalRect.top, left: statusPortalRect.left, width: statusPortalRect.width, pointerEvents: 'auto' }]}>
                              <ScrollView style={styles.suggestionScroll} nestedScrollEnabled>
                                {['Pending', 'In Progress', 'Completed', 'Cancelled'].map((opt) => (
                                  <TouchableOpacity key={opt} style={styles.suggestionItem} onPress={() => { setStatus(opt); setShowStatusDropdown(false); }}>
                                    <Text style={styles.suggestionText}>{opt}</Text>
                                  </TouchableOpacity>
                                ))}
                              </ScrollView>
                            </View>,
                            document.body
                          )
                        : (
                            <View style={[styles.suggestionPanel, { pointerEvents: 'auto' }]}>
                              <ScrollView style={styles.suggestionScroll} nestedScrollEnabled>
                                {['Pending', 'In Progress', 'Completed', 'Cancelled'].map((opt) => (
                                  <TouchableOpacity key={opt} style={styles.suggestionItem} onPress={() => { setStatus(opt); setShowStatusDropdown(false); }}>
                                    <Text style={styles.suggestionText}>{opt}</Text>
                                  </TouchableOpacity>
                                ))}
                              </ScrollView>
                            </View>
                          )
                    )}
                  </View>
                </View>
              )}

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Note</Text>
                <View style={styles.textArea}>
                  <TextInput
                    style={styles.textInputField}
                    placeholder="Add special instructions"
                    placeholderTextColor="#7C8E80"
                    value={note}
                    onChangeText={setNote}
                    multiline={true}
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              </View>

              {/* Day Schedules List */}
              {selectedDate && (
                <View style={styles.dayList}>
                  <Text style={styles.dayListTitle}>Schedules on {formatDate(selectedDate)}</Text>
                  {(monthScheduleDates[`${selectedDate.getFullYear()}-${(selectedDate.getMonth()+1).toString().padStart(2,'0')}-${selectedDate.getDate().toString().padStart(2,'0')}`] || []).map((s) => (
                    <View key={s.docId} style={styles.dayItem}>
                      <View style={[styles.dayColor, { backgroundColor: CATEGORY_COLORS[s.wasteCategory] || '#94A3B8' }]} />
                      <Text style={styles.dayItemText}>{s.timeText} • {s.wasteCategory} • {s.street}</Text>
                      {auth?.currentUser?.uid === s.userId && (
                        <View style={styles.dayItemActions}>
                          <TouchableOpacity
                            style={styles.smallBtn}
                            onPress={() => {
                              setScheduleMode('edit');
                              setSelectedId(s.docId);
                              // Parse the date properly from dateText
                              const dateParts = s.dateText.split(' ');
                              const monthName = dateParts[0];
                              const day = parseInt(dateParts[1].replace(',', ''));
                              const year = parseInt(dateParts[2]);
                              
                              // Convert month name to number
                              const monthMap: { [key: string]: number } = {
                                'January': 0, 'February': 1, 'March': 2, 'April': 3,
                                'May': 4, 'June': 5, 'July': 6, 'August': 7,
                                'September': 8, 'October': 9, 'November': 10, 'December': 11
                              };
                              const month = monthMap[monthName] || 0;
                              
                              setSelectedDate(new Date(year, month, day));
                              setTimeText(s.timeText);
                              setSelectedStreet(s.street);
                              setFrequency(s.frequency);
                              setDuration(s.duration || '');
                              setWasteCategory(s.wasteCategory);
                              setTruck(s.truck);
                              setDriver(s.driver);
                              setStatus(s.status || 'Pending');
                              setNote(s.note || '');
                            }}
                          >
                            <Text style={styles.smallBtnText}>Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.smallBtn, { backgroundColor: '#EF4444' }]}
                            onPress={() => {
                              showDeleteConfirmation(s.docId, {
                                date: s.dateText,
                                time: s.timeText,
                                street: s.street,
                                category: s.wasteCategory
                              });
                            }}
                          >
                            <Text style={styles.smallBtnText}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.formButtons}>
                {scheduleMode === 'add' ? (
                  <TouchableOpacity style={styles.primaryCta} onPress={handleAdd}>
                    <Text style={styles.primaryCtaText}>Add</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity style={[styles.secondaryCta, { backgroundColor: '#2563EB' }]} onPress={handleSaveEdit}>
                      <Text style={styles.formButtonText}>Save Changes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.secondaryCta, { backgroundColor: '#EF4444' }]} 
                      onPress={() => {
                        if (selectedId) {
                          const schedule = rawSchedules.find(s => s.docId === selectedId);
                          if (schedule) {
                            showDeleteConfirmation(selectedId, {
                              date: schedule.dateText,
                              time: schedule.timeText,
                              street: schedule.street,
                              category: schedule.wasteCategory
                            });
                          }
                        }
                      }}
                    >
                      <Text style={styles.formButtonText}>Delete</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.secondaryCta, { backgroundColor: '#EF4444' }]} onPress={resetForm}>
                      <Text style={styles.formButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={hideDeleteConfirmation}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <MaterialIcons name="warning" size={24} color="#EF4444" />
              <Text style={styles.modalTitle}>Confirm Delete</Text>
            </View>
            
            <View style={styles.modalContent}>
              <Text style={styles.modalMessage}>
                Are you sure you want to delete this schedule?
              </Text>
              
              {deleteTargetInfo && (
                <View style={styles.scheduleInfo}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Date:</Text>
                    <Text style={styles.infoValue}>{deleteTargetInfo.date}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Time:</Text>
                    <Text style={styles.infoValue}>{deleteTargetInfo.time}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Street:</Text>
                    <Text style={styles.infoValue}>{deleteTargetInfo.street}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Category:</Text>
                    <Text style={styles.infoValue}>{deleteTargetInfo.category}</Text>
                  </View>
                </View>
              )}
              
              <Text style={styles.warningText}>
                This action cannot be undone.
              </Text>
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={hideDeleteConfirmation}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.deleteButton]}
                onPress={confirmDelete}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {isBusy && (
        <View style={styles.busyOverlay} pointerEvents="auto">
          <View style={styles.busyBox}>
            <MaterialIcons name="sync" size={20} color="#234033" />
            <Text style={styles.busyText}>{busyText || 'Working...'}</Text>
          </View>
        </View>
      )}

      {/* Error Modal */}
      <ErrorModal
        visible={errorModal.visible}
        title={errorModal.title}
        message={errorModal.message}
        type={errorModal.type}
        onClose={closeErrorModal}
        autoClose={true}
        autoCloseDelay={4000}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainSection: {
    backgroundColor: '#ECF8ED',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginBottom: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  badge: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginVertical: 6,
    marginRight: 12,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 16,
  },
  compactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C8D8CA',
    backgroundColor: '#DDEEDB',
    marginLeft: 12,
  },
  addButton: {
    backgroundColor: '#DDEEDB',
  },
  editButton: {
    backgroundColor: '#DDEEDB',
  },
  compactButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  buttonIcon: {
    marginRight: 8,
  },
  columnsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    overflow: 'visible',
  },
  leftColumn: {
    flex: 1,
    marginRight: 8,
  },
  rightColumn: {
    flex: 1,
    marginLeft: 8,
    overflow: 'visible',
  },
  calendarCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  calendarButton: {
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 18,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  calendarEmpty: {
    width: '14%',
    aspectRatio: 1,
    marginVertical: 2,
  },
  dayHeader: {
    fontSize: 10,
    color: '#6B7280',
    width: '14%',
    textAlign: 'center',
    marginBottom: 4,
  },
  calendarDate: {
    width: '14%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginVertical: 2,
    position: 'relative',
  },
  dateText: {
    fontSize: 12,
    color: '#1F2937',
  },
  highlightedDateText: {
    fontWeight: 'bold',
    color: 'white',
  },
  formCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'visible',
  },
  raiseLayer: {
    position: 'relative',
    zIndex: 100000,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  formField: {
    flex: 1,
    marginHorizontal: 4,
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
    fontWeight: '600',
  },
  inputField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    minHeight: 48,
  },
  inputText: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    marginLeft: 8,
    fontWeight: '500',
  },
  disabledField: {
    opacity: 0.6,
    backgroundColor: '#f5f5f5',
  },
  textInputField: {
    flex: 1,
    fontSize: 12,
    color: '#234033',
    paddingVertical: 0,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  textArea: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 16,
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  suggestionPanel: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#C8D8CA',
    borderRadius: 8,
    marginTop: 6,
    overflow: 'hidden',
    zIndex: 100000,
    elevation: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  suggestionPanelPortal: {
    position: 'fixed',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#C8D8CA',
    borderRadius: 8,
    marginTop: 6,
    overflow: 'hidden',
    zIndex: 2147483647,
    boxShadow: '0 6px 12px rgba(0,0,0,0.15)',
  } as any,
  suggestionScroll: {
    maxHeight: 140,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF3EE',
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  suggestionText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#234033',
    flex: 1,
  },
  dropdownContainer: {
    position: 'relative',
    zIndex: 10,
  },
  dropdownContainerOpen: {
    zIndex: 100001,
    elevation: 10000,
  },
  textAreaPlaceholder: {
    fontSize: 12,
    color: '#7C8E80',
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
    gap: 12,
  },
  dayList: {
    marginTop: 24,
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dayListTitle: {
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 16,
    fontWeight: '700',
  },
  dayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  dayColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  dayItemText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  dayItemActions: {
    flexDirection: 'row',
    gap: 6,
  },
  smallBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
    shadowColor: '#3B82F6',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  smallBtnText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  primaryCta: {
    backgroundColor: '#4E6E58',
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 10,
  },
  primaryCtaText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryCta: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  formButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 0,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginLeft: 12,
  },
  modalContent: {
    padding: 20,
  },
  modalMessage: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 16,
    lineHeight: 22,
  },
  scheduleInfo: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  warningText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '500',
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 0,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  deleteButton: {
    backgroundColor: '#EF4444',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  busyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  busyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7FBF7',
    borderWidth: 1,
    borderColor: '#C8D8CA',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  busyText: {
    color: '#234033',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default ScheduleTab;
