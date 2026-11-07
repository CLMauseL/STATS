import {test} from 'node:test';
import assert from 'node:assert/strict';
import {STAT_KEYS,validGameStats,playerTotals,rankPlayers,foodTotal,blocksTravelled,validVanillaStats,vanillaRows} from '../team-web/stats-model.js';
const stats=changes=>({...Object.fromEntries(STAT_KEYS.map(k=>[k,0])),...changes});
const row=(player,server,at,changes)=>({player,server,gameStatsAt:at,gameStats:stats(changes)});
test('repeated daily snapshots never multiply cumulative deaths or meals',()=>{
 const p=playerTotals([row('Alice','one',100,{deaths:8,foodEaten:20}),row('Alice','one',200,{deaths:9,foodEaten:23}),row('Alice','two',150,{deaths:2,foodEaten:4})])[0];
 assert.equal(p.stats.deaths,11);assert.equal(p.stats.foodEaten,27);assert.equal(p.servers,2);
});
test('newer reset replaces old total, rather than retaining a historic maximum',()=>{
 assert.equal(playerTotals([row('Alice','one',100,{deaths:80}),row('Alice','one',200,{deaths:1})])[0].stats.deaths,1);
});
test('old/missing/corrupt stats stay unknown, genuine zero remains a known zero',()=>{
 const players=playerTotals([{player:'Old',server:'one'},row('New','one',100,{deaths:0}),{player:'Bad',server:'one',gameStatsAt:100,gameStats:{deaths:-1}}]);
 assert.equal(players.find(p=>p.player==='Old').known,false);
 assert.equal(players.find(p=>p.player==='Bad').known,false);
 assert.equal(players.find(p=>p.player==='New').known,true);
 assert.equal(rankPlayers(players,s=>s.deaths)[0].player,'New');
 assert.equal(validGameStats(stats({foodEaten:Infinity})),null);
});
test('food and distance units are defined independently of work time',()=>{
 assert.equal(foodTotal(stats({foodEaten:10,cakeSlices:2})),12);
 assert.equal(blocksTravelled(12345),123.45);
 assert.equal(blocksTravelled(100),1);
});
test('ranking sorts numerically and supports different leaderboard metrics',()=>{
 const p=playerTotals([row('Alice','one',100,{deaths:9,jumps:500}),row('Bob','one',100,{deaths:12,jumps:100})]);
 assert.deepEqual(rankPlayers(p,s=>s.deaths).map(p=>p.player),['Bob','Alice']);
 assert.deepEqual(rankPlayers(p,s=>s.jumps).map(p=>p.player),['Alice','Bob']);
});
test('legacy local and cloud singleplayer snapshots never enter rankings',()=>{
 const rows=[row('Local','singleplayer',100,{deaths:99}),row('Cloud','2f14fd475d21eb62822a22c8d346530a17ebc9ccb8e20dff1e2abf1d5deb7823',100,{deaths:100}),row('Remote','remote',100,{deaths:2})];
 assert.deepEqual(playerTotals(rows).map(p=>p.player),['Remote']);
});
test('all vanilla stats deduplicate per server and exclude singleplayer',()=>{
 const sample=(server,at,value)=>({player:'Alice',server,gameStatsAt:at,vanillaStats:{'minecraft:crafted/minecraft:oak_planks':value}});
 const values=vanillaRows([sample('remote',1,100),sample('remote',2,120),sample('remote2',1,30),sample('singleplayer',3,9999)]);
 assert.equal(values.length,1);assert.equal(values[0].value,150);
});
test('vanilla snapshot rejects malicious keys and noninteger/negative counters',()=>{
 assert.deepEqual(validVanillaStats({'<script>':10,'minecraft:mined/minecraft:stone':12,'minecraft:custom/minecraft:jump':-1,'minecraft:used/minecraft:bread':'30'}),{'minecraft:mined/minecraft:stone':12});
 assert.equal(validVanillaStats([]),null);
});
