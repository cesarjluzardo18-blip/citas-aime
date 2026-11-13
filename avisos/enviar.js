// Revisa las citas y manda las notificaciones. Lo ejecuta GitHub cada 15 minutos.
const admin = require("firebase-admin");
const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) { console.log("Falta el secreto FIREBASE_SERVICE_ACCOUNT. No se envía nada."); process.exit(0); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
const db = admin.firestore();
const URL_APP = "https://cesarjluzardo18-blip.github.io/citas-aime/";
const ADMIN = "cesarjluzardo18@gmail.com";
const TIPOS = { pediatra:["🩺","Pediatra"], vacuna:["💉","Vacuna"], especialista:["👩‍⚕️","Especialista"], dentista:["🦷","Dentista"],
  guarderia:["🎒","Guardería"], natacion:["🏊‍♀️","Natación"], gimnasia:["🤸‍♀️","Gimnasia"], otro:["⭐","Otro"] };

function offsetMadrid(ts) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone:"Europe/Madrid", hourCycle:"h23", year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit" });
  const p = Object.fromEntries(f.formatToParts(new Date(ts)).map(x => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ts;
}
function madrid(fecha, hora) { // hora local de Madrid -> instante real
  const [y, m, d] = fecha.split("-").map(Number); const [hh, mm] = (hora || "00:00").split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  return guess - offsetMadrid(guess - offsetMadrid(guess));
}
function diaAntes(fecha) { const [y, m, d] = fecha.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1, d - 1));
  return t.toISOString().slice(0, 10); }

(async () => {
  const ahora = Date.now();
  const [citasS, usersS, tokensS, fichaS] = await Promise.all([
    db.collection("citas").get(), db.collection("usuarios").get(), db.collection("tokens").get(), db.doc("ficha/aime").get()]);
  const nombre = (fichaS.exists && fichaS.data().nombre) || "Aime";
  const permitidos = new Set(usersS.docs.filter(u => { const d = u.data();
    return ["ver", "editar"].includes(d.rol) || (d.email || "").toLowerCase() === ADMIN; }).map(u => u.id));
  const destinos = []; // {uid, token}
  tokensS.docs.forEach(t => { if (permitidos.has(t.id)) (t.data().tokens || []).forEach(tok => destinos.push({ uid: t.id, token: tok })); });
  if (!destinos.length) { console.log("Nadie ha activado los avisos todavía."); return; }

  const pendientes = [];
  citasS.docs.forEach(doc => {
    const c = doc.data(); if (!c.fecha) return;
    const [e, n] = TIPOS[c.tipo] || TIPOS.otro; const titulo = `${e} ${c.titulo || n}`;
    const inicio = madrid(c.fecha, c.hora || "00:00"), finDia = madrid(c.fecha, "23:59");
    const lugar = c.lugar ? ` · ${c.lugar}` : "";
    const clave = `${doc.id}_${c.fecha}_${(c.hora || "").replace(":", "")}`;
    // 1) El día antes a las 19:00
    const t1 = madrid(diaAntes(c.fecha), "19:00");
    if (ahora >= t1 && ahora < (c.hora ? inicio : madrid(c.fecha, "08:00")))
      pendientes.push({ id: clave + "_dia", title: `Mañana: ${titulo}`, body: `${nombre}${c.hora ? " a las " + c.hora : ""}${lugar}` });
    if (c.hora) {
      // 2) Una hora antes
      if (ahora >= inicio - 3600e3 && ahora < inicio)
        pendientes.push({ id: clave + "_hora", title: `En 1 hora: ${titulo}`, body: `${nombre} a las ${c.hora}${lugar}` });
    } else {
      // 2) Si no tiene hora, el mismo día a las 8:00
      if (ahora >= madrid(c.fecha, "08:00") && ahora < finDia)
        pendientes.push({ id: clave + "_hoy", title: `Hoy: ${titulo}`, body: `${nombre}${lugar}` });
    }
  });

  for (const p of pendientes) {
    const ref = db.doc("avisos_enviados/" + p.id);
    if ((await ref.get()).exists) continue;
    const res = await admin.messaging().sendEachForMulticast({
      tokens: destinos.map(d => d.token),
      notification: { title: p.title, body: p.body },
      webpush: { notification: { icon: URL_APP + "icon-192.png" }, fcmOptions: { link: URL_APP } }
    });
    console.log(`${p.title}: ${res.successCount} enviados, ${res.failureCount} fallidos`);
    // Quita los móviles que ya no existen
    for (let i = 0; i < res.responses.length; i++) {
      const r = res.responses[i];
      if (!r.success && /not-registered|invalid-registration/.test(r.error?.code || "")) {
        await db.doc("tokens/" + destinos[i].uid).update({ tokens: admin.firestore.FieldValue.arrayRemove(destinos[i].token) }).catch(() => {});
      }
    }
    await ref.set({ enviado: new Date().toISOString(), titulo: p.title });
  }
  console.log(`Revisión hecha: ${pendientes.length} avisos tocaban ahora.`);
})().catch(e => { console.error(e); process.exit(1); });
