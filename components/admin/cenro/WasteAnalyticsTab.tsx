import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Dimensions, Platform, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { auth, db } from '../../../config/firebase';
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { historicalWasteDataNotes, historicalWasteSeries } from '../../../data/historicalWasteData';
import lstmForecastArtifact from '../../../data/lstmForecastArtifact.json';
import { buildValidatedForecast } from '../../../services/wasteForecastService';
import { buildHotspots, LocationLike } from '../../../services/hotspotAnalysisService';
import { formatAdaptiveMassFromMetricTons, parseWasteAmountToMetricTons, toMetricTons, WasteMeasurementUnit } from '../../../utils/wasteUnits';
import MapView, { Heatmap, Marker } from '../../MapView';
import GpsHeatMap from './GpsHeatMap';

type ForecastMode = 'baseline' | 'lstm-candidate';
type BudgetConfig = { costPerTon: number; contingencyPercent: number };

export default function WasteAnalyticsTab() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [historyRange, setHistoryRange] = useState<12 | 24 | 'all'>(12);
  const [forecastMode, setForecastMode] = useState<ForecastMode>('baseline');
  const [budgetConfig, setBudgetConfig] = useState<BudgetConfig>({ costPerTon: 0, contingencyPercent: 10 });
  const [costPerTonInput, setCostPerTonInput] = useState('');
  const [contingencyInput, setContingencyInput] = useState('10');
  const [savingBudget, setSavingBudget] = useState(false);

  const [loadingText, setLoadingText] = useState('Loading Danao City Analytics...');

  useEffect(() => {
    getDoc(doc(db, 'analytics', 'budget_planning')).then(snapshot => {
      const config = snapshot.data();
      if (!config) return;
      const next = {
        costPerTon: Math.max(0, Number(config.costPerTon) || 0),
        contingencyPercent: Math.max(0, Math.min(100, Number(config.contingencyPercent) || 0)),
      };
      setBudgetConfig(next);
      setCostPerTonInput(next.costPerTon ? String(next.costPerTon) : '');
      setContingencyInput(String(next.contingencyPercent));
    }).catch(error => console.warn('Budget planning configuration could not be loaded:', error));
  }, []);

  useEffect(() => {
    async function fetchAiInsights() {
      const historicalValues = historicalWasteSeries.map(point => point.value);
      const forecastResult = buildValidatedForecast(historicalValues, 2);
      const recentHistory = historicalWasteSeries.slice(-3);

      // 1. Fetch schedules to calculate efficiency and measured collection totals.
      setLoadingText('Aggregating schedule data...');
      let totalSchedules = 0;
      let completedSchedules = 0;
      let totalCollectedTons = 0;
      let measuredPickups = 0;
      let estimatedPickups = 0;
      const utilizedTruckIds = new Set<string>();

      try {
        const schedulesSnap = await getDocs(collection(db, 'schedules'));
        schedulesSnap.forEach(d => {
          const data = d.data();
          totalSchedules++;
          if (data.truckId && ['pending', 'in-progress', 'completed', 'done'].includes(data.status)) utilizedTruckIds.add(data.truckId);
          if (data.status === 'completed' || data.status === 'done') {
            completedSchedules++;
            const measurement = data.collectionMeasurement;
            if (measurement && Number(measurement.value) > 0 && ['kg', 'ton', 'm3'].includes(measurement.unit)) {
              totalCollectedTons += toMetricTons(Number(measurement.value), measurement.unit as WasteMeasurementUnit);
              measuredPickups++;
            } else {
              estimatedPickups++;
            }
          }
        });
      } catch (e) {
        console.warn("Failed to fetch schedules:", e);
      }

      let activeTruckCount = 0;
      const activeTruckIds = new Set<string>();
      try {
        const trucksSnapshot = await getDocs(collection(db, 'trucks'));
        trucksSnapshot.forEach(truck => {
          if (truck.data().status !== 'out_of_service' && truck.data().status !== 'maintenance') {
            activeTruckCount++;
            activeTruckIds.add(truck.id);
          }
        });
      } catch (e) {
        console.warn('Failed to fetch fleet utilization:', e);
      }

      const collectionEfficiency = totalSchedules > 0
        ? parseFloat(((completedSchedules / totalSchedules) * 100).toFixed(1))
        : 0;

      // 3. Fetch Reports to calculate Unresolved Tonnage and District Grid
      setLoadingText('Analyzing citizen reports...');
      let totalUnresolvedTons = 0;
      const countsByBrgy: Record<string, number> = {};
      const unresolvedLocations: LocationLike[] = [];

      try {
        const reportsSnap = await getDocs(collection(db, 'reports'));
        reportsSnap.forEach(d => {
          const data = d.data();
          if (data.status !== 'resolved') {
            unresolvedLocations.push(data.location);
            // Count for District Grid
            const brgy = data.barangay;
            if (brgy) {
              countsByBrgy[brgy] = (countsByBrgy[brgy] || 0) + 1;
            }

            // Use only an available AI estimate; do not invent a default report weight.
            totalUnresolvedTons += parseWasteAmountToMetricTons(data.aiAnalysis?.estimatedWeight) || 0;
          }
        });
      } catch (e) {
        console.warn("Failed to fetch reports:", e);
      }
      const hotspotResult = buildHotspots(unresolvedLocations);

      // 4. District Capacity Grid logic using real scheduled barangays
      let finalDistricts: any[] = [];
      try {
        const bgrySchedSnap = await getDocs(collection(db, 'barangay_schedules'));
        const activeBrgys = Array.from(new Set(bgrySchedSnap.docs.map(d => d.data().barangayName).filter(Boolean)));

        if (activeBrgys.length === 0) activeBrgys.push(...Object.keys(countsByBrgy));

        const dynamicDistricts = activeBrgys.map((brgy: any, i: number) => {
          const count = countsByBrgy[brgy] || 0;
          let status = 'STABLE';
          let color = '#2E8B57';
          let pct = Math.min(100, count * 15);

          if (count > 3) {
            status = 'SURGE';
            color = '#ef4444';
            pct = Math.min(100, Math.max(80, count * 20));
          } else if (count > 1) {
            status = 'NEAR CAP';
            color = '#f59e0b';
            pct = Math.min(100, Math.max(50, count * 18));
          }

          return { id: `D${i+1}`, label: brgy, pct, status, color };
        });

        dynamicDistricts.sort((a, b) => b.pct - a.pct);
        finalDistricts = dynamicDistricts.slice(0, 5);
      } catch (e) {
        console.warn("Failed to build district grid:", e);
      }

      // Compute current load percentage relative to an assumed average or max capacity
      const loadPct = totalCollectedTons > 0
        ? Math.min(100, parseFloat(((totalUnresolvedTons / totalCollectedTons) * 100).toFixed(1)))
        : 0;

      const metrics = {
        currentWasteLoad: { percent: loadPct, trend: 0 },
        collectionEfficiency: collectionEfficiency,
        measurementCoverage: { measuredPickups, estimatedPickups },
        operations: {
          totalCollectedTons: parseFloat(totalCollectedTons.toFixed(2)),
          routeCompletionPercent: collectionEfficiency,
          truckUtilizationPercent: activeTruckCount > 0 ? parseFloat(((Array.from(utilizedTruckIds).filter(id => activeTruckIds.has(id)).length / activeTruckCount) * 100).toFixed(1)) : 0,
          utilizedTrucks: Array.from(utilizedTruckIds).filter(id => activeTruckIds.has(id)).length,
          activeTrucks: activeTruckCount,
        }
      };

      const highestDemandArea = finalDistricts[0];
      setData({
        currentWasteLoad: metrics.currentWasteLoad,
        collectionEfficiency: metrics.collectionEfficiency,
        measurementCoverage: metrics.measurementCoverage,
        operations: metrics.operations,
        forecastValidation: forecastResult,
        lstmCandidate: lstmForecastArtifact,
        dataQualityNotes: historicalWasteDataNotes,
        aiInsight: {
          title: highestDemandArea ? `${highestDemandArea.label} requires attention` : 'No active report hotspot',
          desc: `${forecastResult.modelLabel} selected using ${forecastResult.validationPoints} held-out months (MAE ${forecastResult.mae} t).`,
          action: highestDemandArea
            ? `Review unresolved reports in ${highestDemandArea.label} before dispatch.`
            : 'Continue collecting geotagged reports to support hotspot analysis.'
        },
        districts: finalDistricts,
        hotspots: hotspotResult.hotspots.slice(0, 5),
        hotspotsAll: hotspotResult.hotspots,
        hotspotCoverage: hotspotResult,
        historicalSeries: historicalWasteSeries,
        chartData: {
          labels: [...recentHistory.map(point => point.period), 'Next 1', 'Next 2'],
          datasets: [{
            data: [...recentHistory.map(point => point.value), ...forecastResult.forecast],
            color: (opacity = 1) => `rgba(46, 139, 87, ${opacity})`,
            strokeWidth: 3
          }]
        }
      });
      setLoading(false);
    }

    fetchAiInsights();
  }, []);

  if (loading || !data) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#2E8B57" />
        <Text style={{ marginTop: 16, color: '#6B7280', fontWeight: '500' }}>{loadingText}</Text>
      </View>
    );
  }

  // Calculate chart width based on screen width (roughly 60% for the left chart card on web)
  const screenWidth = Dimensions.get("window").width;
  const chartWidth = Math.max(screenWidth * 0.5, 300);
  const visibleHistory = historyRange === 'all' ? data.historicalSeries : data.historicalSeries.slice(-historyRange);
  const selectedForecast = forecastMode === 'lstm-candidate'
    ? data.lstmCandidate.forecast.slice(0, 2).map((point: any) => point.valueTons)
    : data.forecastValidation.forecast;
  const selectedForecastLabels = forecastMode === 'lstm-candidate'
    ? data.lstmCandidate.forecast.slice(0, 2).map((point: any) => point.period.slice(2))
    : ['Next 1', 'Next 2'];
  const visibleChartData = {
    labels: [...visibleHistory.map((point: any) => point.period.slice(2)), ...selectedForecastLabels],
    datasets: [{
      data: [...visibleHistory.map((point: any) => point.value), ...selectedForecast],
      color: (opacity = 1) => forecastMode === 'lstm-candidate' ? `rgba(124, 58, 237, ${opacity})` : `rgba(46, 139, 87, ${opacity})`,
      strokeWidth: 3,
    }],
  };

  const baselineForecastTons = data.forecastValidation.forecast.reduce((sum: number, value: number) => sum + value, 0);
  const baseBudgetProjection = baselineForecastTons * budgetConfig.costPerTon;
  const contingencyAmount = baseBudgetProjection * (budgetConfig.contingencyPercent / 100);
  const totalBudgetProjection = baseBudgetProjection + contingencyAmount;

  const formatCurrency = (pesos: number) => `₱${pesos.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const saveBudgetPlanningConfig = async () => {
    const costPerTon = Number(costPerTonInput);
    const contingencyPercent = Number(contingencyInput);
    if (!Number.isFinite(costPerTon) || costPerTon <= 0) {
      Alert.alert('Invalid cost', 'Enter an approved planning cost greater than zero for each metric ton.');
      return;
    }
    if (!Number.isFinite(contingencyPercent) || contingencyPercent < 0 || contingencyPercent > 100) {
      Alert.alert('Invalid contingency', 'Contingency must be between 0% and 100%.');
      return;
    }
    setSavingBudget(true);
    try {
      const next = { costPerTon, contingencyPercent };
      await setDoc(doc(db, 'analytics', 'budget_planning'), {
        ...next,
        updatedAt: serverTimestamp(),
        updatedByUid: auth.currentUser?.uid || null,
      }, { merge: true });
      setBudgetConfig(next);
      Alert.alert('Budget scenario saved', 'The planning projection now uses the updated cost assumptions.');
    } catch (error) {
      console.error('Budget planning save failed:', error);
      Alert.alert('Unable to save', 'The budget planning assumptions could not be saved.');
    } finally {
      setSavingBudget(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerSubtitle}>PORTAL / PREDICTIVE INTELLIGENCE</Text>
          <Text style={styles.headerTitle}>Waste Intelligence Analytics</Text>
        </View>
        <View style={styles.refreshBadge}>
          <Text style={styles.refreshText}>REFRESHED 02:14 PM</Text>
        </View>
      </View>

      {/* Top Metrics Row */}
      <View style={styles.topRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricTitle}>CURRENT WASTE LOAD</Text>
          <View style={styles.metricValueRow}>
            <Text style={styles.metricValue}>{data.currentWasteLoad.percent}%</Text>
            <Text style={styles.metricTrendUp}>~{data.currentWasteLoad.trend}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${data.currentWasteLoad.percent}%`, backgroundColor: '#2E8B57' }]} />
          </View>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricTitle}>TRUCK UTILIZATION</Text>
          <View style={styles.metricValueRow}>
            <Text style={styles.metricValue}>{data.operations.truckUtilizationPercent}%</Text>
            <Text style={styles.metricSubValue}>{data.operations.utilizedTrucks}/{data.operations.activeTrucks} active trucks</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${Math.min(100, data.operations.truckUtilizationPercent)}%`, backgroundColor: '#2E8B57' }]} />
          </View>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricTitle}>COLLECTION EFFICIENCY</Text>
          <View style={styles.metricValueRow}>
            <Text style={styles.metricValue}>{data.collectionEfficiency}%</Text>
            <View style={styles.optimizedBadge}>
              <MaterialIcons name="check-circle" size={12} color="#2E8B57" />
              <Text style={styles.optimizedText}>Measured</Text>
            </View>
          </View>
          <View style={styles.efficiencyBars}>
            <View style={styles.effBar} />
            <View style={styles.effBar} />
            <View style={styles.effBar} />
            <View style={styles.effBar} />
            <View style={[styles.effBar, { backgroundColor: '#E5E7EB' }]} />
          </View>
          <Text style={[styles.chartDesc, { marginTop: 10 }]}>{data.measurementCoverage.measuredPickups} measured · {data.measurementCoverage.estimatedPickups} estimated pickups</Text>
          <Text style={[styles.chartDesc, { marginTop: 3 }]}>{formatAdaptiveMassFromMetricTons(data.operations.totalCollectedTons)} recorded</Text>
        </View>
      </View>

      {/* Middle Row */}
      <View style={styles.middleRow}>
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.chartTitle}>{forecastMode === 'baseline' ? 'Validated Monthly Forecast Baseline' : 'TensorFlow LSTM Candidate Forecast'}</Text>
              <Text style={styles.chartDesc}>
                Historical Block A estimated mass (t, converted at 0.16 t/m³); {forecastMode === 'baseline' ? data.forecastValidation.modelLabel : `${data.lstmCandidate.modelId} · candidate only`}
              </Text>
              <View style={[styles.filterRow, { marginTop: 10 }]}>
                {([
                  { id: 'baseline', label: 'Production baseline' },
                  { id: 'lstm-candidate', label: 'TensorFlow candidate' },
                ] as const).map(option => (
                  <TouchableOpacity key={option.id} style={[styles.modelChip, forecastMode === option.id && styles.modelChipActive]} onPress={() => setForecastMode(option.id)}>
                    <Text style={[styles.modelChipText, forecastMode === option.id && styles.modelChipTextActive]}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={[styles.filterRow, { marginTop: 10 }]}>
                {([12, 24, 'all'] as const).map(range => (
                  <TouchableOpacity key={String(range)} style={[styles.filterChip, historyRange === range && styles.filterChipActive]} onPress={() => setHistoryRange(range)}>
                    <Text style={[styles.filterChipText, historyRange === range && styles.filterChipTextActive]}>{range === 'all' ? 'All months' : `${range} months`}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDash, { backgroundColor: '#2E8B57' }]} />
                <Text style={styles.legendText}>ACTUAL + {forecastMode === 'baseline' ? 'BASELINE' : 'LSTM CANDIDATE'}</Text>
              </View>
            </View>
          </View>
          
          {/* Functional Chart Area */}
          <View style={styles.chartArea}>
            <LineChart
              data={visibleChartData}
              width={chartWidth}
              height={220}
              chartConfig={{
                backgroundColor: "#fff",
                backgroundGradientFrom: "#fff",
                backgroundGradientTo: "#fff",
                decimalPlaces: 1,
                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
                style: {
                  borderRadius: 16
                },
                propsForDots: {
                  r: "4",
                  strokeWidth: "2",
                }
              }}
              bezier
              style={{
                marginVertical: 8,
                borderRadius: 16,
                paddingRight: 40
              }}
              withVerticalLines={false}
              withHorizontalLines={true}
              fromZero={false}
            />
          </View>
          <View style={styles.modelDecisionRow}>
            <View style={styles.modelDecisionMetric}>
              <Text style={styles.modelDecisionLabel}>LSTM ENSEMBLE MAE</Text>
              <Text style={styles.modelDecisionValue}>{formatAdaptiveMassFromMetricTons(data.lstmCandidate.evaluation.ensemble.mae)}</Text>
            </View>
            <View style={styles.modelDecisionMetric}>
              <Text style={styles.modelDecisionLabel}>VS. BEST BASELINE</Text>
              <Text style={[styles.modelDecisionValue, { color: '#166534' }]}>+{data.lstmCandidate.evaluation.relativeMaeImprovementPercent}%</Text>
            </View>
            <View style={styles.modelDecisionMetric}>
              <Text style={styles.modelDecisionLabel}>STABLE SEED WINS</Text>
              <Text style={styles.modelDecisionValue}>{data.lstmCandidate.evaluation.individualSeedWins}</Text>
            </View>
            <View style={[styles.modelStatusBadge, data.lstmCandidate.evaluation.stabilityGatePassed ? styles.modelStatusPassed : styles.modelStatusHold]}>
              <MaterialIcons name={data.lstmCandidate.evaluation.stabilityGatePassed ? 'verified' : 'science'} size={16} color={data.lstmCandidate.evaluation.stabilityGatePassed ? '#166534' : '#92400E'} />
              <Text style={[styles.modelStatusText, { color: data.lstmCandidate.evaluation.stabilityGatePassed ? '#166534' : '#92400E' }]}>
                {data.lstmCandidate.evaluation.stabilityGatePassed ? 'Promoted' : 'Candidate — hold'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.aiInsightCard}>
          <View style={styles.aiHeader}>
            <MaterialIcons name="auto-awesome" size={20} color="#fff" />
            <Text style={styles.aiHeaderText}>EVIDENCE-BASED INSIGHT</Text>
          </View>
          <Text style={styles.aiTitle}>{data.aiInsight.title}</Text>
          <Text style={styles.aiDesc}>{data.aiInsight.desc}</Text>
          
          <View style={styles.aiActionBox}>
            <MaterialIcons name="local-shipping" size={20} color="#fff" />
            <Text style={styles.aiActionText}>{data.aiInsight.action}</Text>
          </View>

          <TouchableOpacity style={styles.aiBtn} onPress={() => Alert.alert(
            'Forecast model decision',
            data.lstmCandidate.evaluation.stabilityGatePassed
              ? 'The TensorFlow candidate passed the stability gate and is eligible for promotion.'
              : `The validated baseline remains active. The LSTM ensemble improved MAE, but only ${data.lstmCandidate.evaluation.individualSeedWins} seeds beat the baseline.`,
          )}>
            <Text style={styles.aiBtnText}>Review Model Decision</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Row */}
      <View style={styles.bottomRow}>
        <View style={styles.financialCard}>
          <Text style={styles.sectionTitle}>BUDGET PLANNING SCENARIO</Text>
          <Text style={[styles.chartDesc, { marginTop: -14, marginBottom: 18 }]}>Uses the two-month validated baseline forecast. Enter CENRO’s approved operating cost per metric ton.</Text>

          <View style={styles.budgetInputRow}>
            <View style={styles.budgetInputGroup}>
              <Text style={styles.budgetLabel}>COST PER METRIC TON (₱)</Text>
              <TextInput
                style={styles.budgetInput}
                value={costPerTonInput}
                onChangeText={setCostPerTonInput}
                keyboardType="decimal-pad"
                placeholder="e.g. 2500"
              />
            </View>
            <View style={styles.budgetInputGroup}>
              <Text style={styles.budgetLabel}>CONTINGENCY (%)</Text>
              <TextInput
                style={styles.budgetInput}
                value={contingencyInput}
                onChangeText={setContingencyInput}
                keyboardType="decimal-pad"
                placeholder="10"
              />
            </View>
          </View>

          <View style={styles.budgetForecastBox}>
            <View>
              <Text style={styles.budgetForecastLabel}>FORECAST MASS</Text>
              <Text style={styles.budgetForecastValue}>{formatAdaptiveMassFromMetricTons(baselineForecastTons)}</Text>
            </View>
            <MaterialIcons name="east" size={22} color="#94A3B8" />
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.budgetForecastLabel}>PLANNING PROJECTION</Text>
              <Text style={styles.budgetProjectionValue}>{budgetConfig.costPerTon > 0 ? formatCurrency(totalBudgetProjection) : 'Rate required'}</Text>
            </View>
          </View>

          {budgetConfig.costPerTon > 0 && (
            <View style={styles.budgetBreakdown}>
              <View style={styles.finRow}><Text style={styles.finLabel}>Base operations</Text><Text style={styles.finValue}>{formatCurrency(baseBudgetProjection)}</Text></View>
              <View style={styles.finRow}><Text style={styles.finLabel}>Contingency ({budgetConfig.contingencyPercent}%)</Text><Text style={styles.finValue}>{formatCurrency(contingencyAmount)}</Text></View>
            </View>
          )}

          <TouchableOpacity style={styles.saveBudgetButton} onPress={saveBudgetPlanningConfig} disabled={savingBudget}>
            {savingBudget ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MaterialIcons name="save" size={17} color="#FFFFFF" />}
            <Text style={styles.saveBudgetButtonText}>{savingBudget ? 'Saving…' : 'Save Planning Assumptions'}</Text>
          </TouchableOpacity>
          <Text style={styles.budgetDisclaimer}>Planning scenario only. It becomes a validated budget forecast after actual cost and expenditure records are linked and backtested.</Text>
        </View>

        <View style={styles.capacityCard}>
          <View style={styles.capHeader}>
            <Text style={styles.sectionTitle}>DISTRICT CAPACITY GRID (DANAO CITY)</Text>
            <View style={styles.capLegend}>
              <View style={styles.capLegendItem}><View style={[styles.dot, { backgroundColor: '#2E8B57' }]} /><Text style={styles.legendText}>STABLE</Text></View>
              <View style={styles.capLegendItem}><View style={[styles.dot, { backgroundColor: '#f59e0b' }]} /><Text style={styles.legendText}>NEAR CAP</Text></View>
              <View style={styles.capLegendItem}><View style={[styles.dot, { backgroundColor: '#ef4444' }]} /><Text style={styles.legendText}>CRITICAL</Text></View>
            </View>
          </View>
          
          <View style={styles.gridColumns}>
            {data.districts.map((district: any) => (
              <View key={district.id} style={styles.gridCol}>
                <View style={[styles.gridBorder, { borderColor: district.color }]} />
                <Text style={styles.gridD}>{district.id}</Text>
                <Text style={styles.gridBrgy}>{district.label}</Text>
                <Text style={styles.gridPct}>{district.pct}%</Text>
                <Text style={[styles.gridStatus, { color: district.color }]}>{district.status}</Text>
              </View>
            ))}
          </View>
          <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 12 }]}>GPS REPORT HOTSPOTS</Text>
          <Text style={styles.chartDesc}>
            {data.hotspotCoverage.geocodedCount} geotagged · {data.hotspotCoverage.missingLocationCount} missing GPS
          </Text>
          <View style={[styles.gridColumns, { marginTop: 12 }]}>
            {data.hotspots.length === 0 ? (
              <Text style={styles.chartDesc}>No unresolved geotagged reports available.</Text>
            ) : data.hotspots.map((hotspot: any, index: number) => (
              <View key={hotspot.id} style={styles.gridCol}>
                <View style={[styles.gridBorder, { borderColor: hotspot.intensity >= 75 ? '#ef4444' : hotspot.intensity >= 40 ? '#f59e0b' : '#2E8B57' }]} />
                <Text style={styles.gridD}>H{index + 1}</Text>
                <Text style={styles.gridBrgy}>{hotspot.latitude.toFixed(4)}, {hotspot.longitude.toFixed(4)}</Text>
                <Text style={styles.gridPct}>{hotspot.reportCount}</Text>
                <Text style={styles.gridStatus}>REPORTS</Text>
              </View>
            ))}
          </View>
          <GpsHeatMap
            points={data.hotspotsAll}
            geocodedCount={data.hotspotCoverage.geocodedCount}
            missingLocationCount={data.hotspotCoverage.missingLocationCount}
          />
          {Platform.OS !== 'web' && (
            <MapView
              style={styles.hotspotMap}
              initialRegion={{ latitude: 10.5200, longitude: 124.0270, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
            >
              {data.hotspotsAll.length > 0 && (
                <Heatmap
                  points={data.hotspotsAll.map((hotspot: any) => ({ latitude: hotspot.latitude, longitude: hotspot.longitude, weight: hotspot.reportCount }))}
                  radius={45}
                  opacity={0.75}
                />
              )}
              {data.hotspotsAll.map((hotspot: any, index: number) => (
                <Marker
                  key={`map-${hotspot.id}`}
                  coordinate={{ latitude: hotspot.latitude, longitude: hotspot.longitude }}
                  title={`Hotspot H${index + 1}`}
                  description={`${hotspot.reportCount} unresolved report${hotspot.reportCount === 1 ? '' : 's'}`}
                />
              ))}
            </MapView>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 32 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 },
  headerSubtitle: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1, marginBottom: 4 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#111827' },
  refreshBadge: { backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  refreshText: { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 0.5 },

  topRow: { flexDirection: 'row', gap: 24, marginBottom: 24 },
  metricCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  metricTitle: { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 0.5, marginBottom: 12 },
  metricValueRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 16, gap: 8 },
  metricValue: { fontSize: 36, fontWeight: 'bold', color: '#111827' },
  metricTrendUp: { fontSize: 14, fontWeight: 'bold', color: '#ef4444' },
  metricSubValue: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  progressBarBg: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  optimizedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F6FBF7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#dcfce7' },
  optimizedText: { fontSize: 11, fontWeight: '700', color: '#2E8B57' },
  efficiencyBars: { flexDirection: 'row', gap: 4, height: 8 },
  effBar: { flex: 1, backgroundColor: '#2E8B57', borderRadius: 4 },

  middleRow: { flexDirection: 'row', gap: 24, marginBottom: 24 },
  chartCard: { flex: 2, backgroundColor: '#fff', borderRadius: 12, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2, overflow: 'hidden' },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 },
  chartTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  chartDesc: { fontSize: 13, color: '#6B7280' },
  legendRow: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDash: { width: 16, height: 3, borderRadius: 1.5 },
  legendText: { fontSize: 10, fontWeight: '700', color: '#6B7280', letterSpacing: 0.5 },
  chartArea: { alignItems: 'flex-start', marginLeft: -20 },
  filterRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  filterChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#FFFFFF' },
  filterChipActive: { borderColor: '#2E8B57', backgroundColor: '#E8F5E9' },
  filterChipText: { fontSize: 10, fontWeight: '700', color: '#6B7280' },
  filterChipTextActive: { color: '#166534' },
  modelChip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 16, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  modelChipActive: { backgroundColor: '#EDE9FE', borderColor: '#8B5CF6' },
  modelChipText: { color: '#6B7280', fontSize: 10, fontWeight: '800' },
  modelChipTextActive: { color: '#6D28D9' },
  modelDecisionRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 14, borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 14, marginTop: 6 },
  modelDecisionMetric: { minWidth: 105 },
  modelDecisionLabel: { color: '#9CA3AF', fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  modelDecisionValue: { color: '#111827', fontSize: 15, fontWeight: '900', marginTop: 3 },
  modelStatusBadge: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16 },
  modelStatusPassed: { backgroundColor: '#DCFCE7' },
  modelStatusHold: { backgroundColor: '#FEF3C7' },
  modelStatusText: { fontSize: 10, fontWeight: '900' },
  hotspotMap: { height: 280, borderRadius: 12, marginTop: 18, overflow: 'hidden' },

  aiInsightCard: { flex: 1, backgroundColor: '#4b6354', borderRadius: 12, padding: 24, justifyContent: 'space-between' },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 },
  aiHeaderText: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  aiTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  aiDesc: { fontSize: 14, color: '#d1fae5', lineHeight: 20, marginBottom: 24 },
  aiActionBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.1)', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', marginBottom: 24 },
  aiActionText: { color: '#fff', fontSize: 13, fontWeight: '500', flex: 1 },
  aiBtn: { backgroundColor: '#fff', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  aiBtnText: { color: '#4b6354', fontWeight: 'bold', fontSize: 14 },

  bottomRow: { flexDirection: 'row', gap: 24, paddingBottom: 40 },
  financialCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#6B7280', letterSpacing: 1, marginBottom: 24 },
  finRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  finLabel: { fontSize: 14, color: '#374151', fontWeight: '500' },
  finValue: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  budgetInputRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  budgetInputGroup: { flex: 1, minWidth: 140 },
  budgetLabel: { color: '#6B7280', fontSize: 9, fontWeight: '900', letterSpacing: 0.5, marginBottom: 6 },
  budgetInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 9, paddingHorizontal: 11, paddingVertical: 10, color: '#111827', backgroundColor: '#FFFFFF' },
  budgetForecastBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, marginTop: 16 },
  budgetForecastLabel: { color: '#64748B', fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  budgetForecastValue: { color: '#111827', fontSize: 20, fontWeight: '900', marginTop: 3 },
  budgetProjectionValue: { color: '#166534', fontSize: 18, fontWeight: '900', marginTop: 3 },
  budgetBreakdown: { paddingVertical: 14 },
  saveBudgetButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#2E8B57', paddingVertical: 11, borderRadius: 9, marginTop: 14 },
  saveBudgetButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  budgetDisclaimer: { color: '#92400E', fontSize: 9, lineHeight: 14, marginTop: 10 },

  capacityCard: { flex: 1.5, backgroundColor: '#fff', borderRadius: 12, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  capHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  capLegend: { flexDirection: 'row', gap: 12 },
  capLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  gridColumns: { flexDirection: 'row', gap: 16, height: 140 },
  gridCol: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 8, padding: 16, justifyContent: 'flex-end', position: 'relative', overflow: 'hidden' },
  gridBorder: { position: 'absolute', left: 0, top: 0, bottom: 0, borderLeftWidth: 4 },
  gridD: { fontSize: 12, color: '#9CA3AF', fontWeight: '700', position: 'absolute', top: 12, left: 16 },
  gridBrgy: { fontSize: 11, color: '#6B7280', position: 'absolute', top: 32, left: 16 },
  gridPct: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  gridStatus: { fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
});
