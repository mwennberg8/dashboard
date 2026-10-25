/* js/notiser.js — Husets krönika och notiserna: NY-märket, notisikonen, djuplänkar, notisvyn och notisernas ton.
 *
 * Filen innehåller BARA funktionsdeklarationer. Konstanter, tillstånd och allt
 * som körs direkt vid laddning ligger i js/start.js, som laddas sist, under
 * rubriken [notiser.js]. En funktion går att anropa oavsett vilken fil den står
 * i, men kod som körs vid laddning kan här anropa en funktion i en fil som inte
 * hunnit laddas. Lägg den därför aldrig här.
 */

function kronLastGet(){
  try{return JSON.parse(localStorage.getItem(KRON_LAST)||'{}')||{};}catch(e){return {};}}
function kronLastSatt(p){
  try{
    var o=kronLastGet();
    o[p]=Date.now();
    /* Håll listan kort — bara perioder som fortfarande kan vara nya spelar roll. */
    var k=Object.keys(o).sort();
    while(k.length>60)delete o[k.shift()];
    localStorage.setItem(KRON_LAST,JSON.stringify(o));
    return true;
  }catch(e){return false;}}
/* När hände något med posten senast? Den SENARE av när siffrorna räknades och
   när texten skrevs. Skriver man om texten på en gammal månad är det lika mycket
   en nyhet som en ny post — förut byggde märket bara på räkningen, och en
   omskriven text gav ingenting. */
function kronTid(x){
  if(!x)return 0;
  return Math.max(Number(x.raknad_at)||0, Number(x.text_at)||0);}
function kronArNy(x){
  var t=kronTid(x);
  if(!t)return false;
  if(Date.now()-t>KRON_NY_MAX)return false;             /* tre dygn räcker */
  /* Jämför läsningen mot posten, inte bara "har öppnats någon gång". En post
     man läst i förrgår och som fått ny text idag ska bli oläst igen. */
  var last=Number(kronLastGet()[x.period])||0;
  return last<t;}

/* ===== Notisikon i toppraden =====
   Visas när det finns en oläst krönika. Tryck går direkt till den äldsta
   olästa — inte den nyaste, för läser man uppifrån hoppar man över det som
   legat längst och är på väg att försvinna.

   Läsningen är per enhet, precis som NY-märket: att du läst på plattan säger
   ingenting om vad du sett i telefonen. */
/* Klockans räknare måste bygga på SAMMA lista som notisvyn. Förut räknade den
   ur _kron direkt och tog därför med poster man sopat undan: klockan visade
   "1 oläst" medan listan såg tom ut, och märket satt kvar i arkivet.

   notLista() filtrerar bort borttagna och tar hänsyn till väggplattan; genom
   att gå via den kan de två inte glida isär igen. */
function krOlasta(){
  if(!_kron)return [];
  return notLista().filter(function(x){return x.ny;})
    .sort(function(a,b){return (a.tid||0)-(b.tid||0);});}
/* Varje vy har sin egen topprad, alltså sin egen notisknapp. Sök upp dem på
   KLASS i stället för en lista med id:n — den listan missade den femte knappen
   så fort notisvyn tillkom, och samma sak hade hänt nästa gång. */
function krNotisUppdatera(){
  /* I HISTORIKLÄGET är knappen en Live-knapp. Den här funktionen skriver om
     hela innehållet med klocka och olästräknare, vilket både raderade
     Live-texten och lät notisantalet ligga kvar ovanpå. Låt knappen vara. */
  try{if(document.body.classList.contains('histmod'))return;}catch(e){}
  var o=krOlasta();
  var alla=document.querySelectorAll('.en-notis');
  Array.prototype.forEach.call(alla,function(b){krNotisEn(b,o);});}
function krNotisEn(b,o){
  if(!b)return;
  /* HISTORIKLÄGET äger knappen. Här är den en LIVE-knapp med blixt och text —
     ritar notisuppdateringen om den med klocka och antal blir läget fel, och
     antalet säger dessutom ingenting om att man tittar bakåt i tiden. */
  if(typeof _timeActive!=='undefined'&&_timeActive){
    b.classList.remove('har','puls','bak');
    return;
  }
  /* Är en notis öppen blir klockan en tillbaka-knapp. Toppraden är ändå den
     enda fasta punkten på sidan, och en knapp inne i innehållet flyttar sig
     beroende på hur lång texten är. */
  if(_notOppen){
    b.classList.remove('har','puls');
    b.classList.add('bak');
    b.innerHTML='<span class="en-cmp-ic">'+icon('arrow-left')+'</span>Tillbaka';
    b.title='Tillbaka till notiserna';
    return;
  }
  b.classList.remove('bak');
  /* icon() ger tom sträng innan ikonuppsättningen initierats. Skrivs knappen
     över DÅ försvinner klockan, och den kommer inte tillbaka förrän något ritar
     om — precis det som gav en tom ring på startsidan. Behåll det som redan
     står där i så fall. */
  var kl=icon('bell');
  if(!kl){
    var fanns=b.querySelector('.en-cmp-ic');
    kl=fanns?fanns.innerHTML:'';
    if(!kl){b.classList.toggle('har',!!o.length);return;}
  }
  /* Väggplattan visar ALDRIG antal eller markering — bara en klocka att trycka
     på. Den sitter uppsatt i hallen och ingen står framför den när texten
     skrivs; en markering där blir en påminnelse som aldrig kvitteras av rätt
     person, och som dessutom lyser mot alla som går förbi.
     Andra plattor beter sig som telefonen. */
  if(!notVisaNy()){
    b.classList.remove('har','puls');
    b.innerHTML='<span class="en-cmp-ic ic-slot" data-ic="bell">'+kl+'</span>';
    b.title=o.length?('Sammanfattningar — '+o.length+' oläst'+(o.length>1?'a':'')):'Sammanfattningar';
    return;
  }
  /* Klockan finns ALLTID. Utan olästa är den bara en väg in till krönikan;
     en knapp som försvinner och dyker upp gör toppraden rastlös, och man
     lär sig aldrig var den sitter. */
  if(!o.length){
    b.classList.remove('har','puls');
    b.innerHTML='<span class="en-cmp-ic ic-slot" data-ic="bell">'+kl+'</span>';
    b.title='Sammanfattningar';
    return;
  }
  b.classList.add('har');
  /* 'bell' även här — 'bell-ringing' finns inte i ikonuppsättningen och hade
     gett en tom ruta. Färgen och siffran bär tillståndet i stället. */
  b.innerHTML='<span class="en-cmp-ic ic-slot" data-ic="bell">'+kl+'</span>'
    +'<span class="en-notis-n">'+o.length+'</span>';
  b.title=o.length===1
    ? ('Ny sammanfattning: '+kronNamn(o[0].period))
    : (o.length+' olästa sammanfattningar — äldsta: '+kronNamn(o[0].period));
  b.classList.add('puls');}
function krNotisTryck(){
  /* Öppen notis: knappen är en tillbaka-knapp. Annars till listan — förut
     hoppade den rakt till den äldsta olästa, vilket var bekvämt med en post men
     obegripligt med fem: man visste inte vad man hoppat förbi. */
  if(_notOppen){try{notTillbaka();}catch(e){}return;}
  try{openNotiser();}catch(e){}}

/* ===== Djuplänk =====
   ?kronika=2026-07 öppnar Insikter med den posten utfälld. Notisen om att
   krönikan skrivits kan då peka rakt på texten i stället för att bara säga att
   den finns någonstans.

   Perioden kontrolleras mot mönstret innan den används — den kommer utifrån,
   och ska inte kunna bli vad som helst. */
function kronDjupLank(){
  var per=null;
  try{
    var q=new URLSearchParams(location.search||'');
    per=q.get('kronika');
  }catch(e){
    var m=(location.search||'').match(/[?&]kronika=([^&]+)/);
    if(m)per=decodeURIComponent(m[1]);
  }
  /* ?notis=<id> öppnar en dagsnotis; ?kronika=<period> en sammanfattning. */
  if(!per){
    var dn=null;
    try{dn=new URLSearchParams(location.search||'').get('notis');}catch(e){}
    if(dn&&/^[\w-]{4,40}$/.test(dn)){
      _kronDjup=true;
      try{openNotiser();}catch(e){}
      dagHamta(true).then(function(){try{notOppna(dn);}catch(e){}});
      try{if(history&&history.replaceState)history.replaceState(null,'',location.pathname);}catch(e){}
      return true;
    }
  }
  if(!per||!/^\d{4}(-\d{2})?$/.test(per))return false;
  _kronDjup=true;
  /* Länken i pushen pekar på en bestämd period — öppna den i notisvyn, som är
     där man läser dem numera. */
  try{openNotiser();}catch(e){}
  try{notOppna(per);}catch(e){}
  kronPost(per).then(function(){
    try{renderNotiser();}catch(e){}
    /* Rulla fram kortet — i en lång insiktssida ligger krönikan längst ned. */
    setTimeout(function(){
      try{
        var el=document.querySelector('.kr-r.on');
        if(el&&el.scrollIntoView)el.scrollIntoView({block:'center',behavior:'smooth'});
      }catch(e){}
    },260);
  });
  /* Rensa adressen så en omladdning inte hoppar dit igen. */
  try{
    if(history&&history.replaceState)history.replaceState(null,'',location.pathname);
  }catch(e){}
  return true;}
async function kronKoll(force){
  if(!appKan())return;
  if(document.hidden&&!force)return;
  if(!force&&_kron&&Date.now()-_kronAt<KRON_KOLL)return;
  var fore=(_kron?JSON.stringify(_kron.manader||[])+JSON.stringify(_kron.ar||[]):'')
    +(_dag?JSON.stringify(_dag.notiser.map(function(x){return x.id;})):'');
  try{await dagHamta(true);}catch(e){}
  var j=await kronLista(true);
  if(!j)return;
  var efter=JSON.stringify(j.manader||[])+JSON.stringify(j.ar||[])
    +(_dag?JSON.stringify(_dag.notiser.map(function(x){return x.id;})):'');
  /* Rita om Insikter bara när något faktiskt ändrats — annars rycker vyn till
     var femte minut medan man läser. */
  if(efter!==fore){
    try{
      var v=$('view-insikter');
      if(v&&v.classList&&!v.classList.contains('hidden'))renderInsikter();
    }catch(e){}
  }}
async function kronLista(force){
  if(!force&&_kron&&Date.now()-_kronAt<10*60000)return _kron;
  try{
    var j=await appGet('/kronika');
    if(!j||!j.manader)throw new Error('tomt svar');
    _kron=j;_kronAt=Date.now();_kronFel=null;
    try{krNotisUppdatera();}catch(e){}
    /* INGEN autoutfällning. Listan börjar hopfälld, och NY-märket räcker för
       att visa var det nya finns. En post som fäller ut sig själv flyttar
       resten av listan under fingret precis när man ska trycka. */
    return j;
  }catch(e){_kronFel=(e&&e.message)||String(e);return null;}}
async function kronPost(period){
  if(_kronPost[period])return _kronPost[period];
  try{
    var j=await appGet('/kronika?period='+encodeURIComponent(period));
    if(!j||!j.period)throw new Error('tomt svar');
    _kronPost[period]=j;return j;
  }catch(e){_kronFel=(e&&e.message)||String(e);return null;}}
function kronArOppen(y){
  if(_kronArState===null)_kronArState={};
  return !!_kronArState[String(y)];}
function kronArTog(y){
  kronArOppen(y);
  y=String(y);
  if(_kronArState[y])delete _kronArState[y];
  else _kronArState[y]=1;
  /* Fälls året ihop ska en öppen post inuti det inte ligga kvar dold. */
  if(!_kronArState[y]&&_kronVald&&String(_kronVald).slice(0,4)===y)_kronVald=null;
  try{renderInsikter();}catch(e){}}
function kronOppna(p){
  /* Märket släcks när posten öppnas, inte när den stängs. */
  if(_kronVald!==p){kronLastSatt(p);try{krNotisUppdatera();}catch(e){}}
  _kronVald=(_kronVald===p)?null:p;
  if(_kronVald&&!_kronPost[_kronVald]){
    kronPost(_kronVald).then(function(){renderInsikter();});
  }
  renderInsikter();}
/* Versal begynnelsebokstav i datan, inte bara via CSS. Det som kopieras eller
   läses upp ska se likadant ut som det som visas. */
function kronVersal(t){var x=String(t||'');return x?x.charAt(0).toUpperCase()+x.slice(1):x;}
function kronNamn(p){
  if(!p)return '';
  if(p.length===4)return p;
  var d=p.split('-');
  return kronVersal((KRON_MAN[+d[1]-1]||p)+' '+d[0]);}
function kronKwh(v){return v==null?'–':num(v,0)+' kWh';}
function kronKr(v){return v==null?'–':num(v,0)+' kr';}
function krKort(t){return KR_KORT[t]||t;}

/* Rapporten kommer som ren text: en rubrikrad först, sedan en rad per ämne med
   en emoji som ledtecken. Att bara sätta white-space:pre-line ger en klump.

   Här delas den i sina beståndsdelar i stället: rubriken blir rubrik, emojin
   flyttas ut i en egen kolumn så att alla rader börjar på samma ställe, och
   siffror med enhet får svagt tyngre stil så att blicken hittar dem. Inget
   innehåll ändras — bara hur det sätts. */
function kronRapport(txt){
  var rader=String(txt||'').split('\n').map(function(r){return r.trim();})
    .filter(function(r){return r.length;});
  if(!rader.length)return '';
  /* Tre slags rader, och skillnaden är hela läsupplevelsen:
       rad 1          → rubrik
       rad 2          → ingress, större och ljusare
       emoji först    → höjdpunkt, indragen med sitt tecken i egen kolumn
       övrigt         → brödtext i löpande stycken
     Förut behandlades allt som höjdpunkter, och texten läste sig som en
     kvittorulle: varje rad sann, ingen sammanhängande. */
  var h='<div class="kr-rap">';
  rader.forEach(function(r,i){
    var m=r.match(/^([\u203C-\u3299\uD83C-\uDBFF\uDC00-\uDFFF\u2600-\u27BF\uFE0F\u2190-\u21FF]+)\s*(.*)$/);
    var ik=m?m[1]:'', txt2=m?m[2]:r;
    if(i===0){
      h+='<div class="kr-rh">'+(ik?('<span class="kr-rhi">'+esc(ik)+'</span>'):'')
        +'<span>'+esc(txt2)+'</span></div>';
      return;
    }
    if(i===1&&!ik){
      h+='<p class="kr-ing">'+kronTal(esc(txt2))+'</p>';
      return;
    }
    if(ik){
      h+='<div class="kr-rr">'
        +'<span class="kr-rri">'+esc(ik)+'</span>'
        +'<span class="kr-rrt">'+kronTal(esc(txt2))+'</span></div>';
      return;
    }
    /* kr-txt, INTE kr-p: den klassen var redan tagen av chevronen i
       krönikelistan, som är 12 px bred. Stycket ärvde bredden och bröt ett ord
       per rad. */
    h+='<p class="kr-txt">'+kronTal(esc(txt2))+'</p>';
  });
  return h+'</div>';}

/* Framhäv tal med enhet. Bara siffergrupper som följs av en enhet eller ett
   procenttecken — annars skulle datum och klockslag också bli feta, och då är
   ingenting framhävt. */
function kronTal(t){
  return String(t).replace(
    /(\d[\d\s\u00a0]*(?:[.,]\d+)?)\s?(kWh|kW|W|kr|öre|mm|m\/s|°C|°|%|h\b|st\b)/g,
    function(hel,tal,enh){return '<b class="kr-n2">'+tal.trim()+' '+enh+'</b>';});}

/* max = hur många rutor som ska visas. Ordningen nedan ÄR prioriteringen:
   de mest talande värdena först, så att sex rutor alltid ger de sex mest
   intressanta och inte de sex som råkade komma först i objektet. */
/* ===== Kul att veta =====
   Rakt av ur postens egna siffror — inga pahittade fakta. Jamforelserna ar
   sadana man kan kanna igen: mil i bilen, koppar kaffe, badkar vatten. Bara
   de som faktiskt gar att rakna ut visas, och de valjs deterministiskt sa att
   samma manad alltid ger samma rader. */
function kronKul(o,ar){
  if(!o)return [];
  /* num() formaterar svenskt sedan v404 — ingen egen efterbehandling behövs. */
  var r=[],n2=function(v,d){return num(v,d==null?0:d);};
  var sol=o.sol&&o.sol.kwh, el=o.el||{}, v=o.vader||{};

  /* Hela meningar som säger något, inte lösryckta tal. Varje rad ska gå att
     läsa högt och landa — "1 453 mil" betyder ingenting, "räckt till 1 453 mil,
     ungefär Göteborg–Neapel" betyder något. Alla jämförelser är räknade ur
     postens egna siffror; inget är påhittat. */
  if(sol>0){
    var mil=sol/0.18/10;
    var vart=mil>4000?'motsvarande ett varv runt Medelhavet och lite till'
      :mil>1200?'ungefär Göteborg–Neapel'
      :mil>400?'ungefär Göteborg–Stockholm och tillbaka'
      :'ungefär Göteborg–Malmö';
    r.push({ik:'car-profile',t:'Solen som föll på taket hade räckt till <b>'
      +n2(mil)+' mil</b> i elbil — '+vart+'.'});
    r.push({ik:'coins',t:'Samma el hade kokat <b>'+n2(sol/0.02)
      +'</b> koppar kaffe, eller hållit en gammal glödlampa tänd i '
      +n2(sol/0.06/24/365,1)+' år.'});
  }
  if(o.sol&&o.sol.perKwp)
    r.push({ik:'sun',t:'Anläggningen gav <b>'+n2(o.sol.perKwp)
      +' kWh per installerad kilowatt</b> — det tal som gör den jämförbar med '
      +'andras, oavsett hur många paneler de har.'});
  if(o.sol&&o.sol.basta&&o.sol.samsta&&o.sol.samsta.kwh>0){
    var kvot=o.sol.basta.kwh/o.sol.samsta.kwh;
    if(kvot>1.5)r.push({ik:'chart-line',t:'Mellan bästa och sämsta dygnet skiljde det <b>'
      +n2(kvot,1)+' gånger</b>. Så mycket kan ett moln betyda.'});
  }
  if(el.saltKwh>0&&el.koptKwh>0){
    var kv=el.saltKwh/el.koptKwh;
    r.push({ik:'lightning',t:'För varje kilowattimme du köpte sålde du <b>'
      +n2(kv,1)+'</b> tillbaka.'});
  }
  if(el.netto!=null&&el.netto>0)
    r.push({ik:'coins',t:'Elräkningen blev en <b>intäkt på '+n2(el.netto)
      +' kr</b> — nätet betalade dig för att ha huset här.'});
  if(v.nederbord>0){
    var lit=v.nederbord*100;
    r.push({ik:'drop',t:'<b>'+n2(lit)+' liter</b> regn föll på panelytan, ungefär '
      +n2(lit/150)+' badkar. Gratis fönsterputs.'});
  }
  if(v.max&&v.min&&v.max.temp!=null&&v.min.temp!=null)
    r.push({ik:'thermometer',t:'Termometern rörde sig <b>'+n2(v.max.temp-v.min.temp,1)
      +' grader</b> mellan kallast och varmast.'});
  if(o.bil&&o.bil.kwh>0)
    r.push({ik:'car-profile',t:'Bilarna drack <b>'+n2(o.bil.kwh)+' kWh</b>, vilket räcker '
      +n2(o.bil.kwh/0.18/10)+' mil'
      +(sol>0?(' — '+Math.round(Math.min(100,o.bil.kwh/sol*100))+' % av vad taket gav.'):'.')});
  if(o.vin&&o.vin.in!=null&&o.vin.ut!=null){
    var dd=o.vin.in-o.vin.ut;
    r.push({ik:'drop-half-bottom',t:dd>0
      ? ('Källaren växte med <b>'+dd+' flaskor</b> — fler in än ut, som vanligt.')
      : (dd<0 ? ('Källaren krympte med <b>'+Math.abs(dd)+' flaskor</b>. Det har druckits.')
              : 'Källaren står stilla: lika många in som ut.')});
  }
  return r.slice(0,ar?5:4);}

function kronKulHTML(o,ar){
  var l=kronKul(o,ar);
  if(!l.length)return '';
  /* Samma uppmärkning som artikelns höjdpunkter, inte ett eget block med ram
     omkring. Blocket ska läsas som artikelns sista avsnitt — det är där en
     tidningsartikel brukar sätta talen i perspektiv — och inte som en faktaruta
     hängd bredvid. */
  var h='<div class="kul"><div class="kr-h2">Kul fakta</div>';
  l.forEach(function(x){
    h+='<p class="kr-txt kr-emo"><span class="kr-emi">'+icon(x.ik)+'</span>'+x.t+'</p>';});
  return h+'</div>';}
function krPopStang(){
  _krPop=null;
  var e=$('krpop');if(e&&e.parentNode)e.parentNode.removeChild(e);}
function krPop(nyckel,period){
  var o=_kronPost[period];if(!o)return;
  var d=krPopData(nyckel,o,String(period).length===4);
  if(!d)return;
  krPopStang();
  var h='<div class="krpop-bak" id="krpop" onclick="if(event.target===this)krPopStang()">'
    +'<div class="krpop"><button class="krpop-x" onclick="krPopStang()" aria-label="stäng">'+icon('close')+'</button>'
    +'<div class="krpop-h"><span class="krpop-i">'+icon(d.ik||'circle')+'</span>'+esc(d.rubrik)+'</div>'
    +'<div class="krpop-v">'+d.varde+'</div>';
  if(d.rader&&d.rader.length){
    h+='<div class="krpop-l">';
    d.rader.forEach(function(r){
      h+='<div class="krpop-r"><span>'+esc(r[0])+'</span><b>'+r[1]+'</b></div>';});
    h+='</div>';
  }
  if(d.info)h+='<div class="krpop-t">'+d.info+'</div>';
  h+='</div></div>';
  var w=document.createElement('div');w.innerHTML=h;
  document.body.appendChild(w.firstChild);
  _krPop=nyckel;}

function krPopData(k,o,ar){
  var n=function(v,d){return v==null?'–':num(v,d==null?0:d);};
  var dat=function(x){return x&&x.datum?kronDat(x.datum):'';};
  var el=o.el||{},v=o.vader||{},sol=o.sol||{};
  var P={
    sol:{rubrik:'Solproduktion',ik:'sun',varde:n(sol.kwh)+' kWh',
      rader:[['Bästa dygnet',sol.basta?(n(sol.basta.kwh)+' kWh '+dat(sol.basta)):'–'],
             ['Sämsta dygnet',sol.samsta?(n(sol.samsta.kwh)+' kWh '+dat(sol.samsta)):'–'],
             ['Dygn över 100 kWh',sol.dygnOver100!=null?sol.dygnOver100:'–'],
             ['Per installerad kW',sol.perKwp!=null?(n(sol.perKwp)+' kWh/kW'):'–']],
      info:'Summan av dygnsmaxen ur Insights, inte av vad dashboarden råkat se. '
        +'<b>Per installerad kW</b> delar med anläggningens 19,44 kWp och är det tal '
        +'som gör den jämförbar med andras.'},
    kopt:{rubrik:'Köpt el',ik:'lightning',varde:n(el.koptKwh)+' kWh',
      rader:[['Kostnad',el.koptKr!=null?(n(el.koptKr)+' kr'):'–'],
             ['Dyraste timmen',el.dyrast?(num(el.dyrast.pris,2)+' kr '+dat(el.dyrast)+' kl '+el.dyrast.timme):'–'],
             ['Billigaste timmen',el.billigast?(num(el.billigast.pris,2)+' kr '+dat(el.billigast)+' kl '+el.billigast.timme):'–']],
      info:'Mätarställningens ökning under perioden. Priserna kommer från Tibber och '
        +'är vad du faktiskt betalade, inte en uppskattning.'},
    salt:{rubrik:'Såld el',ik:'lightning',varde:n(el.saltKwh)+' kWh',
      rader:[['Ersättning',el.saltKr!=null?(n(el.saltKr)+' kr'):'–'],
             ['Netto',el.netto!=null?((el.netto>=0?'+':'')+n(el.netto)+' kr'):'–']],
      info:'Netto är ersättningen minus elkostnaden. Ett plustal betyder att '
        +'elräkningen blev en intäkt för perioden.'},
    sjalv:{rubrik:'Självförsörjning',ik:'house',varde:(el.sjalv!=null?n(el.sjalv):'–')+' %',
      rader:[['Producerat',n(sol.kwh)+' kWh'],['Köpt',n(el.koptKwh)+' kWh'],
             ['Sålt',n(el.saltKwh)+' kWh']],
      info:'Hur stor del av husets förbrukning som var egen el. Förbrukningen '
        +'härleds som <b>produktion − såld + köpt</b>. Skilj den från '
        +'<b>egenanvändning</b>, som är hur stor del av produktionen som stannade i huset.'},
    varm:{rubrik:'Varmast',ik:'thermometer-hot',varde:(v.max?num(v.max.temp,1):'–')+' °C',
      rader:[['Datum',v.max?dat(v.max):'–'],
             ['Kallast',v.min?(num(v.min.temp,1)+' °C '+dat(v.min)):'–'],
             ['Medel',v.medel!=null?(num(v.medel,1)+' °C'):'–'],
             ['Dygn över 25°',v.dygnOver25!=null?v.dygnOver25:'–']],
      info:'Dygnsmax ur utomhusgivaren. Medelvärdet är över alla mätpunkter i '
        +'perioden, inte över dygnsmaxen — annars hade det legat för högt.'},
    regn:{rubrik:'Nederbörd',ik:'drop',varde:(v.nederbord!=null?num(v.nederbord,1):'–')+' mm',
      rader:[['På takets panelyta',v.nederbord!=null?(n(v.nederbord*100)+' liter'):'–'],
             ['Kraftigaste by',v.by?(num(v.by.ms,1)+' m/s '+dat(v.by)):'–']],
      info:'1 mm regn är 1 liter per kvadratmeter. Panelytan är ungefär 100 m².'},
    bil:{rubrik:'Bilarna',ik:'car-profile',varde:(o.bil?n(o.bil.kwh):'–')+' kWh',
      rader:[['Ungefär',o.bil?(n(o.bil.kwh/0.18/10)+' mil'):'–']],
      info:'Summan av laddboxens mätare. Sträckan är räknad på 0,18 kWh/km, vilket '
        +'stämmer med båda bilarna inom några procent.'},
    pool:{rubrik:'Poolen',ik:'swimming-pool',varde:(o.pool&&o.pool.varmast?num(o.pool.varmast.temp,1):'–')+' °C',
      rader:[['Varmast',o.pool&&o.pool.varmast?dat(o.pool.varmast):'–'],
             ['Dygn över 26°',o.pool&&o.pool.dygnOver26!=null?o.pool.dygnOver26:'–']],
      info:'Dygnsmax ur pooltemperaturen.'},
    vin:{rubrik:'Vinkällaren',ik:'drop-half-bottom',
      varde:(o.vin?(o.vin.in+' in / '+o.vin.ut+' ut'):'–'),
      rader:[['Värde',o.vin&&o.vin.varde!=null?(n(o.vin.varde)+' kr'):'–'],
             ['Förändring',o.vin?((o.vin.in-o.vin.ut>=0?'+':'')+(o.vin.in-o.vin.ut)+' flaskor'):'–']],
      info:'Ur vinkällarappens register.'}
  };
  return P[k]||null;}

/* Datum ur en post. Årsposter har hela datum (2025-07-14) medan demodata och
   vissa månadsposter bara har period+dag (2026-07-14 respektive 2025-14).
   Utan den här kontrollen blev det "NaN/14". */
function kronDat(d){
  var p=String(d||'').split('-');
  if(p.length>=3&&p[1]&&p[2])return Number(p[2])+'/'+Number(p[1]);
  if(p.length===2&&p[1])return 'den '+Number(p[1]);
  return String(d||'');}
function kronRuta(o,max){
  var r=[];
  /* Samma uppställning som rutorna på startsidan: ikon till vänster, texten i
     en egen kolumn till höger. Varje ruta har ALLTID en ikon — utan den blir
     rutnätet en vägg av versaler där ingenting går att hitta med blicken.
     Stilen är krönikans egen, bara layouten är gemensam. */
  /* Ordningen i koden är inte prioriteringen — den följer datastrukturen.
     Med ett uttryckligt prio-tal ger sex rutor de sex MEST TALANDE värdena
     och inte de sex som råkar komma först i objektet. */
  /* pop = vilken popup rutan öppnar. Utan nyckel är rutan bara en siffra. */
  var lagg=function(namn,varde,extra,ik,farg,prio,pop){
    if(varde==null||varde==='–')return;
    r.push({p:(prio||99),h:'<div class="kr-c'+(pop?' kan':'')+'"'
      +(pop?(' onclick="krPop(\''+pop+'\',\''+esc(o.period)+'\')"'):'')+'>'
      +'<span class="kr-ic" style="color:'+(farg||'var(--faint)')+'">'
      +icon(ik||'gauge')+'</span>'
      +'<span class="kr-tx">'
      +'<span class="kr-l">'+esc(krKort(namn))+'</span>'
      +'<span class="kr-v">'+varde+'</span>'
      +(extra?('<span class="kr-x">'+extra+'</span>'):'')
      +'</span></div>'});};
  if(o.sol){
    lagg('Sol',kronKwh(o.sol.kwh),o.sol.basta?('bäst '+num(o.sol.basta.kwh,0)+' kWh '+o.sol.basta.datum.slice(8)+'/'+(+o.sol.basta.datum.slice(5,7))):null,'sun','var(--solar)',1,'sol');
    if(o.sol.dygnOver100)lagg('Dygn >100 kWh',o.sol.dygnOver100,null,'sun','var(--solar)',7);
  }
  if(o.el){
    lagg('Köpt',kronKwh(o.el.koptKwh),o.el.koptKr!=null?kronKr(o.el.koptKr):null,'lightning','var(--hot)',2,'kopt');
    lagg('Sålt',kronKwh(o.el.saltKwh),o.el.saltKr!=null?kronKr(o.el.saltKr):null,'lightning','var(--ok)',3,'salt');
    if(o.el.sjalv!=null)lagg('Självförsörjning',o.el.sjalv+' %',null,'house','var(--ok)',4,'sjalv');
    if(o.el.dyrast)lagg('Dyraste timmen',num(o.el.dyrast.pris,2)+' kr',
      o.el.dyrast.datum.slice(8)+'/'+(+o.el.dyrast.datum.slice(5,7))+' kl '+o.el.dyrast.timme,'lightning','var(--hot)',8);
    if(o.el.billigast)lagg('Billigaste',num(o.el.billigast.pris,2)+' kr',
      o.el.billigast.datum.slice(8)+'/'+(+o.el.billigast.datum.slice(5,7))+' kl '+o.el.billigast.timme,'lightning','var(--ok)',9);
  }
  if(o.vader){
    if(o.vader.max)lagg('Varmast',num(o.vader.max.temp,1)+' °',o.vader.max.datum.slice(8)+'/'+(+o.vader.max.datum.slice(5,7)),'thermometer-simple','var(--hot)',5,'varm');
    if(o.vader.min)lagg('Kallast',num(o.vader.min.temp,1)+' °',o.vader.min.datum.slice(8)+'/'+(+o.vader.min.datum.slice(5,7)),'thermometer-simple','var(--blue)',10);
    if(o.vader.dygnOver25!=null&&o.vader.dygnOver25>0)lagg('Dygn >25°',o.vader.dygnOver25,null,'sun','var(--gold)',14);
    if(o.vader.nederbord!=null)lagg('Nederbörd',num(o.vader.nederbord,1)+' mm',null,'drop','var(--rain)',6,'regn');
    if(o.vader.by)lagg('Kraftigaste by',num(o.vader.by.ms,1)+' m/s',o.vader.by.datum.slice(8)+'/'+(+o.vader.by.datum.slice(5,7)),'wind','var(--blue)',11);
  }
  if(o.pool){
    if(o.pool.varmast)lagg('Poolen varmast',num(o.pool.varmast.temp,1)+' °',null,'drop','var(--cyan)',13,'pool');
    if(o.pool.dygnOver26)lagg('Pooldygn >26°',o.pool.dygnOver26,null,'drop','var(--cyan)',15);
  }
  if(o.vin){
    if(o.vin.in||o.vin.ut)lagg('Vin in / ut',o.vin.in+' / '+o.vin.ut,null,'drop-half-bottom','var(--hot)',16,'vin');
    if(o.vin.varde!=null)lagg('Källarens värde',kronKr(o.vin.varde),null,'drop-half-bottom','var(--hot)',17);
  }
  if(o.bil&&o.bil.kwh)lagg('Bilarna',kronKwh(o.bil.kwh),null,'car','var(--blue)',12,'bil');
  r.sort(function(a,b){return a.p-b.p;});
  if(max&&r.length>max)r=r.slice(0,max);
  var ut=r.map(function(x){return x.h;});
  return ut.length?('<div class="kr-grid">'+ut.join('')+'</div>'):'';}

/* Jamforelsen mot forra aret. Finns den inte visas ingenting alls. */
function kronJmf(o){
  if(!o.jmf)return '';
  var namn={sol:'Sol',kopt:'Köpt el',salt:'Såld el',nederbord:'Nederbörd'};
  var r=[];
  for(var k in o.jmf){
    var x=o.jmf[k],upp=x.pct>=0;
    r.push('<span class="kr-j"><b>'+esc(namn[k]||k)+'</b> '
      +'<span style="color:'+(upp?'var(--ok)':'var(--hot)')+'">'
      +(upp?'+':'')+num(x.pct,0)+' %</span></span>');
  }
  return r.length?('<div class="kr-jmf">Mot samma månad i fjol: '+r.join(' · ')+'</div>'):'';}

function kronHTML(){
  if(!_kron)return '';
  /* cmpHeadHtml i stället för en naken ww-h: då får kortet exakt samma
     rubrikutrymme som Zambretti och Medeleffekt, och en i-knapp på köpet. */
  var h='<section class="panel">'+cmpHeadHtml('Sammanfattningar','arkiv, månad för månad',
    '<p style="margin:0 0 8px"><b>Arkivet.</b> Nya texter läses under notisklockan '
    +'i toppraden; här ligger alla kvar, även de du sopat undan därifrån.</p>'
    +'<p style="margin:0 0 8px"><b>En text per månad och år.</b> Siffrorna räknas '
    +'först ur Homey Insights, och Gemini skriver sedan av dem — aldrig av en '
    +'tidigare text. Annars vore det en modell som sammanfattar en annan, och '
    +'varje gissning skulle förstärkas utan att någon märkte det.</p>'
    +'<p style="margin:0 0 8px">Månaden skrivs på morgonen sista dygnet och räknas '
    +'om den 1:a med hela underlaget. Året skrivs 31 december, ur de tolv '
    +'månadsposterna — inte ur en ny genomsökning.</p>'
    +'<p style="margin:0"><b>NY</b> sitter tills posten öppnats, eller i tre dygn. '
    +'Läsningen sparas i den här webbläsaren; att du läst på plattan säger '
    +'ingenting om vad du sett i telefonen.</p>');

  /* Textrutan för en post — samma oavsett om det är ett år eller en månad. */
  var kropp=function(period){
    var o=_kronPost[period];
    if(!o)return '<div class="kr-o"><div class="ins-empty">Hämtar…</div></div>';
    var s2='<div class="kr-o">'+kronRuta(o)+kronJmf(o);
    if(o.text){
      /* Rapporten är radbruten och har emoji som ankare — visas som den skickas. */
      s2+='<div class="kr-t">'+kronRapport(o.text)+'</div>';
    }else{
      s2+='<div class="kr-t saknas">Ingen text skriven. Appen skriver den när '
        +'perioden räknas — saknas Gemini-nyckeln blir posten bara siffror.</div>';
    }
    return s2+'</div>';};

  var manadsRad=function(x){
    var vald=(_kronVald===x.period), ny=kronArNy(x);
    var mn=KRON_MAN[+x.period.slice(5,7)-1]||x.period;
    var s2='<div class="kr-r kr-m'+(vald?' on':'')+(ny?' ny':'')
      +'" onclick="kronOppna(\''+x.period+'\')">'
      +'<span class="kr-n">'+esc(kronVersal(mn))+'</span>'
      +'<span class="kr-s">'+(x.sol!=null?num(x.sol,0)+' kWh':'')+'</span>'
      +'<span class="kr-p">'+(vald?'▴':'▾')+'</span></div>';
    if(vald)s2+=kropp(x.period);
    return s2;};

  /* Månaderna hör till sitt år. Förut låg alla under varandra i en enda lista,
     och med tre år blir det trettiosex rader att leta i. */
  var perAr={};
  (_kron.manader||[]).forEach(function(x){
    var y=String(x.period).slice(0,4);
    (perAr[y]=perAr[y]||[]).push(x);});
  var arPost={};
  (_kron.ar||[]).forEach(function(x){arPost[String(x.period)]=x;});

  var alla={};
  Object.keys(perAr).forEach(function(y){alla[y]=1;});
  Object.keys(arPost).forEach(function(y){alla[y]=1;});
  var arLista=Object.keys(alla).sort().reverse();
  if(!arLista.length){
    return h+'<div class="ins-empty">Inga poster ännu. Den första skrivs sista '
      +'dagen i månaden.</div></section>';
  }

  arLista.forEach(function(y){
    var oppen=kronArOppen(y);
    var ap=arPost[y];
    var man=(perAr[y]||[]).slice().sort(function(a,b){
      return String(b.period).localeCompare(String(a.period));});
    var kwh=0,harKwh=false;
    man.forEach(function(m){if(m.sol!=null){kwh+=m.sol;harKwh=true;}});
    var nyIAr=(ap&&kronArNy(ap))||man.some(kronArNy);

    h+='<div class="kr-r kr-y'+(oppen?' on':'')+(nyIAr?' ny':'')
      +'" onclick="kronArTog(\''+y+'\')">'
      +'<span class="kr-n">'+esc(y)+'</span>'
      +'<span class="kr-s">'+(harKwh?num(kwh,0)+' kWh':'')
      +'<span class="kr-mn">'+man.length+' mån</span></span>'
      +'<span class="kr-p">'+(oppen?'▴':'▾')+'</span></div>';

    if(!oppen)return;
    h+='<div class="kr-yo">';
    /* Årstexten först, sedan månaderna — årets sammanfattning är ramen. */
    if(ap){
      var vald=(_kronVald===y);
      h+='<div class="kr-r kr-at'+(vald?' on':'')+(kronArNy(ap)?' ny':'')
        +'" onclick="kronOppna(\''+y+'\')">'
        +'<span class="kr-n">Året '+esc(y)+'</span>'
        +'<span class="kr-s">'+(ap.sol!=null?num(ap.sol,0)+' kWh':'')+'</span>'
        +'<span class="kr-p">'+(vald?'▴':'▾')+'</span></div>';
      if(vald)h+=kropp(y);
    }
    if(man.length)man.forEach(function(m){h+=manadsRad(m);});
    else h+='<div class="ins-empty">Inga månader för '+esc(y)+'.</div>';
    h+='</div>';
  });
  return h+'</section>';}
async function effHamta(force){
  if(!force&&_eff&&Date.now()-_effAt<10*60000)return _eff;
  try{
    var j=await appGet('/effekt');
    if(!j||!j.ar)throw new Error('tomt svar');
    _eff=j;_effAt=Date.now();_effFel=null;
    var ar=Object.keys(j.ar).sort();
    if(!_effAr||!j.ar[_effAr])_effAr=ar[ar.length-1]||null;   /* senaste aret */
    return j;
  }catch(e){_effFel=(e&&e.message)||String(e);return null;}}
function effVal(v){_effAr=v;try{renderCompare();}catch(e){}}
function effW(w){return w==null?'–':(w>=1000?(num(w/1000,2)+' kW'):(Math.round(w)+' W'));}

function effHTML(){
  if(!_eff)return '';
  var ar=Object.keys(_eff.ar).sort().reverse();
  if(!ar.length)return '';
  var valt=(_effAr&&_eff.ar[_effAr])?_effAr:ar[0];
  var lista=(_eff.ar[valt]||[]).slice().sort(function(a,b){
    return b.period.localeCompare(a.period);});
  var snitt=_eff.arSnitt&&_eff.arSnitt[valt];

  var h='<section class="panel">'+cmpHeadHtml('Medeleffekt','förbrukning i snitt',
    '<p style="margin:0 0 8px"><b>Vad huset drar i genomsnitt.</b> Månadens '
    +'förbrukning fördelad jämnt över dess timmar — alltså vad det skulle dra om '
    +'det drog lika mycket dygnet runt, natt som dag.</p>'
    +'<p style="margin:0 0 8px">Förbrukningen härleds ur tre mätare: '
    +'<b>produktion − såld + köpt</b>. Den räknar alltså med solel som aldrig '
    +'passerade elmätaren, vilket är det man vill veta — inte bara vad som köptes.</p>'
    +'<p style="margin:0 0 8px">Månadens längd spelar roll: 720 timmar i april mot '
    +'744 i maj är 3 % skillnad. Därför används varje månads faktiska timmar, och '
    +'årssnittet viktas på timmar i stället för att vara ett medelvärde av '
    +'månadssnitten.</p>'
    +'<p style="margin:0">Siffrorna kommer ur krönikans månadsposter, som går '
    +'ungefär ett år bakåt. Längre tillbaka finns inte i Homey Insights.</p>');

  h+='<div class="eff-top">';
  h+='<select class="cfg-sel eff-sel" onchange="effVal(this.value)">';
  ar.forEach(function(y){h+='<option value="'+y+'"'+(y===valt?' selected':'')+'>'+y+'</option>';});
  h+='</select>';
  if(snitt&&snitt.W!=null)h+='<div class="eff-ar"><span class="eff-arv">'+effW(snitt.W)+'</span>'
    +'<span class="eff-arl">snitt '+valt+' · '+snitt.manader+' mån</span></div>';
  h+='</div>';

  if(!lista.length){
    h+='<div class="ins-empty">Inga månader med fullständigt underlag för '+valt+'.</div>';
    return h+'</section>';
  }
  /* Stapel bakom talet: en lista med tal gar inte att jamfora med blicken. */
  var max=1;lista.forEach(function(m){if(m.W>max)max=m.W;});
  h+='<div class="eff-l">';
  lista.forEach(function(m){
    var mn=KRON_MAN[+m.period.slice(5,7)-1]||m.period;
    /* Inmatade månader markeras. En siffra som kommer utifrån ska aldrig se
       likadan ut som en räknad — annars går de inte att skilja åt i efterhand. */
    /* Allt som inte räknats ur Insights märks — oavsett om det matats in för
       hand eller kommer ur en export. Källan står i verktygstipset. */
    var inm=(m.kalla&&m.kalla!=='raknad');
    h+='<div class="eff-r'+(inm?' inm':'')+'" title="'+(inm?esc(m.kalla):'räknad ur Insights')+'">'
      +'<span class="eff-m">'+esc(kronVersal(mn))+(inm?'<i class="eff-i">·</i>':'')+'</span>'
      +'<span class="eff-b"><i style="width:'+Math.round(m.W/max*100)+'%"></i></span>'
      +'<span class="eff-w">'+effW(m.W)+'</span>'
      +'<span class="eff-k">'+num(m.kwh,0)+' kWh</span></div>';
  });
  h+='</div>';
  var kallor={};
  lista.forEach(function(x){if(x.kalla&&x.kalla!=='raknad')kallor[x.kalla]=1;});
  var kl=Object.keys(kallor);
  if(kl.length)
    h+='<div class="isub" style="margin-top:7px;opacity:.65">'
      +'<b>·</b> = '+esc(kl.join(', '))+' — från tid som Insights inte längre täcker.</div>';
  return h+'</section>';}
function notBortGet(){
  try{return JSON.parse(localStorage.getItem(KRON_BORT)||'{}')||{};}catch(e){return {};}}
function notBort(p){
  /* Att sopa undan är också att ha tagit ställning. Utan det här satt NY kvar i
     arkivet på en post man aktivt gjort sig av med. */
  try{kronLastSatt(p);}catch(e){}
  try{var o=notBortGet();o[p]=Date.now();
    var k=Object.keys(o).sort();while(k.length>120)delete o[k.shift()];
    localStorage.setItem(KRON_BORT,JSON.stringify(o));}catch(e){}}
function notAterstall(){try{localStorage.removeItem(KRON_BORT);}catch(e){}}
function dagTid(vilken){
  return (_dag&&_dag.tider&&_dag.tider[vilken])||(vilken==='kvall'?'20:00':'08:00');}
function dagTidSatt(){
  var m=$('dag-m'),k=$('dag-k');
  if(!m||!k)return;
  appPost('/dag',{tider:{morgon:m.value,kvall:k.value}}).then(function(r){
    if(r&&r.morgon){_dag=_dag||{notiser:[]};_dag.tider=r;}
  }).catch(function(){});}
/* Vad hände vid den senaste schemakontrollen? Frågan har varit omöjlig att
   besvara utan att gå in i appens inställningar — och en notis som uteblir är
   just då man vill veta. */
function dagSpar(){
  var e=$('dag-spar');if(!e)return;
  e.textContent='Hämtar…';
  appGet('/diag').then(function(d){
    var t=d&&d.dagTick;
    if(!t){e.textContent='Ingen kontroll har körts än. Timern startar med appen '
      +'och går var femte minut — har den just installerats, vänta fem minuter.';return;}
    e.textContent='Senaste: '+new Date(t.at).toLocaleString('sv-SE')
      +' (kl '+(t.klocka||'?')+')\n'
      +'Tider: '+(t.tider?(t.tider.morgon+' och '+t.tider.kvall+(t.tider.av?' — AVSTÄNGT':'')):'?')+'\n'
      +'Skrivet idag: '+JSON.stringify(t.sista||{})+'\n'
      +(Array.isArray(t.utfall)?t.utfall.join('\n'):String(t.utfall||''));
  }).catch(function(err){e.textContent='Kunde inte läsa: '+((err&&err.message)||err);});}

function dagProv(kvall){
  appPost('/dag',{kvall:!!kvall}).then(function(){
    _dag=null;_dagAt=0;
    return dagHamta(true);
  }).then(function(){
    try{krNotisUppdatera();}catch(e){}
    try{openNotiser();}catch(e){}
  }).catch(function(e){
    var el=$('sync-status');if(el)el.textContent='Kunde inte skriva: '+((e&&e.message)||e);});}
async function dagStilSynka(){
  if(_stilSkickad||!appKan())return false;
  _stilSkickad=true;
  try{
    var vill={},n=0;
    ['ton','form','hus','extra'].forEach(function(k){
      var v=(DAG_STIL&&DAG_STIL[k]||'').trim();
      if(v){vill[k]=v;n++;}
    });
    var har=(_dag&&_dag.stil)||{};
    var lika=(Object.keys(har).length===n);
    if(lika)for(var k2 in vill)if(har[k2]!==vill[k2]){lika=false;break;}
    if(lika)return false;
    await appPost('/dag',{stil:vill});
    _dag=null;_dagAt=0;
    return true;
  }catch(e){_stilSkickad=false;return false;}}

async function dagHamta(force){
  if(!appKan())return null;
  if(!force&&_dag&&Date.now()-_dagAt<5*60000)return _dag;
  try{
    var j=await appGet('/dag');
    if(!j||!Array.isArray(j.notiser))throw new Error('tomt svar');
    _dag=j;_dagAt=Date.now();_dagFel=null;
    try{if(await dagStilSynka())j=await appGet('/dag')||j;}catch(e){}
    _dag=j;
    try{krNotisUppdatera();}catch(e){}
    return j;
  }catch(e){_dagFel=(e&&e.message)||String(e);return null;}}

/* Alla notiser, nyast forst. Krönikeposter blir typ 'kronika', dagsnotiser
   typ 'dag'. Listan var byggd för flera slag från början — det var hela
   poängen med typ-fältet. */
function notLista(){
  if(!_kron&&!_dag)return [];
  var bort=notBortGet();
  var ut=[];
  /* Listan säger vad som ÄR oläst. Att väggplattan inte ska visa det är ett
     beslut för vyn, inte för datan — annars tappar den även räkningen, och
     verktygstipset kunde inte säga hur många som väntar. */
  /* _kron kan vara null när bara dagsnotiser hunnit hämtas — listan finns för
     flera slag, och ett saknat slag får inte fälla hela vyn. */
  var K2=_kron||{ar:[],manader:[]};
  (K2.ar||[]).forEach(function(x){ut.push({typ:'kronika',ar:true,period:x.period,
    tid:kronTid(x),rubrik:'Sammanfattning för '+x.period,sol:x.sol,ny:kronArNy(x)});});
  (K2.manader||[]).forEach(function(x){ut.push({typ:'kronika',ar:false,period:x.period,
    tid:kronTid(x),rubrik:'Sammanfattning för '+kronVersal(kronNamn(x.period)),sol:x.sol,ny:kronArNy(x)});});
  /* Dagsnotiserna. De har eget id i stället för period — en morgon och en kväll
     samma dygn är två olika notiser. */
  /* Dagsnotiser åldras vid midnatt, PÅ ALLA ENHETER. Har man inte läst
     gårdagens morgonrapport är den inte längre olöst utan gammal — dagens är
     på väg. Det avgörs av klockan och inte av lokal lagring, så det behöver
     inte synkas mellan telefon och platta. */
  var dagStart=(function(){var d=new Date();d.setHours(0,0,0,0);return d.getTime();})();
  if(_dag&&_dag.notiser)_dag.notiser.forEach(function(x){
    var fardsk=(x.at||0)>=dagStart;
    ut.push({typ:'dag',ar:false,period:x.id,tid:x.at,rubrik:x.rubrik,
      sol:null,kort:x.kort,kvall:x.nar==='kvall',
      ny:fardsk&&kronArNy({period:x.id,raknad_at:x.at})});});
  return ut.filter(function(x){return !bort[x.period];})
    .sort(function(a,b){return (b.tid||0)-(a.tid||0);});}

/* Kvar som namn; räkningen ligger i krOlasta så det bara finns en väg. */
function notOlasta(){return krOlasta();}

function notMarkAlla(){
  notLista().forEach(function(x){kronLastSatt(x.period);});
  try{krNotisUppdatera();}catch(e){}
  renderNotiser();}
/* Stänger den öppna notisen. Anropas när man lämnar notisvyn — annars sitter
   klockan kvar som tillbaka-knapp på startsidan, där det inte finns något att
   gå tillbaka till, och notisvyn öppnas mitt inne i en post nästa gång. */
function notStang(){
  if(_notOppen===null)return;
  _notOppen=null;
  try{renderNotiser();}catch(e){}
  try{krNotisUppdatera();}catch(e){}}

function openNotiser(){
  if(_suppressClick){_suppressClick=false;return;}
  try{document.body.classList.add('cmp-open');}catch(e){}
  try{showView('notiser');}catch(e){}
  renderNotiser();
  try{syncCmpHeader();}catch(e){}
  try{cmpIdleReset();}catch(e){}
  if(typeof fitScreen==='function')try{setTimeout(fitScreen,40);}catch(e){}}

function notOppna(p){
  _notOppen=p;
  kronLastSatt(p);
  try{krNotisUppdatera();}catch(e){}   /* klockan blir tillbaka-knapp */
  if(!_kronPost[p]){
    renderNotiser();
    kronPost(p).then(function(){renderNotiser();});
    return;
  }
  renderNotiser();}
function notTillbaka(){_notOppen=null;renderNotiser();try{krNotisUppdatera();}catch(e){}}

function renderNotiser(){
  var el=$('not-body');if(!el)return;
  _diN=0;
  if(_notOppen){el.innerHTML=notDetaljHTML(_notOppen);return;}
  el.innerHTML=notListaHTML();
  try{notSvep();}catch(e){}}

/* Ska oläst SYNAS på den här enheten? Väggplattan sitter i hallen; en
   markering där blir en påminnelse som aldrig kvitteras av rätt person. */
function notVisaNy(){return !IS_SAMSUNG_TABLET;}
function notListaHTML(){
  var l=notLista();
  if(!notVisaNy())l=l.map(function(x){var y={};for(var k in x)y[k]=x[k];y.ny=false;return y;});
  var h='<section class="panel">'+cmpHeadHtml('Notiser',
    l.length?(l.length+' st'):null,
    '<p style="margin:0 0 8px">Här samlas det som skrivits om huset. Just nu bara '
    +'månads- och årssammanfattningar; fler slag kan tillkomma.</p>'
    +'<p style="margin:0 0 8px"><b>Läst och bortsopat gäller den här enheten.</b> Att du '
    +'läst på plattan säger ingenting om vad du sett i telefonen, och en notis du '
    +'sopat undan här finns kvar där.</p>'
    +'<p style="margin:0">Dra en notis åt sidan för att ta bort den. '
    +'<button class="wxm-b" onclick="notAterstall();renderNotiser()">Återställ borttagna</button></p>');

  /* Saknas dagens notis, säg VARFÖR direkt här. Att gå till inställningarna för
     att förstå varför något uteblivit är ett steg för mycket — och frågan
     ställer man just när listan ser tom ut. */
  var tick=(_dag&&_dag.tick)||null;
  var idagK=(function(){var d=new Date();return d.getFullYear()+'-'
    +String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
  var harIdag=l.some(function(x){return x.typ==='dag'&&String(x.period||'').indexOf(idagK)===0;});
  if(!harIdag){
    var puls=(_dag&&_dag.puls)||null;
    var plan=(_dag&&_dag.plan)||null;
    /* PULSEN först. Är den gammal har timern inte gått alls, och då är det
       appen som inte lever — ett helt annat fel än en notis som fallerat, och
       det ska inte se likadant ut. */
    var dod=(!puls||Date.now()-puls>20*60000);
    if(dod){
      h+='<div class="not-diag varning"><b>Schemat verkar inte köra.</b> '
        +(puls?('Senaste kontrollen var '
          +Math.round((Date.now()-puls)/60000)+' minuter sedan; den ska ske var femte.')
         :'Ingen kontroll har körts sedan appen startade.')
        +' Starta om Homey-appen och titta igen.</div>';
    }else if(tick){
      var rader=Array.isArray(tick.utfall)?tick.utfall:[String(tick.utfall||'')];
      var vantar=rader.every(function(x){return /väntar till/.test(x);});
      h+='<div class="not-diag'+(vantar?'':' varning')+'">'
        +'<b>'+(vantar?'Inget skrivet än idag.':'Dagens notis uteblev.')+'</b> '
        +esc(rader.join(' · '))
        +(tick.at?(' <span style="opacity:.7">· kontrollerad '
          +new Date(tick.at).toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'})+'</span>'):'')
        +(plan&&plan.om!=null?(' <span style="opacity:.7">· nästa om '+plan.om+' min</span>'):'')
        +'</div>';
    }
  }

  if(!l.length){
    h+='<div class="ins-empty">Inga notiser. Sammanfattningen skrivs sista dagen i månaden.</div>';
    return h+'</section>';
  }
  var olasta=l.filter(function(x){return x.ny;}).length;
  if(olasta)h+='<div class="not-bar"><span>'+olasta+' oläst'+(olasta>1?'a':'')+'</span>'
    +'<button class="wxm-b" onclick="notMarkAlla()">Markera alla som lästa</button></div>';

  h+='<div class="not-l">';
  l.forEach(function(x){
    h+='<div class="not-r'+(x.ny?' ny':'')+'" data-per="'+esc(x.period)+'">'
      +'<div class="not-in" onclick="notOppna(\''+x.period+'\')">'
      +'<span class="not-ic">'+icon(x.typ==='dag'
        ?(x.kvall?'moon':'sun')
        :(x.ar?'clock-counter-clockwise':'house'))+'</span>'
      +'<span class="not-tx">'
      +'<span class="not-h">'+esc(x.rubrik)+'</span>'
      /* Tiden sist och ALLTID synlig: förhandsvisningen kortas i stället för att
         trycka ut den. "idag" utan klockslag går inte att skilja på morgon- och
         kvällsnotisen, och det är just den skillnaden man letar efter. */
      +'<span class="not-s"><span class="not-s-t">'
      +(x.kort?esc(x.kort):(x.sol!=null?(num(x.sol,0)+' kWh sol'):''))
      +'</span>'+(x.tid?('<span class="not-s-n"> · '+esc(notNar(x.tid))+'</span>'):'')+'</span>'
      +'</span>'
      +'<span class="not-p">'+(x.ny?'<i class="not-dot"></i>':'')+'›</span>'
      +'</div></div>';
  });
  return h+'</div></section>';}

function notNar(t){
  /* KALENDERDAGAR, inte förflutna dygn. (Date.now()-t)/86400000 gav 13 timmar
     för en notis kl 20 igår när klockan var 09 — alltså 0 dygn, alltså "idag",
     trots att det var en annan dag. Räkna från midnatt till midnatt i stället;
     det är så man själv menar "igår". */
  var d;
  try{
    var a=new Date(t), b2=new Date();
    a.setHours(0,0,0,0); b2.setHours(0,0,0,0);
    d=Math.round((b2-a)/86400000);
  }catch(e){d=Math.floor((Date.now()-t)/86400000);}
  /* Klockslag på dagens och gårdagens notiser. Utan det går morgon- och
     kvällsnotisen inte att skilja åt i listan. */
  var kl='';
  try{kl=' '+new Date(t).toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'});}catch(e){}
  if(d<=0)return 'idag'+kl;
  if(d===1)return 'igår'+kl;
  if(d===2)return 'i förrgår'+kl;
  if(d<30)return d+' dagar sedan';
  try{return new Date(t).toLocaleDateString('sv-SE');}catch(e){return '';}}

function notDetaljHTML(p){
  /* Dagsnotis? De ligger i _dag, inte i _kronPost, och har färdiga rutor. */
  var dn=(_dag&&_dag.notiser)?_dag.notiser.filter(function(x){return x.id===p;})[0]:null;
  if(dn)return notDagHTML(dn);
  var o=_kronPost[p];
  var ar=(String(p).length===4);
  var h='<section class="panel">';

  if(!o)return h+'<div class="ins-empty">Hämtar…</div></section>';
  /* Sex rutor for en manad, tolv for ett ar — alltid samma antal, sa sidan ser
     likadan ut varje gang och man vet var man ska titta. */
  h+=kronRuta(o,ar?12:8);
  h+=kronJmf(o);
  if(o.text)h+='<div class="kr-t">'+kronRapport(o.text)+'</div>';
  else h+='<div class="kr-t saknas">Ingen text skriven för den här perioden.</div>';
  h+=kronKulHTML(o,ar);
  return h+'</section>';}

/* Liten kurva av en serie. Bara form och riktning — en dagsnotis behöver inte
   avläsbara axlar, och en graf med rutnät i en popup blir bara plottrig. */
function miniGraf(pts,farg,enhet,xTid){
  /* En linje är bara ett specialfall av flera. Att ha två ritare gav olika
     axlar i olika popupar. */
  var f=(farg||'').replace(/^var\(--|\)$/g,'')||'gold';
  return multiGraf([{namn:'',farg:f,pts:pts||[]}],enhet,xTid);}

/* Flera linjer i samma diagram, med gemensam skala så att kurvorna går att
   jämföra. Egen skala per linje hade sett snyggare ut men ljugit: två kurvor
   som ligger på samma höjd skulle betyda olika saker. */
/* markT = tidpunkt att märka ut med en lodrät linje. Utan den går det inte att
   se VAR i natten lägstavärdet låg, och det är hela poängen med kurvan. */
function multiGraf(kurvor,enhet,xTid,markT){
  var k=(kurvor||[]).filter(function(x){return x&&x.pts&&x.pts.length>=2;});
  if(!k.length)return '';
  var lo=Infinity,hi=-Infinity,t0=Infinity,t1=-Infinity;
  k.forEach(function(x){x.pts.forEach(function(p){
    if(p.v<lo)lo=p.v; if(p.v>hi)hi=p.v;
    if(p.t<t0)t0=p.t; if(p.t>t1)t1=p.t;});});
  if(!(hi>lo)||!(t1>t0))return '';
  /* Luft för axlarna: 34 px till vänster för värdena, 16 px under för tiderna.
     Utan dem stod siffrorna utanför bilden. */
  /* vx var 34 för att ge plats åt värdena till vänster. Utan dem behövs bara
     samma luft som på höger sida, alltså 6 — kurvan blir bredare och sitter
     mitt i rutan i stället för förskjuten åt höger. */
  var W=320,H=112,vx=6,ax=14,top=6;
  var px=function(t){return vx+((t-t0)/(t1-t0))*(W-vx-6);};
  var py=function(v){return top+(1-(v-lo)/(hi-lo))*(H-top-ax);};
  /* x-axeln är epoktid i de flesta anropen, men prognosrutan skickar in
     timindex 0–23. Ett tal under 1e11 kan inte vara en tidsstämpel i ms, så
     etiketten får klockslaget räknat ur timmen i stället för ur epoken. */
  var avlEpok=(t1>1e11);
  var avlNamn='mg-'+k.map(function(x){return x.namn||'';}).join('_')+'-'+(enhet||'');
  var h='<svg class="mgraf" viewBox="0 0 '+W+' '+H+'">';
  /* Tre stödlinjer, utan värden. Talen lästes av här förut; nu står de i
     dragpunktens etikett i stället, och kurvan får bredden de tog. */
  [0,0.5,1].forEach(function(f){
    var y=top+f*(H-top-ax);
    h+='<line x1="'+vx+'" y1="'+y.toFixed(1)+'" x2="'+(W-6)+'" y2="'+y.toFixed(1)
      +'" stroke="var(--line)" stroke-width="1" opacity="'+(f===1?'0.9':'0.35')+'"/>';});
  h+=nollLinje(nollY(py,lo,hi),vx,W-6);
  /* Klockslagen ritades förut här inne, i tre <text> längst ned. De ligger
     numera i den gemensamma tidsaxeln under grafen, som alla andra grafer. */
  h+='</svg>';
  h=avlLager(avlNamn,h,{W:W,H:H,X:px,kl:(avlEpok?null:pgKl),
    ser:k.map(function(x){return {namn:x.namn||'',farg:'var(--'+(x.farg||'gold')+')',pts:x.pts,Y:py,
      fmt:function(v){return num(v,(hi-lo)<8?1:0)+(enhet||'');}};})});
  h+='<div class="mgraf-f">';
  k.forEach(function(x){
    h+='<span><i style="background:var(--'+(x.farg||'gold')+')"></i>'+esc(x.namn||'')
      +(enhet?'':'')+'</span>';});
  return h+'</div>';}

/* Popup för en ruta i en dagsnotis. Rutorna bär sitt eget underlag i .pop, så
   den här funktionen behöver inte veta vad slags notis den kom från. All
   förklaring ligger bakom i-knappen. */
function dagPop(gi,ri){
  var n=(_dag&&_dag.notiser)?_dag.notiser.filter(function(x){return x.id===gi;})[0]:null;
  var r=n&&n.rutor&&n.rutor[ri];
  if(!r||!r.pop)return;
  var P=r.pop, info='', kropp='';
  /* Finns rutan redan någon annanstans med en egen ruta: öppna DEN. Två popupar
     om samma sak glider isär, och den befintliga har mer i sig. */
  if(P.typ==='detalj'){
    if(P.vilken==='batttom'){try{btPop();}catch(e){}return;}
    try{openDetail(P.vilken);}catch(e){}
    return;
  }
  if(P.typ==='temp2'){
    info='<p style="margin:0">'+esc(P.text||'')+' Jämförelsetalen är från natten '
      +'som gick, inte från just nu — det är då skillnaden mellan rummen syns.</p>';
    kropp='<div class="krpop-v">'+num(P.nu,1)+' °</div><div class="krpop-l">';
    (P.jmf||[]).forEach(function(x){
      if(x[1]==null)return;
      kropp+='<div class="krpop-r"><span>'+esc(x[0])+'</span><b>'+num(x[1],1)+' °</b></div>';});
    kropp+='</div>';
    if(P.kurvor)kropp+=multiGraf(P.kurvor,' °');
  }else if(P.typ==='sopor'){
    info='<p style="margin:0">Hämtningen sker varannan fredag enligt Kungsbacka '
      +'kommuns schema. Datumen är inlagda till årsskiftet; därefter behöver listan '
      +'fyllas på. Att räkna ut dem ur en regel vore fel — helger och röda dagar '
      +'flyttar hämtningen, och det syns bara i schemat.</p>';
    kropp='<div class="krpop-svar ja">'+esc(P.text||'')+'</div><div class="krpop-l">';
    (P.kommande||[]).forEach(function(x){
      kropp+='<div class="krpop-r"><span>'+esc(x.dag)+' '+esc(x.datum)+'</span><b>'
        +(x.dygn===0?'idag':(x.dygn===1?'i morgon':('om '+x.dygn+' dygn')))+'</b></div>';});
    kropp+='</div>';
  }else if(P.typ==='temp'){
    info='<p style="margin:0 0 8px">Lägsta temperaturen mellan kl 18 och nu, ur '
      +'utomhusgivaren.</p>'
      +'<p style="margin:0">Uterummet och inomhus visas <b>vid samma tidpunkt</b> som '
      +'lägstavärdet, inte som de står nu — annars jämför man en kall natt med en '
      +'varm förmiddag. Poolen är utelämnad: den säger ingenting om en kall natt.</p>';
    kropp='<div class="krpop-v">'+num(P.min,1)+' °</div><div class="krpop-l">';
    if(P.nar)kropp+='<div class="krpop-r"><span>Kallast</span><b>'
      +new Date(P.nar).toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'})+'</b></div>';
    /* Utomhus står som stora talet överst — att upprepa det i listan är brus. */
    if(P.inneVid!=null)kropp+='<div class="krpop-r"><span>Inomhus då</span><b>'+num(P.inneVid,1)+' °</b></div>';
    if(P.uteVid!=null)kropp+='<div class="krpop-r"><span>Uterummet då</span><b>'+num(P.uteVid,1)+' °</b></div>';
    kropp+='</div>';
    if(P.kurvor)kropp+=multiGraf(P.kurvor,' °',true,P.nar);
    else if(P.serie)kropp+=miniGraf(P.serie,'var(--blue)',' °');
  }else if(P.typ==='prognos'){
    info='<p style="margin:0">Prognosen räknas i Homey-appen ur molntäcket från '
      +'Open-Meteo och panelernas läge — fyra takgrupper med olika lutning och '
      +'väderstreck. Den låses mellan kl 4 och 9 och skrivs aldrig om under dagen.</p>';
    kropp='<div class="krpop-v">'+num(P.kwh,1)+' kWh</div>';
    if(P.timmar&&P.timmar.length)
      kropp+=miniGraf(P.timmar.map(function(v,i){return {t:i,v:v/1000};}),'var(--solar)',' kW');
  }else return;
  var q=iqBtnHtml(info);
  krPopStang();
  var h='<div class="krpop-bak" id="krpop" onclick="if(event.target===this)krPopStang()">'
    +'<div class="krpop"><button class="krpop-x" onclick="krPopStang()" aria-label="stäng">'+icon('close')+'</button>'
    +'<div class="krpop-h"><span class="krpop-i">'+icon(r.ik||'gauge')+'</span>'
    +esc(r.namn)+q.btn+'</div>'+q.box+kropp+'</div></div>';
  var w=document.createElement('div');w.innerHTML=h;
  document.body.appendChild(w.firstChild);}

/* Talframhävning för dagsnotiser. Bredare än sammanfattningarnas: här skrivs
   "13,9 grader" och "03:20" i löptext, och just de talen är hela poängen med
   raden. kronTal() lämnas orörd — den gäller artiklar, där ett framhävt
   klockslag hade blivit rörigt. */
function dagTal(t){
  return String(t)
    /* Klockslag först, annars fångar sifferregeln bara timmen. */
    .replace(/\b(\d{1,2}:\d{2})\b/g,'<b class="kr-n2">$1</b>')
    .replace(/(\d[\d\s\u00a0]*(?:[.,]\d+)?)\s?(kWh|kW|W|kr|öre|mm|m\/s|°C|°|%|grader|timmar|h\b|min\b|dygn|st\b)/g,
      function(hel,tal,enh){return '<b class="kr-n2">'+tal.trim()+' '+enh+'</b>';});}

function notDagHTML(n){
  var h='<section class="panel">';
  h+='<div class="kr-rap"><div class="kr-rh">'
    +'<span class="kr-rhi">'+(n.nar==='kvall'?'🌙':'☀️')+'</span>'
    +'<span>'+esc(n.rubrik)+'</span></div></div>';
  if(n.rutor&&n.rutor.length){
    var r=n.rutor.map(function(x,ix){
      return '<div class="kr-c'+(x.pop?' kan':'')+'"'
        +(x.pop?(' onclick="dagPop(\''+esc(n.id)+'\','+ix+')"'):'')
        +'><span class="kr-ic" style="color:var(--'+(x.farg||'faint')+')">'
        +icon(x.ik||'gauge')+'</span><span class="kr-tx">'
        +'<span class="kr-l">'+esc(x.namn)+'</span>'
        +'<span class="kr-v">'+esc(x.varde)+'</span>'
        +(x.extra?('<span class="kr-x">'+esc(x.extra)+'</span>'):'')
        +'</span></div>';});
    h+='<div class="kr-grid">'+r.join('')+'</div>';
  }
  /* EGEN SÄTTNING. Sammanfattningarnas grammatik — ingress plus stycken — passar
     en artikel på fem stycken, inte fem korta rader. Här är varje rad en egen
     iakttagelse och ska se ut som en sådan: samma vikt, samma vänsterkant, en
     hårfin linje emellan så ögat vet var en tanke slutar och nästa börjar.

     Raderna med emoji får tecknet hängande i marginalen, och de utan får samma
     indrag — annars hoppar vänsterkanten fram och tillbaka. */
  var txt=n.text||(n.rader&&n.rader.join('\n'));
  if(txt){
    var rr=String(txt).split('\n').map(function(x){return x.trim();})
      .filter(function(x){return x.length;});
    /* Asterisken sist markerar att texten är skriven utan Gemini. Den ska sitta
       kvar men inte ta plats — en egen rad hade sett ut som ett fel. */
    var res=false;
    if(rr.length){
      var sis=rr[rr.length-1];
      if(/\s\*$/.test(sis)){res=true;rr[rr.length-1]=sis.replace(/\s\*$/,'');}
      else if(sis==='*'){res=true;rr.pop();}
    }
    h+='<div class="dn-t">';
    rr.forEach(function(t,i){
      /* EN emoji, inte ett block. Regexen tog `+` och svalde därför "🔌🕯" som
         ett enda tecken — två emoji trängdes i en 22 px kolumn och den ena låg
         halvt över texten. Nu tas första tecknet (plus eventuell
         variantväljare), och resten stannar i meningen där det hör hemma. */
      var m=t.match(/^((?:\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDC00-\uDFFF]|[\u2600-\u27BF\u2B00-\u2BFF\u203C-\u3299])\uFE0F?)\s*(.*)$/);
      var ik=m?m[1]:'', txt2=m?m[2]:t;
      h+='<p class="dn-r'+(i===0?' forst':'')+'">'
        +'<span class="dn-i">'+esc(ik)+'</span>'
        +'<span class="dn-x">'+dagTal(esc(txt2))+'</span></p>';
    });
    if(res)h+='<div class="dn-res" title="Skriven utan AI">*</div>';
    h+='</div>';
  }
  return h+'</section>';}

/* Svep at sidan tar bort. Ren pointer-hantering: inga bibliotek, och den far
   inte stjala vanliga tryck. */
function notSvep(){
  var rader=document.querySelectorAll('#not-body .not-r');
  Array.prototype.forEach.call(rader,function(r){
    var x0=0,y0=0,dx=0,drar=false,id=null;
    r.addEventListener('pointerdown',function(e){
      x0=e.clientX;y0=e.clientY;dx=0;drar=false;id=e.pointerId;
      r.style.transition='';});
    r.addEventListener('pointermove',function(e){
      if(id===null||e.pointerId!==id)return;
      var ax=e.clientX-x0, ay=e.clientY-y0;
      /* Vagrat svep bara nar rorelsen ar tydligt vagrat — annars kan man inte
         rulla listan med fingret. */
      if(!drar&&Math.abs(ax)>12&&Math.abs(ax)>Math.abs(ay)*1.5)drar=true;
      if(!drar)return;
      dx=ax;
      r.style.transform='translateX('+dx+'px)';
      r.style.opacity=String(Math.max(0.25,1-Math.abs(dx)/220));
      try{e.preventDefault();}catch(_){}});
    var slut=function(){
      if(id===null)return;
      id=null;
      if(!drar){r.style.transform='';r.style.opacity='';return;}
      r.style.transition='transform .18s ease,opacity .18s ease';
      if(Math.abs(dx)>90){
        r.style.transform='translateX('+(dx>0?400:-400)+'px)';
        r.style.opacity='0';
        var per=r.getAttribute('data-per');
        setTimeout(function(){notBort(per);try{krNotisUppdatera();}catch(e){}renderNotiser();},170);
      }else{
        r.style.transform='';r.style.opacity='';
      }
      drar=false;};
    r.addEventListener('pointerup',slut);
    r.addEventListener('pointercancel',slut);
    r.addEventListener('pointerleave',slut);
  });}
function renderInsikter(){
  var el=$('ins-body');if(!el)return;
  _diN=0;
  var s=null;try{s=buildInsState();}catch(e){s=null;}
  if(!s){el.innerHTML='<section class="panel"><div class="ins-empty">Insikter kräver enhetsdata – inväntar anslutning.</div></section>';return;}
  var out=[];
  for(var i=0;i<INS_GEN.length;i++){try{var r=INS_GEN[i](s);if(r&&r.big!=null&&(''+r.big).indexOf('null')<0)out.push(r);}catch(e){}}
  /* Krönikan hämtas i bakgrunden och ritas när svaret kommer. Svarar appen inte
     visas ingen sektion alls — hellre ingenting än en tom rubrik. */
  kronLista().then(function(j){var e2=$('ins-body');
    if(j&&e2&&!e2.dataset.kron){e2.dataset.kron='1';renderInsikter();}});
  if(!out.length){el.innerHTML='<section class="panel"><div class="ins-empty">Inga insikter att visa just nu.</div></section>'+kronHTML();return;}
  out.sort(function(a,b){return b.sc-a.sc;});
  /* Översta rutan är en highlight: rekord, extremer, avvikelser och kul fakta.
     Egen motor – de vanliga insikterna får ligga kvar i sina grupper nedanför. */
  var hl=null;try{hl=insHighlight(s);}catch(e){}
  /* Karusellen: highlighten forst, sedan de hogst rankade insikterna. Det som ligger
     i karusellen visas INTE igen i grupperna nedanfor - samma siffra tva ganger pa
     samma sida ar brus. Dedupas pa etiketten, sa aven de tva motorerna (INS_HL och
     INS_GEN) kan inte saga samma sak tva ganger. */
  var car=[], inCar={};
  if(hl&&hl.lab){car.push(hl);inCar[hl.lab]=1;}
  for(var j=0;j<out.length&&car.length<INS_CAR_MAX;j++){
    if(inCar[out[j].lab])continue;
    inCar[out[j].lab]=1; car.push(out[j]);}
  var rest=out.filter(function(x){return !inCar[x.lab];}).slice(0,20);
  var h=insCarHTML(car);
  INS_GROUPS.forEach(function(gr){
    var items=rest.filter(function(x){return x.g===gr[0];}).slice(0,gr[2]||4);
    if(!items.length)return;
    h+='<section class="panel"><div class="ww-h" style="margin-top:0">'+gr[1]+'</div>'+items.map(insRow).join('')+'</section>';
  });
  /* Horisontsiluetten dyker upp av sig sjalv nar skuggkartan mognat. */
  try{
    if(shmReady()){
      var sv=shmSVG();
      if(sv){
        var cv=shmCoverage();
        /* Förklaringen bakom i-knappen. Den är fyra rader lång och står under
           en bild som talar för sig själv — den behöver inte läsas varje gång. */
        h+='<section class="panel">'+cmpHeadHtml('Horisonten från taket','sedd från panelerna',
            '<p style="margin:0 0 8px">Den mörka formen är vad som skymmer solen — träd, hus, '
            +'skorsten — sedd från panelerna. Den är uppmätt ur <b>'+cv.mogna+' mogna celler</b> '
            +'i skuggkartan, alltså celler där tillräckligt många observationer samlats för att '
            +'formen ska vara att lita på.</p>'
            +'<p style="margin:0">Guldlinjen är solens bana idag, med hela timmar utsatta. '
            +'<b>Heldragen</b> där solen är fri, <b>streckad</b> där den står bakom något. '
            +'Den stora pricken visar var solen är just nu.</p>')
          +sv+'</section>';
      }
    }
  }catch(e){}
  try{h+=hinderKort();}catch(e){}
  try{h+=snoKort();}catch(e){}
  try{h+=zamKort();}catch(e){}
  el.innerHTML=h+kronHTML();
  /* Positionen ska överleva omritningen — annars börjar karusellen om var
     15:e sekund, vilket var precis det som gjorde den oanvändbar. */
  try{insCarAter(car.length);}catch(e){}
}
/* Skuggans arskostnad, per hinder, i kronor. */
function hinderKort(){
  var H=hinderAr(), P=prisSatser();
  var namn=SOL_HINDER.map(function(x){return x[0];});
  var rader=namn.map(function(n){return {n:n,kwh:H.hinder[n]};})
                .sort(function(a,b){return b.kwh-a.kwh;});
  var kr=function(v){return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g,'\u00a0');};
  var h='<section class="panel"'+'>'+cmpHead('Vad skuggan kostar','kronor per år','Träd, hus och skorstenar skymmer solpanelerna. Här står vad varje håll kostar dig per år, i kronor, så du kan avgöra om något är värt att kapa. Siffrorna tar hänsyn till att solen inte alltid skiner: ett träd som skymmer när det ändå är mulet kostar nästan ingenting. Hur ofta himlen faktiskt är klar just där solen står kommer från 43 års mätningar vid Göteborgs solstation. Två priskolumner, för el är värd olika mycket: säljer du den får du spotpriset, använder du den själv slipper du köpa dyrare el. Sanningen ligger mellan kolumnerna. Siffran är per år – ett träd kostar lika mycket nästa år igen.');
  h+='<table style="width:100%;border-collapse:collapse;font-size:.92em">';
  h+='<tr style="opacity:.7;text-align:left"><th style="padding:4px 0">Hinder</th>'
    +'<th style="text-align:right">kWh/år</th><th style="text-align:right">Såld el</th>'
    +'<th style="text-align:right">Ersatt köp</th></tr>';
  rader.forEach(function(r){
    h+='<tr><td style="padding:4px 0">'+esc(r.n)+'</td>'
      +'<td style="text-align:right">'+kr(r.kwh)+'</td>'
      +'<td style="text-align:right;opacity:.75">'+kr(r.kwh*P.salt)+' kr</td>'
      +'<td style="text-align:right;color:var(--gold)">'+kr(r.kwh*P.egen)+' kr</td></tr>';});
  h+='<tr style="border-top:1px solid rgba(128,128,128,.35)"><td style="padding:4px 0"><b>All skugga</b></td>'
    +'<td style="text-align:right"><b>'+kr(H.tot)+'</b></td>'
    +'<td style="text-align:right;opacity:.75"><b>'+kr(H.tot*P.salt)+' kr</b></td>'
    +'<td style="text-align:right;color:var(--gold)"><b>'+kr(H.tot*P.egen)+' kr</b></td></tr>';
  h+='</table>';
  h+='</section>';
  return h;}
/* Snon: hur manga dygn, vad den kostade, och nar den slappte. */
function snoKort(){
  var S=snowSason(), st=snowNow(), P=prisSatser();
  var o=snowEff(), k=dayKey(), idag=o[k];
  if(!S.dygn&&st!==1)return '';
  var n1=function(v){return v.toFixed(1).replace('.',',');};
  var h='<section class="panel"'+'>'+cmpHead('Snö på panelerna','vad den kostar','Snö på panelerna släcker dem nästan helt. Dashboarden ser det genom att jämföra hur mycket taket ger med hur mycket det borde ge en klar, kall dag. Blir det under en tredjedel ligger det snö där. Den räknar bara på dagar då himlen är klar nog att snö och moln går att skilja åt – annars vet den inte. Därför är siffran en undre gräns: det har troligen snöat mer än så. Snön släpper tvärt när panelen blir varm nog att smälta undertill, och klockslaget för det loggas.');
  if(st===1){
    h+='<div class="ins-hero-lab">Just nu</div><div class="ins-hero-row"><div class="ins-hero-big">Snötäckta</div></div>'
      +'<div class="ins-hero-txt">Himlen är klar nog och modellen väntar sig effekt – men taket ger under 30&nbsp;% av det. Det är inte moln.</div>';
  }else if(idag&&idag[2]){
    h+='<div class="ins-hero-txt">Snön släppte '+String(Math.floor(idag[2]/60)).padStart(2,'0')+':'
      +String(idag[2]%60).padStart(2,'0')+' i dag. Kvoten kommer tillbaka tvärt när cellen blir varm nog att smälta undertill.</div>';
  }
  h+='<div class="isub" style="margin-top:8px">Vintern '+S.ar+'/'+String(S.ar+1).slice(2)+': <b>'+S.dygn+'</b> snödygn, '
    +n1(S.timmar)+'&nbsp;h med täckta paneler, <b>'+n1(S.kwh)+'&nbsp;kWh</b> förlorat '
    +'≈ '+Math.round(S.kwh*P.salt)+'–'+Math.round(S.kwh*P.egen)+'&nbsp;kr.</div>';
  return h+'</section>';}

/* Barometern fran 1915 mot SMHI, med taket som domare. */
/* Minuter kvar tills en 3-timmarstrend gar att rakna, eller 0 om den redan gor det. */
function zamVantar(){
  var log=zamHist();
  if(!log.length)return 120;
  var oldest=log[0].t; log.forEach(function(x){if(x.t<oldest)oldest=x.t;});
  return Math.max(0,Math.round(120-(Date.now()-oldest)/60000));}
function zamDemoTog(){_zamDemo=!_zamDemo;try{renderInsikter();}catch(e){}}
function zamInfoHTML(G){
  var h='';
  h+='<p style="margin:0 0 8px"><b>En barometer från 1915.</b> Den gissar vädret ur fyra '
    +'saker och inget mer: lufttrycket, hur trycket ändrats de senaste tre timmarna, '
    +'vindriktningen och årstiden. Ingen satellit, ingen dator.</p>';
  h+='<p style="margin:0 0 8px"><b>Ditt eget hus dömer.</b> Hur mycket el panelerna gav '
    +'berättar hur soligt det blev, och regnmätaren om det regnade. Domen fälls kl 09 och '
    +'kan inte ändras i efterhand — utfallet fylls i dagen därpå.</p>';
  h+='<p style="margin:0 0 8px"><b>Lägre poäng är bättre.</b> Regnet mäts med Brier-poäng, '
    +'soligheten med medelfel. <b>0,25</b> är vad man får genom att gissa femtio–femtio '
    +'varje dag — allt under det är bättre än slumpen.</p>';
  h+='<p style="margin:0 0 8px"><b>Jämförelsen mot SMHI dröjer.</b> Den kräver '+ZAM_MIN
    +' dygn där båda lämnat en prognos, och SMHI publicerar bara den som gäller just nu. '
    +'Deras kolumn går alltså inte att fylla i efterhand utan bara samla framåt'
    +(G?(' — '+Math.max(G.hnb||0,G.hnk||0)+' klara hittills'):'')+'.</p>';
  if(G&&G.bf)h+='<p style="margin:0 0 8px">'+G.bf+' av dygnen är <b>återskapade</b> ur '
    +'tryck- och regnhistoriken i Homey Insights. Barometern behöver bara trycket kl 09, '
    +'3-timmarstrenden och vindriktningen, och allt det finns kvar i efterhand.</p>';
  h+='<p style="margin:0 0 8px">'
    +(_zamKalla==='app'
      ? ('Tavlan kommer från <b>Homey-appen</b>'+(_zamAppN?(' ('+_zamAppN+' dygn)'):'')+', som fäller '
         +'domen och fyller i utfallet även när dashboarden är stängd. SMHI-kolumnen fylls här, '
         +'eftersom deras prognos bara går att fånga samma dag.')
      : (_zamKalla==='lokal'
         ? ('Räknas <b>här i dashboarden</b>'+(_appFel?(' – appen svarade inte ('+esc(_appFel)+')'):'')+'.')
         : 'Räknas här i dashboarden.'))
    +'</p>';
  if(!isDemo()&&typeof BASE!=='undefined'&&BASE&&!CONFIG.DATA_URL){
    var bf=zamBfInfo(), sy=zamSyncInfo();
    h+='<div style="margin-top:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
      +'<button class="wxm-b" onclick="zamBackfillClick(this)">Hämta historik</button>'
      +'<button class="wxm-b'+(_zamDemo?' on':'')+'" onclick="zamDemoTog()">'
      +(_zamDemo?'Dölj exempel':'Visa exempel')+'</button></div>';
    h+='<p style="margin:6px 0 0;opacity:.75" id="zam-bf-msg">'
      +(bf.t?('Historiken hämtades '+new Date(bf.t).toLocaleDateString('sv-SE')+' · '+(bf.lagt||0)+' dygn tillagda')
            :'Hämta historik fyller på tavlan ur Homey Insights.')
      +'</p>';
    h+='<p style="margin:6px 0 0;opacity:.7">Tavlan sparas i Homey-variabeln <b>'+ZAM_VAR+'</b>'
      +(sy.t?(' · senast '+new Date(sy.t).toLocaleString('sv-SE',{dateStyle:'short',timeStyle:'short'})+', '+sy.n+' dygn'):' (ännu inte skriven)')
      +'. Den ligger utanför den vanliga backupen, så den aldrig offras när utrymmet tryter.</p>';
  }else{
    h+='<div style="margin-top:10px"><button class="wxm-b'+(_zamDemo?' on':'')+'" onclick="zamDemoTog()">'
      +(_zamDemo?'Dölj exempel':'Visa exempel')+'</button></div>';
  }
  return h;}
/* Hur tavlan kommer se ut när jämförelsen öppnat. Siffrorna är påhittade men
   rimliga: barometern brukar hålla jämna steg med SMHI på regn och tappa på
   solighet, där en molnfri morgon inte säger något om eftermiddagen. */
function zamDemoPoang(){
  return {n:24,nb:24,nk:24,nsb:22,nsk:22,bf:11,
    zb:0.191,sb:0.148,zk:0.213,sk:0.166,
    hnb:22,hnk:22,hzb:0.188,hsb:0.147,hzk:0.209,hsk:0.163};}
function zamKort(){
  var Z=zambretti();
  if(!Z){
    /* RATTAT v188: kortet forsvann helt utan 3h-trend. En funktion som tyst utelamnar
       sig sjalv gar inte att hitta - man vet inte om den ar trasig, avstangd eller
       aldrig byggd. Nu syns den och sager vad den vantar pa. */
    var P=zamPress();
    if(P==null)return '';        /* ingen barometer alls - da finns inget att vanta pa */
    var kvar=zamVantar();
    var h0='<section class="panel">'+cmpHeadHtml('Zambretti 1915','barometern mot SMHI',zamInfoHTML(null));
    h0+='<div class="ins-hero-lab">'+Math.round(P)+'&nbsp;hPa</div>';
    h0+='<div class="ins-hero-row"><div class="ins-hero-big" style="font-size:1.1em;opacity:.7">Samlar tryckhistorik</div></div>';
    h0+='<div class="isub" style="margin-top:8px;opacity:.8">Domen kräver tryckets '
      +'<b>3-timmarstrend</b> – utan den vet 1915 års tabell inte om vädret är på väg upp eller ner. '
      +(kvar>0?('Cirka <b>'+(kvar>=60?(Math.floor(kvar/60)+' h '+(kvar%60)+' min'):(kvar+' min'))+'</b> kvar.')
              :'Trenden borde finnas – tryckloggen kan ha luckor.')
      +'</div>';
    return h0+'</section>';
  }
  /* Exempelläget byter BARA ut poängen, inte domen. Dagens väder är verkligt även
     när man tittar på hur tavlan kommer se ut. */
  var G=_zamDemo?zamDemoPoang():zamPoang();
  var n2=function(v){return v==null?'–':v.toFixed(2).replace('.',',');};
  var pil=Z.tr>0.6?'stigande':(Z.tr<-0.6?'fallande':'stillastående');
  var h='<section class="panel">'+cmpHeadHtml('Zambretti 1915','barometern mot SMHI',zamInfoHTML(G));
  h+='<div class="ins-hero-lab">'+Z.bok+' · '+Math.round(Z.hpa)+'&nbsp;hPa, '+pil
    +' '+(Z.tr>0?'+':'')+n2(Z.tr)+'&nbsp;hPa/3h</div>';
  h+='<div class="ins-hero-row"><div class="ins-hero-big" style="font-size:1.3em">'+esc(Z.txt)+'</div></div>';
  if(_zamDemo)h+='<div class="isub" style="margin-top:8px;color:var(--gold);font-weight:700">'
    +'Exempel · så här ser tavlan ut efter '+ZAM_MIN+' jämförbara dygn. Siffrorna nedan är påhittade.</div>';

  var vinn=function(a,b){return (a==null||b==null)?'' : (a<b?' style="color:var(--ok)"':'');};
  var rad=function(namn,n,v1,v2){
    return '<tr><td style="padding:4px 0">'+namn+'<span style="opacity:.55"> · '+n+' dygn</span></td>'
      +'<td style="text-align:right"'+vinn(v1,v2)+'>'+n2(v1)+'</td>'
      +(v2===undefined?'':'<td style="text-align:right"'+vinn(v2,v1)+'>'+n2(v2)+'</td>')+'</tr>';};
  /* Barometerns egen traffbild. Den finns sa fort det finns utfall att jamfora mot,
     och fylls pa direkt av de aterskapade dygnen. */
  if(G.nb>=3||G.nk>=3){
    h+='<div class="isub" style="margin-top:12px;font-weight:800;opacity:.9">Barometern mot verkligheten</div>';
    h+='<table style="width:100%;border-collapse:collapse;font-size:.92em;margin-top:4px">';
    h+='<tr style="opacity:.7;text-align:left"><th style="padding:4px 0">Lägre är bättre</th>'
      +'<th style="text-align:right">Zambretti</th></tr>';
    h+=rad('Regn (Brier)',G.nb,G.zb);
    h+=rad('Solighet (medelfel)',G.nk,G.zk);
    h+='</table>';
  }
  /* Sjalva tavlan mot SMHI - bara dygn dar BADA lamnat en prognos, annars jamfors
     olika manga dygn med varandra och siffrorna sager ingenting. */
  if(G.hnb>=ZAM_MIN||G.hnk>=ZAM_MIN){
    h+='<div class="isub" style="margin-top:12px;font-weight:800;opacity:.9">Mot SMHI · samma dygn</div>';
    h+='<table style="width:100%;border-collapse:collapse;font-size:.92em;margin-top:4px">';
    h+='<tr style="opacity:.7;text-align:left"><th style="padding:4px 0">Lägre är bättre</th>'
      +'<th style="text-align:right">Zambretti</th><th style="text-align:right">SMHI</th></tr>';
    h+=rad('Regn (Brier)',G.hnb,G.hzb,G.hsb);
    h+=rad('Solighet (medelfel)',G.hnk,G.hzk,G.hsk);
    h+='</table>';
  }else{
    h+='<div class="isub" style="margin-top:10px;opacity:.75">Mot SMHI öppnar efter '+ZAM_MIN
      +' jämförbara dygn · '+Math.max(G.hnb,G.hnk)+' klara.</div>';
  }
  return h+'</section>';}

/* Poolen mot havet - vad uppvarmningen faktiskt koper dig. */
function havKort(){
  var pool=cap(DEV.pooltemp,'measure_temperature'), hav=FEED.sea;
  if(hav==null&&isDemo())hav=17.4;              /* demo: havet i juli pa vastkusten */
  if(pool==null||!isFinite(pool)||hav==null||!isFinite(hav))return '';
  var d=pool-hav, n1=function(v){return v.toFixed(1).replace('.',',');};
  var h='<section class="panel"'+'>'+cmpHead('Poolen mot havet','skillnaden','Poolen mot havet. Skillnaden är vad uppvärmningen köper dig – havet är gratis. På hösten vänder det: havet har en hel sommars värme lagrad och håller den längre än poolen gör. Havstemperaturen är en väderprognos för din badpunkt, inte en mätning i vattnet.');
  h+='<div class="ins-hero-row"><div class="ins-hero-big">'+(d>=0?'+':'')+n1(d)+'&nbsp;<small>°C</small></div></div>';
  h+='<div class="ins-hero-txt">Poolen '+n1(pool)+'&nbsp;°C, havet '+n1(hav)+'&nbsp;°C.</div>';
  var txt;
  if(d>4)txt='Det är vad uppvärmningen köper dig. Havet är gratis och '+n1(d)+'&nbsp;°C kallare.';
  else if(d>1)txt='Poolen leder, men knappt. Just nu gör uppvärmningen inte mycket mer än havet gör av sig självt.';
  else if(d>-1)txt='Jämnt lopp. Havet har hunnit ikapp – poolvärmen betalar för någon tiondel.';
  else txt='Havet är varmare än poolen. Det händer på hösten: havet har en sommars värme lagrad och släpper den långsamt.';
  h+='<div class="isub" style="margin-top:8px">'+txt+'</div>';
  return h+'</section>';}
function openInsikter(){if(_suppressClick){_suppressClick=false;return;}try{notStang();}catch(e){}try{document.body.classList.add('cmp-open');}catch(e){}try{showView('insikter');}catch(e){}renderInsikter();try{syncCmpHeader();}catch(e){}cmpIdleReset();if(typeof fitScreen==='function')try{setTimeout(fitScreen,40);}catch(e){}try{if(document.scrollingElement)document.scrollingElement.scrollTop=0;var iv=$('view-insikter');if(iv&&iv.scrollTop!=null)iv.scrollTop=0;}catch(e){}}
function openVader(){if(_suppressClick){_suppressClick=false;return;}try{notStang();}catch(e){}try{document.body.classList.add('cmp-open');}catch(e){}try{showView('vader');}catch(e){}renderVader();try{syncCmpHeader();}catch(e){}cmpIdleReset();if(typeof fitScreen==='function')try{setTimeout(fitScreen,40);}catch(e){}try{if(document.scrollingElement)document.scrollingElement.scrollTop=0;var vv=$('view-vader');if(vv&&vv.scrollTop!=null)vv.scrollTop=0;}catch(e){}}
function closeInsikter(){if(_cmpIdle){clearTimeout(_cmpIdle);_cmpIdle=null;}try{document.body.classList.remove('cmp-open');}catch(e){}try{showView('flode');}catch(e){}if(typeof fitScreen==='function')try{setTimeout(fitScreen,40);}catch(e){}}
function buildBoughtYear(){
  _diN=0;
  var P=(PAL&&PAL[curTheme])||{};
  var nK=function(v){return (v==null?'–':String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g,'\u00a0'));};
  var cy=new Date().getFullYear();
  var yrsAsc=[cy-2,cy-1,cy];
  var statsAsc=yrsAsc.map(function(yr){return yearStats(yr);});
  var cur=yearStats(cy);
  var curMs=SEED_MONTHS.filter(function(m){return m.m.slice(0,4)===String(cy);}).map(function(m){return m.m.slice(5);});
  var MB=MABBR;
  function mval(a,k){if(!a)return null;if(k==='solbatt')return (a.sol||0)+(a.batt||0);return a[k];}
  function spMetric(yr,k,hib){if(!curMs.length)return null;var shared=SEED_MONTHS.filter(function(m){return m.m.slice(0,4)===String(yr)&&curMs.indexOf(m.m.slice(5))>=0;}).map(function(m){return m.m.slice(5);});if(!shared.length)return null;var b=periodAgg(yr,shared),a=periodAgg(cy,shared);if(!a||!b)return null;var bv=mval(b,k),av=mval(a,k);if(bv==null||av==null||bv===0)return null;var diff=Math.round((av-bv)/bv*100);var good=(diff===0?null:(hib?diff>0:diff<0));var cls=(diff===0?'ze':(good?'up':'dn'));var arrow=diff<0?'\u25bc':diff>0?'\u25b2':'\u25cf';var val=(diff===0?arrow+' 0 %':arrow+' '+Math.abs(diff)+' %');return {year:yr,diff:diff,cls:cls,first:b.first,last:b.last,val:val};}
  var spL=function(s){return s.first!=null?(' \u00b7 '+MB[s.first-1]+((s.last&&s.last!==s.first)?('\u2013'+MB[s.last-1]):'')):'';};
  function hero(title,k,iconName,iconCol,hib,info){
    if(!cur)return '';
    var val=mval(cur,k);
    var sp2=spMetric(cy-2,k,hib),sp1=spMetric(cy-1,k,hib);
    var id='di'+(_diN++);
    var badges='';
    if(sp2)badges+='<span class="cmp-badge '+sp2.cls+'">'+sp2.val+' <em>mot '+(cy-2)+spL(sp2)+'</em></span>';
    if(sp1)badges+='<span class="cmp-badge '+sp1.cls+'">'+sp1.val+' <em>mot '+(cy-1)+spL(sp1)+'</em></span>';
    var span=(cur.first!=null?periodLabel(cur):'');
    var hh='<div class="cmp-hero">';
    hh+='<div class="cmp-hero-top"><span class="cmp-hero-ic" style="color:'+iconCol+'">'+icon(iconName)+'</span><div class="cmp-hero-tx"><div class="cmp-hero-lbl">'+esc(title)+(span?(' \u00b7 '+span):'')+(info?' <span class="di-q" onclick="diTog(\''+id+'\')">i</span>':'')+'</div><div class="cmp-hero-v">'+nK(val)+' <small>kWh</small></div></div></div>';
    if(info)hh+='<div class="drow-info" id="'+id+'">'+esc(info)+'</div>';
    if(badges)hh+='<div class="cmp-hero-badges">'+badges+'</div>';
    hh+='</div>';
    return hh;
  }
  var h='';
  h+=hero('Förbrukning','forbr','plug','var(--blue)',false,INFO.forbr);
  h+=hero('Köpt','kopt','lightning','var(--hot)',false,INFO.kopt);
  h+=hero('Använd sol · inkl. batteri','solbatt','sun','var(--gold)',true,INFO.solbatt);
  h+='<div class="cmp-hero-note">Procenttalen jämför samma månader föregående år.</div>';
  var shown=statsAsc.filter(function(s){return s;});
  if(shown.length){
    var head=shown.map(function(s){var isC=(s.year===cy);return '<div class="cmp-y'+(isC?' cur':'')+'">'+s.year+'<small>'+yearLabel(s,isC)+'</small></div>';}).join('');
    h+='<div class="ww-h">Jämförelse per år <span style="color:var(--faint);font-weight:600;text-transform:none;letter-spacing:0"> \u00b7 kWh</span></div>';
    h+='<div class="cmp">';
    h+='<div class="cmp-row cmp-head"><div class="cmp-k"></div>'+head+'</div>';
    function row(lbl,k,info){var cells=shown.map(function(s){var isC=(s.year===cy),v=mval(s,k);return '<div class="cmp-v'+(isC?' cur':'')+'">'+(v==null?'–':nK(v))+'</div>';}).join('');var id='di'+(_diN++);var r='<div class="cmp-row"><div class="cmp-k">'+esc(lbl)+(info?' <span class="di-q" onclick="diTog(\''+id+'\')">i</span>':'')+'</div>'+cells+'</div>';if(info)r+='<div class="drow-info cmp-info" id="'+id+'">'+esc(info)+'</div>';return r;}
    h+=row('Förbrukning','forbr',INFO.forbr);
    h+=row('Köpt','kopt',INFO.kopt);
    h+=row('Sålt','sald',INFO.sald);
    h+=row('Solproduktion','prod',INFO.prod);
    h+=row('Använd sol (inkl. batteri)','solbatt',INFO.solbatt);
    h+='</div>';
  }
  var yc={};yc[cy]=(P.warm||'#e8933a');yc[cy-1]=(P.green||'#7bc47f');yc[cy-2]=(P.blue||'#5b8def');
  h+='<div class="ww-h">Förbrukning per månad <span style="color:var(--faint);font-weight:600;text-transform:none;letter-spacing:0"> \u00b7 kWh</span></div>'+yearOverlayChart('f',yc,'g2-f');
  h+='<div class="ww-h">Solproduktion per månad <span style="color:var(--faint);font-weight:600;text-transform:none;letter-spacing:0"> \u00b7 kWh</span></div>'+yearOverlayChart('p',yc,'g2-p');
  var impT=cap(DEV.pulse,'meter_power.imported'),expT=cap(DEV.pulse,'meter_power.exported'),solT=cap(DEV.solar,'meter_power');
  var solUsedT=(solT!=null&&expT!=null)?Math.max(0,solT-expT):null,forbrT=(impT!=null&&solUsedT!=null)?impT+solUsedT:null;
  h+='<div class="cmp-since"><span>Sedan start</span><span>'+(forbrT!=null?nK(forbrT)+' kWh förbrukat':'\u2013')+(impT!=null?' \u00b7 '+nK(impT)+' köpt':'')+(expT!=null?' \u00b7 '+nK(expT)+' sålt':'')+'</span></div>';
  return h;
}

function metricVal(a,k){if(!a)return null;if(k==='solbatt')return (a.sol||0)+(a.batt||0);return a[k];}
function lastFullMonth(){var n=new Date();var m=n.getMonth()+1;var done=(n.getDate()===new Date(n.getFullYear(),n.getMonth()+1,0).getDate());return done?m:(m-1);}
function metricDiff(yr,key,hib,mode){
  var cy=new Date().getFullYear(),av,bv;
  if(mode==='total'){
    var a=yearStats(cy),b=yearStats(yr);if(!a||!b)return null;
    av=metricVal(a,key);bv=metricVal(b,key);
  }else{
    var curMs=SEED_MONTHS.filter(function(m){return m.m.slice(0,4)===String(cy);}).map(function(m){return m.m.slice(5);});
    if(mode==='wholemonth'){curMs=curMs.filter(function(mm){return (+mm)<=lastFullMonth();});}
    if(!curMs.length)return null;
    var shared=SEED_MONTHS.filter(function(m){return m.m.slice(0,4)===String(yr)&&curMs.indexOf(m.m.slice(5))>=0;}).map(function(m){return m.m.slice(5);});
    if(!shared.length)return null;
    var pa=periodAgg(cy,shared),pb=periodAgg(yr,shared);if(!pa||!pb)return null;
    av=metricVal(pa,key);bv=metricVal(pb,key);
  }
  if(bv==null||av==null||bv===0)return null;
  var diff=Math.round((av-bv)/bv*100),good=(diff===0?null:(hib?diff>0:diff<0));
  var cls=(diff===0?'ze':(good?'up':'dn')),arrow=diff<0?'\u25bc':diff>0?'\u25b2':'\u25cf';
  return {diff:diff,cls:cls,val:(diff===0?arrow+' 0 %':arrow+' '+Math.abs(diff)+' %')};
}
function samePeriodDiff(yr,key,hib){
  var cy=new Date().getFullYear();
  var curMs=SEED_MONTHS.filter(function(m){return m.m.slice(0,4)===String(cy);}).map(function(m){return m.m.slice(5);});
  if(!curMs.length)return null;
  var shared=SEED_MONTHS.filter(function(m){return m.m.slice(0,4)===String(yr)&&curMs.indexOf(m.m.slice(5))>=0;}).map(function(m){return m.m.slice(5);});
  if(!shared.length)return null;
  var b=periodAgg(yr,shared),a=periodAgg(cy,shared);if(!a||!b)return null;
  var bv=metricVal(b,key),av=metricVal(a,key);if(bv==null||av==null||bv===0)return null;
  var diff=Math.round((av-bv)/bv*100),good=(diff===0?null:(hib?diff>0:diff<0));
  var cls=(diff===0?'ze':(good?'up':'dn')),arrow=diff<0?'\u25bc':diff>0?'\u25b2':'\u25cf';
  return {diff:diff,cls:cls,val:(diff===0?arrow+' 0 %':arrow+' '+Math.abs(diff)+' %')};
}
/* Alternativ energipopup: enkel år-mot-år-jämförelse med stapel per år och infoknappar */
function buildEnergyPopupAlt(){
  _diN=0;
  var P=(PAL&&PAL[curTheme])||{};
  var cy=new Date().getFullYear();
  var yc={};yc[cy]=(P.warm||'#e8933a');yc[cy-1]=(P.green||'#7bc47f');yc[cy-2]=(P.blue||'#5b8def');
  var yrs=[cy-2,cy-1,cy];
  var stats={};yrs.forEach(function(y){stats[y]=yearStats(y);});
  var nK=function(v){return (v==null?'–':String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g,'\u00a0'));};
  var h='<div class="alt-hd"><span class="alt-hd-ic">'+icon('plug')+'</span><div><div class="alt-hd-t">Jämförelse · tre år</div><div class="alt-hd-s">Förbrukning &amp; produktion mot '+(cy-2)+' och '+(cy-1)+'</div></div></div>';
  h+='<div class="alt-lg">'+yrs.map(function(y){var s=stats[y];return '<span><i style="background:'+yc[y]+'"></i>'+y+(s?' <em>'+yearLabel(s,y===cy)+'</em>':'')+'</span>';}).join('')+'</div>';
  function metric(title,key,iconName,col,hib,info){
    var vals=yrs.map(function(y){return metricVal(stats[y],key);});
    var max=Math.max.apply(null,vals.map(function(v){return v||0;}))||1;
    var id='di'+(_diN++);
    var rows=yrs.map(function(y){var v=metricVal(stats[y],key),w=(v?Math.max(2,Math.round(v/max*100)):0),isC=(y===cy);
      var badge='';if(isC&&hib!=null){var dd=samePeriodDiff(cy-1,key,hib);if(dd)badge=' <span class="cmp-badge '+dd.cls+' altpct">'+dd.val+'</span>';}
      return '<div class="cmpb-row"><span class="cmpb-y'+(isC?' cur':'')+'">'+y+'</span><div class="cmpb-track"><i style="width:'+w+'%;background:'+yc[y]+'"></i></div><span class="cmpb-v">'+nK(v)+badge+'</span></div>';}).join('');
    return '<div class="cmpb"><div class="cmpb-h"><span class="cmpb-ic" style="color:'+col+'">'+icon(iconName)+'</span><span class="cmpb-t">'+esc(title)+'</span>'+(info?'<span class="di-q" onclick="diTog(\''+id+'\')">i</span>':'')+'</div>'+(info?'<div class="drow-info" id="'+id+'">'+esc(info)+'</div>':'')+rows+'</div>';
  }
  h+=metric('Förbrukning','forbr','plug','var(--blue)',false,INFO.forbr);
  h+=metric('Producerat','prod','sun','var(--gold)',true,INFO.prod);
  h+=metric('Använt från solen','sol','leaf','var(--ok)',true,INFO.sol);
  h+=metric('Köpt','kopt','lightning','var(--hot)',false,INFO.kopt);
  h+=metric('Sålt','sald','lightning',(P.green||'#7bc47f'),true,INFO.sald);
  var anyBatt=yrs.some(function(y){return stats[y]&&stats[y].batt;});
  if(anyBatt)h+=metric('Använt från batteri','batt','battery-high','var(--cyan)',true,INFO.batt);
  var span=(stats[cy]&&stats[cy].first!=null)?periodLabel(stats[cy]):'pågående';
  h+='<div class="cmp-hero-note">Kilowattimmar per år · '+cy+' visar '+span+'. Procenttalen jämför samma månader föregående år (grönt = bättre).</div>';
  h+='<div class="alt-hint">Håll kvar fingret för att växla tillbaka</div>';
  return h;
}
function energyPopupRender(){return _energyAlt?buildEnergyPopupAlt():buildEnergyPopup();}
function toggleEnergyVariant(){_energyAlt=!_energyAlt;var bd=$('dlg-body');if(bd)bd.innerHTML=energyPopupRender();try{dlgTop();}catch(e){}}
/* BATTERIETS TECKEN. measure_power från batteriet räknar tvärtom mot hur man
   tänker: negativt när batteriet LADDAS. Kontrollerat mot Insights 2026-08-21:
     12:20–13:33  energy_power ≈ +2650 W   och nivån steg 24 % → 34 %
     14:20–15:28  energy_power ≈ −3900 W   och nivån föll 30 % → 13 %
   Grafen ritade measure_power rått, därför pekade kurvan neråt samtidigt som
   procentlinjen steg — fysiskt omöjligt, och just det Markus såg. Här vänds
   tecknet vid ritningen: positivt = laddar, negativt = laddar ur.
   Rutorna på startsidan rörs inte; de tar redan beloppet och hämtar tecknet ur
   battery_charging_state. */
/* DE FYRA KURVORNA DEFINIERAS EN GÅNG. Dygnsvyn och historiken ritade samma
   sak från två ställen, och det är bara en tidsfråga innan de glider isär.
   kalla='live' tar dashboardens egen dygnshistorik, 'hist' tar Insights.
   Skillnaden i tecken hör till källan, inte till grafen: measure_power räknar
   tvärtom, energy_power rätt. */
function energiSerier(kalla,cid){
  var P=(PAL&&PAL[curTheme])||{};
  /* För idag och igår finns tätare serier hämtade var för sig. */
  var H=HIST;
  /* Lång period: samma serier, men ur Insights (histV). */
  if(kalla!=='hist'&&cid&&grafLang(cid)){
    H={solar:histV('solar',cid),house:histV('house',cid),grid:histV('grid',cid),batt:histV('batt',cid)};}
  var bp=histV('battpow',cid,battPowSerie());
  return {
    linjer:[
      {key:'solar',pts:H['solar']||[],col:(P.sun||'#f2b705'),label:'Solproduktion'},
      {key:'house',pts:H['house']||[],col:(P.warm||'#e8933a'),label:'Förbrukning'},
      /* Grön när batteriet laddar, gul när det laddar ur — samma som
         husbatteriets graf (v685). */
      {key:'batt', pts:bp,            col:(P.green||'#7bc47f'),col2:(P.gold||'#ebcb8b'),label:'Batteri'},
      /* Elnätet (Pulse): positivt = köper, negativt = säljer — samma tecken som
         elnätsrutans egen graf. Blått som dess köp-färg, så det känns igen.
         Egen fmt: dragpunkten säger "köper 1,2 kW"/"säljer 0,8 kW" i stället
         för ett naket minus som man måste tolka. */
      {key:'grid', pts:H['grid']||[], col:(P.blue||'#81a1c1'),col2:(P.green||'#a3be8c'),label:'Elnät',
       fmt:function(v){return (v<0?'säljer ':'köper ')+fmtW(Math.abs(v));}}
    ],
    procent:{key:'battpct',pts:(H['batt']||[]),
             col:(P.cyan||'#57b6c2'),label:'Batteri %'}
  };
}
