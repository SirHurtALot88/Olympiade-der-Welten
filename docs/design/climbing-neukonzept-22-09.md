# Climbing als echtes Indoor-Wandklettern — Neukonzept (Fable, 22.09.)

Chris (22.09., zu einem Screenshot des laufenden Spiels), wörtlich: „climbing ist total falsch
geworden, das ist ja n hindernislauf soll aber echtes indoor klettern darstellen! wo man auch
versuchen kann andere aus dem gleichgewicht zu bringen oder man abrutschen kann etc."

Dieses Dokument ist reines Konzept — kein Produktionscode, keine Motoränderung. Alle Zahlen sind
**Vorschläge** und als solche markiert; was gemessen ist, steht mit Datei und Zeile daneben.
`engine.js` meint `public/mockups/battle-mode.engine.js` (Stand `main` `0f812538`, 22.09.).
Form und Tiefe folgen `docs/design/i-spy-schatzsuche-konzept-21-09.md`.

## Kurzfassung

- **Chris hat recht, und zwar mechanisch, nicht nur optisch.** Climbing ist heute ein Spurt mit
  anderen Wörtern: dieselbe Bahn-Bewegung (`tempoVon()`, `engine.js:26866`), derselbe
  Hindernis-Block (`:27181-27439`, „Hürde" heißt hier „Griff"), dieselben Sprinter-Sprites auf
  zwölf horizontalen Bahnen, dieselbe Wertung nach Zieleinlauf (`bahnRangliste()`, `:23100`).
  Was Climbing eigen hat, sind drei Zahlen (`steigung:0.85`, `wuchtKraft:18`, `stolperKraft:8`),
  ein Rezept und seit dem 17.09. eine Wandtextur unter den Läufern
  (`bodenClimbing()`, `:24772`). Ein Fehlgriff ist ein Stolperer (0,4–0,9 s bei 35 % Tempo), ein
  Sturz existiert nicht, ein Gegner ist auf der Wand nicht vorhanden (`tackle:false`,
  `schatten:false`).
- **Climbing ist eine LIVE-Disziplin mit bestandener Abnahme** — das ist der Unterschied zu
  I-Spy. Seit dem 16.09. steht `"climbing"` in `ARENA_RESOLVED_DISCIPLINE_IDS`
  (`lib/battle/arena-resolved-disciplines.ts:165`), kaderfest rho je Spiel **0,834** (Spannweite
  0,209, Saison 0,860, `data/generated/rangtreue-basislinie.json:47-54`), Pp-Abweichung **19,4**
  (`docs/design/climbing-kalibrierung-16-09.md`). Ein Neubau der Mechanik ist deshalb kein
  Rettungsversuch, sondern ein **Validitäts-Eingriff an einer laufenden Disziplin** — mit CI-
  Schranke (`npm run ci:rangtreue-schranke`), PPS-Referenz und Basislinie, die alle nachgezogen
  werden müssen, und mit einer Latte, die nicht 0,80 heißt, sondern „nicht schlechter als heute".
- **Das Chassis bleibt; die Wand ist eine Bahn, die nach oben zeigt.** `u.pos` ist bereits die
  Höhe, `u.reserve` ist bereits die Unterarm-Pumpe, `steigung` zieht bereits den Verbrauch mit
  der Höhe an, `hindernisse` sind bereits zehn Griffe, und `bahnRangliste()` ordnet Nicht-
  Angekommene bereits nach erreichter Strecke (`:23120`) — also nach **Höhe**, wie im Lead.
  Was fehlt, sind vier Dinge: (1) eine **vertikale Darstellung** mit Kletterpose (rho-neutral),
  (2) **Griffarten** mit eigenem Sub-Skill (Takeshis `hindernisTypen`/`fallenKoennen`, dort
  gemessen rho-hebend, `:27317-27323`), (3) ein **Abrutschen** mit Neustart eines Abschnitts
  statt eines Stolperers, und (4) **Gleichgewicht** als dritte Ressource neben Reserve und
  Nerven — der Kanal, über den Gegner einwirken.
- **„Andere aus dem Gleichgewicht bringen" hat zwei Lesarten, und die Entscheidung dazwischen
  ist Chris' wichtigste.** G-1 ist der **Störgriff**: aktiver Kontakt an geteilten Griffen der
  Nachbarroute — technisch fast gratis, weil Takeshis Rempler-Block (`tackle`, `tackleFenster`,
  `tackleAusweichen`, WUCHT gegen ROBUST, `:27451-27564`) mit Konfiguration statt Code
  wiederverwendbar ist. G-2 ist der **Gegnerdruck**: wer auf der Nachbarroute überholt wird,
  verliert Gleichgewicht, gedämpft durch die eigenen Nerven — ohne `rr()`, ohne fremde Hand am
  eigenen Wurf. Empfehlung: **G-2 immer, G-1 als gemessener Schalter, und in beiden Fällen gilt:
  fremde Hand senkt nur das Gleichgewicht, sie stürzt nie.** Der Sturz fällt immer aus dem
  eigenen Wurf — damit bleibt die Projektregel „kein Zug durch fremde Hand vernichtet" in ihrer
  weichen Form erhalten (Takeshis `tackleNerven` hat die harte Form gemessen: Saison 0,937 → 0,902,
  `:25448-25450`).
- **rho-Risiko: mittel, benennbar, und mit Rückfall.** Heute liest Climbing eine Verlässlichkeit
  von ≈ 0,94 (0,834/0,860 = 0,97, quadriert) — Rennzeiten sind stabil; was fehlt, ist Validität
  (Saison 0,860 ist die viertniedrigste der fünf Bahnen). Griffarten und ein lebendiger
  ROBUST-Kanal (heute **0,0 %** mechanisches Gewicht, Kalibrierung 16.09.) sollten die Validität
  heben; das Abrutschen zur Zone senkt die Verlässlichkeit. Schätzung nach der ersten
  Kalibrierrunde: 0,80–0,86. Der Rückfall ist eingebaut: jedes neue Feld in `BAHN_ART.climbing`
  ist ungesetzt bit-identisch (Bahn-Konvention), die vertikale Darstellung ist ohnehin rho-frei —
  schlimmstenfalls bleibt die alte Mechanik unter einer neuen Wand.
- **Aufwand: sechs PRs, 7–10 Arbeitstage.** PR 1 (Wand-Darstellung) beantwortet Chris' Satz
  „das ist ja n hindernislauf" sichtbar und ohne Messrisiko; PR 2 (Mechanik + Rezept-Refit) ist
  die einzige, die über Bestehen oder Scheitern entscheidet. Eine parallele Baustelle ist zu
  beachten: `climbing-fortschrittsbalken-22-09` (Worktree, heute) fasst `engine.js` und
  `battle-mode.css` für alle fünf Bahnen an.

---

## 0. Ist-Zustand, nachgelesen

### 0.1 Was heute im Motor steht

```js
climbing:{
  // MATRIX: stamina 26, determination 16, speed 12, dexterity 12, health 10,
  // power 8, awareness 8, will 8.
  technikBasis:0.25, technikSpanne:0.0062, wuchtBasis:0.14, wuchtSpanne:0.0092,
  wendigErholt:0.0045,
  wuchtKraft:18, wuchtZeit:0.18, stolperGrund:0.42, stolperSpanne:0.5, stolperKraft:8,
  kraftBasis:310, kraftSpanne:3.1,
  pusteRegen:1.0, leerSchonung:0.45, leerRegen:6.0, pusteFangen:0.12,
  label:"Climbing", jeSeite:6, climbing:true,
  hindernisse:[0.08,0.17,0.26,0.35,0.44,0.53,0.62,0.71,0.80,0.89],
  hindernisWort:"Griff", boden:"#5d5a54", baeume:false, schatten:false, tackle:false,
  grundTempo:80, tempoSpanne:0.80, steigung:0.85, wertung:"rang",
  rezept:{ ANTRITT:{power:38,dexterity:32,speed:30}, ENDTEMPO:{stamina:44,determination:31,speed:25},
           TECHNIK:{dexterity:44,awareness:33,power:23}, WENDIGKEIT:{dexterity:45,speed:32,awareness:23},
           STEHEN:{stamina:24,will:32,health:34,determination:10}, WUCHT:{power:42,determination:28,health:30},
           ROBUST:{health:32,stamina:28,will:24,determination:16} },
  lang:{ANTRITT:"Zug",ENDTEMPO:"Ausdauertempo",TECHNIK:"Griff",WENDIGKEIT:"Umsetzen",
        STEHEN:"Kraftausdauer",WUCHT:"Kraftzug",ROBUST:"Zähigkeit"},
  plaene:{sparsam, stetig, angriff}, planJeSlot:{routereader:"stetig", gripspecialist:"stetig",
        paceclimber:"sparsam", endurancewall:"sparsam", dynamicmove:"angriff", summitpush:"angriff"}
}
```
(`engine.js:25228-25307`, gekürzt.) Die sechs Slots stehen in `lib/lineups/matchday-slot-roles.ts:129-136`:
Route Reader (det/aw), Grip Specialist (dex/pow), Pace Climber (stam/speed), Endurance Wall
(stam/health), Dynamic Move (speed/dex), Summit Push (det/will). Kein Eintrag in
`lib/player-generator/spiel-eignung-overrides.ts` — die Matrix gilt unverändert.

**Ablauf eines Rennens**, generisch für alle fünf Bahnen (`stepSpurt`): `tempoVon()`
(`:26866-26907`) liefert das Tempo aus ANTRITT/ENDTEMPO, Plan, Ermüdung (STEHEN), Stolperer
(×0,35), Reserve-Einbruch, Nerven (nur bei `nervenKosten`, also nicht Climbing). Der Reserve-
Verbrauch wächst mit der Höhe: `if(BA().steigung)zehr*=1+BA().steigung*u.pos` (`:27109`) — am
Top 1,85-fach. Puste lädt am Hindernis-Stopp, unter Plantempo und im Einbruch wieder auf
(`:27144-27148`), Einbrechen/Fangen bei 0 % bzw. 12 % (`:27149-27164`).

**Der Griff** ist der Hürden-Block (`:27181-27439`) mit einem anderen Wort. Bei jeder der zehn
Positionen: Wurf 1 `rr() ≤ 0,25 + TECHNIK·0,0062` → „sauber drüber", kostet nichts. Sonst
Wurf 2 `rr() ≤ 0,14 + WUCHT·0,0092` → „bricht durch" / Ticker „nimmt den Griff mit Gewalt":
Reserve −18, 0,18 s Stolperer. Sonst **Stolperer**: `0,42 + (1−TECHNIK/100)·0,5` Sekunden bei
35 % Tempo, gedämpft um `max(0,35; 1−WENDIGKEIT·0,0045)`, Reserve −8, `u.gestolpert++`,
Ticker „stolpert". Bei TECHNIK 50 / WUCHT 50 also 56 % sauber, 26 % Kraftzug, 18 % Stolperer je
Griff — 1,8 Stolperer je Rennen und Kopf, keiner davon ein Sturz. `u.huerde` (Stopp am
Hindernis) bleibt für Climbing immer 0, weil kein `hindernisTypen`/`huerdePreis` gesetzt ist
(nachgemessen in `climbing-wand-17-09.md`): ein gelungener Griff kostet **keine** Zeit — genau
der P6-Befund aus dem Motorkommentar: „solange ein Hindernis zu 80 % gelingt, kostet es fast nie
etwas — und dann zahlt das Attribut nicht, das es entscheidet" (`:27185-27188`).

**Wertung:** `wertung:"rang"` → `bahnRangliste()` (`:23100-23125`) sortiert Angekommene nach
Zeit, Nicht-Angekommene nach `pos`, vergibt N−i Punkte, Teamstand ist die Summe
(`bahnTeamstand()`, `:23143-23147`, Suffix „Punkte nach Rang"). `MOTOREN[bd]` wird für jede
`BAHN_ART`-Disziplin in derselben Schleife registriert (`:31215`), `lauf` treibt 90 s Motorzeit
(`:31228`). Ein Zeitlimit für das Rennen gibt es nicht; es endet, wenn alle im Ziel sind.

**Präsentation:** `bodenSpurt()` → `bodenClimbing()` (`:24772`, seit 17.09.: Überhang-
Schattierung, Risslinien, zehn Griffmarken über der vollen Höhe) über `bodenSpurtGerade()`;
Läufer auf zwölf horizontalen Bahnen, `laeuferXY()` (`:26327-26330`) liefert für alles außer
Oval/Route `{x:camX(u.pos), y:bahnY(u.bahnZ)}`; `stepClimbing()` (`:27973-27994`) schreibt nur
`vizSchritt` und vier Ton-Zähler (griff/zug/fehlgriff/topout). Endstand: „gewinnt — 41 : 37
Punkte nach Rang" (`renderEndstandBahn()`, `:30523-30530`), Spalten Läufer/Platz/Zeit/Punkte.

### 0.2 Status: live, abgenommen, mit Schranken

| Größe | Wert | Quelle |
|---|---|---|
| Arena-aufgelöst | ja, seit 16.09. (PR #943) | `arena-resolved-disciplines.ts:118-136, 165` |
| rho je Spiel, kaderfest (24, fünf Paarungen) | **0,834**, Spannweite 0,209 | `rangtreue-basislinie.json:47-54` |
| rho Saison | 0,860, Spannweite 0,308 | ebd. |
| Pp-Abweichung zur Matrix (n=48) | **19,4** (vorher 35,0) | `climbing-kalibrierung-16-09.md` |
| Toter Sub-Skill | ROBUST: **0,0 %** mechanisches Gewicht | ebd., `sondiere-feldspiel-subskills.mjs climbing 24` |
| PPS-Referenz | `data/generated/climbing-pps-referenz.json`, `chassis:"bahn"` | `battle-mode-arena-team-points.ts:169-175, 545, 776` |
| CI | `npm run ci:rangtreue-schranke` vergleicht gegen die Basislinie | `scripts/pruefe-rangtreue-schranke.mjs` |
| Scorecard (17.09.) | Assets 65 / Movement 100 / Gesamt 85,50 | `climbing-wand-17-09.md` |

Aus `docs/design/stand-aller-disziplinen.md` stimmt die Climbing-Zeile (`:225`, 0,790 „knapp")
nicht mehr — sie ist vom Stand vor der Kalibrierung. Der Nachzug gehört in PR 5 (Abschnitt 7).

**Die Konsequenz:** anders als I-Spy (0,684, bewusst nicht angeschlossen, roter Test) läuft
Climbing heute auf dem Server und rechnet Spieltage ab. Jede Mechanikänderung ändert die
Ergebnisverteilung, die in der PPS-Referenz eingefroren ist, und die CI-Schranke schlägt bei
einem rho-Rückgang an. Das ist kein Grund, es nicht zu tun — es ist der Grund, es in der
Reihenfolge des Handbuchs zu tun (Abschnitt 6.3).

### 0.3 Warum es ein Hindernislauf ist — was Chris sieht gegen das, was der Code tut

| Was Chris sieht | Was der Code tut | Fundstelle |
|---|---|---|
| Läufer nebeneinander, von links nach rechts | zwölf horizontale Bahnen, `x = camX(pos)`, `y = bahnY(bahnZ)` | `laeuferXY()` `:26330` |
| Sprint-Figuren mit Laufschritt | `vizSchritt` aus `u.v`, Sprinter-Sprite | `stepClimbing()` `:27980` |
| „stolpert", „bricht durch" | Hürden-Block, `hindernisWort:"Griff"` ersetzt nur das Wort | `:27374, :27439` |
| kein Sturz, kein Zurück | Stolperer ist ein Tempo-Faktor 0,35 für < 1 s; `u.pos` sinkt nie | `tempoVon()` `:26883` |
| „IM ZIEL — Platz 3", Punkte nach Rang | Zieleinlauf-Wertung wie Spurt/Time-Trial | `bahnRangliste()` |
| niemand berührt niemanden | `tackle:false`, `schatten:false`, keine Nachbar-Interaktion | `BAHN_ART.climbing` `:25268` |
| graue Wand mit Griffmarken (seit 17.09.) | additive Textur unter unveränderter Bahn | `bodenClimbing()` |

Der Motorkommentar selbst formuliert die Absicht, die nie eingelöst wurde: „Ein Fehlgriff wirft
nicht um, er kostet Zeit und Kraft — das ist der Unterschied zur Hürde" (`:25238-25239`). Das
ist mechanisch richtig — und genau deshalb sieht man keinen Unterschied.

### 0.4 Was das Konzept schon vorfindet (die gute Nachricht)

| Was die Wand braucht | Existiert bereits als | Fundstelle | Für Climbing heute |
|---|---|---|---|
| Griffe mit eigener Art, jede fordert einen anderen Sub-Skill | `hindernisTypen[]` + `fallenKoennen`/`fallenDurchbruch` (mischt das Können ZUR ART in den Wurf) | Takeshi `:25461`, Block `:27328-27333` | ungesetzt |
| Jeder Griff kostet Zeit, weniger bei Können | `huerdePreis`·(1−0,8·Skill/100) → `u.huerde` (Stopp) | `:27215` | ungesetzt (Griff gratis) |
| Rasten am Griff lädt auf | `pusteRegen` mit `ruhe=1` bei `u.huerde>0` | `:27144-27148` | aktiv, aber nie erreicht (kein Stopp) |
| Schwierigkeit je Art, Sterne | `fallenStufe`, `stufePreis` (gebaut, gemessen, bei Takeshi bewusst ungesetzt) | `:27204-27214` | — |
| Eine zweite Ressource, die bei Stürzen sinkt | `u.nerven`/`u.nervenMax = STEHEN·2,2`, `nervenKosten`, `nervenRegen` | `:26595, :27407-27411, :27035` | ungesetzt; Vorbild für `balance` |
| Gegner aktiv stören, nur im Fenster vor einem Hindernis, nur Nachbarspur | `tackle`, `tackleFenster`, `tackleSpur`, `tackleAusweichen` (TECHNIK gegen WUCHT), Widerstand (WUCHT gegen ROBUST), Persönlichkeit | `:27451-27564` | `tackle:false` |
| Zwei Wege durch ein Hindernis (Technik, sonst Wucht) | der Block selbst („HUERDEN — ZWEI WEGE HINDURCH", Chris' Lulu/Gram-Satz) | `:27166-27180` | aktiv |
| Nicht-Angekommene nach Höhe ordnen | `bahnRangliste()`: `fertig` nach Zeit, sonst `b.pos-a.pos` | `:23112-23120` | aktiv, nur nie ausgelöst |
| Eigene Wertungsart mit eigener Punktformel | `wertung:"burg"` + `burgpunkte()` (Sterne × (1−Stoppanteil) − Sturzabzug) | `:22823`, `bahnTeamstand()` | Vorbild für eine IFSC-Punktwertung (2.5) |
| Eigene Bildschirmgeometrie je Bahn-Art | `laeuferXY()` mit `istOval()`/`istRoute()`-Zweigen (Catmull-Rom-Route bei Takeshi) | `:26327-26340` | dritter Zweig fehlt |
| Eigene Boxscore-Spalten | `wertungTabelle:(basis,art)=>…` (Takeshi: Nerv, Ausw, Gedr) | `:25681-25695` | — |
| Ton | `TON_KATALOG.climbing` (griff/fehlgriff/zug/topout) | seit 17.09. | aktiv |

Was **nicht** vorhanden ist und gebaut werden muss: eine vertikale Bildschirmgeometrie mit
Kletterpose; ein Abrutschen, das `u.pos` zurücksetzt; eine dritte Ressource „Gleichgewicht"
mit Drain und Regen; ein Gegnerdruck-Kanal; ein Zeitlimit; ein Spiegeltest für die Bahn
(`miss-arena-buehne-spiegel.mjs`/`miss-arena-feldspiel-spiegel.mjs` existieren, ein Bahn-Pendant
nicht — `scripts/`, nachgesehen).

### 0.5 Parallel laufende Arbeit

`git worktree list` zeigt heute `climbing-fortschrittsbalken-22-09` (Commit `8b9fda00`,
„Fortschrittsbalken pro Läufer in der Kaderleiste (Climbing + alle Bahn-Disziplinen)", 25 Zeilen
`engine.js`, 14 Zeilen `battle-mode.css`). Das ist Präsentation für alle fünf Bahnen und liest
vermutlich `u.pos` — mit einer vertikalen Wand verträglich (der Balken wird zum Höhenmeter),
aber PR 1 dieses Konzepts muss darauf rebasen. Daneben laufen zwei I-Spy-Worktrees
(`i-spy-kalibrierrunde-rho-pp-22-09`, `i-spy-nachfuellfolge-art-eigen-22-09`), die
`engine.js` an anderer Stelle anfassen. Keine In-Game-Meldung auf `bug-reports` betrifft
Climbing (letzte Meldung 25.08.).

---

## 1. Kernbild: was Wettkampfklettern ist — und was Chris davon meint

### 1.1 Die drei IFSC-Formate

| Format | Wand | Versuche | Zeit | Wertung | Scheitern | Quelle |
|---|---|---|---|---|---|---|
| **Boulder** | 4–4,5 m, ohne Seil, Matten | mehrere je Boulder, 4 Boulder | 4 min (Finale) / 5 min je Boulder | seit 2025: **Top 25, Zone 10** (teils Low Zone 5), **−0,1 je Fehlversuch**; 100-Punkte-Skala | Sturz auf die Matte = neuer Versuch | olympics.com, judgemate.com, worldclimbing.com (Links unten) |
| **Lead** | 15 m+, Seil, Expressschlingen | **einer** | **6 min** | letzter kontrollierter Griff = Höhe; „+" für eine Bewegung darüber hinaus, **kein „+" bei Sturz**; Onsight (Route vorher unbekannt) | Sturz = Versuch zu Ende, Höhe zählt | Wikipedia „Competition climbing", gearjunkie, IFSC Rules 2025 |
| **Speed** | **15 m, 5° Überhang**, standardisierte Route (2007, Godoffe): **20 Handgriffe, 11 Tritte**, zwei 3-m-Bahnen nebeneinander | einer je Lauf, K.-o.-Duelle | Rekorde **4,54 s** (M) / **5,99 s** (F) | Zeit | Sturz oder Fehlstart (< 0,100 s) = Lauf verloren | Wikipedia „Speed climbing wall"/„Speed climbing", IFSC Speed Licence Rules — Zahlen bereits in `bahn-disziplinen-recherche-fable.md:117-119` |

Das heutige Climbing ist, wenn überhaupt, **Speed**: zwölf standardisierte Bahnen, alle
zugleich, die Uhr entscheidet. Speed ist die eine Disziplin, in der Klettern tatsächlich ein
Rennen ist — und die eine, die Chris **nicht** meint. „Echtes indoor klettern", „abrutschen",
„aus dem Gleichgewicht bringen" beschreiben Boulder/Lead: Höhe statt Zeit, Sturz als Ereignis,
Rasten, Körperspannung.

### 1.2 Was Chris' Satz verlangt — und was das Chassis erlaubt

Ein reines Lead-Format (ein Versuch, Sturz beendet alles) ist für die Rangtreue der falsche
Weg: die Hockey-Lehre aus `CLAUDE.md` sagt, dass jede Mechanik, die einem Schwachen die
Ereignisse nimmt, die Verlässlichkeit senkt; ein Sturz bei 30 % Höhe nach zwei Griffen hieße
zwei wertende Ereignisse für diesen Kletterer statt zehn. Ein reines Boulder-Format (vier
kurze Probleme, viele Versuche) wäre eine Bühne, kein Bahn-Chassis — ein Neubau wie I-Spy,
ohne dass die heutigen 0,834 irgendwo überleben.

Der Vorschlag ist deshalb ein **Hybrid, das dem Chassis folgt: „Lead-Rennen mit Sturzzonen"**.
Zwölf Kletterer an einer Wand mit zwölf Routen, alle gleichzeitig (wie heute), zehn Griffe und
drei **Zonen** (Sicherungspunkte, wie die Expressschlingen im Lead). Wer abrutscht, fällt bis
zur letzten Zone zurück und klettert den Abschnitt neu (Chris: „Neustart eines Abschnitts").
Es gibt ein Zeitlimit; wer bis dahin nicht oben ist, wird nach Höhe gewertet (Lead) — das tut
`bahnRangliste()` heute schon. Wer oben ankommt, wird nach Zeit gewertet (Speed). Beide
Ordnungen existieren im Code; nur das Zeitlimit fehlt.

### 1.3 Was es vom Hindernislauf unterscheidbar macht

| Achse | Hindernislauf (heute) | Wand (Konzept) |
|---|---|---|
| Bewegung | horizontal, links → rechts | **vertikal**, unten → oben; Kamera folgt der Spitze nach oben |
| Fortschritt | Strecke | **Höhe** — im HUD als Höhenmeter, in der Kaderleiste als Balken (Worktree heute) |
| Hindernis | Hürde, wird übersprungen oder gerissen | **Griff mit Art** (Leiste, Sloper, Zange, Dyno, Tritt) und **Zone** (Henkel/Ruhegriff) |
| Scheitern | Stolperer, < 1 s, weiter | **Abrutschen**: Fall bis zur letzten Zone, Abschnitt neu — oder Hängenbleiben (Variante A-1) |
| Erholung | Puste-Regen unter Plantempo | **Rasten an der Zone** („ausschütteln"), Gleichgewicht und Puste laden |
| Gegner | keiner | **Gegnerdruck** (G-2) und/oder **Störgriff** an geteilten Griffen (G-1) |
| Ende | Zieleinlauf, Platz nach Zeit | **Top-out** nach Zeit; darunter **Höhe** nach Zeitlimit |
| Kollision | Rempler räumt von der Bahn | fremde Hand senkt Gleichgewicht, stürzt nie (3.) |

### 1.4 Was Leistung im Klettern vorhersagt — und wie das auf die Matrix passt

Die Recherche in `bahn-disziplinen-recherche-fable.md:120-122` hat die Prädiktoren schon
zusammengetragen: Lead erklärt sich zu 97 % aus Griffkraft, Bent-arm-Hang, Fingerhang,
Körperfett, Umfang, Erfahrung (Baláš 2012); Boulderer haben 29–53 % mehr Kraft/RFD und 26 %
schnellere Züge, aber **dieselbe Unterarm-Ausdauer** wie Lead-Kletterer (PLOS One 2019); Speed
hängt an Unter- und Oberkörperkraft (β 0,4–0,5). Auf die gesperrte Matrix übersetzt:

| Matrixattribut | Gewicht | Was es an der Wand IST | Kanal im Konzept |
|---|---:|---|---|
| stamina | 26 | Unterarm-Ausdauer, „Pumpe" | Reserve-Haushalt (STEHEN, ENDTEMPO) — bleibt der Hauptkanal |
| determination | 16 | durch die Pumpe durchziehen, Commitment vor dem Zug | GLEICHGEWICHT (neu), STEHEN, WUCHT, ENDTEMPO |
| speed | 12 | Zugtempo, Dyno | ANTRITT (Dyno-Griffe), ENDTEMPO |
| dexterity | 12 | Fußarbeit, präzises Greifen | TECHNIK (Leisten), WENDIGKEIT (Tritte) |
| health | 10 | Robustheit, verträgt Stürze, Körperspannung | ROBUST (Widerstand gegen Störung, Sturzkosten) — **heute tot** |
| power | 8 | Blockieren, Zange | WUCHT (Kraftzug, Zangen-Griffe) |
| awareness | 8 | Route lesen, Zone erkennen | TECHNIK, WENDIGKEIT, GLEICHGEWICHT (den Störgriff kommen sehen) |
| will | 8 | Sturzangst, Kopf unter Druck | GLEICHGEWICHT, STEHEN |

Kein Attribut außerhalb der Matrix (intelligence/charisma/spirit/torment) kommt in irgendeinem
Sub-Skill vor — das Rezept von heute hält das bereits ein (0.1), und das Konzept ändert daran
nichts (Regel 3 in 6.5).

---

## 2. Grundmechanik: die Wand

### 2.1 Der Aufbau

Zwölf **Routen** nebeneinander (die zwölf Bahnen, `BAHNEN_N()`), Heim links, Gast rechts,
Nachbarroute = Nachbarbahn. Zehn Griffe an den heutigen Positionen (`hindernisse`, unverändert,
damit `HUERDEN_N()`, `bodenClimbing()`, `vizGriffN` weiterlaufen), davon drei **Zonen**:

```
hindernisse:  [0.08, 0.17, 0.26, 0.35, 0.44, 0.53, 0.62, 0.71, 0.80, 0.89]    // wie heute
hindernisTypen:["TECHNIK","WENDIGKEIT","STEHEN","WUCHT","ANTRITT",
                "STEHEN","TECHNIK","WENDIGKEIT","STEHEN","WUCHT"]              // Vorschlag
zonen:        [0.26, 0.53, 0.80]                                               // die drei STEHEN-Griffe
```

| Griffart | Sub-Skill | Bild (Griff-Form, Farbe) | Ticker-Wort | Anzahl |
|---|---|---|---|---|
| Leiste (Crimp) | TECHNIK | schmale Kante, gelb | „hält die Leiste" | 2 |
| Tritt/Volumen | WENDIGKEIT | Fußtritt + Volumen, blau | „setzt den Fuß um" | 2 |
| **Henkel / Zone** | STEHEN | großer runder Griff mit Karabiner, grün | „rastet am Henkel" | 3 |
| Zange (Pinch) | WUCHT | Block zum Zusammendrücken, rot | „zieht die Zange durch" | 2 |
| Dyno | ANTRITT | weit auseinander liegendes Griffpaar, orange | „springt an" | 1 |

**Warum diese Verteilung (Budget-Methode, wie I-Spy 1.5):** die Matrixmasse jedes Sub-Skills
aus dem heutigen Rezept, gewichtet mit den Matrixgewichten: TECHNIK 9,8 · WENDIGKEIT 11,1 ·
STEHEN 13,8 · WUCHT 10,8 · ANTRITT 10,5 (Summe 56,0) → Anspruch 17 / 20 / 25 / 19 / 19 %. Über
zehn Griffe: 2 / 2 / 2,5 / 2 / 2 — STEHEN aufgerundet auf 3, weil die Zonen zusätzlich das
Rasten tragen, ANTRITT abgerundet auf 1, weil es ohnehin die ersten 3,2 s des Rennens allein
bestimmt (`tempoVon()` `:26872-26873`). Das ist eine Näherung, keine Messung; die Pp-Abnahme
in PR 2 entscheidet, ob sie hält (6.4). ROBUST und ENDTEMPO bekommen bewusst **keine** Griffe:
ENDTEMPO trägt bereits 26 % über das Tempo, ROBUST bekommt seinen Kanal in 3.2 und 2.3.

Das Muster ist Takeshis `hindernisTypen` mit `fallenKoennen:0.75` — gemessen dort „der Kanal
wird breiter, nicht lauter", rho 0,861 → 0,883 (`:27317-27323`). Eine Wand mit zwei Stars an
verschiedenen Griffarten (der Sloper-Spezialist, der Dyno-Springer) ist genau die Spreizung,
die Chris am 13.09. für Takeshi verlangt hat („man soll nen unterschied sehen ob jemand eine
meistert").

**Drei Routen-Layouts statt einem** (Takeshis `kurse[]`-Muster, `:24344-24349`): dieselbe
Multimenge an Griffarten in anderer Reihenfolge, per Saat gewählt — „Überhang", „Platte",
„Kante". Kostet drei Listen, kein Mehr an Mechanik, und Chris sieht nicht zwölfmal dieselbe
Wand. Zonen bleiben in allen drei bei 0,26/0,53/0,80.

### 2.2 Der Zug an einem Griff — mehrere Wege, in fester Reihenfolge

Der heutige Block bleibt die Vorlage; er bekommt Art, Zeitpreis und einen dritten Weg:

```
an Griff h (Art T, Skill K = fallenKoennen·u[T] + (1−fallenKoennen)·TECHNIK):
  Stopp  u.huerde = huerdePreis·(1 − 0,8·K/100)                    // jeder Griff kostet Zeit (P6)
  Wurf 1 rr() ≤ technikBasis + K·technikSpanne − balanceAbzug        // PRIMÄRWEG: sauber
  Wurf 2 rr() ≤ wuchtBasis + WUCHT·wuchtSpanne − balanceAbzug        // NEBENWEG 1: Kraftzug
           → Reserve −wuchtKraft, Stolperer wuchtZeit, balance −0,10
  Wurf 3 rr() ≤ umsetzBasis + WENDIGKEIT·umsetzSpanne − balanceAbzug // NEBENWEG 2: Umsetzen (NEU)
           → Stolperer umsetzZeit (länger als Kraftzug), KEINE Reserve, balance −0,05
  sonst  ABRUTSCHEN (2.3)
```

Vorschlagswerte: `huerdePreis 0,30` (ein Griff kostet 0,06–0,30 s), `umsetzBasis 0,10`,
`umsetzSpanne 0,0080`, `umsetzZeit 0,45`. `balanceAbzug = 0,30·(1 − u.balance)` sitzt an
derselben Stelle wie Takeshis `pusteAbzug` (`:27293-27299, :27358`): „verschiebt nur die
Schwelle, nie die Zahl oder Reihenfolge der `rr()`-Würfe". Das ist die Regel, die den Bahn-Code
für die vier Geschwister bit-identisch hält: ein zusätzlicher Wurf fällt nur an, wenn das Feld
(`umsetzBasis`) gesetzt ist, sonst ist die Kette Zeichen für Zeichen die heutige.

Bei K 50 / WUCHT 50 / WENDIGKEIT 50 und voller Balance: 56 % sauber, 26 % Kraftzug, 9 %
Umsetzen, **9 % Abrutschen** je Griff — 0,9 Abrutscher je Kletterer und Rennen (heute 1,8
Stolperer, die nichts kosten). Bei K 80: 74 / 18 / 5 / 3 %. Bei K 30 mit Balance 0,5: 30 / 29 /
16 / 25 %. Die Zahlen sind gesetzt, nicht gemessen; die Nulllinie aus PR 0 sagt, wie viele
Abrutscher das Rennen verträgt (6.6).

### 2.3 Abrutschen — zwei Fassungen, beide als Schalter

| | A-1 „Hängenbleiben" | **A-2 „Zurück zur Zone"** |
|---|---|---|
| Was passiert | wie der heutige Stolperer, nur länger (1,2–2,0 s bei 35 % Tempo, „rutscht ab — fängt sich am Griff") | `u.pos ← letzte Zone unter ihm` (oder 0 unterhalb der ersten), Fallzeit 0,8 s, dann Abschnitt neu: die Griffe dazwischen werden erneut gewürfelt |
| Kosten | Reserve −stolperKraft, balance auf 0,5 | Reserve −stolperKraft·ROBUST-Faktor, balance auf 0,6 (an der Zone rastet er kurz), `u.abgerutscht++` |
| Deckel | — | höchstens ein Abschnitt (max. drei Griffe); oberhalb 0,80 nur bis 0,80 — kein Fall vom Top zum Boden |
| Bild | Figur rutscht, Beine baumeln, fängt sich | Figur fällt am Seil bis zur Zone, hängt, schüttelt aus, klettert wieder |
| Chris' Wortlaut | „abrutschen" — ja; „Neustart eines Abschnitts" — nein | beides |
| Verlässlichkeit | ≈ heute | sinkt: ein Abrutscher bei 0,78 kostet den ganzen Abschnitt seit 0,53 |
| Validität | ≈ heute | steigt, wenn die Abrutschchance eignungsgesteuert ist (sie ist es: K, WUCHT, WENDIGKEIT, balance) |

Empfehlung **A-2 mit Deckel**, gemessen gegen A-1 in derselben Runde. A-2 ist das, was Chris
meint, und es ist die einzige Fassung, in der ein Sturz ein Ereignis mit Folgen ist statt
verlorener Zeit. Die Gefahr ist die Verlässlichkeit; deshalb der Deckel „ein Abschnitt" und
deshalb ROBUST an den Kosten: `stolperKraft·max(0,45; 1−ROBUST·0,0045)` — dieselbe Form wie
Takeshis Nervenkosten (`:27410`). Damit bekommt ROBUST (health 32, stamina 28, will 24) einen
ersten lebendigen Kanal, und health (Matrix 10, gemessen 4,8 % vor der Kalibrierung) einen Ort.

Was am Code hängt: `u.pos` sinkt heute nie. Die Griff-Kante `vor<h&&u.pos>=h` (`:27182`) löst
beim Wiederaufstieg von selbst neu aus — das ist gewollt. `vizGriffN` in `stepClimbing()`
(`:27984-27985`) zählt `erreicht>vizGriffN` und würde beim zweiten Erreichen nicht erneut
klingen — für PR 1/4 nachzuziehen. Windschatten/Bahnwechsel (`:27043-27072`) sind bei
`schatten:false`, `sucht:0` und je einer Bahn je Läufer inaktiv; das bleibt so (an einer Wand
wechselt niemand die Route).

### 2.4 Gleichgewicht — die dritte Ressource

Neben `u.reserve` (Puste, `:26594`) und `u.nerven` (Takeshi, `:26595`) bekommt der Kletterer
`u.balance` in 0..1, Start 1,0. Nach dem Vorbild der Nerven: ein Feld je Läufer, gelesen in den
Griff-Würfen (2.2) als `balanceAbzug`, geschrieben an fünf Stellen — alle ohne `rr()`:

| Ereignis | Wirkung auf `balance` (Vorschlag) | Attributkanal |
|---|---|---|
| Kraftzug / Umsetzen | −0,10 / −0,05 | — |
| Abrutschen | auf 0,6 (A-2) bzw. 0,5 (A-1) | — |
| Steigung, laufend | −0,012·steigung·pos je s in Bewegung (am Top 0,009/s) | — |
| Puste leer (`u.leer`) | −0,03 je s | STEHEN (indirekt) |
| Gegnerdruck (3.3) | −0,02·druck je s | **GLEICHGEWICHT** dämpft |
| Störgriff getroffen (3.2) | −0,25·stark | ROBUST dämpft (im Duell) |
| Rasten an der Zone (Stopp `u.huerde>0` an einem STEHEN-Griff) | +0,30·(0,5 + GLEICHGEWICHT/200) je Rast | GLEICHGEWICHT |
| Unter Plantempo (`ueber<1`) | +0,04·(1−ueber) je s | WENDIGKEIT·0,002 zusätzlich |

**GLEICHGEWICHT ist ein achter Sub-Skill**, Vorschlag `{determination:40, will:30, awareness:30}`,
`lang:"Kopf"`. Das Bahn-Rezept ist nicht auf sieben Schlüssel festgelegt — `spurtWerte()`
(`:25739-25743`) iteriert `for(const k in R)`, jeder Schlüssel wird zum Läuferfeld. Damit haben
determination (Matrix 16, heute nur in ENDTEMPO/STEHEN/WUCHT/ROBUST verteilt) und will (8) den
Ort, den der Sport ihnen gibt: der Kopf unter Druck. Wer die Sub-Skill-Zahl nicht erhöhen will,
legt dieselbe Mischung in STEHEN — dann trägt STEHEN aber Reserve **und** Balance und wird zum
Einzelhebel, vor dem die Kalibrierung 16.09. warnt („ein einzelner, sehr dominanter Sub-Skill
kannibalisiert die sichtbaren Anteile der anderen").

### 2.5 Zeit, Zeitlimit, Wertung

- **Zeitlimit** (neu, `zeitlimit` in `BAHN_ART`): Vorschlag **1,6 × Median-Siegerzeit** der
  Nulllinie aus PR 0 (das Lead-„6 Minuten" auf unsere Uhr gebracht). Bei Ablauf `done`, alle
  Nicht-Angekommenen bleiben `fertig==null` und werden nach `pos` geordnet — `bahnRangliste()`
  `:23112-23120`, keine Codeänderung. Für Spurt/Staffel/Time-Trial/Takeshi bleibt das Feld
  ungesetzt, also bit-identisch.
- **W-a (Empfehlung für PR 2): Rang wie heute.** Angekommene nach Zeit, darunter nach Höhe,
  N−i Punkte. Null neue Wertungslogik, `wert()` und `disziplinProbe()` unverändert; der
  Endstand-Suffix wird „Punkte nach Höhe und Zeit".
- **W-b (Option, PR 4): IFSC-Punkte.** `wertung:"hoehe"` nach dem `burg`-Muster: Top 25 + je
  Zone 10 (also 55 für ein Top-out), **−0,1 je Abrutscher**, Zeitbonus für Angekommene
  (Reihenfolge). Erzählt die Disziplin besser und macht die Abrutscher in der Zahl sichtbar; sie
  braucht eine eigene `wert()`-Formel, eine eigene PPS-Referenz-Ziehung und eine eigene
  Rangtreue-Messung (bei Takeshi hat die Burgwertung rho gegenüber Rang **nicht** gesenkt —
  0,879 kaderfest — aber das ist dort gemessen, hier nicht). Nicht vor W-a stehen.
- **Pläne** bleiben (sparsam/stetig/angriff, `:25297-25306`); die Wand-Wörter dazu:
  „Klettert unter der Schwelle und rastet an jeder Zone" / „Gleichmäßig, rastet an der mittleren"
  / „Zieht ohne Rast durch — wenn die Pumpe reicht". Der Plan könnte zusätzlich entscheiden, ob
  an einer Zone gerastet wird (Stopp) oder nicht (Zone als normaler Griff, kein Regen) — ein
  Boolean je Plan, `rastet:[true,true,true]`/`[false,true,false]`/`[false,false,false]`. Das ist
  die Rennplan-Ansage der Bahn (`:26910 ff.`) an der Wand: „jetzt rasten" statt „jetzt gehen".

---

## 3. Gleichgewicht und Gegner — das Herzstück

### 3.1 Drei Lesarten von „andere aus dem Gleichgewicht bringen"

| | **G-1 Störgriff** (direkt) | **G-2 Gegnerdruck** (indirekt) | G-3 beides |
|---|---|---|---|
| Bild | an Griffen, die zwei Nachbarrouten teilen („Kreuzungen"), greift einer dem anderen in den Griff, stößt an, tritt ihm den Tritt weg | wer auf der Nachbarroute überholt wird oder den Gegner über sich sieht, wird nervös: der Kopf geht, der Griff zittert | Druck immer, Störgriff nur bei Kontakt |
| Chris' Wortlaut | „versuchen kann, andere aus dem Gleichgewicht zu bringen" — **versuchen** ist ein Tun, das spricht für G-1 | „aus dem Gleichgewicht" ohne Kontakt | deckt beides |
| Sportlich | in der IFSC verboten, in einer Olympiade mit Orks und Drachen ein legitimes Spielelement — Chris' Entscheidung | echt: Sturzangst und Konkurrenzdruck sind im Lead der halbe Wettkampf | — |
| Was existiert | Takeshis Rempler-Block komplett: `tackle`, `tackleAb`, `tackleRate`, `tackleFenster` (nur vor einem Hindernis), `tackleSpur` (nur Nachbarspur), `tackleAusweichen` (TECHNIK gegen WUCHT), Widerstand WUCHT gegen ROBUST, Persönlichkeit (`willTackeln`), Abklingzeit, Boxscore-Spalten Rempl/Ausw (`:27451-27564`) | `nerv`-Faktor in `tempoVon()` (`:26898`), Nerven-Regen (`:27035`) als Muster; die Druck-Formel selbst ist neu, ~15 Zeilen, ohne `rr()` | — |
| `rr()`-Vertrag | eigene Würfe nur hinter `tackle:true` — die anderen Bahnen bleiben bit-identisch (Kommentar `:27473-27477`) | keine Würfe | — |
| Gemessene Verwandte | Takeshi Chaos-Rezept: 0,860/0,872 gegen Basis 0,866/0,826, Star auf Rang 1 84 % gegen 73 % — **weil WUCHT/ROBUST dort mit der Eignung zu 0,85/0,88 korrelieren** (`:25441-25445`); `tackleNerven` (Ausscheiden durch fremde Hand) Saison 0,937 → 0,902, verworfen | Takeshi `nerv` und Nerven-Regen: Charisma 3,9 % → Kanal; keine direkte Messung für einen Druck-Kanal | — |
| rho-Erwartung | ±0,02, abhängig davon, ob WUCHT/ROBUST hier mit der Eignung laufen (WUCHT = power 42/det 28/health 30 gegen Matrix 8/16/10: mittel) | leicht positiv, wenn GLEICHGEWICHT mit der Eignung läuft (det 40/will 30/aw 30: gut); Risiko: Paarungsrauschen (der Druck hängt am Gegner) | wie G-1 |
| Pp-Erwartung | schiebt power/health über WUCHT nach oben — power hat Matrixgewicht 8; Deckel nötig (`tackleRate` klein) | schiebt determination/will nach oben — beide unterrepräsentiert (will 2,3 % vor der Kalibrierung) | — |
| Regel „kein Zug durch fremde Hand" | verletzt, wenn der Störgriff stürzen lässt; **eingehalten, wenn er nur Balance nimmt** | eingehalten | — |

### 3.2 G-1 im Detail: der Störgriff

Konfiguration nach Takeshi-Muster, Vorschlag:

```
tackle:true, tackleAb:35, tackleRate:1.2, tackleKosten:0.20, tackleFenster:0.05, tackleSpur:1.0,
tackleAusweichen:{duell:0.35},
stoerWort:{tun:"greift %o in den Griff", weg:"sieht %u kommen und blockt den Griff",
           halt:"hält die Zange", hit:"bringt %o aus dem Gleichgewicht"}
```

- **Nur an Kreuzungen:** `tackleFenster 0,05` = nur in den letzten 5 % vor einem Griff; die
  Wand zeichnet an diesen Stellen den Griff sichtbar **zwischen** zwei Routen (Bild: ein Griff,
  zwei Hände). `tackleSpur 1,0` = nur die unmittelbare Nachbarroute. Bei Heim links / Gast rechts
  gibt es genau **eine** Kreuzungs-Nachbarschaft zwischen den Seiten (Bahn 5/6) — zu wenig.
  Deshalb `bahnenFest`-Muster umkehren: Routen **abwechselnd** Heim/Gast besetzen (H G H G …),
  damit jeder Kletterer einen Gegner links und rechts hat. Das ist eine Zeile in der Bahnvergabe
  (`bauSpurt`, `:26427 ff.`) hinter einem Feld `wechselseitig:true` — und für den Spiegeltest
  (6.6) ist es sogar besser als Blockvergabe.
- **Der Störer zahlt:** Abklingzeit, `tackleKosten` (Tempo-Malus über `u.kraft`, `:27115`),
  **und Balance −0,10** — wer mit einer Hand am Gegner ist, hat nur eine an der Wand. Wer
  ständig stört, rutscht selbst ab. Das ist der Unterschied zur Bahn, wo der Rempler „halb so
  teuer, dafür härter" ist (`:27495-27499`).
- **Das Opfer wehrt sich zweimal:** erst `tackleAusweichen` (TECHNIK gegen WUCHT: er sieht die
  Hand kommen, awareness sitzt in TECHNIK mit 33), dann das Duell **WUCHT gegen ROBUST**
  (`stark = WUCHT/(WUCHT+ROBUST)`, `:27545`): er hält die Zange. Beides existiert wörtlich; damit
  bekommt ROBUST seinen zweiten Kanal, und `health` liest nicht mehr über Umwege.
- **Die Wirkung ist Balance, nie Sturz:** statt `o.stolper=0.55+stark*0.9; o.reserve-=18`
  (`:27547`) bekommt das Opfer `o.balance −= 0,25·stark` und einen kurzen Stolperer (0,3 s,
  „wackelt"). Ob es beim nächsten Griff abrutscht, entscheidet **sein eigener Wurf** mit dem
  erhöhten `balanceAbzug`. Chris' Satz wörtlich genommen: man bringt jemanden aus dem
  Gleichgewicht — man wirft ihn nicht von der Wand. Und die Projektregel bleibt in ihrer weichen
  Form: fremde Hand verschiebt eine Wahrscheinlichkeit, sie vernichtet keinen Zug.
- **Persönlichkeit** entscheidet wie auf der Bahn, ob er es tut (`willTackeln`, `:27453`): der
  Draufgänger stört, das Bollwerk klettert. Das ist dieselbe Kaderfarbe wie bei Takeshi und
  kostet nichts.
- **Deckel:** `tackleRate 1,2` (Takeshi 2,0) und `tackleAb 35`: Zielkorridor 3–6 Störgriffe je
  Rennen, davon ~40 % Treffer (6.6). Mehr macht die Wand zum Gerangel.

### 3.3 G-2 im Detail: der Gegnerdruck

```
je Tick, je Kletterer u (fertig==null, nicht an einer Zone):
  gegner = bester Gegner auf Nachbarroute links/rechts (oder im Feld, Schalter `druckQuelle`)
  vorsprung = max(0, gegner.pos − u.pos)
  druck = min(1, vorsprung / 0,10)                                   // 10 % Höhe = voller Druck
  u.balance −= 0,02 · druck · (1 − 0,8·GLEICHGEWICHT/100) · dt
```

Kein `rr()`, kein Schreiben in ein fremdes `u.*`. Bei GLEICHGEWICHT 30 verliert ein voll unter
Druck stehender Kletterer 0,015/s (in 20 s 0,30 Balance = +9 Pp Abrutschchance je Griff), bei 80
noch 0,007/s. Das ist Chris' „aus dem Gleichgewicht" ohne Kontakt: der Kopf.

**Warum das eignungsfreundlich sein sollte — und wo es kippen kann.** Der Kanal belohnt
GLEICHGEWICHT, dessen drei Attribute zusammen 32 Matrixpunkte tragen; er bestraft den, der
hinten liegt, also im Mittel den Schwächeren — das verstärkt die vorhandene Ordnung, wie
Takeshis Chaos-Kanäle. Kippen kann es über die **Paarung**: ein 70er neben einem 90er steht
unter Druck, ein 70er neben einem 40er nicht — dieselbe Eignung, verschiedenes Ergebnis. Das
ist Kaderrauschen, und die Spannweite (heute 0,209) ist die Größe, die es anzeigt. Zwei Dämpfer,
beide zu messen: `druckQuelle:"feld"` (Vorsprung des Spitzenreiters statt des Nachbarn — gleich
für alle, weniger Paarungsrauschen, weniger Erzählung) und ein Deckel `druckMax 0,6`.

**Kein Flow-Bonus für den Führenden.** Ein Spiegelkanal („wer vorn liegt, klettert ruhiger")
wäre derselbe Effekt ein zweites Mal — „reich wird reicher" quadratisch. Der Führende hat
seinen Vorteil bereits: keinen Druck.

### 3.4 Empfehlung und die Entscheidung, die Chris treffen muss

**G-2 immer, G-1 als Schalter, beide in derselben Kalibrierrunde gemessen.** Reihenfolge nach
dem Takeshi-Muster: Basis (Griffarten, Zonen, Abrutschen, Balance ohne Gegner) → +G-2 → +G-1,
jede Stufe kaderfest mit Median/Spannweite und Star-/Paartreue. Was gemessen schadet, bleibt im
Motor und wird in `BAHN_ART.climbing` mit Zahl **nicht gesetzt** („BEWUSST NICHT GESETZT, weil
gemessen schädlich", `:25447-25457`).

Die Frage an Chris ist nicht „G-1 oder G-2", sondern **zwei Fragen**:

1. Darf an der Wand **angefasst** werden (G-1)? Wenn ja, ist Climbing die zweite Bahn mit
   Kontakt (nach Takeshi; Spurt hat den Rempler, Staffel und Time-Trial nicht) — und die
   Kaderfarbe „Draufgänger stört, Bollwerk klettert" wird sichtbar.
2. Wenn ja: **Balance nehmen oder stürzen lassen?** Das Konzept empfiehlt Balance (3.2, letzter
   Punkt). Ein Störgriff, der direkt zur Zone wirft, ist Takeshis `tackleNerven` in Wandform —
   dort gemessen −0,035 Saison-rho — und er würde die Verlässlichkeit noch einmal senken, die
   A-2 ohnehin schon kostet.

### 3.5 Die Regeln aus der Projektgeschichte, die das Konzept einhält

1. **Kein Kanal, in dem fremde Hand einen Zug vernichtet.** Störgriff nimmt Balance, der Sturz
   fällt aus dem eigenen Wurf. Kein Ausscheiden (`raus`) — anders als bei Takeshi bleibt jeder
   bis zum Zeitlimit an der Wand und sammelt Höhe.
2. **Kein Attribut in einer Erfolgschance über sein Matrixgewicht hinaus** — Pp ≤ 25 in zwei
   Saatstämmen ist die Abnahme, nicht die Absicht (6.4).
3. **Kein Attribut, das die Matrix nicht kennt.** intelligence, charisma, spirit, torment
   kommen in keinem Sub-Skill vor — heute nicht, im Konzept nicht.
4. **Kein Kanal ohne Ereignisse.** ROBUST ist heute 0,0 % (Kalibrierung 16.09.); jeder neue
   Kanal wird in PR 2 mit `sondiere-feldspiel-subskills.mjs` auf mechanisches Gewicht geprüft,
   bevor ein Attribut hineinzieht.

---

## 4. Mehrere Wege zum Erfolg (Design-Leitlinie aus `CLAUDE.md`)

Der Griff-Block ist seit Chris' Lulu/Gram-Satz (`:27169-27170`) ein Zweiwege-Hindernis: Technik,
sonst Wucht. Das Konzept macht daraus das Primär-/Nebenweg-Muster aus I-Spy 1.6, je Griffart:

| Griffart | Primärweg (voll, kostenlos) | Nebenweg 1: Kraftzug (WUCHT) | Nebenweg 2: Umsetzen (WENDIGKEIT) |
|---|---|---|---|
| Leiste | TECHNIK (dex 44, aw 33, pow 23) | Reserve −18, 0,18 s, Balance −0,10 | 0,45 s, Balance −0,05 |
| Tritt/Volumen | WENDIGKEIT | wie oben | Primärweg selbst — Nebenweg 2 entfällt, dafür Nebenweg 1 |
| Henkel/Zone | STEHEN | wie oben | wie oben |
| Zange | WUCHT | Primärweg selbst — Nebenweg 1 entfällt | wie oben |
| Dyno | ANTRITT (pow 38, dex 32, speed 30) | wie oben | wie oben (er klettert statisch drum herum, langsam) |

Asymmetrisch, wie Chris es für I-Spy nachgetragen hat: der Nebenweg **kann** denselben Griff,
aber schlechter — Kraftzug kostet Puste (die an der Wand knapp ist), Umsetzen kostet Zeit.
Kein Kletterer ist von einem Griff ausgeschlossen, weil ihm ein Attribut fehlt; ein
Kraftpaket zieht sich über die Leisten, ein Techniker setzt an der Zange um. Die Reihenfolge
ist deterministisch (Primär → Kraftzug → Umsetzen), es gibt keinen `max()`, und der `rr()`-
Verbrauch je Griff ist damit „bis zu drei Würfe in fester Reihenfolge" — das ist der bestehende
Bahn-Vertrag, nicht der Bühnen-Vertrag „fester Verbrauch" (Handbuch Falle 17), und er gilt
für alle fünf Bahnen gleich.

Für die Rangtreue ist das Muster eher hilfreich als riskant: jeder Weg ist monoton in seinem
Sub-Skill, und alle acht Sub-Skills bestehen ausschließlich aus Matrixattributen. Was die Pp-
Messung zeigen muss: dass WUCHT als Universal-Nebenweg power (Matrix 8) nicht über sein Gewicht
hebt — der Preis (Reserve −18 bei `kraftBasis 310`) ist die Bremse, und `wuchtKraft` die erste
Schraube, falls power in `messe-arena-einfluss.mjs` über 12 % liest.

---

## 5. Visuelle Umsetzung

Alles Präsentatorische folgt dem `viz*`-Vertrag der Bahn (`stepStaffel`/`stepZeitfahren`/
`stepClimbing`, `:28027-28037`): eigene Felder, kein `rr()`, kein Schreiben in `u.pos`/`u.v`/
`u.reserve`/`u.fertig`, bit-identische Messung als Abnahme.

### 5.1 Die Wand (`bodenWand()`, ersetzt `bodenClimbing()`)

Vertikal: Boden unten (Matten, Bild Boulder) oder Seilhang (Lead) — Vorschlag **Lead**, weil die
Zonen als Expressschlingen/Karabiner ein natürliches Bild haben und das Abrutschen „am Seil
bis zur Zone" erzählt, nicht „auf die Matte". Zwölf Routen nebeneinander, farbige Griffe je Art
(2.1), die drei Zonen als größere Griffe mit Karabiner, an den Kreuzungen (3.2) ein Griff
zwischen zwei Routen. Überhang-Schattierung und Risslinien aus `bodenClimbing()` bleiben, nur
gedreht (nach oben dunkler). Kamera folgt der Spitze **nach oben** (Pendant zu `camX`, das der
Spitze nach rechts folgt); bei zwölf Routen passt die Breite ins Bild ohne Zoom.

Kein Asset-Download (Proxy); Griffe, Karabiner, Seil sind Primitive wie die I-Spy-Truhen und
Takeshis Burg.

### 5.2 Koordinaten: der dritte `laeuferXY()`-Zweig

`laeuferXY()` (`:26327`) kennt Oval (Staffel) und Route (Takeshi). Die Wand ist der dritte:
`istWand()` → `{x: routeX(u.bahnZ), y: camY(u.pos)}`. Nachgezählt auf `main`: 12 direkte
`camX(u.pos)`- und 11 `bahnY(u.bahnZ)`-Aufrufe in `schwebe()`-Zeilen des Bahn-Blocks, 15 Stellen
gehen bereits über `laeuferXY()` — Takeshi hat genau diesen Umbau für die Route an drei Stellen
gemacht („`laeuferXY()` statt `camX/bahnY` direkt, s. Begründung beim Gedränge-Effekt",
`:27259-27264`). PR 1 zieht die übrigen nach; für Spurt/Staffel/Time-Trial/Takeshi ändert sich
das Ergebnis der Funktion nicht (Screenshot-Gegenprobe wie in `climbing-wand-17-09.md`, mit dem
dort dokumentierten Timing-Rauschen bei Takeshi/Time-Trial).

### 5.3 Bewegung (`stepWand()`, ersetzt `stepClimbing()`)

Zustandsautomat je Kletterer (`u.vizPhase`), Muster `stepFechten()`/`stepZeitfahren()`:

| Phase | Auslöser (nur gelesen) | Bild |
|---|---|---|
| `klettern` | `u.v>0`, kein Stopp | Arme wechselnd hoch, Schritt aus `u.v` (wie `vizSchritt` heute), Vorlehnung aus `steigung·pos` (wie `vizNeigung` beim Zeitfahren) |
| `rasten` | `u.huerde>0` an einer Zone | hängt am Henkel, schüttelt einen Arm aus; Balance-Ring um die Figur füllt sich |
| `kraftzug` | `u.durchbruch` steigt | Blockier-Pose, Schweber „zieht durch" |
| `umsetzen` | `u.umgesetzt` steigt (neu) | Fuß wechselt, Figur versetzt sich seitlich auf der Route |
| `abrutschen` | `u.abgerutscht` steigt / `u.pos` fällt | Figur fällt am Seil bis zur Zone (Interpolation über die Fallzeit), Schweber „rutscht ab" (`crit`) |
| `stoeren` | `u.lungeVis>0` (existiert, `:27510`) | Arm zum Nachbarn, Schweber beim Opfer „wackelt" / „hält" / „blockt" |
| `topout` | `u.fertig!=null` | Jubel-Hüpfer auf der Kante, einmalig |

Balance sichtbar: ein kleiner Ring/Balken über jeder Figur (wie Takeshis Nerv-Spalte, nur im
Bild), rot unter 0,4. Das ist die Antwort auf „man sieht nicht, dass jemand wackelt".

### 5.4 HUD, Kaderleiste, Boxscore, Endstand

- Kaderleiste: der Fortschrittsbalken aus dem heutigen Worktree wird zum **Höhenmeter** (ein
  Wort, keine Logik).
- `wertungTabelle` (Takeshi-Muster `:25681-25695`): Spalten **Höhe** (% bzw. Zone 0–3),
  **Abrutscher**, **Kraftzüge**, **Balance** (%), bei G-1 **Stör/Ausw/Hält**. Die Spalte
  „Zeit" bleibt für Angekommene, „—" darunter (wie bei Takeshis Ausgeschiedenen, `:30557-30562`).
- Endstand: „gewinnt — 41 : 37 Punkte nach Höhe und Zeit"; Zeile „Top-out 6 : 4" als `zusatz`.
- Ticker (`feed()`), Vorschlag: „Vorrak rastet am ersten Henkel — Pumpe 38 %" · „Xelara rutscht
  an der Zange ab und fällt zur Zone 2 zurück" · „Draco greift Cassandra in die Leiste — sie
  hält" · „Ralazar sieht Gram über sich und wird unsicher" (bei `druck>0,8` einmal je Rennen) ·
  „Gram toppt aus — 23,4 s".

### 5.5 Ton (`TON_KATALOG.climbing`, erweitern)

Bestehend griff/fehlgriff/zug/topout; neu `abrutsch` (`tonRauschen`-Burst + `tonSchlag` tief),
`zone` (`tonKlick` doppelt, Karabiner), `stoer` (`tonMetall` kurz), `zeitlimit` (`tonDoppelton`
abwärts). Einmal-Marker wie `vizZzTonN`; `vizGriffN` muss beim Wiederaufstieg neu zählen (2.3).

### 5.6 React-Seite

Ob `app/foundation/discipline-stage/arena/disciplines/` eine eigene Climbing-Ansicht führt, ist
in dieser Runde nicht geprüft — bei I-Spy war `spybar.tsx` ein divergierendes Thema (I-Spy 5.5).
Vor PR 1 nachsehen; wenn eine Ansicht existiert, ist ihr Nachzug eine eigene, spätere Runde.

---

## 6. Machbarkeit gegen die Schranken — das rho-Risiko

### 6.1 Warum die Messung unverändert passt

`disziplinProbe()`/`miss-alle-disziplinen.mjs` brauchen `MOTOREN[bd].bau/lauf/wert/namen` und
je Läufer `u.eig` und den Wert. `MOTOREN[bd]` wird für jede `BAHN_ART`-Disziplin in derselben
Schleife registriert (`:31215`), `lauf` treibt `stepSpurt` bis `done` oder 90 s (`:31228`),
`wert()` liest die Rangpunkte. Nichts davon ändert das Konzept. Neue Felder in
`BAHN_ART.climbing` sind ungesetzt bit-identisch — das ist die Bahn-Konvention, an der jede
Takeshi-/Zeitfahren-Runde ihre Geschwister nachgemessen hat, und sie ist hier zugleich der
**Rückfallweg**: Felder aus, alte Mechanik zurück, ohne Revert.

### 6.2 Die Rechnung in den zwei Größen

`rho(Spiel) = rho(Saison) · √Verlässlichkeit`. Heute: 0,834 = 0,860 · √V → **V ≈ 0,94**. Das ist
die höchste Verlässlichkeit, die ein Chassis im Projekt liest (Hockey 0,755, I-Spy 0,72): ein
Rennen ohne Stürze ist fast deterministisch. Die Grenze liegt bei der **Validität 0,860** — die
Mechanik belohnt das Richtige zu wenig: ROBUST tot, awareness und dexterity −3 bis −5 Pp
(Kalibrierung 16.09.), und gelungene Griffe kosten nichts.

Was das Konzept an beiden Größen tut:

| Eingriff | Validität (Saison) | Verlässlichkeit | Beleg |
|---|---|---|---|
| Griffarten mit `fallenKoennen` | + (breiterer Eignungskanal) | ≈ | Takeshi 0,857 → 0,878 |
| Zeitpreis je Griff (`huerdePreis`) | + (Attribute, die den Griff entscheiden, zahlen) | ≈ | P6-Befund, Zeitfahren Intelligence 3,5 % → Kanal |
| ROBUST-Kanäle (Sturzkosten, Widerstand) | + (health/will lesen) | ≈ | Kalibrierung: STEHEN-Umbau allein +0,052 |
| GLEICHGEWICHT + Gegnerdruck G-2 | + (det/will), Risiko Paarung | − klein | Takeshi-Chaos: Kanäle, die mit `eig` laufen, heben |
| Abrutschen A-2 | + (eignungsgesteuert) | **−** (ein Abschnitt Zeitverlust) | keine Messung — der eigentliche Unsicherheitspunkt |
| Störgriff G-1 | ±, power-Risiko | − klein | Spurt-Rempler „im Rauschen", `tackleNerven` −0,035 |

Schätzung nach der ersten Kalibrierrunde: Saison 0,88–0,92, V 0,82–0,88, Produkt **0,80–0,86**.
Das ist eine Schätzung, kein Messwert, und ihr weichster Punkt ist A-2. Deshalb ist A-1 der
Schalter, der bereitliegt, und der „ein Abschnitt"-Deckel die erste Schraube.

**Ehrlichere Abnahme** (CLAUDE.md, `miss-star-paartreue.mjs`): Star auf Rang 1 ≥ 55 %, in den
ersten zwei ≥ 78 %, nie letzter, Paare ≥ 15 Punkte Abstand ≥ 95 % richtig — heutige Climbing-
Werte in PR 0 ziehen, sie sind die Latte.

### 6.3 Was ein Neubau an einer LIVE-Disziplin anders macht als bei I-Spy

| | I-Spy (21.09.) | Climbing (dieses Konzept) |
|---|---|---|
| Ausgangslage | 0,684, nicht angeschlossen, roter Test | **0,834, live, PPS-Referenz, CI-Schranke** |
| Latte | > 0,80 | > 0,80 hart; **≥ 0,834 angestrebt**; Star-/Paartreue nicht schlechter; Spannweite nicht größer als 0,25 |
| CI | keine | `ci:rangtreue-schranke` liest die Basislinie — jede PR mit Messwirkung muss `baue-rangtreue-basislinie.mjs 24` neu ziehen und die Änderung in der PR begründen (Muster Kalibrierung 16.09.) |
| PPS-Referenz | in PR 5 erstmals ziehen | **neu ziehen**, sobald sich die Ergebnisverteilung ändert (Abrutscher, Zeitlimit, Höhen-Wertung verschieben die Rangpunkte-Verteilung nicht, W-b schon); `pruefe-pps-referenz-frische.ts` |
| `ARENA_IMPACT_KONFIG_JE_DISZIPLIN` | neu | `CLIMBING_INDIVIDUAL_PPS_MAX`/`CLIMBING_PPS_ANTEIL_MITTE` (5,5/0,25) prüfen, bei W-b neu setzen |
| Rückfall | keiner nötig | Felder ungesetzt = alte Mechanik; Wand-Darstellung bleibt |
| Reihenfolge | Mechanik zuerst (nichts zu verlieren) | **Darstellung zuerst** (PR 1, rho-frei, beantwortet Chris' Satz sofort), dann Mechanik |
| Rezept | neu | das kalibrierte Rezept vom 16.09. ist nach einer Mechanikänderung **verschenkt** (Handbuch 2.2: „Reihenfolge schlägt Rezeptqualität") — neu sondieren, neu fitten |
| Server | — | laufende Saison: Spieltage nach dem Merge rechnen anders als davor. Chris' Entscheidung, ob das mitten in einer Saison passieren darf oder auf den Saisonwechsel wartet |

### 6.4 Die Kalibrierrunde, konkret

In der Reihenfolge des Handbuchs (`neue-disziplin-handbuch.md` 2.1: Struktur → `wert()` →
Sondierung → Rezept → Pp → Rangtreue), alles kaderfest:

```sh
node scripts/miss-alle-disziplinen.mjs 24 climbing
node scripts/miss-star-paartreue.mjs climbing 24
node scripts/messe-arena-einfluss.mjs climbing 48
node scripts/sondiere-feldspiel-subskills.mjs climbing 24
node scripts/sondiere-feldspiel-subskills.mjs climbing 24 --versatz
node scripts/miss-alle-disziplinen.mjs 24
node scripts/baue-rangtreue-basislinie.mjs 24
npx tsx scripts/ziehe-buehne-pps-referenz.ts climbing
npx tsx scripts/pruefe-slot-invariante.ts
npm run ci:rangtreue-schranke
```

1. **Nulllinie (PR 0):** die ersten drei Befehle auf `main` — rho/Spannweite, Star-/Paartreue,
   Pp — dazu die Sonde `window.__arena.wandProbe()` (rein lesend, Muster `showcaseActProbe`):
   Siegerzeit-Median, Stolperer je Kopf, Reserve am Ende, Einbrüche. Aus der Siegerzeit folgt
   das Zeitlimit (2.5).
2. **Struktur mit Platzhalterzahlen (PR 2, erster Teil):** Griffarten, Zonen, Zeitpreis,
   Abrutschen A-2, Balance, GLEICHGEWICHT, Gegnerdruck G-2, Zeitlimit. Abnahme: alle
   Kadergrößen 2..6 starten, `wandProbe()` liefert keine Nullen, vier Geschwister bit-identisch.
3. **Sondierung:** zwei Läufe mit gedrehter Zuordnung müssen dieselbe Rangfolge des
   mechanischen Gewichts liefern; kein Sub-Skill unter 3 % (ROBUST!). Ein toter Sub-Skill ist
   ein Motorbefund → zurück zu 2.
4. **Rezept nach Budget:** acht Sub-Skills matrix-proportional, von Hand wie Tennis (das
   Sinkhorn-Werkzeug kennt nur Hockeys `MATRIX`/`ERLAUBT`). Pp ≤ 25 in zwei Saatstämmen, alle
   acht Attribute lesen positiv.
5. **Schalter-Matrix**, eine Kopie, ein Faktor: A-1/A-2 × G-2 an/aus × `druckQuelle` Nachbar/Feld
   — je Zelle Median, Spannweite, Star-Rang-1. Ergebnis in den Rezeptkommentar, verworfene
   Zellen als „BEWUSST NICHT GESETZT, weil gemessen …".
6. **Rangtreue:** > 0,80 hart, ≥ 0,834 angestrebt. Fällt die Runde nach zwei Rezept-Iterationen
   unter 0,80, gilt das Abbruchkriterium: A-2 → A-1, und wenn auch das nicht reicht, bleibt die
   alte Mechanik unter der neuen Wand (PR 1), und dieses Dokument bekommt den Messbericht.
7. **Nachzug:** Basislinie, PPS-Referenz, Slot-Invariante, CI, `stand-aller-disziplinen.md`.

### 6.5 Drei Regeln, noch einmal am Rezept

- Kein Sub-Skill mit einem Attribut außerhalb der Matrix (heute erfüllt).
- Kein Attribut in einer Erfolgschance über sein Gewicht hinaus — power ist mit 8 das
  wachsamste: es sitzt in ANTRITT 38, TECHNIK 23, WUCHT 42 und bekäme über den Kraftzug-
  Nebenweg und den Störgriff zwei weitere Kanäle. Erste Schraube: `wuchtKraft` hoch, WUCHT-
  Anteil power runter (auf determination/health).
- Kein Attribut ohne Kanal — ROBUST bekommt zwei, GLEICHGEWICHT wird an Zonen und Druck
  gemessen.

### 6.6 Korridor ohne reale Referenz

Es gibt keine IFSC-Statistik für zwölf Kletterer an einer Wand mit Störgriffen. Ersatz ist eine
plausible Zielverteilung, die Chris abnickt, gemessen mit `wandProbe()` über n ≥ 32:

| Kennzahl | Zielkorridor (Vorschlag) | Warum |
|---|---|---|
| Top-out-Quote | 60–80 % | Lead-Finals: die meisten fallen, bei uns soll die Mehrheit ankommen — sonst ist die Uhr die Wertung, nicht die Höhe |
| Abrutscher je Kletterer | 0,6–1,2 | einer je Rennen im Mittel, null beim Star, zwei beim Schwachen |
| Anteil Abrutscher zur Zone (A-2) | 100 % der Abrutscher, Deckel ein Abschnitt | Chris' „Neustart eines Abschnitts" |
| Rasten je Kletterer | 1–3 | die Zonen werden benutzt, nicht durchklettert |
| Störgriffe je Rennen (G-1) | 3–6, Treffer ~40 %, Ausweichen ~20 % | Takeshi: 13,3 Rempler / 5,4 Treffer auf 14 Fallen — die Wand soll ruhiger sein |
| Balance am Ende, Median | 0,5–0,7 | die Ressource wird verbraucht, aber nicht leer |
| Siegerzeit | wie Nulllinie ±15 % | die Uhr des Rennens ändert sich nicht grundsätzlich |
| Heim:Gast | 45:55 bis 55:45 | Spiegeltest; ein `miss-bahn-spiegel.mjs` (Muster `miss-arena-buehne-spiegel.mjs`) ist zu bauen — er fehlt heute für alle fünf Bahnen |

---

## 7. Bauplan in Etappen

### 7.1 Einordnung

| Runde | Was | Umfang | rho-Wirkung |
|---|---|---|---|
| Climbing-Kalibrierung (16.09., #943) | ein Rezepthebel, Produktivierung | 1 PR, 1 Tag | 0,782 → 0,834 |
| Climbing-Wand (17.09.) | `bodenClimbing()`, Ton | 1 PR, 1 Tag | bit-identisch |
| Takeshi Chaos-Rezept (06.09.) | Rempler-Fenster, Ausweichen, Gedränge, Schalter gemessen | 2–3 PRs, ~3 Tage | 0,866 → 0,860/0,872, Star 73 → 84 % |
| I-Spy Schatzsuche (ab 21.09.) | eigener Rechner, Rezept, Reaktion, Bild | 6 PRs, 8–12 Tage | 0,684 → 0,778 (Runde 2, heute) |

Die Wand liegt **zwischen Takeshis Chaos-Runde und I-Spy**: kein neuer Rechner, kein Chassis-
Wechsel, aber ein halbes Dutzend neuer Felder im Bahn-Block, ein Sub-Skill, ein Rezept-Refit und
eine vertikale Geometrie. **Schätzung: sechs PRs, 7–10 Arbeitstage, zwei Wochen mit Reviews.**
Die Unsicherheit sitzt in PR 2.

### 7.2 PR-Aufteilung (sequenziell, alle fassen `engine.js` an)

**PR 0 — Doku, Nulllinie, Sonde (≈ 0,5 Tag).** Dieses Dokument. `wandProbe()` (rein lesend).
Nulllinie: rho/Spannweite/Saison, Star-/Paartreue, Pp bei n=48, Siegerzeit-Median, Stolperer je
Kopf — als Tabelle in dieses Dokument. Kein Messwert bewegt sich.

**PR 1 — Die Wand steht (≈ 2 Tage, rho-frei).** `istWand()`-Zweig in `laeuferXY()`,
`bodenWand()` (vertikal, Routen, Griffe je Art aus `hindernisTypen` — solange das Feld fehlt,
alle Griffe neutral), Kamera nach oben, `stepWand()` mit Phasen `klettern`/`kraftzug`/`topout`
(die übrigen Phasen kommen mit PR 2), die 12+11 direkten `camX`/`bahnY`-Stellen über
`laeuferXY()`. Rebase auf `climbing-fortschrittsbalken-22-09`. Abnahme: `miss-alle-disziplinen.mjs
24` alle zwanzig ziffernidentisch; Screenshot-Gegenprobe der vier Geschwister (Muster
`climbing-wand-17-09.md`); Chris sieht eine Wand mit Kletterern statt einer Bahn mit Läufern.
**Das ist die PR, die seinen Satz beantwortet, bevor eine Zahl im Risiko steht.**

**PR 2 — Mechanik und Rezept (≈ 3–4 Tage; die entscheidende PR).** Felder: `hindernisTypen`,
`fallenKoennen`, `huerdePreis`, `zonen`, `abrutsch:"zone"|"haengen"`, `umsetzBasis/Spanne/Zeit`,
`balance*`, `druck*`, `zeitlimit`, Sub-Skill GLEICHGEWICHT, ROBUST-Kanäle, Bahnvergabe
`wechselseitig`. `stepWand()` um `rasten`/`umsetzen`/`abrutschen`. Dann 6.4 Schritte 2–6 in
dieser PR, Rezept-Refit inklusive, Basislinie neu. Abnahme: kaderfest > 0,80 (≥ 0,834
angestrebt), Pp ≤ 25 in zwei Stämmen, Star-/Paartreue ≥ Nulllinie, Korridor 6.6, 2–6 je Seite,
vier Geschwister bit-identisch, `pruefe-slot-invariante.ts`, `ci:rangtreue-schranke` mit
begründeter Basislinien-Änderung. Wenn PR 2 nach zwei Rezept-Iterationen unter 0,80 bleibt:
Abbruchkriterium 6.4 Schritt 6.

**PR 3 — Störgriff G-1 (≈ 1 Tag, nur nach Chris' Ja zu Frage 1 in 3.4).** `tackle:true` mit
den Feldern aus 3.2, Wirkung = Balance, Widerstand WUCHT gegen ROBUST, Ausweichen, Boxscore-
Spalten Stör/Ausw/Hält, Ticker. Kaderfest gemessen gegen PR 2; bei Schaden „BEWUSST NICHT
GESETZT" mit Zahl im Rezeptkommentar, Felder bleiben im Motor.

**PR 4 — Wertungstabelle, Endstand, Ton, Politur (≈ 1 Tag, rho-frei).** `wertungTabelle`
(Höhe/Abrutscher/Kraftzüge/Balance), Endstand-Wörter, `TON_KATALOG.climbing` erweitert,
`vizGriffN` beim Wiederaufstieg, drei Routen-Layouts (`kurse[]`-Muster, falls Chris will),
Rennplan-Ansage „rasten". Optional W-b als eigene, gemessene Folge-PR.

**PR 5 — Produktions-Nachzug (≈ 1 Tag, PRODUKTIONSCODE, besondere Review-Sorgfalt).**
PPS-Referenz neu (`ziehe-buehne-pps-referenz.ts climbing`), `pruefe-pps-referenz-frische.ts`,
`ARENA_IMPACT_KONFIG_JE_DISZIPLIN`-Konstanten prüfen, `tests/battle-mode-arena-team-points.test.ts`
und `tests/battle-arena-rennplan-ansage.test.ts` (beide nennen climbing) grün, Scorecard,
`stand-aller-disziplinen.md` (die Zeile ist ohnehin veraltet, 0.2), CLAUDE.md-Tabelle falls
gewünscht. Zeitpunkt nach Chris' Antwort auf Frage 9 (Saisonwechsel oder sofort).

Quer zu allen: eine Kopie, ein Faktor, vergleichen; Overseer-Review vor jedem Merge; jede Zahl
mit der gemessenen Datei daneben; jede PR weist die vier Geschwister bit-identisch nach.

---

## 8. Offene Fragen für Chris

1. **Die Balance-Mechanik — anfassen oder nicht?** (3.4, Frage 1.) G-2 Gegnerdruck ist gesetzt
   (keine fremde Hand, kein Würfel). **Soll der Störgriff G-1 dazu** — aktiver Kontakt an
   geteilten Griffen der Nachbarroute, mit Ausweichen und Widerstand, Persönlichkeit
   entscheidet, wer es tut? Das ist Chris' „versuchen kann" wörtlich, und es ist der Punkt, an dem
   die Wand vom IFSC-Bild abweicht.
2. **Wenn ja: nur Balance nehmen (Empfehlung) oder auch direkt zur Zone werfen?** (3.4, Frage 2.)
   Das Konzept empfiehlt Balance, weil ein Sturz durch fremde Hand gemessen rho kostet
   (Takeshi `tackleNerven`) und weil „aus dem Gleichgewicht bringen" genau das sagt.
3. **Abrutschen: zurück zur Zone (A-2, Empfehlung) oder Hängenbleiben (A-1)?** A-2 ist Chris'
   „Neustart eines Abschnitts" und das Ereignis, das man sieht; es kostet Verlässlichkeit. Beide
   werden gemessen; die Entscheidung ist, welche Chris will, falls beide die Schranke nehmen.
4. **Wertung: Rang wie heute (W-a) oder IFSC-Punkte 25/10/−0,1 (W-b)?** W-a kostet nichts und
   ist bewiesen messbar; W-b erzählt die Disziplin, braucht aber eigene Wertformel, Referenz und
   Messung. Empfehlung: W-a in PR 2, W-b als Frage nach der Kalibrierung.
5. **Zeitlimit:** 1,6 × Siegerzeit (Vorschlag) — oder kein Limit, sodass wie heute alle
   irgendwann oben sind? Ohne Limit gibt es keine Höhen-Wertung und die Uhr bleibt allein.
6. **Lead oder Boulder als Bild?** Seil und Karabiner an den Zonen (Empfehlung, weil der Fall
   „zur Zone" ein Seilbild ist) oder Matten und Fall auf den Boden (Boulder, dann müsste der
   Fall bis 0 gehen — und das ist mechanisch das, was A-2 mit Deckel verhindern soll).
7. **Griffarten: fünf (Vorschlag) oder weniger?** Weniger Arten = weniger Spezialisten-
   Geschichten, aber je Art mehr Griffe und eine stabilere Pp-Messung.
8. **Drei Routen-Layouts** (Überhang/Platte/Kante, per Saat) — gewünscht? Kosten: drei Listen.
9. **Zeitpunkt der Produktivierung:** Climbing rechnet heute Spieltage auf dem Server. Darf die
   Mechanik mitten in der laufenden Saison wechseln, oder wartet PR 5 auf den Saisonwechsel? Bis
   PR 5 läuft der Server ohnehin mit der alten Mechanik weiter — PR 1–4 ändern nur, was in
   Mockup und Messung passiert, solange `main` nicht deployt ist; nach dem Deploy von PR 2 aber
   sofort.
10. **Reihenfolge im Projekt:** I-Spy läuft (Kalibrierrunde 2 heute, 0,778), Football steht
    unter der Schranke (0,722). Die Wand bindet eine Session für PR 2 rund drei bis vier Tage.
    Vor oder nach I-Spy?
11. **Rasten als Plan-Entscheidung** (2.5): soll der Kletterer über die Rennplan-Ansage „jetzt
    rasten" / „durchziehen" bekommen — der Wand-Ableger des Angriffspunkts?

---

## 9. Was dieses Konzept bewusst nicht tut

- **Keine Matrix-Änderung, kein Override.** `official-discipline-weights.ts` bleibt, wie sie ist
  (CLAUDE.md, 21.09.); `spiel-eignung-overrides.ts` bekommt keinen Climbing-Eintrag. Alle acht
  Sub-Skills bestehen ausschließlich aus den acht Matrixattributen.
- **Kein neues Chassis, kein eigener Rechner.** Die Wand ist eine `BAHN_ART` mit neuen Feldern;
  `stepSpurt`, `tempoVon()`, `bahnRangliste()`, `MOTOREN[bd]` bleiben. Jedes neue Feld ist
  ungesetzt bit-identisch; Spurt/Staffel/Time-Trial/Takeshi weisen das je PR nach.
- **Kein Ausscheiden.** Anders als Takeshi bleibt jeder bis zum Zeitlimit an der Wand — Höhe
  ist die Wertung, nicht das Überleben.
- **Kein Sturz durch fremde Hand.** Störgriff und Gegnerdruck senken Balance; der Sturz fällt
  aus dem eigenen Wurf. Der Beleg gegen die harte Form steht im Motor (`tackleNerven`).
- **Kein Flow-Bonus für den Führenden**, kein Helfer-Bonus für Teamkollegen auf der
  Nachbarroute (Präzedenz `takeshi-animationen-hilfe-behinderung-recherche-06-09.md` 4.2).
- **Kein Asset-Download.** Griffe, Karabiner, Seil, Balance-Ring sind Primitive.
- **Kein Produktionsanschluss-Wechsel vor der kaderfesten Abnahme**, keine Basislinie ohne
  begründete PR, keine PPS-Referenz aus einer ungemessenen Mechanik.
- **Kein Speed-Klettern.** Das haben wir heute; es ist genau das, was Chris nicht will.

## Quellen (alle gelesen, nicht vermutet)

- `public/mockups/battle-mode.engine.js` (`main` `0f812538`): `BAHN_ART.climbing` `:25228-25307`;
  Takeshi-Konfiguration `:25425-25470`, `wertungTabelle` `:25681-25695`; `KRAFT_VON` `:25724`;
  `spurtWerte()` `:25739-25743`; `bahnRangliste()`/`bahnTeamstand()` `:23100-23190`;
  `laeuferXY()` `:26327-26340`; `bauSpurt()` `:26427`, Reserve/Nerven-Init `:26594-26595`;
  `tempoVon()` `:26866-26907`; Nerven-Regen `:27035`; Bahnwechsel `:27043-27072`; Zehr/Steigung
  `:27090-27125`; Puste-Regen `:27144-27164`; Hindernis-Block `:27181-27439` (Typ/Preis `:27200-27215`,
  Gedränge `:27247-27276`, `pusteAbzug` `:27293-27299`, `fallenKoennen` `:27328-27333`, Würfe
  `:27358-27380`, `wendigErholt` `:27391`, Nerven `:27407-27433`); Rempler `:27451-27564`;
  `stepClimbing()` `:27973-27994`; `stepZeitfahren`-Vertrag `:27996-28042`; `bodenClimbing()`
  `:24772`; `renderEndstandBahn()` `:30523-30562`; `MOTOREN[bd]` Bahn `:31215-31228`.
- `lib/battle/arena-resolved-disciplines.ts` (`:118-136`, `:165`);
  `lib/resolve/battle-mode-arena-team-points.ts` (`:169-175`, `:545`, `:776-782`);
  `lib/battle/arena-headless-runner.ts` (`ARENA_BAHN_DISCIPLINE_IDS` `:201`);
  `lib/player-generator/official-discipline-weights.ts` (climbing-Spalte);
  `lib/player-generator/spiel-eignung-overrides.ts` (kein Climbing);
  `lib/lineups/matchday-slot-roles.ts:129-136`; `data/generated/rangtreue-basislinie.json:47-54`.
- `docs/design/climbing-kalibrierung-16-09.md`, `climbing-wand-17-09.md`,
  `bahn-disziplinen-recherche-fable.md` (Tabelle `:100-130`, Speed-/Lead-/Boulder-Zeilen
  `:117-122`), `i-spy-schatzsuche-konzept-21-09.md`, `neue-disziplin-handbuch.md` (2, 3, 7),
  `stand-aller-disziplinen.md` (`:225`, `:710`),
  `docs/pm-briefings/opus-plan-naechste-drei-disziplinen-17-09.md` (3.1), `CLAUDE.md`.
- `scripts/miss-alle-disziplinen.mjs`, `messe-arena-einfluss.mjs`, `sondiere-feldspiel-subskills.mjs`,
  `miss-star-paartreue.mjs`, `baue-rangtreue-basislinie.mjs`, `pruefe-rangtreue-schranke.mjs`,
  `ziehe-buehne-pps-referenz.ts`, `pruefe-pps-referenz-frische.ts`, `miss-arena-buehne-spiegel.mjs`
  (kein Bahn-Spiegel vorhanden).
- Git: `git worktree list` (22.09.), Branch `climbing-fortschrittsbalken-22-09` (`8b9fda00`);
  `origin/bug-reports` (letzte Meldung 25.08., keine zu Climbing).
- Web (22.09.): [olympics.com — How does the new Boulder scoring work](https://www.olympics.com/en/news/sport-climbing-how-does-the-new-boulder-scoring-work),
  [JudgeMate — IFSC Scoring 2025 (25/10/−0,1)](https://www.judgemate.com/en/guides/ifsc-scoring-2025-explained),
  [worldclimbing.com — New rule changes 2025](https://www.worldclimbing.com/news/new-rule-changes-take-effect-for-ifsc-world-cup-series-2025),
  [Wikipedia — Competition climbing](https://en.wikipedia.org/wiki/Climbing_competition),
  [gearjunkie — IFSC rules & scoring explained](https://gearjunkie.com/climbing/ifsc-climbing-explained),
  [IFSC Competition Rules 2025 v2.0 (PDF)](https://images.ifsc-climbing.org/ifsc/image/private/t_q_good/prd/s3ihxcisocdpc8ty6mtg.pdf),
  [Wikipedia — Speed climbing wall](https://en.wikipedia.org/wiki/Speed_climbing_wall),
  [Wikipedia — Speed climbing](https://en.wikipedia.org/wiki/Speed_climbing),
  [IFSC Speed Licence Rules (PDF)](https://images.ifsc-climbing.org/ifsc/image/private/t_q_good/prd/urwl7n2hnnyvhiwiq0xg.pdf).
  Nur die Suchergebnis-Zusammenfassungen gelesen; die Zahlen decken sich mit der Tabelle in
  `bahn-disziplinen-recherche-fable.md`.
