import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface CustomTabBarProps extends BottomTabBarButtonProps {
  isFocused?: boolean;
}

export function CustomTabBar(props: CustomTabBarProps) {
  const { isFocused, ...otherProps } = props;

  return (
    <View style={styles.container}>
      {/* White line indicator above selected tab */}
      {isFocused && <View style={styles.indicator} />}
      
      {/* Selected background */}
      {isFocused && <View style={styles.selectedBackground} />}
      
      <PlatformPressable
        {...otherProps}
        style={styles.tabButton}
        onPressIn={(ev) => {
          props.onPressIn?.(ev);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    left: '15%',
    right: '15%',
    height: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    zIndex: 2,
  },
  selectedBackground: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    bottom: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    zIndex: 1,
  },
  tabButton: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    zIndex: 3,
  },
});
