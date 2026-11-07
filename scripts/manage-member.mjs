// Run only on the project owner's machine after `npx firebase-tools login`.
// Reuses the CLI login in memory; never writes admin credentials into the repository.
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const auth=require('firebase-tools/lib/auth.js');
const project='holzkopf-stats-clmausel', database='live';
const [action,email,player]=process.argv.slice(2);
if(!['grant','revoke','revoke-sessions'].includes(action)||!email?.includes('@')||
  (action==='grant'&&!/^[A-Za-z0-9_]{1,16}$/.test(player||''))){
  console.error('Usage: node scripts/manage-member.mjs grant EMAIL MINECRAFT_NAME | revoke EMAIL | revoke-sessions EMAIL');process.exit(1);
}
const account=auth.getGlobalDefaultAccount();
if(!account)throw Error('Log into Firebase CLI first.');
const token=await auth.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/firebase']);
async function api(url,body,method='POST'){
  const r=await fetch(url,{method,headers:{Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok)throw Error(`Admin request rejected (HTTP ${r.status}). Check project permissions.`);
  return r.json();
}
const identity=`https://identitytoolkit.googleapis.com/v1/projects/${project}`;
const lookup=await api(`${identity}/accounts:lookup`,{email:[email]});
const user=lookup.users?.[0];if(!user)throw Error('Create the player account in the dashboard first.');
if(action==='revoke-sessions'){
  await api(`${identity}/accounts:update`,{localId:user.localId,validSince:String(Math.floor(Date.now()/1000)+1)});
  console.log('Player refresh tokens revoked. Existing ID tokens expire within one hour; revoke team membership for immediate data lockout.');
}else{
  if(action==='grant'&&!user.emailVerified)throw Error('Player must confirm their email first.');
  const root=`https://firestore.googleapis.com/v1/projects/${project}/databases/${database}/documents`;
  if(action==='grant'){
    const matches=await api(`${root}:runQuery`,{structuredQuery:{from:[{collectionId:'members'}],where:{fieldFilter:{field:{fieldPath:'player'},op:'EQUAL',value:{stringValue:player}}}}});
    if(matches.some(r=>r.document&&!r.document.name.endsWith('/'+user.localId)))throw Error('Minecraft name already assigned. Revoke the old mapping before changing owners.');
  }
  const fields=action==='grant'?{player:{stringValue:player},enabled:{booleanValue:true}}:{enabled:{booleanValue:false}};
  await api(`${root}/members/${encodeURIComponent(user.localId)}${action==='revoke'?'?updateMask.fieldPaths=enabled':''}`,{fields},'PATCH');
  console.log(action==='grant'?'Player approved.':'Team access revoked.');
}
