# Battle Arena im Spieltagsablauf (02.11.)

Chris: „Ja du sollst die battle Arena anbinden und die normale Arena in dem Modus deaktivieren.“

## Was jetzt passiert

**Battle Mode** (`isBattleModeSave`): Die Arena des Spieltags (View `matchdayArena`, erreichbar über
„Arena starten“, „Zur Arena →“ in der Einsatzliste und „Zur Battle Arena →“ auf der Vorspiel-Tafel)
zeigt **nie mehr die alte Disziplin-Bühne**. Die Demo-Pixel-Szene und die Reveal-Bühne werden dort nicht
mehr gerendert. Die Spieltags-Wertung, der Endscreen und „Spieltag abschließen“ bleiben.

- **Motor-Spiel im Snapshot** (`lib/foundation/battle-arena/arena-spieltag-ansicht.ts`,
  `bestimmeArenaSpieltagAnsicht`): Das gilt für `resolutionSource === "arena"` (Duell aus dem
  Hintergrund-Vorlauf) und für Motor-Pods (`quelle` `ffa`/`bahn`). Dann läuft die echte Battle Arena
  (`FoundationBattleArenaHost` mit Prop `spieltag`), und zwar mit dem Fixture des eigenen Teams in
  Fixture-Orientierung (Heim = `fixture.homeTeamId`, wie `bereiteFixturesVor()`), mit derselben Saat,
  derselben Aufstellung, denselben Mutatoren und Pods. Eingriffe ins Spiel (Zielansage, Fokus,
  Rennplan) sind dabei aus (`nurZuschauen`). Das Ende des Spiels, ob zugeschaut oder per
  **⏩ Quick-Sim**, bucht die Disziplin über `commitFinishedDiscipline`. Gebucht wird dabei der Snapshot,
  den die Arena anzeigt. Das ist derselbe Weg wie früher beim Zieleinlauf der Bühne.
- **Kein Motor-Spiel**: Dazu gehören die PPS-Duell-Brücke (TDM, Hockey, Football, Battlefield ohne Pod)
  und PPS-Pods. Die Arena zeigt dann kein erfundenes Spiel. Sie sagt, dass die Disziplin über die
  Brücke gewertet wird, zeigt die gebuchte Wertung und bietet „Disziplin werten“ an (derselbe
  Buchungsweg). Rechnet der Vorlauf noch, steht dort ein Wartehinweis.

**Manager Mode, Admin-Testmodus und Zufallsmodus**: unverändert, dort läuft die alte Bühne.

## Quick-Sim

`window.__arena.schnellDurch()` (battle-mode.engine.js) tickt wie `loop()`: dieselbe Funktion
`stepSim((1/60)/zeitFaktor())` und dieselbe HUD-Nachführung wie `sondenLauf()`. Es zeichnet dabei nur etwa
fünfmal je Sekunde, und Kaderleiste und Wertungstabelle sind gedrosselt. Weil jeder Tick fest ist, endet
das Spiel dort, wo es auch beim Zuschauen geendet hätte. Das gilt auch, wenn man mitten im laufenden
Spiel vorspult (gemessen: Basketball 67:57, zugeschaut und vorgespult gleich gebucht). Bei Mini-DM
entspricht Quick-Sim dem Knopf „Alles zeigen“. Dauer im Headless-Chromium: 1–6 s je Disziplin.

## Wertung unverändert — nachgemessen

`window.__arena.spiele*` liefert für 17 Disziplinen × 3 Saaten vorher und nachher **byte-identische**
Ergebnisse (seiten + boxscore). Die Engine-Änderungen sind rein additiv: Ende-Ereignis
`oly-arena:ende`, `schnellDurch`, Zuschau-Flag, Ton und DOM während des Vorspulens gedrosselt. Zu
beachten: Der Motor-Dateihash steckt im Arena-Eingabe-Fingerabdruck (`arena-eingabe-hash.ts`). Ein
Deploy rechnet offene Vorläufe deshalb einmal neu, mit denselben Ergebnissen.

## Offene Punkte

1. **Bahn-Wiedergabe weicht in den Zahlen ab.** Die zuschaubare Wiedergabe tickt mit
   `(1/60)/ZEIT_DEHNUNG`, der zählende Lauf mit `1/60`. Gemessen über 12 Saaten (Demo-Kader):
   - Bühne, Basketball, Staffel und Time-Trial: bitgleich.
   - Spurt und Takeshi: gleicher Sieger, andere Punktzahlen.
   - Climbing: einmal von 12 ein anderer Sieger.

   Die Arena zeigt deshalb immer „Gewertet: …“ mit der gebuchten Zahl. Bei abweichendem Sieger erscheint
   ein roter Hinweis (`zeigtArenaDenGebuchtenSieger`). Beheben ließe sich das nur durch dieselbe
   Tickgröße in beiden Pfaden, und das ist eine Mechanik-Änderung mit neuer rho/Pp-Abnahme. Bewusst
   nicht hier.
2. **Brücken-Disziplinen ohne Arena-Spiel**: TDM, Hockey, Football und Battlefield ohne Pod, solange
   sie die Abnahme nicht bestehen (`ARENA_RESOLVED_DISCIPLINE_IDS`).
3. **Koop-Raum**: Der Motor kennt keinen Gleichlauf zwischen zwei Browsern. Beide sehen dasselbe
   deterministische Spiel, aber nicht zeitgleich. Gebucht wird weiterhin nur vom Host.
4. Bei bereits gebuchter Disziplin steht „Gewertet: …“ schon vor dem erneuten Abspielen da, wie beim
   früheren Endscreen der Bühne.
5. Der Entwurfsreiter „Battle Arena“ bleibt als freie Spielwiese bestehen und bucht weiterhin nichts.
