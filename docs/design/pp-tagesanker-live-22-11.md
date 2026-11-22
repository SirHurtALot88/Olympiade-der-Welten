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
| E1-Ergebnisskala (0–10) | `ergebnis-skala-anwenden.ts` | nimmt das Mittel der Spieler-PP je Seite; der Tagesfaktor wirkt auf beide Seiten gleich, wer gewinnt ändert sich nie |

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
zwischen Spieltagen. Die Faktoren `ppSkalaUmrechnung` sind **nicht** nachgezogen; nach der ersten vollen Saison mit
Tagesanker gegen echte Saisonsummen prüfen (`werte-pp-skala-aus.mjs --schreibe-kalibrierung`).

## 5. Wertung

`env -u NODE_OPTIONS node scripts/pruefe-wertung-fingerabdruck.mjs --node`: **GESAMT fe1dc086d68d (75 Einträge)**,
unverändert; alle sechs Schutzsummen unverändert. PP liegt nach dem Motor (Boxscore → PP) und steht nicht im
Fingerabdruck. Der `arena-eingabe-hash` ändert sich **absichtlich nur** für Saisons mit gestempeltem Tagesanker
(neuer Schlüssel `ppTagesanker`), damit ein vor dem Stempel gerechneter Vorlauf neu läuft.

## 6. Tests

`tests/pp-tagesanker.test.ts` (Stempel: neues Spiel an, laufender Save aus, Saisonwechsel, Rückweg, Notbremse,
C2-Voraussetzung, kompakte Ladung; Verteilung; Rechenstelle Arena), `tests/wertungs-skalen.test.ts` (Stempel-Felder).
