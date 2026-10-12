import { requireNativeModule } from 'expo-modules-core';
import { EventEmitter } from 'expo-modules-core';

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
  addListener(eventName: 'playbackStateChanged', listener: (event: NativePlaybackEvent) => void): { remove(): void };
};

let nativeModule: VibeMasterPlayerNativeModule | null = null;

function player(): VibeMasterPlayerNativeModule {
  if (nativeModule) return nativeModule;
  nativeModule = requireNativeModule<VibeMasterPlayerNativeModule>('VibeMasterPlayer');
  return nativeModule;
}

/**
 * Native Media3 playback boundary. Track URIs must come from a source adapter;
 * this module deliberately does not resolve or manufacture streaming URLs.
 */
let eventEmitter: EventEmitter<VibeMasterPlayerNativeModule> | null = null;

function events() {
  const native = player();
  if (!eventEmitter) eventEmitter = new EventEmitter(native);
  return eventEmitter;
}

export const nativePlayback = {
  play: (track: NativeQueueTrack) => player().play(track.uri, track.title, track.artist),
  setQueue: (tracks: NativeQueueTrack[], startIndex = 0) => player().setQueue(tracks, startIndex),
  pause: () => player().pause(),
  stop: () => player().stop(),
  resume: () => player().resume(),
  seekTo: (positionMs: number) => player().seekTo(positionMs),
  skipNext: () => player().skipNext(),
  skipPrevious: () => player().skipPrevious(),
  getState: () => player().getState(),
  addPlaybackListener: (listener: (event: NativePlaybackEvent) => void) =>
    events().addListener('playbackStateChanged', listener),
};
