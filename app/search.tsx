import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { getPlaylistItems, searchYouTube, youtubeConfigured, type YouTubeResult } from '../src/lib/youtube';
import { addQueueItem, appendQueueItems } from '../src/lib/roomRepository';
import type { QueueItem } from '../src/types/room';

export default function Search() {
  const params = useLocalSearchParams<{ roomCode?: string }>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YouTubeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!youtubeConfigured()) setError('Add EXPO_PUBLIC_YOUTUBE_API_KEY to .env.local and restart Expo.');
  }, []);

  async function search() {
    if (!query.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      setResults(await searchYouTube(query.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backButton} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={s.back}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.kicker}>MUSIC DISCOVERY</Text>
          <Text style={s.title}>Find your next vibe</Text>
        </View>
      </View>

      <View style={s.searchBox}>
        <Text style={s.searchGlyph}>⌕</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => void search()}
          placeholder="Songs, artists, albums, playlists..."
          placeholderTextColor="#777184"
          style={s.input}
          returnKeyType="search"
          accessibilityLabel="Search music"
        />
        <TouchableOpacity onPress={() => void search()} disabled={loading || !query.trim()} style={[s.searchButton, (loading || !query.trim()) && s.disabled]}>
          <Text style={s.searchButtonText}>{loading ? '…' : 'Search'}</Text>
        </TouchableOpacity>
      </View>

      <View style={s.introRow}>
        <View style={s.introIcon}><Text style={s.introIconText}>♫</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.introTitle}>Only music. Always in sync.</Text>
          <Text style={s.introSub}>Pick a track or add a playlist to your room.</Text>
        </View>
      </View>

      {error ? (
        <View style={s.notice}>
          <Text style={s.noticeTitle}>Search needs a quick fix</Text>
          <Text style={s.noticeText}>{error}</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={s.results} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {loading ? <ActivityIndicator size="large" color="#bba0ff" style={s.loader} /> : null}
        {!loading ? results.map(item => <ResultCard key={item.id + item.kind} item={item} roomCode={params.roomCode} />) : null}
        {!loading && !results.length && !error ? (
          <View style={s.emptyState}>
            <View style={s.emptyGlyph}><Text style={s.emptyGlyphText}>♫</Text></View>
            <Text style={s.emptyTitle}>{query.trim() ? 'No matches yet' : 'What are we listening to?'}</Text>
            <Text style={s.emptyBody}>{query.trim() ? 'Try another song, artist, or playlist name.' : 'Search for a track or playlist to start your shared soundtrack.'}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ResultCard({ item, roomCode }: { item: YouTubeResult; roomCode?: string }) {
  const [adding, setAdding] = useState(false);

  async function selectResult() {
    if (!roomCode) {
      router.push({
        pathname: '/create',
        params: {
          videoId: item.kind === 'playlist' ? '' : item.id,
          playlistId: item.playlistId ?? '',
          title: item.title,
          channel: item.channelTitle,
          thumbnail: item.thumbnail,
          kind: item.kind,
          duration: item.duration ?? '',
        },
      });
      return;
    }
    if (adding) return;
    setAdding(true);
    try {
      if (item.kind === 'playlist') {
        const queue = await getPlaylistItems(item.playlistId ?? item.id);
        if (!queue.length) throw new Error('This playlist has no available tracks.');
        await appendQueueItems(roomCode, queue);
      } else {
        const track: QueueItem = {
          id: item.id,
          videoId: item.id,
          title: item.title,
          channelTitle: item.channelTitle,
          thumbnail: item.thumbnail,
          duration: item.duration,
          kind: 'music',
        };
        await addQueueItem(roomCode, track);
      }
      router.back();
    } catch (e) {
      Alert.alert('Could not add music', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setAdding(false);
    }
  }

  return (
    <TouchableOpacity style={s.resultCard} onPress={() => void selectResult()} disabled={adding} activeOpacity={0.8}>
      <View style={s.coverWrap}>
        <Image source={{ uri: item.thumbnail }} style={s.cover} />
        <View style={s.coverIcon}><Text style={s.coverIconText}>{item.kind === 'playlist' ? '≡' : '♫'}</Text></View>
      </View>
      <View style={s.resultMeta}>
        <Text style={s.resultType}>{item.kind === 'playlist' ? 'PLAYLIST' : 'TRACK'}{item.duration ? '  ·  ' + item.duration : ''}</Text>
        <Text numberOfLines={2} style={s.resultTitle}>{item.title}</Text>
        <Text numberOfLines={1} style={s.resultSubtitle}>{adding ? 'Adding to your room…' : item.channelTitle}</Text>
      </View>
      <View style={s.addCircle}><Text style={s.addGlyph}>{adding ? '…' : item.kind === 'playlist' ? '›' : '+'}</Text></View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#08070d', paddingHorizontal: 20, paddingTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', marginTop: 5, marginBottom: 18 },
  backButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#17131f', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  back: { color: '#f3eaff', fontSize: 34, lineHeight: 36, marginTop: -2 },
  kicker: { color: '#a78bfa', fontSize: 9, fontWeight: '900', letterSpacing: 2.2 },
  title: { color: '#fff', fontSize: 27, lineHeight: 33, fontWeight: '900', marginTop: 3, letterSpacing: -0.7 },
  searchBox: { minHeight: 58, backgroundColor: '#171522', borderRadius: 18, borderWidth: 1, borderColor: '#483760', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  searchGlyph: { fontSize: 26, color: '#bba0ff', marginRight: 8 },
  input: { flex: 1, minWidth: 0, color: '#fff', fontSize: 14, paddingVertical: 13 },
  searchButton: { backgroundColor: '#8b5cf6', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 12, marginLeft: 8 },
  searchButtonText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  disabled: { opacity: 0.45 },
  introRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, marginBottom: 17, paddingHorizontal: 3 },
  introIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#211630', alignItems: 'center', justifyContent: 'center' },
  introIconText: { color: '#d7c2ff', fontSize: 25, fontWeight: '900' },
  introTitle: { color: '#f6f0ff', fontSize: 13, fontWeight: '900' },
  introSub: { color: '#92899f', fontSize: 11, lineHeight: 16, marginTop: 4 },
  notice: { backgroundColor: '#171128', borderWidth: 1, borderColor: '#4c2d83', padding: 14, borderRadius: 16 },
  noticeTitle: { color: '#fff', fontWeight: '800' },
  noticeText: { color: '#aaa3b6', marginTop: 5, lineHeight: 19, fontSize: 12 },
  results: { paddingBottom: 32, gap: 10 },
  loader: { marginTop: 34 },
  resultCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#13111b', borderRadius: 18, padding: 9, borderWidth: 1, borderColor: '#30283d', minHeight: 92 },
  coverWrap: { width: 76, height: 76, position: 'relative' },
  cover: { width: 76, height: 76, borderRadius: 12, backgroundColor: '#201d27' },
  coverIcon: { position: 'absolute', right: 4, bottom: 4, backgroundColor: 'rgba(9,8,15,0.8)', width: 25, height: 25, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  coverIconText: { color: '#e2d0ff', fontSize: 15, fontWeight: '900' },
  resultMeta: { flex: 1, paddingHorizontal: 11, paddingVertical: 3 },
  resultType: { color: '#a78bfa', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  resultTitle: { color: '#fff', fontSize: 13, fontWeight: '800', lineHeight: 18, marginTop: 5 },
  resultSubtitle: { color: '#908c99', fontSize: 11, marginTop: 4 },
  addCircle: { width: 32, height: 32, borderRadius: 12, backgroundColor: '#211831', alignItems: 'center', justifyContent: 'center' },
  addGlyph: { color: '#d3bfff', fontSize: 23, fontWeight: '700', marginTop: -1 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingTop: 58, paddingBottom: 38 },
  emptyGlyph: { width: 68, height: 68, borderRadius: 22, backgroundColor: '#1a1227', alignItems: 'center', justifyContent: 'center', marginBottom: 17 },
  emptyGlyphText: { color: '#cbb3ff', fontSize: 33 },
  emptyTitle: { color: '#fff', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  emptyBody: { color: '#938a9e', fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 8 },
});
