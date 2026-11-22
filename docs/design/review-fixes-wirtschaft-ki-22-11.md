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

## Runde 2 (22.11., nach unabhängigem Review und Ergänzungen von Chris)

Fingerabdruck `--node`: GESAMT `fe1dc086d68d` unverändert. Vitest: 293 Dateien zu ai, market, transfer, finance, vorstand, board, draft, verlängerung, organic,
roster, delegation, contract (2145 Tests) seriell grün. `tsc -p tsconfig.check.json` sauber; `tsc -p .` zeigt nur die schon vorhandenen Fehler in Skripten und fremden Tests.

| # | Fund | Fix |
|---|---|---|
| 1 | `mitDelegiertenAlsKi` schrieb `controlMode: "ai"` in den Spielstand (parallele Schreibwege normalisierten Besitzer und `humanControlled`; Absturz = Team bleibt KI) | Der Modus im Spielstand wird **nie** geändert. `getTransferControlSettings` (`lib/ai/ki-delegierte-transfers.ts`) ist eine Lesesicht und liefert für Teams mit Bereich Transfers = KI nur im Speicher `controlMode: "ai"`. Sie ersetzt `getTeamControlSettings` in Transfer-Vorschau, Verkaufs-Vorschau, Marktplan-Anwendung, Verletzungs-Topup und in `manualTeamIds`/Nachzügler der Fenster-Sitzung. `mitDelegiertenAlsKi` ist entfernt. Test: Lesesicht lässt Spielstand, `ownerId`, `ownerSlot` und `humanControlled` unverändert. |
| 2 | Anker las `seasonSnapshots`, im Browser leer: gezeigt ≠ gebucht | Der Vorjahres-Anteil je Team steht klein im Stempel (`wirtschaftsRegeln.vorjahr`), beim Saisonwechsel gesetzt. Browser und Server lesen dieselbe Zahl. |
| 3 | Ligalokaler Rang: Aufsteiger bestraft, Absteiger belohnt | Anteil 0..1 in der heutigen Liga. **Aufsteiger = 1** (Letzter der neuen Liga: dort noch nichts bewiesen, kein Druck durch ein altes Liga-2-Rang-1), **Absteiger = 0** (Erster der neuen Liga: wer absteigt, wird oben erwartet und nicht belohnt). Quelle: `leagueMovementLogs`. Tests für Auf- und Absteiger. |
| 4 | Zwei rote Tests | Konvergenz-Test: Rotationsboden ist jetzt 13, das Team im Test hat 13 und Ziel 13 (Erwartung bewusst geändert). Apply-Test: dasselbe Kaderziel (13 statt 10 Spieler), außerdem wirft `applyAiMarketPlanLocally` bei fehlender Vorschau jetzt `ai_market_plan_preview_missing` statt `TypeError … 'teams'`. |
| 5 | Prozessvariablen | `seasonState.wirtschaftsRegeln` (`lib/resolve/wirtschafts-regeln.ts`): `quote`, `anker`, `kernschutz`, `rueckkauf` je "alt" oder "neu", gesetzt beim Anlegen (neue Spiele ab Saison 1) und beim Saisonwechsel (laufende Spielstände ab dem nächsten); ohne Stempel gilt "alt". Schalter `OLY_QUOTE_UEBER_PFLICHTKADER`, `OLY_BOARD_ERWARTUNG_ANKER`, `OLY_KI_KERNSCHUTZ`, `OLY_RUECKKAUF_SPERRE` (und `NEXT_PUBLIC_…`) in `docker-compose.yml` und `.env.example`; sie wirken nur auf **neue** Saisons. Damit wechseln auch die Sponsorziele (`underdog_story`, `golden_fairytale`) nie mitten in der Saison. |
| 6 | Auslöser | Delegierte Teams werden im Fenster bedient, egal wer den Lauf auslöst (`ermittleDelegierteTransferTeamIds` ohne Schreibrechte des Auslösers; `skipped_not_writable` gilt nicht für delegierte Teams). |
| 7 | Kredite für Menschen | `kreditPass` und Kassensturz/Notkredit laufen nur über die echten KI-Teams (`aiTeamIds`); die Sitzung selbst nimmt Kredite weiter nur für `controlMode "ai"` im Spielstand. |
| 8 | Performance | `buildRecentlySoldByTeam` baut je Verlaufs-Array, Saison und Regel einmal (WeakMap), "seither gekauft" über eine vorab gebaute Karte (`letzterKauf`). |
| 9 | Kleinkram | `draftPickS1` auch im dritten Draft-Weg (Setup-Draft im Preseason-Lauf). Delegierte Kaufphase erst ab Saison 2 (`getCurrentSeasonNumber >= 2`). Meldung: "Verkauft (auch durch Vertragsende) — Rückkauf in diesem Transferfenster gesperrt." (die Meldung ist ein fester Text je Sperrcode; Saison X/Y würden einen Parameter im Sperrcode brauchen — nicht gebaut). Echte Verkäufe der Vorsaison sind jetzt ebenso gesperrt wie Vertragsende, solange sie niemand anders verpflichtet hat; Verkäufe im Fenster selbst waren schon gesperrt. |
| 10 | Kernschutz lockern | Die besten 3 gehen auch bei einem guten Angebot: realisierter Verkaufspreis (nach allen Abschlägen) geteilt durch Marktwert **≥ 1,5 (Rang 1), 1,4 (Rang 2), 1,3 (Rang 3)**, sonst weiter nur in Finanznot. Konstante `KERN_ANGEBOT_FAKTOR`; Messspur `KERN_VERKAUF_LOG`. |
| 11 | Quote vorausplanen | `schaetzeFreigabeNaechsteSaison(gameState, teamId, {vertrauen?, kasse?})` in `vorstand-budgetfreigabe.ts`: dieselbe Formel (Stufe nach Vertrauen, Rücklage nach Finanzwert und Gehaltskosten, Gehaltspuffer) für die Folgesaison, liefert Anteil, Rücklage, Gehaltspuffer und den ausgebbaren Betrag; für KI und Mensch, später als Hinweis in den Finanzen anzeigbar (keine UI). Planer: (b) der Kauf-Nutzen misst den Preis am **Budget je Platz aus der Quote** (`OrganicTeamState.budget = min(Kasse, kaufRahmen.grenzeFuer.fee)`), nicht an der Kasse: die KI streut den Topf auf mehr, günstigere Spieler statt wenige Stars. (c) schmal bleiben: besteht über die vorhandene GM-Opt-Senkung (bis −2, nie unter Minimum + 1). Saison 1: Teams mit niedriger erwarteter Quote (Vorausschau mit dem Blatt-Vertrauen der Identität) lassen im Draft `(1 − Quote) × 0,5 × Kasse` liegen. (a) proaktives Umbauen (teuer verkaufen, mehrere günstige holen) gibt es nur über Kernschutz-Lockerung und den bestehenden Verkaufsnutzen, nicht als eigenen Planschritt. |

## Messung Runde 2 (32 KI-Teams, 3 Saisons, Block-Draft, `scripts/miss-teamfinanzen-saison.ts`)

| Größe | vorher (origin/main) | Runde 1 | Runde 2 |
|---|---|---|---|
| Kadergröße Saisonstart S1 (min / Median / max) | 9 / 12 / 14 | 11 / 13 / 14 | 9 / 13 / 14 |
| S2 | 9 / 11 / 14 | 9 / 11 / 13 | 9 / 11 / 14 |
| S3 | 9 / 11 / 14 | 9 / 11 / 14 | 9 / 11 / 14 |
| Teams mit höchstens 10 Spielern S1 / S2 / S3 | 8 / 11 / 11 | 0 / 12 / 4 | 3 / 1 / 12 |
| Ø Kader nach Kaufphase S2 / S3 | 11,1 / 11,2 | 11,0 / 11,2 | 11,6 / 11,2 |
| Teams über dem Transfertopf S2 / S3 | 24 / 23 | 1 / 0 | 0 / 0 |
| Kredite (Σ Schuld, Teams mit Schuld) zum Saisonstart S2 / S3 | 60 (3) / 74 (3) | nicht erfasst | 0 (0) / 0 (0) |
| Kaderstärke Bottom-4 / Top-4 S1 | 39,8 / 54,6 | 39,5 / 53,3 | 37,4 / 52,0 |
| S2 | 36,6 / 53,5 | 36,5 / 53,2 | 37,6 / 52,9 |
| S3 | 33,7 / 55,2 | 34,0 / 55,4 | **38,1 / 56,2** |
| Käufe S1 / S2 / S3 (Teams mit Kauf) | 380 / 117 / 95 (32 / 32 / 30) | 411 / 78 / 95 | 399 / 82 / 69 (32 / 30 / 27) |
| Verkäufe der besten 3 | nicht erfasst | nicht erfasst | **0** geplant (kein Kernspieler ging in Finanznot oder über Angebots-Schwelle) |
| Höchste gleichzeitig Verletzte eines Teams S1 / S2 / S3 | nicht erfasst | 4 / 4 / 6 | 4 / 5 / 4 (Teams mit mindestens 4 zugleich: 3 / 4 / 2) |
| Rückkäufe eigener Vertragsabgänge | 8 (179,6 C) | 1 (16,5 C) | 1 (16,2 C) |

Lesart: Die Schere öffnet sich nicht mehr (Bottom-4 steigt von 37,4 über 37,6 auf 38,1; vorher 39,8 → 36,6 → 33,7). Das hängt an dem Kernschutz (kein Ausverkauf der
Besten), der Verankerung der Vorstandsziele und an der Kasse: Σ Kasse zum Saisonstart ist doppelt so hoch wie vorher (1158 / 1090 / 1144 gegen 587 / 506 / 585) und
es gibt keine Kredite mehr. Die S1-Draft-Rücklage für niedrige erwartete Quoten kostet in Saison 1 etwas Stärke (Bottom-4 S1 37,4 gegen 39,8) und drei Teams mit 9 bis 10
Spielern. Die Tiefe ab S2 bleibt bei Median 11 (Quote und GM-Opt-Senkung), in S3 haben 12 Teams höchstens 10 Spieler: das Budget je Platz aus der Quote
hat S2 verbessert (1 statt 11 Teams), S3 nicht. Mit 5 gleichzeitig Verletzten in S2 (C-S) reicht die Grenze 14 knapp, wenn die Kader tatsächlich voll sind.

Offen: Kaderziel 13 bleibt ab S2 in der Praxis bei 11 bis 12; Hebel wäre ein höheres Budget je Platz (Quote) oder eine bewusste Ausnahme für Rotationsplätze,
beides gegen "nur der Pflichtkader 8 ist quotenfrei". Ein Kernspieler-Verkauf bei gutem Angebot kam im Lauf nicht vor (Schwellen 1,3 bis 1,5 sind hoch); ob
Chris die Schwelle senken will, ist seine Entscheidung. Das Kassenniveau (doppelt so hoch) zeigt, dass der Vorstand jetzt streng bremst: Finanz-Feintuning (z. B. 100 % ab
Vertrauen 7) ist ein eigener Schritt.
