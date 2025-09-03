import React from 'react';
import { Text, View } from 'react-native';

export default function TestComponent() {
  return (
    <View className="flex-1 bg-red-500 justify-center items-center">
      <Text className="text-white text-2xl font-bold">NativeWind Test</Text>
      <Text className="text-white text-lg mt-2">If you see this styled, NativeWind is working!</Text>
    </View>
  );
}
