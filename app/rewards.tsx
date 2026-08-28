import { useAuthContext } from '@/components/AuthContext';
import { db } from '@/config/firebase';
import { REWARD_SOUVENIRS } from '@/services/rewardService';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type AwardEntry = { id: string; tokens: number; reportId: string; awardedAt?: any };
type RedemptionEntry = { id: string; cost: number; souvenirName: string; issuedAt?: any };

const dateLabel = (value: any) => {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString() : 'Processing';
};

export default function ResidentRewardsPage() {
  const router = useRouter();
  const { user } = useAuthContext();
  const [awards, setAwards] = useState<AwardEntry[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionEntry[]>([]);
  const [catalogItems, setCatalogItems] = useState(REWARD_SOUVENIRS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    const unsubscribeCatalog = onSnapshot(collection(db, 'reward_catalog'), (snapshot) => {
      if (!snapshot.empty) {
        const customItems = snapshot.docs.map((d) => ({
          id: d.id,
          name: d.data().name || 'Souvenir',
          type: d.data().type || '',
          cost: Number(d.data().cost || 0),
          category: d.data().category || 'General',
        }));
        // Merge custom items with defaults without duplicate IDs
        const existingIds = new Set(customItems.map((i) => i.id));
        const merged = [...customItems, ...REWARD_SOUVENIRS.filter((i) => !existingIds.has(i.id))];
        setCatalogItems(merged);
      } else {
        setCatalogItems(REWARD_SOUVENIRS);
      }
    });

    if (!user?.uid) {
      setLoading(false);
      return () => unsubscribeCatalog();
    }

    let loadedAwards = false;
    let loadedRedemptions = false;
    const finish = () => {
      if (loadedAwards && loadedRedemptions) setLoading(false);
    };

    const unsubscribeAwards = onSnapshot(
      query(collection(db, 'reward_awards'), where('userId', '==', user.uid)),
      snapshot => {
        setAwards(snapshot.docs.map(item => ({
          id: item.id,
          tokens: Math.max(0, Number(item.data().tokens || 0)),
          reportId: String(item.data().reportId || ''),
          awardedAt: item.data().awardedAt,
        })));
        loadedAwards = true;
        finish();
      },
      () => { loadedAwards = true; finish(); },
    );
    const unsubscribeRedemptions = onSnapshot(
      query(collection(db, 'reward_redemptions'), where('userId', '==', user.uid)),
      snapshot => {
        setRedemptions(snapshot.docs.map(item => ({
          id: item.id,
          cost: Math.max(0, Number(item.data().cost || 0)),
          souvenirName: String(item.data().souvenirName || 'Souvenir'),
          issuedAt: item.data().issuedAt,
        })));
        loadedRedemptions = true;
        finish();
      },
      () => { loadedRedemptions = true; finish(); },
    );
    return () => { unsubscribeCatalog(); unsubscribeAwards(); unsubscribeRedemptions(); };
  }, [user?.uid]);

  const earned = useMemo(() => awards.reduce((sum, item) => sum + item.tokens, 0), [awards]);
  const spent = useMemo(() => redemptions.reduce((sum, item) => sum + item.cost, 0), [redemptions]);
  const balance = Math.max(0, earned - spent);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#1F4D35" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>TRASHTRACK REWARDS</Text>
          <Text style={styles.title}>My Eco Tokens</Text>
        </View>
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 60 }} size="large" color="#2E7D32" /> : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>AVAILABLE BALANCE</Text>
            <Text style={styles.balanceValue}>{balance.toLocaleString()}</Text>
            <Text style={styles.balanceUnit}>eco tokens</Text>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceMeta}>Earned {earned.toLocaleString()}</Text>
              <Text style={styles.balanceMeta}>Redeemed {spent.toLocaleString()}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Souvenir catalog</Text>
          <Text style={styles.sectionHelp}>No online payment is required. Bring your registered account email to the CENRO/CICTO desk; authorized staff verify your balance and record the release.</Text>
          {catalogItems.map(item => {
            const eligible = balance >= item.cost;
            return (
              <View key={item.id} style={styles.catalogCard}>
                <View style={styles.giftIcon}><MaterialIcons name="card-giftcard" size={24} color="#2E7D32" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemType}>{item.type}</Text>
                </View>
                <View style={[styles.costBadge, eligible && styles.costBadgeReady]}>
                  <Text style={[styles.costText, eligible && styles.costTextReady]}>{item.cost.toLocaleString()}</Text>
                  <Text style={[styles.costUnit, eligible && styles.costTextReady]}>{eligible ? 'ELIGIBLE' : 'TOKENS'}</Text>
                </View>
              </View>
            );
          })}

          <Text style={styles.sectionTitle}>Verified activity</Text>
          {awards.length === 0 && redemptions.length === 0 ? (
            <View style={styles.emptyCard}>
              <MaterialIcons name="eco" size={34} color="#86A88F" />
              <Text style={styles.emptyTitle}>No reward activity yet</Text>
              <Text style={styles.emptyText}>A verified completed pickup earns 50 tokens automatically.</Text>
            </View>
          ) : (
            <>
              {awards.map(item => (
                <View key={item.id} style={styles.activityRow}>
                  <MaterialIcons name="add-circle" size={22} color="#15803D" />
                  <View style={{ flex: 1 }}><Text style={styles.activityTitle}>Verified pickup reward</Text><Text style={styles.activityMeta}>{dateLabel(item.awardedAt)} · Report {item.reportId || 'record'}</Text></View>
                  <Text style={styles.earned}>+{item.tokens}</Text>
                </View>
              ))}
              {redemptions.map(item => (
                <View key={item.id} style={styles.activityRow}>
                  <MaterialIcons name="redeem" size={22} color="#B45309" />
                  <View style={{ flex: 1 }}><Text style={styles.activityTitle}>{item.souvenirName}</Text><Text style={styles.activityMeta}>{dateLabel(item.issuedAt)} · Issued by authorized staff</Text></View>
                  <Text style={styles.spent}>-{item.cost}</Text>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F2F8F1' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 54, paddingBottom: 18, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#DCE8DD' },
  back: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: '#6A8A70', fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  title: { color: '#183E2A', fontSize: 24, fontWeight: '800', marginTop: 2 },
  content: { padding: 20, paddingBottom: 44 },
  balanceCard: { borderRadius: 22, backgroundColor: '#205A3A', padding: 24, alignItems: 'center', shadowColor: '#0F2F20', shadowOpacity: 0.18, shadowRadius: 12, elevation: 5 },
  balanceLabel: { color: '#BDE8C7', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  balanceValue: { color: '#FFFFFF', fontSize: 46, fontWeight: '900', marginTop: 5 },
  balanceUnit: { color: '#D9F4DE', fontSize: 13, marginTop: -3 },
  balanceRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', marginTop: 20, paddingTop: 14 },
  balanceMeta: { color: '#E7F7EA', fontSize: 12, fontWeight: '700' },
  sectionTitle: { color: '#183E2A', fontSize: 18, fontWeight: '800', marginTop: 26, marginBottom: 7 },
  sectionHelp: { color: '#607366', fontSize: 12, lineHeight: 18, marginBottom: 12 },
  catalogCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8DD', borderRadius: 16, padding: 14, marginBottom: 10 },
  giftIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' },
  itemName: { color: '#22372A', fontSize: 14, fontWeight: '800' },
  itemType: { color: '#758078', fontSize: 10, lineHeight: 14, marginTop: 3 },
  costBadge: { minWidth: 68, alignItems: 'center', borderRadius: 12, backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 8 },
  costBadgeReady: { backgroundColor: '#DCFCE7' },
  costText: { color: '#4B5563', fontSize: 14, fontWeight: '900' },
  costUnit: { color: '#6B7280', fontSize: 8, fontWeight: '800' },
  costTextReady: { color: '#166534' },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E4ECE5' },
  activityTitle: { color: '#263A2C', fontSize: 13, fontWeight: '800' },
  activityMeta: { color: '#7A857D', fontSize: 10, marginTop: 3 },
  earned: { color: '#15803D', fontSize: 15, fontWeight: '900' },
  spent: { color: '#B45309', fontSize: 15, fontWeight: '900' },
  emptyCard: { alignItems: 'center', borderRadius: 16, padding: 28, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8DD' },
  emptyTitle: { color: '#33483A', fontSize: 14, fontWeight: '800', marginTop: 8 },
  emptyText: { color: '#748078', fontSize: 11, textAlign: 'center', marginTop: 5 },
});
