/* js/sidan.js — Sidan som app: flyttbara sektioner, auto-omladdning, service worker och push.
 *
 * Filen innehåller BARA funktionsdeklarationer. Konstanter, tillstånd och allt
 * som körs direkt vid laddning ligger i js/start.js, som laddas sist, under
 * rubriken [sidan.js]. En funktion går att anropa oavsett vilken fil den står
 * i, men kod som körs vid laddning kan här anropa en funktion i en fil som inte
 * hunnit laddas. Lägg den därför aldrig här.
 */

function secTopp(o){return o.filter(function(x){return !SEC_INNE[x];});}
/* Bygger hela ordningen ur toppnivån: varje inbäddat avsnitt direkt efter sin
   förälder. Ett inbäddat vars förälder saknas läggs sist, så inget försvinner. */
function secMedInne(top,o){
  var ut=[];
  top.forEach(function(x){ut.push(x);o.forEach(function(y){if(SEC_INNE[y]===x&&ut.indexOf(y)<0)ut.push(y);});});
  o.forEach(function(y){if(ut.indexOf(y)<0)ut.push(y);});
  return ut;}
/* Avsnittens ORDNING per enhetstyp. Nyckeln har två fack, precis som höjderna
   och de dolda avsnitten. Ordningen man vill ha på en vägghängd platta är
   sällan den man vill ha i handen. */
function secOrderAlla(){try{return JSON.parse(localStorage.getItem('secOrder_v1')||'null');}catch(e){return null;}}
/* DELAD mellan alla enheter. Ordningen på avsnitten ska se likadan ut på
   telefon och platta — bara storlekarna skiljer. Fanns ett gammalt fack per
   klass läses plattans som gemensam utgångspunkt. */
function secOrderKlassGet(){
  var a=secOrderAlla();
  if(!a)return null;
  if(Array.isArray(a))return a;
  if(Array.isArray(a.delad))return a.delad;
  return Array.isArray(a.platta)?a.platta:(Array.isArray(a.telefon)?a.telefon:null);}

function secOrderGet(){try{const s=secOrderKlassGet();if(Array.isArray(s)){
    var o=s.filter(x=>SEC_DEF.indexOf(x)>=0);
    /* Nya avsnitt (t.ex. tv, rum, kopt-salt) som saknas i en gammal
       sparad ordning läggs in EFTER sin granne i SEC_DEF - inte sist. */
    SEC_DEF.forEach(function(x,di){if(o.indexOf(x)>=0)return;
      var after=null;for(var k=di-1;k>=0;k--){if(o.indexOf(SEC_DEF[k])>=0){after=SEC_DEF[k];break;}}
      if(after==null){o.unshift(x);}else{o.splice(o.indexOf(after)+1,0,x);}});
    return o;}}catch(e){}return SEC_DEF.slice();}
function secOrderSave(o){try{
    /* Ett enda fack: ordningen gäller alla enheter. */
    localStorage.setItem('secOrder_v1',JSON.stringify({delad:o}));
  }catch(e){}
  syncPushSoon();}
/* Avsnittshöjder PER ENHETSKLASS. Nyckeln innehåller två fack, platta och
   telefon — en platta och en telefon har helt olika ytor, och samma höjd på
   båda blir fel på minst en. Gamla värden på toppnivå ärvs som utgångsläge. */
function secKlass(){return szMobile()?'telefon':'platta';}
function secScaleAlla(){try{const s=JSON.parse(localStorage.getItem('secScale_v1'));
  return (s&&typeof s==='object')?s:{};}catch(e){return {};}}
function secScaleGet(){
  const a=secScaleAlla();
  const k=a[secKlass()];
  if(k&&typeof k==='object')return Object.assign({},SEC_SCALE_DEF,k);
  /* Inget fack än: ärv toppnivåns tal en gång, så inget hoppar vid uppgradering. */
  const gml={};
  for(const n in a)if(n!=='platta'&&n!=='telefon'&&typeof a[n]==='number')gml[n]=a[n];
  return Object.assign({},SEC_SCALE_DEF,gml);}
function secZoomBas(sec){
  var kl=(document.body&&document.body.classList.contains('kiosk'))?'vagg':secKlass();
  var f=SEC_ZOOM_BAS[kl];
  return (f&&typeof f[sec]==='number')?f[sec]:1;
}
/* ENGANGSOMRAKNING. Den som redan stallt in 160 % pa plattan skulle annars fa
   160 % av det nya grundmattet, alltsa 256 %. Bara det fack som faktiskt fatt
   en ny grundstorlek raknas om - telefonens tal ska sta kvar orort. */
function secScaleMigrera(){
  try{
    if(localStorage.getItem('secScaleBas_v1')==='2')return;
    var a=secScaleAlla(),andrat=false;
    Object.keys(SEC_ZOOM_BAS).forEach(function(klass){
      var bas=SEC_ZOOM_BAS[klass], f=a[klass];
      if(!bas||!f||typeof f!=='object')return;
      Object.keys(bas).forEach(function(sec){
        if(typeof f[sec]==='number'&&isFinite(f[sec])){
          f[sec]=Math.round((f[sec]/bas[sec])*100)/100;andrat=true;
        }
      });
    });
    if(andrat)localStorage.setItem('secScale_v1',JSON.stringify(a));
    localStorage.setItem('secScaleBas_v1','2');
  }catch(e){}
}
/* v727: avsnittens höjd ställs inte längre per enhet – alltid 100 %. Grundzoomen
   per läge (secZoomBas) gäller som förut. */
function secScaleOf(sec){return 1;}
function applySecScale(){const view=$('view-flode');if(!view||!view.querySelector)return;
  /* HORNRADIEN SKA VARA SIG LIK. Hojden sätts med CSS zoom, och zoom skalar
     ALLT - text, luft och hörn. Ett avsnitt på 160 % fick därför 42 px hörn
     mot 26 på de andra, och knapparna inuti blev lika runda i samma takt.
     Motverka genom att dela radien med samma faktor: 26/1,6 = 16,25 px, som
     zoomen sedan förstorar tillbaka till 26 på skärmen.
     Knapparnas radie räknas ur --r och följer därför med av sig själv. */
  SEC_DEF.forEach(sec=>{const el=view.querySelector('[data-sec="'+sec+'"]');if(!el||!el.style)return;
    /* Avrundas till tre decimaler: 1.6*1.6 blir 2.5600000000000005 i flyttal,
       och det talet hamnar rakt i style-attributet. */
    const f=Math.round(secScaleOf(sec)*secZoomBas(sec)*1000)/1000, platt=Math.abs(f-1)<0.001;
    el.style.zoom=platt?'':String(f);
    if(platt)el.style.removeProperty('--r');
    else el.style.setProperty('--r',(R_BAS/f).toFixed(2)+'px');});
  /* v733: energikorten lika stora som de sex rutorna på skärmen. */
  try{const ge=$('stats-energy');
    if(ge&&ge.style){const zt=secScaleOf('tiles')*secZoomBas('tiles'),ze=secScaleOf('energy')*secZoomBas('energy');
      ge.style.setProperty('--kk-z',(ze>0?zt/ze:1).toFixed(4));}}catch(e){}
  /* Spotbandet ligger INUTI energipanelen och ärver därför energins zoom. Det
     gjorde att bandet skalades två gånger på väggplattan — en gång av energin
     och en gång av sin egen inställning — och blev större än soluppgången.
     Nolla arvet och lägg på bandets eget värde relativt panelens. */
  try{
    const pb=$('pband');
    if(pb&&pb.style&&pb.classList.contains('sp-inne')){
      const fe=secScaleOf('energy'), fs2=secScaleOf('spot');
      const rel=fe?(fs2/fe):fs2;
      pb.style.zoom=(Math.abs(rel-1)<0.001)?'':String(rel);
    }
    /* Samma för solremsan inne i väderrutan. */
    const ds=$('daystrip');
    if(ds&&ds.style&&ds.classList.contains('sol-inne')){
      const fw=secScaleOf('weather'), fsu=secScaleOf('sun');
      const rs=fw?(fsu/fw):fsu;
      ds.style.zoom=(Math.abs(rs-1)<0.001)?'':String(rs);
    }
  }catch(e){}
  if(typeof setTimeout==='function')setTimeout(fitScreen,40);}
/* Räkningen skild från omritningen. Förut ritade den ALLTID om "Ordna avsnitt",
   vilket slog sönder varje annan dialog som ville använda samma stegknappar. */
/* Energipanelen och väderrutan lika höga. Innehållet är olika — energi har en
   rad staplar, vädret tre rader — så CSS kan inte räkna ut det. Mät i stället
   och sätt min-height på den kortare. Nollställs först, annars växer den bara
   uppåt när innehållet krymper. */
/* Spotbandet lika högt som soluppgångsremsan. Innehållet skiljer sig — remsan
   har fram- och bakåtknappar, bandet en prisplatta — så CSS kan inte räkna ut
   det. Mät och sätt min-height, samma metod som för panelerna. */
function bandLika(){
  try{
    if(document.body.classList.contains('kiosk'))return;
    var a=document.getElementById('daystrip'), b=document.getElementById('pband');
    if(!a||!b)return;
    b.style.minHeight='';
    if(a.offsetParent===null||b.offsetParent===null)return;
    var ha=a.getBoundingClientRect().height;
    if(!(ha>0))return;
    /* --spbox är användarens egen justering, 1 = samma som remsan. */
    var f=parseFloat(getComputedStyle(b).getPropertyValue('--spbox'))||1;
    b.style.minHeight=Math.round(ha*f)+'px';
  }catch(e){}}

function panelerLika(){
  try{
    if(document.body.classList.contains('kiosk'))return;   /* kiosk fördelar höjd själv */
    var a=document.querySelector('#view-flode .enpanel');
    var b=document.querySelector('#view-flode .wx-card');
    if(!a||!b)return;
    a.style.minHeight='';b.style.minHeight='';
    if(a.offsetParent===null||b.offsetParent===null)return;  /* dolt: mät inte */
    var ha=a.getBoundingClientRect().height, hb=b.getBoundingClientRect().height;
    if(!(ha>0&&hb>0))return;
    var m=Math.max(ha,hb);
    a.style.minHeight=m+'px';b.style.minHeight=m+'px';
  }catch(e){}}

/* Flyttar spotbandet in i energipanelen. Bandet ligger kvar som eget avsnitt i
   ordna-listan, så det går att dölja och flytta som förut — men visas inuti
   energipanelen i stället för som ett eget kort. */
function spotIn(){
  try{
    var pb=$('pband'), plats=$('sp-plats'), del=$('sp-del');
    if(!pb||!plats)return;
    if(pb.parentElement!==plats)plats.appendChild(pb);
    /* Inne i panelen ska bandet inte se ut som ett eget kort. */
    pb.classList.add('sp-inne');
    var dolt=pb.classList.contains('sec-dold');
    if(del)del.style.display=dolt?'none':'';
    plats.style.display=dolt?'none':'';
  }catch(e){}}

/* Flyttar soluppgångsremsan in längst ned i väderrutan. Samma upplägg som
   spotIn: avsnittet finns kvar i ordna-listan och kan döljas, men visas inuti
   väderrutan i stället för som ett eget kort. */
function solIn(){
  try{
    /* v734: med vädret i rubriken ligger remsan kvar i det dolda väderkortet –
       soluppgång och solnedgång står som brickor i energirubriken i stället. */
    var ds=$('daystrip'), plats=$('sol-plats'), del=$('sol-del');
    if(!ds||!plats)return;
    if(ds.parentElement!==plats)plats.appendChild(ds);
    ds.classList.add('sol-inne');
    var dolt=ds.classList.contains('sec-dold');
    if(del)del.style.display=dolt?'none':'';
    plats.style.display=dolt?'none':'';
  }catch(e){}}

function applySecOrder(){const view=$('view-flode');if(!view||!view.appendChild)return;const o=secOrderGet();
  const dolt=secDolda();
  /* v706: FLYTTA BARA OM ORDNINGEN SKILJER. appendChild på ett avsnitt som
     redan står rätt tar ändå ut det ur sidan och sätter in det igen, och då
     startar .view-animationen "rise" om på varje avsnitt — hela startsidan
     tonade in och gled 13 px. Anropades det vid varje uppdatering blinkade
     sidan var 15:e sekund. Står avsnitten redan sist i rätt ordning rörs de inte. */
  /* Bara avsnitt som ligger direkt i vyn räknas. Spotpris och solbandet står
     också i ordningen men bor inne i energipanelen (spotIn/solIn flyttar dit dem). */
  const els=[];o.forEach(sec=>{const el=view.querySelector?view.querySelector('[data-sec="'+sec+'"]'):null;if(el&&el.parentNode===view)els.push(el);});
  const barn=view.children?Array.prototype.slice.call(view.children):null;
  const redanRatt=!!barn&&barn.length>=els.length&&els.every((el,i)=>barn[barn.length-els.length+i]===el);
  o.forEach(sec=>{const el=view.querySelector?view.querySelector('[data-sec="'+sec+'"]'):null;
    if(!el)return;
    if(!redanRatt)view.appendChild(el);
    /* hidden, inte display:none i en regel: elementet ska kunna tas fram igen
       utan att kioskens flexlayout behöver räknas om på nytt. */
    el.classList.toggle('sec-dold',!!dolt[sec]);});
  applySecScale();
  spotIn();
  solIn();
  if(typeof setTimeout==='function'){
    setTimeout(fitScreen,40);
    /* panelerLika() anropas INTE längre: energipanelen och väderrutan har olika
       mycket innehåll, och att tvinga dem lika höga gav en tom lucka i den
       kortare. bandLika är kvar — där är innehållet likvärdigt. */
    setTimeout(bandLika,60);
  }}
/* Flyttar bland TOPPNIVÅNS avsnitt. Förut bytte ▼ på Energi plats med
   Spotpris, som ligger inuti energipanelen — inget syntes hända. */
function secMove(sec,dir){const o=secOrderGet(),top=secTopp(o),i=top.indexOf(sec),j=i+dir;
  if(i<0||j<0||j>=top.length)return;const t=top[i];top[i]=top[j];top[j]=t;
  secOrderSave(secMedInne(top,o));applySecOrder();openSecMove(sec);}
/* SPÄRR MOT DÖDA AVSNITT. secOrderGet filtrerar redan mot SEC_DEF, men ett
   avsnitt utan namn i SECMETA ritades med sitt råa id - "energy-tiles" stod
   kvar i listan hos Markus efter att rutorna bakats in i energiavsnittet.
   Varje id i SEC_DEF har ett namn, så saknas namnet är avsnittet dött oavsett
   var id:t kom ifrån: gammal sparad ordning, synk från Homey, eller en
   framtida borttagning där någon glömmer städa på båda ställena.
   Ett avsnitt utan namn kan inte presenteras för en människa. */
function openSecMove(sel){const alla=secOrderGet().filter(function(x){return !!SECMETA[x];});
  const o=secTopp(alla);
  let h='<div class="te"><div class="cfg-hint" style="margin-top:0">Listan följer startsidan uppifrån och ned. ▲▼ flyttar avsnittet. Indragna rader ligger inuti avsnittet ovanför och följer med när det flyttas. Håll inne ett avsnitt på skärmen för att öppna listan.</div><div class="secmv">';
  /* Statusraden (Hem, Insikter …) ligger alltid överst och kan inte döljas —
     den bär inställningarna. Den står med för att listan ska se ut som sidan. */
  h+='<div class="secmv-row fast"><span class="secmv-n">Statusrad</span><span class="secmv-fast">alltid överst</span></div>';
  o.forEach((sec,i)=>{if(sec==='rum'&&!rumAvsnittPa())return;
    if(sec==='weather'&&wxRubrik())return;   /* v734: vädret står i energirubriken */
    h+='<div class="secmv-row'+(sec===sel?' sel':'')+(secDold(sec)?' dold':'')+'"><span class="secmv-n">'+esc(SECMETA[sec]||sec)+'</span>'
    +'<span class="secmv-btns">'
    /* Text i stället för ikon: uppsättningen saknar öga, och en lånad ikon som
       betyder något annat är sämre än ett ord som säger vad knappen gör. */
    +'<button class="secmv-oga'+(secDold(sec)?' av':'')+'" onclick="secDoldTog(\''+sec+'\')" title="'
    +(secDold(sec)?'Visa avsnittet':'Dölj avsnittet')+'">'+(secDold(sec)?'Visa':'Dölj')+'</button>'
    +'<button onclick="secMove(\''+sec+'\',-1)"'+(i<=0?' disabled':'')+'>'+icon('arrow-fat-up')+'</button>'
    +'<button onclick="secMove(\''+sec+'\',1)"'+(i>=o.length-1?' disabled':'')+'>'+icon('arrow-fat-up','flip')+'</button></span></div>';
    /* Inbäddade avsnitt under sin förälder: Dölj/Visa, ingen flytt. */
    alla.forEach(function(ch){if(SEC_INNE[ch]!==sec)return;
      h+='<div class="secmv-row inne'+(ch===sel?' sel':'')+(secDold(ch)?' dold':'')+'"><span class="secmv-n">'+esc(SECMETA[ch])+'</span>'
      +'<span class="secmv-btns"><button class="secmv-oga'+(secDold(ch)?' av':'')+'" onclick="secDoldTog(\''+ch+'\')" title="'
      +(secDold(ch)?'Visa avsnittet':'Dölj avsnittet')+'">'+(secDold(ch)?'Visa':'Dölj')+'</button></span></div>';});});
  h+='</div><div class="te-adv"><button class="te-use" onclick="closeDetail()">Klar</button><button class="te-alt" onclick="secReset()">Återställ</button></div></div>';
  const dlg=$('dlg');if(dlg&&dlg.classList){dlg.classList.remove('wide');dlg.classList.add('edit');}
  setT('dlg-title','Ordna avsnitt');setIcon('dlg-ic','gauge');const bd=$('dlg-body');if(bd)bd.innerHTML=h;
  const bk=$('dlg-back');if(bk&&bk.classList)bk.classList.add('open');dlgTop();}
/* Dolda avsnitt. Egen nyckel i stället för ett fält i secOrder: ordningen ska
   vara kvar när man tar fram avsnittet igen, och den som redigerar listan ska
   se allt även det som är dolt. Ligger i samma fack per enhetsklass som
   höjderna — en platta och en telefon vill dölja olika saker. */
function secDoldaAlla(){try{return JSON.parse(localStorage.getItem('secDold_v1')||'{}')||{};}catch(e){return {};}}
/* DELAD, som ordningen. Ett avsnitt man gömt ska vara gömt överallt. */
function secDolda(){
  var a=secDoldaAlla();
  if(a&&typeof a.delad==='object')return a.delad;
  var g=a&&(a.platta||a.telefon);
  if(g&&typeof g==='object')return g;
  var o={};for(var n in SEC_DOLD_DEF)o[n]=SEC_DOLD_DEF[n];
  return o;}
function secDold(sec){return !!secDolda()[sec];}
function secDoldTog(sec){
  var a=secDoldaAlla(), k=secDolda();
  if(k[sec])delete k[sec];else k[sec]=1;
  a={delad:k};
  try{localStorage.setItem('secDold_v1',JSON.stringify(a));}catch(e){}
  applySecOrder();
  try{openSecMove(sec);}catch(e){}}

/* HOMEYS KOPIA ÄR UTGÅNGSLÄGET. Återställ hämtar hem den sparade uppsättningen
   i stället för att gå till fabriksvärdena — den layout du byggt är facit, och
   en enhet som råkat hamna fel ska kunna komma tillbaka dit med ett tryck.
   Storleksnycklarna hämtas med: de har egna fack per enhetstyp inuti sig, så
   telefonens mått påverkar inte plattans. */
async function secResetHomey(){
  try{
    if(!appKan())return false;
    var n=await appBackupLas();
    if(!n)return false;
    /* LADDA OM i minnet. appBackupLas skriver bara till localStorage; CFG och
       CONFIG.BUTTONS är redan inlästa och skulle annars ligga kvar med de gamla
       värdena — layouten såg då oförändrad ut trots att hämtningen lyckats.
       Samma ordning som knappen "Hämta från Homey" använder. */
    loadCfg();applyCfg();
    var sb=loadButtons();if(sb)CONFIG.BUTTONS=sb;try{rutorPaNu();}catch(e){}
    applySecOrder();
    try{render();}catch(e){}
    try{renderControls();}catch(e){}
    return true;
  }catch(e){return false;}}

function secReset(){
  /* Prova Homey först; först om det inte går faller vi till fabriksläget. */
  secResetHomey().then(function(ok){
    if(ok){try{openSecMove(SEC_DEF[0]);}catch(e){}return;}
    secResetFabrik();
  });}

function secResetFabrik(){secOrderSave(SEC_DEF.slice());
  try{localStorage.removeItem('secScale_v1');localStorage.removeItem('secDold_v1');}catch(e){}
  applySecOrder();openSecMove(SEC_DEF[0]);}
function pbandTap(){if(_suppressClick){_suppressClick=false;return;}_priceDay=0;openDetail('cost');}
function lpAttach(el){if(!el)return;el.addEventListener('pointerdown',lpDown);el.addEventListener('pointermove',lpMove);el.addEventListener('pointerup',lpUp);el.addEventListener('pointerleave',lpUp);el.addEventListener('pointercancel',lpUp);}
/* HÅLLTRYCK (v676). Inställningarna: håll inne på huset (plattan) eller på
   Hem-fliken (mobilen). Husväxlingen: håll inne på liveprickan. Ett hålltryck
   spärrar klicket som följer (_suppressClick), annars hade Hem-fliken också
   bytt vy. Rörelse mer än 10 px avbryter — det är ett svep, inte ett tryck. */
function hallInne(el,fn,villkor){
  if(!el||!el.addEventListener||el._hallInne)return;el._hallInne=true;
  var t=null,sx=0,sy=0;
  var dn=function(e){if(villkor&&!villkor())return;var p=(e.touches&&e.touches[0])||e;sx=p.clientX||0;sy=p.clientY||0;clearTimeout(t);
    t=setTimeout(function(){t=null;_suppressClick=true;setTimeout(function(){_suppressClick=false;},700);
      if(navigator.vibrate)try{navigator.vibrate(15);}catch(_){}fn();},550);};
  var mv=function(e){if(!t)return;var p=(e.touches&&e.touches[0])||e;
    if(Math.abs((p.clientX||0)-sx)>10||Math.abs((p.clientY||0)-sy)>10){clearTimeout(t);t=null;}};
  var up=function(){if(t){clearTimeout(t);t=null;}};
  el.addEventListener('pointerdown',dn);el.addEventListener('pointermove',mv);
  el.addEventListener('pointerup',up);el.addEventListener('pointerleave',up);el.addEventListener('pointercancel',up);
  /* Klicket efter ett hålltryck ska inte göra något. */
  el.addEventListener('click',function(e){if(_suppressClick){e.stopImmediatePropagation();e.preventDefault();_suppressClick=false;}},true);
}
function husVaxla(){try{if(window.HUSVAKT&&typeof HUSVAKT.vaxla==='function')HUSVAKT.vaxla();}catch(e){}}
function steg2(){
  if(_steg2Kort)return;_steg2Kort=true;
  if(typeof bootSync==='function')bootSync();
  if(typeof fetchSmhiForecast==='function'){fetchSmhiForecast();setInterval(fetchSmhiForecast,25*60000);}
  if(typeof refreshFeeds==='function'){refreshFeeds();setInterval(refreshFeeds,30*60000);}
}
/* Varje tecken räknas. Förut vart 751:a – då kunde ett byte av en enda siffra
   med samma längd, som v762 -> v763, passera obemärkt. */
function fileSig(txt){let h=5381;for(let i=0;i<txt.length;i++){h=((h<<5)+h+txt.charCodeAt(i))|0;}return txt.length+':'+((h>>>0).toString(36));}
function swLage(){return _swLage||'inte försökt';}
function swStarta(){
  try{
    /* Protokollet först. Chrome exponerar navigator.serviceWorker även på http
       och låter registreringen falla — "stöds inte" hade då varit fel svar på
       rätt fråga. Det är https som saknas, inte stödet. */
    if(location.protocol!=='https:'&&location.hostname!=='localhost')
      {_swLage='kräver https – sidan körs över '+location.protocol.replace(':','');return;}
    if(!('serviceWorker' in navigator))
      {_swLage='stöds inte i den här webbläsaren';return;}
    if(window.self!==window.top)
      {_swLage='körs i en ram';return;}
    _swLage='registrerar…';
    navigator.serviceWorker.register('sw.js',{scope:'./',updateViaCache:'none'})
      .then(function(r){
        _swLage='aktiv';
        /* Leta efter en ny version varje gång sidan öppnas. */
        try{r.update();}catch(e){}
      })
      .catch(function(e){_swLage='misslyckades: '+((e&&e.message)||e);});
  }catch(e){_swLage='fel: '+((e&&e.message)||e);}}
function pushKan(){
  return !!(typeof navigator!=='undefined'&&'serviceWorker' in navigator
    &&'PushManager' in window&&typeof Notification!=='undefined'
    &&location.protocol==='https:'&&!IS_SAMSUNG_TABLET);}
function b64(s2){
  var pad='='.repeat((4-s2.length%4)%4);
  var b=(s2+pad).replace(/-/g,'+').replace(/_/g,'/');
  var raw=atob(b),arr=new Uint8Array(raw.length);
  for(var i=0;i<raw.length;i++)arr[i]=raw.charCodeAt(i);
  return arr;}
async function pushPa(){
  try{
    if(!pushKan()){_pushLage=IS_SAMSUNG_TABLET?'avstängt på väggplattan':'stöds inte här';return false;}
    var lov=await Notification.requestPermission();
    if(lov!=='granted'){_pushLage='nekad i webbläsaren';return false;}
    var reg=await navigator.serviceWorker.ready;
    var j=await appGet('/push');
    if(!j||!j.publicKey)throw new Error('appen gav ingen nyckel');
    var sub=await reg.pushManager.getSubscription();
    /* En BEFINTLIG prenumeration är bunden till den VAPID-nyckel den skapades
       med. Byts nyckeln i appen — vid ominstallation, eller om settings rensas —
       går den inte längre att skicka till: Google svarar 403 InvalidSignature.
       Enheten märker ingenting, för getSubscription() ger fortfarande något.

       Därför jämförs nyckeln, och stämmer den inte tecknas prenumerationen om.
       Utan det här kan en enhet sluta ta emot notiser för alltid, utan att vare
       sig den eller appen säger till. */
    var vill=b64(j.publicKey);
    if(sub){
      var har=null;
      try{har=new Uint8Array(sub.options&&sub.options.applicationServerKey||[]);}catch(e){}
      var lika=!!har&&har.length===vill.length;
      if(lika)for(var i=0;i<vill.length;i++)if(har[i]!==vill[i]){lika=false;break;}
      if(!lika){
        try{await appPost('/push',{avreg:sub.endpoint});}catch(e){}
        try{await sub.unsubscribe();}catch(e){}
        sub=null;
      }
    }
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,
      applicationServerKey:vill});
    var namn=(IS_SAMSUNG_TABLET?'Väggplattan':(MOBILE?'Telefon':'Platta'));
    var r=await appPost('/push',{sub:sub.toJSON?sub.toJSON():sub,namn:namn});
    _pushLage=(r&&r.ok)?('på · '+r.antal+' enhet'+(r.antal>1?'er':'')):'appen svarade inte';
    return !!(r&&r.ok);
  }catch(e){_pushLage='fel: '+((e&&e.message)||e);return false;}}
async function pushAv(){
  try{
    var reg=await navigator.serviceWorker.ready;
    var sub=await reg.pushManager.getSubscription();
    if(sub){await appPost('/push',{avreg:sub.endpoint});await sub.unsubscribe();}
    _pushLage='av';return true;
  }catch(e){_pushLage='fel: '+((e&&e.message)||e);return false;}}
async function pushProv(){
  try{
    var r=await appPost('/push',{prov:true});
    /* Per enhet, inte bara ett antal. "2 skickade" räcker inte när tre enheter
       skulle ha fått notisen — man ser att något fattas men inte vilken. */
    if(!r||!r.skickade){_pushLage='ingen mottagare';return;}
    var t='prov: '+(r.till&&r.till.length?r.till.join(', '):r.skickade+' st');
    if(r.borttagna)t+=' · '+r.borttagna+' döda borttagna';
    if(r.fel&&r.fel.length)t+=' · '+r.fel.join(' · ');
    _pushLage=t;
  }catch(e){_pushLage='fel: '+((e&&e.message)||e);}}
function cfgPushRita(){
  var e=$('push-lage');if(!e)return;
  e.textContent=_pushLage;
  pushStatus().then(function(st){
    var e2=$('push-lage');if(!e2)return;
    if(!st.kan){e2.textContent=IS_SAMSUNG_TABLET?'av på väggplattan':'stöds inte här';return;}
    if(_pushLage.indexOf('fel')===0||_pushLage.indexOf('prov')===0)return;
    e2.textContent=st.pa?'på':(st.lov==='denied'?'nekad i webbläsaren':'av');
  });}
async function pushStatus(){
  try{
    if(!pushKan())return {kan:false,pa:false};
    var reg=await navigator.serviceWorker.ready;
    var sub=await reg.pushManager.getSubscription();
    return {kan:true,pa:!!sub,lov:Notification.permission};
  }catch(e){return {kan:false,pa:false};}}

async function checkForUpdate(){try{
  if(CFG.autoreload===false)return;
  if(typeof location==='undefined'||!location.href||location.href.indexOf('http')!==0)return;
  const c=new AbortController(),id=setTimeout(()=>c.abort(),7000);
  const r=await fetch(location.href,{cache:'no-store',signal:c.signal});if(!r.ok){clearTimeout(id);return;}
  let txt=await r.text();if(!txt||txt.length<500){clearTimeout(id);return;}
  /* Koden ligger i js/ – en ändring där syns inte i HTML-filen. Ta med varje
     skriptfil sidan pekar på. no-cache frågar servern varje gång men får 304
     när filen är oförändrad, så det blir inte en hel nedladdning i minuten. */
  for(const m of txt.matchAll(/<script src="([^"]+)"/g)){
    const r2=await fetch(new URL(m[1],location.href),{cache:'no-cache',signal:c.signal});
    if(!r2.ok){clearTimeout(id);return;}
    txt+=await r2.text();}
  clearTimeout(id);const sig=fileSig(txt);
  if(_selfSig==null){_selfSig=sig;return;}
  if(sig!==_selfSig){
    const bk=$('dlg-back'),dlgOpen=bk&&bk.classList&&bk.classList.contains('open');
    if(dlgOpen||_timeActive)return; /* vänta tills användaren är klar */
    location.reload();
  }
}catch(e){}}
