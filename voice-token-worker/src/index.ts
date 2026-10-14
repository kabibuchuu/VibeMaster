import { createRemoteJWKSet, jwtVerify } from "jose";
// @ts-expect-error This package is installed in voice-token-worker, not the app root.
import { AccessToken } from "livekit-server-sdk";

interface Env {
  FIREBASE_PROJECT_ID: string;
  LIVEKIT_URL: string;
  LIVEKIT_API_KEY: string;
  LIVEKIT_API_SECRET: string;
}

const firebaseKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, content-type",
      "access-control-allow-methods": "POST, OPTIONS",
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, content-type",
      "access-control-allow-methods": "POST, OPTIONS",
    }});
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const authorization = request.headers.get("authorization") ?? "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) return json({ error: "Sign in before joining voice." }, 401);

    let uid: string;
    try {
      const verified = await jwtVerify(match[1], firebaseKeys, {
        issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
        audience: env.FIREBASE_PROJECT_ID,
      });
      if (typeof verified.payload.sub !== "string" || !verified.payload.sub) {
        return json({ error: "Invalid Firebase identity." }, 401);
      }
      uid = verified.payload.sub;
    } catch {
      return json({ error: "Firebase sign-in token is invalid or expired." }, 401);
    }

    let body: { roomCode?: unknown; participantName?: unknown };
    try {
      body = await request.json() as { roomCode?: unknown; participantName?: unknown };
    } catch {
      return json({ error: "Invalid request body." }, 400);
    }
    const roomCode = String(body.roomCode ?? "").trim().toUpperCase();
    const participantName = String(body.participantName ?? "Guest").trim().slice(0, 40) || "Guest";
    if (!/^[A-Z0-9]{4,10}$/.test(roomCode)) return json({ error: "Invalid room code." }, 400);

    // Use the caller's Firebase ID token for Firestore REST reads so deployed
    // Firestore rules still enforce access. Never trust room membership from
    // client-supplied fields and never expose LiveKit credentials to the app.
    const base = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
    const headers = { authorization: `Bearer ${match[1]}` };
    const [roomResponse, memberResponse] = await Promise.all([
      fetch(`${base}/rooms/${roomCode}`, { headers }),
      fetch(`${base}/rooms/${roomCode}/participants/${uid}`, { headers }),
    ]);
    if (!roomResponse.ok || !memberResponse.ok) {
      return json({ error: "Could not verify room membership. Check Firestore rules and join the room first." }, 403);
    }

    try {
      const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
        identity: uid,
        name: participantName,
        ttl: "1h",
      });
      token.addGrant({
        roomJoin: true,
        room: `vibemaster-${roomCode}`,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });
      return json({ serverUrl: env.LIVEKIT_URL, token: await token.toJwt() });
    } catch {
      return json({ error: "Voice service is not configured correctly." }, 503);
    }
  },
};
