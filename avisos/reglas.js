// Publica firestore.rules en Firebase cuando cambian (lo lanza GitHub)
const admin = require("firebase-admin");
const fs = require("fs");
const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) { console.log("Falta el secreto FIREBASE_SERVICE_ACCOUNT."); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
admin.securityRules().releaseFirestoreRulesetFromSource(fs.readFileSync("firestore.rules", "utf8"))
  .then(r => console.log("Reglas publicadas:", r.name))
  .catch(e => { console.error("No se pudieron publicar las reglas:", e.message); process.exit(1); });
