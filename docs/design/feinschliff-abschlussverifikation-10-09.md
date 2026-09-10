# Abschlussverifikation Feinschliff — die vier Ziele gegen die Rubrik nachgerechnet (10.09.)

**Auftrag von Chris (10.09., woertlich):** „hör erst auf wenn du da auch überall min >90 bist" —
fuer vier Ziele: Gewichtheben-Assets, Eiskunstlauf-Movement, Takeshi Assets+Gameplay,
Breaking Assets+Movement.

**Stand der Pruefung:** `main` = `46b90c8e` („Bahn-Chassis produktionsangeschlossen", 10.09.).
Alle fuenf zugehoerigen PRs sind gemergt: #872 (Fundament), #874 (Eiskunstlauf), #875 (Breaking),
#876 (Gewichtheben), #880 (Takeshi + Bahn-Produktivierung).

**Diese Pruefung uebernimmt KEINE Schaetzung aus einer PR-Beschreibung.** Jedes Unterkriterium ist
gegen die Rubrik in `gesamtstand-fertigstellungsgrad-alle-disziplinen-09-10.md` Abschnitt 0 einzeln
am gemergten Code belegt (Datei:Zeile). Die vier rho-Zahlen sind fuer diesen Bericht **frisch
gemessen**, nicht aus der Basislinie uebernommen.

---

## 0. Die Rubrik, wie sie hier angewandt wird

Konzept K1–K4 je 25 · Assets A1 30 / A2 25 / A3 25 / A4 20 · Gameplay G1 40 / G2 30 / G3 15 / G4 15 ·
Movement M1 35 / M2 25 / M3 25 / M4 15.

Zwei Praezedenzfaelle aus der Basislinientabelle steuern die Anwendung, damit hier nicht milder
gemessen wird als am 10.09. vormittags:

* **A4 haengt am TON, nicht an der Kulisse.** Hockey hat mit `eisflaeche()` eine vollwertige
  Kulisse und bekam trotzdem Assets 80 („vollstaendig, aber ohne Ton") — also A4 = 0. Ein
  Katalogeintrag ohne Aufrufstelle ist kein Ton.
* **G4 ist chassisabhaengig:** Feldspiel/Buehne 15, Bahn/Arena 12 (Rubrik-Fussnote). Die
  Basislinie „Takeshi Gameplay 67" rechnet sich exakt als 40 + 0 + 15 + 12 — das bestaetigt die
  Lesart der Punktwerte unabhaengig.

### Die Ton-Zaehlung, die alles entscheidet

`TON_KATALOG` (`battle-mode.engine.js:16892`) traegt **vier** Disziplinen. Aufrufstellen im Code
gibt es aber nur fuer **zwei**:

| Katalogeintrag | Ereignisse im Katalog | `sfx()`-Aufrufstellen | `tonLoopStart()` | A4 |
|---|--:|--:|:--:|--:|
| `gewichtheben` (`:16893`) | 6 | **6** (`:11702`, `:12739` ×2, `:12740` ×2) | ja (`:12120`) | **20** |
| `breaking` (`:16920`) | 4 | **3** (`:12016`, `:12023`, `:12025`) | ja (`:21681`) | **20** |
| `eiskunstlauf` (`:16906`) | 5 | **0** | nein | **0** |
| `takeshis-castle` (`:16914`) | 5 | **0** | nein | **0** |

Nachgezaehlt mit `grep -o 'sfx("[a-z-]*"'` ueber die ganze Datei: 6 × `gewichtheben`,
3 × `breaking`, **null** fuer die anderen beiden. Zwei der vier Katalogeintraege sind tot.

---

## 1. Die Ergebnistabelle

| Ziel | Achse | Aufschluesselung | Achse gesamt | **>90 %?** |
|---|---|---|--:|:--:|
| 1 · Gewichtheben | **Assets** | A1 30 · A2 25 · A3 25 · A4 20 | **100 %** | **ja** |
| 2 · Eiskunstlauf | **Movement** | M1 35 · M2 22 · M3 25 · M4 12 | **94 %** | **ja** |
| 3 · Takeshi's Castle | **Gameplay** | G1 40 · G2 30 · G3 15 · G4 12 | **97 %** | **ja** |
| 3 · Takeshi's Castle | **Assets** | A1 30 · A2 25 · A3 20 · A4 **0** | **75 %** | **nein** |
| 4 · Breaking | **Assets** | A1 30 · A2 25 · A3 25 · A4 20 | **100 %** | **ja** |
| 4 · Breaking | **Movement** | M1 35 · M2 20 · M3 25 · M4 12 | **92 %** | **ja** |

**Fuenf von sechs beauftragten Achsen liegen ueber 90 %. Die eine, die es nicht tut, ist
Takeshi-Assets — und der ganze Fehlbetrag ist A4 (Ton).**

### Die vier Disziplinen als Ganzes (die drei nicht beauftragten Achsen aus der Basislinie fortgeschrieben)

| Disziplin | Konzept | Assets | Gameplay | Movement | Gesamt | vorher (10.09. frueh) |
|---|--:|--:|--:|--:|--:|--:|
| Gewichtheben | 100 | **100** | 95 | 85 (+) | **95 %** | 85 % |
| Breaking | 85 | **100** | 95 | **92** | **93 %** | 75 % |
| Eiskunstlauf | 90 | 70 | 95 | **94** | **87 %** | 79 % |
| Takeshi's Castle | 100 | **75** | **97** | 75 | **87 %** | 76 % |

(+) Gewichtheben-Movement war nicht beauftragt, steigt aber sichtbar mit: die Basislinie begruendete
die 85 ausdruecklich mit „es gibt keine echte Hebe-Bewegung — der Sprite steht, die Hantel wird als
Primitive daneben gezeichnet". Genau das ist mit `HEBEN_PHASEN`/`hebePhase()` behoben. Hier bewusst
nicht formal nachbewertet, weil Movement nicht Gegenstand des Auftrags war.

### Rangtreue: frisch gemessen, keine Regression

`node scripts/miss-alle-disziplinen.mjs 24 gewichtheben eiskunstlauf takeshis-castle breaking`,
kaderfest, Median ueber fuenf echte Team-Paarungen aus `data/generated/kaderfamilie-live-save.json`:

| Disziplin | rho je Spiel | Spannweite | rho Saison | Basislinie 10.09. | Abnahme |
|---|--:|--:|--:|--:|:--:|
| Eiskunstlauf | 0,885 | 0,083 | 0,979 | 0,885 | bestanden |
| Breaking | 0,869 | 0,114 | 0,951 | 0,869 | bestanden |
| Takeshi's Castle | 0,861 | 0,116 | 0,930 | 0,861 | bestanden |
| Gewichtheben | 0,854 | 0,209 | 0,923 | 0,854 | bestanden |

**Alle vier ziffernidentisch mit der Basislinie.** Der Bewegungs-/Ton-Umbau ist rangtreue-neutral,
wie der Vertrag bei `buehnenBewegung()` (`:11782-11790`, „nur `viz*`-Felder, niemals `rr()`") ihn
verlangt — das ist hier nicht behauptet, sondern gemessen.

---

## 2. Ziel 1 — Gewichtheben-Assets: **100 %** (PR #876)

| | Punkte | Beleg |
|---|--:|---|
| **A1** eigene Feld-Datei im produktiven React-Renderer | **30 / 30** | `barbell.tsx` 589 Z. (vorher 450). Power-Rack-Rahmen (`:308-311`), kg-Achse mit Ticks (`:313-326`), GEFORDERT-Latte mit CSS-Transition ueber `TRACK_ROUND_MS` (`:356`), **Drei-Versuche-Tafel** ○/✓/✗ je Team fuer die aktuelle Reissen-/Stossen-Haelfte (`:401-425`, abgeleitet ueber `barbellAttemptStatus()` `:75-89`), Platten-Tuerme mit rAF-getriebenem Clip (`:444-503`, Clip-Rechteck `:127`), Kampfrichter-Dreierreihe am Token (`:549-560`). |
| **A2** eigene Szene im Mockup-Motor | **25 / 25** | `bodenHeben()` (`:12119-12188`) — eigene Wettkampfplattform statt `bodenBuehne()`s Allzweck-Podest: drei IWF-Kampfrichterlampen (`:12144-12157`), Anzeigetafel mit Uebung/Versuch/kg (`:12162-12173`), Kreide-/Magnesiakiste, Hantelstaender, Publikumssilhouetten. Dazu `zeichneHeben()` (`:12667`). |
| **A3** disziplinrichtige Ausruestung an den Sprites | **25 / 25** | `HEBEN_HAND` (`:358-363`, per Pixelscan der Alphakontur ausgemessen, Beweisbild `docs/design/sprite-handpunkte-beweis-gewichtheben.png`), `HEBEN_PHASEN` (`:370-377`), `zeichneHantel()` (`:398-437`) mit **kg-abhaengiger Scheibenstaffel** (`HEBEN_SCHEIBEN_STUFEN` `:379-390`, IWF-Farben 25/20/15/10). Gezeichnet an der HAND, nicht freischwebend (`:2983-2985`). Die Zufalls-Kosmetikwaffe — der namentliche A3-Mangel der Basislinie — ist ueber `DISZIPLIN_WAFFE.gewichtheben = null` (`:2187`) weg, wirksam via `waffeEffektiv` (`:2666-2667`). |
| **A4** Ton, Musik, Kulisse | **20 / 20** | **Verdrahtet, nicht nur katalogisiert.** Ansage-Gong bei jeder Enthuellung (`:11702`), `gueltig`+`stange_hoch` beim Phasenwechsel zug→hoch und `ungueltig`+`scheiben_fall` beim Uebergang →abwurf (`:12735-12745`, entprellt ueber `zug._tonPhase`). Publikums-Loop startet in `bodenHeben()` (`:12120`), stoppt in `bodenBuehne()` (`:12110`) **und im Reset** (`:21632-21639` — der N1-Fix aus Review PR #879; ohne ihn blieb das Publikum ab dem zweiten Gewichtheben-Kampf stumm). Kulisse = A2. |

**Fazit Ziel 1: erreicht, ohne Vorbehalt.** Die Ton-Frage aus dem Auftrag ist eindeutig beantwortet:
sechs echte Aufrufstellen plus Loop-Start/-Stop/-Reset, kein Katalogeintrag ohne Anschluss.

---

## 3. Ziel 2 — Eiskunstlauf-Movement: **94 %** (PR #874)

| | Punkte | Beleg |
|---|--:|---|
| **M1** eigene Zeichenfunktion/-zweig | **35 / 35** | `zeichneDuett()` (`:12369`) neu gebaut: **Kufenspur** als ausblendender Streckenzug aus `u.vizSpur` in zwei Durchgaengen (dunkle Rille + blauer Kern, `:12417-12430`) statt der statischen Doppelellipse, Tiefensortierung nach `vizY` (`:12410-12415`). Dazu `bodenEis()` (`:12201`) — eigene Eisflaeche statt `bodenBuehne()`s Podest, Geometrie geteilt mit `kuerFlaeche()` (`:11836`), damit Eis und Kufenbahn nie auseinanderlaufen. |
| **M2** eigene Bewegungs-/Schrittlogik | **22 / 25** | `stepKuer()` (`:11840-11921`): Lissajous-Grundfahrt je Paar aus `kuerHash()` (kein `rr()`), Elementzustaende pirouette/hebung/wurf aus `u.aktuell%3`, Sturz aus `runden[].ereignis === art.failWort`, Schlusspose-Anfahrt. Angeschlossen ueber den Dispatcher `buehnenBewegung()` (`:11791-11794`), exklusiv auf `art.duett` gegatet. **Abzug 3:** `stepBuehne()` kehrt bei `done` sofort zurueck (`:11691`), `buehnenBewegung()` laeuft danach nie wieder — der Laeufer der LETZTEN Enthuellung friert auf halbem Weg in die Schlusspose ein. Ein Einzeiler (s. Abschnitt 6). |
| **M3** sichtbare Animation in der produktiven React-Buehne | **25 / 25** | `eiskunst.tsx` unveraendert (PR #874 fasst nur den Motor an): `useTokenGlide` (`:116`), `GhostLayer` (`:485`), Glow-Puls (`:517`). Das ist derselbe Umfang, den die Basislinie hier bereits mit 25 bewertet hat — kein Zugewinn, aber auch kein Verlust. |
| **M4** disziplineigene Posen/FX | **12 / 15** | Pirouette als Drehung um den Fusspunkt (`:12456-12459`), Hebung als Vertikalversatz (`:12440-12444`), Wurf als Bogen laengs der Fahrtrichtung (`:12445-12450`), Sturz als Kippung um 1,15 rad (`:12452-12455`), `zeichneEisstaub()` bei sauberer Landung und waehrend der Pirouette (`:12354-12367`, `:12464-12468`). **Abzug 3 (N7 aus Review PR #878, unbehoben):** waehrend Pirouette/Sturz haelt `haeltStelle` die Position, der Ringpuffer wird aber weiter mit demselben Punkt gefuellt (`:11918-11919`) — nach 60 Bildern (1 s) ist die Spur auf einen Punkt zusammengefallen, eine Pirouette dauert 1,4 s. Die Kufenspur ueberlebt also kein einziges Element. |

### Die N1/N2-Fixes des Reviewers: verifiziert, im gemergten Code, wirksam

* **N1 (Partner-Abstand)** — `:11858`:
  `const eigenPh = kuerHash(paarId,9)*6.2832 + ((partner && u.id!==paarId) ? Math.PI : 0)`.
  Phase aus der **Paar-ID** statt aus der eigenen `u.id`, plus diametraler `Math.PI`-Versatz fuer
  den zweiten Partner. Geometrisch garantiert der Abstand damit `eigenR*sqrt(1+3cos²)` ∈ [19 px,
  38 px] und wird nie null; vorher fielen 5 von 30 Paarungen auf 1,6 px zusammen.
* **N2 (Schlusspose-Haeufung)** — `:11889`:
  `const zx = F.cx + (TEILNEHMER.length>1 ? (paarId/(TEILNEHMER.length-1)-0.5)*F.ax*1.5 : 0) + (partner ? (u.id===paarId ? -16 : 16) : 0)`.
  Der Zielpunkt traegt jetzt **beides**: einen Versatz je Paar (injektiv, weil `paarId` die kleinere
  der beiden fortlaufend vergebenen `u.id` ist) und den Partner-Versatz ±16 px. Vorher lief jedes
  Paar auf dieselben zwei Punkte in der Bildmitte.

**Fazit Ziel 2: erreicht.** Die beiden Befunde, die der Reviewer ausdruecklich als
„behebenswert vor dem Deploy" markiert hatte, stehen im gemergten Code und wirken. Seine
80-%-Einschaetzung war explizit an genau diese zwei Punkte gebunden und ist damit ueberholt.
Offen bleiben N7 (Kufenspur) und N8 (`"einlauf"` ist ein Zustandsname ohne Verhalten, `:11847`) —
beide kosmetisch, beide hier eingepreist.

---

## 4. Ziel 3 — Takeshi's Castle: Gameplay **97 %** ✔ · Assets **75 %** ✘ (PR #880)

### Gameplay — 97 %

| | Punkte | Beleg |
|---|--:|---|
| **G1** Rangtreue kaderfest | **40 / 40** | rho je Spiel **0,861** (frisch gemessen, n=24, Median ueber fuenf echte Kader, Spannweite 0,116) — ueber der 0,85-Schwelle, also die volle Stufe. |
| **G2** Produktionsanschluss | **30 / 30** | **Das war die einzige Luecke der Basislinie und sie ist zu.** `"takeshis-castle"` steht in `ARENA_RESOLVED_DISCIPLINE_IDS` (`lib/resolve/battle-mode-arena-team-points.ts:251`), zusammen mit `staffel` und `time-trial`. Getragen vom neuen Bahn-Chassis: `spieleBahn()`-Dispatch in `arena-headless-runner.ts:478`, eigene PPS-Referenz `data/generated/takeshis-castle-pps-referenz.json`, Invarianten-Tests in `tests/spiele-bahn-invarianten.test.ts` (221 Z. neu). Spurt bewusst draussen (Feldgroessen-Diskrepanz, Fund F1 aus Review PR #881 — eigenes Folge-Ticket, im Kommentar `:249` festgehalten). |
| **G3** eigene Wertung im Spiel | **15 / 15** | `bahnTeamstand()` (`:16441`) liefert fuer Takeshi `suffix:"Burgpunkte"`, `gewertet:true` und `fmt` mit einer Nachkommastelle (`:16466-16490`), aufgeschluesselt in Sterne (`burgpunkte()` `:17061`) und Zielbonus (`zielbonus()` `:17071`) — genau die Aufschluesselung, die Chris am 05.09. verlangt hat. |
| **G4** 2–6-Spieler-Tauglichkeit | **12 / 15** | Bahn-Chassis; die Rubrik setzt fuer Bahn/Arena 12 an. Voller Punktwert ist auf diesem Chassis konstruktionsbedingt nicht erreichbar — kein Mangel dieser PR. |

### Assets — 75 %, **das Ziel ist verfehlt**

| | Punkte | Beleg |
|---|--:|---|
| **A1** eigene Feld-Datei im produktiven Renderer | **30 / 30** | `takeshi.tsx` **517 Z.** (vorher 273). Fuenf echte Gelaendezonen 1:1 aus `BAHN_ART["takeshis-castle"].zonen` (`:43-55`), **zehn Fallenbilder als eigene SVG-Symbole** an festen Streckenpositionen (`FALLEN` `:61-72`, `falleSvg()` `:263`), Gluehen-Impuls sobald der Fuehrende (`sorted[0]`, `:192-196`) eine Falle passiert, breiteres Auffaechern der Laeufer quer zur Route. Vorher/Nachher belegt: `docs/design/takeshi-tsx-vorher-svg-10-09.png` / `-nachher-`. |
| **A2** eigene Szene im Mockup-Motor | **25 / 25** | `bodenTakeshiRoute()` (`:17230`, Schlangenroute mit fuenf Zonen, Tuempeln, Burgmauer und Tor) plus `zeichneFalleTakeshi()` (`:17109`, zehn Fallenbilder) — unveraendert vollstaendig. |
| **A3** disziplinrichtige Requisiten | **20 / 25** | `DISZIPLIN_WAFFE["takeshis-castle"] = null` (`:2190`, PR #872) nimmt dem Parcourslaeufer die Schrotflinte — der namentliche Sicht-QA-Befund („niemand laeuft einen Hindernisparcours mit Sturmgewehr") ist behoben. Abzug 5: eigene Props gibt es nur an der STRECKE (Fallen, Burgtor), nicht AM Sprite — kein Helm, kein Startnummernband, nichts, was den Laeufer als Takeshi-Kandidaten kenntlich macht. Dieselbe Teil-Wertung, die die Basislinie fuer Eiskunstlauf („keine Schlittschuhe, kein Kostuem") vergeben hat. |
| **A4** Ton, Musik, Kulisse | **0 / 20** | **Der Reviewer von PR #880 hat es vorhergesagt, und es ist so geblieben.** `TON_KATALOG["takeshis-castle"]` existiert mit fuenf fertigen Synth-Ereignissen — `falle`, `sturz`, `platsch`, `tor`, `publikum` (`:16914-16920`). **Aufrufstellen: null.** Nachgezaehlt ueber die ganze Datei: `sfx("takeshis-castle"` kommt kein einziges Mal vor, `tonLoopStart("takeshis-castle")` ebenso wenig (die beiden einzigen `tonLoopStart`-Aufrufe stehen bei `:12120` fuer Gewichtheben und `:21681` fuer Breaking). Der Katalog ist tot. Nach dem Hockey-Praezedenzfall (Kulisse ja, Ton nein → A4 = 0) sind das null Punkte, nicht 15–20. |

**Fazit Ziel 3: Gameplay klar erreicht (97 %), Assets klar verfehlt (75 %).** Die Schaetzung
„80 ohne PR #872, 95 sobald die vier Ton-Aufrufstellen ergaenzt sind" war korrekt formuliert — die
Bedingung im zweiten Halbsatz ist aber **nicht eingetreten**. #872 gemergt zu haben genuegt nicht:
#872 liefert nur den Katalog und die `sfx()`-Funktion, die Aufrufstellen waren ausdruecklich nicht
Teil von #880 und wurden von keiner anderen PR nachgereicht.

---

## 5. Ziel 4 — Breaking: Assets **100 %** ✔ · Movement **92 %** ✔ (PR #875)

### Assets — 100 %

| | Punkte | Beleg |
|---|--:|---|
| **A1** eigene Feld-Datei | **30 / 30** | `breaking.tsx` **345 Z.** (vorher 187 — die Basislinie nannte sie „die duennste aller zwanzig Feld-Dateien"; das gilt nicht mehr). Fuenf Ergaenzungen, alle dekorativ, `tokenPos`/`angOf` unangetastet: Linoleum-Cypher-Boden statt reinem Verlauf, DJ-Pult/Boombox/Lautsprecher am Rand, Battle-Bracket-Leiste oben (`:276`), Beat-Puls auf festem BPM-Raster (`BREAKING_BPM = 100`, `:44-50`), und die Sicht-QA-Kollision der Zonen-Etiketten geloest ueber Hover statt Dauereinblendung (`:74-79`, `:197-209`). |
| **A2** eigene Szene im Mockup-Motor | **25 / 25** | `zeichneBreaking()` (`:13156`): radialer Cypher-Verlauf (`:13164-13168`), vier Druck-Ringe mit denselben Radien wie `breaking.tsx` (`:13171-13180`), neun deterministische Boden-Risse (`:13185-13196`), Survivor-Kern auf `BREAKING_BPM` gerastert (`:13198ff`). |
| **A3** disziplinrichtige Requisiten | **25 / 25** | Waffenunterdrueckung fuer Breaking (`DISZIPLIN_WAFFE.breaking = null`, `:2187`), und die Moves selbst sind die Requisite: Toprock/Footwork/Windmill/Freeze als eigene Sprite-Transformationen (`:13282-13302`) plus `zeichneBodenstaub()` beim Powermove (`:13296`). |
| **A4** Ton, Musik, Kulisse | **20 / 20** | **Verdrahtet.** Beat-Loop als Musikbett, an `running` gebunden (`:21681`). `powermove`-Rauschsweep beim Windmill-Ansatz (`:12016`), `freeze` beim Erfolg (`:12023`), `abbruch` beim Fehlschlag (`:12025`) — drei Aufrufstellen an echten Phasenuebergaengen der Zustandsmaschine, nicht an einem Timer. Reset stoppt den Loop (`:21631`). Kulisse = A2. |

### Movement — 92 %

| | Punkte | Beleg |
|---|--:|---|
| **M1** eigener Zeichenzweig | **35 / 35** | Vier Move-spezifische Zeichenzweige in `zeichneBreaking()` (`:13282-13302`): Toprock, Footwork (Stauchung), Powermove (Rotation um den Fusspunkt + Bodenstaub), Freeze (Vorschau-Kippung); dazu Erfolgs-/Fehlschlag-Ringe aus `u.vizPhase` (`:13318-13341`) und Torkeln im Rueckzug (`:13299-13301`). |
| **M2** eigene Bewegungslogik | **20 / 25** | `stepCypher()` (`:11969-12042`) ersetzt das „rein zeichnerisch" der Basislinie durch eine echte Zustandsmaschine ring→eintritt→throwdown→freeze/rueckzug, mit Ringplatz nach Rang (`cypherRingWinkel()` `:11955`), BPM-Wippen (`cypherRingRadius()` `:11963`) und einem Timing-Budget von 0,55 s < `rundenDauer` 0,625 s, damit nie zwei gleichzeitig in der Mitte stehen. **Abzug 5 fuer zwei unbehobene Befunde aus Review PR #877:** *N1* — `stepBuehne()` kehrt bei `done` sofort zurueck (`:11691`), der letzte Tanzende bleibt fuer immer in `eintritt` auf halbem Weg zur Mitte stehen, sein `freeze`/`abbruch`-Ton faellt aus (gemessen: ab Frame 3612 eingefroren, 389 Frames unbewegt). *N2* — im Zustand `ring` wird `u.vizA` jeden Frame neu aus dem Rang geschrieben (`:12007`), ohne Glaettung: **107 Winkelspruenge ≥ 0,3 rad je Spiel, groesster 2,80 rad** (gemessen ueber 41 058 Ring-Messpaare), also rund 1,1 Teleports je Enthuellung, alle 0,625 s sichtbar. |
| **M3** sichtbare Animation in der React-Buehne | **25 / 25** | `breaking.tsx`: `useTokenGlide` (`:101`), `GhostLayer` (`:307`), zwei `olyGlowPulse`-Ringe (`:329`, `:331`), Zonen-Fade (`:210`), Druckwellen-/Kern-Puls auf BPM-Raster (`PULSE_DUR`, `CORE_BREATH_DUR`, `:47-50`). |
| **M4** disziplineigene Posen/FX | **12 / 15** | Die vier Move-Posen und der Bodenstaub (s. M1). **Abzug 3 (N3, unbehoben):** die Ausblendungen rechnen noch mit den Konstanten der ersten Fassung — `p = Math.max(0, 1 - u.vizPhaseT/0.35)` fuer den goldenen Standbild-Ring (`:13322`) und `/0.3` fuer den roten Riss-Flash (`:13331`), waehrend `FREEZE_T` und `RUECKZUG_T` beide auf 0,15 s stehen (`:11988`). Am Phasenende steht `p` deshalb bei 0,571 bzw. 0,50 — der Effekt blendet nie aus, er reisst ab. |

**Fazit Ziel 4: beide Achsen erreicht.** N1/N2 aus Review PR #877 senken das Ergebnis messbar
(Movement 92 statt 100), reissen es aber nicht unter die Marke. N4/N5 (Etiketten-Kollision nur in
`breaking.tsx` geloest, nicht auf der Canvas-Buehne) betreffen Assets-Feinheiten, die die Basislinie
schon vor dieser PR nicht gutgeschrieben hatte, und sind hier nicht doppelt gezaehlt. N9 (toter
`perm`/`frac`/`maxSumme`-Fallback, `:13252-13255`) ist reine Aktenlage.

---

## 6. Nachbesserungsbedarf, nach Aufwand sortiert

**1 — Vier `sfx("takeshis-castle", …)`-Aufrufstellen. Das ist der einzige Grund, warum Ziel 3 die
Marke reisst.** Der Katalog steht fertig da (`:16914-16920`), es fehlen ausschliesslich die
Aufrufe. Die Stellen sind bereits identifiziert und tragen alle schon den passenden Zustand:

| Ton | Stelle | Was dort ohnehin passiert |
|---|---|---|
| `falle` | `:19326` | `u.fallen.push({typ, skill, stoppAnteil, aus:'sauber'})` — die Falle wird ausgeloest |
| `sturz` | `:19431` | `schwebe({… txt:"stolpert" …})` — der Laeufer stuerzt |
| `tor` | `:19425` / `:19637` | `rennFertig.push(u)` — Ziel erreicht bzw. ausgeschieden |
| `publikum` | `bodenTakeshiRoute()` `:17230` | genau das Muster, das `bodenHeben()` `:12120` schon fuehrt (mit Stop im Reset, `:21639`) |

Erwartete Wirkung: **A4 0 → 20, Assets 75 → 95, Gesamt Takeshi 87 → 92 %.** Aufwand: fuenf Zeilen
plus eine Flaggen-Zeile im Reset. Rangtreue-neutral (`sfx()` ruft nie `rr()`, harte Regel `:16765`).

**2 — Dieselbe Luecke bei Eiskunstlauf, gleicher Preis.** `TON_KATALOG.eiskunstlauf` (`:16906`)
traegt `kufe`/`sprung`/`landung`/`sturz`/`publikum` — ebenfalls **null** Aufrufstellen. Der
natuerliche Ort ist der Elementuebergang in `stepKuer()` (`:11864-11873`, wo `vizPhase` und
`vizSturz` ohnehin gesetzt werden) plus ein Loop-Start in `bodenEis()` (`:12201`). Das war nicht
Teil des Auftrags, hebt aber Eiskunstlauf-Assets von 70 auf ~90 und schliesst die letzten beiden
toten Katalogeintraege.

**3 — Ein echter Einzeiler mit doppelter Wirkung: `buehnenBewegung(dt)` auch nach `done` laufen
lassen.** `stepBuehne()` steigt bei `:11691` (`if(done)return;`) aus, bevor der Dispatcher bei
`:11774` drankaeme. Das ist die gemeinsame Wurzel von *Breaking N1* (letzter Tanzender friert in
`eintritt` ein, sein Ton faellt aus) **und** der Schlusspose, die bei Eiskunstlauf am letzten
Laeufer nie ankommt. Die Funktion schreibt ohnehin nur `viz*`-Felder, der Vertrag bei `:11782-11790`
erlaubt den Aufruf also unveraendert. Wirkung: Breaking Movement 92 → 95, Eiskunstlauf Movement
94 → 97.

**4 — Zwei Zahlen, die schon woanders stehen (Breaking N3).** Die Divisoren `0.35` (`:13322`) und
`0.3` (`:13331`) auf `FREEZE_T`/`RUECKZUG_T` (`:11987`, beide 0,15) setzen, statt die Zahl ein
zweites Mal zu schreiben. Dann blenden die Effektringe aus, statt abzureissen. M4 12 → 15.

**5 — Breaking N2 (Teleport beim Rangwechsel), drei Zeilen.** `u.vizA` in `:12007` wie den Radius
ueber `NAECHER()` glaetten, mit Beachtung des Winkelumlaufs. Rein kosmetisch, aber 107-mal je Spiel
sichtbar.

**6 — Eiskunstlauf N7, eine Bedingung.** Waehrend `haeltStelle` (`:11885`) nicht in `u.vizSpur`
pushen (`:11918`), sonst faellt die Kufenspur bei jeder Pirouette auf einen Punkt zusammen.
M4 12 → 15.

---

## 7. Was diese Pruefung nicht leisten kann

* **Ton auf echter Hardware.** Belegt ist, dass Katalogeintraege und Aufrufstellen existieren und
  an den richtigen Zustandsuebergaengen sitzen. Ob es *gut klingt*, kann nur Chris beurteilen —
  alle Toene sind prozedural synthetisiert (`:16753-16762`: der Umgebungs-Proxy laesst keine
  Audio-Dateien durch; der Weg zurueck ueber `{datei:…}` steht offen).
* **Wie sich Bewegung anfuehlt.** Gemessen sind Zustaende und Positionen, nicht Anmutung.
* **Die drei nicht beauftragten Achsen je Disziplin** sind aus der Basislinie fortgeschrieben, nicht
  neu erhoben — mit der einen Ausnahme, die oben ausdruecklich als solche markiert ist
  (Gewichtheben-Movement).
