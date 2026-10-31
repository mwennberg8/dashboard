/* js/batteri.js — Batteriet: laddregelns logg, raden i energirutan, På nu-raden, laddregeln i popupen och sparandet till den dyra perioden.
 *
 * Filen innehåller BARA funktionsdeklarationer. Konstanter, tillstånd och allt
 * som körs direkt vid laddning ligger i js/start.js, som laddas sist, under
 * rubriken [batteri.js]. En funktion går att anropa oavsett vilken fil den står
 * i, men kod som körs vid laddning kan här anropa en funktion i en fil som inte
 * hunnit laddas. Lägg den därför aldrig här.
 */

function rlDemo(){
  var dag=function(off){var d=svDatum(Date.now()-off*86400000);return {y:d.y,m:d.m,d:d.d,ms:svMidnatt(d.y,d.m,d.d),k:d.y+'-'+String(d.m).padStart(2,'0')+'-'+String(d.d).padStart(2,'0')};};
  var L={v:1,d:{},f:[]},H=3600000;
  for(var o=0;o<4;o++){var D=dag(o);
    L.d[D.k]=Array.from({length:24},function(_,h){return Math.round((0.95+0.35*Math.sin((h-4)/24*Math.PI*2)+(h>=17&&h<21?0.9:0)+(h>=7&&h<9?0.4:0)+o*0.05)*1000)/1000;});
    L.f.push({t0:D.ms+10.5*H,t1:D.ms+14*H,typ:'spara',start:0,spara:D.ms+10.5*H,stopp:D.ms+17*H,kwh:0,vinst:5.8-o,soc:40+o*5,fragad:true,bokad:o!==1});
    if(o===2)L.f.push({t0:D.ms+1*H,t1:D.ms+2*H,typ:'ladda',start:D.ms+2*H,spara:D.ms+5*H,stopp:D.ms+7*H,kwh:9.5,vinst:7.4,soc:22,fragad:true,bokad:false});}
  return L;
}
async function rlHamta(tvinga){
  if(_rlLaddar)return;
  if(!tvinga&&_rl&&Date.now()-_rlAt<120000)return;
  if(typeof SOURCE!=='undefined'&&SOURCE==='demo-data'){_rl=rlDemo();_rlAt=Date.now();return;}
  _rlLaddar=true;
  try{var L=await logicList();var v=logicArr(L).find(function(x){return x&&x.name==='battladd_logg';});
    _rl=v&&v.value?JSON.parse(String(v.value)):{v:1,d:{},f:[],tom:true};_rlAt=Date.now();}
  catch(e){_rl={v:1,d:{},f:[],fel:(e&&e.message)||'kunde inte läsa loggen'};}
  finally{_rlLaddar=false;try{if(_dlgWhich==='regellogg'){var b=$('dlg-body');if(b)b.innerHTML=rlPopup();}}catch(e){}}
}
function rlValjDag(o){_rlDag=o;var b=$('dlg-body');if(b)b.innerHTML=rlPopup();}
/* Ett dygn: {k, ms (midnatt), slut (nästa midnatt)} för o dygn bakåt. */
function rlDygn(o){var d=svDatum(Date.now()-o*86400000),ms=svMidnatt(d.y,d.m,d.d),n=svMidnatt(d.y,d.m,d.d+1);
  return {k:d.y+'-'+String(d.m).padStart(2,'0')+'-'+String(d.d).padStart(2,'0'),ms:ms,slut:n};}
/* Batteriets laddnivå under dygnet: sjudygnsloggen från Insights, och för idag
   även den lokala historiken (tätare, och den senaste timmen). */
function rlSoc(D){
  var ut=[];
  [(typeof HIST7!=='undefined'&&HIST7.battpct)||[],(D.slut>Date.now()-3600000)?(HIST.batt||[]):[]].forEach(function(a){
    a.forEach(function(p){if(p&&p.t>=D.ms&&p.t<=D.slut&&isFinite(p.v))ut.push({t:p.t,v:p.v});});});
  ut.sort(function(a,b){return a.t-b.t;});
  return ut;
}
/* v699: bokat och föreslaget som egna segmentrader under grafen, i stället
   för band över hela grafen. Ett förslag ger en eller två delar. */
function rlDelar(e){
  var d=[],b=Number(e.stopp)||0;
  if(e.start)d.push({typ:'ladda',a:+e.start,b:+(e.spara||b)||0});
  if(e.spara)d.push({typ:'spara',a:+e.spara,b:b});
  else if(!e.start&&e.t0)d.push({typ:'spara',a:+e.t0,b:b});
  return d;
}
/* Delarna klipps mot dygnet och läggs i rader så att överlappande inte ritas
   ovanpå varandra. Saknas slut (en ren starttid) ritas en timme, öppen. */
function rlSpar(lista,D){
  var ut=[],sett={};
  lista.forEach(function(q){
    var oppen=!(q.b>q.a),b=oppen?q.a+3600000:q.b,k=q.typ+'|'+q.a+'|'+(oppen?0:q.b);
    if(sett[k])return;sett[k]=1;
    var a2=Math.max(D.ms,q.a),b2=Math.min(D.slut,b);if(b2<=a2)return;
    ut.push({typ:q.typ,a:q.a,b:b,a2:a2,b2:b2,oppen:oppen,kalla:q.kalla||'',e:q.e||null});});
  ut.sort(function(x,y){return x.a2-y.a2||x.b2-y.b2;});
  var slut=[];
  ut.forEach(function(q){var r=0;while(r<slut.length&&slut[r]>q.a2)r++;slut[r]=q.b2;q.rad=r;});
  return {lista:ut,rader:Math.max(1,slut.length)};
}
/* Det som var bokat: förslag som bokades, plus den bokning som ligger i
   Homey just nu (Starta-knappen, Ladda max eller ett ja i notisen). */
function rlBokat(D,L){
  var q=[];
  (L.f||[]).forEach(function(e){if(e&&e.bokad)rlDelar(e).forEach(function(x){x.kalla='förslaget '+avlKl(e.t0);x.e=e;q.push(x);});});
  var R=(typeof _regel!=='undefined'&&_regel)||null;
  if(R&&(R.start||R.spara)&&(!R.stopp||R.stopp>Date.now()-86400000*4))
    rlDelar({start:R.start,spara:R.spara,stopp:R.stopp}).forEach(function(x){x.kalla='bokat i Homey';q.push(x);});
  return rlSpar(q,D);
}
function rlForslag(D,L){
  var q=[];
  (L.f||[]).forEach(function(e){if(e)rlDelar(e).forEach(function(x){x.kalla='förslaget '+avlKl(e.t0);x.e=e;q.push(x);});});
  return rlSpar(q,D);
}
function rlTid(q){return avlKl(q.a)+(q.oppen?'→':'–'+avlKl(q.b));}
/* Längsta etikett som ryms, mätt i webbläsaren. Utan layout (jsdom) står
   procentgissningen från rlEtikett kvar. */
function rlSegPassa(){
  try{document.querySelectorAll('#dlg-body .rl-lbl[data-k]').forEach(function(g){
    var sp=g,bredd=g.clientWidth;if(!(g.clientWidth>0))return;   /* scrollWidth = clientWidth när texten ryms */
    var alt=g.getAttribute('data-k').split('|').concat(['']);
    for(var i=0;i<alt.length;i++){sp.textContent=alt[i];if(sp.scrollWidth<=bredd)break;}});}catch(e){}
}
/* v700: bokade perioder ritas i själva grafen — ett lodrätt streck i början
   och ett i slutet, skuggat emellan, och en etikett ovanför. Förslag som inte
   bokades får bara streckade lodräta linjer. */
function rlEtikett(q,D){
  var span=D.slut-D.ms,l=(q.a2-D.ms)/span*100,w=(q.b2-q.a2)/span*100;
  var namn=q.typ==='ladda'?'Ladda':'Spara',full=namn+' '+rlTid(q);
  var txt=w>=38?full:(w>=12?namn:(w>=5?namn.charAt(0):''));
  return '<span class="rl-lbl '+q.typ+'" data-k="'+esc(full)+'|'+namn+'|'+namn.charAt(0)+'" style="left:'+l.toFixed(2)+'%;width:'+w.toFixed(2)+'%" title="'+esc(full)+'">'+esc(txt)+'</span>';
}
/* Priser för dygnet: loggens i första hand (det laddregeln såg), annars
   dashboardens egen prisserie (tibber_pris) — den har även morgondagen. */
function rlPriser(D,L){
  var pr=(L.d&&L.d[D.k])||null;
  if(!pr&&typeof _prisJ!=='undefined'&&_prisJ&&_prisJ.d&&Array.isArray(_prisJ.d[D.k]))pr=_prisJ.d[D.k];
  return (pr&&pr.some(function(v){return typeof v==='number'&&isFinite(v);}))?pr:null;
}
function rlGraf(D,L){
  var W=300,H=150,pT=6,pB=4,X=function(t){return (t-D.ms)/(D.slut-D.ms)*W;};
  var pr=rlPriser(D,L),max=0;(pr||[]).forEach(function(v){if(isFinite(v)&&v>max)max=v;});
  max=max>0?Math.ceil(max*2)/2:3;
  var YP=function(v){return H-pB-(v/max)*(H-pT-pB);},YS=function(v){return H-pB-(v/100)*(H-pT-pB);};
  var B=rlBokat(D,L),F=rlForslag(D,L),bset={};
  B.lista.forEach(function(q){bset[q.typ+'|'+q.a+'|'+q.b]=1;});
  var s='<svg class="rl-svg" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" role="img" aria-label="Pris, batteri och bokade perioder">';
  /* bokat: skuggning under allt annat */
  B.lista.forEach(function(q){var col=q.typ==='ladda'?'var(--ok)':'var(--blue)';
    s+='<rect class="rl-bok '+q.typ+'" x="'+X(q.a2).toFixed(1)+'" y="0" width="'+(X(q.b2)-X(q.a2)).toFixed(1)+'" height="'+(H-pB)+'" fill="'+col+'" opacity="0.18"/>';});
  /* rutnät + nollinje */
  [0.5,1].forEach(function(f){var y=YP(max*f);s+='<line x1="0" x2="'+W+'" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'" stroke="var(--line)" stroke-width="0.5" vector-effect="non-scaling-stroke"/>';});
  [6,12,18].forEach(function(t){var x=X(D.ms+t*3600000);s+='<line x1="'+x.toFixed(1)+'" x2="'+x.toFixed(1)+'" y1="'+pT+'" y2="'+(H-pB)+'" stroke="var(--line)" stroke-width="0.5" vector-effect="non-scaling-stroke"/>';});
  s+=nollLinje(YP(0),0,W);
  /* förslag som inte bokades: streckade lodräta linjer */
  F.lista.forEach(function(q){if(bset[q.typ+'|'+q.a+'|'+q.b])return;var col=q.typ==='ladda'?'var(--ok)':'var(--blue)';
    [q.a,q.oppen?null:q.b].forEach(function(t){if(t==null||t<D.ms||t>D.slut)return;var x=X(t).toFixed(1);
      s+='<line class="rl-ej" x1="'+x+'" x2="'+x+'" y1="0" y2="'+(H-pB)+'" stroke="'+col+'" stroke-width="1.2" stroke-dasharray="3 3" opacity="0.8" vector-effect="non-scaling-stroke"/>';});});
  /* batteriet: linje med svag yta under */
  var so=rlSoc(D);
  if(so.length>1){var d=so.map(function(p,i){return (i?'L':'M')+X(p.t).toFixed(1)+' '+YS(p.v).toFixed(1);}).join('');
    s+='<path d="'+d+'L'+X(so[so.length-1].t).toFixed(1)+' '+YS(0).toFixed(1)+'L'+X(so[0].t).toFixed(1)+' '+YS(0).toFixed(1)+'Z" fill="var(--cyan)" opacity="0.08"/>';
    s+='<path class="rl-soc" d="'+d+'" fill="none" stroke="var(--cyan)" stroke-width="1.6" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>';}
  /* priset: trappa (24 timmar eller 96 kvartar) */
  if(pr){var d2='',st=(D.slut-D.ms)/pr.length;pr.forEach(function(v,h){if(typeof v!=='number'||!isFinite(v))return;var x0=X(D.ms+h*st),x1=X(D.ms+(h+1)*st),y=YP(v);
      d2+=(d2?'L':'M')+x0.toFixed(1)+' '+y.toFixed(1)+'L'+x1.toFixed(1)+' '+y.toFixed(1);});
    s+='<path class="rl-pris" d="'+d2+'" fill="none" stroke="var(--gold)" stroke-width="2" vector-effect="non-scaling-stroke"/>';}
  /* bokat: heldragna lodräta streck i början och slutet, överst */
  B.lista.forEach(function(q){var col=q.typ==='ladda'?'var(--ok)':'var(--blue)';
    [q.a,q.oppen?null:q.b].forEach(function(t){if(t==null||t<D.ms||t>D.slut)return;var x=X(t).toFixed(1);
      s+='<line class="rl-kant '+q.typ+'" x1="'+x+'" x2="'+x+'" y1="0" y2="'+(H-pB)+'" stroke="'+col+'" stroke-width="2" vector-effect="non-scaling-stroke"/>';});});
  /* nu */
  var nu=Date.now();if(nu>D.ms&&nu<D.slut)s+='<line x1="'+X(nu).toFixed(1)+'" x2="'+X(nu).toFixed(1)+'" y1="0" y2="'+(H-pB)+'" stroke="var(--dim)" stroke-dasharray="2 3" vector-effect="non-scaling-stroke"/>';
  s+='</svg>';
  /* Axelvärden som HTML (svg:en sträcks, text i den skulle förvrängas). */
  var top=function(y){return (y/H*100).toFixed(1)+'%';};
  var vl='<span style="top:'+top(YP(max))+'">'+num(max,1)+' kr</span><span style="top:'+top(YP(max/2))+'">'+num(max/2,max/2%1?2:1)+'</span><span style="top:'+top(YP(0))+'">0</span>';
  var hl='<span style="top:'+top(YS(100))+'">100 %</span><span style="top:'+top(YS(50))+'">50 %</span><span style="top:'+top(YS(0))+'">0 %</span>';
  var dagens=(L.f||[]).filter(function(e){var a=e.start||e.spara||e.t0,b=e.stopp;return b>D.ms&&a<D.slut;});
  var et=B.lista.map(function(q){return rlEtikett(q,D);}).join('');
  var h='<div class="rl-r"><span class="rl-gl"></span><div class="rl-tr rl-etr">'+et+'</div><span class="rl-gr"></span></div>'
    +'<div class="rl-r"><span class="rl-gl rl-ax">'+vl+'</span><div class="rl-tr rl-plot">'+s+'</div><span class="rl-gr rl-ax">'+hl+'</span></div>'
    +'<div class="rl-r"><span class="rl-gl"></span><div class="rl-tr pgraph-x rl-x"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div><span class="rl-gr"></span></div>';
  return {html:h,svg:s,max:max,dagens:dagens,bokat:B,forslag:F,pris:!!pr,soc:so.length>1};
}
/* Vilket dygn popupen öppnar på: där bokningen gäller (pågående eller nästa),
   annars idag. Ett tryck på en flik tar över. */
function rlAutoDag(){
  var R=(typeof _regel!=='undefined'&&_regel)||null,nu=Date.now();
  if(!R)return 0;
  var del=rlDelar({start:R.start,spara:R.spara,stopp:R.stopp}).filter(function(q){return !(q.b>q.a)||q.b>nu;});
  if(!del.length)return 0;
  var t=Math.max(nu,Math.min.apply(null,del.map(function(q){return q.a;})));
  return t>=rlDygn(0).slut?-1:0;
}
function rlHarImorgon(){
  var D=rlDygn(-1),L=_rl||{d:{},f:[]};
  return !!(rlPriser(D,L)||rlBokat(D,L).lista.length||rlForslag(D,L).lista.length);
}
function rlPopup(){
  var L=_rl,h='';
  var flikar=[[0,'Idag'],[1,'Igår'],[2,'2 d sedan'],[3,'3 d sedan']];
  var dag=(_rlDag==null)?rlAutoDag():_rlDag;
  if(dag===-1||(L&&rlHarImorgon()))flikar.unshift([-1,'Imorgon']);
  h+='<div class="graf-lage">'+flikar.map(function(f){return '<button type="button" class="graf-lage-b'+(f[0]===dag?' on':'')+'" onclick="rlValjDag('+f[0]+')">'+f[1]+'</button>';}).join('')+'</div>';
  if(!L)return h+'<div class="det-note">Hämtar loggen…</div>';
  if(L.fel)return h+'<div class="det-note">Kunde inte läsa loggen: '+esc(L.fel)+'</div>';
  var D=rlDygn(dag),G=rlGraf(D,L);
  h+='<div class="rl-graf">'+G.html+'</div>';
  setTimeout(rlSegPassa,0);
  h+='<div class="rl-leg"><span><i style="background:var(--gold)"></i>Pris</span><span><i style="background:var(--cyan)"></i>Batteri %</span>'
    +'<span><i class="rl-li spara"></i>Spara</span><span><i class="rl-li ladda"></i>Ladda</span><span class="rl-not">skuggat = bokat · streckad linje = förslag som inte bokades</span></div>';
  if(!G.pris&&!G.dagens.length&&!G.bokat.lista.length)h+='<div class="det-note">Inget loggat det här dygnet. Loggen började med laddregeln 1.3.1'+(L.tom?' och är tom än så länge':'')+'.</div>';
  if(G.bokat.lista.length){
    h+=dSec('Bokat');
    G.bokat.lista.forEach(function(q){
      var nu=Date.now(),st=q.oppen?(nu<q.a?'kommande':''):(nu>=q.b?'klart':(nu>=q.a?'<b class="rl-ok">pågår</b>':'kommande'));
      h+='<div class="rl-rad"><span class="rl-kl"><i class="rl-li '+q.typ+'"></i></span><span class="rl-txt">'+(q.typ==='ladda'?'Ladda ':'Spara ')+esc(rlTid(q))
        +'<small>'+esc(q.kalla)+(st?' · '+st:'')+'</small></span></div>';});
  }
  if(G.dagens.length){
    h+=dSec('Förslag');
    G.dagens.forEach(function(e){
      /* Klockslag utan datum — dygnet står i valet ovanför. */
      var tider=(e.start?'Ladda '+avlKl(e.start)+'–'+avlKl(e.spara||e.stopp)+(e.spara?', spara till '+avlKl(e.stopp):''):'Spara '+avlKl(e.spara||e.t0)+'–'+avlKl(e.stopp));
      var status=(e.bokad?'<b class="rl-ok">bokat</b>':(e.fragad?'frågat, inte bokat':'inte frågat'));
      h+='<div class="rl-rad"><span class="rl-kl">'+avlKl(e.t0)+'</span><span class="rl-txt">'+esc(tider)
        +'<small>'+(e.kwh?num(e.kwh,1)+' kWh · ':'')+'beräknat ca '+Math.round(e.vinst||0)+' kr · batteri '+(e.soc!=null?e.soc+' %':'–')+' · '+status+'</small></span></div>';});
  }
  if(!G.soc&&D.ms<Date.now())h+='<div class="det-note">Batteriets laddnivå saknas för dygnet (hämtas från Insights).</div>';
  if(dag===0&&!G.bokat.lista.length&&rlBokat(rlDygn(-1),L).lista.length)h+='<div class="det-note">Bokningen gäller imorgon – se fliken Imorgon.</div>';
  return h;
}
function regelDemo(){
  var nu=Date.now(),h=3600000,t0=Math.ceil(nu/h)*h;
  return {v:2,nyckel:'demo',text:'Spara batteriet till kvällen',startMs:0,sparaMs:nu-60000,stoppMs:t0+3*h,kwh:0,vinst:6.2,satt:nu-10*60000};
}
function regelKort(p,nu){
  var t=regelTider(p,nu);if(t.fel)return null;
  var kl=function(ms){return regelKl(ms);};
  /* Kort, så raden ryms på en 360 px-telefon: rubrik + en underrad. Hela
     motiveringen finns i husbatteriets popup. */
  var v=(Number(p.vinst)>=0.5)?('sparar ca '+Math.round(Number(p.vinst))+' kr'):'';
  if(t.start)return {txt:'Ladda '+kl(t.start)+'–'+kl(t.spara||t.stopp),sub:'batteriet'+(p.kwh?' · '+num(p.kwh,1)+' kWh':'')+(t.spara?' · spara till '+kl(t.stopp):'')+(v?' · '+v:'')};
  return {txt:'Spara '+(t.spara<=nu?'till '+kl(t.stopp):kl(t.spara)+'–'+kl(t.stopp)),sub:'batteriet'+(v?' · '+v:' · ingen urladdning')};
}
function regelRadRita(){
  var el=$('regelrad');if(!el)return;
  if(REGEL_AV){el.classList.remove('visa');el.innerHTML='';return;}
  var demo=(typeof SOURCE!=='undefined'&&SOURCE==='demo-data');
  var R=_regel,nu=Date.now(),p=demo?regelDemo():(R&&R.forslag);
  var ign='';try{ign=localStorage.getItem(REGEL_IGN_KEY)||'';}catch(e){}
  var bokat=!demo&&R&&R.stopp>nu&&p&&R.stopp===Number(p.stoppMs);
  var k=(p&&p.v===2&&!bokat&&String(p.nyckel||p.stoppMs)!==ign)?regelKort(p,nu):null;
  /* v707: står batteriet i spara för att bilen laddar billigt (verkställarens
     eget spara) visas ett förslag som LADDAR ändå — batteriet får laddas medan
     bilen laddar (battnotis 1.3.2 frågar då också). */
  if(!demo&&(typeof regelLage==='function')){try{var Lr=regelLage();
    var bilSpara=Lr.lage==='spara'&&R&&String(R.bil||'').split('|')[0]==='billig'&&p&&Number(p.startMs)>0;
    if(Lr.fjarr&&Lr.lage!=='egen'&&!bilSpara)k=null;}catch(e){}}
  el.classList.toggle('visa',!!k);
  el.innerHTML=k?('<span class="rr-ic">'+icon('battery-charging')+'</span>'
    +'<div class="rr-t"><span>'+esc(k.txt)+'</span>'+(k.sub?'<small>'+esc(k.sub)+'</small>':'')+'</div>'
    +'<div class="rr-b"><button type="button" class="rr-nej" onclick="regelIgnorera()" aria-label="Ignorera förslaget"><span class="rr-lang">Ignorera</span><span class="rr-kort">✕</span></button>'
    +'<button type="button" class="rr-ja" onclick="regelRadStarta()">Starta</button></div>'):'';
}
function regelIgnorera(){
  var demo=(typeof SOURCE!=='undefined'&&SOURCE==='demo-data');
  var p=demo?regelDemo():(_regel&&_regel.forslag);
  try{localStorage.setItem(REGEL_IGN_KEY,String((p&&(p.nyckel||p.stoppMs))||''));}catch(e){}
  regelRadRita();try{fitScreen();}catch(e){}
}
function regelRadStarta(){
  if(typeof SOURCE!=='undefined'&&SOURCE==='demo-data'){toast('Demoläge – inget bokas');regelIgnorera();return;}
  Promise.resolve(regelStarta()).then(function(){regelRadRita();});
}

/* ===== "PÅ NU"-RADEN (v688) =====
   Vad som är igång, ur samma källor som rutorna och knapparna använder.
   Knappar (CONFIG.BUTTONS) som är på blir egna brickor och öppnar Hem-rutans
   popup — utom de som hör till en egen ruta (poolvärme, Breveden, disk, ladda
   max), som öppnar den rutans popup. */
function paNuLista(){
  var ut=[],sett={};
  /* En bricka per sak: allt som hör till en egen ruta (pool, Breveden, disk,
     batteri, bil) räknas en gång, det mest beskrivande först — enhetens eget
     läge ("Breveden värmer") går före knappens namn ("Breveden"). */
  var lagg=function(txt,pop,gul,varn){var nyck=(pop==='hem')?('h:'+txt):pop;if(!txt||sett[nyck])return;sett[nyck]=1;ut.push({txt:txt,pop:pop,gul:!!gul,varn:!!varn});};
  try{var ph0=cap(DEV.poolheat,'onoff');if(ph0===true||ph0==='on')lagg('Poolvärme','pool');}catch(e){}
  /* BREVEDEN (v692): bara när den faktiskt värmer eller kyler. Läget "Värm 15"
     betyder bara att den FÅR värma — rutan sa "inget behövs" medan raden sa
     "Breveden värmer". Skriptets bild (brvState.aktiv) gäller; utan den
     effekten (över 150 W). */
  try{var B0=(typeof brvState==='function')?brvState():null;
    if(B0&&!brvGammal(B0)){if(B0.aktiv)lagg('Breveden '+(B0.lage==='cool'?'kyler':'värmer'),'breveden');}
    else{var w0=Number(cap(DEV.attefall,'measure_power'));var md0=String(cap(DEV.attefall,'thermostat_mode')||'');
      if(cap(DEV.attefall,'onoff')===true&&w0>150)lagg('Breveden '+(md0==='cool'?'kyler':'värmer'),'breveden');}}catch(e){}
  sett['breveden']=1;   /* knappens namn ska aldrig bli en egen bricka */
  /* DISKEN (v693): bara när den faktiskt diskar eller är bokad med
     diskknappen — samma regler som diskknappen (diskKor/diskBokad). Att
     maskinen står påslagen betyder ingenting: diskKor ser på hur framsteg och
     tid RÖR sig, och ett stillastående tal räknas som att den bara står på. */
  try{if(typeof diskKor==='function'&&diskKor())lagg('Disk pågår','dish');
    else if(typeof diskBokad==='function'&&diskBokad())lagg('Disk bokad'+((typeof diskNar==='function'&&diskNar())?' '+diskNar():''),'dish',true);}catch(e){}
  sett['dish']=1;
  /* v704: vad batteriet faktiskt gör, och en varning när läget och effekten
     inte stämmer (spara/ladda men urladdning över 300 W). */
  /* v747: MED KLOCKSLAG. Läget säger vad batteriet gör, bokningen (samma som
     batterirutans bricka, battBokning) säger till när – "Batteriet sparar till
     15:00", "Laddar max till 05:00". En bokning som inte börjat än blir en gul
     bricka med starttiden. */
  try{var L0=regelLage(),Rb=_regel||{},nuB=Date.now(),sp0=null,bs0=null;
    try{sp0=battSparaLage();}catch(e){}
    try{bs0=battStartAktiv();}catch(e){}
    var sparTill=(sp0&&sp0.aktiv&&sp0.till)?(' till '+regelKl(sp0.till)):'';
    var laddTill='';
    /* v749: Ladda på = markören eller knappens läge, inte bara registret. Precis
       efter start står Modbus ofta still → läget "oklart", och då föll brickan
       till knappens "Laddar max" utan stopptid. */
    var laddPa=false;try{laddPa=battMaxMark()===1||battLaddLage()===true;}catch(e){}
    var fulltTxt=(Rb.stopp>nuB)?(' · fullt sparas till '+regelKl(Rb.stopp)):'';
    if(L0&&L0.lage==='ladda'){var avk0=null;try{avk0=battAvstangKl();}catch(e){}
      laddTill=avk0?(' till '+avk0):fulltTxt;}
    if(laddPa&&L0&&(L0.lage==='oklart'||L0.lage==null)&&!L0.varn)lagg('Laddar max'+fulltTxt,'batt');
    if(L0&&L0.lage&&L0.lage!=='normal'){
      if(L0.varn)lagg((L0.lage==='spara'?'Sparar'+sparTill:'Laddar max'+laddTill)+' – men '+L0.varn,'batt',false,true);
      else if(L0.lage==='fullt')lagg('Batteriet fullt'+(Rb.stopp>nuB?(' · sparas till '+regelKl(Rb.stopp)):''),'batt');
      /* v749: "oklart" med Ladda på har redan fått sin bricka ovan. */
      else if(L0.lage==='ladda')lagg('Laddar max'+laddTill,'batt');
      else if(L0.lage==='spara')lagg('Batteriet sparar'+sparTill,'batt');}
    /* Bokat men inte påbörjat: före "styrs – egenförbrukning", som inte säger
       något man behöver veta. */
    /* Homeys battladd_start i första hand (bokat från vilken enhet som helst),
       den lokala ekot i andra – som batterirutans egen läsning. */
    var bst=(Rb.start>nuB)?Rb.start:((bs0&&bs0>nuB)?bs0:0);
    /* Kort – brickan ska rymmas på en telefon. Resten står i batterirutan. */
    if(bst)lagg('Batteriet laddar '+bilKlText(bst),'batt',true);
    else if(Rb.spara>nuB)lagg('Batteriet sparar från '+regelKl(Rb.spara),'batt',true);
    if(L0&&L0.lage&&L0.lage!=='normal'&&L0.lage!=='oklart'&&L0.lage!=='ladda'&&L0.lage!=='spara'&&L0.lage!=='fullt'&&!L0.varn)
      /* v714: oklart läge ger ingen bricka – popupen säger det */
      lagg('Batteriet '+L0.txt.charAt(0).toLowerCase()+L0.txt.slice(1),'batt');}catch(e){}
  /* v705: bokad billaddning syns som gul bricka tills den startar. */
  try{var bb=bilBokad();if(bb&&!bilDrar())lagg('Bilen bokad '+bilKlText(bb),'cars',true);}catch(e){}
  /* BILEN (v694): styrningens läge säger varför den laddar.
     v710: bara när bilen FAKTISKT drar ström (bilDrar). Läget "manuell" ligger
     kvar i energistyr upp till 18 h och sa "laddar manuellt" utan någon
     kontroll alls, även när laddboxen stod i SuspendedEV med 1 W. */
  try{var bs=bilStyrLage();
    if(bilDrar()){
      if(bs&&bs.lage==='sol')lagg('Bilen laddar på sol','cars');
      else if(bs&&bs.lage==='billig')lagg('Bilen laddar billigt','cars');
      else if(bs&&bs.lage==='manuell')lagg('Bilen laddar manuellt','cars');
      else lagg('Bilen laddar','cars');}}catch(e){}
  try{(CONFIG.BUTTONS||[]).forEach(function(b){
    if(!b||!btnState(b))return;
    var l=String(b.label||'').trim();
    var dst=knappTill(b);
    if(dst==='batt')lagg('Laddar max'+((_regel&&_regel.stopp>Date.now())?' · fullt sparas till '+regelKl(_regel.stopp):''),'batt');
    else if(dst==='breveden')lagg('Breveden','breveden');
    else if(dst==='dish')lagg('Disk bokad','dish',true);
    else if(dst==='pool')lagg('Poolvärme','pool');
    else if(CONFIG.BUTTONS.indexOf(b)===ljusKnapp())return;   /* v773: belysningsrutan visar redan Tänt – ingen bricka */
    else if(/^auto$/i.test(l))return;            /* v693: Auto är grundläget — ingen bricka */
    else lagg(l.replace(/\s+\d+([,.]\d+)?°.*$/,''),'hem');});}catch(e){}
  return ut;
}
function paNuRita(){
  var el=$('panu');if(!el)return;
  /* Egen klass på body — "panu" är radens klass, och .panu{display:none}
     gömde hela sidan när body fick samma namn. */
  document.body.classList.toggle('panu-pa',!!(CFG&&CFG.paNu));
  if(!(CFG&&CFG.paNu)){el.innerHTML='';return;}
  /* Rutorna för knapparnas popuper — en gång, när de egna knapparna finns.
     Här och inte bara vid start: knapparna kan komma senare via synken. */
  try{rutorPaNu();}catch(e){}
  try{regelHamta(false);}catch(e){}
  var L=paNuLista();
  /* v696: ingenting igång → raden göms helt, så luften ovanför korten blir
     densamma som under dem (rutnätets egen kantluft). */
  el.innerHTML=L.length?L.map(function(x){return '<button type="button" class="panu-c'+(x.gul?' gul':'')+(x.varn?' varn':'')+'" onclick="openDetail(\''+x.pop+'\')">'+(x.varn?icon('warning'):'')+esc(x.txt)+'</button>';}).join(''):'';
  el.classList.toggle('panu-tomt',!L.length);
  try{paNuLinjera(el);}catch(e){}
}
/* v757: FÖRSTA CHIPSETS VÄNSTERKANT = FÖRSTA RUTANS VÄNSTERKANT (Markus).
   Chipsen är lika breda som texten (som före v755). Raden och rutnätet har
   samma inre luft i CSS, och i provmiljön linjerade de redan – men inte på
   Markus enhet, av skäl jag inte kunnat återskapa. Därför mäts kanterna och
   radens vänsterluft justeras med skillnaden. Ingen layout (jsdom) → inget görs. */
function paNuLinjera(el){
  if(!el)return;el.style.removeProperty('padding-left');el.style.removeProperty('margin-left');
  var c=el.firstElementChild,t=document.querySelector('#stats-flode .stat');
  if(!c||!t||!c.offsetWidth||!t.offsetWidth)return;
  /* Mät och justera om, högst tre varv: i kioskläget är raden krympt till
     innehållet och centrerad, så ändrad luft flyttar hela raden (uppmätt). */
  for(var i=0;i<3;i++){
    var d=t.getBoundingClientRect().left-c.getBoundingClientRect().left;
    if(Math.abs(d)<0.5)return;
    var cs=getComputedStyle(el),p=parseFloat(cs.paddingLeft)||0,m=parseFloat(cs.marginLeft)||0;
    /* Inre luft räcker → ändra den; annars flyttas raden med marginalen. */
    if(p+d>=0)el.style.setProperty('padding-left',(p+d)+'px','important');
    else{el.style.setProperty('padding-left','0px','important');el.style.setProperty('margin-left',(m+p+d)+'px','important');}
  }
}
/* VARJE KNAPP I SIN RUTAS POPUP (v690). Knappen som hör till en ruta ligger
   i den rutans popup: boka disk i diskmaskinens, poolvärmen i poolens, ladda
   max i husbatteriets. Breveden har sina tre lägen i sin popup redan, så dess
   knapp behövs inte där. Resten — Auto, Tänd, Skivspelare — ligger i Hem.
   Knapparna är exakt de som knappavsnittet ritar (renderControls ritar vidare
   i det dolda avsnittet), så flöden, bekräftelse och väntelägen följer med. */
function knappTill(b){
  if(!b)return null;var l=String(b.label||'');
  if(b.type==='disk'||/disk/i.test(l))return 'dish';
  if(b.type==='breveden'||/breveden/i.test(l))return 'breveden';
  if(b.type==='battladd')return 'batt';
  if(/pool/i.test(l))return 'pool';
  return 'hem';
}
function popKnappar(dest){
  var c=$('controls');if(!c||!c.querySelectorAll)return '';
  var ut=[];
  Array.prototype.forEach.call(c.querySelectorAll('.ctl[data-bi]'),function(b){
    var i=+b.getAttribute('data-bi');if(knappTill(CONFIG.BUTTONS[i])===dest)ut.push(b.outerHTML);});
  if(dest==='batt'){try{ut.push(battSparaKnapp());}catch(e){}}   /* v708 */
  if(!ut.length)return '';
  /* Högst fyra per rad. */
  var h='';for(var r=0;r<ut.length;r+=4)h+='<div class="ctl-row">'+ut.slice(r,r+4).join('')+'</div>';
  return '<div class="controls hem-pop" id="popk-'+dest+'">'+h+'</div>';
}
/* v713: knappar läggs till direkt i belysningsrutans popup. Håll in en knapp
   i popupen för att ändra, ta bort eller lägga till ("Lägg till ny knapp" i
   redigeraren). v725: "+ Lägg till knapp" och hjälptexten visas bara när
   popupen saknar knappar – annars finns ingen knapp att hålla in.
   En knapp hamnar här så länge den inte hör till en annan ruta (disk, pool,
   Breveden, batteriet) – se knappTill. */
function hemPopup(){
  var k=popKnappar('hem');
  if(k)return k;
  return '<div class="viz-empty">Inga knappar ännu.</div>'
    +'<div class="hem-ny"><button type="button" class="te-alt" onclick="beAdd()">＋ Lägg till knapp</button></div>';
}
function regelSpara(R){try{localStorage.setItem(REGEL_LS,JSON.stringify({start:R.start||0,spara:R.spara||0,stopp:R.stopp||0,
  max:(R.max==null?null:R.max),bilBokad:R.bilBokad||0,bilStrom:R.bilStrom||0,at:Date.now()}));}catch(e){}}
function regelLasLokal(){
  try{var o=JSON.parse(localStorage.getItem(REGEL_LS)||'null');
    if(!o||!(Date.now()-Number(o.at)<REGEL_LS_MAX))return null;
    return {forslag:null,start:Number(o.start)||0,spara:Number(o.spara)||0,stopp:Number(o.stopp)||0,lista:null,bil:'',
      bilBokad:Number(o.bilBokad)||0,bilStrom:Number(o.bilStrom)||0,
      /* v752: läget sparas inte över omladdningen – bara klockslagen. Färskt
         läge kommer ur battMax_v1 (högst 10 min) eller registret. */
      max:null,lokal:true};}catch(e){return null;}}
function regelHamta(tvinga){
  if(_regelLaddar)return _regelP;
  if(!tvinga&&Date.now()-_regelAt<30000)return null;
  _regelLaddar=true;
  return _regelP=Promise.resolve().then(logicList).then(function(list){
    var r={};
    logicArr(list).forEach(function(v){if(v&&REGEL_VARS.indexOf(v.name)>=0)r[v.name]=v.value;});
    var p=null;try{p=JSON.parse(String(r.battladd_forslag||'')||'null');}catch(e){}
    _regel={forslag:p,start:Number(r.battladd_start)||0,spara:Number(r.battladd_spara)||0,
      stopp:Number(r.battladd_stopp)||0,lista:list,
      /* v694: verkställarens bilstyrning, "läge|förklaring" (energistyr 2.0.0). */
      bil:String(r.energi_bil||''),
      /* v705: bilens bokade start (ms) och laddström (A). Verkställs av energistyr 2.3.0. */
      bilBokad:Number(r.billadd_bokad)||0,bilStrom:Number(r.billadd_strom)||0,
      /* v715: Ladda max-markören (energistyr 3.1.0 / batteriflödena). null = variabeln saknas. */
      max:(r.battladd_max==null||r.battladd_max==='')?null:Number(r.battladd_max),at:Date.now()};
    try{if(_regel.max!=null)localStorage.setItem('battMax_v1',JSON.stringify({v:_regel.max,at:Date.now()}));}catch(e){}
    regelSpara(_regel);
  }).catch(function(){}).then(function(){
    _regelAt=Date.now();_regelLaddar=false;
    try{if(_regel){if(('bokad' in _bilLokal)&&_regel.bilBokad===_bilLokal.bokad)delete _bilLokal.bokad;
      if(('strom' in _bilLokal)&&_regel.bilStrom===_bilLokal.strom)delete _bilLokal.strom;}}catch(e){}
    if(_dlgWhich==='cars'||_dlgWhich==='billadd'){try{bilStyrOm();}catch(e){}}
    try{regelRadRita();}catch(e){}
    /* v751: På nu ritas om direkt när bokningarna kommit, inte först vid nästa
       uppdatering 15 s senare. */
    try{paNuRita();}catch(e){}
    if(_dlgWhich==='batt'&&typeof _grafOmRita==='function'){try{_grafOmRita();}catch(e){}}
    /* Prisgrafens batteriprognos använder bokningarna — rita om när de kommit. */
    else if(_dlgWhich==='cost'){try{var b=$('dlg-body');if(b&&_popupRebuild)b.innerHTML=_popupRebuild();}catch(e){}}
    else if(_dlgWhich==='regellogg'){try{var b2=$('dlg-body');if(b2)b2.innerHTML=rlPopup();}catch(e){}}
  });
}
/* Samma regler som battsvar 1.2.0: inget bokas efter fönstret, och är
   laddfönstret passerat bokas bara sparandet. */
function regelTider(p,nuMs){
  if(!p||p.v!==2)return {fel:'inget förslag'};
  var start=Number(p.startMs)||0,spara=Number(p.sparaMs)||0,stopp=Number(p.stoppMs);
  if(!start&&!spara)return {fel:'inget förslag'};
  if(!isFinite(stopp)||stopp<=Math.max(start,spara))return {fel:'ogiltig stopptid'};
  if(nuMs>=stopp)return {fel:'fönstret har passerat'};
  if(start&&spara&&nuMs>=spara)start=0;
  return {start:start,spara:spara,stopp:stopp};
}
function regelKl(ms){
  var d=svDatum(ms),i=svDatum(Date.now());
  var dag=(d.y===i.y&&d.m===i.m&&d.d===i.d)?'':
    ((svMidnatt(d.y,d.m,d.d)-svMidnatt(i.y,i.m,i.d)===86400000)?' imorgon':(' '+avlDag(ms)));
  return avlKl(ms)+dag;
}
/* v716: Modbus räknas som inaktuell (registret går inte att lita på) när
   Husbatteri ändrats mer än BATT_HB_GAMMAL_MS efter Modbus senaste ändring –
   alltså när Modbus bevisligen stått still medan batteriet rört sig. Står båda
   still (fullt, vilar) litar vi på registret. */
function battModbusFarsk(){try{cap(DEV.battery,'measure_battery');cap(DEV.battery,'measure_power');
  var s=_battTider.soc||{},p=_battTider.pow||{};
  var mb=Math.max(s.mb||0,p.mb||0),hb=Math.max(s.hb||0,p.hb||0);
  return !(hb>mb+BATT_HB_GAMMAL_MS);}catch(e){return true;}}
/* v715: LADDA MAX UR MARKÖREN, inte ur registret. battladd_max sätts av
   flödena själva (ladda max → 1, spara/normal/sol → 0), så den är rätt även när
   Modbus-registret står kvar på 4/3 – som 2026-10-11 kl 16–18, då batteriet
   laddade ur 4 kW till huset. Innan variablerna hämtats används senast kända
   värde (localStorage); saknas variabeln helt gäller registret som förut. */
function battMaxMark(){
  /* v752: även minnets läge åldras – en sida som legat i bakgrunden över natten
     har kvar kvällens max. Hämtat för mer än BATT_MAX_LS_MS sedan gäller inte. */
  try{if(_regel&&_regel.max!=null&&isFinite(_regel.max)&&!(_regel.at&&Date.now()-_regel.at>=BATT_MAX_LS_MS))return _regel.max===1?1:0;}catch(e){}
  /* v752: bara en FÄRSK sparad markör (BATT_MAX_LS_MS). Ett läge blir gammalt
     på ett sätt som ett klockslag inte blir: 2026-10-19 07:32 stod det "Laddar
     max" efter natten, fast Ladda max slagit av 02:37 – markören var från
     kvällen innan. Äldre värden, och det gamla formatet utan tid, gäller inte;
     då avgör registret tills variablerna hämtats. */
  try{var o=JSON.parse(localStorage.getItem('battMax_v1')||'null');
    if(o&&typeof o==='object'&&Date.now()-Number(o.at)<BATT_MAX_LS_MS){if(Number(o.v)===1)return 1;if(Number(o.v)===0)return 0;}}catch(e){}
  return null;
}
function battNatLaddar(w){
  if(w==null||!isFinite(w)||w<BATT_NAT_W)return false;
  var g=cap(DEV.pulse,'measure_power'),sol=cap(DEV.solar,'measure_power');
  if(g==null||!isFinite(g)||g<BATT_IMPORT_W)return false;
  return w>(Number(sol)||0)+BATT_IMPORT_W;
}
function regelLage(){
  var L=regelLageReg();
  if(L.lage===null)return L;
  var mk=battMaxMark();
  if(mk===0&&L.lage==='ladda')L={txt:'Normal drift',lage:'normal',fjarr:false,varn:null,regLadda:true};
  else if(mk===1&&L.lage!=='ladda')L={txt:'Laddar från nätet',lage:'ladda',fjarr:true,varn:null};
  var w=null;try{w=battEffektNu();}catch(e){}
  var soc=cap(DEV.battery,'measure_battery'),full=(soc!=null&&isFinite(soc)&&soc>=BATT_FULLT);
  if(battNatLaddar(w)){
    if(L.lage!=='ladda')L={txt:'Laddar från nätet',lage:'ladda',fjarr:true,varn:null,bedomd:true};
    return L;}
  if(L.lage!=='normal'&&!battModbusFarsk())
    return full?{txt:'Batteriet fullt',lage:'fullt',fjarr:true,varn:null}
               :{txt:'Läget oklart – Modbus står still',lage:'oklart',fjarr:true,varn:null};
  if(L.lage==='ladda'&&full&&!(w!=null&&w>BATT_TROSKEL_W))return {txt:'Batteriet fullt',lage:'fullt',fjarr:true,varn:null};
  if((L.lage==='spara'||L.lage==='ladda')&&w!=null&&isFinite(w)&&w<-BATT_VARN_W)
    L.varn='laddar ur '+(Math.abs(w)>=1000?num(Math.abs(w)/1000,1)+' kW':Math.round(Math.abs(w))+' W');
  return L;
}
function regelLageReg(){
  var km=cap(BATT_MODBUS,'storagecontrolmode');
  if(km==null)return {txt:'ingen kontakt med växelriktaren',fjarr:null,lage:null,varn:null};
  if(String(km)!=='4')return {txt:'Normal drift',fjarr:false,lage:'normal',varn:null};
  var dm=String(cap(BATT_MODBUS,'storagedefaultmode'));
  var L;
  if(dm==='3')L={txt:'Laddar från nätet',lage:'ladda'};
  else if(dm==='1')L={txt:'Sparar – ingen urladdning',lage:'spara'};
  else if(dm==='7')L={txt:'Styrs – egenförbrukning',lage:'egen'};
  else L={txt:'Styrs – '+(BATT_DM_TXT[dm]||('läge '+dm)),lage:'annat'};
  L.fjarr=true;L.varn=null;
  return L;
}
function regelHTML(){
  regelHamta(false);
  var R=_regel,nu=Date.now(),h=dSec('Laddregeln'),L=regelLage();
  h+=dRow('Just nu',esc(L.txt)+(L.bedomd?' <small>(bedömt av effekten)</small>':'')
    +(L.regLadda?' <small>(registret säger 4/3, men Ladda är inte startat)</small>':''));
  if(L.varn)h+='<div class="rg-varn">'+icon('warning')+'<span>Läget säger '+(L.lage==='spara'?'spara':'ladda')+', men batteriet '+esc(L.varn)+'.</span></div>';
  if(!R)return h+'<div class="det-note">'+(REGEL_AV?'Hämtar bokningarna…':'Hämtar laddregelns förslag…')+'</div>';
  var steg=[];
  if(R.start>nu)steg.push(['Laddar från',R.start]);
  if(R.spara>nu)steg.push(['Sparar från',R.spara]);
  /* v749: med Ladda på betyder stoppet "spara när fullt, normal drift från
     stopptiden" – "Normal drift 06:00" såg ut som att inget spara var bokat. */
  var lp=false;try{lp=battMaxMark()===1||battLaddLage()===true||R.start>nu;}catch(e){}
  if(R.stopp>nu)steg.push([lp?'Fullt sparas till':'Normal drift',R.stopp]);
  steg.forEach(function(x){h+=dRow(x[0],regelKl(x[1]));});
  var p=R.forslag,knappar='';
  if(REGEL_AV){
    h+='<div class="rg-forslag">Laddregeln är avstängd.</div>';
  }else if(p&&p.v===2&&p.text){
    var t=regelTider(p,nu),bokat=(R.stopp>nu&&R.stopp===Number(p.stoppMs));
    h+='<div class="rg-forslag">'+esc(p.text)
      +'<small>'+(bokat?'Bokat.':(t.fel?('Gäller inte längre: '+esc(t.fel)+'.'):'Inte bokat – svara på notisen eller starta här.'))
      +(p.satt?' Förslaget från '+regelKl(Number(p.satt))+'.':'')+'</small></div>';
    if(!bokat&&!t.fel)knappar+='<button class="te-use" onclick="regelStarta()">Starta förslaget</button>';
  }else if(p&&p.ingen){
    h+='<div class="rg-forslag">Inget förslag: '+esc(p.skal||'okänt skäl')
      +(p.satt?'<small>Kontrollerat '+regelKl(Number(p.satt))+'. Laddregeln kör var 30:e minut.</small>':'')+'</div>';
  }else{
    h+='<div class="rg-forslag">Laddregeln har inte lämnat något besked än.<small>Den kör var 30:e minut.</small></div>';
  }
  if(L.fjarr||steg.length)knappar+='<button class="te-alt" onclick="regelNormal()">Normal drift nu</button>';
  if(knappar)h+='<div class="rg-btns">'+knappar+'</div>';
  return h;
}
async function regelStarta(){
  var R=_regel,p=R&&R.forslag,t=regelTider(p,Date.now());
  if(t.fel){toast('Förslaget gäller inte längre');regelHamta(true);return;}
  try{
    var list=await logicList();
    /* Stoppet först: battboka kör varje minut och ska aldrig se en start
       utan sitt slut. */
    await logicWrite(list,'battladd_stopp',t.stopp);
    await logicWrite(list,'battladd_spara',t.spara);
    await logicWrite(list,'battladd_start',t.start);
    _regel.start=t.start;_regel.spara=t.spara;_regel.stopp=t.stopp;
    try{if(t.start)localStorage.setItem(BATT_START_KEY,String(t.start));else localStorage.removeItem(BATT_START_KEY);}catch(e){}
    toast('Förslaget bokat');
  }catch(e){toast('Kunde inte boka: '+((e&&e.message)||'okänt'));}
  regelHamta(true);
  try{if(typeof _grafOmRita==='function')_grafOmRita();}catch(e){}
}
async function regelNormal(){
  try{
    var list=await logicList();
    await logicWrite(list,'battladd_start',0);
    await logicWrite(list,'battladd_spara',0);
    await logicWrite(list,'battladd_stopp',0);
    if(_regel){_regel.start=0;_regel.spara=0;_regel.stopp=0;}
    try{localStorage.removeItem(BATT_START_KEY);}catch(e){}
  }catch(e){toast('Kunde inte nollställa bokningen: '+((e&&e.message)||'okänt'));return;}
  try{await homeyTriggerFlow('standard',BATT_FLOW_AV);toast('Normal drift');}
  catch(e){toast('Normal drift skickat – Homey svarade: '+((e&&e.message)||'okänt'));}
  setTimeout(function(){try{load();}catch(e){}},1500);
  regelHamta(true);
}
function svKlMs(y,m,d,h){
  var vagg=Date.UTC(y,m-1,d,h,0,0);
  var off=function(ms){var q={};new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',year:'numeric',
      month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'})
    .formatToParts(new Date(ms)).forEach(function(p){q[p.type]=p.value;});
    return Date.UTC(+q.year,+q.month-1,+q.day,+q.hour,+q.minute,+q.second)-Math.floor(ms/1000)*1000;};
  var ms=vagg-off(vagg);
  return vagg-off(ms);
}
/* Ren funktion. pts0/pts1 = prisDygn(0)/prisDygn(1) ([[timme, kr], …], timmar
   eller kvartar). Returnerar {franMs, tillMs, snitt} eller null.
   v728: franMs (valfri) = räkna från en senare tid, t.ex. en bokad laddstart.
   Dygnen förankras fortfarande i nuMs – pts0 är alltid dagens priser. */
function sparaMal(pts0,pts1,nuMs,franMs){
  var d0=svDatum(nuMs),m0=svMidnatt(d0.y,d0.m,d0.d),d1=svDatum(m0+36*3600000);
  var tim=[];
  [[pts0,d0],[pts1,d1]].forEach(function(x){
    var pts=x[0],d=x[1];if(!Array.isArray(pts))return;
    var sum={},n={};
    pts.forEach(function(p){var h=Math.floor(p[0]);if(h<0||h>23||!isFinite(p[1]))return;sum[h]=(sum[h]||0)+p[1];n[h]=(n[h]||0)+1;});
    for(var h=0;h<24;h++)if(n[h]){var t0=svKlMs(d.y,d.m,d.d,h);tim.push({t0:t0,t1:t0+3600000,kr:sum[h]/n[h]});}
  });
  var fr0=(franMs>nuMs)?franMs:nuMs;
  var fr=tim.filter(function(t){return t.t1>fr0;});
  if(fr.length<2)return null;
  var v=fr.map(function(t){return t.kr;}),lo=Math.min.apply(null,v),hi=Math.max.apply(null,v);
  if(!(hi-lo>0.05))return null;
  var gr=lo+(hi-lo)*SPARA_DYR_FRAC;
  fr.forEach(function(t){t.dyr=t.kr>=gr;});
  var prev=fr[0].dyr,start=-1;
  for(var i=1;i<fr.length;i++){if(fr[i].dyr&&!prev){start=i;break;}prev=fr[i].dyr;}
  if(start<0)return null;
  var slut=start,s=0;while(slut<fr.length&&fr[slut].dyr){s+=fr[slut].kr;slut++;}
  return {franMs:fr[start].t0,tillMs:fr[slut-1].t1,snitt:s/(slut-start)};
}
/* Pågår eller är spara bokat? Ett stopp framåt utan inbokad laddstart. */
function battSparaLage(){
  var R=_regel,nu=Date.now();
  /* v728: ett stopp skrivs nu även av Ladda max (spara efter fullt). Medan
     laddningen pågår är det alltså inte spara – det blir det först när
     energistyr slagit om vid fullt (battladd_max → 0). */
  var laddar=false;try{laddar=battMaxMark()===1||battLaddLage()===true;}catch(e){}
  if(R&&R.stopp>nu&&!(R.start>nu)&&!laddar)return {aktiv:true,till:R.stopp};
  return {aktiv:false};
}
/* ===== FULLT BATTERI SPARAS TILL DEN DYRA PERIODEN (v728) =====
   Ladda max och bokad laddning från dashboarden skriver battladd_stopp =
   början på nästa dyra period efter laddstarten (samma beräkning som
   Spara-knappen). energistyr 3.2.0 ser stoppet när batteriet blir fullt och
   går då i spara i stället för normal drift; stoppet slår om till normal drift
   när den dyra perioden börjar. 0 = ingen dyr period i sikte → normal drift
   vid fullt, som förut. */
function battSparaTill(franMs){
  try{var m=sparaMal(prisDygn(0),prisDygn(1),Date.now(),franMs);return m?m.franMs:0;}catch(e){return 0;}
}
/* Skriver stoppet (och nollar ett gammalt spara) i Homey. Svaret inväntas inte
   av knapparna; nästa hämtning rättar bilden. */
function battStoppSkriv(ms){
  var v=(ms>0)?Number(ms):0;
  try{_regel=_regel||{};_regel.stopp=v;if(v)_regel.spara=0;}catch(e){}
  try{
    return logicList().then(function(list){
      return logicWrite(list,'battladd_stopp',v).then(function(){return v?logicWrite(list,'battladd_spara',0):null;});
    }).catch(function(){});
  }catch(e){return null;}
}
/* Avbokas en laddning som inte startat ska dess stopp bort – men inte om
   batteriet just nu SPARAR: då hör stoppet till sparandet, och utan det skulle
   inget slå tillbaka till normal drift. */
function battStoppAvboka(){
  try{if(regelLage().lage==='spara')return;}catch(e){}
  battStoppSkriv(0);
}
function battSparaKnapp(){
  var L=battSparaLage(),arm=!!_sparaArm&&Date.now()-_sparaArm<4000,lbl;
  if(L.aktiv)lbl=arm?'Avbryta?':'Sparar till '+regelKl(L.till);
  else{var m=null;try{m=sparaMal(prisDygn(0),prisDygn(1),Date.now());}catch(e){}
    lbl=m?'Spara till '+regelKl(m.franMs):'Spara';}
  return '<button type="button" class="ctl'+(L.aktiv?' on':'')+(arm?' arm':'')+'" data-spara="1" onclick="battSparaTryck()">'
    +'<span class="ctl-ic">'+icon('lock-simple')+'</span><span class="ctl-l">'+esc(lbl)+'</span></button>';
}
async function battSparaTryck(){
  if(typeof SOURCE!=='undefined'&&SOURCE==='demo-data'){toast('Demoläge – inget bokas');return;}
  var L=battSparaLage();
  /* Pågående spara avbryts med två tryck, som Ladda max. */
  if(L.aktiv){
    if(!(_sparaArm&&Date.now()-_sparaArm<4000)){_sparaArm=Date.now();try{renderControls();}catch(e){}
      setTimeout(function(){_sparaArm=0;try{renderControls();}catch(e){}},4100);return;}
    _sparaArm=0;await regelNormal();try{renderControls();}catch(e){}return;
  }
  var m=sparaMal(prisDygn(0),prisDygn(1),Date.now());
  if(!m){toast('Ingen dyr period i sikte i elpriset');return;}
  var nu=Date.now();
  try{
    var list=await logicList();
    /* Stoppet först: verkställaren ska aldrig se ett spara utan sitt slut. */
    await logicWrite(list,'battladd_stopp',m.franMs);
    await logicWrite(list,'battladd_spara',nu);
    await logicWrite(list,'battladd_start',0);
    _regel=_regel||{};_regel.stopp=m.franMs;_regel.spara=nu;_regel.start=0;
    try{localStorage.removeItem(BATT_START_KEY);}catch(e){}
  }catch(e){toast('Kunde inte boka: '+((e&&e.message)||'okänt'));return;}
  /* Direkt, så det syns nu — verkställaren skickar samma sak inom en minut. */
  try{await homeyTriggerFlow('standard',BATT_FLOW_SPARA);}catch(e){}
  toast('Sparar till '+regelKl(m.franMs));
  try{renderControls();}catch(e){}
  regelHamta(true);
  setTimeout(function(){try{load();}catch(e){}},1500);
}
function byggBatt(){
  var bw=cap(DEV.battery,'measure_power'),bsx=cap(DEV.battery,'battery_charging_state'),bp=cap(DEV.battery,'measure_battery'),bt=battTimeStr();
  return grafRubrik('g2-batt','Batteri',infoBlock('battgraf',
      'Skalan är watt. Effekten är positiv och grön när batteriet laddas, negativ '
      +'och gul när det matar ut. Den streckade kurvan är laddnivån på egen 0–100-skala. Dra '
      +'i grafen för att läsa av båda vid en viss tidpunkt.'))
    +battGrafHTML('g2-batt')
    +grafTidsval('g2-batt')
    /* v719: Ladda och Spara direkt under tidsvalet. */
    +((CFG&&CFG.paNu)?popKnappar('batt'):('<div class="controls hem-pop" id="popk-batt"><div class="ctl-row">'+battSparaKnapp()+'</div></div>'))
    +dSec('Nu')
    +dRow('Laddnivå',bp==null?'–':Math.round(bp)+' %')+dRow('Läge',bsx==='charging'?'laddar':bsx==='discharging'?'matar ut':'vilar')+dRow('Effekt',bw==null?'–':W(Math.abs(bw)))
    +(bt?dRow(bsx==='charging'?'Fulladdat':'Räcker',bt):'')
    +regelHTML();
    /* Ladda bor i batteriets popup när knappavsnittet är gömt (v688).
       v708: Spara ligger bredvid; utan Ladda i popupen står den ensam.
       v719: båda ligger under tidsvalet, se ovan. */
}
/* Utbruten så _popupRebuild kan rita om den när Tibbers prisserie landar.
   Symtom före v624: första gången rutan öppnades efter uppstart hade
   prisVarHamta() inte hunnit hem, grafen ritades från den lokala prisloggen
   (bara de priser dashboarden själv sett — en handfull steg och ett enda
   jätteintervall, "861 minuter kvar"), och eftersom rutan aldrig byggdes om
   stod den kvar så tills man växlade Idag/Imorgon för hand. */
function buildCostPopup(){
    var pdOff=_priceDay||0;
    var tog='<div class="seg-row" style="margin-bottom:10px"><button class="seg-btn'+(pdOff===0?' on':'')+'" onclick="priceDaySet(0)">Idag</button><button class="seg-btn'+(pdOff===1?' on':'')+'" onclick="priceDaySet(1)">Imorgon</button></div>';
    var body=tog+'<div class="pgraph">'+dayPriceGraphSVG(pdOff)+'</div>'
      +'<div class="ww-h" style="margin:4px 0 8px">Timpris'
      +infoBlock('pris','Kurvans form kommer från Tibbers timpriser. Nivån är omräknad mot elprislägst och elprishögst, så grafen och raderna nedan visar samma skala. Färgen följer priset: grönt billigast, rött dyrast.'
        +(_prisKal?'':' Just nu saknas facitvärdena, så Tibbers tal visas orörda.'))+'</div>'
      +prisRutor(pdOff)
      +dayBarsHTML('cost','kr per dag','warm');
  return body;
}
function dlgAga(){try{if(_dlgObs)_dlgObs.takeRecords();}catch(e){}}
function openDetail(which){var r=openDetailKarna(which);dlgAga();return r;}
function openDetailKarna(which){
  _grafOmRita=null;
  if(_suppressClick){_suppressClick=false;_tapCfg=null;return;}
  let _dlgWide=false;
  _dlgWhich=which;
  const tcfg=_tapCfg;_tapCfg=null;
  {const _d=$('dlg');if(_d&&_d.classList)_d.classList.remove('nohead');}
  const icn={sun:'sun',grid:'lightning',batt:'battery-high',self:'leaf',cost:'coins',pool:'swimming-pool',cars:'car-profile',tv:'television',air:'wind',sold:'lightning',boughtyear:'plug',weather:'cloud-sun',humidity:'drop-half-bottom',rain:'cloud-rain',pressure:'gauge',wind:'wind',forecast:'cloud-sun',dish:'fork-knife',battladd:'battery-charging',billadd:'battery-charging',seatemp:'waves',indoor:'house',uterum:'uterum',snickarboa:'hammer',poolrum:'swimming-pool',vardagsrum:'couch',temps:'house',breveden:'snowflake'}[which]||'gauge';let title='',body='';
  if(which==='sun'){title='Solpaneler';const perf=solPerfPct(),theo=solTheoW();
    /* GÅRDAGENS FAKTISKA LIGGER I SJUDYGNSSERIEN, och den hämtades bara när
       historikrutan öppnades. Öppnade man Solpaneler → Igår direkt var
       HIST7['solar'] tom och kurvan uteblev — dagens fungerade, för den läser
       HIST['solar'] som alltid finns. Hämtningen har egen cache på tio
       minuter, så det här kostar inget när den redan är gjord. */
    hist7Hamta(false);
    /* PROGNOSEN ÖVERST. Det är den man öppnar rutan för — hur dagen ser ut
       framåt. Mätarställningarna är uppslagsverk och hör hemma under. */
    body='<div id="prog-sec">'+progAvsnitt()+'</div>'
      +dRow('Produktion nu',W(cap(DEV.solar,'measure_power')||0))
      +(theo>=400?dRow('Möjligt just nu (klart)','~'+W(theo)):'')
      +(perf!=null?dRow('Prestanda',perf+' % av möjligt'):'')
      +dRow('Idag',num(cap(DEV.solar,'meter_power.day'),1)+' kWh')+dRow('Denna månad',num(cap(DEV.solar,'meter_power.month'),0)+' kWh')+dRow('I år',num(cap(DEV.solar,'meter_power.year'),0)+' kWh')
      +dayBarsHTML('sol','kWh sol','sun');
    /* RITA OM DELEN, inte hela rutan. Förut anropades openDetail('sun') härifrån,
       som körde samma rad igen — och eftersom progHamta() svarar direkt ur cachen
       löstes löftet omedelbart varje gång. Resultatet var en oändlig loop som
       låste hela sidan; man kunde inte ens stänga popupen. */
    if(!_prog)progHamta().then(function(){progUppdatera();});
  }else if(which==='grid'){const pw=cap(DEV.pulse,'measure_power'),exp=pw!=null&&pw<0;title='Elnät · Pulse';
    /* Tidsseriegraf: registrera byggare + omritning så tidsval och helskärm
       kan rita om just den här vyn. */
    _grafByggare['grid']={titel:'Elnät · Pulse',full:function(cid){return gridPowerSVG(histV('grid',cid||'grid'),cid||'grid');}};
    _grafOmRita=function(){var b=$('dlg-body');if(b)b.innerHTML=byggGrid();};
    body=byggGrid();
      +dRow('Just nu',pw==null?'–':(exp?'säljer ':'köper ')+W(Math.abs(pw)))+dRow('Spotpris',num(elprisNow(),2)+' kr/kWh')+dRow('Kostnad idag',num(cap(DEV.pulse,'accumulatedCost'),2)+' kr')+dRow('Köpt totalt',num(cap(DEV.pulse,'meter_power.imported'),0)+' kWh')+dRow('Sålt totalt',num(cap(DEV.pulse,'meter_power.exported'),0)+' kWh');
  }else if(which==='batt'){title='Husbatteri';
    _grafByggare['g2-batt']={titel:'Husbatteri',full:function(cid){return battGrafHTML(cid||'g2-batt');}};
    _grafOmRita=function(){var b=$('dlg-body');if(b)b.innerHTML=byggBatt();};
    body=byggBatt();
  }else if(which==='self'){const sW=cap(DEV.solar,'measure_power')||0,hW=houseNowW(),pw=cap(DEV.pulse,'measure_power'),bw=cap(DEV.battery,'measure_power')||0,bsx=cap(DEV.battery,'battery_charging_state');
    const gi=(pw!=null&&pw>0)?pw:0,bi=(bsx==='discharging')?Math.abs(bw):0,si=Math.max(0,(hW||0)-gi-bi);title='Självförsörjning';
    body=dRow('Förbrukning nu',hW==null?'–':W(hW))+dRow('Från sol',W(si))+dRow('Från batteri',W(bi))+dRow('Från nät',W(gi))+dRow('Egen el',(hW?Math.round((si+bi)/hW*100):(pw!=null&&pw<0?100:0))+' %');
  }else if(which==='kopt'){
    var per=(CFG.ks&&CFG.ks.per)||'month';
    var perTxt={day:'idag',week:'denna vecka',month:'denna månad',year:'i år'}[per]||'';
    var perLbl={day:'Idag',week:'Vecka',month:'Månad',year:'År'}[per]||'';
    title='Köpt / sålt';
    var r=monPer(per);
    var rk=Math.round(r.k||0), rs=Math.round(r.s||0), net=rk-rs;
    var kInt=function(v){return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g,'\u00a0');};
    var pers=[['day','Idag'],['week','Vecka'],['month','Månad'],['year','År']];
    var seg='<div class="seg-row" style="margin-bottom:12px">';
    for(var pi=0;pi<pers.length;pi++)seg+='<button class="seg-btn'+(per===pers[pi][0]?' on':'')+'" onclick="ksSetPerDetail(\''+pers[pi][0]+'\')">'+pers[pi][1]+'</button>';
    seg+='</div>';
    body=seg
      +dRow('Köpt '+perTxt,r.st?(kInt(rk)+' kr'):'–')
      +dRow('Sålt '+perTxt,r.st?(kInt(rs)+' kr'):'–')
      +dRow('Netto',r.st?((net>0?'−':net<0?'+':'')+kInt(Math.abs(net))+' kr'):'–')
      +dRow('Köpt energi',r.ki?kInt(Math.round(r.ki))+' kWh':'–')
      +dRow('Såld energi',r.so?kInt(Math.round(r.so))+' kWh':'–');
    var note='Köpt är Tibbers egen siffra. Sålt är en uppskattning från hur många kWh elmätaren rapporterat ut på nätet.';
    body+='<div class="det-note">'+note+'</div>';
  }else if(which==='temps'){title='Temperaturer';
    _grafByggare['temps']={titel:'Temperaturer',full:function(cid){return multiTempSVG(cid||'temps');}};
    _grafOmRita=function(){var b=$('dlg-body');if(b)b.innerHTML=byggTemps();};
    body=byggTemps();
  }else if(which==='battladd'){title='Ladda husbatteriet';_blMal='batt';
    /* Rutan ritas om när priserna landar, så prisvalen dyker upp av sig själva. */
    _popupRebuild=battLaddHTML;
    if(!_prisJ){_prisAt=0;try{prisVarHamta();}catch(e){}}
    body=battLaddHTML();
  }else if(which==='breveden'){title='Breveden · AC';
    _brvUtkast=null;
    body=brvPopHTML();
  }else if(which==='cost'){title='Kostnad & pris';
    _popupRebuild=buildCostPopup;
    /* Saknas Tibber-serien: hämta nu, förbi 15-minuterscachen. Rutan ritas
       om av _popupRebuild när svaret kommer. */
    if(!_prisJ){_prisAt=0;try{prisVarHamta();}catch(e){}}
    body=buildCostPopup();
  }else if(which==='pool'){title='Pool';const rt=poolRate(),ph=cap(DEV.poolheat,'onoff'),pv=cap(DEV.pooltemp,'measure_temperature');
    _grafByggare['pool']={titel:'Pooltemperatur',full:function(cid){return histSVG(poolHistKey(),{unit:'°C',icon:'swimming-pool'},cid||'pool');}};
    /* Raderna räknas inline nedan med lokala variabler, så omritningen byter
       bara grafdelen (#pool-graf) och lämnar raderna som de är. */
    _grafOmRita=function(){var g=$('pool-graf');if(g)g.innerHTML=byggPool();};
    let prog='';if(rt!=null&&rt>=0.05&&pv!=null){const nextDeg=Math.floor(pv)+1,hrs=(nextDeg-pv)/rt;if(hrs>0&&hrs<24)prog=dRow('Når '+nextDeg+'°','ca '+hhmm(new Date(Date.now()+hrs*3600000)));}
    /* Dygnets förändring. Mätserien börjar vid midnatt om sidan varit igång, annars
       vid första mätvärdet efter att den öppnades – klockslaget skrivs ut så det syns
       vilken period siffran faktiskt gäller. */
    /* Appen räknar poolens dygn ur hela Insights-serien, oavsett om sidan varit
       öppen. Egen historik används när appen inte svarar. */
    let idag=poolDygnRader();
    body='<div id="pool-graf">'+byggPool()+'</div>'
      +dSec('Nu')
      +dRow('Pooltemp',num(pv,1)+' °C')
      +idag
      +dRow('Poolvärme',(ph==='on'||ph===true)?'på':'av')
      /* Poolvärmens knapp i poolens popup när knappavsnittet är gömt (v690:
         den riktiga knappen ur knappavsnittet). */
      +((CFG&&CFG.paNu)?popKnappar('pool'):'')
      +(rt!=null?dRow('Trend',(rt>=0?'+':'')+num(rt,1)+' °/h'):'')
      +prog
      +dRow('Poolrum',num(cap('261bb3cf-1d26-4aba-8f36-f5858b40cc20','measure_temperature'),1)+' °C')+dRow('Luftfukt poolrum',num(cap('261bb3cf-1d26-4aba-8f36-f5858b40cc20','measure_humidity'),0)+' %');
  }else if(which==='regellogg'){title='Laddregelns förslag';
    _popupRebuild=rlPopup;_grafOmRita=function(){var b=$('dlg-body');if(b)b.innerHTML=rlPopup();};
    /* Hämtningen först: i demoläget sätts loggen direkt, utan att vänta. */
    _dlgWide=true;_rlDag=null;                       /* v699: bredd · v700: dygnet väljs efter bokningen */
    rlHamta(false);try{hist7Hamta(false);}catch(e){}try{regelHamta(false);}catch(e){}body=rlPopup();
  }else if(which==='tv'){title='TV';
    /* v713: samma innehåll som den gamla TV-rutans fjärrkontroll. */
    _popupRebuild=gtvHTML;
    body=gtvHTML();
  }else if(which==='hem'){title='Hem';
    /* (v692) Belysningsrutans ⋯ öppnar den här: Auto, Skivspelare och Tänd. */
    _grafOmRita=function(){var b=$('dlg-body');if(b)b.innerHTML=hemPopup();};
    body=hemPopup();
  }else if(which==='dish'){title='Diskmaskin';const lg=diskLage(),kor=(lg==='kor'),pr=parsePct(cap(DEV.dish,'bshc_string.progress')),rem=parseRemain(cap(DEV.dish,'bshc_string.remaining_time'));
    const bar=(kor&&pr!=null)?('<div class="pbar"><i style="width:'+pr+'%"></i></div>'):'';
    body=dRow('Status',kor?'diskar':(lg==='redo'?'går inte':'avstängd'))+(pr!=null&&kor?dRow('Klart',pr+' %'):'')+(kor&&rem!=null&&rem>0?dRow('Tid kvar','~'+(rem>=60?Math.floor(rem/60)+' h '+(rem%60)+' min':rem+' min'))+dRow('Klar ca',finishTime(rem)):'')+bar
      +((CFG&&CFG.paNu)?popKnappar('dish'):'');
  }else if(which==='cars'){title='Bilar';
    /* Egen byggare, så växlarna kan rita om rutan utan att bygga om allt. */
    _popupRebuild=buildCarsPopup;
    _bilStromUtk=null;try{regelHamta(false);}catch(e){}
    body=buildCarsPopup();
  }else if(which==='billadd'){title='Ladda bilen';_blMal='bil';
    /* v719: bilens laddruta. Ritas om när priserna landar, som husbatteriets. */
    _popupRebuild=bilLaddPopHTML;_bilStromUtk=null;
    if(!_prisJ){_prisAt=0;try{prisVarHamta();}catch(e){}}
    try{regelHamta(false);}catch(e){}
    body=bilLaddPopHTML();
  }else if(which==='air'){title='Luft i köket';
    body=dRow('CO₂',num(cap(DEV.vader,'measure_co2'),0)+' ppm')+dRow('Temperatur',num(cap(DEV.vader,'measure_temperature'),1)+' °C')+dRow('Luftfukt',num(cap(DEV.vader,'measure_humidity'),0)+' %')+dRow('Ljudnivå',num(cap(DEV.vader,'measure_noise'),0)+' dB');
  }else if(which==='sold'){title='Elnät · totalt';
    body=dRow('Sålt totalt',num(cap(DEV.pulse,'meter_power.exported'),0)+' kWh')+dRow('Köpt totalt',num(cap(DEV.pulse,'meter_power.imported'),0)+' kWh')+dRow('Netto',num((cap(DEV.pulse,'meter_power.imported')||0)-(cap(DEV.pulse,'meter_power.exported')||0),0)+' kWh');
  }else if(which==='boughtyear'){const dlgw=$('dlg');if(dlgw&&dlgw.classList)dlgw.classList.add('wide');
    setT('dlg-title','Förbrukning & historik');setIcon('dlg-ic','plug');
    const bdb=$('dlg-body');if(bdb)bdb.innerHTML=buildBoughtYear();
    const bkb=$('dlg-back');if(bkb&&bkb.classList)bkb.classList.add('open');dlgTop();return;
  }else if(which==='weather'){title='Väder · Onsala';
    /* v766: läget nu som rutor och SMHI:s prognos – se vpHTML. Har prognosen
       inte kommit än hämtas den, och prognosdelen ritas om när den landat. */
    body=vpHTML();
    if(!FORECAST)fetchSmhiForecast().then(function(){var e=$('vp-prog');
      if(e&&_dlgWhich==='weather'){e.innerHTML=vpPrognosHTML();}});
  }else if(which==='humidity'){title='Luftfuktighet';
    body=dRow('Utomhus',num(cap(DEV.outdoor,'measure_humidity'),0)+' %')+dRow('Inne · kök',num(cap(DEV.vader,'measure_humidity'),0)+' %')+dRow('Poolrum',num(cap('261bb3cf-1d26-4aba-8f36-f5858b40cc20','measure_humidity'),0)+' %');
  }else if(which==='rain'){title='Regn';
    body=dRow('Senaste timmen',num(cap(DEV.rain,'measure_rain.1h'),1)+' mm')+dRow('Senaste 24h',num(cap(DEV.rain,'measure_rain.24h'),1)+' mm')+dRow('Intensitet nu',num(cap(DEV.rain,'measure_rain'),1)+' mm/h')+dRow('SMHI-läge',esc(cap(DEV.smhi,'measure_precipitation_situation_cp')||'–'))+dRow('Åska (sannolikhet)',num(cap(DEV.smhi,'measure_thunder_probability_cp'),0)+' %');
  }else if(which==='pressure'){const pr=cap(DEV.vader,'measure_pressure')||cap(DEV.smhi,'measure_air_pressure_cp'),tr=pressureTrend(pr);title='Lufttryck';
    body=dRow('Nu',num(pr,0)+' hPa')+dRow('Trend (3h)',tr>0?'stigande ↑':tr<0?'sjunkande ↓':'stabilt →')+dRow('Tyder ofta på',tr>0?'uppklarnande väder':tr<0?'sämre väder på väg':'oförändrat väder');
  }else if(which==='wind'){const wdir=windDeg();title='Vind';
    /* Raden "Enhetens text" visade vindmätarens egen textcapability när den sa
   något annat än den uppmätta vinkeln. Den lades till i v291 för att spåra
   den fastnade VSV-texten. Vanligtvis är skillnaden bara att texten släpar
   efter någon minut, så raden är borttagen. Vinkeln styr fortfarande. */
    /* Grafen längst upp i rutan, före sifferraderna. Samma mönster som
       elrutorna: rubrik, graf, tidsval, helskärm. */
    _grafByggare['wind']={titel:'Vind',full:function(cid){return windChartHTML(cid||'wind');}};
    _grafOmRita=function(){var w2=$('wind-sec');if(w2)w2.innerHTML=windSectionHTML();};
    body='<div id="wind-sec">'+windSectionHTML()+'</div>'
      +dRow('Hastighet',num(vindMs(),1)+' m/s')+dRow('Byvind',num(byMs(),1)+' m/s')+dRow('Riktning',(windDirTxt(wdir)||'–')+(wdir!=null?' · '+num(wdir,0)+'°':''))+dRow('SMHI-vind',num(cap(DEV.smhi,'measure_wind_speed_cp'),1)+' m/s');
    windInsFetch();                                  /* dygnets toppar ur Insights */
    _dlgWide=true;                                   /* grafen behöver bredden */
  }else if(which==='seatemp'){title='Badtemp · '+(CONFIG.BATH_NAME||'havet');
    _grafByggare['seatemp']={titel:'Badtemperatur',full:function(cid){return histSVG('k:seatemp',{unit:'°C',icon:'waves'},cid||'seatemp');}};
    _grafOmRita=function(){var g=$('sea-graf');if(g)g.innerHTML=byggSeatemp();};
    const t=(typeof FEED!=='undefined')?FEED.sea:null;
    let lo=null,hi=null;try{const e=learnGet()['k:seatemp'];if(e&&e.s&&e.s.length){const cut=Date.now()-24*3600000;const vs=e.s.filter(p=>p[0]>=cut).map(p=>p[1]);if(vs.length){lo=Math.min.apply(null,vs);hi=Math.max.apply(null,vs);}}}catch(e){}
    const cls=t==null?'':(t>=20?'skönt':t>=17?'friskt':t>=14?'svalt':'kallt');
    body='<div id="sea-graf">'+byggSeatemp()+'</div>'
      +dSec('Nu')
      +dRow('Just nu',t==null?'–':num(t,1)+' °C'+(cls?' · '+cls:''))
      +(lo!=null?dRow('Dygnets lägsta',num(lo,1)+' °C'):'')
      +(hi!=null?dRow('Dygnets högsta',num(hi,1)+' °C'):'')
      +dRow('Plats',esc(CONFIG.BATH_NAME||'havet')+' ('+num(CONFIG.BATH_LAT,3)+', '+num(CONFIG.BATH_LON,3)+')')
      +dRow('Poolen (jämför)',num(cap(DEV.pooltemp,'measure_temperature'),1)+' °C')
      +dRow('Källa','SMHI/Open-Meteo · ytvattentemp');
  }else if(which==='indoor'){title='Inomhus';
    const tv=cap(DEV.vard,'measure_temperature'),tk=cap(DEV.vader,'measure_temperature'),avg=indoorAvgTemp();
    body=ptsLineSVG(indoorAvgSeries('indoor'),'warm','°C','indoor',HIST_H,'Inomhus')+grafTidsval('indoor')
      +dRow('Medel',avg==null?'–':num(avg,1)+' °C')
      +dRow('Vardagsrum',tv==null?'–':num(tv,1)+' °C')
      +dRow('Kök',tk==null?'–':num(tk,1)+' °C')
      +dRow('Uterum',(function(){const u=cap(DEV.uterum,'measure_temperature');return u==null?'–':num(u,1)+' °C';})());
  }else if(which==='uterum'||which==='snickarboa'||which==='poolrum'||which==='vardagsrum'){title=ZK[which].lab;
    /* v736: rumsrutans popup – graf, läget nu och rummets enheter. Ritas om vid
       varje hämtning (_popupRebuild) och när en enhet växlas (rumPopupUppdatera). */
    _zkVald=null;
    _popupRebuild=function(){return zkPopHTML(which);};_popupRebuild._zk=true;
    _grafOmRita=function(){var b=$('dlg-body');if(b)b.innerHTML=zkPopHTML(which);};
    body=zkPopHTML(which);
  /* 'temprange' (Utomhustemperatur) borttagen i v654 — den visade samma serie
     som Ute-zonen i temperaturrutan, plus dygnets högsta och lägsta som nu
     står i raderna där. */
  }else if(which==='energyfull'){const dlgw=$('dlg');if(dlgw&&dlgw.classList){dlgw.classList.add('wide');dlgw.classList.add('nohead');}
    _energyAlt=false;_energyOpen=true;_popupRebuild=energyPopupRender;
    /* Tidsvalet på förbrukning nu-grafen (g2-day) ritar om via _grafOmRita. */
    _grafOmRita=function(){var b=$('dlg-body');if(b)b.innerHTML=energyPopupRender();};
    const bde=$('dlg-body');if(bde)bde.innerHTML=energyPopupRender();
    const bke=$('dlg-back');if(bke&&bke.classList)bke.classList.add('open');dlgTop();return;
  }else if(which==='wxwind'){const dlgw=$('dlg');if(dlgw&&dlgw.classList){dlgw.classList.add('wide');dlgw.classList.add('nohead');}
    _popupRebuild=buildWxWindPopup;setT('dlg-title','Väder & vind');setIcon('dlg-ic','cloud-sun');
    const bdw=$('dlg-body');if(bdw)bdw.innerHTML=buildWxWindPopup();
    const bkw=$('dlg-back');if(bkw&&bkw.classList)bkw.classList.add('open');dlgTop();return;
  }else if(which==='forecast'){
    const dlgw=$('dlg');if(dlgw&&dlgw.classList)dlgw.classList.add('wide');
    setT('dlg-title','Väder · detaljerat');setIcon('dlg-ic','cloud-sun');
    const bd0=$('dlg-body');if(bd0)bd0.innerHTML=buildForecastHTML();
    const bk0=$('dlg-back');if(bk0&&bk0.classList)bk0.classList.add('open');dlgTop();
    return;
  }
  /* Klasserna nollställs här, efter grenarna. En gren som behöver en bred ruta
     sätter därför _dlgWide i stället för att lägga på klassen själv – annars
     plockas den bort igen på raden nedan. */
  const dlgn=$('dlg');if(dlgn&&dlgn.classList){dlgn.classList.toggle('wide',!!_dlgWide);dlgn.classList.remove('edit');}
  /* 'batt' tillkom i v598: batteripopupen har en egen tolvtimmarsgraf sedan
     v597, och brickans generella histSVG lade en andra graf ovanpå den — två
     bilder av samma batteri i samma ruta, med olika fönster och olika skala.
     Samma skäl som 'grid' redan står här av. */
  if(tcfg&&tcfg.graph!==false&&which!=='cost'&&which!=='sun'&&which!=='forecast'&&which!=='grid'&&which!=='batt'&&which!=='wind'&&which!=='pool'&&which!=='seatemp'&&which!=='temps'&&!(typeof ZK!=='undefined'&&ZK[which])){const gv=metricVizHTML(tcfg);if(gv)body=metricVizIsBars(tcfg)?(body+gv):(gv+body);}
  setT('dlg-title',title);setIcon('dlg-ic',icn);const bd=$('dlg-body');if(bd)bd.innerHTML=body;
  const back=$('dlg-back');if(back&&back.classList)back.classList.add('open');dlgTop();}
function closeDetail(e){if(e){const t=e.target,onX=t&&t.closest&&t.closest('.dlg-x'),onBack=t&&t.classList&&t.classList.contains('dlg-back');if(!onX&&!onBack)return;}
  const back=$('dlg-back');if(back&&back.classList)back.classList.remove('open');const dl=$('dlg');if(dl&&dl.classList)dl.classList.remove('nohead');_popupRebuild=null;_energyOpen=false;
  /* v709: popupens omritare följer inte med till nästa popup. */
  _grafOmRita=null;_dlgWhich=null;
  if(_dlgIdle){clearTimeout(_dlgIdle);_dlgIdle=null;}}
function openReport(){if(_suppressClick){_suppressClick=false;return;}
  const dlgn=$('dlg');if(dlgn&&dlgn.classList){dlgn.classList.remove('wide');dlgn.classList.remove('edit');}
  const list=(_warnList&&_warnList.length)?_warnList:[['okc','leaf','Inget att rapportera – allt ser bra ut','']];
  let body='<div class="rep-list">';
  list.forEach(a=>{const cls=a[0],ic=a[1],txt=a[2],lvl=a[3];
    const acc=cls==='crit'?'acc-hot':cls==='okc'?'acc-green':'acc-warm';
    body+='<div class="rep-row"><span class="rep-ic '+acc+'">'+icon(ic)+'</span><span class="rep-tx">'+txt+'</span>'+(lvl?'<span class="rep-lv">'+esc(lvl)+'</span>':'')+'</div>';});
  body+='</div>';
  setT('dlg-title','Rapport');setIcon('dlg-ic','warning');
  const bd=$('dlg-body');if(bd)bd.innerHTML=body;
  const back=$('dlg-back');if(back&&back.classList)back.classList.add('open');dlgTop();}

/* ---- flikar ---- */
function showView(tab){if(!tab)return;
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('hidden',v.id!=='view-'+tab));
  try{flikradAktiv();}catch(e){}}
function gbgKnappSyns(){
  try{var v=localStorage.getItem(PIXEL_KEY);if(v==='1')return true;if(v==='0')return false;}catch(e){}
  try{var ua=String(navigator.userAgent||'');if(/Pixel(?! ?Tablet)/i.test(ua)&&!/Tablet/i.test(ua))return true;}catch(e){}
  return false;}
function arPixelModell(m){return /Pixel/i.test(String(m||''))&&!/Tablet/i.test(String(m||''));}
function gbgKnappKoll(){try{
  var q=(location.search||'').match(/[?&]gbgknapp=([01])/);
  if(q){localStorage.setItem(PIXEL_KEY,q[1]);return;}
  if(localStorage.getItem(PIXEL_KEY)!=null)return;
  var uad=navigator.userAgentData;
  if(!uad||typeof uad.getHighEntropyValues!=='function'){localStorage.setItem(PIXEL_KEY,gbgKnappSyns()?'1':'0');return;}
  uad.getHighEntropyValues(['model']).then(function(r){
    var ja=arPixelModell(r&&r.model);
    try{localStorage.setItem(PIXEL_KEY,ja?'1':'0');}catch(e){}
    if(ja){try{flikradBygg();}catch(e){}}
  }).catch(function(){});
}catch(e){}}
function flikradBygg(){
  if(!document.body)return;
  var mob=document.body.classList.contains('mobile');
  /* Toppradens vyknappar märks så CSS kan gömma dem i mobilläget. */
  document.querySelectorAll('.en-top button').forEach(function(b){
    var oc=b.getAttribute('onclick')||'';
    if(b.classList.contains('en-hem')||/openInsikter|openCompare|openVader/.test(oc))b.classList.add('en-nav');});
  var nav=document.getElementById('flikrad');
  if(!nav){nav=document.createElement('nav');nav.id='flikrad';nav.className='flikrad';
    nav.setAttribute('aria-label','Vyer');}
  /* Mobilen: fast längst ned på skärmen (body). Plattan: sist i .wrap, som en
     del av den låsta ramen — då räknar fitScreen in den och ingenting hamnar
     bakom den. */
  var hem=mob?document.body:(document.querySelector('.wrap')||document.body);
  if(nav.parentElement!==hem)hem.appendChild(nav);
  var flikar=FLIKAR.slice();
  if(gbgKnappSyns())flikar.push(['gbg','arrows-left-right','Göteborg','husVaxla()']);
  nav.innerHTML=flikar.map(function(f){return '<button type="button" class="flik" data-flik="'+f[0]+'" onclick="'+f[3]+'">'
    +icon(f[1])+'<span>'+f[2]+'</span></button>';}).join('');
  hallInne(nav.querySelector('[data-flik="flode"]'),function(){openConfig();});
  flikradAktiv();
  mobilTopp(mob);
  if(mob)flikSkroll();
}
/* TOPPRADEN BORT I MOBILLÄGET (v676). Vyerna finns i flikraden; klockan och
   liveprickan flyttar in i energirutan, till höger om brickorna Självförsörjt
   och Elpris uppe till höger (v677). Toppraden
   syns bara i historikläget — där bär den tidstexten. */
function mobilTopp(mob){
  var h=document.getElementById('en-hogra');if(!h)return;
  ['en-notis','en-status'].forEach(function(id){var e=document.getElementById(id);if(e&&e.parentElement!==h)h.appendChild(e);});
  /* ALTERNATIV A (v678): två fasta rader. Rad 1 = förbrukningen och, till
     höger, klockan och pricken. Rad 2 = Självförsörjt och elpriset, lika
     breda kant i kant. Ordningen läggs om i DOM:en i stället för med
     display:contents, så layouten går att mäta i wkhtmltoimage. */
  /* På plattan ryms allt på en rad: talet till vänster, brickorna, klockan och
     pricken till höger (klockan och pricken ligger kvar i brickgruppen). Två
     rader (alternativ A) bara på mobilen. */
  var hero=h.closest('.en-hero'),main=hero&&hero.querySelector('.en-hero-main'),spot=hero&&hero.querySelector('.en-spot');
  /* Väggplattan (kiosk) får också två rader: avsnitten är förstorade där, och
     då ryms inte talet och alla fyra brickorna på en rad (uppmätt). */
  var tvaRader=(mob!==false)||document.body.classList.contains('kiosk');
  if(!tvaRader){
    /* Tillbaka till en rad (t.ex. plattan vriden till liggande). */
    var grp=hero&&hero.querySelector('.en-hoger');
    if(grp&&spot&&spot.parentElement!==grp){grp.style.display='';grp.insertBefore(spot,grp.firstChild);grp.appendChild(h);}
    if(hero)hero.classList.remove('en-hero-a');
    document.body.classList.add('topp-flyttad');return;}
  if(hero&&main&&spot){
    if(main.nextElementSibling!==h)hero.insertBefore(h,main.nextSibling);
    if(hero.lastElementChild!==spot)hero.appendChild(spot);
    var tom=hero.querySelector('.en-hoger');if(tom&&!tom.children.length)tom.style.display='none';
    hero.classList.add('en-hero-a');
  }
  document.body.classList.add('topp-flyttad');
}
function flikSkroll(){
  if(window._flikSkrollPa)return;window._flikSkrollPa=true;
  _flikY=window.scrollY||0;
  window.addEventListener('scroll',function(){
    var y=window.scrollY||0,nav=document.getElementById('flikrad');if(!nav)return;
    /* v739: "nära toppen" är högst en tredjedel av hur långt sidan går att
       skrolla. Med en fast gräns på 40 px gömdes raden aldrig på en sida som
       bara gick att skrolla 30–40 px – först när rummen fälldes ut. */
    var max=Math.max(0,(document.documentElement.scrollHeight||0)-(window.innerHeight||0));
    var topp=Math.min(40,max/3);
    if(y<=topp)nav.classList.remove('dold');
    else if(y>_flikY+8)nav.classList.add('dold');
    else if(y<_flikY-8)nav.classList.remove('dold');
    else return;
    _flikY=y;
  },{passive:true});
}
function flikradAktiv(){
  var nav=document.getElementById('flikrad');if(!nav)return;
  var syns=null;document.querySelectorAll('.view').forEach(function(v){if(!v.classList.contains('hidden'))syns=v.id.replace('view-','');});
  nav.querySelectorAll('.flik').forEach(function(b){var a=b.getAttribute('data-flik')===syns;
    b.classList.toggle('akt',a);if(a)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
}

/* ---- energipanel (källmix + kort) ---- */
function renderEnergy(){
  const p=PAL[curTheme]||PAL.dark;
  const solarW=cap(DEV.solar,'measure_power')||0,houseW=houseNowW(),pulseW=cap(DEV.pulse,'measure_power');
  const battPct=cap(DEV.battery,'measure_battery'),battW=cap(DEV.battery,'measure_power')||0,bs=cap(DEV.battery,'battery_charging_state');
  const importing=pulseW!=null&&pulseW>0,exporting=pulseW!=null&&pulseW<0,charging=bs==='charging',discharging=bs==='discharging';
  setT('en-house',houseW==null?'–':W(houseW));
  // källmix mot förbrukning
  const gridIn=importing?pulseW:0, battIn=discharging?Math.abs(battW):0;
  /* Solen till huset kan aldrig vara mer än vad panelerna faktiskt producerar just nu.
     Utan taket blev varje oförklarad watt (mätglapp, batteri som inte rapporterar
     'discharging') felaktigt märkt som sol – t.ex. mitt i natten. */
  const solToHouse=Math.max(0,Math.min(solarW,(houseW||0)-gridIn-battIn));
  const T=(houseW&&houseW>0)?(gridIn+battIn+solToHouse):0;
  const pct=v=>T>0?(v/T*100):0;
  const ms=$('mix-sol'),mb=$('mix-batt'),mg=$('mix-grid');
  if(ms&&ms.style)ms.style.width=pct(solToHouse).toFixed(1)+'%';
  if(mb&&mb.style)mb.style.width=pct(battIn).toFixed(1)+'%';
  if(mg&&mg.style)mg.style.width=pct(gridIn).toFixed(1)+'%';
  const of=T>0?((solToHouse+battIn)/T):(exporting?1:0);
  const badge=$('en-self-badge');if(badge){badge.textContent=houseW==null?'–':Math.round(of*100)+'% självförsörjt';if(badge.classList)badge.classList.toggle('imp',of<0.999&&!exporting);}
  // legend
  const leg=$('mix-leg');if(leg){leg.innerHTML=
    '<span><i style="background:'+p.sun+'"></i>Sol '+W(solToHouse)+'</span>'
    +'<span><i style="background:'+p.cyan+'"></i>Batteri '+W(battIn)+'</span>'
    +'<span><i style="background:'+p.warm+'"></i>Nät '+W(gridIn)+'</span>';}
  renderTiles('energy');
}
