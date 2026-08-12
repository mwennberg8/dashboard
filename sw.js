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

const CACHE = 'dashboard-v1';

/* Det som behövs för att sidan ska kunna starta. Ikonerna har versionslösa
   namn men byts sällan; blir de fel räcker en avinstallation. */
const SKAL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
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
        const start = await caches.match(`${bas}index.html`)
          || await caches.match(bas);
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
  const url = d.period ? `${bas}?kronika=${encodeURIComponent(d.period)}` : bas;
  e.waitUntil(self.registration.showNotification(titel, {
    body: d.prov ? 'Provnotis — allt fungerar.' : 'Tryck för att läsa.',
    icon: `${bas}icon-192.png`,
    badge: `${bas}icon-192.png`,
    /* Guldtonen från dashboarden, så notisen känns igen. */
    tag: d.period ? `kronika-${d.period}` : 'kronika',
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
    const lista = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const bas = self.location.pathname.replace(/[^/]*$/, '');
    for (const c of lista) {
      if (c.url.indexOf(self.location.origin + bas) === 0) {
        try { await c.navigate(url); } catch (x) { /* äldre Chrome tillåter inte navigate */ }
        return c.focus();
      }
    }
    return self.clients.openWindow(url);
  })());
});
