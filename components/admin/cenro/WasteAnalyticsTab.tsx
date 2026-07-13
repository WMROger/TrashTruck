import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function WasteAnalyticsTab() {
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
            <Text style={styles.metricValue}>78.4%</Text>
            <Text style={styles.metricTrendUp}>~4.2%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: '78.4%', backgroundColor: '#2E8B57' }]} />
          </View>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricTitle}>BUDGET HEALTH</Text>
          <View style={styles.metricValueRow}>
            <Text style={styles.metricValue}>₱4.2M</Text>
            <Text style={styles.metricSubValue}>/ P5M CAPEX</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: '84%', backgroundColor: '#2E8B57' }]} />
          </View>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricTitle}>COLLECTION EFFICIENCY</Text>
          <View style={styles.metricValueRow}>
            <Text style={styles.metricValue}>96.8%</Text>
            <View style={styles.optimizedBadge}>
              <MaterialIcons name="check-circle" size={12} color="#2E8B57" />
              <Text style={styles.optimizedText}>Optimized</Text>
            </View>
          </View>
          <View style={styles.efficiencyBars}>
            <View style={styles.effBar} />
            <View style={styles.effBar} />
            <View style={styles.effBar} />
            <View style={styles.effBar} />
            <View style={[styles.effBar, { backgroundColor: '#E5E7EB' }]} />
          </View>
        </View>
      </View>

      {/* Middle Row */}
      <View style={styles.middleRow}>
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.chartTitle}>Predictive Intelligence (LSTM)</Text>
              <Text style={styles.chartDesc}>30-Day automated waste tonnage projection model</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDash, { backgroundColor: '#9CA3AF' }]} />
                <Text style={styles.legendText}>HISTORICAL</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDash, { backgroundColor: '#2E8B57' }]} />
                <Text style={styles.legendText}>FORECASTED</Text>
              </View>
            </View>
          </View>
          
          {/* Mock Chart Area */}
          <View style={styles.mockChartArea}>
            <View style={styles.thresholdLine}>
              <Text style={styles.thresholdText}>TONNAGE ALERT THRESHOLD (1,200T)</Text>
            </View>
            {/* Visual representation of chart is mocked with simple shapes for now */}
            <View style={styles.mockGraphPath}>
              <MaterialIcons name="show-chart" size={180} color="#2E8B57" style={{ opacity: 0.5, transform: [{ scaleX: 2 }] }} />
            </View>
            <View style={styles.chartXAxis}>
              <Text style={styles.xLabel}>OCT 12</Text>
              <Text style={styles.xLabel}>OCT 22</Text>
              <Text style={styles.xLabelActive}>NOV 01 (TODAY)</Text>
              <Text style={styles.xLabel}>NOV 11</Text>
              <Text style={styles.xLabel}>NOV 21</Text>
            </View>
          </View>
        </View>

        <View style={styles.aiInsightCard}>
          <View style={styles.aiHeader}>
            <MaterialIcons name="auto-awesome" size={20} color="#fff" />
            <Text style={styles.aiHeaderText}>AI INSIGHT</Text>
          </View>
          <Text style={styles.aiTitle}>District 2 Surge</Text>
          <Text style={styles.aiDesc}>+22% waste output predicted for the next 48h.</Text>
          
          <View style={styles.aiActionBox}>
            <MaterialIcons name="local-shipping" size={20} color="#fff" />
            <Text style={styles.aiActionText}>Deploy 4 auxiliary units at 06:00 AM</Text>
          </View>

          <TouchableOpacity style={styles.aiBtn}>
            <Text style={styles.aiBtnText}>Acknowledge & Deploy</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Row */}
      <View style={styles.bottomRow}>
        <View style={styles.financialCard}>
          <Text style={styles.sectionTitle}>FINANCIAL IMPACT</Text>
          <View style={styles.finRow}>
            <Text style={styles.finLabel}>Biodegradable</Text>
            <Text style={styles.finValue}>₱1.24M</Text>
          </View>
          <View style={styles.finBarBg}><View style={[styles.finBarFill, { width: '80%', backgroundColor: '#2E8B57' }]} /></View>
          
          <View style={styles.finRow}>
            <Text style={styles.finLabel}>Recyclable</Text>
            <Text style={styles.finValue}>₱0.58M</Text>
          </View>
          <View style={styles.finBarBg}><View style={[styles.finBarFill, { width: '40%', backgroundColor: '#4B5563' }]} /></View>
          
          <View style={styles.finRow}>
            <Text style={styles.finLabel}>Hazardous</Text>
            <Text style={styles.finValueError}>₱0.92M</Text>
          </View>
          <View style={styles.finBarBg}><View style={[styles.finBarFill, { width: '60%', backgroundColor: '#9CA3AF' }]} /></View>
        </View>

        <View style={styles.capacityCard}>
          <View style={styles.capHeader}>
            <Text style={styles.sectionTitle}>DISTRICT CAPACITY GRID</Text>
            <View style={styles.capLegend}>
              <View style={styles.capLegendItem}><View style={[styles.dot, { backgroundColor: '#2E8B57' }]} /><Text style={styles.legendText}>STABLE</Text></View>
              <View style={styles.capLegendItem}><View style={[styles.dot, { backgroundColor: '#f59e0b' }]} /><Text style={styles.legendText}>NEAR CAP</Text></View>
              <View style={styles.capLegendItem}><View style={[styles.dot, { backgroundColor: '#ef4444' }]} /><Text style={styles.legendText}>CRITICAL</Text></View>
            </View>
          </View>
          
          <View style={styles.gridColumns}>
            <View style={styles.gridCol}>
              <View style={[styles.gridBorder, { borderColor: '#2E8B57' }]} />
              <Text style={styles.gridD}>D1</Text>
              <Text style={styles.gridPct}>42%</Text>
              <Text style={[styles.gridStatus, { color: '#2E8B57' }]}>STABLE</Text>
            </View>
            <View style={styles.gridCol}>
              <View style={[styles.gridBorder, { borderColor: '#ef4444' }]} />
              <Text style={styles.gridD}>D2</Text>
              <Text style={styles.gridPct}>94%</Text>
              <Text style={[styles.gridStatus, { color: '#ef4444' }]}>SURGE</Text>
            </View>
            <View style={styles.gridCol}>
              <View style={[styles.gridBorder, { borderColor: '#f59e0b' }]} />
              <Text style={styles.gridD}>D3</Text>
              <Text style={styles.gridPct}>76%</Text>
              <Text style={[styles.gridStatus, { color: '#f59e0b' }]}>NEAR CAP</Text>
            </View>
            <View style={styles.gridCol}>
              <View style={[styles.gridBorder, { borderColor: '#2E8B57' }]} />
              <Text style={styles.gridD}>D4</Text>
              <Text style={styles.gridPct}>31%</Text>
              <Text style={[styles.gridStatus, { color: '#2E8B57' }]}>STABLE</Text>
            </View>
          </View>
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
  metricTrendUp: { fontSize: 14, fontWeight: 'bold', color: '#ef4444' }, // Red because more waste = bad? Based on UI screenshot it's red.
  metricSubValue: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  progressBarBg: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  optimizedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F6FBF7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#dcfce7' },
  optimizedText: { fontSize: 11, fontWeight: '700', color: '#2E8B57' },
  efficiencyBars: { flexDirection: 'row', gap: 4, height: 8 },
  effBar: { flex: 1, backgroundColor: '#2E8B57', borderRadius: 4 },

  middleRow: { flexDirection: 'row', gap: 24, marginBottom: 24 },
  chartCard: { flex: 2, backgroundColor: '#fff', borderRadius: 12, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 },
  chartTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  chartDesc: { fontSize: 13, color: '#6B7280' },
  legendRow: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDash: { width: 16, height: 3, borderRadius: 1.5 },
  legendText: { fontSize: 10, fontWeight: '700', color: '#6B7280', letterSpacing: 0.5 },
  mockChartArea: { height: 220, position: 'relative', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  thresholdLine: { position: 'absolute', top: '40%', left: 0, right: 0, borderTopWidth: 1, borderTopColor: '#ef4444', borderStyle: 'dashed', zIndex: 10 },
  thresholdText: { position: 'absolute', right: 0, top: -18, fontSize: 10, fontWeight: 'bold', color: '#ef4444', backgroundColor: '#fff', paddingHorizontal: 4 },
  mockGraphPath: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  chartXAxis: { position: 'absolute', bottom: -24, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between' },
  xLabel: { fontSize: 10, fontWeight: '600', color: '#9CA3AF' },
  xLabelActive: { fontSize: 10, fontWeight: '700', color: '#4B5563' },

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
  finValueError: { fontSize: 16, fontWeight: 'bold', color: '#ef4444' },
  finBarBg: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, marginBottom: 20 },
  finBarFill: { height: '100%', borderRadius: 3 },

  capacityCard: { flex: 1.5, backgroundColor: '#fff', borderRadius: 12, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  capHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  capLegend: { flexDirection: 'row', gap: 12 },
  capLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  gridColumns: { flexDirection: 'row', gap: 16, height: 140 },
  gridCol: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 8, padding: 16, justifyContent: 'flex-end', position: 'relative', overflow: 'hidden' },
  gridBorder: { position: 'absolute', left: 0, top: 0, bottom: 0, borderLeftWidth: 4 },
  gridD: { fontSize: 12, color: '#9CA3AF', fontWeight: '700', position: 'absolute', top: 12, left: 16 },
  gridPct: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  gridStatus: { fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
});
