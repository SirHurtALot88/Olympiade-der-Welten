# Leaders-Ausbau — Entwurf (Welt › Leaders)

Stand: 2026-08-01 · Bezug: Feedback von Chris (Saison 1, MD 10 gespielt)
Betroffene Ansicht: `app/foundation/league-leaders-v2/LeagueLeadersNewLook.tsx` mit den vier Reitern
Liga-Leaders · Rekorde · Legendäre Spieler · Erfolge.

---

## 0. Leitprinzip: Eine Karriere-Quelle = Archiv + laufende Saison

Der Kernbefund aus dem echten Spielstand: `seasonSnapshots` ist in Saison 1 leer, und **Rekorde**
und **Legendäre Spieler** lesen ausschließlich daraus. Zwei von vier Reitern sind damit genau in
der Kennenlern-Phase tot.

Die Lösung ist keine zweite "In-Season-Ansicht" neben der Archiv-Ansicht, sondern **eine
gemeinsame Quelle**, die Archiv und laufende Saison zusammenführt:

- `buildPlayerLeagueCareerStatsMap` (`lib/foundation/player-league-career-stats.ts`) **kann das
  bereits**: Sie nimmt optional `currentSeasonLedger` / `currentSeasonPerformanceByPlayerId`
  entgegen und dedupliziert sauber über `seasonId` (die laufende Saison wird nur gezählt, solange
  sie nicht als Snapshot existiert). **`buildLeagueRecordsHallOfFame` ruft sie aber ohne diese
  Optionen auf** — deshalb sind die Karrieredaten in S1 leer, obwohl der Merge-Mechanismus
  existiert. Das ist der billigste einzelne Fix im ganzen Entwurf.
- Der granulare Unterbau der laufenden Saison ist
  `gameState.seasonState.playerDisciplinePerformances` (pro Spieler × Disziplin × Spieltag:
  `finalPlayerScore`, `scoreContribution`, `rankInDiscipline`, `rankInTeam`, `isTop10`,
  `isMvpCandidate`, `mutatorPpsBonus`) plus der daraus normalisierte
  `seasonPointsLedger` (`lib/foundation/season-points-ledger.ts`) mit
  `playerSummariesByPlayerId` inkl. **`pointsByTeamId`**, `pointsByDiscipline`, `pointsByArea`.
- Entscheidend für den Übergang: `lib/season/season-snapshot-service.ts` **archiviert
  `disciplineResults` und `playerDisciplinePerformances` 1:1 in den Snapshot** (Zeilen ~177–180
  und ~571–572). Jeder Rekord/Award, der heute aus den Live-Daten gerechnet wird, ist also später
  aus denselben Feldern im Archiv reproduzierbar — **ein Resolver, zwei Datenlagen, kein
  Persistenz-Umbau nötig.**
- `gameState.transferHistory` (331 Einträge, save-weit, überlebt Saisonwechsel) ist die eine
  Quelle für alle Transfer-Rekorde — die heutige Snapshot-basierte Zweitquelle
  (`snapshot.transferSnapshots` in `league-records-hall-of-fame.ts`) wird dafür aufgegeben
  (Hausregel: eine Quelle je Größe).

Alle Sektionen unten bekommen ein einheitliches Herkunfts-Etikett je Wert:
**„Saison 1 · laufend"** (nur laufende Daten) bzw. **„All-Time"** (Archiv ∪ laufend). Wenn später
Saisons archiviert werden, ändert sich nur das Etikett und die Datenmenge — nie die Ansicht.

> Anmerkung zur Messung: `playerDisciplinePerformances` war in der Spielstand-Messung nicht
> aufgeführt. Der Code behandelt sie als die Live-Quelle der Spieler-PPs (siehe
> `buildPlayerSeasonPerformanceMap`), und die Leaders-Kacheln zeigen in S1 echte PPs — sie ist
> also befüllt. Vor der Umsetzung einmal die Zeilenzahl gegenprüfen (erwartet: Größenordnung
> 10 Spieltage × aufgestellte Spieler × 2 Seiten).

---

## 1. Top-5 aufklappen → Top 50 / Alle

**Wunsch:** *„…dass man in jede top 5 rein klicken kann auf nen button und dann die tabelle
aufgeht wo man z.B. dann ne top 50 oder so sehen kann oder sogar alle."*

**Woher kommen die Daten.** Die vollständige Rangliste existiert bereits:
`seasonTopPlayerRows` in `use-foundation-shell-router-body-scope.tsx` (~Z. 9880) enthält **alle
332 gerosterten Spieler**, fertig sortiert und mit `rank` versehen. `buildLeagueLeaderBoards`
(`league-leaders-service.ts`) schneidet daraus nur `LEAGUE_LEADER_DEFAULT_LIMIT = 5` ab. Der
Drawer (`NlRankingDrawer`) existiert ebenfalls schon — er bekommt heute nur die 5 Zeilen.

**Entwurf.**
- `buildLeagueLeaderBoards` wird einmal **ohne Kappung** aufgerufen (`limit: Infinity` bzw. neues
  Feld `fullEntries` je Kategorie). Die Kategorie-Karte rendert weiterhin `entries.slice(0, 5)`
  — es gibt **keine zweite Berechnung**, nur zwei Sichten auf dieselbe Liste. 332 Zeilen × 8
  Kategorien sind rechnerisch trivial (ein `useMemo` im Shell-Scope reicht).
- Jede Kategorie-Karte bekommt unter der Top-5-Liste einen Button **„Ganze Rangliste"** (statt
  nur der klickbaren Stat-Chips). Er öffnet den bestehenden Drawer mit gestaffelter Anzeige:
  zuerst **Top 50**, am Listenende ein Button **„Alle 332 anzeigen"** (Zahl dynamisch). Die
  Staffelung ist reine Render-Kappung, keine Datenkappung.
- Im Drawer bleiben die bestehenden Mechanismen erhalten: eigene Spieler markiert
  (`isOwn`), Klick öffnet das Profil, Highlight-Scroll. Neu: ein Sprungziel **„Zu meinem
  Besten"** (scrollt zum bestplatzierten eigenen Spieler — der Rang ist jetzt immer bekannt,
  das ehrliche „außerhalb Top 5" entfällt und wird zu „#87 · Name").
- Training-Kategorie identisch (Quelle `buildLeagueTrainingLeaderRows`, ebenfalls alle Spieler).

**Warum interessant.** Der Spieler sieht endlich, *wo genau* sein Kader in der Breite steht —
nicht nur ob jemand Top-5 ist. „Dein Bester: #87" ist eine echte Information, „außerhalb Top 5"
war keine.

---

## 2. Saison-Awards für Spieler

**Wunsch:** *„…ob wir hier noch mehr awards vergeben könnten für spieler basierend auf ihren
achievements? überleg mal was."*

**Woher kommen die Daten.** Neuer Selector `lib/foundation/league-season-awards.ts` →
`buildLeagueSeasonAwards(gameState)`. Er liest ausschließlich:

- `seasonPointsLedger` (normalisierte PPs je Auftritt, `pointsByDiscipline`, `pointsByArea`,
  `pointsByTeamId`, `appearances`),
- `buildPlayerSeasonPerformanceMap` (Spieltags-Breakdown je Spieler: `matchdayBreakdown`),
- die rohen `playerDisciplinePerformances` (`rankInDiscipline`, `isTop10`, `isMvpCandidate`,
  `mutatorPpsBonus`),
- `transferHistory` (Transferwege der laufenden Saison).

Da Snapshots dieselben Felder tragen, kann derselbe Selector später je archivierter Saison die
„Awards der Saison X" nachrechnen — Awards müssen **nicht** persistiert werden.

**Mindest-Einsatz-Schwelle.** Eine Saison hat 10 Spieltage à 2 Disziplinseiten, ein Spieler kommt
also auf maximal ~20 Einsätze. Awards, die Durchschnitte oder Konstanz messen, verlangen
**mindestens 6 Einsätze** (≈ ein Drittel des Maximums), sonst gewinnt ein Ein-Auftritt-Ausreißer.
Awards, die reine Zähler sind (Siege, Top-10s), brauchen keine Schwelle.

**Die Awards** (jede Bedingung ist gegen die genannten Felder prüfbar; bei Gleichstand entscheidet
der höhere Saison-PPs-Wert, danach Name):

| Award | Bedingung (prüfbar) | Erzählung |
|---|---|---|
| **Der Spezialist** | Höchster Anteil `pointsByDiscipline[best] / totalPoints` unter allen Spielern mit `totalPoints` ≥ Liga-Median (der Spieler mit ≥1 Einsatz) und ≥3 Einsätzen in dieser Disziplin | „In genau einer Sache unschlagbar" |
| **Der Allrounder** | Punkte > 0 in allen vier Bereichen (`pointsByArea`); Gewinner = größter *kleinster* Bereichsanteil (max-min-Prinzip), ≥6 Einsätze | Das Gegenstück: überall verlässlich |
| **Mr. Zuverlässig** | Kleinster Variationskoeffizient der Spieltagswerte (`matchdayBreakdown[].totalContribution`), unter Spielern mit Einsätzen an ≥8 von 10 Spieltagen und `totalPoints` ≥ Liga-Median | Konstanz statt Feuerwerk |
| **Big-Match-Spieler** | Größtes Verhältnis bester Spieltag ÷ eigener Spieltags-Durchschnitt, ≥6 Einsätze | Der Ausreißer nach oben |
| **Disziplin-Dominator** | Meiste Auftritte mit `rankInDiscipline === 1` **in derselben Disziplin** (mind. 2) | Seriensieger auf einer Bühne |
| **Top-10-Dauergast** | Meiste Auftritte mit `isTop10 === true` | Immer vorne dabei |
| **MVP-Kandidat der Saison** | Meiste Auftritte mit `isMvpCandidate === true` (mind. 1) | Der Spieltags-Held |
| **Neuzugang der Saison** | Unter Spielern mit `transferType "buy"` in der laufenden `seasonId`: höchste `pointsByTeamId[toTeamId]` (nur die für den Käufer erspielten Punkte) | Der Transfer, der eingeschlagen hat |
| **Das Schnäppchen** | Wie Neuzugang, aber Rangfolge nach `pointsByTeamId[toTeamId] / fee` (nur `fee > 0`) | Punkte pro Gold |
| **Der Wanderpokal** | `pointsByTeamId` mit Punkten > 0 für die meisten Teams (mind. 2); Tie-Break Gesamt-PPs | Hat für halb die Liga gepunktet |
| **Der Dauerbrenner** | Meiste `appearances` (Ledger) | Nie rotiert, nie gefehlt |
| **Mutator-Profiteur** | Höchste Summe `mutatorPpsBonus` (nur wenn > 0) | Wer die Sonderregeln am besten ausnutzt |

**Bewusst weggelassen:** Ein Form-Award auf Spielerebene. `formModifier` existiert nur pro
**Team** und Disziplin (`DisciplineResultRecord.formModifier`) — ein Spieler-Form-Award wäre
erfunden. Der Team-Formwert wandert stattdessen in die Rekorde (Punkt 3).

**Was sieht der Spieler.** Neue Sektion **„Saison-Awards"** im Reiter Liga-Leaders, unterhalb des
Kategorien-Grids: eine Karte pro Award mit Halter, Wert, Team, Eigenteam-Markierung und einem
Tooltip, der die Bedingung in einem Satz erklärt („Kleinste Schwankung über mindestens 8
Spieltage"). Eyebrow: „Stand Spieltag X · wird laufend neu vergeben". Klick öffnet das
Spielerprofil. Nach Saisonende zeigt dieselbe Sektion die endgültigen Award-Gewinner der
gewählten Saison (Saison-Schalter, sobald Archive existieren).

**Warum interessant.** Jeder Award erzählt eine Rolle (Spezialist vs. Allrounder, Konstanz vs.
Ausreißer, Schnäppchen vs. Rekordkauf) statt nur „höchste Zahl" — und weil laufend neu vergeben
wird, gibt es jeden Spieltag etwas zu prüfen.

---

## 3. Rekorde-Tab lebendig machen

**Wunsch:** *„der rekorde tab ist noch tot da passiert fast gar nichts, keine interessanten infos"*

**Struktur-Entscheidung.** Der Reiter wird ein **Rekordbuch**: eine Liste von Rekord-Definitionen,
jede mit genau **einem** Resolver über (laufende Saison ∪ archivierte Saisons). In Saison 1 stammt
jeder Halter zwangsläufig aus S1 — das ist kein Leerzustand, sondern die Geburt des Rekordbuchs
(„Rekord aufgestellt: Saison 1, Spieltag 7"). Spätere Saisons müssen die Marken brechen. Das
bisherige `hasHistory`-Gate und die Trennung „Saison-Bestwerte (laufend)" vs. „All-Time" entfallen
zugunsten des Herkunfts-Etiketts aus Abschnitt 0.

**Neue Rekorde aus laufenden Daten** (Erweiterung von `league-records-hall-of-fame.ts`, bzw. dort
wo Snapshots heute die Quelle sind, Umstellung auf die Live+Archiv-Quelle):

*Spieltags-Superlative* — Quelle `playerDisciplinePerformances` + `disciplineResults`:
- **Bester Einzelauftritt**: höchster `finalPlayerScore` einer einzelnen Performance (Spieler, Disziplin, Spieltag).
- **Bester Spieltag eines Spielers**: höchste Spieltagssumme aus `matchdayBreakdown`.
- **Bestes Team-Ergebnis**: höchster `totalScore` eines Teams in einer Disziplin (`disciplineResults`).
- **Knappster Disziplinsieg**: kleinste Differenz `totalScore` zwischen Rang 1 und Rang 2 derselben Disziplin desselben Spieltags.
- **Höchster Form-Schub**: größter `formModifier` eines Teams in einer Disziplin (das Zuhause des Team-Formwerts, s. o.).

*Serien* — Quelle `disciplineResults`/`playerDisciplinePerformances`, chronologisch über `matchdayResultId` → `matchdayId`:
- **Längste Team-Siegesserie**: meiste aufeinanderfolgende Spieltage, an denen ein Team mindestens eine Disziplin gewann (`rank === 1`).
- **Längste Top-10-Serie eines Spielers**: aufeinanderfolgende Spieltage mit mindestens einem `isTop10`-Auftritt.
- Laufende Serien werden markiert („läuft — seit Spieltag 4"), gebrochene mit Zeitraum.

*Transfermarkt* — Quelle `gameState.transferHistory` (ab sofort die **einzige** Quelle, die
Snapshot-Transferliste wird nicht mehr gelesen):
- **Rekord-Ablöse** (höchste `fee`, `transferType !== "contract_exit"`) — lebt mit 331 Einträgen sofort.
- **Aktivstes Team**: meiste Käufe+Verkäufe.
- **Größtes Transfervolumen einer Saison** (Summe `fee` je Team und `seasonId`).
- **Teuerster Kader-Umbau in einer Phase** (Gruppierung über `phase`).

*Bestehende Karten* (Kaderwert, Board-Vertrauen, MW-Sprung) bleiben; Kaderwert bekommt zusätzlich
den Live-Wert aus `buildTeamSquadMarketValues` als aktuellen Herausforderer des Archiv-Rekords
angezeigt („All-Time: 12.400 (S1) · aktuell: 12.980 — neuer Rekord bei Saisonende").
MW-Sprung und Board-Vertrauen brauchen echte Vor-/Nach-Saison-Vergleiche und bleiben bis zum
ersten Archiv ehrlich leer — aber als **sichtbare, erklärte Platzhalter** („entsteht mit dem
ersten Saisonabschluss") statt eines pauschalen Leertexts für den halben Tab.

**Was sieht der Spieler.** Drei Karten-Gruppen (Spieltags-Superlative · Serien · Transfermarkt ·
Klassiker), jede Karte mit Halter, Wert, Kontext (Disziplin/Spieltag/Saison), Herkunfts-Etikett
und Profil-Link. In S1 sind ~12 von ~15 Karten sofort gefüllt.

**Warum interessant.** „Knappster Disziplinsieg: 0,4 Punkte" und „läuft seit Spieltag 4" sind
Geschichten, keine Verwaltungsdaten — und weil jeder Spieltag Rekorde brechen kann, gibt es einen
Grund, nach jedem Spieltag reinzuschauen.

---

## 4. Legendäre Spieler definieren

**Wunsch:** *„Legendäre spieler definieren"* — eine Definitionsfrage.

**Grundsatz.** Legende ist ein **verliehener Status mit prüfbaren Kriterien**, nicht „Top 25 der
Karriere-PPs-Liste" (das ist die Ewige Tabelle, Punkt 5). Die Schwellen sind **relativ zur
Liga-Struktur** definiert (32 Teams, ~330 Kaderspieler, max. ~20 Einsätze/Saison), nicht als
absolute Magic Numbers — so bleiben sie gültig, wenn sich das Balancing verschiebt.

**Kriterienkatalog** (Quelle jeweils: Karriere-Map inkl. Live-Merge aus Abschnitt 0 sowie je
Snapshot dessen `playerPerformances`/`finalStandings`):

1. **Dauer** — *„War lange da":* Einsätze in mindestens **3 Saisons** mit jeweils ≥ der Hälfte
   der möglichen Einsätze. Begründung: Eine Legende ist keine Eintagsfliege; drei Saisons sind
   bei 10 Spieltagen/Saison die kürzeste Spanne, in der „Ära" ein ehrliches Wort ist.
2. **Volumen** — *„Gehört zu den Größten":* Karriere-PPs in den **Top 1 %** aller Spieler, die je
   gepunktet haben (bei ~3000 Spielern im Pool: etwa die besten 30). Begründung: Perzentil statt
   Festwert — skaliert automatisch mit Ligagröße und Punkte-Inflation.
3. **Dominanz** — *„Hat eine Saison geprägt":* mindestens **1× Saison als Nr. 1** einer
   Leader-Kategorie abgeschlossen (je Snapshot: Rang 1 nach `pps` bzw. den Bereichs-Punkten der
   `playerPerformances`) **oder** MVP-Award-Führung einer Saison. Begründung: Legenden werden an
   Spitzenmomenten erinnert, nicht an Durchschnitt.
4. **Titel** — *„Hat etwas gewonnen":* stand im Saisonkader eines Meisters (Spieler-`teamId` im
   Snapshot = Team mit `rank === 1` in `finalStandings`) **oder** hat einen Saison-Award
   (Punkt 2) gewonnen. Begründung: verbindet individuelle mit Team-Größe; Awards machen auch den
   Spezialisten legendenfähig, der nie Meister wurde.
5. **Einzigartigkeit** — *„Hat einen Rekord gehalten":* hält oder hielt einen Eintrag im
   Rekordbuch (Punkt 3). Begründung: Rekorde sind per Definition das Gedächtnis der Liga.

**Verleihung:** **Legende = Kriterium 1 erfüllt + mindestens 2 der Kriterien 2–5.** Dauer ist
bewusst Pflicht: ohne sie würde jeder Saison-1-Leader sofort „Legende" — der Status wäre wertlos.
Zwei Stufen darüber ist Raum für später (z. B. „Ikone" = alle fünf Kriterien), aber das ist
Ausbaustufe, nicht Teil dieses Entwurfs.

**Saison 1 — der Reiter darf trotzdem nicht leer sein.** In S1 kann es per Definition keine
Legenden geben (Kriterium 1). Der Reiter zeigt stattdessen:
- die **Kriterien-Tafel** selbst (die fünf Bedingungen in Alltagssprache — das Spiel erklärt, was
  Legende bedeutet, und macht es zum Langzeitziel), und
- **„Anwärter"**: die aktuell besten Karriere-Spieler (Live-Merge!) mit einer
  Fortschritts-Checkliste je Spieler („✓ Dominanz (führt PPs an) · ✗ Dauer (1 von 3 Saisons) ·
  2 von 5 Kriterien"). Quelle: exakt dieselben Resolver wie die spätere Verleihung — die Anzeige
  „graduiert" von Anwärtern zu Legenden, ohne dass eine zweite Ansicht entsteht.
- Die bestehende Karriere-Tabelle des Reiters wird durch die Ewige Tabelle (Punkt 5) ersetzt.

**Warum interessant.** Der Reiter beantwortet ab Tag 1 die Frage „wer ist auf dem Weg, unsterblich
zu werden?" — und die Definition macht aus einer Anzeigefläche ein Spielziel.

---

## 5. Ewige Tabelle aller Spieler (Team ↔ Liga)

**Wunsch:** *„…so ne ewige tabelle ALLER spieler aus dem team … alle spieler die das team je hatte
mit allen PPs usw. Aber dass man auch wechseln kann auf ALLE spieler und sehen kann wer ist all
time best."*

**Woher kommen die Daten.**
- **Zugehörigkeit „war je im Team":** aktuelle `rosters` ∪ alle `transferHistory`-Einträge mit
  `fromTeamId`/`toTeamId` = Team (331 Einträge, save-weit, in S1 bereits vollständig). Ein
  Spieler, der verkauft wurde, bevor er je punktete, erscheint korrekt mit 0 PPs aber „war im
  Team" (sein `sell`-Eintrag trägt `fromTeamId`).
- **PPs-Zuordnung je Team:** Für die laufende Saison löst
  `seasonPointsLedger.playerSummariesByPlayerId[].pointsByTeamId` das Kernproblem exakt — Punkte,
  die ein Spieler **vor** dem Verkauf für Team A holte, bleiben bei Team A, die danach bei
  Team B. Für archivierte Saisons trägt jede `playerPerformances`-Zeile genau **eine** `teamId`
  (Saisonzuordnung). Ehrliche Einschränkung, die in der UI als Fußnote steht: Bei einem
  Mid-Season-Transfer in einer **archivierten** Saison ist die Zuordnung nur so fein wie der
  Snapshot — falls dessen `disciplineBreakdown` keine Team-Splits trägt, zählt die Saison für das
  Snapshot-Team. Da der Snapshot aber auch `playerDisciplinePerformances` (mit `teamId` je
  Auftritt!) archiviert, kann der Resolver die exakte Team-Zuordnung daraus rechnen — gleiche
  Rechnung wie der Live-Ledger, nur über Archivdaten. Das ist die empfohlene Variante.
- **Karriere-Summen (Liga-Sicht):** `buildPlayerLeagueCareerStatsMap` mit Live-Merge
  (Abschnitt 0) — keine Neuberechnung, die Ewige Tabelle ist eine Projektion derselben Map.

**Entwurf.** Neuer Selector `lib/foundation/eternal-player-table.ts` →
`buildEternalPlayerTable(gameState, scope)` mit `scope = { kind: "league" } | { kind: "team", teamId }`.

- **Team-Sicht** (Default: das Manager-Team, per Dropdown jedes Team wählbar — Kader und PPs sind
  öffentliche Daten, die Leaders zeigen heute schon alle Teams): alle Spieler, die je im Team
  waren. Spalten: Spieler · Zeitraum („S1", später „S1–S3") · Einsätze (für dieses Team) ·
  **PPs für dieses Team** · PPs Karriere gesamt · Status (im Kader / verkauft an X / Vertragsende).
  Sortierbar (`NlTable` wie die bestehende Legends-Tabelle), Suchfeld ab ~50 Zeilen.
- **Liga-Sicht** („Alle Spieler"): dieselbe Tabelle über alle Spieler mit Karrieredaten, sortiert
  nach Karriere-PPs — das ist die „all time best"-Antwort. Gestaffelte Anzeige wie in Punkt 1
  (Top 50 → alle). Spalten: Spieler · Team(s) · Einsätze · PPs · Saisons · MVP.
- **Ort:** im Reiter „Legendäre Spieler" unterhalb der Legenden/Anwärter-Sektion, mit
  Umschalter-Pills **„Mein Team" / „Team wählen…" / „Ganze Liga"**. Ersetzt die bisherige
  starre Top-25-Karriere-Tabelle.
- In Saison 1 heißt die Team-Sicht ehrlich „Ewige Tabelle (bisher 1 Saison)" — sie ist trotzdem
  sofort nützlich, weil verkaufte Spieler mit ihren erspielten PPs sichtbar bleiben („der hat
  für uns 38 PPs geholt, bevor wir ihn verkauft haben").

**Warum interessant.** Das ist das Vereinsgedächtnis: Wer hat je für uns gepunktet, was haben
Verkäufe uns sportlich gekostet, und wie stehen unsere Größten gegen die Größten der Liga.

---

## 6. Neue Achievements

**Wunsch:** *„'Erfolge' Tab braucht eigentlich auch noch neue achievements die sinn machen"*

Die 14 bestehenden (`league-achievements.ts`) decken Ranglisten, Kader-OVR/-Wert, Transfers-Zähler,
Tabelle und Saisonabschlüsse ab. Es fehlen: **Disziplin-Beherrschung, Serien, Wirtschaft und
Kaderaufbau.** Alle neuen bleiben read-time und fog-safe (nur eigenes Team). Neue Gruppen
`disciplines`, `streaks`, `economy` in `LeagueAchievementGroup`; `squad` wird erweitert.

Wichtige Persistenz-Feststellung: „einmal erreicht"-Zustände über Spieltage (Serien, Siege) sind
innerhalb der Saison stabil, weil `disciplineResults` die ganze Saison im State bleiben, und über
Saisonwechsel hinweg reproduzierbar, weil sie in den Snapshot archiviert werden (Abschnitt 0).
**Kein neuer Schreibpfad nötig.**

*Disziplinen* — Quelle: `disciplineResults` (eigene `teamId`-Zeilen: `rank`, `disciplineId`,
Spieltag über `matchdayResultId`):
1. **Disziplinsieger** — mindestens 1× `rank === 1` in einer Disziplin an einem Spieltag.
2. **Doppelschlag** — beide Disziplinen (d1 und d2) desselben Spieltags gewonnen.
3. **Hausdisziplin** — dieselbe Disziplin in einer Saison 3× gewonnen.
4. **Breit aufgestellt** — in einer Saison mindestens einen Top-5-Rang in Disziplinen aller vier
   Bereiche geholt (Bereich über `disciplines[].category`).

*Serien* — Quelle: `disciplineResults` chronologisch, plus `playerDisciplinePerformances`:
5. **Lauf** — an 3 aufeinanderfolgenden Spieltagen mindestens eine Disziplin-Top-3-Platzierung.
6. **Serientäter** — ein eigener Spieler mit `isTop10`-Auftritt an 5 Spieltagen in Folge.
7. **Der Durchmarsch** — Tabellenplatz um mindestens 5 Ränge gegenüber dem Saison-Startplatz
   verbessert. Quelle: `standings[teamId].startplatz` vs. aktueller `rank` — die Semantik von
   `startplatz`/`rankDiff` vor Umsetzung einmal verifizieren; trägt `startplatz` nicht das
   Gemeinte, entfällt dieses Achievement ersatzlos statt es aus einer Zweitrechnung zu erfinden.

*Wirtschaft* — Quelle: `standings[teamId]` (`sponsorSeason`, `sponsorTotal`, `guv`) und
`transferHistory` (`netCashImpact`). **Bewusst kein Preisgeld** — Preisgeld wird nie ausgezahlt,
es ist nur Benchmark:
8. **Sponsorenliebling** — Sponsoreinnahmen der Saison (`sponsorSeason`) über dem Liga-Median.
9. **Schwarze Null** — Saison mit `guv ≥ 0` abgeschlossen (prüfbar am Saisonende bzw. im Archiv).
10. **Transfer-Gewinner** — kumulierter `netCashImpact` aus Verkäufen minus Käufe der Saison > 0
    bei mindestens 3 Verkäufen (verhindert das „1 Verkauf = Gewinn"-Rauschen).

*Kaderaufbau* — Quelle: `rosters` (`promisedRole`), `teamCaptains`, `playerMoraleState`,
`transferHistory`:
11. **Kapitän ernannt** — es existiert ein `teamCaptains`-Eintrag für das eigene Team.
12. **Perspektivplanung** — mindestens 3 Kaderspieler mit `promisedRole === "prospect"`.
13. **Gute Stimmung** — kein eigener Spieler mit negativem `visibleMood`
    (`playerMoraleState`, eigenes Team ist fog-safe).
14. **Treue** — ein Spieler seit 3 Saisons ununterbrochen im Kader (Roster-Eintrag vorhanden und
    kein `transferHistory`-Eintrag, der ihn zwischenzeitlich wegbewegt; volle Prüfbarkeit ab
    3 Saisons Spielzeit — vorher als gesperrt mit Fortschritt „1 von 3 Saisons" gezeigt).

*Verzahnung mit Punkt 2:*
15. **Award-Schmiede** — ein eigener Spieler hält aktuell einen Saison-Award (Quelle:
    `buildLeagueSeasonAwards`, dieselbe Rechnung, keine zweite).

Damit wächst der Reiter von 14 auf ~29 Meilensteine, davon in Saison 1 sofort erreichbar: alle
außer 9 und 14 (die beiden sind sichtbar-gesperrt mit ehrlichem Fortschritt). Anzeige unverändert
im bestehenden Reached/Locked-Muster, neue Gruppen-Tags in Alltagssprache („Disziplinen",
„Serien", „Wirtschaft").

---

## 7. Umsetzungsreihenfolge (kosteneffizient)

1. **Live-Merge in die Hall of Fame** — `buildLeagueRecordsHallOfFame` reicht Ledger/Performance-Map
   an `buildPlayerLeagueCareerStatsMap` durch. Kleinster Eingriff, belebt „Legendäre Spieler"
   sofort. Danach Transfer-Rekorde auf `gameState.transferHistory` umstellen.
2. **Punkt 1 (Ranglisten aufklappen)** — nur Limit-Änderung + Button + Drawer-Staffelung; alle
   Bausteine existieren.
3. **Punkt 3 (Rekordbuch)** — neue Resolver über `disciplineResults`/`playerDisciplinePerformances`.
4. **Punkt 2 (Awards)** — neuer Selector, UI-Sektion; nutzt dieselben Resolver-Grundlagen wie 3.
5. **Punkt 5 (Ewige Tabelle)** — neuer Selector + Tabellen-UI mit Umschalter.
6. **Punkt 4 (Legenden-Definition)** — Kriterien-Resolver + Anwärter-Checkliste; profitiert von
   2/3/5 (Awards, Rekorde, Karriere-Map).
7. **Punkt 6 (Achievements)** — additiv in `league-achievements.ts`, gegen Ende, weil 15 auf
   Punkt 2 aufbaut.

Offene Verifikationen vor Implementierung (alle klein):
- Zeilenzahl `seasonState.playerDisciplinePerformances` im echten Save (erwartet > 0, s. Abschnitt 0).
- Semantik `StandingRecord.startplatz`/`rankDiff` (für Achievement 7).
- Ob `snapshot.playerPerformances.disciplineBreakdown` Team-Splits trägt — falls nein, Ewige-Tabelle-Archivpfad über `snapshot.playerDisciplinePerformances` rechnen (Punkt 5, empfohlene Variante).
