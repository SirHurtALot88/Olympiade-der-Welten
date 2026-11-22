# Formkarten Plus/Minus (22.11., Arbeitsliste 21.11. Welle 4)

Auftrag: „Formkarten: keine 0er, jede Karte ±; Karten-Wirkung zeigt negative; KI setzt Formpunkte gezielt (Siege, Rivalen, Reserve); Formpunkte im Saisonstand/Gegneranalyse."
Stand 22.11. (nach Chris' Entscheidungen, Abschnitt 6): gebaut mit Spielstand-Stempel `seasonState.formkartenRegel`, Kartenwerte **2/4/6/8**. Nicht gemergt, kein PR.

## 1. Ist-Stand

- **Karten:** jeder Spieler bekommt je Saison zwei Karten in seiner Klassenfarbe (POW rot, SPE gruen, MEN blau, SOC gelb), eine Plus- und eine Minuskarte, unabhaengig gezogen (`buildGeneratedFormCardRecordsForTeam`). Werte aus `[0, 2, 4, 8]`. **Die 0 ist tot:** `getTeamFormCardOptions` blendet 0er aus, jeder vierte Wurf liefert also keine Karte; sichtbar sind nur 2/4/8 (Mittel 4,7). Ungespielte Minuskarten kosten am Saisonende Tabellenpunkte, ungespielte Pluskarten verfallen.
- **Wirkung (Farbregel seit 18.11., eine Wahrheit `formkartenZerlegungFuerSpieler`):** alle Aufgestellten v x 0,5 (Karte in fremder Disziplinfarbe) bzw. v x 1,0 (passende Disziplinfarbe), dazu Farbtraeger (Klassenfarbe = Kartenfarbe) v x 0,5, Form-Hebel nur bei Pluskarten. Spitze +12. Minuskarten spiegelbildlich. Pro Seite zwei Karten, die zweite nie negativ.
- **Negatives gibt es heute schon:** jede Minuskarte wirkt negativ fuer alle. Das fehlte in der Anzeige an einer Stelle: „Alle Karten im Vergleich" (`KartenWirkungPanel`) war nach Teamsumme absteigend sortiert und auf `slice(0, 8)` gekappt, die Minuskarten fielen also weg. Der Rest der Karten-Wirkung (Zeilen, Team-Summe, Marke am Platz) zeigte Vorzeichen korrekt.
- **KI:** Saisonplan `ai-form-card-season-plan.ts` (Zuordnung Karte -> Slot ueber die Restsaison, Minuskarten zuerst ins billigste Versteck, Tauschdurchlauf, Geduld/Ausgabedruck, Wettbewerbslage `competitiveness`, `rankPointSwing`). Der Plan kannte weder Rivalen noch knappe Duelle; Rivalen wurden nur fuer Team-Powers gelesen.
- **Formpunkte im Saisonstand / Gegneranalyse:** schon da (`buildSeasonFormCardBonusByTeamId` in `SeasonStandingsModern` und `EinsatzlisteGegnerTab`, Tank mit Rest/Pool/Minus). Nichts zu bauen.

## 2. Konzept „jede Karte ±" (5 Saetze)

1. Keine 0er: Kartenwerte `[2, 4, 6, 8]` (Mittel 5 statt der sichtbaren 4,7; Chris 22.11.), jeder Spieler hat wirklich ein Plus- und ein Minuskartenpaar.
2. Jede Karte hat einen Plus- und einen Minus-Teil: die Gegenfarbe (POW gegen MEN, SPE gegen SOC) traegt `-v x 0,25`; eine Pluskarte kostet also Spieler der Gegenfarbe, eine Minuskarte entlastet sie.
3. Damit wird jede Karte eine Aufstellungsentscheidung (wen stelle ich neben die Karte), nicht nur ein Bonus; die Farbregel (alle + Farbtraeger, Spitze 12) bleibt unveraendert, die Gegenfarbe zieht nur ab (Spitze fuer Gegenfarbe +6 bei v=8, passend).
4. Die KI preist die Gegenfarbe mit dem Farbanteil des eigenen Kaders ein und gewichtet den heutigen Spieltag: knappes Duell 1,25, klar vorn 1,0 (Overkill-Bremse), klar hinten 0,8, je Top-8-Rivale +0,1 (hoechstens +0,2). Pluskarten wandern auf schwere Slots, Minuskarten auf billige. Zukunft bleibt 1,0 (kein Informationsvorsprung).
5. Anzeige: Spalte Gegenfarbe in der Karten-Wirkung, Marke am Platz, Zeile in der Team-Summe, Effekttext im Dropdown, Vergleichsliste zeigt die schlechtesten drei Karten mit.

### Wertetabelle (Karte +8 bzw. -8 in fremder Disziplinfarbe, Regel PM +Gegenfarbe 0,25)

| Spieler | Pluskarte +8 | Minuskarte -8 |
|---|---:|---:|
| Farbtraeger | +8 (4 + 4) | -8 |
| neutrale Farbe | +4 | -4 |
| Gegenfarbe | +2 (4 - 2) | -2 (-4 + 2) |
| passende Disziplinfarbe, Traeger | +12 | -12 |
| passende Disziplinfarbe, Gegenfarbe | +6 | -6 |

Kartenwerte alt `[0,2,4,8]`, neu `[2,4,6,8]`. Gezeigt = gebucht: Legacy-Wertung, Einsatzliste, Arena-Adapter und KI lesen dieselbe Funktion (`kartenZerlegungFuerSpieler`); `tests/formkarten-plusminus.test.ts` prueft Einsatzliste = Motor-Eingabe je Spieler.

### Schalter und Stempel

`OLY_FORMKARTEN_PLUSMINUS=1` (Server). Er steckt im Regelstand (`FormMoralRegeln.plusMinus`, nur gesetzt wenn an), den der Lineup-Kontext schon zum Browser traegt. **Noch kein Stempel im Spielstand** (Muster `wertungs-skalen.ts`): der Prototyp liest die Umgebung. Vor dem Scharfschalten noetig: Stempel im Saisonstand, Wechsel nur zum Saisonwechsel (Kartenwerte werden beim Anlegen der Saisonkarten gezogen, bestehende Karten bleiben), sonst aendert sich die Wirkung gebuchter Aufstellungen mitten in der Saison.

## 3. Messung (Schalter an, Node-Motor, Formkarten-Modus echt)

`scripts/miss-formkarten-plusminus.mts 12` (abgeleitet von `miss-formkarten-farbregel.mts`, Hook um Gegenfarbe und Kartenwerte erweitert). Spalten: rho je Spiel (Median ueber Kaderfamilie, 12 Spiele) ohne Karte, mit der Regel von heute, nur Gegenfarbe dazu, und volles ± (ohne 0er); letzte Spalten: Anteil der Spiele, in denen der beste Spieler gegenueber „ohne Karte" wechselt (Naeherung fuer „Karte dreht das Ergebnis"; Team-Ergebnisse liefert die Sonde nicht).

| Disziplin | ohne Karte | heute (pm) | +Gegenfarbe | ± (ohne 0, +Gegenfarbe) | Sieger gedreht heute | Sieger gedreht ± |
|---|---:|---:|---:|---:|---:|---:|
| basketball | 0.837 | 0.850 | 0.840 | 0.841 | 57 % | 62 % |
| battlefield | 0.617 | 0.610 | 0.601 | 0.606 | 72 % | 85 % |
| breaking | 0.864 | 0.854 | 0.850 | 0.850 | 33 % | 35 % |
| climbing | 0.859 | 0.830 | 0.838 | 0.786 | 33 % | 38 % |
| eiskunstlauf | 0.929 | 0.914 | 0.913 | 0.911 | 20 % | 18 % |
| fechten | 0.854 | 0.867 | 0.865 | 0.867 | 15 % | 15 % |
| football | 0.863 | 0.802 | 0.808 | 0.844 | 45 % | 38 % |
| gewichtheben | 0.890 | 0.899 | 0.899 | 0.893 | 20 % | 25 % |
| hockey | 0.752 | 0.622 | 0.678 | 0.697 | 48 % | 57 % |
| i-spy | 0.812 | 0.810 | 0.809 | 0.806 | 40 % | 33 % |
| mini-dm | 0.325 | 0.133 | 0.333 | 0.315 | 55 % | 63 % |
| showcase | 0.784 | 0.814 | 0.818 | 0.793 | 17 % | 15 % |
| speed-schach | 0.922 | 0.925 | 0.919 | 0.923 | 7 % | 7 % |
| spurt | 0.916 | 0.878 | 0.875 | 0.863 | 13 % | 18 % |
| staffel | 0.958 | 0.956 | 0.959 | 0.959 | 18 % | 20 % |
| takeshis-castle | 0.818 | 0.860 | 0.834 | 0.804 | 28 % | 23 % |
| tdm | 0.901 | 0.914 | 0.908 | 0.888 | 25 % | 28 % |
| tennis | 0.882 | 0.879 | 0.881 | 0.877 | 15 % | 18 % |
| time-trial | 0.942 | 0.936 | 0.938 | 0.940 | 27 % | 33 % |
| wettessen | 0.925 | 0.933 | 0.937 | 0.928 | 13 % | 12 % |

Lesart: 12 Spiele je Variante sind knapp, Schwankungen von +-0,03 sind Rauschen. Mittel „Sieger gedreht": heute 30 %, mit ± 32 %. Die Plus/Minus-Regel aendert rho kaum (Hockey und Football sogar besser als heute, Climbing und Spurt etwas schlechter), die Werte unter 0,75 bei Battlefield (0,61), Mini-DM (0,31/0,13) und Hockey (0,70) liegen schon **ohne** Karte unter der Schranke dieser Sonde (12 Spiele, Kaderfamilie, Pod-Aufbau); sie sind kein Effekt der neuen Regel, aber ein offener Arbeitsauftrag der Abnahme (Hockey ist laut CLAUDE.md in der Vollmessung 0,67).

### Pp-Abweichung

**Nicht gemessen.** `OLY_PP=1` (einflussVon, 16 Laeufe, zwei Saatstroeme) lief fuer Tennis und Basketball ueber 30 Minuten CPU ohne Ergebnis und wurde abgebrochen. Die Karten gehen im Motor als `form` je Spieler ein; Mittelwert ueber die Spiele bleibt gleich (die Gegenfarbe verschiebt nur Anteile zwischen Klassen), die Pp-Abweichung ist deshalb kein grosser Ausschlag, aber **offen** und vor dem Scharfschalten nachzumessen (`OLY_PP=1 OLY_PP_LAEUFE=48 npx tsx scripts/miss-formkarten-plusminus.mts 6 out.json <disziplin>`).

### Aufnahmen

**Nicht erstellt.** Der Save-Bau der Einsatzliste-Optik-Pipeline (`scripts/screenshot-einsatzliste-optik.ts bau`, 12 Spieltage Auto-Run) lief ueber 25 Minuten ohne Abschluss und wurde abgebrochen; die Anzeige ist durch Tests (Zerlegung, Gegenfarbe, Vergleichsauswahl, Motor-Eingabe) abgedeckt, aber nicht optisch abgenommen. Nachholen: `flock /tmp/oly-aufnahme.lock` mit `OLY_FORMKARTEN_PLUSMINUS=1`, Ziel `docs/design/formkarten-plusminus-22-11/`.

### Wie oft drehen KI-Karten Ergebnisse?

Nicht direkt messbar mit der Sonde (kein Team-Ergebnis, keine KI-Aufstellung im Motor). Naeherung: Karten drehen den besten Spieler eines Spiels in 7 bis 85 % der Spiele (Battlefield 72-85 %, Basketball 57-62 %, Hockey 48-57 %, Speed-Schach 7 %). Der KI-Plan selbst (Slot-Auswahl, Duell-Gewicht) ist per Test deterministisch belegt, eine Saison-Simulation mit und ohne Gewicht steht aus.

## 4. Geaendert

- `lib/lineups/formkarten-farbregel.ts` (Gegenfarbe, `FARBREGEL_PM_PLUSMINUS`, `GEGENFARBE`, Schalter), `legacy-lineup-modifiers.ts` (Kartenwerte), `formkarten-wirkung.ts`, `lib/morale/form-moral-regeln.ts` (Regelstand).
- KI: `ai-form-card-season-plan.ts` (`gewicht`, `duellGewicht`, Gegenfarbe im Slot-Wert), `ai-legacy-lineup-batch-apply-service.ts`.
- Anzeige: `FormMoralBausteine.tsx` (Gegenfarbe, `vergleichAuswahl` zeigt Minuskarten auch **ohne** Schalter), `EinsatzlisteKartenHand.tsx`, `EinsatzlisteModern.tsx`, `form-moral.css`.
- Messung/Test: `scripts/miss-formkarten-plusminus.mts`, `scripts/lib/formkarten-farbregel-hook.mjs`, `tests/formkarten-plusminus.test.ts`.

## 5. Offene Entscheidungen fuer Chris

1. Soll die Gegenfarbe (POW/MEN, SPE/SOC, Faktor 0,25) kommen, oder lieber „Erschoepfung" (Karte kostet den Spieler, der sie gelegt hat)?
2. Kartenwerte `[2,3,5,8]` statt `[0,2,4,8]` ok?
3. Scharfschalten nur zum Saisonwechsel mit Stempel im Spielstand?
4. Die Vergleichsliste mit sichtbaren Minuskarten gilt ab sofort auch ohne Schalter (reine Anzeige).
