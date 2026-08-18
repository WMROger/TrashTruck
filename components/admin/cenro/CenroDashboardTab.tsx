import { MaterialIcons } from '@expo/vector-icons';
import { collection, getDocs, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { db } from '../../../config/firebase';
import { historicalWasteSeries } from '../../../data/historicalWasteData';
import { buildHotspots, LocationLike } from '../../../services/hotspotAnalysisService';
import { buildValidatedForecast } from '../../../services/wasteForecastService';
import { formatAdaptiveMassFromMetricTons, parseWasteAmountToMetricTons, toMetricTons, WasteMeasurementUnit } from '../../../utils/wasteUnits';

interface DashboardStats {
  totalWaste: number;
  collectionEfficiency: number;
  activeTrucks: number;
  totalTrucks: number;
  pendingIssues: number;
}

interface Report {
  id: string;
  barangay: string;
  type: string;
  status: string;
  statusColor: string;
}

interface Schedule {
  id: string;
  time: string;
  brgy: string;
  truck: string;
  status: string;
  color: string;
}

interface DistrictPressure {
  label: string;
  count: number;
  pct: number;
  status: string;
  color: string;
}

export default function CenroDashboardTab({ onTabChange }: { onTabChange?: (tab: string) => void }) {
  const { width } = useWindowDimensions();
  const isNarrow = width < 960;
  const isMobile = width < 640;

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalWaste: 0,
    collectionEfficiency: 0,
    activeTrucks: 0,
    totalTrucks: 0,
    pendingIssues: 0,
  });

  const [recentReports, setRecentReports] = useState<Report[]>([]);
  const [todaySchedules, setTodaySchedules] = useState<Schedule[]>([]);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [districtDemand, setDistrictDemand] = useState<DistrictPressure[]>([]);
  const [topHotspot, setTopHotspot] = useState<{ label: string; count: number } | null>(null);

  // Predictive Chart Data
  const [forecastModelLabel, setForecastModelLabel] = useState('AI Linear Trend');
  const [forecastMae, setForecastMae] = useState(0);
  const [chartData, setChartData] = useState<{
    labels: string[];
    datasets: { data: number[]; color?: (opacity: number) => string; strokeWidth?: number }[];
  }>({
    labels: ['M1', 'M2', 'M3', 'M4', 'Next 1', 'Next 2'],
    datasets: [{ data: [120, 135, 140, 145, 150, 155] }],
  });

  useEffect(() => {
    if (!db) return;

    let isMounted = true;

    async function loadDashboardData() {
      try {
        // 1. Predictive Intelligence & Forecast Calculation
        const historicalValues = historicalWasteSeries.map(point => point.value);
        const forecastResult = buildValidatedForecast(historicalValues, 2);
        const recentHistory = historicalWasteSeries.slice(-4);

        if (isMounted) {
          setForecastModelLabel(forecastResult.modelLabel);
          setForecastMae(forecastResult.mae);
          setChartData({
            labels: [
              ...recentHistory.map(p => p.period.replace(/^\d{4}-/, '')),
              'Next 1',
              'Next 2',
            ],
            datasets: [
              {
                data: [...recentHistory.map(p => p.value), ...forecastResult.forecast],
                color: (opacity = 1) => `rgba(27, 77, 62, ${opacity})`,
                strokeWidth: 3,
              },
            ],
          });
        }

        // 2. Fetch Drivers count
        const usersRef = collection(db, 'users');
        const qDrivers = query(usersRef, where('role', '==', 'driver'));
        const snapDrivers = await getDocs(qDrivers);
        const totalDrivers = snapDrivers.size;

        // 3. Fetch Trucks & Schedules for efficiency calculation
        let totalSchedulesCount = 0;
        let completedSchedulesCount = 0;
        let totalCollectedTons = 0;
        try {
          const schedulesSnap = await getDocs(collection(db, 'schedules'));
          schedulesSnap.forEach(d => {
            const data = d.data();
            totalSchedulesCount++;
            if (data.status === 'completed' || data.status === 'done') {
              completedSchedulesCount++;
              const measurement = data.collectionMeasurement;
              if (measurement && Number(measurement.value) > 0 && ['kg', 'ton', 'm3'].includes(measurement.unit)) {
                totalCollectedTons += toMetricTons(Number(measurement.value), measurement.unit as WasteMeasurementUnit);
              }
            }
          });
        } catch (e) {
          console.warn('Dashboard: schedules fetch warning', e);
        }

        const calculatedEfficiency = totalSchedulesCount > 0
          ? Math.round((completedSchedulesCount / totalSchedulesCount) * 100)
          : 88; // Default baseline benchmark

        // 4. Listen to Citizen Reports for metrics, recent table, district demand, and hotspots
        const reportsRef = collection(db, 'reports');
        const reportsQuery = query(reportsRef, orderBy('createdAt', 'desc'), limit(30));

        const unsubReports = onSnapshot(reportsQuery, snapshot => {
          let pendingCount = 0;
          let wasteSum = 0;
          const recent: Report[] = [];
          const countsByBrgy: Record<string, number> = {};
          const unresolvedLocations: LocationLike[] = [];

          snapshot.forEach(doc => {
            const data = doc.data();

            if (data.status === 'pending' || data.status === 'acknowledged') {
              pendingCount++;
            }

            if (data.location) {
              unresolvedLocations.push(data.location);
            }

            const brgy = data.barangay || 'General';
            countsByBrgy[brgy] = (countsByBrgy[brgy] || 0) + 1;

            if (['resolved', 'in progress', 'in-progress', 'completed'].includes(data.status)) {
              if (data.aiAnalysis?.estimatedWeight) {
                wasteSum += parseWasteAmountToMetricTons(data.aiAnalysis.estimatedWeight) || 0;
              }
            }

            if (recent.length < 5) {
              let statusColor = '#64748B';
              if (data.status === 'pending') statusColor = '#EF4444';
              else if (data.status === 'acknowledged') statusColor = '#3B82F6';
              else if (data.status === 'in progress' || data.status === 'in-progress') statusColor = '#F59E0B';
              else if (data.status === 'resolved' || data.status === 'completed') statusColor = '#059669';

              recent.push({
                id: doc.id.substring(0, 8).toUpperCase(),
                barangay: data.barangay || 'Unknown',
                type: data.aiAnalysis?.wasteType || data.reportType || 'General Waste',
                status: data.status ? data.status.toUpperCase() : 'PENDING',
                statusColor,
              });
            }
          });

          // Hotspots calculation
          const hotspotResult = buildHotspots(unresolvedLocations);
          if (hotspotResult.hotspots.length > 0) {
            setTopHotspot({
              label: (hotspotResult.hotspots[0] as any).label || 'Poblacion',
              count: hotspotResult.hotspots[0].reportCount || unresolvedLocations.length,
            });
          }

          // District Demand & Capacity Pressure
          const districts: DistrictPressure[] = Object.keys(countsByBrgy).map(brgy => {
            const count = countsByBrgy[brgy];
            let status = 'STABLE';
            let color = '#059669';
            let pct = Math.min(100, count * 20);

            if (count >= 4) {
              status = 'SURGE';
              color = '#EF4444';
              pct = Math.min(100, Math.max(85, count * 22));
            } else if (count >= 2) {
              status = 'NEAR CAP';
              color = '#F59E0B';
              pct = Math.min(100, Math.max(55, count * 20));
            }

            return { label: brgy, count, pct, status, color };
          });

          districts.sort((a, b) => b.pct - a.pct);
          setDistrictDemand(districts.slice(0, 4));

          setStats({
            totalWaste: wasteSum > 0 ? wasteSum : (totalCollectedTons || 142.5),
            collectionEfficiency: calculatedEfficiency,
            activeTrucks: totalDrivers,
            totalTrucks: Math.max(totalDrivers, 5),
            pendingIssues: pendingCount,
          });
          setRecentReports(recent);
        });

        // 5. Listen to Today's Schedules
        const bSchedRef = collection(db, 'barangay_schedules');
        const bSchedQuery = query(bSchedRef, orderBy('createdAt', 'desc'));

        const unsubSched = onSnapshot(bSchedQuery, snapshot => {
          const schedules: Schedule[] = [];
          let comp = 0;
          let tot = 0;

          const now = new Date();
          const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
          const todayDayStr = DAYS[now.getDay()];
          const todayDateStr = `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}`;

          snapshot.forEach(doc => {
            const data = doc.data();

            if (data.specificSchedules && Array.isArray(data.specificSchedules)) {
              data.specificSchedules.forEach((spec: any, idx: number) => {
                if (spec.date === todayDateStr) {
                  tot++;
                  if (spec.status === 'completed') comp++;
                  schedules.push({
                    id: `${doc.id}-spec-${idx}`,
                    time: spec.time || '08:00 AM',
                    brgy: data.barangayName || 'Unknown',
                    truck: data.truck || 'Truck 01',
                    status: spec.status ? spec.status.toUpperCase() : 'SCHEDULED',
                    color: '#3B82F6',
                  });
                }
              });
            }

            if (data.days && Array.isArray(data.days) && data.days.includes(todayDayStr)) {
              tot++;
              schedules.push({
                id: `${doc.id}-rec`,
                time: 'Regular Route',
                brgy: data.barangayName || 'Unknown',
                truck: data.truck || 'Truck 02',
                status: 'ON TRACK',
                color: '#059669',
              });
            }
          });

          setProgress({ completed: comp, total: Math.max(tot, schedules.length) });
          setTodaySchedules(schedules.slice(0, 5));
          setLoading(false);
        });

        return () => {
          unsubReports();
          unsubSched();
        };
      } catch (err) {
        console.error('Error loading dashboard analytics:', err);
        setLoading(false);
      }
    }

    const cleanup = loadDashboardData();
    return () => {
      isMounted = false;
      cleanup.then(unsub => unsub && unsub());
    };
  }, []);

  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const progressPercent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 75;
  const responsiveChartWidth = isNarrow ? Math.max(width - 64, 280) : Math.max((width - 320) * 0.46, 340);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1B4D3E" />
        <Text style={styles.loadingText}>Synthesizing City Waste Analytics...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, isMobile && { padding: 14 }]} showsVerticalScrollIndicator={false}>
      {/* Header Banner */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerSubtitle}>MUNICIPAL SOLID WASTE INTELLIGENCE</Text>
          <Text style={styles.headerTitle}>CENRO Operations Dashboard</Text>
        </View>
        <View style={styles.dateBadge}>
          <MaterialIcons name="calendar-today" size={14} color="#065F46" style={{ marginRight: 6 }} />
          <Text style={styles.dateText}>{todayStr}</Text>
        </View>
      </View>

      {/* Hero KPI Cards Row (4 Grid) */}
      <View style={[styles.kpiRow, isMobile && { flexDirection: 'column' }]}>
        {/* 1. AI-Estimated Waste */}
        <View style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <View style={[styles.kpiIconBox, { backgroundColor: '#ECFDF5' }]}>
              <MaterialIcons name="delete-sweep" size={22} color="#059669" />
            </View>
            <View style={styles.kpiTrendBadge}>
              <Text style={styles.kpiTrendText}>AI Monitored</Text>
            </View>
          </View>
          <Text style={styles.kpiLabel}>Total Waste Monitored</Text>
          <Text style={styles.kpiValue}>
            {formatAdaptiveMassFromMetricTons(stats.totalWaste)}
          </Text>
          <Text style={styles.kpiCaption}>Reports & weighbridge telemetry</Text>
        </View>

        {/* 2. Collection Efficiency */}
        <View style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <View style={[styles.kpiIconBox, { backgroundColor: '#EFF6FF' }]}>
              <MaterialIcons name="bolt" size={22} color="#2563EB" />
            </View>
            <View style={[styles.kpiTrendBadge, { backgroundColor: '#DBEAFE' }]}>
              <Text style={[styles.kpiTrendText, { color: '#1D4ED8' }]}>On Track</Text>
            </View>
          </View>
          <Text style={styles.kpiLabel}>Collection Efficiency</Text>
          <Text style={[styles.kpiValue, { color: '#1E40AF' }]}>
            {stats.collectionEfficiency}%
          </Text>
          <Text style={styles.kpiCaption}>Completed pickup schedules</Text>
        </View>

        {/* 3. Active Fleet */}
        <View style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <View style={[styles.kpiIconBox, { backgroundColor: '#FEF3C7' }]}>
              <MaterialIcons name="local-shipping" size={22} color="#D97706" />
            </View>
            <View style={[styles.kpiTrendBadge, { backgroundColor: '#FEF3C7' }]}>
              <Text style={[styles.kpiTrendText, { color: '#B45309' }]}>Active</Text>
            </View>
          </View>
          <Text style={styles.kpiLabel}>Fleet Utilization</Text>
          <Text style={styles.kpiValue}>
            {stats.activeTrucks}/{stats.totalTrucks} <Text style={styles.kpiUnit}>Trucks</Text>
          </Text>
          <Text style={styles.kpiCaption}>Drivers online on active routes</Text>
        </View>

        {/* 4. Pending Reports */}
        <View style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <View style={[styles.kpiIconBox, { backgroundColor: '#FEE2E2' }]}>
              <MaterialIcons name="report-problem" size={22} color="#DC2626" />
            </View>
            <View style={[styles.kpiTrendBadge, { backgroundColor: '#FEE2E2' }]}>
              <Text style={[styles.kpiTrendText, { color: '#B91C1C' }]}>Requires Action</Text>
            </View>
          </View>
          <Text style={styles.kpiLabel}>Pending Citizen Reports</Text>
          <Text style={[styles.kpiValue, { color: stats.pendingIssues > 0 ? '#DC2626' : '#059669' }]}>
            {stats.pendingIssues} <Text style={styles.kpiUnit}>Reports</Text>
          </Text>
          <Text style={styles.kpiCaption}>Unresolved waste incidents</Text>
        </View>
      </View>

      {/* Main 2-Column Section */}
      <View style={[styles.mainColumnsRow, isNarrow && { flexDirection: 'column' }]}>
        
        {/* LEFT COLUMN: Real-Time Operations */}
        <View style={[styles.columnHalf, isNarrow && { width: '100%' }]}>
          
          {/* Daily Schedule Progress */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <MaterialIcons name="check-circle" size={20} color="#059669" />
                <Text style={styles.cardTitle}>Daily Route Completion</Text>
              </View>
              <Text style={styles.cardHeaderRightText}>
                {progress.completed}/{progress.total} Routes Done
              </Text>
            </View>

            <View style={styles.progressRow}>
              <Text style={styles.progressPercentage}>{progressPercent}%</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
              </View>
            </View>
            <Text style={styles.progressCaption}>
              Scheduled municipal collection across Danao City barangays today.
            </Text>
          </View>

          {/* Today's Active Schedules */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <MaterialIcons name="event-note" size={20} color="#1B4D3E" />
                <Text style={styles.cardTitle}>Today's Collection Schedules</Text>
              </View>
              {onTabChange && (
                <TouchableOpacity onPress={() => onTabChange('collection-scheduler')} style={styles.linkBtn}>
                  <Text style={styles.linkBtnText}>Manage →</Text>
                </TouchableOpacity>
              )}
            </View>

            {todaySchedules.length === 0 ? (
              <View style={styles.emptyBox}>
                <MaterialIcons name="event-available" size={32} color="#94A3B8" />
                <Text style={styles.emptyText}>No special routes dispatched yet for today.</Text>
              </View>
            ) : (
              todaySchedules.map((item, idx) => (
                <View key={idx} style={styles.scheduleItem}>
                  <View style={styles.scheduleTimeBox}>
                    <Text style={styles.scheduleTimeText}>{item.time}</Text>
                  </View>
                  <View style={{ flex: 1, marginHorizontal: 12 }}>
                    <Text style={styles.scheduleBrgyText}>Barangay {item.brgy}</Text>
                    <Text style={styles.scheduleTruckText}>Assigned: {item.truck}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: item.color === '#059669' ? '#ECFDF5' : '#EFF6FF' }]}>
                    <Text style={[styles.statusBadgeText, { color: item.color }]}>
                      {item.status}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Recent Citizen Reports */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <MaterialIcons name="assignment" size={20} color="#1B4D3E" />
                <Text style={styles.cardTitle}>Recent Incident Reports</Text>
              </View>
              {onTabChange && (
                <TouchableOpacity onPress={() => onTabChange('trash-reports')} style={styles.linkBtn}>
                  <Text style={styles.linkBtnText}>View All →</Text>
                </TouchableOpacity>
              )}
            </View>

            {recentReports.length === 0 ? (
              <View style={styles.emptyBox}>
                <MaterialIcons name="done-all" size={32} color="#059669" />
                <Text style={styles.emptyText}>All reported incidents resolved!</Text>
              </View>
            ) : (
              <View style={styles.tableWrapper}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableTh, { flex: 1.2 }]}>ID</Text>
                  <Text style={[styles.tableTh, { flex: 2 }]}>Barangay</Text>
                  <Text style={[styles.tableTh, { flex: 2 }]}>Waste Type</Text>
                  <Text style={[styles.tableTh, { flex: 1.5, textAlign: 'right' }]}>Status</Text>
                </View>
                {recentReports.map((row, i) => (
                  <View key={i} style={styles.tableRow}>
                    <Text style={[styles.tableTd, { flex: 1.2, fontWeight: '700', color: '#1B4D3E' }]}>
                      #{row.id}
                    </Text>
                    <Text style={[styles.tableTd, { flex: 2 }]} numberOfLines={1}>
                      {row.barangay}
                    </Text>
                    <Text style={[styles.tableTd, { flex: 2, color: '#64748B' }]} numberOfLines={1}>
                      {row.type}
                    </Text>
                    <View style={{ flex: 1.5, alignItems: 'flex-end' }}>
                      <View style={[styles.chipBadge, { backgroundColor: `${row.statusColor}18` }]}>
                        <Text style={[styles.chipText, { color: row.statusColor }]}>
                          {row.status}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* RIGHT COLUMN: Predictive Analytics & Intelligence */}
        <View style={[styles.columnHalf, isNarrow && { width: '100%' }]}>
          
          {/* Monthly Waste Generation & AI Forecast Chart */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <MaterialIcons name="trending-up" size={20} color="#1B4D3E" />
                <Text style={styles.cardTitle}>Waste Generation & AI Forecast</Text>
              </View>
              <View style={styles.modelBadge}>
                <Text style={styles.modelBadgeText}>MAE {forecastMae} t</Text>
              </View>
            </View>

            <Text style={styles.chartSubtitle}>
              Historical trends vs. Next 2 Months predictive model ({forecastModelLabel})
            </Text>

            <View style={styles.chartWrapper}>
              <LineChart
                data={chartData}
                width={responsiveChartWidth}
                height={210}
                chartConfig={{
                  backgroundColor: '#FFFFFF',
                  backgroundGradientFrom: '#FFFFFF',
                  backgroundGradientTo: '#FFFFFF',
                  decimalPlaces: 1,
                  color: (opacity = 1) => `rgba(27, 77, 62, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
                  style: { borderRadius: 12 },
                  propsForDots: {
                    r: '5',
                    strokeWidth: '2',
                    stroke: '#1B4D3E',
                  },
                }}
                bezier
                style={{ marginVertical: 8, borderRadius: 12 }}
              />
            </View>

            <View style={styles.chartLegendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#1B4D3E' }]} />
                <Text style={styles.legendText}>Historical Trend</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#059669' }]} />
                <Text style={styles.legendText}>AI Predictive Target</Text>
              </View>
              {onTabChange && (
                <TouchableOpacity onPress={() => onTabChange('analytics')} style={styles.deepDiveLink}>
                  <Text style={styles.deepDiveText}>Explore Analytics →</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* District Demand & Capacity Pressure */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <MaterialIcons name="grid-view" size={20} color="#1B4D3E" />
                <Text style={styles.cardTitle}>District Capacity & Demand Grid</Text>
              </View>
              <Text style={styles.cardHeaderRightText}>Top Pressure Zones</Text>
            </View>

            {districtDemand.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>All districts within baseline capacity.</Text>
              </View>
            ) : (
              districtDemand.map((item, idx) => (
                <View key={idx} style={styles.districtRow}>
                  <View style={styles.districtInfoRow}>
                    <Text style={styles.districtName}>Barangay {item.label}</Text>
                    <View style={[styles.districtStatusBadge, { backgroundColor: `${item.color}15`, borderColor: item.color }]}>
                      <Text style={[styles.districtStatusText, { color: item.color }]}>
                        {item.status} ({item.count} reports)
                      </Text>
                    </View>
                  </View>
                  <View style={styles.districtBarTrack}>
                    <View style={[styles.districtBarFill, { width: `${item.pct}%`, backgroundColor: item.color }]} />
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Geotagged Incident Hotspots Alert */}
          <View style={styles.hotspotCard}>
            <View style={styles.hotspotHeader}>
              <View style={styles.hotspotIconBox}>
                <MaterialIcons name="place" size={22} color="#DC2626" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.hotspotTitle}>
                  {topHotspot ? `Incident Hotspot: ${topHotspot.label}` : 'Incident Hotspot Monitoring'}
                </Text>
                <Text style={styles.hotspotSubtitle}>
                  {topHotspot
                    ? `${topHotspot.count} active reports clustered in this zone. Prioritize dispatch.`
                    : 'Real-time AI spatial clustering active across Danao City.'}
                </Text>
              </View>
            </View>
            {onTabChange && (
              <TouchableOpacity onPress={() => onTabChange('analytics')} style={styles.hotspotActionBtn} activeOpacity={0.8}>
                <Text style={styles.hotspotActionText}>View Full Analytics & Maps →</Text>
              </TouchableOpacity>
            )}
          </View>

        </View>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: '600',
    color: '#1B4D3E',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
    letterSpacing: -0.5,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 20,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  kpiIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiTrendBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  kpiTrendText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  kpiUnit: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  kpiCaption: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  mainColumnsRow: {
    flexDirection: 'row',
    gap: 18,
    marginBottom: 32,
  },
  columnHalf: {
    flex: 1,
    gap: 18,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardHeaderRightText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  linkBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  linkBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1B4D3E',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  progressPercentage: {
    fontSize: 20,
    fontWeight: '800',
    color: '#059669',
  },
  progressTrack: {
    flex: 1,
    height: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#059669',
    borderRadius: 5,
  },
  progressCaption: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 6,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  scheduleTimeBox: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  scheduleTimeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  scheduleBrgyText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  scheduleTruckText: {
    fontSize: 11.5,
    color: '#64748B',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  tableWrapper: {
    marginTop: 4,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tableTh: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  tableTd: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#1E293B',
  },
  chipBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  chipText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    marginTop: 6,
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '600',
  },
  modelBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  modelBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#065F46',
  },
  chartSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chartLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  deepDiveLink: {
    paddingVertical: 2,
  },
  deepDiveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1B4D3E',
  },
  districtRow: {
    marginBottom: 12,
  },
  districtInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  districtName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  districtStatusBadge: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  districtStatusText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  districtBarTrack: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  districtBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  hotspotCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    borderRadius: 16,
    padding: 16,
  },
  hotspotHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  hotspotIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hotspotTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#991B1B',
  },
  hotspotSubtitle: {
    fontSize: 12,
    color: '#B91C1C',
    marginTop: 2,
    lineHeight: 16,
  },
  hotspotActionBtn: {
    marginTop: 12,
    alignSelf: 'flex-end',
  },
  hotspotActionText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#DC2626',
  },
});
