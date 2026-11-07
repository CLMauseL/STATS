import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {before, after, beforeEach, test} from 'node:test';
import {initializeTestEnvironment, assertFails, assertSucceeds} from '@firebase/rules-unit-testing';
import {doc, setDoc, getDoc, getDocs, collection, deleteDoc, serverTimestamp, updateDoc} from 'firebase/firestore';
let env;
const sha = s => createHash('sha256').update(s).digest('hex');
const server = sha('test.invalid'), date = '2026-11-07';
const id = (uid='alice') => `${uid}_${sha(server+'_'+date)}`;
const data = (uid='alice') => ({schema:2,type:'daily',ownerUid:uid,player:uid==='alice'?'Alice':'Bob',date,server,
  onlineMs:3600000,workMs:3600000,afkMs:0,blocksJson:'{"minecraft:stone":10}',inventoryGainsJson:'{}',updatedAt:serverTimestamp()});
const db = (uid='alice', verified=true) => env.authenticatedContext(uid,{email_verified:verified}).firestore();
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-holzkopf',firestore:{rules:await readFile('firestore.rules','utf8')}})});
after(async()=>{await env?.cleanup()});
beforeEach(async()=>{
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async c=>{
    for(const [uid,player,enabled] of [['alice','Alice',true],['bob','Bob',true],['revoked','Revoked',false]]) {
      await setDoc(doc(c.firestore(),'members',uid),{player,enabled});
    }
  });
});
test('verified approved player can create and update a day, including retroactive AFK deduction',async()=>{
  const ref=doc(db(),'daily',id());
  await assertSucceeds(setDoc(ref,data()));
  await assertSucceeds(updateDoc(ref,{workMs:3300000,afkMs:300000,updatedAt:serverTimestamp()}));
  await assertSucceeds(getDocs(collection(db('bob'),'daily')));
});
test('unauthenticated, unverified, unapproved and revoked accounts cannot read or upload',async()=>{
  for(const client of [env.unauthenticatedContext().firestore(),db('alice',false),db('stranger'),db('revoked')]){
    await assertFails(getDocs(collection(client,'daily')));
    await assertFails(setDoc(doc(client,'daily',id()),data()));
  }
});
test('another player cannot overwrite/delete days or read private membership',async()=>{
  await assertSucceeds(setDoc(doc(db(),'daily',id()),data()));
  await assertFails(setDoc(doc(db('bob'),'daily',id()),data('bob')));
  await assertFails(deleteDoc(doc(db(),'daily',id())));
  await assertFails(getDoc(doc(db('bob'),'members','alice')));
  await assertFails(getDocs(collection(db(),'members')));
  await assertSucceeds(getDoc(doc(db(),'members','alice')));
});
test('users cannot self-enroll, enable revoked membership or grant roles',async()=>{
  await assertFails(setDoc(doc(db('stranger'),'members','stranger'),{player:'Alice',enabled:true}));
  await assertFails(updateDoc(doc(db('revoked'),'members','revoked'),{enabled:true}));
  await assertFails(setDoc(doc(db(),'roles','alice'),{admin:true}));
});
test('schema/ranges/timestamps validated on both create and update',async()=>{
  const invalid=[{workMs:-1},{onlineMs:90000001,workMs:90000001},{afkMs:100},
    {player:'Bob'},{ownerUid:'bob'},{date:'tomorrow'},{server:'server.example.com'},
    {blocksJson:'x'.repeat(65537)},{inventoryGainsJson:{}},{schema:3},{admin:true},{updatedAt:new Date(0)}];
  for(const change of invalid){
    await assertFails(setDoc(doc(db(),'daily',id()),{...data(),...change}));
  }
  await assertSucceeds(setDoc(doc(db(),'daily',id()),data()));
  for(const change of invalid){await assertFails(updateDoc(doc(db(),'daily',id()),{...change, ...(Object.hasOwn(change,'updatedAt')?{}:{updatedAt:serverTimestamp()})}))}
  const missing=data();delete missing.workMs;
  await assertFails(setDoc(doc(db(),'daily',id()),missing));
  await assertFails(setDoc(doc(db(),'daily','arbitrary-id'),data()));
});
test('revocation blocks existing sessions on next operation',async()=>{
  const client=db();await assertSucceeds(setDoc(doc(client,'daily',id()),data()));
  await env.withSecurityRulesDisabled(c=>updateDoc(doc(c.firestore(),'members','alice'),{enabled:false}));
  await assertFails(getDocs(collection(client,'daily')));
  await assertFails(updateDoc(doc(client,'daily',id()),{updatedAt:serverTimestamp()}));
});
test('bounded vanilla counters accepted, malformed counters denied on create and update',async()=>{
  const gameStats=Object.fromEntries(['deaths','foodEaten','cakeSlices','mobKills','playerKills','breeding','jumps','walkCm','sprintCm','swimCm','fishCaught','trades'].map(k=>[k,0]));
  const full={...data(),gameStats,gameStatsAt:Date.now()};
  const ref=doc(db(),'daily',id());
  await assertSucceeds(setDoc(ref,full));
  await assertSucceeds(updateDoc(ref,{gameStats:{...gameStats,deaths:9,jumps:123,walkCm:12345},updatedAt:serverTimestamp()}));
  for(const invalid of [{...gameStats,deaths:-1},{...gameStats,jumps:1.5},{...gameStats,walkCm:1e12+1},{...gameStats,admin:true},{deaths:1}]){
    await assertFails(setDoc(ref,{...full,gameStats:invalid}));
  }
  await assertFails(updateDoc(ref,{gameStatsAt:Date.now()+3600000,updatedAt:serverTimestamp()}));
  const withoutTime={...full};delete withoutTime.gameStatsAt;await assertFails(setDoc(ref,withoutTime));
  await assertFails(setDoc(doc(db(),'daily','wrong'),full));
});
