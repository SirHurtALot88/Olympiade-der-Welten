# Historie modern (Fable, 18.11.) — Mockup und Erklärung

Anlass, Chris am 18.11.: „Die Historie ist noch nicht neu gemacht mit Mockup, das sieht man sofort.“ Die
Historie-Seiten stehen neben Saisonstand, Einsatzliste, Finanzen und Spieltagswertung noch im alten Aussehen.

Dies ist ein Entwurf. `app/`, `components/`, `lib/` und der Motor sind nicht angefasst. 0 PixelLab-Generationen,
alles CSS/SVG plus vorhandene Bilder (Wappen, Portraits, Kulisse im Regieband).

## Ansehen

| Was | Datei |
|---|---|
| Mockup, klickbar | `public/mockups/historie-modern-18-11.html` |
| Bilder 1920×1080 und 2560×1440 | `docs/design/historie-modern-18-11/` |

Läuft per Doppelklick ohne Server, über den Dev-Server unter `/mockups/historie-modern-18-11.html`. Die graue
Leiste oben gehört nicht zum UI; sie schaltet Seite, Saison, Blatt und Zustand. Dasselbe per Adresse:
`?seite=archiv|transfers|ewig|spielplan|ranks`, `?saison=1|2|3|4|alle`, `?team=V-W` (Blatt), `?spalten=sport|geld`,
`?fokus=punkte|medaillen|marktwert|kasse`, `?ranks=staerke|pp`, `?liga=1|2|alle`, `?leer=1` (neuer Spielstand),
`?still=1` (ohne graue Leiste).

Ein Durchlauf zum Klicken: Saison-Archiv → in der Zeitleiste Saison 2 → Umschalter „Geld“ → Klick auf ein Team
(Blatt rechts, Esc schließt) → im Blatt „Alle Transfers“ → Zeitleiste „Kaderaufbau“ → Reiter „Ewige Tabelle“ →
Schiene „Spielplan“ und „Ranks“.

| Bild | Zustand |
|---|---|
| `01-archiv-saison3` | Saison-Archiv: Zeitleiste, Liga 1 und Liga 2 nebeneinander, Kürze / Kletterer / Zeugnis |
| `02-archiv-saison2-geld` | dieselben Tabellen mit den Geldspalten |
| `03-archiv-blatt-team-verlauf` | Blatt rechts: Verlauf eines Teams über beide Ligen |
| `04-transfers-fenster-saison3` | Transferfenster vor Saison 3: Bilanz je Team, Deals, Höhepunkte, Deal im Blick |
| `05-transfers-kaderaufbau-saison1` | Kaderaufbau aus dem Startbudget, getrennt von Transfers |
| `06-transfers-alle-fenster` | alle Fenster zusammen, nach Fenster gruppiert |
| `07-ewige-tabelle-punkte`, `08-ewige-tabelle-titel` | Ewige Tabelle, zwei der vier Sichten |
| `09-spielplan` | Spielplan in derselben Sprache |
| `10-ranks-teamstaerke`, `11-ranks-pps-pro-bereich` | Ranks: Matrix und PPs pro Bereich |
| `12-neuer-spielstand-archiv`, `13-neuer-spielstand-kaderaufbau` | Saison 1 läuft, noch kein Archiv |
| `14-mit-mockup-leiste` | Ansicht mit grauer Leiste |

Geprüft bei beiden Größen und allen 14 Zuständen (Playwright, eine Chromium-Instanz, deviceScaleFactor 1): die
Seite scrollt nicht, keine Karte, Kopfzeile, Fußzeile oder Tabellenzeile läuft über (`scrollWidth/-Height` gegen
`clientWidth/-Height`), kein Skriptfehler, alle Bilder geladen. Lange Listen (Deals, Kaderaufbau, Bilanz je Team,
Ewige Tabelle, Disziplinen, Ranks „Beide 1–32“) scrollen in ihrer Karte. Phone ist nicht Teil dieses Entwurfs.

**Echt:** Teamnamen und Wappen, Spieler mit Klasse, Marktwert und Gehalt (`data/generated/oly-player-stats.json`),
Portraits, die 20 Disziplinen mit Achse und Spielerzahl (`lib/data/dataAdapter.ts`), 3 Auf- und 3 Absteiger
(`RELEGATION_COUNT`), die Spalten der heutigen Seiten, die Buchungsregel aus PR #1634.
**Erfunden:** jede Zahl, jede Platzierung, jeder Deal, die Reihenfolge im Kaderaufbau, welcher Mutator an welcher
Disziplin hängt, die Sitze Chris / Franky / Ramona. Alles wird aus einer festen Saat gerechnet, damit Tabellen,
Zeitleiste, Blatt und Bilanzen zueinander passen (die Transferbilanz im Archiv ist die Summe der Deals im Fenster).

## 1. Aufbau

**Ein Schienenpunkt „Historie“** (Gruppe Welt) mit drei Unterreitern im Regieband: Saison-Archiv, Transfers, Ewige
Tabelle. Heute liegt die Transferhistorie unter „Markt“ und die Ewige Tabelle unter „Team“. **Spielplan und Ranks**
bleiben eigene Schienenpunkte, weil sie die laufende Saison zeigen; sie sprechen aber dieselbe Tabellen-Sprache.

App-Rahmen wie in `app-rahmen-modern-18-11.md`: kein eigener Seitenkopf, Unterreiter im Band, Kennzahlen im
Band-Slot, kein Seitenscrollen.

### Die Saison-Zeitleiste

Ein Streifen über Archiv und Transfers. Fenster und Saisons wechseln sich ab, in der Reihenfolge, in der sie
passieren:

`Kaderaufbau → Saison 1 → Fenster vor Saison 2 → Saison 2 → Fenster vor Saison 3 → Saison 3 → Fenster vor Saison 4 → Saison 4 (läuft)`

Damit ist die Regel aus PR #1634 sichtbar statt erklärt: das Fenster steht **vor** seiner Saison und zählt zu ihr.
Im Archiv sind die Saisons breit (Meister, eigener Platz mit Liga, ▲/▼) und die Fenster schmal; im Reiter Transfers
ist es umgekehrt (Zahl der Deals, eigenes Netto). Ein Klick auf das jeweils schmale Glied wechselt den Reiter.

### Saison-Archiv

- **Liga 1 und Liga 2 nebeneinander**, je 16 Zeilen ohne Scrollen. Zonen am linken Rand: Gold Meister, Rot Platz 14
  bis 16 (Abstieg), Grün Platz 1 bis 3 der Liga 2 (Aufstieg), dazu die Marke am Teamnamen.
- Umschalter **Sport / Geld** statt einer überbreiten Tabelle. Sport: Punkte, POW, SPE, MEN, SOC, Startplatz, ±.
  Geld: Kasse, Gehalt, Marktwert, GuV, Transfers. Das sind die Felder aus `FoundationSeasonHistoryTeamEntry`.
- Rechts: **Saison in Kürze** (Meister beider Ligen, Auf- und Absteiger als Wappen), **Kletterer & Absturz**
  (Startplatz gegen Endplatz, je sechs), **Dein Saison-Zeugnis** (der Satz aus `buildSeasonRecap`).
- Die laufende Saison ist wählbar und zeigt den Zwischenstand, ohne Zonenmarken.

### Transfers

- **Kaderaufbau getrennt von Transfers.** Das erste Glied der Zeitleiste heißt „Kaderaufbau · kein Transfer“. Es
  hat eine eigene Ansicht: Startbudget je Team (Balken = im Kader gebunden, Zahl = Kasse zum Start), die Picks nach
  Runde, „Preis − Marktwert“. Im Band steht „Transferbilanz —“. In „Alle Fenster“ zählt der Kaderaufbau nicht mit,
  ein Hinweis mit Sprung sagt das. Im Archiv und im Blatt bleibt die Transferbilanz der Saison 1 „—“.
- **Deals** als eine Liste je Fenster: Zeit (Ende der Vorsaison, vor Spieltag 1, Spieltag n), Spieler, Art, Von → An,
  Ablöse, Gehalt, MW, GuV, Quelle. Filter in der Kartenleiste: Art, Klasse, Quelle, Spielersuche; das Team filtert
  ein Klick links. Sortieren über die Spaltenköpfe. Eigene Deals sind golden hinterlegt.
- **Bilanz je Team** links: Ausgaben und Einnahmen als geteilter Balken, Netto als Zahl, eigenes Team oben.
- **Höhepunkte** (Käufe, Verkäufe, Gewinne) und **Deal im Blick** rechts, mit Aufpreis (Ablöse minus Marktwert).

### Ewige Tabelle

- Vier Sichten wie heute, die fünfte („Verlauf je Saison“) steht jetzt **immer** als Kachelreihe S1 bis S4 in der
  Zeile: Platz in der Liga, Farbe = Liga, Gold = Meister, Ecke ▲/▼ = Auf- oder Abstieg, gestrichelt = läuft.
- Filter Alle 32 / Liga 1 / Liga 2, Sortieren über die Spaltenköpfe.
- Rechts **Entwicklung**: eigenes Team gegen die ewige Spitze, Platz über beide Ligen (Liga 2 zählt ab Platz 17)
  oder Punkte, Marktwert, Kasse, Teamwert. Darunter **Auf und ab**: wer an welcher Saisongrenze die Liga gewechselt hat.

### Blatt rechts: Team-Verlauf

Ein Klick auf ein Team öffnet es, auf jeder der fünf Seiten: Titel, Aufstiege, Abstiege, bester Platz, die Kurve
über beide Ligen, Saison für Saison (Liga, Platz, Punkte, Kasse, Marktwert, Transfers), die größten Deals, Sprünge
ins Teamprofil und zu „Alle Transfers“ dieses Teams.

### Spielplan und Ranks

Das Muster trägt beide, sie sind deshalb ausgebaut und nicht nur skizziert.

- **Spielplan:** 20 Spieltage als Kacheln (D1/D2 mit Achsenfarbe, Gegner als Wappen, eigenes Ergebnis, „heute“
  golden), rechts die Disziplin-Tabelle (Reihenfolge, Achse, Spieler, Mutator 1/2) mit Achsenfilter. Saisonwahl S1
  bis S4. Der Saison-Chip im Band führt hierher.
- **Ranks:** Unterreiter „Teamstärke“ (Matrix Team × 20 Disziplinen, Achsenband, Teamranks TOT/POW/SPE/MEN/SOC,
  eigene Zeile golden, Liga 1 / Liga 2 / Beide 1–32, Saisonwahl) und „PPs pro Bereich“ (Balkenrangliste, Dein Team,
  Abstand zu #1, Spannweite, Noch zu vergeben).

## 2. Abgleich: heute, neu, entfällt

| Seite | Heute da und im Mockup erhalten | Neu | Entfällt oder wandert |
|---|---|---|---|
| Saison-Archiv | Daten aus `foundation-season-history-projection.ts`; heute verteilt auf die Saisonwahl im Saisonstand, den Saison-Rückblick (Zeugnis, Kletterer & Absturz) und die Verlaufskarte im Teamprofil | eigene Seite, Zeitleiste, beide Ligen nebeneinander, Zonen, Sport/Geld, Saison in Kürze | nichts; die drei heutigen Stellen können bleiben |
| Transferhistorie | Kennzahlen Deals, Ausgaben, Einnahmen, Netto, Ø Ablöse, Ø GuV; Filter Saison, Team, Typ (Käufe, Verkäufe, Abgänge), Klasse, Quelle, Spieler; Top-Käufe, Top-Verkäufe, Beste Gewinne; Teambilanz mit Sortierung Volumen, Erlös, Netto; Deal-Spotlight mit Marktwert-Verlauf; CSV; Spalten Zeit, Spieler, Move, Teams, Fee, Gehalt, MW, GuV, Quelle | Kaderaufbau als eigene Ansicht, Fenster in der Zeitleiste, Aufpreis, Gruppierung nach Fenster | Umschalter Timeline/Tabelle (eine Liste); Seitenblättern in „Alle Seasons“ (Liste scrollt in der Karte); Karte „Deals & Bilanz je Season“ (steht in der Zeitleiste); Achsenprofil im Spotlight (steht im Spielerprofil); Zeile „Spielstand aktiv / geladen 100 von 122“ |
| Ewige Tabelle | vier Sichten mit allen Spalten (Saisons, Punkte, Ø Punkte, Ø Rang, Best, Gold, Silber, Bronze, Top 5, Top 10, MW jetzt, Peak, +/−, %, Cash jetzt, Peak, Teamwert); Kennzahlen Ewiger Leader, Meiste Titel, Größtes MW-Wachstum, Cash-Peak; Entwicklungsgrafik mit fünf Kennzahlen; Liga je Saison | Verlauf als Kacheln in jeder Sicht, Spalten Aufstiege und Abstiege, Liga-Filter, „Auf und ab“ | eigener Reiter „Verlauf je Saison“; Medaillen als Emoji (jetzt Wort und Farbe) |
| Spielplan | Spieltag-Ablauf mit D1/D2 und Achsenfarbe, Disziplin-Tabelle (Reihenfolge, Disziplin, Spieler, Mutator 1/2), Kategorie-Filter, Kennzahlen | Gegner und eigenes Ergebnis je Spieltag, Saisonwahl, „Spieltag n und m“ je Disziplin | Spalte „Original“ (fester Draftboard-Platz), Schalter „Technische Details (Quelle, Seed)“, Kennzahl „Ohne Mutator“ |
| Ranks | Matrix mit Teamranks und 20 Disziplinen, Achsengruppen, Saisonwahl, Liga-Filter mit 1–32; PPs pro Bereich mit Gesamt/POW/SPE/MEN/SOC, Spannweite, Dein Team, Abstand zu #1, Noch zu vergeben | Kennzahlen stärkste und schwächste Disziplin im Band | Spalten-ein/aus-Schalter der Matrix (alle 25 Spalten passen ohne Scrollen) |

## 3. Was der Bau braucht

| Baustein | Quelle | Stand |
|---|---|---|
| Endtabellen je Saison und Liga, Start, ±, Achsenpunkte, Kasse, Gehalt, MW, GuV, Transferbilanz, `leagueTier` | `foundation-season-history-projection.ts` | vorhanden |
| Auf- und Absteiger je Saisongrenze | `league-history.ts` (`promotedTeamIds`, `relegatedTeamIds`) | vorhanden, muss in die Kurzfassung für den Browser |
| Deals mit Fenster-Zuordnung, GuV, Quelle | `use-history-v2-derivations.ts`, `transfer-window-zuordnung.ts` | vorhanden |
| Kaderaufbau als eigene Art (Pick, Runde, Preis aus dem Startbudget) | Buchungsregel aus PR #1634 | Trennung laut PR #1634; Pick-Nummer und Runde nur, wenn der Draft sie speichert |
| Ewige Tabelle | `lib/foundation/all-time-table.ts` | vorhanden; Zähler Aufstiege/Abstiege neu |
| Spielplan mit Gegner und Ergebnis je Spieltag | `season-discipline-schedule.ts` plus Spieltagsergebnisse | Zusammenführung neu |
| Zeitleiste, Blatt, Tabellen-Bausteine | `components/foundation/broadcast/` (`BcSheet`), Tabellen aus dem Saisonstand | Zeitleiste neu, Rest vorhanden |

## 4. Offene Fragen an Chris

| # | Frage | Empfehlung |
|---|---|---|
| 1 | **Ein Schienenpunkt „Historie“ mit drei Reitern** (Archiv, Transfers, Ewige Tabelle) statt der heutigen zwei Punkte unter „Markt“ und „Team“? | **Ja.** Alle drei beantworten „was war“, die Zeitleiste verbindet sie, und die Schiene wird um einen Punkt kürzer. |
| 2 | **Spielplan und Ranks** als eigene Schienenpunkte behalten oder als Reiter in Saisonstand bzw. Historie legen? | **Eigene Punkte behalten.** Beide zeigen die laufende Saison und werden mehrmals je Saison gebraucht; der Saison-Chip im Band führt zusätzlich zum Spielplan. |
| 3 | **Meistertitel:** zählt nur Platz 1 der Liga 1 als Titel, oder bekommt der Erste der Liga 2 einen eigenen Titel? | **Nur Liga 1 ist „Meister“.** Der Erste der Liga 2 heißt „Meister Liga 2“ und zählt als Aufstieg, nicht als Gold; so steht es heute schon im Kommentar zu `leagueTier`. |
| 4 | **Ewige Rangfolge:** nach kumulierten Punkten wie heute, obwohl Punkte in Liga 2 leichter zu holen sind? | **Punkte behalten**, aber „Ø Platz“ und „Bester Platz“ über beide Ligen rechnen (Liga 2 ab Platz 17). So bleibt die Tabelle wie gewohnt und die Liga ist trotzdem sichtbar. |
| 5 | **Kaderaufbau im Detail:** jede der 352 Zeilen mit Pick-Nummer und Runde zeigen, oder nur die Summe je Team? | **Alle Zeilen**, wenn der Draft Pick und Runde speichert; sonst dieselbe Liste nach Team gruppiert ohne Pick-Nummer. Die Trennung von den Transfers gilt in beiden Fällen. |
