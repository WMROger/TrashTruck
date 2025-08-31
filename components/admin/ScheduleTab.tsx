import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const ScheduleTab: React.FC = () => {
  const [scheduleMode, setScheduleMode] = useState<'add' | 'edit'>('add');

  return (
    <ScrollView style={styles.container}>
      <View style={styles.scheduleContainer}>
        <Text style={styles.sectionTitle}>Schedule Management</Text>
        
        {/* Waste Category Badges */}
        <View style={styles.categoryBadges}>
          <View style={[styles.categoryBadge, { backgroundColor: '#4169E1' }]}>
            <Text style={styles.categoryBadgeText}>Non-biodegradable</Text>
          </View>
          <View style={[styles.categoryBadge, { backgroundColor: '#FFD700' }]}>
            <Text style={styles.categoryBadgeText}>Recyclable</Text>
          </View>
          <View style={[styles.categoryBadge, { backgroundColor: '#32CD32' }]}>
            <Text style={styles.categoryBadgeText}>Biodegradable</Text>
          </View>
          <View style={[styles.categoryBadge, { backgroundColor: '#9370DB' }]}>
            <Text style={styles.categoryBadgeText}>Special / Bulk Collection</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.scheduleActions}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.addButton]}
            onPress={() => setScheduleMode('add')}
          >
            <Text style={styles.actionButtonText}>+ Add Schedule</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, styles.editButton]}
            onPress={() => setScheduleMode('edit')}
          >
            <Text style={styles.actionButtonText}>Edit Schedule</Text>
          </TouchableOpacity>
        </View>

        {/* Two Column Layout */}
        <View style={styles.scheduleLayout}>
          {/* Left Column - Calendar */}
          <View style={styles.calendarColumn}>
            <View style={styles.calendarContainer}>
              <View style={styles.calendarHeader}>
                <TouchableOpacity style={styles.calendarNav}>
                  <Ionicons name="chevron-back" size={20} color="#333" />
                </TouchableOpacity>
                <Text style={styles.calendarTitle}>April 2021</Text>
                <TouchableOpacity style={styles.calendarNav}>
                  <Ionicons name="chevron-forward" size={20} color="#333" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.calendarGrid}>
                {/* Days of week */}
                {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day) => (
                  <Text key={day} style={styles.calendarDayHeader}>{day}</Text>
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
                        styles.calendarDateText,
                        isHighlighted && styles.calendarDateTextHighlighted
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
          <View style={styles.formColumn}>
            <View style={styles.scheduleForm}>
              <Text style={styles.formTitle}>
                {scheduleMode === 'add' ? 'Add Schedule' : 'Edit Schedule'}
              </Text>
              
              <View style={styles.formRow}>
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Set date</Text>
                  <TouchableOpacity style={styles.formInput}>
                    <Text style={styles.formInputText}>Select date</Text>
                    <Ionicons name="calendar" size={20} color="#666" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Set time</Text>
                  <TouchableOpacity style={styles.formInput}>
                    <Text style={styles.formInputText}>Select time</Text>
                    <Ionicons name="time" size={20} color="#666" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>Barangay Street</Text>
                <View style={styles.formInput}>
                  <Text style={styles.formInputText}>Enter barangay/street</Text>
                  <Ionicons name="search" size={20} color="#666" />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Frequency</Text>
                  <TouchableOpacity style={styles.formInput}>
                    <Text style={styles.formInputText}>Select frequency</Text>
                    <Ionicons name="chevron-down" size={20} color="#666" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Waste Category</Text>
                  <TouchableOpacity style={styles.formInput}>
                    <Text style={styles.formInputText}>Select category</Text>
                    <Ionicons name="chevron-down" size={20} color="#666" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Assigned Truck</Text>
                  <TouchableOpacity style={styles.formInput}>
                    <Text style={styles.formInputText}>Select truck</Text>
                    <Ionicons name="chevron-down" size={20} color="#666" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Choose Driver</Text>
                  <TouchableOpacity style={styles.formInput}>
                    <Text style={styles.formInputText}>Select driver</Text>
                    <Ionicons name="chevron-down" size={20} color="#666" />
                  </TouchableOpacity>
                </View>
              </View>

              {scheduleMode === 'edit' && (
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Status</Text>
                  <TouchableOpacity style={styles.formInput}>
                    <Text style={styles.formInputText}>Select status</Text>
                    <Ionicons name="chevron-down" size={20} color="#666" />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.formField}>
                <Text style={styles.formLabel}>Note</Text>
                <View style={styles.formTextArea}>
                  <Text style={styles.formTextAreaPlaceholder}>Add special instructions</Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.formActions}>
                {scheduleMode === 'add' ? (
                  <TouchableOpacity style={styles.addScheduleButton}>
                    <Text style={styles.addScheduleButtonText}>Add</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity style={styles.saveButton}>
                      <Text style={styles.saveButtonText}>Save Changes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelButton}>
                      <Text style={styles.cancelButtonText}>Cancel</Text>
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
  scheduleContainer: {
    backgroundColor: '#E8F5E8',
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
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  categoryBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  categoryBadge: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginVertical: 5,
    marginHorizontal: 5,
  },
  categoryBadgeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  scheduleActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  addButton: {
    backgroundColor: '#2E8B57',
  },
  editButton: {
    backgroundColor: '#4169E1',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scheduleLayout: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  calendarColumn: {
    flex: 1,
    marginRight: 10,
  },
  formColumn: {
    flex: 1,
    marginLeft: 10,
  },
  calendarContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  calendarNav: {
    padding: 10,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  calendarDayHeader: {
    fontSize: 12,
    color: '#666',
    width: '14%', // 7 days
    textAlign: 'center',
    marginBottom: 3,
  },
  calendarDate: {
    width: '14%', // 7 days
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginVertical: 3,
  },
  calendarDateText: {
    fontSize: 14,
    color: '#333',
  },
  calendarDateTextHighlighted: {
    fontWeight: 'bold',
    color: 'white',
  },
  scheduleForm: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  formField: {
    flex: 1,
    marginHorizontal: 3,
  },
  formLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  formInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  formInputText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  formTextArea: {
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
  },
  formTextAreaPlaceholder: {
    fontSize: 14,
    color: '#999',
    textAlignVertical: 'top',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  addScheduleButton: {
    backgroundColor: '#2E8B57',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  addScheduleButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#4169E1',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#FF6347',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default ScheduleTab;
