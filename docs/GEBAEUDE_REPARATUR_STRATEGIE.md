# Gebäude-Reparatur — Strategie (Konzept, kein Code)

Ausgearbeitet auf Chris' Vorgabe: *„teams können auch in der season kredite aufnehmen um gebäude zu
reparieren oder das zu beginn oder am ende der season machen wenn sie es für nötig halten"* und
*„bitte hier jetzt nicht immer die teams reparieren lassen sobald es mal unter 80% fällt"*.

Alle Zahlen stammen aus dem Code (Dateipfad genannt) oder aus einer Messung am Live-Save-Abbild
(Save `new-game-1785823388048-1hf25q`, Stand Saison 2, gemessen 2026-08-11). Was nicht belegt ist,
steht ausdrücklich unter „Ungemessen".

---

## 0. Was das System heute tut (gemessen, nicht vermutet)

**Mechanik** (`lib/facilities/facility-condition.ts`):
Neuzustand 100 · volle Wirkung bis Zustand **80** · darunter `Wirkung = Zustand/80` · bei 0 zählt
das Gebäude als Stufe 0. Verschleiß **nur am Saisonende** (in
`applyFacilitySeasonEndFinance`, `facility-season-end-service.ts`), Mittel 17 je Saison bei
bezahltem Unterhalt (Streuung 12..22, deterministisch je Saison/Team/Gebäude). Reparatur
(`facility-maintenance-service.ts`) stellt **immer auf 100** her und kostet
`max(1, base × fehlenderAnteil × 0,45)` mit `base = max(upgradeCost, seasonUpkeep)`.

**Zwei Fakten, die die ganze Strategie bestimmen:**

1. **Der Preis je Zustandspunkt ist zeitlich konstant** — `base × 0,45/100`, egal ob man bei 79
   oder bei 40 repariert. Warten macht die Reparatur nie teurer je Punkt. Einzige Ausnahme: der
   Mindestpreis 1 macht **Mini-Reparaturen relativ teurer** (Scouting Office bei 92: fairer Preis
   0,22, berechnet 1,00 — Faktor 4,6).
2. **Die Wirkung wird einmal je Saison abgetastet.** Einnahmen (Fan-Shop/Arena) werden in der
   Saisonabrechnung aus dem **dann aktuellen** Zustand berechnet, *danach* kommt der Verschleiß
   (`buildRows` → `degradeFacilityCondition` in `facility-season-end-service.ts`). Trainings-,
   Academy- und Wing-Boni werden ebenfalls beim Saisonende-Apply aus dem dann aktuellen
   Gebäudezustand gelesen (`organic-season-progression.ts` über `getFacilityLevelDefinition` /
   Effizienz). **Live wirken nur** Recovery (je Spieltag) und Scouting/Analytics (während des
   Fensters bzw. der Anzeige).

**Verschleißpfad ohne Reparatur** (ab dem gemessenen Ligastand 92, Mittel 17):

| Abrechnung | Zustand bei Abtastung | Wirkung |
|---|---|---|
| 1 | 92 | 100 % |
| 2 | 75 | 93,8 % |
| 3 | 58 | 72,5 % |
| 4 | 41 | 51,2 % |
| 5 | 24 | 30 % |

Ein Gebäude verliert also **ab der zweiten Abrechnung** Wirkung und ist nach 4–5 Saisons praktisch
tot. Eine Reparatur auf 100 trägt **zwei volle Abrechnungen** (100→83 bleibt ≥ 80), die
Dauerhaltung kostet im Gleichgewicht ~`17 × base × 0,0045` je Saison — Fan-Shop L1: **0,77/Saison**
bei 3,9 Einnahmen. Werterhalt ist billig; er darf nur nicht **stumpf** passieren.

**Ligabestand (Messung am Abbild):** 12 Gebäude auf 32 Teams, alle Stufe 1, **alle auf Zustand 92**
(8× Scouting, 3× Training, 1× Fan-Shop; keine Arena in der Liga). Cash: min **−31,2**, Median
**16,4**, max **41,1**; **9 Teams im Minus**, 0 Teams auf exakt 0; 11 aktive Kredite, Restschuld
**312,1**, Zinssätze 7,6–18,9 %.
*Abweichung zur Vorgabe:* Die Eckwerte aus dem Auftrag („9 Teams auf exakt 0, 20 Notkredite,
Restschuld 476,3") beschreiben einen **älteren Stand** — das Abbild enthält bereits die Änderung
vom 2026-08-10 („kein Notkredit am Saisonende", Minus bleibt Minus) samt Reparatur-Skript. Die
Größenordnung „Kasse extrem knapp, Marge dünn" gilt unverändert.

**Was die KI heute tut — der Befund zum „stumpf reparieren":** In
`ai-manager-apply-service.ts` (`buildBuildingActions`) erzeugt der Preseason-Pass für **jedes
gebaute Gebäude mit Zustand < 100** eine Reparatur-Aktion, gedeckelt nur durchs
`maintenanceBudget`. Am gemessenen Ligastand hieße das: 12 Reparaturen à 1,0 (Mindestpreis) für
**null Wirkungsgewinn** — alle 12 Gebäude stehen ≥ 80. Das ist schlimmer als „unter 80 sofort":
es ist „unter 100 sofort", zum 2–4,6-fachen fairen Punktpreis.

---

## 1. Die Abwäge-Regel der KI

Kern: eine Reparatur ist ein **Kauf von Wirkungspunkten**. Die KI vergleicht, was die fehlende
Wirkung diese Saison kostet, mit dem Reparaturpreis — und schiebt auf, wenn die Kasse Wichtigeres
zu tun hat.

### 1.1 Die Rechnung

Je Gebäude am Entscheidungspunkt:

```
Wenn Zustand ≥ 80:  KEINE Reparatur. Immer. (Es gibt nichts zu gewinnen,
                    der Punktpreis steigt durch Warten nicht.)

V  = Saisonwert des Gebäudes bei voller Wirkung
     Einnahme-Gebäude:  V = seasonIncome × (Beliebtheit bei Arena)     [hart, in Cash]
     Wirkungs-Gebäude:  V = upgradeCost(akt. Level) / 8 × clamp(score/45, 0.5, 2)
                        [Schattenwert: 8-Saisons-Amortisation als Anker, moduliert über den
                         vorhandenen Bedarfs-Score aus buildBuildingPlan (Bauschwelle 45)]

L  = Wirkungsverlust der NÄCHSTEN Abrechnung = V × (80 − Zustand) / 80
K  = Reparaturkosten (calculateFacilityMaintenanceCost)
R  = L × 2 / K        (Faktor 2: eine Reparatur trägt zwei volle Abrechnungen, s. o.)

Repariere, wenn R ≥ θ  UND  K ≤ freies Reparaturbudget.
```

θ ist die Charakterschwelle (Abschnitt 4); Standard **θ = 1,0** — repariert wird, wenn die
Reparatur ihren Preis binnen zwei Saisonen in Wirkung zurückzahlt.

### 1.2 Durchgerechnet an echten Zahlen

Fan-Shop L1 (Einnahme 3,9, base 10 → Punktpreis 0,045; Katalog `facility-catalog.ts`):

| Zustand | Wirkung | L (Verlust/Saison) | K (Reparatur) | R | Entscheid (θ=1) |
|---|---|---|---|---|---|
| 92 | 100 % | 0 | 1,00 (Floor) | 0 | nie |
| 75 | 93,8 % | 0,24 | 1,13 | 0,43 | **warten** |
| 58 | 72,5 % | 1,07 | 1,89 | 1,13 | **reparieren** |
| 41 | 51,2 % | 1,90 | 2,66 | 1,43 | reparieren (überfällig) |

Trainingszentrum L1 (base 8, Schattenwert V = 1,0 bei Score 45; +14 % Grundtraining):

| Zustand | L | K | R | Entscheid (θ=1) |
|---|---|---|---|---|
| 75 | 0,06 | 1,00 | 0,13 | warten |
| 58 | 0,28 | 1,51 | 0,37 | **warten** (bei Score 45) |
| 58, Score 90 (V=2,0) | 0,55 | 1,51 | 0,73 | knapp — nur Ehrgeizige (θ=0,8) |
| 41 | 0,49–0,98 | 1,77 | 0,55–1,10 | je nach Bedarf — und Kaputt-Schutz greift (1.3) |

Das ist genau die gewünschte Differenzierung: **Einnahme-Gebäude werden bei ~58 repariert**
(alle zwei Saisons, dann rechnet es sich in ~1 Saison zurück), **Wirkungs-Gebäude erst, wenn der
Bedarf real ist** — ein Trainingszentrum ohne Jugendspieler darf verrotten.

**Warum „warten" bei 75 richtig ist:** die Reparatur bei 75 kostet 1,13 und verhindert für eine
Saison 0,24 Verlust — Rückzahldauer ~4,7 Saisonen. Die gleiche Reparatur bei 58 kostet 1,89 und
verhindert 1,07/Saison — Rückzahldauer 0,9 Saisonen. Da der Punktpreis konstant ist, ist die
späte Reparatur strikt besser, solange man den Zwischenverlust (eine Abrechnung bei 93,8 % =
0,24) verschmerzt. Der Mindestpreis 1 verstärkt das für billige Gebäude zusätzlich.

### 1.3 Zwei Ausnahmen von der reinen Rechnung

- **Kaputt-Schutz:** Zustand < 40 **und** Gebäude gewollt (Score ≥ 45 oder Netto-Einnahme > 0)
  → reparieren auch unter θ, notfalls Kredit-Test (Abschnitt 3). Begründung: bei 0 zählt das
  Gebäude als Stufe 0; die Rettung aus dem Totalschaden kostet 45 % der Baukosten
  (`0,45 × base`), der Neubau 100 % — sterben lassen und neu bauen ist immer die schlechteste
  Variante, wenn man das Gebäude behalten will.
- **Bewusstes Sterbenlassen:** Score dauerhaft niedrig und keine Netto-Einnahme → gar nicht
  reparieren, ggf. Downgrade mit 25 %-Erstattung (existiert schon:
  `downgrade_or_ignore_if_no_cash`). Ein Gebäude, das die KI heute nicht bauen würde, muss sie
  auch nicht erhalten.

### 1.4 Das Kassen-Gate

`K ≤ freies Reparaturbudget` nutzt die vorhandenen Budget-Buckets
(`ai-team-management-preview-service.ts`): Reparaturen laufen weiter aus dem
`maintenanceBudget`, aber der Bucket wird **aus der neuen Regel** befüllt (Summe der K aller
Gebäude mit R ≥ θ) statt wie heute aus „alles unter 100". Teams im Minus (gemessen: 9 von 32)
reparieren nur über den Kaputt-Schutz oder den Kredit-Test — sonst gar nicht.

---

## 2. Die drei Zeitpunkte

Heute erlaubt `evaluateGamePhaseAction` (`game-phase-action-policy.ts`) `facility_apply` nur in
`season_end_management`/`transfer_sell_phase` (= Saisonende nach der Abrechnung) und im
Frühstart-Fenster vor Spieltag 1 (= Saisonbeginn). **Mitten in der Saison ist Reparatur heute
gesperrt** — Chris' erster Punkt erfordert also eine Öffnung.

| Zeitpunkt | Was dafür spricht | Kassenlage |
|---|---|---|
| **Saisonende** (nach Abrechnung) | Sponsor-/Preisgeld gerade eingegangen, Verkaufsphase offen → liquidester Moment. Verschleiß wurde gerade angewandt, der neue Zustand ist bekannt. Scouting wirkt live im anstehenden Fenster → wer aufs Scouting baut, repariert **hier**. | am besten |
| **Saisonbeginn** (vor MD 1) | Transferpläne sind durch — man weiß, was übrig ist. Zweite Chance mit vollständiger Information über die eigene Kasse. Recovery wirkt je Spieltag → je früher, desto mehr Saison profitiert. | nach den Käufen |
| **Mitten in der Saison** | Der Rettungsanker: weil Einnahmen/Training erst bei der Abrechnung abgetastet werden, **rettet eine späte Reparatur die volle Saisonwirkung rückwirkend**. Wer pleite in die Saison ging, kann per Kredit doch noch die Abrechnung zu 100 % erwischen. | leer → Kredit |

**Das Designproblem — ja, es gibt einen mechanisch immer besten Zeitpunkt.** Da der Zustand sich
mitten in der Saison nie ändert (Verschleiß nur am Saisonende) und die Abtastung einmalig ist,
ist „so spät wie möglich vor der Abrechnung" strikt dominant, sobald das Saisonfenster offen
ist: man behält das Cash die ganze Saison flüssig und kauft dieselbe Wirkung zum selben Preis.
Saisonbeginn und Saisonende wären als Entscheidung tot.

**Gegenmaßnahme (Empfehlung): Saison-Zuschlag.** Reparatur während der laufenden Saison kostet
**×1,5** („Baustelle im Spielbetrieb"). Damit gilt: Saisonende/-beginn = Normalpreis und
planvoll; mitten in der Saison = bewusste, teurere Rettung — genau die Rolle, die Chris' Satz
ihr zuweist. Beispiel Fan-Shop L1 bei 58: 1,89 regulär vs. 2,84 in der Saison — die Rettung der
Abrechnung (+1,07 Einnahmen) lohnt trotzdem, aber wer planvoll am Saisonende repariert, spart.
*Alternative (sauberer, teurer zu bauen):* Abtastung anteilig nach Spieltagen (Reparatur an MD 10
von 14 → 10/14 der Saison zum alten Zustand). Erst nachrüsten, falls sich der Zuschlag als zu
grob erweist.

---

## 3. Der Kredit

**Wie Kredite heute funktionieren** (`lib/finance/loan-service.ts`,
`docs/design/kredit-system.md`): Bank-Zins `0,10 + (10 − finances) × 0,012 − (Laufzeit−1) × 0,004`,
geklemmt auf 7–20 %/Saison (gemessen im Save: 7,6–18,9 %). Kapazität
`0,15 × Cash + 0,30 × Marktwert − Restschuld`. Saison 1: keine Kredite (irrelevant für
Reparaturen — dort ist alles neu). Distress-Gate bei geplatztem Kredit. Team-zu-Team-Kredite
unterbieten die Bank. Der **Notkredit** (`applyInsolvencyBackstop`) läuft *nur* am Ende des
Kauffensters und ist unfreiwillig — er ist **kein** Reparatur-Instrument. `credit_borrow` ist
heute auf dasselbe Preseason-Fenster beschränkt wie `facility_apply` — der Saison-Kredit für
Reparaturen braucht also dieselbe Öffnung.

**Lohnt ein Kredit für eine Reparatur je?** Ja — weil Reparaturen klein (K = 1–6 bei Stufe 1)
und die geretteten Einnahmen groß dagegen sind. Bedingung:

```
Kredit-Reparatur lohnt, wenn   L ≥ 2 × r × K     (Saisonverlust ≥ doppelte Zinslast)
                        und    Rate tragbar      (disposableDebtServiceBudget − laufende Raten ≥ Rate)
```

Durchgerechnet am Extremfall aus dem Save — R-C, Cash **−16,7**, finances 6,8 (Zins ~13 %),
besitzt den einzigen Fan-Shop der Liga:

| Zustand des Fan-Shops | L | K (×1,5 in Saison) | Zins/Saison (13 %) | 2rK | Entscheid |
|---|---|---|---|---|---|
| 75 | 0,24 | 1,69 | 0,22 | 0,44 | kein Kredit — warten |
| 58 | 1,07 | 2,84 | 0,37 | 0,74 | **Kredit aufnehmen und reparieren** (+1,07 Einnahmen > 0,37 Zins) |

Für **Wirkungs-Gebäude** gilt der Kredit-Test nur zusammen mit hohem Bedarf (R ≥ 1,5 mit
Schattenwert): ein Kredit für ein Trainingszentrum, dessen Score unter der Bauschwelle liegt,
ist ausgeschlossen. Praktisch heißt das: **kreditfinanzierte Reparatur ist fast immer eine
Einnahme-Gebäude-Geschichte** — dort ist sie ab Zustand ≲ 65 klar positiv, selbst zum
Maximalzins von 20 %.

**Stolperstein im Bestand:** die KI-Kreditlogik (`ai-loan-decision-service.ts`) leiht erst ab
einer Lücke von **8** (`MIN_MEANINGFUL_SHORTFALL`) — Reparaturkredite (1–6) fielen durch.
Empfehlung: Reparaturbedarf fließt in der Preseason in die **Bedarfssumme des regulären
KI-Kredits** ein (kein separater Mikro-Kredit); der zweckgebundene Saison-Kredit („Kredit +
Reparatur in einem Schritt", Summe = K, sofort verbaut) ist die einzige Ausnahme von der
8er-Schwelle und existiert für Mensch wie KI.

---

## 4. Verschiedene KI-Charaktere

Bausteine existieren: `teamIdentities.ambition/finances` (0–10, gemessen z. B. Z-H ambition 10 /
finances 2,29; C-C ambition 2,84 / finances 9,72), `cashPriority` aus dem Strategieprofil,
Hoarder-Flags (`isCashHoardingTeam`), GM-Archetyp `facility_architect`. Die Charaktere drehen
**nur an θ und am Kreditmut** — die Rechnung aus Abschnitt 1 bleibt für alle gleich:

| Charakter (Erkennung) | θ | Verhalten in Worten | Kredit für Reparatur? |
|---|---|---|---|
| Hausmeister (`gmArchetype = facility_architect`) | **0,8** | repariert jedes gewollte Gebäude vor der Abrechnung, sobald es unter 80 fällt — Infrastruktur ist sein Programm | ja, ab L ≥ 2rK |
| Ehrgeizig (`ambition ≥ 7`) | **0,8** für Trainings-/Recovery-/Academy, 1,0 sonst | Leistungsgebäude zuerst; toleriert keine 72-%-Trainingssaison | ja, auch für Wirkungs-Gebäude bei Score ≥ 60 |
| Standard | **1,0** | repariert Einnahme-Gebäude bei ~58, Wirkungs-Gebäude nach Bedarf | nur Einnahme-Gebäude |
| Sparsam (`cashPriority ≥ 7` oder Hoarder-Flag) | **1,4** | lässt eine Abrechnung bei 93,8 % bewusst laufen, repariert eine Kadenz später (bei ~41–58), nie über dem Floor-Preis | nein — nie |
| In Not (Cash < 0 oder `strategicIntent = cash_recovery`) | **2,0** | repariert nur über Kaputt-Schutz oder wenn die Reparatur sich in < 1 Saison selbst bezahlt | nur Einnahme-Gebäude, nur wenn Rate tragbar |

Wirkung an der Tabelle aus 1.2: beim Fan-Shop auf 58 (R = 1,13) reparieren Hausmeister, Ehrgeizige
und Standard; der Sparsame wartet noch eine Saison (R bei 41 = 1,43 ≥ 1,4); das Not-Team nimmt den
Kredit, weil 1,07 ≥ 2 × 0,37. Fünf unterscheidbare Verhalten aus einem Parameter.

---

## 5. Was der Mensch sieht

Empfehlung statt Gängelung — drei Bausteine, kein Zwang, kein Modal:

1. **Zustandsbalken mit 80er-Marke** auf der Gebäudekarte: Markierung bei 80 mit Beschriftung
   „volle Wirkung bis 80". Unter 80 erscheint die echte Wirkung („72 % Wirkung") statt nur des
   Zustands. Der Spieler sieht *warum* 75 harmlos und 58 teuer ist.
2. **Rechnung im Reparatur-Dialog** (Preview existiert schon in
   `facility-maintenance-service.ts`): „Kostet 1,89 · bringt +1,07 Einnahmen je Saison zurück ·
   zahlt sich in ~1 Saison". Für Wirkungs-Gebäude: „stellt +14 % Grundtraining wieder voll her".
   Dieselbe Formel wie die KI — keine Geheimlogik.
3. **Eine Inbox-Zeile am Saisonende** (`game-inbox-service.ts` existiert): „2 Gebäude gehen mit
   verminderter Wirkung in die neue Saison (Fan-Shop 72 %, Training 94 %) — Reparatur zusammen
   3,4" mit Link auf den Gebäude-Tab. Einmalig, abweisbar, kein Blocker.

**Aufräumbedarf, damit die Anzeige nicht lügt** (Folge der Schwellen-Änderung 70 → 80):

- `getFacilityConditionStatus` (`facility-condition.ts`): das Band „alternd 70–89" **überspannt
  die Wirkschwelle** — 75 heißt „alternd", verliert aber schon Wirkung; 85 heißt genauso
  „alternd" bei voller Wirkung. Empfehlung: `gut ≥ 90 · alternd 80–89 (volle Wirkung) ·
  abgenutzt 40–79 (Wirkung fällt) · kritisch < 40 · kaputt 0` — nur die eine Grenze 70 → 80
  verschieben, dann trennt „abgenutzt" exakt „verliert Wirkung" von „voll wirksam".
- `previewFacilityMaintenance` warnt bei `conditionPct < 70` (`facility_condition_below_70`) —
  ebenfalls auf 80 ziehen.
- Orchestrator-Trigger `building_condition_below_70` (`ai-season-lifecycle-orchestrator.ts`) —
  Label und Bedingung anpassen, wenn die neue KI-Regel einzieht.

---

## 6. Ungemessen / Annahmen

- **Freie Marge je Team** (Median 2,5–4,6, 12/32 negativ): aus Chris' Auftrag übernommen, am
  Abbild nicht selbst nachgerechnet. Die gemessenen 9 Minus-Teams stützen die Richtung.
- **Schattenwert V der Wirkungs-Gebäude** (`upgradeCost/8 × score/45`): Setzung, kein Messwert.
  Der 8-Saisons-Anker stammt aus der Arena-Kalibrierung im Katalog (Kommentar
  `facility-catalog.ts`). Vor dem Bau per Sim-Lauf (`season-simulation-runner`) prüfen, ob die
  Liga damit weder verrottet noch dauerpoliert.
- **Faktor 2 (zwei getragene Abrechnungen)**: folgt aus dem Mittel 17; bei Streuung 12..22
  schwankt er real zwischen ~1 und 2. Bewusst als Konstante gesetzt.
- **Abtastung der Trainings-/Academy-/Wing-Wirkung am Saisonende**: aus dem Code gelesen
  (Apply liest Gebäudezustand zum Apply-Zeitpunkt), aber nicht je Effektart einzeln im Spiel
  nachgemessen. Für Einnahmen ist die Abtastreihenfolge belegt (`buildRows` vor Decay).
- **Wirkung des ×1,5-Saison-Zuschlags** auf das KI-Verhalten: Vorschlag, ungetestet.
- **Arena-Beliebtheitsfaktoren**: keine Arena im Ligabestand — Arena-Zahlen sind Katalogwerte
  bei Beliebtheit 1,0.

---

## 7. Empfehlung — was gebaut werden soll

In dieser Reihenfolge:

1. **KI-Reparatur-Regel ersetzen** (größter Schaden zuerst): in
   `ai-team-management-preview-service.ts`/`ai-manager-apply-service.ts` das „repariere alles
   unter 100" durch die R-Regel aus Abschnitt 1 ersetzen (harte Untergrenze: nie bei ≥ 80),
   θ nach Abschnitt 4 aus Identity/Archetyp/Kassenlage. Der `maintenanceBudget`-Bucket wird aus
   den beschlossenen Reparaturen befüllt, nicht umgekehrt.
2. **Statusbänder und Warnschwellen auf 80 ausrichten** (Abschnitt 5, drei kleine Stellen) —
   sonst erklärt die UI die neue Regel falsch.
3. **Saison-Reparatur öffnen**: neue Phase-Action (z. B. `facility_repair_midseason`) in
   `game-phase-action-policy.ts`, Preis ×1,5, plus zweckgebundener Saison-Kredit („Kredit +
   Reparatur atomar", Summe = Reparaturkosten) für Mensch und KI; KI nutzt ihn nur über den
   Kredit-Test aus Abschnitt 3. Reparaturbedarf zusätzlich in die reguläre
   Preseason-Kreditbedarfsrechnung (`ai-loan-decision-service.ts`) aufnehmen.
4. **Mensch-Sichtbarkeit**: 80er-Marke + Wirkungs-Prozent auf der Karte, Payback-Zeile im
   Dialog, eine Inbox-Zeile am Saisonende. Kein Auto-Repair, kein Zwang.
5. **Danach messen**: ein Sim-Lauf über ~6 Saisons; Erfolgskriterien: keine Reparaturen ≥ 80
   mehr, Einnahme-Gebäude pendeln zwischen 58 und 100, mindestens ein Team lässt ein ungewolltes
   Gebäude bewusst verfallen, und kreditfinanzierte Reparaturen treten auf, aber selten.

Nicht bauen: automatische Reparatur am Saisonende (nimmt die Entscheidung weg), Teilreparaturen
(der lineare Punktpreis macht sie überflüssig), und keine Pro-rata-Abtastung im ersten Schritt
(Zuschlag zuerst, Pro-rata nur falls nötig).
