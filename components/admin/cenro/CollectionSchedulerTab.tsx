import React, { useState, useEffect, createElement } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import { collection, addDoc, onSnapshot, serverTimestamp, query, orderBy, doc, updateDoc, arrayUnion, deleteDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { DANAO_CITY_BARANGAYS } from '../../../constants/danaoBarangays';
import AnalogTimePicker from './AnalogTimePicker';

const WebDatePicker = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
  if (Platform.OS !== 'web') return null;
  
  // Get today's date in YYYY-MM-DD format for the 'min' attribute
  const today = new Date().toLocaleDateString('en-CA'); // 'en-CA' outputs YYYY-MM-DD reliably

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
      boxSizing: 'border-box'
    }
  }) as any;
};

// WebTimePicker is removed, replaced by AnalogTimePicker

export default function CollectionSchedulerTab() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [isModalVisible, setModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form State
  const [barangayName, setBarangayName] = useState('');
  const [streetName, setStreetName] = useState('');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [truckName, setTruckName] = useState('');
  const [wasteCategory, setWasteCategory] = useState('BIODEGRADABLE');

  // Details Modal State
  const [selectedBarangay, setSelectedBarangay] = useState<any>(null);
  const [isDetailsModalVisible, setDetailsModalVisible] = useState(false);
  const [isSavingDetail, setIsSavingDetail] = useState(false);
  const [specificCategory, setSpecificCategory] = useState('BIODEGRADABLE');

  // Accordion State
  const [expandedBarangay, setExpandedBarangay] = useState<string | null>(null);
  const [expandedStreet, setExpandedStreet] = useState<string | null>(null);

  // Group schedules by barangay and street
  const groupedSchedules = React.useMemo(() => {
    const groups: Record<string, Record<string, any[]>> = {};
    schedules.forEach(s => {
      const b = s.barangayName || 'Unknown Barangay';
      const street = s.streetName || 'Whole Barangay';
      if (!groups[b]) groups[b] = {};
      if (!groups[b][street]) groups[b][street] = [];
      groups[b][street].push(s);
    });
    return groups;
  }, [schedules]);

  // Web-friendly string states
  const [webDateStr, setWebDateStr] = useState('');
  const [webTimeStr, setWebTimeStr] = useState('00:00');

  // Native Pickers State
  const [dateObj, setDateObj] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0); // Default to 12:00 AM
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  // Custom Web Analog Picker State
  const [showAnalogTimePicker, setShowAnalogTimePicker] = useState(false);

  // Computed Date/Time for display and saving
  const formattedDate = Platform.OS === 'web' 
    ? (webDateStr ? `${webDateStr.split('-')[1]}/${webDateStr.split('-')[2]}` : '') // convert YYYY-MM-DD to MM/DD
    : `${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getDate().toString().padStart(2, '0')}`;
  
  const formatTime = (d: Date) => {
    let h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12; 
    return `${h.toString().padStart(2, '0')}:${m} ${ampm}`;
  };

  const formattedTime = Platform.OS === 'web'
    ? (webTimeStr ? (function() {
        // webTimeStr is HH:mm in 24hr format
        const [hours, mins] = webTimeStr.split(':');
        let h = parseInt(hours, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        h = h ? h : 12;
        return `${h.toString().padStart(2, '0')}:${mins} ${ampm}`;
      })() : '')
    : formatTime(dateObj);

  const DAYS_OF_WEEK = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const CATEGORIES = [
    { name: 'BIODEGRADABLE', color: '#22C55E' },
    { name: 'NON-BIODEGRADABLE', color: '#2563EB' },
    { name: 'RECYCLABLE', color: '#EAB308' },
    { name: 'RESIDUAL', color: '#6B7280' },
    { name: 'HAZARDOUS', color: '#EF4444' },
    { name: 'SPECIAL/BULK', color: '#A855F7' }
  ];

  useEffect(() => {
    const q = query(collection(db, 'barangay_schedules'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSchedules(docs);
      
      // Update selectedBarangay if it's currently open
      if (selectedBarangay) {
        const updated = docs.find(d => d.id === selectedBarangay.id);
        if (updated) setSelectedBarangay(updated);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [selectedBarangay?.id]);

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleSaveSchedule = async () => {
    if (!barangayName.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Missing Fields: Please enter a Barangay name.');
      } else {
        Alert.alert('Missing Fields', 'Please enter a Barangay name.');
      }
      return;
    }
    if (!selectedDays.length) {
      if (Platform.OS === 'web') window.alert('Missing Fields: Select at least one regular collection day.');
      else Alert.alert('Missing Fields', 'Select at least one regular collection day.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'barangay_schedules'), {
        barangayName: barangayName.trim(),
        streetName: streetName.trim(),
        days: selectedDays,
        truck: truckName.trim(),
        wasteCategory: wasteCategory,
        createdAt: serverTimestamp(),
      });
      
      setModalVisible(false);
      setBarangayName('');
      setStreetName('');
      setSelectedDays([]);
      setTruckName('');
      setWasteCategory('BIODEGRADABLE');
    } catch (error) {
      console.error('Error saving schedule: ', error);
      Alert.alert('Error', 'Could not save the schedule.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveSpecificSchedule = async () => {
    if (!selectedBarangay) return;

    if (Platform.OS === 'web' && !webDateStr) {
      window.alert("Please select a valid date.");
      return;
    }

    setIsSavingDetail(true);
    try {
      const docRef = doc(db, 'barangay_schedules', selectedBarangay.id);
      const newEntry = {
        date: formattedDate,
        time: formattedTime,
        category: specificCategory,
        createdAt: new Date().toISOString()
      };
      
      await updateDoc(docRef, {
        specificSchedules: arrayUnion(newEntry)
      });
      
      // Update local state to reflect immediately in modal
      setSelectedBarangay({
        ...selectedBarangay,
        specificSchedules: [...(selectedBarangay.specificSchedules || []), newEntry]
      });

      // Reset for next entry
      const resetDate = new Date();
      resetDate.setHours(0, 0, 0, 0);
      setDateObj(resetDate);
      if (Platform.OS === 'web') {
        setWebTimeStr('00:00');
        setWebDateStr('');
      }
      setSpecificCategory('BIODEGRADABLE');
    } catch (error) {
      console.error('Error adding specific schedule: ', error);
      Alert.alert('Error', 'Failed to save specific schedule.');
    } finally {
      setIsSavingDetail(false);
    }
  };
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteSchedule = async (scheduleId: string) => {
    const doDelete = async () => {
      setIsDeleting(true);
      try {
        await deleteDoc(doc(db, 'barangay_schedules', scheduleId));
        if (selectedBarangay?.id === scheduleId) {
          setDetailsModalVisible(false);
        }
      } catch (err) {
        console.error("Error deleting:", err);
        if (Platform.OS === 'web') {
          window.alert("Could not delete schedule.");
        } else {
          Alert.alert("Error", "Could not delete schedule.");
        }
      } finally {
        setIsDeleting(false);
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm("Are you sure you want to remove this schedule? This will immediately remove it from the resident app.");
      if (confirmed) {
        await doDelete();
      }
    } else {
      Alert.alert(
        "Delete Schedule",
        "Are you sure you want to remove this schedule? This will immediately remove it from the resident app.",
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Delete", 
            style: "destructive",
            onPress: doDelete
          }
        ]
      );
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
          specificSchedules: updatedSchedules
        });
        
        setSelectedBarangay({
          ...selectedBarangay,
          specificSchedules: updatedSchedules
        });
      } catch (error) {
        console.error('Error deleting specific schedule:', error);
        Alert.alert('Error', 'Could not delete specific schedule.');
      } finally {
        setIsDeleting(false);
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm("Are you sure you want to remove this specific pickup?");
      if (confirmed) {
        await doDeleteSpecific();
      }
    } else {
      Alert.alert(
        "Delete Pickup",
        "Are you sure you want to remove this specific pickup?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: doDeleteSpecific }
        ]
      );
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.headerSubtitle}>RESOURCE MANAGEMENT</Text>
      <Text style={styles.headerTitle}>Barangay Collection Scheduler</Text>
      <Text style={styles.headerDesc}>
        Streamline waste collection workflows across city districts. Manage recurring routes, assign specialized vehicles, and monitor service status in real-time.
      </Text>

      {/* Header Actions */}
      <View style={styles.actionsContainer}>
        <View style={styles.filtersRow}>
          <View style={styles.dropdown}>
            <Text style={styles.dropdownText}>All Barangays</Text>
            <MaterialIcons name="keyboard-arrow-down" size={20} color="#6B7280" />
          </View>
          <View style={styles.dropdown}>
            <Text style={styles.dropdownText}>Any Day of the Week</Text>
            <MaterialIcons name="keyboard-arrow-down" size={20} color="#6B7280" />
          </View>
          
          <View style={styles.viewStyleGroup}>
            <Text style={styles.viewStyleLabel}>VIEW STYLE</Text>
            <View style={styles.viewToggleActive}><MaterialIcons name="view-list" size={18} color="#fff" /></View>
            <View style={styles.viewToggle}><MaterialIcons name="grid-view" size={18} color="#6B7280" /></View>
          </View>
        </View>

        <View style={styles.buttonsRow}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setModalVisible(true)}>
            <MaterialIcons name="add" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Add New Barangay</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Scheduler Table */}
      <View style={styles.card}>
        <View style={styles.tableHead}>
          <Text style={[styles.th, { flex: 2.5 }]}>BARANGAY NAME</Text>
          <Text style={[styles.th, { flex: 2 }]}>COLLECTION DAYS</Text>
          <Text style={[styles.th, { flex: 2 }]}>ASSIGNED TRUCK</Text>
          <Text style={[styles.th, { flex: 1.5 }]}>STATUS</Text>
          <Text style={[styles.th, { flex: 0.5, textAlign: 'center' }]}>ACTIONS</Text>
        </View>

        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#2E8B57" />
          </View>
        ) : schedules.length === 0 ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ color: '#6B7280' }}>No barangay schedules found.</Text>
          </View>
        ) : (
          Object.keys(groupedSchedules).map((bName, i) => (
            <View key={bName || i} style={styles.accordionContainer}>
              {/* Barangay Header */}
              <TouchableOpacity 
                style={styles.tableRow}
                onPress={() => setExpandedBarangay(expandedBarangay === bName ? null : bName)}
              >
                <View style={[styles.td, { flex: 2.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 12 }]}>
                  <View style={styles.avatarBadge}>
                    <Text style={styles.avatarText}>{(bName || 'BR').substring(0, 2).toUpperCase()}</Text>
                  </View>
                  <View>
                    <Text style={styles.brgyName}>{bName}</Text>
                    <Text style={styles.brgyDesc}>{Object.keys(groupedSchedules[bName]).length} Streets/Routes</Text>
                  </View>
                </View>
                <View style={[styles.td, { flex: 1.5, alignItems: 'flex-end' }]}>
                  <MaterialIcons name={expandedBarangay === bName ? "expand-less" : "expand-more"} size={24} color="#6B7280" />
                </View>
              </TouchableOpacity>

              {/* Streets List */}
              {expandedBarangay === bName && (
                <View style={styles.accordionBody}>
                  {Object.keys(groupedSchedules[bName]).map((streetName, j) => (
                    <View key={streetName || j} style={styles.streetContainer}>
                      {/* Street Header */}
                      <TouchableOpacity 
                        style={styles.streetRow}
                        onPress={() => {
                          const fullId = `${bName}-${streetName}`;
                          setExpandedStreet(expandedStreet === fullId ? null : fullId);
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <MaterialIcons name="map" size={18} color="#4B5563" />
                          <Text style={styles.streetNameText}>{streetName}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={styles.streetDescText}>{groupedSchedules[bName][streetName].length} Schedules</Text>
                          <MaterialIcons name={expandedStreet === `${bName}-${streetName}` ? "expand-less" : "expand-more"} size={20} color="#6B7280" />
                        </View>
                      </TouchableOpacity>

                      {/* Schedules List */}
                      {expandedStreet === `${bName}-${streetName}` && (
                        <View style={styles.schedulesBody}>
                          {groupedSchedules[bName][streetName].map((row, k) => (
                            <TouchableOpacity 
                              key={row.id || k} 
                              style={styles.scheduleItemRow}
                              onPress={() => {
                                setSelectedBarangay(row);
                                setDetailsModalVisible(true);
                              }}
                            >
                              <View style={[styles.td, { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 4, flexWrap: 'wrap' }]}>
                                {(row.days || []).map((day: string, dIdx: number) => (
                                  <View key={`d-${dIdx}`} style={[styles.dayBadge, day === 'DAILY SERVICE' && { backgroundColor: '#2E8B57' }]}>
                                    <Text style={[styles.dayText, day === 'DAILY SERVICE' && { color: '#fff' }]}>{day}</Text>
                                  </View>
                                ))}
                                {(row.specificSchedules || []).map((ss: any, idx: number) => (
                                  <View key={`ss-${idx}`} style={[styles.dayBadge, { backgroundColor: '#E0E7FF', borderColor: '#C7D2FE', borderWidth: 1 }]}>
                                    <Text style={[styles.dayText, { color: '#4338CA' }]}>{ss.date} {ss.time}</Text>
                                  </View>
                                ))}
                              </View>

                              <View style={[styles.td, { flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 8 }]}>
                                <MaterialIcons name="local-shipping" size={16} color="#6B7280" />
                                <Text style={styles.truckName}>{row.truck}</Text>
                              </View>

                              <View style={[styles.td, { flex: 1.5 }]}>
                                {(() => {
                                  const catName = row.wasteCategory || 'BIODEGRADABLE';
                                  const catColor = CATEGORIES.find(c => c.name === catName)?.color || '#059669';
                                  return (
                                    <View style={[styles.statusBadge, { backgroundColor: catColor + '20' }]}>
                                      <Text style={[styles.statusText, { color: catColor }]}>{catName}</Text>
                                    </View>
                                  );
                                })()}
                              </View>

                              <View style={[styles.td, { flex: 0.5, alignItems: 'center' }]}>
                                <MaterialIcons name="edit" size={18} color="#6B7280" />
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}
                  
                  {/* Add New Schedule Button for this Barangay */}
                  <TouchableOpacity 
                    style={styles.addStreetBtn}
                    onPress={() => {
                      setBarangayName(bName);
                      setStreetName('');
                      setModalVisible(true);
                    }}
                  >
                    <MaterialIcons name="add-circle-outline" size={18} color="#2E8B57" />
                    <Text style={styles.addStreetBtnText}>Add Route to {bName}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}

        <View style={styles.pagination}>
          <Text style={styles.pageInfo}>Showing {schedules.length} Barangays</Text>
          <View style={styles.pageControls}>
            <View><MaterialIcons name="chevron-left" size={20} color="#D1D5DB" /></View>
            <Text style={[styles.pageNum, styles.pageNumActive]}>1</Text>
            <View><MaterialIcons name="chevron-right" size={20} color="#D1D5DB" /></View>
          </View>
        </View>
      </View>

      {/* Add Schedule Modal */}
      <Modal visible={isModalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Barangay Schedule</Text>

            <Text style={styles.inputLabel}>Barangay Name (Danao City)</Text>
            {Platform.OS === 'web' ? (
              <>
                <input 
                  type="text" 
                  list="barangay-list"
                  placeholder="Select or type a Barangay"
                  style={{ 
                    padding: '12px 16px', 
                    borderRadius: '8px', 
                    border: '1px solid #D1D5DB', 
                    width: '100%', 
                    fontSize: '14px', 
                    marginBottom: '16px', 
                    backgroundColor: '#F9FAFB', 
                    color: '#111827', 
                    boxSizing: 'border-box', 
                    outline: 'none',
                    fontFamily: 'inherit'
                  }}
                  value={barangayName}
                  onChange={(e: any) => setBarangayName(e.target.value)}
                />
                <datalist id="barangay-list">
                  {DANAO_CITY_BARANGAYS
                  .filter(b => !schedules.some(s => s.barangayName === b))
                  .map(b => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </>
            ) : (
              <TextInput
                style={styles.textInput}
                placeholder="e.g., Poblacion"
                value={barangayName}
                onChangeText={setBarangayName}
              />
            )}

            <Text style={styles.inputLabel}>Street Name (Optional)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Rizal Street or leave blank for Whole Barangay"
              value={streetName}
              onChangeText={setStreetName}
            />

            <Text style={styles.inputLabel}>Regular Collection Days</Text>
            <View style={styles.modalDaysRow}>
              {DAYS_OF_WEEK.map(day => {
                const selected = selectedDays.includes(day);
                return <TouchableOpacity key={day} style={[styles.modalDay, selected && styles.modalDaySelected]} onPress={() => toggleDay(day)}>
                  <Text style={[styles.modalDayText, selected && styles.modalDayTextSelected]}>{day}</Text>
                </TouchableOpacity>;
              })}
            </View>

            <Text style={styles.inputLabel}>Assigned Truck / Driver</Text>
            <TextInput
              style={styles.textInput}
              value={truckName}
              onChangeText={setTruckName}
              placeholder="e.g., Truck #101"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveSchedule} disabled={isSubmitting}>
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Save Schedule</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Barangay Specific Details Modal */}
      <Modal visible={isDetailsModalVisible} transparent animationType="fade" onRequestClose={() => setDetailsModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedBarangay && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <View>
                    <Text style={styles.modalTitle}>{selectedBarangay.barangayName} Details</Text>
                    <Text style={styles.brgyDesc}>Specific Dates & Times</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => handleDeleteSchedule(selectedBarangay.id)} style={{ marginRight: 24 }} disabled={isDeleting}>
                      {isDeleting ? <ActivityIndicator size="small" color="#ef4444" /> : <MaterialIcons name="delete-outline" size={26} color="#ef4444" />}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setDetailsModalVisible(false)} disabled={isDeleting}>
                      <MaterialIcons name="close" size={26} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* List Existing Specific Schedules */}
                <ScrollView style={{ maxHeight: 200, marginBottom: 20 }}>
                  {(selectedBarangay.specificSchedules || []).length === 0 ? (
                    <Text style={{ color: '#6B7280', fontSize: 13, fontStyle: 'italic' }}>No specific date/times scheduled yet.</Text>
                  ) : (
                    (selectedBarangay.specificSchedules || []).map((ss: any, idx: number) => (
                      <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 12, borderRadius: 8, marginBottom: 8 }}>
                        <View>
                          <Text style={{ fontWeight: '600', color: '#111827' }}>{ss.date} at {ss.time}</Text>
                          <Text style={{ fontSize: 12, color: CATEGORIES.find(c => c.name === ss.category)?.color || '#2E8B57', fontWeight: '700' }}>{ss.category}</Text>
                        </View>
                        <TouchableOpacity onPress={() => handleDeleteSpecificSchedule(idx)} style={{ padding: 4 }} disabled={isDeleting}>
                          {isDeleting ? <ActivityIndicator size="small" color="#ef4444" /> : <MaterialIcons name="close" size={20} color="#ef4444" />}
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </ScrollView>

                <View style={{ height: 1, backgroundColor: '#E5E7EB', marginBottom: 20 }} />

                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#111827', marginBottom: 12 }}>Add Specific Pickup</Text>
                
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Date</Text>
                    {Platform.OS === 'web' ? (
                      <WebDatePicker value={webDateStr} onChange={setWebDateStr} />
                    ) : (
                      <TouchableOpacity 
                        style={[styles.textInput, { justifyContent: 'center' }]} 
                        onPress={() => setShowDatePicker(true)}
                      >
                        <Text style={{ color: '#111827' }}>{formattedDate}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Time</Text>
                    {Platform.OS === 'web' ? (
                      <TouchableOpacity 
                        style={[styles.textInput, { justifyContent: 'center', height: 48, boxSizing: 'border-box' }]} 
                        onPress={() => setShowAnalogTimePicker(true)}
                      >
                        <Text style={{ color: '#111827' }}>{formattedTime}</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity 
                        style={[styles.textInput, { justifyContent: 'center', height: 48, boxSizing: 'border-box' }]} 
                        onPress={() => setShowTimePicker(true)}
                      >
                        <Text style={{ color: '#111827' }}>{formattedTime}</Text>
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
                      setWebTimeStr(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
                    }}
                  />
                )}

                {Platform.OS !== 'web' && (showDatePicker || showTimePicker) && (
                  <DateTimePicker
                    value={dateObj}
                    mode={showDatePicker ? 'date' : 'time'}
                    display="default"
                    minimumDate={new Date()} // Prevent selecting past dates
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

                <Text style={styles.inputLabel}>Waste Category</Text>
                <View style={styles.categoryContainer}>
                  {CATEGORIES.map(cat => {
                    const isSelected = specificCategory === cat.name;
                    return (
                      <TouchableOpacity
                        key={cat.name}
                        style={[
                          styles.catBtn,
                          isSelected && { backgroundColor: cat.color, borderColor: cat.color }
                        ]}
                        onPress={() => setSpecificCategory(cat.name)}
                      >
                        <Text style={[
                          styles.catBtnText,
                          isSelected && { color: '#fff', fontWeight: '700' }
                        ]}>{cat.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveSpecificSchedule} disabled={isSavingDetail}>
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
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 32 },
  headerSubtitle: { fontSize: 12, fontWeight: '700', color: '#2E8B57', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#111827', marginBottom: 12 },
  headerDesc: { fontSize: 14, color: '#4B5563', lineHeight: 22, maxWidth: 600, marginBottom: 32 },

  actionsContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, zIndex: 10 },
  filtersRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  dropdown: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', width: 200 },
  dropdownText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  
  viewStyleGroup: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 16 },
  viewStyleLabel: { fontSize: 10, fontWeight: '700', color: '#6B7280', letterSpacing: 0.5 },
  viewToggleActive: { backgroundColor: '#2E8B57', padding: 8, borderRadius: 6 },
  viewToggle: { backgroundColor: '#F3F4F6', padding: 8, borderRadius: 6 },

  buttonsRow: { flexDirection: 'row', gap: 16 },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#fff' },
  outlineBtnText: { color: '#374151', fontWeight: '600', fontSize: 14 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#4b6354' },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  card: { backgroundColor: '#fff', borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2, padding: 24 },
  tableHead: { flexDirection: 'row', backgroundColor: '#F9FAFB', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, marginBottom: 8 },
  th: { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  td: { justifyContent: 'center' },
  
  avatarBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: 'bold', color: '#4B5563' },
  brgyName: { fontWeight: '700', color: '#111827', fontSize: 15, marginBottom: 2 },
  brgyDesc: { fontSize: 12, color: '#6B7280' },

  dayBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  dayText: { fontSize: 10, fontWeight: '700', color: '#166534' },

  truckName: { fontWeight: '600', color: '#374151', fontSize: 14 },
  truckDesc: { fontSize: 12, color: '#6B7280' },

  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, alignSelf: 'flex-start' },
  statusText: { fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },

  pagination: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingTop: 16 },
  pageInfo: { fontSize: 13, color: '#6B7280' },
  pageControls: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  pageNum: { fontSize: 14, fontWeight: '500', color: '#6B7280' },
  pageNumActive: { color: '#111827', fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 24, width: '90%', maxWidth: 500 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 20 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#4B5563', marginBottom: 8, marginTop: 16 },
  textInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 14, color: '#111827' },
  modalDaysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  modalDay: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#F9FAFB' },
  modalDaySelected: { backgroundColor: '#2E8B57', borderColor: '#2E8B57' },
  modalDayText: { fontSize: 11, fontWeight: '800', color: '#475569' },
  modalDayTextSelected: { color: '#FFFFFF' },
  daysContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  daySelectBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#F9FAFB' },
  daySelectBtnActive: { backgroundColor: '#2E8B57', borderColor: '#2E8B57' },
  daySelectText: { fontSize: 12, fontWeight: '600', color: '#4B5563' },
  daySelectTextActive: { color: '#fff' },
  categoryContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  catBtnText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 32 },
  modalCancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#F3F4F6' },
  modalCancelText: { color: '#4B5563', fontWeight: '600', fontSize: 14 },
  modalSaveBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#2E8B57', minWidth: 100, alignItems: 'center' },
  modalSaveText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  // NEW ACCORDION STYLES
  accordionContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  accordionBody: {
    backgroundColor: '#F9FAFB',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  streetContainer: {
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  streetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F3F4F6',
  },
  streetNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  streetDescText: {
    fontSize: 13,
    color: '#6B7280',
  },
  schedulesBody: {
    padding: 8,
  },
  scheduleItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  addStreetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2E8B57',
    borderStyle: 'dashed',
    borderRadius: 8,
    marginTop: 8,
    backgroundColor: '#EDFBE8',
  },
  addStreetBtnText: {
    color: '#2E8B57',
    fontWeight: '600',
    fontSize: 14,
  },
});
