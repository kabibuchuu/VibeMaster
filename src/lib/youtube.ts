export type YouTubeResult = {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  kind: 'music' | 'video' | 'playlist';
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
  kind: 'music' | 'video';
};

const API_BASE='https://www.googleapis.com/youtube/v3';
function getKey(){return process.env.EXPO_PUBLIC_YOUTUBE_API_KEY?.trim()??'';}
function formatDuration(value?:string){if(!value)return undefined;const m=value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);if(!m)return undefined;const h=Number(m[1]??0),min=Number(m[2]??0),s=Number(m[3]??0);return h?\`${h}:${String(min).padStart(2,'0')}:${String(s).padStart(2,'0')}\`:\`${min}:${String(s).padStart(2,'0')}\`;}
export function youtubeConfigured(){return Boolean(getKey());}

export async function searchYouTube(query:string,kind:'music'|'video'|'all'='all'){
  const key=getKey(); if(!key)throw new Error('YouTube search is not configured. Add EXPO_PUBLIC_YOUTUBE_API_KEY to .env.local.');
  const p=new URLSearchParams({part:'snippet',q:query,type:kind==='music'?'video':'video,playlist',maxResults:'20',key});
  if(kind==='music')p.set('videoCategoryId','10');
  const res=await fetch(\`${API_BASE}/search?${p.toString()}\`);const data=await res.json();if(!res.ok)throw new Error(data?.error?.message??'YouTube search failed.');
  const videoIds=(data.items??[]).map((x:any)=>x.id?.videoId).filter(Boolean);
  const videos:any[]=[];
  if(videoIds.length){const d=new URLSearchParams({part:'contentDetails,snippet',id:videoIds.join(','),key});const dr=await fetch(\`${API_BASE}/videos?${d.toString()}\`);const dd=await dr.json();if(!dr.ok)throw new Error(dd?.error?.message??'Unable to load video details.');videos.push(...(dd.items??[]));}
  const videoResults=videos.map((x:any):YouTubeResult=>({id:x.id,title:x.snippet?.title??'Untitled',channelTitle:x.snippet?.channelTitle??'YouTube',thumbnail:x.snippet?.thumbnails?.high?.url??x.snippet?.thumbnails?.medium?.url??x.snippet?.thumbnails?.default?.url??'',kind:kind==='music'?'music':'video',duration:formatDuration(x.contentDetails?.duration)}));
  const playlistResults=(data.items??[]).filter((x:any)=>x.id?.playlistId).map((x:any):YouTubeResult=>({id:x.id.playlistId,playlistId:x.id.playlistId,title:x.snippet?.title??'Playlist',channelTitle:x.snippet?.channelTitle??'YouTube',thumbnail:x.snippet?.thumbnails?.high?.url??x.snippet?.thumbnails?.medium?.url??x.snippet?.thumbnails?.default?.url??'',kind:'playlist'}));
  return [...videoResults,...playlistResults];
}

export async function getPlaylistItems(playlistId:string):Promise<QueueSeed[]>{
  const key=getKey();if(!key)throw new Error('YouTube search is not configured.');
  const p=new URLSearchParams({part:'snippet,contentDetails',playlistId,maxResults:'50',key});
  const res=await fetch(\`${API_BASE}/playlistItems?${p.toString()}\`);const data=await res.json();if(!res.ok)throw new Error(data?.error?.message??'Unable to load playlist.');
  const ids=(data.items??[]).map((x:any)=>x.contentDetails?.videoId).filter(Boolean);
  if(!ids.length)return [];
  const d=new URLSearchParams({part:'contentDetails,snippet',id:ids.join(','),key});const dr=await fetch(\`${API_BASE}/videos?${d.toString()}\`);const dd=await dr.json();if(!dr.ok)throw new Error(dd?.error?.message??'Unable to load playlist videos.');
  return (dd.items??[]).map((x:any)=>({id:x.id,videoId:x.id,title:x.snippet?.title??'Untitled',channelTitle:x.snippet?.channelTitle??'YouTube',thumbnail:x.snippet?.thumbnails?.high?.url??x.snippet?.thumbnails?.medium?.url??'',duration:formatDuration(x.contentDetails?.duration),kind:'video'}));
}
