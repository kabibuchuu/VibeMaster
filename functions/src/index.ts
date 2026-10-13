import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { AccessToken } from 'livekit-server-sdk';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

    // Only members of an existing listening room may mint a voice token.
    await getAuth().getUser(request.auth.uid);
    const room = await getFirestore().collection('rooms').doc(roomCode).get();
    const participant = await getFirestore()
      .collection('rooms').doc(roomCode)
      .collection('participants').doc(request.auth.uid).get();
    if (!room.exists || !participant.exists) {
      throw new HttpsError('permission-denied', 'Join the VibeMaster listening room before joining voice.');
    }
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
