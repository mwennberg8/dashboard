/* js/grafer.js — Graferna: vindtoppar, produktionsprognos, vind, belastning per fas, storleksprofiler, datarader som rutor, energimix, gemensam grafstil och avläsningspunkten.
 *
 * Filen innehåller BARA funktionsdeklarationer. Konstanter, tillstånd och allt
 * som körs direkt vid laddning ligger i js/start.js, som laddas sist, under
 * rubriken [grafer.js]. En funktion går att anropa oavsett vilken fil den står
 * i, men kod som körs vid laddning kan här anropa en funktion i en fil som inte
 * hunnit laddas. Lägg den därför aldrig här.
 */

function windInsCache(){try{var o=JSON.parse(localStorage.getItem(WIND_INS_KEY)||'{}');
  return (o&&o.day===dayKey())?o:null;}catch(e){return null;}}
function windInsKan(){
  try{return !isDemo()&&!!BASE&&!CONFIG.DATA_URL&&!!CONFIG.TOKEN&&CONFIG.TOKEN.indexOf('DIN_API')<0;}catch(e){return false;}}
async function progHamta(force){
  if(!force&&_prog&&Date.now()-_progAt<5*60000)return _prog;
  try{
    var j=await appGet('/prognos');
    if(!j||!j.dagar)throw new Error('tomt svar');
    _prog=j;_progAt=Date.now();_progFel=null;
    return j;
  }catch(e){_progFel=(e&&e.message)||String(e);return null;}}
function progIdag(){
  if(!_prog||!_prog.dagar)return null;
  var e=_prog.dagar[_prog.idag];
  return (e&&e.summa_prognos!=null)?e:null;}
function progDagKey(off){return dayKey(new Date(dayStart()+(off||0)*86400000));}
function progDagE(off){
  if(!_prog||!_prog.dagar)return null;
  var e=_prog.dagar[progDagKey(off)];
  return (e&&e.timmar&&e.timmar.length===24)?e:null;
}
function progDagSet(off){
  _progDag=off;
  var el=$('prog-sec');if(el)el.innerHTML=progAvsnitt();
}
/* Gårdagens faktiska produktion: dagens serie HIST['solar'] räcker inte
   bakåt, men sjudygnsserien HIST7['solar'] (Insights) gör det. */
function progFaktFor(off){
  var t0=dayStart()+off*86400000, t1=t0+86400000;
  var kalla=(off===0)?(HIST['solar']||[]):((HIST7&&HIST7['solar'])||[]);
  return kalla.filter(function(p){
    return p&&p.t>=t0&&p.t<t1&&p.v!=null&&isFinite(p.v)&&p.v>=0&&p.v<25000;})
    .sort(function(a,b){return a.t-b.t;});
}

/* Prognoskurvan som svag yta bakom dagens faktiska. Timvarden mot en
   effektkurva: prognosen ar Wh per timme, den faktiska ar W vid en tidpunkt —
   over en timme ar de samma tal, sa de gar att lagga i samma diagram. */
/* Soluppgång idag, som millisekunder. Kurvan ska börja där solen börjar, inte
   vid midnatt — en platt linje från 00 till 05 säger ingenting. */
function t0Sol(dT0){
  var bas=(dT0!=null)?dT0:dayStart();
  try{
    var d=new Date(bas+12*3600000), tz=-d.getTimezoneOffset();
    var sc=solar(d,CONFIG.LAT,CONFIG.LON,tz);
    /* solar() ger soluppgången färdig som decimaltimme. Att leta efter
       elevation>0 i en slinga vore både långsammare och fel: fältet heter
       elevation, inte alt, och en felstavning gav tyst midnatt. */
    if(sc&&typeof sc.sunrise==='number'&&isFinite(sc.sunrise))
      return bas+Math.max(0,sc.sunrise)*3600000;
  }catch(e){}
  return bas;}

/* cid finns för att _grafByggare skickar ett id-prefix till alla grafer.
   Solgrafen använder det inte: den innehåller inga id och inga dragpunkter, så
   två kopior på sidan kan inte krocka. Parametern tas emot ändå, så den dagen
   grafen får interaktiva element finns kroken på plats. */
function progKurvaSVG(off,cid){
  off=(off==null)?_progDag:off;
  var e=progDagE(off);if(!e)return '';
  /* Imorgon finns inget uppmätt; igår finns det i sjudygnsserien. */
  var dagT0=dayStart()+off*86400000;
  /* Högre ritruta och mer plats under. Bredden är 1000 enheter mot skärmens
     bredd, så en högre H ger en proportionellt högre graf — på en telefon i
     stället för en tunn remsa. pB rymmer klockslagen i läsbar storlek. */
  /* HÖJDEN. Bredden är alltid 1000 enheter mot skärmens bredd, så förhållandet
     mellan W och H avgör hur hög grafen blir. 430 mot 1000 ger ungefär 170 px
     på en telefon — dubbelt mot förut.

     Elementet har numera height:auto. Med fast höjd och bibehållet
     bildförhållande centrerades svg:n i rutan och lämnade breda tomma band över
     och under, eftersom innehållet bara var 82 px högt i en 230 px hög låda. */
  /* pT rymmer toppvärdet som nu står ovanför den översta linjen. */
  var W=1000,H=430,pT=44,pB=56;
  /* Sortera OCH avvisa orimliga punkter. En serie som slagits ihop från två
     källor kan ligga i fel ordning, och en enda punkt med mätarställning i
     stället för effekt drar kurvan rakt upp. 25 kW är långt över vad 19,44 kWp
     kan ge. */
  var fakt=(off>0)?[]:progFaktFor(off);
  /* Börja vid NOLL, inte där mätningen råkade starta. Saknas punkter före
     första mätvärdet drogs kurvan lodrätt upp från golvet mitt på dagen, som om
     panelerna slagit på med ett ryck. Före soluppgången producerar de ingenting,
     så en nolla där är sann — inte en gissning. En nolla läggs bara till om
     första punkten ligger efter gryningen OCH är låg nog att ha vuxit fram. */
  if(fakt.length){
    var forsta=fakt[0];
    var gryning=t0Sol(dagT0);
    if(forsta.t>gryning+15*60000){
      fakt=[{t:gryning,v:0}].concat(fakt);
    }else if(forsta.t>dagT0+15*60000&&forsta.v<300){
      fakt=[{t:dagT0,v:0}].concat(fakt);
    }
  }
  /* Skalan sätts av dagens HÖGSTA PROGNOSTAL, inte av utfallet. Ett enstaka
     mätvärde över prognosen tryckte annars ner hela kurvan — och det är
     prognosen man läser grafen mot. Utfallet får gå över taket de sällsynta
     gånger det händer; hellre det än en kurva som är platt varje dag.
     Fem procents luft räcker för att toppen inte ska nudda kanten. */
  var max=Math.max.apply(null,e.timmar.concat([1]))*1.05;
  var faktMax=fakt.length?Math.max.apply(null,fakt.map(function(p){return p.v;})):0;
  if(faktMax>max)max=faktMax*1.02;
  /* BESKÄR till soltimmarna. Halva grafen var natt — en platt linje som inte
     sa något, medan dagen som faktiskt hände blev liten och svårläst. Fönstret
     är första och sista timmen med något att visa, i prognos eller utfall, plus
     en halvtimmes marginal i vardera änden. */
  /* SOLUPPGÅNG OCH SOLNEDGÅNG som fönster, inte en tröskel i produktionen.
     Tröskelmetoden gick om intet så fort ett enda småvärde låg utanför — och
     eftersom både prognosen och mätningen kan ha sådana blev fönstret hela
     dygnet igen. Solens gång är känd, oberoende av data, och kan inte förstöras
     av en enstaka avvikande punkt.

     En halvtimme före uppgång och efter nedgång, så kurvan får landa i noll i
     stället för att klippas mitt i. */
  var sc=null;
  try{var dMitt=new Date(dagT0+12*3600000);sc=solar(dMitt,CONFIG.LAT,CONFIG.LON,-dMitt.getTimezoneOffset());}catch(e){}
  var upp=(sc&&isFinite(sc.sunrise))?sc.sunrise:6;
  var ner=(sc&&isFinite(sc.sunset))?sc.sunset:20;
  if(!(ner>upp)){upp=6;ner=20;}
  /* SLUTET styrs av prognosen, inte av solnedgången. Panelerna är sydvända och
     skuggas av taket långt före horisonten — sista timmarna gav en flack svans
     som tryckte ihop resten av kurvan. Sista timmen över 500 W är där det
     slutar hända något värt att titta på.

     Soluppgången får däremot styra starten: på morgonen vill man se att solen
     kommer, och där finns inget motsvarande skuggproblem. */
  var sistaOver=null;
  for(var hi=23;hi>=0;hi--){ if((e.timmar[hi]||0)>=500){ sistaOver=hi; break; } }
  if(sistaOver!=null)ner=Math.min(ner,sistaOver+1);
  /* Minst sex timmar. En decemberdag i Bohuslän har knappt sju timmars ljus,
     och under det blir kurvan för hoptryckt för att läsa. */
  if(ner-upp<6){var mitt=(upp+ner)/2;upp=Math.max(0,mitt-3);ner=Math.min(24,mitt+3);}
  var t0=dagT0+Math.max(0,upp-0.5)*3600000;
  var t1=dagT0+Math.min(24,ner+0.5)*3600000;
  /* Ingen egen kolumn längre: kurvan får hela bredden. */
  var vxL=0;
  var X=function(ms){return vxL+((ms-t0)/(t1-t0))*(W-vxL);};
  var Y=function(v){return pT+(1-Math.max(0,Math.min(1,v/max)))*(H-pT-pB);};
  /* Prognosen ritas som en yta: den ar en uppskattning, inte en matning, och
     ska inte se lika bestamd ut som den faktiska kurvan. */
  var d='M'+vxL+' '+Y(0).toFixed(1);
  for(var h=0;h<24;h++){
    var hx=X(dagT0+(h+0.5)*3600000);
    if(hx<vxL-2||hx>W+2)continue;           /* utanför det beskurna fönstret */
    d+=' L'+hx.toFixed(1)+' '+Y(e.timmar[h]).toFixed(1);
  }
  d+=' L'+W+' '+Y(0).toFixed(1)+' L'+W+' '+(H-pB)+' L'+vxL+' '+(H-pB)+' Z';
  /* Klockslagen ritades förut som <text> här inne. De ligger numera i den
     gemensamma tidsaxeln under grafen — samma ställe och samma stil som i alla
     andra grafer. Stödlinjerna på tredjedelarna är kvar: utan dem gick det
     inte att se om kurvorna låg förskjutna mot varandra eller bara hade olika
     form, och skillnaden är viktig — den ena vore ett fel, den andra är
     verkligheten.
     De använde getHours() rakt av, alltså webbläsarens lokaltid. Här går det
     bra (dashboarden kör i webbläsaren), men de är ändå borta nu. */
  var xax='';
  [1/3,2/3].forEach(function(f){
    var x=X(t0+(t1-t0)*f);
    xax+='<line x1="'+x.toFixed(1)+'" y1="'+pT+'" x2="'+x.toFixed(1)+'" y2="'+(H-pB)
      +'" stroke="var(--line)" stroke-width="1" opacity=".3"/>';});
  var b='<path d="'+d+'" fill="var(--gold)" opacity=".16"/>';
  /* Y-AXELN INUTI grafen. Toppvärdet låg som ett HTML-element bredvid och
     skalade inte med den; nu står tre kW-tal i samma storlek som klockslagen,
     längs stödlinjerna där de hör hemma. */
  /* Talen står OVANFÖR sin stödlinje och vänsterställda i kanten, i stället för
     i en egen kolumn till vänster om grafen. Kolumnen åt tjugo procent av
     bredden och tryckte in kurvan; ovanpå linjen kostar den ingenting.

     Nollan är borttagen — bottenlinjen är noll, och ett tal som inte säger
     något tar bara plats. */
  for(var g=0;g<=2;g++){var gy=pT+(H-pT-pB)*g/2;
    b+='<line class="grid-l" x1="0" y1="'+gy.toFixed(1)+'" x2="'+W+'" y2="'+gy.toFixed(1)+'"/>';
    /* Toppvärdet stod här förut. Det är borta i v599 tillsammans med y-skalan
       i de andra graferna: dragpunkten säger vad kurvan står på, i kW, vid den
       tidpunkt man pekar på. */
  }
  /* Fem stödlinjer i stället för tre — med dubbel höjd blev avstånden annars
     för stora för att kunna läsa av ett värde mitt i kurvan. */
  for(var g2=1;g2<4;g2+=2){var gy2=pT+(H-pT-pB)*g2/4;
    b+='<line class="grid-l" x1="0" y1="'+gy2.toFixed(1)+'" x2="'+W+'" y2="'+gy2.toFixed(1)
      +'" opacity=".4"/>';}
  /* Enheten skrivs i TOPPVÄRDET i stället för som en egen etikett. Ovanför
     krockade den med toppen och nedanför med nollan — kolumnen är för smal för
     två rader, och ett tal med enhet läses ändå lättare än två separata. */
  if(fakt.length>1){
    var fd=smoothPath(fakt.map(function(q){return [X(q.t),Y(q.v)];}));
    b+='<path d="'+fd+'" fill="none" stroke="var(--solar)"'+GRAF_LINJE+'/>';
  }
  /* Prognosen är timvärden mitt i sin timme — samma punkter som ytan ritas av.
     Utfallet är fakt, beskuret till samma fönster som kurvan. */
  var progPts=[];
  for(var ph=0;ph<24;ph++){var pt=dagT0+(ph+0.5)*3600000;
    if(pt>=t0&&pt<=t1)progPts.push({t:pt,v:e.timmar[ph]});}
  var faktPts=fakt.filter(function(q){return q.t>=t0&&q.t<=t1;});
  var kw=function(v){return num(v/1000,1)+' kW';};
  var svgm='<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" '
    +'aria-label="Prognos och faktisk produktion idag">'+nollLinje(Y(0),0,W)+b+xax+'</svg>';
  svgm=avlLager('prog',svgm,{W:W,H:H,X:X,t0:t0,t1:t1,ser:[
    {namn:'prognos',farg:'var(--gold)',pts:progPts,Y:Y,fmt:kw},
    {namn:'faktiskt',farg:'var(--solar)',pts:faktPts,Y:Y,fmt:kw}]});
  return '<div class="chart-wrap" style="margin-top:8px">'
    /* Nollan under y-axeln är underförstådd — kurvan bottnar där ändå, och en
       tredje uppsättning siffror gjorde bara grafen plottrig. */

    /* preserveAspectRatio borttagen: den sträcker svg:n i x-led, och sträckt
       text på tidsaxeln blir oläslig. Grafen skalar ändå med bredden. */
    +svgm
    /* Klockslagen ritas numera inuti svg:n och följer det beskurna fönstret.
       De fasta 00 och 24 här hade blivit fel så fort grafen zoomades in. */
    +'</div>'
    /* Samma färgförklaring som under batterigrafen: .mchart-lg2, centrerad,
       med .mc-sw-färgprick. Inte klickbar här (sol har inget serieval), men
       utseendet är identiskt. */
    +'<div class="mchart-lg2">'
    +'<span><i class="mc-sw" style="background:var(--gold)"></i>Prognos</span>'
    +'<span><i class="mc-sw" style="background:var(--solar)"></i>Faktiskt</span>'
    +'</div>'
    /* "Mätt från"-upplysningen står kvar men på egen rad under legenden — den
       hör inte till färgförklaringen och ska inte breda ut den. */
    +(fakt.length&&(fakt[0].t-dayStart())>45*60000
      ? ('<div class="avl-cap">mätt från '
         +new Date(fakt[0].t).toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'})
         +((_serKalla.solar&&_serKalla.solar.app)?'':' (appen loggar inte solen)')
         +'</div>')
      : '')
    +'';}

/* Staplar for de senaste 14 dygnen. Avvikelsen i procent sager mer an kWh:
   ett fel pa 5 kWh betyder helt olika saker i juni och i december. */
function progStaplarHTML(){
  if(!_prog||!_prog.dagar)return '';
  var k=Object.keys(_prog.dagar).sort().filter(function(d){
    var e=_prog.dagar[d];return e&&e.summa_prognos!=null&&e.summa_utfall!=null;});
  k=k.slice(-14);
  if(!k.length)return '';
  var maxA=1;
  k.forEach(function(d){var a=_prog.dagar[d].avvikelse;
    if(a!=null&&Math.abs(a)>maxA)maxA=Math.abs(a);});
  maxA=Math.min(100,Math.max(20,maxA));
  var h='<div class="prog-b">';
  k.forEach(function(d){
    var e=_prog.dagar[d],a=e.avvikelse;
    var hpct=(a==null)?0:Math.min(50,Math.abs(a)/maxA*50);
    var upp=(a!=null&&a>=0);
    h+='<div class="prog-c" title="'+esc(d)+'">'
      +'<div class="prog-w">'
      +'<div class="prog-s'+(upp?' upp':' ner')+'" style="height:'+hpct.toFixed(1)+'%"></div>'
      +'</div><div class="prog-d">'+esc(d.slice(8))+'</div></div>';
  });
  h+='</div>';
  return h;}

/* Ritar om prognosdelen på plats när svaret kommer. */
function progUppdatera(){try{
  var e=document.getElementById('prog-sec');
  if(e&&_dlgWhich==='sun')e.innerHTML=progAvsnitt();
}catch(x){}}
function progAvsnitt(){
  /* Helskärmsbyggaren registreras HÄR, inte i någon annan rutas gren. Först låg
     den bredvid poolens, som bara körs när poolrutan öppnas — då fanns ingen
     byggare för solgrafen och helskärmen hade ritat tomt. Solavsnittet ritas
     varje gång rutan öppnas, så här är den alltid satt när knappen finns. */
  _grafByggare['prog']={titel:'Solprognos',
    full:function(cid){return progKurvaSVG(_progDag,cid||'prog-full');}};
  if(!_prog){
    /* Tyst utelämnande gör det omöjligt att se om funktionen är trasig, avstängd
       eller aldrig hämtad. En rad kostar ingenting och sparar en felsökning. */
    if(!appKan())return '';
    return '<div class="dsec">Prognos idag</div>'
      +'<div class="isub" style="opacity:.7">'
      +(_progFel?('Kunde inte läsa prognosen från appen: '+esc(_progFel)
                  +'. Kräver Homey-appen 2.13.0 eller senare.')
                :'Hämtar prognosen…')
      +'</div>';
  }
  var e=progIdag();
  var m=_prog.medelfel||{};

  /* All förklaring bakom en i-knapp — hur prognosen räknas, vad medelfel och
     systematiskt betyder, och varför de kan saknas. Förut låg fyra rader
     löptext direkt under siffrorna. */
  var info=''
    +'<p style="margin:0 0 8px"><b>Prognosen</b> räknas i Homey-appen ur molntäcket från '
    +'Open-Meteo och panelernas läge — fyra takgrupper med olika lutning och väderstreck. '
    +'Den låses mellan kl 4 och 9 och skrivs aldrig om under dagen; en prognos som ändrar '
    +'sig i efterhand går inte att bedöma.</p>'
    +'<p style="margin:0 0 8px"><b>Medelfel</b> är hur mycket prognosen missar i genomsnitt, '
    +'oavsett håll. <b>Systematiskt</b> visar om den genomgående ligger för högt eller lågt. '
    +'Är det tydligt åt ett håll ska molnkoefficienten <b>k</b> justeras i appens '
    +'inställningar — nu '+num(_prog.k,2)+'.</p>'
    +'<p style="margin:0 0 8px">Ett dygn räknas först när utfallet finns, alltså dagen efter. '
    +'Orimliga dygn utelämnas: den totala mätarställningen har tidigare råkat läsas som '
    +'dygnsproduktion, och ett enda sådant dygn förgiftar medelfelet i veckor.</p>'
    +'<p style="margin:0"><b>Kurvan</b> visar prognosen som yta och den uppmätta effekten '
    +'som linje. Mätningen kommer från Homey-appen när den loggar solen, annars från den '
    +'här webbläsaren — och då bara så länge sidan varit öppen.</p>';
  var q=iqBtnHtml(info);

  var dagNamn=(_progDag<0)?'igår':(_progDag>0?'imorgon':'idag');
  var h='<div class="dsec">Prognos '+dagNamn+q.btn+'</div>'+q.box;
  /* Igår / Idag / Imorgon — ALLTID synlig, även när valt dygn saknar prognos,
     annars går det inte att byta tillbaka. Samma segmentknappar som prisrutan.
     Knappar för dygn som saknar prognos gråas. */
  h+='<div class="seg-row" style="margin:2px 0 8px">'
    +[[-1,'Igår'],[0,'Idag'],[1,'Imorgon']].map(function(x){
      var finns=!!progDagE(x[0]);
      return '<button class="seg-btn'+(_progDag===x[0]?' on':'')+'"'+(finns?'':' disabled style="opacity:.4"')
        +' onclick="progDagSet('+x[0]+')">'+x[1]+'</button>';}).join('')
    +'</div>';
  /* Helskärm, som i batteri- och förbrukningsgraferna. Tidsvalet hör inte hit —
     dygnet väljs med Igår/Idag/Imorgon ovanför — så bara knappen. */
  h+=(progDagE(_progDag)?(progKurvaSVG()+grafTidsval('prog',false,true)):'<div class="viz-empty">'+(_progDag>0?'Morgondagens prognos räknas när molnprognosen publicerats (runt 13).':(_progDag<0?'Ingen sparad prognos för igår.':'Ingen prognos ännu.'))+'</div>');
  /* Raderna följer valt dygn. Igår: prognos mot utfall med avvikelse. Idag:
     prognos mot hittills. Imorgon: bara prognosen — inget finns att jämföra. */
  var ed=progDagE(_progDag)||(_progDag===0?e:null);
  if(ed){
    var pk=ed.summa_prognos/1000;
    h+=dRow('Prognos',num(pk,1)+' kWh');
    if(_progDag===0){
      var fakt=cap(DEV.solar,'meter_power.day');
      h+=dRow('Hittills idag',fakt==null?'–':num(fakt,1)+' kWh');
      if(fakt!=null&&pk>0)h+=dRow('Andel av prognos',Math.round(fakt/pk*100)+' %');
    }else if(_progDag<0){
      var uf=(ed.summa_utfall!=null)?ed.summa_utfall/1000:null;
      h+=dRow('Utfall',uf==null?'–':num(uf,1)+' kWh');
      if(uf!=null&&pk>0)h+=dRow('Avvikelse',(uf-pk>=0?'+':'')+num(uf-pk,1)+' kWh · '+Math.round(uf/pk*100)+' % av prognos');
    }
  }else{
    h+='<div class="isub" style="opacity:.7">Ingen prognos ställd för '+dagNamn
      +(_progFel?(' — '+esc(_progFel)):'')+'.</div>';
  }

  var st=progStaplarHTML();
  if(st){
    var tinfo=''
      +'<p style="margin:0 0 8px">Varje stapel är ett dygn. Höjden visar hur mycket '
      +'utfallet avvek från prognosen i <b>procent</b>, inte i kWh — ett fel på 5 kWh '
      +'betyder helt olika saker i juni och i december.</p>'
      +'<p style="margin:0 0 8px">Grön stapel: prognosen låg nära. Guld: den missade '
      +'åt något håll. Röd: den missade grovt. Staplar uppåt betyder att det kom mer '
      +'sol än väntat, nedåt mindre.</p>'
      +'<p style="margin:0">Ett dygn dyker upp först när utfallet finns, alltså dagen '
      +'efter. Ligger staplarna genomgående åt samma håll ska molnkoefficienten '
      +'<b>k</b> justeras i appens inställningar.</p>';
    var tq=iqBtnHtml(tinfo);
    h+='<div class="dsec">Träffsäkerhet · 14 dygn'+tq.btn+'</div>'+tq.box+st;
  }

  /* Medelfelet FÖRSVANN helt när inga dygn dög. Att en rad bara uteblir går
     inte att skilja från att funktionen är trasig — säg i stället varför. */
  if(m.n){
    h+=dRow('Medelfel',num(m.mae/1000,1)+' kWh'+(m.maePct!=null?(' · '+num(m.maePct,0)+' %'):''))
      +dRow('Systematiskt',(m.bias>=0?'+':'')+num(m.bias/1000,1)+' kWh'
        +(m.biasPct!=null?(' · '+(m.biasPct>=0?'+':'')+num(m.biasPct,0)+' %'):''))
      +dRow('Bygger på',m.n+' dygn');
  }else if(st){
    h+='<div class="isub" style="margin-top:6px;opacity:.7">Ingen träffsäkerhet än — den '
      +'kräver dygn där både prognos och utfall finns. Utfallet fylls i dagen efter.</div>';
  }
  return h;}

async function appState(force){
  if(!force&&_appState&&Date.now()-_appStateAt<5*60000)return _appState;
  try{
    var j=await appGet('/state');
    if(!j||!j.version)throw new Error('tomt svar');
    _appState=j;_appStateAt=Date.now();return j;
  }catch(e){_appFel=(e&&e.message)||String(e);return null;}}
/* Poolens siffror hör inte ihop med vindens. Låg de i samma funktion föll de
   bort så fort vinddatan saknades — en koppling utan skäl. */
function appStatePool(st){
  if(!st)return;
  if(st.pool)_appPool=st.pool;
  if(st.poolVecka&&st.poolVecka.n)_appPoolV=st.poolVecka;}
async function windAppFetch(){
  var st=await appState();
  appStatePool(st);
  if(!st||!st.vind)return false;
  var v=st.vind;
  /* KM/H OCKSA HAR. Appens dygnstoppar sparades som de var, med kommentaren
     att de kommer ur samma Insights-loggar - och det ar just poangen: de
     loggarna ligger i km/h, precis som nar dashboarden laser dem sjalv nagra
     rader ner och delar med 3,6. Toppen for dygnet visades darfor i km/h
     medan allt annat pa sidan stod i m/s, och eftersom det hogsta vardet
     vinner slog den dessutom ut den ratta siffran fran de egna matningarna.
     Att det ar km/h ar inte en gissning: appens measure_gust_today stod pa 46
     samtidigt som byvinden nu var 23 och SMHI:s dygnsprognos 11,2 m/s.
     46 m/s ar 165 km/h - orkan. 46 km/h ar 12,8 m/s, alltsa dagens vader. */
  var ny={};
  if(v.dygnMax&&v.dygnMax.v!=null)ny.wind={v:kmhTillMs(v.dygnMax.v),t:v.dygnMax.t};
  if(v.byDygnMax&&v.byDygnMax.v!=null)ny.gust={v:kmhTillMs(v.byDygnMax.v),t:v.byDygnMax.t};
  if(ny.wind&&ny.wind.v==null)delete ny.wind;
  if(ny.gust&&ny.gust.v==null)delete ny.gust;
  if(!ny.wind&&!ny.gust)return false;
  /* Appens toppar hamtas var femtonde minut i bakgrunden, inte bara nar sidan
     oppnas - darfor tacker de aven timmar da ingen haft dashboarden uppe. */
  var spara={day:dayKey(),t:Date.now(),kalla:'app'};
  if(ny.wind)spara.wind=ny.wind;
  if(ny.gust)spara.gust=ny.gust;
  try{localStorage.setItem(WIND_INS_KEY,JSON.stringify(spara));}catch(e){}
  windPopupUppdatera();
  return true;}
async function windInsFetch(force){
  if(_windInsBusy)return false;
  if(!force&&_windInsAt&&Date.now()-_windInsAt<5*60000)return false;
  if(!windInsKan()){_windInsFel='ingen direktkoppling till Homey';return false;}
  _windInsBusy=true;_windInsAt=Date.now();
  /* Appen först. Lyckas den behöver vi inte läsa Insights själva. */
  try{ if(await windAppFetch()){_windInsFel=null;_windInsBusy=false;return true;} }catch(e){}
  try{
    var logs=await homeyGet('/api/manager/insights/log/');
    if(!logs)throw new Error('Insights svarade inte');
    var vill={wind:[DEV.windMs,['measure_wind_strength']],
              gust:[DEV.windMs,['measure_gust_strength']],
              winddir:[DEV.windNet,['measure_wind_angle']]};
    var ny={},hittade=0;
    for(var k in vill){
      var lg=findLog(logs,vill[k][0],vill[k][1]); if(!lg)continue;
      var e=await homeyGet('/api/manager/insights/log/'+lg.uri+'/'+lg.id+'/entry?resolution=today');
      var p=parseEntries(e);
      if(k==='wind'||k==='gust')p=p.map(function(x){return {t:x.t,v:x.v/3.6};});
      if(p.length){ny[k]=p.sort(function(a,b){return a.t-b.t;});hittade++;}}
    if(!hittade)throw new Error('hittade ingen logg för '+((DATA[DEV.windMs]||{}).name||'vindmätaren'));
    _windSeries=ny;_windInsFel=null;
    /* Bara topparna sparas. Hela dygnsserien ar for stor for localStorage och
       hamtas anda om vid nasta oppning – men topparna ska synas direkt. */
    var spara={day:dayKey(),t:Date.now()};
    ['wind','gust'].forEach(function(k2){spara[k2]=windMaxFrom(k2,dayStart());});
    try{localStorage.setItem(WIND_INS_KEY,JSON.stringify(spara));}catch(e2){}
    windPopupUppdatera();
    try{renderWeather();}catch(e3){}
    return true;
  }catch(e){
    _windInsFel=(e&&e.message)||'kunde inte hamta';
    windPopupUppdatera();
    return false;
  }finally{_windInsBusy=false;}}
/* Dygnets matpunkter: Insights sa langt den racker, egna matningar darefter.
   Ingen dubblering – HIST anvands bara for tiden EFTER sista Insights-punkten. */
/* t0 kan skickas in (tidsvalet); annars dygnets start som förut. */
function windPoints(k,t0In,cid){
  var t0=(t0In!=null)?t0In:dayStart(), ins=(_windSeries&&_windSeries[k])||[], ut=[];
  /* Lång period: Insights timvärden först, dygnets tätare punkter efter dem. */
  if(cid&&grafLang(cid)){langBehov(k);var l=LANG[k]||[];
    for(var a=0;a<l.length;a++){var q0=l[a];if(q0&&q0.t>=t0&&q0.v!=null&&isFinite(q0.v))ut.push(q0);}}
  var forst=ut.length?ut[ut.length-1].t:-Infinity;
  for(var i=0;i<ins.length;i++){var p=ins[i];
    if(p&&p.t>=t0&&p.t>forst&&p.v!=null&&isFinite(p.v))ut.push(p);}
  var senast=ut.length?ut[ut.length-1].t:0;
  var h=HIST[k]||[];
  for(var j=0;j<h.length;j++){var q=h[j];
    if(q&&q.t>=t0&&q.t>senast&&q.v!=null&&isFinite(q.v))ut.push(q);}
  ut.sort(function(a,b){return a.t-b.t;});
  return ut;}
/* Högsta värde från en given tidpunkt, ur dygnets mätpunkter. */
function windMaxFrom(k,t0){
  const a=windPoints(k);
  let v=null,t=null;
  for(let i=0;i<a.length;i++){const p=a[i];
    if(p.t<t0)continue;
    if(v==null||p.v>v){v=p.v;t=p.t;}}
  return {v:v,t:t};}
function windNowMax(k){return windMaxFrom(k,Date.now()-WIND_NU_H*3600000);}
function windDayMax(k){
  const m=windMaxFrom(k,dayStart()), c=windInsCache();
  /* Direkt efter en omladdning, innan Insights hunnit svara, kan den sparade
     toppen vara högre än något vi har i minnet. Då gäller den. */
  if(c&&c[k]&&c[k].v!=null&&(m.v==null||c[k].v>m.v))return c[k];
  return m;}
/* Tidpunkt för ett sparat toppvärde. Data från tidigare versioner saknar
   tidsstämpel – då letas värdet upp i dygnets mätserie i stället. */
function windExWhen(t,v,k){
  if(t)return t;
  if(v==null)return null;
  const a=HIST[k]||[], t0=dayStart();
  for(let i=0;i<a.length;i++)if(a[i].t>=t0&&Math.abs(a[i].v-v)<0.05)return a[i].t;
  return null;}
function windWhenTxt(t){return t?hhmm(new Date(t)):'okänt klockslag';}
function windSerOn(){
  var v=CFG&&CFG.windSer;
  if(!Array.isArray(v))return ['wind','gust'];
  var ut=v.filter(function(k){return WIND_SER.some(function(s){return s[0]===k;});});
  return ut;}
function windSerTog(k){
  var pa=windSerOn().slice(), i=pa.indexOf(k);
  if(i<0)pa.push(k); else pa.splice(i,1);
  CFG.windSer=pa;saveCfg();
  var e=document.getElementById('wind-chart');
  if(e)e.innerHTML=windChartHTML('wind');}
function windChartHTML(cid){
  cid=cid||'wind';
  var fen=grafFonster(cid);
  var t0=fen.t0, pa=windSerOn(), W=1000,H=170,pT=12,pB=22;
  var ser=[];
  for(var i=0;i<WIND_SER.length;i++){var S=WIND_SER[i];
    if(pa.indexOf(S[0])<0)continue;
    var p=windPoints(S[0],t0,cid);
    if(p.length>1)ser.push({k:S[0],namn:S[1],farg:S[2],axel:S[3],p:p});}
  /* Vind, byvind och riktning väljs numera i samma sorts förklaring som
     dygnsgrafens sol/förbrukning/batteri: samma klass, samma färgstreck, samma
     plats UNDER grafen. Förut var de knappar i chipsform ovanför den, alltså
     ett eget mönster för samma sak. */
  var chips='<div class="mchart-lg2">';
  for(var q=0;q<WIND_SER.length;q++){var C=WIND_SER[q],av=(pa.indexOf(C[0])>=0);
    chips+='<span'+(av?' class="on"':' class="dim"')+' onclick="windSerTog(\''+C[0]+'\')">'
      +'<i class="mc-sw" style="background:'+C[2]+'"></i>'+esc(C[1])+'</span>';}
  chips+='</div>';
  if(!ser.length)return '<div class="chart-empty">'
    +(pa.length?'samlar data… grafen fylls på medan sidan är öppen':'välj vad som ska visas')+'</div>'+chips;
  var tMin=t0, tMax=Date.now();
  ser.forEach(function(s){var l=s.p[s.p.length-1].t;if(l>tMax)tMax=l;});
  var msMax=0,harMs=false,harDeg=false;
  ser.forEach(function(s){
    if(s.axel==='deg'){harDeg=true;return;}
    harMs=true;s.p.forEach(function(x){if(x.v>msMax)msMax=x.v;});});
  msMax=Math.max(1,msMax*1.12);
  var X=function(t){return ((t-tMin)/((tMax-tMin)||1))*W;};
  var Y=function(v,ax){var f=(ax==='deg')?(v/360):(v/msMax);
    return pT+(1-Math.max(0,Math.min(1,f)))*(H-pT-pB);};
  var b='';
  for(var g=0;g<=2;g++){var gy=pT+(H-pT-pB)*g/2;
    b+='<line class="grid-l" x1="0" y1="'+gy.toFixed(1)+'" x2="'+W+'" y2="'+gy.toFixed(1)+'"/>';}
  ser.forEach(function(s){
    var d=smoothPath(s.p.map(function(q){return [X(q.t),Y(q.v,s.axel)];}));
    b+='<path d="'+d+'" fill="none" stroke="'+s.farg+'"'+GRAF_LINJE+' '
      +(s.axel==='deg'?' stroke-dasharray="5 4" opacity=".85"':'')+'/>';
    /* v713: ingen slutprick. */});
  /* Riktningen har EGEN axel (0–360°) och får därför sin egen Y — annars hade
     220 grader lästs av som 220 m/s. */
  var svgm='<svg class="chart" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" role="img" aria-label="Vind idag">'+(harMs?nollLinje(Y(0,'ms'),0,W):'')+b+'</svg>';
  svgm=avlLager(cid,svgm,{W:W,H:H,X:X,t0:tMin,t1:tMax,
    ser:ser.map(function(s){var ax=s.axel;
      return {namn:s.namn,farg:s.farg,pts:s.p,
        Y:function(v){return Y(v,ax);},
        fmt:function(v){return (ax==='deg')?(Math.round(v)+'°'):(num(v,1)+' m/s');}};})});
  /* Ingen y-skala längre — varken m/s till vänster eller grader till höger.
     Båda talen står i dragpunktens etikett, var och en i sin egen enhet, och
     grafen får hela bredden. harMs/harDeg styr fortfarande vilka serier som
     ritas och vilken toppskala msMax får. */
  return '<div class="chart-wrap">'+svgm+'</div>'+chips;}
function windInfoTog(){_windInfoOpen=!_windInfoOpen;
  var e=document.getElementById('wind-info');if(e)e.classList.toggle('open',_windInfoOpen);}
/* Ritas om nar Insights svarat, utan att hela popupen byggs pa nytt. */
function windPopupUppdatera(){try{
  var e=document.getElementById('wind-sec');
  if(e)e.innerHTML=windSectionHTML();
}catch(x){}}
function windSectionHTML(){
  var nW=windNowMax('wind'), nG=windNowMax('gust'), dW=windDayMax('wind'), dG=windDayMax('gust');
  var kalla=_windSeries?('Läst ur '+esc((DATA[DEV.windMs]||{}).name||'vindmätaren')+'s logg i Homey Insights.')
           :(_windInsBusy?'Hämtar ur Homey Insights…'
           :(_windInsFel?('Kunde inte läsa Insights ('+esc(_windInsFel)+') – visar egna mätningar.')
           :'Visar egna mätningar.'));
  /* Grafen först. Den är det man öppnar rutan för; sifferraderna är
     uppföljningsfrågor. Den ligger kvar INNE i windSectionHTML så att
     uppdateringen när Insights svarar byter ut både graf och toppvärden
     i ett svep. */
  /* Samma mönster som elrutorna: grafRubrik (skriver ut valt fönster) med
     i-knapp, grafen, tidsval + helskärm. "Idag" byttes ut eftersom fönstret
     nu är valbart och inte alltid är dygnet. */
  return grafRubrik('wind','Vind',infoBlock('vindgraf',
      'Vind och byvind i m/s på huvudskalan, riktning i grader på egen skala. '
      +'Välj vilka som visas i förklaringen under grafen. Dra i grafen för att '
      +'läsa av alla vid en viss tidpunkt.'))
    +'<div id="wind-chart">'+windChartHTML('wind')+'</div>'
    +grafTidsval('wind')
    +'<div class="dsec">Högsta nu <em class="dsec-x">• '+WIND_NU_H+'h</em></div>'
    +windMaxRow('Max vind',nW.v,nW.t,1)
    +windMaxRow('Max by',nG.v,nG.t,1)
    +'<div class="dsec">Högsta idag</div>'
    +windMaxRow('Max vind dygn',dW.v,dW.t,1)
    +windMaxRow('Max by dygn',dG.v,dG.t,1)
    +'<div class="drow drow-t" onclick="windInfoTog()" style="border-bottom:0">'
    +'<span class="dk">Vad visar siffrorna? <span class="di-q">i</span></span></div>'
    +'<div class="drow-info'+(_windInfoOpen?' open':'')+'" id="wind-info">'
    +'<b>Högsta nu</b> är det högsta uppmätta värdet de senaste '+WIND_NU_H+' timmarna – samma '
    +'siffror som står på startsidan. <b>Högsta idag</b> räknar från midnatt. '
    +kalla+' Loggen innehåller hela dygnet, även det som mättes medan dashboarden var stängd. '
    +'I grafen delar vind och byvind vänsteraxeln (m/s). Riktningen har en egen högeraxel '
    +'(0–360°) och ritas streckad – skalorna har inget med varandra att göra, så utan det '
    +'skulle riktningen platta ut hastighetskurvorna.</div>';}
function windMaxRow(namn,v,t,dec){
  return dRow(namn,(v==null?'–':num(v,dec)+' m/s')+'<span style="opacity:.6;font-weight:600"> · '+windWhenTxt(t)+'</span>');}
function pressureTrend(cur){
  if(cur==null)return 0;let log=[];try{log=JSON.parse(localStorage.getItem('pressLog_v1')||'[]');}catch(e){}
  const now=Date.now();if(!_timeActive){log.push({t:now,v:cur});log=log.filter(x=>now-x.t<6*36e5);
  try{localStorage.setItem('pressLog_v1',JSON.stringify(log));}catch(e){}}
  const old=log.find(x=>now-x.t>=2.5*36e5);if(!old)return 0;const d=cur-old.v;return d>0.6?1:d<-0.6?-1:0;}
function forecastPressureTrend(h){if(h==null)return 0;const a=forecastAt(dayStart()+h*3600000),b=forecastAt(dayStart()+(h-2)*3600000);if(!a||!b||a.msl==null||b.msl==null)return 0;const d=a.msl-b.msl;return d>0.5?1:d<-0.5?-1:0;}
function histPressureTrend(h){if(h==null)return 0;const T=dayStart()+h*3600000,a=histValueAt('press',T),b=histValueAt('press',T-2*3600000);if(a==null||b==null)return 0;const d=a-b;return d>0.5?1:d<-0.5?-1:0;}
/* En gemensam väg till vindriktningen: egen vindmätare först, SMHI som reserv. */
/* ===== vind: en enda källa =====
   All vind kommer från VindmätareNet (193d9b83). Den rapporterar i KM/H —
   avläst ur enheten 2026-08-22: measure_wind_strength 25 och
   measure_gust_strength 61, medan SMHI samtidigt sa 6,7 respektive 13,9 m/s.
   25/3,6 = 6,9 och 61/3,6 = 16,9, alltså samma väder i två enheter.
   Dashboarden räknar i m/s överallt, så omräkningen sker här — på ETT ställe,
   inte i varje ruta. Riktningen kommer ur measure_wind_angle i grader och
   översätts till text; den gamla enhetens textfält används inte längre. */
function kmhTillMs(v){return (v==null||!isFinite(v))?null:(v/3.6);}
function msTillKmh(v){return (v==null||!isFinite(v))?null:(v*3.6);}
/* SENSORBRICKORNAS VAG FORBI OMRAKNINGEN.
   En egen bricka pa en enhet och en capability laser rakt ur DATA med cap().
   For vindmataren ar det km/h, men brickan star med m/s i etiketten - alltsa
   ett tal som ar 3,6 ganger for stort under fel enhet. Den har wrappern ligger
   mellan brickan och DATA och rattar just de tva capabilities det galler. */
function capMs(dev,c){
  var v=cap(dev,c);
  return (dev===DEV.windMs&&(c==='measure_wind_strength'||c==='measure_gust_strength'))
    ?kmhTillMs(v):v;
}
function vindMs(live){
  var v=live?capLive(DEV.windMs,'measure_wind_strength'):cap(DEV.windMs,'measure_wind_strength');
  return kmhTillMs(v);}
function byMs(live){
  var v=live?capLive(DEV.windMs,'measure_gust_strength'):cap(DEV.windMs,'measure_gust_strength');
  return kmhTillMs(v);}
function gradTillText(d){
  if(d==null||!isFinite(d))return null;
  var i=Math.round((((d%360)+360)%360)/22.5)%16;
  return VIND_STRECK[i];
}
function windDeg(){var d=cap(DEV.windNet,'measure_wind_angle');
  if(d==null)d=cap(DEV.smhi,'measure_wind_direction_cp');
  return (d!=null&&isFinite(d))?d:null;}
/* Vindriktning i klartext. Det MÄTTA värdet räknas om till väderstreck och
   vinner alltid. windText() läser en fritextcapability på vindmätaren, och
   slutar flowen som skriver den att köra fastnar texten på ett väderstreck
   som sedan visas överallt. Den används därför bara när ingen vinkel finns. */
function windDirTxt(deg){
  var d=(deg===undefined)?windDeg():deg;
  return windAbbr(d)||windText();}
function windText(){
  if(_timeActive)return null;
  /* Ur grader, inte ur ett textfält på den gamla enheten. */
  return gradTillText(cap(DEV.windNet,'measure_wind_angle'));
}
function indoorAvgTemp(){const a=cap(DEV.vard,'measure_temperature'),b=cap(DEV.vader,'measure_temperature');const xs=[a,b].filter(v=>v!=null&&isFinite(v));if(!xs.length)return null;return xs.reduce((s,v)=>s+v,0)/xs.length;}
function gustDesc(g){if(g==null)return '';if(g<8)return 'svaga byar';if(g<11)return 'måttliga byar';if(g<14)return 'friska byar';if(g<17)return 'kraftiga byar';if(g<21)return 'hårda byar';if(g<25)return 'mycket hårda byar';return 'stormbyar';}
function indoorAvgSeries(cid){const a=histV('t_vard',cid),b=histV('t_kok',cid);const out=[];let j=0;
  for(let i=0;i<a.length;i++){const t=a[i].t;while(j<b.length-1&&Math.abs(b[j+1].t-t)<=Math.abs(b[j].t-t))j++;
    if(b.length&&Math.abs(b[j].t-t)<=120000)out.push({t:t,v:(a[i].v+b[j].v)/2});else out.push({t:t,v:a[i].v});}
  return out;}
function fasSakring(){
  var v=CFG&&CFG.huvudsakring;
  return (typeof v==='number'&&isFinite(v)&&v>=6&&v<=100)?v:FAS_DEF;
}
function fasA(n){
  var v=cap(DEV.pulse,'measure_current.L'+n);
  return (v!=null&&isFinite(v))?v:null;
}
function fasAlla(){return [fasA(1),fasA(2),fasA(3)];}
/* Hogsta fasen och hur nara sakringen den ligger. Returnerar null nar Pulse
   inte rapporterar strom alls - da ska ingenting varnas om. */
function fasVarst(){
  var a=fasAlla(),b=null,bi=0;
  for(var i=0;i<3;i++){if(a[i]!=null&&(b==null||a[i]>b)){b=a[i];bi=i+1;}}
  if(b==null)return null;
  return {a:b,fas:bi,kvot:b/fasSakring()};
}
function sakringStep(d){
  var nu=fasSakring(),i=FAS_STEG.indexOf(nu);
  if(i<0){i=0;for(var k=0;k<FAS_STEG.length;k++)if(FAS_STEG[k]<=nu)i=k;}
  i=Math.max(0,Math.min(FAS_STEG.length-1,i+d));
  CFG.huvudsakring=FAS_STEG[i];saveCfg();
  var e=$('sakr-v');if(e)e.textContent=FAS_STEG[i]+' A';
  try{render();}catch(e2){}
}
function fasFarg(kvot){
  if(kvot>=0.9)return 'var(--hot)';
  if(kvot>=0.75)return 'var(--gold)';
  return 'var(--ok,#a3be8c)';
}
/* Staplarna i popupen. En stapel per fas mot sakringens tak, sa att en sned
   belastning syns direkt - tre jamna staplar ser annorlunda ut an en hog. */
function fasHTML(){
  var a=fasAlla(),sak=fasSakring();
  if(a[0]==null&&a[1]==null&&a[2]==null)
    return dRow('Faser','Pulse rapporterar ingen ström');
  var h='';
  for(var i=0;i<3;i++){
    var v=a[i],k=(v==null)?0:v/sak;
    var br=Math.max(0,Math.min(100,k*100));
    h+='<div class="fas-r"><span class="fas-n">L'+(i+1)+'</span>'
      +'<span class="fas-b"><i style="width:'+br.toFixed(0)+'%;background:'+fasFarg(k)+'"></i></span>'
      +'<span class="fas-v" style="color:'+(k>=0.75?fasFarg(k):'var(--dim)')+'">'
      +(v==null?'–':num(v,1)+' A')+'</span></div>';
  }
  return h;
}
/* v759: förklaringen under faserna ligger i en info-knapp vid rubriken. */
function fasInfo(){
  var v=fasVarst();
  return 'Huvudsäkring '+fasSakring()+' A · högsta fasen '
    +(v?('L'+v.fas+' på '+Math.round(v.kvot*100)+' %'):'okänd')
    +'. Ändra säkringen i inställningarna om talet är fel.';
}
function gridPowerSVG(pts,cid){
  cid=cid||'grid';
  const now=Date.now();
  if(!pts||pts.length<3)return '<div class="viz-empty">Samlar in data… grafen fylls på efter hand.</div>';
  /* Fönstret väljs numera (1–24 h) via _grafTim; grafen är 300 enheter bred, så
     ett kortare fönster ger mer plats åt varje timme. Faller tillbaka på de 48
     senaste punkterna om intervallet är för glest. */
  const cut=grafFonster(cid).t0;let seg=pts.filter(p=>p.t>=cut);if(seg.length<3)seg=pts.slice(-48);
  const P=PAL[curTheme]||PAL.dark, BLA=P.blue||'#81a1c1', GRO=P.green||'#a3be8c';
  const W2=300,H2=74,pad=5;
  const t0=seg[0].t,t1=seg[seg.length-1].t||now,tr=(t1-t0)||1;
  // symmetrisk y-skala runt noll så nollinjen hamnar där den ska
  const ys=seg.map(p=>p.v),ylo=Math.min.apply(null,ys),yhi=Math.max.apply(null,ys);
  const amax=Math.max(Math.abs(ylo),Math.abs(yhi),1), y0=-amax, y1v=amax, yr=(y1v-y0)||1;
  const X=t=>pad+(t-t0)/tr*(W2-2*pad), Y=v=>H2-pad-(v-y0)/yr*(H2-2*pad);
  const zeroY=Y(0);
  // bygg en punktlista med insatta nollgenomgångar
  const pl=[];
  for(let i=0;i<seg.length;i++){
    const cur=seg[i]; pl.push({t:cur.t,v:cur.v});
    const nx=seg[i+1];
    if(nx&&((cur.v<0&&nx.v>0)||(cur.v>0&&nx.v<0))){
      const f=Math.abs(cur.v)/(Math.abs(cur.v)+Math.abs(nx.v));
      pl.push({t:cur.t+(nx.t-cur.t)*f, v:0, cross:true});
    }
  }
  /* EN ENDA KURVA, FÄRGAD MED KLIPPMASK.
     Förut ritades varje teckenbyte som en egen smoothPath, och då blev den
     ritade linjen inte samma kurva som en spline genom hela punktlistan —
     avläsningen kunde därför inte räkna fram en punkt som garanterat låg på
     den. Nu läggs samma d ut två gånger, klippt över respektive under
     nollinjen. Bilden är densamma; skillnaden är att det finns EN kurva att
     räkna på. */
  const gpId='gp'+(_grN++);
  const gpD=smoothPath(pl.map(pt=>[X(pt.t),Y(pt.v)]));
  let paths=['<defs>'
    +'<clipPath id="'+gpId+'k"><rect x="0" y="0" width="'+W2+'" height="'+zeroY.toFixed(1)+'"/></clipPath>'
    +'<clipPath id="'+gpId+'s"><rect x="0" y="'+zeroY.toFixed(1)+'" width="'+W2+'" height="'+(H2-zeroY).toFixed(1)+'"/></clipPath>'
    +'</defs>'
    +'<path d="'+gpD+'" fill="none" stroke="'+BLA+'"'+GRAF_LINJE+' clip-path="url(#'+gpId+'k)"/>'
    +'<path d="'+gpD+'" fill="none" stroke="'+GRO+'"'+GRAF_LINJE+' clip-path="url(#'+gpId+'s)"/>'];
  // fyllning per sträcka mot nollinjen
  let fills=[]; let fPts=[], fSign=null;
  const flushF=()=>{ if(fPts.length>=2){const col=fSign>=0?BLA:GRO;const g=areaGrad(col,0.22);
    const area=smoothPath(fPts)+' L'+fPts[fPts.length-1][0].toFixed(1)+' '+zeroY.toFixed(1)+' L'+fPts[0][0].toFixed(1)+' '+zeroY.toFixed(1)+' Z';
    fills.push('<defs>'+g.def+'</defs><path d="'+area+'" fill="url(#'+g.id+')"/>');} };
  for(let i=0;i<pl.length;i++){
    const pt=pl[i], xy=[X(pt.t),Y(pt.v)];
    const sign=pt.v>0?1:pt.v<0?-1:(fSign==null?1:fSign);
    if(fSign==null){fSign=sign;fPts=[xy];}
    else if(pt.cross){fPts.push(xy);flushF();fPts=[xy];fSign=(pl[i+1]&&pl[i+1].v<0)?-1:1;}
    else if(sign!==fSign&&pt.v!==0){fPts.push(xy);flushF();fPts=[xy];fSign=sign;}
    else fPts.push(xy);
  }
  flushF();
  const spanH=Math.round(tr/3600000);
  const pkKop=Math.max(0,yhi), pkSal=Math.max(0,-ylo);
  let svgm='<svg viewBox="0 0 '+W2+' '+H2+'" preserveAspectRatio="none">'
    +fills.join('')
    +nollLinje(zeroY,pad,W2-pad)
    +paths.join('')
    +'</svg>';
  /* Avlast mot seg — de mätvärden kurvan bygger på. pl innehåller dessutom
     inlagda nollgenomgångar, som är uträknade och inte uppmätta. */
  /* pl och inte seg: kurvan ritas genom pl, och avläsningen ska räkna på
     exakt den listan. Nollgenomgångarna i pl är räknade, men de ligger på
     linjen mellan två mätvärden och ändrar inget om vad som mätts. */
  svgm=avlLager(cid,svgm,{W:W2,H:H2,X:X,ser:[{namn:'',pts:pl,Y:Y,
    farg:function(v){return v>=0?BLA:GRO;},
    fmt:function(v){return (v<0?'säljer ':'köper ')+W(Math.abs(v));}}]});
  /* Bara köper/säljer kvar, i SAMMA form som under batterigrafen: .mchart-lg2,
     centrerad, med .mc-sw-färgprick. "Senaste X h" och maxvärdena är borttagna
     — de stod inte under de andra graferna och gjorde raden till en annan sak. */
  return '<div class="viz">'+svgm
    +'<div class="mchart-lg2">'
    +'<span><i class="mc-sw" style="background:'+BLA+'"></i>Köper</span>'
    +'<span><i class="mc-sw" style="background:'+GRO+'"></i>Säljer</span>'
    +'</div></div>';}
/* id: två popupar kan visa samma serie (utetemperaturen finns både i
   väderrutan och i temperaturrutan). Utan skilda id skulle de dela vald punkt.
   Utelämnas det byggs ett av färgnyckel och enhet, som skiljer dem åt i dag. */
/* id fungerar nu också som GRAF-ID: anges det följer grafen tidsvalet och får
   en helskärmsbyggare, precis som histSVG-graferna. Utan id är beteendet
   oförändrat — vädergraferna anropar utan, och de ska inte ändras.
   h är höjden; utelämnad ger den gamla 74. */
function ptsLineSVG(pts,colKey,unit,id,h,titel){const now=Date.now();
  /* ppm och % ritas utan decimal – "838,1 ppm" är falsk precision (v736). */
  const _dc=(unit==='ppm'||unit==='%')?0:1;
  if(id)_grafByggare[id]={titel:titel||'Historik',
    full:function(c){return ptsLineSVG(pts,colKey,unit,c||id,h,titel);}};
  if(!pts||pts.length<3)return '<div class="viz-empty">Samlar in data… grafen fylls på efter hand.</div>';
  const fen=id?grafFonster(id):null;
  const cut=fen?fen.t0:(now-24*3600000);let seg=pts.filter(p=>p.t>=cut);if(seg.length<3)seg=pts.slice(-48);
  const P=PAL[curTheme]||PAL.dark,col=P[colKey]||P.blue,W2=300,H2=(h||74),pad=5;
  const t0=seg[0].t,t1=seg[seg.length-1].t||now,tr=(t1-t0)||1;
  const ys=seg.map(p=>p.v);
  const _sp=yspann(Math.min.apply(null,ys),Math.max.apply(null,ys));
  const ylo=_sp.lo,yhi=_sp.hi,yr=(yhi-ylo)||1;
  const X=t=>pad+(t-t0)/tr*(W2-2*pad),Y=v=>H2-pad-(v-ylo)/yr*(H2-2*pad);
  const P2=seg.map(p=>[X(p.t),Y(p.v)]);
  const line=smoothPath(P2);
  const area=line+' L'+P2[P2.length-1][0].toFixed(1)+' '+(H2-pad)+' L'+P2[0][0].toFixed(1)+' '+(H2-pad)+' Z';
  const g=areaGrad(col,0.28);
  const u=unit||'°C';
  let svgm='<svg viewBox="0 0 '+W2+' '+H2+'" preserveAspectRatio="none"><defs>'+g.def+'</defs>'+nollLinje(nollY(Y,ylo,yhi),pad,W2-pad)+'<path d="'+area+'" fill="url(#'+g.id+')"/><path d="'+line+'" fill="none" stroke="'+col+'"'+GRAF_LINJE+'/></svg>';
  svgm=avlLager(id||('pts-'+colKey+'-'+u),svgm,{W:W2,H:H2,X:X,
    ser:[{namn:'',farg:col,pts:seg,Y:Y,fmt:function(v){return num(v,_dc)+' '+u;}}]});
  return '<div class="viz">'+svgm+'<div class="viz-cap">senaste '+spannTxt(tr)+' · '+num(ylo,_dc)+'–'+num(yhi,_dc)+' '+u+'</div></div>';}
/* v754: FÅR DET PLATS? Väder och vind har var sin halva. På en smal telefon
   med breda värden (−10,8° och 12,4 m/s på 360 px) gick lägst/högst in över
   vindpilen. Krymp då temperatur, vind och stapel TILLSAMMANS (samma
   proportioner, siffrorna förblir lika stora) i steg om 8 %, högst fem gånger –
   men först krymps ikonerna till 80 %.
   Mäter bara när sidan har en layout – i jsdom är allt 0 och inget händer. */
function wxvPassa(rot){
  var k=rot&&rot.querySelector?rot.querySelector('.wx2.wxv'):null;if(!k)return;
  /* Bara raden med talen räknas – underraderna kortas med "…" med flit. */
  var fel=function(){var r=false;k.querySelectorAll('.wxv-halva').forEach(function(h){
    var rad=h.querySelector('.wx2-line');if(!rad||!rad.lastElementChild)return;
    var H=h.getBoundingClientRect(),S=rad.lastElementChild.getBoundingClientRect(),F=rad.firstElementChild.getBoundingClientRect();
    if(H.width>0&&(S.right>H.right-2||F.left<H.left))r=true;});return r;};
  /* Först ikonerna (vädret och vindpilen lika, ned till 80 %), sedan talen. */
  if(fel())k.querySelectorAll('.wx2-ic,.wx-arrow').forEach(function(e){
    var w=parseFloat(e.style.width)||e.getBoundingClientRect().width;if(w){var n=Math.round(w*0.8)+'px';e.style.width=n;e.style.height=n;}});
  for(var i=0;i<5&&fel();i++){
    k.querySelectorAll('.wx2-temp,.wx2-wv,.wx2-hlk').forEach(function(e){
      var f=parseFloat(e.style.fontSize)||parseFloat(getComputedStyle(e).fontSize);if(f)e.style.fontSize=(Math.round(f*0.92*10)/10)+'px';});}
}
function buildWeatherHTML(){
  const sit=cap(DEV.smhi,'measure_weather_situation_cp');
  const tOut=cap(DEV.outdoor,'measure_temperature'),feels=cap(DEV.smhi,'air_temperature_feels_like_cp');
  const wspd=vindMs(),wgust=byMs();
  let wdir=cap(DEV.windNet,'measure_wind_angle');if(wdir==null)wdir=cap(DEV.smhi,'measure_wind_direction_cp');
  const whead=cap(DEV.smhi,'measure_wind_direction_heading_cp');
  const hum=cap(DEV.outdoor,'measure_humidity'),rain=cap(DEV.rain,'measure_rain.24h'),pres=cap(DEV.vader,'measure_pressure')||cap(DEV.smhi,'measure_air_pressure_cp');
  const tr=pressureTrend(pres),trCls=tr>0?'up':tr<0?'down':'steady';
  const wz=szRead('wx'),SZ=(b,o,s)=>Math.max(6,Math.round((b+(o||0)*s)*10)/10);
  const zSL=SZ(8.5,wz.stripL,0.8),zSV=SZ(15,wz.stripV,1),zSI=SZ(11,wz.stripI,1);
  const nI=wz.nowI||0,nV=wz.nowV||0,nT=wz.nowT||0;
  /* v729/v730: temperatur och vind – se wxNumBas. */
  const zWicon=Math.max(20,46+nI*2),zArrow=Math.max(18,40+nI*2),zNum=Math.max(14,Math.round((wxNumBas()+nV*1.6)*10)/10),zNsub=Math.max(8,Math.round((11.5+nT*0.8)*10)/10),zKB=Math.max(8,Math.round((12.5+(wz.nowKB||0)*0.8)*10)/10),zBes=zKB,
    zDir=Math.max(9,Math.round((15+(wz.nowDir||0)*1)*10)/10),zArrColor=ARROW_COLORS[wz.arrowColor||'default']||'var(--blue)';
  const ex=tempExtremes(tOut);
  /* Max vind/by på remsan = högsta de senaste tre timmarna, samma som popupens
     HÖGSTA NU. windExtremes() körs vidare så dygnsminnet hålls uppdaterat. */
  windExtremes(wspd,wgust);
  const wx={w:windNowMax('wind').v, g:windNowMax('gust').v};
  const tIn=indoorAvgTemp(),tUte=cap(DEV.uterum,'measure_temperature');
  const wdir_txt=esc(windDirTxt(wdir)||'');
  /* Byvind och beskrivning i VAR SIN rad, som vädersidan: värde med
     riktning överst, beskrivande text under. Stor begynnelsebokstav — det är en
     egen mening, inte en fortsättning på raden ovanför. */
  const stor=(t2)=>t2?(t2.charAt(0).toUpperCase()+t2.slice(1)):'';
  let wBy='';if(wgust!=null)wBy='By '+num(wgust,0)+' m/s';
  let wsub2='';if(wgust!=null)wsub2=stor(gustDesc(wgust));else if(wspd!=null)wsub2=stor(windDesc(wspd,wgust));
  /* v748: Max vind/by stod i remsan, som är borta – högsta byn (3 h) här. */
  if(wx.g!=null)wsub2+=(wsub2?' · ':'')+'max '+num(wx.g,0);
  /* v753: TVÅ LIKA HALVOR (Markus): väder till vänster, vind till höger, en
     linje emellan. Båda halvorna har samma uppbyggnad – ikon i samma storlek,
     stort tal, en stark rad (Känns / By · riktning), en dämpad rad – och
     innehållet står mitt i sin halva. Dygnets lägsta och högsta sitter nu
     IHOP MED VÄDRET, som en liten stapel direkt efter temperaturen (bara pil
     och färg, blå ned, röd upp), i stället för i en egen mittkolumn. */
  const zIk=Math.max(zWicon,zArrow);
  /* v754: temperatur och vind i SAMMA, något större storlek (Markus), och
     lägst/högst-stapeln skalad från den: två rader med radhöjd 1 ger
     bläckhöjden ≈ 1,73 × stapelns storlek, siffrornas versalhöjd ≈ 0,73 ×
     temperaturens – 0,42 gör dem lika höga (uppmätt i Chromium, se t123). */
  const zNumV=Math.round(zNum*WXV_NUM_SKALA*10)/10,zHl=Math.round(zNumV*WXV_HL_ANDEL*10)/10;
  const hlr=(lab,v,up)=>'<span class="wx2-hl '+(up?'up':'down')+'" title="'+lab+' idag">'
    +'<span class="wx2-hl-ic"'+(up?'':' style="transform:rotate(180deg)"')+'>'+icon('arrow-fat-up')+'</span>'
    +(v==null?'–':num(v,1)+'°')+'</span>';
  let h='<div class="wx2 wxv" data-wxedit="now">';
  /* v766: väderhalvan öppnar väderpopupen med prognosen (vpHTML), som
     vindhalvan öppnar vindpopupen. Lägst/högst-stapeln öppnar fortfarande
     Temperaturer. */
  h+='<div class="wx2-now wxv-halva wx-click" onclick="openDetail(\'weather\')"><span class="wx2-ic" style="width:'+zIk+'px;height:'+zIk+'px">'+icon(wxIcon(sit))+'</span>'
    +'<div class="wx2-now-txt"><div class="wx2-line"><span class="wx2-temp" style="font-size:'+zNumV+'px">'+(tOut==null?'–':num(tOut,1)+'°')+'</span>'
    +'<span class="wx2-hlk wx-click" style="font-size:'+zHl+'px" onclick="event.stopPropagation();openDetail(\'temps\')">'+hlr('Högst',ex.max,true)+hlr('Lägst',ex.min,false)+'</span></div>'
    +'<div class="wx2-by" style="font-size:'+zKB+'px">'+(feels!=null?('Känns<span class="wx2-dir" style="font-size:'+zDir+'px">'+num(feels,0)+'°</span>'):'&nbsp;')+'</div>'
    +'<div class="wx2-sub" style="font-size:'+zNsub+'px">'+esc(sit||'Väder')+'</div></div></div>';
  h+='<span class="wxv-linje" aria-hidden="true"></span>';
  /* v765: vindhalvan öppnar vindpopupen (graf, högsta nu, riktning, SMHI). Förut
     openVader() – men kortet står på Väder-sidan, så trycket gjorde ingenting.
     Popupen nåddes tidigare via Max vind/Max by i remsan, som försvann i v748. */
  h+='<div class="wx2-wind wxv-halva wx-click" onclick="openDetail(\'wind\')">'+windArrow(wdir,zIk,zArrColor)
    +'<div class="wx2-wind-txt"><div class="wx2-line"><span class="wx2-wv" style="font-size:'+zNumV+'px">'+(wspd==null?'–':num(wspd,1)+'<small>m/s</small>')+'</span></div>'
    +'<div class="wx2-by" style="font-size:'+zKB+'px">'+(wBy||wdir_txt?(esc(wBy)
      +(wBy&&wdir_txt?'<span class="wx2-pt">·</span>':'')
      +(wdir_txt?'<span class="wx2-dir" style="font-size:'+zDir+'px">'+wdir_txt+'</span>':'')):'&nbsp;')+'</div>'
    +'<div class="wx2-sub" style="font-size:'+zNsub+'px">'+esc(wsub2)+'</div></div></div>';
  h+='</div>';
  const wcell=(det,label,val,cls,ic,clr,flip)=>'<div class="wx2-cell" onclick="openDetail(\''+det+'\')"><span class="wx2-cl" style="font-size:'+zSL+'px">'+label+'</span><span class="wx2-cv'+(cls?' '+cls:'')+'" style="font-size:'+zSV+'px">'+(ic?'<span class="wx2-ci" style="width:'+zSI+'px;height:'+zSI+'px;color:'+clr+(flip?';transform:rotate(180deg)':'')+'">'+icon(ic)+'</span>':'')+val+'</span></div>';
  /* v748: REGN, TRYCK OCH FUKT som rutor i startsidans stil (renderTiles('vader')
     efter att kortet satts in). Inne och Uterum är borta från Väder-sidan. */
  h+='<div class="grid stats fl-tiles wx2-rutor" id="stats-vader" data-grid="vader"></div>';
  return h;}
/* v731: KOMPAKT VÄDERRAD PÅ STARTSIDAN (Markus val "A · en rad").
   Väder · lägst/högst i mitten · vind längst till höger. Temperatur och vind i
   samma storlek. Hela raden öppnar Väder-sidan, som har kvar det fulla kortet
   (buildWeatherHTML, orört). Solremsan under ligger kvar som förut.
   OBS: buildWeatherHTML kör windExtremes/tempExtremes, som håller dygnsminnet
   för Max vind/by och Lägst/Högst. Startsidan anropar den inte längre, så det
   görs här – annars uppdateras minnet bara när Väder-sidan är öppen. */
function wxrNumBas(){
  if(szMobile())return 22;
  try{if(document.body&&document.body.classList.contains('kiosk'))return 24;}catch(e){}
  return 26;}
function buildWeatherCompactHTML(){
  const sit=cap(DEV.smhi,'measure_weather_situation_cp');
  const tOut=cap(DEV.outdoor,'measure_temperature'),feels=cap(DEV.smhi,'air_temperature_feels_like_cp');
  const wspd=vindMs(),wgust=byMs();
  let wdir=cap(DEV.windNet,'measure_wind_angle');if(wdir==null)wdir=cap(DEV.smhi,'measure_wind_direction_cp');
  windExtremes(wspd,wgust);
  const ex=tempExtremes(tOut);
  const wz=szRead('wx'),arrC=ARROW_COLORS[wz.arrowColor||'default']||'var(--blue)';
  const z=wxrNumBas(),zi=Math.round(z*1.1),za=Math.round(z*0.8);
  const dirTxt=windDirTxt(wdir)||'';
  const by=(wgust!=null?'by '+num(wgust,0):'')+(wgust!=null&&dirTxt?' · ':'')+dirTxt;
  const hl=(v,up)=>'<span class="wxr-hl '+(up?'up':'down')+'"><span class="wxr-hl-ic"'+(up?'':' style="transform:rotate(180deg)"')+'>'+icon('arrow-fat-up')+'</span>'+(v==null?'–':num(v,1)+'°')+'</span>';
  let h='<div class="wxr wx-click" data-wxedit="now" onclick="openVader()" style="--wxr-z:'+z+'px">';
  h+='<div class="wxr-nu"><span class="wxr-ic" style="width:'+zi+'px;height:'+zi+'px">'+icon(wxIcon(sit))+'</span>'
    +'<span class="wxr-v">'+(tOut==null?'–':num(tOut,1)+'°')+'</span>'
    +'<span class="wxr-txt"><span class="wxr-sit">'+esc(sit||'Väder')+'</span>'
    +(feels!=null?'<span class="wxr-sm">känns '+num(feels,0)+'°</span>':'')+'</span></div>';
  h+='<div class="wxr-mitt">'+hl(ex.min,false)+hl(ex.max,true)+'</div>';
  h+='<div class="wxr-vind">'+windArrow(wdir,za,arrC)
    +'<span class="wxr-txt"><span class="wxr-v">'+(wspd==null?'–':num(wspd,1)+'<small>m/s</small>')+'</span>'
    +(by?'<span class="wxr-sm">'+esc(by)+'</span>':'')+'</span></div>';
  h+='</div>';
  return h;}
/* v734: VÄDRET I ENERGIRUBRIKEN (Markus val "5"). Ikon, temperatur och vind
   som en bricka bredvid notisklockan. Tryck öppnar Väder-sidan. Väderkortet på
   startsidan döljs då, och solremsan flyttar in i energipanelen (solIn).
   Väderraden byggs ändå (dold) – den håller dygnsminnet för lägst/högst och
   max vind, som Väder-sidan visar. */
/* v737: PER ENHETSKLASS. Telefonen har vädret i rubriken som standard,
   plattorna (väggplattan och andra) det gamla väderkortet – på den större
   skärmen ryms det och passar bättre. Två nycklar så att ett val på telefonen
   inte flyttar plattans väder, och tvärtom. szMobile() följer "Visa som". */
function wxRubrik(){if(!CFG)return szMobile();
  return szMobile()?(CFG.wxRubrik!==false):(CFG.wxRubrikPl===true);}
function buildWxChipHTML(){
  const sit=cap(DEV.smhi,'measure_weather_situation_cp'),tOut=cap(DEV.outdoor,'measure_temperature'),wspd=vindMs();
  return '<span class="en-wx-ic">'+icon(wxIcon(sit))+'</span><span class="en-wx-t">'+(tOut==null?'–':num(tOut,1)+'°')+'</span>'
    +(wspd==null?'':'<small class="en-wx-v">'+num(wspd,1)+' m/s</small>');}
/* Soluppgång och solnedgång i dag – samma beräkning som solremsan. Webbläsaren
   har svensk lokaltid (det här är dashboarden, inte HomeyScript). */
function wxSolTider(){
  try{var nu=new Date(),sc=solar(nu,CONFIG.LAT,CONFIG.LON,-nu.getTimezoneOffset());
    return {upp:sc.sunrise!=null?hm(sc.sunrise):'–',ned:sc.sunset!=null?hm(sc.sunset):'–'};}
  catch(e){return {upp:'–',ned:'–'};}}
function wxRubrikRita(){
  var pa=wxRubrik();
  try{document.body.classList.toggle('wx-rubrik',pa);}catch(e){}
  var h=$('en-hogra');if(!h||!h.querySelector)return;
  var g=$('en-wxrad');
  if(!pa){if(g&&g.parentNode)g.parentNode.removeChild(g);return;}
  if(!g){g=document.createElement('span');g.id='en-wxrad';g.className='en-wxrad';}
  /* v735: alltid på notisklockans rad, först i gruppen. */
  if(g.parentNode!==h||h.firstChild!==g)h.insertBefore(g,h.firstChild);
  var st=wxSolTider();
  var nyt='<button type="button" class="en-cmp en-wx" id="en-wx" onclick="openVader()" title="Väder i detalj">'+buildWxChipHTML()+'</button>'
    /* v735: upp och ned i SAMMA bricka. */
    +'<button type="button" class="en-cmp en-wx en-sol" id="en-sol" onclick="openVader()" title="Soluppgång och solnedgång">'
    +'<span class="sol-r"><span class="en-wx-ic">'+icon('sun-horizon')+'</span><span class="en-wx-t">'+st.upp+'</span></span>'
    +'<span class="sol-r ned"><span class="en-wx-ic">'+icon('moon')+'</span><span class="en-wx-t">'+st.ned+'</span></span></button>';
  if(g.innerHTML!==nyt)g.innerHTML=nyt;
  wxRubrikPassa();}
function wxRubrikPassa(){
  try{
    var g=$('en-wxrad'),h=$('en-hogra');if(!g||!h||!h.getBoundingClientRect)return;
    var hero=h.parentNode,main=hero&&hero.querySelector?hero.querySelector('.en-hero-main'):null;if(!main)return;
    var bryts=function(){var a=main.getBoundingClientRect(),b=h.getBoundingClientRect(),c=hero.getBoundingClientRect();
      if(!a.height||!b.height)return false;
      return b.top>a.top+a.height*0.5||b.right>c.right+1||b.left<a.right+4;};
    for(var i=0;i<WX_STEG.length;i++){
      g.classList.remove('st1','st2','st3');
      if(WX_STEG[i])WX_STEG[i].split(' ').forEach(function(k){g.classList.add(k);});
      if(!bryts())break;}
  }catch(e){}}
function renderWeather(){const a=$('weather-flow');if(a)a.innerHTML=buildWeatherCompactHTML();renderTiles('weather');
  try{wxRubrikRita();}catch(e){}
  /* v731: startsidan har ingen remsa längre (Inne, Uterum, Lägst … finns på
     Väder-sidan). Töm platsen om en äldre remsa ligger kvar. */
  try{var pl0=$('wx-strip-plats');if(pl0&&pl0.firstChild&&!(a&&a.querySelector('.wx2-strip')))pl0.innerHTML='';}catch(e){}
  /* Flytta remsan sist i panelen, under rutorna. Den byggs i samma html som
     resten — att bygga den separat hade betytt två ställen att hålla i takt. */
  try{
    /* Sök remsan INUTI #weather-flow, inte i hela dokumentet. Vädervyn bygger en
       egen kopia av samma panel, och en bredare sökning drog över DEN remsan
       hit — startsidan fick två och vädervyn tappade sin. */
    var plats=$('wx-strip-plats');
    var strip=a?a.querySelector('.wx2-strip'):null;
    if(strip&&plats&&strip.parentElement!==plats){plats.innerHTML='';plats.appendChild(strip);}
  }catch(e){}
  const fc=cap(DEV.smhi,'forecast_for_cp'),fce=$('wx-fc');if(fce)fce.textContent='SMHI'+(fc?' · '+fc:'');
  /* Väderrutan ändrar höjd när prognostexten byts — mät om. */
}
/* ===== Storleksprofiler: mobil och platta har egna storlekar =====
   Allt ligger kvar i samma konfiguration och synkas till Homey som vanligt, men
   mobilens värden sparas under CFG.mob och används bara när dashboarden körs på
   en telefon. Justerar du på plattan påverkas inte mobilerna, och tvärtom.
   Har mobilen inget eget värde ärvs plattans, tills man ändrar på mobilen. */
function szMobile(){try{var vm=localStorage.getItem('view_mode_v1');
  if(vm==='phone')return true; if(vm==='tablet')return false;}catch(e){}
  return MOBILE;}
/* v730: grundstorlek för väderns temperatur och vind (förut 29 px överallt).
   Mobil 24, kiosk (platta stående) 25, platta liggande 26. */
function wxNumBas(){
  if(szMobile())return 24;
  try{if(document.body&&document.body.classList.contains('kiosk'))return 25;}catch(e){}
  return 26;}
function szRead(name){
  var src=szMobile()?((CFG.mob&&CFG.mob[name])||{}):(CFG[name]||{});
  var ut={},k=SZ_BEHALL[name]||[];
  for(var i=0;i<k.length;i++)if(src[k[i]]!==undefined)ut[k[i]]=src[k[i]];
  return ut;}
function szWrite(name){
  if(szMobile()){CFG.mob=CFG.mob||{};CFG.mob[name]=CFG.mob[name]||{};return CFG.mob[name];}
  CFG[name]=CFG[name]||{};return CFG[name];}
function szClear(name,keys){var b=szWrite(name),k;
  if(keys){for(k=0;k<keys.length;k++)delete b[keys[k]];}
  else{for(k in b)delete b[k];}}
function shortLab(t){
  if(!szMobile()||t==null)return t;
  var k=(''+t).toLowerCase().trim();
  return TILE_ABBR[k]||t;}
function openWxEdit(block){
  /* v727: remsan hade bara storlekar – inget kvar att ställa in där. */
  if(block!=='now'){openSecMove('weather');return;}
  const wzc=szRead('wx');
  let h='<div class="te">';
  {const cur=wzc.arrowColor||'default';
    h+='<div class="cfg-row"><span class="cfg-row-l">Pilfärg</span><div class="cfg-step"><button class="cfg-pm" onclick="wxColorStep(-1)">−</button><span class="cfg-num" id="wxcolnum">'+wxColorLabel(cur)+'</span><button class="cfg-pm" onclick="wxColorStep(1)">+</button></div></div>';
    h+='<div class="cfg-row"><span class="cfg-row-l">Centrera i rutan</span><div class="cfg-step"><button class="cfg-pm" style="width:auto;padding:0 16px" id="wxcenbtn" onclick="wxToggleCenter()">'+(wzc.nowCenter?'På':'Av')+'</button></div></div>';}
  h+='<div class="te-adv" style="margin-top:12px"><button class="te-use" onclick="wxReset(\''+block+'\')">Nollställ</button></div></div>';
  const dlgn=$('dlg');if(dlgn&&dlgn.classList){dlgn.classList.remove('wide');dlgn.classList.add('edit');}
  setT('dlg-title','Väder & vind');setIcon('dlg-ic','gauge');
  const bd=$('dlg-body');if(bd)bd.innerHTML=h;
  const back=$('dlg-back');if(back&&back.classList)back.classList.add('open');dlgTop();}
function wxReset(block){szClear('wx',['arrowColor','nowCenter']);saveCfg();renderWeather();openWxEdit(block);}
function wxToggleCenter(){var w=szWrite('wx');w.nowCenter=!szRead('wx').nowCenter;saveCfg();renderWeather();const b=$('wxcenbtn');if(b)b.textContent=w.nowCenter?'På':'Av';}
/* v727: CFG.en (storlek på talet och texten) läses inte längre – e är alltid
   tomt och funktionen nollar bara inline-stilar som en äldre version satt. */
function applyEnergySize(){const e={};
  const hh=$('house-hero');if(hh&&hh.style){if(e.icon){const z=Math.max(16,28+e.icon*2);hh.style.width=z+'px';hh.style.height=z+'px';}else{hh.style.width='';hh.style.height='';}}
  const setF=(el,base,off,st)=>{if(!el||!el.style)return;el.style.fontSize=off?Math.max(8,Math.round((base+off*st)*10)/10)+'px':'';};
  setF($('en-house'),25,e.val,1.4);
  try{setF(document.querySelector('.en-sub'),10.5,e.text,0.7);}catch(_){}
  setF($('en-self-badge'),12,e.text,0.8);
  setF($('status-text'),11,e.text,0.7);
  setF($('mix-leg'),9.5,e.text,0.7);}
function fmtCal(v){if(v==null)return '–';return (Math.abs(v)>=1000)?String(Math.round(v)):num(Math.round(v*10)/10,1);}
function calibList(){let out='',seen={};
  const push=(label,b)=>{out+='<div class="cal-row"><span class="cal-l">'+esc(label)+'</span><span class="cal-v">'+fmtCal(b.lo)+' – '+fmtCal(b.hi)+'</span><span class="cal-n'+(b.learned?' on':'')+'">'+b.n+(b.learned?' ✓':'')+'</span></div>';};
  const LN={solar:'Sol (W)',price:'Elpris',battflow:'Batteriflöde',gridflow:'Nätflöde'};
  Object.keys(LN).forEach(k=>{try{push(LN[k],learnBand(k));}catch(e){}});
  ['flode','energy','weather'].forEach(g=>{try{gridTiles(g).forEach(cfg=>{const ref=metricRef(cfg);if(!ref)return;const key=metricRefKey(cfg);if(seen[key])return;seen[key]=1;let lbl;try{lbl=(computeMetric(cfg).label)||cfg.key;}catch(e){lbl=cfg.key||key;}push(lbl,learnBandRef(key,ref));});}catch(e){}});
  return out||'<div class="cfg-hint">Inga inlärningsbara värden hittades ännu.</div>';}
function openCalib(){const dlgw=$('dlg');if(dlgw&&dlgw.classList){dlgw.classList.remove('wide');dlgw.classList.remove('edit');}
  setT('dlg-title','Glow-kalibrering');setIcon('dlg-ic','gauge');
  const bd=$('dlg-body');if(bd)bd.innerHTML='<div class="cal-list" id="cal-list">'+calibList()+'</div><div class="cfg-hint">Spannen (låg – hög) lärs in automatiskt från mätdatan. ✓ = tillräckligt med data. Uppdateras var 5:e sekund.</div>';
  const bk=$('dlg-back');if(bk&&bk.classList)bk.classList.add('open');dlgTop();
  if(_calibTimer)clearInterval(_calibTimer);
  _calibTimer=setInterval(()=>{const el=$('cal-list'),back=$('dlg-back');if(!el||!back||!back.classList||!back.classList.contains('open')){clearInterval(_calibTimer);_calibTimer=null;return;}try{el.innerHTML=calibList();}catch(e){}},5000);}
function wxColorLabel(k){const c=ARROW_COLORS[k]||'var(--warm)';return '<span style="width:12px;height:12px;border-radius:3px;background:'+c+';display:inline-block;vertical-align:-1px;margin-right:6px"></span>'+(ARROW_COLOR_NAMES[k]||'Standard');}
function wxColorStep(d){var wb=szWrite('wx');let i=ARROW_COLOR_ORDER.indexOf(szRead('wx').arrowColor||'default');if(i<0)i=0;i=(i+d+ARROW_COLOR_ORDER.length)%ARROW_COLOR_ORDER.length;const k=ARROW_COLOR_ORDER[i];wb.arrowColor=k;saveCfg();renderWeather();const n=$('wxcolnum');if(n)n.innerHTML=wxColorLabel(k);}
function openReportEdit(){
  const rows=[['Tid mellan byten','reportSecs']];
  let h='<div class="te">';
  rows.forEach(r=>{const key=r[1],v=(CFG[key]!=null?CFG[key]:(key==='reportSecs'?6:0));
    const disp=(key==='reportSecs'?v+' s':(v>0?'+':'')+v);
    h+='<div class="cfg-row"><span class="cfg-row-l">'+r[0]+'</span><div class="cfg-step"><button class="cfg-pm" onclick="reportStep(\''+key+'\',-1)">−</button><span class="cfg-num" id="rpnum-'+key+'">'+disp+'</span><button class="cfg-pm" onclick="reportStep(\''+key+'\',1)">+</button></div></div>';});
  h+='</div>';
  const dlgn=$('dlg');if(dlgn&&dlgn.classList){dlgn.classList.remove('wide');dlgn.classList.add('edit');}
  setT('dlg-title','Rapportrad');setIcon('dlg-ic','warning');
  const bd=$('dlg-body');if(bd)bd.innerHTML=h;
  const back=$('dlg-back');if(back&&back.classList)back.classList.add('open');dlgTop();}
function reportStep(key,d){let v=(CFG[key]!=null?CFG[key]:(key==='reportSecs'?6:0))+d;
  if(key==='reportSecs')v=Math.max(2,Math.min(30,v));else v=Math.max(-6,Math.min(12,v));
  CFG[key]=v;saveCfg();
  if(key==='reportSecs')_warnTick=0;else renderWarnRow();
  const n=$('rpnum-'+key);if(n)n.textContent=(key==='reportSecs'?v+' s':(v>0?'+':'')+v);}

/* ---- detaljerad väder-popup (lokal SMHI-enhet, inget internet) ---- */
function buildForecastHTML(){
  const g=k=>cap(DEV.smhi,k);
  const sit=g('measure_weather_situation_cp'),t=g('measure_air_temperature_cp'),feels=g('air_temperature_feels_like_cp'),ftime=g('forecast_for_cp');
  const ws=g('measure_wind_speed_cp'),gust=g('wind_gust_speed_cp'),wd=g('measure_wind_direction_cp'),wh=g('measure_wind_direction_heading_cp');
  const hum=g('measure_relative_humidity_cp'),pres=g('measure_air_pressure_cp'),cloud=g('mean_value_of_total_cloud_cover_cp'),vis=g('horizontal_visibility_cp');
  const prec=g('measure_precipitation_situation_cp'),pint=g('mean_precipitation_intensity_cp'),pmax=g('maximum_precipitation_intensity_cp'),thun=g('measure_thunder_probability_cp');
  const tNow=cap(DEV.outdoor,'measure_temperature');
  let h='<div class="fc-now"><span class="fc-now-ic">'+icon(wxIcon(sit))+'</span><div class="fc-now-t"><div class="fc-now-temp">'+(t==null?(tNow==null?'–':num(tNow,1)+'°'):num(t,1)+'°')+(feels!=null?' <small>känns '+num(feels,0)+'°</small>':'')+'</div><div class="fc-now-sit">'+esc(sit||'–')+'</div></div></div>';
  if(ftime)h+='<div class="fc-time">Prognos för '+esc(ftime)+(tNow!=null?' · ute nu '+num(tNow,1)+'°':'')+'</div>';
  h+='<div class="fc-mid"><div class="fc-wind"><div class="fc-wind-v">'+(ws==null?'–':num(ws,1)+' <small>m/s</small>')+'</div><div class="fc-wind-l">'+(wh?esc(wh):'vind')+(gust!=null?' · by '+num(gust,0)+' m/s':'')+'</div></div>'+windArrow(wd)+'</div>';
  const cell=(lbl,val,ic)=>'<div class="fc-cell"><span class="fc-cell-ic">'+icon(ic)+'</span><div><div class="fc-cell-v">'+val+'</div><div class="fc-cell-l">'+esc(lbl)+'</div></div></div>';
  h+='<div class="fc-grid">'
    +cell('Luftfuktighet',(hum==null?'–':Math.round(hum)+' %'),'drop-half-bottom')
    +cell('Lufttryck',(pres==null?'–':Math.round(pres)+' hPa'),'gauge')
    +cell('Molnighet',(cloud==null?'–':Math.round(cloud)+'/8'),'cloud')
    +cell('Sikt',(vis==null?'–':num(vis,0)+' km'),'cloud-fog')
    +cell('Nederbörd',esc(prec||'–'),'cloud-rain')
    +cell('Intensitet',(pint==null?'–':num(pint,1)+' mm/h'),'cloud-rain')
    +cell('Max regn',(pmax==null?'–':num(pmax,1)+' mm/h'),'umbrella-simple')
    +cell('Åska',(thun==null?'–':Math.round(thun)+' %'),'cloud-rain')
    +'</div>';
  return h;}

/* ---- detalj-popup ---- */
function dRow(k,v){return '<div class="drow"><span class="dk">'+esc(k)+'</span><span class="dv">'+v+'</span></div>';}
function drIkon(t){for(var i=0;i<DR_IK.length;i++)if(DR_IK[i][0].test(t))return DR_IK[i];return [null,'gauge','var(--blue)'];}

function drRuta(el){
  var k=el.children[0],v=el.children[1],dx=el.querySelector(':scope>.dx');
  if(!k||!v||v===dx)return null;
  var q=k.querySelector('.di-q'),kt=(k.textContent||'');
  if(q)kt=kt.slice(0,kt.length-(q.textContent||'').length);
  var ik=drIkon(kt.trim());
  var c=document.createElement('div');
  c.className='kr-c'+(el.classList.contains('drow-t')?' dr-t':'')+(el.getAttribute('data-kl')?' '+el.getAttribute('data-kl'):'');
  if(el.getAttribute('onclick'))c.setAttribute('onclick',el.getAttribute('onclick'));
  c.innerHTML='<span class="kr-ic" style="color:'+(el.getAttribute('data-ikf')||ik[2])+'">'
    +icon(el.getAttribute('data-ik')||ik[1])+'</span><span class="kr-tx"><span class="kr-l"></span><span class="kr-v"></span></span>';
  var l=c.querySelector('.kr-l'),vv=c.querySelector('.kr-v'),tx=c.querySelector('.kr-tx');
  while(k.firstChild)l.appendChild(k.firstChild);
  while(v.firstChild)vv.appendChild(v.firstChild);
  if(dx){var x=document.createElement('span');x.className='kr-x';if(dx.getAttribute('style'))x.setAttribute('style',dx.getAttribute('style'));
    while(dx.firstChild)x.appendChild(dx.firstChild);tx.appendChild(x);}
  return c;
}

/* Gör om alla rader under rot. Följd av rader blir ETT rutnät; en info-ruta
   (.drow-info) som hör till en rad flyttas till efter rutnätet. */
function drRutor(rot){
  if(!rot||!rot.querySelectorAll)return;
  var rader=rot.querySelectorAll('.drow');if(!rader.length){drFordelaAlla(rot);return;}
  var foraldrar=[];
  for(var i=0;i<rader.length;i++){var p=rader[i].parentNode;if(p&&foraldrar.indexOf(p)<0)foraldrar.push(p);}
  foraldrar.forEach(function(par){
    var barn=Array.prototype.slice.call(par.children),grid=null,info=[];
    var stang=function(){if(grid){for(var j=info.length-1;j>=0;j--)grid.parentNode.insertBefore(info[j],grid.nextSibling);}grid=null;info=[];};
    barn.forEach(function(el){
      if(el.classList.contains('drow')){
        var c=drRuta(el);
        if(!c){stang();return;}
        if(!grid){grid=document.createElement('div');grid.className='kr-grid dr-grid';par.insertBefore(grid,el);}
        grid.appendChild(c);par.removeChild(el);
      }else if(el.classList.contains('drow-info')&&grid){info.push(el);}
      else stang();
    });
    stang();
  });
  drFordelaAlla(rot);
}

/* RADFÖRDELNING. Får texten inte plats i halv bredd står rutan ensam och läggs
   sist i sitt rutnät, så att resten kan gå ihop i par. Är resten udda blir tre
   rutor som får plats i en tredjedel en trea; annars står den sista ensam.
   Utan layout (jsdom, dold popup) mäts allt som att det får plats. */
function drPassar(t,sp){
  t.style.gridColumn='span '+sp;
  var e=t.querySelectorAll('.kr-v,.kr-l,.kr-x');
  for(var i=0;i<e.length;i++)if(e[i].scrollWidth>e[i].clientWidth+1)return false;
  return true;}
function drDela(seg){
  var m=seg.length,i;if(!m)return;
  if(m===1){seg[0].style.gridColumn='span 6';return;}
  for(i=0;i<m;i++)seg[i].style.gridColumn='span 3';
  if(m%2===0)return;
  for(i=0;i+3<=m;i+=2){
    if(drPassar(seg[i],2)&&drPassar(seg[i+1],2)&&drPassar(seg[i+2],2)){
      for(var j=0;j<m;j++)seg[j].style.gridColumn=(j>=i&&j<i+3)?'span 2':'span 3';return;}
    seg[i].style.gridColumn=seg[i+1].style.gridColumn=seg[i+2].style.gridColumn='span 3';
  }
  seg[m-1].style.gridColumn='span 6';}
function drFordela(g){
  if(!g.classList.contains('dr-grid'))g.classList.add('dr-grid');
  var t=Array.prototype.slice.call(g.children),hel=[],ovr=[];
  t.forEach(function(x){(drPassar(x,3)?ovr:hel).push(x);});
  drDela(ovr);
  hel.forEach(function(x){x.style.gridColumn='span 6';g.appendChild(x);});}
function drFordelaAlla(rot){
  if(!rot||!rot.querySelectorAll)return;
  var g=rot.querySelectorAll('.dr-grid'+(rot.id==='krpop'||(rot.closest&&rot.closest('#krpop'))?',.kr-grid':''));
  for(var i=0;i<g.length;i++){try{drFordela(g[i]);}catch(e){}}}



/* v198: AI-insikterna (Gemini via Homey-variabel) borttagna. Texterna finns kvar men
   kommer nu alltid fran de lokala heuristikerna - samma regelbaserade sammanfattning
   som forut var reserv nar AI:n inte svarade. weatherInsightIsAI/energyInsightIsAI
   returnerar alltid false sa ikonen blir leaf/lightning, aldrig sparkle. */
function weatherInsight(){return weatherInsightHeuristic();}
function weatherInsightIsAI(){return false;}
function energyInsight(){return energyInsightHeuristic();}
function energyInsightIsAI(){return false;}
function energyInsightHeuristic(){
  const sol=cap(DEV.solar,'measure_power'),house=houseNowW(),grid=cap(DEV.pulse,'measure_power'),bpct=cap(DEV.battery,'measure_battery'),bstate=cap(DEV.battery,'battery_charging_state'),plevel=cap(DEV.tibber,'price_level')||cap(DEV.tibber,'measure_price_level');
  const parts=[];
  if(sol!=null&&house!=null){if(sol>house+300)parts.push('Solöverskott just nu ('+Math.round(sol-house)+' W över förbrukningen).');else if(sol>200&&sol<=house)parts.push('Solen täcker en del av förbrukningen.');}
  if(bstate==='charging'&&bpct!=null)parts.push('Batteriet laddas ('+Math.round(bpct)+' %).');
  else if(bstate==='discharging'&&bpct!=null)parts.push('Batteriet stöttar hemmet ('+Math.round(bpct)+' %).');
  if(grid!=null){if(grid<-200)parts.push('Säljer '+Math.round(Math.abs(grid))+' W till nätet.');else if(grid>200)parts.push('Köper '+Math.round(grid)+' W från nätet.');}
  if(plevel){const pl=(''+plevel).toUpperCase();if(pl.indexOf('EXPENSIVE')>=0||pl.indexOf('VERY_HIGH')>=0||pl.indexOf('HIGH')>=0)parts.push('Dyr el just nu – undvik stora laster.');else if(pl.indexOf('CHEAP')>=0||pl.indexOf('VERY_LOW')>=0||pl.indexOf('LOW')>=0)parts.push('Billig el just nu – bra läge för tunga laster.');}
  if(!parts.length)parts.push('Stabilt energiläge.');
  return parts.slice(0,3).join(' ');}
function weatherInsightHeuristic(){
  const now=Date.now();
  const tr=(arr,hb,md)=>{if(!arr||arr.length<3)return 0;const cur=arr[arr.length-1].v,tgt=now-hb*3600000;let base=null;for(let i=arr.length-1;i>=0;i--){if(arr[i].t<=tgt){base=arr[i].v;break;}}if(base==null)base=arr[0].v;const d=cur-base;return Math.abs(d)<md?0:(d>0?1:-1);};
  const parts=[];
  const pt=tr(HIST['press'],3,0.8);
  if(pt>0)parts.push('Stigande lufttryck – mer stabilt väder på väg.');
  else if(pt<0)parts.push('Fallande lufttryck – ostadigare väder kan vara på väg.');
  const tt=tr(HIST['t_ute'],6,1.5);
  if(tt>0)parts.push('Temperaturen har stigit de senaste timmarna.');
  else if(tt<0)parts.push('Temperaturen har fallit de senaste timmarna.');
  const wt=tr(HIST['wind'],3,1.5);
  if(wt>0)parts.push('Vinden tilltar.');else if(wt<0)parts.push('Vinden mojnar.');
  const g=k=>cap(DEV.smhi,k);
  const thun=g('measure_thunder_probability_cp'),prec=g('measure_precipitation_situation_cp'),pint=g('mean_precipitation_intensity_cp'),cloud=g('mean_value_of_total_cloud_cover_cp');
  if(thun!=null&&thun>=30)parts.push('Förhöjd åskrisk ('+Math.round(thun)+' %).');
  if((prec&&(''+prec).toLowerCase().indexOf('ingen')<0)||(pint!=null&&pint>0.1))parts.push('Nederbörd i prognosen.');
  else if(cloud!=null&&cloud<=2)parts.push('Mestadels klart framöver.');
  if(!parts.length){const sit=g('measure_weather_situation_cp');parts.push('Lugnt och stabilt väderläge'+(sit?' – '+(''+sit).toLowerCase()+'.':'.'));}
  return parts.slice(0,3).join(' ');}
function buildWxWindPopup(){
  const g=k=>cap(DEV.smhi,k);
  const sit=g('measure_weather_situation_cp'),feels=g('air_temperature_feels_like_cp'),ftime=g('forecast_for_cp');
  const tOut=cap(DEV.outdoor,'measure_temperature');
  const wspd=vindMs(),wgust=byMs(),wdir=cap(DEV.windNet,'measure_wind_angle');
  const wh=g('measure_wind_direction_heading_cp'),smhiWs=g('measure_wind_speed_cp');
  const hum=cap(DEV.outdoor,'measure_humidity'),press=cap(DEV.vader,'measure_pressure')||g('measure_air_pressure_cp'),rain=cap(DEV.rain,'measure_rain.24h');
  const cloud=g('mean_value_of_total_cloud_cover_cp'),vis=g('horizontal_visibility_cp'),prec=g('measure_precipitation_situation_cp'),thun=g('measure_thunder_probability_cp');
  const ex=tempExtremes(tOut),wx=windExtremes(wspd,wgust);
  const arr=ARROW_COLORS[szRead('wx').arrowColor]||'var(--blue)';
  const wdt=windDesc(wspd,wgust),wdtC=wdt?wdt.charAt(0).toUpperCase()+wdt.slice(1):'–';
  const dirTxt=(windDirTxt(wdir)||wh||'vind');
  let h='<div class="ww-head">';
  h+='<div class="ww-box"><span class="ww-ic">'+icon(wxIcon(sit))+'</span><div class="ww-bt"><div class="ww-line"><span class="ww-big">'+(tOut==null?'–':num(tOut,1)+'°')+'</span>'+(feels!=null?'<span class="ww-beside">känns <b>'+num(feels,0)+'°</b></span>':'')+'</div><div class="ww-sub">'+esc(sit||'Väder')+'</div></div></div>';
  h+='<div class="ww-div"></div>';
  h+='<div class="ww-box">'+windArrow(wdir,32,arr)+'<div class="ww-bt"><div class="ww-line"><span class="ww-big">'+(wspd==null?'–':num(wspd,1)+'<small>m/s</small>')+'</span>'+(dirTxt?'<span class="ww-dir">'+esc(dirTxt)+'</span>':'')+'</div><div class="ww-sub">'+(wgust!=null?'By '+num(wgust,0)+' m/s · ':'')+esc(wdtC)+'</div></div></div>';
  h+='</div>';
  if(ftime)h+='<div class="fc-time">SMHI-prognos för '+esc(ftime)+'</div>';
  var _isAI=weatherInsightIsAI();h+='<div class="ww-insight"><span class="ww-insight-ic">'+icon(_isAI?'sparkle':'leaf')+'</span>'+'<span>'+esc(weatherInsight())+'</span></div>';
  const pint=g('mean_precipitation_intensity_cp');
  const cell=(lbl,val,ic)=>'<div class="fc-cell"><span class="fc-cell-ic">'+icon(ic)+'</span><div><div class="fc-cell-v">'+val+'</div><div class="fc-cell-l">'+esc(lbl)+'</div></div></div>';
  h+='<div class="fc-grid">'
    +cell('Molnighet',(cloud==null?'–':Math.round(cloud)+'/8'),'cloud')
    +cell('Sikt',(vis==null?'–':num(vis,0)+' km'),'cloud-fog')
    +cell('Nederbörd',esc(prec||'–'),'cloud-rain')
    +cell('Intensitet',(pint==null?'–':num(pint,1)+' mm/h'),'umbrella-simple')
    +cell('Åska',(thun==null?'–':Math.round(thun)+' %'),'cloud-rain')
    +cell('SMHI-vind',(smhiWs==null?'–':num(smhiWs,1)+' m/s'),'wind')
    +'</div>';
  h+='<div class="ww-h">Temperatur · dygn</div>'+ptsLineSVG(HIST['t_ute']||[],'temp','°C');
  h+='<div class="ww-h">Vind · dygn</div>'+ptsLineSVG(HIST['wind']||[],'wind','m/s');
  h+='<div class="ww-h">Lufttryck · dygn</div>'+ptsLineSVG(HIST['press']||[],'press','hPa');
  return h;}
function diTog(id){var e=document.getElementById(id);if(e)e.classList.toggle('open');}
function dRowI(k,v,info){var id='di'+(_diN++);return '<div class="drow drow-t" onclick="diTog(\''+id+'\')"><span class="dk">'+esc(k)+' <span class="di-q">i</span></span><span class="dv">'+v+'</span></div>'+(info?'<div class="drow-info" id="'+id+'">'+esc(info)+'</div>':'');}
function histYears(){const byY={};yearHistGet().forEach(function(y){if(!y||!y.year)return;const forbr=(y.forbr!=null?y.forbr:y.total),sol=(y.sol!=null?y.sol:0);byY[y.year]={year:+y.year,forbr:forbr,sol:sol,kopt:(y.kopt!=null?y.kopt:Math.max(0,(forbr||0)-sol)),sald:(y.sald!=null?y.sald:null),prod:(y.prod!=null?y.prod:null),battOut:(y.battOut||0),partial:!!y.partial,from:y.from};});return Object.keys(byY).map(function(k){return byY[k];}).sort(function(a,b){return b.year-a.year;});}
function yoyText(){const cy=new Date().getFullYear();const cur=SEED_MONTHS.filter(function(m){return m.m.slice(0,4)==String(cy);});if(!cur.length)return null;const mset=cur.map(function(m){return m.m.slice(5);});const prev=SEED_MONTHS.filter(function(m){return m.m.slice(0,4)==String(cy-1)&&mset.indexOf(m.m.slice(5))>=0;});if(!prev.length)return null;const sc=cur.reduce(function(a,m){return a+m.f;},0),sp=prev.reduce(function(a,m){return a+m.f;},0);if(!sp)return null;const diff=Math.round((sc-sp)/sp*100);return {diff:diff,months:mset.length,good:diff<=0,val:(diff<=0?'▼ '+Math.abs(diff)+' %':'▲ '+diff+' %')};}
function curYearData(){const cy=String(new Date().getFullYear());const ms=SEED_MONTHS.filter(function(m){return m.m.slice(0,4)===cy;});if(!ms.length)return null;const sum=function(k){return ms.reduce(function(a,m){return a+(m[k]||0);},0);};return {forbr:sum('f'),sol:sum('so'),kopt:sum('k'),sald:sum('sa'),prod:sum('p'),battOut:sum('b'),lastM:ms[ms.length-1].m};}
function yearAgg(year){var ms=SEED_MONTHS.filter(function(m){return m.m.slice(0,4)===String(year);});if(!ms.length)return null;var sum=function(k){return ms.reduce(function(a,m){return a+(m[k]||0);},0);};return {year:+year,forbr:sum('f'),prod:sum('p'),sol:sum('so'),kopt:sum('k'),sald:sum('sa'),batt:sum('b'),months:ms.length,first:+ms[0].m.slice(5),last:+ms[ms.length-1].m.slice(5)};}
function battKwhGet(){try{var o=JSON.parse(localStorage.getItem(BATTKWH_KEY));if(o&&o.d)return o;}catch(e){}return {d:{},at:null,src:null};}
function battKwhSave(o){try{localStorage.setItem(BATTKWH_KEY,JSON.stringify(o));}catch(e){}}
/* Läser logikvariabeln som HomeyScriptet 'batteri_kwh' skriver: en riktig,
   kontinuerligt integrerad kWh-mätare för batteriurladdning. Finns den, är den
   exaktare än vår egen integrering ur Insights (som medelvärdesbildas per timme).
   Speglar tibKrFetch: slås ihop, skrivs inte över, dygnen gallras. */
async function battKwhFetch(){
  try{
    if(!BASE||CONFIG.DATA_URL)return;
    var list=await logicList(), v=null;
    logicArr(list).forEach(function(x){if(x&&x.name===BATTKWH_VAR)v=x;});
    var o=battKwhGet();
    if(!v){o.src={err:'logikvariabeln '+BATTKWH_VAR+' finns inte – HomeyScriptet har inte körts än'};battKwhSave(o);return;}
    var j=null; try{j=JSON.parse(String(v.value||''));}catch(e){}
    if(!j||!j.d){o.src={err:'kunde inte tolka '+BATTKWH_VAR};battKwhSave(o);return;}
    var pd=o.d||{}, d=Object.assign({},pd,j.d||{});
    var dk=Object.keys(d).sort(); while(dk.length>70)delete d[dk.shift()];
    o.d=d; o.at=j.at||Date.now(); o.src={ok:true,dd:Object.keys(d).length,at:j.at||null};
    battKwhSave(o); render();
  }catch(e){var ox=battKwhGet();ox.src={err:'fel vid läsning: '+(e&&e.message||e)};battKwhSave(ox);}}
/* Batteriets urladdning för ett dygn: HomeyScriptets mätare först (exakt),
   annars vår Insights-integrering (uppskattning). Returnerar {kwh, exakt}. */
function battKwhDay(dk){
  var o=battKwhGet();
  if(o.d&&o.d[dk]!=null)return {kwh:o.d[dk],exakt:true};
  return null;}
function emixGet(){try{var o=JSON.parse(localStorage.getItem(EMIX_KEY));if(o&&o.d)return o;}catch(e){}return {d:{},at:null,batt:'int'};}
function emixSave(o){try{localStorage.setItem(EMIX_KEY,JSON.stringify(o));}catch(e){}}
/* Differens mellan kumulativa matarpunkter, per dygn. Tal luckor och matarbyten. */
function emixMeterDaily(pts){
  var out={}, pe=(pts||[]).slice().sort(function(a,b){return a.t-b.t;});
  for(var i=1;i<pe.length;i++){var d2=pe[i].v-pe[i-1].v;
    if(!(d2>0)||d2>=1e5)continue;
    out[dayKey(new Date(pe[i].t))]=(out[dayKey(new Date(pe[i].t))]||0)+d2;}
  return out;}
/* Integrera negativ effekt (urladdning) till kWh per dygn ur measure_power-serien. */
function emixBattDaily(pts){
  var out={}, pe=(pts||[]).slice().sort(function(a,b){return a.t-b.t;});
  for(var i=1;i<pe.length;i++){
    var dt=(pe[i].t-pe[i-1].t)/3600000;                 /* timmar mellan punkter */
    if(!(dt>0)||dt>6)continue;                           /* lucka: hoppa */
    var wAvg=(pe[i].v+pe[i-1].v)/2;                      /* medeleffekt W */
    if(wAvg>=0)continue;                                 /* laddar/vilar - inte urladdning */
    var kwh=(-wAvg)*dt/1000;
    out[dayKey(new Date(pe[i].t))]=(out[dayKey(new Date(pe[i].t))]||0)+kwh;}
  return out;}
async function emixBackfill(force){
  var o0=emixGet();
  if(!force&&o0.at&&Date.now()-_emixAt<6*36e5)return;
  if(!BASE||CONFIG.DATA_URL)return;
  _emixAt=Date.now();
  try{
    var logs=await homeyGet('/api/manager/insights/log/'); if(!logs)return;
    var series=async function(dev,keys,res){
      var lg=monFindLog(logs,dev,keys); if(!lg)return [];
      var e=await homeyGet('/api/manager/insights/log/'+lg.uri+'/'+lg.id+'/entry?resolution='+res);
      return parseEntries(e);};
    /* last31Days ger timupplosning; racker for dygn och manad hittills */
    /* solen: BARA meter_power.day - en dygnsmatare som nollstalls, sa dygnets max ar
       dygnsproduktionen. INGEN fallback till meter_power (kumulativ livstidsmatare -
       den gav 792 836 kWh). En dygnsproduktion over 200 kWh ar orimlig (19 kWp) och
       kastas som skrap. Om loggen saknas: inga soldygn alls, hellre tomt an fel. */
    var sol=await series(DEV.solar,['meter_power.day'],'last31Days');
    var imp=await series(DEV.pulse,['meter_power.imported','imported'],'last31Days');
    var exp=await series(DEV.pulse,['meter_power.exported','exported'],'last31Days');
    /* batteriet pa finaste mojliga upplosning - measure_power ar momentant, sa glesa
       punkter tappar urladdningspass. Slao ihop flera fonster, tatast vinner. */
    /* v701: Modbus, laddning − urladdning (+ = laddar), som resten av batterihistoriken. */
    var hamtaRes=function(res){return async function(lg){return parseEntries(await homeyGet('/api/manager/insights/log/'+lg.uri+'/'+lg.id+'/entry?resolution='+res));};};
    var bat7=await battNettoHist(logs,hamtaRes('last7Days'));
    var bat1=await battNettoHist(logs,hamtaRes('last24Hours'));
    var bat=[];
    (function(){var seen={};[bat1,bat7].forEach(function(a){(a||[]).forEach(function(pp){
      var kk=pp.t; if(!(kk in seen)){seen[kk]=1;bat.push(pp);}});});
     bat.sort(function(a,b){return a.t-b.t;});})();
    var solDay={};
    (sol||[]).forEach(function(p){var d=dayKey(new Date(p.t));
      if(!(p.v>=0)||p.v>200)return;                    /* skrap eller kumulativ matare */
      if(!(d in solDay)||p.v>solDay[d])solDay[d]=p.v;});
    var impD=emixMeterDaily(imp), expD=emixMeterDaily(exp), batD=emixBattDaily(bat);
    /* Ett dygn duger bara om vi har BADE solproduktion OCH kopt - annars gar mixen inte
       att rakna och 100%-nagot ar en artefakt, inte en sanning. */
    var out={};
    Object.keys(solDay).forEach(function(d){
      var prod=solDay[d], ex=expD[d]||0, kopt=(d in impD)?impD[d]:null, bd=batD[d]||0;
      if(kopt==null)return;                             /* ingen importdata for dygnet - hoppa */
      var egen=Math.max(0,prod-ex);
      /* HomeyScriptets kWh-matare vinner over var egen integrering nar den finns. */
      var bk=battKwhDay(d), battV=bk?bk.kwh:bd, battExakt=bk?true:false;
      out[d]={sol:Math.round(egen*100)/100, kopt:Math.round(kopt*100)/100, batt:Math.round(battV*100)/100, be:battExakt?1:0};});
    var battFunnen=bat.length>1, battDygn=Object.keys(batD).length;
    var o=emixGet(); o.d=Object.assign(o.d||{},out);
    var ks=Object.keys(o.d).sort(); while(ks.length>70)delete o.d[ks.shift()];
    o.at=Date.now(); o.batt={funnen:battFunnen,dygn:battDygn,pts:bat.length}; emixSave(o); render();
  }catch(e){}}
/* Aggregerar emix-dygn till en {sol,batt,kopt,forbr} for ett datumintervall [f,t]. */
function emixAgg(f,t){
  var o=emixGet(), r={sol:0,batt:0,kopt:0}, n=0, exakt=0;
  Object.keys(o.d||{}).forEach(function(d){if(d>=f&&d<=t){var x=o.d[d];r.sol+=x.sol||0;r.batt+=x.batt||0;r.kopt+=x.kopt||0;if(x.be)exakt++;n++;}});
  if(!n)return null;
  r.forbr=r.sol+r.batt+r.kopt; r.n=n; r.live=true; r.battExakt=(exakt===n&&n>0);
  return r;}
function emixHar(){var o=emixGet();return Object.keys(o.d||{}).length>0;}
function periodAgg(year,mset){var ms=SEED_MONTHS.filter(function(m){return m.m.slice(0,4)===String(year)&&mset.indexOf(m.m.slice(5))>=0;});if(!ms.length)return null;var sum=function(k){return ms.reduce(function(a,m){return a+(m[k]||0);},0);};return {forbr:sum('f'),kopt:sum('k'),sald:sum('sa'),prod:sum('p'),sol:sum('so'),batt:sum('b'),first:+ms[0].m.slice(5),last:+ms[ms.length-1].m.slice(5),n:ms.length};}
function yearStats(year){var a=yearAgg(year);if(a)return {year:+year,forbr:a.forbr,prod:a.prod,sol:a.sol,kopt:a.kopt,sald:a.sald,batt:a.batt,partial:a.months<12,first:a.first,last:a.last};var h=histYears().filter(function(y){return y.year===+year;})[0];if(h)return {year:+year,forbr:h.forbr,prod:h.prod,sol:h.sol,kopt:h.kopt,sald:h.sald,batt:h.battOut||0,partial:!!h.partial,first:(h.from?+h.from.slice(5):null),last:null};return null;}
function periodLabel(s){if(!s||s.first==null)return '';return MABBR[s.first-1]+((s.last&&s.last!==s.first)?('–'+MABBR[s.last-1]):'');}
function yearLabel(s,isCur){if(!s)return '';if(isCur)return (s.first!=null?periodLabel(s):'');if(!s.partial)return 'helår';return (s.first!=null?periodLabel(s):'');}
function chartSel(cid,key){var s=_chartSel[cid]=_chartSel[cid]||{};if(s[key])delete s[key];else s[key]=1;applyChartSel(cid);}
function applyChartSel(cid){var el=document.getElementById(cid);if(!el)return;var s=_chartSel[cid]||{},active=Object.keys(s).length>0;
  var ps=el.querySelectorAll('path[data-k]');Array.prototype.forEach.call(ps,function(p){var k=p.getAttribute('data-k'),on=(!active||s[k]),bw=parseFloat(p.getAttribute('data-bw'))||2;if(p.style){p.style.opacity=on?'1':'0.09';}p.setAttribute('stroke-width',(s[k]?(bw+0.8):bw).toFixed(1));});
  var ls=el.querySelectorAll('[data-lk]');Array.prototype.forEach.call(ls,function(it){var k=it.getAttribute('data-lk');if(it.classList){it.classList.toggle('dim',active&&!s[k]);it.classList.toggle('on',!!s[k]);}});}
function niceMax(v){if(v<=0)return 1;var p=Math.pow(10,Math.floor(Math.log10(v))),n=v/p,m=n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10;return m*p;}
function niceMin(v){if(v>=0)return 0;return -niceMax(-v);}
function fmtW(v){var a=Math.abs(v);if(a>=1000)return (v/1000).toFixed(a%1000===0?0:1).replace('.',',')+' kW';return Math.round(v)+' W';}
function fmtKw(v){return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g,'\u00a0');}
/* Y-ETIKETTERNA LÅG FEL. De radades ut jämnt med space-between medan linjerna
   räknades ur värdena — står skalan på t.ex. +6 kW … −2 kW hamnar "0" mitt i
   rutan fast nollinjen ligger på en fjärdedel. Därför såg det ut som att
   förbrukningen gick under noll: kurvan låg rätt, etiketten lög.
   Med skalan angiven placeras varje etikett på exakt samma höjd som sin linje. */
/* dromNoll=true tar bort den vågräta nollinjen. Batterigrafen ber om det:
   där ligger effekten och laddnivån i samma bild, laddnivån på egen 0–100-skala,
   och en kraftig nollinje hörde bara till den ena av dem — den läste som att
   den gällde båda. De vanliga stödlinjerna ritas ändå. */
/* NOLLINJEN, EN OCH SAMMA I ALLA GRAFER (v687). Samma färg (--dim) och
   tjocklek (1) som dygnsgrafens nollinje har haft. Graferna ritade den förut
   på olika sätt — streckad, i --line, eller inte alls. Ritas där noll ligger
   inom skalan; en temperaturgraf på 15–28° får ingen. */
function nollLinje(y,x1,x2){
  if(y==null||!isFinite(y))return '';
  return '<line class="nolli" x1="'+(+x1).toFixed(1)+'" y1="'+y.toFixed(1)+'" x2="'+(+x2).toFixed(1)+'" y2="'+y.toFixed(1)
    +'" stroke="var(--dim)" stroke-width="1" vector-effect="non-scaling-stroke"/>';}
function nollY(Y,lo,hi){return (lo<=0&&hi>=0)?Y(0):null;}
function gridLines(vals,vmin,vmax,H,padT,padB,dromNoll){var g='';vals.forEach(function(v){
  var yy=(H-padB-((v-vmin)/((vmax-vmin)||1))*(H-padT-padB));
  var noll=(Math.abs(v)<1e-9);
  if(noll&&dromNoll)return;
  if(noll){g+=nollLinje(yy,0,300);return;}
  g+='<line x1="0" y1="'+yy.toFixed(1)+'" x2="300" y2="'+yy.toFixed(1)+'" stroke="var(--line)" stroke-width="0.5"/>';});
  return g;}
/* Mjuk kurva (cardinal spline). Kontrollpunktens x-handtag kortas av om det skulle
   sträcka sig förbi nästa punkt – annars viker kurvan bakåt och krullar sig där
   punkterna är ojämnt samplade (luckor i mätdata). Handtagets riktning behålls, så
   kurvan blir exakt densamma som förut överallt där den redan uppförde sig väl. */
function smoothPath(pts){
  if(!pts||!pts.length)return '';
  if(pts.length<2)return 'M'+pts[0][0].toFixed(1)+' '+pts[0][1].toFixed(1);
  var d='M'+pts[0][0].toFixed(1)+' '+pts[0][1].toFixed(1);
  for(var i=0;i<pts.length-1;i++){
    var p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2;
    var dx=p2[0]-p1[0];
    if(!(dx>0)){d+=' L'+p2[0].toFixed(1)+' '+p2[1].toFixed(1);continue;}
    var lim=dx/3;
    var h1x=(p2[0]-p0[0])/6,h1y=(p2[1]-p0[1])/6,s1=1;
    if(h1x<0)s1=0;else if(h1x>lim)s1=lim/h1x;
    var h2x=(p3[0]-p1[0])/6,h2y=(p3[1]-p1[1])/6,s2=1;
    if(h2x<0)s2=0;else if(h2x>lim)s2=lim/h2x;
    d+=' C'+(p1[0]+h1x*s1).toFixed(1)+' '+(p1[1]+h1y*s1).toFixed(1)+' '+(p2[0]-h2x*s2).toFixed(1)+' '+(p2[1]-h2y*s2).toFixed(1)+' '+p2[0].toFixed(1)+' '+p2[1].toFixed(1);
  }
  return d;
}
function areaGrad(col,topOp){var id='grd'+(_grN++);return {id:id,def:'<linearGradient id="'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+col+'" stop-opacity="'+(topOp||0.30)+'"/><stop offset="1" stop-color="'+col+'" stop-opacity="0"/></linearGradient>'};}

/* Övre grafen: sol, förbrukning, batteri – allt i watt, per-timme tidsaxel */
function daySeg(pts){if(!pts||pts.length<3)return null;var now=Date.now(),cut=now-24*3600000;var seg=pts.filter(function(p){return p.t>=cut;});if(seg.length<3)seg=pts.slice(-48);return (seg&&seg.length>=3)?seg:null;}
function glesa(seg,max){
  var tak=max||GLES_MAX;
  if(!seg||seg.length<=tak)return seg;
  var t0=seg[0].t,t1=seg[seg.length-1].t,spann=t1-t0;
  if(!(spann>0))return seg;
  var fack=[],ut=[];
  seg.forEach(function(p){
    var i=Math.min(tak-1,Math.floor((p.t-t0)/spann*tak));
    (fack[i]=fack[i]||[]).push(p);
  });
  fack.forEach(function(grupp){
    if(!grupp||!grupp.length)return;
    var sv=0,st=0;
    grupp.forEach(function(p){sv+=p.v;st+=p.t;});
    ut.push({t:Math.round(st/grupp.length),v:sv/grupp.length});
  });
  /* Ändpunkterna behålls orörda så kurvan börjar och slutar där datan gör. */
  if(ut.length){ut[0]=seg[0];ut[ut.length-1]=seg[seg.length-1];}
  return ut;
}
function avlId(s){return String(s==null?'':s).toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'')||'graf';}
/* X() är linjär i tiden, så två kända punkter ger inversen exakt — ingen egen
   invers behöver skickas in. */
function avlXp(g,t){
  var a=g.X(g.t0),b=g.X(g.t1);
  var ux=(b===a)?a:(a+((t-g.t0)/((g.t1-g.t0)||1))*(b-a));
  if(!isFinite(ux))return 0;
  return Math.max(0,Math.min(100,(ux/(g.W||1))*100));
}
function avlTidAv(g,andel){
  var a=g.X(g.t0),b=g.X(g.t1),ux=andel*(g.W||1);
  if(!(b>a))return g.t0;
  var q=(ux-a)/(b-a);
  return g.t0+Math.max(0,Math.min(1,q))*((g.t1-g.t0)||0);
}
function avlYp(g,s,v){
  var y=s.Y(v);
  if(y==null||!isFinite(y))return null;
  return Math.max(0,Math.min(100,(y/(g.H||1))*100));
}
/* Närmaste RITADE punkt, inte en interpolation. Kurvan går genom punkterna,
   och pricken ska sitta på kurvan. */
function avlPunkt(pts,t){
  var b=null,bd=Infinity;
  if(!pts)return null;
  for(var i=0;i<pts.length;i++){
    var p=pts[i];
    if(!p||p.v==null||!isFinite(p.v))continue;
    var d=Math.abs(p.t-t);
    if(d<bd){bd=d;b=p;}
  }
  return b;
}
function avlLangt(g){return g&&(g.t1-g.t0)>AVL_LANG_MS&&g.t1>1e11;}
function avlDag(t){var q=svDatum(t);return q.d+'/'+q.m;}
function avlDagKl(t){var vd=['mån','tis','ons','tor','fre','lör','sön'][svDatum(t).vd];
  return vd+' '+avlDag(t)+' '+avlKl(t);}
function avlKl(t){
  try{
    if(!_avlKlFmt)_avlKlFmt=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
    return _avlKlFmt.format(new Date(t));
  }catch(e){var d=new Date(t);return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);}
}
function avlText(s,v){
  if(typeof s.fmt==='function')return s.fmt(v);
  return num(v,(s.dec==null)?1:s.dec)+(s.enhet?(' '+s.enhet):'');
}
/* Utgångsläget är den sista punkt som ritades — för en levande graf är det nu.
   Räknas om vid varje anrop så att "nu" är nu och inte den minut grafen
   råkade ritas. */
function avlHem(id){
  var g=_avlGeo[id];if(!g)return null;
  var t=null;
  for(var i=0;i<g.ser.length;i++){
    var pts=g.ser[i].pts,p=pts&&pts.length?pts[pts.length-1]:null;
    if(p&&(t==null||p.t>t))t=p.t;
  }
  return (t==null)?g.t1:t;
}
/* PRICKEN GLIDER LÄNGS KURVAN, DEN HOPPAR INTE MELLAN SAMPEL.
   Två fel i rad ledde hit. Först satt pricken på fingrets x men på närmaste
   sampels y — den lämnade kurvan så fort serien var gles. Sedan låstes hela
   avläsningen vid närmaste sampel, och då satt den visserligen på kurvan men
   ryckte mellan punkterna i stället för att följa fingret.

   Rätt svar är att räkna fram punkten PÅ kurvan vid fingrets x. Alla grafer
   ritas med smoothPath, så avläsningen räknar exakt samma kubiska Bézier med
   exakt samma styrpunkter, i samma bildkoordinater som lades i path-attributet.
   Då kan pricken per konstruktion inte ligga någon annanstans än på linjen. */
function avlBez(a,b,c,d,u){var m=1-u;return m*m*m*a+3*m*m*u*b+3*m*u*u*c+u*u*u*d;}
/* Y är affin i v hos samtliga ritare, så inversen ges exakt av två punkter med
   olika värde. En helt platt serie har bara ett värde att svara med. */
function avlYinv(s,pts,y){
  var a=null,b=null;
  for(var i=0;i<pts.length;i++){
    var q=pts[i];
    if(!q||q.v==null||!isFinite(q.v))continue;
    if(a===null)a=q; else if(q.v!==a.v){b=q;break;}
  }
  if(a===null)return null;
  if(b===null)return a.v;
  var ya=s.Y(a.v),yb=s.Y(b.v);
  if(!isFinite(ya)||!isFinite(yb)||ya===yb)return a.v;
  return a.v+((y-ya)/(yb-ya))*(b.v-a.v);
}
function avlKurva(g,s,t){
  var pts=s.pts,n=pts?pts.length:0;
  if(!n)return null;
  if(n===1)return {x:g.X(pts[0].t),y:s.Y(pts[0].v),v:pts[0].v};
  var tt=Math.max(pts[0].t,Math.min(pts[n-1].t,t));
  var lo=0,hi=n-1;
  while(hi-lo>1){var m=(lo+hi)>>1;if(pts[m].t<=tt)lo=m;else hi=m;}
  var P=function(k){var q=pts[Math.max(0,Math.min(n-1,k))];return [g.X(q.t),s.Y(q.v)];};
  var p0=P(lo-1),p1=P(lo),p2=P(lo+1),p3=P(lo+2);
  var x=g.X(tt), dx=p2[0]-p1[0];
  if(!(dx>0))return {x:p2[0],y:p2[1],v:pts[lo+1].v};
  /* Exakt smoothPath: samma klämning mot dx/3, samma handtag. */
  var lim=dx/3;
  var h1x=(p2[0]-p0[0])/6,h1y=(p2[1]-p0[1])/6,s1=1;
  if(h1x<0)s1=0;else if(h1x>lim)s1=lim/h1x;
  var h2x=(p3[0]-p1[0])/6,h2y=(p3[1]-p1[1])/6,s2=1;
  if(h2x<0)s2=0;else if(h2x>lim)s2=lim/h2x;
  var c1x=p1[0]+h1x*s1,c1y=p1[1]+h1y*s1,c2x=p2[0]-h2x*s2,c2y=p2[1]-h2y*s2;
  /* x(u) är växande: klämningen hindrar styrpunkterna från att hamna utanför
     segmentet. Halveringsmetoden räcker och kan inte missa. */
  var a=0,b=1,u=0.5;
  for(var k=0;k<24;k++){
    u=(a+b)/2;
    if(avlBez(p1[0],c1x,c2x,p2[0],u)<x)a=u;else b=u;
  }
  u=(a+b)/2;
  var y=avlBez(p1[1],c1y,c2y,p2[1],u);
  return {x:x,y:y,v:avlYinv(s,pts,y)};
}
function avlDelar(id){
  var tom={rad:'',graf:''};
  var g=_avlGeo[id];if(!g)return tom;
  var vald=_avlVald[id];if(vald==null)return tom;
  var t=vald, xp=avlXp(g,t), h='', rutor='';
  /* v768: strecket och pricken kläms i PIXLAR, och lika mycket, så att de alltid
     sitter ihop. Förut kläms pricken till 1,6–98,4 % (radien på en 300 px bred
     graf) och strecket till 0,3–99,7 %: på plattan stannade pricken 9 px före
     strecket, och i vindgrafen – som ritar ända ut i kanten – syntes det. 7 px
     är prickens största radie (4,5 px + 2,5 px ring under drag). Strecket är
     1,5 px brett från sin vänsterkant, därav 0,75 px åt vardera hållet. */
  h+='<span class="avl-lin" style="left:clamp(6.25px,'+xp.toFixed(2)+'%,calc(100% - 7.75px))"></span>';
  for(var i=0;i<g.ser.length;i++){
    var s=g.ser[i],p=avlKurva(g,s,t);
    if(!p||p.v==null||!isFinite(p.v)||!isFinite(p.y))continue;
    var yp=Math.max(0,Math.min(100,(p.y/(g.H||1))*100));
    var f=(typeof s.farg==='function')?s.farg(p.v):(s.farg||'var(--ink)');
    /* Pricken är centrerad på sin punkt (translate -50%). Vid NU, som ligger på
       100 %, hamnade halva utanför ritytan – därför klämningen, se strecket. */
    var dx=Math.max(0,Math.min(100,(p.x/(g.W||1))*100));
    h+='<span class="avl-dot" style="left:clamp(7px,'+dx.toFixed(2)+'%,calc(100% - 7px));top:'+yp.toFixed(2)+'%;background:'+f+'"></span>';
    rutor+='<b style="color:'+f+'">'+esc(avlText(s,p.v))+'</b>';
  }
  if(!rutor)return tom;
  /* Nära kanten förankras etiketten i sidan i stället för i mitten, annars
     klipps den — samma regel som pgTagg(). */
  /* FAST PLATS (v685): värdena står alltid till vänster ovanför grafen i
     stället för att följa fingret — de flyttade sig under tummen och var svåra
     att läsa medan man drog. */
  var stil='left:0;right:0';
  var kl=(typeof g.kl==='function')?g.kl(t):(avlLangt(g)?avlDagKl(t):avlKl(t));
  return {rad:'<span class="avl-tag" style="'+stil+'"><i>'+esc(kl)+'</i>'+rutor+'</span>',graf:h};
}
/* Tidsaxeln under grafen. Etiketterna i kanterna förankras i sidan i stället
   för i mitten — annars klipps första och sista klockslaget. */
function avlTidsaxel(g){
  var h='',i,n,t,xp;
  var lagg=function(t){
    var xp=avlXp(g,t);
    var kl=(typeof g.kl==='function')?g.kl(t):(avlLangt(g)?avlDag(t):avlKl(t));
    var kla=(xp<3)?' class="v"':((xp>97)?' class="h"':'');
    h+='<span'+kla+' style="'+((xp<3)?'':((xp>97)?'':'left:'+xp.toFixed(2)+'%'))+'">'+esc(kl)+'</span>';
  };
  if(g.t1>1e11&&typeof hourTicks==='function'){
    /* Riktiga tidsstämplar får hela timmar, inte jämnt utlagda bråkdelar. */
    var xl=hourTicks(g.t0,g.t1);
    for(i=0;i<xl.length;i++)lagg(g.t0+xl[i].frac*(g.t1-g.t0));
  }else{
    /* Månader och timindex: fem jämnt fördelade steg. */
    for(i=0;i<=4;i++)lagg(g.t0+(g.t1-g.t0)*i/4);
  }
  return '<div class="avl-tid">'+h+'</div>';
}
function avlLager(id,svg,geo){
  if(!geo||typeof geo.X!=='function')return svg;
  var ser=[];
  for(var i=0;i<(geo.ser||[]).length;i++){
    var s=geo.ser[i];
    if(s&&typeof s.Y==='function'&&s.pts&&s.pts.length)ser.push(s);
  }
  if(!ser.length)return svg;
  geo.ser=ser;
  if(geo.t0==null){geo.t0=Infinity;for(var a=0;a<ser.length;a++)geo.t0=Math.min(geo.t0,ser[a].pts[0].t);}
  if(geo.t1==null){geo.t1=-Infinity;for(var b=0;b<ser.length;b++)geo.t1=Math.max(geo.t1,ser[b].pts[ser[b].pts.length-1].t);}
  if(!(geo.t1>geo.t0)||!isFinite(geo.t0)||!isFinite(geo.t1))return svg;
  id=avlId(id);
  _avlGeo[id]=geo;
  var v=_avlVald[id];
  if(v==null||v<geo.t0||v>geo.t1)_avlVald[id]=avlHem(id);
  var del=avlDelar(id);
  /* onclick stoppas här: popupen stängs vid tryck utanför, och ett släpp efter
     en dragning får inte bubbla upp och räknas som ett sådant tryck. */
  return '<div class="avl-lager">'
    +'<div class="avl-rad'+(ser.length>2?' tva':'')+'" id="avl-rad-'+id+'">'+del.rad+'</div>'
    +'<div class="avl-graf" id="avl-'+id+'" data-avl="'+id+'"'
    +' onpointerdown="avlNer(event,\''+id+'\')" onpointermove="avlRor(event)"'
    +' onpointerup="avlUpp(event)" onpointercancel="avlUpp(event)"'
    +' onclick="event.stopPropagation()">'
    +svg+'<div class="avl-ovl" id="avl-ovl-'+id+'">'+del.graf+'</div></div>'
    +avlTidsaxel(geo)+'</div>';
}
function avlEl(id){
  try{return (typeof document!=='undefined'&&document.getElementById)?document.getElementById(id):null;}
  catch(e){return null;}
}
/* Ritar om BARA overlayen. Att bygga om grafens HTML under ett pågående drag
   tappar pekfångsten — samma lärdom som pgUppdatera(). */
function avlMala(id){
  var del=avlDelar(id);
  var a=avlEl('avl-ovl-'+id); if(a)a.innerHTML=del.graf;
  var b=avlEl('avl-rad-'+id); if(b)b.innerHTML=del.rad;
}
function avlTid(e,id){
  var g=_avlGeo[id];if(!g)return null;
  var el=avlEl('avl-'+id);
  if(!el||!el.getBoundingClientRect)return null;
  var r=el.getBoundingClientRect();
  if(!r||!r.width)return null;
  return avlTidAv(g,(e.clientX-r.left)/r.width);
}
function avlNer(e,id){
  if(!_avlGeo[id])return;
  _avlDrag={id:id,x0:e.clientX,y0:e.clientY,tagit:false,pid:e.pointerId};
}
function avlRor(e){
  var d=_avlDrag;
  if(!d||!_avlGeo[d.id])return;
  var dx=e.clientX-d.x0,dy=e.clientY-d.y0;
  if(!d.tagit){
    if(Math.abs(dx)<6&&Math.abs(dy)<6)return;
    /* Tydligt lodrätt = rulla sidan. Förut räckte det att första rörelsen var
       lite mer lodrät än vågrät, och då släpptes dragningen. */
    if(Math.abs(dy)>2*Math.abs(dx)){_avlDrag=null;return;}
    d.tagit=true;
    var lg=avlEl('avl-'+d.id);
    if(lg&&lg.classList)lg.classList.add('drar');
    try{if(lg&&lg.setPointerCapture)lg.setPointerCapture(d.pid);}catch(err){}
  }
  var t=avlTid(e,d.id);
  if(t!=null){_avlVald[d.id]=t;avlMala(d.id);}
  /* En dragning ÄR aktivitet. Utan det här stängs popupen mitt i avläsningen. */
  try{dlgIdleReset();}catch(err){}
  if(e&&e.preventDefault)e.preventDefault();
}
function avlUpp(e){
  var d=_avlDrag;_avlDrag=null;
  if(!d)return;
  var lg=avlEl('avl-'+d.id);
  if(lg&&lg.classList)lg.classList.remove('drar');
  /* Släpper man går pricken tillbaka till nu av sig själv, som i prisgrafen.
     Ett stilla tryck flyttar därför ingenting. */
  _avlVald[d.id]=avlHem(d.id);
  avlMala(d.id);
  try{dlgIdleReset();}catch(err){}
  /* En omritning som väntade under dragningen görs nu. */
  if(_avlVantar){_avlVantar=false;
    try{var _gb=$('dlg-back');if(_gb&&_gb.classList&&_gb.classList.contains('open')&&typeof _grafOmRita==='function')_grafOmRita();}catch(err){}
    try{if(_grafFull)grafFullRita();}catch(err){}}
}
/* Batteriets laddnivå ritas som en STRECKAD kurva på egen 0–100-skala: 0 % vid
   nollinjen, 100 % vid grafens tak. Watt och procent har inget gemensamt mått,
   så att lägga dem på samma axel vore att ljuga med en snygg kurva.
   "100 %"-märket i övre högra hörnet är däremot borta — det var det enda som
   skulle bort i v602, och jag tog i mitt förra försök bort hela kurvan.
   Serien skickas in som fonster.pct. Att lägga den i optionsobjektet i stället
   för som ett eget argument gör att battGrafHTML, som inte vill ha någon
   procentkurva, kan låta bli utan att skicka en null-plats. */
function dayChart(series,fonster){
  var cid=(fonster&&fonster.cid)||'g2-day';
  var pctSerie=(fonster&&fonster.pct)||null;
  var dromNoll=!!(fonster&&fonster.dromNoll);
  /* Ett fönster är ett fönster först när det har en tidsgräns. Anropet från
     förbrukning nu skickar bara pct och ska ha dygnsbeteendet. */
  var fen=(fonster&&fonster.t0!=null)?fonster:null;
  /* Med ett fönster ritas exakt det dygnet, även om serien saknar punkter i
     början eller slutet — annars skulle x-axeln krympa till det som råkar
     finnas och två dygn bli osjämförbara. */
  var klipp=function(pts){
    var seg;
    if(!fen)seg=daySeg(pts);
    else{
      if(!pts||!pts.length)return null;
      seg=pts.filter(function(p){return p.t>=fen.t0&&p.t<=fen.t1;});
      if(seg.length<2)return null;
    }
    return seg?glesa(seg):seg;
  };
  var segs=series.map(function(s){return {s:s,seg:klipp(s.pts)};}).filter(function(o){return o.seg;});
  if(!segs.length)return '<div class="viz-empty">'+(fen?'Ingen data för det dygnet.':'Samlar in data… grafen fylls på efter hand.')+'</div>';
  var now=Date.now();
  var t0=fen?fen.t0:Math.min.apply(null,segs.map(function(o){return o.seg[0].t;}));
  var t1=fen?fen.t1:(Math.max.apply(null,segs.map(function(o){return o.seg[o.seg.length-1].t;}))||now);
  var tr=(t1-t0)||1,W=300,H=132,padT=8,padB=6;
  var vs=[];segs.forEach(function(o){o.seg.forEach(function(p){vs.push(p.v);});});
  var vmax=niceMax(Math.max.apply(null,vs)),vmin=niceMin(Math.min.apply(null,vs));
  var X=function(t){return (t-t0)/tr*W;};
  var Y=function(v){return H-padB-((v-vmin)/((vmax-vmin)||1))*(H-padT-padB);};
  var ticks=(vmin<0)?[vmax,0,vmin]:[vmax,vmax/2,0];
  var sel=_chartSel[cid]||{},active=Object.keys(sel).length>0;
  /* Samma stil som jämförelsesidan: mjuk kurva + gradient-yta, inga punkter.
     Ytan läggs på huvudserien (sol) – eller på den serie man valt i förklaringen.
     Basen är nollinjen när skalan går under noll, så batteriets minus inte täcks. */
  var yBase=(vmin<0)?Y(0):(H-padB);
  var defs='',areas='',lines='';
  segs.forEach(function(o){
    var seg=o.seg,pts=seg.map(function(p){return [X(p.t),Y(p.v)];});
    if(pts.length<2)return;
    var line=smoothPath(pts),k=o.s.key,bw=GRAF_LW,on=(!active||sel[k]);
    var fillIt=(active?!!sel[k]:(k==='solar'));
    if(fillIt){
      var g=areaGrad(o.s.col,0.26);defs+=g.def;
      areas+='<path data-k="'+k+'" data-bw="0" d="'+line+' L'+pts[pts.length-1][0].toFixed(1)+' '+yBase.toFixed(1)+' L'+pts[0][0].toFixed(1)+' '+yBase.toFixed(1)+' Z" fill="url(#'+g.id+')" style="opacity:'+(on?1:0.09)+'"/>';
    }
    var attr=' data-k="'+k+'" data-bw="'+bw+'" d="'+line+'" fill="none" stroke-width="'+(sel[k]?(bw+0.8):bw).toFixed(1)+'" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" style="opacity:'+(on?1:0.09)+'"';
    if(o.s.col2&&vmin<0){
      /* TVÅ FÄRGER, EN KURVA — samma knep som elnätsgrafen: samma d ritas två
         gånger, klippt över respektive under nollinjen. Bilden byter färg exakt
         där kurvan korsar noll, och det finns fortfarande EN kurva för
         dragpunkten att räkna på. Bara när skalan går under noll — annars
         finns inget "under" att klippa mot. */
      var kid='dc'+(_grN++), y0=Y(0);
      defs+='<clipPath id="'+kid+'a"><rect x="0" y="0" width="'+W+'" height="'+y0.toFixed(1)+'"/></clipPath>'
        +'<clipPath id="'+kid+'b"><rect x="0" y="'+y0.toFixed(1)+'" width="'+W+'" height="'+(H-y0).toFixed(1)+'"/></clipPath>';
      lines+='<path'+attr+' stroke="'+o.s.col+'" clip-path="url(#'+kid+'a)"/>'
        +'<path'+attr+' stroke="'+o.s.col2+'" clip-path="url(#'+kid+'b)"/>';
    }else{
      lines+='<path'+attr+' stroke="'+o.s.col+'"/>';
    }
  });
  /* Avläsningen läser mot SAMMA glesade segment som ritades, och bara mot de
     linjer som faktiskt syns — är en linje bortvald i förklaringen ska den
     inte heller stå i etiketten. */
  var avlSer=[];
  segs.forEach(function(o){
    if(active&&!sel[o.s.key])return;
    avlSer.push({namn:o.s.label,pts:o.seg,Y:Y,fmt:(o.s.fmt||fmtW),
      farg:o.s.col2?(function(c1,c2){return function(v){return v<0?c2:c1;};})(o.s.col,o.s.col2):o.s.col});
  });
  /* Laddnivån: egen skala med nollinjen som 0 % och grafens tak som 100 %.
     Streckad för att inte kunna förväxlas med watt-kurvorna. Inget märke i
     hörnet — siffran står i dragpunktens etikett när man pekar. */
  var pctLinje='';
  if(pctSerie&&pctSerie.pts&&pctSerie.pts.length){
    var pseg=klipp(pctSerie.pts);
    if(pseg&&pseg.length>1){
      var Y0=(vmin<0)?Y(0):(H-padB);
      var YP=function(v){return Y0-(Math.max(0,Math.min(100,v))/100)*(Y0-padT);};
      var ppts=pseg.map(function(q){return [X(q.t),YP(q.v)];});
      var pk=pctSerie.key,pon=(!active||sel[pk]);
      pctLinje='<path data-k="'+pk+'" data-bw="1.6" d="'+smoothPath(ppts)+'" fill="none" stroke="'+pctSerie.col
        +'" stroke-width="'+(sel[pk]?2.4:1.6)+'" stroke-dasharray="4 3" stroke-linejoin="round" stroke-linecap="round"'
        +' vector-effect="non-scaling-stroke" style="opacity:'+(pon?0.95:0.09)+'"/>';
      /* EGEN Y i avläsningen — annars hade 62 % lästs av som 62 watt. */
      if(pon)avlSer.push({namn:pctSerie.label,farg:pctSerie.col,pts:pseg,Y:YP,
        fmt:function(v){return Math.round(Math.max(0,Math.min(100,v)))+' %';}});
      segs.push({s:pctSerie,seg:pseg});     /* bara för förklaringen under grafen */
    }
  }
  var svg='<svg viewBox="0 0 '+W+' '+H+'" class="mchart" preserveAspectRatio="none"><defs>'+defs+'</defs>'+gridLines(ticks,vmin,vmax,H,padT,padB,dromNoll)+areas+lines+pctLinje+'</svg>';
  svg=avlLager(cid,svg,{W:W,H:H,X:X,t0:t0,t1:t1,ser:avlSer});
  var lg='<div class="mchart-lg2">'+segs.map(function(o){var k=o.s.key;return '<span data-lk="'+k+'"'+(sel[k]?' class="on"':(active?' class="dim"':''))+' onclick="chartSel(\''+cid+'\',\''+k+'\')"><i class="mc-sw" style="background:'+(o.s.col2?('linear-gradient(90deg,'+o.s.col+' 50%,'+o.s.col2+' 50%)'):o.s.col)+'"></i>'+esc(o.s.label)+'</span>';}).join('')+'</div>';
  return '<div class="g2" id="'+cid+'"><div class="g2-main"><div class="g2-plot">'+svg+'</div></div>'+lg+'</div>';
}
function hourTicks(t0,t1){
  var spanH=(t1-t0)/3600000,step=Math.max(1,Math.ceil(spanH/6)),out=[];
  /* Mer än två dygn: etiketter vid svenska midnätter, högst sex stycken. */
  if(spanH>48){
    var dagar=Math.ceil(spanH/24),ds=Math.max(1,Math.ceil(dagar/6)),q=svDatum(t0);
    var dag=svMidnatt(q.y,q.m,q.d);if(dag<t0)dag=svMidnatt(q.y,q.m,q.d+1);
    var d0=svDatum(dag);
    for(var k=0;k<40&&out.length<8;k++){
      var tt=svMidnatt(d0.y,d0.m,d0.d+k*ds);if(tt>t1)break;
      out.push({frac:(tt-t0)/((t1-t0)||1),label:avlDag(tt)});}
    if(out.length)return out;
  }
  var d0=new Date(t0);var start=new Date(d0);start.setMinutes(0,0,0);if(start.getTime()<t0)start=new Date(start.getTime()+3600000);
  var fmt=function(t){try{return new Intl.DateTimeFormat('sv-SE',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Stockholm',hour12:false}).format(new Date(t));}catch(e){var d=new Date(t);return ('0'+d.getHours()).slice(-2)+':00';}};
  var startH=start.getHours();var firstH=startH-(startH%step);var cur=new Date(start);cur.setHours(firstH);if(cur.getTime()<t0)cur=new Date(cur.getTime()+step*3600000);
  for(var i=0;i<12;i++){var tt=cur.getTime();if(tt>t1)break;out.push({frac:(tt-t0)/((t1-t0)||1),label:fmt(tt)});cur=new Date(cur.getTime()+step*3600000);}
  if(!out.length)out=[{frac:0,label:fmt(t0)},{frac:1,label:fmt(t1)}];
  return out;
}

/* Nedre graferna: 3-års överlägg per månad – samma stil, kWh-axel, klickbar highlight */
function yearOverlayChart(key,colMap,cid){
  var all=[];SEED_MONTHS.forEach(function(m){var y=+m.m.slice(0,4);if(all.indexOf(y)<0)all.push(y);});all.sort(function(a,b){return b-a;});
  var years=all.slice(0,3).sort(function(a,b){return a-b;});
  if(!years.length)return '';
  var cy=new Date().getFullYear();
  var W=300,H=142,padT=10,padB=6,maxV=1;
  var lfm=lastFullMonth();
  var byYear=years.map(function(yr){var vals=[];for(var mo=1;mo<=12;mo++){var mm=(mo<10?'0':'')+mo,rec=null;if(!(yr===cy&&mo>lfm)){for(var i=0;i<SEED_MONTHS.length;i++){if(SEED_MONTHS[i].m===yr+'-'+mm){rec=SEED_MONTHS[i];break;}}}var v=rec?rec[key]:null;if(v!=null&&v>maxV)maxV=v;vals.push(v);}return {year:yr,vals:vals};});
  var vmax=niceMax(maxV);
  var x=function(mo){return ((mo-1)/11)*W;};
  var y=function(v){return H-padB-(v/vmax)*(H-padT-padB);};
  var ticks=[vmax,vmax/2,0];
  function pathPts(vals){var pts=[];for(var i=0;i<12;i++){if(vals[i]!=null)pts.push([x(i+1),y(vals[i])]);}return pts;}
  var sel=_chartSel[cid]||{},active=Object.keys(sel).length>0;
  var defs='',body='';
  byYear.forEach(function(o){var col=colMap[o.year]||'var(--dim)',isC=(o.year===cy),k=''+o.year,on=(!active||sel[k]);var pts=pathPts(o.vals);if(pts.length<2)return;var line=smoothPath(pts),bw=isC?(GRAF_LW+0.8):GRAF_LW;
    if((isC||sel[k])&&on){var g=areaGrad(col,0.26);defs+=g.def;var area=line+' L'+pts[pts.length-1][0].toFixed(1)+' '+(H-padB)+' L'+pts[0][0].toFixed(1)+' '+(H-padB)+' Z';body+='<path d="'+area+'" fill="url(#'+g.id+')"/>';}
    body+='<path data-k="'+k+'" data-bw="'+bw+'" d="'+line+'" fill="none" stroke="'+col+'" stroke-width="'+(sel[k]?(bw+0.8):bw).toFixed(1)+'" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" style="opacity:'+(on?1:0.09)+'"/>';});
  /* AVLÄSNINGSPUNKT ÄVEN HÄR. x-axeln är månad 1–12 och inte epoktid, så
     modulen får en egen etikettformaterare — samma sak som prognosrutans
     timindex. Bara år med en ritad kurva kommer med; ett år utan data ska
     inte stå i etiketten med ett tomt värde. */
  var avlSer=[];
  byYear.forEach(function(o){
    var k=''+o.year;
    if(active&&!sel[k])return;
    var pts=[];
    for(var i=0;i<12;i++)if(o.vals[i]!=null)pts.push({t:i+1,v:o.vals[i]});
    if(pts.length<2)return;
    avlSer.push({namn:k,farg:(colMap[o.year]||'var(--dim)'),pts:pts,Y:y,
      fmt:function(v){return fmtKw(v)+' kWh';}});
  });
  var svg='<svg viewBox="0 0 '+W+' '+H+'" class="mchart" preserveAspectRatio="none"><defs>'+defs+'</defs>'+gridLines(ticks,0,vmax,H,padT,padB)+body+'</svg>';
  svg=avlLager(cid,svg,{W:W,H:H,X:x,t0:1,t1:12,ser:avlSer,
    kl:function(mo){return MABBR[Math.max(0,Math.min(11,Math.round(mo)-1))];}});
  var lg='<div class="mchart-lg2">'+byYear.map(function(o){var col=colMap[o.year]||'var(--dim)',isC=(o.year===cy),k=''+o.year;return '<span data-lk="'+k+'"'+(sel[k]?' class="on"':(active?' class="dim"':(isC?' class="cur"':'')))+' onclick="chartSel(\''+cid+'\',\''+k+'\')"><i class="mc-sw" style="background:'+col+';height:'+(isC?4:3)+'px"></i>'+o.year+'</span>';}).join('')+'</div>';
  return '<div class="g2" id="'+cid+'"><div class="g2-main"><div class="g2-plot">'+svg+'</div></div>'+lg+'</div>';
}
/* v196: fyra globala knappar i stallet for tre. De styr BADE arsjamforelserna och
   kronorutan - forut hade kronorutan en egen rad, och tva periodrader pa samma sida
   gick inte att lasa ihop.
   Ingen knapp passar bada rutorna perfekt, och det ska sagas rakt ut i stallet for
   att doljas: DAG finns inte i arsdatan (SEED_MONTHS ar manadsvis), och NU ar samma
   sak som AR for kronorutan (dess "i ar" raknas redan fram till i dag). Bada fallen
   skriver ut en rad i den ruta det galler. */
/* Ar-mot-ar-lagena mappas till metricDiff-strangarna. 'ytd' = year to date. */
function aoaDiffMode(){return _aoaMode==='total'?'total':(_aoaMode==='ytd'?'period':'wholemonth');}
function cmpAr(){return aoaDiffMode();}
function cmpKr(){return _krMode;}
/* mixens interna lagen: day, month(=denna manad hittills), months(=aret per manad), year */
function cmpMix(){return {day:'dayLive',month:'monthTD',months:'months',year:'year'}[_mixMode]||'monthTD';}
/* Perioden ar global for jamforsidan sedan v194. Forut satt knapparna nere i "Ar mot
   ar" och styrde bara den rutan - Energimix visade alltid helar. Tva rutor pa samma
   sida med olika period gar inte att lasa ihop. */
function mixModeSet(m){_mixMode=m;try{localStorage.setItem('mixmode_v2',m);}catch(e){}renderCompare();}
function aoaModeSet(m){_aoaMode=m;try{localStorage.setItem('aoamode_v2',m);}catch(e){}renderCompare();}
function krModeSet(m){_krMode=m;try{localStorage.setItem('krmode_v2',m);}catch(e){}renderCompare();}
/* En knapprad for en enskild ruta: lista [val,namn], aktivt val, setter-funktionsnamn. */
function cmpSeg(modes,cur,setter){
  var P=(PAL&&PAL[curTheme])||{}, BC=(P.blue||'#81a1c1');
  return '<div class="cmp-seg">'+modes.map(function(m){
    var on=(cur===m[0]);
    var st=on?('background:'+BC+';border-color:'+BC+';color:#20242c'):('background:transparent;border-color:'+BC+';color:'+BC);
    return '<button class="cmp-mbtn" style="'+st+'" onclick="'+setter+'(\''+m[0]+'\')">'+esc(m[1])+'</button>';
  }).join('')+'</div>';}
function iqBtn(info){var id='di'+(_diN++);return {btn:' <span class="di-q" onclick="diTog(\''+id+'\')">i</span>',box:(info?'<div class="drow-info" id="'+id+'">'+esc(info)+'</div>':'')};}
/* Samma sak men UTAN esc(). Bara för innehåll som byggs här i koden — infotexten
   för Zambretti rymmer knappar, och de kan inte bo bakom en escape. */
function iqBtnHtml(html){var id='di'+(_diN++);
  return {btn:' <span class="di-q" onclick="diTog(\''+id+'\')">i</span>',
          box:(html?('<div class="drow-info" id="'+id+'">'+html+'</div>'):'')};}
function cmpHeadHtml(title,sub,html){
  var q=iqBtnHtml(html);
  return '<div class="cmp-ph"><span class="cmp-ph-s">'+q.btn+'</span>'+
    '<div class="ww-h">'+title+(sub?' <span style="color:var(--faint);font-weight:600;text-transform:none;letter-spacing:0">· '+sub+'</span>':'')+'</div>'+
    '<span class="cmp-ph-s"></span></div>'+q.box;}
function donutSVG(segs,total,yearLbl,partial){
  var r=38,cx=50,cy=50,sw=13,gap=2.2;
  var tot=total||segs.reduce(function(a,s){return a+(s.val||0);},0)||1;
  function polar(ang){var a=(ang-90)*Math.PI/180;return [cx+r*Math.cos(a),cy+r*Math.sin(a)];}
  var body='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="var(--inset)" stroke-width="'+sw+'"/>';
  var ang=0;
  segs.forEach(function(s){var frac=(s.val||0)/tot;if(frac<=0)return;var a0=ang*360,a1=(ang+frac)*360;var g=Math.min(gap,(a1-a0)/2);var s0=polar(a0+g),s1=polar(a1-g);var large=((a1-g)-(a0+g))>180?1:0;body+='<path d="M'+s0[0].toFixed(2)+' '+s0[1].toFixed(2)+' A'+r+' '+r+' 0 '+large+' 1 '+s1[0].toFixed(2)+' '+s1[1].toFixed(2)+'" fill="none" stroke="'+s.col+'" stroke-width="'+sw+'" stroke-linecap="round"/>';ang+=frac;});
  var ctr='<text x="'+cx+'" y="'+(cy-1)+'" text-anchor="middle" font-size="15" font-weight="800" fill="var(--ink)">'+String(Math.round(tot)).replace(/\B(?=(\d{3})+(?!\d))/g,'\u00a0')+'</text><text x="'+cx+'" y="'+(cy+11)+'" text-anchor="middle" font-size="7.5" fill="var(--faint)">kWh</text>';
  return '<div class="donut-cell"><svg viewBox="0 0 100 100" class="donut">'+body+ctr+'</svg><div class="donut-y">'+yearLbl+(partial?' <span class="donut-p">delår</span>':'')+'</div></div>';
}
/* Panelhuvud på jämförelsesidan: info-knapp uppe till vänster, rubriken centrerad.
   Den tomma högerbrickan gör att rubriken hamnar optiskt mitt i panelen. */
function cmpHead(title,sub,info){
  var q=iqBtn(info);
  return '<div class="cmp-ph"><span class="cmp-ph-s">'+q.btn+'</span>'+
    '<div class="ww-h">'+title+(sub?' <span style="color:var(--faint);font-weight:600;text-transform:none;letter-spacing:0">· '+sub+'</span>':'')+'</div>'+
    '<span class="cmp-ph-s"></span></div>'+q.box;
}
function renderCompare(){
  var el=$('cmp-body');if(!el)return;
  _diN=0;
  /* Medeleffekten hör hemma här, bland de andra jämförelserna över tid — inte
     bland insikterna, som handlar om nuläget. */
  effHamta().then(function(j){var e3=$('cmp-body');
    if(j&&e3&&!e3.dataset.eff){e3.dataset.eff='1';renderCompare();}});
  var P=(PAL&&PAL[curTheme])||{};
  var cy=new Date().getFullYear();
  var yc={};yc[cy]=(P.warm||'#d08770');yc[cy-1]=(P.green||'#a3be8c');yc[cy-2]=(P.blue||'#81a1c1');
  var mt=CMPM.filter(function(m){return m.mk===_cmpKey;})[0]||CMPM[0];
  var nK=function(v){return v==null?'–':String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g,'\u00a0');};
  var h='';
  // Ytdiagram per månad (färg per år)
  h+='<section class="panel">';
  h+=cmpHead('Per månad',esc(mt.label.toLowerCase())+' · kWh','Varje år ritas som en egen kurva, månad för månad. Innevarande månad kommer med först när den är avslutad – annars skulle en halv månad se ut som ett fall. Välj värde med knapparna och tryck på ett år i förklaringen för att lyfta fram det.');
  h+='<div class="cmp-seg">'+CMPM.map(function(m){var mc=(P[m.pk]||m.col),on=(m.mk===_cmpKey);var st=on?('background:'+mc+';border-color:'+mc+';color:#20242c'):('background:transparent;border-color:'+mc+';color:'+mc);return '<button class="cmp-mbtn" style="'+st+'" onclick="_cmpKey=\''+m.mk+'\';renderCompare()">'+esc(m.label.split(' ')[0])+'</button>';}).join('')+'</div>';
  h+=yearOverlayChart(mt.mk, yc, 'cmp-chart');
  h+='</section>';
  h+=kronorPanel();   /* kopt/salt over energimixen */
  // Energimix (100%-staplar) - egen knapprad per ruta (v199)
  var SOLC=(P.sun||'#ebcb8b'),BATC=(P.cyan||'#88c0d0'),KOPC=(P.warm||'#d08770');
  var mix=cmpMix(), cyM=String(cy);
  var mkNow=dayKey().slice(0,7).slice(5);
  function monthsUpTo(){var out=[];for(var i=1;i<=+mkNow;i++)out.push((i<10?'0':'')+i);return out;}
  var rows=[], mixTit='', partialTag=false, _emixLive=false, mixBatt=false;
  if(mix==='year'){
    /* Hela år: i år (delår) mot de två föregående hela åren. */
    [cy-2,cy-1,cy].forEach(function(y){var st=yearStats(y);if(st)rows.push([String(y)+(y===cy?' hittills':''),st,y]);});
    mixTit='hela år';
  }else if(mix==='months'){
    /* Året per månad: varje månad i år som egen stapel. */
    monthsUpTo().forEach(function(mm){var st=periodAgg(cy,[mm]);if(st)rows.push([MABBR[+mm-1],st,cy]);});
    mixTit=cyM+' månad för månad';
  }else if(mix==='dayLive'){
    /* I dag: dagens egna mix ur Insights, mot i går. Faller tillbaka på månaden
       hittills om Insights inte fyllt på (t.ex. demoläge). */
    var eDag=emixAgg(dayKey(),dayKey());
    if(eDag){
      var eIgar=emixAgg(dayKeyAgo(1),dayKeyAgo(1)); if(eIgar)rows.push(['I går',{forbr:eIgar.forbr,sol:eIgar.sol,batt:eIgar.batt,kopt:eIgar.kopt},cy-1]);
      rows.push(['I dag',{forbr:eDag.forbr,sol:eDag.sol,batt:eDag.batt,kopt:eDag.kopt},cy]);
      mixTit='i dag hittills'; _emixLive=true; mixBatt=true;
    }else{
      [cy-2,cy-1].forEach(function(y){var s2=periodAgg(y,[mkNow]);if(s2)rows.push([MABBR[+mkNow-1]+' '+y,s2,y]);});
      var st=periodAgg(cy,[mkNow]);
      if(st)rows.push([MABBR[+mkNow-1]+' i år',st,cy]);
      mixTit='i dag saknas i historiken – visar '+MABBR[+mkNow-1]+' hittills';
    }
    partialTag=true;
  }else{ /* monthTD: Denna månad hittills - live om möjligt, mot samma månad tidigare år */
    /* ORDNING: aldst forst (2024, 2025, i ar) - samma som Hela ar och Aret per manad. */
    [cy-2,cy-1].forEach(function(y){var s2=periodAgg(y,[mkNow]);if(s2)rows.push([MABBR[+mkNow-1]+' '+y,s2,y]);});
    var eMon=emixAgg(cy+'-'+mkNow+'-01',dayKey());
    if(eMon){
      rows.push([MABBR[+mkNow-1]+' i år',{forbr:eMon.forbr,sol:eMon.sol,batt:eMon.batt,kopt:eMon.kopt},cy]);
      _emixLive=true; mixBatt=true;
    }else{var st=periodAgg(cy,[mkNow]);if(st)rows.push([MABBR[+mkNow-1]+' i år',st,cy]);}
    mixTit=MABBR[+mkNow-1]+' hittills, mot tidigare år';
    partialTag=true;
  }
  h+='<section class="panel">';
  mixNoteBygg([yearStats(cy-2),yearStats(cy-1),yearStats(cy)],cy);
  h+=cmpHead('Energimix','andel av förbrukning · '+mixTit,mixInfo());
  h+=cmpSeg(MIX_MODES,_mixMode,'mixModeSet');
  rows.forEach(function(r){
    var y=r[0], st=r[1]; if(!st)return;
    var tot=(st.sol||0)+(st.batt||0)+(st.kopt||0)||1;
    var pS=Math.round((st.sol||0)/tot*100), pB=Math.round((st.batt||0)/tot*100), pK=100-pS-pB;
    h+='<div class="sb-row"><div class="sb-head"><span class="sb-y">'+esc(y)+'</span>'
      +'<span class="sb-tot">'+nK(st.forbr)+' kWh</span></div>';
    h+='<div class="sb-bar">'
      +(pS>0?'<div class="sb-seg" style="width:'+pS+'%;background:'+SOLC+'">'+(pS>=9?pS+'%':'')+'</div>':'')
      +(pB>0?'<div class="sb-seg" style="width:'+pB+'%;background:'+BATC+'">'+(pB>=9?pB+'%':'')+'</div>':'')
      +(pK>0?'<div class="sb-seg" style="width:'+pK+'%;background:'+KOPC+'">'+(pK>=9?pK+'%':'')+'</div>':'')
      +'</div></div>';});
  h+='<div class="donut-lg" style="margin-top:9px"><span><i style="background:'+SOLC+'"></i>Sol</span>'
    +'<span><i style="background:'+BATC+'"></i>Batteri</span><span><i style="background:'+KOPC+'"></i>Köpt</span></div>';

  h+='</section>';
  // Kronor: köpt och sålt per period

  // Staplar per värde — följer den globala periodraden
  var cyMs=SEED_MONTHS.filter(function(m){return m.m.slice(0,4)===String(cy);}).map(function(m){return m.m.slice(5);});
  var completeMs=cyMs.filter(function(mm){return (+mm)<=lastFullMonth();});
  var isTot=(_aoaMode==='total');
  var useMs=(_aoaMode==='total')?[]:(_aoaMode==='ytd'?cyMs:completeMs);
  var pStats=[cy-2,cy-1,cy].map(function(y){return isTot?yearStats(y):periodAgg(y,useMs);});
  var msLbl=function(ms){return ms.length?(MABBR[+ms[0]-1]+'–'+MABBR[+ms[ms.length-1]-1]):'perioden';};
  var perLbl=isTot?'hela år':msLbl(useMs);
  h+='<section class="panel">';
  h+=cmpHead('År mot år',perLbl+' · kWh',
    'Jämför energivärdena mellan åren. Färdiga månader: till senaste avslutade månad ('+msLbl(completeMs)+') mot samma månader '+(cy-2)+' och '+(cy-1)+' – den ärligaste jämförelsen, ingen halv månad på slutet. I år hittills: samma datumperiod ('+msLbl(cyMs)+') mot samma period tidigare år. Hela år: hela åren (i år är ännu inte färdigt) mot fjolårens helår.');
  h+=cmpSeg(AOA_MODES,_aoaMode,'aoaModeSet');
  /* Lagesknapparna flyttade till den globala periodraden hogst upp (v194). */

  CMPM.forEach(function(m){
    var mc=(P[m.pk]||m.col);
    var vals=pStats.map(function(s){return s?metricVal(s,m.sk):null;});
    var max=Math.max.apply(null,vals.map(function(v){return v||0;}))||1;
    var q=iqBtn(m.info);
    h+='<div class="b1"><div class="b1-h"><span class="b1-t" style="color:'+mc+'">'+esc(m.label)+'</span>'+q.btn+'</div>'+q.box;
    [cy-2,cy-1,cy].forEach(function(y,i){var v=vals[i],w=(v?Math.max(3,Math.round(v/max*100)):0),isC=(y===cy);
      h+='<div class="b1-row"><span class="b1-y'+(isC?' cur':'')+'">'+y+'</span><div class="b1-track"><i style="width:'+w+'%;background:'+mc+'"></i></div><span class="b1-v">'+nK(v)+'</span></div>';});
    var d2=metricDiff(cy-2,m.sk,m.hib,aoaDiffMode()),d1=metricDiff(cy-1,m.sk,m.hib,aoaDiffMode());
    h+='<div class="pctsep2"><span class="pl2">mot '+(cy-2)+'</span> '+(d2?'<span class="cmp-badge '+d2.cls+'">'+d2.val+'</span>':'<span class="pl2">–</span>')+' <span class="pl2">·</span> <span class="pl2">mot '+(cy-1)+'</span> '+(d1?'<span class="cmp-badge '+d1.cls+'">'+d1.val+'</span>':'<span class="pl2">–</span>')+'</div>';
    h+='</div>';
  });
  h+='</section>';
  el.innerHTML=h+effHTML();
}
/* Kopt och salt i kronor per period. Bygger pa money_v1 - se kommentaren dar for
   vad som ar matt och vad som ar uppskattat. */
/* v196: kronorutan har ingen egen periodrad langre - de globala knapparna styr.
   Priset for det ar att VECKA foll bort; de fyra globala ar Ar, Manad, Dag, Nu. */
function _krPerNu(){return _krMode;}
/* Delaret ar inte jamforbart med helar - varken i kWh eller i andel. Andelen ar den
   lomska: manaderna som fattas ar arets morkaste i forhallande till forbrukningen, sa
   solens del ser battre ut an den blir. Vi gissar inte hur mycket - vi mater det pa
   fjolaret, som har bade samma manader och ett facit. */
function mixNoteBygg(stats,cy){
  _mixNote='';
  /* Med hela manader eller till idag star lika mot lika - inget att varna for. */
  /* Delarsnoten galler bara nar mixen visar HELA AR - da ar i ar ett delar mot helar. */
  if(_mixMode!=='year'){_mixNote='';return;}
  var cyS=stats[2]; if(!cyS||!cyS.partial)return;
  var msNow=SEED_MONTHS.filter(function(m){return m.m.slice(0,4)===String(cy);}).map(function(m){return m.m.slice(5);});
  var pa=periodAgg(cy-1,msNow), fa=stats[1];
  var shr=function(x){if(!x)return null;var tt=(x.sol||0)+(x.batt||0)+(x.kopt||0);return tt>0?(x.sol||0)/tt*100:null;};
  var a=shr(pa), b=shr(fa);
  var n=cy+' är inte färdigt. '+periodLabel(cyS)+' står mot hela '+(cy-2)+' och '+(cy-1)+', så varken totalen eller andelarna går att jämföra rakt av.';
  if(a!=null&&b!=null&&fa&&!fa.partial){
    n+=' Så mycket lurar det: samma månader '+(cy-1)+' gav solen '+Math.round(a)+' % av förbrukningen, men hela '+(cy-1)+' bara '+Math.round(b)+' %. Räkna med att '+cy+' faller på samma sätt när mörkret kommer.';
  }
  n+=' Vill du jämföra lika mot lika – välj Denna månad eller Året per månad.';
  _mixNote=n;}
function mixInfo(){
  var t='Så mycket av elen huset gjorde av med kom från dina egna paneler, från batteriet, respektive köptes från nätet. '
   +'De tre delarna är alltid hela förbrukningen tillsammans. Tryck på ett år i förklaringen för att lyfta fram det. '
   +'Tidigare år är hela år. Innevarande år är bara de månader som hunnit bli klara.';
  if(_mixMode==='day'||_mixMode==='month'){
    var bs=battKwhGet().src, harScript=!!(bs&&bs.ok);
    if(harScript){
      t+=' Sol och köpt är avlästa ur Homeys mätare. Batteriets kWh kommer från HomeyScriptet '
        +'som räknar en riktig mätare åt batteriet – exakt, inte uppskattad.';
    }else{
      t+=' Sol och köpt är avlästa ur Homeys mätare. Batteriets andel är beräknad ur effekten timme för timme – '
        +'batteriet har ingen egen kWh-mätare, så den siffran är en uppskattning. '
        +'Kör HomeyScriptet batteri_kwh (var 1–2 minut via en Flow) så byts uppskattningen mot en exakt mätare.';
      var eb=emixGet().batt;
      if(eb&&!eb.funnen)t+=' Just nu hittar dashboarden ingen effektlogg för batteriet i Homey Insights heller, '
        +'så batteridelen visas som noll tills scriptet körts.';
      else if(eb&&eb.funnen&&!eb.dygn)t+=' Batteriets effektlogg finns, men inget dygn hade någon urladdning att räkna på ännu.';
    }
  }
  return _mixNote?(t+' '+_mixNote):t;}
function kronorPanel(){
  var per=_krPerNu(), r=monPer(per), P=(PAL&&PAL[curTheme])||{};
  var KOPC=(P.warm||'#d08770'), SALC=(P.sun||'#ebcb8b');
  var h='<section class="panel">';
  h+=cmpHead('Köpt och sålt','vad du betalat och fått betalt',krInfo());
  h+=cmpSeg(KR_MODES,_krMode,'krModeSet');
  if(!r.st){
    h+='<div class="cmp-note" style="margin-top:6px">Ingen logg ännu – siffrorna växer fram.</div>';
    return h+'</section>';}
  var tot=r.k+r.s, kr=function(v){return num(v,Math.abs(v)<100?2:0);};
  var pk=tot>0?Math.round(r.k/tot*100):0, ps=tot>0?100-pk:0;
  var tk=monTackning(r);
  h+='<div class="sb-row"><div class="sb-head"><span class="sb-y cur">'+({day:'Idag',week:'Veckan',month:'Månaden',year:'Året'}[per])
    +(tk?' <span class="sb-per part">'+esc(tk)+'</span>':'')+'</span><span class="sb-tot">'+kr(tot)+' kr omsatt</span></div>';
  h+='<div class="sb-bar">'
    +(pk>0?'<div class="sb-seg" style="width:'+pk+'%;background:'+KOPC+'">'+(pk>=9?pk+'%':'')+'</div>':'')
    +(ps>0?'<div class="sb-seg" style="width:'+ps+'%;background:'+SALC+'">'+(ps>=9?ps+'%':'')+'</div>':'')
    +'</div></div>';
  h+='<div class="donut-lg"><span><i style="background:'+KOPC+'"></i>Köpt '+kr(r.k)+' kr</span>'
    +'<span><i style="background:'+SALC+'"></i>Sålt '+kr(r.s)+' kr</span></div>';
  h+='<div class="cmp-hero-badges" style="justify-content:center;margin-top:11px">'
    +'<span class="cmp-badge '+(r.net>=0?'g':'b')+'">'+(r.net>0?'+':'')+kr(r.net)+' kr <em>netto</em></span>'
    +(r.ki>0?'<span class="cmp-badge">'+Math.round(r.ki)+' kWh <em>köpt</em></span>':'')
    +(r.so>0?'<span class="cmp-badge">'+Math.round(r.so)+' kWh <em>sålt</em></span>':'')
    +'</div>';
  return h+'</section>';}
/* All forklaring till kronorrutan, i klarsprak, bakom i-knappen. */
function krInfo(){
  var r=monPer(_krPerNu());
  var t='Vad du betalat för el från nätet, och vad du fått betalt för den du sålt. Stapeln visar hur det fördelar sig; '
   +'totalen är de två tillsammans. Netto är sålt minus köpt – står det plus har du tjänat på perioden.';
  if(!r.st){
    t+=' Ingen logg finns ännu. Din Homey har ingen färdig siffra för vad du köpt eller sålt för en vecka eller ett år – '
     +'dagens elkostnad nollställs varje midnatt, och ingenting sparar den. Därför bygger dashboarden en egen historik: '
     +'de senaste dygnen hämtas bakåt ur Homey, resten växer fram dag för dag. Kör HomeyScriptet som hämtar Tibbers egna '
     +'belopp så slipper du vänta – då finns både månader och dygn direkt.';
    return t+' '+monTibText()+' '+monDiagText();}
  if(r.tib){
    t+=' Siffrorna är Tibbers egen avräkning: exakt vad de debiterat och betalat, hämtat ur deras API. Ingen gissning.';
    if(r.ren)t+=' Månad och år visar enbart Tibbers tal – ingenting räknas här hemma. '
      +'Innevarande månad summeras ur deras dygnsbelopp, som är färska in i går; '
      +'avslutade månader tas ur månadsbeloppen. '
      +'Dagens dygn saknas tills Tibber avräknat det, vilket brukar ske dygnet efter.'
      +' '+monTibKort();
    else t+=' Bara dagens siffra räknas här hemma, för Tibbers avräkning släpar ett dygn.';
  }else{
    t+=' Köpt är Tibbers egen siffra. Sålt är en uppskattning – din elmätare rapporterar hur många kilowattimmar '
     +'du sålt, men inte vad du fick för dem, så priset räknas fram. Kör HomeyScriptet så byts hela rutan '
     +'mot Tibbers riktiga belopp.';
    var _dagar=(r.bfn||0)+(r.st?monDagarSedan(r.st):0);
    if(r.st&&_dagar<=1&&!r.tib)t+=' Loggen är bara '+(_dagar<1?'timmar':'ett dygn')+' gammal ännu, '
     +'så samma tal står i Dag, Vecka, Månad och År – det är inte ett räknefel, historiken hinner bara inte skilja perioderna åt än.';
    var dg=monDiag()||{};
    if(r.bfn){
      var mp=(dg.np!=null&&dg.np+dg.nf>0)?Math.round(dg.np/(dg.np+dg.nf)*100):null;
      t+=' '+r.bfn+' dygn är hämtade bakåt ur Homey';
      t+=(mp==null?'.':(mp>=99?', timme för timme med rätt pris för varje timme.':(mp<=1?', men utan priser – allt är räknat med ett genomsnittspris på '+num(prisSatser().salt,2)+' kr/kWh, vilket troligen är för högt eftersom du säljer mitt på dagen när elen är billig.':', varav '+mp+' % fick sitt eget timpris och resten ett genomsnitt.')));
    }
    t+=' '+monDiagText();
  }
  t+=' '+monTibText();
  if(r.st&&!r.full)t+=' Loggen börjar '+r.st+' – perioder som börjar tidigare är ofullständiga och märks med "från".';
  return t;}
/* Hur manga dygn loggen faktiskt spanner over. */
function monDagarSedan(dk){
  var a=new Date(dk+'T12:00:00').getTime(), b=new Date(dayKey()+'T12:00:00').getTime();
  return Math.max(0,Math.round((b-a)/86400000));}
function cmpIdleReset(){
  if(_cmpIdle){clearTimeout(_cmpIdle);_cmpIdle=null;}
  if(!IDLE_CLOSE_MS)return; // endast Samsung-plattan (45s); av på övriga
  var jv=$('view-jamfor'),iv=$('view-insikter');
  var jOpen=(jv&&jv.classList&&!jv.classList.contains('hidden')),iOpen=(iv&&iv.classList&&!iv.classList.contains('hidden'));
  if((jOpen||iOpen)&&typeof setTimeout==='function'){_cmpIdle=setTimeout(function(){try{if(iOpen)closeInsikter();else closeCompare();}catch(e){}},IDLE_CLOSE_MS);}
}
function openCompare(){if(_suppressClick){_suppressClick=false;return;}try{notStang();}catch(e){}try{document.body.classList.add('cmp-open');}catch(e){}try{showView('jamfor');}catch(e){}renderCompare();try{syncCmpHeader();}catch(e){}cmpIdleReset();if(typeof fitScreen==='function')try{setTimeout(fitScreen,40);}catch(e){}try{if(document.scrollingElement)document.scrollingElement.scrollTop=0;var jv=$('view-jamfor');if(jv&&jv.scrollTop!=null)jv.scrollTop=0;}catch(e){}}
function closeCompare(){if(_cmpIdle){clearTimeout(_cmpIdle);_cmpIdle=null;}try{document.body.classList.remove('cmp-open');}catch(e){}try{showView('flode');}catch(e){}if(typeof fitScreen==='function')try{setTimeout(fitScreen,40);}catch(e){}}
function goHome(){if(_suppressClick){_suppressClick=false;return;}
  try{notStang();}catch(e){}
  closeCompare();}
