import { FirebaseOptions } from 'firebase/app';

export interface FirebaseConfig extends FirebaseOptions {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

// Read Firebase configuration from environment variables
export const getFirebaseConfig = (): FirebaseConfig => {
  const requiredEnvVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN', 
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID'
  ];

  // Check if all required environment variables are present
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required Firebase environment variables: ${missingVars.join(', ')}`);
  }

  return {
    apiKey: process.env.VITE_FIREBASE_API_KEY!,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID!,
    appId: process.env.VITE_FIREBASE_APP_ID!
  };
};

// Export a default config instance
export const firebaseConfig = getFirebaseConfig();
