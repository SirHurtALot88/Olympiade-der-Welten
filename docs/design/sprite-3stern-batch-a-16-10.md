# Sprite-Fit 3-Sterne-Batch A — 30 Charaktere, Push Richtung 5 Sterne (16.10.)

Auftrag: 30 Charaktere standen laut `data/generated/sprite-fit-bewertung.json` auf ★★★
(alphabetische Scheibe 1-30 von 90, parallel zu Batch B und C auf denselben beiden Dateien).
Vorgehen nach `docs/design/sprite-cluster-runde-1.md` und der Rubrik in
`docs/design/sprite-fit-bewertungssystem.md`: jedes Portrait gegen die aktuelle `BAU`-Zeile
(`public/mockups/battle-mode.engine.js`) und die Vorschau (`public/sprites/preview/<slug>.png`)
geprüft, so weit wie der Baukasten ehrlich hergibt nachgerüstet, jede Bewertungsänderung
sofort per `renderProbe`/Pixel-Scan verifiziert statt angenommen.

## Ergebnis in Zahlen

**16 von 30 auf ★★★★ gehoben, 14 bleiben bei ★★★** — mit aktualisierter, am Rendering
gegengeprüfter Begründung, nicht unverändert stehengelassen (Grundsatz "Score folgt dem
Sprite").

| Charakter | Fix | Sterne |
|---|---|---:|
| Aeon Flux | `haarTon:"black"` + `effekt:{typ:"arkan",pos:"koerper"}` (pink-violette Lichtklinge) | ★★★ → ★★★★ |
| Arachna | reine Neubewertung, kein Rezeptfix (Krone war bereits die einzige Lücke) | ★★★ → ★★★★ |
| Bombblitzer | reine Neubewertung (Football-Unsichtbarkeit zählt nicht mehr als Lücke, s.u.) | ★★★ → ★★★★ |
| Brobot | `fluegel:true` → `fluegel:"fledermaus"` (echte schwarze statt falsch brauner Flügel) | ★★★ → ★★★★ |
| Caldor | reine Neubewertung (Helmzier/Wappen ist EIN zusammenhängendes Thema) | ★★★ → ★★★★ |
| Cassandra | `ruestTon:"gruen"` (neue Rampe) | ★★★ → ★★★★ |
| Clara | `ruestTon:"eis"` (neue Rampe, statt Gold) | ★★★ → ★★★★ |
| Dawnwhisper | `effekt:{typ:"heilig",pos:"kopf"}` (Heiligenschein) | ★★★ → ★★★★ |
| Drop Dead | `ruestTon:"blau"` (statt Gold) + `effekt:{typ:"frost",pos:"koerper"}` | ★★★ → ★★★★ |
| Dyrth | `haut:"schwarz"` (NEU, statt `"black"`) + `skala:1.3` + `effekt:{typ:"frost",pos:"kopf"}` | ★★★ → ★★★★ |
| Eike | `effekt:{typ:"frost",pos:"koerper"}` (Kristall-Orb) | ★★★ → ★★★★ |
| Elara | `ruestTon:"gruen"` (neue Rampe) | ★★★ → ★★★★ |
| Emphi | `effekt:{typ:"frost",pos:"koerper"}` (Energie um Stab/Hände) | ★★★ → ★★★★ |
| Enforcer | `fluegel:true` → `fluegel:"federn"` (echte helle statt falsch brauner Flügel) | ★★★ → ★★★★ |
| Erna Wellenlaut | reine Neubewertung (Flöte war bereits die einzige Lücke) | ★★★ → ★★★★ |
| Gralakar | `umhang:true` (wallende Robe) | ★★★ → ★★★★ |

14 bleiben ★★★: Abysskraken, Akali, Aurora, Babuschinka, Bana, Bearington, Bloater, Breeze,
Brightpaw, Burster, Catherine, Ciacia, Dr Ironmind, Galactus — bei allen vieren mit
Teil-Fixen (Akali, Catherine, Ciacia) ist die Begründung aktualisiert und am Rendering
bestätigt, bei den übrigen zehn ist die bestehende Begründung gegengeprüft und bestätigt
(keine neue Erkenntnis).

## Zwei Fehlschläge unterwegs — per renderProbe erkannt, nicht angenommen

Diese Runde hat zwei geplante Fixes verworfen, NACHDEM ein Pixel-Scan am gerenderten PNG
zeigte, dass sie wirkungslos waren — ein wichtiger Beleg dafür, warum jede Behauptung hier
am Rendering hängt, nicht an der Code-Logik allein:

- **Burster** — `haut:"rot"` (neue Rampe) sollte die "durchgehend blutrote" Körperfarbe aus
  dem Bildbefund treffen. Per renderProbe-Pixel-Scan nachgemessen: **0 rote Pixel**, obwohl
  das Feld korrekt gesetzt war. Grund, im Code bestätigt: `kopf:"zombie"` und
  `koerper:"zombie"` haben beide eine FESTE Palette im Blatt selbst und werden mit `ton:null`
  bzw. ohne Rampentreffer gezeichnet (Code-Kommentar: "ein Knochenschädel hat keinen Hautton,
  den man tauschen könnte" — gilt für Zombie identisch wie für Skelett). `haut:"rot"` wieder
  entfernt, kein totes Feld im Rezept. Burster bleibt ★★★.
- **Abysskraken** — `effekt:{typ:"voidRot",pos:"kopf"}` sollte die "mehreren rot leuchtenden
  Augen" treffen. Per renderProbe-Pixel-Scan: **0 rote Pixel**. Grund: der `vollbild`-Zweig
  hat eine eigene `pos:"kopf"`-Verzweigung, die laut eigenem Code-Kommentar vor dieser Runde
  **noch nie von irgendeinem der 65 Vollbild-Einträge benutzt wurde** ("heute inert") — ein
  untestierter Pfad, der sich als nicht funktionierend herausstellte. Auf
  `pos:"koerper"` umgestellt (gegen Galactus' etabliertes `pos:"koerper"` verglichen) — DAS
  rendert nachweislich (Pixel-Scan bestätigt roten Farbstich), sitzt aber eher am
  Tentakel-Ansatz als klar bei den Augen. Schwache, aber echte Verbesserung; Abysskraken
  bleibt ★★★ (Reißzähne/Klauen bleiben offen, plus die ungenaue Position).

Dieselbe Pixel-Scan-Disziplin lief auch bei jedem ERFOLGREICHEN Fix (s. Verifikation unten) —
die zwei Fehlschläge sind keine Ausnahme im Vorgehen, sondern der Normalfall, bei dem das
Ergebnis negativ statt positiv ausfiel.

## Dritter Fund unterwegs: `haut:"black"` ist kein Schwarz

Bei Dyrth bestätigte ein Pixel-Scan, dass `haut:"black"` (schon vor dieser Runde gesetzt)
NICHT als neutrales Schwarz rendert, sondern als die LPC-Hautton-Konvention für dunkle Haut
— ein warmer Braunton mit schwarzen Schattenstufen (`#7F4C31` am hellen Ende der Rampe). Die
alte Bewertung ("schwarze Farbe fehlt") hatte also recht, obwohl `haut:"black"` technisch
längst gesetzt war — ein Namensverwechslungs-Fund, kein Einzelfall-Bug. Neue, echte
Graustufen-Rampe `HAUT.schwarz` ergänzt (additiv, wie `pink`/`rot`) und bei Dyrth eingesetzt
— Pixel-Scan danach bestätigt durchgehend dunklen Körper statt Braunton. Diese Rampe ist
projektweit wiederverwendbar für jeden künftigen Charakter, der echtes Schwarz statt der
LPC-Hautton-Konvention braucht.

## Neue, wiederverwendbare Primitive

Reine additive Tabellen-Erweiterungen (dieselbe Technik wie `violett`/`rot`/`blau` bei
`RUEST_TON`, bereits an mehreren Stellen im Projekt etabliert) — keine neue Zeichenfunktion,
keine bestehende Zeile geändert:

- **`RUEST_TON.gruen`** (`#0F2210`…`#B9D98C`) — Waldgrün, fehlte bisher komplett. Trifft
  Cassandras und Elaras grüne Lederrüstung.
- **`RUEST_TON.eis`** (`#1A2A38`…`#EAFBFF`) — helles Eisblau-Weiß, eigenständig gegenüber dem
  gesättigten Marineblau von `blau`. Trifft Claras Eiskönigin-Farbgebung.
- **`HAUT.rot`** (`#1a0605`…`#e8775a`) — reines Blutrot, additiv wie `pink`. Aktuell ungenutzt
  (Burster-Fix verworfen, s.o.), bleibt als generische Rampe für künftige Charaktere mit
  echter Blutrot-Hautfärbung (menschliche/alien/orc-Köpfe, nicht Skelett/Zombie).
- **`HAUT.schwarz`** (`#000000`…`#3a3a3a`) — echtes Graustufen-Schwarz, additiv. Bei Dyrth im
  Einsatz, wiederverwendbar für jede weitere mattschwarze Kreatur.

Alle vier sind rückwärtskompatibel (keine bestehende `BAU`-Zeile ändert ihr Aussehen) und
stehen jedem künftigen Charakter/jeder anderen Batch offen — ein Merge-Konflikt mit Batch B/C
an genau diesen Tabellen ist möglich, wenn eine Schwester-Batch dieselbe Lücke unabhängig
gefunden hat; Auflösung: beide Einträge kombinieren, unterschiedliche Schlüssel behalten.

## Chris' Live-Feedback währenddessen eingearbeitet

Während dieser Runde lief, meldete Chris zwei konkrete Detail-Kritiken an der laufenden
Vorschau-Galerie:

- **Akali** — "hat ja 2 Katana auf ihrem Original-Bild". Nachrecherchiert: kein
  Katana-Blatt im Baukasten (grep über alle Sprites: null Treffer), `b.waffe` kennt nur
  einen Wert — kein Dual-Wield-Feld. Beides jetzt explizit und konkret in `begruendung`/
  `fehlendesDetail` dokumentiert statt übergangen. `ruestTon:"dunkel"` zusätzlich ergänzt
  (schwarze statt brauner Ninja-Rüstung) — bleibt trotzdem ★★★, zwei unabhängige Lücken
  (Maske, Dual-Katana) bleiben.
- **Aeon Flux** — "ein pinkes Laserschwert". `effekt:{typ:"arkan",pos:"koerper"}` ergänzt
  (einzige Palette mit Pink-Anteil, `#ff8ce0`), ehrlich als Mehrfarben-Näherung dokumentiert,
  kein reines Pink. Zusammen mit der `haarTon`-Korrektur reicht das auf ★★★★.

Zusätzlich auf Chris' Hinweis hin alle 30 Charaktere noch einmal gezielt auf fehlende,
namensgebende Requisiten/Waffen durchgesehen (nicht nur generische Ton-/Farbkorrekturen) —
Ergebnis flossen in die obige Tabelle ein (u.a. Catherines Schild, Gralakars Umhang).

## Bekannte Engine-Lücke, nicht in diesem PR behoben

Nahkampfwaffen (`schwert`/`axt`/`stab`/`zweihaender`) werden nur gezeichnet, wenn
`ani==="slash"` — und die Standard-Vorschau (`renderProbe(name)` ohne Argumente, also auch
jedes hier erzeugte PNG) läuft immer mit `lunge=0` in Ruhepose, nie `ani==="slash"`. Betrifft
u.a. Cassandra/Elara (`waffe:"bogen"`), Catherine/Drop Dead/Akali/Aeon Flux (`waffe:"schwert"`)
Eike/Emphi (`waffe:"stab"`) — alle schon VOR dieser Runde korrekt gesetzt, erscheinen aber
nie in der Galerie-Vorschau. Das ist laut Koordinator ein projektweiter Engine-Fund (läuft als
eigener, paralleler Root-Cause-Fix), kein Rezeptfehler dieser 30 Charaktere — deshalb zählt
diese Unsichtbarkeit in dieser Runde nirgends als Bewertungs-Lücke, genau wie die bereits
etablierte Football-Gear-Unsichtbarkeit bei Bombblitzer.

## Was übrig bleibt (strukturell, nicht in diesem PR lösbar)

- **Abysskraken, Galactus** — Reißzähne/Klauen bzw. echte Krabbenbeine/-scheren: kein
  Overlay-Slot für Vollbild-Kreaturen.
- **Akali** — Gesichtsmaske, Dual-Katana: kein Requisiten-Slot, kein Katana-Blatt, kein
  Dual-Wield-Feld.
- **Aurora** — Kelch, Blutträne, blassere Haut als `light`: kein Requisiten-/Texturslot,
  `light` ist bereits die hellste HAUT-Rampe.
- **Babuschinka** — Schaltkreismuster, Geldscheine, Klauenhand: kein Textur-/Requisitenslot.
- **Bana** — gelbe Kapuzenfarbe (Kapuze ist am Code bestätigt eine feste, ungefärbte Ebene),
  Jeans-Textur: strukturell blockiert.
- **Bearington** — Fliege, Bratpfanne: kein Requisitenslot.
- **Bloater** — Bauch "riesig" statt nur rund, wuchtige statt schlanke Statur: kein
  passender LPC-Körpertyp.
- **Breeze** — Brille, Buch: kein Requisitenslot.
- **Brightpaw, Ciacia** — vierbeinige Kreatur als zweibeiniger Standard-Humanoid: kein
  Vierbeiner-Rig im Baukasten.
- **Burster** — Knochenkrallen (kein Slot), durchgehend blutrote Färbung (strukturell
  unerreichbar, s.o.).
- **Catherine** — Kriegshammer (kein Hammer-Blatt), Wappen auf dem Schild (kein
  Wappen-Textur-Slot).
- **Dr Ironmind** — Alter, Geräte-Symbol, Verbandsszene: kein Slot.

Keiner dieser Fälle ist "kein perfektes Asset gefunden, also nichts gebaut" — überall, wo ein
Primitiv (Farbe, Effekt, Requisit) verfügbar war, wurde es eingebaut; die verbleibenden
Lücken sind am Code bestätigt strukturell, nicht unversucht.

## Verifikation

**Syntax:**

```
node --check public/mockups/battle-mode.engine.js
```

→ OK (nach jeder Edit-Runde erneut geprüft).

**Keine Simulationsberührung:** `aufEignung(s,eig)` gelesen (Zeile ~7450) — die komplette
Funktion liest ausschließlich `s.LP`/`s.VER`/`s.ANG` und den skalaren `eig`-Parameter, kein
`BAU`-Zugriff, keine Sprite-/Zeichen-Referenz. Alle in dieser Runde geänderten/neuen Felder
(`ruestTon`, `effekt`, `fluegel`, `haut`, `skala`, `umhang`, `schild`) werden ausschließlich
innerhalb von `zeichneSprite()` gelesen.

**Regressionslauf:** `node scripts/miss-alle-disziplinen.mjs 4` wurde versucht, lief aber
unter der erwarteten starken Systemlast (mehrere parallele Sprite-Fit-Batch-Agenten auf
derselben Maschine) über 180 Sekunden ohne jede Ausgabe und wurde abgebrochen — kein
Teilergebnis, auf das sich etwas stützen ließe. Der Grep-/Code-Nachweis oben (`aufEignung`
vollständig gelesen, keines der geänderten Felder dort erreichbar) deckt die Abnahmeregel
laut Projektdokument vollständig und eigenständig ab ("Grep-Nachweis ODER kurzer Lauf" — ein
langsamer/hängender Probe-Lauf blockiert laut Auftrag nicht).

**Pixel-Scan-Verifikation (Python/PIL, nicht nur optischer Eindruck):** für jede
Farb-/Effekt-Änderung ein frischer `renderProbe`-PNG erzeugt und gegen die erwartete
Zielfarbe/-palette gescannt — nicht nur angeschaut:

- Akali/Aeon Flux: `ruestTon:"dunkel"` → dominante Farben jetzt neutral-dunkelgrau/schwarz
  statt des vorherigen warmen Leder-Brauns.
- Brobot: `fluegel:"fledermaus"` → dominanter (0,0,0)-Flächenanteil (406 Pixel) bestätigt
  solide schwarze Flügelform statt des alten braunen Fremdbilds.
- Cassandra/Elara: `ruestTon:"gruen"` → Top-Farben eindeutig grün (`(16,32,16)`,
  `(64,112,48)`, `(48,96,32)` u.a.).
- Ciacia: `ruestTon:"bronze"` → Top-Farben warmes Braun/Bronze (`(128,80,32)`,
  `(160,96,48)`) statt der vorherigen Violett-Rampe.
- Clara: `ruestTon:"eis"` → Top-Farben kühles Blaugrau (`(16,32,48)`, `(32,48,64)`,
  `(48,80,96)`) statt Gold.
- Drop Dead: `ruestTon:"blau"` → Top-Farben eindeutig Navy/Blau (`(0,16,32)`, `(32,64,128)`
  u.a.).
- Dawnwhisper: `effekt:"heilig"` → 61 Treffer gegen die Heilig-Palette, deutlich sichtbarer
  Heiligenschein im gezoomten PNG.
- Aeon Flux/Ciacia/Clara/Drop Dead/Dyrth/Eike/Emphi: `effekt:"frost"`/`"arkan"` → 3-18
  Treffer gegen die jeweilige Palette (sparse, da Einzelbild-Momentaufnahme einer
  Partikelwolke, aber nachweislich vorhanden).
- Dyrth: `haut:"schwarz"` → durchgehend dunkler Körper im gezoomten PNG, deutlicher
  Unterschied zur vorherigen Braun-Fassung.
- Catherine: `schild:true` → sichtbarer brauner Rundschild im gezoomten PNG (vorher keiner).
- Enforcer: `fluegel:"federn"` → Top-Farben helles Grau/Weiß (`(208,208,208)`,
  `(240,240,240)`) statt der vorherigen braunen Fremdbild-Farbe.
- Gralakar: `umhang:true` → zusätzlicher Robenlayer im gezoomten PNG sichtbar.
- Burster, Abysskraken: wie oben beschrieben, NEGATIV verifiziert (0 Treffer) und deshalb
  verworfen bzw. auf eine funktionierende Alternative umgestellt.

**Vorschauen neu erzeugt:** `node scripts/erzeuge-sprite-vorschauen.mjs "<Name>"` für alle 18
Charaktere mit tatsächlicher Rezeptänderung (Abysskraken, Aeon Flux, Akali, Brobot, Burster,
Cassandra, Catherine, Ciacia, Clara, Dawnwhisper, Drop Dead, Dyrth, Eike, Elara, Emphi,
Enforcer, Gralakar — 17 PNGs geändert; Bombblitzer trägt keine Rezeptänderung, nur eine
Neubewertung, PNG unverändert). Arachna, Caldor, Erna Wellenlaut (reine Neubewertungen ohne
Rezeptänderung) sowie die 14 unveränderten ★★★-Charaktere behalten ihr bestehendes PNG.

## Merge-Konflikt-Hinweis für den Koordinator

Diese Runde lief parallel zu Sprite-3-Stern-Batch B und C auf denselben zwei Dateien
(`public/mockups/battle-mode.engine.js`, `data/generated/sprite-fit-bewertung.json`),
disjunkte Charakternamen. `data/generated/sprite-fit-bewertung.json` wurde mit
`JSON.stringify(data, null, 1)` geschrieben (1-Leerzeichen-Einzug, verifiziert: Zeile 2 ist
` {`). Vor dem Öffnen des PRs wird `origin/main` neu geholt und gemergt; ein Konflikt in den
beiden gemeinsamen Dateien wird nach demselben Muster wie in früheren Runden heute gelöst
(disjunkte Pro-Charakter-Hunks kombinieren; ein reiner Formatierungskonflikt in der JSON-Datei
wird mit dem korrekten 1-Leerzeichen-Einzug neu geschrieben). Die neuen `RUEST_TON`/`HAUT`-
Tabelleneinträge (`gruen`, `eis`, `rot`, `schwarz`) könnten mit einer unabhängig von Batch B/C
hinzugefügten, gleichnamigen Rampe kollidieren — in diesem Fall beide Einträge inhaltlich
vergleichen und nur EINEN behalten (gleiche Farbwerte erwartet, falls beide dieselbe
Portrait-Lücke unabhängig gefunden haben).
