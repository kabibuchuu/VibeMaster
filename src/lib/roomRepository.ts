import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  limit,
  orderBy,
  query,
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

function cleanQueueItem(item: QueueItem): QueueItem {
  const cleaned: QueueItem = {
    id: item.id,
    videoId: item.videoId,
    title: item.title,
    channelTitle: item.channelTitle,
    thumbnail: item.thumbnail,
    kind: item.kind,
  };
  if (item.duration) cleaned.duration = item.duration;
  return cleaned;
}

function cleanQueue(items: QueueItem[]) {
  return items.map(cleanQueueItem);
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
  const cleaned = Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  ) as Partial<Room>;
  await updateDoc(roomRef(code), { ...cleaned, ...touch() });
}

export async function setController(code: string, userId: string, enabled: boolean) {
  const ref = roomRef(code);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('ROOM_NOT_FOUND');
    const data = snapshot.data();
    const current = Array.isArray(data.controllerIds) ? (data.controllerIds as string[]) : [];
    const next = enabled
      ? Array.from(new Set([...current, userId]))
      : current.filter(id => id !== userId);
    transaction.update(ref, { controllerIds: next, ...touch() });
  });
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
      if (!byId.has(item.id)) byId.set(item.id, cleanQueueItem(item));
    }
    const queue = Array.from(byId.values()).slice(0, MAX_QUEUE_ITEMS);
    transaction.update(ref, { queue: cleanQueue(queue), ...touch() });
  });
}

export async function setQueue(code: string, queue: QueueItem[]) {
  const deduped = Array.from(new Map(cleanQueue(queue).map(item => [item.id, item])).values()).slice(0, MAX_QUEUE_ITEMS);
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
    transaction.update(ref, { queue: cleanQueue(queue), ...touch() });
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

export async function deleteRoomDeep(code: string, hostId: string) {
  const room = await getDoc(roomRef(code));
  if (!room.exists()) throw new Error('ROOM_NOT_FOUND');
  if (room.data().hostId !== hostId) throw new Error('NOT_HOST');

  const [participants, messages] = await Promise.all([
    getDocs(collection(roomRef(code), 'participants')),
    getDocs(collection(roomRef(code), 'messages')),
  ]);

  const refs = [
    ...participants.docs.map(item => item.ref),
    ...messages.docs.map(item => item.ref),
    roomRef(code),
  ];

  for (let start = 0; start < refs.length; start += 450) {
    const batch = writeBatch(db);
    refs.slice(start, start + 450).forEach(ref => batch.delete(ref));
    await batch.commit();
  }
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
    controllerIds: Array.isArray(data.controllerIds) ? (data.controllerIds as string[]) : [],
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
    query(
      collection(roomRef(code), 'messages'),
      orderBy('createdAt', 'desc'),
      limit(50),
    ),
    snapshot => cb(
      snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as RoomMessage))
        .sort((a, b) => a.createdAt - b.createdAt),
    ),
    error => onError?.(error),
  );
}
