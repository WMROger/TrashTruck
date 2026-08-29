import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  collection,
  query,
  getDocs,
  orderBy,
  limit,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '@/config/firebase';

export default function RewardsTab() {
  const [loading, setLoading] = useState(true);
  const [awards, setAwards] = useState<any[]>([]);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'awards' | 'redemptions'>('all');

  const loadData = async () => {
    if (!db) return;
    setLoading(true);
    try {
      const [awardSnap, redempSnap] = await Promise.all([
        getDocs(query(collection(db, 'reward_awards'), limit(50))),
        getDocs(query(collection(db, 'reward_redemptions'), limit(50))),
      ]);

      setAwards(awardSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setRedemptions(redempSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.warn('Error loading rewards data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>CICTO / REWARDS RECONCILIATION</Text>
          <Text style={styles.title}>Token Ledger & Redemptions</Text>
          <Text style={styles.sub}>
            Audit trail of token distributions, eco-points awards, and souvenir redemptions.
          </Text>
        </View>
        <TouchableOpacity style={styles.refresh} onPress={loadData} activeOpacity={0.7} accessibilityLabel="Refresh">
          <MaterialIcons name="refresh" size={20} color="#0D9488" />
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>TOTAL AWARDS</Text>
          <Text style={[styles.statValue, { color: '#0D9488' }]}>{awards.length}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>TOTAL REDEMPTIONS</Text>
          <Text style={[styles.statValue, { color: '#D97706' }]}>{redemptions.length}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Reward Transactions</Text>
        {loading ? (
          <ActivityIndicator size="large" color="#0D9488" style={{ marginVertical: 20 }} />
        ) : awards.length === 0 && redemptions.length === 0 ? (
          <Text style={styles.emptyText}>No reward transactions recorded yet.</Text>
        ) : (
          <View style={styles.list}>
            {awards.map((a) => (
              <View key={a.id} style={styles.txRow}>
                <MaterialIcons name="add-circle" size={20} color="#0D9488" />
                <View style={styles.txInfo}>
                  <Text style={styles.txTitle}>Tokens Awarded: +{a.tokens || 50}</Text>
                  <Text style={styles.txSub}>Reason: {a.reason || 'Verified Pickup'}</Text>
                </View>
                <Text style={styles.txBadgeAward}>AWARD</Text>
              </View>
            ))}
            {redemptions.map((r) => (
              <View key={r.id} style={styles.txRow}>
                <MaterialIcons name="redeem" size={20} color="#D97706" />
                <View style={styles.txInfo}>
                  <Text style={styles.txTitle}>Redeemed: {r.souvenirName || 'Souvenir'}</Text>
                  <Text style={styles.txSub}>Cost: -{r.cost || 500} pts</Text>
                </View>
                <Text style={styles.txBadgeRedeem}>REDEEMED</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 28 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 22,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0D9488',
    letterSpacing: 1.1,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 5,
  },
  sub: { fontSize: 12, color: '#64748B', marginTop: 5 },
  refresh: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 18,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '900',
    marginTop: 6,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 14,
  },
  list: {
    gap: 10,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    gap: 12,
  },
  txInfo: {
    flex: 1,
  },
  txTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  txSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  txBadgeAward: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0D9488',
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  txBadgeRedeem: {
    fontSize: 10,
    fontWeight: '900',
    color: '#D97706',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  emptyText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    paddingVertical: 12,
  },
});
