
'use server';

import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { firebaseConfig } from '@/firebase/config';

// This function should be defined within the file or imported from a non-'use server' module.
// For simplicity, we define it here to avoid cross-module issues with 'use server'.
function getAdminApp(): App | null {
    if (getApps().some(app => app.name === 'admin')) {
        return getApps().find(app => app.name === 'admin')!;
    }
    try {
        return initializeApp({ projectId: firebaseConfig.projectId }, 'admin');
    } catch (e: any) {
        console.warn(
            "Admin initialization failed. This may be expected in local development.",
            e.message
        );
        return null;
    }
}


interface sendNotificationProps {
    message: string;
    sender: string;
    messageId: string;
}

interface NotificationResult {
    success: boolean;
    error?: string;
    skipped?: boolean;
}

const ALL_USERS = [
    { username: 'Crazy', uid: 'QYTCCLfLg1gxdLLQy34y0T2Pz3g2' },
    { username: 'Cool', uid: 'N2911Sj2g8cT03s5v31s1p9V8s22' }
];

const FUN_FACTS = [
    "A group of flamingos is called a 'flamboyance'.",
    "The unicorn is the national animal of Scotland.",
    "A single strand of spaghetti is called a 'spaghetto'.",
    "The plural of 'octopus' is 'octopuses', not 'octopi'.",
    "Honey never spoils.",
    "Bananas are berries, but strawberries aren't."
];

const NOTIFICATION_COOLDOWN_MINUTES = 3;

function getRandomFunFact(): string {
    return FUN_FACTS[Math.floor(Math.random() * FUN_FACTS.length)];
}


export async function sendNotification({ message, sender, messageId }: sendNotificationProps): Promise<NotificationResult> {
    const adminApp = getAdminApp();
    if (!adminApp) {
        const errorMsg = "Firebase Admin SDK not initialized. Skipping notification.";
        console.warn(errorMsg);
        return { success: false, error: errorMsg };
    }

    const firestore = getFirestore(adminApp);
    const messaging = getMessaging(adminApp);
    
    const recipient = ALL_USERS.find(user => user.username !== sender);

    if (!recipient) {
        const errorMsg = 'No recipient found to send notification.';
        console.log(errorMsg);
        return { success: false, error: errorMsg };
    }

    // Check recipient's activity status and notification cooldown
    try {
        const userDocRef = firestore.collection('users').doc(recipient.uid);
        const userDoc = await userDocRef.get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            const now = Timestamp.now();

            // 1. Check if user is active
            const lastActive = userData?.lastActive as Timestamp | undefined;
            if (lastActive) {
                const diffSeconds = now.seconds - lastActive.seconds;
                // If user was active in the last 10 seconds, don't send a notification
                if (diffSeconds < 10) {
                    console.log(`Recipient ${recipient.username} is active. Skipping notification.`);
                    return { success: true, skipped: true };
                }
            }

            // 2. Check notification cooldown
            const lastNotificationSentAt = userData?.lastNotificationSentAt as Timestamp | undefined;
            if (lastNotificationSentAt) {
                const diffMinutes = (now.seconds - lastNotificationSentAt.seconds) / 60;
                if (diffMinutes < NOTIFICATION_COOLDOWN_MINUTES) {
                    console.log(`Notification cooldown for ${recipient.username} is active. Skipping notification.`);
                    return { success: true, skipped: true };
                }
            }
        }
    } catch(error: any) {
        console.error("Error checking user activity/cooldown:", error.message);
        // Proceed with sending notification even if activity check fails
    }
    
    try
    {
        const fcmDoc = await firestore.collection('fcmTokens').doc(recipient.username).get();    
   
        if (!fcmDoc.exists) {
            const errorMsg = `No FCM token document found for username: ${recipient.username}`;
            console.log(errorMsg);        
            return { success: true, error: errorMsg };
        }

        const fcmToken = fcmDoc.exists ? fcmDoc.data()!.token : null;

        if (!fcmToken) {
            const errorMsg = `FCM token is empty for user: ${recipient.username}`;
            console.log(errorMsg);        
            return { success: false, error: errorMsg };
        }

        const funFact = getRandomFunFact();

        const payload: MulticastMessage = {
            tokens: [fcmToken],
            webpush: {
                notification: {
                    title: 'Fun Fact',
                    body: funFact,
                },
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
                            title: 'Fun Fact',
                            body: funFact,
                        },
                        sound: 'default',
                        badge: 1,
                    },
                    'messageId': messageId,
                },
            },
        };  
    
        await messaging.sendEachForMulticast(payload);
        console.log(`Successfully sent notification to ${recipient.username}`);
        
        // Update the last notification timestamp
        const userDocRef = firestore.collection('users').doc(recipient.uid);
        await userDocRef.set({ lastNotificationSentAt: Timestamp.now() }, { merge: true });

        return { success: true };
    } catch (error: any) {
        const errorMsg = `Error sending notification to ${recipient.username}: ${error.message}`;
        console.error(errorMsg);        
        return { success: false, error: errorMsg };
    }
}
