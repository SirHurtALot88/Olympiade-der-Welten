# Aktive Erholung vermessen, Battle-Gate, 20 Spieltage eingeschaltet (16.10.)

Stand: 2026-10-16, Branch `fatigue-aktive-erholung-20-spieltage-16-10` auf `main` = `ace43062`.
Alle Zahlen stammen aus echten Läufen der beiden neuen Werkzeuge (Abschnitt 2 und 6), nicht aus
Rechnungen. Baut auf `docs/design/fatigue-saisonlaenge-plan.md` (26.08., Chris-Entscheidungen
30.08.), `docs/design/battle-mode-20-spieltage-recherche-06-09.md` und
`docs/design/battle-mode-20-spieltage-liga-mechanik-16-10.md` auf.

---

## 0. Wichtige Funde vorab

1. **Der Plan existiert vollständig, aber mit vertauschten Buchstaben.** Im Fatigue-Plan heißt
   *Teil A* „20 Spieltage“ und *Teil B* „Fatigue-Neuentwurf“; Teil C verbietet A ohne B. Die
   Umsetzungsreihenfolge steht in Teil D als PR1–PR8. Stand vor diesem Branch: PR1 (aktive
   Erholung als Code hinter `OLY_FATIGUE_ACTIVE_RECOVERY`, Default AUS) und PR4 (Halbserien,
   `repeat: 2`, PR #930) waren gebaut. **Offen waren PR2 (Korridor vermessen), PR3 (Schalter),
   PR5 (Doppel-Rundenplan) und PR6 (20 Spieltage einschalten).** Dieser Branch liefert alle vier.
2. **Ohne aktive Erholung verdoppelt sich das Verletzungsproblem nicht — es vervierfacht sich.**
   Basisfall-Liga, echter Spielplan, zwei Saatstämme à 16 Spielpläne: 10 Spieltage 112 / 106
   Verletzungen je Saison, 20 Spieltage **482 / 461** — Faktor 4,3. Der Ratchet aus Plan B.2
   wirkt: wer an der Kappung steht, bleibt dort, und die zweite Hälfte einer 20er-Saison ist
   fast komplett Maximalrisiko (21 % aller Würfe ≥ 80 statt 6 %).
3. **Die Plan-Zahl 11 (aktiver Anteil) ist mit Chris' Korridor-Entscheidung nicht vereinbar.**
   E.1, 30.08.: „gleiche absolute Zielzahl (150–200/Saison) beibehalten, auch bei 20 Spieltagen“.
   Mit 11 fällt die 20-Spieltage-Saison auf **2** Verletzungen (Stamm A und B). Auch eine
   halbierte Bank-Erholung rettet 11 nicht (Bank 14: 9,6). Die 11 war eine Rechnung am
   Dauerstarter, nie eine Messung an einer Liga.
4. **Vermessen ist 4,5.** Damit liegt die 20-Spieltage-Saison bei **159 / 154** (Stamm A / B),
   mitten in 150–200, und bei dem **1,4-Fachen** der heutigen 10er-Saison statt dem 4,3-Fachen.
5. **Der Preis, ehrlich:** der Dauerstarter-Effekt aus Plan B.4 („Kappung erst nach 20
   Spieltagen“) ist mit 4,5 nicht zu haben — er kappt nach 9 statt nach 7. Korridor und
   Dauerstarter-Streckung schließen sich bei der heutigen Risikokurve aus (Abschnitt 3.3). Das ist
   die eine offene Frage an Chris (Abschnitt 7.1).
6. **Kein globaler Default-Wechsel.** Die aktive Erholung greift ohne ENV genau in einer
   Battle-Mode-Saison mit 20 Spieltagen (`isDoubledBattleSeason`) — und nirgends sonst. Chris'
   laufende Manager-Spielstände sind nachweislich bit-identisch (Abschnitt 6).

---

## 1. Was der Plan vorsah — und was davon jetzt steht

| Plan (Teil D) | Inhalt | Stand vorher | Dieser Branch |
|---|---|---|---|
| PR1 | `MATCHDAY_ACTIVE_RECOVERY` + Bank-Bonus, Netto-Buchung in Wurf/Apply/Replay/Anzeige | gebaut, Schalter AUS | Zahl vermessen (11 → 4,5); offene PR1-Reste nachgezogen: KI-Projektion rechnet netto, Saison-Fatigue-Statistik zieht netto ab |
| PR2 | Korridor für 10 UND 20 Spieltage mit/ohne aktive Erholung vermessen | offen | **gebaut**: `scripts/messe-erholungskorridor.ts`, Wächter `tests/injury-korridor-20-spieltage.test.ts` |
| PR3 | Flag-Default umstellen | offen | **ersetzt** durch ein Spielstand-Gate (Abschnitt 4) — globaler Default hätte Chris' laufende Saison verändert |
| PR4 | Halbserien, `repeat: 2` | gebaut (#930) | unverändert |
| PR5 | Doppel-Rundenplan (30 Runden) | offen | **gebaut**, nur für > 15 Spieltage aktiv; bis 15 bit-identisch |
| PR6 | 20 Spieltage für neue Battle-Saves | offen | **gebaut** (Abschnitt 5) |
| PR7/PR8 | Aufräumen, UI-Kapazität, Live-E2E | offen | teilweise (B2-Fallback, Verkaufstext); Rest offen (Abschnitt 7) |

---

## 2. Messmethode

`scripts/messe-erholungskorridor.ts` (Simulation in `lib/fatigue/erholungskorridor-simulation.ts`,
damit Skript und Wächter-Test dieselbe Liga fahren):

- **Liga**: exakt die Basisfall-Liga von `tests/injury-basisfall-korridor.test.ts` — 32 Kader in
  den am Live-Spielstand gemessenen Größen 8–14 (Ø 10,6), keine Gebäude, keine Traits, Intensität
  „normal“, Rotation „niedrigste Fatigue zuerst“.
- **Slots je Spieltag**: aus dem **echten** Spielplan-Generator `buildSeasonSeededDisciplineSchedule`
  (`repeat: 1` → 10 Spieltage, `repeat: 2` → 20 mit Derangement), je Saat ein eigener Plan. Dazu
  als Anschlusszeile die getippte 10er-Liste des Korridor-Tests.
- **Buchung**: jeder Spieltag über `applyFatigueAndInjuryAfterMatchday` — Last, Erholung, Wurf
  wie im Spiel. Optional (`--training`) zusätzlich `accumulateMatchdayTrainingProgress` mit Modus
  „mittel“ (die Trainingsschicht, die im Spiel jeden Spieltag mitläuft; je Saison gleich groß,
  weil sie durch `matchdayIds.length` teilt).
- **Zwei unabhängige Saatstämme** (`--stamm=A`, `--stamm=B`), je 16 Spielpläne; Spielplan- und
  Wurf-Saat kommen aus demselben Stamm, A und B teilen keine Saat. 10 und 20 Spieltage nutzen je
  Stamm dieselben Saaten (gepaarter Vergleich).

```sh
npx tsx scripts/messe-erholungskorridor.ts --saaten=16 --stamm=A
npx tsx scripts/messe-erholungskorridor.ts --saaten=16 --stamm=B
npx tsx scripts/messe-erholungskorridor.ts --saaten=16 --stamm=A --training
OLY_FATIGUE_ACTIVE_RECOVERY_VALUE=11 npx tsx scripts/messe-erholungskorridor.ts --saaten=16
```

---

## 3. Ergebnisse

### 3.1 Der Korridor, Endstand (aktiver Anteil 4,5), Basisfall

Verletzungen je Saison, Mittel · Spanne über 16 Spielpläne:

| Spieltage | aktive Erholung | Stamm A | Stamm B | Würfe ≥ 80 | Ø-Fatigue Ende |
|---:|---|---:|---:|---:|---:|
| 10 | aus (heute, Manager) | 112,3 · 59–156 | 105,8 · 69–174 | 6,2 % | 47,5 |
| 10 | an | 30,2 · 9–43 | 27,6 · 12–45 | 0,5 % | 27,2 |
| 20 | aus | **482,4** · 392–574 | **460,8** · 386–592 | 21,2 % | 61,1 |
| **20** | **an (Battle)** | **158,6** · 101–225 | **153,9** · 85–222 | 3,8 % | 34,7 |

Anschluss an den bestehenden Korridor-Test (feste Slot-Liste, Saaten `seed-1..5`): 10 Spieltage aus
**132,6** (128–138) — dieselbe Zahl, die der Test seit 16.08. dokumentiert. Die Simulation trifft
also den Wächter, auf den sich die bisherigen Kalibrierungen beziehen.

**Verhältnis 20 : 10** (jeweils gegen die heutige 10er-Saison ohne aktive Erholung):

| | Stamm A | Stamm B |
|---|---:|---:|
| 20 Spieltage OHNE aktive Erholung | 4,30 | 4,36 |
| 20 Spieltage MIT aktiver Erholung | **1,41** | **1,45** |

Bei doppelter Spielzeit kommt also gut das 1,4-Fache an Verletzungen heraus, nicht das Doppelte —
und je Spieltag gerechnet **weniger** als heute (7,9 statt 11,2 je Spieltag).

### 3.2 Mit Trainingsschicht „mittel“ (zur Einordnung)

| Spieltage | aktive Erholung | Stamm A | Stamm B |
|---:|---|---:|---:|
| 10 | aus | 152,1 | 140,8 |
| 20 | aus | 560,4 | 540,5 |
| 20 | an | **209,4** | **204,8** |

Die Trainingsschicht trägt je Saison rund +40 bis +50 bei, unabhängig von der Länge. Der
Korridor ist laut Chris „ohne Gebäude, frische Boosts etc.“ formuliert und der bestehende Wächter
misst ohne Trainingsschicht — kalibriert ist deshalb auf den Basisfall. Mit der Schicht liegt die
20er-Saison knapp über 200; das ist dieselbe Lage wie heute bei 10 Spieltagen (152 gegen den
Basisfall 112).

### 3.3 Der Sweep, aus dem 4,5 stammt (20 Spieltage, aktive Erholung an)

| aktiver Anteil | netto je Einsatz | 10 Sp. (A / B) | 20 Sp. (A / B) | Dauerstarter kappt nach |
|---:|---:|---:|---:|---:|
| 11 (Plan) | +5 | 0 / 0 | **2** / 2 | 20 Spieltagen |
| 8 | +8 | 5 | 28 | 13 |
| 6 | +10 | 17 | 81 | 10 |
| 5 | +11 | 25 / 23 | 135 / 130 | 10 |
| **4,5** | **+11,5** | **30 / 28** | **159 / 154** | **9** |
| 4 | +12 | 35 / 32 | 184 / 181 | 9 |
| 3 | +13 | 48 | 239 | 8 |

(Werte 8, 6, 3 mit 8 Saaten Stamm A gemessen, der Rest mit 16 Saaten je Stamm.)

Gegenprobe „11 behalten, Bank-Erholung senken“: Bank 18 → 6,1, Bank 14 → 9,6 Verletzungen. Der
Grund ist strukturell: die Liga rotiert (Einsatzquote ≈ 0,75), ihre Fatigue bleibt nur dann im
Risikobereich, wenn ein Einsatz netto deutlich mehr kostet, als ein Viertel Bank tilgt — und
genau diese Netto-Last treibt den Dauerstarter schneller an die Kappung. Mit der heutigen
Risikokurve (0 % bis 25, 3 % bei 50) gibt es keinen Wert, der beides liefert.

### 3.4 Was sich für den Spieler ändert (20-Spieltage-Battle-Saison)

| | heute (Manager, 10 Sp.) | Battle, 20 Sp. |
|---|---:|---:|
| Einsatz schonen / normal / pushen | +12 / +16 / +22,4 | **+7,5 / +11,5 / +17,9** |
| Bank / verletzt | −28 | −28 (unverändert) |
| Bank tilgt Einsätze (normal) | 1,75 | **2,4** |
| Dauerstarter an der Kappung | ab Spieltag 7 | ab Spieltag 9 |

Rotation lohnt sich spürbar mehr (Chris E.1/E.7: „schneller abgebaut, wenn rotiert wird“), Spielen
bleibt ab Spieltag 1 spürbar. Die KI rechnet in ihrer Trainings-/Schon-Projektion
(`ai-player-training-load-service.ts`) mit derselben Netto-Last.

---

## 4. Der Schalter: Spielstand-Gate statt Default-Wechsel

`isFatigueActiveRecoveryEnabled(gameState)`:

- ENV `OLY_FATIGUE_ACTIVE_RECOVERY` = `1` → AN für jeden Spielstand, `0` → AUS für jeden (Mess-
  und Notschalter, bleibt);
- ENV nicht gesetzt → **AN genau dann, wenn `isDoubledBattleSeason(gameState)`**: Battle-Mode-Save
  (`getSeasonDisciplineRepeatCount` → `isBattleModeSave`, dasselbe Muster wie der Liga-Split) UND
  `season.matchdayIds.length` ≥ 20.

Warum nicht nur „Battle Mode“: ein Battle-Save, der vor dieser Umstellung mit 10 Spieltagen
angelegt wurde, bleibt bei 10 (keine Migration, Recherche 06.09. Frage 10). Seine laufende Saison
darf ihr Verletzungsmodell nicht wechseln. Eine 20-Spieltage-Saison entsteht nur bei Anlage eines
neuen Battle-Saves und erbt sich von dort weiter — sie hat die aktive Erholung vom ersten
Spieltag an. Damit gilt die Regel der Projektaufsicht wörtlich: kein Manager-Spielstand und keine
laufende Saison sind betroffen.

Alle Leser hängen an dieser einen Funktion: Wurf, Apply, Replay-Rücknahme, Einsatzlisten-Anzeige
(über `getPlayerActiveRecoveryCredit`), KI-Projektion, Saison-Fatigue-Statistik.

---

## 5. Die Umschaltung auf 20 Spieltage (W2) — nur Battle Mode

| Stelle | Vorher | Jetzt |
|---|---|---|
| E1 `lib/data/dataAdapter.ts` | Seed hart 10 | Seed bleibt 10; `createGameStateFromSeed(…, { seasonDisciplineRepeat: 2 })` verlängert auf `matchday-1..20` und baut den Plan mit `repeat: 2` |
| E2 `lib/game/new-game-setup-service.ts` | erbte 10 | Spielmodus wird VOR dem Saisonaufbau entschieden; Battle → `getSeasonDisciplineRepeatCount` = 2 → 20 Spieltage, Halbserien, 320 Fixtures |
| E3 `lib/season/preseason-workflow-service.ts` | `matchdayCount` geerbt, ohne `repeat` (20 IDs mit nur 20 Slots wären zehn leere Spieltage gewesen) | `repeat` aus `getActiveSeasonDisciplineRepeatCount` der abgelaufenen Saison |
| E4 Neuaufbau `getSeasonDisciplineSchedule` | stutzte auf 10 | repeat-bewusst für Doppelsaisons |
| F1 `lib/season/season-fixture-schedule.ts` | Modulo-Wrap über 15 Runden (Spieltag 16 = Spieltag 1, gleiche Seite) | ab > 15 Spieltagen Doppel-Rundenplan (30 Runden), Fenster 20: jeder gegen jeden, fünf Rückspiele mit getauschter Seite; ≤ 15 bit-identisch |
| B2 `lib/foundation/game-flow-controller.ts` | `totalMatchdays ?? 10` | `?? matchdayIds.length` |
| Text `transfer-sell-view-labels.ts` | „nach Spieltag 10“ | „nach dem letzten Spieltag“ |

Manager Mode: 10 Spieltage, kein `repeat`, keine `occurrenceInSeason`, keine aktive Erholung —
per Test (`new-game-setup-service.test.ts`) und am Live-Abbild (Abschnitt 6) festgehalten.

---

## 6. Bit-Identität am echten Spielstand

`scripts/pruefe-erholung-gate-am-save-abbild.ts` bildet je Save im Abbild einen Strukturhash über
Spielplan, Aufstellungs-Kontexte aller Teams (inkl. Verletzungsrisiko-Projektion), die
**Resolve-Vorschau** (`buildLegacyMatchdayResolvePreview`), den Verletzungswurf, die
Fatigue-Buchung des aktuellen Spieltags, die KI-Trainingsprojektion und die
Saison-Fatigue-Statistik — gefahren gegen `main` und gegen diesen Branch, am frisch gespiegelten
`live-save` (`7454b55b`, 16.10. 15:00 UTC, Spiegel laut `pruefe-spiegel-frische.ts` frisch).

Ergebnis siehe PR-Beschreibung (vollständige Ausgabe beider Läufe): alle acht Saves im Abbild
sind Manager-Saves, das Gate ist für alle AUS, **alle Fingerabdrücke und der Gesamt-Hash sind
identisch** — darunter Chris' aktiver Save `new-game-1787123325719-swnjlk` (Saison 2) und der
jüngste Save `new-game-1791961407272-ct2a54` (Saison 1, angelegt 14.10.).

---

## 7. Offen — Chris-Entscheidungen und Folgearbeit

1. **Korridor ODER Dauerstarter-Streckung** (Abschnitt 3.3). Umgesetzt ist Chris' eigene
   Entscheidung E.1 (Korridor 150–200 auch bei 20 Spieltagen) → aktiver Anteil 4,5, Kappung des
   Dauerstarters ab Spieltag 9. Wer die Plan-Idee „Kappung erst am Saisonende“ will, braucht eine
   flachere Risikokurve oberhalb 25 — das ist eine Kurven-, keine Erholungsfrage, und Chris hat
   die Kurve zweimal selbst gesetzt. Umstellen ohne Code: `OLY_FATIGUE_ACTIVE_RECOVERY_VALUE`.
2. **Korridor mit oder ohne Trainingsschicht?** Basisfall 159/154, mit Trainingsschicht „mittel“
   209/205. Der bestehende Wächter misst ohne; falls Chris „mit“ meint, gemessen (Trainingsschicht
   an, Stamm A/B): 5 → 179/175, **5,5 → 153/148**. Dann wäre 5,5 der Wert (Basisfall dort
   unter den 135/130 von Wert 5 — nicht gesondert gemessen, und damit unter dem Wächter-Korridor).
3. **Manager Mode bekommt die aktive Erholung nicht** (Projektaufsicht, 16.10.). Bei 10 Spieltagen
   würde sie die Verletzungen auf ein Viertel drücken (112 → 30) und damit Chris' Korridor
   reißen — eine Übernahme dort ist eine eigene Entscheidung, nicht Teil dieses Umbaus.
4. **Nicht in diesem Branch** (W4/W5 der Recherche 06.09., Konzept 16.10. Gruppen 2/3): die neun
   Anzeige-Konsumenten „eine Kadergröße je Saison“ (Kaderprofil zeigt das nächste offene
   Vorkommen, nicht beide), Spielplan-Tab mit 20 Zeilen (Layout ungeprüft), Captain-Slots (3 von
   20), Formkarten je Spieler, Sponsor-Event-Frequenz, Award-Schwellen, Punkteverhältnis,
   PPS-Duell-Brücke, Auf-/Abstieg. Ein Battle-Save mit 20 Spieltagen ist spielbar, aber diese
   Punkte sind dort sichtbar unfertig.
5. **`scripts/export-injury-balance-audit.ts`** hat eine eigene Simulationsschleife und kennt die
   aktive Erholung weiterhin nicht; für Battle-Saisons ist `messe-erholungskorridor.ts` das
   Werkzeug.

---

## 8. Dateien

- `lib/fatigue/fatigue-injury-service.ts` — Gate, vermessener Wert
- `lib/season/season-discipline-schedule.ts` — `isDoubledBattleSeason`, `getActiveSeasonDisciplineRepeatCount`, Neuaufbau
- `lib/data/dataAdapter.ts`, `lib/game-state/singleplayer-state.ts`, `lib/game/new-game-setup-service.ts`, `lib/season/preseason-workflow-service.ts` — W2
- `lib/season/season-fixture-schedule.ts` — Doppel-Rundenplan
- `lib/ai/ai-player-training-load-service.ts`, `lib/foundation/player-season-fatigue-stats.ts`, `lib/foundation/team-history-health-metrics.ts` — Netto-Last in KI und Statistik
- `lib/fatigue/erholungskorridor-simulation.ts`, `scripts/messe-erholungskorridor.ts`, `scripts/pruefe-erholung-gate-am-save-abbild.ts` — Messung und Nachweis
- `tests/injury-korridor-20-spieltage.test.ts` (neu), `tests/fatigue-aktive-erholung.test.ts`, `tests/fatigue-last-drei-stufen.test.ts`, `tests/season-fixture-schedule.test.ts`, `tests/new-game-setup-service.test.ts`, `tests/liga-spielplan-saison2-battle-mode.test.ts`
