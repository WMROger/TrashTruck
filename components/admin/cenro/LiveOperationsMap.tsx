import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';

export type LiveMapTruck = {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  active: boolean;
};

export type LiveMapReport = {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
};

type Props = { trucks: LiveMapTruck[]; reports: LiveMapReport[] };
const WIDTH = 760;
const HEIGHT = 440;
const BOUNDS = { north: 10.60, south: 10.44, east: 124.10, west: 123.96 };
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
const project = (latitude: number, longitude: number) => ({
  x: clamp(((longitude - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * WIDTH, 20, WIDTH - 20),
  y: clamp(((BOUNDS.north - latitude) / (BOUNDS.north - BOUNDS.south)) * HEIGHT, 20, HEIGHT - 20),
});

export default function LiveOperationsMap({ trucks, reports }: Props) {
  return (
    <View style={styles.wrapper}>
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <Rect width={WIDTH} height={HEIGHT} rx={18} fill="#E8F2E9" />
        {[1, 2, 3, 4].map(index => (
          <G key={`grid-${index}`}>
            <Line x1={(WIDTH / 5) * index} y1={0} x2={(WIDTH / 5) * index} y2={HEIGHT} stroke="#648675" strokeOpacity={0.17} strokeDasharray="5 8" />
            <Line x1={0} y1={(HEIGHT / 5) * index} x2={WIDTH} y2={(HEIGHT / 5) * index} stroke="#648675" strokeOpacity={0.17} strokeDasharray="5 8" />
          </G>
        ))}
        <SvgText x={18} y={26} fill="#526A5A" fontSize={11} fontWeight="800">DANAO CITY LIVE GPS VIEW</SvgText>
        <SvgText x={18} y={HEIGHT - 14} fill="#6B7E71" fontSize={9}>123.96° E</SvgText>
        <SvgText x={WIDTH - 68} y={HEIGHT - 14} fill="#6B7E71" fontSize={9}>124.10° E</SvgText>

        {reports.map((report, index) => {
          const point = project(report.latitude, report.longitude);
          return (
            <G key={`report-${report.id}`}>
              <Circle cx={point.x} cy={point.y} r={13} fill="#DC2626" opacity={0.18} />
              <Circle cx={point.x} cy={point.y} r={6} fill="#DC2626" stroke="#FFFFFF" strokeWidth={2} />
              <SvgText x={point.x} y={point.y - 11} textAnchor="middle" fill="#991B1B" fontSize={8} fontWeight="800">R{index + 1}</SvgText>
            </G>
          );
        })}

        {trucks.map((truck, index) => {
          const point = project(truck.latitude, truck.longitude);
          const color = truck.active ? '#15803D' : '#64748B';
          return (
            <G key={`truck-${truck.id}`}>
              <Circle cx={point.x} cy={point.y} r={18} fill={color} opacity={0.16} />
              <Circle cx={point.x} cy={point.y} r={11} fill={color} stroke="#FFFFFF" strokeWidth={3} />
              <SvgText x={point.x} y={point.y + 3.5} textAnchor="middle" fill="#FFFFFF" fontSize={8} fontWeight="900">T{index + 1}</SvgText>
              <SvgText x={point.x} y={point.y + 29} textAnchor="middle" fill="#334155" fontSize={8} fontWeight="700">{truck.label.slice(0, 16)}</SvgText>
            </G>
          );
        })}

        {!trucks.length && !reports.length && (
          <SvgText x={WIDTH / 2} y={HEIGHT / 2} textAnchor="middle" fill="#64748B" fontSize={14} fontWeight="700">
            Waiting for driver GPS or geotagged report data
          </SvgText>
        )}
      </Svg>
      <View style={styles.legend}>
        <View style={[styles.dot, { backgroundColor: '#15803D' }]} /><Text style={styles.legendText}>Active truck</Text>
        <View style={[styles.dot, { backgroundColor: '#64748B' }]} /><Text style={styles.legendText}>Inactive truck</Text>
        <View style={[styles.dot, { backgroundColor: '#DC2626' }]} /><Text style={styles.legendText}>Open report</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: '#C7D8CB', backgroundColor: '#E8F2E9' },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 7, paddingVertical: 10, backgroundColor: '#FFFFFF' },
  dot: { width: 9, height: 9, borderRadius: 5, marginLeft: 8 },
  legendText: { color: '#5B6B60', fontSize: 9, fontWeight: '700' },
});
