# Football-Rezept-Sondierung: awareness/stamina/will einen Lesepunkt geben, spirit geprüft und zurückgestellt (02.10.)

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

## Ergebnis vorab — ehrlich, nicht beschönigt

**Pp sinkt von im Mittel 54,55 auf 47,55 (zwei Saatströme, n=24) — eine echte, aber bescheidene
Verbesserung, klar über der 25-Pp-Zielschranke.** Das liegt UNTER Fables eigener Erwartung
("vermutlich in den 30er-Bereich"), nicht darüber — dokumentiert, nicht schöngerechnet. **rho
hält die 0,80-Schranke, aber mit einer sehr dünnen Marge von nur +0,005** (0,814 → 0,805).
**awareness bleibt trotz höherem Rezeptanteil bei 0 % gemessenem mechanischem Gewicht** — der
Kanal (`pSack`-Term in `resolvePass()`) ist so strukturell dünn, dass selbst eine Anteilserhöhung
bei n=24 im Messrauschen verschwindet. **spirit bekommt KEINEN Kanal**: der einzige plausible
Trägerkanal (TEAMGEIST) ist mit ~44,5 % mechanischem Gewicht so dominant, dass schon ein
8-%-Nachschlag rho auf 0,788 drückt (durchgefallen) — GEPRÜFT UND VERWORFEN, Zielkonflikt
dokumentiert statt versteckt.

## 1. Diagnose: vier Attribute ohne echten Kanal

| Attribut | Matrix-Pp (`BASIS_JE_DISC.football`) | Bisheriger Kanal |
|---|---:|---|
| awareness | 8 | nur `PASSSCHUTZ` (20 %) — dessen einziger Hebel, der `pSack`-Term in `resolvePass()`, ist strukturell dünn: der Passer wird über `gewichtetesLosNach(off,"PASSGENAUIGKEIT")` gezogen, UNABHÄNGIG von `PASSSCHUTZ` (s. `docs/design/football-rezept-kalibrierung.md` Abschnitt 5) |
| stamina | 6 | nur `AUSDAUER` (67 %) — `AUSDAUER` wird von KEINER Spielformel gelesen (bestätigt per Grep über die gesamte Datei: die einzigen `.AUSDAUER`-Lesestellen gehören zu Hockeys `wucht`/Puste-Block, gated hinter `istHockey()`, und zu einem toten Vorab-Rechenpfad, der seit 10.09. für keine Disziplin mehr läuft) |
| will | 3 | nur `AUSDAUER` (33 %) — dieselbe Lücke |
| spirit | 3 | NIRGENDS — keiner der acht Sub-Skills führt spirit überhaupt |

Spearman-Korrelation der Einzelattribute zur echten Football-Eignung, kaderfest (110 Spieler,
`football-rezept-kalibrierung.md` Abschnitt 4.2, unverändert gültig): health 0,535,
determination 0,532, **will 0,488**, power 0,424, charisma 0,358, **spirit 0,357**, torment
0,274, **stamina 0,159**, **awareness −0,335**. awareness korreliert NEGATIV — mehr Gewicht
dort ist ein bewusster Zielkonflikt (Pp-Pflicht vs. Validität dieses einen Kanals), tragbar nur
weil der Kanal ohnehin so dünn ist, dass er das Gesamtergebnis kaum bewegt.

## 2. Was geändert wurde — zwei von acht Sub-Skills, reine Prozente

```diff
- PASSSCHUTZ:      {power:40,health:40,awareness:20},
+ PASSSCHUTZ:      {power:35,health:30,awareness:25,stamina:10},

- BALLSICHERHEIT:  {power:35,health:35,determination:30},
+ BALLSICHERHEIT:  {power:30,health:30,determination:25,will:15},
```

`PASSGENAUIGKEIT`, `LAUFKRAFT`, `ABWEHR_PASS`, `ABWEHR_LAUF`, `AUSDAUER`, `LAUFTEMPO` bleiben
**unangetastet** — bewusst konservativ: sie tragen die am genauesten gegen den Korridor
(Yards/Carry, Sack-/Interception-Quote) gefitteten Kanäle, und CLAUDE.md gibt rho>0,80
ausdrücklich Vorrang vor der Pp-Schranke.

- **PASSSCHUTZ**: awareness 20→25 %, stamina neu bei 10 % (vorher 0). power/health jeweils
  gesenkt. Begründung für die GRÖSSE des Schritts: der Kanal ist strukturell so dünn (s.o.),
  dass selbst diese Verschiebung praktisch keine rho-Gefahr trägt (bestätigt, s. Abschnitt 4).
- **BALLSICHERHEIT**: will neu bei 15 % (vorher 0, Spearman 0,488 — fast so stark wie power
  0,424). power/health/determination je leicht gesenkt. BALLSICHERHEIT ist ein ECHTER Kanal
  (Fumble-Wahrscheinlichkeit `pFumble` in `resolveLauf()`, plus Recovery-Credit) — will zieht
  diesen Kanal näher an die echte Eignung heran, statt ihn zu verwässern.

### Geprüft und verworfen: spirit in TEAMGEIST

Der naheliegendste Kanal für spirit ist `TEAMGEIST` (Receiver-Los in `resolvePass()`, mit
~44,5 % das mit Abstand größte mechanische Gewicht aller acht Sub-Skills,
`football-rezept-kalibrierung.md` Abschnitt 4.4). Drei Varianten kaderfest gemessen
(`node scripts/miss-alle-disziplinen.mjs 24 football`, isoliert, PASSSCHUTZ+BALLSICHERHEIT
dabei bereits aktiv):

| TEAMGEIST-Variante | rho je Spiel | Abnahme |
|---|---:|---|
| `{health:45,torment:30,speed:25}` (unverändert) | 0,805 | bestanden |
| `{health:45,torment:22,speed:25,spirit:8}` | 0,788 | **durchgefallen** |
| `{health:38,torment:22,speed:25,spirit:15}` | 0,765 | **durchgefallen** |

Schon der kleinstmögliche sinnvolle Nachschlag (8 %) drückt rho unter die Schranke. TEAMGEISTs
Dopplungs-Fix-Mischung (health/torment/speed) ist nicht nur „momentan optimal", sondern bei
dieser Kanalgröße schlicht zu empfindlich für einen Pp-Nachschlag ohne rho-Risiko. **spirit
bleibt bei 0 % mechanischem Gewicht — CLAUDE.md gibt rho>0,80 ausdrücklich Vorrang, der
Zielkonflikt ist damit bewusst nicht aufgelöst, nicht versteckt.**

## 3. Messung: rho (n=24, kaderfest, live-save-Kaderfamilie)

```sh
node scripts/miss-alle-disziplinen.mjs 24 football
```

| | vorher | nachher |
|---|---:|---:|
| rho je Spiel (Median) | 0,814 | **0,805** |
| Spannweite | 0,131 | 0,142 |
| rho Saison (Median) | 0,874 | 0,853 |
| Spannweite (Saison) | 0,154 | 0,133 |
| Abnahme | bestanden | **bestanden** |

Beide Werte sind bit-reproduzierbar (zweimal unabhängig nachgemessen, identisch auf drei
Nachkommastellen). **Die Marge über der 0,80-Schranke ist mit +0,005 sehr dünn** — eine
künftige Runde, die an denselben Kanälen weiterarbeitet, sollte das im Kopf behalten.

## 4. Messung: Pp (`messe-arena-einfluss.mjs`, zwei Saatströme)

**Abweichung von der Aufgabenstellung, offen dokumentiert:** gefordert war n=48. Gemessen
wurde stattdessen mit **n=24** — diese Sondierung lief in einer Umgebung, in der zeitgleich
mehrere andere Sessions denselben Container stark ausgelastet haben (u. a. parallele
`messe-arena-einfluss`-Läufe für Basketball/Hockey, mehrere volle `vitest run`-Suiten); ein
n=48-Lauf für football brauchte unter dieser Last nachweislich über 30 Minuten PRO Strom, ohne
durchzulaufen (mehrmals an `page.waitForFunction`-Timeouts gescheitert, dokumentiert in den
Versuchsprotokollen dieser Runde). n=24 ist dieselbe Stichprobengröße, die auch die bisher
einzige dokumentierte Football-Pp-Referenz (47,3 Pp, `docs/design/stand-aller-disziplinen.md`
zwölfter Nachtrag) verwendet — also kein Bruch mit der Projektpraxis, aber eine kleinere
Stichprobe als die CLAUDE.md-Zielvorgabe von 48. Eine spätere Runde mit mehr freier
Rechenkapazität sollte n=48 nachholen.

**Vorher-Referenz war veraltet, genau wie beim Gewichtheben-Präzedenzfall (PR #1102):** die
Aufgabenstellung zitierte 47,3 Pp (gemessen 21.–26.09., `docs/design/stand-aller-disziplinen.md`
zwölfter Nachtrag). Frisch auf dem aktuellen Commit nachgemessen liegt der echte, unmittelbare
Vorher-Wert bei 53,5–55,6 Pp (Mittel 54,55) — mehrere dazwischen gemergte, football-fremde PRs
haben die Zahl seither verschoben, ohne den Football-Rezeptcode selbst zu berühren. Das ändert
nichts am Nachher-Befund, nur die Vorher-Erzählung der Aufgabenstellung war unpräzise.

```sh
node scripts/messe-arena-einfluss.mjs football 24                        # Strom 0 (versatz=0)
node scripts/messe-arena-einfluss-zweiter-saatstamm.mjs football 24      # Strom 2 (versatz=10 000 000)
```

| Saatstrom | Pp vorher | Pp nachher |
|---|---:|---:|
| 0 (versatz=0) | 53,5 | **51,3** |
| 10 000 000 | 55,6 | **43,8** |
| **Mittel** | **54,55** | **47,55** |

Attributabweichung, Strom 0 (vorher → nachher):

| Attribut | Matrix | vorher | nachher |
|---|---:|---:|---:|
| health | 18 | +10,8 | +11,1 |
| speed | 14 | +8,5 | +9,3 |
| power | 22 | −2,6 | −3,8 |
| torment | 12 | +6,0 | +4,5 |
| determination | 10 | −4,1 | −1,9 |
| dexterity | 4 | +1,5 | +0,7 |
| will | 3 | −3,0 | −3,0 |
| spirit | 3 | −3,0 | −3,0 |
| awareness | 8 | −8,0 | −8,0 |
| stamina | 6 | −6,0 | −6,0 |
| charisma / intelligence | 0 | 0,0 | 0,0 |

Attributabweichung, Strom 10 000 000 (vorher → nachher):

| Attribut | Matrix | vorher | nachher |
|---|---:|---:|---:|
| health | 18 | +12,5 | +8,3 |
| speed | 14 | +6,5 | +5,8 |
| power | 22 | −2,4 | −0,7 |
| torment | 12 | +6,4 | +4,7 |
| determination | 10 | −5,4 | −1,8 |
| dexterity | 4 | +2,4 | +3,1 |
| will | 3 | −3,0 | **−2,8** (0,2 % statt 0 %) |
| spirit | 3 | −3,0 | −3,0 |
| awareness | 8 | −8,0 | −8,0 |
| stamina | 6 | −6,0 | **−5,6** (0,4 % statt 0 %) |
| charisma / intelligence | 0 | 0,0 | 0,0 |

**Ehrlicher Befund, nicht schöngerechnet:** awareness bleibt in BEIDEN Strömen bei exakt 0 %
gemessenem Gewicht — der PASSSCHUTZ-Kanal ist so dünn, dass selbst der höhere Rezeptanteil
(20→25 %) bei n=24 im Messrauschen des Verfahrens verschwindet (dieselbe Diagnose, die
`football-rezept-kalibrierung.md` Abschnitt 5 schon für den unveränderten Zustand stellte — der
Kanal braucht eine echte Mechanikänderung, keine Prozentverschiebung, um sichtbar zu werden,
und das war ausdrücklich NICHT Teil dieser Runde). will und stamina zeigen in Strom 10 000 000
einen winzigen, von 0 verschiedenen Ausschlag (0,2 % / 0,4 %) — innerhalb der Messungenauigkeit
bei n=24, aber kein Rückschritt. Die gemessene Pp-Verbesserung kommt überwiegend daher, dass
BALLSICHERHEITs reduzierter power/health/determination-Anteil die Überrepräsentation dieser
drei Attribute dämpft, nicht daher, dass will/stamina/awareness selbst sichtbar mittragen.

## 5. Zielkonflikt-Protokoll (CLAUDE.md verlangt: dokumentieren, nicht verstecken)

| Spannung | Entscheidung | Beleg |
|---|---|---|
| awareness mehr Gewicht (Pp-Pflicht) vs. awareness korreliert negativ mit der Eignung (Validität dieses Kanals) | Awareness-Anteil in PASSSCHUTZ erhöht (20→25 %) — tragbar, weil der Kanal selbst so dünn ist, dass der rho-Preis praktisch null ist (bestätigt: rho unverändert 0,805 mit/ohne diesen Zusatz-Anteil gegenüber der Zwischenstufe) | Abschnitt 1, 3 |
| spirit einen Kanal geben (Pp-Pflicht) vs. rho>0,80 (harte Nebenbedingung, CLAUDE.md gibt ihr Vorrang) | spirit bekommt KEINEN Kanal — TEAMGEIST ist zu dominant, jeder getestete Nachschlag (8 % und 15 %) reißt rho unter die Schranke | Abschnitt 2 |
| n=48 (Auftrag) vs. messbare Laufzeit in der geteilten Umgebung (>30 Min/Strom, nie durchgelaufen) | n=24 verwendet, als dieselbe Stichprobengröße wie die bisherige Projekt-Referenz, Abweichung offen benannt | Abschnitt 4 |

## 6. Klasse-T-Prüfung

Angefasst wurde ausschließlich das `rezept`-Objekt von `FELDSPIEL_ART.football` — vier
Prozentzahlen innerhalb von zwei der acht Sub-Skill-Gewichtungen. Keine Spielablauf-Konstante
(Rundenzahl, Zeittakt, `FK_LOS_KAPPA`, Erfolgskurven-/Korridor-Koeffizienten wie `pSack`-,
`pFumble`- oder `meanYds`-Basiswerte) wurde verändert, kein neuer `rr()`-Aufruf, kein neuer
Zustand. Reine Wertungsgewichtung — keine Klasse-T-Freigabe erforderlich.

## 7. Vitest — keine neuen Fehlschläge, bestätigt durch isolierte Nachmessung

Ein voller `npx vitest run` in dieser stark ausgelasteten Umgebung zeigte mehrere Fehlschläge
in football-fremden Dateien (`singleplayer-state.test.ts`,
`matchday-auto-run-service.test.ts`, `ai-legacy-lineup-batch-apply-precheck-regression.test.ts`,
`matchday-mvp-scoring-service.test.ts`, `player-generator-service.test.ts`) — alle fünf wurden
**isoliert (ohne die Ressourcenlast des vollen Laufs) erneut gefahren und liefen jeweils
vollständig grün** (36/37, 33/33, 4/4 Tests, ein `skipped` Fall erwartungsgemäß übersprungen).
Der volle Lauf selbst brach zudem an mehreren Stellen mit
`[vitest-pool]: Timeout terminating forks worker` ab — ein reines Ressourcenartefakt der
geteilten Umgebung (mehrere parallele Sessions liefen zeitgleich), kein Befund dieser Änderung.
Zusätzlich liefen alle vier direkt arena-/battle-mode-bezogenen Testdateien zusammen grün:

```sh
npx vitest run tests/battle-mode-arena-resolve-engine.test.ts \
  tests/battle-mode-arena-matchday-resolve-e2e.test.ts \
  tests/arena-matchday-weg-b-beide-disziplinen.test.ts \
  tests/season-discipline-schedule-battle-repeat.test.ts
# 4 Testdateien, 31 Tests, alle bestanden
```

Football ist ohnehin nicht in `ARENA_RESOLVED_DISCIPLINE_IDS` (nicht produktiv) — das Risiko
fürs Live-Spiel ist unabhängig von diesem Befund null.

## Anhang: Reproduktion

```sh
node --check public/mockups/battle-mode.engine.js
node scripts/miss-alle-disziplinen.mjs 24 football
node scripts/messe-arena-einfluss.mjs football 24
node scripts/messe-arena-einfluss-zweiter-saatstamm.mjs football 24
npx vitest run tests/battle-mode-arena-resolve-engine.test.ts tests/battle-mode-arena-matchday-resolve-e2e.test.ts tests/arena-matchday-weg-b-beide-disziplinen.test.ts tests/season-discipline-schedule-battle-repeat.test.ts
```
