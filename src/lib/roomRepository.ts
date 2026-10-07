import { collection, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import type { Participant, Room } from '../types/room';

const roomRef=(code:string)=>doc(db,'rooms',code.toUpperCase());
export async function createRoom(code:string,hostId:string){ await setDoc(roomRef(code),{hostId,status:'waiting',videoId:'',position:0,updatedAt:Date.now(),version:1,createdAt:serverTimestamp()}); }
export async function updatePlayback(code:string,data:Partial<Room>){ await updateDoc(roomRef(code),{...data,updatedAt:Date.now(),version:Date.now()}); }
export async function joinRoom(code:string,userId:string,name:string){ await setDoc(doc(collection(roomRef(code),'participants'),userId),{name,joinedAt:Date.now()}); }
export function watchRoom(code:string,cb:(room:Room|null)=>void){ return onSnapshot(roomRef(code),s=>cb(s.exists()?({code:s.id,...s.data()} as Room):null)); }
export function watchParticipants(code:string,cb:(items:Participant[])=>void){ return onSnapshot(collection(roomRef(code),'participants'),s=>cb(s.docs.map(d=>({id:d.id,...d.data()} as Participant)))); }
