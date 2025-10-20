
'use server'

import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from './config';

let app: App;

export async function initializeAdminApp() {
    // Prevent crash if server-side environment variables are not set.
    if (!process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
        console.warn(
            'Firebase Admin environment variables (FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) are not set. Skipping Admin SDK initialization. Notifications will not be sent.'
        );
        return null;
    }

    if (getApps().length > 0) {
        app = getApps()[0];
        return {
            app: app,
            auth: getAuth(app),
            firestore: getFirestore(app)
        }
    }

    app = initializeApp({
        credential: {
            projectId: firebaseConfig.projectId,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }
    });

    return {
        app: app,
        auth: getAuth(app),
        firestore: getFirestore(app)
    };
}
