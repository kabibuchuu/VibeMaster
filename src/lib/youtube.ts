export type YouTubeResult = {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  kind: 'music' | 'playlist';
  duration?: string;
  playlistId?: string;
};

export type QueueSeed = {
  id: string;
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  duration?: string;
  kind: 'music';
};

const API_BASE = 'https://www.googleapis.com/youtube/v3';
const getKey = () => process.env.EXPO_PUBLIC_YOUTUBE_API_KEY?.trim() ?? '';

function formatDuration(value?: string) {
  if (!value) return undefined;
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return undefined;
  const h = Number(match[1] ?? 0), m = Number(match[2] ?? 0), s = Number(match[3] ?? 0);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

export function youtubeConfigured() {
  return Boolean(getKey());
}

export function parseYouTubeVideoId(input: string): string | null {
  const value = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\\./, '');
    let candidate = '';
    if (host === 'youtu.be') candidate = url.pathname.split('/').filter(Boolean)[0] ?? '';
    else if (host.endsWith('youtube.com')) {
      if (url.pathname === '/watch') candidate = url.searchParams.get('v') ?? '';
      else {
        const parts = url.pathname.split('/').filter(Boolean);
        if (['shorts', 'embed', 'live'].includes(parts[0] ?? '')) candidate = parts[1] ?? '';
      }
    }
    return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

async function resolveVideoLink(videoId: string): Promise<YouTubeResult> {
  const watchUrl = 'https://www.youtube.com/watch?v=' + encodeURIComponent(videoId);
  const response = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(watchUrl));
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    throw new Error('That YouTube video could not be loaded. Check the link or try another track.');
  }
  return {
    id: videoId,
    title: typeof data.title === 'string' ? data.title : 'YouTube track',
    channelTitle: typeof data.author_name === 'string' ? data.author_name : 'YouTube',
    thumbnail: typeof data.thumbnail_url === 'string' ? data.thumbnail_url : '',
    kind: 'music',
  };
}

async function api(path: string, params: Record<string, string>) {
  const { key, ...query } = params;
  const response = await fetch(`${API_BASE}${path}?${new URLSearchParams(query).toString()}`, {
    headers: key ? { 'X-Goog-Api-Key': key } : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const reason = data?.error?.errors?.[0]?.reason;
    if (reason === 'quotaExceeded') throw new Error('YouTube search quota has been reached for today.');
    throw new Error(data?.error?.message ?? 'YouTube request failed.');
  }
  return data;
}

async function searchMusicTracks(query: string, key: string): Promise<YouTubeResult[]> {
  const data = await api('/search', {
    part: 'snippet',
    q: query,
    type: 'video',
    maxResults: '20',
    videoEmbeddable: 'true',
    videoSyndicated: 'true',
    videoCategoryId: '10',
    key,
  });
  const ids = (data.items ?? []).map((item: any) => item.id?.videoId).filter(Boolean);
  if (!ids.length) return [];
  const videos = (await api('/videos', {
    part: 'contentDetails,snippet',
    id: ids.join(','),
    key,
  })).items ?? [];
  return videos.map((item: any) => ({
    id: item.id,
    title: item.snippet?.title ?? 'Untitled track',
    channelTitle: item.snippet?.channelTitle ?? 'YouTube Music',
    thumbnail: item.snippet?.thumbnails?.high?.url
      ?? item.snippet?.thumbnails?.medium?.url
      ?? item.snippet?.thumbnails?.default?.url
      ?? '',
    kind: 'music' as const,
    duration: formatDuration(item.contentDetails?.duration),
  }));
}

async function searchPlaylists(query: string, key: string): Promise<YouTubeResult[]> {
  const data = await api('/search', {
    part: 'snippet',
    q: query,
    type: 'playlist',
    maxResults: '20',
    key,
  });
  return (data.items ?? []).filter((item: any) => item.id?.playlistId).map((item: any) => ({
    id: item.id.playlistId,
    playlistId: item.id.playlistId,
    title: item.snippet?.title ?? 'Playlist',
    channelTitle: item.snippet?.channelTitle ?? 'YouTube',
    thumbnail: item.snippet?.thumbnails?.high?.url
      ?? item.snippet?.thumbnails?.medium?.url
      ?? item.snippet?.thumbnails?.default?.url
      ?? '',
    kind: 'playlist' as const,
  }));
}

/** Search the music catalogue. Video/watch-party results are deliberately excluded. */
export async function searchYouTube(query: string): Promise<YouTubeResult[]> {
  const key = getKey();
  if (!key) {
    const videoId = parseYouTubeVideoId(query);
    if (videoId) return [await resolveVideoLink(videoId)];
    throw new Error('Add a YouTube Data API key for in-app search, or paste a YouTube video link/ID here to add a track.');
  }
  const [tracks, playlists] = await Promise.all([
    searchMusicTracks(query, key),
    searchPlaylists(query, key),
  ]);
  return [...tracks, ...playlists];
}

export async function getPlaylistItems(playlistId: string): Promise<QueueSeed[]> {
  const key = getKey();
  if (!key) throw new Error('YouTube search is not configured. Add EXPO_PUBLIC_YOUTUBE_API_KEY to .env.local and restart Expo.');

  const items: any[] = [];
  let pageToken = '';
  do {
    const params: Record<string, string> = { part: 'snippet,contentDetails', playlistId, maxResults: '50', key };
    if (pageToken) params.pageToken = pageToken;
    const page = await api('/playlistItems', params);
    items.push(...(page.items ?? []));
    pageToken = page.nextPageToken ?? '';
  } while (pageToken && items.length < 50);

  const ids = items.map(item => item.contentDetails?.videoId).filter(Boolean);
  const videos: any[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const page = await api('/videos', { part: 'contentDetails,snippet', id: ids.slice(i, i + 50).join(','), key });
    videos.push(...(page.items ?? []));
  }
  const byId = new Map(videos.map(item => [item.id, item]));
  return ids.filter((id: string) => byId.has(id)).map((id: string) => {
    const item: any = byId.get(id);
    return {
      id: item.id,
      videoId: item.id,
      title: item.snippet?.title ?? 'Untitled track',
      channelTitle: item.snippet?.channelTitle ?? 'YouTube',
      thumbnail: item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.medium?.url ?? '',
      duration: formatDuration(item.contentDetails?.duration),
      kind: 'music' as const,
    };
  });
}
