# Audit: Trägt die Infrastruktur N-Team-Disziplinen? (Fixtures, Punkte, Anzeige, Kalender — 13.09.)

**Audit, kein Umbau.** Alle Datei-/Zeilenangaben sind gegen `origin/main` (Stand `ec9190c5`) geprüft
und, wo eine Zahl steht, nachgemessen statt geschätzt. Der einzige Produktionscode, den diese Runde
anfasst, ist ein Fund aus Abschnitt 4 (B2) — alles andere ist bewusst nur beschrieben und
Chris' Entscheidung vorgelegt.

## 0. Der Auftrag in Chris' Worten

> „und von der technik her haben wir schon das implementiert, dass 1v1 team nacheinander direkt in
> 2 diszis antreten und es dafür dann punkte gibt? und dass es uach mit der verteilung klappt wenn
> es mal 4er diszis sind wie mini dm? und dass das auch alle nteams sauber angezeigt wird und im
> spieltagskalender korrekt erfasst ist?"

Vier Fragen. Die kurzen Antworten zuerst, die Belege danach:

| # | Frage | Antwort |
|---|---|---|
| 1 | 1v1 nacheinander in 2 Disziplinen, mit Punkten? | **Halb.** Die Paarung trägt beide Disziplinen, und beide vergeben Punkte — aber **höchstens EINE** der beiden kann ein echtes Duell sein, und in **41 % der Spieltage ist es KEINE** (gemessen, Abschnitt 3). |
| 2 | Klappt die Verteilung bei 4er-Disziplinen wie Mini-DM? | **Nein — es gibt sie im Produktionscode gar nicht.** Mini-DMs FFA existiert ausschließlich im Mockup-Motor und hat **keinen einzigen Aufrufer** in `lib/` (Abschnitt 2). |
| 3 | Werden alle N Teams sauber angezeigt? | **Gespalten.** Die Bühne ist bereits N-generisch, der Spielplan-Kalender zeigt strukturell **genau einen** Gegner (Abschnitt 5). |
| 4 | Im Spieltagskalender korrekt erfasst? | **Für N=2 ja, sauber und ohne Doppelbuchung** (nachgemessen). Für N>2 gibt es kein Datenmodell, in das es überhaupt erfasst werden *könnte* (Abschnitt 6). |

**Das Gesamturteil vorweg:** Die Infrastruktur ist **kein** generisches N-Team-System mit N=2 als
Sonderfall. Sie ist ein **paarweises** System — und zwar an genau drei Stellen, die alle anderen
tragen: dem `Fixture`-Datenmodell, dem Rundengenerator und dem Duell-Ergebnistyp. Alles *nach* der
Punktevergabe (Tabelle, Saisonpunkte, Bühne) ist dagegen bereits sauber N-generisch. Mini-DMs FFA
ist heute nicht einmal ein „schmaler Sonderfall" — es ist ein **nicht angeschlossener Prototyp**.

---

## 1. Die drei Wertungs-Topologien — und warum das die eigentliche Antwort ist

Das Spiel kennt heute **zwei** Wege, aus einem Spieltag Tabellenpunkte zu machen, und die Recherche
vom 06.09. hat eine **dritte** benannt, die es nicht gibt:

| Topologie | Wer tritt gegen wen an | Punkteformel | Status |
|---|---|---|---|
| **Liga-weites Renn-Scoring** | alle 16 Teams der Liga im selben Event | `getRankToPointsValue(playerCount, rang 1..16)` | **live**, Standard für jede nicht arena-aufgelöste Disziplin |
| **Arena-Duell** | genau 2 Teams, per Spielplan gepaart | `ARENA_TEAM_POINTS = {win:2, draw:1, loss:0}` | **live** für 13 der 20 Disziplinen |
| **Pod / Vierergruppe** | 4 Teams, größer als ein Duell, kleiner als die Liga | — | **existiert nicht** |

Belege: `lib/season/season-fixture-schedule.ts:22-23` („die Paarung ändert KEINE Punkte […] das
bleibt liga-lokales Renn-Scoring, nicht Duell-Scoring"), `lib/resolve/battle-mode-arena-team-points.ts:288`
(`ARENA_TEAM_POINTS`), `docs/design/mini-dm-4-team-ffa-recherche-06-09.md` Abschnitt 1.4 („eine
dritte, bisher unbenannte Scoring-Topologie […] Dafür existiert heute kein Code-Pfad").

**Das ist der Schlüssel zum ganzen Audit.** Wer fragt „ist die Infrastruktur N-team-fähig?", bekommt
je nach Schicht eine andere Antwort, weil die *native* Topologie des Spiels das liga-weite Rennen ist
(N=16!) und das Duell die **Ausnahme**, die per Übersteuerung darübergelegt wird. Die Übersteuerung
ist der paarweise Teil — nicht das Fundament.

---

## 2. Mini-DMs 4-Team-FFA: der wichtigste Einzelfund

**Der FFA-Code existiert. Er ist gut. Er ist nirgends angeschlossen.**

Gesucht wurde über den gesamten Baum (`lib/`, `app/`, `components/`, `data/`):

```
grep -rniE "ffa|vierergruppe|pod|4-team" lib/ app/ --include=*.ts --include=*.tsx
```

→ **kein einziger Treffer** mit FFA-Bedeutung (nur `podium`, `topfFaktor`, `auffaellig` u. ä.).

Die gesamte Umsetzung liegt in `public/mockups/battle-mode.engine.js`:

| Baustein | Zeile | Was es tut |
|---|---:|---|
| `miniDmFfaSpawn(side)` | 23093 | Vier Ecken auf einem Kreis, 90° auseinander |
| `MINI_DM_FFA_ROLLEN` | 23103 | Die vier festen Rollen = N=4 Runden |
| `MINI_DM_FFA_RUNDENPUNKTE` | 23107 | `[4,3,2,1]` — event-intern |
| `MINI_DM_FFA_LIGAPUNKTE` | 23126 | `[2,1,0,0]` — Chris' ausdrückliche Übersteuerung |
| `verteilePlatzierungspunkte()` | 23135 | Platzierungspunkte **mit Gleichstand-Teilung**, N-generisch |
| `baueMiniDmFfaRunde()` | 23156 | Eine Runde, 4 Solo-Kämpfer, echte Simulation |
| `spieleMiniDmFfaEvent()` | 23232 | Vier Runden → Event-Platz → Liga-Punkte |
| Testschnittstelle `window.__arena.miniDmFfa*` | 23884-23888 | nur für die Mess-Skripte |

Die einzigen Aufrufer außerhalb des Motors sind **drei Messskripte**
(`scripts/miss-mini-dm-ffa-spiegel.mjs`, `-event-probe.mjs`, `-rangtreue.mjs`) und
`scripts/abnahme-neues-spiel.ts`. **Kein Produktionspfad.**

Zusätzlich, und unabhängig davon: `mini-dm` steht **nicht** in `ARENA_RESOLVED_DISCIPLINE_IDS`
(`lib/resolve/battle-mode-arena-team-points.ts:236-253`). Mini-DM wird heute im echten Spiel also
nicht einmal als **Duell** aufgelöst, sondern läuft über das liga-weite Renn-Scoring — mit
`playerCount: 2` aus `lib/data/dataAdapter.ts:56`, nicht 4.

**Konsequenz für die Frage „klappt die Verteilung bei 4er-Disziplinen?":** Es gibt nichts, was
klappen oder nicht klappen könnte. Die Frage ist nicht „ist der Sonderfall schmal?", sondern „der
Sonderfall ist noch gar nicht eingebaut".

### 2.1 Der Budget-Bruch, der beim Anschließen sofort schlagend wird

`MINI_DM_FFA_LIGAPUNKTE = [2,1,0,0]` summiert auf **3**. Jedes Arena-Duell zahlt in Summe **2**
(2:0 oder 1:1). Der Motor-Kommentar (Zeile 23119-23125) benennt das selbst und sauber: es ist Chris'
bewusste Übersteuerung der Forschungsempfehlung (2/0/0/0, Summe 2), wörtlich „mini dm 2-1-0-0 will
ich dann", und ausdrücklich **nicht** in einer späteren Runde durch die Empfehlung zu ersetzen.

Das ist **keine offene Frage** und wird hier auch nicht wieder aufgemacht. Es ist aber eine
**Eigenschaft, die beim Anschließen an die Tabelle bewusst gebucht wird**: ein Mini-DM-Spieltag
schüttet anderthalbmal so viel Liga-Punkte-Summe aus wie jeder andere Spieltag. Das gehört in die
Umsetzungsrunde als benannte Zeile, nicht als Überraschung.

---

## 3. Fund B1 — die 41 %: nur EINE Arena-Disziplin je Spieltag, sonst gar keine

**Das ist der Fund mit dem größten unmittelbaren Effekt auf Chris' Frage 1.**

Ein Battle-Mode-Spieltag trägt zwei Disziplinen (D1/D2, `SeasonDisciplineScheduleEntry`,
`lib/data/olyDataTypes.ts:2442-2451`). Der Arena-Lauf kann aber nur **eine** davon bedienen —
`runBattleModeArenaMatchday()` nimmt genau eine `disciplineId`
(`lib/resolve/battle-mode-arena-team-points.ts:1204-1210`), und `overridesByTeamId` ist **eine**
teamId-keyed Map ohne Disziplin-Dimension.

Sind **beide** Disziplinen arena-aufgelöst, steigt der ganze Spieltag aus
(`lib/season/arena-matchday-resolve-service.ts:239-243`):

```ts
const { arenaDisciplineId, mehrdeutig } = determineArenaDisciplineContexts(contextResults);
if (mehrdeutig) {
  console.error(`... mehrere arena-aufgeloeste Disziplinen an einem Spieltag (${matchdayId}) -- `
    + "noch nicht unterstuetzt, falle auf den PPS-Pfad zurueck.");
  return { applicable: false };
}
```

Der Dateikopf (Zeile 36-44) nennt das ausdrücklich „bewusst NICHT unterstützt". **Das war eine
vertretbare Entscheidung — als sie getroffen wurde.** Damals waren zwei Disziplinen arena-aufgelöst
(Basketball, Gewichtheben); der Fall traf rechnerisch ~0,5 % der Spieltage. Heute sind es **13 von
20**.

### 3.1 Nachgemessen, nicht gerechnet

Sonde gegen den echten Produktionsgenerator (`buildSeasonSeededDisciplineSchedule` mit dem echten
20-Disziplinen-Katalog `foundationSeedDisciplines`, 400 Saves):

| Spieltags-Art | repeat=1 (4000 Spieltage) | repeat=2 (8000 Spieltage) |
|---|---:|---:|
| **BEIDE Seiten Arena → fällt KOMPLETT auf PPS zurück** | **41,0 %** | **40,8 %** |
| genau EINE Seite Arena → Arena läuft für diese eine | 48,0 % | 48,5 % |
| KEINE Seite Arena → regulär PPS | 11,0 % | 10,8 % |

**In Worten:** An zwei von fünf Spieltagen läuft **überhaupt kein** Arena-Duell, obwohl beide
Disziplinen dieses Spieltags dafür gebaut sind. An den übrigen läuft es für **höchstens eine** der
beiden. Ein Spieltag, an dem zwei Teams **nacheinander in zwei Disziplinen** als Duell antreten und
für **beide** Duellpunkte bekommen, ist heute **strukturell unmöglich** — nicht selten, sondern
ausgeschlossen.

Sichtbar ist davon nichts: der Rückfall schreibt ein `console.error` auf den Server und bucht
stillschweigend PPS-Punkte. Im Spiel sieht ein solcher Spieltag aus wie jeder andere.

Dass `season-discipline-schedule.ts` die Paare rein zufällig aus dem gemischten Pool zieht
(`buildSeededDisciplinePairs`, Zeile 209-255, ohne jede Kenntnis von `ARENA_RESOLVED_DISCIPLINE_IDS`),
ist dabei kein Fehler — es ist nur der Grund, warum der Fall so häufig ist.

**Bewertung:** Das ist kein Rechenfehler und keine falsche Tabelle — die gebuchten PPS-Punkte sind
in sich korrekt. Es ist eine **stille Nicht-Erfüllung** von genau dem, wonach Chris fragt. Es
gehört als Entscheidung auf seinen Tisch, nicht in einen stillen Fix (Abschnitt 7, Weg 1).

---

## 4. Fund B2 — ein Duellausgang wurde in BEIDE Disziplinen gebucht (behoben)

**Das ist der einzige echte Fehler dieses Audits, und er ist in dieser PR repariert.**

Der Einhängepunkt im Resolve-Engine fragte, ob die gerade gewertete Disziplin **in der Menge**
`ARENA_RESOLVED_DISCIPLINE_IDS` steht — nicht, ob sie **die** Disziplin ist, für die der Arena-Lauf
gelaufen ist (`lib/resolve/legacy-matchday-resolve-engine.ts`, vorher Zeile 719-728):

```ts
const arenaOverridesForThisDiscipline =
  isBattleModeArenaEligible && ARENA_RESOLVED_DISCIPLINE_IDS.has(disciplineId)   // Mengen-Zugehörigkeit
    ? resolveOptions.arenaTeamPointsByTeamId ?? null
    : null;
```

`runBattleModeArenaMatchday()` liefert die Punkte **eines einzigen gelaufenen Duells**. Sind D1 und
D2 beide arena-aufgelöst, trifft die Bedingung für **beide** zu — derselbe Duellausgang wird
**zweimal** gebucht. Ein Team kassiert den Sieg **eines** Duells als 2 + 2 = 4 Punkte in die
Saisontabelle.

**Nachgestellt, nicht vermutet** (`tests/arena-override-nur-fuer-die-gelaufene-disziplin.test.ts`):
mit D1 = Basketball, D2 = Hockey und einer Override-Map für Basketball allein kamen vor dem Fix
**vier** arena-gewertete Team-Zeilen heraus statt zwei — und Alpha gewann auch die Hockey-Wertung,
obwohl Alpha dort den schwächeren Kader stellte und **kein Hockey-Duell gelaufen war**.

### 4.1 Warum das heute nicht knallte — und warum es trotzdem repariert gehört

Erreichbar war es nicht: die `mehrdeutig`-Wache aus Abschnitt 3 steigt vorher aus. Aber diese Wache
steht in **einer anderen Datei** als die Regel, die sie schützt. Eine Invariante, die nur aus der
Ferne gedeckt ist, bricht beim nächsten Umbau still — und der nächste Umbau ist genau das, wonach
Chris fragt. Wer den 41-%-Fall aus Abschnitt 3 angeht (Weg 1), **muss** diese Wache lockern, und in
derselben Sekunde wäre die Doppelbuchung live.

Es ist außerdem exakt der Stolperstein, der eine zweite N-Team-Disziplin (Staffel) blockiert.

### 4.2 Der Fix

`LegacyResolvePreviewOptions` bekommt ein zusätzliches, **optionales** Feld `arenaDisciplineId`
(`lib/lineups/legacy-lineup-types.ts`). Der Engine fragt damit nach **Identität** statt
Mengen-Zugehörigkeit:

```ts
const istDieGelaufeneArenaDisziplin =
  resolveOptions.arenaDisciplineId != null
    ? disciplineId === resolveOptions.arenaDisciplineId   // Identität
    : ARENA_RESOLVED_DISCIPLINE_IDS.has(disciplineId);    // alter Weg, wenn nicht mitgegeben
```

`lib/season/arena-matchday-resolve-service.ts` — der **einzige** Produktionsaufrufer — reicht die
Disziplin jetzt mit.

**Verhaltensänderung heute: keine.** Weil die `mehrdeutig`-Wache dafür sorgt, dass es je Spieltag
genau eine Arena-Disziplin gibt, liefern beide Zweige für jeden erreichbaren Fall dasselbe. Der
Fallback ohne das Feld hält jeden älteren Aufrufer und alle bestehenden Tests bit-identisch (eigener
Test dafür in derselben Datei, damit der Fallback eine bewusste Entscheidung bleibt).

Abnahme: `tests/arena-override-nur-fuer-die-gelaufene-disziplin.test.ts` (4 neue Fälle) plus die
vier bestehenden Suiten `battle-mode-arena-resolve-engine`, `battle-mode-arena-team-points`,
`battle-mode-arena-matchday-resolve-e2e`, `season-fixture-schedule` — **103 Tests grün**, vorher 99
grün + die 2 neuen rot.

---

## 5. Wo N=2 hart verdrahtet ist — und wo überraschend nicht

### 5.1 Hart paarweise (das müsste für N>2 wirklich angefasst werden)

| Stelle | Datei:Zeile | Warum es nicht über 2 hinausgeht |
|---|---|---|
| `Fixture` | `lib/data/olyDataTypes.ts:2488-2501` | `homeTeamId` + `awayTeamId` als **zwei benannte Felder**. Kein Array. Ein Vierer-Event hat hier keine Form. |
| `RoundPairing` | `lib/season/season-fixture-schedule.ts:63` | dito |
| `buildCircleRounds()` | `lib/season/season-fixture-schedule.ts:71-96` | `pairsPerRound = floor(n/2)`, `roundTeams[i]` gegen `roundTeams[n-1-i]` — die Circle-Methode **ist** ein Paarungsverfahren |
| `getOpponentOf()` | `lib/season/season-fixture-schedule.ts:165-177` | Rückgabetyp `string \| null` — **ein** Gegner, per `.find()` |
| `ArenaFixtureInput` / `ArenaFixtureResult` | `lib/battle/arena-headless-runner.ts:200-205, 240-253` | `seiten: [number, number]`, `gesamtKg: [number, number]`, `side: "home" \| "away"` |
| `arenaTeamPointsForFixture()` | `lib/resolve/battle-mode-arena-team-points.ts:920-924` | nimmt ein 2-Tupel, gibt ein 2-Tupel, kennt genau drei Ausgänge |
| `ArenaTeamPointsOverride` | `lib/resolve/battle-mode-arena-team-points.ts:891-899` | `opponentTeamId: string` (Einzahl), `seiten: [number,number]`, `outcome: "win"\|"draw"\|"loss"` |
| `bahnTeamstand()` (Staffel!) | `battle-mode.engine.js:17055-17079` | `ziel(0)` gegen `ziel(1)`, `seiten=[0,0]` — genau **zwei** Bahnen |
| Spielplan-Gegnerkarte | `lib/foundation/tabs/use-foundation-cross-tab-discipline-ranks.ts:257-283` | `opponentTeamId`/`opponentName`/`opponentLogo` — je **Einzahl** |
| Gegner-Zeile im UI | `app/foundation/ranks-v2/FoundationDiszisNewLook.tsx:130-165` | rendert genau ein Logo + einen Namen |

### 5.2 Bereits sauber N-generisch (das müsste **nicht** angefasst werden)

Das ist die gute Nachricht, und sie ist größer als erwartet:

| Stelle | Datei:Zeile | Warum es trägt |
|---|---|---|
| **Die Bühne** | `app/foundation/discipline-stage/arena/DisciplineStageNativeArena.tsx:140, 1537` | `teams: NativeStageTeam[]`, `const N = Math.max(1, teams.length)` — beliebig viele Teams, Bahnen nach `seasonRank`. Das ist die Ansicht, in der der Spieler das Event **sieht**. |
| **Team-Punkte im Resolve** | `lib/resolve/legacy-matchday-resolve-engine.ts:734-750` | Übersteuerung ist `teamPoints: number` **je teamId** — die Zahl trägt keine Duell-Semantik |
| **Ranking je Liga** | `legacy-matchday-resolve-engine.ts:72-95` (`rankWithinLeagueScope`) | rankt beliebig viele Teams mit Gleichstand-Teilung |
| **Saisontabelle** | `lib/standings/standings-apply-service.ts:299-313` | flaches `points += pointsDelta` je Team. Weiß nichts von Gegnern. |
| **Platzierungspunkte mit Ties** | `battle-mode.engine.js:23135` (`verteilePlatzierungspunkte`) | nimmt eine **Werteliste beliebiger Länge** und eine Punktetabelle — schon fertig für N=4 |

**Damit ist die Antwort auf Chris' Frage 3 zweigeteilt:** Die Bühne würde vier Teams **heute schon**
sauber zeigen. Der Spielplan-Kalender würde einem Team drei seiner Gegner **still verschweigen** und
einen davon zeigen — nicht abstürzen, nicht warnen: einfach den ersten, den `.find()` trifft.

---

## 6. Der Spieltagskalender — für N=2 sauber, für N>2 ohne Form

**Nachgemessen** (echter Generator, 16er-Liga × 2 Ligen × 20 Spieltage = 320 Fixtures):

```
Teams doppelt gebucht an einem Spieltag:                          0
Spieltage, an denen NICHT alle 16 Teams genau einmal vorkommen:   0
Paarungen je Spieltag/Liga:                                       8
```

Die Circle-Methode liefert also genau das, was sie soll: eine perfekte Paarung, jedes Team genau
einmal je Spieltag, **keine Doppelbuchung**. Chris' Sorge „könnte ein Team doppelt gebucht werden"
trifft für den heutigen 1v1-Betrieb **nicht** zu.

Zwei Randbefunde, die dabei mit auffielen:

**(a) 20 Spieltage passen nicht in 15 Runden.** Derselbe Lauf meldet
`fixture_schedule_matchday_count_exceeds_rounds:liga1:20:15`. Eine 16er-Liga hat 15 eindeutige
Circle-Runden; bei 20 Spieltagen wickelt `(offset + index) % totalRounds`
(`season-fixture-schedule.ts:145-146`) wieder auf den Anfang um — **fünf Spieltage wiederholen eine
bereits gespielte Paarung**, mit demselben Gegner. Das ist heute folgenlos, weil die 20 Spieltage
**noch nicht live sind** (s. b), aber es ist genau die Stelle, die bei der W2-Umschaltung zuerst
schreit. Die Warnung existiert und wird nirgends angezeigt.

**(b) „20 Spieltage, jede Disziplin 2×" ist gebaut, aber nicht angeschlossen.**
`getSeasonDisciplineRepeatCount()` (`lib/season/season-discipline-schedule.ts:35-37`) hat **null**
Produktionsaufrufer — geprüft über den ganzen Baum. Jeder Save, Battle Mode eingeschlossen, läuft
weiterhin mit 10 Spieltagen und jeder Disziplin **einmal**. Der Dateikopf (Zeile 22-33) sagt das auch
so: W1 hat die Struktur gebaut, W2 (das Umschalten) hängt an der aktiven Erholung. Für Chris' Frage
heißt das: die „2× je Disziplin"-Saison, in der Mini-DM zweimal vorkäme, existiert als Code, aber
nicht im Spiel.

**Für N>2 gibt es im Kalender keine Form.** Ein Vierer-Event müsste im `Fixture`-Modell entweder als
drei Zeilen mit demselben Ereignis abgelegt werden (dann zählt `getOpponentOf` falsch und die
Doppelbuchungs-Prüfung schlägt an) oder das Modell braucht ein Ereignis-/Gruppen-Feld. Beides ist
Datenmodell-Arbeit, keine Anzeige-Arbeit.

---

## 7. Was eine Staffel-4-Team-Umstellung wirklich kosten würde

Chris hat für Staffel angedeutet: „vllt muss das hier auch wenigstens eine 4 team diszi sein" —
sportlich richtig, echte Staffeln laufen auf mehreren Bahnen gleichzeitig, nicht als Duell.

**Ausgangslage, die den Aufwand unterscheidet:** Staffel ist — anders als Mini-DM — bereits
**produktiv arena-aufgelöst** (`ARENA_RESOLVED_DISCIPLINE_IDS`, Zeile 247; `ARENA_BAHN_DISCIPLINE_IDS`,
`arena-headless-runner.ts:183-187`). Sie läuft heute als **Zwei-Bahnen-Duell**: `bahnTeamstand()`
liest `ziel(0)` gegen `ziel(1)` und liefert `seiten=[0,0]` mit genau einer 1
(`battle-mode.engine.js:17067-17079`). Es gäbe also, anders als bei Mini-DM, **etwas
Funktionierendes zu brechen**.

Die Arbeit in der Reihenfolge, in der sie anfallen würde:

1. **Datenmodell (der teure Teil).** `Fixture` braucht eine Form für „dieses Ereignis gehört diesen
   vier Teams". Entweder ein neues Feld (`participantTeamIds?: string[]`, `home`/`away` bleiben für
   N=2) oder ein zweites, danebenliegendes `SeasonEvent`-Modell. Das berührt Persistenz, Migration
   bestehender Spielstände und jeden Leser von `schedule` — **das ist der Punkt, der Chris'
   Entscheidung braucht.**
2. **Gruppengenerator.** `buildCircleRounds()` erzeugt Paare. Vierergruppen aus 16 Teams sind sauber
   möglich (16 ist durch 4 teilbar), aber es ist ein **anderes** Verfahren, kein Parameter. Offen
   bleibt, ob die Gruppen aus je zwei benachbarten Paaren verschmolzen oder eigenständig gezogen
   werden — und wie sie über die Saison rotieren.
3. **Bahn-Motor.** `bahnTeamstand()`, `bahnRangliste()` und der Zieleinlauf müssten von zwei Seiten
   auf N Bahnen. Das ist die **kleinste** der Baustellen — `verteilePlatzierungspunkte()` aus dem
   FFA-Prototyp (Zeile 23141) leistet die Rang-und-Gleichstand-Rechnung bereits für beliebiges N und
   ist fertig zum Wiederverwenden.
4. **Ergebnistyp + Punktevergabe.** `ArenaFixtureResult.seiten: [number,number]` und
   `arenaTeamPointsForFixture()` müssten N-Wertelisten und eine N-Platz-Punktetabelle tragen.
   `ArenaTeamPointsOverride` müsste `opponentTeamId`/`outcome` entweder weglassen oder pluralisieren.
   Die Empfänger dahinter (Resolve, Tabelle) ändern sich **nicht** — die nehmen schon nur `teamPoints`.
5. **Anzeige.** Bühne: **nichts zu tun** (5.2). Spielplan-Gegnerkarte: von einem Gegner auf eine
   Liste — überschaubar, aber `getOpponentOf()` ist die falsche Signatur dafür.
6. **Punkte-Budget.** Eine Staffel-Vierergruppe braucht dieselbe Entscheidung, die Mini-DM schon
   hat: welche Punktetabelle, mit welcher Summe. Chris hat für Mini-DM `[2,1,0,0]` gesetzt (Summe 3).
   Ob Staffel dieselbe bekommt, ist eine Produktentscheidung, keine technische.
7. **Abnahme.** Die Rangtreue-Sonden kennen nur zweiseitige Duelle. Für ein N-Team-Format bräuchte es
   die eigene Sonde, die die FFA-Recherche (Abschnitt 6, Punkt 1) schon fordert und die es für
   Mini-DM inzwischen gibt (`scripts/miss-mini-dm-ffa-rangtreue.mjs`) — für die Bahn aber nicht.

**Ehrliche Einschätzung:** Punkt 3 und 5 sind klein, Punkt 4 mittel, **Punkt 1 und 2 sind der
eigentliche Brocken** und haben Sprengweite über den ganzen Saisoncode. Das ist kein „macht ein Agent
in einer Runde nebenbei"-Umbau.

---

## 8. Empfehlung — drei Entscheidungen für Chris, keine davon still getroffen

Nach dem Muster, mit dem auch Mini-DMs FFA-Regel entschieden wurde (Recherche → Empfehlung → Chris'
ausdrückliche Entscheidung), liegen hier drei Fragen, die **nicht** in dieser Runde beantwortet
werden:

**Entscheidung 1 — die 41 % (Abschnitt 3). Dringlichkeit: hoch, Aufwand: mittel.**
Heute ist „zwei Duelle an einem Spieltag" ausgeschlossen. Zwei Wege:
- **Weg A (klein, sofort möglich):** `mehrdeutig` nicht mehr aussteigen lassen, sondern die Arena
  deterministisch für **D1** laufen lassen und D2 bei PPS belassen. Hebt „kein Duell" von 41 % auf
  0 % und braucht **keine** Schnittstellenänderung — der B2-Fix aus Abschnitt 4 hat genau das gerade
  freigeschaltet (vorher hätte es die Doppelbuchung ausgelöst). Erfüllt Chris' Wunsch aber nur halb:
  ein Duell je Spieltag, nicht zwei.
- **Weg B (das, wonach Chris fragt):** Der Arena-Lauf läuft für **beide** Disziplinen, die
  Preview-Schnittstelle wird disziplin-bewusst (`Map<disciplineId, Map<teamId, Override>>`). Zwei
  Duelle, zwei Mal Punkte. Kostet die Umstellung von `overridesByTeamId` und
  `arenaIndividualBoxscorePpsByPlayerId` auf eine zweite Dimension plus doppelte Playwright-Laufzeit
  je Spieltag (heute schon 6-16 s).

  *Empfehlung: Weg B*, weil Weg A die Frage nicht beantwortet, sondern nur verschiebt — aber erst
  nach Chris' Ja, weil es die Resolve-Schnittstelle anfasst.

**Entscheidung 2 — Mini-DM anschließen (Abschnitt 2). Dringlichkeit: mittel.**
Der FFA-Prototyp ist fertig und vermessen, aber ohne das Datenmodell aus Abschnitt 7.1 kann er nicht
angeschlossen werden. Die Frage an Chris ist nicht „ob", sondern „vor oder nach dem Datenmodell" —
und ob die fünf offenen Spielplanfragen aus der 06.09.-Recherche (Abschnitt 5, insb. #3 und #4) jetzt
beantwortet werden sollen.

**Entscheidung 3 — Staffel als zweite N-Team-Disziplin (Abschnitt 7). Dringlichkeit: niedrig.**
Sportlich überzeugend, technisch der größte der drei. **Sinnvoll erst, nachdem Entscheidung 1 und
das Datenmodell stehen** — sonst wird dasselbe Fundament zweimal gegossen. Solange Staffel als
Zwei-Bahnen-Duell läuft, funktioniert sie; es brennt nichts.

**Was diese Runde geliefert hat:** den Befund mit Zahlen, und den einen echten Fehler (B2) behoben —
den, der jeden der drei Wege oben blockiert hätte.

---

## Anhang: Quellenliste

**Selbst gelesen** (Stand `ec9190c5`):
- `lib/season/season-fixture-schedule.ts` (ganz, 177 Zeilen): Kopfkommentar 1-28, `RoundPairing` 63,
  `buildCircleRounds` 71-96, Fixture-Aufbau 144-158, `getOpponentOf` 165-177.
- `lib/season/season-discipline-schedule.ts`: `getSeasonDisciplineRepeatCount` 19-37,
  `buildSeededDisciplinePairs` 209-255, `getRequiredSeasonDisciplineMatchdayCount` 282-285,
  `buildSeasonSeededDisciplineSchedule` 365-440.
- `lib/resolve/battle-mode-arena-team-points.ts`: `ARENA_RESOLVED_DISCIPLINE_IDS` 236-253,
  `ARENA_TEAM_POINTS` 288-292, `ArenaTeamPointsOverride` 891-899, `arenaTeamPointsForFixture`
  920-924, `…MitTiebreak` 943-960, `computeArenaTeamPointsFromFixtureResults` 964-993,
  `findLeagueFixturesForMatchday` 995-1003, `runBattleModeArenaMatchday` 1204-1280.
- `lib/season/arena-matchday-resolve-service.ts` (ganz): Kopfkommentar 15-45,
  `determineArenaDisciplineContexts` 78-91, `mehrdeutig`-Rückfall 232-243.
- `lib/resolve/legacy-matchday-resolve-engine.ts`: `rankWithinLeagueScope` 72-95, Resolve-Optionen
  330-345, Arena-Einhängepunkt 710-760.
- `lib/battle/arena-headless-runner.ts`: `ARENA_BAHN_DISCIPLINE_IDS` 183-187, `ArenaFixtureInput`
  200-205, `ArenaFixtureBoxscoreEintrag` 207-238, `ArenaFixtureResult` 240-253, Chassis-Weiche
  553-562.
- `lib/data/olyDataTypes.ts`: `SeasonDisciplineScheduleSlot`/`Entry` 2426-2451, `Fixture` 2488-2501.
- `lib/standings/standings-apply-service.ts`: Punktebuchung 299-313.
- `lib/foundation/tabs/use-foundation-cross-tab-discipline-ranks.ts`: Gegner-Zeilen 88-96, 257-283.
- `app/foundation/ranks-v2/FoundationDiszisNewLook.tsx`: `ScheduleOpponentRow` 130-165.
- `app/foundation/discipline-stage/arena/DisciplineStageNativeArena.tsx`: `NativeStageTeam` 80-95,
  Props 140, `N` 1537.
- `public/mockups/battle-mode.engine.js`: `miniDmFfaSpawn` 23093, `MINI_DM_FFA_ROLLEN` 23103,
  `MINI_DM_FFA_RUNDENPUNKTE` 23107, `MINI_DM_FFA_LIGAPUNKTE` 23126,
  `verteilePlatzierungspunkte` 23135, `baueMiniDmFfaRunde` 23156, `spieleMiniDmFfaEvent` 23232.
- `app/api/resolve/legacy-matchday-apply/route.ts`: Arena-Kickoff + Rückfall 67-105.
- `public/mockups/battle-mode.engine.js`: FFA-Block 23060-23270, `bahnTeamstand` 17055-17090,
  `spieleBahn` 24087-24100, Testschnittstelle 23881-23888.
- `docs/design/mini-dm-4-team-ffa-recherche-06-09.md` (ganz).

**Selbst gemessen** (Sonden gegen den echten Produktionscode, nicht gegen Nachbauten):
- Arena-Mehrdeutigkeit je Spieltag: `buildSeasonSeededDisciplineSchedule` ×400 Saves,
  repeat 1 und 2 → Tabelle in 3.1.
- Fixture-Doppelbuchung/Abdeckung: `buildSeasonFixtureSchedule`, 2 Ligen × 16 Teams × 20 Spieltage
  → Abschnitt 6.
- Doppelbuchung des Duellausgangs: `tests/arena-override-nur-fuer-die-gelaufene-disziplin.test.ts`
  (vor dem Fix 4 statt 2 arena-gewertete Zeilen).

**Bewusst NICHT geprüft:**
- Ob eine Vierer-Arena-Geometrie mit den bestehenden Bodenbild-/Kamera-Funktionen kollidiert — reine
  Rendering-Frage, unverändert offen seit der 06.09.-Recherche.
- Rangtreue/Validität irgendeiner Disziplin — dieses Audit fasst die Saison-/Wertungs-Pipeline an,
  nicht den Kampfmotor. Die kaderfeste rho-Methodik gehört zu `battle-mode.engine.js` und ist hier
  nicht das richtige Werkzeug.
- Wie ein `SeasonEvent`-Modell konkret aussähe — das ist Abschnitt 7.1 und ausdrücklich Chris'
  Entscheidung, nicht die dieser Runde.
