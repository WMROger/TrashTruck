import { useAuthContext } from '@/components/AuthContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { db } from '@/config/firebase';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { formatAdaptiveMassFromMetricTons } from '@/utils/wasteUnits';

export default function ProfilePage() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthContext();
  const router = useRouter();
  
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [userRank, setUserRank] = useState<{ rank: number, points: number, pointsToNext: number }>({ rank: 0, points: 0, pointsToNext: 0 });
  const [recentActivity, setRecentActivity] = useState<any>(null);
  const [userBarangay, setUserBarangay] = useState<string>("");
  
  useEffect(() => {
    const fetchLeaderboardData = async () => {
      if (!db || !user?.uid) return;
      
      try {
        // Security rules expose only the signed-in resident's reports. Community
        // rankings should eventually come from a server-generated public summary.
        const reportsSnap = await getDocs(query(
          collection(db, "reports"),
          where('userId', '==', user.uid)
        ));
        const myReports: any[] = [];
        
        reportsSnap.forEach(doc => {
          const data = doc.data();
          myReports.push(data);
        });
        
        const profileSnapshot = await getDoc(doc(db, 'users', user.uid));
        const profile = profileSnapshot.data();
        const myPoints = myReports.length * 50;
        setUserBarangay(profile?.barangay || '');
        setLeaderboard([{
          id: user.uid,
          displayName: profile?.displayName || user.displayName || 'Resident',
          points: myPoints,
        }]);
        setUserRank({ rank: 1, points: myPoints, pointsToNext: 0 });
        
        // Find recent activity from already fetched reports (client-side sort to avoid index errors)
        if (myReports.length > 0) {
          myReports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setRecentActivity(myReports[0]);
        }
      } catch (error) {
        console.error("Error fetching profile data:", error);
      }
    };
    
    fetchLeaderboardData();
  }, [user?.displayName, user?.uid]);
  
  // Dynamic data mapping
  const userName = user?.displayName || "Resident";
  const userLevel = `LEVEL ${Math.floor(userRank.points / 500) + 1}`;
  const tagline = "Eco-Conscious Resident";
  const wasteDiverted = `${formatAdaptiveMassFromMetricTons(userRank.points / 50 * 0.0025)} Waste Diverted`;
  const userLocation = userBarangay ? `Barangay ${userBarangay}` : "Local Community";
  const impactGoal = userRank.pointsToNext > 0 ? Math.floor(100 - (userRank.pointsToNext / 500) * 100) : 100;

  return (
    <View style={[styles.container, { backgroundColor: '#C8E6C9' }]}>
      <ScrollView 
        style={styles.scrollContent} 
        contentContainerStyle={{ paddingTop: Math.max(insets.top, 20), paddingBottom: Math.max(insets.bottom, 20) + 100 }}
      >
        

        {/* User Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View>
              <Text style={styles.userName}>{userName}</Text>
              <Text style={styles.tagline}>{tagline}</Text>
            </View>
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>{userLevel}</Text>
            </View>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statBadge}>
              <IconSymbol name="mappin.circle" size={16} color="#4A6741" />
              <Text style={styles.statText}>{userLocation}</Text>
            </View>
            <View style={styles.statBadge}>
              <IconSymbol name="leaf" size={16} color="#4A6741" />
              <Text style={styles.statText}>{wasteDiverted}</Text>
            </View>
          </View>

          <View style={styles.goalContainer}>
            <Text style={styles.goalTitle}>Monthly Impact Goal</Text>
            <Text style={styles.goalPercentage}>{impactGoal}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${impactGoal}%` }]} />
          </View>
        </View>

        {/* Privacy-safe personal impact summary */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Eco Impact</Text>
          <Text style={styles.viewAllText}>Private summary</Text>
        </View>

          <View style={styles.rankCard}>
            <View style={styles.rankCardTop}>
              <View style={styles.rankNumberBadge}>
                <Text style={styles.rankNumberText}>★</Text>
              </View>
              <View style={styles.rankDetails}>
                <Text style={styles.rankLabel}>YOUR IMPACT POINTS</Text>
                <Text style={styles.rankPoints}>{userRank.points.toLocaleString()} pts</Text>
              </View>
              <View style={styles.nextRankDetails}>
                <Text style={styles.nextRankLabel}>VERIFIED ACTIVITY</Text>
                <Text style={styles.pointsToGo}>{Math.floor(userRank.points / 50)} report(s)</Text>
              </View>
            </View>
            <View style={styles.rankProgressBarContainer}>
               <View style={styles.rankProgressBarBg}>
                  <View style={[styles.rankProgressBarFill, { width: `${userRank.pointsToNext > 0 ? (userRank.points / (userRank.points + userRank.pointsToNext)) * 100 : 100}%` }]} />
               </View>
            </View>
          </View>
  
          <View style={styles.leaderboardList}>
            {leaderboard.map((u, index) => (
              <View key={u.id} style={styles.leaderboardRow}>
                <Text style={[styles.leaderboardRank, { color: index === 0 ? '#F59E0B' : index === 1 ? '#9E9E9E' : '#8D6E63' }]}>
                  {index + 1}
                </Text>
                <View style={styles.leaderboardAvatarBg}>
                  <IconSymbol name="person.fill" size={20} color="#4A6741" />
                </View>
                <Text style={styles.leaderboardName}>{u.displayName}</Text>
                <Text style={styles.leaderboardPoints}>{u.points.toLocaleString()} pts</Text>
              </View>
            ))}
          </View>
  
          {/* Recent Activity */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 24, marginBottom: 12 }}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => router.push('/my-reports')}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#2E7D32' }}>View All →</Text>
            </TouchableOpacity>
          </View>
          {recentActivity ? (
            <TouchableOpacity 
              style={styles.activityCard}
              onPress={() => router.push('/my-reports')}
            >
              <View style={styles.activityIconBg}>
                <IconSymbol name={recentActivity.imageURL ? "camera.fill" : "doc.text"} size={20} color="#2E7D32" />
              </View>
              <View style={styles.activityDetails}>
                <Text style={styles.activityTitle}>{recentActivity.title || "Reported Trash Pile"}</Text>
                <Text style={styles.activityDate}>{new Date(recentActivity.createdAt).toLocaleDateString()} • {recentActivity.barangay}</Text>
              </View>
              <View style={styles.activityPointsContainer}>
                <Text style={styles.activityPoints}>+50 XP</Text>
                <Text style={styles.activityStatus}>{recentActivity.status || "Pending"}</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.activityCard} onPress={() => router.push('/my-reports')}>
              <View style={styles.activityDetails}>
                <Text style={styles.activityDate}>No recent activity yet.</Text>
              </View>
            </TouchableOpacity>
          )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  timeText: {
    fontSize: 15,
    fontWeight: '600',
  },
  timeTextRight: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 4,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  tagline: {
    fontSize: 12,
    color: '#6B7280',
    maxWidth: 160,
  },
  levelBadge: {
    backgroundColor: '#C8E6C9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  levelText: {
    color: '#2E7D32',
    fontWeight: 'bold',
    fontSize: 12,
  },
  statsContainer: {
    marginBottom: 24,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  statText: {
    color: '#4A6741',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
  goalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  goalTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#4B5563',
  },
  goalPercentage: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4A6741',
    borderRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1B5E20',
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4A6741',
  },
  rankCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  rankCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  rankNumberBadge: {
    backgroundColor: '#A5D6A7',
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  rankNumberText: {
    color: '#1B5E20',
    fontSize: 18,
    fontWeight: 'bold',
  },
  rankDetails: {
    flex: 1,
  },
  rankLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4A6741',
    letterSpacing: 0.5,
  },
  rankPoints: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  nextRankDetails: {
    alignItems: 'flex-end',
  },
  nextRankLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4A6741',
    letterSpacing: 0.5,
  },
  pointsToGo: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  rankProgressBarContainer: {
    paddingHorizontal: 4,
  },
  rankProgressBarBg: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  rankProgressBarFill: {
    height: '100%',
    backgroundColor: '#4A6741',
    borderRadius: 4,
  },
  leaderboardList: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  leaderboardRank: {
    fontSize: 18,
    fontWeight: 'bold',
    width: 24,
  },
  leaderboardAvatarBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  leaderboardName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  leaderboardPoints: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4A6741',
  },
  activityCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  activityIconBg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#C8E6C9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  activityDetails: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  activityDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  activityPointsContainer: {
    alignItems: 'flex-end',
  },
  activityPoints: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  activityStatus: {
    fontSize: 12,
    color: '#4A6741',
    fontWeight: '500',
    marginTop: 2,
  },
});
