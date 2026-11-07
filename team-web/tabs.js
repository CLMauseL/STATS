import {playerTotals,rankPlayers,foodTotal,blocksTravelled} from './stats-model.js';
const $=id=>document.getElementById(id);
const format=n=>n.toLocaleString('de-CH',{maximumFractionDigits:2});
const sortSelection={};
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};
const categories={
  food:{title:'Wer hat am meisten gegessen?',metric:foodTotal,columns:[['Essen gesamt',foodTotal],['Nahrung',s=>s.foodEaten],['Kuchenstücke',s=>s.cakeSlices]]},
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
function renderCategories(){
  const rows=window.statsCloud.getRows(),players=playerTotals(rows),known=players.filter(p=>p.known);
  for(const [id,category] of Object.entries(categories)){
    const target=$('stats-'+id);target.replaceChildren();target.append(node('h2',category.title));
    const select=node('select');select.setAttribute('aria-label','Rangliste sortieren: '+category.title);
    category.columns.forEach(([label],i)=>{const o=node('option',label);o.value=i;select.append(o)});
    select.value=String(sortSelection[id]||0);
    const note=node('p','Sortieren nach: ');note.append(select);target.append(note);
    const scroll=node('div',undefined,'scroll');target.append(scroll);
    const draw=()=>scroll.replaceChildren(table(players,category.columns,category.columns[Number(select.value)][1]));
    select.onchange=()=>{sortSelection[id]=Number(select.value);draw()};draw();
    if(!known.length)target.append(node('p','Noch keine Minecraft-Zähler vorhanden. Mod 0.4.0 installieren, dem Server beitreten und die erste Synchronisierung abwarten. Alte Daten bleiben „–“, nicht null Ereignisse.','empty'));
  }
  const target=$('stats-rankings');target.replaceChildren(node('h2','Die Holzkopfarmy-Rekorde'));
  const grid=node('div',undefined,'record-grid');
  const awards=[['Meiste Tode',s=>s.deaths,'Tode'],['Größter Hunger',foodTotal,'Portionen'],['Meiste Sprünge',s=>s.jumps,'Sprünge'],['Längste Laufstrecke',s=>blocksTravelled(s.walkCm+s.sprintCm),'Blöcke'],['Meiste Mobs besiegt',s=>s.mobKills,'Mobs'],['Meiste Tiere gezüchtet',s=>s.breeding,'Züchtungen'],['Meiste Fische gefangen',s=>s.fishCaught,'Fische'],['Meiste Handelsgeschäfte',s=>s.trades,'Handelsgeschäfte']];
  for(const [label,metric,unit] of awards){
    const card=node('article',undefined,'metric');card.append(node('span',label));
    const sorted=rankPlayers(known,metric),best=sorted[0];
    card.append(node('strong',best?format(metric(best.stats)):'–'));
    card.append(node('p',best?sorted.filter(p=>metric(p.stats)===metric(best.stats)).map(p=>p.player).join(' · '):'Noch keine Daten','record-player'));
    card.append(node('span',unit));grid.append(card);
  }target.append(grid);
  if(known.length){const at=Math.max(...known.map(p=>p.sampledAt));$('gameStatsStatus').textContent=`${window.statsCloud.sourceLabel()} · ${known.length} Spieler mit Minecraft-Zählern · letzter Stand ${new Date(at).toLocaleString('de-CH')}`;}
  else $('gameStatsStatus').textContent='Die neuen Zähler benötigen Mod 0.4.0. Noch nicht übertragene Werte werden als „–“ angezeigt.';
}
const buttons=[...document.querySelectorAll('[role=tab]')];
function activate(button){
  for(const b of buttons){const active=b===button;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;$(b.getAttribute('aria-controls')).hidden=!active;}
  $('gameStatsNote').hidden=['overview','team'].includes(button.dataset.tab);
  history.replaceState(null,'','#'+button.dataset.tab);
}
buttons.forEach((button,i)=>{
  button.onclick=()=>activate(button);
  button.onkeydown=e=>{let index;if(e.key==='ArrowRight')index=(i+1)%buttons.length;else if(e.key==='ArrowLeft')index=(i+buttons.length-1)%buttons.length;else if(e.key==='Home')index=0;else if(e.key==='End')index=buttons.length-1;else return;e.preventDefault();activate(buttons[index]);buttons[index].focus();};
});
activate(buttons.find(b=>b.dataset.tab===location.hash.slice(1))||buttons[0]);
window.addEventListener('stats-data-change',renderCategories);renderCategories();
