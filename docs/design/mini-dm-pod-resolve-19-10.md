# Mini-DM-Pod-Resolve (19.10.): echte Vierergruppe statt falschem Zwei-Team-Duell

Auftrag Chris, 19.10., wörtlich: „3 -> umbauen dass die 4er teams da drin sind!!!" — nachdem er in
der Spieltage-Ansicht ein Mini-DM-Ergebnis wie „0:2" sah, obwohl der Spielplan für diesen Spieltag
eine Vierergruppe (Pod) ankündigt.

## Befund

Mini-DM wird im Spielplan-Tab als 4-Team-Gruppe angekündigt (`lib/season/mini-dm-pod-schedule.ts`,
`getMiniDmPodsForMatchday()`/`getMiniDmPodForTeam()`, gebaut 14.09.). Gebucht wurde bis zu diesem PR
aber ein gewöhnliches 2-Team-PPS-Duell gegen den normalen Spieltags-Fixture-Gegner
(`resolutionSource: "pps_duell"`, `lib/resolve/battle-mode-pps-duell.ts`) — wie jede andere
Zweikampf-Disziplin. Der Fixture-Gegner ist aber oft gar nicht Teil der angekündigten Vierergruppe,
weil ein Mini-DM-Pod aus einer **eigenen**, von der normalen Fixture-Erzeugung unabhängigen
Permutation entsteht (s. Kopfkommentar an `mini-dm-pod-schedule.ts`). Mini-DM ist nicht in
`ARENA_RESOLVED_DISCIPLINE_IDS`; eine FFA-Pod-Simulation existiert zwar
(`runMiniDmFfaPodFixtures()`, `lib/battle/arena-headless-runner.ts`, Chromium-basiert über
`spieleMiniDmFfaEvent()`), wird aber vom echten Spieltags-Resolve-Pfad nicht aufgerufen — bislang
rein für Präsentationszwecke (s. Kopfkommentar dort).

`docs/design/battle-mode-20-spieltage-liga-mechanik-16-10.md` Abschnitt 5.3 hatte das als nächsten
offenen Schritt benannt: „Mini-DM bekommt als einzige Disziplin einen eigenen Pod-Resolve [...]. Bis
er gebaut ist, läuft Mini-DM über die PPS-Duell-Brücke wie die anderen vier." Dieser PR baut genau
diesen Pod-Resolve.

## Entscheidung: PPS-Score-basierter Pod statt FFA-Chromium-Integration

Zwei Wege standen offen:

1. **Der echte FFA-Kampfmotor** (`runMiniDmFfaPodFixtures()`), isoliert am 13.10. gemessen mit
   rho 0,80/0,82 und Pp 8,7/9,0 (s. `battle-mode-20-spieltage-liga-mechanik-16-10.md` Abschnitt 5.3/
   5.4). Ihn in den echten Resolve-Pfad zu hängen bräuchte dieselbe Vorlauf-/Cache-Infrastruktur wie
   die 15 arena-aufgelösten Disziplinen (`lib/battle/arena-vorlauf-service.ts`,
   `ArenaVorlaufRecord`, asynchroner Chromium-Vorlauf vor dem synchronen Buchen) — ein eigener,
   größerer Umbau.
2. **Derselbe deterministische PPS-Score**, den die PPS-Duell-Brücke bereits für vier andere
   Disziplinen (Football, I-Spy, Battlefield, TDM) nutzt — nur korrekt als Vierergruppe gruppiert
   statt als falsch gepaartes Zweier-Duell.

Dieser PR wählt **Weg 2** (`lib/resolve/mini-dm-pod-resolve.ts`). Begründung, identisch mit der
bereits getroffenen Entscheidung für die PPS-Duell-Brücke selbst (Abschnitt 5.2 des 16.10.-Dokuments,
wörtlich): „Der PPS-Pfad ist kein Motor, [...] sie ist die Eignung [...] Ein Arena-Motor ersetzt sie
erst, wenn er beweist, dass er sie verbessert (rho > 0,80, Pp ≤ 25)." Der FFA-Motor hat das zwar
schon isoliert bewiesen — ihn tatsächlich synchron einzuhängen ist aber ein separater, größerer
Umbau der Vorlauf-Infrastruktur, der in dieser Runde bewusst nicht mitgemacht wurde (s. PR-Report,
Abschnitt „Was nicht fertig wurde"). Weg 2 behebt Chris' konkreten Befund (falsch gebuchtes
Zwei-Team-Ergebnis) vollständig, ohne das rho/Pp-Risiko eines neu verdrahteten Motors einzugehen:
der Score ist exakt derselbe, nach dem auch die anderen 19 Disziplinen gewertet werden, nur
Gruppierung (4 statt 2 Teams) und Punktevergabe (2-1-0-0 statt 2-1-0) ändern sich.

**Rho/Pp-Einordnung:** Die Platzierung eines Teams in seinem Pod folgt deterministisch aus seinem
bereits berechneten PPS-Score — keine zusätzliche Zufallsquelle, keine neue Motor-Logik. Die
„Pflichtzahl" betrifft hier deshalb nicht die Gruppierung selbst (die ordnet IMMER exakt nach dem
gebuchten Score, bewiesen per Property-Test statt per Stichprobe), sondern den bereits bestehenden,
unveränderten PPS-Score-Kanal (`scoreLegacyLineupDisciplineSide()`), dessen Fidelity
`scripts/miss-pps-duell-bruecke-abnahme.ts --disziplinen=mini-dm` bereits misst (Laufzeit ca.
50 Minuten je Saatstrom laut Dateikommentar) und der durch diesen PR nicht verändert wird.

## Was gebaut wurde

1. **`lib/resolve/mini-dm-pod-resolve.ts`** (neu): `berechneMiniDmPodOverrides()` gruppiert die
   Pods eines Spieltags (aus `getMiniDmPodsForMatchday()`), ordnet die vier Teams nach PPS-Score,
   vergibt 2-1-0-0 nach Platz, und berechnet je Team ein 0..10-Ergebnis
   (`berechneErgebnisNormiertNTeam()`, Verallgemeinerung von `berechneErgebnisNormiert()` aus PR
   #1296 auf N statt 2 Teams, „Leiter"-Verfahren: Lücken zwischen Plätzen aus der Marge, kumulativ
   aufaddiert, gemeinsam ins Intervall [0,10] skaliert, um das Pod-Niveau zentriert). Ordnungsgarantie
   by construction (Verkettung monotoner Funktionen) — kein Spezialfall nötig.
2. **`lib/resolve/legacy-matchday-resolve-engine.ts`**: neuer Zweig, der NUR für
   `disciplineId === MINI_DM_DISCIPLINE_ID` in einem Battle-Save die Pod-Overrides statt der
   PPS-Duell-Brücke zieht; die alte Brücke bleibt als Rückfall für Teams, deren Pod unvollständig
   ist (fehlender Score). Die anderen 19 Disziplinen durchlaufen exakt denselben Code wie vorher.
3. **`resolutionSource: "mini_dm_pod"`** (neuer Wert, additiv) sowie ein additives
   `miniDmPod`-Feld auf `DisciplineResultRecord`/`DisciplineTeamResolvePreview` (Platz, Pod-ID,
   Pod-Team-IDs, 0..10-Wert) — persistiert als JSON wie jedes andere additive Feld (keine
   Migration nötig).
4. **`istDuellWertung()`** (battle-mode-pps-duell.ts) erkennt `"mini_dm_pod"` zusätzlich zu
   `"arena"`/`"pps_duell"` — dieselbe Tabellen-Entkopplung aus PR #1296
   (`tableGroupContributions` bucht `teamPoints` direkt, nicht die Spieler-PP-Summe).
5. **Spieler-PP** (`derivePlayerPointsForDuellGroup()`, season-points-ledger.ts): Mini-DM-Pod-Zeilen
   fallen in denselben Nicht-Arena-Zweig wie PPS-Duell-Zeilen — `ppAusSpielerScore()` unverändert,
   unabhängig vom Pod-Platz. Die bestehende `verhaeltnis-referenz.json`-Zelle (`pps`/`mini-dm`,
   Feldgrößen 2..6) ist bereits über `legacyScorePlayerCount` (den gewürfelten Rohwert, nicht den
   Pod-Kader-Wert 1) indiziert — dieselbe Referenz, die die PPS-Duell-Brücke für Mini-DM schon
   nutzt, bleibt gültig, weil sie die Verteilung des EINZELSPIELER-Scores misst, nicht die
   2-Team-vs-4-Team-Gruppierung.
6. **Defensive Absicherung** (gefunden über die bestehende Test-Suite, nicht über den Live-Spielstand):
   mehrere Tests bauen ein bewusst minimales `GameState` (kein `season`, keine `disciplineSchedule`)
   und nutzen `"mini-dm"` als beliebige Platzhalter-Disziplin-ID für etwas ganz anderes (z. B.
   `tests/battle-mode-arena-resolve-engine.test.ts`, „ignoriert die Arena-Punkte-Map für eine
   Nicht-Basketball-Disziplin"). `getMiniDmPodsForMatchday()` liest `gameState.season.id` ohne
   Schutz und hätte dort geworfen. Der Aufruf in `legacy-matchday-resolve-engine.ts` ist deshalb in
   `try`/`catch` gefasst — ein Fehler beim Pod-Ermitteln bedeutet „kein Pod heute", nie ein
   geworfener Fehler, dieselbe Philosophie wie der Rest der Datei.
7. **UI** (`lib/foundation/season-matchday-fixtures-overview.ts`, `SeasonStandingsNewLook.tsx`):
   neues `SpieltagsUebersicht.miniDmPods[]` (eine Gruppe je Pod, Mitglieder mit Platz/Punkten/Wert)
   zusätzlich zu den normalen Paarungen; die Spieltage-Ansicht zeigt einen eigenen „Gruppe
   A/B/..."-Block über der Paarungsliste, die betroffene Disziplin-Zelle in der normalen
   Paarungszeile verweist nur noch auf die Gruppe statt ein falsches „Heim:Gast" zu zeigen.

## Was nicht Teil dieses PR ist

- Der echte FFA-Kampfmotor (`runMiniDmFfaPodFixtures()`) bleibt unverdrahtet — weiterhin nur über
  die Test-Schnittstelle (`window.__arena.miniDmFfaEvent()`) und für Präsentationszwecke erreichbar.
  Ihn an den Resolve-Pfad zu hängen bräuchte die Vorlauf-/Cache-Infrastruktur der Arena (eigener,
  größerer PR).
- Eine neu gezogene `verhaeltnis-referenz.json`-Zelle speziell für den Pod-Kontext — die
  bestehende „pps"/"mini-dm"-Zelle wird unverändert weiterverwendet (Begründung oben, Punkt 5).
- Alle 19 anderen Disziplinen bleiben unverändert 2-Team-Duelle.
