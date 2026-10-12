# VibeMaster

VibeMaster is being rebuilt as an Android-first, music-focused shared listening app. The target experience is synchronized rooms, track queues and playlists, text chat, and live voice chat.

## Current implementation status

This branch is an in-progress reconstruction, not a release-ready app.

- Music-only discovery and room-creation UI: implemented in this branch.
- Room state, queue, participants, and text chat: existing Firebase/Firestore implementation.
- Actual playback: still uses the YouTube IFrame Player API in a WebView. It is **not yet a native audio-only engine**.
- Voice chat: a LiveKit room screen and Firebase callable token issuer have now been added on this branch. This is implementation groundwork, not yet a verified end-to-end feature: install dependencies, deploy the function, configure LiveKit secrets, build a dev APK, and test with two physical devices.
- Native Android playback, background controls, and end-to-end multi-device sync: not complete or validated.

Do not describe this branch as delivering audio-only playback or voice chat until those systems are implemented and tested on real Android devices.

## Stack currently in the repository

- React Native + Expo + TypeScript / Expo Router
- Firebase Authentication + Cloud Firestore
- YouTube Data API v3 for discovery
- YouTube IFrame Player API in `react-native-webview` for current playback
- Expo Audio configured for background-capable native audio, LiveKit React Native for voice, Expo Screen Orientation and React Native Community Slider

## Target architecture

1. **Android native audio playback:** replace the iframe player with a native Media3/ExoPlayer-backed module. The current iframe is a temporary legacy path, not the target.
2. **Room synchronization:** keep Firestore as the room/queue coordination layer; synchronize item identity, play/pause state, and a timestamped playback position, with drift correction on each client.
3. **Voice rooms:** use a real-time audio transport (planned: LiveKit) with a server-issued room token. Never ship an API secret or token-signing secret in the mobile app.
4. **Native builds:** use an Expo development build / EAS APK for native modules. Expo Go alone cannot load LiveKit's native WebRTC modules. Expo Audio background-playback config is enabled, but the current room player still uses the legacy YouTube iframe and has not been replaced by a native audio-only source.
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

## Voice chat setup (not yet deployed)

The room header now links to the voice screen. Voice tokens are issued by a Firebase callable function; the API secret is not embedded in the app.

1. Install root dependencies with the Expo-compatible installer: `npx expo install expo-audio`, then install LiveKit's Expo packages using the official LiveKit Expo instructions.
2. Install Functions dependencies: `cd functions && npm install && npm run build`.
3. Configure Firebase Functions secrets and parameter:
   ```sh
   firebase functions:secrets:set LIVEKIT_API_KEY
   firebase functions:secrets:set LIVEKIT_API_SECRET
   ```
   Set the `LIVEKIT_URL` deployment parameter to your LiveKit server URL when prompted during deployment. The URL should be the WebSocket URL for your LiveKit server, such as `wss://your-project.livekit.cloud`.
4. Deploy with `firebase deploy --only functions:createVoiceToken`.
5. Create a **development APK**, not Expo Go, and test join/mute/leave with at least two signed-in Android devices.

The callable only mints a token for an authenticated user who already has a participant document in the requested Firestore room. The app still needs end-to-end testing; successful code commits do not mean the function is deployed or voice works in production.

## Important limitations

- YouTube API search requires a configured API key and is subject to quota.
- Embedded playback availability and policy constraints are controlled by YouTube.
- Firebase configuration/authentication must be validated in the target environment.
- Voice chat requires a LiveKit project and deployment of the Firebase callable. It has not been built or verified on physical devices in this change.
- The app's music catalogue currently returns YouTube video IDs, not authorized direct audio URLs. Expo Audio cannot play a YouTube video ID as an audio stream. Replacing the iframe with native audio requires a licensed/authorized playable source; this branch does not yet complete that source integration.
