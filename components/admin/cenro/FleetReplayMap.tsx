import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export type ReplayPoint = {
  id: string;
  latitude: number;
  longitude: number;
  speedKph: number;
  timestampMs: number;
};

type Props = { points: ReplayPoint[]; activeIndex: number };

declare const window: any;
declare const document: any;

const DANAO_DEFAULT_CENTER: [number, number] = [10.5218, 124.0285];

export default function FleetReplayMap({ points, activeIndex }: Props) {
  const mapContainerRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const startMarkerRef = useRef<any>(null);
  const endMarkerRef = useRef<any>(null);
  const activeMarkerRef = useRef<any>(null);
  const waypointsLayerRef = useRef<any>(null);
  const [leafletReady, setLeafletReady] = useState(false);
  const mapIdRef = useRef(`fleet-replay-map-${Math.random().toString(36).substring(2, 9)}`);

  const valid = points.filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
  const active = valid[Math.max(0, Math.min(activeIndex, valid.length - 1))] || null;

  // 1. Ensure Leaflet CSS & JS is loaded on web
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    if (window.L) {
      setLeafletReady(true);
      return;
    }

    // Inject Leaflet CSS & Custom Animations
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);

      const style = document.createElement('style');
      style.id = 'leaflet-custom-anim';
      style.innerHTML = `
        @keyframes pulse {
          0% { transform: scale(0.9); opacity: 0.8; }
          70% { transform: scale(1.4); opacity: 0; }
          100% { transform: scale(0.9); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    // Inject Leaflet JS
    if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => {
        if (window.L && window.L.DomUtil && !(window.L.DomUtil as any)._safeGetPosPatched) {
          const origGetPos = window.L.DomUtil.getPosition;
          window.L.DomUtil.getPosition = function (el: any) {
            if (!el) return new (window.L as any).Point(0, 0);
            try {
              return origGetPos(el) || new (window.L as any).Point(0, 0);
            } catch {
              return new (window.L as any).Point(0, 0);
            }
          };
          (window.L.DomUtil as any)._safeGetPosPatched = true;
        }
        setLeafletReady(true);
      };
      document.head.appendChild(script);
    } else {
      const checkInterval = setInterval(() => {
        if (window.L) {
          clearInterval(checkInterval);
          if (window.L.DomUtil && !(window.L.DomUtil as any)._safeGetPosPatched) {
            const origGetPos = window.L.DomUtil.getPosition;
            window.L.DomUtil.getPosition = function (el: any) {
              if (!el) return new (window.L as any).Point(0, 0);
              try {
                return origGetPos(el) || new (window.L as any).Point(0, 0);
              } catch {
                return new (window.L as any).Point(0, 0);
              }
            };
            (window.L.DomUtil as any)._safeGetPosPatched = true;
          }
          setLeafletReady(true);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }
  }, []);

  // 2. Initialize Leaflet Map
  useEffect(() => {
    if (Platform.OS !== 'web' || !leafletReady || !window.L) return;

    const container = document.getElementById(mapIdRef.current);
    if (!container) return;

    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.stop?.();
        mapInstanceRef.current.off?.();
        mapInstanceRef.current.remove?.();
      } catch {}
      mapInstanceRef.current = null;
    }

    if ((container as any)._leaflet_id) {
      delete (container as any)._leaflet_id;
    }

    try {
      const L = window.L;
      const initialLat = valid.length ? valid[0].latitude : DANAO_DEFAULT_CENTER[0];
      const initialLng = valid.length ? valid[0].longitude : DANAO_DEFAULT_CENTER[1];

      const map = L.map(mapIdRef.current, {
        center: [initialLat, initialLng],
        zoom: 14,
        zoomControl: false,
      });

      // CartoDB Voyager Tile Layer (Modern, high-contrast, crystal clear street names)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      // Add custom zoom control in bottom-right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      mapInstanceRef.current = map;
    } catch (err) {
      console.warn('Leaflet map initialization error:', err);
    }

    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.stop?.();
          mapInstanceRef.current.off?.();
          mapInstanceRef.current.remove?.();
        } catch (e) {}
        mapInstanceRef.current = null;
      }
      const el = document.getElementById(mapIdRef.current);
      if (el && (el as any)._leaflet_id) {
        delete (el as any)._leaflet_id;
      }
    };
  }, [leafletReady]);

  // 3. Draw / Update Route Polyline & Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;
    const L = window.L;
    const map = mapInstanceRef.current;

    // Clear previous layers
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }
    if (startMarkerRef.current) {
      map.removeLayer(startMarkerRef.current);
      startMarkerRef.current = null;
    }
    if (endMarkerRef.current) {
      map.removeLayer(endMarkerRef.current);
      endMarkerRef.current = null;
    }
    if (waypointsLayerRef.current) {
      map.removeLayer(waypointsLayerRef.current);
      waypointsLayerRef.current = null;
    }

    if (!valid.length) {
      map.setView(DANAO_DEFAULT_CENTER, 14);
      return;
    }

    const latLngs = valid.map(p => [p.latitude, p.longitude]);

    // Outer glow + Inner vibrant route polyline
    const polyline = L.polyline(latLngs, {
      color: '#2563EB',
      weight: 5,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);
    polylineRef.current = polyline;

    // Waypoints dots
    const waypointsGroup = L.layerGroup().addTo(map);
    valid.forEach((p, idx) => {
      if (idx === 0 || idx === valid.length - 1) return;
      const circle = L.circleMarker([p.latitude, p.longitude], {
        radius: 4,
        fillColor: '#60A5FA',
        color: '#FFFFFF',
        weight: 1.5,
        fillOpacity: 0.9,
      });
      circle.bindTooltip(`Point #${idx + 1}<br/>${p.speedKph.toFixed(1)} km/h<br/>${new Date(p.timestampMs).toLocaleTimeString()}`, { direction: 'top' });
      waypointsGroup.addLayer(circle);
    });
    waypointsLayerRef.current = waypointsGroup;

    // Start Marker (Green)
    const startIcon = L.divIcon({
      className: 'custom-start-marker',
      html: `
        <div style="background-color: #16A34A; color: white; width: 26px; height: 26px; border-radius: 13px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; border: 2.5px solid white; box-shadow: 0 3px 8px rgba(0,0,0,0.35);">
          A
        </div>
      `,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
    startMarkerRef.current = L.marker([valid[0].latitude, valid[0].longitude], { icon: startIcon })
      .bindTooltip('<b>Route Start (Depot / Origin)</b>', { permanent: false, direction: 'top' })
      .addTo(map);

    // End Marker (Red)
    if (valid.length > 1) {
      const endPoint = valid[valid.length - 1];
      const endIcon = L.divIcon({
        className: 'custom-end-marker',
        html: `
          <div style="background-color: #DC2626; color: white; width: 26px; height: 26px; border-radius: 13px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; border: 2.5px solid white; box-shadow: 0 3px 8px rgba(0,0,0,0.35);">
            B
          </div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      endMarkerRef.current = L.marker([endPoint.latitude, endPoint.longitude], { icon: endIcon })
        .bindTooltip('<b>Route Destination / Latest</b>', { permanent: false, direction: 'top' })
        .addTo(map);
    }

    // Fit map view to complete route
    try {
      map.fitBounds(polyline.getBounds(), { padding: [45, 45], maxZoom: 16 });
    } catch (e) {}
  }, [valid.length, points[0]?.id, leafletReady]);

  // 4. Update Replay Truck Marker Position on Step Change
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L || !active) return;
    const L = window.L;
    const map = mapInstanceRef.current;

    const replayIcon = L.divIcon({
      className: 'custom-replay-marker',
      html: `
        <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 44px; height: 44px; border-radius: 22px; background-color: rgba(245, 158, 11, 0.28); animation: pulse 1.5s infinite;"></div>
          <div style="position: absolute; width: 32px; height: 32px; border-radius: 16px; background-color: #D97706; border: 2.5px solid #FFFFFF; box-shadow: 0 4px 10px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: white; font-size: 16px;">
            🚚
          </div>
          <div style="position: absolute; top: -18px; background: #0F172A; color: #FFFFFF; font-size: 9px; font-weight: 900; padding: 2px 6px; border-radius: 4px; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
            ${active.speedKph.toFixed(0)} km/h
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    if (!activeMarkerRef.current) {
      activeMarkerRef.current = L.marker([active.latitude, active.longitude], {
        icon: replayIcon,
        zIndexOffset: 1000,
      }).addTo(map);
    } else {
      activeMarkerRef.current.setLatLng([active.latitude, active.longitude]);
      activeMarkerRef.current.setIcon(replayIcon);
    }
  }, [active, activeIndex, leafletReady]);

  const handleRecenter = () => {
    if (!mapInstanceRef.current || !polylineRef.current) return;
    try {
      mapInstanceRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [45, 45], maxZoom: 16 });
    } catch (e) {}
  };

  return (
    <View style={styles.frame}>
      {Platform.OS === 'web' ? (
        <div
          id={mapIdRef.current}
          style={{ width: '100%', height: '380px', borderRadius: '16px', zIndex: 1 }}
        />
      ) : (
        <View style={styles.nativeFallback}>
          <MaterialIcons name="map" size={36} color="#2563EB" />
          <Text style={styles.nativeFallbackText}>Live Map Replay</Text>
        </View>
      )}

      {/* Floating Re-center button */}
      {valid.length > 0 && (
        <TouchableOpacity style={styles.recenterBtn} onPress={handleRecenter} activeOpacity={0.8}>
          <MaterialIcons name="my-location" size={16} color="#1E293B" />
          <Text style={styles.recenterText}>Fit Route</Text>
        </TouchableOpacity>
      )}

      {/* Floating Speed & Time Chip */}
      {!!active && (
        <View style={styles.overlayChip}>
          <View style={styles.activeDot} />
          <Text style={styles.overlayText}>
            {active.speedKph.toFixed(1)} km/h · {new Date(active.timestampMs).toLocaleTimeString()}
          </Text>
        </View>
      )}

      {!valid.length && (
        <View style={styles.emptyState}>
          <MaterialIcons name="satellite-alt" size={32} color="#94A3B8" />
          <Text style={styles.emptyStateText}>No recorded trip points yet for this selection.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: 'relative',
    height: 380,
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F1F5F9',
  },
  overlayChip: {
    position: 'absolute',
    right: 14,
    top: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  overlayText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  recenterBtn: {
    position: 'absolute',
    left: 14,
    top: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  recenterText: {
    color: '#1E293B',
    fontSize: 11,
    fontWeight: '800',
  },
  emptyState: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(248, 250, 252, 0.85)',
    zIndex: 500,
  },
  emptyStateText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  nativeFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  nativeFallbackText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
});
