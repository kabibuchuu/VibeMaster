import { Stack } from 'expo-router';
import { registerGlobals } from '@livekit/react-native';

let liveKitRegistered = false;
if (!liveKitRegistered) {
  registerGlobals();
  liveKitRegistered = true;
}

export default function Layout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}