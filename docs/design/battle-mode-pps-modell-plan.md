# Vorschlag: Spieler-PPs-Modell für Battle Mode (Basketball)

**Das ist ein Vorschlag, keine Entscheidung.** Genau wie in `docs/design/battle-mode-spielmodus-plan.md`
Abschnitt 5.4 (Fable-Empfehlung gegen Chris' Bauchgefühl, ausdrücklich „noch nicht final von Chris
bestätigt") folgt dieses Dokument dem in diesem Projekt etablierten Muster: erst ein begründeter
Vorschlag, dann Chris' Entscheidung, erst danach Code. Nichts hier ist implementiert, nichts hier ist
gebaut — dieses Dokument selbst ändert keine Zeile im Repo.

Recherche-Stand: 2026-08-31, Repo `/home/user/Olympiade-der-Welten`, `main` lokal (HEAD `d84155b9`,
„Merge … battle-arena-handoff-update", PR5 `window.__arena.spieleFeldspiel()` bereits gemerged, PR6/7
aus `battle-mode-spielmodus-plan.md` noch nicht gebaut — `lib/battle/arena-headless-runner.ts`
existiert noch nicht). Alle Datei-/Zeilenangaben sind gegen den echten Code geprüft, nicht vermutet.
Wo eine Zahl gemessen statt aus einer Formel abgelesen ist, steht das ausdrücklich dabei — inklusive
der Einschränkung, **womit** gemessen wurde (s. Abschnitt 3).

---

## 0. Ausgangslage

`battle-mode-spielmodus-plan.md` Abschnitt 5.1 hält fest: Team-Punkte in Battle Mode sind
**entschieden** (Sieg=2/Unentschieden=1/Niederlage=0, eigene Ökonomie, entkoppelt von
`getRankToPointsValue()`). Im selben Abschnitt eine **Zusatzentscheidung, aber noch kein Modell**:
Chris will individuelle Spieler-PPs in Battle Mode vollständig von den Team-Punkten entkoppeln.
Live präzisiert hat er das so (sinngemäß):

> Die Spieler bekommen ihre Punkte entkoppelt vom Team. Ein Team bekommt für einen Sieg zwei Punkte,
> aber ich wollte trotzdem, dass die Spieler z. B. bis zu sechs oder fünf PPs pro Disziplin
> bekommen — ein Topspieler z. B. fünf, ein mittlerer Spieler ca. 2,5, ein schlechter Spieler 0,5.
> Als Beispiel. Natürlich dynamisch, basierend auf dem, was sie im Spiel geleistet haben — wirklich
> simuliert im Gameplay. Deswegen der Punkt mit dem Impact Rating.

**Die Zahlen 5/2,5/0,5 sind ausdrücklich ein Beispiel, keine Vorgabe** — die Projektregel „keine
erfundenen Werte" (`docs/BATTLE_ARENA_UEBERGABE.md`, ganz oben) gilt hier genauso. Dieses Dokument
hält deshalb an keiner Stelle einen Zahlenwert fest, ohne zu sagen, woher er kommt, und trennt
sauber zwischen **Formel-Struktur** (das eigentliche Ergebnis dieses Vorschlags) und **konkreten
Eckwerten** (offene Fragen an Chris, Abschnitt 6).

---

## 1. Wie PPs heute vergeben werden (Manager Mode, PPS-Pfad) — mit realen Eckwerten

### 1.1 Der Mechanismus

`lib/resolve/legacy-matchday-resolve-engine.ts` Z. 698–755: Team-Ränge einer Liga werden per
`rankWithinLeagueScope()` gebildet, dann läuft **derselbe** Rang durch zwei Funktionen aus
`lib/resolve/rank-to-points.ts`:

1. **`getRankToPointsValue(playerCount, rank)`** (Z. 118–124) schlägt in
   `references/sheets/rank-to-points.json` nach und liefert die **Team-Gesamtpunktzahl** für diesen
   Rang bei dieser Feldgröße (`playerCount` = Spieler pro Seite dieser Disziplin, **nicht**
   Team-Zahl in der Liga).
2. **`distributeRankPointsToPlayers()`** (Z. 146 ff.) verteilt diese Team-Gesamtpunktzahl auf die
   Spieler **proportional zu ihrem `finalPlayerScore`-Anteil** (`distributeByValues`, Z. 98–116,
   mit `baseValue`- bzw. `scoreContribution`-Fallback, falls kein Spieler einen positiven
   `finalPlayerScore` hat). Ein Spieler mit `finalPlayerScore ≤ 0` bekommt **0**, nie einen negativen
   Anteil (Z. 104: `value > 0 ? value : 0`) — das ist bereits heute die geltende Bodenregel im
   bestehenden System, kein neuer Vorschlag (relevant für Abschnitt 6, offene Frage zu negativen
   Impact-Werten).

Die Summe der Spieler-PPs eines Teams ergibt also **exakt** die Team-Gesamtpunktzahl aus Schritt 1 —
individuelle PPs sind heute strukturell ein **Anteil am Team-Ergebnis**, nicht unabhängig davon. Genau
diese Kopplung will Chris für Battle Mode auflösen.

### 1.2 Der reale Wertebereich für Basketball — nachgemessen, nicht geschätzt

**Wichtiger Fund, der die Frage komplizierter macht, als sie klingt: Basketballs `playerCount` ist
NICHT konstant 6.** Der Disziplin-Katalog (`lib/player-generator/official-discipline-weights.ts:60`)
trägt zwar `{ id: "basketball", playerCount: 6 }` als **Default**, aber `resolveDisciplinePlayerCount()`
(`lib/resolve/rank-to-points.ts:126–144`) liest zuerst `seasonState.disciplineSchedule` — die
tatsächlich für DIESEN Spieltag gewürfelte Feldgröße — und fällt nur auf den Katalogwert zurück, wenn
der Spielplan nichts sagt. Nachgemessen an einer echten durchgespielten Saison
(`tests/_fixtures/season1-regression/season1-matchday-results.csv`, dokumentiert in
`lib/season/season-points-prize-regression.ts:227–248`, wörtlich: „15 von 20 Disziplinen weichen ab —
[…] Basketball 6 gegen 2"): in dieser Saison lief Basketball an Spieltag 4 tatsächlich mit
**`playerCount = 2`**, nicht 6. Jede Aussage über „den" Basketball-Höchstwert muss diese Variabilität
mitnehmen.

Die Tabelle selbst (`references/sheets/rank-to-points.json`, 16er-Rangraum wegen Liga-Split):

| playerCount | Rang 1 (Team, gesamt) | Rang 1 ÷ playerCount | Rang 16 (Team, gesamt) | Rang 16 ÷ playerCount |
|---|---|---|---|---|
| 2 | 6,6 | **3,30** | 1,9 | 0,95 |
| 3 | 9,9 | **3,30** | 2,8 | 0,93 |
| 4 | 13,2 | **3,30** | 3,7 | 0,93 |
| 5 | 16,5 | **3,30** | 4,7 | 0,94 |
| 6 | 19,9 | **3,32** | 5,6 | 0,93 |

**Das ist eine saubere, nachgemessene Konstante, kein Zufall**: die Tabelle ist am Rang-1-Ende
praktisch exakt proportional zur Feldgröße — der **Durchschnittsspieler** eines Rang-1-Teams bekommt
unabhängig von `playerCount` rund **3,3 PPs**, ein Durchschnittsspieler eines Rang-16-Teams rund
**0,93 PPs**. Das ist der Wert, den ein Spieler mit exakt gleichem Anteil wie seine Mitspieler bekäme
(`distributeByValues` verteilt nach Score-Anteil, nicht gleich — ein herausragender Einzelspieler auf
einem Rang-1-Team liegt in der Praxis darüber, ein schwacher darunter, aber ohne eine reale
Score-Verteilung aus einem echten Spielstand lässt sich der reale Spitzenwert nicht beziffern, ohne
zu raten — das wird hier bewusst nicht getan). **Diese ~3,3/~0,93-Spanne ist der ehrlichste heute
verfügbare Anker dafür, in welcher Größenordnung sich Spieler-PPs für Basketball aktuell bewegen** —
und liegt in derselben Größenordnung wie Chris' eigenes Beispiel (5/2,5/0,5), ohne dass hier
irgendetwas darauf hin konstruiert wurde.

---

## 2. Die Impact-Formel für Basketball (PR #683) — und warum sie NICHT dieselbe ist wie im Kampf

`battle-mode-spielmodus-plan.md` Abschnitt 5.1 nennt die im Mockup gezeigte Spalte „reinen
Vorschau-Wert, kein echtes PPs-Modell". Nachgeprüft, was dahintersteckt:

### 2.1 Zwei verschiedene Formeln für zwei verschiedene Disziplin-Familien

`public/mockups/battle-mode.engine.js` hat **zwei völlig unabhängige** „Impact"-artige Berechnungen,
eine pro Chassis — **keine gemeinsame Formel**, entgegen einer naheliegenden Vermutung:

- **Kampf/Duell-Disziplinen (TDM, Battlefield, Fechten — `ARENA_ART`)**: `impactVon()` (Z. 11333–11348),
  die im Handoff-Dokument (`docs/BATTLE_ARENA_UEBERGABE.md` Z. 581 u. a.) beschriebene „abgeschriebene
  Formel des Vorbilds" — eine Sättigungskurve `Beitrag = Gewicht·(1−e^(−Menge/Referenz))` über
  Schaden/Heilung/Schild/Kontrolle/Frontlinie, mit einer Wechselkurstabelle (`IMP_G`/`IMP_R`/
  `IMP_STUECK`) aus abgetippten Tooltip-Werten. Diese Formel ist **komplett irrelevant für
  Basketball** — sie wird nur für Kampf-Einheiten (`u.st.dmg/heal/schild/…`) berechnet, Feldspiel-
  Spieler haben diese Felder gar nicht.
- **Feldspiel-Disziplinen (Basketball, Football, Hockey, Tennis — `FELDSPIEL_ART`)**: die
  IMPACT-Spalte im Wertungstisch (Z. 9317–9320, Kommentar „dieselbe Boxscore-Kompositwert wie
  `MOTOREN[disc].wert()`") und `MOTOREN[fd].wert()` selbst (Z. 12290–12314, PR #683/Z. `ac19f0cb`)
  sind **dieselbe, viel einfachere lineare Formel**:

  ```js
  impact = punkte + assists*1.0 + rebounds*1.2 + (steals+bloecke)*1.5 - verluste*0.8
  ```

  Keine Sättigung, keine Wechselkurstabelle — ein einfacher gewichteter Box-Score, „Punkte zählen
  voll, Rebounds/Steal/Block etwas mehr, Ballverlust zieht ab" (Kommentar Z. 12291–12292, exakt
  das Zitat aus Fund 6 von `battle-mode-spielmodus-plan.md`).

**Für Basketball gibt es also nur EINE Formel, nicht zwei** — anders als im Kampf, wo
`impactVon()` (Anzeige/Tooltip) und `beitragVon()` (Z. 9146, `MOTOREN[ad].wert()`, nur für Kampf
verwendet) unterschiedliche Größen sind. Für Feldspiel ist „Impact" (die UI-Spalte) und
`MOTOREN[fd].wert()` (der Messwert) **dieselbe Zahl**, per explizitem Code-Kommentar „keine zweite
Formel" (Z. 9318). Chris' „Impact Rating" ist für Basketball damit eindeutig identifiziert.

---

## 3. Was `spieleFeldspiel()` konkret liefert — und was es NICHT ist

`window.__arena.spieleFeldspiel(fd, saat)` (`battle-mode.engine.js` Z. 12510–12522, PR5, bereits
gemerged) gibt zurück:

```js
{ disziplin: fd, seiten: [punkteTeamL, punkteTeamR], boxscore: [{ name, wert }, …] }
```

`wert` ist exakt `MOTOREN[fd].wert()` aus Abschnitt 2.1 — ein **absoluter** Box-Score-Kompositwert,
**kein** Prozentanteil am Team (anders als bei den Kampf-Disziplinen, deren `MOTOREN[ad].wert()`
bewusst auf „Anteil am Gesamtbeitrag der Partie, 0–100" normiert, Z. 12225–12226, aus genau dem in
Z. 12160–12200 dokumentierten Grund: absolute Werte wachsen mit der Partie-Länge und würden ein
falsches Signal geben). Für Feldspiel ist dieser Umweg nicht gemacht — `wert` bleibt eine rohe,
unbegrenzte Zahl.

### Nachgemessen (diese Recherche, Playwright gegen `public/mockups/battle-mode.html`, dieselbe
Methode wie `scripts/miss-arena-spielefeldspiel.mjs`):

**Wichtige Einschränkung zuerst:** Gemessen wurde mit dem **Mockup-eigenen Demo-Kader** (derselbe
Satz Namen bei jedem Aufruf, nur der Seed variiert) — **nicht** mit echten Liga-Kadern über
`arena-kader-adapter.ts`. Die absoluten Zahlen verschieben sich, sobald echte Spieler-Attribute
durch den Motor laufen; die **Form/Streuung** der Verteilung (wie stark einzelne Spieler
auseinanderliegen) ist aber ein reales Merkmal der Formel selbst, nicht des Kaders, und damit
übertragbar.

Über 96 simulierte Spiele (1.152 Spieler-Werte, Seeds 5000, 5131, 5262, …):

| Kennzahl | Wert |
|---|---|
| Minimum | −2,4 |
| 10. Perzentil | 0,0 |
| Median | 4,4 |
| Durchschnitt | 5,3 |
| 90. Perzentil | 12,5 |
| Maximum | 23,9 |
| Ø Spanne (max−min) innerhalb eines einzelnen Spiels (12 Spieler) | ≈ 15,5 |

`wert` kann **negativ** werden (ein Spieler mit vielen Ballverlusten und wenig sonst) — die Formel
selbst kappt nicht bei 0, anders als die bestehende PPS-Verteilung (Abschnitt 1.1). Das ist eine
bewusste Design-Entscheidung, die für ein Battle-Mode-Modell übernommen oder korrigiert werden muss
(Abschnitt 6).

Ein konkretes gemessenes Spiel (Seed 5000, Endstand 13:23):

| Spieler | Impact (`wert`) |
|---|---|
| Cassandra | 16,0 |
| Tidesprinter | 13,2 |
| King Arlen Morgolor | 10,2 |
| Ralazar the Balanced | 7,2 |
| Johanna | 6,5 |
| Krolach | 5,1 |
| Seraph-11 | 4,9 |
| Gram | 3,2 |
| Lava Golem | 1,0 |
| Greenkraut | 0,4 |
| Krag'Zul | 0,0 |
| Draco | −0,6 |

Diese Streuung — von leicht negativ bis über 20, Median um 4–5 — ist die reale Rohgröße, mit der ein
PPs-Modell arbeiten müsste.

---

## 4. Liga-relative Skalierung — welches Muster passt, und was an Referenzdaten wirklich da ist

### 4.1 Perzentilrang ist das bereits etablierte Muster in diesem Codebase

Z-Score kommt in `lib/` an keiner Stelle vor (nachgeprüft per Volltextsuche). **Perzentilrang gegen
eine sortierte Liste dagegen mehrfach, an zentralen Stellen:**

- `lib/scouting/player-axis-star-rating.ts:82–97` (`percentileOf`) — binäre Suche über eine
  aufsteigend sortierte Werteliste, exakt das hier gebrauchte Muster, mit einem dokumentierten
  Performance-Grund für die binäre statt lineare Suche (Kommentar Z. 66–80: linear kostete
  266 µs/Spieler bei 2.984 Spielern = 794 ms Ladezeit für die ganze Liga).
- `lib/scouting/player-axis-star-rating.ts:104–110` (`percentileToCurrentAbilityStars`) — bildet ein
  Perzentil auf eine Ziel-Skala ab, mit bewusst **asymmetrischen** Bandgrenzen (Kommentar: „damit
  Bucket-Zahlen nicht mathematisch zu perfekt aussehen").
- `lib/sponsor/sponsor-commercial-rating-service.ts:16–23` (`percentileRank`) — dieselbe Idee, simpler
  (linearer Scan statt Binärsuche, für kleinere Listen ausreichend).
- `lib/foundation/player-league-heat.ts:56–81` — Liga-Perzentil-Label „Top 8 %" für Rang-Chips.
- `lib/economy/team-beliebtheit.ts:175,185` — Rang-Perzentil für „Erfolg", Min-Max-Perzentil für
  „Starpower" (der einzige gefundene Min-Max-Fall, nicht Perzentilrang — deutlich seltener als
  Perzentilrang im Rest des Codes).

**Empfehlung: Perzentilrang, nicht Z-Score, nicht rohe Min-Max-Normierung.** Begründung: Perzentilrang
ist robust gegen Ausreißer (ein einzelnes 23,9er-Spiel verzerrt keine andere Zahl, anders als bei
Min-Max, wo ein einzelner Extremwert die gesamte Skala staucht) und ist bereits der Standard-Ansatz
dieses Projekts für „ein Wert relativ zur Liga" — ein neues Team-Mitglied, das sich in den Code
einarbeitet, findet dasselbe Muster an vier anderen Stellen wieder.

### 4.2 Was an Referenzdaten zum Zeitpunkt eines Battle-Mode-Resolves wirklich vorhanden ist

Hier liegt der eigentliche Knackpunkt, den der Auftrag zu Recht als Kernfrage benennt.

**Basketball kommt in der heutigen Saisonstruktur genau EINMAL pro Saison vor**, nicht wiederholt:
`getRequiredSeasonDisciplineMatchdayCount()` (`lib/season/season-discipline-schedule.ts:165–167`)
teilt 20 Disziplinen auf `ceil(20/2) = 10` Spieltage auf — jede Disziplin, Basketball eingeschlossen,
bekommt in der aktuellen 10-Spieltage-Saison **einen einzigen** Termin. (Das könnte sich mit
`docs/design/fatigue-saisonlaenge-plan.md` Teil A ändern, 20 Spieltage à 2 Vorkommen je Disziplin —
das ist aber selbst noch ein offener Vorschlag, keine beschlossene Sache, und darf hier nicht als
gegeben vorausgesetzt werden.) **Konsequenz: „Rolling-Historie über vorherige Spieltage DERSELBEN
Saison" gibt es für Basketball beim heutigen Saisonzuschnitt schlicht nicht — es gibt keinen
vorherigen Basketball-Spieltag in derselben Saison, gegen den man rollen könnte.**

Was stattdessen zur Verfügung steht, an genau dem einen Spieltag, an dem Basketball läuft:

- Pro Liga (16 Teams) **8 Fixtures** (`battle-mode-spielmodus-plan.md` Abschnitt 3.3c).
- Pro Fixture 2 Seiten × `playerCount` Spieler — und `playerCount` ist laut Abschnitt 1.2 dieses
  Dokuments **nicht fix**, sondern 2–6, je nachdem, was `disciplineSchedule` für diesen Spieltag
  gewürfelt hat.
- Macht **32 bis 96 Spieler-Werte pro Liga**, **64 bis 192 über beide Ligen zusammen**, an genau
  diesem einen Spieltag — die einzige Referenzgruppe, die ohne neue Persistenz sofort existiert.

**Für eine mehrjährige/mehrsaisonale Rolling-Historie fehlt heute die Persistenz-Grundlage.**
`battle-mode-spielmodus-plan.md` Abschnitt 2.4 schlägt ein neues, additives
`seasonState.arenaMatchResultLogs`-Array vor (Seed, Team-IDs, Endstand, „Boxscore-Kennzahlen je
Spieler") — das ist aber ausdrücklich **noch nicht gebaut** (kein Treffer für
`arenaMatchResultLogs` im aktuellen Code) und Teil von PR 7/9 desselben Plans, nicht dieses
Vorschlags. Sollte PR7 dieses Log mit Spieler-Impact-Werten füllen, wäre eine spätere,
saisonübergreifende Erweiterung (z. B. „Perzentil gegen die letzten drei Basketball-Auftritte dieses
Spielers" oder „gegen alle bisherigen Basketball-Spieltage dieses Saves") technisch möglich — das ist
hier bewusst nur als Ausblick festgehalten, nicht Teil dieses Vorschlags, und hängt von einer Datei
ab, die dieser Auftrag ausdrücklich nicht anfassen soll.

### 4.3 Stichprobengröße — die Lehre aus `BATTLE_ARENA_UEBERGABE.md`, richtig eingeordnet

`docs/BATTLE_ARENA_UEBERGABE.md`, Abschnitt „Wie viele Läufe es braucht" (Z. 651–661): bei n=12
**Monte-Carlo-Läufen** las eine Attributmessung systematisch andere (zu günstige) Werte als bei
n=48 — „ein paar Attribute greifen den ganzen positiven Gewinn ab, der Rest liest null". **Das ist
eine andere Art von Stichprobenproblem als hier**: dort ging es um wiederholte Simulationsläufe
DERSELBEN Situation, um die Wirkung eines Attributs herauszumessen (Rauschen mittelt sich bei
kleinem n schlecht heraus). Hier geht es um die Poolgröße **verschiedener, echter Spieler** an
einem Spieltag, aus der ein Perzentilrang gebildet wird — kein Rauschen, das sich herausmitteln
müsste, sondern eine reale Verteilung mit einer bestimmten Auflösung.

Trotzdem bleibt eine reale Konsequenz: **bei `playerCount = 2` ist der Pool pro Liga nur 32
Spieler groß.** Ein Perzentilrang mit 32 Einträgen hat eine Auflösung von etwa 3 Prozentpunkten pro
Rangplatz — der oberste Spieler bekommt rechnerisch das 100. Perzentil, der zweitbeste schon nur
noch das 97., und an den Rändern (Top-1, Bottom-1) reagiert das Ergebnis empfindlich auf einen
einzelnen Ausreißer. Bei 96 Spielern (playerCount=6) ist dieselbe Auflösung mit ca. 1 Prozentpunkt
pro Rang spürbar stabiler. **Empfehlung, mit Begründung**: **beide Ligen zu einem gemeinsamen
Referenz-Pool zusammenfassen statt pro Liga getrennt zu perzentilieren** — verdoppelt die Poolgröße
ohne jeden Zusatzaufwand (beide Ligen spielen dieselbe Disziplin mit derselben Feldgröße am selben
Spieltag), und ist für eine **individuelle** Spielerbewertung sachlich naheliegender als für
Team-Standings: der Liga-Split trennt bewusst Wettbewerbsräume für **Tabellen** (siehe
`liga-split-plan.md`), sagt aber nichts darüber, ob ein Perzentil für individuelle Spielerleistung
ligenübergreifend oder -intern gebildet werden soll — das ist eine eigene Entscheidung (Abschnitt 6).

---

## 5. Vorgeschlagenes Modell

**Schritt 1 — Rohwert je Spieler.** Für jedes der 8+8 Fixtures eines Spieltags:
`window.__arena.spieleFeldspiel("basketball", seed)` liefert `boxscore: [{name, wert}]` mit `wert`
gemäß Abschnitt 2.1/3 (dieselbe Formel, die schon heute im Mockup als „Impact" angezeigt wird — kein
neuer Rechenweg, kein zweites Modell, siehe Chris' eigener Wunsch nach dem Impact Rating als
Grundlage).

**Schritt 2 — Referenz-Pool bilden.** Alle `boxscore`-Werte aller Basketball-Fixtures **beider**
Ligen desselben Spieltags zusammenfassen (Begründung Abschnitt 4.3) zu einer sortierten Liste
`ligaPool` — genau das, was `percentileOf()` als zweites Argument erwartet
(`lib/scouting/player-axis-star-rating.ts:82`, als direktes Vorbild für die Implementierung, keine
neue Perzentil-Funktion nötig, dasselbe Muster wiederverwendbar).

**Schritt 3 — Perzentilrang je Spieler.** `perzentil = percentileOf(spieler.wert, ligaPool)`, 0–100.

**Schritt 4 — Perzentil auf PPs abbilden.** Einfachster, ehrlichster Ansatz:

```
spielerPPs = (perzentil / 100) * DISCIPLINE_MAX
```

`DISCIPLINE_MAX` ist der einzige noch offene Zahlenwert (Abschnitt 6) — und genau hier entsteht,
**ohne dass irgendetwas hartkodiert wurde**, exakt die Struktur, die Chris beschrieben hat: das
100. Perzentil (Topspieler des Spieltags) bekommt `DISCIPLINE_MAX`, das 50. Perzentil
(Durchschnittsspieler) automatisch die **Hälfte** davon, ein schwacher Spieler nahe dem unteren Rand
(z. B. 10. Perzentil) automatisch nur **ein Zehntel**. Die Ankerpunkte „Topspieler nahe Höchstwert,
Mitte ~halb, schwach nahe null" sind damit eine **mathematische Konsequenz der Perzentil-Definition**,
nicht drei separat gesetzte Zahlen — das ist der Sinn dieser Konstruktion.

**Bodenregel, konsistent mit Abschnitt 1.1**: `perzentil` kann per Definition nicht negativ werden
(0–100), auch wenn der zugrunde liegende `wert` negativ war (Abschnitt 3: gemessen bis −2,4) — ein
Spieler mit dem schlechtesten `wert` des Pools bekommt Perzentil 0, also 0 PPs, nie negative PPs.
Das spiegelt exakt die bestehende Bodenregel aus `distributeByValues` (Abschnitt 1.1), ohne sie neu
erfinden zu müssen.

---

## 6. Durchgerechnetes Beispiel

Auf das in Abschnitt 3 gemessene Beispielspiel (Seed 5000) angewendet, mit dem in Abschnitt 4.2
gebildeten 96-Spiele-Pool (1.152 Werte) als Referenzgruppe und **zwei** Kandidatenwerten für
`DISCIPLINE_MAX`, um zu zeigen, wie stark das Ergebnis von dieser einen offenen Zahl abhängt
(**beide Werte sind Platzhalter zur Veranschaulichung, keine Empfehlung** — Anker-Kandidaten dafür
stehen in Abschnitt 6):

| Spieler | Impact (`wert`) | Perzentil im Pool | PPs bei MAX=19,9 | PPs bei MAX=6,6 |
|---|---|---|---|---|
| Cassandra | 16,0 | 96,1 % | 19,12 | 6,34 |
| Tidesprinter | 13,2 | 90,8 % | 18,07 | 5,99 |
| King Arlen Morgolor | 10,2 | 82,9 % | 16,50 | 5,47 |
| Ralazar the Balanced | 7,2 | 69,3 % | 13,78 | 4,57 |
| Johanna | 6,5 | 65,6 % | 13,06 | 4,33 |
| Krolach | 5,1 | 54,6 % | 10,87 | 3,60 |
| Seraph-11 | 4,9 | 52,3 % | 10,42 | 3,45 |
| Gram | 3,2 | 39,7 % | 7,89 | 2,62 |
| Lava Golem | 1,0 | 17,9 % | 3,56 | 1,18 |
| Greenkraut | 0,4 | 12,5 % | 2,49 | 0,82 |
| Krag'Zul | 0,0 | 5,6 % | 1,12 | 0,37 |
| Draco | −0,6 | 4,3 % | 0,85 | 0,28 |

**Beobachtung, kein Vorschlag**: Bei `MAX = 6,6` (dem Rang-1-Team-Gesamtwert der 2-Spieler-Reihe aus
Abschnitt 1.2) landet der Topspieler dieses Beispiels bei 6,3 PPs, der Median-Bereich um 3,5–4,6, ein
schwacher Auftritt bei 0,3–0,8 — das trifft die **Größenordnung** von Chris' eigenem Beispiel
(5/2,5/0,5) auffällig genau, obwohl an keiner Stelle danach gesucht wurde. Das ist ein Indiz dafür,
dass die vorgeschlagene Struktur (Perzentil × sinnvoll gewählter Höchstwert) in der richtigen
Größenordnung liegt — **kein Beweis, dass 6,6 der richtige `DISCIPLINE_MAX` ist**, nur dass die
Formel-Form plausibel skaliert.

---

## 7. Offene Fragen an Chris

Diese Fragen sind ausdrücklich **echte Design-Entscheidungen**, die nicht aus bestehenden Fakten
folgen — anders als der Rest dieses Dokuments, das sich auf Nachgemessenes/Nachgelesenes stützt.

1. **`DISCIPLINE_MAX` — ENTSCHIEDEN (31.08.): fest**, nicht mit `playerCount` skaliert. Der
   konkrete Zahlenwert selbst ist damit noch nicht gesetzt — Kandidaten aus Abschnitt 1.2 sind
   ≈3,3 (Rang-1-Durchschnitt, nachgemessen) oder ≈6,6 (das Doppelte, trifft Chris' eigenes Beispiel
   am nächsten). Rückfrage an Chris folgt separat, welcher konkrete Wert gilt.
2. **Referenz-Pool — ENTSCHIEDEN (31.08.): gemeinsam über beide Ligen**, nicht getrennt. Chris
   ergänzend: „wir könnten später noch die PPs in Liga 2 zur Not runter skalieren mit einem
   Faktor" — als möglicher **späterer** Ausbau festgehalten (z. B. ein Liga-2-Abwertungsfaktor,
   falls sich in der Praxis zeigt, dass eine schwächere zweite Liga sonst zu leicht an PPs kommt),
   **nicht** Teil der ersten Umsetzung. Bewusst nicht weiter spezifiziert, bis ein echter Bedarf
   danach sichtbar wird — kein Wert dafür in dieser Phase erfinden.
3. **Reine Basketball-Teilnehmer als Pool, oder auch nominierte, aber nicht eingesetzte Spieler?**
   Da `playerCount` pro Spieltag fix ist und laut `legacy-matchday-partial-lineup-rule.ts`-Prinzip
   (Abschnitt 5.3 von `battle-mode-spielmodus-plan.md`, „Unterzahl antreten lassen") auch
   unvollständige Aufstellungen antreten, stellt sich die Frage nur am Rand — aber: zählt ein Team,
   das mit 4 statt 6 Spielern antritt, mit 4 oder mit 6 (fiktiven Nullwerten) in den Pool ein? Ersteres
   scheint konsistenter mit „nur echte Leistung wird bewertet", ist aber eine Entscheidung.
4. **Kleine Stichprobe bei `playerCount = 2` (32–64 Pool-Größe, Abschnitt 4.3): tolerieren oder
   abfedern?** Optionen wären ein Mindest-Pool (z. B. bei zu kleiner Feldgröße automatisch beide
   Ligen zusammenfassen, selbst wenn Frage 2 sonst „getrennt" beantwortet wird), oder es einfach so
   stehen zu lassen, weil 32 echte Spieler-Leistungen (anders als die in Abschnitt 4.3 diskutierten
   Monte-Carlo-Läufe) immer noch eine reale, keine simulierte Stichprobe sind.
5. **Linear oder gebändert?** Der Vorschlag in Abschnitt 5 ist bewusst die einfachste mögliche
   Abbildung (linear). `percentileToCurrentAbilityStars`
   (`lib/scouting/player-axis-star-rating.ts:104–110`) zeigt das bereits etablierte Gegenmodell:
   asymmetrische Bänder, die echte Ausreißer nach oben stärker belohnen als die lineare Mitte. Will
   Chris diese Schärfung, oder ist „linear, einfach nachvollziehbar" für den ersten Wurf richtig
   (leichter zu erklären, leichter zu debuggen, kann später verschärft werden)?
6. **Rolling-Historie als späterer Ausbau (Abschnitt 4.2) — gewünscht, sobald die Datenlage es
   erlaubt (`arenaMatchResultLogs` aus PR7/9), oder soll Battle-Mode-Basketball-PPs bewusst dauerhaft
   nur den einen Spieltag betrachten, an dem Basketball läuft, unabhängig davon, was in Zukunft an
   Historie verfügbar wird?**
7. **Integrations-Reichweite (nicht Teil dieses Modells, aber ein Anschluss-Risiko)**: heutige PPs
   fließen u. a. in `lib/foundation/player-points-total.ts` / `lib/foundation/season-points-ledger.ts`
   (Saison-Leaderboards) und potenziell in Progressions-/Marktwert-Berechnungen. Sollen
   Battle-Mode-Basketball-PPs genau in dieselben Töpfe einzahlen wie PPS-PPs (obwohl sie jetzt eine
   strukturell andere Bedeutung haben — „Perzentil-Anteil an einem Spieltag" statt „Anteil am
   Team-Rang"), oder braucht Battle Mode dafür eine eigene, sichtbar getrennte Kennzahl? Das ist
   keine Frage dieses Dokuments, aber eine, die vor dem Bau beantwortet sein sollte, weil sie
   entscheidet, ob bestehende Downstream-Systeme unverändert weiterlaufen oder mitgezogen werden
   müssen.

---

## 8. Kern-Dateien für den Einstieg (falls Chris entscheidet und jemand baut)

- `lib/resolve/rank-to-points.ts` (bestehendes Perzentil-fremdes PPS-Modell, Vorbild für
  `distributeByValues`-Rundungslogik, Abschnitt 1.1)
- `references/sheets/rank-to-points.json` (reale Eckwerte, Abschnitt 1.2)
- `public/mockups/battle-mode.engine.js` Z. 12290–12314 (`MOTOREN[fd].wert()`, die Impact-Formel
  selbst), Z. 12510–12522 (`spieleFeldspiel()`, die Datenquelle)
- `lib/scouting/player-axis-star-rating.ts` Z. 63–110 (`percentileOf`/`percentileToCurrentAbilityStars`,
  direktes Vorbild für Schritt 2–4 in Abschnitt 5)
- `lib/season/season-discipline-schedule.ts` (liefert `disciplineSchedule`, damit den echten
  `playerCount` des Spieltags — Voraussetzung für Frage 1)
- `battle-mode-spielmodus-plan.md` Abschnitt 2.4/3.3c (wo ein Arena-Ergebnis heute schon in die
  Resolve-Pipeline eingehängt wird — der natürliche Ort, an dem `spielerPPs` aus Abschnitt 5 zusätzlich
  gesetzt werden müsste, ohne die dortige Team-Punkte-Logik anzufassen)
