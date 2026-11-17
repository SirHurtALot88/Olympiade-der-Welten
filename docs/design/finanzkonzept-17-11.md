# Finanz- und Sponsorenkonzept — „Spieltags-Kreislauf"

Stand 17.11.2026 · nur Konzept, kein Code, keine Spielstand-Änderung · Auftrag Chris: „die finanzen könnten wir auch
überarbeiten dass teams wirklich geld pro spieltag ausgeben, cash rein kommt, man ggf. reagieren kann" und „arbeite mal ein
finanzkonzept aus auf basis dessen was wir bisher haben, vllt hast du ja sogar bessere ideen als ich mit nur den sponsoren?"

**Methode.** Teil 1 liest den Code (Datei:Zeile, nichts vermutet) und misst am Live-Abbild (`origin/live-save`, Abbild
vom 17.11.2026 23:30 UTC, nur gelesen, Kopie im Scratch-Verzeichnis). Alle Geldbeträge sind Spiel-Einheiten „C".
Der aussagekräftigste Spielstand ist `new-game-1787123325719-swnjlk` (Saison 2, alle 10 Spieltage gebucht, Stand 14.10.);
als Gegenprobe dienen `…-1hf25q` (der alte Kassendefizit-Fund, Saison 2) und `…-hwz8fk`. Der jüngste Spielstand
`…-0dwpok` steht noch auf Saison 1, Spieltag 1 und taugt nur für die Startkasse.

---

## 0. Kurzfassung

1. **Heute bewegt sich die Kasse während der Saison fast gar nicht.** Sponsor-Auszahlung, Gehälter, Kreditrate, Apron,
   Vorstandsprämien und Gebäude werden alle in einem Block am Saisonende gebucht. Zwischen Spieltag 1 und 10 ändern nur
   Transfers, Gebäude-Käufe und eine 12-%-Würfelei der Sponsor-Ereignisse (±2 bis +4 C) den Kontostand.
2. **Die Ökonomie ist im Jahr gesund, im Verlauf blind.** Liga-Summe Sponsor 2167,9 C gegen Gehälter 1793,6 C (Deckung 1,21);
   Median-GuV +15,2 C. Aber: nur 1 von 32 Teams hat überhaupt Gebäude, Beliebtheit schwankt nur 0,95–1,07, und
   die Kasse korreliert **gegen** den Erfolg (Rang↔Kasse +0,42: wer schlechter platziert ist, hat mehr Geld).
3. **Es gibt kaum Senken und keine Einnahmen außer Sponsoren.** Die Liga-Kasse wächst von Σ 226 C (Saison-1-Start) auf
   Σ 1040 C (Saison-2-Ende). Kein Ticketing, kein Merchandising, kein TV-Geld, keine Spieltagsprämie.
4. **Das Konzept:** die jährlich kalibrierte Summe bleibt (Chris' 1,1-Ausschüttung, Rubberband), wird aber in einen
   **Spieltags-Kreislauf** zerlegt — Gehälter und Sponsor-Sockel laufen in zehn Raten, dazu kommen Zuschauer/Ticketing,
   Merchandising (Stars), Ligageld und Spieltagsprämien, getrieben von einer neuen kurzen **Fan-Stimmung** über der
   langsamen Beliebtheit. Dazu Hebel für den Spieler (Ticketpreis, Sparkurs, Dispo, Notverkauf, Sponsor-Angebote,
   Spielerbonus) und ein KI-Verhalten, das auf Kasse und Schuldenlast reagiert.
5. **Sechs Wellen**, jede einzeln lieferbar: W0 Kontoauszug und Messlauf, W1 Taktung (rein zeitlich, summen-neutral),
   W2 Einnahmen, W3 Reaktionshebel, W4 Sponsoren neu, W5 Ereignisse/KI/Form-Moral-Kopplung. Rund 17–26 Agenten-Tage.

---

## 1. IST-Analyse

### 1.1 Alle heutigen Geldflüsse

| Fluss | Wann gebucht | Größenordnung (swnjlk, Saison 2) | Wo im Code |
|---|---|---|---|
| **Sponsor-Auszahlung** (V3-Leiter: Sockel nach Startrang + Wertungstopf nach Endrang, dazu Achsen und Sonderziel) | **nur Saisonende** | Σ 2167,9 · Ø 67,7 · Spanne 43,7 bis 122,8 | `lib/sponsor/sponsor-settlement-service.ts:13` (`SponsorSettlementPhase = "season_end"`), `lib/sponsor/sponsor-v3-model.ts:101` (Absatz „ES GIBT KEINEN SPONSOR-VORSCHUSS MEHR") |
| Höhe der Ausschüttung | Konstanten | `SPONSOR_AUSSCHUETTUNG = 1,1`; Sockel 19,8 bis 52,8; Wertungstopf 1133 bei Faktor 1,0 | `lib/sponsor/sponsor-liga-leiter.ts:57,60,62,64` |
| **Gehälter** | Saisonende, als Zeile `salary_deduct` im selben Sponsor-Buchungslauf (auch ohne Vertrag) | Σ −1793,6 · Ø −56,0 · Spanne −30,5 bis −97,6 | `lib/sponsor/sponsor-settlement-service.ts:174-189` |
| **Sponsor-Ereignisse** (Aktionsbonus +3 bis +6, Klausel −1,5 bis −3, Partner-Reibung −2) | beim Spieltagswechsel, sofort, Würfel `roll ≤ 0,12` je Team und Spieltag | Σ +26,0 in Saison 2 (37 Ereignisse, 24 Teams betroffen) | `lib/sponsor/sponsor-event-service.ts:45-72`, Aufruf `lib/season/matchday-progress-service.ts:307` |
| **Apron** (Umverteilung Gehaltsüberhang → Teams unter Linie 1) | Saisonende, nach Sponsor | Σ 0,0 (Nullsumme) · Spanne −21,2 bis +1,2 | `lib/season/apron-settlement-service.ts`, Konjunkturhebel `lib/finance/apron-konjunktur-hinweis.ts` |
| **Vorstandsziele** (Prämie/Strafe) | Saisonende, im „Schwanz" | Σ +133,0 · Ø +4,2 · Spanne −3 bis +9 | `lib/season/season-end-tail-settlement.ts`, `lib/board/team-season-objectives-service.ts:2688` |
| **Kredite** (Bank + Team-zu-Team, Zins 7–20 %, Annuität, Notkredit) | Aufnahme nur Preseason; Rate am Saisonende **vor** Gebäuden | Zins Σ −41,3 · Tilgung Σ −34,2; 12 aktive Kredite, alle Team-zu-Team | `lib/finance/loan-service.ts:17-26,514,811`; „Kein Mid-Season-Kredit" in `docs/design/kredit-system.md` |
| **Gebäude** (8 Typen; Einnahme nur Fan-Shop und Arena, Stufe 5: +25,0 bzw. +28,5 C/Saison) | Einnahme und Unterhalt am Saisonende; Upgrade sofort bei Kauf | Σ Einnahme 3,9 · Σ Unterhalt −1,1 | `lib/facilities/facility-catalog.ts:167-205`, `lib/facilities/facility-effects.ts:133`, `lib/facilities/facility-season-end-service.ts` |
| **Beliebtheit** (Erfolg 0,5 + FanFavorite 0,3 + Starpower 0,2, Clamp 0,5–1,5) | skaliert nur die Arena-Einnahme; wird nur am Saisonübergang fortgeschrieben | live 0,947 bis 1,068 | `lib/economy/team-beliebtheit.ts:37-45,660` |
| **Transfers** (Kauf/Verkauf, Marktwert) | sofort bei Geschäft; keine GuV-Position | S1: 341 Käufe, 5 Verkäufe; S2: 59 Käufe | `lib/market/transfermarkt-local-service.ts:2851,3542`, Ausschluss aus der GuV `lib/finance/season-end-guv.ts:25-30` |
| Preisgeld | **abgeschafft** (`CASH_PRIZE_BENCHMARK_ONLY`), nur Anzeige-Kurve | wird nie ausgezahlt | `lib/season/cash-prize-benchmark-flag.ts` |
| Vertragsauflösung, Kündigungsabfindung | sofort bei Aktion | selten | `lib/morale/contract-dissolution-service.ts:338` |

**Die EINE GuV** (Chris: „überall dieselbe Zahl"): `Sponsor + Sponsorereignisse + Gebäude-Einnahme + Apron + Boardziele −
Gehälter − Gebäude-Unterhalt − Kreditzins`; Transfers und Tilgung stehen daneben, zählen nicht
(`lib/finance/season-end-guv.ts:23-30`, Posten-Schlüssel Zeile 75-86, Beschaffung `lib/finance/season-guv-resolver.ts`).

**KI-Finanzverhalten heute:**

- Finanz-Vorsicht als Strategie-Achse `cashPriority` (1–10, pro Team-Profil, z. B. 3 bis 10) in
  `lib/foundation/team-strategy-profiles.ts`; sie dämpft Kreditbereitschaft (`ai-loan-decision-service.ts`, Bereitschaft
  fällt je Punkt über 5 um 10 %, Hoarder ×0,6) und Kaufbudget (`chunked-redraft-topup-service.ts:1076,1105`: bis 28 % Kürzung).
- Rücklage/Liquiditätsziel: `lib/ai/planner-cash-buffer-policy.ts`, `ai-team-cash-reserve-service.ts`.
- Schulden-Frühwarnung: `lib/ai/schuldenlast-fruehwarnung.ts` misst den ungedeckten Anteil der nächsten Abbuchung
  (Gehalt + Kreditrate gegen Cash + Jahresumsatz) und gibt der KI Verkaufsdruck.
- **Kein Zwangs-Notkredit mehr**: nach Chris („teams können auch ins negative gehen und müssen das dann mit verkäufen und
  krediten wieder auffüllen! es darf nicht einfach geld erschummelt und auf 0 gesetzt werden") entfernt
  (`lib/finance/notkredit-ruecknahme.ts:1-30`; heute nur noch Feststellung in `collectNegativeCashTeams`,
  `lib/season/season-end-tail-settlement.ts`).

### 1.2 Zeitprofil der Kasse

Eine Saison hat **10 Spieltage mit je 2 Disziplinen** (`disciplineSchedule` 10 Einträge, `disciplineResults` 640 = 20 × 32).
Es gibt keinen Heim-/Auswärts-Begriff: alle 32 Teams starten in jeder Disziplin und werden gerankt (der Eintrag in
`schedule` ist ein einzelner Fixture-Platzhalter je Spieltag). Das ist für Ticketing wichtig: Zuschauer hängen am
**eigenen Abschneiden und an der Stars-Besetzung**, nicht an einem Heimspiel.

```
Saisonstart  ──── Spieltag 1 … 10 ────────────────────  Saisonende
Kasse:  Kader-/Gebäude-Käufe          nur ±Ereignis    │ ALLES: Sponsor, Gehalt, Rate, Apron,
        (sofort)                      (12 %/Team/Tag)  │ Board, Gebäude → ein Block
```

Folge: Teams fahren die ganze Saison mit **konstanter Kasse**, die Gehaltsabbuchung kommt als Schlag. Das erklärt Chris'
Eindruck „teams geben gar kein geld pro spieltag aus". Es erklärt auch die Vorstandsziel-Kalibrierung
(`lib/board/board-objective-league-calibration.ts:5-12`: „Cash ist ein Bestand, der während der Saison nur FÄLLT — Sponsorgeld,
Apron und Gebäude werden erst am Saisonende gebucht").

### 1.3 Zahlen aus dem Live-Abbild

**Kasse am Saisonende (nach Abrechnung), Saison 2, je 32 Teams**

| Spielstand | min | Median | Ø | max | σ | Teams < 0 | Σ Kasse |
|---|---:|---:|---:|---:|---:|---:|---:|
| swnjlk (aktuell, 14.10.) | 0,6 | 32,5 | 32,5 | 86,7 | 20,1 | 0 | 1040 |
| hwz8fk | −0,3 | 26,0 | 29,1 | 90,1 | 22,8 | 1 | 931 |
| 1hf25q (alter Defizit-Fund) | −31,2 | 16,1 | 9,2 | 41,1 | 19,6 | **9** | 295 |

**Startkasse nach dem Kaderbau, Saison 1 Spieltag 1** (`0dwpok`, 32 Teams): 3,2 bis 10,9, Median 6,5, Σ 226. Das Startbudget
170 bis 325 C (Σ 7920) geht fast vollständig in den Kaderkauf (341 Käufe in Saison 1) — Vermögen steckt in Spielern,
nicht in Cash.

**GuV-Posten, swnjlk, Saison 2** (Summe über 32 Teams · Ø · Spanne)

| Posten | Σ | Ø | min | max |
|---|---:|---:|---:|---:|
| Sponsor | 2167,9 | 67,7 | 43,7 | 122,8 |
| Sponsor-Ereignisse | 26,0 | 0,8 | −5,0 | 7,5 |
| Gebäude-Einnahme | 3,9 | 0,1 | 0 | 3,9 |
| Apron | 0,0 | 0,0 | −21,2 | 1,2 |
| Vorstandsziele | 133,0 | 4,2 | −3,0 | 9,0 |
| Gehälter | −1793,6 | −56,0 | −97,6 | −30,5 |
| Gebäude-Unterhalt | −1,1 | 0,0 | −1,1 | 0 |
| Kreditzins | −41,3 | −1,3 | −10,1 | 0 |
| **GuV** | **+496** | **+15,5** (Median 15,2) | **−27,4** | **+77,6** |

Dazu: Tilgung −34,2 (Bilanz, nicht GuV). Sponsor/Gehalt-Deckung je Team: min 0,66 · Median 1,22 · max 2,39; **7 von 32 Teams**
decken ihr Gehalt nicht aus dem Sponsor. 6 von 32 haben negative GuV.

**Nach Tabellenplatz** (Mittel je 8 Teams, swnjlk)

| Rang | Kasse | GuV | Sponsor | Gehalt |
|---|---:|---:|---:|---:|
| 1–8 | 22,2 | +23,7 | 80,2 | −59,9 |
| 9–16 | 23,4 | +9,3 | 75,0 | −66,2 |
| 17–24 | 43,1 | +12,7 | 61,3 | −54,7 |
| 25–32 | 41,4 | +16,2 | 54,6 | −43,4 |

Korrelation Rang ↔ Kasse **+0,42** (positiv = Schlechtere haben mehr), Rang ↔ GuV −0,11. Das ist kein Rangtreue-Thema,
sondern der gewollte Rubberband (Sockel nach Startrang: schwache Teams haben billige Kader) — nur wirkt er so stark, dass
Geld **kein** Erfolgsindikator ist.

**Nach Startbudget-Oktile** (Baustelle „GuV-Kalibrierung: Liga-1-Einnahmen wachsen nicht mit dem Budget-Niveau",
Task #105, im Repo ohne eigenes Dokument — `docs/design/arbeitsplan-16-11.md:96`, N7: „unklar"):

| Budget-Gruppe | Ø Budget | Sponsor | Gehalt | GuV | Kasse |
|---|---:|---:|---:|---:|---:|
| Top 8 | 308 | 76,9 | 66,7 | +11,8 | 34,8 |
| 9–16 | 268 | 70,6 | 65,3 | +9,3 | 28,9 |
| 17–24 | 228 | 68,3 | 50,2 | +22,9 | 36,1 |
| 25–32 | 188 | 55,2 | 42,0 | +17,9 | 30,2 |

Zwischen unterster und oberster Budget-Gruppe wächst das Gehalt um **+59 %** (42,0 → 66,7), der Sponsor nur um **+39 %**
(55,2 → 77,0). Korrelationen: Budget↔Gehalt 0,77, Budget↔Sponsor 0,48, Budget↔GuV −0,22. Genau das ist das Befund-Muster der
Kalibrierungs-Aufgabe: die reichen Teams geben mehr aus, als ihre Einnahmen mitwachsen. In `1hf25q` (vor der Ausschüttung
1,1) waren es Top-8: Sponsor 75,1 gegen Gehalt 75,9, also GuV +1,7, und die Plätze 17–24 lagen bei −10,3.

**Sonstiges Messbare**

- Mitten in der Saison bewegte sich die Kasse in Saison 2 nur durch 37 Sponsor-Ereignisse (Σ +26,0; Aktionsbonus Σ +112
  über beide Saisons, Klausel −54,5, Partner-Reibung −32,0).
- Gebäude: `teamFacilities` enthält nur **1 von 32** Teams (das menschliche V-W). Die KI baut nichts: Σ Einnahme 3,9 C gegen
  Sponsor 2167,9 C.
- Ausreißer: D-P (Rang 4) mit Sponsor 122,8 und GuV +77,6; M-M (Rang 14) −27,4; Z-H (Rang 17) −24,9, Kasse 0,6.
- Liga-Kasse wächst von 226 (S1-Start) auf 1040 (S2-Ende) — rund +500 C GuV je Saison, ohne Senke.

### 1.4 Befunde

| # | Befund | Beleg |
|---|---|---|
| B1 | Kein Geld fließt pro Spieltag; Gehalt kommt als Schlag am Ende. | 1.1/1.2, `sponsor-settlement-service.ts:13,174` |
| B2 | Es gibt nur **eine** Einnahmequelle (Sponsor, 91 % der positiven Posten); Gebäude praktisch tot. | Σ Sponsor 2167,9 gegen Σ Gebäude 3,9; 1 von 32 Teams mit Gebäudezustand |
| B3 | Beliebtheit ist als Hebel wirkungslos (0,95–1,07 statt 0,5–1,5, wirkt nur auf Arena, nur am Saisonübergang). | `team-beliebtheit.ts:44-45,660`, Live-Werte |
| B4 | Geld ist kein Erfolgsindikator (Rang↔Kasse +0,42, Top-8 Kasse 22 gegen Schlussgruppe 41). | 1.3 |
| B5 | Liga-Überschuss ohne Senke (+500 C/Saison); Kasse „stapelt" sich. | 1.3 |
| B6 | Gehalt wächst stärker mit dem Budget als der Sponsor (+59 % gegen +39 %). | 1.3 |
| B7 | 7 von 32 Teams decken Gehalt nicht aus Sponsor (Deckung 0,66); in `1hf25q` 9 Minus-Teams (vor Ausschüttung 1,1). | 1.3 |
| B8 | Kredit nur Preseason; während der Saison gibt es keinen Puffer. Ein Team kann mitten in der Saison nichts tun. | `kredit-system.md` („Kein Mid-Season-Kredit") |
| B9 | Training ist kostenlos in Cash (nur Gebäude-Upgrades kosten); Sparkurs hat heute nichts zu sparen. | `lib/training/*`, kein Cash-Posten gefunden |

### 1.5 Was es heute NICHT gibt (und was parallel entsteht)

- **Keine Spieler-Form.** Es gibt Formkarten (Team-/Disziplin-Karten, `seasonState.formCards`, 656 Stück) und den Ermüdungswert
  (`fatigue`), aber keine Form je Spieler. Form + Moral je Spieler wird gerade parallel gebaut (Branch
  `origin/backup/form-moral-17-11`); dieses Konzept hängt **nur lose** daran (Welle 5).
- **Moral existiert nur als Vertrags-/Wunschsystem**: `lib/morale/player-morale-service.ts` (1122 Zeilen:
  Stimmung, Gehaltsmodifikator, Verlängerungsrisiko), `player-demands-service.ts` (Wünsche mit `moraleReward`/`moralePenalty`,
  `olyDataTypes.ts:269-287`), Kapitän, Vertragsauflösung; `training-mode-demand-service.ts` liefert den Trainings-Wunsch.
  Keine Spieltags-Dynamik und keine Geldkopplung.
- Kein Ticketing, kein Merchandising, kein TV-/Ligageld, keine Spieltagsprämie, keine Spieler-Boni, keine Reise-/Arena-Betriebskosten.
- Verletzungen gibt es (`injuryEvents`, 4846 Einträge, Ermüdungsrisiko), aber ohne finanzielle Folge.
- Kein Kontoauszug: es gibt Logs (`sponsorPayoutLogs`, `loanApplyLogs`, `objectiveRewardApplyLogs`), aber keine einheitliche
  Buchungsliste je Team und Spieltag.

---

## 2. Konzept „Spieltags-Kreislauf"

### 2.1 Leitplanken (aus dem Bestand und aus Chris' Entscheidungen)

1. **Die Jahressumme bleibt, das Profil ändert sich.** Wellen 0 und 1 dürfen die Saison-GuV je Team nicht verschieben
   (±0,5 C Abweichung). Neue Quellen (W2) werden gegen Sponsor-Anteile gegengerechnet, nicht addiert, bis ein bewusster
   Mehr-Umsatz beschlossen ist (Chris hat die 10 % Mehrausschüttung selbst gesetzt, `sponsor-liga-leiter.ts:35-56`).
2. **Kein erschummeltes Geld.** Negativer Kontostand ist erlaubt und muss durch Verkauf, Kredit oder Sparen gelöst werden
   (Notkredit-Entscheidung, siehe 1.1). Der Dispo ist ein **Kredit mit Zins**, kein Geschenk.
3. **Eine GuV.** Jeder neue Posten läuft in `season-end-guv.ts` ein (Posten-Liste Zeile 75-86) und steht im Hover „auch bei 0".
4. **Mehrere Wege zum Erfolg** (Design-Leitlinie aus CLAUDE.md): jede Geldfrage hat einen Primärweg und Nebenwege — wer weniger
   Tickets verkauft, kann Merchandising, Sponsor oder Verkauf nutzen.
5. **Die Wertungs-Engine bleibt unberührt.** Der Fingerabdruck (`scripts/pruefe-wertung-fingerabdruck.mjs`, GESAMT
   e80babacb68c) darf sich durch Finanz-Wellen nicht ändern; Kopplungen an die Leistung laufen über **Eingänge** (Rang, Form,
   Verletzung), nie über Rückwirkung auf Disziplin-Mechanik. Die rho-Abnahme (0,75 / 0,80 / 0,85) und die Pp-Prüfung
   bleiben deshalb unberührt.
6. **Kein Eingriff in die Eignungsmatrix**, keine neuen PixelLab-Assets: Wellen sind reine Daten- und Oberflächenarbeit.

### 2.2 Der Kreislauf je Spieltag (Median-Team, Größenordnung)

Bezugsbild heute: Sponsor 63,3 (Median) + Board 4,2 + Ereignisse 0,8 = ca. 68 Einnahmen; Gehalt 54,5 + Zins 1,3 = ca. 56
Ausgaben; GuV Median +15,2. Das Zielbild **zerlegt** die Einnahmen, es erhöht sie nicht:

| Posten | Richtung | Taktung | Soll-Jahr (Median) | je Spieltag | Treiber |
|---|---|---|---:|---:|---|
| Gehälter | − | 10 Raten | 54,5 | 5,5 | Kader, Vertragsform (front/back-loaded: Jahr-1-Rate, nicht Mittel, wie `getTeamActualSalaryTotal`) |
| Kreditrate + Zins | − | 10 Raten | ~2,5 | 0,25 | Kredite |
| Arena-/Reise-Betrieb (neu) | − | je Spieltag | 5,0 | 0,5 | Arena-Stufe, Kadergröße; **Senke** |
| Sponsor-Sockel (Haupt- + Ärmelsponsor) | + | 10 Raten | 38,0 | 3,8 | Startrang, Rarity, Vertrag |
| Sponsor-Wertung (Abschlag nach aktuellem Rang, Endrechnung am Saisonende) | + | je Spieltag + Schlusszahlung | 14,0 | 1,0 + 4,0 am Ende | aktueller/endgültiger Rang |
| Zuschauer / Ticketing (neu) | + | je Spieltag | 12,0 | 1,2 | Auslastung × Ticketpreis × Arena-Größe |
| Merchandising (neu) | + | je Spieltag | 5,0 | 0,5 | Stars im Einsatz, Fan-Stimmung, Fan-Shop |
| Ligageld / TV (neu) | + | je Spieltag | 8,0 | 0,8 | Liga-Topf gleichmäßig + Anteil nach Ranking |
| Spieltagsprämie (neu) | + | je Spieltag | 2,0 | 0,2 | Platz in den zwei Disziplinen des Spieltags |
| Vorstandsprämie | ± | Saisonende | 4,2 | — | wie heute |
| Apron | ± | Saisonende | 0 (Nullsumme) | — | wie heute |
| Sponsor-Ereignisse | ± | je Spieltag | 0,8 | ±0,3 | Würfel wie heute, gekoppelt an Stimmung (W5) |
| Spielerboni (neu, Spieler-Entscheidung) | − | frei | 0 bis 6 | — | Spieler wählt (Moral) |

Summe Soll-Jahr des Medians: Einnahmen ≈ 38 + 14 + 12 + 5 + 8 + 2 + 4,2 + 0,8 = 84,0; Ausgaben ≈ 54,5 + 2,5 + 5,0 = 62,0;
**GuV ≈ +22**. Das ist **zu viel** gegen heute +15,2 — gewollt, denn der Median ist hier nicht die Zielgröße, sondern ein
Zwischenstand. Vor Welle 2 wird der Sponsor-Sockel so abgesenkt, dass der Median bei **+12 bis +16** landet; die Differenz
(~8 C) geht in die Senke Arena-Betrieb. Die endgültige Aufteilung wird im Messlauf (W0) per Parameterraster gesetzt, nicht
hier festgelegt. Wichtig ist das **Verhältnis**: Sponsor soll von 91 % auf rund 60–65 % der Einnahmen sinken, damit kein
einzelner Posten (Sponsor-Los) das Schicksal eines Teams entscheidet (heute 122,8 gegen 43,7).

#### Fan-Stimmung: kurz über lang

Heute gibt es eine langsame **Beliebtheit** („Marke", 0,5–1,5, am Saisonübergang). Dazu käme eine kurze **Fan-Stimmung**
(0–100, pro Spieltag fortgeschrieben):

```
Stimmung[t] = clamp( Stimmung[t-1] + a·(Rangtreue-Ergebnis − Erwartung) + b·Stars_im_Einsatz − c·Ausfall_Star + d·Serie , 0, 100 )
Auslastung  = clamp( 0,35 + 0,65·Stimmung/100 × Marke , 0,25 , 1,0 )
```

Erwartung = Rang gemäß Teamstärke (`computeTeamExpectation`, schon in `team-beliebtheit.ts` genutzt); Überperformance
(„Underdog-Story") hebt, Enttäuschung senkt. **Merch** hängt an Stars (Top-6-Starpower, `FanFavorite`-Trait, Beliebtheit der
Spieler) × Stimmung; fällt der Star verletzt aus (`injuryEvents`), bricht der Merch-Anteil dieses Spielers ein
(„Verletzung des Stars → Merch-Einbruch"). Die Spreizung muss wirklich spürbar sein: Ziel Stimmung P10–P90 über die Liga
mindestens 30 Punkte (heute entspricht das Beliebtheits-Band 0,95–1,07 etwa 6 Punkten).

#### Sponsoren neu gedacht

Heute ein Vertrag pro Team (V3-Leiter, Rarity, Achsen, Sonderziel, `lib/sponsor/*`, 11 Kurvenformen). Neu: **drei Slots**, die
sich den bisherigen Vertrag teilen, statt ihn zu ersetzen (der Leiter-Kern bleibt, Anzeige = Abrechnung bleibt erhalten):

| Slot | Zahlung | Ziele | Zeitraum |
|---|---|---|---|
| **Hauptsponsor** (heutiger Vertrag) | Sockel in 10 Raten, Wertung als Abschlag + Schluss | Rang, Achsen, Sonderziel (`underdog_story`, `golden_fairytale` …) | 1–3 Saisons |
| **Ärmelsponsor** (neu, klein) | feste Rate je Spieltag + Boni | „Presence": Anzahl Stars im Einsatz, Spieltage ohne Minusbewertung | pro Saison wählbar |
| **Disziplin-Sponsor** (neu, je Farbe Power/Speed/Mental/Social) | **Bonus je Spieltag**, wenn eine Disziplin dieser Farbe gewonnen/Top-3 wird | Ziele je Farbe: „zwei Power-Podien", „Mental-Serie 3 Spieltage" | Angebot pro Spieltag, annehmen oder ablehnen |

Die Disziplin-Sponsoren sind der **Mehrwege**-Hebel: ein Team mit starker Mental-Achse nimmt den Mental-Sponsor und kassiert
dort, wo seine Stärke liegt (die Farben sind `DisciplineCategory = power | speed | mental | social`, `olyDataTypes.ts:12-16`).
Boni pro Spieltag statt nur Saisonende lösen das heutige Problem „alles hängt am Endrang" (B1, B6). Annehmen/Ablehnen ist die
Reaktionsmöglichkeit; Ablehnen kostet nichts, hat aber Opportunitätskosten (das Angebot verfällt).

### 2.3 Reaktionsmöglichkeiten des Spielers

| Hebel | Wirkung | Kosten / Risiko | Wo heute etwas anschließt |
|---|---|---|---|
| **Ticketpreis** (Regler −30 bis +30 % um den Richtpreis) | höher: mehr Erlös je Zuschauer, aber Auslastung ↓ und Stimmung ↓; niedriger: Stimmung ↑ | Elastizität je Marke und Stimmung, bewusst nicht linear (Gewinnmaximum nahe Richtpreis, damit kein „immer hoch") | neu; Arena-Upgrade-Stufe `facility-catalog.ts:187` |
| **Kredit/Dispo** (Mid-Season) | Kontostand rettet sich über Zinsen; Rahmen = `computeBorrowingCapacity` (Cash 15 % + 30 % Marktwert-Anteil, `loan-service.ts:22-23`) | Dispo-Zins am oberen Ende der Bank-Spanne (15–20 %, `loan-service.ts:17-18`), Tilgung als Rate; Vorfälligkeit 20 % (`:26`); geplatzte Kredite blockieren Neuaufnahme (`:149`) | heute nur Preseason; Aufhebung der „kein Mid-Season-Kredit"-Regel (Frage 1) |
| **Notverkauf** (Spieler vor Marktwert abgeben) | schnelles Cash | Verkaufsabschlag, Kaderverlust, Moral (Mannschaftskameraden) | Verkaufs-KI `ai-sell-decision-engine.ts`, Verkaufs-Vorschau `ai-transfermarkt-sell-preview-service.ts`, Fenster: heute nicht je Spieltag |
| **Sparkurs** (Training runter, Betrieb runter) | spart Arena-/Trainingskosten (neue Cash-Posten, B9) | Entwicklung ↓, Ermüdung/Verletzung ↑ | `lib/training/training-settings-service.ts`, Trainings-Intensität je Team (`trainingIntensityConfirmations`) |
| **Sponsor-Angebote** annehmen/ablehnen | zusätzliche Einnahmen je Spieltag | Bindung, Zielrisiko | `sponsor-offer-service.ts`, `sponsor-negotiation.ts` |
| **Bonuszahlung an Spieler** (Siegprämie, Treueprämie) | Moral ↑ (Wunsch-Erfüllung, Verlängerungsrisiko ↓) | Cash − Betrag; Form/Moral kommen aus dem parallelen Bau | `player-demands-service.ts` (`moraleReward`), `contract-dissolution-service.ts` |
| **Gebäude** (Arena, Fan-Shop) | langfristig mehr Ticket-/Merch-Erlös | Bau + Unterhalt; heute für die KI unattraktiv (B2) | `facility-upgrade-service.ts`, `facility-maintenance-service.ts` |

**Pleite-Leitplanke ohne Bailout:** Fällt die Kasse unter 0, gilt (a) Dispo-Zinssatz, (b) Kaufsperre (gibt es heute), (c) Hinweis
an den Spieler, (d) Vorstand reagiert (Vertrauen ↓, bereits vorhanden in `boardConfidence`). Es gibt keinen automatischen
Notkredit und keinen Nullstellungs-Eingriff (Leitplanke 2).

### 2.4 KI-Verhalten

Aufbauend auf `cashPriority`, Rücklagepolitik und Schulden-Frühwarnung (1.1):

| KI-Verhalten | Auslöser | Reaktion |
|---|---|---|
| Ticketpreis | Strategie (Marke/Preis) + Stimmung | wohlhabende „Prestige"-Profile ±10 % über Richtpreis, Sparer −5 % |
| Dispo | Kontostand < Rücklage-Ziel und kein Verkauf möglich | nimmt Dispo nur wenn `cashPriority` ≤ 6 (Hoarder nie), bis Rahmen × Bereitschaft (`ai-loan-decision-service.ts`) |
| Notverkauf | Schulden-Frühwarnung `fehlbetrag > 0` an Spieltag ≥ 7 | verkauft den **am wenigsten gebrauchten** Spieler mit höchstem Marktwert/Gehalt-Verhältnis (`ai-composite-sell-score.ts`) |
| Sparkurs | Kasse < 1 Spieltag-Gehalt | Training auf „leicht", keine Bonuszahlung |
| Sponsor-Angebote | Passung (Achsen, Farbe) × Risiko | wie heute `sponsor-v3-offer-service` Bewertung, plus Farb-Passung |
| Spielerbonus | Moral-Wunsch „at_risk" und Kasse über Rücklage | zahlt nur bei Stars, nie unter Rücklage |
| Gebäude | Kasse über 2× Rücklage und Fan-Shop-Rendite ≥ 8 % pro Saison | **neu**: KI baut Arena/Fan-Shop (heute 0 von 31 KI-Teams), sonst bleibt B2 bestehen |

KI und Mensch benutzen **dieselbe** Buchungsfunktion; nur die Entscheidungen unterscheiden sich (wie heute bei Krediten).

### 2.5 Balancing-Ziele und Messung

Messquelle ist ein neuer Messlauf auf Basis von `lib/admin/season-simulation-runner.ts` und dem Muster
`scripts/messlauf-sponsoren-gebaeude.ts`; Ausgabe je Team und Spieltag (Kontoverlauf). Alle Zielwerte gelten **über mindestens
2 unabhängige Saatstämme × 3 Saisons**. Die Zahlen sind Startwerte; sie werden beim ersten Messlauf mit Chris abgeglichen.

| # | Ziel | Messgröße | Heute (swnjlk) | Zielwert |
|---|---|---|---|---|
| Z1 | **Kein Spieltag ohne Reaktionsmöglichkeit.** Anteil der Teams, die an irgendeinem Spieltag unter 0 fallen | Teams mit `min(Kasse[t]) < 0` | nicht messbar (nur Endstand) | ≤ 8 von 32 in Saison ≥ 2 |
| Z2 | **Keine Pleite-Spirale.** Teams, die am Saisonende unter −5 stehen | Endstand | 0 (swnjlk), 9 (1hf25q) | ≤ 3 von 32 |
| Z3 | Erholungsquote | Teams mit Endkasse < 0 in Saison n, die in Saison n+2 wieder ≥ 0 stehen | — | ≥ 70 % |
| Z4 | **Spanne der Endkasse** | P10 bis P90 | 3,6 bis 52,6 (Median 32,5; P90/P10 ≈ 14) | P10 ≥ 0 und P90/P10 ≤ 12; σ 15 bis 25 |
| Z5 | **Spanne der GuV** | P10 bis P90; Ausreißer > +50 | −9 bis +42; 1 Ausreißer (+77,6) | P10 ≥ −15, P90 ≤ +40, höchstens 1 Ausreißer |
| Z6 | **Reiche nicht unschlagbar** | Spearman(Kasse zu Saisonbeginn, Endrang-Nummer) | Endkasse↔Rangnummer Spearman +0,44 (Startkasse nicht im Abbild; positiv = Reiche stehen schlechter) | betragsmäßig ≤ 0,35 **und** nicht positiv (Geld hilft leicht oder gar nicht, entscheidet nie; heute hilft es negativ) |
| Z7 | Reiche Teams können Erfolg nicht kaufen | Anteil der Top-8-Kasse-Teams, die in den Top 8 des Rangs landen | — | zwischen 25 % und 55 % (Zufall wäre 25 %) |
| Z8 | **Liga-Überschuss absorbiert** | Σ GuV Liga je Saison / Σ Gehälter | +28 % (496 / 1794) | +8 % bis +15 % |
| Z9 | Einnahmenstruktur | Sponsor-Anteil an positiven Posten | 91 % | 55–70 %, kein Posten > 70 % |
| Z10 | Deckung Gehalt ← planbare Einnahmen | Teams mit Sponsor+Ticket+Ligageld < Gehalt | 7 von 32 | ≤ 4 von 32 |
| Z11 | Summen-Neutralität W0/W1 | Δ Saison-GuV je Team gegen Ist | — | \|Δ\| ≤ 0,5 C, Σ exakt |
| Z12 | Wertungs-Unberührtheit | Fingerabdruck `pruefe-wertung-fingerabdruck.mjs` | e80babacb68c | unverändert |

Z1/Z2 und Z6/Z7 sind die **Chris-Kriterien** („keine Pleite-Spirale", „reiche Teams nicht unschlagbar"). Z6 prüft nebenbei
das Rubberband: die heutige Umkehrung (+0,42) ist gewollt, aber zu stark.

**Prüfpunkte im Betrieb:** (1) Live-Abbild gegen Z1–Z10 (Skript analog zu `scripts/e2e-saisonende-am-save-abbild.ts`);
(2) Konsistenz-Test „Kontoauszug-Summe = Cash-Differenz" (siehe W0); (3) CI-Test „GuV-Posten-Summe = `guv`".

### 2.6 Datenmodell (nur Skizze, damit die Wellen realistisch geschätzt sind)

- `seasonState.cashLedger[]`: `{ teamId, seasonId, matchdayId, kategorie, betrag, notiz, quelleId }` — eine Zeile je Bewegung.
  Alle bisherigen Buchungen schreiben (zusätzlich) dorthin. Nicht ersetzend, bis W1 stabil ist.
- `teams[].fanMood` (0–100) und `seasonState.fanMoodHistoryByTeamId` (analog `beliebtheitHistoryByTeamId`).
- `seasonState.ticketPriceByTeamId` (Prozent um Richtpreis).
- Persistenz: Erweiterung des Season-State-JSON, `save-version` hochzählen, Migration beim Laden (`save-repository.ts`),
  wie bei den Sponsor-V3-Migrationen.
- Feature-Flag `FINANZ_KREISLAUF` (Spielstand-Feld), damit laufende Spielstände auf dem Server unverändert weiterlaufen und die
  Umstellung bei „Neues Spiel" oder zum Saisonübergang aktiviert wird (Migrationsplan nur für Neuspiele, wie der Liga-Split
  in `league-split.ts:5-20`).

---

## 3. Bau-Wellen

Jede Welle liefert allein ein spielbares Ergebnis und hat einen eigenen Abnahmetest. Aufwand in **Agenten-Tagen** (1 Tag ≈ 1 Session
mit Test und Review): S = 1–2, M = 3–4, L = 5–7.

| Welle | Inhalt | Ergebnis für den Spieler | Abnahme | Aufwand |
|---|---|---|---|---|
| **W0 — Kontoauszug + Messlauf** | `cashLedger`, alle bestehenden Buchungen schreiben mit (Sponsor, Gehalt, Apron, Board, Kredit, Gebäude, Transfers, Ereignisse); neue Ansicht „Kontoauszug" im Finanzen-Reiter; Messskript `scripts/messe-finanzkreislauf.ts` (Z1–Z12 am Abbild und in der Simulation) | Man sieht, woher jede C kommt — noch ohne neues Verhalten | Ledger-Summe = Δ`team.cash` je Team und Saison (Test); GuV unverändert (Z11) | **M (3–4 T)** |
| **W1 — Taktung** | Gehalt, Kreditrate, Sponsor-Sockel und Gebäude-Netto in **10 Raten** je Spieltag (Flag), Sponsor-Wertung als Abschlag + Schlusszahlung; Dispo-Rahmen als Sicherheitsnetz (automatisch, verzinst); Kassenverlauf-Diagramm; Vorstandsziele „Cashpuffer"/„Gehaltsquote" auf Spieltags-Bestand umstellen (heute Verzerrung, `board-objective-league-calibration.ts:5-12`) | Kasse bewegt sich jede Woche; Teams können mitten in der Saison ins Minus rutschen | Saison-GuV je Team ±0,5 C gegen Ist (Z11), Fingerabdruck unverändert (Z12), Z1/Z2 im Simulationslauf | **M–L (4–6 T)** — größtes Risiko: Berührung von `season-guv-*`, Apron-Linien, Vorstandsziel-Kalibrierung |
| **W2 — Einnahmen** | Fan-Stimmung, Zuschauer/Ticketing (Richtpreis), Merchandising (Stars), Ligageld/TV, Spieltagsprämie, Arena-/Reise-Betrieb als Senke; Sponsor-Sockel entsprechend gesenkt (Summenausgleich); Beliebtheit spreizen (B3) | Erfolg und Stars zahlen sich je Spieltag aus; Tabelle „Einnahmen der Liga" | Z4–Z10 im Messlauf | **L (5–7 T)** |
| **W3 — Reaktionshebel** | Ticketpreis-Regler, Sparkurs (Cash-Posten Training), Dispo/Kurzkredit mid-season (Regel-Änderung), Notverkauf-Fenster, Spielerbonus (Moral-Hebel, falls Form/Moral gelandet sind; sonst nur Zahlung + Wunsch erfüllt) | Man kann reagieren statt zuzusehen | Kaufsperre/Dispo-Tests, Spieler-Reaktionen messbar (Moral-Delta je Bonus) | **M (3–4 T)** |
| **W4 — Sponsoren neu** | Slots Haupt/Ärmel/Disziplin, Bonus je Spieltag je Farbe, Angebote pro Spieltag, Farb-Passung in der KI-Bewertung | Sponsoren bestimmen mit, **wo** man punktet | Anzeige = Abrechnung (bestehende Invariante), Summen-Neutralität je Rarity, Ziele erfüllbar (mind. 40 % der Teams erfüllen mind. ein Farb-Ziel je Saison) | **L (5–7 T)** |
| **W5 — Ereignisse, KI, Form/Moral** | Ereignisse an Stimmung/Verletzung koppeln (Star fällt aus → Merch-Einbruch, Serie → Stimmung), KI-Verhalten aus 2.4 (inkl. Gebäudebau), Form/Moral-Eingänge (Form des Stars → Stimmung, Moral ↔ Bonus), Feintuning | Finanz-Welt reagiert auf das Spielgeschehen | Z6/Z7 (Reichtum ≠ Erfolg), KI-Plausibilitätsbericht | **M (3–4 T)** |

**Reihenfolge und Abhängigkeiten:** W0 → W1 sind Pflicht-Fundament und ohne Verhaltensänderung testbar. W2 und W3 sind danach
unabhängig voneinander lieferbar (W3 nutzt W1 für Dispo). W4 braucht W1 und profitiert von W2 (Einnahmenanteil). W5 kommt zuletzt, weil es
die parallel entstehende Form/Moral lesen will — **die Welle bleibt lieferbar, auch wenn Form/Moral später kommen** (Eingänge
dann auf Rang und Verletzung beschränkt).

**Kleinster sinnvoller Start (ein Pull-Request-Zyklus):** W0 allein. Er ändert nichts am Spielverhalten, liefert den Kontoauszug und
macht jede spätere Welle messbar.

---

## 4. Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| Laufende Spielstände auf dem Server brechen (Saison-Mitte-Umstellung) | Feature-Flag am Spielstand, Aktivierung nur bei „Neues Spiel"/Saisonübergang, Migrationstest am Abbild (`pruefe-endsaison-backfill-am-abbild.ts`-Muster) |
| Mehrere Wahrheiten für die GuV (Chris' Dauerbeschwerde) | Neue Posten **nur** über `SEASON_GUV_POSTEN_KEYS`; CI-Test GuV-Summe = Posten-Summe |
| Rundungsdrift bei 10 Raten (0,1-Rundung, `roundCash`) | Rest auf die letzte Rate; Ledger-Konsistenztest |
| Frühe Saison-1-Kasse zu klein (Median 6,5 C gegen 5,5 C Gehaltsrate) | Startkasse und erste Raten gemeinsam kalibrieren; Dispo-Rahmen ab Saison 1 für Gehalt (Frage 1) |
| Zu viele Stellschrauben für den Spieler | Pro Welle ein Hebel mit Voreinstellung; „Auto" für Ticketpreis |
| Form/Moral-Branch ändert Typen gleichzeitig | W5 zuletzt; Kopplung über schmale Lese-Funktionen |

---

## 5. Fragen an Chris (Ja/Nein)

1. **Mid-Season-Dispo:** Darf ein Team mitten in der Saison ins Minus rutschen und dort einen verzinsten Dispo/Kurzkredit
   aufnehmen (heute: Kredit nur in der Preseason, `kredit-system.md`)? Ja heißt: die Regel „kein Mid-Season-Kredit" fällt.
2. **Taktung zuerst:** Sollen Gehälter und Sponsor-Sockel schon in Welle 1 in zehn Raten laufen, **bevor** neue
   Einnahmen (Ticket/Merch/TV) da sind — mit dem Risiko, dass schwache Teams in Saison 1 kurzzeitig im Dispo stehen?
3. **Summenneutral:** Soll der neue Einnahmen-Mix die Jahres-Gesamtsumme der Liga **gleich lassen** (Sponsor-Anteil wird
   gesenkt, Rubberband und 1,1-Ausschüttung bleiben)? Nein hieße: es gibt bewusst mehr Geld im Spiel.
4. **Disziplin-Sponsoren nach Farbe:** Sollen die vier Disziplin-Farben (Power/Speed/Mental/Social) eigene Sponsor-Angebote
   mit Spieltags-Bonus bekommen?
5. **KI baut Gebäude:** Sollen KI-Teams künftig Arena/Fan-Shop bauen (heute 0 von 31), damit die Gebäude-Einnahme nicht
   weiter tot ist — auch wenn das die Liga-Ökonomie verschiebt?
