import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicSnapshot} from '../scripts/export-public-stats.mjs';

test('public export retains only current members and gameplay counters',()=>{
  const row={schema:2,type:'daily',player:'GBTony',ownerUid:'uid',server:'hidden-server',date:'2026-11-08',gameStatsAt:10,
    email:'hidden-email',workMs:123,afkMs:456,
    vanillaStats:{'minecraft:custom/minecraft:jump':8,'minecraft:custom/minecraft:play_time':90}};
  const snapshot=publicSnapshot([row,{...row,ownerUid:'old',gameStatsAt:11},{...row,server:'singleplayer',gameStatsAt:12}],
    [{uid:'uid',player:'GBTony',enabled:true},{uid:'old',player:'GBTony',enabled:false}]);
  assert.deepEqual(snapshot,{asOf:10,players:[{player:'GBTony',gameStats:null,vanillaStats:{'minecraft:custom/minecraft:jump':8}}]});
});
