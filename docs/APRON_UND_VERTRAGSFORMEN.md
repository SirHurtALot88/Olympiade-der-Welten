# Apron und Vertragsformen — Messung und Plan (12.08.2026)

> **Stand nach Chris' Entscheid (12.08., nachmittags):** (1) Apron-Bemessung wird auf das
> verhandelte Gehalt umgestellt — „ja!" (Schritt 3 ist damit beauftragt, mit der dort
> verschärften Bemessungsregel). (2) Die KI darf faktorschwache Saisons scharf ausnutzen —
> „ja, wenn sie es hin bekommt" (Schritt 1 wie geplant). (3) Die Formwahl-Schwellen hat Chris an
> Fable delegiert — Herleitung mit Messwerten in **Abschnitt 5**.

Anlass (Chris, wörtlich): *„vllt kannst du dir mit fable das thema mit apron und vertraegen noch
mal anschauen. dass teams versuchen gute vertraege zu verhandeln und zb je nach salary factors mal
back loaded oder front loaded machen um die gehaelter auch zu managen. Weil apron vermeiden kann
mehr bringen als ein gut verhandelter vertrag vor allem bei teureren teams"*

Dieses Dokument ist ein **Plan mit Belegen**, kein Umbau. Alle Zahlen stammen aus dem
Live-Abbild vom **12.08.2026, 08:43 UTC** (Push-Zeitpunkt; jüngster Schreibzugriff des aktiven
Saves 11.08. ≈ 18:57, also 13,8 h vor dem Push — seither wurde nicht gespielt, das Abbild ist für
Messungen brauchbar). Messkörper:

- `new-game-1785823388048-1hf25q` — Saison 2, Spieltag 10, zwei abgerechnete Apron-Saisons.
- `new-game-1786465783606-0kalpx` — Saison 1, Spieltag 2 (der aktive Stand).

Messwerkzeuge (Wegwerf-Skripte nach dem Muster `scripts/apron-kalibrierung.ts`, nur lesend auf der
Abbild-Kopie): Apron-Logs/Hochrechnung/Formen/Margen, Formwechsel-Experiment am Top-Zahler,
Abbau-Ziel mit beiden Faktor-Horizonten. Schritt 0 unten macht daraus eine wiederholbare Messung.

---

## 1. Trägt die These? — Ja in der Größenordnung, aber der Hebel ist ein anderer

### 1.1 Was die Apron-Überschreitung heute wirklich kostet (gemessen)

`new-game-1785823388048-1hf25q`, echte Buchungen aus `apronSettlementLogs` (64 Einträge):

| Saison | Zahler | Empfänger | Netto min | Netto max | Ligasumme |
|---|---|---|---|---|---|
| season-1 | 10 | 22 | −12,0 (Hell Raisers) | +2,8 | **0,00** |
| season-2 | 8 | 24 | −16,6 (Hell Raisers) | +2,4 | **0,00** |

Die frühere Messung (−16,60 bis +2,80, Ligasumme 0,00) ist damit **bestätigt** — der Topf
verteilt nur um, es fließt kein Geld aus der Liga.

Einordnung gegen die Jahresgehaltssumme (echt gebuchte Summe, `getTeamActualSalaryTotal`):

- Hell Raisers: Abgabe 16,6 bei Gehaltssumme 97,7 → **17 % einer Jahresgehaltssumme**.
- Mayhem Mavericks: 16,0 bei 107,7 → 14,9 %. Weitere Zahler: 2–8 %.
- Aktiver Save `0kalpx` (Hochrechnung Saison 1, f=1,12): Topf 38,2, 11 Zahler, Spitze Last Ride
  10,4 (11,2 % der Gehaltssumme), Ausgleich je Empfänger 1,9.

### 1.2 Was eine gute Vertragsverhandlung einbringt (gemessen)

Verhandlungs-Marge = `expectedSalary − annualSalary` (Formel-Gehalt minus verhandeltes Gehalt),
über alle Roster-Verträge:

- `1hf25q`: 340 Verträge, Mittel **0,47 je Vertrag**, Spanne −4,5 … +4,9. Bestes Team über den
  GESAMTEN Kader: +16,2 (Royal Court), schlechtestes −5,0.
- `0kalpx`: 343 Verträge, Mittel −0,10, Spanne −4,3 … +3,5; bestes Team +12,7.

**Fazit These:** Eine einzelne Saison-Abgabe eines teuren Teams (16,6) entspricht der
Verhandlungs-Marge eines KOMPLETT perfekt verhandelten Kaders und ist das ~35-fache der mittleren
Marge eines einzelnen Vertrags. Chris' Intuition stimmt in der Größenordnung: **für teure Teams
ist die Apron der größere Posten.**

### 1.3 Aber: weder Vertragsform NOCH Verhandlung erreichen die Apron

Das ist der entscheidende Befund, belegt im Code und im Experiment:

- Die Apron bemisst auf `getTeamDisplaySalaryTotal` → `contract.expectedSalary`
  (`lib/season/apron-service.ts:14–24` und `:158–160`, `lib/sponsor/sponsor-team-salary-display.ts:17–28`).
- `expectedSalary` ist das **Formel-Gehalt aus Marktwert/Attributen**
  (`lib/foundation/player-economy-contract.ts:377`, `salaryBreakdown.finalSalary`). Es hängt
  **weder** an der Vertragsform **noch** am verhandelten Gehalt.
- Der Kopfkommentar von `apron-service.ts` dokumentiert das als **bewusste
  Anti-Gaming-Entscheidung**: die Glättung soll genau verhindern, dass Front-/Back-Loading ein
  Team „allein durch die zeitliche Verteilung seiner Vertragsraten über oder unter die Linie"
  schiebt.
- **Experiment am Abbild** (`1hf25q`): alle 10 mehrjährigen Verträge des größten Zahlers
  (Hell Raisers) in-memory auf `front_loaded` umgestellt → echte Jahr-1-Gehaltssumme steigt um
  **+10,5** (97,7 → 108,2), Apron-Abgabe ändert sich um **exakt 0,00** (16,62 → 16,62).

Und ein eindrückliches Nebenprodukt derselben Bemessung: **Cold Steel zahlt 3,18 Abgabe, obwohl
seine echt gebuchte Gehaltssumme (63,6) UNTER der 1. Linie (76,8) liegt** — geglättet steht das
Team bei 81,6. Umgekehrt zahlt Mayhem (echt 107,7) nur auf Basis 94,1. Verhandeln und Formen
bewegen die Steuer nicht — in keiner Richtung.

**Der wirksame Apron-Hebel ist allein die Kaderzusammensetzung** (teure Spieler abgeben oder gar
nicht erst holen) — und dafür existieren die KI-Werkzeuge bereits:
`estimateMarginalApronLevy`/`estimateApronReliefFromShedding` (`lib/ai/ai-apron-cost-service.ts`),
`buildApronAbbauZiel` (`lib/ai/apron-abbau-ziel.ts`), Ambitionsdecke
(`resolveTeamApronSalaryCeiling`).

---

## 2. Was die Vertragsform wirklich bewirkt (gemessen)

`buildContractSalarySchedule` (`lib/market/contract-negotiation-preview.ts:377–444`): Gewichte
symmetrisch um die Laufzeitmitte, Schritt `min(0,2; 0,8/(n−1))`. Jahr-1-Zahlung gegenüber dem
Laufzeit-Durchschnitt:

| Laufzeit | front_loaded Jahr 1 | back_loaded Jahr 1 |
|---|---|---|
| 2 Jahre | +10 % | −10 % |
| 3 Jahre | +20 % | −20 % |
| 4 Jahre | +30 % | −30 % |

Die **Gesamtsumme bleibt exakt gleich** (Gewichts-Normierung + Rundungsrest ins letzte Jahr).
Die Schedule rückt je Saisonwechsel um ein Jahr vor, `entry.salary` = jeweils Jahr 1
(`advanceRosterContractSchedule`, `lib/contracts/contract-renewal-service.ts:186–203`); am
Saisonende wird genau diese Summe abgebucht (`sponsor-settlement-service.ts:180–190` →
`getTeamActualSalaryTotal` = `contract.salary`).

Gemessene Wirkung am Abbild:

- `1hf25q`: 162 von 340 Verträgen geformt; bei geformten mehrjährigen Verträgen verschiebt die
  Form im Mittel **1,33 je Vertrag und Jahr**.
- Netto je Team (Jahr 1 minus Durchschnitt, über den ganzen Kader): Mittel |2,95|, Spanne
  **−7,9 … +8,6**. Die Form ist also ein echtes Cash-Timing-Werkzeug in der Größenordnung
  „ein mittlerer Apron-Zahler pro Saison" — sie erreicht nur eben die Apron nicht (1.3).

Die Form wirkt außerdem auf `calculateOpenBuyoutCost` (Restsumme der Schedule) — Buyouts
front-loaded auslaufender Verträge sind billiger. Nebeneffekt, kein Planungsziel.

---

## 3. Der Salary Factor: bekannt, groß — und an zwei Stellen falsch bzw. gar nicht genutzt

### 3.1 Fakten

- Fenster mit **5 Saisons Vorausschau**, deterministisch je Save
  (`lib/season/season-economy-factors.ts`, Spanne 0,82–1,24). Beide Saves tragen ein volles
  Fenster (`source: "rolled"`). Die Sponsorkarten zeigen es dem Spieler bereits
  (`buildSponsorOfferTermForecast`, `lib/sponsor/sponsor-economy-calibration.ts`) — die KI darf
  es also genauso lesen, das ist keine versteckte Information.
- **Gehaltszahlungen skalieren NICHT mit dem Faktor** (kein `salaryFactor` in
  `lib/player-formulas/`, Abzug ist die nominale Schedule-Summe). Chris' Formulierung „wenn die
  Faktoren steigen, ist früh zahlen günstiger" setzt faktor-skalierte Gehälter voraus — die gibt
  es nicht. Was mit dem Faktor skaliert, sind die **Einnahmen** (Wertungstopf = 1133 × f,
  ≈ 35 × f je Team im Ligamittel; `lib/sponsor/sponsor-liga-leiter.ts:110–113`) und die
  **Apron-Abgabe** (Konjunkturhebel k(f): 0 bei f ≤ 0,95, 1 bei f ≥ 1,24;
  `apron-service.ts:102–105`).
- Der Konjunkturhebel ist ein gewaltiger Schalter, gemessen an `1hf25q` bei identischen
  Gehältern/Linien: Topf **0,0 bei f ≤ 0,95** · 10,6 bei f=1,00 · 31,7 bei f=1,10 ·
  **61,3 bei f=1,24**.

### 3.2 Der gemessene Fehler: Apron-Entscheidungen lesen den falschen Horizont

Verkäufe, Renewals und Käufe laufen in der Preseason (`transfer_sell_phase`,
`contract_renewal`, `transfer_buy_phase`), das Faktor-Fenster rückt aber erst im LETZTEN Schritt
`next_season_setup` vor (`lib/season/preseason-workflow-service.ts:53–57, 572`). Während der
gesamten Preseason liefert `resolveApronSalaryFactor` (`apron-service.ts:116–119`,
`window[0]`) also den Faktor der **abgelaufenen** Saison — die Abgabe, die diese Entscheidungen
tatsächlich betreffen, fällt in der **nächsten** Saison an, deren Faktor als `window[1]`
**bereits bekannt** ist. Ein gelesener, falscher Wert einer bekannten Reihe.

Gemessen an `1hf25q` (aktuell f=1,19 → k=0,83; nächste Saison f=0,87 → **k=0**):

| Team | Überschuss | `reliefBisZiel` lt. Code (f=1,19) | Relief mit f der nächsten Saison (0,87) |
|---|---|---|---|
| Hell Raisers | 7,3 | **9,67** | **0,00** |
| Mayhem Mavericks | 6,8 | 9,00 | 0,00 |
| Last Ride | 2,5 | 1,66 | 0,00 |
| Silver Soldiers | 2,3 | 1,46 | 0,00 |

Die KI würde in dieser Preseason Spieler verkaufen, um eine Abgabe zu vermeiden, die es
**nachweislich nicht geben wird** (drei kommende Saisons liegen mit 0,87/0,83/0,91 unter der
0,95-Schwelle). Umgekehrt am aktiven Save `0kalpx` (f_next=1,03 → k=0,28): dort ist Abbau real
etwas wert, nur weniger als der Code mit f=1,12 behauptet. Gleiches Muster betrifft
`estimateMarginalApronLevy` für Preseason-Käufe (`ai-apron-cost-service.ts:46–54`).

(Die Apron-**Linien** der nächsten Saison sind zu diesem Zeitpunkt tatsächlich unbekannt — das
dokumentiert `apron-abbau-ziel.ts` korrekt als obere Schranke. Der Faktor ist es **nicht**; ihn
falsch zu lesen ist kein Schätzfehler, sondern ein vermeidbarer.)

### 3.3 Formwahl kennt den Faktor nicht

`chooseAiRenewalContractShape` (`lib/contracts/contract-renewal-service.ts:626–658`) entscheidet
nur nach Kassenlage + Profil-Bias; bei Laufzeit ≤ 1 immer `balanced` (korrekt — es gibt nichts zu
verteilen). Weder Faktor-Fenster noch Apron kommen vor. Für die Apron ist das **richtig so**
(1.3); für das Cash-Timing fehlt die eine Information, die den Unterschied macht: in einer
f=0,83-Saison sind die Einnahmen je Team im Ligamittel ~12 niedriger als in einer f=1,19-Saison,
die nominale Gehaltszahlung bleibt gleich. Zahlungen in Hoch-f-Saisons zu schieben glättet die
Kasse — die Form kann davon 3–8,5 je Team und Saisongrenze bewegen (Abschnitt 2). Das ist ein
belegbarer, aber **moderater** Nutzen: eine kleine deterministische Regel, kein Umbau.

---

## 4. Der Plan

Reihenfolge nach gemessenem Nutzen. Jeder Schritt mit Wert-Invariante am Abbild — keine
Quelltext-String-Tests.

### Schritt 0 — Messgrundlage einchecken

`scripts/mess-apron-vertragsform.ts` (Konsolidierung der Wegwerf-Skripte dieses Audits): liest
je Save Apron-Logs, Hochrechnung, Formverteilung, Verhandlungs-Margen, Faktor-Fenster;
zusätzlich das Formwechsel-Experiment (Abschnitt 1.3) als eingebaute Invariante.

**Invarianten:** (a) Ligasumme der Apron-Logs je Saison = 0,00 ± 0,05; (b) Formwechsel-Delta der
Abgabe = 0,00 exakt (solange die Anti-Gaming-Entscheidung gilt — dieser Wert ist der Wächter
dafür); (c) Skript läuft nur mit `OLY_APP_SQLITE_PATH` auf einer Kopie.

### Schritt 1 — Faktor-Horizont der Apron-Entscheidungen reparieren (größter Nutzen)

**Bauen:** EINE neue Funktion neben `resolveApronSalaryFactor` in `apron-service.ts`, z. B.
`resolveApronSalaryFactorForNextSeason(gameState)`: liest dasselbe Fenster über
`getSeasonEconomyFactorWindow` (`horizonIndex === 1` explizit suchen, wie
`buildSponsorOfferTermForecast` es vormacht), Fallback bewusst auf den aktuellen Faktor —
dokumentiert, nicht `?? 1`. **Keine zweite Formel, nur ein zweiter Lesehorizont derselben
Quelle** (Fehlerklasse „zwei Rechenstellen" ist damit gebannt; die Abrechnung selbst bleibt
unverändert auf `resolveApronSalaryFactor`).

**Verwenden in:** `buildApronAbbauZiel` (Verkäufe wirken immer auf die nächste Saison — steht
wörtlich in dessen Kopfkommentar) und in den Preseason-Aufrufern von
`estimateMarginalApronLevy`/`estimateApronReliefFromShedding`. Vor dem Umstellen je Aufrufstelle
klären, in welcher Phase sie läuft: In-Season-Käufe (falls es sie gibt) behalten den aktuellen
Faktor. Die Begründungstexte der KI müssen den benutzten Faktor nennen.

**Invarianten (Zahlen, am Abbild):**
- `1hf25q`: `buildApronAbbauZiel("Hell Raisers").reliefBisZiel` fällt von 9,67 auf **0,00**;
  mit Bagatellgrenze entfällt der Abbau-Druck aller vier Teams komplett.
- `0kalpx`: Relief bleibt **> 0** (f_next=1,03, k=0,28) — der Fix darf die Steuer nicht
  generell wegdefinieren, nur den Horizont korrigieren.
- Unit-Test mit konstruiertem GameState + gesetztem Fenster (`patternFactors`), damit der Pfad
  nicht nur beim Saisonwechsel läuft (Fehlerklasse „nur Saisonwechsel-Code, nie getestet").

**Balance-Anteil — ENTSCHIEDEN (Chris: „ja, wenn sie es hin bekommt"):** Die KI darf scharf
timen — in k=0-Saisons bewusst teure Kader halten und erst vor Hoch-f-Saisons abbauen. Es ist
dieselbe Information, die der Spieler auf den Sponsorkarten sieht. Kein gedämpftes Mittel,
window[1] direkt.

### Schritt 2 — Formwahl mit Faktor-Vorausschau (Chris' Wunsch, korrekt eingeordnet)

**Bauen:** `chooseAiRenewalContractShape` bekommt das Faktor-Fenster als Input (über
`getSeasonEconomyFactorWindow`, dieselbe Quelle wie überall). Neue Regel NACH den bestehenden
Kassen-Regeln (Liquidität schlägt Optimierung, `tightNow` bleibt Vorrang):

- Faktor-Gefälle über die Vertragslaufzeit fallend (früh hoch, später niedrig) →
  `front_loaded`-Bias: mehr zahlen, solange die Einnahmen hoch sind.
- Gefälle steigend → `back_loaded`-Bias.
- Kein nennenswertes Gefälle → bestehende Logik unverändert.

**Ausdrücklich dokumentieren, dass die Apron in dieser Funktion NICHTS zu suchen hat** — mit
Verweis auf die Bemessung (1.3), damit kein späterer Agent die Form „gegen die Apron" einbaut
(die Invariante aus Schritt 0b schlägt dann ohnehin an).

**Invarianten (Zahlen):**
- Unit-Test mit konstruiertem Fenster: [1,20, 0,85, 0,85] + 3-Jahres-Renewal →
  `front_loaded` und `schedule[0] > Durchschnitt`; [0,85, 1,20, 1,20] → `back_loaded` und
  `schedule[0] < Durchschnitt`; Kassenklemme (`tightNow`) überschreibt beides. Geprüft werden
  die **Schedule-Werte**, nicht der Shape-String allein.
- Massen-Messung am Abbild (Skript aus Schritt 0): Formverteilung der KI-Renewals vorher/nachher;
  keine Monokultur (keine Form > 70 % der mehrjährigen Neuabschlüsse — heutige Verteilung
  `1hf25q`: 178/102/60, `0kalpx`: 106/199/38 als Referenz).
- Summen-Invariante: `Σ schedule == annualSalary × Laufzeit` exakt (gilt heute, darf nicht
  kippen).

**Balance-Anteil — an Fable delegiert (Chris: „kann ich nicht abschätzen frag fable"):**
Schwellen, Horizont, Vorrangordnung und Kontrollzahl sind in **Abschnitt 5** mit Messwerten
hergeleitet und damit Teil des Bauauftrags.

### Schritt 3 — BEAUFTRAGT (Chris: „ja!"): Apron-Bemessung auf das verhandelte Gehalt

Heute bemisst die Apron das Formel-Gehalt: ein Team, das seinen ganzen Kader 10 % unter Formel
verhandelt, zahlt trotzdem die volle Abgabe (Beispiel Cold Steel, 1.3 — zahlt 3,18 bei echter
Summe UNTER Linie 1). Chris hat entschieden, das zu ändern: Verhandeln soll die Apron bewegen,
die Vertragsform weiterhin **nicht** (sein eigener Zusatz: zwingend Laufzeit-Durchschnitt, nie
Jahreszahlung; die Wächter-Invariante „Formwechsel ändert die Abgabe um 0,00" muss überleben).

**⚠ Die naheliegende Umsetzung ist FALSCH — vorab gemessen und durchgerechnet:**
`resolveRosterContractSalaries().annualSalary` sieht aus wie der Laufzeit-Durchschnitt, ist es
aber nur bei Unterschrift. `advanceRosterContractSchedule`
(`contract-renewal-service.ts:186–203`) überschreibt `entry.salary` bei jedem Saisonwechsel mit
der Jahr-1-Zahlung der Rest-Schedule, und `annualSalary` bevorzugt genau dieses Feld
(`player-economy-contract.ts:59–63`, `storedSalary ?? scheduleAverage`). Ein Jahr nach
Unterschrift ist `annualSalary` eines geformten Vertrags also die **formabhängige Jahreszahlung**
— das Schlupfloch wäre wieder offen. Auch der Durchschnitt der **Rest**-Schedule ist nicht
form-immun: ein 3-Jahres-front_loaded (1,2/1,0/0,8) hätte über die Laufzeit die Basen 1,0a /
0,9a / 0,8a = Σ 2,7a, balanced dagegen 3,0a — Front-Loading senkte die Steuersumme um 10 %.

**Die einzig saubere Basis ist das bei Unterschrift verhandelte Jahres-Benchmark, persistiert.**
`RosterEntry` trägt heute kein solches Feld (geprüft: nur `salary` + `yearlySalarySchedule`) —
es muss neu geschrieben werden (`negotiatedAnnualSalary` o. ä.), und zwar an **jedem**
Unterschriftspfad: Renewal, Transferkauf, Draft/Erstbestückung. Migration für Bestandsverträge:
Durchschnitt der Rest-Schedule (exakt für balanced und frische Verträge; für mittendrin
geformte die bestmögliche Näherung — Anzahl der Betroffenen vorab am Abbild zählen und
ausweisen). Fehlerklassen-Wachen: „Feld, das niemand schreibt" ist hier die Hauptgefahr — je
Unterschriftspfad ein Wert-Test, dass das Feld gesetzt ist (am Abbild: 0 Verträge ohne Feld nach
Migration).

**Invarianten:**
- Formwechsel-Experiment (Schritt 0b) liefert weiterhin Delta 0,00 — **zusätzlich auch nach
  einem simulierten Saisonwechsel** (`advanceRosterContractSchedule` auf der Wegwerf-Kopie,
  dann erneut flippen und abrechnen). Ohne diese Verschärfung bliebe die Jahr-1-Falle unentdeckt.
- Vorher/Nachher-Tabelle der Abgaben/Ausgleiche über alle 32 Teams beider Saves an Chris, bevor
  produktiv umgestellt wird (erwartete Richtung, gemessen an 1.3: Cold Steel wird vom Zahler
  (3,18) zum Empfänger; Mayhem Mavericks zahlt auf Basis ~107,7 statt 94,1 spürbar mehr).
- Ligasumme der Abrechnung bleibt 0,00 (der Topf verteilt nur um — unabhängig von der Basis).
- Reihenfolge-Hinweis: Schritt 3 ändert die Grundlage, auf der Schritt 1 rechnet — erst
  Schritt 1 (Horizont), dann Schritt 3 (Basis), sonst misst man den Horizont-Fix gegen eine
  Basis, die sich gleich darauf ändert.

### Was ausdrücklich NICHT gebaut wird

- **Vertragsform als Apron-Vermeidung** — nachweislich wirkungslos (by design), Experiment 1.3.
- Eine zweite Abgabe-/Faktor-Formel irgendwo in der KI — alle neuen Leser gehen über
  `getSeasonEconomyFactorWindow` bzw. `apronLevyForSalary`.
- Mehr-Saisons-Apron-Hochrechnungen über window[1] hinaus — die Linien wandern mit dem Median,
  alles jenseits der nächsten Saison ist geraten (Begründung im Kopf von `apron-abbau-ziel.ts`).

---

## 5. Die Formwahl-Schwellen — Herleitung statt Bauchgefühl (Antwort auf Chris' Punkt 3)

Alle Zahlen aus demselben Abbild (12.08., 08:43 UTC) bzw. aus der Roll-Verteilung des Faktors
(uniform 0,82–1,24, unabhängig je Saison, `season-economy-factors.ts:25–26`). Messskript:
Wegwerf-Replikat der Formwahl-Logik über die realen Kader, Cash-Stände und Strategieprofile
beider Saves (beim Bau gilt: EINE Stelle — das Replikat ist Spec, kein Vorbild).

### 6.0 Die Entscheidungsgröße (vorab, damit A–D dieselbe Sprache sprechen)

**Gefälle Δ = Mittel(Endhälfte) − Mittel(Anfangshälfte) der Vertragsjahre** (2 Jahre: f₂−f₁;
3 Jahre: f₃−f₁, Mitteljahr zählt nicht; 4 Jahre: Mittel(f₃,f₄) − Mittel(f₁,f₂)). Das passt
exakt zur Gewichtsrampe von `buildShapeWeights` (linear, symmetrisch um die Laufzeitmitte —
das Mitteljahr trägt Gewicht ≈ 1 und wird von der Form kaum bewegt). Ein simples
„f nächste Saison minus Mittel vom Rest" hätte am Messkörper versagt: es verdünnt den
1,24-Ausreißer in Jahr 4 auf Δ=−0,12, die Hälften-Statistik zeigt ihn korrekt mit **+0,22**.
Vertragsjahr i wird auf `window[i]` abgebildet (Renewal läuft in der Preseason, VOR dem
Fenster-Vorrücken — Jahr 1 ist `window[1]`; dieselbe Horizont-Wahrheit wie in Schritt 1).

### A) Schwelle: **|Δ| ≥ 0,15** — und warum nicht 0,10 oder 0,20

Drei unabhängige Anker, alle gemessen:

1. **Signal muss größer sein als das Verschobene.** Der Wertungsanteil ist linear in f
   (`apronWertungsanteil`, bei f=1): Rang 1 = 82,7 · Rang 8 = 58,6 · Rang 16 = 33,9 ·
   Rang 24 = 13,3 · Rang 32 = 0. Bei |Δf|=0,15 ist die Einnahmendifferenz zwischen den
   Vertragsjahren also **12,4 (Rang 1) / 5,1 (Rang 16) / 2,0 (Rang 24)**. Eine einzelne
   Formentscheidung verschiebt ±10/20/30 % eines Jahresgehalts — am Abbild bei mittlerem
   Jahresgehalt mehrjähriger Verträge von 6,65 (`1hf25q`) bzw. 4,87 (`0kalpx`) sind das
   **0,49–1,99 je Vertrag**. Bei T=0,15 ist der Einnahmen-Swing für die obere Tabellenhälfte
   das 2,5- bis 8-fache des Verschobenen — die Richtung ist Signal. Bei T=0,10 fällt der Swing
   eines Rang-24-Teams (1,3) unter die verschobene Summe selbst — dort dreht man Verträge für
   einen Effekt, der kleiner ist als die Drehung.
2. **Auslösehäufigkeit** (500 000 Ziehungen aus der echten Roll-Spanne):
   P(|Δ| ≥ T) je Laufzeit —

   | T | 2 Jahre | 3 Jahre | 4 Jahre |
   |---|---|---|---|
   | 0,10 | 58 % | 59 % | 43 % |
   | **0,15** | **41 %** | **42 %** | **23 %** |
   | 0,20 | 28 % | 28 % | 11 % |

   Das Fenster ist **liga-global** — feuert die Regel, feuert sie für alle 32 Teams zugleich.
   Bei T=0,10 überstimmte sie die Profile in der Mehrzahl aller Fenster (Monokultur-Gefahr,
   siehe D); bei T=0,20 nutzte ausgerechnet die Laufzeit mit dem größten Hebel (4 Jahre, ±30 %)
   die Regel fast nie (11 %). T=0,15 lässt die Regel in ~40 % der Fenster sprechen und in ~60 %
   schweigen — Profile bleiben der Normalfall.
3. **Kostenseite ist klein, aber nicht null:** früh gebundenes Geld kostet schlimmstenfalls den
   Kreditzins (7–20 %/Saison, `loan-service.ts:77`) auf die verschobene Summe — auf 1,33
   verschobene Einheiten also ≤ 0,27/Saison. Deshalb braucht die Schwelle keine Kostenmarge,
   sondern nur Rauschabstand; das eigentliche Kostenrisiko fängt die Cash-Wache in C ab.

   Ehrlich gesagt: innerhalb von ~0,12–0,18 ist die Wahl Geschmackssache — 0,15 ist die Mitte.
   NICHT vertretbar sind < 0,10 (Anker 1 kippt für die halbe Liga) und > 0,20 (Anker 2 macht
   die 4-Jahres-Laufzeit taub). Als benannte Konstante bauen, damit die Kontrollmessung (D) sie
   nachjustieren kann, ohne den Code zu verstehen.

### B) Horizont: **alle Vertragsjahre, Jahr i ↔ `window[i]`** — gleichgewichtet über die Hälften

Das Fenster trägt 5 Saisons; bei Laufzeiten bis 4 ist **jede Vertragssaison bekannt** (Renewal
in der Preseason: Jahre 1–4 = window[1..4]). Der Faktor der vierten Saison zählt daher **voll
mit, in seiner Hälfte gleichgewichtet** — nicht abgewertet: die Werte sind deterministisch
vorausgewürfelt, es gibt keine Unsicherheit, die eine Abwertung rechtfertigte (anders als bei
den Apron-LINIEN, die wirklich unbekannt sind — Schritt 1). Der Messkörper zeigt, warum das
wichtig ist: `1hf25q` hat [0,87, 0,83, 0,91, **1,24**] vor sich — erst das voll gezählte Jahr 4
hebt Δ auf +0,22 und schiebt die dicke Rate korrekt in die 1,24-Saison (Wertungstopf dort +43 %
gegenüber 0,87). Einzige Ausnahme: Vertragsjahre jenseits des Fensters (nur Laufzeit ≥ 5;
am Abbild 9 von 262 mehrjährigen Verträgen, 3,4 %) bekommen das Mittel der bekannten Jahre —
neutral, kein Raten.

### C) Vorrang: **Kassenklemme > Faktor > Profil-Neigung** — Bestätigung mit Begründung

Die Vorgabe des Koordinators ist richtig, und zwar quantitativ: Front-Loading aus
Konjunkturgründen bringt pro Vertrag ≤ ~2 Ausrichtungsgewinn, eine erzwungene Kreditaufnahme
kostet 7–20 %/Saison auf die GESAMTE Lücke und ein gerissener Cash-Gate blockiert Renewals
(`ai_cash_buffer_required`). Konkrete Ordnung im Code (Einfügung in
`chooseAiRenewalContractShape`, bestehende Zeilen bleiben):

1. `tightNow && cashPreservationProfile → back_loaded` — **unverändert erste Regel.**
2. **NEU:** |Δ| ≥ 0,15 → `back_loaded` bei Δ > 0; `front_loaded` bei Δ < 0 **nur mit** der
   bestehenden Cash-Wache `cash ≥ requiredReserve + 10` (dieselbe Schwelle wie die heutige
   `wageSensitivity ≥ 8`-Regel — keine zweite erfundene Zahl).
3. Danach die vier bestehenden Profil-Regeln unverändert, dann `balanced`.

**Der Faktor ÜBERSTIMMT die Profil-Neigungen in klaren Fällen** (deshalb Position 2, nicht 5):
`cashPriority`/`wageSensitivity`/`long-`/`shortContractPreference`/`sellForProfitAggression`
sind Geschmack ohne Informationsgehalt über die Zukunft; das Fenster ist bekannte Arithmetik.
Dass daraus keine Monokultur wird, sichern drei Dinge, alle gemessen: die Schwelle schweigt in
~60 % der Fenster (A2), die Cash-Wache trennt die Teams nach ihrer echten Kassenlage, und
Einjahresverträge (124/340 bzw. 297/343 am Abbild) haben nie eine Form. Grenze der Regel, offen
benannt: sie richtet sich nach dem LIGA-Wetter; der teamindividuelle Rangverlauf (Rang 1 = 82,7
Wertungsanteil vs Rang 24 = 13,3) bleibt außen vor — ihn zu prognostizieren wäre Raterei.

### D) Kontrollzahl: bimodal, mit zwei scharfen Sofort-Vorhersagen

Die Regel ist absichtlich **bimodal** — die Kontrollzahl muss das abbilden, sonst misst man
Rauschen:

- **Flaches Fenster** (|Δ| < 0,15 für alle Laufzeiten): **exakt 0 Flips.** Jeder einzelne ist
  ein Befund.
- **Steiles Fenster:** 40–75 % der mehrjährigen Renewals der betroffenen Laufzeiten drehen auf
  die angezeigte Form (gedeckelt durch Cash-Wache und bereits passende Formen).
- **Über viele Saisongrenzen gemittelt: 10–30 % der mehrjährigen Neuabschlüsse.** Untergrenze
  aus A2 × Anteil aktuell nicht-passender Formen; dauerhaft < 5 % hieße, die Cash-Wache oder die
  Laufzeitenverteilung frisst die Regel (Befund, nicht Nachjustier-Einladung); dauerhaft > 40 %
  hieße, sie überstimmt den Geschmack öfter als sie schweigt (dito).
- **Monokultur-Wache bleibt:** keine Form > 70 % der mehrjährigen Bestandsverträge (heutige
  Referenz `1hf25q`: 178/102/60).

**Zwei exakte Vorhersagen für die Abnahme des Bau-Ergebnisses**, aus der Simulation über die
realen Kader/Kassen/Profile (Population: Bestandsverträge ≥ 2 Jahre als Proxy für die
Renewal-Population — die echte zieht andere Laufzeiten, das ist der dokumentierte Rest-Fehler):

| Save | nächstes Renewal-Fenster | Δ (2J / 3J / 4J) | erwartete Flips bei T=0,15 |
|---|---|---|---|
| `1hf25q` | [0,87, 0,83, 0,91, 1,24] | −0,04 / +0,04 / **+0,22** | **14 von 216 (6,5 %)** — ausschließlich Laufzeit ≥ 4, alle → back_loaded |
| `0kalpx` | [1,03, 1,05, 1,02, 1,21] | +0,02 / −0,01 / +0,08 | **1 von 46 (2,2 %)** — ein Fünfjahresvertrag |

Weicht die gebaute Regel an genau diesen Saves von diesen Zahlen ab, ist die Implementierung
falsch — nicht die Schwelle.

**Was sich ohne gespielte Saisons NICHT beantworten lässt** (ausdrücklich): ob die
Cash-Ausrichtung am Ende wirklich Kredite/Klemmen reduziert. Die Flip-Quote misst nur, DASS die
Regel wirkt, nicht, dass sie NÜTZT. Der ehrliche Endmaßstab ist ein Langlauf-A/B mit
geskriptetem Faktor-Muster (`OLY_LONG_RUN_SALARY_FACTOR_PATTERN`, z. B. 1,20/0,85 alternierend,
gleiche Seeds): Summe gezahlter Kreditzinsen, Anzahl `ai_cash_buffer_required`-Blockaden und
Zwangsverkäufe je Liga-Saison, mit/ohne Regel. DARAN wird nachjustiert — nicht an der
Flip-Quote, und nicht durch Drehen der Schwelle, bis die Kontrollzahl passt.

---

## 6. Kurzbericht

1. **Die These trägt in der Größenordnung:** Apron-Abgaben teurer Teams sind 12–17 % einer
   Jahresgehaltssumme (Spitze 16,6 bei 97,7), eine mittlere Verhandlungs-Marge ist 0,47 je
   Vertrag — die Apron ist für teure Teams der größere Posten. Bandbreite und Nullsumme der
   früheren Messung bestätigt (−16,6 … +2,8, Ligasumme exakt 0,00).
2. **Aber die Vertragsform ist dafür das falsche Werkzeug:** Apron bemisst das geglättete
   Formel-Gehalt; Formwechsel-Experiment am größten Zahler: Jahr-1-Zahlung +10,5, Abgabe ±0,00.
   Auch verhandelte Rabatte erreichen die Apron nicht. Beides ist dokumentierte Absicht
   (Anti-Gaming). Der wirksame Hebel ist Kaderabbau — den hat die KI schon.
3. **Der echte Fund:** Die Apron-Werkzeuge der KI lesen in der Preseason den Faktor der
   ABGELAUFENEN Saison, obwohl der der nächsten bekannt ist. Am Messkörper bepreist der Code
   einen Verkaufs-Nutzen von 9,67, der real 0,00 beträgt (drei kommende Saisons unter der
   k=0-Schwelle). Das ist Schritt 1 und lohnt unabhängig von allem anderen.
4. **Formwahl + Salary Factor** (Chris' Kernidee) ist als **Cash-Timing** sinnvoll, nicht als
   Apron-Trick: Einnahmen skalieren mit f (~±12 je Team zwischen f=0,83 und f=1,19),
   Gehaltszahlungen nicht; die Form kann 3–8,5 je Team und Saisongrenze in Hoch-f-Saisons
   schieben. Kleine Regel in `chooseAiRenewalContractShape` (Schritt 2).
5. **Alle drei Balance-Fragen sind entschieden** (Kopfnote): KI darf k=0-Saisons scharf
   ausnutzen (Chris); Apron-Bemessung wechselt auf das verhandelte Gehalt (Chris; Schritt 3 mit
   der Benchmark-Persistierung — `annualSalary` wie es heute steht, wäre nach dem ersten
   Saisonwechsel formabhängig und damit das Schlupfloch); Formwahl-Schwellen von Fable
   hergeleitet (Abschnitt 5): **Gefälle-Statistik über die Hälften der Vertragsjahre,
   Schwelle |Δ| ≥ 0,15, alle bekannten Vertragsjahre gleichgewichtet, Vorrang
   Kassenklemme > Faktor > Profil, Kontrollzahl bimodal** (0 Flips in flachen Fenstern; 10–30 %
   der mehrjährigen Neuabschlüsse im Langlauf-Mittel; exakte Abnahme-Vorhersagen: 14/216 bei
   `1hf25q`, 1/46 bei `0kalpx`). Endgültiger Nutzen-Nachweis nur im Langlauf-A/B mit
   geskriptetem Faktor-Muster — nicht an der Flip-Quote nachjustieren.
6. **Bau-Reihenfolge:** Schritt 0 (Messgrundlage) → Schritt 1 (Faktor-Horizont) → Schritt 2
   (Formwahl) → Schritt 3 (Bemessungsumstellung, ändert die Grundlage von Schritt 1 — deshalb
   zuletzt, mit Vorher/Nachher-Tabelle an Chris vor dem Produktivgang).
