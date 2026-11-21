/* js/el.js — Elpopupen (v924): allt om el på ett ställe. Öppnas med ett
 * långtryck på Snickarboa (husbilden och rutan). De vanliga popuperna ligger
 * kvar som förut; den här lånar deras byggstenar.
 *
 * Filen innehåller BARA funktionsdeklarationer. Konstanter, tillstånd och allt
 * som körs direkt vid laddning ligger i js/start.js, som laddas sist, under
 * rubriken [el.js]. En funktion går att anropa oavsett vilken fil den står
 * i, men kod som körs vid laddning kan här anropa en funktion i en fil som inte
 * hunnit laddas. Lägg den därför aldrig här.
 *
 * Ordningen är frågorna man har, uppifrån: vad händer nu (flödet), vad kostar
 * det och vad är planen (pris och plan), sedan batteriet och bilen med sina
 * knappar, säkringen, dagens siffror och vad som hänt senast.
 */

/* Långtrycket sätter _suppressClick för klicket som kommer efteråt, och
   openDetail skulle ta den spärren som sin egen och inte öppna något. Klicket
   på Snickarboa stoppas i stället av _husHallAt (huset.js). */
function openEl(){_suppressClick=false;openDetail('el');}
function elDag(o){_elDag=o;elRitaOm();}
function elRitaOm(){var b=$('dlg-body');if(b&&_dlgWhich==='el')b.innerHTML=elPopHTML();}
/* W utan minustecken, och "–" när värdet saknas. */
function elW(w){return (w==null||!isFinite(w))?'–':W(Math.abs(w));}

/* ---- Flödet nu: fem rutor ---- */
function elFlodeHTML(){
  var sol=cap(DEV.solar,'measure_power'),hus=houseNowW(),nat=cap(DEV.pulse,'measure_power');
  var bw=null;try{bw=battEffektNu();}catch(e){}
  var soc=cap(DEV.battery,'measure_battery'),bil=chargerW();
  var ruta=function(ic,farg,v,k,sub,klick){
    return '<button type="button" class="el-f" onclick="'+klick+'"><span class="el-f-ic" style="color:'+farg+'">'+icon(ic)+'</span>'
      +'<b>'+v+'</b><span class="el-f-k">'+k+'</span>'+(sub?'<span class="el-f-s">'+sub+'</span>':'')+'</button>';};
  var natK=(nat!=null&&nat<0)?'säljer':'köper',natF=(nat!=null&&nat<0)?'var(--ok)':'var(--hot)';
  var battK=(bw!=null&&bw>BATT_TROSKEL_W)?'laddar':((bw!=null&&bw<-BATT_TROSKEL_W)?'laddar ur':'vilar');
  return '<div class="el-flode">'
    +ruta('sun','var(--gold)',elW(sol),'Sol','',"openDetail('sun')")
    +ruta('house','var(--ink)',elW(hus),'Huset','',"openDetail('self')")
    +ruta('lightning',natF,elW(nat),'Nät',natK,"openDetail('grid')")
    +ruta('battery-high','var(--cyan)',(soc==null?'–':Math.round(soc)+' %'),'Batteri',battK,"openDetail('batt')")
    +ruta('car-profile','var(--blue)',(bil!=null&&bil>50?elW(bil):'–'),'Bil',(bil!=null&&bil>50?'laddar':'laddar inte'),"openDetail('cars')")
    +'</div>';
}

/* ---- Planen framåt som en rad steg: nu, sedan de närmaste bytena ---- */
function elPlanSteg(){
  var P=null;try{P=battPlanData();}catch(e){}
  if(!P||!P.h||!P.h.length)return '';
  var nu=Date.now(),seg=battPlanSegment(P);try{seg=battPlanMedMan(seg);}catch(e){}
  var bl=[];
  seg.forEach(function(s){if(s.t1<=nu)return;var t0=Math.max(s.t0,nu),b=bl[bl.length-1];
    if(b&&b.l===s.l&&!!b.man===!!s.man&&Math.abs(b.t1-t0)<60000)b.t1=s.t1;else bl.push({l:s.l,t0:t0,t1:s.t1,man:!!s.man});});
  var kl=function(ms){return avlKl(ms).replace(/:00$/,'');};
  var steg=bl.slice(0,4).map(function(b,i){
    var tid=i===0?'Nu':kl(b.t0)+'–'+(b.t1>=nu+47*3600000?'':kl(b.t1));
    return '<span class="el-s'+(b.man?' man':'')+'"><i class="bp-pr bp-'+b.l+'"></i>'+esc(tid)+' '+BP_NAMN[b.l]+(b.man?' · bokat':'')+'</span>';});
  return '<div class="el-plan"><div class="el-steg">'+steg.join('<span class="el-pil">→</span>')+'</div>'
    +(P.vinst!=null&&P.vinst>=1?'<div class="el-vinst">ca '+Math.round(P.vinst)+' kr billigare än bara normal drift</div>':'')+'</div>';
}

/* ---- Batteriet: läget i klartext och knapparna ---- */
/* Ladda max: samma ruta som batteriets Ladda-knapp (openBattLadd). Den står
   bara här om ingen egen Ladda-knapp redan hör till batteriet. */
function elLaddaKnapp(){
  var l=null,bok=null;try{l=battLaddLage();}catch(e){}try{bok=battStartAktiv();}catch(e){}
  var fram=bok!=null&&bok>Date.now();
  var lbl=l?'Laddar max':(fram?'Ladda '+regelKl(bok):'Ladda max');
  return '<button type="button" class="ctl'+(l?' on':'')+(fram?' bokad':'')+'" onclick="openBattLadd()"><span class="ctl-ic">'+icon('battery-charging')+'</span><span class="ctl-l">'+esc(lbl)+'</span></button>';
}
function elBattHTML(){
  var L=null;try{L=regelLage();}catch(e){}
  var bok=null;try{bok=battBokning();}catch(e){}
  var knappar='';try{knappar=popKnappar('batt');}catch(e){}
  var harLadda=false;try{harLadda=(CONFIG.BUTTONS||[]).some(function(b){return b&&b.type==='battladd'&&knappTill(b)==='batt';});}catch(e){}
  if(!knappar)knappar='<div class="controls hem-pop"><div class="ctl-row">'+elLaddaKnapp()+battSparaKnapp()+battAutoKnapp()+'</div></div>';
  else if(!harLadda)knappar=knappar.replace('<div class="ctl-row">','<div class="ctl-row">'+elLaddaKnapp());
  return '<div class="el-rad"><span class="el-rad-k">Läge</span><b>'+esc((L&&L.txt)||'okänt')+'</b>'
    +(bok?'<span class="el-rad-s">'+esc(bok.txt)+'</span>':'')+'</div>'+knappar;
}

/* ---- Säkringen: tre faser mot gränsen ---- */
function elSakringHTML(){
  var hs=fasSakring(),g=hs;try{g=sakVaktVarde('max');}catch(e){}
  var a=fasAlla();if(a.every(function(x){return x==null;}))return '';
  var tak=Math.max(hs,g)*1.1;
  var rad=a.map(function(v,i){
    var f=v==null?0:Math.min(1,v/tak),farg=v==null?'var(--faint)':(v>=g?'var(--hot)':(v>=g*0.8?'var(--gold)':'var(--ok)'));
    return '<div class="el-fas"><span class="el-fas-k">L'+(i+1)+'</span><span class="el-fas-b"><i style="width:'+(f*100).toFixed(1)+'%;background:'+farg+'"></i>'
      +'<em style="left:'+(Math.min(1,g/tak)*100).toFixed(1)+'%"></em></span><b>'+(v==null?'–':num(v,1)+' A')+'</b></div>';}).join('');
  var tol=0,min=0;try{tol=sakVaktVarde('tol');min=sakVaktVarde('tid');}catch(e){}
  return rad+'<div class="el-not">Gräns '+g+' A per fas'+(tol>0&&min>0?' (+'+tol+' A i '+min+' min)':'')+' · huvudsäkring '+hs+' A</div>';
}

/* ---- Senaste händelserna ur tidslinjen ---- */
function elHandelserHTML(){
  var D=null;try{D=tlData();}catch(e){}
  var h=(D&&Array.isArray(D.h))?D.h.slice().sort(function(a,b){return b[0]-a[0];}).slice(0,4):[];
  if(!h.length)return '<div class="el-not">Inga händelser än.</div>';
  return h.map(function(x){var ty=TL_TYP[x[2]]||TL_TYP.info,ka=TL_KAT[x[1]]||TL_KAT.sys;
    return '<div class="el-h"><span class="el-h-t">'+esc(avlKl(x[0]))+'</span><span class="el-h-ic" style="color:'+ty[2]+'">'+icon(ka[1])+'</span>'
      +'<span class="el-h-x">'+esc(x[3])+'</span></div>';}).join('')
    +'<button type="button" class="el-lank" onclick="closeDetail();openNotiser();tlOppna()">Hela tidslinjen ›</button>';
}

function elPopHTML(){
  var d=_elDag||0;
  var tog='<div class="seg-row el-dag"><button class="seg-btn'+(d===0?' on':'')+'" onclick="elDag(0)">Idag</button>'
    +'<button class="seg-btn'+(d===1?' on':'')+'" onclick="elDag(1)">Imorgon</button></div>';
  var graf='';try{graf=dayPriceGraphSVG(d);}catch(e){graf='<div class="pgraph-empty">Grafen kunde inte ritas.</div>';}
  var bil='';try{bil=buildCarsPopup();}catch(e){}
  var sak='';try{sak=elSakringHTML();}catch(e){}
  var ruta='';try{ruta=prisRutor(d);}catch(e){}
  return '<div class="el">'
    +elFlodeHTML()
    +'<div class="el-sek">Pris och plan'+(battAutoPa()?' <span class="bp-prov bp-auto">auto</span>':'')+'</div>'
    +tog+'<div class="pgraph">'+graf+'</div>'
    +elPlanSteg()
    +ruta
    +'<div class="el-sek">Husbatteri</div>'+elBattHTML()
    +'<div class="el-sek">Bilar</div>'+bil
    +(sak?'<div class="el-sek">Säkring</div>'+sak:'')
    +'<div class="el-sek">Senaste händelser</div>'+elHandelserHTML()
    +'</div>';
}
