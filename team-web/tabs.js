import {playerTotals,rankPlayers,foodTotal,blocksTravelled,vanillaRows,consumptionTotals} from './stats-model.js?v=0.4.2';
const $=id=>document.getElementById(id);
const format=n=>n.toLocaleString('de-CH',{maximumFractionDigits:2});
const sortSelection={};
const allState={search:'',group:'*',player:'*',page:0};
const labels={'minecraft:custom':'Allgemein','minecraft:mined':'Blöcke abgebaut','minecraft:crafted':'Items hergestellt','minecraft:used':'Items benutzt','minecraft:broken':'Werkzeuge zerbrochen','minecraft:picked_up':'Items aufgesammelt','minecraft:dropped':'Items weggeworfen','minecraft:killed':'Mobs besiegt','minecraft:killed_by':'Getötet durch'};
let allToolbar,allSearch,allGroup,allPlayer,allTable,allCount,allPrev,allNext;
function renderAllStats(){
  const root=$('stats-all');
  if(!allToolbar){
    root.append(node('h2','Alle Minecraft-Statistiken'));
    root.append(node('p','Alle vom Multiplayer-Server gelieferten Zähler. Suche nach Statistik-, Block-, Item- oder Mob-ID. Fehlende Zähler sind noch nicht übertragen; ein fehlender Eintrag bedeutet nicht automatisch null.'));
    allToolbar=node('div',undefined,'nav');allSearch=node('input');allSearch.type='search';allSearch.placeholder='Suchen, z. B. diamond, jump, damage …';allSearch.setAttribute('aria-label','Statistiken durchsuchen');
    allGroup=node('select');allGroup.setAttribute('aria-label','Statistikkategorie');
    allPlayer=node('select');allPlayer.setAttribute('aria-label','Statistiken nach Spieler filtern');
    allToolbar.append(allSearch,allGroup,allPlayer);root.append(allToolbar);
    allCount=node('p',undefined,'note');allTable=node('div',undefined,'scroll');root.append(allCount,allTable);
    const pager=node('div',undefined,'nav');allPrev=node('button','← Zurück','button alt');allNext=node('button','Weiter →','button alt');pager.append(allPrev,allNext);root.append(pager);
    allSearch.oninput=()=>{allState.search=allSearch.value;allState.page=0;renderAllStats()};
    allGroup.onchange=()=>{allState.group=allGroup.value;allState.page=0;renderAllStats()};
    allPlayer.onchange=()=>{allState.player=allPlayer.value;allState.page=0;renderAllStats()};
    allPrev.onclick=()=>{allState.page--;renderAllStats()};allNext.onclick=()=>{allState.page++;renderAllStats()};
  }
  const entries=vanillaRows(window.statsCloud.getRows());
  const fill=(select,values,selected,first)=>{select.replaceChildren();for(const [value,label] of [['*',first],...values]){const o=node('option',label);o.value=value;select.append(o)}select.value=values.some(([v])=>v===selected)?selected:'*';};
  fill(allGroup,[...new Set(entries.map(x=>x.stat.split('/')[0]))].sort().map(k=>[k,labels[k]||k]),allState.group,'Alle Kategorien');
  fill(allPlayer,[...new Set(entries.map(x=>x.player))].sort().map(p=>[p,p]),allState.player,'Alle Spieler');
  allState.group=allGroup.value;allState.player=allPlayer.value;
  const search=allState.search.trim().toLowerCase();
  const filtered=entries.filter(x=>(allState.group==='*'||x.stat.split('/')[0]===allState.group)
    &&(allState.player==='*'||x.player===allState.player)
    &&(!search||(x.stat+' '+x.player+' '+(labels[x.stat.split('/')[0]]||'')).toLowerCase().includes(search)))
    .sort((a,b)=>a.stat.localeCompare(b.stat)||b.value-a.value||a.player.localeCompare(b.player));
  const size=100;allState.page=Math.max(0,Math.min(allState.page,Math.ceil(filtered.length/size)-1));
  const table=node('table'),head=node('thead'),h=node('tr');for(const title of ['Kategorie','Statistik / ID','Spieler','Wert','Einheit'])h.append(node('th',title));head.append(h);table.append(head);
  const body=node('tbody');
  for(const entry of filtered.slice(allState.page*size,(allState.page+1)*size)){
    const type=entry.stat.split('/')[0],id=entry.stat.slice(type.length+1),distance=type==='minecraft:custom'&&id.endsWith('_one_cm');
    const tr=node('tr');for(const v of [labels[type]||type,id,entry.player,format(distance?entry.value/100:entry.value),distance?'Blöcke':'Minecraft-Zähler'])tr.append(node('td',v));body.append(tr);
  }table.append(body);allTable.replaceChildren(table);
  allPrev.disabled=allState.page===0;allNext.disabled=(allState.page+1)*size>=filtered.length;
  allCount.textContent=entries.length?`${window.statsCloud.sourceLabel()} · ${filtered.length} Treffer · Seite ${allState.page+1} / ${Math.max(1,Math.ceil(filtered.length/size))}`:'Noch keine vollständigen Minecraft-Statistiken übertragen. Mod 0.4.2 installieren und einem Multiplayer-Server beitreten.';
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
    const row=node('tr');row.append(node('td',p.known?'#'+rank:'–'),node('td',p.player));
    for(const [,get] of columns)row.append(node('td',p.known?format(get(p.stats)):'–'));
    body.append(row);
  });t.append(body);return t;
}
const foodState={player:'*',item:'*'};
const foodNames={'minecraft:bread':'Brot','minecraft:cooked_beef':'Steak','minecraft:beef':'Rohes Rindfleisch','minecraft:carrot':'Karotte','minecraft:golden_carrot':'Goldene Karotte','minecraft:apple':'Apfel','minecraft:golden_apple':'Goldener Apfel','minecraft:enchanted_golden_apple':'Verzauberter goldener Apfel','minecraft:potato':'Kartoffel','minecraft:baked_potato':'Ofenkartoffel','minecraft:poisonous_potato':'Giftige Kartoffel','minecraft:cooked_porkchop':'Gebratenes Schweinefleisch','minecraft:porkchop':'Rohes Schweinefleisch','minecraft:cooked_chicken':'Gebratenes Hühnchen','minecraft:chicken':'Rohes Hühnchen','minecraft:cooked_mutton':'Gebratenes Hammelfleisch','minecraft:mutton':'Rohes Hammelfleisch','minecraft:cooked_rabbit':'Gebratenes Kaninchen','minecraft:rabbit':'Rohes Kaninchen','minecraft:cooked_salmon':'Gebratener Lachs','minecraft:salmon':'Roher Lachs','minecraft:cooked_cod':'Gebratener Kabeljau','minecraft:cod':'Roher Kabeljau','minecraft:sweet_berries':'Süßbeeren','minecraft:glow_berries':'Leuchtbeeren','minecraft:melon_slice':'Melonenscheibe','minecraft:cookie':'Keks','minecraft:pumpkin_pie':'Kürbiskuchen','minecraft:cake':'Kuchenstück','minecraft:honey_bottle':'Honigflasche','minecraft:dried_kelp':'Getrockneter Seetang','minecraft:rotten_flesh':'Verrottetes Fleisch','minecraft:spider_eye':'Spinnenauge','minecraft:chorus_fruit':'Chorusfrucht','minecraft:mushroom_stew':'Pilzsuppe','minecraft:beetroot_soup':'Borschtsch','minecraft:beetroot':'Rote Bete','minecraft:rabbit_stew':'Kaninchenragout','minecraft:suspicious_stew':'Verdächtige Suppe','minecraft:tropical_fish':'Tropenfisch','minecraft:pufferfish':'Kugelfisch'};
const foodName=id=>foodNames[id]||id.split(':').pop().replaceAll('_',' ');
function renderFood(players){
  const root=$('stats-food');root.replaceChildren(node('h2','Was wurde wirklich gegessen?'));
  root.append(node('p','Nur abgeschlossene Verzehrvorgänge in Multiplayer seit Mod 0.4.2. Aufheben, Herstellen, Anpflanzen, bloßes Benutzen und abgebrochenes Essen zählen nicht. Die alte Item-Nutzungsstatistik wird dafür nicht verwendet. Kuchen wird in Stücken gezählt.'));
  root.append(node('p',`${window.statsCloud.sourceLabel()} · ${players.filter(p=>p.known).reduce((n,p)=>n+p.days,0)} erfasste Spieler-Server-Tage`,'note'));
  const summary=node('div',undefined,'scroll');root.append(summary);
  const toolbar=node('div',undefined,'nav');toolbar.style.margin='20px 0';
  const person=node('select');person.setAttribute('aria-label','Essen nach Spieler filtern');
  const food=node('select');food.setAttribute('aria-label','Lebensmittel auswählen');
  const fill=(select,items,current,label)=>{select.replaceChildren();for(const [value,name] of [['*',label],...items]){const o=node('option',name);o.value=value;select.append(o)}select.value=items.some(([id])=>id===current)?current:'*'};
  fill(person,players.map(p=>[p.player,p.player]),foodState.player,'Alle Spieler');
  const ids=[...new Set(players.flatMap(p=>Object.entries(p.items).filter(([,n])=>n>0).map(([id])=>id)))].sort((a,b)=>foodName(a).localeCompare(foodName(b),'de'));
  fill(food,ids.map(id=>[id,foodName(id)]),foodState.item,'Alle Lebensmittel');
  foodState.player=person.value;foodState.item=food.value;toolbar.append(person,food);root.append(toolbar);
  const ranked=players.filter(p=>foodState.player==='*'||p.player===foodState.player)
    .map(p=>({...p,stats:foodState.item==='*'?p.items:{[foodState.item]:p.items[foodState.item]||0}}));
  summary.append(table(ranked,[[foodState.item==='*'?'Tatsächlich verzehrt':foodName(foodState.item)+' verzehrt',foodTotal]],foodTotal));
  person.onchange=()=>{foodState.player=person.value;renderFood(players)};food.onchange=()=>{foodState.item=food.value;renderFood(players)};
  const t=node('table'),head=node('thead'),tr=node('tr');for(const title of ['Lebensmittel','Spieler','Verzehrt'])tr.append(node('th',title));head.append(tr);t.append(head);
  const body=node('tbody');
  const entries=players.flatMap(p=>Object.entries(p.items).map(([id,count])=>({id,count,player:p.player})))
    .filter(x=>x.count>0&&(foodState.player==='*'||x.player===foodState.player)&&(foodState.item==='*'||x.id===foodState.item))
    .sort((a,b)=>foodName(a.id).localeCompare(foodName(b.id),'de')||b.count-a.count||a.player.localeCompare(b.player,'de'));
  for(const entry of entries){const row=node('tr'),name=node('td',foodName(entry.id));name.title=entry.id;row.append(name,node('td',entry.player),node('td',format(entry.count)));body.append(row)}
  t.append(body);const scroll=node('div',undefined,'scroll');scroll.append(t);root.append(scroll);
  if(!entries.length)root.append(node('p','Noch keine abgeschlossenen Essvorgänge für diese Auswahl erfasst. Alte Daten ohne Verzehr-Aufzeichnung bleiben unbekannt.','empty'));
}
function renderCategories(){
  renderAllStats();
  const rows=window.statsCloud.getRows(),players=playerTotals(rows),known=players.filter(p=>p.known);
  const foodPlayers=consumptionTotals(rows).map(p=>({...p,stats:p.items}));
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
    if(!known.length)target.append(node('p','Noch keine Minecraft-Zähler vorhanden. Mod 0.4.2 installieren, dem Server beitreten und die erste Synchronisierung abwarten. Alte Daten bleiben „–“, nicht null Ereignisse.','empty'));
  }
  const target=$('stats-rankings');target.replaceChildren(node('h2','Die Holzkopfarmy-Rekorde'));
  const grid=node('div',undefined,'record-grid');
  const awards=[['Meiste Tode',s=>s.deaths,'Tode'],['Größter Hunger',foodTotal,'Portionen'],['Meiste Sprünge',s=>s.jumps,'Sprünge'],['Längste Laufstrecke',s=>blocksTravelled(s.walkCm+s.sprintCm),'Blöcke'],['Meiste Mobs besiegt',s=>s.mobKills,'Mobs'],['Meiste Tiere gezüchtet',s=>s.breeding,'Züchtungen'],['Meiste Fische gefangen',s=>s.fishCaught,'Fische'],['Meiste Handelsgeschäfte',s=>s.trades,'Handelsgeschäfte']];
  for(const [label,metric,unit] of awards){
    const card=node('article',undefined,'metric');card.append(node('span',label));
    const sorted=rankPlayers(label==='Größter Hunger'?foodPlayers.filter(p=>p.known):known,metric),best=sorted[0];
    card.append(node('strong',best?format(metric(best.stats)):'–'));
    card.append(node('p',best?sorted.filter(p=>metric(p.stats)===metric(best.stats)).map(p=>p.player).join(' · '):'Noch keine Daten','record-player'));
    card.append(node('span',unit));grid.append(card);
  }target.append(grid);
  if(known.length){const at=Math.max(...known.map(p=>p.sampledAt));$('gameStatsStatus').textContent=`${window.statsCloud.sourceLabel()} · ${known.length} Spieler mit Minecraft-Zählern · letzter Stand ${new Date(at).toLocaleString('de-CH')}`;}
  else $('gameStatsStatus').textContent='Die neuen Zähler benötigen Mod 0.4.2. Noch nicht übertragene Werte werden als „–“ angezeigt.';
}
const buttons=[...document.querySelectorAll('[role=tab]')];
function activate(button){
  for(const b of buttons){const active=b===button;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;$(b.getAttribute('aria-controls')).hidden=!active;}
  $('gameStatsNote').hidden=['overview','team','food'].includes(button.dataset.tab);
  history.replaceState(null,'','#'+button.dataset.tab);
}
buttons.forEach((button,i)=>{
  button.onclick=()=>activate(button);
  button.onkeydown=e=>{let index;if(e.key==='ArrowRight')index=(i+1)%buttons.length;else if(e.key==='ArrowLeft')index=(i+buttons.length-1)%buttons.length;else if(e.key==='Home')index=0;else if(e.key==='End')index=buttons.length-1;else return;e.preventDefault();activate(buttons[index]);buttons[index].focus();};
});
activate(buttons.find(b=>b.dataset.tab===location.hash.slice(1))||buttons[0]);
window.addEventListener('stats-data-change',renderCategories);renderCategories();

