import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { registerGlobals } from '@livekit/react-native';
import { setAudioModeAsync } from 'expo-audio';

let liveKitRegistered = false;
if (!liveKitRegistered) {
  registerGlobals();
  liveKitRegistered = true;
}

export default function Layout() {
  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch(error => console.warn('Audio session setup failed', error));
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}