# PP-Tagesanker scharf (22.11.)

Chris am 22.11. zu `docs/design/pp-analyse-21-11.md` („ja“): der Tagesanker aus dem Prototyp vom 21.11. wird scharf,
**ab der nächsten Saison**. Die Analyse (Klumpen bei 5,0, Hockey/Spurt unter 5, Verfahren, Parameter) steht dort; dieses
Dokument beschreibt nur die Schaltung, die Abnehmer und die Messung.

## 1. Was scharf ist

Je Disziplin und Spieltag werden die Spieler-PP über **alle Spieler beider Ligen** neu verteilt:

1. C2-Wert **ohne** Deckel 5 (`ppAusKurveSkaliert({ deckel: false })`),
2. Tagesanker `A` = Mittel der besten drei Werte, `x = u * 5,5 / A`,
3. weiche Kappe ab 4 mit Asymptote 5: `PP = x` für `x <= 4`, sonst `4 + (1 - exp(-(x - 4)))`.

Die Reihenfolge der Spieler (= ihr Impact) bleibt exakt erhalten, es entsteht kein Wert ab 5, der Tagesbeste landet
bei 4,8 bis 5,0 (`lib/resolve/pp-tagesanker.ts`). Rechenstellen: `computeIndividualBoxscorePpsFromFixtureResults`
(alle Arena-Duell-Disziplinen), `runBahnPodMatchday`, `runBattlefieldPodMatchday`, `runMiniDmFfaMatchday`.

## 2. Schaltung: Spielstand-Stempel, nicht Prozessvariable

`seasonState.wertungsSkalen.ppTagesanker: boolean` (neben `pp`, `ergebnis`, `ppAb`; `lib/resolve/wertungs-skalen.ts`).
Jeder Rechenweg fragt **`ppTagesankerFuer(gameState, matchdayId)`** (`lib/resolve/pp-tagesanker.ts`), nie die Variable.
Wahr nur, wenn (1) die PP-Skala C2 für diesen Spieltag gilt (`ppSkalaModus === "an"`), (2) der gültige Saison-Stempel
`ppTagesanker: true` trägt, (3) die Notbremse nicht steht.

| Fall | Ergebnis |
|---|---|
| Neues Spiel (`stempleWertungsSkalenBeimAnlegen`) | an ab Saison 1 |
| Saisonwechsel (`preseason-workflow-service.ts` über `wertungsSkalenFuerSpielmodus`) | neue Saison an |
| Bestehender Spielstand, laufende Saison (Stempel ohne Feld, kein Stempel, Umstellung mitten in der Saison durch `stelleLaufendeSaisonAufC2Um`) | **aus**, bis zum nächsten Saisonwechsel; gebuchte Spieltage bleiben wie gebucht |
| Manager-Modus | nie (kein Stempel) |
| `OLY_PP_TAGESANKER=aus` | Rückweg: **neue** Saisons ohne; gestempelte Saisons rechnen wie gestempelt weiter |
| `OLY_PP_TAGESANKER=aus-sofort` | Notbremse: ignoriert jeden Stempel (auch `NEXT_PUBLIC_…`, dann Neubau) |
| `OLY_PP_SKALA=aus-sofort` / `roh` | schaltet den Tagesanker mit ab (C2 ist Voraussetzung) |

Durchreichung: `deploy/hetzner/docker-compose.yml` (Container und Build-Arg `NEXT_PUBLIC_OLY_PP_TAGESANKER`),
`Dockerfile`, `deploy/hetzner/.env.example`. Nach einer Änderung neu **bauen**, nicht nur neu starten.
Ladekette: ein Laden braucht keinen eigenen Stempler — ein Save ohne Feld gilt als „aus“, der nächste Saisonwechsel
setzt das Feld. Die kompakte Anfangsladung (`compactFoundationInitialGameState`) und das Zurückschreiben
(`rehydrateGameStateAfterCompactPut`) behalten den Stempel (Test in `tests/pp-tagesanker.test.ts`).

**Gezeigt = gebucht:** die PP werden beim Buchen einmal gerechnet und persistiert; Bühne, Ledger, Bestenliste, MVP,
Saisonstand lesen denselben Wert. Der Arena-Eingabe-Hash (`lib/battle/arena-eingabe-hash.ts`) trägt bei gestempeltem
Tagesanker den Schlüssel `ppTagesanker: "t1"`, ein schon gelaufener Vorlauf einer Saison ohne Stempel behält seinen
Hash Zeichen für Zeichen; die Zeilen tragen weiter `ppSkala: "c2"` (der Tagesanker ist Eigenschaft der Saison).
Der Ledger-Fallback `pps_duell` (nur ohne Motor-Quelle) rechnet weiter mit dem festen Anker: dort gibt es keinen
ganzen Spieltag, den man verteilen könnte; auf Battle-Saves mit Motor kommt er nicht vor.

## 3. Abnehmer der PP

Alle lesen den **gebuchten** Wert (Boxscore-PP in `pointsAwarded`/`scoreContribution`, Ledger `basePoints`), keiner
rechnet selbst nach — außer dem Ledger-Fallback oben. Geprüft:

| Abnehmer | Wo | Wirkung |
|---|---|---|
| Top-Spieler des Spieltags / Bestenliste | `summiereSpieltagsTopSpieler`, Liga-Leaders | zeigt gebuchte PP, Tagesbester um 4,8–5,0 statt Klumpen |
| MVP, Saisonstand „Top-Spieler" | `SeasonStandingsNewLook` | Summe gebuchter PP |
| Marktwert / MVS / PP-Saisonrang | `player-rating-contract.ts`, `league-market-value-snapshot.ts` | Rangbasiert; bleibt über den Spieltag monoton, ändert sich nur durch die Verschiebung zwischen Spieltagen |
| Training, organische Entwicklung | `organic-season-progression.ts` (`scoreContribution / (30 * einsatz)`), `player-progression-forecast.ts` | absolute PP-Schwelle, über `ppSkalaUmrechnung` auf C2 kalibriert; Verschiebung der Summen siehe Abschnitt 4 |
| Vorstands-Sportziel | `team-season-objectives-service.ts` (`ppTeamFaktor`) | wie Training |
| Form/Moral | keine PP-Absolutschwelle gefunden (Suche nach `ppAusKurveSkaliert`/`ppSkalaUmrechnung` trifft nur die Zeilen oben) | unverändert |
| Spielerprofil (PP-Rang, Verlauf), Arena-Panel | `spielerprofil-modell.ts`, `arena-panel` | lesen den gebuchten Wert |
| E1-Ergebnisskala (0–10) | `ergebnis-skala-anwenden.ts` | **liest die C2-PP VOR dem Tagesanker** (Abschnitt 3a), nicht die gebuchten; `ergebnisNormiert`, Pod-Wert, `verhaeltnis` und `teamPoints` ändern sich durch den Tagesanker nie |

### 3a. E1 liest die PP vor dem Anker (Review PR #1690, Variante a)

Die E1-Anker (`data/generated/ergebnis-skala-kalibrierung.json`, `lP5/lP50/lP95`, bei Zeitfahren und Breaking-Gauntlet
auch der Abstand D über `margeQuelle: "leistung"`) sind auf C2-PP **ohne** Tagesanker gezogen. Las E1 die gebuchten
Tagesanker-PP, verschob der Tagesfaktor das Niveau: der Reviewer maß `ergebnisNormiert` in 47 % der Zeilen um bis zu ±3
verändert, je Disziplin in andere Richtung (Eiskunstlauf 2,63 statt 4,44, Basketball 6,38 statt 4,75), bei gleichem
Sieger, gleichen Punkten und gleichem `verhaeltnis`. Jetzt:

- Neben der Tagesanker-Map gibt es eine zweite mit der **C2-PP vor dem Anker, gedeckelt bei 5 und auf zwei Stellen
  gerundet wie in der Kalibrierung** (`ppVorTagesanker()`, `lib/resolve/pp-tagesanker.ts`). Erzeuger:
  `computeIndividualBoxscorePpsFromFixtureResults` (Halter-Parameter, Arena-Boxscore), `runBahnPodMatchday`,
  `runBattlefieldPodMatchday`, `runMiniDmFfaMatchday` (Feld `playerPpsVorAnkerByPlayerId`, Arena:
  `individualBoxscorePpsVorAnkerByPlayerId`). Nur mit Tagesanker gefüllt; ohne ist alles bit-identisch zu vorher.
- Der Vorlauf (`arena-vorlauf-service.ts`) reicht sie als `arenaIndividualBoxscorePpsVorAnkerByDisciplineId` an die
  Auflösung; `wendeErgebnisSkalaE1An` nimmt sie über `ppVorAnkerByPlayerId` für Niveau, Zeitfahren-/Breaking-Abstand
  und Pod-Werte. Hat ein Spieler dort keinen Eintrag, gilt wie bisher `pointsAwarded`.
- **Gebucht und gezeigt bleiben die Tagesanker-PP** (`pointsAwarded`, Ledger, Bestenliste). Nur E1 sieht die andere
  Zahl; Gleichheit der beiden gibt es bewusst nicht, aber E1 ist reine Anzeige-/Tiebreaker-Größe.
- **Mischbetrieb:** fällt eine Liga-Stufe oder ein Pod aus und die Zeile läuft über die `pps_duell`-Brücke
  (Ledger-Fallback, fester Anker), gibt es für sie keine Vor-Anker-Werte und keine Tagesanker-PP; E1 rechnet für diese
  Zeilen auf `pointsAwarded`, also auf den festen C2-Anker, was der Kalibrierung entspricht. Innerhalb einer Disziplin
  können so Zeilen mit und ohne Tagesanker stehen; E1 ist dort trotzdem überall auf demselben Maßstab (C2 ohne Anker).

## 4. Messung

Sonde `scripts/miss-pp-skala.ts 12` (frischer Battle-Save, 32 KI-Teams, 12 Spieltage, **echtes C2**, zweimal:
`OLY_PP_TAGESANKER=aus` gegen `an`). Die beiden Läufe sind zwei verschiedene Spiele (andere Ziehungen, andere
Disziplinen je Spieltag): Verteilungen sind vergleichbar, Summen nur mit Vorsicht.

| | vorher (C2, Deckel) | nachher (Tagesanker) |
|---|---|---|
| PP-Zeilen / Zellen (Disziplin × Spieltag) | 3.016 / 24 | 3.075 / 24 |
| Zeilen glatt 5,0 | **125** (4,1 %) | **0** |
| Zellen mit ≥ 3 Spielern glatt 5,0 | **16 von 24** | **0** |
| Zellen mit Gleichstand an der Spitze | 18 | 5 (nur Platzpunkt-Disziplinen) |
| Tagesbester, Median (min–max) | 5,00 (3,29–5,00) | **4,84 (4,78–4,98)** |
| Zellen mit Tagesbestem in [4,5; 5] | 23 | 24 |
| Median je Einsatz / Mittel je Einsatz | 1,24 / 1,63 | 1,05 / 1,51 |
| Spieler-Saisonsumme Top / Platz 10 / Median | 42,6 / 30,8 / 11,6 | 32,9 / 28,3 / 11,4 |

Je Disziplin liegt der Tagesbeste nachher zwischen 4,78 (Climbing, Staffel, Time-Trial: 16 Laufsieger gleichauf, das
löst erst ein stetiger Bahn-Wert im Motor, Analyse Abschnitt 6) und 4,94; vorher stand er in 16 von 20 Disziplinen
glatt bei 5,00, bei I-Spy in diesem Lauf bei 3,29.

**Lesart der Summen.** Die Sonde vom 21.11. (gleicher Spielzustand, ungedeckelt nachgerechnet, 5.019 Zeilen) ergab
Summe ×1,05, Median-Einsatz 1,12 → 1,16. Der Live-Vergleich oben liegt wegen der verschiedenen Ziehungen darunter
(Gesamtsumme −6 %): im Vorher-Lauf stehen 125 Fünfer, vor allem 16er-Gruppen in Climbing/Time-Trial, die nachher auf
4,78 fallen. Beides liegt in der Größenordnung der C2-Umrechnungsfaktoren (1,02–1,03) und bleibt unter 10 %. Wirkung:
**Training und organische Entwicklung** (absolute PP-Schwelle) sehen das Mittel je Einsatz etwas niedriger oder höher
je nach Spieltag-Mix, nicht systematisch; **Marktwert** ist rangbasiert und ändert sich nur durch die Umverteilung
zwischen Spieltagen. **Abnehmer mit absoluten PP-Schwellen** (`ppSkalaUmrechnung`: organische Entwicklung, Trainings-XP, Vorstands-Sportziel):
die Summe liegt bei −6 %, je Disziplin aber zwischen 0,64 und 1,43 des alten Werts (Faktor Tagesanker/C2). Weil die
Umrechnung nur einen Faktor je Skala kennt, trifft sie einzelne Disziplinen zu hoch oder zu niedrig; das gleicht sich
über den Disziplin-Mix einer Saison größtenteils aus. Die Faktoren sind **nicht** nachgezogen; nach der ersten vollen Saison mit
Tagesanker gegen echte Saisonsummen prüfen (`werte-pp-skala-aus.mjs --schreibe-kalibrierung`).

**Messung nach dem E1-Fix** (`scripts/miss-pp-skala.ts 8`, zweimal, `OLY_PP_TAGESANKER=aus` gegen `an`, `Math.random` und
`Date.now` festgehalten, zwei Läufe mit gleichem Spiel): von 508 vergleichbaren Team-Zeilen (16 Disziplinen × 32) ist
**in 0 Zeilen** `ergebnisNormiert`/Pod-Wert, `verhaeltnis` oder `teamPoints` verändert (vorher 47 %, ±3); die Tabellen
beider Ligen sind platzgleich, die Siegerergebnis-Verteilung der Duelle identisch. Vier Zeilen eines Takeshi-Pods
(Spieltag 8) sind ausgenommen: dort liefert der Motor selbst zwei verschiedene Läufe (`teamWert` 39,5 gegen 37,9, also
vor jeder PP-Rechnung), unabhängig vom Tagesanker. Spieler-PP-Summe 0,988, Tagesbester 4,78 bis 4,98.

**Hockey: gemeinsamer Anker für Torhüter und Feldspieler.** Der Tagesanker nimmt die besten drei `u` über alle Spieler
einer Disziplin, Torhüter eingeschlossen (eigene Torwart-Referenz, aber ein Anker). Stichprobe ein Hockey-Spieltag im
Messlauf (32 Torhüter, 64 Feldspieler): Top 10 = 8 Feldspieler, 2 Torhüter (T 4,74 auf Rang 3, T 4,60 auf Rang 5); bei
einem Drittel Torhütern wäre Gleichverteilung 3 von 10. Die besten drei: 4,80 F, 4,79 F, 4,74 T. Median Torwart 1,33,
Feld 1,31. Die Torhüter dominieren die Spitze **nicht**; eine Stichprobe von einem Tag, bei Auffälligkeit nach der
ersten Saison mit mehreren Spieltagen wiederholen.

## 5. Wertung

`env -u NODE_OPTIONS node scripts/pruefe-wertung-fingerabdruck.mjs --node`: **GESAMT fe1dc086d68d (75 Einträge)**,
unverändert; alle sechs Schutzsummen unverändert. PP liegt nach dem Motor (Boxscore → PP) und steht nicht im
Fingerabdruck. Der `arena-eingabe-hash` ändert sich **absichtlich nur** für Saisons mit gestempeltem Tagesanker
(neuer Schlüssel `ppTagesanker`), damit ein vor dem Stempel gerechneter Vorlauf neu läuft.

## 6. Tests

`tests/pp-tagesanker-e1.test.ts` (E1 mit und ohne Tagesanker identisch je Duell, Zeitfahren, Breaking-Gauntlet, Bahn-/Battlefield-/Mini-DM-Pod; Vor-Anker-Map der Arena-Rechenstelle), `tests/pp-tagesanker.test.ts` (Stempel: neues Spiel an, laufender Save aus, Saisonwechsel, Rückweg, Notbremse,
C2-Voraussetzung, kompakte Ladung; Verteilung; Rechenstelle Arena), `tests/wertungs-skalen.test.ts` (Stempel-Felder).
