import { initializeApp, FirebaseApp, FirebaseOptions } from 'firebase/app';
import { getAuth, Auth, signInAnonymously, User } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;

/**
 * Initialize Firebase with the provided configuration
 * @param appConfig Firebase configuration object from environment variables
 */
export const initFirebase = (appConfig: FirebaseOptions): FirebaseApp => {
  if (!app) {
    app = initializeApp(appConfig);
    auth = getAuth(app);
    firestore = getFirestore(app);
  }
  return app;
};

/**
 * Get the Firebase Auth instance
 * @returns Firebase Auth instance
 */
export const getFirebaseAuth = (): Auth => {
  if (!auth) {
    throw new Error('Firebase must be initialized before getting Auth instance');
  }
  return auth;
};

/**
 * Get the Firestore instance
 * @returns Firestore instance
 */
export const getFirebaseFirestore = (): Firestore => {
  if (!firestore) {
    throw new Error('Firebase must be initialized before getting Firestore instance');
  }
  return firestore;
};

/**
 * Sign in anonymously and store the user ID in localStorage for backend identification
 * @returns Promise<User> The authenticated anonymous user
 */
export const signInAnonymouslyAndStoreUid = async (): Promise<User> => {
  if (!auth) {
    throw new Error('Firebase Auth must be initialized before signing in');
  }

  try {
    const userCredential = await signInAnonymously(auth);
    const user = userCredential.user;
    
    // Store the UID in localStorage for backend upload identification
    if (typeof window !== 'undefined' && user.uid) {
      localStorage.setItem('firebase-uid', user.uid);
    }
    
    return user;
  } catch (error) {
    throw error;
  }
};

/**
 * Get the stored user ID from localStorage
 * @returns string | null The stored user ID or null if not found
 */
export const getStoredUid = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('firebase-uid');
  }
  return null;
};

/**
 * Clear the stored user ID from localStorage
 */
export const clearStoredUid = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('firebase-uid');
  }
};
