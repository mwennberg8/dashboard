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
  /* Efter det som redan står i panelen (index2: raden #hus-topp överst). En
     halvbyggd karta från ett avbrutet försök tas bort först. */
  var gammal=el.querySelector('.hus-karta');if(gammal)el.removeChild(gammal);
  el.insertAdjacentHTML('beforeend',h);
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
  function radial(id,farg,stops){var r=ny('radialGradient',{id:id});
    stops.forEach(function(st){r.appendChild(ny('stop',{offset:st[0],'stop-color':farg,'stop-opacity':st[1]}));});
    defs.appendChild(r);}
  radial('hus-g-u','#ffd48a',[['0','1'],['.3','.6'],['1','0']]);      /* utelamporna – varmt, som glödlampor */
  radial('hus-g-r','#ffbe63',[['0','.6'],['.45','.32'],['1','0']]);   /* glastaken */
  /* Fönsterskenet: starkast vid fönstret, tonar ut. Ritas i fönstrets egna
     koordinater (ut = +x), så samma gradient fungerar åt alla håll. */
  var lg=ny('linearGradient',{id:'hus-g-f',x1:'0',y1:'0',x2:'1',y2:'0'});
  [['0','.85'],['.35','.42'],['1','0']].forEach(function(st){
    lg.appendChild(ny('stop',{offset:st[0],'stop-color':'#ffb54d','stop-opacity':st[1]}));});
  defs.appendChild(lg);
  var fl=ny('filter',{id:'hus-mjuk',x:'-30%',y:'-30%',width:'160%',height:'160%'});
  fl.appendChild(ny('feGaussianBlur',{stdDeviation:'7'}));
  defs.appendChild(fl);
  svg.appendChild(defs);
  var lj=ny('g',{'class':'hus-ljus'});
  var ute=ny('g',{'class':'hus-ute'});
  /* Väggens sken: ett halvt sken ut från väggen, ritat i lampans egna
     koordinater (ut = +x) med en gradient kring origo. */
  var gv=ny('radialGradient',{id:'hus-g-v',gradientUnits:'userSpaceOnUse',cx:'0',cy:'0',r:'46'});
  [['0','1'],['.3','.6'],['1','0']].forEach(function(st){
    gv.appendChild(ny('stop',{offset:st[0],'stop-color':'#ffd48a','stop-opacity':st[1]}));});
  defs.appendChild(gv);
  HUS_UTE.forEach(function(p){
    if(p.length>2&&p[2]!=null){
      var vg=ny('g',{transform:'translate('+p[0]+','+p[1]+') rotate('+p[2]+')'});
      /* En sektor kring riktningen: 180° på en vägg, 270° på ett hörn. */
      var sp=Math.max(30,Math.min(359,p[3]||180)),R=46;
      function sektor(a0,a1){var r0=a0*Math.PI/180,r1=a1*Math.PI/180;
        return 'M0,0 L'+(R*Math.cos(r0)).toFixed(1)+','+(R*Math.sin(r0)).toFixed(1)
          +' A'+R+','+R+' 0 '+((a1-a0)>180?1:0)+' 1 '+(R*Math.cos(r1)).toFixed(1)+','+(R*Math.sin(r1)).toFixed(1)+' Z';}
      vg.appendChild(ny('path',{d:sektor(-sp/2,sp/2),fill:'url(#hus-g-v)'}));
      /* Nära ett hörn (femte värdet ±1): ljuset fortsätter mjukt runt hörnet
         på den sidan, i smala kilar som tonar ut över 90°. */
      var hs=p[4]===1||p[4]===-1?p[4]:0;
      if(hs){var mj=ny('g',{filter:'url(#hus-mjuk)'});
        [.78,.58,.42,.28,.17,.08].forEach(function(o,k){
          var a0=sp/2+k*15,a1=a0+15.5;
          mj.appendChild(ny('path',{d:hs>0?sektor(a0,a1):sektor(-a1,-a0),fill:'url(#hus-g-v)',opacity:o}));});
        vg.appendChild(mj);}
      vg.appendChild(ny('circle',{cx:1.5,cy:0,r:4,fill:'#ffe6b0'}));
      ute.appendChild(vg);return;}
    ute.appendChild(ny('circle',{cx:p[0],cy:p[1],r:36,fill:'url(#hus-g-u)'}));
    ute.appendChild(ny('circle',{cx:p[0],cy:p[1],r:4,fill:'#ffe6b0'}));});
  lj.appendChild(ute);
  /* Glastaken först, så att fönstrens sken ligger ovanpå. */
  var kallor=HUS_GLASTAK.map(function(t){
    var g=ny('g',{'class':'hus-fonster'});
    g.appendChild(ny('ellipse',{cx:t.sken[0],cy:t.sken[1],rx:t.sken[2],ry:t.sken[3],fill:'url(#hus-g-r)','data-rx':t.sken[2],'data-ry':t.sken[3]}));
    t.tak.forEach(function(r){
      g.appendChild(ny('rect',{x:r[0],y:r[1],width:r[2],height:r[3],rx:3,fill:'#ffd08a','class':'hus-glastak'}));});
    lj.appendChild(g);return {kalla:HUS_RUM[t.rum]||{},g:g};});
  /* Fönstren: skenet är en kägla som vidgar sig ut från fönstret; längden
     följer dimningen (data-l skalas i husLjusRita). Rutan i väggen är fast.
     Fönster som följer hela rummet delar en grupp; fönster med egna lampor
     (femte värdet) får en grupp per lampval. */
  function fonster(g,p){
    var w=p[3]||28,h=w/2,L=80,S=34;
    var fg=ny('g',{transform:'translate('+p[0]+','+p[1]+') rotate('+p[2]+')'});
    var sk=ny('g',{'data-l':'1'});
    sk.appendChild(ny('polygon',{points:'0,'+(-h)+' 0,'+h+' '+L+','+(h+S)+' '+L+','+(-h-S),
      fill:'url(#hus-g-f)',filter:'url(#hus-mjuk)'}));
    fg.appendChild(sk);
    fg.appendChild(ny('rect',{x:-2.5,y:-h,width:5,height:w,rx:1.5,fill:'#ffe6b3'}));
    g.appendChild(fg);
  }
  HUS_FONSTER.forEach(function(f){
    var grupper={};
    f.p.forEach(function(p){
      var egna=(p[4]&&p[4].length)?p[4]:null,nyckel=egna?egna.join('|'):'';
      if(!grupper[nyckel]){
        var g=ny('g',{'class':'hus-fonster'});lj.appendChild(g);
        var kalla=egna?{ids:egna.map(function(n){return HUS_LAMPOR[n];}).filter(Boolean)}:(HUS_RUM[f.rum]||{});
        grupper[nyckel]=g;kallor.push({kalla:kalla,g:g});}
      fonster(grupper[nyckel],p);});
  });
  el._fonster=kallor;
  svg.appendChild(lj);
}
/* Ljuset från en källa, 0–1, eller null om ingen lampa lyser: den starkast
   dimmade tända lampan. En lampa utan dimning (fönsterlamporna) räknas som
   full. Alla lampor som faktiskt lyser räknas, även de som är dolda i
   rumsvyn (t.ex. Föröver och Styrbord i uterummet).
   k.zon = lamporna i zonen (utom k.utan), k.bara = en enda lampa,
   k.ids = just de här lamporna (fönster med egna lampor). */
function husKallaLjus(k){
  var max=null;
  Object.keys(DATA).forEach(function(id){
    var d=DATA[id];if(!d)return;
    /* Uttryckligen valda lampor: precis de, oavsett typ. */
    if(k.ids){if(k.ids.indexOf(id)<0||cap(id,'onoff')!==true)return;
      var di=cap(id,'dim');di=(di==null||!isFinite(di))?1:Math.max(0,Math.min(1,di));
      max=Math.max(max==null?0:max,di);return;}
    if(HUS_EJ_FONSTER[id])return;
    if(k.bara){if(id!==k.bara)return;}
    else if(!k.zon||d.zone!==k.zon||id===k.utan)return;
    if(!d.capabilitiesObj||!d.capabilitiesObj.onoff)return;
    var lampa=!!(RUM_LAMPA[id]||/fönster/i.test(rNamn(d))||rKlass(d)==='light');
    if(!lampa||cap(id,'onoff')!==true)return;
    var dm=cap(id,'dim');dm=(dm==null||!isFinite(dm))?1:Math.max(0,Math.min(1,dm));
    max=Math.max(max==null?0:max,dm);});
  return max;
}
/* Mängden ljus följer dimningen: både hur starkt och hur långt skenet når.
   En lampa på lägsta dimning ger ett svagt men synligt sken. */
function husLjusRita(el){
  (el._fonster||[]).forEach(function(f){
    var l=husKallaLjus(f.kalla),pa=l!=null,k=pa?0.4+0.6*l:1;
    f.g.classList.toggle('pa',pa);
    f.g.style.opacity=pa?String(0.25+0.75*l):'';
    Array.prototype.forEach.call(f.g.querySelectorAll('[data-l]'),function(c){
      c.setAttribute('transform','scale('+k.toFixed(3)+',1)');});
    Array.prototype.forEach.call(f.g.querySelectorAll('[data-rx]'),function(c){
      c.setAttribute('rx',(+c.getAttribute('data-rx')*k).toFixed(1));
      c.setAttribute('ry',(+c.getAttribute('data-ry')*k).toFixed(1));});});
}
function husFyll(b,rub,w,under){
  var t=husTal(w);
  b.innerHTML='<span class="rub"><i></i>'+esc(rub)+'</span><span class="v">'+t[0]+'<small> '+t[1]+'</small></span>'
    +(under?'<span class="u">'+esc(under)+'</span>':'');
  b.classList.toggle('noll',!(w!=null&&Math.abs(w)>=50));
}
function husRita(){
  var el=$('huspanel');if(!el)return;
  /* render() kan köras innan start.js hunnit till [huset.js]; då väntar vi. */
  if(typeof HUS_LEDN==='undefined'||!HUS_LEDN||typeof HUS_FONSTER==='undefined'||!HUS_FONSTER)return;
  husBygg(el);
  try{husLjusRita(el);}catch(e){}
  var v=husVarden();
  /* Solen per panelyta, i proportion till antalet paneler – det finns bara en
     mätare för hela anläggningen. Kedjan bär summan av ytorna före:
     höger tak (A) → övre mitten (B) → nedre mitten (C) → vänster tak (D) → fältet. */
  var s=Math.max(0,v.sol||0),p=HUS_SOL_ANDEL;
  var varden={sol3:s*p.A,sol2:s*(p.A+p.B),sol1:s*(p.A+p.B+p.C),sol4:s,
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
