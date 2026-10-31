/* js/huset.js — Huset ovanifrån: toppen av startsidan i index2.html (beta).
 *
 * Bilden av huset med fält för Elnät, Förbrukning, Sol, Batteri och – när en
 * bil laddar – bilen, och vinkelräta ledningar där prickarna rör sig åt det håll
 * strömmen går. Geometrin (HUS_FALT, HUS_LEDN) står i start.js under [huset.js].
 *
 * Filen innehåller BARA funktionsdeklarationer. Allt ritas av husRita(), som
 * render() anropar; finns ingen #huspanel på sidan (index.html) gör den ingenting.
 */

/* Värdena just nu, i W. Tecken: nat + = köper, batt + = laddar ur, bil + = laddar. */
function husVarden(){
  var sol=cap(DEV.solar,'measure_power');
  if(sol==null)sol=cap(DEV.consume,'measure_power.solar');
  var nat=cap(DEV.pulse,'measure_power');
  var last=houseNowW();
  /* Batteriet: Modbus-registren (laddning − urladdning) i första hand, som
     resten av dashboarden; annars husbatteriets effekt och läge. */
  var batt=null,bn=null;
  try{bn=battNettoW();}catch(e){}
  if(bn!=null&&isFinite(bn))batt=-bn;
  else{
    var bw=cap(DEV.battery,'measure_power'),bs=cap(DEV.battery,'battery_charging_state');
    if(bw!=null)batt=(bs==='charging')?-Math.abs(bw):(bs==='discharging'?Math.abs(bw):0);
  }
  var soc=cap(DEV.battery,'measure_battery');
  var bil=0;
  try{if(bilDrar())bil=chargerW()||0;}catch(e){}
  /* Vilken bil som laddar: den som säger det själv, annars EX40 som står vid laddboxen. */
  var bilId=DEV.car2;
  try{if(carCharging(DEV.car)&&!carCharging(DEV.car2))bilId=DEV.car;}catch(e){}
  return {sol:sol,nat:nat,last:last,batt:batt,soc:soc,bil:bil,
    bilNamn:(DATA[bilId]&&DATA[bilId].name)||'Bilen',bilSoc:cap(bilId,'measure_battery')};
}

/* "2,6" + "kW", eller "850" + "W" under en kilowatt. */
function husTal(w){
  if(w==null||!isFinite(w))return ['–',''];
  var a=Math.abs(w);
  if(a<1000)return [String(Math.round(a)),'W'];
  return [(Math.round(a/100)/10).toFixed(1).replace('.',','),'kW'];
}
function husBredd(w){var kw=Math.abs(w||0)/1000;return Math.max(5,Math.min(14,5+kw*1.4));}

/* Bygger bilden, ledningarna och fälten en gång; husRita fyller dem sedan. */
function husBygg(el){
  if(el._byggd)return;
  var NS='http://www.w3.org/2000/svg';
  var h='<div class="hus-karta" id="hus-karta">'
    /* Två bilder: dag i ljust tema, kväll/natt i mörkt (CSS väljer efter data-theme). */
    +'<img class="hus-natt" src="bild/hus-ovanifran-natt.webp" alt="Huset ovanifrån">'
    +'<img class="hus-dag" src="bild/hus-ovanifran.webp" alt="">'
    +'<svg viewBox="0 0 1040 1120" aria-hidden="true" id="hus-svg"></svg></div>';
  el.innerHTML=h;
  var svg=$('hus-svg'),karta=$('hus-karta');
  husLjusBygg(el,svg,NS);
  el._ledn={};
  HUS_LEDN.forEach(function(l){
    var bas=document.createElementNS(NS,'path');bas.setAttribute('d',l.d);bas.setAttribute('class','hus-bas');
    bas.style.stroke=HUS_FARG[l.typ];
    var fl=document.createElementNS(NS,'path');fl.setAttribute('d',l.d);fl.setAttribute('class','hus-flod');
    svg.appendChild(bas);svg.appendChild(fl);el._ledn[l.id]={bas:bas,fl:fl};
  });
  el._falt={};
  Object.keys(HUS_FALT).forEach(function(k){
    var f=HUS_FALT[k],b=document.createElement('button');
    b.type='button';b.className='hus-falt';b.style.setProperty('--f',HUS_FARG[f.typ]);
    b.style.left=(f.x/1040*100)+'%';b.style.top=(f.y/1120*100)+'%';
    b.style.width=(f.w/1040*100)+'%';b.style.height=(f.h/1120*100)+'%';
    b.setAttribute('onclick',"openDetail('"+f.pop+"')");
    karta.appendChild(b);el._falt[k]=b;
  });
  el._byggd=true;
}
/* Ljuset i nattbilden: varmt sken från fönstren och utelamporna. Ligger under
   ledningarna. CSS visar det bara i mörkt tema. */
function husLjusBygg(el,svg,NS){
  function ny(t,a){var e=document.createElementNS(NS,t);for(var k in a)e.setAttribute(k,a[k]);return e;}
  var defs=ny('defs',{});
  [['hus-g-f','#ffb54d'],['hus-g-u','#ffefc4']].forEach(function(g){
    var r=ny('radialGradient',{id:g[0]});
    r.appendChild(ny('stop',{offset:'0','stop-color':g[1],'stop-opacity':'1'}));
    r.appendChild(ny('stop',{offset:'.3','stop-color':g[1],'stop-opacity':'.6'}));
    r.appendChild(ny('stop',{offset:'1','stop-color':g[1],'stop-opacity':'0'}));
    defs.appendChild(r);});
  svg.appendChild(defs);
  var lj=ny('g',{'class':'hus-ljus'});
  var ute=ny('g',{'class':'hus-ute'});
  HUS_UTE.forEach(function(p){
    ute.appendChild(ny('circle',{cx:p[0],cy:p[1],r:36,fill:'url(#hus-g-u)'}));
    ute.appendChild(ny('circle',{cx:p[0],cy:p[1],r:4,fill:'#fffaf0'}));});
  lj.appendChild(ute);
  el._fonster=HUS_FONSTER.map(function(f){
    var g=ny('g',{'class':'hus-fonster'});
    f.p.forEach(function(p){
      g.appendChild(ny('circle',{cx:p[0],cy:p[1],r:62,fill:'url(#hus-g-f)'}));
      g.appendChild(ny('circle',{cx:p[0],cy:p[1],r:6,fill:'#ffe9bf'}));});
    lj.appendChild(g);return {zon:f.zon,g:g};});
  svg.appendChild(lj);
}
/* Starkaste tända lampan i zonen, 0–1, eller null om ingen lyser. */
function husZonLjus(zid){
  var max=null;
  Object.keys(DATA).forEach(function(id){
    var d=DATA[id];if(!d||d.zone!==zid||HUS_EJ_FONSTER[id])return;
    if(!d.id)d=Object.assign({id:id},d);
    var pa=false;try{pa=rArLampa(d)&&cap(id,'onoff')===true;}catch(e){}
    if(!pa)return;
    var dm=cap(id,'dim');dm=(dm==null||!isFinite(dm))?1:dm;
    max=Math.max(max==null?0:max,dm);});
  return max;
}
function husLjusRita(el){
  (el._fonster||[]).forEach(function(f){
    var l=husZonLjus(f.zon);
    f.g.classList.toggle('pa',l!=null);
    /* Även en svagt dimmad lampa ska synas: 0,55 i botten. */
    f.g.style.opacity=l==null?'':String(0.55+0.45*l);});
}
function husFyll(b,rub,w,under){
  var t=husTal(w);
  b.innerHTML='<span class="rub"><i></i>'+esc(rub)+'</span><span class="v">'+t[0]+'<small> '+t[1]+'</small></span>'
    +(under?'<span class="u">'+esc(under)+'</span>':'');
  b.classList.toggle('noll',!(w!=null&&Math.abs(w)>=50));
}
function husRita(){
  var el=$('huspanel');if(!el)return;
  husBygg(el);
  try{husLjusRita(el);}catch(e){}
  var v=husVarden();
  /* Solen per panelyta, i proportion till antalet paneler – det finns bara en
     mätare för hela anläggningen. Kedjan bär summan av ytorna före. */
  var s=Math.max(0,v.sol||0),p=HUS_SOL_ANDEL;
  var varden={sol1:s*p.D,sol2:s*(p.D+p.C),sol3:s*p.A,sol4:s,
    nat:v.nat||0,last:v.last||0,batt:v.batt||0};
  HUS_LEDN.forEach(function(l){
    var w=varden[l.id]||0,r=el._ledn[l.id],tom=Math.abs(w)<50,b=husBredd(w);
    r.bas.style.strokeWidth=tom?2.5:b;r.bas.style.opacity=tom?0.25:0.85;
    r.fl.style.strokeWidth=Math.max(2.5,b*0.55);
    r.fl.setAttribute('class','hus-flod'+(tom?' av':'')+(w<0?' bak':''));
    r.fl.style.animationDuration=(tom?0:Math.max(0.45,1.5-Math.abs(w)/1000*0.12))+'s';
  });
  var nat=v.nat,last=v.last;
  /* Andelen eget räknas som "självförsörjt" i energipanelen (renderEnergy):
     sol och batteri mot det som går in i huset, solen högst vad panelerna ger. */
  var natIn=Math.max(0,nat||0),battIn=Math.max(0,v.batt||0);
  var solIn=Math.max(0,Math.min(s,(last||0)-natIn-battIn)),T=natIn+battIn+solIn;
  var eget=(last==null)?null:Math.round((T>0&&last>0?(solIn+battIn)/T:(nat!=null&&nat<0?1:0))*100);
  husFyll(el._falt.nat,'Elnät',nat,nat==null?'':(nat>50?'köper':nat<-50?'säljer':'–'));
  husFyll(el._falt.last,'Förbrukning',last,eget==null?'':(eget+' % eget'));
  husFyll(el._falt.sol,'Sol',v.sol,'');
  /* Laddningen i rubriken, riktningen under – "46 % · laddar ur" fick inte plats. */
  husFyll(el._falt.batt,'Batteri'+(v.soc==null?'':' '+Math.round(v.soc)+' %'),v.batt,
    v.batt==null?'':(v.batt>50?'laddar ur':v.batt<-50?'laddar':'vilar'));
  var laddar=v.bil>=50;
  husFyll(el._falt.bil,'Laddar',v.bil,v.bilNamn+(v.bilSoc!=null?' '+Math.round(v.bilSoc)+' %':''));
  el._falt.bil.hidden=!laddar;
}
