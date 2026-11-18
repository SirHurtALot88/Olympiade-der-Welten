# Finanzkonzept V2 — „Kasse über 20 Spieltage" (18.11.2026)

Nur Konzept und Mockups. **Keine Spiellogik geändert, kein Spielstand angefasst**; gebaut wird erst nach Chris' OK.
Ersetzt den Entwurf `docs/design/finanzkonzept-17-11.md` dort, wo Chris am 18.11. anders entschieden hat (20 Spieltage,
Heimspiele, Geldmenge konstant, Kredit erst nach der Kaufphase, KI-Kaufverhalten).

Faktenbasis: `docs/design/finanzen-ist-messung-18-11.md` (Messung, Läufe A/B/C) und
`docs/design/ki-kaufverhalten-analyse-18-11.md` (Code-Landkarte mit Datei:Zeile). Alle Zahlen dieses Dokuments mit „gerechnet"
stammen aus `scripts/rechne-finanzkonzept-v2-18-11.mjs` → `data/generated/finanzkonzept-v2-bilanz-18-11.json`
(Hochrechnung auf den gemessenen Gehältern, Annahmen in Abschnitt 10). Geld in C.

Mockups: `public/mockups/finanzen-daten-modern-18-11.html` (wie die Daten im Hintergrund laufen) und
`public/mockups/finanzen-modern-18-11.html` (Finanzseite, jetzt 20 Spieltage mit Heim/Auswärts). Bilder:
`docs/design/finanzkonzept-v2-18-11/` (Liste in Abschnitt 11).

---

## 0. Die acht Kernentscheidungen

1. **Alles Laufende fließt je Spieltag.** Gehälter, Sponsor-Sockel, Kreditraten, Unterhalt, Apron in 20 Raten; Tickets nur an den
   10 Heimspielen; Merch, Siegprämien an jedem Spieltag. Die Kasse sinkt über die Saison (Median von 41 auf 20 C).
2. **Der Sponsor wird zweigeteilt und bleibt der Träger des Saison-Faktors.** Sockel (nach Startrang) in 20 Raten, **Rangbonus am
   Saisonende** = Wertungstopf × Saison-Faktor nach Endrang. Gleiche Leiter wie heute, nur ein Regler tiefer:
   `SPONSOR_AUSSCHUETTUNG` 1,10 → **0,73** (gerechnet), weil Tickets, Merch und Prämien dazukommen und die Gehälter durch die
   Rücklagenregel sinken. Sponsor bleibt 68 % der Einnahmen.
3. **Geldmenge konstant heißt: Summe GuV der Liga = 0 bei Faktor 1,0**, und der Kapitalkreislauf verliert nichts mehr: der
   Verkaufsabschlag (heute vernichtet) und alle Zinsen gehen in einen **Liga-Topf**, der zu Beginn der nächsten Kaufphase
   wieder an die Teams geht. Bilanz gerechnet: Faktor 0,82 → −112 C, 1,0 → 0 C, 1,24 → +149 C.
4. **Minus in der Saison ist erlaubt**, zinsfrei bis zur Höhe des erwarteten Rangbonus. **Kassensturz am Ende der Kaufphase**
   der Folgesaison: wer dann unter 0 steht, bekommt einen Pflichtkredit (Raten je Spieltag).
5. **KI-Rücklage nach Finanzwert des Teams:** 5 % (Finanzwert 1) bis 25 % (Finanzwert 10) des Budgets, mindestens
   0,35 × Zielgehalt. Gerechnet: sparsame Teams halten im Median 22 %, sorglose 9 bis 10 % (heute alle 2 bis 4 %).
6. **Gehaltsdeckel am gewählten Sponsor:** Gehalt ≤ k × tragbares Gehalt (Planeinnahmen aus dem Sponsor-Anker minus Fixkosten)
   plus ein Drittel der freien Kasse. k = 1,0 vorsichtig, 1,1 normal, 1,25 aggressiv. Der Vorstand zieht k nach einer
   verfehlten Saison ein.
7. **Fan-Stimmung 0 bis 100** je Team, je Spieltag fortgeschrieben; sie treibt Auslastung und Merch und wird von Ergebnis,
   Heimspiel, Serie, Ticketpreis, Stars und Transfers bewegt. Sie wirkt **nur auf Geld**, nie auf die Wertung.
8. **Apron bleibt, die Linien rücken:** Median × 1,15 und × 1,35 (statt 1,2 und 1,4), Sätze unverändert. Bewegt gerechnet
   36 bis 45 C je Saison (2,2 % der Gehälter) statt 8 bis 19 C.

---

## 1. Grundsätze

| Grundsatz | Bedeutung |
|---|---|
| Eine GuV, ein Kontoauszug | Jede Buchung ist eine Zeile mit Spieltag, Posten, Quelle, Formel, Betrag. Die GuV (`lib/finance/season-end-guv.ts`) ist die Summe dieser Zeilen. „Gezeigt = gebucht." |
| Zwei Kreisläufe | **Betrieb** (Sponsor, Tickets, Gehälter; fließt je Spieltag, ist die GuV) und **Kapital** (Ablösen, Verkäufe, Käufe, Kredit; fließt im Saisonwechsel, steht neben der GuV). |
| Geldmenge | **Liga-Vermögen = Σ Kasse + Liga-Topf + Σ Marktwert der Kader + Σ Buchwert der Gebäude − Σ Restschuld.** Messpunkt: Saisonstart nach der Kaufphase. Ziel bei Faktor 1,0: ±1,5 % je Saison. |
| Selbstbalance bleibt | Sponsor hängt am Rang und am Saison-Faktor, nicht am eigenen Gehalt. Wer teurer kauft, als sein Sponsor trägt, verliert Cash (gerechnet: teuerstes Gehaltsviertel −8 bis −10 C GuV, billigstes +5 bis +10 C). |
| Wertung unberührt | Kein Finanz- oder Stimmungswert geht in die Disziplin-Mechanik. Der Fingerabdruck (`scripts/pruefe-wertung-fingerabdruck.mjs`) darf sich durch keine Stufe ändern. |
| Kein erschummeltes Geld | Negativer Kontostand wird nie auf 0 gesetzt (Chris' Notkredit-Entscheidung bleibt). |

---

## 2. Geldströme

Startwerte je Liga im Verhältnis 60/40 wie der Sponsor-Topf (`SPONSOR_TOPF_FAKTOR_JE_LIGA`). S = Fan-Stimmung (Abschnitt 4).

### 2.1 Je Spieltag (20 je Saison, davon 10 Heimspiele)

| Posten | Heim | Auswärts | Formel | Startwert Liga 1 / Liga 2 |
|---|:--:|:--:|---|---|
| **Gehälter** (−) | ja | ja | Jahresgehalt (`getTeamActualSalaryTotal`) ÷ 20 | Median 3,3 / 2,4 C |
| **Sponsor-Sockelrate** (+) | ja | ja | 0,73 ÷ 1,1 × Sockel(Startrang) ÷ 20 | 0,7 bis 1,8 C |
| **Tickets** (+) | ja | nein | Volles Haus × Auslastung × Preisstufe; Auslastung = min(1, (0,30 + 0,85 × S ÷ 100) × Preisfaktor) | Volles Haus 1,70 / 1,15 C |
| **Gebäude-Einnahme** (+) | ja | nein | Katalogwert (Fan Shop, Arena) ÷ 10 × S ÷ 50 | Höhe wie heute |
| **Merch** (+) | ×1,5 | ×0,5 | Basis ÷ 20 × S ÷ 50 × Starfaktor × (1 + 0,15 × Fan-Shop-Stufe) | Basis 4,4 / 3,0 C je Saison |
| **Siegprämie** (+) | ja | ja | je gewonnenem Disziplin-Duell (2 je Spieltag) | 0,20 / 0,12 C |
| **Kaderprämie** (−) | ja | ja | Stufe × Siegprämie; Stufe keine 0 % / normal 40 % / hoch 80 % | Standard 40 % |
| **Arena-Betrieb** (−) | ja | nein | fest je Heimspiel × (1 + 0,2 × Arena-Stufe) | 0,45 / 0,30 C |
| **Reise** (−) | nein | ja | fest je Auswärtsspiel | 0,15 / 0,10 C |
| **Gebäude-Unterhalt** (−) | ja | ja | Katalogwert ÷ 20 | wie heute |
| **Kreditrate** (−) | ja | ja | Annuität ÷ 20; Zinsanteil in die GuV, Tilgung daneben | — |
| **Apron-Rate** (±) | ja | ja | eingefrorene Abgabe bzw. Ausschüttung ÷ 20 | Abschnitt 7 |
| **Sponsor-Ereignis** (±) | ja | ja | Würfel wie heute (`sponsor-event-service.ts`) | ±2 bis +6 C |
| **Überziehungszins** (−) | ja | ja | 1 % je Spieltag auf den Teil der Schuld über dem Rahmen (2.4) | → Liga-Topf |

Starfaktor: 1,0 bei zwei Stars im Einsatz, +0,15 je weiterem, −0,30 je verletztem Star. Preisstufen in Abschnitt 4.
Heim/Auswärts-Unterschied am Beispiel G-G: **Heimspiel −0,9 C, Auswärtsspiel −2,3 C** (Rechnung in 2.5).

### 2.2 Saisonende (ein Buchungslauf nach Spieltag 20)

| Posten | Formel |
|---|---|
| **Sponsor-Rangbonus** (+) | 0,73 ÷ 1,1 × Wertungstopf × **Saison-Faktor** × Ligafaktor × Gewicht(Endrang), Leiter wie heute (`sponsor-liga-leiter.ts`), inklusive Zonenterm und Kartenform. Σ Liga gerechnet 620 C bei Faktor 1,0. |
| Sponsor-Achsen und Sonderziel (±) | wie heute |
| Vorstandsziele (±) | wie heute, Strafen nach Abschnitt 5.7 |

### 2.3 Saisonwechsel (Kapitalkreislauf, neben der GuV)

| Schritt | Buchung | Liga-Topf |
|---|---|---|
| Vertragsablauf | + Verkaufspreis an den Klub (heute, `contract-renewal-service.ts:938`) | + Abschlag (Marktwert − Verkaufspreis) |
| KI- und Spielerverkäufe | + Nettoerlös | + Abschlag (gemessen 125 bis 197 C je Saison) |
| **Liga-Topf-Ausschüttung** (neu) | + Saisonstart-Budget je Team: 50 % zu gleichen Teilen, 50 % nach Vorstandsvertrauen | − gesamter Topf |
| Sponsorwahl | Vertrag der neuen Saison (vor dem Kauf, wie heute) | — |
| Käufe, Gebäude, freiwillige Kredite | − Preis, − Baukosten, + Kreditbetrag | — |
| **Kassensturz** (neu, Schluss des Kauffensters) | Kasse < 0 → Pflichtkredit (Abschnitt 6); Apron-Linien frieren ein (wie heute) | + Zinsen über die Saison |

### 2.4 Überziehungsrahmen in der Saison

Rahmen = erwarteter Rangbonus am **aktuellen** Rang (aus dem Vertrag, mit dem Saison-Faktor). Bis dahin zinsfrei; das Geld kommt
am Saisonende sicher. Darüber: 1 % je Spieltag auf den übersteigenden Betrag, Käufe und Gebäude gesperrt (Pflicht-Auffüllung bis
Kader-Minimum bleibt möglich), Vorstandsvertrauen −0,1 je Spieltag.

### 2.5 Beispiel: G-G (Liga 1, normal, Lauf C, Faktor 1,0; gerechnet)

Budget 310, Finanzwert 6,7 → Rücklage 17,7 % = 54,8 C. Gehalt 65,8 C (gemessen ohne Regel: 77,3 C, Kasse 10,1 C).

| je Spieltag | Heim | Auswärts |
|---|---:|---:|
| Gehalt | −3,29 | −3,29 |
| Sponsor-Sockelrate | +0,88 | +0,88 |
| Tickets (Auslastung 83 %) | +1,41 | — |
| Merch | +0,41 | +0,14 |
| Siegprämie (Ø 1,28 Siege) | +0,26 | +0,26 |
| Kaderprämie 40 % | −0,10 | −0,10 |
| Arena-Betrieb / Reise | −0,45 | −0,15 |
| **Saldo** | **−0,88** | **−2,26** |

Kasse: 54,8 → 23,3 nach Spieltag 20 → +58,6 Rangbonus (Endrang 5) +8,0 Vorstand → **89,9 C**. GuV +35,1 C.
Gegenbild Z-H (aggressiv, Finanzwert 2,0, Gehalt 90,9 am Deckel, Endrang 8 bei Startrang 2): Kasse 34,5 → −28,1 → +29,5 +1,0 →
**2,4 C**, GuV −32,1 C.

### 2.6 Was aus dem Mockup vom 17.11. bleibt und was sich ändert

| Mockup 17.11. | Stand 18.11. (`finanzen-modern-18-11.html`) |
|---|---|
| 10 Spieltage, kein Heimspiel | 20 Spieltage, Heim/Auswärts in Kurve, Kontoauszug und Stimmungsverlauf |
| Wertungs-Abschlag je Spieltag + Schlusszahlung | Sockel in 20 Raten, **Rangbonus in einem Betrag am Saisonende** |
| Dispo zum Aufnehmen, 18 % Zins | zinsfreier Rahmen bis zum erwarteten Rangbonus, Kredit erst am Kassensturz |
| Ticketpreis frei −30 bis +30 % | vier Stufen (günstig, normal, teuer, Topzuschlag), „Auto" = KI-Regel |
| Ligageld / TV, Spieltagsprämie nach Platz | Siegprämie je gewonnenem Duell |
| Sparkurs, Einzelbonus an einen Spieler | Kaderprämie in drei Stufen |
| Ärmel- und Disziplin-Sponsoren (Slots 2 und 3) | bleiben im Mockup als Vorschlag, **nicht** in der Geldmengen-Bilanz (Frage 10); Disziplin-Bonus zählt jetzt je gewonnenem Duell statt je Podium |

Alle Reiter des Mockups (Übersicht, Spieltags-Abrechnung, Hebel, Slots, Angebote, Bonus je Spieltag, Stimmung & Tickets, Merch)
sind umgestellt; die Zahlen im Mockup bleiben erfunden, die Regeln sind die dieses Dokuments.

---

## 3. Geldmengen-Bilanz

### 3.1 Betrieb, Σ über 32 Teams je Saison (gerechnet, Mittel der Läufe A/B/C)

| | Faktor 0,82 | Faktor 1,0 | Faktor 1,24 | heute bei 1,0 |
|---|---:|---:|---:|---:|
| Sponsor-Sockel (20 Raten) | 774 | 774 | 774 | — |
| Sponsor-Rangbonus (Saisonende) | 509 | 620 | 769 | — |
| **Sponsor gesamt** | 1282 | 1394 | 1543 | 2089 |
| Tickets | 331 | 331 | 331 | 0 |
| Merch | 118 | 118 | 118 | 0 |
| Siegprämien | 102 | 102 | 102 | 0 |
| Vorstandsziele (gemessen) | 93 | 93 | 93 | 93 |
| **Einnahmen** | **1927** | **2038** | **2187** | **2182** |
| Gehälter | −1838 | −1838 | −1838 | −2134 |
| Arena-Betrieb und Reise | −160 | −160 | −160 | 0 |
| Kaderprämien | −41 | −41 | −41 | 0 |
| **Ausgaben** | **−2038** | **−2038** | **−2038** | **−2134** |
| **Σ GuV = Änderung der Geldmenge** | **−112** | **0** | **+149** | **+48** |
| in % der Gehälter / des Liga-Vermögens (7920) | −6,1 / −1,4 | 0 / 0 | +8,1 / +1,9 | +2,3 / +0,6 |
| Sponsor-Anteil an den Einnahmen | 67 % | 68 % | 71 % | 96 % |

Der Saison-Faktor bewegt die Liga um 261 C zwischen 0,82 und 1,24 (heute 390 C). Sein Wurf liegt gleichverteilt bei 0,82 bis
1,24, Mittel 1,03: das sind im Schnitt +19 C je Saison. Wer exakt Null will, verschiebt das Fenster auf 0,79 bis 1,21 (Frage 5).

### 3.2 Kasse im Saisonverlauf (gerechnet, Faktor 1,0)

| | heute (gemessen) | neu |
|---|---:|---:|
| Σ Kasse nach dem Draft | 228 bis 244 | 1308 (16,5 % der Budgets) |
| Median je Team nach dem Draft | 6,6 | 41 |
| Σ Kasse nach Spieltag 20, vor dem Rangbonus | 227 bis 242 | 595 |
| Median je Team nach Spieltag 20 | ~7 | 20 |
| Teams im Minus nach Spieltag 20 | — | 8 von 32, tiefster −28 |
| Teams im Minus nach der Saisonabrechnung | 9 bis 11 von 32 | 0 bis 1 von 32 |
| Gehaltssumme | 2122 bis 2142 | 1838 (−14 %) |

### 3.3 Kapital: woher kommt das Kaufbudget der Folgesaison (Vorgabe 9)

| Quelle je Saison, Σ Liga | Betrag | Charakter |
|---|---:|---|
| Kasse nach der Abrechnung (Rücklage + GuV) | ~1308 ± Faktor | Betrieb; bei Faktor 1,0 genau die Rücklage |
| Ablöse auslaufender Verträge (gemessen) | 1244 bis 1796 | Umwälzung: Spielerwert wird Geld |
| Verkäufe netto (gemessen) | 683 bis 993 | Umwälzung |
| **Liga-Topf** (neu): Verkaufsabschlag 125 bis 197 gemessen, Ablauf-Abschlag ~220 bis 320 geschätzt, Zinsen ~40 | ~390 bis 560 | Rückführung des heutigen Lecks, Ø 12 bis 17 C je Team |
| − neue Rücklage | −1308 | bleibt liegen |
| **frei für Käufe und Gebäude** | **~2300 bis 3350** | Bedarf zum Auffüllen laut Analyse 1684 bis 2436 |

Damit ist die Antwort auf „es muss ja Geld für Budgets da sein": Das Kaufbudget ist **umgewälztes Spielerkapital** (wie heute, gewollt:
„ein Vertragsende ist ein Verkauf") **plus der zurückgeführte Abschlag**. Es entsteht kein neues Geld; es verschwindet nur keines
mehr. Das heutige Leck (Vermögen −4,4 bis −4,9 % je Saison, gemessen) entspricht in der Größe dem Abschlag auf Verkauf und Ablauf.
Was der Liga-Topf nicht ausgleicht, ist die Neubewertung der Marktwerte durch Spielerentwicklung; die wird in Stufe 0 gemessen und
notfalls über den Ablöse-Faktor nachgeführt.

---

## 4. Stimmungsmodell (Fans)

Ein Wert **S = 0 bis 100 je Team**, Start 50 in Saison 1, danach 50 + 0,5 × (S am Saisonende − 50). Fortschreibung nach jedem Spieltag.

| Auslöser | Wirkung auf S |
|---|---|
| Spieltagsergebnis (2 Duelle) | 2:0 → +4 · 1:1 → 0 · 0:2 → −4; **Heimspiel × 1,5** |
| Erwartung (Gehaltsrang gegen Gegner, Abstand ≥ 4 Plätze) | Außenseiter gewinnt +2 · Favorit verliert −2 |
| Serie | ab 3 Spieltagen ohne Niederlage +1 je Spieltag · ab 3 Niederlagen −1 |
| Ticketpreis (nur Heimspiel) | günstig +1,5 · normal 0 · teuer −1,5 · Topzuschlag −3 |
| Star (Top 3 nach Marktwert) | verletzt −1 je Spieltag · Rückkehr +2 einmalig |
| Transfers in der Kaufphase | Star gekauft +4 · Fan-Liebling (`FanFavorite`) verkauft −5 |
| Saisonende | Titel oder Aufstieg +10 · Abstieg −10 · Vorstandsziel „Rang" erfüllt +3 |
| Rückzug zur Mitte | −0,08 × (S − 50) je Spieltag |

| Preisstufe | Preis | Nachfrage | Umsatz bei S 50 (Auslastung 73 %) | Umsatz bei S 90 (Nachfrage 107 %) |
|---|---:|---:|---:|---:|
| günstig | × 0,8 | × 1,10 | × 0,88 | × 0,80 |
| normal | × 1,0 | × 1,00 | × 1,00 | × 1,00 |
| teuer | × 1,2 | × 0,90 | × 1,08 | × 1,15 |
| Topzuschlag | × 1,4 | × 0,78 | × 1,09 | × 1,16 |

Wohin S wirkt: Tickets, Merch, Gebäude-Einnahme (2.1), Trefferchance des Sponsor-Aktionsbonus (+/− 4 Prozentpunkte je 20 S),
Vorstandsvertrauen (S unter 30 am Saisonende: −0,25). Die langsame Beliebtheit (`team-beliebtheit.ts`) wird durch den
Saisonübertrag von S ersetzt.

**Moral der Spieler** bleibt das eigene System (Branch Form/Moral). Dieses Konzept liefert ihm nur drei Eingänge:
Kaderprämien-Stufe (keine: −, hoch: +), Kasse über dem Rahmen im Minus („Gehälter unsicher": −) und S über 75 („Rückenwind": +).

---

## 5. KI-Regeln (die KI nutzt jede Funktion, die der Spieler hat)

Archetyp aus den vorhandenen Identitätswerten: Neigung = Ambition − Finanzwert. **aggressiv** ab +3 (9 Teams), **vorsichtig**
bis −2 (8 Teams), sonst **normal** (15 Teams).

### 5.1 Reihenfolge der Kaufphase

Liga-Topf → Sponsorwahl → Planeinnahmen → Rücklage und Deckel → Verkauf → Kauf → Gebäude → Kassensturz/Kredit.

### 5.2 Rücklage (Vorgabe 8)

```
Rücklage = max( q × Budget , 0,35 × Zielgehalt )      q = 5 % + 20 % × (Finanzwert − 1) ÷ 9
```

Budget ist in Saison 1 das Startbudget, danach Kasse zu Beginn der Kaufphase plus Marktwert des Kaders. Zielgehalt =
`projectSalaryAtPlannerTarget` (Kader auf Soll-Größe), nicht das Gehalt des gerade leeren Kaders.

| Finanzwert | Teams | Rücklage in % des Budgets (gerechnet, Min / Median / Max) | heute |
|---|---:|---|---|
| bis 3 | 8 | 8,4 / 9,3 bis 10,1 / 21 | 2 bis 4 |
| 3 bis 7 | 14 | 9,5 / 14,0 / 23 | 2 bis 4 |
| ab 7 | 10 | 18,5 / 22 / 29 | 2 bis 4 |

Werte über 10 % in der untersten Klasse entstehen nur durch den Deckel (5.3). Im Code: Schrauben A und B der Analyse
(`draft-adapter.ts:436`, `:591`), dazu die Stufe „unter Kader-Minimum" im Builder (`draft-builder.ts:225`), die den Boden
abzüglich `reserveForMin` kennen muss. `spendableNet` (`draft-adapter.ts:541`) rechnet mit der neuen Rücklage statt mit 5.

### 5.3 Gehaltsdeckel am Sponsor (Vorgabe 8)

```
Planeinnahmen   = 0,92 × Sponsor-Anker + Tickets(S 50) + Merch(S 50) + 20 Siege × Prämie
tragbares Gehalt = Planeinnahmen − Betrieb − Reise − Kaderprämie − Unterhalt − Kreditrate
Gehaltsdeckel   = k × tragbares Gehalt + (Kasse über der Rücklage) ÷ 3
```

| Archetyp | k | Lauf C: Gehalt heute → neu (Median) | vom Deckel gekappt |
|---|---:|---|---:|
| vorsichtig | 1,00 | 59,7 → 46,8 | 2 von 8 |
| normal | 1,10 | 62,9 → 52,6 | 6 von 15 |
| aggressiv | 1,25 | 78,7 → 71,1 | 3 von 9 |

Der Kassenterm heißt: wer Geld liegen hat, darf drei Saisons über seine Verhältnisse leben. Der Deckel gilt erst über dem
Kader-Minimum (8 Spieler bleiben immer erreichbar) und rechnet gegen den Zielkader. Im Code: `SALARY_CEILING_V2`
(`salary-ceiling.ts`) mit `terms.anchor × 0,92` statt der Basis-Komponente (Schraube D), dazu `forecast.sponsorIncome`
an den drei Aufrufstellen (Schraube C), damit das Team schon vor der Grenze bremst.

### 5.4 Sponsorwahl

Wie heute das beste von drei Angeboten, mit einem zusätzlichen Term: vorsichtige Teams gewichten den Sockelanteil
(Sicherheit) × 1,3, aggressive den Rangbonus × 1,3. Der Deckel aus 5.3 wird erst **nach** der Wahl gerechnet; damit folgt die
Gehaltssumme dem gepickten Sponsor.

### 5.5 Ticketpreis (vor jedem Heimspiel)

| Bedingung (erste, die zutrifft) | Stufe |
|---|---|
| S unter 35 und Kasse ≥ 0 | günstig |
| S ab 95 (Nachfrage über 110 %) und Archetyp nicht vorsichtig | Topzuschlag |
| S ab 83 (das Haus bleibt bei „teuer" zu ≥ 90 % voll) | teuer |
| Kasse unter dem Rahmen (2.4) und S ≥ 45 | teuer |
| sonst | normal |

Im Mockup-Durchlauf aller 32 Teams wählt die Regel an 320 Heimspielen 42-mal günstig, 268-mal normal, 10-mal teuer.

Kaderprämie: hoch, wenn Kasse > 1,5 × Rücklage und Archetyp aggressiv; keine, wenn Kasse < 0; sonst normal.

### 5.6 Kredit und Gebäude

| Funktion | Regel |
|---|---|
| Pflichtkredit | automatisch am Kassensturz (Abschnitt 6) |
| freiwilliger Kredit | nur in der Kaufphase, nur wenn Kader unter Soll **und** Schuldendienst danach ≤ 10 % der Planeinnahmen (aggressiv 15 %); Saison 1 keine (wie heute) |
| Gebäude | nur aus Kasse über der Rücklage, höchstens 30 % davon; Fan Shop/Arena zuerst, wenn Amortisation ≤ 4 Saisons bei eigener Stimmung; sonst Leistungsgebäude nach GM-Typ; kein Bau unter Kader-Soll, mit Pflichtkredit oder bei Vorstands-Sparauflage |
| Notverkauf in der Saison | wenn Kasse 3 Spieltage unter dem Rahmen: teuerster Spieler außerhalb der Stammformation an den Markt |

### 5.7 Vorstand (bestraft ausbleibenden Erfolg)

Erwartungsrang = Rang der eigenen Gehaltssumme in der Liga. Am Saisonende:

```
ΔVertrauen = clamp( (Erwartungsrang − Endrang) × 0,25 , −2 , +2 )
           + ( Kasse ≥ 0 ? +0,25 : −0,5 )  + ( GuV < −10 % des Gehalts und Endrang schlechter als erwartet ? −0,5 : 0 )
```

| Vertrauen (0 bis 10) | Folge in der nächsten Kaufphase |
|---|---|
| ab 6 | k + 0,05, voller Anteil am Liga-Topf |
| 4 bis 6 | neutral |
| 2,5 bis 4 | k − 0,10, Rücklage + 3 Prozentpunkte |
| unter 2,5 („Sparauflage") | k = 1,0, Rücklage mindestens 15 %, keine Gebäude, keine freiwilligen Kredite; für den Menschen als sichtbare Vorgabe |

Geldstrafe je verfehltem Rang- oder Finanzziel 3 % des Gehalts (statt fest 2 C). Das Finanzziel der Saison 1 wird die Rücklage
aus 5.2 (heute 15 bis 30 C fix, gegen das eigene Draftverhalten gebaut).

---

## 6. Kredit-Regel

| | Regel |
|---|---|
| In der Saison | Kasse darf negativ sein. Zinsfrei bis zum Rahmen (2.4), darüber 1 % je Spieltag. |
| Saisonende | Rangbonus und Vorstand gebucht; ein negativer Rest bleibt stehen. |
| **Kassensturz** | Schluss des Kauffensters der Folgesaison. Kasse < 0 → **Pflichtkredit = Fehlbetrag + 10 % des Jahresgehalts**. |
| Konditionen | 2 Saisons (40 Raten je Spieltag), Zins 12 % je Saison; bei Vertrauen unter 2,5 16 %. Zins → Liga-Topf. |
| Obergrenze | Schuldendienst aller Kredite ≤ 20 % der Planeinnahmen. |
| Über der Obergrenze | Vor dem Kredit verkauft der Vorstand: höchstes Gehalt je Leistung zuerst, nie unter 8 Spieler. Der Mensch bekommt denselben Schritt als Dialog (selbst verkaufen oder Kredit), Frist ist der Fensterschluss. |
| Mensch | sieht den Kassensturz ab Beginn der Kaufphase als Vorschau („nach deinen Käufen: −12,4 C → Kredit 19,0 C, Rate 0,58 C je Spieltag"). |

---

## 7. Apron-Neueichung

Regeln bleiben (`apron-service.ts`): verhandeltes Gehalt gegen den Liga-Median, zwei Linien, Deckel 50 % des eigenen
Rangbonus, Konjunkturhebel (aus bei Faktor < 0,88), Ausschüttung zu gleichen Teilen an alle Teams unter Linie 1.

| | heute | neu |
|---|---|---|
| Linie 1 / Linie 2 | Median × 1,20 / × 1,40 | Median × **1,15** / × **1,35** |
| Sätze | 0,8 / 1,6 | unverändert |
| Buchung | Saisonende | 20 Raten (Linien frieren am Kassensturz ein, die Summe steht fest) |
| Volumen (gerechnet, A / B / C) | 19 / 8 / 12 C, 2 bis 4 Zahler | 45 / 36 / 41 C, 6 Zahler, höchste Abgabe 12 bis 15 C |
| Anteil an den Gehältern | unter 1 % | 2,0 bis 2,5 % |

Das Volumen wächst auch ohne Linienänderung, weil Rücklage und Deckel die Gehälter spreizen (aggressiv 71 gegen vorsichtig 47).

---

## 8. Bau-Reihenfolge (kleine PRs, je Stufe ein A/B-Lauf)

Messwerkzeug für alle Stufen: `scripts/miss-teamfinanzen-saison.ts` (ein Lauf ~30 min), vorher mit dem M-M-Fix der Analyse
(Abschnitt 5, Patch a). Je Stufe zwei Saaten, Vergleich vorher/nachher. Fingerabdruck vor jedem Merge.

| # | PR | Inhalt | Messschritt / Abnahme |
|---:|---|---|---|
| 0 | Kontoauszug + Mehrsaison-Messung | Buchungsliste je Team und Spieltag (nur Lesen/Schreiben der Zeilen, keine neue Buchung); Messskript spielt 3 Saisons inklusive Kader-Auffüllen; Messfix M-M | Σ Vermögen je Saisonstart; GuV je Team bit-gleich zu heute |
| 1 | KI: Zielgehalt und Sponsor im Forecast | Schrauben B und C | Kasse nach Draft, Kadergröße, Verletzungen; Kader unter Soll nicht mehr als heute + 2 Teams |
| 2 | KI: Rücklage nach Finanzwert | Schraube A, Stufe „unter Minimum", Finanzziel des Vorstands aus derselben Formel | Rücklage je Finanzklasse im Korridor aus 5.2; kein Team unter 8 Spielern |
| 3 | KI: Gehaltsdeckel am Sponsor-Anker | `SALARY_CEILING_V2` mit Anker, Kassenterm, k je Archetyp | Sponsor/Gehalt Liga 1 „arm" von 0,70 auf ≥ 0,90; Kadergröße wie Stufe 2 |
| 4 | Taktung | Gehalt, Sockel, Unterhalt, Kreditrate in 20 Raten; Rangbonus am Ende; Überziehungsrahmen | Saison-GuV je Team ±0,5 C gegenüber Stufe 3; Kassenkurve fällt |
| 5 | Heimspiel-Einnahmen und Stimmung | Tickets, Merch, Siegprämie, Betrieb, Reise, Kaderprämie (KI: alles „normal"); `SPONSOR_AUSSCHUETTUNG` neu geeicht | Σ GuV bei Faktor 1,0 in ±30 C; Sponsor-Anteil 65 bis 72 %; S-Spreizung P10 bis P90 ≥ 30 |
| 6 | Liga-Topf | Abschlag und Zinsen sammeln, Ausschüttung zu Beginn der Kaufphase | Σ Vermögen über 3 Saisons ±1,5 % je Saison bei festem Faktor 1,0 (`parseSalaryFactorPatternEnv`) |
| 7 | Kassensturz und Pflichtkredit | Abschnitt 6, Vorschau für den Menschen | Kein Team mit Kasse < 0 nach dem Kassensturz; Schuldendienst ≤ 20 % |
| 8 | Hebel für Mensch und KI | Ticketpreis, Kaderprämie, Sponsor-Term, Gebäude-Regel | KI nutzt jede Stufe mindestens einmal je Saison in ≥ 20 % der Teams |
| 9 | Vorstand und Apron | 5.7 und Abschnitt 7 | Apron-Volumen 2 bis 3 % der Gehälter; aggressive Teams mit verfehltem Rang verlieren k |
| 10 | Finanzseite | Bau nach den beiden Mockups | Bildpaar Mockup / App je Ansicht |

Stufen 1 bis 3 ändern nur die KI und können vor der Taktung live gehen. Stufe 5 ist die einzige mit großem Eichrisiko.

---

## 9. Offene Entscheidungen für Chris

| # | Frage | Empfehlung |
|---:|---|---|
| 1 | „Teams mit hohen Finanzen" = Finanzwert des Teams (Identität, 1 bis 10) oder Budget-Klasse (reich/arm)? | **Finanzwert.** Nach Budget-Klasse träfe es laut Analyse die Falschen (Reiche zu vorsichtig, Liga-1-Arme weiter unterdeckt). |
| 2 | Sponsor-Ausschüttung von 1,10 auf rund 0,73 senken (Sponsor 68 % statt 96 % der Einnahmen)? | **Ja**, sonst wächst die Geldmenge um Tickets, Merch und Prämien. Endwert kommt aus dem Messlauf der Stufe 5. |
| 3 | Gehälter sinken durch Rücklage und Deckel um rund 14 % (Kader werden schwächer oder kleiner). Gewollt? | **Ja**, das ist der Preis der Rücklage. Alternative: Startbudgets um 15 % anheben, dann bleibt die Kaderstärke. |
| 4 | Minus in der Saison bis zum erwarteten Rangbonus zinsfrei, darüber 1 % je Spieltag? | **Ja.** Ohne Rahmen wäre das Minus folgenlos, mit Zins ab 0 würde die Taktung selbst bestraft. |
| 5 | Saison-Faktor mittig auf 1,0 legen (0,79 bis 1,21 statt 0,82 bis 1,24)? | **Ja**, sonst wächst die Liga im Schnitt um 19 C je Saison. |
| 6 | Liga-Topf: Verkaufsabschlag und Zinsen zurück an die Teams, halb gleich, halb nach Vorstandsvertrauen? | **Ja.** Alternative „alles gleich" ist einfacher, belohnt aber Erfolg nicht. |
| 7 | Pflichtkredit: 2 Saisons, 12 %, Schuldendienst höchstens 20 %, darüber Zwangsverkauf durch den Vorstand? | **Ja.** |
| 8 | Vier Ticketpreis-Stufen statt freiem Regler? | **Ja**, einfacher für Mensch und KI, gleiche Wirkung. |
| 9 | Kaderprämie als eigene Ausgabe (Standard 40 % der Siegprämie) mit Wirkung auf die Moral? | **Ja**, aber Moral-Wirkung erst, wenn Form/Moral gemerged ist. |
| 10 | Ärmel- und Disziplin-Sponsoren aus dem Mockup vom 17.11. (Slots 2 und 3) bauen? | **Später, als eigene Stufe nach 10**, und summenneutral: ihr Geld wird aus dem Sockel des Hauptsponsors herausgeschnitten, nicht obendrauf gelegt. |

---

## 10. Annahmen und Grenzen der Rechnung

* **Hochrechnung, keine Messung.** Gehalt ∝ Draft-Ausgabe (gemessen 0,277 je C). Der Endrang bleibt der gemessene, obwohl
  Rücklage und Deckel die Kaderstärke verschieben. Stimmung, Auslastung und Siege sind in der Rechnung Funktionen des Endrangs.
* **Sponsor-Zerlegung:** Sockel nach Startrang laut Code, Rangbonus = gemessene Auszahlung − Sockel, linear im Faktor.
  M-M (Messartefakt, kein Sponsor) ist durch 0,92 × bestes Angebot ersetzt; deshalb „heute bei 1,0" Σ 2089 statt der
  gemessenen 1953 bis 2138 bei Faktor 1,02 bis 1,18.
* **Nur Saison 1.** Gebäude-Unterhalt (ab Saison 2 Σ 26 bis 48 C) und Gebäude-Einnahmen fehlen in 3.1; die Eichung der Stufe 5
  muss sie einrechnen. Der Ablauf-Abschlag im Liga-Topf ist aus dem Verkaufsabschlag geschätzt, nicht gemessen.
* **Heimspiele:** angenommen 10 von 20 je Team (`homeTeamId` am Fixture). Der Spielplan ist darauf nicht geprüft.
* **Vorstandsziele** stehen mit den gemessenen +93 C in der Bilanz; die härteren Strafen aus 5.7 senken das um geschätzt 20 bis 40 C
  und werden in Stufe 9 gegen den Sponsor nachgeeicht.
* Die Deckel-Regel kappt 9 bis 12 von 32 Teams. Die abgeschaltete Vorgängerin hat Kader schrumpfen lassen (Analyse 1.2); deshalb
  Stufe 3 nur mit Kadergrößen-Abnahme.

---

## 11. Mockups und Bilder

**`finanzen-daten-modern-18-11.html`** — wie die Daten im Hintergrund laufen. Fünf Abschnitte, oben rechts Team (alle 32) und
Saison-Faktor (0,82 / 1,00 / 1,24) umschaltbar. Zahlen je Team aus der Rechnung (Lauf C); Ergebnisse je Spieltag gesät.

| Abschnitt | Zeigt | Bedienung |
|---|---|---|
| 1 Spieltag | Buchungen des Spieltags; je Zahl Quelle → Formel → Buchung → Kasse; Kassenkurve über 20 Spieltage mit Heim/Auswärts und Rahmen | Posten oder Kachel anklicken, Spieltags-Regler oder Pfeiltasten, Ticketpreis-Stufe |
| 2 Saisonende | Kasse nach Spieltag 20 → Rangbonus → Vorstand; GuV der Saison; Wirkung des Faktors | Faktor umschalten |
| 3 Folgesaison | Ablöse, Verkäufe, Liga-Topf, Sponsorwahl, Käufe, Gebäude, Kassensturz mit Kreditprüfung | Kaufsumme-Regler, „Überziehen", Gebäude |
| 4 KI-Team | Archetyp, Rücklage, Planeinnahmen, Gehaltsdeckel; was die KI in der Saison einstellt; Vorstand | Team in der Liste anklicken |
| 5 Liga | Geldmengen-Bilanz je Faktor, zwei Kreisläufe, Liga-Topf, Kaufbudget | Faktor umschalten |

**`finanzen-modern-18-11.html`** — die Finanzseite aus dem Mockup vom 17.11., umgestellt nach 2.6.

Bilder unter `docs/design/finanzkonzept-v2-18-11/`, Namen `daten-…` (Datenfluss) und `seite-…` (Finanzseite), Endung
`-1920` (1920×1080), `-2560` (2560×1440), `-1710` (1710×1112). Alle Ansichten bei 1920×1080, die Hauptansichten zusätzlich in
den beiden anderen Größen.
