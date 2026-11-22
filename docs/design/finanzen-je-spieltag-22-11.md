# Finanzen je Spieltag (22.11., Welle 4)

Auftrag (Arbeitsliste 21.11.): „Finanzen je Spieltag buchen (Sponsor-Raten, Heimspiel-Einnahmen, Gehalt, Unterhalt).“
Gehalt, garantierte Sponsor-Basis und Gebäude laufen jetzt in Saisons mit Stempel zu 1/N je Spieltag über die Kasse.
Was vom Endrang oder von einem Ziel abhängt, bleibt am Saisonende.

## 1. Ist-Analyse: alle Geldflüsse

„Heute“ = vor diesem Umbau. N = Spieltage im Spielplan der Saison (`season.matchdayIds.length`; 10 in der Fresh-Fixture, 20 im Battle-Spiel).

| Fluss | Wann heute | Wo im Code | Betrag-Formel | Nachher |
|---|---|---|---|---|
| **Gehalt** | einmal am Saisonende, als Summe | `applySponsorSettlement(deductSalary)` (`lib/sponsor/sponsor-settlement-service.ts`), Log `salary_deduct`; gerufen vom Saisonabschluss (`season-completion-service`) und vom Saisonende-Panel (`cash-prize-apply-service`) | `getTeamActualSalaryTotal` = Σ `resolvePlayerEconomyContract().salary` des Kaders **am Saisonende**, mit Mischrechnung für In-Saison-Verlängerungen (`mischeSaisongehalt`) | **je Spieltag** Σ Gehalt der Kaders an diesem Spieltag / N |
| **Sponsor, Saisonbasis** („garantiert“) | Saisonende | V3-Zeile `base` in `sponsorV3SettlementParts` (`lib/sponsor/sponsor-v3-offer-service.ts`), Sockel der Leiter, unabhängig vom Endrang | `round1(sponsorV3LadderValue(terms, letzter Rang))` | **je Spieltag** Basis / N |
| Sponsor, Tabellenplatz | Saisonende | Zeile `rank` | Leiter(Endrang) − Sockel | bleibt (Endrang unbekannt) |
| Sponsor, Sonderziel | Saisonende | Zeile `special` | Prämie − Sockelabzug, nach Zielerfüllung | bleibt (Erfüllung erst am Ende) |
| Sponsor-Ereignisse (Klausel, Bonus, Reibung) | je Ereignis, beim Spieltagswechsel sofort verrechnet | `maybeGenerateSponsorEvents` (`sponsor-event-service.ts`) | `event.cashDelta` | bleibt |
| Sponsor-Vorschuss (`v4_advance`, nur Altverträge) | bei Unterschrift | `sponsorPayoutLogs` | festgelegter Vorschuss | bleibt |
| **Heimspiel / Zuschauer** | **gibt es nicht als eigenen Fluss.** Die Einnahme aus dem Spielbetrieb ist die Arena (Gebäude `arena_upgrade`) und der Fan-Shop. Das Preisgeld ist Benchmark (`CASH_PRIZE_BENCHMARK_ONLY`, bewegt nie Kasse) | – | – | siehe Gebäude-Einnahme |
| **Gebäude-Einnahme** (Fan-Shop, Arena) | Saisonende | `applyFacilitySeasonEndFinance` (`lib/facilities/facility-season-end-service.ts`), Ereignis `facility_income_collected` | `seasonIncome` der Stufe × Effizienz × Beliebtheit (Arena) × Liga-Faktor | **je Spieltag** Einnahme / N |
| **Gebäude-Unterhalt** | Saisonende | dieselbe Funktion, Ereignis `facility_upkeep_paid` | `calculateFacilitySeasonUpkeep` je gebautem, aktivem Gebäude | **je Spieltag** Unterhalt / N |
| Gebäude Bau, Ausbau, Wartung | sofort bei der Aktion | `facility-upgrade-service`, `facility-maintenance-service` | Stufenpreis, Wartungspreis | bleibt |
| Gebäude-Verschleiß (Zustand), Zahlmarke `lastPaidSeasonId` | Saisonende (kein Geld) | `applyFacilitySeasonEndFinance` | `degradeFacilityCondition` | bleibt am Saisonende |
| Siegprämien (Vorstand) | je Spieltag bei der Ergebnisbuchung | `bucheSiegpraemien` (`legacy-matchday-result-apply-service.ts`) | Stufe × Sieg | schon je Spieltag |
| Treueprämie | bei Verlängerung | `bucheTreuepraemie` | Anteil des neuen Jahresgehalts | bleibt |
| Apron-Abgabe / -Ausgleich | Saisonende | `applyApronSettlement` | Umverteilungstopf, hängt am Endrang aller 32 | bleibt |
| Vorstandsziele (Prämie / Strafe) | Saisonende | `applyTeamSeasonObjectiveRewards` | Zielerfüllung | bleibt |
| Kreditrate (Zins + Tilgung) | Saisonende | `applyLoanSettlement` | Jahresrate | bleibt (Stufe 2, siehe Abschnitt 6) |
| Zahlungsunfähigkeit (Notkredit) | Saisonende | `applyInsolvencyBackstop` | Minus der Kasse | bleibt |
| Transfers (Kauf, Verkauf, Vertragsende), Kreditaufnahme, Buyout, Vertragsauflösung | je Ereignis | `transferHistory`, `loanOriginationLogs`, … | Ablöse | bleibt |
| Preisgeld | nie | `CASH_PRIZE_BENCHMARK_ONLY = true` | – | bleibt 0 |

Die vier fettgedruckten Flüsse sind die, die der Umbau je Spieltag bucht. Alles andere hängt entweder an einem Ereignis oder am Endrang.

## 2. Regel je Fluss

- **Anteil 1/N, N aus dem Spielplan.** `spieltageDerSaison(gameState) = season.matchdayIds.length`, nie hart 20. Kein Spieltag, keine Buchung: die **Saisonpause nach Spieltag 10** ist kein Eintrag in `matchdayIds`, sie löst nichts aus (Test „die Saisonpause ist kein Spieltag“).
- **Gebucht beim Spieltagsabschluss** (`writeLocalMatchdayAdvance` in `lib/season/matchday-progress-service.ts`, nach dem gespielten Spieltag, auch für den letzten), für alle Teams gleich. Es gibt keinen Zweig nach Besitzer, Steuerungsmodus oder Delegation: Mensch, KI und delegiertes Team laufen durch dieselbe Zeile Code.
- **Idempotent je (Saison, Spieltag, Team)** über das Ledger `seasonState.spieltagFinanzen`. Eine zweite Buchung desselben Spieltags findet ihre Zeile und tut nichts (derselbe Spielstand kommt zurück).
- **Kauf und Verkauf mitten in der Saison:** der Betrag richtet sich nach dem Kader **bei der Buchung**. Wer vor dem Abschluss von Spieltag k im Kader steht, kostet k mit; wer vorher geht, kostet k nicht mehr. Nichts wirkt rückwirkend.
- **In-Saison-Verlängerung:** ab dem Spieltag das neue Gehalt. Der Vermerk `inSaisonVerlaengerung` (`spieltageAlt`) legt fest, welche Spieltage noch zum alten Gehalt laufen (`gehaltAmSpieltag`). Die Mischrechnung `mischeSaisongehalt` ist in diesem Modus nicht mehr nötig, weil jeder Spieltag sein Gehalt selbst bucht.
- **Verletzte zahlen weiter:** die Buchung kennt Verletzungen nicht, das Gehalt hängt am Kaderplatz.
- **Rundung:** jeder Betrag auf 0,1 (wie `team.cash`), der Rest wandert als `rest` in die nächste Buchung. Die Saisonsumme weicht höchstens 0,05 vom exakten Jahresbetrag ab, **Kasse = Summe der Ledger-Zeilen bleibt exakt**.
- **Sponsor-Basis:** `sponsorBasisJahr` (dieselbe Zeile `base` wie am Saisonende). Ohne Sponsorvertrag 0.
- **Gebäude:** `berechneGebaeudeSaisonbetraege` (derselbe Rechenweg wie die Saisonende-Vorschau, `buildRows`). Ein Gebäude, dessen Unterhalt diese Saison schon abgebucht ist, zählt nicht noch einmal.

### Was am Saisonende bleibt, und wie es nichts doppelt bucht

| Saisonende-Schritt | Im Modus je Spieltag |
|---|---|
| Sponsor-Abrechnung | Tabellenplatz und Sonderziel wie bisher; die Zeile „Saisonbasis“ bucht nur noch **Basis minus bereits je Spieltag gebuchte Basis** (Normalfall 0, dann kein Log) |
| Gehaltsabzug (`salary_deduct`) | bucht nur noch den **Nachtrag für nicht gebuchte Spieltage** (`ungebuchtesGehalt`, Normalfall 0). Das Log wird **immer** geschrieben, auch mit 0: es ist die Marke „Vertragsjahr abgerechnet“ (`contract-buyout-season-window`) |
| Gebäude (`applyFacilitySeasonEndFinance`) | Verschleiß, Zahlmarke und Ereigniszeilen wie bisher; Geld nur noch für den **ungebuchten Anteil** (`gebaeudeRestAnteil` = (N − gebuchte Spieltage)/N, Normalfall 0). Die Ereigniszeilen tragen dann `cost: 0`, damit `Kasse = Σ Buchungen` stimmt |
| Apron, Vorstandsziele, Kredit, Insolvenz | unverändert |

Fehlt ein Spieltag (Pfad, der den Abschluss umgeht: Skripte, Dry-Runs, Datenreparatur), holt der Saisonabschluss ihn **anteilig** nach. Es gibt weder eine Lücke noch eine Doppelbuchung.

## 3. Stempel und Rückweg

`seasonState.finanzenJeSpieltag = { seasonId, version: "v1" }`, Muster `lib/resolve/wertungs-skalen.ts`:

- gesetzt **beim Anlegen eines Spiels** (`new-game-setup-service.ts`) und **beim Saisonwechsel** (`preseason-workflow-service.ts`), nie mitten in der Saison;
- ein Spielstand ohne Stempel (alle bestehenden) oder mit Stempel einer anderen Saison rechnet seine **laufende Saison bit-identisch alt** zu Ende und wechselt mit dem nächsten Saisonwechsel (`istJeSpieltagSaison`);
- Rückweg `OLY_FINANZEN_JE_SPIELTAG=aus`: neue Saisons bekommen keinen Stempel, gestempelte laufen wie gestempelt zu Ende. Jeder Rechenweg liest den Stempel des Spielstands, den er gerade rechnet (mehrspielertauglich, kein Prozesszustand).

## 4. Leser, die mitziehen mussten

„Gezeigt = gebucht“ und „Kasse = Σ Buchungen“ hängen an diesen Stellen:

| Leser | Anpassung |
|---|---|
| `getTeamActualSalaryTotal` (Finanzseite, GuV, Standings, Kredite) | im Modus: **gebucht + Rest zum heutigen Gehalt** (`saisonGehaltJeSpieltag`). „Gehalt je Saison groß, je Spieltag klein“ bleibt, ohne Mischrechnung |
| `getSeasonSponsorCashByTeam` (GuV, Saisonstand, Prize-Panel) | Vor der Abrechnung: die volle Vorschau (enthält die Basis). Nach der Abrechnung: Logs + Ledger-Basis. So springt die Zahl am Saisonende nicht |
| `buildKontoauszuege` | vier neue Arten je gespieltem Spieltag (Phase `saison`, mit `matchdayId`): `gehalt_spieltag`, `sponsor_basis_spieltag`, `gebaeude_einnahme_spieltag`, `gebaeude_unterhalt_spieltag` |
| `buildTransferFinanceAudit` (Hauptbuch) | neue Spalte `netSpieltagCash` geht in die Abstimmung `cashEnd − cashStart − Σ Kanäle` ein; die Anzeigespalten `salaryPaidOut`/`sponsorCashIn` zählen den Ledger mit |
| `berechneVorstandBudgetStand` | `anfangskasse` rechnet **vor** den Spieltagsbuchungen (sonst schrumpfte die Quote Spieltag für Spieltag). Die harte Grenze `min(Kasse, …)` schützt die echte Kasse |
| `buildPrizeMoneyPreview.projectedCash` („Cash nachher“) | die Saisonzahlen sind die ganze Saison; der schon gebuchte Teil wird abgezogen |
| `buildFinanzSeiteModell` | Prognose zum Saisonende = GuV − Transfers − bereits je Spieltag gebucht; offene Spieltage laufen mit der erwarteten Spieltagsbuchung weiter (`erwarteteSpieltagBuchung`) |
| Finanzen-ViewModel | nach der Abrechnung erscheint die je Spieltag gebuchte Basis in der Aufschlüsselung („Saisonbasis (je Spieltag gebucht)“) |

Bewusst **nicht** in `facilityEvents` und **nicht** in `sponsorPayoutLogs` geschrieben: der Vorstand zählt `facilityEvents` als Transfer-/Investitionsausgabe, und `contract-buyout-season-window` liest `salary_deduct` als „Jahr bezahlt“. Ein eigenes Ledger vermeidet beides.

## 5. Vorstand und KI

- **Gehaltstopf, Rücklage, Freigabe** lesen weiter Saisongrößen: `gehaltsSumme` aus `roster.salary`, Rücklage aus `q × Zielgehalt`, Sponsorerwartung aus `erwarteterSponsorFuerPlanung`. Nichts davon hängt am Kontostand eines Spieltags. Der Gehaltstopf bleibt bei höchstens 75 % Kürzung.
- **Transfertopf:** `anfangskasse` addiert die Spieltagsbuchungen zurück (Test „Vorstands-Freigabe“): `freigegebenGesamt` ist nach fünf Spieltagen unverändert, `nochFrei` kann nur durch die echte Kasse sinken. Vorstandsstufe und Quote ändern sich dadurch nicht.
- **KI-Käufe:** die großen Kauffenster (Saison-Draft, Vorsaison, Saisonende-Fenster) liegen **vor Spieltag 1** oder **nach dem Saisonabschluss**. Dort steht die Kasse im neuen Modus auf demselben Wert wie im alten (Summengleichheit, Abschnitt 7). Die Rücklage `resolveTeamCashRunwayReserve` rechnet auf das Jahresgehalt, nicht auf die Restsaison. Mitten in der Saison kauft die KI nur in Einzelfällen (In-Saison-Verlängerung, Reha-Bau); dort ist die Kasse die echte, bereits belastete.
- **Verändert:** Teams, deren Basis-Sponsor kleiner ist als ihr Gehalt, rutschen jetzt **vor** dem Saisonende ins Minus, wo sie vorher erst am Abschluss gebucht wurden (Tiefststand, Abschnitt 7). Folgen: `isSellerDistressed` (Kasse < 0) kann Notverkäufe früher auslösen, die Finanzseite zeigt „Im Minus“. Das ist gewollt (echter Kassenverlauf, wie im Football Manager), aber messbar; siehe die Zahlen unten.

## 6. Offen und bewusst nicht gebaut

- **Kreditrate je Spieltag:** Zins und Tilgung sind ein großer Block am Saisonende. Je Spieltag zu buchen wäre derselbe Weg (Stufe 2), berührt aber Tilgungsplan, Notkredit-Rücknahme und die Kredit-Anzeige. Nicht Teil dieser Runde.
- **Apron und Vorstandsziele** hängen am Endrang bzw. an Zielen und bleiben am Ende.
- Die Saison-Prognose (`prognoseEnde`) nimmt die heutigen Jahresbeträge als konstant an; ein Kauf oder Bau mitten in der Saison verschiebt sie ab dem nächsten Abschluss.

## 7. Prüfung

Siehe Abschnitt „Messung“ unten und `tests/finanzen-je-spieltag.test.ts`:

- Stempel/Schalter (4 Fälle), Idempotenz, Pause, Mensch = KI, Kasse = Σ Ledger, Summengleichheit alt/neu (Gehalt ± 0,05, Endkasse ± 0,15 je Team), Nachbuchung fehlender Spieltage, Verkauf, Kauf, In-Saison-Verlängerung, Kontoauszug, Vorstands-Freigabe.
- `tests/economy-cashflow-invariant.test.ts` läuft unverändert im alten Modus (Fixture ohne Stempel) und bleibt grün; der neue Modus ist in `finanzen-je-spieltag.test.ts` an derselben Invariante gemessen.
- Wertungs-Fingerabdruck `GESAMT eaafed96150e` unverändert (die Engine ist nicht angefasst).

## 8. Messung (32 KI-Teams, Battle, 20 Spieltage, `scripts/miss-teamfinanzen-saison.ts`)

Zwei Komplettläufe desselben Draft-Standes enden auf verschiedenen Rängen (die Spieltage laufen nicht reproduzierbar, 17 von 32 Endrängen gleich). Ein Vergleich der Endkassen aus zwei Läufen misst deshalb Würfelrauschen (Summe 695,7 gegen 705,6, im Mittel 2,3 C je Team). Aussagekräftig ist die **paarweise** Messung (`scripts/miss-finanzen-je-spieltag-saisonende.ts`): ein gespielter Stand nach Spieltag 20 wird einmal wie er ist abgeschlossen („neu“) und einmal auf den alten Weg zurückgebaut (Kasse minus Ledger, Stempel weg, „alt“).

| Größe | alt | neu |
|---|---:|---:|
| Σ Kasse nach Saisonabschluss (32 Teams) | 705,5 | 705,6 |
| größte Abweichung je Team | | 0,1 (Rundung) |
| Teams mit Abweichung über 0,15 | | 0 von 32 |
| Endrang gleich | 32 von 32 | |
| Σ Kasse nach Saisonende-Kette | 1836,33 | 1836,43 |
| Σ Kasse **vor** dem Abschluss | 530,7 | 140,9 |
| Teams mit negativer Kasse vor dem Abschluss | 0 | 8 |
| negativ nach Abschluss / nach Kette | 3 / 0 | 3 / 0 |

**Tiefststand** (Kasse über die 20 Spieltage, ungepaarter Lauf): Mittel 3,4 C (alt 13,9), tiefster Wert −42,9 C (alt +3,9), 91 Team-Spieltage im Minus (alt 0), acht Teams zwischendurch negativ (Z-H −42,9, H-R −37,1, N-N −24,2, N-W −11,9, R-L −10,4, V-D −7,4, B-P −6,3, D-P −2,2). Das sind Teams, deren Basis-Sponsor kleiner ist als ihr Gehalt; der Rangbonus kommt erst am Ende und holt sie über den Abschluss zurück (3 bleiben im Minus, der Notkredit-Schritt der Kette fängt sie wie bisher).

**KI-Käufe** (Kaufphase Saison 2 aus dem paarweisen Stand): 97 Käufe, 63 Verkäufe, 504 Aktionen in beiden Wegen, **kein Team mit anderer Kaderänderung**; Kasse vor dem Kauf höchstens 0,1 C Abweichung, danach sechs Teams bis 1,07 C (Preisrauschen). Der Folgesaison-Stempel steht (`season-2`).

**Verändert und offen:** die KI-Verlängerung mitten in der Saison liest die Kassenlage. Im ungepaarten Lauf gab es neu 56 Verlängerungen (15 Teams, 8 Gebäude-Upgrades) gegen 90 (22 Teams, 11 Upgrades) alt; das Rauschen zwischen zwei Läufen ist nicht gemessen, die Richtung passt aber zur niedrigeren Kasse. Falls das stört: die Prüfung auf die Kasse vor den Spieltagsbuchungen stellen (`kasse + Σ Ledger`), wie es der Vorstand schon tut.

Aufnahmen aus der echten App (Finanzseite nach Spieltag 8, Team H-R): `docs/design/finanzen-je-spieltag-22-11/` (Übersicht, Station, Kontoauszug; 1920×1080 und 2560×1440). Sichtprüfung: Kassenverlauf mit gebuchten Spieltagen und erwarteter Spieltagsbuchung, Kontoauszug mit Zeilen „Gehalt Spieltag k/20“ und „Sponsor-Basis Spieltag k/20“, Posten „Schon je Spieltag gebucht“ gleicht die Saisonende-Erwartung ab. Kein Überlauf, kein abgeschnittener Text.

## 9. Rang-Abschlag (Entscheidung 22.11.)

Chris, 22.11.: Variante a. Problem aus Abschnitt 8: Teams mit kleiner Sponsor-Basis rutschten mitten in der Saison ins Minus, weil die Rangprämie erst am Saisonende kam.

**Regel.** Je gebuchtem Spieltag k zahlt der Sponsor einen Abschlag auf die Rangprämie (Zeile „Tabellenplatz“, Leiter(Platz) minus Sockel):

    Abschlag_k = 0,8 x (Leiter(Platz nach Spieltag k) - Sockel) / N        N = spieltageDerSaison(gameState)

- Platz = Tabellenplatz nach dem Spieltag (`sponsorRangFuerAbschlag`, dieselbe Zeile `rank` wie die Saisonabrechnung). Ohne gewerteten Stand liefert die Übersicht den Vorjahres-/Startrang, sonst der Startrang des Vertrags, sonst Ligamitte. 80 % statt 100 %, damit der Schlussausgleich selten zurückfordert.
- Gebucht im selben Ledger und Stempel wie der Rest (`finanzenJeSpieltag`, Rückweg `OLY_FINANZEN_JE_SPIELTAG=aus`): neue Felder `rangAbschlag` und `rang` je Ledger-Zeile, `cashDelta` enthält den Abschlag. Gebuchte Spieltage bleiben. Saisonpause = kein Spieltag = kein Abschlag. Ohne Sponsorvertrag 0.
- **Schlussausgleich** am Saisonende = Rangprämie(Endrang) minus Summe der Abschläge, als Zeile „Rangprämie Schlussausgleich“ (Kontoauszug-Art `rang_schlussausgleich`). Darf negativ sein (zieht dann von der Kasse ab; die Zeile bleibt auch bei Prämie 0 / Platz 32 erhalten). Summe Abschläge + Ausgleich = Prämie exakt (alles auf 0,1). Sonderziel bleibt komplett am Ende.
- Mensch, KI und delegierte Teams laufen durch dieselbe Zeile Code; Besitz und aktives Team spielen keine Rolle (kein `teams[0]`).

**Anzeige (gezeigt = gebucht).** Kontoauszug: „Rangprämie Abschlag Spieltag k/N (Platz x)“ und „Rangprämie Schlussausgleich“. Prognose (`erwarteteSpieltagBuchung`) rechnet offene Spieltage mit dem aktuellen Platz weiter; die Saisonende-Erwartung (GuV minus gebucht) zeigt nur den Rest. Sponsor-Aufschlüsselung nach der Abrechnung: „Tabellenplatz (Abschläge je Spieltag)“. Hauptbuch-Abstimmung zählt die Abschläge als Sponsor-Zufluss.

**KI-Verlängerung (offener Punkt aus Abschnitt 7).** `buildPreviewRow` (`lib/contracts/contract-renewal-service.ts`) urteilt mit `kasseVorSpieltagsbuchungen`: Kasse minus Summe der Ledger-`cashDelta`, wie `anfangskasse` des Vorstands. Das gilt nur, solange die Saisonabrechnung des Teams nicht gebucht ist (`spieltagBuchungenNochOffen`); danach enthält die Kasse schon alles, und eine Rückrechnung wäre doppelt. Dieselbe Bedingung gilt jetzt auch im Vorstand (`berechneVorstandBudgetStand`): ein erster Messlauf zeigte, dass die Rückrechnung nach der Abrechnung (Saisonende-Kette, vor dem Saisonwechsel) die Kette um 234 C Σ Kasse verschob und 11 Teams anders kaufen ließ; mit der Bedingung ist die Kette gleich dem Altmodus. Die harten Grenzen (Vorstands-Freigabe, Kaufprüfung) rechnen weiter mit der echten Kasse.

### Messung nach dem Rang-Abschlag

Ungepaarter Lauf (`scripts/miss-teamfinanzen-saison.ts`, 2 Saisons) und paarweise Messung (`scripts/miss-finanzen-je-spieltag-saisonende.ts`, `kauf`), 22.11.:

| Größe | vorher (Abschnitt 8) | mit Rang-Abschlag |
|---|---:|---:|
| Teams mit negativer Kasse mitten in der Saison (Saison 1 / 2) | 8 | 4 / 3 |
| Tiefststand Saison 1 | −42,9 C | −11,6 C (Saison 2: −6,8 C) |
| Team-Spieltage im Minus | 91 | 36 (Saison 2: 17) |
| Mittlerer Tiefststand je Team | 3,4 C | 11,5 C (Saison 2: 11,0 C) |
| Teams im Minus direkt vor dem Abschluss (paarweise) | 8 | 3 (tiefster −14,6 C) |
| Σ Kasse nach Saisonabschluss, alt / neu | 705,5 / 705,6 | 718,0 / 718,2 |
| größte Abweichung je Team nach Abschluss | 0,1 | 0,1 (0 Teams über 0,15) |
| Σ Kasse nach Saisonende-Kette, alt / neu | 1836,33 / 1836,43 | 1763,9 / 1764,1 (0 Teams über 0,15) |
| Endrang gleich | 32 von 32 | 32 von 32 |
| KI-Kaufphase Saison 2: Käufe / Verkäufe / Aktionen | 97/63/504 in beiden Wegen | 99/67/504 alt, 98/67/504 neu |
| Teams mit anderer Kaderänderung | 0 | 1 von 32 (Käufe 99 gegen 98, Preisrauschen) |

Die Läufe sind verschiedene Spielstände (Spieltage nicht reproduzierbar); verglichen werden deshalb Größenordnungen, die paarweisen Zeilen sind exakt. Ehrlich: es bleiben 3 bis 4 Teams zwischendurch im Minus (sehr kleine Basis, tiefer Platz), nur deutlich flacher. Weitere Senkung wäre über die Quote (80 %) möglich, nicht gebaut.

**KI-Verlängerungen mitten in der Saison.** Zählung im Saison-1-Lauf: 49 In-Saison-Verlängerungen bei 19 Teams (vorher im Neu-Modus 56 bei 15 Teams, im Altmodus 90 bei 22 Teams; das Rauschen zwischen Läufen ist nicht gemessen, ein Altmodus-Gegenlauf scheiterte an vollem Datenträger). Saison 2: 17 bei 10 Teams. Belegt ist die Rückrechnung deshalb vor allem über den Test „Kasse für KI-Entscheidungen“: die Kassenwache sieht dieselbe Zahl wie im Altmodus.

Aufnahmen (echte App, Team H-R nach Spieltag 8, 1920x1080 und 2560x1440): `docs/design/finanzen-je-spieltag-22-11/`. Gesehen: Kontoauszug mit „Rangprämie Abschlag Spieltag k/20 (Platz 6)“ je Spieltag, Stationsblatt mit der Zeile, Kassenverlauf mit erwarteter Buchung inklusive Abschlag (−0,8 je Spieltag), Fußzeile mit neuem Erklärtext. Kein Überlauf, kein abgeschnittener Text. Abweichung: das Aufnahme-Team hat nach dem Draft nur 0,9 C Kasse (Draft-Artefakt), daher „Saisonende im Minus“; die Schlussausgleich-Zeile erscheint erst nach dem Saisonabschluss und ist nur im Test belegt.
