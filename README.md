# VibeMaster

VibeMaster is being rebuilt as an Android-first, music-focused shared listening app. The target experience is synchronized rooms, track queues and playlists, text chat, and live voice chat.

## Current implementation status

This branch is an in-progress reconstruction, not a release-ready app.

- Music-only discovery and room-creation UI: implemented in this branch.
- Room state, queue, participants, and text chat: existing Firebase/Firestore implementation.
- Actual playback: still uses the YouTube IFrame Player API in a WebView. It is **not yet a native audio-only engine**.
- Voice chat: **not implemented yet**. The microphone permissions in the Expo config are groundwork only and do not start recording or transmit voice.
- Native Android playback, background controls, and end-to-end multi-device sync: not complete or validated.

Do not describe this branch as delivering audio-only playback or voice chat until those systems are implemented and tested on real Android devices.

## Stack currently in the repository

- React Native + Expo + TypeScript / Expo Router
- Firebase Authentication + Cloud Firestore
- YouTube Data API v3 for discovery
- YouTube IFrame Player API in `react-native-webview` for current playback
- Expo Screen Orientation and React Native Community Slider

## Target architecture

1. **Android native audio playback:** replace the iframe player with a native Media3/ExoPlayer-backed module. The current iframe is a temporary legacy path, not the target.
2. **Room synchronization:** keep Firestore as the room/queue coordination layer; synchronize item identity, play/pause state, and a timestamped playback position, with drift correction on each client.
3. **Voice rooms:** use a real-time audio transport (planned: LiveKit) with a server-issued room token. Never ship an API secret or token-signing secret in the mobile app.
4. **Native builds:** use an Expo development build / EAS APK for native modules. Expo Go alone cannot load custom native playback or voice SDK modules.
5. **Licensing review:** Metrolist is GPL-3.0. If its playback implementation is copied or adapted into a distributed VibeMaster build, preserve required notices and meet GPL source-distribution obligations. The current branch has not yet integrated Metrolist playback code.

## Android build profiles

The EAS profiles in `eas.json` describe development and preview APK builds and a production Android App Bundle. They do not mean that a build has already been generated or tested.

Before building a development APK, install/configure EAS CLI and authenticate:

```bash
npm install
npx eas-cli login
npx eas-cli build --platform android --profile development
```

Install the resulting APK on the Android device. A development build is different from Expo Go and is required once native modules are added.

## Local Expo setup (current legacy path)

Create `.env.local` from `.env.example` and set:

```text
EXPO_PUBLIC_YOUTUBE_API_KEY=your_key_here
```

Do not commit `.env.local`.

Enable in Firebase:
1. Anonymous Authentication
2. Cloud Firestore
3. Publish the repository's Firestore rules

## Firestore room model

```text
rooms/{roomCode}
  hostId
  mode
  status
  currentItemId
  queue[]
  position
  updatedAt
  playbackUpdatedAt
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

## Important limitations

- YouTube API search requires a configured API key and is subject to quota.
- Embedded playback availability and policy constraints are controlled by YouTube.
- Firebase configuration/authentication must be validated in the target environment.
- The new microphone-related Android permissions are preparatory configuration only; they do not constitute voice chat.
