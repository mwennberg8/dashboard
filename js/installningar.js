/* js/installningar.js — Enhetsregistret, huvudikonen, knapparna, konfigurationen och inställningarna, inloggningen, första uppstarten och suddigt tills live.
 *
 * Filen innehåller BARA funktionsdeklarationer. Konstanter, tillstånd och allt
 * som körs direkt vid laddning ligger i js/start.js, som laddas sist, under
 * rubriken [installningar.js]. En funktion går att anropa oavsett vilken fil den står
 * i, men kod som körs vid laddning kan här anropa en funktion i en fil som inte
 * hunnit laddas. Lägg den därför aldrig här.
 */

function enhAlla(){
  try{var o=JSON.parse(localStorage.getItem(ENH_KEY)||'{}');
    return (o&&typeof o==='object')?o:{};}catch(e){return {};}
}
function enhSammanfoga(rem){
  try{
    var r=JSON.parse(rem||'{}');
    if(!r||typeof r!=='object')return rem;
    var l=enhAlla();
    Object.keys(l).forEach(function(id){
      var a=l[id],b=r[id];
      if(!b||!b.sist||(a&&a.sist&&a.sist>b.sist))r[id]=a;
    });
    return JSON.stringify(r);
  }catch(e){return rem;}
}
/* Kort namn ur User-Agent. Bara for att kanna igen enheten i listan - det
   racker med modellen, hela stangen sager ingenting. */
function enhModell(){
  var u='';try{u=navigator.userAgent||'';}catch(e){}
  var m=u.match(/\((?:Linux; )?Android[^;)]*;\s*([^;)]+)/i);
  if(m)return m[1].trim().slice(0,24);
  if(/iPad/i.test(u))return 'iPad';
  if(/iPhone/i.test(u))return 'iPhone';
  m=u.match(/(Macintosh|Windows NT [\d.]+)/i);
  if(m)return m[1];
  return 'okänd';
}
function enhSkarm(){
  try{return (window.screen&&window.screen.width?window.screen.width:window.innerWidth)
    +'×'+(window.screen&&window.screen.height?window.screen.height:window.innerHeight);}
  catch(e){return '?';}
}
function enhVy(gml){
  try{
    if(window.self!==window.top)return gml||'';
    var ae=document.activeElement;
    if(ae&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName||''))return gml||'';
    var w=Math.round(window.innerWidth||0),h=Math.round(window.innerHeight||0);
    return (w>0&&h>0)?(w+'×'+h):(gml||'');
  }catch(e){return gml||'';}
}
/* Skrivs vid varje synkvarv. Bara den egna posten rors. */
function enhTick(){
  try{
    var o=enhAlla(),id=enhetsId();
    var f=o[id]||{};
    o[id]={
      namn:f.namn||enhetsNamn(),
      anv:f.anv||'',
      klass:secKlass(),
      modell:enhModell(),
      skarm:enhSkarm(),
      /* v737: fönstrets mått (CSS-px) – det plattramen på telefonen återskapar.
         Bara från toppfönstret, och inte medan tangentbordet kan vara uppe. */
      vy:enhVy(f.vy),
      vagg:IS_SAMSUNG_TABLET?1:0,
      ver:APP_VERSION,
      forst:f.forst||Date.now(),
      sist:Date.now()
    };
    localStorage.setItem(ENH_KEY,JSON.stringify(o));
  }catch(e){}
}
/* Anvandartagg for DEN HAR enheten. Tom sträng betyder gemensam. */
function enhAnv(){
  var o=enhAlla()[enhetsId()];
  return (o&&o.anv)?String(o.anv):'';
}
/* Fragan koden ska stalla nar en funktion bara ar till for nagon.
   arAnv('markus') ar sant bara pa de enheter som fatt den taggen - alltsa
   ALDRIG pa vaggplattan om den lamnas gemensam. */
function arAnv(){
  var a=enhAnv();
  if(!a)return false;
  for(var i=0;i<arguments.length;i++)
    if(String(arguments[i]).toLowerCase()===a.toLowerCase())return true;
  return false;
}
function enhSattAnv(v){
  try{
    var o=enhAlla(),id=enhetsId();
    if(!o[id])enhTick(),o=enhAlla();
    o[id].anv=String(v||'').trim().slice(0,24);
    o[id].sist=Date.now();
    localStorage.setItem(ENH_KEY,JSON.stringify(o));
    try{render();}catch(e){}
  }catch(e){}
}
function enhSattNamn(v){
  try{
    var o=enhAlla(),id=enhetsId();
    if(!o[id])enhTick(),o=enhAlla();
    o[id].namn=String(v||'').trim().slice(0,32)||enhetsNamn();
    o[id].sist=Date.now();
    localStorage.setItem(ENH_KEY,JSON.stringify(o));
  }catch(e){}
}
function enhNar(t){
  if(!t)return '–';
  var d=Math.round((Date.now()-t)/60000);
  if(d<2)return 'nu';
  if(d<90)return d+' min sedan';
  if(d<2880)return Math.round(d/60)+' h sedan';
  return Math.round(d/1440)+' dygn sedan';
}
function openEnheter(){
  var o=enhAlla(),jag=enhetsId();
  var ids=Object.keys(o).sort(function(a,b){return (o[b].sist||0)-(o[a].sist||0);});
  var h='<div class="setup-t">Varje webbläsare som öppnar dashboarden skriver in sig här. '
    +'Ge en enhet en användartagg om något bara ska synas där — lämnas den tom '
    +'räknas enheten som gemensam, vilket väggplattan ska vara.</div>';
  if(!ids.length)h+=dRow('Inga enheter','registret fylls vid nästa synk');
  ids.forEach(function(id){
    var e=o[id];
    h+='<div class="enh'+(id===jag?' jag':'')+'">'
      +'<div class="enh-h"><b>'+esc(e.namn||'?')+'</b>'
      +(id===jag?'<span class="enh-du">den här</span>':'')
      +'<span class="enh-t">'+esc(enhNar(e.sist))+'</span></div>'
      +'<div class="enh-m">'+esc(e.klass||'?')+' · '+esc(e.modell||'?')+' · '+esc(e.skarm||'?')
      +' · '+esc(e.ver||'?')+'</div>'
      +'<div class="enh-id">'+esc(id)+'</div>'
      +'<div class="enh-m">Användare: <b>'+esc(e.anv||'gemensam')+'</b></div>'
      +'</div>';
  });
  h+=dSec('Den här enheten')
    +'<div class="setup-t">Namnet och taggen gäller enheten du håller i nu.</div>'
    +'<input class="enh-in" id="enh-namn" placeholder="Namn" value="'+esc((o[jag]&&o[jag].namn)||'')+'">'
    +'<input class="enh-in" id="enh-anv" placeholder="Användare (tomt = gemensam)" value="'+esc((o[jag]&&o[jag].anv)||'')+'">'
    +'<div class="dbtn-row"><button class="dbtn" onclick="enhSpara()">Spara</button>'
    +'<button class="dbtn" onclick="enhKopiera()">Kopiera listan</button></div>'
    +'<textarea class="prog-exp" id="enh-exp" readonly onclick="this.select()">'+esc(enhCSV())+'</textarea>';
  var dlg=$('dlg');if(dlg&&dlg.classList){dlg.classList.remove('wide');dlg.classList.remove('edit');}
  _popupRebuild=null;
  setT('dlg-title','Enheter');setIcon('dlg-ic','desktop');
  var bd=$('dlg-body');if(bd)bd.innerHTML=h;
  var bk=$('dlg-back');if(bk&&bk.classList)bk.classList.add('open');
  dlgTop();
}
function enhSpara(){
  var n=$('enh-namn'),a=$('enh-anv');
  if(n)enhSattNamn(n.value);
  if(a)enhSattAnv(a.value);
  try{toast('Sparat – syns på övriga enheter efter nästa synk');}catch(e){}
  openEnheter();
}
function enhCSV(){
  var o=enhAlla(),ids=Object.keys(o).sort();
  var ut='id;namn;anvandare;klass;modell;skarm;version;senast\n';
  ids.forEach(function(id){
    var e=o[id];
    ut+=id+';'+(e.namn||'')+';'+(e.anv||'')+';'+(e.klass||'')+';'+(e.modell||'')
      +';'+(e.skarm||'')+';'+(e.ver||'')+';'+(e.sist?new Date(e.sist).toISOString().slice(0,16):'')+'\n';
  });
  return ut;
}
function enhKopiera(){
  var t=$('enh-exp');if(!t)return;
  var klar=function(ok){try{toast(ok?'Kopierat':'Markera i rutan och kopiera för hand');}catch(e){}};
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(t.value).then(function(){klar(true);},function(){
        t.select();var o=false;try{o=document.execCommand('copy');}catch(e){}klar(o);});
      return;
    }
  }catch(e){}
  t.select();var ok=false;try{ok=document.execCommand('copy');}catch(e){}klar(ok);
}
/* HOJDERNA LIGGER I FACK per enhetstyp men i EN nyckel. Hamtas den rakt av
   skriver den andra enhetens kopia over ens eget fack. */
function scaleSammanfoga(rem){
  try{
    var r=JSON.parse(rem||'{}');
    if(!r||typeof r!=='object')return rem;
    var l=secScaleAlla(),k=secKlass();
    /* HAR DEN HAR ENHETEN EGNA MATT for sin klass behalls de. Villkoret var
       forut arHuvud(), men det beror pa en utpekning som kan saknas: har
       vaggplattan aldrig blivit utsedd fanns inget skydd alls, och da skrevs
       hojden over anda. Nu racker det att facket finns lokalt.
       En NY enhet har inget fack och arver darfor det som ligger i Homey - det
       ar sa en ny platta ska fa den inarbetade layouten. */
    if(l&&l[k]&&typeof l[k]==='object'&&Object.keys(l[k]).length)r[k]=l[k];
    return JSON.stringify(r);
  }catch(e){return rem;}
}
async function fetchFromHomey(){
  const list=await logicList(),byName={};logicArr(list).forEach(v=>{if(v&&v.name)byName[v.name]=v.value;});
  let srcVar=syncVar(),metaRaw=byName[srcVar];
  if(metaRaw==null&&byName[SYNC_OWN]!=null){srcVar=SYNC_OWN;metaRaw=byName[srcVar];}           /* reserv: enhetens egen tidigare slot */
  if(metaRaw==null&&byName['dashboard_state']!=null){srcVar='dashboard_state';metaRaw=byName[srcVar];} /* reserv: plattans slot */
  if(metaRaw==null)return {applied:false,reason:'ingen sparad data'};
  let meta;try{meta=JSON.parse(metaRaw);}catch(e){return {applied:false,reason:'trasig meta'};}
  let str='';for(let i=0;i<meta.n;i++){const c=byName[srcVar+'_'+i];if(c==null)return {applied:false,reason:'saknar del '+(i+1)+'/'+meta.n};str+=c;}
  let obj;try{obj=JSON.parse(str);}catch(e){return {applied:false,reason:'trasig data'};}
  /* Var nyckel lases ur SITT fack; gamla osuffixade nycklar som reserv. */
  lasProtStart('Homey-variablerna'+(syncNyttFormat(obj)?' (har fack)':' (gammal, utan fack)'));
  /* SAKNAS FACKETS STAMPEL galler KOPIANS EGEN. En gammal kopia utan fack har
     ingen egen layoutstampel, och da gick skyddet i v580 forbi: variabelkopian
     fran 11:34 skrev over andringar gjorda 16:50.
     Matt 2026-08-29: "Homey-variablerna (gammal, utan fack)" och
     "buttons_v1: 789 → 1017 SKREVS OVER". */
  var vFackTs=parseInt(obj[layoutTsKey()],10)||(meta&&parseInt(meta.t,10))||0;
  var vAndrad=andradTs();
  var vHoppa=!!(vFackTs&&vAndrad&&vAndrad>vFackTs+2000);
  SYNC_KEYS.forEach(k=>{
    var fore=null;try{fore=localStorage.getItem(k);}catch(e){}
    if(DELADE_KEYS.indexOf(k)>=0){
      var dv=deladVal(k,function(x){return obj[x]!=null;},parseInt(obj[DELAD_TS_KEY],10)||0);
      if(!dv.kalla){lasProtRad(k,'-',fore,null,dv.hopp);return;}
      var vd=obj[dv.kalla];if(typeof vd!=='string'){try{vd=JSON.stringify(vd);}catch(e){vd='';}}
      if(vd&&vd.length){lasProtRad(k,dv.kalla,fore,vd,'');try{localStorage.setItem(k,vd);}catch(e){}
        if(dv.ts)try{localStorage.setItem(DELAD_LOKAL,String(dv.ts));}catch(e){}}
      return;}
    if(vHoppa&&LAYOUT_KEYS.indexOf(k)>=0){
      lasProtRad(k,'-',fore,null,'lokala ändringar är nyare än facket');return;}
    var v=syncPlock(obj,k);
    if(v==null){lasProtRad(k,'-',fore,null,
      syncNyttFormat(obj)?'kopian har fack, men inget för den här enheten':'saknas i kopian');return;}
    if(k==='secScale_v1')v=scaleSammanfoga(v);
    else if(k===ENH_KEY)v=enhSammanfoga(v);
    lasProtRad(k,(obj[syncKey(k)]!=null?syncKey(k):k),fore,v,'');
    try{localStorage.setItem(k,v);}catch(e){}});
  lasProtSlut();
  _learn=null;_demoOv=null;try{Object.keys(TILESTATE).forEach(k=>delete TILESTATE[k]);}catch(e){}
  loadCfg();applyCfg();const sb=loadButtons();if(sb)CONFIG.BUTTONS=sb;
  applySecOrder();render();_syncMeta=meta;return {applied:true,meta:meta};}
async function bootSync(){
  try{secScaleMigrera();}catch(e){}
  try{deladStart();}catch(e){}
  try{huvudAuto();}catch(e){}
  /* Breveden hämtas en gång vid öppning så kortet har ett värde direkt. */
  try{brvHamta();}catch(e){}
  /* Diskbokningen läses vid samma tillfällen som Breveden. Utan det här skulle
     knappen stå släckt trots en bokning, tills man tryckte på den. */
  try{diskHamta();}catch(e){}
  if(CFG.sync===false)return;if(!CONFIG.TOKEN||CONFIG.TOKEN.indexOf('DIN_API')>=0)return;
  /* Appen först vid uppstart också. Har den något sparat är det färskare och
     fullständigare än logikvariabeln, som kan ha tappat loggar till DROPPABLE. */
  /* Rita bara om när något FAKTISKT ändrats. Förut ritades hela sidan om varje
     gång backupen lästes, även när den var identisk med det som redan låg i
     localStorage — det gav ett hopp någon sekund efter start, och en öppen meny
     stängdes mitt i handen. */
  var fore=syncSign();
  var appSvarade=false;
  try{
    if(appKan()){
      var n=await appBackupLas();
      appSvarade=true;
      if(n>0){
        if(syncSign()===fore)return;   /* inget nytt: rör inte skärmen */
        loadCfg();applyCfg();var sb=loadButtons();if(sb)CONFIG.BUTTONS=sb;
        applySecOrder();try{ritaOmSakert();}catch(e){}
        return;
      }
      /* Appen svarade men vi tog inte kopian: antingen fanns inget, eller så
         var den äldre än vad enheten själv sparat. I båda fallen ska vi INTE
         falla tillbaka på logikvariablerna — den vägen bär en äldre kopia och
         skulle skriva över det nyare. Det var den som åt upp knapparna. */
      if(_appLasSist&&(_appLasSist.aldre||_appLasSist.rap>0))return;
    }
  }catch(e){
    /* Appen kraschade eller svarade inte. Att då hämta från logikvariablerna
       är att gissa att den gamla kopian är bättre än den lokala. Det är den
       nästan aldrig. Stå still och logga i stället. */
    loggSkriv('vägrade läsa',{orsak:'appen svarade inte: '+((e&&e.message)||'okänt')});
    return;
  }
  if(appKan()&&appSvarade===false)return;
  try{
    await fetchFromHomey();
    loggSkriv('läste från logikvariabler',{});
    if(syncSign()!==fore)try{ritaOmSakert();}catch(e){}
  }catch(e){}}

/* Fingeravtryck av allt som påverkar utseendet. Räcker för att avgöra om en
   omritning behövs — och billigare än att jämföra nyckel för nyckel. */
function syncSign(){
  var ut='';
  try{
    ['cfg_v1','tilesFlode_v5','tilesEnergy_v1','tilesWeather_v1','buttons_v1',
     'secOrder_v1','secScale_v1'].forEach(function(k){
      ut+=k+':'+((localStorage.getItem(k)||'').length)+'|';});
  }catch(e){}
  return ut;}

/* Rita om, men ALDRIG mitt i något användaren håller på med. En öppen dialog
   eller meny som stängs av sig själv känns som ett fel. */
function ritaOmSakert(){
  var bk=$('dlg-back');
  if(bk&&bk.classList&&bk.classList.contains('open')){
    /* Vänta tills rutan stängts. Ett försök i minuten räcker. */
    setTimeout(ritaOmSakert,1000);
    return;
  }
  if(_timeActive)return;
  try{render();}catch(e){}}
async function syncDiag(){
  var el=$('sync-diag');if(el)el.textContent='Kollar…';
  try{
    var list=await logicList(),byName={};logicArr(list).forEach(function(v){if(v&&v.name)byName[v.name]=v.value;});
    var when=function(n){var r=byName[n];if(r==null)return 'saknas';
      try{var m=JSON.parse(r);if(m&&m.t){var d=new Date(m.t);
        return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)+' ('+(m.len||0)+' tecken)';}}catch(e){}
      return 'okänt format';};
    var t='Den här enheten '+(MOBILE?'(telefon)':'(platta)')+' använder: '+syncVar()
      +'\nDelad (dashboard_state): '+when('dashboard_state')
      +'\nTelefonens egen (dash_mobile): '+when('dash_mobile');
    if(CFG.shareLayout===false)t+='\nOBS: Delad layout är AV på den här enheten – den läser och skriver bara sin egen slot.';
    t+='\nHuvudenhet för '+secKlass()+': '+(arHuvud()?'ja':'NEJ – enheten skriver aldrig av sig själv');

    /* VAD SOM FAKTISKT SKILJER. Slotarna sager NAR nagon skrev, inte VAD som
       skrivs over. Tre forsok att hitta varfor vaggplattans installningar gick
       tillbaka byggde pa en gissning om vilken nyckel det galler; den har
       jamforelsen gissar inte utan staller lokalt mot Homey, nyckel for nyckel.
       Bara secScale_v1 ar uppdelad per enhetstyp och far skilja sig; allt annat
       som star har skrivs over vid nasta hamtning. */
    /* JAMFOR MOT DEN KALLA SOM FAKTISKT ANVANDS. bootSync foredrar Homey-appens
       backup framfor logikvariablerna, och det var den vagen som skrev over
       hojderna i v552. Att bara jamfora mot variablerna sag ratt ut men
       beskrev fel kalla. Bada visas nu, sa man ser om de sager samma sak. */
    var jamfor=function(namn,obj){
      var olika=[],lika=0;
      SYNC_KEYS.forEach(function(k){
        var l=null;try{l=localStorage.getItem(k);}catch(e){}
        /* Samma uppslagning som lasvagen gor - annars beskriver felsokningen en
           nyckel som ingen laser. */
        var r=syncPlock(obj,k);
        if(r!=null&&typeof r!=='string'){try{r=JSON.stringify(r);}catch(e){r=String(r);}}
        var same=(l==null&&r==null)||(l!=null&&r!=null&&String(l)===String(r));
        if(same){lika++;return;}
        olika.push('  '+k+': '+(l==null?'saknas':l.length+' tkn')
          +' → '+(r==null?'saknas':String(r).length+' tkn')
          +(k==='secScale_v1'?'   (per enhetstyp – skyddad)':''));
      });
      var ut='\n\nLokalt mot '+namn+': '+lika+' av '+SYNC_KEYS.length+' lika';
      ut+=olika.length?('\n'+olika.join('\n')):'\n  inga skillnader';
      return ut;
    };
    /* 1. Logikvariablerna. Saknas en del sags VILKEN - "Unexpected end of JSON"
       sa bara att hopsattningen gick sonder, inte var. */
    try{
      var srcVar=syncVar(),raa=byName[srcVar];
      if(raa==null){srcVar='dashboard_state';raa=byName[srcVar];}
      var meta=raa!=null?JSON.parse(raa):null;
      if(!meta||!meta.n)t+='\n\nLogikvariablerna: ingen läsbar meta.';
      else{
        var txt='',saknad=-1;
        for(var i=0;i<meta.n;i++){
          var c=byName[srcVar+'_'+i];
          if(c==null){saknad=i;break;}
          txt+=c;
        }
        if(saknad>=0)t+='\n\nLogikvariablerna: del '+(saknad+1)+' av '+meta.n
          +' ('+srcVar+'_'+saknad+') SAKNAS. Kopian går inte att läsa — spara om.';
        else t+=jamfor('Homey-variablerna',JSON.parse(txt));
      }
    }catch(e){t+='\n\nVariabeljämförelsen misslyckades: '+((e&&e.message)||e);}
    /* 2. Appens backup - den bootSync laser forst. */
    try{
      if(appKan()){
        var lista=await appGet('/backup');
        if(lista&&lista.nycklar&&Object.keys(lista.nycklar).length){
          /* Hamta nyckeln som LASVAGEN skulle valja - facket forst, den gamla
             delade bara om kopian saknar fack helt. Annars jamfor felsokningen
             mot en nyckel som ingen laser. */
          var nyF=syncNyttFormat(lista.nycklar);
          var o={};
          for(var q=0;q<SYNC_KEYS.length;q++){
            var kk=SYNC_KEYS[q], sk2=syncKey(kk), valj=null;
            if(sk2 in lista.nycklar)valj=sk2;
            else if(sk2===kk&&(kk in lista.nycklar))valj=kk;
            else if(!nyF&&(kk in lista.nycklar))valj=kk;
            if(!valj)continue;
            var vv=await appGet('/backup?key='+encodeURIComponent(valj));
            if(vv!=null)o[syncKey(kk)]=vv;
          }
          t+='\n\nAppens backup har '+(nyF?'egna fack per enhetstyp':'bara den gamla delade layouten');
          t+=jamfor('appens backup (den bootSync läser först)',o);
        }else t+='\n\nAppens backup: tom.';
      }else t+='\n\nAppens backup: appen svarar inte.';
    }catch(e){t+='\n\nAppjämförelsen misslyckades: '+((e&&e.message)||e);}
    /* 3. ENHETENS EGET MINNE av sina sparningar. Skillnaderna ovan sager VAD som
       skiljer, men inte VARFOR enheten inte skrivit. Tva forklaringar finns och
       de kraver olika atgard: antingen blockerades sparningen av skyddet mot att
       skriva over en stor kopia med en liten, eller sa hann den aldrig spara
       innan nasta hamtning skrev over. Bada star antecknade har. */
    try{
      var bo=bkpGet(),kl=function(x){if(!x)return '–';var dd=new Date(x);
        return ('0'+dd.getHours()).slice(-2)+':'+('0'+dd.getMinutes()).slice(-2);};
      t+='\n\nEnhetens sparningar';
      t+='\n  Senaste sparning: '+(bo.last||'aldrig')+(bo.t?(' · '+kl(bo.t)):'')
        +(bo.kalla?(' · via '+bo.kalla):'');
      t+='\n  Storlek då: '+(bo.len||0)+' tkn · nu lokalt: '+bkpLen()+' tkn';
      t+='\n  Layout då: '+(bo.llen||0)+' tkn · nu: '+bkpLayoutLen()+' tkn   (spärren mäter denna)';
      if(bo.blocked){
        t+='\n  BLOCKERAD '+bo.blocked+': '+(bo.blockedLen||0)+' tkn mot tidigare '
          +(bo.prevLen||bo.fjarrAntal||0)
          +'\n  Skyddet mot att skriva över en stor kopia med en liten stoppade sparningen.';
      }
      var et=(typeof egetTs==='function')?egetTs():0;
      var at=(typeof andradTs==='function')?andradTs():0;
      t+='\n  Sparat: '+kl(et)+' · ändrat: '+kl(at);
      if(at&&(!et||at>et))t+='\n  OSPARADE ÄNDRINGAR finns — de går förlorade vid nästa hämtning.';
    }catch(e){t+='\n\nKunde inte läsa enhetens sparningsminne: '+((e&&e.message)||e);}
    /* 4. VAD LASNINGEN FAKTISKT GJORDE senast. Allt ovan beskriver lagen just
       nu; det har ar en anteckning fran sjalva handelsen. */
    try{t+='\n\nSenaste läsning\n'+lasProtText();}catch(e){}
    t+='\nVänster = den här enheten, höger = kopian.';
    if(el)el.textContent=t;
  }catch(e){if(el)el.textContent='Kunde inte läsa Homeys variabler.';}}
function syncStatusText(){if(!_syncMeta)return 'Inte synkat än på den här enheten.';
  const d=new Date(_syncMeta.t);return 'Senast sparat '+('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)+' · '+(_syncMeta.len||0)+' tecken i '+(_syncMeta.n||1)+' variabler.';}
function cfgSync(v){CFG.sync=(v!=='off');saveCfg();}
function cfgShare(v){CFG.shareLayout=(v!=='off');saveCfg();var el=$('sync-status');if(el)el.textContent=CFG.shareLayout?'Delad layout på — spara nu så får andra enheter samma.':'Egen layout per enhet.';}
async function doSaveSync(){const el=$('sync-status');if(el)el.textContent='Sparar till Homey…';
  /* MANUELL SPARNING TAR ÖVER. Trycker man på knappen menar man allvar — då ska
     enheten också bli huvudenhet för sin klass. Annars skriver nästa
     automatiska hämtning tillbaka den andra enhetens inställningar, och det man
     just sparade är borta inom en minut utan att något syns. */
  try{
    if(!arHuvud()){
      huvudSatt(true);
      if(el)el.textContent='Sparar till Homey… (enheten är nu huvudenhet)';
    }
  }catch(e){}
  /* APPEN FÖRST. Knappen gick rakt på logikvariabeln, som har ett utrymmestak
     och offrar loggar när det tryter — därav "för mycket data". Appen sparar
     varje nyckel för sig och har inget tak alls; det var hela skälet till att
     den vägen byggdes, men den manuella knappen kopplades aldrig om. */
  try{
    if(appKan()){
      /* MANUELL: låser kopian till den här enheten. */
      var r=await appBackupSpara(true);
      if(r&&r.ok){
        try{var o=bkpGet();o.last=dayKey();o.len=bkpLen();o.t=Date.now();o.kalla='app';
          localStorage.setItem(BKP_KEY,JSON.stringify(o));}catch(e){}
        if(el)el.textContent='Sparat ✓ · '+(r.bytes||0).toLocaleString('sv-SE')+' tecken i '
          +(r.sparade||0)+' nycklar i Homey-appen · låst till '+enhetsNamn().toLowerCase()
          /* Säg VILKEN nyckel och varför. Det är inte ett fel utan ett skydd:
             en enhet som varit öppen en timme ska inte kunna radera en logg som
             byggts upp under månader på väggplattan. */
          +((r.fel&&r.fel.length)
            ?('\n'+r.fel.join('\n')+'\nDetta är ett skydd, inte ett fel — långa '
              +'loggar behålls där de är längst.')
            :'');
        return;
      }
    }
  }catch(e){
    /* Faller appen är logikvariabeln fortfarande bättre än ingenting. */
    if(el)el.textContent='Appen svarade inte, provar logikvariabeln…';
  }
  try{const m=await saveToHomey();if(el)el.textContent='Sparat ✓ · '+(m.len)+' tecken i '+m.n+' variabler'+(m.wrote!=null?' ('+m.wrote+' ändrade)':'')+(m.dropped?' · hoppade över '+m.dropped+' loggar som återskapas':'')+'.';}
  catch(e){var msg=(e&&e.message)||String(e);var hint='';
    if(isAbort(e)||/tidsgränsen/i.test(msg)){
      msg='anslutningen till Homey var för långsam';hint=' — försök igen, gärna närmare wifi-routern';}
    else if(e&&e.tooBig)hint=' — installera Homey-appen com.mawe.dashboard, den sparar utan tak';
    else if(/40[13]/.test(msg))hint=' — token saknar skrivrättighet (skapa en Homey-token med write-scope)';
    else hint=' — kontrollera token och nätverk';
    if(el)el.textContent='Kunde inte spara: '+msg+hint;}}
async function doFetchSync(){const el=$('sync-status');if(el)el.textContent='Hämtar från Homey…';
  /* APPEN FÖRST, av samma skäl som vid sparandet: dess kopia är fullständig,
     medan logikvariabeln kan ha offrat loggar när utrymmet tröt. Hämtar man
     från den senare får man tillbaka en beskuren version av sina egna
     inställningar utan att något säger det. */
  try{
    if(appKan()){
      var n=await appBackupLas();
      if(n===0&&_appLasSist.rap>0){
        /* Appen HADE nycklar men ingen kunde läsas. Säg det rakt ut i stället
           för att tyst falla vidare till logikvariabeln. */
        var e4=$('sync-status');
        if(e4)e4.textContent='Appen rapporterade '+_appLasSist.rap
          +' nycklar men ingen kunde läsas'
          +(_appLasSist.fel.length?(' · fel på: '+_appLasSist.fel.join(', ')):'')
          +(_appLasSist.hopp.length?(' · okända: '+_appLasSist.hopp.join(', ')):'');
        return;
      }
      if(n>0){
        loadCfg();applyCfg();
        var sb=loadButtons();if(sb)CONFIG.BUTTONS=sb;try{rutorPaNu();}catch(e){}
        applySecOrder();
        try{render();}catch(e){}
        var e2=$('sync-status');
        /* Säg hur många appen RAPPORTERADE och hur många som togs emot.
           Skiljer de sig är det just den skillnaden som förklarar en utebliven
           layout — förut stod bara ett tal och det såg alltid rätt ut. */
        if(e2)e2.textContent='Hämtat ✓ · '+n+' av '+_appLasSist.rap+' nycklar ur Homey-appen'
          +(_appLasSist.hopp.length?(' · hoppade över: '+_appLasSist.hopp.join(', ')):'')
          +(_appLasSist.fel.length?(' · fel på: '+_appLasSist.fel.join(', ')):'');
        return;
      }
    }
  }catch(e){
    var e3=$('sync-status');
    if(e3)e3.textContent='Appen svarade inte, provar logikvariabeln…';
  }
  try{const r=await fetchFromHomey();const el2=$('sync-status');if(el2)el2.textContent=r.applied?('Hämtat ✓ · '+syncStatusText()):('Inget hämtat: '+r.reason);}
  catch(e){const el2=$('sync-status');if(el2)el2.textContent='Kunde inte hämta: '+((e&&e.message)||e);}}
function backupString(){const obj={};SYNC_KEYS.forEach(k=>{const v=localStorage.getItem(k);if(v!=null)obj[k]=v;});return JSON.stringify(obj);}
function valString(){
  var o={_om:{ver:APP_VERSION,enhet:enhetsNamn(),lage:(MOBILE?'telefon':'platta'),
               at:new Date().toISOString(),mobGapY:mobGapY()}};
  /* Nycklar och lösenord ska aldrig följa med ut. Exporten är gjord för att
     klistras in i ett meddelande, och då är en riktig API-nyckel mitt i texten
     en läcka — den syns för alla som ser meddelandet och går inte att ångra.
     De maskeras här; själva inställningen på enheten rörs inte. */
  var HEMLIGA=/(key|token|secret|nyckel|losen|lösen|password)/i;
  function maska(o){
    if(!o||typeof o!=='object')return o;
    if(Array.isArray(o))return o.map(maska);
    var ut={};
    for(var n in o)ut[n]=HEMLIGA.test(n)?(o[n]?'(dold — ligger kvar på enheten)':o[n]):maska(o[n]);
    return ut;}
  VAL_KEYS.forEach(function(k){
    var v=null;try{v=localStorage.getItem(k);}catch(e){}
    if(v==null)return;
    /* Tolka JSON så utskriften går att läsa i stället för att bli en sträng
       inuti en sträng med alla citattecken förrymda. */
    try{o[k]=maska(JSON.parse(v));}catch(e){o[k]=v;}
  });
  return JSON.stringify(o,null,1);}
function openVal(){
  var h='<div class="te"><div class="te-sec">Mina inst\u00e4llningar</div>'
    +'<div class="cfg-hint" style="margin-top:0">Layout, ordning och knappar \u2014 allt du st\u00e4llt in f\u00f6r hand p\u00e5 den h\u00e4r enheten. Loggar och m\u00e4tserier \u00e4r inte med. Kopiera och klistra in i chatten s\u00e5 kan de bakas in som standard.</div>'
    +'<textarea id="bk-out" class="bk-ta" readonly onclick="this.select()">'+esc(valString())+'</textarea>'
    +'<div class="te-adv"><button class="te-use" onclick="valCopy()">Kopiera</button></div>'
    +'<div class="cfg-hint" id="bk-status">'+esc(valString().length+' tecken.')+'</div></div>';
  var dlg=$('dlg');if(dlg&&dlg.classList){dlg.classList.remove('wide');dlg.classList.add('edit');}
  setT('dlg-title','Mina inst\u00e4llningar');setIcon('dlg-ic','wrench');
  var bd=$('dlg-body');if(bd)bd.innerHTML=h;
  var bk=$('dlg-back');if(bk&&bk.classList)bk.classList.add('open');dlgTop();}
function valCopy(){
  var t=$('bk-out');if(t&&t.select)t.select();var ok=false;
  try{ok=document.execCommand&&document.execCommand('copy');}catch(e){}
  try{if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(valString());ok=true;}catch(e){}
  var s2=$('bk-status');if(s2)s2.textContent=ok?'Kopierat \u2713':'Markera texten och kopiera manuellt.';}
/* Kopiera innehållet i ett diagnostikfält. execCommand först: den fungerar även
   utan säker kontext, vilket kopian på Homeys egen HTTP-server kör i. */
function kopieraFalt(id,btn){
  var el=document.getElementById(id);if(!el)return;
  var txt=el.textContent||'',ok=false;
  try{
    var ta=document.createElement('textarea');
    ta.value=txt;ta.setAttribute('readonly','');
    ta.style.cssText='position:fixed;top:-1000px;left:0;opacity:0';
    document.body.appendChild(ta);ta.select();ta.setSelectionRange(0,txt.length);
    ok=document.execCommand&&document.execCommand('copy');
    document.body.removeChild(ta);
  }catch(e){}
  try{if(!ok&&navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt);ok=true;}}catch(e){}
  if(btn){
    var f=btn.textContent;btn.textContent=ok?'Kopierat \u2713':'Markera och kopiera';
    setTimeout(function(){btn.textContent=f;},1800);
  }
}
/* Vem skrev senast till Homey? */
async function loggVisa(){
  var el=$('sync-logg');if(el)el.textContent='L\u00e4ser\u2026';
  var r=await loggLas();
  if(el)el.textContent=loggText(r);}
function openBackup(){
  let h='<div class="te"><div class="te-sec">Exportera – kopiera och spara undan</div>'
    +'<textarea id="bk-out" class="bk-ta" readonly onclick="this.select()">'+esc(backupString())+'</textarea>'
    +'<div class="te-adv"><button class="te-use" onclick="bkCopy()">Kopiera</button></div>'
    +'<div class="te-sec">Importera – klistra in och använd</div>'
    +'<textarea id="bk-in" class="bk-ta" placeholder="Klistra in en exportsträng här…"></textarea>'
    +'<div class="te-adv"><button class="te-use" onclick="doImport()">Använd inställningar</button></div>'
    +'<div class="cfg-hint" id="bk-status">Exporten innehåller alla inställningar, rutor, layout och inlärning.</div></div>';
  const dlg=$('dlg');if(dlg&&dlg.classList){dlg.classList.remove('wide');dlg.classList.add('edit');}
  setT('dlg-title','Säkerhetskopiera');setIcon('dlg-ic','gauge');const bd=$('dlg-body');if(bd)bd.innerHTML=h;
  const bk=$('dlg-back');if(bk&&bk.classList)bk.classList.add('open');dlgTop();}
function bkCopy(){const t=$('bk-out');if(t&&t.select)t.select();let ok=false;try{ok=document.execCommand&&document.execCommand('copy');}catch(e){}
  try{if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(backupString());ok=true;}catch(e){}
  const s=$('bk-status');if(s)s.textContent=ok?'Kopierat ✓':'Markera texten och kopiera manuellt.';}
function doImport(){const t=$('bk-in'),s=$('bk-status');if(!t)return;let obj;try{obj=JSON.parse(t.value);}catch(e){if(s)s.textContent='Ogiltig sträng – kontrollera att du klistrat in hela.';return;}
  /* Handpaklistrad import raknas som ett medvetet val: da ska ALLT galla, aven
     hojderna. Det ar skillnaden mot en automatisk synk, dar den andra enhetens
     kopia inte far ata upp ens egna matt. */
  let n=0;Object.keys(obj).forEach(k=>{if(SYNC_KEYS.indexOf(k)>=0){try{localStorage.setItem(k,obj[k]);n++;}catch(e){}}});
  _learn=null;_demoOv=null;try{Object.keys(TILESTATE).forEach(k=>delete TILESTATE[k]);}catch(e){}
  loadCfg();applyCfg();const sb=loadButtons();if(sb)CONFIG.BUTTONS=sb;try{rutorPaNu();}catch(e){}applySecOrder();render();
  if(s)s.textContent='Importerat ✓ ('+n+' nycklar). Layouten är uppdaterad.';}
function pctl(a,p){if(!a.length)return null;const b=a.slice().sort((x,y)=>x-y),i=(b.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);return lo===hi?b[lo]:b[lo]+(b[hi]-b[lo])*(i-lo);}
function learnBand(key){const cfg=LEARN_KEYS[key];if(!cfg)return{lo:0,hi:1,n:0,learned:false};
  const e=learnGet()[key],vals=e?e.s.map(x=>x[1]):[],n=vals.length,seed=cfg.seed;
  if(n<LEARN_MINN)return{lo:seed[0],hi:seed[1],n:n,learned:false};
  let lo=pctl(vals,+('0.'+cfg.lo.slice(1))||0.1),hi=pctl(vals,+('0.'+cfg.hi.slice(1))||0.9);
  const w=Math.min(1,(n-LEARN_MINN)/60);lo=seed[0]*(1-w)+lo*w;hi=seed[1]*(1-w)+hi*w;
  if(hi-lo<1e-6)hi=lo+1;return{lo:lo,hi:hi,n:n,learned:true};}
function glowLevel(key,val){if(val==null)return 0;const b=learnBand(key);let l=(val-b.lo)/(b.hi-b.lo);return Math.max(0.05,Math.min(1,l));}
function learnTick(){
  const sp=cap(DEV.solar,'measure_power');if(sp!=null&&sp>LEARN_KEYS.solar.floor)learnSample('solar',sp);
  const pr=elprisNow();if(pr!=null)learnSample('price',pr);
  const bp=cap(DEV.battery,'measure_power');if(bp!=null&&Math.abs(bp)>LEARN_KEYS.battflow.floor)learnSample('battflow',Math.abs(bp));
  const gp=cap(DEV.pulse,'measure_power');if(gp!=null&&Math.abs(gp)>LEARN_KEYS.gridflow.floor)learnSample('gridflow',Math.abs(gp));
  /* Pooltemperaturen samlas UTTRYCKLIGT. Raden under tar bara brickor som
     ligger på flöde/energi/väder — har man tagit bort poolbrickan därifrån
     slutade serien fyllas på, och grafen i poolrutan blev tom utan att något
     sa ifrån. */
  const pt=cap(DEV.pooltemp,'measure_temperature');if(pt!=null&&isFinite(pt))learnSample(poolHistKey(),pt);
  try{['flode','energy','weather'].forEach(g=>{gridTiles(g).forEach(cfg=>{const v=metricNumber(cfg);if(v!=null&&isFinite(v))learnSample(histKeyFor(cfg),v);});});}catch(e){}
  learnFlush();}
function accColor(ic){return ACCCOLOR[accFor(ic)]||'blue';}
/* Röd (0%) -> gul (50%) -> grön (100%). Ger en tydlig laddnivåfärg. */
function socColor(pct){
  var p=Math.max(0,Math.min(100,pct))/100;
  var r,g,b;
  if(p<0.5){                                   /* röd -> gul */
    r=224; g=Math.round(70+p*2*(190-70)); b=Math.round(70-p*2*30);
  }else{                                        /* gul -> KLAR grön */
    r=Math.round(224-(p-0.5)*2*(224-56));       /* rött ner till 56 */
    g=Math.round(190+(p-0.5)*2*(205-190));      /* grönt upp till 205 */
    b=Math.round(40+(p-0.5)*2*(90-40));         /* lite blått för friskare grön */
  }
  return 'rgb('+r+','+g+','+b+')';}
/* Fyll för en bricka: {frac 0..1, color}. Bilrutan fylls av laddnivån. Strykan
   (frac) är sensorvärdet självt - precis som glowets styrka förr berodde på värdet. */
/* Fyll för en bricka: {frac 0..1, color}. Ersätter glow på de brickor som har fyll.
   - Bilrutan: laddnivån fyller, röd->grön.
   - energy/weather-grid: brickans värde mot sitt inlärda band styr HUR MYCKET som
     fylls (precis som glowets styrka förr), i brickans accentfärg. */
function _accHex(cfg){var P=(PAL&&PAL[curTheme])||PAL.dark;return P[accColor(metricIcon(cfg))]||P.blue;}
/* Fyll gäller BARA bilrutan (laddnivå, röd->grön). Alla andra brickor - inklusive
   forbrukning nu och vader - anvander glow som forr. */
function tileFill(cfg,grid){
  /* v231: bilrutan gick tillbaka till glow (som förr) - ingen bakgrundsfyll längre. */
  return null;}
function metricIcon(cfg){return cfg.type==='sensor'?(cfg.icon||inferIcon(cfg.cap)):computeMetric(cfg).icon;}
function metricNumber(cfg){
  if(cfg.type==='sensor')return capMs(cfg.device,cfg.cap);
  const k=cfg.key;if(k==='self')return selfData().of*100;
  if(k==='seatemp')return (typeof FEED!=='undefined')?FEED.sea:null;
  if(k==='boughtyear')return yearKopt();if(k==='soldyear')return yearSald();
  const M={solnow:[DEV.solar,'measure_power'],solday:[DEV.solar,'meter_power.day'],solyear:[DEV.solar,'meter_power.year'],house:[DEV.consume,husCap()],
    cost:[DEV.pulse,'accumulatedCost'],spot:[DEV.tibber,'measure_price_total'],gridbal:[DEV.pulse,'measure_power'],gridnow:[DEV.pulse,'measure_power'],
    battnow:[DEV.battery,'measure_power'],battpow:[DEV.battery,'measure_power'],battpct:[DEV.battery,'measure_battery'],
    humidity:[DEV.outdoor,'measure_humidity'],rain:[DEV.rain,'measure_rain.24h'],pressure:[DEV.vader,'measure_pressure'],
    car1:[DEV.car,'measure_battery'],car2:[DEV.car2,'measure_battery'],charger:[DEV.laddbox,'measure_power'],poolrum:[DEV.pooltemp,'measure_temperature'],
    sold:[DEV.pulse,'meter_power.exported'],bought:[DEV.pulse,'meter_power.imported']};
  const m=M[k];if(!m)return null;let v=cap(m[0],m[1]);if((k==='gridbal'||k==='gridnow'||k==='battnow'||k==='battpow')&&v!=null)v=Math.abs(v);return v;}
function poolHistKey(){return histKeyFor(POOL_CFG);}
function histKeyFor(cfg){if(cfg.type==='sensor')return metricRefKey(cfg);const k=cfg.key;
  if(k==='solnow'||k==='solday'||k==='solyear')return 'solar';
  if(k==='gridnow'||k==='gridbal')return 'gridflow';
  if(k==='battnow'||k==='battpow')return 'battflow';
  if(k==='spot'||k==='cost')return 'price';
  return 'k:'+k;}
function metricRef(cfg){if(cfg.type==='sensor'){for(const key in REFCAP){if(cfg.cap.indexOf(key)>=0)return REFCAP[key];}return null;}return REFKEY[cfg.key]||null;}
function metricRefKey(cfg){return cfg.type==='sensor'?('c:'+cfg.device+':'+cfg.cap):('k:'+cfg.key);}
function learnBandRef(key,seed){const e=learnGet()[key],vals=e?e.s.map(x=>x[1]):[],n=vals.length;
  if(n<LEARN_MINN)return{lo:seed[0],hi:seed[1],n:n,learned:false};
  let lo=pctl(vals,0.10),hi=pctl(vals,0.90);const w=Math.min(1,(n-LEARN_MINN)/60);lo=seed[0]*(1-w)+lo*w;hi=seed[1]*(1-w)+hi*w;if(hi-lo<1e-6)hi=lo+1;return{lo:lo,hi:hi,n:n,learned:true};}
function genericGlow(cfg){const gn=metricNumber(cfg),ref=metricRef(cfg);if(gn==null||!ref)return null;
  const b=learnBandRef(metricRefKey(cfg),ref);let l=(gn-b.lo)/(b.hi-b.lo);l=Math.max(0,Math.min(1,l));
  if(l<=0.02)return null;return {glow:accColor(metricIcon(cfg)),lvl:Math.max(0.12,l)};}
function trendHistKey(cfg){if(!cfg)return null;
  if(cfg.type==='sensor')return DC2HIST[cfg.device+'|'+cfg.cap]||null;
  const m={solnow:'solar',house:'house',gridnow:'grid',battpct:'batt',battnow:'battpow',battpow:'battpow',humidity:'hum',rain:'rain',pressure:'press',pooltemp:'pool',poolrum:'pool'};
  return m[cfg.key]||null;}
function trendForLearn(cfg){const ref=metricRef(cfg);if(!ref)return '';const v=metricNumber(cfg);if(v==null)return '';
  const e=learnGet()[metricRefKey(cfg)];if(!e||!e.s||e.s.length<2)return '';
  const now=Date.now();let base=null;
  for(let i=e.s.length-1;i>=0;i--){const t=e.s[i][0];if(now-t>=50*60000){if(now-t<=3*3600000)base=e.s[i][1];break;}}
  if(base==null)return '';const b=learnBandRef(metricRefKey(cfg),ref),thr=Math.max((b.hi-b.lo)*0.05,1e-9);
  if(v-base>thr)return 'up';if(base-v>thr)return 'down';return '';}
function trendFor(cfg){if(!cfg||cfg.trend!==true)return '';
  if(cfg.key==='seatemp'){try{const e=learnGet()['k:seatemp'];if(e&&e.s&&e.s.length>=2){const s=e.s,last=s[s.length-1],cutT=last[0]-3*3600000;let base=null;for(let i=s.length-1;i>=0;i--){if(s[i][0]<=cutT){base=s[i][1];break;}}if(base==null)base=s[0][1];const d=last[1]-base;return d>0.2?'up':d<-0.2?'down':'';}}catch(e){}return '';}
  const hk=trendHistKey(cfg),thr=hk?(TREND_THR[hk]||0.001):0.001;
  if(_timeActive&&_timeInfo){const T=_timeInfo.T;
    if(_timeInfo.future){const ff=hk?HIST2FC[hk]:null;if(!ff)return '';const a=forecastAt(T),b=forecastAt(T-90*60000);if(!a||!b||a[ff]==null||b[ff]==null)return '';const d=a[ff]-b[ff];return d>thr?'up':d<-thr?'down':'';}
    if(hk){const a=histValueAt(hk,T),b=histValueAt(hk,T-45*60000);if(a==null||b==null)return '';const d=a-b;return d>thr?'up':d<-thr?'down':'';}
    return '';}
  if(hk&&HIST[hk]&&HIST[hk].length>=2){const now=Date.now(),a=histValueAt(hk,now),b=histValueAt(hk,now-45*60000);if(a!=null&&b!=null){const d=a-b;if(d>thr)return 'up';if(d<-thr)return 'down';return '';}}
  return trendForLearn(cfg);}

/* ===== HUVUDIKONEN BAR LAGET =====
   Forut satt en liten statusikon i rutans hogra horn medan huvudikonen alltid
   var densamma. Tva ikoner i samma ruta konkurrerar: man laser den stora och
   missar den lilla. Nu andras HUVUDIKONEN i stallet, och hornikonen ar borta.
   Pulsen ar reserverad for det som PAGAR och som man kan vilja avbryta. */
function tileIkon(cfg,m){
  /* RUTANS EGEN IKON STAR KVAR. Den sager vad rutan handlar om, och byter man
     ut den vet man inte langre vad man tittar pa - en bil som blir ett batteri
     nar den laddar ar svarare att hitta i ogonvran, inte lattare.
     Laget visas i stallet med en liten markor i ikonens horn, och med en puls
     nar nagot PAGAR som man kan vilja avbryta. */
  var ic=m.icon,puls=false,extra='';
  var k=(cfg&&cfg.type==='computed')?cfg.key:'';
  var varms=function(){var ph=cap(DEV.poolheat,'onoff');return ph==='on'||ph===true;};
  if(k==='poolheat'){
    if(varms())extra='flame';
  }else if(k==='cars'||k==='car1'||k==='car2'){
    var ids=(k==='cars')?[DEV.car,DEV.car2]:[(k==='car1')?DEV.car:DEV.car2];
    var laddar=false,inkopplad=false;
    ids.forEach(function(id){if(!DATA[id])return;
      if(carCharging(id))laddar=true;if(carPlugged(id))inkopplad=true;});
    if(laddar){extra='lightning';puls=true;}
    else if(inkopplad)extra='plug';
  }else if(k==='charger'){
    var on=cap(DEV.laddbox,'evcharger_charging')===true||carCharging(DEV.car)||carCharging(DEV.car2);
    if(on){extra='lightning';puls=true;}
  }else if(k==='battnow'||k==='battpct'||k==='battpow'){
    /* INGEN MARKOR pa batteriet. Ikonen sager redan laddniva och riktning
       genom sin egen form, och rutan har dessutom laddnivan i underraden -
       en blixt till blev en tredje sak som sa samma sak. Pulsen far vara kvar:
       den sager att det PAGAR, vilket varken form eller text gor. */
    if(cap(DEV.battery,'battery_charging_state')==='charging')puls=true;
  }else if(k==='dish'){
    if(cap(DEV.dish,'onoff')===true&&typeof diskKor==='function'&&diskKor()){extra='clock-counter-clockwise';puls=true;}
  }else if(k==='breveden'){
    /* v696: värmer eller kyler Breveden JUST NU — låga eller snöflinga i
       stugans hörn. Läget "Värm 15" utan att den arbetar ger ingen markör. */
    try{var Nv=brvNu();
      if(Nv){if(Nv.arbetar){extra=(Nv.lage==='cool')?'snowflake':'flame';puls=true;}}
      else{var Bv=brvState();if(Bv&&Bv.aktiv&&!brvGammal(Bv)){extra=(Bv.lage==='cool')?'snowflake':'flame';puls=true;}}}catch(e){}
  }else if(cfg&&cfg.type==='sensor'&&cfg.device===DEV.pooltemp&&cfg.cap==='measure_temperature'){
    if(varms())extra='flame';
  }else if(k==='uterum'||k==='snickarboa'||k==='vardagsrum'){
    /* v736: varning i ikonens hörn; larm pulsar. */
    if(m&&m.varn){extra='warning';puls=(m.varn.niva==='larm');}
  }else if(k==='poolrum'){
    /* v740: en varning väger tyngre än att värmen går – annars låga, som
       Pooltemp-rutan. */
    if(m&&m.varn){extra='warning';puls=(m.varn.niva==='larm');}
    else if(varms())extra='flame';
  }
  return {icon:ic,puls:puls,extra:extra};
}
/* Markoren sitter i hornet AV IKONEN, inte av rutan - da laser den som en del
   av bilden i stallet for att bli ett andra objekt langt bort. */
function tileIkonHTML(cfg,m,cls){
  var t=tileIkon(cfg,m);
  /* v724: batteriets bokning UNDER ikonen – i ikonens egen kolumn, utan att
     rutan blir högre. Bara ikonen för läget och klockslaget; hela texten i title. */
  var bok=m&&m.bok?('<span class="stat-bokik bok-'+m.bok.cls+'" title="'+esc(m.bok.txt)+'">'+icon(m.bok.ic)
    +'<b>'+esc(m.bok.kort||'')+'</b></span>'):'';
  return '<span class="'+cls+(t.puls?' pulsar':'')+(t.extra?' har-mark':'')+(bok?' har-bok':'')+'"'
    +(m.icc?(' style="color:'+m.icc+'"'):'')+'>'
    +icon(t.icon)
    +(t.extra?('<span class="ik-mark">'+icon(t.extra)+'</span>'):'')
    +bok
    +'</span>';
}
function tileStatus(cfg){
  if(!cfg)return null;
  if(cfg.type==='computed'){const k=cfg.key;
    if(k==='solnow'||k==='solday'){const p=cap(DEV.solar,'measure_power')||0;if(p<=40)return null;return {icon:'sun',glow:'solar',lvl:glowLevel('solar',p)};}
    if(k==='battnow'){const pw=cap(DEV.battery,'measure_power'),s=cap(DEV.battery,'battery_charging_state'),b=cap(DEV.battery,'measure_battery');const lvl=glowLevel('battflow',Math.abs(pw||0));if(b!=null&&b<10)return{glow:'hot',lvl:Math.max(lvl,0.6)};if(s==='charging')return{icon:'lightning',glow:'green',lvl:lvl};if(s==='discharging')return{icon:'battery-low',glow:'gold',lvl:lvl};return null;}
    if(k==='gridnow'){const pw=cap(DEV.pulse,'measure_power');if(pw==null)return null;const lvl=glowLevel('gridflow',Math.abs(pw));if(pw>5)return{icon:'lightning',glow:'hot',lvl:lvl};if(pw<-5)return{icon:'lightning',glow:'green',lvl:lvl};return null;}
    if(k==='rain'){const r=cap(DEV.rain,'measure_rain.24h');if(r==null||r<=0)return null;return{glow:'blue',lvl:Math.max(.15,Math.min(1,r/15))};}
    if(k==='humidity'){const hh=cap(DEV.outdoor,'measure_humidity');if(hh==null)return null;if(hh>=92||hh<=18)return{glow:'hot',icon:'warning'};if(hh>=85||hh<=25)return{glow:'warm'};return null;}
    if(k==='pressure'){const pr=cap(DEV.vader,'measure_pressure')||cap(DEV.smhi,'measure_air_pressure_cp'),tr=pressureTrend(pr);if(tr>0)return{glow:'warm'};if(tr<0)return{glow:'blue'};return null;}
    if(k==='poolheat'||k==='poolrum'){const ph=cap(DEV.poolheat,'onoff');return(ph==='on'||ph===true)?{glow:'warm',icon:'flame'}:null;}
    if(k==='dish'){if(diskLage()!=='kor')return null;const pr=parsePct(cap(DEV.dish,'bshc_string.progress'));return{glow:'cyan',lvl:pr!=null?Math.max(.25,.25+.75*pr/100):.5};}
    if(k==='cars'||k==='car1'||k==='car2'){const ids=k==='cars'?[DEV.car,DEV.car2]:[k==='car1'?DEV.car:DEV.car2];let charging=false,unlocked=false,known=false;
      ids.forEach(id=>{if(!DATA[id])return;const st=cap(id,'ev_charging_state'),lk=cap(id,'locked');if(st!=null||lk!=null)known=true;
        if(carCharging(id))charging=true;if(lk===false)unlocked=true;});
      if(!known)return null;
      const licon=unlocked?'lock-simple-open':'lock-simple';
      /* Glow ENDAST vid laddning eller olåst bil. Två ändringar mot förr:
         laddboxens egen aktivitet räknas inte längre — den kan mata en gästbil,
         och säger då ingenting om den här bilen — och en låst bil som står
         still lyser inte alls. Blått för laddning, rött för olåst. Laddar en
         olåst bil vinner laddningen; den är det som pågår. */
      /* BLIXT när bilen laddar. Låsikonen sa bara om den var låst, och med
         glowet avstängt gick det inte att se att laddningen pågick alls.
         Blixten är det som pågår; låset är ett tillstånd. */
      if(charging){const p=chargerW();
        return {icon:'lightning',glow:'blue',lvl:(p!=null?Math.min(1,Math.max(0.3,p/11000)):0.6)};}
      if(unlocked)return {icon:licon,glow:'hot'};
      return {icon:licon,glow:null};}
    if(k==='charger'){const on=cap(DEV.laddbox,'evcharger_charging')===true||carCharging(DEV.car)||carCharging(DEV.car2);const p=chargerW();return on||(p!=null&&p>50)?{icon:'lightning',glow:'violet',lvl:p!=null?Math.min(1,Math.max(.3,p/11000)):.6}:null;}
    if(k==='battpct'||k==='battpow'){const s=cap(DEV.battery,'battery_charging_state'),b=cap(DEV.battery,'measure_battery');if(b!=null&&b<10)return{glow:'hot',lvl:0.8};if(s==='charging')return{glow:'green',icon:'battery-charging'};if(s==='discharging')return{glow:'gold'};return null;}
    if(k==='spot'){const pr=elprisNow(),lv=cap(DEV.tibber,'price_level')||cap(DEV.tibber,'measure_price_info_level');
      if(pr!=null){const b=learnBand('price');if(lv==='VERY_EXPENSIVE')return{glow:'hot',icon:'warning',lvl:1};
        if(pr<=b.lo&&lv!=='EXPENSIVE')return genericGlow(cfg);const lvl=Math.max(.1,Math.min(1,(pr-b.lo)/(b.hi-b.lo)));return (pr>=b.hi)?{glow:'hot',icon:'warning',lvl:lvl}:{glow:'warm',lvl:lvl};}
      if(lv==='VERY_EXPENSIVE')return{glow:'hot',icon:'warning'};if(lv==='EXPENSIVE')return{glow:'warm'};return null;}
    return genericGlow(cfg);}
  // sensor: poolvärme + onormala värden
  if(cfg.device===DEV.pooltemp){const ph=cap(DEV.poolheat,'onoff');return(ph==='on'||ph===true)?{glow:'warm',icon:'flame'}:null;}
  const v=capMs(cfg.device,cfg.cap),c=cfg.cap;
  if(typeof v==='number'){
    if(c.indexOf('measure_co2')>=0){if(v>1400)return{glow:'hot',icon:'warning'};if(v>1000)return{glow:'warm'};}
    else if(c.indexOf('measure_humidity')>=0){if(v<20||v>80)return{glow:'hot',icon:'warning'};if(v<25||v>70)return{glow:'warm'};}
    else if(c.indexOf('measure_battery')>=0){if(v<10)return{glow:'hot',icon:'warning'};if(v<15)return{glow:'warm'};}
  }
  return genericGlow(cfg);
}
/* v733: effekt ("90 W", "−1.8 kW") får enheten i <small> precis som kWh, kr
   och °C i de andra korten. Text som redan har märkning rörs inte. */
function enhetLiten(v){var t=String(v==null?'':v);
  return /^[^<]*\d (k?W|MW)$/.test(t)?t.replace(/ (k?W|MW)$/,' <small>$1</small>'):t;}
function renderTiles(g){const G=GRIDS[g];if(!G)return;const wrap=$(G.el);if(!wrap)return;
  /* Måtten räknas om efter ritningen — rutorna finns inte att mäta på innan. */
  if(typeof setTimeout==='function')setTimeout(storlekOm,0);
  const arr=visadeRutor(g);let h='';const chip=(G.style==='chip');
  arr.forEach((cfg,i)=>{
    if(cfg&&cfg.dold)return;                 /* v732: borttagen fast ruta */
    if(cfg&&cfg.type==='computed'&&(cfg.key==='krcmp'||cfg.key==='krcmp2')){h+=krcHTML(g,i,cfg);return;}
    const fill=tileFill(cfg,g);
    /* Bilrutan får FYLL istället för glow - laddnivån fyller brickan i rött->grönt. */
    /* Statusen hämtas ALLTID. Förut nollställdes hela objektet när glowet var
       avstängt, och då försvann även statusikonen — man kunde inte se att bilen
       laddade utan att slå på glowet igen. Nu styr cfg.glow bara ljuset;
       ikonen är en upplysning och inte en effekt. */
    /* Statusen hämtas ÄVEN för fyllda rutor, men bara ikonen används av dem:
       fyllnaden bär redan nivån, och ett glow ovanpå den blir grötigt. Förut
       nollställdes hela statusen, och bilrutan — som ALLTID har fyllnad — kunde
       därför aldrig visa att den laddade. */
    const stRa=tileStatus(cfg);
    /* cfg.stik===false döljer ikonen men rör inte glowet — de är två skilda
       upplysningar och ska gå att stänga av var för sig. */
    const visaIk=(cfg.stik!==false);
    /* Egen storlek på händelseikonen. Ligger i rutans post, alltså i den nyckel
       som redan synkas — ingen ny nyckel att hålla reda på. */
    const ikSk=1;   /* v727: fast storlek */
    const st0=fill?(stRa&&stRa.icon?{icon:stRa.icon,glow:stRa.glow}:null):stRa;
    const st=(st0&&!visaIk)?{glow:st0.glow,lvl:st0.lvl}:st0;
    const m=computeMetric(cfg);
    /* v739: egen ikon (cfg.ic). Färgen behålls från rutans automatiska ikon –
       den säger vilken sorts värde det är (sol, pengar, nät …). */
    const acc0=accFor(m.icon);
    if(cfg.ic&&ICONS[cfg.ic])m.icon=cfg.ic;
    /* v693: glöden är borttagen på alla rutor. Läget syns i ikonens färg och i
       lägesraden; "På nu"-raden säger vad som är igång. */
    const visaGlow=false;
    const glow=(visaGlow&&st&&st.glow)?('var(--'+(GLOWVAR[st.glow]||'blue')+')'):'';
    /* Ikonens färg följer statusen även utan glow — annars blir en aktiv ruta
       gråmarkerad och syns knappt. */
    const stFarg=(st&&st.glow)?('var(--'+(GLOWVAR[st.glow]||'blue')+')'):'var(--dim)';
    const lvl=st&&st.lvl!=null?st.lvl:1;
    var sty=glow?(' style="--glow:'+glow+';--gi:'+lvl.toFixed(2)+'"'):'';
    const fillH=fill?('<div class="stat-fill" style="width:'+Math.round(fill.frac*100)+'%;background:'+fill.color+'"></div>'):'';
    if(fill)sty='';
    const tr=trendFor(cfg),trH=tr?('<span class="tr '+tr+'">'+(tr==='up'?'▲':'▼')+'</span>'):'';
    if(chip){
      /* Hornikonen ar borttagen i v563 - laget bars av huvudikonen. */
      const stI='';
      h+='<button class="en-chip clickable'+(glow?' is-on':'')+(fill?' has-fill':'')+'" type="button" data-slot="'+i+'"'+sty+' onclick="tileTap(\''+g+'\','+i+')">'+fillH+tileIkonHTML(cfg,m,'en-chip-ic '+acc0)+'<span class="en-chip-txt"><span class="en-chip-l">'+esc(m.label)+'</span><span class="en-chip-w">'+m.v+'</span>'
        +(trH?('<span class="en-chip-s">'+trH+'</span>'):'')+'</span></span>'+stI+'</button>';
    }else{
      /* Hornikonen ar borttagen i v563 - laget bars av huvudikonen. */
      const stI='';
      /* Centreringslägena gäller alla sex rutorna samtidigt. */
      var mitt=((CFG.tile&&CFG.tile.icMitt)?' ic-mitt':'')+((CFG.tile&&CFG.tile.alltMitt)?' allt-mitt':'');
      h+='<div class="panel stat clickable'+(m.mer?' har-mer':'')+(m.bok?' har-bokrad':'')+(glow?' is-on':'')+(fill?' has-fill':'')+mitt+'" data-slot="'+i+'"'+sty+' onclick="tileTap(\''+g+'\','+i+')">'+fillH+tileIkonHTML(cfg,m,'stat-ic '+acc0)+'<div class="stat-txt"><div class="label">'+esc(shortLab(m.label))+'</div><div class="v">'+enhetLiten(m.v)+'</div>'
        /* UNDERRADEN kom tillbaka i v556, men bara dar den tillfor nagot.
           Den gamla meta-texten upprepade ofta rubriken med andra ord och togs
           bort i v545. Nu ar det ett eget falt, sub, som bara nagra rutor
           fyller i - fasbelastning, laddniva, utbyte mot mojligt. Ingen ruta
           far en rad bara for att det finns plats.
           m.meta raknas fortfarande ut och anvands i popuparna. */
        /* Med På nu-raden (v689) får rutor utan egen undertext sin
           lägesrad (meta) där — Breveden "värmer mot 15°", disken "klar ~…". */
        +((m.sub||((CFG&&CFG.paNu)&&m.meta))?('<div class="stat-sub">'+(m.sub||m.meta)+'</div>'):'')
        /* v721: bokning eller pågående läge för batteriet. */
        +(m.bok?('<div class="stat-bok bok-'+m.bok.cls+'" title="'+esc(m.bok.txt)+'">'+icon(m.bok.ic)
          +'<span class="bok-lang">'+esc(m.bok.txt)+'</span><span class="bok-kort">'+esc(m.bok.kort||m.bok.txt)+'</span></div>'):'')
        +(trH?('<div class="meta">'+trH+'</div>'):'')+'</div>'+stI
        +(m.mer?'<button type="button" class="tile-mer" aria-label="Fler val" onclick="event.stopPropagation();openDetail(\''+(m.det||'hem')+'\')">⋯</button>':'')+'</div>';
    }});
  wrap.innerHTML=h;}
function lpDown(e){const tile=e.target.closest&&e.target.closest('[data-slot]'),btn=e.target.closest&&e.target.closest('.ctl[data-bi]'),t=tile||btn;if(!t)return;
  _lp.fired=false;_lp.kind=tile?'tile':'btn';
  if(tile){const ge=tile.closest&&tile.closest('[data-grid]');_lp.grid=ge?ge.getAttribute('data-grid'):'';_lp.slot=+t.dataset.slot;}else{_lp.grid='';_lp.slot=+t.dataset.bi;}
  const p=(e.touches&&e.touches[0])||e;_lp.x=p.clientX;_lp.y=p.clientY;
  clearTimeout(_lp.timer);_lp.timer=setTimeout(()=>{_lp.fired=true;if(navigator.vibrate)try{navigator.vibrate(15);}catch(e2){}if(_lp.kind==='tile'){var _c=visadeRutor(_lp.grid)[_lp.slot];if(_c&&_c.fast){fastaTillLayout(_lp.grid,_lp.slot);return;}if(_c&&_c.type==='computed'&&(_c.key==='krcmp'||_c.key==='krcmp2'))openKrEdit(_lp.grid,_lp.slot);else openTileEdit(_lp.grid,_lp.slot);}else openBtnEdit(_lp.slot);},550);}
function lpMove(e){if(!_lp.timer)return;const p=(e.touches&&e.touches[0])||e;if(Math.abs(p.clientX-_lp.x)>10||Math.abs(p.clientY-_lp.y)>10){clearTimeout(_lp.timer);_lp.timer=null;}}
function lpUp(){clearTimeout(_lp.timer);_lp.timer=null;}
function ljusKnapp(){
  var B=CONFIG.BUTTONS||[];
  var i=B.findIndex(function(b){return b&&b.type==='moodtoggle'&&knappTill(b)==='hem';});
  if(i<0)i=B.findIndex(function(b){return b&&knappTill(b)==='hem'&&/tänd|släck|ljus|lamp/i.test(String(b.label||''));});
  return i;}
function ljusTryck(){
  var i=ljusKnapp();if(i<0){openDetail('hem');return;}
  var fore=btnState(CONFIG.BUTTONS[i]);
  btnTap(i);
  /* btnTap armerar först om knappen kräver bekräftelse — då inget väntläge. */
  if(armed.i!==i)_ljusVanta={t:Date.now(),pa:!fore};
  try{renderTiles('flode');}catch(e){}
  setTimeout(function(){try{renderTiles('flode');}catch(e){}},1600);
  setTimeout(function(){try{renderTiles('flode');}catch(e){}},4200);}
function tileTap(g,i){if(_lp.fired){_lp.fired=false;return;}const cfg=visadeRutor(g)[i];if(!cfg)return;const m=computeMetric(cfg);
  if(m&&m.tryck==='ljus'){ljusTryck();return;}
  if(m&&m.det==='batttom'){try{btPop();}catch(e){}return;}
  /* Breveden öppnar sin ruta sedan v605. Det gamla trycket — starta eller
     stoppa via skriptet — ligger kvar som snabbvalet "Auto" därinne. */
  _tapCfg=cfg;
  if(cfg.type==='computed'){if(m.det)openDetail(m.det);else _tapCfg=null;}
  else if(cfg.device===DEV.pooltemp&&cfg.cap==='measure_temperature')openDetail('pool');
  else openSensorDetail(cfg);}

function openSensorDetail(cfg){const d=DATA[cfg.device],m=computeMetric(cfg);_tapCfg=null;
  let body=dRow(m.label,m.v);
  if(d&&d.capabilitiesObj)Object.keys(d.capabilitiesObj).forEach(c=>{if(c===cfg.cap)return;const v=d.capabilitiesObj[c].value;if(typeof v==='number')body+=dRow(capLabel(c),num(v,inferDec(c))+(inferUnit(c)?' '+inferUnit(c):''));});
  if(cfg.graph!==false){const gv=metricVizHTML(cfg);if(gv)body=metricVizIsBars(cfg)?(body+gv):(gv+body);}
  const dlg=$('dlg');if(dlg&&dlg.classList){dlg.classList.remove('wide');dlg.classList.remove('edit');}
  setT('dlg-title',(d&&d.name)||m.label);setIcon('dlg-ic',m.icon);const bd=$('dlg-body');if(bd)bd.innerHTML=body;
  const back=$('dlg-back');if(back&&back.classList)back.classList.add('open');dlgTop();}

/* enheter / capabilities för avancerat läge */
function hasNum(d){return d&&d.capabilitiesObj&&Object.keys(d.capabilitiesObj).some(c=>typeof d.capabilitiesObj[c].value==='number');}
function devOptions(sel){return Object.keys(DATA).filter(id=>hasNum(DATA[id])).map(id=>({id,name:DATA[id].name||id})).sort((a,b)=>a.name.localeCompare(b.name,'sv')).map(o=>'<option value="'+o.id+'"'+(o.id===sel?' selected':'')+'>'+esc(o.name)+'</option>').join('');}
function capList(devId){const d=DATA[devId];return(d&&d.capabilitiesObj)?Object.keys(d.capabilitiesObj).filter(c=>typeof d.capabilitiesObj[c].value==='number'):[];}
function capLabel(c){return {measure_temperature:'Temperatur',measure_humidity:'Luftfuktighet',measure_co2:'CO₂',measure_power:'Effekt',measure_battery:'Batteri',measure_wind_strength:'Vindstyrka',measure_gust_strength:'Byvind',measure_wind_angle:'Vindriktning',measure_rain:'Regn nu','measure_rain.1h':'Regn 1h','measure_rain.24h':'Regn 24h',measure_pressure:'Lufttryck',measure_noise:'Ljudnivå',measure_luminance:'Ljus',measure_price_total:'Spotpris',meter_power:'Energi totalt','meter_power.day':'Energi idag','meter_power.month':'Energi månad','meter_power.year':'Energi i år','meter_power.imported':'Köpt energi','meter_power.exported':'Såld energi','measure_power.solar':'Sol-effekt','measure_power.grid':'Nät-effekt',range_battery:'Räckvidd',odometer:'Mätarställning',dim:'Ljusstyrka'}[c]||c;}
function inferIcon(c){if(c.indexOf('measure_temperature')>=0)return'thermometer-simple';if(c.indexOf('measure_humidity')>=0)return'drop-half-bottom';if(c.indexOf('measure_co2')>=0)return'wind';if(c.indexOf('measure_power')>=0)return'lightning';if(c.indexOf('meter_power')>=0)return'coins';if(c.indexOf('measure_battery')>=0)return'battery-high';if(c.indexOf('measure_wind')>=0||c.indexOf('measure_gust')>=0)return'wind';if(c.indexOf('measure_rain')>=0)return'cloud-rain';if(c.indexOf('measure_pressure')>=0)return'gauge';if(c.indexOf('measure_luminance')>=0)return'sun';if(c.indexOf('measure_price')>=0)return'tag';return'gauge';}
function inferUnit(c){if(c.indexOf('measure_temperature')>=0)return'°C';if(c.indexOf('measure_humidity')>=0||c.indexOf('measure_battery')>=0)return'%';if(c.indexOf('measure_co2')>=0)return'ppm';if(c.indexOf('meter_power')>=0)return'kWh';if(c.indexOf('measure_wind')>=0||c.indexOf('measure_gust')>=0)return'm/s';if(c.indexOf('measure_rain')>=0)return'mm';if(c.indexOf('measure_pressure')>=0)return'hPa';if(c.indexOf('measure_noise')>=0)return'dB';if(c.indexOf('measure_luminance')>=0)return'lx';if(c.indexOf('measure_price')>=0)return'kr';if(c.indexOf('range_battery')>=0)return'km';return'';}
function inferDec(c){return(c.indexOf('measure_humidity')>=0||c.indexOf('measure_co2')>=0||c.indexOf('measure_battery')>=0||c.indexOf('measure_pressure')>=0||c.indexOf('measure_noise')>=0||c.indexOf('measure_luminance')>=0||c.indexOf('meter_power')>=0||c.indexOf('range_battery')>=0||c.indexOf('odometer')>=0)?0:1;}
/* Egen anpassningsmeny for kopt/salt-brickan (hålltryck). Farg, nyans, styrka och
   periodval samlat. Period byts har ELLER genom att trycka pa brickan. */
function openKrEdit(g,i){
  var arr=gridTiles(g), cfg=arr[i]; if(!cfg)return;
  var col=cfg.col||'varm', hue=cfg.hue||0, op=krcTileOp(cfg), per=krcPer(cfg);
  var C=krcColors(cfg);
  var h='<div class="te"><div class="te-sec">Köpt / sålt</div>';
  // förhandsvisning
  h+='<div class="kre-prev" style="--krco:'+op+'"><div class="kre-fill"><i style="width:52%;background:'+C.kop+'"></i><i style="width:48%;background:'+C.sal+'"></i></div>'
    +'<span class="kre-prev-l">Köpt <b style="color:'+C.kop+'">·</b> Sålt <b style="color:'+C.sal+'">·</b></span></div>';
  // period
  h+='<div class="te-sec">Period</div><div class="te-tabs">';
  KRC_PER.forEach(function(pp){h+='<button class="te-tab'+(per===pp?' on':'')+'" onclick="krSet(\''+g+'\','+i+',\'per\',\''+pp+'\')">'+esc({day:'Dag',week:'Vecka',month:'Månad',year:'År'}[pp])+'</button>';});
  h+='</div>';
  // färgpar
  h+='<div class="te-sec">Färg</div><div class="kre-cols">';
  Object.keys(KRC_COLS).forEach(function(k){var cc=KRC_COLS[k];
    h+='<button class="kre-col'+(col===k?' on':'')+'" onclick="krSet(\''+g+'\','+i+',\'col\',\''+k+'\')" title="'+esc(cc.namn)+'">'
      +'<i style="background:'+hexHueShift(cc.kop,hue)+'"></i><i style="background:'+hexHueShift(cc.sal,hue)+'"></i></button>';});
  h+='</div>';
  // nyans (hue-skift)
  h+='<div class="te-sec">Nyans <span class="kre-val">'+(hue>0?'+':'')+hue+'°</span></div>';
  h+='<input class="kre-range" type="range" min="-60" max="60" step="10" value="'+hue+'" oninput="krSet(\''+g+'\','+i+',\'hue\',this.value)">';
  // styrka
  h+='<div class="te-sec">Styrka <span class="kre-val">'+Math.round(op*100)+' %</span></div>';
  h+='<input class="kre-range" type="range" min="10" max="85" step="5" value="'+Math.round(op*100)+'" oninput="krSet(\''+g+'\','+i+',\'op\',this.value)">';
  h+='<div class="cfg-btns" style="margin-top:14px"><button class="te-alt" onclick="krReset(\''+g+'\','+i+')">Återställ</button></div>';
  if(g==='flode'){h+='<div class="te-sec">Lägg till / ta bort</div><div class="te-move"><button onclick="addTile(\''+g+'\','+i+')"'+(arr.length>=12?' disabled':'')+'>+ Ny ruta</button><button class="te-alt" onclick="removeTile(\''+g+'\','+i+')"'+(arr.length<=1?' disabled':'')+'>Ta bort denna</button></div>';}
  h+='</div>';
  var dlg=$('dlg');if(dlg&&dlg.classList){dlg.classList.remove('wide');dlg.classList.add('edit');}
  setT('dlg-title','Köpt / sålt');setIcon('dlg-ic','coins');
  var bd=$('dlg-body');if(bd)bd.innerHTML=h;
  var back=$('dlg-back');if(back&&back.classList)back.classList.add('open');dlgTop();}
function krSet(g,i,key,val){
  var arr=gridTiles(g), cfg=arr[i]; if(!cfg)return;
  if(key==='hue')cfg.hue=parseInt(val,10)||0;
  else if(key==='op')cfg.op=Math.max(.1,Math.min(.85,(parseInt(val,10)||42)/100));
  else cfg[key]=val;
  saveGrid(g); renderTiles(g); openKrEdit(g,i);}
function krReset(g,i){
  var arr=gridTiles(g), cfg=arr[i]; if(!cfg)return;
  delete cfg.col;delete cfg.hue;delete cfg.op;delete cfg.sz;
  saveGrid(g); renderTiles(g); openKrEdit(g,i);}
/* Hållmeny för spotpris-rutan. v727: bara färger – storlekarna är fasta. */
function openSpotEdit(){
  var sp=szRead('spot');
  var h='<div class="te"><div class="te-sec">Spotpris</div>';
  h+='<div class="cfg-row"><span class="cfg-row-l">Ändtext färg</span><select class="cfg-sel" onchange="spotEndColor(this.value)"><option value="black"'+(sp.endWhite?'':' selected')+'>Svart</option><option value="white"'+(sp.endWhite?' selected':'')+'>Vit</option></select></div>';
  h+='<div class="te-sec">Färgkalibrering</div><div class="cfg-hint" style="margin-top:0">Skalan går från dygnets lägsta till dygnets högsta pris. Gränserna nedan används bara som reserv om dygnsdata saknas.</div>';
  h+=stepRow('Grönt under','spnum-green',Math.round((CFG.priceGreen!=null?CFG.priceGreen:0.20)*100)+' öre','spotGreen');
  h+=stepRow('Rött minst vid','spnum-red',Math.round((CFG.priceRed!=null?CFG.priceRed:0.80)*100)+' öre','spotRed');
  h+='<div class="cfg-hint" style="margin-top:8px">Elpriset hämtas direkt från Homey (measure_price_total) – samma pris som Homeys energisida, inkl. skatt, moms och avgifter.</div>';
  h+='<div class="cfg-btns" style="margin-top:14px"><button class="te-alt" onclick="spotReset()">Återställ</button></div>';
  h+='</div>';
  var body=$('dlg-body');if(body)body.innerHTML=h;
  var dlg=$('dlg');if(dlg&&dlg.classList){dlg.classList.remove('wide');dlg.classList.add('edit');}
  setT('dlg-title','Spotpris');setIcon('dlg-ic','tag');
  var back=$('dlg-back');if(back&&back.classList)back.classList.add('open');dlgTop();}
function spotEndColor(v){szWrite('spot').endWhite=(v==='white');saveCfg();applyCfg();}
function spotGreen(d){CFG.priceGreen=Math.max(0,Math.min((CFG.priceRed||0.80)-0.05,(CFG.priceGreen!=null?CFG.priceGreen:0.20)+d*0.05));saveCfg();render();var n=$('spnum-green');if(n)n.textContent=Math.round(CFG.priceGreen*100)+' öre';}
function spotRed(d){CFG.priceRed=Math.max((CFG.priceGreen||0.20)+0.05,Math.min(3,(CFG.priceRed!=null?CFG.priceRed:0.80)+d*0.05));saveCfg();render();var n=$('spnum-red');if(n)n.textContent=Math.round(CFG.priceRed*100)+' öre';}
function spotMoms(d){CFG.priceMoms=Math.max(0,Math.min(50,(CFG.priceMoms!=null?CFG.priceMoms:25)+d*5));saveCfg();render();var n=$('spnum-moms');if(n)n.textContent=CFG.priceMoms+' %';}
function spotPas(d){CFG.prisPaslag=Math.max(0,Math.min(300,(CFG.prisPaslag!=null?CFG.prisPaslag:68)+d));saveCfg();render();var n=$('spnum-pas');if(n)n.textContent=CFG.prisPaslag+' öre';}
/* Kalibrera mot Tibber: läs det aktuella råa spotpriset från Homey och räkna ut påslaget
   så att visat allt-inkl-pris = det pris du skriver in (det Tibber-appen visar just nu). */
function spotCalibrate(){
  var inp=$('spot-cal-in'),msg=$('spot-cal-msg');
  var real=inp?parseFloat(inp.value):NaN;
  if(!(real>0)){if(msg)msg.textContent='Skriv priset Tibber visar (i öre).';return;}
  var raw=cap(DEV.tibber,'measure_price_total');
  if(raw==null){if(msg)msg.textContent='Hittar inget spotpris från Homey just nu – försök igen om en stund.';return;}
  var moms=(CFG.priceMoms!=null?CFG.priceMoms:25);
  var pas=Math.round(real - raw*(1+moms/100)*100);   /* real(öre) = raw*(1+moms) + påslag(öre) */
  CFG.prisPaslag=Math.max(0,Math.min(300,pas));
  saveCfg();render();
  var n=$('spnum-pas');if(n)n.textContent=CFG.prisPaslag+' öre';
  if(msg)msg.textContent='Klart – påslag satt till '+CFG.prisPaslag+' öre (spot nu '+Math.round(raw*100)+' öre → '+real+' öre).';}
function spotReset(){var b=szWrite('spot');b.endWhite=false;CFG.priceGreen=0.20;CFG.priceRed=0.80;saveCfg();applyCfg();render();openSpotEdit();}
/* Köpt/sålt-slide: denna månad. Spåret delas köpt|sålt vid proportionen; beloppen rider på var sin sida. */
function renderKsBand(){
  var track=$('ks-track');if(!track)return;
  var r=monPer((CFG.ks&&CFG.ks.per)||'month');
  var rk=Math.round(r.k||0), rs=Math.round(r.s||0), tot=rk+rs;
  var pk=tot>0?(rk/tot):0.5, ps=1-pk;
  var kInt=function(v){return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g,'\u00a0');};
  var ks=$('ks-split');
  if(ks&&ks.style)ks.style.left=Math.max(4,Math.min(96,pk*100))+'%';
  var kc=$('ks-kop'),sc=$('ks-sal');
  if(kc){var kb=kc.querySelector('b');if(kb)kb.textContent=r.st?(kInt(rk)+' kr'):'–';if(kc.style)kc.style.left=Math.max(10,Math.min(90,pk*50))+'%';}
  if(sc){var sb=sc.querySelector('b');if(sb)sb.textContent=r.st?(kInt(rs)+' kr'):'–';if(sc.style)sc.style.left=Math.max(10,Math.min(90,pk*100+ps*50))+'%';}}
/* v727: fasta mått, samma på alla enheter. */
function knMatt(k){return KN_STD[k]||1;}
/* Marginalen runt knapprutan. Egen faktor, skild från knapparnas mått: man kan
   vilja ha stora knappar tätt mot kanten, eller små med luft omkring. */
function knMarg(){return 1;}

/* Luften kring de lodräta avdelarna. Ett mått för hela dashboarden: väder, vind
   och båda rutraderna. Sparas per enhetstyp som övriga storlekar. */
function avdPad(){return 16;}

/* Kvar för bakåtkompatibilitet: en tidigare version sparade CFG.knHojd. */
/* knMatt ger alltid ett tal, så en reserv här vore onåbar kod. Bakåt-
   kompatibiliteten med CFG.knHojd ligger i stället i knMatt-facket: en gammal
   inställning läses in en gång vid uppstart. */
function knHojd(){return knMatt('h');}
/* Flyttar CFG.knHojd till plattans fack. Körs en gång; därefter finns nyckeln
   inte kvar och funktionen gör ingenting. */

/* Rapportrutans höjd. Samma stegknappar som de andra rutorna, plus ett val för
   om den ska svälja överbliven höjd i kioskläget. */
/* Energi- och väderraden: fast höjd som ställs för hand. Rapporten under tar
   sedan det som blir över, så sidan alltid fyller skärmen. */

function openKsEdit(){
  var per=(CFG.ks&&CFG.ks.per)||'month';
  var h='<div class="te"><div class="te-sec">Köpt / sålt · period</div>';
  var pers=[['day','Idag'],['week','Vecka'],['month','Månad'],['year','År']];
  h+='<div class="seg-row">';
  for(var pi=0;pi<pers.length;pi++){h+='<button class="seg-btn'+(per===pers[pi][0]?' on':'')+'" onclick="ksSetPer(\''+pers[pi][0]+'\')">'+pers[pi][1]+'</button>';}
  h+='</div>';
  h+='</div>';
  var body=$('dlg-body');if(body)body.innerHTML=h;
  var dlg=$('dlg');if(dlg&&dlg.classList){dlg.classList.remove('wide');dlg.classList.add('edit');}
  setT('dlg-title','Köpt / sålt');setIcon('dlg-ic','coins');
  var back=$('dlg-back');if(back&&back.classList)back.classList.add('open');dlgTop();}
function ksSetPer(p){if(!CFG.ks)CFG.ks={};CFG.ks.per=p;saveCfg();render();openKsEdit();}
function ksSetPerDetail(p){if(!CFG.ks)CFG.ks={};CFG.ks.per=p;saveCfg();render();openDetail('kopt');}
function teGrp(g,i,gr){_teGrp=gr;openTileEdit(g,i);}
function openTileEdit(g,i){const arr=gridTiles(g),cur=arr[i];
  /* v193: 40 knappar i en klump gick inte att hitta i. Nu grupperat - en grupp i
     taget, och gruppen dar det valda vardet ligger oppnas av sig sjalv. */
  var curG=null;
  CAT.forEach(function(c){if(sameCfg(c,cur))curG=c.g||'Övrigt';});
  if(_teGrp==null)_teGrp=curG||CAT_GRP[0];
  if(!CAT.some(function(c){return (c.g||'Övrigt')===_teGrp;}))_teGrp=curG||CAT_GRP[0];
  let h='<div class="te"><div class="te-sec">Välj värde</div>';
  h+='<div class="te-tabs">'+CAT_GRP.filter(function(gr){return CAT.some(function(c){return (c.g||'Övrigt')===gr;});})
    .map(function(gr){var n=CAT.filter(function(c){return (c.g||'Övrigt')===gr;}).length;
      return '<button class="te-tab'+(_teGrp===gr?' on':'')+'" onclick="teGrp(\''+g+'\','+i+',\''+gr+'\')">'+esc(gr)+' <em>'+n+'</em></button>';}).join('')+'</div>';
  h+='<div class="te-grid">';
  CAT.forEach((c,ci)=>{if((c.g||'Övrigt')!==_teGrp)return;
    const m=computeMetric(c);h+='<button class="te-opt'+(sameCfg(c,cur)?' on':'')+'" onclick="setTile(\''+g+'\','+i+','+ci+')"><span class="te-opt-ic '+accFor(m.icon)+'">'+icon(m.icon)+'</span><span class="te-opt-l">'+esc(m.label)+'</span></button>';});
  h+='</div><div class="te-sec">Avancerat · valfri sensor</div><div class="te-adv">';
  h+='<select id="te-dev" onchange="teDevChange()"><option value="">Välj enhet…</option>'+devOptions(cur.type==='sensor'?cur.device:'')+'</select>';
  h+='<select id="te-cap"><option value="">Värde…</option></select>';
  h+='<button class="te-use" onclick="teUse(\''+g+'\','+i+')">Använd</button></div>';
  if(SOURCE==='demo-data'){const pr=tilePrimary(cur);h+='<div class="te-sec">Demovärde (endast demoläge)</div>';
    if(pr){const key=pr.dev+'|'+pr.cap,ov=demoOvGet()[key],curv=(ov!=null?ov:cap(pr.dev,pr.cap));
      if(pr.kind==='onoff'){const on=(curv==='on'||curv===true);h+='<div class="te-move"><button class="te-glow'+(on?' on':'')+'" onclick="setDemoOv(\''+g+'\','+i+',\''+(on?'off':'on')+'\')">'+(on?'På':'Av')+'</button><button class="te-alt" onclick="clearDemoOv(\''+g+'\','+i+')">Nollställ</button></div>';}
      else{h+='<div class="te-adv"><input id="te-demo" class="te-numin" type="number" step="any" value="'+(curv==null?'':curv)+'"><button class="te-use" onclick="setDemoOv(\''+g+'\','+i+')">Använd</button><button class="te-alt" onclick="clearDemoOv(\''+g+'\','+i+')">Nollställ</button></div>';}
    }else h+='<div class="learn-hint">Den här rutan räknas ur flera värden och har inget enskilt demovärde.</div>';}
  /* v739: IKON. Samma väljare som knapparna, plus energi- och väderikonerna. */
  {const autoIc=computeMetric(Object.assign({},cur,{ic:null})).icon,eget=(cur.ic&&ICONS[cur.ic])?cur.ic:null;
   h+='<div class="te-sec">Ikon</div><div class="be-ico-top"><button class="be-ico-auto'+(eget?'':' on')+'" onclick="teIkon(\''+g+'\','+i+',\'auto\')">'+icon(autoIc)+'<span>Automatisk</span></button></div><div class="be-ico-wrap">';
   TILE_ICONS.forEach(function(G){
     h+='<div class="be-grp">'+G[0]+'</div><div class="be-ico-grid">';
     G[1].forEach(function(nm){if(!ICONS[nm])return;
       h+='<button class="be-ico'+(eget===nm?' on':'')+'" title="'+nm+'" onclick="teIkon(\''+g+'\','+i+',\''+nm+'\')">'+icon(nm)+'</button>';});
     h+='</div>';});
   h+='</div>';}
  h+='<div class="te-sec">Glow vid händelser</div><div class="te-move"><button class="te-glow'+(cur.glow!==false?' on':'')+'" onclick="toggleTileGlow(\''+g+'\','+i+')">'+(cur.glow!==false?'Glow på':'Glow av')+'</button>'
    /* Indikatorikonen styrs för sig. Den säger VAD som pågår — laddning,
       produktion, olåst — och det vill man ofta se även med glowet av. */
    +'<button class="te-glow'+(cur.stik!==false?' on':'')+'" onclick="toggleTileStik(\''+g+'\','+i+')">'
    +(cur.stik!==false?'Ikon på':'Ikon av')+'</button>'
    +'<button class="te-glow gr'+(cur.graph!==false?' on':'')+'" onclick="toggleTileGraph(\''+g+'\','+i+')">'+(cur.graph!==false?'Graf på':'Graf av')+'</button><button class="te-glow'+(cur.trend===true?' on':'')+'" onclick="toggleTileTrend(\''+g+'\','+i+')">'+(cur.trend===true?'Trendpil ▲▼ på':'Trendpil av')+'</button></div>';
  h+='<div class="te-sec">Flytta ruta</div><div class="te-move"><button onclick="moveTile(\''+g+'\','+i+',-1)"'+(i<=0?' disabled':'')+'>'+icon('arrow-fat-up')+' Upp</button><button onclick="moveTile(\''+g+'\','+i+',1)"'+(i>=arr.length-1?' disabled':'')+'>'+icon('arrow-fat-up','flip')+' Ner</button></div>';
  if(g==='flode'){h+='<div class="te-sec">Lägg till / ta bort</div><div class="te-move"><button onclick="addTile(\''+g+'\','+i+')"'+(arr.length>=12?' disabled':'')+'>+ Ny ruta</button><button class="te-alt" onclick="removeTile(\''+g+'\','+i+')"'+(arr.length<=1?' disabled':'')+'>Ta bort denna</button></div>';}
  h+='</div>';
  const dlg=$('dlg');if(dlg&&dlg.classList){dlg.classList.add('wide');dlg.classList.add('edit');}
  setT('dlg-title','Anpassa ruta');setIcon('dlg-ic','gauge');
  const bd=$('dlg-body');if(bd)bd.innerHTML=h;
  if(cur.type==='sensor'){teDevChange();const cp=$('te-cap');if(cp)cp.value=cur.cap;}
  const bk=$('dlg-back');if(bk&&bk.classList)bk.classList.add('open');dlgTop();}
function teDevChange(){const dv=$('te-dev'),cp=$('te-cap');if(!dv||!cp)return;const caps=capList(dv.value);
  cp.innerHTML='<option value="">Värde…</option>'+caps.map(c=>'<option value="'+c+'">'+esc(capLabel(c))+'</option>').join('');}
function tilePrimary(cfg){if(!cfg)return null;
  if(cfg.type==='sensor')return {dev:cfg.device,cap:cfg.cap,kind:'num'};
  const M={solnow:[DEV.solar,'measure_power'],solday:[DEV.solar,'meter_power.day'],house:[DEV.consume,husCap()],
    cost:[DEV.pulse,'accumulatedCost'],spot:[DEV.tibber,'measure_price_total'],gridbal:[DEV.pulse,'measure_power'],gridnow:[DEV.pulse,'measure_power'],
    sold:[DEV.pulse,'meter_power.exported'],bought:[DEV.pulse,'meter_power.imported'],
    battpct:[DEV.battery,'measure_battery'],battpow:[DEV.battery,'measure_power'],battnow:[DEV.battery,'measure_power'],
    humidity:[DEV.outdoor,'measure_humidity'],rain:[DEV.rain,'measure_rain.24h'],pressure:[DEV.vader,'measure_pressure'],
    poolheat:[DEV.poolheat,'onoff','onoff'],
    dish:[DEV.dish,'onoff','onoff'],
    car1:[DEV.car,'measure_battery'],car2:[DEV.car2,'measure_battery']};
  const m=M[cfg.key];return m?{dev:m[0],cap:m[1],kind:m[2]||'num'}:null;}
function demoOvGet(){if(!_demoOv){try{_demoOv=JSON.parse(localStorage.getItem('demoov_v1')||'{}');}catch(e){_demoOv={};}}return _demoOv;}
function demoOvSave(){try{localStorage.setItem('demoov_v1',JSON.stringify(_demoOv));}catch(e){}}
function demoOvApply(base){const o=demoOvGet();for(const key in o){const p=key.split('|'),id=p[0],c=p[1];if(!base[id])base[id]={name:id,class:'other',capabilitiesObj:{}};if(!base[id].capabilitiesObj[c])base[id].capabilitiesObj[c]={value:null};base[id].capabilitiesObj[c].value=o[key];}
  const bp=o[DEV.battery+'|measure_power'];if(bp!=null&&base[DEV.battery])base[DEV.battery].capabilitiesObj['battery_charging_state']={value:bp>0?'charging':bp<0?'discharging':'idle'};}
function setDemoOv(g,i,forceVal){const cur=gridTiles(g)[i],pr=tilePrimary(cur);if(!pr)return;let val;
  if(forceVal!==undefined)val=forceVal;else{const el=$('te-demo');if(!el)return;val=parseFloat(el.value);if(!isFinite(val))return;}
  demoOvGet()[pr.dev+'|'+pr.cap]=val;demoOvSave();applyScenario(curScenario);render();openTileEdit(g,i);}
function clearDemoOv(g,i){const cur=gridTiles(g)[i],pr=tilePrimary(cur);if(!pr)return;delete demoOvGet()[pr.dev+'|'+pr.cap];demoOvSave();applyScenario(curScenario);render();openTileEdit(g,i);}
/* v739: rutans ikon. 'auto' tar bort valet. Ligger i rutans post – för de sex
   rutorna alltså i det delade facket, samma ikon på alla enheter. Redigeraren
   ritas om på samma skrollposition, annars hoppar den upp till toppen. */
function teIkon(g,i,nm){
  var a=gridTiles(g),c=a[i];if(!c)return;
  if(nm==='auto'||!ICONS[nm])delete c.ic;else c.ic=nm;
  saveGrid(g);renderTiles(g);
  var bd=$('dlg-body'),y=bd?bd.scrollTop:0;
  openTileEdit(g,i);
  bd=$('dlg-body');if(bd)bd.scrollTop=y;}
function setTile(g,i,ci){gridTiles(g)[i]=Object.assign({},CAT[ci]);saveGrid(g);renderTiles(g);openTileEdit(g,i);}
function teUse(g,i){const dv=$('te-dev'),cp=$('te-cap');if(!dv||!cp||!dv.value||!cp.value){return;}
  gridTiles(g)[i]={type:'sensor',device:dv.value,cap:cp.value,label:(DATA[dv.value]&&DATA[dv.value].name)||'Värde',icon:inferIcon(cp.value),unit:inferUnit(cp.value),dec:inferDec(cp.value)};
  saveGrid(g);renderTiles(g);openTileEdit(g,i);}
function moveTile(g,i,d){const arr=gridTiles(g),j=i+d;if(j<0||j>=arr.length)return;const t=arr[i];arr[i]=arr[j];arr[j]=t;saveGrid(g);renderTiles(g);openTileEdit(g,j);}
function addTile(g,i){const arr=gridTiles(g);if(arr.length>=12)return;arr.splice(i+1,0,{type:'computed',key:'house'});saveGrid(g);renderTiles(g);if(typeof setTimeout==='function')setTimeout(fitScreen,40);openTileEdit(g,i+1);}
function removeTile(g,i){const arr=gridTiles(g);if(arr.length<=1)return;
  /* v732: Breveden, Diskmaskin och Belysning läggs annars tillbaka av fastaRutor.
     En dold markör i layouten säger att du tagit bort den med flit. Lägg till den
     igen via katalogen (Hus) om du ångrar dig. */
  const t0=arr[i];
  if(g==='flode'&&t0&&t0.type==='computed'&&['breveden','dish','hem'].indexOf(t0.key)>=0
     &&!arr.some(function(x,j){return j!==i&&x&&x.type==='computed'&&x.key===t0.key&&x.dold;}))arr[i]={type:'computed',key:t0.key,dold:true};
  else arr.splice(i,1);saveGrid(g);renderTiles(g);if(typeof setTimeout==='function')setTimeout(fitScreen,40);closeDetail();}
function toggleTileGlow(g,i){const arr=gridTiles(g);arr[i].glow=(arr[i].glow===false);if(arr[i].glow)delete arr[i].glow;saveGrid(g);renderTiles(g);openTileEdit(g,i);}
/* Indikatorikonen uppe till höger. Sparas i rutans egen post, alltså i
   tiles*-nyckeln som redan synkas till Homey — ingen ny nyckel att hålla reda
   på, och inställningen följer med till de andra enheterna. */
function toggleTileStik(g,i){
  const arr=gridTiles(g);
  arr[i].stik=(arr[i].stik===false);
  if(arr[i].stik)delete arr[i].stik;   /* på är standard: spara bara avvikelsen */
  saveGrid(g);renderTiles(g);openTileEdit(g,i);}
function toggleTileGraph(g,i){const arr=gridTiles(g);if(arr[i].graph===false)delete arr[i].graph;else arr[i].graph=false;saveGrid(g);openTileEdit(g,i);}
function toggleTileTrend(g,i){const arr=gridTiles(g);if(arr[i].trend===true)delete arr[i].trend;else arr[i].trend=true;saveGrid(g);renderTiles(g);openTileEdit(g,i);}

/* ===== anpassningsbara knappar ===== */
function migrateButtons(a){let ch=false;(a||[]).forEach(b=>{if(b&&(b.device==='8e518f13-5b19-4b5e-987f-1bb41d1e763b'||b.cap==='solaredge-home-load-controller-state')){b.device='e97d77e7-c4e5-407d-8d7c-b03edb95a63e';b.cap='onoff';b.type='toggle';delete b.on;delete b.off;if(b.value==='on')b.value=true;else if(b.value==='off')b.value=false;ch=true;}});if(ch){try{localStorage.setItem('buttons_v1',JSON.stringify(a));}catch(e){}}return a;}
function loadButtons(){try{const s=localStorage.getItem('buttons_v1');if(s){const a=JSON.parse(s);if(Array.isArray(a)&&a.length)return migrateButtons(a);}}catch(e){}return null;}
function saveButtons(){try{localStorage.setItem('buttons_v1',JSON.stringify(CONFIG.BUTTONS));}catch(e){}
  syncPushSoon();}
function isControllable(d){if(!d||!d.capabilitiesObj)return false;for(const c of CTL_CAPS)if(c in d.capabilitiesObj)return true;return false;}
function ctlDevices(sel){return Object.keys(DATA).filter(id=>isControllable(DATA[id])).map(id=>({id,name:DATA[id].name||id,zone:zoneName(DATA[id].zone)||''})).sort((a,b)=>a.name.localeCompare(b.name,'sv')).map(o=>'<option value="'+o.id+'"'+(o.id===sel?' selected':'')+'>'+esc(o.name)+(o.zone?' · '+esc(o.zone):'')+'</option>').join('');}
function inferBtnIcon(devId){const d=DATA[devId];const c=d&&(d.class||d.type);
  const m={light:'lightbulb',socket:'plug',windowcoverings:'umbrella',fan:'fan',lock:'lock',heatpump:'snowflake',
    thermostat:'thermometer',heater:'flame',airconditioning:'snowflake',speaker:'speaker-high',tv:'television',
    camera:'camera',doorbell:'bell',sensor:'gauge',vacuumcleaner:'robot',kettle:'coffee',coffeemachine:'coffee',
    washer:'washing-machine',dryer:'washing-machine',dishwasher:'washing-machine',oven:'oven',evcharger:'charging-station',
    car:'car',solarpanel:'solar-panel',battery:'battery-high',homealarm:'shield-check',curtain:'umbrella',blinds:'umbrella'};
  return m[c]||'lightning';}
function beTypeOf(b){return b.type==='vanor'?'vanor':b.type==='battladd'?'battladd':b.type==='disk'?'disk':b.type==='breveden'?'breveden':b.type==='flow'?'flow':b.type==='flowtoggle'?'flowtoggle':b.type==='mood'?'mood':b.type==='moodtoggle'?'moodtoggle':b.type==='allLightsOff'?'special':'dev';}
function beStash(){var g=function(id){var e=$(id);return e?e.value:null;},v;
  var l=$('be-label');if(l&&typeof l.value==='string')_beLabel=l.value;
  if((v=g('be-dev'))!=null)_beDev=v;
  if((v=g('be-act'))!=null)_beAct=v;
  if((v=g('be-flow'))!=null)_beFlow=v;
  if((v=g('be-mood'))!=null)_beMood=v;
  if((v=g('be-mood-on'))!=null)_beMoodOn=v;
  if((v=g('be-mood-off'))!=null)_beMoodOff=v;
  if((v=g('be-mood-ref'))!=null)_beRef=v;}
function beSetType(i,t){beStash();_beType=t;openBtnEdit(i,true);}
function bePickIcon(i,n){beStash();_beIcon=(n==='auto')?null:n;openBtnEdit(i,true);}
function beMsg(t){var e=$('be-msg');if(e)e.textContent=t||'';}
/* Vilken ikon knappen får om man låter den vara automatisk */
function beAutoIcon(){
  if(_beType==='vanor')return 'clock';
  if(_beType==='moodtoggle')return 'lightbulb';
  if(_beType==='flowtoggle')return 'toggle-left';
  if(_beType==='flow')return 'lightning';
  if(_beType==='mood')return 'sparkle';
  if(_beType==='special')return 'moon';
  var dv=$('be-dev');return (dv&&dv.value)?inferBtnIcon(dv.value):'lightning';}
function openBtnEdit(i,keep){const b=CONFIG.BUTTONS[i]||{};_beIdx=i;ensureFlows();ensureMoods();
  if(!keep){_beType=beTypeOf(b);_beIcon=(b.icon&&b.type!=='moodtoggle')?b.icon:null;_beLabel=null;
    _beDev=null;_beAct=null;_beFlow=null;_beMood=null;_beMoodOn=null;_beMoodOff=null;_beRef=null;}
  var T=_beType,lab=(_beLabel!=null)?_beLabel:(b.label||'');
  var moOpts=function(sel){return moodList().map(function(mo){return '<option value="'+mo.id+'"'+(mo.id===sel?' selected':'')+'>'+esc(mo.name)+'</option>';}).join('');};
  let h='<div class="te">';
  /* --- Typ --- */
  h+='<div class="te-sec">Knapptyp</div><div class="be-types">';
  for(var t=0;t<BE_TYPES.length;t++){var Y=BE_TYPES[t];
    h+='<button class="be-type'+(T===Y[0]?' on':'')+'" onclick="beSetType('+i+',\''+Y[0]+'\')">'+icon(Y[2])+'<span>'+Y[1]+'</span></button>';}
  h+='</div>';
  /* --- Namn --- */
  h+='<div class="te-sec">Namn</div><input id="be-label" class="te-input" value="'+esc(lab)+'" placeholder="Knappens text">';
  /* --- Inställningar för vald typ --- */
  if(T==='dev'){
    h+='<div class="te-sec">Enhet</div><div class="te-adv"><select id="be-dev" onchange="beDevChange()"><option value="">Välj enhet…</option>'+ctlDevices((_beDev!=null)?_beDev:(b.device||''))+'</select></div>';
    h+='<div class="te-sec">Handling</div><div class="te-adv"><select id="be-act"><option value="">Välj handling…</option></select></div>';
  }else if(T==='flow'){
    h+='<div class="te-sec">Homey-flow</div><div class="te-adv"><select id="be-flow"><option value="">Välj flow…</option>'+flowList().map(function(f){return '<option value="'+f.type+':'+f.id+'"'+(((_beFlow!=null)?(_beFlow===f.type+':'+f.id):(b.type==='flow'&&b.flowId===f.id))?' selected':'')+'>'+esc(f.name)+(f.type==='advanced'?' (avancerad)':'')+'</option>';}).join('')+'</select></div>';
  }else if(T==='mood'){
    h+='<div class="te-sec">Mood att aktivera</div><div class="te-adv"><select id="be-mood"><option value="">Välj mood…</option>'+moOpts((_beMood!=null)?_beMood:(b.type==='mood'?b.moodId:''))+'</select></div>';
  }else if(T==='flowtoggle'){
    h+='<div class="te-sec">Växla mellan två flows</div><div class="te-adv">';
    h+='<label class="be-ml">På-flow</label><select id="be-flow-on"><option value="">Välj…</option>'
      +flowList().map(function(f){return '<option value="'+f.type+':'+f.id+'"'
        +((b.type==='flowtoggle'&&b.flowOn===f.id)?' selected':'')+'>'+esc(f.name)+'</option>';}).join('')+'</select>';
    h+='<label class="be-ml">Av-flow</label><select id="be-flow-off"><option value="">Välj…</option>'
      +flowList().map(function(f){return '<option value="'+f.type+':'+f.id+'"'
        +((b.type==='flowtoggle'&&b.flowOff===f.id)?' selected':'')+'>'+esc(f.name)+'</option>';}).join('')+'</select>';
    h+='<label class="be-ml">Följ enhet för på/av-läge (valfritt)</label><select id="be-flow-ref"><option value="">Kom ihåg senaste tryck</option>'
      +ctlDevices((_beRef!=null)?_beRef:(b.type==='flowtoggle'?b.refDev:''))+'</select>';
    h+='</div>';
    h+='<div class="cfg-hint" style="margin-top:6px">Knappen växlar mellan de två flowen. '
      +'Utan följ-enhet minns den bara sitt eget senaste tryck — startas flowet från '
      +'Homey-appen vet den inte om det. Välj en enhet som ändras av flowet så stämmer '
      +'läget alltid.</div>';
  }else if(T==='moodtoggle'){
    h+='<div class="te-sec">Växla mellan två moods</div><div class="te-adv">';
    h+='<label class="be-ml">På-mood</label><select id="be-mood-on"><option value="">Välj…</option>'+moOpts((_beMoodOn!=null)?_beMoodOn:(b.type==='moodtoggle'?b.moodOn:''))+'</select>';
    h+='<label class="be-ml">Av-mood</label><select id="be-mood-off"><option value="">Välj…</option>'+moOpts((_beMoodOff!=null)?_beMoodOff:(b.type==='moodtoggle'?b.moodOff:''))+'</select>';
    h+='<label class="be-ml">Följ enhet för på/av-läge (valfritt)</label><select id="be-mood-ref"><option value="">Känn av automatiskt</option>'+ctlDevices((_beRef!=null)?_beRef:(b.type==='moodtoggle'?b.refDev:''))+'</select></div>';
    h+='<div class="cfg-hint" style="margin-top:6px">Knappen visar tänd eller släckt lampa efter läget, och texten växlar mellan Tänd och Släck.</div>';
    /* Vad automatiken faktiskt lyssnar på just nu – annars är det omöjligt att se
       varför knappen står i ett visst läge. */
    h+='<div class="cfg-hint" id="be-sense" style="margin-top:6px">'+moodSenseText(i)+'</div>';
  }else if(T==='battladd'){
    h+='<div class="cfg-hint" style="margin-top:8px">Ett tryck startar '
      +'<b>Batteri · ladda max 5000 W</b>, ett till återgår till '
      +'<b>Batteri · normal drift</b>. Två tryck krävs alltid — ett misstag '
      +'startar laddning från nätet på 5 kW.<br><br>'
      +'Läget läses ur växelriktaren, inte ur minnet av senaste tryck: '
      +'kontrolläge 4 och laddläge 3 betyder att den laddar max. Ställs det om '
      +'från Homey-appen visar knappen det ändå. Undertexten säger vad '
      +'växelriktaren faktiskt står i.</div>';
  }else if(T==='disk'){
    h+='<div class="cfg-hint" style="margin-top:8px">Bokar diskmaskinen till dygnets '
      +'billigaste sammanhängande fönster på 2,5 timmar. Ett tryck bokar, ett till avbokar.<br><br>'
      +'Knappen tänds när något är bokat och visar då starttiden i stället för namnet. '
      +'Natten får 15 öres avdrag i jämförelsen, så ett nattpris på 91 öre går före '
      +'80 öre mitt på dagen.<br><br><b>HomeyScriptet räknar</b> — dashboarden bokar och '
      +'läser bara. Maskinen måste ha fjärrstart aktiverad, annars avstår vakten.<br><br>'
      +'Inget att ställa in — bara namnet.</div>';
  }else if(T==='breveden'){
    h+='<div class="cfg-hint" style="margin-top:8px">Värmepumpen i gäststugan. Knappen '
      +'startar eller stoppar bevakningen — <b>HomeyScriptet avgör</b> om det blir kyla '
      +'eller värme, och svarar med en push om ingenting behövs.<br><br>'
      +'Ikonen visar läget: snöflinga för kyla, låga för värme, termometer när '
      +'temperaturen redan ligger rätt. Ett frågetecken betyder att värdet är äldre än '
      +'45 minuter.<br><br>Inget att ställa in — bara namnet.</div>';
  }else if(T==='vanor'){
    h+='<div class="cfg-hint" style="margin-top:8px">Öppnar en lista med de enheter '
      +'du brukar tända eller släcka <b>just den här tiden på dygnet</b>. Listan är '
      +'inte fast — den byggs av vad som faktiskt händer i huset.<br><br>'
      +'Varje ändring bokförs med klockslag, oavsett om den kom härifrån, från '
      +'Homey-appen eller från en strömbrytare. Vanor som upphör tynar bort på '
      +'ungefär en månad.<br><br>'
      +'Minnet ligger i <b>den här webbläsaren</b>: plattan och telefonen lär sig '
      +'var för sig. Tills den har lärt sig något visar den i stället det som är '
      +'tänt just nu.<br><br>Inget att ställa in — bara namnet.</div>';
  }else if(T==='special'){
    h+='<div class="cfg-hint" style="margin-top:8px">Släcker alla lampor i hemmet med ett tryck.</div>';
  }
  /* --- Ikon --- */
  h+='<div class="te-sec">Ikon</div>';
  h+='<div class="be-ico-top"><button class="be-ico-auto'+(_beIcon==null?' on':'')+'" onclick="bePickIcon('+i+',\'auto\')">'+icon(beAutoIcon())+'<span>Automatisk</span></button>';
  if(T==='moodtoggle'&&_beIcon==null)h+='<span class="be-ico-note">följer på/av-läget</span>';
  h+='</div>';
  h+='<div class="be-ico-wrap">';
  for(var g=0;g<BTN_ICONS.length;g++){var G=BTN_ICONS[g];
    h+='<div class="be-grp">'+G[0]+'</div><div class="be-ico-grid">';
    for(var n=0;n<G[1].length;n++){var nm=G[1][n];if(!ICONS[nm])continue;
      h+='<button class="be-ico'+(_beIcon===nm?' on':'')+'" title="'+nm+'" onclick="bePickIcon('+i+',\''+nm+'\')">'+icon(nm)+'</button>';}
    h+='</div>';}
  h+='</div>';
  /* --- Bekräftelse + EN spara-knapp --- */
  h+='<label class="te-chk"><input type="checkbox" id="be-confirm"'+(b.confirm?' checked':'')+'> Kräv bekräftelse (tryck två gånger)</label>';
  h+='<div id="be-msg" class="be-msg"></div>';
  h+='<button class="te-use be-save" onclick="beSave('+i+')">Spara knapp</button>';
  h+='<div class="te-move" style="margin-top:10px"><button class="te-alt" onclick="beAdd('+i+')">＋ Lägg till ny knapp</button><button class="te-alt" onclick="beRemove('+i+')">Ta bort denna knapp</button></div></div>';
  const dlg=$('dlg');if(dlg&&dlg.classList){dlg.classList.add('wide');dlg.classList.add('edit');}
  setT('dlg-title','Anpassa knapp');setIcon('dlg-ic',_beIcon||beAutoIcon());
  const bd=$('dlg-body');if(bd)bd.innerHTML=h;
  if(T==='dev'){var dvv=$('be-dev');
    if(dvv&&dvv.value){beDevChange();
      var want=(_beAct!=null&&_beAct!=='')?_beAct:(b.type==='set'?('set:'+b.cap+':'+b.value):(b.type==='toggle'?('toggle:'+b.cap):''));
      var ac=$('be-act');if(ac&&want)ac.value=want;}}
  const bk=$('dlg-back');if(bk&&bk.classList)bk.classList.add('open');dlgTop();}
/* En enda spara-knapp som förstår vald typ */
function beSave(i){
  var lb=$('be-label'),cf=$('be-confirm');
  var label=(lb&&typeof lb.value==='string'&&lb.value.trim())||'';
  var T=_beType,cfg=null;
  if(T==='dev'){
    var dv=$('be-dev'),ac=$('be-act');
    if(!dv||!dv.value){beMsg('Välj en enhet först.');return;}
    if(!ac||!ac.value){beMsg('Välj vad knappen ska göra.');return;}
    var parts=ac.value.split(':'),kind=parts[0],capn=parts[1];
    var dname=(DATA[dv.value]&&DATA[dv.value].name)||'Knapp';
    cfg={label:label||dname,device:dv.value,cap:capn,icon:_beIcon||inferBtnIcon(dv.value)};
    if(kind==='toggle'){cfg.type='toggle';if(capn==='windowcoverings_state'){cfg.on='down';cfg.off='up';}else if(capn==='solaredge-home-load-controller-state'){cfg.on='on';cfg.off='off';}}
    else{cfg.type='set';var raw=parts[2];cfg.value=(raw==='true')?true:(raw==='false')?false:(/^-?\d*\.?\d+$/.test(raw)?Number(raw):raw);}
  }else if(T==='flowtoggle'){
    var fo=$('be-flow-on'),ff=$('be-flow-off'),fr=$('be-flow-ref');
    if(!fo||!fo.value){beMsg('Välj ett på-flow först.');return;}
    if(!ff||!ff.value){beMsg('Välj ett av-flow först.');return;}
    var po=fo.value.split(':'),pff=ff.value.split(':');
    var fOn=flowList().find(function(x){return x.id===po.slice(1).join(':');});
    var fOff=flowList().find(function(x){return x.id===pff.slice(1).join(':');});
    cfg={label:label||(fOn&&fOn.name)||'Växla',type:'flowtoggle',
      flowOn:po.slice(1).join(':'),flowOnType:po[0],
      flowOff:pff.slice(1).join(':'),flowOffType:pff[0],
      labelOn:label||(fOn&&fOn.name)||'På',
      labelOff:label||(fOff&&fOff.name)||'Av',
      refDev:(fr&&fr.value)||'',
      icon:_beIcon||'toggle-left',icoval:_beIcon?1:0,confirm:!!(cf&&cf.checked)};
  }else if(T==='flow'){
    var fl=$('be-flow');if(!fl||!fl.value){beMsg('Välj en flow först.');return;}
    var pf=fl.value.split(':'),ftype=pf[0],fid=pf.slice(1).join(':');
    var f=flowList().find(function(x){return x.id===fid;});
    cfg={label:label||(f&&f.name)||'Flow',type:'flow',flowId:fid,flowType:ftype,icon:_beIcon||'lightning'};
  }else if(T==='mood'){
    var mo=$('be-mood');if(!mo||!mo.value){beMsg('Välj en mood först.');return;}
    var m=moodList().find(function(x){return x.id===mo.value;});
    cfg={label:label||(m&&m.name)||'Mood',type:'mood',moodId:mo.value,icon:_beIcon||'sparkle'};
  }else if(T==='moodtoggle'){
    var on=$('be-mood-on'),off=$('be-mood-off'),rf=$('be-mood-ref');
    if(!on||!on.value||!off||!off.value){beMsg('Välj både på-mood och av-mood.');return;}
    cfg={label:label||'På / Av',type:'moodtoggle',moodOn:on.value,moodOff:off.value};
    if(rf&&rf.value){cfg.refDev=rf.value;cfg.refCap='onoff';}
    if(_beIcon){cfg.icon=_beIcon;cfg.icoval=1;}
  }else if(T==='disk'){
    /* HÄR SAKNADES GRENEN i v510. Typen fanns i listan, i beTypeOf och i
       ritningen — men inte här, så knappen sparades som en enhetsknapp utan
       enhet. Den kunde därför varken tändas eller göra något.
       Som Breveden: inget att spara utöver namnet, flows och variabel är fasta. */
    cfg={label:label||'Diskmaskin',type:'disk',icon:_beIcon||'fork-knife'};
  }else if(T==='battladd'){
    /* Som diskmaskinen: inget att spara utover namnet. Flodena och registret
       ar fasta, och tva tryck kravs alltid oavsett kryssrutan. */
    cfg={label:label||'Ladda batteriet',type:'battladd',icon:_beIcon||'battery-charging',
      icoval:_beIcon?1:0};
  }else if(T==='vanor'){
    /* Som Breveden och diskmaskinen: inget att spara utover namnet. Vad
       knappen visar bestams av vad som hant i huset, inte av en installning. */
    cfg={label:label||'Enheter',type:'vanor',icon:_beIcon||'clock',icoval:_beIcon?1:0};
  }else if(T==='breveden'){
    /* Inget att spara utöver namnet: flows och logikvariabel är fasta, och
       skriptet äger all bedömning. */
    cfg={label:label||'Breveden',type:'breveden',icon:_beIcon||'thermometer-simple',icoval:_beIcon?1:0};
  }else{
    cfg={label:label||'Släck allt',type:'allLightsOff',icon:_beIcon||'moon'};
  }
  cfg.confirm=!!(cf&&cf.checked);
  CONFIG.BUTTONS[i]=cfg;saveButtons();renderControls();beMsg('');openBtnEdit(i);}
function beDevChange(){const dv=$('be-dev'),ac=$('be-act');if(!dv||!ac)return;const d=DATA[dv.value],co=d&&d.capabilitiesObj||{};let o='<option value="">Välj handling…</option>';
  if('onoff'in co){o+='<option value="toggle:onoff">Växla på / av</option><option value="set:onoff:true">Slå på</option><option value="set:onoff:false">Slå av</option>';}
  if('windowcoverings_state'in co){o+='<option value="toggle:windowcoverings_state">Växla upp / ner</option><option value="set:windowcoverings_state:down">Kör ner</option><option value="set:windowcoverings_state:up">Kör upp</option>';}
  if('dim'in co){o+='<option value="set:dim:1">Dimma 100 %</option><option value="set:dim:0.5">Dimma 50 %</option><option value="set:dim:0">Dimma 0 %</option>';}
  if('locked'in co){o+='<option value="set:locked:true">Lås</option><option value="set:locked:false">Lås upp</option>';}
  if('solaredge-home-load-controller-state'in co){o+='<option value="toggle:solaredge-home-load-controller-state">Växla på / av</option><option value="set:solaredge-home-load-controller-state:on">Slå på</option><option value="set:solaredge-home-load-controller-state:off">Slå av</option>';}
  ac.innerHTML=o;
  const lb=$('be-label'),d2=DATA[dv.value];if(lb&&d2&&d2.name&&!(lb.value||'').trim())lb.value=d2.name;
  try{setIcon('dlg-ic',_beIcon||beAutoIcon());}catch(e){}}
function beUse(i){const dv=$('be-dev'),ac=$('be-act'),lb=$('be-label'),cf=$('be-confirm');if(!dv||!ac||!dv.value||!ac.value)return;
  const parts=ac.value.split(':'),kind=parts[0],capn=parts[1];const dname=(DATA[dv.value]&&DATA[dv.value].name)||'Knapp';
  let cfg={label:((lb&&typeof lb.value==='string'&&lb.value.trim())||dname),icon:inferBtnIcon(dv.value),device:dv.value,cap:capn,confirm:!!(cf&&cf.checked)};
  if(kind==='toggle'){cfg.type='toggle';if(capn==='windowcoverings_state'){cfg.on='down';cfg.off='up';}else if(capn==='solaredge-home-load-controller-state'){cfg.on='on';cfg.off='off';}}
  else{cfg.type='set';const raw=parts[2];cfg.value=(raw==='true')?true:(raw==='false')?false:(/^-?\d*\.?\d+$/.test(raw)?Number(raw):raw);}
  CONFIG.BUTTONS[i]=cfg;saveButtons();renderControls();openBtnEdit(i);}
function beSpecial(i){const lb=$('be-label');CONFIG.BUTTONS[i]={label:(lb&&lb.value.trim())||'Släck allt',icon:'moon',type:'allLightsOff'};saveButtons();renderControls();openBtnEdit(i);}
function beFlow(i){const fl=$('be-flow'),lb=$('be-label'),cf=$('be-confirm');if(!fl||!fl.value)return;
  const p=fl.value.split(':'),ftype=p[0],fid=p.slice(1).join(':');
  const f=flowList().find(x=>x.id===fid);
  CONFIG.BUTTONS[i]={label:((lb&&typeof lb.value==='string'&&lb.value.trim())||(f&&f.name)||'Flow'),icon:'sparkle',type:'flow',flowId:fid,flowType:ftype,confirm:!!(cf&&cf.checked)};
  saveButtons();renderControls();openBtnEdit(i);}
function beMood(i){const fl=$('be-mood'),lb=$('be-label'),cf=$('be-confirm');if(!fl||!fl.value)return;
  const mo=moodList().find(x=>x.id===fl.value);
  CONFIG.BUTTONS[i]={label:((lb&&typeof lb.value==='string'&&lb.value.trim())||(mo&&mo.name)||'Mood'),icon:'lightbulb',type:'mood',moodId:fl.value,confirm:!!(cf&&cf.checked)};
  saveButtons();renderControls();openBtnEdit(i);}
function beMoodToggle(i){var on=$('be-mood-on'),off=$('be-mood-off'),lb=$('be-label'),cf=$('be-confirm'),rf=$('be-mood-ref');
  if(!on||!on.value||!off||!off.value){flashDlg&&flashDlg('Välj både på- och av-mood');return;}
  var btn={label:((lb&&typeof lb.value==='string'&&lb.value.trim())||'På / Av'),icon:'power',type:'moodtoggle',moodOn:on.value,moodOff:off.value,confirm:!!(cf&&cf.checked)};
  if(rf&&rf.value){btn.refDev=rf.value;btn.refCap='onoff';}
  CONFIG.BUTTONS[i]=btn;
  saveButtons();renderControls();openBtnEdit(i);}
function beAdd(i){if(!Array.isArray(CONFIG.BUTTONS))CONFIG.BUTTONS=[];CONFIG.BUTTONS.push({label:'Ny knapp',icon:'lightbulb',type:'toggle'});saveButtons();renderControls();openBtnEdit(CONFIG.BUTTONS.length-1);}
function beRemove(i){if(!Array.isArray(CONFIG.BUTTONS))return;CONFIG.BUTTONS.splice(i,1);saveButtons();renderControls();if(CONFIG.BUTTONS.length){openBtnEdit(Math.max(0,Math.min(i,CONFIG.BUTTONS.length-1)));}else{closeDetail();}}
function mergeGrp(dst,src,def){['chip','tile'].forEach(k=>{dst[k]=Object.assign({},def[k],(src&&src[k])||{});});
  if(src&&!src.chip&&src.energy)dst.chip=Object.assign({},def.chip,src.energy);}
function baseCfg(){const d=JSON.parse(JSON.stringify(CFG_DEF));try{const b=localStorage.getItem('cfg_base_v1');if(b){const p=JSON.parse(b);Object.assign(d,p);mergeGrp(d,p,CFG_DEF);}}catch(e){}return d;}
function loadCfg(){const base=baseCfg();let need=false;const bg={chip:base.chip,tile:base.tile};
  try{const s=localStorage.getItem('cfg_v1');if(s){const p=JSON.parse(s);need=(p.sharpV!==2&&p.glowsharp!=null);CFG=Object.assign(base,p);
    const psrc={chip:p.chip||p.energy,tile:p.tile};
    ['chip','tile'].forEach(k=>{CFG[k]=Object.assign({},CFG_DEF[k],bg[k]||{},psrc[k]||{});});
  }else{CFG=base;}}catch(e){CFG=base;}
  delete CFG.energy;delete CFG.weather;
  if(need){CFG.glowsharp=Math.max(0,Math.min(1,0.5*(1+(CFG.glowsharp==null?0.5:CFG.glowsharp))));CFG.sharpV=2;saveCfg();}
  else CFG.sharpV=2;
  curScenario=CFG.scenario||0;}
function saveCfg(){try{localStorage.setItem('cfg_v1',JSON.stringify(CFG));}catch(e){}}
function cfgSaveDefault(){try{localStorage.setItem('cfg_base_v1',JSON.stringify(CFG));}catch(e){}const b=$('cfg-savedmsg');if(b)b.textContent='Sparat som standard ✓';}
function scl(v){return (1+(v||0)*0.06).toFixed(3);}
/* Räknar ut FÄRDIGA pixlar i stället för att lämna en multiplikation till CSS.
   calc(var(--bas) * var(--faktor)) är giltig CSS men beror på att båda
   variablerna är satta och tolkas rätt i varje läge — och när något av det
   fallerar händer ingenting alls, tyst. Läs basmåttet ur den beräknade stilen
   och sätt resultatet direkt; då finns inget att missförstå. */
function applyGrpVars(el,pre,grp){
  if(!el||!el.style)return;
  grp={};   /* v727: inga storleksinställningar – alltid grundmåtten */
  ['ic','v','name','desc'].forEach(function(k){
    el.style.setProperty(pre+'-'+k,scl(grp[k]));
  });
  /* Basmåttet läses ur en RIKTIG ruta, inte ur rutnätet. Basen sätts av
     mediefrågor på body (mobil, kiosk), och läser man för tidigt — innan
     lägesklassen hunnit sättas — fryser man fel värde. En ruta som redan finns
     i dokumentet ger samma värde som CSS faktiskt använder.

     Nolla först: annars mäter vi vårt eget förra resultat. */
  try{
    ['ic','v','name','desc'].forEach(function(k){el.style.removeProperty(pre+'-'+k+'-px');});
    var prov=el.querySelector?el.querySelector('.stat'):null;
    if(!prov||typeof getComputedStyle!=='function')return;
    var cs=getComputedStyle(prov);
    [['ic','-ic-b'],['v','-v-b'],['name','-name-b'],['desc','-desc-b']].forEach(function(par){
      var bas=parseFloat(cs.getPropertyValue(pre+par[1]));
      if(!isFinite(bas)||bas<=0)return;
      var f=parseFloat(scl(grp[par[0]]))||1;
      el.style.setProperty(pre+'-'+par[0]+'-px',(bas*f).toFixed(2)+'px');
    });
  }catch(e){}
}

/* Räkna om måtten. Anropas efter att rutorna ritats och efter lägesbyte —
   basvärdet beror på body-klassen och kan inte läsas innan den är satt. */
function storlekOm(){
  try{
    applyGrpVars($('stats-energy'),'--tl',CFG.chip);
    applyGrpVars($('stats-weather'),'--tl',CFG.chip);
    applyGrpVars($('stats-flode'),'--tl',CFG.tile);
  }catch(e){}}

function applyCfg(){
  /* Sätts på body, inte på elementen: de ritas om vid varje uppdatering och en
     inline-stil där skulle försvinna var femtonde sekund. */
  try{
    document.body.style.setProperty('--repgrow','1');
    document.body.style.setProperty('--knhojd',String(knHojd()));
    document.body.style.setProperty('--knmarg',String(knMarg()));
    document.body.style.setProperty('--avd-pad',avdPad()+'px');
    document.body.style.setProperty('--kntext',String(knMatt('t')));
    document.body.style.setProperty('--knikon',String(knMatt('i')));
  }catch(e){}
  try{document.body.style.setProperty('--ewh','1');}catch(e){}const r=document.body;if(!r||!r.style)return;
  try{applyMobGap();}catch(e){}
  const ee=$('stats-energy'),we=$('stats-weather'),te=$('stats-flode');
  applyGrpVars(ee,'--tl');if(ee&&ee.style)ee.style.setProperty('--tl-gap','11px');
  applyGrpVars(we,'--tl');if(we&&we.style)we.style.setProperty('--tl-gap','11px');
  applyGrpVars(te,'--tl');if(te&&te.style)te.style.setProperty('--tl-gap','14px');
  r.style.setProperty('--glowmul',CFG.glowmul);r.style.setProperty('--glowsharp',(CFG.glowsharp==null?0.5:CFG.glowsharp));
  {const pb=$('pband');if(pb&&pb.classList){pb.classList.toggle('hide-spot',CFG.showspot===false);
     /* NOLL = NEUTRALT. Formlerna hade förskjutningar (+5, +8, +10) från när
        bandet såg annorlunda ut, så steg 0 gav faktorerna 1,4, 1,8 och 2,2 —
        aldrig samma storlek som soluppgångsremsan. Nu är 0 exakt 1,0, och
        reglagen finjusterar därifrån. */
     var sp=szRead('spot');if(pb.style){
       pb.style.setProperty('--spnum',(1+(sp.num||0)*0.08).toFixed(3));
       pb.style.setProperty('--spslide',(1+(sp.slide||0)*0.10).toFixed(3));
       pb.style.setProperty('--spscale',(1+(sp.scale||0)*0.12).toFixed(3));
       pb.style.setProperty('--spbox',(1+(sp.box||0)*0.10).toFixed(3));
       pb.style.setProperty('--spend',(1+(sp.end||0)*0.10).toFixed(3));}
     var eos=[$('lo'),$('hi')];for(var _i=0;_i<eos.length;_i++){if(eos[_i]&&eos[_i].classList)eos[_i].classList.toggle('on-white',!!sp.endWhite);}}
   {const kb=$('ksband');if(kb){kb.classList.toggle('hide-spot',CFG.showspot===false);var k=szRead('ks');if(kb.style){kb.style.setProperty('--ksnum',(1+((k.num||0)+5)*0.08).toFixed(3));kb.style.setProperty('--ksslide',(1+((k.slide||0)+8)*0.10).toFixed(3));kb.style.setProperty('--ksscale',(1+((k.scale||0)+10)*0.12).toFixed(3));kb.style.setProperty('--ksbox',(1+((k.box||0))*0.10).toFixed(3));}}}}
  if(CFG.theme==='light'||CFG.theme==='dark'){CONFIG.THEME=CFG.theme;const root=document.documentElement;if(root&&root.setAttribute){root.setAttribute('data-theme',CFG.theme);}curTheme=CFG.theme;setIcon('theme-ic',CFG.theme==='light'?'sun':'moon');try{syncThemeColor();}catch(e){}}
  else CONFIG.THEME='auto';}
function applyScenario(n){n=n||0;curScenario=n;CFG.scenario=n;
  const base=JSON.parse(JSON.stringify(DEMO));const patch=SCENARIOS[n]&&SCENARIOS[n].patch;
  demoOvApply(base);
  if(patch)for(const id in patch){if(!base[id]){base[id]={name:id,class:'other',capabilitiesObj:{}};}for(const c in patch[id]){if(!base[id].capabilitiesObj[c])base[id].capabilitiesObj[c]={value:null};base[id].capabilitiesObj[c].value=patch[id][c];}}
  DATA=base;return DATA;}

/* config-meny UI */
/* SAMMA uppmärkning som på startsidan. Förhandsvisningen använde .en-chip, en
   äldre form med ikonen ovanför texten — sedan energi- och väderrutorna flyttade
   in i panelerna är de vanliga .stat med ikonen till vänster. */
function stepRow(lbl,id,val,fn){
  return '<div class="cfg-row"><span class="cfg-row-l">'+lbl+'</span><div class="cfg-step"><button class="cfg-pm" onclick="'+fn+'(-1)">−</button><span class="cfg-num" id="'+id+'">'+val+'</span><button class="cfg-pm" onclick="'+fn+'(1)">+</button></div></div>';}
/* En rad i en installningsmeny. Samma kort som roten anvander - de har fyra oppnar
   hela undersidor och ska inte se ut som sma val-pillar bland tema-knapparna. */
function cfgMi(fn,ic,titel,under){
  return '<button class="cfg-mi" onclick="'+fn+'">'
    +'<span class="cfg-mi-ic">'+icon(ic)+'</span>'
    +'<span class="cfg-mi-t"><b>'+esc(titel)+'</b><em>'+esc(under)+'</em></span>'
    +'<span class="cfg-mi-a">'+icon('arrow-left')+'</span></button>';}
function cfgGo(sec){_cfgSec=sec||null;openConfig();}
function cfgBack(){return '<div class="cfg-back-row"><button class="te-alt" onclick="cfgGo(null)">‹ Tillbaka</button></div>';}
function krcOpRow(){
  return '<div class="cfg-row"><span class="cfg-row-l">Färgstyrka i stapeln</span><div class="cfg-step">'
    +'<button class="cfg-pm" onclick="cfgKrcOp(-1)">−</button>'
    +'<span class="cfg-num" id="cfgnum-krcop">'+Math.round(krcOpac()*100)+' %</span>'
    +'<button class="cfg-pm" onclick="cfgKrcOp(1)">+</button></div></div>';}
function cfgKrcOp(d){
  CFG.krcOp=Math.max(.1,Math.min(.8,Math.round((krcOpac()+d*0.04)*100)/100));
  saveCfg();var n=$('cfgnum-krcop');if(n)n.textContent=Math.round(krcOpac()*100)+' %';
  try{renderTiles('flode');}catch(e){}}
function openConfig(){
  const demo=(SOURCE==='demo-data');
  let h='<div class="cfg">';
  if(_cfgSec==='utseende'){
    h+=cfgBack();
  h+='<div class="cfg-sec">Layout</div><div class="cfg-menu">';
  h+=cfgMi('openSecMove(\'energy\')','arrow-fat-up','Ordna avsnitt','Flytta upp/ner och dölj');
  h+=cfgMi('openEnheter()','desktop','Enheter','Vilka som använder dashboarden, och vem de tillhör');
  h+=dRow('Huvudsäkring','<span class="dbtn-row" style="justify-content:flex-end">'
    +'<button class="dbtn" onclick="sakringStep(-1)">–</button>'
    +'<b id="sakr-v" style="min-width:44px;display:inline-block;text-align:center">'+fasSakring()+' A</b>'
    +'<button class="dbtn" onclick="sakringStep(1)">+</button></span>');
  h+='</div>';
  /* Husbilden högst upp på startsidan (index2): hur mycket fönstren lyser. */
  h+='<div class="cfg-sec">Husbilden</div>';
  h+=stepRow('Ljus från fönstren','cfgnum-husfon',Math.round(husFonsterStyrka()*100)+' %','cfgHusFonster');
  h+='<div class="cfg-hint">Skenet från fönster och glasdörrar i nattbilden. 100 % är fullt, över 100 % lyser de starkare och längre ut.</div>';
  h+='<div class="cfg-sec">Köpt/sålt-rutan</div>';
  h+=krcOpRow();
  h+='</div>';
  }else if(_cfgSec==='glow'){
    /* v195: gloden lag utspridd. "Glow (alla rutor)" och en INBADDAD kalibrering
       renderades i Utseende, samtidigt som ett kort oppnade openCalib() med samma
       sak - kalibreringen fanns alltsa pa tva stallen och halva den utanfor sin
       egen undermeny. Nu ligger allt som ror gloden har. */
    h+=cfgBack();
  h+='<div class="cfg-sec">Styrka på alla rutor</div>';
  h+=stepRow('Styrka','cfgnum-glow',(function(){const D=Math.round((CFG.glowmul-1)*100);return (D>0?'+':'')+D+'%';})(),'cfgGlow');
  h+=stepRow('Skärpa','cfgnum-sharp',Math.round((CFG.glowsharp==null?.75:CFG.glowsharp)*100)+'%','cfgSharp');
      h+='<div class="cfg-sec">Kalibrering</div>';
    h+='<div class="cfg-hint" style="margin-top:0">Glöden tänds när ett värde sticker ut mot vad som är normalt för dig. Vad som räknas som normalt lär sig dashboarden av din egen historik – här ser du var gränserna ligger just nu.</div>';
    h+=learnInfoHTML();
    h+='<div class="cfg-menu" style="margin-top:10px">';
    h+=cfgMi('openCalib()','gauge','Alla rutor i detalj','Följ inlärningen värde för värde');
    h+='</div>';
  }else if(_cfgSec==='skarm'){
    h+=cfgBack();
    h+='<div class="cfg-sec">Skärm & läge</div>';
    h+=stepRow('Nattdämpning','cfgnum-night',(CFG.night||0)+'%','cfgNight');
  h+='<div class="cfg-row"><span class="cfg-row-l">Nattklocka'+(ncAllowed()?'':' <span style="color:var(--faint);font-weight:600">· endast väggplattan</span>')+'</span><select class="cfg-sel" onchange="cfgNclock(this.value)"><option value="off"'+(CFG.nclock!=='on'?' selected':'')+'>Av</option><option value="on"'+(CFG.nclock==='on'?' selected':'')+'>På (natt)</option></select></div>';
  h+='<div class="cfg-row"><span class="cfg-row-l">Skärmsläckare vid solnedgång'+(ncAllowed()?'':' <span style="color:var(--faint);font-weight:600">· endast väggplattan</span>')+'</span><div class="cfg-step"><button class="cfg-pm" onclick="cfgNclockOff(-1)">−</button><span class="cfg-num" id="cfgnum-nclockoff">'+nclockOffLabel()+'</span><button class="cfg-pm" onclick="cfgNclockOff(1)">+</button></div></div>';
  h+='<div class="cfg-row"><span class="cfg-row-l">Spotpris-ruta</span><select class="cfg-sel" onchange="cfgSpot(this.value)"><option value="on"'+(CFG.showspot!==false?' selected':'')+'>Visa</option><option value="off"'+(CFG.showspot===false?' selected':'')+'>Dölj</option></select></div>';
  h+='<div class="cfg-row"><span class="cfg-row-l">Kioskläge</span><select class="cfg-sel" onchange="cfgKiosk(this.value)">'+[['auto','Auto'],['on','Alltid på'],['off','Av']].map(o=>'<option value="'+o[0]+'"'+((CONFIG.KIOSK||'auto')===o[0]?' selected':'')+'>'+o[1]+'</option>').join('')+'</select></div>';
  h+='<div class="cfg-sec">Helskärm & app</div><div class="cfg-hint" style="margin-top:0">Dölj Chromes adressfält. Helskärm fungerar direkt; "starta i helskärm" begär det vid första tryck efter start.</div>';
  h+='<div class="cfg-row"><span class="cfg-row-l">Helskärm</span><button class="te-use" id="fs-btn" onclick="toggleFullscreen()">'+(isFullscreen()?'Avsluta helskärm':'Helskärm nu')+'</button></div>';
  h+='<div class="cfg-row"><span class="cfg-row-l">Starta i helskärm</span><select class="cfg-sel" onchange="cfgAutoFull(this.value)"><option value="off"'+(CFG.autoFull?'':' selected')+'>Av</option><option value="on"'+(CFG.autoFull?' selected':'')+'>På</option></select></div>';
  h+='<div class="cfg-row"><span class="cfg-row-l">Sida vid håll på live</span>'
    +'<input class="cfg-inp" style="width:150px;font-size:11px;text-align:left" type="text" autocomplete="off" '
    +'value="'+esc(extUrl())+'" placeholder="'+esc(EXT_URL_DEF)+'" onchange="cfgExtUrl(this.value)"></div>';
  h+='<div class="cfg-hint" style="margin-top:6px">Öppnas i en ram ovanpå dashboarden när live-indikatorn hålls inne i plattläget. Tomt fält återställer.</div>';
  /* Anslutningen: vilken vag som anvands just nu, och mojlighet att byta. */
  {
    var _c=credGet();
    var _via=BASE?(BASE.indexOf('connect.athom.com')>0?'molnet':'lokalt nät'):'ingen';
    h+='<div class="cfg-row"><span class="cfg-row-l">Anslutning</span>'
      +'<button class="te-use" onclick="setupVisa()">'+(_c.token?'Ändra':'Anslut')+'</button></div>';
    h+='<div class="cfg-hint" style="margin-top:6px">'
      +(_c.token
        ? ('Ansluten via <b>'+esc(_via)+'</b>'+(BASE?(' — '+esc(BASE.replace(/^https?:\/\//,''))):'')+'. '
           +'Homey-ID <code>'+esc(_c.homeyId||'–')+'</code>. Token sparad i den här webbläsaren, '
           +'inte i sidans fil.')
        : 'Inga uppgifter sparade. Tryck Anslut.')
      +'</div>';
    if(_c.token)h+='<div class="cfg-row"><span class="cfg-row-l">Glöm uppgifter</span>'
      +'<button class="te-alt" onclick="if(confirm(\'Ta bort token och Homey-ID ur den här webbläsaren?\')){credRensa();location.reload();}">Ta bort</button></div>';
  }
  h+='<div class="cfg-row"><span class="cfg-row-l">Installera som app</span>'
    +'<button class="te-use" id="install-btn" onclick="installApp()">'
    +(pwaStandalone()?'Redan installerad':(_deferredInstall?'Installera':'Uppdatera status'))+'</button></div>';
  h+='<div class="cfg-hint" style="margin-top:6px;line-height:1.65">'+pwaRows()+'</div>';
  }else if(_cfgSec==='energi'){
    h+=cfgBack();
  h+='<div class="cfg-sec">Prisdata</div>';
  h+='<div class="cfg-hint" style="margin-top:0">'+esc(monTibText())+' '+esc(monDiagText())+'</div>';
  h+='<div class="cfg-btns"><button class="cfg-opt" onclick="tibKrFetch();openConfig()">Läs Tibber-variabeln</button>'
    +'<button class="cfg-opt" onclick="monBackfillNu();openConfig()">Hämta ur Insights igen</button></div>';
  /* Solprognosen låg förut under Utseende, bland storleks- och layoutval —
     ingen letar efter en exportfunktion där. Hit hör den: det är energidata. */
  h+='<div class="cfg-sec">Solprognos</div>';
  h+=cfgMi('openProgLogg()','sun','Solprognos · träffsäkerhet','Hur mycket prognosen brukar bomma, och export per dygn och per timme');
  /* v697: uppföljning av laddregelns förslag, bredvid solprognosens. */
  h+=cfgMi('openDetail(\'regellogg\')','battery-charging','Laddregelns förslag','Förslagen mot pris och batteri – idag och tre dygn bakåt');
  h+='<div class="cfg-sec">Energimätning</div>';
  h+=stepRow('Batteri kWh','cfgnum-batt',((CFG.battkwh||10))+'','cfgBatt');
  h+='<div class="cfg-row"><span class="cfg-row-l">Köpt i år (kWh)</span><div class="cfg-step"><input id="cfg-boughtyear" class="cfg-inp" type="number" inputmode="numeric" value="'+(boughtYear()!=null?Math.round(boughtYear()):'')+'"><button class="cfg-pm wide" onclick="calibBoughtYear()">Kalibrera</button></div></div>';
  h+='<div class="cfg-hint" id="cfg-by-status">Ange den verkliga siffran för köpt el hittills i år, så justeras baslinjen mot Homeys totalmätare.</div>';
  h+='<div class="cfg-hint" style="font-weight:700;color:var(--ink);margin-top:14px">Historik – tidigare år (kWh)</div>';
  h+='<div class="cfg-hint">Total förbrukning och solel (kWh) per år. Visas i \'Köpt & förbrukning\'. Framtida år lagras automatiskt vid årsskiftet.</div>';
  h+='<div id="yh-list">'+yhListHtml()+'</div>';

  }else if(_cfgSec==='homey'){
    h+=cfgBack();
  h+='<div class="cfg-sec">Synk via Homey</div>';
  h+='<div class="cfg-row"><span class="cfg-row-l">Hämta vid start</span><select class="cfg-sel" onchange="cfgSync(this.value)"><option value="on"'+(CFG.sync!==false?' selected':'')+'>På</option><option value="off"'+(CFG.sync===false?' selected':'')+'>Av</option></select></div>';
  h+='<div class="cfg-row"><span class="cfg-row-l">Dela layout mellan enheter</span><select class="cfg-sel" onchange="cfgShare(this.value)"><option value="on"'+(CFG.shareLayout!==false?' selected':'')+'>På</option><option value="off"'+(CFG.shareLayout===false?' selected':'')+'>Av</option></select></div>';
  h+='<div class="cfg-hint" style="margin-top:0">På: telefon och platta delar samma sparade layout (ändra på en, spara, hämta på den andra). Av: varje enhet har egen layout.</div>';
  h+='<div class="cfg-btns synced">'
    +'<button class="cfg-opt" onclick="doSaveSync()">Spara till Homey nu</button>'
    +'<button class="cfg-opt" onclick="doFetchSync()">Hämta från Homey nu</button></div>';
  h+='<div class="cfg-btns"><button class="cfg-opt" onclick="openVal()">Visa mina inställningar</button>'
    +'<button class="cfg-opt" onclick="openBackup()">Exportera / importera allt</button></div>';
  h+='<div class="cfg-hint" id="sync-status">'+esc(syncStatusText())+'</div>';
  h+='<div class="cfg-row"><span class="cfg-row-l">Felsök synk</span><span class="dv"><button class="te-use" onclick="syncDiag()">Visa slots</button>'
    +'<button class="te-alt" onclick="kopieraFalt(\'sync-diag\',this)">Kopiera</button></span></div>';
  h+='<pre class="cfg-diag" id="sync-diag">Visar vilken variabel varje enhet skriver till och när den senast uppdaterades.</pre>';
  h+='<div class="cfg-row"><span class="cfg-row-l">Vem skrev senast</span><span class="dv"><button class="te-use" onclick="loggVisa()">Visa skrivlogg</button>'
    +'<button class="te-alt" onclick="kopieraFalt(\'sync-logg\',this)">Kopiera</button></span></div>';
  h+='<pre class="cfg-diag" id="sync-logg">Varje skrivning mot Homey antecknas här: enhet, tidpunkt, antal nycklar och om det var ett tryck eller automatiken.</pre>';
  h+='<div class="cfg-hint" style="margin-top:0">Ändrar du en knapp eller layouten skickas det till Homey automatiskt efter några sekunder. Andra enheter hämtar in det vid nästa uppdatering.</div>';
    h+='<div class="cfg-sec">Homey-variabler</div>';
  h+='<div class="cfg-row"><span class="cfg-row-l">Årsdata · Homey-variabel</span><input class="cfg-inp" style="width:150px;font-size:12px;text-align:left" type="text" autocomplete="off" value="'+esc(CFG.yearVar!=null?CFG.yearVar:'energi_arsdata')+'" placeholder="t.ex. energi_arsdata" onchange="cfgYearVar(this.value)"></div>';
  h+='<div class="cfg-row"><span class="cfg-row-l">Lägg till / uppdatera</span><div class="cfg-step"><input id="yh-year" class="cfg-inp" style="width:56px" type="number" inputmode="numeric" placeholder="år"><input id="yh-total" class="cfg-inp" style="width:72px" type="number" inputmode="numeric" placeholder="total"><input id="yh-sol" class="cfg-inp" style="width:62px" type="number" inputmode="numeric" placeholder="sol"><button class="cfg-pm wide" onclick="yhSave()">Spara</button></div></div>';
  }else if(_cfgSec==='system'){
    h+=cfgBack();
    h+='<div class="cfg-sec">System</div>';
    h+='<div class="cfg-row"><span class="cfg-row-l">Version</span><span class="cfg-num">'+APP_VERSION+'</span></div>';
    h+='<div class="cfg-row"><span class="cfg-row-l">Läge</span><span class="cfg-num">'
      +(document.body.classList.contains('kiosk')?'platta':'mobil')+'</span></div>';
    h+='<div class="cfg-row"><span class="cfg-row-l">Enheter</span><span class="cfg-num">'
      +Object.keys(DATA||{}).length+'</span></div>';
    h+='<div class="cfg-row"><span class="cfg-row-l">Offlinestöd</span><span class="cfg-num">'
      +esc(swLage())+'</span></div>';
    /* Push-raden. Läget hämtas asynkront och fylls i när svaret kommer — att
       vänta på det hade fördröjt hela inställningssidan. */
    /* Huvudenhet. Den som är vald skriver till Homey; övriga läser bara. */
    var hv=huvudGet();
    h+='<div class="cfg-row"><span class="cfg-row-l">Sparar till Homey</span>'
      +'<span class="cfg-num">'+esc(hv?(arHuvud()?'den här enheten':(hv.namn||'annan enhet')):'alla enheter')
      +'</span></div>';
    h+='<div class="cfg-row"><span class="cfg-row-l">Gäller</span>'
      +'<span class="cfg-num">'+(secKlass()==='platta'?'plattor':'telefoner')+'</span></div>';
    h+='<div class="cfg-btns" style="margin-top:6px">'
      +'<button class="cfg-opt'+(hv&&arHuvud()?' on':'')+'" onclick="huvudValj(true)">Gör till huvudenhet</button>'
      +'<button class="cfg-opt'+(!huvudFinns()?' on':'')+'" onclick="huvudValj(false)">Alla får spara</button>'
      +'</div>';
    h+='<div class="cfg-hint" id="huvud-kvitto" style="margin-top:4px;min-height:15px"></div>';
    h+='<div class="cfg-hint" id="huvud-svar" style="margin-top:6px;color:var(--ok)"></div>';
    h+='<div class="cfg-hint" style="margin-top:6px">Utan huvudenhet skriver varje '
      +'enhet en gång per dygn, och den som skriver sist vinner — en enhet med '
      +'gamla inställningar kan då skriva tillbaka dem över dina. Välj den enhet '
      +'du ställer in från; övriga hämtar därifrån i stället.<br><br>'
      +'<b>Valet gäller per enhetstyp.</b> Höjder och storlekar är olika för '
      +'plattor och telefoner, så plattorna behöver en egen huvudenhet — annars '
      +'skriver telefonen aldrig plattans mått. Glow, trendpilar och rutornas '
      +'innehåll är gemensamma och följer med ändå.</div>';
    h+='<div class="cfg-row"><span class="cfg-row-l">Notiser till telefonen</span>'
      +'<span class="cfg-num" id="push-lage">'+esc(_pushLage)+'</span></div>';
    h+='<div class="cfg-btns" id="push-knappar" style="margin-top:6px">'
      +'<button class="cfg-opt" onclick="pushPa().then(cfgPushRita)">Slå på</button>'
      +'<button class="cfg-opt" onclick="pushAv().then(cfgPushRita)">Stäng av</button>'
      +'<button class="cfg-opt" onclick="pushProv().then(cfgPushRita)">Prov</button>'
      +'</div>';
    h+='<div class="cfg-row"><span class="cfg-row-l">Dagsnotis morgon</span>'
      +'<input class="cfg-inp" id="dag-m" type="time" value="'+esc(dagTid('morgon'))+'"'
      +' onchange="dagTidSatt()"></div>';
    h+='<div class="cfg-row"><span class="cfg-row-l">Dagsnotis kväll</span>'
      +'<input class="cfg-inp" id="dag-k" type="time" value="'+esc(dagTid('kvall'))+'"'
      +' onchange="dagTidSatt()"></div>';
    h+='<div class="cfg-btns" style="margin-top:6px">'
      +'<button class="cfg-opt" onclick="dagProv(false)">Skriv morgonnotis nu</button>'
      +'<button class="cfg-opt" onclick="dagProv(true)">Skriv kvällsnotis nu</button>'
      +'<button class="cfg-opt" onclick="dagSpar()">Visa senaste kontrollen</button>'
      +'</div>';
    h+='<div class="cfg-hint" id="dag-spar" style="margin-top:6px;white-space:pre-line"></div>';
    h+='<div class="cfg-hint" style="margin-top:6px">Morgon- och kvällsnotisen hamnar i '
      +'notislistan. Sophämtningen påminns kvällen innan och samma morgon.</div>';
    h+='<div class="cfg-hint" style="margin-top:6px">Provnotisen kastas om den inte '
      +'kommit fram inom två minuter, så en som dyker upp långt senare är alltid '
      +'ett tecken på något annat. Dagsnotiser kastas efter fyra timmar — en '
      +'morgonrapport klockan sex på kvällen är sämre än ingen alls.</div>';
    h+='<div class="cfg-hint" style="margin-top:6px">Chrome visar notisen även med '
      +'skärmen släckt, och trycket öppnar sammanfattningen direkt. Kräver att '
      +'Homey-appen 2.33.0 eller senare är installerad. Väggplattan prenumererar inte.</div>';
    setTimeout(cfgPushRita,60);
    if(swLage()!=='aktiv')h+='<div class="cfg-hint" style="margin-top:6px">'
      +'Utan offlinestöd måste sidan hämtas från nätet varje gång. Kräver att '
      +'<code>sw.js</code> ligger bredvid <code>index.html</code>, och https.</div>';
    h+='<div class="cfg-row"><span class="cfg-row-l">Uppdateringar</span><span class="cfg-num">var '
      +(CONFIG.REFRESH_SECONDS||15)+' s</span></div>';
    h+='<div class="cfg-hint" style="margin-top:6px">Ikoner: Phosphor Icons (MIT).</div>';

    h+='<div class="cfg-sec" style="margin-top:16px">Rotation</div>';
    h+='<div class="cfg-row"><span class="cfg-row-l">Lås till stående</span><div class="cfg-btns">'
      +'<button class="cfg-opt'+(CFG.lasPortratt!==false?' on':'')+'" onclick="cfgLas(1)">På</button>'
      +'<button class="cfg-opt'+(CFG.lasPortratt===false?' on':'')+'" onclick="cfgLas(0)">Av</button>'
      +'</div></div>';
    h+='<div class="cfg-hint" style="margin-top:6px">Telefonens egen rotationslåsning gäller inte '
      +'installerade webbappar — de följer manifestets inställning. Med detta på ligger sidan kvar '
      +'i stående när du vrider telefonen.</div>';

    h+='<div class="cfg-sec" style="margin-top:16px">Återställ</div>';
    h+='<div class="cfg-row"><span class="cfg-row-l">Alla inställningar</span>'
      +'<button class="te-alt" onclick="cfgReset()">Återställ</button></div>';
    h+='<div class="cfg-hint" style="margin-top:6px">Återställer allt till dashboardens standardläge. '
      +'Anslutningen till Homey påverkas inte.</div>';

  }else if(_cfgSec==='styrning'){
    h+=cfgBack();
    h+=cfgStyrningHTML();
  }else if(_cfgSec==='uppd'){
    h+=cfgBack();
    h+='<div class="cfg-sec">Uppdatering</div>';
  h+='<div class="cfg-row"><span class="cfg-row-l">Uppdatering</span><select class="cfg-sel" onchange="cfgInterval(this.value)">'+[15,30,60,120].map(s=>'<option value="'+s+'"'+((CONFIG.REFRESH_SECONDS||15)===s?' selected':'')+'>'+s+' s</option>').join('')+'</select></div>';
  /* v691: På nu-raden och knapparna i rutornas popuper. Av = knappavsnittet
     som förut. */
  h+='<div class="cfg-row"><span class="cfg-row-l">På nu-raden (knappar i rutornas popuper)</span><select class="cfg-sel" onchange="cfgPaNu(this.value)"><option value="on"'+(CFG.paNu!==false?' selected':'')+'>På</option><option value="off"'+(CFG.paNu===false?' selected':'')+'>Av – knappavsnittet</option></select></div>';
  /* v734: vädret på startsidan – i energirubriken eller som eget kort. */
  h+='<div class="cfg-row"><span class="cfg-row-l">Vädret på startsidan</span><select class="cfg-sel" onchange="cfgWxRubrik(this.value)"><option value="on"'+(wxRubrik()?' selected':'')+'>I rubriken</option><option value="off"'+(!wxRubrik()?' selected':'')+'>Eget kort</option></select></div>';
  h+='<div class="cfg-row"><span class="cfg-row-l">Auto-uppdatera vid ny fil</span><select class="cfg-sel" onchange="cfgAutoReload(this.value)"><option value="on"'+(CFG.autoreload!==false?' selected':'')+'>På</option><option value="off"'+(CFG.autoreload===false?' selected':'')+'>Av</option></select></div>';
  /* v195: Nattdampning, Batteri kWh och arshistoriken lag under "Uppdatering" - de
     hamnade dar av misstag nar menyn delades upp i v193. Flyttade till ratt sidor. */
  }else{
  h+='<div class="cfg-sec">Tema</div><div class="cfg-btns">'+['light','dark','auto'].map(t=>'<button class="cfg-opt'+(CFG.theme===t?' on':'')+'" onclick="cfgTheme(\''+t+'\')">'+(t==='light'?'Ljust':t==='dark'?'Mörkt':'Auto')+'</button>').join('')+'</div>';
  h+='<div class="cfg-row"><span class="cfg-row-l">Visa som</span><div class="cfg-modeslot"><button class="'+(MOBILE?'on':'')+'" onclick="setViewMode(\'phone\')">Telefon</button><button class="'+(!MOBILE?'on':'')+'" onclick="setViewMode(\'tablet\')">Platta</button></div></div>';
  if(demo){h+='<div class="cfg-sec">Demo-scenario</div><div class="cfg-btns">'+SCENARIOS.map((s,i)=>'<button class="cfg-opt'+(curScenario===i?' on':'')+'" onclick="cfgScenario('+i+')">'+esc(s.name)+'</button>').join('')+'</div>';}
    h+='<div class="cfg-sec">Mer</div><div class="cfg-menu">';
    CFG_SECS.forEach(function(x){h+=cfgMi('cfgGo(\''+x[0]+'\')',x[2],x[1],x[3]);});
    h+='</div>';
  ;

  }
  const dlg=$('dlg');if(dlg&&dlg.classList){dlg.classList.add('wide');dlg.classList.add('edit');}
  setT('dlg-title','Inställningar');setIcon('dlg-ic','gauge');
  const bd=$('dlg-body');if(bd)bd.innerHTML=h;
  const bk=$('dlg-back');if(bk&&bk.classList)bk.classList.add('open');dlgTop();}
/* ENHETSSTYRNING (v776). Varje rum med något att styra, och dess enheter med
   en vippa: på = visas i rummet och i rumsrutans popup, av = döljs där. Valet
   ligger i CFG.rumDolj och följer med i synken. Alla enheter står med, även
   gruppmedlemmarna i RUM_DOLJ_DEV: rummets popup döljer dem redan, men
   rumsrutornas popuper (Föröver och Styrbord i Uterum) visar dem. */
function cfgStyrningHTML(){
  var dolj=(CFG&&CFG.rumDolj)||{},zon={};
  rDevs().forEach(function(d){
    if(!d||!d.zone)return;
    if(!(rHar(d,'onoff')||rArGardin(d)))return;
    (zon[d.zone]=zon[d.zone]||[]).push(d);});
  var zids=Object.keys(zon).sort(function(a,b){return cfgZonNamn(a).localeCompare(cfgZonNamn(b),'sv');});
  var antal=Object.keys(dolj).filter(function(k){return dolj[k];}).length;
  var h='<div class="cfg-hint" style="margin-top:0">Stäng av en enhet så syns den inte i rummet på startsidan, '
    +'i rummets popup eller i rumsrutans popup (till exempel Uterum), och rummets vippa rör den inte. '
    +'Enheten påverkas inte i Homey. '+(antal?(antal+' dold'+(antal===1?'':'a')+' just nu.'):'Inga dolda just nu.')+'</div>';
  if(!zids.length)h+='<div class="cfg-hint">Inga styrbara enheter hittades.</div>';
  zids.forEach(function(zid){
    var lista=zon[zid].sort(rSort);
    h+='<div class="cfg-sec">'+esc(cfgZonNamn(zid))+'</div>';
    h+=lista.map(function(d){
      var syns=!dolj[d.id];
      var ic=rArGardin(d)?'elevator':(rArLampa(d)?'lightbulb-filament':'plug');
      return '<div class="dv-row'+(syns?' on':'')+'">'
        +'<span class="dv-ic">'+icon(ic)+'</span>'
        +'<span class="dv-n">'+esc(rNamn(d))+'<small>'+(syns?'visas':'dold')+'</small></span>'
        +'<button class="dv-sw'+(syns?' on':'')+'" onclick="cfgRumDolj(\''+d.id+'\')" aria-label="visa eller dölj"><i></i></button></div>';
    }).join('');
  });
  return h;}
function cfgRumDolj(id){
  if(!CFG.rumDolj)CFG.rumDolj={};
  if(CFG.rumDolj[id])delete CFG.rumDolj[id];else CFG.rumDolj[id]=1;
  saveCfg();
  try{rumRita();}catch(e){}
  /* Behåll rullningen – listan är lång och sidan ritas om vid varje tryck. */
  var bd=$('dlg-body'),y=bd?bd.scrollTop:0;
  openConfig();
  bd=$('dlg-body');if(bd)bd.scrollTop=y;}
/* Rummets namn. Zonlistan kan saknas (demoläget) – då duger rumsrutornas egna. */
function cfgZonNamn(zid){
  var n=zoneName(zid);if(n)return n;
  try{for(var k in ZK)if(ZK[k].zon===zid)return ZK[k].lab;}catch(e){}
  return 'Okänt rum';}
function cfgTheme(t){CFG.theme=t;saveCfg();applyCfg();render();openConfig();}
function cfgScenario(n){applyScenario(n);saveCfg();render();openConfig();}
/* Centreringslägena. Sparas i CFG.tile så de följer med i synken, och gäller
   ALLA sex rutorna samtidigt — de ska se likadana ut. */

/* ALLTID --tl. Förhandsvisningen för energi- och väderrutor satte --ch-*, från
   när den använde .en-chip-uppmärkningen. Sedan den bytte till samma .stat som
   startsidan läser den --tl-* — variablerna hamnade alltså på fel namn och
   ingenting hände. Vilken uppsättning VÄRDEN som används styrs av CFG[section],
   inte av prefixet. */
function cfgSpot(v){CFG.showspot=(v!=='off');saveCfg();applyCfg();if(typeof setTimeout==='function')setTimeout(fitScreen,40);}

/* Läser av verkliga mått från en ruta på startsidan och från förhandsvisningen,
   så skillnaden syns direkt i menyn. */
function cfgGlow(d){let D=Math.round((CFG.glowmul-1)*100)+d*10;D=Math.max(-100,Math.min(200,D));CFG.glowmul=Math.max(0,Math.round((1+D/100)*100)/100);saveCfg();applyCfg();const n=$('cfgnum-glow');if(n)n.textContent=(D>0?'+':'')+D+'%';}
function cfgSharp(d){let s=(CFG.glowsharp==null?.75:CFG.glowsharp)+d*0.1;CFG.glowsharp=Math.max(0,Math.min(1,Math.round(s*100)/100));saveCfg();applyCfg();const n=$('cfgnum-sharp');if(n)n.textContent=Math.round(CFG.glowsharp*100)+'%';}
function cfgHusFonster(d){var v=Math.round(husFonsterStyrka()*100)+d*10;CFG.husFonster=Math.max(20,Math.min(150,v));saveCfg();
  try{husRita();}catch(e){}const n=$('cfgnum-husfon');if(n)n.textContent=CFG.husFonster+' %';}
function cfgNight(d){CFG.night=Math.max(0,Math.min(60,(CFG.night||0)+d*10));saveCfg();render();const n=$('cfgnum-night');if(n)n.textContent=CFG.night+'%';}
function cfgBatt(d){CFG.battkwh=Math.max(3,Math.min(40,(CFG.battkwh||10)+d));saveCfg();render();const n=$('cfgnum-batt');if(n)n.textContent=CFG.battkwh+'';}
function cfgNclock(v){CFG.nclock=(v==='on')?'on':'off';saveCfg();nightClockTick();}
function nclockOffLabel(){const m=(CFG&&CFG.nclockOffset)||0;if(m===0)return 'vid solnedgång';return (m>0?'+':'−')+Math.abs(m)+' min';}
function cfgNclockOff(d){CFG.nclockOffset=Math.max(-120,Math.min(120,((CFG.nclockOffset||0)+d*15)));saveCfg();const n=$('cfgnum-nclockoff');if(n)n.textContent=nclockOffLabel();render();}
function cfgInterval(val){CONFIG.REFRESH_SECONDS=parseInt(val,10)||15;if(_refreshTimer)clearInterval(_refreshTimer);_refreshTimer=setInterval(load,CONFIG.REFRESH_SECONDS*1000);}
function cfgWxRubrik(v){if(szMobile())CFG.wxRubrik=(v!=='off');else CFG.wxRubrikPl=(v!=='off');saveCfg();try{renderWeather();applySecOrder();}catch(e){}}
function cfgPaNu(v){CFG.paNu=(v!=='off');saveCfg();try{rutorPaNu();}catch(e){}try{renderTiles('flode');renderControls();render();}catch(e){}}
/* RUTORNA FÖR KNAPPARNAS POPUPER (v691), en gång. Med På nu-raden ligger
   knapparna i rutornas popuper — då måste rutorna finnas. Saknas Breveden,
   Diskmaskin eller Hem i rutnätet (och det finns knappar för dem) läggs de
   till sist, så länge rutnätet har plats (högst 12). */
function rutorPaNu(){
  /* v695: ersatt av fastaRutor — rutorna skrivs inte längre in i layouten. */
  return;
  try{
    if(!(CFG&&CFG.paNu))return;
    if(localStorage.getItem('panuRutor_v1'))return;
    /* Först när användarens egna knappar finns — inte standardknapparna. */
    if(!loadButtons())return;
    var t=gridTiles('flode').slice(),har=function(k){return t.some(function(x){return x&&x.type==='computed'&&x.key===k;});};
    var B=CONFIG.BUTTONS||[],behov=[];
    if(!har('breveden')&&B.some(function(b){return knappTill(b)==='breveden';}))behov.push('breveden');
    if(!har('dish')&&B.some(function(b){return knappTill(b)==='dish';}))behov.push('dish');
    if(!har('hem')&&B.some(function(b){return knappTill(b)==='hem';}))behov.push('hem');
    behov.forEach(function(k){if(t.length<12)t.push({type:'computed',key:k,glow:false});});
    if(behov.length){TILESTATE['flode']=t;try{localStorage.setItem(GRIDS.flode.store,JSON.stringify(t));}catch(e){}}
    localStorage.setItem('panuRutor_v1','1');
  }catch(e){}
}
function cfgAutoReload(v){CFG.autoreload=(v!=='off');saveCfg();if(CFG.autoreload&&_selfSig==null)checkForUpdate();}
function cfgKiosk(val){CONFIG.KIOSK=val;applyKiosk();}
function cfgTabPrev(v){CFG.tabPrev=(v!=='off');saveCfg();applyKiosk();if(typeof setTimeout==='function')setTimeout(fitScreen,60);}
function cfgYearVar(v){CFG.yearVar=(v||'').trim();saveCfg();_yearFetch=0;try{yearDataMaybe(true);}catch(e){}}
function yhListHtml(){const a=yearHistGet().slice().sort((x,y)=>y.year-x.year);if(!a.length)return '';let h='';a.forEach(function(y){h+='<div class="cfg-row"><span class="cfg-row-l">'+y.year+(y.manual?'':' · auto')+(y.partial?' · delår':'')+'</span><span style="color:var(--dim);font-size:12px">'+Math.round(y.total||0)+' kWh · sol '+Math.round(y.sol||0)+' <button class="cfg-pm" style="margin-left:6px" onclick="yhRemove('+y.year+')">×</button></span></div>';});return h;}
function yhSave(){const yv=$('yh-year'),tv=$('yh-total'),sv=$('yh-sol');if(!yv)return;const yr=parseInt(yv.value,10),tot=parseFloat(tv.value),sol=parseFloat(sv.value);if(!yr||isNaN(tot))return;yearHistUpsert(yr,tot,isNaN(sol)?0:sol,{manual:true});yv.value='';tv.value='';sv.value='';const l=$('yh-list');if(l)l.innerHTML=yhListHtml();}
function yhRemove(yr){yearHistRemove(yr);const l=$('yh-list');if(l)l.innerHTML=yhListHtml();}
function cfgReset(){CFG=baseCfg();if(CFG.sharpV!==2)CFG.sharpV=2;saveCfg();applyCfg();render();openConfig();}
function fmtBand(key,b){if(key==='price')return num(b.lo,2)+'–'+num(b.hi,2)+' kr';return W(b.lo)+'–'+W(b.hi);}
function learnInfoHTML(){const rows=[['solar','Sol'],['price','Pris'],['battflow','Batteriflöde'],['gridflow','Nätflöde']];let h='<div class="learn-info">';
  rows.forEach(r=>{const b=learnBand(r[0]);h+='<div class="learn-row"><span class="learn-l">'+r[1]+'</span><span class="learn-b">'+fmtBand(r[0],b)+'</span><span class="learn-n">'+(b.learned?('lärt · '+b.n+' mätv.'):('start · '+b.n+'/'+LEARN_MINN))+'</span></div>';});
  h+='</div><div class="learn-hint">Låg glow vid nedre värdet, full vid övre. Fönster ~3 veckor, uppdateras löpande.</div><div class="te-move"><button class="te-alt" onclick="learnReset()">Nollställ inlärning</button></div>';return h;}
function learnReset(){_learn={};_learnDirty=false;try{localStorage.removeItem('learn_v1');}catch(e){}openConfig();}

function nightOpacity(sc,h){const nRaw=(CFG&&CFG.night)||0;if(nRaw<=0)return 0;
  if(sc.sunrise==null||sc.sunset==null)return 0;
  return (h<sc.sunrise||h>=sc.sunset)?nRaw/100:0;}
function nightPeriod(sc,h){if(sc.sunrise==null||sc.sunset==null)return false;const off=((CFG&&CFG.nclockOffset)||0)/60;return (h<sc.sunrise)||(h>=sc.sunset+off);}
function ncWake(){_ncWakeUntil=Date.now()+60000;nightClockTick();}
/* Skarmslackaren galler BARA Samsung-vaggplattan. Pa telefon och andra enheter ar en
   helskarmsklocka som tander sig vid solnedgang bara i vagen. Egen funktion for att
   den ska ga att sta pa i test - IS_SAMSUNG_TABLET ar en const som satts av UA. */
function ncAllowed(){return IS_SAMSUNG_TABLET;}
function nightClockTick(){const el=$('nightclock');if(!el||!el.classList)return;
  const show=ncAllowed()&&(CFG&&CFG.nclock==='on')&&_isNight&&Date.now()>_ncWakeUntil;
  el.classList.toggle('on',show);
  if(show){const nw=new Date();setT('nc-time',hhmm(nw));
    setT('nc-date',nw.toLocaleDateString('sv-SE',{weekday:'long',day:'numeric',month:'long'}));
    const t=cap(DEV.outdoor,'measure_temperature');setT('nc-temp',t==null?'':num(t,1)+'° ute');
    const inf=$('nc-info');if(inf)inf.innerHTML=ncInfoHTML();}}
function ncInfoHTML(){const items=(_warnList||[]).filter(w=>w&&w[0]!=='okc');
  if(!items.length)return '<div class="nc-ok">'+icon('leaf')+' Inget att rapportera</div>';
  return items.slice(0,3).map(w=>'<div class="nc-warn '+(w[0]==='crit'?'crit':'warn')+'"><span class="nc-wi">'+icon(w[1]||'warning')+'</span><span>'+w[2]+(w[3]?' · '+w[3]:'')+'</span></div>').join('');}

function render(){
  try{yearDataMaybe();}catch(e){}
  try{paNuRita();}catch(e){}
  try{regelHamta(false);regelRadRita();}catch(e){}
  /* Har batteri- eller förbrukningsserien en lucka på över tio minuter fylls den
     från Insights (högst var femte minut). */
  try{if(histLucka('battpow')||histLucka('house'))seedFyll();}catch(e){}
  /* En öppen batteri-/elnätspopup och en öppen helskärmsgraf ritas om med
     färsk data. _grafOmRita pekar på rätt kroppsbyggare; helskärmen på sin. */
  /* Inte medan man drar i en graf: omritningen byter ut ytan under fingret och
     dragningen tappas (v685). Görs när fingret släpps. */
  if(_avlDrag&&_avlDrag.tagit){_avlVantar=true;}
  else{
  try{var _gb=$('dlg-back');if(_gb&&_gb.classList&&_gb.classList.contains('open')&&typeof _grafOmRita==='function')_grafOmRita();}catch(e){}
  try{if(_grafFull)grafFullRita();}catch(e){}
  }
  /* Hämtas från appen, som räknar. Cachad i fem minuter — en episod som varat
     i timmar behöver inte läsas var femtonde sekund. */
  try{if(SOURCE!=='demo-data')btHamta();}catch(e){}
  const now=new Date(),tz=-now.getTimezoneOffset(),sc=solar(now,CONFIG.LAT,CONFIG.LON,tz);
  const h=now.getHours()+now.getMinutes()/60;
  applyTheme(sc,h);
  (function(){const nd=$('nightdim');if(nd&&nd.style)nd.style.opacity=String(nightOpacity(sc,h));_isNight=nightPeriod(sc,h);nightClockTick();})();
  const C=PAL[curTheme]||PAL.dark;
  try{updateHouseHeroIcon();}catch(e){}
  try{applyEnergySize();}catch(e){}
  setT('sunrise',hm(sc.sunrise));setT('sunset',hm(sc.sunset));
  (function(){const sunH=(_timeActive&&_scrubH!=null)?_scrubH:h;
    const f=Math.max(0,Math.min(100,sunH/24*100));const ds=$('ds-sun');if(ds&&ds.style)ds.style.left=f+'%';
    const rt=$('ds-rise');if(rt&&rt.style&&sc.sunrise!=null){rt.style.left=Math.max(0,Math.min(100,sc.sunrise/24*100))+'%';rt.style.display='';}else if(rt&&rt.style)rt.style.display='none';
    const st=$('ds-set');if(st&&st.style&&sc.sunset!=null){st.style.left=Math.max(0,Math.min(100,sc.sunset/24*100))+'%';st.style.display='';}else if(st&&st.style)st.style.display='none';})();

  const price=elprisNow(),lo=elprisLo(),hi=elprisHi(),lvl=cap(DEV.tibber,'price_level')||cap(DEV.tibber,'measure_price_info_level');
  var priceAll=spotAllIn(price);
  setT('price',priceAll==null?'–':String(Math.round(priceAll*100)));
  /* Bara talet i ändarna. Enheten upprepas tre gånger i ett band som är fem
     centimeter brett — den framgår av sammanhanget. */
  {var loA=spotAllIn(lo),hiA=spotAllIn(hi);
   setT('lo',loA==null?'–':String(Math.round(loA*100)));
   setT('hi',hiA==null?'–':String(Math.round(hiA*100)));}
  {const pw=$('price-wrap');if(pw&&pw.style){
    /* Skalan sträcker sig mellan dygnets lägsta och dygnets högsta allt-inkl-pris (dynamiskt).
       Aktuellt pris (current price från Homey) placeras och färgas mellan dem.
       Faller tillbaka till de inställda grön/röd-gränserna bara om dygnsdata saknas. */
    var loAll=spotAllIn(lo), hiAll=spotAllIn(hi);
    var pBot=(loAll!=null?loAll:(CFG.priceGreen!=null?CFG.priceGreen:0.20));
    var pTop=(hiAll!=null?hiAll:(CFG.priceRed!=null?CFG.priceRed:0.80));
    let frac=0.5;
    if(priceAll!=null&&pTop>pBot)frac=Math.max(0,Math.min(1,(priceAll-pBot)/(pTop-pBot)));
/* Håll plattan innanför skalan. Den är bredare än den gamla punkten — vid 92 %
       hängde den ut över högsta-talet till höger. */
    pw.style.left=Math.max(12,Math.min(88,frac*100))+'%';
    /* NUVARANDE PRIS i punkten. Lägsta och högsta står utanför skalan; det som
       gäller just nu hör hemma där markören är. */
    var nuEl=$('sp-nu');
    /* Enheten står här men inte i ändarna: här finns plats, och det är talet man
       läser av. innerHTML för att kunna ge "öre" mindre stil. */
    if(nuEl)nuEl.innerHTML=(priceAll!=null
      ? (Math.round(priceAll*100)+'<span class="sp-enh">öre</span>')
      : '');
    /* Talen utanför tonas INTE längre bort när markören närmar sig — de står i
       egna kolumner utanför skalan och kan inte längre krocka med punkten. */
    {var loEl=$('lo'),hiEl=$('hi');
     if(loEl&&loEl.style)loEl.style.opacity='1';
     if(hiEl&&hiEl.style)hiEl.style.opacity='1';}
    const col=priceColor(frac);const b=$('price');if(b&&b.style)b.style.color=col;
    if(pw.style)pw.style.setProperty('--pc',col);
  }}
  renderKsBand();

  const solarW=cap(DEV.solar,'measure_power'),houseW=houseNowW(),pulseW=cap(DEV.pulse,'measure_power');
  const battW=cap(DEV.battery,'measure_power'),bs=cap(DEV.battery,'battery_charging_state'),exporting=pulseW!=null&&pulseW<0;
  renderEnergy();
  /* v777: huset ovanifrån – bara i index2.html, där #huspanel finns. */
  try{husRita();}catch(e){}
  renderControls();
  try{renderRooms();}catch(e){}

  /* Hysteres pa exporten: gar over till "Solöverskott" forst vid tydlig export
     (< -300 W) och tillbaka forst nar exporten upphort (> -50 W). Da slutar domen
     flaxa nar huset ligger och pendlar kring noll. */
  var expNow=(pulseW!=null&&pulseW<-300), expOff=(pulseW==null||pulseW>-50);
  if(_expState){ if(expOff)_expState=false; } else { if(expNow)_expState=true; }
  var expSust=_expState;
  /* Rakna fram malaget. */
  let vc='v-mid',vt='Normalt – kör vid behov',vs='Normalt',vi='gauge';
  if(expSust){vc='v-good';vt='Solöverskott – kör tunga laster nu';vs='Solöverskott';vi='leaf';}
  else if(lvl==='VERY_CHEAP'||lvl==='CHEAP'){vc='v-good';vt='Billig el – bra tid att förbruka';vs='Billigt';vi='leaf';}
  else if(lvl==='EXPENSIVE'||lvl==='VERY_EXPENSIVE'){vc='v-bad';vt='Dyrt – vänta med disk & laddning';vs='Dyrt';vi='warning';}
  /* Dampning: byt dom forst nar samma malage visats tva ganger i rad, sa en
     enstaka avvikande avlasning inte hinner sla igenom. */
  if(vt===_verdPend){ if(_verdShown!==vt){_verdShown=vt;_verdShort=vs;_verdC=vc;_verdI=vi;} }
  else { _verdPend=vt; if(_verdShown==null){_verdShown=vt;_verdShort=vs;_verdC=vc;_verdI=vi;} }
  const vd=$('verdict');if(vd)vd.className='verdict '+_verdC;
  /* På mobil bara ett ord – då får dom, självförsörjning och effekt plats på samma rad. */
  setT('verdict-text',szMobile()?(_verdShort||_verdShown):_verdShown);setIcon('verdict-ic',_verdI);

  renderTiles('flode');
  renderWeather();
  try{var _iv=$('view-insikter');if(_iv&&_iv.classList&&!_iv.classList.contains('hidden'))renderInsikter();}catch(e){}

  drawChart('chart-power',[series('solar',C.green,'Produktion',{area:true}),series('house',C.warm,'Förbrukning')],{yZero:true,fmtY:v=>Math.round(v)+' W'});
  drawChart('chart-price',[series('price',C.blue,'',{area:true})],{fmtY:v=>(Math.round(v*100)/100)+''});
  drawChart('chart-batt',[series('batt',C.cyan,'',{area:true})],{yZero:true,fmtY:v=>Math.round(v)+'%'});

  const out=cap(DEV.outdoor,'measure_temperature');setT('clim-out','ute '+(out==null?'–':num(out,1)+'°'));
  const g=$('clim-grid');
  if(g){const temps=[];for(const id in DATA){const d=DATA[id];const t=capOf(d,'measure_temperature');if(t!=null)temps.push({name:d.name||'Enhet',zone:zoneName(d.zone),t:t});}
    temps.sort((a,b)=>b.t-a.t);
    g.innerHTML=temps.length?temps.map(x=>{const pct=Math.max(4,Math.min(100,(x.t-10)/20*100));
      return '<div class="cell"><div class="cell-h">'+icon('thermometer-simple')+'<div class="rm">'+esc(x.name)+'</div></div>'+(x.zone?'<div class="zn">'+esc(x.zone)+'</div>':'')+'<div class="t">'+num(x.t,1)+'<small>°C</small></div><div class="bar"><i style="width:'+pct+'%;background:'+tempColor(x.t)+'"></i></div></div>';}).join(''):'<div class="chart-empty">inga temperaturgivare hittades</div>';}
  drawChart('chart-temp',[series('t_kok',C.warm,'Kök'),series('t_vard',C.green,'Vardagsrum'),series('t_ute',C.blue,'Ute')],{fmtY:v=>num(v,1)+'°'});
  drawChart('chart-co2',[series('co2',C.cyan,'',{area:true})],{yZero:true,fmtY:v=>Math.round(v)+''});
  const hg=$('hum-grid');
  if(hg){const hum=[];for(const id in DATA){const d=DATA[id];const v=capOf(d,'measure_humidity');if(v!=null)hum.push({name:d.name||'Enhet',zone:zoneName(d.zone),v:v});}
    hum.sort((a,b)=>b.v-a.v);
    hg.innerHTML=hum.length?hum.map(x=>'<div class="cell"><div class="cell-h">'+icon('drop')+'<div class="rm">'+esc(x.name)+'</div></div>'+(x.zone?'<div class="zn">'+esc(x.zone)+'</div>':'')+'<div class="t">'+num(x.v,0)+'<small>%</small></div></div>').join(''):'<div class="chart-empty">inga fuktgivare</div>';}

  const dsum=$('dev-sum');
  if(dsum){let total=0,lights=0,lightsOn=0,sensors=0,sockets=0,battLow=0;
    for(const id in DATA){const d=DATA[id];total++;const cl=d.class||d.type||'';
      if(cl==='light'){lights++;if(capOf(d,'onoff')===true)lightsOn++;}else if(cl==='sensor')sensors++;else if(cl==='socket')sockets++;
      const b=capOf(d,'measure_battery');if(b!=null&&b<CONFIG.BATTERY_WARN&&isSensorBatt(d))battLow++;}
    const tile=(ic,acc,n,l)=>'<div class="ds-tile"><div class="'+acc+'">'+icon(ic)+'</div><div class="n">'+n+'</div><div class="l">'+l+'</div></div>';
    dsum.innerHTML=tile('house','acc-violet',total,'enheter')+tile('lightbulb','acc-gold',lightsOn+'<small style="font-size:14px;color:var(--dim)">/'+lights+'</small>','lampor på')+tile('gauge','acc-blue',sensors,'sensorer')+tile('plug','acc-green',sockets,'uttag')+tile('battery-high',battLow?'acc-hot':'acc-dim',battLow,'låga batt');
    }

  const sl=$('status-list');if(sl){sl.innerHTML='';
    const carRow=(id)=>{const b=cap(id,'measure_battery'),r=cap(id,'range_battery'),loc=cap(id,'location_human'),nm=(DATA[id]&&DATA[id].name)||'Bil';
      const charging=carCharging(id),plugged=carPlugged(id);
      addRow(sl,'car-profile','acc-blue',nm,loc||carStatusSv(id)||'',(b==null?'–':Math.round(b)+' %')+(r?' · '+Math.round(r)+' km':'')+(charging?' <span class="chip on">laddar'+(chargerW()!=null?' '+W(chargerW()):'')+'</span>':plugged?' <span class="chip off">inkopplad</span>':''));};
    if(DATA[DEV.car2])carRow(DEV.car2);
    if(DATA[DEV.car])carRow(DEV.car);
    {const _bw=chargerW(),_bon=(cap(DEV.laddbox,'evcharger_charging')===true)||(_bw!=null&&_bw>50);
     const _known=carCharging(DEV.car2)||carCharging(DEV.car)||carPlugged(DEV.car2)||carPlugged(DEV.car);
     if(_bon&&!_known)addRow(sl,'lightning','acc-blue','Gäst','laddbox','<span class="chip on">laddar'+(_bw!=null?' '+W(_bw):'')+'</span>');}
    const dLg=diskLage(),dProg=cap(DEV.dish,'bshc_string.progress');addRow(sl,'fork-knife','acc-cyan','Diskmaskin','',dLg==='kor'?'<span class="chip on">diskar</span> '+(dProg||''):'<span class="chip off">'+(dLg==='redo'?'går inte':'av')+'</span>');
    const aw=cap(DEV.awning,'windowcoverings_state'),awMap={up:'indragen',down:'utfälld',idle:'stilla'};addRow(sl,'umbrella','acc-warm','Markis','','<span class="chip '+(aw==='down'?'on':'off')+'">'+(awMap[aw]||aw||'–')+'</span>');
    const ws=vindMs(),gs=byMs(),wh=(ws>8||gs>11);addRow(sl,'wind','acc-cyan','Vind','by '+(gs==null?'–':num(gs,1))+' m/s','<span class="'+(wh?'chip warn':'')+'">'+(ws==null?'–':num(ws,1))+' m/s</span>');
    const r24=cap(DEV.rain,'measure_rain.24h'),sit=cap(DEV.smhi,'measure_weather_situation_cp');addRow(sl,'cloud-sun','acc-gold','Väder','regn 24h '+(r24==null?'–':num(r24,1))+' mm',esc(sit||'–'));
    let lon=0;for(const id in DATA){const d=DATA[id];if((d.class||d.type)==='light'&&capOf(d,'onoff')===true)lon++;}addRow(sl,'lightbulb','acc-gold','Lampor på','','<span class="rv">'+lon+' st</span>');}

  const bl=$('batt-list');
  if(bl){const bats=[];for(const id in DATA){const d=DATA[id];if(!isSensorBatt(d))continue;const b=capOf(d,'measure_battery');if(b!=null)bats.push({name:d.name||'Enhet',zone:zoneName(d.zone),b:b});}
    bats.sort((a,b)=>a.b-b.b);bl.innerHTML='';if(!bats.length)bl.innerHTML='<div class="chart-empty">inga batterienheter</div>';
    bats.forEach(x=>{const crit=x.b<CONFIG.BATTERY_WARN,cls=crit?'chip crit':x.b<20?'chip warn':'';addRow(bl,crit?'battery-charging':'battery-high',crit?'acc-hot':x.b<20?'acc-warm':'acc-green',x.name,x.zone,'<span class="'+cls+'">'+Math.round(x.b)+' %</span>');});}

  const wd=$('warns');
  if(wd){const wn=[];
    for(const id in DATA){const d=DATA[id];if(!isSensorBatt(d))continue;const b=capOf(d,'measure_battery');if(b!=null&&b<CONFIG.BATTERY_WARN)wn.push(['crit','battery-charging','<b>'+esc(d.name||'En sensor')+'</b>'+(zoneName(d.zone)?' ('+esc(zoneName(d.zone))+')':'')+' har kritiskt lågt batteri',Math.round(b)+' %']);}
    const awn=cap(DEV.awning,'windowcoverings_state'),gs2=byMs();if(awn==='down'&&(gs2>15||(gs2==null&&vindMs()>15)))wn.push(['crit','wind','Markisen är utfälld i hård vind',num(gs2,0)+' m/s by']);
    [DEV.car,DEV.car2].forEach(cid=>{const d=DATA[cid];if(!d)return;const lk=capOf(d,'locked'),dist=capOf(d,'distance');
      if(lk===false){let km=null;if(dist!=null){const mm=(''+dist).match(/([\d.]+)\s*(km|m)\b/);if(mm)km=mm[2]==='km'?parseFloat(mm[1]):parseFloat(mm[1])/1000;}
        if(km!=null&&km>0.3)wn.push(['crit','lock-simple-open','<b>'+esc(d.name||'Bilen')+'</b> är olåst '+esc(capOf(d,'location_human')||'borta'),num(km,1)+' km bort']);}});
    try{const ins=weatherInsight();if(ins){const isai=weatherInsightIsAI();wn.push(['okc',isai?'sparkle':'cloud-sun','Väderläget: '+esc(ins),'']);}}catch(e){}
    try{const ein=energyInsight();if(ein){const eai=energyInsightIsAI();wn.push(['okc',eai?'sparkle':'lightning','Energiläget: '+esc(ein),'']);}}catch(e){}
    _warnList=wn.length?wn:[['okc','leaf','Inget att rapportera – allt ser bra ut','']];
    try{const fw=feedWarnItems();if(fw.length){if(wn.length)_warnList=wn.concat(fw);else _warnList=fw;}}catch(e){}
    try{if(Array.isArray(_warnList)){const seen={},dd=[];_warnList.forEach(function(r){const k=(''+((r&&r[2])||'')).replace(/<[^>]+>/g,'').toLowerCase().replace(/\s+/g,' ').trim();if(!k||seen[k])return;seen[k]=1;dd.push(r);});if(dd.length)_warnList=dd;}}catch(e){}
    if(SOURCE==='demo-data'){_warnList=[
      ['warnc','wind','Blåsigt ute – byvindar upp till 14 m/s','14 m/s'],
      ['crit','lock-simple-open','<b>C40</b> är olåst vid Mandolingatan','1,2 km bort'],
      ['warnc','battery-charging','<b>Rörelse kök</b> har lågt batteri','12 %'],
      ['okc','leaf','Solöverskott – bra läge att köra tunga laster','']];}
    if(_warnIdx>=_warnList.length)_warnIdx=0;renderWarnRow();}
  if(typeof setTimeout==='function')setTimeout(fitScreen,40);
}
function renderWarnRow(){const wd=$('warns');if(!wd||!_warnList.length)return;
  const a=_warnList[_warnIdx],c=a[0],ic2=a[1],t=a[2],l=a[3];
  if(wd.classList){wd.classList.toggle('crit',c==='crit');wd.classList.toggle('warnc',c==='warn');wd.classList.toggle('okc',c==='okc');}
  let dots='';if(_warnList.length>1)dots='<span class="wdots">'+_warnList.map((x,i)=>'<i'+(i===_warnIdx?' class="on"':'')+'></i>').join('')+'</span>';
  const tOff=0,iOff=0;   /* v727: storleken är fast */
  const tStyle=tOff?(' style="font-size:'+Math.max(8,12.5+tOff)+'px"'):'';
  const iS=Math.max(10,17+iOff*1.5),iStyle=iOff?(' style="width:'+iS+'px;height:'+iS+'px"'):'';
  wd.innerHTML='<span class="wi"'+iStyle+'>'+icon(ic2)+'</span><span class="wt"'+tStyle+'>'+t+'</span>'+(l?'<span class="lvl">'+l+'</span>':'')+dots;}
function fitScreen(){try{var _pn=document.getElementById('panu');if(_pn&&_pn.children.length)paNuLinjera(_pn);}catch(e){}
try{
  if(!document.body||!document.body.classList)return;
  const wr=document.querySelector('.wrap');if(!wr||!wr.style)return;
  const kiosk=document.body.classList.contains('kiosk');
  if(!kiosk){wr.style.zoom='';wr.style.transform='';wr.style.width='';wr.style.height='';wr.style.margin='';wr.style.transformOrigin='';return;}
  const cmpOpen=document.body.classList.contains('cmp-open');
  if(document.body.classList.contains('tabprev')){
    if(cmpOpen){ /* jamfor/insikter i platt-lage: samma layoutbredd OCH samma skala som startsidan, men skrollbar.
                    RATTAT v179: skalan raknades forr om som vw/DW - bara bredden. Startsidan anvander
                    min(vw/DW, vh/DH), alltso aven hojden. Nar startsidan ar hojdbegransad (sc=vh/DH)
                    blev de har sidorna bredare an den. Nu arvs _tpSC rakt av. */
      wr.style.transform='';wr.style.transformOrigin='top left';wr.style.margin='0 auto';
      const vwc=(window.innerWidth||400);
      const DWc=(_tpDW&&_tpDW>=300)?_tpDW:Math.max(380,vwc);
      wr.style.width=DWc+'px';wr.style.height='auto';
      const SCc=(_tpSC&&_tpSC>0)?_tpSC:Math.min(1,vwc/DWc);
      wr.style.zoom=String(Math.max(0.3,Math.min(1,SCc)));
      try{document.documentElement.style.overflow='';document.body.style.overflow='';}catch(e){}
      return;
    }
    wr.style.zoom='';wr.style.transform='';wr.style.transformOrigin='top left';wr.style.margin='0';
    const vw=(window.innerWidth||400),vh=(window.innerHeight||800);
    let DW,DH;
    if(vw>vh){
      /* liggande skärm (dator): plattans bredd, men mät naturlig höjd så rapportrutan inte sväller */
      DW=(CONFIG&&CONFIG.TABLET_W)||800;
      wr.style.width=DW+'px';wr.style.height='auto';
      DH=Math.max(320,wr.scrollHeight||wr.clientHeight||900);
      wr.style.height=DH+'px';
    }else{
      /* stående skärm (telefon): fyll skärmen, mät naturlig höjd */
      const targetAR=vw/vh;DW=Math.min(820,Math.max(380,vw));DH=900;
      for(let i=0;i<5;i++){wr.style.width=DW+'px';wr.style.height='auto';
        DH=Math.max(320,wr.scrollHeight||wr.clientHeight||900);
        const DWn=Math.max(380,Math.min(1000,targetAR*DH));
        if(Math.abs(DWn-DW)<4){DW=DWn;break;}DW=DWn;}
      wr.style.width=DW+'px';wr.style.height='auto';DH=Math.max(320,wr.scrollHeight||wr.clientHeight||900);
      wr.style.height=DH+'px';
    }
    const sc=Math.min(vw/DW,vh/DH);
    _tpDW=DW; _tpSC=sc;
    const left=Math.max(0,(vw-DW*sc)/2),top=Math.max(0,(vh-DH*sc)/2);
    wr.style.transform='translate('+left.toFixed(1)+'px,'+top.toFixed(1)+'px) scale('+sc.toFixed(4)+')';
    return;
  }
  wr.style.transform='';wr.style.transformOrigin='';wr.style.width='';wr.style.height='';wr.style.margin='';wr.style.zoom='';
  /* v746: skrollande platta – ingen nedskalning, sidan får vara högre än skärmen. */
  if(document.body.classList.contains('rull')){_kzoom='';
    try{document.documentElement.style.overflow='';document.body.style.overflow='';}catch(e){}return;}
  /* RATTAT v179: startsidan zoomas ned for att fa plats pa hojden i kioskslage. Jamfor och
     insikter returnerade har med zoom rensad, alltso skala 1 - och blev breda an startsidan
     med precis den faktorn. De arver nu startsidans zoom. */
  if(cmpOpen){wr.style.height='auto';if(_kzoom)wr.style.zoom=_kzoom;
    try{document.documentElement.style.overflow='';document.body.style.overflow='';}catch(e){}return;}
  const vpH=(window.visualViewport&&window.visualViewport.height)||window.innerHeight||0;
  /* v681: ÖVERSKOTTET MÄTS I VYN, inte bara i ramen. Sedan flikraden ligger
     sist i ramen (v680) kan startsidan svämma över in under den utan att
     ramens scrollHeight växer — upp till flikradens höjd syntes inget, och
     rapportrutan ritades ovanpå menyn. Behovet = ramens höjd + det vyn inte
     rymmer. */
  const vy=document.querySelector('.view:not(.hidden)');
  const over=vy?Math.max(0,(vy.scrollHeight||0)-(vy.clientHeight||0)):0;
  const avail=vpH-18,need=Math.max(wr.scrollHeight||0,(wr.clientHeight||0)+over);
  if(avail>100&&need>avail+3){_kzoom=String(Math.max(0.6,Math.floor(avail/need*1000)/1000));wr.style.zoom=_kzoom;}
  else _kzoom='';
}catch(e){}}

function syncCmpHeader(){
  try{
    /* Alla fyra undersidor speglar huvudstatusen: Jämför (-c), Insikter (-i),
       Väder (-v) och Notiser (-n). Tidigare fanns bara -c och -i här, så
       väderprickens och notisprickens klass aldrig uppdaterades — de satt kvar
       på start-klassen "cache" (gul) och såg ut att aldrig bli live. */
    var suff=['-c','-i','-v','-n'];
    suff.forEach(function(x){
      var a=$('status-text'),b=$('status-text'+x);if(a&&b)b.textContent=a.textContent;
    });
    var sb=$('en-self-badge');
    ['en-self-badge-c','en-self-badge-i'].forEach(function(bid){var sbc=$(bid);if(sb&&sbc){sbc.textContent=sb.textContent;if(sbc.classList)sbc.classList.toggle('imp',!!(sb.classList&&sb.classList.contains('imp')));}});
    var dt=$('dot');suff.forEach(function(x){var dtc=$('dot'+x);if(dt&&dtc)dtc.className=dt.className;});
    var rl=$('rel');suff.forEach(function(x){var rlc=$('rel'+x);if(rl&&rlc)rlc.className=rl.className;});
  }catch(e){}
}
function tickRel(){
  nightClockTick();syncCmpHeader();
  _warnTick++;if(_warnTick>=(CFG.reportSecs||6)&&_warnList.length>1){_warnTick=0;_warnIdx=(_warnIdx+1)%_warnList.length;renderWarnRow();}
  const r=$('rel');if(!r)return;if(!lastUpdate||SOURCE==='demo-data'){r.textContent='';r.classList.remove('stale');return;}
  const s=Math.round((Date.now()-lastUpdate)/1000);
  if(_online){r.textContent='';r.classList.remove('stale');}
  else{r.textContent='· '+(s<60?(s+' s'):s<3600?(Math.floor(s/60)+' min'):(Math.floor(s/3600)+' h'))+' sedan';r.classList.add('stale');}}

function withTimeout(ms){const c=new AbortController(),id=setTimeout(()=>c.abort(),ms);return{signal:c.signal,clear:()=>clearTimeout(id)};}
async function fetchHomey(base){const t=withTimeout(8000);try{const r=await fetch(base.replace(/\/$/,'')+'/api/manager/devices/device/',{headers:{Authorization:'Bearer '+CONFIG.TOKEN},signal:t.signal});t.clear();if(r.ok)return await r.json();}catch(e){t.clear();}return null;}
function credGet(){
  try{var o=JSON.parse(localStorage.getItem(CRED_KEY)||'{}');
    return {token:o.token||'',homeyId:o.homeyId||'',lan:o.lan||'',at:o.at||0};
  }catch(e){return {token:'',homeyId:'',lan:'',at:0};}}
function credSet(o){
  try{localStorage.setItem(CRED_KEY,JSON.stringify({
    token:(o.token||'').trim(),homeyId:(o.homeyId||'').trim(),
    lan:(o.lan||'').trim(),at:Date.now()}));return true;}catch(e){return false;}}
function credRensa(){try{localStorage.removeItem(CRED_KEY);}catch(e){}}
/* Gottskärsdashboarden får inte köras mot Markus's Homey i Göteborg - den har
   sin egen dashboard (gbg/). Samma adress, så en lösenordshanterare kan fylla
   i fel uppgifter här också. */
var GBG_HOMEY_ID='65857c585f407045e73ddfdc';
function credFinns(){var c=credGet();return !!(c.token&&c.homeyId&&String(c.homeyId).trim().toLowerCase()!==GBG_HOMEY_ID);}
/* Molnadressen ar alltid tillganglig, aven hemifran. Den lokala bara pa LAN. */
function credMoln(){var c=credGet();
  return c.homeyId?('https://'+c.homeyId+'.connect.athom.com'):'';}
/* Homeys lokala HTTPS-namn. Punkterna i IP-numret byts mot bindestreck under
   homeylocal.com, och Athom har ett giltigt certifikat för det. Adressen pekar
   på samma maskin i samma nät — det är alltså fortfarande LOKALT, bara över
   https. */
function homeyLokalHttps(ip){
  var m=String(ip||'').match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  return m?('https://'+m.slice(1).join('-')+'.homey.homeylocal.com'):'';}

function credLan(){
  var c=credGet();
  if(!c.lan)return '';
  var u=c.lan.trim().replace(/\/+$/,'');
  if(!/^https?:\/\//i.test(u))u='http://'+u;
  /* En https-sida får inte anropa http. Webbläsaren blockerar det som blandat
     innehåll INNAN anropet går ut, så det misslyckas alltid och dashboarden
     faller tillbaka på molnet — även när man står i samma rum som Homey.
     Därför byts adressen mot Homeys eget https-namn för samma IP. */
  try{
    if(location.protocol==='https:'&&/^http:\/\//i.test(u)){
      var ip=u.replace(/^http:\/\//i,'').split(':')[0].replace(/\/.*$/,'');
      var sak=homeyLokalHttps(ip);
      if(sak)return sak;
      return '';        /* inget IP att bygga av: hellre inget än ett dött anrop */
    }
  }catch(e){}
  return u;}
/* ===== Forsta uppstarten =====
   Utan token gar ingenting att hamta, sa i stallet for en tom dashboard med
   streck overallt visas en ruta som ber om det som behovs. Den provar
   uppgifterna INNAN de sparas — ett felstavat id ska inte leda till en sida som
   bara sager "ingen kontakt". */
function setupHTML(){
  var c=credGet();
  return '<div class="setup-bak" id="setup-bak"><div class="setup">'
    +'<div class="setup-h">Anslut till Homey</div>'
    +'<div class="setup-s">Uppgifterna sparas i den har webblasaren och lamnar den aldrig. '
    +'De finns inte i sidans fil.</div>'
    +'<label class="setup-l" for="su-id">Homey-ID</label>'
    +'<input class="setup-i" id="su-id" spellcheck="false" autocomplete="off" '
    +'placeholder="t.ex. 65ae5b626f8c3918be8a18e2" value="'+esc(c.homeyId)+'">'
    +'<div class="setup-t">Star i adressen pa my.homey.app efter <b>/homeys/</b></div>'
    +'<label class="setup-l" for="su-tok">Personal Access Token</label>'
    +'<input class="setup-i" id="su-tok" type="password" spellcheck="false" autocomplete="off" '
    +'placeholder="tre delar aatskilda med kolon" value="'+esc(c.token)+'">'
    +'<div class="setup-t">Skapas i Homey Developer Tools under <b>Personal Access Tokens</b></div>'
    +'<label class="setup-l" for="su-lan">Lokal adress <em style="font-style:normal;opacity:.6">(valfritt)</em></label>'
    +'<input class="setup-i" id="su-lan" spellcheck="false" autocomplete="off" '
    +'placeholder="http://192.168.50.147" value="'+esc(c.lan)+'">'
    +'<div class="setup-t">Snabbare nar du ar hemma. Utan den gar allt via molnet.</div>'
    +'<button class="setup-b" id="su-ok">Anslut</button>'
    /* Demoläge utan uppgifter: hela dashboarden med påhittade siffror. Gör det
       möjligt att prova en ny version utan att lägga upp den någonstans eller
       skriva in token igen. Uppgifterna sparas inte, så nästa gång är rutan
       tillbaka. */
    +'<button class="setup-b setup-demo" id="su-demo">Visa demo utan att ansluta</button>'
    +'<div class="setup-t" style="margin-top:6px">Allt fungerar, men siffrorna är '
    +'påhittade. Inget sparas — rutan är tillbaka nästa gång du öppnar sidan.</div>'
    +'<div class="setup-m" id="su-msg"></div>'
    +'</div></div>';}
function setupVisa(){
  if(document.getElementById('setup-bak'))return;
  var d=document.createElement('div');
  d.innerHTML=setupHTML();
  document.body.appendChild(d.firstChild);
  var k=document.getElementById('su-ok');
  if(k)k.addEventListener('click',setupProva);
  var dm=document.getElementById('su-demo');
  if(dm)dm.addEventListener('click',setupDemo);
  ['su-id','su-tok','su-lan'].forEach(function(id){
    var e=document.getElementById(id);
    if(e)e.addEventListener('keydown',function(ev){if(ev.key==='Enter')setupProva();});
  });}
function felHomeyRakna(karta){
  var ids=NYCKEL_ENH(),har=0;
  ids.forEach(function(id){if(karta&&karta[id])har++;});
  return {har:har,av:ids.length,totalt:karta?Object.keys(karta).length:0};}
function felHomeyKoll(){
  if(typeof isDemo==='function'&&isDemo())return;
  var r=felHomeyRakna(DATA),b=document.getElementById('fel-homey');
  var fel=(r.totalt>0&&r.har<=1);
  if(!fel){if(b&&b.parentNode)b.parentNode.removeChild(b);return;}
  if(b)return;
  var c=credGet();
  b=document.createElement('div');b.id='fel-homey';b.className='fel-homey';
  b.innerHTML='<b>Fel Homey?</b> Ansluten till <code>'+esc(c.homeyId||'?')+'</code>, men den har inte den här '
    +'dashboardens enheter ('+r.har+' av '+r.av+' hittades bland '+r.totalt+'). Därför står det 0 och streck.'
    +'<button type="button" onclick="setupVisa()">Ändra anslutning</button>';
  document.body.appendChild(b);}
function setupDolj(){
  var e=document.getElementById('setup-bak');
  if(e&&e.parentNode)e.parentNode.removeChild(e);}
/* Ingen cache och inget svar än: foten ska säga att det hämtas. "demo-data"
   är bara sant när demoläget faktiskt är valt. */
function fotStartar(){
  try{if(!Object.keys(DATA).length&&credFinns()&&!isDemo())setT('foot-src','hämtar…');}catch(e){}}
/* Startar demoläget. Ingen token sparas och inget nätverk används — samma väg
   som dashboarden redan tar när den saknar Homey, men vald med flit. */
function setupDemo(){
  try{
    setupDolj();
    SOURCE='demo-data';
    BASE='';CONFIG.TOKEN='';
    /* NOLLSTÄLL alla storlekar. Demovyn ska visa hur dashboarden ser ut som den
       levereras — inte hur den råkar vara inställd på just den här enheten.
       Utan det bär demot med sig gamla justeringar och duger inte som facit. */
    try{
      ['spot','ks','kn','avd','chip','tile'].forEach(function(g){
        try{szClear(g);}catch(e){}
      });
      CFG.mob={};
      localStorage.removeItem('secScale_v1');
      localStorage.removeItem('secDold_v1');
      saveCfg();applyCfg();applySecOrder();
    }catch(e){}
    DATA=applyScenario(0);
    if(typeof seedHistory==='function')try{seedHistory();}catch(e){}
    /* Krönikan finns inte i demoläget — lägg in några poster så notisvyn går
       att prova, annars ser den bara tom ut. */
    try{demoKronika();}catch(e){}
    render();
    try{krNotisUppdatera();}catch(e){}
    try{goHome();}catch(e){}
  }catch(e){}}

/* Påhittade krönikeposter, så notislistan och notisvyn går att prova. */
function demoKronika(){
  var nu=Date.now(), D=86400000;
  var idag=new Date();
  var ym=function(m){var d=new Date(idag.getFullYear(),idag.getMonth()-m,1);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');};
  _kron={ar:[{period:String(idag.getFullYear()-1),sol:19800,raknad_at:nu-5*D,text_at:nu-5*D}],
    manader:[{period:ym(1),sol:2615,raknad_at:nu-2*3600000,text_at:nu-2*3600000},
             {period:ym(2),sol:2640,raknad_at:nu-2*D,text_at:nu-2*D},
             {period:ym(3),sol:2210,raknad_at:nu-33*D,text_at:nu-33*D}]};
  _kronAt=Date.now();
  var post=function(p,ar){
    return {period:p,ar:!!ar,
      sol:{kwh:ar?19800:2615,basta:{datum:p+'-14',kwh:118},samsta:{datum:p+'-03',kwh:21},dygnOver100:9,perKwp:ar?1018:135},
      el:{koptKwh:245,saltKwh:965,koptKr:312,saltKr:1140,netto:828,sjalv:78,
          dyrast:{datum:p+'-22',timme:18,pris:1.84},billigast:{datum:p+'-14',timme:3,pris:0.08}},
      vader:{max:{datum:p+'-04',temp:28.4},min:{datum:p+'-12',temp:9.1},medel:19.2,
             dygnOver25:7,nederbord:26.9,by:{datum:p+'-11',ms:21.7}},
      pool:{varmast:{datum:p+'-15',temp:28.9},dygnOver26:14},
      vin:{in:17,ut:6,varde:48250},bil:{kwh:310},
      text:(ar?'🏡 Husets år ':'🏡 Husets ')+(ar?p:kronNamn(p))+'\n'
        +'Produktion 2 615 kWh — 6 % under föregående månad, men 12 % över samma månad i fjol.\n'
        +'💰 Elkostnad 312 kr, ersättning 1 140 kr → netto +828 kr.\n'
        +'🔋 Batteriet cyklade 118 kWh, snittdjup 62 %.\n'
        +'🚗 Laddat 310 kWh, varav 71 % egen sol.\n'
        +'🏊 Poolvärme 84 h, 96 % på solöverskott, snitt 27,4 °C.\n'
        +'🌡️ Ute 19,2 °C i snitt — 2,1 °C varmare än i fjol.\n'
        +'🏆 Bästa dag: den 14:e, 118 kWh.'};};
  _kron.manader.forEach(function(x){_kronPost[x.period]=post(x.period,false);});
  _kron.ar.forEach(function(x){_kronPost[x.period]=post(x.period,true);});}

async function setupProva(){
  var id=(document.getElementById('su-id')||{}).value||'';
  var tok=(document.getElementById('su-tok')||{}).value||'';
  var lan=(document.getElementById('su-lan')||{}).value||'';
  var m=document.getElementById('su-msg');
  var knapp=document.getElementById('su-ok');
  var sag=function(t,fel){if(m){m.innerHTML=t;m.className='setup-m'+(fel?' fel':' ok');}};
  id=id.trim();tok=tok.trim();lan=lan.trim();
  if(!id||!tok){sag('Fyll i bade Homey-ID och token.',true);return;}
  if(id.toLowerCase()===GBG_HOMEY_ID){sag('Det d\u00e4r \u00e4r Markus\u2019s Homey i G\u00f6teborg. Gottsk\u00e4rsdashboarden ansluter till Homey Pro i Gottsk\u00e4r.',true);return;}
  if(tok.split(':').length<3){sag('Token ska besta av tre delar atskilda med kolon.',true);return;}
  if(knapp){knapp.disabled=true;knapp.textContent='Provar…';}
  sag('Provar uppgifterna…');
  /* Prova bade lokalt och moln. Racker det med det ena sparas anda badadera —
     den lokala adressen ar bara oanvandbar borta, inte fel. */
  var baser=[];
  if(lan)baser.push(/^https?:\/\//i.test(lan)?lan.replace(/\/+$/,''):('http://'+lan.replace(/\/+$/,'')));
  baser.push('https://'+id+'.connect.athom.com');
  var lyckad=null,fel=[];
  for(var i=0;i<baser.length;i++){
    try{
      var t=withTimeout(9000);
      var r=await fetch(baser[i]+'/api/manager/system/',
        {headers:{Authorization:'Bearer '+tok},cache:'no-store',signal:t.signal});
      t.clear();
      if(r.ok){lyckad=baser[i];break;}
      fel.push(baser[i].replace(/^https?:\/\//,'')+': '+r.status+' '+r.statusText);
    }catch(e){fel.push(baser[i].replace(/^https?:\/\//,'')+': ingen kontakt');}
  }
  if(knapp){knapp.disabled=false;knapp.textContent='Anslut';}
  if(!lyckad){
    sag('Kom inte fram.<br>'+esc(fel.join('<br>')).replace(/&lt;br&gt;/g,'<br>')
      +'<br><br>Kontrollera id och token. Ar bada ratt men molnet inte svarar kan Homey vara offline.',true);
    return;}
  /* v743: rätt Homey? Anslutningen kan lyckas mot en Homey som inte har
     dashboardens enheter – då blev allt 0 och streck utan förklaring. */
  if(!setupProva._anda){
    var rk=null;
    try{var t2=withTimeout(12000);
      var r2=await fetch(lyckad+'/api/manager/devices/device/',{headers:{Authorization:'Bearer '+tok},cache:'no-store',signal:t2.signal});
      t2.clear();if(r2.ok)rk=felHomeyRakna(await r2.json());}catch(e){}
    if(rk&&rk.har<=1){
      sag('Ansluten, men den här Homeyn har inte dashboardens enheter ('+rk.har+' av '+rk.av
        +' hittades bland '+rk.totalt+'). Är det rätt Homey-ID?'
        +'<br><button type="button" class="setup-b setup-demo" id="su-anda" style="margin-top:8px">Anslut ändå</button>',true);
      var an=document.getElementById('su-anda');
      if(an)an.addEventListener('click',function(){setupProva._anda=true;setupProva();});
      return;}
  }
  setupProva._anda=false;
  credSet({token:tok,homeyId:id,lan:lan});
  credTillCONFIG();
  sag('Ansluten via '+esc(lyckad.replace(/^https?:\/\//,''))+'. Laser in…');
  setTimeout(function(){setupDolj();try{load();}catch(e){}},600);}
/* Fyller CONFIG ur det sparade, sa att all befintlig kod som laser CONFIG.TOKEN
   fortsatter fungera oforandrad. Utan det hade varenda anrop behovt skrivas om. */
function credTillCONFIG(){var c=credGet();
  CONFIG.TOKEN=c.token||'';
  CONFIG.HOMEY_URL=credLan()||credMoln()||'';
  return c;}
function valjVag(lista,hamta){
  return new Promise(function(klar){
    if(!lista||!lista.length){klar(null);return;}
    var svar={},kvar=lista.length,forstaOk=0,klart=false;
    function avgor(){
      if(klart)return;
      for(var i=0;i<lista.length;i++){var b=lista[i],s0=svar[b];
        if(s0===undefined){                              /* väntar fortfarande */
          if(forstaOk&&Date.now()-forstaOk>=VAG_FORSPRANG)continue;
          return;}
        if(s0){klart=true;klar({base:b,map:s0});return;}
      }
      if(kvar===0||forstaOk){klart=true;klar(null);}
    }
    lista.forEach(function(b){
      Promise.resolve().then(function(){return hamta(b);}).then(function(m){return m||null;},function(){return null;})
        .then(function(m){svar[b]=m;kvar--;
          if(m&&!forstaOk){forstaOk=Date.now();setTimeout(avgor,VAG_FORSPRANG+5);}
          avgor();});
    });
  });
}
function candidates(){
  credTillCONFIG();
  var list=[],lan=credLan(),moln=credMoln();
  if(lan)list.push(lan);
  if(moln)list.push(moln);
  var m=(lan||'').match(/(\d+)-(\d+)-(\d+)-(\d+)\.homey\.homeylocal\.com/);
  if(m)list.push('http://'+m.slice(1).join('.'));
  return list;}
function footVia(){
  var e=$('foot-via');if(!e)return;
  var v=' · '+APP_VERSION;
  if(!BASE||isDemo()){e.textContent=v;return;}
  var moln=BASE.indexOf('connect.athom.com')>0;
  /* Kort markering när vägen nyss bytts, så man ser att det hänt. */
  var nyss=(_baseByte&&Date.now()-_baseByte<30000)?' ⇄':'';
  e.innerHTML=' · <span style="color:'+(moln?'var(--gold)':'var(--ok)')+'">'
    +(moln?'molnet':'lokalt')+nyss+'</span>'+v;}
/* SOURCE innehåller adressen ("Homey · 192.168.50.147"). Bara första ledet visas. */
function footKalla(){
  var s=String(SOURCE||'');
  return s.split(' · ')[0].split(' — ')[0].trim()||s;}
function cacheSpara(map){
  if(!map||!Object.keys(map).length)return;
  var nu=Date.now();
  if(nu-_cacheAt<60000)return;            /* en gång i minuten räcker */
  _cacheAt=nu;
  try{localStorage.setItem(CACHE_KEY,JSON.stringify({at:nu,zon:ZONES,dev:map}));}catch(e){}
}
function cacheLas(){
  try{
    var r=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');
    if(!r||!r.dev||!Object.keys(r.dev).length)return null;
    /* Äldre än ett dygn är inte värt att visa — då är streck ärligare. */
    if(!r.at||Date.now()-r.at>86400000)return null;
    return r;
  }catch(e){return null;}
}
function cacheVisa(){
  if(Object.keys(DATA).length)return false;   /* redan ifyllt */
  var r=cacheLas();
  if(!r)return false;
  DATA=r.dev;
  if(r.zon&&Object.keys(r.zon).length&&!Object.keys(ZONES).length)ZONES=r.zon;
  VISAR_CACHE=true;
  /* Foten sa "demo data" vid första öppningen, för SOURCE står på demo tills
     nätet svarat. Visar vi sparad data ska det stå det. */
  SOURCE='sparad data';
  lastUpdate=r.at;
  setStatus('cache','Sparat '+hhmm(new Date(r.at)));
  /* Foten skrivs bara av load(), som ännu inte fått svar. Utan den här raden
     står markupens starttext kvar hela väntetiden. */
  try{setT('foot-src',footKalla());}catch(e){}
  try{render();}catch(e){}
  return true;
}
function liveVanta(pa){
  try{
    var b=document.body;if(!b||!b.classList)return;
    if(pa){
      if(isDemo()||!credFinns())return;
      b.classList.add('vantar-live');
      var el=document.getElementById('live-vant');
      if(!el){el=document.createElement('div');el.id='live-vant';el.setAttribute('role','status');
        el.innerHTML='<span class="lv-prick"></span><span>Hämtar live\u2026</span>';b.appendChild(el);}
      clearTimeout(_liveVantaT);_liveVantaT=setTimeout(function(){liveVanta(false);},LIVE_VANTA_MAX);
    }else{
      clearTimeout(_liveVantaT);_liveVantaT=null;
      b.classList.remove('vantar-live');
    }
  }catch(e){}
}
function setStatus(s,t){const d=$('dot');if(d)d.className='dot '+s;setT('status-text',t);try{syncCmpHeader();}catch(e){}}
function statusLive(){const d=$('dot');return !!(d&&d.classList&&d.classList.contains('live'));}
async function load(){
  credTillCONFIG();
  /* GUL MEDAN DET LADDAS. Regeln är: rött = ingen kontakt, gult = sparad data
     eller hämtning pågår, grönt = färska värden från Homey. Utan det här stod
     punkten kvar på grönt medan hämtningen pågick och ljög i några sekunder. */
  /* v761: BARA NÄR DEN INTE REDAN ÄR GRÖN. Förut slog punkten om till gult vid
     VARJE uppdatering, var 15:e sekund, så länge anropet pågick – och "gult" var
     --warm, en orange som på skärmen ser röd ut. Det var blinkningen. En grön
     punkt får vara grön medan nästa hämtning pågår; värdena den står för är
     högst en uppdatering gamla. */
  var _start=Date.now();
  try{
    if(!isDemo()&&credFinns()&&!statusLive())
      setStatus('cache',VISAR_CACHE?('Sparat '+hhmm(new Date(lastUpdate||Date.now()))):'Hämtar…');
  }catch(e){}
  let map=null;const notConf=!credFinns();
  /* Utan uppgifter: visa rutan i stallet for en dashboard full av streck. */
  if(notConf&&!isDemo()&&!CONFIG.DATA_URL){try{setupVisa();}catch(e){}}
  if(CONFIG.DATA_URL){try{const r=await fetch(CONFIG.DATA_URL,{cache:'no-store'});if(r.ok){map=await r.json();SOURCE='lokal data.json';BASE=CONFIG.HOMEY_URL||'';}}catch(e){}}
  if(!map&&!notConf){
    /* Vägen väljs om högst en gång per minut. Tidigare valdes den bara vid
       första laddningen, så gick man hemifrån stod indikatorn kvar på "lokalt"
       medan anropen tyst misslyckades — och kom man hem fortsatte allt gå via
       molnet i onödan.

       Däremellan används den väg som redan fungerar. Först när DEN slutar
       svara, eller när minuten gått, provas listan om från början. Alternativet
       — att prova lokalt varje gång — skulle kosta ett anrop som måste hinna gå
       i timeout var 15:e sekund när man är borta. */
    var nu=Date.now();
    var provaOm=(!BASE)||(nu-_baseAt>60000);
    if(!provaOm){
      map=await fetchHomey(BASE);
      if(!map)provaOm=true;                 /* nuvarande väg svarar inte längre */
    }
    if(provaOm){
      var vv=await valjVag(candidates(),fetchHomey);   /* v723: alla vägar samtidigt */
      if(vv){
        map=vv.map;
        if(vv.base!==BASE)_baseByte=Date.now();
        BASE=vv.base;_baseAt=Date.now();
        SOURCE='Homey · '+vv.base.replace(/^https?:\/\//,'');
      }
    }
  }
  if(map){DATA=map;VISAR_CACHE=false;setStatus('live','LIVE');cacheSpara(map);lastUpdate=Date.now();_online=true;recordHist();yearBaseUpdate();learnTick();priceLogTick();dayLogTick();recsTick();try{vanTick();}catch(e0){}try{if(!_battLogAt)battLoggKoll(true);}catch(e1){}shmTick();try{progLogTick();}catch(e){}hltTick();shCostTick();snowTick();zamTick();monTick();backupTick();try{felHomeyKoll();}catch(e){}}
  /* v761: ETT MISSAT ANROP ÄR INTE OFFLINE. Ett anrop som går i tidsgräns (8 s,
     vanligast via molnet) gjorde punkten röd i 15 s tills nästa lyckades. Nu
     står den kvar på grönt så länge senaste lyckade hämtning är yngre än
     LIVE_TAPP_MS – rött först när flera anrop i rad uteblivit. En hämtning som
     startade före den senaste lyckade får heller inte måla över den. */
  else if(statusLive()&&lastUpdate&&(Date.now()-lastUpdate<LIVE_TAPP_MS||lastUpdate>=_start)){
    /* står kvar på grönt */
  }
  else if(VISAR_CACHE){
    /* Nätet svarade inte, men skärmen visar sparad data. Då är "Offline" fel
       besked: det står redan siffror där, och de är gamla — vilket är precis
       vad den gula punkten och klockslaget säger. */
    _online=false;
    setStatus('cache','Sparat '+hhmm(new Date(lastUpdate||Date.now())));
  }
  else{_online=false;const wasLive=(SOURCE.indexOf('Homey')===0||SOURCE==='lokal data.json')&&Object.keys(DATA).length>0;
    if(wasLive){setStatus('dead','Offline');}
    else{if(Object.keys(DATA).length===0)applyScenario(curScenario);if(Object.keys(ZONES).length===0)ZONES=DEMO_ZONES;SOURCE='demo-data';setStatus('dead','Offline');}}
  /* v752: BOKNINGARNA I SAMMA VÄNTAN. Är sidan suddig (öppning, eller tillbaka
     efter mer än en minut) hämtas Logic-variablerna innan den skärps, så att På
     nu och batteriet inte först visar ett gammalt läge. Ett enda anrop efter
     enheterna; högst REGEL_VANTA_MS extra, sedan skärps sidan ändå. */
  if(map&&BASE&&document.body&&document.body.classList&&document.body.classList.contains('vantar-live')){
    try{var _rp=regelHamta(true);if(_rp)await Promise.race([_rp,new Promise(function(r){setTimeout(r,REGEL_VANTA_MS);})]);}catch(e){}}
  render();tickRel();setT('foot-src',footKalla());footVia();
  liveVanta(false);   /* v723: färska värden – eller inget svar alls: skärp sidan */
  if(map&&BASE&&!CONFIG.DATA_URL){priceVarFetch();prisVarHamta();loadZones();if(!seeded)seedHistory();appSerierHamta();windInsFetch();
    /* Krönikelistan hämtas HÄR, inte bara när Insikter ritas. Notisknappen sitter
       i toppraden på startsidan, och utan det här stod den tom tills man råkat
       öppna Insikter en gång. */
    try{kronLista().then(function(){try{krNotisUppdatera();}catch(e){}});}catch(e){}
    try{dagHamta();}catch(e){}
    try{kronDjupLank();}catch(e){}zamPressSeed();tibKrFetch();battKwhFetch();monBackfill();emixBackfill();}
}
function mobGapY(){return MOB_GAP_DEF;}   /* v727: fast */
function applyMobGap(){try{
  var r=document.documentElement;if(!r||!r.style)return;
  r.style.setProperty('--mob-gap-y',mobGapY()+'px');
}catch(e){}}
function extStandard(){
  try{return (location.protocol==='https:')?EXT_URL_MOLN:EXT_URL_LOKAL;}
  catch(e){return EXT_URL_LOKAL;}}
function cfgExtUrl(v){v=(v||'').trim();
  if(!v)delete CFG.extUrl; else CFG.extUrl=v;
  saveCfg();
  var f=document.getElementById('extfr-f');if(f&&extOppen())f.src=extUrl();}
function extUrl(){
  var u=CFG&&CFG.extUrl;
  if(typeof u==='string'&&u.trim()){
    u=u.trim();
    /* En sparad http-adress duger inte när sidan körs över https. Hellre byta
       till molnvarianten än att visa en tom ram. */
    if(location.protocol==='https:'&&/^http:\/\//i.test(u))return EXT_URL_MOLN;
    return u;
  }
  return extStandard();}
function extTitel(){
  var f='';
  try{
    var p=new URL(extUrl(),location.href).pathname.replace(/\/+$/,'');
    /* Slutar adressen på en katalog (…/vinkallare/) är det katalognamnet som
       är titeln, inte ett filnamn som inte finns. */
    f=p.split('/').pop().replace(/\.html?$/i,'');
  }catch(e){}
  if(!f)return '';
  var k=f.toLowerCase();
  return EXT_NAMN[k]||(f.charAt(0).toUpperCase()+f.slice(1));}
function extOppen(){var o=document.getElementById('extfr');
  return !!(o&&o.classList&&o.classList.contains('open'));}
/* HÅLLTRYCK PÅ PRICKEN, PLATTAN (v680). Toppraden med växlingsknappen är
   borta. Är husvakten på (två hus) får man välja: vinkällaren eller byt hus.
   Annars öppnas vinkällaren direkt, som förut. */
function prickHall(){
  var hv=(typeof window!=='undefined')?window.HUSVAKT:null,tva=false;
  /* v717: "Byt hus" när två hus finns (husvakt 1.8.0 tva), inte bara när automatiken är på. */
  try{tva=!!(hv&&(typeof hv.tva==='function'?hv.tva():(typeof hv.pa==='function'&&hv.pa())));}catch(e){}
  if(!tva){extOpen();return;}
  var m=document.getElementById('prick-meny');if(m)m.remove();
  m=document.createElement('div');m.id='prick-meny';
  m.innerHTML='<div class="pm-ruta" role="dialog" aria-label="Välj"><button type="button" data-pm="vin">'
    +esc(EXT_URL_DEF.split('/').pop().replace(/\.html?$/i,'').replace(/^./,function(c){return c.toUpperCase();}))
    +'</button><button type="button" data-pm="hus">Byt hus</button></div>';
  var stang=function(){clearTimeout(m._t);if(m.parentElement)m.remove();};
  m.addEventListener('click',function(e){var b=e.target.closest('[data-pm]');
    if(b){stang();if(b.getAttribute('data-pm')==='vin')extOpen();else husVaxla();return;}
    if(e.target===m)stang();});
  m._t=setTimeout(stang,30000);
  document.body.appendChild(m);
}
function extOpen(){
  var o=document.getElementById('extfr');
  if(!o){
    o=document.createElement('div');o.id='extfr';o.className='extfr';
    o.innerHTML='<div class="extfr-bar">'
      +'<button class="extfr-back" onclick="extClose()">'
      +'<span class="extfr-ch">‹</span>Dashboard</button>'
      +'<span class="extfr-t" id="extfr-t"></span></div>'
      +'<iframe id="extfr-f" title="Extern sida" referrerpolicy="no-referrer"></iframe>';
    document.body.appendChild(o);}
  var f=document.getElementById('extfr-f');
  if(f&&f.src!==extUrl())f.src=extUrl();
  var t=document.getElementById('extfr-t');
  if(t)t.textContent=extTitel();
  o.classList.add('open');}
function extEsc(e){if(e&&e.key==='Escape'&&extOppen()){e.stopPropagation();extClose();}}
function extClose(){var o=document.getElementById('extfr');if(!o)return;
  o.classList.remove('open');
  /* Ramen töms så den inte ligger och laddar i bakgrunden. */
  var f=document.getElementById('extfr-f');if(f)f.src='about:blank';
  /* Tillbaka betyder tillbaka till borjan: ev. dialog stangs och forsta
     vyn visas. Annars landar man i det man rakade oppna pa vagen ut. */
  try{var bk=document.getElementById('dlg-back');
    if(bk&&bk.classList&&bk.classList.contains('open')){
      if(typeof closeDetail==='function')closeDetail();
      else bk.classList.remove('open');}}catch(e){}
  try{if(typeof showView==='function')showView('flode');}catch(e){}
  try{window.scrollTo(0,0);}catch(e){}}
function pwaStandalone(){try{
  return (window.matchMedia&&window.matchMedia('(display-mode:standalone)').matches)
      || (window.matchMedia&&window.matchMedia('(display-mode:fullscreen)').matches)
      || window.navigator.standalone===true;}catch(e){return false;}}
/* Headerns farg ska vara appens egen bakgrund, aven nar temat byts. */
/* Telefonens egen rotationslåsning gäller INTE installerade webbappar — de
   följer manifestets orientation. Därav att dashboarden vred sig trots att
   låset var på. Två åtgärder behövs: manifestet ska säga "portrait", och
   Screen Orientation API:t låser den flik som redan är öppen. Låset kräver
   helskärm eller standalone, så det misslyckas tyst i en vanlig flik. */
function lasPortratt(){
  if(CFG&&CFG.lasPortratt===false)return;
  try{
    var o=screen&&screen.orientation;
    if(o&&typeof o.lock==='function'){
      var p=o.lock('portrait');
      if(p&&p.catch)p.catch(function(){});   /* nekas utanför standalone */
    }
  }catch(e){}}
function cfgLas(pa){
  CFG.lasPortratt=!!pa;saveCfg();
  if(pa)lasPortratt();
  else{try{if(screen&&screen.orientation&&screen.orientation.unlock)screen.orientation.unlock();}catch(e){}}
  /* Manifestet byggs INTE om här. Att ändra det efter installationen får Chrome
     att vilja bygga om appen, och det var så adressfältet kom tillbaka. */
  openConfig();}
function syncThemeColor(){try{
  var bg=getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  if(!bg)return;
  var m=document.querySelector('meta[name="theme-color"]');
  if(!m){m=document.createElement('meta');m.name='theme-color';document.head.appendChild(m);}
  if(m.getAttribute('content')!==bg){
    m.setAttribute('content',bg);
    if(window.pwaBuildManifest)window.pwaBuildManifest();   /* manifestet bar samma farg */
  }
}catch(e){}}
/* Maskbar ikon: samma motiv men med 20% luft, sa Android inte klipper hornen. */
function pwaMakeMaskable(){try{
  var src=(document.querySelector('link[rel="apple-touch-icon"]')||{}).href;
  if(!src||window._pwaMask)return;
  var img=new Image();
  img.onload=function(){try{
    var c=document.createElement('canvas');c.width=c.height=512;
    var x=c.getContext('2d');
    var bg=getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()||'#2e3440';
    x.fillStyle=bg;x.fillRect(0,0,512,512);
    x.drawImage(img,51,51,410,410);
    window._pwaMask=c.toDataURL('image/png');
    if(window.pwaBuildManifest)window.pwaBuildManifest();
  }catch(e){}};
  img.src=src;
}catch(e){}}
/* Checklista: exakt vad Chrome ser. */
function pwaCheck(){
  /* isSecureContext saknas i aldre webbvyer - da avgors det pa adressen i stallet,
     efter samma regel som Chrome anvander: https, localhost eller loopback. */
  var sec;try{sec=window.isSecureContext;}catch(e){}
  if(typeof sec!=='boolean'){try{
    var hn=(location.hostname||'').replace(/^\[|\]$/g,'');
    sec=(location.protocol==='https:')||hn==='localhost'||hn==='127.0.0.1'||hn==='::1';
  }catch(e){sec=false;}}
  var sa=pwaStandalone();
  var link=document.querySelector('link[rel="manifest"]');
  var man=null;try{man=window._pwaManifest||null;}catch(e){}
  var ic=man?(man.icons||[]):[];
  var har192=false,har512=false;
  for(var i=0;i<ic.length;i++){
    if(ic[i].sizes==='192x192')har192=true;
    if(ic[i].sizes==='512x512')har512=true;}
  return {sec:sec, sa:sa, man:!!link, namn:!!(man&&man.name),
          ikon:(har192&&har512), disp:!!(man&&man.display==='standalone'),
          prompt:!!_deferredInstall, origin:(location.origin||''), proto:location.protocol};}
function pwaRows(){
  var c=pwaCheck();
  var ja='<span style="color:var(--ok,#a3be8c);font-weight:850">✓</span>';
  var nej='<span style="color:var(--hot,#bf616a);font-weight:850">✗</span>';
  var r=function(ok,t){return '<div>'+(ok?ja:nej)+' '+t+'</div>';};
  var h='';
  if(c.sa)return '<div style="color:var(--ok,#a3be8c);font-weight:800">Körs som app – adressfältet är borta.</div>';
  h+=r(c.sec,'Säker kontext ('+esc(c.proto.replace(':',''))+')');
  h+=r(c.man&&c.namn,'Manifest med namnet Dashboard');
  h+=r(c.ikon,'Ikoner 192 och 512 px');
  h+=r(c.disp,'Öppnas utan adressfält (standalone)');
  h+=r(c.prompt,'Chrome erbjuder installation');
  if(!c.sec){
    h+='<div style="margin-top:6px">Det är <b>bara</b> första punkten som fattas. Chrome installerar inte '
      +'sidor som nås över vanlig http mot ett lokalt namn eller IP. Tre vägar runt det:'
      +'<br>• nå dashboarden över <b>https</b> (Homeys molnadress fungerar direkt)'
      +'<br>• eller via <b>127.0.0.1</b>, som räknas som säker'
      +'<br>• eller lägg in <code>'+esc(c.origin)+'</code> i Chromes flagga '
      +'<code>#unsafely-treat-insecure-origin-as-secure</code> och starta om Chrome. '
      +'Flaggan sätts per telefon, så den måste sättas på just den enhet det gäller.'
      +'<br>Fram till dess ger <b>Helskärm</b> här ovanför samma intryck.</div>'
      +'<div style="margin-top:7px"><button class="te-alt" onclick="pwaCopyOrigin(this)">Kopiera adressen</button></div>';
  }else if(!c.prompt){
    h+='<div style="margin-top:6px">Allt annat är på plats. Chrome väntar ibland på att du '
      +'använt sidan en stund – annars går det via menyn ⋮ → <b>Lägg till på startskärmen</b> '
      +'eller <b>Installera app</b>. Ikonen heter <b>Dashboard</b>.</div>';
  }else{
    /* Allt grönt men adressfältet ändå kvar: då blev ikonen en genväg, inte en app.
       Skillnaden syns i Androids applista – en riktig app står med där, en genväg inte. */
    h+='<div style="margin-top:6px">Allt är klart för installation. Får du <b>ändå kvar adressfältet</b> '
      +'efter installationen blev ikonen en <b>genväg</b> och inte en app – vissa telefoner faller tillbaka på det. '
      +'Kolla under Androids <b>Inställningar → Appar</b>: står <b>Dashboard</b> i listan är det en riktig app, '
      +'saknas den är det en genväg. Ta då bort ikonen, ladda om sidan och välj <b>Installera app</b>, '
      +'inte <i>Skapa genväg</i>. Hjälper inte det brukar en riktig <code>manifest.webmanifest</code> '
      +'bredvid HTML-filen lösa det.</div>';
  }
  h+='<div style="margin-top:6px;opacity:.75">Manifest: '
    +(window._pwaFile?'<b>manifest.webmanifest</b> (fil bredvid sidan)':'inbäddat i sidan')+'.</div>';
  if(window._pwaFileFel){
    var F=window._pwaFileFel;
    h+='<div style="margin-top:6px;color:var(--warn)"><b>manifest.webmanifest används inte.</b> '
      +'Dess <code>start_url</code> pekar på <code>'+esc(F.pekar||'?')+'</code> men sidan ligger på '
      +'<code>'+esc(location.href.split('#')[0].split('?')[0])+'</code>. Öppnar appen fel adress '
      +'hamnar man i en vanlig flik med adressfält, så det inbäddade manifestet används i stället. '
      +'Rätta med antingen:<br>• döp om HTML-filen till <code>index.html</code>, eller '
      +'<br>• ändra i filen till <code>"start_url": "'+esc(F.borde)+'"</code> och '
      +'<code>"scope": "./"</code>.</div>';}
  return h;}
/* Kopierar adressen så den går att klistra in i Chrome-flaggan. Notera att
   navigator.clipboard kräver säker kontext – exakt det som saknas i det läge
   knappen behövs. Därför den gamla vägen via ett dolt fält först. */
function pwaCopyOrigin(btn){
  var t=location.origin||'', ok=false;
  try{
    var ta=document.createElement('textarea');
    ta.value=t;ta.setAttribute('readonly','');
    ta.style.cssText='position:fixed;top:-1000px;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();try{ta.setSelectionRange(0,t.length);}catch(e){}
    ok=document.execCommand('copy');
    document.body.removeChild(ta);
  }catch(e){}
  if(!ok){try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t);ok=true;}}catch(e){}}
  if(btn){var f=btn.textContent;btn.textContent=ok?'Kopierad':'Kunde inte kopiera';
    setTimeout(function(){try{btn.textContent=f;}catch(e){}},2200);}}
function installApp(){
  if(_deferredInstall){
    _deferredInstall.prompt();
    if(_deferredInstall.userChoice&&_deferredInstall.userChoice.finally)
      _deferredInstall.userChoice.finally(function(){_deferredInstall=null;try{openConfig();}catch(e){}});
    return;}
  try{openConfig();}catch(e){}
}
function stickyBars(){
  try{
    var bars=document.querySelectorAll('.view>.panel.statusbar');
    if(!bars.length)return;
    if(!window.IntersectionObserver)return;
    if(!_stickyObs)_stickyObs=new IntersectionObserver(function(es){
      for(var i=0;i<es.length;i++){
        var bar=es[i].target.nextElementSibling;
        if(bar&&bar.classList)bar.classList.toggle('stuck',!es[i].isIntersecting);
      }
    },{threshold:0});
    for(var i=0;i<bars.length;i++){
      var b=bars[i], sen=b.previousElementSibling;
      if(!sen||!sen.classList||!sen.classList.contains('sticky-sentinel')){
        sen=document.createElement('div');
        sen.className='sticky-sentinel';
        sen.setAttribute('aria-hidden','true');
        b.parentNode.insertBefore(sen,b);
      }
      _stickyObs.observe(sen);
    }
  }catch(e){}}

/* ===== Helskärm (döljer adressfältet) – fungerar även på vanlig HTTP i lokalnätet ===== */
function fsElement(){return document.fullscreenElement||document.webkitFullscreenElement||null;}
function isFullscreen(){return !!fsElement();}
function enterFullscreen(){try{var el=document.documentElement;var fn=el.requestFullscreen||el.webkitRequestFullscreen||el.webkitRequestFullScreen;if(fn){var r=fn.call(el);if(r&&r.catch)r.catch(function(){});}}catch(e){}}
function exitFullscreen(){try{var fn=document.exitFullscreen||document.webkitExitFullscreen;if(fn)fn.call(document);}catch(e){}}
function toggleFullscreen(){if(isFullscreen())exitFullscreen();else enterFullscreen();fsSync();}
function fsSync(){try{var b=document.getElementById('fs-btn');if(b)b.textContent=isFullscreen()?'Avsluta helskärm':'Helskärm nu';}catch(e){}}
/* Starta i helskärm: begär helskärm vid första tryck efter laddning (kräver en användargest). */
function cfgAutoFull(v){CFG.autoFull=(v==='on');saveCfg();if(CFG.autoFull)armAutoFull();}
function armAutoFull(){if(_autoFullArmed||!CFG.autoFull)return;_autoFullArmed=true;
  var once=function(){enterFullscreen();fsSync();document.removeEventListener('pointerdown',once);document.removeEventListener('touchend',once);};
  document.addEventListener('pointerdown',once,{once:true});document.addEventListener('touchend',once,{once:true});}
