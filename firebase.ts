import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'REPLACE_WITH_FIREBASE_WEB_API_KEY',
  authDomain: 'vibemaster-75200.firebaseapp.com',
  projectId: 'vibemaster-75200',
  storageBucket: 'vibemaster-75200.firebasestorage.app',
  messagingSenderId: 'REPLACE_WITH_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'REPLACE_WITH_FIREBASE_WEB_APP_ID',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = (() => {
  try { return initializeAuth(firebaseApp, { persistence: getReactNativePersistence(ReactNativeAsyncStorage) }); }
  catch { return getAuth(firebaseApp); }
})();
export const db = getFirestore(firebaseApp);
