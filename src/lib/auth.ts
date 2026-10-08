import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { auth } from '../../firebase';

export const ensureAnonymousAuth = () => signInAnonymously(auth);

export const watchAuth = (cb: (user: User | null) => void) => onAuthStateChanged(auth, cb);
