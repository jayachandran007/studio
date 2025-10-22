
'use server';

import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getMessaging } from 'firebase-admin/messaging';
import { firebaseConfig } from '@/firebase/config';

let adminApp: App | undefined;

/**
 * Initializes the Firebase Admin SDK, reusing the existing instance if available.
 * This function is robust for both local development (using service account keys
 * from environment variables) and the deployed App Hosting environment (which uses
 * Application Default Credentials).
 * @returns An object containing the initialized App and Firestore instances, or null if initialization fails.
 */
export async function initializeAdminApp() {
  if (getApps().length > 0) {
    const existingApp = getApps().find(app => app.name === 'admin');
    if(existingApp) {
      adminApp = existingApp;
    }
  }

  if (adminApp) {
    return {
      firestore: getFirestore(adminApp),
      auth: getAuth(adminApp),
      storage: getStorage(adminApp),
      app: adminApp
    };
  }

  try {
    // This will succeed in the App Hosting environment
    adminApp = initializeApp({ projectId: firebaseConfig.projectId }, 'admin');
  } catch (e: any) {
    if (e.code === 'app/duplicate-app') {
       adminApp = getApps().find(app => app.name === 'admin');
       if(!adminApp) {
          // This case should ideally not be reached if getApps() check is proper
          console.error("Could not find the 'admin' app despite duplicate error.");
          return null;
       }
    } else {
      // This will happen in local development if GOOGLE_APPLICATION_CREDENTIALS is not set
      console.warn(
        "Default admin initialization failed, likely in local development. ",
        e.message
      );
      return null;
    }
  }

  return {
    firestore: getFirestore(adminApp),
    auth: getAuth(adminApp),
    storage: getStorage(adminApp),
    app: adminApp,
  };
}
