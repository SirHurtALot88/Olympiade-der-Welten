# Spielerprofil und Spieler-Drawer, modern (Mockup 18.11.)

**Nur Mockup und Erklärung, kein App-Code.** Gebaut wird erst, wenn Chris „bau das“ sagt.

Klickbar: `public/mockups/spielerprofil-modern-18-11.html`
(lokal `http://localhost:3000/mockups/spielerprofil-modern-18-11.html`, auf dem Server
`https://olympiade.duckdns.org/mockups/spielerprofil-modern-18-11.html`, sobald der Branch auf `main` liegt).

Die graue Leiste oben schaltet **Ansicht** (Profil als Seite / Drawer über der Kaderliste) und **Spieler**
(Kati: Star, heiß · Krolach: Rollenspieler · Xelara: verletzt · Abe Lincoln: kalt, ohne Pixel-Figur).
Alles andere ist im Bild klickbar: die sechs Reiter im Regieband, die Pfeile neben dem Namen (↑/↓ auf der
Tastatur), jede Disziplin-Kachel, „Verlängern“ und „Verkaufen“, im Dialog die Laufzeit, an der Figur
Drehen und Pose. URL-Schalter stehen im Kommentar am Dateianfang.

**Echt** (aus `data/generated/oly-player-stats.json`, `official-discipline-weights.ts`,
`matchday-slot-roles.ts`, `legacy-lineup-modifiers.ts`): die zwölf Spieler, Portraits, Pixel-Figuren, Klasse,
Volk, Traits, zwölf Attribute mit Note, Eignung in 20 Disziplinen, Gesamtwert, Potenzial, Marktwert,
Gehaltsforderung, Matrixgewichte, Rollen je Disziplin mit Fokus-Attributen, Klassenfarbe, Kulissen.
**Erfunden:** Form, Moral und ihre Gründe, Erschöpfung, Verletzung, jeder PP-Wert, Ränge in der Liga, Duelle,
Vertragslaufzeit, Budgetfreigabe, die Zusammenstellung des Kaders.
0 PixelLab-Generationen: das Mockup nutzt nur vorhandene Figuren und Kulissen.

## Bilder (`docs/design/spielerprofil-modern-18-11/`)

| Bild | Zustand |
|---|---|
| `01`–`03-ueberblick-star-*` | Überblick, Kati (Star, heiß), 2560×1440 / 1920×1080 / 1710×1112 |
| `04-disziplinen-2560x1440`, `05-disziplinen-nebenweg-1710x1112` | 20 Disziplinen; in 05 Tennis als Nebenweg aufgeklappt |
| `06-leistung-verletzt-1920x1080` | Leistung, Xelara: schraffierter Balken und Zeile „× 50 %“, zwei gesperrte Zeilen |
| `07-entwicklung-*`, `08-vertrag-*`, `09-karriere-*` | die übrigen Reiter |
| `10`–`12-drawer-*` | Drawer über der Kaderliste, drei Bildschirme (12: verletzt) |
| `13-ueberblick-verletzt`, `14-ueberblick-kalt-ohne-figur`, `15-ueberblick-rollenspieler` | Zustände |
| `16`/`17-dialog-verlaengern-*`, `18-dialog-verkaufen` | Vorstand gibt frei / Vorstand sperrt / Verkauf |
| `19-figur-angriff-ost` | Figur in anderer Pose |
| `abgleich-ist-mockup.png` | links Ist, rechts Mockup |

Geprüft bei allen drei Zielbildschirmen per `scrollWidth/-Height` je Tafel: die Seite scrollt nicht, kein Text
läuft aus einer Tafel. Einzige gemeldete Überbreite ist das absichtlich schräg überstehende rote Band
„Verletzt“ über der Figur (wird abgeschnitten). Das Ist-Bild im Abgleich ist das vorhandene vom 16.11.
(`docs/design/ui-quickwins-16-11/nachher-spielerprofil.png`), nicht neu aufgenommen. Phone ist nicht Teil
dieses Entwurfs.

## 1. Was sich gegenüber heute ändert

Heute: `PlayerProfileClient.tsx` (262 Zeilen) reicht an `PlayerDetailDrawer.tsx` (4337 Zeilen) weiter. Dasselbe
Bauteil ist Seite **und** Overlay, mit sechs Reitern (`PLAYER_PROFILE_TABS`: Stats, Details, Vertrag,
Entwicklung, Report, Karriere), die auf einer langen Scrollseite Anker anspringen.

| Teil | Heute | Im Entwurf | Warum |
|---|---|---|---|
| Aufbau | ein Bauteil für Seite und Overlay, lange Scrollseite | **zwei Bauteile**: Seite (sechs Reiter, je ein Bildschirm ohne Scrollen) und Drawer (ein Kurzprofil ohne Reiter) | der Drawer beantwortet „wer ist das, kann er spielen, was kostet er“, die Seite alles andere; 4337 Zeilen in einem File entfallen |
| Kopf | eigener Kopf mit Portrait, eigene Reiterzeile | Name, Blättern, Reiter und Form/Moral/Status stehen im **Regieband** des App-Rahmens | gleiche Stelle wie auf jeder Seite, die ganze Höhe gehört dem Inhalt |
| Figur | kleines Portrait | **Pixel-Figur groß** auf der Kulisse ihrer besten Disziplin, drehbar, vier Posen; Portrait klein daneben | Chris: „da sieht man sogar die Models“ |
| Form | eine Zahl, Verlauf im eigenen Blatt | Pfeil, Zahl, Wirkung in Prozent, Kurve der Saison (gefüllt = Einsatz), letzte drei Leistungen gegen Erwartung | Form ist neu und soll ohne Klick lesbar sein |
| Moral | Smiley mit Text und Chips | Gesicht wie `BcMoralGesicht`, Zahl, Wirkung, bis zu vier Gründe mit Vorzeichen | dieselbe Darstellung wie Einsatzliste und Start |
| Verletzung | Risiko-Kachel, Abzug in Prozent | rote Karte „Verletzt · nicht einsetzbar · noch N Spieltage“, Tagesleiste bis zur Rückkehr, rotes Band über der Figur, Status im Regieband und in der Liste | Regel vom 18.11.: verletzt ist kein Formabzug |
| Leistung | PPS-Kacheln, „keine gespeicherten Season-PPs“ | **Player Points** als Balken je Spieltag (zwei Disziplinen, Farbe = Achse, Linie bei 5), Rang am Spieltag, Rang in Liga 2 / beiden Ligen / Kader, Einsatztabelle mit Duell-Ergebnis | PP ist das Leistungsmaß, Skala „Top ≈ 5“ |
| Disziplinen | vier Achsenkarten mit je fünf Zeilen, darunter Tabelle „Top-Disziplinen“ | 20 Kacheln in vier Achsenspalten mit Kaderrang, bester Rolle, PP, Duellen; rechts „Warum 77,3“ | eine Ansicht statt zwei, und sie erklärt die Zahl |
| Experte | nicht vorhanden | „Hier ist Kati Experte“: vier beste Disziplinen mit **Primärweg / Nebenweg** | „mehrere Wege zum Erfolg“ wird sichtbar |
| Vertrag | Gehalt je Saison, Verlauf | Gehalt **je Spieltag**, 20 Raten als Leiste, Vergleich im Kader, drei Entscheidungen mit Vorstand-Budgetfreigabe | Finanzkonzept V2 |
| Report (Scouting) | eigener Reiter | entfällt als Reiter: Potenzial steht in „Entwicklung“, verdeckte Werte fremder Spieler zeigt jede Tafel an ihrer Stelle | siehe Frage 4 |

## 2. Die Reiter

1. **Überblick.** Links die Figur. Mitte oben drei Zustandskarten (Form, Moral, Einsatzfähigkeit), darunter
   die zwölf Attribute in vier Achsen und „Experte in“. Rechts Player Points und Vertrag. Dieser eine
   Bildschirm reicht für die meisten Besuche.
2. **Disziplinen.** 20 Kacheln, je Achse eine Spalte, nach Eignung sortiert. Die Achsenfarbe ist zugleich die
   Formkarten-Farbe; die Spalte in der Klassenfarbe des Spielers trägt „seine Farbe“. Klick auf eine Kachel
   erklärt rechts die Zahl: Gewicht aus der Matrix, sein Attributwert, Beitrag; darunter die sechs Rollen
   der Disziplin mit Passung und die ersten fünf des Kaders.
3. **Leistung.** PP je Spieltag groß, Saisonzahlen, Rang-Verlauf, PP nach Achse, Einsatztabelle
   (Rolle, Erwartung → Leistung, PP, Rang am Spieltag, Duell S/U/N mit 2/1/0, Form danach).
4. **Entwicklung.** Je Attribut Start der Saison → heute → Decke, Potenzial, Training, Verletzungen.
5. **Vertrag.** Gehalt je Spieltag mit Ratenleiste, Marktwert-Verlauf mit Treibern, Entscheidungen.
6. **Karriere.** Eine Zeile je Saison (mit Liga), Geschichte (`flavorDe`), Meilensteine.

**Drawer.** Öffnet aus jeder Liste, bleibt offen, während man mit ↑/↓ durch die Liste geht. Zeigt Figur,
drei Kennzahlen, Statuszeile, Form und Moral, alle 20 Disziplinen als Kacheln (Eignung, Kaderrang), PP-Balken,
letzte zwei Einsätze. Unten „Verlängern“, „Verkaufen“, „Merken“ und „Ganzes Profil öffnen“. Klick auf eine
Disziplin springt in die Seite, Reiter Disziplinen.

## 3. Fünf Kernentscheidungen

1. **Seite und Drawer sind zwei Bauteile.** Der Drawer ist ein Kurzprofil ohne Reiter, die Seite hat sechs
   Reiter, jeder passt auf einen Bildschirm.
2. **Die Figur ist die Hauptsache links**, auf der Kulisse der besten Disziplin, mit Drehen und den vier
   vorhandenen Posen (Stand, Lauf, Angriff, Treffer). Keine neue Animation. Nur 362 von 2984 Spielern haben
   eine Figur; alle anderen zeigen an derselben Stelle das Portrait groß (Bild 14).
3. **Zustand vor Zahlen.** Form, Moral und Einsatzfähigkeit stehen oben als drei gleich gebaute Karten und
   zusätzlich im Regieband. Verletzt färbt Karte, Band, Figur, Listenzeile und Drawer rot.
4. **Jede Eignung erklärt sich aus der Matrix.** „Primärweg“ heißt: das Attribut mit dem höchsten
   Matrixgewicht ist auch seine Stärke. „Nebenweg“: er kommt über ein anderes Attribut auf seinen Wert
   (Kati in Tennis über Spirit 88, obwohl Intelligence am meisten zählt). Die Matrix bleibt unangetastet,
   die Ansicht liest sie nur.
5. **Geld je Spieltag, Vorstand als Freigabe.** Gehalt steht überall je Spieltag. Verlängern und Verkaufen
   zeigen vor dem Klick, ob der Vorstand das freigibt; sperrt er, ist der Knopf grau und sagt warum
   (Bild 17).

## 4. Datenquellen je Element

„Gibt es“ = Feld oder Funktion steht heute im Code. „Neu“ = muss gebaut werden.

| Element | Quelle | Stand |
|---|---|---|
| Name, Klasse, Volk, Traits, Portrait, `flavorDe` | `PlayerDetailDrawerData` aus `lib/foundation/player-detail-drawer.ts` (`buildPlayerDrawerDataFromGameState`) | gibt es |
| Pixel-Figur, Posen, Richtungen | `lib/data/figurenSprites.ts` + `data/generated/figuren-sprites.json`, Dateien `public/sprites/figuren/<slug>/` | gibt es; neu ist nur ein kleines Abspiel-Bauteil für die Seite |
| Kulisse hinter der Figur | `public/sprites/kulissen/<disziplin>/`, `BcHeroKulisse.tsx` | gibt es (Takeshi hat noch keine Kulisse) |
| Zwölf Attribute mit Note, Achsenwerte | `attributeStats`, `axisCards`, `attributeVisibility` | gibt es |
| Eignung je Disziplin, Saison-PP, Einsätze, Rollenlabel | `disciplineValues[]` (`value`, `seasonPoints`, `seasonAppearances`, `slotLabels`) | gibt es |
| Kaderrang je Disziplin | Rang über den eigenen Kader | **neu** (kleine Ableitung; `tests/player-detail-drawer-discipline-rank-override.test.ts` zeigt, dass es einen Liga-Rang schon gibt) |
| Matrixgewichte, Beitrag je Attribut | `officialDisciplineWeightTable` in `official-discipline-weights.ts`; `spiel-eignung-overrides.ts` beachten (Football) | gibt es, Anzeige neu |
| Rollen und Fokus-Attribute, beste Rolle | `lib/lineups/matchday-slot-roles.ts` | Rollen gibt es; die „Passung“ im Mockup ist das Mittel der zwei Fokus-Attribute und **erfunden**, im Bau die Platzwert-Funktion der Einsatzliste nehmen |
| Primärweg / Nebenweg | aus Matrix und Attributen abgeleitet | **neu**, reine Anzeige-Logik |
| Klassenfarbe = Formkarten-Farbe | `getPlayerClassColor`, `getFormCardColorForDisciplineCategory` in `legacy-lineup-modifiers.ts` | gibt es |
| Form (Wert, Stufe, Wirkung) | `playerFormState[]`, Regeln `lib/morale/form-moral-regeln.ts` | gibt es |
| Form-Verlauf, Leistung gegen Erwartung | `playerFormState[].verlauf` (Form davor/danach, Einsatz, Leistungs- und Erwartungs-Perzentil, Disziplin, Bremse) | gibt es, nur laufende Saison |
| Moral, Gründe, Wirkung | `morale` in `PlayerDetailDrawerData` (`assessPlayerMorale`), Gesicht `BcMoralGesicht.tsx`, `lib/morale/moral-anzeige.ts` | gibt es |
| Erschöpfung, Verletzungsrisiko | `fatigue`, `availability.injuryRiskPercent` | gibt es |
| Verletzt, nicht einsetzbar, noch N Spieltage | `availability.isUnavailable`, `injuryUntilMatchday`, `injuryHistoryRows` (mit Disziplinen) | Felder gibt es; die Regel „nicht einsetzbar, 50 % in der Verletzungs-Disziplin“ liegt als Text auf Branch `claude/claude-md-finanzregeln-18-11`, Umsetzung laut `docs/design/verletzung-regel-18-11.md` noch nicht auf `main` |
| PP je Spieltag und Disziplin, Rang am Spieltag | Spieltagsergebnisse je Spieler | **neu als Reihe**: heute liefert der Drawer Saison- und Allzeit-Summen je Disziplin, keine Reihe je Spieltag und keinen Tagesrang |
| PP-Rang in Liga, beiden Ligen, Kader | `ppsRank` (ein Rang) | Liga-Split-Ränge und Kaderrang **neu** |
| PP-Skala „Top ≈ 5“ | Regel vom 18.11. | **offene Neueichung**; die Linie bei 5 im Mockup ist das Ziel, nicht der heutige Stand |
| Duelle mit ihm (S-U-N, 2/1/0) | `lib/resolve/battle-mode-pps-duell.ts`, `lib/season/saisonstand-modern-logik.ts` | Team-Duelle gibt es; Zuordnung „er war aufgestellt“ **neu** |
| Gehalt, Laufzeit, Staffel, Kaufpreis, Marktwert | `salary`, `contractLength`, `yearlySalarySchedule`, `purchasePrice`, `marketValue` | gibt es |
| Gehalt je Spieltag, Ratenleiste | Jahresgehalt ÷ 20 | Anzeige sofort möglich; **gebucht** wird je Spieltag erst mit Finanzkonzept V2 Stufe „Kasse je Spieltag“ |
| Marktwert-Verlauf in der Saison | `PlayerDrawerHistoryRow.marketValue` je Saison | Reihe je Spieltag **neu** |
| Forderung bei Verlängerung | `ContractRenewalNegotiationModal.tsx`, `contract-renewal-service.ts`, `morale.salaryModifier` | gibt es; die Faktoren im Mockup sind erfunden |
| Vorstand-Budgetfreigabe | `boardTrust` (Vertrauen, `renewalPolicy`, `salaryCapMultiplier`) | Vertrauen gibt es; „nur X % des Budgets“ ist **neu** (Finanzkonzept V2, Abschnitt 5.7, Regel vom 18.11.) |
| Verkauf: Erlös, Abschlag in den Liga-Topf | `projectedSellValue` in der Historie, Liga-Topf im Finanzkonzept | Erlös gibt es, Liga-Topf **neu** |
| Entwicklung: Attribut-Zuwachs, Decke, Prognose | `baselineAttributeDeltas`, `attributeCeilingPreview`, `seasonOrganicForecast`, `developmentInsight` | gibt es |
| Karriere-Zeilen mit Liga | `PlayerDrawerHistoryRow` (`leagueTier`, `appearances`, `pps`, `ppsRank`, …), `PlayerDrawerHistoryTable.tsx` | gibt es |
| Kaderrolle Star / Stammspieler / Rollenspieler / Ergänzung | Mockup-Regel: Star = Top 3 nach Marktwert (wie Finanzkonzept, Starfaktor), sonst Zahl der Disziplinen unter den ersten vier im Kader | **neu**, siehe Frage 3 |

## 5. Bau-Reihenfolge (Sonnet, kleine PRs)

Voraussetzung: der App-Rahmen (Regieband mit Seiten-Slot) steht, sonst baut die Seite wieder einen eigenen Kopf.

1. **Datenschicht.** Aus `PlayerDetailDrawerData` ein schlankes Anzeigemodell schneiden; neu dazu Kaderrang
   je Disziplin, Weg (Primär/Neben), PP-Reihe je Spieltag mit Tagesrang, Liga-Split-Ränge. Mit Tests.
2. **Figuren-Bühne** als eigenes Bauteil (`bc-`-Stil): Figur, Kulisse, Drehen, Posen, Portrait-Ersatz.
3. **Seite, Reiter Überblick** als neue Komponente mit eigenem CSS; Titel, Reiter und Slot ins Regieband.
4. **Reiter Disziplinen** mit Erklär-Tafel.
5. **Reiter Leistung.** Hängt an der PP-Reihe aus Schritt 1 und an der PP-Neueichung.
6. **Reiter Entwicklung und Karriere** (Daten vorhanden, vor allem Umbau der Darstellung).
7. **Reiter Vertrag** mit den zwei Dialogen. Die Budgetfreigabe zeigt zunächst nur das vorhandene
   Vorstandsvertrauen; die echte Sperre folgt mit der Finanz-Mechanik.
8. **Drawer** als zweites, kleines Bauteil; alle Listen öffnen ihn.
9. **Alt raus:** `PlayerDetailDrawer.tsx`, `PlayerHeroNewLook`, die `player-`-Klassen in `globals.css`,
   die alten Vertragstests auf die neuen Bauteile umziehen.

## 6. Offene Fragen für Chris

| # | Frage | Empfehlung |
|---|---|---|
| 1 | „50 % in der Verletzungs-Disziplin“: gilt das für die **Wertung des Spiels, in dem er sich verletzt** (so im Mockup: 3,4 → 1,7 PP), oder für spätere Einsätze in dieser Disziplin? | Für das Spiel der Verletzung. Danach ist er ohnehin gesperrt. |
| 2 | Drawer ohne Reiter, nur Kurzprofil mit „Ganzes Profil öffnen“? | Ja. Zwei kleine Bauteile statt eines großen. |
| 3 | Kaderrolle als Wort am Spieler (Star, Stammspieler, Rollenspieler, Ergänzung)? | Ja, mit der Regel aus Abschnitt 4. Hilft beim Lesen des Kaders und passt zum Starfaktor der Finanzen. |
| 4 | Reiter „Report“ (Scouting) streichen und verdeckte Werte fremder Spieler direkt in den Tafeln zeigen? | Ja. Für fremde Spieler ein eigener Zustand der Seite; den zeichne ich nach deinem OK nach. |
| 5 | Gilt die Budgetfreigabe auch für Verkaufserlöse (im Mockup: 80 % sofort für Transfers nutzbar, 20 % Rücklage) und für Gehaltserhöhungen bei Verlängerungen? | Für beides, weil sonst die Sperre mit einem Verkauf umgangen wird. Entscheidung gehört ins Finanzkonzept. |
| 6 | Figur-Posen im Profil anklickbar (Lauf, Angriff, Treffer)? Kostet nichts, nutzt nur Vorhandenes. | Ja. Tod-Pose bewusst weggelassen. |
| 7 | Pixel-Figuren für die übrigen Spieler: 362 von 2984 haben eine. | Nichts bestellen. Deine Idee vom 17.11. (Figuren nur für tatsächlich gepickte Spieler) passt; bis dahin Portrait. |

## 7. Bekannte Grenzen des Mockups

- Der gezeigte Kader ist für das Bild zusammengestellt (die sechs aus dem Rahmen-Mockup plus sechs mit Figur).
- „Passung“ der Rollen, alle Faktoren der Gehaltsforderung, der Verkaufsabschlag von 15 % und die 80 %
  Freigabe sind Platzhalter, keine Regeln.
- Die Eignungszahl ist der echte Wert aus dem Katalog; die Beitragsspalte rechnet nur Attribut × Matrixgewicht
  und summiert sich deshalb nicht exakt auf die Eignung (Slot, Trait und Form kommen im Spiel dazu).
- Der Zustand „fremder Spieler mit verdeckten Werten“ und die Vergleichsansicht sind nicht gezeichnet.
