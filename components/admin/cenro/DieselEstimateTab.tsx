import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { calculateDiesel, DieselActual, DieselInputs, DieselModel, DieselParameters, DieselPlan, dieselSavings } from '@/services/dieselMath';
import { applicableDieselFactor, DEFAULT_DIESEL_SETTINGS, DieselLog, DieselSchedule, DieselSettings, loadDieselGps, makeDieselPlan,
  parametersForTruck, reviewDieselLog, saveDieselPlan, saveDieselSettings, submitDieselActual, trainTruckDiesel } from '@/services/dieselService';
import { exportDieselCsv, printDieselReport } from '@/services/dieselReports';
import { optimizeBarangayRouteWithTraffic } from '@/services/trafficAwareOptimizerService';

import { DANAO_CITY_BARANGAYS } from '@/constants/danaoBarangays';

type Props = { userRole?: string; assignedBarangay?: string };
type Form = Record<string, string>;
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
const inputLabels: Record<keyof DieselInputs, string> = { distanceKm: 'Distance (km)', drivingHours: 'Driving hours', idleHours: 'Idle hours', collectionHours: 'Collection hours', averageLoadPercent: 'Average load (%)' };
const parameterLabels: Record<keyof DieselParameters, string> = { pricePerLiter: 'CENRO supply price (PHP/L)', kmPerLiter: 'Driving efficiency (km/L)', idleLitersPerHour: 'Idle consumption (L/hour)',
  collectionLitersPerHour: 'Collection / compactor consumption (L/hour)', fullLoadPenaltyPercent: 'Extra driving fuel at full load (%)', averageLoadPercent: 'Average load (%)', minutesPerStop: 'Collection minutes per stop' };
const stringify = (object: object): Form => Object.fromEntries(Object.entries(object).map(([k, v]) => [k, v == null ? '' : String(v)]));
const num = (value: string, label: string) => { if (!value?.trim() || !Number.isFinite(Number(value))) throw new Error('Enter ' + label + '.'); return Number(value); };
const parseInputs = (form: Form): DieselInputs => Object.fromEntries(Object.entries(inputLabels).map(([key, label]) => [key, num(form[key], label)])) as DieselInputs;
const fmt = (n: number | null | undefined, suffix = '') => n == null ? 'Not recorded' : n.toLocaleString('en-PH', { maximumFractionDigits: 2 }) + suffix;
const money = (n: number | null | undefined) => n == null ? 'Price not configured' : '₱' + fmt(n);
const emptyActual = (): Form => ({ tripDate: today(), distanceKm: '', drivingHours: '', idleHours: '0', collectionHours: '0', averageLoadPercent: '50',
  collectedKg: '', actualLiters: '', evidence: '', distanceSource: 'manual', fuelMethod: 'not-recorded', isDemo: 'true' });
function Field({ label, value, onChange, text = false, disabled = false }: { label: string; value: string; onChange: (s: string) => void; text?: boolean; disabled?: boolean }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} style={[styles.input, disabled && styles.disabled]}
    value={value || ''} onChangeText={onChange} editable={!disabled} keyboardType={text ? 'default' : 'decimal-pad'} placeholderTextColor="#94A3B8" /></View>;
}
function Button({ label, onPress, disabled = false, secondary = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <TouchableOpacity accessibilityRole="button" onPress={onPress} disabled={disabled} style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, secondary && { color: '#166534' }]}>{label}</Text></TouchableOpacity>;
}
export default function DieselEstimateTab({ userRole = 'admin', assignedBarangay = '' }: Props) {
  const driver = userRole === 'driver', coordinator = userRole === 'coordinator', manager = !driver && !coordinator;
  const uid = auth.currentUser?.uid || '';
  const [selectedBarangayFallback, setSelectedBarangayFallback] = useState<string>(assignedBarangay || 'Suba');
  const effectiveBarangay = assignedBarangay || selectedBarangayFallback;
  const [settings, setSettings] = useState<DieselSettings>(DEFAULT_DIESEL_SETTINGS);
  const [schedules, setSchedules] = useState<DieselSchedule[]>([]), [logs, setLogs] = useState<DieselLog[]>([]);
  const [driverNames, setDriverNames] = useState<Record<string, string>>({});
  const [plans, setPlans] = useState<Record<string, DieselPlan>>({});
  const [selectedId, setSelectedId] = useState(''), [tab, setTab] = useState(manager ? 'estimate' : 'actual');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false), [profileScope, setProfileScope] = useState('fleet');
  const [parameterForm, setParameterForm] = useState<Form>({}), [sourceForm, setSourceForm] = useState<Form>({});
  const [baselineForm, setBaselineForm] = useState<Form>({}), [optimizedForm, setOptimizedForm] = useState<Form>({});
  const [actualForm, setActualForm] = useState<Form>(emptyActual), [model, setModel] = useState<DieselModel | null>(null);
  const [reviewNote, setReviewNote] = useState(''), [filter, setFilter] = useState(''), [month, setMonth] = useState(''), [gpsNote, setGpsNote] = useState('');
  const selected = schedules.find(s => s.id === selectedId), currentLog = logs.find(l => l.scheduleId === selectedId);
  const savedPlan = plans[selectedId] || selected?.routeOptimization?.dieselEstimate;
  const p = useMemo(() => parametersForTruck(settings, selected?.truckId), [settings, selected?.truckId]);
  const locked = currentLog?.status === 'approved', draftKey = 'trashtrack.diesel.draft.' + uid + '.' + selectedId;

  useEffect(() => {
    if (!uid) { setLoading(false); setError('A signed-in account is required.'); return; }
    const failed = (e: Error) => { setError('Unable to load diesel data: ' + e.message); setLoading(false); };
    const scoped = (name: string, driverKey = 'driverId') => driver ? query(collection(db, name), where(driverKey, '==', uid))
      : coordinator ? query(collection(db, name), where('barangay', '==', effectiveBarangay)) : query(collection(db, name));
    const unsubs = [
      onSnapshot(doc(db, 'diesel_settings', 'main'), snap => setSettings(snap.exists() ? { ...DEFAULT_DIESEL_SETTINGS, ...snap.data() } as DieselSettings : DEFAULT_DIESEL_SETTINGS), failed),
      onSnapshot(scoped('schedules', 'assignedDriverId'), snap => {
        setSchedules(snap.docs.map(s => {
          const d = s.data();
          return {
            id: s.id,
            ...d,
            driver: d.driver || d.driverName || d.assignedDriverName || '',
          } as DieselSchedule;
        }).filter(s => s.truckId && s.assignedDriverId && s.barangay && s.isLiveDispatch));
        setLoading(false);
      }, failed),
      onSnapshot(scoped('diesel_logs'), snap => setLogs(snap.docs.map(s => ({ id: s.id, ...s.data() } as DieselLog))), failed),
      onSnapshot(scoped('diesel_estimates'), snap => setPlans(Object.fromEntries(snap.docs.map(s => [s.id, s.data().plan as DieselPlan]))), failed),
    ];
    return () => unsubs.forEach(unsub => unsub());
  }, [uid, driver, coordinator, effectiveBarangay]);

  // Resolve human driver names for assignedDriverId from users collection or trucks collection
  useEffect(() => {
    if (!schedules.length || !db) return;
    const missingDriverIds = Array.from(
      new Set(
        schedules
          .map(s => s.assignedDriverId)
          .filter(id => id && !driverNames[id])
      )
    );
    if (!missingDriverIds.length) return;

    let isMounted = true;
    const fetchDriverNames = async () => {
      const updates: Record<string, string> = {};
      await Promise.all(
        missingDriverIds.map(async (driverId) => {
          try {
            const userSnap = await getDoc(doc(db, 'users', driverId));
            if (userSnap.exists()) {
              const u = userSnap.data();
              const resolved =
                u.displayName ||
                u.fullName ||
                [u.firstName, u.lastName].filter(Boolean).join(' ') ||
                u.name ||
                u.driverName ||
                (u.email ? u.email.split('@')[0] : '');
              if (resolved) {
                updates[driverId] = resolved;
                console.log('DieselEstimateTab: Resolved driver from user profile:', driverId, '->', resolved);
              }
            }
          } catch (err) {
            console.warn('DieselEstimateTab: Could not fetch driver name from users for', driverId, err);
          }

          // Fallback: check truck document if driver name still unresolved
          if (!updates[driverId]) {
            const matchingSchedule = schedules.find(s => s.assignedDriverId === driverId);
            if (matchingSchedule?.truckId) {
              try {
                const truckSnap = await getDoc(doc(db, 'trucks', matchingSchedule.truckId));
                if (truckSnap.exists()) {
                  const t = truckSnap.data();
                  const fromTruck = t.assignedDriverName || t.driverName || t.driver || '';
                  if (fromTruck) {
                    updates[driverId] = fromTruck;
                    console.log('DieselEstimateTab: Resolved driver from truck assignment:', driverId, '->', fromTruck);
                  }
                }
              } catch (truckErr) {
                console.warn('DieselEstimateTab: Could not fetch driver name from truck for', driverId, truckErr);
              }
            }
          }
        })
      );
      if (isMounted && Object.keys(updates).length > 0) {
        setDriverNames(prev => ({ ...prev, ...updates }));
      }
    };

    fetchDriverNames();
    return () => { isMounted = false; };
  }, [schedules, driverNames]);

  const getDriverName = (s?: DieselSchedule | null): string => {
    if (!s) return 'Assigned Driver';
    const isUid = (str?: string) => Boolean(str && /^[a-zA-Z0-9_-]{20,}$/.test(str.trim()));
    const rawDriver = s.assignedDriverName || s.driverName || s.driver;
    if (rawDriver && !isUid(rawDriver)) {
      return rawDriver;
    }
    if (s.assignedDriverId && driverNames[s.assignedDriverId]) {
      return driverNames[s.assignedDriverId];
    }
    if (rawDriver && isUid(rawDriver) && driverNames[rawDriver]) {
      return driverNames[rawDriver];
    }
    return rawDriver && !isUid(rawDriver) ? rawDriver : (s.assignedDriverId && driverNames[s.assignedDriverId]) || 'Assigned Driver';
  };
  useEffect(() => { if (!selectedId && schedules.length) setSelectedId(schedules[schedules.length - 1].id); }, [schedules, selectedId]);
  useEffect(() => {
    setParameterForm(stringify(profileScope === 'truck' ? p : settings.parameters));
    setSourceForm({ priceDate: settings.priceDate || today(), priceSource: settings.priceSource, parameterSource: settings.parameterSource });
  }, [settings, p, profileScope]);
  useEffect(() => {
    if (!selected) return;
    const demo = optimizeBarangayRouteWithTraffic(selected.barangay);
    const count = selected.stops?.filter(s => s.type !== 'depot' && s.type !== 'transfer_station').length ?? Math.max(0, demo.optimizedStops.length - 2);
    const plan = savedPlan || makeDieselPlan(selected.routeOptimization?.baselineDistanceKm ?? demo.baselineDistanceKm,
      selected.routeOptimization?.optimizedDistanceKm ?? demo.optimizedDistanceKm, count, p, settings.parameterSource);
    setBaselineForm(stringify(plan.baselineInputs)); setOptimizedForm(stringify(plan.optimizedInputs));
  }, [selected, savedPlan, p, settings.parameterSource]);
  useEffect(() => {
    let active = true;
    setActualForm(currentLog ? stringify(currentLog.actual) : emptyActual()); setGpsNote(''); setReviewNote(currentLog?.reviewNote || '');
    if (!currentLog && selectedId) AsyncStorage.getItem(draftKey).then(raw => { if (active && raw) { setActualForm(JSON.parse(raw)); setMessage('Trip draft restored from this device.'); } }).catch(() => undefined);
    return () => { active = false; };
  }, [selectedId, currentLog, draftKey]);
  useEffect(() => {
    setModel(null);
    if (!selected?.truckId) { setModel(null); return; }
    return onSnapshot(doc(db, 'diesel_models', selected.truckId), snap => setModel(snap.exists() ? snap.data() as DieselModel : null), e => setError(e.message));
  }, [selected?.truckId]);
  const preview = useMemo(() => {
    if (savedPlan) return { plan: savedPlan, error: '' };
    if (!selected) return { plan: null, error: '' };
    try {
      const baselineInputs = parseInputs(baselineForm), optimizedInputs = parseInputs(optimizedForm), factor = applicableDieselFactor(model, p);
      const plan: DieselPlan = { version: 1, savedAt: new Date().toISOString(), parameters: p,
        parameterSource: settings.parameterSource + '; ' + settings.priceSource + '; price effective ' + (settings.priceDate || 'not configured'),
        distanceSource: 'Demo route / editable planning inputs; not measured GPS', baselineInputs, optimizedInputs,
        baseline: calculateDiesel(baselineInputs, p, factor), optimized: calculateDiesel(optimizedInputs, p, factor), modelId: factor !== 1 ? model?.id || null : null };
      return { plan, error: '' };
    } catch (e) { return { plan: null, error: (e as Error).message }; }
  }, [savedPlan, selected, baselineForm, optimizedForm, model, p, settings]);
  const plan = preview.plan, savings = plan ? dieselSavings(plan.baseline, plan.optimized) : null;
  const filtered = schedules.filter(s => ((s.truckPlate || s.truckId) + ' ' + s.barangay + ' ' + getDriverName(s) + ' ' + s.id).toLowerCase().includes(filter.toLowerCase())
    && (!month || (logs.find(l => l.scheduleId === s.id)?.actual.tripDate || '').startsWith(month)));
  const run = async (action: () => Promise<void> | void) => { setBusy(true); setError(''); setMessage(''); try { await action(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  const saveParameters = () => run(async () => {
    const values = Object.fromEntries(Object.entries(parameterLabels).map(([key, label]) => [key, num(parameterForm[key], label)])) as DieselParameters;
    const next = { ...settings, priceDate: sourceForm.priceDate, priceSource: sourceForm.priceSource, parameterSource: sourceForm.parameterSource,
      parameters: profileScope === 'fleet' ? values : { ...settings.parameters, pricePerLiter: values.pricePerLiter } };
    if (profileScope === 'truck' && selected) { const { pricePerLiter: _price, ...physical } = values; next.profiles = { ...settings.profiles, [selected.truckId]: physical }; }
    await saveDieselSettings(next); setMessage('Price and assumptions saved. Existing estimates retain their original parameters.');
  });
  const submitActual = () => run(async () => {
    if (!selected) return;
    await AsyncStorage.setItem(draftKey, JSON.stringify(actualForm));
    const actual: DieselActual = { ...parseInputs(actualForm), tripDate: actualForm.tripDate, collectedKg: num(actualForm.collectedKg, 'collected weight'),
      actualLiters: actualForm.actualLiters.trim() ? num(actualForm.actualLiters, 'actual liters') : null,
      distanceSource: actualForm.distanceSource as DieselActual['distanceSource'], fuelMethod: actualForm.fuelMethod as DieselActual['fuelMethod'], evidence: actualForm.evidence, isDemo: actualForm.isDemo === 'true' };
    await submitDieselActual(selected, actual); await AsyncStorage.removeItem(draftKey);
    setMessage('Trip submitted for CENRO review. Only approved real measurements can contribute to learning.');
  });
  const importGps = () => run(async () => {
    if (!selected) return;
    const summary = await loadDieselGps(selected);
    setGpsNote(summary.accepted + ' valid points; ' + summary.gaps + ' gaps over 5 minutes; ' + summary.rejected + ' rejected points. Missing sections can undercount distance.');
    if (summary.accepted < 2) throw new Error('No usable real GPS trail for this trip. Use an odometer difference, or manual distance for the demo.');
    setActualForm(f => ({ ...f, distanceKm: String(summary.distanceKm), distanceSource: 'gps' }));
  });
  const fields = (labels: Record<string, string>, form: Form, setter: React.Dispatch<React.SetStateAction<Form>>, disabled = false, prefix = '') =>
    Object.entries(labels).map(([key, label]) => <Field key={key} label={prefix + label} value={form[key]} disabled={disabled}
      onChange={value => setter(f => ({ ...f, [key]: value, ...(key === 'distanceKm' && f.distanceSource === 'gps' ? { distanceSource: 'manual' } : {}) }))} />);

  if (loading) return <ActivityIndicator accessibilityLabel="Loading diesel module" style={{ padding: 40 }} color="#166534" />;
  return <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><View style={{ flex: 1 }}>
      <Text style={styles.eyebrow}>
        {coordinator ? 'TRASHTRACK · BARANGAY FIELD STEWARD' : manager ? 'TRASHTRACK · FLEET OPERATIONS' : 'TRASHTRACK · DRIVER OPERATIONS'}
      </Text>
      <Text style={styles.title}>
        {coordinator ? 'Trip & Diesel Log (Driver Assisted)' : manager ? 'Diesel Estimate' : 'Trip & Diesel Log'}
      </Text>
      <Text style={styles.subtitle}>
        {coordinator ? `Record end-of-shift trip distance, hours, and diesel consumption on behalf of drivers in Barangay ${effectiveBarangay}.` : manager ? 'Plan diesel use, review trip results, and learn from measured consumption.' : 'After your shift, record each completed trip separately.'}
      </Text></View>
      {manager && <Button label={settingsOpen ? 'Close parameters' : 'Supply price & parameters'} onPress={() => setSettingsOpen(!settingsOpen)} secondary />}</View>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}{!!message && <Text accessibilityLiveRegion="polite" style={styles.success}>{message}</Text>}
    {coordinator && !assignedBarangay && <View style={[styles.card, { borderColor: '#10B981', backgroundColor: '#F0FDF4' }]}>
      <Text style={[styles.label, { color: '#047857' }]}>Field Barangay Selection</Text>
      <Text style={styles.subtitle}>Choose the barangay whose driver trips you are assisting with:</Text>
      <Picker selectedValue={selectedBarangayFallback} onValueChange={async (val) => {
        setSelectedBarangayFallback(val);
        if (uid) {
          try {
            const { doc, setDoc } = await import('firebase/firestore');
            await setDoc(doc(db, 'users', uid), { assignedBarangay: val, barangay: val }, { merge: true });
          } catch (e) {
            console.warn('Could not auto-save barangay:', e);
          }
        }
      }} style={styles.picker}>
        {DANAO_CITY_BARANGAYS.map(b => <Picker.Item key={b} label={`Brgy. ${b}`} value={b} />)}
      </Picker>
    </View>}
    <View style={styles.banner}><Text style={styles.bannerText}>Demo routes are in use. GPS measures distance, not diesel. Supply price: {settings.parameters.pricePerLiter > 0 ? money(settings.parameters.pricePerLiter) + '/L · ' + settings.priceDate : 'Not configured'}.</Text></View>
    {manager && settingsOpen && <View style={styles.card}><Text style={styles.heading}>CENRO supply price & truck assumptions</Text><Text style={styles.subtitle}>Initial rates are demonstration assumptions. The supply price applies fleet-wide; physical parameters can be set per truck.</Text>
      <Picker accessibilityLabel="Parameter scope" selectedValue={profileScope} onValueChange={setProfileScope} style={styles.picker}><Picker.Item label="Fleet defaults" value="fleet" />{selected && <Picker.Item label={'Selected truck: ' + (selected.truckPlate || selected.truckId)} value="truck" />}</Picker>
      <View style={styles.grid}>{fields(parameterLabels, parameterForm, setParameterForm)}
        {Object.entries({ priceDate: 'Price effective date (YYYY-MM-DD)', priceSource: 'Supply source / batch reference', parameterSource: 'Parameter source / assumption notes' }).map(([key, label]) =>
          <Field key={key} label={label} text value={sourceForm[key]} onChange={value => setSourceForm(f => ({ ...f, [key]: value }))} />)}</View>
      <Button label="Save price & parameters" onPress={saveParameters} disabled={busy} /></View>}
    <View style={styles.card}><Text style={styles.label}>{coordinator ? 'Assigned collection trip (Driver Assisted)' : 'Assigned collection trip'}</Text><Picker accessibilityLabel="Select collection trip" selectedValue={selectedId} onValueChange={id => { setSelectedId(id); setMessage(''); setError(''); }} style={styles.picker}>
      <Picker.Item label="Select a trip to log" value="" />{schedules.map(s => <Picker.Item key={s.id} value={s.id} label={`${s.dateText || 'Today'} · Driver: ${getDriverName(s)} · Truck: ${s.truckPlate || s.truckId} · ${s.barangay}`} />)}</Picker>
      {!schedules.length && <Text style={styles.subtitle}>No assigned master collection trips found for Barangay {effectiveBarangay}. Dispatch a route with an assigned truck to create one.</Text>}
      {selected && <View style={styles.assistedBadge}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontWeight: '700', color: '#166534', fontSize: 13 }}>
            {coordinator ? '🤝 ASSISTING DRIVER' : 'ASSIGNED DRIVER'}:
          </Text>
          <Text style={{ color: '#1B3625', fontSize: 14, fontWeight: '700' }}>
            {getDriverName(selected)}
          </Text>
        </View>
        <Text style={{ color: '#4B6354', fontSize: 12, marginTop: 4 }}>
          Truck: {selected.truckPlate || selected.truckId} · Barangay: {selected.barangay} · Master Trip #{selected.id.slice(-6)}
        </Text>
        {coordinator && <Text style={{ color: '#047857', fontSize: 11, fontWeight: '600', marginTop: 4 }}>
          ℹ️ You are submitting this trip log on behalf of the driver.
        </Text>}
      </View>}</View>
    <View style={styles.tabs}>{[['estimate', 'Estimate & calculation'], ['actual', 'End-of-shift entry'], ['records', 'Monitoring & reports']].map(([key, label]) =>
      <TouchableOpacity accessibilityRole="tab" accessibilityState={{ selected: tab === key }} key={key} onPress={() => setTab(key)} style={[styles.tab, tab === key && styles.activeTab]}><Text style={[styles.tabText, tab === key && { color: '#fff' }]}>{label}</Text></TouchableOpacity>)}</View>
    {tab === 'estimate' && selected && <View style={styles.card}><Text style={styles.heading}>{savedPlan ? 'Saved trip estimate' : 'Route planning estimate'}</Text>
      <Text style={styles.subtitle}>{savedPlan ? 'Saved ' + new Date(savedPlan.savedAt).toLocaleString() + '. Original parameters and price are preserved.' : 'No estimate saved yet. Estimates created after a trip are retrospective.'}</Text>
      {!!selected.routeOptimization?.lastReplannedAt && <Text style={styles.bannerText}>This route was changed after dispatch. The saved estimate remains the original comparison point.</Text>}
      <View style={styles.columns}><View style={styles.column}><Text style={styles.heading}>Usual route</Text>{fields(inputLabels, baselineForm, setBaselineForm, !!savedPlan || !manager, 'Usual · ')}</View>
        <View style={styles.column}><Text style={styles.heading}>Optimized route</Text>{fields(inputLabels, optimizedForm, setOptimizedForm, !!savedPlan || !manager, 'Optimized · ')}</View></View>
      {!!preview.error && <Text style={styles.error}>{preview.error}</Text>}
      {plan && <><View style={styles.grid}>{[['USUAL ROUTE', plan.baseline.liters, plan.baseline.cost], ['OPTIMIZED ROUTE', plan.optimized.liters, plan.optimized.cost], ['PROJECTED SAVINGS · SIGNED', savings?.liters, savings?.cost]].map(([label, liters, cost]) =>
        <View key={String(label)} style={styles.metric}><Text style={styles.label}>{label}</Text><Text style={styles.big}>{fmt(liters as number, ' L')}</Text><Text>{money(cost as number | null)}</Text></View>)}</View>
        <Text style={styles.formula}>Driving: {fmt(plan.optimizedInputs.distanceKm)} km ÷ {fmt(plan.parameters.kmPerLiter)} km/L × (1 + {fmt(plan.parameters.fullLoadPenaltyPercent)}% × {fmt(plan.optimizedInputs.averageLoadPercent)}%) = {fmt(plan.optimized.drivingLiters)} L{'\n'}
          Idle: {fmt(plan.optimizedInputs.idleHours)} h × {fmt(plan.parameters.idleLitersPerHour)} L/h = {fmt(plan.optimized.idleLiters)} L{'\n'}
          Collection: {fmt(plan.optimizedInputs.collectionHours)} h × {fmt(plan.parameters.collectionLitersPerHour)} L/h = {fmt(plan.optimized.collectionLiters)} L{'\n'}
          Total: {fmt(plan.optimized.baseLiters)} L × {fmt(plan.optimized.factor)} adjustment = {fmt(plan.optimized.liters)} L{'\n'}
          Cost: {fmt(plan.optimized.liters)} L × {money(plan.parameters.pricePerLiter)}/L = {money(plan.optimized.cost)}{'\n'}
          Projected savings: {fmt(savings?.percent, '%')}</Text>
        <Text style={styles.subtitle}>{plan.distanceSource}. {plan.parameterSource}. Negative savings means higher projected consumption. Driving fuel is distance-based. Enter idle and collection time separately; do not count the same hour twice.</Text>
        {manager && !savedPlan && <Button label="Save this trip estimate" disabled={busy || p.pricePerLiter <= 0} onPress={() => run(async () => { await saveDieselPlan(selected, plan); setMessage('Estimate saved with its original supply price and parameters.'); })} />}</>}
    </View>}
    {tab === 'actual' && selected && <View style={styles.card}><Text style={styles.heading}>Trip results · {currentLog?.status || 'Not submitted'}</Text>
      <Text style={styles.subtitle}>Enter one record per master collection trip. Distance and hours can be submitted without fuel readings; these records remain ineligible for learning.</Text>
      <View style={styles.switchRow}><Switch accessibilityLabel="Demonstration record" value={actualForm.isDemo === 'true'} disabled={locked} onValueChange={value => setActualForm(f => ({ ...f, isDemo: String(value) }))} />
        <Text style={styles.label}>{actualForm.isDemo === 'true' ? 'DEMO · excluded from real training' : 'Real measured trip · requires CENRO review'}</Text></View>
      <View style={styles.grid}><Field label="Trip date (YYYY-MM-DD)" text value={actualForm.tripDate} disabled={locked} onChange={value => setActualForm(f => ({ ...f, tripDate: value }))} />
        {fields({ ...inputLabels, collectedKg: 'Actual collected weight (kg)', actualLiters: 'Measured diesel consumed (L) · optional' }, actualForm, setActualForm, locked)}</View>
      <Text style={styles.label}>Distance source</Text><Picker accessibilityLabel="Distance source" selectedValue={actualForm.distanceSource} enabled={!locked} onValueChange={value => { if (value !== 'gps') setActualForm(f => ({ ...f, distanceSource: value })); }} style={styles.picker}>
        <Picker.Item label="Manual / demonstration distance" value="manual" /><Picker.Item label="Odometer difference" value="odometer" />{actualForm.distanceSource === 'gps' && <Picker.Item label="Imported GPS distance" value="gps" />}</Picker>
      <Button label="Import real GPS distance" secondary disabled={busy || locked} onPress={importGps} />{!!gpsNote && <Text style={styles.subtitle}>{gpsNote}</Text>}
      <Text style={styles.label}>How was consumption measured?</Text><Picker accessibilityLabel="Fuel measurement method" selectedValue={actualForm.fuelMethod} enabled={!locked} onValueChange={value => setActualForm(f => ({ ...f, fuelMethod: value }))} style={styles.picker}>
        <Picker.Item label="Not recorded" value="not-recorded" /><Picker.Item label="Tank balance: starting + added − ending liters" value="tank-balance" />
        <Picker.Item label="Full-to-full refill covering this trip only" value="full-to-full" /><Picker.Item label="Consumption meter" value="metered" /></Picker>
      <Field label="Measurement details / log reference / corrections" text disabled={locked} value={actualForm.evidence} onChange={value => setActualForm(f => ({ ...f, evidence: value }))} />
      <Text style={styles.subtitle}>Fuel issued alone is not fuel consumed. If a reading covers several trips, leave per-trip liters blank until separately measured. Do not repeat a whole shift’s fuel total for every trip. Operating hours must total no more than 24.</Text>
      {!!currentLog?.reviewNote && <Text style={styles.bannerText}>CENRO review: {currentLog.reviewNote}</Text>}
      {!locked && <View style={styles.actions}><Button label={coordinator ? "Submit trip on driver's behalf" : "Submit trip to CENRO"} disabled={busy} onPress={submitActual} /><Button label="Save draft on this device" secondary onPress={() => run(async () => { await AsyncStorage.setItem(draftKey, JSON.stringify(actualForm)); setMessage('Draft saved locally. It has not been submitted.'); })} /></View>}
      {manager && currentLog?.status === 'pending' && <View style={styles.review}><Text style={styles.heading}>CENRO review</Text><Field label="Review note" text value={reviewNote} onChange={setReviewNote} /><View style={styles.actions}>
        <Button label="Approve record" disabled={busy} onPress={() => run(async () => {
          await reviewDieselLog(selectedId, 'approved', reviewNote);
          try { const result = await trainTruckDiesel(selected.truckId, p); setModel(result); setMessage('Record approved. Truck learning updated: ' + result.status + '.'); }
          catch { setMessage('Record approved. Learning could not refresh; use Update truck learning to retry.'); }
        })} />
        <Button label="Return for correction" secondary disabled={busy} onPress={() => run(async () => { await reviewDieselLog(selectedId, 'needs-correction', reviewNote); setMessage('Returned for correction.'); })} /></View></View>}
    </View>}
    {tab === 'records' && <View style={styles.card}><Text style={styles.heading}>Estimated versus reported consumption</Text><View style={styles.grid}><Field label="Filter truck, driver, barangay or trip" text value={filter} onChange={setFilter} /><Field label="Trip month (YYYY-MM) · blank for all" text value={month} onChange={setMonth} /></View>
      <View style={styles.actions}><Button label="Export CSV" secondary disabled={busy || !filtered.length} onPress={() => run(() => exportDieselCsv(filtered, logs, plans))} />
        {Platform.OS === 'web' && <Button label="Print / Save PDF" secondary disabled={!filtered.length} onPress={() => run(() => printDieselReport(filtered, logs, plans))} />}</View>
      <Text style={styles.subtitle}>{filtered.length} trip(s). Variance = actual − original estimate. Blank readings are never counted as zero.</Text>
      {filtered.map(s => { const l = logs.find(item => item.scheduleId === s.id), estimate = plans[s.id] || s.routeOptimization?.dieselEstimate, actual = l?.actual.actualLiters;
        return <TouchableOpacity accessibilityRole="button" key={s.id} style={styles.record} onPress={() => { setSelectedId(s.id); setTab('actual'); }}><Text style={styles.label}>{s.truckPlate || s.truckId} · Driver: {getDriverName(s)} · {s.barangay} · {l?.actual.tripDate || s.dateText}</Text>
          <Text style={styles.subtitle}>{l?.actual.isDemo ? 'DEMO · ' : ''}{l?.status || 'No actual record'} · Estimate {fmt(estimate?.optimized.liters, ' L')} · Actual {fmt(actual, ' L')} · Variance {fmt(actual != null && estimate ? actual - estimate.optimized.liters : null, ' L')}</Text></TouchableOpacity>; })}
    </View>}
    {manager && selected && <View style={styles.card}><Text style={styles.heading}>Learning from this truck’s measured trips</Text>
      <Text style={styles.subtitle}>A fitted fuel adjustment needs at least 12 approved real records: at least 8 earlier training trips and 3 later validation trips, separated by date. Demo/manual distance, missing readings, and unreviewed records are excluded. The candidate must reduce validation error by more than 5%. Changed physical truck parameters invalidate the old adjustment.</Text>
      <Text style={styles.formula}>Status: {model?.status || 'Not trained'} · Eligible records: {model?.sampleCount ?? 0}{'\n'}Validation error: basic {fmt(model?.baselineMae, ' L')} · learned {fmt(model?.candidateMae, ' L')}{'\n'}Current adjustment: ×{fmt(applicableDieselFactor(model, p))}</Text>
      <Button label="Update truck learning" disabled={busy} onPress={() => run(async () => { const result = await trainTruckDiesel(selected.truckId, p); setModel(result); setMessage(result.status === 'validated' ? 'Learned adjustment passed validation and applies to new estimates.' : 'Basic formula retained until enough records and an improved validation result are available.'); })} />
    </View>}
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F3F6F4' }, content: { padding: 20, paddingBottom: 60, gap: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center', gap: 16 }, eyebrow: { color: '#527361', fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: '#173F2B', fontSize: 29, fontWeight: '800', marginVertical: 6 }, subtitle: { color: '#52665B', fontSize: 13, lineHeight: 21, marginVertical: 6 },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#DCE7DF', padding: 20, gap: 12 }, heading: { color: '#183D29', fontSize: 18, fontWeight: '700' },
  label: { color: '#314B3D', fontSize: 12, fontWeight: '600', marginBottom: 6 }, field: { flexGrow: 1, flexBasis: 'auto', minWidth: 160, marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 }, input: { borderWidth: 1, borderColor: '#CCDAD0', borderRadius: 8, padding: 12, color: '#1B3625', backgroundColor: '#FAFCFA', fontSize: 14, minHeight: 44 },
  picker: { color: '#1B3625', backgroundColor: '#F5F8F5', minHeight: 46, borderRadius: 8 }, button: { backgroundColor: '#166534', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 8, alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  secondary: { backgroundColor: '#EDF6EF', borderColor: '#C9DDCE', borderWidth: 1 }, buttonText: { color: '#fff', fontSize: 13, fontWeight: '700' }, disabled: { opacity: 0.5 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, tab: { padding: 12, borderRadius: 8, backgroundColor: '#E5EEE7' },
  activeTab: { backgroundColor: '#166534' }, tabText: { fontWeight: '600', color: '#365543', fontSize: 13 },
  banner: { backgroundColor: '#FFF7DC', borderColor: '#EDDEAF', borderWidth: 1, padding: 14, borderRadius: 10 }, bannerText: { color: '#705817', fontSize: 13, lineHeight: 21 },
  error: { backgroundColor: '#FEE2E2', color: '#991B1B', padding: 14, borderRadius: 8 }, success: { backgroundColor: '#DCFCE7', color: '#166534', padding: 14, borderRadius: 8 },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 }, column: { flex: 1, minWidth: 230, gap: 8 }, metric: { backgroundColor: '#F0F7F1', padding: 18, borderRadius: 10, flexGrow: 1, minWidth: 170 },
  big: { color: '#166534', fontSize: 27, fontWeight: '800', marginVertical: 7 }, formula: { backgroundColor: '#F5F8F5', padding: 14, borderRadius: 8, color: '#304B3A', fontSize: 13, lineHeight: 23 },
  switchRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 }, review: { paddingTop: 16, borderTopWidth: 1, borderTopColor: '#DCE7DF', gap: 10 },
  record: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E5EDE7' },
  assistedBadge: { backgroundColor: '#EDF6EF', borderColor: '#C9DDCE', borderWidth: 1, borderRadius: 8, padding: 12, marginTop: 8 },
});
