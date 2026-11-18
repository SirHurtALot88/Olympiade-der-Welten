# Ein gemeinsames Transferfenster und „das Fenster vor Saison N gehört zu Saison N“ (18.11.)

Entscheidung von Chris am 18.11., freigegeben mit „ok dann mach das so!“. Grundlage: `docs/design/transfermarkt-modern-18-11.md`,
Fragen 2 und 3.

## 1. Was sich ändert

| | vorher | jetzt |
|---|---|---|
| Saisonende (`season_end_management`, `transfer_sell_phase`) | verkaufen, ablösen, verlängern | **nur noch** Abrechnung, Vertragsenden, Verlängerungen |
| Neue Saison vor Spieltag 1 (`isEarlySeasonTransferSetup`) | nur kaufen | **kaufen UND verkaufen**, beliebige Reihenfolge, Mensch und KI gleich |
| Während der Saison | kein Handel | kein Handel (unverändert) |
| Verkaufserlöse im Fenster | unter der Vorstands-Quote (bei 70 % nur 70 % frei) | **sofort zu 100 % frei** für Käufe im selben Fenster |
| KI | verkauft in der Saisonende-Kette, kauft im Fenster | verkauft, kauft, Nachrunde, Kassensturz — alles im Fenster |
| Transferbilanz Saison 1 | Draft als Kauf gegen die Saisonende-Verkäufe → fast immer tief negativ | **leer („—“)**; der Draft ist **Kaderaufbau aus dem Startbudget** |
| Transferbilanz ab Saison 2 | Käufe der Saison (Saisonstand: plus Verkäufe der Vorsaison) | **Erlöse − Ablösen aller Bewegungen des Fensters vor dieser Saison** |

Schalter: `OLY_TRANSFERFENSTER_GEMEINSAM=0` (Server) bzw. `NEXT_PUBLIC_OLY_TRANSFERFENSTER_GEMEINSAM=0` (Browser, beim Build)
stellt das alte Fenster her. Standard AN. Der Schalter betrifft Phasen, KI-Ablauf, Freigabe der Erlöse und die Texte. Die
Buchung (Abschnitt 3) gilt in beiden Stellungen, weil sie auch die Saisonende-Verkäufe des alten Ablaufs richtig zuordnet.

## 2. Ein Fenster — warum das Verkaufen am Saisonende ganz wegfällt

Empfehlung umgesetzt: **ja, ganz.** Gründe:

1. **Ein Fenster heißt ein Ort.** Bleibt das Verkaufen am Saisonende zusätzlich offen, gibt es wieder zwei Fenster mit zwei
   Preisregeln (Saisonende 0,98 bzw. 1,0, Saisonstart 0,95) und zwei Momenten, in denen die KI verkauft. Genau diese
   Doppelung hat die Saisonende-Kette schon zweimal verheddert (Setup-Draft am Saisonende, Käufe in der alten Saison).
2. **Nichts geht verloren.** Wer einen auslaufenden Spieler nicht verlängert, bekommt beim Saisonwechsel wie bisher den
   Ablösewert (`contract_exit`, `computeSeasonEndContractTick`). Verkaufen am Saisonende war für diese Spieler nie nötig.
3. **„Erst verkaufen, dann kaufen“ ist der Weg aus der Sperre** (Frage 2). Mit der Vorstands-Freigabe braucht der Spieler
   den Verkauf im selben Fenster wie den Kauf; ein Verkaufsknopf vor einer geschlossenen Tür hilft niemandem.

Was am Saisonende bleibt: Verlängern (`renew_contract`), Training, Gebäude, Kredite. `isTransferMarketPhaseOpen` hält die
Saisonende-Stationen dafür weiter offen; die Kette hält wie bisher an `season_end_management` an. Die Station
`transfer_sell_phase` heißt im Assistenten jetzt „Verträge“: dort verlängern die KI-Teams (organische Logik wie bisher),
verkaufen aber nicht mehr (`nurVerlaengern`). Wen der Verkaufsplan abgeben würde, der wird dort nicht verlängert und
kommt in der Verkaufsrunde des Fensters erneut auf den Tisch.

Preis im Fenster: der Zeitfaktor des Verkaufspreises ist im gemeinsamen Fenster **1,0** (wie bisher in `transfer_sell_phase`,
wo die KI verkaufte), nicht mehr 0,95 („zu spät verkauft“). Sonst sänken die Erlöse der KI allein durch die Verlegung um 5 %.

### Mitgezogen

| Stelle | Änderung |
|---|---|
| `lib/market/transfer-window-policy.ts` | `isTransferSellPhaseOpen` = Fenster der neuen Saison; neu `isSeasonEndManagementOpen`, `isGemeinsamesTransferfensterOffen`; Beschriftung „Transferfenster offen“ / „Vertragsphase“; Statusfeld `gemeinsamesFenster` |
| `lib/market/transfermarkt-local-service.ts` | kein Verkauf mehr „nach dem letzten Spieltag, vor `season_completed`“; Sperrgrund `sell_only_in_transfer_window` |
| `evaluateGamePhaseAction`, Routen `app/api/transfermarkt/sell|buy` | unverändert im Code — sie lesen die Politik, und die gibt jetzt im Fenster beides frei |
| Transfermarkt-Anzeige (`transfer-sell-view-labels.ts`, `FoundationMarketSellShellHost`, Format-Labels) | Texte: „verkauft wird im Transferfenster vor Spieltag 1“ statt „am Saisonende“ |
| Saisonabschluss (`FoundationSeasonFinalePanel`) | „Verträge öffnen“ statt „Verkäufe & Verträge öffnen“; Kaufen und Verkaufen kommen gemeinsam in der neuen Saison |
| Arena-Vorlauf (`DisciplineStageArena`) | „Das Transferfenster ist noch offen … schließt es“ |
| Room-Flow (`lib/room/room-flow-controller.ts`) | nach dem Saisonwechsel zurück zu „Verkäufe entscheiden“ (`resolveRoomFlowSeasonTransitionTarget`), nicht ins Training — sonst sähe im Raum niemand das Fenster |
| Saisonende-Assistent (`season-transition-service.ts`) | Stationen „Verträge“ und „Transferfenster folgt“, Vorschau-Texte |

## 3. Buchung: „Das Fenster vor Saison N gehört zu Saison N“

Eine Stelle für die Regel: `lib/season/transferbilanz-buchung.ts`.

1. Jeder Kauf/Verkauf gehört zum Transferfenster seiner Saison. Verkäufe am letzten Spieltag einer Saison (alter Ablauf)
   gehören zum Fenster der Folgesaison — die Zuordnung dafür gibt es seit #459 (`transfer-window-zuordnung.ts`) und wird
   wiederverwendet. Im gemeinsamen Fenster tragen Verkauf und Kauf ohnehin schon die neue Saison.
2. Alles, was zum Fenster von **Saison 1** gehört, ist **Kaderaufbau aus dem Startbudget**: Liga-Draft (`ai_roster_fill`),
   eigene Draft-Picks (`manual_transfermarkt_buy` auf `matchday-1`), Maskottchen-Regel, Verkäufe vor Spieltag 1.
   Transferbilanz S1 = `null` („—“).
3. Ab Saison 2: Transferbilanz = Erlöse − Ablösen aller Käufe/Verkäufe des Fensters dieser Saison, egal welche Quelle
   (KI, Mensch, Füll-Lauf, Verletzungs-Nachkauf). Die alten Quellenlisten (`SEASON_END_MARKET_SELL_SOURCES`, …) zählen nicht
   mehr; sie haben schon einmal ganze Transferarten fallen lassen (`ls9jfg`).
4. `contract_exit` ist kein Transfer und zählt nirgends mit.

Woran die Draft-Käufe erkannt werden: nachgesehen am Live-Abbild (`swnjlk`, `0dwpok`). Es gibt keine eigene Draft-Quelle —
der Liga-Draft schreibt `ai_roster_fill`, eigene Picks `manual_transfermarkt_buy`, beide auf `matchday-1` von `season-1`.
Erkannt wird deshalb nicht an der Quelle, sondern an der **Fenster-Saison 1**. Das deckt Draft, eigene Picks und spätere
Bewegungen vor Spieltag 1 von Saison 1 gleich ab.

### Wo die Buchung gilt

| Stelle | |
|---|---|
| Saisonstand (`transfer-standings-balance.ts`, `use-season-stand-rows.ts`) | Transferspalte S1 „—“, Kaderaufbau getrennt |
| Teamzeilen (`team-management-overview.ts`) | `transferNet: number \| null`, neu `kaderaufbauNet` |
| Vorstandsziele (`team-season-objectives-service.ts`) | „Transferbilanz“ erst ab S2 (S1 bleibt „Aufbausaison: Liquidität“), Ausgaben-Deckel ohne S1 |
| Saison-Schnappschuss (`season-snapshot-service.ts`) | neue Felder `kaderaufbauNet`, `kaderaufbauBuyTotal`, `kaderaufbauSellTotal`, `kaderaufbauBuyCount`; Anzahl/Summen aus der Buchung |
| Saisonrückblick (`season-recap-service.ts`) | S1: „Kasse … C · Kaderaufbau −X C · Transferbilanz —.“, ab S2 mit Zahl |
| Saison-Historie (`foundation-season-history-projection.ts`, `use-history-v2-derivations.ts`) | Zeilen tragen `buchungsArt`; Netto ohne Kaderaufbau, eigener Chip „Kaderaufbau“ |
| Finanzseite (`use-finances-view-model.ts`, `FoundationFinancesNewLook.tsx`) | `kaderaufbau` getrennt von `transfer`; eigene Karte „Kaderaufbau“ in S1 |
| Kontoauszug (`lib/finance/kontoauszug.ts`) | neue Buchungsart `kaderaufbau` |

### Bestehende Spielstände

Keine Migration. Am gespeicherten Geld und am Archiv ändert sich nichts — der Archivschutz (`preserveAppendOnlyArchive`)
hielte jeden Schnappschuss ohnehin Zeichen für Zeichen fest. Umgerechnet wird beim **Lesen**:
`leseSaisonSchnappschuesse` und `projiziereSaisonHistorie` setzen die Transferzahlen archivierter Saisonen aus der
Transferhistorie nach der Buchungsregel neu (`rechneTransferbilanzInSchnappschuessenUm`). Das ist idempotent (die
Kurzfassung des Servers wird im Browser nicht doppelt umgerechnet). Fehlt die Historie, wird Saison 1 als Kaderaufbau
gelesen (alter Kauf-Saldo), ab Saison 2 bleibt der Archivwert.

## 4. KI im Fenster

`fuehreKiPreseasonLaufAus` (Saison-Markt-Modus), in dieser Reihenfolge:

1. **Verkaufsrunde** — `runTransferWindowSession({ phase: "fenster_verkauf" })`: dieselbe organische Verkaufslogik wie bisher
   am Saisonende (`planOrganicSellsForTeam`, Überzählige, Gewinnmitnahmen, `upgrade_churn`), danach die **Vorab-Ablösung**
   der Kredite (Anti-Churn, `resolveAiEarlyPayoffDecision`). Keine Verlängerungen (die gehören ans Saisonende). Ein Team
   kauft keinen Spieler zurück, den es im selben Fenster verkauft hat (`recentlySoldPlayerIds` im Kauf-Planer).
2. Kredit-Durchgang 1 (unverändert).
3. **Kauf** — `applyAiMarketPlanLocally`, Schnittstelle des Planers unverändert, `applySellSteps: false`.
4. Kredit-Durchgang 2 (unverändert).
5. **Nachrunde** für offene Plätze — derselbe Planer noch einmal. Kein Notkauf, kein Auffüllen auf ein Minimum.
6. Verletzungs-Nachkauf (unverändert).
7. **Kassensturz** (`lib/ai/ki-kassensturz.ts`): Minus → zuerst die Rücklage (sie liegt in der Kasse; ≥ 0 heißt: getragen),
   dann der reguläre Liquiditätskredit (`resolveAiLoanDecision`), dann der Notkredit über den Fehlbetrag
   (`applyInsolvencyBackstop`), **Notverkauf nur als letztes Mittel** (höchstes Gehalt je Marktwert zuerst, nie unter 8).
8. Schnappschuss der Vorsaison auf den Eintrittsstand (unverändert).

Planer und Rücklage gehören dem parallelen Umbau (#1618: `lib/ai/organic-squad/*`, `ai-market-plan-apply-service.ts`,
`ki-ruecklage.ts`, `vorstand-budgetfreigabe.ts`); dort ist hier nichts umgebaut. Eine Zeile in
`vorstand-budgetfreigabe.ts` ist geändert (Abschnitt 5).

## 5. Verkaufserlöse 100 % frei (Frage 3)

`berechneVorstandBudgetStand`: `gesamt = Quote × Anfangskasse + 1 × Verkaufserlöse` statt `Quote × (Anfangskasse + Erlöse)`.
Der Faktor kommt aus `verkaufserloeseFreiAnteil()` (`lib/market/transferfenster-gemeinsam.ts`). **Für #1618:** dort heißt der
Term `q × Verkaufserloese`; beim Rebase wird er zu `verkaufserloeseFreiAnteil(q) × Verkaufserloese` — mehr nicht.

## 6. Messung (32 KI-Teams, S1 → S2, paarweise)

Basis: neues Spiel mit 32 KI-Teams von Anfang an (`scripts/miss-teamfinanzen-saison.ts --stop-after spieltage`), Liga-Draft und
20 Spieltage von Saison 1. Von dort zweimal derselbe Weg auf je einer Kopie (`scripts/miss-transferfenster-gemeinsam.ts`):
Saisonabschluss → Saisonende-Kette → Saisonwechsel → KI-Lauf im Fenster. „vorher“ mit `OLY_TRANSFERFENSTER_GEMEINSAM=0`.
Eine Saat; Laufzeit je Lauf rund 200 s.

| | vorher (zwei Fenster) | nachher (ein Fenster) |
|---|---:|---:|
| KI-Verkäufe am Saisonende | 62 (773,7 C) | **0** |
| KI-Verkäufe im Fenster | 0 | **60 (667,3 C)** |
| Käufe im Fenster (inkl. Nachrunde 27) | 57 (897,2 C) | 62 (1382,8 C) |
| Teams mit Verkauf / mit Kauf | 24 / 30 | 25 / 27 |
| Transferbilanz S1 „—“ | 32 von 32 | 32 von 32 |
| Kaderaufbau S1 (Median) | −228,4 C | −228,4 C |
| Transferbilanz S2 min / Median / max | −58,3 / +2,4 / +57,5 | −95,0 / −0,6 / +47,2 |
| Transferbilanz S2 positiv / negativ | 16 / 16 | 14 / 16 |
| Kader nach dem Fenster (Summe, Median) | 293, 9 | 300, 9 |
| Teams unter 8 | 1 (C-S: 7) | 1 (C-S: 6) |
| Kasse nach dem Fenster Summe / Median / min | 1439,0 / 48,9 / 9,6 | 848,1 / 21,9 / 3,1 |
| Negative Kassen, Notkredite, Notverkäufe | 0, 0, 0 | 0, 0, 0 |
| Neue Kredite im Fenster | 14 | 13 |

Lesart:

* Die Verkäufe sind ins Fenster gewandert (62 → 60, fast gleich viele Teams). Die Summe sinkt um rund 14 %, weil die Spieler
  jetzt nach der Saisonende-Entwicklung und dem Vertragsablauf verkauft werden — andere Werte, andere Kader.
* Saison 1 hat für alle 32 Teams keine Transferbilanz mehr; der Kaderaufbau steht getrennt. S2 verteilt sich um null, etwa
  halb positiv, halb negativ — genau das, was Chris an der alten Rechnung vermisst hatte.
* Die Kasse sinkt deutlich: die **Nachrunde** kauft 27 Spieler (rund 490 C) für offene Plätze. Kader +7 Spieler ligaweit, kein
  Team im Minus, kein Notkredit. Ob die Nachrunde so großzügig sein soll, ist eine Planer-Frage (Rücklage, #1618).
* **C-S bleibt in beiden Läufen unter 8** (Fenster-Start mit 6 Spielern nach Vertragsablauf, Kasse 87 C, 74 C frei; der Planer
  plant keinen Kauf). Das ist kein Effekt des Fensters, sondern der „Pflichtkader 8“ des Planers — in #1618 gebaut
  („Teams unter 8: 0“). Ein Notkauf hier ist ausdrücklich nicht gewollt.

Altstände (Live-Abbild, nur Kopie): `swnjlk` und `hwz8fk` — Saison 1 vorher 32 von 32 Teams negativ (Median −239,3 bzw.
−239,4), jetzt 32 × „—“ mit Kaderaufbau −239,3 bzw. −239,4. S2 jetzt min/Median/max −76,4/−36,8/0 bzw. −111,5/−43,9/0:
in diesen alten Ständen hat die KI am S1-Ende noch nicht verkauft, nur Chris’ eigene Verkäufe zählen auf der Plusseite.

Wertungs-Fingerabdruck: `GESAMT ce8fcef66028 (75 Eintraege)`, unverändert.

## 7. Offene Punkte

1. **„Notrücklage“** gibt es im Spielstand nicht als eigenes Konto; die Rücklage nach Finanzwert liegt in der Kasse. Der
   Kassensturz liest „zuerst Rücklage“ deshalb als „Kasse ≥ 0 heißt: die Rücklage hat das Fenster getragen“. Sollte eine
   echte Notrücklage (getrennter Topf) entstehen (#1618), gehört sie als Stufe vor den Kredit in `fuehreKiKassensturzAus`.
2. **#1618** ändert `vorstand-budgetfreigabe.ts` stark. Beim Rebase den Term `q × Verkaufserloese` durch
   `verkaufserloeseFreiAnteil(q) × Verkaufserloese` ersetzen (Abschnitt 5). Die neue Buchungsart `kaderaufbau` im Kontoauszug
   braucht in `FinanzenModern` (`ART_TEXT`) einen Text, und die neue Finanzseite sollte `finanzen.kaderaufbau` zeigen.
3. **Nachrunde und Kasse** (Abschnitt 6): Planer-Entscheidung, nicht Fenster-Entscheidung.
4. Der Room-Flow springt nach dem Saisonwechsel zu „Verkäufe entscheiden“; „Käufe entscheiden“ bleibt ein eigener Schritt
   danach. Ein gemeinsamer Raum-Schritt „Transfers“ wäre möglich, ist aber eine UI-Frage.

## 8. Aufnahmen

Echte App (Dev-Server, Auto-Export aus) auf einer Kopie des „nachher“-Messstands, Saison 2 vor Spieltag 1, M-M als eigenes
Team; `scripts/screenshot-transferfenster-gemeinsam.ts`, Ordner `docs/design/transferfenster-gemeinsam-18-11/`, je 1920 und 2560:

* `neu-transfermarkt-fenster-*`: Kopfzeile „Kauf offen · Verkauf offen“, Knopf „Erst verkaufen“ neben „Verhandeln“.
* `neu-saisonstand-*` (Ansicht „Verein“): Spalte „Transfers“ = Transferbilanz S2 aus dem gemeinsamen Fenster, verteilt um null.
* `neu-transferhistorie-*`: Top-Verkäufe und Top-Käufe des Fensters, beide unter Season 2.

Nicht aufgenommen: der Saisonrückblick (Inbox-Chronik) und die Historie mit Filter Saison 1 — die Klickfolge im Skript traf die
Bedienelemente nicht. Ihr Inhalt ist durch `tests/transferfenster-gemeinsam.test.ts` (Zeugnis-Zeile, Kaderaufbau-Umrechnung)
abgedeckt; die Aufnahme bleibt offen.
