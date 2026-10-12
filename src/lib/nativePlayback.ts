import { requireNativeModule } from 'expo-modules-core';

export type NativeQueueTrack = {
  uri: string;
  title: string;
  artist: string;
  mimeType?: string;
  headers?: Record<string, string>;
};

export type ResolvedNativeTrack = {
  videoId: string;
  url: string;
  mimeType: string;
  bitrate: number;
  clientName: string;
  headers: Record<string, string>;
};

export type NativePlaybackState = {
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  currentIndex: number;
  title: string;
  artist: string;
  playbackState?: number;
};
export type NativePlaybackEvent = Partial<NativePlaybackState> & { title?: string; artist?: string };

type VibeMasterPlayerNativeModule = {
  resolveTrack(videoId: string): Promise<ResolvedNativeTrack>;
  play(uri: string, title: string, artist: string, mimeType?: string, headers?: Record<string, string>): Promise<boolean>;
  setQueue(tracks: NativeQueueTrack[], startIndex: number): Promise<boolean>;
  pause(): Promise<boolean>;
  stop(): Promise<boolean>;
  resume(): Promise<boolean>;
  seekTo(positionMs: number): Promise<boolean>;
  skipNext(): Promise<boolean>;
  skipPrevious(): Promise<boolean>;
  getState(): Promise<NativePlaybackState>;
  addListener(eventName: string, listener: (event: NativePlaybackEvent) => void): { remove(): void };
};

let cachedModule: VibeMasterPlayerNativeModule | null = null;

function getNativeModule() {
  if (!cachedModule) {
    cachedModule = requireNativeModule<VibeMasterPlayerNativeModule>('VibeMasterPlayer');
  }
  return cachedModule;
}

/**
 * Native Media3 controls and the InnerTubeX source adapter.
 * Resolved URLs expire and should be resolved just before playback; never store
 * them in Firestore or treat them as stable track identifiers.
 */
export const nativePlayback = {
  resolveTrack: (videoId: string) => getNativeModule().resolveTrack(videoId),
  play: (track: NativeQueueTrack) =>
    getNativeModule().play(track.uri, track.title, track.artist, track.mimeType ?? '', track.headers ?? {}),
  setQueue: (tracks: NativeQueueTrack[], startIndex = 0) => getNativeModule().setQueue(tracks, startIndex),
  pause: () => getNativeModule().pause(),
  stop: () => getNativeModule().stop(),
  resume: () => getNativeModule().resume(),
  seekTo: (positionMs: number) => getNativeModule().seekTo(positionMs),
  skipNext: () => getNativeModule().skipNext(),
  skipPrevious: () => getNativeModule().skipPrevious(),
  getState: () => getNativeModule().getState(),
  addPlaybackListener: (listener: (event: NativePlaybackEvent) => void) =>
    getNativeModule().addListener('playbackStateChanged', listener),
};
