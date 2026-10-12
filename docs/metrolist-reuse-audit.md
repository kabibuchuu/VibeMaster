# Metrolist reuse and implementation audit

Date: 2026-10-12

Reference repositories:
- User's fork: https://github.com/kabibuchuu/Metrolist
- Upstream project: https://github.com/MetrolistGroup/Metrolist

Metrolist is a public Kotlin/Android YouTube Music client under GPL-3.0. Its architecture is a useful reference, but it is not a drop-in React Native library. VibeMaster currently uses Expo/React Native, TypeScript, Firebase, and a WebView-based YouTube IFrame player. Metrolist uses native Android/Kotlin components, so integrating its engine requires a native bridge or a larger native Android migration.

## What to reuse or adapt

| Area | Metrolist pattern | VibeMaster plan |
| --- | --- | --- |
| Audio engine | Android Media3 / ExoPlayer managed by a long-lived playback service | Use a native Media3 service or a compatible, maintained React Native player bridge; keep UI independent of the engine |
| Playback lifecycle | Background service and media-session connection between UI and playback | Preserve playback across screen changes, app backgrounding, and lock screen; expose state/events to React Native |
| Queue | Queue model owned by playback layer, not individual screens | Keep one authoritative queue model; make room commands operate on stable track IDs |
| Discovery | Separate YouTube Music/InnerTube client from playback and UI | Keep discovery behind a provider adapter; don't confuse search metadata or video IDs with authorized audio URLs |
| Player UI | Dedicated now-playing surface, queue controls, artwork, system media controls | Rebuild VibeMaster's portrait/expanded player as views over one engine, while retaining room/chat controls |
| Listen together | Shared listening state/protocol as a distinct subsystem | Retain Firebase room coordination initially; define authoritative controller, timestamped position, queue revision, reconnect and drift correction |

## What should not be copied blindly

- Do not transplant the whole Kotlin/Jetpack Compose application into the existing Expo project and expect it to compile as a dependency. Its UI, database, dependency injection, service, and app lifecycle are built around native Android.
- Do not ship an API secret or voice token-signing secret in the app.
- Do not treat a YouTube Data API result as a playable audio stream.
- Do not implement stream extraction, cipher bypass, or proxying without a separate review of applicable provider terms and distribution risk. GPL licensing grants software rights under its conditions; it does not grant rights to music or override service terms.
- Do not remove the current player until a replacement can play a supported test track end-to-end. The final release must not silently fall back to the iframe.

## License obligations

Metrolist is GPL-3.0. If VibeMaster copies or adapts GPL-covered implementation code and distributes a derivative, the distribution must comply with GPL-3.0, including applicable notices and corresponding-source requirements. Maintain attribution, a copy of the license, a record of reused paths/commits, and build instructions. Have the final distribution model reviewed before release. Merely using ideas or independently implementing a compatible architecture is not the same as copying implementation code.

## Delivery gates

1. Prove the chosen native player can load and play one supported audio URI in an Android development build, including pause, seek, next/previous, and background/lock-screen behavior.
2. Add a single playback service/store and connect the portrait and expanded player UI to it. Remove the WebView player after the replacement passes the smoke test.
3. Connect playback events to room state and validate two physical Android devices, including late join, track change, seek, drift correction, host departure, and reconnect.
4. Add voice chat with a server-issued, room-scoped LiveKit token; test permission denial, mute, leave/rejoin, and music playing concurrently.
5. Build and install an APK; run typecheck, native build, Firebase rules checks, license review, and multi-device acceptance tests.

## Current implementation status (2026-10-12)

A first native playback foundation has now been added on `feat/music-first-reconstruction`:

- Local Expo module at `modules/vibemaster-player/` exposes Media3 controls to TypeScript.
- `VibeMasterPlaybackService` owns a `MediaSession` and ExoPlayer instance for playback independent of React screen lifecycle.
- `plugins/with-vibemaster-playback.js` registers the Android media playback service and required foreground-service permissions.
- `src/lib/nativePlayback.ts` defines the typed JS boundary for track URIs, queue operations, playback controls, and state reads.

**This is scaffolding, not a verified end-to-end player.** The YouTube Music/InnerTube catalog and stream-resolution adapter has not yet been integrated, the room screen still uses the WebView player, and a native Android build/device test has not yet passed. The next implementation step is to connect a Metrolist-compatible source adapter to the native player, then replace the room's WebView only after the complete queue/room flow is smoke-tested. Keep the PR draft until the acceptance gates above pass.

## BitChord comparative audit (2026-10-12)

User-provided fork: https://github.com/kabibuchuu/BitChord (GPL-3.0). Upstream repository named in its README is https://github.com/kushagrasinghx/BitChord. The fork is an Android/Kotlin and shared Kotlin project; it is not a React Native dependency. Relevant verified files in the fork:
- `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/innertube/InnerTubeXResolver.kt`: provider wrapper around MetrolistGroup/innertubex, including locale/session config, extraction choices, and short-lived resolved-stream metadata.
- `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/innertube/StreamResolver.kt`: layered resolver (InnerTubeX first, NewPipe fallback, URL probing).
- `app/src/main/java/com/music/bitchord/playback/PlaybackService.kt`: Media3 service with a wide set of audio features.
- `app/src/main/java/com/music/bitchord/playback/PartySync.kt` and `app/src/main/java/com/music/bitchord/data/listentogether/ListenTogether.kt`: timestamped party playback model, sequence handling, server-clock alignment, drift reconciliation, host/control semantics.
- The service and resolver are large and depend heavily on BitChord's app types, repositories, logging, auth/session settings, and source registry. Directly copying either whole file into the small Expo module would not compile and would import a lot of unrelated complexity.

Useful architecture to adapt independently: keep the provider resolver behind a VibeMaster-native interface; keep the player in a MediaSessionService; implement room state around monotonic sequence/revision, server timestamp/clock offset, and drift thresholds; ensure inbound player corrections are not re-published as user commands. Existing Firebase room coordination will need an adapter rather than transplanting BitChord's WebSocket party service.

License: the fork reports GPL-3.0. Any copied or adapted code requires the applicable notices, modification markings and corresponding-source compliance. The source-provider terms and rights are a separate question from GPL. The current audit does not copy the large resolver/service/PoToken machinery wholesale.
