# PixelLab für HUD, Effekte und Schiedsrichter: Plan und Kosten (17.11.)

Anlass, Chris am 17.11., wörtlich: „hud Effekte und schiri auch über Pixel lab". Das Audit
`docs/design/pixellab-nur-neue-assets-audit-17-11.md` (Branch `claude/pixellab-nur-neue-assets-17-11`)
hatte diese drei Gruppen in Abschnitt 5 ausgeklammert:

- Linien, Marker, HUD und Effekte sollten Canvas bleiben.
- `zeichneSchiri()` galt als Figur, und neue Figuren sind gesperrt.

Der Plan selbst (Abschnitte 0 bis 6) ist **Analyse und Kostenschätzung** und wurde vor jeder Bestellung
geschrieben. Was danach bestellt und eingebaut wurde, steht im **Umsetzungsstand (17.11.)** am Ende des Dokuments.

**Freigabe-Rahmen:** Für den **Schiedsrichter** hat Chris einen neuen Charakter ausdrücklich freigegeben.
Für alle anderen Figuren und Animationen bleibt die Sperre bestehen (CLAUDE.md, Abschnitt „PixelLab-Charaktere
und -Animationen").

**Kontostand:** `GET https://api.pixellab.ai/v2/balance` am 17.11. (kostenlos, über den Proxy) ergab **1677
Generationen** (Tier 3 „Pixel Architect 2x", Abo aktiv, USD-Guthaben 0). Das ist derselbe Stand wie im Audit.

## 0. Kurzfassung

| Paket | Inhalt | Basis | mit Puffer |
|---|---|---:|---:|
| **S-min** Schiedsrichter, Mindest-Set | Figur (8 Grundposen) + Pfiff-Geste Süd/Ost | **~15–27 Gen.** | ≤ 45 |
| S-empf. Schiedsrichter, empfohlen | S-min + Laufzyklus Süd/Ost/Nord + Pfiff Nord | ~22–35 Gen. | ≤ 60 |
| **H1** häufige/auffällige Effekte und Icons | 9 VFX + 2 Icons | **80 Gen.** | ~125 |
| **H2** Rest (Kern) | 5 VFX + 6 Icons/Rahmen | **108 Gen.** | ~150 |
| H2 optional | HYROX-Stationsicons, DOM-HUD-Rahmen | +136 Gen. | ~+180 |
| **Summe Kern** | S-empf. + H1 + H2 | **~210–225 Gen.** | **~335** |

Im Verhältnis zum Audit:

- Audit-Wellen A+B+C (Kern) kosten 878 Gen., mit Puffer etwa 1215.
- Zusammen mit diesem Plan sind es mit Puffer etwa **1550 von 1677 Gen.**
- Das geht nur knapp. Es bleiben ~130 Gen. Reserve, und das auch nur ohne die H2-Optionen.
- Nicht ermittelt habe ich, wann die Abo-Periode die Generationen auffüllt. Das sollte Chris vor der
  Reihenfolge-Entscheidung prüfen.

**Der wichtigste Fund:** Effekte sind bei PixelLab **viel billiger als Requisiten**. Der Endpunkt `POST
/v2/vfx` erzeugt animierte Effekt-Spritesheets für **1 Gen. (lite) bzw. 6 Gen. (pro)** je neuem Effekt. Eine
Änderung kostet 1 bzw. 4 Gen. (OpenAPI, Abschnitt „Cost"). Ein Effekt kostet damit weniger als die Hälfte
eines Requisits (~13 Gen.). Die Sorge aus dem Auftrag, Animationen als Frames wären teuer, gilt für Effekte
deshalb nicht. Ob Effekt-Animationen unter die Animationssperre fallen, bleibt eine offene Frage an Chris
(Abschnitt 6).

## 1. Kostenmaßstäbe: Belege statt Schätzungen

| Was | Endpunkt | Kosten | Beleg |
|---|---|---:|---|
| Requisit/Icon, statisch | `/v2/generate-image-v2` (Weg von `scripts/pixellab-requisiten.py`) | **~8–15 Gen. je Auftrag**, Maßstab 13 | Welle 2: 60 Gen. für 4 Requisiten (Commit `d4b4f592`); Welle 3: 115 Gen. für 14 (Commit `1c6616b8`); I-Spy-Tür: 10 Gen. (Commit `894c15e8`) |
| Kandidaten je Auftrag | dito | bis 32 px: 64 Kandidaten, bis 64 px: 16, bis 170 px: 4 | OpenAPI `/generate-image-v2`, „Output Counts by Size" |
| Breitformat-Kulisse | dito | 25 Gen. | Audit, I-Spy-Runde |
| **Neuer Charakter, Pro** | `/v2/create-character-pro` (kanonischer Weg der ~360 Bestandsfiguren, 80×80, `low top-down`) | **10–25 Gen.** („dynamic … depending on output size") | OpenAPI; corsair-v3 kostete 31 Gen. **einschließlich** 4 Animationsgruppen × 3 Richtungen, die Basis also ≈ 13 (`docs/design/corsair-koerperform-kandidat-08-11.md`) |
| Neuer Charakter, Standard | `/v2/create-character-with-8-directions`, `mode: standard` | 1 Gen. | OpenAPI; corsair-v2 (Basis 1 Gen. per `usage`). **Nachteil:** Canvas 112 statt 80, Template `mannequin` statt `custom` |
| Animation, pixminimax | `/characters/animations` bzw. `/animate-pixminimax` | 64×64: 4/8/16/40 Bilder = 1/1/2/6 Gen.; 80×80 bei 8 Bildern = 1 Gen. je Richtung | OpenAPI; corsair-v2: 4 Gruppen (16/16/8/16 Bilder) × 3 Richtungen = **18 Gen.**, also ~1,5 je Richtung und Gruppe |
| **VFX-Effekt** | `/v2/vfx` | **lite 1 / pro 6** (8 mit Sprite-Bezug); Änderung 1 / 4; höchstens 2× Angebot | OpenAPI `/vfx`, Abschnitt „Cost" |
| UI-Rahmen/Panel | `/v2/generate-ui-v2`, `/v2/create-ui-asset` | **nicht dokumentiert** (beide „Pro"); Annahme 10–25 | OpenAPI. Zustände (`/ui-assets/states`) sind dokumentiert: 10/15/25 Gen. je Raster |

Die OpenAPI liegt unter `https://api.pixellab.ai/v2/openapi.json`. Ich habe sie am 17.11. gelesen; das
Abfragen ist kostenlos.

**Nicht bei uns nutzbar:** Die VFX-Doku nennt den PixelLab-MCP-Server (`vfx_workbench`) als „free for
subscribers". In dieser Umgebung ist er nicht angebunden. Er wäre aber ein möglicher 0-Gen.-Weg für die
VFX-Welle, falls Chris ihn anschließen will.

## 2. Schiedsrichter

### 2.1 Heutiger Stand

**Wo er gezeichnet wird:** `zeichneSchiri()` in `public/mockups/battle-mode.engine.js:15710`. Der einzige
Aufruf steht in `zeichneFeldspiel()` (`:18736`). Er wird nach den Spielern und vor dem Ball gezeichnet,
damit ihn beim Pfiff keine Figur verdeckt.

**Zustand:** `fsSchiri = {x, y, zielX, zielY, pfiffT}`.

- Er wird in `initFeldspielLive()` angelegt (`:14363`).
- Bewegt wird er von `bewegeSchiri(dt)` (`:15693`), mit `SCHIRI_TEMPO = 300` px/s.
- Die Pfiff-Geste dauert `PFIFF_DAUER = 1.8` s (`:10747`).

**In welchen Disziplinen er vorkommt:** Er erscheint in allen drei Live-Feldspielen, also **Basketball,
Hockey und Football** (`FELDSPIEL_ART`, `:9808`). Er ist dort das ganze Spiel über sichtbar.

**Was er tut:**

- **Ruhe:** Er steht an der unteren Seitenlinie (`y = H − 78`). Er läuft waagerecht mit dem Ball mit,
  begrenzt auf 12 bis 88 % der Breite (`schiriRuhePos()`, `:15672`). Es gibt also vor allem
  **Seitwärtslaufen (Ost/West)**, dazu Stehen.
- **Foul:** `schiriPfeift()` (`:15679`) wird **nur** aus `starteFreiwuerfe()` aufgerufen (`:15594`), also
  nur bei Basketball-Wurffouls.
  - Er läuft zum Foul-Ort. Dabei sind **alle Richtungen** möglich, auch nach oben und unten.
  - Er reißt den rechten Arm hoch.
  - Es erscheinen ein gelber Pfiff-Ring und der Text „PFIFF!".
  - Ein Schwebetext „FOUL!" kommt dazu.
  - Während der Freiwürfe steht er neben der Freiwurflinie.
  - **Hockey und Football pfeifen nie.** Hockey kennt Strafen (`verhaengeStrafe`, „Bandencheck"), ruft
    den Schiri dafür aber nicht.

**Wie er aussieht:** reine Canvas-Primitive.

- Schatten-Ellipse, Hose, ein weißes Trikot 17×32 px mit drei schwarzen Streifen.
- Ein Kreis als Kopf, ein Strich als Arm: hängend oder hochgerissen.
- Es gibt **keine Blickrichtung**, er wird immer frontal gezeichnet.
- Sichtbare Höhe ≈ 55 px. Die Spielerfiguren sind ≈ 52 px × G (`PIXEL_HOEHE = HOEHEN_BEZUG = 52`,
  `:4112`/`:4598`).

**Weitere Stellen:**

- Die Render-Interpolation fasst ihn mit an (`viKSchiri`, `:56818` ff.).
- Er steht im Zustands-Schnappschuss (`:63698`) und in der Debug-Ausgabe (`:67128`).

### 2.2 Wie die Bestandsfiguren aufgebaut sind

**Index:** `data/generated/figuren-sprites.json` (360 Einträge). Der Motor liest daraus das generierte
`public/mockups/battle-mode.figuren.js` (`window.__ARENA_FIGUREN`, Spielername → Ordner). Dieses wird von
`scripts/baue-arena-figuren.mjs` erzeugt.

**Je Figur:**

- PixelLab-Charakter mit **8 Rotationen**. Davon liegen **4 Grundposen** als Datei vor:
  `south/east/west/north.png`.
- Dazu **4 Animationsgruppen** `walk/angriff/treffer/tod` mit 17/17/9/17 Bildern (Startbild +
  16/16/8/16), jeweils in den Richtungen **Süd, Ost und Nord**. West spiegelt der Motor aus Ost.
- Canvas 80 px, einige Figuren 128 px.
- Erzeugt wurden sie über `create-character-pro`, `create_from_concept`, `template_id: custom`,
  `view: low top-down` (`scripts/figuren-erzeuge-basis-charakter.py`, Kopfkommentar). Die Animationen
  kamen über `pixminimax` (`scripts/figuren-bestelle-animationen.py`).

**Wie der Motor sie zeichnet:** `zeichnePixelFigur()` (`:4815`) wählt die Art aus dem Zustand
(`tod/treffer/angriff/walk`, sonst die Grundpose der Blickrichtung).

**Wichtig für die Kosten:** Fehlt einer Figur eine Animation, zeichnet der Motor **eine Ersatzbewegung aus
der Grundpose**. Beim Gehen wippt sie, beim Angriff macht sie einen Ausfallschritt (`:4738`–`4745`, `:4898`
ff.). Laut Kommentar laufen **91 Bestandsfiguren** heute schon nur mit Grundposen. Ein Schiedsrichter
**nur mit Grundposen** funktioniert also ohne jede Animation.

### 2.3 Benötigte Posen

| Bedarf | Häufigkeit | Lösung | Pflicht? |
|---|---|---|---|
| Stehen frontal | dauernd (Ruhe, Freiwurf) | Grundpose `south` | ja |
| Seitwärts laufen | dauernd, mit dem Ball | Grundpose `east`/`west` (aus der Erzeugung) + Wipp-Ersatz; besser `walk` Ost | Grundpose ja, `walk` empfohlen |
| Zum Foul-Ort laufen (hoch/runter) | je Basketball-Foul, ~1–2 s | `north`/`south` + Wipp-Ersatz; besser `walk` Süd/Nord | empfohlen |
| **Arm hoch + Pfeife** | je Basketball-Foul, 1,8 s | **eigene kurze Animation „pfiff"**: 8 Bilder, hält das letzte Bild | ja, sonst geht die Geste verloren |
| Treffer/Tod/Angriff | nie | — | **nein, nicht bestellen** |

Die Geste „Arm hoch" lässt sich auf einem Pixel-Sprite nicht sauber per Canvas nachzeichnen. Die heutige
Strich-Lösung funktioniert nur, weil die ganze Figur ein Strichmännchen ist. Deshalb ist „pfiff" die eine
Animation, die das Mindest-Set braucht. Pfiff-Ring und „PFIFF!"-Text bleiben Code oder werden ein VFX
(Abschnitt 3, H2).

### 2.4 Vorschlag: kleinstes sinnvolles Set

**Ein** Charakter für alle drei Sportarten. Schwarz-weiß gestreift ist im Basketball, Football und
Eishockey das Erkennungszeichen; im Eishockey kommen orange Armbinden dazu, die man weglassen kann.

**Erzeugung:**

- Endpunkt `POST /v2/create-character-pro`, `image_size 80×80`, `view: low top-down`.
- `style_character_id` = eine schlichte menschliche Bestandsfigur als Stil-Anker. Das schützt die
  Stil-Konsistenz zum Bestand (Risiko R1).
- Ohne Konzeptbild über `create_with_style`, oder mit einem kleinen Konzeptbild über `create_from_concept`
  wie beim Bestand.
- Zweistufig wie bei corsair-v3: erst nur die Basis, Größe per `GET /characters/{id}` prüfen, danach die
  Animation.
- Vorschlag für den Prompt: „a sports referee, short dark hair, **bold vertical black and white striped
  shirt**, black trousers, black shoes, silver whistle on a cord around the neck, neutral standing pose.
  Full body pixel art character." Die Streifen müssen bei ~52 px sichtbarer Höhe lesbar bleiben.

| Paket | Bestellungen | Gen. (Beleg) |
|---|---|---:|
| **S-min** | Basis-Charakter (8 Rotationen) | 10–25, erwartet ~13 |
| | „pfiff" pixminimax, 8 Bilder, Süd + Ost | 2 × 1 = 2 |
| | **Summe** | **~15–27** |
| | mit einem Nachwurf der Basis | ≤ 45 |
| **S-empf.** | S-min + `walk` 16 Bilder Süd/Ost/Nord + „pfiff" Nord | +6 + 1 → **~22–35** |
| | mit Puffer | ≤ 60 |

Zum Vergleich:

- Ein Vollsatz im Kanon (walk/angriff/treffer/tod × 3 Richtungen) läge bei ~13 + 18 ≈ 31 Gen., wie bei
  corsair-v3.
- Nicht empfohlen ist der billigere Standard-Endpunkt (1 Gen.). Er liefert einen Canvas von 112 statt 80
  und das Template `mannequin`, passt also stilistisch und im Maßstab nicht zum Bestand.

### 2.5 Einbau (Skizze, nicht gebaut)

- **Eintrag im Figuren-Index:**
  - Der Schiri braucht einen Eintrag in `figuren-sprites.json` und `battle-mode.figuren.js` unter einem
    **Nicht-Spieler-Schlüssel**, z. B. `__schiri`.
  - Dabei prüfen, dass Kader, Scouting und `baue-arena-figuren.mjs` ihn nicht als Spieler führen. Heute
    bildet die Datei Spielername → Ordner ab.
- **Zeichnen:**
  - `zeichneSchiri()` ruft `zeichnePixelFigur()` mit einem Stellvertreter-Objekt auf. Die Blickrichtung
    kommt aus `zielX − x` bzw. `zielY − y`.
  - Lädt das Bild nicht, bleibt die heutige Canvas-Figur als Rückfall stehen, nach demselben Muster wie bei
    Korb und Ball.
  - Die „pfiff"-Animation braucht eine eigene Art. `angriff` ist an `u.lunge` gekoppelt.
- **Wertungs-Fingerabdruck:** Er muss bei **`e80babacb68c`** bleiben (`node
  scripts/pruefe-wertung-fingerabdruck.mjs`). Deshalb keine neuen Felder an `fsSchiri`, sondern den
  Anzeigezustand in einer WeakMap halten (Muster `pixelAnzeige`).
- **Optional, nur Anzeige, nach Chris' Entscheid:** Hockey-Strafen („Bandencheck") und Football-Strafen
  könnten den Schiri ebenfalls pfeifen lassen.

## 3. HUD-Elemente und Effekte

Legende der Spalte „Art": **S** = statisch (ein Bild), **A** = animiert (VFX-Spritesheet), **C** = Vorschlag:
bleibt Code (Geometrie, Text, Datenanzeige).

**Teamfarbe:** Viele Effekte sind heute in **Teamfarbe** gefärbt (`e.seite`, `kampfSeitenFarbe`, `--home`
bzw. `--away`, bis zu vier Pod-Farben). Ein PixelLab-Bild muss dafür hell oder graustufig bestellt und zur
Laufzeit eingefärbt werden. Das geht mit einer Offscreen-Canvas, `source-atop`, und einem Cache je Farbe.
Andernfalls verliert der Effekt die Team-Information. Solche Effekte sind unten mit „Tönung" markiert.

### 3.1 Effekte

| # | Element | Fundstelle | Wo/wie oft | Größe | Art | Kosten | Welle |
|---|---|---|---|---|---|---:|---|
| E1 | **Hieb-Bogen** normal + schwer (`typ:"hieb"`) | `zeichneEffekte()` `:55384`; `effekt()` `:55371`; Bahn-Rempler `:8364`, `:53182` | jeder Nahkampftreffer in TDM, Mini-DM, Battlefield, Arena-Skills und Spurt-Rempler; **sehr häufig** | r 24–34 px | A, Tönung | 2 VFX × 6 = 12 | **H1** |
| E2 | Dash-Spur (`spur`) | `:55375`, `:8383`, `:53168` | Skill „Eigenbewegung", Rempler | Linie, variable Länge | A, Tönung; Länge variabel → gestreckt | 6 | H2 |
| E3 | Schockwelle (`welle`) | `:55377`, `:52686` | Betäubungs-Skill, r bis 120 px | variabel | A, Tönung; große Skalierung → eher C | 6 | H2 |
| E4 | Schild-Kuppel (`kuppel`) | `:55376` | Schild-Skill | r 26–32 | A (feste Farbe Blau) | 6 | H2 |
| E5 | Strahl (`strahl`) | `:55378` | Linien-Skill, Länge variabel | variabel | **C** (Linie variabler Länge) | 0 | — |
| E6 | **Projektil Pfeil** (`pfeile`) | Zeichnung `:55700` ff., Erzeugung `:41363`, `:41656` | Fernkampf TDM/Battlefield, **häufig** | ~13 px | S, rotiert; Teamfarbe als Linie → Spitze neutral, Schaft getönt | 13 | **H1** |
| E7 | **Konfetti / Feuerwerk / Funkenregen / Blitz** (Team-Feier) | `teamFeierAusloesen` (17 Aufrufe), Zeichnung `:30995`–`31050`; Showcase-Gold `:35139` | jede größere Szene aller Chassis (Tore, Siege, Finale) | bildfüllend, 16–60 Schnipsel | A, Tönung; Blitz (Radialverlauf) bleibt C | 3 VFX × 6 = 18 | **H1** |
| E8 | **Klingen-Funke** Fechten | `:33423` | jeder Treffer im Fechten | r 16 | A (gold) | 6 | **H1** |
| E9 | **Bodenstaub** | `zeichneBodenstaub()` `:37260`; Showcase-Acts `:34562`, `:34589`; `:37652` | Showcase, Bühne | ~10 px | A | 6 | **H1** |
| E10 | **Eisstaub** | `zeichneEisstaub()` `:35223` | Eiskunstlauf: Landung, Pirouette | ~11 px | A | 6 | **H1** |
| E11 | **Wasser-/Schlammspritzer** | `zeichneFalleTakeshi()` `:45115` | Takeshi-Sturz in Wasser oder Schlamm | ~50 px | A | 6 | **H1** |
| E12 | Kreidewolke + Knall | `:36637`–`36656` | Gewichtheben, je Versuch | r 10–32 | A | 6 | H2 |
| E13 | Pfiff-Ring | in `zeichneSchiri()` | je Basketball-Foul | r 15–49 | A (gelb), gehört zum Schiri | 6 | H2 |
| E14 | Fokus-Linien und Reichweiten-Linien zwischen Kämpfern, Front-Linie TDM | `draw()` `:55420` ff. | dauernd | Linien | **C** | 0 | — |
| — | Feuer am Ziel, Spotlight, Kufenspuren | `hind_feuer` bzw. Audit-Rohbilder | — | — | schon PixelLab bzw. bezahlt | 0 | — |

### 3.2 HUD und Marker

| # | Element | Fundstelle | Wo/wie oft | Art | Kosten | Welle |
|---|---|---|---|---|---:|---|
| U1 | **Stern-Icon** ★ für Stufen (I-Spy-Truhen, Takeshi-Fallen); heute Text-Glyphe | `ispySterne()` `:31590`, `:45420` | dauernd in I-Spy und Takeshi | S, ~10–12 px, auch im DOM verwendbar (MVP-Stern `mvpStern()` `:58819`) | 13 | **H1** |
| U2 | Gültig/Ungültig ✓/✗ (Gewichtheben, HYROX fertig ✓) | `:36512`, `:52201` | je Versuch | S, 2 Icons | 26 | H2 |
| U3 | K.o.-Marker „✗K" im Breaking-Bout-Slot | `:37883` | je K.o. | S | 13 | H2 |
| U4 | Nebel-Silhouette „?" (Battlefield) | `draw()`, Block `imNebel` | dauernd für verdeckte Gegner | S, ~40×60 | 13 | H2 |
| U5 | Wettessen-Stempel-Schild über dem Kopf (Text bleibt Code) | `zeichneWettessenStempel()` `:34000` | je Mauer/Ereignis | S, Rahmen | 13 | H2 |
| U6 | Shot-Clock-Gehäuse (Ziffern bleiben Text) | `zeichneShotClock()` `:18357` | dauernd Basketball | S | 13 | H2 |
| U7 | Strafbank-Kasten Hockey: Rahmen, Name/Countdown/Balken bleiben Code. **Achtung:** im Audit als Requisit „Strafbank" (Welle B, 13) schon gezählt; nicht doppelt bestellen | `zeichneStrafbank()` `:18023` | bei Strafen | S | (0, s. Audit) | — |
| U8 | HYROX-Stationsicons (7 Stationen) im Streckenband bzw. in der Rangleiste | `zeichneStreckenband()` `:55292`, `zeichneHyroxRangleiste()` `:52149` | dauernd HYROX | S, 7 Icons | 91 | H2 optional |
| U9 | DOM-HUD-Rahmen (Score-Bug `#bbug`, `#bahnHud`, Einlauf- und Endstand-Tafel), heute reines CSS | `battle-mode.html`/`.css` | dauernd | S, 9-Slice-Panel über `generate-ui-v2`; Preis nicht dokumentiert | ~3 × 15 = 45 | H2 optional |
| U10 | Kampfrichterlampen Gewichtheben: im **Audit Welle C** (13) schon gezählt | `bodenHeben()` `:32153` | — | — | (0) | — |

### 3.3 Vorschlag: bleibt Code (Chris entscheidet)

- **Text und Zahlen:**
  - Namen und Status-Etiketten, Schwebetexte („FOUL!", Schaden), „PFIFF!".
  - Countdown (`zeichneWettessenCountdown`), Ziffern von Shot-Clock und Strafbank.
  - Startnummern und Zeitfahr-Blasen (`zeichneStartnummer`, `zeichneZfBlase`, `zeichneZfNummer`).
- **Datenanzeigen:**
  - HP/MP/SP-Balken unter den Kämpfern, Magen-Pegel (`zeichneWettessenMagen`).
  - Treffer-Treppe, Verlaufskurve, Mannschaftsleiste, Bauchbinde.
  - Vier-Team-Tafeln (`zeichneBfPodTafel`, `zeichneBahnPodTafel`), HYROX-Rangleiste, Streckenband.
  - Diese Elemente ändern sich jeden Frame und tragen Spielinformation. Ein Bild macht sie nur schlechter
    lesbar. Höchstens ein Rahmen wäre denkbar (U9).
- **Geometrie:**
  - Spielfeld-, Bahn-, Start- und Ziellinien.
  - Teamring- und Schattenellipsen unter den Figuren.
  - Fokus-Ring und Fokus-Pfeil ▼ (gestrichelt, wandert, Teamfarbe).
  - Kontrollpunkt-Ring mit Fortschrittsring (`zeichneKontrollpunkt` `:44853`).
  - Strahl (E5), Front-Linie und Reichweiten-Linien (E14), Blitz-Radialverlauf der Team-Feier.
- **Start- und Zielbögen** im Spurt sind schon PixelLab (`spurt_bogen_in`/`spurt_bogen_finish`).
  - **Startblöcke** zeichnet der Motor nicht.
  - Ein **Zielband** gibt es nur als Caption („Zielband durch").
  - Falls gewünscht, wären das neue Requisiten zu je 13 Gen. Sie sind nicht in den Summen enthalten.

### 3.4 Summen

| Welle | Posten | Basis | mit Puffer |
|---|---|---:|---:|
| **H1** | VFX: E1 (2), E7 (3), E8, E9, E10, E11 = 9 × 6 = 54; statisch: E6, U1 = 26 | **80** | ~125 (je VFX 1 Änderung à 4 Gen., statisch ×1,3) |
| **H2 Kern** | VFX: E2, E3, E4, E12, E13 = 5 × 6 = 30; statisch: U2 (2), U3, U4, U5, U6 = 6 × 13 = 78 | **108** | ~150 |
| H2 optional | U8 (91) + U9 (~45) | +136 | ~+180 |

Mit `lite`-VFX (1 Gen.) statt `pro` sänke die VFX-Summe in H1+H2 von 84 auf 14 Gen. Die Qualität müsste
ein Pilot zeigen.

## 4. Empfohlene Reihenfolge

1. **Schiedsrichter S-min als Pilot** (~15–27 Gen.).
   - Er ist freigegeben, gut abgegrenzt und in drei Disziplinen dauernd sichtbar.
   - Erst nur die Basis, die Größe prüfen und den Kontaktbogen Chris zeigen.
   - Danach „pfiff". `walk` (→ S-empf.) nur, wenn der Wipp-Ersatz im Bild nicht reicht.
2. **Ein VFX-Pilot: Hieb-Bogen E1** (6 Gen., pro).
   - Er klärt drei Fragen auf einmal: Stil-Passung, Einfärben in Teamfarbe und Lesbarkeit bei 24–34 px.
   - Parallel dazu `lite` (1 Gen.) zum Vergleich.
3. **Rest von H1** in der Reihenfolge nach Spielminuten:
   - Konfetti und Feuerwerk (alle Chassis), Pfeil-Projektil, Bodenstaub und Eisstaub, Klingen-Funke,
     Wasserspritzer, Stern-Icon.
4. **H2 Kern**, danach die H2-Optionen nur nach Chris' Entscheid.
5. Die Audit-Wellen A, B und C sind davon unabhängig.
   - Vorschlag: Schiri und H1 (~170 Gen. mit Puffer) **vor** Audit-Welle A ziehen. Der Grund: kleine Beträge
     mit hoher Sichtbarkeit.
   - Welle A danach gegen das Restguthaben planen.

## 5. Risiken

- **R1 – Stil-Konsistenz.**
  - Schiri: Er muss über `create-character-pro` mit `style_character_id` einer Bestandsfigur erzeugt
    werden, sonst weicht er sichtbar ab (siehe corsair-v2: anderer Endpunkt, Canvas 112).
  - VFX: Der VFX-Generator hat einen eigenen Stil (Partikel, Glow). Gegen die 16-Bit-Requisiten mit dunkler
    Kontur (Stil-String in `pixellab-requisiten.py`) muss ein Pilot prüfen, ob das passt.
- **R2 – Lesbarkeit klein.**
  - Die Schiri-Streifen bei ~52 px und Icons um 10–12 px brauchen klare Konturen. Pixel-Art lässt sich nur
    ganzzahlig sauber skalieren.
  - Effekte mit variabler Größe (Welle bis r 120, Strahl, Spur) skalieren schlecht. Deshalb sind E3 und E5
    als Code vorgeschlagen bzw. mit Vorbehalt eingeordnet.
- **R3 – Teamfarben.**
  - Hieb, Spur, Welle, Strahl, Pfeil und Konfetti tragen heute Teamfarbe, bei Pods bis zu vier Farben.
  - PixelLab-Bilder müssen neutral bestellt und zur Laufzeit getönt werden, mit Cache je Farbe.
  - Ohne Tönung geht Spielinformation verloren.
- **R4 – Performance.**
  - Spritesheets sind meist billiger als die heutigen Radialverläufe und 60 Einzel-Rechtecke.
  - Kosten entstehen durch das Tönen (einmalig je Farbe cachen) und durch das Vorladen.
  - Der Anpfiff wartet heute auf die Figuren (`pixelFigurenFuerAnpfiff`). Der Schiri muss in diese Liste
    oder sauber auf den Canvas-Rückfall gehen.
  - Effekt-Bilder dürfen den Anpfiff nicht blockieren.
- **R5 – Wertung.** Alles ist reine Anzeige. Der Fingerabdruck **`e80babacb68c`** muss nach jedem Einbau
  gleich bleiben. Keine neuen Felder an Spieler-, Läufer- oder `fsSchiri`-Objekten.
- **R6 – Budget.**
  - Mit allen Audit-Wellen bleiben mit Puffer nur ~130 Gen. übrig.
  - Der Termin der Abo-Auffüllung ist nicht ermittelt.
- **R7 – Abgrenzung zur Animationssperre.**
  - VFX sind animiert, aber keine Figuren-Animationen.
  - Die „pfiff"- und `walk`-Animation des Schiris fallen unter seine Freigabe. Sie dürfen kein Muster für
    andere Figuren werden.

## 6. Offene Fragen an Chris

**Beantwortet am 17.11.:** Chris hat „schiri -> ja / effekte -> ja“ freigegeben. Damit sind der
Schiri-Ausbau (eine Figur samt Animationen und Gesten, keine weitere Figur) und die H1-Effekte aus
`/v2/vfx` freigegeben. Frage 2 gilt damit als geklärt: Effekte aus `/v2/vfx` zählen als freie Assets, nicht als
Figuren-Animationen; die Animationssperre für Figuren bleibt unberührt. Offen bleiben die Fragen 1 (nur die
Hälfte: Football hat keine Fouls, s. Umsetzungsstand), 3 (pro/lite je Effekt entschieden, s. unten) und 4 bis 6.

1. **Schiri-Umfang:** Reicht S-min (Grundposen + „pfiff", Gehen über den Wipp-Ersatz), oder S-empf. mit
   echtem Laufzyklus? Außerdem: Soll er in Hockey und Football bei Strafen ebenfalls pfeifen? Das wäre reine
   Anzeige.
2. **VFX und Sperre:** Gelten animierte Effekte aus `/v2/vfx` (1–6 Gen. je Effekt) als freie „Assets", oder
   brauchen sie wie Figuren-Animationen eine eigene Freigabe?
3. **VFX-Stufe:** `pro` (6 Gen.) oder `lite` (1 Gen.)? Vorschlag: den Piloten E1 in beiden Stufen
   vergleichen.
4. **Teamfarben:** Ist Einfärben zur Laufzeit in Ordnung, oder sollen getönte Effekte (Strahl, Welle) Code
   bleiben?
5. **DOM-HUD (U9) und HYROX-Icons (U8):** Gehören sie zum Auftrag? Sie würden den Broadcast-Look als Ganzes
   verändern.
6. **PixelLab-MCP (`vfx_workbench`, laut Doku für Abonnenten kostenlos):** Soll er angebunden werden? Er
   könnte die VFX-Kosten auf 0 senken.

## 7. Umsetzungsstand (17.11.)

Alles reine Anzeige. `node scripts/pruefe-wertung-fingerabdruck.mjs` ergibt nach dem Einbau weiter
**GESAMT e80babacb68c (75 Einträge)**. Herkunft jedes Assets: `public/sprites/arena/quellen.json` und
`public/sprites/figuren/__schiri/quellen.json`; Rohdaten und Aufträge: `data/generated/pixellab-vfx/roh/`.

**Schiri (PR #1546 und Folgearbeit):**

| Posten | Gen. (angesetzt) | Stand |
|---|---:|---|
| Figur `__schiri`, Basis (create-character-pro) | 10 | eingebaut (#1546) |
| `pfiff` Süd/Ost | 2 | eingebaut (#1546) |
| `pfiff` Nord (an dieselbe Gruppe) | 1 | eingebaut, Nord-Pfiff statt Süd-Ersatz |
| `walk` Süd/Ost/Nord, 16 Bilder | ~3 | eingebaut: der Motor wählt `walk` automatisch, sobald der Stellvertreter sich bewegt |

Pfiff-Geste bei Strafen: **Hockey** ruft `schiriPfeift()` aus `verhaengeStrafe()` (nur Geste und Ring; „STRAFE!“
und der Pfiff-Ton kommen weiter von dort). **Football** hat im Motor **keine Fouls** (nur Sack, Fumble,
Interception, Touchdown, Field Goal). Die Geste hängt deshalb am Touchdown und am Field Goal, was der realen
Torsignal-Geste (Arm hoch) entspricht. Dafür läuft `bewegeSchiri(dt)` jetzt auch im Football-Zweig, sonst wäre `pfiffT`
nie abgelaufen. Wer echte Football-Strafen will, braucht erst eine Sim-Mechanik dafür, das ist eine Regelfrage.

**Effekte, H1 (alle über `/v2/vfx`, neutral zum Einfärben bestellt, wo Teamfarbe nötig ist):**

| Effekt | Stufe | Gen. angesetzt | Einbau |
|---|---|---:|---|
| E1 Hieb-Bogen | pro (+ lite zum Vergleich) | 8 + 1 | eingebaut (#1546) |
| E7 Feuerwerk | pro | 6 | `teamFeierEffekte()`, 3-fach, Teamfarbe |
| E7 Konfetti | pro | 6 | am Anker der Feier; jedes dritte Canvas-Flugstück bleibt |
| E7 Funkenregen (Breaking) | pro | 6 | am Anker, Teamfarbe |
| E8 Klingen-Funke | lite | 1 | `zeichneFechten()`, 2-fach, Gold |
| E9 Bodenstaub | lite | 1 | `zeichneBodenstaub()`, Schleife |
| E10 Eisstaub | lite | 1 | `zeichneEisstaub()`, Schleife, 2-fach |
| E11 Wasser-/Schlammspritzer | lite | 1 | Takeshi, Zweig „schlamm“ bei Sturz, Schlammton |

Stilprobe: für Klingenfunke, Staub und Spritzer reichte `lite` (1 Gen.), die Bilder lesen sich sauber. Für
Feuerwerk, Konfetti und Funken war `lite` zu dünn und klumpig; die `pro`-Fassungen laufen. Zur Kostenkontrolle: das
Konto (Tier 3) wird von mehreren Sitzungen gleichzeitig benutzt (u. a. läuft `baue-arena-kulissen.py`), die Differenz
zweier Kontostände ist deshalb **kein** Maß für eine einzelne Sitzung; die Zahlen oben sind die beim Auftrag
angesetzten Kosten (`quoted_generations`).

**Nicht bestellt (bleiben offen):** E6 Pfeil-Projektil und U1 Stern-Icon (zusammen ~26 Gen., statische Requisiten über
`pixellab-requisiten.py`, nicht über `/v2/vfx`; Pfeile werden heute ohne Bild gezeichnet, der Umbau ist größer als ein
Tausch) sowie die Welle H2. Außerdem fehlt eine Sichtprüfung des Takeshi-Spritzers (Position im Screenshot nicht
sicher gefunden) und ein Basketball-Screenshot des Nord-Pfiffs.

