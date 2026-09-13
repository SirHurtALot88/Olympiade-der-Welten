# Hockey + bewegungsintensive Disziplinen: Konzept Ausdauer-Leiste und Check-Dynamik

**Reine Recherche und Konzeptarbeit. Keine Zeile Produktionscode wird in diesem PR geändert.**
Chris hat ausdrücklich das Konzept zuerst verlangt („bitte mal als konzept erarbeiten und dann
usmetzen") — die Umsetzung ist ein eigener PR, und er wartet auf seine Entscheidungen zu den
offenen Fragen in Abschnitt 11.

Stand: `main` = `ec9190c5`. Alle Zeilenangaben sind gegen genau diesen Stand geprüft (nicht gegen
den Stand, auf dem gemessen wurde — dazu unten). Gegengelesen wurden
`docs/design/hockey-opus-review-nhl.md`, `hockey-mechanik-angleichen.md`,
`hockey-naechster-hebel-recherche-fable.md`, `fatigue-saisonlaenge-plan.md`,
`basketball-doppeln-taktik-pause-recherche-06-09.md`, `breaking-kalibrierung-10-09.md` und
`messgrundlage-kaderfest.md`; im Code `versucheSteal()`, `stepFeldspielLive()`,
`bewegeSpielerLive()`, `renderKader()`, `feldspielWert()`, `stepSpurt()`, `tempoVon()`,
`fallenAusgang()`, `KRAFT_VON()` und die vier Kader-Adapter.

## Der Auftrag, wörtlich

Chris, zwei Meldungen unmittelbar nacheinander:

> „im hockey sehe ich viel hin und her gelaufe aber wenig interaktion beim wechsle von offense auf
> defense, ich sehe keine checks oder tackles etc. bitte anpassen das muss auch dynamischer werden"

> „und die health bars sind ja hier quatsch, die könnten eher ausdauer sein und tackles kosten ggf.
> ausdauer? nicht zu verwechseln mit unserer fatigue ich meine speziell für die diszi. man lädt in
> pausen etwas auf oder wenn man weniger rennt etc aber verliert was wenn man tacklet oder
> getackled wird je nachdem welcher spieler stärker war -> bitte mal als konzept erarbeiten und
> dann usmetzen"

Und danach, als Erweiterung des Auftrags über Hockey hinaus:

> „generell würde ich das bei speed diszis so nutzten wo man sich fortbewegt"

> „bei takeshi soll die health bar auch so ne ausdauer sein die sich bissl wieder auflädt so dass
> man den zustand vom spieler ein wenig verfolgen kann. dass er ggf. mal pause machen muss oder so
> oder langsamer wird"

Hockey bleibt der ausgearbeitete Hauptfall (Abschnitte 3, 4, 6, 7). Die Verallgemeinerung auf
Takeshi's Castle und die übrige Bahn-Familie steht in Abschnitt 9.

---

## 1. Das Urteil, bevor die Begründung kommt

1. **Der zweite Auftrag ist auf dem Bahn-Chassis bereits gebaut — und der Code sagt es wörtlich.**
   `battle-mode.engine.js:20786`: „KRAFTRESERVE als schmaler Balken unter den Fuessen — **der
   Ersatz fuer den Lebensbalken des Kampfes**." `u.reserve`/`u.reserveMax` existieren, zehren nach
   Tempo, kosten bei Sturz und Durchbruch extra, werden unter den Füßen gezeichnet und drücken bei
   Leerstand das Tempo (`tempoVon`, `:19806`). Auf der Bahn kostet sogar ein **Tackle** schon
   Ausdauer (`o.reserve=Math.max(0,o.reserve-18)`, `:20300`) — exakt Chris' „tackles kosten ggf.
   ausdauer", nur in einem anderen Chassis. Das Konzept unten ist deshalb überwiegend ein
   **Portieren**, keine Erfindung. Das senkt Risiko und Aufwand erheblich.

2. **Aber: die Ausdauer selbst regeneriert heute NIRGENDS.** `u.reserve` wird an **fünf** Stellen
   verringert (`:20030`, `:20132`, `:20152`, `:20300`, `:20383`) und an keiner einzigen erhöht
   (geprüft per grep über die ganze Datei). Die einzige Regeneration im ganzen Motor gilt einer
   anderen Größe: Takeshis Nervenkostüm (`nervenRegen`, `:19947`). `u.leer` ist eine
   Sperrklinke, die nie zurückgesetzt wird (`:20032`). Genau der Ratchet, den
   `fatigue-saisonlaenge-plan.md` Abschnitt B.2 für die Saison-Fatigue diagnostiziert hat — hier
   dasselbe Muster eine Ebene tiefer. **Chris' „man lädt in pausen etwas auf oder wenn man weniger
   rennt" ist der eine Teil, den es wirklich noch nicht gibt.**

3. **Die „health bar", die Chris im Hockey sieht, ist keine Lebensleiste — sie ist eine
   TOR-Leiste, und sie steht bei 60,8 % aller Spielerkacheln das ganze Spiel auf null.**
   `renderKader()` (`:22428`) füllt die Kachelleiste im Feldspiel mit `punkte` (im Eishockey:
   erzielte Tore), normiert auf den Höchstwert des Spiels (`:22443-22445`). Gemessen über 24
   kaderfeste Spiele: 175 von 288 Kachelzeilen tragen keinen einzigen Torpunkt. Der Tooltip sagt
   trotzdem `„… — N von M Leben"` (`:22457`). Chris hat vollkommen recht, und zwar präziser, als
   seine Formulierung nahelegt: die Leiste ist nicht nur semantisch falsch, sie ist **die meiste
   Zeit leer und damit informationslos**.

4. **Checks sind NICHT zu selten — das ist der Teil von Chris' Vermutung, der der Messung nicht
   standhält.** Gemessen (n=24, kaderfest, 6 je Seite): **16,0 sitzende Bodychecks je Spiel**
   (10,5 davon sichtbar mit „CHECK!", 5,5 abgepfiffen als Bandencheck), bei fünf Feldspielern je
   Seite und 240 s Spieluhr. Auf den einzelnen Skater gerechnet sind das **1,6 Treffer je Spiel**;
   die NHL lag 2024-25 zwischen 15,1 (Dallas/Edmonton) und 29,8 (Florida) Hits je Team und Spiel
   bei 18 Skatern, also rund **1,2 je Skater**. **Unsere Feldspieler checken je Kopf rund ein
   Drittel häufiger als NHL-Profis.** Wer sie nicht sieht, sieht sie nicht deshalb nicht, weil sie
   fehlen — sondern weil sie aussehen wie alles andere (Punkt 5).

5. **Sie sind unsichtbar, weil ALLES gleich aussieht.** Gemessen an denselben 24 Spielen fallen je
   Spiel **rund 103 rote Schwebetexte** desselben Typs (`_def`): 69,3 Saves/Blocks, 18,0
   Steals/Abfänge, 10,5 Bodychecks, 5,5 Strafen. Sie tragen **dieselbe Farbe (`--crit`), dieselbe
   Schriftgröße (`700 15px Barlow Condensed`), dieselbe Position (30 px über dem Kopf) und
   dieselbe Aufstiegsanimation** — der Zeichencode kennt genau zwei Klassen, `_def` und Treffer
   (`:11051-11065`). Schlimmer: **Bodycheck und Stockcheck schreiben buchstäblich dasselbe Wort.**
   Der Bodycheck schreibt `"CHECK!"` (`:9034`), der Puckdiebstahl am Träger schreibt
   `art.wortAbwehr.toUpperCase()+"!"` — und `FELDSPIEL_ART.hockey.wortAbwehr` ist `"Check"`
   (`:4880`). In einem 480-Sekunden-Spiel erscheint alle 4,6 Sekunden ein roter Text, 18,6 davon
   lesen „CHECK!", und zwei völlig verschiedene Aktionen sind daran nicht zu unterscheiden.

6. **Der zweite Grund ist der, den Chris selbst benennt: es gibt keinen lesbaren Angriff, aus dem
   heraus gewechselt wird.** Gemessen: **111,9 Seitenwechsel des Puckbesitzes je Spiel**, mittlerer
   Puckbesitz eines Feldspielers **1,15 s** (Median, = 2,3 s Zuschauzeit). 57,7 % der Spielzeit
   führt jemand den Puck, 23,6 % ist er in der Luft, 17,9 % liegt er frei. Und der Bodycheck fällt
   im **Median 0,58 s nach dem letzten Besitzwechsel** (Mittel 1,27 s) — die Interaktion sitzt
   also EXAKT am Übergang, nur ist der Übergang selbst vorbei, bevor ein Zuschauer ihn als
   Übergang erkennt. **„viel hin und her gelaufe" ist die richtige Beschreibung eines Spiels, das
   alle zwei Sekunden die Seite wechselt.**

7. **Kein latenter Elimination-Fehler im Hockey.** Die geerbte Kampf-HP-Mechanik greift im
   Feldspiel gar nicht: `bauFeldspiel()`/`bauSpieler` (`:5807-5944`) legt an einer Feldspiel-Einheit
   überhaupt kein `hp`/`max` an; `hp:s.LP*LEBEN_JE_LP` (`:15325`) und das Ausscheiden
   (`:15494`, `:15926`) liegen ausschließlich im Arena-Chassis auf `U`, nicht auf `FSTEAM`.
   `u.down` heißt im Feldspiel „liegt nach einem Bodycheck" und wird nach `HK_STURZ = 0,45 s`
   wieder gelöscht (`:9868`). Ein Hockeyspieler kann also heute schon nicht ausscheiden. Das ist
   gut so und muss beim Umbau so bleiben.

---

## 2. Was gemessen wurde, womit, und was nur gelesen ist

### 2.1 Eigene Messungen

Alle Playwright/Chromium, Kader-Familie aus `data/generated/kaderfamilie-live-save.json`
(live-save-Stand „Oly New Game Custom 19.8.2026, 09:08:45"), 6 je Seite.

| Werkzeug | Ergebnis |
|---|---|
| `node scripts/miss-alle-disziplinen.mjs 24 hockey` | hockey 0,669 [0,181] / 0,832 [0,259]; nur Feldspieler 0,719 [0,182] / 0,818 [0,259] — **ziffernidentisch zur eingecheckten Basislinie**, die Messbank steht |
| `node scripts/miss-hockey-korridor.mjs 24` | Tore je Team 4,13 · Schussversuche 43,0 · Schüsse aufs Tor 37,8 · Fangquote 89,1 % · **Checks je Team 5,3** · Ballwechsel 85,4 · Strafen 2,8 |
| eigene Sonde über `feldspielProbe` (unveränderter Motor) | 288 Spielerzeilen: **175 ohne Tor (60,8 %)**; 240 Feldspielerzeilen: 127 ohne Tor (52,9 %), **80 ganz ohne Scorerpunkt (33,3 %)**; Nenner der Kachelleiste (höchster Torwert je Spiel) Median 3 |
| eigene Sonde, instrumentierter Motor (Scratchpad-Kopie) | je Spiel: **121,5 Bodycheck-Gelegenheiten**, davon **16,0 gesessen (13,2 %)** → **10,5 sichtbar**, **5,5 abgepfiffen**; Stockcheck 8,1; abgefangener Pass 9,9; Fehlpass 3,3; lose Pucks 70,7 (davon 0,5 Bandenduell); **111,9 Seitenwechsel** |
| dieselbe Sonde, Zeit und Ort | wucht-Chance je Gelegenheit im Mittel **14,4 %** (min 4,0 / max 36,4) · Lücke zwischen zwei sichtbaren Checks Median **14,4 s** Spielzeit (28,7 s Zuschauzeit) · Check fällt **0,58 s** (Median) nach dem Besitzwechsel · die checkende Mannschaft gewinnt den losen Puck danach in **77,4 %** der Fälle · Zone aus Sicht der gecheckten Mannschaft: eigenes Drittel 33,8 % / neutral 26,0 % / Angriffsdrittel 40,3 % |
| dieselbe Sonde, Zeitbudget (10-Hz-Stichprobe) | Puck bei einem Feldspieler **57,7 %**, in der Luft 23,6 %, frei 17,9 %, gar nichts 0,8 % · Puckbesitz am Stück Median **1,15 s** (Mittel 1,41 s) |
| dieselbe Sonde, Ereigniszählung über `logZug` | je Spiel: rebound 70,7 · block/save 69,3 · bully 28,1 · steal 18,0 · **check 10,5** · treffer 8,3 · fehlwurf 8,0 · strafe 5,5 · turnover 3,3 |
| eigene Sonde über `window.__arena.bahnLauf` (unveränderter Motor, je 24 Rennen) | siehe Tabelle in 5.2 |

**Offengelegt, weil es die Zahlen beeinflusst:** die Ereignis-Zeitstempel stammen aus einer
**instrumentierten Kopie** des Motors im Scratchpad (zehn eingefügte Log-Zeilen, kein `rr()`-Aufruf,
keine Mechanikänderung). Das Repo wurde nicht angefasst (`git status --porcelain` leer). Eine
frühere Fassung derselben Sonde rief `feldspielProbe` 24-mal mit `n:1` auf — dabei zieht
`zieheFormkarten` jedes Mal denselben Kartensatz, die Kaderstreuung fehlt. Die Zahlen oben stammen
aus dem korrigierten Lauf mit **einem** Aufruf `n:24`. Die Größenordnungen unterschieden sich um
weniger als 5 %, die Richtung in keinem Punkt.

**Gemessen wurde auf `961b7793`** (dem `main`-Stand zu Beginn dieser Runde); `ec9190c5` kam während
der Runde dazu und ist geprüft rein präsentational (Staffel-Stabsprite, `viz*`-Felder, Ton — kein
`reserve`/`zehr`/`stolper`-Term berührt, `git diff` gelesen). Die Zeilenangaben im ganzen Dokument
sind trotzdem auf `ec9190c5` nachgezogen.

### 2.2 Abgerufen (Zahlen wörtlich aus der Quelle)

| Kennzahl | Wert | Quelle |
|---|---|---|
| NHL Hits je Team und Spiel 2024-25 | Spitze **Florida 29,83**, Schluss **Dallas/Edmonton ~15,1** | StatMuse |
| Mittlere Schichtlänge NHL | **rund 47 s** (Verteidiger 48,6 s, Stürmer ~46 s); Faustregel 35-45 s für Stürmer, 40-50 s für Verteidiger; „shifts over 60 seconds usually signal fatigue" | Hockey Answered / HPT |
| Wirkung der Ermüdung | „Fatigue diminishes a player's skating speed … exhaustion affects reaction times and decision-making" | HPT |
| Hits und Erfolg | „Hit differentials almost have an equal and opposite relationship with goal differentials as shot differentials have with goals"; „teams don't have the puck when they hit" | Hockey Graphs (2015) |
| Hits als Einzelstatistik | „there is very little correlation between hitting and winning" | Hockey Graphs, „The Usefulness (or lack thereof) of Hit Totals" |

Der letzte Punkt ist für dieses Konzept **die wichtigste externe Zahl** und steht bereits als
Begründung im Code (`:6760`, „CHECKS GESTRICHEN"): `checks*0,4` flog aus `feldspielWert()`, weil
Hit-Differenzen real negativ mit Tordifferenzen korrelieren. **Das darf diese Runde nicht rückgängig
machen.** Mehr Sichtbarkeit für den Check, ja. Ein Wertposten für den Check, nein.

---

## 3. Diagnose 1 — der Check

### 3.1 Wo der Check entsteht, und wann dieser Pfad überhaupt läuft

Der Bodycheck sitzt in `versucheSteal(decker,traeger,art)` (`:8959`), im Block unter dem Kopf
`// ==== BODYCHECK ====` (`:8990`):

```js
const wucht=Math.max(0.04,Math.min(0.45,0.16+(decker.ABWEHR-traeger.AUSDAUER)*0.0040));
if(rr()<wucht){
  if(rr()<HK_FOUL_ANTEIL&&verhaengeStrafe(decker,traeger,"Bandencheck")){ … return; }
  traeger.taumeltBis=fsT+HK_TAUMEL;                 // 1,4 s halbes Tempo
  traeger.down=true; traeger.downBis=fsT+HK_STURZ;  // 0,45 s am Boden
  decker.checks++;
  sfx("hockey","treffer");
  feed(…); schwebe({…txt:"CHECK!"…}); logZug(…,"check",…);
  traeger.hatBall=false; …                          // Puck liegt neben ihm
  fsLive.ball.frei=haltePuckImFeld({…});
  return;
}
```

**Die entscheidende Struktureigenschaft steht nicht hier, sondern an der Aufrufstelle**
(`:10175-10183`, in `stepFeldspielLive`):

```js
const deckerAlle=FSTEAM[1-traeger.side].filter(v=>v.deckt===traeger);
…
for(const v of deckerAlle){
  if(fsLive.ball.traeger!==traeger)break;
  if(v.stealCd<=0&&dist(v,traeger)<STEAL_REICHWEITE)versucheSteal(v,traeger,art);
}
```

Daraus folgt dreierlei, und das ist die eigentliche Diagnose:

- **Ein Check kann NUR den Puckführer treffen.** Kein Spieler ohne Puck wird je gecheckt. Das reale
  Eishockey kennt genau das Gegenteil als eigenes Handwerk: „finish your check" trifft den Mann,
  der die Scheibe gerade abgegeben hat, und der Verteidiger, der an der blauen Linie aufrückt,
  trifft den Angreifer VOR der Puckannahme.
- **Ein Check IST immer der Ballverlust, nie seine Folge.** Der Block endet mit losem Puck. Es gibt
  keinen Check, der nach dem Wechsel noch kommt — architektonisch unmöglich.
- **Er ist an die Manndeckung gekoppelt** (`v.deckt===traeger`) und an 45 px Reichweite
  (`STEAL_REICHWEITE`, `:5531`) plus eine feste Abklingzeit von 2,0 s je Decker (`:8982`).

### 3.2 Gemessen: wie oft, wie hart, wie verteilt

| Größe | je Spiel (beide Mannschaften) | je Team |
|---|---:|---:|
| Bodycheck-Gelegenheiten (`wucht` gewürfelt) | 121,5 | 60,8 |
| davon gesessen | **16,0** (13,2 %) | 8,0 |
| → sichtbar als „CHECK!" | **10,5** | 5,3 |
| → abgepfiffen (Bandencheck) | 5,5 | 2,8 |
| Stockcheck am Träger („CHECK!") | 8,1 | 4,1 |
| abgefangener Pass („STEAL!") | 9,9 | 5,0 |

`HK_FOUL_ANTEIL = 0,38` (`:6445`) erklärt die Aufteilung 10,5 / 5,5 sauber. **Der Kommentar direkt
darüber ist veraltet:** er sagt „Gemessen fallen bei uns rund 10 Bodychecks je Team und Spiel"
(`:6440`) — gemessen sind es **8,0 je Team** (5,3 sichtbar). Kleiner Befund, aber genau die Sorte
Zahl, die später jemand als Grundlage nimmt.

Die `wucht`-Spanne trägt echtes Können: im Mittel 14,4 % je Gelegenheit, über die reale Kader-Familie
von **4,0 % bis 36,4 %**. Die Feldspieler liegen in ABWEHR zwischen 29 und 75 (Median 53) und in
AUSDAUER zwischen 21 und 75 (Median 59). Der Kontrast funktioniert.

### 3.3 Gegen die NHL gehalten — hier hält Chris' Vermutung nicht

| | unser Eishockey | NHL 2024-25 |
|---|---:|---:|
| Hits je Team und Spiel | **8,0** | 15,1 bis 29,8 (Mittel rund 22) |
| Skater je Team | 5 | 18 |
| **Hits je Skater und Spiel** | **1,60** | **rund 1,2** |
| Spieluhr | 240 s | 3600 s |
| Hits je Minute Spieluhr und Team | **2,0** | **0,37** |

Auf die Uhr gerechnet sind wir **fünfmal so check-dicht wie die NHL**; auf den Kopf gerechnet
immer noch rund ein Drittel darüber. Selbst nach der Zuschauzeit (480 s durch `ZEIT_DEHNUNG`
hockey `2`, `:21342`) bleibt **ein Bodycheck alle 29 Sekunden** übrig. Das ist keine Disziplin mit
zu wenig Körperspiel.

Auch die **Verteilung stimmt**: 40,3 % der Checks fallen im Angriffsdrittel der gecheckten
Mannschaft (also Forechecking durch die Verteidigung tief in deren Zone), 33,8 % in deren eigenem
Drittel, 26,0 % in der neutralen Zone. Das ist ungefähr die reale Aufteilung (Forecheck- und
Verteidigungszonenkontakte dominieren, die neutrale Zone ist der kleinste Teil) — hier war nichts
zu reparieren.

### 3.4 Warum es trotzdem nach „wenig Dynamik" aussieht — drei belegte Ursachen

**Ursache A — jedes Ereignis sieht gleich aus.** `zeichneFeldspiel` kennt für Schwebetexte genau
drei Zustände (`:11055-11058`): `_def` (rot, `--crit`), `_gross` (22 px, `--warn`, nur das Tor),
sonst grün. Damit teilen sich Bodycheck, Stockcheck, Save, Block, Interception und Strafe **ein und
dieselbe Darstellung**. Gezählt je Spiel:

| Schwebetext | Anzahl je Spiel | Wortlaut |
|---|---:|---|
| Save / Block | 69,3 | „SAVE!" bzw. „BLOCK!" |
| Steal am Träger | 8,1 | **„CHECK!"** (`art.wortAbwehr`) |
| abgefangener Pass | 9,9 | „STEAL!" |
| Bodycheck | **10,5** | **„CHECK!"** |
| Strafe | 5,5 | „STRAFE!" |
| **Summe rot** | **103,3** | alle identisch gestaltet |

103 rote Texte auf 480 Sekunden Zuschauzeit: **alle 4,6 Sekunden einer.** Zwei davon lesen
„CHECK!", und sie meinen zwei verschiedene Dinge. Das ist die Erklärung dafür, dass Chris zehn
Bodychecks je Spiel sieht und keinen davon bemerkt.

**Ursache B — der Check hat keine eigene Pose und fast keine eigene Dauer.** Der Getroffene bekommt
`ani="hurt"` (`:2895`) für `HK_STURZ = 0,45 s` und danach `HK_TAUMEL = 1,4 s` mit
`HK_TAUMEL_TEMPO = 0,55` (`:6404`, Wirkung in `bewegeSpielerLive` `:9837`). In Zuschauzeit sind das
0,9 s liegen und 2,8 s taumeln. Der **Checkende** bekommt nichts Eigenes: `decker.lunge=0.4`
(`:8989`) wird **vor** dem Würfel gesetzt und ist dieselbe Ausfallschritt-Pose wie bei jedem
erfolglosen Stockcheck-Versuch. Es gibt also keinen Moment, in dem man sieht, dass jemand einen
Körperkontakt SUCHT — nur einen, in dem jemand umfällt. Der einzige heute wirklich
unterscheidbare Kanal ist der **Ton** (`sfx("hockey","treffer")`, `:9032`, dumpfer Schlag plus
Rauschen) — und der Save, der 69-mal je Spiel fällt, hat gar keinen. Die Tonspur macht heute
bereits mehr Unterschied als das Bild.

**Ursache C — es gibt keinen Angriff, aus dem heraus gewechselt wird.** Das ist die Ursache, die
Chris' erster Satz („viel hin und her gelaufe") direkt beschreibt:

| Größe | gemessen | zum Vergleich |
|---|---:|---|
| Seitenwechsel des Puckbesitzes je Spiel | **111,9** | einer alle 2,1 s Spieluhr / 4,3 s Zuschauzeit |
| Puckbesitz eines Feldspielers am Stück (Median) | **1,15 s** | 2,3 s Zuschauzeit |
| Anteil Spielzeit mit Puckführer | 57,7 % | |
| Puck in der Luft | 23,6 % | |
| Puck frei | 17,9 % | |
| lose Pucks je Spiel aufgenommen | 70,7 | |
| Check fällt nach dem Besitzwechsel (Median) | **0,58 s** | |

Der Bodycheck fällt also **exakt an der Stelle, an der Chris ihn vermisst** — eine halbe
Spielsekunde nach dem Übergang. Nur dauert der ganze Übergang keine zwei Sekunden, und der nächste
kommt vier Sekunden später. Ein Zuschauer kann einen Wechsel von Offense auf Defense nicht als
Wechsel lesen, wenn es keinen Zustand gibt, aus dem gewechselt wird.

**Das ist der schwerwiegendere der zwei Befunde, und er ist nicht mit mehr Checks zu beheben.**

### 3.5 Was die Diagnose ausdrücklich NICHT ist

- Nicht „zu wenige Checks" (3.3).
- Nicht „Checks an den falschen Stellen des Eises" (3.2, Zonenverteilung plausibel).
- Nicht „der Check wirkt nicht" — er wirkt sogar deutlich: die checkende Mannschaft gewinnt den
  losen Puck danach in **77,4 %** der Fälle, weil `u.down` den Getroffenen für 0,45 s aus dem
  Wettlauf um den Puck nimmt (`:10043`). Wenn überhaupt, ist das eher zu viel (real gewinnt die
  hittende Mannschaft die Scheibe deutlich seltener) — eine Frage für Abschnitt 11, keine, die
  diese Runde entscheidet.

---

## 4. Diagnose 2 — die „health bar" im Hockey

### 4.1 Was die Leiste wirklich zeigt

`renderKader()` (`:22428`) baut die Kaderleiste links und rechts für alle vier Chassis über
dieselbe Kachel. Was in `hp`/`max` steht, hängt am Chassis (`:22436-22446`):

| Chassis | `hp` | `max` | was die Leiste also zeigt |
|---|---|---|---|
| Bahn | `1 - x.pos` | `1` | **Reststrecke** — wer führt, hat die leerste Leiste |
| Bühne | `x.summe` | höchste Summe im Feld | Punktestand |
| **Feldspiel** | **`punkte` aus `fsBisher()`** | **höchster Punktestand im Spiel** | **Tore** |
| Arena | `u.hp` | `u.max` | echte Lebenspunkte |

Gezeichnet wird in allen vier Fällen `.kbar` mit einem `<s>`-Balken, grün (`--ok`), rot
(`--crit`) für „tot" (`battle-mode.css:349-353`) — die Formsprache einer Lebensanzeige, in drei
von vier Fällen mit einem Inhalt, der nichts mit Leben zu tun hat. Und der Tooltip ist in allen
vier Fällen derselbe (`:22457`):

```js
k.title=u.n+(u.down?" — ausgeschieden":" — "+Math.round(u.hp)+" von "+u.max+" Leben");
```

Im Eishockey liest ein Spieler dort also wörtlich **„2 von 3 Leben"**, wenn ein Stürmer zwei Tore
geschossen hat.

### 4.2 Und die meiste Zeit steht sie auf null

Gemessen über 24 kaderfeste Spiele (unveränderter Motor):

| | Zeilen | ohne Füllung |
|---|---:|---:|
| alle Spielerkacheln | 288 | **175 = 60,8 %** |
| nur Feldspieler | 240 | 127 = 52,9 % |
| Feldspieler ganz ohne Scorerpunkt (Tor + Vorlage) | 240 | 80 = 33,3 % |

Der Nenner (höchster Torwert im Spiel) liegt im Median bei **3**. Eine Leiste mit drei möglichen
Stufen, die bei sechs von zehn Kacheln über das ganze Spiel leer bleibt, ist keine Anzeige — sie
ist ein Platzhalter. Chris' „quatsch" ist die zutreffende Beschreibung.

### 4.3 Kein latenter Elimination-Fehler

Zur ausdrücklich gestellten Frage: **nein, ein Hockeyspieler kann heute nicht bei 0 HP
ausscheiden**, und zwar nicht, weil es abgefangen wird, sondern weil es die Größe nicht gibt.
`bauSpieler` (`:5807-5944`) legt weder `hp` noch `max` an. `LEBEN_JE_LP = 4` (`:15603`) und die
beiden Ausscheide-Stellen (`:15494`, `:15926`) arbeiten auf `U`, dem Arena-Array. `u.down` ist im
Feldspiel ausschließlich der Bodycheck-Sturz und wird in `stepFeldspielLive` (`:9868`) zurückgesetzt
— an einer Stelle, die bewusst **vor** allen frühen Returns steht, weil ein gecheckter Spieler
sonst nach Spielende liegen blieb (dokumentierter Overseer-Fund, `:9863-9867`).

**Folgerung fürs Konzept:** die neue Ausdauer darf auf keinen Fall `hp` heißen oder in `u.down`
schreiben. Sie braucht ein eigenes Feld, sonst leckt sie in die Arena-Kampflogik.

---

## 5. Die Vorlage, die schon existiert: das Bahn-Chassis

Bevor irgendetwas Neues gebaut wird, gehört auf den Tisch, wie weit Chris' Idee schon steht.

### 5.1 `u.reserve` — die Ausdauer-Leiste, die es gibt

| Baustein | Ort | Inhalt |
|---|---|---|
| Vorrat | `KRAFT_VON()` `:18975` | `kraftBasis + (STEHEN·0,7 + ROBUST·0,3)·kraftSpanne` |
| Initialisierung | `:19599` | `L.reserveMax=KRAFT_VON(L); L.reserve=L.reserveMax` |
| Zehrung je Tick | `:20006-20030` | `zehr=(0,55 + über²·1,9)`, mal Windschatten, Steigung, Gelände; **×1,15** nach einem Rempler, **×1,4** während `stolper`, **×0,4** beim Stehen am Hindernis |
| Abzug Durchbruch | `:20132` | `−wuchtKraft` (Takeshi 14) |
| Abzug Sturz | `:20152` | `−stolperKraft` (Takeshi 9) |
| **Abzug Tackle** | `:20300` | `o.reserve −= 18`, dazu `o.stolper=0,55+stark·0,9`, `o.getackelt++` |
| Abzug Wechselpatzer | `:20383` | `naechster.reserve −= 12` |
| Leerstand | `:20031-20035` | `u.leer=true`, Schwebetext „eingebrochen", Ticker-Zeile |
| Tempowirkung | `tempoVon` `:19806` | `leer = 0,74 + STEHEN·0,0012` — ein Leerer läuft rund ein Viertel langsamer |
| Anzeige auf der Leinwand | `:20786-20793` | 26 px breiter Balken unter den Füßen, grün → orange unter 20 % → rot bei leer |
| Anzeige im Boxscore | `:19064`, `:19102` | Spalte „Res" — „Kraftreserve", in Prozent |

Dazu kommt bei Takeshi eine **zweite** Ressource, das Nervenkostüm: `nervenMax = STEHEN·2,2`
(`:19600`), Kosten je Sturz `nervenKosten = 27` gedämpft durch ROBUST (`:20170`), Ausscheiden bei
`nerven<=0` (`:20172-20193`), Tempodämpfer schon davor (`:19810`:
`nerv = 0,78 + 0,22·nerven/nervenMax`) — **und, als einzige Regeneration im ganzen Motor,
`nervenRegen` (`:19947-19948`): `u.nerven += WENDIGKEIT·0,05·dt`.**

### 5.2 Wie stark das heute wirklich greift (gemessen, je 24 Rennen)

| Disziplin | Restreserve im Ziel (Median) | Läufer, die leerlaufen | ausgeschieden | Renndauer (Median) |
|---|---:|---:|---:|---:|
| **takeshis-castle** | **2,8 %** (0 bis 51,8) | **44,8 %** | **14,2 %** | 28,5 s |
| climbing | 0,0 % (0 bis 47,3) | 73,3 % | 0 % | 16,6 s |
| spurt | 37,5 % (0 bis 55,8) | 7,3 % | 0 % | 16,8 s |
| time-trial | 32,3 % (0 bis 58,8) | 8,3 % | 0 % | 19,7 s |
| **staffel** | **88,3 %** (77,4 bis 92,9) | **0,0 %** | 0 % | 12,1 s |

Das liest sich in einem Satz: **bei Takeshi und Klettern entscheidet die Ausdauer bereits das
Rennen, bei Spurt und Zeitfahren ist sie ein Randfaktor, bei der Staffel ist sie reine
Dekoration.** Genau dort liegt die Streuung, die Chris' Auftrag adressierbar macht.

### 5.3 Was auf der Bahn fehlt — und es ist genau Chris' Satz

1. **Keine Regeneration.** `u.reserve` kennt sechs Abzüge und keine einzige Gutschrift. Der
   Grundzehr hat einen **Boden von 0,55** (`:20006`) — wer langsamer läuft, zehrt weniger, aber
   niemals null, und füllt nie nach. „man lädt in pausen etwas auf oder wenn man weniger rennt"
   ist der fehlende Teil.
2. **`u.leer` ist eine Sperrklinke.** Einmal gesetzt, nie gelöscht (`:20031`). Wer einbricht, bleibt
   eingebrochen, egal wie langsam er den Rest läuft. „dass er ggf. mal pause machen muss" hat heute
   keinen mechanischen Gegenwert.
3. **Die Kachelleiste zeigt das Falsche.** `hp:1-x.pos` (`:22440`) — die Führenden haben die leerste
   Leiste, und der Tooltip sagt „Leben". Wer auf die Kaderleiste schaut (und das ist die Fläche,
   die stillsteht, während die Figuren laufen), sieht eine invertierte Fortschrittsanzeige im
   Gewand einer Lebensanzeige.
4. **Der Balken unter den Füßen ist unbeschriftet.** Er sieht aus wie eine Lebensleiste, heißt
   nirgends „Ausdauer", und die einzige Stelle, an der das Wort fällt, ist der Kommentar im Code.

### 5.4 Und das Wichtigste: der Tackle kostet dort schon Ausdauer

`:20296-20310`, Spurt und Takeshi — beide `tackle:true`, `:18458` bzw. `:18811`:

```js
const stark=u.WUCHT/(u.WUCHT+o.ROBUST);
if(rr()<stark){
  o.stolper=0.55+stark*0.9; o.reserve=Math.max(0,o.reserve-18); o.getackelt++;
  …
}
```

**Das ist Chris' Satz „verliert was wenn man tacklet oder getackled wird je nachdem welcher spieler
stärker war", wörtlich, im Code, seit Monaten — nur im falschen Chassis.** `stark` ist genau der
Stärkevergleich, den er meint; was fehlt, sind die Kosten beim Tackler selbst (heute trägt der nur
`u.kraft`, einen Tempo-Malus, `:20253`) und die Regeneration.

Das Hockey-Konzept unten ist deshalb bewusst als **Übersetzung dieser Bauform** formuliert und
nicht als neue Idee.

---

## 6. Konzept A (Hockey): die Ausdauer-Leiste

### 6.1 Grundsatz

Eine neue Größe je Feldspiel-Einheit, mit eigenem Namen, eigenem Feld, keiner Berührung mit `hp`:

```
u.kraft     laufender Vorrat  (Feldname noch offen — u.kraft ist auf der Bahn belegt,
u.kraftMax  Vorrat zu Beginn   Vorschlag: u.puste / u.pusteMax, s. offene Frage 11.6)
```

`HK_KRAFT_BASIS` und `HK_KRAFT_SPANNE` analog zu `KRAFT_VON()`, gespeist aus **AUSDAUER** — dem
Sub-Skill, den Hockey bereits führt (`battle-mode.rezepte.js:469`:
`AUSDAUER: {stamina:57, health:20, will:19, spirit:4}`).

**Warum ausgerechnet AUSDAUER, und warum das mehr ist als Kosmetik:** AUSDAUER hat im Eishockey
heute **genau einen** mechanischen Kanal, nämlich den `wucht`-Kontrast im Bodycheck, und die
Sondierung misst dafür **4,4 % mechanisches Gewicht** (`hockey-mechanik-angleichen.md`,
Sondierungstabelle nach B1-6). Zum Vergleich: in Basketball ist AUSDAUER laut eigenem
Rezept-Kommentar „mechanisch tot", und `hockey-rollout-plan.md` Abschnitt 6.4 nennt genau diesen
Zustand als Deckel auf der Validität („tote Kanäle deckeln die Validität, nicht die
Zuverlässigkeit"). Eine Ausdauer-Leiste gibt dem Wert einen **zweiten, sichtbaren** Kanal. Das ist
gleichzeitig die Chance und das Risiko dieser Runde (Abschnitt 10).

### 6.2 Was zehrt

Vorschlag, bewusst in derselben Form wie `zehr` auf der Bahn (`:20006-20030`) — pro Tick, mit
Faktoren statt Sonderfällen:

| Posten | Vorschlag | Begründung / Vorbild |
|---|---|---|
| Grundzehr | `HK_ZEHR_BASIS` je Sekunde auf dem Eis | Bahn `0,55` |
| Tempo | `× (1 + HK_ZEHR_TEMPO · tempoMul)` | wer sprintet, zahlt überproportional; `tempoMul` steht in `bewegeSpielerLive` schon bereit (`:9835-9838`) |
| Fastbreak | Aufschlag, solange `fsLive.fastbreak.seite === u.side` | `startFastbreak` `:9072`, 3 s Fenster |
| Puckführung | kleiner Aufschlag bei `u.hatBall` | „Puck tragen kostet" — reale Entsprechung, sichtbarer Anreiz zum Abspielen |
| Strafbank | **kein** Zehr, volle Regeneration | `aufDemEis(u)` existiert bereits (`:6467`) |
| **Check GEBEN** | fester Abzug `HK_CHECK_GEBEN` | Chris: „verliert was wenn man tacklet" |
| **Check NEHMEN** | fester Abzug `HK_CHECK_NEHMEN`, **skaliert am Stärkeverhältnis** | Chris: „je nachdem welcher spieler stärker war" |
| gescheiterter Check | halber `HK_CHECK_GEBEN` | ein ins Leere gegangener Körpereinsatz kostet auch |
| Bandenduell verloren | kleiner Abzug | `HK_DUELL_TAUMEL` gibt es schon (`:10105-10106`), die Ausdauerseite fehlt |

**Die Formel für „je nachdem welcher spieler stärker war" braucht keine neue Kontrastgröße** — sie
steht schon da. `wucht` liest `decker.ABWEHR − traeger.AUSDAUER`. Vorschlag, denselben Kontrast
einmal weiterverwenden statt eine zweite Skala zu erfinden:

```
kontrast = clamp(-1, +1, (decker.ABWEHR - traeger.AUSDAUER) / HK_CHECK_KONTRAST_SKALA)

Getroffener zahlt:  HK_CHECK_NEHMEN * (1 + HK_CHECK_KONTRAST_W * kontrast)
Checkender zahlt:   HK_CHECK_GEBEN  * (1 - HK_CHECK_KONTRAST_W * kontrast)
```

Mit `HK_CHECK_KONTRAST_SKALA = 40` (die real gemessene Spanne zwischen den Extremwerten der
Kader-Familie ist 29-75 in ABWEHR und 21-75 in AUSDAUER) und `HK_CHECK_KONTRAST_W ≈ 0,5` liegen die
Kosten bei einem klaren Kräfteunterschied rund 50 % über bzw. unter dem Mittelwert. Alle drei
Konstanten sind **Platzhalter im Sinne des Repos** — sie gehören gegen die Messung in Abschnitt 10
gezogen, nicht gesetzt.

**Größenordnung als Anker, nicht als Entscheidung:** damit die Leiste über ein 240-s-Spiel
überhaupt eine Kurve zeichnet, sollte der Grundzehr allein grob 40-60 % des Vorrats kosten und die
16 Checks je Spiel zusammen rund 15-25 %. Damit endet ein normaler Feldspieler bei 20-40 % Rest, ein
Spieler, der viel gecheckt wurde, bei nahe null. Das ist bewusst **weniger dramatisch als Takeshi**
(dort Median 2,8 % Rest, 44,8 % laufen leer, Abschnitt 5.2) — Eishockey soll nicht im Einbruch
enden, sondern im Nachlassen.

### 6.3 Was auflädt

Chris nennt zwei Quellen. Beide haben im Code bereits eine Stelle:

1. **Die Drittelpause.** `FELDSPIEL_ART.hockey.live = {perioden:3, periodenDauer:80,
   periodenPause:1.0, …}` (`:4894`), die Pause selbst läuft über
   `starteViertelpause`/`fsLive.viertelpause` (`:7816`, `:7859`). **Achtung, gelernte Falle:** der
   Kommentar bei Basketball (`:4566-4578`) dokumentiert, dass eine **längere
   Simulationspause nicht bit-identisch** ist — die zusätzlichen Leerlauf-Ticks schieben den
   deterministischen Zufallsstrom weiter, gemessen 0,772 → 0,771. Die Aufladung darf deshalb
   **nicht** über eine verlängerte Pause laufen, sondern als **einmalige Gutschrift beim
   Drittelwechsel** (`HK_KRAFT_PAUSE`, Vorschlag 25-40 % von `kraftMax`). Kein neuer Tick, kein
   neuer `rr()`.
   Die von Chris separat beauftragte **interaktive Pause** (Vorbild und Ist-Analyse:
   `basketball-doppeln-taktik-pause-recherche-06-09.md`) ist der natürliche Ort, an dem diese
   Gutschrift für den Spieler **sichtbar und beeinflussbar** wird — das entwerfe ich hier
   ausdrücklich nicht, ich benenne nur die Naht.
2. **„wenn man weniger rennt".** Übersetzt in ein konkretes Sim-Signal: Regeneration immer dann,
   wenn ein Spieler **nicht aktiv ist** — messbar an drei Zuständen, die alle schon existieren:
   - `dist(u, Zielposition) < ε` und kein Puck in Reichweite → er steht auf seinem Slot
     (`fsIdlePos`/`zuordneSlots`),
   - `!aufDemEis(u)` → Strafbank (`:6467`),
   - `fsLive.viertelpause` läuft.

   Vorschlag: Netto-Rechnung statt zweier Töpfe, exakt das Muster, das
   `fatigue-saisonlaenge-plan.md` B.4 für die Saison-Fatigue eingeführt hat (dort
   `MATCHDAY_ACTIVE_RECOVERY` gegen `MATCHDAY_FATIGUE_LOAD`): eine konstante
   `HK_KRAFT_REGEN` je Sekunde wird **immer** gutgeschrieben, die Zehrposten stehen dagegen. Ein
   Spieler, der steht, gewinnt; einer, der sprintet, verliert; einer im Normaltempo bleibt fast
   stehen. **Damit ist die Leiste keine Sperrklinke** — der Fehler, den 5.3 auf der Bahn und
   `fatigue-saisonlaenge-plan.md` B.2 in der Saison beschreiben, wird nicht wiederholt.

### 6.4 Was niedrige Ausdauer tut

Drei Wirkungen, alle an bestehenden Termen, keine neue Zustandsmaschine:

| Wirkung | Ort | Vorschlag |
|---|---|---|
| **langsamer** | `bewegeSpielerLive` `:9838`: `tempoPx=(230+(u.LAUFTEMPO-50)*0.70)*tempoMul*(u.hatBall?dribbelFaktor:1)` | einen Faktor `pusteTempo = HK_KRAFT_TEMPO_MIN + (1-HK_KRAFT_TEMPO_MIN)·(kraft/kraftMax)` anhängen; Vorbild `leer`/`nerv` in `tempoVon` (`:19806`, `:19810`). Vorschlag `HK_KRAFT_TEMPO_MIN ≈ 0,85` — spürbar, aber kein Bahn-Einbruch |
| **leichter umzuwerfen** | `versucheSteal` `:9001` | `wucht` liest heute `traeger.AUSDAUER`. Vorschlag: **effektive** Ausdauer `AUSDAUER · (0,7 + 0,3·kraft/kraftMax)` statt des Rohwerts — der müde Mann fällt leichter, der frische steht. Die Formel selbst bleibt, es wechselt nur das Argument |
| **verliert Zweikämpfe** | Bandenduell/loser Puck `:10098-10103` (`gewichtetesLosNach(… losGewicht(k.ZWEITCHANCE) …)`) | denselben Faktor multiplikativ ins Gewicht |

**Was ausdrücklich NICHT angefasst wird:** Schuss und Pass. `hockeySchussAusgang`, `technik`,
`pTor` und die Passqualitäts-Kette bleiben unberührt. Der Grund ist nicht Vorsicht, sondern die
Messbank: die Erfolgskurve ist gegen Torzahl und Fangquote kalibriert
(`miss-hockey-korridor.mjs`, `HK_TOR_SKALA`), und ein Ausdauerterm dort würde beides verschieben und
zwei Kalibrierungen gleichzeitig aufrollen.

### 6.5 Was die Leiste ersetzt (UI)

Zwei Orte, beide klein:

1. **Die Kachelleiste `.kbar`** (`renderKader` `:22452-22457`, CSS `battle-mode.css:349-353`). Statt
   `hp: punkte` künftig `hp: u.kraft, max: u.kraftMax` für Feldspiel-Disziplinen mit
   Ausdauer-Modell. Der Tooltip muss mit (`„… — 64 % Ausdauer"` statt `„… — 2 von 3 Leben"`).
   **Der Torstand darf dabei nicht verschwinden** — er steht heute nur in dieser Leiste. Vorschlag:
   die Tore wandern als Zahl neben den Namen (die Kachel hat mit `kkkopf` bereits eine
   Zeile dafür, `:22450`). Das ist gleichzeitig die Reparatur von 4.2: eine Zahl „2" ist lesbarer
   als ein Balken mit drei Stufen.
2. **Ein Balken unter den Füßen auf der Leinwand**, exakt der aus `:20786-20793` — 26 px, 3 px hoch,
   grün / orange unter 20 % / rot. Damit sehen Bahn und Feldspiel gleich aus, und der Zuschauer
   lernt die Leiste **einmal** für das ganze Spiel.

Der produktive React-Renderer ist davon **nicht** betroffen: Hockey läuft in der Battle Arena über
denselben Motor (`FoundationBattleArenaHost.tsx` lädt `battle-mode.html` samt Engine direkt, kein
iframe), und der native `rink`-Primitive in
`app/foundation/discipline-stage/arena/disciplines/rink.tsx` zeigt Team-Token auf einem Eisrink,
keine Spielerleisten — geprüft, dort kommt weder `hp` noch ein Balken vor. Es braucht also **keine
Variante einer React-Health-Bar**; die einzige React-Komponente mit einem HP-Balken ist
`shared.tsx:634` (`duelhp`), und die gehört Mini-DM.

### 6.6 Abgrenzung zur Saison-Fatigue — die Frage, die Chris selbst gestellt hat

„nicht zu verwechseln mit unserer fatigue ich meine speziell für die diszi." Nachgeprüft, wie weit
die beiden heute überhaupt zusammenhängen:

| | Saison-Fatigue | neue Disziplin-Ausdauer |
|---|---|---|
| Ort | `lib/fatigue/fatigue-injury-service.ts` | `battle-mode.engine.js`, Feldspiel-Einheit |
| Zeitachse | Spieltage einer Saison | 240 Sekunden eines Spiels |
| Wirkung | Abzug auf den **Score** vor dem Spiel (`fatiguePenalty`, `lib/foundation/discipline-stage/discipline-stage-data.ts:80`) + Verletzungswurf | Tempo, Zweikampf, Check-Widerstand **im** Spiel |
| Sichtbar als | Prozentzahl im Kader/Training | Balken unter dem Spieler |
| **Berührung** | **keine** | **keine** |

**Nachgemessen, nicht vermutet:** der Kader-Adapter
(`lib/foundation/battle-arena/arena-kader-adapter.ts:20-55`) übergibt dem Motor genau
`{n, id, c, r, sub, tp, tn, d, groesse, a}` — **kein `fatigue`-Feld**. Der Motor kennt die
Saison-Fatigue also nicht und kann sie nicht doppelt zählen. Die Saison-Fatigue wirkt **vor** dem
Spiel auf den Score, die neue Ausdauer **im** Spiel auf die Bewegung; sie treffen sich an keiner
Zeile.

**Eine echte, kleinere Überschneidung bleibt und gehört benannt:** beide hängen mittelbar am
Attribut `stamina`. Im Hockey-Rezept sitzt `stamina` in AUSDAUER (57) und LAUFTEMPO (66)
(`battle-mode.rezepte.js:469`, `:479`); in der Saison-Fatigue steckt es indirekt über die
Trainings-/Erholungslogik. Das ist kein Doppelzählen derselben Zahl, aber es heißt: **ein
stamina-lastiger Spieler wird durch diese Runde in zwei Systemen gleichzeitig besser.** Das ist
vertretbar (es ist dasselbe, was das Attribut bedeutet) — aber es ist der Grund, warum der
Rangtreue-Test in Abschnitt 10 nicht optional ist.

### 6.7 Was das Konzept ausdrücklich nicht tut

- **Kein Wertposten für Checks.** `feldspielWert()` (`:6740`) hat `checks*0,4` bewusst verloren
  (`:6760-6766`), weil Hit-Differenzen real negativ mit Tordifferenzen korrelieren und der Posten
  nur über die geteilte ABWEHR/AUSDAUER-Matrix mit der Eignung korrelierte. Dieses Konzept bringt
  ihn nicht zurück. Der Check bleibt Mechanik und Bild, kein Punkt.
- **Keine Elimination.** Ausdauer 0 heißt langsam und leicht umzuwerfen, nicht raus. Ein
  Eishockeyspiel kennt keinen ausgeschiedenen Feldspieler (außer über die Strafbank, die es
  bereits gibt).
- **Keine Änderung an Torzahl, Fangquote, Schussmechanik** (6.4).

---

## 7. Konzept B (Hockey): Dynamik am Wechsel

Die Ausdauer allein behebt Abschnitt 3.4 nicht. Vier Bausteine, aufsteigend nach Kosten und Risiko;
die ersten zwei berühren keine Mechanik.

**B1 — Der Bodycheck bekommt ein eigenes Wort und eine eigene Farbe.** Heute schreiben Bodycheck
und Stockcheck beide „CHECK!". Vorschlag: der Körpereinsatz behält „CHECK!" in einer **eigenen,
dritten Float-Klasse** (größer, eigene Farbe — die Zeichenstelle `:11051-11065` kennt bereits
`_gross` als Präzedenzfall), der Stockcheck bekommt „POKE!" oder „STOCK!" über eine eigene
Rezeptzeile neben `wortAbwehr`. **Reine Zeichnung, kein `rr()`, bit-identische Rangtreue.** Das ist
der billigste und wahrscheinlich wirksamste Eingriff des ganzen Konzepts: von 103 identischen roten
Texten je Spiel werden 10,5 sofort als eigene Sache lesbar.

**B2 — Der Checkende bekommt eine eigene Pose.** Heute nur `decker.lunge=0.4` (`:8989`), gesetzt
**vor** dem Würfel und damit identisch für Treffer und Fehlversuch. Der Sprite-Apparat kann mehr:
`zeichneSprite` kennt `ani="hurt"` (`:2895`) und eine Angriffs-Pose über `lunge` (`:2756`).
Vorschlag: den Treffer-Zweig einen längeren, eigenen Puls setzen lassen und den Bodycheck-Ton
(`sfx("hockey","treffer")`, `:9032`) behalten. Ebenfalls reine Präsentation.

**B3 — Ein Anlauf statt eines Teleports.** Heute fällt der Check in genau einem Tick, im Median
0,58 s nach dem Besitzwechsel; es gibt keinen Moment, in dem man den Checker kommen sieht. Ein
kurzes **Ankündigungsfenster** (Vorschlag: der Decker, der einen Check startet, fährt für
`HK_CHECK_ANLAUF ≈ 0,3 s` sichtbar auf den Träger zu, mit Tempo-Aufschlag und eigener Pose, und
erst danach fällt der Würfel) macht den Zusammenstoß zu einem Ereignis mit Anfang. **Das ist ein
Mechanikeingriff** — es verschiebt den Zeitpunkt des `rr()`-Wurfs und damit die Zufallsbahn aller
folgenden Ereignisse. Es gehört gemessen (Abschnitt 10) und ist der erste Vorschlag hier, der es
nicht kostenlos gibt.

**B4 — Weniger, aber längere Ballbesitze.** Der eigentliche Grund für „hin und her" ist 111,9
Seitenwechsel und 1,15 s Puckbesitz. Das ist **kein Bug** — es ist die Folge einer bewusst hohen
Ereignisdichte (CLAUDE.md: „dreizehnfache NHL-Ereignisdichte je Minute"), die wiederum die
Rangtreue trägt (Verlässlichkeit 0,755). **Hier zu drehen heißt, an der Abnahmezahl zu drehen**,
und CLAUDE.md sagt klar: an der Uhr arbeiten hilft nicht. Ich schlage es deshalb **nicht** vor,
sondern lege es als offene Frage 11.4 hin. Es ist die einzige Änderung, die Chris' erste
Beobachtung an der Wurzel trifft, und gleichzeitig die einzige, die die Abnahme wirklich gefährden
kann.

### 7.1 Was ein Zuschauer danach anders sieht

Beides zusammen erzählt eine Geschichte, die es heute nicht gibt:

Ein Verteidiger mit hoher ABWEHR und voller Ausdauer sieht den Gegner an der Bande kommen, **fährt
sichtbar an** (B3), setzt den Körper — ein großer, andersfarbiger „CHECK!" (B1), die Stoßpose (B2),
der dumpfe Ton —, der Angreifer geht zu Boden, **und beide Ausdauerleisten sacken sichtbar ab**,
die des Getroffenen deutlicher, weil er der Schwächere war (6.2). Der Puck liegt frei; die
checkende Mannschaft holt ihn in drei von vier Fällen (gemessen: 77,4 %) und geht in den
Gegenangriff. Zwanzig Sekunden später ist derselbe Verteidiger merklich langsamer (6.4), und im
Drittelwechsel füllt sich seine Leiste wieder (6.3).

Das ist genau die Kette, die Chris beschreibt — und sie besteht überwiegend aus Teilen, die schon
da sind: der Check, der Sturz, der lose Puck, der Gegenangriff. Was fehlt, sind der Anlauf, ein
eigenes Bild und eine Leiste, die die Kosten zeigt.

---

## 8. Was der ehrlichere Teil der Antwort ist

Damit es nicht zwischen den Tabellen untergeht, in einem Absatz:

**Chris' zweite Meldung (Ausdauer) ist vollständig berechtigt und im Hockey sogar dringlicher, als
er es formuliert — die Leiste zeigt Tore und steht bei sechs von zehn Kacheln das ganze Spiel auf
null. Seine erste Meldung ist zur Hälfte berechtigt: „ich sehe keine checks" stimmt, „es gibt zu
wenige" nicht.** Wir checken je Kopf häufiger als die NHL und fünfmal so oft je Spielminute. Was
fehlt, ist nicht Häufigkeit, sondern Unterscheidbarkeit — und ein Spielrhythmus, in dem ein Wechsel
von Offense auf Defense überhaupt als Wechsel lesbar ist. Wer auf diese Meldung mit „mehr Checks"
antwortet, macht das Spiel lauter und nicht klarer, und riskiert dabei eine Abnahmezahl, die bei
0,669 ohnehin schon unter der Schranke liegt.

---

## 9. Verallgemeinerung: Takeshi's Castle und die Bahn-Familie

### 9.1 Takeshi's Castle — der von Chris ausdrücklich benannte Fall

**Befund zuerst: Takeshi hat die Ausdauer-Leiste schon, und sie entscheidet dort bereits das
Rennen.** Gemessen (5.2): Restreserve im Ziel Median **2,8 %**, **44,8 %** aller Läufer brechen ein,
**14,2 %** scheiden über die Nerven aus. Der Balken unter den Füßen (`:20786`) IST die Ausdauer. Was
Chris vermisst, sind also drei konkrete Dinge, nicht die Leiste:

| Chris' Wort | Ist-Zustand | Vorschlag |
|---|---|---|
| „die health bar … soll ne ausdauer sein" | ist sie schon (`u.reserve`), aber unbeschriftet; die **Kachelleiste** zeigt dagegen `1-pos` mit Tooltip „Leben" (`:22440`, `:22457`) | Kachelleiste auf `reserve/reserveMax` umstellen, Tooltip „Ausdauer", Reststrecke als Prozentzahl neben den Namen |
| „die sich bissl wieder auflädt" | **gibt es nicht** — `reserve` kennt sechs Abzüge, null Gutschriften; `zehr` hat einen Boden von 0,55 (`:20006`) | `BA().kraftRegen` je Tick, wie `nervenRegen` (`:19947`) bereits eines hat; stärker, wenn der Läufer unter seinem Plantempo läuft oder am Hindernis wartet (`u.huerde>0` zehrt heute noch 40 %, `:20029`) |
| „dass er ggf. mal pause machen muss" | **hat keinen Gegenwert** — `u.leer` ist eine Sperrklinke (`:20031`), langsam laufen bringt nichts zurück | `u.leer` löschen, sobald `reserve` wieder über einer Schwelle steht (Vorschlag 20 %), mit eigenem Schwebetext („fängt sich") |
| „oder langsamer wird" | **gibt es schon**, zweifach: `leer = 0,74 + STEHEN·0,0012` (`:19806`) und `nerv = 0,78 + 0,22·nerven/nervenMax` (`:19810`) | unverändert lassen — die Wirkung ist da, nur die Ursache war nicht lesbar |

**Die Verbindung zu `fallenAusgang()`, wie beauftragt.** `fallenAusgang(i)` (`:17795-17805`) ist
heute eine **reine Lesefunktion** für die Zeichnung: sie holt `u.fallen[…].aus`
(`'sauber'`/`'durchbruch'`/`'sturz'`) und lässt `zeichneFalleTakeshi` die Falle darauf reagieren —
Mauerstücke wackeln bei Durchbruch, der Trittstein kippt bei Sturz, die Papiertür schwingt bei
Sauber auf. Der Kommentar betont ausdrücklich: „schreibt selbst nichts zurueck, kein rr()-Aufruf,
kein Einfluss auf wert()/Burgpunkte."

Die **Ausdauerseite** dieser drei Ausgänge existiert bereits und ist asymmetrisch:

| Ausgang | wo | Ausdauerkosten heute |
|---|---|---|
| `sauber` | `:20128` `if(rr()<=technik)continue;` | **0** |
| `durchbruch` | `:20130-20139` | `−wuchtKraft` (Takeshi 14) + `stolper` 0,20 s (und dessen `zehr ×1,4`) |
| `sturz` | `:20140-20152` | `−stolperKraft` (Takeshi 9) + `stolper` 0,80-1,75 s + `−nervenKosten` (27, gedämpft durch ROBUST) |

Das ist inhaltlich schon Chris' Idee: ein Hindernis mit Gewalt zu nehmen kostet mehr Kraft als ein
Sturz, ein Sturz kostet dafür Nerven und viel Zeit. Was fehlt, ist die **Gegenrichtung** — dass
**niedrige** Ausdauer die Ausgänge beeinflusst. Genau die ist heute nicht verdrahtet: `technik` und
`wucht` (`:20128`, `:20130`) lesen nur `u.TECHNIK` bzw. `u.WUCHT`, nie `u.reserve`.

**Und genau hier halte ich ausdrücklich an.** Die Einfügestelle ist sauber und billig
(ein Faktor auf `technik`/`wucht`, analog zum `nerv`-Faktor in `tempoVon`), aber sie **ist** eine
Änderung an Takeshis Hindernis-Wahrscheinlichkeiten, und an denen arbeitet parallel eine andere
Runde (Hindernis-gegen-Tempo-Aufteilung, Rennspannung/Aufholjagden). **Dieses Dokument schlägt
keinen Koeffizienten vor und rührt Takeshis Eignungsformel nicht an.** Die Ausdauer-Leiste ist
hier als **additive Präsentations- und Rhythmus-Schicht** gedacht, die auf jedem Balancestand
funktioniert. Ob und wie stark die Ausdauer auf `technik`/`wucht` zurückwirkt, ist offene Frage
11.7 und gehört mit der parallelen Runde zusammen entschieden, nicht neben ihr.

### 9.2 Staffel — der größte ungenutzte Spielraum

Gemessen: Restreserve im Ziel **88,3 %**, niemand läuft je leer, 12,1 s Renndauer. **Die Leiste ist
dort heute reine Dekoration.** Gleichzeitig hat die Staffel die einzige Stelle im ganzen Motor, an
der ein Ausdauerabzug an eine **Übergabe** gekoppelt ist: `naechster.reserve -= 12` beim
Wechselpatzer (`:20383`), dazu `naechster.stolper = verlust` (`:20362`), das den Annehmenden auf 35 %
Tempo setzt (`:19795`) und `zehr ×1,4` kostet.

Skizze: `kraftBasis` von 230 (`:18721`) senken oder den Grundzehr über die kurze Renndauer anheben,
bis der Schlussläufer wirklich um seine Reserve läuft — plus Regeneration während der Wartezeit in
der Wechselzone (die Läufer stehen dort mechanisch ohnehin still). Dann entsteht genau das Bild,
das eine Staffel ausmacht: der Startläufer geht voll, der Schlussläufer erbt ein Rennen und muss
damit haushalten. **Risiko ist hier am größten**: Staffel hat mit **rho 0,915** die beste Rangtreue
des ganzen Feldes, und deren Spannweite ist mit 0,089 klein. Nichts anfassen ohne Messung.

### 9.3 Spurt

Restreserve 37,5 %, 7,3 % laufen leer, `tackle:true` (`:18458`) — der Rempler (`−18 reserve`,
`:20300`) ist hier bereits vollständig Chris' Tackle-Modell. Was fehlt, ist dieselbe Regeneration
wie überall und die Kostenseite **beim Rempler selbst** (er trägt heute nur `u.kraft`, einen
Tempo-Malus, `:20253` — Chris' „verliert was wenn man tacklet" ist die Kraftseite, die dort fehlt).
Rho 0,871 [0,236] — die große Spannweite macht hier jede Messung unscharf, also besonders sorgfältig.

### 9.4 Time-Trial

Restreserve 32,3 %, 8,3 % leer, `tackle:false`, dafür **zonale Steigung** (`gelaendeZehrFaktor`,
`:19770-19773`) — die Ausdauer ist dort schon die inhaltlich richtige Größe („beim Zeitfahren
entscheidet der Haushalt"). Hier reicht vermutlich **Regeneration in den Abfahrten** (der
Gelände-Apparat kennt `art:"steigung"` bereits, die Gegenrichtung ist eine Zeile) plus die
Beschriftung. Rho 0,828 [0,087] — die engste Spannweite des Feldes, also die empfindlichste
Messbank.

### 9.5 Climbing (nicht beauftragt, aber die Zahl gehört dazu)

Restreserve im Ziel **0,0 %**, **73,3 %** laufen leer. Klettern ist heute die extremste
Ausdauer-Disziplin des Spiels, und niemand sieht es, weil der Balken nicht beschriftet ist. Wenn die
Sprachregelung aus 9.6 kommt, bekommt Klettern sie gratis mit.

### 9.6 Eine Leiste, drei Chassis

Der eigentliche Gewinn der Verallgemeinerung ist nicht die Mechanik, sondern die **Sprachregelung**:
dieselbe Leiste, an derselben Stelle (unter den Füßen), in denselben Farben (grün → orange unter
20 % → rot), mit demselben Wort („Ausdauer") und derselben Kachelbelegung, in allen
bewegungsintensiven Disziplinen. Heute bedeutet dieselbe Kachelleiste je nach Chassis Reststrecke,
Punkte, Tore oder Leben — vier Bedeutungen, ein Aussehen, ein Tooltip. Das zu vereinheitlichen ist
**null Mechanikrisiko** und behebt Chris' „quatsch" unmittelbar, unabhängig davon, ob die
Mechanikteile jemals gebaut werden.

---

## 10. Risiko und Abnahme

### 10.1 Warum das rho bewegen KANN — und zwar auch ohne Absicht

Hockey steht heute bei **rho je Spiel 0,669 [0,181] / Saison 0,832**, Feldspieler-only **0,719
[0,182] / 0,818** (heute nachgemessen, ziffernidentisch zu
`data/generated/rangtreue-basislinie.json`). Die eingecheckte **CI-Schranke** ist dort
`schranke: 0.054` — `scripts/pruefe-rangtreue-schranke.mjs` wird rot, sobald der Median unter
**0,615** fällt. Die Disziplin ist LIVE (`ARENA_RESOLVED_DISCIPLINE_IDS`, Hockey-Produktivierung
04.09.), jeder Spielstand auf dem Server rechnet damit.

Drei Pfade, über die dieses Konzept die Zahl bewegt, alle real:

1. **`verluste` verschiebt sich.** `feldspielWert()` (`:6740`) zieht `−u.verluste*0.2`, und jeder
   sitzende Check bucht dem Getroffenen einen Verlust (`:9044`). Wird der Check häufiger,
   seltener, oder verteilt er sich anders über die Spieler, wandert Wertmasse.
2. **Die Zufallsbahn verschiebt sich.** Jeder zusätzliche oder verschobene `rr()`-Wurf schiebt alle
   folgenden Ereignisse. Das ist exakt der Grund, an dem der Zoneneintritt gescheitert ist
   (`hockey-zoneneintritt-umsetzung.md`) und der bei Basketballs Pausenlänge gemessen wurde
   (0,772 → 0,771 durch bloße Leerlauf-Ticks, `:4566-4578`). **B3 (Anlauf) und jede
   Ausdauer-Rückwirkung auf `wucht` fallen darunter. B1/B2 und die reine UI-Umstellung nicht.**
3. **AUSDAUER bekommt Gewicht.** Heute 4,4 % mechanisches Gewicht (Sondierung,
   `hockey-mechanik-angleichen.md`). Wenn Ausdauer Tempo, Zweikampf und Check-Widerstand steuert,
   steigt das — und ob das rho hebt oder senkt, hängt daran, wie gut AUSDAUER mit der Eignung
   korreliert. **Das ist der einzige Pfad, der rho auch VERBESSERN kann** (ein toter Kanal weniger,
   `hockey-rollout-plan.md` 6.4), und deshalb der Grund, es überhaupt zu versuchen statt nur die
   Optik zu reparieren.

### 10.2 Abnahmekriterien für den Umsetzungs-PR

Verbindlich, in dieser Reihenfolge:

1. **Vorher/Nachher mit `scripts/miss-alle-disziplinen.mjs 24 hockey`** und zusätzlich **n=48**.
   Das Vorzeichen muss bei beiden Stichprobengrößen halten — dieselbe Prüfung, an der der
   Zoneneintritt gescheitert und die Torwart-Korrektur bestanden hat
   (`hockey-opus-review-nhl.md` 2.2).
2. **Der Median darf nicht unter 0,615 fallen** (CI-Schranke). Fällt er zwischen 0,615 und 0,669,
   ist das formal erlaubt, aber begründungspflichtig: Hockey liegt ohnehin unter der
   0,80-Projektschranke.
3. **`scripts/miss-hockey-korridor.mjs 24` muss den Korridor halten**: Tore je Team um 4,1,
   Fangquote um 89 %, Strafen 2,8. Bewegt sich die Torzahl, hat die Ausdauer an einer Stelle
   gewirkt, an der sie laut 6.4 nichts zu suchen hat.
4. **Eine neue Zeile im Korridor-Skript**: Checks je Team und **Ausdauer-Rest am Spielende**
   (Median, min, max) — sonst ist der neue Balken nicht abnehmbar. Vorbild ist
   `bahnLauf()`s `reserve/reserveMax/leer`-Trio (`:24485`).
5. **Basketball und Football müssen bit-identisch bleiben.** Beide fahren dasselbe
   Feldspiel-Chassis. Jede Änderung gehört hinter `istHockey()` oder hinter ein
   `art.ausdauer`-Feld im Rezept — nicht in den gemeinsamen Pfad. Nachweis:
   `miss-alle-disziplinen.mjs 24 basketball football` ziffernidentisch.
6. **`data/generated/rangtreue-basislinie.json` NICHT stillschweigend neu bauen.** Erst messen,
   dann entscheiden, dann — falls die Änderung bleibt — mit `baue-rangtreue-basislinie.mjs`
   nachziehen und im PR benennen.
7. **Für die Bahn-Disziplinen dasselbe**, je Disziplin einzeln, mit ihren eigenen Schranken
   (staffel 0,915/0,050 · spurt 0,871/0,071 · takeshis-castle 0,861/0,050 · time-trial 0,828/0,050
   · climbing 0,790/0,058).

### 10.3 Vorgeschlagene PR-Reihenfolge

| PR | Inhalt | Mechanikrisiko | Messpflicht |
|---|---|---|---|
| **1** | **UI-Sprachregelung**: Kachelleiste und Tooltip in allen vier Chassis richtig belegen (Hockey: Ausdauer statt Tore, Tore als Zahl; Bahn: Reserve statt `1-pos`), Balken unter den Füßen auch im Feldspiel, Wort „Ausdauer" überall | **null** (keine Zeile Simulation) | Screenshots; `node --check` |
| **2** | **B1 + B2**: eigener Schwebetext und eigene Pose für den Bodycheck, Stockcheck umbenannt | **null** (nur Zeichnung) | bit-identische Rangtreue nachweisen |
| **3** | **Hockey-Ausdauer, Modell ohne Rückwirkung**: Vorrat, Zehr, Regeneration, Anzeige — aber die Leiste steuert noch **nichts** | gering (ein Zähler, kein `rr()`) | Rest-Verteilung messen, Korridor gegenprüfen |
| **4** | **Rückwirkung anschalten**: Tempo, `wucht`-Argument, Zweikampf-Gewicht | **echt** | volle Abnahme 10.2, n=24 UND n=48 |
| **5** | **B3 (Anlauf)**, falls Chris ihn will | **echt** (verschiebt `rr()`) | volle Abnahme |
| **6** | **Bahn-Regeneration** (Takeshi zuerst, dann Staffel), `u.leer` entklinken | **echt** | je Disziplin einzeln |

PR 1 und 2 sind **sofort wertvoll und risikolos** und beheben zusammen den größeren Teil von Chris'
zwei Meldungen. Wenn nur eine Sache gebaut wird, dann diese zwei.

---

## 11. Offene Fragen für Chris — vor der Umsetzung zu entscheiden

1. **Soll Ausdauer die Spielausgänge wirklich beeinflussen, oder erst einmal nur sichtbar sein?**
   PR 3 (nur Anzeige) ist risikolos und erfüllt „man kann den zustand vom spieler ein wenig
   verfolgen". PR 4 (Rückwirkung) erfüllt „langsamer wird", kostet aber eine echte Abnahmerunde auf
   einer Disziplin, die schon unter der Schranke liegt. *Empfehlung: erst 3, messen, dann 4.*
2. **Wie hart soll Hockey-Ausdauer am Spielende sein?** Takeshi endet bei 2,8 % Rest und 44,8 %
   Einbrüchen, Staffel bei 88,3 % und null. Vorschlag Hockey: **20-40 % Rest im Normalfall, kein
   Einbruch als Regelfall** — Nachlassen, nicht Zusammenbrechen. Ist das die gewünschte Härte?
3. **Was passiert bei null Ausdauer?** Vorschlag: dauerhaft langsam und leicht umzuwerfen, aber
   **nie** ausgeschieden. Bestätigen — oder willst du wie bei Takeshi ein sichtbares „ist durch"?
4. **Soll das Spiel insgesamt ruhiger werden?** Heute 111,9 Besitzwechsel und 1,15 s Puckbesitz
   (3.4, Ursache C). Das ist der eigentliche Grund für „viel hin und her gelaufe" — aber es
   anzufassen heißt, an der Ereignisdichte zu drehen, von der die Rangtreue lebt. Ich schlage es
   **nicht** vor. Willst du es trotzdem als eigene Runde?
5. **Der Check gewinnt den Puck heute in 77,4 % der Fälle** (weil der Liegende 0,45 s aus dem
   Wettlauf ist). Real ist das deutlich seltener. Soll das mit? Es ist eine eigene, kleine
   Balance-Frage und gehört nicht in dieselbe Runde wie die Ausdauer.
6. **Wie soll die Größe heißen — im UI und im Code?** „Ausdauer" ist im Spiel bereits der Name
   eines **Sub-Skills** (`AUSDAUER`, Hockey-Rezept) und das deutsche Wort, mit dem die Saison-Fatigue
   in einem Tooltip beschrieben wird. Drei Bedeutungen, ein Wort, ist genau die Verwechslung, vor
   der Chris warnt. Vorschläge: **„Puste"** (klar, unverbraucht, deutsch), „Kraft" (auf der Bahn
   schon `Res`/Kraftreserve, also konsistent), oder „Ausdauer" trotzdem und dafür den Sub-Skill
   umbenennen. *Empfehlung: „Puste" im UI, `u.puste` im Code, Sub-Skill und Saison-Fatigue bleiben,
   wie sie heißen.*
7. **Takeshi: soll niedrige Ausdauer die Hindernis-Ausgänge beeinflussen?** Die Einfügestelle ist
   sauber (`:20128`/`:20130`), aber sie **ist** eine Balance-Änderung an Takeshi — und daran
   arbeitet parallel eine andere Runde. Diese Frage gehört dort mitentschieden, nicht hier.
   *Empfehlung: Takeshi in dieser Runde nur Regeneration + Beschriftung + Kachelleiste, keine
   Rückwirkung auf `technik`/`wucht`.*
8. **Staffel: soll die Ausdauer dort überhaupt beißen?** Heute 88,3 % Rest. Es beißen zu lassen ist
   die inhaltlich schönste Änderung im ganzen Konzept (Schlussläufer muss haushalten) und
   gleichzeitig die riskanteste (rho 0,915, die beste Zahl des Feldes). *Empfehlung: ja, aber als
   letzter PR und mit eigener Messrunde.*
9. **Welche Disziplinen sollen die Leiste bekommen?** Gesetzt: Hockey, Takeshi. Naheliegend:
   Staffel, Spurt, Time-Trial, Climbing (alle haben `reserve` schon). Offen: **Basketball und
   Football** — sie fahren dasselbe Feldspiel-Chassis wie Hockey, und was dort gebaut wird, ist
   dort mit zwei Zeilen anschaltbar. Chris' Wort war „speed diszis … wo man sich fortbewegt", was
   beide einschließen würde. *Empfehlung: erst Hockey beweisen, dann fragen.*

---

## 12. Umsetzungsskizze für den Folge-PR (welche Funktionen, kein Code)

**`public/mockups/battle-mode.engine.js`**

| Funktion / Block | Zeile heute | was dort passiert |
|---|---|---|
| Konstantenblock Hockey | um `:6400-6460` | `HK_KRAFT_*`-Block neben `HK_TAUMEL`/`HK_FOUL_ANTEIL` |
| `bauFeldspiel` / `bauSpieler` | `:5807-5944` | `puste`/`pusteMax` an der Einheit anlegen, neben `taumeltBis`/`downBis` (`:5909`) — **nur** wenn das Rezept es führt, sonst 0 und ungelesen (dasselbe Muster wie `xg`/`xp`) |
| `stepFeldspielLive` | `:9854` ff. | Zehr/Regen je Tick, direkt bei den Körperzuständen (`down`, `strafeBis`) — kein neuer Schleifendurchlauf |
| `versucheSteal`, Bodycheck-Zweig | `:8990-9048` | Abzug für Geber und Nehmer; `wucht` liest effektive statt roher AUSDAUER |
| `bewegeSpielerLive` | `:9838` | ein Faktor an `tempoPx` |
| loser Puck / Bandenduell | `:10098-10103` | ein Faktor in `gewichtetesLosNach` |
| `starteViertelpause` | `:7816` | einmalige Gutschrift beim Drittelwechsel (**keine** längere Simulationspause, `:4566-4578`) |
| Float-Zeichnung | `:11051-11065` | dritte Klasse neben `_def`/`_gross` (B1) |
| `zeichneFeldspiel`, Spielerschleife | `:10805` ff. | Ausdauerbalken unter den Füßen, Bauform von `:20786-20793` |
| `renderKader` | `:22428-22457` | Kachelbelegung und Tooltip je Chassis; Tore als Zahl in `kkkopf` |
| `WERTUNG_HOCKEY` / Boxscore | `:19138` („Chk") | Spalte „Puste" analog zu „Res" (`:19064`) |
| `feldspielProbe` | `:23696` ff. | `puste`/`pusteMax` in die Spielerzeile, damit die Sonde messen kann |
| Bahn: `stepSpurt` Kraftverbrauch | `:20006-20035` | `BA().kraftRegen`, `u.leer` entklinken |
| Bahn: `BAHN_ART` | `:18721` (Staffel), `:18892`/`:18895` (Takeshi) | Regenerations- und ggf. Budget-Konstanten |

**`public/mockups/battle-mode.css`** — `.kbar` bekommt eine Ausdauer-Variante (Farbstufen wie der
Bahnbalken: grün / orange unter 20 % / rot).

**`scripts/miss-hockey-korridor.mjs`** — zwei Zeilen für Checks und Ausdauer-Rest.

**Nicht angefasst:** `lib/**` (die Saison-Fatigue und der Kader-Adapter bleiben unverändert — der
Motor bekommt kein neues Eingabefeld), `app/foundation/discipline-stage/**` (Hockey läuft in der
Battle Arena über den Motor, der native `rink`-Primitive zeigt Team-Token ohne Spielerleisten),
`feldspielWert()` (kein Wertposten für Checks, 6.7).

---

## 13. Was ich nicht geprüft habe

- **Wie stark sich die Zahlen verschieben, wenn das Modell wirklich läuft.** Alle Konstanten in
  Abschnitt 6 sind Platzhalter mit Begründung, kein Fit. Nichts davon wurde gebaut und gemessen —
  das ist ausdrücklich der Inhalt des Folge-PRs.
- **Ob AUSDAUER mit der Hockey-Eignung gut genug korreliert**, um über einen zweiten Kanal die
  Rangtreue zu heben statt zu senken. Das entscheidet PR 4 und ist mit
  `scripts/sondiere-feldspiel-subskills.mjs hockey 24 0` vorab abschätzbar — ich habe es nicht
  gefahren.
- **Die interaktive Pause.** Nur als Naht benannt (6.3), nicht entworfen; sie ist separat
  beauftragt.
- **Takeshis Hindernis-Balance.** Bewusst nicht angefasst (9.1), parallele Runde.
- **Basketball und Football** unter dem neuen Modell. Sie teilen das Chassis; ob das Modell dort
  Sinn ergibt, ist offene Frage 11.9.
- **Die Torwart-Seite.** Ein Torwart hat im Modell oben keinen Zehr. Ob das richtig ist (real ist
  ein Torwart am Ende eines Drittels auch müde) oder ob er eine eigene, sehr flache Kurve braucht,
  ist nicht entschieden.
- **Ein Screenshot-Durchlauf.** Diese Runde hat nur gemessen und gelesen, nicht zugeschaut.

---

## Quellen

- [StatMuse — NHL Hits Per Game Per Team 2024-25](https://www.statmuse.com/nhl/ask/nhl-hits-per-game-per-team-2024-25) (Florida 29,83 bis Dallas/Edmonton ~15,1)
- [Hockey Answered — How long do hockey players stay on the ice?](https://hockeyanswered.com/how-long-do-hockey-players-stay-on-the-ice-a-guide-to-shift-lengths/) (Schichtlänge im Mittel 47 s)
- [HPT — 35–45 Seconds: A Good Shift Length in Hockey](https://hpt.pro/blog/what-is-good-shift-length-hockey/) („shifts over 60 seconds usually signal fatigue"; Ermüdung senkt Tempo und Reaktionszeit)
- [Hockey Graphs — The Usefulness (or lack thereof) of Hit Totals](https://hockey-graphs.com/2015/02/09/the-usefulness-or-lack-thereof-of-hit-totals/) („very little correlation between hitting and winning")
- [Hockey Graphs — Regular season hit differentials and playoff success](https://hockey-graphs.com/2015/02/10/regular-season-hit-differentials-and-the-playoff-success/) (Hit-Differenz verhält sich zur Tordifferenz gegenläufig)
- Projektintern: `CLAUDE.md`, `docs/design/hockey-opus-review-nhl.md`,
  `docs/design/hockey-mechanik-angleichen.md`, `docs/design/hockey-rollout-plan.md`,
  `docs/design/hockey-zoneneintritt-umsetzung.md`, `docs/design/fatigue-saisonlaenge-plan.md`,
  `docs/design/basketball-doppeln-taktik-pause-recherche-06-09.md`,
  `docs/design/messgrundlage-kaderfest.md`, `docs/design/stand-aller-disziplinen.md`,
  `data/generated/rangtreue-basislinie.json`.

---

## Nächster Schritt

**Ein Folge-PR, aber erst nach Chris' Antworten auf 11.1, 11.2, 11.6 und 11.7.** Ohne diese vier
Entscheidungen ist jede Zeile Code geraten.

Sind sie da, schlage ich vor, **PR 1 und PR 2 aus Abschnitt 10.3 zusammen** zu bauen — sie sind
zusammen klein, tragen **null Mechanikrisiko** (keine Zeile Simulation, kein `rr()`, nachweisbar
bit-identische Rangtreue) und beheben den größeren, belegten Teil beider Meldungen:

1. Die Kachelleiste zeigt in allen vier Chassis, was sie behauptet — im Eishockey Ausdauer statt
   Tore (heute bei 60,8 % der Kacheln leer), auf der Bahn die Kraftreserve statt der invertierten
   Reststrecke; der Tooltip sagt nicht mehr „Leben", wo es keine gibt.
2. Der Ausdauerbalken unter den Füßen wandert vom Bahn- ins Feldspiel-Chassis, in derselben
   Bauform und denselben Farben — eine Leiste, drei Chassis.
3. Der Bodycheck bekommt einen eigenen Schwebetext, eine eigene Farbe und eine eigene Pose, der
   Stockcheck ein eigenes Wort. Damit sind 10,5 von 103 roten Texten je Spiel zum ersten Mal als
   das lesbar, was sie sind.

Danach, und nur danach, PR 3 (Ausdauermodell ohne Rückwirkung) mit voller kaderfester Messung
gegen `0,669 [0,181]` und die CI-Schranke `0,615`.
