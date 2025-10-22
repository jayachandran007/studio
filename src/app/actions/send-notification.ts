
'use server';

import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
import { initializeAdminApp } from '@/firebase/admin-app';

interface sendNotificationProps {
    message: string;
    sender: string;
    messageId: string;
}

interface NotificationResult {
    success: boolean;
    error?: string;
}

const ALL_USERS = [
    { username: 'Crazy', uid: 'QYTCCLfLg1gxdLLQy34y0T2Pz3g2' },
    { username: 'Cool', uid: 'N2911Sj2g8cT03s5v31s1p9V8s22' }
];

export async function sendNotification({ message, sender, messageId }: sendNotificationProps): Promise<NotificationResult> {
    const adminApp = await initializeAdminApp();
    if (!adminApp) {
        const errorMsg = "Firebase Admin SDK not initialized. Skipping notification.";
        console.warn(errorMsg);      
        return { success: false, error: errorMsg };
    }

    const { firestore, app } = adminApp;
    const messaging = getMessaging(app);
    
    const recipient = ALL_USERS.find(user => user.username !== sender);

    if (!recipient) {
        const errorMsg = 'No recipient found to send notification.';
        console.log(errorMsg);
        return { success: false, error: errorMsg };
    }
    
    const tokensCollection = firestore.collection('fcmTokens');
    // Simplified query to avoid needing a composite index.
    const querySnapshot = await tokensCollection
      .where('username', '==', recipient.username)
      .get();


    if (querySnapshot.empty) {
        const errorMsg = `No FCM token document found for username: ${recipient.username}`;
        console.log(errorMsg);        
        return { success: false, error: errorMsg };
    }

    // Sort documents by createdAt timestamp in descending order to find the latest token.
    const tokens = querySnapshot.docs.map(doc => doc.data());
    tokens.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    const latestToken = tokens[0];

    const fcmToken = latestToken?.token;

    if (!fcmToken) {
        const errorMsg = `FCM token is empty for user: ${recipient.username}`;
        console.log(errorMsg);        
        return { success: false, error: errorMsg };
    }
    
    const payload: MulticastMessage = {
        tokens: [fcmToken],
        notification: {
            title: 'New Message',
            body: message,
        },
        webpush: {
            fcmOptions: {
                link: `/chat#${messageId}`,
            },
        },
        apns: {
            headers: {
                'apns-priority': '10', 
            },
            payload: {
                aps: {
                    alert: {
                        title: 'New Message',
                        body: message,
                    },
                    sound: 'default',
                    badge: 1,
                },
            },
        },
    };

    try {
        await messaging.sendEachForMulticast(payload);
        console.log(`Successfully sent notification to ${recipient.username}`);
        return { success: true };
    } catch (error: any) {
        const errorMsg = `Error sending notification to ${recipient.username}: ${error.message}`;
        console.error(errorMsg);        
        return { success: false, error: errorMsg };
    }
}
