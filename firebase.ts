import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, signInAnonymously } from 'firebase/auth';
// Firebase's React Native runtime exposes this API, but Firebase 12.19.0's public typings omit it.
// @ts-expect-error Firebase React Native persistence export is missing from the published type declarations.
import { getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyB93Z0LY3GVPDk-4MP7Aj_4B0C1x-bA6UE',
  authDomain: 'vibemaster-75200.firebaseapp.com',
  projectId: 'vibemaster-75200',
  storageBucket: 'vibemaster-75200.firebasestorage.app',
  messagingSenderId: '78732681524',
  appId: '1:78732681524:web:69ec373906df2912bd8561',
  measurementId: 'G-R6WR0B7BKG',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = (() => {
  try {
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(firebaseApp);
  }
})();

export const db = getFirestore(firebaseApp);
export { signInAnonymously };
