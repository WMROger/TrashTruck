import { MaterialIcons } from '@expo/vector-icons';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { db } from '@/config/firebase';

type Command = {
  id: string;
  subject: string;
  message: string;
  priority: 'normal' | 'high' | 'urgent';
  createdAt?: any;
};

export default function DictCommandsTab() {
  const [commands, setCommands] = useState<Command[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!db) return;
    return onSnapshot(
      query(collection(db, 'interagency_messages'), orderBy('createdAt', 'desc'), limit(100)),
      snapshot => {
        setCommands(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Command)));
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, []);

  return <ScrollView style={styles.container} contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>INTER-AGENCY COMMUNICATION</Text>
    <Text style={styles.title}>DICT Commands</Text>
    <Text style={styles.subtitle}>Operational advisories sent by the DICT oversight portal appear here in real time.</Text>
    {loading ? <ActivityIndicator size="large" color="#4F46E5" /> : !commands.length ? (
      <View style={styles.empty}><MaterialIcons name="inbox" size={42} color="#94A3B8" /><Text style={styles.emptyTitle}>No DICT commands yet</Text></View>
    ) : commands.map(command => <View key={command.id} style={styles.card}>
      <View style={[styles.bar, { backgroundColor: command.priority === 'urgent' ? '#DC2626' : command.priority === 'high' ? '#D97706' : '#4F46E5' }]} />
      <View style={styles.body}>
        <View style={styles.row}><Text style={styles.subject}>{command.subject}</Text><Text style={styles.priority}>{command.priority.toUpperCase()}</Text></View>
        <Text style={styles.message}>{command.message}</Text>
        <Text style={styles.date}>{command.createdAt?.toDate ? command.createdAt.toDate().toLocaleString() : 'Sending…'}</Text>
      </View>
    </View>)}
  </ScrollView>;
}

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#F8FAFC'},content:{padding:28},eyebrow:{fontSize:10,fontWeight:'900',color:'#4F46E5',letterSpacing:1.1},title:{fontSize:26,fontWeight:'900',color:'#0F172A',marginTop:5},subtitle:{fontSize:12,color:'#64748B',marginTop:5,marginBottom:22},empty:{backgroundColor:'#FFF',borderWidth:1,borderColor:'#E2E8F0',borderRadius:14,padding:40,alignItems:'center'},emptyTitle:{fontSize:14,fontWeight:'800',color:'#475569',marginTop:10},card:{flexDirection:'row',backgroundColor:'#FFF',borderWidth:1,borderColor:'#E2E8F0',borderRadius:13,overflow:'hidden',marginBottom:12},bar:{width:6},body:{flex:1,padding:16},row:{flexDirection:'row',justifyContent:'space-between',gap:12},subject:{fontSize:14,fontWeight:'900',color:'#0F172A',flex:1},priority:{fontSize:9,fontWeight:'900',color:'#64748B'},message:{fontSize:12,color:'#475569',lineHeight:19,marginTop:8},date:{fontSize:9,color:'#94A3B8',marginTop:9},
});
