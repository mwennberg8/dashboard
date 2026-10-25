/* js/rutor.js — Rutorna: anpassningsbara och flyttbara rutor, när batteriet tog slut, katalogen och de självlärande glow-nivåerna.
 *
 * Filen innehåller BARA funktionsdeklarationer. Konstanter, tillstånd och allt
 * som körs direkt vid laddning ligger i js/start.js, som laddas sist, under
 * rubriken [rutor.js]. En funktion går att anropa oavsett vilken fil den står
 * i, men kod som körs vid laddning kan här anropa en funktion i en fil som inte
 * hunnit laddas. Lägg den därför aldrig här.
 */

/* Fyllningens styrka. 26% var for svagt for att se skillnaden pa en ljus skarm i
   solljus - nu 42% som standard, och stallbar i Installningar > Utseende. */
function krcOpac(){var v=(CFG&&CFG.krcOp);return (v!=null&&isFinite(v))?Math.max(.1,Math.min(.8,v)):0.42;}
function krcPer(cfg){var p=cfg&&cfg.per;return KRC_PER.indexOf(p)>=0?p:'month';}
function krcCykla(g,i){
  var a=gridTiles(g), c=a[i]; if(!c)return;
  c.per=KRC_PER[(KRC_PER.indexOf(krcPer(c))+1)%KRC_PER.length];
  saveGrid(g); renderTiles(g);}
/* Skifta en hex-färg i nyans (grader på färgcirkeln). Enkel HSL-rotation. */
function hexHueShift(hex,deg){
  if(!deg)return hex;
  var m=/^#?([0-9a-f]{6})$/i.exec(hex||''); if(!m)return hex;
  var n=parseInt(m[1],16), r=(n>>16)&255, gg=(n>>8)&255, b=n&255;
  r/=255;gg/=255;b/=255;
  var mx=Math.max(r,gg,b),mn=Math.min(r,gg,b),h=0,sl=0,l=(mx+mn)/2,dd=mx-mn;
  if(dd){sl=l>.5?dd/(2-mx-mn):dd/(mx+mn);
    h=mx===r?(gg-b)/dd+(gg<b?6:0):mx===gg?(b-r)/dd+2:(r-gg)/dd+4; h/=6;}
  h=(h*360+deg)%360; if(h<0)h+=360; h/=360;
  function hue2(p2,q2,t2){if(t2<0)t2+=1;if(t2>1)t2-=1;if(t2<1/6)return p2+(q2-p2)*6*t2;if(t2<1/2)return q2;if(t2<2/3)return p2+(q2-p2)*(2/3-t2)*6;return p2;}
  var q=l<.5?l*(1+sl):l+sl-l*sl, pp=2*l-q;
  var R=Math.round(hue2(pp,q,h+1/3)*255),G=Math.round(hue2(pp,q,h)*255),B=Math.round(hue2(pp,q,h-1/3)*255);
  return '#'+((1<<24)+(R<<16)+(G<<8)+B).toString(16).slice(1);}
function _hex2hsl(hex){var m=/^#?([0-9a-f]{6})$/i.exec(hex||'');if(!m)return null;
  var n=parseInt(m[1],16),r=((n>>16)&255)/255,g=((n>>8)&255)/255,b=(n&255)/255;
  var mx=Math.max(r,g,b),mn=Math.min(r,g,b),h=0,sl=0,l=(mx+mn)/2,d=mx-mn;
  if(d){sl=l>.5?d/(2-mx-mn):d/(mx+mn);h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;h/=6;}
  return {h:h,s:sl,l:l};}
function _hsl2hex(o){var h=o.h,sl=o.s,l=o.l;
  function f(p2,q2,t2){if(t2<0)t2+=1;if(t2>1)t2-=1;if(t2<1/6)return p2+(q2-p2)*6*t2;if(t2<1/2)return q2;if(t2<2/3)return p2+(q2-p2)*(2/3-t2)*6;return p2;}
  var q=l<.5?l*(1+sl):l+sl-l*sl,pp=2*l-q;
  var R=Math.round(f(pp,q,h+1/3)*255),G=Math.round(f(pp,q,h)*255),B=Math.round(f(pp,q,h-1/3)*255);
  return '#'+((1<<24)+(R<<16)+(G<<8)+B).toString(16).slice(1);}
/* Sifferfärg: samma kulör som fyllningen men MER mättad och skjuten i ljushet bort
   från den bleka/dunkla fyllningen, så siffrorna sticker ut tydligt. Tema-medvetet. */
function krcTextCol(hex){
  var o=_hex2hsl(hex); if(!o)return hex;
  o.s=Math.min(1,o.s*1.5+0.12);
  var lightTheme=(curTheme==='light');
  o.l=lightTheme?Math.min(o.l,0.40):Math.max(o.l,0.66);
  return _hsl2hex(o);}
function krcColors(cfg){
  var base=KRC_COLS[cfg&&cfg.col]||KRC_COLS.varm, deg=(cfg&&cfg.hue)||0;
  return {kop:hexHueShift(base.kop,deg), sal:hexHueShift(base.sal,deg)};}
function krcTileOp(cfg){var v=cfg&&cfg.op;return (v!=null&&isFinite(v))?Math.max(.1,Math.min(.85,v)):krcOpac();}
function krcHTML(g,i,cfg){
  var per=krcPer(cfg), r=monPer(per);
  var C=krcColors(cfg), KOP=C.kop, SAL=C.sal;
  var wide=(cfg.key==='krcmp2');
  var kr=function(v){return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g,'\u00a0');};
  var tot=r.k+r.s, pk=tot>0?Math.round(r.k/tot*100):50, ps=100-pk;
  var tom=!r.st;
  var rk=Math.round(r.k), rs=Math.round(r.s);
  var kopC=krcTextCol(KOP), salC=krcTextCol(SAL);
  function rgba(hex,a){var m=/^#?([0-9a-f]{6})$/i.exec(hex||'');if(!m)return hex;var n=parseInt(m[1],16);return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')';}
  var op=krcTileOp(cfg);
  var kInt=function(v){return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g,'\u00a0');};
  /* Fält = en flik med belopp + "Köpt"/"Sålt" under. Fälten ÄR bakgrunden: de fyller
     hela brickan, växer proportionellt (pk:ps) men aldrig smalare än sitt innehåll. */
  function fld(col,txt,amt,cap,side){
    return '<div class="krc-fld'+(side==='sal'?' krc-fld-r':'')+'" style="flex-grow:'+col+';background:'+txt+'">'
      +'<span class="krc-amt">'+amt+'</span><span class="krc-cap">'+cap+'</span></div>';}
  var sz=krcSz(cfg);   /* textstorleks-faktor */
  var h='<div class="panel stat krc'+(wide?' krc-w':'')+'" data-slot="'+i+'" style="--krcsz:'+sz+'">';
  /* Rubrik "KÖPT / SÅLT • PERIOD" centrerad overst. */
  h+='<div class="krc-head">Köpt / sålt • '+KRC_LBL[per]+'</div>';
  var flds='';
  if(tom)flds='<div class="krc-fld" style="flex-grow:1;background:'+rgba(KOP,op)+'"><span class="krc-amt" style="opacity:.6">–</span><span class="krc-cap">ingen logg än</span></div>';
  else if(rs<=0)flds=fld(1,rgba(KOP,op),'<b style="color:'+kopC+'">'+kInt(rk)+' kr</b>','Köpt • 100 %');
  else if(rk<=0)flds=fld(1,rgba(SAL,op),'<b style="color:'+salC+'">'+kInt(rs)+' kr</b>','Sålt • 100 %','sal');
  else flds=fld(pk,rgba(KOP,op),'<b style="color:'+kopC+'">'+kInt(rk)+' kr</b>','Köpt • '+pk+' %','kop')
    +fld(ps,rgba(SAL,op),'<b style="color:'+salC+'">'+kInt(rs)+' kr</b>','Sålt • '+ps+' %','sal');
  h+='<div class="krc-flds">'+flds+'</div>';
  h+='</div>';
  return h;}
/* Prisfärg: 0 = billigt (grön) -> 1 = dyrt (röd). Matchar spårets gradient. */
/* Rått spotpris (kr) -> allt-inkl-pris (kr): + moms (%) + påslag/avgifter (öre). */
/* Elpriset kommer redan färdigt (inkl. skatt, moms och avgifter) från Homeys pris-tag
   measure_price_total – samma källa som Homeys energisida. Ingen omräkning behövs. */
function spotAllIn(raw){return (raw==null||!isFinite(raw))?null:raw;}
function priceColor(frac){
  var f=Math.max(0,Math.min(1,frac));
  var stops=[[0,[0x3f,0xb9,0x50]],[0.35,[0x88,0xc0,0x50]],[0.62,[0xe6,0xa5,0x3a]],[1,[0xd0,0x50,0x50]]];
  var i=0;while(i<stops.length-1&&f>stops[i+1][0])i++;
  var a=stops[i],b=stops[Math.min(i+1,stops.length-1)];
  var t=(b[0]===a[0])?0:(f-a[0])/(b[0]-a[0]);
  var c=[0,1,2].map(function(k){return Math.round(a[1][k]+(b[1][k]-a[1][k])*t);});
  return 'rgb('+c[0]+','+c[1]+','+c[2]+')';}
function krcSz(cfg){return 1;}   /* v727: fast textstorlek */
function gridTiles(g){if(TILESTATE[g])return TILESTATE[g];const G=GRIDS[g];let a=null;const flex=(g==='flode');
  try{const s=localStorage.getItem(G.store);if(s){const p=JSON.parse(s);if(Array.isArray(p)&&p.length>=1){
    if(flex){if(p.length<=12)a=p;}
    else if(g==='energy'){if(p.length===G.def.length)a=p;else if(p.length===4){const q=p.filter(t=>!(t&&t.type==='computed'&&t.key==='charger'));a=(q.length===3?q:p.slice(0,3));try{localStorage.setItem(G.store,JSON.stringify(a));}catch(e){}}}
    else if(p.length===G.def.length)a=p;}}}catch(e){}
  if(!a&&g==='flode'){try{const old=localStorage.getItem('tilesFlode_v4')||localStorage.getItem('tilesFlode_v3');if(old){let p=JSON.parse(old);if(Array.isArray(p)){let out=p.map(t=>(t&&t.type==='computed'&&t.key==='cars')?{type:'computed',key:'car1'}:t);if(out.length>=1){a=out;localStorage.setItem(G.store,JSON.stringify(out));}}}}catch(e){}}
  if(!a)a=G.def.map(x=>Object.assign({},x));TILESTATE[g]=a;return a;}
/* v732: RUTÄNDRINGAR SKICKAS TILL HOMEY DIREKT, som knappar och avsnittsordning.
   Förut sparades de bara lokalt (localStorage) och nådde Homey först vid
   dygnsbackupen – eller aldrig, på en enhet som inte är huvudenhet. Under tiden
   låg den gamla layouten kvar i kopian, och nästa hämtning (en annan enhet som
   sparade, dygnshämtningen, en omstart) lade tillbaka den: "efter ett tag
   återgår det". syncPushSoon väntar 3 s, så flera ändringar blir en skrivning. */
function saveGrid(g){try{localStorage.setItem(GRIDS[g].store,JSON.stringify(TILESTATE[g]));}catch(e){}
  if(DELADE_KEYS.indexOf(GRIDS[g].store)>=0)deladAndrad();   /* v738: de sex rutorna delas */
  try{syncPushSoon();}catch(e){}}
/* FASTA RUTOR MED PÅ NU (v695). Breveden, Diskmaskin och Belysning bär
   knapparna när knappavsnittet är gömt, så de får inte kunna försvinna. I
   v691–v694 skrevs de EN gång in i rutlayouten — och layouten synkas mellan
   enheter av samma typ via Homey. En annan platta eller telefon med sina sex
   rutor skrev över dem, och engångsflaggan hindrade att de kom tillbaka. Nu
   ligger de inte i layouten alls: de visas sist så länge layouten inte redan
   har dem, och bara om det finns en knapp som hör till dem. Syns de i
   layouten (som på enheter som fick dem i v691) gäller layoutens plats. */
function fastaRutor(arr){
  if(!(CFG&&CFG.paNu))return [];
  var B=CONFIG.BUTTONS||[],har=function(k){return arr.some(function(x){return x&&x.type==='computed'&&x.key===k;});};
  var ut=[];
  [['breveden','breveden'],['dish','dish'],['hem','hem']].forEach(function(p){
    if(!har(p[0])&&B.some(function(b){return knappTill(b)===p[1];}))ut.push({type:'computed',key:p[0],glow:false,fast:true});});
  return ut;
}
function visadeRutor(g){var a=gridTiles(g);return (g==='flode')?a.concat(fastaRutor(a)):a;}
/* v732: HÅLL INNE PÅ EN FAST RUTA (Breveden, Diskmaskin, Belysning). De låg
   utanför layouten och långtrycket var avstängt för dem, så de gick varken att
   flytta, byta eller ta bort. Nu flyttas ALLA fasta rutor in i layouten i den
   ordning de syns (så ingenting byter plats på skärmen), och redigeraren öppnas
   för den man höll på. Därefter är de vanliga rutor – men tas en av dem bort
   lämnas en dold markör kvar (se removeTile), annars lade fastaRutor tillbaka den. */
function fastaTillLayout(g,slot){
  if(g!=='flode')return;
  var arr=gridTiles(g),f=fastaRutor(arr),bas=arr.length,mal=slot-bas;
  if(mal<0||mal>=f.length)return;
  if(bas+f.length>12){openTileEdit(g,Math.min(slot,arr.length-1));return;}
  f.forEach(function(t){arr.push({type:'computed',key:t.key,glow:false});});
  saveGrid(g);renderTiles(g);
  openTileEdit(g,bas+mal);}

/* HUSETS FÖRBRUKNING JUST NU.
   Laddboxens effekt ADDERADES förut ovanpå förbrukningsmätaren. Det dubbel-
   räknade bilen: mätaren innehåller den redan.
   Mätt 2026-09-20 07:45, med bilen på 7 835 W:
     Förbrukning        9 240 W
       varav nät        7 610 W
       varav sol        1 570 W
       varav batteri       60 W
     7 610 + 1 570 + 60 = 9 240  — går jämnt ut.
   Laddboxens 7 835 W ryms alltså inuti de 9 240. Vore den utanför hade nätet
   behövt leverera runt 15 kW, inte 7,6. Rutan visade 18,6 kW medan stapeln
   under (sol + batteri + nät) visade 10,7 — det var skillnaden.
   Mätaren är facit; ingen post läggs till den. */
function houseNowW(){const base=cap(DEV.consume,husCap());return (base==null)?null:base;}   /* v722: Husförbrukning */
function selfData(){const sW=cap(DEV.solar,'measure_power')||0,hW=houseNowW(),pw=cap(DEV.pulse,'measure_power'),bw=cap(DEV.battery,'measure_power')||0,bs=cap(DEV.battery,'battery_charging_state');
  const gi=(pw!=null&&pw>0)?pw:0,bi=(bs==='discharging')?Math.abs(bw):0;
  const si=Math.max(0,Math.min(sW,(hW||0)-gi-bi)); /* taket: aldrig mer sol än panelerna ger */
  const of=(hW&&hW>0)?((si+bi)/hW):(pw!=null&&pw<0?1:0);return {of:Math.max(0,Math.min(1,of)),si,bi,gi,hW};}

async function btHamta(force){
  if(!appKan())return null;
  if(!force&&_bt&&Date.now()-_btAt<5*60000)return _bt;
  try{
    var j=await appGet('/battom');
    if(!j||typeof j.antal30!=='number')throw new Error('tomt svar');
    _bt=j;_btAt=Date.now();_btFel=null;
    try{btFlytta();}catch(e){}
    return j;
  }catch(e){_btFel=(e&&e.message)||String(e);return null;}}

/* Skickar den gamla lokala historiken en gang och rensar den sedan. Flaggan
   ligger i localStorage: en omladdning ska inte skicka om alltihop. */
function btFlytta(){
  if(_btSkickat)return;
  var rad=null;
  try{rad=localStorage.getItem(BT_KEY);}catch(e){}
  if(!rad||rad.length<10){_btSkickat=true;return;}
  _btSkickat=true;
  appPost('/battom',{data:rad}).then(function(r){
    if(r&&r.ok){
      try{localStorage.removeItem(BT_KEY);}catch(e){}
      _bt=null;_btAt=0;
      try{btHamta(true);}catch(e){}
    }
  }).catch(function(){_btSkickat=false;});}

function btSum(){
  return _bt||{pagar:false,nu:null,senast:null,senastLangd:null,
    antal30:0,timmar30:0,langst:null,langstLangd:null,golv:6,hyst:3,alla:[]};}

/* num() formaterar svenskt sedan v404. */
function btN(v,d){return num(v,d==null?0:d);}
/* Timmar och minuter, aldrig decimaltimmar. "2,5 h" kräver att man räknar om i
   huvudet; "2h 30min" går att läsa direkt. Samma sak för dygn. */
function btTid(h){
  if(h==null)return '–';
  var m=Math.round(h*60);
  if(m<60)return m+' min';
  if(m<24*60){
    var tt=Math.floor(m/60), mm=m-tt*60;
    return tt+'h'+(mm?' '+mm+'min':'');
  }
  var dd=Math.floor(m/1440), rt=Math.round((m-dd*1440)/60);
  if(rt===24){dd+=1;rt=0;}
  return dd+'d'+(rt?' '+rt+'h':'');}
function btVisGet(){
  var v=(CFG&&CFG.btVis)||'langd';
  return BT_VIS.indexOf(v)>=0?v:'langd';}
function btVisSatt(v){
  CFG.btVis=(BT_VIS.indexOf(v)>=0)?v:'langd';
  saveCfg();
  ['flode','energy','weather'].forEach(function(g){try{renderTiles(g);}catch(e){}});
  /* Rita om SAMMA popup som knapparna sitter i. openDetail('batttom') öppnade en
     annan vy som inte finns för den här rutan — resultatet blev en tom ruta som
     låste sig tills man stängde den. */
  try{krPopStang();}catch(e){}
  try{btPop();}catch(e){}}

/* Klockslag och datum via Intl med explicit tidszon — enheten kan stå i UTC. */
function btKl(t){
  if(!t)return '–';
  try{return new Date(t).toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'});}
  catch(e){return '–';}}
function btDatum(t){
  if(!t)return '–';
  try{return new Date(t).toLocaleDateString('sv-SE',{day:'numeric',month:'short'});}
  catch(e){return '–';}}
function btNar(t){
  if(!t)return '';
  var d=Math.floor((Date.now()-t)/86400000);
  if(d<=0)return 'idag';
  if(d===1)return 'igår';
  if(d<30)return d+' dagar sedan';
  try{return new Date(t).toLocaleDateString('sv-SE');}catch(e){return '';}}

/* Rutor i stallet for rader — samma slag som i sammanfattningarna, sa hela
   dashboarden har en enda grammatik for "har ar ett tal med sitt sammanhang". */
function btRuta(namn,varde,extra,ik,farg){
  if(varde==null)return '';
  return '<div class="kr-c">'
    +'<span class="kr-ic" style="color:'+(farg||'var(--faint)')+'">'+icon(ik||'gauge')+'</span>'
    +'<span class="kr-tx"><span class="kr-l">'+esc(namn)+'</span>'
    +'<span class="kr-v">'+varde+'</span>'
    +(extra?('<span class="kr-x">'+esc(extra)+'</span>'):'')+'</span></div>';}

function btKlocka(t){
  if(!t)return '';
  try{return new Date(t).toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'});}
  catch(e){return '';}}

function btPop(){
  var S=btSum();
  krPopStang();
  var info=''
    +'<p style="margin:0 0 8px"><b>Natten räknas 18–09.</b> En tömning klockan två hör till '
    +'natten som började kvällen innan, inte till dagen som just börjat — annars hade '
    +'"i natt" bytt betydelse mitt i natten.</p>'
    +'<p style="margin:0 0 8px">Räknas som tomt vid <b>'+(S.golv||6)+' %</b> eller lägre, och '
    +'som laddat först över <b>'+((S.golv||6)+(S.hyst||3))+' %</b>. Marginalen finns för att en '
    +'nivå som studsar kring gränsen annars hade gett dussintals falska tillfällen.</p>'
    +'<p style="margin:0 0 8px"><b>Snittet säger mer än summan.</b> Fem korta tömningar är '
    +'något annat än en lång, även om timmarna blir lika många.</p>'
    +'<p style="margin:0">Räknas i <b>Homey-appen</b> var femtonde minut, dygnet runt — inte i '
    +'webbläsaren. Historiken byggs framåt; Insights räcker inte bakåt för att leta episoder '
    +'i efterhand.</p>';
  var q=iqBtnHtml(info);

  var h='<div class="krpop-bak" id="krpop" onclick="if(event.target===this)krPopStang()">'
    +'<div class="krpop krpop-bred"><button class="krpop-x" onclick="krPopStang()" aria-label="stäng">'+icon('close')+'</button>'
    +'<div class="krpop-h"><span class="krpop-i">'+icon('battery-low')+'</span>'
    +'Batteriet tomt'+q.btn+'</div>'+q.box
    /* Valet av huvudtal ligger här, vid siffrorna det gäller — inte i en
       allmän inställningsmeny där man får leta. */
    +'<div class="cfg-sec">Visa i rutan</div><div class="cfg-btns">'
    +BT_VIS.map(function(k){return '<button class="cfg-opt'+(btVisGet()===k?' on':'')
      +'" onclick="btVisSatt(\''+k+'\')">'+BT_VIS_NAMN[k]+'</button>';}).join('')
    +'</div><div class="cfg-hint">Det som inte står som huvudtal visas på raden under.</div>';

  if(_btFel){
    h+='<div class="krpop-t">Kunde inte läsa från Homey-appen: '+esc(_btFel)
      +'.<br>Kräver appen 2.35.0 eller senare.</div></div></div>';
    var w0=document.createElement('div');w0.innerHTML=h;document.body.appendChild(w0.firstChild);return;
  }

  /* Svaret pa fragan overst, i klartext. Rutor ar bra for tal men daliga pa
     ja och nej. */
  var n=S.natt;
  h+='<div class="krpop-svar'+(n?' ja':' nej')+'">'
    +(S.pagar
      ? ('Tomt just nu — sedan '+btTid(S.nu))
      : (n
        ? ('I natt: tomt i '+btTid(n.timmar)
           +(n.pagar?' och laddar ännu inte':'')
           +'.')
        : 'Batteriet klarade natten.'))
    +'</div>';

  var r=[];
  if(n){
    r.push(btRuta('Blev tomt',btKlocka(n.start),n.antal>1?(n.antal+' gånger i natt'):null,
      'battery-low','var(--hot)'));
    r.push(btRuta('Laddade igen',n.slut?btKlocka(n.slut):'inte än',
      n.slut?null:'pågår','battery-charging',n.slut?'var(--ok)':'var(--gold)'));
    r.push(btRuta('Tomt i',btTid(n.timmar),null,'clock','var(--gold)'));
    r.push(btRuta('Lägsta nivå',n.min!=null?(n.min+' %'):null,null,'battery-low','var(--hot)'));
  }
  r.push(btRuta('Senast tomt',S.dygnSedan==null?'aldrig':
    (S.dygnSedan===0?'idag':(S.dygnSedan===1?'igår':(S.dygnSedan+' dygn sedan'))),
    S.senast?(btTid(S.senastLangd)+' långt'):null,'clock-counter-clockwise','var(--faint)'));
  r.push(btRuta('Gånger på 30 dygn',S.antal30,S.timmar30?(btTid(S.timmar30)+' totalt'):null,
    'chart-line','var(--blue)'));
  if(S.snitt30!=null)r.push(btRuta('Snittlängd',btTid(S.snitt30),null,'clock','var(--blue)'));
  if(S.langstLangd!=null)r.push(btRuta('Längsta',btTid(S.langstLangd),
    S.langst?btNar(S.langst.start):null,'clock','var(--gold)'));
  if(S.djup30!=null)r.push(btRuta('Djupast',S.djup30+' %','senaste 30 dygnen','battery-low','var(--hot)'));
  /* Trenden bara nar det finns nagot att jamfora med — annars sager "0 mot 0"
     ingenting alls. */
  if(S.senaste15!=null&&S.forra15!=null&&(S.senaste15+S.forra15)>0){
    var d=S.senaste15-S.forra15;
    r.push(btRuta('Trend',(d>0?'+':'')+d,
      S.senaste15+' mot '+S.forra15+' föregående 15 dygn',
      d>0?'arrow-up':(d<0?'arrow-fat-up':'chart-line'),
      d>0?'var(--hot)':(d<0?'var(--ok)':'var(--faint)')));
  }
  r=r.filter(function(x){return x;});
  if(r.length)h+='<div class="kr-grid krpop-grid">'+r.join('')+'</div>';
  else h+='<div class="ins-empty">Batteriet har aldrig varit tomt sedan mätningen började.</div>';

  h+='</div></div>';
  var w=document.createElement('div');w.innerHTML=h;
  document.body.appendChild(w.firstChild);}

/* v721: VAD BATTERIET ÄR BOKAT ATT GÖRA – visas som en bricka i batterirutorna.
   Ordning efter vad som gäller just nu: spara pågår, Ladda pågår, bokad
   laddstart, bokat spara. null = inget bokat eller påslaget. */
function battBokning(){
  try{
    var nu=Date.now(),R=_regel||{};
    var sp=battSparaLage();
    /* kort = mobilens smala ruta: ikonen säger vad, tiden när. */
    if(sp&&sp.aktiv)return {txt:'Sparar till '+regelKl(sp.till),kort:regelKl(sp.till),cls:'bla',ic:'lock-simple'};
    if(battLaddLage()===true){var avk=battAvstangKl();
      /* v728: fullt sparas till den dyra perioden. */
      if(R.stopp>nu)return {txt:'Ladda på · fullt sparas till '+regelKl(R.stopp),kort:'på',cls:'gron',ic:'battery-charging'};
      return {txt:'Ladda på'+(avk?' till '+avk:''),kort:avk||'på',cls:'gron',ic:'battery-charging'};}
    var bs=battStartAktiv();
    if(bs)return {txt:'Laddar '+bilKlText(bs)+(R.stopp>bs?' \u00b7 sparas till '+regelKl(R.stopp):''),kort:battKlAv(bs),cls:'gul',ic:'clock'};
    if(R.spara>nu)return {txt:'Sparar från '+regelKl(R.spara),kort:regelKl(R.spara),cls:'bla',ic:'lock-simple'};
  }catch(e){}
  return null;
}
/* v748: regnrutans underrad på Väder-sidan. Regnar det nu: takten senaste
   timmen. Annars SMHI-prognosens nästa timme med nederbörd (≥ 0,1 mm) inom
   12 h, eller "uppehåll 12 h". Utan prognos: senaste timmen. */
function regnUnderrad(){
  try{
    var r1=cap(DEV.rain,'measure_rain.1h');
    if(r1!=null&&r1>0)return 'nu '+num(r1,1)+' mm/h';
    if(typeof FORECAST!=='undefined'&&FORECAST&&FORECAST.length){
      var nu=Date.now(),hit=null;
      for(var i=0;i<FORECAST.length;i++){var f=FORECAST[i];if(f.t<nu-1800000||f.t>nu+12*3600000)continue;if(f.p!=null&&f.p>=0.1){hit=f;break;}}
      return hit?('regn ca '+avlKl(hit.t)):'uppehåll 12 h';}
    return (r1==null)?'':('1 h: '+num(r1,1)+' mm');
  }catch(e){return '';}}
function computeMetric(cfg){
  if(!cfg)return{label:'–',icon:'gauge',v:'–',meta:'',det:null};
  if(cfg.type==='sensor'){const v=capMs(cfg.device,cfg.cap),dev=DATA[cfg.device];
    let vv;if(cfg.cap.indexOf('measure_power')>=0)vv=(v==null?'–':W(v));
    else vv=(v==null?'–':num(v,cfg.dec==null?1:cfg.dec)+(cfg.unit?' <small>'+cfg.unit+'</small>':''));
    let meta=cfg.meta||((dev&&dev.name)||'');
    /* Under vardet star VAR matningen gors. Rubriken sager vad, zonen sager
       var, och tillsammans racker det - "Pooltemp / Poolrum" ar tydligare an
       rubriken ensam nar man har fem sensorrutor bredvid varandra. */
    var zonN=(dev&&dev.zone&&ZONES[dev.zone]&&ZONES[dev.zone].name)?String(ZONES[dev.zone].name).trim():'';
    /* Sager zonen samma sak som rubriken - "Uterum" over och "Uterum" under -
       tillfor den ingenting. Da satts ett OMDOME i stallet: det ar det man vill
       veta, och det kraver inte att man minns vad 900 ppm eller 38 % betyder.
       Gransvarden: koldioxid enligt Folkhalsomyndighetens 1000 ppm som riktvarde
       inomhus, luftfuktighet 30-60 % som det vanliga spannet for inomhusklimat. */
    var omdome=sensorOmdome(cfg.cap,v);
    var lbl0=String(cfg.label||(dev&&dev.name)||'').trim().toLowerCase();
    /* Zonen forst nar den sager nagot nytt - "Koldioxid / Uterum" ar mer
       upplysande an "Koldioxid / frisk luft", for rummet vet man inte annars.
       Ar zonen samma ord som rubriken tar omdomet over. */
    var sub=(zonN&&zonN.toLowerCase()!==lbl0)?zonN:(omdome||'');
    if(cfg.device===DEV.pooltemp&&cfg.cap==='measure_temperature'){const ph=cap(DEV.poolheat,'onoff'),rt=poolRate();
      var varms=(ph==='on'||ph===true);
      if(varms&&rt!=null&&rt>=0.05)meta='+'+num(rt,1)+'°/h · värms';
      /* TRENDEN i stallet for zonen. Poolen ror sig langsamt, sa riktningen och
         takten sager mer an var givaren sitter - och det ar den som avgor om
         det ar lont att sla pa varmen.
         poolRate jamfor mot ett varde en timme tillbaka och ger null tidigare
         an sa; da finns ingen trend att visa och zonen far sta kvar.
         Grans 0,05 grader i timmen: under det ar det matbrus, inte en trend. */
      /* POOLTEMP visar vattnets trend. Fukten hor till RUMMET och stod har en
         version av misstag - poolens temperatur och rummets luftfuktighet ar
         tva olika matningar fran tva olika givare. */
      /* ALLTID TRENDEN, aldrig zonen. "Pooltemp / Poolrum" sa samma sak tva
         ganger. Pilen bar tecknet - "↓ -0,3" ar ocksa en upprepning.
         Utan tillrackligt med historik sags det rakt ut i stallet for att
         pasta att den ligger stilla: poolRate jamfor mot ett varde en timme
         tillbaka och ger inget svar forran dess. */
      if(rt!=null&&Math.abs(rt)>=0.05)sub=(rt>0?'↑ ':'↓ ')+num(Math.abs(rt),1)+'°/h';
      else if(rt!=null)sub='stabil';
      else sub='samlar data';
      if(varms)sub+=' · värms';}
    /* POOLRUMMETS ruta visar rummets temperatur, och da ar luftfuktigheten det
       som saknas - ett poolrum som angar ar hela poangen med matningen. */
    else if(cfg.device===DEV.poolrum&&cfg.cap==='measure_temperature'){
      var fu=cap(DEV.poolrum,'measure_humidity');
      if(fu!=null&&isFinite(fu))sub=Math.round(fu)+' % fukt';
    }
    return {label:cfg.label||(dev&&dev.name)||'Värde',icon:cfg.icon||inferIcon(cfg.cap),v:vv,
      sub:sub,meta:meta,det:cfg.device===DEV.pooltemp?'pool':null};}
  switch(cfg.key){
    case 'solday':{
      /* Dagens skord mot dagens prognos - det ar den jamforelsen man vill gora
         nar man tittar mitt pa dagen. Finns ingen prognos visas arets summa. */
      var pd=(typeof progIdag==='function')?progIdag():null;
      var pv=(pd&&pd.summa_prognos!=null)?pd.summa_prognos:null;
      return {label:'Sol idag',icon:'sun',v:fmtKwh(cap(DEV.solar,'meter_power.day')),
        sub:(pv!=null)?('av '+num(pv,0)+' kWh i prognos'):(grp(Math.round(yearProd()||0))+' kWh i år'),
        meta:grp(Math.round(yearProd()||0))+' kWh i år',det:'sun'};}
    case 'solyear':{
      /* Manaden sager mer an att upprepa "i ar" med andra ord. */
      var mn=cap(DEV.solar,'meter_power.month');
      return {label:'Solenergi i år',icon:'sun',v:fmtKwh(yearProd()),
        sub:(mn!=null&&isFinite(mn))?(fmtKwh(mn).replace(/<[^>]*>/g,'')+' i månaden'):'solproduktion i år',
        meta:'solproduktion i år',det:'sun'};}
    case 'boughtyear':{const v=yearKopt();return {label:'Köpt i år · kWh',icon:'plug',v:v==null?'–':fmtKwh(v),meta:'från nätet i år',det:'boughtyear'};}
    case 'soldyear':{const v=yearSald();return {label:'Sålt i år · kWh',icon:'coins',v:v==null?'–':fmtKwh(v),meta:'till nätet i år',det:'sold'};}
    case 'solnow':{const perf=solPerfPct(),p=cap(DEV.solar,'measure_power')||0;
      /* Utbytet mot vad anlaggningen skulle kunna ge just nu sager mer an
         effekten ensam: 3 kW en mulen dag ar bra, samma tal i klart vader ar
         daligt. Under 30 W ar solen nere och kvoten meningslos - da visas
         dagens skord i stallet. */
      const dag=cap(DEV.solar,'meter_power.day');
      return {label:'Sol nu',icon:'sun',v:W(p),
        sub:(perf!=null&&p>30)?(perf+' % av m\u00f6jligt')
          :((dag!=null&&isFinite(dag))?(num(dag,1)+' kWh i dag'):''),
        meta:(perf!=null&&p>30)?(perf+' % av m\u00f6jligt'):'effekt just nu',det:'sun'};}
    case 'house':return {label:'Förbrukning',icon:'house',v:W(houseNowW()),meta:'just nu',det:'self'};
    case 'self':{const s=selfData();return {label:'Självförsörjning',icon:'leaf',v:Math.round(s.of*100)+' <small>%</small>',meta:'av förbrukning nu',det:'self'};}
    case 'cost':{const c=cap(DEV.pulse,'accumulatedCost');
      /* Spotpriset just nu forklarar varfor kostnaden stiger fort eller
         langsamt - "via Pulse" sa ingenting om saken. */
      var sp=elprisNow();
      return {label:'Kostnad idag',icon:'coins',v:c==null?'–':num(c,2)+' <small>kr</small>',
        sub:(sp!=null&&isFinite(sp))?(Math.round(sp*100)+' öre/kWh nu'):'via Pulse',
        meta:'via Pulse',det:'cost'};}
    case 'spot':{const p=elprisNow();
      /* Dagens spann satter priset i sammanhang: 87 ore ar billigt en dag och
         dyrt en annan. */
      var lo=elprisLo(),hi=elprisHi();
      return {label:'Spotpris',icon:'tag',v:p==null?'–':num(p,2)+' <small>kr</small>',
        sub:(lo!=null&&hi!=null&&isFinite(lo)&&isFinite(hi))
          ?(Math.round(lo*100)+'–'+Math.round(hi*100)+' öre i dag'):'kr/kWh nu',
        meta:'kr/kWh nu',det:'cost'};}
    case 'gridbal':{const pw=cap(DEV.pulse,'measure_power');return {label:'Nätbalans nu',icon:'lightning',v:pw==null?'–':(pw<-5?'−':'')+W(Math.abs(pw)),meta:pw==null?'säljer / köper':(pw<-5?'säljer till nätet':pw>5?'köper från nätet':'i balans'),det:'grid'};}
    case 'krcmp': case 'krcmp2':
      return {label:'Köpt / sålt'+(cfg.key==='krcmp2'?' (bred)':''),icon:'coins',
        v:'<small>stapel</small>',meta:'tryck = byt period',det:'cost'};
    case 'kop_d': case 'kop_w': case 'kop_m': case 'kop_y':
    case 'sal_d': case 'sal_w': case 'sal_m': case 'sal_y':{
      var kk=cfg.key, sal=(kk.charAt(0)==='s'), pm={d:'day',w:'week',m:'month',y:'year'}[kk.charAt(4)];
      var r=monPer(pm), lbl=(sal?'Sålt ':'Köpt ')+({day:'idag',week:'i veckan',month:'i månaden',year:'i år'}[pm])+' · kr';
      var kr=sal?r.s:r.k, kwh=sal?r.so:r.ki;
      var mt=[]; if(kwh>0)mt.push(Math.round(kwh)+' kWh');
      var tk=monTackning(r); if(tk)mt.push(tk);
      if(sal&&!r.rw)mt.push('uppskattat');
      return {label:lbl,icon:sal?'coins':'plug',
        v:(!r.st?'–':num(kr,kr<100?2:0)+' <small>kr</small>'),
        meta:mt.join(' · ')||(sal?'till nätet':'från nätet'),det:sal?'sold':'cost'};}
    case 'sold':return {label:'Sålt totalt',icon:'lightning',v:num(cap(DEV.pulse,'meter_power.exported'),0)+' <small>kWh</small>',meta:'till nätet',det:'sold'};
    case 'bought':{
      /* Salt bredvid kopt ar det som gor talet begripligt. */
      var sa=cap(DEV.pulse,'meter_power.exported');
      return {label:'Köpt totalt',icon:'lightning',
        v:num(cap(DEV.pulse,'meter_power.imported'),0)+' <small>kWh</small>',
        sub:(sa!=null&&isFinite(sa))?(grp(Math.round(sa))+' kWh sålt'):'från nätet',
        meta:'från nätet',det:'sold'};}
    case 'cars':{
      /* EX40 är förstahandsvalet. Laddar eller är C40 inkopplad tar den över rutan,
         och är laddboxen igång utan att någon känd bil sitter i visas Gäst. */
      /* Bara namnet. "· aktiv bil" motiverade urvalet i stället för att säga
         vad rutan visar, och på tre kolumner tog det plats från namnet. */
      const nmOf=(id,d)=>((DATA[id]&&DATA[id].name)||d);
      const mk=(id,dn)=>({nm:nmOf(id,dn),b:cap(id,'measure_battery'),charging:carCharging(id),
                          plugged:carPlugged(id),home:carHome(id),known:!!DATA[id]});
      const ex40=mk(DEV.car2,'EX40'), c40=mk(DEV.car,'C40');
      const boxW=chargerW(),boxOn=(cap(DEV.laddbox,'evcharger_charging')===true)||(boxW!=null&&boxW>50);
      /* meta ar redan raden som beskriver laget - "laddar · 10,8 kW",
         "inkopplad", rackvidden. Den gar nu ocksa under vardet; att den bara
         hamnade i popupen var ett forbiseende. */
      const show=(o,meta)=>({label:o.nm,icon:'car-profile',
        v:o.b==null?'–':Math.round(o.b)+' <small>%</small>',sub:meta,meta:meta,det:'cars'});
      const chgMeta=()=>'laddar'+(boxW!=null?' · '+W(boxW):'');
      if(c40.known&&c40.charging)return show(c40,chgMeta());
      if(ex40.charging)return show(ex40,chgMeta());
      if(c40.known&&c40.plugged)return show(c40,'inkopplad');
      if(ex40.plugged)return show(ex40,'inkopplad');
      if(boxOn)return {label:'Gäst',icon:'car-profile',v:boxW!=null?W(boxW):'laddar',
        sub:'okänd bil laddar',meta:'laddar',det:'cars'};
      if(ex40.b==null&&c40.b==null)return {label:'Bilar',icon:'car-profile',v:'–',
        sub:'ingen kontakt',meta:'ingen data',det:'cars'};
      if(ex40.b==null)return show(c40,c40.home?'hemma':'borta');
      return show(ex40,ex40.home?'hemma':'borta');}
    case 'car1':case 'car2':{const id=cfg.key==='car1'?DEV.car:DEV.car2,nm=(DATA[id]&&DATA[id].name)||(cfg.key==='car1'?'C40':'EX40');
      const b=cap(id,'measure_battery'),rng=cap(id,'range_battery');
      const meta=carCharging(id)?('laddar'+(chargerW()!=null?' · '+W(chargerW()):'')):carPlugged(id)?'inkopplad':(rng!=null?Math.round(rng)+' km':'laddnivå');
      /* LADDAR DEN star effekten dar, ingenting annat - det ar det man vill se.
         Laddboxen mater bara EN punkt, sa effekten kan bara tillskrivas en bil:
         den som faktiskt laddar. Star bada pa laddning visas effekten anda, for
         da ar det laddboxens totala uttag och det ar fortfarande sant.
         Laddar den inte sager rackvidden mer an procenten upprepad - och ar den
         inkopplad utan att ladda ar just det beskedet det viktiga. */
      var sub;
      if(carCharging(id)){
        var cw=chargerW();
        sub=(cw!=null&&cw>50)?W(cw):'laddar';
      }else if(carPlugged(id)){
        sub='inkopplad'+(rng!=null?' · '+Math.round(rng)+' km':'');
      }else{
        sub=(rng!=null)?(Math.round(rng)+' km kvar'):'laddnivå';
      }
      return {label:nm,icon:'car-profile',v:b==null?'–':Math.round(b)+' <small>%</small>',
        sub:sub,meta:meta,det:'cars'};}
    case 'charger':{const p=chargerW(),on=cap(DEV.laddbox,'evcharger_charging')===true||carCharging(DEV.car)||carCharging(DEV.car2);
      return {label:'Laddbox',icon:'plug',v:p==null?'–':W(p),
        sub:on?'laddar bilen':(p!=null&&p>50?'aktiv':'vilar'),
        meta:on?'laddar bilen':(p!=null&&p>50?'aktiv':'vilar'),det:'cars'};}
    case 'battpct':{const b=cap(DEV.battery,'measure_battery'),bs=cap(DEV.battery,'battery_charging_state'),bt=battTimeStr();
      /* Vardet ar redan procenten, sa under den star tiden - fulladdat eller
         hur lange den racker. Finns ingen tid att rakna ut visas laget. */
      return {label:'Husbatteri \u00b7 niv\u00e5',icon:battIcon(b),icc:battIcc(b,bs),
        v:b==null?'\u2013':Math.round(b)+' <small>%</small>',
        sub:bt||(bs==='charging'?'laddar':bs==='discharging'?'matar ut':'vilar'),
        meta:bt||'laddniv\u00e5',det:'batt',bok:battBokning()};}
    case 'battpow':{const pw=cap(DEV.battery,'measure_power'),bs=cap(DEV.battery,'battery_charging_state'),bb=cap(DEV.battery,'measure_battery');      /* Har ar vardet effekten, och da ar laddnivan det som saknas. */
      return {label:'Batterieffekt',icon:battIcon(bb),icc:battIcc(bb,bs),
        v:pw==null?'\u2013':(bs==='discharging'?'\u2212':'')+W(Math.abs(pw)),
        sub:bb==null?'':Math.round(bb)+' % laddat',
        meta:bb==null?'':Math.round(bb)+'%',det:'batt',bok:battBokning()};}
    case 'battnow':{const pw=cap(DEV.battery,'measure_power'),b=cap(DEV.battery,'measure_battery'),bs=cap(DEV.battery,'battery_charging_state'),bt=battTimeStr();
      /* Vardet ar effekten in eller ut, sa under den star LADDNIVAN - det ar
         den man vill se pa avstand, och tiden kvar nar den gar att rakna ut. */
      return {label:'Batteri',icon:bs==='charging'?'battery-charging':battIcon(b),icc:battIcc(b,bs),
        v:pw==null?'–':(bs==='discharging'?'−':'')+W(Math.abs(pw)),
        sub:(b==null?'':Math.round(b)+' %')+(bt?' · '+bt:''),
        meta:(b==null?'':Math.round(b)+'%')+(bt?' · '+bt:''),det:'batt',bok:battBokning()};}
    case 'batttom':{const S=btSum();
      /* Huvudtalet väljs i inställningarna; det som inte visas som huvudtal
         hamnar i underraden så ingenting går förlorat. */
      const vis=btVisGet();
      const langd=S.pagar?btTid(S.nu):(S.senastLangd!=null?btTid(S.senastLangd):'–');
      /* När batteriet BLEV tomt, alltså episodens början. Slutet är när det
         började laddas igen — en annan sak, och inte den man frågar efter. */
      const slutT=S.senast?S.senast.start:null;
      let vv,mm;
      /* Pågår just nu: klockslaget då det TOG SLUT finns inte än, så visa när
         det började i stället. Utan den skillnaden blev talet tomt. */
      if(S.pagar&&vis!=='antal'){
        vv=(vis==='klockslag')?btKl(S.senast?S.senast.start:null)
          :(vis==='datum')?btDatum(S.senast?S.senast.start:null):langd;
        mm=(vis==='klockslag'||vis==='datum')?('tomt sedan · '+langd):'pågår nu';
      }
      else if(vis==='klockslag'){vv=S.senast?btKl(slutT):'–';mm=S.senast?('tomt '+langd):'aldrig sett';}
      else if(vis==='datum'){vv=btDatum(slutT);mm=S.senast?(btKl(slutT)+' · '+langd):'aldrig sett';}
      else if(vis==='antal'){vv=String(S.antal30!=null?S.antal30:0);mm='gånger på 30 dygn';}
      else {vv=langd;mm=S.senast?btNar(S.senast.start):'aldrig sett';}
      /* mm ar redan skriven for att komplettera huvudtalet - "pagar nu",
         "tomt 2h 15m", "aldrig sett". Den hor hemma under vardet; att den bara
         gick till popupen var ett forbiseende nar underraden byggdes om. */
      /* v753: ikonen alltid röd (Markus val) – rutan handlar om tomt batteri. */
      return {label:'Tomt',icon:'battery-low',
        icc:'var(--hot)',
        v:vv,sub:mm,meta:mm,det:'batttom'};}
    case 'gridnow':{const pw=cap(DEV.pulse,'measure_power');
      /* Overbelastad fas syns i rutan, inte bara i popupen: det ar da man vill
         veta, och rutan ar det man ser. Ikonen byter farg och den varsta fasen
         skrivs ut bredvid effekten. Under 75 % star ingenting extra - en varning
         som alltid syns slutar betyda nagot. */
      const fv=fasVarst();
      const varn=(fv&&fv.kvot>=0.75);
      const vv=pw==null?'\u2013':(pw<-5?'\u2212':'')+W(Math.abs(pw));
      /* Under vardet star belastningen. Ar den hog namns den varsta fasen med
         ampere och procent - det ar da man behover veta vilken. Ar den normal
         star alla tre fasernas strom i stallet, vilket sager mer an ordet
         "koper": man ser om lasten ar sned. Utan strommatning aterstar
         riktningen. */
      let sub;
      if(varn)sub='<b style="color:'+fasFarg(fv.kvot)+'">L'+fv.fas+' '+num(fv.a,0)+' A \u00b7 '
        +Math.round(fv.kvot*100)+' %</b>';
      else if(fv)sub=fasAlla().map(function(a){return a==null?'\u2013':num(a,0);}).join(' \u00b7 ')+' A';
      else sub=(pw==null)?'':(pw>5?'k\u00f6per':pw<-5?'s\u00e4ljer':'balans');
      return {label:'Eln\u00e4t',icon:varn?'warning':'lightning',
        icc:varn?fasFarg(fv.kvot):null,
        v:vv,sub:sub,meta:pw==null?'\u2013':(pw>5?'k\u00f6per':pw<-5?'s\u00e4ljer':'balans'),det:'grid'};}
    case 'humidity':{const hum=cap(DEV.outdoor,'measure_humidity');return {label:'Luftfuktighet',icon:'drop-half-bottom',v:hum==null?'–':Math.round(hum)+' <small>%</small>',meta:'',det:'humidity',
      /* v748: underrad bara i Väder-sidans rutor (vsub) – samma ruta i andra rutnät oförändrad. */
      /* Utomhusskala – sensorOmdome är gjord för inomhus (73 % ute blev "för fuktigt"). */
      sub:(cfg.vsub&&hum!=null)?(hum<35?'torr luft':hum<75?'normalt':hum<90?'fuktig luft':'mycket fuktigt'):undefined};}
    case 'seatemp':{const t=(typeof FEED!=='undefined')?FEED.sea:null;
      /* Platsen stod redan i rubriken pa manga installningar. Ett omdome sager
         mer: det ar det man vill veta om man ska bada, och grader ensamt kraver
         att man vet vad 17 betyder. Granserna ar de vanliga for svenskt
         badvatten - under 15 ar det kallt, over 20 borjar det bli skont. */
      var omd=(t==null)?'':(t<12?'kallt':t<15?'friskt':t<18?'svalt':t<20?'ok att bada':t<23?'skönt':'varmt');
      return {label:'Badtemp',icon:'waves',v:(t==null?'–':num(t,1)+' <small>°C</small>'),
        sub:omd||(CONFIG.BATH_NAME||'havet'),
        meta:CONFIG.BATH_NAME||'havet',det:'seatemp'};}
    case 'rain':{const r=cap(DEV.rain,'measure_rain.24h');const fut=(_timeActive&&_timeInfo&&_timeInfo.future);      return {label:fut?'Regn':'Regn 24h',icon:'cloud-rain',v:r==null?'–':num(r,1)+' <small>mm'+(fut?'/h':'')+'</small>',meta:'',det:'rain',
        sub:(cfg.vsub&&!fut)?regnUnderrad():undefined};}
    case 'pressure':{const pres=cap(DEV.vader,'measure_pressure')||cap(DEV.smhi,'measure_air_pressure_cp');
      let tr;if(_timeActive&&_timeInfo&&_timeInfo.future){tr=forecastPressureTrend(_scrubH);}else if(_timeActive){tr=histPressureTrend(_scrubH);}else{tr=pressureTrend(pres);}
      /* Riktningen syns i pilen efter enheten — en rad mindre att läsa, och
         den står där blicken redan är. ↗ stigande, ↘ sjunkande, → oförändrat. */
      const pil=(tr>0?'\u2197':tr<0?'\u2198':'\u2192');
      const titel=(tr>0?'stigande':tr<0?'sjunkande':'of\u00f6r\u00e4ndrat');
      /* v748: i Väder-sidans rutor (vsub) står riktningen i underraden –
         pilen efter enheten klipptes i telefonens smala ruta. */
      if(cfg.vsub)return {label:'Lufttryck',icon:'gauge',v:pres==null?'–':(Math.round(pres)+' <small>hPa</small>'),
        sub:pres==null?'':(pil+' '+titel),meta:'',det:'pressure'};
      return {label:'Lufttryck',icon:'gauge',
        v:pres==null?'–':(Math.round(pres)+' <small>hPa</small><span class="tr-pil" title="'+titel+'" aria-label="'+titel+'">'+pil+'</span>'),
        meta:'',det:'pressure'};}
    /* BREVEDEN — värmepumpen i gäststugan. All bedömning av om kyla eller värme
       behövs görs i HomeyScriptet; dashboarden läser bara tillståndet och
       triggar rätt flow. Ingen egen logik här, med flit. */
    case 'breveden':{
      /* v702: temperaturen och om den arbetar läses ur Attefall direkt (brvNu).
         Skriptets variabel uppdateras bara när skriptet körs, och båda flödena
         som körde det regelbundet är avstängda — rutan visade då 17° medan
         värmepumpen själv sa 23,5°. Skriptets värden används bara när enheten
         inte svarar, och dess "nästa läge" när den är avstängd. */
      const B=brvState(),N=brvNu();
      const gammal=brvGammal(B);
      const vantar=(_brvVanta&&Date.now()-_brvVanta<12000);
      /* v753: ikonen grön (Markus val). Att den värmer eller kyler syns på
         lågan/snöflingan i ikonens hörn och i lägesraden. Grå bara när läget
         är okänt. */
      let ic='stuga',iccol='var(--ok)',meta,on=false,dim=false,temp=null;
      if(N){
        temp=N.temp;on=N.arbetar;
        const mal=N.mal!=null?' mot '+num(N.mal,0)+'°':'';
        if(N.arbetar){
          const sed=(B&&B.aktiv&&!gammal&&B.start)?brvSedan(B.start):null;
          meta=brvLageText(N)+(sed?' · '+sed:'');
        }else if(N.pa)meta='på · vilar'+(N.mal!=null?' · '+num(N.mal,0)+'°':'');   /* v742: inte "vilar mot" */
        else if(B&&!gammal&&B.nastaLage==='cool')meta='av · skulle kyla';
        else if(B&&!gammal&&B.nastaLage==='heat')meta='av · skulle värma';
        else meta='av';
      }else{
        /* Enheten saknas i datan: som före v702, ur skriptets variabel. */
        const okand=!B||B.nastaLage==='okand'||gammal;
        temp=(B&&B.inne!=null)?B.inne:null;on=!!(B&&B.aktiv&&!gammal);dim=okand;
        if(okand)iccol='var(--faint)';
        meta=gammal?'gammalt värde':(!B?'ingen kontakt':(B.aktiv?'igång':'av'));
      }
      if(vantar)meta='väntar på Homey…';
      return {label:'Breveden',icon:ic,icc:iccol,
        v:(temp!=null)?num(temp,1)+' <small>°C</small>':'–',
        meta:meta,det:'breveden',on:on,dim:dim};}
    case 'poolheat':{const ph=cap(DEV.poolheat,'onoff'),on=(ph==='on'||ph===true);return {label:'Poolvärme',icon:'swimming-pool',v:on?'På':'Av',meta:on?'värmer poolen':'avstängd',det:'pool'};}
    case 'hem':{
      /* BELYSNING (v692, nyckeln heter fortfarande 'hem'). Rutan gör det
         Tänd/Släck-knappen gjorde: ett tryck tänder eller släcker, och rutan
         visar hur många av moodets lampor som lyser. Auto, Skivspelare och
         resten ligger kvar i popupen bakom knappen ⋯ i hörnet. */
      var li=ljusKnapp(),lb=(li>=0)?CONFIG.BUTTONS[li]:null;
      if(!lb)return {label:'Hem',icon:'house',v:'–',meta:'ingen ljusknapp',det:'hem',mer:true};
      /* Lamporna räknas bara för ett mood — då är det samma lampor som avgör
         knappens läge, så "Tänt" och "x av y tända" kan inte säga emot varandra. */
      var pa=btnState(lb),ids=[];try{if(lb.type==='moodtoggle')ids=moodLightIds(lb)||[];}catch(e){}
      var tanda=ids.filter(function(id){return cap(id,'onoff')===true;}).length;
      var meta;
      var vt=(_ljusVanta&&Date.now()-_ljusVanta.t<12000)?_ljusVanta:null;
      if(vt&&vt.pa===pa)vt=null;            /* läget har redan slagit om */
      if(armed.i===li&&Date.now()-armed.t<4000)meta='tryck igen för att '+(pa?'släcka':'tända');
      else if(vt)meta=vt.pa?'tänder…':'släcker…';
      else if(ids.length)meta=tanda?(tanda+' av '+ids.length+' lampor tända'):'allt släckt';
      else meta=pa?'tänt':'släckt';
      return {label:'Belysning',icon:'lightbulb',icc:pa?'var(--gold)':'var(--faint)',v:pa?'Tänt':'Släckt',
        meta:meta,det:'hem',on:pa,mer:true,tryck:'ljus'};}
    case 'poolrum':{
      /* v740: värdet är POOLVATTNET. Underraden som Pooltemp-rutan: trenden och
         "värms" – utom när rummet varnar, då står varningen där. */
      var Zp=ZK.poolrum,wp=zkVarningar('poolrum')[0]||null,pt=cap(DEV.pooltemp,'measure_temperature');
      var php=cap(DEV.poolheat,'onoff'),varmsP=(php==='on'||php===true),rtp=poolRate(),subP;
      /* Att värmen går syns på lågan i ikonen; i texten bara när det inte finns
         någon trend att visa än. "↑ 0,3°/h · värms" klipptes på telefonen. */
      if(rtp!=null&&Math.abs(rtp)>=0.05)subP=(rtp>0?'↑ ':'↓ ')+num(Math.abs(rtp),1)+'°/h';
      else if(rtp!=null)subP=varmsP?'stabil · värms':'stabil';
      else subP=varmsP?'värms':'samlar data';
      return {label:Zp.lab,icon:Zp.ic,icc:wp?(wp.niva==='larm'?'var(--hot)':'var(--warm)'):'',
        v:pt==null?'–':num(pt,1)+' <small>°C</small>',
        sub:wp?('<span class="zk-'+wp.niva+'">'+esc(wp.kort)+'</span>'):esc(subP),
        meta:wp?wp.txt:subP,det:'poolrum',varn:wp,varms:varmsP};}
    case 'vardagsrum':{
      /* v750: värdet är inne-medlet; under det rummen var för sig – eller
         vardagsrumssensorns varning (temperatur, batteri). */
      var Zv=ZK.vardagsrum,vv=zkVarden('vardagsrum'),wv=zkVarningar('vardagsrum')[0]||null,mv=indoorAvgTemp(),
          kv=cap(DEV.vader,'measure_temperature'),dv=[];
      /* Kort – "vard 25,3° · kök 25,9°" klipptes på telefonen. Första talet är
         rutans eget rum. */
      if(vv.t!=null)dv.push(num(vv.t,1));
      if(kv!=null)dv.push('kök '+num(kv,1));
      return {label:Zv.lab,icon:Zv.ic,icc:wv?(wv.niva==='larm'?'var(--hot)':'var(--warm)'):'',
        v:mv==null?'–':num(mv,1)+' <small>°C</small>',
        sub:wv?('<span class="zk-'+wv.niva+'">'+esc(wv.kort)+'</span>'):esc(dv.join(' · ')),
        meta:wv?wv.txt:('medel inne · '+(dv.join(' · ')||'temperatur')),det:'vardagsrum',varn:wv};}
    case 'uterum': case 'snickarboa':{
      /* v736: rumsrutan. Värdet är temperaturen; under den fukt och CO₂ – eller
         den allvarligaste varningen, med ikonen i varningens färg. */
      var Zk=ZK[cfg.key],vk=zkVarden(cfg.key),wk=zkVarningar(cfg.key)[0]||null,dk=[];
      if(vk.h!=null)dk.push(Math.round(vk.h)+' %');
      if(vk.c!=null)dk.push(Math.round(vk.c)+' ppm');
      return {label:Zk.lab,icon:Zk.ic,icc:wk?(wk.niva==='larm'?'var(--hot)':'var(--warm)'):'',
        v:vk.t==null?'–':num(vk.t,1)+' <small>°C</small>',
        sub:wk?('<span class="zk-'+wk.niva+'">'+esc(wk.kort)+'</span>'):(dk.join(' · ')),
        meta:wk?wk.txt:(dk.join(' · ')||'temperatur'),det:cfg.key,varn:wk};}
    case 'tv':{
      /* v713: TV-rutan. På när TV:n eller Google TV är på; appen som körs under.
         Id:na skrivs ut här – TV_DEV och GTV_DEV deklareras längre ner i
         skriptet och får inte läsas innan de finns. */
      var tvOn=cap('7c12535d-e1fc-418f-be3a-a591c38b5135','onoff')===true,
          gOn=cap('e6c96e95-05ec-48ca-a92a-e29b22cd0014','onoff')===true,app='';
      try{if(gOn)app=gtvNuApp();}catch(e){}
      var paTv=tvOn||gOn;
      /* v753: brun (Markus val); avstängd samma bruna, nedtonad. */
      return {label:'TV',icon:'television',icc:paTv?'var(--brown)':'color-mix(in srgb,var(--brown) 72%,transparent)',v:paTv?'På':'Av',
        meta:paTv?(app||'på'):'avstängd',det:'tv',on:paTv};}
    case 'dish':{const lg=diskLage(),pr=parsePct(cap(DEV.dish,'bshc_string.progress')),rem=parseRemain(cap(DEV.dish,'bshc_string.remaining_time'));
      const bok=(lg!=='kor'&&typeof diskBokad==='function'&&diskBokad())?('bokad '+diskNar()):'';
      return {label:'Diskmaskin',icon:'fork-knife',
        v:lg==='kor'?(pr!=null&&pr>0?pr+' <small>%</small>':'Går'):(lg==='redo'?'Redo':'Av'),
        meta:lg==='kor'?(rem!=null&&rem>0?'klar ~'+finishTime(rem):'diskar'):(bok||(lg==='redo'?'går inte':'avstängd')),det:'dish'};}
  }
  return {label:'–',icon:'gauge',v:'–',meta:'',det:null};
}
function sameCfg(a,b){if(!a||!b||a.type!==b.type)return false;return a.type==='computed'?a.key===b.key:(a.device===b.device&&a.cap===b.cap);}
function accFor(ic){return {sun:'acc-gold',leaf:'acc-green',coins:'acc-warm',tag:'acc-warm','swimming-pool':'acc-cyan',lightning:'acc-blue','car-profile':'acc-violet','battery-high':'acc-green','battery-charging':'acc-green',wind:'acc-green','thermometer-simple':'acc-warm','drop-half-bottom':'acc-cyan','cloud-rain':'acc-blue',waves:'acc-cyan',house:'acc-warm',gauge:'acc-blue','sun-horizon':'acc-gold',uterum:'acc-gold',hammer:'acc-warm'}[ic]||'acc-blue';}
function learnGet(){if(!_learn){try{_learn=JSON.parse(localStorage.getItem('learn_v1')||'{}');}catch(e){_learn={};}}return _learn;}
function learnSample(key,val){if(val==null||!isFinite(val))return;const L=learnGet(),now=Date.now();let e=L[key]||(L[key]={s:[],last:0});
  if(now-(e.last||0)<LEARN_THROTTLE_MS)return;e.last=now;e.s.push([now,Math.round(val*1000)/1000]);
  const cut=now-LEARN_WINDOW_MS;if(e.s.length&&e.s[0][0]<cut)e.s=e.s.filter(x=>x[0]>=cut);
  if(e.s.length>LEARN_MAXN)e.s=e.s.slice(e.s.length-LEARN_MAXN);_learnDirty=true;}
function learnFlush(){if(_learnDirty){try{localStorage.setItem('learn_v1',JSON.stringify(_learn));}catch(e){}_learnDirty=false;}}
function yearBaseGet(){try{return JSON.parse(localStorage.getItem('yearbase_v1')||'null');}catch(e){return null;}}
function yearHistGet(){try{const a=JSON.parse(localStorage.getItem('yearhist_v1')||'[]');return Array.isArray(a)?a:[];}catch(e){return [];}}
function yearHistSave(a){try{localStorage.setItem('yearhist_v1',JSON.stringify(a));}catch(e){}}
function yearHistUpsert(year,total,sol,opts){opts=opts||{};year=parseInt(year,10);if(!year)return;let a=yearHistGet();const i=a.findIndex(x=>x&&x.year===year);if(i>=0&&opts.keepExisting)return;const e={year:year,total:Math.max(0,Math.round(+total||0)),sol:Math.max(0,Math.round(+sol||0))};if(opts.manual)e.manual=true;if(opts.partial)e.partial=true;if(opts.from)e.from=opts.from;if(i>=0)a[i]=e;else a.push(e);a=a.filter(x=>x&&x.year).sort((p,q)=>q.year-p.year).slice(0,6);yearHistSave(a);}
function yearHistRemove(year){yearHistSave(yearHistGet().filter(x=>x&&x.year!==parseInt(year,10)));}
function yearBaseUpdate(){const y=new Date().getFullYear(),imp=cap(DEV.pulse,'meter_power.imported'),exp=cap(DEV.pulse,'meter_power.exported'),sol=cap(DEV.solar,'meter_power');if(imp==null)return;let b=yearBaseGet();if(!b||b.year!==y){
  if(b&&b.year&&b.year<y&&b.imported!=null){const fImp=Math.max(0,imp-b.imported),fExp=Math.max(0,(exp==null?0:exp)-(b.exported==null?0:b.exported)),fSol=(sol!=null&&b.solar!=null)?Math.max(0,sol-b.solar):null;if(fSol!=null){const solUsed=Math.max(0,fSol-fExp);yearHistUpsert(b.year,fImp+solUsed,solUsed,{keepExisting:true});}}
  b={year:y,imported:imp,exported:(exp==null?0:exp),solar:(sol==null?null:sol)};try{localStorage.setItem('yearbase_v1',JSON.stringify(b));}catch(e){}}}
function boughtYear(){const imp=cap(DEV.pulse,'meter_power.imported');if(imp==null)return null;if(SOURCE==='demo-data')return Math.max(0,imp*0.45);const b=yearBaseGet();if(!b)return null;return Math.max(0,imp-b.imported);}
function calibBoughtYear(){const el=$('cfg-boughtyear');if(!el)return;const kwh=parseFloat(el.value);const imp=capLive(DEV.pulse,'meter_power.imported');const st=$('cfg-by-status');
  if(!isFinite(kwh)||imp==null){if(st)st.textContent='Kan inte kalibrera (mätardata saknas).';return;}
  let b=yearBaseGet()||{};b.year=new Date().getFullYear();b.imported=imp-kwh;if(b.exported==null)b.exported=capLive(DEV.pulse,'meter_power.exported')||0;
  try{localStorage.setItem('yearbase_v1',JSON.stringify(b));}catch(e){}render();if(st)st.textContent='Kalibrerat ✓ mot '+Math.round(kwh)+' kWh.';}
function soldYear(){const exp=cap(DEV.pulse,'meter_power.exported');if(exp==null)return null;if(SOURCE==='demo-data')return Math.max(0,exp*0.6);const b=yearBaseGet();if(!b||b.exported==null)return null;return Math.max(0,exp-b.exported);}
function yearKopt(){try{var c=curYearData();if(c&&c.kopt!=null)return c.kopt;}catch(e){}return boughtYear();}
function yearSald(){try{var c=curYearData();if(c&&c.sald!=null)return c.sald;}catch(e){}return soldYear();}
function yearProd(){try{var c=curYearData();if(c&&c.prod!=null)return c.prod;}catch(e){}return cap(DEV.solar,'meter_power.year');}
