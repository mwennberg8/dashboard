/* js/grund.js — Grunden: Homey-data och hjälpare, rumsrutorna, husförbrukningen, historik ur v2-appen, bilen, moods, laddstyrningen och vänteläget.
 *
 * Filen innehåller BARA funktionsdeklarationer. Konstanter, tillstånd och allt
 * som körs direkt vid laddning ligger i js/start.js, som laddas sist, under
 * rubriken [grund.js]. En funktion går att anropa oavsett vilken fil den står
 * i, men kod som körs vid laddning kan här anropa en funktion i en fil som inte
 * hunnit laddas. Lägg den därför aldrig här.
 */

function icon(name,cls){const p=ICONS[name];if(!p)return'';return '<svg class="ic'+(cls?' '+cls:'')+'" viewBox="0 0 256 256" aria-hidden="true">'+p+'</svg>';}
function initIcons(){if(!document.querySelectorAll)return;const els=document.querySelectorAll('[data-ic]');for(const el of els){el.innerHTML=icon(el.getAttribute('data-ic'));}}
function setIcon(id,name,cls){const e=$(id);if(e)e.innerHTML=icon(name,cls);}
function battNettoW(){
  const c=capRaw(BATT_MB,'measure_power.batt_charge'),d=capRaw(BATT_MB,'measure_power.batt_discharge');
  if(c==null&&d==null)return null;
  const cn=Number(c),dn=Number(d);
  /* Skulle charge en dag komma med eget tecken (negativ vid urladdning) gäller det. */
  if(isFinite(cn)&&cn<0)return cn;
  return (isFinite(cn)?cn:0)-(isFinite(dn)?Math.abs(dn):0);
}
function battHbMotsager(){
  var w=husNettoW();
  if(w==null||!isFinite(w)||Math.abs(w)<BATT_HB_MOTS_W){_hbStorT=0;return false;}
  var nu=Date.now();if(!_hbStorT)_hbStorT=nu;
  var b=capRaw(BATT_HB,'measure_battery');if(b==null)return false;
  var lt=_battLogT||{};
  var hbObs=(_battSett.hb_soc&&_battSett.hb_soc.t)||0;
  var hbEv=lt.hb&&typeof lt.hb==='object'?(lt.hb.soc||0):0;
  var hbT=Math.max(hbObs,hbEv);
  if(nu-Math.max(hbT,_hbStorT)<BATT_HB_MOTS_MS)return false;
  var mbObs=(_battSett.mb_soc&&_battSett.mb_soc.t)||0;
  var mbEv=lt.mb&&typeof lt.mb==='object'?(lt.mb.soc||0):0;
  var mbT=Math.max(mbObs,mbEv);
  return nu-mbT<BATT_HB_MOTS_MS;          /* ändrad inom timmen = senare än Husbatteri */
}
function battNoter(k,v){
  var s=_battSett[k];
  /* Första gången (sidan just laddad): ingen ändring sedd ännu. */
  if(!s){_battSett[k]={v:v,t:0};return 0;}
  if(v!==s.v){s.v=v;s.t=Date.now();}
  return s.t;
}
function husNettoW(){
  const v=capRaw(BATT_HB,'measure_power');if(v==null)return null;
  let n=Number(v);if(!isFinite(n))return null;
  /* Tecken: negativ vid urladdning. Kommer beloppet utan tecken avgör läget. */
  if(n>0&&capRaw(BATT_HB,'battery_charging_state')==='discharging')n=-n;
  return n;
}
function mbSoc(){const v=capRaw(BATT_MB,'measure_battery');return v!=null?v:capRaw(BATT_MB,'battery');}
function battVal(kind){
  const soc=kind==='soc';
  const a=soc?mbSoc():battNettoW(), b=soc?capRaw(BATT_HB,'measure_battery'):husNettoW();
  /* Saknade värden noteras också: ett värde som dyker upp senare är en ändring. */
  const ta0=battNoter('mb_'+kind,a), tb0=battNoter('hb_'+kind,b);
  const ev=_battLogT||{};
  const evT=function(src){var x=ev[src];return typeof x==='number'?x:((x&&x[kind])||0);};
  const ta=a==null?-1:Math.max(ta0,evT('mb')), tb=b==null?-1:Math.max(tb0,evT('hb'));
  _battTider[kind]={mb:ta,hb:tb};
  if(a==null&&b==null){_battKalla[kind]=null;return null;}
  var hb;
  if(b==null)hb=false;
  else if(a==null)hb=true;
  else hb=!battHbMotsager();   /* v718: Husbatteri, utom när det motsäger sig självt */
  _battKalla[kind]={src:hb?'hb':'mb',t:hb?tb:ta};
  return hb?b:a;
}
function senastAndrad(pts){
  var last=null,t=0;
  for(var i=0;i<(pts||[]).length;i++){var p=pts[i];if(!p||!isFinite(p.v)||!isFinite(p.t))continue;
    if(last!==null&&p.v!==last)t=p.t;last=p.v;}
  return t;
}
async function battLoggKoll(tvinga){
  if(_battLogKor)return;
  try{if(isDemo()||!credFinns()||!BASE)return;}catch(e){return;}
  if(!tvinga&&Date.now()-_battLogAt<120000)return;
  _battLogKor=true;_battLogAt=Date.now();
  try{
    if(!_battLogLista||Date.now()-_battLogListaAt>30*60000){
      var lr=await insGet('/api/manager/insights/log/',15000);
      if(lr.data){_battLogLista=lr.data;_battLogListaAt=Date.now();}}
    if(!_battLogLista)return;
    /* v716: [källa, storhet, enhet, loggar]. Effektens tid = senaste ändringen i någon av loggarna. */
    var par=[['mb','soc',BATT_MB,['measure_battery']],['mb','pow',BATT_MB,['measure_power.batt_charge','measure_power.batt_discharge']],
             ['hb','soc',BATT_HB,['measure_battery']],['hb','pow',BATT_HB,['energy_power']]];
    if(!_battLogT.mb||typeof _battLogT.mb!=='object')_battLogT={mb:{soc:0,pow:0},hb:{soc:0,pow:0}};
    for(var i=0;i<par.length;i++){
      var t=0,fanns=false;
      for(var j=0;j<par[i][3].length;j++){
        var lg=exaktLogg(_battLogLista,par[i][2],[par[i][3][j]]);if(!lg)continue;
        var e=await insGet('/api/manager/insights/log/'+lg.uri+'/'+lg.id+'/entry?resolution=last6Hours',15000);
        if(e.data){fanns=true;t=Math.max(t,senastAndrad(parseEntries(e.data)));}
      }
      if(fanns)_battLogT[par[i][0]][par[i][1]]=t;
      if(fanns&&par[i][0]==='hb'&&par[i][1]==='soc')_battLogKand=true;
    }
    try{localStorage.setItem('battLogT_v2',JSON.stringify(_battLogT));}catch(e){}
    /* v715: byttes källan ritas sidan om direkt, inte först vid nästa hämtning. */
    try{var fore=_battKalla&&_battKalla.soc&&_battKalla.soc.src;cap(DEV.battery,'measure_battery');
      var efter=_battKalla&&_battKalla.soc&&_battKalla.soc.src;if(fore!==efter&&typeof render==='function')render();}catch(e){}
  }catch(e){}finally{_battLogKor=false;}
}
function battMb(c){
  if(c==='measure_battery')return battVal('soc');
  if(c==='measure_power'||c==='energy_power'||c==='battery_charging_state'){
    const n=battVal('pow');if(n==null)return null;
    if(c==='energy_power')return n;
    if(c==='measure_power')return Math.abs(n);
    return n>BATT_TROSKEL_W?'charging':(n<-BATT_TROSKEL_W?'discharging':'idle');}
  return null;
}
function cap(id,c){if(_timeActive&&_timeMap){const k=id+'|'+c;return (k in _timeMap)?_timeMap[k]:null;}return capLive(id,c);}
function tempColor(t){if(t==null)return'var(--faint)';if(t<18)return'var(--blue)';if(t<=23)return'var(--ok)';if(t<=26)return'var(--warm)';return'var(--hot)';}
function co2Color(v){if(v==null)return'var(--faint)';if(v<800)return'var(--ok)';if(v<1200)return'var(--warm)';return'var(--hot)';}

function solar(date,lat,lon,tzMin){const rad=Math.PI/180,deg=180/Math.PI;
  const start=new Date(date.getFullYear(),0,0),day=Math.floor((date-start)/86400000);
  const hours=date.getHours()+date.getMinutes()/60+date.getSeconds()/3600;
  const g=(2*Math.PI/365)*(day-1+(hours-12)/24);
  const eqt=229.18*(0.000075+0.001868*Math.cos(g)-0.032077*Math.sin(g)-0.014615*Math.cos(2*g)-0.040849*Math.sin(2*g));
  const decl=0.006918-0.399912*Math.cos(g)+0.070257*Math.sin(g)-0.006758*Math.cos(2*g)+0.000907*Math.sin(2*g)-0.002697*Math.cos(3*g)+0.00148*Math.sin(3*g);
  const tst=hours*60+eqt+4*lon-tzMin,ha=(tst/4)-180;
  const cosZ=Math.sin(lat*rad)*Math.sin(decl)+Math.cos(lat*rad)*Math.cos(decl)*Math.cos(ha*rad);
  const elevation=90-Math.acos(Math.min(1,Math.max(-1,cosZ)))*deg;
  const cosH=(Math.cos(90.833*rad)/(Math.cos(lat*rad)*Math.cos(decl)))-Math.tan(lat*rad)*Math.tan(decl);
  let sunrise=null,sunset=null;if(cosH>=-1&&cosH<=1){const h0=Math.acos(cosH)*deg;sunrise=(720-4*(lon+h0)-eqt+tzMin)/60;sunset=(720-4*(lon-h0)-eqt+tzMin)/60;}
  const azimuth=(Math.atan2(Math.sin(ha*rad),Math.cos(ha*rad)*Math.sin(lat*rad)-Math.tan(decl)*Math.cos(lat*rad))*deg+180+360)%360;
  return{elevation,azimuth,sunrise,sunset};}
function applyTheme(sc,h){let th=CONFIG.THEME;
  if(th==='auto')th=(sc.sunrise!=null&&sc.sunset!=null&&h>=sc.sunrise&&h<sc.sunset)?'light':'dark';
  const root=document.documentElement;if(root&&root.setAttribute&&th!==curTheme){root.setAttribute('data-theme',th);curTheme=th;}
  setIcon('theme-ic',th==='light'?'sun':'moon');
  try{syncThemeColor();}catch(e){}}
function nodeIc(name,x,y,size,id){const p=ICONS[name]||'';return '<svg id="'+id+'" class="node-ic" x="'+(x-size/2)+'" y="'+(y-size/2)+'" width="'+size+'" height="'+size+'" viewBox="0 0 256 256">'+p+'</svg>';}
function buildFlow(){
  const el=$('flow');if(!el)return;
  const C=FLOW.C,N={sun:[300,52],grid:[120,300],batt:[480,300]};
  const dir=n=>{const dx=C[0]-n[0],dy=C[1]-n[1],d=Math.hypot(dx,dy)||1;return[dx/d,dy/d];};
  const nstart=n=>{const u=dir(n);return[n[0]+u[0]*31,n[1]+u[1]*31];};
  const oedge=n=>{const u=dir(n);return[C[0]-u[0]*86,C[1]-u[1]*86];};
  const link=(n)=>{const a=nstart(n),e=oedge(n),mx=(a[0]+e[0])/2,my=(a[1]+e[1])/2;return'M '+a[0]+' '+a[1]+' Q '+mx+' '+my+' '+e[0]+' '+e[1];};
  const links={sun:link(N.sun),grid:link(N.grid),batt:link(N.batt)};
  const cx=C[0],cy=C[1],R=FLOW.R;
  let s='<svg id="flow-svg" viewBox="0 0 600 360" preserveAspectRatio="xMidYMid meet" aria-label="energiring">';
  s+='<defs><radialGradient id="orbg" cx="50%" cy="50%" r="50%"><stop class="orbg-c" offset="0" stop-color="#a3be8c" stop-opacity="1"/><stop class="orbg-c" offset="1" stop-color="#a3be8c" stop-opacity="0"/></radialGradient>'
    +'<radialGradient id="sg" cx="50%" cy="50%" r="50%"><stop class="sg-c" offset="0" stop-color="#ebcb8b" stop-opacity="0.30"/><stop class="sg-c" offset="1" stop-color="#ebcb8b" stop-opacity="0"/></radialGradient></defs>';
  s+='<circle id="orb-glow" class="orb-glow" cx="'+cx+'" cy="'+cy+'" r="118" fill="url(#orbg)"/>';
  s+='<circle class="f-track" cx="'+cx+'" cy="'+cy+'" r="'+R+'" fill="none" stroke-width="10"/>';
  s+='<circle id="ring-own" cx="'+cx+'" cy="'+cy+'" r="'+R+'" fill="none" stroke="#a3be8c" stroke-width="10" stroke-linecap="round" transform="rotate(-90 '+cx+' '+cy+')" stroke-dasharray="0 616"/>';
  s+='<circle id="ring-imp" cx="'+cx+'" cy="'+cy+'" r="'+R+'" fill="none" stroke="#d08770" stroke-width="10" stroke-linecap="round" transform="rotate(-90 '+cx+' '+cy+')" stroke-dasharray="0 616"/>';
  s+='<circle id="ring-knob" cx="'+cx+'" cy="'+(cy-R)+'" r="7" fill="#a3be8c" stroke="var(--orb-fill)" stroke-width="3"/>';
  for(const k in links){s+='<path id="guide-'+k+'" d="'+links[k]+'" fill="none" stroke="none"/>';
    s+='<path class="lk-base" d="'+links[k]+'" fill="none" stroke-width="3" stroke-linecap="round"/>';
    s+='<path id="lk-'+k+'" class="lk-flow" d="'+links[k]+'" fill="none" stroke="#888" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 13" opacity="0"/>';}
  for(const k in links){for(let i=0;i<5;i++)s+='<circle class="pcl" data-link="'+k+'" data-i="'+i+'" r="3" fill="#fff" opacity="0"/>';}
  s+='<circle class="f-orb" cx="'+cx+'" cy="'+cy+'" r="80" stroke-width="1"/>';
  // sun node
  s+='<circle cx="'+N.sun[0]+'" cy="'+N.sun[1]+'" r="40" fill="url(#sg)"/>';
  s+='<g transform="translate('+N.sun[0]+','+N.sun[1]+')"><circle class="f-coin sun" r="29" stroke-width="1.5"/><text id="fv-sun" class="fv" y="15" text-anchor="middle">–</text></g>';
  s+=nodeIc('sun',N.sun[0],N.sun[1]-8,17,'node-ic-sun');
  // grid node
  s+='<g transform="translate('+N.grid[0]+','+N.grid[1]+')"><circle class="f-coin" r="29" stroke-width="1.5"/><text id="fv-grid" class="fv" y="15" text-anchor="middle">–</text><text id="fl-grid" class="flb2" y="47" text-anchor="middle">nät</text></g>';
  s+=nodeIc('lightning',N.grid[0],N.grid[1]-8,17,'node-ic-grid');
  // battery node
  s+='<circle id="batt-glow" cx="'+N.batt[0]+'" cy="'+N.batt[1]+'" r="40" fill="#88c0d0" opacity="0"/>';
  s+='<g transform="translate('+N.batt[0]+','+N.batt[1]+')"><circle class="f-coin" r="29" stroke-width="0"/><circle class="f-track" r="29" fill="none" stroke-width="3.5"/><circle id="batt-ring" r="29" fill="none" stroke="#88c0d0" stroke-width="3.5" stroke-linecap="round" transform="rotate(-90)" stroke-dasharray="182" stroke-dashoffset="182"/><text id="fv-batt" class="fv" y="15" text-anchor="middle">–</text><text id="fl-batt" class="flb2" y="47" text-anchor="middle"></text></g>';
  s+=nodeIc('battery-high',N.batt[0],N.batt[1]-8,17,'node-ic-batt');
  // klickbara träffytor (detalj-popup)
  s+='<circle class="f-hit" cx="'+N.sun[0]+'" cy="'+N.sun[1]+'" r="33" onclick="openDetail(\'sun\')"/>';
  s+='<circle class="f-hit" cx="'+N.grid[0]+'" cy="'+N.grid[1]+'" r="33" onclick="openDetail(\'grid\')"/>';
  s+='<circle class="f-hit" cx="'+N.batt[0]+'" cy="'+N.batt[1]+'" r="33" onclick="openDetail(\'batt\')"/>';
  // house center
  s+=nodeIc('house',cx,cy-28,26,'node-ic-house');
  s+='<g transform="translate('+cx+','+cy+')"><text id="fv-house" class="fv-house" y="8" text-anchor="middle">–</text><text id="fv-self" class="fself" y="30" text-anchor="middle"></text><text class="flb" y="46" text-anchor="middle">förbrukning</text></g>';
  s+='</svg>';
  el.innerHTML=s;FLOW.built=true;
  FLOW.particles=document.querySelectorAll?[].slice.call(document.querySelectorAll('.pcl')):[];
  ['sun','grid','batt'].forEach(k=>FLOW.guides[k]=$('guide-'+k));
  startFlowAnim();
}
function setRing(id,frac,off){const e=$(id);if(e&&e.setAttribute){e.setAttribute('stroke-dasharray',(Math.max(0,frac)*616).toFixed(1)+' 616');e.setAttribute('stroke-dashoffset',(-(off||0)*616).toFixed(1));}}
function setNodeColor(id,c){const e=$(id);if(e&&e.style)e.style.color=c;}
function lkConf(power,active,toward,color){return{power:power||0,active:!!active,toward:!!toward,color:color};}
function updateFlow(){
  if(!FLOW.built)return;
  const p=PAL[curTheme]||PAL.dark;
  const solarW=cap(DEV.solar,'measure_power')||0,houseW=houseNowW(),pulseW=cap(DEV.pulse,'measure_power');
  const battPct=cap(DEV.battery,'measure_battery'),battW=cap(DEV.battery,'measure_power')||0,bs=cap(DEV.battery,'battery_charging_state');
  setT('fv-sun',W(solarW));setT('fv-house',houseW==null?'–':W(houseW));
  const importing=pulseW!=null&&pulseW>0,exporting=pulseW!=null&&pulseW<0;
  setT('fv-grid',pulseW==null?'–':W(Math.abs(pulseW)));setT('fl-grid',exporting?'säljer':importing?'köper':'nät');
  const charging=bs==='charging',discharging=bs==='discharging';
  setT('fv-batt',(battW==null||(!charging&&!discharging&&Math.abs(battW)<5))?(battPct==null?'–':'0 W'):W(Math.abs(battW)));
  setT('fl-batt',charging?'laddar':discharging?'matar ut':'vilar');
  const battCol=charging?p.green:discharging?p.cyan:'var(--dim)';
  const br=$('batt-ring');if(br&&br.style){br.style.strokeDashoffset=(182*(1-(battPct||0)/100)).toFixed(1);br.style.stroke=battCol;}
  const bi=$('node-ic-batt');if(bi){bi.innerHTML=ICONS[charging?'battery-charging':'battery-high']||'';if(bi.style)bi.style.color=battCol;}
  const bglow=$('batt-glow');if(bglow){if(bglow.setAttribute)bglow.setAttribute('fill',charging?p.green:p.cyan);if(bglow.style)bglow.style.opacity=(charging||discharging)?'':'0';if(bglow.classList){bglow.classList.toggle('fast',charging);}}
  setNodeColor('node-ic-sun',p.sun);setNodeColor('node-ic-grid',importing?p.warm:exporting?p.green:'var(--dim)');
  let ownFrac=null;if(houseW&&houseW>0){const own=Math.max(0,Math.min(houseW,solarW+(bs==='discharging'?Math.abs(battW):0)));ownFrac=own/houseW;}else if(exporting)ownFrac=1;
  const of=ownFrac==null?0:ownFrac,impF=Math.max(0,1-of);
  setRing('ring-own',of,0);setRing('ring-imp',impF,of);
  const knob=$('ring-knob');if(knob&&knob.setAttribute){const C2=FLOW.C,R2=FLOW.R,ang=(-90+of*360)*Math.PI/180;
    knob.setAttribute('cx',(C2[0]+R2*Math.cos(ang)).toFixed(1));knob.setAttribute('cy',(C2[1]+R2*Math.sin(ang)).toFixed(1));
    if(knob.style)knob.style.opacity=(of>0.02&&of<0.985)?'1':'0';}
  setT('fv-self',ownFrac==null?'':Math.round(of*100)+'% självförsörjt');
  const stateGreen=exporting||of>=0.7,glow=$('orb-glow');if(glow&&glow.style)glow.style.opacity=stateGreen?'':'0';
  const selfEl=$('fv-self');if(selfEl&&selfEl.setAttribute)selfEl.setAttribute('fill',stateGreen?p.green:p.warm);
  FLOW.links={sun:lkConf(solarW,solarW>30,true,p.sun),
    grid:lkConf(Math.abs(pulseW||0),Math.abs(pulseW||0)>20,importing,importing?p.warm:p.green),
    batt:lkConf(Math.abs(battW),Math.abs(battW)>20,bs==='discharging',bs==='discharging'?p.cyan:p.green)};
  for(const k in FLOW.links){const c=FLOW.links[k],pp=$('lk-'+k);
    if(pp&&pp.style){pp.style.opacity=c.active?'0.9':'0';pp.style.stroke=c.color;
      pp.style.animationDuration=Math.max(0.5,2.4-c.power/2000*1.6).toFixed(2)+'s';pp.style.animationDirection=c.toward?'normal':'reverse';}}
}
function startFlowAnim(){
  if(typeof requestAnimationFrame!=='function'||FLOW.raf)return;
  const step=ts=>{const dt=Math.min(80,ts-(FLOW.last||ts));FLOW.last=ts;FLOW.phase=(FLOW.phase+dt/1000)%1000;
    for(const c of FLOW.particles){const k=c.getAttribute('data-link'),i=+c.getAttribute('data-i'),conf=FLOW.links[k],g=FLOW.guides[k];
      if(!conf||!conf.active||!g||!g.getTotalLength){c.style.opacity='0';continue;}
      const n=Math.max(1,Math.min(5,Math.round(conf.power/700)));if(i>=n){c.style.opacity='0';continue;}
      const len=g.getTotalLength(),speed=0.22+Math.min(1.1,conf.power/2600);
      let pos=((FLOW.phase*speed)+(i/n))%1,t=conf.toward?pos:1-pos,pt=g.getPointAtLength(t*len);
      c.setAttribute('cx',pt.x.toFixed(1));c.setAttribute('cy',pt.y.toFixed(1));c.setAttribute('fill',conf.color);
      const e=Math.min(pos,1-pos);c.style.opacity=(e<0.07?e/0.07:1)*0.95;}
    FLOW.raf=requestAnimationFrame(step);};
  FLOW.raf=requestAnimationFrame(step);
}
function loadHist(){try{HIST=JSON.parse(localStorage.getItem(HKEY))||{};}catch(e){HIST={};}}
function saveHist(){try{localStorage.setItem(HKEY,JSON.stringify(HIST));}catch(e){}}
function husCap(){try{var d=DATA&&DATA[DEV.consume],co=d&&d.capabilitiesObj;
  if(co&&!(HUS_CAP in co)&&('measure_power' in co))return 'measure_power';}catch(e){}
  return HUS_CAP;}
function husSkarva(gamla,nya,harNy){
  var ok=function(p){return p&&typeof p.t==='number'&&isFinite(p.t)&&typeof p.v==='number'&&isFinite(p.v);};
  nya=(nya||[]).filter(ok);gamla=(gamla||[]).filter(ok);
  if(!harNy)return gamla;
  if(!nya.length)return [];
  /* Tio minuters marginal före första nya punkten: bytet och loggens första
     värde behöver inte ha samma tidsstämpel. En negativ förbrukning finns inte
     – det är i så fall nätet som exporterar, och den punkten tas bort. */
  var t0=nya[0].t-HUS_SKARV_MS;
  return gamla.filter(function(p){return p.t<t0&&p.v>=0;}).concat(nya);
}
async function husSkarvHist(logs,hamta){
  var ln=exaktLogg(logs,DEV.consume,[HUS_CAP]),lo=exaktLogg(logs,DEV.consume,['energy_power','measure_power']);
  var nya=ln?((await hamta(ln))||[]):[],gamla=lo?((await hamta(lo))||[]):[];
  return husSkarva(gamla,nya,!!ln);
}
/* Sidor som var öppna efter uppdateringen spelade in nätet som förbrukning.
   Den lokala förbrukningsserien töms en gång; Insights fyller i dygnet igen. */
function husHistRensa(){try{if(localStorage.getItem('husLast_v722'))return false;
  if(HIST&&HIST.house){delete HIST.house;saveHist();}
  localStorage.setItem('husLast_v722','1');return true;}catch(e){return false;}}
/* Slår ihop Insights-datan med det vi redan mätt själva, i stället för att kasta
   den ena. Tidigare vann den serie som hade FLEST punkter (`if(pts.length>...)`),
   och det var i praktiken alltid den lokala – därför försvann allt som mättes
   medan sidan var stängd, och "idag" började när man råkade öppna dashboarden.
   Utglesningen är viktig: utan den fördubblas serien när båda källorna täcker
   samma timmar. 110 s är samma takt som recordHist() själv samlar i, så det
   sammanslagna resultatet blir inte större än det lokala var förut. */
function histMerge(a,b,cut){
  var alla=(a||[]).concat(b||[]).filter(function(p){
    return p&&p.t!=null&&p.t>=cut&&p.v!=null&&isFinite(p.v);});
  alla.sort(function(x,y){return x.t-y.t;});
  var ut=[],sen=-1e15;
  for(var i=0;i<alla.length;i++){
    if(alla[i].t-sen>=110000){ut.push(alla[i]);sen=alla[i].t;}}
  return ut;}
async function appSerierSynka(){
  if(_serCfgSkickad)return false;
  var lista=[];
  for(var k in TRACK_DEV){
    var dev=null;try{dev=TRACK_DEV[k][0]();}catch(e){}
    if(dev)lista.push({k:k,dev:dev,cap:TRACK_DEV[k][1]});
  }
  if(!lista.length)return false;
  var t=withTimeout(10000);
  var r=await fetch(apiBase()+'/api/app/'+APP_ID+'/serier',
    {method:'POST',headers:{Authorization:'Bearer '+(CONFIG.TOKEN||''),'Content-Type':'application/json'},
     body:JSON.stringify(lista),signal:t.signal});
  t.clear();
  if(!r.ok)throw new Error(r.status+' '+r.statusText);
  _serCfgSkickad=true;
  return true;}
async function appSerierHamta(){
  try{
    if(!appKan())return 0;
    try{await appSerierSynka();}catch(e){}
    var lista=await appGet('/serier');
    if(!lista||!lista.serier)return 0;
    var cut=Date.now()-CONFIG.HISTORY_HOURS*3600*1000, n=0;
    for(var k in lista.serier){
      if(!lista.serier[k])continue;
      try{
        var p=await appGet('/serier?key='+encodeURIComponent(k));
        if(Array.isArray(p)&&p.length){
          /* Samma sammanslagning som seedHistory: appens punkter och våra egna
             läggs ihop och glesas ut, ingen källa skriver över den andra. */
          /* Appen först, den egna inspelningen som reserv. Appen kör dygnet
             runt; webbläsaren bara när sidan är öppen. Sammanslagning i stället
             för överskrivning betyder att ingen källa tappas — men vi noterar
             VILKEN som når längst bakåt, så kurvorna kan säga det. */
          /* Vind och byar kommer i km/h från enheten. Allt annat i HIST är i
             den enhet dashboarden visar, så de räknas om här. */
          if(k==='wind'||k==='gust')p=p.map(function(x){return {t:x.t,v:x.v/3.6};});
          var tidigast=p.length?Math.min.apply(null,p.map(function(x){return x.t;})):null;
          _serKalla[k]={app:p.length,fran:tidigast};
          HIST[k]=histMerge(HIST[k],p,cut);
          n++;
        }
      }catch(e){}
    }
    if(n){saveHist();_serAppN=n;_serAppAt=Date.now();try{render();}catch(e){}}
    return n;
  }catch(e){_appFel=(e&&e.message)||String(e);return 0;}}
function recordHist(){const now=Date.now(),cut=now-CONFIG.HISTORY_HOURS*3600*1000;
  TRACK.forEach(([k,fn])=>{const v=fn();if(v==null)return;HIST[k]=HIST[k]||[];const last=HIST[k][HIST[k].length-1];
    if(!last||now-last.t>=110000)HIST[k].push({t:now,v:Number(v)});HIST[k]=HIST[k].filter(p=>p.t>=cut);});saveHist();}

async function homeyGet(path){const c=new AbortController(),id=setTimeout(()=>c.abort(),8000);
  try{const r=await fetch(BASE.replace(/\/$/,'')+path,{headers:{Authorization:'Bearer '+CONFIG.TOKEN},signal:c.signal});clearTimeout(id);if(r.ok)return await r.json();}catch(e){clearTimeout(id);}return null;}
async function loadZones(){if(zonesDone||!BASE)return;const z=await homeyGet('/api/manager/zones/zone/');if(z){ZONES=z;zonesDone=true;render();}}
function findLog(logs,devId,m){const owner='homey:device:'+devId,arr=Array.isArray(logs)?logs:Object.values(logs||{});
  for(const lg of arr){const lid=lg.id||'',lo=lg.uri||lg.ownerUri||'';if(lo!==owner&&lid.indexOf(owner)!==0)continue;if(m.some(x=>lid.indexOf(x)!==-1))return{uri:owner,id:lid};}return null;}
/* SVARET HETER "entries", INTE BARA "values". Jag hämtade solpanelens logg rakt
   ur Homey och fick tillbaka ett objekt med fältet entries — det syntes i
   felmeddelandet: path ["entries", 194, "v"]. Den här funktionen letade bara
   efter values och gav därför tom lista. Vilka serier som drabbas beror på
   vilken app som skrivit loggen, vilket förklarar varför batteriet kom fram
   men inte sol och förbrukning.
   Nullvärden är vanliga i de här loggarna (gap i mätningen) och sorteras bort. */
function parseEntries(d){
  if(!d)return[];
  var v=Array.isArray(d)?d:(d.entries||d.values||d.data||[]);
  if(!Array.isArray(v))return[];
  return v.map(function(p){
    return {t:new Date(p.t||p.date||p.x).getTime(),
            v:Number(p.v!=null?p.v:(p.y!=null?p.y:NaN))};
  }).filter(function(p){return !isNaN(p.t)&&!isNaN(p.v);});
}
function seedFyll(){
  try{
    if(typeof SOURCE==='undefined'||SOURCE==='demo-data'||!BASE)return;
    if(Date.now()-_seedFyllAt<5*60000)return;
    _seedFyllAt=Date.now();
    seedHistory('last6Hours',true);
  }catch(e){}
}
/* ENGÅNGSRENSNING (v686). Punkter som fröats ur fel logg ligger kvar i
   webbläsaren upp till ett dygn och går inte att skilja från riktiga. Sol,
   förbrukning och nät nollas en gång och fylls på igen ur energy_power. */
function histEffektStad(){
  try{
    if(localStorage.getItem('histEffekt_v3'))return;
    ['solar','house','grid'].forEach(function(k){if(HIST&&HIST[k])delete HIST[k];});
    saveHist();localStorage.setItem('histEffekt_v3','1');
  }catch(e){}
}
function histLucka(k){var a=HIST[k];if(!a||!a.length)return true;return Date.now()-a[a.length-1].t>10*60000;}
async function seedHistory(res,tvinga){if(seeded&&!tvinga)return;seeded=true;res=res||'today';const logs=await homeyGet('/api/manager/insights/log/');if(!logs)return;
  const want={solar:[DEV.solar,['energy_power','measure_power']],house:[DEV.consume,['energy_power','measure_power']],price:[DEV.tibber,['measure_price_total','price_total','price']],
    batt:[BATT_MB,['measure_battery']],t_ute:[DEV.outdoor,['measure_temperature']],t_kok:[DEV.vader,['measure_temperature']],co2:[DEV.vader,['measure_co2']],
    grid:[DEV.pulse,['energy_power','measure_power']],pool:[DEV.pooltemp,['measure_temperature']],hum:[DEV.outdoor,['measure_humidity']],press:[DEV.vader,['measure_pressure']],battpow:[BATT_MB,['netto']],
    wind:[DEV.windMs,['measure_wind_strength']],gust:[DEV.windMs,['measure_gust_strength']],winddir:[DEV.windNet,['measure_wind_angle']],rain:[DEV.rain,['measure_rain.24h']],
    t_vard:[DEV.vard,['measure_temperature']],t_uterum:[DEV.uterum,['measure_temperature']],
    t_poolrum:[DEV.poolrum,['measure_temperature']],t_kallare:[DEV.kallare,['measure_temperature']],
    t_snickarboa:[DEV.snickarboa,['measure_temperature']],t_breveden:[DEV.attefall,['measure_temperature']],
    h_uterum:[DEV.uterum,['measure_humidity']],co2_uterum:[DEV.uterum,['measure_co2']],h_snickarboa:[DEV.snickarboa,['measure_humidity']],h_poolrum:[DEV.poolrum,['measure_humidity']],
    t_batt:[BATT_MODBUS,['measure_temperature.battery']]};
  for(const k in want){
    if(k==='house'){const ph=await husSkarvHist(logs,async function(lg){return parseEntries(await homeyGet('/api/manager/insights/log/'+lg.uri+'/'+lg.id+'/entry?resolution='+res));});
      if(ph.length)HIST[k]=histMerge(HIST[k],ph,Date.now()-CONFIG.HISTORY_HOURS*3600*1000);continue;}   /* v722 */
    if(k==='battpow'){const pn=await battNettoHist(logs,async function(lg){return parseEntries(await homeyGet('/api/manager/insights/log/'+lg.uri+'/'+lg.id+'/entry?resolution='+res));});
      if(pn.length)HIST[k]=histMerge(HIST[k],pn,Date.now()-CONFIG.HISTORY_HOURS*3600*1000);continue;}
    const lg=SEED_EXAKT[k]?exaktLogg(logs,want[k][0],want[k][1]):findLog(logs,want[k][0],want[k][1]);if(!lg)continue;
    const e=await homeyGet('/api/manager/insights/log/'+lg.uri+'/'+lg.id+'/entry?resolution='+res);
    let pts=parseEntries(e);
    /* Vindloggen ligger i km/h i Homey. Allt annat i dashboarden är m/s. */
    if(k==='wind'||k==='gust')pts=pts.map(p=>({t:p.t,v:p.v/3.6}));
    if(pts.length)HIST[k]=histMerge(HIST[k],pts,Date.now()-CONFIG.HISTORY_HOURS*3600*1000);}
  saveHist();render();}

/* Gemini borttaget v198 */

function drawChart(elId,ss,opts){
  const el=$(elId);if(!el)return;opts=opts||{};
  const all=[].concat.apply([],ss.map(s=>s.points||[]));
  if(all.length<2){el.innerHTML='<div class="chart-empty">samlar data… grafen fylls på medan sidan är öppen</div>';return;}
  /* v769: pL/pR 2 → 17 (5 av 300, som elnätsgrafen), så avläsningspricken får plats vid kanten. */
  const Wd=1000,H=150,pT=12,pB=24,pL=17,pR=17;
  let tMin=Math.min.apply(0,all.map(p=>p.t)),tMax=Math.max.apply(0,all.map(p=>p.t));
  let vMin=Math.min.apply(0,all.map(p=>p.v)),vMax=Math.max.apply(0,all.map(p=>p.v));
  /* Kom ihåg om datan var helt positiv INNAN luft läggs till. */
  const baraPlus=(vMin>=0);
  if(opts.yZero)vMin=Math.min(vMin,0);
  if(vMax===vMin)vMax=vMin+1;
  const pad=(vMax-vMin)*0.12;
  vMax+=pad;
  /* Luft nedåt bara när det FINNS negativa värden. Förut drogs padden av även
     från en nolla, och sedan kontrollerades "vMin>0" — vilket aldrig var sant
     eftersom vMin just gjorts negativ. Resultatet blev en nollinje som låg
     ovanför hela kurvan: sol och förbrukning är alltid positiva och såg ut att
     ligga under noll. */
  if(!(opts.yZero&&baraPlus))vMin-=pad;
  if(opts.yZero&&baraPlus)vMin=0;
  const X=t=>pL+((t-tMin)/(tMax-tMin||1))*(Wd-pL-pR),Y=v=>pT+(1-(v-vMin)/(vMax-vMin||1))*(H-pT-pB);
  let defs='',body='';const avlSer=[];
  for(let i=0;i<=2;i++){const gy=pT+(H-pT-pB)*i/2;body+='<line class="grid-l" x1="0" y1="'+gy.toFixed(1)+'" x2="'+Wd+'" y2="'+gy.toFixed(1)+'"/>';}
  body+=nollLinje(nollY(Y,vMin,vMax),0,Wd);
  ss.forEach(s=>{const pts=(s.points||[]).slice().sort((a,b)=>a.t-b.t);if(pts.length<2)return;
    /* Avlast mot den SORTERADE listan — det är den kurvan ritades av. */
    avlSer.push({namn:s.name||'',farg:s.color,pts:pts,Y:Y,
      fmt:v=>(opts.fmtY||(x=>''+(Math.round(x*100)/100)))(v)});
    const d=smoothPath(pts.map(p=>[X(p.t),Y(p.v)]));
    if(s.area){const gid='g'+(_gid++);defs+='<linearGradient id="'+gid+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+s.color+'" stop-opacity="0.28"/><stop offset="1" stop-color="'+s.color+'" stop-opacity="0"/></linearGradient>';
      body+='<path d="'+d+' L '+X(pts[pts.length-1].t).toFixed(1)+' '+Y(vMin).toFixed(1)+' L '+X(pts[0].t).toFixed(1)+' '+Y(vMin).toFixed(1)+' Z" fill="url(#'+gid+')"/>';}
    body+='<path d="'+d+'" fill="none" stroke="'+s.color+'"'+GRAF_LINJE+'/>';});
    /* v713: ingen prick i linjens slut – bara avläsningens dragbara prick. */
  let svg='<svg class="chart" viewBox="0 0 '+Wd+' '+H+'" preserveAspectRatio="none" role="img" aria-label="graf"><defs>'+defs+'</defs>'+body+'</svg>';
  svg=avlLager(elId,svg,{W:Wd,H:H,X:X,ser:avlSer});
  const fy=opts.fmtY||(v=>(''+(Math.round(v*100)/100))),hh=t=>new Date(t).toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'});
  const leg=ss.filter(s=>s.name).map(s=>'<span><i style="background:'+s.color+'"></i>'+s.name+'</span>').join('');
  el.innerHTML='<div class="chart-wrap">'+svg+'</div>'+(leg?'<div class="legend">'+leg+'</div>':'');
}
function addRow(p,ic,acc,k,sub,v){p.insertAdjacentHTML('beforeend','<div class="row"><span class="ri '+(acc||'')+'">'+icon(ic)+'</span><span class="rk">'+esc(k)+(sub?'<small>'+esc(sub)+'</small>':'')+'</span><span class="rv">'+v+'</span></div>');}
/* Bilrutans innehåll. Bruten ut ur openDetail så växlarna kan rita om den. */
/* v758: EN RUTA PER BIL – laddnivå och räckvidd. Platsen visas inte. Är bilen
   inkopplad får rutan grön ram och raden "inkopplad"; laddar den står "laddar"
   och effekten. Laddboxraden är borta: laddar en bil syns effekten i dess ruta,
   och laddar något annat står det i Gäst-rutan. */
function buildCarsPopup(){
  const _bw=chargerW(),_bon=(cap(DEV.laddbox,'evcharger_charging')===true)||(_bw!=null&&_bw>50);
  const bil=id=>{const b=cap(id,'measure_battery'),r=cap(id,'range_battery'),nm=(DATA[id]&&DATA[id].name)||'Bil';
    const ch=carCharging(id),pl=carPlugged(id);
    const ind=ch?(icon('lightning')+'laddar'+(_bw!=null&&_bw>50?' · '+W(_bw):'')):(pl?(icon('plug')+'inkopplad'):'');
    return '<div class="drow" data-ik="car-profile" data-ikf="'+(pl?'var(--ok)':'var(--blue)')+'"'+(pl?' data-kl="pa"':'')+'>'
      +'<span class="dk">'+esc(nm)+'</span><span class="dv">'+(b==null?'–':Math.round(b)+' %')+(r?' · '+Math.round(r)+' km':'')+'</span>'
      +(ind?'<span class="dx" style="color:var(--ok)">'+ind+'</span>':'')+'</div>';};
  const _known=carCharging(DEV.car2)||carCharging(DEV.car)||carPlugged(DEV.car2)||carPlugged(DEV.car);
  return (DATA[DEV.car2]?bil(DEV.car2):'')+(DATA[DEV.car]?bil(DEV.car):'')
    +(_bon&&!_known?dRow('Gäst','laddar'+(_bw!=null?' · '+W(_bw):'')):'')
    +'<div class="dsec">Styr</div>'+bilStyrHTML();
}
function klimatLas(){
  try{var v=Number(localStorage.getItem(KLIMAT_KEY));
    if(!(isFinite(v)&&v>0))return false;
    if(Date.now()-v>KLIMAT_GLOM){localStorage.removeItem(KLIMAT_KEY);return false;}
    return true;}catch(e){return false;}
}
function klimatSatt(pa){
  try{if(pa)localStorage.setItem(KLIMAT_KEY,String(Date.now()));
    else localStorage.removeItem(KLIMAT_KEY);}catch(e){}
}
function bilTryck(k){
  if(!(_bilArm.k===k&&Date.now()-_bilArm.t<4000)){
    _bilArm={k:k,t:Date.now()};bilStyrOm();
    setTimeout(function(){if(_bilArm.k===k&&Date.now()-_bilArm.t>=3990){_bilArm={k:null,t:0};bilStyrOm();}},4000);
    return;
  }
  _bilArm={k:null,t:0};
  /* "stopp" (laddrutan) stoppar bara – har laddningen redan slutat startas den inte. */
  if(k==='stopp'){if(cap(DEV.laddbox,'evcharger_charging')===true)bilLaddToggle();else bilStyrOm();}
  else bilKlimatToggle();
}
/* v719: SAMMA KNAPPAR SOM BATTERIETS POPUP. Ladda och Klimat bredvid varandra
   i samma stil (.ctl) som Ladda och Spara i husbatteriets popup. Ladda öppnar
   laddrutan (Ladda nu, Lägsta pris, egen tid, strömgräns) – alltid, också när
   bilen laddar, eftersom strömgränsen ligger där. Stoppa finns i rutan.
   Klimat kräver två tryck som förut. */
function bilStyrHTML(){
  var laddar=(cap(DEV.laddbox,'evcharger_charging')===true),kl=klimatLas(),bk=bilBokad();
  /* v694: styrningens läge ovanför knapparna. */
  var bs=bilStyrLage();
  var styr=(bs&&bs.lage&&bs.lage!=='ingen')?('<div class="drow"><span>Styrning</span><b>'+esc(bs.skal||bs.lage)+'</b></div>'):'';
  var armK=(_bilArm.k==='klimat'&&Date.now()-_bilArm.t<4000);
  var kn=function(cls,ic,txt,fn,aria){return '<button type="button" class="ctl'+cls+'" onclick="'+fn+'"'+(aria?' aria-label="'+esc(aria)+'"':'')+'>'
    +'<span class="ctl-ic">'+icon(ic)+'</span><span class="ctl-l">'+esc(txt)+'</span></button>';};
  return styr+'<div class="controls hem-pop" id="popk-bil"><div class="ctl-row">'
    +kn((laddar?' on':'')+(!laddar&&bk?' bokad':''),'battery-charging',laddar?'Laddar':(bk?'Bokad \u00b7 '+battKlAv(bk):'Ladda'),'bilLaddKnapp()')
    +kn((kl?' on':'')+(armK?' arm':''),'thermometer',armK?(kl?'Stoppa klimat?':'Starta klimat?'):(kl?'Klimat på':'Klimat EX40'),"bilTryck('klimat')",
        armK?'Tryck igen för att bekräfta.':'')
    +'</div></div>';
}
function bilLaddKnapp(){_blMal='bil';openDetail('billadd');}
/* Bilens laddruta: samma väljare som husbatteriets, plus stopp och strömgräns. */
function bilLaddPopHTML(){
  var laddar=(cap(DEV.laddbox,'evcharger_charging')===true),bk=bilBokad(),h='<div class="ladd-pop">';
  if(laddar){
    var w=chargerW(),arm=(_bilArm.k==='stopp'&&Date.now()-_bilArm.t<4000);
    h+='<div class="dsec">Laddar nu</div>'+dRow('Laddbox',w!=null?W(w):'laddar')
      +'<div class="cfg-btns bl-rad"><button class="te-alt'+(arm?' arm':'')+'" onclick="bilTryck(\'stopp\')">'
      +(arm?'Stoppa? Tryck igen':'Stoppa laddning')+'</button></div>';
  }
  if(bk)h+='<div class="dsec">Inbokad start</div>'+dRow('Startar',bilKlText(bk))
    +'<div class="cfg-btns bl-rad"><button class="te-alt" onclick="bilAvboka()">Avboka</button></div>';
  return h+laddValHTML(laddar)+bilStromHTML()+'</div>';
}
/* Ladda nu ur rutan: valet i rutan är bekräftelsen, som för husbatteriet. */
function bilLaddaNu(){
  closeDetail();
  if(cap(DEV.laddbox,'evcharger_charging')!==true)bilLaddToggle();
}
/* Lokalt skrivet värde gäller tills nästa hämtning visar Homeys. */
function bilBokad(){
  var v=('bokad' in _bilLokal)?_bilLokal.bokad:((_regel&&_regel.bilBokad)||0);
  return (v>Date.now())?v:0;
}
function bilStromVal(){
  var v=('strom' in _bilLokal)?_bilLokal.strom:((_regel&&_regel.bilStrom)||0);
  return (v>=BIL_A_MIN&&v<=BIL_A_MAX)?v:0;
}
function bilKlText(ms){
  var d=new Date(ms),i=new Date();
  return battKlAv(ms)+((d.getDate()!==i.getDate()||d.getMonth()!==i.getMonth())?' imorgon':'');
}
async function bilBoka(ms){
  if(!(ms>Date.now())){toast('Tiden har redan passerat');return;}
  /* v719: rutan stängs direkt, som husbatteriets. */
  _bilLokal.bokad=ms;closeDetail();
  try{var L=await logicList();await logicWrite(L,BIL_BOKA_VAR,ms,'number');toast('Laddning bokad '+bilKlText(ms));}
  catch(e){delete _bilLokal.bokad;bilStyrOm();toast('Kunde inte boka: '+((e&&e.message)||'okänt'));return;}
  try{regelHamta(true);}catch(e){}
}
async function bilAvboka(){
  _bilLokal.bokad=0;bilStyrOm();
  try{var L=await logicList();await logicWrite(L,BIL_BOKA_VAR,0,'number');toast('Avbokad');}
  catch(e){delete _bilLokal.bokad;bilStyrOm();toast('Kunde inte avboka: '+((e&&e.message)||'okänt'));return;}
  try{regelHamta(true);}catch(e){}
}
/* LADDSTRÖMMEN: samma mönster som Brevedens temperatur (v703) — − och + ändrar
   ett utkast, OK skickar. 0 = ingen egen gräns. */
function bilStromHTML(){
  var v=bilStromVal(),u=(_bilStromUtk!=null)?_bilStromUtk:(v||BIL_A_MAX),andrat=(_bilStromUtk!=null&&_bilStromUtk!==(v||BIL_A_MAX));
  var nuA=cap(DEV.laddbox,'offered_current');
  var kw=Math.round(3*230*u/100)/10;
  return '<div class="dsec">Strömgräns</div>'
    +'<div class="brv-temp">'
    +'<button class="brv-step" id="bil-a-minus"'+(u<=BIL_A_MIN?' disabled':'')+' onclick="bilStromSteg(-1)">\u2212</button>'
    +'<span class="brv-falt bil-a"><b id="bil-a-tal">'+u+'</b><span>A</span></span>'
    +'<button class="brv-step" id="bil-a-plus"'+(u>=BIL_A_MAX?' disabled':'')+' onclick="bilStromSteg(1)">+</button>'
    +'<button class="brv-ok'+(andrat?' on':'')+'" id="bil-a-ok"'+(andrat?'':' disabled')+' onclick="bilStromOk()">OK</button></div>'
    +'<div class="brv-utkast">\u2248 '+num(kw,1)+' kW på 3 faser \u00b7 '+(v?'inställt '+v+' A':'ingen egen gräns')
    +(nuA!=null&&isFinite(nuA)?' \u00b7 laddboxen ger nu '+Math.round(nuA)+' A':'')+'</div>'
    +'<div class="det-note">Gäller när du laddar själv eller bokat start. Sol och billiga timmar styr strömmen själva, och säkringsvakten (23 A per fas) gäller alltid.</div>'
    +(v?'<div class="cfg-btns bl-rad"><button class="te-alt" onclick="bilStromSatt(0)">Ta bort gränsen</button></div>':'');
}
function bilStromSteg(d){
  var v=bilStromVal()||BIL_A_MAX,u=(_bilStromUtk!=null)?_bilStromUtk:v;
  _bilStromUtk=Math.max(BIL_A_MIN,Math.min(BIL_A_MAX,u+d));
  bilStyrOm();
}
function bilStromOk(){if(_bilStromUtk==null)return Promise.resolve();var u=_bilStromUtk;return bilStromSatt(u);}
async function bilStromSatt(a){
  _bilLokal.strom=a;_bilStromUtk=null;bilStyrOm();
  try{var L=await logicList();await logicWrite(L,BIL_STROM_VAR,a,'number');toast(a?'Laddström '+a+' A':'Ingen egen gräns');}
  catch(e){delete _bilLokal.strom;bilStyrOm();toast('Kunde inte spara: '+((e&&e.message)||'okänt'));return;}
  try{regelHamta(true);}catch(e){}
}
/* Ritar om bilrutan om den står öppen. */
/* v719: ritar om den bilruta som står öppen – Bilar eller laddrutan – och
   ingen annan. */
function bilStyrOm(){try{var b=$('dlg-body');if(!b)return;
  if(_dlgWhich==='billadd')b.innerHTML=bilLaddPopHTML();else if(_dlgWhich==='cars')b.innerHTML=buildCarsPopup();}catch(e){}}
async function bilLaddToggle(){
  var nu=(cap(DEV.laddbox,'evcharger_charging')===true);
  /* Skriv lokalt först så växlaren svarar direkt; nästa hämtning har sista
     ordet, precis som för ladda max-knappen. */
  try{var d=DATA[DEV.laddbox];
    if(d&&d.capabilitiesObj&&d.capabilitiesObj.evcharger_charging)
      d.capabilitiesObj.evcharger_charging.value=!nu;}catch(e){}
  bilStyrOm();
  try{
    await homeyPut(DEV.laddbox,'evcharger_charging',!nu);
    /* v694: säg till styrningen. Ladda = manuellt i 18 h (eller tills bilen
       kopplas ur); Stoppa = tillbaka till automatiken (sol, billiga timmar). */
    try{var LL=await logicList();await logicWrite(LL,'billadd_manuell',!nu?(Date.now()+18*3600000):Date.now());}catch(e2){}
    toast(!nu?'Laddning startad – manuellt':'Laddning stoppad – automatiken tar över');
    setTimeout(function(){load();},1500);
  }catch(e){
    /* Samma lärdom som batteriflödet: svaret är inget kvitto. Enhetens läge
       avgör, och nästa hämtning rättar bilden. */
    toast('Skickat – Homey svarade: '+((e&&e.message)||'okänt'));
  }
}
async function bilKlimatToggle(){
  var pa=!klimatLas();
  klimatSatt(pa);
  bilStyrOm();
  try{
    await homeyTriggerFlow('standard',pa?EX40_KLIMAT_PA:EX40_KLIMAT_AV);
    toast(pa?'Klimat startat':'Klimat stoppat');
  }catch(e){
    toast((pa?'Klimat startat':'Klimat stoppat')+' – Homey svarade: '+((e&&e.message)||'okänt'));
  }
}
async function homeyPut(id,cap,value){
  const tk=CONFIG.WRITE_TOKEN||CONFIG.TOKEN,t=withTimeout(8000);
  const r=await fetch(BASE.replace(/\/$/,'')+'/api/manager/devices/device/'+id+'/capability/'+cap+'/',
    {method:'PUT',headers:{Authorization:'Bearer '+tk,'Content-Type':'application/json'},body:JSON.stringify({value}),signal:t.signal});
  t.clear();if(!r.ok)throw new Error('HTTP '+r.status);return true;
}
function moodDevAll(){
  if(_moodDev)return _moodDev;
  try{_moodDev=JSON.parse(localStorage.getItem(MOOD_DEV_KEY))||{};}catch(e){_moodDev={};}
  return _moodDev;}
function moodDevSave(){try{localStorage.setItem(MOOD_DEV_KEY,JSON.stringify(moodDevAll()));}catch(e){}}
/* Djupsokning: samlar id:n som finns i DATA, oavsett var i objektet de star. */
function moodDevScan(o,ut,djup){
  if(!o||djup>6)return ut;
  if(typeof o==='string'){if(UUID_RE.test(o)&&DATA[o]&&ut.indexOf(o)<0)ut.push(o);return ut;}
  if(Array.isArray(o)){for(var i=0;i<o.length;i++)moodDevScan(o[i],ut,djup+1);return ut;}
  if(typeof o==='object'){
    for(var k in o){
      if(UUID_RE.test(k)&&DATA[k]&&ut.indexOf(k)<0)ut.push(k);
      moodDevScan(o[k],ut,djup+1);}}
  return ut;}
async function moodDevFetch(id){
  if(!id||_moodDevBusy[id])return null;
  if(_moodDevFail[id]&&Date.now()-_moodDevFail[id]<10*60000)return null;
  if(!apiBase()||!CONFIG.TOKEN||CONFIG.TOKEN.indexOf('DIN_API')>=0)return null;
  _moodDevBusy[id]=true;
  try{
    var tk=CONFIG.WRITE_TOKEN||CONFIG.TOKEN, ut=[];
    /* Forst hela listan – den innehaller oftast allt som behovs. Racker den inte
       till hamtas det enskilda moodet, som brukar vara mer utforligt. */
    for(var steg=0;steg<2&&!ut.length;steg++){
      var url=apiBase()+'/api/manager/moods/mood/'+(steg?encodeURIComponent(id):'');
      var t=withTimeout(7000);
      var r=await fetch(url,{headers:{Authorization:'Bearer '+tk},signal:t.signal});t.clear();
      if(!r.ok)continue;
      var j=await r.json();
      var mo=j;
      if(!steg){                       /* leta upp ratt mood i listan */
        var arr=Array.isArray(j)?j:Object.values(j||{});
        mo=null;for(var i=0;i<arr.length;i++)if(arr[i]&&arr[i].id===id)mo=arr[i];
        if(!mo&&j&&j[id])mo=j[id];}
      if(mo)moodDevScan(mo,ut,0);
    }
    var alla=moodDevAll();
    alla[id]={t:Date.now(),ids:ut};
    moodDevSave();
    _moodDevBusy[id]=false;
    if(!ut.length)_moodDevFail[id]=Date.now();
    try{moodDevNote();renderControls();}catch(e){}
    return ut;
  }catch(e){_moodDevBusy[id]=false;_moodDevFail[id]=Date.now();return null;}}
/* Synkron uppslagning – hamtar i bakgrunden forsta gangen. */
function moodDevIds(id){
  if(!id)return null;
  var e=moodDevAll()[id];
  if(!e||Date.now()-e.t>24*36e5)moodDevFetch(id);
  return (e&&e.ids&&e.ids.length)?e.ids:null;}
function moodSkip(d){
  var n=((d&&d.name)||'').toLowerCase();
  if(!n)return false;
  /* ORDGRÄNS, inte delsträng. "hall" som delsträng träffar "Marshall" och
     "Kristallhallen" — enheter som inte har med saken att göra. Dela upp namnet
     i ord och jämför helt, så bara det som verkligen heter hall räknas bort. */
  var ord=n.split(/[^a-zåäö0-9]+/);
  for(var i=0;i<MOOD_UNDANTAG.length;i++){
    if(ord.indexOf(MOOD_UNDANTAG[i])>=0)return true;
  }
  return false;}
function moodOnOff(id){                       /* bara enheter som går att tända/släcka */
  var d=DATA[id];
  return !!(d&&d.capabilitiesObj&&d.capabilitiesObj.onoff);}
function moodZoneIds(){
  var vill={},har=false;
  for(var z in ZONES){var Z=ZONES[z];if(!Z)continue;har=true;
    if(MOOD_ZONES.indexOf(((Z.name||'')+'').toLowerCase().trim())>=0)vill[z]=1;}
  /* Underzoner ärver: en lampa i "Vardagsrum > Läshörna" hör till vardagsrummet.
     Loopas tills inget nytt tillkommer, med tak så en trasig zonkedja inte hänger sig. */
  for(var varv=0;varv<8;varv++){var nytt=false;
    for(var z2 in ZONES){var P=ZONES[z2]&&ZONES[z2].parent;
      if(P&&vill[P]&&!vill[z2]){vill[z2]=1;nytt=true;}}
    if(!nytt)break;}
  return har?vill:null;}
/* Reserv när moodet inte gått att läsa: alla lampor i rummen ovan. */
function moodZoneLightIds(){
  var vill=moodZoneIds(), out=[];
  for(var id in DATA){var d=DATA[id];if(!d)continue;
    if((d.class||d.type)!=='light')continue;
    if(moodSkip(d))continue;
    if(vill){ if(!vill[d.zone])continue; }
    else{ var zn=((d.zoneName||'')+'').toLowerCase().trim();
          if(!zn||MOOD_ZONES.indexOf(zn)<0)continue; }
    out.push(id);}
  return out;}
function moodLightIds(b){
  var fran=(b&&b.moodOn)?moodDevIds(b.moodOn):null;
  if(fran&&fran.length){
    var ut=[];
    for(var i=0;i<fran.length;i++){
      var id=fran[i];
      if(!moodOnOff(id)||moodSkip(DATA[id]))continue;
      ut.push(id);}
    if(ut.length)return ut;}
  return moodZoneLightIds();}
/* Visar i knappredigeraren vad automatiken lyssnar på. */
function moodSenseText(i){
  var b=(CONFIG.BUTTONS&&CONFIG.BUTTONS[i])||{};
  var mo=(_beMoodOn!=null)?_beMoodOn:b.moodOn;
  var ref=(_beRef!=null)?_beRef:b.refDev;
  if(ref)return 'Följer <b>'+esc((DATA[ref]&&DATA[ref].name)||ref)+'</b>. Automatiken används inte.';
  var inf=moodSenseInfo({moodOn:mo});
  if(!mo)return 'Välj ett på-mood, så känner knappen av just de enheterna.';
  if(inf.kalla==='mood')
    return 'Känner av <b>'+inf.ids.length+' enheter ur på-moodet</b>: '+esc(inf.namn.join(', '))+'.';
  if(inf.kalla==='zon')
    return 'Kunde inte läsa vilka enheter på-moodet innehåller – faller tillbaka på alla lampor i '
      +MOOD_ZONES.join(', ')+' ('+inf.ids.length+' st): '+esc(inf.namn.join(', '))+'.';
  return 'Hittar inga enheter att känna av – knappen använder sitt egna minne av senaste tryck.';}
function moodDevNote(){try{
  var el=document.getElementById('be-sense');
  if(el&&typeof _beIdx==='number')el.innerHTML=moodSenseText(_beIdx);
}catch(e){}}
/* Var kommer listan ifrån just nu – används i knappredigeraren. */
function moodSenseInfo(b){
  var fran=(b&&b.moodOn)?moodDevIds(b.moodOn):null;
  var ids=moodLightIds(b);
  var namn=ids.map(function(i){return (DATA[i]&&DATA[i].name)||i;});
  return {kalla:(fran&&fran.length)?'mood':(ids.length?'zon':'minne'), ids:ids, namn:namn};}
function battLaddLage(){
  var km=cap(BATT_MODBUS,'storagecontrolmode');
  if(km==null)return null;                       /* modbus svarar inte */
  /* v714: samma bedömning som På nu – registret när det går att lita på,
     annars vad batteriet gör (se regelLage). */
  try{return regelLage().lage==='ladda';}catch(e){return String(km)==='4'&&String(cap(BATT_MODBUS,'storagedefaultmode'))==='3';}
}
function battLaddText(){
  var km=cap(BATT_MODBUS,'storagecontrolmode');
  if(km==null)return 'ingen kontakt';
  var dm=String(cap(BATT_MODBUS,'storagedefaultmode'));
  if(String(km)!=='4')return 'normal drift';
  if(dm==='1')return 'bara sol';
  if(dm==='3')return 'laddar max';
  return 'fjärrstyrd';
}
function battNu(){return _battNuTest!=null?new Date(_battNuTest):new Date();}

/* Nästa tidpunkt (minuter från midnatt, lokal tid) då priset går in i den
   DYRA (röda) delen av dagen, mätt precis som grafen färgläggs. Null om priset
   inte når dit före dygnets slut.
   Tröskeln räknas mot HELA dygnets spann (samma ylo/yhi som grafen), inte mot
   nuläget — då blir "rött" samma sak för knappen som för ögat. En dag utan
   någon riktig dyrtopp (nästan platt kurva) ger inget spann att tala om, och då
   stängs den inte av i förväg; det är rätt, för det finns ingen dyrtim att
   ladda undan för. */
function battPrisUppgang(){
  /* Kalibrerat, av samma skäl som battBilligSok. Vilken TIMME som väljs ändras
     inte — andelen av spannet är oförändrad under en linjär omräkning — men
     spanngränsen nedan och priset som visas gäller kronor, och de ska vara
     kurvans kronor. */
  var pts=prisKalibrera(prisDygn(0),0);
  if(!pts||pts.length<2)return null;
  var ys=pts.map(function(p){return p[1];});
  var ylo=Math.min.apply(null,ys), yhi=Math.max.apply(null,ys), yr=yhi-ylo;
  /* Nästan platt dygn: ingen meningsfull dyrtim. 0,20 kr spann är knappt värt
     att stänga av för. */
  if(!(yr>0.20))return null;
  var gr=ylo+BATT_PRIS_FRAC*yr;         /* priset som räknas som rött */
  var nu=battNu(), nuMin=nu.getHours()*60+nu.getMinutes(), nuH=nuMin/60;
  /* Första intervallet FRAMÅT vars pris ligger i det röda. pts är [timme, pris]
     i tim- eller kvartssteg, med sista punkten utdragen till 24. */
  for(var j=0;j<pts.length;j++){
    var h=pts[j][0], pr=pts[j][1];
    if(h<=nuH)continue;                 /* redan passerat */
    if(pr>=gr){
      var av=h*60-BATT_PRIS_FORE;
      if(av<=nuMin)av=nuMin;            /* redan inne i det röda: stäng nu */
      return {avMin:av, dyrH:h, nuPris:pr, nyPris:pr, gr:gr};
    }
  }
  return null;                          /* redan förbi dagens dyra topp */
}
/* Text som HH:MM för ett minutvärde från midnatt. */
function battKl(min){
  var h=Math.floor(min/60)%24, m=Math.round(min%60);
  return ('0'+h).slice(-2)+':'+('0'+m).slice(-2);
}
/* När ladda-max ska stängas av, som HH:MM — eller null om ingen uppgång väntar
   eller läget inte är på. */
function battAvstangKl(){
  /* v749: automatiken är avstängd (BATT_AUTO_AV) – då stänger ingenting av vid
     prisuppgången, och en tid här vore påhittad. Den trängde dessutom undan
     "fullt sparas till …" i På nu och batterirutan. */
  if(typeof BATT_AUTO_AV!=='undefined'&&BATT_AUTO_AV)return null;
  if(battLaddLage()!==true)return null;
  var u=battPrisUppgang();
  return u?battKl(u.avMin):null;
}
function battAutoKoll(){
  try{
    battStartKoll();                      /* schemalagd start i samma varv */
    /* v708: AUTOMATIKEN AVSTÄNGD (Markus beslut 2026-10-10). Förut slog den här
       om till normal drift strax före en dyr timme när Ladda max var på. Nu
       gäller bara knapparna och bokningarna. */
    if(BATT_AUTO_AV)return;
    if(battLaddLage()!==true){_battAvGjort='';return;}
    var u=battPrisUppgang();
    if(!u)return;
    var nu=battNu(), nuMin=nu.getHours()*60+nu.getMinutes();
    if(nuMin<u.avMin)return;                 /* inte dags än */
    var stampel=dayKey(nu)+':'+u.dyrH;
    if(_battAvGjort===stampel)return;         /* redan gjort för den här dyrtimmen */
    if(_battAvBusy)return;
    _battAvBusy=true;
    homeyTriggerFlow('standard',BATT_FLOW_AV).then(function(){
      _battAvGjort=stampel;_battAvBusy=false;
      try{toast('Batteriet: normal drift – priset stiger '+battKl(u.dyrH*60));}catch(e){}
      try{renderControls();}catch(e){}
    },function(){_battAvBusy=false;});        /* misslyckas: försök igen nästa varv */
  }catch(e){_battAvBusy=false;}
}
function battStartLas(){
  try{var v=Number(localStorage.getItem(BATT_START_KEY));
    return (isFinite(v)&&v>0)?v:null;}catch(e){return null;}
}
function battStartSatt(ms){
  try{if(ms==null)localStorage.removeItem(BATT_START_KEY);
    else localStorage.setItem(BATT_START_KEY,String(ms));}catch(e){}
  /* Skicka vidare till Homey. Svaret inväntas inte — knappen ska inte hänga på
     nätet, och hämtningen rättar bilden om skrivningen inte gick fram. */
  try{
    logicList().then(function(list){
      return logicWrite(list,BATT_BOKA_VAR,ms==null?0:Number(ms));
    }).catch(function(){});
  }catch(e){}
}
/* Läser bokningen från Homey och speglar den lokalt. Homey är auktoritativ:
   har flödet redan startat laddningen står variabeln på 0, och då ska knappen
   sluta visa "Bokad". */
async function battBokaHamta(){
  try{
    var list=await logicList();
    var v=null;
    logicArr(list).forEach(function(x){if(x&&x.name===BATT_BOKA_VAR)v=x;});
    if(!v)return;                       /* flödet skapar den vid nästa körning */
    var ms=Number(v.value);
    try{
      if(isFinite(ms)&&ms>0)localStorage.setItem(BATT_START_KEY,String(ms));
      else localStorage.removeItem(BATT_START_KEY);
    }catch(e){}
    try{renderControls();}catch(e){}
  }catch(e){}
}
function battStartAktiv(){
  var t=battStartLas();
  if(t==null)return null;
  if(Date.now()-t>BATT_START_GLOM){battStartSatt(null);return null;}
  return t;
}
function battBilligSok(off){
  /* SAMMA PRIS SOM ELPRISKURVAN. prisDygn ger Tibbers råa tal; kurvan ritar dem
     genom prisKalibrera(), som skalar om mot elprislägst/elprishögst. Läser man
     råvärden här visar knappen ett annat pris än grafen — samma fel som raderna
     under spotprisgrafen hade. Regeln är enkel: allt som rör elpriset går genom
     prisKalibrera(). */
  var pts=prisKalibrera(prisDygn(off),off);
  if(!pts||pts.length<2)return null;
  var ys=pts.map(function(p){return p[1];});
  var ylo=Math.min.apply(null,ys), yhi=Math.max.apply(null,ys), yr=yhi-ylo;
  if(!(yr>0.05))return null;                 /* platt dygn: ingen billig del */
  var gr=ylo+BATT_BILLIG_FRAC*yr;
  var nu=battNu(), nuH=nu.getHours()+nu.getMinutes()/60;
  for(var j=0;j<pts.length;j++){
    var h=pts[j][0], pr=pts[j][1];
    if(h>=24)break;                          /* utdragen slutpunkt, ingen timme */
    if(off===0&&h<=nuH)continue;
    if(pr<=gr)return {off:off,h:h,pris:pr,gr:gr};
  }
  return null;
}
function battBilligKl(){return battBilligSok(0)||battBilligSok(1);}
/* Billigaste timmen framåt, oavsett spann. Reserv när inget når ner i den
   billiga delen. */
function battBilligastKl(){
  var bast=null;
  [0,1].forEach(function(off){
    var pts=prisDygn(off);
    if(!pts)return;
    var nu=battNu(), nuH=nu.getHours()+nu.getMinutes()/60;
    pts.forEach(function(p){
      if(p[0]>=24)return;
      if(off===0&&p[0]<=nuH)return;
      if(!bast||p[1]<bast.pris)bast={off:off,h:p[0],pris:p[1]};
    });
  });
  return bast;
}
function battTidTill(off,h){return dayStart()+off*86400000+Math.round(h*60)*60000;}
function battKlAv(ms){
  var d=new Date(ms);
  return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);
}
function battLaddHTML(){
  var vald=battStartAktiv();
  var h='<div class="ladd-pop">';
  if(vald){
    h+='<div class="dsec">Inbokad start</div>'
      +dRow('Startar',battKlAv(vald)+((new Date(vald)).getDate()!==battNu().getDate()?' imorgon':''))
      +'<div class="cfg-btns bl-rad"><button class="te-alt" onclick="battAvbokaStart()">Avboka</button></div>';
  }
  return h+laddValHTML(false)+'</div>';
}
/* Rutnätet (Ladda nu, Lägsta pris, Om 1 h, Om 3 h) och egen tid. laddarNu =
   bilen laddar redan, så "Ladda nu" har inget att göra. */
function laddValHTML(laddarNu){
  var h='';
  /* SAMMA FORM PÅ ALLA FYRA: stor rad = vad man väljer, liten rad = vad det
     blir. Förut stod klockslaget stort på de fasta valen och valets namn litet,
     tvärtemot prisknappen — och prisknappens långa text radbröts till tre rader
     så knappen blev högre än de andra. Nu är texterna korta nog att rymmas på
     en rad, och en gemensam minsta höjd håller rutnätet jämnt. */
  h+='<div class="dsec">Starta laddning</div><div class="bl-val">';
  if(laddarNu)h+='<button class="bl-b pri" disabled><b>Ladda nu</b><small>laddar redan</small></button>';
  else h+='<button class="bl-b pri" onclick="blValt(this,\'nu\')">'
    +'<b>Ladda nu</b><small>direkt</small></button>';
  /* PRISVALET är det enda som ändrar sig av sig själv. Pilen är borttagen i
     v655 — den blå ramen och den blå rubriken räcker för att skilja knappen
     från de fasta klockslagen, och ikonen konkurrerade med texten på en knapp
     som är halva rutans bredd. */
  var b=battBilligKl();
  if(b){
    h+='<button class="bl-b bl-pris" onclick="blValt(this,\'boka\','+battTidTill(b.off,b.h)+')">'
      +'<b>L\u00e4gsta pris</b>'
      +'<small>'+battKl(b.h*60)+(b.off?' imorgon':'')+' \u00b7 '+oren(b.pris)+'</small></button>';
  }else{
    h+='<button class="bl-b bl-pris" disabled>'
      +'<b>L\u00e4gsta pris</b>'
      +'<small>ingen billig timme fram\u00e5t</small></button>';
  }
  /* Fasta val som fungerar även utan prisdata. */
  [[1,'Om 1 timme'],[3,'Om 3 timmar']].forEach(function(x){
    var t3=Date.now()+x[0]*3600000;
    h+='<button class="bl-b" onclick="blValt(this,\'boka\','+t3+')">'
      +'<b>'+x[1]+'</b><small>'+battKlAv(t3)+'</small></button>';
  });
  h+='</div>';
  /* EGEN TID: KLOCKSLAG ELLER TIMER, sida vid sida i samma stil.
     Klockslag när man vet NÄR, timer när man vet OM HUR LÄNGE — båda är
     naturliga och det ena går inte att räkna om i huvudet till det andra i
     farten. Den man senast rörde är den som bokas, och bokaknappen skriver ut
     vilket det blir, så valet aldrig är otydligt.
     <input type="time"> är fortfarande uteslutet: den öppnar Androids egen
     klockruta ovanpå popupen. */
  h+='<div class="dsec">Egen tid</div>'
    +'<div class="bl-egen">'
    +'<div class="bl-par">'
    +'<div class="bl-blk'+(_blLage==='klocka'?' vald':'')+'" onclick="blLageSatt(\'klocka\')">'
      +'<div class="bl-blk-h">Klockslag</div>'
      +'<div class="bl-ur">'+blStapel('t',2)+'<span class="bl-kolon">:</span>'+blStapel('m',2)+'</div>'
    +'</div>'
    +'<div class="bl-blk'+(_blLage==='timer'?' vald':'')+'" onclick="blLageSatt(\'timer\')">'
      +'<div class="bl-blk-h">Timer</div>'
      +'<div class="bl-ur">'+blStapel('th',1)+'<span class="bl-kolon">:</span>'+blStapel('tm',2)+'</div>'
    +'</div>'
    +'</div>'
    +'<button class="bl-boka" onclick="blValt(this,\'egen\')">'+esc(blBokaText())+'</button>'
    +'</div>';
  return h;
}
function blTid(){
  if(_blTid==null){
    var d=new Date(Date.now()+3600000);
    _blTid=(d.getHours()*60+Math.round(d.getMinutes()/15)*15)%1440;
  }
  return _blTid;
}
function blTimer(){if(_blTimer==null)_blTimer=60;return _blTimer;}
function blLageSatt(v){if(v!=='klocka'&&v!=='timer')return;_blLage=v;battLaddOm();}
function blBokaText(){
  if(_blLage==='timer'){
    var m=blTimer();
    return 'Boka om '+(m>=60?(Math.floor(m/60)+' h'+(m%60?' '+(m%60)+' min':'')):(m+' min'));
  }
  return 'Boka '+battKl(blTid());
}
function blStapel(vad,siffror){
  var tal;
  if(vad==='t')tal=Math.floor(blTid()/60);
  else if(vad==='m')tal=blTid()%60;
  else if(vad==='th')tal=Math.floor(blTimer()/60);
  else tal=blTimer()%60;
  var txt=String(tal);while(txt.length<siffror)txt='0'+txt;
  return '<div class="bl-kol">'
    +'<button class="bl-pil" onclick="blJust(\''+vad+'\',1)" aria-label="upp">'+icon('caret-up')+'</button>'
    +'<span class="bl-num">'+txt+'</span>'
    +'<button class="bl-pil" onclick="blJust(\''+vad+'\',-1)" aria-label="ner">'+icon('caret-down')+'</button>'
    +'</div>';
}
/* Timmar i timsteg, minuter i kvartssteg. Båda wrappar var för sig — att
   minuterna drar med sig timmen när de slår runt är förvirrande när man bara
   vill peta på kvarten. */
function blJust(vad,rikt){
  if(vad==='th'||vad==='tm'){
    /* Timern: timsteg respektive halvtimmessteg, klämd mellan en halvtimme och
       tolv timmar. Ingen wrap — att en fördröjning slår runt till noll är inte
       vad någon menar med "en timme till". */
    var tv=blTimer();
    tv+=(vad==='th')?rikt*60:rikt*BL_TIMER_STEG;
    _blTimer=Math.max(BL_TIMER_STEG,Math.min(BL_TIMER_MAX,tv));
    _blLage='timer';
    battLaddOm();
    return;
  }
  var v=blTid(), t=Math.floor(v/60), m=v%60;
  if(vad==='t')t=((t+rikt)%24+24)%24;
  else m=((m+rikt*15)%60+60)%60;
  _blTid=t*60+m;
  _blLage='klocka';
  battLaddOm();
}
/* KVITTERA OCH STÄNG DIREKT. Kvittensen sätts på knappen och åtgärden körs i
   samma tryck — ingen fördröjning. En paus på ett par tiondelar kändes som att
   rutan hängde sig, och kvittensen hinner ändå ritas innan stängningen. */
function blValt(el,vad,ms){
  try{if(el&&el.classList)el.classList.add('bl-vald');}catch(e){}
  if(_blMal==='bil'){                       /* v719: bilens laddruta */
    if(vad==='nu')bilLaddaNu();
    else bilBoka(vad==='egen'?blEgenMs():ms);
    return;
  }
  if(vad==='nu')battStartaNu();
  else if(vad==='egen')battEgenTid();
  else battBokaStart(ms);
}
function battLaddOm(){var b=$('dlg-body');if(b)b.innerHTML=(_blMal==='bil')?bilLaddPopHTML():battLaddHTML();}
/* HÄR LÅG FELET: jag använde DLG_OM och openDlg, som hör till Göteborgs
   dashboard. Gottskär öppnar sina rutor med openDetail(), och ett anrop till
   något som inte finns kastade — btnTap fångade det och skrev "fel" på
   knappen i stället för att öppna rutan. */
function openBattLadd(){openDetail('battladd');}
/* Var i knapplisten ligger ladda max-knappen? Behövs för att kunna skriva
   direkt i den, som avstängningen gör via flashCtl. */
function battKnappIx(){
  try{
    var B=(CONFIG&&CONFIG.BUTTONS)||[];
    for(var i=0;i<B.length;i++)if(B[i]&&B[i].type==='battladd')return i;
  }catch(e){}
  return -1;
}
async function battStartaNu(){
  battStartSatt(null);
  var sparaTill=battSparaTill(Date.now());
  battStoppSkriv(sparaTill);
  /* STÄNG, VISA VÄNTLÄGET, SKICKA SEDAN.
     battLaddLage() läser två modbus-capabilities som inte uppdateras förrän
     nästa hämtning, så knappen måste visa väntan själv.
     BÅDE omritning OCH flashCtl: avstängningen går via flashCtl och den syns
     säkert, medan enbart renderControls visade sig otillräckligt här — knappen
     blev grå igen direkt när rutan stängdes. Jag har inte kunnat återskapa det
     i provmiljön, så den här vägen gör samma sak som den som bevisligen
     fungerar, i stället för att jag gissar vidare på orsaken. */
  closeDetail();
  battVantaSatt(true);
  renderControls();
  var ix=battKnappIx();
  if(ix>=0)flashCtl(ix,'Startar\u2026');
  try{
    await homeyTriggerFlow('standard',BATT_FLOW_PA);
    toast('Startar laddning\u2026'+(sparaTill?' Fullt sparas till '+regelKl(sparaTill):''));
    /* Rita om direkt efter svaret också — annars kan en omritning som hann
       emellan ha lämnat knappen utan väntklassen. */
    renderControls();
    if(ix>=0)flashCtl(ix,'Startar\u2026');
    setTimeout(function(){load();},1500);
    setTimeout(renderControls,3000);
  }catch(e){
    /* SVARET FRÅN /trigger ÄR INGET KVITTO FÖR DET HÄR FLÖDET.
       Mätt i drift: anropet ger fel — ibland direkt med en HTTP-status, ibland
       som avbrott efter tidsgränsen — samtidigt som flödet kör klart och
       batteriet börjar ladda. POST /trigger returnerar först när flödet är
       FÄRDIGT, och det här flödet skriver modbus-register; Homey hinner svara
       med fel innan skrivningen landat.
       Två gånger har jag lagat symptomet i stället för orsaken: först
       nollställde jag väntläget vid alla fel, sedan bara vid fel som inte var
       avbrott. Båda byggde på antagandet att ett felsvar betyder att
       ingenting hände. Det antagandet håller inte.
       ENHETENS LÄGE ÄR FACIT. Väntläget står kvar oavsett vad anropet säger,
       och släpper när modbus bekräftar eller efter 45 s. Orsaken hamnar i
       toasten, så den går att läsa av utan att knappen ljuger. */
    renderControls();
    if(ix>=0)flashCtl(ix,'Startar\u2026');
    var msg=(e&&e.message)?e.message:'ok\u00e4nt';
    toast(isAbort(e)?'Startar\u2026 (Homey svarade inte i tid)'
                    :('Startar\u2026 (Homey svarade: '+msg+')'));
  }
}
function battVantaSatt(pa){
  try{localStorage.setItem(BATT_VANTA_KEY,JSON.stringify({pa:!!pa,t:Date.now()}));}catch(e){}
  battVantaPuls();
}
function battVantaKlar(){
  try{localStorage.removeItem(BATT_VANTA_KEY);}catch(e){}
  if(_battVantaPuls){clearInterval(_battVantaPuls);_battVantaPuls=null;}
}
/* null = väntar inte. Annars {pa:true/false} — vilket läge vi väntar på. */
function battVantar(){
  var o=null;
  try{o=JSON.parse(localStorage.getItem(BATT_VANTA_KEY)||'null');}catch(e){}
  if(!o||typeof o.t!=='number')return null;
  var nu=battLaddLage();
  if(nu===o.pa){battVantaKlar();return null;}              /* bekräftat */
  if(Date.now()-o.t>BATT_VANTA_MS){battVantaKlar();return null;}
  return o;
}
/* Håller knappen rätt medan vi väntar. Stannar av sig själv.
   RITAR INTE OM VARJE SEKUND. En full omritning byter ut knappens innehåll,
   och då börjar ikonens snurr om från noll — den hoppade till en gång i
   sekunden. Pulsen säkrar i stället bara att klassen och texten sitter kvar,
   utan att röra elementen, och ritar om EN gång när väntan släpper. */
function battVantaPuls(){
  if(_battVantaPuls)return;
  _battVantaPuls=setInterval(function(){
    var v=battVantar();
    if(!v){
      if(_battVantaPuls){clearInterval(_battVantaPuls);_battVantaPuls=null;}
      try{renderControls();}catch(e){}
      return;
    }
    try{
      var ix=battKnappIx();
      if(ix<0)return;
      var el=$('controls');if(!el||!el.querySelectorAll)return;
      var btn=el.querySelectorAll('.ctl')[ix];if(!btn)return;
      /* Rör bara det som kan ha gått förlorat — inte innehållet. */
      if(!btn.classList.contains('vantar'))btn.classList.add('vantar');
      /* 'on' sätts inte längre av renderControls medan vi väntar, så det finns
         inget att ta bort här. Att göra det ändå var halva blinkandet. */
      var l=btn.querySelector('.ctl-l');
      var txt=v.pa?'Startar\u2026':'St\u00e4nger av\u2026';
      if(l&&l.textContent!==txt)l.textContent=txt;
    }catch(e){}
  },1000);
}
function battBokaStart(ms){
  if(!(ms>Date.now())){toast('Tiden har redan passerat');return;}
  battStartSatt(ms);
  var sparaTill=battSparaTill(ms);
  battStoppSkriv(sparaTill);
  /* SAMMA ORDNING SOM "LADDA NU", som bevisligen fungerar: stäng rutan FÖRST,
     rita om sedan. Förut låg closeDetail sist, efter renderControls och
     flashCtl — kastade någon av dem blev rutan stående. Nu kan de inte hindra
     stängningen, och de är dessutom inlindade var för sig. */
  /* EXAKT SAMMA ORDNING SOM battStartaNu, som visar sig direkt: stäng, rita
     om, skriv i knappen — och toasten SIST. Toasten låg före omritningen och
     är det enda som skilde vägarna åt. */
  closeDetail();
  try{renderControls();}catch(e){}
  try{var bix=battKnappIx();if(bix>=0)flashCtl(bix,'Bokad \u00b7 '+battKlAv(ms));}catch(e){}
  toast('Laddning bokad '+battKlAv(ms)+(sparaTill?' \u00b7 fullt sparas till '+regelKl(sparaTill):''));
}
function battAvbokaStart(){battStartSatt(null);battStoppAvboka();toast('Avbokad');renderControls();battLaddOm();}
function blEgenMs(){
  if(_blLage==='timer')return Date.now()+blTimer()*60000;
  var t=dayStart()+blTid()*60000;
  if(t<=Date.now())t+=86400000;             /* passerat idag → imorgon */
  return t;
}
function battEgenTid(){battBokaStart(blEgenMs());}
/* BEVAKNINGEN LIGGER I HOMEY sedan v666 — flödet "Batteri · inbokad start"
   kör varje minut och startar laddningen. Den här funktionen triggar därför
   inget längre; den hämtar bara hem Homeys bild av bokningen så knappen
   stämmer. Att låta webbläsaren också trigga hade gett två startare på samma
   bokning. */
function battStartKoll(){
  try{battBokaHamta();}catch(e){}
}
function battStartKollGammal(){
  try{
    var t=battStartAktiv();
    if(t==null)return;
    if(Date.now()<t)return;
    if(_battStartBusy)return;
    if(battLaddLage()===true){battStartSatt(null);return;}   /* redan på */
    _battStartBusy=true;
    battVantaSatt(true);
    /* SVARET FRÅN /trigger ÄR INGET KVITTO — samma lärdom som i battStartaNu,
       som aldrig tillämpades här. Flödet svarar med fel medan det körs, och
       eftersom felgrenen lät bokningen ligga kvar triggades den OM var 30:e
       sekund, i all oändlighet. Nu tas bokningen bort så fort kommandot är
       skickat; väntläget står kvar och enhetens läge avgör. */
    var klar=function(){
      battStartSatt(null);_battStartBusy=false;
      try{renderControls();}catch(e){}
    };
    homeyTriggerFlow('standard',BATT_FLOW_PA).then(function(){
      klar();
      try{toast('Laddar max – inbokad start');}catch(e){}
    },function(e){
      klar();
      try{toast('Inbokad start skickad (Homey svarade: '+((e&&e.message)||'okänt')+')');}catch(e2){}
    });
  }catch(e){_battStartBusy=false;}
}
function btnState(b){ // returnerar true om "på/aktiv"
  if(b.type==='toggle'){const v=cap(b.device,b.cap);return b.cap==='onoff'?v===true:v===b.on;}
  /* BREVEDEN: läget kommer från logikvariabeln, inte från något lokalt minne.
     Skriptet är auktoritativt — knappen speglar bara vad det säger. */
  if(b.type==='breveden'){var Bs=brvState();return !!(Bs&&Bs.aktiv);}
  if(b.type==='disk')return diskBokad()||diskKor();
  if(b.type==='battladd')return battLaddLage()===true;
  if(b.type==='flowtoggle'){
    /* Följ-enhet går före: den vet vad som faktiskt hände, även om flowet
       startats från Homey-appen. Utan den återstår minnet av senaste tryck. */
    if(b.refDev)return cap(b.refDev,b.refCap||'onoff')===true;
    try{return localStorage.getItem('flowtog_'+(b.flowOn||'')+'_'+(b.flowOff||''))==='on';}catch(e){return false;}
  }
  if(b.type==='moodtoggle'){
    if(b.refDev)return cap(b.refDev,b.refCap||'onoff')===true;      /* vald referens-enhet går före */
    var ids=moodLightIds(b);
    if(ids.length){for(var k=0;k<ids.length;k++){if(cap(ids[k],'onoff')===true)return true;}return false;}
    return localStorage.getItem('moodtog_'+(b.moodOn||'')+'_'+(b.moodOff||''))==='on';
  }
  return false;
}
/* Fördelar knapparna på rader så jämnt som möjligt, med den fulla raden först.
   5 -> [5]   6 -> [3,3]   7 -> [4,3]   9 -> [5,4]   11 -> [4,4,3]
   Fler än MAX per rad blir knapparna för små för att träffa. */
function ctlRows(n,max){
  var rader=Math.max(1,Math.ceil(n/max));
  var bas=Math.floor(n/rader), rest=n%rader, ut=[];
  for(var i=0;i<rader;i++)ut.push(bas+(i<rest?1:0));
  return ut;}
/* Knappen krymper när fler delar på raden. Fyra ryms nätt och jämnt i full
   storlek på en telefon, fem behöver mindre ikon och text. */
function ctlScale(k){return k>=5?0.78:(k===4?0.88:1);}
function renderControls(){
  const el=$('controls');if(!el)return;
  try{diskObs();}catch(e){}
  if(!CONFIG.CONTROL_ENABLED||!(CONFIG.BUTTONS&&CONFIG.BUTTONS.length)){el.style.display='none';return;}
  el.style.display='';
  const n=CONFIG.BUTTONS.length, mob=szMobile();
  const rader=ctlRows(n, mob?5:6);
  /* Ingen kolumnsättning längre: raderna är flexrader på alla enheter, och
     varje rad fyller bredden oavsett hur många knappar den har. */
  el.style.gridTemplateColumns='';
  const live=SOURCE.indexOf('Homey')===0||SOURCE.indexOf('lokal')===0;
  const knapp=(b,i)=>{
    /* on är inte const: väntläget måste kunna slå ut det. Står knappen kvar
       som tänd medan den väntar på avstängning får den både 'on' och 'vantar',
       och eftersom pulsen tog bort 'on' medan nästa omritning satte tillbaka
       den blinkade knappen grönt i otakt. */
    var on=btnState(b);
    const isArm=armed.i===i;
    var ic=b.icon,lbl=b.label,extra='',vantar=false,icStil='',bokad=false;
    /* HAR ANVÄNDAREN VALT EN EGEN IKON?
       Tre knapptyper byter ikon efter läge — vippan, moodet och Breveden. De
       skrev tidigare över den valda ikonen villkorslöst, så ikonväljaren såg ut
       att fungera men syntes aldrig på knappen. Nu gäller lägesikonen bara när
       ikonen ÄR en av lägesikonerna, alltså när man låtit valet vara
       automatiskt. Att jämföra mot listan i stället för att spara ett eget
       "auto"-fält gör att gamla sparade knappar beter sig som förut. */
    /* v533: valet läses ur ett EGET fält i stället för att härledas.
       v530 jämförde b.icon mot lägesikonerna och antog att allt annat var ett
       medvetet val. Det antagandet höll inte - en knapp sparad med någon annan
       ikon låste sig i den, och Brevedens ikon slutade följa värme och kyla.
       Nu sätts icoval bara när man faktiskt pekar på en ikon i väljaren, och
       en knapp utan fältet får lägesikonen precis som före v530. */
    var beAuto=function(){return !b.icoval;};
    if(b.type==='moodtoggle'){
      if(beAuto())ic=on?'lightbulb':'lightbulb-off';
      lbl=on?'Släck':'Tänd';}
    /* DISKMASKINEN: släckt knapp = ingen bokning, bara namnet. Tänd knapp =
       bokad, och då står klockslaget där namnet stod — det är det man vill veta. */
    else if(b.type==='disk'){
      /* Tänd knapp betyder bokad, och då säger etiketten vad ett tryck GÖR —
         avbokar — med tiden efter, så man ser vad som avbokas. */
      /* SAMMA IKON i båda lägena — kniv och gaffel. Att byta ikon när knappen
         tänds gjorde att man först måste läsa sig till vilken knapp det var.
         Tänd betyder bokad, och då står bara tiden. */
      ic=b.icon||'fork-knife';
      /* Tre lägen: kör → framsteg, bokad → tid, annars namnet. Att maskinen
         faktiskt går är färskare information än en bokning och går före. */
      if(diskKor()){
        var dp=diskProc(),dm=diskMinKvar();
        lbl=(dp!=null?(Math.round(dp)+' %'):'Kör')+(dm!=null&&dm>0?(' \u00b7 '+dm+' min'):'');
        /* Strecket ritas även när procenten saknas: då står det på noll och
           säger "igång, men vet inte hur långt" — inte "nästan klar". */
        extra='<span class="ctl-prog"><i style="width:'+(dp!=null?Math.round(dp):0)+'%"></i></span>';
      }
      else lbl=on?(diskNar()||'Bokad'):(b.label||'Diskmaskin');
    }
    /* ENHETSKNAPPEN: etiketten sager hur manga forslag som finns just nu.
       Utan siffran ser knappen likadan ut oavsett om popupen har sex rader
       eller ar tom, och da vet man inte om det ar lont att trycka. */
    else if(b.type==='vanor'){
      ic=b.icon||'clock';
      var vn=0;try{vn=vanBygg().length;}catch(e){}
      lbl=(b.label||'Enheter')+(vn?(' \u00b7 '+vn):'');
    }
    else if(b.type==='battladd'){
      /* ETIKETTEN VISAR LAGET, inte vad ett tryck gor. Det ar tvartemot
         vippan och moodknappen, men rimligt har: "Laddar max" ar ett tillstand
         man vill kunna lasa av pa avstand, och att knappen ar tand sager redan
         att ett tryck stanger av.
         Undertexten ar borttagen - den sa samma sak en gang till. */
      var bl=battLaddLage();
      var vnt=battVantar();
      if(beAuto())ic=vnt?'arrows-clockwise':((bl===true)?'battery-charging':'battery-high');
      if(vnt){
        /* Väntar: varken tänd eller släckt. Ikonen snurrar och texten säger
           vad som är på gång. */
        lbl=vnt.pa?'Startar\u2026':'St\u00e4nger av\u2026';
        vantar=true;
        on=false;                 /* väntan är ett eget läge, inte tänt */
        /* SNURREN FORTSÄTTER FRÅN RÄTT VINKEL.
           Sidan ritar om knappraden med jämna mellanrum, och då byts ikonens
           element ut — animationen började om från noll varje gång, vilket såg
           ut som att ikonen hoppade fram och tillbaka. Går inte att undvika
           genom att rita om mer sällan; omritningen behövs.
           I stället får animationen en NEGATIV fördröjning som motsvarar hur
           länge väntan pågått. Den nya ikonen startar då i samma vinkel som
           den gamla slutade, och snurren ser obruten ut. */
        icStil=' style="animation-delay:-'+((Date.now()-vnt.t)%1100)+'ms"';
      }
      else if(bl===null){lbl='Ingen kontakt';}
      else if(bl){
        /* På: säg NÄR den stänger av av sig själv pga stigande pris. Utan en
           kommande uppgång står bara "Laddar max". */
        var avk=battAvstangKl();
        lbl=avk?('Laddar · till '+avk):'Laddar';   /* v719: "Ladda" i stället för "Ladda max" */
      }else{
        /* Inbokad start syns på knappen, annars vet man inte att den ligger. */
        var bs=battStartAktiv();
        /* Säg vilket läge som valts, inte bara att något är inbokat. Trycker
           man "Lägsta pris" vill man se att det var DET som bokades. */
        lbl=bs?('Bokad \u00b7 '+battKlAv(bs)):'Ladda';
        /* Bokat är ett eget läge — varken av eller på. Gult skiljer det från
           grönt (laddar) och orange (väntar på att slå igenom). */
        bokad=!!bs;
      }
    }
    else if(b.type==='flowtoggle'){
      /* Vippan visar VILKET LÄGE knappen står i, och etiketten vad ett tryck
         gör härnäst — samma logik som moodtoggle. Har man valt en egen ikon
         står den kvar i båda lägena; etiketten säger ändå vad som händer. */
      if(beAuto())ic=on?'toggle-right':'toggle-left';
      lbl=on?(b.labelOff||b.label||'Av'):(b.labelOn||b.label||'På');
    }
    else if(b.type==='breveden'){
      /* Samma fyra lägen som rutan: aktiv visar vilket läge som körs, inaktiv
         vad ett tryck skulle göra, och osäkert läge gråas. */
      var Bb=brvState(), gam=brvGammal(Bb);
      var brvAuto=beAuto();
      if(Bb&&Bb.aktiv){
        if(brvAuto)ic=(Bb.lage==='cool')?'snowflake':(Bb.lage==='heat')?'flame':'thermometer-simple';
        lbl=b.label||'Breveden';
      }else{
        var nl=Bb&&Bb.nastaLage;
        if(brvAuto)ic=(nl==='cool')?'snowflake':(nl==='heat')?'flame':'thermometer-simple';
        lbl=b.label||'Breveden';
      }
      if(Bb&&Bb.inne!=null)lbl+=' '+num(Bb.inne,1)+'°';
      if(gam)lbl+=' ?';
    }
    else if(b.type==='toggle'&&(ic==='lightbulb'||ic==='lightbulb-off'))ic=on?'lightbulb':'lightbulb-off';
    return '<button class="ctl'+(on?' on':'')+(isArm?' arm':'')+(vantar?' vantar':'')+(bokad?' bokad':'')+'" data-bi="'+i+'" onclick="btnTap('+i+')"'+(live?'':' data-demo="1"')+'>'
      +'<span class="ctl-ic"'+icStil+'>'+icon(ic)+'</span><span class="ctl-l">'+esc(isArm?'Bekräfta?':lbl)+'</span>'
      +extra
      +'</button>';};
  let h='',i=0;
  for(let r=0;r<rader.length;r++){
    const k=rader[r];
    h+='<div class="ctl-row" style="--n:'+k+';--cs:'+ctlScale(k)+'">';
    for(let q=0;q<k;q++,i++)h+=knapp(CONFIG.BUTTONS[i],i);
    h+='</div>';}
  el.innerHTML=h;
  /* Hem-rutans popup visar samma knappar — rita om den när knapparna ändras. */
  try{if(_dlgWhich==='hem'){var hb=$('dlg-body');if(hb)hb.innerHTML=hemPopup();}
    else{var pk=$('popk-'+({dish:'dish',pool:'pool',batt:'batt'}[_dlgWhich]||'x'));
      if(pk){var ny=popKnappar(_dlgWhich==='dish'?'dish':_dlgWhich);var t=document.createElement('div');t.innerHTML=ny;
        if(t.firstChild)pk.innerHTML=t.firstChild.innerHTML;}}}catch(e){}
}
async function btnTap(i){
  if(_lp.fired){_lp.fired=false;return;}
  const b=CONFIG.BUTTONS[i];if(!b)return;
  const live=SOURCE.indexOf('Homey')===0||SOURCE.indexOf('lokal')===0;
  if(!live){flashCtl(i,'kräver Homey',true);return;}
  /* BATTERILADDNINGEN: ett tryck när inget är igång öppnar bara rutan med
     tidsvalen, och den är bekräftelsen nog. Men när ett läge ÄR igång —
     laddning pågår eller en start är inbokad — betyder trycket att det ska
     avbrytas, och då krävs två tryck. Att råka avbryta en inbokad billig
     laddning märks först timmar senare.
     Ett eget confirm-val på knappen gäller fortfarande. */
  var battAktiv=(b.type==='battladd')&&(battLaddLage()===true||battStartAktiv()!=null);
  if((b.confirm||battAktiv)&&!(armed.i===i&&Date.now()-armed.t<4000)){armed={i:i,t:Date.now()};renderControls();setTimeout(()=>{if(armed.i===i){armed={i:-1,t:0};renderControls();}},4000);return;}
  armed={i:-1,t:0};
  try{
    flashCtl(i,'skickar…');
    if(b.type==='allLightsOff'){
      const ps=[];for(const id in DATA){const d=DATA[id];if((d.class||d.type)==='light'&&capOf(d,'onoff')===true)ps.push(homeyPut(id,'onoff',false).catch(()=>{}));}
      await Promise.allSettled(ps);
    }else if(b.type==='flow'){
      await homeyTriggerFlow(b.flowType||'standard',b.flowId);
      flashCtl(i,'startad ✓');setTimeout(renderControls,1400);
      return;
    }else if(b.type==='mood'){
      await homeySetMood(b.moodId);
      flashCtl(i,'aktiverad ✓');setTimeout(renderControls,1400);
      return;
    }else if(b.type==='disk'){
      var varBokad=diskBokad();
      /* Går maskinen utan att någon tid är bokad finns det inget att avboka, och
         knappen ska INTE boka en ny tid mitt i ett pågående program. Trycket blir
         en upplysning i stället för en åtgärd. Knappen stänger heller aldrig av
         maskinen — den skickar bara boka/avboka till Homey, aldrig onoff.
         Finns en bokning ligger den grenen först, så avbokning fungerar även
         medan programmet kör. */
      if(!varBokad&&diskKor()){flashCtl(i,'maskinen går');setTimeout(renderControls,1800);return;}
      await diskTryck();
      flashCtl(i,varBokad?'avbokar…':'bokar…');
      setTimeout(renderControls,2600);
      return;
    }else if(b.type==='vanor'){
      /* Oppnar bara en lista - ingenting skickas till Homey har. */
      openVanor();
      return;
    }else if(b.type==='breveden'){
      /* Knappen öppnar rutan sedan v606. Start och stopp via skriptet ligger
         kvar som snabbvalet "Auto" därinne — ett tryck som ändrar något ska
         göras där man ser vad som gäller, inte blint från knapprutan. */
      openDetail('breveden');
      return;
    }else if(b.type==='battladd'){
      var bl2=battLaddLage();
      if(bl2===null){flashCtl(i,'ingen kontakt',true);return;}
      var bokad=battStartAktiv();
      if(!bl2&&bokad==null){
        /* Inget igång: öppna rutan. flashCtl har redan skrivit "skickar…" och
           återställer inte sig själv — här skickas ingenting, så knappen ritas
           om direkt. */
        openBattLadd();
        renderControls();
        return;
      }
      /* Något är igång och trycket är bekräftat: avbryt det.
         v728: stoppet följer med – Stoppa ger normal drift direkt, och en
         avbokad laddning ska inte lämna ett spara efter sig. */
      battStartSatt(null);
      if(bl2)battStoppSkriv(0);else battStoppAvboka();
      if(bl2){
        battVantaSatt(false);            /* samma skäl som vid start */
        /* Rita om DIREKT. Utan den här raden satte först pulsen klassen, en
           sekund senare — knappen stod kvar som tänd och grön under tiden. */
        try{renderControls();}catch(e3){}
        /* SVARET ÄR INGET KVITTO — samma sak som vid start. Mätt i drift ger
           anropet fel (HTTP-status eller avbrott) medan flödet kör klart.
           Förut kastades allt som inte var ett avbrott vidare till btnTaps
           yttre catch, som målade knappen RÖD ett ögonblick innan väntläget
           tog över. Nu sväljs alla fel här; enhetens läge avgör, och orsaken
           hamnar i toasten. */
        try{await homeyTriggerFlow('standard',BATT_FLOW_AV);}
        catch(e2){
          var m2=(e2&&e2.message)?e2.message:'ok\u00e4nt';
          toast(isAbort(e2)?'St\u00e4nger av\u2026 (Homey svarade inte i tid)'
                           :('St\u00e4nger av\u2026 (Homey svarade: '+m2+')'));
        }
      }
      flashCtl(i,bl2?'stänger av\u2026':'avbokad ✓');
      /* Registret uppdateras inte direkt - flodet skriver, vaxelriktaren
         svarar, och Homey hinner lasa forst vid nasta varv. Darfor lite langre
         vantan an de andra knapparna innan rutan ritas om. */
      setTimeout(function(){load();},1500);
      setTimeout(renderControls,3000);
      return;
    }else if(b.type==='flowtoggle'){
      /* Två flows, ett per riktning. Läget hämtas från btnState — följ-enhet om
         en är vald, annars lokalt minne — så knappen visar rätt även när flowet
         startats från Homey-appen. */
      var fOn=btnState(b);
      var nf=fOn?(b.flowOff||''):(b.flowOn||'');
      var nt=fOn?(b.flowOffType||'standard'):(b.flowOnType||'standard');
      if(!nf){flashCtl(i,'inget flow valt',true);return;}
      await homeyTriggerFlow(nt,nf);
      try{localStorage.setItem('flowtog_'+(b.flowOn||'')+'_'+(b.flowOff||''),fOn?'off':'on');}catch(e){}
      flashCtl(i,(fOn?'av ✓':'på ✓'));setTimeout(renderControls,1400);
      return;
    }else if(b.type==='moodtoggle'){
      /* Riktningen bestäms av knappens nuvarande läge (btnState): följ-enhet om vald,
         annars lamporna, annars lokalt minne. Så knappen känner av moods som startats
         från Homey-appen eller en annan enhet. */
      var isOn=btnState(b);
      var next=isOn?b.moodOff:b.moodOn;
      await homeySetMood(next);
      /* Uppdatera lokalt minne som reserv (används bara om varken följ-enhet eller lampor finns). */
      try{localStorage.setItem('moodtog_'+(b.moodOn||'')+'_'+(b.moodOff||''),isOn?'off':'on');}catch(e){}
      flashCtl(i,(isOn?'av ✓':'på ✓'));setTimeout(renderControls,1400);
      return;
    }else if(b.type==='set'){
      await homeyPut(b.device,b.cap,b.value);
      if(DATA[b.device]&&DATA[b.device].capabilitiesObj&&DATA[b.device].capabilitiesObj[b.cap])DATA[b.device].capabilitiesObj[b.cap].value=b.value;
    }else if(b.type==='toggle'){
      const cur=cap(b.device,b.cap);let val;
      if(b.cap==='onoff')val=!(cur===true);else val=(cur===b.on)?b.off:b.on;
      await homeyPut(b.device,b.cap,val);
      if(DATA[b.device]&&DATA[b.device].capabilitiesObj&&DATA[b.device].capabilitiesObj[b.cap])DATA[b.device].capabilitiesObj[b.cap].value=val; // optimistiskt
    }
    renderControls();
    setTimeout(load,900);
  }catch(e){console.warn('styrning misslyckades:',e);flashCtl(i,'fel',true);}
}
function flashCtl(i,msg,err){const el=$('controls');if(!el||!el.querySelectorAll)return;const btns=el.querySelectorAll('.ctl');const btn=btns[i];if(!btn)return;
  const l=btn.querySelector('.ctl-l');if(l)l.textContent=msg;btn.classList.toggle('err',!!err);}
function setViewMode(m){try{localStorage.setItem('view_mode_v1',m);}catch(e){}
  /* v737: i plattramen på telefonen är dashboarden en iframe – det är
     värdsidan som avgör ram eller inte, så det är den som ska laddas om. */
  try{(window.top&&window.top!==window?window.top:window).location.reload();}catch(e){try{location.reload();}catch(e2){}}}
/* Delad layout (standard PÅ): telefon och platta läser/skriver samma slot, så en
   ändring på telefonen når plattan. Stäng av för separata layouter per enhet. */
function syncVar(){return (CFG&&CFG.shareLayout===false)?SYNC_OWN:SYNC_SHARED;}
function applyKiosk(){
  if(!document.body||!document.body.classList)return;
  if(MOBILE){document.body.classList.remove('kiosk');document.body.classList.remove('tabprev');document.body.classList.add('mobile');
    try{setTimeout(flikradBygg,0);}catch(e){}
    try{const r=document.documentElement;if(r&&r.style)r.style.overflow='';}catch(e){}
    try{const wr=document.querySelector('.wrap');if(wr&&wr.style){wr.style.transform='';wr.style.width='';wr.style.height='';wr.style.zoom='';wr.style.margin='';}}catch(e){}
    return;}
  let on=false;
  if(CONFIG.KIOSK==='on')on=true;else if(CONFIG.KIOSK==='auto'){
    const w=(typeof window!=='undefined'&&window.innerWidth)?window.innerWidth:0;
    const hh=(typeof window!=='undefined'&&window.innerHeight)?window.innerHeight:0;
    const portrait=hh>=w;            // högre än bred
    const shortSide=Math.min(w,hh);  // telefon < 600, platta >= 600
    on=portrait&&shortSide>=600&&w<=1400; // platta i stående = fast; telefon = skroll
  }
  document.body.classList.toggle('kiosk',on);
  let tabprev=false;
  try{if(PHYS_PHONE){tabprev=true;on=true;document.body.classList.add('kiosk');}
  }catch(e){}
  document.body.classList.toggle('tabprev',tabprev);
  /* v746: SKROLL PÅ ANDRA PLATTOR. Kioskramen låser höjden till skärmen och
     krymper avsnitten tills allt får plats – rätt på väggplattan, men på en
     platta med rumsavsnittet (v745) rann de sex rutorna in under rummen. Andra
     plattor än väggplattan (och plattramen, som visar väggplattan) får samma
     utseende men skrollar när innehållet är högre än skärmen. */
  /* index2 (sidan har husbilden): även väggplattan skrollar, så att huset får
     fylla hela bredden och resten ligger under. */
  const rull=on&&!tabprev&&(!arVaggplattaVy()||!!document.getElementById('huspanel'));
  document.body.classList.toggle('rull',rull);
  try{const r=document.documentElement;if(r&&r.style)r.style.overflow=(on&&!rull)?'hidden':'';}catch(e){}
  /* v680: samma startsida som mobilen — flikrad i stället för toppraden. */
  try{flikradBygg();}catch(e){}
  if(typeof setTimeout==='function')setTimeout(fitScreen,40);
}

/* ---- väder ---- */
function wxIcon(sit){sit=(sit||'').toLowerCase();
  if(/regn|skur|dusch|nederbörd/.test(sit))return 'cloud-rain';
  if(/snö|snow|hagel/.test(sit))return 'snowflake';
  if(/dimma|dis|fog/.test(sit))return 'cloud-fog';
  if(/mulet|molnigt/.test(sit))return 'cloud';
  if(/halvklart|växlande|delvis|lätt moln/.test(sit))return 'cloud-sun';
  if(/klart|sol/.test(sit))return 'sun';
  return 'cloud-sun';}
function compassSVG(deg){deg=(deg==null)?null:(((deg%360)+360)%360);
  const lbl=(t,x,y)=>'<text class="cmp-lbl" x="'+x+'" y="'+y+'" text-anchor="middle" font-size="11" font-weight="700">'+t+'</text>';
  let s='<svg class="wx-compass" viewBox="0 0 100 100">';
  s+='<circle class="cmp-card" cx="50" cy="50" r="42" stroke-width="2"/>';
  for(let a=0;a<360;a+=30){const rad=a*Math.PI/180;s+='<line x1="'+(50+42*Math.sin(rad)).toFixed(1)+'" y1="'+(50-42*Math.cos(rad)).toFixed(1)+'" x2="'+(50+37*Math.sin(rad)).toFixed(1)+'" y2="'+(50-37*Math.cos(rad)).toFixed(1)+'" stroke="var(--svg-track)" stroke-width="1.5"/>';}
  s+=lbl('N',50,19)+lbl('S',50,89)+lbl('Ö',85,54)+lbl('V',15,54);
  if(deg!=null){const sz=44,a=ICONS['arrow-fat-up']||ICONS['navigation-arrow']||'';
    s+='<g transform="rotate('+deg.toFixed(0)+' 50 50)"><svg class="cmp-arrow" x="'+(50-sz/2)+'" y="'+(50-sz/2)+'" width="'+sz+'" height="'+sz+'" viewBox="0 0 256 256">'+a+'</svg></g>';}
  s+='</svg>';return s;}
function windAbbr(deg){if(deg==null||!isFinite(deg))return null;const d=['N','NNO','NO','ONO','O','OSO','SO','SSO','S','SSV','SV','VSV','V','VNV','NV','NNV'];return d[Math.round((((deg%360)+360)%360)/22.5)%16];}
function windArrow(deg,size,color){const a=ICONS['navigation-arrow']||ICONS['arrow-fat-up']||'';const rot=(deg==null)?0:((((deg-135)%360)+360)%360);
  const sz=size?('width:'+size+'px;height:'+size+'px;'):'',col=color?('color:'+color+';'):'';
  return '<span class="wx-arrow" style="'+col+sz+'transform:rotate('+rot.toFixed(0)+'deg)"><svg class="ic" viewBox="0 0 256 256">'+a+'</svg></span>';}
function windDesc(ws,gs){const g=(gs==null?-1:gs),s=(ws==null?-1:ws);
  if(g>=28)return 'orkanbyar';if(g>=24.5)return 'svåra stormbyar';if(g>=20.8)return 'kraftiga stormbyar';if(g>=17.2)return 'stormbyar';
  if(g>=13.9&&s>=0&&(g-s)>=5)return 'hårda vindbyar';
  if(s<0)return 'vind';if(s<0.5)return 'stiltje';if(s<3.4)return 'svag vind';if(s<8)return 'måttlig vind';if(s<10.8)return 'frisk vind';if(s<13.9)return 'hård vind';if(s<17.2)return 'hård kuling';if(s<20.8)return 'storm';return 'svår storm';}
function tempExtremes(t){const t0=dayStart();const a=HIST['t_ute']||[];let mn=null,mx=null;
  for(const p of a){if(p.t>=t0&&p.v!=null&&isFinite(p.v)){if(mn==null||p.v<mn)mn=p.v;if(mx==null||p.v>mx)mx=p.v;}}
  if(t!=null&&isFinite(t)){if(mn==null||t<mn)mn=t;if(mx==null||t>mx)mx=t;}
  return {min:mn,max:mx};}
/* Startsidans Max vind / Max by: högsta värde dashboarden SETT idag. Nollställs
   vid dygnsskiftet. Nu sparas även tidpunkten (wt/gt) för varje nytt toppvärde.
   Under tidsresa läses gamla mätvärden ur historiken – de får inte räknas som
   dagens toppar, därför spärren mot _timeActive. */
function windExtremes(ws,gs){const day=dayKey();let o={};try{o=JSON.parse(localStorage.getItem('windEx_v1')||'{}');}catch(e){}
  if(o.day!==day)o={day:day,w:null,g:null,wt:null,gt:null};
  if(!_timeActive){const nu=Date.now();
    if(ws!=null){if(o.w==null||ws>o.w){o.w=ws;o.wt=nu;}}
    if(gs!=null){if(o.g==null||gs>o.g){o.g=gs;o.gt=nu;}}
    try{localStorage.setItem('windEx_v1',JSON.stringify(o));}catch(e){}}
  return {w:o.w,g:o.g,wt:o.wt,gt:o.gt};}
