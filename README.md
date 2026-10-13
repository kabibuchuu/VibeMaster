# VibeMaster

VibeMaster is being rebuilt as an Android-first, music-focused shared listening app. The target experience is synchronized rooms, track queues and playlists, text chat, and live voice chat.

## Current implementation status

This branch is an in-progress reconstruction, not a release-ready app.

- Music-only discovery and room-creation UI: implemented in this branch.
- Room state, queue, participants, and text chat: existing Firebase/Firestore implementation.
- Room playback supports the embedded YouTube IFrame player plus an experimental native Media3/ExoPlayer path. The native source resolver and background service are not release-verified; the current branch must not be represented as a verified audio-only/background release.
- Voice chat: a LiveKit room screen and Firebase callable token issuer have now been added on this branch. This is implementation groundwork, not yet a verified end-to-end feature: install dependencies, deploy the function, configure LiveKit secrets, build a dev APK, and test with two physical devices.
- The room-sync layer now estimates a timestamped playhead and reconciles either selected engine, but native resolution and multi-device behavior still require a successful APK build and physical-device testing.

Do not describe this branch as delivering audio-only playback or voice chat until those systems are implemented and tested on real Android devices.

## Stack currently in the repository

- React Native + Expo + TypeScript / Expo Router
- Firebase Authentication + Cloud Firestore
- YouTube Data API v3 for discovery
- YouTube IFrame Player API in `react-native-webview`; experimental Media3/ExoPlayer service with an InnerTubeX resolver
- Expo Audio configured for background-capable native audio, LiveKit React Native for voice, Expo Screen Orientation and React Native Community Slider

## Experimental native playback path

The in-room **NAT ▶** action asks the native InnerTubeX adapter to resolve the current YouTube video ID, then sends the short-lived audio URI and request headers to Media3/ExoPlayer. It pauses the WebView player first to prevent overlapping audio. This is a test path, not yet the authoritative room player; queue sync and playhead drift correction still target the WebView player. Stream resolution can fail for tracks requiring tokens or client profiles not enabled in this minimal adapter. Resolved audio URLs expire and must not be stored in Firestore.

Metrolist and BitChord are GPL-3.0 projects and the InnerTubeX library used here is GPL-3.0. Review `docs/metrolist-reuse-audit.md` and retain notices/source compliance before distributing a build. GPL licensing does not grant rights to the audio, and the unofficial integration may fail or be affected by provider-side changes.

## Target architecture

1. **Android native audio playback:** replace the iframe player with a native Media3/ExoPlayer-backed module. The current iframe is a temporary legacy path, not the target.
2. **Room synchronization:** keep Firestore as the room/queue coordination layer; synchronize item identity, play/pause state, and a timestamped playback position, with drift correction on each client.
3. **Voice rooms:** use a real-time audio transport (planned: LiveKit) with a server-issued room token. Never ship an API secret or token-signing secret in the mobile app.
4. **Native builds:** use an Expo development build / EAS APK for native modules. Expo Go alone cannot load LiveKit's native WebRTC modules. The room player uses the official YouTube IFrame player in the foreground. YouTube policy does not permit using the API to create a background player; VibeMaster therefore does not claim YouTube background or lock-screen playback.
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

## Local Expo setup

For full in-app catalogue search, create `.env.local` from `.env.example` and set:

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

1. Install root dependencies with `npm install`, then install LiveKit's Expo packages using the official LiveKit Expo instructions.
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
- YouTube Music handoff is available from search results and the room player. See `docs/youtube-music-integration.md` for the official API policy review and the limits on background audio, stream extraction, and synchronized playback in the external app.
- The official YouTube API does not provide an ordinary third-party audio-only stream endpoint. If native background playback is a hard requirement, obtain explicit written authorization for a YouTube integration or use a separately licensed audio provider.
- Firebase configuration/authentication must be validated in the target environment.
- Voice chat requires a LiveKit project and deployment of the Firebase callable. It has not been built or verified on physical devices in this change.
- When no YouTube Data API key is configured, users can still paste a YouTube video URL or ID to add a single track (metadata is resolved through YouTube's oEmbed endpoint), or search in YouTube Music and open results externally. Full in-app catalogue and playlist search requires the API key. The native resolver only gets a temporary playable audio URI at playback time; it does not store it in Firestore. External YouTube Music handoff remains uncontrollable, and native playback still needs Android build and multi-device validation.
