import React from 'react';
import { View, Text } from 'react-native';

export default function MapView({ children, style, ...props }: any) {
  return (
    <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#e0e0e0' }]}>
      <Text style={{ color: '#666', textAlign: 'center', padding: 16 }}>
        Interactive Maps are only available on iOS and Android.
      </Text>
    </View>
  );
}

export function Marker({ children, ...props }: any) {
  return null;
}
