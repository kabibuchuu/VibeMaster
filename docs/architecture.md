# VibeMaster architecture

## Product direction

VibeMaster is an Android-first, music-only shared listening app. Video playback and watch-party modes are out of scope for the first release. The core experience is music discovery, personal and shared queues/playlists, synchronized rooms, text chat, and optional live voice chat.

This document describes the target architecture, not a claim that the target systems are already implemented.

## Current implementation snapshot

- React Native + Expo + Expo Router + TypeScript.
- Firebase Authentication and Cloud Firestore for users, room state, participants, queue, and messages.
- Music discovery currently uses YouTube Data API results.
- app/room.tsx still hosts the YouTube IFrame Player API in a WebView. It is legacy playback and must be replaced before calling the app music-only.
- A LiveKit voice screen and Firebase token callable have been added but are not yet deployed or device-tested.
- Search results and room tracks can be opened in the YouTube Music app. External playback cannot be controlled or verified by VibeMaster.
- EAS profiles are configuration only; a successful APK build and real-device test are still required.

## Target architecture

### 1. Playback engine and provider boundary

For YouTube Music, use only documented YouTube APIs and user-initiated handoff links unless YouTube grants written authorization for a different integration. The official IFrame player is an embedded audiovisual player, not an authorized native audio-stream source. Do not replace it with extracted stream URLs. A native background audio engine requires a separately authorized playable source or written provider permission.

The playback interface should expose:
- load a track from a supported, authorized audio source;
- play, pause, seek, skip, and report position/duration;
- playback state and recoverable errors;
- background playback and Android media notification/lock-screen controls;
- queue management independent of the UI.

Keep player state in one shared service/store. Portrait player, expanded player, and room controls must be views over the same engine—not separate players. Do not mount or retain a video WebView as a hidden playback dependency.

**YouTube policy constraint:** YouTube's current developer policies prohibit scraping, undocumented API use without express permission, separating audio from video, and background-player features. The app now exposes explicit links to open tracks in YouTube Music. VibeMaster cannot truthfully claim native background playback or synchronized control of tracks after handoff to the external app. See `docs/youtube-music-integration.md`.

### 2. Room synchronization

Firestore remains the coordination layer, not the media transport. Store a canonical queue item ID, playback status, position, server timestamp, revision, and controller/host identity.

- Only the authorized controller writes authoritative playback commands.
- Clients estimate the target position from the last timestamped state.
- On track changes, load the same canonical item on each client before applying play/pause.
- Correct small drift with gentle seeks; use a larger threshold for hard resync.
- Suppress write-back while applying remote state to avoid feedback loops.
- Handle late joins, app background/resume, stale room state, host departure, and network reconnection explicitly.

A synchronized room is only truly synchronized when all clients can resolve the same track through a supported audio source.

### 3. Voice chat

Use a real-time voice transport such as LiveKit, separate from music playback. The app must request microphone permission in context and show clear mute/connection state.

- Use a server-side token endpoint or trusted Firebase Cloud Function.
- Never embed a LiveKit API secret or token-signing secret in the mobile app.
- Scope room tokens to the authenticated user and authorized room; use short expirations.
- Define join/leave, mute, reconnect, and room teardown behavior.
- Test audio focus and echo/noise behavior while music is playing. Do not assume voice and music can be mixed correctly without device testing.

### 4. Licensing and compliance

Metrolist is GPL-3.0. If code is copied or adapted, preserve license notices and comply with applicable source-offer/source-distribution requirements for distributed derivatives. Keep a record of every reused component and its license. GPL compliance does not replace review of the audio provider's terms or rights.

## Implementation sequence and acceptance criteria

1. **Playback/source gate:** test the official YouTube Music handoff on Android. If native background playback and cross-device sync are mandatory, obtain written provider authorization or choose a separately licensed source before implementing that engine.
2. **Playback service:** add one authoritative player service, queue operations, loading/error states, audio focus, and media notification controls. Remove the IFrame WebView only when the replacement path is functional.
3. **Room sync:** connect the native service to timestamped Firestore room state; test two physical Android devices, late join, seek, track change, host handoff, and reconnect.
4. **Voice:** add LiveKit client and secured token issuance; test permission denial, mute, disconnect/reconnect, and concurrent music playback.
5. **Release gate:** run typecheck, native Android build, Firebase rules review, dependency/license review, and end-to-end tests before marking the PR ready or merging.

## Release rule

Do not mark native playback, synchronization, voice chat, or release readiness complete based on TypeScript passing or configuration files existing. Each requires implementation plus the relevant build/device test.