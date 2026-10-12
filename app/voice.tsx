import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { AudioSession, LiveKitRoom, useLocalParticipant } from '@livekit/react-native';
import { httpsCallable } from 'firebase/functions';
import { auth, firebaseApp } from '../firebase';
import { getFunctions } from 'firebase/functions';

type VoiceTokenResponse = { serverUrl: string; token: string };

const functions = getFunctions(firebaseApp);

function Controls({ onLeave }: { onLeave: () => void }) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const [busy, setBusy] = useState(false);

  async function toggleMicrophone() {
    setBusy(true);
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch {
      Alert.alert('Microphone unavailable', 'Check the Android microphone permission and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.controls}>
      <TouchableOpacity
        accessibilityRole="button"
        style={[styles.button, isMicrophoneEnabled ? styles.micOn : styles.micOff]}
        disabled={busy}
        onPress={() => void toggleMicrophone()}
      >
        <Text style={styles.buttonText}>{busy ? 'Please wait…' : isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'}</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" style={[styles.button, styles.leave]} onPress={onLeave}>
        <Text style={styles.buttonText}>Leave voice</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function VoiceScreen() {
  const { code, name } = useLocalSearchParams<{ code: string; name?: string }>();
  const roomCode = String(code ?? '').trim().toUpperCase();
  const [tokenData, setTokenData] = useState<VoiceTokenResponse | null>(null);
  const [error, setError] = useState('');
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function connect() {
      if (!auth.currentUser) {
        setError('Sign in to VibeMaster before joining voice.');
        return;
      }
      if (!roomCode) {
        setError('A room code is required.');
        return;
      }
      try {
        await AudioSession.startAudioSession();
        const issueToken = httpsCallable<{ roomCode: string; participantName: string }, VoiceTokenResponse>(functions, 'createVoiceToken');
        const result = await issueToken({
          roomCode,
          participantName: String(name ?? 'Guest').slice(0, 40),
        });
        if (!cancelled) setTokenData(result.data);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Could not join voice. Check that the voice-token function is deployed and LiveKit is configured.');
        }
      }
    }
    void connect();
    return () => {
      cancelled = true;
      void AudioSession.stopAudioSession().catch(() => {});
    };
  }, [roomCode, name]);

  function leave() {
    setLeaving(true);
    router.back();
  }

  return (
    <View style={styles.screen}>
      <TouchableOpacity style={styles.back} onPress={leave}><Text style={styles.backText}>‹  Back to room</Text></TouchableOpacity>
      <Text style={styles.eyebrow}>VIBEMASTER · LIVE AUDIO</Text>
      <Text style={styles.title}>Voice room {roomCode}</Text>
      <Text style={styles.description}>Talk with everyone listening together. Your microphone starts enabled when you join; mute it any time.</Text>
      {!tokenData && !error ? <View style={styles.loading}><ActivityIndicator color="#c4b5fd" /><Text style={styles.muted}>Connecting securely…</Text></View> : null}
      {error ? <View style={styles.errorPanel}><Text style={styles.errorTitle}>Could not connect</Text><Text style={styles.errorText}>{error}</Text><Text style={styles.hint}>Deploy the Firebase voice-token function and set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET in Firebase Functions secrets/configuration.</Text><TouchableOpacity style={styles.button} onPress={() => router.back()}><Text style={styles.buttonText}>Return to room</Text></TouchableOpacity></View> : null}
      {tokenData ? (
        <LiveKitRoom
          serverUrl={tokenData.serverUrl}
          token={tokenData.token}
          connect={!leaving}
          audio
          video={false}
          onDisconnected={leave}
          onError={cause => setError(cause.message || 'LiveKit connection failed.')}
        >
          <View style={styles.connected}>
            <View style={styles.pulse}><Text style={styles.pulseText}>●</Text></View>
            <Text style={styles.connectedTitle}>You’re in the voice room</Text>
            <Text style={styles.muted}>Voice is live. Keep VibeMaster open to manage your microphone.</Text>
            <Controls onLeave={leave} />
          </View>
        </LiveKitRoom>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#09080f', paddingHorizontal: 22, paddingTop: 58 },
  back: { alignSelf: 'flex-start', paddingVertical: 12, marginBottom: 34 },
  backText: { color: '#d8d0eb', fontSize: 15, fontWeight: '600' },
  eyebrow: { color: '#a78bfa', fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  title: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 8 },
  description: { color: '#a9a3b7', lineHeight: 22, marginTop: 12, marginBottom: 28 },
  loading: { gap: 12, alignItems: 'center', padding: 24 },
  muted: { color: '#a9a3b7', textAlign: 'center', lineHeight: 20 },
  errorPanel: { backgroundColor: '#201522', borderColor: '#563047', borderWidth: 1, borderRadius: 18, padding: 18, gap: 12 },
  errorTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  errorText: { color: '#ffd5df', lineHeight: 21 },
  hint: { color: '#b8aebe', fontSize: 12, lineHeight: 18 },
  button: { paddingVertical: 14, paddingHorizontal: 18, borderRadius: 14, alignItems: 'center', backgroundColor: '#6d4aff' },
  buttonText: { color: '#fff', fontWeight: '800' },
  connected: { alignItems: 'center', backgroundColor: '#15121f', borderRadius: 22, padding: 24, gap: 16, marginTop: 18 },
  pulse: { width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center', backgroundColor: '#292044' },
  pulseText: { color: '#b9a5ff', fontSize: 28 },
  connectedTitle: { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  controls: { width: '100%', gap: 10, marginTop: 8 },
  micOn: { backgroundColor: '#6d4aff' },
  micOff: { backgroundColor: '#4b3b4d' },
  leave: { backgroundColor: '#8c3046' },
});
