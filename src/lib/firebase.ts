
import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getDatabase, type Database } from 'firebase/database';

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

// Critical checks for Firebase initialization
if (!projectId) {
  throw new Error(
    'FirebaseError: CRITICAL - NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set in environment variables. ' +
    'Firebase cannot be initialized. Please check your .env.local file or environment configuration.'
  );
}

if (!apiKey) {
  throw new Error(
    'FirebaseError: CRITICAL - NEXT_PUBLIC_FIREBASE_API_KEY is not set in environment variables. ' +
    'Firebase cannot be initialized. Please check your .env.local file or environment configuration.'
  );
}

const firebaseConfig = {
  apiKey: apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: `https://${projectId}-default-rtdb.firebaseio.com`, // Default RTDB URL convention
};

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

export const firebaseAppInstance: FirebaseApp = app;
export const db: Firestore = getFirestore(firebaseAppInstance);
// Realtime Database is no longer used, so we can remove its initialization.
// export const rtDb: Database = getDatabase(firebaseAppInstance);
