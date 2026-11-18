# Finanzkonzept V2 — Zwei Budgets des Vorstands (18.11.2026)

Ergänzung zu `docs/design/finanzkonzept-v2-18-11.md`. **Nur Konzept, Rechnung und Mockups, kein Spiel-Code.**
Chris hat am 18.11. das Zwei-Budget-Modell „wie im Football Manager" freigegeben: je Saison zwei harte Töpfe, vom Vorstand zu
Beginn des Transferfensters festgelegt und begründet. Dieses Dokument macht daraus Formeln, Startwerte und Regeln.

Es **ersetzt** im Hauptdokument: Kernentscheidung 6 und Abschnitt 5.3 (Gehaltsdeckel `k × tragbares Gehalt`), die Folgen-Tabelle
in 5.7 (k ± …) und die Baustufe 3. Alles andere dort gilt weiter (Taktung, Geldströme, Stimmung, Kredit, Apron, Liga-Topf).

Zahlen mit „gerechnet" stammen aus `scripts/rechne-vorstands-budgets-18-11.mjs` →
`data/generated/finanzkonzept-v2-budgets-18-11.json`. Basis sind die Messläufe A/B/C (32 KI-Teams) und die Hochrechnung des
Hauptdokuments (Sponsor-Ausschüttung 0,73, Einnahmen aus Tickets, Merch, Prämien). Geld in C.

Mockups: `public/mockups/finanzen-modern-18-11.html` (neuer Reiter „Budgets"), `public/mockups/finanzen-daten-modern-18-11.html`
(neuer Abschnitt 6 „Budgets"), `public/mockups/transfermarkt-modern-18-11.html` (Geld-Block mit zwei Balken). Bilder:
`docs/design/finanzkonzept-v2-budgets-18-11/` (Liste in Abschnitt 11).

---

## 0. Kurzfassung

1. **Zwei Töpfe, eine Quote.** Das Transfer- und Investitionsbudget kommt aus der Kasse, das Gehaltsbudget aus den erwarteten
   Einnahmen. Beide werden mit derselben Vertrauens-Quote (100 / 85 / 70 / 50 %) multipliziert. Das Geld bleibt auf dem Konto.
2. **Der Gehaltsdeckel entfällt als eigene Regel.** Was im Hauptdokument `k` war (1,0 / 1,1 / 1,25 je Charakter), ist jetzt das
   Umschichten: der Gehaltstopf darf um höchstens 25 % wachsen, bezahlt 1 : 1 aus dem Transfertopf.
3. **Lockerung nach Verkäufen:** Bleibt aus den Verkäufen ein Puffer X auf dem Konto (10 / 20 / 30 % des tragbaren Gehalts, je
   strenger die Stufe, desto mehr), steigt die Transfer-Quote für dieses Fenster um eine Stufe. Angekündigt mit dem fehlenden
   Betrag. Drei Obergrenzen (Abschnitt 4.3).
4. **Gerechnet, Saison 1:** Mit den Töpfen hätte **jedes** der 31 Teams den Transfertopf überzogen (Median 24 bis 25 C, das ist
   die Rücklage) und **27 bis 28 von 31** den Gehaltstopf (Median 12 C). Luft im Gehalt haben nur C-S, D-P, G-G.
5. **Gerechnet, Fenster Saison 2:** Auf den gemessenen Kassen reicht der Transfertopf für das, was die KI gekauft hat, bei 16 bis
   25 von 31 Teams, für ein volles Auffüllen des Kaders aber nur bei einem. Grund ist nicht die Quote, sondern dass in Saison 1
   niemand eine Rücklage gehalten hat. Eingeschwungen (Saison 1 schon mit Töpfen geplant, Liga-Topf läuft) decken die
   Transfertöpfe den Auffüll-Bedarf in der Summe (2293 bis 2351 C gegen 2299 bis 2501 C).
6. **Saison 1 braucht 100 % für alle.** Mit dem Startvertrauen der Team-Identität (6 Teams unter 2,5) fiele die Gehaltssumme der
   Liga von 2134 auf 1513 C, die Kassen stiegen auf 2433 C. Der Vorstand urteilt erst nach der ersten Saison (Frage 1).
7. **Geldmenge:** Saison 1 mit Töpfen: Gehälter 1763 C (heute 2134, Hauptdokument 1838), Kasse nach dem Draft 1566 C,
   Sponsor-Ausschüttung **0,695** statt 0,73. Ab Saison 2 halten die Quoten bis zu 220 bis 285 C Gehaltsbudget je Saison zurück;
   das ist gewollt, muss aber im Mehrsaison-Lauf gemessen werden (Abschnitt 8).

---

## 1. Formeln und Startwerte

Festgelegt wird **einmal, zu Beginn des Transferfensters**: nach Saisonabrechnung, Vertragsablauf, Liga-Topf-Ausschüttung und
Sponsorwahl. Reihenfolge der Kaufphase neu: Liga-Topf → Sponsorwahl → **Vorstand legt beide Töpfe fest** → Verkauf → Umschichten
und Kauf → Gebäude → Kassensturz.

```
Quote q           = 100 %  Vertrauen ab 6
                     85 %  4 bis unter 6
                     70 %  2,5 bis unter 4
                     50 %  unter 2,5

tragbares Gehalt  = Sponsor-Sockel + erwarteter Rangbonus × Saison-Faktor + Tickets + Merch + Siegprämien
                    − Fixkosten (Arena-Betrieb, Reise, Kaderprämie, Gebäude-Unterhalt, Kreditraten)

Gehaltsbudget     = q × tragbares Gehalt                         Jahreswert; je Spieltag ÷ 20

Rücklage-Ziel     = ( 5 % + 20 % × (Finanzwert − 1) ÷ 9 ) × Budget
Gehaltspuffer     = max( 0 , 0,35 × Gehaltsbudget − Rücklage-Ziel )      7 Spieltage Gehalt, soweit die Rücklage sie nicht deckt

Transfer- und
Investitionsbudget = q × max( 0 , Kasse − Rücklage-Ziel − Gehaltspuffer )  +  q × Verkaufserlöse im Fenster
```

| Größe | Startwert / Quelle |
|---|---|
| Sponsor-Sockel, erwarteter Rangbonus | aus dem gewählten Sponsorvertrag: Sockel nach Startrang, Rangbonus = 0,92 × Anker − Sockel (Anker = Erwartungswert des Vertrags, `terms.anchor`). Wie Abschnitt 5.3 des Hauptdokuments, nur ohne k. |
| Saison-Faktor | der Faktor der kommenden Saison; er steht beim Vertragsschluss fest (`salaryFactorAtSign`) |
| Tickets, Merch, Siegprämien | Planwerte bei Stimmung 50: 10 Heimspiele × Volles Haus × 72,5 %, Merch-Basis, 20 Siege × Prämie |
| Budget (für die Rücklage) | Saison 1: Startbudget. Danach Kasse zu Fensterbeginn + Marktwert des Kaders |
| Gehaltspuffer | Rücklage und Puffer zusammen = max(Rücklage-Ziel, 0,35 × Gehaltsbudget); das ist die Rücklagenformel des Hauptdokuments (5.2), nur in zwei benannten Teilen |
| Kasse im Minus | Transferbudget 0. Verkaufserlöse gleichen zuerst das Minus aus, erst der Rest fließt zur Quote ein |

**Was gegen welchen Topf zählt**

| Topf | belastet durch | entlastet durch |
|---|---|---|
| Transfer und Investition | Ablösen, Baukosten und Ausbaustufen von Gebäuden | Verkaufserlöse × Quote, Umschichten |
| Gehalt | Summe der verhandelten Jahresgehälter **aller** laufenden Verträge, also auch Verlängerungen und Gehaltserhöhungen | Verkauf oder Vertragsende eines Spielers (sein Gehalt geht voll in den Topf zurück), Umschichten |

**Hart heißt:** Ein Kauf geht nur durch, wenn die Ablöse in den freien Transfertopf **und** das neue Gehalt in den freien
Gehaltstopf passt. Gleiches gilt für Vertragsverlängerung (nur Gehaltstopf) und Gebäude (nur Transfertopf). Mensch und KI gleich.

| Sonderfall | Regel |
|---|---|
| Pflicht-Auffüllung | Bis zum Kader-Minimum (8) bleibt der billigste verfügbare Spieler immer kaufbar, auch über dem Topf. Der Topf zeigt dann „überzogen". |
| Laufende Gehälter über dem Gehaltsbudget | Kein Zwangsverkauf. Gesperrt sind neue Verträge und Gehaltserhöhungen; Verlängerungen gehen nur zum gleichen oder niedrigeren Gehalt. Der Vorstand nennt den Betrag („Gehälter um 9,5 C abbauen"). |
| In der Saison | Das Gehaltsbudget steht für die ganze Saison. Ein nicht verbrauchter Transfertopf bleibt für Gebäude und Notkäufe nutzbar; ein Notverkauf fließt zur Quote ein. Die Kaufsperre über dem Überziehungsrahmen (Hauptdokument 2.4) bleibt. |
| Begründung | Der Vorstand zeigt die Herleitung als Rechnung (Mockup Finanzseite, Reiter „Budgets") und einen Satz zum Vertrauen („Endrang 11, erwartet 6"). |

---

## 2. Rechenbeispiele (Lauf C, gerechnet)

Klassen wie in der Analyse: je Liga nach Startbudget, oberste 5 reich, nächste 6 mittel, unterste 5 arm.

### 2.1 Saison 1 (Draft): Töpfe aus dem Startbudget, Quote 100 %

| Team | Liga / Klasse | Finanzwert | Budget | Rücklage + Puffer | **Transfertopf** | Draft gemessen | Luft | tragbar = **Gehaltstopf** | Gehalt gemessen | Luft |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| G-G | 1 reich | 6,7 | 310 | 54,8 | **255,2** | 299,9 | −44,7 | **81,6** | 77,3 | +4,3 |
| H-R | 1 mittel | 2,1 | 285 | 21,2 | **263,8** | 278,0 | −14,2 | **53,8** | 85,0 | −31,2 |
| T-T | 1 arm | 8,9 | 260 | 58,6 | **201,4** | 253,2 | −51,8 | **46,6** | 61,9 | −15,3 |
| M-S | 2 reich | 6,8 | 245 | 43,8 | **201,2** | 238,7 | −37,5 | **63,6** | 65,3 | −1,7 |
| R-C | 2 mittel | 6,8 | 220 | 39,4 | **180,6** | 214,0 | −33,4 | **52,3** | 62,5 | −10,2 |
| A-A | 2 arm | 1,2 | 175 | 9,5 + 5,4 | **160,1** | 166,7 | −6,6 | **42,6** | 49,6 | −7,0 |

Lesart am Beispiel H-R: Der Transfertopf wäre fast groß genug (Finanzwert 2,1, kleine Rücklage), aber der Sponsor trägt nur
53,8 C Gehalt, gekauft hat das Team für 85,0 C. Das ist die Liga-1-Lücke der Analyse (Sponsor/Gehalt 0,70 bei „arm"), jetzt als
harte Grenze. Je Klasse (Median, Lauf C):

| | Transfertopf / Draft gemessen | Gehaltstopf / Gehalt gemessen | Gehaltstopf überzogen |
|---|---|---|---:|
| Liga 1 reich | 265,7 / 304,0 | 76,1 / 84,8 | 2 von 4 |
| Liga 1 mittel | 246,1 / 281,1 | 59,8 / 80,3 | 6 von 6 |
| Liga 1 arm | 226,9 / 253,2 | 46,5 / 64,0 | 5 von 5 |
| Liga 2 reich | 210,3 / 227,9 | 59,5 / 61,2 | 4 von 5 |
| Liga 2 mittel | 169,7 / 199,3 | 44,9 / 56,3 | 6 von 6 |
| Liga 2 arm | 162,6 / 173,1 | 43,1 / 47,0 | 5 von 5 |

Alle Läufe: Transfertopf überzogen 31 von 31 (Median 23,8 / 25,1 / 24,7 C, Σ 871 bis 889 C), Gehaltstopf überzogen 27 / 28 / 28
(Median 11,5 bis 12,9 C, Σ 353 bis 382 C). M-M zählt nicht mit (Messartefakt ohne Sponsor). Größte Gehalts-Überzieher: N-N −32,2,
H-R −31,2, Z-H −28,1, V-D −27,4, B-P −23,1.

**Mit dem Startvertrauen statt 100 %** (zum Vergleich): T-T (Vertrauen 2,4) dürfte von 260 C nur 100,7 C ausgeben und 23,3 C
Gehalt zahlen, A-A (1,7) 82,7 C und 21,3 C, R-C (3,5) 126,5 C und 36,6 C. Deshalb Frage 1.

### 2.2 Transferfenster Saison 2: echte Kassen nach dem Vertragsablauf

Vertrauen nach Saison 1 gerechnet mit der Formel des Hauptdokuments (5.7) auf den gemessenen Rängen. Stufen in Lauf C: 13 Teams
100 %, 10 Teams 85 %, 3 Teams 70 %, 6 Teams 50 % (Lauf B: 13 / 9 / 2 / 8).

| Team | Vertrauen → Quote | Kasse | Rücklage + Puffer | gesperrt | Verkäufe | **Transfertopf** | Käufe + Bau gemessen | **Gehaltstopf** (tragbar) | Gehalt vor → nach dem Fenster |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| G-G (1 reich) | 7,3 → 8,6 · 100 % | 71,7 | 67,8 | 0 | 21,0 | **24,9** | 57,6 | **70,5** (70,5) | 75,7 → 83,3 |
| H-R (1 mittel) | 5,5 → 5,0 · 85 % | 81,8 | 18,6 + 3,5 | 9,0 | 0 | **50,8** | 46,8 | **63,0** (74,1) | 49,2 → 57,5 |
| T-T (1 arm) | 2,4 → 4,4 · 85 % | 64,9 | 57,7 | 1,1 | 2,7 | **8,4** | 42,3 | **49,1** (57,7) | 40,4 → 47,5 |
| M-S (2 reich) | 8,5 → 9,0 · 100 % | 47,2 | 52,7 | 0 | 75,1 | **75,1** | 23,0 | **61,3** (61,3) | 36,4 → 36,4 |
| R-C (2 mittel) | 3,5 → 2,5 · 70 % | 38,4 | 45,5 | 0 | 18,2 | **12,7** | 30,9 | **32,3** (46,2) | 47,9 → 56,0 |
| A-A (2 arm) | 1,7 → 1,0 · 50 % | 98,7 | 10,1 | 44,3 | 0 | **44,3** | 56,8 | **20,6** (41,2) | 19,9 → 30,1 |

* **G-G** (reich, volle Quote): Die Rücklage (17,7 % von Kasse 71,7 + Kader 312,1) frisst fast die ganze Kasse. Frei werden nur
  3,9 C plus die Verkäufe. Gekauft hat das Team für 57,6 C; mit Töpfen ginge das nur über mehr Verkäufe oder „Rücklage
  anzapfen" (Abschnitt 6). Der Gehaltstopf ist schon vor dem Fenster um 5,2 C überzogen: kein neuer Vertrag ohne Abgang.
* **H-R** (mittel, 85 %): passt in beide Töpfe (Luft 4,0 und 5,5 C). 9,0 C bleiben gesperrt.
* **A-A** (arm, 50 %, Sparauflage): 44,3 C liegen gesperrt auf dem Konto. Der Gehaltstopf (20,6 C) ist mit 8 Spielern (19,9 C)
  praktisch voll: das Team bleibt beim Pflichtkader, bis das Vertrauen steigt oder es Gehalt abbaut.
* **R-C** (mittel, 70 %): Kasse unter dem Rücklage-Ziel, laufende Gehälter 15,6 C über dem Topf. Es darf nur verkaufen.

Alle 31 Teams (ohne M-M):

| | Lauf B | Lauf C |
|---|---:|---:|
| Σ Kasse zu Fensterbeginn / Σ Rücklage + Puffer / Σ wegen Quote gesperrt | 1740 / 1175 / 136 | 2034 / 1180 / 235 |
| Σ Transfertopf (inklusive Verkäufe) / Σ Käufe + Bau gemessen | 1312 / 654 | 1364 / 1212 |
| Transfertopf überzogen (gegen die gemessenen Käufe) | 6 Teams, Median 32,8 C | 15 Teams, Median 18,2 C |
| Σ Gehaltstopf / Σ Gehalt nach dem Fenster (Kader 7,8 bzw. 9,0) | 1409 / 1303 | 1455 / 1485 |
| Gehaltstopf überzogen | 14 Teams, Median 11,8 C | 15 Teams, Median 12,8 C |
| in beiden Töpfen Luft | 13 Teams | 12 Teams |
| Bedarf für volles Auffüllen auf die Kadergröße der Saison 1 (20,8 C je Spieler) | 3129 | 2917 |
| … Transfertopf / Gehaltstopf dann überzogen | 30 / 24 Teams | 30 / 29 Teams |

**Die gemessenen Kassen sind das Einführungsjahr.** In der Messung hat kein Team in Saison 1 eine Rücklage gehalten (Kasse nach
dem Draft 5 bis 13 C); die Rücklage muss im ersten Fenster komplett aus den Ablösen aufgebaut werden. Eingeschwungen
(Hochrechnung: Saison 1 schon mit Töpfen geplant, Kader entsprechend billiger, Liga-Topf 475 C verteilt):

| eingeschwungen | Lauf B | Lauf C |
|---|---:|---:|
| Σ Kasse zu Fensterbeginn / Σ Rücklage + Puffer / Σ gesperrt | 3263 / 1257 / 345 | 3477 / 1253 / 412 |
| Σ Transfertopf / Bedarf volles Auffüllen | 2293 / 2501 | 2351 / 2299 |
| Transfertopf reicht nicht fürs volle Auffüllen | 18 Teams, Median 27,8 C | 18 Teams, Median 12,9 C |
| Σ tragbar / Σ Gehaltstopf / Σ Gehalt bei vollem Kader | 1692 / 1438 / 1660 | 1707 / 1485 / 1631 |
| Gehaltstopf reicht nicht für den vollen Kader | 21 Teams, Median 17,4 C | 19 Teams, Median 8,4 C |

In der Summe passt es; je Team nicht, und das ist die Wirkung der Quote: Bei 100 % für alle läge die Gehaltssumme des vollen
Kaders (1631 bis 1660 C) unter dem tragbaren Gehalt (1692 bis 1707 C). Die Quoten nehmen 220 bis 255 C heraus.

---

## 3. Umschicht-Regel

| | Regel (Startwerte) |
|---|---|
| Kurs | **1 C Transfer ↔ 1 C Jahresgehalt**, also 10 C Transfer ↔ 0,5 C Gehalt je Spieltag. Kassentreu für die laufende Saison. |
| Grenze | Der **Gehaltstopf** darf durch Umschichten höchstens um einen Anteil seines Startwerts wachsen oder schrumpfen: 25 % (Quote 100 %), 20 % (85 %), 15 % (70 %), 10 % (50 %). |
| Gehalt → Transfer zusätzlich | höchstens die Hälfte von Rücklage + Gehaltspuffer. Das Geld wird aus der Sicherheit vorgezogen und kommt über die Saison als nicht gezahltes Gehalt zurück. |
| Zurücknehmen | jederzeit, soweit der Betrag im Zieltopf noch frei ist |
| Zeitraum | gilt für diese Saison. Im nächsten Fenster rechnet der Vorstand beide Töpfe neu; ein Vertrag, der nur durch Umschichten möglich war, zählt dann voll gegen das neue Gehaltsbudget. |
| In der Saison | nur Transfer → Gehalt (für Verlängerungen); Gehalt → Transfer nur im Fenster |

Die Grenze wird am Gehaltstopf gemessen, nicht an „einem Topf": In Saison 1 ist der Transfertopf rund viermal so groß wie der
Gehaltstopf (G-G 255 gegen 82 C). 25 % des Transfertopfs würden den Gehaltstopf fast verdoppeln.

Beispiel H-R, Saison 1 (aggressiv, je C Ablöse 0,306 C Gehalt): Mit dem vollen Transfertopf kämen 80,7 C Gehalt zusammen, der
Topf trägt 53,8 C. H-R schichtet das Maximum um (25 % von 53,8 = 13,5 C): Gehaltstopf 67,3 C, Transfertopf 250,3 C. Gekauft wird
für 220 C, auf dem Konto bleiben 65 C statt 21 C. Die Saison kostet dann 13,5 C mehr, als die Einnahmen tragen; das Geld dafür
liegt bereit.

---

## 4. Lockerungsregel nach Verkäufen (neu von Chris)

Bei jedem Verkauf bleibt der Anteil (1 − Quote) des Erlöses als Puffer auf dem Konto. Hat sich daraus der Puffer angesammelt,
den der Vorstand sehen will, gibt er eine Stufe mehr frei.

### 4.1 Der Puffer X

```
X = a × tragbares Gehalt        a = 30 % bei Quote 50 % · 20 % bei 70 % · 10 % bei 85 %
```

Das sind 6, 4 bzw. 2 Spieltage Gehalt zusätzlich zur Rücklage. X steht mit den Töpfen zu Fensterbeginn fest und hängt am
tragbaren Gehalt, nicht an den laufenden Gehältern: Wer Spieler verkauft, macht X dadurch nicht kleiner.

### 4.2 Wann sie greift

```
einbehaltener Verkaufsanteil  (1 − Quote) × Verkaufserlöse im Fenster  ≥  X
⇔  Verkaufserlöse  ≥  X ÷ (1 − Quote)                    = 0,6 bis 0,67 × tragbares Gehalt (rund 25 bis 50 C)
```

Dann gilt für den Rest des Fensters die nächste Stufe (50 → 70 → 85 → 100 %) auf den **ganzen** Transfertopf, mit einem festen
Boden: die Kasse darf durch Käufe und Bau nicht unter Rücklage-Ziel + Gehaltspuffer + X fallen.

**Sichtbar von Anfang an.** Der Vorstand nennt X und die Schwelle mit den Töpfen. Der Geld-Block im Transfermarkt zeigt einen
Fortschrittsbalken und den Satz „Verkaufe noch 8,0 C, dann gibt der Vorstand 85 % frei (+11,4 C)". Nach dem Auslösen: „Vorstand
lockert auf 85 %. Die Kasse muss über 61 C bleiben."

### 4.3 Obergrenzen (kein Schlupfloch)

| # | Grenze | Verhindert |
|---:|---|---|
| 1 | **Eine Stufe je Fenster**, nie über 100 %. Aus der Sparauflage (50 %) also höchstens 70 %. | Durchverkaufen von 50 auf 100 % |
| 2 | **Die Mehrfreigabe ist höchstens so groß wie der Verkaufserlös des Fensters.** | Kleiner Verkauf, großer Hebel auf eine volle Kasse |
| 3 | **Boden** Rücklage-Ziel + Gehaltspuffer + X, hart für Ablösen und Bau | Dass der Puffer gleich wieder ausgegeben wird |
| 4 | Es zählen nur Verkäufe **in diesem Fenster**; ein verkaufter Spieler kann im selben Fenster nicht zurückgekauft werden; der Kader bleibt über dem Minimum | Verkaufen und Zurückkaufen |
| 5 | Gilt **nur für den Transfertopf** und endet mit dem Fenster. Das Gehaltsbudget steigt nicht; frei werdendes Gehalt der Verkauften geht ohnehin in den Topf zurück. | Dauerhafte Gehälter aus einmaligem Geld |
| 6 | Keine Lockerung mit laufendem Pflichtkredit oder bei Kasse im Minus | Ausgeben statt Entschulden |

Der Abschlag jedes Verkaufs (Marktwert − Verkaufspreis, in den Liga-Topf) bleibt als natürliche Bremse.

### 4.4 Beispiele (gerechnet)

* **A-A, Fenster Saison 2, 50 %:** tragbar 41,2 → X = 12,4 C, Schwelle 24,7 C Verkaufserlös. Ohne Verkauf frei 44,3 C, gesperrt
  44,3 C. Verkauft A-A für 24,7 C: ohne Lockerung 56,7 C frei, mit Lockerung auf 70 % **79,3 C** (+22,6 C; Grenze 2 erlaubte
  +24,7 C). Die Kasse muss über 22,5 C bleiben.
* **R-L, Lauf B, 70 % → 85 %:** Kasse 39,6, Rücklage 17,2, Verkäufe 56,0 C (Schwelle 31,2 C). Transfertopf 54,9 → **66,6 C**.
* **C-C, Lauf C, 85 %:** Verkäufe 33,1 C, Schwelle 35,3 C. Anzeige: „Verkaufe noch 2,1 C, dann gibt der Vorstand 100 % frei."
* Über alle Teams: In Lauf B erreichen 8 von 19 Teams unter 100 % die Schwelle mit den Verkäufen, die die KI ohnehin gemacht
  hat (Σ +46 C), in Lauf C keines von 19 (vier liegen 2 bis 13 C darunter). Die Regel ist ein Anreiz, kein Geschenk.

---

## 5. KI-Regeln

Die KI plant **von Anfang an** mit beiden Töpfen; es gibt keine nachträgliche Kappung und keinen separaten Gehaltsdeckel.
`OLY_SALARY_CEILING_V2` bleibt aus.

| # | Regel | Ersetzt / Fundstelle |
|---:|---|---|
| 1 | Der Planer bekommt beide Töpfe als Eingang: ausgebbar = freier Transfertopf (statt Kasse − 5), Zielgehalt (`projectSalaryAtPlannerTarget`) ≤ freier Gehaltstopf. | Schrauben A bis D der Analyse; `draft-adapter.ts:436`, `:541`, `:591` |
| 2 | Er plant gegen den **Zielkader**: in beiden Töpfen bleibt der Mindestbedarf für die noch fehlenden Pflichtplätze reserviert. | `reserveForMin`, `draft-builder.ts:225` |
| 3 | **Umschichten nach Charakter**, in Richtung des Topfs, der zuerst bindet: vorsichtig 0 %, normal 50 %, aggressiv 100 % der Grenze. | k = 1,0 / 1,1 / 1,25 |
| 4 | **Lockerung:** Fehlt bis zur Schwelle höchstens der Erlös des nächsten Verkaufskandidaten und bleibt der Kader bei Soll − 1 oder darüber, verkaufen normale und aggressive Teams diesen einen Spieler zusätzlich. Vorsichtige verkaufen nur, was ohnehin auf der Liste steht. | neu |
| 5 | **Gebäude** nur aus dem Transfertopf, höchstens 30 % des freien Betrags, erst wenn der Kader auf Soll ist. | Hauptdokument 5.6 |
| 6 | **Über dem Gehaltsbudget:** keine teurere Verlängerung. Liegen die laufenden Gehälter mehr als 10 % über dem Topf, geht der Spieler mit dem höchsten Gehalt je Leistung außerhalb der Stammformation an den Markt. | neu |
| 7 | **Rücklage anzapfen** (Abschnitt 6): nur aggressive Teams, nur wenn der Kader unter Soll ist. | neu |
| 8 | Sponsorwahl wie im Hauptdokument (5.4). Sie wirkt jetzt direkt: der Anker des gewählten Vertrags bestimmt den Gehaltstopf. | unverändert |

Gerechnet für Saison 1 (Lauf C, Quote 100 %, neu geeicht):

| Charakter | Teams | Gehalt Median (heute → Hauptdokument → Töpfe) | Kasse nach dem Draft | umgeschichtet (Median) | es bindet Gehalt / Transfer |
|---|---:|---|---:|---:|---|
| vorsichtig | 8 | 59,7 → 46,8 → **45,1** | 49,8 | 0 | 3 / 5 |
| normal | 15 | 62,9 → 52,6 → **51,1** | 41,5 | 4,9 | 8 / 7 |
| aggressiv | 9 | 78,7 → 71,1 → **64,5** | 39,2 | 9,5 | 3 / 6 |

Aggressive Teams kommen schlechter weg als mit k = 1,25, weil der Kassenterm des alten Deckels („freie Kasse ÷ 3") entfällt:
Mehr Gehalt gibt es nur noch gegen Transfergeld.

---

## 6. Zusammenspiel mit Rücklage und Pflichtkredit

**Rücklage (weich).** Das Rücklage-Ziel geht in die Rechnung des Transfertopfs ein, der Topf selbst ist hart. Weich bleibt die
Rücklage an drei Stellen:

1. **In der Saison** darf die Kasse darunter fallen. Das ist der Normalfall (die Kasse sinkt bis Spieltag 20 und kommt mit dem
   Rangbonus zurück). Es gibt nur die Warnung.
2. **Rücklage anzapfen (Vorschlag, Frage 3):** Mensch und KI können im Fenster bis zu 50 % des Rücklage-Ziels zusätzlich in den
   Transfertopf holen, zur Quote. Preis: Vertrauen −0,25 je angefangenem Viertel des Ziels, wirksam bei der nächsten
   Festlegung. Ohne diese Tür wäre die Rücklage im Fenster faktisch hart.
3. **Umschichten Gehalt → Transfer** greift bis zur Hälfte auf Rücklage + Puffer vor (Abschnitt 3).

Das Finanzziel des Vorstands („Rücklage halten", Hauptdokument 5.7) bleibt: Wer am Kassensturz unter dem Ziel steht, verliert
Vertrauen, aber keine Buchung wird verhindert.

**Pflichtkredit.**

| Lage | Wirkung auf die Töpfe |
|---|---|
| Normalfall | Der Transfertopf ist höchstens Kasse − Rücklage − Puffer. Durch Käufe kann die Kasse im Fenster nicht mehr unter 0 fallen. Ein Pflichtkredit entsteht nur noch aus dem Betrieb (Saison im Minus beendet) oder aus der Pflicht-Auffüllung. |
| Kasse im Minus zu Fensterbeginn | Transfertopf 0. Verkaufserlöse füllen zuerst das Minus. Am Kassensturz kommt der Pflichtkredit wie im Hauptdokument (Fehlbetrag + 10 % des Jahresgehalts). |
| Pflichtkredit läuft | Seine Rate ist Fixkosten und **senkt das Gehaltsbudget** der Saison. Das Kreditgeld selbst fließt nicht in den Transfertopf. Keine Lockerung. |
| Freiwilliger Kredit | Erhöht die Kasse und damit den Transfertopf (zur Quote); die Rate senkt im selben Moment das Gehaltsbudget. Nur ab Quote 85 %, sonst wie im Hauptdokument (5.6). |
| Schuldendienst über 20 % | Zwangsverkauf durch den Vorstand wie im Hauptdokument; die Erlöse tilgen und zählen nicht für die Lockerung. |

---

## 7. Vorstand: Quote statt k

Die Folgen-Tabelle in 5.7 des Hauptdokuments wird ersetzt. Die Vertrauens-Formel selbst bleibt.

| Vertrauen | Quote | Umschicht-Grenze | Lockerungs-Puffer X | sonst |
|---|---:|---:|---:|---|
| ab 6 | 100 % | 25 % | — | voller Anteil am Liga-Topf |
| 4 bis unter 6 | 85 % | 20 % | 10 % des tragbaren Gehalts | — |
| 2,5 bis unter 4 | 70 % | 15 % | 20 % | — |
| unter 2,5 (Sparauflage) | 50 % | 10 % | 30 % | keine Gebäude, kein freiwilliger Kredit |

Es bleibt dabei: keine Geldstrafen. Die Zeile „Geldstrafe je verfehltem Ziel 3 % des Gehalts" im Hauptdokument (5.7) widerspricht
der Vorgabe vom 18.11. und entfällt mit dieser Ergänzung; Vorstandsziele zahlen nur noch Prämien.

Der Weg zurück: Der Erwartungsrang ist der Rang der eigenen Gehaltssumme. Ein Team in der Sparauflage hat wenig Gehalt, wird
also niedrig erwartet und gewinnt Vertrauen, sobald es besser abschneidet (+0,25 je Platz, dazu +0,25 für eine Kasse über 0).
Überschlagen braucht ein Team von 1,0 auf 2,5 zwei bis drei Saisons. Ob das zu lang ist, zeigt erst der Mehrsaison-Lauf (Frage 2).

---

## 8. Wirkung auf die Geldmengen-Bilanz

**Saison 1, alle Teams 100 %, KI plant mit beiden Töpfen** (Mittel der Läufe A/B/C, gerechnet):

| | heute | Hauptdokument (Deckel k) | Töpfe, Ausschüttung 0,73 | Töpfe, neu geeicht |
|---|---:|---:|---:|---:|
| Sponsor-Ausschüttung | 1,10 | 0,73 | 0,73 | **0,695** |
| Σ Gehälter | 2134 | 1838 | 1793 | **1763** |
| Σ Kasse nach dem Draft | 228 bis 244 | 1308 | 1459 | **1566** |
| Σ GuV bei Faktor 0,82 / 1,0 / 1,24 | — / +48 / — | −112 / 0 / +149 | — / +44 / — | **−106 / 0 / +141** |
| Teams im Minus nach Spieltag 20 | — | 8 | 8 | 8 |

Die Töpfe sind etwas enger als der alte Deckel: die Gehälter sinken um weitere 4 % (insgesamt −17 % gegen heute), die Kassen
steigen um 258 C. Die Ausschüttung muss deshalb um weitere 5 % herunter, sonst wächst die Geldmenge um 44 C je Saison.

**Ab Saison 2 wirkt die Quote auf das Gehaltsbudget.** Im gerechneten Stufenmix (13 bis 15 Teams bei 100 %) liegt Σ Gehaltstopf
220 bis 285 C unter Σ tragbar. Soweit die betroffenen Teams ihren Topf ausschöpfen, ist das Überschuss in der GuV: das Geld
bleibt bei ihnen auf dem Konto. Drei Dinge dazu:

1. Die Sponsor-Ausschüttung kann das **nicht** ausgleichen. Der Überschuss entsteht je Team als (1 − Quote) × tragbar, bei jeder
   Höhe des Sponsors.
2. Das Gegengewicht ist das Umschichten: Teams mit voller Quote, die Transfergeld in Gehalt schieben, machen einen
   GuV-Verlust in gleicher Größenordnung (bis 25 % ihres Topfs). Dazu kommt, dass ein Team nach der Sparauflage sein
   angespartes Geld wieder ausgibt. Die Wirkung ist also verschoben, nicht dauerhaft.
3. Ob die Summe über drei Saisons in ±1,5 % bleibt, ist die Abnahme der Stufe 6 (Liga-Topf) und muss dort **mit aktiven
   Quoten** gemessen werden. Stellschrauben, falls nicht: die Stufengrenzen des Vertrauens oder die Umschicht-Grenze.

**Kapitalkreislauf:** unverändert. Gesperrtes Geld verlässt die Liga nicht, es liegt in der Kasse und zählt zum Liga-Vermögen.
Σ gesperrt zu Fensterbeginn gerechnet 136 bis 235 C (gemessene Kassen) bzw. 345 bis 412 C (eingeschwungen), das sind 8 bis 12 %
der Kassen.

**Einführung in einen laufenden Spielstand:** Die gemessenen Kassen zeigen den Fall. Ohne Übergang reicht der Transfertopf für
ein volles Auffüllen bei einem von 31 Teams. Vorschlag (Frage 4): im ersten Fenster nach der Einführung zählt das Rücklage-Ziel
zur Hälfte. Das gibt grob 590 C frei.

---

## 9. Einordnung in die Bau-Reihenfolge

Stufen 0 und 1 des Hauptdokuments bleiben. Stufe 2 (Rücklage) und Stufe 3 (Gehaltsdeckel) werden durch vier kleine PRs ersetzt;
Stufe 9 (Vorstand) übernimmt die Tabelle aus Abschnitt 7.

| # | PR | Inhalt | Messschritt / Abnahme |
|---:|---|---|---|
| 2a | Budget-Dienst, Schattenmodus | Eine reine Funktion rechnet beide Töpfe je Team (Formeln Abschnitt 1) und schreibt sie ins Protokoll. **Keine Sperre, kein Verhalten geändert.** Quote in Saison 1 = 100 %. | A/B-Lauf: Zahlen gleich diesem Rechenskript ±1 C; Überzieher-Liste wie Abschnitt 2 |
| 2b | KI plant mit beiden Töpfen | KI-Regeln 1 bis 3, 5, 6. Rücklage nach Finanzwert steckt im Transfertopf. | Rücklage je Finanzklasse im Korridor (Hauptdokument 5.2); kein Team unter 8 Spielern; Sponsor/Gehalt Liga 1 „arm" von 0,70 auf ≥ 0,90; Kadergröße nicht mehr als 2 Teams unter Soll gegenüber Stufe 1 |
| 2c | Harte Sperre | Prüfung an jeder Kauf-, Vertrags- und Baustelle für Mensch und KI, Ausnahme Pflicht-Auffüllung, Regel „über Budget". Anzeige der Töpfe im alten Transfermarkt als Zahl. | Kein Kauf über einem Topf im Protokoll (außer Pflicht-Auffüllung); Fingerabdruck unverändert |
| 2d | Umschichten und Lockerung | Regler, Lockerungsregel mit Ankündigung, KI-Regeln 4 und 7, „Rücklage anzapfen". | KI schichtet in ≥ 30 % der Teams um; Lockerung löst in ≥ 3 Teams je Saison aus; keine Mehrfreigabe über dem Verkaufserlös |
| 9 | Vorstand und Apron | Vertrauens-Fortschreibung, **ab hier Quoten unter 100 %** nach Abschnitt 7. | Stufenverteilung nach 3 Saisons: höchstens 6 Teams in der Sparauflage, kein Team länger als 3 Saisons darin |
| 10 | Finanzseite, Transfermarkt | Bau nach den Mockups (Reiter „Budgets", Geld-Block). | Bildpaar Mockup / App |

2a bis 2c können vor der Taktung (Stufe 4) live gehen und wirken bis Stufe 9 mit 100 % für alle: das ist dann genau die
Rücklagen- und Sponsor-Regel, nur als sichtbare Töpfe. Stufe 5 (Eichung der Ausschüttung) rechnet mit dem Zielwert 0,695 statt
0,73 als Startpunkt.

---

## 10. Offene Fragen an Chris

| # | Frage | Empfehlung |
|---:|---|---|
| 1 | Gilt die Vertrauens-Quote schon in **Saison 1**? Das Startvertrauen ist ein Wert der Team-Identität, kein Urteil. | **Nein, Saison 1 alle 100 %.** Mit Startvertrauen: Gehälter 1513 statt 1793 C, sechs Teams draften mit halbem Budget. |
| 2 | **50 % auch auf das Gehaltsbudget?** Beispiel A-A: Topf 20,6 C bei 19,9 C laufend, also zwei bis drei Saisons Pflichtkader. | **So bauen wie freigegeben** und in Stufe 9 messen. Stellschraube, falls die Spirale zu hart ist: Gehalts-Quote eine Stufe milder als die Transfer-Quote. |
| 3 | **„Rücklage anzapfen"** als Tür (bis 50 % des Ziels, kostet Vertrauen)? | **Ja.** Sonst ist die Rücklage im Fenster hart, und reiche Teams wie G-G haben nach dem Vertragsablauf fast nichts frei. |
| 4 | **Übergang** für laufende Spielstände: Rücklage-Ziel im ersten Fenster nur zur Hälfte? | **Ja.** |
| 5 | Umschicht-Grenze am **Gehaltstopf** messen (±25 %) statt an „einem Topf"? | **Ja**, sonst verdoppelt Saison 1 den Gehaltstopf. Kurs 1 : 1 wie in deinem Beispiel. |
| 6 | Lockerung: Puffer **10 / 20 / 30 % des tragbaren Gehalts**, eine Stufe je Fenster, nur Transfertopf? | **Ja.** Schwelle liegt bei rund 25 bis 50 C Verkaufserlös, also ein bis zwei gute Spieler. |
| 7 | Gebäude aus dem **Transfer**topf (wie freigegeben) oder ein dritter Topf? | **Ein Topf**, wie freigegeben. Der Mensch entscheidet selbst zwischen Spieler und Gebäude. |
| 8 | Die Zeile „Geldstrafe 3 % des Gehalts" im Hauptdokument (5.7) streichen? | **Ja**, sie widerspricht „der Vorstand verhängt keine Geldstrafen". |

---

## 11. Annahmen, Grenzen, Bilder

* **Hochrechnung, keine Messung.** Wie im Hauptdokument: Gehalt proportional zur Ausgabe, Endrang bleibt der gemessene.
* **Fenster Saison 2:** Der Sponsor der neuen Saison steht nicht in den Messdaten; gerechnet ist Sockel und Rangbonus am
  Endrang der Saison 1. Das Vertrauen nach Saison 1 ist die Formel 5.7 auf den gemessenen Rängen (im Spiel gibt es diese
  Fortschreibung noch nicht). Gebäudekosten aus dem Katalog (Stufe 1). „Volles Auffüllen" rechnet 20,8 C je fehlendem Spieler,
  den Draft-Durchschnitt; Ergänzungsspieler sind billiger, der Bedarf ist also eine Obergrenze.
* **Eingeschwungen** ist eine zweite Hochrechnung auf der ersten (Kasse nach der Abrechnung aus der Töpfe-Rechnung, Ablösen und
  Marktwerte im Verhältnis der billigeren Kader, Liga-Topf 475 C halb gleich, halb nach Vertrauen).
* M-M ist in der Messung ohne Sponsor (Messartefakt) und aus allen Zählungen herausgenommen.
* Kredite der Saison-2-Kaufphase (Σ 211 bis 249 C gemessen) sind in den Töpfen nicht berücksichtigt.

**Rechenskript:** `node scripts/rechne-vorstands-budgets-18-11.mjs` (alle 32 Teams, drei Teile; `--kurz` nur Summen und
Beispiele).

**Bilder** unter `docs/design/finanzkonzept-v2-budgets-18-11/`, Endung `-2560` (2560×1440), `-1920` (1920×1080), `-1710`
(1710×1112):

| Datei | Zeigt |
|---|---|
| `seite-budgets-85` (alle drei Größen) | Finanzseite, Reiter „Budgets": zwei Töpfe mit Herleitung, Umschicht-Regler, Lockerung, Vorstand (Quote 85 %) |
| `seite-budgets-100-umgeschichtet-1920` | volle Freigabe, 8 C vom Gehalt in den Transfer geschoben |
| `seite-budgets-50-sparauflage-1920` | Sparauflage: Gehälter über dem Budget, Transfertopf zur Hälfte gesperrt |
| `seite-budgets-gelockert-1920` | 70 %, nach 60 C Verkäufen auf 85 % gelockert, 6 C ins Gehalt geschoben |
| `daten-budgets-H-R` (alle drei Größen) | Datenfluss in vier Schritten: Vertrauen → Quote, Kasse → Transfertopf, Einnahmen → Gehaltstopf, Umschichten; rechts gegen die Messung |
| `daten-budgets-G-G-1920` | reiches Team: Gehalt mit Luft, Transfer bindet |
| `daten-budgets-A-A-50-1920`, `daten-budgets-A-A-gelockert-1920` | armes Team mit Startvertrauen 1,7 (50 %), ohne und mit erreichter Lockerungsschwelle |
| `markt-geld-70` (alle drei Größen) | Transfermarkt: Geld-Block mit zwei Balken und Lockerungshinweis |
| `markt-geld-50-1920`, `markt-geld-gelockert-1920` | Sparauflage; nach 80 C Verkäufen gelockert |
| `markt-kauf-gehalt-gesperrt-1920` | Kauf-Dialog: Ablöse passt, Gehaltsbudget nicht, Kauf gesperrt |
| `markt-verkauf-quote-1920` | Verkauf: Erlös fließt zur Quote ein, Rest bleibt als Puffer |

Im Mockup der Finanzseite und des Transfermarkts sind die Zahlen des Teams erfunden (wie in den Mockups bisher), die Regeln
sind die dieses Dokuments. Der Datenfluss rechnet mit den echten Team-Werten aus Lauf C.
