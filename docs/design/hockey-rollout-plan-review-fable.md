# Review: Hockey-Rollout-Plan (Fable)

Geprüft: `docs/design/hockey-rollout-plan.md` und `scripts/miss-hockey-bestand.mjs` auf
`origin/claude/hockey-rollout-plan` (`0d561e04`, Basis `origin/main` `11c5a4e0`). Alle
Datei:Zeile-Angaben unten sind gegen diesen Stand geprüft. `main` ist inzwischen um #727
(Fatigue-Erholung) weiter; keiner der beiden Plan-Dateien ist davon berührt.

---

## Urteil

**Tragfähig mit Auflagen.** Die Zahlen stimmen (alle sieben Kernwerte selbst reproduziert,
auf die Nachkommastelle), die Code-Behauptungen halten, die Reihenfolge PR 0–3 ist richtig
— aber drei Dinge sind schwerer, als der Plan sie darstellt: der „Einzeiler" PR 9 würde
heute falsche Punkte vergeben, die Pp-Zahl misst zur Hälfte eine Basketball-Buchhaltung
statt der Hockey-Mechanik, und die Torwart-Empfehlung stützt sich auf eine Randbedingung,
die der Plan selbst auf später vertagt.

---

## Was ich selbst nachgemessen habe, was ich nur gelesen habe

**Nachgemessen** (Playwright/Chromium, Worktree-Kopie von `11c5a4e0`, jeweils
`node scripts/miss-hockey-bestand.mjs …`):

| Plan-Zahl | Plan | gemessen | Lauf |
|---|---:|---:|---|
| Hockey Pp, n=24 | 51,0 | **51,0** | `hockey 24` |
| Hockey Pp, n=48 | 48,1 | **48,1** | `hockey 48` |
| Hockey Pp, n=96 | 44,5 | **44,5** | `hockey 96` |
| health / stamina bei n=48 | −9,6 / −9,0 | **−9,6 / −9,0** | ebd. |
| Tore je Team, Trefferquote, Unentschieden | 6,63 / 66,6 % / 18,8 % | **6,63 / 66,6 % / 18,8 %** | ebd. |
| Football Pp, n=48; Tore | 57,9; 27,06 | **57,9; 27,06** | `football 48` |
| Kandidatenrezept Pp, n=48; Tore | 14,2; 6,76 | **14,2; 6,76** | `hockey 48 <scratchpad>/kandidat/battle-mode.html` |
| Sondierung n=48 (ABWEHR/AUFBAU/TEAMGEIST/ABSCHLUSS/TECHNIK/AUSDAUER/ZWEITCHANCE) | 36,1/24,0/20,0/12,5/3,7/2,7/1,0 | **36,1/24,0/20,0/12,5/3,7/2,7/1,0** | `hockey 48 <scratchpad>/sondierung2/battle-mode.html` |

Die Kopien `kandidat/` und `sondierung2/` des Autors lagen noch im Scratchpad; per `diff`
gegen den Repo-Stand geprüft: sie unterscheiden sich **ausschließlich** in den sieben
Hockey-Rezeptzeilen (`engine.js:3460-3470`), sonst nichts. Die Kandidaten- und
Sondierungszahlen sind damit nicht nur reproduziert, sondern auch als sauber isoliert
belegt.

Das Skript misst, was der Plan behauptet: Endstände über `boxscoreSerie`, Spreizung über
`feldspielSubskills`, Ereignisse über `spiele()`-Protokoll (`art` ∈ steal/treffer/rebound/
block, exakt die vier Ausgänge der Vorab-Schleife `engine.js:4097/4145/4152/4155`), Pp über
dasselbe `einflussVon` wie `messe-arena-einfluss.mjs`. Der Kommentar im Skript zur
unterschiedlichen Formkarten-Ziehung zwischen Teil 1 und Teil 3 ist korrekt und ehrlich.

**Nur gelesen:** Basketballs Pp und Rangtreue (wie der Autor), die NHL-Referenzwerte
(Quellen nicht abgerufen — Proxy lässt nur GitHub/npm durch), die Spieldauer-Arithmetik,
alles zur Optik.

---

## Befunde, nach Schwere

### 1. PR 9 ist kein Einzeiler — der Einzeiler würde falsche Punkte vergeben (schwer)

Der Plan (Fund 0.9, PR 9) sagt, `ARENA_RESOLVED_DISCIPLINE_IDS` um `"hockey"` zu erweitern
sei „die einzige Stelle". Das ist nicht so:

- `runBattleModeArenaMatchday` ruft den Runner **hart mit `"basketball"`** auf —
  `lib/resolve/battle-mode-arena-team-points.ts:177`:
  `runImpl(gameState, fixtureInputs, "basketball", …)`. Die Disziplin wird nirgends aus
  dem Spieltag gelesen.
- Der Test pinnt das: `tests/battle-mode-arena-team-points.test.ts:133`
  `expect(disziplin).toBe("basketball")`.
- Die Override-Map ist **je Spieltag, nicht je Disziplin** gebaut (ein Map `teamId →
  override`), aber in `lib/resolve/legacy-matchday-resolve-engine.ts:713-716` wird sie
  **je Disziplin** über `ARENA_RESOLVED_DISCIPLINE_IDS.has(disciplineId)` angewendet.
  Ein Spieltag hat zwei Disziplinen (`d1DisciplineId`/`d2DisciplineId`,
  `lib/season/arena-matchday-resolve-service.ts:53-63`). Steht `"hockey"` im Set und ein
  Spieltag paart Basketball mit Hockey, bekäme die **Hockey-Seite das
  Basketball-Ergebnis** als Team-Punkte zugeschrieben.

Was PR 9 wirklich braucht: Orchestrator je Arena-Disziplin des Spieltags (d1 und d2
getrennt), Override-Map mit Schlüssel `(disziplin, teamId)`, Test-Anpassung, und ein
Server-Budget: bei zwei Arena-Disziplinen an einem Spieltag laufen 2 Ligen × 2 Disziplinen
Chromium-Batches statt 2. Der Plan nennt nichts davon.

### 2. Die Pp-Zahl misst die Impact-Formel mit — und die ist Basketball (schwer)

`einflussVon` misst die Änderung von `M.wert()` je Spieler bei +15 auf ein Attribut. Für
alle vier Feldspiel-Disziplinen ist `wert` **dieselbe** Formel
(`engine.js:12943`):

```
punkte + assists·1,0 + rebounds·1,2 + (steals + bloecke)·1,5 − verluste·0,8
```

Für Hockey heißt das: ein Tor zählt 1,0, ein Check (`steal`) 1,5, ein Save (`block`) 1,5.
**Ein Check ist in der Abnahme-Metrik mehr wert als ein Tor.** Der Verteidiger wird je Zug
per `gewichtetesLos(gegnerTeam,"ABWEHR")` gezogen (`engine.js:4085`) und bekommt jeden
Steal **und** jeden Block gutgeschrieben (`:4097`, `:4155`). Dass ABWEHR 36 % des
„mechanischen Gewichts" trägt, ist zu einem erheblichen Teil diese Gutschriftsregel, nicht
die Spielmechanik. Der Plan nennt `wert` an keiner Stelle.

Folgen:

- **B.3 hat einen zweiten Hebel, den der Plan nicht sieht.** „Die Mechanik muss diesen
  zwölf Sub-Skills annähernd diese Gewichte geben" — die Gewichte lassen sich auch über
  die Impact-Formel verschieben, ohne eine Zeile Mechanik. Das ist kein Trick, sondern
  eine echte Design-Entscheidung: *was ist Impact im Eishockey?* (Tor 1,0 und Check 1,5 ist
  es sicher nicht.)
- **PR 4 muss die Hockey-Impact-Formel definieren, bevor irgendeine Pp-Zahl für die neuen
  Sub-Skills etwas bedeutet.** Neue Boxscore-Zahlen (Checks, Blocks, Schüsse, Fangquote)
  ohne Gewicht in `wert` sind für die Messung unsichtbar — das ist genau Basketballs
  AUSDAUER-Falle, nur auf der Buchhaltungsseite. Die Sondierung „direkt nach PR 3" (PR 3,
  letzter Satz) misst sonst Gewichte gegen eine Formel, die in PR 4 ohnehin ersetzt wird.
- **Die Achsen-Trennung (Fund 0.7, D.3) ist nur in einer Richtung belegt.** Das
  Kandidatenrezept zeigt: *Rezept* → Tore ist entkoppelt (trivial, das Rezept verschiebt
  Mittelwerte kaum). Es zeigt nicht: *Mechanik* → Pp ist entkoppelt. Das Gegenteil ist
  dokumentiert: Basketballs FG%-Kalibrierung hat Pp von 31,8 auf 22,8 und in einer
  Fassung auf 53,7 bewegt (`battle-mode.rezepte.js:39-41`). Senkt man Hockeys Schussquote
  von 67 % auf 10 %, enden sechsmal mehr Abschlüsse als Save/Abpraller — die
  Gutschriften wandern zum Verteidiger, Pp verschiebt sich. Die beiden Achsen sind über
  Ereignishäufigkeit **und** Impact-Formel gekoppelt. Richtige Zerlegung: erst Mechanik +
  Impact-Formel gegen Realismus festziehen, **dann** Sondierung, **dann** Rezept gegen Pp.
  PR 4 beschreibt genau diese Reihenfolge nicht.

### 3. Das Torwart-Argument steht auf einer Randbedingung, die der Plan selbst vertagt (mittel bis schwer)

**Das Kadergrößen-Argument hält im Code — sogar stärker als beschrieben.**
`buildSeasonPlayerCountByDiscipline` verteilt in einer Fünfer-Kategorie die Permutation
`[2,3,4,5,6]` (`season-discipline-schedule.ts:89-94`); `power` hat genau fünf Disziplinen
(`dataAdapter.ts:56/61/66/69/74`, nachgezählt: alle vier Kategorien haben fünf). Hockey
spielt also in einer von fünf Saisons mit zwei Spielern je Seite. Nebenbefund: der
Katalogwert 5 (`dataAdapter.ts:69`) wird von der Saison **nie** benutzt — der Rückfall
`buildSeasonPlayerCount` (`:64-75`) würfelt 2..6 und weicht dem Katalogwert ausdrücklich
aus. Der Plan zitiert die 5, als bedeute sie etwas.

**Aber die Arena ignoriert diese Zahl heute vollständig — und auch die Aufstellung.** Der
Headless-Runner reicht nur den Gesamtkader durch (`buildArenaTeam`,
`arena-kader-adapter.ts:137-159`; der Kommentar darüber sagt es selbst: „der Motor waehlt
daraus je Disziplin selbst die richtige Untermenge"). `place` bleibt leer, `bauFeldspiel`
nimmt die sechs besten nach Disziplinwert (`engine.js:4017-4019`). Daraus folgt:

- (a) **Die „2 Spieler"-Randbedingung bindet heute nicht.** Der Plan benutzt eine vertagte
  Änderung (F.5) als Grund, Option D *jetzt* auszuschließen. Entweder F.5 kommt vor dem
  Torwart — dann muss jede Option mit 2 umgehen — oder F.5 bleibt vertagt, dann ist D
  nicht „strukturell kaputt". Beides zugleich geht nicht.
- (b) **Option C funktioniert über den Produktivpfad gar nicht**, solange die Aufstellung
  die Arena nicht erreicht. „Der Manager entscheidet, wer im Tor steht" scheitert nicht an
  einer siebten Slot-Rolle, sondern daran, dass der Runner keine Slots kennt. Das ist eine
  größere Abhängigkeit als beschrieben, und sie gilt für Basketballs Slot-Rollen heute
  genauso — ein eigener Befund, den der Plan hätte haben müssen.
- (c) **Option B läuft in die Falle, vor der der Plan in B.2 selbst warnt.** PARADE führt
  dexterity (B.3: 25 von 100 dexterity-Punkten, dazu awareness/will/determination/health);
  SCHUSS_NAH führt ebenfalls dexterity, PUCKFUEHRUNG dexterity + awareness +
  determination, SCHUSSBLOCK health + determination + awareness + will. Der beste
  PARADE-Wert ist mit hoher Wahrscheinlichkeit auch der beste Slot-Finisher — und B
  schließt ihn nicht aus den Angriffslosen aus. Ergebnis im Boxscore: der „Torhüter" führt
  die Torschützenliste an. Das ist exakt Basketballs „Verteidiger war bester Scorer"
  (D.2), nur mit anderem Etikett.

**Die übersehene dritte Option:** der Torwart als **Nicht-Spieler-Akteur nach dem
Schiedsrichter-Muster.** `fsSchiri` ist „bewusst kein 13. Spieler, eigenes Objekt mit x/y"
(`engine.js:5291`, C.1). Ein `fsTorwart` je Seite mit fester Position im Tor, gespeist aus
dem Team (bester PARADE-Wert, aber als *Zahl*, nicht als *Person*), sichtbar im Bild,
ohne Ausschlusslogik in `spielmacherLos`/`offensterMitspieler`/`zuordneDeckung`, ohne
Slot-Rolle, funktionsfähig bei jeder Kadergröße von 2 bis 6. Kosten: ein Sprite, eine
Position, ein Term in der Erfolgsformel — ungefähr B plus Optik, deutlich unter D. Der Preis
ist derselbe wie bei B (die Fangquote hängt am Team), aber der Zuschauer *sieht* einen
Torwart. Der Plan sollte diese Variante neben B stellen, statt B als „klein" gegen D als
„hoch" zu verkaufen.

### 4. Die Abnahme von PR 4 ist mit dem heutigen Messwerkzeug nicht fahrbar (mittel)

D.1 verlangt Pp bei n=48 **und** n=96, PR 4 macht das zur Abnahme — auf der
**Live-Engine**. Teil G.1 räumt ein, dass Basketball live bei n=48 das Zeitbudget der
Session gesprengt hat. `einflussVon` spielt 13 × 12 × n volle Spiele
(`engine.js:12962-12987`); bei n=96 und Chris' empfohlenen 240 Simulationssekunden (F.4)
sind das ~15.000 Spiele à 240 s. Basketballs n=48-Läufe existieren (`rezepte.js:330`), also
ist es machbar — aber nicht „zwei Stichproben als Pflicht" in einer Runde. Entweder ein
billigerer Messmodus für Live-Disziplinen (z. B. Anhebung auf beide Seiten gleichzeitig,
oder Sub-Skill-Sondierung statt Attribut-Hebung), oder die Abnahme ehrlich auf n=24/48
setzen. Der Plan verspricht hier mehr, als sein eigenes Teil G hergibt.

### 5. PR 3 ist zu groß zum Reviewen; PR 2 und PR 3 überlappen (mittel)

Die Live-Engine reicht von `initBasketballLive` (`engine.js:4337`) bis `stepFeldspiel`
(`:6350`) — rund 2.000 Zeilen, plus `zeichneFeldspiel` (`:6652`). Gezählt: 14 Weichen
`feldspielDisc==="basketball"` (stimmt), 8 basketball-benannte Konstanten (stimmt: fünf
`*_BASKETBALL`, dazu `BASKETBALL_POS_MOD`/`_ROLLEN`/`_SKILL_LABEL`), aber insgesamt **20**
Vergleiche gegen `"basketball"` (`disc===` mitgezählt) — PR 2 ist etwas größer als
beschrieben. PR 3 vereint drei Dinge, die einzeln abnehmbar wären: (3a) Umbenennen und
Konfiguration heben, Basketball bit-identisch; (3b) Hockey hinter der Weiche live
schalten; (3c) Sondierung. Die Grenze zu PR 2 („Konstanten wandern in `FELDSPIEL_ART`")
gegen PR 3 („basketball-spezifische Teile heben in die Chassis-Konfiguration") ist nicht
gezogen — `BASKETBALL_POS_MOD` steht in beiden Beschreibungen.

### 6. Das Zonenmodell gehört vor die Rezeptarbeit, nicht daneben (mittel)

C.3.2 sagt richtig: die Erfolgskurve mit Maximum im Slot ist eine **Formänderung**, keine
Umparametrisierung. PR 4 bündelt sie aber mit Sub-Skills, Rezept und Quotenkalibrierung.
Jede dieser Änderungen verschiebt die Sondierungsgewichte; ein Rezept, das gegen die
Gewichte *vor* dem Zonenmodell gebaut ist, ist nach dem Zonenmodell wertlos — dasselbe
Argument, mit dem der Plan das Kandidatenrezept zu Recht zurückhält (Fund 0.6). Innerhalb
von PR 4 muss die Reihenfolge lauten: Zonenmodell + Erfolgsformel + Impact-Formel (Befund
2) → Sondierung → Rezept. Der Plan schreibt das für PR 3→4 auf, aber nicht für das Innere
von PR 4.

### 7. „Keine Basketball-Mechanik läuft für Hockey" — stimmt, mit einer Präzisierung (klein)

Die Weiche `engine.js:4072` steht vor der Vorab-Schleife, die Schleife (`:4077-4160`) nutzt
`gewichtetesLos` linear, keine der in C.1 genannten Live-Funktionen. Bestätigt. Präziser
wäre: der **Bau** (`bauSpieler`, `:4034-4060`, Slot-Aufschlag, Form, Stufe, Eignung) ist
gemeinsam und läuft für Hockey sehr wohl — nur die Live-*Simulation* nicht. Für PR 3 ist
das relevant: `bauSpieler` bleibt, `initBasketballLive` kommt dazu.

### 8. Nebenbefund `messe-arena-einfluss.mjs:44` — bestätigt, sollte nicht warten (klein)

Der absolute Pfad auf den Haupt-Checkout steht dort. Die Reparatur ist eine Zeile
(`resolve(hier, "..", "public", "mockups", "battle-mode.html")`, wie das neue Skript es
macht). Der Plan vertagt das auf „eigener PR" — angemessen wäre, es als PR −1 vor PR 0 zu
setzen, weil PR 0–4 alle mit diesem Werkzeug abgenommen werden sollen und ein Worktree
still die falsche Datei misst.

---

## Was in Teil G fehlt

Der Autor hat zehn Punkte gelistet; die sind ehrlich. Es fehlen:

1. **Die Impact-Formel `wert`** (Befund 2) — nicht als „nicht geprüft", sondern gar nicht
   als Größe erkannt.
2. **Der Produktivpfad ist auf Basketball verdrahtet** (Befund 1: Orchestrator, Test,
   Override-Schlüssel, `determineBasketballContexts`).
3. **Die Aufstellung erreicht die Arena nicht** (Befund 3b) — betrifft Option C, die
   Slot-Rollen aller Feldspiele und F.5 gleichermaßen.
4. **Server-Laufzeit bei zwei Arena-Disziplinen je Spieltag** — der Resolve startet je
   Liga einen Chromium-Batch; mit Hockey verdoppelt sich das an gemischten Spieltagen.
5. **Tests, die Basketball pinnen** (`tests/battle-mode-arena-team-points.test.ts:133`,
   `tests/arena-headless-runner.test.ts`) — jeder PR ab 3 muss sie anfassen oder
   parametrisieren.
6. **Das Pp-Werkzeug bei Live-Disziplinen** (Befund 4) — der Plan setzt Schwellen, die er
   mit dem vorhandenen Werkzeug in einer Runde nicht prüfen kann.

Nicht fehlend, aber erwähnenswert: die Unentschieden-Quote (F.3) ist bei ~3 Toren je Team
nach Poisson etwa gleich hoch wie heute (~17 %); die Empfehlung „zulassen" hält also auch
nach der Kalibrierung.

---

## Wo der Plan zu optimistisch ist — kompakt

| Stelle | Plan sagt | Realistisch |
|---|---|---|
| PR 9 | Einzeiler | Orchestrator je Disziplin, Override-Schlüssel, Test, Server-Budget |
| Option B | „klein, kein neuer Spielertyp" | klein — aber der Torhüter ist voraussichtlich auch der beste Schütze (Befund 3c) |
| Option C | „eine siebte Slot-Rolle + `HOCKEY_POS_MOD`" | zusätzlich: Aufstellung in den Runner bringen (heute für keine Disziplin vorhanden) |
| PR 4 Abnahme | Pp n=48 und n=96 live | mit `einflussVon` in einer Runde nicht fahrbar; Werkzeug oder Schwelle anpassen |
| B.3 | Mechanik muss zwölf Gewichte liefern | Mechanik **und** Impact-Formel; letztere ist heute Basketball und gewichtet Check über Tor |
| Fund 0.7 / D.3 | zwei getrennte Achsen, „bewiesen" | nur Rezept→Tore entkoppelt; Mechanik→Pp gekoppelt, Basketballs Historie belegt es |
| PR 3 | ein PR | drei abnehmbare Schritte, Grenze zu PR 2 unklar |

---

## Was der Plan richtig macht (kurz, damit das Urteil einordbar bleibt)

- Jede Zahl reproduzierbar, Skript misst genau das, was es behauptet.
- Fund 0.1 (Vorab-Disziplin) und 0.3 (Sonde nur für Live) sind korrekt und ändern
  tatsächlich die Reihenfolge — PR 0 vor allem anderen ist richtig.
- Das Kandidatenrezept zurückzuhalten ist die richtige Entscheidung, aus dem richtigen
  Grund.
- Bully nicht als Sub-Skill, Strafen als Funktion von CHECK, Powerplay nach Live:
  inhaltlich alles nachvollziehbar und mit dem Motor abgeglichen.
- Die Sondierungsmethode trägt für den Vorab-Pfad nachweislich (18,6 Pp Modellfehler ist
  klein genug, um zu steuern) — und der Plan sagt selbst, dass das für Live nicht gilt.

---

## Auflagen (Vorschlag für die Umsetzung)

1. PR −1: `messe-arena-einfluss.mjs` Pfad relativ auflösen.
2. PR 9 neu beschreiben (Befund 1); Produktivierung erst nach einem Test, der einen
   Spieltag mit Basketball **und** Hockey auflöst.
3. Vor PR 4: Hockey-Impact-Formel als eigene, sichtbar begründete Entscheidung in
   `MOTOREN[fd].wert` je Disziplin — erst dann Sondierung.
4. Torwart: Option „Nicht-Spieler-Akteur wie `fsSchiri`" neben B stellen und Chris die
   Wahl zwischen B (unsichtbar, billig) und dieser Variante (sichtbar, wenig teurer)
   geben; C erst nach „Aufstellung erreicht die Arena".
5. PR 3 in 3a/3b/3c teilen; Grenze zu PR 2 an `BASKETBALL_POS_MOD` festmachen.
6. D.1 für Live-Disziplinen auf ein fahrbares n setzen oder das Werkzeug erweitern.
