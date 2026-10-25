/* js/data.js — Data och lagring: synk via logikvariabler, väderalgoritmerna, poängtavlan, kronor per period, återfyllnad ur Insights, backup och läsprotokollet.
 *
 * Filen innehåller BARA funktionsdeklarationer. Konstanter, tillstånd och allt
 * som körs direkt vid laddning ligger i js/start.js, som laddas sist, under
 * rubriken [data.js]. En funktion går att anropa oavsett vilken fil den står
 * i, men kod som körs vid laddning kan här anropa en funktion i en fil som inte
 * hunnit laddas. Lägg den därför aldrig här.
 */

function apiBase(){return (BASE||(candidates()[0])||CONFIG.HOMEY_URL||'').replace(/\/$/,'');}
async function logicList(){const tk=CONFIG.WRITE_TOKEN||CONFIG.TOKEN,t=withTimeout(20000);
  const r=await fetch(apiBase()+'/api/manager/logic/variable/',{headers:{Authorization:'Bearer '+tk},signal:t.signal});t.clear();
  if(!r.ok)throw new Error('HTTP '+r.status);return await r.json();}
function logicArr(list){return Array.isArray(list)?list:Object.values(list||{});}
function priceVarLoad(list){
  try{var arr=logicArr(list),by={};
    for(var i=0;i<arr.length;i++){var v=arr[i];if(v&&v.name!=null)by[(''+v.name).trim().toLowerCase()]=v.value;}
    function pick(names){for(var j=0;j<names.length;j++){if(by[names[j]]!=null){var n=parseFloat(by[names[j]]);if(isFinite(n))return n;}}return null;}
    var nw=pick(PRICEVAR_NAMES.now), lo=pick(PRICEVAR_NAMES.lo), hi=pick(PRICEVAR_NAMES.hi);
    PRICEVARS={now:nw,lo:lo,hi:hi,ok:(nw!=null)};
  }catch(e){}
  return PRICEVARS;}
async function priceVarFetch(){try{const list=await logicList();priceVarLoad(list);}catch(e){}}
function syncNote(t){try{
  var el=document.getElementById('sync-note');
  if(!el){el=document.createElement('div');el.id='sync-note';el.className='sync-note';document.body.appendChild(el);}
  el.textContent=t;el.classList.add('on');
  if(_syncNoteT)clearTimeout(_syncNoteT);
  _syncNoteT=setTimeout(function(){try{el.classList.remove('on');}catch(e){}},4500);
}catch(e){}}
/* Elpris (kr/kWh): Homey-variabeln Elpris om den finns, annars Tibber-enheten. */
function elprisNow(){return (PRICEVARS.ok&&PRICEVARS.now!=null)?PRICEVARS.now:cap(DEV.tibber,'measure_price_total');}
function elprisLo(){return (PRICEVARS.lo!=null)?PRICEVARS.lo:cap(DEV.tibber,'measure_price_lowest');}
function elprisHi(){return (PRICEVARS.hi!=null)?PRICEVARS.hi:cap(DEV.tibber,'measure_price_highest');}
/* LÄGSTA OCH HÖGSTA FÖR ETT VALT DYGN.
   För idag är Logic-variablerna elprislägst/elprishögst auktoritativa — de
   kommer från Tibber själv och ska inte ersättas av en lokal uträkning.
   För imorgon finns inga sådana variabler, så värdena räknas ur prisserien
   som grafen redan ritar. Saknas serien ges null, och raden visar ett streck
   i stället för ett påhittat värde. */
/* TRE RUTOR UNDER PRISGRAFEN (v675): Lägst och Högst med klockslag, och
   Hittills. Ersätter raderna Kostnad hittills / Spotpris nu / Lägsta /
   Högsta / Nivå — spotpriset står redan stort överst, och lägsta/högsta
   saknade det man vill veta: när. Värdena är desamma som förut (prisMinMax);
   klockslaget tas ur samma kalibrerade kurva som grafen ritar.
   Imorgon finns inget "hittills" — där visas dygnets snittpris i stället. */
function prisMinMaxKl(off){
  var mm=prisMinMax(off),ut={lo:mm.lo,hi:mm.hi,loH:null,hiH:null,snitt:null};
  var rad=null;try{rad=prisKalibrera(prisDygn(off),off);}catch(e){}
  if(rad&&rad.length){
    var blo=Infinity,bhi=-Infinity,sum=0,n=0;
    for(var i=0;i<rad.length;i++){var h=rad[i][0],v=rad[i][1];
      if(h>=24||v==null||!isFinite(v))continue;
      sum+=v;n++;
      if(v<blo){blo=v;ut.loH=h;}
      if(v>bhi){bhi=v;ut.hiH=h;}}
    if(n)ut.snitt=sum/n;
    if(ut.lo==null&&isFinite(blo))ut.lo=blo;
    if(ut.hi==null&&isFinite(bhi))ut.hi=bhi;
  }
  return ut;
}
function prisRutor(off){
  var m=prisMinMaxKl(off);
  var ore=function(v){return (v==null||!isFinite(v))?'–':(Math.round(v*100)+' öre');};
  var kl=function(h){return (h==null)?'':('kl '+battKl(Math.round(h*60)));};
  var ruta=function(k,v,s,farg){return '<div class="pchip"><div class="pchip-k">'+k+'</div>'
    +'<div class="pchip-v"'+(farg?' style="color:'+farg+'"':'')+'>'+v+'</div><div class="pchip-s">'+s+'</div></div>';};
  var tredje=off
    ?ruta('Snitt',ore(m.snitt),'imorgon')
    :ruta('Hittills',num(cap(DEV.pulse,'accumulatedCost'),2)+' kr',
        esc(priceLevelSv(cap(DEV.tibber,'measure_price_info_level')||cap(DEV.tibber,'price_level'))||''));
  return '<div class="pchips">'
    +ruta('Lägst',ore(m.lo),kl(m.loH),'var(--ok)')
    +ruta('Högst',ore(m.hi),kl(m.hiH),'var(--hot)')
    +tredje+'</div>';
}
function prisMinMax(offset){
  if(!offset)return {lo:elprisLo(),hi:elprisHi()};
  /* HÄR LÅG BUGGEN: prisDygn ger Tibbers RÅA tal. Grafen ritar dem inte som de
     är — prisKalibrera() skalar om dem mot elprislägst/elprishögst, så kurvan
     och raderna ska visa samma skala. Utan omräkningen läste raden råvärden
     och visade 38 öre där grafen toppade på 1,10 kr.
     Samma funktion och samma offset som grafen använder, så de kan inte glida
     isär igen. */
  var rad=prisKalibrera(prisDygn(offset),offset);
  if(!rad||!rad.length)return {lo:null,hi:null};
  var lo=Infinity,hi=-Infinity;
  for(var i=0;i<rad.length;i++){
    var v=rad[i][1];
    if(v==null||!isFinite(v))continue;
    if(v<lo)lo=v;
    if(v>hi)hi=v;
  }
  return isFinite(lo)?{lo:lo,hi:hi}:{lo:null,hi:null};
}

function isAbort(e){return !!(e&&(e.name==='AbortError'||/abort/i.test(e.message||'')));}
/* En hel sparning är upp till 40 skrivningar i rad. På en telefon över wifi hinner
   inte alltid varje skrivning bli klar inom en snål tidsgräns, och då avbryts hela
   sparningen med "signal is aborted without reason". Därför gott om tid och några
   omförsök vid just timeout – riktiga fel (t.ex. 401) kastas direkt. */
async function logicWrite(list,name,value,typ){const tk=CONFIG.WRITE_TOKEN||CONFIG.TOKEN,base=apiBase()+'/api/manager/logic/variable/';
  let found=null;for(const v of logicArr(list)){if(v&&v.name===name){found=v;break;}}
  /* v705: värdet följer variabelns typ. Ett tal till en strängvariabel skickas
     som text och tvärtom — om Homey godtar en blandning är inte provat, så
     ingen blandning skickas. En ny variabel får typen typ (förval string). */
  if(found&&found.type==='string'&&typeof value==='number')value=String(value);
  else if(found&&found.type==='number'&&typeof value==='string'&&value.trim()!==''&&isFinite(Number(value)))value=Number(value);
  const hdr={Authorization:'Bearer '+tk,'Content-Type':'application/json'};
  async function attempt(ms){const t=withTimeout(ms);
    try{
      const r=found
        ? await fetch(base+found.id,{method:'PUT',headers:hdr,body:JSON.stringify({value:value}),signal:t.signal})
        : await fetch(base,{method:'POST',headers:hdr,body:JSON.stringify({name:name,type:typ||'string',value:value}),signal:t.signal});
      t.clear();
      if(!r.ok)throw new Error((found?'PUT ':'POST ')+r.status);
      return true;
    }catch(e){t.clear();throw e;}}
  const waits=[20000,30000,40000];
  for(let i=0;i<waits.length;i++){
    try{return await attempt(waits[i]);}
    catch(e){
      if(!isAbort(e))throw e;
      if(i===waits.length-1)throw new Error('tidsgränsen gick ut (långsam anslutning till Homey)');
      await new Promise(r=>setTimeout(r,500));}}
  return true;}
function shcGet(){try{return JSON.parse(localStorage.getItem(SHC_KEY))||{};}catch(e){return {};}}
function shCostTick(){
  const now=Date.now();
  if(!_shcLast){_shcLast=now;return;}
  const dt=(now-_shcLast)/3600000; _shcLast=now;
  if(!(dt>0)||dt>0.5)return;                 /* uppvaknad efter vila - hoppa over */
  const lw=shadeLossW(); if(!(lw>0))return;
  const c=cloudNow(), klar=(c==null)?0.5:(1-c);
  const wh=lw*dt*klar; if(!(wh>0))return;
  const pr=elprisNow();
  const o=shcGet(),k=dayKey(); const e=o[k]||[0,0];
  e[0]=Math.round(e[0]+wh);
  if(pr!=null&&isFinite(pr))e[1]=Math.round(e[1]+wh/1000*pr*100);
  o[k]=e;
  const ks=Object.keys(o).sort(); while(ks.length>SHC_KEEP)delete o[ks.shift()];
  try{localStorage.setItem(SHC_KEY,JSON.stringify(o));}catch(e2){}}

/* ===== MOLNMANGD -> STRALNING (Kasten-Czeplak 1980) =====
   RATTAT I v176/v177: predSolarW hade theo*0.82*(1-0.7*cl). Nollan-atta-tva var inte
   fysik utan kompensation - med v175:s uppblasta klarhimmel gav en klar dag p/theo~0.78,
   sa 0.82 dolde kalibreringsfelet. Nar SOL_DA rattades blev klarhimlen sann och 0.82
   borjade underskatta klara dagar med 18%. Mitt fel, infort i v176.
   Ersatt med Kasten-Czeplak: kc = 1 - 0.75*(n/8)^3.4. Publicerad, och den ger 1.0 vid
   klart - vilket ar precis vad en kalibrerad modell ska ge. Zambretti-poangsattningen
   nedan matar dessutom kurvan mot ditt eget tak, sa den kan granskas i efterhand. */
function kastenCzeplak(cf){
  if(cf==null||!isFinite(cf))return 1;
  var c=Math.max(0,Math.min(1,cf));
  return Math.max(0.05,1-0.75*Math.pow(c,3.4));}
function snowGet(){try{return JSON.parse(localStorage.getItem(SNW_KEY))||{};}catch(e){return {};}}
function snowExpW(){
  var th=solTheoW(); if(!(th>0))return null;
  var cf=cloudFactorAt(nowHour());
  if(cf==null||cf>SNW_CFMAX)return null;      /* utan oberoende molnsignal: avsta */
  return th*kastenCzeplak(cf);}
/* 1 = sno, 0 = bar panel, null = gar inte att avgora just nu */
function snowNow(){
  var t=cap(DEV.outdoor,'measure_temperature');
  if(t==null||!isFinite(t))return null;
  var ex=snowExpW(); if(ex==null||ex<SNW_MINW)return null;
  var p=cap(DEV.solar,'measure_power'); if(p==null||!isFinite(p))return null;
  var r=p/ex;
  if(t>SNW_TMAX)return (r<SNW_RATIO)?null:0;  /* varmt OCH morkt = nagot annat, inte sno */
  return (r<SNW_RATIO)?1:0;}
function snowTick(){
  var now=Date.now();
  if(!_snwLast){_snwLast=now;return;}
  var dt=(now-_snwLast)/3600000; _snwLast=now;
  if(!(dt>0)||dt>0.5)return;
  var st=snowNow(); if(st==null)return;
  var ex=snowExpW(), p=cap(DEV.solar,'measure_power');
  var o=snowGet(), k=dayKey(), e=o[k]||[0,0,0];   /* [snotimmar*100, forlorade Wh, slapp-minut] */
  if(st===1){
    e[0]=Math.round(e[0]+dt*100);
    e[1]=Math.round(e[1]+Math.max(0,ex-p)*dt);
  }else if(e[0]>0&&!e[2]&&p/ex>SNW_FRI){
    var d=new Date(); e[2]=d.getHours()*60+d.getMinutes();
  }
  o[k]=e;
  var ks=Object.keys(o).sort(); while(ks.length>SNW_KEEP)delete o[ks.shift()];
  try{localStorage.setItem(SNW_KEY,JSON.stringify(o));}catch(e2){}}
/* Sasongen raknas juli-juli sa en vinter aldrig delas pa tva ar. */
/* Syntetisk vinter - bara for demolaget. Sju snodygn, ~104 kWh, tva med slapptid. */
function snowDemo(){
  var n=new Date(), m=n.getMonth(), y=n.getFullYear()-(m<6?1:0);
  if(m>=6&&m<=9)y-=1;                 /* sommar: forra vintern ar den som har sno */
  var o={}, dag=[[11,18,430,14200,0],[11,19,610,20100,782],[0,7,520,17900,0],
                 [0,8,300,9800,731],[0,22,690,23400,0],[0,23,180,5600,694],[1,3,410,13100,0]];
  dag.forEach(function(d){var yy=y+(d[0]>=6?0:1);
    o[yy+'-'+('0'+(d[0]+1)).slice(-2)+'-'+('0'+d[1]).slice(-2)]=[d[2],d[3],d[4]];});
  return o;}
function snowEff(){return isDemo()?snowDemo():snowGet();}
function snowSasonAr(y){
  var o=snowEff(), fr=y+'-07-01', ti=(y+1)+'-07-01', dyg=0, wh=0, tim=0, sen=null;
  Object.keys(o).forEach(function(k){ if(k<fr||k>=ti)return;
    if(o[k][0]>0){dyg++; tim+=o[k][0]/100; wh+=o[k][1]; if(!sen||k>sen)sen=k;}});
  return {dygn:dyg, timmar:tim, kwh:wh/1000, sen:sen, ar:y};}
function snowSason(){
  var n=new Date(), y=n.getFullYear()-(n.getMonth()<6?1:0);
  var s=snowSasonAr(y);
  /* I juli ar den nya vintern tom - da ar forra vintern det intressanta. */
  if(!s.dygn){var f=snowSasonAr(y-1); if(f.dygn)return f;}
  return s;}
function zamGet(){try{return JSON.parse(localStorage.getItem(ZAM_KEY))||{off:0,d:{}};}catch(e){return {off:0,d:{}};}}
/* Syntetisk poangtavla - bara for demolaget. 30 dygn, deterministisk, SMHI vinner
   men inte overlagset. Siffrorna ar SIMULERADE utfall, inte uppmatta: dygnen genereras
   ur ett verkligt regnutfall och bada prognoserna dras runt det med olika spridning.
   Brier och medelfel raknas sedan pa vanligt satt av zamPoang() - inget ar handsatt. */
function zamDemo(){
  var o={off:-1.4,d:{}}, r=987654321;
  var rnd=function(){r=(r*1103515245+12345)&0x7fffffff;return r/0x7fffffff;};
  var cl=function(v,a,b){return Math.max(a,Math.min(b,v));};
  for(var i=30;i>=1;i--){
    var reg=rnd()<0.4?1:0;
    var kc=reg?(0.15+rnd()*0.30):(0.50+rnd()*0.48);
    var th=9000+rnd()*7000;
    o.d[dayKeyAgo(i)]={
      z:(reg?18:4),
      zp:cl(reg?0.35+rnd()*0.45:0.15+rnd()*0.50,0.05,0.95),
      zk:cl(kc+(rnd()-0.5)*0.95,0.10,1.05),
      sp:cl(reg?0.50+rnd()*0.40:0.06+rnd()*0.38,0.03,0.96),
      sk:cl(kc+(rnd()-0.5)*0.56,0.05,1.10),
      a:Math.round(th*kc), th:Math.round(th),
      r0:2, rx:reg?(2.6+rnd()):2, h:9};
  }
  return o;}
function zamEff(){return isDemo()?zamDemo():zamGet();}
function zamSave(o){try{localStorage.setItem(ZAM_KEY,JSON.stringify(o));}catch(e){}}
function zamRaw(){var p=cap(DEV.vader,'measure_pressure');
  if(p==null||!isFinite(p))p=cap(DEV.smhi,'measure_air_pressure_cp');
  return (p!=null&&isFinite(p)&&p>800&&p<1100)?p:null;}
/* Langsam nollstallning mot SMHI:s msl - barometern stalls in, inte prognosen. */
function zamCal(){var o=zamGet(),p=zamRaw(),f=forecastAt(Date.now());
  if(p==null||!f||f.msl==null||!isFinite(f.msl))return;
  var d=f.msl-p; if(!isFinite(d)||Math.abs(d)>40)return;
  o.off=Math.max(-12,Math.min(12,(o.off||0)*0.98+d*0.02)); zamSave(o);}
function zamPress(){var p=zamRaw(); if(p==null)return null; return p+(zamEff().off||0);}
function zamHist(){
  var out=[];
  try{var h=(typeof HIST!=='undefined'&&HIST.press)||[];
    h.forEach(function(x){if(x&&x.t&&x.v!=null&&isFinite(x.v))out.push({t:x.t,v:+x.v});});}catch(e){}
  [ZP_KEY,'pressLog_v1'].forEach(function(k){
    try{JSON.parse(localStorage.getItem(k)||'[]').forEach(function(x){
      if(x&&x.t&&x.v!=null&&isFinite(x.v))out.push({t:x.t,v:+x.v});});}catch(e){}});
  return out;}
async function zamPressSeed(){
  try{
    if(!BASE||CONFIG.DATA_URL)return;
    if(Date.now()-_zpAt<6*36e5)return; _zpAt=Date.now();
    var logs=await homeyGet('/api/manager/insights/log/'); if(!logs)return;
    var lg=monFindLog(logs,DEV.vader,['measure_pressure']); if(!lg)return;
    var e=await homeyGet('/api/manager/insights/log/'+lg.uri+'/'+lg.id+'/entry?resolution=last24Hours');
    var pts=parseEntries(e); if(!pts.length)return;
    localStorage.setItem(ZP_KEY,JSON.stringify(pts.slice(-120)));
    render();
  }catch(e){}}
/* 3-timmarstrend i hPa. */
function zamTrend(){
  var cur=zamRaw(); if(cur==null)return null;
  var log=zamHist();
  var now=Date.now(),old=null,bd=1e18;
  for(var i=0;i<log.length;i++){var age=now-log[i].t;
    if(age<2*36e5||age>5*36e5)continue;
    if(Math.abs(age-3*36e5)<bd){bd=Math.abs(age-3*36e5);old=log[i];}}
  if(!old)return isDemo()?1.8:null;   /* demo: stigande barometer */
  return cur-old.v;}
function zamWindIdx(){var wd=cap(DEV.windNet,'measure_wind_angle');
  if(wd==null)wd=cap(DEV.smhi,'measure_wind_direction_cp');
  if(wd==null||!isFinite(wd))return null;
  return Math.round(((wd%360)+360)%360/22.5)%16;}
/* Returnerar {i,bok,txt,pr,kc,tr,hpa} eller null om barometern inte racker till. */
/* Sjalva tabellslagningen, utan beroende av "nu". Samma funktion anvands bade for
   dagens dom och nar gamla dygn raknas om ur tryckhistoriken. */
function zamCore(P,tr,wi,when){
  if(P==null||tr==null||!isFinite(P)||!isFinite(tr))return null;
  var lo=950, hi=1050, range=hi-lo, z=P;
  if(wi!=null)z+=ZAM_WIND[wi]/100*range;
  var m=(when||new Date()).getMonth()+1, sommar=(m>=4&&m<=9);
  var stig=tr>0.6, fall=tr<-0.6;
  if(sommar){ if(stig)z+=7/100*range; else if(fall)z-=7/100*range; }
  if(z>=hi)z=hi-1; if(z<lo)z=lo;
  var opt=Math.max(0,Math.min(21,Math.floor((z-lo)/(range/22))));
  var i=stig?ZAM_RISE[opt]:(fall?ZAM_FALL[opt]:ZAM_STDY[opt]);
  return {i:i, bok:String.fromCharCode(65+i), txt:ZAM_TXT[i], pr:ZAM_PK[i][0], kc:ZAM_PK[i][1],
          tr:tr, hpa:P};}
function zambretti(){return zamCore(zamPress(), zamTrend(), zamWindIdx(), new Date());}
/* SMHI:s konkurrerande dom for samma fonster: resten av dygnet. */
function zamSmhi(){
  if(!FORECAST||!FORECAST.length)return null;
  var now=Date.now(), slut=dayStart()+22*3600000;
  if(slut<=now)slut=now+6*3600000;
  var mm=0, tcc=0, n=0;
  for(var i=0;i<FORECAST.length;i++){var f=FORECAST[i];
    if(f.t<now||f.t>slut)continue;
    if(f.p!=null&&isFinite(f.p))mm+=f.p;
    if(f.tcc!=null&&isFinite(f.tcc)){tcc+=f.tcc/8;n++;}}
  if(!n)return null;
  return {pr:Math.max(0.02,Math.min(0.97,1-Math.exp(-2.2*mm))), kc:kastenCzeplak(tcc/n)};}
async function appZamHamta(){
  try{
    var j=await appGet('/zambretti');
    if(!j||!j.dagar||!Object.keys(j.dagar).length)return 0;
    var o=zamGet(), n=0;
    for(var k in j.dagar){
      var a=j.dagar[k]; if(!a)continue;
      var l=o.d[k], ny={};
      for(var f in a)ny[f]=a[f];
      if(l){                                   /* SMHI kan appen aldrig veta */
        if(l.sp!=null)ny.sp=l.sp;
        if(l.sk!=null)ny.sk=l.sk;
      }
      if(!l||JSON.stringify(l)!==JSON.stringify(ny)){o.d[k]=ny;n++;}
    }
    var ks=Object.keys(o.d).sort();
    while(ks.length>ZAM_KEEP)delete o.d[ks.shift()];
    if(n){zamSave(o);_zamPushed='';}
    _zamKalla='app';_zamAppN=Object.keys(j.dagar).length;
    return n;
  }catch(e){_appFel=(e&&e.message)||String(e);_zamKalla='lokal';return 0;}}
function zamTick(){
  if(!_zamPulled){_zamPulled=true;
    /* Appen först, Logic-variabeln som reserv. */
    if(appKan()){appZamHamta().then(function(n){
      if(!n)try{zamPull();}catch(e){}
      else try{render();}catch(e){}
    }).catch(function(){try{zamPull();}catch(e){}});}
    else try{zamPull();}catch(e){}
  }
  zamCal();
  var o=zamGet(), k=dayKey(), h=new Date().getHours();
  var e=o.d[k];
  if(!e){
    if(h<7||h>12)return;                       /* domen falls pa formiddagen, som med ett riktigt instrument */
    var Z=zambretti(), S=zamSmhi();
    if(!Z||!S)return;
    var r=cap(DEV.rain,'measure_rain.24h');
    e={z:Z.i, zp:Z.pr, zk:Z.kc, sp:S.pr, sk:S.kc, a:0, th:0,
       r0:(r!=null&&isFinite(r))?r:null, rx:(r!=null&&isFinite(r))?r:null, h:h};
    o.d[k]=e;
  }
  var now=Date.now();
  if(!e._t)e._t=now;
  var dt=(now-e._t)/3600000; e._t=now;
  if(dt>0&&dt<=0.5){
    var p=cap(DEV.solar,'measure_power'), th=solTheoW();
    if(p!=null&&isFinite(p)&&th>0){e.a=Math.round(e.a+p*dt); e.th=Math.round(e.th+th*dt);}
  }
  var rn=cap(DEV.rain,'measure_rain.24h');
  if(rn!=null&&isFinite(rn)&&(e.rx==null||rn>e.rx))e.rx=rn;
  var ks=Object.keys(o.d).sort(); while(ks.length>ZAM_KEEP)delete o.d[ks.shift()];
  zamSave(o);
  try{zamPush();}catch(e){}}
function zamSyncInfo(){try{return JSON.parse(localStorage.getItem(ZAM_SYNC_KEY))||{};}catch(e){return {};}}
function zamCanSync(){return !!(CONFIG.TOKEN&&CONFIG.TOKEN.indexOf('DIN_API')<0&&CFG.sync!==false&&BASE&&!CONFIG.DATA_URL);}
async function zamPush(force){
  try{
    if(!zamCanSync()||isDemo())return false;
    var o=zamGet(); if(!o.d||!Object.keys(o.d).length)return false;
    var str=JSON.stringify(o);
    if(!force&&str===_zamPushed)return false;
    if(!force&&Date.now()-_zamPushAt<15*60000)return false;
    _zamPushAt=Date.now();
    await logicWrite(await logicList(),ZAM_VAR,str);
    _zamPushed=str;
    try{localStorage.setItem(ZAM_SYNC_KEY,JSON.stringify({t:Date.now(),n:Object.keys(o.d).length,len:str.length}));}catch(e){}
    return true;
  }catch(e){return false;}}
async function zamPull(){
  try{
    if(!zamCanSync()||isDemo())return 0;
    var v=null;
    logicArr(await logicList()).forEach(function(x){if(x&&x.name===ZAM_VAR)v=x.value;});
    if(!v)return 0;
    var rem=JSON.parse(v); if(!rem||!rem.d)return 0;
    var o=zamGet(),add=0;
    Object.keys(rem.d).forEach(function(k){if(!o.d[k]){o.d[k]=rem.d[k];add++;}});
    if(!o.off&&rem.off)o.off=rem.off;
    if(add){var ks=Object.keys(o.d).sort();while(ks.length>ZAM_KEEP)delete o.d[ks.shift()];
      zamSave(o);_zamPushed='';try{render();}catch(e){}}
    return add;
  }catch(e){return 0;}}
function zamBfInfo(){try{return JSON.parse(localStorage.getItem(ZAM_BF_KEY))||{};}catch(e){return {};}}
async function zamBackfill(){
  if(_zamBfBusy)return {ok:false,txt:'Hämtar redan…'};
  if(isDemo())return {ok:false,txt:'Demoläget har en egen, simulerad tavla.'};
  if(!BASE||CONFIG.DATA_URL)return {ok:false,txt:'Kräver direktkoppling till Homey.'};
  _zamBfBusy=true;
  try{
    var logs=await homeyGet('/api/manager/insights/log/');
    if(!logs)throw new Error('Insights svarade inte');
    var serie=async function(dev,keys){
      var lg=monFindLog(logs,dev,keys); if(!lg)return [];
      var e=await homeyGet('/api/manager/insights/log/'+lg.uri+'/'+lg.id+'/entry?resolution=last31Days');
      return parseEntries(e).sort(function(a,b){return a.t-b.t;});};
    var press=await serie(DEV.vader,['measure_pressure']);
    if(!press.length)press=await serie(DEV.smhi,['measure_air_pressure_cp']);
    /* Dashboardens egen trycklogg fyller igen luckor i Insights */
    try{zamHist().forEach(function(x){press.push(x);});}catch(e){}
    press.sort(function(a,b){return a.t-b.t;});
    if(press.length<24)throw new Error('för lite tryckhistorik ('+press.length+' värden)');
    var wind=await serie(DEV.windNet,['measure_wind_angle']);
    var rain=await serie(DEV.rain,['measure_rain.24h']);
    var sol =await serie(DEV.solar,['measure_power']);

    var at=function(arr,ts,tol){var b=null,bd=1e18;
      for(var i=0;i<arr.length;i++){var d=Math.abs(arr[i].t-ts);
        if(d<=tol&&d<bd){bd=d;b=arr[i];}}
      return b?b.v:null;};
    var o=zamGet(),lagt=0,hoppat=0,idag=dayKey();
    for(var k=1;k<=ZAM_BF_DAYS;k++){
      var d0=new Date(); d0.setHours(0,0,0,0); d0.setDate(d0.getDate()-k);
      var key=dayKey(d0); if(key===idag||o.d[key]){hoppat++;continue;}
      var t0=d0.getTime(), t9=t0+9*36e5, t6=t0+6*36e5, t24=t0+24*36e5;
      var P9=at(press,t9,90*60000), P6=at(press,t6,90*60000);
      if(P9==null||P6==null){hoppat++;continue;}
      var wd=at(wind,t9,3*36e5);
      var wi=(wd==null||!isFinite(wd))?null:Math.round(((wd%360)+360)%360/22.5)%16;
      var Z=zamCore(P9,P9-P6,wi,d0); if(!Z){hoppat++;continue;}
      /* Regnutfall: matarstallningen kl 09 och hogsta varde resten av dygnet */
      var r0=at(rain,t9,2*36e5), rx=r0;
      if(r0!=null)for(var i2=0;i2<rain.length;i2++)
        if(rain[i2].t>=t9&&rain[i2].t<=t24&&rain[i2].v>rx)rx=rain[i2].v;
      /* Solighet: producerad energi mot klarvädersteori, integrerat over dygnet */
      var a=0,th=0,prev=null;
      for(var i3=0;i3<sol.length;i3++){var s3=sol[i3];
        if(s3.t<t0||s3.t>t24){prev=null;continue;}
        if(prev){var dt=(s3.t-prev.t)/36e5;
          if(dt>0&&dt<=2){
            a+=(prev.v+s3.v)/2*dt;
            var th1=solClearW(new Date(prev.t),null), th2=solClearW(new Date(s3.t),null);
            th+=((th1||0)+(th2||0))/2*dt;}}
        prev=s3;}
      o.d[key]={z:Z.i, zp:Z.pr, zk:Z.kc, sp:null, sk:null,
                a:Math.round(a), th:Math.round(th),
                r0:(r0!=null?r0:null), rx:(rx!=null?rx:null), h:9, bf:1};
      lagt++;}
    var ks=Object.keys(o.d).sort(); while(ks.length>ZAM_KEEP)delete o.d[ks.shift()];
    zamSave(o);
    try{localStorage.setItem(ZAM_BF_KEY,JSON.stringify({t:Date.now(),lagt:lagt,hoppat:hoppat}));}catch(e){}
    _zamPushed=''; zamPush(true);
    try{render();}catch(e){}
    return {ok:true,txt:lagt?('Lade till '+lagt+' dygn ur historiken.')
                          :'Hittade inga nya dygn med tillräcklig tryckhistorik.'};
  }catch(e){
    return {ok:false,txt:'Kunde inte hämta historiken: '+(e&&e.message||e)};
  }finally{_zamBfBusy=false;}}
function zamBackfillClick(btn){
  if(btn){btn.disabled=true;btn.textContent='Hämtar…';}
  zamBackfill().then(function(r){
    try{var e=document.getElementById('zam-bf-msg');
      if(e){e.textContent=r.txt;e.style.color=r.ok?'var(--ok)':'var(--warn)';}
      if(btn){btn.disabled=false;btn.textContent='Hämta historik';}
    }catch(x){}});}
/* Brier for regnet (lagre battre), medelfel for soligheten. */
function zamPoang(){
  var o=zamEff(), ks=Object.keys(o.d).sort(), idag=dayKey();
  var zb=0,nb=0, sb=0,nsb=0, zk=0,nk=0, sk=0,nsk=0, bf=0;
  /* Direkt jamforelse: bara dygn dar BADA lamnat en prognos */
  var hzb=0,hsb=0,hnb=0, hzk=0,hsk=0,hnk=0;
  ks.forEach(function(k){ if(k===idag)return; var e=o.d[k]; if(!e)return;
    if(e.bf)bf++;
    if(e.r0!=null&&e.rx!=null&&e.zp!=null){
      var reg=((e.rx-e.r0)>0.2)?1:0;
      zb+=Math.pow(e.zp-reg,2); nb++;
      if(e.sp!=null){sb+=Math.pow(e.sp-reg,2); nsb++;
        hzb+=Math.pow(e.zp-reg,2); hsb+=Math.pow(e.sp-reg,2); hnb++;}}
    if(e.th>3000&&e.zk!=null){
      var kc=Math.min(1.25,e.a/e.th);
      zk+=Math.abs(e.zk-kc); nk++;
      if(e.sk!=null){sk+=Math.abs(e.sk-kc); nsk++;
        hzk+=Math.abs(e.zk-kc); hsk+=Math.abs(e.sk-kc); hnk++;}}});
  return {n:Math.max(nb,nk), nb:nb, nk:nk, nsb:nsb, nsk:nsk, bf:bf,
          zb:nb?zb/nb:null, sb:nsb?sb/nsb:null, zk:nk?zk/nk:null, sk:nsk?sk/nsk:null,
          hnb:hnb, hnk:hnk,
          hzb:hnb?hzb/hnb:null, hsb:hnb?hsb/hnb:null,
          hzk:hnk?hzk/hnk:null, hsk:hnk?hsk/hnk:null};}
function monGet(){try{var o=JSON.parse(localStorage.getItem(MON_KEY));if(o&&o.d&&o.m)return o;}catch(e){}
  return {d:{},m:{},r:{},mi:null,mo:null,st:null,rw:0};}
function monSave(o){try{localStorage.setItem(MON_KEY,JSON.stringify(o));}catch(e){}}
/* RATTAT v183: hamtar BARA accumulatedReward. v182 tog aven accumulatedProduction,
   som ar producerade kWh - inte kronor. Tva fel foll ut av det:
   1) fanns capabilityn blev "kronor sald el" = kWh, alltso rena nonsens-tal.
   2) var den 0 (vanligt: Tibber rapporterar ingen ersattning for din anlaggning)
      var vardet anda != null, sa uppskattningsgrenen hoppades over och salt blev
      0 kr for alltid. Det var det du sag.
   Nu: uppskattningen rullar ALLTID i e.se. Ersattningen loggas separat i e.sr och
   anvands bara om den nagon gang varit over noll (o.rw). En nolla tystar ingenting. */
function monRew(){
  var d=DATA[DEV.pulse]; if(!d||!d.capabilitiesObj)return null;
  var c=d.capabilitiesObj['accumulatedReward'];
  return (c&&c.value!=null&&isFinite(c.value))?Number(c.value):null;}
function monTick(){
  if(_timeActive)return;                       /* tidsresa far inte skriva i loggen */
  var o=monGet(), k=dayKey(), mk=k.slice(0,7);
  var e=o.d[k]||(o.d[k]={k:0,s:0,ki:0,so:0,se:0,sr:0});
  if(e.se==null)e.se=e.s||0; if(e.sr==null)e.sr=0;
  if(!o.st)o.st=k;
  /* kWh ur de kumulativa matarna - tal luckor */
  var imp=cap(DEV.pulse,'meter_power.imported'), exp=cap(DEV.pulse,'meter_power.exported');
  if(imp!=null&&isFinite(imp)){
    if(o.mi!=null&&imp>o.mi&&(imp-o.mi)<MON_MAXSTEG)e.ki=Math.round((e.ki+(imp-o.mi))*100)/100;
    o.mi=imp;}
  var rew=monRew();
  if(exp!=null&&isFinite(exp)){
    if(o.mo!=null&&exp>o.mo&&(exp-o.mo)<MON_MAXSTEG){
      var d2=exp-o.mo; e.so=Math.round((e.so+d2)*100)/100;
      e.se=Math.round((e.se+d2*prisSatser().salt)*100)/100;   /* uppskattningen rullar alltid */
    }
    o.mo=exp;}
  /* kr kopt: Tibbers egen ackumulator, dygnets max (den nollstalls vid midnatt) */
  var c=cap(DEV.pulse,'accumulatedCost');
  if(c!=null&&isFinite(c)&&c>e.k)e.k=Math.round(c*100)/100;
  if(rew!=null){ if(rew>e.sr)e.sr=Math.round(rew*100)/100; if(rew>0)o.rw=1; }
  e.s=(o.rw&&e.sr>0)?e.sr:e.se;   /* riktig ersattning om den finns, annars uppskattning */
  /* rulla avslutade dygn till sin manad - varje dygn exakt en gang */
  Object.keys(o.d).forEach(function(dk){
    if(dk===k||o.r[dk])return;
    var m2=dk.slice(0,7), t=o.m[m2]||(o.m[m2]={k:0,s:0,ki:0,so:0}), x=o.d[dk];
    t.k=Math.round((t.k+x.k)*100)/100; t.s=Math.round((t.s+x.s)*100)/100;
    t.ki=Math.round((t.ki+x.ki)*100)/100; t.so=Math.round((t.so+x.so)*100)/100;
    o.r[dk]=1;});
  var ks=Object.keys(o.d).sort(); while(ks.length>MON_DKEEP){var g=ks.shift();delete o.d[g];delete o.r[g];}
  monSave(o);}
function monWeekStart(){var n=new Date(),w=(n.getDay()+6)%7;  /* mandag = 0 */
  return dayKey(new Date(n.getFullYear(),n.getMonth(),n.getDate()-w));}
/* period: 'day' | 'week' | 'month' | 'year'. Returnerar kr/kWh + hur langt loggen racker. */
function monPer(per){
  var o=monGet(), k=dayKey(), mk=k.slice(0,7), yr=k.slice(0,4);
  var bf=o.bf||{}, tib=monHarTib();
  /* Med Tibbers facit byggs allt utom idag ur dygns- och manadsnoderna. Utan det
     galler gamla vagen: rullade manader + live-dygn + aterfyllt ur Insights. */
  var start=o.st; if(o.bfst&&(!start||o.bfst<start))start=o.bfst;
  if(tib){var ks=Object.keys(o.tib.m||{}).sort(), ds=Object.keys(o.tib.d||{}).sort();
    var ts=ks.length?ks[0]+'-01':(ds.length?ds[0]:null);
    if(ts&&(!start||ts<start))start=ts;}
  var r={k:0,s:0,ki:0,so:0,full:true,st:start,rw:!!o.rw,bfn:Object.keys(bf).length,tib:tib};
  var add=function(x){if(!x)return;r.k+=x.k||0;r.s+=x.s||0;r.ki+=x.ki||0;r.so+=x.so||0;};
  var dagar=function(f,t){var seen={};
    [o.d,bf,(o.tib&&o.tib.d)||{}].forEach(function(src){
      Object.keys(src||{}).forEach(function(dk){
        if(dk<f||dk>t||seen[dk])return; seen[dk]=1; add(monSrcDag(o,dk));});});};
  /* MANAD och AR: enbart Tibbers egna tal, inget lokalt inblandat. Det betyder
     att dagens dygn saknas tills Tibber avraknat det (brukar ske dygnet efter) -
     priset for att siffran ar deras och inte en blandning. IDAG och VECKA ar
     ororda och anvander fortfarande live-loggen for de dygn Tibber inte hunnit. */
  var tibMan=function(mk2){var t2=(o.tib&&o.tib.m||{})[mk2];
    return t2?{k:t2[0]||0,s:t2[1]||0,ki:t2[2]||0,so:t2[3]||0}:null;};
  var tibDagar=function(f,t){var dd=(o.tib&&o.tib.d)||{},n=0;
    Object.keys(dd).forEach(function(dk){
      if(dk<f||dk>t)return;
      var x=dd[dk]; add({k:x[0]||0,s:x[1]||0,ki:x[2]||0,so:x[3]||0}); n++;});
    return n;};
  /* INNEVARANDE manad byggs ur Tibbers DYGNSNODER, inte manadsnoden. Tibbers
     MONTHLY-resolution slapar for en pagaende manad, medan dygnen ar farska in i
     gar - det var darfor juli visade 85 kr i stallet for 132. Bada ar Tibbers
     egna tal; dygnen ar bara den fraschare upplosningen.
     AVSLUTADE manader tas ur manadsnoden, eftersom dygnsfonstret bara racker
     31 dagar bakat och alltsa inte kan tacka dem. */
  var tibManad=function(mk2){
    var nu=(mk2===mk);
    if(nu&&tibDagar(mk2+'-01',mk2+'-31')>0)return true;
    var m3=tibMan(mk2);
    if(m3){add(m3);return true;}
    return nu?false:(tibDagar(mk2+'-01',mk2+'-31')>0);};
  if(per==='day'){add(monSrcDag(o,k)); r.from=k;}
  else if(per==='week'){var w0=monWeekStart(); r.from=w0; dagar(w0,k);}
  else if(per==='month'){r.from=mk+'-01';
    if(tib){r.ren=true; tibManad(mk);}
    else {add(o.m[mk]); add(o.d[k]);
      Object.keys(bf).forEach(function(dk){if(dk>=mk+'-01'&&dk<=k)add(bf[dk]);});}}
  else {r.from=yr+'-01-01';
    if(tib){r.ren=true;
      var man={};
      Object.keys((o.tib&&o.tib.m)||{}).forEach(function(m2){if(m2.slice(0,4)===yr)man[m2]=1;});
      Object.keys((o.tib&&o.tib.d)||{}).forEach(function(dk){
        if(dk.slice(0,4)===yr)man[dk.slice(0,7)]=1;});
      Object.keys(man).sort().forEach(function(m2){tibManad(m2);});}
    else {
      var mset={};
      Object.keys(o.m||{}).forEach(function(m2){mset[m2]=1;});
      Object.keys(mset).forEach(function(m2){
        if(m2.slice(0,4)!==yr||m2===mk)return;
        add(monSrcMan(o,m2));});
      add(o.m[mk]); add(o.d[k]);
      Object.keys(bf).forEach(function(dk){if(dk>=yr+'-01-01'&&dk<=k)add(bf[dk]);});}}
  if(start&&start>r.from)r.full=false;
  if(!start)r.full=false;
  r.net=Math.round((r.s-r.k)*100)/100;
  r.k=Math.round(r.k*100)/100; r.s=Math.round(r.s*100)/100;
  return r;}
function monTackning(r){   /* kort text nar siffran inte tacker hela perioden */
  if(!r.st)return 'ingen logg än';
  if(r.full)return '';
  var d=new Date(r.st+'T12:00:00');
  return 'från '+d.getDate()+' '+MABBR[d.getMonth()];}
function monHour(t){var d=new Date(t);return dayKey(d)+' '+('0'+d.getHours()).slice(-2);}
/* Bygger {dagnyckel:{k,s,ki,so}} ur tre timserier. Ren funktion - testbar utan Homey. */
/* RATTAT v185. Tre fel i v183/v184, alla synliga i din skarmbild:
   1) importmataren hamtades ALDRIG. Darfor blev kopta kWh noll for varje aterfyllt
      dygn, och "kWh kopt"-badgen forsvann helt. Rent slarv.
   2) kopta kronor hangde enbart pa accumulatedCost. Ger din Insights ingen sadan logg
      blir kopt 0 kr for hela manaden - precis det du sag: 0.25 kr, vilket bara var
      dagens live-varde. Nu raknas kopt i andra hand som importmatarens okning gangrat
      med timmens measure_price_total, alltso samma vag som salt. accumulatedCost
      anvands fortfarande NAR den finns, for det ar Tibbers eget belopp.
   3) rutan pastod "med timpris" aven nar ingen enda timme hittade ett pris. 519 kWh
      x 0.57 = 296 kr - reservsatsen, rakt igenom. Nu raknas traffarna (np/nf) och
      texten sager hur det faktiskt gick.
   Returnerar {dagar, np:timmar med riktigt pris, nf:timmar med reservsats, kAv:'kalla'} */
function monBuildBf(costPts,expPts,pricePts,impPts){
  var buy={}, sell={}, out={}, np=0, nf=0;
  (pricePts||[]).forEach(function(p){var h=monHour(p.t);
    buy[h]=p.v;                                        /* totalpris: ratt for KOPT el */
    sell[h]=Math.max(0,p.v/1.25-PRIS_ESKATT)+PRIS_NATNYTTA;});
  var ent=function(d){return out[d]||(out[d]={k:0,s:0,ki:0,so:0});};
  var meter=function(pts,fn){
    var pe=(pts||[]).slice().sort(function(a,b){return a.t-b.t;});
    for(var i=1;i<pe.length;i++){
      var d2=pe[i].v-pe[i-1].v;
      if(!(d2>0)||d2>=MON_MAXSTEG)continue;            /* matarbyte eller brus */
      fn(d2,dayKey(new Date(pe[i].t)),monHour(pe[i].t));}};
  /* salt: exportmatarens okning per timme x timmens saljpris */
  meter(expPts,function(d2,d,h){var e=ent(d),r=sell[h];
    if(r==null){r=prisSatser().salt;nf++;}else np++;
    e.so=Math.round((e.so+d2)*100)/100; e.s=Math.round((e.s+d2*r)*100)/100;});
  /* kopt: importmatarens okning per timme x timmens totalpris */
  meter(impPts,function(d2,d,h){var e=ent(d),r=buy[h];
    if(r==null){r=PRIS_AR_TOT;nf++;}else np++;
    e.ki=Math.round((e.ki+d2)*100)/100; e.kb=Math.round(((e.kb||0)+d2*r)*100)/100;});
  /* accumulatedCost ar Tibbers eget belopp - det slar var uppskattning nar det finns */
  var kAv='beraknat ur importmätare x timpris';
  var got=false;
  (costPts||[]).forEach(function(p){var d=dayKey(new Date(p.t)),e=ent(d);
    if(p.v>(e.kt||0)){e.kt=Math.round(p.v*100)/100;got=true;}});
  if(got)kAv='Tibbers accumulatedCost';
  Object.keys(out).forEach(function(d){var e=out[d];
    e.k=(e.kt!=null&&e.kt>0)?e.kt:(e.kb||0);
    delete e.kt; delete e.kb;
    e.se=e.s; e.sr=0;});
  return {dagar:out, np:np, nf:nf, kAv:kAv};}
function monDiag(){var o=monGet();return o.bfd||null;}
/* findLog kraver att loggens owner ar exakt homey:device:<id>. Tibbers prislogg kan
   agas av appen (homey:app:com.tibber...), och da hittas den aldrig. Sista utvagen:
   leta pa capability-namnet i vilken logg som helst, och redovisa vad som togs. */
function monFindLog(logs,dev,keys){
  var lg=findLog(logs,dev,keys); if(lg)return lg;
  var arr=Array.isArray(logs)?logs:Object.values(logs||{});
  for(var i=0;i<arr.length;i++){var id=arr[i].id||'';
    for(var j=0;j<keys.length;j++){
      if(id.indexOf(':'+keys[j])>=0||id===keys[j])
        return {uri:arr[i].uri||arr[i].ownerUri||'',id:id,lost:true};}}
  return null;}
async function monInsPts(logs,dev,keys,d,tag){
  var lg=monFindLog(logs,dev,keys);
  if(!lg){d[tag]={ok:false,why:'ingen logg'};return [];}
  for(var i=0;i<MON_RES.length;i++){
    var e=await homeyGet('/api/manager/insights/log/'+lg.uri+'/'+lg.id+'/entry?resolution='+MON_RES[i]);
    var pts=parseEntries(e);
    if(pts.length){d[tag]={ok:true,n:pts.length,res:MON_RES[i],id:lg.id,lost:!!lg.lost};return pts;}
  }
  d[tag]={ok:false,why:'loggen finns men gav noll punkter',id:lg.id};
  return [];}
async function monBackfill(force){
  var o0=monGet();
  if(_bfBusy)return; if(!force&&o0.bfat&&Date.now()-o0.bfat<12*36e5)return;
  if(!BASE||CONFIG.DATA_URL){var oq=monGet();oq.bfd={err:'ingen kontakt med Homey – återfyllnad kräver live-läge'};monSave(oq);return;}
  _bfBusy=true;
  var d={};
  try{
    var logs=await homeyGet('/api/manager/insights/log/');
    if(!logs){d.err='Insights svarade inte';}
    else{
      d.logs=(Array.isArray(logs)?logs:Object.values(logs||{})).length;
      var cost=await monInsPts(logs,DEV.pulse,['accumulatedCost'],d,'cost');
      var exp =await monInsPts(logs,DEV.pulse,['meter_power.exported','exported'],d,'exp');
      var imp =await monInsPts(logs,DEV.pulse,['meter_power.imported','imported'],d,'imp');
      var pris=await monInsPts(logs,DEV.tibber,['measure_price_total','price_total','price'],d,'pris');
      if(!exp.length&&!imp.length&&!cost.length){d.err='varken mätare eller kostnad gick att läsa';}
      else{
        var b=monBuildBf(cost,exp,pris,imp), bf=b.dagar;
        var o=monGet(), today=dayKey(), n=0, first=null;
        o.bf=o.bf||{};
        Object.keys(bf).forEach(function(dd){
          if(dd>=today)return;                 /* idag ags av live-loggen */
          if(o.st&&dd>=o.st)return;            /* redan live-loggat */
          o.bf[dd]=bf[dd]; n++; if(!first||dd<first)first=dd;});
        d.dygn=n; if(first)o.bfst=first;
        d.np=b.np; d.nf=b.nf; d.kAv=b.kAv;
        o.bfd=d; o.bfok=d;                     /* senaste LYCKADE bevaras separat */
        o.bfat=Date.now(); monSave(o); _bfBusy=false; render(); return;
      }
    }
  }catch(e){d.err='fel: '+(e&&e.message||e);}
  var ox=monGet(); ox.bfd=d; ox.bfat=Date.now(); monSave(ox); _bfBusy=false; render();}
function monBackfillNu(){var o=monGet();delete o.bfat;monSave(o);monBackfill(true);}
/* Kort, arlig statusrad om aterfyllnaden. */
function monDiagText(){
  var o=monGet(), d=o.bfd, ok=o.bfok;
  if(!d&&!ok)return 'Insights: inte hämtat än.';
  var pre='';
  if(d&&d.err){ if(!ok)return 'Insights: '+d.err+'.';
    pre='Senaste försök: '+d.err+'. Visar föregående lyckade hämtning. '; d=ok; }
  var f=[];
  [['cost','accumulatedCost'],['exp','exportmätare'],['imp','importmätare'],['pris','pris']].forEach(function(x){
    var v=d[x[0]]; if(!v)return;
    f.push(x[1]+': '+(v.ok?(v.n+' pkt/'+v.res+(v.lost?' (annan ägare)':'')):('SAKNAS – '+v.why)));});
  var t=pre+'Insights: '+f.join(' · ')+'.';
  if(d.dygn!=null)t+=' '+d.dygn+' dygn återfyllda.';
  if(d.np!=null){var tot=d.np+d.nf;
    t+=' Timpris träffade '+d.np+' av '+tot+' timmar'+(d.nf?(' – '+d.nf+' fick reservsats'):'')+'.';}
  if(d.kAv)t+=' Köpt: '+d.kAv+'.';
  return t;}
function appKan(){try{
  return !!(apiBase()&&CONFIG.TOKEN&&CONFIG.TOKEN.indexOf('DIN_API')<0&&!CONFIG.DATA_URL&&!isDemo());
}catch(e){return false;}}
/* POST mot appen. Samma inlindning i {result:…} som appGet hanterar. */
async function appPost(vag,kropp){
  if(!appKan())throw new Error('ingen direktkoppling till Homey');
  /* Samma vägval som appGet — "Spara till Homey" ska fungera borta hemifrån. */
  var r=null,sist=null,vagar=brvVagar();
  for(var vi=0;vi<vagar.length;vi++){
    try{
      var t=withTimeout(12000);
      r=await fetch(vagar[vi]+'/api/app/'+APP_ID+vag,
        {method:'POST',headers:{Authorization:'Bearer '+(CONFIG.TOKEN||''),
          'Content-Type':'application/json'},
         body:JSON.stringify(kropp||{}),cache:'no-store',signal:t.signal});
      t.clear();
      if(!r.ok){sist=new Error(r.status+' '+r.statusText);r=null;continue;}
      if(vagar[vi]!==BASE){BASE=vagar[vi];_baseAt=Date.now();}
      break;
    }catch(e){sist=e;r=null;}
  }
  if(!r)throw (sist||new Error('ingen väg till Homey'));
  var j=await r.json();
  if(j&&typeof j==='object'&&!Array.isArray(j)&&'result'in j&&Object.keys(j).length===1)j=j.result;
  return j;}

async function appGet(vag){
  if(!appKan())throw new Error('ingen direktkoppling till Homey');
  /* PROVA ALLA VÄGAR, inte bara apiBase(). Borta hemifrån pekar apiBase() på
     det lokala nätet tills uppdateringsslingan hunnit byta — och trycker man
     "Hämta från Homey" innan dess faller anropet, utan att något syns.
     Det var så inställningarna kunde se ut att vara borta: de fanns kvar i
     Homey, men vägen dit provades aldrig. */
  var r=null,sist=null;
  var vagar=brvVagar();
  for(var vi=0;vi<vagar.length;vi++){
    try{
      var t=withTimeout(8000);
      r=await fetch(vagar[vi]+'/api/app/'+APP_ID+vag,
        {headers:{Authorization:'Bearer '+(CONFIG.TOKEN||'')},cache:'no-store',signal:t.signal});
      t.clear();
      if(!r.ok){sist=new Error(r.status+' '+r.statusText);r=null;continue;}
      if(vagar[vi]!==BASE){BASE=vagar[vi];_baseAt=Date.now();}
      break;
    }catch(e){sist=e;r=null;}
  }
  if(!r)throw (sist||new Error('ingen väg till Homey'));
  var j=await r.json();
  /* Homey svarar ibland med själva värdet, ibland inlindat i {result:…}.
     Att bara läsa det ena ger tysta tomma svar. */
  if(j&&typeof j==='object'&&!Array.isArray(j)&&'result'in j&&Object.keys(j).length===1)j=j.result;
  _appOk=Date.now(); _appFel=null;
  return j;}
/* Hämtar Tibber ur appen. Returnerar null om appen inte kan svara, så anroparen
   kan falla tillbaka utan att veta något om varför. */
async function appTibber(){
  try{
    var j=await appGet('/tibber');
    if(!j||(!j.dagar&&!j.manader))throw new Error('tomt svar');
    return {d:j.dagar||{},m:j.manader||{},at:(j.meta&&j.meta.at)?dayKey(new Date(j.meta.at)):null,
            meta:j.meta||{}};
  }catch(e){_appFel=(e&&e.message)||String(e);return null;}}
async function tibKrFetch(){
  try{
    if(!BASE||CONFIG.DATA_URL)return;
    var o=monGet(), j=null, kalla=null;
    /* Appen först: den kör i bakgrunden och är alltid minst lika färsk. */
    var franApp=await appTibber();
    if(franApp){ j=franApp; kalla='app'; }
    if(!j){
      var list=await logicList(), v=null;
      logicArr(list).forEach(function(x){if(x&&x.name===TIB_VAR)v=x;});
      if(!v){o.tibd={err:'appen svarar inte ('+(_appFel||'okänt')+') och logikvariabeln '+TIB_VAR+' finns inte'};monSave(o);return;}
      try{j=JSON.parse(String(v.value||''));}catch(e){}
      if(!j||!j.d&&!j.m){o.tibd={err:'kunde inte tolka '+TIB_VAR};monSave(o);return;}
      kalla='variabel';
    }
    /* SLAS IHOP, skrivs inte over. Tibbers fonster ar 12 manader och 31 dygn och
       glider framat - skrev vi over forsvann augusti 2025 ur dashboarden 1 augusti,
       for alltid. Nya varden vinner (Tibber kan efterjustera en manad), gamla behalls.
       Manaderna ar permanenta; dygnen gallras vid 70 for att inte vaxa i onodan. */
    /* Nycklarna kapas till ÅÅÅÅ-MM-DD respektive ÅÅÅÅ-MM. Skriver HomeyScriptet
       hela ISO-tidsstämplar (som Tibbers noder har) matchar de varken dayKey()
       eller månadsuppslagen, och dygnen blir tysta nollor. */
    var kapa=function(src,n){var ut={};
      Object.keys(src||{}).forEach(function(k){var kk=String(k).slice(0,n);
        if(kk)ut[kk]=src[k];});
      return ut;};
    var pm=(o.tib&&o.tib.m)||{}, pd=(o.tib&&o.tib.d)||{}, fore=Object.keys(pm).length;
    var m=Object.assign({},kapa(pm,7),kapa(j.m,7)), d=Object.assign({},kapa(pd,10),kapa(j.d,10));
    var dk=Object.keys(d).sort(); while(dk.length>70)delete d[dk.shift()];
    o.tib={m:m,d:d,at:j.at||null};
    o.tibd={ok:true,md:Object.keys(m).length,dd:Object.keys(d).length,at:j.at||null,
            kalla:kalla, appFel:(kalla==='app'?null:_appFel),
            ny:Object.keys(j.m||{}).length,behallna:Math.max(0,Object.keys(m).length-Object.keys(j.m||{}).length)};
    monSave(o); render();
  }catch(e){var ox=monGet();ox.tibd={err:'fel vid läsning: '+(e&&e.message||e)};monSave(ox);}}
/* Prioritet per dygn: Tibbers facit > aterfyllt ur Insights > live-loggen. */
function monSrcDag(o,dk){
  var t=o.tib&&o.tib.d&&o.tib.d[dk];
  if(t&&dk!==dayKey())return {k:t[0]||0,s:t[1]||0,ki:t[2]||0,so:t[3]||0};
  if(o.d&&o.d[dk])return o.d[dk];
  if(o.bf&&o.bf[dk])return o.bf[dk];
  return null;}
function monSrcMan(o,mk){
  var t=o.tib&&o.tib.m&&o.tib.m[mk];
  if(t)return {k:t[0]||0,s:t[1]||0,ki:t[2]||0,so:t[3]||0};
  return (o.m&&o.m[mk])||null;}
function monHarTib(){var o=monGet();return !!(o.tib&&((o.tib.d&&Object.keys(o.tib.d).length)||(o.tib.m&&Object.keys(o.tib.m).length)));}
function monTibText(){
  var o=monGet(), d=o.tibd;
  if(!d)return 'Tibber-API: inte läst än.';
  if(d.err)return 'Tibber-API: '+d.err+'.';
  var k=(d.kalla==='app')?'Hämtat ur Homey-appen, som uppdaterar i bakgrunden'
       :(d.kalla==='variabel')?('Hämtat ur logikvariabeln '+TIB_VAR
          +(d.appFel?(' eftersom appen inte svarade ('+d.appFel+')'):''))
       :'Källa okänd';
  return k+' — '+d.md+' månader och '+d.dd+' dygn'+(d.at?', senast '+d.at:'')+'.';}
/* Kort rad om innevarande månad. Den utförliga dumpen som stod här var
   byggnadsställning för 85/210-felet. Det är löst, och appens inställningssida
   gör diagnostiken bättre — texten här ska vara läsbar, inte uttömmande.
   NOTERA: den här strängen går genom esc() i iqBtn(). Ren text, ingen HTML. */
function monTibKort(){
  var o=monGet(), mk=dayKey().slice(0,7);
  var dd=(o.tib&&o.tib.d)||{};
  var iMan=Object.keys(dd).filter(function(k){return k.slice(0,7)===mk;}).sort();
  if(!iMan.length)return 'Inga Tibber-dygn för '+mk+' än.';
  var sk=0,ss=0;
  iMan.forEach(function(k){var x=dd[k];sk+=x[0]||0;ss+=x[1]||0;});
  var kr2=function(v){return (Math.round(v*100)/100).toString().replace('.',',');};
  return mk+': '+iMan.length+' dygn t.o.m. '+iMan[iMan.length-1].slice(8)
    +', '+kr2(sk)+' kr köpt / '+kr2(ss)+' kr sålt.';}
function bkpGet(){try{return JSON.parse(localStorage.getItem(BKP_KEY))||{};}catch(e){return {};}}
function bkpLen(){let n=0;SYNC_KEYS.forEach(k=>{const v=localStorage.getItem(k);if(v!=null)n+=v.length;});return n;}
/* ===== LAYOUTEN LAGRAS PER ENHETSTYP =====
   Bada enheterna skrev layouten till SAMMA nycklar i samma kopia, och slogs
   darfor om den: skrivloggen ar full av "vagrade lasa - kopian ar aldre an
   enhetens egen sparning", fran bada hallen, hela dagen. Telefonen sparade sin
   knapprad, plattan sin, och den som skrev sist vann.

   Nu far varje layoutnyckel ett suffix med enhetstypen nar den lagras:
   buttons_v1__telefon och buttons_v1__platta ar tva olika saker i kopian, men
   samma buttons_v1 lokalt pa respektive enhet. Loggar och matvarden delas som
   forut - de handlar om huset, inte om enheten.

   Bakatkompatibelt: finns bara den gamla osuffixade nyckeln lases den, sa
   ingen forlorar sin layout vid uppgraderingen. */
function syncKey(k){
  if(DELADE_KEYS.indexOf(k)>=0)return k+'__delad';
  return (LAYOUT_KEYS.indexOf(k)>=0)?(k+'__'+secKlass()):k;
}
function deladTs(){var v=0;try{v=parseInt(localStorage.getItem(DELAD_LOKAL)||'0',10)||0;}catch(e){}return v;}
function deladSmutsig(){try{return localStorage.getItem(DELAD_SMUTS)==='1';}catch(e){return false;}}
function deladAndrad(){try{localStorage.setItem(DELAD_LOKAL,String(Date.now()));localStorage.setItem(DELAD_SMUTS,'1');}catch(e){}}
/* Ska det delade facket med i den här skrivningen? Bara med en lokal ändring. */
function deladSkriv(obj){
  if(!deladSmutsig())return false;
  var med=0;
  DELADE_KEYS.forEach(function(k){var v=null;try{v=localStorage.getItem(k);}catch(e){}
    /* Aldrig ändrade rutor finns inte lokalt – då är det standardrutorna som
       syns, och det är dem som ska delas. */
    if(v==null&&k===GRIDS.flode.store){try{v=JSON.stringify(gridTiles('flode'));}catch(e){}}
    if(v!=null){obj[k+'__delad']=v;med++;}});
  if(!med)return false;                      /* ingen stämpel utan rutor */
  obj[DELAD_TS_KEY]=String(deladTs()||Date.now());
  return true;}
function deladSkrivet(){try{localStorage.removeItem(DELAD_SMUTS);localStorage.setItem(DELAD_INIT,'1');}catch(e){}}
/* Väljer vad som ska läsas för en delad nyckel ur en kopia.
   har(nyckel) → finns i kopian; ts = kopians deladts (0 om den saknas).
   Svar: {kalla, ts} eller {hopp:'orsak'}. */
function deladVal(k,har,ts){
  if(deladSmutsig())return {hopp:'osparad ändring av rutorna här'};
  if(har(k+'__delad')){
    if(ts&&ts>deladTs())return {kalla:k+'__delad',ts:ts};
    return {hopp:'det delade facket är inte nyare'};}
  /* Inget delat fack ännu: telefonens rutor gäller – så länge den här enheten
     inte redan fått en delad uppsättning. */
  if(!deladTs()&&har(k+'__telefon'))return {kalla:k+'__telefon',ts:0};
  return {hopp:'inget delat fack i kopian'};}
async function deladFranApp(){
  if(Date.now()-_deladAppAt<60000)return false;
  _deladAppAt=Date.now();
  if(!appKan()||deladSmutsig())return false;
  var ts=0;try{ts=parseInt(await appGet('/backup?key='+encodeURIComponent(DELAD_TS_KEY)),10)||0;}catch(e){return false;}
  if(!ts||ts<=deladTs())return false;
  var andrat=false;
  for(var i=0;i<DELADE_KEYS.length;i++){
    var k=DELADE_KEYS[i],v=null;
    try{v=await appGet('/backup?key='+encodeURIComponent(k+'__delad'));}catch(e){}
    if(v!=null&&typeof v!=='string'){try{v=JSON.stringify(v);}catch(e){v=null;}}
    if(!v||!v.length)continue;
    if(deladSmutsig())return false;              /* ändrades medan vi hämtade */
    var fore=null;try{fore=localStorage.getItem(k);}catch(e){}
    if(fore!==v){
      /* Kroken på localStorage.setItem stämplar varje skrivning av rutorna som
         en LOKAL ändring. Det här är ingen – återställ stämpeln efteråt, annars
         vägrar nästa läsning ("lokala ändringar är nyare än kopian"). */
      var andr0=null;try{andr0=localStorage.getItem(ANDRAD_TS);}catch(e){}
      localStorage.setItem(k,v);andrat=true;
      try{if(andr0==null)localStorage.removeItem(ANDRAD_TS);else localStorage.setItem(ANDRAD_TS,andr0);}catch(e){}}
  }
  try{localStorage.setItem(DELAD_LOKAL,String(ts));}catch(e){}
  if(andrat){
    try{Object.keys(TILESTATE).forEach(function(x){delete TILESTATE[x];});}catch(e){}
    try{ritaOmSakert();}catch(e){}
    loggSkriv('läste rutorna från appen',{ts:ts});
  }
  return andrat;}
/* Telefonen publicerar sina rutor en gång, när v738 körs första gången. */
function deladStart(){
  try{
    if(localStorage.getItem(DELAD_INIT))return;
    if(secKlass()!=='telefon')return;
    deladAndrad();
    try{syncPushSoon();}catch(e){}
  }catch(e){}}
function lasProtStart(kalla){
  _lasProt={t:Date.now(),kalla:kalla,enhet:enhetsNamn(),klass:secKlass(),ver:APP_VERSION,rader:[]};
}
/* Storleksinstallningarna i klartext. Langden pa cfg_v1 andras sallan nar man
   stegar en storlek - "1173 tkn → 1173 tkn" sag darfor identiskt ut aven nar
   varden bytts. Har plockas de fält som faktiskt styr matten ut, sa att
   protokollet visar VAD som stod dar, inte hur langt det var. */
function stlDigest(raa){
  try{
    var c=(typeof raa==='string')?JSON.parse(raa):raa;
    if(!c||typeof c!=='object')return '';
    var mob=!!(typeof szMobile==='function'&&szMobile());
    var f=mob?(c.mob||{}):c;
    var d=[];
    if(c.ewh!=null)d.push('ewh='+c.ewh);
    ['kn','avd','spot'].forEach(function(g){
      if(f[g]&&typeof f[g]==='object'){
        var inre=[];for(var q in f[g])inre.push(q+':'+f[g][q]);
        if(inre.length)d.push(g+'{'+inre.join(',')+'}');
      }
    });
    ['tile','chip'].forEach(function(g){
      if(c[g]&&typeof c[g]==='object'){
        var inre=[];['ic','v','name','desc','gap'].forEach(function(q){
          if(c[g][q]!=null)inre.push(q+':'+c[g][q]);});
        if(inre.length)d.push(g+'{'+inre.join(',')+'}');
      }
    });
    return d.join(' ');
  }catch(e){return '';}
}
function lasProtRad(k,valdKallnyckel,fore,efter,orsak){
  if(!_lasProt)return;
  if(LAYOUT_KEYS.indexOf(k)<0)return;   /* bara layouten - loggarna ar inte stridsamnet */
  var rad={k:k,src:valdKallnyckel||'-',
    f:(fore==null?-1:String(fore).length),
    e:(efter==null?-1:String(efter).length),
    o:orsak||''};
  /* For storleksbararna racker inte langden - visa varderna. */
  if(k==='cfg_v1'){rad.fd=stlDigest(fore);rad.ed=(efter==null)?'':stlDigest(efter);}
  else if(k==='secScale_v1'){
    rad.fd=(fore==null)?'':String(fore).slice(0,90);
    rad.ed=(efter==null)?'':String(efter).slice(0,90);
  }
  _lasProt.rader.push(rad);
}
function lasProtSlut(){
  if(!_lasProt)return;
  try{localStorage.setItem(LASPROT_KEY,JSON.stringify(_lasProt));}catch(e){}
  _lasProt=null;
}
function lasProtText(){
  var o=null;try{o=JSON.parse(localStorage.getItem(LASPROT_KEY)||'null');}catch(e){}
  if(!o)return 'Ingen hämtning gjord än på den här enheten.';
  var d=new Date(o.t);
  var t='Senaste hämtning: '+('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)
    +' · '+o.kalla+' · '+o.enhet+' ('+o.klass+') · '+o.ver+'\n';
  if(!o.rader.length)return t+'  ingen layoutnyckel rördes';
  o.rader.forEach(function(r){
    /* ANDRAD bara nar nagot faktiskt skrevs. e = -1 betyder att raden lamnades
       orord, och da ar skillnaden mot f ingen andring. */
    var and=(r.e>=0&&r.f!==r.e);
    t+='  '+r.k+': lokalt '+(r.f<0?'saknas':r.f+' tkn')
      +' → '+(r.e<0?'orört':r.e+' tkn')
      +'   källa '+r.src+(r.o?(' · '+r.o):'')+(and?'   SKREVS ÖVER':'')+'\n';
    /* Samma langd betyder inte samma innehall - darfor varderna under. */
    if(r.fd!=null||r.ed!=null){
      if(r.fd)t+='      före: '+r.fd+'\n';
      if(r.ed&&r.ed!==r.fd)t+='      efter: '+r.ed+'   VÄRDEN BYTTA\n';
      else if(r.ed)t+='      efter: samma värden\n';
    }
  });
  return t;
}
/* TIDSSTAMPEL PER FACK. Kopian har EN tidsstampel for hela sig, men innehallet
   ar uppdelat per enhetstyp. Sparar plattan blir kopian nyare - och telefonen,
   som jamfor mot den stampeln, tror att den ska lasa. Den far da sitt EGET
   gamla fack tillbaka och skriver over nyare lokala andringar.
   Matt 2026-08-29: buttons_v1 lokalt 1017 tkn, facket 804, och protokollet sa
   SKREVS OVER.
   Varje fack har darfor en egen stampel: nar det facket senast skrevs. */
function layoutTsKey(){return 'layoutts__'+secKlass();}
function syncNyttFormat(nycklar){
  if(!nycklar)return false;
  for(var i=0;i<LAYOUT_KEYS.length;i++)
    for(var kl in SEC_ZOOM_BAS)if((LAYOUT_KEYS[i]+'__'+kl) in nycklar)return true;
  return false;
}
/* Plockar ut vardet for en nyckel ur en hamtad kopia.
   RESERVEN AR FARLIG och far bara anvandas pa en GAMMAL kopia. Logikvariablerna
   bar fortfarande den delade layouten fran fore v577; foll lasningen tillbaka
   pa den skrevs enhetens egna installningar over igen, precis som forut.
   Har kopian fack betyder ett saknat fack att DEN HAR enheten inte sparat nagon
   layout dar - och da ska det lokala sta kvar, inte ersattas av den andra
   enhetens. */
function syncPlock(obj,k){
  if(!obj)return null;
  var sk=syncKey(k);
  if(obj[sk]!=null)return obj[sk];
  if(k===sk)return (obj[k]!=null)?obj[k]:null;
  if(syncNyttFormat(obj))return null;
  return (obj[k]!=null)?obj[k]:null;
}
function bkpLayoutLen(){let n=0;LAYOUT_KEYS.forEach(k=>{const v=localStorage.getItem(k);
  if(v!=null)n+=v.length;});return n;}
function enhetsId(){
  /* Slumpat och lokalt. Ett id per webbläsare räcker; vi behöver bara kunna
     skilja enheterna åt, inte veta vilken som är vilken. */
  var v=null;
  try{v=localStorage.getItem('enhetsid_v1');}catch(e){}
  if(!v){
    v=(Date.now().toString(36)+Math.random().toString(36).slice(2,8));
    try{localStorage.setItem('enhetsid_v1',v);}catch(e){}
  }
  return v;}
/* EN HUVUDENHET PER KLASS, och valet SYNKAS. Det var felet: nyckeln låg bara
   lokalt, så den enhet man utsåg visste om det — men ingen annan. Plattan
   fortsatte skriva sin gamla glow-inställning över telefonens varje dygn, och
   utifrån såg det ut som att sparningen inte fastnade.

   Storlekarna är olika för platta och telefon, så plattornas huvudenhet måste
   vara en platta — annars skriver telefonen aldrig plattans mått. */
function huvudGet(){
  try{
    var o=JSON.parse(localStorage.getItem(HUVUD_KEY)||'null');
    if(!o)return null;
    /* Äldre format: ett enda val utan klass. Tolka det som den här klassens. */
    if(o.id&&!o.klass)return {klass:secKlass(),id:o.id,namn:o.namn};
    return o[secKlass()]||null;
  }catch(e){return null;}}
/* Finns NÅGON huvudenhet, oavsett klass? */
function huvudFinns(){
  try{
    var o=JSON.parse(localStorage.getItem(HUVUD_KEY)||'null');
    if(!o)return false;
    if(o.id)return true;                       /* gammalt format */
    return !!(o.platta&&o.platta.id)||!!(o.telefon&&o.telefon.id);
  }catch(e){return false;}}

function arHuvud(){
  var h=huvudGet();
  if(h&&h.id)return h.id===enhetsId();
  /* INGEN huvudenhet för min klass. Förut betydde det "fri att skriva", och då
     fortsatte plattan skriva över telefonens inställningar trots att telefonen
     utsetts — plattans klass hade ju ingen egen huvudenhet. Är någon utsedd
     alls ska övriga hålla sig undan; först när ingen är utsedd får alla skriva,
     som det fungerade innan. */
  return !huvudFinns();}
function huvudSatt(pa){
  try{
    var raa=null;
    try{raa=JSON.parse(localStorage.getItem(HUVUD_KEY)||'null');}catch(e){}
    if(raa&&raa.id&&!raa.klass)raa=null;      /* gammalt format skrivs över */
    var o=raa||{};
    if(pa)o[secKlass()]={id:enhetsId(),namn:enhetsNamn(),at:Date.now()};
    else delete o[secKlass()];
    if(Object.keys(o).length)localStorage.setItem(HUVUD_KEY,JSON.stringify(o));
    else localStorage.removeItem(HUVUD_KEY);
  }catch(e){}
  /* SKRIV DIREKT till Homey. Att vänta på nästa dygnstick vore obegripligt:
     man trycker på knappen och vill att det ska gälla nu. Och den andra
     enheten måste få veta innan den hinner skriva över. */
  try{
    if(appKan())appBackupSpara().then(function(){huvudKvitto(true);})
      .catch(function(){huvudKvitto(false);});
    else saveToHomey().then(function(){huvudKvitto(true);})
      .catch(function(){huvudKvitto(false);});
  }catch(e){huvudKvitto(false);}}

/* Kvitto i inställningsrutan. Utan det ser trycket ut att inte göra något. */
function huvudKvitto(ok){
  var e=$('huvud-kvitto');
  if(e)e.textContent=ok?'Sparat till Homey — övriga enheter hämtar det härnäst.'
    :'Kunde inte spara till Homey. Valet gäller den här enheten tills vidare.';}
/* Väljer och säger till. Utan besked ser det ut som att knappen inte gör något —
   raden ovanför uppdateras, men den är lätt att missa. */
function huvudValj(pa){
  huvudSatt(pa);
  cfgGo('system');
  var e=$('huvud-svar');
  if(e)e.textContent=pa
    ? ('Den här enheten ('+enhetsNamn().toLowerCase()+') sparar nu till Homey. Övriga hämtar härifrån.')
    : 'Alla enheter får spara igen.';}

function enhetsNamn(){
  return IS_SAMSUNG_TABLET?'Väggplattan':(szMobile()?'Telefon':'Platta');}

/* Väggplattan och telefonen utses automatiskt första gången de öppnas, var och
   en för sin klass. Att behöva hitta rätt i inställningarna på två enheter för
   att en självklar uppdelning ska gälla är ett steg för mycket — och glömmer man
   den ena skriver den över den andra, vilket är precis felet vi jagat. */
function huvudAuto(){
  try{
    var raa=JSON.parse(localStorage.getItem(HUVUD_KEY)||'null');
    if(raa&&raa.id)return false;                 /* gammalt format: rör inte */
    var o=raa||{};
    var k=secKlass();
    if(o[k]&&o[k].id)return false;               /* redan utsedd */
    /* BARA de två avsedda enheterna utser sig själva. En godtycklig platta som
       råkar öppnas först ska inte ta rollen från väggplattan. */
    var jag=(k==='platta')?IS_SAMSUNG_TABLET:MOBILE;
    if(!jag)return false;
    o[k]={id:enhetsId(),namn:enhetsNamn(),at:Date.now(),auto:1};
    localStorage.setItem(HUVUD_KEY,JSON.stringify(o));
    return true;
  }catch(e){return false;}}

/* Hämtar huvudenhetens inställningar. Körs på övriga enheter en gång per dygn
   och vid varje uppstart. Ritar bara om när något faktiskt ändrats. */
async function huvudHamta(){
  var o=bkpGet(),k=dayKey();
  if(o.lastLas===k)return false;
  var fore=syncSign();
  var n=0;
  try{ if(appKan())n=await appBackupLas(); }catch(e){}
  if(!n){try{await fetchFromHomey();}catch(e){}}
  o.lastLas=k;
  try{localStorage.setItem(BKP_KEY,JSON.stringify(o));}catch(e){}
  if(syncSign()!==fore){
    loadCfg();applyCfg();
    var sb=loadButtons();if(sb)CONFIG.BUTTONS=sb;try{rutorPaNu();}catch(e){}
    applySecOrder();
    try{ritaOmSakert();}catch(e){}
    return true;
  }
  return false;}
async function syncFersk(){
  if(CFG.sync===false)return false;
  if(!CONFIG.TOKEN||CONFIG.TOKEN.indexOf('DIN_API')>=0)return false;
  if(Date.now()-_ferskAt<5*60000)return false;      /* högst var femte minut */
  _ferskAt=Date.now();
  var meta=null;
  try{
    var list=await logicList(),byName={};
    logicArr(list).forEach(function(v){if(v&&v.name)byName[v.name]=v.value;});
    var raa=byName[syncVar()];
    if(raa==null)raa=byName['dashboard_state'];
    if(raa==null)return false;
    meta=JSON.parse(raa);
  }catch(e){return false;}
  if(!meta||!meta.t)return false;
  /* _syncMeta sätts både när vi skriver och när vi läser. Är tiden densamma är
     det vår egen kopia som ligger där. */
  if(_syncMeta&&_syncMeta.t===meta.t)return false;
  var fore=syncSign();
  try{await fetchFromHomey();}catch(e){return false;}
  if(syncSign()===fore)return false;
  loadCfg();applyCfg();
  var sb=loadButtons();if(sb)CONFIG.BUTTONS=sb;
  applySecOrder();
  try{ritaOmSakert();}catch(e){}
  return true;
}
async function backupTick(){
  try{
    if(CFG.sync===false)return;
    if(!CONFIG.TOKEN||CONFIG.TOKEN.indexOf('DIN_API')>=0)return;
    /* Alla läser, även huvudenheten. Kollen är billig och gör ingenting när
       ingenting ändrats. */
    try{enhTick();}catch(e){}
    try{await syncFersk();}catch(e){}
    try{await deladFranApp();}catch(e){}
    /* Inte huvudenhet: läs, skriv aldrig. */
    if(!arHuvud()){
      /* Läs i stället. En enhet som aldrig hämtar visar sin egen gamla
         inställning i evighet, och det var halva förvirringen: telefonen hade
         rätt, plattan hade fel, och båda trodde de hade sparat. */
      try{await huvudHamta();}catch(e){}
      return;
    }
    const o=bkpGet(),k=dayKey();
    if(o.last===k)return;                    /* en gang per dygn racker */
    const len=bkpLen(),llen=bkpLayoutLen();
    /* SKYDDET: skriv ALDRIG over en stor backup med en liten. En padda med rensad
       cache, eller en ny enhet, skulle annars radera allt pa Homey vid forsta ticket.
       En krympning under 60% ar alltid misstankt - da avstar vi och flaggar.
       Mats pa LAYOUTEN, inte pa totalen: loggarna dominerar summan och krymper
       av sig sjalva nar de trimmas. */
    if(o.llen && llen < o.llen*0.6){
      o.blocked=k; o.blockedLen=llen; o.prevLen=o.llen;
      try{localStorage.setItem(BKP_KEY,JSON.stringify(o));}catch(e){}
      return;
    }
    /* SKYDD MOT FÖRSTA SPARNINGEN. Guarden ovan jämför mot enhetens EGET minne
       av vad den senast sparade. En enhet med tom lagring — ny telefon, rensad
       cache, eller dashboarden öppnad från en annan adress — har inget att
       jämföra med, och skrev därför över Homeys kopia med sina standardvärden
       vid första ticket. Det var så en sparad layout kunde försvinna helt.

       Fråga i stället Homey hur mycket som ligger där. Har appen väsentligt fler
       nycklar än vi har lokalt är vi den tomma parten och ska hämta, inte skriva. */
    if(!o.len){
      /* v706: en gång per dygn — se nedan. */
      if(o.tomHamtad===k)return;
      try{
        if(appKan()){
          var fjarr=await appGet('/backup');
          var antalFjarr=(fjarr&&fjarr.nycklar)?Object.keys(fjarr.nycklar).length:0;
          var antalHar=0;
          for(var si=0;si<SYNC_KEYS.length;si++){
            var vv=localStorage.getItem(SYNC_KEYS[si]);
            if(vv!=null&&vv.length)antalHar++;
          }
          if(antalFjarr>2&&antalHar<antalFjarr*0.6){
            /* v706: EN GÅNG PER DYGN. o.len sätts bara när enheten skriver, och
               det gör den aldrig härifrån — kopian räknar båda enhetsklassernas
               fack, så en enhet kan stå kvar som "tom" fast den har allt. Då
               hämtades och ritades sidan om vid varje tick, var 15:e sekund. */
            o.blocked=k;o.blockedLen=len;o.fjarrAntal=antalFjarr;o.harAntal=antalHar;o.tomHamtad=k;
            try{localStorage.setItem(BKP_KEY,JSON.stringify(o));}catch(e){}
            /* HÄMTA i stället — enheten är tom och Homey har sanningen. */
            try{var fore2=syncSign();await appBackupLas();
              /* Rita bara om när något faktiskt ändrats, som bootSync gör. */
              if(syncSign()!==fore2){loadCfg();applyCfg();
                var sb2=loadButtons();if(sb2)CONFIG.BUTTONS=sb2;
                applySecOrder();render();}}catch(e){}
            return;
          }
        }
      }catch(e){}
    }
    /* ÄGARSKAPET GÅR FÖRE. Har någon tryckt "Spara till Homey" för hand på en
       annan enhet är den kopian ett beslut — den automatiska säkerhets-
       kopieringen ska aldrig köra över den. Bara ett nytt manuellt tryck från
       samma enhet får skriva om den. */
    var far=await agareFarSkriva(false);
    if(!far.ok){
      o.blocked=k;o.blockadAv=(far.agare&&far.agare.namn)||far.orsak||'annan enhet';
      loggSkriv('avstod',{orsak:o.blockadAv});
      /* ÄRV I STÄLLET. Att bara avstå från att skriva räckte inte — då satt
         enheten kvar med sina egna inställningar i evighet. Äger någon annan
         kopian är den kopian sanningen, och den här enheten ska hämta hem den.

         Bara en gång per stämpel: `argt` är ägarens tidpunkt, och har vi redan
         ärvt just den behöver vi inte göra det igen vid varje tick. */
      var argt=(far.agare&&far.agare.at)||0;
      if(argt&&o.argt===argt){
        try{localStorage.setItem(BKP_KEY,JSON.stringify(o));}catch(e){}
        return;
      }
      try{
        var fore3=syncSign();
        var n2=await appBackupLas();
        if(n2>0){
          /* v706: rita bara om när något faktiskt ändrats. */
          if(syncSign()!==fore3){
          loadCfg();applyCfg();
          var sb3=loadButtons();if(sb3)CONFIG.BUTTONS=sb3;
          applySecOrder();
          try{render();}catch(e){}
          try{renderControls();}catch(e){}
          }
          o.argt=argt;o.arvdaFran=o.blockadAv;o.arvdaAt=Date.now();o.arvdaAntal=n2;
        }
      }catch(e){}
      try{localStorage.setItem(BKP_KEY,JSON.stringify(o));}catch(e){}
      return;
    }
    /* Appen först. Den har inget utrymmestak, så inga loggar behöver offras. */
    var viaApp=false;
    try{
      if(appKan()){var r=await appBackupSpara(false); viaApp=!!(r&&r.ok);}
    }catch(e){}
    if(!viaApp)await saveToHomey();
    o.last=k; o.len=len; o.llen=llen; o.t=Date.now(); o.kalla=viaApp?'app':'variabel';
    delete o.blocked; delete o.blockedLen;
    try{localStorage.setItem(BKP_KEY,JSON.stringify(o));}catch(e){}
  }catch(e){/* natet nere - nya forsok nasta tick */}}
function bkpStatus(){const o=bkpGet();
  if(o.blocked)return {ok:false,txt:'Backup stoppad '+o.blocked+': lokal data krympte till '+o.blockedLen+' av '+o.prevLen+' tecken'};
  if(!o.last)return {ok:false,txt:'Ingen backup gjord an'};
  return {ok:true,txt:'Backup '+o.last+' ('+o.len+' tecken)'};}
function pushIgen(orsak){
  if(_pushForsok>=PUSH_FORSOK_MAX){_pushForsok=0;return false;}
  _pushForsok++;
  syncNote('Sparade inte än – '+orsak+'. Försöker igen om en minut ('+_pushForsok+'/'+PUSH_FORSOK_MAX+')');
  setTimeout(function(){try{syncPushSoon();}catch(e){}},60000);
  return true;}
function syncPushSoon(){try{
  if(CFG.sync===false)return;
  if(!CONFIG.TOKEN||CONFIG.TOKEN.indexOf('DIN_API')>=0)return;
  if(_pushT)clearTimeout(_pushT);
  _pushT=setTimeout(function(){_pushT=null;
    if(_pushBusy)return;
    /* Samma skydd som dygnsbackupen: skriv aldrig över mycket data med väsentligt mindre
       (t.ex. en enhet med rensad cache som annars skulle radera de andras layout). */
    var o=bkpGet(),len=bkpLen(),llen=bkpLayoutLen();
    /* Jamfor LAYOUTEN mot layouten, inte totalen mot totalen. */
    if(o.llen&&llen<o.llen*0.6){syncNote('Sparade inte – layouten ser ofullständig ut');return;}
    _pushBusy=true;
    /* ÄGARSKAPET GÄLLER ÄVEN HÄR. Den här vägen skrev rakt på logikvariablerna
       utan att fråga vem som äger kopian — en enhet som råkade ändra något
       lokalt kunde alltså skriva över ett manuellt beslut från en annan enhet
       några sekunder senare, tyst. */
    agareFarSkriva(false).then(function(far){
      if(!far.ok){_pushBusy=false;
        loggSkriv('push-avstod',{orsak:(far.agare&&far.agare.namn)||far.orsak||''});
        /* v744: en annan enhet som äger kopian är ett beslut – då avstår vi.
           Allt annat är ett tappat anrop: försök igen om en minut, högst fem
           gånger. Förut låg ändringen kvar osparad tills man ändrade något mer. */
        if(!far.agare&&pushIgen(far.orsak||'kunde inte kontrollera ägaren'))return;
        syncNote('Sparade inte – '+((far.agare&&far.agare.namn)?(far.agare.namn+' äger kopian'):(far.orsak||'kunde inte kontrollera ägaren')));
        return;}
    /* APPEN FORST, precis som dygnsbackupen gor. Den har vagen skrev bara till
       logikvariablerna medan bootSync laser APPENS backup i forsta hand - en
       andring sparades alltsa pa ett stalle och lastes fran ett annat, och
       skrevs over vid nasta start. Det var darfor vaggplattans knappar och matt
       gick tillbaka: variablerna hade det nya, appen det gamla, och appen vann.
       Mätt 2026-08-29: buttons_v1 var 1017 tkn lokalt och i variablerna, men
       804 tkn i appens backup. */
    var spara=function(){
      if(!appKan())return saveToHomey();
      return appBackupSpara(false).then(function(r){
        if(!r||!r.ok)return saveToHomey();   /* appen svarade inte - variablerna som reserv */
        /* SKRIV AVEN VARIABLERNA. De ar reservvag vid lasning, och lag de kvar
           gamla var de en tickande bomb: en hamtning som foll tillbaka pa dem
           tog med sig layouten fran den dag de senast skrevs. Misslyckas det
           gor det inget - appens kopia ar redan sparad. */
        return saveToHomey().then(function(){return r;},function(){return r;});
      },function(){return saveToHomey();});
    };
    spara().then(function(){_pushBusy=false;
      try{var b=bkpGet();b.len=len;b.llen=llen;b.t=Date.now();localStorage.setItem(BKP_KEY,JSON.stringify(b));}catch(e){}
      try{egetTsSatt(Date.now());}catch(e){}
      loggSkriv('push',{tecken:len});
      _pushForsok=0;
      syncNote('Sparat till Homey');},
      function(e){_pushBusy=false;
        if(!pushIgen('skrivningen misslyckades'+((e&&e.message)?(': '+e.message):'')))
          syncNote('Sparade inte – skrivningen misslyckades');});
    });},3000);
}catch(e){}}
function andradTs(){var v=0;try{v=parseInt(localStorage.getItem(ANDRAD_TS)||'0',10)||0;}catch(e){}return v;}
function andradSatt(t){try{localStorage.setItem(ANDRAD_TS,String(t||Date.now()));}catch(e){}}
function egetTs(){var v=0;try{v=parseInt(localStorage.getItem(EGET_TS)||'0',10)||0;}catch(e){}return v;}
function egetTsSatt(t){try{localStorage.setItem(EGET_TS,String(t||Date.now()));}catch(e){}}
function loggRad(vad,extra){
  var o={vad:vad,namn:enhetsNamn(),id:enhetsId(),at:Date.now(),ver:APP_VERSION};
  try{o.plats=location.host+location.pathname;}catch(e){}
  if(extra)for(var k in extra)o[k]=extra[k];
  return o;}
function loggSkriv(vad,extra){
  try{
    _loggKo.push(loggRad(vad,extra));
    if(_loggKo.length>5)_loggKo.shift();
    if(!appKan())return;
    appGet('/backup?key='+encodeURIComponent(LOGG_KEY)).then(function(raa){
      var lista=[];
      try{var v=(typeof raa==='string')?JSON.parse(raa):raa;if(Array.isArray(v))lista=v;}catch(e){}
      lista=lista.concat(_loggKo);_loggKo=[];
      if(lista.length>40)lista=lista.slice(lista.length-40);
      var kropp={};kropp[LOGG_KEY]=JSON.stringify(lista);
      appPost('/backup',kropp).catch(function(){});
    }).catch(function(){});
  }catch(e){}}
async function loggLas(){
  try{
    var raa=await appGet('/backup?key='+encodeURIComponent(LOGG_KEY));
    var v=(typeof raa==='string')?JSON.parse(raa):raa;
    return Array.isArray(v)?v:[];
  }catch(e){return [];}}
function loggText(rader){
  if(!rader||!rader.length)return 'Ingen skrivning loggad än. Loggen börjar fyllas från och med v481 — nästa gång något skrivs över står det här vem som gjorde det.';
  return rader.slice().reverse().map(function(r){
    var d=new Date(r.at||0);
    var kl=('0'+d.getDate()).slice(-2)+'/'+(d.getMonth()+1)+' '+('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);
    return kl+'  '+(r.namn||'?')+'  '+(r.vad||'?')
      +(r.nycklar!=null?('  '+r.nycklar+' nycklar'):'')
      +(r.tecken!=null?('  '+r.tecken+' tecken'):'')
      +(r.orsak?('  — '+r.orsak):'')
      +(r.ver?('  '+r.ver):'');
  }).join('\n');}
function agareStampel(manuell){
  return JSON.stringify({id:enhetsId(),namn:enhetsNamn(),at:Date.now(),manuell:!!manuell});}
function agareLas(o){
  try{
    var raa=o&&o[AGARE_KEY];
    if(raa==null)return null;
    return (typeof raa==='string')?JSON.parse(raa):raa;
  }catch(e){return null;}}
async function appGetIgen(vag){
  try{return await appGet(vag);}
  catch(e){await new Promise(function(r){setTimeout(r,1500);});return await appGet(vag);}}
/* Får DEN HÄR enheten skriva över det som ligger i Homey? */
async function agareFarSkriva(manuell){
  if(manuell)return {ok:true};              /* ett tryck är alltid ett beslut */
  /* FALLER STÄNGD. Tidigare gav varje fel här {ok:true}: gick nätet ner mitt i
     kontrollen, eller svarade appen långsamt vid den nattliga körningen, drog
     enheten slutsatsen att ingen ägde kopian och skrev över den med sina egna
     värden. En automatisk skrivning som inte kan bevisa att den får skriva ska
     avstå — nästa tick kommer om ett dygn, och ett manuellt tryck går alltid
     fram ändå. */
  try{
    if(!appKan())return {ok:true};          /* ingen app-väg alls: gamla vägen gäller */
    /* v744: ETT omförsök per anrop. Ett enda tappat anrop (moln­vägen som
       tar för lång tid, ett byte mellan lokalt och moln) stoppade sparningen. */
    var lista=await appGetIgen('/backup');
    if(!lista||!lista.nycklar)return {ok:false,orsak:'inget svar om vem som äger kopian'};
    if(!(AGARE_KEY in lista.nycklar))return {ok:true};   /* ingen har gjort anspråk */
    var a=agareLas({_agare_v1:await appGetIgen('/backup?key='+encodeURIComponent(AGARE_KEY))});
    if(!a)return {ok:false,orsak:'ägarstämpeln gick inte att läsa'};
    if(!a.manuell)return {ok:true};
    if(a.id===enhetsId())return {ok:true};
    return {ok:false,agare:a};
  }catch(e){return {ok:false,orsak:'kunde inte läsa ägarstämpeln: '+((e&&e.message)||'okänt')};}}

async function appBackupSpara(manuell){
  var obj={};
  for(var i=0;i<SYNC_KEYS.length;i++){
    var k=SYNC_KEYS[i], v=null;
    try{v=localStorage.getItem(k);}catch(e){}
    /* Layoutnycklar lagras under sitt eget fack sa att den andra enhetstypens
       layout star kvar orord i kopian. */
    if(DELADE_KEYS.indexOf(k)>=0)continue;      /* v738: se deladSkriv */
    if(v!=null)obj[syncKey(k)]=v;
  }
  var deladMed=deladSkriv(obj);
  /* Nar DET HAR facket senast skrevs. */
  obj[layoutTsKey()]=String(Date.now());
  if(!Object.keys(obj).length)return null;
  /* Stämpla ALLTID, men bara en manuell sparning låser. */
  obj[AGARE_KEY]=agareStampel(manuell);
  /* TIDSSTÄMPEL. Utan den går det inte att avgöra om en kopia man hämtar är
     nyare eller äldre än det man redan har — och då kan en gammal kopia skriva
     över en ny utan att någon märker det. */
  obj[TS_KEY]=String(Date.now());
  /* Samma vägval som resten — annars fungerar sparningen inte borta hemifrån. */
  var r=null,sist=null,vagar=brvVagar();
  for(var vi=0;vi<vagar.length;vi++){
    try{
      var t=withTimeout(15000);
      r=await fetch(vagar[vi]+'/api/app/'+APP_ID+'/backup',
        {method:'POST',headers:{Authorization:'Bearer '+(CONFIG.TOKEN||''),'Content-Type':'application/json'},
         body:JSON.stringify(obj),signal:t.signal});
      t.clear();
      if(!r.ok){sist=new Error(r.status+' '+r.statusText);r=null;continue;}
      if(vagar[vi]!==BASE){BASE=vagar[vi];_baseAt=Date.now();}
      break;
    }catch(e){sist=e;r=null;}
  }
  if(!r)throw (sist||new Error('ingen väg till Homey'));
  var j=await r.json();
  if(j&&j.result)j=j.result;
  egetTsSatt(Date.now());
  if(deladMed)deladSkrivet();
  loggSkriv(manuell?'manuell sparning':'automatisk sparning',
    {nycklar:Object.keys(obj).length,tecken:JSON.stringify(obj).length});
  return j;}
async function appBackupLas(){
  var lista=await appGet('/backup');
  _appLasSist={rap:0,las:0,hopp:[],fel:[],aldre:false,tom:false};
  if(!lista||!lista.nycklar||!Object.keys(lista.nycklar).length){_appLasSist.tom=true;return 0;}
  /* ÄR KOPIAN ÄLDRE ÄN DET DU SJÄLV SPARADE? Då hämtas den inte. Det var så
     knapparna försvann: en hämtning lade tillbaka ett äldre läge över ett
     nyare, tyst, och båda såg lika giltiga ut. */
  if(TS_KEY in lista.nycklar){
    var ts=0;
    try{ts=parseInt(await appGet('/backup?key='+encodeURIComponent(TS_KEY)),10)||0;}catch(e){}
    var eget=egetTs(), andrad=andradTs();
    if(ts&&eget&&ts<eget-60000){
      _appLasSist.aldre=true;
      loggSkriv('vägrade läsa',{orsak:'kopian är äldre än enhetens egen sparning'});
      return 0;
    }
    /* Osparade lokala ändringar väger tyngst av allt. Då ska kopian inte läsas —
       och den ska dessutom ersättas, annars står Homey kvar med det gamla och
       samma sak händer vid nästa öppning. */
    if(ts&&andrad&&ts<andrad-60000){
      _appLasSist.aldre=true;
      loggSkriv('vägrade läsa',{orsak:'lokala ändringar är nyare än kopian'});
      try{syncPushSoon();}catch(e){}
      return 0;
    }
  }
  var n=0;
  var nyttFormat=syncNyttFormat(lista.nycklar);
  lasProtStart('appens backup'+(nyttFormat?' (har fack)':' (gammal, utan fack)'));
  /* AR VART EGET FACK ALDRE AN VARA EGNA ANDRINGAR? Da ska layouten inte
     roras - resten av kopian far garna lasas, det ar loggar och matvarden. */
  var layoutHoppa=false, fackTs=0;
  try{
    if(layoutTsKey() in lista.nycklar){
      fackTs=parseInt(await appGet('/backup?key='+encodeURIComponent(layoutTsKey())),10)||0;
    }
    /* Saknas fackets stampel galler kopians egen - annars ar en gammal kopia
       helt oskyddad, och det var sa variabelkopian fran formiddagen kunde
       skriva over eftermiddagens andringar. */
    if(!fackTs&&(TS_KEY in lista.nycklar)){
      fackTs=parseInt(await appGet('/backup?key='+encodeURIComponent(TS_KEY)),10)||0;
    }
    var minAndring=andradTs();
    if(fackTs&&minAndring&&minAndring>fackTs+2000)layoutHoppa=true;
  }catch(e){}
  _appLasSist.rap=Object.keys(lista.nycklar).filter(function(x){return x!==AGARE_KEY&&x!==TS_KEY;}).length;
  /* Las var lokal nyckel ur SITT fack. Kopian innehaller nu bade
     buttons_v1__telefon och buttons_v1__platta; den har enheten ska bara se
     sin egen. Gamla osuffixade nycklar lases som reserv. */
  var dTs=0;
  try{if(DELAD_TS_KEY in lista.nycklar)dTs=parseInt(await appGet('/backup?key='+encodeURIComponent(DELAD_TS_KEY)),10)||0;}catch(e){}
  for(var ki=0;ki<SYNC_KEYS.length;ki++){
    var k=SYNC_KEYS[ki];
    var sk=syncKey(k);
    var finns=null;
    if(DELADE_KEYS.indexOf(k)>=0){
      /* v738: eget beslut, oberoende av layoutHoppa – se deladVal. */
      var dv=deladVal(k,function(x){return x in lista.nycklar;},dTs);
      var foreD=null;try{foreD=localStorage.getItem(k);}catch(e){}
      if(!dv.kalla){lasProtRad(k,'-',foreD,null,dv.hopp);continue;}
      try{
        var vd=await appGet('/backup?key='+encodeURIComponent(dv.kalla));
        if(vd!=null&&typeof vd!=='string'){try{vd=JSON.stringify(vd);}catch(e){vd='';}}
        if(vd&&vd.length){lasProtRad(k,dv.kalla,foreD,vd,'');localStorage.setItem(k,vd);n++;
          if(dv.ts)try{localStorage.setItem(DELAD_LOKAL,String(dv.ts));}catch(e){}}
      }catch(e){_appLasSist.fel.push(k);}
      continue;}
    if(sk in lista.nycklar)finns=sk;
    else if(sk===k&&(k in lista.nycklar))finns=k;
    else if(!nyttFormat&&(k in lista.nycklar))finns=k;   /* bara pa en gammal kopia */
    if(layoutHoppa&&LAYOUT_KEYS.indexOf(k)>=0){
      var foreH=null;try{foreH=localStorage.getItem(k);}catch(e){}
      lasProtRad(k,'-',foreH,null,'lokala ändringar är nyare än facket');
      continue;}
    if(!finns){
      _appLasSist.hopp.push(k);
      var fore0=null;try{fore0=localStorage.getItem(k);}catch(e){}
      lasProtRad(k,'-',fore0,null,nyttFormat?'kopian har fack, men inget för den här enheten':'saknas i kopian');
      continue;}
    try{
      var v=await appGet('/backup?key='+encodeURIComponent(finns));
      /* ACCEPTERA ÄVEN OBJEKT. appGet packar upp {result:…} och tolkar JSON, så
         ett sparat värde kan komma tillbaka som objekt i stället för sträng.
         Kravet på sträng lät nyckeln falla bort TYST — hämtningen såg ut att
         lyckas men ingenting ändrades. */
      if(v==null){_appLasSist.hopp.push(k);continue;}
      if(typeof v!=='string'){try{v=JSON.stringify(v);}catch(e){v='';}}
      /* SAMMA SKYDD SOM I fetchFromHomey. Hojderna ligger i fack per enhetstyp
         i EN nyckel, och den har vagen - backupen fran Homey-appen - gick forbi
         sammanfogningen i v540. Eftersom bootSync foredrar appen framfor
         logikvariablerna var det HAR vaggplattans hojd skrevs over, medan
         rattningen jag gjorde satt pa en vag som sallan anvands. */
      if(k==='secScale_v1')v=scaleSammanfoga(v);
      else if(k===ENH_KEY)v=enhSammanfoga(v);
      var fore1=null;try{fore1=localStorage.getItem(k);}catch(e){}
      lasProtRad(k,finns,fore1,v,'');
      if(v.length){localStorage.setItem(k,v);n++;}
      else _appLasSist.hopp.push(k);
    }catch(e){_appLasSist.fel.push(k);}
  }
  _appLasSist.las=n;
  lasProtSlut();
  if(n>0){try{Object.keys(TILESTATE).forEach(function(x){delete TILESTATE[x];});}catch(e){}}
  if(n>0){
    egetTsSatt(Date.now());
    /* Nu är lokalt och fjärran samma sak. Skrivningarna ovan har satt
       ändringsstämpeln via kroken; nolla den till samma tid så att nästa
       jämförelse inte tror att vi har något nyare. */
    andradSatt(Date.now());
    loggSkriv('läste från appen',{nycklar:n});
  }
  return n;}
async function saveToHomey(){
  /* Homey-variabler har begränsat utrymme. Vi delar upp datan i bitar. Om allt inte får
     plats sparar vi ALLTID de viktiga inställningarna och hoppar över de tyngsta loggarna
     (som kan byggas upp igen från livedata) i stället för att misslyckas helt. */
  const MAXCHUNKS=40;
  /* Loggar som kan återskapas - offras först om utrymmet inte räcker, störst först. */
  /* zam_v1 ligger MEDVETET inte här. Poängtavlan går inte att bygga upp igen:
     varje dygns dom måste fällas den dagen, ur trycket just då. Offrades den
     när backupen blev för stor försvann räkningen vid nästa gång enheten
     återställdes från Homey – det var därför antalet klara dygn nollställdes. */
  const DROPPABLE=['shmap_v2','health_v2','pressLog_v1','zpress_v1','tempEx_v1','windEx_v1','plog_v1','snow_v1','shcost_v1','emix_v1','recs_v1','hin_v1','days_v1'];
  /* Layoutnycklar lagras under sitt eget fack, som i appens backup. */
  /* v738: variabelkopian skrivs alltid hel (den andra enhetstypens fack
     följer inte med), så det delade facket och dess stämpel följer alltid med –
     läsaren tar det bara om stämpeln är nyare. */
  function build(skip){const o={};SYNC_KEYS.forEach(k=>{if(skip&&skip.indexOf(k)>=0)return;
      if(DELADE_KEYS.indexOf(k)>=0&&!deladTs())return;   /* aldrig delat härifrån: inget att säga */
      const v=localStorage.getItem(k);if(v!=null)o[syncKey(k)]=v;});
    if(deladTs())o[DELAD_TS_KEY]=String(deladTs());
    o[layoutTsKey()]=String(Date.now());return o;}
  let skip=[],obj=build(skip),str=JSON.stringify(obj),dropped=[];
  while(str.length>MAXCHUNKS*SYNC_CHUNK && DROPPABLE.length>skip.length){
    const next=DROPPABLE.find(k=>skip.indexOf(k)<0 && localStorage.getItem(k)!=null);
    if(!next)break;skip.push(next);dropped.push(next);obj=build(skip);str=JSON.stringify(obj);}
  const chunks=[];for(let i=0;i<str.length;i+=SYNC_CHUNK)chunks.push(str.slice(i,i+SYNC_CHUNK));
  if(!chunks.length)chunks.push('{}');
  if(chunks.length>MAXCHUNKS){const e=new Error('för mycket data ('+str.length+' tecken) - även efter att loggar rensats');e.tooBig=true;throw e;}
  const list=await logicList();
  const meta={v:1,n:chunks.length,t:Date.now(),len:str.length,dropped:dropped.length,dev:(typeof navigator!=='undefined'&&navigator.userAgent?navigator.userAgent.slice(0,48):'')};
  var SV=syncVar();
  /* Skriv bara de bitar som faktiskt ändrats. Vid upprepade sparningar är det oftast
     bara någon enstaka – det gör sparningen mycket snabbare och tåligare på mobil. */
  var cur={};logicArr(list).forEach(function(v){if(v&&v.name!=null)cur[v.name]=v.value;});
  var wrote=0;
  for(let i=0;i<chunks.length;i++){const nm=SV+'_'+i;
    if(cur[nm]===chunks[i])continue;
    await logicWrite(list,nm,chunks[i]);wrote++;}
  await logicWrite(list,SV,JSON.stringify(meta));
  meta.wrote=wrote;
  if(deladTs())deladSkrivet();   /* v738: det delade facket gick med */
  _syncMeta=meta;return meta;}
