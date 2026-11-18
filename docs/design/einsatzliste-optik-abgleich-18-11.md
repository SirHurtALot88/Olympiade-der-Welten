# Einsatzliste, Optik-Runde: Abgleich mit dem Mockup (18.11.)

Auftrag Chris, 18.11.: Der mittlere Bereich (Feld, Platzkarten, Formkarten) ist „deutlich schlechter und gequetschter
als im Mockup“, die Gegneranalyse fehlt, die Spielflächen sollen aus PixelLab kommen, und die echten Pixel-Figuren der
eingesetzten Spieler sollen auf dem Feld stehen („da sieht man sogar die Models, das will ich so auch drin haben“).
Soll-Bilder: `public/mockups/einsatzliste-modern-17-11.html`, `public/mockups/form-moral-modern-17-11.html` (Einsatzliste)
und für die Figuren `public/mockups/app-rahmen-modern-18-11.html` (Branch `claude/app-rahmen-mockup-18-11`).

Nichts an Wertung, Rechnung oder Formkarten-Zerlegung geändert (eine Wahrheit, „gezeigt = gebucht“). Neu ist nur Anzeige.

## Was gebaut wurde

| Datei | Inhalt |
|---|---|
| `app/foundation/legacy-lineup-lab/einsatzliste-optik.css` | Raster mit voller Höhe (`flex: none`, `clamp()`), Platzkarten und Figuren wachsen mit dem Feld (Container-Einheiten `cqw`), Fläche, Karten-Hand, Reiter „Gegner“ |
| `EinsatzlisteKartenHand.tsx` | Formkarten-Hand als Kacheln wie im Form/Moral-Mockup (Farbkopf, passt/fremd ½, große Zahl, Spieler, 1/2-Marke, „Karten fürs Team“) |
| `EinsatzlisteGegnerTab.tsx` + `lib/lineups/einsatzliste-gegner-vergleich.ts` | Reiter „Gegner“: Gegnerkarte, Platz gegen Platz mit ±, Gruppe am Spieltag, Saison-Rivalen |
| `EinsatzlisteFeldHintergrund.tsx` | Linien per SVG über der Fläche (Basketball, Hockey, Football, neu: Tennis), `.tint`-Hälften bleiben |
| `EinsatzlisteModern.tsx` | Fläche als `<img>` unter den Linien (Rückfall Vollton bei fehlender Datei), Figuren, Verdrahtung |
| `lib/lineups/gegner-schaetzung.ts` | zwei additive Felder: `gegnerTeamId` (jeder Gruppengegner einzeln schätzbar) und `spielerId` (Porträt/Figur) |

## Abgleich je Mockup-Feature

Legende: **drin** = wie im Mockup, **angepasst** = bewusst anders, **fehlt** = nicht gebaut.

### Feld und Platzkarten

| Mockup-Feature | Stand | Anmerkung |
|---|---|---|
| Große Platzkarten mit Rollenkopf, Porträt, Name, Zahl | drin | wachsen mit der Feldbreite (`clamp()` + `cqw`), bei 2560 rund 1,6× so groß wie vorher |
| Luft zwischen den Karten, klare Hierarchie | angepasst | Formationen mit zwei Karten je Reihe (TDM, Mini-DM, Battlefield) bekommen schmalere Karten, damit sie sich nicht überdecken; Karten und Figuren bleiben im Feld (`clamp()` auf `left`/`top`) |
| Spielfläche je Disziplin, dezent | drin | `public/sprites/einsatzliste-flaechen/<disziplin>.jpg`, gedimmt (Helligkeit 0,46) plus Randvignette, wie `einsatzliste-flaechen-18-11.md` Abschnitt 5 empfiehlt; Pixel-Look bleibt |
| Linien (Basketball, Tennis, Hockey, Football) | drin | per SVG über der Fläche, nicht ins Bild gebacken; Tennis ist neu (Platz, Netz, Aufschlagfelder) |
| Fehlende Fläche | drin | `onError` entfernt das Bild, der bisherige Vollton bleibt |
| Gold-Raute, Captain-Marke, „Offen“ gestrichelt, Beste-Tipp | drin | unverändert |
| Pixel-Figur je eingesetztem Spieler (Rahmen-Mockup) | drin | `getFigurSpriteForPlayer` + `figurPoseUrl(…, "east")`, derselbe Bestand und dieselbe Zuordnung wie Arena und Battle Arena; steht auf der Platzkarte. Fehlt die Figur, bleibt das Porträt in der Karte |
| Gegner-Team gegenüber | angepasst | die geschätzten Gegner-Plätze (Pillen) tragen die Figur in `west`-Pose; nur dort, wo das Scouting den Spieler verrät, sonst keine Figur. Beschriftet als Prognose nach Scouting |
| Figuren-Szene wie im Rahmen-Mockup mit Kulissenbild und Kartenraster darunter | fehlt | das Rahmen-Mockup trennt Bühne und Kartenraster; hier stehen die Figuren auf der Feld-Geometrie der Formation, weil die Platzkarten dort schon liegen. Eine getrennte Bühne wäre ein eigener Umbau |
| Keine neuen PixelLab-Figuren oder Animationen | eingehalten | nur vorhandene Grundposen |

### Taktik-Leiste und Karten-Hand

| Mockup-Feature | Stand | Anmerkung |
|---|---|---|
| Einsatz Schonen/Normal/Vollgas | drin | unverändert |
| Formkarten-Hand als Kacheln | drin | statt zweier Dropdowns; alle freien Karten der Disziplin-Rechnung (`berechneKartenWirkung(…).vergleich`) |
| Kachel: Farbkopf, passt/fremd ½, große Zahl, Spieler | drin | |
| Gelegte Karte mit Goldrand und Nummer | drin | 1 = Primär, 2 = Sekundär (halber Wert) |
| Karten fürs Team (Summe, alle · Farbe · Form) | drin | gleiche Zahlen wie vorher (`KartenLeiste`), nur als Kachelblock rechts; „zählt hier nicht“-Hinweis bleibt |
| Klick legt, Klick auf gelegte Karte nimmt zurück | angepasst | erster Klick Primär, zweiter Sekundär (nur bei Wert über 0), wie die bisherigen Dropdown-Regeln; gespeichert über denselben Formplan-Weg |
| Captain-Wahl, Team-Power, Spielweise | drin | unverändert, bleiben in der Taktik-Zeile |

### Reiter „Gegner“

| Mockup-Feature | Stand | Anmerkung |
|---|---|---|
| Gegnerkarte mit Wappen, Name, Disziplin-Rang | drin | Rang aus `buildTeamDisciplineRankRowsFromGameState` |
| Scouting-Punkte | drin | Stufe 0 bis 5 aus dem Kader-Mittel, dazu Treffsicherheit |
| Saisonrang des Gegners | fehlt | es gibt keinen billigen Datenweg zur Tabellenposition mitten im Spieltag-Kontext der Einsatzliste; der Disziplin-Rang steht |
| Platz gegen Platz mit ± | drin | eigener Platz links (Porträt, Rolle, Eignung), ± in der Mitte, Gegner-Platz rechts als Spanne; ± ist eigene Eignung minus Spannenmitte, grün/rot nur außerhalb der Spanne |
| Seite im Schnitt | angepasst | neue Zeile über dem Duell, damit auch bei verdeckter Aufstellung (Scouting-Stufe 0) etwas Echtes steht (Ø Eignung wir gegen Spanne Gegner) |
| Gruppe am Spieltag (Vierergruppe, alle drei Gegner) | drin | jeder Gegner einzeln geschätzt (gleiche Rechnung wie das Duell), sortiert nach erwartetem Ø Eignung, „PROGNOSE“-Marke, wo keine Aufstellung erkannt ist |
| Zu schlagen (Saison-Rivalen) | drin | aus den echten Top-8-Rivalen der Disziplin (`teamPowerWindows`), Marke „RIVALE“ |
| Prognose klar gekennzeichnet | drin | Marke PROGNOSE / MUSTER / VERDECKT und ein Satz dazu; Eignung bleibt die rohe Disziplin-Eignung, nicht der Platzwert |
| Erfundene Zahlen | keine | Spannen und Ränge kommen aus dem Spielstand; die Mockup-Texte „2 PKT VOR UNS“ u. ä. gibt es nicht |

### Rest der Seite

Kader links, Hero mit D1/D2, Waage, Dock, Reiter Rolle/Karten-Wirkung/Form & Moral/Prüfung: unverändert in Inhalt,
nur größere Spalten bei breiten Schirmen (Kader und Kontext wachsen mit `clamp()`, ab 2200 px zusätzlich 14 % größere Schrift).

## Offene Punkte

1. Rahmen-Mockup-Bühne (Figuren-Szene mit Kulissenbild oben, Kartenraster unten) ist nicht nachgebaut, siehe Tabelle. Kommt als nächster PR. Aufwand grob 1 Tag: Feld in Bühne (Kulisse aus `einsatzlisteKulisseBild`, Figuren je Slot mit Rollen-Kürzel am Fuß, Gegner gegenüber) und Kartenraster teilen, die Formations-Geometrie für Figuren-Positionen umrechnen, Abgleich mit `app-rahmen-modern-18-11.html`. Die Figuren selbst stehen schon (diese PR), das Umbauen betrifft nur die Anordnung.
1a. Die App-Aufnahmen (drei Größen, Abgleich-Bilder Mockup | App) fehlen in diesem Stand: Aufnahme-Läufe stürzten am Speicherdeckel ab. Sie kommen aus dem zentralen Screenshot-Lauf; Skripte `scripts/screenshot-einsatzliste-optik.ts` (zwei Phasen `bau` und `foto`) und `scripts/baue-einsatzliste-abgleich.sh` liegen bereit.
2. Bei Scouting-Stufe 0 sind Gegner-Plätze verdeckt (bestehende Regel von 08.11.): Platz gegen Platz zeigt dann nur „?“,
   darüber steht aber der Schnitt. Mehr Scouting öffnet die Namen und Figuren.
3. Saisonrang des Gegners (siehe oben).
4. Die Fläche der schwachen Disziplinen (Gewichtheben, Staffel) ist laut Flächen-Doku nur „brauchbar“; Austausch ist Sache der Flächen-Runde.

## Bilder

Aufnahmen mit `scripts/screenshot-einsatzliste-optik.ts` (Wegwerf-Battle-Save, Port 3211, Kapitän gesetzt, per
„Auffüllen“ besetzt) und `scripts/screenshot-einsatzliste-mockups.mjs`; Abgleich-Bilder mit
`scripts/baue-einsatzliste-abgleich.sh`. Alles in `docs/design/einsatzliste-optik-18-11/`:
`app-<disziplin>-<breite>.png`, `app-<disziplin>-gegner-<breite>.png`, `mockup-*.png`, `abgleich-*.png`.
