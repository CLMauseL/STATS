export function parsePairingLink(value) {
 const url=new URL(value),port=Number(url.searchParams.get('pairPort')),nonce=new URLSearchParams(url.hash.slice(1)).get('pair'),player=url.searchParams.get('player');
 if(!Number.isInteger(port)||port<1024||port>65535||!/^([a-f0-9]{64})$/.test(nonce||'')||!/^[A-Za-z0-9_]{1,16}$/.test(player||''))return null;
 return {port,nonce,player};
}
export async function completePairing(pairing,config,request=fetch){
 if(!pairing||config.player!==pairing.player)throw new Error('player-mismatch');
 const response=await request(`http://127.0.0.1:${pairing.port}/pair`,{method:'POST',targetAddressSpace:'loopback',mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json','X-Holzkopf-Pairing':pairing.nonce},body:JSON.stringify(config),signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw new Error(response.status===410?'expired':'connection-rejected');
 const result=await response.json();if(result.ok!==true)throw new Error('connection-rejected');
}
