/* js/enheter.js — Breveden (värmepumpen i gäststugan) och diskmaskinen.
 *
 * Filen innehåller BARA funktionsdeklarationer. Konstanter, tillstånd och allt
 * som körs direkt vid laddning ligger i js/start.js, som laddas sist, under
 * rubriken [enheter.js]. En funktion går att anropa oavsett vilken fil den står
 * i, men kod som körs vid laddning kan här anropa en funktion i en fil som inte
 * hunnit laddas. Lägg den därför aldrig här.
 */

/* ===== Breveden — värmepumpen i gäststugan =====
   HomeyScriptet "breveden" äger all bedömning. Dashboarden läser variabeln,
   triggar rätt flow och visar tillståndet. Trycket blockeras ALDRIG här, inte
   ens när nastaLage är 'ok' — då svarar skriptet med en push, och det är
   avsiktligt att den vägen går genom Homey. */

/* ===== BREVEDEN: HELA AC:N I EN RUTA =====
   Knappen startade och stoppade genom HomeyScriptet och det var allt. Nu
   öppnar den en ruta där allt går att ställa, med skriptets gamla beteende
   kvar som en av snabbknapparna.

   INGA LÄGESLISTOR SKRIVNA FÖR HAND. Enheten (Attefall, MELCloud) rapporterar
   själv vilka lägen, fläktsteg och spjällägen den har, och listorna skiljer
   sig mellan modeller. De läses därför ur enhetens egen capability vid
   ritning. Saknas listan ritas inga knappar för just den — ett värde jag inte
   kan belägga ska inte se ut som ett val.

   SKRIPTET ÄGER FORTFARANDE AUTOMATIKEN. Ett manuellt läge kan skrivas över
   nästa gång breveden-skriptet kör; det står i rutans infotext. Dashboarden
   har medvetet ingen egen bedömning av om kyla eller värme behövs. */
function brvDev(){return DEV.attefall;}
function brvCapObj(c){
  var d=DATA[brvDev()];
  return (d&&d.capabilitiesObj&&d.capabilitiesObj[c])?d.capabilitiesObj[c]:null;
}
/* Uppräkningsvärden ur enheten. Homey lämnar dem som values:[{id,title}], men
   fältet har hetat olika i olika versioner, så båda formerna tas emot. */
function brvVal(c){
  var o=brvCapObj(c);
  var v=o&&(o.values||o.options);
  if(!Array.isArray(v)||!v.length)return null;
  var ut=[];
  for(var i=0;i<v.length;i++){
    var x=v[i];
    if(x&&typeof x==='object'){if(x.id!=null)ut.push({id:x.id,namn:x.title||x.label||String(x.id)});}
    else if(x!=null)ut.push({id:x,namn:String(x)});
  }
  return ut.length?ut:null;
}
/* Talvärden med få steg (fläkten) ritas också som knappar. Är steget så fint
   att det blir ett dussin knappar duger de inte som knapprad. */
function brvNumVal(c){
  var o=brvCapObj(c);
  if(!o||o.type!=='number')return null;
  var mn=(o.min!=null)?o.min:null, mx=(o.max!=null)?o.max:null, st=o.step||1;
  if(mn==null||mx==null||!(mx>mn)||!(st>0))return null;
  if((mx-mn)/st>9)return null;
  var ut=[];
  for(var v=mn;v<=mx+1e-9;v+=st)ut.push({id:Math.round(v*1000)/1000,namn:String(Math.round(v*1000)/1000)});
  return ut;
}
function brvLageNamn(id){
  var v=brvVal('thermostat_mode');
  if(v)for(var i=0;i<v.length;i++)if(v[i].id===id)return acModeSv(id,true)||v[i].namn;
  return acModeSv(id,true);
}
function brvHarLage(id){
  var v=brvVal('thermostat_mode');
  if(!v)return true;                  /* listan okänd – hindra inte */
  for(var i=0;i<v.length;i++)if(v[i].id===id)return true;
  return false;
}
/* (Före v682: Auto och Håll 21 delade läge.) Regeln är kvar för det fall att två val delar läge. Utan den hade båda lyst så fort
   auto-läget var på med 21 inställt, och då säger markeringen ingenting. */
function brvSnabbPa(q,acOn,acMode,acTgt){
  if(q.av)return acOn===false;
  if(acOn!==true||acMode!==q.lage)return false;
  if(q.temp!=null)return acTgt===q.temp;
  for(var i=0;i<BRV_SNABB.length;i++){
    var o=BRV_SNABB[i];
    if(o!==q&&o.lage===q.lage&&o.temp!=null&&acTgt===o.temp)return false;
  }
  return true;
}
function brvSnabbLista(){
  var ut=[];
  for(var i=0;i<BRV_SNABB.length;i++){
    var q=BRV_SNABB[i];
    if(q.lage&&!brvHarLage(q.lage))continue;
    ut.push(q);
  }
  return ut;
}
function brvMerTog(){_brvMer=!_brvMer;brvPopRita();}
async function brvSnabb(k){
  var q=null;
  for(var i=0;i<BRV_SNABB.length;i++)if(BRV_SNABB[i].k===k)q=BRV_SNABB[i];
  if(!q)return;
  if(q.av){await brvSkriv([['onoff',false]]);return;}
  var steg=[];
  if(q.lage)steg.push(['thermostat_mode',q.lage]);
  if(q.temp!=null)steg.push(['target_temperature',q.temp]);
  steg.push(['onoff',true]);
  await brvSkriv(steg);
}
/* Skriver en sekvens och läser tillbaka. homeyPut svarar inte med värdet, så
   det som visas direkt efteråt är optimistiskt — nästa hämtning rättar det. */
async function brvSkriv(steg){
  if(_brvSkriver)return;
  _brvSkriver=true;_brvFel=null;brvPopRita();
  var id=brvDev();
  try{
    for(var i=0;i<steg.length;i++){
      await homeyPut(id,steg[i][0],steg[i][1]);
      var o=brvCapObj(steg[i][0]);
      if(o)o.value=steg[i][1];
    }
  }catch(e){_brvFel=(e&&e.message)||'kunde inte nå Homey';}
  _brvSkriver=false;brvPopRita();
  /* Skriptets logikvariabel läses om: den styr brickans läge och "Auto"-valet,
     och den vet inget om att vi just ställt om enheten för hand. */
  try{brvHamta();}catch(e){}
}
/* Löftet lämnas vidare, inte bara startas: annars går det inte att veta när
   skrivningen är klar — varken i ett prov eller i en framtida kedja. */
function brvSattLage(m){return brvSkriv(m==='off'?[['thermostat_mode','off']]:[['thermostat_mode',m],['onoff',true]]);}
function brvTempGr(){
  var o=brvCapObj('target_temperature');
  return {v:(o&&typeof o.value==='number')?o.value:null,st:(o&&o.step)||1,
    mn:(o&&o.min!=null)?o.min:10,mx:(o&&o.max!=null)?o.max:30};
}
function brvTempKlamp(v,g){return Math.max(g.mn,Math.min(g.mx,Math.round(v/g.st)*g.st));}
function brvUtkastText(v){return v==null?'Skickas när du trycker OK':'Nu '+num(v,0)+' \u00b0C \u2013 skickas när du trycker OK';}
function brvTempVisa(){
  var g=brvTempGr(),u=(_brvUtkast!=null)?_brvUtkast:g.v;
  var f=$('brv-tal-in'),ok=$('brv-ok'),mi=$('brv-minus'),pl=$('brv-plus');
  if(f&&document.activeElement!==f)f.value=(u==null?'':String(u));
  var andrat=(_brvUtkast!=null&&_brvUtkast!==g.v);
  if(ok){ok.disabled=!andrat||!!_brvSkriver;ok.classList.toggle('on',andrat);}
  var ut=$('brv-utkast');if(ut)ut.textContent=andrat?brvUtkastText(g.v):'';
  if(mi)mi.disabled=(u!=null&&u<=g.mn);
  if(pl)pl.disabled=(u!=null&&u>=g.mx);
}
function brvSattTemp(d){
  var g=brvTempGr(),u=(_brvUtkast!=null)?_brvUtkast:(g.v!=null?g.v:19);
  _brvUtkast=brvTempKlamp(Math.round((u+d*g.st)*10)/10,g);
  var f=$('brv-tal-in');if(f)f.value=String(_brvUtkast);
  brvTempVisa();
}
/* Inmatning i fältet. Kommatecken tas som decimaltecken; ett tomt eller
   ofullständigt fält lämnar utkastet orört tills det går att tolka. */
function brvTempIn(el){
  var t=String(el&&el.value||'').replace(',','.').trim();
  var g=brvTempGr(),ok=$('brv-ok'),x=Number(t);
  /* Utanför enhetens gränser (eller halvskrivet, som "2" på väg till "22")
     går inte att skicka. Inget klipps tyst — det som står är det som skickas. */
  if(!/^\d{1,2}(\.\d)?$/.test(t)||x<g.mn||x>g.mx){if(ok){ok.disabled=true;ok.classList.remove('on');}return;}
  _brvUtkast=x;brvTempVisa();
}
function brvTempOk(){
  var f=$('brv-tal-in'),g=brvTempGr();
  if(f){var t=String(f.value||'').replace(',','.').trim(),x=Number(t);
    /* Ett ogiltigt fält skickar ingenting — inte heller ett äldre utkast. */
    if(!/^\d{1,2}(\.\d)?$/.test(t)||x<g.mn||x>g.mx)return Promise.resolve();
    _brvUtkast=x;}
  if(_brvUtkast==null||_brvUtkast===g.v)return Promise.resolve();
  var v=brvTempKlamp(_brvUtkast,g);
  try{if(f&&f.blur)f.blur();}catch(e){}
  return brvSkriv([['target_temperature',v]]).then(function(){if(!_brvFel)_brvUtkast=null;brvPopRita();});
}
function brvSattCap(c,v){return brvSkriv([[c,v]]);}

/* En pil från spjället. Två linjer: en bred genomskinlig att träffa med
   fingret, och en smal synlig. Spetsen ritas som en liten triangel. */
/* Längden klipps mot bildens kant. En fast längd räckte inte: de brantaste
   pilarna sköt ut ovanför och under ramen och kapades av svg:n. Nu slutar
   varje pil vid väggen, vilket dessutom läser som luft som fyller rummet. */
function brvNaKant(x0,y0,dx,dy,W,H,mar){
  var t=1e9;
  if(dx>1e-6)t=Math.min(t,(W-mar-x0)/dx);
  if(dx<-1e-6)t=Math.min(t,(mar-x0)/dx);
  if(dy>1e-6)t=Math.min(t,(H-mar-y0)/dy);
  if(dy<-1e-6)t=Math.min(t,(mar-y0)/dy);
  return t;
}
function brvPil(x0,y0,vinkel,maxlangd,pa,cid,id,W,H){
  var r=vinkel*Math.PI/180, dx=Math.sin(r), dy=-Math.cos(r);
  var langd=Math.max(34,Math.min(maxlangd,brvNaKant(x0,y0,dx,dy,W,H,11)));
  var ax=x0+dx*12, ay=y0+dy*12, bx=x0+dx*langd, by=y0+dy*langd;
  var col=pa?'var(--blue)':'var(--line)';
  var sp=6, px=bx-dx*sp, py=by-dy*sp, nx=-dy*sp*0.62, ny=dx*sp*0.62;
  return '<g class="tr" onclick="brvSattCap(\''+cid+'\',\''+id+'\')">'
    +'<line x1="'+x0.toFixed(1)+'" y1="'+y0.toFixed(1)+'" x2="'+bx.toFixed(1)+'" y2="'+by.toFixed(1)
      +'" stroke="transparent" stroke-width="26" stroke-linecap="round"/>'
    +'<line x1="'+ax.toFixed(1)+'" y1="'+ay.toFixed(1)+'" x2="'+px.toFixed(1)+'" y2="'+py.toFixed(1)
      +'" stroke="'+col+'" stroke-width="'+(pa?3:2)+'" stroke-linecap="round"/>'
    +'<path d="M'+bx.toFixed(1)+' '+by.toFixed(1)+' L'+(px+nx).toFixed(1)+' '+(py+ny).toFixed(1)
      +' L'+(px-nx).toFixed(1)+' '+(py-ny).toFixed(1)+' Z" fill="'+col+'"/></g>';
}
/* Inomhusdelen, sedd framifrån eller ovanifrån beroende på vridning. */
function brvEnhetRit(x,y,b,h){
  return '<rect x="'+x+'" y="'+y+'" width="'+b+'" height="'+h+'" rx="'+(h/2.6).toFixed(1)
    +'" fill="var(--inset)" stroke="var(--line)" stroke-width="1.5"/>'
    +'<line x1="'+(x+7)+'" y1="'+(y+h-5).toFixed(1)+'" x2="'+(x+b-7)+'" y2="'+(y+h-5).toFixed(1)
    +'" stroke="var(--line)" stroke-width="2" stroke-linecap="round"/>';
}
/* Bilden för ett spjäll. lodratt=true ger sidvy, annars vy uppifrån.
   Lägen som saknas i kartan hamnar i knappraden under bilden. */
function brvSpjallFig(cid,karta,lodratt,rubrik,ikon){
  var lista=brvVal(cid);
  if(!lista||!lista.length)return '';
  var vald=cap(brvDev(),cid);
  var pilar=[],ovriga=[],i;
  for(i=0;i<lista.length;i++){
    if(karta[lista[i].id]!=null)pilar.push(lista[i]);else ovriga.push(lista[i]);
  }
  var h='<div class="cfg-sec brv-sekh">'+icon(ikon)+'<span>'+esc(rubrik)+'</span></div>';
  if(pilar.length){
    var W=300,H=126,sv='<svg class="brv-fig" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(rubrik)+'">';
    if(lodratt){
      /* Sidvy: enheten till vänster, luften ut åt höger. Pilvinkeln räknas
         från rakt upp, så 90 grader är rakt fram. */
      sv+=brvEnhetRit(10,44,64,34);
      for(i=0;i<pilar.length;i++)
        sv+=brvPil(78,61,90+karta[pilar[i].id],200,pilar[i].id===vald,cid,pilar[i].id,W,H);
    }else{
      /* Vy uppifrån: enheten överst, luften nedåt i rummet. */
      sv+=brvEnhetRit(105,8,90,26);
      for(i=0;i<pilar.length;i++)
        sv+=brvPil(150,38,180-karta[pilar[i].id],110,pilar[i].id===vald,cid,pilar[i].id,W,H);
    }
    h+=sv+'</svg>';
    var namn='';
    for(i=0;i<lista.length;i++)if(lista[i].id===vald)namn=lista[i].namn;
    h+='<div class="brv-figtxt">'+esc(namn||'\u2013')+'</div>';
  }
  if(ovriga.length)h+=brvKnappRad(cid,vald,ovriga);
  return h;
}
function brvPa(){var o=brvCapObj('onoff');return o?!!o.value:false;}
function brvTog(){return brvSkriv([['onoff',!brvPa()]]);}

/* Ritar om BARA rutans innehåll, inte hela vyn: att gå via openDetail hade
   rullat tillbaka till toppen mitt i en inställning. */
function brvPopRita(){
  try{
    if(_dlgWhich!=='breveden')return;
    var b=$('dlg-body');
    if(b)b.innerHTML=brvPopHTML();
  }catch(e){}
}
/* rahtml=true betyder att fmt lämnar färdig HTML (en ikon plus text) och inte
   ska escapas. Utan flaggan hade ikonens svg-taggar skrivits ut som text. */
function brvKnappRad(cap,vald,lista,fmt,rahtml){
  if(!lista||!lista.length)return '';
  var h='<div class="cfg-btns">';
  for(var i=0;i<lista.length;i++){
    var x=lista[i], pa=(x.id===vald);
    var txt=fmt?fmt(x):x.namn;
    h+='<button class="cfg-opt'+(pa?' on':'')+'" onclick="brvSattCap(\''+cap+'\','
      +(typeof x.id==='number'?x.id:('\''+String(x.id).replace(/'/g,'')+'\''))+')">'
      +(rahtml?txt:esc(txt))+'</button>';
  }
  return h+'</div>';
}
function brvPopHTML(){
  var ac=brvDev();
  var acT=cap(ac,'measure_temperature'),acTgt=cap(ac,'target_temperature'),
      acMode=cap(ac,'thermostat_mode'),acOn=cap(ac,'onoff'),acFan=cap(ac,'fan_speed'),
      acPw=cap(ac,'measure_power'),acKwh=cap(ac,'meter_power'),
      acDag=cap(ac,'meter_power.daily'),acOut=cap(ac,'measure_temperature.outdoor');
  var B=brvState();
  var h=ptsLineSVG(histV('t_breveden','brv-graf'),'violet','°C','brv-graf',HIST_H,'Breveden');

  h+='<div class="dsec">Snabbval'
    +infoBlock('brvsnabb','<b>Auto</b> startar enheten i dess eget auto-läge '
      +'med den temperatur som redan är inställd.<br>'
      +'<b>Värm 15</b> värmer till 15° och kyler aldrig.<br>'
      +'<b>Stäng av</b> stänger av enheten.<br><br>'
      +'Ett handpålagt läge kan skrivas över nästa gång breveden-skriptet kör. '
      +'Skriptet äger automatiken — dashboarden har med flit ingen egen bedömning.')
    +'</div>';
  var sn=brvSnabbLista();
  h+='<div class="brv-snabb">';
  for(var i=0;i<sn.length;i++){
    var q=sn[i];
    var pa=brvSnabbPa(q,acOn,acMode,acTgt);
    h+='<button class="brv-q'+(pa?' on':'')+'" onclick="brvSnabb(\''+q.k+'\')">'
      +icon(q.ic)+'<span>'+esc(q.lbl)+'</span></button>';
  }
  h+='</div>';
  if(_brvSkriver)h+='<div class="brv-status">Skickar till Homey…</div>';
  else if(_brvFel)h+='<div class="brv-status brv-fel">Gick inte: '+esc(_brvFel)+'</div>';

  /* FRAMME: temperaturen. Den ändrar man ofta och den hör ihop med snabbvalen. */
  var tO=brvCapObj('target_temperature');
  if(tO){
    /* Knapparna gråas när enhetens egen gräns är nådd — ett tryck som ändå
       skickar samma värde ser ut som att ingenting händer. */
    var tmn=(tO.min!=null)?tO.min:10, tmx=(tO.max!=null)?tO.max:30;
    var tu=(_brvUtkast!=null)?_brvUtkast:acTgt, tAndrat=(_brvUtkast!=null&&_brvUtkast!==acTgt);
    h+='<div class="dsec">Inställd temperatur</div>'
      +'<div class="brv-temp">'
      +'<button class="brv-step" id="brv-minus"'+((tu!=null&&tu<=tmn)?' disabled':'')
      +' onclick="brvSattTemp(-1)">\u2212</button>'
      +'<label class="brv-falt"><input id="brv-tal-in" type="text" inputmode="decimal" maxlength="4" autocomplete="off"'
      +' value="'+(tu==null?'':esc(String(tu)))+'" oninput="brvTempIn(this)"'
      +' onkeydown="if(event.key===\'Enter\'){event.preventDefault();brvTempOk();}"'
      +' aria-label="Inställd temperatur"><span>\u00b0C</span></label>'
      +'<button class="brv-step" id="brv-plus"'+((tu!=null&&tu>=tmx)?' disabled':'')
      +' onclick="brvSattTemp(1)">+</button>'
      +'<button class="brv-ok'+(tAndrat?' on':'')+'" id="brv-ok"'+((!tAndrat||_brvSkriver)?' disabled':'')
      +' onclick="brvTempOk()">OK</button></div>'
      +'<div class="brv-utkast" id="brv-utkast">'+(tAndrat?brvUtkastText(acTgt):'')+'</div>';
  }

  /* HOPFÄLLT: på/av, läge, fläkt och spjäll. Byggs bara om enheten har något
     att visa — en tom "visa mer" är värre än ingen alls. */
  var doldt='';
  doldt+='<div class="cfg-sec">På eller av</div>'
    +'<div class="cfg-btns"><button class="cfg-opt'+(acOn===true?' on':'')
    +'" onclick="brvTog()">'+(acOn===true?'På':'Av')+'</button></div>';
  var lagen=brvVal('thermostat_mode');
  if(lagen){
    doldt+='<div class="cfg-sec brv-sekh">'+icon('thermometer-simple')+'<span>Läge</span></div>'
      +brvKnappRad('thermostat_mode',acMode,lagen,function(x){
         return (BRV_MODE_IC[x.id]?icon(BRV_MODE_IC[x.id]):'')+'<span>'
           +esc(acModeSv(x.id,true)||x.namn)+'</span>';},true);
  }
  var flakt=brvVal('fan_speed')||brvNumVal('fan_speed');
  if(flakt)doldt+='<div class="cfg-sec brv-sekh">'+icon('fan')+'<span>Fläkt</span></div>'
    +brvKnappRad('fan_speed',acFan,flakt);
  doldt+=brvSpjallFig('vertical',BRV_LOD,true,'Luftriktning lodrätt','arrow-up');
  doldt+=brvSpjallFig('horizontal',BRV_SID,false,'Luftriktning i sidled','wind');
  if(doldt){
    var op=_brvMer?' open':'';
    h+='<button class="brv-mer'+op+'" id="brv-mer-btn" onclick="brvMerTog()">'
      +(_brvMer?'Visa mindre':'Visa mer')+icon('caret-down')+'</button>'
      +'<div class="brv-doldt'+op+'" id="brv-doldt">'+doldt+'</div>';
  }

  h+='<div class="dsec">Nu</div>'
    +dRow('Läge',esc(acModeSv(acMode,acOn)))
    +dRow('Inställd temperatur',acTgt==null?'\u2013':num(acTgt,0)+' \u00b0C')
    +dRow('Temperatur nu',acT==null?'\u2013':num(acT,1)+' \u00b0C')
    +(acT!=null&&acTgt!=null?dRow('Mot målet',(acT-acTgt>=0?'+':'')+num(acT-acTgt,1)+' \u00b0C'):'')
    +dRow('Fläkt',acFan==null?'\u2013':String(acFan))
    +dRow('Effekt nu',acPw==null?'\u2013':num(acPw,0)+' W')
    +(acDag!=null?dRow('Förbrukat idag',num(acDag,1)+' kWh'):'')
    +dRow('Förbrukat totalt',acKwh==null?'\u2013':num(acKwh,1)+' kWh')
    +(acOut!=null?dRow('Ute (AC)',num(acOut,1)+' \u00b0C'):'');
  return '<div class="brv-pop">'+h+'</div>';
}
function diskState(){return _disk;}
/* Bokad = ett objekt med en starttid som inte redan passerat med marginal.
   Vakten städar bort gamla bokningar, men den går bara var 15:e minut. */
function diskBokad(){
  var b=_disk;
  if(!b||!b.start)return false;
  return Date.now()<b.start+2*3600000;
}
/* MASKINENS EGEN STATUS.
   Home Connect rapporterar framsteg och återstående tid som TEXT — "42%" och
   "280:00" (minuter:sekunder, inte timmar). Därför plockas siffran ut med ett
   mönster i stället för att läsas som tal. */
function diskProc(){
  var r=cap(DISK_DEV,'bshc_string.progress');
  if(r==null)return null;
  var m=String(r).match(/(\d+(?:[.,]\d+)?)/);
  if(!m)return null;
  var v=parseFloat(m[1].replace(',','.'));
  return isFinite(v)?Math.max(0,Math.min(100,v)):null;
}
function diskMinKvar(){
  var r=cap(DISK_DEV,'bshc_string.remaining_time');
  if(r==null)return null;
  var m=String(r).match(/^(\d+):(\d+)/);
  if(!m)return null;
  return parseInt(m[1],10);            /* första talet är minuter */
}
function diskObsLas(){
  if(_diskObs)return _diskObs;
  try{_diskObs=JSON.parse(localStorage.getItem(OBS_KEY)||'null');}catch(e){}
  if(!_diskObs||typeof _diskObs!=='object')_diskObs={r:null,p:null,kor:false,t:0};
  if(_diskObs.p===undefined)_diskObs.p=null;   /* aldre minne utan framsteg */
  if(_diskObs.t===undefined)_diskObs.t=0;
  return _diskObs;
}
function diskObsSpara(){try{localStorage.setItem(OBS_KEY,JSON.stringify(_diskObs));}catch(e){}}
function diskObs(){
  var o=diskObsLas();
  var pa=cap(DISK_DEV,'onoff')===true,p=diskProc(),r=diskMinKvar(),nu=Date.now();
  if(!pa){
    if(o.kor||o.r!=null||o.p!=null||o.t){o.kor=false;o.r=null;o.p=null;o.t=0;diskObsSpara();}
    return;
  }
  var slut=false,igang=false;
  if(p!=null&&o.p!=null&&p<o.p)slut=true;        /* framsteget gick bakat */
  if(p!=null&&p>=100)slut=true;
  if(r!=null&&r<=0)slut=true;
  if(r!=null&&o.r!=null&&r>o.r)slut=true;        /* tiden hoppade upp */
  if(p!=null&&p>0&&p<100)igang=true;
  if(r!=null&&o.r!=null&&r<o.r)igang=true;       /* den raknar ner */
  var ny=o.kor;
  /* Slut vager tyngre an igang: den situation som last knappen var just att
     ett slut inte kande igen sig, och en falsk slackning rattar sig sjalv vid
     nasta avlasning medan ett falskt tant lage inte gor det. */
  if(slut)ny=false; else if(igang)ny=true;
  var rort=(p!==o.p||r!==o.r);
  if(rort||!o.t)o.t=nu;
  else if(ny&&(nu-o.t)>DISK_STILLA)ny=false;     /* helt stilla = star bara pa */
  if(ny!==o.kor||r!==o.r||p!==o.p){o.kor=ny;o.r=r;o.p=p;diskObsSpara();}
}
/* Laget kommer fran diskObs, som ar den enda som ser hur talen ROR sig.
   Genvagen "framsteg mellan 1 och 99 = igang" finns kvar men BARA innan nagot
   observerats: annars kunde den halla knappen tand mot bade bakat-regeln och
   stilleståndsregeln, som ju bygger pa att ett fruset tal inte betyder nagot.
   Det var samma sorts genvag som lat det gamla laset sitta kvar. */
function diskKor(){
  if(cap(DISK_DEV,'onoff')!==true)return false;
  var o=diskObsLas();
  if(!o.t){var p=diskProc();if(p!=null&&p>0&&p<100)return true;}
  return !!o.kor;
}
/* v760: ETT LÄGE FÖR ALLA VISNINGAR. Rutan, popupen, glöden och enhetslistan
   läste bara onoff – och maskinen står på dygnet runt med "0 %" och "280:00",
   så allt sade "kör" och visade ett klockslag för klar även när den stod still.
   Knappen och På nu använde redan diskKor(). Nu gör alla det.
     'av'   onoff = false
     'redo' på, men går inte (står i vila med sitt förvalda program)
     'kor'  går – framsteg och tid kvar visas bara då
   diskObs() körs här också: förut kördes den bara när knapparna ritades. */
function diskLage(){
  /* Inte i historikläget: då svarar cap() med gamla värden, och observationen
     av hur talen rör sig skulle skrivas över med dem. */
  if(typeof _timeActive==='undefined'||!_timeActive){try{diskObs();}catch(e){}}
  if(cap(DISK_DEV,'onoff')!==true)return 'av';
  return diskKor()?'kor':'redo';
}
function diskKl(){
  var b=_disk;
  if(!b||!b.start)return '';
  return hhmm(new Date(b.start));
}
/* "03:00" om det är idag, annars "sön 03:00" — en bokning till natten efter
   ska inte se ut som om den startar om en kvart. */
function diskNar(){
  var b=_disk;if(!b||!b.start)return '';
  var idag=dayKey(new Date()), da=dayKey(new Date(b.start));
  if(idag===da)return diskKl();
  var v=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',weekday:'short'}).format(new Date(b.start));
  return v.replace('.','')+' '+diskKl();
}
async function diskHamta(){
  if(_diskHamtar)return _disk;
  _diskHamtar=true;
  var tk=CONFIG.WRITE_TOKEN||CONFIG.TOKEN, vagar=brvVagar();
  for(var i=0;i<vagar.length;i++){
    try{
      var t=withTimeout(8000);
      /* Hela listan, och plocka vår ur den. Ett anrop i stället för två, och
         det fungerar även första gången innan id:t är känt. */
      var r=await fetch(vagar[i]+'/api/manager/logic/variable/',
        {headers:{Authorization:'Bearer '+tk},signal:t.signal});
      t.clear();
      if(!r.ok)throw new Error('HTTP '+r.status);
      var lista=await r.json();
      var arr=Array.isArray(lista)?lista:Object.values(lista||{});
      var v=null;
      for(var q=0;q<arr.length;q++)if(arr[q]&&arr[q].name===DISK_VAR_NAMN){v=arr[q];break;}
      if(!v){_disk=null;_diskAt=Date.now();break;}
      _diskVarId=v.id;
      var raa=(v.value!=null)?v.value:'';
      /* Tom sträng är ett giltigt svar: ingen bokning. Den ska nolla knappen,
         inte lämna den tänd med gammal tid. */
      if(typeof raa==='string'&&!raa.trim()){_disk=null;_diskAt=Date.now();break;}
      var o=(typeof raa==='string')?JSON.parse(raa):raa;
      if(o&&typeof o==='object'){_disk=o;_diskAt=Date.now();break;}
    }catch(e){/* nästa väg; faller alla behålls senast kända läge */}
  }
  _diskHamtar=false;
  try{renderControls();}catch(e){}
  return _disk;}
/* Bokar eller avbokar. Samma vägval som Breveden: ett misslyckat anrop över
   lokalt nät ska inte betyda att knappen är död när man är borta. */
async function diskTryck(){
  var flow=diskBokad()?DISK_FLOW_AVBOKA:DISK_FLOW_BOKA;
  _diskVanta=Date.now();
  try{renderControls();}catch(e){}
  var tk=CONFIG.WRITE_TOKEN||CONFIG.TOKEN, vagar=brvVagar(), ok=false;
  for(var i=0;i<vagar.length&&!ok;i++){
    try{
      var t=withTimeout(9000);
      var r=await fetch(vagar[i]+'/api/manager/flow/flow/'+flow+'/trigger',
        {method:'POST',headers:{Authorization:'Bearer '+tk,'Content-Type':'application/json'},
         body:'{}',signal:t.signal});
      t.clear();
      if(r.ok)ok=true;
    }catch(e){}
  }
  /* Skriptet behöver en stund på sig innan variabeln är skriven. */
  setTimeout(function(){_diskVanta=0;diskHamta();},2500);
  setTimeout(function(){diskHamta();},7000);
  return ok;}

function brvState(){return _brv;}
/* v702: värmepumpens läge just nu, direkt ur enheten. Arbetar = påslagen och
   drar mer än 150 W (samma gräns som På nu-raden). I läget auto säger enheten
   inte om den kyler eller värmer; riktningen tas då ur rumstemperaturen mot
   börvärdet — en härledning, inte ett värde enheten rapporterar. */
function brvNu(){
  var d=DATA&&DATA[DEV.attefall];if(!d||!d.capabilitiesObj)return null;
  var t=cap(DEV.attefall,'measure_temperature'),on=cap(DEV.attefall,'onoff'),
      w=cap(DEV.attefall,'measure_power'),md=cap(DEV.attefall,'thermostat_mode'),mal=cap(DEV.attefall,'target_temperature');
  if(t==null&&on==null)return null;
  var pa=(on===true),arbetar=pa&&Number(w)>150,lage=String(md||'');
  if(lage!=='cool'&&lage!=='heat'&&t!=null&&mal!=null)lage=(t>mal)?'cool':(t<mal?'heat':lage);
  return {temp:(t!=null&&isFinite(t))?t:null,pa:pa,arbetar:arbetar,lage:lage,mal:(mal!=null&&isFinite(mal))?mal:null};
}
/* v741: TEXTEN FÅR ALDRIG MOTSÄGA BÖRVÄRDET. "värmer mot 16°" stod när rummet
   var 17°: värmepumpen arbetar för att HÅLLA 16 efter sin egen givare, som
   rapporterar i halva grader och ofta ligger under rumsvärdet som visas.
   Nu: "värmer mot X" bara när rummet är under X, "kyler mot X" bara när det är
   över X – annars "håller X°". Utan rumstemperatur sägs ingen riktning mot X. */
function brvLageText(N){
  var t=N.temp,m=N.mal,M=(m!=null)?num(m,0)+'°':'';
  if(N.lage==='heat'){if(t==null||m==null)return 'värmer';return (t<m)?('värmer mot '+M):('håller '+M);}
  if(N.lage==='cool'){if(t==null||m==null)return 'kyler';return (t>m)?('kyler mot '+M):('håller '+M);}
  return (m!=null)?('håller '+M):'igång';}
/* Äldre än 45 minuter räknas som osäkert — Homey uppdaterar var 15:e minut. */
function brvGammal(B){
  if(!B)return true;
  var t=B.uppdaterad||_brvAt;
  return !t||(Date.now()-t)>45*60000;}
function brvSedan(start){
  var m=Math.round((Date.now()-start)/60000);
  if(m<1)return 'nyss';
  if(m<60)return m+' min';
  var h=Math.floor(m/60),r=m-h*60;
  return h+'h'+(r?' '+r+'min':'');}

/* Vägar att prova, i tur och ordning: den som redan fungerar först, sedan
   molnet. Borta hemifrån svarar inte det lokala nätet, och den ordinarie
   basvalsslingan hinner inte alltid byta väg innan man trycker. Att prova
   molnet direkt efteråt är billigare än att låta trycket falla. */
function brvVagar(){
  var ut=[],b=BASE&&BASE.replace(/\/$/,'');
  if(b)ut.push(b);
  try{var mo=credMoln();if(mo&&ut.indexOf(mo)<0)ut.push(mo);}catch(e){}
  try{var ln=credLan();if(ln&&ut.indexOf(ln)<0)ut.push(ln);}catch(e){}
  if(!ut.length){try{ut=candidates();}catch(e){}}
  return ut;}

async function brvHamta(){
  if(_brvHamtar)return _brv;
  _brvHamtar=true;
  var tk=CONFIG.WRITE_TOKEN||CONFIG.TOKEN, vagar=brvVagar();
  for(var i=0;i<vagar.length;i++){
    try{
      var t=withTimeout(8000);
      var r=await fetch(vagar[i]+'/api/manager/logic/variable/'+BRV_VAR,
        {headers:{Authorization:'Bearer '+tk},signal:t.signal});
      t.clear();
      if(!r.ok)throw new Error('HTTP '+r.status);
      var j=await r.json();
      var raa=(j&&j.value!=null)?j.value:null;
      var o=(typeof raa==='string')?JSON.parse(raa):raa;
      if(o&&typeof o==='object'){
        _brv=o;_brvAt=Date.now();
        /* Fungerade en annan väg än den valda, låt resten av dashboarden
           få veta — annars fortsätter den mot ett nät som inte svarar. */
        if(vagar[i]!==BASE){BASE=vagar[i];_baseAt=Date.now();}
        break;
      }
    }catch(e){
      /* Nästa väg. Faller alla: BEHÅLL senast kända värde. Ett nätfel ska inte
         tömma kortet — det markeras som gammalt, vilket är ärligare. */
    }
  }
  _brvHamtar=false;
  try{renderTiles('flode');}catch(e){}
  try{renderControls();}catch(e){}
  return _brv;}

/* INGEN ANROPARE KVAR sedan v608. Knappen i knapprutan öppnar rutan (v606) och
   snabbvalet Auto ställer numera enhetens eget auto-läge i stället för att
   trigga skriptets flow. Funktionen står kvar orörd — skriptet finns och
   flowet finns, det är bara vägen dit från dashboarden som är borta. Säg till
   om den ska tillbaka som ett eget val. */
async function brvTryck(){
  var B=_brv;
  var flow=(B&&B.aktiv)?BRV_FLOW_AV:BRV_FLOW_PA;
  _brvVanta=Date.now();
  try{renderTiles('flode');}catch(e){}
  /* Trycket provar samma vägar som läsningen. Ett misslyckat anrop över det
     lokala nätet ska inte betyda att knappen är död när man är borta. */
  var tk=CONFIG.WRITE_TOKEN||CONFIG.TOKEN, vagar=brvVagar(), gick=false;
  for(var i=0;i<vagar.length&&!gick;i++){
    try{
      var t=withTimeout(9000);
      var r=await fetch(vagar[i]+'/api/manager/flow/flow/'+flow+'/trigger',
        {method:'POST',headers:{Authorization:'Bearer '+tk,'Content-Type':'application/json'},
         body:'{}',signal:t.signal});
      t.clear();
      if(!r.ok)throw new Error('HTTP '+r.status);
      gick=true;
      if(vagar[i]!==BASE){BASE=vagar[i];_baseAt=Date.now();}
    }catch(e){}
  }
  if(!gick){_brvVanta=0;try{toast&&toast('Kunde inte nå Homey');}catch(e){}
    try{renderTiles('flode');renderControls();}catch(e){}return;}
  /* Variabeln uppdateras inom någon sekund. Hämta om några gånger i stället
     för att vänta på nästa ordinarie cykel. */
  [2000,5000,10000].forEach(function(ms){setTimeout(function(){brvHamta();diskHamta();},ms);});
  setTimeout(function(){_brvVanta=0;try{renderTiles('flode');}catch(e){}},11000);}

async function homeyTriggerFlow(type,id){const tk=CONFIG.WRITE_TOKEN||CONFIG.TOKEN,t=withTimeout(8000);
  const path=type==='advanced'?'/api/manager/flow/advancedflow/':'/api/manager/flow/flow/';
  const r=await fetch(BASE.replace(/\/$/,'')+path+id+'/trigger',{method:'POST',headers:{Authorization:'Bearer '+tk,'Content-Type':'application/json'},body:'{}',signal:t.signal});
  t.clear();if(!r.ok)throw new Error('HTTP '+r.status);return true;}
