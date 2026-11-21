# Spielplan, Saison-Ränge, Tennis, Hover — Fix 21.11.

Chris' Meldungen vom 19./20.11., belegt am Live-Save `new-game-1795114260527-nzr0z9` (Abbild `live-save`
vom 21.11. 15:10 UTC, Battle Mode, Liga-Split 2 × 16, Spieltag 12 in Planung, 11 gewertet). Nur gelesen,
nichts zurückgeschrieben; laufende Saves werden nicht repariert.

## 1. Beide Disziplinen eines Spieltags mit denselben Teams

**Befund im Save.** Je Team und Spieltag D1- gegen D2-Gegner verglichen (`seasonState.disciplineResults`,
Duell: `opponentTeamId`, Vierergruppe: `miniDmPod.teamIds`):

| Spieltag | D1 / D2 | Teams mit abweichenden Gegnern |
|---|---|---:|
| 1, 3–9, 11 | Duell / Duell | 0 von 32 |
| 2 | Battlefield / Mini-DM (beide Vierergruppe) | **28 von 32** |
| 10 | Takeshi's Castle / Staffel (beide Vierergruppe) | **32 von 32** |

Death Peaches an Spieltag 10: D1 mit R-R, T-C, T-G, D2 mit L-K, R-R, U-A. Der Duell-Gegner aus dem
Spielplan steckte in beiden Gruppen (die Kopplung vom 11.11. wirkte), die Gruppen selbst aber nicht.

**Ursache.** `getPodsForMatchday()` (`lib/season/mini-dm-pod-schedule.ts`) loste die Vierergruppen mit
der Disziplin-ID im Seed (`podSeedTeil`) — Absicht vom 01.11. („je Disziplin-Event frisch gelost“). Stehen
zwei Pod-Disziplinen am selben Spieltag, verschmelzen sie dieselben acht Duell-Paare deshalb zu
verschiedenen Vierergruppen.

**Regel (eindeutig für jede Kombination).** Die Paarung gehört dem Spieltag, nicht der Disziplin:

| D1 / D2 | Gegner |
|---|---|
| Duell / Duell | derselbe Gegner (die Spieltags-Paarung aus `seasonState.schedule`) — war schon so |
| Pod / Duell oder Duell / Pod | der Duell-Gegner steht in der Vierergruppe, die beiden anderen spielen gegeneinander — war schon so (11.11.) |
| Pod / Pod | **dieselben Vierergruppen**; Leitdisziplin ist **D1**, D2 übernimmt deren Seed und Saison-Vorkommen |

Damit gilt für jedes Team: die kleinere Gegnermenge (ein Duell-Gegner) ist immer in der größeren (drei
Gruppengegner) enthalten, bei gleicher Art sind beide gleich. Warum D1 als Leitdisziplin: bei einem
Spieltag mit nur einer Pod-Disziplin ist sie ohnehin ihre eigene Leitdisziplin — deren Seed bleibt
dadurch bit-identisch, angekündigte Gruppen ändern sich nicht. Nur die Zusammensetzung folgt D1, die
Pod-ID bleibt disziplineigen (`battlefield-pod:…`, `minidm-pod:…`), Match-Saaten und Vorlauf-Schlüssel
unterscheiden die Disziplinen weiter.

Ist D1 (oder D2) schon mit alten, disziplineigenen Gruppen gebucht, spielt die noch offene Partnerdisziplin
in genau diesen gebuchten Gruppen. Gebuchte Gruppen einer Disziplin selbst bleiben immer, wie sie sind.

**Wirkung auf den laufenden Save.** Keine: die beiden Doppel-Pod-Spieltage (2, 10) sind gewertet und
behalten ihre gebuchten Gruppen; Spieltage 12–20 haben keinen weiteren Doppel-Pod-Tag (12 Mini-DM +
Basketball, 14 Battlefield + Wettessen, 15 Staffel + Zeitfahren, 16 Tennis + Takeshi — alle gemischt und
damit schon gekoppelt). Neue Saisons und neue Spielstände losen ab jetzt nach der Regel oben.

Test: `tests/spieltag-gleiche-paarungen-d1-d2.test.ts` (alle 56 D1/D2-Kombinationen aus 4 Pod- und 4
Duell-Disziplinen, je Team und Spieltag, zwei Saaten; gebuchte D1-Gruppen; Einzel-Pod-Tag bit-identisch).

## 2. Saison-Rang und Rangbewegung nur innerhalb der eigenen Liga

**Befund.** Der Saisonstand (`standings[team].rank`) rankt seit dem Liga-Split ligalokal. Mehrere
Anzeigen rechneten Vorher-Rang und Bewegung aber über alle 32 Teams. Im Save nach Spieltag 11:
Stronghold Crusaders 26. → 12., Pirate Crew 32. → 16., Dire Legion 22. → 11. (Liga 2), in Liga 1
Wicked Wizards 20. → 8. — jeweils „vor“ über 32 Teams, „nach“ aus dem ligalokalen Saisonstand. Je Liga
gerechnet: 13. → 12., 16. → 16., 11. → 11., 11. → 8. (Screenshots `spielplan-raenge-fix-21-11/wertung-vorher.png`
und `wertung-nachher.png`). Dieselbe Mischung lieferte im Saisonstand ±-Werte über 15 in einer 16er-Liga.

**Fix.** Eine Stelle verteilt jede Rangfunktion auf Liga-Gruppen: `lib/season/liga-raenge.ts`
(`teileNachLiga`, `rangJeLiga`, `ligaVonAusSpielstand`). Ohne Liga-Split eine Gruppe, also bit-identisch.
Umgestellt:

- `buildStandingsMatchdayRankPair`/`…Delta` (`season-standings-matchday-rank-delta.ts`): optionales
  `league` je Team; Arena („vor → nach“) und Saisonstand-± reichen die Liga durch.
- Feld-Rennen-Ledger (`build-field-race-ledger.ts`): Tages- und Gesamtrang je Liga → Saisonstand-Bewegung,
  Home-Rangbewegung, Form-Strip.
- Spieltagsergebnis (`matchday-summary.ts`): Saison-Rang vor/nach je Liga. Der Tagesrang bleibt hier
  bewusst über alle Teams — er trägt das Spieltags-Podest.
- Arena-Briefing (`matchday-arena-base-service.ts`) und Rückfall-Rang des Saisonstands
  (`use-season-stand-rows.ts`) je Liga.
- Spieltagswertung (`spieltagswertung-zeilen.ts`): abgeleiteter Nachher-Rang je Liga, falls die Engine
  keinen liefert.
- Home-Rang-KPI: Feldgröße = eigene Liga statt aller Teams.

Der Team-Hover der Arena zeigte schon `standings.rank` (ligalokal) und blieb unverändert.

Test: `tests/saison-rang-je-liga.test.ts`.

## 3. Tennis 2:2 bei fünf Einzeln

**Befund.** Alle 32 Tennis-Ergebniszeilen im Save summieren sich auf 4 Rubber (4:0, 3:1, 2:2), obwohl an
Spieltag 6 je Team fünf Spieler eingesetzt waren; 4 von 16 Duellen endeten 2:2 (u. a. Death Peaches –
Pirate Crew, `duellSeiten [2,2]`, je 1 Teampunkt).

**Ursache.** Das Davis-Cup-Doppel (T-F2, `public/mockups/battle-mode.engine.js`, `bauBuehne()`) fasst die
letzten zwei Bretter zu einem Rubber zusammen — bei 5 Spielern also 3 Einzel + 1 Doppel = 4 Rubber, eine
gerade Zahl. Bei 3 Spielern ebenso (1 + 1 = 2).

**Fix.** Das Doppel gibt es nur noch bei gerader Brettzahl: 2 → 1 Rubber (Doppel), 3 → 3 Einzel,
4 → 2 Einzel + Doppel = 3, 5 → 5 Einzel, 6 → 4 Einzel + Doppel = 5. Die Rubber-Zahl ist immer ungerade.
Ein Mannschafts-Remis bleibt nur bei einem Brett mit exaktem Punktgleichstand möglich (Motor-Randfall).

Wertungs-Fingerabdruck (`--node`): vor und nach dem Fix `GESAMT eaafed96150e (75 Einträge)` — der
Fingerabdruck fährt Tennis mit 6 je Seite, dort ändert sich nichts. Bewegt werden nur Tennis-Duelle mit
3 oder 5 Spielern je Seite (gewollt). `u.summe`/`wert()` bleiben unberührt, Rangtreue und
Pp-Abweichung damit auch. Offen: die Ergebnisskala-Anker für Tennis-Feldgröße 3/5
(`data/generated/ergebnis-skala-kalibrierung.json`) sind noch auf die alten Rubber-Zahlen gemessen;
ein Neuziehen mit `scripts/werte-ergebnisskala-aus.ts` lohnt sich, ist aber kein Fehler (Sieg bleibt Sieg).

Test: `tests/tennis-ungerade-rubberzahl.test.ts` (2–6 Spieler je Seite, `disziplinProbe` mit `buehneDiag`).

## 4. Team-Hover der Spieltagswertung: „noch offen“ trotz Wertung

**Ursache.** Die Hover-Karte (`DisciplineStageHoverPreview`) zeigte Werte nur aus `liveResultsByTeam` —
den Slots, die die gerade laufende Arena aufgedeckt hat. Die Arena zeigt aber nur eine Begegnung; für jedes
andere Team stand unter „Eingesetzt“ überall „noch offen“.

**Fix.** `app/foundation/discipline-stage/hover-gewerteter-einsatz.ts` baut je Team die aufgedeckten
Seiten aus derselben Quelle wie die Spieltagswertung (`matchdayPanel.playersByTeam`): je Disziplin
„Eingesetzt · <Disziplin>“ mit Score und PP je Spieler. Verdeckte Seiten liefern nichts (Anti-Spoiler wie
die Wertung selbst); die Live-Liste erscheint nur noch für die laufende, noch nicht gewertete Disziplin.
Screenshot `spielplan-raenge-fix-21-11/hover-nachher.png` (Spieltag 11 aus dem Save).

Test: `tests/hover-gewerteter-einsatz.test.ts`.

## 5. Spieltag 2 in den Standings

Geprüft, korrekt: `standingsApplyLogs` enthält Spieltag 2 mit 32 Teams; für alle 32 Teams ist
`standings.points` gleich der Summe der gebuchten `teamPoints` über Spieltag 1–11 (0 Abweichungen),
Spieltag 2 trägt 48 Teampunkte (acht Vierergruppen × 2-1-0-0 × zwei Disziplinen), ein Duell-Spieltag 64.
