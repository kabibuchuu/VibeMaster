# YouTube Music integration decision

Reviewed: 2026-10-12

## Decision

VibeMaster must not treat a YouTube video ID as an audio stream or extract, decrypt, proxy, cache, or separate YouTube audio. The official integration available in this codebase is limited to documented YouTube Data API discovery, the official YouTube IFrame Player API while visible in the app, and user-initiated links that hand a track or playlist to YouTube Music itself.

This means there is a real product constraint: official YouTube APIs do not provide a general-purpose audio-only stream endpoint for third-party apps. VibeMaster cannot promise its own background/lock-screen music playback from YouTube Music through those official APIs. If that experience is mandatory, the developer needs an explicit written authorization/licensing path from YouTube or a different licensed audio provider. An open-source license for Metrolist does not supply that authorization.

## Policy basis

- YouTube API Services Developer Policies require documented API access and say undocumented APIs must not be used without express permission.
- They prohibit scraping YouTube applications, separating audio from video, and features that play YouTube content from a background player.
- YouTube audiovisual content and YouTube-provided attribution/player controls must not be obscured or disabled.
- The app must display appropriate YouTube attribution and link to YouTube's Terms of Service. The app also needs its own accessible privacy policy and terms of use before production distribution.

Authoritative sources:
- https://developers.google.com/youtube/terms/developer-policies
- https://developers.google.com/youtube/terms/api-services-terms-of-service
- https://developers.google.com/youtube/terms/branding-guidelines
- https://www.youtube.com/t/terms
- https://policies.google.com/privacy

## Implemented handoff

- Search results include a separate, explicit **Open in YouTube Music** action.
- Room player includes an **YTM** action for the current track.
- These links are user-initiated and use the official public YouTube Music URL patterns:
  - Track: `https://music.youtube.com/watch?v=VIDEO_ID`
  - Playlist: `https://music.youtube.com/playlist?list=PLAYLIST_ID`
- The app does not extract stream URLs or claim the handoff is synchronized with the external YouTube Music app. Room queue/chat state can be synchronized, but external app playback cannot be authoritatively controlled by VibeMaster.

## Release blockers

1. Confirm YouTube API client compliance for the app's full UI, branding, player controls, privacy disclosures, and terms before distributing.
2. Publish and link a privacy policy and terms of use; capture user agreement before YouTube API features are used.
3. Test deep-link behavior on Android with YouTube Music installed and with only a browser available.
4. Decide whether foreground-only embedded playback is acceptable for v1. If not, obtain written authorization for the intended YouTube Music integration or choose a provider whose license/API explicitly supports native background audio and multi-user synchronization.
5. Do not describe native background playback, lock-screen controls, or synchronized external YouTube Music playback as implemented until verified and permitted.
