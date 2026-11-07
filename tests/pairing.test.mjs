import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePairingLink,completePairing} from '../team-web/pairing-client.js';
const nonce='a'.repeat(64),link=`https://clmausel.github.io/STATS/?pairPort=50123&player=GBTony#pair=${nonce}`;
test('pairing link validates loopback port, nonce and exact player',()=>{
 assert.deepEqual(parsePairingLink(link),{port:50123,nonce,player:'GBTony'});
 for(const bad of [link.replace('50123','80'),link.replace(nonce,'short'),link.replace('GBTony','bad/player'),'https://clmausel.github.io/STATS/'])assert.equal(parsePairingLink(bad),null);
});
test('credentials go only in a nonce-authenticated POST to loopback, not a URL',async()=>{
 const pairing=parsePairingLink(link),config={player:'GBTony',refreshToken:'test_only_not_a_credential'};
 await completePairing(pairing,config,async(url,options)=>{
  assert.equal(url,'http://127.0.0.1:50123/pair');assert.equal(options.method,'POST');assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.headers['X-Holzkopf-Pairing'],nonce);
  assert.equal(JSON.parse(options.body).refreshToken,config.refreshToken);assert.equal(url.includes(config.refreshToken),false);
  return {ok:true,json:async()=>({ok:true})};
 });
 await assert.rejects(()=>completePairing(pairing,{...config,player:'CLMauseL'}),/player-mismatch/);
 await assert.rejects(()=>completePairing(pairing,config,async()=>({ok:false,status:410})),/expired/);
 await assert.rejects(()=>completePairing(pairing,config,async()=>({ok:false,status:403})),/connection-rejected/);
});
