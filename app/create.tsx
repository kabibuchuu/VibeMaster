import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { auth } from '../firebase';
import { ensureAnonymousAuth } from '../src/lib/auth';
import { createRoom, setQueue, updateRoom } from '../src/lib/roomRepository';
import { getPlaylistItems } from '../src/lib/youtube';
import type { QueueItem } from '../src/types/room';

const makeCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

export default function Create() {
  const params = useLocalSearchParams<{
    videoId?: string;
    playlistId?: string;
    title?: string;
    channel?: string;
    thumbnail?: string;
    kind?: 'music' | 'playlist';
    duration?: string;
  }>();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setCode(makeCode()), []);

  async function create() {
    if (!code || busy) return;
    setBusy(true);
    setError('');
    try {
      // The auth listener can render the home screen before anonymous sign-in finishes.
      // Never silently ignore the create tap: establish a session or show the real error.
      if (!auth.currentUser) await ensureAnonymousAuth();
      const host = auth.currentUser;
      if (!host) throw new Error('Sign-in did not complete. Check your connection and try again.');
      let queue: QueueItem[] = [];
      if (params.playlistId) {
        queue = (await getPlaylistItems(String(params.playlistId))).slice(0, 50);
      } else if (params.videoId) {
        const track: QueueItem = {
          id: String(params.videoId),
          videoId: String(params.videoId),
          title: String(params.title ?? 'Selected track'),
          channelTitle: String(params.channel ?? 'YouTube Music'),
          thumbnail: String(params.thumbnail ?? ''),
          kind: 'music',
        };
        if (params.duration) track.duration = String(params.duration);
        queue = [track];
      }

      let createdCode = '';
      for (let attempt = 0; attempt < 8 && !createdCode; attempt++) {
        const candidate = attempt === 0 ? code : makeCode();
        try {
          await createRoom(candidate, host.uid, 'music');
          createdCode = candidate;
          setCode(candidate);
        } catch (e) {
          if (!(e instanceof Error) || e.message !== 'ROOM_EXISTS') throw e;
          if (attempt === 7) throw new Error('Could not reserve a room code. Try again.');
        }
      }
      if (queue.length) {
        await setQueue(createdCode, queue);
        await updateRoom(createdCode, { currentItemId: queue[0].id });
      }
      router.replace({ pathname: '/room', params: { code: createdCode } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the room.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={s.backRow} onPress={() => router.back()}>
          <Text style={s.back}>‹</Text><Text style={s.backLabel}>BACK TO MUSIC</Text>
        </TouchableOpacity>

        <View style={s.hero}>
          <View style={s.heroGlow} />
          <View style={s.eyebrow}><View style={s.eyebrowDot} /><Text style={s.kicker}>YOUR LISTENING SPACE</Text></View>
          <Text style={s.title}>{params.title ? 'Start with this track.' : 'Make a little room for music.'}</Text>
          <Text style={s.subtitle}>Invite your person, build a shared queue, and stay in sync—wherever you are.</Text>
          {params.title ? (
            <View style={s.selectedTrack}>
              <View style={s.coverWrap}>
                {params.thumbnail ? <View style={s.coverImageShell}><Text style={s.coverGlyph}>♫</Text></View> : <Text style={s.coverGlyph}>♫</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.selectedLabel}>{params.kind === 'playlist' ? 'STARTING PLAYLIST' : 'STARTING TRACK'}</Text>
                <Text numberOfLines={2} style={s.selectedTitle}>{params.title}</Text>
                <Text numberOfLines={1} style={s.selectedChannel}>{params.channel || 'YouTube Music'}</Text>
              </View>
            </View>
          ) : null}
        </View>

        {params.thumbnail && params.title ? null : (
          <View style={s.planCard}>
            <View style={s.planIcon}><Text style={s.planIconText}>♫</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.planTitle}>One shared soundtrack</Text>
              <Text style={s.planText}>Add songs and playlists after your room opens.</Text>
            </View>
          </View>
        )}

        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Made for two—or the whole crew</Text>
          <Text style={s.sectionHint}>VIBEMASTER</Text>
        </View>
        <View style={s.features}>
          <View style={s.featureRow}>
            <View style={s.featureIcon}><Text style={s.featureGlyph}>↔</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.featureTitle}>Stay in sync</Text>
              <Text style={s.featureText}>Everyone hears the same song at the same moment.</Text>
            </View>
            <Text style={s.featureCheck}>✓</Text>
          </View>
          <View style={s.featureRow}>
            <View style={s.featureIcon}><Text style={s.featureGlyph}>≡</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.featureTitle}>Build the queue together</Text>
              <Text style={s.featureText}>Add your favourites and keep the vibe going.</Text>
            </View>
            <Text style={s.featureCheck}>✓</Text>
          </View>
          <View style={s.featureRow}>
            <View style={s.featureIcon}><Text style={s.featureGlyph}>♡</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.featureTitle}>Make it personal</Text>
              <Text style={s.featureText}>Share reactions and chat while you listen.</Text>
            </View>
            <Text style={s.featureCheck}>✓</Text>
          </View>
        </View>

        <View style={s.roomCode}>
          <View style={{ flex: 1 }}>
            <Text style={s.codeLabel}>YOUR PRIVATE ROOM CODE</Text>
            <Text style={s.code}>{code || 'CREATING…'}</Text>
            <Text style={s.codeHint}>Share it with the people you want to invite.</Text>
          </View>
          <View style={s.privatePill}><View style={s.privateDot} /><Text style={s.privateText}>PRIVATE</Text></View>
        </View>

        {error ? <View style={s.error}><Text style={s.errorTitle}>Couldn’t create your room</Text><Text style={s.errorText}>{error}</Text></View> : null}

        <TouchableOpacity style={[s.createButton, busy && s.buttonDisabled]} onPress={() => void create()} disabled={busy} activeOpacity={0.85}>
          {busy ? <ActivityIndicator color="#fff" /> : <><Text style={s.createText}>Create listening room</Text><Text style={s.createArrow}>↗</Text></>}
        </TouchableOpacity>
        <Text style={s.footnote}>Music sounds better when it’s shared.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#08070d' },
  page: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 34 },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  back: { color: '#d6c8f5', fontSize: 30, lineHeight: 32, marginRight: 8 },
  backLabel: { color: '#766b8a', fontSize: 9, fontWeight: '900', letterSpacing: 1.8 },
  hero: { backgroundColor: '#151021', padding: 22, borderRadius: 27, borderWidth: 1, borderColor: '#352648', overflow: 'hidden' },
  heroGlow: { position: 'absolute', width: 210, height: 210, borderRadius: 105, backgroundColor: '#422477', right: -105, top: -100, opacity: 0.52 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrowDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#b69aff' },
  kicker: { color: '#bda4f8', fontSize: 9, fontWeight: '900', letterSpacing: 2 },
  title: { color: '#fff', fontSize: 31, lineHeight: 37, fontWeight: '900', marginTop: 17, letterSpacing: -0.8 },
  subtitle: { color: '#a49aad', fontSize: 13, lineHeight: 20, marginTop: 10 },
  selectedTrack: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(8,7,13,0.75)', borderWidth: 1, borderColor: '#30263e', borderRadius: 17, padding: 12, marginTop: 18 },
  coverWrap: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#2a1c41', alignItems: 'center', justifyContent: 'center' },
  coverImageShell: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  coverGlyph: { color: '#e0cdff', fontSize: 26, fontWeight: '900' },
  selectedLabel: { color: '#8e7ba8', fontSize: 8, fontWeight: '900', letterSpacing: 1.5 },
  selectedTitle: { color: '#f7f1ff', fontSize: 13, fontWeight: '800', marginTop: 4 },
  selectedChannel: { color: '#81788c', fontSize: 10, marginTop: 3 },
  planCard: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16, marginTop: 16, backgroundColor: '#111019', borderRadius: 19, borderWidth: 1, borderColor: '#292438' },
  planIcon: { width: 44, height: 44, backgroundColor: '#211831', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  planIconText: { color: '#d9c7ff', fontSize: 24, fontWeight: '900' },
  planTitle: { color: '#fff', fontSize: 14, fontWeight: '900' },
  planText: { color: '#948aa0', fontSize: 11, lineHeight: 16, marginTop: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 },
  sectionTitle: { color: '#f4efff', fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  sectionHint: { color: '#776b8b', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  features: { backgroundColor: '#111019', borderWidth: 1, borderColor: '#292438', borderRadius: 20, paddingHorizontal: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#24202f' },
  featureIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#211831', alignItems: 'center', justifyContent: 'center' },
  featureGlyph: { color: '#c4b5fd', fontSize: 20, fontWeight: '900' },
  featureTitle: { color: '#f4efff', fontSize: 13, fontWeight: '800' },
  featureText: { color: '#8e8799', fontSize: 11, lineHeight: 16, marginTop: 4 },
  featureCheck: { color: '#a78bfa', fontSize: 15, fontWeight: '900', marginLeft: 2 },
  roomCode: { marginTop: 18, padding: 16, backgroundColor: '#100e17', borderWidth: 1, borderColor: '#292334', borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codeLabel: { color: '#80768f', fontSize: 8, fontWeight: '900', letterSpacing: 1.6 },
  code: { color: '#d6c3ff', fontSize: 23, fontWeight: '900', letterSpacing: 4, marginTop: 6 },
  codeHint: { color: '#7c7388', fontSize: 10, marginTop: 6 },
  privatePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1b1725', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7, marginLeft: 10 },
  privateDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#9f82df' },
  privateText: { color: '#ad9abf', fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  error: { backgroundColor: '#35151c', padding: 13, borderRadius: 14, marginTop: 12, borderWidth: 1, borderColor: '#6c2936' },
  errorTitle: { color: '#fff', fontWeight: '900', fontSize: 12 },
  errorText: { color: '#f0b7c1', lineHeight: 18, marginTop: 5, fontSize: 12 },
  createButton: { backgroundColor: '#8b5cf6', paddingHorizontal: 18, paddingVertical: 17, borderRadius: 17, alignItems: 'center', justifyContent: 'space-between', flexDirection: 'row', marginTop: 18, minHeight: 58, shadowColor: '#8b5cf6', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  buttonDisabled: { opacity: 0.6 },
  createText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  createArrow: { color: '#fff', fontSize: 19, fontWeight: '900' },
  footnote: { color: '#5f586b', textAlign: 'center', marginTop: 12, fontSize: 10, lineHeight: 15 },
});
