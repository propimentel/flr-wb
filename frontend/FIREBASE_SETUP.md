# Firebase Integration Setup

This document explains the Firebase SDK and Anonymous Authentication integration that has been implemented.

## What's Been Implemented

### 1. Firebase SDK Installation
- ✅ Firebase v12.0.0 is already installed via `yarn add firebase`

### 2. Firebase Configuration Module (`src/shared/firebase.ts`)
- ✅ Exports `initFirebase(appConfig)` function that initializes Firebase with environment configuration
- ✅ Exports `signInAnonymouslyAndStoreUid()` function that signs in anonymously and stores UID in localStorage
- ✅ Exports `getFirebaseAuth()` to get the Firebase Auth instance
- ✅ Exports utility functions: `getStoredUid()` and `clearStoredUid()` for localStorage management

### 3. User Context Integration (`src/contexts/UserContext.tsx`)
- ✅ Initializes Firebase in `UserProvider` using environment variables
- ✅ Automatically calls `signInAnonymously()` when no authenticated user is found
- ✅ Sets up authentication state listener using `onAuthStateChanged`
- ✅ Provides user context to the entire application

### 4. App Integration (`src/pages/_app.tsx`)
- ✅ Already wrapped with `UserProvider` context
- ✅ Firebase authentication is automatically triggered on app startup

### 5. localStorage UID Storage
- ✅ User UID is automatically stored in localStorage with key 'firebase-uid'
- ✅ Available for backend upload identification via `getStoredUid()` function

## Environment Variables Required

Create a `.env` file in the frontend directory with:

```bash
# Firebase Configuration for Next.js Frontend
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

## How It Works

1. When the app loads, `UserProvider` initializes Firebase with environment configuration
2. The auth state listener checks if a user is already authenticated
3. If no user exists, it automatically calls `signInAnonymously()`
4. The anonymous user's UID is stored in localStorage for backend identification
5. The user context provides the authenticated user object throughout the app

## Usage in Components

```tsx
import { useUser } from '../contexts/UserContext'
import { getStoredUid } from '../shared/firebase'

function MyComponent() {
  const { user, loading, error } = useUser()
  const storedUid = getStoredUid() // Get UID from localStorage
  
  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  
  return (
    <div>
      <p>User ID: {user?.uid}</p>
      <p>Anonymous: {user?.isAnonymous ? 'Yes' : 'No'}</p>
      <p>Stored UID: {storedUid}</p>
    </div>
  )
}
```

## Testing

The home page (`src/pages/index.tsx`) displays:
- User authentication status
- User UID
- Whether the user is anonymous
- Stored UID from localStorage

## Files Modified/Created

- ✅ Created: `src/shared/firebase.ts` - Firebase configuration and utilities
- ✅ Updated: `src/contexts/UserContext.tsx` - Import path correction
- ✅ Updated: `src/pages/index.tsx` - Added localStorage UID display
- ✅ Created: `.env` - Environment variables template
- ✅ Created: `FIREBASE_SETUP.md` - This documentation

## Next Steps

1. Replace placeholder values in `.env` with actual Firebase project configuration
2. Set up Firebase project in the Firebase Console
3. Enable Anonymous Authentication in Firebase Console
4. Test the authentication flow with actual Firebase credentials
