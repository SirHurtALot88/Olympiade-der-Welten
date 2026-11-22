# GuV bei Saison-Faktor 1 und die Budget-Variante +20/+2 (Messung 22.11.)

Auftrag Chris, 22.11.: „wo wir dann rein theoretisch stehen was Einnahmen und Ausgaben angeht und bei wie vielen Teams die GuV noch aufgeht,
wenn Season Faktor = 1" und „würde es helfen, wenn wir ALLE Budgets noch mal anheben? … dann hätten wir mehr Puffer". Die Variante wurde
von Chris nachgeschärft: **Sockel +20 für Budget-Platz 32, je Platz besser +2 (Platz 31 +22 … Platz 1 +82)**; Rang 1 = höchstes Startbudget.
Reine Messung, kein Produktcode geändert.

## 1. Was ist der Saison-Faktor, und was ist „C"?

- **Saison-Faktor** = `seasonState.seasonEconomyFactors[0].factor` („Ligajahr-Faktor", Fenster über 5 Saisonen):
  `lib/sponsor/sponsor-v3-offer-service.ts:144-147` (`getSponsorV3SalaryFactor`, Rückfall 1). Er wird je Saison gewürfelt, gleichverteilt
  0,82 bis 1,24 (Mittel 1,03): `lib/season/season-economy-factors.ts:63-64` (`SALARY_FACTOR_ROLL_MIN`/`_WIDTH`) und `:105-108`
  (`rollFutureSeasonFactor`). Festnageln für Messungen: Umgebungsvariable `OLY_LONG_RUN_SALARY_FACTOR_PATTERN` (`:116-125`).
- **Wo er wirkt:** auf den Wertungstopf der Sponsor-Leiter, also den **Rangbonus** am Saisonende (Konzept: Rangbonus = Wertungstopf der
  Leiter-Stufe × Saison-Faktor, `docs/design/finanzkonzept-v2-18-11.md:26-27` und `:90`; Preisgeld-Tabelle `lib/season/prize-money.ts:58`
  `buildPrizeMoneyTable(teamSalaries, salaryFactor)`; Mockup `public/mockups/finanzen-modern-18-11.html:440` `FAKTOR=1.0`, `:529`, `:898`).
  Konzept `:169`: der Faktor bewegt die Liga um 261 C zwischen 0,82 und 1,24; Frage 5 (`:401`, „mittig auf 1,0 legen") wurde mit Ja beantwortet.
- **Einheit:** Budgets, Kasse und Gehälter sind **C**, im Konzept und in den Mockups gleich „Mio" (`docs/design/transfermarkt-modern-18-11.md:222`: eine
  Einheit überall, „C"). Startbudget = Startkasse (`lib/game/new-game-setup-service.ts:573` `cash: team.budget`); der Budget-Rang ergibt sich aus
  der Sortierung nach Budget (`:178`), Liga 1 = Budget-Rang 1 bis 16, Liga 2 = 17 bis 32.

## 2. Messaufbau

- Stand: origin/main `57d39c532` (vor PR #1689; **Vorbehalt:** die KI-Kaufplanung dieses PR ist nicht enthalten, die Kaufphasen-Zahlen können sich danach ändern).
- 32 KI-Teams von Anfang an, Battle-Modus (2×16), Draft als Block, 2 Saisonen mit KI-Kaufphase vor Saison 2, `scripts/miss-teamfinanzen-saison.ts`
  (neu: `--budget-variante plus20plus2`, hebt nach der Anlage Budget und Kasse an), Auswertung `scripts/auswerte-guv-saisonfaktor.ts`.
- **Saison-Faktor fest 1,00** in beiden Läufen (`OLY_LONG_RUN_SALARY_FACTOR_PATTERN=1,1,1,…`; im Lauf `apronSalaryFactor 1` bestätigt).
- **Operative GuV** = die eine GuV (`lib/finance/season-end-guv.ts`): Sponsor, Sponsor-Ereignisse, Gebäude-Einnahmen, Apron, Vorstandsziele minus Gehälter,
  Unterhalt, Kreditzins. **Der GuV-Posten „Transfers" ist in der Messung immer 0** (Käufe der Kaufphase fallen vor dem Spieltag und stehen nicht in der Saison-GuV);
  „mit Transfers" ist deshalb **aus der Kasse gerechnet**: GuV + Kassenbewegung der Kaufphase vor der Saison (S1: Draft, S2: KI-Kaufphase). Die Saisonende-Kette
  (Verkäufe, Vertragsende, Abgänge, Nachkäufe nach der Saison) steht getrennt als eigene Zeile.
- Quartile = Budget-Rang 1-8 (Q1, reichste) bis 25-32 (Q4, ärmste). „Operative GuV ≥ 0" zählt gleich 0 als aufgegangen.
- **Rauschen:** die Spieltage sind nicht reproduzierbar (zwei Läufe desselben Standes enden auf verschiedenen Rängen). Ein Lauf je Variante ist keine Statistik;
  die Unterschiede unten sind Richtungsaussagen, keine Punktgenauigkeit. Ein zweiter Faktor-Lauf mit dem gewürfelten Faktor wurde nicht gerechnet.

## 3. Kurzfassung

| | Basis (Faktor 1) S1 | Basis S2 | Variante +20/+2 S1 | Variante S2 |
|---|---:|---:|---:|---:|
| Teams mit operativer GuV ≥ 0 (von 32) | 16 | 27 | 12 | 20 |
| davon Liga 1 (von 16) | 6 | 13 | 4 | 7 |
| davon Liga 2 (von 16) | 10 | 14 | 8 | 13 |
| operative GuV Ø je Team (C) | +4,0 | +15,6 | -5,5 | +10,8 |
| Teams mit Kasse < 0 am Saisonende (nach Abschluss) | 5 | 0 | 7 | 3 |
| Teams mit Kasse < 0 nach der Saisonende-Kette | 0 | 0 | 0 | 0 |

Die Saison-1-GuV geht bei Faktor 1 nur bei der Hälfte der Teams auf (Liga 1: 6 von 16, Liga 2: 10 von 16), Saison 2 bei 27 von 32 (Liga 1: 13, Liga 2: 14).
Grund S1: die Kader werden im Draft bis auf ~8 % des Budgets leergekauft (Kasse Ø 18 von 247) und tragen dann Gehälter, die der Sponsor in Liga 1 nicht deckt
(Gehalt Ø 65,7 gegen Sponsor Ø 65,0; Liga 1 74,2 gegen 70,0). Die Gehälter sinken in S2 (Ø 57,9), vermutlich weil Verträge auslaufen und günstiger nachgekauft wird (nicht einzeln nachgemessen) – daher das bessere S2.

## 4. Variante +20/+2 gegen Basis

Startbudgets: Basis 170 (Platz 32) bis 325 (Platz 1), Σ 7920, Median 247,5. Variante 190 bis 407, Σ 9552 (+1632, +20,6 %), Median 298,5.
**Spreizung reichstes/ärmstes Startbudget: 1,91 → 2,14** (die Differenz wächst von 155 auf 217 C).

| Größe | Basis | Variante +20/+2 |
|---|---:|---:|
| Startbudget Σ (C) | 7920 | 9552 |
| Reich/arm (Platz 1 : Platz 32) | 1,91 | 2,14 |
| Kasse nach Draft Σ (C) / Ø | 576,9 / 18,0 | 720,2 / 22,5 |
| im Draft ausgegeben Ø (C) | 229,3 | 275,8 (+46,5 von +51,0 Zuschuss Ø) |
| Teams im Minus nach Draft | 0 | 0 |
| Kader Ø nach Draft (Spieler) | 11,8 | 11,9 |
| **Kaderstärke Top-6 Ø, Saisonstart S1** | 46,1 | **50,1 (+4,0)** |
| Kaderstärke Top-6 Ø, Saisonstart S2 | 45,5 | 48,9 (+3,4) |
| Gehaltssumme Ø Saisonstart S1 / S2 (C) | 67,5 / 57,9 | 77,9 / 64,7 |
| operative GuV Ø S1 / S2 (C) | +4,0 / +15,6 | -5,5 / +10,8 |
| Teams GuV ≥ 0 S1 / S2 | 16 / 27 | 12 / 20 |
| Kasse am Saisonende Ø S1 / S2 (C) | 19,7 / 26,8 | 12,4 / 25,4 |
| Teams im Minus am Saisonende S1 / S2 | 5 / 0 | 7 / 3 |
| Kasse nach Saisonende-Kette Ø S1 / S2 (Horten) | 64,0 / 48,9 | 65,5 / 65,3 |
| Kaufphase vor S2 netto Ø (C) | -50,2 | -49,4 |

Lesart:

1. **Das Geld verpufft nicht als Puffer, es wird zu Kader.** Von 51 C Zuschuss je Team (Ø) gehen im Draft 46,5 C in Spieler (Stärke +4 Punkte, +8,7 %). Die Kasse nach dem Draft steigt nur von 18 auf 22,5.
2. **Die GuV wird schlechter, nicht besser.** Teurere Kader tragen höhere Gehälter (+10,4 C Ø in S1, bei Liga 1 92,4 gegen 76,6), der Sponsor wächst nicht mit
   (Sponsor hängt an Rang und Faktor, nicht am Budget). Die Teams im Minus am Saisonende steigen von 5 auf 7 (S1) und von 0 auf 3 (S2). Die Reichen (Q1/Q2) trifft es am stärksten
   (Q2 operativ −23,0 gegen −11,2 in S1), weil sie am meisten Zuschuss bekommen und am meisten ausgeben.
3. **Horten:** am Saisonende liegt die Kasse nicht höher (S1 12,4 gegen 19,7, S2 25,4 gegen 26,8); erst nach der Kette (Verkäufe/Vertragsende) steht S2 mit 65,3 gegen 48,9 höher – das
   ist Verkaufserlös teurerer Kader, kein Puffer aus dem Spielbetrieb.
4. Die Spreizung reich/arm wächst von 1,91 auf 2,14 und die Stärke-Schere ebenfalls (Liga 1 Stärke 54,9 gegen 45,4 in Liga 2, Basis 50,1 gegen 42,1).

## 5. Empfehlung

- **Eine pauschale Budgetanhebung hilft der GuV nicht**: sie ist ein Kaderzuschuss, keine Einnahme. Der Draft kauft jedes zusätzliche Budget in Gehaltslast um, und die Gehälter
  laufen jede Saison weiter, der Zuschuss nur einmal. Als „Puffer" taugt sie nur, wenn die Kaufplanung einen Teil bewusst zurückhält – das ist das Thema von PR #1689 (Rücklage nach Finanzwert), nicht des Budgets.
- Der echte Hebel für „GuV geht auf" liegt auf der Einnahmenseite oder bei den Gehältern: bei Faktor 1 fehlen in Liga 1 in Saison 1 rund 4 C Sponsor gegen Gehalt im Schnitt, 10 von 16 Teams liegen
  darunter (Q2 am schlechtesten, Ø −11,2). Mögliche Stellen (ohne hier etwas zu ändern): Sponsor-Sockel für Liga 1 um einen Betrag in der Größenordnung 5 bis 10 C, oder der Draft rechnet die Gehaltslast
  gegen den erwarteten Sponsor (Forecast mit Sponsor ist im Konzept vorgesehen). Wenn Chris trotzdem anheben will, dann die Variante ohne Spreizung (+X für alle), weil +2 je Platz die Schere schon vergrößert.
- Saison 2 geht mit 27 von 32 deutlich besser auf; das Problem ist im Wesentlichen **Saison 1** (Draft leert die Kasse, Gehälter voll).
- Vorbehalt: ein Lauf je Variante, Stand vor PR #1689; vor einer Entscheidung die Basis nach dem Merge von #1689 einmal neu messen (`scripts/miss-teamfinanzen-saison.ts` und `scripts/auswerte-guv-saisonfaktor.ts` genügen).

## 6. Rohtabellen

Aufruf: `OLY_LONG_RUN_SALARY_FACTOR_PATTERN=1,1,1,1,1,1,1,1,1,1 OLY_APP_SQLITE_PATH=<wegwerf.sqlite> npx tsx scripts/miss-teamfinanzen-saison.ts --seasons 2 --out <lauf.json> --label BASIS`
(Variante: zusätzlich `--budget-variante plus20plus2`), dann `npx tsx scripts/auswerte-guv-saisonfaktor.ts <lauf.json>`.


## Rohtabellen Lauf BASIS

Startbudget Summe 7920 C; nach Draft: Kasse Summe 576.9, Kader Ø 11.8, Staerke (Top-6) Ø 46.1, 0 Teams im Minus.


### BASIS, Saison 1: operative GuV (ohne Transfers) und mit Transfers

| Gruppe | n | GuV >= 0 | GuV < 0 | operative GuV min/med/max | GuV + Kaufphase >= 0 | GuV + Kaufphase min/med/max | Kasse Saisonende min/med/max | im Minus (Saisonende / nach Kette) |
|---|---:|---:|---:|---|---:|---|---|---:|
| Liga 1 | 16 | 6 | 10 | -34 / -1 / 69.8 | 0 | -308.4 / -267.2 / -212.8 | -23.4 / 19.9 / 77.2 | 4 / 0 |
| Liga 2 | 16 | 10 | 6 | -19.1 / 9.8 / 28.5 | 0 | -243 / -180.1 / -137.6 | -8 / 19.6 / 50.1 | 1 / 0 |
| gesamt | 32 | 16 | 16 | -34 / 0.2 / 69.8 | 0 | -308.4 / -227.3 / -137.6 | -23.4 / 19.9 / 77.2 | 5 / 0 |
| Q1 (Budget-Rang 1-8) | 8 | 5 | 3 | -12.6 / 7.6 / 69.8 | 0 | -302.2 / -283.1 / -212.8 | -2.8 / 24.3 / 77.2 | 1 / 0 |
| Q2 (9-16) | 8 | 1 | 7 | -34 / -13.1 / 12.2 | 0 | -308.4 / -250.8 / -235.2 | -23.4 / 5.4 / 39.2 | 3 / 0 |
| Q3 (17-24) | 8 | 6 | 2 | -19.1 / 18 / 28.5 | 0 | -243 / -199.8 / -172.9 | -8 / 33.3 / 50.1 | 1 / 0 |
| Q4 (25-32) | 8 | 4 | 4 | -10.1 / 2.3 / 20.7 | 0 | -194.5 / -172.7 / -137.6 | 1.7 / 10.6 / 37.3 | 0 / 0 |

Posten-Mittel je Team (C), Saison 1:

| Posten | Liga 1 | Liga 2 | gesamt |
|---|---:|---:|---:|
| Sponsor (Sockel + Rangpraemie) | 70 | 59.9 | 65 |
| Sponsor-Ereignisse | 0.4 | -0.6 | -0.1 |
| Gebaeude-Einnahmen | 0 | 0 | 0 |
| Apron (netto) | 0 | 0 | 0 |
| Vorstandsziele | 4.6 | 5.1 | 4.8 |
| Gehaelter | -74.2 | -57.3 | -65.7 |
| Gebaeude-Unterhalt | 0 | 0 | 0 |
| Kreditzins | 0 | 0 | 0 |
| Kredit-Tilgung (keine GuV) | 0 | 0 | 0 |
| Transfers netto (keine GuV) | 0 | 0 | 0 |
| Einnahmen gesamt (GuV) | 77 | 65.7 | 71.4 |
| Ausgaben gesamt (GuV) | -76.1 | -58.6 | -67.3 |
| operative GuV | 0.9 | 7.2 | 4 |
| GuV mit Transfers | -265.8 | -184.8 | -225.3 |
| Kasse vor Kaufphase | 287.2 | 207.5 | 247.4 |
| Kaufphase netto (Cash, vor der Saison) | -266.7 | -192 | -229.3 |
| Kasse Saisonstart | 20.5 | 15.5 | 18 |
| Rest nicht in der GuV (Tilgung, Abweichung) | -3 | -1.7 | -2.4 |
| Kasse Saisonende (nach Abschluss) | 18.4 | 20.9 | 19.7 |
| Saisonende-Kette netto (Verkaeufe, Abgaenge, Nachkaeufe) | 50.9 | 37.9 | 44.4 |
| Kasse nach Kette | 69.3 | 58.8 | 64 |
| Kader Saisonstart | 11.3 | 12.4 | 11.8 |
| Staerke Top-6 Ø (Saisonstart) | 50.1 | 42.1 | 46.1 |
| Gehalt Saisonstart | 76.6 | 58.3 | 67.5 |

GuV-Mittel nach Budget-Rang-Quartil (operativ / mit Transfers / Kasse Ende):

| Quartil | operative GuV Ø | GuV + Kaufphase Ø | Kasse Start Ø | Kasse Saisonende Ø | Gehalt Ø |
|---|---:|---:|---:|---:|---:|
| Q1 | 13.1 | -272.2 | 21.7 | 29.6 | 81.8 |
| Q2 | -11.2 | -259.4 | 19.4 | 7.3 | 71.4 |
| Q3 | 10.9 | -198.9 | 17.7 | 26.8 | 62.3 |
| Q4 | 3.4 | -170.7 | 13.4 | 15.1 | 54.3 |

### BASIS, Saison 2: operative GuV (ohne Transfers) und mit Transfers

| Gruppe | n | GuV >= 0 | GuV < 0 | operative GuV min/med/max | GuV + Kaufphase >= 0 | GuV + Kaufphase min/med/max | Kasse Saisonende min/med/max | im Minus (Saisonende / nach Kette) |
|---|---:|---:|---:|---|---:|---|---|---:|
| Liga 1 | 16 | 13 | 3 | -24.2 / 16.6 / 66.7 | 3 | -82.4 / -46.1 / 37.2 | 7.9 / 26.4 / 113.2 | 0 / 0 |
| Liga 2 | 16 | 14 | 2 | -1.7 / 16 / 43.6 | 0 | -96.2 / -33 / -1.7 | 5 / 21.6 / 53.7 | 0 / 0 |
| gesamt | 32 | 27 | 5 | -24.2 / 16.3 / 66.7 | 3 | -96.2 / -33.6 / 37.2 | 5 / 23.2 / 113.2 | 0 / 0 |
| Q1 (Budget-Rang 1-8) | 8 | 6 | 2 | -24.2 / 14.6 / 66.7 | 2 | -80 / -46.1 / 37.2 | 8 / 25 / 113.2 | 0 / 0 |
| Q2 (9-16) | 8 | 7 | 1 | -4.4 / 19.2 / 41.4 | 1 | -82.4 / -43.2 / 14.2 | 7.9 / 26.4 / 50.5 | 0 / 0 |
| Q3 (17-24) | 8 | 8 | 0 | 0.2 / 18.3 / 43.6 | 0 | -76.4 / -29.7 / -1.7 | 10.6 / 27.9 / 53.7 | 0 / 0 |
| Q4 (25-32) | 8 | 6 | 2 | -1.7 / 7.2 / 27.6 | 0 | -96.2 / -33 / -3 | 5 / 16.2 / 23.7 | 0 / 0 |

Posten-Mittel je Team (C), Saison 2:

| Posten | Liga 1 | Liga 2 | gesamt |
|---|---:|---:|---:|
| Sponsor (Sockel + Rangpraemie) | 77.1 | 60 | 68.5 |
| Sponsor-Ereignisse | 0.9 | 0.2 | 0.5 |
| Gebaeude-Einnahmen | 0.2 | 0.5 | 0.4 |
| Apron (netto) | -0.8 | 0.8 | 0 |
| Vorstandsziele | 4.7 | 3.8 | 4.2 |
| Gehaelter | -65.1 | -50.7 | -57.9 |
| Gebaeude-Unterhalt | 0 | 0 | 0 |
| Kreditzins | 0 | -0.3 | -0.2 |
| Kredit-Tilgung (keine GuV) | 0 | -0.3 | -0.1 |
| Transfers netto (keine GuV) | 0 | 0 | 0 |
| Einnahmen gesamt (GuV) | 86.2 | 66.4 | 76.3 |
| Ausgaben gesamt (GuV) | -69.1 | -52.3 | -60.7 |
| operative GuV | 17.1 | 14.1 | 15.6 |
| GuV mit Transfers | -34.4 | -34.8 | -34.6 |
| Kasse vor Kaufphase | 69.3 | 58.8 | 64 |
| Kaufphase netto (Cash, vor der Saison) | -51.5 | -48.9 | -50.2 |
| Kasse Saisonstart | 17.8 | 9.9 | 13.8 |
| Rest nicht in der GuV (Tilgung, Abweichung) | -3.4 | -1.8 | -2.6 |
| Kasse Saisonende (nach Abschluss) | 31.5 | 22.2 | 26.8 |
| Saisonende-Kette netto (Verkaeufe, Abgaenge, Nachkaeufe) | 22.2 | 21.9 | 22.1 |
| Kasse nach Kette | 53.7 | 44.1 | 48.9 |
| Kader Saisonstart | 10.6 | 11.4 | 11 |
| Staerke Top-6 Ø (Saisonstart) | 49.1 | 41.8 | 45.5 |
| Gehalt Saisonstart | 65.1 | 50.7 | 57.9 |

GuV-Mittel nach Budget-Rang-Quartil (operativ / mit Transfers / Kasse Ende):

| Quartil | operative GuV Ø | GuV + Kaufphase Ø | Kasse Start Ø | Kasse Saisonende Ø | Gehalt Ø |
|---|---:|---:|---:|---:|---:|
| Q1 | 16.2 | -29.7 | 24.4 | 36.2 | 72 |
| Q2 | 17.9 | -39.1 | 11.2 | 26.8 | 58.2 |
| Q3 | 18.6 | -33.7 | 10.7 | 29.1 | 54.8 |
| Q4 | 9.6 | -35.9 | 9 | 15.3 | 46.7 |


## Rohtabellen Lauf PLUS20PLUS2

Startbudget Summe 9552 C; nach Draft: Kasse Summe 720.2, Kader Ø 11.9, Staerke (Top-6) Ø 50.1, 0 Teams im Minus.


### PLUS20PLUS2, Saison 1: operative GuV (ohne Transfers) und mit Transfers

| Gruppe | n | GuV >= 0 | GuV < 0 | operative GuV min/med/max | GuV + Kaufphase >= 0 | GuV + Kaufphase min/med/max | Kasse Saisonende min/med/max | im Minus (Saisonende / nach Kette) |
|---|---:|---:|---:|---|---:|---|---|---:|
| Liga 1 | 16 | 4 | 12 | -51.5 / -14.6 / 43.5 | 0 | -415.5 / -332 / -265.1 | -36 / 11.3 / 65.3 | 6 / 0 |
| Liga 2 | 16 | 8 | 8 | -37.5 / 0 / 32.9 | 0 | -305 / -209.3 / -171.4 | -24 / 11.9 / 43.8 | 1 / 0 |
| gesamt | 32 | 12 | 20 | -51.5 / -5.8 / 43.5 | 0 | -415.5 / -292.8 / -171.4 | -36 / 11.9 / 65.3 | 7 / 0 |
| Q1 (Budget-Rang 1-8) | 8 | 3 | 5 | -47.7 / -4.6 / 43.5 | 0 | -415.5 / -351.6 / -307.7 | -27.4 / 24.3 / 65.3 | 2 / 0 |
| Q2 (9-16) | 8 | 1 | 7 | -51.5 / -27.9 / 14.1 | 0 | -366 / -319.2 / -265.1 | -36 / -2.9 / 27.9 | 4 / 0 |
| Q3 (17-24) | 8 | 5 | 3 | -37.5 / 9.5 / 32.9 | 0 | -305 / -251.6 / -189.2 | -24 / 18.7 / 43.8 | 1 / 0 |
| Q4 (25-32) | 8 | 3 | 5 | -7.9 / -2.6 / 10.5 | 0 | -228.6 / -202.4 / -171.4 | 4.3 / 11.2 / 30.9 | 0 / 0 |

Posten-Mittel je Team (C), Saison 1:

| Posten | Liga 1 | Liga 2 | gesamt |
|---|---:|---:|---:|
| Sponsor (Sockel + Rangpraemie) | 72.3 | 58 | 65.1 |
| Sponsor-Ereignisse | -0.5 | 0.5 | 0 |
| Gebaeude-Einnahmen | 0 | 0 | 0 |
| Apron (netto) | 0 | 0 | 0 |
| Vorstandsziele | 4.3 | 4.9 | 4.6 |
| Gehaelter | -88.9 | -61.5 | -75.2 |
| Gebaeude-Unterhalt | 0 | 0 | 0 |
| Kreditzins | 0 | 0 | 0 |
| Kredit-Tilgung (keine GuV) | 0 | 0 | 0 |
| Transfers netto (keine GuV) | 0 | 0 | 0 |
| Einnahmen gesamt (GuV) | 78.4 | 65.3 | 71.8 |
| Ausgaben gesamt (GuV) | -91.2 | -63.5 | -77.4 |
| operative GuV | -12.8 | 1.8 | -5.5 |
| GuV mit Transfers | -340.2 | -222.5 | -281.4 |
| Kasse vor Kaufphase | 354.2 | 242.5 | 298.4 |
| Kaufphase netto (Cash, vor der Saison) | -327.4 | -224.3 | -275.8 |
| Kasse Saisonstart | 26.8 | 18.2 | 22.5 |
| Rest nicht in der GuV (Tilgung, Abweichung) | -4.6 | -4.6 | -4.6 |
| Kasse Saisonende (nach Abschluss) | 9.4 | 15.3 | 12.4 |
| Saisonende-Kette netto (Verkaeufe, Abgaenge, Nachkaeufe) | 53.6 | 52.6 | 53.1 |
| Kasse nach Kette | 63 | 68 | 65.5 |
| Kader Saisonstart | 11.5 | 12.3 | 11.9 |
| Staerke Top-6 Ø (Saisonstart) | 54.9 | 45.4 | 50.1 |
| Gehalt Saisonstart | 92.4 | 63.5 | 77.9 |

GuV-Mittel nach Budget-Rang-Quartil (operativ / mit Transfers / Kasse Ende):

| Quartil | operative GuV Ø | GuV + Kaufphase Ø | Kasse Start Ø | Kasse Saisonende Ø | Gehalt Ø |
|---|---:|---:|---:|---:|---:|
| Q1 | -2.5 | -355.2 | 29.2 | 20.8 | 98 |
| Q2 | -23 | -325.1 | 24.4 | -2 | 86.8 |
| Q3 | 4.9 | -244.5 | 21.1 | 18.5 | 68.8 |
| Q4 | -1.4 | -200.6 | 15.3 | 12.1 | 58.1 |

### PLUS20PLUS2, Saison 2: operative GuV (ohne Transfers) und mit Transfers

| Gruppe | n | GuV >= 0 | GuV < 0 | operative GuV min/med/max | GuV + Kaufphase >= 0 | GuV + Kaufphase min/med/max | Kasse Saisonende min/med/max | im Minus (Saisonende / nach Kette) |
|---|---:|---:|---:|---|---:|---|---|---:|
| Liga 1 | 16 | 7 | 9 | -38.1 / -2.4 / 65.1 | 3 | -94 / -41.2 / 60.6 | -30.1 / 13 / 113.5 | 3 / 0 |
| Liga 2 | 16 | 13 | 3 | -8.3 / 16.5 / 48.3 | 1 | -101.5 / -46.8 / 2.7 | 0.9 / 24 / 57.8 | 0 / 0 |
| gesamt | 32 | 20 | 12 | -38.1 / 7.2 / 65.1 | 4 | -101.5 / -46.8 / 60.6 | -30.1 / 20.8 / 113.5 | 3 / 0 |
| Q1 (Budget-Rang 1-8) | 8 | 4 | 4 | -25.7 / 3.1 / 65.1 | 2 | -87.9 / -42 / 60.6 | -5.9 / 19.3 / 113.5 | 1 / 0 |
| Q2 (9-16) | 8 | 3 | 5 | -38.1 / -5.8 / 37.6 | 1 | -94 / -41.2 / 34.9 | -30.1 / 5.8 / 55.8 | 2 / 0 |
| Q3 (17-24) | 8 | 6 | 2 | -8.3 / 15.8 / 48.3 | 1 | -101.5 / -24 / 2.7 | 0.9 / 28.8 / 57.8 | 0 / 0 |
| Q4 (25-32) | 8 | 7 | 1 | -6.8 / 16.5 / 35.4 | 0 | -81.7 / -50.8 / -9.4 | 2.7 / 24 / 48.4 | 0 / 0 |

Posten-Mittel je Team (C), Saison 2:

| Posten | Liga 1 | Liga 2 | gesamt |
|---|---:|---:|---:|
| Sponsor (Sockel + Rangpraemie) | 76.7 | 63.6 | 70.2 |
| Sponsor-Ereignisse | 0.9 | 0 | 0.5 |
| Gebaeude-Einnahmen | 0.5 | 0.5 | 0.5 |
| Apron (netto) | -1.9 | 1.9 | 0 |
| Vorstandsziele | 4.9 | 4.1 | 4.5 |
| Gehaelter | -74.1 | -54.9 | -64.5 |
| Gebaeude-Unterhalt | 0 | 0 | 0 |
| Kreditzins | -0.7 | 0 | -0.4 |
| Kredit-Tilgung (keine GuV) | -0.2 | 0 | -0.1 |
| Transfers netto (keine GuV) | 0 | 0 | 0 |
| Einnahmen gesamt (GuV) | 85.6 | 71.5 | 78.5 |
| Ausgaben gesamt (GuV) | -79.3 | -56.2 | -67.8 |
| operative GuV | 6.3 | 15.2 | 10.8 |
| GuV mit Transfers | -35.2 | -42.1 | -38.7 |
| Kasse vor Kaufphase | 63 | 68 | 65.5 |
| Kaufphase netto (Cash, vor der Saison) | -41.6 | -57.3 | -49.4 |
| Kasse Saisonstart | 21.5 | 10.6 | 16.1 |
| Rest nicht in der GuV (Tilgung, Abweichung) | -2.1 | -0.8 | -1.5 |
| Kasse Saisonende (nach Abschluss) | 25.8 | 25 | 25.4 |
| Saisonende-Kette netto (Verkaeufe, Abgaenge, Nachkaeufe) | 48.4 | 31.5 | 39.9 |
| Kasse nach Kette | 74.1 | 56.5 | 65.3 |
| Kader Saisonstart | 11 | 11.7 | 11.3 |
| Staerke Top-6 Ø (Saisonstart) | 53.1 | 44.6 | 48.9 |
| Gehalt Saisonstart | 74.5 | 54.9 | 64.7 |

GuV-Mittel nach Budget-Rang-Quartil (operativ / mit Transfers / Kasse Ende):

| Quartil | operative GuV Ø | GuV + Kaufphase Ø | Kasse Start Ø | Kasse Saisonende Ø | Gehalt Ø |
|---|---:|---:|---:|---:|---:|
| Q1 | 11.9 | -30.1 | 26.4 | 36.9 | 83.6 |
| Q2 | 0.7 | -40.4 | 16.6 | 14.6 | 65.3 |
| Q3 | 16.3 | -36.8 | 10.8 | 26.5 | 58.6 |
| Q4 | 14.1 | -47.3 | 10.4 | 23.5 | 51.2 |
