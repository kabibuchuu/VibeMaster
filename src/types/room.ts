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
  currentItemId: string;
  queue: QueueItem[];
  position: number;
  updatedAt: number;
  playbackUpdatedAt?: number;
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
