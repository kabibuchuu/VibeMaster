import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { AccessToken } from 'livekit-server-sdk';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp } from 'firebase-admin/app';

initializeApp();

const liveKitApiKey = defineSecret('LIVEKIT_API_KEY');
const liveKitApiSecret = defineSecret('LIVEKIT_API_SECRET');
const liveKitUrl = defineString('LIVEKIT_URL');

export const createVoiceToken = onCall(
  { secrets: [liveKitApiKey, liveKitApiSecret], enforceAppCheck: false },
  async request => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Sign in before joining voice chat.');
    }

    const roomCode = String(request.data?.roomCode ?? '').trim().toUpperCase();
    const participantName = String(request.data?.participantName ?? 'Guest').trim().slice(0, 40) || 'Guest';
    if (!/^[A-Z0-9]{4,10}$/.test(roomCode)) {
      throw new HttpsError('invalid-argument', 'Invalid room code.');
    }

    // Require a real Firebase identity; token signing never happens on the mobile client.
    await getAuth().getUser(request.auth.uid);
    const token = new AccessToken(liveKitApiKey.value(), liveKitApiSecret.value(), {
      identity: request.auth.uid,
      name: participantName,
      ttl: '1h',
    });
    token.addGrant({
      roomJoin: true,
      room: `vibemaster-${roomCode}`,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return {
      serverUrl: liveKitUrl.value(),
      token: await token.toJwt(),
    };
  },
);
