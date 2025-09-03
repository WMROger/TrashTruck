import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const ScheduleTab: React.FC = () => {
  const [scheduleMode, setScheduleMode] = useState<'add' | 'edit'>('add');

  return (
    <ScrollView style={styles.container}>
      <View style={styles.mainSection}>
        <Text style={styles.title}>Schedule Management</Text>
        
        {/* Waste Category Badges */}
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
          <View style={[styles.badge, { backgroundColor: '#A855F7' }]}>
            <Text style={styles.badgeText}>Special / Bulk Collection</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: '#22C55E' }]}
            onPress={() => setScheduleMode('add')}
          >
            <Text style={styles.buttonText}>+ Add Schedule</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: '#2563EB' }]}
            onPress={() => setScheduleMode('edit')}
          >
            <Text style={styles.buttonText}>Edit Schedule</Text>
          </TouchableOpacity>
        </View>

        {/* Two Column Layout */}
        <View style={styles.columnsContainer}>
          {/* Left Column - Calendar */}
          <View style={styles.leftColumn}>
            <View style={styles.calendarCard}>
              <View style={styles.calendarHeader}>
                <TouchableOpacity style={styles.calendarButton}>
                  <Ionicons name="chevron-back" size={20} color="#333" />
                </TouchableOpacity>
                <Text style={styles.calendarTitle}>April 2021</Text>
                <TouchableOpacity style={styles.calendarButton}>
                  <Ionicons name="chevron-forward" size={20} color="#333" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.calendarGrid}>
                {/* Days of week */}
                {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day) => (
                  <Text key={day} style={styles.dayHeader}>{day}</Text>
                ))}
                
                {/* Calendar dates */}
                {Array.from({ length: 30 }, (_, i) => i + 1).map((date) => {
                  const isHighlighted = [7, 14, 15, 17, 19, 20, 21, 23].includes(date);
                  const highlightColor = date === 15 ? '#32CD32' : 
                                       date === 17 ? '#FFD700' : 
                                       date === 19 ? '#9370DB' : 
                                       date === 20 ? '#8A2BE2' : 
                                       date === 21 ? '#87CEEB' : '#4169E1';
                  
                  return (
                    <TouchableOpacity
                      key={date}
                      style={[
                        styles.calendarDate,
                        isHighlighted && { backgroundColor: highlightColor }
                      ]}
                    >
                      <Text style={[
                        styles.dateText,
                        isHighlighted && styles.highlightedDateText
                      ]}>
                        {date}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Right Column - Schedule Form */}
          <View style={styles.rightColumn}>
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>
                {scheduleMode === 'add' ? 'Add Schedule' : 'Edit Schedule'}
              </Text>
              
              <View style={styles.formRow}>
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>Set date</Text>
                  <TouchableOpacity style={styles.inputField}>
                    <Text style={styles.inputText}>Select date</Text>
                    <Ionicons name="calendar" size={20} color="#666" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>Set time</Text>
                  <TouchableOpacity style={styles.inputField}>
                    <Text style={styles.inputText}>Select time</Text>
                    <Ionicons name="time" size={20} color="#666" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Barangay Street</Text>
                <View style={styles.inputField}>
                  <Text style={styles.inputText}>Enter barangay/street</Text>
                  <Ionicons name="search" size={20} color="#666" />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>Frequency</Text>
                  <TouchableOpacity style={styles.inputField}>
                    <Text style={styles.inputText}>Select frequency</Text>
                    <Ionicons name="chevron-down" size={20} color="#666" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>Waste Category</Text>
                  <TouchableOpacity style={styles.inputField}>
                    <Text style={styles.inputText}>Select category</Text>
                    <Ionicons name="chevron-down" size={20} color="#666" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>Assigned Truck</Text>
                  <TouchableOpacity style={styles.inputField}>
                    <Text style={styles.inputText}>Select truck</Text>
                    <Ionicons name="chevron-down" size={20} color="#666" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>Choose Driver</Text>
                  <TouchableOpacity style={styles.inputField}>
                    <Text style={styles.inputText}>Select driver</Text>
                    <Ionicons name="chevron-down" size={20} color="#666" />
                  </TouchableOpacity>
                </View>
              </View>

              {scheduleMode === 'edit' && (
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>Status</Text>
                  <TouchableOpacity style={styles.inputField}>
                    <Text style={styles.inputText}>Select status</Text>
                    <Ionicons name="chevron-down" size={20} color="#666" />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Note</Text>
                <View style={styles.textArea}>
                  <Text style={styles.textAreaPlaceholder}>Add special instructions</Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.formButtons}>
                {scheduleMode === 'add' ? (
                  <TouchableOpacity style={[styles.formButton, { backgroundColor: '#22C55E' }]}>
                    <Text style={styles.formButtonText}>Add</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity style={[styles.formButton, { backgroundColor: '#2563EB' }]}>
                      <Text style={styles.formButtonText}>Save Changes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.formButton, { backgroundColor: '#EF4444' }]}>
                      <Text style={styles.formButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainSection: {
    backgroundColor: '#F0FDF4',
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
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  badge: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginVertical: 4,
    marginHorizontal: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  columnsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  leftColumn: {
    flex: 1,
    marginRight: 8,
  },
  rightColumn: {
    flex: 1,
    marginLeft: 8,
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
    marginBottom: 12,
  },
  formField: {
    flex: 1,
    marginHorizontal: 4,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    fontWeight: '500',
  },
  inputField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inputText: {
    flex: 1,
    fontSize: 12,
    color: '#1F2937',
    marginLeft: 8,
  },
  textArea: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
  },
  textAreaPlaceholder: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  formButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  formButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default ScheduleTab;
