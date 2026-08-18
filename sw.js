/*  sw.js — service worker för dashboarden
 *  ---------------------------------------------------------------------------
 *  Enda uppgiften: sidan ska gå att öppna utan internet.
 *
 *  Filen ligger på GitHub Pages, men datan hämtas lokalt från Homey. Utan cache
 *  betyder det att en trasig internetförbindelse gör dashboarden oåtkomlig —
 *  trots att Homey står tre meter bort och svarar utmärkt.
 *
 *  STRATEGI: nätet först, cachen som reserv.
 *
 *  Det motsatta — cachen först — hade startat snabbare, men lett till en
 *  loop: dashboarden har en egen uppdateringskontroll som hämtar sidan med
 *  `cache: 'no-store'`, jämför mot den laddade, och laddar om vid skillnad.
 *  Serverade vi den gamla ur cachen efter omladdningen skulle den upptäcka
 *  skillnaden igen, och om igen, i all oändlighet.
 *
 *  Med nätet först får man alltid den färska filen när man är uppkopplad,
 *  precis som utan service worker, och cachen används bara när nätet tiger.
 *
 *  Anrop till Homey, SMHI, Open-Meteo och kartrutor rörs aldrig. De ska vara
 *  färska eller misslyckas — en cachad temperatur är värre än ingen.
 */

const CACHE = 'dashboard-v2';

/* Det som behövs för att sidan ska kunna starta. Ikonerna har versionslösa
   namn men byts sällan; blir de fel räcker en avinstallation. */
const SKAL = [
  './',
  './index.html',
  /* Göteborgsdashboarden ligger under samma scope och måste finnas i cachen —
     annars faller en offline-navigering dit tillbaka på startsidan, som är
     Gottskär. Det ser ut som ett växlingsfel men är den här reserven. */
  './gbg/gbg.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './icon-morgon.png',
  './icon-kvall.png',
  './icon-sammanfattning.png',
  './badge-96.png',
];

self.addEventListener('install', (e) => {
  /* addAll faller om EN enda fil saknas, och då installeras ingenting alls.
     Var fil för sig, så en saknad ikon inte sänker hela cachen. */
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(SKAL.map((u) => c.add(u).catch(() => {})));
    /* Vänta inte på att alla flikar stängs. */
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const namn = await caches.keys();
    await Promise.all(namn.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

/* Hämta med tidsgräns. Ett nät som svarar långsamt men inte alls — hotellwifi,
   mobil i källaren — är värre än ett som är helt nere, eftersom fetch då kan
   hänga i minuter innan den ger upp. */
function medTidsgrans(req, ms) {
  return new Promise((klar, fel) => {
    const t = setTimeout(() => fel(new Error('timeout')), ms);
    fetch(req).then((r) => { clearTimeout(t); klar(r); },
      (e) => { clearTimeout(t); fel(e); });
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (x) { return; }

  /* Bara vår egen katalog. Homey, SMHI, Open-Meteo och kartrutor går orörda
     förbi — de ska vara färska eller misslyckas. */
  if (url.origin !== self.location.origin) return;
  const bas = self.location.pathname.replace(/[^/]*$/, '');
  if (url.pathname.indexOf(bas) !== 0) return;

  e.respondWith((async () => {
    try {
      const svar = await medTidsgrans(req, 4000);
      /* Spara bara riktiga svar. En 404-sida i cachen är värre än inget:
         den serveras sedan glatt varje gång man är offline. */
      if (svar && svar.ok && svar.status === 200) {
        const kopia = svar.clone();
        caches.open(CACHE).then((c) => c.put(req, kopia)).catch(() => {});
      }
      return svar;
    } catch (fel) {
      const cachad = await caches.match(req, { ignoreSearch: true });
      if (cachad) return cachad;
      /* En navigering utan träff: fall tillbaka på startsidan. Adressen kan ha
         en frågesträng (?kronika=…) som aldrig cachats för sig. */
      if (req.mode === 'navigate') {
        /* Reservfil efter vilket hus adressen gäller. Hårdkodat index.html här
           gav Gottskär-dashboarden på Göteborgs adress när nätet var nere. */
        const gbg = url.pathname.indexOf(`${bas}gbg/`) === 0;
        const start = gbg
          ? (await caches.match(`${bas}gbg/gbg.html`) || await caches.match(`${bas}gbg/`))
          : (await caches.match(`${bas}index.html`) || await caches.match(bas));
        if (start) return start;
      }
      return new Response('Offline och inget i cachen.', {
        status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  })());
});

/*  ===== Push =====
 *  Chrome levererar även med skärmen släckt och fliken stängd. Nyttolasten
 *  kommer från Homey-appen och innehåller bara det som behövs: rubrik och
 *  vilken period notisen gäller.
 */
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { titel: e.data ? e.data.text() : '' }; }
  const titel = d.titel || 'Ny sammanfattning';
  const bas = self.location.pathname.replace(/[^/]*$/, '');
  const url = d.dag ? `${bas}?notis=${encodeURIComponent(d.dag)}`
    : (d.period ? `${bas}?kronika=${encodeURIComponent(d.period)}` : bas);
  /* Ikon efter slag: sol på morgonen, måne på kvällen, hus för
     sammanfattningarna. Notisen går att känna igen innan man läst den. */
  const slag = d.dag ? (/-k($|-)/.test(d.dag) ? 'kvall' : 'morgon') : 'sammanfattning';
  e.waitUntil(self.registration.showNotification(titel, {
    body: d.prov ? 'Provnotis — allt fungerar.' : 'Tryck för att läsa.',
    icon: `${bas}icon-${slag}.png`,
    /* BADGE är statusradsikonen, och Android maskar den till en silhuett: bara
       alfakanalen används, all färg kastas. Den färgglada appikonen blev därför
       en vit klump. badge-96.png är en ren form. */
    badge: `${bas}badge-96.png`,
    tag: d.dag ? `dag-${d.dag}` : (d.period ? `kronika-${d.period}` : 'kronika'),
    renotify: true,
    data: { url },
    actions: [{ action: 'las', title: 'Läs' }],
  }));
});

/* Klick: fokusera en flik som redan står på dashboarden i stället för att
   öppna en till. Att sluta med fem flikar är ett irritationsmoment som gör att
   man stänger av notiserna. */
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil((async () => {
    const bas = self.location.pathname.replace(/[^/]*$/, '');
    let lista = [];
    try {
      lista = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    } catch (x) { lista = []; }

    /* En flik som redan står på dashboarden: navigera dit och fokusera.
       navigate() kastar om fliken inte kontrolleras av den här service workern,
       och FÖRUT svaldes felet — då gjorde klicket ingenting alls, notisen bara
       försvann. Nu faller vi tillbaka på att öppna ett fönster. */
    for (const c of lista) {
      if (c.url.indexOf(self.location.origin + bas) !== 0) continue;
      try {
        if (c.navigate) await c.navigate(url);
        if (c.focus) return await c.focus();
      } catch (x) {
        /* Gick inte att styra fliken — öppna i stället. */
        break;
      }
    }

    /* Inget fönster att återanvända, eller navigeringen föll: öppna ett nytt.
       openWindow kan också kasta, och då finns ingenting mer att göra — men
       felet ska synas i loggen i stället för att försvinna. */
    try {
      return await self.clients.openWindow(url);
    } catch (x) {
      /* Sista utvägen: fokusera vilket fönster som helst. Bättre att appen
         öppnas på fel sida än att trycket känns dött. */
      for (const c of lista) {
        try { if (c.focus) return await c.focus(); } catch (y) { /* nästa */ }
      }
      return null;
    }
  })());
});
