export type RoomMode = 'music';

export type QueueItem = {
  id: string;
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  duration?: string;
  kind: 'music';
};

export type Room = {
  code: string;
  hostId: string;
  mode: RoomMode;
  status: 'waiting' | 'playing' | 'paused';
  /** Room-wide playback engine selected by the host/controller. */
  playbackEngine?: 'iframe' | 'native';
  currentItemId: string;
  queue: QueueItem[];
  position: number;
  updatedAt: number;
  playbackUpdatedAt?: number;
  /** Monotonic playback command revision for stale/out-of-order update rejection. */
  playbackRevision?: number;
  /** Client/server timestamp anchor for scheduled starts and shared clock estimation. */
  playbackStartedAt?: number | null;
  version: number;
  controllerIds: string[];
};

export type Participant = { id: string; name: string; joinedAt: number; role?: 'member' | 'controller' };

export type RoomMessage = {
  id: string;
  userId: string;
  name: string;
  text: string;
  createdAt: number;
};
