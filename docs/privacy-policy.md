# VibeMaster Privacy Policy

Effective date: October 12, 2026

VibeMaster is an independent shared-listening companion. It is not affiliated with, endorsed by, or sponsored by YouTube, Google, or LiveKit.

## Information the app processes

- **Room identity:** Firebase anonymous-authentication UID, room code, display name, participant role, and join time.
- **Room activity:** shared queue, current item, playback state/position, controller permissions, and room messages sent by users.
- **Voice chat:** when a user joins voice, the app requests a short-lived LiveKit access token from a Firebase callable function. LiveKit processes live voice media and connection metadata to provide the call. VibeMaster does not intentionally record voice.
- **YouTube data:** when a user searches, the app sends the search query and its API key to the YouTube Data API. Embedded playback or opening YouTube Music sends information to YouTube/Google under their own terms and privacy practices.
- **Technical data:** Firebase, Google, and LiveKit may process network, device, diagnostic, and service-security data as described in their own policies.

## How information is used

Information is used to authenticate guests, create/join rooms, synchronize the room queue, display participant/chat state, enable voice calls, and deliver YouTube search/playback functionality. Do not send sensitive personal information in room names or messages.

## Sharing

Room participants can see the room code, display names, queue, participant list, and messages shared in their room. Firebase and LiveKit process information to provide their services. YouTube/Google process API requests and playback according to their policies. VibeMaster does not sell personal information.

## Retention and deletion

Room data is stored in Cloud Firestore. Hosts can end rooms using the app's room controls; this removes room documents through the app's room-deletion flow. Firebase service logs and provider-side records may have separate retention periods controlled by those providers. If deletion does not work, contact the maintainer through the repository's GitHub Issues page.

## Security

Voice-token signing secrets are intended to remain in Firebase Functions secrets and are not embedded in the mobile app. Use a unique room code and do not share it publicly if you want a private room. No internet-connected service can guarantee absolute security.

## Children's privacy

VibeMaster is not designed as a child-directed app. A parent or guardian who believes a child provided personal information should contact the maintainer through GitHub Issues.

## Third-party policies

- Google Privacy Policy: https://policies.google.com/privacy
- YouTube Terms: https://www.youtube.com/t/terms
- YouTube API Services Terms: https://developers.google.com/youtube/terms/api-services-terms-of-service
- LiveKit Privacy Policy: https://livekit.io/legal/privacy-policy
- Firebase privacy and security: https://firebase.google.com/support/privacy

## Changes and contact

This policy may change as VibeMaster develops. For questions or deletion requests, open an issue at https://github.com/kabibuchuu/VibeMaster/issues. Do not include passwords, tokens, or other secrets in an issue.
