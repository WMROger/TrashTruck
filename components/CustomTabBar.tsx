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
      {/* Selected pill background */}
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
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  selectedBackground: {
    position: 'absolute',
    top: 6,
    left: 8,
    right: 8,
    bottom: 6,
    backgroundColor: '#C8E6C9', // light green pill
    borderRadius: 16,
    zIndex: 1,
  },
  tabButton: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  protrudingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  protrudingButton: {
    top: -20,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF', // White matching the tab bar
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0', 
    zIndex: 10,
  },
});
