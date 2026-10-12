import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

const links = [
  ['VibeMaster Privacy Policy', 'https://github.com/kabibuchuu/VibeMaster/blob/feat/music-first-reconstruction/docs/privacy-policy.md'],
  ['VibeMaster Terms of Use', 'https://github.com/kabibuchuu/VibeMaster/blob/feat/music-first-reconstruction/docs/terms-of-use.md'],
  ["YouTube Terms of Service", 'https://www.youtube.com/t/terms'],
  ['YouTube API Services Terms', 'https://developers.google.com/youtube/terms/api-services-terms-of-service'],
  ['YouTube API Developer Policies', 'https://developers.google.com/youtube/terms/developer-policies'],
  ['Google Privacy Policy', 'https://policies.google.com/privacy'],
  ['VibeMaster GitHub Issues / Contact', 'https://github.com/kabibuchuu/VibeMaster/issues'],
];

export default function LegalScreen() {
  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.content}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}><Text style={s.backText}>‹  Back</Text></TouchableOpacity>
        <Text style={s.eyebrow}>TRANSPARENCY</Text>
        <Text style={s.title}>Legal & privacy</Text>
        <Text style={s.body}>VibeMaster is independent and is not affiliated with YouTube or Google. Search uses YouTube API Services. YouTube controls content availability and embedded playback. The Open in YouTube Music action hands playback to the separate YouTube Music app; VibeMaster cannot control that external playback.</Text>
        {links.map(([label, url]) => (
          <TouchableOpacity key={url} style={s.link} onPress={() => void Linking.openURL(url)}>
            <Text style={s.linkText}>{label}</Text><Text style={s.arrow}>↗</Text>
          </TouchableOpacity>
        ))}
        <Text style={s.note}>YouTube's official API policies prohibit undocumented API access without express permission, scraping, separating audio from video, and background-player features. VibeMaster does not extract audio streams.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#09080f' },
  content: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 30 },
  back: { paddingVertical: 12, marginBottom: 20, alignSelf: 'flex-start' },
  backText: { color: '#d8d0eb', fontSize: 15, fontWeight: '700' },
  eyebrow: { color: '#a78bfa', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  title: { color: '#fff', fontSize: 29, fontWeight: '900', marginTop: 8, marginBottom: 12 },
  body: { color: '#b8b1c5', fontSize: 13, lineHeight: 21, marginBottom: 20 },
  link: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 14, borderRadius: 13, backgroundColor: '#17131f', marginBottom: 8 },
  linkText: { flex: 1, color: '#d5c5ff', fontSize: 13, fontWeight: '700' },
  arrow: { color: '#a78bfa', fontSize: 17 },
  note: { color: '#8e879b', fontSize: 11, lineHeight: 17, marginTop: 18 },
});
