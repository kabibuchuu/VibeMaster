# VibeMaster setup

## 1. Install Node.js

Use a current Node.js LTS release.

## 2. Install dependencies

```bash
npm install
```

## 3. Firebase

The app uses Firebase project `vibemaster-75200`. Register a Firebase Web App and replace the placeholder values in `firebase.ts`.

Enable Anonymous Authentication and Cloud Firestore.

## 4. Run

```bash
npx expo start
```

Then press `a` for an Android emulator/device or scan the QR code with Expo Go.

For a native Android build:

```bash
npx expo run:android
```

## 5. Current MVP

Create/join room, Firestore room state, participant presence, and embedded YouTube playback are implemented. Playback controls and continuous synchronization are the next implementation step.
