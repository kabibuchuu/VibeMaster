# VibeMaster

VibeMaster is a synchronized YouTube listening/watch-party mobile app.

## Stack

- React Native + Expo + TypeScript
- Firebase Authentication + Cloud Firestore
- YouTube Data API v3 for discovery
- YouTube IFrame Player API inside a WebView
- Expo Router
- Expo Brightness + Screen Orientation
- React Native Community Slider

## Current MVP

- Anonymous Firebase authentication with React Native persistence
- Create or join a room with a short code
- Music, video, and mixed room modes
- Real-time synchronized playback
- Host playback control
- Host can grant/revoke playback access to individual participants
- Playback controls: play/pause, previous/next, ±10 seconds, progress seeking
- Fullscreen landscape player
- Volume and video brightness controls
- Queue management
- Room chat
- YouTube video and playlist discovery
- Queue seeded from YouTube videos/playlists
- YouTube media stays embedded; VibeMaster does not download or extract media

## Local setup

Always pull the latest app changes before testing:

```bat
cd /d D:\VibeMaster
git pull origin main
npm install
npx expo start -c
```

For restrictive networks, use LAN when the phone and development PC share the same Wi-Fi. Expo tunnel mode can be unreliable and is not required for the app itself.

Create `.env.local` from `.env.example`:

```text
EXPO_PUBLIC_YOUTUBE_API_KEY=your_key_here
```

Do not commit `.env.local`.

Enable in Firebase:

1. Anonymous Authentication
2. Cloud Firestore
3. Publish `firestore.rules`

## Playback model

The Firestore room document is the shared source of truth for:

- current queue item
- playing/paused state
- playback position
- controller IDs

Controllers can publish playback state. Viewers calculate the expected position from the last persisted position plus elapsed time and periodically correct drift.

The player is embedded with the YouTube IFrame Player API. VibeMaster does not extract, download, or cache YouTube media.

## Firestore model

```text
rooms/{roomCode}
  hostId
  mode
  status
  currentItemId
  queue[]
  position
  updatedAt
  version
  controllerIds
  createdAt

rooms/{roomCode}/participants/{uid}
  name
  joinedAt

rooms/{roomCode}/messages/{messageId}
  userId
  name
  text
  createdAt
```

## Room data lifecycle

The host's Room controls now include **End room & delete data**. That action deletes the room, its participant documents, and its chat messages.

Existing old rooms from development are still normal Firestore data. They can be removed from the Firebase console. Firebase documents that deleting a document from the console also deletes its nested data. citeturn893545search0

For larger production-scale retention, a server-side recursive cleanup or scheduled cleanup is preferable to doing broad deletes from a mobile client. Firebase documents callable/server-side recursive deletion for this use case. citeturn893545search1turn893545search4

## YouTube player limitation

VibeMaster supplies the app-level title, queue, controls, volume, brightness, fullscreen, and access UI.

The actual media remains a YouTube embedded player. YouTube's current embedded-player documentation says the player can keep displaying YouTube attribution/title/avatar elements in states such as paused/ended, and the old `modestbranding` option is deprecated and has no effect. citeturn630404search0turn630404search2

## Notes

- No Android Studio is required for the Expo Go development workflow.
- For production, use app-restricted YouTube API keys and complete Firebase/YouTube policy review.
