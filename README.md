# VibeMaster

VibeMaster is a synchronized YouTube listening/watch-party app.

## Stack

- React Native + Expo + TypeScript
- Firebase Authentication + Cloud Firestore
- YouTube embedded in a WebView
- Expo Router

## MVP

1. Create a room and share its code.
2. Join with a room code and display name.
3. Host loads a YouTube video.
4. Room state is stored in Firestore so everyone can converge on the same playback state.

The app embeds YouTube rather than extracting or downloading media.

## Local setup

Install Node.js LTS, then:

```bash
npm install
npx expo start
```

For Android:

```bash
npx expo run:android
```

Create a Firebase Web App in project `vibemaster-75200`, enable Anonymous Authentication and Firestore, and put its config values in `firebase.ts`.

## Development notes

Expo's Firebase guidance supports the Firebase JS SDK for Expo Go, including Authentication and Firestore. Expo Router provides file-based routing, and react-native-webview is available for embedded web content.

The next implementation milestone is real playback control/synchronization: host play/pause/seek writes plus client-side drift correction.
