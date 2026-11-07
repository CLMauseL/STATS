export const STAT_KEYS = ['deaths','foodEaten','cakeSlices','mobKills','playerKills','breeding','jumps','walkCm','sprintCm','swimCm','fishCaught','trades'];
export function isMultiplayerDay(row) {
  return row.server !== 'singleplayer' && row.server !== '2f14fd475d21eb62822a22c8d346530a17ebc9ccb8e20dff1e2abf1d5deb7823';
}
export function validGameStats(stats) {
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) return null;
  if (!STAT_KEYS.every(k=>Number.isSafeInteger(stats[k]) && stats[k]>=0 && stats[k]<=1e12)) return null;
  return Object.fromEntries(STAT_KEYS.map(k=>[k,stats[k]]));
}
// A cumulative snapshot must never be summed once per day. Choose the newest
// sample for each player/server, then sum only across different servers.
export function playerTotals(rows) {
  rows = rows.filter(isMultiplayerDay);
  const latest=new Map();
  const players=new Map([...new Set(rows.map(r=>r.player))].map(player=>[player,{player,known:false,servers:0,sampledAt:0,stats:Object.fromEntries(STAT_KEYS.map(k=>[k,0]))}]));
  for (const row of rows) {
    const stats=validGameStats(row.gameStats), at=row.gameStatsAt;
    if (!stats || !Number.isSafeInteger(at) || at<=0) continue;
    const key=JSON.stringify([row.player,row.server]);
    if (!latest.has(key) || latest.get(key).at<at) latest.set(key,{player:row.player,stats,at});
  }
  for (const {player,stats,at} of latest.values()) {
    const p=players.get(player);p.known=true;p.servers++;p.sampledAt=Math.max(p.sampledAt,at);
    for (const k of STAT_KEYS) p.stats[k]+=stats[k];
  }
  return [...players.values()];
}
export const foodTotal = items => Object.values(items).reduce((sum,n)=>sum+n,0);
export const blocksTravelled = cm => cm / 100;
export function rankPlayers(players, metric) {
  return [...players].sort((a,b)=>Number(b.known)-Number(a.known)
    || (a.known && b.known ? metric(b.stats)-metric(a.stats) : 0)
    || a.player.localeCompare(b.player,'de'));
}
export function validVanillaStats(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries=Object.entries(value);
  if(entries.length>10000)return null;
  return Object.fromEntries(entries.filter(([k,v])=>k.length<=192
    && /^[a-z0-9_.-]+:[a-z0-9_.-]+\/[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(k)
    && Number.isSafeInteger(v)&&v>=0&&v<=1e12));
}
export function vanillaRows(rows) {
  const latest=new Map();
  for(const row of rows.filter(isMultiplayerDay)){
    const stats=validVanillaStats(row.vanillaStats);
    if(!stats||!Number.isSafeInteger(row.gameStatsAt)||row.gameStatsAt<=0)continue;
    const key=JSON.stringify([row.player,row.server]);
    if(!latest.has(key)||latest.get(key).gameStatsAt<row.gameStatsAt)latest.set(key,{...row,vanillaStats:stats});
  }
  // Placements are observed daily, unlike cumulative vanilla counters.
  const placedDays=new Map();
  for(const row of rows.filter(isMultiplayerDay)) {
    const stats=validVanillaStats(row.vanillaStats);if(!stats)continue;
    const key=JSON.stringify([row.player,row.server,row.date]);
    if(!placedDays.has(key)||(placedDays.get(key).gameStatsAt||0)<=(row.gameStatsAt||0))placedDays.set(key,{...row,vanillaStats:stats});
  }
  const totals=new Map();
  for(const row of [...latest.values(),...placedDays.values()].map((r,i)=>({...r,vanillaStats:Object.fromEntries(Object.entries(r.vanillaStats).filter(([k])=>i<latest.size?!k.startsWith('holzkopf:placed/'):k.startsWith('holzkopf:placed/')))})))for(const [stat,value] of Object.entries(row.vanillaStats)){
    const key=JSON.stringify([row.player,stat]);
    if(!totals.has(key))totals.set(key,{player:row.player,stat,value:0});
    totals.get(key).value+=value;
  }
  return [...totals.values()];
}
export function validConsumedFood(items) {
  if(!items||typeof items!=='object'||Array.isArray(items))return null;
  const entries=Object.entries(items);
  if(entries.length>1024||!entries.every(([id,n])=>id.length<=128
    && /^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(id)&&Number.isSafeInteger(n)&&n>=0&&n<=1e12))return null;
  return Object.fromEntries(entries);
}
export function consumptionTotals(rows) {
  rows=rows.filter(isMultiplayerDay);
  const players=new Map([...new Set(rows.map(r=>r.player))].map(player=>[player,{player,known:false,items:{},days:0}]));
  const days=new Map();
  for(const row of rows){
    const items=validConsumedFood(row.foodConsumed);if(!items)continue;
    const key=JSON.stringify([row.player,row.server,row.date]);
    if(!days.has(key)||(days.get(key).at||0)<=(row.gameStatsAt||0))days.set(key,{player:row.player,items,at:row.gameStatsAt});
  }
  for(const {player,items} of days.values()){
    const p=players.get(player);p.known=true;p.days++;
    for(const [id,n] of Object.entries(items))p.items[id]=(p.items[id]||0)+n;
  }
  return [...players.values()];
}

// Historical food item-use counters: latest snapshot per player/server, never per-day sum.
// These cannot distinguish consumption from planting for dual-purpose foods.
export function historicalFoodTotals(rows, foodIds) {
 const allowed=new Set(foodIds.filter(id=>id!=='minecraft:cake'));
 const players=new Map(rows.filter(isMultiplayerDay).map(r=>[r.player,{player:r.player,known:false,items:{}}]));
 for(const r of rows.filter(isMultiplayerDay))if(validVanillaStats(r.vanillaStats)&&Number.isSafeInteger(r.gameStatsAt)&&r.gameStatsAt>0)players.get(r.player).known=true;
 for(const entry of vanillaRows(rows)) {
  const [type,id]=entry.stat.split('/');
  if(type==='minecraft:used'&&allowed.has(id))players.get(entry.player).items[id]=entry.value;
 }
 for(const p of playerTotals(rows))if(p.known){
  const target=players.get(p.player);target.known=true;target.items['minecraft:cake']=p.stats.cakeSlices;
 }
 return [...players.values()];
}

export function minecraftDisplay(stat, value) {
 const [type,id]=stat.split('/');
 if(type!=='minecraft:custom')return {value,unit:'Anzahl'};
 if(id.endsWith('_one_cm'))return value>=100000?{value:value/100000,unit:'km'}:value>=100?{value:value/100,unit:'m'}:{value,unit:'cm'};
 if(id.startsWith('minecraft:damage_'))return {value:value/10,unit:'Schadenspunkte'};
 if(['minecraft:play_time','minecraft:total_world_time','minecraft:time_since_death','minecraft:time_since_rest','minecraft:sneak_time'].includes(id)){
  const seconds=value/20;return seconds>=86400?{value:seconds/86400,unit:'Tage'}:seconds>=3600?{value:seconds/3600,unit:'Stunden'}:seconds>=60?{value:seconds/60,unit:'Minuten'}:{value:seconds,unit:'Sekunden'};
 }
 return {value,unit:'Anzahl'};
}
