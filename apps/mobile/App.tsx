import React, { useState } from 'react';
import { SafeAreaView, Text, View, Pressable, StyleSheet, Switch, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SkinMatchScreen } from './src/screens/SkinMatchScreen';
import { ACCOUNT_PORTAL_PATHS, ApiClient, color, font, space, radius, type SkinMatchResult } from '@mgt/shared';
import type { SkinProfileInput } from '@mgt/domain';

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() ?? '';
const apiBaseUrl = configuredApiUrl || (__DEV__ ? 'http://localhost:3000' : '');
const api = apiBaseUrl ? new ApiClient(apiBaseUrl) : null;
const privacyUrl = process.env.EXPO_PUBLIC_PRIVACY_URL?.trim() ?? '';
const termsUrl = process.env.EXPO_PUBLIC_TERMS_URL?.trim() ?? '';
const portalUrl = process.env.EXPO_PUBLIC_PORTAL_URL?.trim() ?? '';
const isHttpsUrl = (value: string) => /^https:\/\//i.test(value);
const releaseConfigurationReady = __DEV__ || Boolean(apiBaseUrl && isHttpsUrl(privacyUrl) && isHttpsUrl(termsUrl));

export default function App() {
  const [view, setView] = useState<'home' | 'match' | 'done' | 'error'>('home');
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<SkinMatchResult | null>(null);

  async function handleComplete(input: SkinProfileInput, durationMs: number) {
    if (!api || !apiBaseUrl) {
      setView('error');
      return;
    }
    try {
      const completed = await api.completeSkinMatch(input);
      // duration_ms feeds `skin_match.completed` and the <=90s KPI, measured on-device.
      setResult(completed);
      setView('done');
    } catch {
      setView('error');
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      {view === 'home' && (
        <View style={styles.home}>
          <Text style={styles.title}>Skincare matched to your skin.</Text>
          <Text style={styles.body}>
            Answer a few questions and get a routine built for you — with the reason behind every product.
          </Text>
          <Pressable testID="start" onPress={() => setView('match')} disabled={!consent || !releaseConfigurationReady} accessibilityRole="button" accessibilityState={{ disabled: !consent || !releaseConfigurationReady }} style={[styles.cta, (!consent || !releaseConfigurationReady) && styles.ctaDisabled]}>
            <Text style={styles.ctaLabel}>Start my Skin Match</Text>
          </Pressable>
          <View style={styles.consentRow}>
            <Switch value={consent} onValueChange={setConsent} accessibilityLabel="Consent to save skincare preferences" />
            <Text style={styles.consentText}>I agree to send my skincare preferences to MGT so it can create my routine.</Text>
          </View>
          <View style={styles.legalRow}>
            {isHttpsUrl(privacyUrl) && <Pressable onPress={() => void Linking.openURL(privacyUrl)} accessibilityRole="link"><Text style={styles.legalLink}>Privacy notice</Text></Pressable>}
            {isHttpsUrl(termsUrl) && <Pressable onPress={() => void Linking.openURL(termsUrl)} accessibilityRole="link"><Text style={styles.legalLink}>Terms</Text></Pressable>}
          </View>
          {isHttpsUrl(portalUrl) && <View style={styles.accountHub} accessibilityLabel="Account management links">
            <Text style={styles.accountHubTitle}>Manage your connected account</Text>
            <Pressable style={styles.portalLink} onPress={() => void Linking.openURL(portalUrl.replace(/\/+$/, '') + ACCOUNT_PORTAL_PATHS.overview)} accessibilityRole="link"><Text style={styles.legalLink}>Connected setup checklist</Text></Pressable>
            <Pressable style={styles.portalLink} onPress={() => void Linking.openURL(portalUrl.replace(/\/+$/, '') + ACCOUNT_PORTAL_PATHS.profile)} accessibilityRole="link"><Text style={styles.legalLink}>Profile and preferences</Text></Pressable>
            <Pressable style={styles.portalLink} onPress={() => void Linking.openURL(portalUrl.replace(/\/+$/, '') + ACCOUNT_PORTAL_PATHS.billing)} accessibilityRole="link"><Text style={styles.legalLink}>Payment setup and subscriptions</Text></Pressable>
            <Pressable style={styles.portalLink} onPress={() => void Linking.openURL(portalUrl.replace(/\/+$/, '') + ACCOUNT_PORTAL_PATHS.images)} accessibilityRole="link"><Text style={styles.legalLink}>Upload and manage skincare photos</Text></Pressable>
          </View>}
          <Text style={styles.configNote}>Account, payment and image management open in the secure web portal until reviewed native Android modules are connected. Photos remain optional and are never analyzed by this build.</Text>
          {!isHttpsUrl(privacyUrl) || !isHttpsUrl(termsUrl) ? <Text style={styles.configNote}>Production builds must provide HTTPS privacy and terms links.</Text> : null}
          <Text style={styles.disclaimer}>
            Cosmetic guidance, not medical care. If you have a persistent or painful skin condition,
            please see a dermatologist.
          </Text>
        </View>
      )}
      {view === 'match' && <SkinMatchScreen onComplete={handleComplete} />}
      {view === 'done' && result && <View style={styles.result}>
        <Text style={styles.resultTitle}>Your routine is ready.</Text>
        <Text style={styles.body}>{result.match_intelligence.coverage.required_slots_matched} of {result.match_intelligence.coverage.required_slots_total} core steps matched from {result.match_intelligence.coverage.eligible_products_considered} eligible products.</Text>
        <Text style={styles.method}>Explainable match · reviewed rules · AI text does not select or rank products</Text>
        <Text style={styles.resultHeading}>Datapoints used</Text>
        {result.match_intelligence.data_points.slice(0,4).map(point=><Text key={point.id} style={styles.dataPoint}>{point.label}: {point.value}</Text>)}
        <Text style={styles.configNote}>Product feedback, review, and reversible future-match exclusions are managed in the secure web portal. Removing feedback does not lower saved sensitivity settings. AI and photos do not make those changes.</Text>
        <Text style={styles.configNote}>Photos are not analyzed. Product and retailer details can change; review current labels and storefront information.</Text>
        {isHttpsUrl(portalUrl)&&<Pressable style={styles.cta} onPress={()=>void Linking.openURL(portalUrl.replace(/\/+$/, '')+'/routine')} accessibilityRole="link"><Text style={styles.ctaLabel}>Review full match details</Text></Pressable>}
      </View>}
      {view === 'error' && <Text style={styles.body}>{!apiBaseUrl ? 'This production build is missing its API configuration.' : !releaseConfigurationReady ? 'This production build is missing HTTPS privacy and terms links.' : 'Something went wrong. Please try again.'}</Text>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  home: { padding: space.lg, gap: space.md },
  title: { fontSize: font.size.xxl, fontWeight: '700', color: color.text, marginTop: space.xl },
  body: { fontSize: font.size.md, color: color.textMuted, lineHeight: 24, padding: space.lg },
  cta: { marginTop: space.lg, minHeight: 48, alignItems: 'center', justifyContent: 'center',
         borderRadius: radius.pill, backgroundColor: color.accent },
  ctaDisabled: { opacity: 0.45 },
  ctaLabel: { color: '#fff', fontSize: font.size.md, fontWeight: '600' },
  disclaimer: { fontSize: font.size.sm, color: color.textFaint, marginTop: space.md },
  consentRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  consentText: { flex: 1, fontSize: font.size.sm, color: color.textMuted, lineHeight: 20 },
  legalRow: { flexDirection: 'row', gap: space.md, marginTop: space.sm },
  legalLink: { color: color.accent, textDecorationLine: 'underline', fontSize: font.size.sm },
  accountHub: { marginTop: space.sm, padding: space.md, gap: space.sm, borderWidth: 1, borderColor: color.border, borderRadius: radius.md },
  accountHubTitle: { fontSize: font.size.md, color: color.text, fontWeight: '600' },
  portalLink: { minHeight: 44, justifyContent: 'center', alignSelf: 'stretch' },
  configNote: { fontSize: font.size.xs, color: color.textFaint, marginTop: space.sm },
  result: { padding: space.lg, gap: space.sm },
  resultTitle: { fontSize: font.size.xl, color: color.text, fontWeight: '700', marginTop: space.xl },
  resultHeading: { fontSize: font.size.md, color: color.text, fontWeight: '600', marginTop: space.md },
  method: { fontSize: font.size.sm, color: color.success, lineHeight: 20 },
  dataPoint: { fontSize: font.size.sm, color: color.textMuted, paddingVertical: space.xs },
});
