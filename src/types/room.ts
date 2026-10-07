export type Room = {
  code:string; hostId:string; status:'waiting'|'playing'|'paused'; videoId:string;
  position:number; updatedAt:number; version:number;
};
export type Participant = { id:string; name:string; joinedAt:number };
