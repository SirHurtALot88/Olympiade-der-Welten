# Sponsor-Wappen: nur die genutzten, eingebaut auf den Seiten (22.11.)

Chris, 22.11.: „generier nur die Sponsorenwappen, die gerade genutzt werden, und bau die auf den Seiten ein“.

## 1. Welche Marken genutzt werden

Gelesen aus dem Live-Abbild (`origin/live-save`, Tabelle `active_saves`), `seasonState.sponsorContractsByTeamId` → `sponsorParentBrandId`:

| Spielstand | Verträge | eindeutige Dachmarken |
|---|---:|---:|
| `new-game-1795114260527-nzr0z9` (Chris, Saison 1, Spieltag 12) | 32 | 32 |
| `new-game-1785412846578-h0z7cl` (zweiter aktiver Spielstand) | 32 | 32, davon 20 nicht im ersten |
| zusammen | | **52** |

Offene Angebote wurden nicht mitbestellt: im ersten Spielstand stehen noch 96 Angebote der laufenden Saison (64 weitere Marken), das sind
nicht „wenige“ und die Wahl ist dort schon getroffen. Sie fallen auf das Monogramm zurück.

Block 1 (Chris' Spielstand): evonik-materials (Death Peaches), sennheiser-audio, kuka-automation, porsche-holding, rewe-united, hannover-rueck,
hilti-befestigung, miele-hausgeraete, wdr-sport, schaeffler-antrieb, hella-fahrzeuglicht, mahle-motoren, toom-werkstadt, basf-chemie,
deichmann-schuhe, hermes-paket, conrad-elektronik, webasto-comfort, trumpf-lasertechnik, montblanc-writing, leica-kamera,
fressnapf-tierbedarf, dr-oetker, fiat-automobili, fischer-duebelwerke, general-motors, penny-markt, toyota-way, hornbach-co,
deutsche-bank, chrysler-motors, jaguar-land-rover.

Block 2 (nur im zweiten Spielstand): bertelsmann-content, douglas-beauty, infineon-chips, prosieben-media, ferrari-corse, apple-core,
zalando-fashion, renault-mobility, reebok-athletics, metaworld-social, netto-markendiscount, kuehne-nagel-fracht, loreal-cosmetics,
adobe-creative, unilever-brands, nike-just-do-it, carlsberg-brewery, hp-hardware, enbw-strom, canon-imaging.

## 2. Bestellung

- `scripts/pixellab-sponsor-wappen.py`, Endpunkt `/create-image-pixflux`, 96×96, ohne Hintergrund. Requisiten/UI-Bilder, keine Figuren, keine Animationen.
- Stil der drei Probe-Wappen: Wappenschild mit Metallrand, eigenes Sinnbild, Farben an das Vorbild angelehnt, **Banner leer, keine Schrift**.
  Der Spielname steht in der App immer als Text neben dem Wappen; so kann auf dem Wappen nie ein anderer Name stehen als im Spiel.
- Stilprobe zuerst (evonik-materials: Treffer; sennheiser-audio: Fehlgriff, dunkles Feld). Daraus: keine schwarzen oder dunkelgrauen Felder.
- Je Wappen ein POST unter `flock /tmp/pixellab-bestell.lock`, keine automatische Wiederholung. Sieben Fehlgriffe wurden von Hand mit
  geändertem Sinnbild und neuer Saat neu bestellt (Liste mit Grund in `public/sprites/sponsoren/quellen.json`, `_fehlgriffe_22_11`;
  einer davon zeigte auf dem Schuh ein Zeichen wie eine fremde Marke und wurde deshalb verworfen).
- **59 Generationen** (Deckel 60): 52 eingebaut, 7 Fehlgriffe. Guthaben 262,54 → 203,54, Reserve 150 unberührt.

Nicht ganz am Stil, aber behalten: `penny-markt` (Münze mit Währungszeichen), `general-motors` (Schild mit Flügeln statt Motor),
`apple-core` (ganzer Apfel statt Kerngehäuse), `douglas-beauty` und `loreal-cosmetics` (Sinnbild ohne Schildrahmen).

## 3. Einbau

- `lib/sponsor/sponsor-wappen.ts`: `sponsorWappenPfad(brandId)` liefert `/sprites/sponsoren/<id>.png` oder `null`;
  `sponsorWappenPfadFuer(vertrag|angebot)` sucht über Dachmarke, Marken-ID (Variante hinter dem Doppelpunkt) oder Namen.
  Ohne Wappen bleibt das bisherige Monogramm (`sponsorMonogramm`).
- `components/foundation/sponsor/SponsorWappen.tsx`: Bild mit fester Kante am Element (kein Layoutsprung), `image-rendering: pixelated`.
- Sponsor-Seite (`FoundationSponsorsNewLook`): aktiver Vertrag 64 px, Angebotskarten 48 px, Liga-Tabelle 32 px (alle über `SponsorCrest`).
- Finanzseite (`FinanzenModern`, Reiter „Sponsor“): Wappen 48 px links neben „Hauptsponsor“.
- Postfach (`PostfachModern`): Meldungen des Absenders „Sponsor“ zeigen das Wappen des laufenden Vertrags statt des Pokal-Symbols
  (Liste und Kopf der geöffneten Meldung).
- Test `tests/sponsor-wappen.test.ts`: Helfer mit Rückfall; jede Datei in `quellen.json` existiert, jede Datei hat einen Eintrag,
  die Liste im Helfer ist deckungsgleich.

## 4. Aufnahmen aus der echten App

Wegwerf-Kopie des Live-Abbilds, Team Death Peaches, `scripts/screenshot-sponsor-wappen.ts`, Ordner `docs/design/sponsor-wappen-22-11/`:

| Ansicht | 1920×1080 | 2560×1440 |
|---|---|---|
| Sponsor-Seite, aktiver Vertrag | `01-sponsorseite-vertrag-1920.png` | `01-sponsorseite-vertrag-2560.png` |
| Sponsor-Seite, Liga-Tabelle | `02-sponsorseite-liga-1920.png` | `02-sponsorseite-liga-2560.png` |
| Finanzen, Reiter Sponsor | `03-finanzen-sponsor-1920.png` | `03-finanzen-sponsor-2560.png` |
| Postfach, Absender Sponsor | `04-postfach-sponsor-1920.png` | `04-postfach-sponsor-2560.png` |

Ein Mockup gab es für diesen Auftrag nicht; der Abgleich ist deshalb der Vorher-Zustand (Monogramm im Schild), der als Rückfall bleibt.

Das Postfach des Live-Stands hatte zum Aufnahmezeitpunkt keine offene Sponsor-Meldung (alle 35 Ereignisse erledigt). Für Bild 04 wurde in der
Wegwerf-Kopie ein erledigtes Ereignis der Death Peaches wieder auf „offen“ gestellt; am Live-Stand wurde nichts geändert.
