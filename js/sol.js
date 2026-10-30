/* js/sol.js — Solen och priset: solmodellen, klimatologin, horisonten, tidsläget, externa källor, rumsrutornas värden, timpriserna och spotprisgrafen.
 *
 * Filen innehåller BARA funktionsdeklarationer. Konstanter, tillstånd och allt
 * som körs direkt vid laddning ligger i js/start.js, som laddas sist, under
 * rubriken [sol.js]. En funktion går att anropa oavsett vilken fil den står
 * i, men kod som körs vid laddning kan här anropa en funktion i en fil som inte
 * hunnit laddas. Lägg den därför aldrig här.
 */

function parsePct(s){if(s==null)return null;const m=(''+s).match(/(\d+)/);return m?Math.min(100,+m[1]):null;}
/* v726: Home Connect skickar återstående tid som "minuter:sekunder" ("280:00",
   "9:00") – se diskMinKvar. Den gamla regeln läste tal ≤ 24 som timmar:minuter,
   så "9:00" blev 9 h i popupen medan knappen (diskMinKvar) visade 9 min. */
function parseRemain(s){if(s==null)return null;const m=String(s).match(/^\s*(\d+):(\d+)/);if(!m)return null;return parseInt(m[1],10);}
function hhmm(d){return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);}
function finishTime(min){return hhmm(new Date(Date.now()+min*60000));}
function fmtHrs(h){if(h==null||!isFinite(h)||h<=0||h>48)return null;const total=Math.round(h*60),hh=Math.floor(total/60),mm=total%60;if(hh<=0)return mm+'m';return hh+'h'+(mm>0?' '+mm+'m':'');}
function battIcc(b,bs){
  if(b==null)return 'var(--ok)';
  const hue=Math.max(0,Math.min(120,(b/(200/3))*120));
  return 'hsl('+Math.round(hue)+',75%,45%)';}
function priceLevelSv(lvl){if(lvl==null||lvl==='')return '–';const m={VERY_CHEAP:'Mycket billigt',CHEAP:'Billigt',NORMAL:'Normalt',EXPENSIVE:'Dyrt',VERY_EXPENSIVE:'Mycket dyrt'};return m[(''+lvl).toUpperCase()]||(''+lvl);}
function carCharging(id){const st=(''+(cap(id,'ev_charging_state')||'')).toLowerCase();const sys=(''+(cap(id,'charging_system_status')||'')).toUpperCase();return st.indexOf('charging')>=0||sys==='CHARGING';}
function carPlugged(id){const st=(''+(cap(id,'ev_charging_state')||'')).toLowerCase();return carCharging(id)||st.indexOf('plugged_in')>=0||st.indexOf('connected')>=0;}
function carStatusSv(id){if(carCharging(id))return 'laddar';if(carPlugged(id))return 'inkopplad';return 'urkopplad';}
function chargerW(){const p=cap(DEV.laddbox,'measure_power');return (p==null)?null:Math.abs(p);}
function bilDrar(){var p=chargerW();if(p==null||!isFinite(p))return cap(DEV.laddbox,'evcharger_charging')===true;return p>=BIL_DRAR_W;}
function carHome(id){if(carCharging(id))return true;const d=cap(id,'distance');if(d==null)return false;const m=(''+d).match(/([\d.]+)\s*(km|m)\b/i);if(!m)return false;const meters=m[2].toLowerCase()==='km'?parseFloat(m[1])*1000:parseFloat(m[1]);return isFinite(meters)&&meters<=150;}
function battIcon(b){if(b==null)return 'battery-high';
  if(b>=90)return 'battery-full';
  if(b>=60)return 'battery-high';
  if(b>=30)return 'battery-medium';
  if(b>=5)return 'battery-low';
  return 'battery-empty';}
function battTimeStr(){const kwh=(CFG&&CFG.battkwh)||10,pw=cap(DEV.battery,'measure_power'),pct=cap(DEV.battery,'measure_battery'),bs=cap(DEV.battery,'battery_charging_state');
  if(pw==null||pct==null||Math.abs(pw)<60)return null;
  if(bs==='discharging'){const t=fmtHrs((pct/100*kwh)/(Math.abs(pw)/1000));return t?t+' kvar':null;}
  if(bs==='charging'){const t=fmtHrs(((100-pct)/100*kwh)/(Math.abs(pw)/1000));return t||null;}
  return null;}
function solShade(sh,az){
  if(az<=sh[0][0])return sh[0][1];
  if(az>=sh[sh.length-1][0])return sh[sh.length-1][1];
  for(var i=0;i<sh.length-1;i++){var a0=sh[i][0],f0=sh[i][1],a1=sh[i+1][0],f1=sh[i+1][1];
    if(az>=a0&&az<=a1)return f0+(f1-f0)*(az-a0)/(a1-a0);}
  return 1;}
function solDniClear(el){var e=el*Math.PI/180;
  var am=1/(Math.sin(e)+0.50572*Math.pow(el+6.07995,-1.6364));
  return SOL_DNI_A*Math.exp(-SOL_DNI_B*Math.pow(am,SOL_DNI_C));}
function solDhiClear(el){return SOL_DA*1353*Math.pow(Math.sin(el*Math.PI/180),SOL_DP);}
/* POA med GIVEN stralning - samma geometri som solPoa, men kan matas med
   molnviktad stralning i stallet for klarhimmel. */
function solPoaAt(el,az,tilt,gam,dni,dhi){
  if(el<=0)return 0;
  var e=el*Math.PI/180,b=tilt*Math.PI/180;
  var c=Math.sin(e)*Math.cos(b)+Math.cos(e)*Math.sin(b)*Math.cos((az-gam)*Math.PI/180);
  return dni*Math.max(0,c)+dhi*(1+Math.cos(b))/2;}
/* Anlaggningens effekt (W) vid given stralning och given gruppuppsattning. */
function solPlantW(el,az,dni,dhi,tamb,groups){
  if(!(el>0.5))return 0;
  var sum=0,pw=0;
  for(var i=0;i<groups.length;i++){var G=groups[i];
    var p=solPoaAt(el,az,G.tilt,G.az,dni,dhi);
    pw+=G.n*p; sum+=G.n*SOL_WP*p*solShade(G.sh,az);}
  if(tamb==null||!isFinite(tamb))tamb=15;
  var eff=1+SOL_GAMMA*((tamb+(SOL_NOCT-20)/800*(pw/48))-25);
  var w=SOL_K*sum*eff; return (isFinite(w)&&w>0)?w:0;}
function solPoa(el,az,tilt,gam){
  if(el<=0)return 0;
  var e=el*Math.PI/180,b=tilt*Math.PI/180;
  var dni=solDniClear(el);
  var dhi=solDhiClear(el);
  var c=Math.sin(e)*Math.cos(b)+Math.cos(e)*Math.sin(b)*Math.cos((az-gam)*Math.PI/180);
  /* stralen via cosinuslagen, diffusen via himmelsvyfaktorn - de traffar
     ett lutande tak helt olika, vilket var precis felet i forra forsoket */
  return dni*Math.max(0,c)+dhi*(1+Math.cos(b))/2;}
/* Horisontskuggan vid låg sol, 0,05–1. Tabellen (SOL_HOR_*) står i start.js
   och är densamma som i appens lib/sol.js – de två ska räkna exakt lika. */
function solHorisont(el,az){
  var A,B,n=SOL_HOR_AZ.length;
  if(az<=SOL_HOR_AZ[0]){A=SOL_HOR_A[0];B=SOL_HOR_B[0];}
  else if(az>=SOL_HOR_AZ[n-1]){A=SOL_HOR_A[n-1];B=SOL_HOR_B[n-1];}
  else{for(var i=0;i<n-1;i++){if(az<=SOL_HOR_AZ[i+1]){var f=(az-SOL_HOR_AZ[i])/(SOL_HOR_AZ[i+1]-SOL_HOR_AZ[i]);
    A=SOL_HOR_A[i]+(SOL_HOR_A[i+1]-SOL_HOR_A[i])*f;B=SOL_HOR_B[i]+(SOL_HOR_B[i+1]-SOL_HOR_B[i])*f;break;}}}
  return Math.max(0.05,1-A*Math.exp(-el/B));}
/* Klarhimmelseffekt (W) vid en tidpunkt. tamb = utetemp for celltemperaturen. */
function solClearW(date,tamb){
  var sc=solar(date,CONFIG.LAT,CONFIG.LON,-date.getTimezoneOffset());
  var el=sc.elevation,az=sc.azimuth;
  if(el==null||!isFinite(el)||el<=0.5)return 0;
  var sum=0,pw=0;
  for(var i=0;i<SOL_GROUPS.length;i++){var G=SOL_GROUPS[i];
    var p=solPoa(el,az,G.tilt,G.az);
    pw+=G.n*p; sum+=G.n*SOL_WP*p*solShade(G.sh,az);}
  if(tamb==null||!isFinite(tamb))tamb=15;
  var eff=1+SOL_GAMMA*((tamb+(SOL_NOCT-20)/800*(pw/48))-25);
  var w=SOL_K*sum*eff*solHorisont(el,az);
  return (isFinite(w)&&w>0)?w:0;}
function solTheoW(){return solClearW(new Date(),cap(DEV.outdoor,'measure_temperature'));}
/* Klarhimmelseffekt UTAN skuggkorrigering - skillnaden mot solClearW ar skuggforlusten */
function solClearNoShadeW(date,tamb){
  var sc=solar(date,CONFIG.LAT,CONFIG.LON,-date.getTimezoneOffset());
  var el=sc.elevation,az=sc.azimuth;
  if(el==null||!isFinite(el)||el<=0.5)return 0;
  var sum=0,pw=0;
  for(var i=0;i<SOL_GROUPS.length;i++){var G=SOL_GROUPS[i];
    var q=solPoa(el,az,G.tilt,G.az); pw+=G.n*q; sum+=G.n*SOL_WP*q;}
  if(tamb==null||!isFinite(tamb))tamb=15;
  var eff=1+SOL_GAMMA*((tamb+(SOL_NOCT-20)/800*(pw/48))-25);
  var w=SOL_K*sum*eff; return (isFinite(w)&&w>0)?w:0;}
function climMap(){ if(_climMap)return _climMap;
  var m={}; for(var i=0;i<SOL_CLIM.length;i+=3)m[SOL_CLIM[i]]=[SOL_CLIM[i+1]/100,SOL_CLIM[i+2]/100];
  _climMap=m; return m;}
function solClim(az,el){
  var m=climMap(),azb=Math.floor(az/10),elb=Math.floor(el/5),k=azb*100+elb;
  if(m[k])return m[k];
  var best=null,bd=1e9,kk,a,e;
  for(kk in m){a=Math.floor(kk/100); if(a!==azb)continue; e=kk%100;
    if(Math.abs(e-elb)<bd){bd=Math.abs(e-elb);best=m[kk];}}
  if(best)return best;
  bd=1e9;
  for(kk in m){e=kk%100; if(e!==elb)continue; a=Math.floor(kk/100);
    if(Math.abs(a-azb)<bd){bd=Math.abs(a-azb);best=m[kk];}}
  return best||[0.2,1.3];}
function hinderAv(az){for(var i=0;i<SOL_HINDER.length;i++){if(az>=SOL_HINDER[i][1]&&az<SOL_HINDER[i][2])return SOL_HINDER[i][0];}
  return SOL_HINDER[SOL_HINDER.length-1][0];}
function groupsUtan(namn){return SOL_GROUPS.map(function(G){
  return {n:G.n,tilt:G.tilt,az:G.az,sh:G.sh.map(function(p){
    return [p[0], namn.indexOf(hinderAv(p[0]))>=0 ? 1.0 : p[1]];})};});}
function hinderBer(){
  var namn=SOL_HINDER.map(function(h){return h[0];});
  var G0=SOL_GROUPS, GU=namn.map(function(n){return groupsUtan([n]);});
  var GN=groupsUtan(namn);
  var prod=0,klar=0,tot=0,klarTot=0,per=namn.map(function(){return 0;});
  var dt=HIN_STEG/60, t=new Date(2025,0,1,0,0,0,0).getTime(), slut=new Date(2026,0,1,0,0,0,0).getTime();
  for(;t<slut;t+=HIN_STEG*60000){
    var d=new Date(t), sc=solar(d,CONFIG.LAT,CONFIG.LON,-d.getTimezoneOffset());
    var el=sc.elevation,az=sc.azimuth;
    if(el==null||!isFinite(el)||el<=0.5)continue;
    var c=solClim(az,el), tamb=SOL_TAMB[d.getMonth()];
    var dni=solDniClear(el)*c[0], dhi=solDhiClear(el)*c[1];
    var b=solPlantW(el,az,dni,dhi,tamb,G0);
    prod+=b*dt;
    var kb=solPlantW(el,az,solDniClear(el),solDhiClear(el),tamb,G0);
    klar+=kb*dt;
    klarTot+=(solPlantW(el,az,solDniClear(el),solDhiClear(el),tamb,GN)-kb)*dt;
    tot+=(solPlantW(el,az,dni,dhi,tamb,GN)-b)*dt;
    for(var i=0;i<GU.length;i++)per[i]+=(solPlantW(el,az,dni,dhi,tamb,GU[i])-b)*dt;
  }
  var o={prod:prod/1000, klar:klar/1000, tot:tot/1000, klarTot:klarTot/1000, hinder:{}};
  namn.forEach(function(n,i){o.hinder[n]=per[i]/1000;});
  return o;}
function hinderAr(){
  if(_hinC)return _hinC;
  var sig=APP_VERSION+'|'+JSON.stringify(SOL_GROUPS)+'|'+SOL_K+'|'+SOL_DA+'|'+SOL_HINDER.length;
  try{var c=JSON.parse(localStorage.getItem(HIN_KEY)); if(c&&c.sig===sig){_hinC=c.v;return _hinC;}}catch(e){}
  var v=hinderBer(); _hinC=v;
  try{localStorage.setItem(HIN_KEY,JSON.stringify({sig:sig,v:v}));}catch(e){}
  return v;}
function prisTotNu(){var p=elprisNow();
  return (p!=null&&isFinite(p)&&p>0)?p:PRIS_AR_TOT;}
function prisSatser(){
  var tot=PRIS_AR_TOT;                       /* arskostnad -> arsmedelpris, inte just nu */
  var spot=Math.max(0,tot/1.25-PRIS_ESKATT);
  return {egen:tot+PRIS_NAT, salt:spot+PRIS_NATNYTTA};}
function clearRatio(){
  var p=cap(DEV.solar,'measure_power'), th=solTheoW();
  if(p==null||!isFinite(p)||!isFinite(th)||th<SOLM_MIN_W)return null;
  var r=p/th; return (isFinite(r)&&r>=0)?r:null;}
function sunAzEl(){
  var d=new Date(),sc=solar(d,CONFIG.LAT,CONFIG.LON,-d.getTimezoneOffset());
  if(!sc||sc.elevation==null||!isFinite(sc.elevation))return null;
  return {az:sc.azimuth,el:sc.elevation};}
function shmCell(az,el){return (Math.floor(az/SHM_AZB)*100+Math.floor(el/SHM_ELB));}
function shmGet(){try{return JSON.parse(localStorage.getItem(SHM_KEY))||{};}catch(e){return {};}}
function shmTick(){
  var r=clearRatio(); if(r==null)return;
  var s=sunAzEl(); if(!s||s.el<=3)return;
  var o=shmGet(),k=String(shmCell(s.az,s.el)),c=o[k]||[0,0];
  var v=Math.round(Math.min(1.3,r)*100);
  o[k]=[Math.max(c[0],v), Math.min(65000,c[1]+1)];
  try{localStorage.setItem(SHM_KEY,JSON.stringify(o));}catch(e){}}
/* Skuggfaktor UR MATNINGEN (ej ur modellen). null = for lite data an. */
function shmFactor(az,el){
  var o=shmGet(),c=o[String(shmCell(az,el))];
  if(!c||c[1]<SHM_MINN)return null;
  return c[0]/100;}
function shmDemoMap(){      /* syntetisk karta - bara for demolaget */
  var m={};
  for(var a=40;a<330;a+=10){for(var e=0;e<62;e+=5){
    var f=1.0;
    if(a>=240&&a<=290&&e<=18)f=0.35+0.02*e;              /* tradridan i vaster */
    else if(a>=80&&a<=120&&e<=10)f=0.55+0.03*e;          /* nagot lagt i oster */
    else if(a>=295&&a<=320&&e<=8)f=0.5;
    m[String(Math.floor(a/10)*100+Math.floor(e/5))]=[Math.round(Math.min(1,f)*100),60];
  }}
  return m;}
function isDemo(){return (typeof SOURCE!=='undefined'&&SOURCE==='demo-data');}
function shmEff(){return isDemo()?shmDemoMap():shmGet();}
/* Horisonthojd per azimut, ur mogna celler. [{az,el}] */
function shmHorizon(){
  var o=shmEff(),by={};
  Object.keys(o).forEach(function(k){
    var c=o[k]; if(!c||c[1]<SHM_MINN)return;
    var n=+k, ab=Math.floor(n/100), eb=n%100;
    var az=ab*SHM_AZB+SHM_AZB/2, el=eb*SHM_ELB;
    if(!by[ab])by[ab]={az:az,h:0,any:false};
    by[ab].any=true;
    if(c[0]/100<SHM_SHADED && el+SHM_ELB>by[ab].h)by[ab].h=el+SHM_ELB;
  });
  var out=[];Object.keys(by).sort(function(a,b){return a-b;}).forEach(function(k){
    if(by[k].any)out.push({az:by[k].az,el:by[k].h});});
  return out;}
function shmReady(){return shmHorizon().length>=SHM_READY_AZ;}
/* Horisonten sedd fran panelerna. Tanken ar att det ska ga att lasa som en bild:
   himlen bakom, den morka siluetten av trad och hus framfor, och solens bana
   tvars over. Dar banan gar bakom siluetten ar den streckad och blek - da star
   solen bakom nagot. Klockslagen langs banan visar NAR solen ar var. */
function shmSunDay(H,dt){
  var d=dt||new Date(), tz=-d.getTimezoneOffset(), out=[];
  for(var m=0;m<1440;m+=5){
    var t=new Date(d.getFullYear(),d.getMonth(),d.getDate(),0,m);
    var sc=solar(t,CONFIG.LAT,CONFIG.LON,tz);
    if(!sc||sc.elevation==null)continue;
    var hz=shmHorizonAt(H,sc.azimuth);
    out.push({m:m,az:sc.azimuth,el:sc.elevation,hz:hz,up:sc.elevation>0,free:sc.elevation>hz});
  }
  return out;}
/* Nar slapper horisonten fram solen, och hur mycket stjal den? */
function shmSunStats(pts){
  var upp=null,ner=null,f0=null,f1=null,fri=0;
  for(var i=0;i<pts.length;i++){var p=pts[i];
    if(p.up){if(upp==null)upp=p.m; ner=p.m;}
    if(p.up&&p.free){if(f0==null)f0=p.m; f1=p.m; fri+=5;}}
  return {upp:upp,ner:ner,f0:f0,f1:f1,fri:fri,
          morgon:(f0!=null&&upp!=null)?f0-upp:null,
          kvall:(f1!=null&&ner!=null)?ner-f1:null};}
function shmKl(m){if(m==null)return '–';
  return String(Math.floor(m/60)).padStart(2,'0')+':'+String(Math.round(m)%60).padStart(2,'0');}
function shmDur(m){if(m==null)return '–';
  var t=Math.floor(m/60),r=Math.round(m)%60;
  return t?(t+' h'+(r?' '+r+' min':'')):(r+' min');}
function shmSVG(){
  var H=shmHorizon(); if(!H.length)return '';
  var W=560,Ht=196,pl=30,pr=10,pt=12,pb=20, A0=30,A1=330, E1=62;
  var X=function(a){return pl+(Math.max(A0,Math.min(A1,a))-A0)/(A1-A0)*(W-pl-pr);};
  var Y=function(e){return pt+(1-Math.max(0,Math.min(E1,e))/E1)*(Ht-pt-pb);};
  var y0=Y(0);
  var g='<defs>'
   +'<linearGradient id="shSky" x1="0" y1="0" x2="0" y2="1">'
   +'<stop offset="0" stop-color="var(--blue)" stop-opacity=".22"/>'
   +'<stop offset=".62" stop-color="var(--blue)" stop-opacity=".07"/>'
   +'<stop offset="1" stop-color="var(--gold)" stop-opacity=".14"/></linearGradient>'
   +'<clipPath id="shClip"><rect x="'+pl+'" y="'+pt+'" width="'+(W-pl-pr)+'" height="'+(y0-pt)+'"/></clipPath>'
   +'</defs>';
  /* Himlen bakom allt */
  g+='<rect x="'+pl+'" y="'+pt+'" width="'+(W-pl-pr)+'" height="'+(y0-pt)+'" fill="url(#shSky)" rx="3"/>';
  /* Hojdlinjer */
  for(var e=15;e<=60;e+=15){
    g+='<line x1="'+pl+'" y1="'+Y(e)+'" x2="'+(W-pr)+'" y2="'+Y(e)+'" stroke="var(--line)" stroke-width="1" opacity=".45"/>'
      +'<text x="'+(pl-5)+'" y="'+(Y(e)+3)+'" text-anchor="end" font-size="9" fill="var(--faint)">'+e+'°</text>';}
  g+='<text x="'+(pl-5)+'" y="'+(y0+3)+'" text-anchor="end" font-size="9" fill="var(--faint)">0°</text>';
  /* Vaderstreck */
  var vs=[[45,'NO'],[90,'Ö'],[135,'SÖ'],[180,'S'],[225,'SV'],[270,'V'],[315,'NV']];
  for(var i=0;i<vs.length;i++){var vx=X(vs[i][0]);
    g+='<line x1="'+vx+'" y1="'+pt+'" x2="'+vx+'" y2="'+y0+'" stroke="var(--line)" stroke-width="1" opacity="'+(vs[i][0]===180?'.75':'.32')+'"/>'
      +'<text x="'+vx+'" y="'+(Ht-5)+'" text-anchor="middle" font-size="9.5" font-weight="'+(vs[i][0]===180?'800':'600')+'" fill="var(--faint)">'+vs[i][1]+'</text>';}
  var pts=shmSunDay(H), st=shmSunStats(pts);
  /* Siluetten: fylld mark med ljusare overkant, sa den lasas som landskap */
  var poly=pl+','+y0, line='';
  for(var k=0;k<H.length;k++){
    var px=X(H[k].az),py=Y(H[k].el);
    poly+=' '+px.toFixed(1)+','+py.toFixed(1);
    line+=(k?'L':'M')+px.toFixed(1)+','+py.toFixed(1);}
  poly+=' '+(W-pr)+','+y0;
  g+='<polygon points="'+poly+'" fill="var(--ink)" opacity=".8"/>'
    +'<path d="'+line+'" fill="none" stroke="var(--gold)" stroke-width="1.4" opacity=".45"/>';
  /* Solbanan, uppdelad i fri och skymd */
  var segs=[],cur=null;
  for(var s2=0;s2<pts.length;s2++){var p=pts[s2];
    if(!p.up||p.az<A0||p.az>A1){cur=null;continue;}
    if(!cur||cur.free!==p.free){
      if(cur&&cur.pts.length)cur.pts.push([X(p.az),Y(p.el)]);   /* skarva ihop */
      cur={free:p.free,pts:[]};segs.push(cur);}
    cur.pts.push([X(p.az),Y(p.el)]);}
  for(var s3=0;s3<segs.length;s3++){var sg=segs[s3];
    if(sg.pts.length<2)continue;
    var dd='M'+sg.pts[0][0].toFixed(1)+','+sg.pts[0][1].toFixed(1);
    for(var q=1;q<sg.pts.length;q++)dd+='L'+sg.pts[q][0].toFixed(1)+','+sg.pts[q][1].toFixed(1);
    g+=sg.free
      ? '<path d="'+dd+'" fill="none" stroke="var(--gold)" stroke-width="3" stroke-linecap="round"/>'
      : '<path d="'+dd+'" fill="none" stroke="var(--gold)" stroke-width="2" stroke-dasharray="3 4" opacity=".38" stroke-linecap="round"/>';}
  /* Hela timmar langs banan – utan dem gar det inte att se NAR solen ar var */
  for(var t2=0;t2<pts.length;t2++){var p2=pts[t2];
    if(p2.m%60||!p2.up||p2.az<A0||p2.az>A1)continue;
    var hx=X(p2.az),hy=Y(p2.el),hh=p2.m/60;
    g+='<circle cx="'+hx.toFixed(1)+'" cy="'+hy.toFixed(1)+'" r="'+(p2.free?2.4:1.8)+'" fill="var(--gold)" opacity="'+(p2.free?'1':'.4')+'"/>';
    if(hh%3===0)g+='<text x="'+hx.toFixed(1)+'" y="'+(hy-7).toFixed(1)+'" text-anchor="middle" font-size="8.5" font-weight="700" fill="var(--faint)">'+hh+'</text>';}
  /* Dar solen slapps fram och dar den forsvinner */
  var mark=function(m,txt,upp){
    if(m==null)return '';
    var best=null;for(var i2=0;i2<pts.length;i2++)if(pts[i2].m===m)best=pts[i2];
    if(!best||best.az<A0||best.az>A1)return '';
    var mx=X(best.az),my=Y(best.el);
    return '<circle cx="'+mx.toFixed(1)+'" cy="'+my.toFixed(1)+'" r="6.5" fill="var(--gold)" stroke="var(--card)" stroke-width="2"/>'
      +'<text x="'+mx.toFixed(1)+'" y="'+(my+(upp?-13:20)).toFixed(1)+'" text-anchor="middle" font-size="9.5" font-weight="800" fill="var(--gold)">'+txt+'</text>';};
  g+=mark(st.f0,shmKl(st.f0),true)+mark(st.f1,shmKl(st.f1),false);
  /* Var solen star just nu */
  var nu=new Date(),nm=nu.getHours()*60+nu.getMinutes(),nb=null;
  for(var i3=0;i3<pts.length;i3++)if(Math.abs(pts[i3].m-nm)<=2.5)nb=pts[i3];
  if(nb&&nb.up&&nb.az>=A0&&nb.az<=A1){
    var nx=X(nb.az),ny=Y(nb.el);
    g+='<circle cx="'+nx.toFixed(1)+'" cy="'+ny.toFixed(1)+'" r="11" fill="var(--gold)" opacity=".22"/>'
      +'<circle cx="'+nx.toFixed(1)+'" cy="'+ny.toFixed(1)+'" r="5" fill="var(--gold)" stroke="var(--card)" stroke-width="1.5"/>';}
  var hog=0,hogAz=null;
  for(var i4=0;i4<H.length;i4++)if(H[i4].el>hog){hog=H[i4].el;hogAz=H[i4].az;}
  var sum='<div class="shm-sum">'
    +'<span><b>'+shmKl(st.f0)+'–'+shmKl(st.f1)+'</b> fri sol</span>'
    +'<span><b>'+shmDur(st.fri)+'</b> totalt</span>'
    +(st.morgon?'<span>horisonten stjäl <b>'+shmDur(st.morgon)+'</b> på morgonen</span>':'')
    +(st.kvall?'<span><b>'+shmDur(st.kvall)+'</b> på kvällen</span>':'')
    +(hog>0?'<span>högsta hindret <b>'+Math.round(hog)+'°</b> mot '+windAbbr(hogAz)+'</span>':'')
    +'</div>';
  return '<svg viewBox="0 0 '+W+' '+Ht+'" style="width:100%;height:auto" role="img" '
    +'aria-label="Horisontens höjd runt huset och solens bana idag">'+g+'</svg>'+sum;}
function shmHorizonAt(H,az){
  var best=0;for(var i=0;i<H.length;i++){if(Math.abs(H[i].az-az)<=SHM_AZB/2)best=H[i].el;}return best;}
function shmCoverage(){var o=shmGet(),n=0,tot=0;
  Object.keys(o).forEach(function(k){tot++;if(o[k][1]>=SHM_MINN)n++;});
  return {mogna:n,celler:tot};}
/* Molnindex: 0 = klart, 1 = helmulet. Skuggan normaliseras bort. */
function cloudNow(){
  var r=clearRatio(); if(r==null)return null;
  var s=sunAzEl(); if(!s)return null;
  var f=shmFactor(s.az,s.el), base=(f!=null&&f>0.2)?f:1;
  var c=1-r/base; return Math.max(0,Math.min(1,c));}
/* Skuggforlust just nu, W */
function shadeLossW(){
  var d=new Date(),t=cap(DEV.outdoor,'measure_temperature');
  var l=solClearNoShadeW(d,t)-solClearW(d,t);
  return (isFinite(l)&&l>0)?l:0;}
function hltGet(){try{return JSON.parse(localStorage.getItem(HLT_KEY))||{};}catch(e){return {};}}
function hltTick(){
  var r=clearRatio(); if(r==null)return;
  var s=sunAzEl(); if(!s||s.el<20)return;      /* bara hog sol - lag sol ar skuggkanslig */
  var f=shmFactor(s.az,s.el); if(f!=null&&f<0.9)return;  /* hoppa over skuggade celler */
  var o=hltGet(),k=dayKey(),v=Math.round(Math.min(1.3,r)*100);
  if(!(o[k]>v))o[k]=v;
  var ks=Object.keys(o).sort();
  while(ks.length>HLT_KEEP){delete o[ks.shift()];}
  try{localStorage.setItem(HLT_KEY,JSON.stringify(o));}catch(e){}}
function solPerfPct(){const p=cap(DEV.solar,'measure_power');const theo=solTheoW();if(p==null||theo<400)return null;return Math.min(140,Math.round(p/theo*100));}
/* ===== Tidsläge: historik bakåt, prognos framåt ===== */
function dayStart(){const d=new Date();d.setHours(0,0,0,0);return d.getTime();}
function nowHour(){return (Date.now()-dayStart())/3600000;}
/* v767: timmar sedan dagens midnatt i KLOCKTID – samma mått som prisgrafens
   x-axel och pgTimmenNu. (t-midnatt)/3600000 räknar verkliga timmar, och de
   dagar sommartiden slutar eller börjar skiljer de sig en timme efter kl 03:
   batterilinjen hamnade då en timme till höger om nu-strecket. Dagar efter
   i dag räknas som 24, 48 … plus klockslaget. */
function klockTimmar(t){var d=new Date(t),m=new Date(dayStart());
  var dagar=Math.round((new Date(d.getFullYear(),d.getMonth(),d.getDate())-m)/86400000);
  return dagar*24+d.getHours()+d.getMinutes()/60+d.getSeconds()/3600;}
function solTheoWAt(h){return solClearW(new Date(dayStart()+h*3600000),cap(DEV.outdoor,'measure_temperature'));}
function solPerfRatioToday(){const a=HIST['solar'];if(!a||!a.length)return null;const t0=dayStart(),nh=nowHour();let n=0,d=0;
  for(const p of a){const h=(p.t-t0)/3600000;if(h<0||h>nh)continue;const theo=solTheoWAt(h);if(theo>500){n+=p.v;d+=theo;}}
  if(d<1500)return null;return Math.max(0,Math.min(1.25,n/d));}
function predSolarW(h){const theo=solTheoWAt(h);if(theo<=0)return 0;const cl=cloudFactorAt(h);let w;
  if(cl!=null){w=theo*kastenCzeplak(cl);}else{let r=solPerfRatioToday();if(r==null){const perf=solPerfPct();r=(perf!=null)?perf/100:0.55;}w=theo*r;}
  return Math.round(w);}
function avgHouseW(){const a=HIST['house'];let base=1000;if(a&&a.length){const now=Date.now();let rec=a.filter(p=>now-p.t<=2*3600000).map(p=>p.v);if(!rec.length)rec=a.slice(-12).map(p=>p.v);rec.sort((x,y)=>x-y);base=rec[Math.floor(rec.length/2)]||1000;}
  const chg=chargerW(),carHigh=((capLive(DEV.car,'measure_battery')||0)>=85||(capLive(DEV.car2,'measure_battery')||0)>=85);
  if(chg!=null&&chg>500&&carHigh)base=Math.max(250,base-chg);
  return base;}
function predBattPct(h){const cur=capLive(DEV.battery,'measure_battery');if(cur==null)return null;const nh=nowHour();if(h<=nh)return null;
  const kwh=(CFG&&CFG.battkwh)||24,avgH=avgHouseW();let pct=cur;
  for(let x=nh;x<h;x+=0.25){const net=(predSolarW(x)||0)-avgH;pct+=(net*0.25)/(kwh*1000)*100;pct=Math.max(0,Math.min(100,pct));}
  return Math.round(pct);}
function histValueAt(hk,T){const a=HIST[hk];if(!a||!a.length)return null;let best=null;for(const p of a){if(p.t<=T+60000)best=p;else break;}if(!best)best=a[0];return best?best.v:null;}
function smhiUrl(){return 'https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/'+(CONFIG.LON||11.93).toFixed(4)+'/lat/'+(CONFIG.LAT||57.43).toFixed(4)+'/data.json';}
function parseSmhiForecast(j){const ts=j&&j.timeSeries;if(!Array.isArray(ts))return null;const out=[];
  const val=(d,k)=>{const v=d?d[k]:null;return (v==null||v===9999||v===-9||v===-8)?null:Number(v);};
  ts.forEach(e=>{const t=new Date(e.time||e.validTime).getTime();if(isNaN(t))return;const d=e.data||{};
    out.push({t:t,temp:val(d,'air_temperature'),ws:val(d,'wind_speed'),wd:val(d,'wind_from_direction'),gust:val(d,'wind_speed_of_gust'),r:val(d,'relative_humidity'),msl:val(d,'air_pressure_at_mean_sea_level'),p:val(d,'precipitation_amount_mean'),tcc:val(d,'cloud_area_fraction'),sym:val(d,'symbol_code')});});
  return out.length?out:null;}
async function fetchSmhiForecast(){const now=Date.now();if(FORECAST&&now-_fcLast<25*60000)return;_fcLast=now;
  var t0=Date.now();
  try{const c=new AbortController(),id=setTimeout(()=>c.abort(),9000);
    const r=await fetch(smhiUrl(),{signal:c.signal});clearTimeout(id);
    if(!r.ok){SMHI_ST={at:Date.now(),ok:false,fel:r.status+' '+r.statusText,punkter:0,ms:Date.now()-t0};return;}
    const j=await r.json();
    const out=parseSmhiForecast(j);
    if(out){FORECAST=out;SMHI_ST={at:Date.now(),ok:true,fel:null,punkter:out.length,ms:Date.now()-t0};
      if(_timeActive)render();}
    else{
      /* Svaret kom fram men gick inte att tolka — nästan alltid en omlagd
         datastruktur, inte ett nätverksfel. Skillnaden syns i texten. */
      SMHI_ST={at:Date.now(),ok:false,punkter:0,ms:Date.now()-t0,
        fel:'svaret kunde inte tolkas'+(j&&j.timeSeries?'':' (ingen timeSeries)')};
    }
  }catch(e){
    var m=(e&&e.name==='AbortError')?'tog för lång tid':((e&&e.message)||String(e));
    SMHI_ST={at:Date.now(),ok:false,fel:m,punkter:0,ms:Date.now()-t0};
  }}
/* En rad i klartext. Rött bara när det faktiskt är fel — en gammal men lyckad
   hämtning är inte ett fel, den är bara gammal. */
function smhiStatusRad(){
  var s=SMHI_ST;
  if(!s.at)return dRow('SMHI-prognos','<span style="opacity:.6">inte hämtad än</span>');
  var alder=Math.round((Date.now()-s.at)/60000);
  var nar=(alder<1)?'nyss':(alder<60?(alder+' min sedan'):(Math.round(alder/60)+' h sedan'));
  if(s.ok){
    var gammal=alder>90;
    return dRow('SMHI-prognos','<span style="color:'+(gammal?'var(--gold)':'var(--ok)')+'">'
      +s.punkter+' tidpunkter</span><span style="opacity:.55;font-weight:600"> · '+nar+'</span>');
  }
  return dRow('SMHI-prognos','<span style="color:var(--hot)">'+esc(s.fel||'okänt fel')
    +'</span><span style="opacity:.55;font-weight:600"> · '+nar+'</span>');}
function forecastAt(T){if(!FORECAST||!FORECAST.length)return null;let best=null,bd=Infinity;for(const f of FORECAST){const d=Math.abs(f.t-T);if(d<bd){bd=d;best=f;}}return (best&&bd<=3*3600000)?best:null;}
function cloudFactorAt(h){const f=forecastAt(dayStart()+h*3600000);if(f&&f.tcc!=null&&isFinite(f.tcc))return Math.max(0,Math.min(1,f.tcc/8));return null;}
function isoDate(d){return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);}
async function jget(url,opts){try{const c=new AbortController(),id=setTimeout(()=>c.abort(),9000);const r=await fetch(url,Object.assign({signal:c.signal,cache:'no-store'},opts||{}));clearTimeout(id);if(!r.ok)return null;return await r.json();}catch(e){return null;}}

/* Helgdagar (Nager.Date) */
async function feedHolidays(){const now=Date.now();if(FEED.holidays.length&&now-_feedTs.hol<12*36e5)return;_feedTs.hol=now;
  const y=new Date().getFullYear();const out=[];
  for(const yr of [y,y+1]){const j=await jget('https://date.nager.at/api/v3/PublicHolidays/'+yr+'/SE');if(Array.isArray(j))j.forEach(h=>out.push({date:h.date,name:h.localName||h.name}));}
  if(out.length)FEED.holidays=out;}
function holidayName(dateStr){const h=FEED.holidays.find(x=>x.date===dateStr);return h?h.name:null;}
function holidayEmojiToday(){const d=new Date(),md=('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);
  const FIX={'12-23':'🎅','12-24':'🎅','12-25':'🎅','12-26':'🎅','12-31':'🎆','01-01':'🎆','10-31':'🎃','12-13':'🕯️','04-30':'🔥','06-06':'🇸🇪','02-14':'❤️'};
  if(FIX[md])return FIX[md];
  for(let off=-1;off<=1;off++){const dd=new Date(d.getTime()+off*864e5),ds=isoDate(dd),nm=(holidayName(ds)||'').toLowerCase();
    if(!nm)continue;
    if(nm.indexOf('påsk')>=0||nm.indexOf('easter')>=0)return '🐰';
    if(nm.indexOf('midsommar')>=0)return '🌻';
    if(nm.indexOf('pingst')>=0)return '🕊️';
    if(nm.indexOf('trettonde')>=0||nm.indexOf('epiphany')>=0)return '⭐';
    if(nm.indexOf('alla helgon')>=0)return '🕯️';
    if(off===0)return '🎉';}
  return null;}
function updateHouseHeroIcon(){const hh=$('house-hero');if(!hh)return;let em=null;try{em=holidayEmojiToday();}catch(e){}
  if(em){if(hh.getAttribute('data-emo')!==em){hh.innerHTML='<span class="hero-emoji">'+em+'</span>';hh.setAttribute('data-emo',em);}}
  else if(hh.getAttribute('data-emo')){hh.innerHTML=icon('house');hh.removeAttribute('data-emo');}}
function parseSmhiWarnings(j){if(!Array.isArray(j))return [];const out=[];const seen={};
  const lvlSv={RED:'röd',ORANGE:'orange',YELLOW:'gul'};
  j.forEach(w=>{const areas=w.warningAreas||w.areas||[];
    areas.forEach(wa=>{
      const aff=wa.affectedAreas||wa.affected_areas||[];
      let names=[];if(Array.isArray(aff))names=aff.map(a=>(a&&(a.sv||a.en||a.name))||'').filter(Boolean);
      else if(typeof aff==='string')names=[aff];
      if(!names.length&&wa.areaName)names=[wa.areaName.sv||wa.areaName.en||wa.areaName];
      const joined=names.join(', ').toLowerCase();
      if(!_COUNTY.some(c=>joined.indexOf(c)>=0))return;
      const code=(wa.warningLevel&&(wa.warningLevel.code||wa.warningLevel))||'';
      const isMsg=(''+code).toUpperCase()==='MESSAGE';
      const lvl=lvlSv[(''+code).toUpperCase()]||'';
      const ev=(wa.eventDescription&&(wa.eventDescription.sv||wa.eventDescription.en))||(w.event&&(w.event.sv||w.event.en))||'Meddelande';
      let dtxt='';const ds=wa.descriptions||wa.description||[];
      if(Array.isArray(ds)&&ds.length){const d0=ds[0];const t=d0&&d0.text&&(d0.text.sv||d0.text.en);if(t)dtxt=(''+t).replace(/\s+/g,' ').trim().slice(0,110);}
      const key=ev+'|'+code+'|'+joined;if(seen[key])return;seen[key]=1;
      out.push({level:lvl,isMsg:isMsg,text:ev,desc:dtxt,area:(names.find(function(n){return (''+n).toLowerCase().indexOf('halland')>=0;})||'Hallands län'),sev:(''+code).toUpperCase()==='RED'?3:(''+code).toUpperCase()==='ORANGE'?2:lvl==='gul'?1:0});});});
  return out;}
async function feedWarnings(){const now=Date.now();if(now-_feedTs.warn<20*60000&&FEED.warnings.length!==undefined&&_feedTs.warn)return;_feedTs.warn=now;
  const j=await jget('https://opendata-download-warnings.smhi.se/ibww/api/version/1/warning.json');if(j!=null)FEED.warnings=parseSmhiWarnings(j);}

/* Pollen (pollenrapporten v1) – best effort */
function parsePollen(regions,types,fc){try{
  if(!Array.isArray(regions)||!Array.isArray(fc))return null;
  const reg=regions.find(r=>((r.name||'')+'').toLowerCase().indexOf('göteborg')>=0);if(!reg)return null;
  const rid=reg.id||reg.regionId;
  const items=fc.filter(f=>(f.regionId===rid||f.region_id===rid));
  const today=isoDate(new Date());
  let day=items.find(f=>((f.startDate||f.date||'')+'').slice(0,10)===today)||items[0];if(!day)return null;
  const lv=day.levelSeries||day.levels||day.pollenLevels||[];
  const tn={};if(Array.isArray(types))types.forEach(t=>{tn[t.id||t.pollenId]=t.name;});
  const hi=[];(Array.isArray(lv)?lv:[]).forEach(x=>{const l=x.level!=null?x.level:x.value;if(l!=null&&l>=3){let nm=(''+(tn[x.pollenId||x.pollenTypeId||x.typeId]||x.pollenType||x.name||'pollen')).trim();nm=nm.charAt(0).toUpperCase()+nm.slice(1);hi.push(nm);}});
  const seen={},uniq=[];hi.forEach(n=>{const k=n.toLowerCase();if(!seen[k]){seen[k]=1;uniq.push(n);}});
  return {high:uniq,region:reg.name};
}catch(e){return null;}}
async function feedPollen(){const now=Date.now();const m=new Date().getMonth();if(m<2||m>7){FEED.pollen=null;return;}
  if(FEED.pollen&&now-_feedTs.pollen<6*36e5)return;_feedTs.pollen=now;
  const base='https://api.pollenrapporten.se/v1/';
  const regions=await jget(base+'regions'),types=await jget(base+'pollen-types'),fc=await jget(base+'forecasts?current=true');
  const R=regions&&(regions.items||regions.regions||regions),T=types&&(types.items||types.pollenTypes||types),F=fc&&(fc.items||fc.forecasts||fc);
  FEED.pollen=parsePollen(R,T,F);}

/* Väglag + trafik (Trafikverket) – kräver nyckel, best effort */
function tvBody(key){return '<REQUEST><LOGIN authenticationkey="'+key+'"/>'
  +'<QUERY objecttype="Situation" schemaversion="1.5" limit="8"><FILTER>'
  +'<WITHIN name="Deviation.Geometry.WGS84" shape="center" value="'+(CONFIG.LON||11.93)+' '+(CONFIG.LAT||57.43)+'" radius="25000m"/>'
  +'</FILTER><INCLUDE>Deviation.Message</INCLUDE><INCLUDE>Deviation.MessageType</INCLUDE><INCLUDE>Deviation.RoadNumber</INCLUDE><INCLUDE>Deviation.SeverityText</INCLUDE></QUERY></REQUEST>';}
function parseTrafikverket(j){try{const res=j&&j.RESPONSE&&j.RESPONSE.RESULT;if(!Array.isArray(res))return [];const out=[];
  res.forEach(r=>{const sit=r.Situation||[];sit.forEach(s=>{(s.Deviation||[]).forEach(d=>{const msg=d.Message||d.MessageType;if(msg)out.push({text:(''+msg).slice(0,90),road:d.RoadNumber||'',sev:d.SeverityText||''});});});});
  return out;}catch(e){return [];}}
async function feedRoad(){const now=Date.now();if(!CONFIG.TRAFIKVERKET_KEY){FEED.traffic=[];return;}if(now-_feedTs.road<15*60000&&_feedTs.road)return;_feedTs.road=now;
  const j=await jget('https://api.trafikinfo.trafikverket.se/v2/data.json',{method:'POST',headers:{'Content-Type':'text/xml'},body:tvBody(CONFIG.TRAFIKVERKET_KEY),cache:'no-store'});
  FEED.traffic=parseTrafikverket(j);}

/* Badtemperatur (Open-Meteo Marine) – nu + timvis historik */
async function feedSea(){const now=Date.now();if(FEED.sea!=null&&now-_feedTs.sea<60*60000)return;_feedTs.sea=now;
  const url='https://marine-api.open-meteo.com/v1/marine?latitude='+(CONFIG.BATH_LAT||57.39)+'&longitude='+(CONFIG.BATH_LON||12.02)+'&current=sea_surface_temperature&hourly=sea_surface_temperature&past_days=1&forecast_days=1&timezone=auto';
  const j=await jget(url);if(!j)return;
  const cur=j.current&&j.current.sea_surface_temperature;if(cur!=null&&isFinite(cur)){FEED.sea=Number(cur);FEED.seaAt=now;}
  try{const H=j.hourly;if(H&&Array.isArray(H.time)&&Array.isArray(H.sea_surface_temperature)){
    const pts=[];for(let i=0;i<H.time.length;i++){const t=Date.parse(H.time[i]),v=H.sea_surface_temperature[i];if(isFinite(t)&&v!=null&&isFinite(v)&&t<=now+5*60000)pts.push([t,Number(v)]);}
    if(pts.length){if(FEED.sea==null){FEED.sea=pts[pts.length-1][1];FEED.seaAt=now;}
      const st=learnGet();st['k:seatemp']={s:pts.slice(-60),t:now};try{localStorage.setItem('learn_v1',JSON.stringify(st));}catch(e){}}
  }}catch(e){}}

function refreshFeeds(){if(CONFIG.FEEDS===false)return;feedHolidays();feedWarnings();feedSea();feedPollen();feedRoad();}
function feedWarnItems(){const out=[];
  (FEED.warnings||[]).forEach(w=>{const tag=w.sev>=2?'crit':(w.sev===1?'warnc':'okc');
    out.push([tag,'warning',esc(w.text),(w.isMsg?'':(w.level||''))]);});
  if(FEED.pollen&&FEED.pollen.high&&FEED.pollen.high.length)out.push(['warnc','leaf','Höga pollenhalter i '+esc(FEED.pollen.region||'regionen')+': '+esc(FEED.pollen.high.join(', ')),'']);
  (FEED.traffic||[]).slice(0,3).forEach(t=>{out.push(['warnc','car-profile','Trafik'+(t.road?' '+esc(t.road):'')+': '+esc(t.text),'']);});
  return out;}
function buildTimeMap(scrubH){const nh=nowHour(),future=scrubH>nh+0.03,map={},T=dayStart()+scrubH*3600000;
  if(!future){TM_HIST.forEach(a=>{let v=histValueAt(a[0],T);
    /* HIST bar vinden i m/s. Kartan ska bara capability-varden, alltsa km/h. */
    if(v!=null&&(a[0]==='wind'||a[0]==='gust'))v=msTillKmh(v);
    if(v!=null)map[a[2]+'|'+a[1]]=v;});}
  else{const ps=predSolarW(scrubH);map[DEV.solar+'|measure_power']=ps;
    const pb=predBattPct(scrubH);if(pb!=null){map[DEV.battery+'|measure_battery']=pb;
      const curb=capLive(DEV.battery,'measure_battery');map[DEV.battery+'|battery_charging_state']=(ps>avgHouseW()?'charging':'discharging');}
    map[DEV.tibber+'|measure_price_total']=capLive(DEV.tibber,'measure_price_total');
    const fc=forecastAt(T);if(fc){
      if(fc.temp!=null)map[DEV.outdoor+'|measure_temperature']=fc.temp;
      /* Kartan foreställer CAPABILITY-varden, och vindmatarens capability ar
         km/h. SMHI lamnar m/s, sa det maste ganges tillbaka - annars delar
         vindMs() med 3,6 en gang till och prognosens vind blir 3,6 ganger for
         svag i tidsmaskinen. Samma sak for HIST-vardena nedan. */
      if(fc.ws!=null)map[DEV.windMs+'|measure_wind_strength']=msTillKmh(fc.ws);
      if(fc.gust!=null)map[DEV.windMs+'|measure_gust_strength']=msTillKmh(fc.gust);
      if(fc.wd!=null)map[DEV.windNet+'|measure_wind_angle']=fc.wd;
      if(fc.r!=null)map[DEV.outdoor+'|measure_humidity']=fc.r;
      if(fc.msl!=null)map[DEV.vader+'|measure_pressure']=fc.msl;
      if(fc.p!=null)map[DEV.rain+'|measure_rain.24h']=fc.p;}}
  return {map:map,T:T,future:future,h:scrubH};}
function scrubTouch(){if(_scrubTimer!==null)clearTimeout(_scrubTimer);_scrubTimer=setTimeout(()=>{_scrubTimer=null;exitTimeMode();},30000);}
function enterTimeMode(scrubH){_scrubH=scrubH;const ti=buildTimeMap(scrubH);_timeMap=ti.map;_timeInfo=ti;_timeActive=true;render();updateScrub();scrubTouch();}
function exitTimeMode(){if(_scrubTimer!==null){clearTimeout(_scrubTimer);_scrubTimer=null;}_timeActive=false;_timeMap=null;_timeInfo=null;_scrubH=null;render();updateScrub();}
function scrubBy(delta){let h=(_scrubH!=null?_scrubH:nowHour())+delta;h=Math.max(0,Math.min(24,h));enterTimeMode(h);}
function scrubStep(d){scrubBy(d*0.25);}
/* Notisknappen är LIVE-knapp i historikläget. På mobilen fanns annars ingen väg
   tillbaka alls — bara att vänta ut den 30 sekunder långa tidsgränsen. */
function notisEllerLive(){
  if(_timeActive){exitTimeMode();return;}
  krNotisTryck();}
function updateScrub(){const ds=$('daystrip'),mn=$('ds-minus'),pl=$('ds-plus'),tm=$('ds-time'),lb=$('ds-livebtn');
  const on=!!(_timeActive&&_timeInfo);
  if(ds&&ds.classList)ds.classList.toggle('scrubbing',on);
  /* Knappraden växlar läge: vyknapparna göms, tiden syns centrerad, och
     notisknappen blir LIVE. Vid återgång ritas notisknappen om från grunden så
     klocka och olästräknare kommer tillbaka. */
  try{
    document.body.classList.toggle('histmod',on);
    var eh=$('en-hist'), nb=$('en-notis');
    if(eh){
      /* Höjden hämtas från knappraden så etiketten hamnar mitt i den, trots att
         den ligger fast mot vyn. */
      try{
        var tp=eh.closest?eh.closest('.en-top'):null;
        if(tp&&tp.getBoundingClientRect){
          var r2=tp.getBoundingClientRect();
          if(r2.height)eh.style.top=Math.round(r2.top+r2.height/2)+'px',eh.style.transform='translate(-50%,-50%)';
        }
      }catch(e){}
      if(on){
        var d2=new Date(_timeInfo.T);
        var kl=('0'+d2.getHours()).slice(-2)+':'+('0'+d2.getMinutes()).slice(-2);
        eh.innerHTML='<span class="ds-time-ic">'
          +icon(_timeInfo.future?'trend-up':'clock-counter-clockwise')+'</span>'
          +(_timeInfo.future?'Prognos':'Historik')+' · '+kl;
      }else eh.innerHTML='';
    }
    if(nb){
      /* Nollställ allt som notisläget lagt dit — pulsen och 'har' färgar
         knappen och hör inte hemma på en Live-knapp. */
      if(on){nb.classList.remove('har','puls');}
      nb.title=on?'Tillbaka till nu':'Sammanfattningar';
      /* krNotisEn skriver om knappen och tappar då ic-slot-klassen, så sök på
         .en-cmp-ic också — annars hittas ikonen inte och blixten uteblir. */
      var ik=nb.querySelector('.ic-slot')||nb.querySelector('.en-cmp-ic');
      if(ik){
        ik.classList.add('ic-slot');
        ik.setAttribute('data-ic',on?'lightning':'bell');
        ik.innerHTML=icon(on?'lightning':'bell');
      }
      /* Text bredvid ikonen i historikläget: en ensam blixt säger inte vad den
         gör. Nollställs igen så notisknappen förblir bara en klocka. */
      var tx=nb.querySelector('.en-livetxt');
      if(on){
        if(!tx){tx=document.createElement('span');tx.className='en-livetxt';nb.appendChild(tx);}
        tx.textContent='Live';
      }else if(tx){tx.remove();}
      /* Klassen styr bredden — utan den förblir knappen rund och klipper texten. */
      nb.classList.toggle('en-live',on);
      /* Antalsbrickan hör till notiserna och säger ingenting om live-läget. */
      /* Antalet olästa hör till notiserna och säger ingenting om live-läget. */
      var bd=nb.querySelector('.en-notis-n');
      if(bd&&bd.style)bd.style.display=on?'none':'';
    }
  }catch(e){}
  /* Tillbaka till normalläge: låt notisknappen återta sitt riktiga utseende. */
  if(!on){try{krNotisUppdatera();}catch(e){}}
  if(mn&&mn.style)mn.style.display=on?'flex':'none';
  if(pl&&pl.style)pl.style.display=on?'flex':'none';
  /* Live-knappen i remsan visas inte längre: knappraden har övertagit rollen. */
  if(lb&&lb.style)lb.style.display='none';
  if(tm){if(on){const d=new Date(_timeInfo.T),hh=('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);tm.innerHTML='<span class="ds-time-ic">'+icon(_timeInfo.future?'trend-up':'clock-counter-clockwise')+'</span>'+(_timeInfo.future?'Prognos ':'Historik ')+hh;tm.style.display='flex';}else{tm.style.display='none';tm.innerHTML='';}}}
/* Ett ord om vardet, inte en upprepning av det. Tom strang nar capabilityn
   inte har nagon vedertagen skala - da ar det arligare att inte saga nagot. */
/* ===== RUMSRUTORNA (v736) – värden, varningar och popup ===== */
function zkVarden(k){var id=ZK[k].sensor();
  return {t:cap(id,'measure_temperature'),h:cap(id,'measure_humidity'),c:cap(id,'measure_co2'),b:cap(id,'measure_battery')};}
/* Varningar, mest allvarlig först: {niva:'larm'|'varn', txt (popupen), kort (rutan)}. */
function zkVarningar(k){
  var Z=ZK[k],g=Z.gr,v=zkVarden(k),ut=[];
  if(v.t!=null&&isFinite(v.t)){
    if(v.t>=g.tHogLarm)ut.push({niva:'larm',txt:'Mycket varmt – '+num(v.t,1)+' °C',kort:'mycket varmt'});
    else if(v.t>=g.tHogVarn)ut.push({niva:'varn',txt:'Varmt – '+num(v.t,1)+' °C',kort:'varmt'});
    else if(v.t<=g.tLagLarm)ut.push({niva:'larm',txt:(g.tLagLarmTxt?(g.tLagLarmTxt.charAt(0).toUpperCase()+g.tLagLarmTxt.slice(1)):'Frostrisk')+' – '+num(v.t,1)+' °C',kort:g.tLagLarmTxt||'frostrisk'});
    else if(v.t<=g.tLagVarn)ut.push({niva:'varn',txt:'Kallt – '+num(v.t,1)+' °C',kort:'kallt'});}
  if(v.c!=null&&isFinite(v.c)){
    if(v.c>=ZK_CO2_LARM)ut.push({niva:'larm',txt:'Dålig luft – '+Math.round(v.c)+' ppm CO₂, vädra',kort:'vädra'});
    else if(v.c>=ZK_CO2_VARN)ut.push({niva:'varn',txt:'Tung luft – '+Math.round(v.c)+' ppm CO₂',kort:'tung luft'});}
  if(v.h!=null&&isFinite(v.h)){
    if(g.hHog!=null&&v.h>=g.hHog)ut.push({niva:'varn',txt:'Fuktigt – '+Math.round(v.h)+' % luftfuktighet',kort:'fuktigt'});
    else if(g.hLag!=null&&v.h<=g.hLag)ut.push({niva:'varn',txt:'Torrt – '+Math.round(v.h)+' % luftfuktighet',kort:'torrt'});}
  if(v.b!=null&&isFinite(v.b)&&v.b<=ZK_BATT)ut.push({niva:'varn',txt:'Sensorns batteri '+Math.round(v.b)+' % – byt snart',kort:'byt batteri'});
  ut.sort(function(a,b){return (a.niva==='larm'?0:1)-(b.niva==='larm'?0:1);});
  return ut;}
/* Rummets egna namn på en serie (poolrummets "t" är rummet, inte vattnet). */
function zkSerDef(Z,x){var S=Object.assign({},ZK_SER[x]);
  if(Z.serLab&&Z.serLab[x]){S.lab=Z.serLab[x][0];S.kort=Z.serLab[x][1];}
  if(x==='h'&&Z.ser.p){S.col='violet';}            /* cyan är vattnets färg i poolrummet */
  return S;}
/* Seriens punkter. Havet är ingen HIST-serie: den mäts sällan och ligger som
   inlärd serie (k:seatemp, [tid, värde]). */
function zkSerie(Z,x,cid){
  if(x==='s'){var e=null;try{e=learnGet()['k:seatemp'];}catch(er){}
    return (e&&e.s)?e.s.map(function(q){return {t:q[0],v:q[1]};}):[];}
  if(typeof Z.ser[x]==='function')return Z.ser[x](cid);   /* v750: sammanvägd serie */
  return histV(Z.ser[x],cid);}
function zkSerieNu(k,x,v){
  if(ZK[k]&&ZK[k].nu&&ZK[k].nu[x])return ZK[k].nu[x]();
  if(x==='p')return cap(DEV.pooltemp,'measure_temperature');
  if(x==='s')return (typeof FEED!=='undefined')?FEED.sea:null;
  return x==='t'?v.t:x==='h'?v.h:v.c;}
function zkVal(k,s){_zkSer[k]=s;var b=$('dlg-body');if(b)b.innerHTML=zkPopHTML(k);}
/* Lampor: samma regler som rumsvyn, men även de som rumsvyn döljer (Föröver,
   Styrbord) – här är det hela rummet som ska gå att styra. */
function zkArLampa(d){return !!(RUM_LAMPA[d.id]||/fönster/i.test(rNamn(d))||rKlass(d)==='light');}
function zkUttagRad(d){
  var pa=capOf(d,'onoff')===true,w=rHar(d,'measure_power')?capOf(d,'measure_power'):null;
  return '<div class="dv-row'+(pa?' on':'')+'">'
    +'<span class="dv-ic">'+icon('plug')+'</span>'
    +'<span class="dv-n">'+esc(rNamn(d))+((pa&&w!=null&&isFinite(w))?('<small>'+W(w)+'</small>'):(pa?'':'<small>av</small>'))+'</span>'
    +'<button class="dv-sw'+(pa?' on':'')+'" onclick="devTanda(\''+d.id+'\')" aria-label="på/av"><i></i></button></div>';}
function zkPopHTML(k){
  var Z=ZK[k];if(!Z)return '';
  var v=zkVarden(k),w=zkVarningar(k),cid='zk_'+k,P=PAL[curTheme]||PAL.dark;
  var val=(_zkSer[k]&&Z.ser[_zkSer[k]])?_zkSer[k]:(Z.ser0||'t'),S=zkSerDef(Z,val);
  var h='';
  if(w.length)h+='<div class="zk-varnlista">'+w.map(function(x){
    return '<div class="zk-varnrad '+x.niva+'">'+icon('warning')+'<span>'+esc(x.txt)+'</span></div>';}).join('')+'</div>';
  h+=grafRubrik(cid,S.lab,infoBlock('zkgraf',
      'Välj kurva med knapparna under grafen. Dra i grafen för att läsa av vid en viss tidpunkt.'))
    +ptsLineSVG(zkSerie(Z,val,cid),S.col,S.u,cid,HIST_H,Z.lab+' · '+S.lab)
    +grafTidsval(cid);
  var nyck=(Z.ordning||['t','h','c']).filter(function(x){return !!Z.ser[x];});
  if(nyck.length>1){
    h+='<div class="tg-leg">'+nyck.map(function(x){var SS=zkSerDef(Z,x),vv=zkSerieNu(k,x,v);
      return '<button class="tg-chip'+(x===val?' on':'')+'" onclick="zkVal(\''+k+'\',\''+x+'\')">'
        +'<span class="tg-top"><span class="tg-dot" style="background:'+(P[SS.col]||P.blue)+'"></span><span class="tg-l">'+SS.kort+'</span></span>'
        +'<b class="tg-v">'+(vv==null||!isFinite(vv)?'–':num(vv,SS.dec)+'<span class="tg-u">'+(SS.u==='°C'?'°':x==='c'?'':SS.u)+'</span>')+'</b></button>';}).join('')+'</div>';}
  h+=dSec('Nu');
  if(Z.ser.p){
    /* v740: poolvattnet först – samma rader som Pool-popupen. */
    var pv=cap(DEV.pooltemp,'measure_temperature'),rt=poolRate(),ph=cap(DEV.poolheat,'onoff'),pvarm=(ph==='on'||ph===true);
    h+=dRow('Poolvattnet',pv==null?'–':num(pv,1)+' °C');
    h+=poolDygnRader();
    h+=dRow('Poolvärme',pvarm?'<span style="color:var(--warm);font-weight:850">på – värmer</span>':'av');
    if(rt!=null)h+=dRow('Trend',(rt>=0?'+':'')+num(rt,1)+' °/h');
    if(rt!=null&&rt>=0.05&&pv!=null){var nd=Math.floor(pv)+1,hr=(nd-pv)/rt;
      if(hr>0&&hr<24)h+=dRow('Når '+nd+'°','ca '+hhmm(new Date(Date.now()+hr*3600000)));}
    h+=dSec('Rummet');}
  if(Z.ser.m){
    /* v750: medlet först, sedan rummen var för sig. */
    var mv=Z.nu.m(),kv=Z.nu.k();
    h+=dRow('Medel inne',mv==null?'–':num(mv,1)+' °C');
    h+=dRow('Vardagsrum',v.t==null?'–':num(v.t,1)+' °C');
    h+=dRow('Kök',kv==null?'–':num(kv,1)+' °C');}
  else h+=dRow(Z.ser.p?'Rumstemperatur':'Temperatur',v.t==null?'–':num(v.t,1)+' °C');
  var dd=histTodayDelta(Z.ser.t);
  if(dd&&dd.n>=3&&dd.min!=null)h+=dRow(Z.ser.m?'Vardagsrum lägst / högst':'Lägst / högst idag',num(dd.min,1)+' – '+num(dd.max,1)+' °C');
  if(v.h!=null)h+=dRow('Luftfuktighet',Math.round(v.h)+' %'+(sensorOmdome('measure_humidity',v.h)?' · '+sensorOmdome('measure_humidity',v.h):''));
  if(v.c!=null)h+=dRow('CO₂',Math.round(v.c)+' ppm · '+sensorOmdome('measure_co2',v.c));
  if(v.b!=null)h+=dRow('Sensorns batteri',Math.round(v.b)+' %');
  if(Z.ser.s){
    /* Badtemperaturen i havet, med när den mättes – den uppdateras sällan. */
    var hav=(typeof FEED!=='undefined')?FEED.sea:null,havT=(typeof _feedTs!=='undefined'&&_feedTs.sea)?_feedTs.sea:0;
    h+=dRow('Badtemp · '+esc(CONFIG.BATH_NAME||'havet'),hav==null?'–':num(hav,1)+' °C');
    if(hav!=null&&pv!=null)h+=dRow('Poolen mot havet',(pv-hav>=0?'+':'−')+num(Math.abs(pv-hav),1)+' °');}
  var ens=rDevsIZon(Z.zon).filter(function(d){return rHar(d,'onoff');}).sort(rSort);
  var pa=ens.filter(function(d){return capOf(d,'onoff')===true;}).length;
  h+=dSec(Z.ser.p?'Styrning':(ens.length?('Enheter ('+pa+' av '+ens.length+' på)'):'Enheter'));
  h+=ens.length?ens.map(function(d){return zkArLampa(d)?devRad(d):zkUttagRad(d);}).join('')
    :'<div class="det-note">Inga styrbara enheter i '+esc(Z.lab.toLowerCase())+'.</div>';
  /* Poolknapparna ur knappavsnittet, som i Pool-popupen. */
  if(Z.ser.p&&CFG&&CFG.paNu){try{h+=popKnappar('pool');}catch(e){}}
  return h;}
/* v740: poolens dygn och vecka – ur Pool-popupen, så att Poolrum-popupen
   visar exakt samma rader. */
function poolDygnRader(){
    const pd=(_appPool&&_appPool.n>=3)?_appPool:histTodayDelta('pool');
    /* Samma rad två gånger, för dygnet och för veckan. Veckan kommer bara från
       appen: den lokala historiken sparas i 24 timmar och kan aldrig täcka den. */
    const pRad=(namn,x,sedan)=>{
      const upp=(x.d>=0), fg=upp?'var(--gold)':'var(--blue)';
      return dRow(namn,'<span style="color:'+fg+';font-weight:850">'+(upp?'▲ +':'▼ ')+num(x.d,1)+' °</span>'
        +(sedan?'<span style="opacity:.55;font-weight:600"> sedan '+sedan+'</span>':''));};
    const VDAG=['sön','mån','tis','ons','tor','fre','lör'];
    let idag='';
    if(pd&&pd.n>=3){
      idag=pRad('Idag',pd,hhmm(new Date(pd.t0)))
        +dRow('Lägst / högst idag',num(pd.min,1)+' – '+num(pd.max,1)+' °');
    }else{
      idag=dRow('Idag','<span style="opacity:.6">samlar data ännu</span>');
    }
    const pveck=_appPoolV;
    if(pveck&&pveck.n>=3){
      /* "sedan måndag" säger mer än ett klockslag när perioden är en vecka. */
      const d0=new Date(pveck.t0);
      idag+=pRad('Veckan',pveck,VDAG[d0.getDay()]+' '+hhmm(d0))
        +dRow('Lägst / högst veckan',num(pveck.min,1)+' – '+num(pveck.max,1)+' °');
    }
    return idag;}
function sensorOmdome(c,v){
  if(v==null||!isFinite(v))return '';
  if(c==='measure_co2')return v<600?'frisk luft':v<800?'bra':v<1000?'godtagbart':v<1400?'tungt':'vädra';
  if(c==='measure_humidity')return v<25?'torrt':v<30?'lite torrt':v<=60?'bra':v<=70?'fuktigt':'för fuktigt';
  if(c==='measure_noise')return v<35?'tyst':v<50?'lugnt':v<65?'ljudligt':'högt';
  if(c==='measure_pressure')return v<995?'lågtryck':v<1010?'sjunkande skala':v<1025?'normalt':'högtryck';
  if(c==='measure_battery')return v<10?'byt batteri':v<25?'lågt':v<60?'halvfullt':'bra';
  return '';
}
function poolRate(){const e=learnGet()['c:'+DEV.pooltemp+':measure_temperature'];if(!e||!e.s||e.s.length<2)return null;
  const now=Date.now(),v=cap(DEV.pooltemp,'measure_temperature');if(v==null)return null;let base=null,bt=0;
  for(let i=e.s.length-1;i>=0;i--){const t=e.s[i][0];if(now-t>=60*60000){if(now-t<=3.5*3600000){base=e.s[i][1];bt=t;}break;}}
  if(base==null)return null;const dtH=(now-bt)/3600000;if(dtH<=0)return null;return (v-base)/dtH;}
/* prislogg (dagens kurva) */
function plogGet(){try{return JSON.parse(localStorage.getItem('plog_v1')||'null');}catch(e){return null;}}
/* Prislogg per dygn: {days:{'YYYY-MM-DD':[[timme,pris],...]}}. Håller ~3 dygn. */
function plogDays(){var o=plogGet();
  if(o&&o.days)return o;
  var n={days:{}};if(o&&o.day&&o.pts)n.days[o.day]=o.pts;   /* migrera gammalt enkeldygns-format */
  return n;}
function priceLogTick(){const pr=elprisNow();if(pr==null)return;const now=new Date(),day=dayKey(now),h=now.getHours()+now.getMinutes()/60;
  let o=plogDays();var pts=o.days[day]||(o.days[day]=[]);
  if(!pts.length||h-pts[pts.length-1][0]>=0.2){pts.push([Math.round(h*100)/100,Math.round(pr*1000)/1000]);if(pts.length>140)o.days[day]=pts.slice(-140);
    var ks=Object.keys(o.days).sort();while(ks.length>3){delete o.days[ks.shift()];}
    try{localStorage.setItem('plog_v1',JSON.stringify(o));}catch(e){}}}
function prisDygn(offset){
  if(!_prisJ||!_prisJ.d)return null;
  var key=dayKey(new Date(Date.now()+(offset||0)*86400000));
  var rad=_prisJ.d[key];
  if(!Array.isArray(rad))return null;
  /* UPPLÖSNINGEN LÄSES UR ANTALET VÄRDEN.
     Listan var alltid ett värde per timme, och index togs rakt av som timme.
     Skriver tibberpris i stället kvartar blir det 96 värden, och då är varje
     steg en fjärdedels timme. Ett dygn med sommartidsomställning har 23 eller
     25 timmar (92 eller 100 kvartar), så gränsen dras vid 48 i stället för att
     jämföra med exakt 24 eller 96.
     Byter du upplösning i tibberpris följer grafen med utan att röras här. */
  var steg=(rad.length>48)?0.25:1;
  var pts=[];
  for(var h=0;h<rad.length;h++)if(typeof rad[h]==='number')pts.push([h*steg,rad[h]]);
  /* Sista punkten dras ut till dygnets slut, annars slutar kurvan i förtid och
     ser ut att sakna en bit. */
  if(pts.length>1&&pts[pts.length-1][0]<24)pts.push([24,pts[pts.length-1][1]]);
  return pts.length>=2?pts:null;
}
async function prisVarHamta(){
  if(!appKan())return;
  if(_prisAt&&Date.now()-_prisAt<15*60000)return;
  try{
    var list=await logicList(),v=null;
    logicArr(list).forEach(function(x){if(x&&x.name===PRIS_VAR)v=x;});
    if(!v){_prisFel='logikvariabeln '+PRIS_VAR+' finns inte';return;}
    var j=null;try{j=JSON.parse(String(v.value||''));}catch(e){}
    if(!j||!j.d){_prisFel='kunde inte tolka '+PRIS_VAR;return;}
    _prisJ=j;_prisAt=Date.now();_prisFel=null;
    /* Sparas så nästa uppstart har serien DIREKT, utan att vänta på Homey.
       Datumnycklarna i j.d gör gammal data ofarlig: prisDygn hittar bara
       dagens och morgondagens. */
    try{localStorage.setItem('prisJ_v1',JSON.stringify(j));}catch(e){}
    /* Står prispopupen öppen ska den fyllas i direkt, inte vid nästa tryck. */
    try{if(typeof _popupRebuild==='function'){var b=$('dlg-body');if(b)b.innerHTML=_popupRebuild();}}catch(e){}
  }catch(e){_prisFel=(e&&e.message)||'fel vid hämtning';}
}
function prisKalibrering(pts){
  var lo=elprisLo(),hi=elprisHi();
  if(pts&&pts.length>1&&lo!=null&&hi!=null&&isFinite(lo)&&isFinite(hi)){
    var vs=pts.map(function(p){return p[1];});
    var tlo=Math.min.apply(null,vs),thi=Math.max.apply(null,vs);
    /* Ett för litet spann gör lutningen orimlig — då är en ren förskjutning
       ärligare än en uppblåst faktor. */
    if(thi-tlo>0.05){
      var a=(hi-lo)/(thi-tlo);
      if(a>0.2&&a<8){_prisKal={a:a,b:lo-a*tlo};return _prisKal;}
    }
    _prisKal={a:1,b:lo-tlo};return _prisKal;
  }
  return _prisKal;                        /* gårdagens passning duger för imorgon */
}
function prisKalibrera(pts,offset){
  /* Saknas serien finns inget att kalibrera. Utan den här raden kastade
     funktionen på null, vilket prisMinMax kunde råka ut för när morgondagens
     priser inte publicerats än. */
  if(!pts)return null;
  var k=(offset===0)?prisKalibrering(pts):(_prisKal||prisKalibrering(pts));
  if(!k)return pts;
  return pts.map(function(p){return [p[0],k.a*p[1]+k.b];});
}
/* En etikett mitt över sin punkt hamnar utanför rutan när punkten ligger vid
   kanten — "271 öre" blev "1 öre" i vänsterkanten. Här byts förankringen nära
   kanterna i stället, så hela texten alltid får plats. */
/* ===================== TVÅ GENOMGÅENDE REGLER =====================
   GRAFREGEL: alla grafer i dashboarden ritas likadant. Färger tas ur PAL för
   aktuellt tema — aldrig hårdkodade hex utanför paletten. Linjer är 2,2–2,4 px
   med runda hörn och ändar, ytan under en kurva är samma toning från 28 % till
   noll, markörer är 3,6 px cirklar, och etiketter använder .pg-tag med
   förankring som byts nära kanterna så texten aldrig klipps. Nya grafer ska
   följa det här utan undantag; avviker något är det en bugg, inte en variant.

   INFOREGEL: förklarande text ligger ALLTID bakom en infoknapp — infoBlock()
   med husets .di-q och .drow-info. Ingen lös brödtext i en popup. En ruta full
   av förklaringar läser man en gång och sedan aldrig mer, men den tar plats
   varje gång.
   ================================================================= */
/* ETIKETTERNA RITAS I HTML, INTE I SVG:N.
   Grafen ritas med preserveAspectRatio="none" för att fylla bredden, och då
   sträcks även texten — siffrorna såg utdragna och suddiga ut. Ett <span>
   ovanpå rutan placeras i procent och renderas med skärmens egen upplösning.
   Returnerar HTML som läggs i .pgraph-lager, inte i <svg>. */
function pgTagg(x,y,txt,kl,W,H){
  var vx=Math.max(0,Math.min(100,(x/W)*100));
  var vy=Math.max(0,Math.min(100,(y/(H||110))*100));
  /* Nära kanten förankras etiketten i sidan i stället för i mitten. */
  var stil;
  if(x<W*0.14)stil='left:2px;transform:translateY(-50%)';
  else if(x>W*0.86)stil='right:2px;transform:translateY(-50%)';
  else stil='left:'+vx.toFixed(2)+'%;transform:translate(-50%,-50%)';
  return '<span class="pg-tag '+kl+'" style="top:'+vy.toFixed(2)+'%;'+stil+'">'+txt+'</span>';
}
/* Blandar två hexfärger. Används av prisgrafens färgskala. */
function blanda(a,b,t){
  var p=function(h){h=String(h||'').replace('#','');
    if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    return [parseInt(h.slice(0,2),16)||0,parseInt(h.slice(2,4),16)||0,parseInt(h.slice(4,6),16)||0];};
  var A=p(a),B=p(b),o='#';
  for(var i=0;i<3;i++){
    var v=Math.round(A[i]+(B[i]-A[i])*Math.max(0,Math.min(1,t)));
    o+=('0'+v.toString(16)).slice(-2);
  }
  return o;
}
/* Ören i stället för kronor på lägsta och högsta. Två decimaler i kronor blir
   0,14 och 1,38 — samma tal i ören är 14 och 138, som är lättare att jämföra
   med varandra och med taggarna i grafen, som redan står i ören. */
function oren(v){return (v==null||!isFinite(v))?'–':(Math.round(v*100)+' öre/kWh');}
function pgTimmenNu(){var d=new Date();return Math.min(24,d.getHours()+d.getMinutes()/60);}
/* Priset vid en godtycklig tidpunkt. Punkterna ligger per hel eller halv timme;
   mellan dem hålls priset konstant — ett spotpris trappas, det lutar inte. */
function pgPrisVid(h){
  if(!_pgGeo||!_pgGeo.pts.length)return null;
  var pts=_pgGeo.pts,v=pts[0][1];
  for(var i=0;i<pts.length;i++){if(pts[i][0]<=h)v=pts[i][1];else break;}
  return v;
}
/* VILKET INTERVALL står vi i? Gränserna läses ur punkterna själva i stället
   för att antas vara hela timmar — Tibber levererar numera kvartar, och en
   text som säger "kl 19:00–20:00" när priset gäller 19:15–19:30 är fel.
   Klarar även blandad upplösning, om Tibber skulle ändra sig igen. */
function pgIntervall(h){
  var pts=_pgGeo.pts,a=pts[0][0],b=24;
  for(var i=0;i<pts.length;i++){
    if(pts[i][0]<=h){a=pts[i][0];b=(i+1<pts.length)?pts[i+1][0]:24;}
    else break;
  }
  return {a:a,b:b};
}
function pgKl(h){
  var m=Math.round(h*60),hh=Math.floor(m/60)%24,mm=((m%60)+60)%60;
  return (hh<10?'0':'')+hh+':'+(mm<10?'0':'')+mm;
}
function pgX(h){var g=_pgGeo;return g.padL+(h/24)*(g.W-g.padL-g.padR);}
function pgY(v){var g=_pgGeo,yr=(g.yhi-g.ylo)||1;return g.padT+(1-(v-g.ylo)/yr)*(g.H-g.padT-g.padB);}
function pgFarg(v){
  var g=_pgGeo,P=PAL[curTheme]||PAL.dark;
  var t=(g.yhi>g.ylo)?((v-g.ylo)/(g.yhi-g.ylo)):0;
  if(t<0)t=0;if(t>1)t=1;
  return (t<0.5)?blanda(P.green,P.sun,t*2):blanda(P.sun,P.hot,(t-0.5)*2);
}
/* Texten över grafen. Vid nu står det hur många minuter timmen har kvar; drar
   man i strecket står klockslaget för timmen man pekar på i stället.

   Står strecket på nu tas TALET från elprisNow() och inte från kurvan.
   Logikvariablerna är de auktoritativa siffrorna; kurvan är kalibrerad mot dem
   men avrundad, och två olika tal för samma stund vore fel oavsett hur små
   skillnaderna är. Pricken sitter kvar på kurvan — den visar var i dygnet man
   är, inte vilket tal som gäller. */
function pgAvlast(){
  var v=pgPrisVid(_pgVald);
  if(v==null)return null;
  var nuLage=(_pgGeo.offset===0&&Math.abs(_pgVald-pgTimmenNu())<0.02);
  var visa=v;
  if(nuLage){var e=elprisNow();if(e!=null&&isFinite(e))visa=e;}
  var iv=pgIntervall(_pgVald),under;
  if(nuLage){
    /* Tid kvar av INTERVALLET, inte av timmen. */
    var kvar=Math.max(1,Math.ceil((iv.b-pgTimmenNu())*60));
    under=kvar+(kvar===1?' minut kvar':' minuter kvar');
  }else{
    under='kl '+pgKl(iv.a)+'–'+pgKl(iv.b);
  }
  return {kurva:v,visa:visa,under:under,nu:nuLage};
}
/* ===== BATTERIPROCENT I SPOTPRISGRAFEN =====
   Två delar i samma kurva: FAKTISKT från dygnets start till nu (HIST['batt'],
   heldragen) och en PROGNOS framåt (streckad). Prognosen är samma räkning som
   batteribrickans "tid kvar" (battTimeStr): nuvarande effekt antas hålla i sig,
   och laddnivån går linjärt mot 0 % (urladdning) eller 100 % (laddning). Den
   slutar där den når gränsen eller vid 24:00. Ingen hänsyn till pris eller
   sol — det är en rak framskrivning, precis som brickans siffra, och ska läsas
   så. Bara för idag (offset 0): imorgon finns inget "nu" att utgå från. */
/* offset: 0 = idag, 1 = imorgon. Prognosen KAPADES förut vid midnatt, så en
   laddning eller urladdning som pågick över dygnsskiftet såg ut att ta slut
   kl 24. Den räknas nu ut i absoluta timmar från dagens midnatt och klipps mot
   det dygn som ritas — då fortsätter linjen in i imorgon-grafen.
   Uppmätta punkter finns bara för idag; imorgon är enbart prognos. */
function battKurva(offset){
  var kwh=(CFG&&CFG.battkwh)||10;
  var pw=cap(DEV.battery,'measure_power'), pct=cap(DEV.battery,'measure_battery'),
      bs=cap(DEV.battery,'battery_charging_state');
  var d0=dayStart(), nuH=pgTimmenNu();
  var fakt=[];
  var h=HIST['batt']||[];
  for(var i=0;i<h.length;i++){var q=h[i];
    if(!q||q.v==null||!isFinite(q.v)||q.t<d0)continue;
    /* Klocktid; timmen 02–03 som går två gånger när sommartiden slutar får
       inte vända linjen bakåt. */
    var hq=klockTimmar(q.t);if(fakt.length&&hq<fakt[fakt.length-1].h)continue;
    fakt.push({h:hq, v:Math.max(0,Math.min(100,q.v))});}
  /* Ankare vid nu: enhetens nuvarande nivå, så prognosen börjar där bilden slutar. */
  var nuPct=(pct!=null&&isFinite(pct))?Math.max(0,Math.min(100,pct)):(fakt.length?fakt[fakt.length-1].v:null);
  if(nuPct!=null)fakt.push({h:nuH,v:nuPct});
  /* PROGNOSEN (v679) simuleras timme för timme i stället för att dra en rak
     linje från nuvarande effekt. Den raka linjen antog att 1,5 kW laddning
     höll i sig tills batteriet var fullt — mitt i kvällens dyra period, när
     batteriet i själva verket laddar ur. Se battSimulera. */
  var prog=(nuPct!=null)?battSimulera(nuPct,nuH,kwh):[];
  /* Klipp mot det dygn som ritas och räkna om till 0–24 i den grafen. */
  var off=offset||0, a=off*24, b=a+24;
  var kl=function(pts){
    if(pts.length<2)return (off===0)?pts.slice():[];
    var ut=[];
    for(var i=0;i<pts.length-1;i++){
      var p1=pts[i],p2=pts[i+1];
      if(p2.h<a||p1.h>b)continue;
      var q1=p1,q2=p2;
      /* Interpolera vid dygnsgränsen så linjen börjar och slutar exakt där. */
      if(p1.h<a)q1={h:a,v:p1.v+(p2.v-p1.v)*((a-p1.h)/((p2.h-p1.h)||1))};
      if(p2.h>b)q2={h:b,v:p1.v+(p2.v-p1.v)*((b-p1.h)/((p2.h-p1.h)||1))};
      if(!ut.length)ut.push({h:q1.h-a,v:q1.v});
      ut.push({h:q2.h-a,v:q2.v});
    }
    return ut;
  };
  return {fakt:(off===0?fakt:[]),prog:kl(prog),
          nuH:(off===0?nuH:null),nuPct:(off===0?nuPct:null)};
}
/* Läget vid en tidpunkt (absoluta timmar från dagens midnatt) ur nuvarande
   läge och de bokade tiderna. */
function battLageVid(hAbs,nuH,lageNu,bok){
  var lage=lageNu, t=nuH;
  /* Händelser i tidsordning efter nu: start → ladda, spara → spara, stopp → normal. */
  for(var i=0;i<bok.length;i++){var b=bok[i];if(b.h>t&&b.h<=hAbs){lage=b.lage;}}
  return lage;
}
function battSimulera(nuPct,nuH,kwh){
  if(!(kwh>0)||nuPct==null||!isFinite(nuPct))return [];
  var d0=dayStart(),e0=(typeof progDagE==='function')?progDagE(0):null,e1=(typeof progDagE==='function')?progDagE(1):null;
  /* UTAN SOLPROGNOS INGEN PROGNOS (v687). Solprognosen hämtas från appen först
     när solrutan öppnas. Öppnades kostnadsrutan dessförinnan räknades solen
     som noll, och linjen visade ett batteri som laddade ur till golvet mitt
     på förmiddagen medan det i själva verket laddade. Nu hämtas prognosen och
     rutan ritas om; under tiden visas ingen linje hellre än en fel. */
  if(!e0){
    /* Högst ett försök i minuten, och omritning BARA om prognosen faktiskt kom.
       Utan de två villkoren ritade ett misslyckat försök om rutan, som försökte
       igen, i en oändlig slinga (fångad av t56). */
    try{if(typeof progHamta==='function'&&!_battProgVantar&&Date.now()-_battProgForsok>60000){
      _battProgVantar=true;_battProgForsok=Date.now();
      progHamta().then(function(){_battProgVantar=false;
        if(!progDagE(0))return;
        try{if(_dlgWhich==='cost'){var b=$('dlg-body');if(b&&_popupRebuild)b.innerHTML=_popupRebuild();}}catch(e){}},
        function(){_battProgVantar=false;});}}catch(e){}
    return [];
  }
  var solKW=function(h){var dag=(h<24)?e0:e1,i=Math.floor(h%24),v=dag&&dag.timmar?dag.timmar[i]:null;
    return (v!=null&&isFinite(v))?Math.max(0,v)/1000:0;};
  var husNu=houseNowW(),nastaHel=Math.floor(nuH)+1;
  /* PROFILEN SKALAS MOT NULÄGET (v687). Timprofilen är en median över sju
     dygn och drar 4–5 kW mitt på dagen — bil- och poolvärmedagar ingår. När
     huset just nu drar 1,4 kW mot profilens 3,1 visade prognosen ett batteri
     som laddade ur fast det laddade. Profilen skalas därför med kvoten
     nu/profil (0,4–1,6) och glider tillbaka till profilen över sex timmar.
     Kvotens gränser och de sex timmarna är mitt val, inte uppmätta. */
  var prof=function(h){return BATT_LAST_H[Math.floor(h)%24];};
  var kvot=(husNu!=null&&isFinite(husNu)&&prof(nuH)>0)?Math.max(0.4,Math.min(1.6,(husNu/1000)/prof(nuH))):1;
  var lastKW=function(h){
    if(h<nastaHel&&husNu!=null&&isFinite(husNu))return Math.max(0,husNu)/1000;
    var f=Math.max(0,Math.min(1,(h-nuH)/6));
    return prof(h)*(kvot+(1-kvot)*f);};
  /* Läget nu ur växelriktaren, bokningarna ur laddregelns variabler. */
  var L=(typeof regelLage==='function')?regelLage():{fjarr:false};
  /* v704: ur lage. Spara/ladda som inte håller (varn) räknas som normal drift —
     prognosen ska visa det batteriet gör, inte det läget påstår. */
  var lageNu=(L.lage==='ladda'&&!L.varn)?'ladda':((L.lage==='spara'&&!L.varn)?'spara':'normal');
  try{if(typeof regelHamta==='function')regelHamta(false);}catch(e){}
  var R=(typeof _regel!=='undefined')?_regel:null,bok=[],nuMs=Date.now();
  if(R){[['start','ladda'],['spara','spara'],['stopp','normal']].forEach(function(x){var ms=R[x[0]];
    if(ms>nuMs)bok.push({h:klockTimmar(ms),lage:x[1]});});
    bok.sort(function(a,b){return a.h-b.h;});}
  var etaIn=Math.sqrt(BATT_SIM.eta),etaUt=Math.sqrt(BATT_SIM.eta),golv=kwh*BATT_SIM.golv/100;
  var e=kwh*nuPct/100,ut=[{h:nuH,v:nuPct}],st=BATT_SIM.steg,slut=nuH+BATT_SIM.timmar;
  /* Saknas morgondagens solprognos räknas bara natten med (till 06), inte en
     solig förmiddag som noll sol. */
  if(!e1)slut=Math.min(slut,30);
  /* Stegen följer kvartsrutnätet (14:36 → 14:45 → 15:00 …), så en bokning på
     en hel timme slår om läget exakt där och inte mitt i ett steg. */
  for(var h=nuH;h<slut-1e-9;){
    var nasta=Math.min(slut,(Math.floor(h/st+1e-9)+1)*st),dt=nasta-h,mid=h+dt/2,lage=battLageVid(mid,nuH,lageNu,bok);
    var over=solKW(mid)-lastKW(mid),p=0;     /* p: kW in (+) eller ut (−) ur batteriet, AC-sidan */
    if(lage==='ladda')p=BATT_SIM.ladd;
    else if(over>0)p=Math.min(over,BATT_SIM.ladd);
    else if(lage==='normal')p=-Math.min(-over,BATT_SIM.ur);
    if(p>0)e=Math.min(kwh,e+p*etaIn*dt);
    else if(p<0)e=Math.max(golv,e+p/etaUt*dt);
    ut.push({h:nasta,v:Math.round(e/kwh*1000)/10});
    h=nasta;
  }
  return ut;
}
/* Laddnivå vid en timme: faktiskt bakåt (närmaste punkt), prognos framåt
   (interpolerad mellan simuleringens kvartar), null utanför bådadera. */
/* ===== SOLPRODUKTION I SPOTPRISGRAFEN =====
   Faktiskt (uppmätt effekt, W) och prognos (timvärden ur appen, Wh) på en
   gemensam W-skala — en timmes Wh är samma tal som medeleffekten i W, så de
   går att lägga i samma bild. Skalan är egen och normeras mot dygnets högsta,
   precis som batteriets: priset har inget gemensamt mått med varken procent
   eller watt.
   offset: -1 igår, 0 idag, +1 imorgon. Faktiskt finns för igår (sjudygns-
   serien) och idag; imorgon bara prognos. */
function solKurva(offset){
  var off=offset||0, d0=dayStart()+off*86400000;
  var e=(typeof progDagE==='function')?progDagE(off):null;
  var prog=[];
  if(e&&e.timmar&&e.timmar.length===24){
    for(var h=0;h<24;h++){var v=e.timmar[h];
      if(v!=null&&isFinite(v))prog.push({h:h+0.5,v:Math.max(0,v)});}
  }
  var fakt=[];
  if(off<=0){
    var kalla=(off===0)?(HIST['solar']||[]):((HIST7&&HIST7['solar'])||[]);
    var t1=d0+86400000;
    for(var i=0;i<kalla.length;i++){var q=kalla[i];
      if(!q||q.v==null||!isFinite(q.v)||q.v<0||q.v>25000)continue;
      if(q.t<d0||q.t>=t1)continue;
      var hq=klockTimmar(q.t);if(fakt.length&&hq<fakt[fakt.length-1].h)continue;
      fakt.push({h:hq, v:q.v});}
    fakt.sort(function(a,b){return a.h-b.h;});
  }
  var mx=0;
  prog.forEach(function(q){if(q.v>mx)mx=q.v;});
  fakt.forEach(function(q){if(q.v>mx)mx=q.v;});
  if(!(mx>0))return null;
  return {fakt:fakt,prog:prog,max:mx};
}
/* Solvärde vid en timme: faktiskt om det finns där, annars prognosen. */
function solWVid(sk,h){
  if(!sk)return null;
  var b=null,bd=Infinity;
  for(var i=0;i<sk.fakt.length;i++){var d=Math.abs(sk.fakt[i].h-h);if(d<bd){bd=d;b=sk.fakt[i];}}
  if(b&&bd<=0.5)return {v:b.v,prognos:false};
  var p=null,pd=Infinity;
  for(var j=0;j<sk.prog.length;j++){var d2=Math.abs(sk.prog[j].h-h);if(d2<pd){pd=d2;p=sk.prog[j];}}
  return p?{v:p.v,prognos:true}:null;
}
function battPctVid(bk,h){
  if(!bk)return null;
  var P=bk.prog;
  if(P.length>=2&&h>=P[0].h){
    if(h>P[P.length-1].h)return null;
    for(var k=1;k<P.length;k++){if(h<=P[k].h){var a=P[k-1],b=P[k],f=(b.h===a.h)?0:(h-a.h)/(b.h-a.h);
      return a.v+(b.v-a.v)*f;}}
    return P[P.length-1].v;
  }
  var bast=null,bd=Infinity;
  for(var i=0;i<bk.fakt.length;i++){var d=Math.abs(bk.fakt[i].h-h);if(d<bd){bd=d;bast=bk.fakt[i];}}
  return (bast&&bd<=0.5)?bast.v:null;
}
function pgBattText(){
  var bk=_pgGeo&&_pgGeo.batt;if(!bk)return '';
  var v=battPctVid(bk,_pgVald);
  if(v==null)return '';
  var prognos=(bk.prog.length>=2&&_pgVald>bk.prog[0].h+0.02);
  return 'batteri '+Math.round(v)+' %'+(prognos?' (prognos)':'');
}
function pgSolText(){
  var sk=_pgGeo&&_pgGeo.sol;if(!sk)return '';
  var r=solWVid(sk,_pgVald);
  if(!r||r.v==null)return '';
  return 'sol '+fmtW(r.v)+(r.prognos?' (prognos)':'');
}
function pgHuvud(){
  var a=pgAvlast();if(!a)return '';
  var bt=pgBattText();
  return '<div class="pg-nu"><span class="pg-nu-v" id="pg-nu-v" style="color:'+pgFarg(a.kurva)+'">'
    +num(a.visa,2)+' kr</span><span class="pg-nu-e">/kWh</span>'
    +'<span class="pg-nu-s2" id="pg-nu-s2">'+esc(pgSolText())+'</span>'
    +'<span class="pg-nu-b" id="pg-nu-b">'+esc(bt)+'</span></div>'
    +'<div class="pg-nu-s" id="pg-nu-s">'+esc(a.under)+'</div>';
}
/* Ritar om de fyra sakerna som ändras — inte hela popupen. Att bygga om HTML
   under ett pågående drag tappar pekfångsten. */
function pgUppdatera(){
  var a=pgAvlast();if(!a)return;
  var l=$('pg-line'),d2=$('pg-dot'),tv=$('pg-nu-v'),ts=$('pg-nu-s');
  var x=pgX(_pgVald).toFixed(1);
  if(l){l.setAttribute('x1',x);l.setAttribute('x2',x);}
  if(d2){d2.style.left=(pgX(_pgVald)/_pgGeo.W*100).toFixed(2)+'%';d2.style.top=(pgY(a.kurva)/_pgGeo.H*100).toFixed(2)+'%';d2.style.background=pgFarg(a.kurva);}
  if(tv){tv.textContent=num(a.visa,2)+' kr';tv.style.color=pgFarg(a.kurva);}
  if(ts)ts.textContent=a.under;
  var tb=$('pg-nu-b');if(tb)tb.textContent=pgBattText();
  var ts2=$('pg-nu-s2');if(ts2)ts2.textContent=pgSolText();
}
function pgTimmeFran(e){
  var el=$('pg-lager');if(!el||!el.getBoundingClientRect)return null;
  var r=el.getBoundingClientRect();if(!r.width)return null;
  var g=_pgGeo;
  /* SVG:n sträcks med preserveAspectRatio="none", så en andel av bredden är
     samma andel i användarkoordinater. */
  var ux=((e.clientX-r.left)/r.width)*g.W;
  var h=((ux-g.padL)/Math.max(1,(g.W-g.padL-g.padR)))*24;
  return Math.max(0,Math.min(23.999,h));
}
function pgNer(e){
  if(!_pgGeo)return;
  _pgDrag={x0:e.clientX,y0:e.clientY,tagit:false,pid:e.pointerId,start:_pgVald};
}
function pgRor(e){
  var d3=_pgDrag;if(!d3||!_pgGeo)return;
  var dx=e.clientX-d3.x0,dy=e.clientY-d3.y0;
  if(!d3.tagit){
    if(Math.abs(dx)<6&&Math.abs(dy)<6)return;
    if(Math.abs(dy)>Math.abs(dx)){_pgDrag=null;return;}   /* lodrätt = rulla */
    d3.tagit=true;
    var lg=$('pg-lager');if(lg&&lg.classList)lg.classList.add('drar');
    try{lg&&lg.setPointerCapture&&lg.setPointerCapture(d3.pid);}catch(err){}
  }
  var h=pgTimmeFran(e);
  if(h!=null){_pgVald=h;pgUppdatera();}
  e.preventDefault();
}
/* Tillbaka till utgångsläget: nu för idag, dygnets billigaste timme för
   imorgon. Räknas om vid varje anrop så att "nu" verkligen är nu och inte den
   minut grafen råkade ritas. */
function pgHem(){
  if(!_pgGeo)return;
  _pgVald=(_pgGeo.offset===0)?pgTimmenNu():_pgGeo.hem;
  pgUppdatera();
}
function pgUpp(e){
  var d4=_pgDrag;_pgDrag=null;
  var lg=$('pg-lager');if(lg&&lg.classList)lg.classList.remove('drar');
  if(!d4)return;
  /* Släpper man går pricken tillbaka till nu av sig själv. Ett stilla tryck
     flyttar därför ingenting — det skulle bara ha hoppat dit och tillbaka. */
  pgHem();
  try{dlgIdleReset();}catch(err){}
}
function dayPriceGraphSVG(offset){offset=offset||0;
  var franTibber=prisDygn(offset);
  if(franTibber)franTibber=prisKalibrera(franTibber,offset);
  var o=plogDays(),key=dayKey(new Date(Date.now()+offset*86400000));
  var pts=franTibber?franTibber:(o.days[key]||[]).slice();
  if((pts.length<3)&&SOURCE==='demo-data'&&offset===0){pts=[];for(var hh=0;hh<=23.5;hh+=0.5)pts.push([hh,0.55+0.5*Math.sin((hh-3)/24*2*Math.PI)+(hh>16&&hh<21?0.75:0)+0.12*Math.sin(hh*1.7)]);}
  if(pts.length<2){
    var msg=offset>0?'Morgondagens priser blir tillgängliga senare (publiceras oftast runt kl 13).'
      :(_prisFel?('Timpriser saknas: '+_prisFel+'. Kör HomeyScriptet tibberpris.')
                :'Prisdatan byggs upp under dygnet.');
    return '<div class="pgraph-empty">'+msg+'</div>';}
  var P=PAL[curTheme]||PAL.dark,W=280,H=110,padL=6,padR=6,padT=16,padB=16;
  var ys=pts.map(function(p){return p[1];}),xs=pts.map(function(p){return p[0];});
  var ylo=Math.min.apply(null,ys),yhi=Math.max.apply(null,ys),yr=(yhi-ylo)||1;
  var x0=0,x1=24;
  var X=function(v){return padL+(v-x0)/(x1-x0)*(W-padL-padR);};
  var Y=function(v){return padT+(1-(v-ylo)/yr)*(H-padT-padB);};
  var iLo=0,iHi=0;for(var i=1;i<pts.length;i++){if(ys[i]<ys[iLo])iLo=i;if(ys[i]>ys[iHi])iHi=i;}
  /* TRAPPA, INTE LUTNING.
     Kurvan drogs som räta linjer mellan punkterna, och det var därför pricken
     ibland hamnade bredvid linjen: pricken visade intervallets pris (som är
     konstant), medan linjen lutade mellan två intervall. Ett spotpris ändras
     inte gradvis — det gäller oförändrat i hela sitt intervall och byter tvärt.
     Tibbers upplösning är numera 15 minuter, så trappan har fyra steg i timmen.
     Ritad som en trappa hamnar pricken alltid exakt på linjen, och talet över
     grafen säger samma sak som bilden. */
  var slut=function(i){return (i+1<pts.length)?pts[i+1][0]:24;};
  var line='',area='';
  pts.forEach(function(p,i){
    var xa=X(p[0]).toFixed(1),xb=X(slut(i)).toFixed(1),y=Y(p[1]).toFixed(1);
    line+=(i?'L':'M')+xa+' '+y+' L'+xb+' '+y+' ';
  });
  area='M'+X(pts[0][0]).toFixed(1)+' '+(H-padB).toFixed(1)+' '+line.replace('M','L')
    +'L'+X(slut(pts.length-1)).toFixed(1)+' '+(H-padB).toFixed(1)+' Z';
  var s='<svg class="pgraph-svg" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none">';
  /* Ytan under linjen bär numera LINJENS färger. Den var enfärgat blå, vilket
     inte hörde ihop med den gröna-till-röda kurvan ovanför. Färgen kommer från
     samma gradient som linjen; uttoningen nedåt görs med en mask i stället för
     en egen färggradient, eftersom en gradient bara kan ha en riktning och den
     här behöver två — färg i sidled, genomskinlighet i höjdled. */
  s+='<defs><linearGradient id="pgFade" x1="0" y1="0" x2="0" y2="1">'
    +'<stop offset="0%" stop-color="#fff" stop-opacity=".42"/>'
    +'<stop offset="100%" stop-color="#fff" stop-opacity="0"/></linearGradient>'
    +'<mask id="pgMask"><rect x="0" y="0" width="'+W+'" height="'+H+'" fill="url(#pgFade)"/></mask></defs>';
  /* FÄRGSKALA LÄNGS LINJEN: grönt där det är billigast, gult däremellan, rött
     där det är dyrast. Gradienten följer x-led i användarkoordinater och får en
     stopp per timme, så färgen byter där priset gör det. */
  var farg=function(v){
    var t=(yhi>ylo)?((v-ylo)/(yhi-ylo)):0;
    if(t<0)t=0;if(t>1)t=1;
    return (t<0.5)?blanda(P.green,P.sun,t*2):blanda(P.sun,P.hot,(t-0.5)*2);
  };
  /* Två stopp per intervall — ett vid början och ett vid slutet med SAMMA färg
     — så byter färgen tvärt där priset gör det, i takt med trappan. Ett stopp
     per punkt gav en mjuk övertoning som inte hörde ihop med stegen. */
  var stops='';
  var andel=function(x){return Math.max(0,Math.min(100,(x-padL)/Math.max(1,(W-padL-padR))*100));};
  pts.forEach(function(pp,i){
    var c=farg(pp[1]);
    stops+='<stop offset="'+andel(X(pp[0])).toFixed(2)+'%" stop-color="'+c+'"/>'
      +'<stop offset="'+andel(X(slut(i))).toFixed(2)+'%" stop-color="'+c+'"/>';
  });
  s=s.replace('</defs>','<linearGradient id="pgLine" gradientUnits="userSpaceOnUse" x1="'+padL+'" y1="0" x2="'+(W-padR)+'" y2="0">'+stops+'</linearGradient></defs>');
  s+='<path d="'+area+'" fill="url(#pgLine)" mask="url(#pgMask)"/>';
  /* non-scaling-stroke: grafen sträcks i sidled på plattan, och utan det blev
     trappans lodräta steg nästan dubbelt så tjocka som de vågräta. */
  s+='<path d="'+line+'" fill="none" stroke="url(#pgLine)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>';
  /* Markeringarna för högsta och lägsta är borta. Talen står i listan under
     grafen, och två extra prickar konkurrerade med avläsningspunkten om
     uppmärksamheten. iLo räknas fortfarande ut — den används som utgångsläge
     för imorgondagen. */
  var taggar='';
  /* AVLÄSNINGSPUNKTEN. Strecket och pricken hör ihop: pricken sitter där
     strecket skär kurvan, och båda flyttas av samma finger. Utgångsläget är
     nu för idag och dygnets billigaste timme för imorgon — imorgon har inget
     "nu" att peka på. */
  /* Imorgon börjar avläsningen längst till vänster (00:00) i stället för vid
     dygnets billigaste timme: man läser morgondagen framifrån. Draget fungerar
     som förut — hVal är bara utgångsläget. */
  var hVal=(offset===0)?pgTimmenNu():xs[0];
  /* BATTERIPROCENTEN, bara idag. Egen skala: 0 % vid grafens botten, 100 %
     vid taket — priset och procenten har inget gemensamt mått. Heldragen där
     det är uppmätt, streckad där det är framskrivet. Cyan som i batterirutan. */
  /* Batteriet ritas nu även i imorgon-grafen, så en laddning som pågår över
     midnatt går att följa. Igår har ingen prognos att visa. */
  var bk=(_pgVisaBatt&&offset>=0&&offset<=1)?battKurva(offset):null;
  var YP=function(v){return padT+(1-Math.max(0,Math.min(100,v))/100)*(H-padT-padB);};
  /* SOLEN. Egen skala normerad mot dygnets högsta, så kurvans form syns även
     en mulen dag. Faktiskt heldraget, prognos streckat — samma språk som
     batteriet och som sol-nu-rutan. */
  var sk=_pgVisaSol?solKurva(offset):null;
  if(sk){
    var YS=function(v){return padT+(1-Math.max(0,Math.min(1,v/sk.max)))*(H-padT-padB);};
    if(sk.prog.length>1){
      var sp='';sk.prog.forEach(function(q,i){sp+=(i?'L':'M')+X(q.h).toFixed(1)+' '+YS(q.v).toFixed(1)+' ';});
      s+='<path d="'+sp+'" fill="none" stroke="'+(P.sun||'#f2b705')+'" stroke-width="1.8" stroke-dasharray="4 3" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity=".7"/>';
    }
    if(sk.fakt.length>1){
      var sf='';sk.fakt.forEach(function(q,i){sf+=(i?'L':'M')+X(q.h).toFixed(1)+' '+YS(q.v).toFixed(1)+' ';});
      s+='<path d="'+sf+'" fill="none" stroke="'+(P.sun||'#f2b705')+'" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity=".9"/>';
    }
  }
  /* Nollinjen (v687): prisets nolla om skalan går dit, annars batteriets 0 %
     längst ned när batterikurvan visas. */
  var _np=nollY(Y,ylo,yhi);
  s+=(_np!=null)?nollLinje(_np,padL,W-padR):(bk?nollLinje(YP(0),padL,W-padR):'');
  if(bk&&bk.fakt.length>1){
    var bd='';bk.fakt.forEach(function(q,i){bd+=(i?'L':'M')+X(q.h).toFixed(1)+' '+YP(q.v).toFixed(1)+' ';});
    s+='<path d="'+bd+'" fill="none" stroke="'+(P.cyan||'#57b6c2')+'" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity=".9"/>';
  }
  if(bk&&bk.prog.length>=2){
    s+='<path d="'+bk.prog.map(function(q,i){return (i?'L':'M')+X(q.h).toFixed(1)+' '+YP(q.v).toFixed(1);}).join(' ')
      +'" fill="none" stroke="'+(P.cyan||'#57b6c2')+'" stroke-width="1.8" stroke-dasharray="4 3" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity=".75"/>';
  }
  _pgGeo={W:W,H:H,padL:padL,padR:padR,padT:padT,padB:padB,pts:pts,offset:offset,ylo:ylo,yhi:yhi,hem:hVal,batt:bk,sol:sk};
  _pgVald=hVal;
  var vy=pgPrisVid(hVal);
  s+='<line class="pg-now" id="pg-line" x1="'+X(hVal).toFixed(1)+'" y1="'+padT+'" x2="'+X(hVal).toFixed(1)+'" y2="'+(H-padB)+'" vector-effect="non-scaling-stroke"/>';
  /* v767: PRICKEN ÄR HTML, inte en <circle>. SVG:n sträcks i sidled och en
     cirkel blev en ellips på plattan. Som etiketterna placeras den i procent
     ovanpå grafen och ritas i skärmens pixlar – rund på alla bredder. */
  taggar+='<span class="pg-dot" id="pg-dot" style="left:'+(X(hVal)/W*100).toFixed(2)+'%;top:'+(Y(vy==null?ys[0]:vy)/H*100).toFixed(2)+'%;background:'+farg(vy==null?ys[0]:vy)+'"></span>';
  s+='</svg>';
  /* Grafen och etiketterna i samma ruta: SVG:n sträcks, texten gör det inte. */
  s='<div class="pgraph-lager" id="pg-lager" onpointerdown="pgNer(event)" onpointermove="pgRor(event)"'
    +' onpointerup="pgUpp(event)" onpointercancel="pgUpp(event)">'+s+taggar+'</div>';
  s=pgHuvud()+s;
  s+='<div class="pgraph-x"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>';
  /* Av/på för extrakurvorna. Batteriet finns för idag och imorgon — prognosen
     utgår från "nu" och kan sträcka sig förbi midnatt. Solen för alla tre. */
  var lag='<div class="pg-lager">';
  if(offset>=0&&offset<=1)lag+='<span class="'+(_pgVisaBatt?'':'av')+'" onclick="pgLagerTog(\'batt\')">'
    +'<i style="background:'+(P.cyan||'#57b6c2')+'"></i>Batteri %</span>';
  lag+='<span class="'+(_pgVisaSol?'':'av')+'" onclick="pgLagerTog(\'sol\')">'
    +'<i style="background:'+(P.sun||'#f2b705')+'"></i>Solproduktion</span>';
  s+=lag+'</div>';
  return s;}
function pgLagerTog(vilket){
  if(vilket==='batt')_pgVisaBatt=!_pgVisaBatt; else _pgVisaSol=!_pgVisaSol;
  var b=$('dlg-body');if(b&&_popupRebuild)b.innerHTML=_popupRebuild();
}
function priceDaySet(o){_priceDay=o;openDetail('cost');}
function priceCurveSVG(){let o=plogGet();const cur=elprisNow();
  if((!o||o.pts.length<3)&&SOURCE==='demo-data'){o={day:'demo',pts:[]};for(let hh2=0;hh2<=23.5;hh2+=0.5){o.pts.push([hh2,0.6+0.5*Math.sin((hh2-3)/24*2*Math.PI)+(hh2>16&&hh2<21?0.7:0)+0.15*Math.sin(hh2*1.7)]);}}
  if(!o||o.pts.length<3)return '';
  const P=PAL[curTheme]||PAL.dark,W2=264,H2=76,pad=4;
  const xs=o.pts.map(p=>p[0]),ys=o.pts.map(p=>p[1]);
  const x0=0,x1=24,ylo=Math.min.apply(null,ys),yhi=Math.max.apply(null,ys),yr=(yhi-ylo)||1;
  const X=v=>pad+(v-x0)/(x1-x0)*(W2-2*pad),Y=v=>H2-pad-(v-ylo)/yr*(H2-2*pad);
  let d='';o.pts.forEach((p,i)=>{d+=(i?'L':'M')+X(p[0]).toFixed(1)+' '+Y(p[1]).toFixed(1)+' ';});
  const now=new Date(),hNow=now.getHours()+now.getMinutes()/60;
  /* v713: pricken vid "nu" satt där linjen slutar (loggen går fram till nu) – borta. */
  const mark='';
  return '<div class="pcurve"><svg viewBox="0 0 '+W2+' '+H2+'" preserveAspectRatio="none">'
    +nollLinje(nollY(Y,ylo,yhi),pad,W2-pad)
    +'<path d="'+d+'" fill="none" stroke="'+P.blue+'" stroke-width="2" stroke-linecap="round"/>'+mark+'</svg>'
    +'<div class="pcurve-x"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>'
    +'<div class="pcurve-y">'+num(ylo,2)+'–'+num(yhi,2)+' kr/kWh idag</div></div>';}
/* dygnslogg (7 dagar) */
function daysGet(){try{return JSON.parse(localStorage.getItem('days_v1')||'{}');}catch(e){return {};}}
/* Lokal datumnyckel. toISOString() är UTC – med svensk sommartid bytte dygnet
   först kl 02:00, så kvällens värden hamnade fel dygn. */
function dayKey(d){d=d||new Date();
  try{return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}
  catch(e){var z=new Date(d.getTime()-d.getTimezoneOffset()*60000);return z.toISOString().slice(0,10);}}
function dayKeyAgo(n){return dayKey(new Date(Date.now()-n*86400000));}
function progLogGet(){try{const o=JSON.parse(localStorage.getItem(PROGLOG_KEY)||'{}');
  return (o&&typeof o==='object')?o:{};}catch(e){return {};}}
function progLogTick(){
  if(!_prog||!_prog.dagar)return;
  const idag=dayKey(),o=progLogGet();
  let andrat=false;
  Object.keys(_prog.dagar).forEach(function(d){
    const e=_prog.dagar[d];
    if(!e||e.summa_prognos==null||!isFinite(e.summa_prognos))return;
    /* summa_prognos kommer i Wh från appen; utfallet (dagar[d].sol) är kWh.
       Loggen sparade Wh rakt av — 2026-08-29 stod 60653 mot utfall 10,9, och
       felkolumnen blev 60642. Dela med 1000, som appen själv gör. */
    const v=Math.round(e.summa_prognos/1000*10)/10;
    const rad=o[d]||(o[d]={});
    if(d>idag){ if(rad.f1!==v){rad.f1=v;andrat=true;} }        /* framtiden: skriv om tills dygnet borjar */
    else if(d===idag){ if(rad.f0!==v){rad.f0=v;andrat=true;} } /* idag: sista vardet vinner */
  });
  /* Utfallet fylls pa nar det finns. Gar bakat sa att en dag som loggades utan
     utfall far det ifyllt nasta dygn. */
  const dagar=daysGet();
  Object.keys(o).forEach(function(d){
    const a=dagar[d]&&dagar[d].sol;
    if(a!=null&&isFinite(a)&&o[d].a!==a){o[d].a=a;andrat=true;}
  });
  const k=Object.keys(o).sort();
  while(k.length>PROGLOG_DYGN){delete o[k.shift()];andrat=true;}
  if(andrat){try{localStorage.setItem(PROGLOG_KEY,JSON.stringify(o));}catch(e){}}
}
/* Sammanfattning over de dygn som har bade prognos och utfall.
   bias  = medelfel med tecken. Positivt betyder att prognosen TAR I.
   mae   = medelfel utan tecken, alltsa hur mycket den brukar bomma.
   Bada i procent av utfallet, for annars dominerar sommarens stora tal. */
function progStat(falt,dygn){
  /* Dygnet som pagar raknas ALDRIG. Klockan tio har solen levererat en brakdel
     av dygnet, och en jamforelse mot en helgdagsprognos gor att prognosen ser
     hopplos ut. Bara avslutade dygn. */
  const idagK=dayKey();
  const o=progLogGet(),k=Object.keys(o).filter(function(d){return d<idagK;}).sort();
  const start=dygn?k.slice(-dygn):k;
  let n=0,sb=0,sa=0,sp=0,su=0;
  start.forEach(function(d){
    const r=o[d];
    if(!r||r[falt]==null||r.a==null||!(r.a>0.5))return;   /* mulna vinterdygn ger vansinniga procent */
    const fel=r[falt]-r.a;
    n++;sb+=fel/r.a;sa+=Math.abs(fel)/r.a;sp+=r[falt];su+=r.a;
  });
  if(!n)return null;
  return {n:n,bias:sb/n*100,mae:sa/n*100,prognos:sp,utfall:su};
}
/* Exporten. Semikolon och svenskt decimaltecken, sa den kan oppnas rakt av -
   men den ar framst till for att klistras in i en chatt. */
function progLogCSV(){
  /* Samma regel som i statistiken: dygn som inte ar klara hor inte hemma i en
     fil som ska anvandas for att kalibrera. Dagens prognos star kvar i loggen
     och kommer med i morgon. */
  const idagK=dayKey();
  const o=progLogGet(),k=Object.keys(o).filter(function(d){return d<idagK;}).sort();
  const nr=function(v){return v==null?'':String(Math.round(v*10)/10).replace('.',',');};
  let ut='datum;prognos_dagen_innan;prognos_samma_dag;utfall;fel_dagen_innan;fel_samma_dag\n';
  k.forEach(function(d){
    const r=o[d];
    const e1=(r.f1!=null&&r.a!=null)?(r.f1-r.a):null;
    const e0=(r.f0!=null&&r.a!=null)?(r.f0-r.a):null;
    ut+=d+';'+nr(r.f1)+';'+nr(r.f0)+';'+nr(r.a)+';'+nr(e1)+';'+nr(e0)+'\n';
  });
  return ut;
}
function progLogText(){
  const a=progStat('f1'),b=progStat('f0'),a30=progStat('f1',30);
  let h='';
  const rad=function(n,st){
    if(!st)return dRow(n,'inga dygn med bade prognos och utfall');
    return dRow(n,'<b>'+(st.bias>0?'+':'')+num(st.bias,0)+' %</b> snitt · '
      +num(st.mae,0)+' % bom · '+st.n+' dygn');
  };
  h+=dSec('Traffsakerhet');
  h+=rad('Dagen innan',a);
  h+=rad('Samma dag',b);
  h+=rad('Dagen innan, 30 dygn',a30);
  h+='<div class="setup-t">Positivt snitt betyder att prognosen tar i, negativt att '
    +'den ar forsiktig. Bommen ar medelfelet utan tecken - hur mycket den brukar '
    +'missa, at bada hallen. Dygn under 0,5 kWh raknas inte: da blir procenten vanvettig.</div>';
  return h;
}
/* TIMVIS EXPORT — prognos per timme mot uppmätt effekt per timme.
   Dygnssummorna säger OM prognosen bommar; timvärdena säger NÄR på dagen och
   därmed varför — en molnkoefficient som tar fel på morgonsolen syns bara här.
   Prognosen finns per timme i _prog.dagar[d].timmar[h] (Wh, mitt i timmen).
   Faktiskt kommer ur HIST7['solar'], som är effektpunkter (W) från Insights
   över de senaste dygnen; de medelvärdesbildas per timme i svensk tid, vilket
   ger ungefär Wh för den timmen. Bara timmar som HAR ett mätvärde tas med — en
   tom timme är inte noll produktion, den är okänd, och en påhittad nolla skulle
   dra kalibreringen fel.
   Bara ~7 dygn bakåt: längre bak finns ingen timvis faktiskt. */
function progTimKey(t){
  try{var f=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',year:'numeric',
    month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'});
    var p={};f.formatToParts(new Date(t)).forEach(function(x){p[x.type]=x.value;});
    return {dag:p.year+'-'+p.month+'-'+p.day,tim:parseInt(p.hour,10)};
  }catch(e){var d=new Date(t);return {dag:'?',tim:d.getHours()};}
}
function progTimCSV(){
  if(!_prog||!_prog.dagar)return '';
  var sol=HIST7&&HIST7['solar'];
  if(!sol||!sol.length)return '';
  /* Summera faktiska effektpunkter per dag+timme: medelvärde × 1 h ≈ Wh. */
  var bucket={};
  for(var i=0;i<sol.length;i++){
    var pt=sol[i];
    if(!pt||pt.v==null||!isFinite(pt.v))continue;
    var k=progTimKey(pt.t),nyckel=k.dag+'|'+k.tim;
    var b=bucket[nyckel]||(bucket[nyckel]={s:0,n:0});
    b.s+=pt.v;b.n++;
  }
  var nr=function(v){return v==null?'':String(Math.round(v)).replace('.',',');};
  var ut='datum;timme;prognos_wh;faktiskt_wh;fel_wh\n';
  var dagar=Object.keys(_prog.dagar).sort();
  var rader=0;
  dagar.forEach(function(d){
    var e=_prog.dagar[d];
    if(!e||!e.timmar||e.timmar.length!==24)return;
    for(var h=0;h<24;h++){
      var b=bucket[d+'|'+h];
      if(!b||!b.n)continue;                 /* ingen mätning den timmen: hoppa */
      var fakt=b.s/b.n;                      /* medeleffekt W ≈ Wh för timmen */
      var prog=e.timmar[h];
      if((prog==null||prog<1)&&fakt<1)continue;   /* natt: båda ~0, ointressant */
      var fel=(prog!=null)?(prog-fakt):null;
      ut+=d+';'+String(h).padStart(2,'0')+';'+nr(prog)+';'+nr(fakt)+';'+nr(fel)+'\n';
      rader++;
    }
  });
  return rader?ut:'';
}
function progTimKopiera(){
  var t=document.querySelector('.prog-exp-tim');
  var klar=function(ok){try{toast(ok?'Kopierat':'Markera i rutan och kopiera for hand');}catch(e){}};
  if(!t){klar(false);return;}
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(t.value).then(function(){klar(true);},function(){
        t.select();var o=false;try{o=document.execCommand('copy');}catch(e){}klar(o);});
      return;
    }
  }catch(e){}
  t.select();var o=false;try{o=document.execCommand('copy');}catch(e){}klar(o);
}
/* Kroppen bruten ut så den timvisa hämtningens callback kan rita om rutan när
   Insights svarat, utan att bygga hela popupen på nytt. */
function progLoggBody(){

  const csv=progLogCSV(),rader=csv.split('\n').length-2;
  let h=progLogText();
  h+=dSec('Export · per dygn')
    +'<div class="setup-t">'+rader+' dygn med både prognos och utfall. Markera allt '
    +'i rutan och klistra in i chatten så går det att kalibrera mot.</div>'
    +'<textarea class="prog-exp" readonly onclick="this.select()">'+esc(csv)+'</textarea>'
    +'<div class="dbtn-row"><button class="dbtn" onclick="progKopiera()">Kopiera dygn</button></div>';
  /* Timvis export. Kräver Insights-serien (HIST7), som hämtas separat — be om
     den om den saknas och rita om rutan när den kommit. */
  var tcsv=progTimCSV();
  var trad=tcsv?(tcsv.split('\n').length-2):0;
  h+=dSec('Export · per timme')
    +'<div class="setup-t">'
    +(tcsv
      ? (trad+' timmar från de senaste dygnen — prognos mot uppmätt effekt, timme '
         +'för timme. Säger inte bara hur mycket prognosen bommar utan när på '
         +'dagen. Bäst underlag att kalibrera mot.')
      : (_progTimBegard
         ? ('Ingen timvis solserie kom från Insights. Den byggs av Insights-loggen '
            +'för solpanelerna och finns bara för de senaste ~7 dygnen — saknas '
            +'den går dygnsexporten ovan att kalibrera mot i stället.')
         : 'Timdata hämtas från Homey Insights… rutan fylls på av sig själv.'))
    +'</div>'
    +(tcsv
      ? ('<textarea class="prog-exp prog-exp-tim" readonly onclick="this.select()">'+esc(tcsv)+'</textarea>'
         +'<div class="dbtn-row"><button class="dbtn" onclick="progTimKopiera()">Kopiera timmar</button></div>')
      : '');
  /* Utan HIST7 finns ingen timvis faktiskt — hämta EN gång och rita om.
     HÄR HÄNGDE RUTAN: omritningen anropar progLoggBody på nytt, som startade
     ännu en hämtning, som ritade om igen. Saknas soldata blir tcsv tom varje
     varv, och eftersom hämtningen har tiominuterscache returnerar den direkt —
     loopen snurrade så fort webbläsaren orkade och rutan frös.
     Flaggan gör försöket engångs. Den nollställs när rutan öppnas, så ett nytt
     försök görs nästa gång man går in. */
  if(!tcsv&&!_progTimBegard){
    _progTimBegard=true;
    try{
      /* force=true: en cachad men TOM serie är just det fall vi står i, och
         då hjälper det inte att få tillbaka den oförändrad. */
      Promise.resolve(hist7Hamta?hist7Hamta(true):null).then(function(){
        if(_dlgWhich==='proglogg'){var b=$('dlg-body');if(b)b.innerHTML=progLoggBody();}
      },function(){});
    }catch(e){}
  }
  return h;
}
function openProgLogg(){
  _dlgWhich='proglogg';
  _progTimBegard=false;          /* nytt försök varje gång rutan öppnas */
  var h=progLoggBody();
  const dlg=$('dlg');if(dlg&&dlg.classList){dlg.classList.remove('wide');dlg.classList.remove('edit');}
  _popupRebuild=null;
  setT('dlg-title','Solprognos · träffsäkerhet');setIcon('dlg-ic','sun');dlgAga();
  const bd=$('dlg-body');if(bd)bd.innerHTML=h;
  const bk=$('dlg-back');if(bk&&bk.classList)bk.classList.add('open');
  dlgTop();
}
/* Dashboarden serveras over HTTPS fran GitHub Pages, alltsa secure context.
   navigator.clipboard fungerar och ar det ratta valet; execCommand ligger kvar
   som reserv for gamla webblasare, inte som huvudvag. Jag hade det omvant
   forst, pa antagandet att sidan kordes over ren http. */
function progKopiera(){
  const t=document.querySelector('.prog-exp');
  if(!t)return;
  const klar=function(ok){try{toast(ok?'Kopierat':'Markera i rutan och kopiera for hand');}catch(e){}};
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(t.value).then(function(){klar(true);},function(){
        t.select();var o=false;try{o=document.execCommand('copy');}catch(e){}klar(o);
      });
      return;
    }
  }catch(e){}
  t.select();
  var o=false;try{o=document.execCommand('copy');}catch(e){}
  klar(o);
}
function dayLogTick(){const day=dayKey(),sol=cap(DEV.solar,'meter_power.day'),cost=cap(DEV.pulse,'accumulatedCost');
  const o=daysGet();const e=o[day]||(o[day]={sol:0,cost:0});
  if(sol!=null&&sol>e.sol)e.sol=Math.round(sol*10)/10;if(cost!=null&&cost>e.cost)e.cost=Math.round(cost*100)/100;
  /* dygnets extremer – underlag för rekord längre fram */
  const t=cap(DEV.outdoor,'measure_temperature');
  if(t!=null&&isFinite(t)){if(e.tx==null||t>e.tx)e.tx=Math.round(t*10)/10;if(e.tn==null||t<e.tn)e.tn=Math.round(t*10)/10;}
  const g=byMs();if(g!=null&&isFinite(g)&&(e.g==null||g>e.g))e.g=Math.round(g*10)/10;
  const pl=cap(DEV.pooltemp,'measure_temperature');if(pl!=null&&isFinite(pl)&&(e.px==null||pl>e.px))e.px=Math.round(pl*10)/10;
  const keys=Object.keys(o).sort();while(keys.length>DAYS_KEEP){delete o[keys.shift()];}
  try{localStorage.setItem('days_v1',JSON.stringify(o));}catch(e2){}}
/* Årsrekord lagras kompakt: bara rekordet + datum + hur många dygn som räknats in.
   Ett par hundra tecken istället för ett helt års dagslogg. Dagens värden vävs in
   först när dygnet är avslutat, så "slår dagens värde rekordet?" går att svara på. */
function recsGet(){try{return JSON.parse(localStorage.getItem('recs_v1')||'null');}catch(e){return null;}}
function recsTick(){
  var o=daysGet(),tk=dayKey(),yr=+tk.slice(0,4),r=recsGet();
  if(!r||r.y!==yr)r={y:yr,n:0,last:'',sol:null,tx:null,tn:null,g:null,px:null};
  Object.keys(o).sort().forEach(function(k){
    if(k===tk)return;                       /* dagens dygn är inte klart */
    if(r.last&&k<=r.last)return;            /* redan inräknat */
    if(k.slice(0,4)!==String(yr))return;
    var e=o[k];
    REC_F.forEach(function(fd){var f=fd[0],lo=fd[1],v=e[f];
      if(v==null||!isFinite(v))return;
      if(!r[f]||(lo?(v<r[f].v):(v>r[f].v)))r[f]={v:v,d:k};});
    r.n++;r.last=k;
  });
  try{localStorage.setItem('recs_v1',JSON.stringify(r));}catch(e){}}
/* Största tidsspann där dagens värde slår alla andra – men BARA om loggen
   faktiskt täcker spannet (≥90% av dygnen). Påståendet växer därmed av sig
   självt från "den här veckan" till "i år" i takt med att loggen fylls på. */
function dayScopeBest(field,lower,liveCur){
  var o=daysGet(),tk=dayKey(),cur=(o[tk]?o[tk][field]:null);
  if(liveCur!=null&&isFinite(liveCur)&&(cur==null||(lower?liveCur<cur:liveCur>cur)))cur=liveCur;
  if(cur==null||!isFinite(cur))return null;
  var now=new Date(),yr=tk.slice(0,4),mo=tk.slice(0,7),dom=+tk.slice(8,10);
  var doy=Math.floor((now-new Date(now.getFullYear(),0,0))/86400000);
  var wk=[];for(var i=1;i<=7;i++)wk.push(dayKeyAgo(i));
  var ks=Object.keys(o).filter(function(k){return k!==tk&&o[k]&&o[k][field]!=null&&isFinite(o[k][field]);});
  /* År: ur det kompakta årsrekordet – men bara om det täcker (nästan) hela året hittills */
  var R=recsGet();
  if(R&&R.y===+yr&&R[field]&&R.n>=Math.max(60,(doy-1)*0.9)){
    var rv=R[field].v;
    if(lower?(cur<rv):(cur>rv))return {scope:'i år',prev:rv,n:R.n,cur:cur,date:R[field].d};
  }
  var scopes=[
    {lab:'den här månaden', keys:ks.filter(function(k){return k.slice(0,7)===mo;}),  need:Math.max(6,(dom-1)*0.9)},
    {lab:'den här veckan',  keys:ks.filter(function(k){return wk.indexOf(k)>=0;}),   need:5}
  ];
  for(var j=0;j<scopes.length;j++){
    var sc=scopes[j];if(sc.keys.length<sc.need)continue;
    var vals=sc.keys.map(function(k){return o[k][field];});
    var ext=lower?Math.min.apply(null,vals):Math.max.apply(null,vals);
    if(lower?(cur<ext):(cur>ext))return {scope:sc.lab,prev:ext,n:vals.length,cur:cur};
  }
  return null;}
/* Hur mycket ett värde rört sig sedan i morse (ur 24h-historiken) */
function histTodayDelta(key){var a=HIST[key];if(!a||a.length<3)return null;
  var t0=dayStart(),seg=[];for(var i=0;i<a.length;i++){if(a[i].t>=t0&&a[i].v!=null&&isFinite(a[i].v))seg.push(a[i]);}
  if(seg.length<3)return null;
  var mn=seg[0].v,mx=seg[0].v;
  for(var j=0;j<seg.length;j++){if(seg[j].v<mn)mn=seg[j].v;if(seg[j].v>mx)mx=seg[j].v;}
  return {from:seg[0].v,to:seg[seg.length-1].v,d:seg[seg.length-1].v-seg[0].v,min:mn,max:mx,n:seg.length,
          t0:seg[0].t,t1:seg[seg.length-1].t};}
/* Prisfördelning ur inlärningsloggen – för att avgöra vad som är ovanligt */
function priceStats(){var e=null;try{e=learnGet()['price'];}catch(x){}
  if(!e||!e.s||e.s.length<50)return null;
  var v=e.s.map(function(x){return x[1];}).filter(function(x){return x!=null&&isFinite(x);}).sort(function(a,b){return a-b;});
  if(v.length<50)return null;
  var q=function(pp){return v[Math.min(v.length-1,Math.floor(v.length*pp))];};
  return {p05:q(0.05),p95:q(0.95),med:q(0.5),min:v[0],max:v[v.length-1],n:v.length};}
function yspann(lo,hi){
  var mitt=(hi+lo)/2;
  var golv=Math.abs(mitt)*Y_MIN_ANDEL;
  if(!(golv>0))golv=1;                  /* serie kring noll: en enhet räcker */
  var spann=hi-lo;
  if(spann>=golv)return {lo:lo,hi:hi};
  return {lo:mitt-golv/2,hi:mitt+golv/2};
}
function histSVG(key,cfg,cid){const e=learnGet()[key];let pts=e&&e.s?e.s.slice():[];
  /* Lång period: Insights timvärden + det som lärts in efter dem. Inlärda
     serier lagras som [t,v]-par. */
  if(cid&&grafLang(cid)){const l=histV(key,cid,[]);
    if(l.length){const sist=l[l.length-1].t;pts=l.map(q=>[q.t,q.v]).concat(pts.filter(q=>q[0]>sist));}}
  const now=Date.now();
  /* Har grafen ett eget id får den också helskärm — annars blir bara vissa av
     brickrutorna fullständiga, vilket var precis skillnaden mellan poolgrafen
     och poolrummets. */
  if(cid)_grafByggare[cid]={titel:(cfg&&cfg.label)||'Historik',
    full:function(c){return histSVG(key,cfg,c||cid);}};
  const fen=cid?grafFonster(cid):null;
  if(pts.length<4&&SOURCE==='demo-data'){const base=metricNumber(cfg);const b=(base==null||!isFinite(base))?100:base;pts=[];for(let i=48;i>=0;i--){const t=now-i*1800000;const wob=1+0.35*Math.sin(i/4)+0.12*Math.sin(i*1.3)+(Math.random()-0.5)*0.1;pts.push([t,Math.max(0,b*wob)]);}}
  if(pts.length<4)return '<div class="viz-empty">Samlar in data… grafen fylls på efter hand.</div>';
  const cut=fen?fen.t0:(now-48*3600000);let seg=pts.filter(p=>p[0]>=cut);if(seg.length<4&&!fen)seg=pts.slice(-48);
  if(seg.length<2)return '<div class="viz-empty">För få mätvärden i det valda fönstret.</div>';
  const P=PAL[curTheme]||PAL.dark,col=P[accColor(metricIcon(cfg))]||P.blue,W2=300,H2=HIST_H,pad=5;
  const t0=seg[0][0],t1=seg[seg.length-1][0]||now,tr=(t1-t0)||1;
  const ys=seg.map(p=>p[1]);
  const _sp=yspann(Math.min.apply(null,ys),Math.max.apply(null,ys));
  const ylo=_sp.lo,yhi=_sp.hi,yr=(yhi-ylo)||Math.max(1,Math.abs(yhi)||1);
  const X=t=>pad+(t-t0)/tr*(W2-2*pad),Y=v=>H2-pad-(v-ylo)/yr*(H2-2*pad);
  /* Mjuk kurva som i alla andra grafer — brutna linjer här och mjuka där var
     den mest iögonfallande stilskillnaden mellan graferna. */
  const d=smoothPath(seg.map(p=>[X(p[0]),Y(p[1])]));
  const area=d+' L'+X(seg[seg.length-1][0]).toFixed(1)+' '+(H2-pad)+' L'+X(seg[0][0]).toFixed(1)+' '+(H2-pad)+' Z';
  const spanH=Math.round(tr/3600000),unit=(cfg&&cfg.unit)?cfg.unit:'';
  let svgm='<svg viewBox="0 0 '+W2+' '+H2+'" preserveAspectRatio="none">'
    +nollLinje(nollY(Y,ylo,yhi),pad,W2-pad)
    +'<path d="'+area+'" fill="'+col+'" opacity=".10"/>'
    +'<path d="'+d+'" fill="none" stroke="'+col+'"'+GRAF_LINJE+'/></svg>';   /* v713: ingen slutprick */
  /* Insiktsserien lagras som [t,v]-par, inte som {t,v}. Modulen läser {t,v},
     så den ritade listan skrivs om — inte råserien. */
  svgm=avlLager(cid||('hist-'+key),svgm,{W:W2,H:H2,X:X,
    ser:[{namn:'',farg:col,pts:seg.map(function(q){return {t:q[0],v:q[1]};}),Y:Y,
      /* Decimalen styrs av seriens SPANN, inte av talets storlek. Regeln
         "under tio ger en decimal" avrundade badtemperaturen 15,9 till 16 —
         hela variationen i den grafen är tre grader, så decimalen är det enda
         som säger något. Ett ppm-värde mellan 400 och 1200 behöver den inte. */
      fmt:function(v){return num(v,(yhi-ylo)<20?1:0)+(unit?' '+unit:'');}}]});
  return '<div class="viz">'+svgm
    +'<div class="viz-cap">senaste '+spannTxt(tr)+' · '+num(ylo,ylo<10?1:0)+'–'+num(yhi,yhi<10?1:0)+(unit?' '+unit:'')+'</div></div>';}
function metricVizIsBars(cfg){if(!cfg||cfg.type!=='computed')return false;return ['solday','solyear','boughtyear','soldyear','sold','bought'].indexOf(cfg.key)>=0;}
/* cid: ett stabilt id per mätvärde, så fönstervalet hör ihop med just den
   brickan och inte med någon annan graf. */
function metricVizCid(cfg){return 'm:'+histKeyFor(cfg);}
function metricVizHTML(cfg){if(!cfg||cfg.graph===false)return '';
  if(cfg.type==='computed'){const k=cfg.key;
    if(k==='spot'||k==='cost')return priceCurveSVG();
    if(k==='solday'||k==='solyear')return dayBarsHTML('sol','kWh sol per dag','sun');
    if(k==='boughtyear'||k==='soldyear'||k==='sold'||k==='bought')return dayBarsHTML('cost','kr per dag','warm');
    if(k==='poolheat'||k==='dish')return '';}
  if(metricNumber(cfg)==null)return '';
  const cid=metricVizCid(cfg);
  const g=histSVG(histKeyFor(cfg),cfg,cid);
  /* v748: Väder-sidans rutor (vsub) får samma grafrubrik som rumsrutorna. */
  const rub=(g&&cfg.vsub)?grafRubrik(cid,computeMetric(cfg).label):'';
  /* Tidsval och helskärm bara när det finns en graf att styra. */
  return g?(rub+g+grafTidsval(cid)):'';}
function dayBarsHTML(field,unit,color){let o=daysGet();let keys=Object.keys(o).sort();
  if(keys.length<2&&SOURCE==='demo-data'){o={};const t=Date.now();for(let i=6;i>=0;i--){const d=new Date(t-i*86400000).toISOString().slice(0,10);o[d]={sol:30+Math.round(Math.random()*80),cost:8+Math.round(Math.random()*35)};}keys=Object.keys(o).sort();}
  if(keys.length<2)return '';
  keys=keys.slice(-7);const P=PAL[curTheme]||PAL.dark,col=P[color]||P.blue;
  const vals=keys.map(k=>o[k][field]||0),mx=Math.max.apply(null,vals)||1,DN=['sö','må','ti','on','to','fr','lö'];
  let h='<div class="dbars">';
  keys.forEach((k,i)=>{const v=vals[i],hh2=Math.max(3,Math.round(v/mx*44));
    h+='<div class="dbar"><span class="dbar-v">'+num(v,v<10?1:0)+'</span><i style="height:'+hh2+'px;background:'+col+'"></i><span class="dbar-d">'+DN[new Date(k).getDay()]+'</span></div>';});
  return h+'</div><div class="dbar-cap">senaste dagarna · '+unit+'</div>';}
async function ensureFlows(){if(_flows||!BASE)return;const tk=CONFIG.WRITE_TOKEN||CONFIG.TOKEN;
  try{const t=withTimeout(6000);const r=await fetch(BASE.replace(/\/$/,'')+'/api/manager/flow/flow/',{headers:{Authorization:'Bearer '+tk},signal:t.signal});t.clear();
    let out=[];if(r.ok){const j=await r.json();for(const id in j)out.push({id:id,name:j[id].name||id,type:'standard'});}
    const t2=withTimeout(6000);const r2=await fetch(BASE.replace(/\/$/,'')+'/api/manager/flow/advancedflow/',{headers:{Authorization:'Bearer '+tk},signal:t2.signal});t2.clear();
    if(r2.ok){const j2=await r2.json();for(const id in j2)out.push({id:id,name:j2[id].name||id,type:'advanced'});}
    if(out.length){out.sort((a,b)=>a.name.localeCompare(b.name,'sv'));_flows=out;}}catch(e){}}
function flowList(){return _flows||FLOWS_FALLBACK;}
async function ensureMoods(){if(_moods||!apiBase())return;const tk=CONFIG.WRITE_TOKEN||CONFIG.TOKEN;
  try{const t=withTimeout(6000);const r=await fetch(apiBase()+'/api/manager/moods/mood/',{headers:{Authorization:'Bearer '+tk},signal:t.signal});t.clear();
    if(r.ok){const j=await r.json();const arr=Array.isArray(j)?j:Object.values(j);let out=[];for(const mo of arr)if(mo&&mo.id)out.push({id:mo.id,name:mo.name||mo.id});if(out.length){out.sort((a,b)=>a.name.localeCompare(b.name,'sv'));_moods=out;}}}catch(e){}}
function moodList(){return _moods||MOODS_FALLBACK;}
async function homeySetMood(id){const tk=CONFIG.WRITE_TOKEN||CONFIG.TOKEN,t=withTimeout(8000);
  const r=await fetch(apiBase()+'/api/manager/moods/mood/'+id+'/set',{method:'POST',headers:{Authorization:'Bearer '+tk,'Content-Type':'application/json'},body:'{}',signal:t.signal});
  t.clear();if(!r.ok)throw new Error('HTTP '+r.status);return true;}
