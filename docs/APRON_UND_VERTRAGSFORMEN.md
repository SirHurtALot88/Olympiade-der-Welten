# Apron und Vertragsformen — Messung und Plan (12.08.2026)

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

**Balance-Anteil (Chris entscheidet):** Mit dem Fix hält eine KI in k=0-Saisons bewusst teure
Kader und baut erst vor Hoch-f-Saisons ab. Das ist dieselbe Information, die der Spieler auf den
Sponsorkarten sieht — aber OB die KI so scharf timen soll (oder z. B. mit einem gedämpften
Mittel aus window[1..3] rechnet), ist eine Spielgefühl-Frage, keine technische.

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

**Balance-Anteil (Chris entscheidet):** Ab welchem Faktor-Gefälle der Bias greift und wie stark
er die Profil-Präferenzen übersteuert. Der gemessene Nutzen ist moderat (3–8,5 je Team und
Saisongrenze bei voller Ausnutzung) — wenn Chris das den Aufwand nicht wert ist, ist Streichen
dieses Schritts ein legitimes Ergebnis; Schritt 1 lohnt unabhängig davon.

### Schritt 3 — NUR ALS ENTSCHEIDUNGSVORLAGE: Soll Verhandeln die Apron-Basis bewegen?

Heute bemisst die Apron das Formel-Gehalt: ein Team, das seinen ganzen Kader 10 % unter Formel
verhandelt, zahlt trotzdem die volle Abgabe (Beispiel Cold Steel, 1.3 — zahlt 3,18 bei echter
Summe UNTER Linie 1). Das ist konsistent („Steuer auf Kaderqualität, nicht auf Buchhaltung"),
aber es widerspricht Chris' Intuition, dass gute Verträge auch der Apron helfen.

**Das ist eine reine Design-/Balance-Entscheidung.** Falls Chris die Bemessung ändern will, ist
die einzig saubere Variante: Basis = `annualSalary` (verhandelter **Laufzeit-Durchschnitt**,
`resolveRosterContractSalaries().annualSalary`), NICHT die Jahreszahlung — sonst wird die Form
doch zum Apron-Gaming-Werkzeug und die dokumentierte Anti-Gaming-Entscheidung fällt unbemerkt.
**Invariante dann:** Formwechsel-Experiment (Schritt 0b) muss weiterhin Delta 0,00 liefern;
Cold Steel würde zum Empfänger, Mayhem zahlte mehr — beides vorab als Vorher/Nachher-Tabelle
über alle 32 Teams vorlegen, nicht einfach umstellen. **Ohne Chris' ausdrücklichen Entscheid
wird hier nichts gebaut.**

### Was ausdrücklich NICHT gebaut wird

- **Vertragsform als Apron-Vermeidung** — nachweislich wirkungslos (by design), Experiment 1.3.
- Eine zweite Abgabe-/Faktor-Formel irgendwo in der KI — alle neuen Leser gehen über
  `getSeasonEconomyFactorWindow` bzw. `apronLevyForSalary`.
- Mehr-Saisons-Apron-Hochrechnungen über window[1] hinaus — die Linien wandern mit dem Median,
  alles jenseits der nächsten Saison ist geraten (Begründung im Kopf von `apron-abbau-ziel.ts`).

---

## 5. Kurzbericht

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
   schieben. Kleine Regel in `chooseAiRenewalContractShape` (Schritt 2), Schwellen sind
   Balance-Sache.
5. **Balance-Fragen für Chris:** (a) Darf die KI k=0-Saisons scharf ausnutzen? (b) Bias-Schwellen
   der Formwahl. (c) Soll die Apron-Bemessung auf das verhandelte Durchschnittsgehalt wechseln
   (Schritt 3 — nur als Vorlage, nicht gebaut)?
