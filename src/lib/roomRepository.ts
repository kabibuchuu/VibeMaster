import { arrayUnion, collection, doc, increment, onSnapshot, runTransaction, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import type { Participant, QueueItem, Room, RoomMode } from '../types/room';

const roomRef = (code: string) => doc(db, 'rooms', code.trim().toUpperCase());

export async function createRoom(code: string, hostId: string, mode: RoomMode = 'mixed') {
  const ref = roomRef(code);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists()) throw new Error('ROOM_EXISTS');
    transaction.set(ref, {
      hostId, mode, status: 'waiting', currentItemId: '', queue: [], position: 0,
      updatedAt: serverTimestamp(), version: 0, createdAt: serverTimestamp(),
    });
  });
}

export async function updateRoom(code: string, data: Partial<Room>) {
  await updateDoc(roomRef(code), { ...data, updatedAt: serverTimestamp(), version: increment(1) });
}

export async function updatePlayback(code: string, data: Pick<Room, 'status' | 'position' | 'currentItemId'>) {
  await updateRoom(code, data);
}

export async function addQueueItem(code: string, item: QueueItem) {
  await updateDoc(roomRef(code), { queue: arrayUnion(item), updatedAt: serverTimestamp(), version: increment(1) });
}

export async function setQueue(code: string, queue: QueueItem[]) {
  await updateRoom(code, { queue });
}

export async function joinRoom(code: string, userId: string, name: string) {
  await setDoc(doc(collection(roomRef(code), 'participants'), userId), {
    name: name.trim().slice(0, 32) || 'Guest',
    joinedAt: Date.now(),
  }, { merge: true });
}

export async function leaveRoom(code: string, userId: string) {
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(collection(roomRef(code), 'participants'), userId));
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
    queue: Array.isArray(data.queue) ? data.queue as QueueItem[] : [],
    currentItemId: typeof data.currentItemId === 'string' ? data.currentItemId : '',
    position: typeof data.position === 'number' ? data.position : 0,
    version: typeof data.version === 'number' ? data.version : 0,
  };
}

export function watchRoom(code: string, cb: (room: Room | null) => void, onError?: (error: Error) => void) {
  return onSnapshot(
    roomRef(code),
    snapshot => cb(snapshot.exists() ? normalizeRoom(snapshot.id, snapshot.data({ serverTimestamps: 'estimate' })) : null),
    error => onError?.(error),
  );
}

export function watchParticipants(code: string, cb: (items: Participant[]) => void, onError?: (error: Error) => void) {
  return onSnapshot(
    collection(roomRef(code), 'participants'),
    snapshot => cb(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Participant))),
    error => onError?.(error),
  );
}