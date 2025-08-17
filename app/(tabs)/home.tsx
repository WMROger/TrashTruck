import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function HomePage() {
  const router = useRouter();
  const { theme } = useTheme();
  const colors = Colors[theme ?? 'light'];

  const handleLogout = () => {
    // Navigate back to splash screen (logout)
    router.replace('/splash');
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.profileSection}>
          <View style={[styles.profileIcon, { backgroundColor: colors.primary }]}>
            <IconSymbol name="person.fill" size={24} color={colors.surface} />
          </View>
          <Text style={[styles.greeting, { color: colors.textPrimary }]}>
            Hello, Pusher!
          </Text>
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.notificationButton}>
            <IconSymbol name="bell.fill" size={24} color={colors.textSecondary} />
            <View style={[styles.notificationBadge, { backgroundColor: colors.error }]}>
              <Text style={[styles.notificationText, { color: colors.surface }]}>1</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsButton}>
            <IconSymbol name="gear" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Featured Image */}
        <View style={styles.featuredImageContainer}>
          <View style={[styles.featuredImage, { backgroundColor: colors.surface }]}>
            <IconSymbol name="person.3.fill" size={60} color={colors.primary} />

            
            {/* <View style={[styles.aiIcon, { backgroundColor: colors.primary }]}>
              <Text style={[styles.aiText, { color: colors.surface }]}>A</Text>
            </View> */}


          </View>
        </View>

        {/* Informational Box */}
        <View style={[styles.infoBox, { backgroundColor: colors.primary }]}>
          <Text style={styles.infoText}>
            Compost your kitchen waste like vegetable peels and eggshells – your plants will love it!
          </Text>
        </View>

        {/* Announcements Section */}
        <View style={styles.announcementsSection}>
          <View style={[styles.sectionDivider, { backgroundColor: colors.textTertiary }]} />
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Announcements
          </Text>
          
          {/* Regular Trash */}
          <View style={[styles.announcementCard, { backgroundColor: '#D9D9D9' }]}>
            <View style={styles.announcementLeft}>
              <IconSymbol name="trash.fill" size={24} color={colors.primary} />
              <View style={styles.announcementText}>
                <Text style={[styles.announcementTitle, { color: colors.textPrimary }]}>
                  Regular Trash
                </Text>
                <Text style={[styles.announcementSubtitle, { color: colors.textSecondary }]}>
                  Every Monday
                </Text>
              </View>
            </View>
            <View style={styles.announcementRight}>
              <Text style={[styles.nextPickupLabel, { color: colors.textSecondary }]}>
                Next pickup:
              </Text>
              <Text style={[styles.nextPickupDate, { color: colors.textPrimary }]}>
                Oct 30
              </Text>
            </View>
          </View>

          {/* Recyclables */}
          <View style={[styles.announcementCard, { backgroundColor: '#D9D9D9' }]}>
            <View style={styles.announcementLeft}>
              <IconSymbol name="arrow.triangle.2.circlepath" size={24} color={colors.primary} />
              <View style={styles.announcementText}>
                <Text style={[styles.announcementTitle, { color: colors.textPrimary }]}>
                  Recyclables
                </Text>
                <Text style={[styles.announcementSubtitle, { color: colors.textSecondary }]}>
                  Every Thursday
                </Text>
              </View>
            </View>
            <View style={styles.announcementRight}>
              <Text style={[styles.nextPickupLabel, { color: colors.textSecondary }]}>
                Next pickup:
              </Text>
              <Text style={[styles.nextPickupDate, { color: colors.textPrimary }]}>
                Nov 2
              </Text>
            </View>
          </View>

          {/* View More Link */}
          <TouchableOpacity style={styles.viewMoreButton}>
            <Text style={[styles.viewMoreText, { color: colors.primary }]}>
              View more
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => router.push('/(tabs)/explore')}
      >
        <IconSymbol name="message.fill" size={24} color={colors.surface} />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 60,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  notificationButton: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  settingsButton: {
    padding: 4,
  },
  content: {
    padding: 20,
    gap: 20,
  },
  featuredImageContainer: {
    alignItems: 'center',
  },
  featuredImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  aiIcon: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoBox: {
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  announcementsSection: {
    gap: 16,
  },
  sectionDivider: {
    height: 1,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  announcementCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  announcementLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  announcementText: {
    gap: 4,
  },
  announcementTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  announcementSubtitle: {
    fontSize: 14,
  },
  announcementRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  nextPickupLabel: {
    fontSize: 12,
  },
  nextPickupDate: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  viewMoreButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  viewMoreText: {
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  fab: {
    position: 'absolute',
    bottom: 0,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
}); 