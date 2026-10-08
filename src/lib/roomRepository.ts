import { arrayUnion, collection, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import type { Participant, QueueItem, Room, RoomMode } from '../types/room';

const roomRef = (code: string) => doc(db, 'rooms', code.toUpperCase());

export async function createRoom(code: string, hostId: string, mode: RoomMode = 'mixed') {
  await setDoc(roomRef(code), { hostId, mode, status: 'waiting', currentItemId: '', queue: [], position: 0, updatedAt: Date.now(), version: 1, createdAt: serverTimestamp() });
}

export async function updateRoom(code: string, data: Partial<Room>) {
  await updateDoc(roomRef(code), { ...data, updatedAt: Date.now(), version: Date.now() });
}

export async function updatePlayback(code: string, data: Pick<Room, 'status' | 'position' | 'currentItemId'>) {
  await updateRoom(code, data);
}

export async function addQueueItem(code: string, item: QueueItem) {
  await updateDoc(roomRef(code), { queue: arrayUnion(item), updatedAt: Date.now(), version: Date.now() });
}

export async function setQueue(code: string, queue: QueueItem[]) { await updateRoom(code, { queue }); }

export async function joinRoom(code: string, userId: string, name: string) {
  await setDoc(doc(collection(roomRef(code), 'participants'), userId), { name, joinedAt: Date.now() });
}

export function watchRoom(code: string, cb: (room: Room | null) => void) {
  return onSnapshot(roomRef(code), s => cb(s.exists() ? ({ code: s.id, ...s.data() } as Room) : null));
}

export function watchParticipants(code: string, cb: (items: Participant[]) => void) {
  return onSnapshot(collection(roomRef(code), 'participants'), s => cb(s.docs.map(d => ({ id: d.id, ...d.data() } as Participant))));
}
