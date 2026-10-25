/* js/insikter.js — Insikterna: kul-fakta, rekord, jämförelser, extremer och karusellen.
 *
 * Filen innehåller BARA funktionsdeklarationer. Konstanter, tillstånd och allt
 * som körs direkt vid laddning ligger i js/start.js, som laddas sist, under
 * rubriken [insikter.js]. En funktion går att anropa oavsett vilken fil den står
 * i, men kod som körs vid laddning kan här anropa en funktion i en fil som inte
 * hunnit laddas. Lägg den därför aldrig här.
 */


/* ===================== INSIKTER ===================== */
/* Läser riktiga capabilities; varje generator returnerar null om data saknas. */
function insSeason(m){ if(m>=3&&m<=5)return 'spring'; if(m>=6&&m<=8)return 'summer'; if(m>=9&&m<=11)return 'autumn'; return 'winter'; }
function insDaypart(h){ if(h>=5&&h<10)return 'morning'; if(h>=10&&h<16)return 'midday'; if(h>=16&&h<22)return 'evening'; return 'night'; }
function insNum(v,d){ return (v==null||isNaN(v))?null:Number(v).toFixed(d==null?0:d).replace('.',','); }
function insKwh(v){ return (v==null||!isFinite(v))?'–':String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g,'\u00a0'); }

function buildInsState(){
  var now=new Date(),S={};
  S.now=now; S.hour=now.getHours(); S.month=now.getMonth()+1; S.dow=now.getDay();
  S.season=insSeason(S.month); S.time=insDaypart(S.hour);
  S.weekend=(S.dow===0||S.dow===6);
  S.monName=INS_MON[S.month-1];
  /* effekt & sol */
  var hW=houseNowW(); S.powerKw=(hW==null?null:hW/1000);
  var sW=cap(DEV.solar,'measure_power'); S.solarKw=(sW==null?null:sW/1000);
  S.solDay=cap(DEV.solar,'meter_power.day');
  S.solMonth=cap(DEV.solar,'meter_power.month');
  S.solYear=cap(DEV.solar,'meter_power.year');
  S.solTotal=cap(DEV.solar,'meter_power');
  /* batteri */
  S.battSoc=cap(DEV.battery,'measure_battery');
  var bW=cap(DEV.battery,'measure_power'); S.battKw=(bW==null?null:bW/1000);
  S.battState=cap(DEV.battery,'battery_charging_state');
  /* nät (Pulse: export = negativt) */
  var pW=cap(DEV.pulse,'measure_power');
  S.gridKw=(pW==null?null:pW/1000);
  S.exportKw=(pW==null?null:(pW<0?Math.abs(pW)/1000:0));
  /* självförsörjning – samma logik som energipanelen */
  S.ownFrac=null;
  if(hW!=null&&hW>0){
    var solW=sW||0, disch=(S.battState==='discharging'&&bW!=null)?Math.abs(bW):0;
    S.ownFrac=Math.max(0,Math.min(hW,solW+disch))/hW;
  }else if(S.exportKw!=null&&S.exportKw>0){S.ownFrac=1;}
  S.selfPct=(S.ownFrac==null?null:Math.round(S.ownFrac*100));
  /* pris */
  S.priceNow=elprisNow();
  S.priceMin=elprisLo();
  S.priceMax=elprisHi();
  S.priceLevel=cap(DEV.tibber,'price_level')||cap(DEV.tibber,'measure_price_level');
  /* väder */
  S.tempOut=cap(DEV.outdoor,'measure_temperature'); if(S.tempOut==null)S.tempOut=cap(DEV.vader,'measure_temperature');
  S.feels=cap(DEV.smhi,'air_temperature_feels_like_cp');
  S.humOut=cap(DEV.outdoor,'measure_humidity');
  S.wind=vindMs(); if(S.wind==null)S.wind=cap(DEV.smhi,'measure_wind_speed_cp');
  S.gust=byMs();
  S.rain24=cap(DEV.rain,'measure_rain.24h'); if(S.rain24==null)S.rain24=cap(DEV.rain,'measure_rain');
  S.thunder=cap(DEV.smhi,'measure_thunder_probability_cp');
  S.press=cap(DEV.vader,'measure_pressure'); if(S.press==null)S.press=cap(DEV.smhi,'measure_air_pressure_cp');
  var ex=tempExtremes(S.tempOut); S.tMin=ex.min; S.tMax=ex.max;
  /* inne / uterum / pool */
  S.tempIn=cap(DEV.vard,'measure_temperature'); if(S.tempIn==null)S.tempIn=cap(DEV.vader,'measure_temperature');
  S.co2=cap(DEV.vader,'measure_co2');
  S.humIn=cap(DEV.vader,'measure_humidity');
  S.uterum=cap(DEV.uterum,'measure_temperature');
  S.uterumCo2=cap(DEV.uterum,'measure_co2');
  S.pool=cap(DEV.pooltemp,'measure_temperature');
  S.poolHeat=cap(DEV.poolheat,'onoff');
  /* bil & laddbox */
  S.evCharging=cap(DEV.laddbox,'evcharger_charging');
  S.evKw=(function(){var w=chargerW();return w==null?null:w/1000;})();
  S.carSoc=cap(DEV.car,'measure_battery'); if(S.carSoc==null)S.carSoc=cap(DEV.car2,'measure_battery');
  /* markis + disk */
  S.awning=cap(DEV.awning,'windowcoverings_state');
  S.dish=(typeof diskLage==='function')?(diskLage()==='kor'):cap(DEV.dish,'onoff');
  /* batteri-uthållighet */
  S.battKwh=(S.battSoc==null?null:Math.round(S.battSoc/100*9.8*10)/10);
  S.battHours=(S.battKwh!=null&&S.powerKw!=null&&S.powerKw>0.2)?Math.round(S.battKwh/S.powerKw*10)/10:null;
  return S;
}

/* Generatorer: returnerar {sc,g,k,c,big,lab,sub[,hero,delta,spark]} eller null */
/* ===== Kul-fakta: rotationsmotor =====
   Kul-fakta är per definition likvärdiga - ingen är "viktigare". Därför roterar de
   i stället för att rangordnas: fröet är dagsbaserat så urvalet ligger stilla hela
   dygnet (ingen flimmer vid refresh) men byts till nästa dag. */
function insRot(id){var k=dayKey()+'|'+id,h=2166136261;
  for(var i=0;i<k.length;i++){h^=k.charCodeAt(i);h=Math.imul(h,16777619);}
  return ((h>>>0)%1000)/1000;}
function kulSc(id){return 30+insRot(id)*20;}
/* Hur stor del av dygnets modellerade solenergi som redan hunnit intraffa, 0..1.
   Klockan duger inte - i december ar dagen slut kl 15, i juni pagar den till 22.
   Modellen vet, sa fraga den. Anvands for att halla tillbaka insikter som jamfor
   DAGENS produktion med ett dygnssnitt: kl 07 har vi 1 kWh mot ett snitt pa 80 och
   "Svag soldag -99%" ar tekniskt sant men rent brus. */
function dagAndel(){
  try{
    var nu=nowHour(), tot=0, so=0;
    for(var h=0;h<24;h++){var w=solTheoWAt(h); if(!(w>0))continue; tot+=w; if(h<=nu)so+=w;}
    return tot>0?Math.max(0,Math.min(1,so/tot)):1;
  }catch(e){return 1;}}
/* Solens högsta höjd över horisonten idag (samplad var 10:e minut) */
function sunPeak(){var now=new Date(),tz=-now.getTimezoneOffset(),best=null;
  for(var m=0;m<1440;m+=10){var a=solar(new Date(now.getFullYear(),now.getMonth(),now.getDate(),0,m),CONFIG.LAT,CONFIG.LON,tz);
    if(a&&a.elevation!=null&&(best==null||a.elevation>best))best=a.elevation;}
  return (best==null||!isFinite(best))?null:best;}
/* Hur många minuter soluppgången flyttat sig senaste veckan (+ = senare) */
function sunShift(){var now=new Date(),tz=-now.getTimezoneOffset();
  var a=solar(now,CONFIG.LAT,CONFIG.LON,tz),b=solar(new Date(now.getTime()-7*864e5),CONFIG.LAT,CONFIG.LON,tz);
  if(!a||!b||a.sunrise==null||b.sunrise==null)return null;
  var d=Math.round((a.sunrise-b.sunrise)*60);return isFinite(d)?{min:d,rise:a.sunrise}:null;}
/* Frostnätter i år ur dagsloggen */
function frostN(){var o=daysGet(),yr=dayKey().slice(0,4),n=0,tot=0;
  Object.keys(o).forEach(function(k){if(k.slice(0,4)!==yr)return;var e=o[k];
    if(!e||e.tn==null||!isFinite(e.tn))return;tot++;if(e.tn<0)n++;});
  return tot?{n:n,tot:tot}:null;}
/* Årets soligaste hela månad ur SEED_MONTHS */
function bestMonth(){var yr=String(new Date().getFullYear()),b=null;
  SEED_MONTHS.forEach(function(x){if(x.m.slice(0,4)!==yr||!(x.so>0))return;if(!b||x.so>b.so)b=x;});
  return b?{so:b.so,mon:INS_MON[+b.m.slice(5)-1]}:null;}
/* ===== Hjälpare för rekord/jämförelser/extremer ===== */
function dayLbl(k){var q=String(k).split('-');return (q.length<3)?String(k):((+q[2])+' '+INS_MON[+q[1]-1]);}
/* Färgen ska följa BETYDELSEN, inte räknetecknet.
   hib = högre är bättre · lib = lägre är bättre · neu = varken bra eller dåligt */
function dlt(v,u,pol,dec){
  if(v==null||!isFinite(v))return null;
  var t=(v>0?'+':(v<0?'\u2212':'\u00b1'))+insNum(Math.abs(v),dec==null?1:dec)+(u||'');
  var cls=(pol==='neu')?'ze':(pol==='lib'?(v>0?'dn':(v<0?'up':'ze')):(v>0?'up':(v<0?'dn':'ze')));
  return {t:t,cls:cls};}
function bestOf(field,lower,live){
  var o=daysGet(),R=recsGet(),tk=dayKey(),yr=tk.slice(0,4);
  var now=new Date(),doy=Math.floor((now-new Date(now.getFullYear(),0,0))/86400000);
  var best=null,n=0,extra=0;
  if(R&&R.y===+yr&&R[field]){best={v:R[field].v,d:R[field].d};n=R.n;}
  Object.keys(o).forEach(function(k){
    if(k.slice(0,4)!==yr)return;var e=o[k];if(!e||e[field]==null||!isFinite(e[field]))return;
    if(k!==tk&&(!R||!R.last||k>R.last))extra++;         /* täckning: bara avslutade dygn */
    if(!best||(lower?e[field]<best.v:e[field]>best.v))best={v:e[field],d:k};
  });
  /* dagens värde kan mycket väl VARA rekordet – annars blir rutan inaktuell */
  if(live!=null&&isFinite(live)&&(!best||(lower?live<best.v:live>best.v)))best={v:live,d:tk};
  if(!best)return null;
  var cov=n+extra,full=cov>=Math.max(60,(doy-1)*0.9);
  /* ett "rekord" utan avslutade dygn att slå har ingen jämf.grund - visa inte raden alls */
  if(cov<REC_MIN_DAYS)return null;
  return {v:best.v,d:best.d,n:cov,scope:full?'i år':('på '+cov+' dygn'),full:full,today:(best.d===tk)};}
/* Senast avslutade månaden mot samma månad i fjol (aldrig halva månader) */
function monthPair(){
  var lm=lastFullMonth();if(lm<1)return null;
  var y=new Date().getFullYear(),mm=('0'+lm).slice(-2);
  var a=null,b=null;
  SEED_MONTHS.forEach(function(x){if(x.m===y+'-'+mm)a=x;if(x.m===(y-1)+'-'+mm)b=x;});
  return (a&&b)?{cur:a,prev:b,mon:INS_MON[lm-1]}:null;}
/* Året hittills mot samma månader i fjol – bara hela månader */
function yearPair(){
  var lm=lastFullMonth();if(lm<1)return null;
  var y=new Date().getFullYear(),set=[];
  for(var i=1;i<=lm;i++)set.push(('0'+i).slice(-2));
  var a=periodAgg(y,set),b=periodAgg(y-1,set);
  if(!(a&&b&&a.n===lm&&b.n===lm))return null;
  /* periodAgg ger forbr/kopt/sald/prod/sol/batt – normalisera till samma korta
     nycklar som SEED_MONTHS (f/k/sa/p/so/b) så monthPair och yearPair läses lika */
  var norm=function(x){return {f:x.forbr,k:x.kopt,sa:x.sald,p:x.prod,so:x.sol,b:x.batt};};
  return {cur:norm(a),prev:norm(b),n:lm,lbl:(lm===1?'januari':('jan\u2013'+INS_MON[lm-1].slice(0,3)))};}
function pct(a,b){return (b>0)?Math.round((a/b-1)*100):null;}
/* Dagens längd + hur den ändrats sedan igår */
function dayLen(){
  var now=new Date(),tz=-now.getTimezoneOffset();
  var a=solar(now,CONFIG.LAT,CONFIG.LON,tz);
  if(!a||a.sunrise==null||a.sunset==null)return null;
  var b=solar(new Date(now.getTime()-864e5),CONFIG.LAT,CONFIG.LON,tz);
  var L=a.sunset-a.sunrise,d=(b&&b.sunrise!=null&&b.sunset!=null)?(L-(b.sunset-b.sunrise))*60:null;
  return {h:Math.floor(L),m:Math.round((L-Math.floor(L))*60),min:d,rise:a.sunrise,set:a.sunset};}
/* Största soleffekten idag ur 24h-historiken */
function solPeakToday(){
  var a=HIST['solar'];if(!a||!a.length)return null;
  var t0=dayStart(),bv=null,bt=null;
  for(var i=0;i<a.length;i++){if(a[i].t>=t0&&a[i].v!=null&&isFinite(a[i].v)&&(bv==null||a[i].v>bv)){bv=a[i].v;bt=a[i].t;}}
  if(bv==null||bv<200)return null;
  return {w:bv,at:new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',hour:'2-digit',minute:'2-digit'}).format(new Date(bt))};}
/* Lufttryckets förändring de senaste 3 timmarna */
function press3h(cur){
  if(cur==null)return null;var log=[];try{log=JSON.parse(localStorage.getItem('pressLog_v1')||'[]');}catch(e){}
  var now=Date.now(),old=null;
  for(var i=0;i<log.length;i++){if(now-log[i].t>=2.5*36e5&&(old==null||log[i].t>old.t))old=log[i];}
  return old?(cur-old.v):null;}
/* Dygnets temperatursvängning mot vad den brukar vara */
function swingToday(){
  var o=daysGet(),tk=dayKey(),e=o[tk];
  var mn=(e&&e.tn!=null)?e.tn:null,mx=(e&&e.tx!=null)?e.tx:null;
  var ex=tempExtremes(cap(DEV.outdoor,'measure_temperature'));
  if(ex.min!=null&&(mn==null||ex.min<mn))mn=ex.min;
  if(ex.max!=null&&(mx==null||ex.max>mx))mx=ex.max;
  if(mn==null||mx==null)return null;
  var sw=mx-mn,arr=[];
  Object.keys(o).forEach(function(k){if(k===tk)return;var q=o[k];if(q&&q.tx!=null&&q.tn!=null)arr.push(q.tx-q.tn);});
  var avg=arr.length>=5?arr.reduce(function(a,b){return a+b;},0)/arr.length:null;
  return {sw:sw,min:mn,max:mx,avg:avg,n:arr.length};}
function insHighlight(S){var out=[];
  for(var i=0;i<INS_HL.length;i++){try{var r=INS_HL[i](S);if(r&&r.big!=null&&(''+r.big).indexOf('null')<0)out.push(r);}catch(e){}}
  if(!out.length)return null;
  out.sort(function(a,b){return b.sc-a.sc;});return out[0];}
/* Karusellen i oversta rutan. Horisontell scroll med scroll-snap - det ger native
   svep pa touch utan en rad animationskod. Prickarna foljer med. */
function insCarHTML(car){
  if(!car.length)return '';
  var h='<section class="panel ins-hl ins-car" style="--hlc:'+(car[0].c||'var(--gold)')+'">';
  h+='<div class="ins-hl-glow"></div>';
  h+='<div class="ins-car-track" id="ins-car" onscroll="insCarDot()">';
  car.forEach(function(x){
    var hid='ih'+(_diN++);
    h+='<div class="ins-car-slide" data-hlc="'+(x.c||'var(--gold)')+'" onclick="insCarNollstall();diTog(\''+hid+'\')">';
    if(x.k)h+='<div class="ins-hl-ic">'+icon(x.k)+'</div>';
    h+='<div class="ins-hero-lab">'+esc(x.lab)+(x.info?'<span class="di-q">i</span>':'')+'</div>';
    h+='<div class="ins-hero-row"><div class="ins-hero-big">'+x.big+'</div>'
      +(x.delta?'<div class="ins-delta '+x.delta.cls+'">'+x.delta.t+'</div>':'')+'</div>';
    h+='<div class="ins-hero-txt">'+x.sub+'</div>';
    if(x.info)h+='<div class="ins-hero-info" id="'+hid+'">'+esc(x.info)+'</div>';
    h+='</div>';});
  h+='</div>';
  if(car.length>1){
    h+='<div class="ins-car-dots" id="ins-car-dots">';
    for(var i=0;i<car.length;i++)h+='<i class="ins-car-dot'+(i===_carIdx?' on':'')+'" onclick="insCarGo('+i+')"></i>';
    h+='</div>';}
  return h+'</section>';}
function insCarDot(){
  var t=$('ins-car'),d=$('ins-car-dots'); if(!t||!d||!t.clientWidth)return;
  var i=Math.round(t.scrollLeft/t.clientWidth); _carIdx=i;
  /* Scrollhändelsen kommer både från fingret och från vår egen scrollTo.
     Bara den förra ska nollställa timern — annars skulle den automatiska
     växlingen förlänga sig själv i all oändlighet. */
  if(!_carAuto)insCarNollstall();
  var ds=d.children; for(var j=0;j<ds.length;j++)ds[j].classList.toggle('on',j===i);
  var sl=t.children[i];var panel=t.parentElement;if(sl&&panel&&sl.getAttribute){var c=sl.getAttribute('data-hlc');if(c&&panel.style)panel.style.setProperty('--hlc',c);}}
function insCarGo(i,auto){
  var t=$('ins-car'); if(!t)return;
  _carIdx=i;
  if(auto){
    _carAuto=Date.now();
    /* Släpp flaggan när scrollen hunnit landa. En fast tid räcker; scrollend
       stöds inte överallt och en missad händelse skulle låsa flaggan. */
    setTimeout(function(){_carAuto=0;},900);
  }else{
    insCarNollstall();
  }
  t.scrollTo({left:i*t.clientWidth,behavior:'smooth'});}

/* Startar om nedräkningen. Anropas vid varje egen beröring av karusellen. */
function insCarNollstall(){
  if(_carTimer){clearInterval(_carTimer);_carTimer=null;}
  if(_carN<2)return;
  _carTimer=setInterval(function(){
    var t=$('ins-car');
    if(!t){clearInterval(_carTimer);_carTimer=null;return;}
    /* Växla inte medan sidan ligger i bakgrunden eller en popup är öppen —
       då hinner man aldrig läsa kortet man kom tillbaka till. */
    if(document.hidden)return;
    var bak=$('dlg-back');
    if(bak&&bak.classList&&bak.classList.contains('open'))return;
    insCarGo((_carIdx+1)%_carN,true);
  },CAR_MS);}

/* Återställer positionen efter en omritning. Utan behavior:smooth — det är en
   återställning av något som redan var, inte en förflyttning. */
function insCarAter(n){
  _carN=n||0;
  /* Klipp indexet FÖRE kontrollen av elementet. Görs det efter blir ett gammalt
     index kvar när karusellen just försvunnit, och nästa omritning börjar på
     ett kort som inte finns. */
  if(_carIdx>=_carN)_carIdx=0;
  var t=$('ins-car');
  if(!t){if(_carTimer){clearInterval(_carTimer);_carTimer=null;}return;}
  if(_carIdx>0&&t.clientWidth){
    _carAuto=Date.now();
    t.scrollLeft=_carIdx*t.clientWidth;
    setTimeout(function(){_carAuto=0;},50);
  }
  insCarMarkera();
  if(!_carTimer)insCarNollstall();}

/* Prickarna och färgen, utan att röra timern. */
function insCarMarkera(){
  var t=$('ins-car'),d=$('ins-car-dots'); if(!t)return;
  if(d){var ds=d.children;for(var j=0;j<ds.length;j++)ds[j].classList.toggle('on',j===_carIdx);}
  var sl=t.children[_carIdx],panel=t.parentElement;
  if(sl&&panel&&sl.getAttribute){var c=sl.getAttribute('data-hlc');
    if(c&&panel.style)panel.style.setProperty('--hlc',c);}}

function insSpark(vals,col){
  if(!vals||vals.length<2)return '';
  var W=560,H=50,mn=Math.min.apply(null,vals),mx=Math.max.apply(null,vals),r=(mx-mn)||1;
  var pts=vals.map(function(v,i){return [i/(vals.length-1)*W,H-4-((v-mn)/r)*(H-12)];});
  var d=smoothPath(pts);
  var gid='insg'+(_gid++);
  return '<svg class="ins-spark" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none"><defs><linearGradient id="'+gid+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+col+'" stop-opacity="0.28"/><stop offset="1" stop-color="'+col+'" stop-opacity="0"/></linearGradient></defs><path d="'+d+' L'+W+' '+H+' L0 '+H+' Z" fill="url(#'+gid+')"/><path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
function insRow(x){
  var id='ir'+(_diN++),d=x.d||null;
  return '<div class="irow" onclick="diTog(\''+id+'\')">'
    +'<span class="iic" style="color:'+x.c+'">'+icon(x.k)+'</span>'
    +'<div class="ibt"><div class="iline"><span class="ibig">'+x.big+'</span>'
    +'<span class="ilab">'+esc(x.lab)+'</span></div>'
    +'<div class="isub">'+x.sub+'</div></div>'
    +'<span class="iend">'+(d?('<span class="idelta '+d.cls+'">'+d.t+'</span>'):'')
    +'<span class="di-q">i</span></span></div>'
    +'<div class="drow-info" id="'+id+'">'+esc(x.info||'')+'</div>';
}
/* ---- Väder-sida: detaljer + konturkarta med vindriktning ---- */
function vdrTile(icn,lab,val,sub,col){
  return '<div class="vdr-tile"><span class="vdr-ic ic-slot" data-ic="'+icn+'" style="color:'+(col||'var(--blue)')+'"></span>'
    +'<div class="vdr-tv"><div class="vdr-val">'+val+'</div><div class="vdr-lab">'+lab+'</div>'
    +(sub?'<div class="vdr-sub">'+sub+'</div>':'')+'</div></div>';}
