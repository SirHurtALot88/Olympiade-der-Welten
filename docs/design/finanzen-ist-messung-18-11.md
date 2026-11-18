# Finanzen — IST-Messung der Teamkosten (18.11.2026)

Auftrag Chris (18.11.): „kannst du das mal messen, wenn die Teams normal mit der Pick-Engine ihre Spieler kaufen, was sie
wirklich in der Saison an Kosten für Gehälter haben und ggf. Gebäude, damit man das andere gut drumherum aufbauen kann."
Reine Messung, **keine Spiellogik angefasst**. Begriffe und Posten wie im Finanzkonzept
(`docs/design/finanzkonzept-17-11.md`, Branch `claude/finanzkonzept-17-11`): Geldbeträge in C, GuV =
Sponsor + Sponsor-Ereignisse + Gebäude-Einnahme + Apron + Vorstandsziele − Gehälter − Gebäude-Unterhalt − Kreditzins
(`lib/finance/season-end-guv.ts`).

Rohdaten: `data/generated/finanzen-ist-messung-18-11-roh.json` (je Team und Phase), verdichtet in
`data/generated/finanzen-ist-messung-18-11.json`. Skripte: `scripts/miss-teamfinanzen-saison.ts` (Lauf),
`scripts/lies-finanzen-nebendaten.ts` (Wirtschaftsfaktor, Apron-Linien/-Buchungen, Transfers nach Quelle),
`scripts/auswerte-teamfinanzen-saison.ts` (Verdichtung).

---

## 0. Kurzfassung

1. **Gehälter: Median je Team und Saison 64 C** (Liga 1: 78, Spanne 46 bis 103; Liga 2: 55, Spanne 40 bis 81). Das ist
   **3,2 C je Spieltag** (Summe/20; Liga 1 3,9, Liga 2 2,8). Liga-Summe Gehälter 2122 bis 2142 C bei 32 Teams, Kader 11,5.
2. **Kasse nach dem Draft: 5 bis 13 C** (Median 6,6, Σ 228 bis 244). Das Startbudget (170 bis 325 C) steckt zu 97 % in Spielern.
3. **Sponsor deckt die Gehälter im Schnitt, aber nicht je Team.** Σ Sponsor 1953 / 2065 / 2138 C gegen Σ Gehälter 2122 / 2142 / 2137 C
   (Deckung 92 / 96 / 100 %). Median Sponsor/Gehalt 1,05 (Liga 1) bzw. 1,01 (Liga 2); **44 % der Teams (41 von 93) decken ihr
   Gehalt nicht**. Der Sponsor macht ca. 96 % der Einnahmen aus, Vorstandsziele ca. 4 %.
4. **Teure Kader verlieren Cash — das System balanciert sich selbst.** Das teuerste Gehaltsviertel (Ø 87 C) macht im Mittel
   **−18 C GuV** und endet bei Ø −11 C Kasse (15 von 24 im Minus); das billigste Viertel (Ø 48 C) +9 C GuV (1 von 24 im Minus).
5. **Kasse während der Saison: kaum Bewegung** (nur Sponsor-Ereignisse, ±9 C je Team über 20 Spieltage, Σ-Drift −1 C).
   Gehälter und Sponsor werden gebündelt am Saisonende gebucht.
6. **Die Geldmenge explodiert nicht durch die GuV, sondern durch den Saisonwechsel:** Vertragsablauf (Ablöse an den
   Klub, +1244 bis +1796 C für 59 bis 79 Spieler) und KI-Verkäufe (+683 bis +993 C) heben Σ Kasse von ~240 auf ~2600 bis 2700 C.
   Die S2-Kaufphase der KI nimmt davon 600 bis 1100 C wieder weg; Σ zu S2-Beginn 1952 / 1599 C (Faktor 7 bis 8 gegenüber S1).
7. **Wer steht nach den S2-Käufen im Minus? Niemand** (0 von 32 in beiden sauberen Läufen, Mindestkasse 3,4 / 4,7 C), aber
   die Kader sind dann nur 7,8 bzw. 9,0 Spieler groß (S1: 11,5); die Gehaltssumme S2 (1346 / 1536 C) ist deshalb
   **nicht** repräsentativ (siehe 4.5).
8. **Die KI baut Gebäude** (anders als im Konzept angenommen): nach der S2-Kaufphase haben 22 bis 30 von 32 Teams
   mindestens eins, fast nur Stufe 1, geschätzte Investition Σ 276 bis 293 C, Unterhalt Σ 26 bis 48 C je Saison, Einnahme ≈ 0.
9. **Auffälligkeit: M-M zahlt in allen drei Läufen Gehalt (≈ 100 C, das höchste der Liga), erhält aber keinen Sponsor** und
   endet bei ca. −100 C Kasse. Nicht untersucht, bitte gesondert prüfen.

---

## 1. Wie gemessen

Pfad wie im echten Spiel, ausschließlich auf Wegwerf-SQLite (`OLY_APP_SQLITE_PATH`, danach gelöscht), nichts auf den Server geschrieben:

| Schritt | Dienst |
|---|---|
| Neues Spiel Battle, `presetId solo_1`, Liga-Split 2×16, 20 Spieltage | `previewNewGameSetup` / `applyNewGameSetup` |
| Kader über die Pick-Engine (Liga-Draft, alle 32 Teams KI) | `fuehreLigaSetupDraftAus` |
| 20 Spieltage | `runLocalMatchdayAutoRun` + `executeMatchdayAdvance` |
| Saisonabschluss, Saisonende-Kette bis `next_season_ready` | `runLocalSeasonCompletion`, `advanceSeasonTransitionStep` |
| Saisonwechsel, **Kaufphase Saison 2** | `applyPreSeasonNextSeasonSetupLightweight`, `fuehreKiPreseasonLaufAus` (derselbe Dienst wie die Route `/api/ai/preseason-background`) |

Nach jedem Abschnitt ein Schnappschuss je Team (Kasse, Kader, Gehalt gebucht/verhandelt, Marktwert, Gebäude, Kredit) und die
Roh-GuV über `resolveSeasonGuvPartsByTeam`/`buildSeasonGuv` (die EINE GuV). Dazu die Kasse nach **jedem** Spieltag (Lauf C komplett).
Gehalt = `getTeamActualSalaryTotal` (dasselbe, was am Saisonende abgebucht wird).

Läufe: **A, B, C**, drei verschiedene Saves (je andere Saat aus der `saveId`), alle Battle. Ein Manager-Save wurde **nicht** gemessen (siehe 6).

| Lauf | S1 Spieltage mit Kassenreihe | Wirtschaftsfaktor S1 / S2 | Laufzeit (Wanduhr) |
|---|---|---|---|
| A | 5 von 20 (Abbruch bei Spieltag 15, Wiederaufnahme) | 1,18 / 0,92 | ~75 min inkl. Abbrüchen |
| B | 8 von 20 (dito) | 1,02 / 0,92 | ~65 min inkl. Abbrüchen |
| C | **20 von 20**, am Stück | 1,08 / 1,18 | 31 min (1869 s) |

Ein Spieltag dauert 48 bis 125 s (je nach Last auf der Maschine); die Messung der Saison 1 plus Saisonwechsel plus Kaufphase kostet im
besten Fall ~30 min je Lauf. **Saison 2 wurde nicht gespielt** (Zeitlimit), gemessen ist deren Start inkl. Kaufphase.

---

## 2. Gehälter, Kader, Startkasse (nach dem Draft = Saisonstart S1)

Gepoolt über A/B/C (n = 48 je Liga), Spieltagswert = Saisonsumme / 20:

| | Min | Median | Max | je Spieltag (Median) |
|---|---:|---:|---:|---:|
| Gehalt Liga 1 | 46,2 | 77,9 | 103,2 | 3,9 |
| Gehalt Liga 2 | 39,5 | 55,5 | 80,6 | 2,8 |
| Gehalt gesamt (Lauf C) | 44,1 | 64,0 | 100,2 | 3,2 |

| Lauf | Σ Gehalt | Kader (Median) | Kasse nach Draft Median (Spanne) | Σ Kasse | Marktwert Σ | Σ ausgegeben im Draft |
|---|---:|---:|---|---:|---:|---:|
| A | 2136,9 | 11 / 12 | 6,6 (5,1 bis 13,5) | 243,8 | ~7680 | ~7670 |
| B | 2122,2 | 11,5 | 6,6 (5,0 bis 13,5) | 238,2 | 7681,9 | 7677,2 |
| C | 2142,4 | 11,5 | 6,6 (5,0 bis 10,1) | 228,2 | ~7690 | ~7690 |

Startbudget: Liga 1 250 bis 325 (Median 287,5), Liga 2 170 bis 245 (207,5). Korrelation Budget ↔ Gehalt 0,91 bis 0,94.
Kredite und Gebäude: zu Saisonstart S1 **keine** (0 Teams).

---

## 3. Saison 1 — Einnahmen, GuV, Kasse

### 3.1 Posten der GuV (Σ über 32 Teams)

| Posten | A | B | C |
|---|---:|---:|---:|
| Sponsor | 2138,3 | 1952,8 | 2065,3 |
| Sponsor-Ereignisse | −2,5 | +4,0 | −1,0 |
| Vorstandsziele | +99,0 | +93,0 | +88,0 |
| Apron (Nullsumme) | 0 | 0 | 0 |
| Gebäude-Einnahme / -Unterhalt | 0 / 0 | 0 / 0 | 0 / 0 |
| Kreditzins | 0 | 0 | 0 |
| Gehälter | −2136,8 | −2122,2 | −2142,4 |
| **GuV Σ** | **+98,0** | **−72,4** | **+9,9** |
| Σ Kasse Start → Ende der Abrechnung | 243,8 → 341,9 | 238,2 → 165,5 | 228,2 → 238,0 |

Die Σ-GuV streut je nach Wirtschaftsfaktor (1,18 → +98, 1,02 → −72, 1,08 → +10); ein deutlich positiver Überschuss wie die
„+500 C je Saison" des Konzepts (Live-Abbild, Saison 2, Faktor 0,96) tritt in einer frischen Saison 1 **nicht** auf.
In S1 gibt es keine Preisgelder, keine Gebäude-Einnahme, keine Zinsen.

### 3.2 Je Liga und gesamt (Lauf C, Median/Spanne; A und B in der JSON)

| Lauf C | Liga 1 | Liga 2 | gesamt |
|---|---|---|---|
| Sponsor Min / Median / Max | 0*/73,1/121,2 | 43,1/51,8/76,2 | 0*/65,3/121,2 |
| Gehalt Min / Median / Max | 55,7/76,5/100,2 | 44,1/56,3/78,7 | 44,1/64,0/100,2 |
| GuV Min / Median / Max | −103,7/2,6/61,6 | −32,7/−1,1/28,2 | −103,7/1,3/61,6 |
| Gehalt in % der Einnahmen (Median) | 90 | 96 | 91 |
| Kasse Start (Median) | 6,5 | 6,9 | 6,8 |
| Kasse Saisonende (Min / Median / Max) | −95,8/8,2/71,7 | −26,8/8,1/35,1 | −95,8/8,1/71,7 |
| Teams im Minus | 6 | 5 | 11 |
| Σ Kasse Start → Ende | 107,1 → 108,2 | 121,1 → 129,8 | 228,2 → 238,0 |

\* M-M ohne Sponsorzahlung (siehe 0.9). Gepoolt (A+B+C, ohne M-M beim Sponsor): Sponsor Liga 1 Median 75,8
(46,2 bis 128,6), Liga 2 51,9 (39,2 bis 83,9).

**Teams im Minus nach der Saisonabrechnung: 11 / 9 / 11 von 32** (A / B / C). Das sind überwiegend Teams mit Gehalt über
Sponsor (Beispiele: Z-H Gehalt 100 / Sponsor 70, Kasse −28; N-N 79 / 44, Kasse −27; V-D 69 / 46, Kasse −21). Die Startkasse von
~7 C kann kein Defizit puffern. Alle Minus-Teams liegen nach dem Vertragsablauf wieder im Plus (siehe 4.1).

### 3.3 Verteilung nach Rang (je 8 Teams: je Rangstufe vier Plätze aus beiden Ligen; Mittelwerte)

| Rang (liga-lokal) | Lauf A Kasse / Sponsor / Gehalt / GuV | Lauf B | Lauf C |
|---|---|---|---|
| 1 bis 4 | 30,2 / 86,6 / 69,5 / +22,3 | 21,2 / 77,8 / 67,1 / +14,1 | 20,5 / 84,4 / 73,5 / +14,0 |
| 5 bis 8 | 7,9 / 68,9 / 71,2 / +1,4 | −3,2 / 59,7 / 70,8 / −10,2 | 21,0 / 74,4 / 66,9 / +12,9 |
| 9 bis 12 | 7,6 / 63,5 / 66,7 / −0,7 | 0,7 / 54,6 / 67,4 / −8,2 | −8,6 / 49,0 / 67,1 / −16,0 |
| 13 bis 16 | −3,0 / 48,3 / 59,6 / −10,8 | 2,1 / 52,0 / 59,9 / −4,7 | −3,1 / 50,4 / 60,2 / −9,7 |

Korrelation Rang ↔ Kasse **−0,25 / −0,41 / −0,47** (bessere Platzierung = mehr Geld), also das **Gegenteil** der +0,42 des
Live-Abbilds Saison 2 im Finanzkonzept. In einer frischen Saison 1 ist Geld ein Erfolgsindikator (Gehälter sind fast rangneutral,
Sponsor steigt mit dem Rang); die Umkehr im Live-Spielstand entsteht über die Folgesaisons (Rubberband über den Startrang-Sockel,
Kaderverkäufe).

### 3.4 Kasse während der Saison

Lauf C (alle 20 Spieltage): 29 von 32 Teams bewegen sich überhaupt, Differenz Start → Ende je Team −9 bis +14 C (Median 0), Σ-Drift
228,2 → 227,1. Spanne der Σ Kasse über die Spieltage 213 bis 247. Einzige Quelle: Sponsor-Ereignisse beim Spieltagswechsel (und
ein Maskottchen-Kauf, −4,6 C). **Gehälter, Sponsor, Vorstandsziele, Apron: ein Block am Saisonende** (bestätigt Befund B1 des Konzepts).

---

## 4. Saisonwechsel und Kaufphase Saison 2

### 4.1 Geldmenge Σ aller 32 Kassen (Zeitleiste)

| Zeitpunkt | A | B | C |
|---|---:|---:|---:|
| Nach Draft (Saisonstart S1) | 243,8 | 238,2 | 228,2 |
| Nach den 20 Spieltagen | 241,4 | 241,9 | 227,1 |
| Nach Saisonabrechnung (Sponsor, Gehälter, Apron, Ziele) | 341,9 | 165,5 | 238,0 |
| Nach Vertragsablauf („Ablöse" an den Klub) | 1586,3 | 1739,6 | 2034,4 |
| Nach KI-Verkäufen am Saisonende | 2579,3 | 2554,1 | 2716,9 |
| Nach Saisonwechsel, vor Kaufphase | (siehe 4.5) | 2554,1 | 2716,9 |
| **Nach Kaufphase S2 = Saisonstart S2** | (A siehe 4.5) | **1952,0** | **1598,7** |

Quellen der Sprünge (`transferHistory`, Nebendaten): **Vertragsablauf** `ai_contract_expiry` 59 / 79 / 70 Spieler, +1244 / +1574 / +1796 C
(Ø 20 bis 26 C je auslaufendem Vertrag); **KI-Verkäufe** `ai_organic_squad_sell` 74 / 64 / 61 Spieler, netto +993 / +814 / +683 C.
Der Kaderumfang fällt dabei von 370 auf 237 / 226 / 239 Spieler, die Gehaltssumme von ~2130 auf ~1260 bis 1290 C. Die GuV erzeugt dagegen
nur −72 bis +98 C je Saison. **Die Geldmenge wächst heute praktisch ausschließlich über Ablösen aus dem Spielerbestand.**

### 4.2 Was die KI in der Kaufphase S2 tut (saubere Läufe B und C)

| | B | C |
|---|---:|---:|
| Σ Kasse vor / nach Kaufphase | 2554,1 / 1952,0 | 2716,9 / 1598,7 |
| Abnahme | −602,1 | −1118,2 |
| Spielerkäufe `ai_preseason_market_buy` | 12 Spieler, 312,3 C | 34 Spieler, 823,3 C |
| Notkäufe `ai_injury_depth_topup` | 13 Spieler, 65,8 C | 16 Spieler, 95,2 C |
| Gebäude (geschätzt, Katalog-Stufenkosten) | Σ 276 C, 22 Teams mit Gebäude | Σ 293 C, 23 Teams |
| Neue Kredite (Σ Restschuld nach Kauf) | 210,8 C, 6 Teams | 249,0 C, 9 Teams |
| Kader je Team vorher → nachher (Median) | 7 → 7,8 (Ø) | 7,5 → 9,0 (Ø) |
| Gehaltssumme Σ vorher → nachher | 1258 → 1346 | 1292 → 1536 |
| Mindestkasse nachher | 3,4 | 4,7 |
| **Teams im Minus nachher** | **0** | **0** |

Die KI nimmt in der Kaufphase **Kredite auf** (Preseason, heute die einzige Gelegenheit) und baut Gebäude; sie bleibt dadurch in
allen Teams im Plus. Warnungen im Lauf: `buy_building:season_upkeep_unpaid_risk` (KI weiß, dass der Unterhalt riskant ist) und
Blockaden `roster_after_market_plan_below_player_min`, `insufficient_cash`, `cash_after_market_plan_below_reserve`.

### 4.3 Gebäude (IST)

Katalog (`lib/facilities/facility-catalog.ts`, Kosten für Stufe 1/2/3/4/5, Unterhalt je Saison, Einnahme je Saison):

| Gebäude | Baukosten | Unterhalt | Einnahme |
|---|---|---|---|
| Training Center | 8 / 15 / 25 / 40 / 62 | 0,8 / 1,4 / 2,4 / 3,8 / 5,5 | 0 |
| Recovery Center | 7 / 13 / 22 / 35 / 54 | 0,7 / 1,2 / 2,1 / 3,3 / 4,8 | 0 |
| Scouting Office | 6 / 12 / 20 / 32 / 50 | 0,6 / 1,1 / 1,8 / 2,8 / 4,2 | 0 |
| Analytics Room | 5 / 10 / 17 / 27 / 42 | 0,5 / 0,9 / 1,5 / 2,4 / 3,6 | 0 |
| Fan Shop | 10 / 19 / 23 / 36 / 56 | 0,4 / 0,8 / 1,4 / 2,2 / 3,4 | 3,9 / 7,8 / 11,7 / 17,2 / 25,0 |
| Arena Upgrade | 13 / 24 / 30 / 46 / 72 | 0,8 / 1,4 / 2,4 / 3,6 / 5,4 | 2,4 / 6,0 / 10,8 / 17,7 / 28,5 |
| Academy | 7 / 13 / 22 / 35 / 55 | 0,7 / 1,2 / 2,0 / 3,1 / 4,8 | 0 |
| Specialist Wing | 6 / 12 / 20 / 32 / 50 | 0,6 / 1,1 / 1,8 / 2,8 / 4,2 | 0 |

Bestand nach der S2-Kaufphase: B 38 Gebäude in 22 Teams (Recovery L1 ×14, Training L1 ×11, Scouting L1 ×10, Fan Shop L1 ×3), Unterhalt
Σ 25,8 C je Saison; A 30 Teams, Unterhalt Σ 47,6; C 23 Teams, Σ 28,7. **Wer baut: die KI** (in S1 baut sie nicht, die Gebäude entstehen in der
Kaufphase der Folgesaison). Einnahmen entstehen nur durch Fan Shop / Arena, hier ≈ 0 bis wenige C. Gebäude-Unterhalt ist gegenüber dem
Gehalt unerheblich (Σ ≈ 1 bis 2 % der Gehälter). Die Gesamtkosten-Schätzung weicht von der Kassenabnahme ab (Kassenabnahme − Käufe + Kredite
− Gebäude ≠ 0, Rest ~100 bis 160 C je Lauf), weil Upgrade-Rabatte, Zinsen und Tilgungsstruktur der Kredite nicht einzeln gelesen wurden.

### 4.4 Wer ist im Minus?

* Nach der Saisonabrechnung S1 (vor Vertragsablauf): 11 / 9 / 11 Teams (Liste in 3.2).
* Nach der Kaufphase S2: 0 / 0 (B / C). Lauf A: 0 (aber unsauber, siehe 4.5).
* Die Teams mit den höchsten Kassen S2 (Ø 61 bzw. 50 C) sind die, die kaum gekauft haben; die geringste Kasse (3,4 bis 4,7 C) haben die, die
  Kader und Gebäude per Kredit aufgefüllt haben (z. B. H-R: Kredit 49 C, Kasse 4,4).

### 4.5 Grenzen und Einschränkungen dieser Messung

* **Saison 2 nicht gespielt.** Es gibt keine zweite GuV; die Aussage „teure Kader verlieren über Saisons Cash" stützt sich auf Saison 1
  (je Lauf 32 Teams, gepoolt 96) plus den S2-Start.
* **Kader S2 unvollständig.** Nach Kaufphase 7,8 (B) bzw. 9,0 (C) Spieler je Team, in S1 11,5; die KI meldet `roster_after_market_plan_below_player_min`.
  Ob der Kader später (Spielbeginn S2, Roster-Fill-Route) aufgefüllt wird, wurde nicht geprüft. Hochgerechnet auf 11,5 Spieler läge die
  S2-Gehaltssumme bei ≈ 1960 bis 1990 C (Extrapolation, keine Messung).
* **Lauf A, Kaufphase unsauber:** der Prozess wurde während der Kaufphase vom OOM-Killer beendet und neu aufgesetzt; ein erster Teil
  (75 Käufe, 1854 C, Σ Kasse 2579 → 1229) lief schon, daher ist A nur für Saison 1 und den Vertragsablauf verwertbar. B und C sind sauber.
  Die Streuung der Kaufphase (12 bis 34 Käufe, Σ −602 bis −1118 C) ist mit zwei sauberen Läufen nicht erklärt.
* **Kassenreihe je Spieltag nur in Lauf C vollständig** (A, B: 5 bzw. 8 Spieltage, Abbruch/Wiederaufnahme nach Zeitlimit der Umgebung; der
  Stand lag durch die Datenbank fest, nur die Reihe fehlt). Saisonstart A/B = Stand nach Draft (zwischen Draft und Spieltag 1 keine Buchung).
* Alle 32 Teams KI (Battle), **kein Manager-Save**. Das Menschen-Team (V-W im Live-Abbild) wurde nicht nachgebildet.
* Die Gebäude-Investition ist aus dem Katalog geschätzt (kein Ledger je Gebäudekauf gelesen).
* Auf- und Abstieg wurden nicht ausgewertet; die Ligazuordnung bleibt die aus Saison 1.
* Die Läufe liefen parallel auf einer ausgelasteten Maschine (Last 8 bis 10); Laufzeiten sind deshalb Obergrenzen.

---

## 5. Nachtrag (Zusatzauftrag des Koordinators)

### 5.1 (a) Kopplung Sponsor ↔ Gehalt heute, Saison-Faktor

Es gibt **keine direkte Formel Sponsor = f(eigenes Gehalt)**. Die Kopplung ist indirekt und läuft über drei Hebel
(`lib/sponsor/sponsor-liga-leiter.ts`):

```
Auszahlung(Team) = Sockel(Startrang) + Wertungstopf × salaryFactor × Ligafaktor × Gewicht(Endrang)  (+ Zonenterm Auf-/Abstieg, Kartenform renormiert, Boden)

Sockel(Startrang)  = 19,8 + (52,8 − 19,8) × (Startrang − 1) / (n − 1)        // 18 und 48, je × SPONSOR_AUSSCHUETTUNG 1,1  (Z. 57 bis 64)
Wertungstopf       = 1030 × 1,1 = 1133                                          // bei salaryFactor 1,0
Ligafaktor         = 0,6 (Liga 1) bzw. 0,4 (Liga 2)                             // SPONSOR_TOPF_FAKTOR_JE_LIGA, Z. 107
Gewicht(Endrang)   = ((n − Endrang) / (n − 1)) ^ 1,35, normiert auf Σ = 1       // SPONSOR_WERTUNG_KURVE
```

* **Gehaltsbezug ist die Kalibrierung, nicht die Rechnung:** `SPONSOR_AUSSCHUETTUNG = 1,1` wurde so gesetzt, dass Σ Sponsor ≈ Σ Gehälter der
  Liga ist (Kommentar Z. 36 bis 56; Messlauf 84 % bei 1,0 → Chris: +10 %). Der Gebäude-Verzicht (Leihe) senkt Cash-Sponsor, Gehalt+Unterhalt
  sind die Bezugsgröße der Deckungsanzeige (`getTeamSponsorBaseReferenceTotal`, `computeSponsorCostCoverage`).
* **Teure Kader sind schlechter gestellt:** der Sockel hängt am **Startrang** (starkes/teures Team = niedriger Sockel 19,8, schwaches 52,8),
  der Wertungsteil am **Endrang**. Das ist das gewollte Rubberband.
* **Saison-Faktor** `salaryFactor` (`lib/season/season-economy-factors.ts`): je Save deterministisch vorausgewürfelt, 5-Saisons-Fenster,
  Wurf gleichverteilt **0,82 bis 1,24** (`SALARY_FACTOR_ROLL_MIN 0,82`, Breite 0,42), jede Saison rückt das Fenster um eins weiter; skaliert **nur den
  Wertungstopf** (und den Zonenterm), nicht den Sockel. Gelesen über `getCurrentSponsorSalaryFactor` bzw. `salaryFactorAtSign` am Vertrag.
* Gezahlt wird **nur am Saisonende**; das Gehalt wird in demselben Buchungslauf immer abgezogen, auch ohne Sponsorvertrag
  (`sponsor-settlement-service.ts` ab Z. 174, „deductSalary").
* **Faktor in diesen Läufen** (Saison 1 / Saison 2): A 1,18 / 0,92, B 1,02 / 0,92, C 1,08 / 1,18. Wirkung in S1: Σ Sponsor/Σ Gehalt = 100 % (A),
  92 % (B), 96 % (C) — der Faktor erklärt die Σ-GuV-Streuung (+98 / −72 / +10) praktisch vollständig.

### 5.2 (b) Apron heute

Code: `lib/season/apron-service.ts` (Konstanten Z. 135 bis 142, 175, 214; Abgabe Z. 766 bis 795; Abrechnung `apron-settlement-service.ts`).

| Regel | Wert |
|---|---|
| Bemessung | **verhandeltes** Jahresgehalt (`getTeamNegotiatedSalaryTotal`), je Liga gegen den Median der Liga |
| Linie 1 / Linie 2 | Median × **1,2** / Median × **1,4** (eingefroren beim Schließen des Kauffensters) |
| Satz | 0,8 auf den Überschuss zwischen Linie 1 und 2, 1,6 auf den Überschuss über Linie 2 |
| Deckel | höchstens 50 % des eigenen Sponsor-Wertungsanteils |
| Konjunkturhebel | **Stufe**: 0 bei salaryFactor < 0,88, sonst 1 (in allen Läufen S1 = 1) |
| Ausschüttung | zu gleichen Teilen an alle Teams **streng unter Linie 1** (Nullsumme) |

Linien in den Läufen (S1, Median → L1 / L2): Liga 1 A 77,9 → 93,5 / 109,1, B 78,9 → 94,7 / 110,5, C 77,9 → 93,4 / 109,0;
Liga 2 A 51,6 → 61,9 / 72,2, B 54,7 → 65,6 / 76,6, C 54,6 → 65,5 / 76,4.

**Wer sie gerissen hat (S1):** A: M-M −7,7 (Gehalt 103,1), V-V −5,4, L-K −4,6, T-G −1,5 (Σ 19,2); B: M-M −6,8 (103,2), V-V −1,6 (Σ 8,4);
C: Z-H −5,4 (100,2), M-M −5,0, V-V −1,7 (Σ 12,1). Ausschüttung an 28 bis 30 Teams je 0,1 bis 0,9 C. Der Apron bewegt damit **< 1 % der Gehaltssumme**
und ändert keine Teamlage; er trifft immer die zwei, drei teuersten Kader (M-M jedes Mal).

### 5.3 (c) Verhältnis Sponsor/Gehalt und Cash-Verlust bei hohen Gehältern

Sponsor/Gehalt je Team (nur Teams mit Sponsor, gepoolt): Median Liga 1 **1,05**, Liga 2 **1,01**; Spanne 0,6 bis 1,8; **41 von 93 unter 1,0**.

Gepoolt nach Gehaltsviertel (24 Team-Saisons je Viertel, Saison 1, A+B+C):

| Gehaltsviertel | Ø Gehalt | Ø Sponsor | Ø GuV | Ø Kasse nach Abrechnung | im Minus | GuV negativ |
|---|---:|---:|---:|---:|---:|---:|
| 1 (teuerste) | 86,8 | 67,1 | **−18,1** | **−11,2** | 15 / 24 | 15 |
| 2 | 71,4 | 72,1 | +2,5 | +10,0 | 11 / 24 | 11 |
| 3 | 60,3 | 63,6 | +8,5 | +15,7 | 4 / 24 | 9 |
| 4 (billigste) | 48,2 | 53,7 | +8,6 | +16,6 | 1 / 24 | 3 |

Korrelation Gehalt ↔ GuV −0,53 / −0,43 / −0,43, Gehalt ↔ Kasse −0,52 / −0,42 / −0,44 (A: ohne M-M −0,33 / −0,23 / −0,24).
**Ja: teure Kader verlieren in der Saison Cash**, und zwar deutlich, weil der Sponsor mit dem Gehalt nur schwach wächst (+25 % bei +80 % Gehalt vom
billigsten zum teuersten Viertel). Der Effekt über mehrere Saisons ist **nicht** gemessen (S2 nicht gespielt); er wird zusätzlich durch den
Ablösen-Zufluss beim Vertragsablauf (4.1) überdeckt, der alle Teams wieder ins Plus hebt.

---

## 6. Offene Punkte für das Finanzkonzept

1. Die wahre Geldquelle ist die Ablöse beim Vertragsablauf plus KI-Verkäufe (Faktor ~10 auf die Geldmenge), nicht der Sponsor. Jede
   Taktung auf Spieltage („Geld pro Spieltag") muss diese Flüsse einbeziehen, sonst bleibt die Liga reich und die Gehaltslast wirkungslos.
2. Gehalt je Spieltag als Ziel: Liga 1 ≈ 3,9, Liga 2 ≈ 2,8 C (Median), Spanne 2,0 bis 5,2.
3. Startkasse ≈ 7 C reicht nicht für Spieltagsraten aus Anfangsbestand; entweder Sponsor-Sockel vorziehen oder Startpuffer.
4. M-M ohne Sponsorzahlung in S1 (Ursache offen, in allen drei Läufen).
5. Nicht gemessen: Manager-Save (menschliches Team), Saison 2 vollständig, Mehrsaison-Drift, Auf-/Abstieg.
