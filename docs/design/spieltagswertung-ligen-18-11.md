# Spieltagswertung: beide Ligen getrennt (18.11.)

Auftrag (Chris, 18.11.): „Die Spieltagswertung sollte die beiden Ligen separiert voneinander zeigen!“

## Was gebaut ist

- **Ansicht „Beide Ligen“** ersetzt „Alle 32“ und ist der Start, sobald der Spielstand eine Ligatrennung hat. Zwei Blöcke nebeneinander, jeder mit eigener Überschrift („Liga 1“, „Liga 2“ wie im Saisonstand, dazu „n Teams“) und eigener Rangfolge **1..16**. Es gibt keine gemeinsame 1..32-Liste mehr.
- **Eigene Liga zuerst** (links) und mit goldenem Rand und Marke „Deine Liga“; das eigene Team behält die Zeile mit „Du“. Ein Team ohne Liga-Zuordnung würde (wie im Saisonstand) in einen dritten Block „Ohne Liga-Zuordnung“ kommen, statt zu verschwinden.
- **Rang je Liga**: neues Feld `ligaRang` in `spieltagswertung-zeilen.ts`, berechnet mit derselben Funktion wie bisher (`resolveMatchdayRanks`), aber je Liga; gleiche Gesamtwerte teilen den Rang. Die Rang-Spalte aller Ansichten zeigt jetzt `ligaRang`. „Alle Teams“ gibt es nur noch als Rückfall, wenn der Spielstand keine Ligatrennung trägt.
- **Quelle der Liga** ist unverändert `getLeagueOf` aus `seasonState.leagueByTeamId` (Arena, `wertungsTeamInfo`), also dieselbe wie im Saisonstand; keine zweite Logik.
- **Layout**: nebeneinander passt bei 1920×1080 und 2560×1440 ohne Seiten-Scrollen. Dafür sind die Blöcke kompakt: `#`, Team, D1, D2, Gesamt, Saison-Rang. Form, Captain und Mutator stehen weiter im Blatt rechts (Mutator-Spalte/-Logik unberührt, ein anderer Agent arbeitet daran). Die volle Tabelle bleibt über „Liga 1“ / „Liga 2“ einzeln erreichbar.
- Titel ist jetzt `h2` (nur ein `h1` in der Shell).

## Tests

`tests/spieltagswertung-neu.test.ts`: Rang je Liga ab 1 mit Gleichstand, Gruppierung (eigene Liga zuerst, jedes Team genau in seiner Liga, Rang je Block 1..n), Anzeige (zwei Blöcke, Team nur im eigenen Block, ohne Ligatrennung volle Tabelle).

## Bilder

`docs/design/spieltagswertung-ligen-18-11/ligen-1920.png`, `ligen-2560.png`.

Ehrlicher Hinweis zur Herkunft: Die Bilder stammen, wie schon bei #1625, aus einem **Prüfstand** (die echte Komponente per `renderToString` mit 32 erfundenen Teams, echtem CSS, Schriften und Wappen, Chromium, deviceScaleFactor 1), nicht aus der laufenden App. Grund: Die App steht hinter dem Login (Testbenutzer-Passwort liegt bei Chris), ein Spielstand im Spieltag ist lokal nicht vorhanden, und die Platte ist knapp. Statisch heißt: keine Klicks; gezeigt ist der Start „Beide Ligen“.

## Abgleich mit dem Mockup (Screen Spieltagswertung)

| Punkt | Mockup | Stand |
|---|---|---|
| Eine Zeile je Team, Marke S/N bzw. 1.–4., Punkte | ja | drin (kompakt) |
| Zwei Ligen getrennt | Filter Liga 2 / Liga 1 / Alle 32 | angepasst: „Beide Ligen“ als Start, Blöcke mit eigenem Rang |
| Spalten Mutator, Form, Captain in der Tabelle | ja | in „Beide Ligen“ nicht in der Tabelle, nur im Blatt; in der Einzelliga-Ansicht drin |
| Blatt rechts mit Aufschlüsselung | ja | drin |
| Gruppen-Zelle „Gr. n“ | ja | fehlt (wie schon in #1625: Gruppenwert statt Nummer) |
| Filter „Alle 32“ | ja | ersetzt durch „Beide Ligen“ |
