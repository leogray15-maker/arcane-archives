// firebase-messaging-sw.js - Service Worker for Push Notifications
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAK9MheMvSeOpscic4lXUsIwa0J5ubVf6w",
  authDomain: "arcane-archives-3b0f5.firebaseapp.com",
  projectId: "arcane-archives-3b0f5",
  storageBucket: "arcane-archives-3b0f5.firebasestorage.app",
  messagingSenderId: "264237235055",
  appId: "1:264237235055:web:4a2e5605b0ffb5307f069a",
  measurementId: "G-YGPLQHDXMM"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  console.log("[SW] Background message:", payload);

  const notificationTitle =
    payload.notification?.title || "⚡ ARCANE ALERT - XAUUSD";
  const notificationBody =
    payload.notification?.body ||
    "A new ritual setup is live. Check The Archives for entry, SL and targets.";

  const data = payload.data || {};

  const notificationOptions = {
    body: notificationBody,
    icon: "/ArcaneA.png",
    badge: "/ArcaneA.png",
    tag: "arcane-alert",
    renotify: true,
    data: {
      ...data,
      url: "/alerts.html"
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener("notificationclick", function (event) {
  console.log("[SW] Notification click:", event);
  event.notification.close();

  if (event.action === "close") return;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes("/alerts.html") && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow("/alerts.html");
        }
      })
  );
});

console.log("[SW] Loaded successfully");
