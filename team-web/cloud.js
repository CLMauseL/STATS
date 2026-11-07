import {parsePairingLink,completePairing} from './pairing-client.js?v=easy-login-050';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import { getAuth, setPersistence, browserSessionPersistence, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signOut,
  onAuthStateChanged, reload, EmailAuthProvider, reauthenticateWithCredential } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';
import { getFirestore, doc, collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js';
import { firebaseConfig, databaseId } from './firebase-config.js';

const el = id => document.getElementById(id);
const pairing=parsePairingLink(window.statsCloud.pairingLink);
let paired=false;
if(pairing)el('bridgeStatus').textContent='Minecraft läuft als '+pairing.player+'. Mit dem passenden Teamkonto anmelden und diese Mod verbinden.';
const auth = getAuth(initializeApp(firebaseConfig));
const db = getFirestore(auth.app, databaseId);
await setPersistence(auth, browserSessionPersistence);
let stopMember = () => {}, stopDays = () => {}, generation = 0, membership = null;
const status = text => {
  el('cloudStatus').textContent = text;
  el('liveDataMessage').textContent = text;
  el('liveDataState').textContent = text.startsWith('Live verbunden') ? 'Minecraft-Gesamtstände verbunden' : 'Live-Verbindung';
};
const enableLive = () => { el('cloudMode').checked = true; window.statsCloud.mode(true); };
const clear = () => {
  stopMember(); stopDays(); membership = null; el('pairMod').disabled = true; el('bridgeConnect').disabled=true;
  window.statsCloud.replace([]);
};
async function action(fn) {
  const buttons = [...el('cloudPanel').querySelectorAll('button')];
  buttons.forEach(b => { b.disabled = true; });
  try { await fn(); }
  catch { status('Aktion nicht möglich. Zugangsdaten, E-Mail-Bestätigung und Teamfreigabe prüfen.'); }
  finally {
    buttons.forEach(b => { b.disabled = false; });
    el('pairMod').disabled = !membership || !auth.currentUser?.emailVerified;
    el('bridgeConnect').disabled=paired||!pairing||!membership||!auth.currentUser?.emailVerified||membership.player!==pairing.player;
    el('cloudPassword').value = '';
  }
}
el('cloudLogin').onclick = () => action(async () => {
  await signInWithEmailAndPassword(auth, el('cloudEmail').value.trim(), el('cloudPassword').value);
  enableLive();
});
el('cloudSignup').onclick = () => action(async () => {
  if (el('cloudPassword').value.length < 12) {
    status('Für ein neues Konto mindestens 12 Zeichen als Passwort verwenden.'); return;
  }
  const result = await createUserWithEmailAndPassword(auth, el('cloudEmail').value.trim(), el('cloudPassword').value);
  await sendEmailVerification(result.user);
  status('Bestätigungs-E-Mail gesendet. Danach „Bestätigung prüfen“ wählen.');
});
el('cloudReset').onclick = () => action(async () => {
  await sendPasswordResetEmail(auth, el('cloudEmail').value.trim());
  status('Falls ein passendes Konto existiert, erhältst du eine E-Mail.');
});
el('cloudVerify').onclick = () => action(async () => {
  if (!auth.currentUser) { status('Bitte zuerst anmelden.'); return; }
  await reload(auth.currentUser); await auth.currentUser.getIdToken(true);
  await connect(auth.currentUser);
});
el('cloudLogout').onclick = () => action(async () => { clear(); await signOut(auth); });
el('cloudMode').onchange = () => window.statsCloud.mode(el('cloudMode').checked);
async function connect(user) {
  const current = ++generation; clear();
  el('cloudUid').textContent = user ? `Konto-ID für die Teamfreigabe: ${user.uid}` : '';
  if (!user) { if(window.statsCloud.hasOffline()){el('cloudMode').checked=false;window.statsCloud.mode(false)} status('Nicht angemeldet. Unter „Anmeldung & Live-Daten“ anmelden, um deine vorhandenen Minecraft-Statistiken zu laden.'); return; }
  if (!user.emailVerified) { status('Bitte zuerst deine E-Mail-Adresse bestätigen.'); return; }
  // Keep membership live: revoked accounts immediately lose the displayed data.
  stopMember = onSnapshot(doc(db, 'members', user.uid), snap => {
    if (current !== generation) return;
    stopDays(); membership = snap.exists() && snap.data().enabled === true ? snap.data() : null;
    if (!membership) {
      window.statsCloud.replace([]); el('pairMod').disabled = true;
      status('Angemeldet. Teamfreigabe durch den Projektinhaber erforderlich.'); return;
    }
    el('pairMod').disabled = false;
    el('bridgeConnect').disabled=paired||!pairing||membership.player!==pairing.player;
    if(pairing&&!paired)el('bridgeStatus').textContent=membership.player===pairing.player?'Bereit: Minecraft und Konto gehören zu '+pairing.player+'. Jetzt verbinden.':'Dieses Konto gehört zu '+membership.player+', die Mod läuft als '+pairing.player+'. Bitte mit dem passenden Konto anmelden.';
    enableLive();
    // Core listener is intentional: this dashboard requires real-time updates.
    stopDays = onSnapshot(collection(db, 'daily'), snapshot => {
      if (current !== generation) return;
      const rows = [];
      for (const item of snapshot.docs) {
        try {
          const d = item.data();
          let meals = null, vanilla = null;
          try { meals = d.foodConsumedJson ? JSON.parse(d.foodConsumedJson) : null; } catch { /* Optional malformed food data stays unknown. */ }
          try { vanilla = d.vanillaStatsJson ? JSON.parse(d.vanillaStatsJson) : null; } catch { /* Keep the valid daily record. */ }
          rows.push(window.statsCloud.validate({...d, blocks: JSON.parse(d.blocksJson),
            foodConsumed: meals,
            vanillaStats: vanilla,
            inventoryGains: JSON.parse(d.inventoryGainsJson)}));
        } catch { /* Ignore corrupt client payloads, never render raw HTML. */ }
      }
      window.statsCloud.replace(rows);
      const count=rows.reduce((n,r)=>n+Object.keys(r.vanillaStats||{}).length,0);
      status(`Live verbunden als ${membership.player} · ${rows.length} Tagesstände · ${count} übertragene Minecraft-Statistikwerte`);
    }, () => { window.statsCloud.replace([]); status('Live-Verbindung unterbrochen oder Freigabe entzogen.'); });
  }, () => {
    stopDays(); membership = null; window.statsCloud.replace([]); el('pairMod').disabled = true;
    status('Teamfreigabe kann nicht gelesen werden. Erneut anmelden.');
  });
}
onAuthStateChanged(auth, user => connect(user).catch(() => status('Anmeldung bitte erneut versuchen.')));

el('pairMod').onclick = () => action(async () => {
  const user = auth.currentUser;
  if (!user?.emailVerified || !membership || !el('cloudPassword').value) {
    status('Zum Verbinden das Passwort nochmals eingeben.'); return;
  }
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, el('cloudPassword').value));
  if (!confirm('Mod auf diesem eigenen PC verbinden? Die Datei enthält deinen privaten Anmeldeschlüssel und erlaubt Uploads für deinen Spieler. Sie überträgt auch vorhandene lokale Tagesdateien. Niemals teilen oder in GitHub hochladen.')) return;
  const config = {projectId:firebaseConfig.projectId, databaseId, apiKey:firebaseConfig.apiKey,
    uid:user.uid, player:membership.player, refreshToken:user.refreshToken};
  const url = URL.createObjectURL(new Blob([JSON.stringify(config, null, 2)], {type:'application/json'}));
  const a = document.createElement('a'); a.href = url; a.download = 'cloud-session.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status('Datei in .minecraft/config/farming-tracker/cloud-session.json ablegen. Downloadkopie danach löschen. Die laufende Mod verbindet sich innerhalb von 30 Sekunden.');
});

el('bridgeConnect').onclick=()=>action(async()=>{
 const user=auth.currentUser;
 if(!pairing||!user?.emailVerified||!membership||membership.player!==pairing.player)return;
 const signedInAt=Date.parse(user.metadata.lastSignInTime);
 if(!Number.isFinite(signedInAt)||Date.now()-signedInAt>300000){
  if(!el('cloudPassword').value){el('bridgeStatus').textContent='Zur Bestätigung bitte dein Passwort im Anmeldefeld erneut eingeben und nochmals verbinden.';return;}
  await reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email,el('cloudPassword').value));
 }
 await user.getIdToken(true);
 const config={projectId:firebaseConfig.projectId,databaseId,apiKey:firebaseConfig.apiKey,uid:user.uid,player:membership.player,refreshToken:user.refreshToken};
 try{
  await completePairing(pairing,config);paired=true;
  el('bridgeStatus').textContent='Verbunden! Die Mod hat deine Anmeldung gespeichert. Zum Server zurückkehren; der erste Upload folgt innerhalb einer Minute.';
  el('bridgeConnect').textContent='Mod verbunden ✓';enableLive();
 }catch(error){
  el('bridgeStatus').textContent=error.message==='expired'?'Die Verbindung ist abgelaufen. In Minecraft erneut „Holzkopfarmy verbinden“ wählen.':'Die gestartete Mod ist nicht erreichbar. Minecraft geöffnet lassen und erneut „Holzkopfarmy verbinden“ wählen. Falls dein Browser nach lokalem Netzwerkzugriff fragt, für diese Verbindung erlauben. Alternativ „Verbindungsdatei herunterladen“ verwenden.';
 }
});
