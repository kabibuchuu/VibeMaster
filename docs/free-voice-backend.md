# Free voice backend (Firebase Spark compatible)

VibeMaster's voice-token issuer cannot run as a Firebase Cloud Function on the Spark plan. This small Cloudflare Worker keeps the LiveKit API secret off the phone and uses the signed-in user's Firebase ID token when checking room membership.

## One-time deployment

1. Create a free Cloudflare account and install Node.js/npm on a computer.
2. In a terminal, clone this repository and run:
   ```sh
   cd voice-token-worker
   npm install
   npx wrangler login
   npx wrangler secret put LIVEKIT_URL
   npx wrangler secret put LIVEKIT_API_KEY
   npx wrangler secret put LIVEKIT_API_SECRET
   npm run deploy
   ```
   Enter the values from your LiveKit project only into the Wrangler prompts. Do not commit them or send them in chat.
3. Copy the deployed Worker URL, normally `https://vibemaster-voice-token.<your-account>.workers.dev`.
4. In GitHub, open **Settings → Secrets and variables → Actions → Variables**, create a repository variable named `EXPO_PUBLIC_VOICE_TOKEN_URL`, and set it to that Worker URL (no trailing slash).
5. Re-run the Android native build workflow to bake the URL into the APK.

## Security notes

- Firebase stays on Spark; the Worker is a separate free-tier service.
- LiveKit credentials are Worker secrets, not app config.
- The Worker verifies Firebase ID tokens and uses that same token for Firestore REST membership reads, so Firestore rules still apply.
- Free tiers and usage limits can change. Do not enable paid billing if the account prompts for it; stop and review the plan first.
