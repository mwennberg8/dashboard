/* js/styrning.js — Enhetsstyrningen: rum, lampor och gardiner, enhetsknappen som lär sig, TV:n och fjärrkontrollen.
 *
 * Filen innehåller BARA funktionsdeklarationer. Konstanter, tillstånd och allt
 * som körs direkt vid laddning ligger i js/start.js, som laddas sist, under
 * rubriken [styrning.js]. En funktion går att anropa oavsett vilken fil den står
 * i, men kod som körs vid laddning kan här anropa en funktion i en fil som inte
 * hunnit laddas. Lägg den därför aldrig här.
 */


/* ===== ENHETSSTYRNING: RUM, LAMPOR OCH GARDINER (v515) =====
   Portad från Göteborgsdashboarden v1.33.0. Formerna är identiska; tre saker
   är det INTE, och de är avsiktliga:

   1. INGEN GRUPPLOGIK. Göteborg döljer lampor vars namn ser ut som
      "<gruppen> <siffra>" i samma zon, eftersom Hue-rumsgrupper heter så där.
      Jag läste Gottskärs enhetslista innan jag portade regeln, och den skulle
      slå fel här: i Breveden finns "Tak" och "Tak 2" som två separata
      taklampor, inte som grupp och medlem. Regeln hade tyst gömt "Tak 2" och
      gjort den ostyrbar. Alla lampor listas därför var för sig.
   2. RUMMEN VÄLJS PÅ INNEHÅLL, inte på plats i zonträdet. Göteborg tar
      rotzonens barn. Gottskärs träd har ett mellanled — de flesta rummen ligger
      under "Hus", medan Uterum, Breveden och Snickarboa ligger direkt under
      "Hem". Ett rum är här helt enkelt en zon som innehåller något att styra.
   3. GARDINERNA HAR TVÅ SORTERS STYRNING. Göteborgs rullgardiner sätts med
      windowcoverings_set (0–1). Markisen i kontoret har i stället
      windowcoverings_state med Homeys standardlägen up/idle/down. Båda
      hanteras; vilken gren som används avgörs av vilken capability enheten har.

   Uttag och sensorlistan är medvetet inte med — det var steg 3. */

/* ---- hjälpare. r-prefix så ingenting krockar med filens övriga namn ---- */
function rDevs(){return Object.keys(DATA).map(k=>DATA[k]).filter(Boolean);}
function rDevsIZon(zid){return rDevs().filter(d=>d&&d.zone===zid);}
function rumIkon(n){return RUM_IC[String(n||'').trim().toLowerCase()]||'lightbulb';}
function rArLampa(d){
  if(!d||!rHar(d,'onoff'))return false;
  if(RUM_DOLJ_DEV[d.id])return false;
  if(RUM_LAMPA[d.id])return true;
  if(/fönster/i.test(rNamn(d)))return true;
  return rKlass(d)==='light';
}
function rArGardin(d){
  return ['windowcoverings','curtain','blinds'].indexOf(rKlass(d))>=0
    &&(rHar(d,'windowcoverings_set')||rHar(d,'windowcoverings_state'));
}
function rLjusIZon(zid){return rDevsIZon(zid).filter(rArLampa).sort(rSort);}
function rGardIZon(zid){return rDevsIZon(zid).filter(rArGardin).sort(rSort);}
/* Ett rum är en zon med något att styra. Zoner utan lampor och gardiner —
   El, Hus, Hem — faller bort av sig själva utan att stå i koden. */
function rumRang(z){
  if(RUM_TOPP[z.id]!=null)return RUM_TOPP[z.id];
  if(RUM_SIST[z.id])return 99;
  return 50;
}
function rumsZoner(){
  return Object.keys(ZONES).map(k=>ZONES[k]).filter(Boolean)
    .filter(z=>rLjusIZon(z.id).length||rGardIZon(z.id).length)
    .sort((a,b)=>{
      const ra=rumRang(a),rb=rumRang(b);
      if(ra!==rb)return ra-rb;
      return String(a.name||'').localeCompare(String(b.name||''),'sv');
    });
}

/* ---- skrivning ---- */
/* toast() ANROPADES men fanns inte (bilens laddning, klimatet, Breveden).
   Efter en lyckad skrivning kastade anropet ReferenceError, catch-grenen
   anropade toast igen och kastade en gång till — kvittensen syntes aldrig.
   Samma ruta som rummen använder. */
function toast(t){rumToast(t);}
function rumToast(t){
  let e=$('rum-toast');
  if(!e){e=document.createElement('div');e.id='rum-toast';document.body.appendChild(e);}
  e.textContent=t;e.classList.add('on');
  clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('on'),2600);
}
/* Optimistisk uppdatering: värdet skrivs i DATA direkt så att vippan slår om
   med en gång. load() rättar det om Homey säger något annat. */
function rSpegla(id,c,v){const d=DATA[id];
  if(d&&d.capabilitiesObj&&d.capabilitiesObj[c])d.capabilitiesObj[c].value=v;}
async function rSatt(id,c,v){await homeyPut(id,c,v);rSpegla(id,c,v);}

async function devTanda(id){
  const d=DATA[id];if(!d)return;
  const ny=!(capOf(d,'onoff')===true);
  try{await rSatt(id,'onoff',ny);rumRita();setTimeout(load,900);}
  catch(e){rumToast('Kunde inte nå Homey');}
}
async function devDim(id,v){
  const d=DATA[id];if(!d)return;
  const f=Math.max(0.01,Math.min(1,Number(v)/100));
  try{
    if(capOf(d,'onoff')!==true)await rSatt(id,'onoff',true);
    await rSatt(id,'dim',f);
    rumRita();setTimeout(load,1200);
  }catch(e){rumToast('Kunde inte nå Homey');}
}
async function zonAlla(zid,pa){
  const lj=rLjusIZon(zid);if(!lj.length)return;
  try{
    await Promise.all(lj.map(d=>rSatt(d.id,'onoff',pa).catch(()=>{})));
    lj.forEach(d=>rSpegla(d.id,'onoff',pa));
    rumRita();setTimeout(load,900);
  }catch(e){rumToast('Kunde inte nå Homey');}
}
function zonTanda(zid){
  const lj=rLjusIZon(zid);if(!lj.length)return;
  zonAlla(zid,!lj.some(d=>capOf(d,'onoff')===true));
}
async function zonDim(zid,v){
  const lj=rLjusIZon(zid).filter(d=>rHar(d,'dim'));
  const f=Math.max(0.01,Math.min(1,Number(v)/100));
  try{
    await Promise.all(lj.map(async d=>{
      if(capOf(d,'onoff')!==true)await rSatt(d.id,'onoff',true).catch(()=>{});
      await rSatt(d.id,'dim',f).catch(()=>{});
    }));
    rumRita();setTimeout(load,1200);
  }catch(e){rumToast('Kunde inte nå Homey');}
}
function slxPos(andel){
  return 'calc('+SLX_R+'px + (100% - '+(SLX_R*2)+'px) * '+andel.toFixed(4)+')';
}
function slxHTML(id,varde,handling,min,max){
  const mn=(min==null?1:min),mx=(max==null?100:max);
  const v=Math.max(mn,Math.min(mx,Math.round(varde)));
  const a=(v-mn)/Math.max(1,mx-mn);
  return '<div class="slx" data-slx="'+esc(id)+'" data-act="'+esc(handling)+'"'
    +' data-min="'+mn+'" data-max="'+mx+'" data-v="'+v+'"'
    +' role="slider" aria-valuemin="'+mn+'" aria-valuemax="'+mx+'" aria-valuenow="'+v+'" tabindex="0">'
    +'<div class="slx-spar"></div>'
    +'<div class="slx-fyll" style="width:'+slxPos(a)+'"></div>'
    +'<div class="slx-prick" style="left:'+slxPos(a)+'"></div></div>';
}
function slxSatt(el,v,rita){
  const mn=+el.dataset.min,mx=+el.dataset.max;
  v=Math.max(mn,Math.min(mx,Math.round(v)));
  el.dataset.v=String(v);
  el.setAttribute('aria-valuenow',String(v));
  if(rita!==false){
    const a=(v-mn)/Math.max(1,mx-mn);
    const f=el.querySelector('.slx-fyll'),k=el.querySelector('.slx-prick');
    if(f)f.style.width=slxPos(a);
    if(k)k.style.left=slxPos(a);
  }
  return v;
}
function slxNer(e){
  const k=e.target&&e.target.closest?e.target.closest('.slx-prick'):null;
  if(!k)return;
  const el=k.closest('.slx');if(!el)return;
  _slxDrag={el:el,x0:e.clientX,y0:e.clientY,tagit:false,pid:e.pointerId,start:+el.dataset.v};
  e.preventDefault();
}
function slxRor(e){
  const d=_slxDrag;if(!d)return;
  const dx=e.clientX-d.x0,dy=e.clientY-d.y0;
  if(!d.tagit){
    if(Math.abs(dx)<6&&Math.abs(dy)<6)return;
    if(Math.abs(dy)>Math.abs(dx)){_slxDrag=null;return;}
    d.tagit=true;d.el.classList.add('drar');
    try{d.el.setPointerCapture&&d.el.setPointerCapture(d.pid);}catch(err){}
  }
  const r=d.el.getBoundingClientRect();
  if(!r.width)return;
  const mn=+d.el.dataset.min,mx=+d.el.dataset.max;
  const spann=Math.max(1,r.width-SLX_R*2);
  slxSatt(d.el,mn+((e.clientX-r.left-SLX_R)/spann)*(mx-mn));
  e.preventDefault();
}
function slxUpp(){
  const d=_slxDrag;_slxDrag=null;
  if(!d||!d.tagit)return;
  d.el.classList.remove('drar');
  const v=+d.el.dataset.v;
  if(v===d.start)return;
  const f=window[d.el.dataset.act];
  if(typeof f==='function')f(d.el.dataset.slx,v);
}
function slxTangent(e){
  const el=e.target&&e.target.closest?e.target.closest('.slx'):null;
  if(!el)return;
  const steg=(e.key==='ArrowRight'||e.key==='ArrowUp')?5:((e.key==='ArrowLeft'||e.key==='ArrowDown')?-5:0);
  if(!steg)return;
  const v=slxSatt(el,(+el.dataset.v)+steg);
  const f=window[el.dataset.act];
  if(typeof f==='function')f(el.dataset.slx,v);
  e.preventDefault();
}

/* ---- gardiner ---- */
/* Homeys standardlägen för windowcoverings_state. Markisen rapporterar "up"
   just nu; enum:et är Homeys eget och inte något jag hittat på. */
function rGardLagen(d){
  if(rHar(d,'windowcoverings_state'))
    return [{v:'up',l:'Upp'},{v:'idle',l:'Stopp'},{v:'down',l:'Ner'}];
  return [{v:0,l:'Stängd'},{v:0.33,l:'1/3'},{v:0.67,l:'2/3'},{v:1,l:'Öppen'}];
}
function rGardCap(d){return rHar(d,'windowcoverings_state')?'windowcoverings_state':'windowcoverings_set';}
/* Närmaste läge, inte exakt — en gardin stannar sällan på exakt 0,33. */
function rGardAktivt(d){
  const c=rGardCap(d),v=capOf(d,c);
  if(v==null)return -1;
  const lag=rGardLagen(d);
  if(c==='windowcoverings_state'){
    for(let i=0;i<lag.length;i++)if(lag[i].v===v)return i;
    return -1;
  }
  let bast=0,diff=9;
  lag.forEach((x,i)=>{const dd=Math.abs(x.v-v);if(dd<diff){diff=dd;bast=i;}});
  return diff<=0.12?bast:-1;
}
async function gardLage(id,v){
  const d=DATA[id];if(!d)return;
  try{await rSatt(id,rGardCap(d),v);rumRita();setTimeout(load,1200);}
  catch(e){rumToast('Kunde inte nå Homey');}
}
function rGardText(d){
  const c=rGardCap(d),v=capOf(d,c);
  if(v==null)return '–';
  if(c==='windowcoverings_state'){
    const t={up:'uppe',down:'nere',idle:'stilla'};
    return t[v]||String(v);
  }
  return Math.round(v*100)+' % öppen';
}
function gardRad(d){
  const b=capOf(d,'measure_battery');
  const lag=rGardLagen(d),akt=rGardAktivt(d);
  /* Lägesvärdet är antingen ett tal eller en sträng. Strängen måste citeras i
     onclick-attributet; ett tal får inte citeras, då blir 0.33 en text som
     Homey vägrar ta emot. */
  const arg=x=>(typeof x.v==='string')?("'"+x.v+"'"):String(x.v);
  return '<div class="gd">'
    +'<div class="dv-row gd-h"><span class="dv-ic">'+icon('elevator')+'</span>'
    +'<span class="dv-n">'+esc(rNamn(d))+'<small>'+esc(rGardText(d))
    +(b!=null?(' · '+num(b,0)+' % batt'):'')+'</small></span></div>'
    +'<div class="gd-lagen">'+lag.map((x,i)=>
      '<button class="gd-l'+(i===akt?' on':'')+'" onclick="gardLage(\''+d.id+'\','+arg(x)+')">'
      +esc(x.l)+'</button>').join('')+'</div></div>';
}

/* ---- rumskorten ---- */
function devRad(d){
  const pa=capOf(d,'onoff')===true,dim=rHar(d,'dim')?capOf(d,'dim'):null;
  let h='<div class="dv-row'+(pa?' on':'')+'">'
    +'<span class="dv-ic">'+icon('lightbulb-filament')+'</span>'
    +'<span class="dv-n">'+esc(rNamn(d))
      +(dim!=null?('<small>'+Math.round(dim*100)+' %</small>'):'')+'</span>'
    +'<button class="dv-sw'+(pa?' on':'')+'" onclick="devTanda(\''+d.id+'\')" aria-label="på/av"><i></i></button></div>';
  if(dim!=null&&pa)h+='<div class="dv-dim">'+slxHTML(d.id,dim*100,'devDim')+'</div>';
  return h;
}
function dSec(t){return '<div class="dsec">'+esc(t)+'</div>';}
function rumHTML(){
  const zid=_rumId,lj=rLjusIZon(zid),gard=rGardIZon(zid);
  const pa=lj.filter(d=>capOf(d,'onoff')===true);
  let h='';
  if(lj.length){
    const dimbara=pa.filter(d=>rHar(d,'dim')&&capOf(d,'dim')!=null);
    const medel=dimbara.length?Math.round(dimbara.reduce((s,d)=>s+capOf(d,'dim'),0)/dimbara.length*100):50;
    const nagonPa=pa.length>0;
    h+='<div class="rum-master'+(nagonPa?' on':'')+'">'
      +'<div class="dv-row">'
      +'<span class="dv-ic">'+icon(nagonPa?'lightbulb':'lightbulb-off')+'</span>'
      +'<span class="dv-n">Alla lampor<small>'+pa.length+' av '+lj.length+' tända</small></span>'
      +'<button class="dv-sw'+(nagonPa?' on':'')+'" onclick="zonAlla(\''+zid+'\','+(nagonPa?'false':'true')+')" aria-label="alla på eller av"><i></i></button>'
      +'</div>';
    if(lj.some(d=>rHar(d,'dim'))){
      h+='<div class="sl-h">'+icon('sun-dim')+'Ljusstyrka i rummet<b>'+medel+' %</b></div>'
        +slxHTML(zid,medel,'zonDim');
    }
    h+='</div>';
    h+=dSec('Lampor ('+pa.length+' av '+lj.length+' tända)');
    h+=lj.map(devRad).join('');
  }
  if(gard.length){h+=dSec(gard.length>1?'Gardiner':'Gardin');h+=gard.map(gardRad).join('');}
  return h;
}

function vanLas(){
  if(_van)return _van;
  try{_van=JSON.parse(localStorage.getItem(VAN_KEY)||'null');}catch(e){}
  if(!_van||typeof _van!=='object'||!_van.d)_van={v:1,t:Date.now(),d:{}};
  return _van;
}
/* Talen rundas till tre decimaler i minnet. Fullängds flyttal gjorde posten
   fyra gånger så stor utan att ändra en enda ordning i listan. */
function vanSpara(){try{localStorage.setItem(VAN_KEY,JSON.stringify(_van,
  function(k,v){return (typeof v==='number'&&!isFinite(v))?0:
    ((typeof v==='number'&&Math.floor(v)!==v)?Math.round(v*1000)/1000:v);}));}catch(e){}}
/* Avstånd mellan två klockslag på ett dygn som går runt: 23 och 1 ligger två
   timmar isär, inte tjugotvå. */
function vanAvst(a,b){var d=Math.abs(a-b);return d>12?(24-d):d;}
/* Allt tynar med tiden, annars skulle en vana man lade av med för ett halvår
   sedan väga lika tungt som gårdagens. Räknas sällan — en gång var sjätte
   timme räcker för en halveringstid på en månad. */
function vanFalna(nu){
  var o=vanLas();
  /* KLOCKAN MASTE STARTAS. Forsta versionen skrev dt=nu-(o.t||nu), vilket gav
     noll nar o.t saknades ELLER var 0 - och eftersom o.t bara sattes nar en
     verklig falning skedde kunde ett minne med t=0 aldrig borja falna alls.
     Det gick inte att se pa nagon siffra; vanorna bara vagrade tyna bort. */
  if(!o.t){o.t=nu;return;}
  var dt=nu-o.t;
  if(!(dt>6*36e5))return;
  var f=Math.pow(0.5,dt/VAN_HALV);o.t=nu;
  for(var id in o.d){
    var e=o.d[id],topp=0;
    for(var i=0;i<24;i++){e.pa[i]*=f;e.av[i]*=f;
      if(e.pa[i]>topp)topp=e.pa[i];if(e.av[i]>topp)topp=e.av[i];}
    if(topp<0.05)delete o.d[id];
  }
}
/* Vilka enheter som alls är värda att följa. Gruppmedlemmarna i RUM_DOLJ_DEV
   hoppas över: tänder man Köksbord ändras även kök 1, 2 och 3, och då hade
   fyra rader lärt sig samma vana och popupen fyllts av samma lampa. */
/* ID:T KOMMER UTIFRAN. Forsta versionen kravde d.id och foll darfor tyst pa
   demodatan, dar enheterna ar keyade pa id men inte bar det som ett falt. Det
   ar nyckeln i DATA som ar sanningen om vilken enhet det ar; objektets egna
   falt ar bara vad Homey rakade skicka med. */
function vanFoljs(d,id){
  if(!d)return false;
  id=id||d.id;
  if(id&&RUM_DOLJ_DEV[id])return false;
  if(rArGardin(d))return true;
  if(!rHar(d,'onoff'))return false;
  if(rArLampa(d))return true;
  var k=rKlass(d);
  return k==='socket'||k==='fan';
}
/* Ett enda jämförbart värde per enhet, och vad en ändring till det betyder.
   För en markis är \"ner\" motsvarigheten till tänd. */
function vanLage(d){
  if(rArGardin(d))return capOf(d,rGardCap(d));
  var v=capOf(d,'onoff');return (v===true||v===false)?v:null;
}
function vanRiktning(d,v){
  if(!rArGardin(d))return v===true;
  if(rGardCap(d)==='windowcoverings_state')return v==='down';
  return Number(v)<0.5;
}
function vanNotera(id,pa,nu){
  var o=vanLas();vanFalna(nu);
  var e=o.d[id];
  if(!e){e={pa:[],av:[],n:0,s:0};for(var i=0;i<24;i++){e.pa[i]=0;e.av[i]=0;}o.d[id]=e;}
  var dt=new Date(nu),h=dt.getHours()+dt.getMinutes()/60;
  var arr=pa?e.pa:e.av;
  /* Händelsen smetas ut över närliggande timmar. Utan det hade 21:59 och 22:01
     hamnat i skilda fack och ingen av dem sett ut som en vana. */
  for(var b=0;b<24;b++){
    var w=Math.exp(-Math.pow(vanAvst(b+0.5,h),2)/(2*VAN_SIGMA*VAN_SIGMA));
    if(w>0.02)arr[b]+=w;
  }
  e.n++;e.s=nu;vanSpara();
}
/* Anropas efter varje lyckad hämtning. Första gången bara ställer den upp
   jämförelsen; det finns inget \"förra\" att jämföra med än. */
function vanTick(){
  var nu=Date.now(),ny={};
  for(var id in DATA){var d=DATA[id];if(vanFoljs(d,id))ny[id]=vanLage(d);}
  if(_vanSist&&(nu-_vanSistAt)<VAN_FARSK){
    for(var k in ny){
      var f=_vanSist[k],v=ny[k];
      if(f===undefined||f===null||v===null||f===v)continue;
      var d2=DATA[k];if(!d2)continue;
      try{vanNotera(k,vanRiktning(d2,v),nu);}catch(e){}
    }
  }
  _vanSist=ny;_vanSistAt=nu;
}
function vanPoang(id,nu){
  var e=vanLas().d[id];if(!e||!e.pa)return null;
  var dt=new Date(nu),b=Math.floor(dt.getHours()+dt.getMinutes()/60)%24;
  var pa=e.pa[b]||0,av=e.av[b]||0;
  return {pa:pa,av:av,tot:pa+av,n:e.n||0};
}
/* Listan som visas. Fryses när popupen öppnas — annars kunde raderna byta
   plats under fingret var femtonde sekund. */
function vanBygg(nu){
  nu=nu||Date.now();
  var ut=[],o=vanLas();
  for(var id in o.d){
    var d=DATA[id];if(!d||!vanFoljs(d,id))continue;
    var p=vanPoang(id,nu);if(!p||p.tot<VAN_MIN)continue;
    ut.push({id:id,p:p,lard:true});
  }
  ut.sort(function(a,b){return b.p.tot-a.p.tot;});
  if(ut.length){var basta=ut[0].p.tot;
    ut=ut.filter(function(x){return x.p.tot>=basta*VAN_ANDEL;});}
  ut=ut.slice(0,VAN_MAX);
  /* INNAN DEN HUNNIT LÄRA SIG NÅGOT ska popupen inte vara tom. Då fylls den på
     med det som är tänt just nu — det är nästan alltid det man vill åt. */
  if(ut.length<2){
    var har={};ut.forEach(function(x){har[x.id]=1;});
    var pa=[];
    for(var id2 in DATA){var d2=DATA[id2];
      if(har[id2]||!vanFoljs(d2,id2)||rArGardin(d2))continue;
      if(capOf(d2,'onoff')===true)pa.push({id:id2,d:d2});}
    pa.sort(function(a,b){return rSort(a.d,b.d);});
    for(var i=0;i<pa.length&&ut.length<VAN_MAX;i++)ut.push({id:pa[i].id,p:null,lard:false});
  }
  return ut;
}
function vanText(x){
  var d=DATA[x.id];
  if(!x.lard||!x.p)return 'tänd nu';
  if(rArGardin(d))return 'brukar ändras nu';
  if(x.p.pa>x.p.av*1.6)return 'brukar tändas nu';
  if(x.p.av>x.p.pa*1.6)return 'brukar släckas nu';
  return 'brukar ändras nu';
}
function vanIkon(d,pa){
  if(rArGardin(d))return 'elevator';
  if(rKlass(d)==='light'||rArLampa(d))return pa?'lightbulb':'lightbulb-off';
  return 'plug';
}
/* Raden. Ingen ljusreglering här — popupen är till för att snabbt slå av och
   på; vill man dimra är rumsvyn rätt ställe och den har redan den knappen. */
function vanRad(x){
  var d=DATA[x.id];if(!d)return '';
  if(rArGardin(d))return gardRad(d);
  var pa=capOf(d,'onoff')===true;
  var zon=zoneName(d.zone)||'';
  /* Rummets namn star med: huset har tva enheter som heter "Tak" och en rad
     utan rum gar inte att skilja fran den andra. */
  return '<div class="dv-row'+(pa?' on':'')+'">'
    +'<span class="dv-ic">'+icon(vanIkon(d,pa))+'</span>'
    +'<span class="dv-n">'+esc(rNamn(d))
    +'<small>'+esc((zon?zon+' \u00b7 ':'')+vanText(x))+'</small></span>'
    +'<button class="dv-sw'+(pa?' on':'')+'" onclick="devTanda(\''+x.id+'\')" aria-label="på/av"><i></i></button></div>';
}
function vanInfoTog(){_vanInfo=!_vanInfo;vanorUppdatera();}
/* Två tryck för att glömma. Ett halvårs inlärning ska inte försvinna på en
   felträff. */
function vanGlom(){
  if(Date.now()-_vanGlomArm>4000){_vanGlomArm=Date.now();vanorUppdatera();
    setTimeout(function(){if(Date.now()-_vanGlomArm>=4000)vanorUppdatera();},4200);return;}
  _vanGlomArm=0;_van={v:1,t:Date.now(),d:{}};vanSpara();
  _vanSist=null;_vanSistAt=0;_vanLista=vanBygg();vanorUppdatera();
}
function vanorHTML(){
  var lista=_vanLista||vanBygg(),o=vanLas(),antal=0;
  for(var k in o.d)antal++;
  var lard=lista.filter(function(x){return x.lard;}).length;
  var h='';
  if(!lista.length){
    h+='<div class="isub" style="opacity:.75">Inget att visa än. Listan byggs '
      +'av vad som faktiskt tänds och släcks i huset — låt dashboarden vara '
      +'öppen en tid så fylls den på.</div>';
  }else{
    h+=dSec(lard?'Brukar användas nu':'Tänt just nu');
    h+=lista.map(vanRad).join('');
  }
  h+='<div class="drow drow-t" onclick="vanInfoTog()" style="border-bottom:0">'
    +'<span class="dk">Hur väljs de här? <span class="di-q">i</span></span></div>'
    +'<div class="drow-info'+(_vanInfo?' open':'')+'" id="van-info">'
    +'Varje gång något tänds eller släcks i huset bokförs klockslaget — oavsett '
    +'om det skedde härifrån, från Homey-appen eller från en strömbrytare. '
    +'Listan visar det som brukar hända just den här tiden på dygnet. Vanor som '
    +'upphör tynar bort på ungefär en månad, och minnet ligger i den här '
    +'webbläsaren, så plattan och telefonen lär sig var för sig. '
    +'Följer '+antal+' enhet'+(antal===1?'':'er')+' just nu.'
    +'<div style="margin-top:8px"><button class="gd-l'+(_vanGlomArm?' on':'')
    +'" onclick="vanGlom()">'+(_vanGlomArm?'Säker? Tryck igen':'Glöm allt och börja om')
    +'</button></div></div>';
  return h;
}
function vanorUppdatera(){
  try{if(_popupRebuild===vanorHTML){var b=$('dlg-body');if(b)b.innerHTML=vanorHTML();}}catch(e){}
}
function openVanor(){
  if(_suppressClick){_suppressClick=false;return;}
  _vanLista=vanBygg();_vanGlomArm=0;_vanInfo=false;
  var dl=$('dlg');if(dl&&dl.classList){dl.classList.remove('wide');dl.classList.remove('edit');}
  _popupRebuild=vanorHTML;
  setT('dlg-title','Enheter nu');setIcon('dlg-ic','clock');
  var bd=$('dlg-body');if(bd)bd.innerHTML=vanorHTML();
  var bk=$('dlg-back');if(bk&&bk.classList)bk.classList.add('open');
  dlgTop();
}

function openRum(zid){
  if(_suppressClick){_suppressClick=false;return;}
  _rumId=zid;
  const dlgn=$('dlg');if(dlgn&&dlgn.classList){dlgn.classList.remove('wide');dlgn.classList.remove('edit');}
  _popupRebuild=rumHTML;
  const n=zoneName(zid)||'Rum';
  setT('dlg-title',n);setIcon('dlg-ic',rumIkon(n));
  const bd=$('dlg-body');if(bd)bd.innerHTML=rumHTML();
  const bk=$('dlg-back');if(bk&&bk.classList)bk.classList.add('open');
  dlgTop();
}
/* Står rumspopupen öppen ska den följa med när värdena ändras — men bara den.
   _popupRebuild pekar på rumHTML enbart medan rutan är öppen; closeDetail
   nollställer den. */
function rumPopupUppdatera(){
  try{if(_popupRebuild===rumHTML){const b=$('dlg-body');if(b)b.innerHTML=rumHTML();}
    else if(_popupRebuild&&_popupRebuild._zk){const b=$('dlg-body');if(b)b.innerHTML=_popupRebuild();}}catch(e){}
}
/* Väggplattan känns igen på IS_SAMSUNG_TABLET (Samsung, plattläge, fysisk
   plattskärm). Plattramen på telefonen (v737, ?ram=1 i en iframe) ska se ut som
   väggplattan och räknas därför likadant. */
function arVaggplattaVy(){
  if(IS_SAMSUNG_TABLET)return true;
  try{return window.self!==window.top&&/[?&]ram=1(&|$)/.test(location.search||'');}catch(e){return false;}}
function rumAvsnittPa(){return !arVaggplattaVy();}
function rumVisaMer(){_rumUtfallt=!_rumUtfallt;renderRooms();}
function renderRooms(){
  const el=$('rooms'),sec=$('rooms-sec'),mer=$('rooms-mer');
  if(!el||!sec)return;
  /* v745: överallt UTOM på väggplattan (och i plattläget på telefonen, som
     visar väggplattan). Förut bara i mobilläget – en surfplatta i soffan fick
     aldrig rummen. */
  if(!rumAvsnittPa()){sec.hidden=true;el.innerHTML='';if(mer)mer.innerHTML='';return;}
  const zs=rumsZoner();
  sec.hidden=!zs.length;
  el.innerHTML=zs.map(z=>{
    const lj=rLjusIZon(z.id),gard=rGardIZon(z.id);
    const pa=lj.filter(d=>capOf(d,'onoff')===true);
    const dimbara=pa.filter(d=>rHar(d,'dim')&&capOf(d,'dim')!=null);
    const medel=dimbara.length?dimbara.reduce((s,d)=>s+capOf(d,'dim'),0)/dimbara.length:null;
    const t=rDevsIZon(z.id).map(d=>capOf(d,'measure_temperature')).filter(v=>v!=null&&isFinite(v));
    const ror=rDevsIZon(z.id).some(d=>capOf(d,'alarm_motion')===true);
    const meta=[];
    if(lj.length)meta.push('<b>'+pa.length+'</b>/'+lj.length+' tända');
    if(gard.length)meta.push('<b>'+gard.length+'</b> gardin'+(gard.length>1?'er':''));
    if(t.length)meta.push('<b>'+num(t[0],1)+'°</b>');
    if(ror)meta.push('<span style="color:var(--warm)">rörelse</span>');
    /* Korten bortom de fyra ritas alltid, men döljs med CSS. Att rita om hela
       listan vid varje utfällning skulle tappa rullningsläget i sidan. */
    const dold=(!_rumUtfallt&&zs.indexOf(z)>=RUM_SYNLIGA);
    return '<div class="room'+(pa.length?' on':'')+(dold?' rum-dold':'')+'" onclick="openRum(\''+z.id+'\')">'
      +'<div class="room-h"><span class="room-ic">'+icon(rumIkon(z.name))+'</span>'
      +'<span class="room-n">'+esc(z.name)+'</span>'
      +(lj.length?('<button class="room-sw'+(pa.length?' on':'')+'" onclick="event.stopPropagation();zonTanda(\''+z.id+'\')" aria-label="tänd eller släck"><i></i></button>'):'')
      +'</div>'
      +'<div class="room-m">'+meta.join('')+'</div>'
      +'<div class="room-bar"><i style="width:'+Math.round((medel==null?0:medel)*100)+'%"></i></div>'
      +'</div>';}).join('');
  if(mer){
    const kvar=zs.length-RUM_SYNLIGA;
    mer.innerHTML=(kvar>0)
      ? ('<button class="rum-mer" onclick="rumVisaMer()" aria-expanded="'+(_rumUtfallt?'true':'false')+'">'
         +(_rumUtfallt?(icon('arrow-fat-up')+'Visa färre')
                      :(icon('arrow-fat-up','flip')+'Visa '+kvar+' rum till'))+'</button>')
      : '';
  }
  rumPopupUppdatera();
}
/* Ett namn för både korten och den öppna popupen, så att varje skrivning bara
   behöver anropa ett. */
function rumRita(){renderRooms();try{vanorUppdatera();}catch(e){}
  /* v740: renderRooms ritar inga rum på plattan och kom därför aldrig till
     rumPopupUppdatera – en rumsrutas popup (Uterum, Snickarboa, Poolrum) visade
     den gamla knappen tills nästa hämtning. */
  if(!rumAvsnittPa()){try{rumPopupUppdatera();}catch(e){}}}
async function tvVol(id,upp){
  const c=upp?'volume_up':'volume_down';
  const d=DATA[id];
  if(!d||!rHar(d,c)){rumToast('TV:n har ingen volymknapp');return;}
  try{await homeyPut(id,c,true);}catch(e){rumToast('Kunde inte nå Homey');}
}
async function tvMute(id){
  const d=DATA[id];if(!d||!rHar(d,'volume_mute'))return;
  const ny=!(capOf(d,'volume_mute')===true);
  try{await rSatt(id,'volume_mute',ny);tvPopOm();setTimeout(load,900);}
  catch(e){rumToast('Kunde inte nå Homey');}
}
async function tvAv(id){
  const d=DATA[id];if(!d)return;
  try{await rSatt(id,'onoff',false);tvPopOm();setTimeout(load,900);}
  catch(e){rumToast('Kunde inte nå Homey');}
}
function gtvFinns(){return !!DATA[GTV_DEV];}
function gtvPa(){return capOf(DATA[GTV_DEV],'onoff')===true;}
async function gtvKey(k){
  if(!DATA[GTV_DEV]||!rHar(DATA[GTV_DEV],k)){rumToast('Google TV svarar inte');return;}
  try{await homeyPut(GTV_DEV,k,true);}catch(e){rumToast('Kunde inte nå Homey');}
}
async function gtvApp(vilken){
  var f=GTV_FLOW[vilken];
  if(!f)return;
  try{await homeyTriggerFlow('standard',f);rumToast('Öppnar…');}
  catch(e){rumToast('Kunde inte nå Homey');}
}
function gtvNuApp(){
  var a=capOf(DATA[GTV_DEV],'current_application');
  if(!a)return '';
  var s=String(a);
  if(/launcher/i.test(s))return '';
  return GTV_APPNAMN[s]||s;
}
function gtvKn(k,inne,titel,kl){
  return '<button class="gtv-k'+(kl?(' '+kl):'')+'" onclick="gtvKey(\''+k+'\')" '
    +'aria-label="'+esc(titel)+'" title="'+esc(titel)+'">'+inne+'</button>';
}
function gtvHTML(){
  if(!gtvFinns())return dRow('Google TV','enheten hittades inte');
  var app=gtvNuApp();
  var h='';
  /* KORSET. Bakat och hem sitter i de ovre hornen som runda knappar, sa att
     formen skiljer dem fran riktningarna - de gor nagot annat och ska kannas
     annorlunda under tummen. Mitten ar OK. */
  h+=dSec('Fjärrkontroll');
  /* ALLA FYRA RIKTNINGAR SAMMA SYMBOL. Forut var upp och ner feta pilar medan
     vanster och hoger var tunna - korset sag skevt ut fast rutnatet var jamnt.
     Hoger var dessutom en roterad vansterpil, vilket gjorde streckandarna
     spegelvanda. Nu ar det fyra egna banor med samma streckvikt. */
  h+='<div class="gtv-pad">'
    +gtvKn('key_back',icon('arrow-left'),'Bakåt','rund')
    +gtvKn('key_cursor_up',icon('caret-up'),'Upp')
    +gtvKn('key_home',icon('house'),'Hem','rund')
    +gtvKn('key_cursor_left',icon('caret-left'),'Vänster')
    +gtvKn('key_confirm','OK','OK','ok')
    +gtvKn('key_cursor_right',icon('caret-right'),'Höger')
    +'<span></span>'
    +gtvKn('key_cursor_down',icon('caret-down'),'Ner')
    +'<span></span>'
    +'</div>';
  h+=dSec('Uppspelning');
  h+='<div class="gtv-rad">'
    +gtvKn('key_previous',icon('skip-back'),'Föregående')
    +gtvKn('key_play',icon('play-tri')+'<span>Spela</span>','Spela','txt')
    +gtvKn('key_pause',icon('pause-bars')+'<span>Paus</span>','Paus','txt')
    +gtvKn('key_next',icon('skip-fwd'),'Nästa')
    +'</div>';
  /* VOLYM OCH PA/AV GAR TILL TV:N, inte till Google TV. Google TV har visserligen
     volume_up och volume_down som capabilities, men de styr strommingsboxens
     egen volym - inte hogtalarna. Ljudet sitter i TV:n, och det var darfor
     knapparna inte gjorde nagot horbart. */
  var tvD=DATA[TV_DEV];
  h+=dSec('TV');
  h+='<div class="gtv-rad">'
    +'<button class="gtv-k" onclick="tvVol(\''+TV_DEV+'\',false)" title="Sänk volymen">−</button>'
    +'<button class="gtv-k" onclick="tvMute(\''+TV_DEV+'\')" title="Tysta">'
      +icon((tvD&&capOf(tvD,'volume_mute')===true)?'speaker-none':'speaker-high')+'</button>'
    +'<button class="gtv-k" onclick="tvVol(\''+TV_DEV+'\',true)" title="Höj volymen">+</button>'
    +'<button class="gtv-k" onclick="tvAv(\''+TV_DEV+'\')" title="Stäng av TV:n">'+icon('power')+'</button>'
    +'</div>';
  /* Reglaget ar rumsvyns eget: samma grepp, samma skrivning, och det tander
     lampan om den ar slackt precis som dar. */
  var amb=DATA[AMBI_DEV];
  if(amb&&rHar(amb,'dim')){
    var dv=capOf(amb,'dim');
    h+=dSec('Ambilight');
    h+='<div class="sl-h">'+icon('sun-dim')+esc(rNamn(amb))
      +'<b>'+(dv==null?'–':Math.round(dv*100)+' %')+'</b></div>'
      +slxHTML(AMBI_DEV,(dv==null?50:dv*100),'devDim');
  }
  h+=dSec('Appar'+(app?' · nu: '+esc(app):''));
  h+='<div class="gtv-rad">'
    +'<button class="gtv-a" onclick="gtvApp(\'netflix\')">Netflix</button>'
    +'<button class="gtv-a" onclick="gtvApp(\'youtube\')">YouTube</button>'
    +'<button class="gtv-a" onclick="gtvApp(\'favorit\')">Favorit</button>'
    +'</div>';
  return h;
}
/* v713: TV-popupen öppnas från TV-rutan (openDetail('tv')). Står den öppen
   ritas den om när mute eller av ändrats, så knappen svarar direkt. */
function tvPopOm(){try{if(_dlgWhich==='tv'){var b=$('dlg-body');if(b)b.innerHTML=gtvHTML();}}catch(e){}}
