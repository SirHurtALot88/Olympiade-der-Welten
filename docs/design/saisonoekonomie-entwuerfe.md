# Saisonökonomie — vier Entwürfe für ein Baukastensystem 40–100

Entwurfsdokument, kein Umbau. Recherche zu realen Wirtschaftssystemen aus Sportserien ohne
Heimspiele, daraus vier konkrete, gegen echte Spielstände durchgerechnete Systeme für unsere Liga
(32 Teams, 10 Spieltage, alle Teams treten bei jedem Spieltag gemeinsam an — eine Serie, kein
Paarungsbetrieb, deshalb keine Ticket-/Zuschauereinnahmen; historisch gab es deshalb nur Preisgeld).

**Die harten Anforderungen (Eigentümer, wörtlich zusammengefasst):**

1. Korridor der Auszahlung grob **40–100 (±)**, zusammengesetzt aus **mehreren Bausteinen** statt einer Kurve.
2. **Mehrsaisonale Verträge** sollen möglich sein.
3. Der **Salary Factor bleibt** (Konjunktur: starke und schwache Saisons).
4. **Top-Teams verdienen stark in guten Saisons und verlieren in schwachen.**
5. **Schwache Teams sind immer nach unten abgesichert.**

Zu jedem Entwurf gibt es ein visuelles Mockup (eigenständige HTML-Datei, dunkles Spiel-Layout,
echte Zahlen aus der Durchrechnung, jeweils starke Saison f=1,24 neben schwacher Saison f=0,82):

- `docs/design/mockups/entwurf-a-antritt-wertung.html`
- `docs/design/mockups/entwurf-b-serienvertrag.html`
- `docs/design/mockups/entwurf-c-apron-gleitskala.html`
- `docs/design/mockups/entwurf-d-sockel-dominant.html`

---

## 1. Ausgangslage — nachgemessen

### 1.1 Der Mechanik-Stand auf `main`

Quellen: `lib/season/prize-money.ts`, `lib/sponsor/sponsor-v3-model.ts`,
`lib/season/season-economy-factors.ts`, `lib/season/prize-placement-table.ts`.

- Die Auszahlungskurve ist `Kurve(r) = f·S̄·0,715 + f·S̄·32·0,285·p_r` — ein **flacher, rangneutraler
  Sockel** (71,5 % des Topfs) plus Prozentkurve (`SPONSOR_SEASON_PERCENTS`, 7,67 % für Platz 1 bis
  0,08 % für Platz 32). Topf = mittleres Teamgehalt S̄ × 32 × Salary Factor. **Alles skaliert mit dem
  Faktor**, auch der Sockel; einen faktorunabhängigen Boden gibt es nicht (die Kartenböden binden
  praktisch nie, Kommentar in `sponsor-v3-model.ts`).
- Der Salary Factor ist ein **Konjunktur-Multiplikator**, kein Gehaltsbezug: seeded Zufallswurf in
  **[0,82 — 1,24]** je Save und Saison (`SALARY_FACTOR_ROLL_MIN = 0.82`,
  `SALARY_FACTOR_ROLL_WIDTH = 0.42`). Der Name ist irreführend, die Sache ist richtig: er ist die
  Konjunktur, und er soll laut Code-Kommentar „DER dominante Auszahlungs-Skalierer" bleiben.
- Die Sponsorleiter friert diese Kurve wörtlich ein und normiert den Erwartungswert jeder Karte auf
  den **eigenen Startrang** (`sponsorV3AnchorWeights(startRank)`). Das Sponsorsystem ist damit ein
  Spiegel der Tabelle und konstruktionsbedingt **kein Ausgleichsmechanismus** — bestätigt.
- Der frühere rangabhängige Sockel (`BASIS_DIFFS`: viertniedrigstes Gehalt plus ein **mit dem Rang
  wachsender** Aufschlag — also invers, unten mehr) wurde bewusst durch den flachen Sockel ersetzt,
  weil die Tabelle unterhalb Faktor 0,8722 **kippte** (der Letzte verdiente mehr als der Meister,
  ~12 % aller Saisons). Wichtig für Entwurf D unten.
- Einnahmen heute: Sponsor (Leiter + Platzierungsbonus ±6 Plätze, +7,71/−5,78 gekappt +
  EV-neutrale Achsen-Sonderziele), Facility-Income. Preisgeld als Cash-Quelle ist abgeschafft.

### 1.2 Benchmark: der bespielte Live-Save (eine komplette Saison)

Save `new-game-1785174792968-8d7mdx` aus `hetzner-live.sqlite` (Branch `live-save`): Saison 1
komplett gespielt, Spieltag 10, echte Endtabelle. Gehälter aus `rosters[].salary` summiert,
Sponsorzeilen aus `standings` (Hinweis: dieser Save wurde noch mit dem **komponentenbasierten
Vorgänger-Sponsorsystem** abgerechnet — erkennbar an `archetype`/`components`-Verträgen und an der
rangabhängigen Basiszeile des alten Modells; als Benchmark für „was passiert wirtschaftlich
wirklich" taugt er trotzdem, als Benchmark für die heutige Formel nicht 1:1).

| Rk | Team | Gehalt | Sponsor-Basis | Platzierungsb. | Saisonanteil | Sponsor gesamt | GuV |
|---:|---|---:|---:|---:|---:|---:|---:|
| 1 | Mayhem Mavericks | 95,7 | 44,2 | 0,00 | 51,4 | 95,6 | −0,1 |
| 2 | Cold Steel | 69,6 | 44,6 | +1,28 | 35,1 | 79,7 | +10,1 |
| 3 | Raging Lunatics | 80,1 | 45,0 | +5,14 | 65,7 | 110,7 | +30,6 |
| 4 | Project Suicide | 79,3 | 45,4 | +2,57 | 42,5 | 87,9 | +8,6 |
| 5 | Zero Heroes | 97,7 | 45,8 | −2,89 | 50,8 | 96,6 | −1,1 |
| 6 | Silver Soldiers | 66,9 | 46,2 | +5,14 | 60,8 | 107,0 | +40,8 |
| 7 | Wrecking Legionnaires | 75,2 | 46,6 | +1,28 | 65,7 | 112,3 | +37,1 |
| 8 | Golden Gladiators | 67,1 | 47,0 | −3,85 | 68,7 | 115,7 | +47,5 |
| 16 | Vigorous Vikings | 64,0 | 50,2 | +3,85 | 38,3 | 88,5 | +24,5 |
| 24 | Dire Legion | 49,4 | 52,3 | +3,85 | −12,8 | 39,5 | −10,8 |
| 27 | Armageddon Aftermath | 51,9 | 53,2 | +5,14 | 8,4 | 61,6 | +9,7 |
| 30 | Pirate Crew | 52,6 | 54,1 | −3,85 | −12,1 | 42,0 | −11,2 |
| 31 | Stronghold Crusaders | 48,8 | 54,4 | −5,78 | −9,3 | 45,1 | −3,7 |
| 32 | Undercover Agents | 54,1 | 54,7 | −3,85 | −13,5 | 41,2 | −13,7 |

Kennzahlen (alle 32 Teams, nachgerechnet):

- **Gehaltsspreizung ist real:** 35,4 bis 97,7 nach Roster-Summen — Faktor **2,76x**, Median 65,1,
  Summe 2044,8, S̄ = 63,9. (Die gemeldeten „37,8–84,4, 2,24x" entsprechen der
  `displaySalary`-Sicht; die Settlement-relevante Roster-Summe spreizt noch stärker.) Die frühere
  Aussage „±4 %, keine Arm/Reich-Achse" galt nur für die unbespielten Dev-Saves — dort sind es
  170–325 Startbudget (1,91x) bei enger Pro-Kopf-Gehaltsspanne (1,95x auf volle Kader normiert).
- **Die Basiszeile ist invers zum Endrang:** 44,2 (Platz 1) bis 54,7 (Platz 32), Spanne 10,5.
  Ein Ausgleichs-Gefälle existierte also schon — im **alten** Modell; auf `main` ist der Sockel
  heute flach (rangneutral), weil die alte Neigung die Kipp-Inversion verursachte.
- **Der Gesamtbetrag erschlägt dieses Gefälle um Faktor 7,3:** Sponsor gesamt spannt 39,5 bis
  115,7 (Spanne 76,2), rangkorreliert: Top 8 im Schnitt 100,7, letzte 8 im Schnitt 48,1.
  Gesamtausschüttung 2394,9 gegen Gehaltssumme 2044,8.
- **Ergebnis GuV: Top 8 +21,7 · Mitte +11,2 · letzte 8 −1,3.** Reich wird reicher, Differenz 23,0.
  Die Zahl dahinter: Gehalt/Sponsoreinnahme ist bei den Top 8 **0,78**, bei den letzten 8 **1,02**
  — der Tabellenletzte arbeitet für die schwarze Null, die Spitze legt ein Fünftel zurück.
- **Rang und Gehalt korrelieren nur locker:** der Meister zahlt 95,7, aber Platz 5 zahlt 97,7 und
  Platz 32 zahlt 54,1 — mehr als Platz 29 (35,4). Das ist wichtig: jede Rechnung, die Rang und
  Gehalt gleichsetzt (wie sie mit den unbespielten Saves zwangsläufig entsteht), unterschätzt, wen
  ein System wirklich trifft.

**Folgerung:** Es braucht keine neue Einnahmequelle und erst recht keine Tickets. Die Bausteine
existieren im Prinzip (Sockel, Rangkurve, Platzierungsbonus, Konjunkturfaktor) — sie sind nur so
gewichtet, dass der platzierungsabhängige Teil alles dominiert und nichts einen Boden garantiert.
Die Entwürfe unten verschieben Gewichte und ergänzen Boden, Mehrsaisonalität und ein Gummiband.

---

## 2. Recherche — Wirtschaftssysteme aus Serien-Sportarten

Kriterium: alle Teilnehmer treten beim selben Event an, kein Heimspiel, keine nennenswerten
Zuschauereinnahmen je Team. Je System: Mechanismus, gelöstes Problem, Übertragbarkeit.

### 2.1 Formel 1 — Preisgeldsäulen, Cost Cap, ATR-Gleitskala

**Preisgeldverteilung (Concorde Agreement):** ~50 % der Serien-Profite gehen an die Teams; davon
75 % nach Konstrukteurs-Endrang, 20 % nach historischer Leistung, 5 % Ferrari-Sockel. Historisch
(Concorde 2013–2020) bestand die Zahlung aus zwei Säulen: „Column 1" — **gleicher Sockel für alle
etablierten Teams**, rangunabhängig — und „Column 2" — rein platzierungsabhängig. Gelöstes
Problem: Teams ohne Heimspieleinnahmen brauchen eine planbare Basis, sonst stirbt das Feld von
unten. Übertragbarkeit: **direkt** — unser Format ist strukturell die F1 (Serie, alle beim selben
Event, Serien-/Sponsorgeld statt Tickets).
Quellen: [Motor Sport Magazine](https://www.motorsportmagazine.com/articles/single-seaters/f1/f1-prize-money-how-much-do-gp-teams-and-drivers-really-make/),
[Wikipedia: Concorde Agreement](https://en.wikipedia.org/wiki/Concorde_Agreement),
[Las Motorsport](https://las-motorsport.com/f1/blog/f1-constructors-championship-prize-money-explained/17243/).

**Cost Cap (seit 2021, 145 Mio. $):** absolute Ausgabenobergrenze je Saison; Strafen von Geldbuße
bis Entwicklungszeit-Entzug (Red Bull 2021: 7 Mio. $ plus −10 % Aero-Testzeit). Gelöstes Problem:
Ausgaben-Wettrüsten. Übertragbarkeit: mittel — `budget` ist bei uns schon ein hartes Limit; ein
zusätzlicher Cap löst keine der fünf Anforderungen direkt.
Quellen: [Motor Sport Magazine](https://www.motorsportmagazine.com/articles/single-seaters/f1/what-is-the-f1-cost-cap/),
[formula1.com](https://www.formula1.com/en/latest/article/what-is-the-2021-f1-cost-cap-and-how-will-it-be-enforced.4l0LPbfFgBhDxjccMseCHO).

**Aerodynamic Testing Restrictions (ATR-Gleitskala):** Windkanal-/CFD-Zeit nach Endrang gestaffelt
— der Meister bekommt **70 % der Basiszeit, hinten gibt es bis 115 %**, in 5-%-Schritten, Reset
zweimal jährlich. Gelöstes Problem: das Gummiband zur Spitze, **ohne Geld umzuverteilen** —
schlechte Teams bekommen Entwicklung, nicht Almosen; der Meister bleibt reich, entwickelt aber
langsamer. Übertragbarkeit: **sehr gut** — bei uns als Trainings-/Entwicklungs-/Scouting-Effizienz
nach Endrang. Der einzige Ausgleichs-Baustein, der „Top-Teams verdienen gut" nicht verletzt.
Quellen: [formula1.com](https://www.formula1.com/en/latest/article/how-f1s-new-sliding-scale-aero-testing-rules-work-and-what-impact-they-will.pn0sG8N4A0cjbNRbdYx8a),
[RacingNews365](https://racingnews365.com/has-f1-sliding-scale-wind-tunnel-rule-worked).

### 2.2 NASCAR — Charter-System (Antrittsvertrag + Performance-Plan)

Charter = mehrjähriger Antrittsvertrag (2016–2024, dann 2025–2031): garantierter Startplatz und
**fixe Basiszahlung je Rennen** (2025: 70.000 $), dazu ein **Performance-Plan nach rollierendem
Zwei-Jahres-Schnitt der Owner-Points** (beste Charter 36 Shares, schlechteste 1) und historische
Komponenten; Charter sind handelbar (bis 40 Mio. $). Gelöstes Problem: Planbarkeit über Saisons in
einer Serie ohne Ticketeinnahmen je Team. Übertragbarkeit: **sehr gut** — Charter = unser
mehrsaisonaler Vertrag, der rollierende Schnitt glättet Absturzjahre. Das Muster für Anforderung 2.
Quellen: [Motorsport.com](https://www.motorsport.com/nascar-cup/news/how-nascars-ownership-charter-system-works/10779373/),
[EssentiallySports](https://www.essentiallysports.com/nascar-news-how-much-money-do-chartered-nascar-cup-series-teams-actually-earn-per-race-everything-to-know-about-twenty-twenty-five-charter-agreement-and-nascar-payouts/).

### 2.3 NBA — Luxussteuer, First/Second Apron

Steuer oberhalb der Tax-Line; **die Hälfte des Topfs geht gleichmäßig an Teams unter der Linie**.
Darüber zwei Aprons mit **nicht-monetären Sperren** (First: Trade-/Buyout-Restriktionen; Second:
Verlust der Mid-Level-Exception, kein Gehalts-Aggregieren im Trade, **eingefrorener Draft-Pick**,
bei Wiederholung Pick ans Rundenende). Gelöstes Problem: Dauerdominanz durch Geld — die Sperren
treffen Handlungsfähigkeit statt Kasse und wirken auch bei Besitzern, denen Geld egal ist.
Übertragbarkeit: **als Eskalationsstufe** — Linien am Ligamedian waren in unserer Probe bei
1,95x-Vollkader-Spreizung wirkungslos; gegen die eigene Einnahme gemessen (siehe 2.4) beißen sie
auch bei uns, siehe Entwurf C.
Quellen: [Hoops Rumors](https://www.hoopsrumors.com/2025/01/hoops-rumors-glossary-tax-aprons-2.html),
[theScore](https://www.thescore.com/nba/news/2940429/nb-as-2-nd-apron-explained-and-the-big-questions-it-prompts).

### 2.4 UEFA — Squad Cost Ratio (Financial Sustainability)

Kader-Kosten (Gehälter + Transfer-Abschreibungen + Berater) höchstens **70 % der EIGENEN
Einnahmen** (gestuft eingeführt: 90 % 2023/24, 80 % 2024/25, 70 % ab 2025/26); Verstöße kosten
Geldstrafen und sportliche Maßnahmen (Registrierungssperren; 2025 u. a. Chelsea 31 Mio. €).
Gelöstes Problem: Überschuldung **ohne Gleichmacherei** — wer viel einnimmt, darf viel ausgeben;
die Grenze ist relativ zur eigenen Kraft, nicht zum Ligamedian. Übertragbarkeit: **gut** — genau
die Linienform, die bewusste Ungleichheit erhält (Anforderung 4) und trotzdem Überziehen bestraft.
Quellen: [UEFA Art. 94](https://documents.uefa.com/r/UEFA-Club-Licensing-and-Financial-Sustainability-Regulations-2025/Article-94-Squad-cost-rule-Online),
[Lagom Sports Compliance](https://www.lagomsportscompliance.com/insights-events/uefa-squad-cost-rule-explained-70-percent-cap).

### 2.5 Radsport (UCI WorldTour) — das Gegenbeispiel

~87–90 % der Teambudgets kommen direkt von Sponsoren, Preisgeld sekundär, Zuschauer zahlen keinen
Eintritt; Budgets 2026 gesamt 663 Mio. €, Top-6-Teams halten 48 %, Bottom-6 nur 21 %. Gelöstes
Problem: keines — der Radsport hat **kein** Verteilsystem, und das Ergebnis ist genau die Schere,
die wir vermeiden wollen. Übertragbarkeit: als **Warnung** — reine Sponsorfinanzierung ohne
Liga-Bausteine erzeugt unkontrollierte Spreizung.
Quellen: [Cyclingnews](https://www.cyclingnews.com/pro-cycling/teams-riders/2026-mens-worldtour-budgets-total-eur663-million-as-median-male-rider-salaries-touch-eur350-000/),
[Escape Collective](https://escapecollective.com/inside-the-budgets-of-the-richest-and-poorest-worldtour-teams/).

### 2.6 Golf-Touren — garantierter Boden (Earnings Assurance)

DP World Tour seit 2023: **Earnings Assurance Programme** — wer ≥15 Events spielt, bekommt
mindestens 150.000 $; gezahlt wird die **Differenz**, wenn die Preisgelder darunter bleiben
(Top-up, kein Bonus obendrauf); dazu 1.500 $ je verpasstem Cut und 20.000 $-Vorschüsse für
Aufsteiger; PGA Tour analog. Gelöstes Problem: Existenzsicherung der schwächsten Teilnehmer in
einem reinen Leistungssystem. Übertragbarkeit: **direkt** — mechanisch exakt unser „Boden":
ein Top-up auf die Summe aller Bausteine, kein eigener Topf.
Quellen: [Sky Sports](https://www.skysports.com/golf/news/12230/12737310/dp-world-tour-players-given-pay-guarantee-in-response-to-liv-golf-threat/),
[Golf News Net](https://thegolfnewsnet.com/ryan_ballengee/2022/11/03/dp-world-tour-introduces-150000-in-guaranteed-earnings-for-players-127415/).

### 2.7 Esports (Riot Global Revenue Pool) — Drei-Töpfe-Verteilung

Riots GRP (seit 2024, LoL-Tier-1-Ligen): **50 % gleichmäßig an alle Teams, 35 % nach sportlicher
Leistung** (Liga + international), **15 % nach „Fandom"**. Vorher: Franchise-Einstieg 10 Mio. $,
50 % Revenue-Share. Gelöstes Problem: Ligen ohne Ticketeinnahmen brauchen eine explizite
Aufteilungsformel zwischen Solidarität und Leistung — die Gewichte SIND das Balancing.
Übertragbarkeit: **gut als Blaupause für die Baustein-Gewichte** (Entwurf A ist strukturell GRP).
Quellen: [Riot Games](https://www.riotgames.com/en/news/lol-esports-strategy-adjustments-2024),
[The Esports Advocate](https://esportsadvocate.net/2024/03/riot-expands-league-of-legends-esports-revenue-sharing/).

Tennis-/Golf-Einzeltouren darüber hinaus (FedEx-Cup-Bonuspool ~100 Mio. $ an die Top 125, PIP)
sind reine Spitzenverstärker ohne Teamstruktur — für uns nur Beleg, dass Serien ohne Tickets über
*Pools mit Verteilungsformel* funktionieren.

**Was wirklich passt:** F1-Säulenmodell (Sockel + Wertung) und ATR-Gleitskala, NASCAR-Charter
(Mehrsaisonvertrag + rollierender Schnitt), DP-World-Tour-Boden (Top-up), UEFA-SCR (Grenze relativ
zu eigenen Einnahmen), NBA-Apron als nicht-monetäre Eskalationsstufe.

---

## 3. Gemeinsame Rechenbasis

- **Die 32 echten Teams des Live-Saves**: echter Endrang, echte Gehaltssumme (S̄ = 63,9,
  Summe 2044,8, Spreizung 2,76x). Rang und Gehalt korrelieren nur locker — genau deshalb ist diese
  Basis strenger als jede synthetische.
- Salary Factor: 0,82 / 1,00 / 1,24 (Wurfspanne aus `season-economy-factors.ts`).
- Alle Bausteine sind als **Anteile am mittleren Teamgehalt S̄** definiert, damit sie mit der Liga
  mitwachsen (wie der heutige Topf). Konkrete Beträge im Text immer für S̄ = 63,9.
- „Netto" = Baustein-Einnahmen − Gehaltssumme. Platzierungsbonus (±7,7 max) und die EV-neutralen
  Achsen-Sonderziele bleiben in allen Entwürfen unverändert obendrauf und stehen nicht in den
  Tabellen; Facility-Income bleibt unberührt.
- Je Entwurf ausgewiesen: **GuV-Verschiebung Top 8 / Mitte / letzte 8** — die Messlatte ist das
  Live-Ist (+21,7 / +11,2 / −1,3).

Referenz — die **heutige `main`-Kurve** auf dieselben Teams gerechnet:

| Rk | Team | Gehalt | Eink. f=0,82 | Netto | Eink. f=1,00 | Netto | Eink. f=1,24 | Netto |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Mayhem Mavericks | 95,7 | 74,1 | −21,6 | 90,4 | −5,3 | 112,1 | +16,4 |
| 2 | Cold Steel | 69,6 | 72,3 | +2,7 | 88,2 | +18,6 | 109,3 | +39,8 |
| 3 | Raging Lunatics | 80,1 | 70,4 | −9,6 | 85,9 | +5,8 | 106,5 | +26,5 |
| 4 | Project Suicide | 79,3 | 68,6 | −10,7 | 83,7 | +4,4 | 103,8 | +24,4 |
| 5 | Zero Heroes | 97,7 | 66,8 | −31,0 | 81,4 | −16,3 | 101,0 | +3,2 |
| 6 | Silver Soldiers | 66,9 | 64,9 | −2,0 | 79,2 | +12,3 | 98,2 | +31,3 |
| 7 | Wrecking Legionnaires | 75,2 | 63,1 | −12,0 | 77,0 | +1,8 | 95,5 | +20,3 |
| 8 | Golden Gladiators | 67,1 | 61,3 | −5,8 | 74,7 | +7,6 | 92,6 | +25,5 |
| 9 | Hell Raisers | 76,3 | 59,4 | −16,8 | 72,5 | −3,8 | 89,9 | +13,6 |
| 10 | Black Panthers | 80,9 | 57,6 | −23,2 | 70,3 | −10,6 | 87,2 | +6,3 |
| 11 | Natures Wrath | 65,0 | 56,5 | −8,5 | 68,9 | +4,0 | 85,5 | +20,5 |
| 12 | Last Ride | 79,8 | 55,4 | −24,4 | 67,6 | −12,2 | 83,8 | +4,0 |
| 13 | Wicked Wizards | 69,3 | 54,3 | −15,0 | 66,3 | −3,0 | 82,2 | +12,9 |
| 14 | Nunchuck Ninjas | 77,2 | 53,2 | −23,9 | 64,9 | −12,3 | 80,5 | +3,3 |
| 15 | Terrible Teachers | 70,4 | 52,1 | −18,3 | 63,6 | −6,8 | 78,8 | +8,4 |
| 16 | Vigorous Vikings | 64,0 | 51,0 | −13,0 | 62,2 | −1,7 | 77,2 | +13,2 |
| 17 | Vicious & Delicious | 65,2 | 49,9 | −15,2 | 60,9 | −4,3 | 75,5 | +10,4 |
| 18 | The Chantry | 42,9 | 48,8 | +5,9 | 59,6 | +16,7 | 73,9 | +31,0 |
| 19 | The Giants | 68,2 | 47,7 | −20,5 | 58,2 | −10,0 | 72,2 | +4,0 |
| 20 | Death Peaches | 55,2 | 46,6 | −8,5 | 56,9 | +1,7 | 70,5 | +15,4 |
| 21 | Cash Creators | 41,8 | 45,9 | +4,1 | 55,9 | +14,1 | 69,4 | +27,6 |
| 22 | Mortal Sin | 52,4 | 45,2 | −7,2 | 55,1 | +2,7 | 68,3 | +15,9 |
| 23 | Lost Kingdom | 61,2 | 44,4 | −16,7 | 54,2 | −7,0 | 67,2 | +6,0 |
| 24 | Dire Legion | 49,4 | 43,7 | −5,8 | 53,3 | +3,8 | 66,0 | +16,6 |
| 25 | Blazing Beasts | 53,5 | 43,0 | −10,5 | 52,4 | −1,1 | 65,0 | +11,5 |
| 26 | Royal Court | 57,6 | 42,2 | −15,4 | 51,5 | −6,1 | 63,9 | +6,2 |
| 27 | Armageddon Aftermath | 51,9 | 41,5 | −10,5 | 50,6 | −1,4 | 62,7 | +10,8 |
| 28 | Vigilante Wranglers | 40,3 | 40,8 | +0,5 | 49,7 | +9,4 | 61,6 | +21,4 |
| 29 | Riptide Rivers | 35,4 | 40,0 | +4,6 | 48,8 | +13,4 | 60,6 | +25,1 |
| 30 | Pirate Crew | 52,6 | 39,3 | −13,3 | 47,9 | −4,7 | 59,4 | +6,8 |
| 31 | Stronghold Crusaders | 48,8 | 38,6 | −10,2 | 47,0 | −1,8 | 58,3 | +9,5 |
| 32 | Undercover Agents | 54,1 | 37,8 | −16,2 | 46,2 | −7,9 | 57,2 | +3,2 |

| GuV-Schnitt | f=0,82 | f=1,00 | f=1,24 |
|---|---:|---:|---:|
| Top 8 | −11,2 | +3,6 | +23,4 |
| Mitte (9–24) | −12,9 | −1,8 | +13,1 |
| Letzte 8 | −8,9 | −0,0 | +11,8 |
| Spanne Einnahmen | 37,8–74,1 | 46,2–90,4 | 57,2–112,1 |

Bemerkenswert: die reine `main`-Kurve produziert bei f=1 nur Top 8 +3,6 — das gemessene Live-Ist
war +21,7. **Der Großteil des Reich-wird-reicher im Live-Save kam nicht aus der Rangkurve, sondern
aus der Vertrags-/Sonderzielschicht darüber** (Top-Teams realisieren ihre „EV-neutralen" Ziele
öfter) plus der Saison-Konjunktur (Ausschüttung 2394,9 impliziert einen effektiven Faktor ~1,17).
Konsequenz für alle Entwürfe: die Leiter zu reformieren genügt nicht, wenn die Kartenschicht
obendrauf weiter systematisch nach oben leckt — die Sonderziel-Größen (G, `SPONSOR_V4_AXIS_SIZE_BY_RARITY`)
müssen beim Umbau mitkalibriert werden.

---

## 4. Entwurf A — „Antritt & Wertung" (F1-Säulenmodell)

### Bausteine

| Baustein | Formel | Betrag (S̄ = 63,9) | Skaliert mit f? |
|---|---|---:|---|
| **Antrittsgeld (Sockel)** | 0,57 · S̄, je Team, rangneutral | **36,4** | **Nein** — fix |
| **Wertungsgeld** | Topf 0,43 · S̄ · 32 · f über die bestehende Prozentkurve | Topf **879,3 · f**; Platz 1: 67,4·f, Platz 16: 25,0·f, Platz 32: 0,7·f | **Ja** — voll |
| **Boden** | Top-up auf 0,634 · S̄, wenn Sockel + Wertung darunter | **40,5** | Nein |
| **Platzierungsbonus** | unverändert (±6 Plätze) | — | Nein |
| **Antrittsvertrag (mehrsaisonal)** | Sockelhöhe bei Unterschrift für 2–3 Saisons **eingefroren** (0,57 · S̄ des Unterschriftsjahres) | — | Nein |

Idee: die heutige eine Kurve wird in zwei Säulen zerlegt (F1 Column 1/2, Riot-GRP 50/35). Der
Sockel ist **faktorunabhängig** — das ist der ganze Trick: die gesamte Konjunktur-Exposition
wandert in den Wertungsteil, und der ist oben groß (67,4·f) und unten winzig (0,7·f). **Die Spitze
trägt das Konjunkturrisiko, der Keller nicht.** Der Boden ist ein Top-up nach DP-World-Tour-Muster.
Der Antrittsvertrag macht den Sockel mehrsaisonal: unterschreibt man nach einer starken Liga-Saison
(hohes S̄), sitzt man 2–3 Saisons auf einem hohen Sockel — der Zeitpunkt wird eine Entscheidung.

### Durchrechnung (32 echte Teams, Auszug + Gruppenwerte)

| Rk | Team | Gehalt | Eink. f=0,82 | Netto | Eink. f=1,00 | Netto | Eink. f=1,24 | Netto |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Mayhem Mavericks | 95,7 | 91,7 | −4,0 | 103,9 | +8,2 | 120,0 | +24,3 |
| 2 | Cold Steel | 69,6 | 89,0 | +19,4 | 100,5 | +31,0 | 115,9 | +46,3 |
| 5 | Zero Heroes | 97,7 | 80,6 | −17,1 | 90,3 | −7,4 | 103,3 | +5,5 |
| 8 | Golden Gladiators | 67,1 | 72,3 | +5,2 | 80,2 | +13,1 | 90,7 | +23,6 |
| 12 | Last Ride | 79,8 | 63,5 | −16,3 | 69,5 | −10,3 | 77,4 | −2,4 |
| 16 | Vigorous Vikings | 64,0 | 56,9 | −7,1 | 61,4 | −2,6 | 67,4 | +3,4 |
| 20 | Death Peaches | 55,2 | 50,3 | −4,9 | 53,3 | −1,8 | 57,4 | +2,2 |
| 24 | Dire Legion | 49,4 | 45,8 | −3,6 | 47,9 | −1,6 | 50,6 | +1,2 |
| 28 | Vigilante Wranglers | 40,3 | 41,4 | +1,1 | 42,5 | +2,2 | 43,9 | +3,7 |
| 30 | Pirate Crew | 52,6 | 40,5 | −12,1 | 40,5 | −12,1 | 40,6 | −12,1 |
| 32 | Undercover Agents | 54,1 | 40,5 | −13,6 | 40,5 | −13,6 | 40,5 | −13,6 |

| GuV-Schnitt | f=0,82 | f=1,00 | f=1,24 | (Ist heute: +21,7 / +11,2 / −1,3) |
|---|---:|---:|---:|---|
| Top 8 | **+3,1** | **+13,1** | **+26,5** | Spitze verdient, Konjunktur schlägt voll durch |
| Mitte (9–24) | −7,2 | −2,8 | +3,1 | Mittelfeld unter Druck |
| Letzte 8 | −7,5 | −6,7 | −5,6 | Einnahme gesichert, Netto nicht |
| Spanne Einnahmen | 40,5–91,7 | 40,5–103,9 | 40,5–120,0 | Korridor ✓ |

**Schwach gegen stark:** Der Meister (Gehalt 95,7) schwankt 91,7 → 120,0 (netto −4,0 → +24,3);
der überzahlte Platz 5 (97,7) verliert selbst im Boom fast alles davon (+5,5) — Überziehen wird
bestraft, Effizienz belohnt (Cold Steel, Platz 2 mit 69,6 Gehalt: +19,4 bis +46,3). Platz 30–32
stehen konjunkturfest auf 40,5.

### Anforderungscheck

| Anforderung | Erfüllt? | Beleg |
|---|---|---|
| Korridor 40–100 ± | **Ja** | f=1: 40,5–103,9; Extremfälle 40,5 / 120,0 |
| Mehrsaisonale Verträge | Teilweise | Antrittsvertrag (Sockel 2–3 Saisons eingefroren) — echt, aber nur ein Baustein |
| Salary Factor bleibt | **Ja** | wirkt voll auf den Wertungstopf (879,3·f) |
| Top verdient/verliert mit Konjunktur | **Ja** | Top 8: +3,1 → +26,5; Meister −4,0 → +24,3 |
| Boden für Schwache | Einnahmenseitig ja | 40,5 garantiert; ein Kellerteam mit 54,1 Gehalt macht trotzdem −13,6 |

### Kosten und Risiken

**Umbau (klein):** `buildPrizeMoneyTable` bekommt zwei Faktor-Anwendungsstellen (Sockel ohne f,
Kurventeil mit f) plus eine `max(·, Boden)`-Zeile; Prozentkurve, Settlement, Leiter-Einfrierung und
Anzeige übernehmen die neue Kurve unverändert, weil sie weiter „eine Leiter je Rang" ist. Neu: der
Antrittsvertrag als kleiner saisonübergreifender Zustand (eingefrorener Sockel + Restlaufzeit).

**Risiken:**

- *Reich-wird-reicher bleibt möglich:* Top 8 sind selbst bei f=0,82 im Schnitt positiv (+3,1) —
  ohne Gegengewicht (ATR-Gleitskala aus Entwurf C) akkumuliert die effiziente Spitze weiter. A
  senkt die Schere gegenüber dem Live-Ist (Top-8-Vorsprung vor den letzten 8: 19,8 statt 23,0 bei
  f=1), beseitigt sie nicht.
- *Boden ≠ schwarze Null:* der Boden sichert die Einnahme, nicht das Netto. Kellerteams mit
  Gehältern über ~40 müssen schrumpfen. Das ist die ehrliche Auslegung von „abgesichert" — wer die
  schwarze Null garantieren will, landet bei Entwurf D (und dessen Problemen).
- *Boden als Hängematte:* 40,5 garantiert bei einem 26er-Gehalt (Dev-Save-Konstellation) = +13,5
  sicher. Deckel-Idee: voller Boden nur bei Kadergröße ≥ `rosterMinTarget`.
- *Schwächere Deflation:* bei f=0,82 schüttet die Liga 1894 aus statt 1677 (heutige Kurve) — die
  Flaute trifft die Liga insgesamt milder. Gewollt (der Sockel soll ja tragen), aber es dämpft den
  Spar-Druck schwacher Saisons.

**Stellschraube „geneigter Sockel":** Der faktorunabhängige Sockel kann leicht invers geneigt
werden (z. B. 0,50 · S̄ + 0,25 je Platz = 31,9 → 39,7), ohne die Kipp-Gefahr des alten
`BASIS_DIFFS`-Modells — die Inversion entstand damals, weil der geneigte Sockel faktor-fix war,
der Rest aber mit f schrumpfte; hier ist der Wertungsteil auch bei f=0,82 überall steiler als die
Neigung (Kurvenschritt Platz 31→32: 1,1 > 0,25). Effekt: letzte 8 ≈ +3 Netto, Top 8 ≈ −3, der
Boden wird fast überflüssig. Das ist der kontrollierte Mittelweg Richtung Entwurf D.

---

## 5. Entwurf B — „Serienvertrag" (NASCAR-Charter-Modell)

### Bausteine

| Baustein | Formel | Betrag (S̄ = 63,9) | Skaliert mit f? |
|---|---|---:|---|
| **Charter (Serienvertrag)** | 0,523 · S̄, je Team; Laufzeit **3 Saisons**, Höhe bei Unterschrift eingefroren | **33,4** | Nein |
| **Performance-Plan** | Topf 0,477 · S̄ · 32 · f; lineare Shares 36…5 nach **rollierendem 2-Saisons-Rangschnitt** | Topf **975,5 · f**; Platz 1: 53,5·f, Platz 16: 31,2·f, Platz 32: 7,4·f | Ja |
| **Boden** | Top-up auf 0,634 · S̄ | **40,5** | Nein |
| **Platzierungsbonus** | unverändert | — | Nein |

Idee: NASCAR wörtlich. Der Charter ist der mehrsaisonale Vertrag als *zentrales* Element; der
Leistungsteil hängt am Schnitt der letzten zwei Saisons (Shares 36 → 5, linear). Doppelte
Glättung: Charter über 3 Saisons, Rangschnitt über 2. Ein Absturz von Platz 1 auf 10 kostet im
Folgejahr nur den halben Weg (Schnitt 5,5 statt 10 → ~6,7 Dämpfung bei f=1). Die lineare
Share-Kurve ist bewusst flacher als die Prozentkurve (Leistungsteil Platz 1 : Platz 32 = 7,2:1
statt 96:1) — Charakter „stetig und planbar", Differenzierung über Kumulierung statt Jahres-Peaks.

### Durchrechnung (32 echte Teams, Auszug + Gruppenwerte; 1. Saison, Schnitt = Ist-Rang)

| Rk | Team | Gehalt | Eink. f=0,82 | Netto | Eink. f=1,00 | Netto | Eink. f=1,24 | Netto |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Mayhem Mavericks | 95,7 | 77,3 | −18,4 | 86,9 | −8,8 | 99,8 | +4,1 |
| 2 | Cold Steel | 69,6 | 76,1 | +6,5 | 85,5 | +15,9 | 98,0 | +28,4 |
| 5 | Zero Heroes | 97,7 | 72,4 | −25,3 | 81,0 | −16,7 | 92,4 | −5,3 |
| 8 | Golden Gladiators | 67,1 | 68,8 | +1,7 | 76,5 | +9,4 | 86,9 | +19,8 |
| 12 | Last Ride | 79,8 | 63,9 | −15,9 | 70,6 | −9,2 | 79,5 | −0,3 |
| 16 | Vigorous Vikings | 64,0 | 59,0 | −5,0 | 64,6 | +0,7 | 72,1 | +8,1 |
| 20 | Death Peaches | 55,2 | 54,1 | −1,0 | 58,7 | +3,5 | 64,8 | +9,6 |
| 24 | Dire Legion | 49,4 | 49,3 | −0,2 | 52,7 | +3,3 | 57,4 | +7,9 |
| 28 | Vigilante Wranglers | 40,3 | 44,4 | +4,1 | 46,8 | +6,5 | 50,0 | +9,7 |
| 30 | Pirate Crew | 52,6 | 42,0 | −10,7 | 43,8 | −8,8 | 46,3 | −6,3 |
| 32 | Undercover Agents | 54,1 | 40,5 | −13,6 | 40,9 | −13,2 | 42,6 | −11,4 |

| GuV-Schnitt | f=0,82 | f=1,00 | f=1,24 | (Ist heute: +21,7 / +11,2 / −1,3) |
|---|---:|---:|---:|---|
| Top 8 | −5,9 | +2,8 | +14,4 | Spitze knapp positiv im Normaljahr |
| Mitte (9–24) | −5,3 | +0,2 | +7,5 | ausgeglichen |
| Letzte 8 | −5,4 | −3,2 | −0,2 | am wenigsten Druck aller Entwürfe |
| Spanne Einnahmen | 40,5–77,3 | 40,9–86,9 | 42,6–99,8 | Korridor eng ✓ |

### Anforderungscheck

| Anforderung | Erfüllt? | Beleg |
|---|---|---|
| Korridor 40–100 ± | **Ja, eng** | f=1: 40,9–86,9; f=1,24: bis 99,8 |
| Mehrsaisonale Verträge | **Ja, zentral** | Charter 3 Saisons + rollierender 2-Saisons-Schnitt |
| Salary Factor bleibt | **Ja** | Performance-Topf 975,5·f |
| Top verdient/verliert mit Konjunktur | **Eingeschränkt** | Meister netto −8,8 bei f=1; Top 8 nur +2,8 |
| Boden für Schwache | Einnahmenseitig ja | 40,5; Gruppen-Netto der letzten 8 fast neutral |

### Kosten und Risiken

**Umbau (mittel):** neue Share-Verteilung neben der Prozentkurve, persistenter rollierender
Rangschnitt je Team, Charter-Zustand (Höhe + Restlaufzeit + Neuverhandlung). Sponsorleiter-
Einfrierung und KI-Kartenbewertung müssen die neue Kurvenform und den Schnitt kennen.

**Risiken:**

- *Die Spitze verhungert im Normaljahr:* Meister-Gehalt 95,7 gegen Maximaleinnahme 86,9 bei f=1.
  Ein Spitzenkader ist nur im Boom tragfähig; die flache Share-Kurve bezahlt ihn nicht. Steilt man
  die Shares auf, nähert sich B an A an und verliert seinen Charakter.
- *Doppelte Glättung = Trägheit:* Aufsteiger warten bis zu zwei Saisons auf ihr Geld —
  Frust-Moment für den menschlichen Spieler nach einer starken Saison.
- *Charter-Timing als Meta-Spiel:* Unterschrift gezielt nach einer starken Liga-Saison friert
  einen hohen Charter ein; die KI muss das mitspielen können, sonst ist es ein Human-Exploit.

---

## 6. Entwurf C — „Apron & Gleitskala" (NBA/UEFA/F1-ATR-Aufsatz)

### Bausteine

C lässt die heutige Leiter (Sockel 71,5 % + Prozentkurve, alles ·f) **unangetastet** und montiert
vier Bausteine darauf:

| Baustein | Regel | Zahlen |
|---|---|---|
| **Boden** | Top-up auf 0,634 · S̄ (wie A/B) | 40,5 |
| **Kaderkosten-Linie 1 („Apron 1", UEFA-Logik)** | Gehaltssumme > **110 % der eigenen Vorjahres-Einnahme** → Abgabe 0,5 C je C darüber | Linie je Team verschieden: Meister 99,4, Platz 32 50,8 |
| **Kaderkosten-Linie 2 („Apron 2")** | > **130 %** → 1,5 C je C darüber **plus nicht-monetäre Sperre** in der Folgesaison: keine legendären Sponsorkarten, kein Zugriff auf die Top-Slots des Spielergenerators | — |
| **Ausgleichstopf** | Hälfte der Abgaben gleichmäßig an Teams mit Quote < 90 %; Rest verfällt | — |
| **ATR-Gleitskala (F1)** | Entwicklungs-/Trainingseffizienz nach Endrang: **70 % (Platz 1) … 115 % (Platz 32)**, +1,45 Prozentpunkte je Platz, Reset je Saison | nicht-monetär |

Die Linien liegen bewusst **relativ zur eigenen Vorjahres-Einnahme** (UEFA Squad Cost Ratio),
nicht am Ligamedian: die Median-Apron-Probe war bei 1,95x-Spreizung wirkungslos. Die
Eigen-Einnahmen-Linie erhält gewollte Ungleichheit — wer viel einnimmt, darf viel zahlen — und
bestraft nur **Überziehen über die eigene Kraft**.

### Durchrechnung (32 echte Teams)

Mit den echten Rängen und Gehältern **beißt die Abgabe** — anders als in der synthetischen Probe:
bei f=1 zahlen **9 Teams zusammen 16,7** in den Topf, 7 Empfänger bekommen je 1,19. Die Zahler
sind nicht „die Reichen", sondern die **Überzieher relativ zum erreichten Rang**:

| Zahler (f=1) | Rang | Gehalt | Linie 1 (110 %) | Abgabe |
|---|---:|---:|---:|---:|
| Zero Heroes | 5 | 97,7 | 89,6 | 4,09 |
| Nunchuck Ninjas | 14 | 77,2 | 71,4 | 2,88 |
| Last Ride | 12 | 79,8 | 74,4 | 2,72 |
| The Giants | 19 | 68,2 | 64,1 | 2,09 |
| Black Panthers | 10 | 80,9 | 77,3 | 1,77 |
| Undercover Agents | 32 | 54,1 | 50,8 | 1,65 |
| … (3 weitere) | | | | 0,24–0,78 |

Auszug Gesamtwirkung:

| Rk | Team | Gehalt | Eink. f=0,82 | Netto | Eink. f=1,00 | Netto | Eink. f=1,24 | Netto |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Mayhem Mavericks | 95,7 | 74,1 | −21,6 | 90,4 | −5,3 | 112,1 | +16,4 |
| 5 | Zero Heroes | 97,7 | 62,7 | −35,1 | 77,3 | −20,4 | 96,9 | −0,9 |
| 16 | Vigorous Vikings | 64,0 | 51,0 | −13,0 | 62,2 | −1,7 | 77,2 | +13,2 |
| 21 | Cash Creators | 41,8 | 47,1 | +5,3 | 57,1 | +15,3 | 70,6 | +28,8 |
| 29 | Riptide Rivers | 35,4 | 41,2 | +5,8 | 50,0 | +14,6 | 61,8 | +26,3 |
| 32 | Undercover Agents | 54,1 | 40,5 | −13,6 | 44,5 | −9,6 | 55,6 | +1,5 |

| GuV-Schnitt | f=0,82 | f=1,00 | f=1,24 | (Ist heute: +21,7 / +11,2 / −1,3) |
|---|---:|---:|---:|---|
| Top 8 | −11,3 | +3,5 | +23,4 | wie Status quo |
| Mitte (9–24) | −13,4 | −2,3 | +12,6 | Überzieher zahlen |
| Letzte 8 | −7,9 | +0,0 | +11,8 | Boden greift bei f=0,82 |
| Spanne Einnahmen | 40,5–74,1 | 44,5–90,4 | 55,6–112,1 | Korridor ✓ |

Der eigentliche Ausgleich in C ist aber nicht das Geld, sondern die **ATR-Gleitskala**: der
Meister entwickelt mit 70 % Tempo, Platz 16 mit 91,8 %, Platz 32 mit 115 %. Über die
Progressionskette ist das ein Gummiband, das die Tabelle durchmischt, ohne einem Top-Team einen
Cent zu nehmen — die F1 hat für den Ausgleich genau diesen Kanal gewählt, nicht den Geldtopf.

### Anforderungscheck

| Anforderung | Erfüllt? | Beleg |
|---|---|---|
| Korridor 40–100 ± | **Ja** | f=1: 44,5–90,4 |
| Mehrsaisonale Verträge | **Nein** | C hat keinen Vertragsbaustein — ehrlichste Schwäche |
| Salary Factor bleibt | **Ja** | ganze Leiter skaliert wie heute |
| Top verdient/verliert mit Konjunktur | **Ja** | Top 8: −11,3 → +23,4 (volle Exposition) |
| Boden für Schwache | Einnahmenseitig ja | 40,5; dazu Ausgleichstopf (je 1,19 bei f=1) |

### Kosten und Risiken

**Umbau (klein bis mittel):** Boden = eine Zeile im Settlement. Abgabe/Topf = neuer
Saisonabschluss-Schritt mit persistierter Vorjahres-Einnahme. ATR = ein Multiplikator in der
Progressionskette plus Anzeige. Sperren = Filter in Kartengenerierung und Generator.

**Risiken:**

- *Die Abgabe trifft auch den Keller:* Undercover Agents (Platz 32, Gehalt 54,1 > Linie 50,8)
  zahlen 1,65, obwohl sie sportlich unten stehen — Doppelbestrafung von schlechter Saison UND
  Überzahlung. Vertretbar als Disziplin, aber erklärungsbedürftig; mindestens sollte der Boden
  VOR der Abgabe gerechnet werden (so gerechnet).
- *ATR wirkt verzögert und unsichtbar:* Entwicklungs-Malus ist schwerer lesbar als Geld — braucht
  gute UI (Mockup zeigt einen Vorschlag), sonst fühlt sich der Meister grundlos gebremst.
- *C repariert die Konjunktur-Asymmetrie NICHT:* der Meister verliert bei f=0,82 weiter 21,6.
  Wer Anforderung 4 in der Form „Spitze exponiert, Keller geschützt" will, braucht A oder D als
  Unterbau; C ist ein Aufsatz, kein Fundament.

---

## 7. Entwurf D — „Sockel-dominant" (geprüfte Eigentümer-Variante)

Explizit zu prüfen war: *platzierungsabhängigen Anteil verkleinern, Sockel-Neigung vergrößern,
und „Top verdient gut" über den Salary Factor statt über die Platzierung tragen.*

### Bausteine

| Baustein | Formel | Betrag (S̄ = 63,9) | Skaliert mit f? |
|---|---|---:|---|
| **Geneigter Sockel** | 0,72 · S̄ am Platz 1, **+0,45 je Platz** (invers: unten mehr) | **46,0 → 60,0** | **Nein** — fix |
| **Wertungsgeld (klein)** | Topf 0,27 · S̄ · 32 · f über die Prozentkurve | Topf **552,1 · f**; Platz 1: 42,3·f, Platz 16: 15,7·f, Platz 32: 0,4·f | Ja |
| Boden | implizit — der Sockel selbst ist ≥ 46 | — | — |

Der geneigte Sockel ist hier gefahrlos, weil er faktorunabhängig ist und der Wertungsteil selbst
bei f=0,82 überall steiler fällt als die Neigung steigt (kleinster Kurvenschritt 0,68 > 0,45) —
die alte `BASIS_DIFFS`-Inversion kann nicht zurückkommen. Erst unterhalb f ≈ 0,53 würde die
Tabelle kippen; die Wurfspanne endet bei 0,82.

### Durchrechnung (32 echte Teams, Auszug + Gruppenwerte)

| Rk | Team | Gehalt | Eink. f=0,82 | Netto | Eink. f=1,00 | Netto | Eink. f=1,24 | Netto |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Mayhem Mavericks | 95,7 | 80,7 | −15,0 | 88,4 | −7,4 | 98,5 | +2,8 |
| 2 | Cold Steel | 69,6 | 79,5 | +9,9 | 86,7 | +17,1 | 96,4 | +26,8 |
| 5 | Zero Heroes | 97,7 | 75,6 | −22,2 | 81,7 | −16,1 | 89,8 | −8,0 |
| 8 | Golden Gladiators | 67,1 | 71,7 | +4,6 | 76,7 | +9,6 | 83,3 | +16,2 |
| 12 | Last Ride | 79,8 | 68,0 | −11,8 | 71,7 | −8,1 | 76,7 | −3,1 |
| 16 | Vigorous Vikings | 64,0 | 65,6 | +1,6 | 68,4 | +4,4 | 72,2 | +8,2 |
| 20 | Death Peaches | 55,2 | 63,3 | +8,1 | 65,2 | +10,0 | 67,7 | +12,6 |
| 24 | Dire Legion | 49,4 | 62,2 | +12,8 | 63,5 | +14,1 | 65,3 | +15,8 |
| 28 | Vigilante Wranglers | 40,3 | 61,3 | +21,0 | 62,0 | +21,7 | 62,9 | +22,6 |
| 30 | Pirate Crew | 52,6 | 60,8 | +8,2 | 61,2 | +8,5 | 61,7 | +9,0 |
| 32 | Undercover Agents | 54,1 | 60,3 | +6,3 | 60,4 | +6,3 | 60,5 | +6,4 |

| GuV-Schnitt | f=0,82 | f=1,00 | f=1,24 | (Ist heute: +21,7 / +11,2 / −1,3) |
|---|---:|---:|---:|---|
| Top 8 | −2,7 | +3,6 | +11,9 | Spitze fast konjunkturneutral |
| Mitte (9–24) | +1,9 | +4,6 | +8,3 | |
| Letzte 8 | **+11,9** | **+12,5** | **+13,3** | Keller verdient IMMER am meisten |
| Spanne Einnahmen | 60,3–80,7 | 60,4–88,4 | 60,5–98,5 | Korridor verfehlt (60–98 statt 40–100) |

### Ehrliches Prüfergebnis

Die Hypothese „das würde alle vier Anforderungen zugleich erfüllen" bestätigt sich **nicht**:

1. **Boden: übererfüllt.** Die letzten 8 sind in jeder Konjunktur die profitabelste Gruppe
   (+11,9 bis +13,3) — das ist keine Absicherung mehr, sondern eine Prämie fürs Untenstehen.
   Tanking wird strikt rational.
2. **„Top verdient gut in starken Saisons": verfehlt.** Der Meister mit echtem Meistergehalt
   erreicht selbst bei f=1,24 nur +2,8; die Top 8 (+11,9) verdienen im Boom weniger als der
   Keller sicher bekommt. Der kleine Wertungstopf kann Spitzengehälter nicht tragen, und der
   Faktor multipliziert eben nur diesen kleinen Topf — „über die Konjunktur tragen" funktioniert
   nicht, wenn der konjunkturabhängige Teil klein ist. Das ist ein struktureller Zielkonflikt,
   keine Kalibrierungsfrage.
3. **Korridor: verfehlt** (60–98 statt 40–100). Absenken des Sockels Richtung 40 macht D zu A mit
   geneigtem Sockel (siehe Stellschraube in Abschnitt 4).
4. **Liga-Inflation:** D schüttet in JEDER Konjunktur mehr aus als die Gehaltssumme
   (2148/2248/2380 gegen 2044,8) — Geld entsteht dauerhaft aus dem Nichts.

Was von D **bleiben sollte:** die moderat geneigte, faktorunabhängige Sockel-Idee als
Stellschraube in Entwurf A (0,25 je Platz statt 0,45, Sockelanteil 0,50 statt 0,72) — sie holt
die letzten 8 auf ≈ +3 Netto, ohne die Spitze zu entkernen und ohne den Korridor zu sprengen.

---

## 8. Querprobe: unbespielte Dev-Saves

Gegen den unbespielten `save-singleplayer-dev` (Rang = Gehaltsrang als wohlwollendste Annahme,
S̄ = 63,1, Spreizung 3,49x fast nur aus Kadergrößen 3–12) ergeben sich dieselben Korridore und
dieselben qualitativen Befunde: A: 40,0–102,6 bei f=1, Meister −2,0/+26,0 über die Faktorspanne,
Keller fix 40,0; B: 40,4–85,9, Meister bei f=1 −6,7; D-Verhalten analog. Einzige nennenswerte
Abweichung: die Apron-Abgabe in C erzeugt dort **0,0** Topf, weil bei perfekter Rang-Gehalt-
Korrelation niemand über der eigenen Linie liegt — die Abgabe lebt von der Rang-Gehalt-
*Diskrepanz*, die nur echte Spielstände haben. Auf ein synthetisches Spreizszenario (2,8x auf
volle Kader) reagieren alle Entwürfe wie im Live-Save, nur stärker: A treibt die Spitze auf +26
Netto bei f=1 (ohne Gegengewicht Spirale), B bleibt der stabilste, D subventioniert den Keller.

---

## 9. Empfehlung — und was jeweils NICHT erfüllt wird

**Empfehlung: Entwurf A als Kern (mit moderat geneigtem Sockel als Stellschraube), plus
ATR-Gleitskala und Apron-Sperren aus Entwurf C. Beim Umbau die Sonderziel-Größen der
Kartenschicht mitkalibrieren** (Abschnitt 3: sie, nicht die Kurve, erzeugte den Großteil des
gemessenen +21,7-Vorsprungs der Top 8).

Begründung:

1. A ist der einzige Entwurf, der Korridor, Konjunktur-Asymmetrie (Spitze exponiert, Keller
   entkoppelt) und Einnahmen-Boden gleichzeitig und strukturell liefert — zum kleinsten
   Umbaupreis, weil er die bestehende Kurve zerlegt statt ersetzt.
2. As Rest-Risiko (effiziente Spitze akkumuliert) ist genau das Problem, für das die F1 die
   ATR-Gleitskala gebaut hat: ein nicht-monetäres Gummiband, das „Top verdient gut" nicht
   verletzt. Die Apron-Linie relativ zur eigenen Einnahme (C) diszipliniert zusätzlich die
   Überzieher — im Live-Save 9 reale Zahler, quer durch die Tabelle.
3. Der Antrittsvertrag deckt „Verträge über mehrere Seasons" in kleiner Form ab; wenn sich das
   Element bewährt, ist Bs Charter (verhandelbare Höhe + Laufzeit, rollierender Schnitt) die
   Ausbaustufe — B muss dafür nicht als Ganzes kommen.

**Ehrliche Lücken je Entwurf:**

- **A:** „Mehrsaisonale Verträge" nur minimal (eingefrorener Sockel ist ein dünner Vertrag).
  „Abgesichert" heißt Einnahme ≥ 40,5, nicht schwarze Null — ein Kellerteam mit 54er-Gehalt macht
  −13,6, bis es schrumpft. Und die effiziente Spitze bleibt auch bei f=0,82 leicht positiv; ohne
  ATR-Ergänzung erfüllt A „Top verliert in schwachen Saisons" nur für Teams, die ihre Einnahmen
  auch ausgeben.
- **B:** verletzt „Top-Teams können gut verdienen" im Normaljahr (Meister −8,8 bei f=1; erst ab
  f ≈ 1,1 positiv). Bestes Mehrsaisonen-System, robustestes Mittelfeld, aber es bezahlt
  Spitzenkader strukturell zu schlecht — und reagiert am trägsten auf sportliche Bewegung.
- **C:** erfüllt „mehrsaisonale Verträge" nicht und lässt die Konjunktur-Asymmetrie des Status
  quo unrepariert (Meister −21,6 bei f=0,82 bleibt). Die Abgabe funktioniert — aber als
  Disziplin-, nicht als Umverteilungsinstrument (16,7 Topf bei 2045 Gehaltsmasse), und sie trifft
  auch Kellerteams. Wer C allein wählt, wählt Boden + Gleitskala + Sperren, kein neues Geldsystem.
- **D:** widerlegt in der geprüften Form — Korridor verfehlt (60–98), „Top verdient gut" verfehlt
  (Meister +2,8 im Boom), Keller wird zur profitabelsten Position der Liga, Dauerinflation. Der
  brauchbare Kern (geneigter, faktorunabhängiger Sockel) ist als Stellschraube in A übernommen.

**Voraussetzung aller Entwürfe:** Die Gehaltsspreizung (im Live-Save real 2,76x) muss aus dem
Spiel kommen — Transfermarkt, Kaderpolitik, Startbudgets (170–325). Die Entwürfe verteilen
Spreizung; sie erzeugen keine. Und: alle Zahlen hier sind Leiter-Ebene; die Kartenschicht
(Achsen-Sonderziele, Rarity-Hebel) rechnet obendrauf und muss beim Umbau auf dieselben Ziele
eingenordet werden, sonst wiederholt sie das Live-Save-Muster.

---

## Anhang: Reproduzierbarkeit

Rechenbasis: Live-Save `new-game-1785174792968-8d7mdx` aus `hetzner-live.sqlite.gz` (Branch
`live-save`): Endränge aus `season_states.standings[].rank`, Gehälter als Summe
`rosters[].salary`, Sponsor-Ist aus `standings[].sponsor*`/`guv`. Querprobe:
`data/online-saves/save-singleplayer-dev.json.gz` (Rang = Gehaltsrang). Prozentkurve und
Konstanten aus `lib/season/prize-money.ts`. Parameter: Sockelanteile A 0,57 / B 0,523 / D 0,72 +
0,45 je Platz, Bodenanteil 0,634, Wertungsanteile A 0,43 / B 0,477 (Shares `37 − Rang`, Summe
656) / D 0,27, Apron-Linien C 110 %/130 % der Vorjahres-Einnahme (bei f=1), Abgabesätze 0,5/1,5,
Ausgleich an Quote < 90 %, ATR 70 % + 1,45 Prozentpunkte je Platz. Faktoren 0,82/1,00/1,24 aus
`SALARY_FACTOR_ROLL_MIN/WIDTH`.
