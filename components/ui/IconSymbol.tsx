// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<string, ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'message.fill': 'chat',
  'person.circle.fill': 'person',
  'rectangle.portrait.and.arrow.right': 'logout',
  'leaf.fill': 'eco',
  'arrow.triangle.2.circlepath': 'refresh',
  'chart.line.uptrend.xyaxis': 'trending-up',
  'person.fill': 'person',
  'person.circle': 'person',
  'bell': 'notifications',
  'lock': 'lock',
  'gear': 'settings',
  'questionmark.circle': 'help',
  'info.circle': 'info',
  // Additional icons used by new tabs
  'calendar': 'event',
  'hand.thumbsup': 'thumb-up',
  'mappin.and.ellipse': 'location-on',
  'star.fill': 'star',
  'hand.thumbsdown': 'thumb-down',
} as IconMapping;

/**
 * An icon component that uses Material Icons on all platforms.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
