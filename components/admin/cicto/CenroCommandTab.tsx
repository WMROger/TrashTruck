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
} from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { sendInteragencyMessage } from '@/services/cictoOversightService';

interface InteragencyMessage {
  id: string;
  subject?: string;
  message: string;
  priority: 'normal' | 'high' | 'urgent';
  channelId?: string;
  senderUid: string;
  senderName?: string;
  senderEmail?: string;
  senderRole?: 'cicto' | 'admin' | 'cenro';
  createdAt?: any;
}

interface ChannelItem {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  priority?: 'normal' | 'high' | 'urgent';
}

const CHANNELS: ChannelItem[] = [
  {
    id: 'general-command',
    name: 'Executive Inter-Agency Bridge',
    description: 'Direct command line between CICTO IT Authority and CENRO Operations.',
    icon: 'security',
  },
  {
    id: 'fleet-dispatch',
    name: 'Fleet Dispatch & Routing',
    description: 'Fleet alerts, telemetry anomalies, road obstructions, and real-time reroutes.',
    icon: 'local-shipping',
  },
  {
    id: 'incident-escalation',
    name: 'Hazard & Incident Escalations',
    description: 'Priority citizen hazard reports requiring coordinated city IT & environmental response.',
    icon: 'warning',
    priority: 'high',
  },
  {
    id: 'system-governance',
    name: 'System Governance & Audits',
    description: 'Account provisioning, security audits, database sync, and protocol updates.',
    icon: 'admin-panel-settings',
  },
];

const PRESET_TEMPLATES = [
  { label: '📡 System Audit Passed', text: 'Daily CICTO governance and telemetry integrity audit verified with 0 anomalies.' },
  { label: '⚡ Dispatch Approved', text: 'Municipal collection override request approved. Telemetry routing updated in dispatch engine.' },
  { label: '🔒 Security Advisory', text: 'Reminder: Enforce 5-minute temporary password limit for all newly provisioned officer accounts.' },
];

export default function CenroCommandTab() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [activeChannelId, setActiveChannelId] = useState<string>('general-command');
  const [messages, setMessages] = useState<InteragencyMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const [channelSearch, setChannelSearch] = useState('');
  const [mobileView, setMobileView] = useState<'channels' | 'chat'>('channels');

  const scrollViewRef = useRef<ScrollView>(null);
  const activeChannel = CHANNELS.find((c) => c.id === activeChannelId) || CHANNELS[0];

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const q = query(
      collection(db, 'interagency_messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: InteragencyMessage[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as any),
        }));
        setMessages(list);
        setLoading(false);
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      },
      (err) => {
        console.warn('Interagency chat listener note:', err?.message || err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const channelMessages = messages.filter((m) => {
    if (activeChannelId === 'general-command') {
      return !m.channelId || m.channelId === 'general-command';
    }
    return m.channelId === activeChannelId;
  });

  const handleSendMessage = async (customMessage?: string, priority: 'normal' | 'high' | 'urgent' = 'normal') => {
    const textToSend = (customMessage || inputText).trim();
    if (!textToSend) return;

    if (!auth.currentUser) {
      Alert.alert('Authentication Error', 'You must be signed in as CICTO Administrator.');
      return;
    }

    setSending(true);
    try {
      await sendInteragencyMessage({
        message: textToSend,
        priority,
        channelId: activeChannelId,
        senderRole: 'cicto',
        senderName: auth.currentUser.displayName || 'CICTO Controller',
        senderEmail: auth.currentUser.email || '',
      });

      if (!customMessage) {
        setInputText('');
      }

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 150);
    } catch (err: any) {
      Alert.alert('Transmission Failed', err?.message || 'Could not transmit command dispatch.');
    } finally {
      setSending(false);
    }
  };

  const filteredChannels = CHANNELS.filter(
    (c) =>
      c.name.toLowerCase().includes(channelSearch.toLowerCase()) ||
      c.description.toLowerCase().includes(channelSearch.toLowerCase())
  );

  const currentUserId = auth.currentUser?.uid;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.topHeaderBar}>
        <View style={styles.headerTitleGroup}>
          <View style={styles.agencyBadge}>
            <MaterialIcons name="security" size={16} color="#2DD4BF" />
            <Text style={styles.agencyBadgeText}>CICTO COMMAND & DISPATCH LINE</Text>
          </View>
          <Text style={styles.headerMainTitle}>Direct Oversight of CENRO Operations</Text>
        </View>
        <View style={styles.securityStatusPill}>
          <View style={styles.statusDot} />
          <Text style={styles.securityStatusText}>ENCRYPTED CHANNEL • DANAO LGU</Text>
        </View>
      </View>

      <View style={styles.mainLayout}>
        {(!isMobile || mobileView === 'channels') && (
          <View style={[styles.channelSidebar, isMobile && styles.channelSidebarMobile]}>
            <View style={styles.searchContainer}>
              <MaterialIcons name="search" size={18} color="#94A3B8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search command channels..."
                placeholderTextColor="#94A3B8"
                value={channelSearch}
                onChangeText={setChannelSearch}
              />
            </View>

            <ScrollView style={styles.channelScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.channelSectionHeader}>COMMAND FREQUENCIES</Text>
              {filteredChannels.map((channel) => {
                const isActive = channel.id === activeChannelId;
                const channelMsgCount = messages.filter((m) =>
                  channel.id === 'general-command'
                    ? !m.channelId || m.channelId === 'general-command'
                    : m.channelId === channel.id
                ).length;

                return (
                  <TouchableOpacity
                    key={channel.id}
                    style={[styles.channelItem, isActive && styles.channelItemActive]}
                    onPress={() => {
                      setActiveChannelId(channel.id);
                      if (isMobile) setMobileView('chat');
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.channelIconWrap, isActive && styles.channelIconWrapActive]}>
                      <MaterialIcons
                        name={channel.icon}
                        size={18}
                        color={isActive ? '#FFFFFF' : '#64748B'}
                      />
                    </View>
                    <View style={styles.channelInfo}>
                      <Text style={[styles.channelName, isActive && styles.channelNameActive]} numberOfLines={1}>
                        {channel.name}
                      </Text>
                      <Text style={styles.channelDesc} numberOfLines={1}>
                        {channel.description}
                      </Text>
                    </View>
                    {channelMsgCount > 0 && (
                      <View style={[styles.channelBadge, isActive && styles.channelBadgeActive]}>
                        <Text style={[styles.channelBadgeText, isActive && styles.channelBadgeTextActive]}>
                          {channelMsgCount}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {(!isMobile || mobileView === 'chat') && (
          <View style={styles.chatArea}>
            <View style={styles.chatHeader}>
              {isMobile && (
                <TouchableOpacity style={styles.backButton} onPress={() => setMobileView('channels')}>
                  <MaterialIcons name="arrow-back" size={20} color="#1E293B" />
                </TouchableOpacity>
              )}
              <View style={styles.chatHeaderIcon}>
                <MaterialIcons name={activeChannel.icon} size={20} color="#0D9488" />
              </View>
              <View style={styles.chatHeaderTitleWrap}>
                <Text style={styles.chatHeaderTitle}>{activeChannel.name}</Text>
                <Text style={styles.chatHeaderSubtitle}>{activeChannel.description}</Text>
              </View>
            </View>

            <View style={styles.templateBar}>
              <Text style={styles.templateBarLabel}>DIRECTIVES:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateScroll}>
                {PRESET_TEMPLATES.map((tmpl, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.templateChip}
                    onPress={() => handleSendMessage(tmpl.text, 'normal')}
                    disabled={sending}
                  >
                    <Text style={styles.templateChipText}>{tmpl.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0D9488" />
                <Text style={styles.loadingText}>Connecting to command bridge...</Text>
              </View>
            ) : (
              <ScrollView
                ref={scrollViewRef}
                style={styles.messageScroll}
                contentContainerStyle={styles.messageList}
                showsVerticalScrollIndicator={true}
              >
                {channelMessages.length === 0 ? (
                  <View style={styles.emptyFeed}>
                    <MaterialIcons name="forum" size={48} color="#CBD5E1" />
                    <Text style={styles.emptyFeedTitle}>No Directives Transmitted</Text>
                    <Text style={styles.emptyFeedSubtitle}>
                      Issue an executive directive or operational advisory to CENRO below.
                    </Text>
                  </View>
                ) : (
                  channelMessages.map((msg) => {
                    const isCicto = msg.senderRole === 'cicto' || msg.senderUid === currentUserId;
                    const isCenro = !isCicto;

                    return (
                      <View
                        key={msg.id}
                        style={[
                          styles.messageRow,
                          isCicto ? styles.messageRowCicto : styles.messageRowCenro,
                        ]}
                      >
                        <View
                          style={[
                            styles.messageBubble,
                            isCicto ? styles.messageBubbleCicto : styles.messageBubbleCenro,
                          ]}
                        >
                          <View style={styles.messageHeaderRow}>
                            <View style={styles.senderPill}>
                              <MaterialIcons
                                name={isCicto ? 'security' : 'eco'}
                                size={12}
                                color={isCicto ? '#0D9488' : '#059669'}
                              />
                              <Text
                                style={[
                                  styles.senderNameText,
                                  isCicto ? styles.senderNameCicto : styles.senderNameCenro,
                                ]}
                              >
                                {isCicto ? 'CICTO IT AUTHORITY' : 'CENRO OPERATIONS'}
                              </Text>
                            </View>
                            {msg.priority === 'urgent' && (
                              <View style={styles.urgentBadge}>
                                <Text style={styles.urgentBadgeText}>URGENT</Text>
                              </View>
                            )}
                            {msg.priority === 'high' && (
                              <View style={styles.highBadge}>
                                <Text style={styles.highBadgeText}>PRIORITY</Text>
                              </View>
                            )}
                          </View>

                          {msg.subject && msg.subject !== 'Operational Dispatch' && (
                            <Text style={styles.messageSubject}>{msg.subject}</Text>
                          )}

                          <Text style={styles.messageBody}>{msg.message}</Text>

                          <View style={styles.messageFooter}>
                            <Text style={styles.senderEmail}>
                              {msg.senderName || msg.senderEmail || (isCicto ? 'CICTO Controller' : 'CENRO Officer')}
                            </Text>
                            <Text style={styles.messageTimestamp}>
                              {msg.createdAt?.toDate
                                ? msg.createdAt.toDate().toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'Just now'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            )}

            <View style={styles.inputArea}>
              <TextInput
                style={styles.messageInput}
                placeholder={`Transmit command to CENRO via ${activeChannel.name}...`}
                placeholderTextColor="#94A3B8"
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={3000}
                editable={!sending}
              />
              <View style={styles.actionButtonRow}>
                <TouchableOpacity
                  style={[styles.urgentButton, sending && styles.btnDisabled]}
                  onPress={() => handleSendMessage(undefined, 'urgent')}
                  disabled={sending || !inputText.trim()}
                >
                  <MaterialIcons name="report-problem" size={16} color="#DC2626" />
                  <Text style={styles.urgentButtonText}>Urgent</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
                  onPress={() => handleSendMessage(undefined, 'normal')}
                  disabled={!inputText.trim() || sending}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.sendButtonText}>Transmit</Text>
                      <MaterialIcons name="send" size={16} color="#FFFFFF" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topHeaderBar: {
    backgroundColor: '#042F2E',
    paddingHorizontal: 24,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#115E59',
  },
  headerTitleGroup: {
    flexDirection: 'column',
    gap: 2,
  },
  agencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  agencyBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#CCFBF1',
    letterSpacing: 1,
  },
  headerMainTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  securityStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#134E4A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2DD4BF',
  },
  securityStatusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#CCFBF1',
    letterSpacing: 0.5,
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  channelSidebar: {
    width: 280,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  channelSidebarMobile: {
    width: '100%',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#1E293B',
    padding: 0,
  },
  channelScroll: {
    flex: 1,
  },
  channelSectionHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  channelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
    gap: 10,
  },
  channelItemActive: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  channelIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  channelIconWrapActive: {
    backgroundColor: '#0D9488',
  },
  channelInfo: {
    flex: 1,
  },
  channelName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
  },
  channelNameActive: {
    color: '#0F766E',
    fontWeight: '800',
  },
  channelDesc: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  channelBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  channelBadgeActive: {
    backgroundColor: '#0D9488',
  },
  channelBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  channelBadgeTextActive: {
    color: '#FFFFFF',
  },
  chatArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    flexDirection: 'column',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 12,
  },
  backButton: {
    padding: 6,
  },
  chatHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F0FDFA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatHeaderTitleWrap: {
    flex: 1,
  },
  chatHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  chatHeaderSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
  },
  templateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  templateBarLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  templateScroll: {
    gap: 6,
  },
  templateChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  templateChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  messageScroll: {
    flex: 1,
  },
  messageList: {
    padding: 20,
    gap: 14,
  },
  emptyFeed: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyFeedTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#64748B',
    marginTop: 6,
  },
  emptyFeedSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 320,
  },
  messageRow: {
    flexDirection: 'row',
    width: '100%',
  },
  messageRowCenro: {
    justifyContent: 'flex-start',
  },
  messageRowCicto: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  messageBubbleCenro: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderBottomLeftRadius: 4,
  },
  messageBubbleCicto: {
    backgroundColor: '#F0FDFA',
    borderColor: '#CCFBF1',
    borderBottomRightRadius: 4,
  },
  messageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  senderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  senderNameText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  senderNameCenro: {
    color: '#059669',
  },
  senderNameCicto: {
    color: '#0D9488',
  },
  urgentBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  urgentBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DC2626',
  },
  highBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  highBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#D97706',
  },
  messageSubject: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  messageBody: {
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 18,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  senderEmail: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  messageTimestamp: {
    fontSize: 9.5,
    color: '#94A3B8',
  },
  inputArea: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    padding: 14,
    gap: 10,
  },
  messageInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: '#0F172A',
    maxHeight: 100,
    minHeight: 44,
  },
  actionButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  urgentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  urgentButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0D9488',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  sendButtonText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
