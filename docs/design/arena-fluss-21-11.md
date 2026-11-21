# Arena-Fluss im echten Spieltag (21.11., Arbeitsliste Punkt 1.10)

Auftrag: (A) kein Auto-Sprung D1 → D2, (B) Endergebnis bleibt stehen, (C) eigene Matches zuerst + D2
vorladen. Vorarbeit: `docs/design/spieltag-tempo-21-11.md` Abschnitt 4/5 (Branch
`claude/spieltag-tempo-21-11`) — Vermutung dort: Ausrichte-Effekt bevorzugt D2, `arenaEnded`/`endeInfo`
werden beim Neuaufbau zurückgesetzt. Diese Vermutung trifft nur halb; die eigentliche Ursache liegt
eine Ebene tiefer, im Trainings-Commit.

## 1. Befund (gemessen, nicht vermutet)

Messung am Live-Abbild (`live-save` vom 21.11. 16:00, Save `new-game-1795114260527-nzr0z9`, Spieltag 12,
D1 Mini-DM als Vierergruppe, D2 Basketball als Duell, eigenes Team D-P), auf einer Kopie:
Aufstellungen ergänzt, Vorlauf per Node gerechnet, dann D1 genau so gebucht wie die Bühne es tut
(`runLocalMatchdayAutoRun`, `commitThroughSide: "d1"`, gezeigte Preview). Vorher und nachher wurde
alles nachgebaut, woraus der Host die Motor-Nutzlast (`umschlag` in `FoundationBattleArenaHost.tsx`)
zusammensetzt — mit denselben Bibliotheksfunktionen.

| Teil der Nutzlast | nach D1-Buchung (alt) | nach D1-Buchung (neu) |
|---|---|---|
| Kader Heim/Gast (`buildArenaTeam`) | **geändert** | gleich |
| Mini-DM-Vierergruppe (vier Kader) | **geändert** | gleich |
| Aufstellung, Saat, Kulisse, Strategie, Format, Mutatoren, Verletzungsstand | gleich | gleich |
| Arena-Eingabe-Hash beim Buchen (`resolveMatchdayPreviewToBook`) | **Divergenz für `basketball` und `mini-dm`** | Snapshot, keine Divergenz |
| D2-Buchung im HTTP-Modus (`arenaModus: "hintergrund"`) | **blockiert `arena_eingabe_divergenz`** (neuer Vorlauf) | sofort gebucht, D2-Zeilen = vorher gezeigt |

Was sich am Kader ändert: Attribute (`a`) und Disziplinwerte (`d`) jedes Spielers um wenige Hundertstel
bis Zehntel — der **Trainingszuwachs je Spieltag** (Chris 18.11., `docs/design/training-je-spieltag-18-11.md`).
`accumulateMatchdayTrainingProgress` lief schon beim D1-Teil-Commit und buchte den Zuwachs auf die
Attribute aller in D1 gebuchten Spieler; `withRefreshedDisciplineRatings` leitete danach die
Disziplinwerte ligaweit neu ab. Das Zusammenspiel mit der Teilbuchung je Disziplin war in der
Trainings-Doku nicht bedacht.

### B — warum das Endergebnis „resettet"

1. D1 endet (`oly-arena:ende`) → `beimBattleArenaEnde` bucht D1 → `loadSave` holt den neuen Spielstand.
2. Der Host baut die Nutzlast neu; weil der Kader anders ist, ist `JSON.stringify(umschlag)` anders.
3. Die bisherige Regel im Mount-Effekt kannte nur „gleiche Signatur → stehen lassen, sonst neu":
   `stoppeLaufendenMotor()`, Container geleert, `setMotorBereit(false)`, **`setEndeInfo(null)`**.
4. Die Bühne zeigt das Ladebild, danach einen frischen D1-Motor am Anfang. Der Endstand ist weg.

### A — warum es nach einem Sprung zu D2 aussieht

Ein `setDisciplineId(D2)` ohne Klick gibt es nicht: der Ausrichte-Effekt (`alignedMatchdayRef`) läuft
nur einmal je Spieltag und Komponenteninstanz, und `DisciplineStageArena` wird nach der Buchung nicht
neu eingehängt (kein `key`-Wechsel, kein Ansichtswechsel). Was der Spieler sieht, ist Schritt 4 oben:
das Ladebild des Neuaufbaus trägt den Ausblick „Danach · Disziplin 2 von 2: Basketball · Duell" samt
der D2-Teams, und unter der Bühne steht bereits der Wechsel-Block (`ArenaWechsel`) mit dem eigenen
D2-Spiel. Der D1-Endstand verschwindet, an seine Stelle tritt ein Bild, das D2 ankündigt — von außen
ein Auto-Sprung. Belegt ist der Mechanismus (Code + Messung); im Browser beobachtet werden konnte er in
dieser Runde nicht (Abschnitt 4). Ein echter `setDisciplineId(D2)` ohne Klick wäre nur bei einem
Neu-Einhängen von `DisciplineStageArena` möglich (dann richtet der Ausrichte-Effekt auf die erste
ungewertete Seite aus) — dafür fand sich kein Auslöser.

### Nebenbefund (dieselbe Ursache): D2 wartete und hätte „anders" gebucht

Nach dem D1-Commit passte der Vorlauf-Fingerabdruck für D2 nicht mehr. Die D2-Buchung der Bühne
bekam `arena_eingabe_divergenz`, stieß einen neuen (Chromium-)Vorlauf an und pollte bis zu 15 Minuten
(„Arena-Duelle werden ausgetragen …"). Gebucht wurde dann aus Eingaben NACH dem D1-Training, gezeigt
hatte die Bühne D2 mit nachgeladenen Attributbögen von VOR der Buchung und Disziplinwerten von danach —
„gezeigt = gebucht" war für D2 nicht gesichert. Die D1-Zeilen selbst blieben beim D2-Commit
unverändert (nachgemessen: 32 von 32 gleich).

## 2. Fixes

1. **Trainingszuwachs erst mit dem Abschluss des Spieltags** (`lib/training/matchday-training-accumulator.ts`,
   neue Eingabe `spieltagOffen`, gesetzt in `legacy-matchday-result-apply-service.ts` für
   `commitThroughSide !== "d2"`). Beim D1-Commit wird alles wie bisher entschieden und festgehalten —
   Modus, Trainingslast, Ziel, Ausfall (Regel B), Höhe des Zuwachses —, der Zuwachs steht aber nur im
   Verlauf (`o: true`, neues optionales Feld an `TrainingsSpieltagEintrag`) und landet erst mit dem
   D2-Commit auf den Attributen, mit genau diesen Zahlen. Ein Moduswechsel zwischen D1 und D2 nimmt
   keinen nie gebuchten Zuwachs zurück. Endzustand nach D2 = ein voller Commit (Test).
2. **Endstand bleibt stehen, auch wenn sich die Nutzlast doch einmal ändert**
   (`lib/foundation/battle-arena/arena-motor-neuaufbau.ts`, `entscheideMotorNeuaufbau`, im Host verdrahtet):
   ist die gezeigte Disziplin angeschaut (Vorstellung weg / Quick-Sim) oder beendet, wird ihr Motor nicht
   neu aufgebaut; eine neue Nutzlast wirkt erst beim nächsten Disziplinwechsel (Klick auf „Weiter").
   Dafür hängt der Mount-Effekt jetzt auch an `spieltagDisziplinId`.

Nicht angefasst: `public/mockups/battle-mode.engine.js` (Wertungslogik), Ausrichte-Effekt, ArenaWechsel.
Der Wechsel zu D2 bleibt ein Klick (`arena-wechsel-weiter`); mit gleicher Nutzlast stellt er den
laufenden Motor per `setDisc` um, ohne Neuaufbau.

## 3. Prüfung

- `tests/arena-motor-neuaufbau.test.ts` (6 Fälle der Neuaufbau-Regel).
- `tests/training-je-spieltag.test.ts`, neuer Block „Halber Spieltag": D1-Commit lässt Attribute und
  Disziplinwerte stehen; Teil + Abschluss == voller Commit (Attribute, Verlauf, Disziplinwerte,
  Zähler); Moduswechsel zwischen D1 und D2.
- Bestehende Suiten grün: `training-je-spieltag`, `matchday-training-accumulator`,
  `spieltag-eine-rechenstelle`, `fatigue-eine-zahl`, `matchday-auto-run-service`.
- Wertungs-Fingerabdruck (`node scripts/pruefe-wertung-fingerabdruck.mjs --node`): vor und nach der
  Änderung **GESAMT eaafed96150e (75 Einträge)**, unverändert (der Motor ist nicht berührt).
- Messung am Abbild (Abschnitt 1, Spalte „neu"): Nutzlast nach D1 unverändert, keine Divergenz, D2 im
  HTTP-Modus sofort gebucht, D2-Zeilen gleich den vorher gezeigten.

## 4. Sichtprüfung im Browser

**Nicht gelungen, zwei Anläufe.** Dev-Server (`OLY_AUTO_EXPORT_SAVES=0 OLY_AUTO_EXPORT_PUSH=0`) gegen eine
vorbereitete Kopie des Abbilds (Aufstellungen + Vorlauf fertig, D1 offen), ein Chromium
(`--disable-dev-shm-usage`). Beide Male hat der Speicher-cgroup-OOM-Killer den Dev-Server beim ersten
Kompilieren der Arena-Routen beendet (`Killed process … node … anon-rss: 8,5 GB`, auch mit
`--max-old-space-size=5120`), der Browser-Tab stürzte mit ab (`Target crashed`), bevor die Bühne stand.
Bilder gibt es deshalb keine. Das Sichtprüf-Skript (D1 per Quick-Sim beenden, Protokoll von
`data-disziplin`/`data-motor-bereit`/`data-spiel-ende`/Ladebild im 200-ms-Takt, Buchung abwarten, nach
12 s prüfen, dass `data-spiel-ende` noch gesetzt ist, dann `arena-wechsel-weiter` klicken und die Zeit
bis „D2-Motor bereit" messen) liegt bei der Sitzung und sollte auf einer Maschine mit mehr Speicher
einmal laufen. Abnahmekriterien dort: nach der Buchung kein `LADEBILD`, `data-spiel-ende` bleibt
gesetzt, `data-disziplin` bleibt `mini-dm` bis zum Klick, D2 ohne Ladebild (gleiche Nutzlast → `setDisc`).

Was die Sichtprüfung ersetzt, ist die Messung in Abschnitt 1: die Nutzlast, aus der der Host den
Neuaufbau entscheidet, ist nach dem Fix vor und nach der D1-Buchung Zeichen für Zeichen gleich — die
Bedingung, unter der der Host den Endstand verwarf, tritt nicht mehr ein; und falls sie aus anderem
Grund doch eintritt, verhindert `entscheideMotorNeuaufbau` den Neuaufbau der angeschauten Disziplin.

## 5. C — eigene Matches zuerst, D2 vorladen: Plan statt halber Umsetzung

**Was nach diesem Fix schon gilt.** D2 ist vorbereitet, bevor D1 überhaupt startet: der Vorlauf rechnet
beide Disziplinen, bevor die Bühne das Motor-Spiel zeigt, und die Motor-Nutzlast trägt Saat, Kader,
Pods und Mutatoren beider Spieltags-Disziplinen. Weil sich die Nutzlast nach der D1-Buchung nicht mehr
ändert, stellt der Klick auf „Weiter" den laufenden Motor nur um (`setDisc`), ohne Neuaufbau und ohne
neuen Vorlauf; die D2-Buchung braucht keinen zweiten Vorlauf mehr. „D2 vorladen" ist damit für den
Spieler erfüllt. Offen bleibt die **Wartezeit vor D1**: die Bühne zeigt das eigene Spiel erst, wenn der
Vorlauf ALLE Spiele beider Disziplinen beider Ligen gerechnet hat (gemessen am Abbild per Node 20–60 s,
per Chromium länger).

**Den Drei-Schritte-Vorschlag kritisch geprüft** (`spieltag-tempo-21-11.md` Abschnitt 4):

1. *„`runBattleModeArenaMatchday` liefert die Duelle der menschlichen Teams als erste Charge."* Richtig
   gedacht, aber ohne Schritt 2 wirkungslos. Zusätzlich nötig und im Vorschlag nicht genannt:
   - **Reihenfolge der Disziplinen.** Heute laufen erst alle generischen Arena-Disziplinen
     (`input.arenaDisciplineIds`), danach Mini-DM-, Battlefield- und Bahn-Pods in eigenen Zweigen. In
     Chris' Save ist D1 Mini-DM — sie wird heute ZULETZT gerechnet, nach D2. Erste Charge muss
     „eigenes Spiel/eigene Gruppe in D1" sein, egal welches Chassis.
   - **Unabhängigkeit je Spiel beweisen.** Die eigene Charge darf nur vorgezogen werden, wenn ein Spiel
     allein gerechnet dasselbe Ergebnis liefert wie im Stapel (Saat je Fixture/Pod, frischer Motor je
     Fixture — im Node-Runner so gebaut, im Chromium-Runner je Fixture neu eingehängt). Pflicht: ein
     Paritätstest „einzeln == im Stapel" je Chassis (Duell, Mini-DM-Pod, Battlefield-Pod, Bahn-Pod),
     sonst bricht „gezeigt = gebucht".
2. *„Der Datensatz bekommt je Disziplin `status: "arena"` sofort nach Abschluss, die Bühne liest pro
   Disziplin."* Das ist der eigentliche Umbau und berührt drei Garantien:
   - `finishArenaVorlauf` schreibt heute EINMAL (Record + Snapshot-Preview) und lässt je Signatur+Versuch
     nur das erste terminale Ergebnis gelten (Quick-Sim gegen Chromium). Teilergebnisse brauchen eine
     eigene Funktion `veroeffentlicheArenaTeilergebnis(scope, {signature, versuch, disziplinId|fixture})`,
     die nur schreibt, wenn Signatur UND Versuch noch die laufenden sind, und die ein späteres
     terminales Ergebnis nie überschreiben darf (sonst zeigt die Bühne ein Ergebnis, das ein
     Quick-Sim-Lauf schon anders festgeschrieben hat).
   - Die Snapshot-Preview muss für die fertige Disziplin `resolutionSource: "arena"`/Pod-Quelle tragen,
     für die offene weiter die PPS-Brücke — `bestimmeArenaSpieltagAnsicht` entscheidet heute je
     Disziplin, das passt.
   - **Buchung je Disziplin**: der Auto-Run blockiert heute mit `arena_vorlauf_laeuft`, solange der
     GESAMTE Vorlauf läuft. Für den D1-Commit genügt „D1 terminal"; das muss
     `matchday-auto-run-service.ts` je `commitThroughSide` prüfen. Für die Wertung der ganzen Liga in D1
     müssen ohnehin alle D1-Spiele fertig sein — die eigene Charge verkürzt nur die Zeit bis zum
     Zuschauen, nicht bis zum Buchen.
3. *„KI-gegen-KI läuft als zweite Charge derselben Signatur."* Ja — als Fortsetzung DESSELBEN Laufs
   (gleiche Signatur, gleicher Versuch, gleicher Semaphor-Griff), nicht als zweiter Vorlauf. Ein zweiter
   Lauf hätte eine eigene Versuchsnummer und fiele unter „erstes terminales Ergebnis gewinnt".

**Empfohlene Reihenfolge für die Umsetzung (eigene Runde, mit Opus-Review der Wertungsseite):**
(a) Paritätstests „einzeln == Stapel" je Chassis; (b) `veroeffentlicheArenaTeilergebnis` +
Tests gegen Signaturwechsel und Quick-Sim-Konkurrenz; (c) Vorlauf-Reihenfolge: eigenes D1-Spiel →
restliches D1 → eigenes D2-Spiel → restliches D2, über alle Chassis; (d) Auto-Run prüft „Seite terminal"
statt „Vorlauf terminal"; (e) Bühne: Poll übernimmt Teilstände (der Hinweis zeigt dann „dein Spiel ist
bereit, die Liga rechnet noch"). Abnahme: Wertungs-Fingerabdruck unverändert, Messung am Abbild
„gezeigt = gebucht" für D1 und D2, Zeit bis zum ersten Bild vorher/nachher.
