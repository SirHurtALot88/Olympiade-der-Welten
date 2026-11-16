# QA-Durchgang Battle Arena — 16.11. (Stand `origin/main` 8198dc03, #1502–#1519)

Stichproben-QA nach Chris' Auftrag („erst einarbeiten, mergen und dann testen … Abgleich ob Assets sich überlagern … Polish aller Disziplinen“). Prüfer: Opus-Agent, nur gemessen, nichts geändert. Fingerabdruck **GESAMT e80babacb68c (75)**.

Methode: Playwright gegen `public/mockups/battle-mode.html` (statischer Server), 24 Läufe in frischer Seite: Disziplin-Chip, Varianten-/Format-Chip pinnen, Arena-Tab, Spiel mit Countdown, 5 s Bildrate, Bild in der Spielmitte, `schnellDurch()` bis zum Ende, Endstand. Screenshots: `docs/design/qa-durchgang-16-11/` (`b01…b30` Befunde, `g01…g07` Gut-Beispiele).

## Überall in Ordnung
Keine Seiten-/Konsolenfehler, kein 404 (24 Läufe); alle Figuren echte PixelLab-Figuren; Bildrate headless 52–60/s; Chips (`aria-pressed`, Fokus, Pin verfällt beim Disziplinwechsel); **kein Remount-Leck** (6× Wechsel mit `stopp()`: Rückrufe konstant 60/s, 42 MB). Hohe Bildrate ≠ flüssig, s. Befund 3.

## Tabelle nach Disziplin
| Disziplin | Ergebnis | Schwere |
|---|---|---|
| TDM | Figuren zwei Reihen, nur kurze Ausfallschritte; Namen von der Figur darunter verdeckt | mittel |
| Spurt klassisch | Plan-Etiketten im Pulk überlappen; Bewegung flüssig | niedrig |
| Spurt Hatz | Spiel-Anzeige oben verdeckt Stations-Etiketten; Schlussuhr 10:35, Siegerzeit 11,1 s | niedrig–mittel |
| Spurt HYROX | ~20 s leere Halle ohne Läufer (Kamera); Spiel-Anzeige über der Rangliste | **hoch** |
| Zeitfahren | Endstand-Punkte ungerundet („7.750253807106592“); Zielraum-Etiketten verklumpen | **hoch** |
| Climbing | Spiel-Anzeige verdeckt den Führenden | mittel |
| Takeshi | Namensschilder im Pulk unlesbar; „Ausgeschieden“ bleibt nach Ende stehen | mittel |
| Staffel | Namen der Wartenden übereinander; Endtext „3:12,4 gegen 2:40,9“ Heimzeit zuerst; Spalte PUNKTE abgeschnitten | mittel |
| Mini-DM | Schwebetexte stapeln sich; ausgeschaltete Figur steht aufrecht | niedrig |
| Fechten | Stand „115 : -115“; Statuszeile über den Fechtern | mittel |
| Battlefield | **Ruckeln: Positionen nur jedes 5. Bild (12 Hz)** | **hoch** |
| Gewichtheben / Wettessen | ok | – |
| Showcase | ok; %-Werte brechen im Endstand um | niedrig |
| Eiskunstlauf | Zeilen im Zwischenstand übereinander + leere Zeile; „Führungswechsel“ verdeckt Paar | mittel |
| Breaking | Endstand-Tabelle zu breit | mittel |
| Basketball / Football / Hockey | **Nach Quick-Sim bleibt „PAUSE Ende n. Viertel“ über dem Endstand, „Schließen“ blockiert**; Hockey zusätzlich Positionen nur jedes 2. Bild (30 Hz) | **hoch** |
| Tennis | Stand „-342 : 340“; Endstand 0:5 bei 6 Plätzen (prüfen) | mittel |
| Speed-Schach | Stand „-149 : 133“; Ruckler bis 117 ms | mittel |
| I-Spy | Zugtabelle unten verdeckt ~20 % des Felds | mittel |

## Priorisierte Befunde (alles `public/mockups/battle-mode.engine.js`)
1. **Pausen-Overlay nach Quick-Sim** (Basketball/Football/Hockey): `starteViertelpause()` (L14162–14168) blendet ein, ausgeblendet wird nur in `updateHudFeldspiel()` (L17478–17486), die nur aus `loop()` bei `running` läuft; nach `schnellDurch()` (L63943, `ende()` ≈L63964) nie. Die Spieltags-Ansicht nutzt Quick-Sim → im echten Spiel sichtbar. Fix: in `ende()` `vpSichtbarBis=0`, `#viertelpause.hidden=true`.
2. **HYROX-Kamera:** `t=Math.min(1,dt*2.2)` (L49472) in Sim-Zeit, bei `ZEIT_DEHNUNG.spurt=11.14` (L55490) ~11× zu träge. Fix: Wandzeit-dt oder `zeitFaktor()`.
3. **Ruckeln Battlefield/Hockey/TDM/Mini-DM:** `anzeigeSechzigstel()` (L55917) rechnet nur jedes `zf`-te Bild; `viMische()` (L55871) gilt nur für Bahn (`!istBahn → null`). Fix: `viSchnappschuss()`/`viMische()` auf `U[].x/y` (Kampf) und `FSTEAM`/Puck (Feldspiel) erweitern (Muster #1503).
4. **Zeitfahren-Punkte ungerundet:** `bahnTeamstand()` Zeitfahren-Zweig ohne `fmt` (L42385) → `String(v)` (L58204/58243/58255). Fix: `fmt:v=>v.toFixed(1).replace(".",",")`.
5. **Negativer Stand bei Duell-Bühnen** (Fechten/Tennis/Schach): `buehneDuellStandText()` (L29944) summiert gegenläufigen Vorteil.
6. **Überdeckung durch die Spiel-Anzeige oben** (Hatz, Climbing, Battlefield, Tennis, Schach, HYROX-Rangliste, I-Spy-Zugtabelle, Eiskunstlauf-Panel): oberes Band ~56 px freihalten bzw. Etiketten verschieben.
7. **Namensschilder im Pulk** (Takeshi, Staffel, TDM, Zeitfahren-Ziel, Spurt): ausdünnen/versetzen wie #1498; TDM-Reihenabstand.
8. **Staffel-Endtext** (L42422/L42950) Siegerzeit zuerst; Endstand-Tabellen (Breaking/Staffel/Showcase) Spaltenbreite.
9. Niedrig: Spurt-Format-Pin bleibt über Disziplinwechsel (gewollt?); Spiel-Anzeige nach Ende bei Bahn/Bühne sichtbar, bei TDM nicht; Zähler „0 an der Bahn“; „Ausgeschieden“ bleibt; `loop()` zeichnet nach Spielende weiter (5–8 ms/Bild); Schach-Ruckler.

## Foundation (lokaler Dev-Server, Kopie eines alten SQLite-Stands)
Zehn Ansichten ohne Fehler/404. **Befund:** Training bei 1440 px Fensterbreite 1530 px breit, `nl-training-table` breiter als ihre Karte, Spalten VERTRAG und Klassen-Vorschlag abgeschnitten (`TrainingCompactNewLook.tsx` L1418–1420, `app/globals.css` L54844). Zu prüfen: matchday-arena Titel „Staffel“ vs. Auswahlfeld „1. Climbing · gewertet“ (evtl. alter Spielstand).

## Nicht geprüft
Spieltags-Ansicht mit echtem Kader, Pod-Varianten (Battlefield-Pod, Bahn-Pod); echtes Ruckeln auf Chris' Gerät (headless = Software-Rendering).
