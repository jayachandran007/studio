'use server';

import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { initializeAdminApp } from '@/firebase/admin-app';

interface sendNotificationProps {
    message: string;
    sender: string;
    messageId: string;
}

export async function sendNotification({ message, sender, messageId }: sendNotificationProps) {
    await initializeAdminApp();
    const firestore = getFirestore();
    const messaging = getMessaging();

    const users = ['Cool', 'Crazy'];
    const recipient = users.find(user => user !== sender);

    if (!recipient) {
        console.log('No recipient found to send notification.');
        return;
    }
    
    const tokenDoc = await firestore.collection('fcmTokens').doc(recipient).get();

    if (!tokenDoc.exists) {
        console.log(`No FCM token found for user: ${recipient}`);
        return;
    }

    const fcmToken = tokenDoc.data()?.token;

    if (!fcmToken) {
        console.log(`FCM token is empty for user: ${recipient}`);
        return;
    }

    const payload = {
        notification: {
            title: `New message from ${sender}`,
            body: message,
        },
        webpush: {
            fcm_options: {
                link: `/chat#${messageId}`,
            },
        },
        token: fcmToken,
    };

    try {
        await messaging.send(payload);
        console.log(`Successfully sent notification to ${recipient}`);
    } catch (error) {
        console.error(`Error sending notification to ${recipient}:`, error);
    }
}
