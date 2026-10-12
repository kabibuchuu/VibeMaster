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

## Current status

This audit is a plan and source review, not implementation evidence. The current branch still has the YouTube IFrame API in `app/room.tsx`; native audio-only playback and voice chat remain incomplete. Do not mark the PR ready or the product release-ready until the gates above pass.