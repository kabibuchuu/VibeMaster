import { Linking } from 'react-native';

export type YouTubeMusicLink = {
  kind: 'music' | 'playlist';
  id: string;
};

export function getYouTubeMusicUrl(item: YouTubeMusicLink): string {
  const id = encodeURIComponent(item.id);
  return item.kind === 'playlist'
    ? `https://music.youtube.com/playlist?list=${id}`
    : `https://music.youtube.com/watch?v=${id}`;
}

/**
 * Hand playback to YouTube Music itself. This intentionally does not resolve
 * undocumented stream URLs or try to keep a hidden/background YouTube player.
 */
export async function openInYouTubeMusic(item: YouTubeMusicLink): Promise<void> {
  const url = getYouTubeMusicUrl(item);
  await Linking.openURL(url);
}
