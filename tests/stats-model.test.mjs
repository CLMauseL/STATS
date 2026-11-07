import {test} from 'node:test';
import assert from 'node:assert/strict';
import {STAT_KEYS,validGameStats,playerTotals,rankPlayers,foodTotal,blocksTravelled,validVanillaStats,vanillaRows,consumptionTotals,validConsumedFood} from '../team-web/stats-model.js';
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
test('item usage, planting and inventory gains never imply a meal',()=>{
 const r={...row('Alice','remote',100,{foodEaten:1000}),date:'2026-11-07',inventoryGains:{'minecraft:carrot':100},vanillaStats:{'minecraft:used/minecraft:carrot':1000,'minecraft:picked_up/minecraft:bread':50}};
 const p=consumptionTotals([r])[0];assert.equal(p.known,false);assert.equal(foodTotal(p.items),0);
});
test('completed meals remain split by item and count once per day snapshot',()=>{
 const r=(date,at,foodConsumed)=>({player:'Alice',server:'remote',date,gameStatsAt:at,foodConsumed});
 const p=consumptionTotals([r('2026-11-07',1,{'minecraft:bread':1}),r('2026-11-07',2,{'minecraft:bread':2,'minecraft:carrot':1}),r('2026-11-08',3,{'minecraft:cooked_beef':1})])[0];
 assert.deepEqual(p.items,{'minecraft:bread':2,'minecraft:carrot':1,'minecraft:cooked_beef':1});assert.equal(foodTotal(p.items),4);assert.equal(p.days,2);
});
test('observed zero differs from old unknown food; singleplayer excluded',()=>{
 const result=consumptionTotals([{player:'Old',server:'remote'},{player:'New',server:'remote',foodConsumed:{},date:'2026-11-07'},{player:'Local',server:'singleplayer',foodConsumed:{'minecraft:bread':100}}]);
 assert.equal(result.find(p=>p.player==='Old').known,false);assert.equal(result.find(p=>p.player==='New').known,true);assert.equal(result.some(p=>p.player==='Local'),false);
 assert.equal(validConsumedFood({'minecraft:bread':-1}),null);assert.equal(validConsumedFood({'minecraft:bread':1.5}),null);
});

test('daily placements sum days while vanilla cumulative counters use latest snapshot',()=>{
 const r=(date,at,placed,mined,server='remote')=>({player:'Alice',server,date,gameStatsAt:at,vanillaStats:{'holzkopf:placed/minecraft:oak_planks':placed,'minecraft:mined/minecraft:stone':mined}});
 const values=vanillaRows([r('2026-11-07',1,2,20),r('2026-11-07',2,5,25),r('2026-11-08',3,3,30),r('2026-11-08',4,999,999,'singleplayer')]);
 assert.equal(values.find(x=>x.stat.startsWith('holzkopf:placed/')).value,8);
 assert.equal(values.find(x=>x.stat.startsWith('minecraft:mined/')).value,30);
});

test('historical food totals include pre-mod counts once per server, separate cake slices',async()=>{
 const {historicalFoodTotals}=await import('../team-web/stats-model.js');
 const r=(server,at,bread,carrot)=>({...row('Alice',server,at,{cakeSlices:2}),date:'2026-11-07',foodConsumed:{'minecraft:bread':1},vanillaStats:{'minecraft:used/minecraft:bread':bread,'minecraft:used/minecraft:carrot':carrot,'minecraft:used/minecraft:cake':99,'minecraft:used/minecraft:stone':1000}});
 const p=historicalFoodTotals([r('one',1,50,5),r('one',2,100,10),r('two',3,20,3),r('singleplayer',4,999,999)],['minecraft:bread','minecraft:carrot','minecraft:cake'])[0];
 assert.equal(p.known,true);assert.deepEqual(p.items,{'minecraft:bread':120,'minecraft:carrot':13,'minecraft:cake':4});
});

test('Minecraft statistics use native distance, damage and tick time units',async()=>{
 const {minecraftDisplay}=await import('../team-web/stats-model.js');
 assert.deepEqual(minecraftDisplay('minecraft:custom/minecraft:walk_one_cm',13517000),{value:135.17,unit:'km'});
 assert.deepEqual(minecraftDisplay('minecraft:custom/minecraft:damage_dealt',648373),{value:64837.3,unit:'Schadenspunkte'});
 assert.deepEqual(minecraftDisplay('minecraft:custom/minecraft:play_time',1728000),{value:1,unit:'Tage'});
 assert.deepEqual(minecraftDisplay('minecraft:used/minecraft:bread',120),{value:120,unit:'Anzahl'});
});

test('every statistic has a numeric ranking, shared ranks and latest server totals',async()=>{
 const {statisticRanking}=await import('../team-web/stats-model.js');
 const r=(player,at,value,server='remote')=>({player,server,gameStatsAt:at,vanillaStats:{'minecraft:custom/minecraft:jump':value}});
 const ranks=statisticRanking([r('Alice',1,10),r('Alice',2,20),r('Bob',2,20),r('Cara',2,5),r('Local',3,999,'singleplayer')],'minecraft:custom/minecraft:jump');
 assert.deepEqual(ranks.map(e=>[e.player,e.value,e.rank]),[['Alice',20,1],['Bob',20,1],['Cara',5,3]]);
 assert.equal(ranks.filter(e=>e.player==='Cara')[0].rank,3);
 assert.deepEqual(statisticRanking([r('Alice',1,10)],'minecraft:custom/minecraft:deaths'),[]);
});

test('general subcategories group movement, time, combat and interactions logically',async()=>{
 const {generalCategory}=await import('../team-web/stats-model.js');
 for(const [id,group] of [['walk_one_cm','movement'],['jump','movement'],['sneak_time','time'],['time_since_death','time'],['damage_dealt','combat'],['deaths','combat'],['animals_bred','animals'],['fish_caught','animals'],['eat_cake_slice','food'],['open_chest','interactions'],['traded_with_villager','interactions'],['unknown_future_stat','other']])assert.equal(generalCategory('minecraft:custom/minecraft:'+id),group);
});

test('movement total includes elytra and all native distances, deduplicates snapshots and excludes singleplayer',async()=>{
 const {movementTotals,MOVEMENT_TOTAL,statisticRanking,minecraftDisplay}=await import('../team-web/stats-model.js');
 const r=(at,walk,server='remote')=>({player:'Alice',server,gameStatsAt:at,vanillaStats:{'minecraft:custom/minecraft:walk_one_cm':walk,'minecraft:custom/minecraft:aviate_one_cm':500000,'minecraft:custom/minecraft:boat_one_cm':200000,'minecraft:custom/minecraft:happy_ghast_one_cm':100000,'minecraft:custom/minecraft:jump':3}});
 const rows=[r(1,50000),r(2,100000),r(3,999999,'singleplayer')];
 const p=movementTotals(rows)[0];assert.equal(p.stats.totalCm,900000);assert.equal(p.stats.jumps,3);assert.equal(statisticRanking(rows,MOVEMENT_TOTAL)[0].value,900000);assert.deepEqual(minecraftDisplay(MOVEMENT_TOTAL,900000),{value:9,unit:'km'});
});
