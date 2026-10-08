export type YouTubeResult = {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  kind: 'music' | 'video';
  duration?: string;
};

const API_BASE = 'https://www.googleapis.com/youtube/v3';

function getKey() {
  return process.env.EXPO_PUBLIC_YOUTUBE_API_KEY?.trim() ?? '';
}

function formatDuration(value?: string) {
  if (!value) return undefined;
  const match = value.match(/PT(?:(\\d+)H)?(?:(\\d+)M)?(?:(\\d+)S)?/);
  if (!match) return undefined;
  const h = Number(match[1] ?? 0), m = Number(match[2] ?? 0), s = Number(match[3] ?? 0);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export function youtubeConfigured() { return Boolean(getKey()); }

export async function searchYouTube(query: string, kind: 'music' | 'video' | 'all' = 'all') {
  const key = getKey();
  if (!key) throw new Error('YouTube search is not configured. Add EXPO_PUBLIC_YOUTUBE_API_KEY to .env.local.');
  const params = new URLSearchParams({ part: 'snippet', q: query, type: 'video', maxResults: '20', key });
  if (kind === 'music') params.set('videoCategoryId', '10');
  const response = await fetch(`${API_BASE}/search?${params.toString()}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message ?? 'YouTube search failed.');
  const ids = (data.items ?? []).map((item: any) => item.id?.videoId).filter(Boolean);
  if (!ids.length) return [];
  const detailsParams = new URLSearchParams({ part: 'contentDetails,snippet', id: ids.join(','), key });
  const detailsResponse = await fetch(`${API_BASE}/videos?${detailsParams.toString()}`);
  const details = await detailsResponse.json();
  if (!detailsResponse.ok) throw new Error(details?.error?.message ?? 'Unable to load video details.');
  return (details.items ?? []).map((item: any): YouTubeResult => ({
    id: item.id,
    title: item.snippet?.title ?? 'Untitled',
    channelTitle: item.snippet?.channelTitle ?? 'YouTube',
    thumbnail: item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? '',
    kind: kind === 'music' ? 'music' : 'video',
    duration: formatDuration(item.contentDetails?.duration),
  }));
}
