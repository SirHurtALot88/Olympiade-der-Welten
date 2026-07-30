# Sponsorsystem-Neuentwurf: Preisgeld-Sockel + EV-neutrale Aufsätze

**Status: ENTSCHEIDUNGSVORLAGE — kein Produktivcode.** Rechenteil:
`tests/sponsor-preisgeld-sockel-entwurf.test.ts` (läuft ohne Live-Save, Messdaten eingefroren in
`tests/_fixtures/sponsor-live-save-s1.fixture.ts`).

```
npx vitest run tests/sponsor-preisgeld-sockel-entwurf.test.ts
```

## Kurzfassung

Das Preisgeld ist die Referenzkurve (es wird nie ausgezahlt, `CASH_PRIZE_BENCHMARK_ONLY` bleibt).
Der Entwurf macht die Preisgeld-Benchmark-Leiter **wörtlich zur Sponsor-Basisleiter** und baut die
Sponsorentscheidung als **erwartungswert-neutrale Aufsätze** darauf:

> **Auszahlung = M(Endrang) + Tilt · (M(Endrang) − Anker) − p·G + erreicht·G**
>
> mit M(f) = Preisgeld(f) + Platzierungsbonus(Startrang − f), alles bei Unterschrift eingefroren.

- **Basis-Sponsor = Benchmark exakt** (RMSE 0,00 per Konstruktion).
- **Die Entscheidung** ist ein Slate aus 5 Karten (Sicherheit / Basis / Ambition / Sonderziel /
  Ambition+Ziel) — alle mit **identischem Erwartungswert**, unterschieden nur im Risikoprofil.
- **Rarity skaliert die Größe des Hebels, nie den Erwartungswert.** Der heutige Hauptfehler —
  „welchen Vertrag du zufällig unterschrieben hast, zählt mehr als deine Leistung" — ist damit
  strukturell unmöglich.

Kennzahlen an den 32 echten Teams des Live-Saves (Saison 1, Spieltag 10):

| Szenario | RMSE | GuV+ | GuV-Spanne | Spreizung | Top-Tilt¹ | Inversionen² |
|---|---:|---:|---:|---:|---:|---:|
| Ziel (Preisgeld-Benchmark) | 0,00 | 25/32 | 40,9 | 2,05 | ±0,0 | 37 |
| **heute (V2, eingefroren)** | **14,86** | 20/32 | 61,2 | 2,93 | **+15,4** | **87** |
| Entwurf: alle Basis | 0,00 | 25/32 | 40,9 | 2,05 | +0,0 | 37 |
| Entwurf: Zufallsmix der Karten | 2,57 | 26/32 | 44,1 | 2,12 | +0,2 | 42 |
| Entwurf: bester Fall der Wahl | 5,62 | 28/32 | 44,2 | 2,05 | +2,2 | 42 |
| Entwurf: schlechtester Fall | 5,26 | 19/32 | 46,2 | 2,36 | +2,1 | 45 |
| verworfen: ±10 % Rarity-Etat | 3,76 | 25/32 | 48,2 | 2,22 | −0,8 | 44 |

¹ Mittlere Abweichung vom Benchmark, Top-8 minus Bottom-8: heute bekommen starke Teams
strukturell **+15,4 C** mehr als schwache relativ zum Ziel — der Entwurf drückt das auf ±2.
² Team-Paare, in denen der schlechter Platzierte mehr Geld bekommt. Der Benchmark hat selbst 37
(Platzierungsbonus), heute sind es 87 — der Entwurf bleibt in jedem Fall der Wahl bei ≤ 45.

Größte Ausreißer gegen das Ziel: heute **G-G +34,2 / D-L −26,7 / B-P +24,1**; im Entwurf über die
gesamte Bandbreite der Sponsorenwahl **±9** (hart begrenzt < 13,5 je Team, im Test asserted).

---

## 1. Befund (gemessen am Live-Save, hier nur das Nötigste)

- Die Preisgeldkurve ist flach (Spreizung 1,87×, mit Platzierungsbonus 2,05×), die
  Gehaltsspreizung steil (2,76×). **Deshalb entscheidet Kadereffizienz die GuV, nicht der Rang**:
  T-C (Rang 18, Gehalt 44,2) macht die beste GuV der Liga (+32,3), Meister M-M (Gehalt 95,7)
  trotz Titel fast nichts (+7,6). Overspender werden bestraft, ohne dass eine Strafregel existiert.
- Die heutigen Sponsoren sind steiler als die Gehälter (2,93×) **und** vertragslotteriegetrieben:
  Rarity-Etat-Faktoren, `teamQualityRank`-Rebalance und Kurvenform-Würfe verschieben ±34 C —
  G-G auf Rang 8 kassiert mehr als C-S auf Rang 2.
- Bloßes Stauchen der heutigen Kurve konvergiert bei RMSE 9,07 — der Fehler ist die
  Vertrags-Zufälligkeit, nicht die Steilheit. Deshalb setzt der Entwurf nicht an Multiplikatoren
  an, sondern ersetzt die Leiter durch den Benchmark selbst.

**Nebenbefund (bei der Messung gefunden):** Es gibt **zwei Platzierungsbonus-Tabellen**. Der
Benchmark (`buildPrizeMoneyPreview` → `readPrizeMoneySourceBundle`) nutzt die **Sheet-Tabelle** aus
`references/sheets/prize-money-table.csv`: asymmetrisch, **+1,28 je Platz aufwärts / −0,96 je Platz
abwärts**, oberhalb ±10 abflachend (max +26,33 / −12,84). Die Code-Tabelle
`getSponsorPlacementLookup()` in `lib/season/prize-money.ts` (±8,33 für 1 Platz bis ±16,52 für 12)
ist eine andere, geht in die Benchmark-Preview **nicht** ein und hängt nur an Legacy-Anzeigen.
Der Entwurf friert die Sheet-Tabelle ein; das Doppel gehört beim Umbau aufgeräumt.

## 2. Das Prinzip

Jeder Vertrag friert bei Unterschrift drei Dinge ein:

1. **Die Benchmark-Leiter** `M(f) = P(f) + B(Startrang − f)` für alle Endränge 1..32.
   `P` = Preisgeldtabelle aus den **echten** Liga-Gehältern zum Unterschriftszeitpunkt
   (`buildPrizeMoneyTable`, Ligajahr-Faktor der Saison), `B` = Sheet-Platzierungstabelle.
2. **Den Erwartungsanker** `A` = modell-erwarteter Benchmark-Wert (diskretisierte Normalverteilung
   um den Startrang, σ = 4 — gemessene Streuung Start→Endrang im Live-Save: sd ≈ 3,3; an 1..32
   gestutzt). `A` ist eine Zahl im Vertrag; gegen sie ist jeder Tilt **exakt** EV-neutral, ohne
   Näherung und ohne Liga-K.
3. **Die gewählte Karte** (Tilt β, optional Sonderziel mit Größe G und Erfolgswahrscheinlichkeit p).

Auszahlung am Endrang f: `M(f) + β·(M(f) − A) − p·G + erreicht·G`.

Eigenschaften, alle im Test bewiesen:

- **EV-Parität exakt** (|EV − A| < 10⁻⁹ für jede Karte jedes Teams) — die Karte ist eine
  Risiko-Entscheidung, nie ein Etat-Upgrade.
- **Streng monoton im Endrang** für jede Karte (β ist auf [−0,3, +0,3] begrenzt; die Leiter kippt
  nie).
- **Liga-Summe per Konstruktion ≈ Gehaltssumme × Ligajahr-Faktor** — jedes der 32 Teams trägt die
  volle Kurve, jeder Rang wird genau einmal besetzt. Das ex-ante gelöste K aus V2 (samt
  Referenzliga-Näherung und Kollaps-Sonderfällen) **entfällt ersatzlos**. Realisierte Abweichung
  durch die Wahl: Liga-Summe 2 209–2 552 um den Pool 2 380 (best/worst case, alle Teams gleichzeitig
  in dieselbe Richtung — praktisch nicht erreichbar).
- **Feine Gewinnstufen**: die Leiter hat 32 echte Stufen (~1–2 C je Rang plus Platzierungsanteil).
  Die heutige Grobstufigkeit (D-L: Rang 1–20 identisch 59,63, Sprung 28→29 = 14 Mio) verschwindet.

## 3. Die drei Richtungen im Vergleich

### A) Kurvenvarianten um den eigenen Anker — **empfohlen als Träger**

Der β-Tilt IST die „leicht andere Kurve", aber um den **teameigenen** Erwartungsanker gedreht statt
um Liga-Konstanten — deshalb entsteht keine Top-/Bottom-Schieflage (Top-Tilt ±2 statt +15,4).

- Sicherheit (−β): Abweichungen vom Erwartungsanker gedämpft — weniger Absturzrisiko, weniger Upside.
- Basis (0): exakt der Benchmark.
- Ambition (+β): Abweichungen verstärkt — Überperformance zahlt mehr, Unterperformance kostet.

β nach Rarity: gewöhnlich 0,15 / magisch 0,20 / selten 0,25 / legendär 0,30. Sensitivität
(schlechtester Fall der Wahl): Tilt ×0,6 → RMSE 4,79 · ×1,0 → 5,26 · ×1,4 → 5,80 — die
Stellschraube ist gutmütig, Chris kann die Bandbreite frei wählen, ohne das System zu kippen.

Beispiel T-C (Startrang 24, Endrang 18, selten, β = 0,25, Anker A = 63,4):

| Karte | bei Rang 24 (erwartet) | bei Rang 18 (real) | bei Rang 32 |
|---|---:|---:|---:|
| Sicherheit | 62,6 | 73,3 | 52,4 |
| Basis | 62,3 | **76,5 (= Benchmark)** | 48,8 |
| Ambition | 62,0 | 79,8 | 45,1 |
| Sonderziel (G=9, p=0,47) | 58,1 / 67,1 | 72,3 / 81,3 | 44,5 / 53,5 |

Die Wahl ist spürbar (±3–9 C je nach Saisonverlauf), aber nie Lotterie: am Erwartungsrang sind
alle Karten fast gleich — genau dort trennt sich nichts, verdient wird die Differenz über die
Saisonleistung.

### B) Sonderziele — als begrenztes Modul dabei, **nicht als Träger**

Sonderziele bleiben (die 22+ getesteten Ziele, `evaluateSpecialComponentStage`, und die
Schwierigkeits-Bepreisung aus V2 werden wiederverwendet), aber **fair bepreist und gedeckelt**:

- Auszahlung G nach Rarity (6 / 7,5 / 9 / 10 C), Sockelabzug **−p·G** ⇒ EV-Beitrag exakt 0.
  Ziel erreicht: +(1−p)·G; verfehlt: −p·G. Band bei G = 10: **[−7,2, +8,5]**.
- **Stärkeklassen-Fairness per Konstruktion:** angeboten werden nur Ziele mit p ∈ [0,15, 0,72]
  für die Stärkeklasse des Teams (V2-Klammer `GOAL_P_MIN/MAX`). „Top 8" für den Tabellenletzten
  hat p ≈ 0 und **fällt damit aus dem Katalog**, statt wertlos herumzuliegen.

Warum nicht als Träger: damit Sonderziele allein die Sponsoren differenzieren, müsste G groß sein
(≥ 20–25 C) — dann schlägt jeder Fehler in den `GOAL_PROBABILITY`-Schätzwerten (das sind
Design-Schätzungen, keine Messungen) als **systematischer** Etat-Fehler durch: δp = 0,15 bei G = 25
sind 3,75 C Dauerverzerrung je Team — die nächste Vertragslotterie, nur mit anderem Würfel. Bei
G ≤ 10 ist derselbe Schätzfehler ≤ 1,5 C und vom Deckel eingefangen.

### C) Richtige Verhandlungen — **verworfen**

Eine Verhandlung ohne Gegenleistung ist ein Knopf: drückt ihn jeder, muss das Ergebnis vorab
eingepreist sein, und es bleibt die Basis mit Extraschritten. Eine Verhandlung **mit** echter
Gegenleistung — „mehr Garantie gegen weniger Upside", „mehr Upside gegen Absturzrisiko" — ist
ökonomisch **exakt der β-Tilt**; sie kollabiert mechanisch in Richtung A. Übrig bliebe nur die
Inszenierung (Verhandlungs-UI, KI-Verhandlungslogik für 31 Teams, Balancing der Verhandlungsmacht
— wer bestimmt, wie viel Bewegung „fair" ist?), zum Preis einer neuen Manipulationsfläche und ohne
eine einzige Kennzahl, die besser würde. Falls sich Verhandlungs-*Gefühl* gewünscht ist: die 5
Karten desselben Sponsors als „Angebotsstufen" präsentieren ist reine UI und kann später auf
dieselbe Ökonomie aufgesetzt werden, ohne sie anzufassen.

**Empfehlung: A als Träger, B als gedeckeltes Modul, C verworfen.**

## 4. Was der Entwurf kostet (Implementierungsskizze — erst nach Entscheidung)

- **Vertragsterme V3** (analog `sponsorV2`-Block, Träger bleibt die eingefrorene 32er-Leiter):
  die bereits getiltete Leiter `L(f) = M(f) + β·(M(f) − A)` wird fertig eingefroren, dazu
  `goalKey/goalP/goalSize`. Settlement liest Leiter + Zielauswertung — die bestehende
  Settlement-Zerlegung (Teleskopsumme) und `applySponsorSettlement` bleiben.
- **Angebotserzeugung wird kleiner:** `buildPrizeMoneyTable` (einmal je Saison) + Sheet-Tabelle +
  5 Karten je Slate. **Ersatzlos entfallen:** K-Solver samt Referenzliga, Kalibrierungs-Fixpunkte,
  Korridor-Kappung, Milestone-Leiter, Rarity-Etat-Faktoren, `teamQualityRank`-Rebalance,
  Klausel-Maschinerie (deren Risikofunktion übernimmt der Tilt).
- **KI-Wahl wird trivial:** alle Karten eines Slates haben denselben EV — die KI wählt nach
  Risikopräferenz/Flavour, ökonomisch kann sie nichts falsch machen.
- **Wiederverwendet:** Marken/Namen/Flavour, Rarity-Wurf, Sonderziel-Engine + Bepreisung,
  Settlement-Pfad, `lockedRankPayoutLadder`-Infrastruktur.

Guardrails: β hart auf [−0,3, +0,3] geklammert; absolute Untergrenze bleibt (schlechteste
Konstellation im Live-Save: Meister mit Ambition-Karte stürzt auf Rang 32 → 32,3 C; typische
Kartenböden 41–57 C — Klammer bei `SPONSOR_BASE_FLOOR_C` = 32 als Sicherheitsnetz behalten).

## 5. Eingefrorene Leitern der laufenden Saison (Nebenbefund 1)

Verifiziert: eine Neukalibrierung erreicht laufende Verträge nicht — die V2-Leiter ist im Vertrag
eingefroren, vier Kalibrierungen ergaben am Live-Save identische Zahlen. Ohne Migration zahlt die
anstehende Saisonabrechnung noch einmal die alten Ausreißer (G-G +34,2 über Benchmark, D-L −26,7).

Zwei Optionen:

- **M1 — einmalige Neuberechnung vor dem nächsten Settlement (empfohlen):** Migrationsskript
  ersetzt bei allen noch nicht abgerechneten Verträgen die eingefrorene Leiter durch die
  V3-Basisleiter (Identität des Vertrags — Marke, Rarity, Sonderziel-Key — bleibt; das Sonderziel
  wird nach neuer Regel bepreist). Einmaliger Versionsstempel im Save + Backup + Inbox-Nachricht
  („Liga-Konvention angepasst"). Wirkung sofort messbar: die Abrechnung der laufenden Saison
  landet auf der Benchmark-Spalte der Tabelle oben.
- **M2 — harter Schnitt am Saisonwechsel:** laufende Verträge werden nach altem Recht abgerechnet,
  die neuen Angebote der Folgesaison kommen aus V3. Greift damit **ab der nächsten Saison** (nicht
  erst in zwei — Angebote werden je Saison neu erzeugt), lässt aber die anstehende Abrechnung
  mit ±34-C-Ausreißern durchlaufen.

Zur Regel „unterschriebene Verträge werden nie nachträglich geändert": sie schützt vor **stiller
Drift** (Anzeige ≠ Settlement, Ankerwanderung). M1 ist das Gegenteil davon — eine explizite,
einmalige, versionierte Design-Korrektur mit Backup. Wer die alte Leiter behält, konserviert einen
erkannten Systemfehler eine volle Saison lang; das schützt keinen Spieler, es schützt den Fehler.
Die Regel selbst bleibt danach unverändert in Kraft (und gilt auch für V3-Leitern).

## 6. Gehaltsanker: `salary`, nicht `expectedSalary` (Nebenbefund 2)

Der Benchmark rechnet mit der **echten** Gehaltssumme (`resolvePlayerEconomyContract().salary`,
front-/back-loaded berücksichtigt) — der heutige Sponsor-Anker hängt über
`getTeamDisplaySalaryTotal` am geglätteten `expectedSalary`. Gemessen: Z-H **97,7 echt vs. 83,3
geglättet** (−15 %); Liga-Summe 2 056,6 vs. 2 017,4; beim Ligajahr-Faktor 1,15 wäre der Pool des
geglätteten Ankers **~45 C** zu klein. Der Entwurf verankert die Leiter an der echten Summe (eine
neue `getTeamRealSalaryTotal`-Quelle, die Saisonstand, Finanzen-Ansicht und Sponsor-Anker
gemeinsam nutzen); `expectedSalary` bleibt reine Anzeige-Glättung und fasst kein Geld mehr an.

## 7. Offene Punkte

- **Gebäude:** Der Benchmark enthält keinen Gebäude-Ausgleich; der heutige flache Offset
  (`SPONSOR_BUILDING_OFFSET_C` = 4/Team) entfiele oder wird als **separat ausgewiesener, flacher
  Infrastruktur-Zuschuss** neben der Kurve geführt (liga-neutral, verändert keine Kennzahl außer
  einem konstanten Offset). Entscheidung nötig.
- **Anker-σ = 4** ist aus einer Saison gemessen (sd 3,3); nach 2–3 Saisons nachziehen. Der Test
  zeigt: die Kennzahlen sind gegen die Stellschrauben robust.
- **Eine Kurve, eine Wahrheit:** die Admin-Balancing-Konfiguration der Preisgeldkurve wirkt dann
  direkt auf die Sponsoren — gewollt, aber bewusst machen.
- **Platzierungstabellen-Doppel** (Sheet vs. `getSponsorPlacementLookup`) beim Umbau auflösen.
- Die Leiter friert die Gehälter zum Unterschriftszeitpunkt ein; Transfer-Drift innerhalb der
  Saison verschiebt den Benchmark am Saisonende leicht (im Fixture nicht messbar, da nur der
  Endstand vorliegt). Gleiches Einfrier-Prinzip wie heute, nur mit ehrlichem Anker.

## 8. Reproduktion

Kennzahlen: `npx vitest run tests/sponsor-preisgeld-sockel-entwurf.test.ts` (druckt die Tabelle
aus der Kurzfassung und friert alle Aussagen als Assertions ein). Das Fixture wurde aus dem
Live-Save extrahiert (Branch `live-save`, `data/online-saves/hetzner-live.sqlite.gz`, entpackt und
mit `OLY_APP_DISABLE_PROJECT_ROOT_GUARD=true OLY_APP_SQLITE_PATH=<pfad> npx tsx <skript>` über
`buildPrizeMoneyPreview` + `previewSponsorSettlement` gelesen); Provenienz und Feldbedeutungen
stehen im Fixture-Kopf.
