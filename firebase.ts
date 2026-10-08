import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth, signInAnonymously } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyB93Z0LY3GVP...actual-config-is-client-side-and-should-be-restricted',
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
