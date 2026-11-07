/* js/huset.js — Huset ovanifrån: toppen av startsidan (index.html).
 *
 * Bilden av huset med fält för Elnät, Förbrukning, Sol, Batteri och – när en
 * bil laddar – bilen, och vinkelräta ledningar där prickarna rör sig åt det håll
 * strömmen går. Geometrin (HUS_FALT, HUS_LEDN) står i start.js under [huset.js].
 *
 * Filen innehåller BARA funktionsdeklarationer. Allt ritas av husRita(), som
 * render() anropar; finns ingen #huspanel på sidan (index-backup.html) gör den ingenting.
 */

/* Värdena just nu, i W. Tecken: nat + = köper, batt + = laddar ur, bil + = laddar. */
function husVarden(){
  var sol=cap(DEV.solar,'measure_power');
  if(sol==null)sol=cap(DEV.consume,'measure_power.solar');
  var nat=cap(DEV.pulse,'measure_power');
  var last=houseNowW();
  /* Batteriet: samma källa som resten av dashboarden (battVal i grund.js –
     Husbatteri, eller Modbus när Husbatteri hängt sig). Förut lästes Modbus
     direkt här, och när Modbus slutade uppdateras stod effekten och ledningen
     still medan laddnivån (som redan gick via valet) rörde sig.
     energy_power har tecken: + = laddar. Här gäller + = laddar ur. */
  var batt=null,en=null;
  try{en=cap(DEV.battery,'energy_power');}catch(e){}
  if(en!=null&&isFinite(en))batt=-en;
  else{
    var bw=cap(DEV.battery,'measure_power'),bs=cap(DEV.battery,'battery_charging_state');
    if(bw!=null)batt=(bs==='charging')?-Math.abs(bw):(bs==='discharging'?Math.abs(bw):0);
  }
  var soc=cap(DEV.battery,'measure_battery');
  var bil=0;
  try{if(bilDrar())bil=chargerW()||0;}catch(e){}
  /* Vilken bil: den som laddar, annars den som är inkopplad, annars EX40.
     Inkopplad räcker för att bilrutan ska synas – även innan laddningen
     börjat. Laddboxen själv kan också säga att en kabel sitter i. */
  var bilar=[DEV.car2,DEV.car],bilId=DEV.car2,inkopplad=false;
  try{
    bilId=bilar.filter(function(id){return carCharging(id);})[0]||bilar.filter(function(id){return carPlugged(id);})[0]||DEV.car2;
    inkopplad=bilar.some(function(id){return carPlugged(id);});
    var lb=String(cap(DEV.laddbox,'evcharger_charging_state')||'').toLowerCase();
    if(lb.indexOf('plugged_in')>=0||lb.indexOf('connected')>=0)inkopplad=true;
  }catch(e){}
  return {sol:sol,nat:nat,last:last,batt:batt,soc:soc,bil:bil,inkopplad:inkopplad,
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
    /* Två bilder: dag i ljust tema, kväll/natt i mörkt (CSS väljer efter
       data-theme). Årstiden (och snön) avgör vilket par – husRita byter. */
    +'<img class="hus-natt" id="hus-img-natt" src="bild/hus-'+husBildNamn()+'-natt.webp" alt="Huset ovanifrån">'
    +'<img class="hus-dag" id="hus-img-dag" src="bild/hus-'+husBildNamn()+'.webp" alt="">'
    +'<svg viewBox="0 0 1040 1120" class="hus-ytor" id="hus-ytor"></svg>'
    +'<svg viewBox="0 0 1040 1120" aria-hidden="true" id="hus-svg"></svg>'
    /* v856: ledningarna i ett eget lager ovanpå. Flödet ritas om i varje
       bildruta; i samma SVG som ljuset (maskar, oskärpa, blandning) ritades då
       hela ljuset om också. Uppmätt ~40 % mindre ritarbete. */
    +'<svg viewBox="0 0 1040 1120" aria-hidden="true" id="hus-ledn-svg"></svg></div>';
  /* Efter det som redan står i panelen (raden #hus-topp överst). En
     halvbyggd karta från ett avbrutet försök tas bort först. */
  var gammal=el.querySelector('.hus-karta');if(gammal)el.removeChild(gammal);
  el.insertAdjacentHTML('beforeend',h);
  var svg=$('hus-svg'),karta=$('hus-karta');
  try{document.body.classList.add('hus-sida');
    document.body.classList.toggle('vaggplatta',!!arVaggplattaVy());}catch(e){}
  /* Tryckytorna: solpanelerna, uterummet, Breveden, Snickarboa, bilarna. */
  var yt=$('hus-ytor');
  (typeof HUS_YTOR!=='undefined'?HUS_YTOR:[]).forEach(function(y){
    var e=y.p?document.createElementNS(NS,'polygon'):(y.c?document.createElementNS(NS,'circle'):document.createElementNS(NS,'rect'));
    if(y.p)e.setAttribute('points',y.p);
    else if(y.c){e.setAttribute('cx',y.c[0]);e.setAttribute('cy',y.c[1]);e.setAttribute('r',y.c[2]);}
    else{e.setAttribute('x',y.r[0]);e.setAttribute('y',y.r[1]);e.setAttribute('width',y.r[2]);e.setAttribute('height',y.r[3]);e.setAttribute('rx',8);}
    e.setAttribute('class','hus-yta'+(y.hall?' hus-yta-hall':'')+(y.c40?' hus-yta-c40':''));
    if(y.c40)e.style.display='none';   /* v862: visas av husBilarUppd när C40 står där */
    if(y.pop)e.setAttribute('onclick',"openDetail('"+y.pop+"')");
    /* Håll inne: äppelträdet öppnar inställningarna (väggplattan har ingen meny). */
    if(y.hall)try{hallInne(e,new Function(y.hall));}catch(x){}
    yt.appendChild(e);});
  try{husBilarBygg(svg,NS);}catch(e){}   /* v858: bilarna, under ljuset */
  try{husTakBygg(svg,NS);}catch(e){}   /* v850: burspråkets tak, under ljuset */
  husLjusBygg(el,svg,NS);
  el._ledn={};
  var lsvg=$('hus-ledn-svg')||svg;   /* v856: eget lager */
  HUS_LEDN.forEach(function(l){
    var bas=document.createElementNS(NS,'path');bas.setAttribute('d',l.d);
    bas.setAttribute('class',l.ledare?'hus-ledare':'hus-bas');
    bas.style.stroke=HUS_FARG[l.typ];lsvg.appendChild(bas);
    if(l.ledare)return;   /* etikettlinje: inget flöde */
    var fl=document.createElementNS(NS,'path');fl.setAttribute('d',l.d);fl.setAttribute('class','hus-flod');
    lsvg.appendChild(fl);el._ledn[l.id]={bas:bas,fl:fl};
  });
  try{husFlodTakt();}catch(e){}   /* v856: väggplattan */
  el._falt={};
  Object.keys(HUS_FALT).forEach(function(k){
    var f=HUS_FALT[k],b=document.createElement('button');
    b.type='button';b.className='hus-falt'+(f.liten?' liten':'');b.style.setProperty('--f',HUS_FARG[f.typ]);
    b.style.left=(f.x/1040*100)+'%';b.style.top=(f.y/1120*100)+'%';
    b.style.width=(f.w/1040*100)+'%';b.style.height=(f.h/1120*100)+'%';
    b.setAttribute('onclick',f.fn||("openDetail('"+f.pop+"')"));
    if(f.typ==='vader')b.className+=' hus-vader';
    if(f.hoger)b.className+=' hoger';   /* v850: spegelvänd */
    /* v867: ELRUTAN – Elnät och Förbrukning i samma ruta, var sin halva med
       avdelare (som väderrutan). Halvorna fylls som de gamla rutorna (husFyll
       via el._falt.nat/.last) och öppnar var sin popup. */
    if(f.typ==='el'){
      b.className+=' hus-el';b.removeAttribute('onclick');
      (f.delar||[]).forEach(function(d,i){
        if(i)b.appendChild(Object.assign(document.createElement('span'),{className:'hel-av'}));
        var h=document.createElement('span');h.className='hel-h';h.style.setProperty('--f',HUS_FARG[d.typ]);
        h.setAttribute('onclick',"openDetail('"+d.pop+"')");b.appendChild(h);el._falt[d.typ]=h;});
    }
    /* v867: håll inne – väderrutan ligger över äppelträdet (inställningarna). */
    if(f.hall)try{hallInne(b,new Function(f.hall));}catch(x){}
    karta.appendChild(b);el._falt[k]=b;
  });
  el._byggd=true;
}
/* Ljuset i nattbilden: varmt sken från fönstren och utelamporna. Ligger under
   ledningarna. CSS visar det bara i mörkt tema. */
/* v858: BILARNA OVANIFRÅN (HUS_BILAR). bilSvg ritar en bil med skugga,
   kaross, rutor, speglar och lampor; färgerna sätts i CSS per modell och tema.
   Ligger under ljuset, så att parkeringslamporna lyser på dem. */
function bilSvg(m,cx,cy,tand){
  var W=m.W,L=m.L,x0=cx-W/2,y0=cy-L/2,p=function(d,kl){return '<path class="'+kl+'" d="'+d+'"/>';};
  var r=function(x,y,w,h,rx,kl){return '<rect class="'+kl+'" x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+rx+'"/>';};
  var g='<g class="hus-bil '+m.kl+(tand?' tand':'')+'" transform="translate('+x0+','+y0+')">';
  /* v874: OLÅST – lamporna lyser: sken på marken framför och bakom bilen
     (under karossen), och ljusare lampor (CSS .tand). */
  if(tand)g+='<ellipse class="bil-sken-fram" cx="'+(W/2)+'" cy="-16" rx="'+(W*0.8)+'" ry="24" fill="url(#bil-g-fram)"/>'
    +'<ellipse class="bil-sken-bak" cx="'+(W/2)+'" cy="'+(L+9)+'" rx="'+(W*0.62)+'" ry="13" fill="url(#bil-g-bak)"/>';
  g+=r(-1,4,W+2,L,m.rx+2,'bil-skugga');
  /* Kaross: rundad nos, rakare bak. */
  g+=p('M'+m.rx+',0 H'+(W-m.rx)+' Q'+W+',0 '+W+','+m.rx+' V'+(L-m.rb)+' Q'+W+','+L+' '+(W-m.rb)+','+L+' H'+m.rb+' Q0,'+L+' 0,'+(L-m.rb)+' V'+m.rx+' Q0,0 '+m.rx+',0 Z','bil-kaross');
  /* Skuldror: ljusare mittparti så karossen får form. */
  g+=r(4,6,W-8,L-12,m.rx-3,'bil-skuldra');
  /* Motorhuv-linjer. */
  g+=p('M'+(W*0.3)+',4 Q'+(W*0.32)+','+(m.vr*0.5)+' '+(W*0.33)+','+(m.vr-2)+' M'+(W*0.7)+',4 Q'+(W*0.68)+','+(m.vr*0.5)+' '+(W*0.67)+','+(m.vr-2),'bil-linje');
  /* Vindruta, tak, bakruta. */
  g+=p('M7,'+m.vr+' Q'+(W/2)+','+(m.vr-(m.vrBue||5))+' '+(W-7)+','+m.vr+' L'+(W-9)+','+m.tak+' H9 Z','bil-glas');
  g+=r(8,m.tak,W-16,m.bak-m.tak,5,'bil-tak');
  if(m.pano)g+=r(11,m.tak+3,W-22,m.bak-m.tak-6,4,'bil-pano');
  if(m.lucka)g+=r(13,m.tak+4,W-26,13,3,'bil-pano');
  if(m.reling){g+=r(9.5,m.tak+2,1.6,m.bak-m.tak-4,.8,'bil-reling');g+=r(W-11.1,m.tak+2,1.6,m.bak-m.tak-4,.8,'bil-reling');}
  if(m.br>0)g+=p('M9,'+m.bak+' H'+(W-9)+' L'+(W-8)+','+(m.bak+m.br)+' Q'+(W/2)+','+(m.bak+m.br+3)+' 8,'+(m.bak+m.br)+' Z','bil-glas');
  if(m.extra)g+=m.extra(W,L);   /* v875: modellens egna detaljer (XC60: bakruta, bromsljuslist) */
  /* Sidorutor som tunna band längs taket. */
  g+=r(5.5,m.vr+3,2.4,m.bak-m.vr-2,1.2,'bil-glas');g+=r(W-7.9,m.vr+3,2.4,m.bak-m.vr-2,1.2,'bil-glas');
  /* Speglar. */
  var sy=(m.spegelY!=null?m.spegelY:m.vr+1);
  g+='<ellipse class="bil-spegel" cx="-1.8" cy="'+sy+'" rx="2.8" ry="1.8"/><ellipse class="bil-spegel" cx="'+(W+1.8)+'" cy="'+sy+'" rx="2.8" ry="1.8"/>';
  /* Lampor fram och bak. */
  g+=m.fram(W,L);g+=m.bakl(W,L);
  return g+'</g>';
}
function husBilModell(namn){
  var M={
  ex40:{kl:'bil-ex40',W:50,L:116,rx:13,rb:10,vr:30,tak:47,bak:88,br:10,pano:true,
  /* "Thors hammare": T-formade ljus i framhörnen. */
  fram:function(W){return '<path class="bil-ljus" d="M4,7.5 Q5,4 10.5,3.4 M5.2,6.2 H11 M'+(W-4)+',7.5 Q'+(W-5)+',4 '+(W-10.5)+',3.4 M'+(W-5.2)+',6.2 H'+(W-11)+'"/>';},
  /* Smala, höga baklampor i hörnen. */
  bakl:function(W,L){return '<path class="bil-bak" d="M1.6,'+(L-16)+' V'+(L-5)+' Q2,'+(L-2)+' 5,'+(L-1.3)+' M'+(W-1.6)+','+(L-16)+' V'+(L-5)+' Q'+(W-2)+','+(L-2)+' '+(W-5)+','+(L-1.3)+'"/>';}},
  /* v862: C40 – coupé-taklinje: kortare tak, längre sluttande bakruta,
     glastak, Thors hammare fram och L-formade baklampor. */
  c40:{kl:'bil-c40',W:50,L:116,rx:13,rb:11,vr:30,tak:46,bak:80,br:17,pano:true,
  fram:function(W){return '<path class="bil-ljus" d="M4,7.5 Q5,4 10.5,3.4 M5.2,6.2 H11 M'+(W-4)+',7.5 Q'+(W-5)+',4 '+(W-10.5)+',3.4 M'+(W-5.2)+',6.2 H'+(W-11)+'"/>';},
  bakl:function(W,L){return '<path class="bil-bak" d="M1.6,'+(L-17)+' V'+(L-5)+' Q2,'+(L-2)+' 5,'+(L-1.3)+' H11 M'+(W-1.6)+','+(L-17)+' V'+(L-5)+' Q'+(W-2)+','+(L-2)+' '+(W-5)+','+(L-1.3)+' H'+(W-11)+'"/>';}},
  /* v875: XC60 2012 efter ovanbilden: lång motorhuv (~23 %), stor välvd
     vindruta, långt tak med silverfärgade takrails (ingen taklucka), en vit
     baklucka med ett tunt bromsljus tvärs över och den mörka bakrutan längst
     bak. Speglarna sitter en bit bakom vindrutans början; baklamporna är korta
     och kraftiga i hörnen och viker in en bit över bakluckan. */
  xc60:{kl:'bil-xc60',W:50,L:122,rx:12,rb:7,vr:28,vrBue:8,tak:51,bak:107,br:0,reling:true,spegelY:38,
  fram:function(W){return '<path class="bil-ljus" d="M3.2,9 Q4,4 11,2.6 M'+(W-3.2)+',9 Q'+(W-4)+',4 '+(W-11)+',2.6"/>';},
  bakl:function(W,L){return '<path class="bil-bak" d="M1.5,'+(L-15)+' V'+(L-6)+' Q1.9,'+(L-1.8)+' 8.5,'+(L-1.6)+' M'+(W-1.5)+','+(L-15)+' V'+(L-6)+' Q'+(W-1.9)+','+(L-1.8)+' '+(W-8.5)+','+(L-1.6)+'"/>';},
  extra:function(W,L){
    return '<rect class="bil-glas" x="7.5" y="'+(L-8.2)+'" width="'+(W-15)+'" height="5.2" rx="2"/>'
      +'<path class="bil-bak bil-bromsljus" d="M'+(W*0.24)+','+(L-12.2)+' H'+(W*0.76)+'"/>';}}
  };
  return M[namn]||null;
}
function husBilarBygg(svg,NS){
  if(typeof HUS_BILAR==='undefined'||!HUS_BILAR)return;
  var g=document.createElementNS(NS,'g');g.setAttribute('class','hus-bilar');svg.appendChild(g);
  husBilarUppd();
}
/* v862: C40 på uppfarten när den är hemma. Ritas bara om när det ändras. */
function husBilarUppd(){
  var g=document.querySelector('#hus-svg .hus-bilar');if(!g)return;
  var c40=false;
  try{c40=!!(DEV.car&&DATA[DEV.car]&&carHome(DEV.car))&&typeof HUS_BILAR_TRE!=='undefined';}catch(e){}
  var lista=c40?HUS_BILAR_TRE:HUS_BILAR;
  /* v874: lamporna tänds när bilen är olåst – bara när den är hemma (annars
     står den inte på uppfarten). Bilar utan Homey-enhet (XC60) lyser aldrig. */
  var tand=lista.map(function(b){try{var id=b.enhet&&DEV[b.enhet];
    return !!(id&&DATA[id]&&cap(id,'locked')===false&&carHome(id));}catch(e){return false;}});
  var nyckel=(c40?'3':'2')+tand.map(function(t){return t?1:0;}).join('');
  if(g._nyckel===nyckel)return;g._nyckel=nyckel;
  var h='<defs><radialGradient id="bil-g-fram"><stop offset="0" stop-color="#fff2c8" stop-opacity=".85"/><stop offset=".55" stop-color="#fff2c8" stop-opacity=".3"/><stop offset="1" stop-color="#fff2c8" stop-opacity="0"/></radialGradient>'
    +'<radialGradient id="bil-g-bak"><stop offset="0" stop-color="#ff3b3b" stop-opacity=".6"/><stop offset="1" stop-color="#ff3b3b" stop-opacity="0"/></radialGradient></defs>';
  lista.forEach(function(b,i){var m=husBilModell(b.modell);if(m)h+=bilSvg(m,b.cx,b.cy,tand[i]);});
  g.innerHTML=h;
  try{document.querySelectorAll('.hus-yta-c40').forEach(function(e){e.style.display=c40?'':'none';});}catch(e){}
}
/* v856: FLÖDET PÅ VÄGGPLATTAN. En CSS-animation räknas om i varje bildruta;
   på den äldre plattan blev det lagg. Där drivs flödet i stället härifrån med
   HUS_FLOD_FPS steg i sekunden (samma fart och riktning: animationDuration och
   .bak som husRita sätter), och står still när sidan inte syns. CSS stänger av
   animationen (body.vaggplatta .hus-flod). Andra enheter rörs inte. */
function husFlodTakt(){
  if(window._husFlodTakt||!document.body.classList.contains('vaggplatta'))return;
  try{if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;}catch(e){}
  /* v859: ledningarna och deras fart/riktning läses varannan sekund, inte i
     varje steg (querySelectorAll och stilläsningen var den största posten i
     profilen), och bara ändrade värden skrivs. */
  var lista=[],last=-1e9;
  window._husFlodTakt=setInterval(function(){
    if(document.hidden)return;
    var nu=performance.now();
    if(nu-last>2000){last=nu;lista=[];
      document.querySelectorAll('#hus-ledn-svg .hus-flod').forEach(function(e){
        if(e.classList.contains('av'))return;
        lista.push({e:e,d:parseFloat(e.style.animationDuration)||1.1,bak:e.classList.contains('bak'),v:null});});}
    var t=nu/1000;
    for(var i=0;i<lista.length;i++){var o=lista[i],f=(t/o.d)%1;if(o.bak)f=1-f;
      var v=String(Math.round(-32*f));if(v!==o.v){o.v=v;o.e.style.strokeDashoffset=v;}}
  },Math.round(1000/HUS_FLOD_FPS));
}
/* v850: små tak (HUS_SMATAK) – tre plan, kant och skugga, klippta vid husets
   takkant så att de ligger under hustaket. Färgerna sätts i CSS per tema. */
function husTakBygg(svg,NS){
  if(typeof HUS_SMATAK==='undefined'||!HUS_SMATAK)return;
  var defs=document.createElementNS(NS,'defs');svg.appendChild(defs);
  HUS_SMATAK.forEach(function(t,i){
    /* v869: LAPPEN. Bilden har ett eget målat burspråk i väggen ovanför
       hustaket; när taket dras in under hustaket skulle det synas. Det täcks
       med samma bild flyttad dx i sidled – väggen bredvid, med samma paneler.
       Dag- och nattbilden följer temat som bilderna under (husLappBild). */
    if(t.lapp){
      /* Mjuka kanter: en mask med lätt oskärpa i stället för en hård klippning. */
      var lid='hus-lapp-mask-'+i,lm=document.createElementNS(NS,'mask');lm.setAttribute('id',lid);
      lm.setAttribute('maskUnits','userSpaceOnUse');lm.setAttribute('x','0');lm.setAttribute('y','0');lm.setAttribute('width','1040');lm.setAttribute('height','1120');
      var lf=document.createElementNS(NS,'filter');lf.setAttribute('id',lid+'-f');lf.setAttribute('x','-20%');lf.setAttribute('y','-20%');lf.setAttribute('width','140%');lf.setAttribute('height','140%');
      var fb=document.createElementNS(NS,'feGaussianBlur');fb.setAttribute('stdDeviation',String(t.lapp.mjuk||1.6));lf.appendChild(fb);defs.appendChild(lf);
      var lr=document.createElementNS(NS,'rect');lr.setAttribute('x',t.lapp.r[0]);lr.setAttribute('y',t.lapp.r[1]);
      lr.setAttribute('width',t.lapp.r[2]);lr.setAttribute('height',t.lapp.r[3]);lr.setAttribute('fill','#fff');lr.setAttribute('filter','url(#'+lid+'-f)');
      lm.appendChild(lr);defs.appendChild(lm);
      var lg=document.createElementNS(NS,'g');lg.setAttribute('class','hus-lapp');lg.setAttribute('mask','url(#'+lid+')');
      ['natt','dag'].forEach(function(v){var im=document.createElementNS(NS,'image');
        im.setAttribute('class','hus-lapp-'+v);im.setAttribute('x',String(t.lapp.dx));im.setAttribute('y','0');
        im.setAttribute('width','1040');im.setAttribute('height','1120');im.setAttribute('preserveAspectRatio','none');lg.appendChild(im);});
      svg.appendChild(lg);husLappBild();
    }
    var id='hus-tak-klipp-'+i,cp=document.createElementNS(NS,'clipPath');cp.setAttribute('id',id);
    var r=document.createElementNS(NS,'rect');r.setAttribute('x','0');r.setAttribute('y','0');
    r.setAttribute('width','1040');r.setAttribute('height',String(t.kant));cp.appendChild(r);defs.appendChild(cp);
    var g=document.createElementNS(NS,'g');g.setAttribute('class','hus-tak');g.setAttribute('clip-path','url(#'+id+')');
    var poly=function(kl,pts,extra){var p=document.createElementNS(NS,'polygon');p.setAttribute('class',kl);p.setAttribute('points',pts);
      if(extra)p.setAttribute('transform',extra);g.appendChild(p);};
    poly('tak-skugga',t.skugga,'translate(2.5,3)');
    poly('tak-v',t.v);poly('tak-f',t.f);poly('tak-h',t.h);
    var k=t.v.split(' '),hh=t.h.split(' ');
    poly('tak-kant',[k[0],k[1],hh[0],hh[1]].join(' '));
    var ras=document.createElementNS(NS,'path');ras.setAttribute('class','tak-ras');
    ras.setAttribute('d','M'+k[1]+' L'+k[2]+' L'+hh[0]);g.appendChild(ras);
    svg.appendChild(g);
  });
}
/* v869: lappens bilder följer årstidens bildpar (husRita byter vid behov). */
function husLappBild(){
  var bn=husBildNamn();
  document.querySelectorAll('#hus-svg .hus-lapp image').forEach(function(im){
    var u='bild/hus-'+bn+(im.getAttribute('class')==='hus-lapp-natt'?'-natt':'')+'.webp';
    if(im.getAttribute('href')!==u)im.setAttribute('href',u);});
}
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
  /* Mildare suddning för utelamporna nära ett hörn – deras sken är litet. */
  var fl2=ny('filter',{id:'hus-mjuk-l',x:'-30%',y:'-30%',width:'160%',height:'160%'});
  fl2.appendChild(ny('feGaussianBlur',{stdDeviation:'3'}));
  defs.appendChild(fl2);
  /* Taken som mask: vitt = ljus syns, svart (taken) = ljus döljs. */
  /* Två masker: fönstren döljs av HUS_TAK, utelamporna dessutom av de lägre
     taken (poolrummet), som fönstren i stora huset lyser ut över. */
  function takMask(id,lista){
    var mk=ny('mask',{id:id,maskUnits:'userSpaceOnUse',x:'0',y:'0',width:'1040',height:'1120'});
    mk.appendChild(ny('rect',{x:0,y:0,width:1040,height:1120,fill:'#fff'}));
    lista.forEach(function(t){
      mk.appendChild(t.p?ny('polygon',{points:t.p,fill:'#000'}):ny('rect',{x:t.r[0],y:t.r[1],width:t.r[2],height:t.r[3],fill:'#000'}));});
    defs.appendChild(mk);}
  var tak=typeof HUS_TAK!=='undefined'?HUS_TAK:[],lag=typeof HUS_TAK_LAG!=='undefined'?HUS_TAK_LAG:[];
  /* v854: de små taken (burspråket) döljer också fönsterljuset – fönstren går
     in under taket och skenet syns bara utanför takfoten. Konturen tas ur
     HUS_SMATAK, så masken alltid följer taket. */
  try{tak=tak.concat((typeof HUS_SMATAK!=='undefined'?HUS_SMATAK:[]).map(function(t){
    var k=t.v.split(' '),h=t.h.split(' ');return {p:[k[0],k[1],h[0],h[1]].join(' ')};}));}catch(e){}
  takMask('hus-tak-mask',tak);
  takMask('hus-tak-mask-ute',tak.concat(lag));
  svg.appendChild(defs);
  var lj=ny('g',{'class':'hus-ljus'});
  /* Utelamporna maskas också av taken: ljuset från en lampa nära ett hörn
     tonar runt hörnet ute på marken, men aldrig uppe på taket – förut gick
     kilarna rakt över Brevedens tak med en skarp kant. */
  var ute=ny('g',{'class':'hus-ute',mask:'url(#hus-tak-mask-ute)'});
  /* Själva lamporna (de små ljusa punkterna) ligger också under taken: en
     lampa på väggen syns som en halv punkt ut från väggen, en lampa som sitter
     lite in under taket syns inte alls – precis som fönstren. */
  var karnor=ny('g',{'class':'hus-ute-karnor',mask:'url(#hus-tak-mask-ute)'});
  /* Väggens sken: ett halvt sken ut från väggen, ritat i lampans egna
     koordinater (ut = +x) med en gradient kring origo. */
  var gv=ny('radialGradient',{id:'hus-g-v',gradientUnits:'userSpaceOnUse',cx:'0',cy:'0',r:'46'});
  [['0','1'],['.3','.6'],['1','0']].forEach(function(st){
    gv.appendChild(ny('stop',{offset:st[0],'stop-color':'#ffd48a','stop-opacity':st[1]}));});
  defs.appendChild(gv);
  /* En utelampa kan följa en lampa i Homey (sjätte värdet, t.ex.
     'Breveden/Utebelysning'): då lyser den bara när lampan är på. Annars
     lyser den alltid i nattbilden (de tänds automatiskt på kvällen). */
  var uteKallor=[];
  /* Skenen skalas med utelampornas styrka (husUteRita): grundtransform + scale. */
  el._uteSken=[];el._uteGrupp=ute;
  HUS_UTE.forEach(function(p){
    var nyckel=p[5],id=nyckel&&HUS_LAMPOR[nyckel];
    var ute0=ute,karnor0=karnor;
    if(id){
      var gu=ny('g',{'class':'hus-fonster'}),gk=ny('g',{'class':'hus-fonster'});
      ute0.appendChild(gu);karnor0.appendChild(gk);
      uteKallor.push({kalla:{ids:[id],baraPa:true},g:gu},{kalla:{ids:[id],baraPa:true},g:gk});
      ute=gu;karnor=gk;
    }
    ritaUte(p);
    ute=ute0;karnor=karnor0;
  });
  function ritaUte(p){
    if(p.length>2&&p[2]!=null){
      var vg=ny('g',{transform:'translate('+p[0]+','+p[1]+') rotate('+p[2]+')'});
      /* En sektor kring riktningen: 180° på en vägg, 270° på ett hörn. */
      var sp=Math.max(30,Math.min(359,p[3]||180)),R=46;
      function sektor(a0,a1){var r0=a0*Math.PI/180,r1=a1*Math.PI/180;
        return 'M0,0 L'+(R*Math.cos(r0)).toFixed(1)+','+(R*Math.sin(r0)).toFixed(1)
          +' A'+R+','+R+' 0 '+((a1-a0)>180?1:0)+' 1 '+(R*Math.cos(r1)).toFixed(1)+','+(R*Math.sin(r1)).toFixed(1)+' Z';}
      /* Nära ett hörn (femte värdet ±1): ljuset fortsätter mjukt runt hörnet
         på den sidan, i smala kilar som tonar ut över 90°. Halvcirkeln ligger
         då i samma suddade grupp som kilarna – annars syns ett skarpt hopp
         där de möts nedanför hörnet. Mot taken klipper takmasken ändå skarpt. */
      var hs=p[4]===1||p[4]===-1?p[4]:0;
      var huvud=ny('path',{d:sektor(-sp/2,sp/2),fill:'url(#hus-g-v)'});
      if(!hs)vg.appendChild(huvud);
      if(hs){var mj=ny('g',{filter:'url(#hus-mjuk-l)'});mj.appendChild(huvud);
        [.88,.68,.5,.34,.2,.09].forEach(function(o,k){
          var a0=sp/2+k*15,a1=a0+15.5;
          mj.appendChild(ny('path',{d:hs>0?sektor(a0,a1):sektor(-a1,-a0),fill:'url(#hus-g-v)',opacity:o}));});
        vg.appendChild(mj);}
      ute.appendChild(vg);el._uteSken.push({e:vg,t:vg.getAttribute('transform')});
      karnor.appendChild(ny('circle',{cx:p[0],cy:p[1],r:4,fill:'#ffe6b0'}));return;}
    var fg=ny('g',{transform:'translate('+p[0]+','+p[1]+')'});
    fg.appendChild(ny('circle',{cx:0,cy:0,r:36,fill:'url(#hus-g-u)'}));
    ute.appendChild(fg);el._uteSken.push({e:fg,t:fg.getAttribute('transform')});
    karnor.appendChild(ny('circle',{cx:p[0],cy:p[1],r:4,fill:'#ffe6b0'}));}
  lj.appendChild(ute);
  lj.appendChild(karnor);
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
  /* Fönstren i en egen grupp som maskas av taken. */
  var fonGrp=ny('g',{mask:'url(#hus-tak-mask)'});lj.appendChild(fonGrp);
  HUS_FONSTER.forEach(function(f){
    var grupper={};
    f.p.forEach(function(p){
      var egna=(p[4]&&p[4].length)?p[4]:null,nyckel=egna?egna.join('|'):'';
      if(!grupper[nyckel]){
        var g=ny('g',{'class':'hus-fonster'});fonGrp.appendChild(g);
        var kalla=egna?{ids:egna.map(function(n){return HUS_LAMPOR[n];}).filter(Boolean)}:(HUS_RUM[f.rum]||{});
        grupper[nyckel]=g;kallor.push({kalla:kalla,g:g,fonster:true});}
      fonster(grupper[nyckel],p);});
  });
  el._fonster=kallor.concat(uteKallor);
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
      /* Utelamporna: på eller av räcker (Utebelysning rapporterar dim 0 när den är på). */
      if(k.baraPa){max=1;return;}
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
/* Hur mycket fönstren lyser, i procent (Inställningar → Utseende). 75 som
   standard. Under 100 blir skenet svagare, över 100 både starkare och längre. */
function husFonsterStyrka(){var v=(typeof CFG!=='undefined'&&CFG&&CFG.husFonster!=null)?+CFG.husFonster:75;
  return isFinite(v)?Math.max(0.2,Math.min(1.5,v/100)):0.75;}
/* Utelampornas styrka, i procent (Inställningar → Utseende). 100 som standard.
   Under 100 blir skenet svagare, över 100 både starkare och större. */
function husUteStyrka(){var v=(typeof CFG!=='undefined'&&CFG&&CFG.husUte!=null)?+CFG.husUte:100;
  return isFinite(v)?Math.max(0.2,Math.min(1.5,v/100)):1;}
function husUteRita(el){
  var u=husUteStyrka(),k=u>1?Math.sqrt(u):1;
  if(el._uteGrupp)el._uteGrupp.style.opacity=String(Math.min(1,u));
  (el._uteSken||[]).forEach(function(x){x.e.setAttribute('transform',x.t+(k!==1?' scale('+k.toFixed(3)+')':''));});
}
function husLjusRita(el){
  try{husUteRita(el);}catch(e){}
  var fs=husFonsterStyrka();
  (el._fonster||[]).forEach(function(f){
    /* v835: ljuset följer dimningen tydligare. Förut gav 1 % och 12 % nästan
       samma sken (0,26 mot 0,34 i styrka). Nu en kurva som liknar hur en
       dimmad lampa upplevs: 1 % ≈ 0,06, 12 % ≈ 0,28, 50 % ≈ 0,66, 100 % = 1.
       Utelamporna (bara på/av) påverkas inte. */
    var l=husKallaLjus(f.kalla),pa=l!=null,u=pa?Math.pow(Math.max(0,Math.min(1,l)),0.6):1;
    var k=pa?0.35+0.65*u:1;
    /* Styrkan i inställningarna gäller fönster, glasdörrar och glastaken –
       förut inte glastaken, som därför lyste starkare än fönstren. */
    var ff=(f.kalla&&f.kalla.baraPa)?1:fs;
    if(ff>1)k*=Math.sqrt(ff);
    f.g.classList.toggle('pa',pa);
    f.g.style.opacity=pa?String(Math.min(1,Math.max(0.06,u)*ff)):'';
    Array.prototype.forEach.call(f.g.querySelectorAll('[data-l]'),function(c){
      c.setAttribute('transform','scale('+k.toFixed(3)+',1)');});
    Array.prototype.forEach.call(f.g.querySelectorAll('[data-rx]'),function(c){
      c.setAttribute('rx',(+c.getAttribute('data-rx')*k).toFixed(1));
      c.setAttribute('ry',(+c.getAttribute('data-ry')*k).toFixed(1));});});
}
/* Väggplattan (kiosk): har ingen rört skärmen på HUS_VILA_MS skrollar sidan
   mjukt upp till huset igen. Inte medan en popup är öppen. */
function husViloKoll(){
  var b=document.body;if(!b||!b.classList.contains('kiosk')||!b.classList.contains('hus-sida'))return;
  /* Bara väggplattan – andra plattor står kvar där man skrollat. */
  try{if(!arVaggplattaVy())return;}catch(e){return;}
  if(Date.now()-_husAktiv<HUS_VILA_MS)return;
  var bk=document.getElementById('dlg-back');if(bk&&bk.classList.contains('open'))return;
  /* Står väggplattan på en annan vy (Väder via väderkortet) går den hem –
     den har ingen meny att gå tillbaka med. */
  try{var hem=document.getElementById('view-flode');if(hem&&hem.classList.contains('hidden')){goHome();return;}}catch(e){}
  if((window.scrollY||document.documentElement.scrollTop||0)>0){
    try{window.scrollTo({top:0,behavior:'smooth'});}catch(e){window.scrollTo(0,0);}}
}
/* Väderkortet: ikon och temperatur, lägst/högst i dag och vind med pil –
   samma värden som väderkortet på Väder-sidan (buildWeatherCompactHTML). */
/* v855: VÄDERKORTET, omgjort. Rad 1: ikon (SMHI:s symbol för timmen, annars
   Homeys väderläge), temperatur, lägst/högst och vind med byar. Rad 2:
   väderläget och upplevd temperatur. Rad 3: de närmaste fem timmarna. */
function husVaderFyll(b){
  if(!b)return;
  var sit=cap(DEV.smhi,'measure_weather_situation_cp'),t=cap(DEV.outdoor,'measure_temperature');
  var kn=cap(DEV.smhi,'air_temperature_feels_like_cp');
  var ex={min:null,max:null};try{ex=tempExtremes(t)||ex;}catch(e){}
  var ws=null,by=null;try{ws=vindMs();by=byMs();}catch(e){}
  var wd=cap(DEV.windNet,'measure_wind_angle');if(wd==null)wd=cap(DEV.smhi,'measure_wind_direction_cp');
  var g=function(v){return v==null||!isFinite(v)?'–':num(v,0)+'°';};
  var nu=Date.now(),fc=(typeof FORECAST!=='undefined'&&FORECAST?FORECAST:[]).filter(function(f){return f.t>=nu-1800000;});
  var ik=fc.length?vpIkon(vpSym(fc[0])[0]):icon(wxIcon(sit));
  /* v865: väder | vind, lika stora, avdelare emellan; "känns" under vädret,
     lägst/högst i dag under vinden. */
  var h='<span class="hv2-topp">'
    +'<span class="hv2-kol"><span class="hv2-rad"><span class="hv2-ic">'+ik+'</span>'
    +'<span class="hv2-t">'+(t==null?'–':num(t,1)+'°')+'</span></span>'
    +'<span class="hv2-sit"><span class="hv2-sitT">'+esc(sit||'Väder')+(kn!=null&&isFinite(kn)?'\u00a0·\u00a0':'')+'</span>'
    +(kn!=null&&isFinite(kn)?'<span class="hv2-kn">känns '+num(kn,0)+'°</span>':'')+'</span></span>'
    +'<span class="hv2-av"></span>'
    +'<span class="hv2-kol"><span class="hv2-rad"><span class="hv2-vic">'+windArrow(wd,null,null)+'</span>'
    +'<span class="hv2-t">'+(ws==null?'–':num(ws,0))+(by!=null&&isFinite(by)?'<small>('+num(by,0)+')</small>':'')+'<small class="hv2-enh">m/s</small></span></span>'
    +'<span class="hv2-sit hv2-hl"><span class="hv2-lag"><i>↓</i>'+g(ex.min)+'</span>\u2002<span class="hv2-hog"><i>↑</i>'+g(ex.max)+'</span></span></span>'
    +'</span>';
  /* De närmaste timmarna: nästa hela timme och fyra till. */
  var tim=fc.filter(function(f){return f.t>nu;}).slice(0,5);
  if(tim.length){
    var torr=!tim.some(function(f){return f.p!=null&&f.p>=0.1;});
    h+='<span class="hv2-tim'+(torr?' torr':'')+'">';
    tim.forEach(function(f){var d=new Date(f.t),sy=vpSym(f);
      h+='<span class="hv2-h"><span class="hv2-hk">'+('0'+d.getHours()).slice(-2)+'</span>'
        +'<span class="hv2-hi">'+vpIkon(sy[0])+'</span>'
        +'<span class="hv2-ht">'+(f.temp==null?'–':num(f.temp,0)+'°')+'</span>'
        +'<span class="hv2-hp">'+(f.p!=null&&f.p>=0.1?num(f.p,1):'')+'</span></span>';});
    h+='</span>';
  }else h+='<span class="hv2-tim hv2-tom">Prognosen hämtas från SMHI\u2026</span>';
  /* v861: oförändrat innehåll ritas inte om (husVaderFyll körs vid varje
     uppdatering). Bara när rutan syns räknas den som klar – annars kan inte
     raden mätas. */
  if(b._hv===h&&b.clientWidth)return;
  b.innerHTML=h;
  b.title=(sit||'Väder')+' – öppna Väder';
  husVaderPassa(b);
  b._hv=b.clientWidth?h:null;
}
/* v861: TOPPRADEN SKA RYMMAS. I kyla och blåst (−12,3°, ↓−15° ↑−10°, 14 (22) m/s)
   gick hög/låg och vinden utanför rutan. Ett steg i taget: huvudtemperaturen och
   ikonen mindre, sedan utan "m/s", sedan hög/låg och vind något mindre. Måtten
   är i cqw och följer rutan, så ett steg som räcker gäller i alla storlekar. */
function husVaderPassa(b){
  try{
    b.classList.remove('tat1','tat2','tat3','tat4','utan-sit');
    /* v865: två halvor – var och en ska rymma sin rad (väder resp. vind). */
    var rader=b.querySelectorAll('.hv2-rad');if(!rader.length||!rader[0].parentNode.clientWidth)return;
    var for_=function(){for(var i=0;i<rader.length;i++){if(rader[i].scrollWidth>rader[i].parentNode.clientWidth+1)return true;}return false;};
    for(var k=1;k<=4&&for_();k++)b.classList.add('tat'+k);
    /* Ryms inte väderläget helt ("Växlande molnighet") står bara "känns" kvar –
       ikonen visar redan läget, och ett avhugget ord säger ingenting. */
    b.classList.remove('utan-sit');
    var st=b.querySelector('.hv2-sitT');if(st&&st.scrollWidth>st.clientWidth+1)b.classList.add('utan-sit');
  }catch(e){}
}

function husFyll(b,rub,w,under){
  var t=husTal(w);
  b.innerHTML='<span class="rub"><i></i>'+esc(rub)+'</span><span class="v">'+t[0]+'<small> '+t[1]+'</small></span>'
    +(under?'<span class="u">'+esc(under)+'</span>':'');
  b.classList.toggle('noll',!(w!=null&&Math.abs(w)>=50));
}
/* Små rutor: en ikon, effekten och ev. en kort tilläggstext (laddnivån). */
function husIkon(typ,niva){
  var a=' viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  if(typ==='sol')return '<svg'+a+'><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>';
  if(typ==='bil')return '<svg'+a+'><path d="M5 16.5h14M4 16.5v-3.2l2-4.8a2 2 0 0 1 1.8-1.2h8.4a2 2 0 0 1 1.8 1.2l2 4.8v3.2"/><path d="M4 13.3h16"/><circle cx="7.5" cy="16.8" r="1.6"/><circle cx="16.5" cy="16.8" r="1.6"/></svg>';
  /* Batteriet fylls efter laddnivån. */
  var n=(niva==null||!isFinite(niva))?0:Math.max(0,Math.min(100,niva)),fw=(12.6*n/100).toFixed(1);
  return '<svg'+a+'><rect x="2.5" y="7" width="17" height="10" rx="2.2"/><path d="M21.5 10.5v3"/>'
    +'<rect x="4.7" y="9.2" width="'+fw+'" height="5.6" rx="1" fill="currentColor" stroke="none"/></svg>';
}
function husFyllLiten(b,typ,w,extra,niva){
  var t=husTal(w);
  b.innerHTML='<span class="hik">'+husIkon(typ,niva)+'</span><span class="v">'+t[0]+'<small> '+t[1]+'</small></span>'
    +(extra?'<span class="hx">'+esc(extra)+'</span>':'');
  b.classList.toggle('noll',!(w!=null&&Math.abs(w)>=50));
}
/* ÅRSTIDEN efter kalendern: vår mars–maj, sommar juni–augusti, höst
   september–november, vinter december–februari. Snöbilden bara när det ligger
   snö – då även utanför vintermånaderna; annars vintern utan snö. */
function husArstid(d){var m=(d||new Date()).getMonth();
  return m>=2&&m<=4?'var':(m>=5&&m<=7?'sommar':(m>=8&&m<=10?'host':'vinter'));}
function husBildNamn(){
  if(husSnoNu())return 'vinter';
  var a=husArstid();return a==='vinter'?'vinter-utan-sno':a;}
/* Ligger det snö? Snödjupet från Open-Meteo (minst 1 cm, högst sex timmar
   gammalt), eller dashboardens egen snödetektor som sett snö på panelerna i dag. */
function husSnoNu(){
  try{if(isDemo())return false;}catch(e){}
  var c=_husSno;
  if(c&&c.m!=null&&isFinite(c.m)&&Date.now()-c.t<6*3600000&&c.m>=0.01)return true;
  try{var o=snowGet(),e=o[dayKey()];if(e&&e[0]>0)return true;}catch(e){}
  return false;}
/* Hämtar snödjupet (meter) för timmen närmast nu, högst var 30:e minut. */
function husSnoHamta(){
  if(_husSnoBusy||Date.now()-_husSnoForsok<30*60000)return;
  try{if(isDemo())return;}catch(e){}
  _husSnoBusy=true;_husSnoForsok=Date.now();
  var url='https://api.open-meteo.com/v1/forecast?latitude='+CONFIG.LAT+'&longitude='+CONFIG.LON
    +'&hourly=snow_depth&past_days=1&forecast_days=1&timeformat=unixtime&timezone=UTC';
  fetch(url,{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).then(function(j){
    var t=j&&j.hourly&&j.hourly.time,v=j&&j.hourly&&j.hourly.snow_depth;if(!t||!v)return;
    var nu=Date.now()/1000,bi=-1,bd=1e12;
    for(var i=0;i<t.length;i++){if(v[i]==null||!isFinite(v[i]))continue;var dd=Math.abs(t[i]-nu);if(dd<bd){bd=dd;bi=i;}}
    if(bi<0)return;
    _husSno={t:Date.now(),m:+v[bi]};
    try{localStorage.setItem('husSno_v1',JSON.stringify(_husSno));}catch(e){}
    try{husRita();}catch(e){}
  }).catch(function(){}).then(function(){_husSnoBusy=false;});}
function husRita(){
  var el=$('huspanel');if(!el)return;
  /* render() kan köras innan start.js hunnit till [huset.js]; då väntar vi. */
  if(typeof HUS_LEDN==='undefined'||!HUS_LEDN||typeof HUS_FONSTER==='undefined'||!HUS_FONSTER)return;
  husBygg(el);
  /* Årstidens bild (och snön). Byts bara när namnet ändras. */
  try{husSnoHamta();}catch(e){}
  var bn=husBildNamn();
  if(el._bild!==bn){var bnat=$('hus-img-natt'),bdag=$('hus-img-dag');
    if(bnat)bnat.src='bild/hus-'+bn+'-natt.webp';if(bdag)bdag.src='bild/hus-'+bn+'.webp';el._bild=bn;
    try{husLappBild();}catch(e){}}
  try{husLjusRita(el);}catch(e){}
  var v=husVarden();
  /* Solen: vänster tak → nedre mitten → övre mitten → höger tak → elcentralen. */
  var s=Math.max(0,v.sol||0),batt=v.batt||0;
  /* Nätets ledning bär det som köps (säljs = −), från Pulse. Bilen har en
     egen ledning ut från elcentralen; sol och batteri har egna ledningar in. */
  var bil=v.bil>=50?v.bil:0,nat0=v.nat||0;
  /* Solens ledning är lika tjock hela vägen: varje sträcka visar hela
     soleffekten (det finns ändå bara en mätare för alla paneler). */
  var varden={sol1:s,sol2:s,sol3:s,sol4:s,
    nat:nat0,batt:batt,bil:bil};
  HUS_LEDN.forEach(function(l){
    if(l.ledare)return;
    var w=varden[l.id]||0,r=el._ledn[l.id],tom=Math.abs(w)<50,b=husBredd(w);
    r.bas.style.strokeWidth=tom?2.5:b;r.bas.style.opacity=tom?0.25:0.85;
    r.fl.style.strokeWidth=Math.max(2.5,b*0.55);
    r.fl.setAttribute('class','hus-flod'+(tom?' av':'')+(w<0?' bak':''));
    r.fl.style.animationDuration=(tom?0:Math.max(0.45,1.5-Math.abs(w)/1000*0.12))+'s';
  });
  /* Nätets färg efter det som flödar: köpt el (in) = nätets färg, såld el
     (ut från elcentralen) = den största av sol och batteri. */
  function natfarg(w){if(w>-50)return HUS_FARG.nat;return s>=Math.max(0,batt)?HUS_FARG.sol:HUS_FARG.batt;}
  el._ledn.nat.bas.style.stroke=natfarg(nat0);
  /* Bilens gren: tänd när en bil laddar, tunn och blek när en bil bara är
     inkopplad (som de andra ledningarna utan flöde), borta utan bil. */
  el._ledn.bil.bas.style.display=el._ledn.bil.fl.style.display=(bil||v.inkopplad)?'':'none';
  var nat=v.nat,last=v.last;
  /* Andelen eget räknas som "självförsörjt" i energipanelen (renderEnergy):
     sol och batteri mot det som går in i huset, solen högst vad panelerna ger. */
  var natIn=Math.max(0,nat||0),battIn=Math.max(0,v.batt||0);
  var solIn=Math.max(0,Math.min(s,(last||0)-natIn-battIn)),T=natIn+battIn+solIn;
  var eget=(last==null)?null:Math.round((T>0&&last>0?(solIn+battIn)/T:(nat!=null&&nat<0?1:0))*100);
  /* Under 50 W åt något håll visas 0: när batteriet täcker förbrukningen
     pendlar Pulse några watt kring noll. */
  husFyll(el._falt.nat,'Elnät',(nat!=null&&Math.abs(nat)<50)?0:nat,nat==null?'':(nat>=50?'köper':nat<=-50?'säljer':'–'));
  husFyll(el._falt.last,'Förbrukning',last,eget==null?'':(eget+' % eget'));
  husFyllLiten(el._falt.sol,'sol',v.sol,'');
  /* Batteriet: effekten och laddnivån; riktningen syns på ledningen. */
  husFyllLiten(el._falt.batt,'batt',v.batt,v.soc==null?'':Math.round(v.soc)+' %',v.soc);
  el._falt.batt.title=v.batt==null?'Batteri':(v.batt>50?'Batteriet laddar ur':v.batt<-50?'Batteriet laddar':'Batteriet vilar');
  /* Bilrutan syns när en bil laddar eller bara är inkopplad (då 0 W, tonad). */
  try{husVaderFyll(el._falt.vader);}catch(e){}
  try{husBilarUppd();}catch(e){}
  var laddar=v.bil>=50;
  husFyllLiten(el._falt.bil,'bil',laddar?v.bil:0,'',null);
  el._falt.bil.title=v.bilNamn+(laddar?' laddar':' inkopplad')+(v.bilSoc!=null?' · '+Math.round(v.bilSoc)+' %':'');
  el._falt.bil.hidden=!(laddar||v.inkopplad);
}
