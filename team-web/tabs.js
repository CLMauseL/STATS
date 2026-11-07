import {minecraftNames} from './minecraft-names.js?v=clean-block-names';
import {playerTotals,rankPlayers,foodTotal,blocksTravelled,vanillaRows,historicalFoodTotals,minecraftDisplay,statisticRanking,generalCategory} from './stats-model.js?v=clean-block-names';
const $=id=>document.getElementById(id);
const format=n=>n.toLocaleString('de-CH',{maximumFractionDigits:2});
const sortSelection={};
const allState={search:'',group:'*',player:'*',page:0,sort:'name',section:'general'};
const generalGroups=[['*','Alles'],['time','Zeit & Aktivität'],['movement','Bewegung & Reisen'],['combat','Kampf & Überleben'],['animals','Tiere & Angeln'],['food','Essen'],['interactions','Handel & Interaktionen'],['other','Sonstiges']];
const labels={'holzkopf:placed':'Blöcke gesetzt','minecraft:custom':'Allgemein','minecraft:mined':'Blöcke abgebaut','minecraft:crafted':'Items hergestellt','minecraft:used':'Items benutzt','minecraft:broken':'Werkzeuge zerbrochen','minecraft:picked_up':'Items aufgesammelt','minecraft:dropped':'Items weggeworfen','minecraft:killed':'Mobs besiegt','minecraft:killed_by':'Getötet durch'};
let selectedPlayer='*';
function selectPlayer(player){
 selectedPlayer=player;allState.player=player;foodState.player=player;blockState.player=player;rankingState.player=player;
 const overview=$('player');if([...overview.options].some(o=>o.value===player)){overview.value=player;overview.dispatchEvent(new Event('change'))}else renderCategories();
}
function renderPlayerTabs(){
 const root=$('stat-player-tabs');root.replaceChildren();
 const names=[...new Set(window.statsCloud.getRows().map(r=>r.player))].sort();
 if(selectedPlayer!=='*'&&!names.includes(selectedPlayer)){selectedPlayer='*';allState.player='*';foodState.player='*';blockState.player='*';rankingState.player='*'}
 for(const [id,label] of [['*','Gesamtes Team'],...names.map(p=>[p,p])]){const b=node('button',label,'player-tab');b.setAttribute('role','tab');b.setAttribute('aria-selected',String(selectedPlayer===id));b.setAttribute('aria-controls','panel-overview panel-rankings panel-food panel-combat panel-movement panel-blocks panel-all');b.tabIndex=selectedPlayer===id?0:-1;b.onclick=()=>selectPlayer(id);b.onkeydown=e=>{const tabs=[...root.children],i=tabs.indexOf(b);let next;if(e.key==='ArrowRight')next=(i+1)%tabs.length;else if(e.key==='ArrowLeft')next=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=tabs.length-1;else return;e.preventDefault();tabs[next].click();root.querySelector('[aria-selected=true]').focus()};root.append(b)}
 $('player-selection-status').textContent=selectedPlayer==='*'?'Alle Spieler · Teamvergleich':selectedPlayer+' · persönliche Statistiken und Teamrang';
}
let sectionButtons,subcategoryButtons;
const statSection=type=>type==='minecraft:custom'?'general':['minecraft:killed','minecraft:killed_by'].includes(type)?'mobs':'items';
function statName(stat){const [type,id]=stat.split('/'),name=id.replace(':','.');const keys=type==='minecraft:custom'?['stat.'+name]:statSection(type)==='mobs'?['entity.'+name]:['item.'+name,'block.'+name];return keys.map(k=>minecraftNames[k]).find(Boolean)||id}
let allToolbar,allSearch,allGroup,allPlayer,allTable,allCount,allPrev,allNext,allSort;
function renderAllStats(){
  const root=$('stats-all');
  if(!allToolbar){
    root.append(node('h2','Alle Minecraft-Statistiken'));
    root.append(node('p','Direkt aus der Minecraft-Statistik des Multiplayer-Servers: Allgemein, Items und Mobs, einschließlich vorhandener Historie. Bezeichnungen wie im englischen Minecraft. Fehlende Einträge wurden noch nicht übertragen. Eigene Platzierungszählungen stehen separat unter Blöcke.'));
    sectionButtons=node('div',undefined,'stat-sections');for(const [id,label] of [['general','Allgemein (General)'],['items','Items'],['mobs','Mobs']]){const b=node('button',label,'button alt');b.dataset.section=id;b.onclick=()=>{allState.section=id;allState.group='*';allState.page=0;renderAllStats()};sectionButtons.append(b)}root.append(sectionButtons);subcategoryButtons=node('div',undefined,'stat-subcategories');subcategoryButtons.setAttribute('aria-label','Unterkategorien');root.append(subcategoryButtons);
    allToolbar=node('div',undefined,'stat-filters');allSearch=node('input');allSearch.type='search';allSearch.placeholder='Suchen, z. B. diamond, jump, damage …';allSearch.setAttribute('aria-label','Statistiken durchsuchen');
    allGroup=node('select');allGroup.setAttribute('aria-label','Statistikkategorie');
    allPlayer=node('select');allPlayer.setAttribute('aria-label','Statistiken nach Spieler filtern');
    allSort=node('select');allSort.setAttribute('aria-label','Statistiken sortieren');for(const [value,label] of [['value','Höchster Wert zuerst'],['name','Nach Statistik / ID']]){const o=node('option',label);o.value=value;allSort.append(o)}
    allSort.value=allState.sort;
    allSort.onchange=()=>{allState.sort=allSort.value;allState.page=0;renderAllStats()};
    const playerLabel=node('label','Spieler auswählen: ');playerLabel.append(allPlayer);allToolbar.append(allSearch,allGroup,playerLabel,allSort);root.append(allToolbar);
    allCount=node('p',undefined,'stat-count');allTable=node('div',undefined,'stat-results');root.append(allCount,allTable);
    const pager=node('div',undefined,'nav');allPrev=node('button','← Zurück','button alt');allNext=node('button','Weiter →','button alt');pager.append(allPrev,allNext);root.append(pager);
    allSearch.oninput=()=>{allState.search=allSearch.value;allState.page=0;renderAllStats()};
    allGroup.onchange=()=>{allState.group=allGroup.value;allState.page=0;renderAllStats()};
    allPlayer.onchange=()=>{allState.page=0;selectPlayer(allPlayer.value)};
    allPrev.onclick=()=>{allState.page--;renderAllStats()};allNext.onclick=()=>{allState.page++;renderAllStats()};
  }
  for(const b of sectionButtons.children)b.setAttribute('aria-pressed',String(b.dataset.section===allState.section));
  const entries=vanillaRows(window.statsCloud.getRows()).filter(e=>e.stat.startsWith('minecraft:')&&statSection(e.stat.split('/')[0])===allState.section);
  const fill=(select,values,selected,first)=>{select.replaceChildren();for(const [value,label] of [['*',first],...values]){const o=node('option',label);o.value=value;select.append(o)}select.value=values.some(([v])=>v===selected)?selected:'*';};
  const types=allState.section==='items'?['minecraft:used','minecraft:mined','minecraft:crafted','minecraft:broken','minecraft:picked_up','minecraft:dropped']:allState.section==='mobs'?['minecraft:killed','minecraft:killed_by']:generalGroups.filter(([id])=>id!=='*').map(([id])=>id);
  fill(allGroup,types.map(k=>[k,generalGroups.find(([id])=>id===k)?.[1]||labels[k]||k]),allState.group,'Alle Kategorien');
  fill(allPlayer,[...new Set(window.statsCloud.getRows().map(x=>x.player))].sort().map(p=>[p,p]),allState.player,'Alle Spieler');
  allState.group=allGroup.value;allState.player=allPlayer.value;
  const subcategories=allState.section==='items'?[['*','Alle Items'],['minecraft:used','Benutzt'],['minecraft:mined','Abgebaut'],['minecraft:crafted','Hergestellt'],['minecraft:broken','Zerbrochen'],['minecraft:picked_up','Aufgesammelt'],['minecraft:dropped','Weggeworfen']]:allState.section==='mobs'?[['*','Alle Mobs'],['minecraft:killed','Besiegt'],['minecraft:killed_by','Getötet durch']]:generalGroups;
  subcategoryButtons.replaceChildren();subcategoryButtons.hidden=!subcategories.length;allGroup.hidden=!!subcategories.length;
  for(const [id,label] of subcategories){const b=node('button',label,'subcategory-button');b.setAttribute('aria-pressed',String(allState.group===id));b.onclick=()=>{allState.group=id;allState.page=0;renderAllStats()};subcategoryButtons.append(b)}
  
  const search=allState.search.trim().toLowerCase();
  const filtered=entries.filter(x=>(allState.group==='*'||(allState.section==='general'?generalCategory(x.stat)===allState.group:x.stat.split('/')[0]===allState.group))
    &&(allState.player==='*'||x.player===allState.player)
    &&(!search||(x.stat+' '+statName(x.stat)+' '+x.player+' '+(labels[x.stat.split('/')[0]]||'')).toLowerCase().includes(search)))
    .sort((a,b)=>allState.sort==='value'?b.value-a.value||a.stat.localeCompare(b.stat)||a.player.localeCompare(b.player):statName(a.stat).localeCompare(statName(b.stat))||b.value-a.value||a.player.localeCompare(b.player));
  const cards=[...new Set(filtered.map(e=>e.stat))];
  const size=24;allState.page=Math.max(0,Math.min(allState.page,Math.ceil(cards.length/size)-1));
  const table=node('table'),head=node('thead'),h=node('tr');table.className='statistics-table';for(const title of ['Kategorie','Minecraft-Statistik','Spieler','Wert','Einheit'])h.append(node('th',title));head.append(h);table.append(head);
  const body=node('tbody');
  for(const entry of filtered.filter(e=>cards.slice(allState.page*size,(allState.page+1)*size).includes(e.stat))){
    const type=entry.stat.split('/')[0],display=minecraftDisplay(entry.stat,entry.value);
    const tr=node('tr');tr.title=entry.stat;const category=node('td'),pill=node('span',labels[type]||type,'stat-category');category.append(pill);const name=node('td'),title=node('strong',statName(entry.stat)),id=node('small',entry.stat.split('/')[1].replace(/^minecraft:/,''));name.append(title,id);tr.append(category,name,node('td',entry.player),node('td',format(display.value)),node('td',display.unit));body.append(tr);
   }table.append(body);
  const grid=node('div',undefined,'stat-card-grid');
  for(const stat of cards.slice(allState.page*size,(allState.page+1)*size)){
   const ranking=statisticRanking(window.statsCloud.getRows(),stat),selected=allState.player==='*'?ranking[0]:ranking.find(e=>e.player===allState.player),display=selected?minecraftDisplay(stat,selected.value):null;
   const card=node('article',undefined,'stat-card'),type=stat.split('/')[0];card.append(node('span',labels[type]||type,'stat-card-kicker'),node('h3',statName(stat)));
   const value=node('div',undefined,'stat-card-value');value.append(node('strong',display?format(display.value):'–'),node('span',display?.unit||'Unbekannt'));card.append(value);
   card.append(node('p',allState.player==='*'?(selected?'Spitzenreiter: '+ranking.filter(e=>e.rank===1).map(e=>e.player).join(' · '):'Noch keine Daten'):(selected?selected.player+' · Platz '+selected.rank+' im Team':'Noch nicht übertragen'),'stat-card-person'));
   const compare=node('button','Rangliste ansehen →','button alt');compare.onclick=()=>{rankingState.stat=stat;rankingState.search='';rankingState.player=allState.player;renderCategories();activate(buttons.find(b=>b.dataset.tab==='rankings'))};card.append(compare);grid.append(card);
  }
  const details=node('details',undefined,'stat-details');details.append(node('summary','Werte als Detailtabelle anzeigen'),table);allTable.replaceChildren(grid,details);
  if(!cards.length)allTable.prepend(node('p','Für diese Unterkategorie und Auswahl wurden noch keine Statistiken übertragen.','empty'));
  allPrev.disabled=allState.page===0;allNext.disabled=(allState.page+1)*size>=cards.length;
  allCount.textContent=entries.length?`${window.statsCloud.sourceLabel()} · ${cards.length} Statistiken · Seite ${allState.page+1} / ${Math.max(1,Math.ceil(cards.length/size))}`:'Noch keine vollständigen Minecraft-Statistiken übertragen. Mod 0.4.3 installieren und einem Multiplayer-Server beitreten.';
}
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};
const categories={
  combat:{title:'Kampf & Tode',metric:s=>s.deaths,columns:[['Tode',s=>s.deaths],['Mobs besiegt',s=>s.mobKills],['Spieler besiegt',s=>s.playerKills]]},
  movement:{title:'Blöcke gelaufen & Sprünge',metric:s=>s.walkCm+s.sprintCm,columns:[['Gelaufen (Blöcke)',s=>blocksTravelled(s.walkCm)],['Gesprintet (Blöcke)',s=>blocksTravelled(s.sprintCm)],['Geschwommen (Blöcke)',s=>blocksTravelled(s.swimCm)],['Sprünge',s=>s.jumps]]}
};
function table(players,columns,metric){
  const t=node('table'),head=node('thead'),tr=node('tr');
  for(const label of ['Rang','Spieler',...columns.map(c=>c[0])])tr.append(node('th',label));head.append(tr);t.append(head);
  const body=node('tbody');let previous,rank=0;
  rankPlayers(players,metric).forEach((p,i)=>{
    const value=p.known?metric(p.stats):null;if(value!==previous){rank=i+1;previous=value;}
    if(selectedPlayer!=='*'&&p.player!==selectedPlayer)return;
    const row=node('tr');row.append(node('td',p.known?'#'+rank:'–'),node('td',p.player));
    for(const [,get] of columns)row.append(node('td',p.known?format(get(p.stats)):'–'));
    body.append(row);
  });t.append(body);return t;
}
const foodState={player:'*',item:'*'};
const foodNames={'minecraft:bread':'Brot','minecraft:cooked_beef':'Steak','minecraft:beef':'Rohes Rindfleisch','minecraft:carrot':'Karotte','minecraft:golden_carrot':'Goldene Karotte','minecraft:apple':'Apfel','minecraft:golden_apple':'Goldener Apfel','minecraft:enchanted_golden_apple':'Verzauberter goldener Apfel','minecraft:potato':'Kartoffel','minecraft:baked_potato':'Ofenkartoffel','minecraft:poisonous_potato':'Giftige Kartoffel','minecraft:cooked_porkchop':'Gebratenes Schweinefleisch','minecraft:porkchop':'Rohes Schweinefleisch','minecraft:cooked_chicken':'Gebratenes Hühnchen','minecraft:chicken':'Rohes Hühnchen','minecraft:cooked_mutton':'Gebratenes Hammelfleisch','minecraft:mutton':'Rohes Hammelfleisch','minecraft:cooked_rabbit':'Gebratenes Kaninchen','minecraft:rabbit':'Rohes Kaninchen','minecraft:cooked_salmon':'Gebratener Lachs','minecraft:salmon':'Roher Lachs','minecraft:cooked_cod':'Gebratener Kabeljau','minecraft:cod':'Roher Kabeljau','minecraft:sweet_berries':'Süßbeeren','minecraft:glow_berries':'Leuchtbeeren','minecraft:melon_slice':'Melonenscheibe','minecraft:cookie':'Keks','minecraft:pumpkin_pie':'Kürbiskuchen','minecraft:cake':'Kuchenstück','minecraft:honey_bottle':'Honigflasche','minecraft:dried_kelp':'Getrockneter Seetang','minecraft:rotten_flesh':'Verrottetes Fleisch','minecraft:spider_eye':'Spinnenauge','minecraft:chorus_fruit':'Chorusfrucht','minecraft:mushroom_stew':'Pilzsuppe','minecraft:beetroot_soup':'Borschtsch','minecraft:beetroot':'Rote Bete','minecraft:rabbit_stew':'Kaninchenragout','minecraft:suspicious_stew':'Verdächtige Suppe','minecraft:tropical_fish':'Tropenfisch','minecraft:pufferfish':'Kugelfisch'};
const foodName=id=>foodNames[id]||id.split(':').pop().replaceAll('_',' ');
function renderFood(players){
  const root=$('stats-food');root.replaceChildren(node('h2','Essen · Gesamtstatistik'));
  root.append(node('p','Gesamtstände der vorhandenen Minecraft-Serverhistorie pro Lebensmittel und Spieler, einschließlich der Zeit vor der Mod. Keine Wochenbegrenzung. Minecraft zählt Lebensmittel als „benutzt“; bei z. B. Karotten kann darin auch Anpflanzen enthalten sein. Kuchen zeigt gegessene Stücke, nicht gesetzte Kuchen.'));
  root.append(node('p',`${window.statsCloud.sourceLabel()} · ${players.filter(p=>p.known).length} Spieler mit Gesamtständen`,'note'));
  const summary=node('div',undefined,'scroll');root.append(summary);
  const toolbar=node('div',undefined,'nav');toolbar.style.margin='20px 0';
  const person=node('select');person.setAttribute('aria-label','Essen nach Spieler filtern');
  const food=node('select');food.setAttribute('aria-label','Lebensmittel auswählen');
  const fill=(select,items,current,label)=>{select.replaceChildren();for(const [value,name] of [['*',label],...items]){const o=node('option',name);o.value=value;select.append(o)}select.value=items.some(([id])=>id===current)?current:'*'};
  fill(person,players.map(p=>[p.player,p.player]),foodState.player,'Alle Spieler');
  const ids=[...new Set(players.flatMap(p=>Object.entries(p.items).filter(([,n])=>n>0).map(([id])=>id)))].sort((a,b)=>foodName(a).localeCompare(foodName(b),'de'));
  fill(food,ids.map(id=>[id,foodName(id)]),foodState.item,'Alle Lebensmittel');
  foodState.player=person.value;foodState.item=food.value;toolbar.append(person,food);root.append(toolbar);
  const ranked=players
    .map(p=>({...p,stats:foodState.item==='*'?p.items:{[foodState.item]:p.items[foodState.item]||0}}));
  summary.append(table(ranked,[[foodState.item==='*'?'Insgesamt benutzt / Kuchenstücke':foodName(foodState.item)+' insgesamt',foodTotal]],foodTotal));
  person.onchange=()=>selectPlayer(person.value);food.onchange=()=>{foodState.item=food.value;renderFood(players)};
  const t=node('table'),head=node('thead'),tr=node('tr');for(const title of ['Lebensmittel','Spieler','Insgesamt benutzt / Kuchenstücke'])tr.append(node('th',title));head.append(tr);t.append(head);
  const body=node('tbody');
  const entries=players.flatMap(p=>Object.entries(p.items).map(([id,count])=>({id,count,player:p.player})))
    .filter(x=>x.count>0&&(foodState.player==='*'||x.player===foodState.player)&&(foodState.item==='*'||x.id===foodState.item))
    .sort((a,b)=>foodName(a.id).localeCompare(foodName(b.id),'de')||b.count-a.count||a.player.localeCompare(b.player,'de'));
  for(const entry of entries){const row=node('tr'),name=node('td',foodName(entry.id));name.title=entry.id;row.append(name,node('td',entry.player),node('td',format(entry.count)));body.append(row)}
  t.append(body);const scroll=node('div',undefined,'scroll');scroll.append(t);root.append(scroll);
  if(!entries.length)root.append(node('p','Noch keine historischen Lebensmittel-Zähler für diese Auswahl übertragen.','empty'));
}

const blockName=id=>minecraftNames['block.'+id.replace(':','.')]||id.replace(/^minecraft:/,'').replaceAll('_',' ').replace(/\b[a-z]/g,c=>c.toUpperCase());
const blockState={type:'minecraft:mined',player:'*',item:'*'};
function renderBlocks(){
 const root=$('stats-blocks');root.replaceChildren(node('h2','Welche Blöcke werden am meisten gesetzt oder abgebaut?'));
 root.append(node('p','Vergangene abgebaute Blöcke stammen aus der gesamten Minecraft-Serverhistorie. Historisch benutzte Block-Items sind separat auswählbar: Sie können Platzierungen enthalten, sind aber keine bestätigte Bauzählung. Ein verlässlicher historischer Zähler gesetzter Blöcke fehlt in Minecraft. Erfasste Platzierungen seit Mod 0.4.3 bleiben separat; sie werden nicht mit historischen Nutzungen addiert.','note'));
 root.append(node('p',window.statsCloud.sourceLabel(),'note'));
 const entries=vanillaRows(window.statsCloud.getRows());
 const toolbar=node('div',undefined,'nav');root.append(toolbar);
 const select=(label,options,value,change)=>{const e=node('select');e.setAttribute('aria-label',label);for(const [v,l] of options){const o=node('option',l);o.value=v;e.append(o)}e.value=options.some(([v])=>v===value)?value:options[0][0];e.onchange=()=>{change(e.value);renderBlocks()};toolbar.append(e);return e.value};
 blockState.type=select('Block-Aktion',[['minecraft:mined','Abgebaut · gesamte Historie'],['minecraft:used','Block-Items benutzt · gesamte Historie'],['holzkopf:placed','Platzierungen · seit Mod 0.4.3']],blockState.type,v=>{blockState.type=v;blockState.item='*'});
 blockState.player=select('Blöcke nach Spieler filtern',[['*','Alle Spieler'],...[...new Set(entries.map(e=>e.player))].sort().map(p=>[p,p])],blockState.player,v=>selectPlayer(v));
 const blocks=entries.filter(e=>e.stat.startsWith(blockState.type+'/')&&(blockState.type!=='minecraft:used'||Object.hasOwn(minecraftNames,'block.'+e.stat.split('/')[1].replace(':','.'))));
 blockState.item=select('Block auswählen',[['*','Alle Blöcke'],...[...new Set(blocks.map(e=>e.stat.split('/')[1]))].sort((a,b)=>blockName(a).localeCompare(blockName(b))).map(id=>[id,blockName(id)])],blockState.item,v=>blockState.item=v);
 const filtered=blocks.filter(e=>(blockState.player==='*'||e.player===blockState.player)&&(blockState.item==='*'||e.stat.split('/')[1]===blockState.item));
 const totals=new Map();for(const e of filtered){const id=e.stat.split('/')[1];totals.set(id,(totals.get(id)||0)+e.value)}
 const best=[...totals].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0];
 root.append(node('p',best?'Häufigster Block dieser Auswahl: '+blockName(best[0])+' · '+format(best[1])+' Vorgänge':'Noch keine Blockdaten für diese Auswahl. Mod 0.4.3 erfasst neue Platzierungen.','note'));
 const t=node('table'),h=node('tr');for(const v of ['Rang','Block','Spieler',blockState.type==='holzkopf:placed'?'Erfasst gesetzt':blockState.type==='minecraft:mined'?'Historisch abgebaut':'Historisch benutzt'])h.append(node('th',v));const head=node('thead');head.append(h);t.append(head);const body=node('tbody');
 filtered.sort((a,b)=>b.value-a.value||a.stat.localeCompare(b.stat)||a.player.localeCompare(b.player)).forEach((e,i)=>{const r=node('tr');for(const v of ['#'+(i+1),blockName(e.stat.split('/')[1]),e.player,format(e.value)])r.append(node('td',v));body.append(r)});t.append(body);const scroll=node('div',undefined,'scroll');scroll.append(t);root.append(scroll);
}


const rankingState={stat:'minecraft:custom/minecraft:deaths',player:'*',search:''};
function renderStatisticRanking(root){
 root.append(node('h3','Rangliste für jede Statistik'));
 root.append(node('p','Statistik auswählen und alle Spieler vergleichen. Einzelne Spieler lassen sich mit ihrem Rang im gesamten Team anzeigen. Fehlende Werte bleiben unbekannt.'));
 const toolbar=node('div',undefined,'stat-filters'),search=node('input');search.type='search';search.placeholder='Statistik suchen …';search.setAttribute('aria-label','Ranglisten-Statistik suchen');search.value=rankingState.search;
 const stats=node('select');stats.setAttribute('aria-label','Statistik für Rangliste auswählen');
 const person=node('select');person.setAttribute('aria-label','Rangliste nach Spieler filtern');
 const statLabel=node('label','Statistik: ');statLabel.append(stats);const playerLabel=node('label','Spieler: ');playerLabel.append(person);toolbar.append(search,statLabel,playerLabel);root.append(toolbar);
 const all=vanillaRows(window.statsCloud.getRows());
 for(const [id,label] of [['*','Alle Spieler'],...[...new Set(window.statsCloud.getRows().map(r=>r.player))].sort().map(p=>[p,p])]){const o=node('option',label);o.value=id;person.append(o)}
 person.value=[...person.options].some(o=>o.value===rankingState.player)?rankingState.player:'*';rankingState.player=person.value;
 const spotlight=node('div',undefined,'stat-spotlight'),count=node('p',undefined,'note'),results=node('div',undefined,'ranking-results');root.append(spotlight,count,results);
 const draw=()=>{
  const stat=rankingState.stat,ranked=statisticRanking(window.statsCloud.getRows(),stat);
  const filtered=ranked.filter(e=>rankingState.player==='*'||e.player===rankingState.player);
  spotlight.replaceChildren();const leader=ranked[0],top=leader?minecraftDisplay(leader.stat,leader.value):null;
  for(const [label,value,detail] of [['Spitzenreiter',leader?ranked.filter(e=>e.rank===1).map(e=>e.player).join(' · '):'Noch offen',top?format(top.value)+' '+top.unit:'Warte auf Synchronisierung'],['Vergleich',String(ranked.length),'Spieler mit übertragenem Wert'],['Deine Auswahl',rankingState.player==='*'?'Gesamtes Team':rankingState.player,rankingState.player==='*'?'Alle Plätze im Vergleich':filtered[0]?'Platz '+filtered[0].rank+' im gesamten Team':'Noch kein Wert übertragen']]){const card=node('article',undefined,'stat-summary');card.append(node('span',label),node('strong',value),node('small',detail));spotlight.append(card)}
  
  count.textContent=window.statsCloud.sourceLabel()+' · '+ranked.length+' Spieler mit diesem Zähler · Rang im gesamten Team';
  const t=node('table'),head=node('thead'),h=node('tr');for(const v of ['Platz','Spieler',stats.selectedOptions[0]?.textContent||'Statistik','Einheit','Vergleich'])h.append(node('th',v));head.append(h);t.append(head);const body=node('tbody');
  for(const e of filtered){const display=minecraftDisplay(e.stat,e.value),r=node('tr');r.className=e.rank===1?'rank-first':'';const badge=node('span','#'+e.rank,'rank-badge');const place=node('td');place.append(badge);r.append(place,node('td',e.player),node('td',format(display.value)),node('td',display.unit));const c=node('td'),track=node('div',undefined,'compare-track'),bar=node('i');const percent=leader?.value>0?e.value/leader.value*100:0;bar.style.width=percent+'%';track.setAttribute('role','img');track.setAttribute('aria-label',format(percent)+' Prozent des Spitzenwerts');track.append(bar);c.append(track);r.append(c);body.append(r)}

  if(rankingState.player!=='*'&&!filtered.length){const r=node('tr');for(const v of ['–',rankingState.player,'Noch nicht übertragen','–','–'])r.append(node('td',v));body.append(r)}
  t.className='ranking-table';t.append(body);
  const chart=node('div',undefined,'ranking-chart');
  for(const e of filtered){const display=minecraftDisplay(e.stat,e.value),row=node('article',undefined,e.rank===1?'comparison-row comparison-first':'comparison-row'),name=node('div',undefined,'comparison-name');name.append(node('span','#'+e.rank,'rank-badge'),node('strong',e.player));const visual=node('div',undefined,'comparison-visual'),value=node('div',undefined,'comparison-value');value.append(node('strong',format(display.value)),node('span',display.unit));const track=node('div',undefined,'compare-track'),bar=node('i');const percent=leader?.value>0?e.value/leader.value*100:0;bar.style.width=percent+'%';track.setAttribute('role','img');track.setAttribute('aria-label',format(percent)+' Prozent des Spitzenwerts');track.append(bar);visual.append(value,track);row.append(name,visual);chart.append(row)}
  if(rankingState.player!=='*'&&!filtered.length)chart.append(node('p','Für '+rankingState.player+' wurde noch kein Wert übertragen.','empty'));
  const details=node('details',undefined,'stat-details');details.append(node('summary','Exakte Werte als Tabelle'),t);results.replaceChildren(chart,details);if(!ranked.length)results.append(node('p','Noch keine Werte für diese Statistik vorhanden.','empty'));
 };
 const fill=()=>{
  const q=rankingState.search.trim().toLowerCase();
  const ids=[...new Set(all.map(e=>e.stat))].filter(id=>(id+' '+statName(id)+' '+(labels[id.split('/')[0]]||'')).toLowerCase().includes(q)).sort((a,b)=>statName(a).localeCompare(statName(b))||a.localeCompare(b));
  stats.replaceChildren();for(const id of ids){const o=node('option',(labels[id.split('/')[0]]||id.split('/')[0])+' · '+statName(id));o.value=id;stats.append(o)}
  if(ids.includes(rankingState.stat))stats.value=rankingState.stat;else rankingState.stat=ids[0]||'';
  draw();
 };
 search.oninput=()=>{rankingState.search=search.value;fill()};stats.onchange=()=>{rankingState.stat=stats.value;draw()};person.onchange=()=>selectPlayer(person.value);fill();
}

function renderCategories(){
  renderPlayerTabs();
  renderAllStats();
  renderBlocks();
  const rows=window.statsCloud.getRows(),players=playerTotals(rows),known=players.filter(p=>p.known);
  const foodPlayers=historicalFoodTotals(rows,Object.keys(foodNames)).map(p=>({...p,stats:p.items}));
  renderFood(foodPlayers);
  for(const [id,category] of Object.entries(categories)){
    const target=$('stats-'+id);target.replaceChildren();target.append(node('h2',category.title));
    const select=node('select');select.setAttribute('aria-label','Rangliste sortieren: '+category.title);
    category.columns.forEach(([label],i)=>{const o=node('option',label);o.value=i;select.append(o)});
    select.value=String(sortSelection[id]||0);
    const note=node('p','Sortieren nach: ');note.append(select);target.append(note);
    const scroll=node('div',undefined,'scroll');target.append(scroll);
    const draw=()=>scroll.replaceChildren(table(players,category.columns,category.columns[Number(select.value)][1]));
    select.onchange=()=>{sortSelection[id]=Number(select.value);draw()};draw();
    if(!known.length)target.append(node('p','Noch keine Minecraft-Zähler vorhanden. Mod 0.4.3 installieren, dem Server beitreten und die erste Synchronisierung abwarten. Alte Daten bleiben „–“, nicht null Ereignisse.','empty'));
  }
  const target=$('stats-rankings');target.replaceChildren(node('h2','Alle Ranglisten'));
  renderStatisticRanking(target);
  target.append(node('h3','Die Holzkopfarmy-Rekorde'));
  const grid=node('div',undefined,'record-grid');
  const awards=[['Meiste Tode',s=>s.deaths,'Tode'],['Größter Hunger',foodTotal,'Lebensmittel-Nutzungen / Kuchenstücke'],['Meiste Sprünge',s=>s.jumps,'Sprünge'],['Längste Laufstrecke',s=>blocksTravelled(s.walkCm+s.sprintCm),'Blöcke'],['Meiste Mobs besiegt',s=>s.mobKills,'Mobs'],['Meiste Tiere gezüchtet',s=>s.breeding,'Züchtungen'],['Meiste Fische gefangen',s=>s.fishCaught,'Fische'],['Meiste Handelsgeschäfte',s=>s.trades,'Handelsgeschäfte']];
  for(const [label,metric,unit] of awards){
    const card=node('article',undefined,'metric');card.append(node('span',label));
    const sorted=rankPlayers(label==='Größter Hunger'?foodPlayers.filter(p=>p.known):known,metric),best=sorted[0];
    card.append(node('strong',best?format(metric(best.stats)):'–'));
    card.append(node('p',best?sorted.filter(p=>metric(p.stats)===metric(best.stats)).map(p=>p.player).join(' · '):'Noch keine Daten','record-player'));
    card.append(node('span',unit));grid.append(card);
  }target.append(grid);
  if(known.length){const at=Math.max(...known.map(p=>p.sampledAt));$('gameStatsStatus').textContent=`${window.statsCloud.sourceLabel()} · ${known.length} Spieler mit Minecraft-Zählern · letzter Stand ${new Date(at).toLocaleString('de-CH')}`;}
  else $('gameStatsStatus').textContent='Die neuen Zähler benötigen Mod 0.4.3. Noch nicht übertragene Werte werden als „–“ angezeigt.';
}
const buttons=[...document.querySelectorAll('.tabbar [role=tab]')];
function activate(button){
  for(const b of buttons){const active=b===button;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;$(b.getAttribute('aria-controls')).hidden=!active;}
  $('gameStatsNote').hidden=['overview','team','food','blocks'].includes(button.dataset.tab);
  history.replaceState(null,'','#'+button.dataset.tab);
}
buttons.forEach((button,i)=>{
  button.onclick=()=>activate(button);
  button.onkeydown=e=>{let index;if(e.key==='ArrowRight')index=(i+1)%buttons.length;else if(e.key==='ArrowLeft')index=(i+buttons.length-1)%buttons.length;else if(e.key==='Home')index=0;else if(e.key==='End')index=buttons.length-1;else return;e.preventDefault();activate(buttons[index]);buttons[index].focus();};
});
$('openLiveLogin').onclick=()=>{activate(buttons.find(b=>b.dataset.tab==='team'));$('cloudEmail').focus()};
activate(buttons.find(b=>b.dataset.tab===location.hash.slice(1))||buttons[0]);
$('player').addEventListener('change',()=>{const value=$('player').value;if(value!==selectedPlayer)selectPlayer(value)});
window.addEventListener('stats-data-change',renderCategories);renderCategories();
