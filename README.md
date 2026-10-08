# VibeMaster

VibeMaster is a synchronized YouTube listening/watch-party app.

## Stack

- React Native + Expo + TypeScript
- Firebase Authentication + Cloud Firestore
- YouTube Data API for discovery
- YouTube IFrame Player API inside a WebView
- Expo Router

## Current MVP

- Anonymous Firebase authentication
- Create a collision-safe room code
- Join a room with a display name
- Host-only playback controls
- Real-time room state in Firestore
- Drift correction for guests
- YouTube video and playlist search
- Queue seeded from videos or playlists
- Embedded YouTube playback without downloading or extracting media

## Local setup

Install Node.js LTS:

```bash
npm install
```

Create `.env.local` from `.env.example` and add a YouTube Data API v3 key:

```text
EXPO_PUBLIC_YOUTUBE_API_KEY=your_key_here
```

Do not commit `.env.local`.

The Firebase Web configuration lives in `firebase.ts`. It identifies the Firebase project; it is not a server credential.

Enable in Firebase:

1. Anonymous Authentication
2. Cloud Firestore
3. Publish the rules from `firestore.rules`

Run:

```bash
npx expo start --tunnel
```

Then open the project in Expo Go.

## YouTube setup

In Google Cloud, enable **YouTube Data API v3** for the project that owns the API key. Restrict the key to the APIs and application targets appropriate for your deployment.

The search implementation requests embeddable/syndicated videos and supports playlists. YouTube search requests consume quota, so avoid repeatedly submitting the same query during development.

## Playback model

The host is the source of truth for:

- current queue item
- playing/paused state
- playback position

The host writes a server timestamp with each playback state change. Guests calculate the expected position from the stored position plus elapsed time and periodically correct drift.

The player is embedded with the YouTube IFrame Player API. VibeMaster does not extract, download, or cache YouTube audio/video.

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
  createdAt

rooms/{roomCode}/participants/{uid}
  name
  joinedAt
```

## Notes

- No Android Studio is required for the current Expo Go development workflow.
- For a production build, add proper app-specific YouTube API key restrictions and complete Firebase/YouTube policy review.
