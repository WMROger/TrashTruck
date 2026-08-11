import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

type HeatPoint = {
  id: string;
  latitude: number;
  longitude: number;
  reportCount: number;
  intensity: number;
};

type Props = {
  points: HeatPoint[];
  geocodedCount: number;
  missingLocationCount: number;
};

const WIDTH = 760;
const HEIGHT = 320;
const BOUNDS = { north: 10.60, south: 10.44, east: 124.10, west: 123.96 };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const project = (latitude: number, longitude: number) => ({
  x: clamp(((longitude - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * WIDTH, 18, WIDTH - 18),
  y: clamp(((BOUNDS.north - latitude) / (BOUNDS.north - BOUNDS.south)) * HEIGHT, 18, HEIGHT - 18),
});

export default function GpsHeatMap({ points, geocodedCount, missingLocationCount }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Danao GPS Report Heat Map</Text>
          <Text style={styles.subtitle}>Higher color intensity means more unresolved reports in the same geographic cell.</Text>
        </View>
        <View style={styles.coverageBadge}>
          <Text style={styles.coverageValue}>{geocodedCount}</Text>
          <Text style={styles.coverageLabel}>mapped</Text>
        </View>
      </View>

      <View style={styles.mapFrame}>
        <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
          <Defs>
            <LinearGradient id="mapBackground" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#ECFDF5" />
              <Stop offset="1" stopColor="#DBEAFE" />
            </LinearGradient>
          </Defs>
          <Rect width={WIDTH} height={HEIGHT} rx={18} fill="url(#mapBackground)" />

          {[1, 2, 3, 4].map(index => (
            <G key={`grid-${index}`}>
              <Line x1={(WIDTH / 5) * index} y1={0} x2={(WIDTH / 5) * index} y2={HEIGHT} stroke="#94A3B8" strokeOpacity={0.18} strokeDasharray="5 7" />
              <Line x1={0} y1={(HEIGHT / 5) * index} x2={WIDTH} y2={(HEIGHT / 5) * index} stroke="#94A3B8" strokeOpacity={0.18} strokeDasharray="5 7" />
            </G>
          ))}

          <SvgText x={18} y={25} fontSize={11} fontWeight="700" fill="#64748B">NORTH DANAO</SvgText>
          <SvgText x={WIDTH - 108} y={HEIGHT - 16} fontSize={10} fill="#64748B">124.10° E</SvgText>
          <SvgText x={14} y={HEIGHT - 16} fontSize={10} fill="#64748B">123.96° E</SvgText>

          {points.map((point, index) => {
            const { x, y } = project(point.latitude, point.longitude);
            const strength = clamp(point.intensity / 100, 0.18, 1);
            const color = point.intensity >= 75 ? '#DC2626' : point.intensity >= 40 ? '#F59E0B' : '#22C55E';
            const radius = 24 + strength * 34;
            return (
              <G key={point.id}>
                <Circle cx={x} cy={y} r={radius} fill={color} opacity={0.09 + strength * 0.08} />
                <Circle cx={x} cy={y} r={radius * 0.62} fill={color} opacity={0.16 + strength * 0.12} />
                <Circle cx={x} cy={y} r={14} fill={color} opacity={0.94} stroke="#FFFFFF" strokeWidth={3} />
                <SvgText x={x} y={y + 4} textAnchor="middle" fontSize={10} fontWeight="900" fill="#FFFFFF">H{index + 1}</SvgText>
                <SvgText x={x} y={y + radius + 13} textAnchor="middle" fontSize={10} fontWeight="700" fill="#334155">
                  {point.reportCount} report{point.reportCount === 1 ? '' : 's'}
                </SvgText>
              </G>
            );
          })}

          {points.length === 0 && (
            <SvgText x={WIDTH / 2} y={HEIGHT / 2} textAnchor="middle" fontSize={14} fontWeight="700" fill="#64748B">
              No unresolved geotagged reports to map
            </SvgText>
          )}
        </Svg>
      </View>

      <View style={styles.footerRow}>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: '#22C55E' }]} /><Text style={styles.legendText}>Low</Text>
          <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} /><Text style={styles.legendText}>Medium</Text>
          <View style={[styles.legendDot, { backgroundColor: '#DC2626' }]} /><Text style={styles.legendText}>High</Text>
        </View>
        <Text style={styles.missingText}>{missingLocationCount} report{missingLocationCount === 1 ? '' : 's'} missing GPS</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 16, borderWidth: 1, borderColor: '#D1FAE5', borderRadius: 16, backgroundColor: '#FFFFFF', padding: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 14 },
  title: { fontSize: 15, fontWeight: '800', color: '#111827' },
  subtitle: { color: '#64748B', fontSize: 11, lineHeight: 16, marginTop: 3 },
  coverageBadge: { minWidth: 68, alignItems: 'center', borderRadius: 12, backgroundColor: '#ECFDF5', paddingHorizontal: 12, paddingVertical: 8 },
  coverageValue: { color: '#047857', fontSize: 18, fontWeight: '900' },
  coverageLabel: { color: '#047857', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  mapFrame: { overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: '#D1D5DB' },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginLeft: 6 },
  legendText: { color: '#64748B', fontSize: 10, fontWeight: '700' },
  missingText: { color: '#92400E', fontSize: 10, fontWeight: '700' },
});
