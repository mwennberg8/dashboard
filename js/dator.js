/* js/dator.js — Datorläget (v934): dashboarden på en datorskärm.
 *
 * Filen innehåller BARA funktionsdeklarationer. Konstanter, tillstånd och allt
 * som körs direkt vid laddning ligger i js/start.js, som laddas sist, under
 * rubriken [dator.js]. En funktion går att anropa oavsett vilken fil den står
 * i, men kod som körs vid laddning kan här anropa en funktion i en fil som inte
 * hunnit laddas. Lägg den därför aldrig här.
 *
 * Datorläget (body.dator) gäller när skärmen styrs med mus (fin pekare, hover),
 * är minst 1024 px bred och liggande – alltså inte plattorna, väggplattan eller
 * telefonen, som behåller sina layouter. Det går också att tvinga med
 * ?mode=desktop eller view_mode_v1 = 'desktop'.
 *   - Menyn står som en list längst till vänster, med Inställningar sist.
 *   - Startsidan fyller fönstret: huset till vänster i hela höjden, avsnitten
 *     till höger, och ett elpriskort (graf, plan, dagens priser) som fyller
 *     resten av höjden.
 *   - Popuperna blir breda i stället för höga: större grafer, raderna och
 *     knapparna i fler kolumner (CSS under body.dator i index.html).
 */

function arDator(){
  try{
    if(typeof MOBILE!=='undefined'&&MOBILE)return false;
    var q=(typeof location!=='undefined'&&location.search)||'';
    if(q.indexOf('mode=desktop')>=0)return true;
    if(q.indexOf('mode=tablet')>=0)return false;
    var vm=null;try{vm=localStorage.getItem('view_mode_v1');}catch(e){}
    if(vm==='desktop')return true;
    if(vm==='tablet')return false;
    var w=window.innerWidth||0,h=window.innerHeight||0;
    var fin=!!(window.matchMedia&&window.matchMedia('(hover:hover) and (pointer:fine)').matches);
    return fin&&w>=1024&&w>=h*1.1;
  }catch(e){return false;}
}
/* Anropas av applyKiosk. Returnerar true när datorläget gäller – då gör
   applyKiosk inget mer (ingen kioskram, ingen skalning). */
function datorTillampa(){
  var b=document.body;if(!b||!b.classList)return false;
  var on=arDator();
  b.classList.toggle('dator',on);
  if(!on){datorMeny(false);var dp=$('dator-pris');if(dp)dp.remove();return false;}
  b.classList.remove('kiosk');b.classList.remove('tabprev');b.classList.remove('rull');
  try{document.documentElement.style.overflow='';}catch(e){}
  try{var wr=document.querySelector('.wrap');if(wr&&wr.style){wr.style.transform='';wr.style.width='';wr.style.height='';wr.style.zoom='';wr.style.margin='';}}catch(e){}
  try{flikradBygg();}catch(e){}
  datorMeny(true);
  try{datorPrisRita(true);}catch(e){}
  return true;
}
/* Inställningar sist i listen – på plattan nås de genom att hålla inne Hem,
   vilket ingen gissar med en mus. */
function datorMeny(on){
  var nav=$('flikrad');if(!nav)return;
  var b=nav.querySelector('[data-flik="inst"]');
  if(on&&!b){
    b=document.createElement('button');b.type='button';b.className='flik flik-inst';b.setAttribute('data-flik','inst');
    b.innerHTML=icon('gear')+'<span>Inställningar</span>';
    b.addEventListener('click',function(){try{openConfig();}catch(e){}});
    nav.appendChild(b);
  }else if(on&&b&&nav.lastElementChild!==b)nav.appendChild(b);
  else if(!on&&b)b.remove();
}

/* ===== ELPRISKORTET PÅ STARTSIDAN =====
   Samma graf som kostnadspopupen (dayPriceGraphSVG) men stor, med dagens
   priser under. Grafens id byts (pg- → dp-), så att popupens dragavläsning och
   masker inte krockar med kortet när båda finns; kortet går inte att dra i –
   ett tryck öppnar popupen med allt. Kortet ligger sist i högerkolumnen och
   fyller höjden som blir över (datorPassa). */
function datorDag(o){_datorDag=o;datorPrisRita(true);}
function datorPrisRita(tvinga){
  if(!document.body||!document.body.classList.contains('dator'))return;
  var v=$('view-flode');if(!v)return;
  var el=$('dator-pris');
  if(!el){el=document.createElement('section');el.id='dator-pris';el.className='panel dator-pris';}
  if(el.parentElement!==v||v.lastElementChild!==el)v.appendChild(el);
  /* Högst var 10:e sekund – grafen följer priset per kvart/timme. */
  /* Ett tomt kort (priserna inte hämtade än) ritas om direkt. */
  if(!tvinga&&el.firstChild&&!el.querySelector('.pgraph-empty')&&Date.now()-_datorPrisAt<10000){datorPassa();return;}
  _datorPrisAt=Date.now();
  var d=_datorDag||0,graf='',rutor='';
  try{graf=dayPriceGraphSVG(d);}catch(e){graf='<div class="pgraph-empty">Grafen kunde inte ritas.</div>';}
  graf=graf.replace(/id="pg-/g,'id="dp-').replace(/\b(pgFade|pgLine|pgMask)\b/g,function(m){return 'dp'+m.slice(2);})
    .replace(/ on(pointerdown|pointermove|pointerup|pointercancel)="[^"]*"/g,'');
  try{rutor=prisRutor(d);}catch(e){}
  var auto=false;try{auto=battAutoPa();}catch(e){}
  /* Rubriken öppnar kostnadspopupen (pilen visar att den går att klicka på). */
  el.innerHTML='<div class="dp-huvud"><button class="dp-titel" onclick="_priceDay='+d+';openDetail(\'cost\')" title="Öppna kostnad och pris">'
      +icon('lightning')+'Elpris och plan'+(auto?' <span class="bp-prov bp-auto">auto</span>':'')+icon('caret-right')+'</button>'
    +'<div class="seg-row dp-dag">'+[[-1,'Igår'],[0,'Idag'],[1,'Imorgon']].map(function(x){
      return '<button class="seg-btn'+(d===x[0]?' on':'')+'" onclick="datorDag('+x[0]+')">'+x[1]+'</button>';}).join('')+'</div></div>'
    +'<div class="dp-graf" onclick="_priceDay='+d+';openDetail(\'cost\')">'+graf+'</div>'
    +'<div class="dp-rutor">'+rutor+'</div>';
  datorPassa();
}
/* Kortets höjd = det som är kvar av fönstret under avsnitten ovanför, men
   minst 340 px (då skrollar sidan i stället). */
function datorPassa(){
  var el=$('dator-pris');if(!el||!document.body.classList.contains('dator'))return;
  var v=$('view-flode');if(!v||v.classList.contains('hidden'))return;
  el.style.height='';
  var top=el.getBoundingClientRect().top+(window.scrollY||0);
  var luft=parseFloat(getComputedStyle(document.querySelector('.wrap')).paddingBottom)||7;
  var h=Math.max(340,Math.floor(window.innerHeight-top-luft));
  el.style.height=h+'px';
}
