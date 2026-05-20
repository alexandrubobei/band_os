import { initializeApp, FirebaseApp, getApps } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';
import { environment } from '../../../environments/environment';

export interface BandosFirebase {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  storage: FirebaseStorage;
}

let cached: BandosFirebase | null = null;

export function isFirebaseConfigured(): boolean {
  const cfg = environment.firebase;
  return environment.useFirebase && !!cfg?.apiKey && !!cfg?.projectId;
}

export function getFirebase(): BandosFirebase {
  if (cached) return cached;
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase mode requested but not configured. Set environment.useFirebase=true and provide firebase config.');
  }
  const app = getApps().length > 0 ? getApps()[0] : initializeApp(environment.firebase);
  cached = { app, auth: getAuth(app), firestore: getFirestore(app), storage: getStorage(app) };
  return cached;
}
