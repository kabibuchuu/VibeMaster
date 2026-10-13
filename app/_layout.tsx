import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack } from 'expo-router';
import { registerGlobals } from '@livekit/react-native';

const CONSENT_KEY = 'vibemaster.youtube-consent.v1';
const PRIVACY_URL = 'https://github.com/kabibuchuu/VibeMaster/blob/feat/music-first-reconstruction/docs/privacy-policy.md';
const TERMS_URL = 'https://github.com/kabibuchuu/VibeMaster/blob/feat/music-first-reconstruction/docs/terms-of-use.md';
const YOUTUBE_TERMS_URL = 'https://www.youtube.com/t/terms';
const GOOGLE_PRIVACY_URL = 'https://policies.google.com/privacy';

let liveKitRegistered = false;
if (!liveKitRegistered) {
  registerGlobals();
  liveKitRegistered = true;
}

export default function Layout() {
  const [loaded, setLoaded] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(CONSENT_KEY).then(value => {
      if (!cancelled) {
        setAccepted(value === 'accepted');
        setLoaded(true);
      }
    }).catch(() => {
      if (!cancelled) setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  async function accept() {
    if (!termsChecked || !privacyChecked) return;
    try {
      await AsyncStorage.setItem(CONSENT_KEY, 'accepted');
      setAccepted(true);
    } catch {
      // Do not enter the app if the user's consent cannot be persisted.
      setAccepted(false);
    }
  }

  if (!loaded) {
    return <View style={styles.loading}><ActivityIndicator color="#c4b5fd" /><Text style={styles.muted}>Preparing VibeMaster…</Text></View>;
  }

  if (accepted) return <Stack screenOptions={{ headerShown: false }} />;

  return (
    <View style={styles.screen}>
      <View style={styles.brand}><Text style={styles.brandMark}>V</Text><Text style={styles.brandText}>VIBEMASTER</Text></View>
      <Text style={styles.eyebrow}>BEFORE YOU START</Text>
      <Text style={styles.title}>Your room. Your rules.</Text>
      <Text style={styles.body}>VibeMaster uses YouTube API Services for music discovery and its official player. YouTube controls content availability and playback restrictions. Opening YouTube Music hands playback to that separate app; VibeMaster cannot control that external playback.</Text>
      <TouchableOpacity style={styles.link} onPress={() => void Linking.openURL(TERMS_URL)}>
        <Text style={styles.linkText}>Read VibeMaster Terms of Use ↗</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.link} onPress={() => void Linking.openURL(PRIVACY_URL)}>
        <Text style={styles.linkText}>Read VibeMaster Privacy Policy ↗</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.link} onPress={() => void Linking.openURL(YOUTUBE_TERMS_URL)}>
        <Text style={styles.linkText}>Read YouTube Terms of Service ↗</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.link} onPress={() => void Linking.openURL(GOOGLE_PRIVACY_URL)}>
        <Text style={styles.linkText}>Read Google Privacy Policy ↗</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.checkRow} onPress={() => setTermsChecked(v => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: termsChecked }}>
        <View style={[styles.checkbox, termsChecked && styles.checkboxChecked]}><Text style={styles.checkmark}>{termsChecked ? '✓' : ''}</Text></View>
        <Text style={styles.checkLabel}>I agree to the VibeMaster Terms of Use and YouTube Terms of Service.</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.checkRow} onPress={() => setPrivacyChecked(v => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: privacyChecked }}>
        <View style={[styles.checkbox, privacyChecked && styles.checkboxChecked]}><Text style={styles.checkmark}>{privacyChecked ? '✓' : ''}</Text></View>
        <Text style={styles.checkLabel}>I have read the VibeMaster Privacy Policy and Google Privacy Policy.</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.continue, (!termsChecked || !privacyChecked) && styles.continueDisabled]} disabled={!termsChecked || !privacyChecked} onPress={() => void accept()}>
        <Text style={styles.continueText}>Agree and continue</Text>
      </TouchableOpacity>
      <Text style={styles.disclaimer}>VibeMaster is independent and is not affiliated with or endorsed by YouTube or Google.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#09080f', paddingHorizontal: 24, paddingTop: 54, paddingBottom: 26, justifyContent: 'center' },
  loading: { flex: 1, backgroundColor: '#09080f', alignItems: 'center', justifyContent: 'center', gap: 12 },
  muted: { color: '#a9a3b7' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 34 },
  brandMark: { color: '#fff', backgroundColor: '#8b5cf6', overflow: 'hidden', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontWeight: '900', fontSize: 20 },
  brandText: { color: '#fff', letterSpacing: 2, fontWeight: '900', fontSize: 13 },
  eyebrow: { color: '#a78bfa', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  title: { color: '#fff', fontSize: 29, fontWeight: '900', marginTop: 8, marginBottom: 12 },
  body: { color: '#b8b1c5', fontSize: 13, lineHeight: 20, marginBottom: 18 },
  link: { paddingVertical: 9 },
  linkText: { color: '#c9b8ff', fontWeight: '700', fontSize: 13 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, marginTop: 18 },
  checkbox: { width: 23, height: 23, borderRadius: 6, borderWidth: 1, borderColor: '#5e5075', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#7c55e8', borderColor: '#a78bfa' },
  checkmark: { color: '#fff', fontWeight: '900' },
  checkLabel: { flex: 1, color: '#e2dced', fontSize: 12, lineHeight: 18 },
  continue: { marginTop: 26, paddingVertical: 15, borderRadius: 14, backgroundColor: '#7c55e8', alignItems: 'center' },
  continueDisabled: { opacity: 0.4 },
  continueText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  disclaimer: { color: '#777184', fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 18 },
});
