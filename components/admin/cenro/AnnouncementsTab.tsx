import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
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

export default function AnnouncementsTab() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('General');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('Medium');
  const [description, setDescription] = useState('');
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list: Announcement[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as Announcement);
      });
      setAnnouncements(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handlePublish = async () => {
    if (!title || !description) {
      Alert.alert('Validation Error', 'Title and Description are required.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const newDocRef = doc(collection(db, 'announcements'));
      await setDoc(newDocRef, {
        title,
        category,
        priority,
        description,
        isPublished: true,
        createdAt: serverTimestamp()
      });
      
      Alert.alert('Success', 'Announcement published successfully.');
      setTitle('');
      setCategory('General');
      setPriority('Medium');
      setDescription('');
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
          }
        }
      ]
    );
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'Urgent': return { bg: '#FEE2E2', text: '#DC2626' };
      case 'High': return { bg: '#FEF3C7', text: '#D97706' };
      case 'Medium': return { bg: '#E0F2FE', text: '#0284C7' };
      case 'Low': return { bg: '#F3F4F6', text: '#4B5563' };
      default: return { bg: '#F3F4F6', text: '#4B5563' };
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.headerSubtitle}>COMMUNICATIONS</Text>
      <Text style={styles.headerTitle}>Announcement Creator</Text>

      {/* Creator Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <MaterialIcons name="campaign" size={20} color="#2E8B57" style={styles.cardIcon} />
            <Text style={styles.cardTitle}>New Announcement</Text>
          </View>
        </View>

        <View style={styles.formGrid}>
          <View style={[styles.formGroup, { width: '100%' }]}>
            <Text style={styles.label}>ANNOUNCEMENT TITLE</Text>
            <TextInput style={styles.input} placeholder="e.g. Holiday Schedule Changes" value={title} onChangeText={setTitle} />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>CATEGORY</Text>
            <TextInput style={styles.input} placeholder="e.g. Schedule, Alert, General" value={category} onChangeText={setCategory} />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>PRIORITY</Text>
            <View style={{ position: 'relative', zIndex: 10 }}>
              <TouchableOpacity style={styles.dropdown} onPress={() => setShowPriorityDropdown(!showPriorityDropdown)}>
                <Text style={styles.dropdownText}>{priority}</Text>
                <MaterialIcons name={showPriorityDropdown ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={20} color="#6B7280" />
              </TouchableOpacity>
              
              {showPriorityDropdown && (
                <View style={styles.dropdownMenu}>
                  {['Low', 'Medium', 'High', 'Urgent'].map((p: any) => (
                    <TouchableOpacity 
                      key={p} 
                      style={styles.dropdownItem}
                      onPress={() => { setPriority(p); setShowPriorityDropdown(false); }}
                    >
                      <Text style={[styles.dropdownItemText, { color: getPriorityColor(p).text }]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>
          
          <View style={[styles.formGroup, { width: '100%' }]}>
            <Text style={styles.label}>MESSAGE CONTENT</Text>
            <TextInput 
              style={[styles.input, styles.textArea]} 
              placeholder="Type the full announcement message here..." 
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
            style={styles.primaryBtn} 
            onPress={handlePublish}
            disabled={isSubmitting}
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

      {/* History Table */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Published Announcements</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.th, { flex: 2 }]}>TITLE</Text>
            <Text style={[styles.th, { flex: 1 }]}>CATEGORY</Text>
            <Text style={[styles.th, { flex: 1 }]}>PRIORITY</Text>
            <Text style={[styles.th, { flex: 1.5 }]}>DATE</Text>
            <Text style={[styles.th, { flex: 0.5, textAlign: 'right' }]}>ACTION</Text>
          </View>
          
          {loading ? (
            <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator size="large" color="#2E8B57" /></View>
          ) : announcements.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center' }}><Text style={{ color: '#6B7280' }}>No announcements published.</Text></View>
          ) : (
            announcements.map((row) => {
              const pColor = getPriorityColor(row.priority);
              const dateStr = row.createdAt?.toDate ? row.createdAt.toDate().toLocaleString() : 'Just now';
              
              return (
                <View key={row.id} style={styles.tableRow}>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.rowTitle}>{row.title}</Text>
                    <Text style={styles.rowDesc} numberOfLines={1}>{row.description}</Text>
                  </View>
                  <Text style={[styles.td, { flex: 1, color: '#4B5563' }]}>{row.category}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={[styles.badge, { backgroundColor: pColor.bg }]}>
                      <Text style={[styles.badgeText, { color: pColor.text }]}>{row.priority}</Text>
                    </View>
                  </View>
                  <Text style={[styles.td, { flex: 1.5, color: '#6B7280', fontSize: 13 }]}>{dateStr}</Text>
                  <View style={{ flex: 0.5, alignItems: 'flex-end' }}>
                    <TouchableOpacity onPress={() => handleDelete(row.id)}>
                      <MaterialIcons name="delete-outline" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 32 },
  headerSubtitle: { fontSize: 12, fontWeight: '700', color: '#6B7280', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#111827', marginBottom: 32 },
  
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 24, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardIcon: { marginRight: 4 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  
  formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
  formGroup: { width: '47%', marginBottom: 16 },
  label: { fontSize: 11, fontWeight: '700', color: '#374151', marginBottom: 8, letterSpacing: 0.5 },
  input: { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 14, fontSize: 14, color: '#111827', borderWidth: 1, borderColor: '#E5E7EB' },
  textArea: { minHeight: 100 },
  
  dropdown: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  dropdownText: { fontSize: 14, color: '#111827' },
  dropdownMenu: { position: 'absolute', top: 52, left: 0, right: 0, backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dropdownItemText: { fontSize: 14, fontWeight: '600' },
  
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 8, backgroundColor: '#2E8B57' },
  primaryBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  
  table: { marginTop: 8 },
  tableHead: { flexDirection: 'row', backgroundColor: '#F9FAFB', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, marginBottom: 8 },
  th: { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  td: { fontSize: 14 },
  
  rowTitle: { fontWeight: '700', color: '#111827', fontSize: 14, marginBottom: 4 },
  rowDesc: { color: '#6B7280', fontSize: 12 },
  
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
