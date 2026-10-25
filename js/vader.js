/* js/vader.js — Vädersidan: radarn, nederbördsprognosen, framskrivningen, synoptisk vy, fronterna och kartan i helskärm.
 *
 * Filen innehåller BARA funktionsdeklarationer. Konstanter, tillstånd och allt
 * som körs direkt vid laddning ligger i js/start.js, som laddas sist, under
 * rubriken [vader.js]. En funktion går att anropa oavsett vilken fil den står
 * i, men kod som körs vid laddning kan här anropa en funktion i en fil som inte
 * hunnit laddas. Lägg den därför aldrig här.
 */


/* Slippy-map-matematik: räknar ut vilka kartrutor som behövs och var hemmet hamnar. */
function osmGrid(lat,lon,z,W,H){
  var n=Math.pow(2,z),world=n*256;
  var px=(lon+180)/360*world;
  var la=lat*Math.PI/180;
  var py=(1-Math.log(Math.tan(la)+1/Math.cos(la))/Math.PI)/2*world;
  var x0=px-W/2,y0=py-H/2;
  var tx0=Math.floor(x0/256),ty0=Math.floor(y0/256);
  var tx1=Math.floor((x0+W-1)/256),ty1=Math.floor((y0+H-1)/256);
  var tiles=[];
  for(var tx=tx0;tx<=tx1;tx++)for(var ty=ty0;ty<=ty1;ty++){
    if(ty<0||ty>=n)continue;
    tiles.push({x:((tx%n)+n)%n,y:ty,z:z,left:Math.round(tx*256-x0),top:Math.round(ty*256-y0)});}
  return {tiles:tiles,W:W,H:H,
    xy:function(a,o){var p=(o+180)/360*world,r=a*Math.PI/180,
      q=(1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*world;return [p-x0,q-y0];}};
}
/* Färg efter vindstyrka (m/s) */
function windCol(ms){var P=PAL[curTheme]||PAL.dark;
  if(ms==null)return P.dim||P.blue;
  if(ms<3)return P.green; if(ms<6)return P.cyan; if(ms<9)return P.gold;
  if(ms<14)return P.warm; return P.hot||P.warm;}
/* En vindpil ritad pekande uppåt (norr) – roteras sedan till rätt riktning. */
function windArrowPath(len){var h=Math.max(4,len*0.28);
  return 'M0,'+(len/2)+' L0,'+(-len/2)+' M'+(-h*0.55)+','+(-len/2+h)+' L0,'+(-len/2)+' L'+(h*0.55)+','+(-len/2+h);}
/* Fylld vindpil (pekar uppåt innan rotation) – läses lättare på en karta än ett streck. */
function windArrowShape(len){
  var sw=Math.max(1.6,len*0.075), hl=len*0.40, hw=len*0.27, tail=len/2;
  return 'M'+(-sw)+','+tail+' L'+sw+','+tail+' L'+sw+','+(-tail+hl)
       +' L'+hw+','+(-tail+hl)+' L0,'+(-tail)+' L'+(-hw)+','+(-tail+hl)+' L'+(-sw)+','+(-tail+hl)+' Z';}
function radarFetch(){
  if(_radarBusy)return; if(Date.now()-_radarT<5*60000&&_radarPath)return;
  _radarBusy=true;
  try{
    fetch('https://api.rainviewer.com/public/weather-maps.json',{cache:'no-store'})
      .then(function(r){return r.json();})
      .then(function(j){
        var past=(j&&j.radar&&j.radar.past)||[];
        /* RainViewers FRIA API ger sedan en tid bara historik. Nowcast ligger
           numera bakom en API-nyckel, och nowcast-listan kommer tom — det är
           därför tidslinjen slutar vid "nu". Koden läser fältet ändå: kommer
           det tillbaka, eller läggs en nyckel till, dyker stegen upp av sig
           själva och bildtexten byter formulering.
           Kontrollerat 2026-08-23 mot rainviewer/rainviewer-api-example:
           personbruk ger zoom ≤ 7, färgskala Universal Blue, PNG, endast
           historik. Attribution är obligatorisk och står i bildtexten. */
        var soon=(j&&j.radar&&j.radar.nowcast)||[];
        _radarFrames=past.concat(soon);
        _radarNow=Math.max(0,past.length-1);
        _radarIdx=_radarNow;
        var last=past.length?past[past.length-1]:null;
        _radarPath=(last&&last.path)||null;
        if(j&&j.host)_radarHost=(''+j.host).replace(/\/$/,'');
        _radarT=Date.now();_radarFail=!_radarPath;_radarBusy=false;
        /* Ny bildruta = ny rörelse att mäta. framMat() har egen nyckelvakt och
           gör ingenting om den redan mätt just den här rutan. */
        try{framMat();}catch(e){}
        /* BARA OM DET FINNS EN BILD. Utan bild är _radarPath null, och då
           hämtar renderVader → radarFetch genast igen (spärren ovan släpper
           igenom när _radarPath saknas) → renderVader … i en oändlig slinga.
           Det hände inte så länge RainViewer svarade med bilder, men ett svar
           utan radar.past räckte för att låsa sidan. */
        try{if(_radarPath&&document.getElementById('vdr-body')&&wxShow()!=='tryck')renderVader();}catch(e){}
      },function(){_radarBusy=false;_radarFail=true;_radarT=Date.now();});
  }catch(e){_radarBusy=false;_radarFail=true;}
}
function radarVy(){
  if(_wxFull&&_wxFullW>0&&_wxFullH>0)
    return {lat:RADAR_VIEW.lat,lon:RADAR_VIEW.lon,W:_wxFullW,H:_wxFullH};
  return RADAR_VIEW;
}
function radarViewZ(){
  if(CFG&&CFG.radarViewZv!==2){
    CFG.radarViewZv=2;
    if(CFG.radarViewZ!=null)delete CFG.radarViewZ;
    try{saveCfg();}catch(e){}
  }
  var z=(CFG&&CFG.radarViewZ);return (z>=6&&z<=9)?z:WX_VIEW_Z;}
function radarSetViewZ(d){var z=radarViewZ()+d;if(z<6||z>9)return;CFG.radarViewZ=z;saveCfg();renderVader();}
function radarTileUrl(t,path){return _radarHost+(path||_radarPath)+'/256/'+t.z+'/'+t.x+'/'+t.y+'/2/1_1.png';}
/* Rutorna för en given bildruta. Geometrin är densamma varje gång, så vid
   spolning byts bara adresserna ut – kartan under ritas aldrig om. */
function radarLayerHTML(path){
  var Z=radarViewZ(), rz=Math.min(Z,RADAR_MAX_Z), VW=radarVy();
  var tiles=(rz===Z)?osmGrid(VW.lat,VW.lon,Z,VW.W,VW.H).tiles.map(function(t){
                       return {x:t.x,y:t.y,z:t.z,left:t.left,top:t.top,size:256};})
                   :osmGridScaled(VW.lat,VW.lon,Z,VW.W,VW.H,rz);
  var o='';
  for(var i=0;i<tiles.length;i++){var t=tiles[i];
    o+='<image href="'+radarTileUrl(t,path)+'" x="'+t.left.toFixed(0)+'" y="'+t.top.toFixed(0)+'" width="'+t.size.toFixed(0)+'" height="'+t.size.toFixed(0)+'"/>';}
  return o;}

/* Kartans hörn i grader. Samma projektion som kartrutorna använder, baklänges,
   så att fälten hamnar där de ska även när man zoomar. */
function prgRutnat(){
  var Z=radarViewZ(),VW=radarVy();
  var n=Math.pow(2,Z),world=n*256;
  var px=(VW.lon+180)/360*world;
  var la=VW.lat*Math.PI/180;
  var py=(1-Math.log(Math.tan(la)+1/Math.cos(la))/Math.PI)/2*world;
  var lon=function(x){return x/world*360-180;};
  var lat=function(y){return Math.atan(Math.sinh(Math.PI*(1-2*y/world)))*180/Math.PI;};
  var v=lon(px-VW.W/2), o=lon(px+VW.W/2), no=lat(py-VW.H/2), sy=lat(py+VW.H/2);
  var lats=[],lons=[];
  for(var r=0;r<PRG_N;r++)for(var c=0;c<PRG_N;c++){
    /* Tre decimaler racker: ~110 m i latitud, och modellen har 2 km rutor.
       Varje extra decimal kostar 289 tecken i adressen. */
    lats.push((no+(sy-no)*r/(PRG_N-1)).toFixed(3));
    lons.push((v+(o-v)*c/(PRG_N-1)).toFixed(3));
  }
  return {lats:lats,lons:lons,z:Z,ram:VW.W+'x'+VW.H};
}
function prgHamta(){
  if(_prgBusy)return;
  var Z=radarViewZ(), VW=radarVy(), ram=VW.W+'x'+VW.H;
  /* Zoomar man om måste rutnätet hämtas på nytt - punkterna sitter i kartan.
     Detsamma gäller när ramen byter form: helskärmen täcker en annan yta än
     kortet, och ett rutnät hämtat för den ena sträcks fel över den andra. */
  if(_prgZ===Z&&_prgRam===ram&&_prgAt&&Date.now()-_prgAt<20*60000&&_prgVal)return;
  _prgBusy=true;
  var g=prgRutnat();
  /* Punkterna delas i klumpar. Ordningen måste bevaras - svaren sätts ihop i
     samma följd som frågorna, annars hamnar regnet på fel plats. */
  var bitar=[];
  for(var b=0;b<g.lats.length;b+=PRG_KLUMP){
    bitar.push('https://api.open-meteo.com/v1/forecast?latitude='
      +g.lats.slice(b,b+PRG_KLUMP).join(',')
      +'&longitude='+g.lons.slice(b,b+PRG_KLUMP).join(',')
      +'&hourly=precipitation&past_days='+PRG_BAK+'&forecast_days='+PRG_FRAM
      +'&models=dmi_seamless&timeformat=unixtime&timezone=UTC');
  }
  var url=bitar[0];
  /* Adressens langd mats innan den skickas. Blir den for lang ar det battre
     att saga det an att skicka nagot som tyst avvisas. */
  if(url.length>7000){_prgFel='rutnatet ger en for lang adress ('+url.length+' tecken)';
    _prgBusy=false;_prgAt=Date.now();return;}
  try{
    Promise.all(bitar.map(function(u){
      return fetch(u,{cache:'no-store'}).then(function(r){
        if(!r.ok)throw new Error('HTTP '+r.status);
        return r.json();
      });
    })).then(function(svar){
      /* Flera positioner ger en LISTA; en position ger ett objekt. Båda
         hanteras, annars går det sönder den dag rutnätet krymps. */
      var j=[];
      svar.forEach(function(x){j=j.concat(Array.isArray(x)?x:[x]);});
      var lista=j;
      if(!lista.length||!lista[0]||!lista[0].hourly){_prgFel='oväntat svar';_prgBusy=false;_prgAt=Date.now();return;}
      _prgTid=(lista[0].hourly.time||[]).map(function(t){return t*1000;});
      _prgVal=lista.map(function(x){return (x&&x.hourly&&x.hourly.precipitation)||[];});
      _prgPkt=g;_prgZ=g.z;_prgRam=g.ram;_prgAt=Date.now();_prgFel=null;_prgBusy=false;
      try{if(document.getElementById('vdr-body'))renderVader();}catch(e){}
    },function(e){_prgFel=(e&&e.message)||'kunde inte nå Open-Meteo';_prgBusy=false;_prgAt=Date.now();});
  }catch(e){_prgBusy=false;_prgFel=String(e&&e.message);}
}
function prgVarde(i,ti){
  var v=_prgVal&&_prgVal[i];
  return (v&&v[ti]!=null&&isFinite(v[ti]))?v[ti]:0;
}
/* Färgtrappa i mm/h, tagen ur radarns egen förklaring så att samma regnmängd
   får samma färg oavsett vilken källa rutan kommer från. */
function prgFarg(mm){
  if(mm<0.3)return '#00a3e0';
  if(mm<1)return '#0077aa';
  if(mm<2.5)return '#ffee00';
  if(mm<5)return '#ffaa00';
  if(mm<10)return '#ff4400';
  if(mm<20)return '#c10000';
  return '#ffaaff';
}
/* SOM RADARN, ALLTSÅ SOM EN BILD.
   Färgade rektanglar blir fyrkanter hur man än vänder på dem - det är vad en
   rektangel är. Radarn ser mjuk ut för att den är en BILD som webbläsaren
   skalar upp med utjämning mellan bildpunkterna. Prognosen ritas därför som en
   17x17 bildpunkter liten PNG som sträcks över kartan: utjämningen sköts av
   webbläsaren, gratis och likadant som för radarrutorna.
   Genomskinligheten ligger i bildpunkten, så även kanterna mot uppehåll tonar
   ut i stället för att sluta tvärt. */
function prgHexRgb(h){
  return [parseInt(h.substr(1,2),16),parseInt(h.substr(3,2),16),parseInt(h.substr(5,2),16)];
}
/* Bildpunkterna som ren data, så att de går att prova utan en canvas. */
function prgPixlar(ti){
  var ut=new Array(PRG_N*PRG_N*4);
  for(var i=0;i<PRG_N*PRG_N;i++){
    var mm=prgVarde(i,ti), k=i*4;
    if(mm<0.02){ut[k]=0;ut[k+1]=0;ut[k+2]=0;ut[k+3]=0;continue;}
    var rgb=prgHexRgb(prgFarg(mm));
    ut[k]=rgb[0];ut[k+1]=rgb[1];ut[k+2]=rgb[2];
    /* Radarrutorna är mättade och nästan ogenomskinliga. Modellen såg blek ut
       vid sidan av dem; golvet är höjt så att lätt regn syns och taket lagt
       nära fullt. */
    ut[k+3]=Math.round(255*Math.max(0.55,Math.min(0.96,0.55+mm*0.12)));
  }
  return ut;
}
function prgTom(px){
  for(var i=3;i<px.length;i+=4)if(px[i]>0)return false;
  return true;
}
function prgLagerHTML(ti){
  if(!_prgPkt||!_prgTid.length||ti==null)return '';
  var px=prgPixlar(ti);
  if(prgTom(px))return '';
  var VW=radarVy(), cw=VW.W/(PRG_N-1), ch=VW.H/(PRG_N-1);
  var url=null;
  try{
    var cv=document.createElement('canvas');cv.width=PRG_N;cv.height=PRG_N;
    var cx=cv.getContext&&cv.getContext('2d');
    if(cx){
      var im=cx.createImageData(PRG_N,PRG_N);
      for(var i=0;i<px.length;i++)im.data[i]=px[i];
      cx.putImageData(im,0,0);
      url=cv.toDataURL('image/png');
    }
  }catch(e){url=null;}
  /* Bilden läggs ut så att varje bildpunkts MITT hamnar på sin koordinat,
     därför den halva cellens överhäng åt alla håll. */
  if(url){
    return '<image href="'+url+'" x="'+(-cw/2).toFixed(1)+'" y="'+(-ch/2).toFixed(1)+'" '
      +'width="'+(VW.W+cw).toFixed(1)+'" height="'+(VW.H+ch).toFixed(1)+'" '
      +'preserveAspectRatio="none" style="image-rendering:auto"/>';
  }
  /* Utan canvas ritas rutor. Fult, men bättre än en tom karta. */
  var o='';
  for(var r=0;r<PRG_N;r++)for(var c=0;c<PRG_N;c++){
    var mm=prgVarde(r*PRG_N+c,ti);
    if(mm<0.02)continue;
    o+='<rect x="'+((c*cw)-cw/2).toFixed(1)+'" y="'+((r*ch)-ch/2).toFixed(1)+'" '
      +'width="'+(cw+0.6).toFixed(1)+'" height="'+(ch+0.6).toFixed(1)+'" fill="'+prgFarg(mm)+'"/>';
  }
  return o;
}

/* Blockmatchning. Söker den förskjutning (dx,dy) som gör bild B mest lik bild
   A, mätt som MEDELbeloppsfel över den del som överlappar. Medelvärde och inte
   summa: annars vinner stora förskjutningar bara för att färre punkter jämförs.
   Varannan punkt räcker — fältet är mjukt och det går fyra gånger fortare. */
function framMatcha(a,b,W,H,max){
  var bast=null,noll=null,dx,dy,x,y;
  for(dy=-max;dy<=max;dy++){
    for(dx=-max;dx<=max;dx++){
      var y0=Math.max(0,-dy),y1=Math.min(H,H-dy);
      var x0=Math.max(0,-dx),x1=Math.min(W,W-dx);
      var sum=0,n=0;
      for(y=y0;y<y1;y+=2){
        var ra=y*W, rb=(y+dy)*W+dx;
        for(x=x0;x<x1;x+=2){sum+=Math.abs(a[ra+x]-b[rb+x]);n++;}
      }
      if(n<(W*H)/8)continue;
      var v=sum/n;
      if(dx===0&&dy===0)noll=v;
      if(bast==null||v<bast.v)bast={dx:dx,dy:dy,v:v};
    }
  }
  if(!bast)return null;
  /* Kvoten säger hur mycket bättre den bästa förskjutningen är än att inte
     flytta alls. Ligger den nära 1 har mätningen inte hittat någon rörelse —
     då är det ärligare att inte påstå en riktning än att påstå en svag. */
  bast.noll=noll;
  bast.kvot=(noll!=null&&noll>0)?(bast.v/noll):1;
  return bast;
}
/* Hur stor del av rutan som har eko alls. */
function framTackning(a){
  var n=0;
  for(var i=0;i<a.length;i++)if(a[i]>16)n++;
  return a.length?n/a.length:0;
}
/* Ritar en radarbild i en liten ruta och lämnar tillbaka genomskinligheten som
   ett gråskalefält. Alfakanalen är noll där det inte regnar, så den duger som
   intensitet utan att färgskalan behöver tolkas. */
function framRitaRuta(path){
  return new Promise(function(klar,fel){
    var Z=radarViewZ(), rz=Math.min(Z,RADAR_MAX_Z), VW=radarVy();
    var tiles=(rz===Z)?osmGrid(VW.lat,VW.lon,Z,VW.W,VW.H).tiles.map(function(t){
                         return {x:t.x,y:t.y,z:t.z,left:t.left,top:t.top,size:256};})
                     :osmGridScaled(VW.lat,VW.lon,Z,VW.W,VW.H,rz);
    if(!tiles.length){fel(new Error('inga kartrutor'));return;}
    var sk=FRAM_RUT/VW.W, cv, ctx;
    try{cv=document.createElement('canvas');cv.width=FRAM_RUT;cv.height=FRAM_RUT;ctx=cv.getContext('2d');}
    catch(e){fel(new Error('ingen canvas'));return;}
    if(!ctx){fel(new Error('ingen canvas'));return;}
    var kvar=tiles.length, klart=false;
    var vakt=setTimeout(function(){if(!klart){klart=true;fel(new Error('rutorna hann inte hämtas'));}},8000);
    tiles.forEach(function(t){
      var im=new Image();
      /* Utan det här blir canvasen "tainted" och getImageData kastar. */
      im.crossOrigin='anonymous';
      im.onload=function(){try{ctx.drawImage(im,t.left*sk,t.top*sk,t.size*sk,t.size*sk);}catch(e){} klarRuta();};
      im.onerror=function(){klarRuta();};
      im.src=radarTileUrl(t,path);
    });
    function klarRuta(){
      if(--kvar>0||klart)return;
      klart=true;clearTimeout(vakt);
      var d;
      try{d=ctx.getImageData(0,0,FRAM_RUT,FRAM_RUT).data;}
      catch(e){fel(new Error('kartrutorna får inte läsas (CORS)'));return;}
      var a=new Uint8Array(FRAM_RUT*FRAM_RUT);
      for(var i=0,q=3;i<a.length;i++,q+=4)a[i]=d[q];
      klar(a);
    }
  });
}
/* Mäter rörelsen ur de tre senaste MÄTTA bilderna. Nyckeln gör att samma
   bildruta aldrig mäts två gånger — mätningen laddar rutorna på nytt och ska
   köras en gång per radaruppdatering, inte en gång per omritning. */
function framMat(){
  if(_framBusy||typeof Promise==='undefined')return;
  var n=Math.min(_radarNow,_radarFrames.length-1);
  if(!(n>=1))return;
  var lista=[];
  if(n>=2)lista.push(_radarFrames[n-2]);
  lista.push(_radarFrames[n-1]);lista.push(_radarFrames[n]);
  lista=lista.filter(function(f){return f&&f.time&&f.path;});
  if(lista.length<2)return;
  var nyckel=radarViewZ()+':'+lista[lista.length-1].time;
  if(_framNyckel===nyckel)return;
  _framNyckel=nyckel;_framBusy=true;
  var vyW=radarVy().W;
  Promise.all(lista.map(function(f){return framRitaRuta(f.path);})).then(function(bild){
    var par=[];
    for(var i=1;i<bild.length;i++){
      var tk=framTackning(bild[i]);
      if(tk<FRAM_MINTACK||tk>FRAM_MAXTACK)continue;
      var m=framMatcha(bild[i-1],bild[i],FRAM_RUT,FRAM_RUT,FRAM_SOK);
      if(!m||m.kvot>FRAM_KVOT)continue;
      var minuter=(lista[i].time-lista[i-1].time)/60;
      if(!(minuter>0))continue;
      par.push({dx:m.dx/minuter,dy:m.dy/minuter,kvot:m.kvot});
    }
    if(!par.length){_framFlt=null;_framFel='ingen tydlig rörelse i radarn';_framBusy=false;framOmRita();return;}
    if(par.length>1){
      var a1=par[par.length-2],a2=par[par.length-1];
      var skild=Math.sqrt((a1.dx-a2.dx)*(a1.dx-a2.dx)+(a1.dy-a2.dy)*(a1.dy-a2.dy));
      var langd=(Math.sqrt(a1.dx*a1.dx+a1.dy*a1.dy)+Math.sqrt(a2.dx*a2.dx+a2.dy*a2.dy))/2;
      if(skild>FRAM_SPRID*langd+0.3){
        _framFlt=null;_framFel='rörelsen pekar åt olika håll mellan bilderna';
        _framBusy=false;framOmRita();return;
      }
    }
    var sx=0,sy=0,sk=0;
    par.forEach(function(p){sx+=p.dx;sy+=p.dy;sk+=p.kvot;});
    /* Mätrutan är FRAM_RUT bred och vyn vyW. Vektorn räknas om till vyns
       bildpunkter redan här, så resten av koden slipper veta att mätningen
       gjordes i en mindre ruta.
       vyW fångades INNAN bilderna ritades: öppnas helskärmen medan hämtningen
       pågår byter radarVy() bredd, och då hade omräkningen skett med en annan
       ram än den som mättes. En bildpunkt i vyn är samma sak som en
       kartrutepunkt oavsett ram, så vektorn gäller i båda lägena. */
    var k=vyW/FRAM_RUT;
    _framFlt={dx:(sx/par.length)*k,dy:(sy/par.length)*k,kvot:sk/par.length,
              par:par.length,z:radarViewZ(),at:Date.now()};
    _framFel=null;_framBusy=false;framOmRita();
  },function(e){
    _framFlt=null;_framFel=(e&&e.message)||'mätningen misslyckades';_framBusy=false;framOmRita();
  });
}
function framOmRita(){
  try{if(document.getElementById('vdr-body')&&wxShow()!=='tryck')renderVader();}catch(e){}
}
/* Mätningen gäller bara den skala den gjordes i, och bara en kort stund. */
function framFlode(){
  var f=_framFlt;
  if(!f)return null;
  if(f.z!==radarViewZ())return null;
  if(Date.now()-f.at>FRAM_ALDER)return null;
  return f;
}
/* Åt vilket håll nederbörden rör sig, i kompassgrader. */
function framRiktning(){
  var f=framFlode();
  if(f)return ((Math.atan2(f.dx,-f.dy)*180/Math.PI)+360)%360;
  var deg=windDeg();
  return (deg==null)?null:((deg+180)%360);
}
function framFaktor(){
  var v=CFG&&CFG.framFaktor;
  return (typeof v==='number'&&isFinite(v))?Math.max(0.6,Math.min(2.5,v)):FRAM_STEG_DEF;
}

function framMpp(){
  return 156543.03392*Math.cos(radarVy().lat*Math.PI/180)/Math.pow(2,radarViewZ());
}
/* measure_wind_angle ar riktningen vinden kommer IFRAN, sa rorelsen gar at
   motsatt hall. 0 grader ar nordlig vind, alltsa rorelse soderut. */
function framForskjut(min){
  /* MÄTNINGEN FÖRST. _framFlt är bildpunkter i vyn per minut, så förskjutningen
     är en ren multiplikation — ingen vindfaktor, för det är inte vinden som
     mäts utan nederbördens egen rörelse. */
  var f=framFlode();
  if(f){
    var dx=f.dx*min, dy=f.dy*min;
    return {dx:dx, dy:dy, m:Math.sqrt(dx*dx+dy*dy)*framMpp(), kalla:'radar'};
  }
  /* RESERV: markvinden, som förut. Används när radarbilderna inte gick att
     läsa eller inte visade någon tydlig rörelse.
     vindMs och inte cap: framskrivningen flyttar bilden ms * sekunder METER.
     Med det råa värdet, som är km/h, blev förflyttningen 3,6 gånger för lång —
     tio minuter framåt såg ut som trettiosex. */
  var deg=windDeg(), ms=vindMs();
  if(deg==null||ms==null||!isFinite(ms)||ms<=0)return null;
  var mot=(deg+180)*Math.PI/180;
  var m=ms*framFaktor()*min*60;
  var mpp=framMpp();
  return {dx:(m*Math.sin(mot))/mpp, dy:(-m*Math.cos(mot))/mpp, m:m, kalla:'vind'};
}
function framGar(){return framForskjut(10)!==null&&_radarFrames.length>0;}
/* Vilken källa framskrivningen faktiskt vilar på. Står i klartext i kartan:
   utan det går det inte att se om mätningen lyckades eller om vi kört på
   vinden hela tiden — och det är just det som inte gick att pröva härifrån. */
function framKallaText(){
  var f=framForskjut(10);
  if(!f)return '';
  if(f.kalla==='radar')return 'i den riktning radarn visar att den rört sig';
  return 'längs vindriktningen'+(_framFel?' \u2013 rörelsen gick inte att mäta: '+esc(_framFel):'');
}
/* Bilden flyttas som helhet. Inga bildpunkter lases, inget ritas om. */
function framLagerHTML(min){
  var f=framForskjut(min);
  if(!f)return '';
  var sista=_radarFrames[_radarNow]||_radarFrames[_radarFrames.length-1];
  if(!sista)return '';
  return '<g transform="translate('+f.dx.toFixed(1)+','+f.dy.toFixed(1)+')">'
    +radarLayerHTML(sista.path)+'</g>';
}

/* ---- EN TIDSLINJE ---- */
function wxRutor(){
  var ut=[],i;
  for(i=0;i<_radarFrames.length;i++){
    var f=_radarFrames[i];
    if(!f||!f.time)continue;
    ut.push({t:f.time*1000,typ:(i<=_radarNow?'radar':'nowcast'),path:f.path,ri:i});
  }
  /* Egna framskrivningssteg efter den senast matta bilden. */
  var sista=_radarFrames[_radarNow]||_radarFrames[_radarFrames.length-1];
  if(sista&&framGar()){
    for(i=0;i<FRAM_STEG.length;i++){
      ut.push({t:sista.time*1000+FRAM_STEG[i]*60000,typ:'fram',min:FRAM_STEG[i]});
    }
  }
  ut.sort(function(a,b){return a.t-b.t;});
  return ut;
}
function wxNarmast(rutor,t){
  var b=0,d=Infinity;
  for(var i=0;i<rutor.length;i++){var x=Math.abs(rutor[i].t-t);if(x<d){d=x;b=i;}}
  return b;
}
function wxNuIdx(rutor){return wxNarmast(rutor,Date.now());}
function wxRutaNu(){
  var r=wxRutor();if(!r.length)return null;
  _wxIdx=wxNarmast(r,_wxT==null?Date.now():_wxT);
  return r[_wxIdx];}
function wxKlocka(t){
  return new Intl.DateTimeFormat('sv-SE',{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(t));
}
/* "nu" galler bara MATTA rutor. En framskriven ruta kan ligga fa minuter fram
   - senaste radarbilden ar ofta nagra minuter gammal - och kallades da "nu",
   vilket ar direkt vilseledande: den visar nagot som inte hant an. */
function wxRel(t,typ){
  var m=Math.round((t-Date.now())/60000);
  if(typ!=='fram'&&Math.abs(m)<8)return 'nu';
  if(typ==='fram'&&m<1)return '+1 min';
  if(Math.abs(m)<100)return (m>0?'+':'')+m+' min';
  return (m>0?'+':'')+Math.round(m/60)+' h';
}
/* KÄLLA OCH TIDSRIKTNING ÄR TVÅ OLIKA SAKER.
   Modelltimmar bakåt är historik, inte prognos - de märktes fel eftersom
   etiketten satt på källan. Nu avgör klockan om det är bakåt eller framåt, och
   källan säger bara varifrån bilden kommer. */
function wxKalla(f){
  if(f.typ==='radar')return 'radar';
  if(f.typ==='nowcast')return 'radarprognos';
  if(f.typ==='fram')return 'framskrivning';
  return 'radar';
}
function wxSetIdx(i){
  var rutor=wxRutor();if(!rutor.length)return;
  _wxIdx=Math.max(0,Math.min(rutor.length-1,i));
  var f=rutor[_wxIdx];
  _wxT=f.t;
  var g=document.getElementById('wx-radar');
  if(f.typ==='fram'){
    if(g)g.innerHTML=framLagerHTML(f.min);
  }else{
    if(g)g.innerHTML=radarLayerHTML(f.path);
    _radarIdx=f.ri;
  }
  var lab=document.getElementById('wx-rtime');
  if(lab){
    lab.textContent=wxKlocka(f.t)+' · '+wxRel(f.t,f.typ)+' · '+wxKalla(f);
    /* Gult betyder BERÄKNAD FRAMTID. Modellens historiktimmar är beräknade men
       inte framtid, och ska inte se ut som en prognos. */
    lab.classList.toggle('fc',f.typ!=='radar'&&f.t>Date.now());
  }
  var sl=document.getElementById('wx-rslider');if(sl&&+sl.value!==_wxIdx)sl.value=_wxIdx;
  wxNuKnapp();
}
function wxSteg(d){radarStop();var r=wxRutor();wxSetIdx(wxNarmast(r,_wxT==null?Date.now():_wxT)+d);}
/* TILLBAKA TILL NU. _wxT = null betyder "följ klockan": kartan står kvar på
   nuet även när nya rutor kommer in, precis som när sidan öppnas. */
function wxTillNu(){
  radarStop();
  var r=wxRutor();if(!r.length)return;
  wxSetIdx(wxNuIdx(r));
  _wxT=null;
  wxNuKnapp();
}
function wxNuKnapp(){var b=document.getElementById('wx-rnu');if(b)b.disabled=(_wxT==null);}
function radarFrame(){return _radarFrames[_radarIdx]||null;}
function radarClock(i){var f=_radarFrames[i];if(!f||!f.time)return '';
  var d=new Date(f.time*1000);
  return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);}
function radarRel(i){var d=(i-_radarNow)*10;
  return d===0?'nu':(d>0?'+'+d+' min (prognos)':d+' min');}
/* Byter bildruta utan att rendera om sidan. */
function radarSetIdx(i){
  if(!_radarFrames.length)return;
  _radarIdx=Math.max(0,Math.min(_radarFrames.length-1,i));
  var g=document.getElementById('wx-radar');
  if(!g){radarStop();return;}
  var f=radarFrame(); if(f)g.innerHTML=radarLayerHTML(f.path);
  var lab=document.getElementById('wx-rtime');
  if(lab)lab.textContent=radarClock(_radarIdx)+' · '+radarRel(_radarIdx);
  var sl=document.getElementById('wx-rslider'); if(sl&&+sl.value!==_radarIdx)sl.value=_radarIdx;
  if(lab)lab.classList.toggle('fc',_radarIdx>_radarNow);   /* prognos, inte mätt */
}
function radarStep(d){radarStop();radarSetIdx(_radarIdx+d);}
function radarStop(){if(_radarTimer){clearInterval(_radarTimer);_radarTimer=null;}
  var b=document.getElementById('wx-rplay'); if(b)b.textContent='▶';}
function radarPlay(){
  if(_radarTimer){radarStop();return;}
  if(wxRutor().length<2)return;
  var b=document.getElementById('wx-rplay'); if(b)b.textContent='❚❚';
  _radarTimer=setInterval(function(){
    if(!document.getElementById('wx-radar')){radarStop();return;}   /* sidan bytt */
    var r=wxRutor(); if(!r.length){radarStop();return;}
    var n=wxNarmast(r,_wxT==null?Date.now():_wxT)+1; if(n>=r.length)n=0;
    wxSetIdx(n);
  },650);}
/* Samma geografiska yta som kartan, men rutor från en lägre (stödd) zoomnivå
   som ritas uppskalade. Radardata är ändå ~1 km upplöst, så det tappar inget. */
function osmGridScaled(lat,lon,z,W,H,tz){
  var scale=Math.pow(2,z-tz),n=Math.pow(2,tz),world=n*256;
  var px=(lon+180)/360*world, la=lat*Math.PI/180;
  var py=(1-Math.log(Math.tan(la)+1/Math.cos(la))/Math.PI)/2*world;
  var vw=W/scale, vh=H/scale, x0=px-vw/2, y0=py-vh/2;
  /* Intervallet räknas ut ur hörnen direkt – med skalade (ofta brutna) vyer
     missar en avrundning nedåt annars den understa rutraden. */
  var tx0=Math.floor(x0/256), ty0=Math.floor(y0/256);
  var tx1=Math.floor((x0+vw)/256), ty1=Math.floor((y0+vh)/256);
  var out=[];
  for(var tx=tx0;tx<=tx1;tx++)for(var ty=ty0;ty<=ty1;ty++){
    if(ty<0||ty>=n)continue;
    out.push({x:((tx%n)+n)%n,y:ty,z:tz,left:(tx*256-x0)*scale,top:(ty*256-y0)*scale,size:256*scale});}
  return out;}
/* Gamla sparade lägen ('radar' och 'ren') hamnar i den sammanslagna vyn. */
function wxShow(){var v=CFG&&CFG.wxMapShow;return (v==='tryck')?'tryck':'vind';}
/* Färgerna är RainViewers "Universal Blue" (färgschema 2 i rut-adressen).
   Stoppen nedan är hämtade ur RainViewers egen färgtabell och placerade
   efter dBZ 15–65: blått upp till 34 dBZ, sedan hoppar skalan till gult,
   och rosa/vitt högst upp. Snö har en egen blå skala eftersom rutorna
   begärs med snöfärger påslagna ("1_1" sist i adressen). */
function wxRainLegend(){
  var regn='linear-gradient(90deg,#88ddee 0%,#00a3e0 10%,#0077aa 20%,#005588 30%,#004768 38%,'
          +'#ffee00 40%,#ffaa00 50%,#ff4400 60%,#c10000 70%,#ffaaff 80%,#ff77ff 90%,#fff 100%)';
  var sno='linear-gradient(90deg,#9fdfff 0%,#7fbfff 10%,#5f9fff 20%,#4f8fff 30%,#2f6fff 50%,'
         +'#0f4fff 70%,#002fff 90%,#001fff 100%)';
  return '<div class="wxm-leg">'
    +'<div class="wxm-leg-r"><span class="wxm-leg-n">Regn</span>'
    +'<span class="wxm-leg-b" style="background:'+regn+'"></span></div>'
    +'<div class="wxm-leg-x"><span>duggregn</span><span>måttligt</span><span>kraftigt</span><span>skyfall</span></div>'
    +'<div class="wxm-leg-r"><span class="wxm-leg-n">Snö</span>'
    +'<span class="wxm-leg-b" style="background:'+sno+'"></span></div>'
    +'<div class="wxm-leg-x"><span>lätt</span><span>tätt snöfall</span></div>'
    +'</div>';}
function wxToggleInfo(){_wxInfo=!_wxInfo;
  var e=document.getElementById('wxm-cap'); if(e)e.style.display=_wxInfo?'':'none';
  var b=document.getElementById('wxm-i'); if(b)b.classList.toggle('on',_wxInfo);}
function wxSetShow(v){CFG.wxMapShow=v;saveCfg();renderVader();}
/* Stall vindfaktorn och se resultatet direkt. Steget ar 0,1 - mindre an sa
   syns inte, storre hoppar over det ratta vardet. */
function framFaktorStep(d){
  CFG.framFaktor=Math.round(Math.max(0.6,Math.min(2.5,framFaktor()+d))*10)/10;
  saveCfg();renderVader();
  var n=$('fram-f');if(n)n.textContent=framFaktor().toFixed(1);
}
function framFaktorAter(){CFG.framFaktor=FRAM_STEG_DEF;saveCfg();renderVader();
  var n=$('fram-f');if(n)n.textContent=framFaktor().toFixed(1);}
function wxTileUrl(t){return 'https://tile.openstreetmap.org/'+t.z+'/'+t.x+'/'+t.y+'.png';}
function wxAttr(){var a='© OpenStreetMap';
  if(wxShow()!=='tryck'&&_radarPath)a+=' · nederbörd RainViewer';
  if(wxShow()==='tryck')a+=' · tryck Open-Meteo';
  return a;}
function synFetch(){
  if(_synBusy)return;
  if(_synGrid&&Date.now()-_synT<20*60000)return;
  if(_synFail&&Date.now()-_synT<2*60000)return;
  _synBusy=true;
  var lats=[],lons=[];
  for(var iy=0;iy<SYN_N;iy++)for(var ix=0;ix<SYN_N;ix++){
    lats.push((SYN_BOX.s+(SYN_BOX.n-SYN_BOX.s)*iy/(SYN_N-1)).toFixed(3));
    lons.push((SYN_BOX.w+(SYN_BOX.e-SYN_BOX.w)*ix/(SYN_N-1)).toFixed(3));}
  var url='https://api.open-meteo.com/v1/forecast?latitude='+lats.join(',')+'&longitude='+lons.join(',')
    +'&current=pressure_msl,temperature_2m,wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=UTC';
  try{
    fetch(url,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      var arr=Array.isArray(j)?j:[j],g=[];
      for(var i=0;i<arr.length;i++){var o=arr[i],c=o&&o.current;
        g.push({lat:o.latitude,lon:o.longitude,p:(c&&c.pressure_msl!=null)?c.pressure_msl:null,
                t:(c&&c.temperature_2m!=null)?c.temperature_2m:null,
                ws:(c&&c.wind_speed_10m!=null)?c.wind_speed_10m:null,wd:(c&&c.wind_direction_10m!=null)?c.wind_direction_10m:null});}
      var ok=false;for(var k=0;k<g.length;k++)if(g[k].p!=null)ok=true;
      _synGrid=ok?g:null;_synFail=!ok;_synT=Date.now();_synBusy=false;
      try{if(document.getElementById('vdr-body')&&wxShow()==='tryck')renderVader();}catch(e){}
    },function(){_synBusy=false;_synFail=true;_synT=Date.now();});
  }catch(e){_synBusy=false;_synFail=true;_synT=Date.now();}
}
/* Rutnätet som matris: rad 0 = sydligast (så som punkterna beställdes) */
function synMatrix(){
  if(!_synGrid||_synGrid.length<SYN_N*SYN_N)return null;
  var m=[];
  for(var iy=0;iy<SYN_N;iy++){var row=[];
    for(var ix=0;ix<SYN_N;ix++)row.push(_synGrid[iy*SYN_N+ix]);
    m.push(row);}
  return m;}
/* Förtätar rutnätet med bilinjär interpolation så isobarerna blir mjuka */
/* sub = förtätningsgrad, key = vilket fält som interpoleras ('p' tryck, 't' temp) */
function synFine(m,sub,key){
  var K=key||'p';
  var N=(SYN_N-1)*sub+1,out=[];
  for(var j=0;j<N;j++){var row=[],fy=j/(N-1)*(SYN_N-1);
    var j0=Math.min(SYN_N-2,Math.floor(fy)),ty=fy-j0;
    for(var i=0;i<N;i++){var fx=i/(N-1)*(SYN_N-1);
      var i0=Math.min(SYN_N-2,Math.floor(fx)),tx=fx-i0;
      var a=m[j0][i0][K],b=m[j0][i0+1][K],c=m[j0+1][i0][K],dd=m[j0+1][i0+1][K];
      if(a==null||b==null||c==null||dd==null){row.push(null);continue;}
      var v=a*(1-tx)*(1-ty)+b*tx*(1-ty)+c*(1-tx)*ty+dd*tx*ty;
      var lat=SYN_BOX.s+(SYN_BOX.n-SYN_BOX.s)*(j/(N-1));
      var lon=SYN_BOX.w+(SYN_BOX.e-SYN_BOX.w)*(i/(N-1));
      row.push({v:v,lat:lat,lon:lon});}
    out.push(row);}
  return out;}
/* Marching squares: drar en isobar för en given trycknivå */
function synContour(F,level,XY){
  var segs=[],N=F.length;
  var ip=function(p1,p2){var t=(level-p1.v)/((p2.v-p1.v)||1e-9);
    var a=XY(p1),b=XY(p2);return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];};
  for(var j=0;j<N-1;j++)for(var i=0;i<N-1;i++){
    var p00=F[j][i],p10=F[j][i+1],p11=F[j+1][i+1],p01=F[j+1][i];
    if(!p00||!p10||!p11||!p01)continue;
    var cr=[];
    if((p00.v<level)!==(p10.v<level))cr.push(ip(p00,p10));
    if((p10.v<level)!==(p11.v<level))cr.push(ip(p10,p11));
    if((p11.v<level)!==(p01.v<level))cr.push(ip(p11,p01));
    if((p01.v<level)!==(p00.v<level))cr.push(ip(p01,p00));
    if(cr.length===2)segs.push([cr[0],cr[1]]);
    else if(cr.length===4){segs.push([cr[0],cr[1]]);segs.push([cr[2],cr[3]]);}}
  return segs;}
/* Hittar tryckcentrum (H och L) som lokala extremer i rutnätet */
function synCenters(m){
  var out=[];
  for(var j=1;j<SYN_N-1;j++)for(var i=1;i<SYN_N-1;i++){
    var c=m[j][i];if(!c||c.p==null)continue;
    var hi=true,lo=true,ok=true;
    for(var dj=-1;dj<=1;dj++)for(var di=-1;di<=1;di++){
      if(!di&&!dj)continue;var n=m[j+dj][i+di];
      if(!n||n.p==null){ok=false;continue;}
      if(n.p>=c.p)hi=false; if(n.p<=c.p)lo=false;}
    if(ok&&(hi||lo))out.push({lat:c.lat,lon:c.lon,p:c.p,t:hi?'H':'L'});}
  return out;}

/* Vind som komposanter: u österut, v norrut. Vindriktning anges dit vinden
   kommer FRÅN, därav minustecknen. */
function synUV(m){
  for(var j=0;j<SYN_N;j++)for(var i=0;i<SYN_N;i++){var c=m[j][i];
    if(!c)continue;
    if(c.ws==null||c.wd==null){c.u=null;c.v=null;continue;}
    var r=c.wd*Math.PI/180;
    c.u=-c.ws*Math.sin(r); c.v=-c.ws*Math.cos(r);}
  return m;}

/* Temperaturgradienten i varje finmaskig punkt, i grader per 100 km. */
function synGrad(FT){
  var N=FT.length,out=[];
  for(var j=0;j<N;j++){var row=[];
    for(var i=0;i<N;i++){
      var c=FT[j][i];
      if(!c){row.push(null);continue;}
      var e=FT[j][Math.min(N-1,i+1)],wv=FT[j][Math.max(0,i-1)];
      var no=FT[Math.min(N-1,j+1)][i],so=FT[Math.max(0,j-1)][i];
      if(!e||!wv||!no||!so){row.push(null);continue;}
      var kmx=111.32*Math.cos(c.lat*Math.PI/180)*(e.lon-wv.lon);
      var kmy=110.57*(no.lat-so.lat);
      var gx=kmx?(e.v-wv.v)/kmx*100:0;
      var gy=kmy?(no.v-so.v)/kmy*100:0;
      row.push({g:Math.sqrt(gx*gx+gy*gy),gx:gx,gy:gy,t:c.v,lat:c.lat,lon:c.lon});}
    out.push(row);}
  return out;}

/* Marching squares som ovan, men punkterna lämnas i rutnätets egna koordinater
   (i,j) så att gradient och vind kan slås upp direkt för varje punkt. */
function synContourIJ(F,level){
  var segs=[],N=F.length;
  var ip=function(i1,j1,p1,i2,j2,p2){var t=(level-p1.v)/((p2.v-p1.v)||1e-9);
    return [i1+(i2-i1)*t, j1+(j2-j1)*t];};
  for(var j=0;j<N-1;j++)for(var i=0;i<N-1;i++){
    var p00=F[j][i],p10=F[j][i+1],p11=F[j+1][i+1],p01=F[j+1][i];
    if(!p00||!p10||!p11||!p01)continue;
    var cr=[];
    if((p00.v<level)!==(p10.v<level))cr.push(ip(i,j,p00,i+1,j,p10));
    if((p10.v<level)!==(p11.v<level))cr.push(ip(i+1,j,p10,i+1,j+1,p11));
    if((p11.v<level)!==(p01.v<level))cr.push(ip(i+1,j+1,p11,i,j+1,p01));
    if((p01.v<level)!==(p00.v<level))cr.push(ip(i,j+1,p01,i,j,p00));
    if(cr.length===2)segs.push([cr[0],cr[1]]);
    else if(cr.length===4){segs.push([cr[0],cr[1]]);segs.push([cr[2],cr[3]]);}}
  return segs;}

/* Lösa segment sätts ihop till sammanhängande linjer. */
function synChain(segs){
  var key=function(p){return Math.round(p[0]*4)+','+Math.round(p[1]*4);};
  var map={},used=[];
  for(var i=0;i<segs.length;i++){used.push(false);
    var ka=key(segs[i][0]),kb=key(segs[i][1]);
    (map[ka]=map[ka]||[]).push(i); (map[kb]=map[kb]||[]).push(i);}
  var chains=[];
  for(var q=0;q<segs.length;q++){
    if(used[q])continue; used[q]=true;
    var pts=[segs[q][0],segs[q][1]];
    for(var dir=0;dir<2;dir++){
      var end=dir?pts[0]:pts[pts.length-1],guard=0;
      while(guard++<4000){
        var cand=map[key(end)]||[],nx=-1;
        for(var c=0;c<cand.length;c++)if(!used[cand[c]]){nx=cand[c];break;}
        if(nx<0)break;
        used[nx]=true;
        var sg=segs[nx],nxt=(key(sg[0])===key(end))?sg[1]:sg[0];
        if(dir)pts.unshift(nxt); else pts.push(nxt);
        end=nxt;}}
    if(pts.length>=3)chains.push(pts);}
  return chains;}

/* Hela analysen: returnerar färdiga fronter i skärmkoordinater. */
function synFrontList(m,XY){
  var FT=synFine(m,FRONT_SUB,'t');
  if(!FT.length||!FT[0][0])return [];
  var GD=synGrad(FT),N=GD.length;
  var all=[];
  for(var j=0;j<N;j++)for(var i=0;i<N;i++)if(GD[j][i])all.push(GD[j][i].g);
  if(all.length<40)return [];
  all.sort(function(a,b){return a-b;});
  /* Tröskeln följer dagens väder: alltid de skarpaste banden, men aldrig
     svagare än FRONT_MIN_ABS – en lugn dag ska ge noll fronter, inte brus. */
  var lim=Math.max(FRONT_MIN_ABS, all[Math.floor(all.length*0.88)]);
  var hot=[];
  for(var j2=0;j2<N;j2++)for(var i2=0;i2<N;i2++){var g2=GD[j2][i2];
    if(g2&&g2.g>=lim)hot.push(g2.t);}
  if(hot.length<12)return [];
  hot.sort(function(a,b){return a-b;});
  var lv=[hot[Math.floor(hot.length*0.2)],hot[Math.floor(hot.length*0.5)],hot[Math.floor(hot.length*0.8)]];
  var UV={u:synFine(m,FRONT_SUB,'u'),v:synFine(m,FRONT_SUB,'v')};
  var at=function(F,i,j){var r=F[Math.max(0,Math.min(N-1,Math.round(j)))];
    var c=r&&r[Math.max(0,Math.min(N-1,Math.round(i)))];return c?c.v:null;};
  var cand=[];
  for(var L=0;L<lv.length;L++){
    if(L&&Math.abs(lv[L]-lv[L-1])<0.4)continue;          /* nivåerna för lika */
    var chains=synChain(synContourIJ(FT,lv[L]));
    for(var ch=0;ch<chains.length;ch++){
      var ij=chains[ch],pts=[],gsum=0,adv=0,n=0,us=0,vs=0;
      for(var k=0;k<ij.length;k++){
        var gi=ij[k][0],gj=ij[k][1];
        var cell=GD[Math.max(0,Math.min(N-1,Math.round(gj)))][Math.max(0,Math.min(N-1,Math.round(gi)))];
        if(!cell)continue;
        var lat=SYN_BOX.s+(SYN_BOX.n-SYN_BOX.s)*(gj/(N-1));
        var lon=SYN_BOX.w+(SYN_BOX.e-SYN_BOX.w)*(gi/(N-1));
        var xy=XY({lat:lat,lon:lon});
        pts.push(xy); gsum+=cell.g;
        var u=at(UV.u,gi,gj),v=at(UV.v,gi,gj);
        if(u!=null&&v!=null){adv+=-(u*cell.gx+v*cell.gy);us+=u;vs+=v;n++;}}
      if(pts.length<3)continue;
      /* Bara den del av linjen som ligger i den skarpa zonen är en front */
      var len=0;for(var q2=1;q2<pts.length;q2++)
        len+=Math.hypot(pts[q2][0]-pts[q2-1][0],pts[q2][1]-pts[q2-1][1]);
      if(len<FRONT_MIN_PX)continue;
      /* Medelvinden längs linjen, omräknad till skärmens riktningar:
         x österut, y nedåt (söderut) – därav minustecknet på v. */
      cand.push({pts:pts,len:len,g:gsum/pts.length,adv:n?adv/n:0,
                 wsx:n?us/n:0, wsy:n?-vs/n:0});}}
  cand.sort(function(a,b){return b.g*b.len-a.g*a.len;});
  /* Parallella linjer från olika isotermer i samma band ska inte dubbelritas */
  var taken={},out=[],CELL=26;
  var mark=function(p,set){var cx=Math.round(p[0]/CELL),cy=Math.round(p[1]/CELL);
    var hits=0;
    for(var dx=-1;dx<=1;dx++)for(var dy=-1;dy<=1;dy++){
      var k=(cx+dx)+':'+(cy+dy);
      if(set){taken[k]=1;} else if(taken[k])hits++;}
    return hits>0;};
  for(var ci=0;ci<cand.length&&out.length<FRONT_MAX;ci++){
    var C=cand[ci],dup=0;
    for(var pi=0;pi<C.pts.length;pi++)if(mark(C.pts[pi],false))dup++;
    if(dup/C.pts.length>0.4)continue;
    for(var pj=0;pj<C.pts.length;pj++)mark(C.pts[pj],true);
    /* Hur mycket av vinden ligger VINKELRÄTT mot fronten? rel är cosinus för
       vinkeln mellan vind och temperaturgradient: ±1 = rakt på, 0 = längs med.
       Blåser det längs fronten flyttar den sig inte – då är den stationär. */
    var spd=Math.hypot(C.wsx,C.wsy)||0;
    C.rel=(C.g*spd)?C.adv/(C.g*spd):0;
    C.typ=(C.rel>0.35)?'warm':(C.rel<-0.35?'cold':'stat');
    C.warm=(C.typ==='warm');
    out.push(C);}
  return out;}

/* Ritar en front: vit stödlinje, färgad linje och symboler på rörelsesidan. */
function synFrontSVG(F,m,XY){
  var RED='#d1443f',BLUE='#2f6fd0',typ=F.typ||(F.warm?'warm':'cold'),pts=F.pts;
  var col=(typ==='warm')?RED:BLUE;
  var d='M'+pts[0][0].toFixed(1)+' '+pts[0][1].toFixed(1);
  for(var i=1;i<pts.length;i++)d+='L'+pts[i][0].toFixed(1)+' '+pts[i][1].toFixed(1);
  var s='<path d="'+d+'" fill="none" stroke="#fff" stroke-width="9" opacity=".9" stroke-linecap="round" stroke-linejoin="round"/>'
       +'<path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>';
  /* Stationär front ritas som blå linje med röda streck ovanpå – samma
     omväxlande mönster som på en handritad väderkarta. */
  if(typ==='stat')s+='<path d="'+d+'" fill="none" stroke="'+RED+'" stroke-width="4.2" stroke-dasharray="22 22" stroke-linecap="butt"/>';
  /* Vindens riktning på skärmen: x österut, y nedåt (alltså söderut). */
  var wsx=F.wsx||0, wsy=F.wsy||0;
  var step=44, acc=step*0.6, n=0;
  for(var k=1;k<pts.length;k++){
    var ax=pts[k-1][0],ay=pts[k-1][1],bx=pts[k][0],by=pts[k][1];
    var seg=Math.hypot(bx-ax,by-ay); if(!seg)continue;
    var dx=(bx-ax)/seg,dy=(by-ay)/seg;
    while(acc<seg){
      var px=ax+dx*acc, py=ay+dy*acc;
      var th=Math.atan2(dy,dx)*180/Math.PI;
      /* Symbolerna pekar mot -y i det roterade systemet, dvs (dy,-dx) */
      if((dy*wsx+(-dx)*wsy)<0)th+=180;
      var warm=(typ==='warm');
      if(typ==='stat'){warm=(n%2===0); if(!warm)th+=180;}   /* omväxlande sidor */
      var sc=(typ==='stat')?(warm?RED:BLUE):col;
      s+='<g transform="translate('+px.toFixed(1)+','+py.toFixed(1)+') rotate('+th.toFixed(1)+')">'
        +(warm?'<path d="M-8,0 A 8 8 0 0 1 8,0 Z" fill="'+sc+'" stroke="#fff" stroke-width="1.4"/>'
               :'<path d="M-8,0 L0,-12 L8,0 Z" fill="'+sc+'" stroke="#fff" stroke-width="1.4"/>')
        +'</g>';
      n++; acc+=step;}
    acc-=seg;}
  return s;}

function wxMapSVG(){
  var show=wxShow();
  var syn=(show==='tryck');
  /* Närvyn använder radarns vyram: den är utzoomad nog att radarrutorna
     (som bara finns till zoom 7) ser skarpa ut, och vind ritas i samma bild. */
  var VW=syn?SYN_VIEW:radarVy();
  var W=VW.W, H=VW.H, Z=syn?SYN_VIEW.z:radarViewZ();
  var G=osmGrid(VW.lat, VW.lon, Z, W, H);
  var wdir=cap(DEV.windNet,'measure_wind_angle'); if(wdir==null)wdir=cap(DEV.smhi,'measure_wind_direction_cp');
  var wspd=vindMs(); if(wspd==null)wspd=cap(DEV.smhi,'measure_wind_speed_cp');
  var P=PAL[curTheme]||PAL.dark;
  var hm=G.xy(WX_HOME.lat,WX_HOME.lon);
  var outline='#fff';
  var s='<svg class="wxmap-svg" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Karta över Onsalahalvön">';
  s+='<defs><clipPath id="wxClip"><rect x="0" y="0" width="'+W+'" height="'+H+'" rx="14"/></clipPath>'
   +'<radialGradient id="wxgH"><stop offset="0" stop-color="#d1443f" stop-opacity=".40"/>'
   +'<stop offset=".55" stop-color="#d1443f" stop-opacity=".16"/><stop offset="1" stop-color="#d1443f" stop-opacity="0"/></radialGradient>'
   +'<radialGradient id="wxgL"><stop offset="0" stop-color="#2f6fd0" stop-opacity=".40"/>'
   +'<stop offset=".55" stop-color="#2f6fd0" stop-opacity=".16"/><stop offset="1" stop-color="#2f6fd0" stop-opacity="0"/></radialGradient>'
   +'<filter id="wxfDamp"><feColorMatrix type="saturate" values="0.25"/>'
   +'<feComponentTransfer><feFuncR type="linear" slope="0.92" intercept="0.07"/><feFuncG type="linear" slope="0.92" intercept="0.07"/><feFuncB type="linear" slope="0.92" intercept="0.07"/></feComponentTransfer></filter>'
   +'</defs>';
  s+='<g clip-path="url(#wxClip)">';
  s+='<rect x="0" y="0" width="'+W+'" height="'+H+'" fill="'+(P.water||'#5aa9c8')+'" opacity=".25"/>';
  var f=' filter="url(#wxfDamp)"';   /* alltid dämpad – överlagringarna ska synas */
  s+='<g'+f+'>';
  for(var i=0;i<G.tiles.length;i++){var t=G.tiles[i];
    s+='<image href="'+wxTileUrl(t)+'" x="'+t.left+'" y="'+t.top+'" width="256" height="256"/>';}
  s+='</g>';
  /* --- Regnradar: eget lager direkt ovanpå kartan --- */
  if(!syn){
    radarFetch();
    /* Två lager, ett i taget fyllt. Vilket som används avgörs av vilken ruta
       tidslinjen står på — mätning eller modell. Båda finns alltid i DOM:en så
       att wxSetIdx kan byta innehåll utan att rita om kartan. */
    var vald=wxRutaNu();
    if(vald&&vald.typ==='fram'){
      s+='<g id="wx-radar" opacity=".72">'+framLagerHTML(vald.min)+'</g>';
    }else if(vald){
      s+='<g id="wx-radar" opacity=".72">'+radarLayerHTML(vald.path)+'</g>';
    }else{
      s+='<text x="'+(W/2)+'" y="'+(H-58)+'" text-anchor="middle" class="wxm-none">'
        +(_radarFail?'Nederbörden kunde inte hämtas':'Hämtar nederbörd…')+'</text>';}
  }
  /* --- Vindfält: färre men tydligare pilar, med kontrastkant --- */
  if(!syn&&wdir!=null&&isFinite(wdir)){
    var to=((wdir+180)%360+360)%360;
    var len=Math.max(24,Math.min(42,20+(wspd||0)*1.9));
    var pth=windArrowShape(len), cols=4, rows=5;
    for(var cx=0;cx<cols;cx++)for(var cy=0;cy<rows;cy++){
      var ax=(cx+0.5)*(W/cols), ay=(cy+0.5)*(H/rows);
      s+='<g transform="translate('+ax.toFixed(0)+','+ay.toFixed(0)+') rotate('+to.toFixed(0)+')" opacity=".5">'
        +'<path d="'+pth+'" fill="#111" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></g>';}
  }
  /* --- Tryckfält: isobarer och H/L ur Open-Meteos rutnät --- */
  if(syn){
    synFetch();
    var m=synMatrix();
    if(m){
      var F=synFine(m,6);
      var XY=function(pt){return G.xy(pt.lat,pt.lon);};
      var lo=Infinity,hi=-Infinity;
      for(var jj=0;jj<F.length;jj++)for(var ii=0;ii<F.length;ii++){var c0=F[jj][ii];
        if(c0){if(c0.v<lo)lo=c0.v;if(c0.v>hi)hi=c0.v;}}
      var step=4,lv0=Math.ceil(lo/step)*step;
      for(var L=lv0;L<=hi;L+=step){
        var segs=synContour(F,L,XY),d='';
        for(var q=0;q<segs.length;q++)d+='M'+segs[q][0][0].toFixed(1)+' '+segs[q][0][1].toFixed(1)+'L'+segs[q][1][0].toFixed(1)+' '+segs[q][1][1].toFixed(1)+' ';
        if(!d)continue;
        var mainLine=(Math.round(L)%20===0);
        var isoCol=(L>1013)?'#d1443f':(L<1013?'#2f6fd0':'#5b6472');
        s+='<path d="'+d+'" fill="none" stroke="#fff" stroke-width="'+(mainLine?6:4.6)+'" opacity=".72" stroke-linecap="round"/>';
        s+='<path d="'+d+'" fill="none" stroke="'+isoCol+'" stroke-width="'+(mainLine?2.8:1.7)+'" opacity="'+(mainLine?1:.85)+'" stroke-linecap="round"/>';
        if(mainLine&&segs.length){var lp=segs[Math.floor(segs.length/2)][0];
          s+='<text x="'+lp[0].toFixed(0)+'" y="'+lp[1].toFixed(0)+'" class="syn-iso" text-anchor="middle">'+Math.round(L)+'</text>';}}
      /* Fronterna ligger ovanpå isobarerna men under tryckcentrumen */
      try{
        var fr=synFrontList(synUV(m),XY);
        for(var fi=0;fi<fr.length;fi++)s+=synFrontSVG(fr[fi],m,XY);
        _synFrontN=fr.length;
      }catch(e){_synFrontN=0;}
      var ctr=synCenters(m),RED='#d1443f',BLUE='#2f6fd0';
      /* Mjuk röd/blå toning runt varje centrum – en gradient i stället för en
         platt cirkel, så ögat dras dit utan att kartan under försvinner. */
      for(var cg=0;cg<ctr.length;cg++){var Cg=ctr[cg],gxy0=G.xy(Cg.lat,Cg.lon);
        if(gxy0[0]<-90||gxy0[0]>W+90||gxy0[1]<-90||gxy0[1]>H+90)continue;
        s+='<circle cx="'+gxy0[0].toFixed(0)+'" cy="'+gxy0[1].toFixed(0)+'" r="165" fill="url(#'+((Cg.t==='H')?'wxgH':'wxgL')+')"/>';}
      /* Själva markören: vit ring runt en fylld skiva ger kontrast mot både
         ljus mark, mörkt vatten och isobarerna som korsar under den. */
      for(var ci=0;ci<ctr.length;ci++){var C=ctr[ci],cxy=G.xy(C.lat,C.lon);
        /* Hela markören med etikett tar ~40 px uppåt och ~80 px nedåt – ligger
           centrumet närmare kanten än så blir texten avklippt, så den hoppas över. */
        if(cxy[0]<45||cxy[0]>W-45||cxy[1]<40||cxy[1]>H-85)continue;
        var isH=(C.t==='H'),cc=isH?RED:BLUE;
        var cX=cxy[0].toFixed(0), cY=cxy[1].toFixed(0);
        s+='<circle cx="'+cX+'" cy="'+cY+'" r="34" fill="#fff" opacity=".96"/>'
          +'<circle cx="'+cX+'" cy="'+cY+'" r="29" fill="'+cc+'"/>'
          +'<circle cx="'+cX+'" cy="'+cY+'" r="34" fill="none" stroke="'+cc+'" stroke-width="2" opacity=".55"/>'
          +'<text x="'+cX+'" y="'+(cxy[1]+13).toFixed(0)+'" text-anchor="middle" class="syn-hl" fill="#fff">'+C.t+'</text>';
        /* Etiketten på en egen platta – siffrorna drunknade tidigare i kartan */
        var lw=76, lx=cxy[0]-lw/2, ly=cxy[1]+40;
        s+='<rect x="'+lx.toFixed(0)+'" y="'+ly.toFixed(0)+'" width="'+lw+'" height="22" rx="11" fill="#fff" opacity=".94"/>'
          +'<rect x="'+lx.toFixed(0)+'" y="'+ly.toFixed(0)+'" width="'+lw+'" height="22" rx="11" fill="none" stroke="'+cc+'" stroke-width="1.4" opacity=".7"/>'
          +'<text x="'+cX+'" y="'+(ly+15).toFixed(0)+'" text-anchor="middle" class="syn-hlv" fill="'+cc+'">'
          +(isH?'Högtryck':'Lågtryck')+'</text>'
          +'<text x="'+cX+'" y="'+(ly+37).toFixed(0)+'" text-anchor="middle" class="syn-hlp">'+Math.round(C.p)+' hPa</text>';}
      /* Vindpilar ur samma rutnät – här varierar de faktiskt över ytan */
      for(var gy=0;gy<SYN_N;gy++)for(var gx=0;gx<SYN_N;gx++){var gp=m[gy][gx];
        if(!gp||gp.wd==null)continue;var gxy=G.xy(gp.lat,gp.lon);
        if(gxy[0]<14||gxy[0]>W-14||gxy[1]<14||gxy[1]>H-14)continue;
        var gto=((gp.wd+180)%360+360)%360,glen=Math.max(18,Math.min(34,14+(gp.ws||0)*1.7));
        s+='<g transform="translate('+gxy[0].toFixed(0)+','+gxy[1].toFixed(0)+') rotate('+gto.toFixed(0)+')" opacity=".45">'
          +'<path d="'+windArrowShape(glen)+'" fill="#111" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></g>';}
    }else{
      s+='<text x="'+(W/2)+'" y="'+(H/2-20)+'" text-anchor="middle" class="wxm-none">'
        +(_synFail?'Tryckdata kunde inte hämtas':'Hämtar tryckdata…')+'</text>';}
  }
  /* --- Hemmet --- */
  /* Hemmet: fast signalfärg i stället för temafärgen, så pricken sticker ut
     lika bra mot ljus mark, mörkt vatten och regnradarns blå-gröna fält. */
  var HOME_C='#ff2d55';
  s+='<circle cx="'+hm[0].toFixed(0)+'" cy="'+hm[1].toFixed(0)+'" r="19" fill="'+HOME_C+'" opacity=".16"/>'
   +'<circle cx="'+hm[0].toFixed(0)+'" cy="'+hm[1].toFixed(0)+'" r="11" fill="#fff"/>'
   +'<circle cx="'+hm[0].toFixed(0)+'" cy="'+hm[1].toFixed(0)+'" r="7.5" fill="'+HOME_C+'"/>'
   +'<circle cx="'+hm[0].toFixed(0)+'" cy="'+hm[1].toFixed(0)+'" r="11" fill="none" stroke="#1b2733" stroke-width="1.2" opacity=".55"/>';
  s+='</g>';
  /* Mätvärdesrutorna är borttagna – samma siffror står i "Just nu" under kartan. */
  s+='<text x="'+(W-6)+'" y="'+(H-6)+'" text-anchor="end" class="wxm-attr">'+wxAttr()+'</text>';
  s+='</svg>';
  return s;
}
/* ---- Historik-hjälpare (alla värden kommer ur den loggade historiken) ---- */
function wxPts(k,cid){var a=histV(k,cid),o=[];for(var i=0;i<a.length;i++){var p=a[i];if(p&&p.v!=null&&isFinite(p.v))o.push(p);}return o;}
function wxAgo(k,hours){var a=wxPts(k);if(!a.length)return null;var t=Date.now()-hours*3600000,best=null,bd=Infinity;
  for(var i=0;i<a.length;i++){var d=Math.abs(a[i].t-t);if(d<bd){bd=d;best=a[i];}}
  return (bd<=hours*3600000*0.5+1800000)?best.v:null;}
function wxStats(k){var a=wxPts(k);if(a.length<2)return null;
  var mn=a[0],mx=a[0],sum=0;
  for(var i=0;i<a.length;i++){var p=a[i];if(p.v<mn.v)mn=p;if(p.v>mx.v)mx=p;sum+=p.v;}
  return {min:mn.v,minT:mn.t,max:mx.v,maxT:mx.t,avg:sum/a.length,first:a[0].v,last:a[a.length-1].v,n:a.length,from:a[0].t,to:a[a.length-1].t};}
function wxTrend(k,hours){var now=wxPts(k);if(!now.length)return null;var last=now[now.length-1].v,then=wxAgo(k,hours);
  return (then==null)?null:{d:last-then,last:last,then:then};}
function wxSer(){for(var i=0;i<WXSER.length;i++)if(WXSER[i].k===_wxSer)return WXSER[i];return WXSER[0];}
function wxSetSer(k){_wxSer=k;renderVader();}
/* ===== VÄDERSIDANS SAMMANSLAGNA RUTA =====
   \"Just nu\" och \"Dygnet\" visade samma mätvärden två gånger: först som kort,
   sedan som valbara brickor ovanför en graf. Nu är det en ruta — en bricka per
   värde, och grafen under visar dem man tänder.

   OLIKA ENHETER PÅ SAMMA GRAF. Lufttryck ligger runt 1000, regn under 10 och
   vind runt 5. Ritas de mot en gemensam skala blir allt utom lufttrycket en
   rak linje längs nederkanten. Varje serie skalas därför mot SITT EGET spann i
   fönstret: kurvorna visar formen, och avläsningen vid drag ger de riktiga
   talen med enhet. Det står i i-rutan, så ingen tror att linjerna går att
   jämföra i höjdled. */
function wxOn(k){
  try{
    var c=CFG.wxLines;
    if(!c||typeof c!=='object')return k==='t_ute';   /* temperatur som start */
    return !!c[k];
  }catch(e){return k==='t_ute';}
}
function wxToggle(k){
  if(!CFG.wxLines||typeof CFG.wxLines!=='object')CFG.wxLines={t_ute:true};
  CFG.wxLines[k]=!wxOn(k);
  /* Minst en serie måste vara tänd — en tom graf säger ingenting om varför. */
  var nagon=WXSER.some(function(S){return wxOn(S.k);});
  if(!nagon)CFG.wxLines[k]=true;
  saveCfg();renderVader();
}
function wxSerCol(S){var P=PAL[curTheme]||PAL.dark;return P[S.c]||P.blue;}
/* Har serien något att rita i det valda fönstret? */
function wxHarData(S,cut,cid){
  var a=wxPts(S.k,cid)||[],n=0;
  for(var i=0;i<a.length;i++){var p=a[i];if(p&&p.v!=null&&isFinite(p.v)&&p.t>=cut)n++;if(n>=2)return true;}
  return false;
}
function wxMultiSVG(cid){
  cid=cid||'wx';
  /* Registreras här, inte i någon annan vys gren — samma miss som solgrafens
     byggare i v638, där den låg i poolrutans kod och helskärmen ritade tomt. */
  _grafByggare['wx']={titel:'Mätvärden',full:function(c){return wxMultiSVG(c||'wx-full');}};
  var fen=grafFonster(cid);
  var W=300,H=136,padL=4,padR=4,padT=10,padB=16;
  var out=[],t0=Infinity,t1=-Infinity,cut=fen.t0;
  for(var i=0;i<WXSER.length;i++){var S=WXSER[i];if(!wxOn(S.k))continue;
    var raw=wxPts(S.k,cid)||[],seg=[];
    for(var j=0;j<raw.length;j++){var pt=raw[j];if(pt&&pt.v!=null&&isFinite(pt.v)&&pt.t>=cut)seg.push(pt);}
    if(seg.length<2)continue;
    t0=Math.min(t0,seg[0].t);t1=Math.max(t1,seg[seg.length-1].t);
    var lo=Infinity,hi=-Infinity;
    for(var m=0;m<seg.length;m++){if(seg[m].v<lo)lo=seg[m].v;if(seg[m].v>hi)hi=seg[m].v;}
    out.push({S:S,s:seg,lo:lo,hi:hi});}
  if(!out.length)return '<div class="viz-empty">Samlar in data… grafen fylls på efter hand.</div>';
  var tr=(t1-t0)||1;
  var X=function(v){return padL+(v-t0)/tr*(W-padL-padR);};
  /* Egen skala per serie. En platt serie läggs på mitten i stället för att
     divideras med noll. */
  var Ymk=function(o){
    var yr=(o.hi-o.lo);
    if(!(yr>0))return function(){return padT+(H-padT-padB)*0.5;};
    var mp=yr*0.12,lo=o.lo-mp,r=(o.hi+mp)-lo;
    return function(v){return padT+(1-(v-lo)/r)*(H-padT-padB);};
  };
  var g='<svg class="tg-svg" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none">';
  for(var q=0;q<out.length;q++){var o=out[q];o.Y=Ymk(o);
    var d=smoothPath(o.s.map(function(pt){return [X(pt.t),o.Y(pt.v)];}));
    g+='<path d="'+d+'" fill="none" stroke="'+wxSerCol(o.S)+'"'+GRAF_LINJE+'/>';}
  g+='</svg>';
  g=avlLager(cid,g,{W:W,H:H,X:X,t0:t0,t1:t1,
    ser:out.map(function(o){return {namn:o.S.lab,farg:wxSerCol(o.S),pts:o.s,Y:o.Y,
      fmt:(function(S){return function(v){return num(v,S.dec)+' '+S.u;};})(o.S)};})});
  g+='<div class="viz-cap">senaste '+spannTxt(tr)+' · '
    +out.length+' serie'+(out.length>1?'r':'')+', egen skala per serie</div>';
  return g;
}
/* Brickorna: en per värde. De som saknar historik går inte att tända — de
   visar bara sitt tal, som i den gamla \"Just nu\"-rutan. */
function wxBrickorHTML(){
  var fen=grafFonster('wx'),cut=fen.t0,h='';
  for(var i=0;i<WXSER.length;i++){var S=WXSER[i],v=S.val(),on=wxOn(S.k),hd=wxHarData(S,cut,'wx');
    h+='<button class="tg-chip'+(on?' on':'')+(hd?'':' nodata')+'" onclick="wxToggle(\''+S.k+'\')"'
      +(hd?'':' title="Väntar på mätpunkter"')+'>'
      +'<span class="tg-top"><span class="tg-dot" style="background:'+wxSerCol(S)+'"></span>'
      +'<span class="tg-l">'+esc(shortLab(S.lab))+'</span></span>'
      +'<b class="tg-v">'+(v==null?'–':num(v,S.dec)+'<span class="tg-u">'+S.u+'</span>')+'</b>'
      +(hd?'':'<span class="tg-wait">väntar på data</span>')+'</button>';}
  /* Värden utan egen serie — molnighet, sikt, åska. De kommer från SMHI och
     samlas inte in över tid, så de kan inte ritas. */
  var g=function(k){return cap(DEV.smhi,k);};
  [['Molnighet',g('mean_value_of_total_cloud_cover_cp'),'%',0],
   ['Sikt',g('horizontal_visibility_cp'),'km',1],
   ['Åska',g('measure_thunder_probability_cp'),'%',0]].forEach(function(x){
    if(x[1]==null)return;
    /* SAMMA ELEMENT som de tändbara — en avstängd knapp, inte en div. Med en
       div fick de en annan layout: etikett och tal hamnade på samma rad och
       etiketten trunkerades bort. Samma taggnamn ger samma layout oavsett vad
       webbläsaren gör av flex-reglerna. */
    h+='<button class="tg-chip stat" disabled>'
      +'<span class="tg-top"><span class="tg-dot dim"></span>'
      +'<span class="tg-l">'+esc(shortLab(x[0]))+'</span></span>'
      +'<b class="tg-v">'+num(x[1],x[3])+'<span class="tg-u">'+x[2]+'</span></b></button>';
  });
  return '<div class="tg-leg">'+h+'</div>';
}


/* ---- Dygnsgraf i samma stil som appens övriga grafer ----
   Viktigt: ingen text ritas inne i SVG:n. Grafen skalas i bredd (preserveAspectRatio
   "none") precis som de andra, och då skulle text dras ut på bredden. Högsta och
   lägsta står därför i en vanlig HTML-rad under grafen. */
function wxGraphSVG(){
  var S=wxSer(),a=wxPts(S.k),P=PAL[curTheme]||PAL.dark,col=P[S.c]||P.blue;
  if(!a||a.length<3)return '<div class="viz-empty">Historiken för '+esc(S.lab.toLowerCase())+' fylls på under dygnet.</div>';
  var now=Date.now(),cut=now-24*3600000;
  var seg=a.filter(function(p){return p.t>=cut;});if(seg.length<3)seg=a.slice(-48);
  var W2=300,H2=74,pad=5;
  var t0=seg[0].t,t1=seg[seg.length-1].t||now,tr=(t1-t0)||1;
  var lo=seg[0],hi=seg[0];
  for(var i=0;i<seg.length;i++){if(seg[i].v<lo.v)lo=seg[i];if(seg[i].v>hi.v)hi=seg[i];}
  var ylo=lo.v,yhi=hi.v,yr=(yhi-ylo)||1;
  var X=function(t){return pad+(t-t0)/tr*(W2-2*pad);},Y=function(v){return H2-pad-(v-ylo)/yr*(H2-2*pad);};
  var P2=seg.map(function(p){return [X(p.t),Y(p.v)];});
  var line=smoothPath(P2);
  var area=line+' L'+P2[P2.length-1][0].toFixed(1)+' '+(H2-pad)+' L'+P2[0][0].toFixed(1)+' '+(H2-pad)+' Z';
  var g=areaGrad(col,0.28);
  var hh=function(t){var d=new Date(t);return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);};
  var last=seg[seg.length-1].v;
  var svgm='<svg viewBox="0 0 '+W2+' '+H2+'" preserveAspectRatio="none"><defs>'+g.def+'</defs>'
    +nollLinje(nollY(Y,ylo,yhi),pad,W2-pad)
    +'<path d="'+area+'" fill="url(#'+g.id+')"/>'
    +'<path d="'+line+'" fill="none" stroke="'+col+'"'+GRAF_LINJE+'/></svg>';
  svgm=avlLager('wx-'+S.k,svgm,{W:W2,H:H2,X:X,
    ser:[{namn:'',farg:col,pts:seg,Y:Y,fmt:function(v){return num(v,S.dec)+' '+S.u;}}]});
  var h='<div class="viz">'+svgm;
  h+='<div class="wxg-cap">'
    +'<span class="wxg-lo">Lägst '+num(lo.v,S.dec)+' '+S.u+' · '+hh(lo.t)+'</span>'
    +'<span class="wxg-now">Nu '+num(last,S.dec)+' '+S.u+'</span>'
    +'<span class="wxg-hi">Högst '+num(hi.v,S.dec)+' '+S.u+' · '+hh(hi.t)+'</span>'
    +'</div>';
  h+='<div class="viz-cap">senaste '+Math.max(1,Math.round(tr/3600000))+' timmarna</div></div>';
  return h;
}
/* ---- Jämförelser: nu mot tidigare i dygnet ---- */
function wxCompareHTML(){
  var S=wxSer(),st=wxStats(S.k);
  if(!st)return '<div class="wx-empty">Jämförelser visas när det finns mätvärden från dygnet.</div>';
  var now=S.val(); if(now==null)now=st.last;
  var rows='';
  var mk=function(lab,then){
    if(then==null)return '';
    var d=now-then, sign=(d>0?'+':(d<0?'−':'±'));
    var cls=(Math.abs(d)<(S.dec?0.05:0.5))?'flat':(d>0?'up':'down');
    return '<div class="wxc-row"><span class="wxc-l">'+lab+'</span><span class="wxc-v">'+num(then,S.dec)+' '+S.u+'</span>'
      +'<span class="wxc-d '+cls+'">'+sign+num(Math.abs(d),S.dec)+'</span></div>';};
  rows+=mk('För 1 timme sedan',wxAgo(S.k,1));
  rows+=mk('För 3 timmar sedan',wxAgo(S.k,3));
  rows+=mk('För 12 timmar sedan',wxAgo(S.k,12));
  rows+=mk('Dygnets medel',st.avg);
  var hh=function(t){var d=new Date(t);return (d.getHours()<10?'0':'')+d.getHours()+':'+(d.getMinutes()<10?'0':'')+d.getMinutes();};
  rows+='<div class="wxc-row"><span class="wxc-l">Dygnets högsta</span><span class="wxc-v">'+num(st.max,S.dec)+' '+S.u+'</span><span class="wxc-d t">'+hh(st.maxT)+'</span></div>';
  rows+='<div class="wxc-row"><span class="wxc-l">Dygnets lägsta</span><span class="wxc-v">'+num(st.min,S.dec)+' '+S.u+'</span><span class="wxc-d t">'+hh(st.minT)+'</span></div>';
  return '<div class="wxc">'+rows+'</div>';
}
/* ---- Insikter: bara sådant som mätvärdena faktiskt visar ---- */
function wxInsightList(){
  var out=[],P=PAL[curTheme]||PAL.dark;
  var pt=wxTrend('press',3);
  if(pt&&Math.abs(pt.d)>=1)out.push({ic:'gauge',c:'violet',lab:'Trycket '+(pt.d>0?'stiger':'faller'),
    txt:(pt.d>0?'Stigande':'Fallande')+' tryck, '+num(Math.abs(pt.d),1)+' hPa på tre timmar. '+(pt.d>0?'Ofta tecken på uppklarnande.':'Ofta tecken på att ett väderomslag är på väg.')});
  var w=vindMs(),g=byMs();
  if(w!=null&&g!=null&&w>0.5&&g>=w*1.7)out.push({ic:'wind',c:'gold',lab:'Byigt',
    txt:'Byvindarna är '+num(g/w,1)+' gånger medelvinden ('+num(g,1)+' mot '+num(w,1)+' m/s). Ojämn vind.'});
  var ws=wxStats('wind');
  if(ws&&ws.max>=10)out.push({ic:'wind',c:'warm',lab:'Dygnets kraftigaste vind',txt:'Högsta uppmätta vind det senaste dygnet är '+num(ws.max,1)+' m/s.'});
  var ts=wxStats('t_ute');
  if(ts)out.push({ic:'thermometer',c:'warm',lab:'Dygnets spann',txt:'Temperaturen har rört sig mellan '+num(ts.min,1)+'° och '+num(ts.max,1)+'°, ett spann på '+num(ts.max-ts.min,1)+' grader.'});
  var r24=cap(DEV.rain,'measure_rain.24h'),r1=cap(DEV.rain,'measure_rain.1h');
  if(r1!=null&&r1>0)out.push({ic:'cloud-rain',c:'rain',lab:'Det regnar nu',txt:num(r1,1)+' mm den senaste timmen, '+num(r24||0,1)+' mm under dygnet.'});
  else if(r24!=null&&r24>0)out.push({ic:'cloud-rain',c:'rain',lab:'Regn under dygnet',txt:num(r24,1)+' mm har fallit det senaste dygnet. Uppehåll just nu.'});
  var hu=cap(DEV.outdoor,'measure_humidity'),te=cap(DEV.outdoor,'measure_temperature');
  if(hu!=null&&hu>=93&&te!=null)out.push({ic:'cloud-fog',c:'blue',lab:'Hög luftfuktighet',txt:Math.round(hu)+' % fuktighet ute – dimma eller dagg är möjligt.'});
  var th=cap(DEV.smhi,'measure_thunder_probability_cp');
  if(th!=null&&th>=20)out.push({ic:'lightning',c:'gold',lab:'Åskrisk',txt:'SMHI anger '+Math.round(th)+' % risk för åska.'});
  var dt=wxTrend('t_ute',3);
  if(dt&&Math.abs(dt.d)>=2)out.push({ic:'thermometer',c:(dt.d>0?'warm':'cyan'),lab:(dt.d>0?'Blir varmare':'Blir kallare'),
    txt:'Temperaturen har '+(dt.d>0?'stigit':'sjunkit')+' '+num(Math.abs(dt.d),1)+' grader på tre timmar.'});
  return out;
}
/* ---- Nyckeltal: allt viktigt på ett ögonkast ---- */
function wxDew(t,rh){if(t==null||rh==null||rh<=0)return null;
  var a=17.27,b=237.7,g=(a*t)/(b+t)+Math.log(rh/100);return (b*g)/(a-g);}
function wxKey(ic,lab,val,sub,col){
  return '<div class="wxk-t"><div class="wxk-top">'
    +'<span class="wxk-ic ic-slot" data-ic="'+ic+'" style="color:'+col+'"></span>'
    +'<span class="wxk-l">'+esc(shortLab(lab))+'</span></div>'
    +'<span class="wxk-v">'+val+'</span>'
    +(sub?'<span class="wxk-s">'+esc(sub)+'</span>':'')+'</div>';}
function wxKeyHTML(){
  var P=PAL[curTheme]||PAL.dark,g=function(k){return cap(DEV.smhi,k);};
  var t=cap(DEV.outdoor,'measure_temperature'),feels=g('air_temperature_feels_like_cp');
  var hum=cap(DEV.outdoor,'measure_humidity');
  var press=cap(DEV.vader,'measure_pressure'); if(press==null)press=g('measure_air_pressure_cp');
  var w=vindMs(); if(w==null)w=g('measure_wind_speed_cp');
  var gu=byMs(),wd=cap(DEV.windNet,'measure_wind_angle');
  var r24=cap(DEV.rain,'measure_rain.24h'),cloud=g('mean_value_of_total_cloud_cover_cp');
  var vis=g('horizontal_visibility_cp'),th=g('measure_thunder_probability_cp');
  var dew=wxDew(t,hum);
  var pt=wxTrend('press',3);
  var h='';
  h+=wxKey('thermometer','Temperatur',(t==null?'–':num(t,1)+'<small>°</small>'),(feels!=null?'känns '+num(feels,0)+'°':''),P.warm);
  h+=wxKey('drop-half-bottom','Luftfuktighet',(hum==null?'–':Math.round(hum)+'<small> %</small>'),(dew!=null?'daggpunkt '+num(dew,1)+'°':''),P.water||P.blue);
  h+=wxKey('gauge','Lufttryck',(press==null?'–':Math.round(press)+'<small> hPa</small>'),
    (press==null?'':(press>=1013?'högtryck':'lågtryck')+(pt&&Math.abs(pt.d)>=0.5?(pt.d>0?' · stiger':' · faller'):'')),P.violet||P.blue);
  h+=wxKey('wind','Vind',(w==null?'–':num(w,1)+'<small> m/s</small>'),(wd!=null?'från '+windAbbr(wd):''),windCol(w));
  h+=wxKey('wind','Byvind',(gu==null?'–':num(gu,1)+'<small> m/s</small>'),(w!=null&&gu!=null&&w>0.5?num(gu/w,1)+'× medel':''),P.gold);
  h+=wxKey('cloud-rain','Regn 1 dygn',(r24==null?'–':num(r24,1)+'<small> mm</small>'),'',P.rain||P.blue);
  if(cloud!=null)h+=wxKey('cloud','Molnighet',Math.round(cloud)+'<small> %</small>','',P.blue);
  if(vis!=null)h+=wxKey('cloud-fog','Sikt',num(vis,1)+'<small> km</small>','',P.blue);
  if(th!=null)h+=wxKey('lightning','Åska',Math.round(th)+'<small> %</small>','',P.gold);
  return '<div class="wxk">'+h+'</div>';
}
/* ---- Hela väder-sidan ---- */
/* Skalan och tidslinjen. Bruten ur renderVader så att helskärmen ritar EXAKT
   samma reglage — inte en kopia som kan glida isär. Id:na måste förbli unika,
   och därför ritas kartan bara på ett ställe i taget: är helskärmen öppen
   lämnar vädersidan sin plats tom. */
/* Zoomen ligger numera I kartan, nere till höger, som på vilken karta som
   helst. Bredden står kvar men som en liten text nere till vänster — den är
   till för att tolka bilden och hör därför hemma i den. */
function wxZoomHTML(){
  var Z=radarViewZ();
  return '<div class="wxm-zin">'
    +'<button class="wxm-zb" onclick="event.stopPropagation();radarSetViewZ(1)"'
      +(Z>=9?' disabled':'')+' aria-label="Zooma in">+</button>'
    +'<button class="wxm-zb" onclick="event.stopPropagation();radarSetViewZ(-1)"'
      +(Z<=6?' disabled':'')+' aria-label="Zooma ut">–</button>'
    +'</div>'
    +'<div class="wxm-zskala">'+({6:'~740 km',7:'~370 km',8:'~185 km',9:'~92 km'}[Z]||'')+' brett</div>';
}
function wxReglageHTML(){
  var h='';
  /* Spolning: mätt radar där den finns, modellen före och efter. */
  var rutor=wxRutor();
  if(rutor.length>1){
    var f=wxRutaNu();
    if(!f)return h;
    h+='<div class="wxm-time">'
      +'<button class="wxm-z" id="wx-rplay" onclick="radarPlay()" aria-label="Spela upp">▶</button>'
      +'<button class="wxm-z wxm-zs" onclick="wxSteg(-1)" aria-label="Ett steg bakåt">‹</button>'
      +'<input class="wxm-slider" id="wx-rslider" type="range" min="0" max="'+(rutor.length-1)+'" value="'+_wxIdx+'" '
      +'oninput="radarStop();wxSetIdx(+this.value)" aria-label="Tidslinje"/>'
      +'<button class="wxm-z wxm-zs" onclick="wxSteg(1)" aria-label="Ett steg framåt">›</button>'
      +'<button class="wxm-z wxm-zs wxm-nu" id="wx-rnu" onclick="wxTillNu()"'+(_wxT==null?' disabled':'')
      +' aria-label="Tillbaka till nu">Nu</button>'
      +'<span class="wxm-rt'+((f.typ!=='radar'&&f.t>Date.now())?' fc':'')+'" id="wx-rtime">'
      +wxKlocka(f.t)+' · '+wxRel(f.t,f.typ)+' · '+wxKalla(f)+'</span>'
      +'</div>';}
  return h;
}
function wxFullOppna(){if(_wxFull)return;_wxFull=true;renderVader();}
function wxFullStang(){if(!_wxFull)return;_wxFull=false;_wxFullW=0;_wxFullH=0;radarStop();renderVader();}
function wxFullRita(){
  var o=$('wxfs');if(!o)return;
  if(!_wxFull){o.hidden=true;o.innerHTML='';return;}
  o.hidden=false;
  /* KARTAN RITAS I SKÄRMENS FORM, inte som en kvadrat med marginaler runt.
     Måtten SÄTTS här och står kvar så länge helskärmen är öppen — de skrivs
     inte om och tillbaka. Radarlagret ritas om långt efter det här anropet,
     och skulle då ha läst fel ram. Alternativet, att skala upp kvadraten tills
     den täcker, hade klippt bort halva kartan i sidled. */
  _wxFullW=Math.max(320,Math.round((typeof window!=='undefined'&&window.innerWidth)||RADAR_VIEW.W));
  _wxFullH=Math.max(320,Math.round((typeof window!=='undefined'&&window.innerHeight)||RADAR_VIEW.H));
  var karta=wxMapSVG();
  o.innerHTML='<div class="wxmap">'+karta+'</div>'
    +'<div class="wxfs-h">'
    +'<button class="wxfs-b" onclick="wxFullStang()">'+icon('arrow-left')+'Tillbaka</button>'
    +'<span class="wxfs-t">'+esc(WX_SHOWS.reduce(function(a,x){return x[0]===wxShow()?x[1]:a;},'Karta'))+'</span>'
    +'</div>'
    +(wxShow()!=='tryck'?wxZoomHTML():'')
    +'<div class="wxfs-ner">'+(wxShow()!=='tryck'?wxReglageHTML():'')+'</div>';
}
function renderVader(){
  var el=$('vdr-body');if(!el)return;
  var P=PAL[curTheme]||PAL.dark;
  var wd=cap(DEV.windNet,'measure_wind_angle'); if(wd==null)wd=cap(DEV.smhi,'measure_wind_direction_cp');
  var w=vindMs(); if(w==null)w=cap(DEV.smhi,'measure_wind_speed_cp');
  var h='';
  /* 1. Nuläget – samma väderkort som startsidan */
  h+='<section class="panel wx-card"><div class="wx">'+buildWeatherHTML()+'</div></section>';
  /* 2. Karta med vindfält – överst så man ser läget direkt */
  h+='<section class="panel"><div class="vdr-sec">Onsalahalvön</div>';
  /* Är helskärmen öppen ritas kartan DÄR och ingenting här — två kartor
     samtidigt skulle ge dubbla id:n, och då slutar tidslinjen fungera. */
  h+=_wxFull
    ? '<div class="wxm-tom">Kartan visas i helskärm.</div>'
    : ('<div class="wxmap">'+wxMapSVG()
       +'<button class="wx-full" onclick="wxFullOppna()" title="Helskärm" aria-label="Visa kartan i helskärm">'
       +icon('corners-out')+'</button>'
       +(wxShow()!=='tryck'?wxZoomHTML():'')+'</div>');
  if(wxShow()!=='tryck'&&!_wxFull){
    h+=wxReglageHTML();
    /* Vindfaktorn stalls dar forklaringen star - den ar inget man ror dagligen,
       men den maste ga att hitta nar overgangen till framskrivningen rycker. */
    if(_wxInfo&&framGar()){
      /* Egen klass, inte wxm-zoom: den raden ar kartans skala och ligger numera
         i kartans horn. Att lana klassen hade gjort dem omojliga att skilja at. */
      var ff=framForskjut(10), fkm=Math.round(Math.abs(ff?ff.m:0)/100)/10;
      if(ff&&ff.kalla==='radar'){
        /* Ingen faktor att ställa när rörelsen är mätt — det finns inget att
           kalibrera bort. Raden säger vad mätningen kom fram till i stället. */
        var mot=framRiktning(), ab=(mot==null)?null:windAbbr(mot);
        h+='<div class="wxm-fram" style="margin-top:6px"><span class="wxm-zl">'
          +'mätt ur radarn \u00b7 '+fkm+' km/10 min'+(ab?(' mot '+esc(ab)):'')+'</span></div>';
      }else{
        h+='<div class="wxm-fram" style="margin-top:6px">'
          +'<button class="wxm-z" onclick="framFaktorStep(-0.1)">\u2013</button>'
          +'<span class="wxm-zl">vind \u00d7<b id="fram-f">'+framFaktor().toFixed(1)+'</b>'
          +' \u00b7 '+fkm+' km/10 min</span>'
          +'<button class="wxm-z" onclick="framFaktorStep(0.1)">+</button></div>';
      }
    }}

  h+='<div class="wxm-opt"><span class="wxm-ol">Visa</span><div class="wxm-btns">';
  for(var q=0;q<WX_SHOWS.length;q++)h+='<button class="wxm-b'+(wxShow()===WX_SHOWS[q][0]?' on':'')+'" onclick="wxSetShow(\''+WX_SHOWS[q][0]+'\')">'+WX_SHOWS[q][1]+'</button>';
  h+='<button class="wxm-b wxm-i'+(_wxInfo?' on':'')+'" id="wxm-i" onclick="wxToggleInfo()" title="Vad visar kartan?" aria-label="Förklaring">i</button>';
  h+='</div></div>';
  h+='<div class="wxm-cap" id="wxm-cap"'+(_wxInfo?'':' style="display:none"')+'>'+(wxShow()==='tryck'
      ? '<b>Pilarna</b> är vinden i varje mätpunkt över Skandinavien: de pekar åt det håll det blåser, och blir längre ju hårdare vinden är. '
        +'<b>Tunna linjer</b> är isobarer – lika lufttryck, en linje var 4:e hPa. Ligger de tätt blåser det hårt. '
        +'<b>H</b> är högtryckscentrum, <b>L</b> lågtryck. '
        +'<b>Fronterna</b> ritas där temperaturen ändrar sig snabbast, alltså gränsen mellan två luftmassor: '
        +'röd linje med halvcirklar är varmfront, blå med trianglar är kallfront, och symbolerna sitter på den sida fronten rör sig åt. '
        +'Blåser vinden längs fronten i stället för tvärs över står den stilla – då ritas den blå och röd omväxlande. '
        +'Underlaget är Open-Meteos rutnät med ~100 km mellan punkterna, så läget är ungefärligt.'
      : ('<b>Pilarna</b> visar åt vilket håll vinden blåser'+(wd!=null?' – från '+windAbbr(wd)+(w!=null?', '+num(w,1)+' m/s':''):'')+'. '
         +'Vinden är mätt hemma, så samma pil gäller hela ytan. '
         +'<b>Färgskalan</b> går från blått för lätt och måttligt regn, via gult och rött för kraftigt, '
         +'till rosa och vitt som betyder skyfall eller hagel. Snö ritas i en egen blå skala:'
         +wxRainLegend()
         +(_radarFrames.length>1?('Med <b>spolningen</b> ser du hur regnområdena flyttat sig de senaste timmarna. '
             +(_radarFrames.length>_radarNow+1
               ? 'Stegen efter \'nu\' är radarns egen korttidsprognos och alltså inte uppmätta. '
               : '<b>Allt som visas är uppmätt</b> – RainViewers fria API ger bara historik, inte prognos. ')):'')
         +'Radarrutor finns bara till zoom 7, därför den här skalan. '
         +'Stegen efter \'nu\' är <b>samma radarbild förskjuten</b> '+framKallaText()+' — '
         +'skurarna flyttas, men de växer inte till och dör inte ut. '
         +'Väderdata från <b>RainViewer</b>.'))
    +'</div>';
  h+='</section>';
  /* 2. Mätvärden och graf i EN ruta. "Just nu" och "Dygnet" visade samma tal
        två gånger — först som kort, sedan som brickor ovanför grafen. */
  h+='<section class="panel">'
    +grafRubrik('wx','Mätvärden',infoBlock('wxgraf',
        'En bricka per mätvärde. Tryck för att visa eller dölja dess linje i '
        +'grafen. Dra i grafen för att läsa av alla tända serier vid en viss '
        +'tidpunkt. Serierna har <b>egen skala var</b> — lufttryck ligger runt '
        +'1000 och regn under 10, så en gemensam skala hade tryckt ihop allt '
        +'utom trycket. Kurvorna visar alltså formen, inte höjden mot varandra.'))
    /* Brickorna ÖVER grafen: man väljer vad som ska visas först och ser
       resultatet under. Med dem under läste man grafen innan man visste vilka
       serier som var tända. */
    +'<div class="wxb-grid">'+wxBrickorHTML()+'</div>'
    +wxMultiSVG('wx')+grafTidsval('wx')
    +'</section>';
  /* 5. Jämförelser för vald serie */
  h+='<section class="panel"><div class="vdr-sec">Jämförelser · '+esc(wxSer().lab.toLowerCase())+'</div>'+wxCompareHTML()+'</section>';
  /* 6. Insikter */
  var ins=wxInsightList();
  h+='<section class="panel"><div class="vdr-sec">Insikter</div>';
  if(!ins.length)h+='<div class="wx-empty">Inget särskilt att lyfta fram just nu – vädret är stabilt.</div>';
  else{h+='<div class="wxi">';
    for(var j=0;j<ins.length;j++){var I=ins[j];
      h+='<div class="wxi-c"><span class="wxi-ic ic-slot" data-ic="'+I.ic+'" style="color:'+((P[I.c])||P.blue)+'"></span>'
        +'<div class="wxi-b"><div class="wxi-l">'+esc(I.lab)+'</div><div class="wxi-t">'+esc(I.txt)+'</div></div></div>';}
    h+='</div>';}
  h+='</section>';
  el.innerHTML=h;
  try{renderTiles('vader');applyGrpVars($('stats-vader'),'--tl',CFG.tile);}catch(e){}
  try{wxvPassa(el);}catch(e){}
  wxFullRita();
  try{initIcons();}catch(e){}
}

/* ===== v766: VÄDERPOPUPEN =====
   Vädersidans väderhalva öppnar den här, som vindhalvan öppnar vindpopupen.
   Först läget nu som rutor, sedan SMHI:s prognos: kommande timmar som en rad
   att svepa i, kommande dagar en rad per dag. Prognosen är samma FORECAST som
   solmodellen redan hämtar (snow1g) – ingen ny källa. */
function vpHTML(){
  const g=k=>cap(DEV.smhi,k);
  const tOut=cap(DEV.outdoor,'measure_temperature'),ex=tempExtremes(tOut);
  const pres=cap(DEV.vader,'measure_pressure')||g('measure_air_pressure_cp'),tr=pressureTrend(pres);
  const moln=g('mean_value_of_total_cloud_cover_cp'),sikt=g('horizontal_visibility_cp'),aska=g('measure_thunder_probability_cp');
  const sol=wxSolTider();
  /* v770: prognosen överst – det är den man öppnar rutan för. Läget nu är
     uppslag och står under. */
  return '<div id="vp-prog">'+vpPrognosHTML()+'</div>'
    +'<div class="dsec">Nu</div>'
    +vpRad('Läge',esc(g('measure_weather_situation_cp')||'–'),wxIcon(g('measure_weather_situation_cp')),vpIkFarg(wxIcon(g('measure_weather_situation_cp'))))
    +vpRad('Ute',(tOut==null?'–':num(tOut,1)+' °C'),'thermometer','var(--hot)')
    +vpRad('Känns som',(g('air_temperature_feels_like_cp')==null?'–':num(g('air_temperature_feels_like_cp'),0)+' °C'),'thermometer','var(--warm)')
    +vpRad('Lägst idag',(ex.min==null?'–':num(ex.min,1)+' °C'),'thermometer-cold','var(--blue)')
    +vpRad('Högst idag',(ex.max==null?'–':num(ex.max,1)+' °C'),'thermometer-hot','var(--hot)')
    +vpRad('Luftfuktighet',(cap(DEV.outdoor,'measure_humidity')==null?'–':num(cap(DEV.outdoor,'measure_humidity'),0)+' %'),'drop-half-bottom','var(--blue)')
    +vpRad('Lufttryck',(pres==null?'–':num(pres,0)+' hPa'+(tr>0?' ↑':tr<0?' ↓':' →')),'gauge','var(--faint)')
    +vpRad('Regn 24 h',(cap(DEV.rain,'measure_rain.24h')==null?'–':num(cap(DEV.rain,'measure_rain.24h'),1)+' mm'),'cloud-rain','var(--blue)')
    +vpRad('Molnighet',(moln==null?'–':Math.round(moln)+'/8'),'cloud','var(--faint)')
    +vpRad('Sikt',(sikt==null?'–':num(sikt,0)+' km'),'cloud-fog','var(--faint)')
    +vpRad('Åska',(aska==null?'–':Math.round(aska)+' %'),'lightning','var(--gold)')
    +vpRad('Sol upp – ned',sol.upp+' – '+sol.ned,'sun-horizon','var(--gold)')
    +smhiStatusRad();}
/* En datarad med egen ikon – drRutor gör den till en ruta som de andra. */
function vpRad(k,v,ik,farg){
  return '<div class="drow" data-ik="'+ik+'" data-ikf="'+farg+'"><span class="dk">'+esc(k)+'</span><span class="dv">'+v+'</span></div>';}
/* SMHI:s väderkod (1–27) som ikon och text. Saknas koden räcker moln och
   nederbörd till en grov bild. Klart på natten blir en måne och halvklart ett
   moln (det finns ingen måne-med-moln-ikon). dag=true ger alltid dagsikonen –
   dagraderna sammanfattar dygnet, inte kvällen just nu. */
function vpSym(f,dag){
  const T=['','Klart','Nästan klart','Växlande molnighet','Halvklart','Molnigt','Mulet','Dimma',
    'Lätta regnskurar','Regnskurar','Kraftiga regnskurar','Åskskurar',
    'Lätta byar av snöblandat regn','Byar av snöblandat regn','Kraftiga byar av snöblandat regn',
    'Lätta snöbyar','Snöbyar','Kraftiga snöbyar','Lätt regn','Regn','Kraftigt regn','Åska',
    'Lätt snöblandat regn','Snöblandat regn','Kraftigt snöblandat regn','Lätt snöfall','Snöfall','Kraftigt snöfall'];
  const s=f.sym;let ik,txt=(s>=1&&s<=27)?T[s]:null;
  if(txt)ik=(s===11||s===21)?'lightning':s===7?'cloud-fog':((s>=15&&s<=17)||s>=25)?'snowflake'
    :s>=8?'cloud-rain':s<=2?'sun':s<=4?'cloud-sun':'cloud';
  else if(f.p!=null&&f.p>=0.1){const sno=f.temp!=null&&f.temp<=0;ik=sno?'snowflake':'cloud-rain';txt=sno?'Snö':'Regn';}
  else if(f.tcc==null){ik='cloud-sun';txt='';}
  else if(f.tcc<=2){ik='sun';txt='Klart';}
  else if(f.tcc<=5){ik='cloud-sun';txt='Halvklart';}
  else{ik='cloud';txt='Mulet';}
  if(!dag&&(ik==='sun'||ik==='cloud-sun')&&vpNatt(f.t))ik=(ik==='sun')?'moon':'cloud';
  return [ik,txt];}
/* v770: VÄDERIKONER I FÄRG. Gul sol och blixt, grå moln, blått regn, vit snö,
   ljusgrå dimma. Ikonerna är en enda form, så de tvåfärgade får en gradient med
   hårt skifte: molnen sitter ovanför regnet och dimman (skifte i höjdled),
   solen uppe till vänster om molnet (skifte på diagonalen). Gränserna är
   uppmätta i ikonerna ritade i 256 px: regnmolnets nederkant slutar på rad 167
   och dropparna börjar direkt under (66,5 %); dimmolnet slutar på rad 175 och
   raderna 176–190 är tomma (70 %). Färgerna är variabler (--vx-*) som
   byts med temat. */
function vpIkFarg(ik){
  return ({sun:'var(--gold)',moon:'var(--gold)',lightning:'var(--gold)',snowflake:'var(--vx-sno)',
    'cloud-rain':'var(--vx-regn)','cloud-fog':'var(--vx-dimma)'})[ik]||'var(--vx-moln)';}
function vpIkon(ik){
  const p=ICONS[ik];if(!p)return '';
  const TVA={'cloud-rain':['var(--vx-moln)','var(--vx-regn)',0,0,0,256,66.5],
    'cloud-fog':['var(--vx-moln)','var(--vx-dimma)',0,0,0,256,70],
    'cloud-sun':['var(--gold)','var(--vx-moln)',0,0,256,256,39]};
  const t=TVA[ik];
  if(!t)return '<svg class="ic" viewBox="0 0 256 256" aria-hidden="true" style="color:'+vpIkFarg(ik)+'">'+p+'</svg>';
  const id='vpg'+(++_vpIkN);
  return '<svg class="ic" viewBox="0 0 256 256" aria-hidden="true"><defs><linearGradient id="'+id+'" gradientUnits="userSpaceOnUse"'
    +' x1="'+t[2]+'" y1="'+t[3]+'" x2="'+t[4]+'" y2="'+t[5]+'">'
    +'<stop offset="'+t[6]+'%" style="stop-color:'+t[0]+'"/><stop offset="'+t[6]+'%" style="stop-color:'+t[1]+'"/></linearGradient></defs>'
    +'<g fill="url(#'+id+')">'+p+'</g></svg>';}
function vpNatt(t){try{const d=new Date(t);return solar(d,CONFIG.LAT,CONFIG.LON,-d.getTimezoneOffset()).elevation<-0.83;}catch(e){return false;}}
/* Nederbörden i snow1g är millimeter per timme. Prognosen glesnar till 3, 6
   och 12 timmar mellan punkterna längre fram, så varje punkt räknas för tiden
   fram till nästa – annars blir dygnssumman för låg de sista dagarna. */
function vpSteg(i){const a=FORECAST[i],b=FORECAST[i+1];
  return b?Math.max(1,Math.min(12,(b.t-a.t)/3600000)):1;}
function vpPrognosHTML(){
  if(!FORECAST||!FORECAST.length)
    return '<div class="dsec">Prognos</div><div class="vp-tom">Prognosen hämtas från SMHI…</div>';
  const nu=Date.now(),D=['sön','mån','tis','ons','tor','fre','lör'];
  /* Kommande timmar: de närmaste 24 punkterna från den pågående timmen. */
  let h='<div class="dsec">Kommande timmar <em class="dsec-x">• SMHI</em></div><div class="vp-tim">';
  let n=0;
  for(let i=0;i<FORECAST.length&&n<24;i++){const f=FORECAST[i];if(f.t<nu-1800000)continue;
    const sy=vpSym(f),d=new Date(f.t);
    h+='<div class="vp-t'+(n===0?' nu':'')+'" title="'+esc(sy[1])+'">'
      +'<span class="vp-tk">'+(n===0?'Nu':('0'+d.getHours()).slice(-2))+'</span>'
      +'<span class="vp-ti">'+vpIkon(sy[0])+'</span>'
      +'<span class="vp-tt">'+(f.temp==null?'–':num(f.temp,0)+'°')+'</span>'
      +'<span class="vp-tp">'+(f.p!=null&&f.p>=0.1?num(f.p,1)+' mm':'&nbsp;')+'</span>'
      +'<span class="vp-tw">'+(f.ws==null?'–':num(f.ws,0)+(f.gust!=null?'<small>('+num(f.gust,0)+')</small>':''))+'</span></div>';
    n++;}
  h+='</div><div class="vp-fork">Temperatur, nederbörd och vind i m/s, byvind inom parentes</div>';
  /* Kommande dagar: lägst/högst, nederbörd och vind per dygn. Ikonen är
     läget mitt på dagen; för i dag den närmaste punkten. */
  const dagar=[];
  for(let i=0;i<FORECAST.length;i++){const f=FORECAST[i];if(f.t<nu-1800000)continue;
    const d=new Date(f.t),k=d.getFullYear()*10000+d.getMonth()*100+d.getDate();
    let o=dagar.length?dagar[dagar.length-1]:null;
    if(!o||o.k!==k){if(dagar.length>=7)break;o={k:k,d:d,min:null,max:null,mm:0,vind:null,by:null,mitt:null,md:Infinity};dagar.push(o);}
    if(f.temp!=null){o.min=o.min==null?f.temp:Math.min(o.min,f.temp);o.max=o.max==null?f.temp:Math.max(o.max,f.temp);}
    if(f.p!=null)o.mm+=f.p*vpSteg(i);
    if(f.ws!=null)o.vind=Math.max(o.vind||0,f.ws);
    if(f.gust!=null)o.by=Math.max(o.by||0,f.gust);
    const md=dagar.length===1?0:Math.abs(d.getHours()+d.getMinutes()/60-13);
    if(md<o.md){o.md=md;o.mitt=f;}}
  h+='<div class="dsec">Kommande dagar</div><div class="vp-dagar">';
  dagar.forEach(function(o,j){
    const sy=vpSym(o.mitt,true),namn=j===0?'Idag':j===1?'Imorgon':(D[o.d.getDay()]+' '+o.d.getDate());
    h+='<div class="vp-d" title="'+esc(sy[1])+'">'
      +'<span class="vp-dn">'+namn+'</span>'
      +'<span class="vp-di">'+vpIkon(sy[0])+'</span>'
      +'<span class="vp-dt"><b>'+(o.max==null?'–':num(o.max,0)+'°')+'</b> '+(o.min==null?'':num(o.min,0)+'°')+'</span>'
      +'<span class="vp-dp">'+(o.mm>=0.1?num(o.mm,1)+' mm':'')+'</span>'
      +'<span class="vp-dw">'+(o.vind==null?'':num(o.vind,0)+(o.by!=null?'<small>('+num(o.by,0)+')</small>':'')+' m/s')+'</span></div>';});
  return h+'</div>';}
