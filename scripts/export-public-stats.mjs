import {writeFile, rename} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {playerTotals, vanillaRows, isMultiplayerDay} from '../team-web/stats-model.js';

const root = 'https://firestore.googleapis.com/v1/projects/holzkopf-stats-clmausel/databases/live/documents';
const parse = text => { try { return JSON.parse(text); } catch { return null; } };
const decode = v => v?.stringValue ?? v?.booleanValue ??
  (v?.integerValue !== undefined ? Number(v.integerValue) :
    v?.mapValue ? Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k,x])=>[k,decode(x)])) : null);

async function list(collection, fields, token) {
  const url = new URL(root + '/' + collection);
  url.searchParams.set('pageSize','100');
  fields.forEach(field => url.searchParams.append('mask.fieldPaths',field));
  const rows = [];
  const seen = new Set();
  do {
    const response = await fetch(url, {headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30_000)});
    if (!response.ok) throw Error('Firestore '+collection+': HTTP '+response.status);
    const {documents=[],nextPageToken} = await response.json();
    for (const doc of documents) rows.push({id:doc.name.split('/').at(-1),fields:Object.fromEntries(Object.entries(doc.fields??{}).map(([k,v])=>[k,decode(v)]))});
    if (!nextPageToken) return rows;
    if (seen.has(nextPageToken)) throw Error('Repeated Firestore page token');
    seen.add(nextPageToken);
    url.searchParams.set('pageToken',nextPageToken);
  } while (true);
}

export function publicSnapshot(daily, members) {
  const enabled = new Map(members.filter(m=>m.enabled===true).map(m=>[m.uid,m.player]));
  const rows=daily.filter(r=>r.schema===2&&r.type==='daily'&&enabled.get(r.ownerUid)===r.player&&
    /^[A-Za-z0-9_]{1,16}$/.test(r.player)&&r.server&&r.server!=='demo'&&isMultiplayerDay(r));
  const counters=new Map();
  for(const {player,stat,value} of vanillaRows(rows)) {
    if(!/^(?:minecraft:(?:custom|mined|used|crafted|broken|picked_up|dropped|killed|killed_by)|holzkopf:placed)\/minecraft:[a-z0-9_./-]+$/.test(stat))continue;
    if(stat.startsWith('minecraft:custom/')&&/(?:time|leave_game)$/.test(stat))continue;
    if(!counters.has(player))counters.set(player,{});
    counters.get(player)[stat]=value;
  }
  const players=playerTotals(rows).filter(p=>p.known||counters.has(p.player)).sort((a,b)=>a.player.localeCompare(b.player))
    .map(p=>({player:p.player,gameStats:p.known?p.stats:null,vanillaStats:counters.get(p.player)||{}}));
  const asOf=rows.reduce((at,r)=>Number.isSafeInteger(r.gameStatsAt)?Math.max(at,r.gameStatsAt):at,0);
  return {asOf,players};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const token=process.env.STATS_FIRESTORE_ACCESS_TOKEN;
  if(!token)throw Error('Missing Firestore read credentials');
  const [daily,members]=await Promise.all([
    list('daily',['schema','type','ownerUid','player','server','date','gameStats','gameStatsAt','vanillaStatsJson'],token),
    list('members',['player','enabled'],token)
  ]);
  const snapshot=publicSnapshot(daily.map(({fields})=>({...fields,vanillaStats:parse(fields.vanillaStatsJson)})),members.map(({id,fields})=>({uid:id,...fields})));
  const output=new URL('../team-web/public-stats.json',import.meta.url), temporary=new URL('../team-web/public-stats.json.tmp',import.meta.url);
  await writeFile(temporary,JSON.stringify(snapshot)+'\n');
  await rename(temporary,output);
  console.log('Public snapshot generated for '+snapshot.players.length+' players');
}
