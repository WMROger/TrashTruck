import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface AgencySignProps {
  type: 'cenro' | 'dict';
  size?: 'small' | 'medium' | 'large';
}

export default function AgencySign({ type, size = 'medium' }: AgencySignProps) {
  const isCenro = type === 'cenro';
  const isSmall = size === 'small';
  const isLarge = size === 'large';

  const badgeDimension = isSmall ? 52 : isLarge ? 76 : 64;
  const iconSize = isSmall ? 24 : isLarge ? 36 : 30;

  return (
    <View style={styles.container}>
      {/* Minimalist Agency Seal Container */}
      <View
        style={[
          styles.badgeOuter,
          isCenro ? styles.cenroBadgeOuter : styles.dictBadgeOuter,
          { width: badgeDimension, height: badgeDimension, borderRadius: badgeDimension / 2 },
        ]}
      >
        <View
          style={[
            styles.badgeInner,
            isCenro ? styles.cenroBadgeInner : styles.dictBadgeInner,
            { width: badgeDimension - 8, height: badgeDimension - 8, borderRadius: (badgeDimension - 8) / 2 },
          ]}
        >
          <MaterialIcons
            name={isCenro ? 'eco' : 'admin-panel-settings'}
            size={iconSize}
            color={isCenro ? '#065F46' : '#0F766E'}
          />
        </View>

        {/* Official Verification Checkmark Badge */}
        <View
          style={[
            styles.statusDot,
            isCenro ? styles.cenroStatusDot : styles.dictStatusDot,
          ]}
        >
          <MaterialIcons name="verified" size={13} color="#FFFFFF" />
        </View>
      </View>

      {/* Official Sign Metadata */}
      <View style={styles.textContainer}>
        <View style={styles.agencyRow}>
          <Text style={[styles.agencyCode, isCenro ? styles.cenroText : styles.dictText]}>
            {isCenro ? 'CENRO • DANAO' : 'DICT • REGION VII'}
          </Text>
          <View style={[styles.pillBadge, isCenro ? styles.cenroPill : styles.dictPill]}>
            <Text style={[styles.pillText, isCenro ? styles.cenroPillText : styles.dictPillText]}>
              {isCenro ? 'LGU OFFICIAL' : 'GOV.PH SECURE'}
            </Text>
          </View>
        </View>
        <Text style={styles.agencySub} numberOfLines={1}>
          {isCenro
            ? 'City Environment & Natural Resources Office'
            : 'Dept. of Information & Communications Technology'}
        </Text>
        <Text style={styles.agencyJurisdiction}>
          {isCenro ? 'Danao City, Cebu • Solid Waste Logistics' : 'Republic of the Philippines • Central Visayas'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
    paddingVertical: 6,
  },
  badgeOuter: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    position: 'relative',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  cenroBadgeOuter: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  dictBadgeOuter: {
    backgroundColor: '#F0FDFA',
    borderColor: '#99F6E4',
  },
  badgeInner: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  cenroBadgeInner: {
    backgroundColor: '#D1FAE5',
    borderColor: '#34D399',
  },
  dictBadgeInner: {
    backgroundColor: '#CCFBF1',
    borderColor: '#2DD4BF',
  },
  statusDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  cenroStatusDot: {
    backgroundColor: '#059669',
  },
  dictStatusDot: {
    backgroundColor: '#0D9488',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  agencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  agencyCode: {
    fontSize: 12.5,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  cenroText: {
    color: '#065F46',
  },
  dictText: {
    color: '#115E59',
  },
  pillBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cenroPill: {
    backgroundColor: '#D1FAE5',
  },
  dictPill: {
    backgroundColor: '#CCFBF1',
  },
  pillText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cenroPillText: {
    color: '#047857',
  },
  dictPillText: {
    color: '#0F766E',
  },
  agencySub: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
    marginTop: 1,
  },
  agencyJurisdiction: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
});
