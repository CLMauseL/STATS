export const STAT_KEYS = ['deaths','foodEaten','cakeSlices','mobKills','playerKills','breeding','jumps','walkCm','sprintCm','swimCm','fishCaught','trades'];
export function validGameStats(stats) {
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) return null;
  if (!STAT_KEYS.every(k=>Number.isSafeInteger(stats[k]) && stats[k]>=0 && stats[k]<=1e12)) return null;
  return Object.fromEntries(STAT_KEYS.map(k=>[k,stats[k]]));
}
// A cumulative snapshot must never be summed once per day. Choose the newest
// sample for each player/server, then sum only across different servers.
export function playerTotals(rows) {
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
export const foodTotal = stats => stats.foodEaten + stats.cakeSlices;
export const blocksTravelled = cm => cm / 100;
export function rankPlayers(players, metric) {
  return [...players].sort((a,b)=>Number(b.known)-Number(a.known)
    || (a.known && b.known ? metric(b.stats)-metric(a.stats) : 0)
    || a.player.localeCompare(b.player,'de'));
}
