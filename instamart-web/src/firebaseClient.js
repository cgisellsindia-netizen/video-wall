import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  RecaptchaVerifier,
  browserLocalPersistence,
  getAuth,
  setPersistence,
  signInWithPhoneNumber,
  signOut
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || 'AIzaSyAI9MlfTwrgDc8tafHubokqWbx-7-FdNgY',
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || 'camigo-cd56a.firebaseapp.com',
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || 'camigo-cd56a',
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || 'camigo-cd56a.firebasestorage.app',
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '180222851497',
  appId: process.env.REACT_APP_FIREBASE_APP_ID || undefined
};

export const firebasePhoneAuthReady = Boolean(
  firebaseConfig.apiKey
  && firebaseConfig.authDomain
  && firebaseConfig.projectId
  && firebaseConfig.messagingSenderId
);

const firebaseApp = firebasePhoneAuthReady
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null;

export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;

if (firebaseAuth && typeof window !== 'undefined') {
  firebaseAuth.languageCode = 'en';
  setPersistence(firebaseAuth, browserLocalPersistence).catch(() => {});
}

export {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut
};
