# Spieltagswertung neu — Bau (18.11.)

Vorlage: `public/mockups/arena-spieltag-modern-18-11.html` Screen 5, Erklärung `docs/design/arena-spieltag-modern-18-11.md` Abschnitt 3.

Code: `app/foundation/discipline-stage/DisciplineStageSpieltagswertung.tsx` (Anzeige), `spieltagswertung-zeilen.ts` (Zeilen, Filter, Sortierung, rein), `spieltagswertung-modern.css`. Die Arena nutzt sie statt `DisciplineStageMatchdayPanel`; das alte Panel bleibt als Quelle der Typen und Rang-Helfer (und seiner Tests) stehen.

## Bilder

Die Bilder entstanden NICHT aus dem Produktionsbau der App, sondern aus einem Prüfstand: die echte Komponente per `renderToString` mit erfundenen 32 Teams, echtem CSS, Schriften, Wappen und Portraits, in Chromium bei 1920×1080 und 2560×1440. Grund: Plattenplatz knapp, Spieltag-Spielstand hinter Login. Der Prüfstand ist statisch (keine Filter-Klicks), „Alle 32" wurde über fehlende Liga-Zuordnung erzeugt.

`liga-1920.png`, `liga-2560.png` (16 Teams ohne Scrollen), `alle32-1920.png`, `alle32-2560.png` (nur der Tabellenkörper scrollt).

## Mockup vs. Bau

| Punkt | Mockup | Bau |
|---|---|---|
| Eine Zeile je Team, Spaltengruppen „Ergebnis" / „Wirkung im Score · keine Punkte" | ja | ja, Form und Captain rechts von Gesamt |
| Marke S/N bzw. 1.–4., Endstand, Punkte | ja | ja; zusätzlich U bei Gleichstand |
| Gruppen-Zelle | „Gr. n" | Gruppenwert statt Gruppennummer (Nummer liefert die Preview nicht) |
| Blatt: Ergebnis in Worten, drei Kacheln, Spieler, Rechnung | ja | ja |
| Rolle des Spielers im Blatt | Rolle | entfällt (Preview trägt keine Rollenbezeichnung), Captain-Marke „C" bleibt |
| Filter | Liga 2/1, Alle 32, Gruppe, Menschen | gleich; Liga-Tasten nur mit Ligatrennung im Spielstand, Gruppe nur mit Vierergruppe |
| Verschlossene Disziplin 2 | Schloss | Schloss in D2, Gesamt, #, Rang nach |
| Korrekturschleife | | Gruppenkopf „Wirkung im Score · keine Punkte" war abgeschnitten, jetzt zweizeilig |
