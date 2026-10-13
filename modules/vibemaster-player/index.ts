import { requireNativeModule } from 'expo-modules-core';

export type VibeMasterPlayerModule = {
  play(uri: string, title: string, artist: string): Promise<boolean>;
  setQueue(tracks: Array<{ uri: string; title: string; artist: string }>, startIndex: number): Promise<boolean>;
  pause(): Promise<boolean>;
  stop(): Promise<boolean>;
  resume(): Promise<boolean>;
  seekTo(positionMs: number): Promise<boolean>;
  skipNext(): Promise<boolean>;
  skipPrevious(): Promise<boolean>;
  getState(): Promise<{ isPlaying: boolean; positionMs: number; durationMs: number; currentIndex: number; title: string; artist: string }>;
};

export default requireNativeModule<VibeMasterPlayerModule>('VibeMasterPlayer');
