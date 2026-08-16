import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Line, Polyline, Rect, Stop, Text as SvgText } from 'react-native-svg';

export type ReplayPoint = {
  id: string;
  latitude: number;
  longitude: number;
  speedKph: number;
  timestampMs: number;
};

type Props = { points: ReplayPoint[]; activeIndex: number };
const WIDTH = 900;
const HEIGHT = 360;

export default function FleetReplayMap({ points, activeIndex }: Props) {
  const valid = points.filter(point => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
  const latitudes = valid.map(point => point.latitude);
  const longitudes = valid.map(point => point.longitude);
  const minLat = valid.length ? Math.min(...latitudes) : 10.44;
  const maxLat = valid.length ? Math.max(...latitudes) : 10.60;
  const minLng = valid.length ? Math.min(...longitudes) : 123.96;
  const maxLng = valid.length ? Math.max(...longitudes) : 124.10;
  const latPad = Math.max((maxLat - minLat) * 0.15, 0.003);
  const lngPad = Math.max((maxLng - minLng) * 0.15, 0.003);
  const project = (point: ReplayPoint) => ({
    x: 24 + ((point.longitude - (minLng - lngPad)) / ((maxLng + lngPad) - (minLng - lngPad))) * (WIDTH - 48),
    y: 24 + (((maxLat + latPad) - point.latitude) / ((maxLat + latPad) - (minLat - latPad))) * (HEIGHT - 48),
  });
  const projected = valid.map(project);
  const active = valid[Math.max(0, Math.min(activeIndex, valid.length - 1))];
  const activePoint = active ? project(active) : null;

  return (
    <View style={styles.frame}>
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <Defs>
          <LinearGradient id="fleetBg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#F0FDF4" />
            <Stop offset="1" stopColor="#EFF6FF" />
          </LinearGradient>
        </Defs>
        <Rect width={WIDTH} height={HEIGHT} rx={16} fill="url(#fleetBg)" />
        {[1, 2, 3, 4].map(index => (
          <React.Fragment key={`fleet-grid-${index}`}>
            <Line x1={(WIDTH / 5) * index} y1={0} x2={(WIDTH / 5) * index} y2={HEIGHT} stroke="#94A3B8" strokeOpacity={0.16} strokeDasharray="5 8" />
            <Line x1={0} y1={(HEIGHT / 5) * index} x2={WIDTH} y2={(HEIGHT / 5) * index} stroke="#94A3B8" strokeOpacity={0.16} strokeDasharray="5 8" />
          </React.Fragment>
        ))}
        {projected.length > 1 && <Polyline points={projected.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#2563EB" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />}
        {projected.map((point, index) => <Circle key={`trail-${index}`} cx={point.x} cy={point.y} r={index === 0 || index === projected.length - 1 ? 7 : 3} fill={index === 0 ? '#16A34A' : index === projected.length - 1 ? '#DC2626' : '#60A5FA'} stroke="#FFFFFF" strokeWidth={2} />)}
        {activePoint && (
          <>
            <Circle cx={activePoint.x} cy={activePoint.y} r={16} fill="#F59E0B" opacity={0.24} />
            <Circle cx={activePoint.x} cy={activePoint.y} r={9} fill="#F59E0B" stroke="#FFFFFF" strokeWidth={3} />
            <SvgText x={activePoint.x} y={activePoint.y - 17} textAnchor="middle" fontSize={10} fontWeight="800" fill="#92400E">REPLAY</SvgText>
          </>
        )}
        {!valid.length && <SvgText x={WIDTH / 2} y={HEIGHT / 2} textAnchor="middle" fontSize={14} fontWeight="700" fill="#64748B">No recorded trip points yet</SvgText>}
      </Svg>
      {!!active && <Text style={styles.overlay}>{active.speedKph.toFixed(1)} km/h · {new Date(active.timestampMs).toLocaleTimeString()}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { position: 'relative', overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#F8FAFC' },
  overlay: { position: 'absolute', right: 14, top: 12, backgroundColor: 'rgba(15,23,42,0.82)', color: '#FFFFFF', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, fontSize: 10, fontWeight: '800' },
});
