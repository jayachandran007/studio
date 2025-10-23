
'use server';

import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getMessaging } from 'firebase-admin/messaging';
import { firebaseConfig } from '@/firebase/config';

let adminApp: App | undefined;

/**
 * Initializes and/or returns the Firebase Admin SDK instance.
 * This is a simplified getter that ensures the app is initialized only once.
 * @returns The initialized Firebase Admin App instance, or null on failure.
 */
function getAdminApp(): App | null {
  if (adminApp) {
    return adminApp;
  }

  if (getApps().length > 0) {
    const existingApp = getApps().find(app => app.name === 'admin');
    if(existingApp) {
      adminApp = existingApp;
      return adminApp;
    }
  }

  try {
    adminApp = initializeApp({ projectId: firebaseConfig.projectId }, 'admin');
    return adminApp;
  } catch (e: any) {
    console.warn(
      "Admin initialization failed. This may be expected in local development.",
      e.message
    );
    return null;
  }
}

/**
 * Provides access to the initialized Firebase Admin services.
 * This function should be called by server-side code needing admin access.
 * @returns An object with Firestore, Auth, Storage, and the App instance, or null if initialization fails.
 */
export async function initializeAdminApp() {
  const app = getAdminApp();
  if (!app) {
    return null;
  }

  return {
    firestore: getFirestore(app),
    auth: getAuth(app),
    storage: getStorage(app),
    app: app,
  };
}
