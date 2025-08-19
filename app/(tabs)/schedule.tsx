import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function ScheduleScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme ?? 'light'];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}> 
        <Text style={styles.headerTitle}>Schedule Pickups</Text>
      </View>

      {/* Hero image */}
      <View style={styles.heroCard}>
        <Image
          source={require('../../assets/images/react-logo.png')}
          style={styles.heroImage}
          resizeMode="cover"
        />
      </View>

      {/* Simple calendar mock matching design */}
      <View style={[styles.calendarCard, { backgroundColor: colors.surface }]}> 
        <View style={styles.calendarHeader}> 
          <Text style={styles.calendarMonth}>January 2022</Text>
        </View>
        <View style={styles.calendarGrid}>
          {Array.from({ length: 35 }).map((_, index) => (
            <View key={index} style={styles.calendarCell}>
              <Text style={styles.calendarDay}>{index + 1 <= 31 ? index + 1 : ''}</Text>
            </View>
          ))}
        </View>
       
      </View>

      {/* Pickup location info */}
      <View style={styles.infoSection}>
        <Text style={[styles.infoTitle, { color: colors.textSecondary }]}>Pickup Location Info</Text>

        <View style={[styles.infoItem, { backgroundColor: colors.surface }]}> 
          <IconSymbol name="mappin.and.ellipse" size={18} color={colors.primary} />
          <Text style={styles.infoText}>Street: Lachlanct Mount View Road</Text>
        </View>
        <View style={[styles.infoItem, { backgroundColor: colors.surface }]}> 
          <IconSymbol name="calendar" size={18} color={colors.primary} />
          <Text style={styles.infoText}>Schedule: August 17, 2025, 7:00 AM - 8:30 AM</Text>
        </View>
        <View style={[styles.infoItem, { backgroundColor: colors.surface }]}> 
          <IconSymbol name="leaf.fill" size={18} color={colors.primary} />
          <Text style={styles.infoText}>Waste Type: Mixed Waste, General Waste</Text>
        </View>
        <View style={[styles.infoItem, { backgroundColor: colors.surface }]}> 
          <IconSymbol name="info.circle" size={18} color={colors.primary} />
          <Text style={styles.infoText}>Reminder: Residents must adhere to pickup rules</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  header: {
    height: 90,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  heroCard: {
    marginTop: 16,
    marginHorizontal: 16,
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  calendarCard: {
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  calendarHeader: {
    marginBottom: 12,
  },
  calendarMonth: {
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: `${100 / 7}%`,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDay: {
    color: '#333',
  },
  fabAIBadge: {
    position: 'absolute',
    bottom: -18,
    left: 60,
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: 'white',
    fontWeight: '700',
  },
  infoSection: {
    marginTop: 32,
    marginHorizontal: 16,
    gap: 10,
  },
  infoTitle: {
    fontWeight: '600',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
  },
  infoText: {
    flex: 1,
  },
});


