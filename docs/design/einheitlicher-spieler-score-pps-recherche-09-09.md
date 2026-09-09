# Ein nachvollziehbarer, vergleichbarer Spieler-Score → PPs — Recherche

Auftrag von Chris (wörtlich, 09.09.): „Prüfen ob das generell Sinn macht und es wäre sinnvoll
wenn du für die Spieler einen nachvollziehbaren Score hast der in PPs translated oder direkt
raus kommt. Damit wir nicht bei TDM ein Impact Rating bis 900 oder so haben aber in Schach was
völlig anderes."

**Kurzfassung:** Chris' Sorge ist konkret nachweisbar und real — aber nicht dort, wo sein
Beispiel sie vermutet. Basketball und Speed-Schach (Chris' Gegenbeispiel „Schach") sind bereits
sauber vereinheitlicht: beide laufen durch dieselbe Impact-Kurve auf eine gemeinsame 0–5,5-PPs-
Skala. **TDM dagegen ist genau der Fall, den Chris beschreibt** — ein rohes „Impact"-Feld mit
Deckel bei 900/1400, live im Endstand-Bildschirm sichtbar, das NIE durch die vereinheitlichende
Kurve läuft, weil TDM (wie Battlefield und Mini-DM) noch nicht PPs-produktiv ist. Das Risiko ist
heute latent, nicht akut: Battle Mode läuft für keine echte Saison produktiv (CLAUDE.md), und die
drei betroffenen Disziplinen fallen ohnehin an der Rangtreue durch (rho 0,09–0,39, s.
`docs/design/stand-aller-disziplinen.md`). Der Mechanismus, der das Problem lösen würde, EXISTIERT
bereits und ist an fünf von zwanzig Disziplinen bewiesen — er muss nur auf den Rest angewendet
werden, bevor eine dieser Disziplinen produktiv geht.

---

## 1. Was „PPs" in diesem Spiel überhaupt ist

„PPs" (Performance Points) ist keine einzelne Zahl, sondern zwei Ebenen derselben Größe:

1. **`pointsAwarded`** — ein Wert je Spieler je Spieltag je Disziplin, berechnet in
   `lib/resolve/legacy-matchday-resolve-engine.ts`. Das ist die atomare Einheit.
2. **`ppPow` / `ppSpe` / `ppMen` / `ppSoc`** — die Saison-Summe von `pointsAwarded` über alle
   Disziplinen EINER Achse (Power/Speed/Mental/Social, dieselbe Vierteilung wie
   `DISCS[…].cat` in `battle-mode.engine.js:3314`). Berechnet in
   `lib/foundation/player-rating-contract.ts:236` (`ppPow: roundValue(summary.pointsByArea.power
   ?? 0, 1)`), angezeigt u. a. auf der Spielerkarte
   (`components/foundation/player-portrait-card/FoundationPlayerPortraitCard.tsx:27-33`,
   Kommentar dort: „Saison-PPs je Achse — die zweite Achsenzeile der Karte") und in der
   Spieler-Historie (`components/foundation/player-drawer/PlayerDrawerHistoryTable.tsx:35`,
   Spalte `"pps"`).

Für `pointsAwarded` gibt es **zwei parallele Berechnungswege**, je nachdem, ob die Disziplin
„arena-aufgelöst" ist:

- **Default-Pfad (alle 20 Disziplinen, historisch):** `distributeRankPointsToPlayers()`
  (`legacy-matchday-resolve-engine.ts:768-776`) verteilt den TEAM-Punktwert aus
  `getRankToPointsValue(playerCount, rank)` (`lib/resolve/rank-to-points.ts:118`, gespeist aus
  `references/sheets/rank-to-points.json`) proportional zum `finalContribution`-Anteil jedes
  Spielers am Team. Diese Tabelle kennt **keine Disziplin** — sie kennt nur Kadergröße und
  Team-Rang. Ein Spieler bekommt seinen Anteil an dem, was sein TEAM in der Liga-Tabelle wert
  ist, nicht einen aus seiner Roh-Punktzahl abgeleiteten absoluten Wert. Das macht diesen Pfad
  **von Natur aus disziplinübergreifend vergleichbar**, unabhängig davon, ob die zugrundeliegende
  Roh-Punktzahl 3 oder 3.000 ist.
- **Boxscore-an-PPS-Pfad (nur die 5 arena-aufgelösten Disziplinen, neu, s. Abschnitt 4):**
  ersetzt diesen Default NUR für Spieler mit eindeutig zugeordnetem Battle-Mode-Boxscore-Eintrag
  (`legacy-matchday-resolve-engine.ts:796-809`, `834`) durch einen aus dem rohen
  Boxscore-Wert über eine Impact-Kurve berechneten Wert.

**Befund vorweg:** Der ALTE Default-Pfad war (und ist für 15 von 20 Disziplinen weiterhin) durch
seine Rang/Anteil-Konstruktion praktisch immun gegen Chris' Sorge — er sieht die absolute Skala
einer Disziplin nie. Die Sorge entsteht dort, wo eine Disziplin diesen Pfad verlässt (die 5
arena-aufgelösten) oder wo ein roher Zwischenwert unabhängig von PPs direkt im UI landet (TDM
& Co., s. Abschnitt 3).

---

## 2. „Impact Rating" — wo das Wort tatsächlich im Code steht, und dass es ZWEI komplett
   verschiedene Formeln unter demselben Namen sind

Das Wort „Impact"/„Imp"/„IMP" taucht im UI von **mindestens zwei völlig unabhängigen Formeln**
auf — das ist vermutlich die eigentliche Quelle von Chris' Eindruck, hier gebe es eine
durchgängige, aber inkonsistente Größe:

### 2a. Feldspiel-Familie (Basketball/Hockey/Football) — Spalte „Imp"

`public/mockups/battle-mode.engine.js:15620-15622` (Basketball-Boxscore-Tabelle, live im Spiel
sichtbar):

```
{id:"imp", kopf:"Imp", titel:"Kompositwert — exakt der Wert aus MOTOREN[disc].wert() (feldspielWert), …",
  wert:z=>{const v=feldspielWert(z.u); return v?v:null;}, fmt:v=>v.toFixed(1)}
```

Fußzeile derselben Tabelle (Zeile 15624, wörtlich): *„Impact" ist derselbe Wert, den auch die
Rangtreue-Messung benutzt.* Das ist `feldspielWert(u, disziplin)`, dieselbe Funktion, die
`MOTOREN[fd].wert()` für Basketball/Hockey/Football liefert (`battle-mode.engine.js:21429-21430`).
Ihre reale Skala steht in den gezogenen Referenzen: Basketball `iMittel`/`iKrass` zwischen 33,9
und 97,6 je nach Feldgröße (`data/generated/basketball-pps-referenz.json`), Hockey 22,4–88,7
(`data/generated/hockey-pps-referenz.json`) — beide praktisch **0–100**.

### 2b. Arena-Kampf-Familie (TDM/Battlefield/Mini-DM) — Spalte „IMP" im Endstand

`public/mockups/battle-mode.engine.js:19805-19856`, Endstand-Overlay
(`renderEndstand()`, Zeile 20612 ff.):

```js
const IMP_G={schaden:450, kontrolle:170, schild:120, heilung:277, frontlinie:200};
const IMP_R={schaden:650, kontrolle:12,  schild:450, heilung:500, frontlinie:700};
const IMP_STUECK={ko:95, beihilfe:35, tod:70, eigen:1.0, wieder:134, ueberlebt:60};
const IMP_KAPPE={wieder:2, weich:900, weichRest:0.45, hart:1400};
...
function impactVon(u){
  ...
  let w = kampf + nutzen + ueber - abzug;
  if(w>IMP_KAPPE.weich) w = IMP_KAPPE.weich + (w-IMP_KAPPE.weich)*IMP_KAPPE.weichRest;
  return Math.round(Math.min(IMP_KAPPE.hart,w));
}
```

und am Endstand (Zeile 20620-20654): jede Spielerzeile bekommt eine Spalte `"IMP"`, mit
Tooltip „Impact N — woraus er besteht" (`impZerlegung()`). Das ist **exakt Chris' Beschreibung**:
ein weicher Deckel bei **900**, ein harter Deckel bei **1400** — ein Wert, der im normalen
Spielverlauf jedes TDM-/Battlefield-/Mini-DM-Matches sichtbar wird, komponiert aus Schaden,
Ausschaltungen, Beihilfen, Heilung, Schild, Kontrolle, Frontlinie, abzüglich Toden und
Eigenbeschuss — eine Formel, die laut Kopfkommentar (Zeile 19805-19834) aus einem externen
Vorbild „entziffert" wurde, nicht spielintern kalibriert ist.

**Beide Formeln heißen im UI „Impact", messen aber nichts Vergleichbares:** die eine ist ein
Basketball-Boxscore-Kompositwert auf einer ~0–100-Skala, die andere ein Kampf-Overlay-Wert mit
Deckeln bei 900/1400. Das ist wörtlich das Bild, das Chris beschreibt — nur dass beide Zahlen
schon HEUTE nebeneinander im UI vorkommen (in unterschiedlichen Disziplinen, nicht in derselben
Ansicht), nicht erst als hypothetisches Zukunftsrisiko.

**Wichtig, zur Einordnung:** `impactVon()` ist eine **reine Anzeige-Größe** des Endstand-Screens.
Sie fließt nirgends in `MOTOREN["tdm"].wert()` (das ist eine andere Funktion, s. Abschnitt 3) und
nirgends in PPs — weil TDM überhaupt keinen Weg zu PPs hat (s. Abschnitt 5). Sie ist trotzdem
real: ein Spieler, der ein TDM-Match zu Ende spielt, sieht sie, unabhängig davon, ob sie
irgendwo weiterverarbeitet wird.

---

## 3. Die vier Chassis-Familien — was ein Spieler am Ende einer Runde tatsächlich bekommt

`MOTOREN[disziplin].wert()` ist die EINE Stelle, die pro Chassis-Familie definiert, „was besser
heißt" — sie wird von der Rangtreue-Sonde (`disziplinProbe`/`scripts/miss-alle-disziplinen.mjs`)
UND (für die 5 arena-aufgelösten Disziplinen) vom Boxscore-an-PPS-Pfad gelesen. Für die übrigen
15 ist sie NUR die Rangtreue-Sonde — s. Abschnitt 5.

| Chassis | Disziplinen (Beispiele) | `wert()`-Fundstelle | Was zurückkommt | Rohe Skala |
|---|---|---|---|---|
| **Feldspiel** | Basketball, Hockey, Football | `battle-mode.engine.js:21429-21430` (`feldspielWert(u,fd)`) | Boxscore-Kompositwert je Spieler (Punkte, Rebounds, Steals/Blocks gewichtet, Verluste abgezogen) | ~0–100 (Basketball 33,9–97,6; Hockey 22,4–88,7 je Feldgröße, s. Referenz-JSONs) |
| **Bühne — Auftritt** | Eiskunstlauf, Breaking, Wettessen, Showcase | `battle-mode.engine.js:21392` (`u.summe`) | Summe der Durchgangspunkte | disziplinabhängig, unbegrenzt (Showcase 386,5–433 Median, 585–607 p99,5, s. `showcase-pps-referenz.json`) |
| **Bühne — Duell** | Speed-Schach, I-Spy, Tennis, Fechten | `battle-mode.engine.js:21392` (`u.summe`, s. `WERTUNG_DUELL()` Zeile 11979-12001, Spalte „Pkt") | eigene Zugpunkte (NICHT der Vorteil zum Gegner, s. Kommentar 21378-21391 — Fable-Fund, dass „Vorteil" die Rangtreue drückte) | disziplinabhängig, unbegrenzt (Speed-Schach 857–921,5 Median, bis 1220 p99,5, s. `speed-schach-pps-referenz.json`) |
| **Bühne — Heben** | Gewichtheben | `WERTUNG_HEBEN()` Zeile 12037-12059, Spalte „Zwei" | Zweikampf (Reißen+Stoßen), Sinclair-normiert angezeigt | reale kg-Werte, ~350–550 |
| **Bahn** | Staffel, Spurt, Time-Trial, Takeshi's Castle, Climbing | `battle-mode.engine.js:21290-21358` | je nach Unterart: negative Platzierung (`-1..-n`), Etappenzeit+Wechselkonto (Staffel), Burgwertung (Takeshi's Castle) | uneinheitlich: Ordinalzahl, Sekunden oder Punkte, je nach Unterart |
| **Arena (Kampf)** | TDM, Battlefield, Mini-DM | `battle-mode.engine.js:21035-21036` (`beitragVon(x)/Summe*100`) für die Rangtreue-Sonde; **separat** `impactVon()` (Zeile 19841-19856) für den Endstand-Screen | Sonde: Anteil am Gesamtbeitrag (0–100 %). Anzeige: gedeckelter Kompositwert (0–900 weich, bis 1400 hart) | ZWEI verschiedene Werte für dieselbe Disziplin, s. Abschnitt 2b |

**Kernbefund dieses Abschnitts:** Jede Chassis-Familie hat ihre eigene, im Rohzustand
unvergleichbare Skala — das ist unvermeidlich und für sich kein Problem, solange danach IMMER
dieselbe Übersetzung in PPs folgt. Ob das passiert, ist die eigentliche Frage (Abschnitt 4/5).
Die Arena-Kampf-Familie ist zusätzlich der einzige Fall, in dem selbst INNERHALB einer
Disziplin zwei verschiedene Formeln unter ähnlichem Namen kursieren.

---

## 4. Die fünf arena-aufgelösten Disziplinen — bereits vereinheitlicht, und zwar genau so, wie
   Chris es sich wünscht

`lib/resolve/battle-mode-arena-team-points.ts` ist die Stelle, die der Auftrag vermutet hat, und
sie beantwortet Chris' Frage für diese fünf bereits mit „ja, erledigt":

**Der Mechanismus (`ppsAusArenaImpact()`, Zeile 744-756):**

```
PPs = MAX * min(1, (max(0, I) / I_krass)^gamma),  gamma = ln(a_mitte) / ln(I_mittel / I_krass)
```

- `I` ist der rohe `MOTOREN[disziplin].wert()`-Wert dieses Spielers in diesem Duell — exakt
  derselbe Wert aus Abschnitt 3, unverändert.
- `I_mittel`/`I_krass` sind Median und 99,5.-Perzentil einer **je Disziplin UND je Feldgröße
  getrennt gezogenen Referenzverteilung** aus echten Liga-Kadern
  (`data/generated/<disziplin>-pps-referenz.json`, gezogen von
  `scripts/ziehe-<disziplin>-pps-referenz.ts`).
- `MAX` (5,5) und `anteilMitte` (0,25) sind für **alle fünf Disziplinen identisch**
  (`BASKETBALL_INDIVIDUAL_PPS_MAX` … `SHOWCASE_INDIVIDUAL_PPS_MAX`, Zeile 215-309) — dieselbe
  Kurvenform, dieselbe Ziel-Range.

Damit gilt: **egal ob der rohe Input 50 (Basketball), 400 kg (Gewichtheben), 30 (Hockey), 900
(Speed-Schach) oder 430 (Showcase) ist — die resultierende PPs-Zahl liegt für alle fünf auf
derselben 0–5,5-Skala.** Das ist exakt der von Chris verlangte Mechanismus, nur unter einem
anderen Namen und bereits produktiv:

| Disziplin | Roh-Skala (`iMittel`–`iKrass`, Feldgröße 6, bzw. Katalog-Standard) | Referenz-Fundstelle | `max`/`anteilMitte` | PPs-Skala |
|---|---:|---|---:|---:|
| Basketball | 33,9 – ~90 (je Feldgröße) | `data/generated/basketball-pps-referenz.json` | 5,5 / 0,25 | 0–5,5 |
| Gewichtheben | ~350 – 550 kg | `data/generated/gewichtheben-pps-referenz.json` | 5,5 / 0,25 | 0–5,5 |
| Hockey (Feld) | 22,4 – 88,7 | `data/generated/hockey-pps-referenz.json` | 5,5 / 0,25 | 0–5,5 |
| Hockey (Torwart, eigene Referenz) | 8,4 – 22,4 | dieselbe Datei, `feldgroessenTorwart` | 5,5 / 0,25 | 0–5,5 |
| Speed-Schach | 857 – 1220 | `data/generated/speed-schach-pps-referenz.json` | 5,5 / 0,25 | 0–5,5 |
| Showcase | 386,5 – 587 | `data/generated/showcase-pps-referenz.json` | 5,5 / 0,25 | 0–5,5 |

**Warum Hockey eine eigene Torwart-Referenz braucht** (Zeile 358-372, empirisch begründet):
derselbe Rohwert bedeutet für Feldspieler und Torwart bei kleiner Feldgröße das Gegenteil
(Feldspieler-Median 22,4 gegen Torwart-Median 8,4 bei n=3, aber 6,84 gegen 10,22 bei n=6) — eine
gemeinsame Referenz hätte den Torwart systematisch über- oder unterbezahlt. Das ist bereits die
Antwort auf die Frage „was, wenn eine Disziplin strukturell verschiedene Rollen hat" — der
Mechanismus verträgt das, indem er die Referenz nach Rolle UND Feldgröße trennt, nicht die Kurve
selbst ändert.

**Sind diese fünf Skalen untereinander bereits vergleichbar, wie in Auftragspunkt 4 gefragt?**
Ja — durch Konstruktion, nicht zufällig. Die einzige dokumentierte Nebenwirkung betrifft nicht
die Vergleichbarkeit zwischen Disziplinen, sondern eine Asymmetrie INNERHALB einer Disziplin bei
Unterzahl-Duellen (Kommentar Zeile 51-60: die Überzahl-Seite bekommt bei z. B. 3v6 spürbar mehr
PPs als in einem regulären Duell derselben Feldgröße, weil die Referenz nach der gewürfelten,
nicht der tatsächlich gefelderten Größe schlüsselt — von Opus als „erste Umsetzung ohne
Dämpfer, aber dokumentiert" bewusst in Kauf genommen).

**Eine Fail-Fast-Absicherung schützt genau die Gefahr, vor der Chris warnt** (Zeile 469-493): fehlt
für eine arena-aufgelöste Disziplin ein Eintrag in `ARENA_IMPACT_KONFIG_JE_DISZIPLIN`, würde der
Code sonst still auf Basketballs Referenz zurückfallen — und ein Bühnen-Rohwert (z. B.
Speed-Schachs ~1000) gegen Basketballs `iKrass` (~51) normiert würde JEDEM Spieler kommentarlos
die volle Höchstpunktzahl geben. Das Modul wirft deshalb beim Laden einen Fehler, wenn diese
Zuordnung fehlt — eine bereits eingebaute Lehre aus genau Chris' Sorge.

---

## 5. Die übrigen 15 Disziplinen — kein eigener Mechanismus, aber auch kein Vakuum

Für die 15 nicht-arena-aufgelösten Disziplinen (alle außer den fünf aus Abschnitt 4) gilt:

- **Der Default-`pointsAwarded`-Pfad läuft unverändert** (`distributeRankPointsToPlayers()`,
  Abschnitt 1) — rang-/anteilsbasiert, disziplinblind, von Natur aus vergleichbar. **Das ist der
  eigentliche Grund, warum Chris' konkretes Beispiel (Schach gegen TDM in PPs) heute NICHT
  auftritt**, unabhängig von Battle Mode: keine der beiden Disziplinen-Rohskala erreicht PPs
  direkt, außer über diesen gemeinsamen Rang-Umweg.
- **Zwölf von ihnen haben trotzdem bereits einen `MOTOREN[d].wert()` in Battle Mode** (alle außer
  TDM/Battlefield/Mini-DM, die zwar auch einen Motor-Eintrag haben, aber s. Abschnitt 2b) — der
  wird heute NUR von der Rangtreue-Sonde gelesen, nicht von irgendeinem PPs-Pfad. Es gibt für
  diese zwölf **keinen unbenutzten/unverdrahteten PPs-Übersetzungsansatz** — weder eine
  Referenz-JSON noch einen `ARENA_IMPACT_KONFIG`-Eintrag existiert für sie. Der Plan sieht vor,
  dass eine künftige Produktivierung genau den in Abschnitt 4 beschriebenen Mechanismus wiederholt
  (Kommentar `battle-mode-arena-team-points.ts:80-86`: „Das macht jede WEITERE Arena-Disziplin …
  zu einer reinen Konfigurationsänderung … statt eines zweiten Sonderfalls").
- **Drei von ihnen (TDM, Battlefield, Mini-DM) sind zusätzlich an der Rangtreue gescheitert**
  (`docs/design/stand-aller-disziplinen.md` Zeile 169-171: TDM 0,253/0,217, Battlefield
  0,387/0,595, Mini-DM 0,094/0,071 — alle drei „durchgefallen", eingeordnet als
  **Validitätsproblem**, nicht als Verlässlichkeitsproblem: „belohnt die Mechanik das Falsche").
  Für diese drei wäre eine PPs-Normalisierung allein nicht ausreichend — die zugrundeliegende
  `MOTOREN.wert()`-Messung selbst müsste zuerst eine belastbare Rangtreue erreichen, bevor eine
  Impact-Kurve überhaupt etwas Sinnvolles zu normalisieren hätte. Genau diese drei sind aber
  auch die, deren rohes UI-„Impact"-Feld (Abschnitt 2b) bereits sichtbar ist — das Anzeige-Risiko
  besteht unabhängig vom Rangtreue-Status.

---

## 6. Bewertung der Chris-Sorge

| Frage | Befund |
|---|---|
| Gibt es heute zwei unvergleichbare Rohskalen unter dem Namen „Impact" im UI? | **Ja, real.** Basketball-Boxscore „Imp" (~0–100, `feldspielWert()`) und TDM-Endstand „IMP" (0–900 weich/1400 hart, `impactVon()`) sind zwei verschiedene Formeln, beide live sichtbar (Abschnitt 2). |
| Landen diese Rohwerte unnormalisiert in PPs? | **Nein, für keine der 20 Disziplinen** — weder der alte Default-Pfad (rangbasiert) noch der neue Boxscore-Pfad (kurvennormiert) reicht eine rohe Disziplin-Skala direkt an PPs durch. |
| Ist Chris' konkretes Beispiel („TDM bis 900, Schach etwas völlig anderes, beide landen so in PPs") heute technisch möglich? | **Nein, aktuell nicht** — TDM hat überhaupt keinen Weg zu PPs (weder Referenz noch Konfig-Eintrag, Abschnitt 5), Speed-Schach läuft bereits durch die Impact-Kurve auf 0–5,5 (Abschnitt 4). Sein Beispielpaar ist also, technisch genau genommen, kein Gegensatz, der heute in PPs auftreten könnte. |
| Ist die zugrundeliegende Sorge trotzdem berechtigt? | **Ja.** Sie beschreibt exakt das Muster, das im UI schon existiert (zwei „Impact"-Felder mit falscher Familienähnlichkeit), und exakt das Risiko, das entstünde, wenn TDM/Battlefield/Mini-DM ohne den in Abschnitt 4 bewiesenen Mechanismus produktiv würden. |
| Wie groß ist der Schaden heute? | **Klein, weil latent.** Battle Mode läuft für keine echte Saison produktiv (CLAUDE.md); TDM/Battlefield/Mini-DM scheitern ohnehin an der Rangtreue-Schranke und sind damit unabhängig von PPs nicht abnahmefähig. Das Risiko ist eine offene Baustelle, kein akuter Fehler in einem laufenden Spielstand. |

---

## 7. Vollständige Tabelle aller 20 Disziplinen

| Disziplin | Chassis | Aktueller Spieler-Score (Fundstelle) | Rohe Skala | Fließt in PPs? | Bewertung |
|---|---|---|---:|---|---|
| Basketball | Feldspiel | `feldspielWert()`, `battle-mode.engine.js:21429` | ~34–98 | **Ja** — Impact-Kurve → 0–5,5 | konsistent |
| Gewichtheben | Bühne (Heben) | `u.summe` (kg), `WERTUNG_HEBEN()` 12037 | ~350–553 kg | **Ja** — Impact-Kurve → 0–5,5 | konsistent |
| Hockey | Feldspiel | `feldspielWert()`, eigene Torwart-Referenz | ~8–89 (rollenabhängig) | **Ja** — Impact-Kurve → 0–5,5 | konsistent |
| Speed-Schach | Bühne (Duell) | `u.summe`, `WERTUNG_DUELL()` 11979 | ~615–1220 | **Ja** — Impact-Kurve → 0–5,5 | konsistent |
| Showcase | Bühne (Auftritt) | `u.summe`, `WERTUNG_AUFTRITT()` 12006 | ~200–607 | **Ja** — Impact-Kurve → 0–5,5 | konsistent |
| Staffel | Bahn | Etappenzeit+Wechselkonto, `battle-mode.engine.js:21290-21324` | Sekunden, negativ | Teilweise — nur Default-Rangpfad | nicht anwendbar (kein Boxscore-Ansatz, aber Default-Pfad ist disziplinblind) |
| Spurt | Bahn | negative Platzierung, `21357-21358` | -1..-n | Teilweise — Default-Rangpfad | nicht anwendbar |
| Time-Trial | Bahn | negative Platzierung | -1..-n | Teilweise — Default-Rangpfad | nicht anwendbar |
| Takeshi's Castle | Bahn | `burgwertung(u)`, `21344-21351` | Punkte, unbegrenzt | Teilweise — Default-Rangpfad | nicht anwendbar |
| Climbing | Bahn | negative Platzierung | -1..-n | Teilweise — Default-Rangpfad | nicht anwendbar |
| Eiskunstlauf | Bühne (Auftritt) | `u.summe` | disziplinabhängig | Teilweise — Default-Rangpfad | nicht anwendbar (kein Boxscore-Ansatz, aber ungefährlich) |
| Breaking | Bühne (Auftritt) | `u.summe` | disziplinabhängig | Teilweise — Default-Rangpfad | nicht anwendbar |
| Wettessen | Bühne (Auftritt) | `u.summe` | disziplinabhängig | Teilweise — Default-Rangpfad | nicht anwendbar |
| Tennis | Bühne (Duell) | `u.summe` | disziplinabhängig | Teilweise — Default-Rangpfad | nicht anwendbar |
| Fechten | Bühne (Duell) | `u.summe` | disziplinabhängig | Teilweise — Default-Rangpfad | nicht anwendbar |
| I-Spy | Bühne (Duell) | `u.summe` | disziplinabhängig | Teilweise — Default-Rangpfad | nicht anwendbar |
| Football | Feldspiel | `feldspielWert()` (eigene Formel) | disziplinabhängig | Teilweise — Default-Rangpfad | nicht anwendbar (kein Boxscore-Ansatz für PPs, aber Default-Pfad greift) |
| TDM | Arena (Kampf) | Sonde: `beitragVon`-Anteil (0–100 %); Anzeige: `impactVon()` (0–900/1400, s. Abschn. 2b) | 0–1400 (Anzeige) | **Nein** — kein Boxscore-Ansatz, kein Konfig-Eintrag | **inkonsistent** — Chris' Beispiel |
| Battlefield | Arena (Kampf) | wie TDM | 0–1400 (Anzeige) | **Nein** | **inkonsistent** |
| Mini-DM | Arena (Kampf) | wie TDM | 0–1400 (Anzeige) | **Nein** | **inkonsistent** |

„Teilweise" bei den 12 nicht-arena-aufgelösten Bahn-/Bühne-/Football-Zeilen heißt: der
Default-Rangpfad greift und ist selbst konsistent, aber es gibt (anders als bei den fünf
arena-aufgelösten) noch keinen kurvenbasierten Boxscore-an-PPS-Ansatz, der einen individuellen
Battle-Mode-Auftritt in PPs übersetzt — Battle Mode selbst läuft für sie nur als Rangtreue-Sonde,
nicht produktiv.

---

## 8. Kurzer Blick nach außen: wie lösen andere Spiele das?

Football Manager normalisiert nicht über eine globale Formel, sondern über
**positionsspezifische Attributgewichtung**: dieselben Rohattribute werden für jede Position/
Rolle unterschiedlich gewichtet in eine 0–200-Skala (Current Ability) überführt — die
„Übersetzung in eine gemeinsame Skala" passiert also VOR der Aggregation, nicht danach
([Football Manager Player Attributes Explained](https://www.passion4fm.com/football-manager-player-attributes/),
[Players — FM 2024 Manual](https://community.sports-interactive.com/sigames-manual/football-manager-2024/players-r4958/)).
Das ist strukturell dasselbe Prinzip wie die hier bereits gebaute Impact-Kurve: nicht die rohe
Punktzahl vergleichen, sondern jede Disziplin gegen ihre EIGENE, empirisch ermittelte Verteilung
normieren, bevor verglichen wird.

In der Sport-Analytik ist der Standardansatz für strukturell verschiedene Messgrößen der
**Z-Score/Perzentil-Ansatz**: Rohwert minus Populationsmittel, geteilt durch die
Populations-Streuung, optional zu einem Perzentil konvertiert — das erlaubt den Vergleich über
verschiedene Statistiken und sogar über verschiedene Sportarten hinweg
([Z-Scores in Sports](https://community.fangraphs.com/z-scores-in-sports-a-supporting-argument-for-zdefense/)).
Genau das leisten `iMittel`/`iKrass` in diesem Projekt bereits (Median und 99,5.-Perzentil als
Anker) — nur mit einer geglätteten Potenzkurve statt eines linearen Z-Scores, explizit gewählt,
weil Chris einen harten Deckel statt einer Asymptote wollte (Abschnitt 4, Formelkommentar).

Der einzige praktisch relevante Unterschied zu diesem Projekt: sowohl Football Manager als auch
die Z-Score-Literatur normalisieren VOR jeder Anzeige — es gibt dort kein rohes
Zwischenfeld, das im UI landet, bevor die Normalisierung greift. Genau das ist bei TDM (Abschnitt
2b) heute nicht der Fall.

---

## 9. Design-Empfehlung

**Der Mechanismus existiert bereits und muss nicht neu erfunden werden — er muss nur
konsequent angewendet werden, ohne Ausnahme:**

1. **Jede Disziplin, die einen Score im UI zeigt, MUSS entweder (a) durch die bestehende
   `ppsAusArenaImpact()`-Kurve mit einer eigenen, echten `iMittel`/`iKrass`-Referenz laufen, bevor
   sie angezeigt wird, oder (b) klar als reine Zwischen-/Debug-Anzeige gekennzeichnet sein, die
   nie in PPs mündet.** `impactVon()` (TDM/Battlefield/Mini-DM) ist heute keins von beidem — es
   sieht aus wie ein Kompositwert (genau wie Basketballs „Imp"), hat aber keine Referenz und
   keinen Weg zu PPs. Das ist die konkrete Lücke, die zu Chris' Beispiel führen würde, sobald
   diese drei Disziplinen produktiv gehen.
2. **Konkreter Schritt für TDM/Battlefield/Mini-DM, sobald ihre Rangtreue steht:** dieselbe
   Prozedur wie bei Basketball/Gewichtheben/Hockey/Speed-Schach/Showcase wiederholen —
   `scripts/ziehe-<disziplin>-pps-referenz.ts` gegen echte Liga-Kader ziehen (Rohwert = entweder
   der bestehende `beitragVon()`/Anteils-Wert, falls der die Rangtreue-Schranke schafft, ODER ein
   überarbeiteter `impactVon()`, falls die Kampf-Mechanik selbst repariert wird), einen Eintrag in
   `ARENA_IMPACT_KONFIG_JE_DISZIPLIN` ergänzen, die drei Disziplinen in
   `ARENA_RESOLVED_DISCIPLINE_IDS` aufnehmen. Die im Code eingebauten Fail-Fast-Prüfungen
   (Zeile 181-196, 469-493) verhindern bereits automatisch, dass eine Disziplin OHNE eigene
   Referenz durchrutscht und fremde Anker benutzt.
3. **Für die übrigen zwölf, noch nicht arena-aufgelösten Disziplinen (Bahn/Bühne/Football):**
   keine Eile — der Default-Rangpfad ist für sie bereits sicher. Ein Boxscore-an-PPS-Übergang
   lohnt sich erst, wenn Battle Mode für sie ohnehin produktiv werden soll (dieselbe Reihenfolge,
   die Basketball → Gewichtheben → Hockey → Speed-Schach/Showcase bereits durchlaufen hat).
4. **Das UI-Namensproblem separat beheben, unabhängig von PPs:** „Impact"/„Imp"/„IMP" sollte nicht
   für zwei nicht vergleichbare Formeln (Boxscore-Kompositwert vs. Kampf-Overlay-Wert) verwendet
   werden. Ein Spieler, der zwischen einem Basketball- und einem TDM-Match wechselt, sieht heute
   zwei Zahlen mit demselben Namen und keinerlei Hinweis, dass sie nichts miteinander zu tun
   haben. Das ist unabhängig vom PPs-Befund ein Verwechslungsrisiko und günstig zu beheben (z. B.
   TDMs Spalte in „Kampfwert" umbenennen, „Impact" für den bereits rangtreue-gemessenen
   Kompositwert reservieren).

---

## 10. Offene Fragen an Chris

1. **Soll `impactVon()` (TDM/Battlefield/Mini-DM, Deckel 900/1400) langfristig überhaupt die
   Rohwert-Quelle für PPs werden**, oder soll stattdessen der bereits rangtreue-gemessene
   `beitragVon()`-Anteilswert (0–100 %, den die Sonde heute schon nutzt) als Boxscore-Rohwert
   dienen? Beide sind technisch möglich, aber `impactVon()` ist unkalibriert („aus einem Vorbild
   entziffert", Zeile 19812-19815) und misst nicht dieselbe Größe wie die Rangtreue-Sonde —
   `beitragVon()` täte das.
2. **Priorität:** repariert erst die Rangtreue von TDM/Battlefield/Mini-DM (aktuell
   „durchgefallen"), bevor überhaupt eine PPs-Übersetzung für sie sinnvoll ist — oder soll die
   Referenz-Ziehung/Kurve schon jetzt parallel vorbereitet werden, damit sie bereitsteht, sobald
   die Mechanik selbst steht?
3. **Sollen die zwölf noch nicht arena-aufgelösten Bahn-/Bühne-/Football-Disziplinen früher als
   geplant auf den Boxscore-an-PPS-Pfad umgestellt werden**, oder reicht der bestehende
   Default-Rangpfad für sie bis auf Weiteres (er ist, wie in Abschnitt 1 gezeigt, bereits
   disziplinblind und damit unproblematisch)?
4. **Namensfrage:** soll „Impact" als UI-Begriff für ALLE Disziplinen vereinheitlicht werden
   (gleiche Bezeichnung nur für tatsächlich vergleichbare, kurvennormierte Werte), oder ist eine
   Umbenennung des Kampf-Overlay-Felds (Abschnitt 2b) der pragmatischere erste Schritt?
