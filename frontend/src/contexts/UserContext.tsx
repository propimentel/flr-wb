import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { initFirebase, signInAnonymouslyAndStoreUid, getFirebaseAuth } from '../shared/firebase';
import { onAuthStateChanged } from 'firebase/auth';

interface UserContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Debug: Log all NEXT_PUBLIC environment variables first
    console.log('All NEXT_PUBLIC environment variables:');
    Object.keys(process.env)
      .filter(key => key.startsWith('NEXT_PUBLIC_'))
      .forEach(key => {
        console.log(`${key}:`, process.env[key] ? `${process.env[key]?.substring(0, 10)}...` : 'MISSING');
      });

    // Initialize Firebase with config from environment variables
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
    };

    // Debug: Log the config to see if environment variables are loaded
    console.log('Firebase Config Created:', {
      apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 10)}...` : 'MISSING',
      authDomain: firebaseConfig.authDomain || 'MISSING',
      projectId: firebaseConfig.projectId || 'MISSING',
      storageBucket: firebaseConfig.storageBucket || 'MISSING',
      messagingSenderId: firebaseConfig.messagingSenderId || 'MISSING',
      appId: firebaseConfig.appId ? `${firebaseConfig.appId.substring(0, 10)}...` : 'MISSING',
    });

    // Check if any required fields are missing
    const requiredFields = ['apiKey', 'authDomain', 'projectId', 'appId'];
    const missingFields = requiredFields.filter(field => !firebaseConfig[field as keyof typeof firebaseConfig]);
    
    if (missingFields.length > 0) {
      console.error('Missing required Firebase configuration fields:', missingFields);
      setError(`Missing Firebase configuration: ${missingFields.join(', ')}`);
      setLoading(false);
      return;
    }

    try {
      initFirebase(firebaseConfig);
      const auth = getFirebaseAuth();

      // Listen for authentication state changes
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          setUser(firebaseUser);
          setLoading(false);
        } else {
          // If no user, sign in anonymously
          try {
            const anonymousUser = await signInAnonymouslyAndStoreUid();
            setUser(anonymousUser);
          } catch (authError) {
            console.error('Error signing in anonymously:', authError);
            setError('Failed to authenticate');
          } finally {
            setLoading(false);
          }
        }
      });

      return () => unsubscribe();
    } catch (initError) {
      console.error('Error initializing Firebase:', initError);
      setError('Failed to initialize Firebase');
      setLoading(false);
    }
  }, []);

  const value = {
    user,
    loading,
    error,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
