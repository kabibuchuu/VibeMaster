# VibeMaster setup

## 1. Install dependencies

Use a current Node.js LTS release:

```bash
npm install
```

## 2. Firebase

The app uses Firebase project `vibemaster-75200`.

Enable:

- Anonymous Authentication
- Cloud Firestore

The Firebase Web App configuration is already stored in `firebase.ts`.

Before testing rooms, publish the contents of `firestore.rules` in the Firebase Console under **Firestore Database → Rules**.

## 3. YouTube Data API

Create or use a Google Cloud project and enable **YouTube Data API v3**.

Create an API key and put it in a local `.env.local` file:

```text
EXPO_PUBLIC_YOUTUBE_API_KEY=your_key_here
```

The repository contains `.env.example` as a template. Never commit the real key.

After changing `.env.local`, restart Expo so the environment variable is loaded:

```bash
npx expo start --tunnel
```

The app searches YouTube and only embeds the selected YouTube content; it does not download or extract media.

## 4. Test the MVP

Recommended test sequence:

1. Open the app.
2. Search for a known music video.
3. Select the result and create a room.
4. Confirm the room appears with the selected item.
5. On a second phone, enter the room code.
6. Enter a display name and join.
7. On the host, press play/pause and the ±10 second controls.
8. Confirm the guest follows the host and corrects small playback drift.
9. Add another item from **＋ Add** and select it from the queue.

## 5. Troubleshooting

### Search says the API key is missing

Check that `.env.local` is in the repository root and contains:

```text
EXPO_PUBLIC_YOUTUBE_API_KEY=...
```

Then restart Expo.

### YouTube says the video cannot play

Some YouTube videos cannot be embedded. Search results are filtered for embeddable/syndicated videos, but YouTube can still reject individual embeds. Try another result.

### Guest does not start automatically

Mobile WebViews can block scripted autoplay. Use the **Tap to sync playback** button shown to the guest.

### Firestore permission denied

Make sure Anonymous Authentication is enabled and that the latest `firestore.rules` has been published in Firebase.

## 6. Android Studio

Android Studio is not required for the current Expo Go development workflow. Keep the project in Expo-managed development until a native release build is actually needed.
