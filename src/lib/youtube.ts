export type YouTubeResult = {
  id: string; title: string; channelTitle: string; thumbnail: string;
  kind: 'music' | 'video' | 'playlist'; duration?: string; playlistId?: string;
};

export type QueueSeed = {
  id: string; videoId: string; title: string; channelTitle: string;
  thumbnail: string; duration?: string; kind: 'music' | 'video';
};

const API_BASE = 'https://www.googleapis.com/youtube/v3';
const getKey = () => process.env.EXPO_PUBLIC_YOUTUBE_API_KEY?.trim() ?? '';

function formatDuration(value?: string) {
  if (!value) return undefined;
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return undefined;
  const h = Number(match[1] ?? 0), m = Number(match[2] ?? 0), s = Number(match[3] ?? 0);
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
}

export function youtubeConfigured() { return Boolean(getKey()); }

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

async function searchVideos(query: string, key: string, music: boolean): Promise<YouTubeResult[]> {
  const data = await api('/search', {
    part:'snippet', q:query, type:'video', maxResults:'20',
    videoEmbeddable:'true', videoSyndicated:'true', key,
    ...(music ? {videoCategoryId:'10'} : {}),
  });
  const ids=(data.items??[]).map((x:any)=>x.id?.videoId).filter(Boolean);
  if(!ids.length)return [];
  const videos=(await api('/videos',{part:'contentDetails,snippet',id:ids.join(','),key})).items??[];
  return videos.map((x:any)=>({
    id:x.id,title:x.snippet?.title??'Untitled',channelTitle:x.snippet?.channelTitle??'YouTube',
    thumbnail:x.snippet?.thumbnails?.high?.url??x.snippet?.thumbnails?.medium?.url??x.snippet?.thumbnails?.default?.url??'',
    kind:music?'music':'video',duration:formatDuration(x.contentDetails?.duration),
  }));
}

async function searchPlaylists(query: string, key: string): Promise<YouTubeResult[]> {
  const data=await api('/search',{part:'snippet',q:query,type:'playlist',maxResults:'20',key});
  return (data.items??[]).filter((x:any)=>x.id?.playlistId).map((x:any)=>({
    id:x.id.playlistId,playlistId:x.id.playlistId,title:x.snippet?.title??'Playlist',channelTitle:x.snippet?.channelTitle??'YouTube',
    thumbnail:x.snippet?.thumbnails?.high?.url??x.snippet?.thumbnails?.medium?.url??x.snippet?.thumbnails?.default?.url??'',kind:'playlist' as const,
  }));
}

export async function searchYouTube(query: string, kind: 'music' | 'video' | 'all' = 'all') {
  const key=getKey();
  if(!key)throw new Error('YouTube search is not configured. Add EXPO_PUBLIC_YOUTUBE_API_KEY to .env.local and restart Expo.');
  const videos=await searchVideos(query,key,kind==='music');
  if(kind==='music'||kind==='video')return videos;
  const playlists=await searchPlaylists(query,key);
  return [...videos,...playlists];
}

export async function getPlaylistItems(playlistId: string): Promise<QueueSeed[]> {
  const key=getKey();
  if(!key)throw new Error('YouTube search is not configured. Add EXPO_PUBLIC_YOUTUBE_API_KEY to .env.local and restart Expo.');

  const items:any[]=[];let pageToken='';
  do{
    const params:Record<string,string>={part:'snippet,contentDetails',playlistId,maxResults:'50',key};
    if(pageToken)params.pageToken=pageToken;
    const page=await api('/playlistItems',params);
    items.push(...(page.items??[]));pageToken=page.nextPageToken??'';
  }while(pageToken&&items.length<50);

  const ids=items.map(x=>x.contentDetails?.videoId).filter(Boolean);
  const videos:any[]=[];
  for(let i=0;i<ids.length;i+=50){
    const page=await api('/videos',{part:'contentDetails,snippet',id:ids.slice(i,i+50).join(','),key});
    videos.push(...(page.items??[]));
  }
  const byId=new Map(videos.map(x=>[x.id,x]));
  return ids.filter(id=>byId.has(id)).map(id=>{
    const x=byId.get(id);
    return {id:x.id,videoId:x.id,title:x.snippet?.title??'Untitled',channelTitle:x.snippet?.channelTitle??'YouTube',
      thumbnail:x.snippet?.thumbnails?.high?.url??x.snippet?.thumbnails?.medium?.url??'',
      duration:formatDuration(x.contentDetails?.duration),kind:'video' as const};
  });
}