import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { collection, query, onSnapshot, limit, orderBy } from 'firebase/firestore';
import { db, auth } from '../../../config/firebase';
import {
  COMPLETION_REWARD_TOKENS,
  DEFAULT_REWARD_SOUVENIRS,
  RewardSouvenir,
  addRewardCatalogItem,
  deleteRewardCatalogItem,
  adjustCitizenPoints,
  reconcileCompletedRewardAwards,
} from '../../../services/rewardService';

interface UserScore {
  id: string;
  name: string;
  email: string;
  tokens: number;
  reportCount: number;
  location: string;
  avatar?: string;
  earnedTokens: number;
  spentTokens: number;
}

interface AwardRecord {
  id: string;
  userId: string;
  userName?: string;
  tokens: number;
  reportId?: string;
  reason?: string;
  adjustedBy?: string;
  actorEmail?: string;
  awardedAt?: any;
}

interface RedemptionRecord {
  id: string;
  userId: string;
  userName?: string;
  souvenirId: string;
  souvenirName: string;
  cost: number;
  issuedAt?: any;
}

export default function RewardsTab() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  // Active view tab
  const [activeTab, setActiveTab] = useState<'citizens' | 'catalog' | 'ledger'>('citizens');

  // Search & Data State
  const [searchQuery, setSearchQuery] = useState('');
  const [profiles, setProfiles] = useState<UserScore[]>([]);
  const [awardEntries, setAwardEntries] = useState<AwardRecord[]>([]);
  const [redemptionEntries, setRedemptionEntries] = useState<RedemptionRecord[]>([]);
  const [catalogItems, setCatalogItems] = useState<RewardSouvenir[]>(DEFAULT_REWARD_SOUVENIRS);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);

  // Add Souvenir Modal State
  const [showAddSouvenirModal, setShowAddSouvenirModal] = useState(false);
  const [newSouvenirName, setNewSouvenirName] = useState('');
  const [newSouvenirType, setNewSouvenirType] = useState('');
  const [newSouvenirCost, setNewSouvenirCost] = useState('500');
  const [newSouvenirCategory, setNewSouvenirCategory] = useState('Merchandise');
  const [newSouvenirStock, setNewSouvenirStock] = useState('50');
  const [isSubmittingSouvenir, setIsSubmittingSouvenir] = useState(false);

  // Adjust Points Modal State
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedUserForAdjustment, setSelectedUserForAdjustment] = useState<UserScore | null>(null);
  const [adjustType, setAdjustType] = useState<'add' | 'deduct'>('add');
  const [adjustAmount, setAdjustAmount] = useState('50');
  const [adjustReason, setAdjustReason] = useState('Community Cleanup Drive Participation');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [isSubmittingAdjustment, setIsSubmittingAdjustment] = useState(false);

  // Result & Feedback Modal State
  const [feedbackModal, setFeedbackModal] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  }>({
    visible: false,
    type: 'success',
    title: '',
    message: '',
  });

  const showFeedback = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setFeedbackModal({ visible: true, type, title, message });
  };

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    // 1. Fetch Users
    const qUsers = query(collection(db, 'users'), limit(200));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      const data: UserScore[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.role === 'user') {
          data.push({
            id: docSnap.id,
            name: d.displayName || d.name || 'Citizen Member',
            email: d.email || '',
            tokens: 0,
            earnedTokens: 0,
            spentTokens: 0,
            reportCount: 0,
            location: d.barangay || 'Danao City',
            avatar: d.photoURL,
          });
        }
      });
      setProfiles(data);
      setLoading(false);
    });

    // 2. Fetch Awards & Point Transactions
    const unsubscribeAwards = onSnapshot(collection(db, 'reward_awards'), (snapshot) => {
      const records: AwardRecord[] = snapshot.docs.map((item) => {
        const d = item.data();
        return {
          id: item.id,
          userId: String(d.userId || ''),
          userName: d.userName,
          tokens: Number(d.tokens || 0),
          reportId: d.reportId,
          reason: d.reason,
          adjustedBy: d.adjustedBy,
          actorEmail: d.actorEmail,
          awardedAt: d.awardedAt,
        };
      });
      // Sort newest first
      records.sort((a, b) => {
        const left = a.awardedAt?.toMillis ? a.awardedAt.toMillis() : new Date(a.awardedAt || 0).getTime();
        const right = b.awardedAt?.toMillis ? b.awardedAt.toMillis() : new Date(b.awardedAt || 0).getTime();
        return right - left;
      });
      setAwardEntries(records);
    });

    // 3. Fetch Redemptions
    const unsubscribeRedemptions = onSnapshot(collection(db, 'reward_redemptions'), (snapshot) => {
      const redemptions: RedemptionRecord[] = snapshot.docs.map((item) => {
        const d = item.data();
        return {
          id: item.id,
          userId: String(d.userId || ''),
          userName: d.userName,
          souvenirId: String(d.souvenirId || ''),
          souvenirName: String(d.souvenirName || 'Souvenir'),
          cost: Number(d.cost || 0),
          issuedAt: d.issuedAt,
        };
      });
      redemptions.sort((a, b) => {
        const left = a.issuedAt?.toMillis ? a.issuedAt.toMillis() : new Date(a.issuedAt || 0).getTime();
        const right = b.issuedAt?.toMillis ? b.issuedAt.toMillis() : new Date(b.issuedAt || 0).getTime();
        return right - left;
      });
      setRedemptionEntries(redemptions);
    });

    // 4. Fetch Dynamic Catalog
    const unsubscribeCatalog = onSnapshot(collection(db, 'reward_catalog'), (snapshot) => {
      if (!snapshot.empty) {
        const customItems: RewardSouvenir[] = snapshot.docs.map((d) => ({
          id: d.id,
          name: d.data().name || 'Souvenir',
          type: d.data().type || '',
          cost: Number(d.data().cost || 0),
          stock: Number(d.data().stock || 50),
          category: d.data().category || 'General',
          createdAt: d.data().createdAt,
        }));
        const existingIds = new Set(customItems.map((i) => i.id));
        const merged = [...customItems, ...DEFAULT_REWARD_SOUVENIRS.filter((i) => !existingIds.has(i.id))];
        setCatalogItems(merged);
      } else {
        setCatalogItems(DEFAULT_REWARD_SOUVENIRS);
      }
    });

    return () => {
      unsubscribeUsers();
      unsubscribeAwards();
      unsubscribeRedemptions();
      unsubscribeCatalog();
    };
  }, []);

  // Compute live user scores
  const users = useMemo(() => {
    return profiles
      .map((profile) => {
        const userAwards = awardEntries.filter((item) => item.userId === profile.id);
        const earned = userAwards.reduce((total, item) => total + item.tokens, 0);
        const spent = redemptionEntries
          .filter((item) => item.userId === profile.id)
          .reduce((total, item) => total + item.cost, 0);
        const verifiedReports = userAwards.filter((item) => item.reportId).length;
        return {
          ...profile,
          earnedTokens: Math.max(0, earned),
          spentTokens: spent,
          tokens: Math.max(0, earned - spent),
          reportCount: verifiedReports,
        };
      })
      .sort((a, b) => b.tokens - a.tokens);
  }, [awardEntries, profiles, redemptionEntries]);

  const filteredUsers = useMemo(() => {
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.location.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, searchQuery]);

  // Combined chronological ledger
  const combinedLedger = useMemo(() => {
    const events: {
      id: string;
      date: any;
      type: 'earned' | 'adjusted' | 'redeemed';
      userName: string;
      userId: string;
      delta: number;
      label: string;
      meta: string;
      actor: string;
    }[] = [];

    awardEntries.forEach((aw) => {
      const user = profiles.find((p) => p.id === aw.userId);
      const name = aw.userName || user?.name || 'Citizen';
      const isAdjustment = aw.reason?.includes('dict_adjustment') || aw.reason?.includes('dict_manual');
      events.push({
        id: aw.id,
        date: aw.awardedAt,
        type: isAdjustment ? 'adjusted' : 'earned',
        userName: name,
        userId: aw.userId,
        delta: aw.tokens,
        label: isAdjustment ? (aw.reason?.replace('dict_adjustment: ', '') || 'DICT Adjustment') : 'Verified Pickup Reward',
        meta: aw.reportId ? `Report #${aw.reportId.slice(0, 8)}` : (aw.adjustedBy || 'DICT Super Admin'),
        actor: aw.actorEmail || aw.adjustedBy || 'System Driver Verification',
      });
    });

    redemptionEntries.forEach((red) => {
      const user = profiles.find((p) => p.id === red.userId);
      const name = red.userName || user?.name || 'Citizen';
      events.push({
        id: red.id,
        date: red.issuedAt,
        type: 'redeemed',
        userName: name,
        userId: red.userId,
        delta: -red.cost,
        label: `Redeemed: ${red.souvenirName}`,
        meta: `Souvenir Claimed`,
        actor: 'Citizen Self-Redemption',
      });
    });

    events.sort((a, b) => {
      const left = a.date?.toMillis ? a.date.toMillis() : new Date(a.date || 0).getTime();
      const right = b.date?.toMillis ? b.date.toMillis() : new Date(b.date || 0).getTime();
      return right - left;
    });

    return events;
  }, [awardEntries, redemptionEntries, profiles]);

  // Handlers
  const handleOpenAddSouvenir = () => {
    setNewSouvenirName('');
    setNewSouvenirType('');
    setNewSouvenirCost('500');
    setNewSouvenirCategory('Merchandise');
    setNewSouvenirStock('50');
    setShowAddSouvenirModal(true);
  };

  const handleCreateSouvenirSubmit = async () => {
    if (!newSouvenirName.trim() || !newSouvenirType.trim()) {
      showFeedback('Validation Error', 'Please provide a name and specification for the souvenir.', 'error');
      return;
    }

    const costNum = parseInt(newSouvenirCost, 10);
    if (isNaN(costNum) || costNum <= 0) {
      showFeedback('Validation Error', 'Token cost must be a valid positive number.', 'error');
      return;
    }

    setIsSubmittingSouvenir(true);
    try {
      await addRewardCatalogItem({
        name: newSouvenirName,
        type: newSouvenirType,
        cost: costNum,
        category: newSouvenirCategory,
        stock: parseInt(newSouvenirStock, 10) || 50,
      });

      setShowAddSouvenirModal(false);
      showFeedback('Souvenir Added', `"${newSouvenirName}" is now available in the public citizen rewards catalog!`, 'success');
    } catch (error: any) {
      console.error('Error adding souvenir:', error);
      showFeedback('Error', error.message || 'Failed to add souvenir to catalog.', 'error');
    } finally {
      setIsSubmittingSouvenir(false);
    }
  };

  const handleDeleteSouvenir = async (souvenir: RewardSouvenir) => {
    try {
      await deleteRewardCatalogItem(souvenir.id);
      showFeedback('Souvenir Removed', `"${souvenir.name}" has been removed from the catalog.`, 'info');
    } catch (err: any) {
      console.error('Error deleting souvenir:', err);
      showFeedback('Error', err.message || 'Failed to delete souvenir.', 'error');
    }
  };

  const handleOpenAdjustPoints = (user: UserScore) => {
    setSelectedUserForAdjustment(user);
    setAdjustType('add');
    setAdjustAmount('50');
    setAdjustReason('Community Cleanup Drive Participation');
    setAdjustNotes('');
    setShowAdjustModal(true);
  };

  const handleAdjustPointsSubmit = async () => {
    if (!selectedUserForAdjustment) return;

    const amountNum = parseInt(adjustAmount, 10);
    if (isNaN(amountNum) || amountNum <= 0) {
      showFeedback('Validation Error', 'Please enter a valid positive token amount.', 'error');
      return;
    }

    const delta = adjustType === 'add' ? amountNum : -amountNum;

    if (adjustType === 'deduct' && selectedUserForAdjustment.tokens < amountNum) {
      showFeedback('Validation Error', `Citizen only has ${selectedUserForAdjustment.tokens} tokens. Cannot deduct ${amountNum} tokens.`, 'error');
      return;
    }

    setIsSubmittingAdjustment(true);
    try {
      const fullReason = adjustNotes.trim() ? `${adjustReason} - ${adjustNotes.trim()}` : adjustReason;
      await adjustCitizenPoints(
        selectedUserForAdjustment.id,
        selectedUserForAdjustment.name,
        delta,
        fullReason,
        selectedUserForAdjustment.tokens
      );

      setShowAdjustModal(false);
      showFeedback(
        'Points Adjusted & Logged',
        `Successfully ${delta > 0 ? 'granted' : 'deducted'} ${Math.abs(delta)} tokens for ${selectedUserForAdjustment.name}. The transaction has been recorded in the municipal audit ledger.`,
        'success'
      );
    } catch (error: any) {
      console.error('Error adjusting points:', error);
      showFeedback('Adjustment Error', error.message || 'Failed to adjust citizen points.', 'error');
    } finally {
      setIsSubmittingAdjustment(false);
    }
  };

  const reconcileCompletedPickups = async () => {
    setReconciling(true);
    try {
      const summary = await reconcileCompletedRewardAwards();
      showFeedback(
        'Reward Sync Complete',
        `${summary.awarded} new award(s) issued from ${summary.scanned} completed pickups. ${summary.alreadyAwarded} were already awarded; ${summary.ineligible} lacked verified report evidence.`,
        'success'
      );
    } catch (error: any) {
      console.error(error);
      showFeedback('Sync Error', 'Failed to reconcile completed pickup rewards.', 'error');
    } finally {
      setReconciling(false);
    }
  };

  const exportRegistry = () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      showFeedback('Web export only', 'Open the DICT portal on web to download the registry.', 'info');
      return;
    }
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [
      ['Rank', 'Citizen', 'Email', 'Barangay', 'Available Tokens', 'Earned', 'Spent', 'Verified Reports'].join(','),
      ...filteredUsers.map((user, index) =>
        [
          index + 1,
          user.name,
          user.email,
          user.location,
          user.tokens,
          user.earnedTokens,
          user.spentTokens,
          user.reportCount,
        ]
          .map(escape)
          .join(',')
      ),
    ].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `trashtrack-citizen-rewards-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const formatDate = (val: any) => {
    const d = val?.toDate ? val.toDate() : val ? new Date(val) : null;
    return d && !isNaN(d.getTime()) ? d.toLocaleString() : 'Just now';
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, isMobile && { padding: 16 }]}
      showsVerticalScrollIndicator={true}
    >
      {/* Header */}
      <View style={[styles.header, isMobile && { flexDirection: 'column', gap: 16 }]}>
        <View>
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowBadge}>
              <MaterialIcons name="military-tech" size={14} color="#047857" />
              <Text style={styles.eyebrowText}>DICT ECO REWARDS ENGINE</Text>
            </View>
          </View>
          <Text style={styles.pageTitle}>Citizen Reporter Rewards & Points Hub</Text>
          <Text style={styles.pageDesc}>
            Supervise citizen points, curate the municipality souvenir catalog, and audit point adjustments in Danao City.
          </Text>
        </View>

        <View style={[styles.headerActions, isMobile && { flexDirection: 'column', width: '100%', gap: 8 }]}>
          <TouchableOpacity
            style={[styles.secondaryBtn, isMobile && { justifyContent: 'center' }]}
            onPress={reconcileCompletedPickups}
            disabled={reconciling}
          >
            <MaterialIcons name="sync" size={16} color="#374151" />
            <Text style={styles.secondaryBtnText}>{reconciling ? 'Syncing...' : 'Sync Completed Pickups'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, isMobile && { justifyContent: 'center' }]}
            onPress={exportRegistry}
          >
            <MaterialIcons name="download" size={16} color="#374151" />
            <Text style={styles.secondaryBtnText}>Export Registry</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryBtn, isMobile && { justifyContent: 'center' }]}
            onPress={handleOpenAddSouvenir}
          >
            <MaterialIcons name="add-circle" size={16} color="#FFF" />
            <Text style={styles.primaryBtnText}>+ Add New Souvenir</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Metrics Row */}
      <View style={[styles.summaryGrid, isMobile && { flexDirection: 'column', gap: 12 }]}>
        <View style={styles.summaryBox}>
          <View style={[styles.summaryIconBox, { backgroundColor: '#ECFDF5' }]}>
            <MaterialIcons name="verified" size={22} color="#059669" />
          </View>
          <View>
            <Text style={styles.summaryValue}>{COMPLETION_REWARD_TOKENS}</Text>
            <Text style={styles.summaryLabel}>POINTS PER VERIFIED PICKUP</Text>
          </View>
        </View>

        <View style={styles.summaryBox}>
          <View style={[styles.summaryIconBox, { backgroundColor: '#EFF6FF' }]}>
            <MaterialIcons name="people" size={22} color="#2563EB" />
          </View>
          <View>
            <Text style={styles.summaryValue}>{users.length}</Text>
            <Text style={styles.summaryLabel}>REGISTERED CITIZENS</Text>
          </View>
        </View>

        <View style={styles.summaryBox}>
          <View style={[styles.summaryIconBox, { backgroundColor: '#FDF4FF' }]}>
            <MaterialIcons name="inventory-2" size={22} color="#9333EA" />
          </View>
          <View>
            <Text style={styles.summaryValue}>{catalogItems.length}</Text>
            <Text style={styles.summaryLabel}>CATALOG SOUVENIRS</Text>
          </View>
        </View>

        <View style={styles.summaryBox}>
          <View style={[styles.summaryIconBox, { backgroundColor: '#FFFBEB' }]}>
            <MaterialIcons name="redeem" size={22} color="#D97706" />
          </View>
          <View>
            <Text style={styles.summaryValue}>{redemptionEntries.length}</Text>
            <Text style={styles.summaryLabel}>TOTAL REDEMPTIONS</Text>
          </View>
        </View>
      </View>

      {/* Navigation Tab Bar */}
      <View style={styles.tabBarContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'citizens' && styles.tabButtonActive]}
          onPress={() => setActiveTab('citizens')}
        >
          <MaterialIcons
            name="people-outline"
            size={18}
            color={activeTab === 'citizens' ? '#047857' : '#6B7280'}
          />
          <Text style={[styles.tabButtonText, activeTab === 'citizens' && styles.tabButtonTextActive]}>
            Citizen Points Directory ({users.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'catalog' && styles.tabButtonActive]}
          onPress={() => setActiveTab('catalog')}
        >
          <MaterialIcons
            name="storefront"
            size={18}
            color={activeTab === 'catalog' ? '#047857' : '#6B7280'}
          />
          <Text style={[styles.tabButtonText, activeTab === 'catalog' && styles.tabButtonTextActive]}>
            Souvenirs Catalog & Inventory ({catalogItems.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'ledger' && styles.tabButtonActive]}
          onPress={() => setActiveTab('ledger')}
        >
          <MaterialIcons
            name="history-edu"
            size={18}
            color={activeTab === 'ledger' ? '#047857' : '#6B7280'}
          />
          <Text style={[styles.tabButtonText, activeTab === 'ledger' && styles.tabButtonTextActive]}>
            Points & Audit Ledger ({combinedLedger.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* TAB 1: CITIZEN DIRECTORY & POINTS ADJUSTMENT */}
      {activeTab === 'citizens' && (
        <View style={[styles.mainCard, isMobile && { padding: 14 }]}>
          {/* Top Contributor Spotlight */}
          {users.length > 0 && users[0].tokens > 0 && (
            <View style={[styles.spotlightCard, isMobile && { flexDirection: 'column', alignItems: 'flex-start' }]}>
              <View style={styles.spotlightAvatar}>
                <Text style={styles.spotlightInitial}>{users[0].name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.spotlightInfo}>
                <View style={styles.badge}>
                  <MaterialIcons name="emoji-events" size={14} color="#D97706" />
                  <Text style={styles.badgeText}>Top Municipal Contributor</Text>
                </View>
                <Text style={styles.spotlightName}>{users[0].name}</Text>
                <Text style={styles.spotlightStats}>
                  🪙 {users[0].tokens.toLocaleString()} Available Tokens • {users[0].reportCount} Verified Pickups
                </Text>
              </View>
            </View>
          )}

          {/* Search Toolbar */}
          <View style={styles.toolbar}>
            <View style={styles.searchBox}>
              <MaterialIcons name="search" size={20} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search citizen by name, email, or barangay..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          {/* Citizen Table */}
          <ScrollView
            horizontal={isMobile}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1, minWidth: '100%' }}
            style={{ width: '100%' }}
          >
            <View style={{ minWidth: isMobile ? 700 : '100%', width: '100%' }}>
              <View style={styles.tableHead}>
                <Text style={[styles.th, { width: 50 }]}>RANK</Text>
                <Text style={[styles.th, { flex: 2.2 }]}>CITIZEN PROFILE</Text>
                <Text style={[styles.th, { flex: 1.2 }]}>BARANGAY</Text>
                <Text style={[styles.th, { flex: 1 }]}>VERIFIED REPORTS</Text>
                <Text style={[styles.th, { flex: 1.2 }]}>AVAILABLE BALANCE</Text>
                <Text style={[styles.th, { flex: 1.4, textAlign: 'right' }]}>ACTIONS</Text>
              </View>

              {loading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color="#059669" />
                  <Text style={styles.loadingText}>Loading citizen point records...</Text>
                </View>
              ) : filteredUsers.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="person-search" size={44} color="#D1D5DB" />
                  <Text style={styles.emptyTitle}>No matching citizen accounts found</Text>
                  <Text style={styles.emptySubtitle}>Try changing your search query.</Text>
                </View>
              ) : (
                filteredUsers.map((user, index) => (
                  <View key={user.id} style={styles.tr}>
                    <Text style={[styles.td, { width: 50, fontWeight: '700', color: '#6B7280' }]}>
                      #{index + 1}
                    </Text>

                    <View style={{ flex: 2.2, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={styles.avatarBg}>
                        <Text style={styles.avatarInitial}>{user.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.userName}>{user.name}</Text>
                        <Text style={styles.userEmail}>{user.email}</Text>
                      </View>
                    </View>

                    <View style={{ flex: 1.2 }}>
                      <Text style={styles.userLocation}>{user.location}</Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={styles.reportBadge}>
                        <MaterialIcons name="check-circle" size={13} color="#059669" />
                        <Text style={styles.reportCountText}>{user.reportCount} Verified</Text>
                      </View>
                    </View>

                    <View style={{ flex: 1.2 }}>
                      <View style={styles.tokenBadge}>
                        <Text style={styles.tokenText}>🪙 {user.tokens.toLocaleString()} Tokens</Text>
                      </View>
                    </View>

                    <View style={{ flex: 1.4, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                      <TouchableOpacity
                        style={styles.adjustPointsBtn}
                        onPress={() => handleOpenAdjustPoints(user)}
                        activeOpacity={0.8}
                      >
                        <MaterialIcons name="tune" size={14} color="#047857" />
                        <Text style={styles.adjustPointsBtnText}>Adjust Points</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </View>
      )}

      {/* TAB 2: SOUVENIR CATALOG & INVENTORY */}
      {activeTab === 'catalog' && (
        <View style={[styles.mainCard, isMobile && { padding: 14 }]}>
          <View style={styles.catalogSectionHeader}>
            <View>
              <Text style={styles.catalogSectionTitle}>Active Souvenirs Catalog</Text>
              <Text style={styles.catalogSectionDesc}>
                Citizens can view and choose these souvenirs from their mobile app. You can add new municipal souvenirs or update costs.
              </Text>
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleOpenAddSouvenir}>
              <MaterialIcons name="add-circle" size={16} color="#FFF" />
              <Text style={styles.primaryBtnText}>+ Add New Souvenir</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.catalogGrid}>
            {catalogItems.map((item) => (
              <View key={item.id} style={styles.catalogItemCard}>
                <View style={styles.catalogItemHeader}>
                  <View style={styles.catalogCategoryBadge}>
                    <Text style={styles.catalogCategoryText}>{item.category || 'General'}</Text>
                  </View>
                  {item.createdAt && (
                    <TouchableOpacity
                      style={styles.catalogDeleteBtn}
                      onPress={() => handleDeleteSouvenir(item)}
                    >
                      <MaterialIcons name="delete-outline" size={16} color="#DC2626" />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.catalogIconCircle}>
                  <MaterialIcons name="card-giftcard" size={28} color="#059669" />
                </View>

                <Text style={styles.catalogItemName}>{item.name}</Text>
                <Text style={styles.catalogItemType}>{item.type}</Text>

                <View style={styles.catalogFooter}>
                  <View style={styles.catalogCostBox}>
                    <Text style={styles.catalogCostValue}>{item.cost.toLocaleString()}</Text>
                    <Text style={styles.catalogCostUnit}>TOKENS</Text>
                  </View>
                  <View style={styles.catalogStockBox}>
                    <Text style={styles.catalogStockText}>Stock: {item.stock || 'Available'}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* TAB 3: POINTS & AUDIT LEDGER */}
      {activeTab === 'ledger' && (
        <View style={[styles.mainCard, isMobile && { padding: 14 }]}>
          <View style={styles.catalogSectionHeader}>
            <View>
              <Text style={styles.catalogSectionTitle}>Municipal Points & Redemptions Audit Trail</Text>
              <Text style={styles.catalogSectionDesc}>
                Real-time chronological log of all driver-verified completions, DICT point manipulations, and citizen redemptions.
              </Text>
            </View>
          </View>

          <ScrollView
            horizontal={isMobile}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1, minWidth: '100%' }}
            style={{ width: '100%' }}
          >
            <View style={{ minWidth: isMobile ? 700 : '100%', width: '100%' }}>
              <View style={styles.tableHead}>
                <Text style={[styles.th, { flex: 1.5 }]}>TIMESTAMP</Text>
                <Text style={[styles.th, { flex: 2 }]}>CITIZEN</Text>
                <Text style={[styles.th, { flex: 2.2 }]}>TRANSACTION / REASON</Text>
                <Text style={[styles.th, { flex: 1.2 }]}>DELTA</Text>
                <Text style={[styles.th, { flex: 2 }]}>ACTOR / LOGGED BY</Text>
              </View>

              {combinedLedger.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="receipt-long" size={44} color="#D1D5DB" />
                  <Text style={styles.emptyTitle}>No transaction history recorded yet</Text>
                </View>
              ) : (
                combinedLedger.map((event) => (
                  <View key={event.id} style={styles.tr}>
                    <View style={{ flex: 1.5 }}>
                      <Text style={styles.ledgerTimeText}>{formatDate(event.date)}</Text>
                    </View>

                    <View style={{ flex: 2 }}>
                      <Text style={styles.userName}>{event.userName}</Text>
                    </View>

                    <View style={{ flex: 2.2 }}>
                      <Text style={styles.ledgerLabelText}>{event.label}</Text>
                      <Text style={styles.ledgerMetaText}>{event.meta}</Text>
                    </View>

                    <View style={{ flex: 1.2 }}>
                      <View
                        style={[
                          styles.ledgerDeltaBadge,
                          event.delta > 0 ? styles.ledgerDeltaPositive : styles.ledgerDeltaNegative,
                        ]}
                      >
                        <Text
                          style={[
                            styles.ledgerDeltaText,
                            event.delta > 0 ? { color: '#059669' } : { color: '#DC2626' },
                          ]}
                        >
                          {event.delta > 0 ? `+${event.delta}` : event.delta} TOKENS
                        </Text>
                      </View>
                    </View>

                    <View style={{ flex: 2 }}>
                      <Text style={styles.ledgerActorText}>{event.actor}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </View>
      )}

      {/* MODAL: ADD NEW SOUVENIR */}
      <Modal visible={showAddSouvenirModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isMobile && { width: '92%', padding: 20 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.modalIconCircle, { backgroundColor: '#ECFDF5' }]}>
                  <MaterialIcons name="add-shopping-cart" size={20} color="#059669" />
                </View>
                <Text style={styles.modalTitle}>Add New Souvenir to Catalog</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddSouvenirModal(false)} disabled={isSubmittingSouvenir}>
                <MaterialIcons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
              <View style={styles.modalBody}>
                <View style={styles.formGroup}>
                  <Text style={styles.modalLabel}>SOUVENIR / REWARD NAME *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. Danao City Stainless Tumbler"
                    placeholderTextColor="#9CA3AF"
                    value={newSouvenirName}
                    onChangeText={setNewSouvenirName}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.modalLabel}>CATEGORY</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. Merchandise, Eco Gear, Household"
                    placeholderTextColor="#9CA3AF"
                    value={newSouvenirCategory}
                    onChangeText={setNewSouvenirCategory}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.modalLabel}>SPECIFICATION / DETAILS *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. 500ml Double-Walled Stainless Steel, Matte Green"
                    placeholderTextColor="#9CA3AF"
                    value={newSouvenirType}
                    onChangeText={setNewSouvenirType}
                  />
                </View>

                <View style={styles.formRow}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.modalLabel}>TOKEN COST *</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="500"
                      placeholderTextColor="#9CA3AF"
                      value={newSouvenirCost}
                      onChangeText={setNewSouvenirCost}
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.modalLabel}>AVAILABLE STOCK</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="50"
                      placeholderTextColor="#9CA3AF"
                      value={newSouvenirStock}
                      onChangeText={setNewSouvenirStock}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowAddSouvenirModal(false)}
                disabled={isSubmittingSouvenir}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleCreateSouvenirSubmit}
                disabled={isSubmittingSouvenir}
              >
                {isSubmittingSouvenir ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="check" size={16} color="#FFFFFF" />
                    <Text style={styles.modalSubmitBtnText}>Publish to Catalog</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: ADJUST CITIZEN POINTS */}
      <Modal visible={showAdjustModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isMobile && { width: '92%', padding: 20 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.modalIconCircle, { backgroundColor: '#FEF3C7' }]}>
                  <MaterialIcons name="tune" size={20} color="#D97706" />
                </View>
                <Text style={styles.modalTitle}>Adjust Citizen Points</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAdjustModal(false)} disabled={isSubmittingAdjustment}>
                <MaterialIcons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {selectedUserForAdjustment && (
              <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
                <View style={styles.modalBody}>
                  {/* Citizen Info Summary */}
                  <View style={styles.selectedCitizenBox}>
                    <View style={styles.avatarBg}>
                      <Text style={styles.avatarInitial}>
                        {selectedUserForAdjustment.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userName}>{selectedUserForAdjustment.name}</Text>
                      <Text style={styles.userEmail}>{selectedUserForAdjustment.email}</Text>
                    </View>
                    <View style={styles.tokenBadge}>
                      <Text style={styles.tokenText}>
                        Current: 🪙 {selectedUserForAdjustment.tokens}
                      </Text>
                    </View>
                  </View>

                  {/* Mode Selector */}
                  <View style={styles.formGroup}>
                    <Text style={styles.modalLabel}>ADJUSTMENT ACTION</Text>
                    <View style={styles.adjustTypeRow}>
                      <TouchableOpacity
                        style={[
                          styles.adjustTypeBtn,
                          adjustType === 'add' && styles.adjustTypeBtnActiveGreen,
                        ]}
                        onPress={() => setAdjustType('add')}
                      >
                        <MaterialIcons
                          name="add-circle"
                          size={18}
                          color={adjustType === 'add' ? '#059669' : '#6B7280'}
                        />
                        <Text
                          style={[
                            styles.adjustTypeBtnText,
                            adjustType === 'add' && { color: '#059669', fontWeight: '800' },
                          ]}
                        >
                          Grant Bonus Tokens (+)
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.adjustTypeBtn,
                          adjustType === 'deduct' && styles.adjustTypeBtnActiveRed,
                        ]}
                        onPress={() => setAdjustType('deduct')}
                      >
                        <MaterialIcons
                          name="remove-circle"
                          size={18}
                          color={adjustType === 'deduct' ? '#DC2626' : '#6B7280'}
                        />
                        <Text
                          style={[
                            styles.adjustTypeBtnText,
                            adjustType === 'deduct' && { color: '#DC2626', fontWeight: '800' },
                          ]}
                        >
                          Deduct Tokens (-)
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Amount Input */}
                  <View style={styles.formGroup}>
                    <Text style={styles.modalLabel}>NUMBER OF ECO TOKENS *</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="e.g. 50"
                      placeholderTextColor="#9CA3AF"
                      value={adjustAmount}
                      onChangeText={setAdjustAmount}
                      keyboardType="numeric"
                    />
                  </View>

                  {/* Reason Dropdown / Presets */}
                  <View style={styles.formGroup}>
                    <Text style={styles.modalLabel}>MANDATORY AUDIT REASON *</Text>
                    <View style={styles.presetReasonsContainer}>
                      {[
                        'Community Cleanup Drive Participation',
                        'Special Environmental Citation',
                        'Data Correction / Reconciliation',
                        'Administrative Incentive Bonus',
                      ].map((preset) => (
                        <TouchableOpacity
                          key={preset}
                          style={[
                            styles.presetReasonChip,
                            adjustReason === preset && styles.presetReasonChipActive,
                          ]}
                          onPress={() => setAdjustReason(preset)}
                        >
                          <Text
                            style={[
                              styles.presetReasonText,
                              adjustReason === preset && styles.presetReasonTextActive,
                            ]}
                          >
                            {preset}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Additional Notes */}
                  <View style={styles.formGroup}>
                    <Text style={styles.modalLabel}>ADDITIONAL ADMINISTRATIVE NOTES (OPTIONAL)</Text>
                    <TextInput
                      style={[styles.modalInput, { height: 60 }]}
                      placeholder="e.g. Danao City Coastal Cleanup Drive Sept 2026"
                      placeholderTextColor="#9CA3AF"
                      value={adjustNotes}
                      onChangeText={setAdjustNotes}
                      multiline={true}
                    />
                  </View>

                  {/* Audit Warning Notice */}
                  <View style={styles.auditNoticeBox}>
                    <MaterialIcons name="security" size={16} color="#0369A1" />
                    <Text style={styles.auditNoticeText}>
                      This point manipulation will be permanently logged with your DICT administrator UID and email in the municipal audit ledger.
                    </Text>
                  </View>
                </View>
              </ScrollView>
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowAdjustModal(false)}
                disabled={isSubmittingAdjustment}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalSubmitBtn,
                  adjustType === 'deduct' && { backgroundColor: '#DC2626' },
                ]}
                onPress={handleAdjustPointsSubmit}
                disabled={isSubmittingAdjustment}
              >
                {isSubmittingAdjustment ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="check" size={16} color="#FFFFFF" />
                    <Text style={styles.modalSubmitBtnText}>
                      {adjustType === 'add' ? 'Confirm Token Grant' : 'Confirm Token Deduction'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* FEEDBACK & RESULT DIALOG */}
      <Modal visible={feedbackModal.visible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.resultModalContent, isMobile && { width: '92%', padding: 20 }]}>
            <View
              style={[
                styles.resultIconCircle,
                feedbackModal.type === 'success'
                  ? styles.resultIconSuccess
                  : feedbackModal.type === 'error'
                  ? styles.resultIconError
                  : styles.resultIconInfo,
              ]}
            >
              <MaterialIcons
                name={
                  feedbackModal.type === 'success'
                    ? 'check-circle'
                    : feedbackModal.type === 'error'
                    ? 'error-outline'
                    : 'info-outline'
                }
                size={38}
                color={
                  feedbackModal.type === 'success'
                    ? '#059669'
                    : feedbackModal.type === 'error'
                    ? '#DC2626'
                    : '#2563EB'
                }
              />
            </View>

            <Text style={styles.resultTitle}>{feedbackModal.title}</Text>
            <Text style={styles.resultSubtitle}>{feedbackModal.message}</Text>

            <TouchableOpacity
              style={[
                styles.resultActionBtn,
                feedbackModal.type === 'error' && { backgroundColor: '#DC2626' },
              ]}
              onPress={() => setFeedbackModal((prev) => ({ ...prev, visible: false }))}
              activeOpacity={0.85}
            >
              <Text style={styles.resultActionBtnText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 32,
    paddingBottom: 64,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  eyebrowRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  eyebrowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  eyebrowText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
    letterSpacing: 0.5,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  pageDesc: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 20,
    maxWidth: 720,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  secondaryBtnText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },

  // Summary Metrics Grid
  summaryGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  summaryBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  summaryIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    marginTop: 2,
    letterSpacing: 0.4,
  },

  // Tab Bar
  tabBarContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 4,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#ECFDF5',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  tabButtonTextActive: {
    color: '#047857',
    fontWeight: '800',
  },

  // Main Card
  mainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },

  // Spotlight
  spotlightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  spotlightAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotlightInitial: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  spotlightInfo: {
    flex: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
  },
  spotlightName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  spotlightStats: {
    fontSize: 12,
    color: '#78350F',
    marginTop: 2,
    fontWeight: '600',
  },

  // Toolbar
  toolbar: {
    marginBottom: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#111827',
    padding: 0,
  },

  // Table
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 8,
  },
  th: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  td: {
    fontSize: 13,
    color: '#1F2937',
  },
  avatarBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: '800',
    color: '#047857',
  },
  userName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  userEmail: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  userLocation: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '600',
  },
  reportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  reportCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  tokenBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tokenText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065F46',
  },
  adjustPointsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  adjustPointsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },

  // Catalog Tab Styles
  catalogSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  catalogSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  catalogSectionDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 3,
    maxWidth: 600,
  },
  catalogGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  catalogItemCard: {
    flexBasis: '31%',
    flexGrow: 1,
    minWidth: 240,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 16,
  },
  catalogItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  catalogCategoryBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  catalogCategoryText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4338CA',
  },
  catalogDeleteBtn: {
    padding: 4,
  },
  catalogIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  catalogItemName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  catalogItemType: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 14,
    minHeight: 32,
  },
  catalogFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  catalogCostBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  catalogCostValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#059669',
  },
  catalogCostUnit: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
  },
  catalogStockBox: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  catalogStockText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },

  // Ledger Styles
  ledgerTimeText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  ledgerLabelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  ledgerMetaText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  ledgerDeltaBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ledgerDeltaPositive: {
    backgroundColor: '#ECFDF5',
  },
  ledgerDeltaNegative: {
    backgroundColor: '#FEF2F2',
  },
  ledgerDeltaText: {
    fontSize: 11,
    fontWeight: '800',
  },
  ledgerActorText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '600',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: 520,
    maxWidth: '96%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  modalBody: {
    padding: 20,
    gap: 16,
  },
  formGroup: {
    gap: 6,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#374151',
    letterSpacing: 0.5,
  },
  modalInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#111827',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FAFAFA',
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  modalSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#059669',
  },
  modalSubmitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Adjustment Modal Specific
  selectedCitizenBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
  },
  adjustTypeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  adjustTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 10,
  },
  adjustTypeBtnActiveGreen: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  adjustTypeBtnActiveRed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  adjustTypeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  presetReasonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetReasonChip: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  presetReasonChipActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
  },
  presetReasonText: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '600',
  },
  presetReasonTextActive: {
    color: '#047857',
    fontWeight: '700',
  },
  auditNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 10,
    padding: 12,
  },
  auditNoticeText: {
    flex: 1,
    fontSize: 11,
    color: '#0369A1',
    lineHeight: 16,
  },

  // Loading & Empty
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#6B7280',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },

  // Result Dialog Styles
  resultModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    width: 420,
    maxWidth: '94%',
    alignItems: 'center',
  },
  resultIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  resultIconSuccess: {
    backgroundColor: '#ECFDF5',
  },
  resultIconError: {
    backgroundColor: '#FEF2F2',
  },
  resultIconInfo: {
    backgroundColor: '#EFF6FF',
  },
  resultTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  resultSubtitle: {
    fontSize: 13,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  resultActionBtn: {
    width: '100%',
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
