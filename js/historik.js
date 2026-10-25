/* js/historik.js — Tidsseriegraferna: husbatteriet tolv timmar, tidsval, lång historik, helskärm, sju dygn och temperaturer per zon.
 *
 * Filen innehåller BARA funktionsdeklarationer. Konstanter, tillstånd och allt
 * som körs direkt vid laddning ligger i js/start.js, som laddas sist, under
 * rubriken [historik.js]. En funktion går att anropa oavsett vilken fil den står
 * i, men kod som körs vid laddning kan här anropa en funktion i en fil som inte
 * hunnit laddas. Lägg den därför aldrig här.
 */

function grafLage(id){var b=grafBasId(id),l=_grafLage[b];
  if(l==='tim'||l==='dyg')return l;
  return (typeof grafTim(b)==='string')?'dyg':'tim';}
/* HELSKÄRMEN RITAR MED ETT EGET ID. Popupen ligger kvar bakom, och ritade
   båda med samma id (avl-g2-batt) hittade getElementById ALLTID popupens
   dolda graf — dragningen skedde, men på fel overlay, så inget syntes i
   helskärm. Helskärmen använder därför <id>-full för sin avl-geometri, medan
   tidsfönstret läses från bas-id:t så 1h/3h/… förblir delat. */
function grafBasId(id){return String(id||'').replace(/-full$/,'');}
function grafTim(id){var v=_grafTim[grafBasId(id)];return (GRAF_TIM.indexOf(v)>=0)?v:12;}
/* Lång period = allt som inte är ett timtal. */
function grafLang(id){return typeof grafTim(id)==='string';}
/* Svenskt datum för en tidsstämpel, plus veckodag (0 = måndag). Veckodagen
   räknas på datumet självt via Date.UTC, så den beror inte på enhetens zon. */
function svDatum(ms){
  var q={};new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',year:'numeric',month:'2-digit',day:'2-digit'})
    .formatToParts(new Date(ms)).forEach(function(p){q[p.type]=p.value;});
  var y=+q.year,m=+q.month,d=+q.day;
  return {y:y,m:m,d:d,vd:(new Date(Date.UTC(y,m-1,d)).getUTCDay()+6)%7};
}
/* Midnatt i Stockholm för datumet (y, m, d). d får ligga utanför månaden —
   Date.UTC normaliserar. Offseten mäts vid själva midnatten, så dygn med
   sommartidsomställning blir rätt. */
function svMidnatt(y,m,d){
  var vagg=Date.UTC(y,m-1,d,0,0,0);
  var off=function(ms){var q={};new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',year:'numeric',
      month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'})
    .formatToParts(new Date(ms)).forEach(function(p){q[p.type]=p.value;});
    return Date.UTC(+q.year,+q.month-1,+q.day,+q.hour,+q.minute,+q.second)-Math.floor(ms/1000)*1000;};
  var ms=vagg-off(vagg);
  return vagg-off(ms);
}
function grafFonster(id){
  var t1=Date.now(),t=grafTim(id);
  if(typeof t==='number')return {t0:t1-t*3600000,t1:t1};
  if(t==='7d')return {t0:t1-7*86400000,t1:t1};
  if(t==='30d')return {t0:t1-30*86400000,t1:t1};
  var q=svDatum(t1);
  if(t==='v')return {t0:svMidnatt(q.y,q.m,q.d-q.vd),t1:t1};
  return {t0:svMidnatt(q.y,q.m,1),t1:t1};
}
function grafSattLage(id,l){
  _grafLage[grafBasId(id)]=l;
  grafValRita();
}
function grafSattTim(id,h){
  _grafTim[grafBasId(id)]=h;
  _grafLage[grafBasId(id)]=(typeof h==='string')?'dyg':'tim';
  if(typeof h==='string')langBehov(null);
  grafValRita();
}
/* Ritar om allt som kan visa ett tidsval: popupen, helskärmen och vädersidan. */
function grafValRita(){
  /* Rita om båda vyerna som kan visa fönstret: popupkroppen (via _grafOmRita,
     som popupen satt till sin byggare) OCH en öppen helskärm. Valet är delat,
     så det ska synas på båda direkt. */
  try{if(typeof _grafOmRita==='function')_grafOmRita();}catch(e){}
  try{if(_grafFull)grafFullRita();}catch(e){}
  /* OCH VÄDERSIDAN. Den är ingen popup, så _grafOmRita rör den inte —
     knapparna där ändrade valet utan att något ritades om, och de verkade
     döda. Nästa omritning av annan orsak visade plötsligt det senast tryckta
     värdet, vilket såg ut som att fönstret bytte av sig självt vid vyväxling.
     Samma villkor som övriga anrop till renderVader använder. */
  try{if(document.getElementById('vdr-body'))renderVader();}catch(e){}
}
/* Källa för en nyckel: fast tabell, eller en sensorbricka "c:<enhet>:<cap>". */
function langKalla(k){
  if(LANG_KALLA[k]){try{var a=LANG_KALLA[k]();return a&&a[0]?{dev:a[0],caps:a[1],f:a[2]}:null;}catch(e){return null;}}
  var m=/^c:([^:]+):(.+)$/.exec(k||'');
  return m?{dev:m[1],caps:[m[2]]}:null;
}
/* EXAKT kapacitet. findLog matchar på delsträng, och då kunde measure_power
   träffa measure_power.batt_charge beroende på loggarnas ordning. */
/* v701: batteriets historik ur Modbus. Effekten är två loggar (laddning och
   urladdning, båda ≥ 0) som slås ihop till ett netto med tecken: + laddar.
   hamta(lg) ska ge punkterna [{t,v}] för en logg. */
async function battNettoHist(logs,hamta){
  var lc=exaktLogg(logs,BATT_MB,['measure_power.batt_charge']),ld=exaktLogg(logs,BATT_MB,['measure_power.batt_discharge']);
  if(!lc&&!ld)return [];
  var a=lc?(await hamta(lc))||[]:[],b=ld?(await hamta(ld))||[]:[];
  return battNettoSlå(a,b);
}
function battNettoSlå(a,b){
  var m={};
  (a||[]).forEach(function(p){if(p&&isFinite(p.v))(m[p.t]=m[p.t]||{}).c=p.v;});
  (b||[]).forEach(function(p){if(p&&isFinite(p.v))(m[p.t]=m[p.t]||{}).d=p.v;});
  return Object.keys(m).map(Number).sort(function(x,y){return x-y;}).map(function(t){var o=m[t];
    return {t:t,v:(o.c<0?o.c:(o.c||0))-Math.abs(o.d||0)};});
}
function exaktLogg(logs,devId,caps){
  var arr=Array.isArray(logs)?logs:Object.values(logs||{}),owner='homey:device:'+devId;
  for(var c=0;c<caps.length;c++){
    for(var i=0;i<arr.length;i++){var lg=arr[i]||{},lid=lg.id||'',lo=lg.uri||lg.ownerUri||'';
      if(lo!==owner&&lid.indexOf(owner+':')!==0)continue;
      if(lid===caps[c]||lid===owner+':'+caps[c])return {uri:owner,id:lid};}
  }
  return null;
}
/* Registrerar att en graf vill ha nyckeln k och startar hämtning om den
   saknas eller är gammal. Anropas från ritningen — därför bara en timer här,
   aldrig själva hämtningen, och aldrig två samtidigt. */
function langBehov(k){
  if(k)_langVill[k]=1;
  var nu=Date.now(),beh=false;
  if(nu-_langFelAt<60000)return;            /* Homey svarade inte nyss: vänta en minut */
  for(var x in _langVill){if(!(x in LANG_AT)||nu-LANG_AT[x]>LANG_TTL){beh=true;break;}}
  if(beh&&!_langLaddar&&typeof setTimeout==='function')setTimeout(langHamta,0);
}
async function langHamta(){
  if(_langLaddar)return;
  _langLaddar=true;var nagot=false;
  try{
    if(!_langLogs||Date.now()-_langLogsAt>3600000){
      var lr=await insGet('/api/manager/insights/log/',15000);
      if(!lr.data){_langFelAt=Date.now();return;}
      _langLogs=lr.data;_langLogsAt=Date.now();
    }
    var nu=Date.now();
    var keys=Object.keys(_langVill).filter(function(k){return !(k in LANG_AT)||nu-LANG_AT[k]>LANG_TTL;});
    for(var i=0;i<keys.length;i++){var k=keys[i];
      LANG_AT[k]=Date.now();                    /* även vid fel: inget nytt försök förrän TTL */
      var src=langKalla(k);if(!src)continue;
      var pts;
      if(src.caps[0]==='husskarv'){
        pts=await husSkarvHist(_langLogs,async function(lg){var e3=await insGet('/api/manager/insights/log/'+lg.uri+'/'+lg.id+'/entry?resolution=last31Days',25000);return e3.data?parseEntries(e3.data):[];});
      }else if(src.caps[0]==='netto'){
        pts=await battNettoHist(_langLogs,async function(lg){var e1=await insGet('/api/manager/insights/log/'+lg.uri+'/'+lg.id+'/entry?resolution=last31Days',25000);return e1.data?parseEntries(e1.data):[];});
      }else{
        var lg=exaktLogg(_langLogs,src.dev,src.caps);if(!lg)continue;
        var e=await insGet('/api/manager/insights/log/'+lg.uri+'/'+lg.id+'/entry?resolution=last31Days',25000);
        pts=e.data?parseEntries(e.data):[];}
      if(src.f)pts=pts.map(function(p){return {t:p.t,v:src.f(p.v)};});
      if(pts.length){LANG[k]=pts;nagot=true;}
    }
  }catch(e){}
  finally{_langLaddar=false;}
  if(nagot){
    try{grafOmRitaAlla();}catch(e){}
    try{if(document.getElementById('vdr-body'))renderVader();}catch(e){}
    try{render();}catch(e){}
  }
  /* Nycklar som tillkom under hämtningen. */
  langBehov(null);
}
/* Serien för en graf: lokal historik i korta perioder; i långa Insights
   timvärden + det som mätts lokalt efter dem. */
function histV(k,cid,lokal){
  var loc=lokal||HIST[k]||[];
  if(!cid||!grafLang(cid))return loc;
  langBehov(k);
  var l=LANG[k];if(!l||!l.length)return loc;
  var sist=l[l.length-1].t,ut=l.slice();
  for(var i=0;i<loc.length;i++){var p=loc[i];if(p&&p.t>sist)ut.push(p);}
  return ut;
}
/* utanFull=true i helskärmen: där finns redan krysset, och en till
   helskärmsknapp inne i helskärmen är bara förvirrande. */
/* utanTim: grafer vars fönster inte är valbart — solprognosen väljer dygn med
   egna knappar ovanför — får bara helskärmsknappen. */
function grafTidsval(id,utanFull,utanTim){
  var bas=grafBasId(id);
  var full=utanFull?'':('<button class="graf-full" onclick="grafHelskarm(\''+bas+'\')" aria-label="Helskärm">'
    +icon('corners-out')+'</button>');
  if(utanTim)return '<div class="graf-verktyg"><div class="graf-tim"></div>'+full+'</div>';
  var lage=grafLage(bas),vald=grafTim(bas);
  var h='<div class="graf-verktyg graf-tva"><div class="graf-rad1"><div class="graf-lage" role="group" aria-label="Skala">'
    +'<button class="graf-lage-b'+(lage==='tim'?' on':'')+'" aria-pressed="'+(lage==='tim')+'" onclick="grafSattLage(\''+bas+'\',\'tim\')">Timmar</button>'
    +'<button class="graf-lage-b'+(lage==='dyg'?' on':'')+'" aria-pressed="'+(lage==='dyg')+'" onclick="grafSattLage(\''+bas+'\',\'dyg\')">Dygn</button>'
    +'</div>'+full+'</div><div class="graf-tim">';
  for(var i=0;i<GRAF_TIM.length;i++){
    var t=GRAF_TIM[i];
    if((typeof t==='string')!==(lage==='dyg'))continue;
    var arg=(typeof t==='string')?('\''+t+'\''):String(t);
    h+='<button class="graf-tim-b'+(t===vald?' on':'')+'" onclick="grafSattTim(\''+bas+'\','+arg+')">'
      +GRAF_TIM_LAB[t]+'</button>';
  }
  return h+'</div></div>';
}
function grafHelskarm(id){
  _grafFull=id;
  var el=document.getElementById('graf-full-lager');
  if(!el){
    el=document.createElement('div');el.id='graf-full-lager';
    el.className='graf-full-back';
    el.onclick=function(e){if(e.target===el)grafFullStang();};
    document.body.appendChild(el);
  }
  grafFullRita();
  document.body.classList.add('graf-full-open');
  /* Riktig helskärm + liggande lås. Allt bakom feature-detektion och try/catch:
     lyckas det vrids enhetens UI till landskap och grafen fyller skärmen med
     rätt koordinater; misslyckas det (iOS, desktop) står grafen upprätt och
     fyller ändå, utan att något hänger. Måste ske i samma tryck-gest som
     öppnandet — därför här, inte i en callback. */
  /* LIGGANDE FRAMFÖR NOTISFRIHET. Chrome kräver fullscreen för att låsa
     orienteringen i en vanlig flik, och fullscreen ger dess egen notis ("dra
     från toppen…"), som inte går att ta bort. Båda går inte att få i en flik
     — v619 valde bort notisen och tappade liggande; det var fel prioritering.
     Ordningen minimerar notisen ändå: låset FÖRST (lyckas utan fullscreen som
     installerad PWA → ingen notis), fullscreen bara som reserv när låset
     avvisas. Vill man slippa notisen helt: lägg till dashboarden på hemskärmen. */
  var las=function(){
    try{
      if(screen&&screen.orientation&&screen.orientation.lock)
        return screen.orientation.lock('landscape');
    }catch(e){}
    return Promise.reject(new Error('inget orienteringslås'));
  };
  var medFullscreen=function(){
    try{
      var re=el.requestFullscreen||el.webkitRequestFullscreen||el.mozRequestFullScreen;
      if(!re)return;
      var pr=re.call(el);
      var efter=function(){las().catch(function(){});};
      if(pr&&pr.then)pr.then(efter,function(){}); else efter();
    }catch(e){}
  };
  try{
    var forsok=las();
    if(forsok&&forsok.then)forsok.then(function(){},medFullscreen); else medFullscreen();
  }catch(e){medFullscreen();}
}
function grafFullStang(){
  _grafFull=null;
  var el=document.getElementById('graf-full-lager');
  if(el)el.innerHTML='';
  document.body.classList.remove('graf-full-open');
  try{if(screen&&screen.orientation&&screen.orientation.unlock)screen.orientation.unlock();}catch(e){}
  try{
    var ex=document.exitFullscreen||document.webkitExitFullscreen||document.mozCancelFullScreen;
    if(ex&&(document.fullscreenElement||document.webkitFullscreenElement))ex.call(document);
  }catch(e){}
}
function grafFullRita(){
  var id=_grafFull;if(!id)return;
  var el=document.getElementById('graf-full-lager');if(!el)return;
  var b=_grafByggare[id];
  var titel=(b&&b.titel)||'Graf';
  /* Byggaren får helskärmens eget id, så dess avl-lager inte krockar med
     popupens. Tidsfönstret läses ändå från bas-id:t (grafBasId). */
  var graf=(b&&typeof b.full==='function')?b.full(id+'-full'):'';
  el.innerHTML='<div class="graf-full-ram">'
    +'<div class="graf-full-h"><span>'+esc(titel)+'</span>'
    +'<button class="graf-full-x" onclick="grafFullStang()" aria-label="Stäng">'+icon('close')+'</button></div>'
    +'<div class="graf-full-graf">'+graf+'</div>'
    +grafTidsval(id,true)+'</div>';
}
/* När fönstret eller data ändras och helskärmen är öppen ska den ritas om. */
function grafOmRitaAlla(){
  try{if(typeof _grafOmRita==='function')_grafOmRita();}catch(e){}
  if(_grafFull)grafFullRita();
}
function battGrafHTML(cid){
  cid=cid||'g2-batt';
  var P=(PAL&&PAL[curTheme])||{};
  var f=grafFonster(cid),t0=f.t0,t1=f.t1;
  /* Laddnivån tillbaka i samma bild, på egen 0–100-skala precis som i
     förbrukning nu (fonster.pct). Nollinjen släckt: effekten korsar noll men
     procenten gör det inte, så en gemensam nollinje sa emot den ena kurvan. */
  return dayChart(
    /* Grön när batteriet laddar (positiv effekt), gul/orange när det laddar
       ur (negativ). Samma tvåfärgsknep som elnätsgrafen: kurvan klipps vid
       noll, och avläsningens färg följer tecknet. */
    [{key:'battpow',pts:histV('battpow',cid,battPowSerie()),col:(P.green||'#7bc47f'),col2:(P.gold||'#ebcb8b'),label:'Effekt'}],
    /* v687: nollinjen tillbaka — laddnivån har 0 % på samma linje. */
    {t0:t0,t1:t1,cid:cid,
     pct:{key:'battpct',pts:histV('batt',cid),col:(P.cyan||'#57b6c2'),label:'Laddnivå'}});
}
function infoBlock(id,text){
  var op=_infoOppen[id]?' open':'';
  return '<span class="di-q" onclick="infoVisa(\''+id+'\')">i</span>'
    +'<div class="drow-info'+op+'" id="info-'+id+'">'+text+'</div>';
}
function infoVisa(id){
  _infoOppen[id]=!_infoOppen[id];
  var e=$('info-'+id);
  if(e)e.classList.toggle('open',!!_infoOppen[id]);
}
/* BATTERIETS TECKEN HAMTAS DAR DET ER OBSERVERBART.
   Forra losningen las measure_power och VANDE tecknet vid ritningen, med en
   kommentar daterad 2026-08-21 om att measure_power skulle peka at motsatt
   hall mot energy_power. Den uppgiften gar inte att kontrollera: batteriet har
   ingen Insights-logg for measure_power, bara for energy_power och
   measure_battery. Ett antagande om polaritet som ingen kan mata ar precis den
   sortens pastaende som inte hor hemma i koden.

   Uppmatt 2026-08-30, tva oberoende kontroller:
     energy_power +5000 W kl 09:35-15:15 medan nivan steg 41 % -> 99 %
     energy_power -3000..-5000 W kl 16:55-17:50 medan nivan foll 100 % -> 82 %
     SolarEdges egna laddregister measure_power.batt_charge visade 31 -> 272 W
     kl 17:57 samtidigt som energy_power visade +55 -> +250 W.
   Alltsa: positivt = laddar. Det ar den konvention historiken redan foljer.

   Har tas darfor BELOPPET och tecknet ur battery_charging_state, precis som
   rutorna pa startsidan gor, med energy_power som forstahandskalla nar den
   finns. Ingen polaritet att ha fel om, och live och historik kan inte glida
   isar eftersom bada pekar at samma hall av konstruktion. */
function battEffektNu(){
  var e=capLive(DEV.battery,'energy_power');
  if(e!=null&&isFinite(e))return e;              /* uppmatt: + = laddar */
  var w=capLive(DEV.battery,'measure_power');
  if(w==null||!isFinite(w))return null;
  var st=capLive(DEV.battery,'battery_charging_state');
  if(st==='charging')return Math.abs(w);
  if(st==='discharging')return -Math.abs(w);
  if(st==='idle')return 0;
  return null;   /* okant lage: hellre en lucka i grafen an fel tecken */
}
/* Serien lagras redan med ratt tecken. Funktionen finns kvar for att dygnsvyn
   och historiken ska ga genom samma ingang. */
function battPowSerie(){return HIST['battpow']||[];}
/* ENGANGSSTADNING. Punkter som spelades in fore v593 ligger kvar i webblasaren
   med det gamla, ovanda tecknet, och de skulle sitta kvar till midnatt och
   blanda ihop de tva konventionerna i samma kurva. De kastas en gang; serien
   fylls pa igen fran Insights vid nasta seedHistory och lopande av matningen. */
function battPowStad(){
  try{
    if(localStorage.getItem('battpow_v2'))return;
    if(HIST&&HIST['battpow'])delete HIST['battpow'];
    saveHist();
    localStorage.setItem('battpow_v2','1');
  }catch(e){}
}
/* findLog tar en lista och tar första loggen som matchar NÅGON av strängarna —
   då avgör loggarnas ordning, inte vår. Här frågar vi en kandidat i taget, så
   att energy_power verkligen provas först. */
function hittaLogg(logs,devId,kandidater){
  for(var i=0;i<kandidater.length;i++){
    var lg=findLog(logs,devId,[kandidater[i]]);
    if(lg)return lg;
  }
  return null;
}
/* Egen hämtare med längre tidsgräns. Sju dygns effektlogg är mycket mer data än
   ett dygn, och homeyGet ger upp efter åtta sekunder — rimligt för allt annat,
   men kan vara för kort just här. */
/* Skiljer "Homey svarade inte" från "loggen finns men är tom". Uppmätt
   2026-08-21: sol, förbrukning och Pulse ger 277 poster där ALLA är null,
   medan batteriets loggar ger 277 riktiga tal. Det är alltså Homey som inte
   sparar något för de effektloggarna — inte dashboarden som läser fel. */
function antalNull(d){
  var v=d&&(Array.isArray(d)?d:(d.entries||d.values||d.data));
  if(!Array.isArray(v)||!v.length)return 'tomt svar';
  var nullar=v.filter(function(p){return p&&p.v===null;}).length;
  return (nullar===v.length)
    ? ('loggen är tom i Homey ('+v.length+' punkter, alla utan värde)')
    : ('inga brukbara värden av '+v.length);
}
async function insGet(path,ms){
  var c=new AbortController(),id=setTimeout(function(){c.abort();},ms||25000);
  try{
    var r=await fetch(BASE.replace(/\/$/,'')+path,{headers:{Authorization:'Bearer '+CONFIG.TOKEN},signal:c.signal});
    clearTimeout(id);
    if(!r.ok)return {fel:'HTTP '+r.status};
    return {data:await r.json()};
  }catch(e){clearTimeout(id);return {fel:(e&&e.name==='AbortError')?'tidsgräns':'ingen kontakt'};}
}
async function hist7Hamta(force){
  if(_hist7Laddar)return;
  if(!force&&_hist7At&&Date.now()-_hist7At<10*60000)return;
  _hist7Laddar=true;_hist7Fel=null;_hist7Info={};
  try{
    var lr=await insGet('/api/manager/insights/log/',15000);
    var logs=lr.data;
    if(!logs){_hist7Fel='Insights svarade inte'+(lr.fel?(' ('+lr.fel+')'):'');return;}
    var ut={};
    for(var k in HIST7_VILL){
      if(HIST7_VILL[k][1][0]==='husskarv'){
        var ph7=await husSkarvHist(logs,async function(lg3){var e4=await insGet('/api/manager/insights/log/'+lg3.uri+'/'+lg3.id+'/entry?resolution=last7Days');return e4.data?parseEntries(e4.data):[];});
        _hist7Info[k]={id:'energy_power → '+HUS_CAP,n:ph7.length,fel:ph7.length?null:'ingen logg hittad'};
        if(ph7.length)ut[k]=ph7;continue;}
      if(HIST7_VILL[k][1][0]==='netto'){
        var pn=await battNettoHist(logs,async function(lg2){var e2=await insGet('/api/manager/insights/log/'+lg2.uri+'/'+lg2.id+'/entry?resolution=last7Days');return e2.data?parseEntries(e2.data):[];});
        _hist7Info[k]={id:'batt_charge − batt_discharge',n:pn.length,fel:pn.length?null:'ingen logg hittad'};
        if(pn.length)ut[k]=pn;continue;}
      var lg=hittaLogg(logs,HIST7_VILL[k][0](),HIST7_VILL[k][1]);
      if(!lg){_hist7Info[k]={fel:'ingen logg hittad'};continue;}
      var e=await insGet('/api/manager/insights/log/'+lg.uri+'/'+lg.id+'/entry?resolution=last7Days');
      var pts=e.data?parseEntries(e.data):[];
      _hist7Info[k]={id:lg.id,n:pts.length,fel:e.fel||(pts.length?null:antalNull(e.data))};
      if(pts.length)ut[k]=pts;
    }
    if(Object.keys(ut).length){HIST7=ut;_hist7At=Date.now();}
  }catch(e){_hist7Fel=(e&&e.message)||'fel vid hämtning';}
  finally{_hist7Laddar=false;
    /* Står solrutan öppen ritas prognosavsnittet om, annars syns gårdagens
       kurva först nästa gång rutan öppnas. */
    try{var ps=$('prog-sec');if(ps)ps.innerHTML=progAvsnitt();}catch(e3){}}
}
/* (v686) Sjudygnsvyn — dygnsknappar, dygnsfönster, sammanfattning och
   buildHistPopup — är borttagen. Tidsvalen i förbrukning nu (7d, 30d, vecka,
   månad) visar samma sak ur Insights. HIST7/hist7Hamta finns kvar: solprognosen
   och exporten använder dem. */
function buildEnergyPopup(){
  const pw=w=>(w==null?'–':(Math.abs(w)>=1000?num(w/1000,1)+' kW':Math.round(w)+' W'));
  const house=houseNowW(),sol=cap(DEV.solar,'measure_power');
  const solDay=cap(DEV.solar,'meter_power.day'),solYear=cap(DEV.solar,'meter_power.year');
  const bpct=cap(DEV.battery,'measure_battery'),bpow=cap(DEV.battery,'measure_power'),bstate=cap(DEV.battery,'battery_charging_state'),bt=battTimeStr();
  const grid=cap(DEV.pulse,'measure_power'),price=elprisNow();
  const bought=boughtYear(),sold=soldYear();
  const _isAI=energyInsightIsAI();
  const P=(PAL&&PAL[curTheme])||{};
  let h='<div class="ww-head">';
  h+='<div class="ww-box"><span class="ww-ic" style="color:var(--warm)">'+icon('lightning')+'</span><div class="ww-bt"><div class="ww-line"><span class="ww-big">'+pw(house)+'</span></div><div class="ww-sub">förbrukning nu</div></div></div>';
  h+='<div class="ww-div"></div>';
  h+='<div class="ww-box"><span class="ww-ic" style="color:var(--ok)">'+icon('sun')+'</span><div class="ww-bt"><div class="ww-line"><span class="ww-big">'+pw(sol)+'</span></div><div class="ww-sub">solproduktion</div></div></div>';
  h+='</div>';
  /* Insiktsraden är borttagen i v603. Grafen står direkt under mätvärdena nu.
     _isAI och energyInsight() används fortfarande på andra håll. */
  var se=energiSerier('live','g2-day');
  /* Samma tidsval (1–24 h) och helskärm som elnät och batteri, via cid g2-day.
     grafRubrik skriver ut valt fönster i rubriken; grafFonster ger t0/t1. */
  var _ef=grafFonster('g2-day');
  h+=grafRubrik('g2-day','Sol, förbrukning &amp; batteri',
      infoBlock('dygn','Skalan är watt. Den streckade linjen är batteriets '
        +'laddningsnivå på egen skala: 0 % vid nollinjen, 100 % högst upp. '
        +'Batteriets effekt är positiv när det laddas och negativ när det laddar ur.'))
    +dayChart(se.linjer,{pct:se.procent,cid:'g2-day',t0:_ef.t0,t1:_ef.t1})
    +grafTidsval('g2-day');
  /* Byggare + omritning så tidsval och helskärm kan rita om just den här vyn. */
  _grafByggare['g2-day']={titel:'Sol, förbrukning & batteri',full:function(cid){
    cid=cid||'g2-day';
    var s2=energiSerier('live',cid),f2=grafFonster(cid);
    return dayChart(s2.linjer,{pct:s2.procent,cid:cid,t0:f2.t0,t1:f2.t1});}};
  /* (v686: knappen Historik · sju dygn är borttagen — tidsvalet har 7d, 30d,
     vecka och månad.) */
  h+='<div class="pop-gap"></div>';
  h+=buildBoughtYear();
  h+='<div class="alt-hint">Håll kvar fingret för att växla vy</div>';
  return h;}
function dlgIdleReset(){if(_dlgIdle){clearTimeout(_dlgIdle);_dlgIdle=null;}if(!IDLE_CLOSE_MS)return;var b=$('dlg-back');if(b&&b.classList&&b.classList.contains('open')&&typeof setTimeout==='function'){_dlgIdle=setTimeout(function(){try{closeDetail();}catch(e){}},IDLE_CLOSE_MS);}}
function dlgTop(){var b=$('dlg-body');if(b)b.scrollTop=0;dlgIdleReset();}
/* Färgen får anges som palettnamn ELLER som literal hex. Paletten har bara sex
   färger som går att skilja åt, och zonerna är åtta. Utan literalen tog två av
   dem samma färg som befintliga rader: 'ok' finns inte i paletten och föll
   tillbaka på blå (= Källare), och 'gold' är samma hex som 'sun' (= Uterum). */
function tempCol(t){
  if(t&&typeof t.c==='string'&&t.c.charAt(0)==='#')return t.c;
  var P=PAL[curTheme]||PAL.dark;return P[t.c]||P.blue;
}
function tempHasData(t){var cut=Date.now()-24*3600000,raw=t.ser()||[],n=0;
  for(var i=0;i<raw.length;i++){var p=raw[i];if(p&&p.v!=null&&isFinite(p.v)&&p.t>=cut)n++;if(n>=2)return true;}
  return false;}
function tempOn(k){var o=CFG.tempLines||{};return o[k]!==false;}
function tempToggle(k){if(!CFG.tempLines)CFG.tempLines={};
  CFG.tempLines[k]=!tempOn(k);
  var any=false;for(var i=0;i<TEMPS.length;i++)if(tempOn(TEMPS[i].k))any=true;
  if(!any)CFG.tempLines[k]=true;                 /* minst en linje måste vara kvar */
  saveCfg();openDetail('temps');}
/* tempAll ("Visa alla") borttagen i v655 tillsammans med sin knapp. */
function multiTempSVG(cid){
  cid=cid||'temps';
  var fen=grafFonster(cid);
  var W=300,H=136,padL=4,padR=4,padT=10,padB=16;
  var out=[],t0=Infinity,t1=-Infinity,ylo=Infinity,yhi=-Infinity,cut=fen.t0;
  for(var i=0;i<TEMPS.length;i++){var t=TEMPS[i];if(!tempOn(t.k))continue;
    var raw=t.ser(cid)||[],seg=[];
    for(var j=0;j<raw.length;j++){var pt=raw[j];if(pt&&pt.v!=null&&isFinite(pt.v)&&pt.t>=cut)seg.push(pt);}
    if(seg.length<2)continue;
    t0=Math.min(t0,seg[0].t);t1=Math.max(t1,seg[seg.length-1].t);
    for(var m=0;m<seg.length;m++){if(seg[m].v<ylo)ylo=seg[m].v;if(seg[m].v>yhi)yhi=seg[m].v;}
    out.push({t:t,s:seg});}
  if(!out.length)return '<div class="viz-empty">Samlar in data… grafen fylls på efter hand.</div>';
  var tr=(t1-t0)||1,yr=(yhi-ylo)||1,mp=yr*0.12;ylo-=mp;yhi+=mp;yr=yhi-ylo;
  var X=function(v){return padL+(v-t0)/tr*(W-padL-padR);},Y=function(v){return padT+(1-(v-ylo)/yr)*(H-padT-padB);};
  var g='<svg class="tg-svg" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none">'+nollLinje(nollY(Y,ylo,yhi),padL,W-padR);
  for(var q=0;q<out.length;q++){var o=out[q];
    var d=smoothPath(o.s.map(function(pt){return [X(pt.t),Y(pt.v)];}));
    g+='<path d="'+d+'" fill="none" stroke="'+tempCol(o.t)+'"'+GRAF_LINJE+'/>';}
  g+='</svg>';
  g=avlLager(cid,g,{W:W,H:H,X:X,t0:t0,t1:t1,
    ser:out.map(function(o){return {namn:o.t.lab,farg:tempCol(o.t),pts:o.s,Y:Y,
      fmt:function(v){return num(v,1)+' °';}};})});
  g+='<div class="viz-cap">senaste '+spannTxt(tr)+' · '+num(ylo+mp,1)+'–'+num(yhi-mp,1)+' °C</div>';
  return g;}
/* AC-läge i klartext */
function acModeSv(m,on){if(on===false)return 'Av';
  var t={off:'Av',heat:'Värme',cool:'Kyla',auto:'Auto',dry:'Avfuktning',fan:'Fläkt',fan_only:'Fläkt'}[m];
  return t||(m?String(m):(on===true?'På':'–'));}

/* Kroppsbyggare för de två tidsseriepopuparna. Egna funktioner så tidsvalet
   och helskärmen kan rita om exakt samma innehåll som openDetail först byggde.
   Rubriken visar valt fönster i klartext. */
function grafRubrik(id,text,info){
  var t=grafTim(id);
  return '<div class="dsec">'+text+' · '+(GRAF_TIM_TXT[t]||'')
    +((typeof t==='string'&&_langLaddar)?' · hämtar historik…':'')
    +(info||'')+'</div>';
}
/* Spannet under graferna: timmar upp till två dygn, därefter dygn. */
function spannTxt(ms){var h=Math.round(ms/3600000);
  if(h>=48)return '~'+Math.round(ms/86400000)+' dygn';
  return h>=1?('~'+h+' h'):'stunden';}
function byggGrid(){
  var pw=cap(DEV.pulse,'measure_power'),exp=pw!=null&&pw<0;
  return grafRubrik('grid','Elnät',infoBlock('gridgraf',
      'Blå kurva och yta är effekt du köper från nätet, grön är effekt du '
      +'säljer. Nollinjen skiljer köp från sälj. Dra i grafen för att läsa av '
      +'effekten vid en viss tidpunkt.'))
    +gridPowerSVG(histV('grid','grid'),'grid')
    +grafTidsval('grid')
    +'<div class="dsec">Belastning per fas'+infoBlock('fas',fasInfo())+'</div>'+fasHTML()+dSec('Elnät')
    +dRow('Just nu',pw==null?'–':(exp?'säljer ':'köper ')+W(Math.abs(pw)))+dRow('Spotpris',num(elprisNow(),2)+' kr/kWh')+dRow('Kostnad idag',num(cap(DEV.pulse,'accumulatedCost'),2)+' kr')+dRow('Köpt totalt',num(cap(DEV.pulse,'meter_power.imported'),0)+' kWh')+dRow('Sålt totalt',num(cap(DEV.pulse,'meter_power.exported'),0)+' kWh');
}
/* ===== SAMMA MÖNSTER FÖR VÄDER-, POOL- OCH BADGRAFERNA =====
   Elrutorna (elnät, batteri, förbrukning nu) satte mönstret: grafRubrik med
   i-knapp, grafen i 146 px, tidsval 1–24 h och helskärm under. De fyra nedan
   följer det. Pool och badtemp hade förut ingen egen graf i kroppen — de fick
   brickans generiska histSVG prependad av openDetail, med fast 48 h-fönster
   och utan rubrik. Nu bygger de sin graf själva, med cid som histSVG använder
   både för avl-lagret och tidsvalet. */
function byggTemps(){
  var tb=grafRubrik('temps','Temperaturer',infoBlock('tempsgraf',
      'En kurva per zon. Tryck på en zon nedanför för att visa eller dölja '
      +'dess linje. Dra i grafen för att läsa av alla synliga zoner vid en viss '
      +'tidpunkt.'))
    +multiTempSVG('temps')+grafTidsval('temps');
  tb+='<div class="tg-leg">';
  var waiting=0;
  for(var ti=0;ti<TEMPS.length;ti++){var T=TEMPS[ti],ov=T.val(),onx=tempOn(T.k),hd=tempHasData(T);
    if(!hd)waiting++;
    tb+='<button class="tg-chip'+(onx?' on':'')+(hd?'':' nodata')+'" onclick="tempToggle(\''+T.k+'\')"'+(hd?'':' title="Väntar på mätpunkter"')+'>'
      +'<span class="tg-top"><span class="tg-dot" style="background:'+tempCol(T)+'"></span>'
      +'<span class="tg-l">'+esc(T.lab)+'</span></span>'
      +'<b class="tg-v">'+(ov==null?'–':num(ov,1)+'<span class="tg-u">°</span>')+'</b>'
      +(hd?'':'<span class="tg-wait">väntar på data</span>')+'</button>';}
  tb+='</div>';
  /* Instruktionsraden och knapparna "Visa alla" / "Breveden · AC" borttagna i
     v655. Att chipsen går att trycka på syns på att de är knappar, och en genväg
     till en annan ruta hör inte hemma under en graf.
     Raden om zoner utan mätpunkter står kvar — den förklarar varför en linje
     saknas, och det går inte att läsa sig till på annat sätt. */
  if(waiting){
    tb+='<div class="tg-hint">'+waiting+' zon'+(waiting>1?'er':'')
      +' saknar ännu mätpunkter – linjen ritas när historiken hunnit fyllas på.</div>';
  }
  return tb;
}
function byggPool(){
  var pv=cap(DEV.pooltemp,'measure_temperature');
  return grafRubrik('pool','Pooltemperatur',infoBlock('poolgraf',
      'Poolens temperatur över tid. Dra i grafen för att läsa av vid en viss '
      +'tidpunkt.'))
    +histSVG(poolHistKey(),{unit:'°C',icon:'swimming-pool'},'pool')
    +grafTidsval('pool');
}
function byggSeatemp(){
  return grafRubrik('seatemp','Badtemperatur',infoBlock('seagraf',
      'Havets temperatur vid '+esc(CONFIG.BATH_NAME||'badplatsen')+'. Mäts '
      +'sällan, så kurvan har få punkter. Dra i grafen för att läsa av.'))
    +histSVG('k:seatemp',{unit:'°C',icon:'waves'},'seatemp')
    +grafTidsval('seatemp');
}
/* BILSTYRNINGENS LÄGE (v694) ur energi_bil, som energistyr skriver varje
   minut: sol / billig / manuell / vänta / ingen. */
function bilStyrLage(){
  try{var t=(_regel&&_regel.bil)?String(_regel.bil):'';if(!t)return null;var i=t.indexOf('|');
    return {lage:i>=0?t.slice(0,i):t,skal:i>=0?t.slice(i+1):''};}catch(e){return null;}
}
