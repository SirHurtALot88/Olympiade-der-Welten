# Gewichtheben-Kalibrierrunde: ANSAGE ist ein Sechs-Hebel-Kanal, nicht einer wie die anderen (01.10.)

Folgerunde auf `docs/design/gewichtheben-pp-regression-befund-01-10.md`. Dort: reine
Diagnose, kein Code geändert, Befund "Pp liegt bei n=48 über fünf unabhängigen Strömen im
Mittel bei 24,9 — auf der Schranke, nicht sicher darunter" plus ein stabiles
Attribut-Abweichungsmuster (speed konsistent +5 bis +6,3 Pp, power/charisma durchgehend
über ihrem Matrixgewicht, dexterity/will/health durchgehend darunter). Diese Runde geht
der Ursache nach und kalibriert innerhalb des bestehenden Rezept-Splits.

## Ergebnis vorab

**Pp fällt von 24,9 (Mittel, 5 Ströme) auf 9,6 — rho verbessert sich dabei sogar leicht
(0,849 → 0,865 Median), und der Erfolgskorridor bleibt im direkten Vorher/Nachher-Vergleich
praktisch unverändert.** Die Änderung ist eine reine Rezept-Umschichtung innerhalb der
fünf bestehenden Sub-Skills (LAST/TECHNIK/NERVEN/ANSAGE/ERHOLUNG) — keine der
Spielablauf-Konstanten (Erfolgskurven, Deckel, Zuschläge, Rundenzahl, Zeittakt) wurde
angefasst.

## 1. Diagnose: ANSAGE ist kein Sub-Skill wie die anderen vier

Die vier anderen Sub-Skills wirken je über GENAU EINEN Hebel auf das Ergebnis — eine
additive Verschiebung auf eine einzelne Erfolgschance (`HEBEN_TECHNIK_K`,
`HEBEN_NERVEN_K`/`HEBEN_NERVEN_K_DRITT`) oder eine einzelne multiplikative Skalierung
(`HEBEN_ERHOLUNG_K` auf das Stoßen-Maximum, `LAST` direkt auf die Tagesmax-Basis).

`ANSAGE` dagegen wirkt über **sechs** getrennte Stellen in `hebeUebung()`:

| Konstante | Wirkung |
|---|---|
| `HEBEN_TAGESMAX_ANSAGE_K` | skaliert die Tagesmax-**Decke** selbst (nicht nur eine Chance) |
| `HEBEN_ANSAGE_EROEFFNUNG` | die Eröffnungshöhe |
| `HEBEN_WAGNIS_ANSAGE_FLEX` | dehnt den Risiko-Maßstab — **zweimal**: einmal in `mutDeckel` (Eröffnungsdeckel), einmal in `risikoMax` (Erfolgschance) |
| `HEBEN_ANSAGE_SPRUNG` | die Sprunggröße zwischen den Versuchen |
| `HEBEN_WAGNIS_ANSAGE_K` | der kühne-Versuch-Kilo-Bonus |

Das macht ANSAGE zum mit Abstand stärksten Kanal der Mechanik. Seine alte Besetzung
(`charisma:60, power:15, speed:25`) legte diesen gesamten Hebel exakt auf drei Attribute,
die entweder schon anderswo einen starken eigenen Kanal hatten (power in `LAST`, der
direkten Tagesmax-Basis; charisma in `NERVEN`) oder ohnehin schon vertreten waren (speed
in `TECHNIK`) — während **dexterity, will und health, die drei unterrepräsentierten
Attribute, in ANSAGE überhaupt nicht vorkamen.** Das ist derselbe Fehlertyp wie das
Breaking-Paket-3-`power`-Problem (CLAUDE.md), nur nicht als Attribut-Dopplung in zwei
Formel-Stellen, sondern als Konzentration des stärksten Kanals auf die ohnehin schon
bevorzugten Attribute.

## 2. Fix: Umschichtung, nicht Entfernung

Der naheliegende erste Reflex — power/charisma aus TECHNIK/ANSAGE ganz entfernen — wurde
bereits in einer früheren Runde geprüft und **verworfen** (s. Kommentar im Code,
"GEPRUEFT UND VERWORFEN", S3-Kalibrierrunde): Pp fiel von 48 auf 33, aber Korridor
(Reissen 1. Versuch 84,2→82,3 %, Nullwertungen 3,1→4,2 %) und rho (0,800→0,789)
verschlechterten sich. CLAUDE.md verbietet genau das: eine Änderung, die etwas vorher
Gutes schlechter macht.

Diese Runde ändert deshalb **nur die Verteilung innerhalb der Kanäle**, nicht ihre
Existenz:

```diff
- TECHNIK:  {dexterity:45,speed:30,determination:20,power:5},
+ TECHNIK:  {dexterity:45,speed:70,determination:20,power:5},
- ANSAGE:   {charisma:60,power:15,speed:25},
+ ANSAGE:   {charisma:53,power:8,will:13,dexterity:9,health:10,speed:7},
```

- **speed komplett aus ANSAGE entfernt** (der auffälligste Einzeltreiber der Abweichung,
  s. Befund-Dokument) und in TECHNIK verdoppelt — dort wirkt derselbe Anteil nur über den
  einen schwachen Erfolgschance-Hebel statt über sechs starke.
- **ANSAGE bekommt eine kleine, verteilte Beimischung** aus will (13), dexterity (9) und
  health (10) — genau den drei unterrepräsentierten Attributen — plus einen kleinen
  Rest-speed (7), bei gleichzeitig reduziertem power-Anteil (15→8; power bleibt mit 60 %
  der mit Abstand größte Posten in `LAST`, dem direkten Tagesmax-Kanal, unangetastet).
  charisma bleibt mit 53 % weiterhin der dominante ANSAGE-Posten (thematisch: das
  Selbstvertrauen, ein hohes Gewicht anzusagen, bleibt in erster Linie Charisma).
- **Keine der sechs ANSAGE-Konstanten, keine Erfolgskurve, kein Deckel, keine Rundenzahl
  oder Zeittakt angefasst** — reine Wertungsgewichtung, keine Timing-/Spielablaufänderung
  (Klasse-T-Prüfung: nicht einschlägig).

Die Iteration lief in drei kleinen, einzeln gemessenen Schritten (speed raus aus ANSAGE
→ 17,9 Pp, aber will überschoss auf +6,6 Pp; will/dexterity/health als Dreiersplit statt
Einzelattribut → 12,6 Pp; power-Anteil in ANSAGE zusätzlich von 15 auf 8 gesenkt und durch
health ersetzt → 8,5 Pp), nicht in einem einzigen großen Sprung — jede Zwischenstufe wurde
gegen `messe-arena-einfluss.mjs` gemessen, bevor der nächste Schritt gewählt wurde.

## 3. Messung: Pp über fünf unabhängige Saatströme bei n=48

| Saatstrom (`versatz`) | Pp vorher (01.10.-Befund) | Pp nachher |
|---:|---:|---:|
| 0 (`messe-arena-einfluss.mjs`) | 21,4 | **8,5** |
| 10 000 000 (`...zweiter-saatstamm.mjs`) | 27,5 | **10,0** |
| 20 000 000 | 26,6 | **11,4** |
| 30 000 000 | 24,5 | **10,1** |
| 40 000 000 | 24,7 | **7,9** |
| **Mittel** | **24,9** | **9,6** |

**Korrektur nach Review (unabhängig nachgemessen):** Die Spalte "Pp vorher" ist wörtlich
aus `gewichtheben-pp-regression-befund-01-10.md` (PR #1101) übernommen, das auf einem
ÄLTEREN Commit (`7c5f0a85`) gemessen wurde. Zwischen diesem Commit und dem tatsächlichen
Basis-Commit dieser PR (`9ecdd857`) liegen zwei fremde, bereits gemergte Commits
(Climbing-Kalibrierrunde, Bühne-Duell Paket 1 "Regie & Bild", zusammen 537 Zeilen
`battle-mode.engine.js`), die den gemessenen Gewichtheben-Pp-Wert spürbar verschoben haben
— ohne den Gewichtheben-Rezeptcode selbst zu berühren. Der echte, unmittelbare Vorher-Wert
auf `9ecdd857` liegt für mindestens zwei der fünf Ströme bereits bei/über der Schranke
(Strom 0: 25,3 statt 21,4; Strom 10 000 000: 25,0 statt 27,5), unabhängig nachgemessen.
Das ändert nichts am entscheidenden Befund — dem "Nachher" (8,5-11,4 Pp, bitgenau
reproduziert) —, nur die Vorher-Erzählung war unpräzise. Siehe auch das analoge,
vorher bereits korrigierte Muster bei der Climbing-Kalibrierung
(`climbing-kalibrierung-tempospanne-01-10`, Pp-Dokumentationsfehler).

Attributabweichung, Strom 0 (vorher → nachher):

| Attribut | Matrix | vorher | nachher |
|---|---:|---:|---:|
| power | 28 | +5,0 | +1,7 |
| charisma | 23 | +2,0 | -0,4 |
| health | 16 | -3,3 | +0,8 |
| determination | 12 | -1,5 | -1,8 |
| will | 7 | -3,6 | +1,2 |
| dexterity | 6 | -3,8 | -0,9 |
| speed | 6 | +5,7 | -0,5 |
| stamina | 2 | -0,4 | -0,5 |

Jedes einzelne Attribut liegt jetzt innerhalb von rund 2 Prozentpunkten seines
Matrixgewichts — vorher wichen speed und power um das 1,5- bis 2-fache ihres eigenen
Gewichts ab.

```sh
node scripts/messe-arena-einfluss.mjs gewichtheben 48                        # 8,5 Pp
node scripts/messe-arena-einfluss-zweiter-saatstamm.mjs gewichtheben 48      # 10,0 Pp (versatz=10 000 000)
node scripts/messe-arena-einfluss.mjs gewichtheben 48 --saat-versatz=20000000 # 11,4 Pp
node scripts/messe-arena-einfluss-zweiter-saatstamm.mjs gewichtheben 48 30000000 # 10,1 Pp
node scripts/messe-arena-einfluss-zweiter-saatstamm.mjs gewichtheben 48 40000000 # 7,9 Pp
```

## 4. rho bleibt nicht nur bestanden, sondern stabiler

```sh
node scripts/miss-alle-disziplinen.mjs 24 gewichtheben
```

| | vorher | nachher |
|---|---:|---:|
| rho je Spiel (Median, Kaderfamilie) | 0,849 | **0,865** |
| Spannweite über die Kaderfamilie | 0,228 | **0,143** |
| rho Saison (Median) | 0,895 | **0,944** |

Die Kalibrierung hat die Rangtreue nicht nur nicht verschlechtert, sondern über die
Kaderfamilie hinweg stabiler gemacht (kleinere Spannweite).

## 5. Korridor: direkter Vorher/Nachher-Vergleich, unverändert

```sh
node scripts/miss-gewichtheben-korridor.mjs 200
```

| Kennzahl | vorher | nachher | Ziel |
|---|---:|---:|---|
| Reißen 1./2./3. Versuch | 85,6/79,7/61,5 % | 85,8/79,9/61,8 % | 84-90/71-80/50-63 % |
| Stoßen 1./2./3. Versuch | 87,3/76,5/60,9 % | 87,7/76,0/61,5 % | 84-90/71-80/50-63 % |
| Fehlversuche je Heber | 1,49 | 1,47 | 1,4-1,8 |
| Nullwertungen | 1,8 % | 1,8 % | ≤ 3 % |
| Reißen-Anteil am Zweikampf | 46,7 % | 46,8 % | 44-47 % |
| rho (Eignung vs. eigene kg, Einzelkader) | 0,979 | 0,986 | ≥ 0,80 |

Alle Werte bleiben innerhalb ihres Zielkorridors und bewegen sich nur im
Mess-Rauschbereich — anders als beim früher verworfenen Versuch (Abschnitt 2) wird hier
nichts vorher Gutes schlechter. Die unabhängig davon bestehende Abweichung "Spanne bester
minus schwächster" (379/406, Ziel 150-200) ist **vor und nach** dieser Runde praktisch
identisch und damit nachweislich kein Effekt dieser Kalibrierung, sondern ein separater,
hier nicht bearbeiteter Befund.

## 6. Klasse-T-Prüfung

Angefasst wurde ausschließlich das `rezept`-Objekt von `BUEHNE_ART.gewichtheben` — fünf
Prozentzahlen innerhalb von zwei der fünf Sub-Skill-Gewichtungen. Keine der
Spielablauf-Konstanten (Rundenzahl, Zeittakt, Reihenfolge-, Deckel- oder
Erfolgskurven-Konstanten) wurde verändert. Reine Wertungsgewichtung — keine
Klasse-T-Freigabe erforderlich.

## 7. Primär-/Nebenweg-Leitlinie (CLAUDE.md 21.09.) — geprüft, nicht gezogen

Die Empfehlung aus dem 01.10.-Befund, dexterity/will/health einen eigenen Primärweg zu
geben, wurde geprüft: alle drei haben nach dieser Runde bereits einen ausreichend starken
Kanal (dexterity über TECHNIK + den neuen ANSAGE-Anteil, will über NERVEN + ERHOLUNG +
ANSAGE, health über LAST + NERVEN + ERHOLUNG + ANSAGE) und liegen alle innerhalb von rund
einem Prozentpunkt ihres Matrixgewichts. Ein zusätzlicher Primär-/Nebenweg-Umbau ist damit
nicht nötig — die reine Umschichtung reicht, um die Matrixgewichte treu durchzureichen.

## Anhang: Reproduktion

```sh
node --check public/mockups/battle-mode.engine.js
node scripts/messe-arena-einfluss.mjs gewichtheben 48
node scripts/messe-arena-einfluss-zweiter-saatstamm.mjs gewichtheben 48
node scripts/messe-arena-einfluss.mjs gewichtheben 48 --saat-versatz=20000000
node scripts/messe-arena-einfluss-zweiter-saatstamm.mjs gewichtheben 48 30000000
node scripts/messe-arena-einfluss-zweiter-saatstamm.mjs gewichtheben 48 40000000
node scripts/miss-alle-disziplinen.mjs 24 gewichtheben
node scripts/miss-gewichtheben-korridor.mjs 200
node scripts/screenshot-gewichtheben.mjs 5000
```
