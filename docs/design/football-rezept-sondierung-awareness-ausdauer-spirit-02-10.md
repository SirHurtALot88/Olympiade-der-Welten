# Football-Rezept-Sondierung: stamina/will einen Lesepunkt, awareness/spirit geprüft und zurückgestellt (02.10., überarbeitet nach Review)

Task #34, Football-Teil (Fable-Konsultation: TEILWEISE Klasse A). Football hat Rezept C
(Opus-Plan 10.09., `public/mockups/battle-mode.engine.js`, `FELDSPIEL_ART.football.rezept`)
seit dessen letzter Kalibrierung nicht angefasst bekommen. rho ist bestanden, die
Pp-Pflichtprüfung (CLAUDE.md, „Die Eignungsmatrix ist gesperrt") ist seit dem
zwölften Nachtrag in `docs/design/stand-aller-disziplinen.md` als VERLETZT bekannt: vier der
zwölf Matrixattribute (awareness, stamina, will, spirit — zusammen 20 der 100 Matrix-Pp) haben
praktisch keinen mechanischen Kanal.

**Auftrag hier war ausdrücklich NICHT P1 (Uhr/Spielstand, geparkt wegen Pp 47,3→71,1) und NICHT
P2–P4 (neue Mechaniken: Playcall/Box-Reads, O-Line, Special Teams — Klasse B, brauchen Chris).**
Nur eine reine Rezept-Prozent-Umschichtung innerhalb der acht bestehenden Sub-Skills, nach
demselben Muster wie die gemergte Gewichtheben-Kalibrierung
(`docs/design/gewichtheben-kalibrierung-ansage-kanal-01-10.md`, PR #1102): keine neuen
`rr()`-Aufrufe, keine neuen Zustände, nur Gewichte innerhalb bestehender Formeln verschoben.

## WICHTIG — diese Fassung ersetzt eine zurückgezogene erste Version

**Die erste Fassung dieser PR wurde nach unabhängigem Review ZURÜCKGEZOGEN.** Sie hatte bei
n=24 rho 0,805 (bestanden) gemessen — bei n=48 (vom Review nachgemessen und hier selbst
reproduziert) fällt dieselbe Änderung auf **0,788 (durchgefallen)**. Die n=24-Stichprobe hatte
für die ohnehin sehr dünne Football-Marge (Baseline bei n=48 nur 0,804, +0,004) schlicht nicht
genug statistische Power — das Bootstrap-90%-Konfidenzintervall bei n=24 lag bei [0,706; 0,848],
die 0,80-Schranke mitten im Rauschen. Zahlen, Diff-Umfang und Dokumentation der ersten Fassung
wurden vom Review inhaltlich bestätigt (kein Vorwurf der Schönrechnerei) — nur die
Stichprobengröße war zu klein, um das Risiko sichtbar zu machen. **Ab dieser Runde ist n=48
Pflicht für die rho-Abnahme dieser Disziplin, nicht n=24.**

## Ergebnis — reduzierte, kaderfest bei n=48 abgesicherte Fassung

**Pp sinkt von im Mittel 57,05 auf 54,75 (zwei Saatströme, n=48) — kleiner als die
zurückgezogene erste Fassung (die hätte Pp stärker gesenkt, aber auf Kosten von rho), dafür mit
echter Sicherheitsmarge.** rho steigt sogar leicht: **0,804 → 0,808**, bestanden mit MEHR Marge
als die unveränderte Baseline selbst (zweimal unabhängig bei n=48 bit-identisch reproduziert).
**awareness bleibt bei seinem ursprünglichen Rezeptanteil unverändert** — jede getestete
Erhöhung (sowohl die große der ersten Fassung als auch eine kleinere) fiel bei n=48 durch die
Schranke. Die Aufgabe „gib awareness im PASSSCHUTZ-Kanal mehr Gewicht" wird deshalb bewusst
NICHT erfüllt, mit vollständigem Messbeleg, nicht stillschweigend ignoriert.

## 1. Diagnose: vier Attribute ohne echten Kanal (unverändert gegenüber der ersten Fassung)

| Attribut | Matrix-Pp (`BASIS_JE_DISC.football`) | Bisheriger Kanal |
|---|---:|---|
| awareness | 8 | nur `PASSSCHUTZ` (20 %) — dessen einziger Hebel, der `pSack`-Term in `resolvePass()`, ist strukturell dünn: der Passer wird über `gewichtetesLosNach(off,"PASSGENAUIGKEIT")` gezogen, UNABHÄNGIG von `PASSSCHUTZ` (s. `docs/design/football-rezept-kalibrierung.md` Abschnitt 5) |
| stamina | 6 | nur `AUSDAUER` (67 %) — `AUSDAUER` wird von KEINER Spielformel gelesen |
| will | 3 | nur `AUSDAUER` (33 %) — dieselbe Lücke |
| spirit | 3 | NIRGENDS — keiner der acht Sub-Skills führt spirit überhaupt |

Spearman-Korrelation der Einzelattribute zur echten Football-Eignung, kaderfest (110 Spieler,
`football-rezept-kalibrierung.md` Abschnitt 4.2): health 0,535, determination 0,532,
**will 0,488**, power 0,424, charisma 0,358, **spirit 0,357**, torment 0,274, **stamina 0,159**,
**awareness −0,335**.

## 2. Was in der ERSTEN Fassung versucht wurde — und warum es zurückgezogen wurde

```diff
- PASSSCHUTZ:      {power:40,health:40,awareness:20},
+ PASSSCHUTZ:      {power:35,health:30,awareness:25,stamina:10},   # ZURÜCKGEZOGEN

- BALLSICHERHEIT:  {power:35,health:35,determination:30},
+ BALLSICHERHEIT:  {power:30,health:30,determination:25,will:15},  # ZURÜCKGEZOGEN
```

| Messung | n | rho je Spiel | Abnahme |
|---|---:|---:|---|
| Baseline (main) | 24 | 0,814 | bestanden |
| Baseline (main) | **48** | **0,804** | bestanden (Marge nur +0,004) |
| Erste Fassung (beide Änderungen) | 24 | 0,805 | bestanden |
| Erste Fassung (beide Änderungen) | **48** | **0,788** | **DURCHGEFALLEN** |

n=24 zeigte keinen Unterschied zwischen "nur PASSSCHUTZ" und "PASSSCHUTZ+BALLSICHERHEIT"
(beide 0,805) — bei n=48 zeigt sich: **PASSSCHUTZ allein (awareness 20→25, stamina 0→10) senkt
rho bereits auf 0,799** (knapp durchgefallen), BALLSICHERHEITs will-Anteil (15 %) kommt noch
einmal oben drauf.

## 3. Isolationsmessung bei n=48 — awareness ist der Treiber, nicht stamina/will

Um herauszufinden, WELCHE Teiländerung das Risiko trägt, wurden die Komponenten einzeln
kaderfest nachgemessen (`node scripts/miss-alle-disziplinen.mjs 48 football`):

| Variante | PASSSCHUTZ | BALLSICHERHEIT | rho je Spiel (n=48) | Abnahme |
|---|---|---|---:|---|
| Baseline | `{power:40,health:40,awareness:20}` | `{power:35,health:35,determination:30}` | 0,804 | bestanden |
| PASSSCHUTZ groß (erste Fassung) | `{power:35,health:30,awareness:25,stamina:10}` | unverändert | 0,799 | knapp durchgefallen |
| PASSSCHUTZ reduziert (awareness 22, stamina 5) | `{power:38,health:35,awareness:22,stamina:5}` | unverändert | 0,795 | **durchgefallen** |
| **PASSSCHUTZ nur-stamina (awareness unverändert!)** | `{power:38,health:36,awareness:20,stamina:6}` | unverändert | **0,808** | **bestanden, über Baseline** |
| Final (PASSSCHUTZ nur-stamina + BALLSICHERHEIT reduziert) | `{power:38,health:36,awareness:20,stamina:6}` | `{power:33,health:33,determination:28,will:6}` | **0,808** | **bestanden**, zweimal reproduziert |

**Der entscheidende Befund:** eine REDUZIERTE Awareness-Erhöhung (22 % statt 25 %) ist NICHT
sicherer als die große (25 %) — beide fallen durch (0,795 bzw. 0,799). Die Rollenlotterie ist
diskret und die Messung bei n=48 selbst noch nicht glatt-monoton gegen kleine Prozent-Deltas
(dasselbe Phänomen, das `football-gewichtheben-opus-review.md`/`FK_LOS_KAPPA`-Kommentare schon
für andere Stellschrauben dieses Motors dokumentieren). **Jede getestete Erhöhung von awareness
über seinen ursprünglichen 20-%-Anteil hinaus kostet messbar rho-Marge — es gibt bei den hier
getesteten Werten keinen sicheren Zwischenpunkt.** Ein reiner stamina-Zusatz OHNE jede
Awareness-Änderung ist dagegen nicht nur sicher, sondern liegt sogar ÜBER der Baseline (0,808
vs. 0,804) — stamina (Spearman 0,159, schwach positiv) kostet nichts, awareness (Spearman
−0,335, negativ) kostet, genau wie die Korrelationsrichtung vorhersagt.

**Finale Entscheidung: awareness bleibt bei seinem ursprünglichen Anteil (20 % in PASSSCHUTZ)
unverändert.** CLAUDE.md gibt rho>0,80 ausdrücklich Vorrang vor der Pp-Schranke. Die
Teilaufgabe „gib awareness im PASSSCHUTZ-Kanal mehr Gewicht" wird damit **nicht** erfüllt — mit
vollständigem Messbeleg (drei getestete Awareness-Werte, alle über dem Ausgangspunkt durchgefallen
oder knapp durchgefallen), nicht stillschweigend ignoriert.

## 4. Die finale Änderung — stamina und will, beide kaderfest als sicher bestätigt

```diff
- PASSSCHUTZ:      {power:40,health:40,awareness:20},
+ PASSSCHUTZ:      {power:38,health:36,awareness:20,stamina:6},

- BALLSICHERHEIT:  {power:35,health:35,determination:30},
+ BALLSICHERHEIT:  {power:33,health:33,determination:28,will:6},
```

`PASSGENAUIGKEIT`, `LAUFKRAFT`, `ABWEHR_PASS`, `ABWEHR_LAUF`, `AUSDAUER`, `LAUFTEMPO` bleiben
unangetastet.

- **PASSSCHUTZ**: awareness bleibt bei 20 % (unverändert). stamina neu bei 6 % (vorher 0),
  power/health je leicht gesenkt. Kaderfest bestätigt rho-sicher (0,808, über Baseline).
- **BALLSICHERHEIT**: will neu bei 6 % (vorher 0, reduziert von den ursprünglich erwogenen
  15 % — der kleinere Wert hat denselben rho-Wert gemessen wie ganz ohne will-Anteil, also kein
  erkennbares zusätzliches Risiko). power/health/determination je nur leicht gesenkt.

### Geprüft und verworfen: spirit in TEAMGEIST (unverändert gegenüber der ersten Fassung)

Der naheliegendste Kanal für spirit ist `TEAMGEIST` (Receiver-Los in `resolvePass()`, mit
~44,5 % das mit Abstand größte mechanische Gewicht aller acht Sub-Skills). Zwei Varianten
kaderfest bei n=24 gemessen:

| TEAMGEIST-Variante | rho je Spiel (n=24) | Abnahme |
|---|---:|---|
| `{health:45,torment:30,speed:25}` (unverändert) | 0,805 | bestanden |
| `{health:45,torment:22,speed:25,spirit:8}` | 0,788 | **durchgefallen** |
| `{health:38,torment:22,speed:25,spirit:15}` | 0,765 | **durchgefallen** |

Schon der kleinstmögliche sinnvolle Nachschlag (8 %) drückt rho unter die Schranke — bei n=24
schon so klar durchgefallen, dass eine n=48-Nachmessung hier nicht einmal nötig war, um die
Entscheidung zu stützen (im Gegensatz zum PASSSCHUTZ/BALLSICHERHEIT-Fall, wo n=24 täuschte).
**spirit bleibt bei 0 % mechanischem Gewicht — Zielkonflikt bewusst nicht aufgelöst.**

## 5. Messung: rho (n=48, kaderfest, live-save-Kaderfamilie) — Pflichtgröße ab jetzt

```sh
node scripts/miss-alle-disziplinen.mjs 48 football
```

| | vorher (main) | nachher (final) |
|---|---:|---:|
| rho je Spiel (Median) | 0,804 | **0,808** |
| Spannweite | 0,143 | 0,140 |
| rho Saison (Median) | 0,874 | 0,874 |
| Spannweite (Saison) | 0,119 | 0,133 |
| Abnahme | bestanden | **bestanden, mit MEHR Marge als die Baseline** |

Der nachher-Wert ist zweimal unabhängig gemessen und bit-identisch reproduziert (0,808/0,140/
0,874/0,133 in beiden Läufen).

## 6. Messung: Pp (`messe-arena-einfluss.mjs`, n=48, zwei Saatströme)

```sh
node scripts/messe-arena-einfluss.mjs football 48                        # Strom 0 (versatz=0)
node scripts/messe-arena-einfluss-zweiter-saatstamm.mjs football 48      # Strom 2 (versatz=10 000 000)
```

| Saatstrom | Pp vorher (main, n=48) | Pp nachher (final, n=48) |
|---|---:|---:|
| 0 (versatz=0) | 53,5 | **51,7** |
| 10 000 000 | 60,6 | **57,8** |
| **Mittel** | **57,05** | **54,75** |

**Hinweis zur Vorher-Zahl:** die in der Aufgabenstellung zitierten "47,3 Pp" (gemessen
21.–26.09., `stand-aller-disziplinen.md` zwölfter Nachtrag) sind veraltet — mehrere seither
gemergte, football-fremde PRs haben den gemessenen Wert verschoben. Der echte, auf diesem Commit
frisch gemessene Vorher-Wert bei n=48 liegt bei 53,5–60,6 Pp (Mittel 57,05), unabhängig von
dieser Änderung.

Attributabweichung, Strom 0 (vorher → nachher, n=48):

| Attribut | Matrix | vorher | nachher |
|---|---:|---:|---:|
| health | 18 | +10,9 | +9,6 |
| speed | 14 | +8,0 | +7,0 |
| torment | 12 | +7,7 | +8,6 |
| power | 22 | −2,6 | −2,7 |
| determination | 10 | −4,2 | −3,2 |
| dexterity | 4 | +0,1 | +0,6 |
| will | 3 | −3,0 | −3,0 |
| spirit | 3 | −3,0 | −3,0 |
| awareness | 8 | −8,0 | −8,0 |
| stamina | 6 | −6,0 | −6,0 |
| charisma / intelligence | 0 | 0,0 | 0,0 |

Attributabweichung, Strom 10 000 000 (vorher → nachher, n=48):

| Attribut | Matrix | vorher | nachher |
|---|---:|---:|---:|
| health | 18 | +12,2 | +11,1 |
| speed | 14 | +9,2 | +7,9 |
| torment | 12 | +8,8 | +9,4 |
| power | 22 | −4,2 | −4,4 |
| determination | 10 | −6,1 | −4,5 |
| dexterity | 4 | +0,1 | +0,5 |
| will | 3 | −3,0 | −3,0 |
| spirit | 3 | −3,0 | −3,0 |
| stamina | 6 | −6,0 | −6,0 |
| awareness | 8 | −8,0 | −8,0 |
| charisma / intelligence | 0 | 0,0 | 0,0 |

**Ehrlich, nicht beschönigt:** bei dieser reduzierten Rezeptgröße ist die Pp-Verbesserung
kleiner als in der zurückgezogenen ersten Fassung (Mittel 54,75 statt der dort gemessenen
47,55) — der Preis für die rho-Sicherheit. awareness, will und stamina zeigen bei n=48 ALLE
exakt 0 % gemessenes mechanisches Gewicht in beiden Strömen — auch der kleine, sichere
stamina-/will-Zusatz (6 % statt vorher 10 %/15 %) ist zu klein, um sich bei dieser
Stichprobengröße von der Mess-Nullmarke abzuheben. Die gemessene Pp-Verbesserung kommt
ausschließlich aus der gedämpften Überrepräsentation von power/health/determination, nicht aus
sichtbarem will/stamina-Beitrag. Das ist der Preis, CLAUDE.mds rho-Vorrang einzuhalten, bei
einer Disziplin, deren Baseline-Marge bei n=48 von Haus aus nur 0,004 beträgt.

## 7. Zielkonflikt-Protokoll (CLAUDE.md verlangt: dokumentieren, nicht verstecken)

| Spannung | Entscheidung | Beleg |
|---|---|---|
| awareness mehr Gewicht (Pp-Pflicht, expliziter Auftragstext) vs. rho>0,80 (harte Nebenbedingung mit Vorrang) | awareness bleibt bei 20 % (unverändert) — JEDE getestete Erhöhung (25 % und 22 %) fiel bei n=48 durch die Schranke | Abschnitt 3 |
| spirit einen Kanal geben (Pp-Pflicht) vs. rho>0,80 | spirit bekommt KEINEN Kanal — TEAMGEIST ist zu dominant, jeder getestete Nachschlag (8 % und 15 %) reißt rho unter die Schranke | Abschnitt 4 |
| n=48 (jetzt Pflicht) vs. Laufzeit in der geteilten Umgebung | n=48 wurde durchgehalten (Wait-Loop mit Stall-Check statt Abbruch nach erstem Timeout) — jeder Lauf dieser Runde brauchte 13–16 Minuten, aber lief vollständig durch | — |

## 8. Klasse-T-Prüfung

Angefasst wurde ausschließlich das `rezept`-Objekt von `FELDSPIEL_ART.football` — vier
Prozentzahlen innerhalb von zwei der acht Sub-Skill-Gewichtungen. Keine Spielablauf-Konstante
(Rundenzahl, Zeittakt, `FK_LOS_KAPPA`, Erfolgskurven-/Korridor-Koeffizienten wie `pSack`-,
`pFumble`- oder `meanYds`-Basiswerte) wurde verändert, kein neuer `rr()`-Aufruf, kein neuer
Zustand. Reine Wertungsgewichtung — keine Klasse-T-Freigabe erforderlich.

## 9. Vitest — keine neuen Fehlschläge

Alle vier direkt arena-/battle-mode-bezogenen Testdateien liefen zusammen grün:

```sh
npx vitest run tests/battle-mode-arena-resolve-engine.test.ts \
  tests/battle-mode-arena-matchday-resolve-e2e.test.ts \
  tests/arena-matchday-weg-b-beide-disziplinen.test.ts \
  tests/season-discipline-schedule-battle-repeat.test.ts
# 4 Testdateien, 31 Tests, alle bestanden
```

Ein voller `npx vitest run` in der stark ausgelasteten geteilten Umgebung (mehrere parallele
Sessions im selben Container) zeigte vereinzelte Fehlschläge in football-fremden Dateien
(`singleplayer-state.test.ts`, `matchday-auto-run-service.test.ts`,
`ai-legacy-lineup-batch-apply-precheck-regression.test.ts`,
`matchday-mvp-scoring-service.test.ts`, `player-generator-service.test.ts`) —
alle fünf wurden isoliert (ohne die Ressourcenlast des vollen Laufs) erneut gefahren und liefen
jeweils vollständig grün (36/37, 33/33, 4/4 Tests). Football ist ohnehin nicht in
`ARENA_RESOLVED_DISCIPLINE_IDS` (nicht produktiv) — das Risiko fürs Live-Spiel ist unabhängig
davon null.

## Anhang: Reproduktion

```sh
node --check public/mockups/battle-mode.engine.js
node scripts/miss-alle-disziplinen.mjs 48 football
node scripts/messe-arena-einfluss.mjs football 48
node scripts/messe-arena-einfluss-zweiter-saatstamm.mjs football 48
npx vitest run tests/battle-mode-arena-resolve-engine.test.ts tests/battle-mode-arena-matchday-resolve-e2e.test.ts tests/arena-matchday-weg-b-beide-disziplinen.test.ts tests/season-discipline-schedule-battle-repeat.test.ts
```

Jeder `miss-alle-disziplinen.mjs 48`/`messe-arena-einfluss*.mjs football 48`-Lauf dieser Runde
brauchte 13–16 Minuten realer Laufzeit (mehrfach kaderfest reproduziert) — geduldig abwarten
(Wait-Loop mit Stall-Check, nicht nach dem ersten scheinbaren Hänger abbrechen) statt auf eine
kleinere, ungenauere Stichprobe auszuweichen.
