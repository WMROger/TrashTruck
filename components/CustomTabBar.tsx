import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface CustomTabBarProps extends BottomTabBarButtonProps {
  isFocused?: boolean;
  isProtruding?: boolean;
}

export function CustomTabBar(props: CustomTabBarProps) {
  const { isFocused, isProtruding, ...otherProps } = props;

  if (isProtruding) {
    return (
      <View style={styles.protrudingContainer}>
        <PlatformPressable
          {...otherProps}
          style={styles.protrudingButton}
          onPressIn={(ev) => {
            props.onPressIn?.(ev);
          }}
        />
      </View>
    );
  }

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
  protrudingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  protrudingButton: {
    top: -20,
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: '#73946B', // green primary
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
    borderWidth: 4,
    borderColor: '#FFFFFF', 
    zIndex: 10,
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
