# Review-Fixes Wirtschaft und KI (22.11.)

Grundlage: `docs/design/gameplay-review-22-11.md` (Branch `claude/gameplay-review-22-11`), Befunde 1, 2, 3, 4, 7, 9, 10 plus zwei Zusätze von Chris
am 22.11. (Vertragsende = Verkauf; KI-Kaderziel nach Spitzenbedarf). Wertungs-Fingerabdruck unverändert: GESAMT `fe1dc086d68d` (identisch mit origin/main,
`--node`). Die Engine wurde nicht angefasst.

## Je Punkt: Ursache und Fix

| # | Ursache | Fix |
|---|---|---|
| 1 Quote greift nicht | `kaderpflichtZuschlag` gab neben dem Pflichtkader auch "Plätze bis Opt" aus der Kasse frei, ohne Quote. Nach jedem Saisonende liegen fast alle Kader darunter, also rechnete `kaufRahmen().grenzeFuer` für fast jedes Team mit dem Zuschlag. | Quotenfrei ist nur der Pflichtkader 8 (`kaderMin = VORSTAND_PFLICHT_KADER`, kein Opt-Zweig mehr). Alles darüber unterliegt der Quote; Mensch und KI nutzen weiter dieselbe Zahl (`kaufRahmen`). `lib/finance/vorstand-budgetfreigabe.ts` |
| 2 Vorstand belohnt Verfall | Erwartungsrang kam allein aus der aktuellen Stärke (PP/Marktwert); wer den Kader schwächt, senkt die Latte. | Erwartungsrang = Mittelwert aus aktuellem Stärkerang und Ligarang der letzten abgeschlossenen Saison (`vorjahresRangMischung`, symmetrisch). Wirkt in `computeTeamExpectation` und `resolveExpectedLeagueRank` (Zielrang, Medaillenziel). Abschalten `OLY_BOARD_ERWARTUNG_ANKER=0`. `lib/board/team-season-objectives-service.ts` |
| 3 KI verkauft Gute, kauft Schwache | Verkaufsnutzen (`wThrift x Erlös`) schlägt bei sparsamen Teams den Stärkeverlust; die Vorstandslatte sank gleichzeitig mit. Gemessene Käufe schwacher Spieler (D-L) fanden in Finanznot statt: Kasse 10,8 C, Schuld 14,4 C. | Kernschutz: die besten 3 Spieler (Stärke-Qualität) werden nur bei Finanznot verkauft (Kasse unter Puffer oder negativ), auch nicht als Upgrade-Tausch. `OLY_KI_KERNSCHUTZ=0` schaltet ab. Ein Kauf-Qualitätsfilter wurde bewusst nicht gebaut: die schwachen Käufe waren Finanznot, dort ist billig begründet. `lib/ai/organic-squad/draft-adapter.ts` |
| 4 Zu dünne Kader | Rotationsboden war Spitzenbedarf − 2 und griff nur über `resolvePlannerRosterTargets`; der organische Planer (S1-Draft) kannte ihn nicht. | Chris-Vorgabe: Kaderziel = höchste Platzsumme (bis 12) + 1 Ersatz, Deckel 14 (`KI_KADER_ERSATZ_PLAETZE`). Gilt im organischen Planer (also Draft S1 und Fenster ab S2) und im Planer-Ziel. Quote und Rücklage gelten weiter. |
| 9 Messwerkzeug ≠ App | Sperre S1-Draft-Pick las nur `ligaDraft.verlauf`; der Blocklauf setzt ihn nicht. | `RosterEntry.draftPickS1`, gesetzt von beiden Draft-Wegen (`stempleDraftPicksS1` im Blocklauf-"ready" und in `setzeDraftImKontext`), gelesen von `istDraftPickFestkonditionen`. Messskript nimmt jetzt `--draft einzelschritt` als Standard (wie die App). |
| 10 Voll KI ohne Kaufphase | `getAiTeamIds` kennt nur `controlMode === "ai"`. | `ermittleDelegierteTransferTeamIds` (manuell, Bereich Transfers an KI) nehmen am Kauf- und Verkaufsfenster ab S2 teil; `mitDelegiertenAlsKi` stellt den Modus für die Dauer des Laufs auf "ai" und danach zurück (Absturz: `protectManualPlayerTeams`). Training/Aufstellung/Sponsor bleiben je Bereich. Halbautomatik (Käufe selbst) bleibt geschützt. `lib/ai/ki-delegierte-transfers.ts` |
| 7 Rückkäufe | Ein Abgang durch Vertragsende war nicht in der Rückkauf-Sperre; die KI kaufte eigene Auslaufer zur vollen Ablöse zurück. | Zusatz Chris: Vertragsende = Verkauf. `anti-rebuy-guard` behandelt `contract_exit` der Vorsaison wie einen Verkauf (Kauf gesperrt, Kandidat im KI-Kaufzyklus ausgefiltert). |

## Vertragsende = Verkauf (Chris 22.11.)

Bezeichnungen vereinheitlicht auf "Verkauf (Vertragsende)": Spielerprofil/Kurzprofil, Karriere, Finanzen (Kontoauszug), Transfermarkt-Verkaufsansicht,
Transfer-Label-Helfer, CSV der Historie ("verkauf (vertragsende)"). Bilanz zählte Vertragsende schon als Verkauf (`bilanzJeTeam`).
Bewusst anders geblieben (fachlicher Grund): Rekorde/Erfolge über Ablöseerlöse (`league-records-hall-of-fame`, `league-achievements*`) ignorieren Vertragsende,
weil es keinen Ablöseerlös gibt; Daten-Typ `contract_exit` bleibt (59 Fundstellen), nur Anzeige und Regeln wurden angeglichen. Nicht geprüft: Moral-Wirkung
und KI-Logs im Einzelnen (Moral-Auflösung `contract-dissolution-service` schreibt bewusst `contract_exit`).

## Messung (32 KI-Teams, 3 Saisons, Block-Draft in beiden Läufen, `scripts/miss-teamfinanzen-saison.ts`)

| Größe | vorher (origin/main) | nachher |
|---|---|---|
| Teams über Transfertopf nach Kaufphase S2 / S3 | 24/32 (+14 %) / 23/32 (+6 %) | **1/32 (−5 %) / 0/32 (−6 %)** |
| Kaderstärke Bottom-4 / Top-4 S1 | 39,8 / 54,6 | 39,5 / 53,3 |
| S2 | 36,6 / 53,5 | 36,5 / 53,2 |
| S3 | 33,7 / 55,2 | 34,0 / 55,4 |
| Kadergröße Saisonstart S1 (min / Median / max) | 9 / 12 / 14 | **11 / 13 / 14** |
| S2 | 9 / 11 / 14 | 9 / 11 / 13 |
| S3 | 9 / 11 / 14 | 9 / 11 / 14 |
| Teams mit höchstens 10 Spielern S1 / S2 / S3 | 8 / 11 / 11 | **0** / 12 / 4 |
| Käufe S1 / S2 / S3 (Teams mit Kauf) | 380 (32) / 117 (32) / 95 (30) | 411 (32) / 78 (31) / 95 (32) |
| Σ Kasse nach Kaufphase S2 / S3 | 506 / 585 | 1003 / 926 |
| Rückkäufe eigener Vertragsabgänge | 8 (179,6 C) | 1 (16,5 C) |
| In-Saison-Verlängerungen mit Siegel S1 | 33 | **0** |
| Höchste gleichzeitig Verletzte eines Teams S1 / S2 / S3 | nicht erfasst | 4 / 4 / 6 (T-C, Spieltag 19) |

Verletzte: gezählt über `playerAvailabilityState` (verletzt oder genesend) je Team nach jedem Spieltag; Teams mit mindestens 4 zugleich: 4 / 5 / 6.
Ein Team mit 13 Spielern und 6 Verletzten hat noch 7 einsetzbare, unter dem Spitzenbedarf von 12 Plätzen; 14 reicht also nur knapp, wenn die
Spitzenspieltage mit Verletzungen zusammenfallen. Entscheidung bei Chris.

## Offene Punkte

- **Kadertiefe ab S2 bleibt bei Median 11** (Ziel 13): der Transfertopf wird komplett ausgeschöpft (frei ≈ 0), während 20–50 C je Team auf dem Konto bleiben
  (Quote 90 % plus Rücklage). Die Quote begrenzt jetzt die Tiefe; vorher hat der Opt-Zuschlag sie ausgehebelt. Hebel, wenn Chris tiefere Kader will: billigere
  Spieler priorisieren (Platzpreis-Reserve im Kaderplan) statt teurer Einzelkäufe, oder Rotationsplätze bis 11 quotenfrei stellen (widerspricht "nur Pflichtkader 8").
- **Kaufphase S2 hat weniger Käufe (78 gegen 117)** und höhere Restkassen (1003 gegen 506) — direkte Folge der echten Quote.
- 1 Rückkauf eines Vertragsabgängers blieb (anderer Weg als der KI-Zyklus, nicht verfolgt).
- Mehr In-Saison-Verlängerungen in S3 (122 gegen 43 Vermerke) — nicht untersucht.
- Eine Auswertung der Kaufqualität (Befund 3) auf Spielerebene wurde nicht wiederholt; der Kernschutz ist nur über Tests und unveränderte Bottom-4-Stärke belegt
  (Bottom-4 S1–S3 39,5 → 36,5 → 34,0, vorher 39,8 → 36,6 → 33,7: **die Schere schließt sich nicht**; Ursache liegt vermutlich im Finanzwert-Gefälle).
- "Voll KI" im Messlauf: der Lauf hat nur reine KI-Teams (Vorgabe), der delegierte Weg ist per Unit-Test belegt, nicht per Langlauf.
