# Sponsoren neu: ein Liga-Topf, ein Saisonfaktor (22.11.)

Konzept und Mockup, kein App-Code, keine PixelLab-Bestellung. Mockup: `public/mockups/sponsoren-modern-22-11.html`,
Bilder: `docs/design/sponsoren-rework-22-11/`, Modellrechnung: `scripts/modell-sponsoren-rework.py`.

Chris, 22.11., wörtlich: „kannst du die Sponsoren bzw. deren Finanzberechnung vllt noch mal reworken bzw. einen Mockup-Vorschlag
machen, wie du dir das System vorstellen würdest, wenn ich dir freie Hand geben würde? ohne dass das Balancing komplett leidet,
so dass manche Teams im + sind und manche im −, und wir sowas wie den Season-Faktor haben, dass wenn alle Teams ihren aktuellen
Rang erreichen, wir bei 1 ungefähr keine Änderung in der GuV der Liga im Schnitt haben. vllt hast du ja noch ne Möglichkeit das
alles zu verbessern?“

## Kurzfassung

- **Heute ist der Sponsor-Topf eine feste Zahl** (rund 2.295 C bei Faktor 1). Die Kosten der Liga sind es nicht: In Saison 1
  liegen die Gehälter bei 2.010 bis 2.230 C, ab Saison 2 bei 1.650 bis 1.990 C. Darum steht die Liga in Saison 1 bei +4 bis +6 C je
  Team und ab Saison 2 bei +14 bis +21 C. Der Faktor 1 hat heute keine Bedeutung.
- **Vorschlag: Der Topf wird aus den Kosten der Liga gerechnet.** `Topf = Saisonfaktor × (Kosten der Liga − übrige
  Einnahmen)`. Bei Faktor 1,00 ist die Liga im Gleichgewicht, jedes Hundertstel bewegt sie um rund 0,6 C je Team. Kommen
  später Karten, Marketing und Medaillen dazu, schrumpft der Topf um genau diesen Betrag. Nichts wird doppelt gezählt.
- **Verteilt wird nach Erwartungsrang statt nach Startrang und Los.** Ein Grundbetrag nach Erwartungsrang und Beliebtheit,
  dazu ein Leistungsteil: fester Betrag je Platz über oder unter Erwartung, Summe je Liga immer 0. Wer genau seine Erwartung
  trifft, landet dort, wo seine Gehaltspolitik ihn hinstellt: teurer Kader im Minus, sparsamer im Plus.
- **Drei Vertragsarten statt elf Kurvenformen:** Festvertrag, Leistungsvertrag, Prämienvertrag. Dazu zwei Farb-Partner
  (zwei aus POW, SPE, MEN, SOC), die den geplanten Farb-Meister tragen.
- **Gemessen** (drei Läufe, 32 KI-Teams, acht Saisons): Liga-Mittel bei „alle auf Erwartungsrang“ neu +0,3 bis +3,9 C
  je Team statt +5,8 bis +25,4 C. Im Plus sind dann 16 bis 25 von 32 Teams statt 22 bis 32. Der Abstand zwischen reichstem und
  ärmstem Budget-Viertel dreht im Mittel von +4 C auf −10 C: der Aufholmechanismus ist eingebaut.
- **Eine Entscheidung braucht Chris** (Frage 1): Ab Saison 2 gibt die Liga je Team rund 20 C netto am Transfermarkt aus.
  Der heutige Überschuss von +20 C bezahlt genau das. Soll „Gleichgewicht“ die reine Betriebsrechnung meinen (dann laufen die
  Kassen leer), oder die Betriebsrechnung plus Kader-Ersatz (Empfehlung)?

---

## 1. Bestandsaufnahme: das heutige System

### 1.1 Wie es rechnet

Quellen: `lib/sponsor/` (38 Dateien, 11.500 Zeilen), über 70 Testdateien mit „sponsor“ im Namen.

| Baustein | Was er tut | Fundstelle |
|---|---|---|
| Drei Angebote je Team und Saison | Marke, Seltenheit (gewöhnlich bis legendär), Kurvenform, Laufzeit 1 bis 3, Karte „Basis“ oder „Achse“, optional Gebäude-Leihe | `sponsor-offer-service.ts` (`SPONSOR_ANGEBOTE_JE_TEAM = 3`), `sponsor-tier-pool.ts` |
| Sockel | fest nach **Startrang**, umgekehrt gestaffelt: Startrang 1 bekommt 19,8 C, Startrang 16 bekommt 52,8 C | `sponsor-liga-leiter.ts` (`SPONSOR_SOCKEL_MIN/MAX`) |
| Wertungstopf | 1.133 C × Saisonfaktor für die ganze Liga, 60 % für Liga 1, 40 % für Liga 2, verteilt nach **Endrang** mit Krümmung 1,35 | `SPONSOR_WERTUNGSTOPF`, `SPONSOR_TOPF_FAKTOR_JE_LIGA` |
| Kurvenform | elf Formen (Titeljäger, Konferenz, Klassenerhalt …) verschieben, wo auf der Leiter das Geld liegt. Der Erwartungswert bei Unterschrift ist für alle gleich | `sponsor-curve-shapes.ts`, `sponsorKurvenLeiter` |
| Seltenheit | Wertfaktor 0,89 / 1,00 / 1,05 / 1,11 auf die ganze Leiter | `SPONSOR_V3_WERT_BY_RARITY` |
| Achse | Ziel gegen die eigene Ausgangslage (Wachstum, Ausbau, Solidität, Entwicklung, Kaderpflege), Einsatz 12 bis 24 C, fest mit 0,5 bepreist, im Mittel 0 | `sponsor-v4-axes.ts`, `SPONSOR_V4_AXIS_SIZE_BY_RARITY` |
| Laufzeit | wird im Angebot gewürfelt. Jahr 2 zahlt 94 %, Jahr 3 87 % des Wertungsanteils | `sponsor-negotiation.ts` (`TERM_MULTIPLIERS`) |
| Zonen | Aufstiegsplätze Liga 2 +6 C, Abstiegsplätze Liga 1 −6 C | `SPONSOR_ZONE_*` |
| Ereignisse | je Team und Spieltag 12 % Würfel: Aktionsbonus +3 bis +6, Klausel −1,5 bis −3, Partner-Reibung −2 | `sponsor-event-service.ts` |
| Gebäude-Leihe | Sponsor stellt ein Gebäude gegen festen Cash-Verzicht, Rangmarke schaltet es ab | `sponsor-leihe.ts`, `sponsor-rangmarke.ts` |
| Zahlung | seit 22.11. je Spieltag: Sockel in 20 Raten, Rang-Abschlag 80 % gegen den aktuellen Platz, Schlussausgleich am Saisonende | `finanzen-je-spieltag.ts`, `RANG_ABSCHLAG_QUOTE` |

**Der Saisonfaktor heute** ist `seasonState.seasonEconomyFactors[0].factor`, je Saison gewürfelt zwischen 0,82 und 1,24
(Mittel 1,03), mit einem Fenster über fünf Saisons (`lib/season/season-economy-factors.ts`). Er multipliziert nur den
Wertungstopf und den Zonen-Term, nicht den Sockel. Dieselbe Zahl lesen Apron, Vertragsverlängerung und die Preisgeld-Tabelle;
das Preisgeld selbst ist abgeschaltet (`CASH_PRIZE_BENCHMARK_ONLY`), die Rangprämie steckt im Sponsor.

### 1.2 Was funktioniert

- **Eine Rechenstelle für Karte, KI, Anzeige und Buchung** (`sponsor-v3-model.ts`). Gezeigt = gebucht hält.
- **Ziele ohne Schätztabelle.** Die Achsen sind fest mit 0,5 bepreist und gegen die eigene Ausgangslage gemessen. Ein Fehler
  in der Skala macht ein Ziel leichter oder schwerer, verschiebt aber kein Geld. Das übernimmt der Vorschlag.
- **Zahlung je Spieltag mit Schlussausgleich** ist gebaut und getestet. Der Vorschlag nutzt denselben Weg.
- **Der Sockel ist vor der Kaufphase bekannt.** Planbarkeit bleibt ein Ziel.

### 1.3 Was undurchsichtig ist

- Vier Regler bestimmen, was ein Vertrag wert ist: Startrang, Seltenheit, Kurvenform, Saisonfaktor. Dazu Laufzeit-Abschlag,
  Zone, Achse, Leihe. Kein Spieler kann vorhersagen, was ein Angebot zahlt, ohne die Leiter Sprosse für Sprosse zu lesen.
- Der Sockel läuft **gegen** den Startrang (wer unten startet, bekommt mehr), der Wertungstopf **mit** dem Endrang. In der
  Summe gewinnt der Wertungstopf deutlich, siehe 1.4.
- Der Saisonfaktor hat keinen Nullpunkt. Bei 1,00 ist die Liga weder im Gleichgewicht noch sonst an einer benennbaren Stelle.

### 1.4 Wo es die Balance verzerrt (gemessen)

**(a) Der Topf folgt den Kosten nicht.** Drei Läufe mit `scripts/miss-teamfinanzen-saison.ts`, 32 KI-Teams:

| Lauf | Saison | Faktor | Sponsor Σ | Gehälter Ø je Team | operative GuV Ø je Team | Teams ≥ 0 |
|---|---:|---:|---:|---:|---:|---:|
| A | 1 | 1,00 | 2210 C | 69,7 C | +4,4 C | 21 von 32 |
| A | 2 | 1,00 | 2221 C | 62,1 C | +13,7 C | 28 von 32 |
| B | 1 | 0,98 | 2063 C | 65,6 C | +4,1 C | 19 von 32 |
| B | 2 | 1,13 | 2311 C | 56,6 C | +21,4 C | 30 von 32 |
| B | 3 | 0,90 | 2119 C | 53,0 C | +18,6 C | 29 von 32 |
| C | 1 | 0,87 | 2030 C | 62,9 C | +5,6 C | 19 von 32 |
| C | 2 | 1,03 | 2157 C | 51,9 C | +20,7 C | 28 von 32 |
| C | 3 | 0,95 | 2102 C | 51,6 C | +21,0 C | 31 von 32 |

Lauf A ist für dieses Papier gerechnet (Stand origin/main mit Budget-Staffel, Faktor fest 1,00), B und C sind zwei Läufe
desselben Skripts vom 22.11. mit gewürfeltem Faktor (5.1). Die Gehälter fallen von Saison 1 auf Saison 2 um 11 bis 17 %, der
Topf bleibt. Die Liga verdient ab Saison 2 je Team 14 bis 21 C.

**(b) Das Plus ist nicht verloren, es bezahlt den Kaderumbau.** Dieselben Läufe, Kasse der Liga je Team:

| Lauf | Saison | Kaufphase vor der Saison | operative GuV | Saisonende-Kette (Verkäufe, Abgänge) | Transfersaldo mit dem Markt | Kasse vor der nächsten Kaufphase |
|---|---:|---:|---:|---:|---:|---:|
| A | 1 | −254,5 | +4,4 | +26,6 | −227,9 | 62,8 |
| A | 2 | −30,5 | +13,8 | +8,8 | −21,7 | 53,4 |
| B | 1 | −229,0 | +4,1 | +50,3 | −178,7 | 68,5 |
| B | 2 | −52,7 | +21,4 | +16,0 | −36,7 | 49,4 |
| B | 3 | −31,1 | +18,6 | +21,0 | −10,2 | 55,6 |
| C | 1 | −211,4 | +5,6 | +32,4 | −179,1 | 62,5 |
| C | 2 | −33,2 | +20,7 | +9,1 | −24,1 | 57,7 |
| C | 3 | −30,7 | +21,0 | +11,7 | −19,0 | 57,6 |

Alle Werte in C je Team. Ab Saison 2 gibt die Liga je Team netto 10 bis 37 C am Markt aus (Mittel 22 C, etwa 10 % des
Kaderwerts). Die Kasse bleibt dabei ungefähr stehen (49 bis 58 C). **Das heutige System ist also bei Faktor um 1 schon nahe an „Geldmenge der Liga bleibt
gleich“, nur zeigt die GuV den Kaderumbau nicht.** Das ist der Hintergrund von Frage 1.

**(c) Bei „alle erreichen ihren Erwartungsrang“ verdient oben, wer oben startet.** Live-Spielstand
`new-game-1795114260527-nzr0z9`, Spieltag 11, Faktor 0,94. Vertragsanker (die eingefrorene Auszahlung bei Erwartung) plus
Vorstandsziele minus Jahresgehalt:

| | Startrang 1 bis 4 | Startrang 13 bis 16 | Gefälle | Liga-Mittel | Teams ≥ 0 |
|---|---:|---:|---:|---:|---:|
| Liga 1 | +25,9 C | −11,0 C | 36,9 C | +5,7 C | 9 von 16 |
| Liga 2 | +13,7 C | +9,8 C | 3,9 C | +10,6 C | 16 von 16 |

In Liga 1 liegen zwischen dem oberen und dem unteren Viertel 37 C je Saison, ohne dass ein Team besser oder schlechter
spielt als erwartet. Startrang ist Budget-Rang: das ist ein Verstärker für die Reichen.

**(d) Die Seltenheit ist ein Los.** Im Live-Spielstand liegt der Anker in Liga 1 bei 60 C (gewöhnlich, 6 Teams), 76 C
(selten, 5), 85 C (magisch, 4) und 104 C (legendär, 1). Ein Teil davon ist der Startrang, ein Teil der Wertfaktor von bis zu
±11 %. Wer legendär zieht, bekommt rund 8 C mehr für nichts.

**(e) Die Ereignisse sind Würfel.** 35 Ereignisse in elf Spieltagen, Summe −18 C, je Team zwischen −5 und +6 C. Keine
Entscheidung, keine Erklärung, kein Bezug zum Spiel.

**(f) Die Laufzeit ist kein Hebel.** Sie wird gewürfelt (im Live-Spielstand 19 × ein Jahr, 5 × zwei, 8 × drei) und kostet in
Jahr 2 und 3 Geld. Eine Entscheidung „Sicherheit gegen Flexibilität“ ist das nicht.

---

## 2. Ziele

1. **Faktor 1 heißt Gleichgewicht.** Erreicht jedes Team seinen Erwartungsrang, ist das Liga-Mittel der GuV etwa 0. Der
   Saisonfaktor ist eine Zahl im Spielstand und sagt, wie weit die Liga vom Gleichgewicht weg ist.
2. **Über Erwartung im Plus, unter Erwartung im Minus,** und zwar gegen denselben Erwartungsanker, den der Vorstand nutzt.
3. **Echte Streuung.** Bei gleichem Ergebnis entscheidet die Kader- und Gehaltspolitik über Plus oder Minus.
4. **Die Schere wird nicht größer,** kleine Teams bekommen einen messbaren Aufholweg.
5. **Eine Rechnung, die auf eine Karte passt.** Drei Zeilen je Vertrag: Grundbetrag, Leistungsteil, Farb-Partner.
6. **Nichts doppelt.** Marketing, Karten, Medaillen, Verpflegung, Versicherung, Trainingslager, Kredite und später Ausrüstung
   sind eigene Posten. Der Sponsor ist der Ausgleichsposten, der sie zur Null ergänzt.
7. **Bestehendes bleibt:** Vorstands-Freigabe und Quote, zwei Töpfe, Rücklage nach Finanzwert, kein harter Gehaltsdeckel,
   Budget-Staffel, Liga-Split 2×16, Regeln als Stempel im Spielstand, Mensch und KI gleich.

---

## 3. Geprüfte Ideen

| Idee | Urteil | Begründung |
|---|---|---|
| Grundbetrag nach Marktgröße plus Leistungsteil gegen den Erwartungsanker | **genommen**, Kern des Vorschlags | Marktgröße ist die **Beliebtheit** (`TeamIdentity.popularity`, `lib/economy/team-beliebtheit.ts`), nicht der Finanzwert. Der Finanzwert steuert schon die Rücklage; als Einnahmequelle würde er Reiche doppelt belohnen. |
| Leistungsteil je Spieltag statt nur am Saisonende | **genommen** | der Weg ist gebaut (Rang-Abschlag 80 %, Schlussausgleich) |
| Ziele mit Bonus und Malus | **genommen, wie heute** | die Achsen bleiben, fest mit 0,5 bepreist. Der Einsatz hängt an der Vertragsart statt an der Seltenheit |
| Haupt- und Nebensponsoren mit Farbbezug | **genommen** als zwei Farb-Partner | sie tragen den schon geplanten Farb-Meister (`finanzen-posten-22-11.md` f.1, g.1), also kein zweiter Topf. Jedes Team hat damit einen eigenen Weg zu Geld (Leitlinie „mehrere Wege zum Erfolg“) |
| Disziplin-Sponsoren (20 Stück) | **verworfen** | zwei Begegnungen je Disziplin und Saison sind zu viel Zufall; die Medaillen decken das klein und breit ab |
| Fix gegen Bonus-lastig wählen | **genommen** als Vertragsart | Hebel 0,5 / 1,0 / 1,5 auf den Leistungsteil. Ein Liga-Ausgleich hält die Summe trotzdem bei 0 |
| Laufzeit als Risiko | **genommen, entschärft** | Laufzeit wird gewählt, bindet Marke und Vertragsart, bringt Treuebonus. Der Erwartungsanker wird trotzdem jede Saison neu gesetzt, sonst geht die Nullsumme verloren |
| Verhandlung wie das Budget-Gespräch | **genommen, klein** | ein Blatt mit drei Hebeln, kein Gesprächsbaum. „Nachfordern“ einmal je Angebot, erst in Phase 4 |
| Liga-Topf, der den Faktor auf 1 zieht | **genommen**, mit Bremse | Topf folgt den Kosten der Liga, aber höchstens 15 % je Saison. Ohne Bremse hätte das System keinen Anker: jede Kostenhöhe wäre ein Gleichgewicht |
| Solidarischer Pool, Umlage von oben nach unten | **verworfen** als eigene Mechanik | eine Liga-Umlage ist in `finanzen-posten-22-11.md` schon verworfen. Der Aufholweg steckt in drei vorhandenen Stellen (4.7), ohne neue Buchung |
| Ereignisse | **umgebaut** | Entscheidung statt Würfel, höchstens zwei je Saison. Zuschauer-Ereignisse (Derby) gehören zu den Karten und bleiben dort |
| Wappen und Prestige | **genommen** | Seltenheit wird Prestige: Wappen und der Kurs einer Gebäude-Leihe wie heute. Geldwirkung nur noch −3 bis +4 %, topfneutral |
| Saisonfaktor als eine Zahl im Spielstand | **genommen** | `seasonState.sponsorRegel.saisonfaktor`, Grundwert 1,00 |
| Erwartungsanker mit Rückfall zur Mitte korrigieren | **verworfen** | damit wäre der Leistungsteil für jedes Team im Mittel 0. Aber wer genau seinen Erwartungsrang trifft, bekäme oben ein Plus und unten ein Minus. Das widerspricht Ziel 1 und nimmt den Aufholweg |
| Vorschuss bei Unterschrift | **verworfen** | wurde auf Chris’ Entscheidung entfernt (`sponsor-v3-model.ts`, „es gibt keinen Sponsor-Vorschuss mehr“). Liquidität kommt über Dauerkarten und Kredite |

---

## 4. Mechanik mit Formeln

### 4.1 Die Größen

- 32 Teams, zwei Ligen L mit je 16. **Stichtag** ist der Abschluss der Kaufphase vor Spieltag 1 (Saison 1: nach dem Draft).
- **Betriebskosten** `B_i` am Stichtag: Jahresgehalt des Kaders + Gebäude-Unterhalt + Kreditzins + Planwerte der geplanten
  Ausgaben (Verpflegung, Versicherung, Trainingslager, später Ausrüstung).
- **Übrige Planeinnahmen** `P_i`: Vorstandsziele (heute rund 4,5 C), Gebäude-Einnahme, später Karten und Dauerkarten,
  Marketing (Teammarke und Team-Anteil), Medaillen.
- **Kaderwert** `W_i` am Stichtag.
- **Erwartungsrang** `E_i`: der Erwartungsrang des Vorstands (`computeTeamExpectation`, Mittel aus Stärkerang und Ligarang der
  Vorsaison; in Saison 1 nur der Stärkerang), ungerundet, je Liga so gereiht, dass die Summe 136 ist. Er wird am Stichtag
  eingefroren und steht im Stempel. **Ein Anker für Vorstand und Sponsor.**
- **Endrang** `R_i` in der eigenen Liga.

### 4.2 Der Liga-Topf und der Saisonfaktor

```
Betriebsteil   K_B = klammere( Σ (B_i − P_i),  0,85 × K_B,vor,  1,15 × K_B,vor )      Saison 1: K_B,vor = 32 × 62 C
Kader-Ersatz   K_E = κ × 0,10 × Σ W_i                                                 Saison 1: 0;  κ = 0 oder 1 (Frage 1)
Liga-Topf      T   = F × (K_B + K_E) − Übertrag
```

`F` ist der **Saisonfaktor**. Summiert man die GuV aller Teams, bleibt

```
Σ GuV  =  (F − 1) × (K_B + K_E)  +  [K_B − Σ (B_i − P_i)]  +  (Plan gegen Ist der übrigen Posten)  +  Zielrest
```

Der erste Summand ist die Aussage des Faktors: **bei F = 1 ist er 0, jedes Hundertstel bewegt die Liga um 1 % ihrer Kosten**
(rund 20 C in der Liga, 0,6 C je Team). Der zweite ist die Bremse, sie greift nur, wenn die Kosten der Liga in einer Saison um
mehr als 15 % springen. Der dritte und vierte sind Schätzfehler und Zielausgang; sie wandern als Übertrag in den Topf der
nächsten Saison (höchstens ±3 % des Topfs), sodass sich die Rechnung über zwei Saisons schließt.

**Warum der Topf den Kosten folgt, aber gebremst.** Ein fester Topf (heute) trifft die Null nur zufällig. Ein Topf, der den
Kosten ungebremst folgt, trifft sie immer, hat aber keinen Halt: Sparen alle, schrumpft der Topf mit, und umgekehrt. Mit der
Bremse wirkt der Topf wie heute als Gegengewicht (sparen alle, bleibt Geld übrig und wird wieder ausgegeben), und er wächst
trotzdem mit, wenn neue Posten dazukommen. Ein einzelnes Team bewegt den Topf mit jedem C Gehalt um 1 C und bekommt davon ein
Zweiunddreißigstel zurück. Den Topf aufzublasen lohnt sich nicht.

**Konjunktur.** Der Grundwert `F = 1,00` steht im Stempel. Darauf darf je Saison eine Konjunktur zwischen 0,95 und 1,05 liegen
(heute 0,82 bis 1,24, das sind 261 C Spannweite in der Liga). Mittel genau 1,00. Das Fünf-Saisons-Fenster und sein Ausblick
(`sponsor-salary-factor-outlook.ts`) bleiben und zeigen diese Zahl. Wer keine Konjunktur will, stellt die Spanne auf 0.

**Vorab-Zusage.** Die Kaufplanung braucht die Zahl vor dem Stichtag. Zum Saisonwechsel wird darum ein vorläufiger Topf aus
dem Betriebsteil der Vorsaison gerechnet; jedes Team sieht seinen vorläufigen Grundbetrag. Am Stichtag wird endgültig
gerechnet. Zugesagt sind mindestens 90 % des vorläufigen Betrags.

### 4.3 Hauptsponsor: Grundbetrag

```
T_H  = T − Σ Farb-Töpfe                                         (4.5)
x_i  = T_H / 32 × a_L / ā  +  F × s_L × (8,5 − E_i)  +  m × (Beliebtheit_i − Liga-Mittel)
G_i  = x_i × w_i × ( Σ_L x  /  Σ_L x × w )                      w = Prestige-Faktor, in der Liga-Summe neutral
```

| Stellschraube | Liga 1 | Liga 2 | Herkunft |
|---|---:|---:|---|
| Liga-Anteil `a_L` | 1,11 | 0,89 | Verhältnis 1,25. Heute gemessen 1,20 bis 1,38 (Ist), Gehälter 1,24 bis 1,48 |
| Steigung `s_L`, C je Erwartungsrang | 1,2 | 1,0 | rund 80 % der gemessenen Kostensteigung (Median 1,5 C je Rang, Spanne 1,0 bis 3,5) |
| Steigung mit Kader-Ersatz (ab Saison 2, κ = 1) | 2,2 | 2,0 | rund 90 % der Steigung von Kosten plus 10 % Kaderwert (Median 2,2, Spanne 1,4 bis 4,6) |
| Marktgröße `m`, C je Beliebtheitspunkt | 0,8 | 0,8 | Spanne der Beliebtheit 2,8 bis 8,3, also etwa ±2 C |
| Prestige `w` | 0,97 / 1,00 / 1,02 / 1,04 | gleich | gewöhnlich bis legendär, statt 0,89 bis 1,11 |

Der Grundbetrag wird in 20 Raten je Spieltag gezahlt, wie heute die Basis.

### 4.4 Hauptsponsor: Leistungsteil

```
L_i  =  F × p_L × σ × [ h_i × (E_i − R_i)  −  Mittel_L( h_j × (E_j − R_j) ) ]
```

- `p_L`: 3,0 C je Platz in Liga 1, 2,5 C in Liga 2. Fünf Plätze über Erwartung sind in Liga 1 also +15 C.
- `σ`: 0,5 in Saison 1, sonst 1. In Saison 1 gibt es keinen Vorjahresrang, die Erwartung trifft schlecht (gemessene Steigung
  Endrang gegen Erwartungsrang −0,1 bis 0,7; ab Saison 2 0,5 bis 0,9).
- `h_i`: Hebel der **Vertragsart**: Festvertrag 0,5, Leistungsvertrag 1,0, Prämienvertrag 1,5.
- Der abgezogene Mittelwert ist der **Liga-Ausgleich**. Er macht die Summe je Liga exakt 0, egal wer welchen Hebel wählt.
  Haben alle denselben Hebel, ist er 0 (die Erwartungsränge und die Endränge summieren sich beide auf 136).

Gezahlt wird wie heute: je Spieltag 80 % von `L` beim aktuellen Tabellenplatz geteilt durch 20, am Saisonende der Ausgleich
auf den Endrang.

**Eingebauter Aufholweg.** Wer auf Rang 1 erwartet wird, kann nur schlechter abschneiden, wer auf Rang 16 erwartet wird, nur
besser. Mit der gemessenen Steigung von rund 0,7 ab Saison 2 landet ein Team mit Erwartung 16 im Mittel auf Rang 13,75: das
sind +5,6 C in Liga 2 und +6,8 C in Liga 1, mit Prämienvertrag das Anderthalbfache. Der Favorit zahlt denselben Betrag. Das
ist gewollt und in 5.4 als Zahl ausgewiesen.

### 4.5 Farb-Partner

Jedes Team unterschreibt **zwei von vier Farben** (POW, SPE, MEN, SOC). Je Liga und Farbe gibt es einen Topf:
Liga 1 `12 C × F`, Liga 2 `9 C × F`, zusammen 84 C. Am Saisonende wird jeder Topf unter den Teams verteilt, die diese Farbe
unterschrieben haben, nach ihren Tabellenpunkten in den Disziplinen dieser Farbe (`pointsByArea` im Punkte-Ledger):
40 / 25 / 15 / 10 / 5 / 5 %. Gleichstand teilt.

- Die Summe ist fest, egal wer was unterschreibt. Wer eine Farbe wählt, in der wenige Starke stehen, verdient mehr.
- **Kein Doppel:** Der Farb-Partner **ist** der geplante Farb-Meister (20 C aus dem Rangprämien-Topf). Die Medaillen
  (32 C) bleiben ein eigener kleiner Posten und stehen als Planeinnahme in `P_i`.
- Der Deckel aus f.1 („höchstens zwei Farben je Team“) ist damit die Regel selbst.

### 4.6 Ziel, Laufzeit, Ereignis, Leihe

- **Ziel:** eine Achse wie heute. `Auszahlung = Einsatz × (2 × Erfüllung − 1)`, Einsatz 0 C (Festvertrag), ±4 C
  (Leistungsvertrag), ±8 C (Prämienvertrag). Im Mittel 0, der Rest geht in den Übertrag.
- **Laufzeit:** 1 bis 3 Saisons, gewählt. Marke, Vertragsart und Farb-Partner sind für die Laufzeit fest. Treuebonus +1 C im
  zweiten, +2 C im dritten Jahr, vorab aus dem Topf genommen. Vorzeitig lösen kostet 3 C in den Topf. Der Abschlag von
  6 und 13 % entfällt.
- **Ereignis:** höchstens zwei **Sponsorentermine** je Saison. Der Manager entscheidet: zusagen (+1,5 C, ein benannter
  Spieler hat am nächsten Spieltag Form −1) oder absagen. Planwert 1,5 C je Team steht in `P_i`. Kein Würfel-Geld mehr.
- **Gebäude-Leihe:** bleibt als Zusatz am Hauptsponsor, wie heute gegen festen Cash-Verzicht auf den Grundbetrag.
- **Nachfordern** (Phase 4): einmal je Angebot. Erfolg nach Beliebtheit und Vorstandsvertrauen hebt den Zieleinsatz nur
  nach oben; scheitert es, zieht die Marke zurück und es bleiben zwei Angebote.

### 4.7 Wo der Aufholweg steckt

1. **Liga-Anteil 1,25** bei Gehältern von 1,24 bis 1,48: Liga 2 liegt bei Erwartung im Mittel 1 bis 6 C über Liga 1 (in einer von acht Saisons knapp darunter).
2. **Steigung unter der Kostensteigung:** der Grundbetrag deckt rund 80 % dessen, was ein besserer Erwartungsrang üblich kostet.
3. **Leistungsteil gegen den ungeglätteten Erwartungsrang** (4.4): Außenseiter haben nur Luft nach oben.
4. **Farb-Partner:** ein Kader mit Profil in einer Farbe verdient dort wie ein Großer.

Keine dieser Stellen ist eine Umlage. Es wird nirgends Geld von einem Team zum anderen gebucht.

### 4.8 Was der Spieler sieht

Je Vertrag vier Zeilen: Grundbetrag, Leistungsteil (Satz je Platz, aktueller Stand), Farb-Partner, Ziel. Dazu die
Hochrechnung der Saison, groß je Saison und klein je Spieltag. Die Erklärkarte rechnet den Topf in vier Schritten vor.

---

## 5. Kalibrierung und Messung

### 5.1 Aufbau

- **Läufe:** `scripts/miss-teamfinanzen-saison.ts`, 32 KI-Teams von Anfang an, Battle-Modus 2×16, Draft als Block.
  - Lauf **A**: Stand origin/main `0c3826ebd` (mit Budget-Staffel und KI-Kaderziel #1705), **Saisonfaktor fest 1,00**
    (`OLY_LONG_RUN_SALARY_FACTOR_PATTERN=1,1,…`), zwei Saisons. Für dieses Papier gerechnet.
  - Läufe **B** und **C**: zwei Drei-Saison-Läufe desselben Skripts vom 22.11. (anderer Auftrag, gewürfelter Faktor 0,87 bis
    1,13, Stand vor der Budget-Staffel). Sie dienen als zweite und dritte Saat.
- **Modell:** `scripts/modell-sponsoren-rework.py` rechnet auf den Einzelwerten jedes Teams die Formeln aus Abschnitt 4 nach.
  Erwartungsrang = Stärkerang (Top 6) am Saisonstart, ab Saison 2 gemittelt mit dem Ligarang der Vorsaison. Farb-Partner und
  Ziel sind im Modell nicht verteilt (Summe fest, je Team unbekannt), sie stecken im Grundbetrag.
- **Szenarien:** „gespielt“ nimmt die Endränge des Laufs. „Alle auf Erwartungsrang“ setzt den Leistungsteil auf 0; für
  heute steht dort der Vertragsanker statt der Ist-Zahlung.
- **Kalibriert** wurden Steigung und Liga-Anteil an den Läufen B und C. Lauf A ist die Probe.

**Grenzen.** Das Modell hält das Verhalten der Teams fest: gleiche Kader, gleiche Gehälter, gleiche Ränge. In Wahrheit kauft
die KI anders, wenn sie weniger oder mehr Geld hat. Acht Saisons aus drei Läufen sind Richtungsaussagen. Die geplanten Posten
(Karten, Marketing und so weiter) sind in keinem Lauf gebaut; sie gehen als Planwert in die Formel und sind in 5.5 gerechnet.

### 5.2 Ergebnis: Liga-Mittel und Verteilung

Operative GuV je Team in C, Variante **κ = 0** (reine Betriebsrechnung, so wie die Leitplanke es verlangt):

| Lauf | Saison | Szenario | Liga-Mittel | Liga 1 | Liga 2 | Teams ≥ 0 (Liga 1 + Liga 2) | min / Median / max | Streuung (sd) |
|---|---:|---|---:|---:|---:|---:|---|---:|
| A | 1 | heute, alle auf Erwartungsrang | +5,8 | +1,6 | +9,9 | 22 (8 + 14) | −23,8 / +10,8 / +23,6 | 12,7 |
| A | 1 | **neu, alle auf Erwartungsrang** | **+0,6** | −2,5 | +3,6 | 20 (8 + 12) | −13,4 / +0,4 / +12,0 | 6,8 |
| A | 1 | heute, gespielt | +4,4 | +1,0 | +7,7 | 21 (9 + 12) | −34,5 / +7,0 / +43,2 | 18,0 |
| A | 1 | neu, gespielt | +0,6 | −2,5 | +3,6 | 18 (6 + 12) | −14,0 / +0,8 / +16,9 | 8,4 |
| A | 2 | heute, alle auf Erwartungsrang | +15,4 | +17,5 | +13,3 | 27 (14 + 13) | −68,2 / +14,9 / +70,4 | 23,6 |
| A | 2 | **neu, alle auf Erwartungsrang** | **+1,9** | −3,7 | +7,4 | 24 (9 + 15) | −82,4 / +7,1 / +18,9 | 18,3 |
| A | 2 | heute, gespielt | +13,7 | +11,7 | +15,8 | 28 (14 + 14) | −82,6 / +11,7 / +59,1 | 22,5 |
| A | 2 | neu, gespielt | +1,9 | −3,7 | +7,4 | 19 (7 + 12) | −95,9 / +4,2 / +32,7 | 21,6 |
| B | 1 | heute, alle auf Erwartungsrang | +8,8 | +8,2 | +9,4 | 23 (10 + 13) | −24,1 / +8,1 / +48,4 | 15,6 |
| B | 1 | **neu, alle auf Erwartungsrang** | **+1,8** | +2,1 | +1,4 | 21 (11 + 10) | −17,4 / +4,2 / +17,0 | 9,4 |
| B | 1 | heute, gespielt | +4,1 | +4,2 | +4,0 | 19 (10 + 9) | −38,9 / +2,4 / +55,6 | 22,5 |
| B | 1 | neu, gespielt | +1,8 | +2,1 | +1,4 | 18 (9 + 9) | −26,0 / +1,9 / +23,0 | 14,0 |
| B | 2 | heute, alle auf Erwartungsrang | +25,4 | +34,9 | +15,9 | 30 (15 + 15) | −29,6 / +23,2 / +78,9 | 21,9 |
| B | 2 | **neu, alle auf Erwartungsrang** | **+0,6** | −0,4 | +1,5 | 22 (9 + 13) | −33,2 / +3,2 / +14,9 | 9,7 |
| B | 2 | heute, gespielt | +21,4 | +23,6 | +19,2 | 30 (15 + 15) | −25,2 / +20,1 / +65,7 | 16,8 |
| B | 2 | neu, gespielt | +0,6 | −0,4 | +1,5 | 16 (7 + 9) | −33,2 / ±0,0 / +22,9 | 12,5 |
| B | 3 | heute, alle auf Erwartungsrang | +22,2 | +25,0 | +19,3 | 32 (16 + 16) | +5,5 / +19,3 / +49,9 | 11,3 |
| B | 3 | **neu, alle auf Erwartungsrang** | **+2,1** | +0,5 | +3,8 | 21 (9 + 12) | −12,7 / +4,4 / +12,8 | 6,5 |
| B | 3 | heute, gespielt | +18,6 | +19,6 | +17,7 | 29 (15 + 14) | −11,4 / +16,0 / +71,8 | 16,3 |
| B | 3 | neu, gespielt | +2,1 | +0,5 | +3,8 | 17 (8 + 9) | −22,2 / +1,9 / +24,5 | 10,6 |
| C | 1 | heute, alle auf Erwartungsrang | +7,8 | +5,4 | +10,1 | 22 (9 + 13) | −13,8 / +9,0 / +35,7 | 11,7 |
| C | 1 | **neu, alle auf Erwartungsrang** | **+0,3** | −0,9 | +1,5 | 16 (6 + 10) | −10,3 / −0,1 / +11,5 | 5,1 |
| C | 1 | heute, gespielt | +5,6 | +5,3 | +5,8 | 19 (8 + 11) | −33,5 / +2,8 / +59,7 | 17,7 |
| C | 1 | neu, gespielt | +0,3 | −0,9 | +1,5 | 16 (7 + 9) | −15,4 / +1,0 / +15,3 | 9,1 |
| C | 2 | heute, alle auf Erwartungsrang | +25,3 | +30,0 | +20,6 | 29 (13 + 16) | −5,8 / +22,9 / +83,0 | 21,0 |
| C | 2 | **neu, alle auf Erwartungsrang** | **+3,9** | +2,4 | +5,4 | 24 (12 + 12) | −30,5 / +5,5 / +20,8 | 12,6 |
| C | 2 | heute, gespielt | +20,7 | +22,9 | +18,4 | 28 (13 + 15) | −9,5 / +19,4 / +68,1 | 17,7 |
| C | 2 | neu, gespielt | +3,9 | +2,4 | +5,4 | 18 (8 + 10) | −35,2 / +6,7 / +42,0 | 17,4 |
| C | 3 | heute, alle auf Erwartungsrang | +24,6 | +29,8 | +19,4 | 31 (16 + 15) | −11,6 / +22,7 / +68,6 | 15,2 |
| C | 3 | **neu, alle auf Erwartungsrang** | **+3,2** | +2,3 | +4,1 | 25 (11 + 14) | −26,1 / +5,7 / +17,1 | 10,6 |
| C | 3 | heute, gespielt | +21,0 | +22,3 | +19,7 | 31 (16 + 15) | −0,7 / +17,8 / +56,0 | 15,0 |
| C | 3 | neu, gespielt | +3,2 | +2,3 | +4,1 | 17 (8 + 9) | −29,9 / +2,8 / +37,8 | 17,3 |

Lesart:

- **Leitplanke 1 hält.** Neu liegt das Liga-Mittel bei „alle auf Erwartungsrang“ zwischen +0,3 und +3,9 C je
  Team, heute zwischen +5,8 und +25,4 C. Der Rest über 0 hat zwei Quellen: die Vorstandsziele zahlen im Lauf
  etwas mehr als der Planwert von 4,5 C, und die Gehälter sinken zwischen Stichtag und Saisonende leicht.
- **Die Streuung ist echt.** Bei „alle auf Erwartungsrang“ liegen neu 16 bis 25 von 32 Teams bei 0
  oder besser, die Streuung ist 5 bis 13 C (mit dem Ausreißer aus Lauf A 18 C). Das ist allein die Gehaltspolitik.
- **Mit den gespielten Rängen** sind neu 16 bis 19 von 32 Teams im Plus (heute 19 bis 31). Der Leistungsteil bewegt
  einzelne Teams um bis zu ±20 C (Saison 1) und ±40 C (ab Saison 2). Die Streuung ist in sechs von acht Saisons kleiner als
  heute, in zwei etwa gleich.
- **Ein Ausreißer** steht in Lauf A, Saison 2: ein Team mit −82 C bei Erwartung (heute −68 C). Sein Kader kostet weit mehr,
  als irgendein Vertrag trägt. Das ist ein Fall für die Vorstands-Freigabe, nicht für den Sponsor.

### 5.3 Ergebnis mit Kader-Ersatz (κ = 1, Empfehlung)

Ab Saison 2 kommt der Kader-Ersatz in den Topf (10 % des Kaderwerts, im Lauf 19 bis 21 C je Team). Die Spalte „nach
Kader-Ersatz“ zieht denselben Betrag je Team kalkulatorisch ab:

| Lauf | Saison | Topf neu | Sponsor heute | Kader-Ersatz je Team | operative GuV Ø, alle auf Erwartung | nach Kader-Ersatz Ø | Teams ≥ 0 nach Kader-Ersatz, Erwartung | Teams ≥ 0 nach Kader-Ersatz, gespielt | reichstes minus ärmstes Viertel |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A | 2 | 2644 C | 2221 C | 23,9 C | +25,8 | +1,9 | 24 (9 + 15) | 20 (6 + 14) | −35,0 |
| B | 2 | 2378 C | 2311 C | 21,0 C | +21,6 | +0,6 | 21 (8 + 13) | 18 (7 + 11) | −10,9 |
| B | 3 | 2286 C | 2119 C | 21,3 C | +23,4 | +2,1 | 20 (8 + 12) | 17 (7 + 10) | −9,9 |
| C | 2 | 2212 C | 2157 C | 19,4 C | +23,3 | +3,9 | 24 (10 + 14) | 20 (8 + 12) | −16,0 |
| C | 3 | 2185 C | 2102 C | 20,1 C | +23,3 | +3,2 | 24 (10 + 14) | 19 (7 + 12) | −15,6 |

In den Läufen B und C ist der Topf damit so groß wie heute (2.190 bis 2.380 C gegen 2.100 bis 2.310 C). In Lauf A, mit der
Budget-Staffel und teureren Kadern, liegt er 420 C darüber: der Kaderwert ist dort höher, also auch der Ersatz. Operativ steht
die Liga bei +22 bis +26 C je Team, nach Kader-Ersatz bei +0,6 bis +3,9 C. Die Steigung des Grundbetrags ist in dieser
Variante um 1,0 C je Rang höher (4.3), sonst trüge das obere Viertel den ganzen Ersatz selbst.

### 5.4 Schere

| Lauf | Saison | Sponsor Liga 1 : Liga 2 heute | neu | Gehälter Liga 1 : Liga 2 | reichstes minus ärmstes Budget-Viertel, Erwartung, heute | neu | größter : kleinster Vertrag heute | neu | Teams mit Kasse < 0 am Saisonende heute | neu (Verhalten festgehalten) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A | 1 | 1,24 | 1,25 | 1,34 | +9,3 | −10,0 | 2,90 | 1,76 | 2 | 0 |
| A | 2 | 1,36 | 1,25 | 1,48 | −16,9 | −29,2 | 3,14 | 2,16 | 1 | 1 |
| B | 1 | 1,20 | 1,25 | 1,24 | +17,8 | +0,1 | 2,68 | 1,86 | 8 | 5 |
| B | 2 | 1,38 | 1,25 | 1,28 | +13,2 | −8,4 | 2,91 | 2,34 | 1 | 6 |
| B | 3 | 1,28 | 1,25 | 1,34 | −0,1 | −6,6 | 2,77 | 2,22 | 1 | 5 |
| C | 1 | 1,26 | 1,25 | 1,28 | +11,4 | −1,6 | 3,00 | 1,83 | 2 | 1 |
| C | 2 | 1,28 | 1,25 | 1,33 | −5,8 | −13,8 | 2,65 | 2,85 | 0 | 3 |
| C | 3 | 1,31 | 1,25 | 1,28 | +0,4 | −13,9 | 2,50 | 2,42 | 0 | 1 |

- **Sponsorgeld Liga 1 zu Liga 2:** neu fest 1,25. Heute 1,20 bis 1,38, im Mittel 1,29. In sechs von acht Saisons ist die
  Schere kleiner, in zwei (1,20 und 1,24) minimal größer. Die Gehälter stehen bei 1,24 bis 1,48.
- **Reichstes gegen ärmstes Budget-Viertel** bei „alle auf Erwartungsrang“: heute im Mittel +4 C zugunsten der Reichen
  (einzelne Saisons bis +18 C), neu im Mittel −10 C. Das Vorzeichen dreht. Der Wert aus Lauf A, Saison 2 (−29 C) ist vom
  Ausreißer getrieben.
- **Größter zu kleinstem Vertrag:** heute 2,5 bis 3,1, neu 1,8 bis 2,9. In sieben von acht Saisons kleiner.
- **Kasse am Saisonende, Variante κ = 0:** in Saison 1 sinkt die Zahl der Teams im Minus (12 → 6 über drei Läufe). Ab Saison 2
  steigt sie (3 → 16 über fünf Saisons), weil der Liga die rund 20 C je Team fehlen, die heute den Kaderumbau bezahlen. Das
  Modell hält das Verhalten fest; in Wahrheit würde die KI weniger kaufen. Genau das ist Frage 1.

### 5.5 Die geplanten Posten

Die Posten aus `finanzen-posten-22-11.md` (Runde 5, i.2) und `marketing-22-11.md` gehen mit ihren Planwerten in `B_i` und
`P_i`. Je Team und Saison, Saison 1:

| Posten | Liga 1 | Liga 2 | steht in |
|---|---:|---:|---|
| Dauerkarten, Tageskarten, Ausbau-Mehrertrag | +3,7 | +2,7 | `P_i` |
| Marketing: Teammarke und Team-Anteil | +8,4 | +6,2 | `P_i` |
| Medaillen | +1,25 | +0,75 | `P_i` |
| Farb-Meister | (+0,75) | (+0,5) | **entfällt als eigener Posten**, ist der Farb-Partner |
| Verpflegung, Versicherung, Trainingslager, Arena-Unterhalt, Kreditzins | −5,4 | −5,3 | `B_i` |
| **Netto, um das der Sponsor-Topf sinkt** | **7,95** | **4,35** | im Mittel 6,2 C je Team, rund 200 C in der Liga |

Mit allen Posten sinkt der Sponsor-Anteil an den Einnahmen von heute 96 % geschätzt auf rund 80 %, in Saison 2 mit ausgebauter Arena auf
rund 70 %. „Tickets werden stärker“ ist damit erfüllt, ohne dass die Liga ins Plus läuft. Die Ausrüstung (6,7 bis 19 C je
Team) kommt später als Ausgabe dazu und hebt den Topf um ihren Planwert. Das ist Frage 2: Chris hat am 22.11. gesagt,
„Sponsoren bleiben genau wie sie sind“, als die Tickets dazukamen. Mit dem Wunsch nach Gleichgewicht bei Faktor 1 passt das
nicht mehr zusammen; eines von beiden muss nachgeben.

### 5.6 Abnahme vor dem Bau

Zwei Saaten, zwei Saisons, Faktor 1, mit der gebauten Regel:

- Liga-Mittel der GuV nach der gewählten Definition zwischen −4 und +4 C je Team in jeder Saison.
- Bei den gespielten Rängen 12 bis 20 von 32 Teams bei 0 oder besser (nicht 27 und nicht 8).
- Sponsorgeld Liga 1 zu Liga 2 höchstens 1,25; reichstes minus ärmstes Budget-Viertel bei Erwartung nicht über +2 C.
- Kader und Kaderstärke der KI am Start von Saison 2 und 3 nicht unter dem Lauf ohne die Regel (das prüft, ob der Topf den
  Kaderumbau noch trägt).
- Gezeigt = gebucht je Zeile; Wertungs-Fingerabdruck unverändert (kein Posten berührt die Arena).

---

## 6. Migration: Regel-Stempel

Muster `lib/resolve/wertungs-skalen.ts` und `lib/resolve/formkarten-regel.ts`.

```
seasonState.sponsorRegel = {
  seasonId, version: "topf" | "alt",
  saisonfaktor: 1.00,            // Grundwert; die Konjunktur der Saison steht weiter in seasonEconomyFactors
  betriebsteil: <C>,             // K_B dieser Saison, Basis für die Bremse der nächsten
  kaderErsatz: 0 | 1,            // κ
  uebertrag: <C>,
  anker: { teamId: Erwartungsrang },
  vertragsart: { teamId: "fest" | "leistung" | "praemie" },
  farben: { teamId: [farbe, farbe] }
}
```

- **Neues Spiel:** `version: "topf"` ab Saison 1.
- **Bestehender Spielstand:** die laufende Saison rechnet bit-gleich alt zu Ende. Der Stempel wird beim nächsten
  Saisonwechsel gesetzt. Laufende Mehrjahresverträge enden dabei: der Vertrag wird zum Saisonwechsel in einen Vertrag
  neuer Art derselben Marke überführt (Leistungsvertrag, Restlaufzeit bleibt, Treuebonus zählt weiter), die Leihgabe läuft
  unverändert weiter. Der Betriebsteil der ersten Saison neuer Art wird gegen den Richtwert geklammert.
- **Rückweg:** `OLY_SPONSOR_REGEL=aus` (neue Saisons bekommen `alt`), Notbremse `=aus-sofort` (schaltet Leistungsteil und
  Farb-Partner ab und zahlt den Grundbetrag weiter, damit keine Kasse mitten in der Saison kippt). Nur auf dem Server
  (compose und `.env`), kein `NEXT_PUBLIC`.
- Jeder Rechenweg fragt `sponsorRegelFuer(gameState)`, nie die Variable.
- Der Saisonfaktor selbst ist ein Feld im Stempel und damit je Spielstand einstellbar (Einstellung für Testzwecke).

---

## 7. KI-Verhalten

Die KI nutzt dieselben Funktionen wie der Mensch und dieselben Zahlen wie die Anzeige.

- **Vertragsart:** Erwartungswert des Hebels `p × (h − 1) × (E − erwarteter Endrang)`, erwarteter Endrang
  `8,5 + 0,7 × (E − 8,5)`, minus Risikoabschlag nach Finanzwert. Praktisch: Erwartungsrang 11 oder schlechter nimmt den
  Prämienvertrag, 4 oder besser den Festvertrag, dazwischen entscheidet der Finanzwert (ab 7 Fest, unter 4 Prämie, sonst
  Leistung). Die Ambition des GM verschiebt die Grenzen um einen Rang.
- **Farb-Partner:** die zwei Farben, in denen der Kader gegen die Liga am besten steht (Stärkerang je Farbe aus
  `teamStrengthRankCaptures`); Gleichstand entscheidet die Farb-Identität des Teams.
- **Laufzeit:** Finanzwert ab 6 lang, unter 4 kurz. Kein Team bindet sich länger als bis zum Ende eines erwarteten Umbruchs.
- **Sponsorentermin:** zusagen, wenn der Spieler am nächsten Spieltag nicht aufgestellt ist oder das Duell nicht knapp ist
  (dieselbe Knappheitsrechnung wie der Formkarten-Plan).
- **Kaufplanung:** der Forecast mit Sponsor (`OLY_KI_FORECAST_SPONSOR`) rechnet mit der Vorab-Zusage, also 90 % des
  vorläufigen Grundbetrags, und mit Leistungsteil 0. Das ist vorsichtiger als heute (Anker inklusive Wertungstopf).
- **Vorstand:** Freigabe, Quote und Rücklage rechnen unverändert auf der Kasse. Neu ist nur, dass Vorstand und Sponsor
  denselben Erwartungsrang lesen; `underdog_story` und `golden_fairytale` entfallen, der Leistungsteil sagt dasselbe genauer.

---

## 8. Mehrspieler und Delegation

- Alles hängt am Team, nicht am Menschen: Angebote, Vertragsart, Farben, Sponsorentermin stehen je Team im Stempel.
  Das aktive Team kommt aus `activeManagerTeamId`, Besitz aus `canOwnerManageTeam`.
- Geschrieben wird über die bestehende Sponsor-Route hinter `authorizeServerRoomWrite` mit
  `resolveAuthoritativeWriteOwnerId`, frisch vom Server gelesen.
- **Delegation:** der Bereich „Sponsor“ existiert schon (`waehleSponsorFuerDelegierteTeams`). Die delegierte KI wählt nach
  Abschnitt 7 und füllt nur, was der Mensch nicht gesetzt hat. Der Sponsorentermin hat einen dritten Knopf „an die KI geben“.
- **Kein Warten:** Der Stichtag wartet nicht auf einen Menschen. Wer bis dahin nicht unterschrieben hat, bekommt den
  Leistungsvertrag der Marke mit dem höchsten Prestige und die KI-Farben; das steht in seiner Inbox, nicht in der der anderen.
- **Sicht:** Jeder sieht im Liga-Vergleich alle Verträge (Marke, Vertragsart, Farben, Beträge). Das sind keine verdeckten
  Werte. Der Erwartungsrang fremder Teams folgt dem Scouting-Nebel der Kaderstärke (grobe Stufe, exakt bei vollem Scouting).

---

## 9. Was entfällt

| Entfällt | Ersatz |
|---|---|
| Sockel umgekehrt nach Startrang, Wertungstopf 1.133 C × Faktor, Teilung 60/40 | Liga-Topf aus den Kosten, Grundbetrag nach Erwartungsrang |
| elf Kurvenformen (`sponsor-curve-shapes.ts`), Tilt, Altkarten Sicherheit und Ambition | drei Vertragsarten |
| Wertfaktor der Seltenheit 0,89 bis 1,11 | Prestige 0,97 bis 1,04, topfneutral |
| Laufzeit-Abschlag 0,94 und 0,87, gewürfelte Laufzeit | gewählte Laufzeit mit Treuebonus |
| Zonen-Term ±6 C | der Liga-Anteil belohnt den Aufstieg, der Leistungsteil bestraft den Abstiegsplatz |
| Würfel-Ereignisse (12 % je Spieltag) | Sponsorentermin als Entscheidung |
| Saisonfaktor 0,82 bis 1,24, Mittel 1,03 | Grundwert 1,00, Konjunktur 0,95 bis 1,05 |
| Sonderziele `underdog_story`, `golden_fairytale` und die Schätztabelle `GOAL_PROBABILITY` | Leistungsteil gegen den Erwartungsrang |
| eigener Posten Farb-Meister | Farb-Partner |
| `sponsor-economy-calibration.ts`, `SPONSOR_AUSSCHUETTUNG` 1,1 | der Topf kalibriert sich am Stichtag selbst |

Bleibt: Marken und Namen (200 Dachmarken), Gebäude-Leihe mit Rangmarke, Achsen als Ziele, Zahlung je Spieltag, das
Faktor-Fenster als Anzeige, der Sponsor-Bereich der Delegation.

---

## 10. Bauplan in Phasen

| Phase | Inhalt | Abnahme |
|---|---|---|
| 0 | Messwerkzeug: `miss-teamfinanzen-saison.ts` schreibt Erwartungsrang und Farb-Punkte je Team; das Modell wird zum Vergleichstest (Modell gegen gebaute Regel) | Modell und Lauf stimmen je Team auf 0,1 C |
| 1 | Stempel `sponsorRegel`, Liga-Topf, Grundbetrag, Leistungsteil mit Liga-Ausgleich, Vorab-Zusage. Eine Vertragsart (Leistung), keine Farben. Rechenschicht rein, Buchung über den bestehenden Spieltagsweg | 5.6, zwei Saaten |
| 2 | Drei Vertragsarten, gewählte Laufzeit mit Treuebonus, Ziele mit neuem Einsatz, KI-Wahl, Überführung laufender Verträge | KI wählt nachvollziehbar; kein Vertrag verliert beim Saisonwechsel Geld ohne Anzeige |
| 3 | Farb-Partner samt Farbwertung, Sponsorentermin, Würfel-Ereignisse aus | Farb-Töpfe je Liga auf den Cent verteilt |
| 4 | Seite neu nach Mockup (eigene Komponente, eigenes CSS), alte `FoundationSponsorsNewLook` raus; Nachfordern; Erklärkarte | Abgleich Mockup gegen App bei 1920×1080 und 2560×1440 |
| 5 | Planwerte der neuen Posten in `B_i` und `P_i`, sobald Karten, Marketing, Verpflegung gebaut sind; Wappen für die unterschriebenen Marken (rund 40 je Saison, Requisiten, Kosten vorher schätzen) | Liga-Mittel bleibt in der Abnahme, wenn ein Posten dazukommt |

Phase 1 ist allein lauffähig und liefert schon das Gleichgewicht. Fable berät Mockup und Seite, Sonnet baut, ein
unabhängiges Review prüft Phase 1 (Geldmenge).

---

## 11. Das Mockup

`public/mockups/sponsoren-modern-22-11.html`, vier Ansichten, Stil der Mockups vom 17. und 18.11. (Tokens, RaniraSeason und
Barlow Condensed lokal, Schiene, Hero-Kopf, Karten). URL: `?ansicht=vertrag|angebote|liga|rechnung`, `&f=0.95|1|1.05`,
`&liga=1|2`, `&still=1`.

| Ansicht | Zeigt | Bild |
|---|---|---|
| Laufender Vertrag | Vertragskarte mit vier Zeilen und Hochrechnung, Leistungsteil je Spieltag gegen die Erwartung, Farb-Partner, Ereignisse | `vertrag-1920x1080.png` |
| Angebote für Saison 2 | drei Vertragsarten mit Auszahlungskurve, Verhandlungsblatt (Laufzeit, Farben, Ziel) | `angebote-1920x1080.png` |
| Liga-Vergleich | sortierbare Tabelle der 16 Teams, heute gegen neu, Ergebnis je Team | `liga-1920x1080.png` |
| So rechnet der Saisonfaktor | vier Rechenschritte, Regler für den Faktor, alle 32 Teams „bei Erwartungsrang“ heute gegen neu | `rechnung-1920x1080.png` |

**Echt** (Live-Abbild `origin/live-save`, Spielstand `new-game-1795114260527-nzr0z9`, Spieltag 11 von 20, Faktor 0,94, nur
gelesen, Kopie gelöscht): Teams, Ligen, Tabellenplatz und Platzverlauf je Spieltag, Startrang des laufenden Vertrags,
Jahresgehalt, Kaderwert, Beliebtheit, Farb-Punkte, Marke und Seltenheit des laufenden Sponsors, heutige Hochrechnung und
Vertragsanker, gebuchte Ereignisse. Die Marken tragen ihre neuen Namen aus `sponsor-brand-parents.ts`.

**Gerechnet** mit den Formeln aus Abschnitt 4 auf diesen Werten: Topf, Grundbetrag, Leistungsteil, Farb-Partner, Ergebnis.
Als Erwartungsrang dient der Startrang des laufenden Vertrags; der Spielstand hat noch keinen eingefrorenen Vorstands-Anker.

**Beispiel** (so beschriftet): die drei Angebote für Saison 2, Vertragsart und Farb-Wahl der KI-Teams, das Ziel
„Entwicklung“, der Sponsorentermin, die Vorab-Zusage.

Die drei Wappen stammen aus `public/sprites/sponsoren/` (Icon-Probe vom 22.11.). Alle anderen Marken zeigen ein Monogramm,
bis ihre Wappen bestellt sind.

**Was das Mockup für Death Peaches zeigt.** Heute 84,4 C beim aktuellen Platz 2 (Startrang 2 in Liga 2, seltene Karte). Neu
63,0 C. Der Kader ist mit 70,4 C der teuerste der Liga 2 (Mittel 56,1 C). Im heutigen System deckt der Startrang das
ab, im neuen muss der Platz es einspielen. Genau das ist „bei gleichem Ergebnis je nach Gehaltspolitik“.

Geprüft: lädt ohne JS-Fehler, kein Seitenscroll und kein Überlauf bei 1920×1080, 2560×1440 und 1710×1112.

---

## 12. Offene Fragen an Chris

1. **Was heißt Gleichgewicht?** (a) Die reine Betriebsrechnung ist bei Faktor 1 im Mittel 0. Dann fehlen der Liga ab
   Saison 2 die rund 20 C je Team, die sie heute netto am Transfermarkt ausgibt; die Kassen laufen in zwei bis drei Saisons
   leer, und die Kader werden kleiner oder schwächer. (b) Betriebsrechnung plus **Kader-Ersatz** ist im Mittel 0: der Topf
   trägt 10 % des Kaderwerts mit, die GuV bekommt eine Zeile „Kader-Ersatz“, die Geldmenge der Liga bleibt stehen.
   **Empfehlung (b).** Technisch ist es ein Schalter im Stempel.
2. **Verdrängen die neuen Einnahmen den Sponsor?** Karten, Marketing und Medaillen bringen zusammen rund 6 C je Team in
   Saison 1 und 15 C ab Saison 2. Im Vorschlag sinkt der Sponsor-Topf um diesen Betrag, damit die Liga bei 0 bleibt.
   Alternative: sie kommen obendrauf, bis die Ausrüstung als Gegenposten gebaut ist; dann heißt Faktor 1 so lange „Liga im
   Plus“. **Empfehlung: verdrängen.**
3. **Seltenheit nur noch Prestige?** Am 22.11. wolltest du, dass ein legendärer Sponsor mehr wert sein kann. Der Vorschlag
   lässt davon −3 bis +4 % übrig und legt den Rest in das Wappen und den Leih-Kurs, weil die Seltenheit heute gewürfelt ist
   und in Liga 1 bis zu 8 C je Saison verschiebt. Soll es dabei bleiben oder wieder ±11 % sein?
