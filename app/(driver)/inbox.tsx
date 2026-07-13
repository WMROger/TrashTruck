import { Feather } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';

export default function DriverInbox() {
  const notifications = [
    {
      id: 'notif-1',
      type: 'pickup',
      title: 'New Pickup Assigned',
      isNew: true,
      body: 'Zone 4: 12 units of recyclable plastic ready for collection at Sector B. Priority high.',
      time: '2 MINUTES AGO'
    },
    {
      id: 'notif-2',
      type: 'route',
      title: 'Route Update',
      isNew: false,
      body: 'Traffic delay on Main St. Optimized route available via 5th Avenue to save 12 mins.',
      time: '18 MINUTES AGO'
    },
    {
      id: 'notif-3',
      type: 'maintenance',
      title: 'Vehicle Maintenance Alert',
      isNew: false,
      body: 'Tire pressure low in rear-left axle. Please visit the depot for a check-up post-shift.',
      time: '1 HOUR AGO'
    }
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case 'pickup': return <Feather name="truck" size={20} color="#92400E" />;
      case 'route': return <Feather name="map" size={20} color="#065F46" />;
      case 'maintenance': return <Feather name="tool" size={20} color="#065F46" />;
      default: return <Feather name="bell" size={20} color="#1F2937" />;
    }
  };

  const getIconBgColor = (type: string) => {
    switch (type) {
      case 'pickup': return '#FEF3C7';
      case 'route': return '#D1FAE5';
      case 'maintenance': return '#D1FAE5';
      default: return '#F3F4F6';
    }
  };

  const getCardBgColor = (type: string, isNew: boolean) => {
    if (isNew && type === 'pickup') return '#FEF3C7';
    return '#F9FAFB';
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4FBF1" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      <Text style={styles.statusFeed}>STATUS FEED</Text>
      <Text style={styles.stayUpdated}>Stay Updated</Text>

      <View style={styles.notificationList}>
        {notifications.length > 0 ? (
          notifications.map(notif => (
            <View 
              key={notif.id} 
              style={[styles.notificationCard, { backgroundColor: getCardBgColor(notif.type, notif.isNew) }]}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconWrapper, { backgroundColor: getIconBgColor(notif.type) }]}>
                  {getIcon(notif.type)}
                </View>
                <View style={styles.titleWrapper}>
                  <Text style={styles.cardTitle}>{notif.title}</Text>
                  {notif.isNew && (
                    <View style={styles.newBadge}>
                      <Text style={styles.newBadgeText}>NEW</Text>
                    </View>
                  )}
                </View>
              </View>
              <Text style={styles.cardBody}>{notif.body}</Text>
              <Text style={styles.cardTime}>{notif.time}</Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Feather name="bell-off" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>No notifications yet</Text>
            <Text style={styles.emptySubtext}>You will see new updates and alerts here.</Text>
          </View>
        )}
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4FBF1',
    paddingHorizontal: 20,
  },
  header: {
    marginTop: 60,
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  statusFeed: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#5A755E',
    letterSpacing: 1,
    marginBottom: 4,
  },
  stayUpdated: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 24,
  },
  notificationList: {
    gap: 16,
  },
  notificationCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  titleWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  newBadge: {
    backgroundColor: '#92400E',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  newBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardBody: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 16,
  },
  cardTime: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#9CA3AF',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    marginTop: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
});
