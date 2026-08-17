import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  limit,
  where,
  getDocs,
} from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { sendInteragencyMessage } from '@/services/dictOversightService';

interface InteragencyMessage {
  id: string;
  subject?: string;
  message: string;
  priority: 'normal' | 'high' | 'urgent';
  channelId?: string;
  senderUid: string;
  senderName?: string;
  senderEmail?: string;
  senderRole?: 'dict' | 'admin' | 'cenro';
  createdAt?: any;
}

interface ChannelItem {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  badgeCount?: number;
  isUrgent?: boolean;
}

const CHANNELS: ChannelItem[] = [
  {
    id: 'general-command',
    name: 'CENRO General Command',
    description: 'Direct dispatch to all municipal waste coordinators & CENRO administrators',
    icon: 'campaign',
  },
  {
    id: 'fleet-ops',
    name: 'Fleet Operations Desk',
    description: 'Route navigation, vehicle maintenance & live dispatch advisories',
    icon: 'local-shipping',
  },
  {
    id: 'urgent-advisories',
    name: 'Hazard & Emergency Directives',
    description: 'High-priority dumpsite investigations and emergency response orders',
    icon: 'warning-amber',
    isUrgent: true,
  },
  {
    id: 'audit-compliance',
    name: 'Compliance & Data Quality',
    description: 'Reporting discrepancies, unmeasured pickups & verification requests',
    icon: 'verified',
  },
];

const QUICK_DISPATCHES = [
  { label: '🚨 Emergency Re-route', subject: 'EMERGENCY: Immediate Route Deviation Required', text: 'All active trucks in the designated district must pause current routes and stand by for priority dispatch.' },
  { label: '📊 Tonnage Report Request', subject: 'DICT DATA REQUEST: Daily Waste Tonnage Logs', text: 'Please upload and confirm the final measurement logs for all completed collection routes today.' },
  { label: '🌧️ Weather Advisory', subject: 'WEATHER DISPATCH: Heavy Rain Precaution', text: 'Severe rainfall anticipated. Ensure compactor trucks avoid low-lying flood corridors and report depot arrival times.' },
  { label: '✅ Collection Acknowledged', subject: 'ACKNOWLEDGEMENT: Municipal Route Completed', text: 'DICT oversight portal has verified and logged today’s barangay collection data into the central ledger.' },
];

export default function CenroCommandTab() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [activeChannelId, setActiveChannelId] = useState<string>('general-command');
  const [messages, setMessages] = useState<InteragencyMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const [inputSubject, setInputSubject] = useState('');
  const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>('normal');
  const [showSubjectInput, setShowSubjectInput] = useState(false);
  const [channelSearch, setChannelSearch] = useState('');
  const [mobileView, setMobileView] = useState<'channels' | 'chat'>('channels');
  const [adminCount, setAdminCount] = useState<number>(0);

  const scrollViewRef = useRef<ScrollView>(null);

  // Fetch admin count for presence indicator
  useEffect(() => {
    if (!db) return;
    const fetchAdminPresence = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
        setAdminCount(snap.size);
      } catch (err) {
        console.error('Error fetching admin count:', err);
      }
    };
    fetchAdminPresence();
  }, []);

  // Listen to messages in real-time
  useEffect(() => {
    if (!db) return;
    setLoading(true);

    const q = query(
      collection(db, 'interagency_messages'),
      orderBy('createdAt', 'asc'),
      limit(150)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs: InteragencyMessage[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as InteragencyMessage));
        setMessages(msgs);
        setLoading(false);
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 150);
      },
      (error) => {
        console.error('Error listening to interagency messages:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const activeChannel = CHANNELS.find((c) => c.id === activeChannelId) || CHANNELS[0];

  // Filter messages by active channel (messages without channelId default to general-command)
  const channelMessages = messages.filter((m) => {
    const channel = m.channelId || 'general-command';
    return channel === activeChannelId;
  });

  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text) return;

    setSending(true);
    try {
      await sendInteragencyMessage({
        message: text,
        subject: inputSubject.trim() || undefined,
        priority,
        channelId: activeChannelId,
        senderRole: 'dict',
        senderName: auth.currentUser?.displayName || 'DICT Controller',
        senderEmail: auth.currentUser?.email || '',
      });

      setInputText('');
      setInputSubject('');
      setShowSubjectInput(false);
      setPriority('normal');
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err) {
      console.error('Send error:', err);
      Alert.alert('Transmission Failed', err instanceof Error ? err.message : 'Could not transmit dispatch.');
    } finally {
      setSending(false);
    }
  };

  const handleApplyQuickDispatch = (template: typeof QUICK_DISPATCHES[0]) => {
    setInputSubject(template.subject);
    setInputText(template.text);
    setShowSubjectInput(true);
  };

  const currentUserId = auth.currentUser?.uid;

  const filteredChannels = CHANNELS.filter((c) =>
    c.name.toLowerCase().includes(channelSearch.toLowerCase()) ||
    c.description.toLowerCase().includes(channelSearch.toLowerCase())
  );

  const getPriorityColor = (p: string) => {
    if (p === 'urgent') return { bg: '#FEE2E2', text: '#B91C1C', border: '#FCA5A5' };
    if (p === 'high') return { bg: '#FEF3C7', text: '#B45309', border: '#FCD34D' };
    return { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' };
  };

  const formatMessageTime = (createdAt: any) => {
    if (!createdAt) return 'Just now';
    if (createdAt?.toDate) {
      const d = createdAt.toDate();
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return 'Just now';
  };

  return (
    <View style={styles.container}>
      {/* Top Banner */}
      <View style={styles.topBanner}>
        <View style={styles.topBannerLeft}>
          <View style={styles.signalBadge}>
            <View style={styles.signalPulse} />
            <Text style={styles.signalText}>DICT ⇄ CENRO SECURE CHANNEL</Text>
          </View>
          <Text style={styles.topBannerTitle}>Inter-Agency Command Messenger</Text>
        </View>

        <View style={styles.topBannerRight}>
          <View style={styles.presencePill}>
            <View style={styles.onlineDot} />
            <Text style={styles.presenceText}>
              {adminCount > 0 ? `${adminCount} CENRO Admin${adminCount === 1 ? '' : 's'} Active` : 'CENRO Standby'}
            </Text>
          </View>
        </View>
      </View>

      {/* Main Two-Pane Messenger Workspace */}
      <View style={styles.messengerWorkspace}>
        {/* Left Channels List Pane */}
        {(!isMobile || mobileView === 'channels') && (
          <View style={[styles.channelsSidebar, isMobile && styles.channelsSidebarMobile]}>
            <View style={styles.channelSearchBox}>
              <MaterialIcons name="search" size={18} color="#94A3B8" />
              <TextInput
                style={styles.channelSearchInput}
                placeholder="Search command channels..."
                placeholderTextColor="#94A3B8"
                value={channelSearch}
                onChangeText={setChannelSearch}
              />
            </View>

            <View style={styles.channelSectionHeader}>
              <Text style={styles.channelSectionTitle}>OFFICIAL DISPATCH CHANNELS</Text>
            </View>

            <ScrollView style={styles.channelList} showsVerticalScrollIndicator={false}>
              {filteredChannels.map((channel) => {
                const isActive = activeChannelId === channel.id;
                const channelMsgCount = messages.filter((m) => (m.channelId || 'general-command') === channel.id).length;
                const lastMsg = [...messages].filter((m) => (m.channelId || 'general-command') === channel.id).pop();

                return (
                  <TouchableOpacity
                    key={channel.id}
                    style={[styles.channelCard, isActive && styles.channelCardActive]}
                    onPress={() => {
                      setActiveChannelId(channel.id);
                      if (isMobile) setMobileView('chat');
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={[
                      styles.channelIconBg,
                      channel.isUrgent ? styles.channelIconUrgent : (isActive ? styles.channelIconActive : styles.channelIconDefault)
                    ]}>
                      <MaterialIcons
                        name={channel.icon}
                        size={20}
                        color={channel.isUrgent ? '#DC2626' : (isActive ? '#FFFFFF' : '#4F46E5')}
                      />
                    </View>

                    <View style={styles.channelMeta}>
                      <View style={styles.channelTitleRow}>
                        <Text style={[styles.channelName, isActive && styles.channelNameActive]} numberOfLines={1}>
                          {channel.name}
                        </Text>
                        {channelMsgCount > 0 && (
                          <View style={[styles.msgCountBadge, isActive && styles.msgCountBadgeActive]}>
                            <Text style={[styles.msgCountText, isActive && styles.msgCountTextActive]}>
                              {channelMsgCount}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.channelDesc} numberOfLines={1}>
                        {lastMsg ? lastMsg.message : channel.description}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Inter-Agency Status Box */}
              <View style={styles.securityInfoCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MaterialIcons name="lock" size={14} color="#059669" />
                  <Text style={styles.securityInfoTitle}>AUDITED DISPATCH CHANNEL</Text>
                </View>
                <Text style={styles.securityInfoDesc}>
                  All dispatches transmitted across this inter-agency console are recorded with cryptographic timestamps into the government oversight audit log.
                </Text>
              </View>
            </ScrollView>
          </View>
        )}

        {/* Right Active Chat Pane */}
        {(!isMobile || mobileView === 'chat') && (
          <KeyboardAvoidingView
            style={styles.chatPane}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {/* Chat Top Bar */}
            <View style={styles.chatHeader}>
              {isMobile && (
                <TouchableOpacity
                  style={styles.mobileBackBtn}
                  onPress={() => setMobileView('channels')}
                >
                  <MaterialIcons name="arrow-back" size={22} color="#1E293B" />
                </TouchableOpacity>
              )}

              <View style={[
                styles.channelHeaderIcon,
                activeChannel.isUrgent ? { backgroundColor: '#FEE2E2' } : { backgroundColor: '#EEF2FF' }
              ]}>
                <MaterialIcons
                  name={activeChannel.icon}
                  size={22}
                  color={activeChannel.isUrgent ? '#DC2626' : '#4F46E5'}
                />
              </View>

              <View style={styles.chatHeaderInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.chatHeaderTitle}>{activeChannel.name}</Text>
                  {activeChannel.isUrgent && (
                    <View style={styles.urgentHeaderBadge}>
                      <Text style={styles.urgentHeaderBadgeText}>HIGH PRIORITY</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.chatHeaderSubtitle}>{activeChannel.description}</Text>
              </View>

              <View style={styles.chatHeaderActions}>
                <TouchableOpacity
                  style={styles.memoToggleBtn}
                  onPress={() => setShowSubjectInput(!showSubjectInput)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="title" size={18} color={showSubjectInput ? '#4F46E5' : '#64748B'} />
                  {!isMobile && (
                    <Text style={[styles.memoToggleText, showSubjectInput && { color: '#4F46E5' }]}>
                      {showSubjectInput ? 'Subject Enabled' : 'Add Subject'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Quick Prompt Chips */}
            <View style={styles.quickPromptBar}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickPromptScroll}>
                <Text style={styles.quickPromptLabel}>QUICK DISPATCH:</Text>
                {QUICK_DISPATCHES.map((tmpl, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.quickPromptChip}
                    onPress={() => handleApplyQuickDispatch(tmpl)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.quickPromptChipText}>{tmpl.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Message Stream */}
            <ScrollView
              ref={scrollViewRef}
              style={styles.messageStream}
              contentContainerStyle={styles.messageStreamContent}
              showsVerticalScrollIndicator={true}
              onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
            >
              {loading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color="#4F46E5" />
                  <Text style={styles.loadingMsg}>Connecting to secure channel...</Text>
                </View>
              ) : channelMessages.length === 0 ? (
                <View style={styles.emptyConversationBox}>
                  <View style={styles.emptyIconBg}>
                    <MaterialIcons name="chat-bubble-outline" size={36} color="#94A3B8" />
                  </View>
                  <Text style={styles.emptyConversationTitle}>No Dispatches on {activeChannel.name}</Text>
                  <Text style={styles.emptyConversationDesc}>
                    Send an operational advisory, priority directive, or status inquiry to CENRO administrators below.
                  </Text>
                </View>
              ) : (
                channelMessages.map((msg, index) => {
                  const isDict = msg.senderRole === 'dict' || msg.senderUid === currentUserId;
                  const pBadge = getPriorityColor(msg.priority);
                  const showDateDivider = index === 0;

                  return (
                    <View key={msg.id || index}>
                      {showDateDivider && (
                        <View style={styles.dateDivider}>
                          <View style={styles.dateLine} />
                          <Text style={styles.dateText}>GOVERNMENT DISPATCH RECORD</Text>
                          <View style={styles.dateLine} />
                        </View>
                      )}

                      <View style={[styles.messageRow, isDict ? styles.messageRowOutgoing : styles.messageRowIncoming]}>
                        {!isDict && (
                          <View style={styles.senderAvatar}>
                            <Text style={styles.senderAvatarText}>
                              {(msg.senderName || 'C').charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}

                        <View style={[
                          styles.messageBubble,
                          isDict ? styles.messageBubbleOutgoing : styles.messageBubbleIncoming,
                          msg.priority === 'urgent' && styles.messageBubbleUrgent
                        ]}>
                          {/* Sender and Priority Row */}
                          <View style={styles.bubbleHeaderRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <Text style={[styles.senderNameText, isDict && styles.senderNameTextOutgoing]}>
                                {isDict ? (msg.senderName || 'DICT Super Admin') : (msg.senderName || 'CENRO Officer')}
                              </Text>
                              <View style={[
                                styles.rolePill,
                                isDict ? styles.rolePillDict : styles.rolePillCenro
                              ]}>
                                <Text style={[
                                  styles.rolePillText,
                                  isDict ? styles.rolePillTextDict : styles.rolePillTextCenro
                                ]}>
                                  {isDict ? 'DICT CONTROLLER' : 'CENRO ADMIN'}
                                </Text>
                              </View>
                            </View>

                            {msg.priority !== 'normal' && (
                              <View style={[styles.priorityBadge, { backgroundColor: pBadge.bg, borderColor: pBadge.border }]}>
                                <Text style={[styles.priorityBadgeText, { color: pBadge.text }]}>
                                  {msg.priority === 'urgent' ? '🚨 URGENT' : '⚡ HIGH'}
                                </Text>
                              </View>
                            )}
                          </View>

                          {/* Optional Subject Header */}
                          {!!msg.subject && (
                            <Text style={[styles.messageSubject, isDict && styles.messageSubjectOutgoing]}>
                              {msg.subject}
                            </Text>
                          )}

                          {/* Message Content */}
                          <Text style={[styles.messageBody, isDict && styles.messageBodyOutgoing]}>
                            {msg.message}
                          </Text>

                          {/* Timestamp and Delivery indicator */}
                          <View style={styles.bubbleFooterRow}>
                            <Text style={[styles.messageTime, isDict && styles.messageTimeOutgoing]}>
                              {formatMessageTime(msg.createdAt)}
                            </Text>
                            {isDict && (
                              <MaterialIcons name="done-all" size={14} color="#C7D2FE" style={{ marginLeft: 4 }} />
                            )}
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            {/* Bottom Messenger Input Console */}
            <View style={styles.inputConsole}>
              {showSubjectInput && (
                <View style={styles.subjectInputRow}>
                  <MaterialIcons name="subject" size={18} color="#6366F1" />
                  <TextInput
                    style={styles.subjectTextInput}
                    placeholder="Dispatch Subject / Memo Title (optional)..."
                    placeholderTextColor="#94A3B8"
                    value={inputSubject}
                    onChangeText={setInputSubject}
                    maxLength={120}
                  />
                  <TouchableOpacity onPress={() => { setInputSubject(''); setShowSubjectInput(false); }}>
                    <MaterialIcons name="close" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Priority Selection Bar */}
              <View style={styles.prioritySelectorBar}>
                <Text style={styles.priorityLabel}>PRIORITY LEVEL:</Text>
                {(['normal', 'high', 'urgent'] as const).map((p) => {
                  const isSelected = priority === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.priorityChip,
                        isSelected && (p === 'urgent' ? styles.priorityUrgentActive : p === 'high' ? styles.priorityHighActive : styles.priorityNormalActive)
                      ]}
                      onPress={() => setPriority(p)}
                    >
                      <Text style={[
                        styles.priorityChipText,
                        isSelected && styles.priorityChipTextActive
                      ]}>
                        {p === 'urgent' ? '🚨 URGENT' : p === 'high' ? '⚡ HIGH' : 'NORMAL'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Message Input Box & Send Button */}
              <View style={styles.composeRow}>
                <TextInput
                  style={styles.messageTextInput}
                  placeholder={`Transmit operational dispatch to ${activeChannel.name}...`}
                  placeholderTextColor="#94A3B8"
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  maxLength={3000}
                />

                <TouchableOpacity
                  style={[
                    styles.sendBtn,
                    (!inputText.trim() || sending) && styles.sendBtnDisabled,
                    priority === 'urgent' && { backgroundColor: '#DC2626' }
                  ]}
                  onPress={handleSendMessage}
                  disabled={!inputText.trim() || sending}
                  activeOpacity={0.8}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <MaterialIcons name="send" size={18} color="#FFFFFF" />
                      {!isMobile && <Text style={styles.sendBtnText}>Transmit</Text>}
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBanner: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 24,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  topBannerLeft: {
    gap: 4,
  },
  signalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  signalPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4F46E5',
  },
  signalText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4F46E5',
    letterSpacing: 1.1,
  },
  topBannerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  topBannerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  presencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  presenceText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },

  /* Workspace Layout */
  messengerWorkspace: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },

  /* Channels Sidebar */
  channelsSidebar: {
    width: 320,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    display: 'flex',
    flexDirection: 'column',
  },
  channelsSidebarMobile: {
    width: '100%',
  },
  channelSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    margin: 16,
    paddingHorizontal: 12,
    height: 40,
  },
  channelSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  channelSectionHeader: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  channelSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  channelList: {
    flex: 1,
    paddingHorizontal: 12,
  },
  channelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  channelCardActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  channelIconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelIconDefault: {
    backgroundColor: '#F1F5F9',
  },
  channelIconActive: {
    backgroundColor: '#4F46E5',
  },
  channelIconUrgent: {
    backgroundColor: '#FEE2E2',
  },
  channelMeta: {
    flex: 1,
  },
  channelTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  channelName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    flex: 1,
  },
  channelNameActive: {
    color: '#4338CA',
    fontWeight: '800',
  },
  msgCountBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 6,
  },
  msgCountBadgeActive: {
    backgroundColor: '#4F46E5',
  },
  msgCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  msgCountTextActive: {
    color: '#FFFFFF',
  },
  channelDesc: {
    fontSize: 11,
    color: '#64748B',
  },
  securityInfoCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    marginBottom: 24,
    gap: 6,
  },
  securityInfoTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.5,
  },
  securityInfoDesc: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },

  /* Right Active Chat Pane */
  chatPane: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    display: 'flex',
    flexDirection: 'column',
  },
  chatHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mobileBackBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  channelHeaderIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatHeaderInfo: {
    flex: 1,
  },
  chatHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  urgentHeaderBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  urgentHeaderBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DC2626',
  },
  chatHeaderSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  chatHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memoToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  memoToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },

  /* Quick Prompt Bar */
  quickPromptBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 8,
  },
  quickPromptScroll: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  quickPromptLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.6,
  },
  quickPromptChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  quickPromptChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },

  /* Message Stream */
  messageStream: {
    flex: 1,
  },
  messageStreamContent: {
    padding: 20,
    paddingBottom: 24,
  },
  loadingBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingMsg: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  emptyConversationBox: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyConversationTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 6,
  },
  emptyConversationDesc: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 400,
    lineHeight: 20,
  },
  dateDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
    gap: 12,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dateText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },

  /* Bubbles */
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
    gap: 10,
  },
  messageRowOutgoing: {
    justifyContent: 'flex-end',
  },
  messageRowIncoming: {
    justifyContent: 'flex-start',
  },
  senderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  senderAvatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  messageBubbleOutgoing: {
    backgroundColor: '#4F46E5',
    borderColor: '#4338CA',
    borderBottomRightRadius: 4,
  },
  messageBubbleIncoming: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderBottomLeftRadius: 4,
  },
  messageBubbleUrgent: {
    borderColor: '#F87171',
  },
  bubbleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  senderNameText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  senderNameTextOutgoing: {
    color: '#FFFFFF',
  },
  rolePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  rolePillDict: {
    backgroundColor: '#3730A3',
  },
  rolePillCenro: {
    backgroundColor: '#ECFDF5',
  },
  rolePillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  rolePillTextDict: {
    color: '#E0E7FF',
  },
  rolePillTextCenro: {
    color: '#059669',
  },
  priorityBadge: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  messageSubject: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 4,
  },
  messageSubjectOutgoing: {
    color: '#EEF2FF',
  },
  messageBody: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
  },
  messageBodyOutgoing: {
    color: '#F8FAFC',
  },
  bubbleFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 6,
  },
  messageTime: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  messageTimeOutgoing: {
    color: '#C7D2FE',
  },

  /* Input Console */
  inputConsole: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    padding: 16,
    gap: 10,
  },
  subjectInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  subjectTextInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  prioritySelectorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.6,
  },
  priorityChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  priorityChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  priorityNormalActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#818CF8',
  },
  priorityHighActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  priorityUrgentActive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
  },
  priorityChipTextActive: {
    color: '#0F172A',
  },
  composeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  messageTextInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    textAlignVertical: 'center',
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 12,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  sendBtnDisabled: {
    opacity: 0.5,
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
  },
  sendBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
