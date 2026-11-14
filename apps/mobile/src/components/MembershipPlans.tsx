import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { MEMBERSHIP_CHANGE_POLICY, MEMBERSHIP_COMPARISON_ROWS, MEMBERSHIP_TIER_CONTENT, font, radius, space } from '@mgt/shared';

export function MembershipPlans({ portalUrl }: { portalUrl: string }) {
  const base = portalUrl.replace(/\/+$/, '');
  return <View style={styles.section} accessibilityLabel="Free, Guided, and Studio membership comparison">
    <Text accessibilityRole="header" style={styles.heading}>Compare membership plans</Text>
    <Text style={styles.intro}>Review the full plan structure in the app. Current approved pricing and account-specific billing details open in the secure portal.</Text>
    <View style={styles.cards}>
      {MEMBERSHIP_TIER_CONTENT.map(tier => <View key={tier.id} testID={`membership-tier-${tier.id}`} style={styles.card}>
        <Text accessibilityRole="header" style={styles.tierName}>{tier.name}</Text>
        <Text style={styles.summary}>{tier.summary}</Text>
        {tier.features.map(feature => <Text key={feature} style={styles.feature}>• {feature}</Text>)}
      </View>)}
    </View>
    <Text accessibilityRole="header" style={styles.subheading}>Full comparison</Text>
    {MEMBERSHIP_COMPARISON_ROWS.map(row => <View key={row.id} testID={`membership-comparison-${row.id}`} style={styles.comparisonRow}>
      <Text style={styles.capability}>{row.label}</Text>
      {MEMBERSHIP_TIER_CONTENT.map(tier => <Text key={tier.id} style={styles.comparisonValue}><Text style={styles.comparisonTier}>{tier.name}: </Text>{tier.comparison[row.id]}</Text>)}
    </View>)}
    <View style={styles.policy} accessibilityLabel="Plan change policy">
      <Text style={styles.policyText}>{MEMBERSHIP_CHANGE_POLICY.period_end}</Text>
      <Text style={styles.policyText}>{MEMBERSHIP_CHANGE_POLICY.annual_upgrade}</Text>
      <Text style={styles.policyText}>{MEMBERSHIP_CHANGE_POLICY.confirmation}</Text>
    </View>
    <Pressable style={styles.primaryLink} onPress={() => void Linking.openURL(base + '/membership')} accessibilityRole="link"><Text style={styles.primaryLinkText}>View current plans and pricing</Text></Pressable>
    <Pressable style={styles.accountLink} onPress={() => void Linking.openURL(base + '/account#payment-settings')} accessibilityRole="link"><Text style={styles.accountLinkText}>Manage my plan in Account</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  section: { marginTop: space.md, gap: space.md, padding: space.md, borderWidth: 1, borderColor: '#CFC5ED', borderRadius: radius.lg, backgroundColor: '#F4F0FF' },
  heading: { color: '#24115D', fontSize: font.size.lg, fontWeight: '700' },
  subheading: { color: '#24115D', fontSize: font.size.md, fontWeight: '700', marginTop: space.sm },
  intro: { color: '#514179', fontSize: font.size.sm, lineHeight: 20 },
  cards: { gap: space.sm },
  card: { padding: space.md, gap: space.xs, borderWidth: 1, borderColor: '#D8D0EE', borderRadius: radius.md, backgroundColor: '#FFFFFF' },
  tierName: { color: '#24115D', fontSize: font.size.md, fontWeight: '700' },
  summary: { color: '#514179', fontSize: font.size.sm, lineHeight: 20 },
  feature: { color: '#40365D', fontSize: font.size.sm, lineHeight: 20 },
  comparisonRow: { gap: space.xs, paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: '#D8D0EE' },
  capability: { color: '#24115D', fontSize: font.size.sm, fontWeight: '700' },
  comparisonValue: { color: '#514179', fontSize: font.size.xs, lineHeight: 18 },
  comparisonTier: { color: '#342070', fontWeight: '700' },
  policy: { gap: space.xs, padding: space.md, borderRadius: radius.md, backgroundColor: '#E9E1FF' },
  policyText: { color: '#342070', fontSize: font.size.xs, lineHeight: 18 },
  primaryLink: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: '#5F32D6' },
  primaryLinkText: { color: '#FFFFFF', fontSize: font.size.sm, fontWeight: '700' },
  accountLink: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  accountLinkText: { color: '#3F25A7', textDecorationLine: 'underline', fontSize: font.size.sm, fontWeight: '600' },
});
