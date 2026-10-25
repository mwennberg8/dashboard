# Dashboarden

Hemmets dashboard för Homey – energi, väder och styrning. Ren HTML, CSS och JS
utan byggsteg, publicerad med GitHub Pages från `main`
(mwennberg8.github.io/dashboard). En push till `main` är live inom en minut;
öppna dashboarder laddar om sig själva.

Två hus:

- **Gottskär** – `index.html` + `js/`
- **Göteborg** – `gbg/gbg.html`, en enda fil med all kod

Kommentarer, namn och commits skrivs på svenska.

## Gottskär: `index.html` och `js/`

`index.html` har bara HTML, CSS och tre små inline-skript: manifestet,
plattramen och husvakten. All annan kod ligger i `js/`:

- **Ämnesfilerna** (`grund.js`, `grafer.js`, `vader.js`, `batteri.js`,
  `installningar.js` med flera) innehåller **bara funktionsdeklarationer**.
  Lägg aldrig kod som körs vid laddning där. Den kan anropa en funktion i en fil
  som inte hunnit laddas.
- **`js/start.js` laddas sist.** Där ligger konstanter, tillstånd och allt som
  körs direkt vid laddning, i samma ordning som när koden låg i en enda fil.
  Rubrikerna `[fil.js]` visar var avsnittets funktioner ligger.
- **Ny js-fil:** lägg till en `<script src="js/….js">` före `start.js` i
  `index.html`, och lägg in filen i `SKAL` i `sw.js`.
- **Version:** höj `APP_VERSION` i `js/start.js` (`v764` → `v765`) vid varje
  ändring.

Funktionerna är globala och anropas från `onclick` i HTML-strängar. Escapa
text som hamnar i HTML med `esc()`.

## Göteborg: `gbg/gbg.html`

En fil. Höj `APP_VERSION` (`v1.81.0` → `v1.82.0`) vid varje ändring.

## Husvakten

Blocket `husvakt 1.8.0` sist i både `index.html` och `gbg/gbg.html` väljer vilket
hus som visas. Det ska vara **tecken för tecken identiskt** i båda filerna.
Ändras det på ett ställe ändras det på båda, och versionen i rubriken höjs.

## Service worker (`sw.js`)

Delas av båda husen. Den hämtar från nätet först och använder cachen bara
offline. Ändras listan `SKAL`, höj `CACHE` (`dashboard-v3` → `dashboard-v4`).

## Innan du pushar

- Syntaxkontroll av alla js-filer: `for f in js/*.js sw.js; do node --check "$f"; done`
- Demoläget fungerar utan Homey. Öppna sidan, välj demo i startrutan och gå
  igenom flikarna (Hem, Insikter, Jämför, Väder) utan JS-fel. Chromium och
  Playwright finns i molnmiljön.
- Ladda aldrig upp en gammal hel `index.html` – den har kod som numera ligger i
  `js/` och skulle krocka.

## Commits

En rad som börjar med versionen och sammanfattar vad som ändrats och varför:

- `v765: …` för Gottskär
- `gbg v1.82.0: …` för Göteborg

Arbeta på en egen gren om inget annat sägs. Pusha till `main` när ägaren ber om
att ändringen ska bli live.
