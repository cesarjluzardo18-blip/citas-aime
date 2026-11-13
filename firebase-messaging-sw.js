// Recibe las notificaciones cuando la app está cerrada
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");
firebase.initializeApp({
  apiKey: "AIzaSyAA_ITUXcmrj_re645jLI7STXscfLL5m4o",
  authDomain: "aime-a723b.firebaseapp.com",
  projectId: "aime-a723b",
  storageBucket: "aime-a723b.firebasestorage.app",
  messagingSenderId: "203341907408",
  appId: "1:203341907408:web:1da2aa4e342b1b133a65d5"
});
firebase.messaging();
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({type:"window", includeUncontrolled:true}).then(ws => {
    for (const w of ws) { if (w.url.includes("/citas-aime/")) return w.focus(); }
    return clients.openWindow("/citas-aime/");
  }));
});
