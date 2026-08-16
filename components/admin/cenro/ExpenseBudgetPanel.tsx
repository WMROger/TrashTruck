import { MaterialIcons } from '@expo/vector-icons';
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { auth, db } from '@/config/firebase';
import { ExpenseRecord, validateExpenseBudget } from '@/services/budgetValidationService';
import { formatAdaptiveMassFromMetricTons } from '@/utils/wasteUnits';

type Props = { forecastTons: number; contingencyPercent: number };
const categories = ['Fuel', 'Labor', 'Maintenance', 'Disposal', 'Other'];
const currency = (value: number | null) => value === null ? '—' : `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ExpenseBudgetPanel({ forecastTons, contingencyPercent }: Props) {
  const now = new Date();
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [category, setCategory] = useState('Fuel');
  const [amount, setAmount] = useState('');
  const [tons, setTons] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const recordsRef = collection(db, 'analytics', 'expense_records', 'items');
    return onSnapshot(query(recordsRef, orderBy('period', 'desc')), snapshot => {
      setRecords(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as ExpenseRecord)));
      setLoading(false);
    }, error => {
      console.warn('Expense records could not be loaded:', error);
      setLoading(false);
    });
  }, []);

  const validation = useMemo(
    () => validateExpenseBudget(records, forecastTons, contingencyPercent),
    [contingencyPercent, forecastTons, records],
  );

  const saveRecord = async () => {
    const numericAmount = Number(amount);
    const numericTons = Number(tons);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      Alert.alert('Invalid period', 'Use YYYY-MM, for example 2026-08.');
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || !Number.isFinite(numericTons) || numericTons <= 0) {
      Alert.alert('Invalid actual record', 'Enter an expense amount and actual collected metric tons greater than zero.');
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, 'analytics', 'expense_records', 'items'), {
        period,
        category,
        amount: numericAmount,
        collectedTons: numericTons,
        notes: notes.trim(),
        createdAt: serverTimestamp(),
        createdByUid: auth.currentUser?.uid || null,
      });
      setAmount('');
      setTons('');
      setNotes('');
      Alert.alert('Actual expense saved', 'Budget validation has been recalculated from the approved records.');
    } catch (error) {
      console.error('Expense record save failed:', error);
      Alert.alert('Unable to save', 'The actual expense record could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const statusLabel = validation.status === 'backtested'
    ? 'BACKTESTED'
    : validation.status === 'needs-review' ? 'VARIANCE NEEDS REVIEW' : 'WAITING FOR 3 PERIODS';
  const statusColor = validation.status === 'backtested' ? '#166534' : validation.status === 'needs-review' ? '#B91C1C' : '#92400E';

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>ACTUAL EXPENSE VALIDATION / FEATURE 29</Text>
          <Text style={styles.title}>Expense-Based Budget Prediction</Text>
          <Text style={styles.subtitle}>Records approved monthly expenses and actual collected tonnage, backtests the rolling cost rate, then projects the validated baseline forecast.</Text>
        </View>
        <View style={[styles.statusBadge, { borderColor: `${statusColor}55`, backgroundColor: `${statusColor}10` }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      <View style={styles.metrics}>
        <View style={styles.metric}><Text style={styles.metricLabel}>ACTUAL PERIODS</Text><Text style={styles.metricValue}>{validation.periodCount}</Text></View>
        <View style={styles.metric}><Text style={styles.metricLabel}>ACTUAL TONNAGE</Text><Text style={styles.metricValue}>{formatAdaptiveMassFromMetricTons(validation.actualTonsTotal)}</Text></View>
        <View style={styles.metric}><Text style={styles.metricLabel}>WEIGHTED COST / TON</Text><Text style={styles.metricValue}>{currency(validation.weightedCostPerTon)}</Text></View>
        <View style={styles.metric}><Text style={styles.metricLabel}>BACKTEST MAPE</Text><Text style={styles.metricValue}>{validation.validationMapePercent === null ? '—' : `${validation.validationMapePercent}%`}</Text></View>
        <View style={[styles.metric, styles.projectionMetric]}><Text style={styles.metricLabel}>PROJECTED TOTAL</Text><Text style={[styles.metricValue, { color: '#166534' }]}>{currency(validation.projectedTotalCost)}</Text></View>
      </View>

      <View style={styles.form}>
        <TextInput style={styles.input} value={period} onChangeText={setPeriod} placeholder="YYYY-MM" maxLength={7} />
        <TextInput style={styles.input} value={amount} onChangeText={setAmount} placeholder="Actual expense (₱)" keyboardType="decimal-pad" />
        <TextInput style={styles.input} value={tons} onChangeText={setTons} placeholder="Actual tons collected" keyboardType="decimal-pad" />
        <TextInput style={[styles.input, { flex: 1.5 }]} value={notes} onChangeText={setNotes} placeholder="Reference or notes" />
      </View>
      <View style={styles.categoryRow}>
        {categories.map(item => (
          <TouchableOpacity key={item} style={[styles.categoryChip, category === item && styles.categoryChipActive]} onPress={() => setCategory(item)}>
            <Text style={[styles.categoryText, category === item && styles.categoryTextActive]}>{item}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.saveButton} onPress={saveRecord} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MaterialIcons name="add-chart" size={18} color="#FFFFFF" />}
          <Text style={styles.saveText}>Add Actual Record</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.recordsBox}>
        <Text style={styles.recordsTitle}>RECENT APPROVED COST RECORDS</Text>
        {loading ? <ActivityIndicator color="#2E8B57" style={{ marginVertical: 16 }} /> : records.length === 0 ? (
          <Text style={styles.emptyText}>No real expense records yet. Add the first approved period above; no sample costs are inserted.</Text>
        ) : records.slice(0, 6).map(record => (
          <View key={record.id} style={styles.recordRow}>
            <Text style={styles.recordPeriod}>{record.period}</Text>
            <Text style={styles.recordCategory}>{record.category}</Text>
            <Text style={styles.recordAmount}>{currency(record.amount)}</Text>
            <Text style={styles.recordTons}>{formatAdaptiveMassFromMetricTons(record.collectedTons)}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.disclaimer}>“Backtested” means the rolling cost model has at least three real periods and ≤20% MAPE. CENRO must still approve the records and planning decision.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 16, padding: 20, marginBottom: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  eyebrow: { color: '#15803D', fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginBottom: 5 },
  title: { color: '#111827', fontSize: 18, fontWeight: '900' },
  subtitle: { color: '#64748B', fontSize: 12, lineHeight: 18, marginTop: 5, maxWidth: 800 },
  statusBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  statusText: { fontSize: 9, fontWeight: '900' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  metric: { flex: 1, minWidth: 140, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 11, padding: 12 },
  projectionMetric: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  metricLabel: { color: '#64748B', fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  metricValue: { color: '#111827', fontSize: 15, fontWeight: '900', marginTop: 5 },
  form: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 16 },
  input: { flex: 1, minWidth: 140, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 9, paddingHorizontal: 11, paddingVertical: 10, color: '#0F172A' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 10 },
  categoryChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  categoryChipActive: { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' },
  categoryText: { color: '#64748B', fontSize: 10, fontWeight: '700' },
  categoryTextActive: { color: '#166534' },
  saveButton: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#15803D', borderRadius: 9, paddingHorizontal: 14, paddingVertical: 9 },
  saveText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  recordsBox: { backgroundColor: '#F8FAFC', borderRadius: 11, padding: 13, marginTop: 14 },
  recordsTitle: { color: '#475569', fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginBottom: 7 },
  emptyText: { color: '#64748B', fontSize: 11, lineHeight: 17, paddingVertical: 8 },
  recordRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  recordPeriod: { width: 70, color: '#0F172A', fontSize: 11, fontWeight: '800' },
  recordCategory: { flex: 1, color: '#475569', fontSize: 11 },
  recordAmount: { width: 110, textAlign: 'right', color: '#0F172A', fontSize: 11, fontWeight: '800' },
  recordTons: { width: 90, textAlign: 'right', color: '#64748B', fontSize: 10 },
  disclaimer: { color: '#64748B', fontSize: 10, lineHeight: 16, marginTop: 12 },
});
