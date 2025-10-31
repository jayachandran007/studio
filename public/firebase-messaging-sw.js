// This file must be in the public directory.
// See https://firebase.google.com/docs/cloud-messaging/js/receive

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Your web app's Firebase configuration.
const firebaseConfig = {
  "projectId": "studio-9367397757-f04cc",
  "appId": "1:129385794267:web:bac743908597ea0c44dafe",
  "apiKey": "AIzaSyBqUs7aTQniRqK3LMBD0IJZWxhJbZCsoik",
  "authDomain": "studio-9367397757-f04cc.firebaseapp.com",
  "storageBucket": "studio-9367397757-f04cc.firebasestorage.app",
  "measurementId": "",
  "messagingSenderId": "129385794267"
};

// Initialize the Firebase app in the service worker with the configuration.
const app = firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  // Customize notification here. The payload is the "data" object from the message.
  const notificationTitle = payload.data.title;
  const notificationOptions = {
    body: payload.data.body,
    icon: '/icon-192x192.png', // A default icon
    badge: '/badge-72x72.png', // A badge for Android
    data: {
      url: payload.data.url || '/' // Default to home page if no URL is provided
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Optional: Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click Received.', event.notification);

  event.notification.close();

  const urlToOpen = event.notification.data.url || '/';

  event.waitUntil(clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  }).then((clientList) => {
    // If a window for this app is already open, focus it.
    for (const client of clientList) {
      if (client.url === urlToOpen && 'focus' in client) {
        return client.focus();
      }
    }
    // Otherwise, open a new window.
    if (clients.openWindow) {
      return clients.openWindow(urlToOpen);
    }
  }));
});
