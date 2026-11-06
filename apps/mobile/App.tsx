import React, { useState } from 'react';
import { SafeAreaView, Text, View, Pressable, StyleSheet, Switch, Linking, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SkinMatchScreen } from './src/screens/SkinMatchScreen';
import { ACCOUNT_PORTAL_PATHS, ApiClient, color, font, space, radius, type SkinMatchResult } from '@mgt/shared';
import type { SkinProfileInput } from '@mgt/domain';

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() ?? '';
const apiBaseUrl = configuredApiUrl || (__DEV__ ? 'http://localhost:3000' : '');
const api = apiBaseUrl ? new ApiClient(apiBaseUrl) : null;
const privacyUrl = process.env.EXPO_PUBLIC_PRIVACY_URL?.trim() ?? '';
const termsUrl = process.env.EXPO_PUBLIC_TERMS_URL?.trim() ?? '';
const aiDisclosureUrl = process.env.EXPO_PUBLIC_AI_DISCLOSURE_URL?.trim() ?? '';
const portalUrl = process.env.EXPO_PUBLIC_PORTAL_URL?.trim() ?? '';
const productionPlaceholder = /(your-|change[-_]?me|example\.|localhost|127\.0\.0\.1)/i;
const isHttpsUrl = (value: string) => {
  if (value !== value.trim() || productionPlaceholder.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && url.hostname.includes('.')
      && !url.username && !url.password && !url.port && url.pathname.length > 0
      && !url.search && !url.hash;
  } catch {
    return false;
  }
};
const productionConfigurationReady = [apiBaseUrl, portalUrl, privacyUrl, termsUrl, aiDisclosureUrl].every(isHttpsUrl);
const releaseConfigurationReady = __DEV__ || productionConfigurationReady;

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
          <View style={styles.brandHeader}>
            <Image source={require('./assets/team47studio-stacked-light-surface.png')} resizeMode="contain" style={styles.brandLogo} accessible accessibilityLabel="Team 47 Studio" />
            <Text style={styles.brandName}>TEAM 47 STUDIO</Text>
            <Text style={styles.brandKicker}>SKIN · COLOR · STYLE, IN SYNC WITH YOU</Text>
          </View>
          <Text style={styles.title}>Your care. Your color. Your rhythm.</Text>
          <Text style={styles.body}>
            Answer a few questions and get a routine built for you — with the reason behind every product.
          </Text>
          <Pressable testID="start" onPress={() => setView('match')} disabled={!consent || !releaseConfigurationReady} accessibilityRole="button" accessibilityState={{ disabled: !consent || !releaseConfigurationReady }} style={[styles.cta, (!consent || !releaseConfigurationReady) && styles.ctaDisabled]}>
            <Text style={styles.ctaLabel}>Start my Skin Match</Text>
          </Pressable>
          <View style={styles.consentRow}>
            <Switch value={consent} onValueChange={setConsent} accessibilityLabel="Consent to save skincare preferences" />
            <Text style={styles.consentText}>I agree to send my skincare preferences to Team 47 Studio so it can create my routine.</Text>
          </View>
          <View style={styles.legalRow}>
            {isHttpsUrl(privacyUrl) && <Pressable onPress={() => void Linking.openURL(privacyUrl)} accessibilityRole="link"><Text style={styles.legalLink}>Privacy notice</Text></Pressable>}
            {isHttpsUrl(termsUrl) && <Pressable onPress={() => void Linking.openURL(termsUrl)} accessibilityRole="link"><Text style={styles.legalLink}>Terms</Text></Pressable>}
            {isHttpsUrl(aiDisclosureUrl) && <Pressable onPress={() => void Linking.openURL(aiDisclosureUrl)} accessibilityRole="link"><Text style={styles.legalLink}>AI disclosure</Text></Pressable>}
          </View>
          {isHttpsUrl(portalUrl) && <View style={styles.accountHub} accessibilityLabel="Account management links">
            <Text style={styles.accountHubTitle}>Manage your connected account</Text>
            <Pressable style={styles.portalLink} onPress={() => void Linking.openURL(portalUrl.replace(/\/+$/, '') + ACCOUNT_PORTAL_PATHS.overview)} accessibilityRole="link"><Text style={styles.portalLinkLabel}>Connected setup checklist</Text></Pressable>
            <Pressable style={styles.portalLink} onPress={() => void Linking.openURL(portalUrl.replace(/\/+$/, '') + ACCOUNT_PORTAL_PATHS.profile)} accessibilityRole="link"><Text style={styles.portalLinkLabel}>Profile and preferences</Text></Pressable>
            <Pressable style={styles.portalLink} onPress={() => void Linking.openURL(portalUrl.replace(/\/+$/, '') + ACCOUNT_PORTAL_PATHS.billing)} accessibilityRole="link"><Text style={styles.portalLinkLabel}>Payment setup and subscriptions</Text></Pressable>
            <Pressable style={styles.portalLink} onPress={() => void Linking.openURL(portalUrl.replace(/\/+$/, '') + ACCOUNT_PORTAL_PATHS.images)} accessibilityRole="link"><Text style={styles.portalLinkLabel}>Upload and manage skincare photos</Text></Pressable>
            <Pressable style={styles.portalLink} onPress={() => void Linking.openURL(portalUrl.replace(/\/+$/, '') + ACCOUNT_PORTAL_PATHS.regimen)} accessibilityRole="link"><Text style={styles.portalLinkLabel}>Review my two-week regimen cycle</Text></Pressable>
            <Pressable style={styles.portalLink} onPress={() => void Linking.openURL(portalUrl.replace(/\/+$/, '') + ACCOUNT_PORTAL_PATHS.privacy)} accessibilityRole="link"><Text style={styles.portalLinkLabel}>Privacy, data export and account deletion</Text></Pressable>
          </View>}
          <Text style={styles.configNote}>Account, payment and image management open in the secure web portal until reviewed native Android modules are connected. Photos remain optional and are never analyzed by this build.</Text>
          {!__DEV__ && !productionConfigurationReady ? <Text style={styles.configNote}>Production builds must provide public HTTPS API, portal, privacy, terms and AI disclosure links.</Text> : null}
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
        {result.match_intelligence.data_points.slice(0,4).map(point=><Text key={point.id} style={styles.dataPoint}>{point.label}: {point.value} · {point.retailer_query_eligible?'portal discovery context only':'account-only'}</Text>)}
        <Text style={styles.resultHeading}>Retailer discovery context</Text>
        <Text style={styles.configNote}>{[...result.match_intelligence.retail_discovery.profile_terms,...result.match_intelligence.retail_discovery.query_terms].slice(0,3).join(' · ')}</Text>
        <Text style={styles.configNote}>{result.match_intelligence.retail_discovery.privacy_note}</Text>
        <Text style={styles.configNote}>Product feedback, review, and reversible future-match exclusions are managed in the secure web portal. Removing feedback does not lower saved sensitivity settings. AI and photos do not make those changes.</Text>
        <Text style={styles.configNote}>Photos are not analyzed. Product and retailer details can change; review current labels and storefront information.</Text>
        {isHttpsUrl(portalUrl)&&<><Pressable style={styles.cta} onPress={()=>void Linking.openURL(portalUrl.replace(/\/+$/, '')+'/routine')} accessibilityRole="link"><Text style={styles.ctaLabel}>Review full match details</Text></Pressable><Pressable style={styles.portalLink} onPress={()=>void Linking.openURL(portalUrl.replace(/\/+$/, '')+'/shop?segment=skincare&q='+encodeURIComponent([...result.match_intelligence.retail_discovery.profile_terms,...result.match_intelligence.retail_discovery.query_terms].slice(0,3).join(' ')))} accessibilityRole="link"><Text style={styles.legalLink}>Explore retailer discovery ↗</Text></Pressable></>}
      </View>}
      {view === 'error' && <Text style={styles.body}>{!releaseConfigurationReady ? 'This production build needs public HTTPS API, portal, privacy, terms and AI disclosure links.' : 'Something went wrong. Please try again.'}</Text>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B1226' },
  home: { padding: space.lg, gap: space.md, backgroundColor: '#F7FAFF', borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  brandHeader: { alignItems: 'center', gap: space.xs, paddingTop: space.sm, paddingBottom: space.md },
  brandLogo: { width: '100%', maxWidth: 360, height: 180, borderRadius: radius.lg, backgroundColor: '#FFFFFF' },
  brandName: { color: '#24115D', fontSize: font.size.md, fontWeight: '700', letterSpacing: 1.4 },
  brandKicker: { color: '#514179', fontSize: font.size.xs, fontWeight: '600', letterSpacing: 0.7, textAlign: 'center' },
  title: { fontSize: font.size.xxl, fontWeight: '700', color: '#17163B', marginTop: space.sm },
  body: { fontSize: font.size.md, color: color.textMuted, lineHeight: 24, padding: space.lg },
  cta: { marginTop: space.lg, minHeight: 48, alignItems: 'center', justifyContent: 'center',
         borderRadius: radius.pill, backgroundColor: '#5F32D6' },
  ctaDisabled: { opacity: 0.45 },
  ctaLabel: { color: '#fff', fontSize: font.size.md, fontWeight: '600' },
  disclaimer: { fontSize: font.size.sm, color: color.textFaint, marginTop: space.md },
  consentRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  consentText: { flex: 1, fontSize: font.size.sm, color: color.textMuted, lineHeight: 20 },
  legalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.sm },
  legalLink: { color: '#3F25A7', textDecorationLine: 'underline', fontSize: font.size.sm },
  accountHub: { marginTop: space.sm, padding: space.md, gap: space.sm, borderWidth: 1, borderColor: '#465A83', borderRadius: radius.md, backgroundColor: '#17233E' },
  accountHubTitle: { fontSize: font.size.md, color: '#F8FBFF', fontWeight: '600' },
  portalLink: { minHeight: 44, justifyContent: 'center', alignSelf: 'stretch' },
  portalLinkLabel: { color: '#70E5EA', textDecorationLine: 'underline', fontSize: font.size.sm },
  configNote: { fontSize: font.size.xs, color: color.textFaint, marginTop: space.sm },
  result: { padding: space.lg, gap: space.sm },
  resultTitle: { fontSize: font.size.xl, color: color.text, fontWeight: '700', marginTop: space.xl },
  resultHeading: { fontSize: font.size.md, color: color.text, fontWeight: '600', marginTop: space.md },
  method: { fontSize: font.size.sm, color: color.success, lineHeight: 20 },
  dataPoint: { fontSize: font.size.sm, color: color.textMuted, paddingVertical: space.xs },
});
