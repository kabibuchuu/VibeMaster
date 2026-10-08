import {
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../firebase';
import type { Participant, QueueItem, Room, RoomMessage, RoomMode } from '../types/room';

export const MAX_QUEUE_ITEMS = 50;

const roomRef = (code: string) => doc(db, 'rooms', code.trim().toUpperCase());
const participantRef = (code: string, userId: string) =>
  doc(collection(roomRef(code), 'participants'), userId);

function touch() {
  return { updatedAt: serverTimestamp(), version: increment(1) };
}

export async function createRoom(code: string, hostId: string, mode: RoomMode = 'mixed') {
  const ref = roomRef(code);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists()) throw new Error('ROOM_EXISTS');
    transaction.set(ref, {
      hostId,
      mode,
      status: 'waiting',
      currentItemId: '',
      queue: [],
      position: 0,
      ...touch(),
      createdAt: serverTimestamp(),
    });
  });
}

export async function updateRoom(code: string, data: Partial<Room>) {
  await updateDoc(roomRef(code), { ...data, ...touch() });
}

export async function updatePlayback(
  code: string,
  data: Pick<Room, 'status' | 'position' | 'currentItemId'>,
) {
  await updateRoom(code, data);
}

export async function addQueueItem(code: string, item: QueueItem) {
  await appendQueueItems(code, [item]);
}

export async function appendQueueItems(code: string, items: QueueItem[]) {
  if (!items.length) return;
  await runTransaction(db, async transaction => {
    const ref = roomRef(code);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('ROOM_NOT_FOUND');

    const existing = Array.isArray(snapshot.data().queue)
      ? (snapshot.data().queue as QueueItem[])
      : [];
    const byId = new Map(existing.map(item => [item.id, item]));
    for (const item of items) {
      if (!byId.has(item.id)) byId.set(item.id, item);
    }
    const queue = Array.from(byId.values()).slice(0, MAX_QUEUE_ITEMS);
    transaction.update(ref, { queue, ...touch() });
  });
}

export async function setQueue(code: string, queue: QueueItem[]) {
  const deduped = Array.from(new Map(queue.map(item => [item.id, item])).values()).slice(0, MAX_QUEUE_ITEMS);
  await updateRoom(code, { queue: deduped });
}

export async function removeQueueItem(code: string, itemId: string) {
  await runTransaction(db, async transaction => {
    const ref = roomRef(code);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('ROOM_NOT_FOUND');
    const data = snapshot.data();
    const queue = Array.isArray(data.queue) ? (data.queue as QueueItem[]) : [];
    if (data.currentItemId === itemId) throw new Error('CANNOT_REMOVE_CURRENT');
    transaction.update(ref, {
      queue: queue.filter(item => item.id !== itemId),
      ...touch(),
    });
  });
}

export async function moveQueueItem(code: string, itemId: string, direction: 'up' | 'down') {
  await runTransaction(db, async transaction => {
    const ref = roomRef(code);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('ROOM_NOT_FOUND');
    const queue = Array.isArray(snapshot.data().queue)
      ? [...(snapshot.data().queue as QueueItem[])]
      : [];
    const index = queue.findIndex(item => item.id === itemId);
    const next = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || next < 0 || next >= queue.length) return;
    [queue[index], queue[next]] = [queue[next], queue[index]];
    transaction.update(ref, { queue, ...touch() });
  });
}

export async function setCurrentItem(
  code: string,
  itemId: string,
  status: Room['status'] = 'paused',
  position = 0,
) {
  await updateRoom(code, {
    currentItemId: itemId,
    status,
    position: Math.max(0, position),
  });
}

export async function joinRoom(code: string, userId: string, name: string) {
  const clean = name.trim().slice(0, 32) || 'Guest';
  const ref = participantRef(code, userId);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists()) {
      transaction.update(ref, { name: clean });
      return;
    }
    transaction.set(ref, { name: clean, joinedAt: Date.now() });
  });
}

export async function leaveRoom(code: string, userId: string) {
  await deleteDoc(participantRef(code, userId));
}

export async function sendMessage(code: string, message: Omit<RoomMessage, 'id' | 'createdAt'>) {
  const ref = doc(collection(roomRef(code), 'messages'));
  await setDoc(ref, { ...message, createdAt: Date.now() });
}

function normalizeRoom(code: string, data: Record<string, unknown>): Room {
  const value = data.updatedAt;
  const updatedAt = typeof value === 'number'
    ? value
    : value && typeof (value as { toMillis?: unknown }).toMillis === 'function'
      ? (value as { toMillis: () => number }).toMillis()
      : Date.now();

  return {
    ...(data as Omit<Room, 'code' | 'updatedAt'>),
    code,
    updatedAt,
    queue: Array.isArray(data.queue) ? (data.queue as QueueItem[]).slice(0, MAX_QUEUE_ITEMS) : [],
    currentItemId: typeof data.currentItemId === 'string' ? data.currentItemId : '',
    position: typeof data.position === 'number' ? Math.max(0, data.position) : 0,
    version: typeof data.version === 'number' ? data.version : 0,
  };
}

export function watchRoom(
  code: string,
  cb: (room: Room | null) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    roomRef(code),
    snapshot => cb(
      snapshot.exists()
        ? normalizeRoom(snapshot.id, snapshot.data({ serverTimestamps: 'estimate' }))
        : null,
    ),
    error => onError?.(error),
  );
}

export function watchParticipants(
  code: string,
  cb: (items: Participant[]) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    collection(roomRef(code), 'participants'),
    snapshot => cb(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Participant))),
    error => onError?.(error),
  );
}

export function watchMessages(
  code: string,
  cb: (items: RoomMessage[]) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    collection(roomRef(code), 'messages'),
    snapshot => cb(
      snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as RoomMessage))
        .sort((a, b) => a.createdAt - b.createdAt)
        .slice(-50),
    ),
    error => onError?.(error),
  );
}
