// firebase-messaging-sw.js - Service Worker for Push Notifications
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

// Initialize Firebase in the service worker
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

// Handle background messages
messaging.onBackgroundMessage(function(payload) {
  console.log("[Service Worker] Background message received:", payload);
  
  // Extract notification data
  const notificationTitle = payload.notification?.title || "⚡ ARCANE ALERT - XAUUSD";
  const notificationBody = payload.notification?.body || 
    "A new ritual setup is live. Check The Archives for entry, SL and targets.";
  
  // Custom data from payload
  const data = payload.data || {};
  
  const notificationOptions = {
    body: notificationBody,
    icon: "/ArcaneA.png",
    badge: "/ArcaneA.png",
    vibrate: [200, 100, 200],
    tag: "arcane-alert",
    renotify: true,
    requireInteraction: false,
    data: {
      ...data,
      timestamp: new Date().toISOString(),
      url: "/alerts.html"
    },
    actions: [
      {
        action: "view",
        title: "View Alert",
        icon: "/ArcaneA.png"
      },
      {
        action: "close",
        title: "Dismiss"
      }
    ]
  };
  
  // Show the notification
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener("notificationclick", function(event) {
  console.log("[Service Worker] Notification clicked:", event);
  
  event.notification.close();
  
  // Handle action clicks
  if (event.action === "close") {
    return; // Just close the notification
  }
  
  // Open or focus the alerts page
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then(function(clientList) {
        // Check if alerts page is already open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes("/alerts.html") && "focus" in client) {
            return client.focus();
          }
        }
        
        // If not open, open new window
        if (clients.openWindow) {
          return clients.openWindow("/alerts.html");
        }
      })
  );
});

// Service worker activation
self.addEventListener("activate", function(event) {
  console.log("[Service Worker] Activated");
  event.waitUntil(
    // Clean up old caches if needed
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function(cacheName) {
            // Remove old cache versions
            return cacheName.startsWith("arcane-") && cacheName !== "arcane-v1";
          })
          .map(function(cacheName) {
            return caches.delete(cacheName);
          })
      );
    })
  );
});

// Service worker installation
self.addEventListener("install", function(event) {
  console.log("[Service Worker] Installing...");
  self.skipWaiting(); // Activate immediately
});

// Optional: Cache static assets for offline access
const CACHE_NAME = "arcane-v1";
const urlsToCache = [
  "/alerts.html",
  "/ArcaneA.png",
  "/auth-guard.js"
];

self.addEventListener("install", function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log("[Service Worker] Caching app shell");
        return cache.addAll(urlsToCache);
      })
      .catch(function(error) {
        console.error("[Service Worker] Cache failed:", error);
      })
  );
});

// Serve cached content when offline
self.addEventListener("fetch", function(event) {
  // Only cache GET requests
  if (event.request.method !== "GET") return;
  
  // Skip caching for API calls
  if (event.request.url.includes("firebaseapp.com") || 
      event.request.url.includes("googleapis.com") ||
      event.request.url.includes("stripe.com")) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Return cached version or fetch new
        return response || fetch(event.request);
      })
      .catch(function(error) {
        console.error("[Service Worker] Fetch failed:", error);
      })
  );
});

console.log("[Service Worker] Loaded successfully");