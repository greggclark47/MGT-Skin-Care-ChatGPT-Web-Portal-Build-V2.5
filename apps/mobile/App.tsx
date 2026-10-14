import React, { useState } from 'react';
import { SafeAreaView, Text, View, Pressable, StyleSheet, Switch, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SkinMatchScreen } from './src/screens/SkinMatchScreen';
import { ApiClient, color, font, space, radius } from '@mgt/shared';
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

  async function handleComplete(input: SkinProfileInput, durationMs: number) {
    if (!api || !apiBaseUrl) {
      setView('error');
      return;
    }
    try {
      await api.completeSkinMatch(input);
      // duration_ms feeds `skin_match.completed` and the <=90s KPI, measured on-device.
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
          {isHttpsUrl(portalUrl) && <Pressable style={styles.photoLink} onPress={() => void Linking.openURL(portalUrl.replace(/\/+$/, '') + '/my-skin')} accessibilityRole="link"><Text style={styles.legalLink}>Open my skincare photo journal in the MGT portal</Text></Pressable>}
          <Text style={styles.configNote}>Photos are optional. The portal photo journal keeps images on the browser device; photo sync and in-app photo capture are not enabled yet.</Text>
          {!isHttpsUrl(privacyUrl) || !isHttpsUrl(termsUrl) ? <Text style={styles.configNote}>Production builds must provide HTTPS privacy and terms links.</Text> : null}
          <Text style={styles.disclaimer}>
            Cosmetic guidance, not medical care. If you have a persistent or painful skin condition,
            please see a dermatologist.
          </Text>
        </View>
      )}
      {view === 'match' && <SkinMatchScreen onComplete={handleComplete} />}
      {view === 'done' && <Text style={styles.body}>Your routine is ready.</Text>}
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
  photoLink: { marginTop: space.sm, alignSelf: 'flex-start' },
  configNote: { fontSize: font.size.xs, color: color.textFaint, marginTop: space.sm },
});
