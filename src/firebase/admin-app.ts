'use server'

import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from './config';

let app: App;

export async function initializeAdminApp() {
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
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL as string,
            privateKey: (process.env.FIREBASE_PRIVATE_KEY as string).replace(/\\n/g, '\n'),
        }
    });

    return {
        app: app,
        auth: getAuth(app),
        firestore: getFirestore(app)
    };
}
