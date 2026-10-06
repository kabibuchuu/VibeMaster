# VibeMaster architecture

## Goal
VibeMaster lets a host create a room, share a short code, and synchronize YouTube playback with participants in near real time.

## MVP
1. Anonymous Firebase authentication.
2. Create a room with a short human-friendly code.
3. Join a room by code.
4. Realtime participant presence.
5. Host-controlled video/play/pause/seek state.
6. Embedded YouTube playback; the app does not extract or proxy YouTube media.
7. Manual re-sync action for drift recovery.

## Firestore model

`rooms/{roomId}`
- `code`: string
- `hostId`: string
- `videoId`: string|null
- `status`: `idle` | `playing` | `paused`
- `position`: number
- `updatedAt`: server timestamp
- `version`: integer

`rooms/{roomId}/participants/{uid}`
- `displayName`: string
- `joinedAt`: server timestamp
- `lastSeenAt`: server timestamp

## Synchronization
Only the host writes authoritative playback commands. A playback state contains a position and server timestamp. Clients estimate the current target position from elapsed time since the state was written. Clients should suppress write-back while applying remote state to avoid feedback loops.
