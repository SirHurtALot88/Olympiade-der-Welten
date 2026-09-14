# Mini-DM im Spielplan verankern — Befund, kein Umbau (14.09.)

**Ergebnis vorweg: STOP, kein Produktionscode geändert.** Die Frage, die dieser Auftrag stellt —
"Mini-DM-Spieltage müssen echte 4-Team-Gruppen mit je 1 Spieler sein, nicht 2er-Paarungen" — ist
bereits zweimal recherchiert und beide Male auf dieselbe Antwort gelaufen:
`docs/design/mini-dm-4-team-ffa-recherche-06-09.md` (06.09., Abschnitt 5) und
`docs/design/n-team-disziplinen-infrastruktur-audit-13-09.md` (13.09., PR #911, bereits auf `main`).
Diese Runde verifiziert beide Befunde gegen den aktuellen Stand (`origin/main` = `8df73732`,
14.09.), beantwortet die vier konkreten Fragen aus dem Auftrag und prüft zusätzlich, ob wenigstens
die Kadergröße (1 statt 2–6) isoliert vom Rest anfassbar wäre. Sie ist es nicht risikofrei — Details
in Abschnitt 4. Es gab in dieser Runde nichts Neues zu committen außer diesem Dokument.

---

## 0. Der Auftrag

Chris, beim Ausrichten der Arbeit auf Mini-DM: „mini dm sind immer 4 teams mit je 1 spieler die
antreten und punkte sammeln das muss im spielplan auch verankert sein". Vier Unterfragen wurden
gestellt: (1) wie entscheidet der Spielplan heute "2 Teams" statt "4 Teams"? (2) wie ließe sich
Mini-DM minimal als echte 4er-Gruppe verankern? (3) braucht "1 Spieler je Team" eine eigene
Zwangs-Regel? (4) müssen 4 TEAMS gemeinsam eingeteilt werden, nicht 2 Teams gegeneinander?

---

## 1. Was schon vor dieser Runde bekannt war

**06.09., `mini-dm-4-team-ffa-recherche-06-09.md`, Abschnitt 5** benennt sechs offene
Spielplanfragen, bevor überhaupt ein Vierergruppen-Generator gebaut werden könnte — u. a.
„`buildCircleRounds()` erzeugt ausschließlich 2er-Paare, ein Vierergruppen-Generator müsste
entweder zwei benachbarte Paare verschmelzen oder von Anfang an in Vierern denken" (#1), „was
passiert mit dem zweiten Disziplin-Slot desselben Spieltags?" (#4) und „Heim/Auswärts-Semantik
entfällt — `Fixture`/`RoundPairing` tragen `homeTeamId`/`awayTeamId`, ein 4-Team-Event hat keine
natürliche Heim-/Auswärtsrolle" (#5). Die Empfehlung dort (Abschnitt 6, Punkt 4) ist ausdrücklich:
„Chris' Bestätigung zu den fünf offenen Spielplan-Fragen … ohne diese beiden Antworten lässt sich
kein Vierergruppen-Generator sinnvoll bauen."

**13.09., `n-team-disziplinen-infrastruktur-audit-13-09.md`, PR #911 (bereits auf `main`)** ist die
direkte Fortsetzung und beantwortet dieselbe Frage mit Zahlen statt Vermutung: Der 4-Team-FFA-Motor
in `public/mockups/battle-mode.engine.js` existiert, ist fertig, misst gut — hat aber **null
Produktionsaufrufer**. Der Grund ist strukturell, nicht ein fehlender Aufruf: das ganze
Saison-/Spielplan-Fundament ist **paarweise**, nicht generisch-N, an genau drei Stellen (Abschnitt
5.1 des Audits): dem `Fixture`-Datenmodell (`homeTeamId`/`awayTeamId`, zwei benannte Felder statt
Array), dem Rundengenerator (`buildCircleRounds()`, Circle-Methode ist per Definition ein
Paarungsverfahren) und dem Duell-Ergebnistyp (`ArenaFixtureResult.seiten: [number, number]`,
`arenaTeamPointsForFixture()`). Das Audit schätzt den Umbau selbst ein (Abschnitt 7, dort für
Staffel durchgerechnet, gilt strukturell identisch für Mini-DM): „Punkt 1 und 2 sind der eigentliche
Brocken … Das ist kein 'macht ein Agent in einer Runde nebenbei'-Umbau." Und in der Empfehlung
(Abschnitt 8, Entscheidung 2): „Die Frage an Chris ist nicht 'ob', sondern 'vor oder nach dem
Datenmodell'."

**Beide Dokumente sind noch aktuell** — s. Abschnitt 2, nichts an den zitierten Stellen hat sich
zwischen `ec9190c5` (Audit-Basis) und `8df73732` (heutiger `main`) verändert; die beiden
dazwischenliegenden Commits (`24c092bb` Football-Korridor, `8df73732` Spurt-Produktionsanbindung)
berühren keine der hier relevanten Dateien.

---

## 2. Eigene Nachprüfung gegen `origin/main` (`8df73732`)

Nichts hier wurde übernommen, ohne es selbst zu lesen:

- **`Fixture` ist pairwise**, `lib/data/olyDataTypes.ts:2488-2494`:
  ```ts
  export type Fixture = {
    id: string;
    homeTeamId: string;
    awayTeamId: string;
    matchdayId: string;
    status: "scheduled" | "resolved";
    ...
  };
  ```
  Kein Array, keine dritte/vierte Team-Rolle. `RoundPairing` in
  `lib/season/season-fixture-schedule.ts:63` ist strukturell identisch.
- **`buildCircleRounds()`** (`lib/season/season-fixture-schedule.ts:71-96`) paart `roundTeams[i]`
  gegen `roundTeams[n-1-i]` — `pairsPerRound = floor(n/2)`. Für vier zusammengehörige Teams gibt es
  hier keine Form, nur zwei unabhängige 2er-Paare.
- **`getOpponentOf()`** (`season-fixture-schedule.ts:165-177`) gibt `string | null` zurück — EIN
  Gegner per `.find()`. Bei einem 4-Team-Event würde das den ersten Treffer liefern und die anderen
  drei Team-Beziehungen verschweigen, nicht abstürzen.
- **`season-discipline-schedule.ts` kennt keinen Mini-DM-Sonderfall.** Grep über die ganze Datei:
  kein Treffer für `mini-dm`. `buildSeasonPlayerCountByDiscipline()` (Zeile 107-133) zieht die
  Kadergröße für JEDE Disziplin gleich: Kategorien mit exakt 5 Disziplinen bekommen eine
  Zufallspermutation von `[2,3,4,5,6]` (`shuffleSeeded`), jede andere Kategorie einen unabhängigen
  Gleichverteilungs-Zug aus `{2..6}`. Mini-DM läuft durch denselben Code wie jede der anderen 19
  Disziplinen.
- **Mini-DMs Basisgröße ist 2, nicht 4 oder 1** (`lib/data/dataAdapter.ts:56`):
  `{ id: "mini-dm", ..., playerCount: 2, ... }` — bestätigt exakt den Auftrags-Befund.
- **Mini-DM ist NICHT in `ARENA_RESOLVED_DISCIPLINE_IDS`**
  (`lib/resolve/battle-mode-arena-team-points.ts:250-268`, 13 Einträge, `mini-dm` fehlt) — wie im
  Auftrag verlangt, wird das hier NICHT geändert.
- **"power"-Kategorie hat exakt 5 Disziplinen**: `mini-dm`, `tdm`, `gewichtheben`, `hockey`,
  `breaking` (`lib/data/dataAdapter.ts:55-74`, selbst nachgezählt). Relevant für Abschnitt 4.
- **`scripts/generiere-arena-daten.ts` hat KEINEN Mini-DM-Eintrag** — anders als im Auftrag
  vermutet, existiert dort (Stand `8df73732`) kein Slot-Count-Override-Muster für Mini-DM, an das
  sich anknüpfen ließe (Spurts jüngster `jeSeite`-Fix betraf eine andere Tabelle, `BAHN_ART`, ein
  anderes Chassis als Mini-DMs `ARENA_ART`).
- **Kein bestehender Test erwartet eine Mini-DM-Sonderregel im Spielplan.**
  `tests/season-discipline-schedule-battle-repeat.test.ts` führt `mini-dm` im
  Produktions-Disziplinpool mit `playerCount: 2` — als ganz normale Power-Disziplin, keine
  abweichende Erwartung.

**Fazit der Nachprüfung:** Frage 1 aus dem Auftrag hat die im Auftrag selbst vermutete Antwort —
es gibt keinen Mini-DM-Sonderfall; die Disziplin fällt durch dieselbe generische
2–6-Zufallsziehung wie jede andere und wird anschließend über das liga-weite Renn-Scoring gewertet
(nicht über Zweier-Duell-Scoring, wie der Auftragstext vermutete — das liga-weite Rennen ist die
Standard-Topologie für jede nicht arena-aufgelöste Disziplin, s. Audit Abschnitt 1; für das
Endergebnis "Mini-DM wird strukturfalsch behandelt" ändert das nichts).

---

## 3. Die vier Fragen aus dem Auftrag — direkt beantwortet

**(1) Wie entscheidet der Spielplan heute "2 Teams" statt "4"?**
Er entscheidet das gar nicht — weder für 2 noch für 4. Es gibt keine Team-Gruppierung pro
Disziplin im Spielplan-Sinn. `season-discipline-schedule.ts` legt nur fest, WELCHE zwei
Disziplinen an einem Spieltag laufen und wie viele Spieler JEDES Team (alle 16, nicht ein
Gegner-Paar) darin einsetzt. Die "2 Teams gegeneinander"-Vorstellung entsteht erst später, separat,
in `season-fixture-schedule.ts`, und dort nur als Anzeige-/Arena-Ebene — nicht als
Punkte-Mechanik (der Datei-Kopf dort ist explizit: „Die Paarung ändert KEINE Punkte … das bleibt
liga-lokales Renn-Scoring"). Mini-DM nimmt an dieser Fixture-Paarung heute nicht einmal teil, weil
es nicht arena-aufgelöst ist.

**(2) Was wäre der minimale, korrekte Weg, Mini-DM als echte 4er-Gruppe zu verankern?**
Es gibt keinen minimalen Weg, weil das benötigte Konzept — "eine namentliche Gruppe von mehr als
zwei Teams, die gemeinsam an einem Ereignis teilnehmen und danach gemeinsam Punkte bekommen" —
im Datenmodell schlicht nicht existiert (Audit, Tabelle Abschnitt 1: „Pod / Vierergruppe —
existiert nicht"). Jede Umsetzung muss zuerst diese Lücke schließen (neues Feld an `Fixture`,
z. B. `participantTeamIds?: string[]`, oder ein eigenständiges `SeasonEvent`-Modell danebenlegen),
bevor irgendein Generator oder eine Anzeige darauf aufbauen kann. Das ist Abschnitt 7, Punkt 1 des
13.09.-Audits — dort als „der teure Teil" benannt, mit Persistenz- und Migrationsfolgen für jeden
bestehenden Spielstand.

**(3) Braucht "1 Spieler je Team" eine eigene Zwangs-Regel, statt der 2–6-Ziehung?**
Ja, isoliert betrachtet schon — aber "isoliert" ist hier der Haken, s. Abschnitt 4. Ein hartes
`playerCount: 1` für Mini-DM ist technisch einfach hinzuschreiben, reißt aber zwei bestehende,
bewusst gebaute Invarianten an, die beide eigene Dokumentationsrunden hatten (Kategorie-Balance,
2–6-Tauglichkeit) — und liefert dabei nicht einmal das, wonach Chris fragt, weil ohne
Vierergruppierung ein `playerCount: 1` nur bedeutet "1 Spieler pro Team tritt weiterhin im
liga-weiten 16-Team-Rennen an", nicht "4 Teams treten gegeneinander an".

**(4) Müssen 4 TEAMS gemeinsam eingeteilt werden, nicht 2 gegen 2?**
Ja — das ist der eigentliche, große Umbau, identisch mit der in Abschnitt 2 verlinkten Antwort auf
Frage 2. Der Rundengenerator (`buildCircleRounds()`) ist ein Paarungsverfahren im Kern seines
Algorithmus (`pairsPerRound = floor(n/2)`, symmetrisches Spiegeln `roundTeams[i]` ↔
`roundTeams[n-1-i]`), kein Parameter, den man von 2 auf 4 hochdrehen kann. Das 06.09.-Dokument
(Abschnitt 5, Frage 1) benennt zwei mögliche Strategien — bestehende Paare nachträglich zu Vierern
verschmelzen, oder einen eigenen, von Anfang an Vierer-denkenden Generator bauen — und lässt beide
bewusst offen, weil beide von Chris' noch unbeantworteten Fragen 3 und 4 desselben Abschnitts
abhängen (gilt die Gruppierung für beide Saison-Vorkommen? was passiert mit der zweiten Disziplin
desselben Spieltags für dieselben vier Teams?).

---

## 4. Warum selbst der kleine Teil ("nur playerCount = 1") nicht risikofrei ist

Die Versuchung ist, wenigstens die Kadergröße vorab zu fixieren, auch ohne die Vierergruppierung.
Zwei bestehende Invarianten sprechen dagegen, mit eigener Historie im Repo:

1. **Die Kategorie-Balance.** `buildSeasonPlayerCountByDiscipline()` behandelt jede Kategorie mit
   genau 5 Disziplinen als Einheit: sie zieht EINE Permutation von `[2,3,4,5,6]` und verteilt sie
   ohne Wiederholung. "power" hat exakt 5 Disziplinen (`mini-dm`, `tdm`, `gewichtheben`, `hockey`,
   `breaking`, selbst nachgezählt in Abschnitt 2). Mini-DM aus dieser Ziehung herauszunehmen und
   auf `1` zu fixieren bedeutet: die verbleibenden vier Power-Disziplinen bekommen entweder weiterhin
   eine Permutation von `[2,3,4,5,6]` (dann bekommt EINE von ihnen zusätzlich zu ihrer eigenen Größe
   noch einen zweiten Wert — undefiniert, welchen) oder die Kategorie muss auf eine 4er-Permutation
   von `[2,3,4,6]` (oder `[2,3,4,5]` o. ä.) umgestellt werden — das ist selbst schon eine
   Design-Entscheidung, keine Codezeile. Battle-Mode-Repeat (`repeat=2`,
   `buildDerangedPlayerCountByDiscipline()`) hat dieselbe 5er-Erwartung ein zweites Mal, mit
   Derangement-Garantie obendrauf.
2. **Die 2–6-Tauglichkeits-Infrastruktur.** `docs/design/pruefung-2-6-spieler-tauglichkeit-alle-disziplinen-08-09.md`
   (08.09.) hat eigens geprüft, ob alle zwanzig Disziplinen mit JEDER Feldgröße aus `{2..6}`
   funktionieren, und Fehler behoben, wo das nicht der Fall war (Eiskunstlauf u. a.). `1` ist ein
   Wert, für den diese Prüfung nie lief — nicht für Mini-DMs Chassis (Arena/Kampf, `baueEinheit`),
   nicht für die generische Lineup-/Kadervalidierung (`lib/lineups/lineup-discipline-contract.ts`,
   `matchday-slot-roles.ts`), die auf dieselbe 2–6-Spanne ausgelegt sind. Ob z. B. die vier
   Rollen-Themen aus `lineup-discipline-contract.ts:105-109` (Frontliner/Finisher/Trick
   Fighter/Iron Guard — genau die vier FFA-Rollen aus dem Mockup-Motor) bei `playerCount: 1`
   überhaupt sinnvoll eine Aufstellung ergeben, ist ungeprüft.

Ein `playerCount: 1`-Override wäre also selbst ein kleines Forschungsprojekt (Kategorie-Neuregel
plus 2–6-artige Tauglichkeitsprüfung für den Wert 1), nicht eine Zeile — und würde am Ende, ohne
die Vierergruppierung aus Abschnitt 3, Chris' eigentliche Anforderung nicht erfüllen. Deshalb bleibt
auch dieser Teilschritt in dieser Runde ungebaut.

---

## 5. Aufwandsschätzung für die vollständige Lösung

Identisch zur Staffel-Schätzung des 13.09.-Audits (Abschnitt 7), strukturell auf Mini-DM
übertragen — Mini-DM hat dabei sogar einen Vorteil gegenüber Staffel: es gibt heute NICHTS zu
brechen (Mini-DM ist nicht arena-aufgelöst, läuft also ohnehin schon "falsch"/generisch), während
Staffel ein funktionierendes Zwei-Bahnen-Duell ablösen müsste.

| Teil | Aufwand | Bemerkung |
|---|---|---|
| 1. Datenmodell (`Fixture`/`SeasonEvent`) | groß | Persistenz + Migration bestehender Saves, jeder `schedule`-Leser betroffen |
| 2. Vierergruppen-Generator | groß, eigenständig | kein Parameter von `buildCircleRounds()`, eigenes Verfahren; Rotation über die Saison offen |
| 3. Kadergröße fest auf 1 | klein an sich, mittel in Wirkung | Kategorie-Balance-Neuregel + 2–6-artige Tauglichkeitsprüfung für `1` (Abschnitt 4) |
| 4. Punktevergabe/Ergebnistyp | mittel | `ArenaFixtureResult`/`ArenaTeamPointsOverride` müssten N-Werte statt 2-Tupel tragen — betrifft NUR den Weg über `ARENA_RESOLVED_DISCIPLINE_IDS`, der für Mini-DM laut Auftrag bewusst NICHT aktiviert wird; ohne das bleibt offen, WIE die Vierergruppe überhaupt Punkte bekommt |
| 5. Anzeige (Spielplan-Gegnerkarte) | klein–mittel | Bühne ist schon N-generisch; `getOpponentOf()`/Gegner-Karte müssen von einem Gegner auf eine Liste |
| 6. Punkte-Budget-Entscheidung | Produktentscheidung | Chris hat `[2,1,0,0]` für den FFA-Motor selbst gesetzt (Summe 3, bewusste Übersteuerung) — ob das für den Spielplan-Weg unverändert gilt, ist eine neue Frage, sobald ein echter Buchungspfad existiert |
| 7. Abnahme | mittel | eigene Rangtreue-Sonde für N=4-Endplatzierung nötig (gibt es teilweise schon: `scripts/miss-mini-dm-ffa-rangtreue.mjs`, aber gegen den Mockup-Motor, nicht gegen einen Produktionspfad) |

**Größenordnung:** Punkt 1 und 2 sind der Kern und beide mehrtägige Einzelvorhaben mit
Sprengweite über den ganzen Saisoncode (Persistenz, jeder `schedule`-Konsument). Das ist — wie im
13.09.-Audit für die strukturell identische Staffel-Frage festgehalten — kein Umbau, den eine
einzelne Agenten-Runde nebenbei sauber abschließt.

---

## 6. Was JETZT sicher möglich wäre, ohne das Datenmodell anzufassen

Ehrlich: sehr wenig, das echten Wert hätte, ohne Chris' Entscheidungen vorwegzunehmen. Was diese
Runde stattdessen als nächsten, sicheren Schritt vorschlägt, ist kein Code, sondern eine
Entscheidungsvorlage — dieselbe, die das 13.09.-Audit schon formuliert hat (Abschnitt 8,
Entscheidung 2) und die noch offen ist:

1. **Die sechs Spielplanfragen aus dem 06.09.-Dokument (Abschnitt 5) Chris vorlegen**, insbesondere
   #1 (Verschmelzung bestehender Paare vs. eigener Vierer-Generator), #3 (gilt die 4er-Regel für
   beide Saison-Vorkommen im Battle Mode?) und #4 (was passiert mit dem zweiten Disziplin-Slot
   desselben Spieltags für dieselben vier Teams?).
2. **Erst danach das Datenmodell entwerfen** (Audit Abschnitt 7, Punkt 1) — mit den Antworten aus
   Schritt 1 als Eingabe, nicht als nachträgliche Anpassung an einen bereits gebauten Generator.
3. **Erst danach den Vierergruppen-Generator bauen**, und zwar so, dass er direkt für eine zweite
   N-Team-Disziplin (Staffel, vom Audit als „Entscheidung 3, niedrige Dringlichkeit" eingestuft)
   wiederverwendbar ist — sonst wird laut Audit „dasselbe Fundament zweimal gegossen".

Ein reiner "Kadergröße auf 1 zwingen"-Zwischenschritt (Abschnitt 4) wird **nicht** empfohlen: er
kostet eigene Sorgfalt (Kategorie-Balance, Tauglichkeitsprüfung), löst aber keinen Teil von Chris'
eigentlicher Anforderung, solange die Vierergruppierung fehlt — er würde nur eine neue, unfertige
Zwischenform ins Spiel bringen, die später wieder angefasst werden muss.

---

## Anhang: Quellenliste (diese Runde)

**Selbst gelesen**, Stand `origin/main` = `8df73732` (14.09.):
- `docs/design/mini-dm-4-team-ffa-recherche-06-09.md` (ganz).
- `docs/design/n-team-disziplinen-infrastruktur-audit-13-09.md` (ganz).
- `docs/design/gesamtstand-fertigstellungsgrad-alle-disziplinen-09-10.md`, Abschnitt „Mini-DM"
  (Zeile 671-770) und Abschnitt 3.5 (Zeile 933-950).
- `docs/design/pruefung-2-6-spieler-tauglichkeit-alle-disziplinen-08-09.md`, Kopf/Abschnitt 0.
- `lib/season/season-discipline-schedule.ts` (ganz, 771 Zeilen).
- `lib/season/season-fixture-schedule.ts` (ganz, 178 Zeilen).
- `lib/data/olyDataTypes.ts`: `Fixture` 2488-2494.
- `lib/data/dataAdapter.ts`: `foundationSeedDisciplines` 54-… (Kategorie-Zählung selbst gemacht).
- `lib/resolve/battle-mode-arena-team-points.ts`: `ARENA_RESOLVED_DISCIPLINE_IDS` 250-268.
- `lib/minidm-token-size.ts` (ganz) — rein kosmetisch, kein Scheduling-Bezug, wie der Datei-Kopf
  selbst sagt.
- `lib/lineups/lineup-discipline-contract.ts`, `matchday-slot-roles.ts`,
  `lib/lineups/team-discipline-ranks.ts`, `lib/season/season-discipline-area-groups.ts` — geprüft
  auf Mini-DM-Sonderfälle; alle vier tragen nur ID-Normalisierung/Rollen-Themen, keine
  Spielplan-Struktur.
- `scripts/generiere-arena-daten.ts` — auf Mini-DM-Override geprüft, keiner vorhanden.
- `tests/season-discipline-schedule-battle-repeat.test.ts` — Mini-DM-Zeile im Testkatalog geprüft,
  keine abweichende Erwartung.

**Bewusst nicht geprüft** (außerhalb des Auftrags dieser Runde):
- Mini-DMs Rangtreue/Validität (0,256 kaderfest) — separates, größeres Problem, wie im Auftrag
  ausdrücklich ausgeklammert.
- Wie ein `SeasonEvent`-Modell konkret aussähe — Chris' Entscheidung, nicht diese Runde (identisch
  zur Einschränkung im 13.09.-Audit).
