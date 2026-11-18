# Verletzung: nicht einsetzbar, in der Verletzungs-Disziplin 50 % der Basis (18.11.)

Chris am 18.11., wörtlich:

> „Verletzt ist nicht nur −10, sondern gar nicht einsetzbar! Und IN der Disziplin, wo er sich
> verletzt hat, hat er nur 50 % seiner Basisleistung bzw. Eignung/Score.“

Daraus drei Regeln:

1. Ein verletzter Spieler ist für die Dauer seiner Verletzung **nicht einsetzbar**: nicht über die
   Einsatzliste, nicht über die KI-Aufstellung, nicht über einen Auffüllweg. Er wird auch **nicht gewertet**.
2. In der Disziplin, in der er sich verletzt (im laufenden Einsatz), zählen für ihn **nur 50 % seiner
   Basis** (Eignung bzw. Disziplinwert).
3. Der Formabzug „Verletzt: 10 Punkte Abzug auf die Form“ ist bestehende Logik. Er bleibt unverändert und
   wird hier nur dokumentiert.

Zeilenangaben beziehen sich auf `origin/main` vor diesem Branch.

---

## 1. IST

### 1.1 Wo eine Verletzung entsteht

- **Bei der Buchung, nicht im Motor.** `buildMatchdayInjuryRollMap` (`lib/fatigue/fatigue-injury-service.ts:1031`)
  würfelt für jeden Spieler, der an diesem Spieltag eingesetzt ist, genau einmal. Der Wurf ist deterministisch
  (`resolveMatchdayInjuryRoll`, :990, mit `stableHash`-Saat). Gewürfelt wird gegen die Fatigue **nach** dem
  Einsatz plus den Trainingsanteil (:1080–1100). Die Risikokurve steht in
  `lib/fatigue/fatigue-calibration.ts` (`getInjuryRiskPercent`): unter 25 Fatigue ist das Risiko 0 %.
- Dieselbe Roll-Map wird an jedem Rechenweg an die Kontexte geheftet
  (`attachMatchdayInjuryPerformanceToContexts`, :1130): beim Buchen
  (`legacy-matchday-result-apply-service.ts:457`), im Arena-Kickoff (`arena-matchday-resolve-service.ts:168`),
  im Auto-Run (`matchday-auto-run-service.ts:228`) und in der Vorschau bzw. im Arena-Snapshot
  (`legacy-matchday-resolve-preview-service.ts:94`). Vorschau und Buchung sehen also denselben Wurf.
- Fortgeschrieben wird sie in `applyFatigueAndInjuryAfterMatchday` (:1370): `injuryStatus: "injured"`,
  `injuredAtMatchdayId` und `injuryUntilMatchday = nächster Spieltag` (:1612). Der Arena-D1-Teilcommit
  schreibt den Eintrag schon nach D1.
- **Der Motor kennt keine Saison-Verletzung.** `public/mockups/battle-mode.engine.js` hat nur das
  motorinterne „VERLETZT!“ beim kühnen Versuch im Gewichtheben (`HEBEN_INJURY_*`, :23193, :27433). Das ist
  ein Ereignis innerhalb des Hebens, `kuehnVerletzt` hat keinen TS-Leser, und mit der Saison-Verletzung hat
  es nichts zu tun.

### 1.2 Wie lange sie gilt

- `INJURY_UNAVAILABLE_MATCHDAYS = 1`, `INJURY_RECOVERING_MATCHDAYS = 1` (`fatigue-injury-service.ts:352f.`).
- `getPlayerAvailabilityView` (:770) leitet den Status aus diesen Fenstern ab:
  - **gesperrt** am Folgespieltag (`isUnavailableInLaterMatchday`, `injuredAt < aktuell <= until`) und
    **in der noch offenen Disziplin desselben Spieltags**, solange dieser nicht vollständig gebucht ist
    (`isBlockedForRemainingDisciplineSide`);
  - danach einen Spieltag lang `recovering`. In diesem Fenster ist er einsatzfähig.
  - Ab dann wieder `healthy`.
- Die Sicht liefert `isUnavailable` und `blocker: "player_injured_unavailable"`.

### 1.3 Wo ein Verletzter heute gesperrt ist

| Weg | Stelle | Stand vorher |
|---|---|---|
| Kontext / Auswahlliste | `legacy-lineup-local-service.ts:612` `selectableActivePlayers` (nur Einsatzfähige in `activePlayers`) | gesperrt |
| Einsatzliste (Ziehen, Klick) | `legacy-lineup-drag-drop.ts:16`, `EinsatzlisteModern.tsx:259` (`verletzte`), `lineup-candidate-model.ts:217` | gesperrt |
| „Auffüllen“/„Optimieren“ (modern) | `EinsatzlisteModern.tsx:362` → `berechneVerteilung(ausgeschlossen: verletzte)` | gesperrt |
| „Auto-Fill Rest“ (alt) | `LegacyLineupLabClient.tsx:5150` (`!rosterCard?.availabilityBlocker`) | gesperrt |
| KI-Aufstellung | `ai-legacy-lineup-engine.ts:799` wählt aus `context.activePlayers`, also aus der bereinigten Liste | gesperrt |
| KI-Frische | `ai-lineup-freshness.ts:59` macht einen Entwurf mit Verletztem veraltet | gesperrt |
| Eingefrorener KI-Entwurf | `ai-frozen-draft-blocked-repair.ts:75` besetzt die offene Seite nach | gesperrt |
| Speichern (Server) | `legacy-lineup-validator.ts:22–75`: offener Entwurf mit Sperre aus einem **Vorspieltag** ist ein Fehler | gesperrt |
| Speichern, **heute** verletzt | Validator `verletztAnDiesemSpieltag` (:43): nur eine Warnung, **egal auf welchem Platz** | **Lücke A** |
| Wertung | `legacy-score-engine.ts` wertete jeden Eintrag. Wer in einem gesperrten Entwurf oder per Override mit einer Sperre aus einem Vorspieltag stand, wurde voll gewertet. So steht es im Validator-Kommentar selbst: „die Score-Engine kennt keine Sperre“ | **Lücke B** |
| Bereitschaft | `matchday-lineup-readiness.ts:131`, `legacy-matchday-readiness.ts:116` | gesperrt |

Frühere Fixes, auf denen das aufbaut, mit Tests:
`tests/verletzung-sperre-ueber-d1-commit.test.ts` (am Vortag Verletzte wurden in D2 gewertet; `invalid_lineup` auf D2),
`tests/verletzung-blockiert-gesperrte-aufstellung-nicht.test.ts`,
`tests/verletzung-in-d1-blockiert-d2-nicht.test.ts`,
`tests/verletzung-in-d1-blockiert-nicht-die-wertung-von-d2.test.ts`,
`tests/verletzung-steht-nicht-unter-fatigue.test.ts`.

### 1.4 Leistung in der Disziplin, in der er sich verletzt

- `INJURY_PERFORMANCE_MULTIPLIER = 0.5` (`fatigue-calibration.ts:3`).
- **PPS-Pfad** (Manager Mode und die PPS-Duell-Brücke im Battle Mode, Mini-DM-PPS-Pods):
  `legacy-score-engine.ts:278` rechnete `injuryAdjustedScore = fatigueAdjustedScore × 0,5`. Die Verletzung
  kam also **auf** den Fatigue-Abschlag. Bei Fatigue 80 sind das 0,75 × 0,5 = **37,5 % der Basis**, nicht 50 %.
  Genau in dieser Lage entstehen Verletzungen, weil das Risiko erst ab Fatigue 25 beginnt. → **Abweichung C**
- **Arena-Pfad** (arena-aufgelöste Disziplinen, FFA-/Bahn-/Battlefield-Pods): die Spieler-PP kommen aus dem
  Boxscore-Impact des Motorlaufs (`arenaIndividualBoxscorePpsByDisciplineId`,
  `legacy-matchday-resolve-engine.ts:1250`, :1298) und **ignorierten die Verletzung ganz**. Wer sich in einer
  Arena-Disziplin verletzte, bekam seine vollen Arena-PP. Der Motorlauf (Vorlauf) läuft vor der Buchung und
  kennt den Wurf nicht. → **Lücke D**
- Die Bühne (`discipline-stage-from-preview.ts:120`) wies den Abzug als „Verletzung −50 % (Basis)“ aus, maß
  ihn aber gegen den Fatigue-Wert.

### 1.5 Formabzug (Regel 3, unverändert)

`FORM_VERLETZUNG_ABZUG = 10` (`lib/morale/form-moral-modifikator.ts:154`). `advancePlayerFormDetail` zieht ihn
nach jedem Spieltag ab, an dem der Spieler `verletzt` ist (:210–213). `advancePlayerFormState` (:334) setzt
`verletzt = injuryStatus !== "healthy"`, also **auch im `recovering`-Fenster**. Die Begründungszeile lautet
„Verletzt: 10 Punkte Abzug auf die Form.“ (`lib/lineups/form-moral-anzeige.ts:134`). Daran ändert dieser
Branch nichts.

---

## 2. Änderung

### Lücke A: Ein heute Verletzter durfte beim Speichern auf einen neuen Platz

`LegacyLineupValidationOptions.bisherigeEintraege` ist neu (`legacy-lineup-types.ts`). Der Speicherweg der
Einsatzliste (`buildValidationOptions`, `legacy-lineup-local-service.ts`) übergibt die Einträge des bisher
gespeicherten Entwurfs. Der Validator lässt einen **heute** Verletzten nur noch auf genau dem Platz
(Disziplin + Seite) durch, auf dem er schon stand, also dort, wo er gespielt und sich verletzt hat. Wer ihn
nach D2 umsetzt, bekommt `player_injured_unavailable` als Fehler. Ohne die Liste (Bereitschaft, KI, Vorschau)
bleibt die Regel wie bisher.

### Lücke B: Gesperrte wurden gewertet

`istVerletzungsgesperrtAusVorspieltag()` ist neu (`legacy-score-engine.ts`). Bei `availabilityBlocker` gesetzt
**und** `injuredAtMatchdayId` ≠ diesem Spieltag wird der Eintrag **nicht gewertet**: kein Score, keine
Intensitäts- oder Formanteile, kein Rollenanteil (der Team-Rollenterm wird um seinen Anteil gekürzt), keine PP,
keine Leistungszeile. Der Platz zählt weiter als besetzt (`selectedPlayers`, `isComplete`). Eine Seite wird
dadurch nicht „unvollständig“ und blockiert keinen Spieltag. Das ist dieselbe Linie wie im Validator („aufgestellt
WAR er“). Wer sich **an diesem** Spieltag verletzt hat, fällt nicht darunter, denn er ist gelaufen (Regel 2).

### Abweichung C: 50 % der **Basis** statt 50 % des Fatigue-Werts

`legacy-score-engine.ts`: Ist der Spieler verletzt (Faktor < 1), gilt
`injuryAdjustedScore = baseScore × INJURY_PERFORMANCE_MULTIPLIER`. Die Verletzung **ersetzt** den
Fatigue-Abschlag und kommt nicht obendrauf. Moral, Form, Captain, Intensität, Rolle und Team-Power wirken danach
wie bei jedem anderen Spieler. Ohne Verletzung bleibt die Rechnung Zeichen für Zeichen dieselbe. Die Bühne zeigt
für Verletzte keine Fatigue-Zeile mehr und misst die Verletzungszeile gegen die Basis. Damit bleibt die
Netto-Summe gleich `finalPlayerScore`.

*Bewusste Lesart:* „nur 50 % seiner Basisleistung“ wörtlich. Falls Chris „50 % von dem, was er sonst gebracht
hätte“ meint, also Fatigue × 0,5, ist das eine Zeile in `legacy-score-engine.ts`, und die beiden angepassten Tests
gehen zurück.

### Lücke D: Arena-PP halbiert

`legacy-matchday-resolve-engine.ts`: Neu ist `arenaPpsFuer(playerId)`. Es halbiert die Boxscore-PP eines Spielers,
der sich an diesem Spieltag in dieser Disziplin verletzt hat (`injuryStatus: "mapped"`, Faktor < 1, gerundet auf
zwei Stellen wie die PP selbst). **Eine** Funktion bedient alle drei Leser: die Bühne (`rankedTeam.entries`), die
persistierte Zeile (`rawPlayerEntries`, über den Mapper als `scoreContribution` in den Ledger, der Arena-Zeilen
vertraut) und `arenaBoxscoreImpactApplied`. Gezeigt und gebucht bleiben gleich.

*Was bleibt:* Das **Teamergebnis** einer Arena-Disziplin (2/1/0, Pod-Platz) kommt aus dem Motorlauf, und der kennt
die Verletzung nicht. Der Wurf fällt erst mit der Buchung. Die Verletzung in den Motor zu geben hieße, die
Arena-Eingabe (Aufstellungs-Adapter, `arenaEingabeHash`) zu ändern. Das ist ein Eingriff in die Arena-Engine und
gehört nicht in diese Runde. Gezeigt = gebucht gilt trotzdem, weil auch die Arena-Bühne diesen Motorlauf zeigt.
Ebenso offen: Ein Gesperrter, der in einem **gesperrten** Entwurf in einer Arena-Disziplin steht, wird vom Motor
weiter mitgeführt (Aufstellungs-Adapter), bekommt aber keine Wertung und keine PP (Lücke B).

---

## 3. Tests

`tests/verletzung-regel-18-11.test.ts`:

- **Regel 1:** Die KI stellt einen Verletzten auch beim Neuaufbau nicht auf (echter Spielstand, echter Batch).
  Speichern der Einsatzliste: ein heute Verletzter lässt sich nicht nach D2 umsetzen, auf seinem D1-Platz bleibt
  der Entwurf gültig. Die Validator-Matrix (Vorspieltag, heute alter Platz, heute neuer Platz, ohne Liste).
  „Auffüllen“/„Optimieren“ setzen keinen Verletzten. Ein Gesperrter aus einem Vorspieltag wird nicht gewertet,
  und die Seite bleibt vollständig.
- **Regel 2:** 50 % der Basis bei Fatigue-Faktor 1 / 0,9 / 0,75. Ohne Verletzung ist alles unverändert.
- **Regel 2/3 Arena:** Die Arena-PP des Verletzten sind halbiert, Mitspieler und Teamergebnis unberührt.
  Gezeigt = gebucht: Bühne, Vorschau-Zeile, Bühnen-Payload und persistierte Leistung (`scoreContribution`) tragen
  dieselbe Zahl.

Gegenprobe: Ohne die Validator-Änderung werden die beiden Speichern-/Prüfungs-Tests rot.

Angepasst wurden zwei bestehende Tests (in beiden ist die Erwartung jetzt 50 % der Basis):
`tests/legacy-matchday-resolve.test.ts` (vorher „malus on top of fatigue“) und
`tests/discipline-stage-from-preview.test.ts` (Betrag der Verletzungszeile).

## 4. Messung

- **Wertungs-Fingerabdruck** (`node scripts/pruefe-wertung-fingerabdruck.mjs`): vorher **GESAMT ce8fcef66028
  (75 Einträge)**, nachher **unverändert**. Erwartet war das: Der Fingerabdruck fährt nur den Node-Motor, und
  dieser Branch fasst `battle-mode.engine.js` nicht an. Alle Änderungen liegen in der TS-Buchungsschicht (Score-Engine,
  Resolve-Engine, Validator). Deshalb steht keine neue Zahl in CLAUDE.md oder `data/generated/`.
- **Rangtreue-Schranke**: siehe PR-Beschreibung. Die Schranke misst die Motor-Rangtreue je Disziplin ohne
  Saison-Verletzungen und ist von dieser Änderung nicht betroffen.
