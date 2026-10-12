import { EventEmitter, requireNativeModule } from 'expo-modules-core';

export type NativeQueueTrack = {
  uri: string;
  title: string;
  artist: string;
};

export type NativePlaybackState = {
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  currentIndex: number;
  title: string;
  artist: string;
};

export type NativePlaybackEvent = Partial<NativePlaybackState> & { playbackState?: number };

type VibeMasterPlayerNativeModule = {
  play(uri: string, title: string, artist: string): Promise<boolean>;
  setQueue(tracks: NativeQueueTrack[], startIndex: number): Promise<boolean>;
  pause(): Promise<boolean>;
  stop(): Promise<boolean>;
  resume(): Promise<boolean>;
  seekTo(positionMs: number): Promise<boolean>;
  skipNext(): Promise<boolean>;
  skipPrevious(): Promise<boolean>;
  getState(): Promise<NativePlaybackState>;
};

const nativeModule = requireNativeModule<VibeMasterPlayerNativeModule & {
  addListener(eventName: string, listener: (event: NativePlaybackEvent) => void): { remove(): void };
}>('VibeMasterPlayer');

const eventEmitter = new EventEmitter(nativeModule as never);

export const nativePlayback = {
  play: (track: NativeQueueTrack) => nativeModule.play(track.uri, track.title, track.artist),
  setQueue: (tracks: NativeQueueTrack[], startIndex = 0) => nativeModule.setQueue(tracks, startIndex),
  pause: () => nativeModule.pause(),
  stop: () => nativeModule.stop(),
  resume: () => nativeModule.resume(),
  seekTo: (positionMs: number) => nativeModule.seekTo(positionMs),
  skipNext: () => nativeModule.skipNext(),
  skipPrevious: () => nativeModule.skipPrevious(),
  getState: () => nativeModule.getState(),
  addPlaybackListener: (listener: (event: NativePlaybackEvent) => void) =>
    eventEmitter.addListener('playbackStateChanged', listener),
};

/**
 * Native Media3 playback boundary. Track URIs must be supplied by a provider
 * adapter; this layer does not resolve or manufacture streaming URLs.
 */
